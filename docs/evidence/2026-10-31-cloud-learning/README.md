# 本地学习联调验收 · 2026-10-31

版本：0.17.0-local.1。工作树：`feat/adaptive-wordbook-local`。未提交、未推送远程。

> 2026-10-31 local.2 更新：本目录的两份 `native-http-*.json` 与 `native-cloud-*.png` 已由稳定身份回归覆盖，当前报告均为 12 项通过并对应新包 SHA；下面 10 项是 local.1 当时的基线数量。当前导入包与改名验证请查看 [稳定身份验收](../2026-10-31-stable-identity/README.md)。其他 local.1 记录保留原始结果。

## 通过的检查

| 检查 | 结果 | 证据 |
|---|---|---|
| 后端规则、批次与 HTTP 集成 | 17 项通过 | `backend-tests.txt` |
| 原生 HTTP 保存与恢复（npm） | 10 项通过 | `native-http-integration.json` |
| 原生 HTTP 保存与恢复（XBuilder 缓存运行器及模型往返） | 10 项通过 | `native-http-xbuilder-snapshot.json` |
| npm 固定原生运行器词册回归 | 25 项通过，无运行错误 | `native-words-npm.json` |
| XBuilder 缓存编译器/资源词册回归 | 25 项通过，无运行错误 | `native-words-xbuilder-snapshot.json` |
| 原生菜单、暂停、结算、窗口和高 DPI | 15 项通过 | `native-shell.json` |
| 原生 JSON / HTTP / 用户名能力 | 三个本地运行探针完成；HTTP 200 | `native-capabilities.json` |
| 原生方法迁移回归 | 4 项通过 | `test_native_runtime.py` |
| 新增 JS 与相关构建代码 lint | 通过 | ESLint，无忽略错误的配置 |
| 旧词库发布拦截 | 符合预期，拒绝发布 | `release-gate.txt` |

原生学习新增黄金向量直接执行打包后的 XGo 方法，核对未练题型优先、拼写/辨义独立、辅助正确 1000→800、同题只结算一次、平局交替、紧急辨义、四个候选池筛选和 R 保留词组。测试注入的按键与黄金向量不写入交付 `.xbp`。

后端测试包括失败继续与胜利、相同批次重试、变更批次拒绝、跳序/旧版本拒绝、双账号隔离、接管、坏档案保护、8,815 条历史、小回包、丢失上传响应恢复、重新打开日志后的未知写入阻断、重试时刻、迟到回调，以及真实本机 HTTP 下 100 批共 2,000 次作答与已确认队列引用清理。身份和 Kodo 使用测试替身，不代表已经取得平台授权或完成真实七牛联调。

## 环境与限制

- npm 原生运行器：项目固定 `@xgo-pkgs/spx` 3.3.0。
- XBuilder 对照：`.cache/xbuilder-online-20261026` 的编译器和资源，配合 `https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js` 项目模型。它是缓存部署快照，不是对 2026-10-31 网站当前部署、真实发布页和身份能力的认证。
- 原生测试通过 loopback 本地服务器加载独立包；没有更改线上作品。
- 词册截图已人工查看；新增“拼/义”行与中文释义分开，分页避免文字截断。
- 原生测试中的克隆数上限检查通过；这些功能测试不是 PRD 的三轮 120 秒性能对照，也不证明云同步主线程/内存指标。

## 交付与待办

`artifact.json` 记录最终游客联调包路径、大小和 SHA-256。包内 `native-learning-manifest.json` 明确 `cloudEnabled:false`、`releaseReady:false`；不会以用户名创建或上传个人档案。

原生传输绑定和保存状态 UI 已接本地测试服务：支持断线补存、2000 条有界队列、账号隔离与重新运行后的读取。仍待正式条件：XBuilder 应用授权与宿主身份入口、私有 Kodo/HTTPS/CORS 实测、新常用词库来源和全量内容审核，以及 PRD 的线上延迟、内存与帧间隔预算。详细说明见 [本地版本交付](../../CLOUD_LEARNING_LOCAL.md) 和 [学习服务](../../../services/learning/README.md)。

## 原生端到端证据

`test-belfry-native-learning.mjs` 直接加载最终包，通过内存测试覆盖层传入临时游戏会话，真实调用 XGo HTTP，写入临时本地档案。包括：游客中途登录及 R 归属、准备 30 个不重复词、检查点丢失确认后的原批重发、请求期间继续作答、失败与通关、账号切换、迟到回执隔离、重新启动后的明确接管及历史恢复、2,000 条积压的有界分批补存。每批检查不超过 32 KiB。

`native-cloud-ready.png`、`native-cloud-saved.png`、`native-cloud-conflict.png` 记录原生准备、保存汇总和写入权冲突的 UI。截图与报告不含凭证；测试源码注入层不进入交付包。结算截图使用测试事件模拟失败，不代表实战击破统计。

默认原生包没有服务地址或测试账号；配置模板中的身份字段保持空白，默认服务拒绝建立未经平台验证的游戏会话。本次没有真实用户云写入，没有提交或推送 GitHub。

2026-10-31 local.4 说明：本目录 `native-http-integration.json` 已再次更新为用户名功能加入后的 verified-id 兼容回归。该报告的归档副本及对应新包 SHA 见 [用户名档案验收](../2026-10-31-username-profiles/README.md)；本目录其余历史报告不代表新包重跑结果。
