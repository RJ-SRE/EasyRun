# EasyRun · 裂隙 RUPTURE

向下潜入倒悬钟城，钩住刺客与悬环，取回钟心，再沿正在崩塌的通道向上逃离。

当前默认版本为 **v0.7 铭文远征**，使用 XBuilder / spx 3.3.0，面向电脑浏览器与实体键盘。包含完整纵向单关、五类忍者刺客、四技能、两种英语挑战、30 词预览与本机进度、82 个动作/材质音效，以及可关闭英语的纯动作模式。规则见 [PRD](docs/PRD.md)，实现与验证边界见 [交付记录](docs/INSCRIPTION_V07.md)。

## 先看哪些文件

| 内容                              | 入口                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------- |
| 当前产品需求、范围与验收          | [docs/PRD.md](docs/PRD.md)                                                       |
| 研发过程、原始反馈与历史版本      | [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md)                               |
| 产品取舍                          | [docs/DECISIONS.md](docs/DECISIONS.md)                                           |
| 下一阶段路线与任务                | [docs/ROADMAP.md](docs/ROADMAP.md)                                               |
| 环境、构建与技术结构              | [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md)                             |
| 测试方法与已保存结果              | [docs/TESTING.md](docs/TESTING.md)                                               |
| 分支、提交、PR、标签与回退        | [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)                                     |
| 原始美术与生成提示词              | [docs/ASSETS.md](docs/ASSETS.md)                                                 |
| XBuilder 边界研究（历史技术证据） | [research/xbuilder-boundaries/README.md](research/xbuilder-boundaries/README.md) |

## 本地启动

需要 macOS 或 Linux、Git、Python 3。首次安装会下载项目固定版本的 Node、pnpm、spx 与 Playwright 浏览器。

```sh
git clone https://github.com/RJ-SRE/EasyRun.git
cd EasyRun
bash scripts/bootstrap.sh
bash scripts/with-env.sh pnpm game:build
bash scripts/with-env.sh pnpm game:dev
```

打开 <http://127.0.0.1:4177/>。上一版风机墓场为 <http://127.0.0.1:4177/rupture.html>，更早原型为 <http://127.0.0.1:4177/legacy.html>。XBuilder 固定源码仅用于研究，按需运行 `bash scripts/setup-xbuilder-reference.sh`，不影响游戏启动。

| 按键            | 功能                               |
| --------------- | ---------------------------------- |
| A/D、左右键     | 移动、空中转向                     |
| Space           | 跳跃 / 二段跳 / 蹬墙               |
| 按住 E，松开    | 牵引高亮目标，甩出；方向键辅助选点 |
| J / W+J / S+J | 三连与空中追击 / 挑空 / 坠星 |
| 按住 L，松开 | 蓄力重击、破甲、击退碰撞 |
| T（开场或暂停） | 排练场，1–5 单练 / 6 组合，R 返回冒险 |
| K 或 Shift      | 冲刺，W 配合向上                   |
| U / L / I / Q | 贯夜 / 断潮 / 回息 / 五段连环剑刀；冷却 3/5/5/10 秒 |
| F（牵引中） | 可选铭文解链 |
| 英文字母 / 1、2、3 | 铭文拼写 / 中文释义选择，题中 Esc 暂停 |
| S+Space         | 下穿普通平台                       |
| Enter / Esc / R | 开始或检查点继续 / 暂停 / 从头重开 |

当前已关闭主角与敌人的语音、对白及字幕。动作音效和环境音乐可独立调音量，无需在线服务。开场可分别选择战斗、词汇、节奏和提示难度，预览随机 30 词。正确释放增加本局已斩词数，通关只确认答对词；30 词不构成离场门槛。暂停后可保存进度回到标题，再从休整灯续玩。战绩与词册只保存在当前浏览器，不需要登录。

## 构建与检查

```sh
bash scripts/with-env.sh pnpm game:build
bash scripts/with-env.sh pnpm game:test       # 自动启动独立测试服务
bash scripts/with-env.sh pnpm game:package    # Python 3，导出四个 .xbp
```

铭文快速检查（已有开发服务时）：`bash scripts/with-env.sh pnpm game:test:words`。独立通道模块位于 `/passages.html`。

动作与特效的最新人工可检查资料见 [验证记录](docs/TESTING.md)。不要只修改生成目录；玩法源文件在 `prototypes/runlab/spx/belfry/`，场景与资源配置在 `prototypes/runlab/build-belfry.mjs` 与 `belfry-level.mjs`。

## 仓库历史

2026-10-23 的清理提交 `e8086bb` 及更早的英语跑酷 PRD、市场研究仍保留在 Git 历史。本次接续该提交纳管现有工作，没有覆盖或重写旧历史。2026-10-24 的集中整理按责任拆分提交；此前没有保存为 Git 的实现过程，以明确标注的开发日志补录。

源码原图、提示词、锁文件和选定证据入库；依赖、工具安装目录、拆帧副本、运行清单与导出包通过脚本重建。仓库公开可见不代表第三方依赖或生成素材已获任意用途的统一授权，素材来源见 [ASSETS.md](docs/ASSETS.md)。
