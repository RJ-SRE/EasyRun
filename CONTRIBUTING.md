# 开发与 Git 约定

当前需求入口为 [PRD](docs/PRD.md)，推进顺序为 [路线与任务](docs/ROADMAP.md)，完整操作见 [Git 流程](docs/GIT_WORKFLOW.md)。这里记录后续工作的默认约定，具体任务中用户明确指定的范围优先。

## 一个改动如何完成

1. 先核对需求基线。当前最新可玩版在 `feat/inscription-v1`，继续该版本时沿用它或从其最新提交创建短期分支；合入 main 之后，新需求再从最新 main 出发。不要在有其他任务改动的工作区强行切换。
2. 需求变化先标明 PRD 条目与验收方式；重要取舍更新决策记录。
3. 修改源文件，重建生成内容。不要只修改 `projects/` 或生成的 JSON。
4. 跑与改动有关的检查；动作与美术修改还要检查实际画面/录像。
5. 按可解释的改动单元提交，写清问题、结果和验证。保留失败及限制的真实记录。
6. 推送分支，在 PR 中说明对应需求、测试结果和剩余问题；通过检查后再合入 `main`。

## 提交格式

`类型(范围): 具体结果`。例如：

- `feat(level): add an optional upper route to the lift shaft`
- `fix(motion): preserve animation timing when landing from a dash`
- `docs(prd): define the 60–90 second slice acceptance criteria`
- `test(rupture): cover retry while capture effects are active`

常用类型：`feat`、`fix`、`docs`、`test`、`refactor`、`chore`。提交正文说明为何修改、验证命令和未验证部分。不要为了“好看的历史”伪造作者、日期或已经不存在的中间实现。

## 源文件与产物

- 纳管：源码、锁文件、原始美术、生成提示词、文档、选定的验证证据。
- 重新生成：拆帧纹理、spx 工程目录、运行清单 JSON、`.xbp` 包。
- 本地保留：安装工具、依赖、下载缓存、普通测试输出、录音与环境配置。
- 公共记录保存在 `docs/evidence/`；提交前选择必要文件并检查内容，不把整个临时目录直接加入 Git。

当前版本使用仓库级 Git 身份配置；不修改全局设置，不把登录材料写进源码或文档。自动化测试通过独立浏览器上下文运行，不改变实际玩家的本机记录。

## 文档与交接

文档导航见 [总目录](docs/README.md)，命令与故障处理见 [运行手册](docs/RUNBOOK.md)。PRD 写当前行为，设计稿标注未实装，开发日志保留反馈与过程，发布记录固定交付范围。报告注明测试基线；纯文档改动核对已有证据与源码哈希，不把旧测试日期改成本次日期。
