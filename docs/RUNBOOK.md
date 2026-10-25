# 本地运行、维护与交接手册

适用：`main` 的倒悬钟城 v0.8.1（已合入铭文、成就、五区与场景音乐）。更新：2026-10-25。以下命令都从仓库根目录执行；Windows 原生脚本和跨平台兼容性尚未验收。

## 1. 环境与第一次启动

| 项目                             | 固定值 / 用途                                    |
| -------------------------------- | ------------------------------------------------ |
| Node                             | 24.22.1，见 `.node-version`                      |
| pnpm                             | 11.9.0，见 `package.json`                        |
| spx                              | 3.3.0，本机网页中的引擎运行时                    |
| Playwright                       | 1.64.1，构建拆帧和浏览器测试                     |
| Python 3                         | 打包 `.xbp`；纯网页游戏运行不使用 Python         |
| Git / Bash / curl / tar / shasum | 检出、执行安装与校验 Node 下载                   |
| ffmpeg / ffprobe                 | 音频制作与视频处理工具，不是打开主游戏的前置依赖 |

```sh
git clone --branch main https://github.com/RJ-SRE/EasyRun.git
cd EasyRun
bash scripts/bootstrap.sh
bash scripts/with-env.sh node scripts/build-game.mjs
bash scripts/with-env.sh node prototypes/runlab/server.mjs
```

安装器支持 Darwin / Linux 的 arm64 和 x64；固定工具放在 `.tools/`，下载和浏览器缓存放在 `.cache/`，不要求切换系统默认 Node。Linux 上若浏览器提示缺少系统库，按 Playwright 报错安装相应系统依赖；不能把脚本列出平台等同于已在所有平台实测。

主页面 <http://127.0.0.1:4177/> 加载本地 spx 后显示开场设置。服务器是静态开发服务，没有数据库、登录、后端 AI 或密钥配置；第一次启动仍需先下载工具。无需运行音频生成或 XBuilder 编辑器才能游玩。

`scripts/setup.sh` 是更广的工具安装入口，会检查 ffmpeg 并下载 XBuilder 参考源码；`doctor.mjs` 也检查这些历史制作工具。只做网页游戏时，未安装参考源码导致 doctor 不通过，不等于游戏无法运行。不要为消除无关检查而修改系统环境。

## 2. 端口、页面与刷新

```sh
# 另选空闲端口；不必停止别的聊天正在使用的服务
RUNLAB_PORT=4184 bash scripts/with-env.sh node prototypes/runlab/server.mjs
```

服务器仅监听 `127.0.0.1`。查看终端的 `Runlab ready` 确认实际端口；`?v=achievements` 只是链接标记，不选择另一套源码。网页文件不热重载，修改后刷新浏览器；spx / 原图修改还须先构建。若多个检出目录同时运行，先确认启动命令的工作目录和端口，避免在旧服务里观察新代码。

| 页面                | 对应模块         | 额外要求                      |
| ------------------- | ---------------- | ----------------------------- |
| `/`、`/belfry.html` | 倒悬钟城         | 两份 HTML 保持一致            |
| `/passages.html`    | 独立回路遗迹     | 单独执行 `build-passages.mjs` |
| `/rupture.html`     | 风机墓场历史版   | 完整 game 构建包含            |
| `/legacy.html`      | 两款最早对照原型 | 完整 game 构建包含            |

浏览器存储按协议、主机和端口隔离。`localhost:4177`、`127.0.0.1:4177`、`127.0.0.1:4184` 的进度互不等同；换端口后看不到旧记录，不代表原记录已被删除。

## 3. 改哪里、构建什么

| 改动                           | 编辑源文件                                                   | 验证前执行                                  |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------- |
| 主角、敌人、技能、铭文引擎规则 | `prototypes/runlab/spx/belfry/`                              | `node prototypes/runlab/build-belfry.mjs`   |
| 地图坐标、锚点、出生点         | `prototypes/runlab/belfry-level.mjs`                         | 同上                                        |
| 图集导入、程序绘图             | `build-belfry.mjs` 与 `art/belfry/`                          | 同上；不要覆盖原图                          |
| 网页、词册、成就册、输入与混音 | `prototypes/runlab/public/` 对应 JS / CSS / HTML             | 刷新；若一起改了 spx，先重建                |
| 旧场景与共同原图拆帧           | `extract-frames.mjs`、`build-games.mjs`、`build-rupture.mjs` | `node scripts/build-game.mjs`               |
| 独立五通道                     | `spx/passages/`、`passages-level.mjs`、`build-passages.mjs`  | `node prototypes/runlab/build-passages.mjs` |

