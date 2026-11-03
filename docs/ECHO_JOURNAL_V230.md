# v0.23.0 · 回声札记

## 产品目的

通关后，覆盖本局全部答错词，把它们转换成能带回生活的表达。战斗仍负责挑战，结算后的札记负责解释；AI 不介入攻击判定、成绩、词库或成就。

胜利结算在「再入钟城」右侧并排显示「回声札记」，两按钮等高对齐；网页版与 XBuilder 导入版同步。XBuilder 的音量控制下移，避免与入口重叠，窗口缩放时入口跟随舞台位置。打开后立即看到游戏计算的学习摘要，点击「生成札记 · AI」才请求模型。纯动作通关、未实际答题或本局没有答错词时只显示摘要，不发请求。失败结算暂不提供札记入口。

## 一次完整体验

1. 本局开始时建立独立的作答记录；普通重开重置本局证据，检查点续行保留网页版已记录的证据。
2. 拼写／辨义分别记录正确、错误、超时和辅助正确。取消题目不计作失败；重复的技能结算不会重复记账。
3. 通关后显示实际作答词数、本局错词数、独立拼写正确次数。未碰到的词不会计为完成。
4. 收录本局所有拼写／辨义答错的词（最多覆盖本局 30 词），按词 ID 去重，按两种错误的合计次数降序排列，同次数按 ID 排序。之后答对也不会删除本局曾经答错的词。超时单独统计，不算答错；只有正确／辅助正确／超时的词不会为了凑数进入 AI 词卡。
5. 词卡展示中文用法、英文搭配、日常例句与翻译、钟城语境例句与翻译。玩家可以切换两种例句。取消结束语、造句建议与重复说明；旧报告包含这些字段时也不显示。
6. 每批最多 3 词，逐批请求并立即展示已完成词卡；3 是单次请求大小，不是整份报告的上限。显示生成进度，失败后点击「继续生成」仅补剩余词，不自动重试。最新一份完整生成成功的札记保存在当前浏览器；菜单可回看，同一份报告不重复请求。使用右上角 × 或 Esc 关闭。
7. 可以随时合上札记。进入新局会取消旧请求，旧结果不能覆盖新局。清除本地缓存会同时清除札记并阻止迟到结果写回。

只有完整通过校验的报告写入持久缓存；中途生成的草稿保留在当前运行内存，关闭／重新打开本局窗口仍可继续，刷新或进入新局后不保留草稿。只保留最近一份成功生成的札记。生成新报告后会替换旧报告；失败不会覆盖上一份成功报告。跨设备同步、长期札记档案、自由聊天、发音和 AI 自动修改复习计划不在本版范围。

30 个词名保持单行横向滚动，选中词自动滚入视野；不会铺成多行挤占正文。短窗口收起顶部统计，让出阅读空间。阅读窗口以当前可见游戏舞台为边界，预留内侧安全距离；顶部关闭入口与底部切词栏固定，只有正文滚动。切词支持「上一词 / 下一词」、左右方向键与顶部词名，显示当前序号，首尾不循环。切换后正文回到开头，保留生活／钟城例句模式，不重新请求模型。只有一个词时不显示切词栏。生成成功后收起生成按钮和常态提示，加载与错误仍显示必要状态。

## 证据与数据边界

每批模型只收到最多 3 个错词的词头、词性、目标释义、语境和本局作答摘要，以及「通关」状态。全部批次覆盖所有错词。不发送用户名、账户 ID、完整存档、全词库或整局键盘输入。

拼错保留最多两次首错片段，长度有上限。首错即取消产生的是片段，提示词明确禁止将其当成完整误拼；超时也不能推断为不会。模型不得编造成绩、评定 CEFR 或宣称玩家已经掌握。

统计由游戏代码计算，模型返回的额外统计字段被丢弃。报告必须包含恰好对应的词条 ID，缺项、重复卡片、非 JSON、过长响应会被拒绝。内容通过 `textContent` 显示，不解释 HTML。用法与翻译仍属于 AI 辅助内容，结构验证不能保证语义永远正确。

快照升级为 v2，旧 v1 报告作为「历史选词」仍可阅读，不伪装为全量错词回顾；v2 只接受存在真实错误记录的词。旧版本正在进行的旅程没有完整分能力事件；升级后只统计新记录的作答，不从旧累计历史伪造本局证据。`.xbp` 本局证据保存在运行内存，已生成札记可在同源、同用户名档案下跨次回看；网页版与 XBuilder 的存储来源不同，不自动互通。

## 两端接入

### 网页版

`inscription-core.js` 在现有结算防重逻辑后记录证据。`inscription-ui.js` 在胜利状态生成快照，交给共用的 `EchoJournal` 窗口。

浏览器向同源 `/api/echo` 发请求。开发服务器仅监听 `127.0.0.1`，校验 Host／Origin、方法、大小和词条；由 Node 读取本机私有配置，再调用 MaaS。浏览器资源中没有 API 密钥。

