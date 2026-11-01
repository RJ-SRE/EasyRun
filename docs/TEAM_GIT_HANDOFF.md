# EasyRun 三人协作与 Git 提交说明

更新：2026-11-01 · 仓库：[RJ-SRE/EasyRun](https://github.com/RJ-SRE/EasyRun) · 当前开发版本：v0.22.2-local.1。

本说明可以直接转发给三位同事。RJ-SRE 负责核心开发、整体设计和最终集成；mdyqwe 与使用 `leoweng@foxmail.com` 的同事负责边界清楚的小功能、界面细节及验证文档。各人使用自己的 GitHub 授权和本人已验证的提交邮箱，提交自己实际完成的修改。

## 1. 当前交接状态：先拿到同一份代码

当前完整开发分支是 [`feat/adaptive-wordbook-local`](https://github.com/RJ-SRE/EasyRun/tree/feat/adaptive-wordbook-local)，已于 2026-11-01 使用 RJ-SRE 的 SSH 授权推送到 GitHub。代码快照为 `645d9f5`，文档与验收归档为 `501cc92`，其后补充本次发布状态文档。最新提交以 `git log -3 --oneline` 为准。本次未合并 `main`，未修改仓库权限。

远程 `main` 尚未包含当前完整功能；同事不能只拉 main 就认为拿到了 v0.22.2。RJ-SRE 的集成分支已发布；两位同事的登录、开发分支推送和 PR 仍由本人自行执行。

RJ-SRE 已完成首次发布。后续更新仍先核对状态与验证结果，再正常推送同一分支：

```sh
git switch feat/adaptive-wordbook-local
git status --short
git log -2 --oneline
git push -u origin feat/adaptive-wordbook-local
```

首次发布包含此前 15 条开发提交与本轮 2 条整理提交，全部保留原 RJ-SRE 作者信息，随后补充发布状态文档。推送整条分支会一并发送其尚未在远程的祖先提交，不需要逐条 push。两位同事的贡献从本人实际完成的新任务开始。

同事现在可以按本文后续步骤获取该分支。在它合入 main 前，新任务都从 `origin/feat/adaptive-wordbook-local` 派生，PR 的目标也选这个集成分支。待 RJ-SRE 验收并合入 main 后，新任务统一从最新 `origin/main` 派生，PR 目标改为 main。

## 2. 三人的责任与文件边界

| 账号／身份                   | 主要责任                                                                       | 首选修改范围                                                                                                                                                        | 需要 RJ-SRE 一起审查的改动                                     |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| RJ-SRE                       | 产品与美术方向、战斗／Boss、关卡、性能、词库规则、本地存档、原生导出、最终集成 | `spx/belfry/` 核心逻辑、`build-belfry*.mjs`、`native_runtime.py`、`native_viewport.py`、`inscription-core.js`、`inscription-storage.js`、构建脚本、包版本与核心 PRD | 发布范围、数据迁移和核心规则由本人统筹                         |
| mdyqwe                       | 小型界面设计与开发、交互反馈、窄窗口适配、轻量视觉细节                         | `public/belfry-menu.css`、`public/learning-rails.css`、`public/inscription.css`、对应界面测试、`design/` 内新任务稿与说明                                           | 修改共享 JS 状态、原生 UI 命中区域、存档格式或重新制作角色动作 |
| leoweng@foxmail.com 对应同事 | 文档、操作与验收流程、定向回归、简单提示与易用性修复                           | `docs/`、`test-belfry*.mjs`、`test-learning*.mjs`、小范围文案及其测试                                                                                               | 游戏规则、学习统计、音频状态机、构建配置及依赖变更             |

`leoweng@foxmail.com` 是邮箱，不据此假定其 GitHub 用户名为 leoweng。请该同事在接任务时补充实际 GitHub 用户名，并在本人 GitHub 上验证邮箱。mdyqwe 的提交邮箱也由本人从 GitHub 设置中确认，不能替他猜测 noreply 地址。

职责是优先分工，不是现已配置的 GitHub 文件权限。普通协作者权限不会自动按目录限制写入；文件边界靠任务约定和 PR 审查落实。仓库所有者应确认两位同事已被邀请并接受协作权限；没有直接写入权限时，使用本人 fork 提交 PR。

## 3. 可以直接领取的第一批小任务

以下是建议的新任务，不代表历史功能尚未实现，也不是要求通过空提交领取贡献。先对照当前代码确认问题实际存在；每项独立验收。

| 负责人       | 新任务建议                                           | 完成标准                                                                                     |
| ------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| mdyqwe       | 统一远征设置按钮的 hover、键盘焦点与禁用态           | 与微透玻璃／旧铜边线风格一致；键盘可达；不改变存档、随机选词和默认音量                       |
| mdyqwe       | 检查词册与成就页在窄窗口下的滚动、长文案及按钮可达性 | 提供 1280、650、480 像素宽截图；关闭、翻页均可操作；没有遮挡新问题                           |
| leoweng 同事 | 新增“首次启动与导入 .xbp”的新同事验收单              | 用本人环境验证一次启动／导入，记录版本、真实命令、结果和限制；发现问题再创建修复提交         |
| leoweng 同事 | 补充本地清除操作的定向回归或排障文档                 | 仅使用独立测试档案，覆盖取消、成功、重开、另一用户保留；若已有覆盖，补实际缺口，不复制原测试 |
| RJ-SRE       | 检查上述小任务的网页与原生一致性并整合版本           | 核对核心规则、保存兼容、资产来源与集成结果；统一处理冲突和最终版本号                         |

同一轮中不要让两人同时编辑 `NativeShell.spx`、`NativeWords.spx`、`build-belfry-native.mjs` 等共享入口。需要跨模块时，先在任务说明中写出改动文件和负责人。

## 4. 每人准备自己的身份与授权

每位同事使用独立 clone，避免在同一目录来回修改 user.email。Git 的作者姓名／邮箱用于提交归属；GitHub 登录或 SSH 密钥用于远程操作权限。由另一个账号 push 已有提交，不会把提交作者改成该账号。

### RJ-SRE

现有本地仓库使用以下身份，继续保留：

```sh
git config --local user.name "RJ-SRE"
git config --local user.email "148342551+RJ-SRE@users.noreply.github.com"
```

### mdyqwe

先把下面占位邮箱替换为本人 GitHub Settings → Emails 中已验证的地址或页面提供的 noreply 地址，不能原样执行占位值：

```sh
git config --local user.name "mdyqwe"
git config --local user.email "替换为本人已验证的提交邮箱"
```

### 使用 leoweng@foxmail.com 的同事

姓名一项使用本人实际姓名或 GitHub 用户名；邮箱需已在对应 GitHub 账号中验证。若要隐藏公开邮箱，改用该账号设置页面提供的 noreply 地址：

```sh
git config --local user.name "替换为本人姓名或GitHub用户名"
git config --local user.email "leoweng@foxmail.com"
```

三人各自检查：

```sh
git config --local --get user.name
git config --local --get user.email
git var GIT_AUTHOR_IDENT
git remote -v
```

已安装 GitHub CLI 的同事可以使用浏览器授权 HTTPS，不把密码或 Token 写进仓库：

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git --hostname github.com
gh api user --jq .login
```

最后一条输出应是本人账号。已配置本人 SSH 的同事可继续使用 SSH；以上为 HTTPS 路线，不要求两套同时配置。不要在共享机器上来回切换三人的登录状态，优先使用各自机器和凭据。

GitHub 使用提交邮箱关联账号，邮箱验证、noreply 与本地配置方式见 [GitHub 提交邮箱说明](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)。CLI 参数见 [gh auth login](https://cli.github.com/manual/gh_auth_login) 和 [gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git)。

## 5. 同事领取任务并建分支

以下命令在独立新目录执行。先确认 RJ-SRE 已发布第 1 节集成分支。

```sh
git clone https://github.com/RJ-SRE/EasyRun.git
cd EasyRun
git fetch origin
git status --short
```

当前尚未合入 main 时，mdyqwe 的示例：

```sh
git switch -c codex/mdyqwe/menu-focus origin/feat/adaptive-wordbook-local
```

leoweng 同事的示例：

```sh
git switch -c codex/leoweng/onboarding-checklist origin/feat/adaptive-wordbook-local
```

这里的 leoweng 只是任务分支标识，不代表已确认 GitHub 用户名。RJ-SRE 的新任务可用 `codex/rj-sre/<task>`。每条分支只做一项可审查任务，不提交与任务无关的其他人的改动。

当前版本正式合入 main 后，后续任务改用：

```sh
git fetch origin
git switch -c codex/mdyqwe/new-task origin/main
```

首次环境安装和运行按仓库 [README](https://github.com/RJ-SRE/EasyRun/blob/feat/adaptive-wordbook-local/README.md) 与 [运行手册](https://github.com/RJ-SRE/EasyRun/blob/feat/adaptive-wordbook-local/docs/RUNBOOK.md) 执行；不要把另一个人的 `.tools`、`node_modules` 或私人配置当源码复制进仓库。

## 6. 开发、检查、提交与推送

先在任务或 PR 写清问题、预期行为、修改文件、验收方式。UI 改动同时检查网页和 `.xbp` 的对应控件；无法验证某端时要说明，不把单端截图写成双端通过。

按修改范围选择检查：

| 改动                 | 最低检查                                                       |
| -------------------- | -------------------------------------------------------------- |
| 文档、提示文案       | 命令／路径／链接真实，`git diff --check`，需要时实际走一次流程 |
| 网页菜单／样式       | 相关 Playwright 用例、宽窄窗口截图、键盘操作                   |
| 学习规则／词库／成就 | 下方纯逻辑测试；涉及存储或界面时补对应浏览器测试               |
| 原生 UI／导出        | 实际重建 `.xbp` 并导入运行，核对命中区域、字形、音乐及读档     |
| Boss／技能／性能     | 由 RJ-SRE 组织对应战斗和帧时间回归                             |

纯逻辑检查命令：

```sh
bash scripts/with-env.sh node --test prototypes/runlab/test-inscription-core.mjs prototypes/runlab/test-common-content.mjs prototypes/runlab/test-learning-milestones.mjs
```

实际提交只加入本任务文件，下面路径是示例，按自己的改动替换：

```sh
git status --short
git diff --check
git diff --stat
git diff -- prototypes/runlab/public/belfry-menu.css
git add prototypes/runlab/public/belfry-menu.css
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "fix(menu): keep settings focus visible over the scene"
git log -1 --format=fuller
git push -u origin HEAD
```

作者信息或文件范围有误时先停止提交／推送并检查本地配置。共享后的历史不为“分配贡献”改作者、不改提交时间，也不制作无实际修改的空提交。

建议前缀：`feat` 新功能、`fix` 修复、`style` 视觉、`test` 验证、`docs` 文档、`perf` 性能、`chore` 仓库维护。例如：`test(storage): verify reset keeps another local profile`，需实际加入相应测试后使用该说明。

## 7. PR、交叉审核与合并

推送后创建 PR，当前过渡期目标为 `feat/adaptive-wordbook-local`；完整版本合入后目标为 main。

PR 正文可直接用：

```text
问题：什么情况下出现什么问题。
修改：最终行为有什么变化，涉及哪些页面或模块。
验证：实际执行的命令、结果，必要的前后截图。
范围：哪些平台已测，仍有哪些限制。
```

mdyqwe 与 leoweng 同事先互查操作／文档，再由 RJ-SRE 审查核心影响和集成；RJ-SRE 的主要改动由另一位同事走一次实际验收，再统一处理。建议一条 PR 一个目的，完成验证再合并，不为增加账号提交数量拆成无意义提交。

PR 与集成遵循 [Git 工作流程](https://github.com/RJ-SRE/EasyRun/blob/feat/adaptive-wordbook-local/docs/GIT_WORKFLOW.md)。优先保留同事的原始提交及作者；最终合并方式由 RJ-SRE 结合仓库设置确定。若使用 squash，注意核对真实共同作者信息，不机械添加他人署名。

推送因远程领先而拒绝时，先 `git fetch origin`，审查双方改动并正常合并／解决冲突，再复测推送。不使用强推覆盖其他人的分支或 main。核心版本完成合入前，不让两位同事重复推送同一份旧代码来表示参与。

## 8. 什么入库，什么留在本地

纳入 Git：源码、测试、PRD 与设计说明、可重建的原始资产、来源／许可记录、选定的验收报告和截图。

本地保留：`.local/`、`.env` 实际配置、密钥、用户档案、依赖、工具缓存、生成工程、普通测试输出和 `.xbp` 导出包。`.xbp` 的交付另附实际版本与 SHA-256；不能只上传生成包而漏掉源码。

现有 `docs/evidence/` 同时包含历史设计和后来撤回的方案。新同事以当前 README、对应版本文档和当前代码为准，不把历史策划或旧截图当现行功能。资源来源说明随资产保留。

## 9. 每次完成后发给负责人的信息

```text
负责人／GitHub 用户名：
任务：
分支：
提交 SHA：
PR 地址：
修改文件与结果：
实际验证：
未覆盖或需协助的部分：
```

RJ-SRE 收到后确认远程确实存在该提交，再安排审查／合并。本次仅发布 RJ-SRE 的集成分支及交接文档；两位同事的协作者邀请、权限确认、登录与新任务提交仍需各自完成。
