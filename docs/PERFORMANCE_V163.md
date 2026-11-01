# v0.16.3 · XBuilder 间歇性长帧优化

2026-10-28。本轮针对“跑图、战斗平时流畅，隔一段时间短暂卡顿后恢复”的反馈。仅本地交付，不推送远程、不替换在线项目。

## 定位

延长采样后，在本地原生包中复现了间歇性长任务。对 `ispx.wasm` 进行 CPU 采样，并用同一二进制的 Go pclntab 和 WASM 元素表还原函数名，发现三次主要长任务中约 90% 的采样栈位于 `runtime.gcBgMarkWorker → runtime.gcDrain → runtime.scanobject`。另有部分较短长任务与浏览器 V8 GC 重合。

堆采样进一步指向 ixgo/SSA 保存的解释执行函数、转发方法和类型信息。SPX 精灵嵌入 Game；把大量界面和世界辅助方法放在 Game 上，会为多种精灵产生大量提升方法。仅减少屏幕上几个字形，无法消除这部分开销。

CPU 采样与 tracing 有额外开销，诊断时的任务时长不代表用户在线页面的实际停顿时长。最终对照另用不启用 CPU profiler/tracing 的持续输入测试。没有对当前线上发布页面直接采样。

## 改动

1. **分离原生运行控制器。** 打包时将 103 个原生界面/词汇/音频辅助方法放入 `NativeLogic`，104 个世界辅助方法放入 `WorldLogic`。状态仍保留在原 Game 实例，输入事件及原有数值规则不变。两个控制器隐藏、无碰撞、不克隆。网页版源结构不变。
2. **紧凑初始化数据。** 8,815 条词汇的六个文本字段按列保存，启动时一次拆分；等级与拼写标记紧凑解码。3,350 个字形映射和五位小数字宽也一次解码。减少解释器的逐项初始化语句，不删减词条、中文释义、干扰项或字体图片。
3. **停止空闲渲染轮询。** 24 段钩索和 8 条首领攻击线在需要显示时逐帧刷新，消失时再隐藏一次，空闲时不再逐帧唤醒。物理、敌人 AI、碰撞和有效攻击时机保持原来频率。

导出转换器只重写真实代码中的非限定函数调用，跳过字符串、注释、已限定调用及精灵自己的方法。转换后的独立控制器是标准 `.spx` 文件，随项目导入/导出，不依赖网页宿主。

保留平台默认 GC 策略，不关闭回收、不修改 XBuilder 引擎。常驻世界克隆仍为 121；控制器不占克隆名额。未合并 UI 控件类型，因此不改变词册分页与 300 克隆预算。

## 验证

本轮验收与实际帧间隔数据见 [验收记录](evidence/2026-10-28-performance-v163/README.md)。

- 实际 `.xbp` 经固定部署版本的项目模型导入/导出，用其编译器和资源运行。
- 启动后逐项核对全部 8,815 条词汇的八个字段，而非只检查词汇数量。
- 回归词册、搜索、提示渐隐、中文释义、自动判对、首错取消、技能冷却、暂停、解救和按键隔离。
- 核对菜单、窗口比例、音频、钩索显示及首领攻击线切换。
- 源码转换器单元测试覆盖字符串/注释中的括号、跨控制器调用、自有方法和非法源文件。
- 性能对照使用同一机器、分辨率、DPR、资源与输入脚本，浏览器性能测试串行执行。

浏览器 rAF 间隔与 SPX `waitNextFrame` 返回的步长不是同一指标；本轮发现引擎步长会低估部分长任务，不能只凭该值或平均 FPS 宣称无卡顿。保留 rAF 最大间隔、P95/P99、长间隔次数与累计超额时间。

## 复现

```sh
python3 prototypes/runlab/package.py --game belfry
python3 prototypes/runlab/test_native_runtime.py

RUNLAB_URL=http://127.0.0.1:4177/ \
XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 \
XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js \
PERF_WIDTH=1440 PERF_HEIGHT=1080 PERF_DPR=2 PERF_WORDS=1 \
PERF_SOAK=1 PERF_SAMPLE_MS=120000 PERF_LABEL=v163-soak \
bash scripts/with-env.sh node prototypes/runlab/test-belfry-performance.mjs
```

旧包对照通过 `PERF_ARCHIVE=/absolute/path/to/old.xbp` 指定。不要同时进行美术构建或其他浏览器测试。部署资源固定于 2026-10-26；更换资源时基线和候选都需要复测。

## 交付

桌面文件：`EasyRun-XBuilder-v0.16.3-runtime-performance.xbp`。需要重新导入后运行，刷新旧项目不会替换其代码。旧包保留，可随时对照。仍可能受到平台运行时、浏览器后台任务及硬件负载影响，不承诺所有设备零长帧。
