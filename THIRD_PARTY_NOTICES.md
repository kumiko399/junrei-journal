# 第三方数据与许可说明

## OpenStreetMap

地图数据 © OpenStreetMap contributors，依据 Open Data Commons Open Database License 使用。应用必须持续显示地图署名，并遵守公共瓦片服务使用政策。

- https://www.openstreetmap.org/copyright
- https://operations.osmfoundation.org/policies/tiles/

## Anitabi

Anitabi 公开 API 返回的地点与截图来源信息依据 CC BY-NC-SA 4.0 分享。本应用只保存所需字段和预览图片 URL，不批量抓取或重新托管完整图片，并在界面展示 `origin` 与 `originURL`。

- https://github.com/anitabi/anitabi.cn-document/blob/main/api.md

## Google Maps Platform

Google Maps 是用户自行配置的可选地图模式。用户必须自行创建 Google Cloud 项目、启用结算、配置配额并遵守 Google Maps Platform 服务条款。本项目不提供共享 API Key。

- https://developers.google.com/maps/terms
- https://developers.google.com/maps/documentation/javascript/get-api-key

## 开源依赖

程序使用 Tauri、React、MapLibre GL JS、rusqlite、age 等开源软件。完整版本与许可证以 `package-lock.json`、`Cargo.lock` 和构建时依赖清单为准。
