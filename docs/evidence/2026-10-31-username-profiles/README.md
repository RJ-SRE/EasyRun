# 用户名档案验证 · 2026-10-31

版本：0.17.0-local.4。按用户最新要求采用名称关联，无平台身份验证；未提交或推送远程。

| 检查 | 结果 | 证据 |
|---|---|---|
| 后端学习、存储、身份与名称规则 | 26 项通过 | `backend-tests.txt` |
| 实际运行器用户名 → 名称会话 → 本地持久化 | 9 项通过 | `native-name-xbuilder-local.json` |
| 实际运行器用户名 → 名称会话 → 真实七牛 | 9 项通过 | `native-name-xbuilder-kodo.json` |
| 原有 verified-id 原生保存回归 | 12 项通过 | `verified-mode-regression.json` |
| 常驻本机后端模式 | kodo / username / loginAvailable=true / identityConfigured=false | `service-health.json` |
| 包内容与副本一致性 | 已检查 | `artifact.json` |
| 本次 JS ESLint 与 git diff --check | 通过 | 本地执行 |

后端新增两组测试包括名称规范化、空值/控制字符/长度限制、实际 HTTP 名称会话、同名恢复、改名新档、不同身份模式的 HMAC 键与会话用途隔离。测试同时明确验证“其他请求者提供同名会得到同一档案”，以记录该模式的信任限制，不把它冒充安全账号认证。

原生测试采用 XBuilder 缓存编译器/资源（2026-10-26）与官方项目模型往返。通过运行器实际 `xbuilder_set_username` 接口注入合成名称，游戏用自身代码读取 `username` 并向服务申请会话；没有注入预签名的游戏会话，也没有手动调用 `nativeCloudAttach` 绕过名称流程。

九项原生用例：

1. 空用户名不请求名称会话，直接游客。
2. 战斗中出现用户名及 R 重开保持游客，返回标题自动准备名称档案。
3. 同名大小写/两端空格变化、刷新凭证，不重新抽词。
4. 拼写与辨义记录通过原生 HTTP 保存；重新读取实际存储验证。
5. 战斗中改名不影响原局，标题切换新档案，旧记录保留。
6. 旧名称会话的迟到响应不能切回旧档案。
7. G 持续游客、N 重连、运行器退出登录停止使用名称档案。
8. 新运行器以同名重新进入，显式接管后恢复历史。
9. 名称服务暂时失败自动重试，等待期间不能以旧名称开始新远征。

真实云测试只使用本轮随机 `rupture/learning-tests/.../users/`，四个测试对象全部删除并检查不存在，见报告 `cleanup`。没有访问或写入正式玩家路径。截图 `native-name-ready.png` 为合成名称测试的标题状态。

两个名称运行报告及兼容回归的 archiveSha256 与 `artifact.json` 一致。交付包 API 地址为空、profileMode=username、identityVerified=false、releaseReady=false；没有秘密配置和测试按键。公网后端部署与实际发布页尚未验收，当前原生测试结果不代表 XBuilder 当前线上部署的全面认证。
