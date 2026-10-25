# Git 工作流程

仓库：[RJ-SRE/EasyRun](https://github.com/RJ-SRE/EasyRun)。更新：2026-10-25。

本轮猎战重构位于 `feat/hunt-combat-v10`，从当前集成工作树的 `5575f20` 派生。保留既有提交、文档与证据，不重写主分支历史；该分支使用现有 Git 身份与 SSH。当前功能与验证入口为 [猎战说明](HUNT_V10.md)。

当前新增远征工作位于 `feat/expedition-boss-v2`，基线为 `main` 的 `6825943`。它包含三形态守心者、十五房与五支线的开发；完整路线和词汇容量尚在验证。下文第一节记录的是此前 v0.8.1 合入，不表示这次开发分支已经合入。功能分支提交用于保存可审查的开发进展，未完成项见 [开发清单](planning/thirty-word-expedition/IMPLEMENTATION.md)。

## 1. 当前分支与交付事实

- `main` 是默认交付分支，2026-10-25 合入 `feat/inscription-v1` 的完整集成版本。
- 合并前 main 为 `616297e`，功能分支为 `506c777`，后者完整包含 main 并领先 15 个提交。
- 本次采用保留两条父链的 merge commit，不压缩、不改写原提交；功能分支保留。合并提交另同步 README、PRD、运行说明与本流程的默认分支入口。
- 用户明确授权合入。GitHub 连接创建 PR 返回 403（Resource not accessible by integration），故使用现有 Git SSH 推送完成；没有创建 PR，没有改变仓库权限或分支保护。
- 没有创建版本标签、GitHub Release 或线上部署。原工作目录中其他聊天的分支与未提交内容不参与本次合并。

既有提交、原图和历史证据保留；不伪造作者、提交时间或中间版本。此前“最新版本只在功能分支”的记录属于合并前快照。

## 2. 继续当前版本

已有当前工作树时，先看状态再获取远程；有未提交改动时先确认归属，不能为拉取而重置或自动丢弃。

```sh
git status --short
git branch --show-current
git fetch origin
git log -5 --oneline
git rev-list --left-right --count HEAD...origin/main
```

干净的新检出可直接使用：

```sh
git clone --branch main https://github.com/RJ-SRE/EasyRun.git
cd EasyRun
```

新的开发从最新 `origin/main` 创建具名功能分支。先获取远程并确认工作区干净，不要以原集成分支的旧位置代替当前主线，也不要在有其他任务改动的工作区强行切换。

## 3. 每个改动的完成流程

1. 明确需求、当前基线与文件责任，先阅读 PRD / 对应规则。
2. 编辑源码或文档，保持生成目录可重建；不要只修运行清单。
3. 运行与改动有关的构建 / 测试 / 画面核对。纯文档只检查事实、命令、链接和格式。
4. 更新 CHANGELOG、开发日志及适用文档；结果与限制写清，不复用旧报告冒充新测。
5. 检查 diff，按一个可审查的行为变化提交源码、测试和文档。
6. 推送对应分支，确认本地提交与远程跟踪引用一致；报告提交号和分支。

```sh
git diff --check
git diff --stat
git diff
# 仅暂存已核对的文件
git add path/to/source path/to/document
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "feat(scope): describe the resulting behavior"
git push -u origin HEAD
git status --short
git rev-parse HEAD
git rev-parse @{upstream}
```

如远程有新提交导致推送被拒，先获取并审查差异，再正常合并双方工作与复测；不使用强推覆盖。不要为了整齐而重写已经共享的历史。

## 4. 文件与身份

| 类别                                                | 处理                                |
| --------------------------------------------------- | ----------------------------------- |
| 源码、锁文件、原始图集、提示词、声音母版 / 清单、MD | 纳入版本控制                        |
| 选定测试报告 / 截图 / 录像                          | 放 `docs/evidence/`，注明来源与源码 |
| 依赖、工具下载、缓存、普通测试输出、录音、环境配置  | 本地保留，受 `.gitignore` 排除      |
| 拆帧、生成工程 / 运行清单、`.xbp`                   | 脚本重建，不重复入库                |

使用当前仓库配置的提交身份，不改全局 Git 设置；本轮沿用原 RJ-SRE 身份。提交作者与推送认证是两件事，不用改作者来假装另一账户实际参与。聊天中的登录材料不写入文件、提交说明或日志。

多人 / 多 agent 协作先约定模块或隔离工作树，再检查实际 diff 和证据；文档不自动授权启动 agent，也不把另一任务的“已完成”当验收。

## 5. PR、CI 与 main 合入

PR 描述写最终问题、行为变化、验证与未覆盖部分，链接对应 MD。本次因连接缺少 PR 创建权限而直接使用 Git 合并，没有新 PR 编号；Issue 写权限失败的五条草稿按用户要求继续留在仓库，本轮不重试发布。

[verify.yml](../.github/workflows/verify.yml) 的实际触发为：

| 触发                           | 是否运行配置中的流程     |
| ------------------------------ | ------------------------ |
| push 到 main                   | 是                       |
| pull_request                   | 是                       |
| workflow_dispatch              | 可手动触发               |
| 仅 push 到 feat/inscription-v1 | 不会因这次 push 自动触发 |

工作流执行锁定依赖安装、测试浏览器安装、完整 game 构建、game lint、默认回归与四个工程包导出，产物保留 14 天；未单独运行 passages 全套或 legacy 两原型。工作流配置存在不代表 CI 已通过；本次没有把本地报告说成远程结果。

合入 main 前核对源码与 PRD、实际 CI、资源来源、可重建性与必要验证。默认通过 PR 完成审查；本次按用户明确授权、在 PR 接口不可用时使用 Git 正常合并与推送。主分支推送将触发现有工作流，状态须另行查看，不能把本地通过宣称为远程通过。仓库权限、可见性和分支保护保持原配置。

## 6. 版本与回退

`package.json` 的 0.8.1 描述当前系列；具体补丁用提交 SHA 定位。新增文档不是一次正式商业发布，不移动现有标签。以后创建附注标签或 Release 时，以实际完成的范围与验证记录为依据。

查看旧实现可用独立检出 / 工作树并从旧 SHA 构建，不把整个旧项目覆盖到正在工作的目录。共享代码的错误优先在当前分支使用 `git revert <sha>` 生成可审查撤回提交，再重建、验证和推送；回退多个有关联的功能先审查依赖，不盲目逐个撤销。详细历史入口见 [开发日志](DEVELOPMENT_LOG.md)。
