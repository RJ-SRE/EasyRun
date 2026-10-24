# Git 工作流程

仓库：<https://github.com/RJ-SRE/EasyRun>。主分支：`main`。本次以远程清理提交 `e8086bb` 为基线，接续旧历史；不创建一条覆盖旧提交的无关根历史。

## 1. 当前纳管策略

本次用户明确授权整理并推送现有工作。按以下责任拆分提交：开发环境与仓库约定、XBuilder 研究、早期对照原型、当前《裂隙》实现与资产、PRD/过程/路线、测试自动化与选定证据。全部属于同一天的集中纳管；提交时间真实，不假装是前一天或前几轮已经存在的代码版本。

本次可直接把整理后的提交以快进方式推到 `main`，前提是远程没有冲突变更。若远程前进，先获取并检查差异，在保留双方工作后再推送，不强制覆盖。

## 2. 后续每个需求的推荐流程

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/short-description
# 更新 PRD/任务条目，修改源文件
bash scripts/with-env.sh pnpm game:build
bash scripts/with-env.sh pnpm game:test
git status --short
git diff --check
git diff
# 只暂存本次需要的文件
git add path/to/source path/to/document
git diff --cached --stat
git diff --cached
git commit
git push -u origin feat/short-description
```

然后创建 PR，说明问题与最终行为，关联 PRD 编号，列出测试与观感证据，明确未验证部分。纯文档小改只需检查文档，不强制跑全部游戏测试。碰撞/输入/机关改动跑路线与生命周期；美术/动画再看录像。

## 3. 分支与提交

| 分支/类型 | 用途                   |
| --------- | ---------------------- |
| `main`    | 可复现、可说明的基线   |
| `feat/*`  | 新玩法、关卡或工具能力 |
| `fix/*`   | 已确认问题的修复       |
| `docs/*`  | PRD、路线、研究、记录  |
| `chore/*` | 依赖、构建、仓库维护   |

提交格式见 [CONTRIBUTING](../CONTRIBUTING.md)。尽量把相关源码和必要的测试放在同一提交；不要按文件扩展名机械切割一次功能。大规模导入可按责任批次提交，并在发布记录标明哪些提交共同构成可运行版本。

多人或多 agent 工作时，先约定文件/模块责任，必要时用独立分支/worktree。一个任务的审查、测试不能仅凭另一个任务“已完成”的描述，必须查看代码与证据。是否启用多 agent 由具体任务决定，不因为有流程文档就自动启动。

## 4. 验证与合入

GitHub Actions 在 push / pull_request 时执行安装、构建、当前回归、打包并保存产物。当前本地验证结果与远程 CI 结果分别报告；没看过的 CI 不能写“通过”。工作流文件本身不会自动创建分支保护规则。

本次不改变 GitHub 分支保护、访问权限或仓库可见性。后续可以按协作需要配置必需检查，但应作为单独设置变更。

合入前确认：PRD 与实现一致、测试结果可信、生成内容可重建、原始资产与提示词可追溯、没有混入无关个人文件。对低风险改动保持流程轻量，不写只镜像实现的测试。

## 5. 版本与发布记录

- 文档版本描述需求基线；Git 标签固定具体提交，两者不要混淆。
- 已存在标签 `v0.3.0-prototype` 保留原位置；v0.5 的提交与验收见 `docs/releases/2026-10-25-combat.md`。原型版本号不表示商业正式版。
- 使用附注标签记录变化及验证范围；推送标签不自动创建 GitHub Release，也不等于上线部署。
- 发布记录放在 `docs/releases/`，注明基线、范围、提交、验证和遗留问题。

```sh
git tag -a vX.Y.Z-prototype -F release-note.txt
git push origin main
git push origin vX.Y.Z-prototype
```

只有内容真实完成且标签尚未存在时才创建。不要移动已经发布的标签来掩盖问题。

## 6. 撤回与恢复

已共享的错误提交优先 `git revert <sha>`，形成新提交，再验证并推送。不对远程 main 执行强推或共享历史改写。需要查看旧方案可从旧提交创建独立分支，例如：

```sh
git switch -c inspect/old-prd bbc95e2
# 只查看历史；返回当前分支继续开发
```

不要为了恢复一份旧文档把整个旧项目覆盖到当前工作区。清理之前的 PRD 与研究仍在远程历史，入口见开发日志。

## 7. 身份与记录

本次使用已连接的 RJ-SRE 账户对应的 GitHub noreply 提交身份，仅配置当前仓库。提交作者是 Git 元数据，远程操作的认证主体由实际 Git 凭据或已连接服务决定，两者分别核验。登录材料不入库，也不把聊天原文整体当开发日志上传。
