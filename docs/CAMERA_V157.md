# v0.15.7 · 菜单震屏残留修复

2026-10-27。本地修改与交付，未推送远程，未替换用户线上 XBuilder 工程。

## 原因与复现

单张截图不能确定抖动发生的时机。本轮在旧 v0.15.6 原生包中复现了两条稳定路径：受击后立即暂停并按 M 回标题，以及受到致命伤后按 M 回标题。冷启动、普通按钮悬停没有复现。

受击将 `shock` 设为 9；它只在战斗的 `updateWorld(dt)` 中衰减。返回标题后战斗更新停止，但标题仍推进 `visualTime` 并调用 `Hero.render()`，旧代码继续把未衰减的 `shock` 叠加到镜头上。因此一次短暂受击变成持续的高频震动，窗口尺寸改变还会改变实际可见幅度。

旧包在返回标题并等待 1.8 秒后，连续约 1.3 秒的镜头 X 指令峰峰值约 18 个游戏单位、Y 约 10.8，`shock` 一直为 9。引擎实际视口受平滑处理影响，与镜头指令幅度不同；这不是 18 个屏幕像素的测量。窗口缩放本身没有周期性变更 zoom。

## 实现

- `Hero.spx`：只在战斗与单词聚焦阶段应用震屏；标题与结果页不应用战斗震屏。
- `Viewport.spx`：统一在标题、胜利、失败阶段清除残留 `shock` 和 `hitStop`，将镜头渲染位置恢复到基础镜头位置。覆盖键盘、鼠标和网页宿主的各条入口。
- 暂停不清空战斗状态；继续后原有短暂震屏仍正常衰减。单词阶段原有指数衰减保留。
- 不改变摄像机跟随速度、场景美术、窗口比例、技能或音频控制。

这一修复位于网页与原生包共用的游戏代码中。`.xbp` 相比 v0.15.6 只有 `Hero.spx` 和合并后的 `main.spx` 改变，所有音频、图像与 C 封面字节一致。音乐默认 75%、动作音效默认 85% 保持不变。

## 验证

新增连续帧镜头测试，读取实际 `.xbp`，经 XBuilder 部署项目模型导入 / 导出，再使用部署编译器和引擎资源运行。受击调用真实 `hurt()`；返回标题使用实际 M 键。测试额外记录每帧镜头指令、实际视口、zoom 和震屏幅度，受击夹具与诊断只在内存副本中注入。

检查冷启动、悬停和难度切换、受击暂停返回、致命伤返回、4:3 窗口调整及普通受击衰减。最后一项同时断言战斗中确实产生过震屏，防止通过关闭全部反馈来规避问题。

同时回归原生菜单 / 窗口和音频：高分屏与窗口适配、暂停返回、跟随对象清除，以及深层音乐、真实攻击后的背景音乐连续性。报告与交付包校验见 [本轮验收](evidence/2026-10-27-camera-v157/README.md)。

本次没有用户在线发布页的连续录像，不能据截图断言所有抖动都来自同一原因；也不把本机测试等同所有设备的性能保证。当前已复现并修复的是战斗震屏残留。

## 构建与复测

```sh
bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs
python3 prototypes/runlab/package.py --game belfry
```

启动本地服务后，串行运行：

```sh
export RUNLAB_URL=http://127.0.0.1:4177/
export XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026
export XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js
CAMERA_LABEL=camera-candidate bash scripts/with-env.sh node prototypes/runlab/test-belfry-camera.mjs
bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-shell.mjs
NATIVE_AUDIO_LABEL=native-audio-candidate bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-music.mjs
```

旧包复现用 `CAMERA_ARCHIVE=/absolute/path/to/old.xbp CAMERA_BASELINE=1 CAMERA_LABEL=camera-baseline` 运行相同镜头脚本；基线模式要求返回菜单后仍有持续震屏。

桌面交付：`EasyRun-XBuilder-v0.15.7-menu-stability.xbp`。需重新导入；刷新原工程不会更新包内代码。
