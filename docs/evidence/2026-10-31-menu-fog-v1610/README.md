# v0.16.10 · 静水圣庭雾流

2026-10-31。为菜单建筑间与水面附近的雾增加缓慢漂移、轻微翻涌，网页和 XBuilder 包共享同一套表现。保留原图角色姿态、披风/水面微动、暗金闪电、上下渐变薄边和现有菜单操作。仅本地更新，没有推送远程或覆盖在线作品。

## 表现与保护范围

- 建筑缝隙、桥廊之间与水面附近采用不同强度的局部雾区。雾纹缓慢水平移动，同时有轻微竖向翻涌与密度变化，不移动镜头或整张绘景。
- 基于现有原图的雾像素生成动画，不另贴一张与场景不匹配的白烟图片。图像亮度、边缘与邻域共同约束运动范围；遮罩在构建时柔化，避免碎片状闪烁。
- 原图主角与近处台阶有明确排除区域，所有帧在这些区域的透明度保持零。建筑暗部与边缘尽量保留，远景上会出现轻微雾化；这是二维绘景上的近似，不是三维流体或深度模拟。
- 12 秒循环，16 张局部帧由两个固定精灵交叉淡化，使用 50 级透明度过渡。雾只在标题阶段显示；进入游戏隐藏，减少动态时移除雾动画、恢复静态背景。

## 实现与开销

`belfry-menu-fog.mjs` 从原图 `[330, 530, 1120, 230]` 范围生成 560×115 透明贴图，运行时按 2 倍局部比例注册。每个精灵 16 张造型，共 32 张 PNG；完整 RGBA 像素约 7.9 MiB，不含引擎额外纹理开销。只有两个固定精灵，没有新增粒子克隆、独立帧循环或运行时像素计算。

`MenuMotion.spx` 复用菜单时钟；`native_viewport.py` 复用背景的等比铺满变换，并按贴图/原图分辨率换算局部缩放。`belfry-render-cache.mjs` 缓存未变的坐标、尺寸、可见性与造型，透明度只在量化级别变化时写入。没有修改玩法、物理、技能、词库或音乐。

## 验证

最终包共 **27 项通过，错误为零**：

- [原生菜单](native-menu.json)：7 项。真实 `.xbp` 经部署模型往返后编译运行；观察到完整 16 帧和 50 级过渡，检查主角保护区域、原始姿态、镜头与克隆数、闪电时序、减少动态、菜单设置与进入游戏时隐藏。
- [原生窗口](native-shell.json)：15 项。六组宽高比、2 倍像素密度、实际按钮点击、镜头归位、词册/暂停/结算返回、渐变薄边回归通过。
- [网页菜单](web-menu.json)：5 项。设置、焦点、词册、声音控件、开始/返回和小屏交互通过。

原生菜单采样 1,310 帧，p50/p95/p99 均约 16.67ms，超过 34ms 的 1 帧。采样发生在录制视频之前，来自带诊断日志的引擎帧间隔；它不等于 GPU 呈现时间，也不能保证其他设备的帧率。本轮没有重跑音频、完整通关或单词专项；已有 PNG、音乐与音效做字节一致性检查。定向 ESLint、Prettier、Python 编译、ZIP CRC 和 `git diff --check` 通过。

[实际运行动态预览（约 12 秒，无声）](fog-motion.mp4)。视频直接录自原生运行画布，雾与水纹正常播放，没有冻结、加速或合成动画；静态截图只能看到其中一帧。

![实际原生菜单雾流](fog-middle.png)

## 交付与复现

桌面：`EasyRun-XBuilder-v0.16.10-living-mist.xbp`，需要重新导入。v0.16.9 保留供回退；网页版刷新本地 4177 页面即可。文件大小、SHA-256 与差异清单见 [artifact.json](artifact.json)。

```sh
bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs
python3 prototypes/runlab/package.py --game belfry
export RUNLAB_URL=http://127.0.0.1:4177/
export XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026
export XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js
for test_script in prototypes/runlab/test-belfry-menu.mjs prototypes/runlab/test-belfry-native-shell.mjs prototypes/runlab/test-belfry-menu-web.mjs; do
  bash scripts/with-env.sh node "$test_script" || exit $?
done
```
