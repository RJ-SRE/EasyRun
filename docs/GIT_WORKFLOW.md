# Git 工作流程

仓库：[RJ-SRE/EasyRun](https://github.com/RJ-SRE/EasyRun)。更新：2026-10-25。

## 1. 当前分支与交付事实

- `main` 是远程默认基线；本轮核对时指向 `616297e`。
- 最新倒悬钟城集成、界面、余响与成就在 `feat/inscription-v1`，本轮文档整理从 `a97d2f8` 继续提交并推送。
- 核对时功能分支包含 main 的全部历史，并领先 8 个提交；此数字是整理前快照，不是长期固定值。
- 本次没有把功能分支合入 main，没有创建版本标签、GitHub Release 或线上部署。
- 原工作目录还有其他聊天的开发内容；继续使用当前独立工作树，不复制整目录、不混入未核对的改动。

2026-10-24 首次集中纳管曾接续清理提交 `e8086bb` 直接快进 main，这是历史做法，不是本轮推 main 的指令。既有提交、原图和历史证据保留；不伪造作者、提交时间或中间版本。

## 2. 继续当前版本

已有当前工作树时，先看状态再获取远程；有未提交改动时先确认归属，不能为拉取而重置或自动丢弃。

```sh
git status --short
git branch --show-current
git fetch origin
git log -5 --oneline
git rev-list --left-right --count HEAD...origin/feat/inscription-v1
```

干净的新检出可直接使用：

```sh
git clone --branch feat/inscription-v1 https://github.com/RJ-SRE/EasyRun.git
cd EasyRun
```

若当前版本的后续需求需要独立审查，可从已核对的 `origin/feat/inscription-v1` 创建具名分支；等它合入 main 后，新的需求再从最新 main 出发。不能机械从旧 main 新建分支后误以为包含铭文和成就。

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
git push origin feat/inscription-v1
git status --short
git rev-parse HEAD
git rev-parse origin/feat/inscription-v1
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

PR 描述写最终问题、行为变化、验证与未覆盖部分，链接对应 MD。当前没有可报告的新 PR 编号；Issue 写权限失败的五条草稿按用户要求继续留在仓库，本轮不重试发布。

[verify.yml](../.github/workflows/verify.yml) 的实际触发为：

| 触发                           | 是否运行配置中的流程     |
| ------------------------------ | ------------------------ |
| push 到 main                   | 是                       |
| pull_request                   | 是                       |
| workflow_dispatch              | 可手动触发               |
| 仅 push 到 feat/inscription-v1 | 不会因这次 push 自动触发 |

工作流执行锁定依赖安装、测试浏览器安装、完整 game 构建、game lint、默认回归与四个工程包导出，产物保留 14 天；未单独运行 passages 全套或 legacy 两原型。工作流配置存在不代表 CI 已通过；本次没有把本地报告说成远程结果。

合入 main 前核对源码与 PRD、实际 CI、资源来源、可重建性与必要验证。当前整理不改变仓库权限、可见性或分支保护，也不默认合并 PR。

## 6. 版本与回退

`package.json` 的 0.7.0 描述当前系列；具体补丁用提交 SHA 定位。新增文档不是一次正式商业发布，不移动现有标签。以后创建附注标签或 Release 时，以实际完成的范围与验证记录为依据。

查看旧实现可用独立检出 / 工作树并从旧 SHA 构建，不把整个旧项目覆盖到正在工作的目录。共享代码的错误优先在当前分支使用 `git revert <sha>` 生成可审查撤回提交，再重建、验证和推送；回退多个有关联的功能先审查依赖，不盲目逐个撤销。详细历史入口见 [开发日志](DEVELOPMENT_LOG.md)。
