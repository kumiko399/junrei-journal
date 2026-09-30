use age::secrecy::SecretString;
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use image::{DynamicImage, ImageDecoder, ImageReader};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{Cursor, Read, Write},
    iter,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};
use tauri::{Manager, State};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

struct AppPaths {
    root: PathBuf,
    media: PathBuf,
    thumbnails: PathBuf,
    database: PathBuf,
}

struct AppState {
    db: Mutex<Connection>,
    paths: AppPaths,
}

fn app_paths(app: &tauri::AppHandle) -> Result<AppPaths> {
    let exe = std::env::current_exe()?;
    let portable = exe
        .parent()
        .map(|p| p.join("portable.flag").exists())
        .unwrap_or(false);
    let root = if portable {
        exe.parent()
            .ok_or_else(|| anyhow!("无法确定程序目录"))?
            .join("data")
    } else {
        app.path().app_data_dir()?
    };
    let media = root.join("media");
    let thumbnails = root.join("thumbnails");
    fs::create_dir_all(&media)?;
    fs::create_dir_all(&thumbnails)?;
    Ok(AppPaths {
        database: root.join("junrei.db"),
        root,
        media,
        thumbnails,
    })
}

fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys=ON;
         PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS works(id TEXT PRIMARY KEY, anitabi_bangumi_id INTEGER, title_cn TEXT NOT NULL, json TEXT NOT NULL);
         CREATE UNIQUE INDEX IF NOT EXISTS idx_works_anitabi ON works(anitabi_bangumi_id) WHERE anitabi_bangumi_id IS NOT NULL;
         CREATE TABLE IF NOT EXISTS spots(id TEXT PRIMARY KEY, work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE, anitabi_point_id TEXT, latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180), json TEXT NOT NULL);
         CREATE UNIQUE INDEX IF NOT EXISTS idx_spots_anitabi ON spots(work_id, anitabi_point_id) WHERE anitabi_point_id IS NOT NULL;
         CREATE INDEX IF NOT EXISTS idx_spots_work ON spots(work_id);
         CREATE TABLE IF NOT EXISTS visits(id TEXT PRIMARY KEY, spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE, visited_at TEXT NOT NULL, json TEXT NOT NULL);
         CREATE INDEX IF NOT EXISTS idx_visits_spot_date ON visits(spot_id, visited_at);
         CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY, spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE, visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL, sha256 TEXT, relative_path TEXT NOT NULL, json TEXT NOT NULL);
         CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_sha ON photos(sha256) WHERE sha256 IS NOT NULL;
         CREATE TABLE IF NOT EXISTS tags(id TEXT PRIMARY KEY, name TEXT NOT NULL, json TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS spot_tags(spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(spot_id, tag_id));
         CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS import_history(id TEXT PRIMARY KEY, source TEXT NOT NULL, source_id TEXT, imported_at TEXT NOT NULL, summary TEXT NOT NULL);
         INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(1, CURRENT_TIMESTAMP);",
    )?;
    Ok(())
}

fn default_snapshot() -> Value {
    json!({
        "schemaVersion": 1, "works": [], "spots": [], "visits": [], "photos": [], "tags": [], "spotTags": [],
        "settings": {
            "mapProvider": "open",
            "mapStyleUrl": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            "mapAttribution": "© OpenStreetMap contributors",
            "mapAttributionUrl": "https://www.openstreetmap.org/copyright",
            "theme": "light",
            "compactNavigation": false
        }
    })
}

fn select_json(conn: &Connection, sql: &str) -> Result<Vec<Value>> {
    let mut statement = conn.prepare(sql)?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    rows.map(|row| Ok(serde_json::from_str(&row?)?)).collect()
}

