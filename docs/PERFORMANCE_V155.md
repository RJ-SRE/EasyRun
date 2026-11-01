# v0.15.5 · XBuilder 渲染性能优化

2026-10-27。本轮针对发布版移动、钩索及战斗卡顿，交付本地 `.xbp`，未推送 GitHub，未替换在线工程。封面沿用 C「暗金裂痕」。

## 问题与改动

高分屏测试复现了明显的帧间隔增长。逐帧重复写入精灵显隐、位置、造型及图形效果，以及原生界面的整组刷新，带来不必要的引擎调用。普通尺寸测试不足以暴露这个问题，因此补充了 1440×1080、DPR 2 的实际渲染画布测试。

| 位置                                           | 修改                                                                                                               | 生效范围      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------- |
| `belfry-render-cache.mjs` / `build-belfry.mjs` | 给 21 类世界 / 特效精灵生成实例独立的渲染缓存；相同属性值不重复写入引擎；换造型时重新同步图形效果                  | 网页与 `.xbp` |
| `EnemyTell.spx`                                | 先确定最终预警造型、大小和透明度，避免同一帧先还原再切换                                                           | 网页与 `.xbp` |
| `Scene.spx`                                    | 场景渲染槽按需刷新：战斗中间隔约 50 ms；镜头位移达到 96 单位、阶段 / 检查点 / 排练变化时立即刷新；静止菜单跳过扫描 | 网页与 `.xbp` |
| `NativeShell.spx`                              | 仅在可见状态或镜头变化时刷新 UI；只同步当前可见组，切换层级时执行完整清理                                          | `.xbp`        |
| `NativeShell.spx` / `NativeWords.spx`          | 用类型明确的字段缓存替代每帧拼接多个状态字符串；保持文本、悬停与下拉菜单失效条件                                   | `.xbp`        |
| `package.py`                                   | 原生状态诊断降到约 4 Hz；移除仅供网页宿主使用的敌人 / 任务详细快照                                                 | `.xbp`        |

物理、碰撞、伤害、敌人 AI、角色动作和镜头位置仍逐帧更新。场景槽只决定附近对象使用哪个绘制实例；700 单位的收集半径覆盖 300 单位的可见半高和额外缓冲。常驻世界克隆仍为 121 个，未缩减敌人、地图或特效数量，未降低图片分辨率。

原生界面的冷却数字按原有 0.1 秒档位更新，词题倒计时环保持 60 档。换页、输入、提示渐隐、答案反馈、生命和音量变化均使对应缓存失效。镜头移动时持续更新 HUD 位置，不把界面锁在旧坐标。

## 验证与测量

完整数据、包哈希和截图见 [本轮验收记录](evidence/2026-10-27-performance-v155/README.md)。此前待机衣料与第一轮优化记录保留在 [v0.15](PERFORMANCE_V15.md)。

测试解压真实 `.xbp`，通过固定部署版本的 XBuilder 项目模型导入 / 导出，再使用对应编译器与资源运行。仅内存中的测试副本注入计数器、无敌保护及起点设置。各版本使用同一组词册索引和键盘步骤，每段预热 1.5 秒后采样约 6.5 秒。所有浏览器性能测试串行执行。

引擎帧间隔记录在游戏的 35 ms 步长钳制之前，包含调度与渲染等待，不是纯逻辑耗时，也不能直接当作实际呈现帧率。宿主 rAF 和 CDP 页面任务耗时分别记录，不将它们与引擎间隔混为一谈。移动测试包含钩索牵引、持续向右及起跳；角色可能随后落地或抵达边界，不是持续整关跑图。战斗状态随调度变化，不是逐帧确定性录像。

已有冲击停顿、词题慢动作规则保持原样。测试中仍有偶发长帧，本版不承诺所有场景稳定 60 FPS；Safari、低端设备、长时间运行及用户线上发布页尚未实测。

## 构建与复现

```sh
bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs
python3 prototypes/runlab/package.py --game belfry
bash scripts/with-env.sh node prototypes/runlab/server.mjs
```

在另一个终端逐个运行；端口以本机服务日志为准。保留旧包用于对照，不覆盖它：

```sh
export RUNLAB_URL=http://127.0.0.1:4177/
export XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026
export XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js

# 普通窗口五段：标题、待机、按住 J 战斗、拼写题、词册。
PERF_LABEL=local-standard bash scripts/with-env.sh node prototypes/runlab/test-belfry-performance.mjs

# 高分屏，单词机制开启；PERF_ARCHIVE 未指定时测当前导出包。
PERF_WIDTH=1440 PERF_HEIGHT=1080 PERF_DPR=2 PERF_ONLY_MOTION=1 PERF_WORDS=1 \
  PERF_LABEL=local-retina bash scripts/with-env.sh node prototypes/runlab/test-belfry-performance.mjs

# 使用相同参数，将 PERF_ARCHIVE 指向旧包，再测基线。
PERF_ARCHIVE=/absolute/path/to/previous.xbp \
  PERF_WIDTH=1440 PERF_HEIGHT=1080 PERF_DPR=2 PERF_ONLY_MOTION=1 PERF_WORDS=1 \
  PERF_LABEL=local-retina-baseline bash scripts/with-env.sh node prototypes/runlab/test-belfry-performance.mjs
```

不要在性能采样时并行执行其他浏览器测试或美术构建。网站资源 URL 固定于本轮部署；后续部署若更换，需要重新固定同版资源并同时复测基线与候选。

## 交付

文件名：`EasyRun-XBuilder-v0.15.5-performance.xbp`。在 XBuilder 项目菜单中导入新包，再运行；浏览器刷新不会自动更新已导入的旧工程。完整功能和操作说明见 [原生版说明](XBUILDER_NATIVE.md)。
