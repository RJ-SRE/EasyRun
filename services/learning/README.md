# 裂隙学习服务：用户名档案版（local.4）

> 2026-10-31 最新决策：当前七牛配置为 `LEARNING_PROFILE_MODE=username`。`POST /v1/session` 接收 `{username}`，按规范化名称返回 `verified:false` 的名称会话，不要求平台凭证。**这不是 XBuilder 身份认证，知道同名即可访问同一档案；改名不会继承旧记录。** 详见 [用户名档案说明](../../docs/USERNAME_PROFILES.md)。下文“正式身份授权”章节描述仍保留的 `verified-id` 可选模式，不是当前名称模式的接入门槛。


本目录实现 PRD v1.4 的学习规则、30 词准备、批次同步、用户隔离与存储适配。**当前不是已上线云同步版本**：七牛私有空间已接入并完成真实读写与原生联调，尚无真实 XBuilder 应用授权和公网 HTTPS 后端。原生测试包运行游客学习模式；当前名称接口为用户明确选择的档案模式，测试验证器不会进入常驻服务器。

## 启动与测试

在项目根目录使用固定工具链：

```sh
bash scripts/with-env.sh node services/learning/build-test-content.mjs
bash scripts/with-env.sh node services/learning/dev.mjs
# 新终端
curl http://127.0.0.1:4190/health
bash scripts/with-env.sh node --test services/learning/test/*.test.mjs
```

开发启动自动把两个不同的随机密钥保存到 `.local/learning/keys.json`，权限 0600，不打印密钥。该目录已被 Git 忽略。在 `verified-id` 模式下，身份未配置时健康检查返回 `identityConfigured:false`，会话接口返回 503；这不是自动开通云档案。测试通过注入独立的身份测试替身验证服务，替身没有包含在启动服务器或 `.xbp` 中。

复制 `.env.example` 到 Git 忽略的位置，配置后使用：

```sh
bash scripts/with-env.sh node --env-file=.env.learning services/learning/server.mjs
```

默认只监听本机。生产环境必须使用 Kodo、通过发布校验的词库、HTTPS 反向代理；`verified-id` 模式还需正式身份验证端点。代理配置请求体上限 256 KiB、请求限速、可信客户端 IP 和 TLS。只允许实际发布/预览来源访问；不设置通配 CORS，不把密钥放进原生包。

## 接口

所有个人响应 `Cache-Control:no-store`。除建立会话外，要求 `Authorization: Bearer <游戏会话>`。

| 地址 | 方法 | 输入 / 返回 |
|---|---|---|
| `/health` | GET | 存储类型、身份是否配置；不含密钥或玩家数据 |
| `/v1/session` | POST | `username` 模式传 `username`；`verified-id` 模式传 `platformCredential` 并验证；返回 `playerId,session,expiresAt`，有效 8 小时 |
| `/v1/view` | GET | 已确认版本与汇总，或 `newUser:true`；不返回全历史 |
| `/v1/prepare` | POST | `contentVersion,wordMode`；返回固定 30 词、必要状态、汇总与签名准备凭证 |
| `/v1/batches` | POST | 写入会话、代次、基准版本、连续批次与有序事件；返回小型保存确认 |

同一写入会话再次准备应带 `writerSessionId,writerEpoch,baseRevision,lastEventSeq`。另一个设备申请时先返回 `TAKEOVER_REQUIRED`；用户明确选择接管后，再携带 `takeover:true` 和最新 `baseRevision`。写入会话持续 24 小时，在成功准备/写入时续期；不增加战斗内心跳上传。

一次准备凭证有效 30 分钟，绑定用户、会话、版本、范围和 30 词。已被本写入会话用于开局的同一准备凭证可继续用于 R 重开，无须为保留词组而联网重新抽词。新账号不能使用旧账号凭证。

事件类型为 `run-start,answer,checkpoint,failure,won,abandoned`。远征 ID 为 `writerSessionId:runSeq`；每次开始 `runSeq` 连续递增。有效答题有递增 `questionSeq`，同题不能产生第二个最终结果。失败尝试以连续 `attemptSeq` 去重，不结束远征；胜利终态及累计通关只记录一次。

## 客户端边界

`client.mjs` 是可测试的协议参考客户端，包含 30 词视图、不可变重试批次、账号队列隔离、2/5/15 秒重试和迟到响应隔离。原生端由 `prototypes/runlab/spx/belfry/NativeCloud.spx` 单独实现，通过真实原生运行器和本地 HTTP 联调；JS 参考客户端不被塞进 `.xbp` 作为平台插件。

普通答题只记录事件，不上传。仅指定保存节点冻结事件边界；发送期间新增作答留在队列。正常批次最多 200 条、32 KiB，服务器硬限制 256 KiB。服务端确认后清理对应引用，不能重复增加乐观显示的次数。自动重试三次后停下；401 要重新登录，409 停止发送并处理写入权/版本冲突。

