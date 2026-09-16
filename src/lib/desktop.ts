import { convertFileSrc } from "@tauri-apps/api/core";
import type { AnitabiPreview, AppSnapshot, Photo } from "../types";
import { emptySnapshot, newId, nowIso } from "../types";

const STORAGE_KEY = "junrei-journal-dev-v1";
const isTauri = () => "__TAURI_INTERNALS__" in window;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(command, args);
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  if (isTauri()) return invoke<AppSnapshot>("load_snapshot");
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptySnapshot();
  try { return { ...emptySnapshot(), ...JSON.parse(raw) as AppSnapshot }; }
  catch { return emptySnapshot(); }
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<void> {
  if (isTauri()) return invoke<void>("save_snapshot", { snapshot });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export async function fetchAnitabi(subjectId: number): Promise<AnitabiPreview> {
  if (isTauri()) return invoke<AnitabiPreview>("fetch_anitabi", { subjectId });
  const [liteResponse, pointsResponse] = await Promise.all([
    fetch(`https://api.anitabi.cn/bangumi/${subjectId}/lite`),
    fetch(`https://api.anitabi.cn/bangumi/${subjectId}/points/detail?haveImage=true`),
  ]);
  if (!liteResponse.ok || !pointsResponse.ok) throw new Error(`Anitabi 请求失败（${liteResponse.status || pointsResponse.status}）`);
  const lite = await liteResponse.json() as Omit<AnitabiPreview, "points">;
  const points = await pointsResponse.json() as AnitabiPreview["points"];
  return { ...lite, points };
}

export async function chooseAndImportPhoto(spotId: string, visitId?: string): Promise<Photo | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false, filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp"] }] });
    if (!path) return null;
    return invoke<Photo>("import_photo", { sourcePath: path, spotId, visitId: visitId ?? null });
  }
  return new Promise((resolve) => {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return resolve(null);
      const reader = new FileReader(); reader.onload = () => resolve({ id: newId(), spotId, visitId, relativePath: file.name, fileUrl: String(reader.result), photoType: "visit", sortOrder: 0, isCover: false, createdAt: nowIso() }); reader.readAsDataURL(file);
    };
    input.click();
  });
}

export async function getGoogleApiKey(): Promise<string> {
  if (isTauri()) return invoke<string>("get_google_api_key");
  return sessionStorage.getItem("junrei-google-key") ?? "";
}

export async function setGoogleApiKey(value: string): Promise<void> {
  if (isTauri()) return invoke<void>("set_google_api_key", { value });
  if (value) sessionStorage.setItem("junrei-google-key", value); else sessionStorage.removeItem("junrei-google-key");
}

export async function exportBackup(password?: string): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: `junrei-${new Date().toISOString().slice(0, 10)}.junrei-backup`, filters: [{ name: "巡礼手账备份", extensions: ["junrei-backup"] }] });
    if (!path) return null;
    await invoke("export_backup", { targetPath: path, password: password || null });
    return path;
  }
  const snapshot = await loadSnapshot(); const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `junrei-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); return anchor.download;
}

export async function restoreBackup(password?: string): Promise<AppSnapshot | null> {
  if (!isTauri()) throw new Error("浏览器预览模式只用于界面测试，请在桌面应用中恢复备份。");
  const { open } = await import("@tauri-apps/plugin-dialog");
  const path = await open({ multiple: false, filters: [{ name: "巡礼手账备份", extensions: ["junrei-backup"] }] });
  if (!path) return null;
  await invoke("restore_backup", { sourcePath: path, password: password || null });
  return loadSnapshot();
}

export async function openExternal(url: string): Promise<void> {
  if (isTauri()) { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(url); return; }
  window.open(url, "_blank", "noopener,noreferrer");
}

export const mediaUrl = (photo: Photo): string => {
  if (photo.fileUrl?.startsWith("http") || photo.fileUrl?.startsWith("data:") || photo.fileUrl?.startsWith("blob:")) return photo.fileUrl;
  if (photo.fileUrl && isTauri()) return convertFileSrc(photo.fileUrl);
  if (!isTauri()) return photo.relativePath;
  return `asset://localhost/${photo.thumbnailPath || photo.relativePath}`;
};
