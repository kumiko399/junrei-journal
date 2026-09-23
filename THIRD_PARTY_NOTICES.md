# 第三方数据与许可说明

本文件说明巡礼手账使用的主要第三方数据、服务和开源组件。项目的 MIT License 只适用于本项目原创源代码，不会重新授权第三方内容。

## OpenStreetMap 与 MapLibre

默认开放地图由 MapLibre GL JS 渲染。地图数据 © OpenStreetMap contributors，并依据 Open Data Commons Open Database License 使用。默认公共瓦片仅用于正常的交互式显示，不用于批量下载、后台预取或制作离线地图包。

- [OpenStreetMap 著作权与许可](https://www.openstreetmap.org/copyright)
- [OpenStreetMap 公共瓦片使用政策](https://operations.osmfoundation.org/policies/tiles/)
- [MapLibre GL JS（BSD-3-Clause）](https://github.com/maplibre/maplibre-gl-js)

用户配置其他瓦片服务时，必须确认自己有权使用，并在设置中填写该服务要求的署名和许可链接。应用会持续显示这些信息，但维护者无法替用户确认第三方瓦片授权。

## Anitabi

应用通过 Anitabi 公开 API 读取用户指定作品的地点资料。应用只保存业务所需字段和预览图片 URL，不批量抓取或重新托管完整图片，并在界面显示 Anitabi、`origin`、`originURL` 和许可信息。

- [Anitabi API 文档](https://github.com/anitabi/anitabi.cn-document/blob/main/api.md)
- [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

CC BY-NC-SA 4.0 适用于 Anitabi 按该许可分享的内容。动画画面、封面、作品名称、人物形象和商标可能仍受动画制作方、发行方或其他原权利人权利约束。本项目不声称拥有这些内容，也不将其纳入 MIT License。使用者不得移除来源信息，亦不得把导入内容用于违反许可的商业用途。

## Google Maps Platform

Google Maps 是用户自行配置的可选地图模式。本项目不提供共享 API Key，也不缓存、导出或重新托管 Google 地图内容。用户须自行创建 Google Cloud 项目、启用所需结算、限制 API 与配额，并遵守：

- [Google Maps Platform 服务条款](https://cloud.google.com/maps-platform/terms)
- [Google Maps JavaScript API 政策](https://developers.google.com/maps/documentation/javascript/policies)
- [Google API 安全最佳实践](https://developers.google.com/maps/api-security-best-practices)
- [Google 隐私政策](https://policies.google.com/privacy)

应用不得隐藏、修改或遮挡 Google 地图自带的 Logo、版权和署名。

## 开源依赖

程序直接使用 Tauri、React、MapLibre GL JS、Lucide、rusqlite、age、reqwest、image 等开源软件，并间接使用其依赖。它们分别适用 MIT、Apache-2.0、BSD-3-Clause、ISC、MPL-2.0 或其他兼容许可证。

当前锁定的依赖版本以 `package-lock.json` 和 `src-tauri/Cargo.lock` 为准。随发布包提供的 `THIRD_PARTY_LICENSES.txt` 收录构建时依赖的许可证元数据和可取得的许可证/NOTICE 文本；更新依赖后必须重新生成该文件。

## 非隶属声明

本项目与 Google、OpenStreetMap Foundation、Anitabi、Bangumi 及任何动画作品权利人不存在隶属、授权、认可或赞助关系。权利问题和移除请求请参阅[使用条款](TERMS.md)。
