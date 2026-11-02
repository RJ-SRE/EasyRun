# v0.15.6 · 深层关卡音频修复

2026-10-27。本地交付，未推送 GitHub，未改动用户线上项目。

## 需求与表现

背景音乐默认音量从 40% 调整到 **75%**，动作音效默认保持 85%，两者继续独立调节。网页版使用相同的新默认值，保留浏览器中已经保存的音量偏好；原生 `.xbp` 每次新运行以 75% / 85% 初始化。

旧包复现：主角从顶部进入深层后，歌曲日志仍显示播放，实际输出却变为零；返回顶部后，同一首歌重新可闻。镜头 Y 约 −2,340、−4,740、−7,140、−9,540、−11,140 时，关闭动作音效后的八次 RMS 采样均为 0。顶部及返回顶部均有音乐输出，过程中没有切歌。

这是声源距离造成的静音，不是歌曲文件损坏。攻击经常伴随移动和镜头变化，因此也需要检查深层战斗后的音乐连续性。

## 原因

在当前 SPX 3.3.0 中，舞台 `play` 使用零衰减但仍有 2,000 单位最大距离的二维播放器。零衰减使声源脱离精灵并落在场景根节点；镜头远离根节点后，声音仍会被距离边界排除。

- [舞台播放接口](https://github.com/goplus/spx/blob/v3.3.0/game_sound.go) 使用固定最大距离；[默认参数](https://github.com/goplus/spx/blob/v3.3.0/internal/core/project/settings.go) 为 2,000。
- [音频管理器](https://github.com/goplus/spx/blob/v3.3.0/internal/audio/manager.go) 在衰减为 0 时清空声源所有者。
- [底层播放器](https://github.com/goplus/spx/blob/v3.3.0/godot_modules/spx/spx_audio.cpp) 创建 `AudioStreamPlayer2D`，保留最大距离；该行为与本机旧包的深度采样一致。

XBuilder 还会在保存 / 导出时根据视口重新生成声音衰减与距离配置；本轮实际项目模型往返导出得到衰减 1、距离 768。因此，仅把配置中的距离改成很大的数值不可靠。对应实现见 [项目导出代码](https://github.com/goplus/builder/blob/e2a4c45dfa0574ac7700fad94d2d4a6da7da8083/spx-gui/src/models/spx/project.ts)。

## 修复

1. 新增隐藏的常驻精灵 `NativeBgm`，单独拥有背景音乐播放与音量通道，不属于敌人、临时特效或可销毁的克隆。
2. `NativeBgm` 与已有的 `NativeSfx` 都在镜头适配后定位到实际视口中心；位置不变时跳过重复写入。
3. 导入包明确设置非零衰减以保留精灵绑定，参数与 XBuilder 大地图导出一致。两个声源跟随镜头，不依赖超大距离参数。
4. 切换菜单 / 游戏 / 结算时才切换曲目；普通移动、攻击、区域变化不重新播放。暂停、静音和音量归零仍沿用暂停 / 恢复规则。
5. 更新网页默认音乐音量和相应测试，保持用户已保存的自定义值。

涉及 `NativeMusic.spx`、新增 `NativeBgm.spx`、原生精灵生成器、打包器和网页音频默认值。只新增一个原始精灵，不增加场景克隆或音频文件。19 个原音频文件与 v0.15.5 字节一致，C 封面及世界美术沿用。上一版渲染缓存和性能优化保持生效。

## 验证方法

音频专项测试对真实 `.xbp` 进行 XBuilder 部署项目模型导入 / 导出，再使用同版编译器及引擎资源运行。通过 Web Audio 分析器测实际输出，不能只凭“playing”日志判定有声。

深度检查关闭 SFX，只测背景音乐；通过仅注入测试副本的按键移动至五区检查点和最底部，再返回顶部。深层战斗使用真实 J 连按、W 跳跃、U 蓄箭和 L 蓄刀，等待临时效果回收后再次隔离测量 BGM，检查没有重新播放。另在深层分别验证音效 85% / 30%、音乐和音效独立静音、暂停续播、词题阶段、三阶段切歌与循环。

循环测试单独使用一秒 MP3 片段加速，交付包仍包含三首完整音轨。深度跳转和无敌保护只存在于测试副本，不在交付包。此测试不等同自然操作完成整关，也未代替用户在线发布页或 Safari 验收。

报告、复现失败的旧包证据、最终包哈希见 [本轮验收](evidence/2026-10-27-audio-v156/README.md)。

## 构建与复测

本轮共享世界代码未变，已有游戏构建后只需重新生成原生包：

```sh
python3 prototypes/runlab/package.py --game belfry
```

没有生成产物时先执行 `bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs`。另行启动本地服务后串行运行：

```sh
export RUNLAB_URL=http://127.0.0.1:4177/
export XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026
export XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js
NATIVE_AUDIO_LABEL=native-audio-candidate bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-music.mjs
bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-words.mjs
RUNLAB_URL='http://127.0.0.1:4177/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-music.mjs
```

旧包复现使用 `NATIVE_AUDIO_ARCHIVE=/absolute/path/to/old.xbp NATIVE_AUDIO_SPATIAL_ONLY=1 NATIVE_AUDIO_LABEL=audio-baseline` 执行同一音频脚本。v0.15.5 的“深处仍有音乐”断言应失败，并记录各高度的真实零输出。

交付文件：`EasyRun-XBuilder-v0.15.6-audio-fix.xbp`。需重新导入 XBuilder；刷新旧工程不会替换其源代码。
