# 裂隙：盗速者的第二次方向试验

2026-10-24。根据“无聊、幼稚、没有新鲜感”的反馈重做。

## 这次具体改变

上一版的问题不只是素材精度低：角色比例、整齐重复的楼块、水平地面和运输车缺少独特气质；夺取动能只用于越过三处同类断口，环境没有足够清楚的反馈和代价。

新版把一小段关卡放进风暴中的机械遗迹。背景、风机叶片和蒙面行者动画使用新的绘制素材；场景有背景视差、雨线、披风、冲刺残影和短促的镜头震动。页面以游戏画面为中心，可以全屏。

机制有两个实际改变：

1. **风机与供能桥相连。** 吸取动能让危险风机锁止九秒，桥梁先缓慢失压，再向深渊坠落。玩家需要利用获得的速度穿越。放弃冲刺、原地停留会有后果。
2. **升降机构可以被冻结。** 吸取动能将其锁在当时的高度。普通释放通向下层出口；按住 W 向上释放可以登上高处，回收一枚失落回声，再跳向出口。

当前熟悉路线后，只需约 7 秒即可直接穿过这一小段。它是美术与交互的局部验证，还不是完整关卡、完整商业游戏或已证明有吸引力的产品。

## 动作与特效修订（2026-10-24）

针对“动作不连贯，场景的特效效果过差”，这次直接修改运行中的游戏：

- 跑步换为 12 张序列帧，并设置逐帧重心、脚底基准。周期由移动距离驱动；待机、跑、上升、下落、冲刺、着地采用短过渡。落地有弹簧回弹，转向、跳跃仍立即响应输入。当前仍是序列帧动画，不是最终的骨骼动画；生成素材的关节和衣摆一致性仍有提升空间。
- 镜头按时间平滑跟随，速度变化不会直接把镜头拖走；保留有限的落地、冲刺震动。
- 夺取：风机约半秒内逐渐刹停，能量光束沿弧线流向角色。升降机恢复运动沿冻结的相位继续，避免倒计时结束后位置跳变。
- 冲刺：残影逐帧淡出，细光丝沿运动路径散开。脚步和落地：水滴、水平涟漪、扩散水雾。
- 场景：雨幕按精确周期连续滚动，雾层缓慢漂移；桥梁先振动、失压，然后加速下落，同时掉出火星和碎片。
- 特效在 spx 中运行，跟随 `.xbp` 导出；普通粒子上限 100，暂停冻结生命周期，重试清理上一局的瞬态效果。网页中的可选声音增加了风声、湿脚步和机械冲击。

验证文件：`test-results/motion-lifecycle.json`（暂停、重试、落地与粒子回收），`test-results/motion-final/metrics.json`（真实键盘运行、状态与浏览器帧间隔），`test-results/motion-preview/play.mp4`（直接录制游戏画布）。本机无头 Chromium 的页面 rAF 中位间隔约 16.7 ms、P95 约 33.3 ms；这是录制环境下的浏览器调度观测，不等同于跨设备的引擎帧率保证。

## 试玩与文件

- 新版：http://127.0.0.1:4177/
- 旧版对照：http://127.0.0.1:4177/legacy.html
- 场景生成：`build-rupture.mjs`
- 实际玩法源码：`spx/rupture/main.spx`、`spx/rupture/Hero.spx`
- 页面：`public/rupture.js`、`public/rupture.css`、`public/rupture.html`（与入口 `index.html` 同步）
- 生成后的 spx 工程：`projects/rupture/`
- XBuilder 工程包：`exports/rupture.xbp`
- 完整浏览器检查：`test-results/rupture-tests.json`

在工作区根目录运行：

```sh
bash scripts/with-env.sh node prototypes/runlab/build-rupture.mjs
bash scripts/with-env.sh node prototypes/runlab/server.mjs
# 服务已启动后：
bash scripts/with-env.sh node prototypes/runlab/test-rupture.mjs
bash scripts/with-env.sh node prototypes/runlab/test-motion-lifecycle.mjs
bash scripts/with-env.sh node prototypes/runlab/test-motion.mjs motion-preview --clean
python3 prototypes/runlab/package.py
```

测试通过真实键盘输入验证上下两条路线、回声回收、未夺取时被风机击中、桥梁实际下降、升降位置冻结、暂停/继续、重试、反馈保存和全屏。测试不修改坐标或胜负状态。记录采用独立的 `runlab-rupture-v2` 本机存储，不与旧版结果合并。

场景碰撞、机构状态与动能仍运行于 spx。新的 PNG 资产通过二进制加载；没有用网页背景替代游戏里的背景层。网页还保留一张加载期间的背景预览。

## 美术来源与导入

绘制素材使用内置 `image_gen.imagegen` 生成：

- `art/rupture-v2/storm-city.png`：风暴机械遗迹背景。
- `art/rupture-v2/turbine.png`：透明风机叶片。
- `art/rupture-v2/wanderer-atlas.png`：透明九宫格角色动作图集。
- `art/rupture-v2/run-cycle-v3.png`：补充的透明 4×3 跑步序列；提示词为 `art/rupture-v2/run-cycle-prompt.txt`。

环境和风机的完整提示词保存在 `art/rupture-v2/prompts.json`，角色提示词保存在 `art/rupture-v2/hero-prompt.txt`。原图保留不变。`extract-frames.mjs` 按网格拆分；传入 `--run` 导入跑步序列，并统一到已有纹理尺寸。导入保留透明度，不重绘或改变颜色；`frames/`、`run-frames/` 用于引擎播放。重心与脚底基准保存在生成器的注册数据中。平台、结构件、光丝与粒子为项目中的程序化 SVG。

工程包只包含 spx 游戏本身，不包含网页提示与结算。已验证包结构；尚未在完整 XBuilder 编辑器中重新导入。真人是否觉得新方向有吸引力，仍需后续试玩判断。