fn load_from_db(conn: &Connection) -> Result<Value> {
    let mut snapshot = default_snapshot();
    snapshot["works"] = Value::Array(select_json(conn, "SELECT json FROM works ORDER BY rowid")?);
    snapshot["spots"] = Value::Array(select_json(conn, "SELECT json FROM spots ORDER BY rowid")?);
    snapshot["visits"] = Value::Array(select_json(
        conn,
        "SELECT json FROM visits ORDER BY visited_at DESC",
    )?);
    snapshot["photos"] = Value::Array(select_json(
        conn,
        "SELECT json FROM photos ORDER BY rowid DESC",
    )?);
    snapshot["tags"] = Value::Array(select_json(conn, "SELECT json FROM tags ORDER BY name")?);
    let spot_tags: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key='spot_tags'",
            [],
            |row| row.get(0),
        )
        .ok();
    if let Some(value) = spot_tags {
        snapshot["spotTags"] = serde_json::from_str(&value)?;
    }
    let settings: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key='app_settings'",
            [],
            |row| row.get(0),
        )
        .ok();
    if let Some(value) = settings {
        let stored: Value = serde_json::from_str(&value)?;
        if let Some(settings) = stored.as_object() {
            for (key, value) in settings {
                snapshot["settings"][key] = value.clone();
            }
        } else {
            return Err(anyhow!("设置格式无效"));
        }
    }
    Ok(snapshot)
}

fn required_str<'a>(value: &'a Value, key: &str) -> Result<&'a str> {
    value
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("字段 {key} 缺失"))
}

