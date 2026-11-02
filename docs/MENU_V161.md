# 静水圣庭原画微动 · v0.16.1

2026-10-27，本地修改，未推送远程。按用户反馈撤回 v0.16.0 的独立角色图集与动作演出，恢复选定 B「静水圣庭」原图的主角、建筑、标题与构图。

## 视觉与交互

- 原图中的主角保持蹲伏、持杆姿态，头部、身体、手脚和建筑不动。没有新造型、抬头、收钩、护腕整理或起身动画。
- 披风尾端以 4 秒周期轻动；水面倒影以 4 秒周期局部波动。最大源图位移分别为约 2.16、2.10 像素，在 960×600 逻辑舞台中约为 1.31、1.27 像素。大窗口按舞台比例放大。
- 点击开始或 Enter 直接进入游戏。进入设置、查看词册不改变主角姿态；减少动态时两片局部图固定为原始帧。
- 右侧主菜单使用透明底、细线、浅金主按钮。原图右侧烘焙按钮已清除，操作来自真实 HTML 或原生精灵。
- 远征设置为 356×430 逻辑像素的轻透面板，分成「铭文」「声音与画面」，取消厚重标题栏和实心下拉框边框。网页附加 4 像素背景模糊；原生采用透明 PNG，不做实时背景模糊。
- 设置保留原有词汇、作答提示与音量行为。网页继续提供选词策略、词汇难度、跨次存档；原生仍为四级 / 六级 / 混合词库及运行内记忆，不宣称新增网页专有能力。
- 背景音乐默认 75%、动作音效 85%；菜单仍是裁去前 5 秒的 Red Rock Riviera。音频文件、战斗角色、技能与敌人没有改动。

## 原图与素材

所选原图：[B 静水圣庭](../design/menu-style-variants/2026-10-27/grand-scale/b-moonlit-sanctuary.png)。

运行源文件均在 `prototypes/runlab/art/belfry/menu/`：

| 文件 | 用途 |
| --- | --- |
| `static-original.png` | 所选原图的原样副本，主角与左侧画面来自这里 |
| `static-clean-right.png` | imagegen 清除右侧烘焙控件的输出 |
| `static-clean-prompt.txt` | 本次编辑的完整提示词 |
| `manifest.json` | 参考图、源文件尺寸、哈希和历史素材标记 |
| `static-validation.json` | 构建时固定区域校验、局部图范围与最大位移 |

清洁图仅用于右侧：前 1000 列强制取原图，1000–1080 列羽化合成，此后采用清洁结果。没有采用 imagegen 输出中的主角像素，避免重新生成导致造型变化。原背景与十二姿态图集保留为历史源文件，运行包不再引用。

## 实现与性能边界

`belfry-menu-art.mjs` 在构建时生成 24 帧披风局部图与 32 帧水面局部图。运行时仅使用 MenuScene、MenuClothLocal、MenuWaterLocal 三个固定精灵，分别保持背景、以 6 fps / 8 fps 换局部造型。没有运行时像素采样、全屏变形、额外菜单克隆或大幅镜头运动。

披风局部图包含原背景像素，避免移动后留下旧披风重影；边缘羽化。头部、手脚及水中主要石块排除在运动蒙版外。固定区域每帧逐像素检查，发现变化构建直接失败。美术微动是有限的二维局部变形，不是骨骼或布料模拟。

`MenuMotion.spx` 两端共用时钟与显示逻辑。网页设置复用已有控件及音频通道，原生面板、文字和点击区域共享逻辑坐标。两端均保留按比例适配与留边。

局部水面帧增加包体积，换取运行时不实时计算水纹。当前包体积和本机性能结果记录在本轮验收目录；测试不能保证所有浏览器、手机或低端硬件均满帧。

## 构建与验证

```bash
bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs
python3 prototypes/runlab/package.py --game belfry
bash scripts/with-env.sh node prototypes/runlab/test-belfry-menu-web.mjs
RUNLAB_URL=http://127.0.0.1:4177/ \
XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 \
XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js \
bash scripts/with-env.sh node prototypes/runlab/test-belfry-menu.mjs
```

网页验证设置、焦点、声音、词册、开始 / 返回及小屏适配；原生包通过部署项目模型导入导出，再用部署编译器和资源运行，检查局部帧、固定镜头、减少动态、设置及进入游戏。单词与音量回归使用独立原生测试。所有测试只运行本地包，未覆盖线上工程。

报告和实际截图见 [本轮验收](evidence/2026-10-27-stillwater-menu/README.md)。交付文件为桌面的 `EasyRun-XBuilder-v0.16.1-stillwater.xbp`，发布缩略图仍为此前选定的 C。