完整快照支持 30 词，代理单次最多接受 3 词，超量请求被拒绝而非静默截断。服务端合并同内容并发调用，缓存最近 12 批结果；不同请求串行，最短发起间隔 3 秒。客户端两批发起至少间隔 3.1 秒，同一时间只处理一批；每批上游超时 60 秒，客户端每批 65 秒，整份报告不共用一个 65 秒倒计时。无自动重试、无自动切换付费模型，重新点击才重试。该代理是本地开发服务，没有公网用户认证和配额系统，不能直接当公网生产后端。

### XBuilder `.xbp`

`NativeEcho.spx` 从原生作答、开局、胜利与档案清除事件接入共用逻辑。原生 `en:` 词条标识转换为网页词头 ID；学习档案的原标识不变。

通过运行器已有的 `syscall/js` 挂载 HTML 文本面板，不创建 AI 字形精灵，不扩张动态字库。网络只在主动生成时触发。桥接最多 5 Hz 检查显示状态，DOM 状态未变化时不重写界面；战斗中不生成模型内容。

弹窗内按键与底层技能隔离，关闭后恢复画布焦点，并留 180 ms 的按键隔离期。面板采用冷色半透底、旧金细线和宋体标题，小窗口可滚动，保留可见的关闭入口。窗口不切换游戏音乐。

## 配置与构建

真实地址、模型和密钥保存在 `.local/ai/maas.json`，该目录被 Git 忽略。本机文件权限为 `0600`。模板是 `services/echo/config.example.json`，不得用真实配置覆盖模板。

```sh
# 配置文件由本机持有人填写；不粘贴到 Git、日志或 PR。
mkdir -p .local/ai
cp services/echo/config.example.json .local/ai/maas.json
chmod 600 .local/ai/maas.json

# 网页本地试玩：修改服务端后需重启。
RUNLAB_PORT=4188 bash scripts/with-env.sh node prototypes/runlab/server.mjs

# 默认导出：不嵌入任何 AI 密钥，仍可显示本局摘要。
bash scripts/with-env.sh python3 prototypes/runlab/package.py --game belfry

# 明确选择的私有联调包：构建时从本机配置注入。
ECHO_BUILD_MODE=embedded-test bash scripts/with-env.sh python3 prototypes/runlab/package.py --game belfry
```

`.xbp` 是可以解压的工程包。构建注入不是加密，密钥可以从包和网络请求中提取。因此带密钥文件只作私有联调，不作为公开作品包。默认构建是 `disabled`，不会读取私有配置；生成的 `native-echo-manifest.json` 明确记录本包是否带密钥。将来公开发布需换成受控 HTTPS 代理。

本轮本地交付包：`prototypes/runlab/exports/EasyRun-XBuilder-v0.23.0-all-errors-private-test.xbp`。私测包及实际凭据留在本机；源码与验证记录纳入版本控制；私测包仍留在本机，不导入或覆盖线上作品。下方证据里的提交／推送状态是测试当时的快照。

## 验证入口

```sh
bash scripts/with-env.sh node --test services/echo/echo.test.mjs prototypes/runlab/test-inscription-core.mjs
python3 prototypes/runlab/test_native_echo.py
RUNLAB_URL=http://127.0.0.1:4188 bash scripts/with-env.sh node prototypes/runlab/test-belfry-echo-web.mjs
RUNLAB_URL=http://127.0.0.1:4188 XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 bash scripts/with-env.sh node prototypes/runlab/test-belfry-echo-native.mjs
# 可选：使用本机配置做一次真实请求；默认测试只用合成响应。
ECHO_LIVE_TEST=1 RUNLAB_URL=http://127.0.0.1:4188 bash scripts/with-env.sh node prototypes/runlab/test-belfry-echo-native.mjs
```

测试用隔离 Chromium、合成学习数据和测试内的胜利事件，不修改玩家存档。原生验证使用已缓存的 XBuilder 编译器／资源与完整工程包；网页版用真实技能、键盘作答和结算链路。真实 MaaS 测试只发送测试词与合成表现。

初版结果记录在 `docs/evidence/2026-11-02-echo/validation.json`；全量错词更新记录在 `docs/evidence/2026-11-02-echo-all-errors/validation.json`。没有发布到在线作品进行整局验收；未来运行器的 CSP、DOM 桥接或跨域策略改变时，仍需重验。桥接失败会关闭该附加窗口，不让它中断核心游戏。

## 文件分工

| 文件 | 职责 |
| --- | --- |
| `public/echo-core.js` | 事件摘要、排序、提示词、输入／输出结构校验 |
| `public/echo-journal.js`、`.css` | 两端共用的报告窗口、请求状态与本地回看 |
| `services/echo/service.mjs` | 本机代理、私有配置读取、并发／超时／返回校验 |
| `spx/belfry/NativeEcho.spx` | 原生事件与 DOM 桥接 |
| `native_echo.py` | 构建时模式选择与私有配置注入 |

表中 `public`、`spx` 与 Python 文件位于 `prototypes/runlab/`。

七牛接口契约参考：[Chat Completions](https://developer.qiniu.com/aitokenapi/13390/chat-completions)、[实时调用](https://developer.qiniu.com/aitokenapi/13379/real-time-ai-interface-api)。模型是否可用、免费额度和限流以账户及平台返回为准；本版不自动切换付费模型。