fn save_to_db(conn: &mut Connection, snapshot: &Value) -> Result<()> {
    if snapshot["schemaVersion"] != 1 {
        return Err(anyhow!("不支持的数据版本"));
    }
    if !snapshot["settings"].is_object() || !snapshot["spotTags"].is_array() {
        return Err(anyhow!("设置或地点标签格式无效"));
    }
    let tx = conn.transaction()?;
    tx.execute_batch("DELETE FROM spot_tags; DELETE FROM photos; DELETE FROM visits; DELETE FROM spots; DELETE FROM works; DELETE FROM tags;")?;
    for work in snapshot["works"]
        .as_array()
        .ok_or_else(|| anyhow!("works 必须是数组"))?
    {
        tx.execute(
            "INSERT INTO works(id,anitabi_bangumi_id,title_cn,json) VALUES(?1,?2,?3,?4)",
            params![
                required_str(work, "id")?,
                work.get("anitabiBangumiId").and_then(Value::as_i64),
                required_str(work, "titleCn")?,
                work.to_string()
            ],
        )?;
    }
    for spot in snapshot["spots"]
        .as_array()
        .ok_or_else(|| anyhow!("spots 必须是数组"))?
    {
        tx.execute("INSERT INTO spots(id,work_id,anitabi_point_id,latitude,longitude,json) VALUES(?1,?2,?3,?4,?5,?6)", params![required_str(spot, "id")?, required_str(spot, "workId")?, spot.get("anitabiPointId").and_then(Value::as_str), spot["latitude"].as_f64(), spot["longitude"].as_f64(), spot.to_string()])?;
    }
    for visit in snapshot["visits"]
        .as_array()
        .ok_or_else(|| anyhow!("visits 必须是数组"))?
    {
        tx.execute(
            "INSERT INTO visits(id,spot_id,visited_at,json) VALUES(?1,?2,?3,?4)",
            params![
                required_str(visit, "id")?,
                required_str(visit, "spotId")?,
                required_str(visit, "visitedAt")?,
                visit.to_string()
            ],
        )?;
    }
    for photo in snapshot["photos"]
        .as_array()
        .ok_or_else(|| anyhow!("photos 必须是数组"))?
    {
        tx.execute("INSERT INTO photos(id,spot_id,visit_id,sha256,relative_path,json) VALUES(?1,?2,?3,?4,?5,?6)", params![required_str(photo, "id")?, required_str(photo, "spotId")?, photo.get("visitId").and_then(Value::as_str), photo.get("sha256").and_then(Value::as_str), required_str(photo, "relativePath")?, photo.to_string()])?;
    }
    for tag in snapshot["tags"]
        .as_array()
        .ok_or_else(|| anyhow!("tags 必须是数组"))?
    {
        tx.execute(
            "INSERT INTO tags(id,name,json) VALUES(?1,?2,?3)",
            params![
                required_str(tag, "id")?,
                required_str(tag, "name")?,
                tag.to_string()
            ],
        )?;
    }
    tx.execute("INSERT INTO settings(key,value) VALUES('spot_tags',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [snapshot["spotTags"].to_string()])?;
    tx.execute("INSERT INTO settings(key,value) VALUES('app_settings',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [snapshot["settings"].to_string()])?;
    tx.commit()?;
    Ok(())
}

#[tauri::command]
fn load_snapshot(state: State<AppState>) -> std::result::Result<Value, String> {
    let conn = state.db.lock().map_err(|_| "数据库锁异常")?;
    let mut snapshot = load_from_db(&conn).map_err(|e| e.to_string())?;
    if let Some(photos) = snapshot["photos"].as_array_mut() {
        for photo in photos {
            if let Some(relative) = photo["relativePath"].as_str() {
                if managed_media_path(relative).is_ok() {
                    photo["fileUrl"] = json!(state.paths.root.join(relative).to_string_lossy());
                }
            }
        }
    }
    Ok(snapshot)
}

fn managed_media_path(relative: &str) -> Result<&str> {
    let mut parts = relative.split('/');
    let folder = parts.next().unwrap_or("");
    let name = parts.next().unwrap_or("");
    if !["media", "thumbnails"].contains(&folder)
        || name.is_empty()
        || name == "."
        || name == ".."
        || name.contains(['\\', ':'])
        || parts.next().is_some()
    {
        return Err(anyhow!("照片路径无效"));
    }
    Ok(relative)
}

fn photo_thumbnail(bytes: &[u8]) -> Result<(DynamicImage, u32, u32)> {
    let mut decoder = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()?
        .into_decoder()?;
    let orientation = decoder.orientation()?;
    let mut image = DynamicImage::from_decoder(decoder)?;
    image.apply_orientation(orientation);
    let (width, height) = (image.width(), image.height());
    let thumbnail =
        DynamicImage::ImageRgb8(image.thumbnail(width.min(900), height.min(900)).to_rgb8());
    Ok((thumbnail, width, height))
}

#[tauri::command]
fn save_snapshot(snapshot: Value, state: State<AppState>) -> std::result::Result<(), String> {
    let mut conn = state.db.lock().map_err(|_| "数据库锁异常")?;
    save_to_db(&mut conn, &snapshot).map_err(|e| e.to_string())
}

async fn get_json_with_retry(client: &reqwest::Client, url: &str) -> Result<Value> {
    let mut last = None;
    for _ in 0..2 {
        match client.get(url).send().await {
            Ok(response) if response.status().is_success() => return Ok(response.json().await?),
            Ok(response) => last = Some(anyhow!("Anitabi 返回 HTTP {}", response.status())),
            Err(error) => last = Some(error.into()),
        }
    }
    Err(last.unwrap_or_else(|| anyhow!("Anitabi 请求失败")))
}

#[tauri::command]
async fn fetch_anitabi(subject_id: u64) -> std::result::Result<Value, String> {
    if subject_id == 0 {
        return Err("Bangumi ID 无效".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!(
            "JunreiJournal/",
            env!("CARGO_PKG_VERSION"),
            " (+https://github.com/kumiko399/junrei-journal)"
        ))
        .build()
        .map_err(|e| e.to_string())?;
    let lite = get_json_with_retry(
        &client,
        &format!("https://api.anitabi.cn/bangumi/{subject_id}/lite"),
    )
    .await
    .map_err(|e| e.to_string())?;
    let points = get_json_with_retry(
        &client,
        &format!("https://api.anitabi.cn/bangumi/{subject_id}/points/detail?haveImage=true"),
    )
    .await
    .map_err(|e| e.to_string())?;
    let mut result = lite;
    result["points"] = points;
    Ok(result)
}

#[tauri::command]
fn import_photo(
    source_path: String,
    spot_id: String,
    visit_id: Option<String>,
    state: State<AppState>,
) -> std::result::Result<Value, String> {
    (|| -> Result<Value> {
        let source = PathBuf::from(source_path);
        let extension = source.extension().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();
        if !["jpg", "jpeg", "png", "webp"].contains(&extension.as_str()) { return Err(anyhow!("只支持 JPG、PNG 和 WebP 图片")); }
        let bytes = fs::read(&source).context("无法读取照片")?;
        if bytes.len() > 50 * 1024 * 1024 { return Err(anyhow!("单张照片不能超过 50MB")); }
        let hash = format!("{:x}", Sha256::digest(&bytes));
        let existing = { let conn = state.db.lock().map_err(|_| anyhow!("数据库锁异常"))?; conn.query_row("SELECT json FROM photos WHERE sha256=?1", [&hash], |row| row.get::<_, String>(0)).ok() };
        if let Some(raw) = existing { return Ok(serde_json::from_str(&raw)?); }
        let id = Uuid::new_v4().to_string();
        let filename = format!("{id}.{extension}");
        let target = state.paths.media.join(&filename);
        let (thumbnail, width, height) = photo_thumbnail(&bytes)?;
        let thumb_name = format!("{id}.jpg");
        let thumb_path = state.paths.thumbnails.join(&thumb_name);
        thumbnail.save_with_format(&thumb_path, image::ImageFormat::Jpeg)?;
        fs::write(&target, &bytes)?;
        let value = json!({ "id": id, "spotId": spot_id, "visitId": visit_id, "relativePath": format!("media/{filename}"), "thumbnailPath": format!("thumbnails/{thumb_name}"), "fileUrl": target.to_string_lossy(), "sha256": hash, "photoType": "visit", "caption": null, "takenAt": null, "sortOrder": 0, "isCover": false, "width": width, "height": height, "createdAt": Utc::now().to_rfc3339() });
        Ok(value)
    })().map_err(|e| e.to_string())
}

fn credential() -> Result<keyring::Entry> {
    Ok(keyring::Entry::new(
        "app.junrei.journal",
        "google-maps-api-key",
    )?)
}

#[tauri::command]
fn get_google_api_key() -> std::result::Result<String, String> {
    match credential().and_then(|entry| entry.get_password().map_err(Into::into)) {
        Ok(value) => Ok(value),
        Err(_) => Ok(String::new()),
    }
}

#[tauri::command]
fn set_google_api_key(value: String) -> std::result::Result<(), String> {
    let entry = credential().map_err(|e| e.to_string())?;
    if value.trim().is_empty() {
        let _ = entry.delete_credential();
        Ok(())
    } else {
        entry.set_password(value.trim()).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn read_legacy_export(source_path: String) -> std::result::Result<Value, String> {
    (|| -> Result<Value> {
        let path = PathBuf::from(source_path);
        if path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("json"))
            != Some(true)
        {
            return Err(anyhow!("请选择 JSON 导出文件"));
        }
        let metadata = fs::metadata(&path)?;
        if metadata.len() > 100 * 1024 * 1024 {
            return Err(anyhow!("导出文件不能超过 100MB"));
        }
        Ok(serde_json::from_slice(&fs::read(path)?)?)
    })()
    .map_err(|e| e.to_string())
}

fn zip_backup(snapshot: &Value, paths: &AppPaths) -> Result<Vec<u8>> {
    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let counts = json!({ "works": snapshot["works"].as_array().map_or(0, Vec::len), "spots": snapshot["spots"].as_array().map_or(0, Vec::len), "visits": snapshot["visits"].as_array().map_or(0, Vec::len), "photos": snapshot["photos"].as_array().map_or(0, Vec::len) });
    let mut backup_snapshot = snapshot.clone();
    let mut media = std::collections::BTreeSet::new();
    for photo in backup_snapshot["photos"]
        .as_array_mut()
        .ok_or_else(|| anyhow!("照片格式无效"))?
    {
        if let Some(relative) = photo["relativePath"]
            .as_str()
            .filter(|value| value.starts_with("media/"))
        {
            media.insert(managed_media_path(relative)?.to_owned());
            if let Some(thumbnail) = photo["thumbnailPath"].as_str() {
                media.insert(managed_media_path(thumbnail)?.to_owned());
            }
            photo.as_object_mut().unwrap().remove("fileUrl");
        }
    }
    let data = serde_json::to_vec_pretty(&backup_snapshot)?;
    let manifest = json!({ "format": "junrei-backup-v1", "createdAt": Utc::now().to_rfc3339(), "appVersion": env!("CARGO_PKG_VERSION"), "counts": counts, "dataSha256": format!("{:x}", Sha256::digest(&data)) });
    zip.start_file("manifest.json", options)?;
    zip.write_all(&serde_json::to_vec_pretty(&manifest)?)?;
    zip.start_file("data.json", options)?;
    zip.write_all(&data)?;
    for relative in media {
        zip.start_file(&relative, options)?;
        zip.write_all(&fs::read(paths.root.join(&relative)).context("备份缺少照片文件")?)?;
    }
    Ok(zip.finish()?.into_inner())
}

fn encrypt_age(bytes: &[u8], password: &str) -> Result<Vec<u8>> {
    let passphrase = SecretString::from(password.to_owned());
    let encryptor = age::Encryptor::with_user_passphrase(passphrase);
    let mut output = vec![];
    let mut writer = encryptor.wrap_output(&mut output)?;
    writer.write_all(bytes)?;
    writer.finish()?;
    Ok(output)
}

fn decrypt_age(bytes: &[u8], password: &str) -> Result<Vec<u8>> {
    let decryptor = age::Decryptor::new(bytes)?;
    let identity = age::scrypt::Identity::new(SecretString::from(password.to_owned()));
    let mut reader = decryptor.decrypt(iter::once(&identity as &dyn age::Identity))?;
    let mut output = vec![];
    reader.read_to_end(&mut output)?;
    Ok(output)
}

#[tauri::command]
fn export_backup(
    target_path: String,
    password: Option<String>,
    state: State<AppState>,
) -> std::result::Result<(), String> {
    (|| -> Result<()> {
        let conn = state.db.lock().map_err(|_| anyhow!("数据库锁异常"))?;
        let snapshot = load_from_db(&conn)?;
        let zip = zip_backup(&snapshot, &state.paths)?;
        let output = match password.filter(|p| !p.is_empty()) {
            Some(value) => encrypt_age(&zip, &value)?,
            None => zip,
        };
        let target = PathBuf::from(target_path);
        let parent = target.parent().ok_or_else(|| anyhow!("目标路径无效"))?;
        fs::create_dir_all(parent)?;
        let temp = parent.join(format!(".{}.tmp", Uuid::new_v4()));
        fs::write(&temp, output)?;
        fs::rename(temp, target)?;
        Ok(())
    })()
    .map_err(|e| e.to_string())
}

fn read_backup(path: &Path, password: Option<&str>) -> Result<Vec<u8>> {
    let bytes = fs::read(path)?;
    if bytes.starts_with(b"age-encryption.org/") {
        decrypt_age(&bytes, password.ok_or_else(|| anyhow!("这个备份需要密码"))?)
    } else {
        Ok(bytes)
    }
}

fn safe_extract_media(archive: &mut ZipArchive<Cursor<Vec<u8>>>, temp: &Path) -> Result<()> {
    if archive.len() > 100_000 {
        return Err(anyhow!("备份文件数量过多"));
    }
    let mut total = 0u64;
    for index in 0..archive.len() {
        let mut item = archive.by_index(index)?;
        let Some(name) = item.enclosed_name() else {
            return Err(anyhow!("备份包含不安全路径"));
        };
        if !(name.starts_with("media") || name.starts_with("thumbnails")) || item.is_dir() {
            continue;
        }
        managed_media_path(&name.to_string_lossy())?;
        total += item.size();
        if total > 5 * 1024 * 1024 * 1024 {
            return Err(anyhow!("备份解压后超过 5GB"));
        }
        let target = temp.join(name);
        if target.exists() {
            return Err(anyhow!("备份包含重复照片路径"));
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = File::create(target)?;
        std::io::copy(&mut item, &mut output)?;
    }
    Ok(())
}

fn validate_restored_snapshot(snapshot: &Value, manifest: &Value, temp: &Path) -> Result<()> {
    let mut validation = Connection::open_in_memory()?;
    migrate(&validation)?;
    save_to_db(&mut validation, snapshot).context("备份数据结构或关联无效")?;
    let integrity: String = validation.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        return Err(anyhow!("备份数据库完整性检查失败"));
    }
    for table in ["works", "spots", "visits", "photos"] {
        let count = snapshot[table].as_array().map_or(0, Vec::len) as u64;
        if manifest["counts"][table].as_u64() != Some(count) {
            return Err(anyhow!("备份记录数量校验失败：{table}"));
        }
    }
    for photo in snapshot["photos"]
        .as_array()
        .ok_or_else(|| anyhow!("照片格式无效"))?
    {
        let relative = required_str(photo, "relativePath")?;
        if relative.starts_with("media/") {
            managed_media_path(relative)?;
            let bytes = fs::read(temp.join(relative)).context("备份缺少照片文件")?;
            if let Some(hash) = photo["sha256"].as_str() {
                if hash != format!("{:x}", Sha256::digest(&bytes)) {
                    return Err(anyhow!("备份照片校验失败"));
                }
            }
            if let Some(thumbnail) = photo["thumbnailPath"].as_str() {
                managed_media_path(thumbnail)?;
                if !temp.join(thumbnail).is_file() {
                    return Err(anyhow!("备份缺少缩略图"));
                }
            }
        } else {
            let remote = photo["fileUrl"].as_str().unwrap_or("");
            if !(remote.starts_with("https://") || remote.starts_with("http://")) {
                return Err(anyhow!("备份照片路径无效"));
            }
        }
    }
    Ok(())
}

fn install_restored_snapshot(
    conn: &mut Connection,
    snapshot: &Value,
    incoming: &Path,
    root: &Path,
) -> Result<()> {
    let rollback = tempfile::tempdir_in(root)?;
    let mut copied: Vec<(PathBuf, Option<PathBuf>)> = Vec::new();
    let result = (|| -> Result<()> {
        for folder in ["media", "thumbnails"] {
            let source = incoming.join(folder);
            if !source.exists() {
                continue;
            }
            let target = root.join(folder);
            fs::create_dir_all(&target)?;
            for entry in fs::read_dir(source)? {
                let entry = entry?;
                let destination = target.join(entry.file_name());
                let original = if destination.exists() {
                    let saved = rollback.path().join(format!(
                        "{}-{}",
                        folder,
                        entry.file_name().to_string_lossy()
                    ));
                    fs::copy(&destination, &saved)?;
                    Some(saved)
                } else {
                    None
                };
                copied.push((destination.clone(), original));
                fs::copy(entry.path(), &destination)?;
            }
        }
        save_to_db(conn, snapshot)?;
        Ok(())
    })();
    if let Err(error) = result {
        for (destination, original) in copied.into_iter().rev() {
            if let Some(saved) = original {
                fs::copy(saved, &destination)
                    .context("恢复失败，照片回滚失败；请使用恢复前的自动备份")?;
            } else if destination.exists() {
                fs::remove_file(destination)?;
            }
        }
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
fn restore_backup(
    source_path: String,
    password: Option<String>,
    state: State<AppState>,
) -> std::result::Result<(), String> {
    (|| -> Result<()> {
        let bytes = read_backup(Path::new(&source_path), password.as_deref())?;
        let mut archive = ZipArchive::new(Cursor::new(bytes.clone())).context("备份文件损坏")?;
        let mut manifest_raw = String::new();
        archive
            .by_name("manifest.json")?
            .read_to_string(&mut manifest_raw)?;
        let manifest: Value = serde_json::from_str(&manifest_raw)?;
        if manifest["format"] != "junrei-backup-v1" {
            return Err(anyhow!("不支持的备份版本"));
        }
        let mut data = Vec::new();
        archive.by_name("data.json")?.read_to_end(&mut data)?;
        let hash = format!("{:x}", Sha256::digest(&data));
        if manifest["dataSha256"].as_str() != Some(&hash) {
            return Err(anyhow!("备份校验失败"));
        }
        let snapshot: Value = serde_json::from_slice(&data)?;
        let temp = tempfile::tempdir_in(&state.paths.root)?;
        safe_extract_media(&mut archive, temp.path())?;
        validate_restored_snapshot(&snapshot, &manifest, temp.path())?;
        let safety = state.paths.root.join(format!(
            "before-restore-{}.junrei-backup",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        let mut conn = state.db.lock().map_err(|_| anyhow!("数据库锁异常"))?;
        let current = load_from_db(&conn)?;
        fs::write(safety, zip_backup(&current, &state.paths)?)?;
        install_restored_snapshot(&mut conn, &snapshot, temp.path(), &state.paths.root)?;
        Ok(())
    })()
    .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let paths = app_paths(app.handle()).map_err(|e| -> Box<dyn std::error::Error> {
                Box::new(std::io::Error::other(e.to_string()))
            })?;
            let conn = Connection::open(&paths.database)?;
            migrate(&conn).map_err(|e| -> Box<dyn std::error::Error> {
                Box::new(std::io::Error::other(e.to_string()))
            })?;
            app.manage(AppState {
                db: Mutex::new(conn),
                paths,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_snapshot,
            save_snapshot,
            fetch_anitabi,
            import_photo,
            get_google_api_key,
            set_google_api_key,
            read_legacy_export,
            export_backup,
            restore_backup
        ])
        .run(tauri::generate_context!())
        .expect("无法启动巡礼手账");
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample_snapshot() -> Value {
        let mut snapshot = default_snapshot();
        snapshot["works"] = json!([{ "id": "work-1", "titleCn": "测试作品" }]);
        snapshot["spots"] =
            json!([{ "id": "spot-1", "workId": "work-1", "latitude": 35, "longitude": 139 }]);
        snapshot
    }

    fn sample_manifest(snapshot: &Value) -> Value {
        json!({ "counts": { "works": snapshot["works"].as_array().unwrap().len(), "spots": snapshot["spots"].as_array().unwrap().len(), "visits": snapshot["visits"].as_array().unwrap().len(), "photos": snapshot["photos"].as_array().unwrap().len() } })
    }

    #[test]
    fn failed_database_save_preserves_existing_records() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let snapshot = sample_snapshot();
        save_to_db(&mut conn, &snapshot).unwrap();
        let mut invalid = snapshot.clone();
        invalid["spots"][0]["workId"] = json!("missing-work");
        assert!(save_to_db(&mut conn, &invalid).is_err());
        assert_eq!(load_from_db(&conn).unwrap()["spots"], snapshot["spots"]);
    }

    #[test]
    fn backup_validation_checks_version_relations_counts_and_photo_hashes() {
        let temp = tempfile::tempdir().unwrap();
        let snapshot = sample_snapshot();
        let manifest = sample_manifest(&snapshot);
        validate_restored_snapshot(&snapshot, &manifest, temp.path()).unwrap();
        let mut invalid = snapshot.clone();
        invalid["schemaVersion"] = json!(2);
        assert!(validate_restored_snapshot(&invalid, &manifest, temp.path()).is_err());
        invalid = snapshot.clone();
        invalid["spots"][0]["workId"] = json!("missing");
        assert!(validate_restored_snapshot(&invalid, &manifest, temp.path()).is_err());
        let mut wrong_count = manifest.clone();
        wrong_count["counts"]["works"] = json!(2);
        assert!(validate_restored_snapshot(&snapshot, &wrong_count, temp.path()).is_err());
        invalid = snapshot.clone();
        invalid["photos"] = json!([{ "id": "photo-1", "spotId": "spot-1", "relativePath": "media/photo.jpg", "sha256": "incorrect" }]);
        let photo_manifest = sample_manifest(&invalid);
        assert!(validate_restored_snapshot(&invalid, &photo_manifest, temp.path()).is_err());
        fs::create_dir(temp.path().join("media")).unwrap();
        fs::write(temp.path().join("media/photo.jpg"), b"test-image").unwrap();
        assert!(validate_restored_snapshot(&invalid, &photo_manifest, temp.path()).is_err());
        invalid["photos"][0]["sha256"] = json!(format!("{:x}", Sha256::digest(b"test-image")));
        validate_restored_snapshot(&invalid, &photo_manifest, temp.path()).unwrap();
    }

    #[test]
    fn restore_rolls_back_overwritten_and_new_files_on_database_failure() {
        let root = tempfile::tempdir().unwrap();
        let incoming = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("media")).unwrap();
        fs::create_dir(incoming.path().join("media")).unwrap();
        fs::write(root.path().join("media/existing.jpg"), b"original").unwrap();
        fs::write(incoming.path().join("media/existing.jpg"), b"replacement").unwrap();
        fs::write(incoming.path().join("media/new.jpg"), b"new").unwrap();
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let snapshot = sample_snapshot();
        save_to_db(&mut conn, &snapshot).unwrap();
        let mut invalid = snapshot.clone();
        invalid["spots"][0]["workId"] = json!("missing");
        assert!(
            install_restored_snapshot(&mut conn, &invalid, incoming.path(), root.path()).is_err()
        );
        assert_eq!(
            fs::read(root.path().join("media/existing.jpg")).unwrap(),
            b"original"
        );
        assert!(!root.path().join("media/new.jpg").exists());
        assert_eq!(load_from_db(&conn).unwrap()["spots"], snapshot["spots"]);
    }

    #[test]
    fn transparent_photo_can_generate_jpeg_thumbnail() {
        let image = DynamicImage::new_rgba8(3, 2);
        let mut bytes = Cursor::new(Vec::new());
        image.write_to(&mut bytes, image::ImageFormat::Png).unwrap();
        let (thumbnail, width, height) = photo_thumbnail(bytes.get_ref()).unwrap();
        assert_eq!((width, height), (3, 2));
        thumbnail
            .write_to(&mut Cursor::new(Vec::new()), image::ImageFormat::Jpeg)
            .unwrap();
    }

    #[test]
    fn jpeg_exif_orientation_is_applied_before_thumbnailing() {
        let image = DynamicImage::new_rgb8(2, 3);
        let mut jpeg = Cursor::new(Vec::new());
        image.write_to(&mut jpeg, image::ImageFormat::Jpeg).unwrap();
        let exif = b"Exif\0\0II\x2a\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0\x06\0\0\0\0\0\0\0";
        let mut bytes = vec![0xff, 0xd8, 0xff, 0xe1];
        bytes.extend_from_slice(&((exif.len() + 2) as u16).to_be_bytes());
        bytes.extend_from_slice(exif);
        bytes.extend_from_slice(&jpeg.get_ref()[2..]);
        let (thumbnail, width, height) = photo_thumbnail(&bytes).unwrap();
        assert_eq!((width, height), (3, 2));
        assert_eq!((thumbnail.width(), thumbnail.height()), (3, 2));
    }

    #[test]
    fn large_photo_thumbnail_preserves_aspect_ratio_and_size_limit() {
        let image = DynamicImage::new_rgb8(1200, 600);
        let mut bytes = Cursor::new(Vec::new());
        image.write_to(&mut bytes, image::ImageFormat::Png).unwrap();
        let (thumbnail, width, height) = photo_thumbnail(bytes.get_ref()).unwrap();
        assert_eq!((width, height), (1200, 600));
        assert_eq!((thumbnail.width(), thumbnail.height()), (900, 450));
    }

    #[test]
    fn media_paths_reject_traversal_and_windows_absolute_paths() {
        for path in [
            "media/../photo.jpg",
            "media/..",
            "media/C:photo.jpg",
            "media/a\\b.jpg",
            "other/file.jpg",
        ] {
            assert!(managed_media_path(path).is_err(), "{path}");
        }
        assert!(managed_media_path("media/photo.jpg").is_ok());
    }

    #[test]
    fn backup_excludes_unreferenced_files_and_runtime_photo_paths() {
        let temp = tempfile::tempdir().unwrap();
        let paths = AppPaths {
            root: temp.path().to_owned(),
            media: temp.path().join("media"),
            thumbnails: temp.path().join("thumbnails"),
            database: temp.path().join("test.db"),
        };
        fs::create_dir(&paths.media).unwrap();
        fs::create_dir(&paths.thumbnails).unwrap();
        fs::write(paths.media.join("kept.jpg"), b"kept").unwrap();
        fs::write(paths.media.join("removed.jpg"), b"removed").unwrap();
        let mut snapshot = sample_snapshot();
        snapshot["photos"] = json!([{ "id": "photo-1", "spotId": "spot-1", "relativePath": "media/kept.jpg", "fileUrl": paths.media.join("kept.jpg").to_string_lossy() }]);
        let bytes = zip_backup(&snapshot, &paths).unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        assert!(archive.by_name("media/kept.jpg").is_ok());
        assert!(archive.by_name("media/removed.jpg").is_err());
        let mut data = String::new();
        archive
            .by_name("data.json")
            .unwrap()
            .read_to_string(&mut data)
            .unwrap();
        let exported: Value = serde_json::from_str(&data).unwrap();
        assert!(exported["photos"][0].get("fileUrl").is_none());
    }
    #[test]
    fn database_roundtrip() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let snapshot = default_snapshot();
        save_to_db(&mut conn, &snapshot).unwrap();
        assert_eq!(load_from_db(&conn).unwrap()["schemaVersion"], 1);
    }

    #[test]
    fn password_encryption_roundtrip() {
        let plaintext = b"junrei-backup-v1";
        let encrypted = encrypt_age(plaintext, "correct horse battery staple").unwrap();
        assert_ne!(encrypted, plaintext);
        assert_eq!(
            decrypt_age(&encrypted, "correct horse battery staple").unwrap(),
            plaintext
        );
        assert!(decrypt_age(&encrypted, "wrong password").is_err());
    }
}
