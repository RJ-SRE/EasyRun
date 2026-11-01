# 七牛学习档案接入 · 2026-10-31

> 2026-11-01 更新：当前交付已转为纯本地，不连接七牛存储。已有配置与测试记录保留，不由本地包使用；详情见 [纯本地验证版](LOCAL_LEARNING_VALIDATION.md)。

> local.4 更新：用户已选择按运行器用户名关联档案，当前本机后端启用 `username` 模式。平台身份授权不再是该模式的依赖；名称本身可以被冒用，改名不继承。本文其余 local.3 验收描述保留历史上下文，当前规则见 [用户名档案说明](USERNAME_PROFILES.md)。


版本：0.17.0-local.3。完成真实私有存储接入与开发测试，未提交或推送 GitHub。

## 当前可用链路

原生 XGo 学习客户端 → 本机 HTTP 学习服务 → 七牛 HTTPS 私有存储。

测试使用原有稳定身份版 `.xbp`，只在运行器内存中注入临时测试会话和 loopback API 地址；没有修改交付包的默认游客模式。原生运行器的真实请求、服务端批次校验、持久化日志与实际七牛读写都参与了验证。XBuilder 正式登录仍未接入。

| 配置 | 当前状态 |
|---|---|
| 存储空间 | `easyrun` |
| 私有权限 | 管理接口返回 private=1；未签名读取测试档案返回 401 |
| 区域 | z2，华南 |
| 上传端点 | `https://upload-z2.qiniup.com` |
| 私有读取 | `https://easyrun.kodo-cn-south-1.qiniucs.com`，请求签名与内容 ETag 校验 |
| 管理端点 | `https://rs-z2.qbox.me` |
| 本机 API | `http://127.0.0.1:4191`，只监听 loopback |
| 私有配置 | `.local/learning/kodo.env`，Git 忽略、0600 权限 |
| 档案 ID 映射密钥 | 沿用 `.local/learning/keys.json`，没有重新生成或改变映射规则 |
| 上传意图日志 | `.local/learning/kodo-journal/`，与文件测试服务隔离 |

域名由七牛 `/v4/query` 区域发现返回，空间权限使用官方 SDK 对应的 `/v2/bucketInfo` 查询。用户提供的 `clouddn.com` 测试域名只记录在本地配置，不用于档案读取。参考：[七牛空间访问控制](https://developer.qiniu.com/kodo/8603/dev-access-control)、[官方 GetBucketInfo 实现](https://github.com/qiniu/go-sdk/blob/master/storagev2/apis/api_get_bucket_info.go)。

## 实现与数据保护

- `configure-kodo.mjs` 校验私有权限、确认区域、发现上传和源站端点，只输出非敏感配置；不修改空间权限。
- `KodoStore.init()` 在启动时拒绝公共空间或无法确认权限的空间，避免配置错误时继续保存个人档案。
- 正式档案继续使用 `rupture/learning/v1/users/{playerId}/current.json`。映射来自已验证稳定用户 ID，改名不创建新档案。
- 云上传只签名目标对象；新档案插入使用 `insertOnly`，已有对象不能被误当成新用户覆盖。
- 读档先查元数据，仅 612 代表不存在；私有 HTTPS 下载后核对 ETag。不将权限、网络或内容错误当作空档案。
- 上传前保留本机持久化意图；请求结果不确定时重新读取七牛对象，用精确内容摘要确认。不会盲目重传覆盖，也不会重复累加通关。
- 补齐错误响应和不存在响应的响应体释放，避免持续请求留下无用连接资源。
- 未新增战斗内逐字上传。学习事件仍在检查点、暂停/结算等约定边界异步保存。

## 启动与测试

从当前工作树根目录运行：

```sh
bash scripts/with-env.sh node services/learning/configure-kodo.mjs
bash scripts/with-env.sh node --env-file=.local/learning/kodo.env services/learning/dev.mjs
```

健康检查：

```sh
curl http://127.0.0.1:4191/health
```

应返回 `storage:kodo`、`identityConfigured:false`、`releaseReady:false`。存储已经连接，身份与发布条件仍未满足。

执行真实云测试须明确设置 `LEARNING_LIVE_KODO=1`，不由普通单元测试自动触发。命令和具体用例见 [服务说明](../services/learning/README.md)；结果见 [真实云验证记录](evidence/2026-10-31-kodo-live/README.md)。

## 发布前剩余条件

1. XBuilder 正式支持的用户授权和宿主身份入口。七牛 AK/SK 只授权对象存储，不能验证玩家是谁。
2. 可供已发布游戏访问的 HTTPS 后端地址、部署位置、持久日志卷和准确 CORS 来源；不把本机 4191 地址当作线上 API。
3. 新常用词库内容审核与发布校验、实际发布页联调及 PRD 线上性能验收。

不部署第二个并发写入实例；当前持久日志设计要求单写入进程。保留映射密钥、私有配置和日志，不把它们装入 `.xbp`。目前的真实测试身份均与正式账号隔离，未创建真实玩家档案。
