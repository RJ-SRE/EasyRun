# v0.16.2 场景配乐更新

2026-10-27，本地交付，未推送远程。

| 阶段 | Sea Power 曲目 | 文件 |
| --- | --- | --- |
| 菜单 | Melancholy Of The Boot | `menu.mp3` |
| 游戏、排练场 | Cleaning out the Rooms (Wandering Horn) | `gameplay.mp3` |
| 胜利、失败 | Strange Sports | `ending.mp3` |

三首均为用户提供的完整 MP3，源文件大小、SHA-256 与 ID3 标题已核对。此次没有裁剪或转码。默认背景音乐 75%、动作音效 85%，保存的个人音量继续保留。

## 验证结果

- `web-music.json`：17 项通过，无运行错误。实际媒体曲名、路径、时长、曲末循环、暂停续播、答题音量、静音、后台、快速切曲、排练与缺失资源恢复均验证。
- `native-music.json`：15 项通过，无运行错误。实际 `.xbp` 经部署项目模型导入导出，使用部署编译器及资源启动；分析器检查独立原生音频输出、五区深度迁移和攻击后不断音、音量、暂停、结算与静音。循环使用独立一秒测试片段加速验证，交付文件仍为完整录音。
- `artifact.json`：ZIP CRC 通过，三首打包音频匹配原始哈希。与 v0.16.1 比较，仅 BGM_Menu、BGM_Gameplay 两份音频和 native-music-manifest.json 改变；其余包内文件字节一致。
- 修改的播放器及音乐测试通过 ESLint，`git diff --check` 通过。

网页测试中，大资源经 `route.fulfill` 传递时自动化连接退出；改为本地 HTTP 提供同一测试资源后通过。测试仍仅在临时资源中添加胜负阶段按键，未修改实际游戏代码、线上工程或测试场景的内容。

## 交付

桌面：`EasyRun-XBuilder-v0.16.2-scene-music.xbp`。

包大小：132,049,852 字节；SHA-256：`c52963e5a13e64f565fc7b17a0aec640ec5320692b544aea5dd6a7f09d1bc81d`。

网页版：`http://127.0.0.1:4177/?v=scene-music-v162`。需刷新现有页面以载入新映射；浏览器要求交互时点击菜单解锁播放。