上表 `node` 命令前均加 `bash scripts/with-env.sh`。完整 `scripts/build-game.mjs` 依次拆基础动作和跑步图、生成两个旧原型、风机墓场与钟城；**不构建 passages**。

`projects/`、`public/*.json` 运行清单、`public/art/`、拆帧和 `exports/` 是生成目录。下次构建会覆盖它们；源代码、源图、锁文件、提示词和选定证据才是 Git 交付内容。

## 4. 验证命令

正常独立安装可使用 `package.json` 中的 `pnpm game:*`；下面的 Node 直调方式也适用于本次共享依赖的工作树。

```sh
# 完整默认回归：自动使用随机端口，不占用试玩服务
bash scripts/with-env.sh node scripts/test-game.mjs

# 纯规则，两个脚本均不需要启动浏览器服务器
bash scripts/with-env.sh node --test prototypes/runlab/test-inscription-core.mjs
bash scripts/with-env.sh node --test prototypes/runlab/test-belfry-achievements-core.mjs

# 已有 4184 服务时，运行本次主要专项
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-inscription.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-inscription-motion.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-inscription-resilience.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-achievements.mjs

# 独立通道与早期原型不混为同一套覆盖
bash scripts/with-env.sh node prototypes/runlab/build-passages.mjs
bash scripts/with-env.sh node scripts/test-passages.mjs
bash scripts/with-env.sh node scripts/test-game.mjs --legacy
```

统一回归包含规则、战斗、敌人、身法、技能、箭术、铭文、恢复、连续性、成就、生命周期、两档路线及旧风机检查。`--legacy` 改为最早两个原型；`--from=test-belfry-ninja.mjs` 可从指定套件续测，必须同时保留此前已经执行及失败的记录，不能只给续测结果写“全量通过”。

性能 / 动效测量单独运行，避免多个 WASM 浏览器互相争用资源。普通报告写在被忽略的 `prototypes/runlab/test-results/`；入库时只选择必要报告、截图与录像，并记录源码哈希。自动化独立浏览器不使用玩家真实存档。技能测试的确定性场景与整关真实按键路线分别说明，不互相冒充。

静态检查可执行 `bash scripts/with-env.sh pnpm game:lint`；共享依赖工作树使用等价 Node CLI：

```sh
bash scripts/with-env.sh node node_modules/eslint/bin/eslint.js prototypes/runlab/build-belfry.mjs prototypes/runlab/belfry-level.mjs prototypes/runlab/test-belfry*.mjs prototypes/runlab/public/belfry*.js prototypes/runlab/public/inscription*.js prototypes/runlab/public/cet4-words.js --max-warnings 0
git diff --check
```

纯文档整理检查 Markdown 格式、链接和事实，不为增加检查数量而重跑所有游戏路线。代码调整则按影响选择回归，具体历史结果见 [TESTING.md](TESTING.md)。

## 5. 打包与可交付范围

```sh
# 先构建四个主 / 历史游戏，再导出
bash scripts/with-env.sh node scripts/build-game.mjs
python3 prototypes/runlab/package.py

# 独立通道另行打包
bash scripts/with-env.sh node prototypes/runlab/build-passages.mjs
python3 prototypes/runlab/passages-package.py
```

输出在 `prototypes/runlab/exports/`。主打包生成 belfry / rupture / velocity / cinema 四个 `.xbp`，独立打包生成 passages。脚本验证 ZIP 与必要入口文件，不等于已经在完整 XBuilder 编辑器往返导入验证。

配套网页提供中文界面、音频混音、铭文、成就和本机记录；这些不包含在单个 `.xbp`。没有正式线上部署产物或自动云同步。编辑器参考源码用 `bash scripts/setup-xbuilder-reference.sh` 按需安装，参考版本锁定于研究脚本，不替换运行库。

## 6. 玩家记录与恢复

