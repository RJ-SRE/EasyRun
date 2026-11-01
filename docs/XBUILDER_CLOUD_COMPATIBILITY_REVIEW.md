# XBuilder 与名称云档案兼容性审查

审查日期：2026-10-31。对象：EasyRun local.4 名称档案、XBuilder 源码和匿名线上运行器资源。本次交付为源码审查、复现脚本和规则说明修正；下列待修问题没有标成已修复，也没有发布或推送远程。

## 结论

名称选档、后端准备 30 词、保存边界异步提交与七牛持久化这条链路可以继续开发，已经有原生及真实存储验证。需要优先处理实际网页的网络入口、运行器生命周期和档案切换校验，再扩大在线测试。

用户已选择名称模式。本审查尊重该选择，但名称只能选档，不能验证账号所有权；同名请求可读同档、改名分档是明确保留的产品边界。

## 版本与证据范围

- 本机参考源码：`e2a4c45dfa0574ac7700fad94d2d4a6da7da8083`。
- 审查时上游 dev：[`c94e7bdaabd2d2756eb3a7f061a0a28b59368ae2`](https://github.com/goplus/builder/commit/c94e7bdaabd2d2756eb3a7f061a0a28b59368ae2)，2026-10-30；依赖 SPX 4.0.0。
- 匿名访问 `https://x.qiniu.com/` 及其公开运行器 JS，观察到线上依赖 SPX **3.3.0**，运行器资源为 `ProjectRunner-BF8s5DRd.js`。不能把 dev 分支的 4.0.0 当作当前线上版本。
- 线上资源观察不等于实际用户作品验收。本次没有登录平台、读取平台凭证、改动作品或执行真实玩家云写入，也没有下载并验证当前线上编译器 WASM。
- 公开源码快照保存在 Git 忽略的 `.cache/xbuilder-source-audit/2026-10-31/`。证据与匿名资源摘要见 [审查证据目录](evidence/2026-10-31-xbuilder-audit/README.md)。

## 需要处理的发现

### F01 · P0 · 公网 HTTP 无法直接供 HTTPS 游戏页面使用

游戏的 Go `net/http` 在浏览器 WASM 中最终通过 Fetch 发请求，受浏览器混合内容与跨域规则约束。HTTPS 页面请求公网 HTTP API 会在到达后端前被阻止；添加 CORS 不会消除混合内容限制。构建器目前也明确只允许 HTTPS API 地址。

本次 Chromium 探针在 HTTPS 测试页面请求预留公网文档 IP，收到 TypeError 与 Mixed Content 控制台消息，目标请求没有到达拦截路由。测试域名/IP 都被浏览器路由截获，不向真实外部服务发请求。

建议：按用户计划先用 HTTP 云主机做服务器/七牛联调；接通 XBuilder 发布页时再增加 HTTPS 入口。Node 程序可继续通过 HTTP 与同机反向代理通信。

依据：[Go WASM HTTP 实现](https://go.dev/src/net/http/roundtrip_js.go)、[浏览器混合内容规则](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)、`build-belfry-native-lexicon.mjs:154`。

### F02 · P1 · 用户名是启动快照，平台账号变化不保证传入正在运行的游戏

上游 `ProjectRunner.vue:348–356` 在 `startGame()` 前调用 `xbuilder_set_username`。该组件没有监听用户名变化后重新调用该接口的代码；当前线上 JS 也展示同样的启动时注入模式。账户服务的 `modifyUsername` 会更新用户名并退出登录。

我们的标题页轮询只能读取**运行器已收到的值**。它无法自行知道另一个标签页的登录、退出或改名。一个旧的运行中游戏可能继续使用旧名称，直到外部重新运行/刷新。

此前九项原生测试会主动调用 `xbuilder_set_username` 模拟宿主更新，证明我们能正确处理更新和迟到响应，不能证明平台会自动推送更新。对此已修正用户文档。

建议产品约定：每次外部启动绑定启动时的用户名；切换平台账号或改名后重新运行游戏。只有平台未来提供实时桥接，才承诺“返回游戏标题自动获取新账号”。

依据：[运行器启动流程](https://github.com/goplus/builder/blob/c94e7bdaabd2d2756eb3a7f061a0a28b59368ae2/spx-gui/src/components/project/runner/ProjectRunner.vue#L348)、[平台改名流程](https://github.com/goplus/builder/blob/c94e7bdaabd2d2756eb3a7f061a0a28b59368ae2/spx-gui/src/stores/user/signed-in.ts#L324)、本项目 `NativeCloud.spx:66`。

### F03 · P1 · 平台停止、重新运行和页面关闭不能保证补存内存队列

`ProjectRunner.rerun()` 先 stop 再 run；引擎崩溃时直接刷新 iframe。没有在这些步骤前调用我们的学习保存接口或等待其确认。当前 `nativeCloudQueue`、冻结批次和账号快照都是运行内存，未写入跨运行持久存储。

因此，“后端已确认的记录能恢复”成立；“关闭/重新运行后未确认记录一定补存”不成立。服务端持久日志只能保护已经到达服务端的上传，不能保护还留在浏览器内存里的事件。

补充能力验证已确认：在缓存 3.3 运行器中，`.spx` 可通过 `syscall/js` 直接使用 localStorage 与 IndexedDB；游戏写入并关闭浏览器进程后，新游戏成功读回，暂不需要先修改宿主。当前完整游戏仍未接入这条路径，因此本问题尚未修复。方案见 [本地与云端持久化](LOCAL_AND_CLOUD_PERSISTENCE_PLAN.md)。不能仅靠页面关闭时抢发请求承诺可靠保存。

依据：[外部停止/重新运行](https://github.com/goplus/builder/blob/c94e7bdaabd2d2756eb3a7f061a0a28b59368ae2/spx-gui/src/components/project/runner/ProjectRunner.vue#L383)、[崩溃刷新](https://github.com/goplus/builder/blob/c94e7bdaabd2d2756eb3a7f061a0a28b59368ae2/spx-gui/src/components/project/runner/ProjectRunner.vue#L211)、本项目 `NativeCloud.spx:47`、`:119`。

### F04 · P1 · 名称档案缓存满时，拒绝切换后仍可能以旧档案开局

条件：同一运行器内已经缓存四份名称档案，再请求一个尚未缓存的新名称。`nativeCloudSwitch()` 消费切换请求后因容量已满返回，实际 `nativeCloudAccount` 仍是旧档案。此前名称响应已把 `nativeNameConnected` 设置为新名称；`nativeNameBlocked()` 仅检查该名称和“account 非空”，没有检查实际账号是否是新名称预期的档案 ID。

本次抽取实际原生 `nativeCloudSwitch`、`nativeNameBlocked` 方法执行；与容量判断无关的学习/序列化辅助方法使用桩。结果为“旧档案仍在，名称开局未被阻止”，并输出缓存已满提示。复现见 `native-name-cache-capacity.json`。

该问题主要影响后续同运行器多账号/多名称切换；当前平台启动快照限制降低了普通用户触发概率，但我们已有切换代码仍应修正。

建议：在名称会话返回时保存预期档案 ID；任何时候 `nativeCloudAccount != expectedProfileId` 都禁止以名称模式开局。切换失败应保留明确的失败状态，N 重试不能让旧档案冒充新名称。

位置：`NativeCloud.spx:89`、`:96`、`:149`。**尚未修改游戏逻辑。**

### F05 · P1 · 本机七牛配置工具会覆盖云主机部署设置

`configure-kodo.mjs:13–20` 在读取已有配置后，将环境强制写成 development、监听地址写成 127.0.0.1、端口写成 4191、日志目录写成本机相对目录。若搬上云主机后再次运行它，会覆盖已经设置的环境、监听和日志位置。

建议先让“发现七牛端点”只更新七牛相关字段，保留已有部署参数；提供独立 staging/production 模板。直接暴露 HTTP 服务与使用同机代理时，监听地址配置不同，不能统一强制覆盖。

### F06 · 部署必填 · CORS、内容版本、映射密钥和单写入进程

- 默认 CORS 仅允许本机 4177/4184；以 `Origin:https://x.qiniu.com` 预检会得到 403。本次也验证显式加入该来源后得到 204。应配置实际 iframe 的 Origin，不是七牛存储域名，也不靠通配符解决。
- 默认监听 127.0.0.1，直接用公网 IP 连接不会自动可达；有本机反向代理时该监听方式合理。
- 当前旧词库是联调草稿。以 production 启动时会启用正式内容校验，本次只读验证按预期拒绝，首个错误为 `LEXICON_CEFR`。不能假设复制本机配置并改一个 production 值就可以启动。
- `.local/learning/keys.json` 的映射密钥必须随部署保留；生成新的映射密钥会把同名指向另一对象，表现为“记录不见了”。
- 当前只支持一个写入后端进程及持久日志目录。不同主机/不同卷上的多个进程没有共同互斥，不能直接开启多副本扩容；单机锁不能替代分布式并发控制。

依据：`server.mjs:14`、`:50`、`:60`，`lexicon.mjs:65`，`storage.mjs:243`，`dev.mjs`。

### F07 · 已接受边界 · 名称模式没有账户所有权保护

`loginUsername` 接受名称并签发该名称的会话。其他人知道同名即可读取记录，按现有流程还可以请求 V 接管。私有 Kodo 和 HMAC 对象键不能阻止这种业务层访问。

这是用户明确选择的当前模式，不擅自改回稳定 ID 鉴权。公开测试前应至少准备接口限流、档案数量和写入量观测；不将这些记录用于付费权益或可信竞技成绩。

### F08 · P2 · SPX 4.0 升级需要独立回归

当前线上 3.3.0 与此前运行器测试处在同一版本；不能据此保证 4.0。上游当前编译器项目已经切换到 `spx/v4`。发布前应记录实际运行器版本和资源摘要，升级时重新跑名称会话、HTTP、中文词册、音频、输入与重新运行测试。

本次不把“需要升级回归”写成已发现 4.0 不兼容，也不自动替换当前游戏引擎。

## 可以保留的实现

- 答题只更新本词与事件队列，不下载或重算完整云历史。
- 30 词准备在标题阶段；战斗保存经异步请求执行，不逐字联网。
- 原生冻结批次保持不变，确认后只移除已确认前缀，写入期间新答案仍保留。
- 账号/名称代次隔离、签名批次、服务端串行和上传意图日志已经具备回归证据。
- Kodo 密钥保留在后端，游戏只携带公开 API 地址和短期名称会话。

这些结论基于代码和已有测试；不是发布页长期稳定性或性能 SLA 的保证。

## 建议顺序

1. 修复 F04 的预期档案 ID 校验，收紧无法切换时的开局条件。
2. 修复 F05 的配置覆盖，整理云主机 staging 参数、CORS、持久卷与单实例启动。
3. 按启动快照修正账号变化体验，明确外部重新运行和游戏内 R 的区别。
4. 将已验证可用的 IndexedDB 路径接入完整游戏，完成跨运行待保存日志和异常恢复验收；在此之前保持保存状态可见。
5. HTTP 服务器与七牛联调完成后，增加 HTTPS 入口、填写包内 API，再做真实发布页验收。

## 后续本地化进展（2026-11-01）

用户已选择纯本地方案。新的 IndexedDB 路径不再使用内存四档案云切换缓存，开局直接校验当前运行器名称对应的本地键；外部重跑的在途事务、浏览器强关、多窗口与存储失败均已通过本地包测试。云端配置工具覆盖与公网 HTTP 仍是历史云方案问题，没有因本地化而被标记成已修复。详情见 [纯本地验证版](LOCAL_LEARNING_VALIDATION.md)。