2,000 条未同步事件开始提示积压；参考客户端 10,000 条为硬上限，返回明确 `QUEUE_FULL`，保留已有事件，不静默覆盖。原生端采用更小的 **2,000 条硬上限**：保留已有队列并停记后续云事件，提示后续练习仅本地；返回标题手动补存成功后重新准备。原生单批最多 50 条 / 32 KiB，回包最多 32 KiB，10 秒请求超时。默认游客包不启用该队列。

## XBuilder 身份接入的剩余条件

已检查本地参考源码 `e2a4c45` 的 `tools/ispx/username.go` 和 `ProjectRunner.vue`：运行器在开始前注入用户名。用户名是显示信息，不能作为后端鉴权凭证。正式平台的 `/user` API 可验证其支持的 Bearer 凭证，但目前没有本项目授权配置，也没有已验证的“将适用凭证授权给原生游戏”入口。

本地 `@xgo-pkgs/spx` 3.3.0 的实际运行测试证明 `encoding/json`、`net/http` 和用户名读取可用；**这不是线上部署版本、身份授权或目标 HTTPS 域名的验收**。

接入时须由平台提供正式授权方式/游戏短期凭证：后端只向预先配置的 HTTPS 端点验证，取稳定 `id`，再用独立映射密钥对 `[issuer,subject]` 做 HMAC-SHA256。不读取宿主页私有存储，不复用内部 AI token，不用公共用户资料查询替代鉴权。缺少平台能力时保持游客，不增加用户已拒绝的独立账号系统。

真实 Kodo 端到端验证已完成；尚需实际平台身份入口、线上 CORS、当前部署运行器与公网后端验证。原生准备/提交绑定与保存状态 UI 已完成本地联调，但不代表取得了真实平台授权。

## 存储与不确定写入

`LEARNING_STORE=local` 使用明确标记的本地文件；`kodo` 使用私有对象 `rupture/learning/v1/users/{playerId}/current.json`。读取先查管理端元数据，仅 612 表示不存在；403、下载失败、格式损坏和未知版本都不初始化空档案。下载内容校验 Kodo ETag，确认它与当前元数据一致，避免使用旧缓存。

每个用户的读取、准备、接管和写入串行。同实例确认态缓存最多 32 用户、保守估计 64 MiB，缓存只在持久化确认后更新。正常缓存命中保存不读取整个远端档案，只上传一次；汇总按准备时刻重新计算到期情况。

写入前将候选档案、摘要及目标版本 `fsync` 到持久化日志目录，然后只发送一次上传。出现超时/响应丢失时，禁止猜测成功或直接重传覆盖。下次请求或进程重启时，只有读取到候选的**精确 SHA-256**才结束未决状态；否则保持 `WRITE_OUTCOME_UNKNOWN`，暂停该用户的写入和接管。

这是一条保守恢复策略：进程可能在写日志后、实际发请求前崩溃，此时无法自动证明旧请求不存在，需运维核对后恢复。日志必须位于持久化卷，不能放易失容器层。只能部署一个写入进程；本地锁仅保护共享日志路径，不能替代跨主机分布式锁。滚动部署须停旧实例再启新实例。不要在未确认上传状态时删除日志。

`LEARNING_PLAYER_MAPPING_KEY` 必须永久备份；更换会改变用户目录映射。会话签名密钥与映射密钥分开。日志和个人档案均属于私有数据，不应加入 Git。

## 词库

`build-test-content.mjs` 为本地后端测试生成旧 8,815 词的测试清单，明确 `draft:true`、`usageStatus:legacy-test-only`。其中三组沿用旧 tier 以验证接口和压力场景，**不是 CEFR，也不是新的常用词库分级**。游戏默认仍显示原来的四六级范围，避免误导。

新内容准备完成后执行：

```sh
bash scripts/with-env.sh node services/learning/check-content.mjs /absolute/path/to/approved-content
LEARNING_NATIVE_CONTENT_DIR=/absolute/path/to/approved-content bash scripts/with-env.sh python3 prototypes/runlab/package.py --game belfry
```

原生构建只有在内容通过校验后才启用“普通／困难／挑战／随机”：目标义项 A1/A2、B1、B2 与全部并集；按新的模式抽词，但战斗难度、提示和时限独立。稳定 ID 打包为紧凑列并在启动时建立索引。

发布校验检查字节摘要、启用数、唯一 ID、词性义项、CEFR 映射、每组至少 30 词、拼写可输入、三选项不重复、来源依据、非草稿和逐条审核标记。结构校验不能代替语言内容人工审核：同义干扰项、多义词语境、使用条件必须提供审核材料。未获得经核验的新词库，因此没有承诺完成 3,000～4,000 条内容。

## 验收范围

