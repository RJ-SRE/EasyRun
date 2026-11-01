# v0.22.0 本地交付与验收

实现说明：[Boss 与新常用词库](../../BOSS_AND_COMMON_V220.md)。本次不提交 Git、不推送、不导入或覆盖在线作品。最终文件位置、大小和 SHA-256 见 [artifact.json](artifact.json)，各检查结果见 [validation-summary.json](validation-summary.json)。

- 18 项核心／内容／记忆／成就单元测试，4 项原生运行时工具测试，ESLint 与 `git diff --check` 通过。
- Boss：实际 XBuilder 缓存编译器／资源，11 项运行验收。真实 U→L 经拼写／辨义后打断回血、P 多段只记一击、错题取消、普通 J 不断回血、暂停、变身、九招完整出招、链刃插地反制、前摇无伤、扫掠单次命中与独立后续前摇均覆盖。截图在 [boss](boss/)。
- 原生词机制：28 项。全部 3,816 行字段逐项对齐，四档选词、随机 30 词、渐隐、中文、首错取消、超时、音量、词册、成就与 480×360 排版。见 [words/report.json](words/report.json)。
- 原生 HUD：10 项。Boss 状态、锁定、后摇、生命、答题避让、小窗口和返回标题清理。见 [hud/report.json](hud/report.json)。
- 原生本地档案：12 项。真实 IndexedDB、进程退出重启、离线保存、事务中断、双窗口围栏、用户名隔离、旧内容迁移、退役词保留、连续重启幂等。最终运行记录 [native-local-xbuilder.json](native-local-xbuilder.json)。迁移边界修复：到期时间 0 在时钟换算后钳制为非负，避免浮点误差导致再次读取误报损坏。
- 网页：24 项技能／作答／续关回归，另 8 项词册／大档案／导入导出／存储故障验收。见 [web/report.json](web/report.json)、[web-wordbook/report.json](web-wordbook/report.json)。测试在独立浏览器中注入场景，不改交付包或用户现有存档。

## 帧时间的实际边界

实际 XBuilder 编译器与资源、本机无界面 Chromium，每个场景约 8 秒：菜单、待机、普通战斗、第三形态 Boss、答题、词册、钩索、跑图，共 8 组。没有在线发布，也不代表所有设备。

rAF 的 P99 约 16.7ms；菜单和词册本轮没有 >34ms 的样本，其他场景每组仍观察到 1–2 个 >100ms 的长帧，最大约 233–250ms。**不能据此称原生卡顿已完全消除或保证恒定 60fps。** 世界固定克隆仍为 121、缺失场景槽为 0，新增九招只复用原有 8 个危险段。详细采样、硬件与工具信息见 [performance/report.json](performance/report.json)。其中 `engineFrameMean/Max` 为 0 的旧注入计数不作为结论依据，采用 rAF 与场景计数。

各报告保留其实际测试包 SHA-256；最终包另含来源文档与内容就绪标记，并修复到期时间保存的边界，最终迁移重启测试针对最终包执行。最终校验以 `artifact.json` 为准。
