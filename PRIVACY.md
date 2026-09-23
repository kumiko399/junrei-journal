# 隐私说明

最后更新：2026 年 9 月 23 日

巡礼手账采用本地优先设计，不提供账号系统，不包含广告、行为分析或遥测代码。

## 本地保存的数据

- 作品、地点、笔记、到访记录和导入照片保存在本机应用数据目录或便携版的 `data/` 目录。
- 应用不会主动把用户数据库、照片或备份上传给项目维护者。
- Google Maps API Key 保存在 Windows 凭据管理器，不进入 SQLite 数据库、备份、应用日志或 Git 仓库。
- 用户主动创建的备份由用户选择保存位置。密码备份使用 age 加密；忘记密码时无法恢复。

## 会发生的网络请求

仅在使用对应功能时，应用会直接联系以下第三方：

- 开放地图：向用户配置的地图瓦片提供商请求当前视野内的瓦片。默认提供商是 OpenStreetMap。
- Google Maps：用户启用 Google 模式后，WebView 会加载 Google Maps JavaScript API、地图资源和相关服务。
- Anitabi：用户输入 Bangumi Subject ID 并读取作品时，应用向 `api.anitabi.cn` 请求公开地点数据；封面和参考截图以远程 URL 方式从 Anitabi 图片服务加载。
- GitHub：只有用户主动打开项目主页、Issue 或 Release 链接时才会访问。

这些服务通常会收到提供网络内容所必需的信息，例如 IP 地址、请求时间、设备或 WebView 的 User-Agent、所请求的瓦片区域或资源地址。具体处理方式由第三方决定：

- [OpenStreetMap 隐私政策](https://osmfoundation.org/wiki/Privacy_Policy)
- [Google 隐私政策](https://policies.google.com/privacy)
- [Google Maps Platform 服务条款](https://cloud.google.com/maps-platform/terms)
- [Anitabi API 文档](https://github.com/anitabi/anitabi.cn-document/blob/main/api.md)

应用界面不再从 Google Fonts 下载字体，默认使用 Windows 系统字体。启用 Google Maps 时，Google 地图组件自身仍可能加载其正常运行所需的样式、字体和地图资源。

## 用户选择与删除

- 不配置 Google API Key即可只使用开放地图。
- 不执行 Anitabi 导入即可避免相关 API 和图片请求。
- 用户可以在系统凭据管理器中删除 Google API Key，并可以删除应用数据目录来清除本地数据。
- 卸载应用前请先确认是否需要保留数据或导出备份。

## 联系与更新

隐私或权利问题可通过 [GitHub Issues](https://github.com/kumiko399/junrei-journal/issues) 联系维护者。请勿在公开 Issue 中提交 API Key、个人照片、真实行程、数据库、备份或其他敏感信息。

如果未来加入云同步、账号、遥测或在线服务，必须在启用前更新本说明并为用户提供明确选择。另请阅读[使用条款](TERMS.md)和[第三方数据与许可说明](THIRD_PARTY_NOTICES.md)。
