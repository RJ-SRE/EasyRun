# XBuilder 云档案审查证据 · 2026-10-31

报告：[源码兼容性审查](../../XBUILDER_CLOUD_COMPATIBILITY_REVIEW.md)。

- `site-deployment.json`：匿名网站入口与公开运行器 JS 的观察结果，记录线上 SPX 3.3.0、编译器 URL 和运行器 JS 的 SHA-256。上游 dev 为独立的 SPX 4.0.0，不混同线上部署。
- `boundary-probes.json`：四项探针完成：HTTPS → 公网 HTTP 被浏览器阻止；本机默认 CORS 拒绝 XBuilder 来源；显式加入来源后预检成功；旧联调词库被 production 内容校验拒绝。
- `native-name-cache-capacity.json`：真实原生方法抽取执行，复现四份档案缓存满后旧档案仍在、名称开局检查未阻止的问题。学习/序列化辅助方法用桩，不冒充完整战斗场景。首次探针因 classfile 多 var 声明失败，修正探针后成功复现；游戏逻辑未修改。
- `source-index.json`：源代码版本和公开文件的永久链接。完整只读源码副本在 `.cache/xbuilder-source-audit/2026-10-31/`，该缓存不进 Git。

执行：

```sh
bash scripts/with-env.sh node prototypes/runlab/test-belfry-xbuilder-boundaries.mjs
RUNLAB_URL=http://127.0.0.1:4177 bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-name-cache-audit.mjs
```

两个探针的 ESLint 已通过，`git diff --check` 已通过。此前 26 项后端测试、9 项原生名称本地测试、9 项真实 Kodo 测试保留在 [local.4 名称档案证据](../2026-10-31-username-profiles/README.md)，本次没有重复执行并宣称它们是新增结果。

没有平台登录操作、真实个人档案访问、云写入、线上作品修改或 Git 远程推送。审查只新增复现脚本、报告，并修正先前文档中对运行中用户名更新的过度承诺。

## 补充：浏览器与原生存储能力

`storage-capabilities-xbuilder.json` 使用临时浏览器 profile，在相同本机来源下完成实际浏览器进程关闭与重新启动。普通网页 localStorage/IndexedDB 均恢复成功；原生 `.spx` 经 `syscall/js` 写入 localStorage 和 IndexedDB，新的浏览器进程/游戏运行也成功读回。游戏代码直接调用浏览器 API，未在宿主注入自定义存储桥接。

`os.WriteFile` 在探针路径返回 `not implemented on js`，不采用普通文件写入作为这次持久化方案。所有随机测试键、数据库和浏览器 profile 已清理；没有读取 XBuilder 私有账号存储，没有访问真实玩家云档案。

复现命令：

```sh
RUNLAB_URL=http://127.0.0.1:4177 XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 bash scripts/with-env.sh node prototypes/runlab/test-belfry-storage-capabilities.mjs
```

探针 ESLint 通过。完整游戏的 IndexedDB 队列尚未接入；能力测试不等于保存/冲突/配额/版本迁移/性能的完整验收。方案见 [本地与云端持久化](../../LOCAL_AND_CLOUD_PERSISTENCE_PLAN.md)。
