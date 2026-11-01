# v0.15.2 场景音乐互换验收

2026-10-27，仅本地，未推送远程。

| 阶段 | 当前曲目（Sea Power） |
| --- | --- |
| 开始菜单 | Cleaning out the Rooms (Wandering Horn) |
| 游戏 / 排练 | Melancholy Of The Boot |
| 胜利 / 失败 | Strange Sports |

网页 16 项、实际 `.xbp` 原生音频 13 项，共 **29 项通过**。覆盖真实曲目播放、时长和循环、暂停 / 恢复、阶段切换、音量 / 静音、单词挑战正常音乐增益、文件缺失恢复，以及开场音效与配乐混合输出。见 [网页报告](web-music.json)、[原生报告](native-music.json)。原生采用锁定运行库及实际声音分析；阶段 / 音量按键、1 秒短曲循环夹具仅供测试，未上传在线账号工程。

ZIP CRC 及逐文件核对通过：BGM_Menu 的完整字节等于上一版 BGM_Gameplay，BGM_Gameplay 等于上一版 BGM_Menu。除这两个 MP3 和音乐清单外，包内所有文件与 v0.15.1 相同；结束音乐、背景 40% / 动作 85% 的默认设置、战斗、风动和 UI 均保持原样。音频未裁剪或重编码。

交付包哈希、原曲哈希及检查计数见 [verification.json](verification.json)。桌面新包 `EasyRun-XBuilder-v0.15.2-music-swap.xbp`，旧包保留。网页刷新后生效，XBuilder 需导入新包。
