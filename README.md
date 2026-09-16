# 巡礼手账（Junrei Journal）

[![Windows checks and release](https://github.com/kumiko399/junrei-journal/actions/workflows/desktop-release.yml/badge.svg)](https://github.com/kumiko399/junrei-journal/actions/workflows/desktop-release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一款本地优先的 Windows 圣地巡礼收藏与记录应用。你可以整理动漫作品与现实地点，在地图上筛选巡礼目标，并记录每次到访的照片、笔记和评分。

作品、地点、到访记录和照片默认只保存在你的电脑中。应用不要求注册账号，也不依赖自建服务器。

> 当前版本处于早期开发阶段。请在升级或批量导入前创建备份。

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

## 隐私与数据

- 核心数据完全保存在本地，不包含账号、云同步、社交分享或在线评论。
- 安装版数据保存在 Windows 用户应用数据目录下的 `app.junrei.journal`。
- 便携版在程序旁检测到 `portable.flag` 后，将数据保存在同目录的 `data` 文件夹。
- Google API Key 保存在 Windows 凭据管理器中，不写入 SQLite、日志或备份。
- 地图瓦片和 Anitabi 导入需要网络；收藏、笔记、照片和本地查询可以离线使用。

更多说明见 [隐私说明](PRIVACY.md) 与 [第三方许可说明](THIRD_PARTY_NOTICES.md)。

## 下载与运行

正式版本将通过 GitHub Releases 提供：

- `setup.exe`：推荐的每用户 NSIS 安装包。
- `portable.zip`：解压后运行的便携版。
- `checksums.txt`：发布文件的 SHA-256 校验值。

首版安装包未购买代码签名证书，Windows SmartScreen 可能显示“未知发布者”。请仅从本项目的 GitHub Releases 页面下载，并核对校验值。

## 本地开发

### 环境要求

- Windows 10 22H2 或 Windows 11（x64）
- Node.js 22+
- Rust stable-msvc
- Microsoft C++ Build Tools，勾选“Desktop development with C++”
- Microsoft Edge WebView2 Runtime

安装 Tauri 的完整前置条件请参考 [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/)。

### 启动开发环境

```powershell
npm install
npm test
npm run build
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

## 地图与数据来源

- 默认地图由 [MapLibre GL JS](https://maplibre.org/) 渲染，并使用 [OpenStreetMap](https://www.openstreetmap.org/) 地图数据。应用始终保留署名，不提供公共瓦片批量下载或离线预取。
- Anitabi 数据依据其[公开 API 文档](https://github.com/anitabi/anitabi.cn-document/blob/main/api.md)接入，并保留来源、原始链接与 CC BY-NC-SA 4.0 署名。
- Google Maps 是可选功能，需要用户自行配置 API Key、结算账号、API 限制与使用限额。

本仓库不包含 Google API Key、Anitabi 数据集、用户照片、个人备份或旧网站数据库。

## 参与贡献

欢迎提交 Issue 或 Pull Request。提交代码前请确保：

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

请不要在 Issue、日志、测试数据或提交记录中上传 API Key、个人照片、真实行程或备份文件。

## 许可证

应用源代码以 [MIT License](LICENSE) 发布。

地图数据、地图瓦片、Anitabi 数据、参考截图及其他第三方内容仍受各自许可条款约束，不因本项目采用 MIT License 而被重新授权。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
