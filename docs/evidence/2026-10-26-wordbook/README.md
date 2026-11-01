# v0.11 自适应词册验收

2026-10-26，本机 Chromium，独立浏览器测试上下文，不改真实玩家存档。本轮 **10 组规则测试、91 项浏览器检查、2 条真实键盘整关路线通过**。没有推送远程，也没有运行远程 Actions。[机器摘要与源码摘要](verification.json)。

## 实际验证

| 范围 | 结果 | 主要证据 |
| --- | --- | --- |
| 词源与记忆核心 | 10 组通过 | 8,815 条结构、原 82 词兼容、5,377 行映射、范围/确定性、配额/权重、生命周期、跨日记忆、旧版本、导入、错词间隔；[输出](core-tests.txt) |
| 新词册界面 | 8 项通过 | 三种桌面尺寸、搜索输入隔离、60 行分批、错误/重复导入、备份、自动新局、8,815 词历史、IndexedDB 恢复、写入顺序与保存失败保护；[报告](wordbook.json) |
| 实际铭文技能 | 24 项通过 | 四种技能各自答题、错误/超时取消、独立冷却、解控、IME、重开、死亡续行、刷新和非强制 30 词；[报告](inscription.json) |
| 失败恢复与短屏 | 5 项通过 | 模块缺失、存储禁用、1440/1280 题框、隐藏暂停、最后 E 不触发钩索；[报告](resilience.json) |
| 作答衔接 | 9 项通过 | 慢速表现、输入立即放行、暂停、减弱动效、下一技能独立答题；[报告](motion.json) |
| 成就 | 12 项通过 | 真实首平台解锁、导出/刷新、暂停输入隔离、排练不记、异常恢复；[报告](achievements.json) |
| 技能 | 19 项通过 | 3/3/3/5 秒有效战斗冷却、动作、治疗、资源和音效；[报告](skills.json) |
| 背景音乐 | 14 项通过 | 实际 MP3、阶段循环、铭文期间正常音量、暂停、重试和缺失恢复；[报告](music.json) |
| 普通 / 困难整局 | 两条通过 | 均真实走完下潜、Boss 和返程，30 个不同词答对、26 个不同词对应主路线有效命中；[普通](route-normal.json)、[困难](route-hard.json) |

整关脚本只使用键盘，不改玩家生命、坐标、地图或胜负；答案自动输入。其他专项按各报告所列夹具布置状态：词册 F12 仅产生结局事件，技能固定场地检验实际攻击逻辑。不能将这些结果等同真人自然 30 词覆盖、主观趣味性或学习效果。

## 流畅度与可复现性

- 词册关闭时不渲染完整单词列表；开册每次增加 60 行。完整词库为一次静态加载，单次答题不请求网络。
- 本机 Node 连续 50 次全库抽词平均约 4.5 ms，仅用于确认数量级，不是跨设备指标。
- 真实作答的释放延迟及焦点帧间隔见 `motion.json`，两条整关宿主 rAF 中位数约 16.67 ms、P95 约 16.67 ms。rAF 不是引擎 FPS，不构成其他设备或 XBuilder 平台性能承诺。
- 全量历史导入、持久化和页面重载测试通过；耗时见 `wordbook.json`。源数据/公共模块合计约 4 MB 未压缩，大文件只用于静态加载或离线构建。
- Belfry 重建成功：445 个文件 / 46 类精灵。修改的 JS、构建脚本与浏览器测试 ESLint、Python 编译、格式和 Git 空白检查通过。词源构建可从已入库的规范数据离线复现。
- 本轮定向修订常见词技术义、变体与输入长度；全库独立语言审校仍待完成。PDF 声明 5,418 词目与提取 5,377 主词行的计数口径，以及四个未确认变体，详见 [词源说明](../../WORD_BANK.md)，未隐瞒或填充虚假词条。

## 画面核对

1280×720、1440×1000、1024×768 开始页均在场景边界内；默认折叠高级设置。下面是实际浏览器渲染，词册的薄弱记录来自测试导入夹具。

![1280 开始页](menu-1280.png)

![薄弱词册](memory.png)

## 复查命令

先在独立终端启动本地开发服务，再执行：

```sh
bash scripts/with-env.sh node scripts/build-wordbank.mjs
bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs
bash scripts/with-env.sh node --test prototypes/runlab/test-inscription-core.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-wordbook.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-inscription.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-inscription-resilience.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-inscription-motion.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-achievements.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=off' bash scripts/with-env.sh node prototypes/runlab/test-belfry-skills.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-music.mjs
MODE=0 RETURN_FAILURE=1 RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-route.mjs
MODE=1 RETURN_FAILURE=0 RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-route.mjs
```
