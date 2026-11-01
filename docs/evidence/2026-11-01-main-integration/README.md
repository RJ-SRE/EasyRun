# v0.22.2 主分支集成 · 2026-11-01

将开发分支 `feat/adaptive-wordbook-local` 的 `9f5cc76` 合入主分支 `d454647`。保留两个父提交和原始作者，不 squash、不改写历史、不强推。唯一冲突为 README，保留主分支最新整理、作者署名、视频和在线体验入口，并将启动与文档链接改为 main。

相对开发分支，本次只改交付文档和新增此验收记录；游戏源码、资源、词库和构建配置逐路径与原开发分支一致。三人交接改为从 `origin/main` 建任务分支、向 main 提 PR。旧功能验收中“本地交付／未推送”保留为当时事实。

## 本次实际检查

- 18 项规则测试全部通过：词源哈希与成员、普通／困难／挑战／随机分组、选词配额、重试、新远征、旧存档迁移、独立拼写／辨义记忆及 24 项英语成就。
- 内容发布校验通过：`common-ngsl-nawl-2026-11-01.1`，3,816 词，`releaseChecks: true`。
- 完整 `game:lint` 的 ESLint 参数检查通过；使用现有项目 Node 与依赖，不重新安装依赖。
- 核对合并索引：无未解决冲突，运行源码与原开发分支一致；检查文档路径、README 锚点、命令入口及 Git 空白格式。

```sh
bash scripts/with-env.sh node --test prototypes/runlab/test-inscription-core.mjs prototypes/runlab/test-common-content.mjs prototypes/runlab/test-learning-milestones.mjs
bash scripts/with-env.sh node services/learning/check-content.mjs services/learning/content-common
```

ESLint 实际展开 `package.json` 中 `game:lint` 的文件通配符，并以 `bash scripts/with-env.sh node node_modules/eslint/bin/eslint.js ... --max-warnings 0` 运行相同参数。

本次没有重新构建 `.xbp`、重新发布 XBuilder 在线作品或重跑浏览器／原生交互测试。运行代码没有改变，沿用此前真实验收；历史证据与限制见 [上一轮交接验收](../2026-11-01-git-handoff/README.md)。机器可读结果见 [checks.json](checks.json)。
