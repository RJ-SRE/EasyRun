# v0.15.1 混音验收

2026-10-27，仅本地交付，不推送远程。

默认背景音乐由 65% 调至 **40%**，动作音效由 30% 调至 **85%**；取消原生 NativeSfx 内部的 0.55 倍衰减。独立音量滑条、静音和暂停保留，答题时不降低音乐。网页只迁移恰好匹配旧默认的保存组合，自定义音量及静音不变。

已有素材的 `ffmpeg volumedetect` 观察：blade-1 平均 -22.2 dBFS、峰值 -5.0 dBFS；heavycut-1 平均 -22.5、峰值 -3.5；bowshot-1 平均 -20.6、峰值 -3.9；dash-1 平均 -20.0、峰值 -4.5。游戏音乐开头 30 秒平均 -14.6、峰值 -0.1。短动作样本与长音乐的平均值不等于感知响度，仅用于排查原先叠加衰减的问题。

**29 项通过**：

- [网页音频 16 项](web-music.json)：默认混音、旧组合迁移、自定义 / 静音保留、真实曲目播放与循环、独立调节、暂停、单词保持正常音乐、故障重试。
- [原生音频 13 项](native-music.json)：实际 `.xbp` 经锁定的 spx 运行库编译，读取真实 Web Audio 输出；使用测试专用阶段 / 音量键和单独 1 秒曲目夹具加快循环检查，生产包保留完整原曲。

原生动作 85% 时输出峰值约 **0.2842**，30% 时约 **0.1003**，比值 **2.833**，确认滑条实际影响独立通道；默认配乐与真实 J 连击叠加的开场采样峰值约 **0.3160**，未达到满幅。此结果不代表所有技能组合、耳机或扬声器的主观听感，也未做线上账号工程上传测试。

ZIP CRC 校验通过；与 v0.15.0 逐文件比较，包内仅 `main.spx` 和 `NativeSfx.spx` 改变，全部音乐、动作采样、美术与风动帧保持原字节。包哈希及测试信息见 [verification.json](verification.json)。

复测：先启动本地服务，按顺序运行（端口以启动日志为准）：

```sh
RUNLAB_URL='http://127.0.0.1:4177/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-music.mjs
RUNLAB_URL=http://127.0.0.1:4177/ bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-music.mjs
```
