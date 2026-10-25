# 三阶段背景音乐

2026-10-25，v0.8.1 场景音乐修订。按用户指定曲目接入桌面上的三份 Sea Power MP3，不改动原文件，不重新编码。新增运行文件共 34,043,869 字节，约 32.47 MiB。

## 曲目与使用时机

| 阶段 | 曲目（艺术家均为 Sea Power） | 文件 | 时长 |
| --- | --- | --- | --- |
| 开始界面 | Melancholy Of The Boot | `public/audio/music/menu.mp3` | 4:22 |
| 游戏中、排练场 | Cleaning out the Rooms (Wandering Horn) | `public/audio/music/gameplay.mp3` | 6:27 |
| 胜利或失败结束页 | Strange Sports | `public/audio/music/ending.mp3` | 3:15 |

每个阶段单曲循环。五个城区沿用同一首游戏音乐，跨区域、读取纪事或完成机关不会重新起播。歌曲、原文件名、精确时长、大小和 SHA-256 见 [资源清单](../prototypes/runlab/public/audio/music/manifest.json)。这些是用户提供的第三方录音，来源与项目程序化动作音效分别记录。

## 玩家操作与节奏

- 初次加载先静默，点击顶部「播放音乐」可只播放标题曲；点击其他控件或按键也会尝试启用声音。浏览器需要一次真实用户交互才能播放。
- 「声音设置」分别调整背景音乐和音效；沿用 `belfry-audio-v2`，兼容已有偏好。默认音乐 35%、音效 80%，总输出保留现有压缩器与增益。
- 游戏暂停、铭文暂停、窗口隐藏和全局静音都会暂停歌曲并保留播放位置。继续时接着播放；返回后台前正在游戏中的，回来后仍需继续游戏。
- 铭文挑战期间歌曲继续，音乐增益渐降到正常值的 28%；答题结束后恢复。失败取消技能的规则不受音乐影响。
- 阶段改变先用约 180 毫秒淡出旧曲，再从新曲开头淡入。同一阶段内重试或切换城区不重播；从结束页重新开局则重新开始游戏曲。
- 音频缺失或损坏会显示「重试音乐」，游戏和其他音效仍可继续。恢复文件后可重试。

角色语音与对白仍关闭，之前删除的环境钟鸣、鼓点和技能低鼓层没有恢复。旧循环环境气流不再叠加到歌曲上；铭文聚焦和输入摩擦反馈仍属于音效总线。

## 实现与维护

`public/belfry-music.js` 维护单个隐藏的 HTMLAudioElement，设置 `loop=true`，通过 MediaElementAudioSourceNode 接到原 AudioContext 的音乐总线。长曲不进入 82 个短音效的解码缓存，不阻塞游戏资源初始化。只加载当前所需曲目，不预解码三首长曲。

phase 0 对应标题，phase 1/5 对应游戏，phase 2/3 对应结束，phase 4 保持选曲并暂停。切曲定时器与播放 Promise 使用序号防止快速切换时旧结果覆盖新阶段；同时最多只有一个媒体播放器。`soundDiagnostics.music` 提供实际曲目、播放位置、时长、循环、暂停、衰减和失败状态。

本地静态服务增加 `audio/mpeg`、HEAD、Content-Length 和字节 Range 响应，支持浏览器定位及循环读取。若另行部署静态站点，也应正确提供 MP3 类型和范围请求。网页宿主音乐不包含在单独 `.xbp` 工程包内；需同时交付网页与 `public/audio/music/`。

更换曲目时同步更新播放器映射、资源清单、此文档并重跑专项测试。不要运行程序化音效生成器来重建这些第三方录音。

## 验证

```sh
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-music.mjs
```

已加入统一 `scripts/test-game.mjs`。专项使用实际 MP3 和 Web Audio 检查三曲播放、文件末尾循环、暂停续播、音量、静音、铭文衰减、前后台、快速切换、排练与资源恢复；胜负由仅作用于测试响应的夹具触发，不冒充整关通关测试。具体结果见 [测试记录](TESTING.md) 与 [本次证据](evidence/scene-music/verification.json)。