| 存储键                           | 内容                                         | 生命周期                   |
| -------------------------------- | -------------------------------------------- | -------------------------- |
| `easyrun-belfry-v1`              | 本机冒险战绩                                 | 结局记录；页面可导出       |
| `easyrun-inscription-v1`         | 内容版本、设置、词组、词汇历史、检查点与事务 | 词册导出；续玩从休整灯重建 |
| `easyrun-belfry-achievements-v1` | 成就最好进度、解锁日期、不同词 ID、佩戴称号  | 成就册导出；不补发旧战绩   |
| `belfry-audio-v2`                | 音效与音乐音量                               | 旧角色语音字段被忽略       |

刷新续玩不是逐帧存档，不恢复半个攻击或无伤完整冒险资格。存储损坏或受限时页面有提示并允许继续玩。导出是人工备份与查看 JSON，目前没有通用导入功能；迁移浏览器或清理站点数据前先保留需要的记录。不要在测试脚本中清除玩家真实浏览器的数据。

## 7. 常见问题

| 现象                                          | 检查与处理                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 提示 Node 缺失 / 版本不对                     | 从当前检出运行 `bootstrap.sh`；命令使用 `with-env.sh`，避免混用系统 Node                                                                                                            |
| 游戏 JSON 或背景 404                          | 核对分支、构建是否成功、服务器是否来自当前目录；重新构建后刷新                                                                                                                      |
| 端口已占用                                    | 使用 `RUNLAB_PORT` 另选端口；不批量结束其他任务进程                                                                                                                                 |
| 单独打包提示文件不存在                        | 先执行相应完整构建；`package.py` 同时需要四个游戏的生成目录                                                                                                                         |
| 浏览器提示 executable / headless shell 不存在 | 安装脚本只装 `--no-shell` 浏览器，部分测试使用默认启动。可用 `bash scripts/with-env.sh node node_modules/@playwright/test/cli.js install chromium` 补齐；Linux 缺系统库再按错误处理 |
| pnpm 要移除共享 node_modules、报无 TTY        | 本次工作树通过链接共享依赖；不要加 CI=true 强迫清理。改用本文 Node 直调命令，或在独立检出安装自己的依赖                                                                             |
| 新功能看不到                                  | 确认当前分支与端口；重建 spx 并刷新；URL 的 v 参数不能代替切换代码                                                                                                                  |
| 声音未响                                      | 先点击「播放音乐」或开始；检查声音开关、独立音量、后台 / 暂停状态与 soundDiagnostics.music。提示重试时确认 public/audio/music 下的 MP3 可访问。角色语音本来就停用                                                                                         |
| 打字时角色不移动                              | 这是受保护的模拟冻结；应有持续蓄势表现。Esc 可暂停 / 放弃 / 重开；若整个页面无响应，记录控制台错误与版本                                                                            |
| 成就没有增加                                  | 检查是否排练、是否实际命中、是否重复词、是否同一窗口 / 腾空；以成就详情条件为准                                                                                                     |
| 进度看似消失                                  | 先检查协议 / 主机 / 端口、浏览器配置及存储提示；不要直接清空站点数据                                                                                                                |

问题报告至少记录：提交 SHA、页面 / 端口、设备和浏览器、操作序列、预期 / 实际结果、是否可重复。截图或报告写入本地测试输出，选定后再纳入证据。日志不得包含凭据或玩家个人资料。

## 8. 本轮交接检查

`a97d2f8` 的成就证据属于取消免题续招前的历史快照，不能当成当前代码的新验证。最新变更的实际复测范围与结果见 [验证文档](TESTING.md) 末尾。提交、CI 和回退见 [Git 流程](GIT_WORKFLOW.md)。

## v0.8 城市专项与入口核对

```sh
bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs
RUNLAB_URL='http://127.0.0.1:4184/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-city.mjs
```

城市专项使用独立浏览器和响应副本中的可复现场地，不影响实际玩家存档；完整测试入口也包含此项。当前 Belfry 构建输出 401 文件 / 58 精灵。主页面标题栏为回声之城 / FIVE DISTRICTS，首台有可交互风阀和城中纪事按钮。若仍见旧版，先确认服务工作目录和重新构建，再刷新原标签页；不要仅凭端口或 URL 查询参数判断代码版本。

当前协作工作树为 /Users/rj/.codex/worktrees/inscription-integration/七牛黑客松。同机其他目录属于并行工作，不能覆盖它们来更新此页面。
