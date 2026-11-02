# v0.16.4 原生战斗信息验收

2026-10-30。交付本地 XBuilder `.xbp`，未替换在线项目，未推送 GitHub。设计、状态规则与实现见 [战斗 HUD 说明](../../COMBAT_HUD_V164.md)。

## 功能验证

实际导出包经过固定 XBuilder 部署版本的项目模型导入/导出，再由部署编译器与资源运行。所有下列原生回归报告的 SHA-256 均与最终交付文件一致，`errors` 均为空。

| 检查 | 结果 | 记录 |
| --- | --- | --- |
| 战斗 HUD | 10 项通过：余烬、技能限制/蓄力/冷却、Boss、受控提示、答题避让、词册入口、结算、返回标题 | [报告](native-combat.json) |
| 菜单与窗口 | 15 项通过：真实输入、暂停、相机、检查点重试、宽窄屏、Retina、词册 | [报告](native-shell.json) |
| 单词系统 | 24 项通过，逐条核对全部 8,815 条词汇；自动释放、首错取消、超时、陷阱解救、词册与克隆预算 | [报告](native-words.json) |
| 源码转换器 | 4 项通过 | `python3 prototypes/runlab/test_native_runtime.py` |
| 静态检查 | 本轮 JS 定向 ESLint、Prettier 通过，`git diff --check` 通过 | 构建器、HUD 生成模块、专项测试 |

专项测试通过 F8 在测试副本里布置战斗状态并冻结模拟，真实执行开局、回息按键、拼写、暂停与返回标题。Boss 截图先将角色放入实际决战场，再等待引擎平滑相机到位；不能将测试瞬移时的过渡画面当作稳定显示结果。固定状态检查不代表自动打完了整场 Boss 战。交付包无测试快捷键或冻结代码。

本轮没有再次运行完整音频长循环专项；三个 MP3 与十六个动作 WAV 和 v0.16.3 字节一致，音量滑条由词汇回归覆盖，音频运行代码没有因本轮 HUD 修改。

人工检查：[探索](exploration.png)、[冷却](cooldowns.png)、[Boss 锁定](boss-locked.png)、[反击窗口](boss-opening.png)、[小窗口](boss-small.png)、[答题避让](question.png)、[破架提示](guard-break.png)、[结算](results.png)。

## 同机持续运行对照

Apple M1 Pro，macOS 25.5.0，Chromium 156.0.8078.4，1440×1080、DPR 2。旧包和最终新包各运行约 120 秒，使用相同测试脚本交替 A/D、W、O 和连续 J；固定词册、测试无敌，未开启 profiler 或 tracing。原生回归与性能测量串行进行。

| 指标 | v0.16.3 | v0.16.4 |
| --- | ---: | ---: |
| rAF 间隔中位数 | 16.67 ms | 16.67 ms |
| rAF 间隔 P95 / P99 | 16.67 / 16.67 ms | 16.67 / 16.67 ms |
| 最长 rAF 间隔 | 200.00 ms | 216.66 ms |
| 大于 100 ms 的间隔次数 | 31 | 35 |
| 大于 250 ms 的间隔次数 | 0 | 0 |
| 超过 34 ms 部分的累计时间 | 4.66 s | 5.83 s |
| CDP 主线程任务时间 / 秒 | 774.06 ms | 869.86 ms |
| 缺失世界渲染槽 | 0 | 0 |
| 采样结束时的动态字形 | 7 | 29 |

新增战斗信息有额外成本：本次测量主线程任务时间约增加 12%，长帧次数增加 4 次。常见帧间隔保持不变，未出现超过 250 ms 的间隔，但不能称为无开销、消除卡顿或比旧版更快。脚本按墙钟输入，实际路径并非逐帧相同；单轮测试也不代表所有设备。rAF 是浏览器回调间隔，不是直接测得的 GPU 呈现时间。

本次持续输入没有主动打开技能答题，答题与 Boss 状态另由功能回归覆盖。原始数据：[旧版](baseline-soak.json)、[最终新版](candidate-soak.json)。保留旧包供性能敏感场景回退。

## 文件校验

桌面文件：`EasyRun-XBuilder-v0.16.4-combat-hud.xbp`。

- 134,897,276 字节，5,079 个 ZIP 条目；CRC 通过。
- SHA-256：`9dd066c79481a8c7e9ff2bb619e0fba501d6e4f9b7bc515dc6243a6dbe70f08e`。
- 原有非 Native UI 的 435 张 PNG、3 首 MP3、16 个 WAV 字节不变；没有替换场景、角色与歌曲。
- 新增 4 个不使用克隆的图形精灵；动态文字仍使用原有最多 160 个字形实例。
- 常驻世界克隆保持 121；词汇回归观察到的组合克隆峰值为 246，低于引擎 300 上限。该峰值仅属于测试覆盖场景。
- 桌面文件与构建导出文件哈希一致。完整记录见 [artifact.json](artifact.json)。

需要重新导入新文件才能使用本轮修改，刷新旧工程不会更新它。

## 复现

在项目根目录运行构建及原生回归，保留构建前已有的本地修改：

```sh
python3 prototypes/runlab/package.py --game belfry
export RUNLAB_URL=http://127.0.0.1:4177/
export XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026
export XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js
bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-combat.mjs
bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-shell.mjs
bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-words.mjs
PERF_WIDTH=1440 PERF_HEIGHT=1080 PERF_DPR=2 PERF_WORDS=1 \
PERF_SOAK=1 PERF_SAMPLE_MS=120000 PERF_LABEL=v164-final \
bash scripts/with-env.sh node prototypes/runlab/test-belfry-performance.mjs
```

构建依赖已生成的游戏资源；若修改了共享玩法或场景源码，先执行 `bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs`。性能测试旧包时另设 `PERF_ARCHIVE` 为 v0.16.3 文件路径；两个浏览器测试不要同时运行。
