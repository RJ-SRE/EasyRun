# 用户名学习档案 · local.4

> 2026-11-01 更新：当前版本已改为纯本地 IndexedDB 名称档案，不再向后端申请名称会话。本文为 local.4 云名称方案历史记录；当前行为、游客持久化与导入包见 [纯本地验证版](LOCAL_LEARNING_VALIDATION.md)。

日期：2026-10-31。依据用户最新要求“就用名称”，本版改用 XBuilder 运行器提供的 `username` 关联档案，不使用显示昵称，也不新增注册页面。未提交或推送远程。

## 当前流程

1. 每次外部启动游戏前，XBuilder 将当时的用户名传给运行器。游戏在标题页读取这个 `username`。空名称直接游客游玩，不创建空名或公共 guest 档案。
2. 有名称且已配置 API 地址时，调用 `POST /v1/session`，请求体仅为 `{ "username": "运行器提供的名称" }`。
3. 后端按名称派生档案键，返回 `profileMode:"username"`、`verified:false`、档案 ID、短期会话与过期时间。
4. 游戏使用会话准备 30 个词，恢复该名称对应的学习状态；到保存节点通过已有批次协议写入七牛。
5. 同一名称刷新会话保留当前词册、远征和未确认队列。准备好之后才允许开始名称远征；读取失败可 N 重试或 G 转游客。

**名称档案不验证账号归属。** 后端信任请求中给出的名称作为选择条件；知道或伪造同一名称的人可以申请同一档案的会话、读取记录，并可能接管写入。因此不能把这个模式宣称为安全的账号认证、私密账号存档或防作弊系统。

七牛空间仍为私有，AK/SK 只在后端。私有空间保护直接对象访问，但不会弥补业务层名称无认证的问题。会话签名用于绑定后续批次和有效期，不证明名称所有权。

## 名称规则

| 情况 | 行为 |
|---|---|
| 同名再次进入 | 读取同一份名称档案 |
| 大小写或两端空格不同 | 视为同名；后端采用 trim、NFC、转小写 |
| 修改用户名 | 使用另一份档案，旧名称记录保留，不自动迁移 |
| 另一个人使用旧名称 | 同样可以读到该名称对应的档案，这是此模式的限制 |
| 修改显示昵称 | 不影响，游戏使用 `username`，不使用 `displayName` |
| 未登录／空名称 | 游客，本次运行记录 |
| 战斗中登录、改名或退出登录 | 本局及 R 维持原归属；平台不保证实时更新运行器，需要外部重新运行/刷新后取得新名称。若宿主确实推送新值，游戏只在标题处理 |
| 平台页面点击“重新运行” | 会重启游戏，区别于游戏内 R；先等待保存确认，未保存内存事件不保证保留 |
| 手动 G 转游客 | 持续游客，不被自动名称检测立即重新连接；N 可重新连接 |
| 旧名称会话响应迟到 | 独立请求代次检查，忽略迟到响应 |
| 另一运行器已持有写入权 | 保留原有显式 V 接管规则，不静默覆盖 |

后端拒绝空名、非字符串、控制/不可见格式字符，以及超过 100 个 Unicode 字符的名称。游戏最多在标题页每秒检查一次运行器已收到的名称；它不是平台登录状态监听，不能自行获得宿主未推送的新名称。普通战斗不轮询名称、不按字母联网。名称会话有效 8 小时，标题页在 6 小时后可刷新；网络错误按 2/5/15 秒重试，之后等待手动操作。

## 档案键与旧数据

使用独立命名空间 `HMAC-SHA256(mappingKey, ["profile", "xbuilder-username-v1", normalizedName])` 派生 `p_...`。对象路径继续为 `rupture/learning/v1/users/{playerId}/current.json`，不把原始用户名拼接成路径。

这里的 `playerId` 是**名称派生的内部档案键**，不是 XBuilder 的稳定用户 ID。改名会改变它。映射密钥必须保留。

此前稳定 ID 模式的 HMAC 输入、对象与会话用途保持独立，新的名称不能认领或覆盖原有 ID 档案。没有自动迁移脚本。本版仍可选择 `verified-id` 模式，但它需要正式身份授权；当前用户选择的名称模式不依赖该授权。

## 配置和启动

本机 `.local/learning/kodo.env` 已设为：

```dotenv
LEARNING_PROFILE_MODE=username
```

后端启动：

```sh
bash scripts/with-env.sh node --env-file=.local/learning/kodo.env services/learning/dev.mjs
```

当前监听 `http://127.0.0.1:4191`。健康检查明确返回 `profileMode:username`、`loginAvailable:true`、`identityConfigured:false`；后者表示没有平台身份认证，名称接口仍然可用。

构建时默认 `LEARNING_NATIVE_PROFILE_MODE=username`，生产游戏连接还需：

```sh
LEARNING_NATIVE_API_URL=https://你的后端域名 \
LEARNING_NATIVE_PROFILE_MODE=username \
bash scripts/with-env.sh python3 prototypes/runlab/package.py --game belfry
```

只能把公开 API 地址打进游戏，不能将 `.local/learning/kodo.env` 整份导入游戏构建配置。构建器拒绝非 HTTPS、带账户密码或查询凭证的 API 地址。`.env.example` 中已列出模式字段。

## 交付与验证

新版：`prototypes/runlab/exports/belfry-learning-username.xbp`，桌面副本 `EasyRun-XBuilder-v0.17.0-username-profile.xbp`。

目前没有公网 HTTPS 后端地址，因此包内 API 地址仍为空：**导入 XBuilder 后不会自动启用线上保存**。用户名自动连接代码已包含；配置实际后端地址重新打包后才会连接。当前不再等待平台稳定 ID 授权，但仍需部署后端、设置正确 CORS，并完成实际发布页验证。

默认原生词库版本与本机旧词库联调服务统一为 `cet46-2026-10-26.1-cloud-test`，仍明确不是审核通过的新常用词库。发布内容校验与 `releaseReady:false` 保留。

测试通过真实运行器 `xbuilder_set_username` 向游戏提供合成名称，游戏自行请求名称会话，**没有注入预先签发的游戏会话**。测试覆盖空名、同名、大小写、改名、战斗/R 归属、异步切换、游客、退出登录、新运行器恢复与重试。结果见 [本次证据](evidence/2026-10-31-username-profiles/README.md)。

## 源码审查后的限制修正

2026-10-31 核对上游和线上运行器后确认，平台的用户名注入发生在外部启动前，未发现运行中账号变化自动重新注入的桥接。九项原生测试中的变化由测试主动调用官方 setter 模拟，不等于平台会自动推送。名称模式可以继续使用，但切换平台账号或改名后应重新运行。还发现待修的缓存满切换校验与部署配置覆盖问题，详见 [兼容性审查](XBUILDER_CLOUD_COMPATIBILITY_REVIEW.md)。
