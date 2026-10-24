# EasyRun · 裂隙 RUPTURE

向下潜入倒悬钟城，钩住机械守卫与悬环，取回钟心，再沿正在崩塌的通道向上逃离。

当前默认版本为 **《裂隙 · 倒悬钟城》完整单关**，使用 XBuilder / spx 3.3.0，面向电脑浏览器与实体键盘。包含两档难度、两道钟门、两阶段核心战、返程、结局、检查点、合成声音和本机战绩。不是多关商业发行版，真人乐趣、首次游玩时长和跨设备性能尚待验证。

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
| J / S+J         | 斩击 / 空中坠星                    |
| K 或 Shift      | 冲刺，W 配合向上                   |
| Q               | 断弦，消耗 60 弦能                 |
| S+Space         | 下穿普通平台                       |
| Enter / Esc / R | 开始或检查点继续 / 暂停 / 从头重开 |

声音在用户开始后启用，可关闭。战绩只保存在当前浏览器；不需要登录。开场可选择旅人或无畏，操作指南中有完整说明。

## 构建与检查

```sh
bash scripts/with-env.sh pnpm game:build
bash scripts/with-env.sh pnpm game:test       # 自动启动独立测试服务
bash scripts/with-env.sh pnpm game:package    # Python 3，导出四个 .xbp
```

动作与特效的最新人工可检查资料见 [验证记录](docs/TESTING.md)。不要只修改生成目录；玩法源文件在 `prototypes/runlab/spx/belfry/`，场景与资源配置在 `prototypes/runlab/build-belfry.mjs` 与 `belfry-level.mjs`。

## 仓库历史

2026-10-23 的清理提交 `e8086bb` 及更早的英语跑酷 PRD、市场研究仍保留在 Git 历史。本次接续该提交纳管现有工作，没有覆盖或重写旧历史。2026-10-24 的集中整理按责任拆分提交；此前没有保存为 Git 的实现过程，以明确标注的开发日志补录。

源码原图、提示词、锁文件和选定证据入库；依赖、工具安装目录、拆帧副本、运行清单与导出包通过脚本重建。仓库公开可见不代表第三方依赖或生成素材已获任意用途的统一授权，素材来源见 [ASSETS.md](docs/ASSETS.md)。
