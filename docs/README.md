# 文档总目录

整理日期：2026-10-25（Asia/Shanghai）。当前产品是倒悬钟城 v0.8.1 五区与每次技能刻印，保留铭文远征与钟城铭录；最新交付分支为 `feat/inscription-v1`。新增内容与未完成项见 [城市实现](CITY_V08.md)。

本目录把正在实施的规则、历史记录和未实装提案分开。产品行为以 [PRD](PRD.md) 为当前需求入口，精确技术契约见对应实现文档；验证结论必须对应报告日期和源码，不能因为文档名称写着“完整”就推断所有平台均已验收。

## 推荐阅读顺序

| 读者 / 目的  | 顺序                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 第一次接手   | [根 README](../README.md) → [交付清单](releases/2026-10-25-v07-handoff.md) → [运行手册](RUNBOOK.md)                                                              |
| 产品与玩法   | [PRD](PRD.md) → [铭文实现](INSCRIPTION_V07.md) → [成就设计](ACHIEVEMENTS_V07.md) → [路线图](ROADMAP.md)                                                          |
| 开发与审核   | [技术设计](TECHNICAL_DESIGN.md) → [测试记录](TESTING.md) → [Git 流程](GIT_WORKFLOW.md)                                                                           |
| 美术与声音   | [资产来源](ASSETS.md) → [声音方向](AUDIO_DIRECTION.md) → 对应原图 / 提示词目录                                                                                   |
| 研究后续关卡 | [三十词远征策划](planning/thirty-word-expedition/README.md) → [关卡](planning/thirty-word-expedition/LEVELS.md) → [美术](planning/thirty-word-expedition/ART.md) |

## 当前维护文档

| 文件                                       | 负责回答的问题                                                    |
| ------------------------------------------ | ----------------------------------------------------------------- |
| [PRD.md](PRD.md)                           | 现在的玩家、主循环、技能 / 敌人 / 铭文 / 成就、边界与验收是什么？ |
| [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) | 源码在哪里？模拟、表现、输入、音频、存储如何协作？                |
| [RUNBOOK.md](RUNBOOK.md)                   | 如何从正确分支启动，如何构建、检查、打包和处理常见错误？          |
| [INSCRIPTION_V07.md](INSCRIPTION_V07.md)   | 六类触发、词汇事务、冻结、取消 / 续档的具体规则是什么？           |
| [ACHIEVEMENTS_V07.md](ACHIEVEMENTS_V07.md) | 15 项成就如何判定、去重、展示、佩戴和保存？                       |
| [WORD_BANK.md](WORD_BANK.md)               | 82 词来源、内容版本、抽样范围、义项和许可如何追溯？               |
| [TESTING.md](TESTING.md)                   | 哪次验证覆盖了什么？哪些报告使用真实路线或测试场景？              |
| [ROADMAP.md](ROADMAP.md)                   | 下一步先做什么，以什么证据决定是否扩展？                          |
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md)         | 当前交付分支、提交、PR、CI 触发、回退和身份规则是什么？           |
| [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)   | 用户反馈、方向变化、开发过程和集中补录在哪里？                    |
| [DECISIONS.md](DECISIONS.md)               | 为什么改方向？哪些旧决定被后续要求替代？                          |
| [ASSETS.md](ASSETS.md)                     | 原图、提示词、声音母版、程序绘制和依赖来源在哪里？                |

## 功能状态与相邻模块

| 内容                                   | 状态                         | 入口                                                    |
| -------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| 倒悬钟城单关、五类刺客、四技能         | 已实装                       | [PRD](PRD.md)                                           |
| 拼写 / 辨义、30 词池、词册与检查点恢复 | 已实装                       | [铭文实现](INSCRIPTION_V07.md)                          |
| 28% 聚焦表现、答题后立即交回动作       | 已实装；全局专注调度仍未实现 | [铭文实现](INSCRIPTION_V07.md)                          |
| 15 项成就、称号、本机导出              | 已实装                       | [成就设计](ACHIEVEMENTS_V07.md)                         |
| 五通道钩索关卡                         | 独立可玩实验，单独构建       | [通道模块](levels/README.md)                            |
| 五区环境、四项修复、供能分支与纪事     | 已实装，沿用原纵井主路       | [城市实现](CITY_V08.md)                                 |
| 十五房拓扑、语义机关、换境复核         | 未实装设计提案               | [三十词远征](planning/thirty-word-expedition/README.md) |
| 角色语音、旧对白系统、AI 对话          | 当前停用；仅保留历史制作资料 | [音频制作资料](../production/audio-v06/README.md)       |
| GitHub Issue                           | 五条草稿保存在仓库，未发布   | [草稿与状态核对](issues/2026-10-25-backlog.md)          |

## 历史与来源

旧文档保留其原日期及阶段语境，不移动源文件、素材或已被链接的证据目录。

- [v0.3 PRD](PRD-v0.3.md)、[v0.3 技术设计](TECHNICAL_DESIGN-v0.3.md)：风机墓场阶段。
- [v0.4 PRD](PRD-v0.4.md)、[v0.4 技术设计](TECHNICAL_DESIGN-v0.4.md)：最初纵向钟城阶段。
- [v0.5 战斗方案](COMBAT_V05_PLAN.md)、[v0.6 刺客方案](ASSASSINS_V06_PLAN.md)、[技能方案](SKILLS_V06_PLAN.md)：设计时的实现计划，当前参数以 PRD / 源码为准。
- [铭文 v1.1 策划](planning/inscription-v1/DESIGN.md)：开发前设计及模块快照；阶段性“本轮不开发”不覆盖后续已实装状态。
- [XBuilder 边界研究](../research/xbuilder-boundaries/README.md)：固定版本的技术证据，不是所有版本的性能保证。
- [旧原型说明](../prototypes/runlab/README.md)：默认入口之后保留两个早期玩法的历史介绍。
- 发布记录：[首次纳管](releases/2026-10-24-git-baseline.md)、[纵向单关](releases/2026-10-24-belfry.md)、[战斗版](releases/2026-10-25-combat.md)、[v0.7 交付快照](releases/2026-10-25-v07-handoff.md)。

## 文档维护方法

改玩法时同步 PRD 与对应实现规则；改入口、依赖或命令时更新运行手册；新增实际验证写明日期、源码和报告；新增美术记录原图和提示词。CHANGELOG 记录版本结果，开发日志记录反馈与取舍，不把聊天原文或登录材料整体上传。

新提案先标注“未实装”，并给实施前的验证条件。历史记录不覆盖重写成当前结论；发现冲突时，在当前入口纠正参数，并在旧记录上补充阶段说明。
