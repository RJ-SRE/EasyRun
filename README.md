# EasyRun · 裂隙 RUPTURE

在风暴中的机械遗迹里，夺取机器的动能，选择何时释放速度。风机会停转，桥梁会失压，升降机可以成为临时落脚点。

当前是 **XBuilder / spx 3.3.0 的二维动作跑酷可玩片段**，桌面浏览器、实体键盘操作。默认试玩《裂隙》，早期《盗速者》《一镜到底》保留为对照原型。目前熟练通关约 6–7 秒，不能代表完整关卡时长或商业验证结果。英语教学、语音、AI 对话和付费功能不属于当前版本。

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

打开 <http://127.0.0.1:4177/>。旧原型地址为 <http://127.0.0.1:4177/legacy.html>。XBuilder 固定源码仅用于研究，按需运行 `bash scripts/setup-xbuilder-reference.sh`，不影响游戏启动。

| 按键             | 功能                         |
| ---------------- | ---------------------------- |
| A / D 或左右箭头 | 移动                         |
| Space            | 跳跃，松开可缩短普通跳跃     |
| E / Shift        | 无动能时夺取；持有动能时释放 |
| W + E            | 向上释放动能                 |
| R                | 立即重试                     |
| Esc              | 暂停 / 继续                  |

音效默认关闭，可在页面打开。成绩和反馈只保存在当前浏览器，不需要登录。

## 构建与检查

```sh
bash scripts/with-env.sh pnpm game:build
bash scripts/with-env.sh pnpm game:test       # 自动启动独立测试服务
bash scripts/with-env.sh pnpm game:package    # Python 3，导出三个 .xbp
```

动作与特效的最新人工可检查资料见 [验证记录](docs/TESTING.md)。不要只修改生成目录；玩法源文件在 `prototypes/runlab/spx/rupture/`，场景与资源配置在 `prototypes/runlab/build-rupture.mjs`。

## 仓库历史

2026-10-23 的清理提交 `e8086bb` 及更早的英语跑酷 PRD、市场研究仍保留在 Git 历史。本次接续该提交纳管现有工作，没有覆盖或重写旧历史。2026-10-24 的集中整理按责任拆分提交；此前没有保存为 Git 的实现过程，以明确标注的开发日志补录。

源码原图、提示词、锁文件和选定证据入库；依赖、工具安装目录、拆帧副本、运行清单与导出包通过脚本重建。仓库公开可见不代表第三方依赖或生成素材已获任意用途的统一授权，素材来源见 [ASSETS.md](docs/ASSETS.md)。
