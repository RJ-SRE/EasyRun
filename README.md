# 词境跑者 WordRunner

面向成人英语初学者的氛围型动作冒险跑酷游戏。人类已经灭绝，精灵与机器人共同生活在自然和机械交织的遗迹中。玩家扮演非人类精灵信使，通过按键或英语语音穿越路线、理解场景线索并完成投递。冒险体验优先，英语帮助完成任务；画面主题、英语水平和操作难度独立选择。

当前阶段：开发环境、市场研究、美术方案与产品路线已准备；首批定位为成人英语初学者，暂不规划付费功能。已有环境检查页和自动化测试，尚未创建跑酷游戏；真人英语识别与 XBuilder 的动作接入需要验证。

## 产品文档

- [产品定义 v0.2](docs/PRODUCT_DEFINITION_v0.2.md)：当前定位、信使身份、游戏循环、英语的作用与首局体验。
- [产品路线 v0.1](docs/PRODUCT_ROADMAP_v0.1.md)：三天原型、成人体验验证、内容扩充与免费测试的阶段条件。
- [三天开发 Backlog](docs/DEVELOPMENT_BACKLOG_v0.1.md)：按依赖排序的开发任务与验收结果要求。
- [PRD v0.1](WordRunner_PRD_v0.1.md)：总体需求、动作与语音控制、教学设计、场景、三天开发排期和验收标准。
- [在线 PRD（初版快照，本轮受众与路线更新以本地文档为准）](https://chatgpt.com/space/page_421ab9c4133c8191963d6ed3a4fb88a6)
- [开发环境与工具清单](docs/ENVIRONMENT.md)
- [测试安排](docs/TESTING.md)
- [环境验证记录](docs/ENVIRONMENT_VERIFICATION.md)
- [受众、竞品与避坑研究（2026-10-23）](docs/research/MARKET_VALIDATION_2026-10-23.md)
- [成人市场机会与持续使用设计（2026-10-23）](docs/research/ADULT_MARKET_RETENTION_2026-10-23.md)：成人受众证据、复玩动机、三天内的体验重点与验证方法。
- [美术方向 v0.1 与成人审美概念图](docs/design/ART_DIRECTION_v0.1.md)：两套 P0 主题的视觉演进、角色、界面、资产预算和验证方法。
- [精灵与科技世界设计](docs/design/SPIRIT_TECH_WORLD_v0.1.md)：两种文明共存的风格探索、两主题演进与机关玩法候选。

## 开始开发

```sh
./scripts/wr doctor  # 检查环境
./scripts/wr dev     # 打开 http://127.0.0.1:5173
./scripts/wr check   # 执行检查、构建和浏览器测试
```

换机或首次安装运行 `./scripts/setup.sh`，详细前置条件见开发环境文档。项目独立使用 Node 24 / pnpm 11，保留本机全局版本。

## 版本记录约定

- 在本仓库保存需要追踪的需求、规划、设计和代码。
- 修改在线 PRD 后，同步本地文档再提交，保证 Git 中保留对应版本。
- 每完成一项可独立说明的规划或开发工作，创建一笔提交。
- `main` 保存项目基线；需要隔离开发时使用 `codex/` 前缀的分支。
- 提交说明可使用 `docs:`、`feat:`、`fix:`、`chore:` 前缀，并具体描述变化。
- 密钥和本地环境配置放在被忽略的 `.env` 文件中；配置示例使用不含真实凭据的 `.env.example`。

## 常用命令

```sh
git status
git diff
git log --oneline
```

远程仓库：[RJ-SRE/EasyRun](https://github.com/RJ-SRE/EasyRun)。主分支为 `main`，后续开发使用 `codex/` 功能分支。
