# 词境跑者 WordRunner

结合英语听力、口语表达与动作挑战的跑酷游戏。玩家可以通过按键或英语语音控制角色，并独立选择画面主题、英语水平和操作难度。

当前阶段：本地开发环境准备。已有环境检查页和自动化测试，尚未创建跑酷游戏；真人英语识别与 XBuilder 的动作接入需要验证。

## 产品文档

- [PRD v0.1](WordRunner_PRD_v0.1.md)：总体需求、动作与语音控制、教学设计、场景、三天开发排期和验收标准。
- [在线 PRD](https://chatgpt.com/space/page_421ab9c4133c8191963d6ed3a4fb88a6)
- [开发环境与工具清单](docs/ENVIRONMENT.md)
- [测试安排](docs/TESTING.md)
- [环境验证记录](docs/ENVIRONMENT_VERIFICATION.md)
- [受众、竞品与避坑研究（2026-10-23）](docs/research/MARKET_VALIDATION_2026-10-23.md)

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

远程仓库可在确定托管位置后配置。
