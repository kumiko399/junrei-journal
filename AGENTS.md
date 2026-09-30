# 巡礼手账：桌面应用工作记忆

## 范围和仓库

- 本仓库是 Windows 10 22H2 / Windows 11 x64 的 Tauri 2 桌面应用；React 19、TypeScript、Vite 前端和 Rust / SQLite 后端。
- 默认分支 `main`，公开远端 `https://github.com/kumiko399/junrei-journal`。父目录旧网站是另一 Git 边界，不属于本仓库。
- 本地优先，无账号、自建服务器、云同步、社交或多人协作。当前源码版本 `0.1.1`。
- 开始修改前阅读本文件、README.md、PRIVACY.md、THIRD_PARTY_NOTICES.md，并检查本仓库和父目录的 Git 状态；保留用户已有修改及试用包。

## 架构与数据规则

- `src/views/` 为业务页面；`src/components/` 为共享界面；`src/lib/desktop.ts` 为 Tauri / 浏览器预览能力边界；地图通过 `src/lib/map-adapter.ts` 接入。
- `src-tauri/src/lib.rs` 管理 SQLite、照片、凭据、导入与备份。数据库启用外键、WAL 和事务；结构变化必须迁移，不能破坏已有数据。
- 安装版使用应用数据目录；exe 旁存在 `portable.flag` 时使用旁边的 `data/`。
- 读取失败必须阻止自动保存；快照写入通过 `save-queue.ts` 串行执行。备份和恢复前等待最新保存；桌面关闭前保存成功再销毁窗口，保存失败保留窗口。
- 照片复制到管理目录、按 SHA-256 去重，缩略图处理 EXIF 方向及透明图片。重复导入不得产生重复主键或哈希记录。
- 本地照片的运行时绝对路径在读取时重新计算，不能依赖备份中旧电脑的路径。
- `.junrei-backup` / `junrei-backup-v1` 使用 ZIP，密码备份使用 age。备份仅打包仍被照片记录引用的媒体，不删除原有媒体文件。
- 恢复先在临时目录检查版本、记录数、关联、路径、照片哈希和 SQLite 完整性，再复制文件与提交事务；提交失败要回滚文件覆盖及新增文件。
- Google API Key 只保存在 Windows 凭据管理器，不写入 SQLite、日志、备份或源码。Google 加载失败回退开放地图并保留视野。

## 界面与第三方内容

- 简体中文界面，使用 Windows 系统字体；浅色、深色和跟随系统主题必须一致覆盖表单和内容面板。
- 地图适配器的异步初始化必须处理页面卸载；组件回调读取最新状态，切换提供商后重新同步地点、选点模式和选中地点。
- 弹窗支持 Escape、Tab 焦点约束和关闭后焦点恢复。最低桌面窗口 900 × 640，不允许工具栏横向溢出或挡住地图署名。
- Anitabi 只调用公开 API，保存作品 / 地点 ID 与来源 URL，导入前预览，不覆盖个人笔记。参考图片仅保存远程 URL。
- 地图提供商署名和许可链接、Anitabi 来源和 CC BY-NC-SA 4.0 链接及图片权利提示必须保留；不批量下载 OSM 瓦片或第三方截图。
- MIT 仅覆盖源代码，不重新授权地图、Anitabi 数据、截图或其他第三方内容。

## 开发与验证

在本仓库根目录运行：

```powershell
npm install
npm test
npm run check:version
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run tauri:dev
```

- `npm run dev` 仅预览前端，使用 localStorage，不代替 Tauri / SQLite 验证。使用虚构测试数据，完成后清理自己的测试记录。
- Rust 构建需要 MSVC C++ 工具链和 Windows SDK（包括资源编译器 `RC.EXE`）；不能把环境阻断报告为测试通过。
- 修改数据、备份、凭据或迁移时增加相应回归测试。依赖变化运行 `npm run licenses` 并更新 THIRD_PARTY_LICENSES.txt。
- 二进制构建使用 `npm run tauri:build`；它自动生成第三方许可证。

## 发布与保留边界

- 不自行创建版本标签或 GitHub Release。经明确授权发布时使用 ASCII 附件文件名，并随包提供 TERMS.md、PRIVACY.md、THIRD_PARTY_NOTICES.md、THIRD_PARTY_LICENSES.txt。
- 不提交 `.env*`、密钥、凭据、个人照片、真实行程、数据库、备份、`data/`、`node_modules/`、`dist/`、`src-tauri/target/`、本机绝对路径、日志、安装包和解压试用目录。
- 公开前检查待提交内容和历史的隐私信息；保留条款及权利人联系入口，首版无自动更新和代码签名。
- 版本变更同时更新 npm 清单及锁文件、Cargo 清单及锁文件、Tauri 配置和 RELEASE_NOTES.md；`check:version` 检查一致性及 CI 标签。
- 标签工作流在测试通过后构建二进制，并创建 GitHub Release 草稿；维护者核对附件、SHA-256 和说明后再公开。用户要求等待确认时，先准备本地分支和提交，不推送分支、main 或标签，不创建远程 Release。
