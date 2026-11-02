# v0.15.8 · 菜单配乐替换

2026-10-27。本地交付，未推送 GitHub，也未替换用户线上 XBuilder 工程。

菜单曲目改为用户桌面的 **Sea Power — Red Rock Riviera**。网页版使用 `/audio/music/red-rock-riviera.mp3`，原生包使用 `assets/sounds/BGM_Menu/sound.mp3`，两者均与桌面原文件逐字节一致。完整时长 413.505306 秒、16,666,042 字节、44.1 kHz 双声道，没有剪辑或重新编码。

- 源音频 SHA-256：`65e0b2456c0f3192595ae85ea6b87b5ada59a1a6017973abfa90935c04bba6aa`。
- 交付包：`EasyRun-XBuilder-v0.15.8-red-rock-riviera.xbp`，113,395,479 字节。
- 包 SHA-256：`2acbe97a7e0d98fa0c8f11c4897d37b658b4933f5e555505f2593011ee3c02d3`。
- 与 v0.15.7 相比，包内只变更菜单 MP3 与音乐来源清单，其余游戏代码和素材完全一致。菜单震屏和深层音乐修复保持原样。
- 每阶段单曲循环，音乐默认 75%、动作音效默认 85%；游戏仍播放 Melancholy Of The Boot，结束仍播放 Strange Sports。

**32 项音频检查通过：网页 17 项、原生 15 项。**

[文件校验](verification.json)记录源文件、资源映射、包差异和校验和。[网页音乐报告](web-music.json)检查真实录音播放、跳到曲尾后的循环、暂停续播、切换、音量、资源失败恢复；[原生音频报告](native-audio.json)使用真实包经部署项目模型往返导出后运行，测量实际引擎声音，包含五区深度与攻击后音乐连续性。

原生循环使用独立一秒片段加速测试，交付包保留完整歌曲。没有替用户上传到线上工程，也不将测试夹具当作完整关卡通关。

复测：启动本地服务器后串行执行以下命令。重新打包使用 `python3 prototypes/runlab/package.py --game belfry`，本轮无需重建未变更的世界代码。

```sh
RUNLAB_URL='http://127.0.0.1:4177/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-music.mjs
RUNLAB_URL=http://127.0.0.1:4177/ XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js NATIVE_AUDIO_LABEL=native-audio-v158 bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-music.mjs
```

需重新导入新 `.xbp` 才能更新 XBuilder 中的曲目；网页版刷新后采用新映射。
