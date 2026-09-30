# 巡礼手账（Junrei Journal）

[![Windows checks and release](https://github.com/kumiko399/junrei-journal/actions/workflows/desktop-release.yml/badge.svg)](https://github.com/kumiko399/junrei-journal/actions/workflows/desktop-release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一款本地优先的 Windows 圣地巡礼收藏与记录应用。你可以整理动漫作品与现实地点，在地图上筛选巡礼目标，并记录每次到访的照片、笔记和评分。

作品、地点、到访记录和照片默认只保存在你的电脑中。应用不要求注册账号，也不依赖自建服务器。

> 当前版本处于早期开发阶段。请在升级或批量导入前创建备份。

当前源码版本：**0.1.1**。可下载的版本以 [GitHub Releases](https://github.com/kumiko399/junrei-journal/releases) 页面为准；详细更新内容见[版本说明](RELEASE_NOTES.md)。

## 主要功能

- 管理作品收藏、巡礼状态和完成进度
- 管理地点坐标、标签、动画集数、画面时间点与参考来源
- 使用 MapLibre 和 OpenStreetMap 浏览、聚合及筛选地点
- 可选接入用户自己的 Google Maps JavaScript API Key
- 记录多次到访、日期、天气、同行者、评分和游记
- 将照片复制到应用数据目录，生成缩略图并用 SHA-256 检测重复项
- 按 Bangumi Subject ID 从 Anitabi 预览、选择导入和手动刷新数据
- 使用 SQLite 在本地持久化数据
- 导出普通 ZIP 备份或使用 age 加密的密码备份
- 支持安装版和便携模式
- 浅色、深色和跟随系统主题，支持紧凑导航、小窗口布局及弹窗键盘操作

## 0.1.1 更新内容

- 改善主题一致性、小窗口布局、地图筛选说明和空白页引导。
- 地点详情可直接创建该地点的到访记录，到访日期默认使用本地日期。
- 修复数据读取失败后误写回、保存提示卡住、重复照片导入和地图异步初始化问题。
- 修复透明图片的 JPEG 缩略图生成，并按 EXIF 方向处理缩略图。
- 备份前等待最新保存；恢复前验证数据和照片，失败时回滚已复制的文件。
- 修复迁移或恢复后的本地照片路径，备份仅包含仍被记录引用的媒体。

## 第一次使用

1. 在“作品库”添加喜欢的动漫作品，或者在“数据导入”填写 Bangumi 作品 ID，预览并选择 Anitabi 地点后导入。
2. 在“巡礼地图”筛选作品和城市，通过“添加地点”填写坐标，或通过“地图选点”直接选择位置。
3. 打开地点详情，点击“记录到访”，填写日期、笔记、天气、同行者和评分。
4. 在“照片墙”选择所属地点并导入 JPG、PNG 或 WebP 照片。
5. 在“设置”选择主题，并定期导出完整备份。

弹窗支持 `Escape` 关闭和 `Tab` 切换输入项。界面会显示保存状态；保存失败时请先重试保存，再关闭程序。

## 隐私与数据

- 核心数据完全保存在本地，不包含账号、云同步、社交分享或在线评论。
- 安装版数据保存在 Windows 用户应用数据目录下的 `app.junrei.journal`。
- 便携版在程序旁检测到 `portable.flag` 后，将数据保存在同目录的 `data` 文件夹。
- Google API Key 保存在 Windows 凭据管理器中，不写入 SQLite、日志或备份。
- 地图瓦片和 Anitabi 导入需要网络；收藏、笔记、照片和本地查询可以离线使用。
- 应用界面使用 Windows 系统字体，不会为了界面字体单独连接 Google Fonts。

更多说明见 [隐私说明](PRIVACY.md) 与 [第三方许可说明](THIRD_PARTY_NOTICES.md)。

## 下载与运行

从[原项目 GitHub Releases](https://github.com/kumiko399/junrei-journal/releases) 选择版本并下载，支持 Windows 10 22H2 / Windows 11 x64：

- `Junrei-Journal-v<版本>-setup.exe`：推荐的每用户 NSIS 安装包。
- `Junrei-Journal-v<版本>-portable.zip`：便携版，必须完整解压后运行 `junrei-journal.exe`。
- `checksums.txt`：发布文件的 SHA-256 校验值。

首版安装包未购买代码签名证书，Windows SmartScreen 可能显示“未知发布者”。请仅从本项目的 GitHub Releases 页面下载，并核对校验值。

在下载目录打开 PowerShell，用以下命令获取下载文件的 SHA-256，与同一 Release 的 `checksums.txt` 比较：

```powershell
Get-FileHash .\Junrei-Journal-v0.1.1-setup.exe -Algorithm SHA256
Get-FileHash .\Junrei-Journal-v0.1.1-portable.zip -Algorithm SHA256
```

### 从 0.1.0 升级

- 先在旧版本中导出完整备份，再退出旧程序；应用没有自动更新。
- 安装版安装新版后继续使用原应用数据目录。
- 便携版解压到新目录；退出程序后，将原便携版的整个 `data/` 文件夹复制到新版程序旁，再启动新版。请保留原目录和备份，确认新版能读取数据后再自行整理。
- 数据结构仍为版本 1，备份格式仍为 `junrei-backup-v1`。备份不包含 Google API Key。

## 本地开发

### 环境要求

- Windows 10 22H2 或 Windows 11（x64）
- Node.js 22+
- Rust stable-msvc
- Microsoft C++ Build Tools，勾选“Desktop development with C++”
- Windows 10 / 11 SDK，包含资源编译器 `RC.EXE`
- Microsoft Edge WebView2 Runtime

安装 Tauri 的完整前置条件请参考 [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/)。

### 启动开发环境

```powershell
npm install
npm test
npm run check:version
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:dev
```

只预览前端界面时可运行：

```powershell
npm run dev
```

浏览器预览使用 `localStorage`，照片使用临时 Data URL；正式桌面程序使用 SQLite 和应用数据目录。

### 构建 Windows 安装包

```powershell
npm run tauri:build
```

NSIS 安装包生成在 `src-tauri/target/release/bundle/nsis/`。GitHub Actions 也会在版本标签发布时自动运行测试、构建安装包和便携版，并生成校验值。

如果 Rust 构建提示找不到 `link.exe` 或 `RC.EXE`，请通过 Visual Studio Installer 确认已安装 C++ 桌面开发工具和 Windows SDK，并从对应的 x64 开发者命令行运行构建。前端构建成功不能代替桌面版测试或安装包验证。

### Git 与发布流程

- 在功能分支中整理改动，运行前端测试、构建、Rust 测试和版本一致性检查后提交。
- `package.json`、npm 锁文件、Cargo 清单及锁文件、Tauri 配置和 `RELEASE_NOTES.md` 的版本必须一致；版本标签使用 `v<版本>`。
- `main` 和 Pull Request 触发检查；推送版本标签后，只有检查通过才会构建安装包、便携版 ZIP 和 SHA-256 校验文件。
- 工作流创建 **GitHub Release 草稿**。核对附件、校验值、条款和版本说明后，再由维护者公开发布；提交源码不会自动公开新安装包。
- 发布包随附 `TERMS.md`、`PRIVACY.md`、`THIRD_PARTY_NOTICES.md` 和 `THIRD_PARTY_LICENSES.txt`，便携版也包含 README。
- 不要提交个人数据、照片、备份、凭据、安装包、解压试用目录或父目录旧网站文件。项目工作规则见 [AGENTS.md](AGENTS.md)。

## 地图与数据来源

- 默认地图由 [MapLibre GL JS](https://maplibre.org/) 渲染，并使用 [OpenStreetMap](https://www.openstreetmap.org/) 地图数据。应用始终保留署名，不提供公共瓦片批量下载或离线预取；改用其他瓦片时必须同时填写对应署名和许可链接。
- Anitabi 数据依据其[公开 API 文档](https://github.com/anitabi/anitabi.cn-document/blob/main/api.md)接入，并保留来源、原始链接与 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 署名。动画截图、封面和作品素材的版权仍归原权利人所有。
- Google Maps 是可选功能，需要用户自行配置 API Key、结算账号、API 限制与使用限额，并遵守 [Google Maps Platform 服务条款](https://cloud.google.com/maps-platform/terms)和 [Google Maps JavaScript API 政策](https://developers.google.com/maps/documentation/javascript/policies)。

本仓库不包含 Google API Key、Anitabi 数据集、用户照片、个人备份或旧网站数据库。

本项目与 Google、OpenStreetMap Foundation、Anitabi、Bangumi 及任何动画作品制作方、发行方或权利人不存在隶属、授权、认可或赞助关系。第三方名称、标志、地图、数据、截图和作品素材归各自权利人所有。

使用前请阅读：

- [使用条款](TERMS.md)
- [隐私说明](PRIVACY.md)
- [第三方数据与许可说明](THIRD_PARTY_NOTICES.md)
- `THIRD_PARTY_LICENSES.txt`（通过 `npm run licenses` 从当前锁定依赖生成）

如果你是相关权利人并希望更正来源或移除展示，请通过 [GitHub Issues](https://github.com/kumiko399/junrei-journal/issues) 联系维护者；请勿在公开 Issue 中提交身份证件、API Key 或其他敏感信息。

## 参与贡献

欢迎提交 Issue 或 Pull Request。提交代码前请确保：

```powershell
npm test
npm run check:version
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run licenses
```

请不要在 Issue、日志、测试数据或提交记录中上传 API Key、个人照片、真实行程或备份文件。

## 许可证

应用源代码以 [MIT License](LICENSE) 发布。

地图数据、地图瓦片、Anitabi 数据、参考截图及其他第三方内容仍受各自许可条款约束，不因本项目采用 MIT License 而被重新授权。详见[使用条款](TERMS.md)、[第三方数据与许可说明](THIRD_PARTY_NOTICES.md)和随发布包提供的 `THIRD_PARTY_LICENSES.txt`。