本地单元/集成测试覆盖学习规则、词册配额、账号隔离、接管、重复及失序提交、失败/获胜、坏档案、8,815 条旧历史、写入响应丢失及重启恢复、HTTP 往返和 100 批引用清理。默认单元测试使用协议替身；另有明确开启的真实七牛测试，结果见 [七牛接入记录](../../docs/KODO_LEARNING_INTEGRATION.md)。

线上 50 次延迟样本、10 账号并发指标、原生主线程 2/4 ms、2,000 条积压内存实测、三轮 120 秒帧间隔对照，以及真实账号跨次恢复，都留待正式原生传输与部署接入后验收。没有用本地测试耗时冒充这些 P0 指标。

## 原生配置与宿主接入点

`LEARNING_NATIVE_API_URL` 是构建时公开 HTTPS 后端地址，默认空值；禁止内嵌用户名、密码、查询凭证或 fragment。`LEARNING_NATIVE_CONTENT_DIR` 指向与服务端相同的已审核词库目录。运行 `package.py --game belfry` 后检查包内 `native-learning-manifest.json`。发布标记仍保持 `releaseReady:false`，直到真实身份、内容及线上验收完成。

正式宿主完成平台授权并调用 `/v1/session` 后，应通过平台正式支持的桥接入口调用 `NativeLogic.nativeCloudAttach(playerId, session)`。这是项目已实现的接收函数，**不是已经得到 XBuilder 官方支持的宿主 API**。不得将测试时源码注入身份的方法用于发布，也不得把长期密钥写入构建环境的公开字段。

原生 `net/http` 和 `encoding/json` 已实测。本地固定运行器未开放所尝试的 `time.Parse`、`io.ReadAll`，所以用服务端毫秒时间计算复习间隔，用受限分块读取控制 JSON 回包大小。准备响应包含 `serverTimeMs`，能力摘要含 `nextReviewAtMs`，原有 UTC 字符串保留；确认响应附带小型已保存汇总，不传全档案。

本地旧词库联调只使用混合范围，词库版本由测试覆盖层显式匹配 `cet46-2026-10-26.1-cloud-test`；交付包仍是旧词库游客版本，正式四模式必须通过新词库构建校验。原生联调操作与状态截图见 `docs/CLOUD_LEARNING_LOCAL.md`。

## 改名与会话刷新

固定绑定链路为：经验证的 `user.id` → `[issuer, user.id]` 的 HMAC → `playerId` → 存档与待保存队列。用户名和昵称只用于展示，不作为存档键，也不用于旧档案的自动合并。平台未返回有效字符串 ID 时拒绝建立身份；无需迁移已有 ID 档案。

宿主重复传入相同账号 ID 时视为同账号会话更新：保留已准备词册、正在发送的请求和冻结批次。新凭证替换旧凭证不会触发新的 `/v1/prepare`。迟到的旧凭证 401 只使原批次用新凭证重试；真正换账号仍隔离队列。验证覆盖修改用户名/昵称、重新登录、后端冷重启恢复、旧用户名被另一账号使用、同 ID 更新时保存仍在进行。

## 真实七牛联调与启动（local.3）

已生成的 `.local/learning/kodo.env` 是本机私有配置，不需要再把密钥填写到代码。区域发现返回 HTTPS 原生源站地址，私有下载沿用七牛签名与 ETag 校验，不使用 CDN 测试域名。

```sh
# 重新核实空间私有权限并发现区域端点；不会输出密钥
bash scripts/with-env.sh node services/learning/configure-kodo.mjs
# 启动本机七牛后端，4191；使用独立的 kodo-journal 目录
bash scripts/with-env.sh node --env-file=.local/learning/kodo.env services/learning/dev.mjs
# 只读健康检查；identityConfigured:false 仍是预期
curl http://127.0.0.1:4191/health
# 明确启用真实云测试，所有写入仅在独立随机测试前缀
LEARNING_LIVE_KODO=1 bash scripts/with-env.sh node --env-file=.local/learning/kodo.env services/learning/test-kodo-live.mjs
# 原生运行器 -> 本机 API -> 真实 Kodo
LEARNING_LIVE_KODO=1 RUNLAB_URL=http://127.0.0.1:4177 bash scripts/with-env.sh node --env-file=.local/learning/kodo.env prototypes/runlab/test-belfry-native-learning.mjs
```

测试覆盖创建、未签名访问拒绝、独立能力保存、无缓存恢复、确认丢失与原批重试、改名、不同 ID 隔离、禁止插入覆盖，以及原生全部保存节点。`rupture/learning-tests/<随机运行标识>/users/` 与正式 `rupture/learning/v1/users/` 分开；清理只删除本次测试触及的精确对象并核对不存在，不执行空间清空。

真实平台授权未接入前，`verified-id` 模式仍拒绝以用户名或客户端提供的 ID 创建已认证会话；当前 `username` 模式明确提供未验证的名称档案会话。测试验证器只存在于单独运行的测试脚本中，端口只绑定 loopback，结束即关闭；不添加服务后门。
