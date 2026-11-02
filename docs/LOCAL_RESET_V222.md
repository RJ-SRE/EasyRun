# v0.22.2 · 清除本地缓存

远征设置的「铭文」页底部加入独立的「清除本地缓存」入口，与换词操作分隔。沿用静水圣庭的微透深色底、象牙文字与旧铜细边。点击后显示小型确认窗口，默认焦点为取消；确认清除后恢复默认设置和新的 30 词远征。

## 玩家体验与范围

- 清除当前档案的拼写／辨义历史、错词与复习安排、学习成就、远征进度、通关记录和设置。
- `.xbp` 以当前运行器用户名对应的本机档案为范围；未登录时为独立游客档案。其他用户名的记录保留。
- 网页版清除本游戏在当前浏览器来源下的词册、导入备份、旧战绩与成就、音量和减少动态设置。资源图片、音频文件及其他作品、平台登录信息不在清除范围。
- 取消与 Esc 返回原设置；Enter 不会在原生确认页直接执行删除。清除过程中屏蔽底层菜单快捷键，避免意外开始游戏或切换档案。
- 成功后原生版显示完成页并重建空档案，网页版重新加载菜单。音乐／音效默认恢复 75%／85%，单词选择恢复普通，拼写为 2 秒渐隐，作答节奏为标准。
- 失败显示重试入口；原生事务中止时删除和档案头一起回滚。开发验证使用隔离浏览器，不会执行用户现有档案的清除。

## 持久化与并发

### XBuilder 原生包

`NativeLocal.spx` 等待正在进行的保存结束，再打开仅针对当前档案的 IndexedDB 读写事务。通过 `words.byProfile` 取当前档案主键，包括不再属于现行词库的旧词，逐项删除；同一事务写入清零后的档案头。

档案头保留单调递增的 `revision`，防止旧窗口在清除后仍以先前版本写入旧学习记录。内存学习数组、成就与设置只在事务成功后重建。异步回调继续使用 epoch 隔离并释放，开始、等待、错误和完成页复用 `NativePanel` 造型，没有新增固定 UI 精灵或世界克隆。

### 网页版

`inscription-storage.js` 将保存和清除排入同一队列，并用 Web Locks 与其他窗口串行。先完成排队保存，再删除大型词册，随后按明确键名清理游戏自己的 localStorage 和续行标记。保留一个不含学习内容的清除世代标记，用于拒绝清除前窗口的后续保存。清除页本身在重新加载前也停止自动保存。

本操作涉及 IndexedDB 和 localStorage 两套 API，不能声称具有跨两套存储的单一事务。界面只有全部步骤完成后才显示成功并重载；异常会显示失败提示。当前现代 Chrome／Chromium 支持安全清除所需的 Web Locks；缺少时拒绝执行并提示重试环境，避免默默降级并发保护。原生包不依赖 Web Locks。

## 验证入口

```sh
RUNLAB_URL=http://127.0.0.1:4177 bash scripts/with-env.sh node prototypes/runlab/test-belfry-local-reset.mjs
LOCAL_TEST_OUT=2026-11-01-local-reset XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 RUNLAB_URL=http://127.0.0.1:4177 bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-reset.mjs
```

验证覆盖：取消、实际确认入口、大小词册存储、排队写入、事务中止、重试、其他用户及无关存储保留、旧窗口防写回、重新运行恢复、默认音量和窄窗口边界。截图与结果见 `docs/evidence/2026-11-01-local-reset/`。

本次交付 `prototypes/runlab/exports/belfry-local-reset.xbp`，桌面副本 `EasyRun-XBuilder-v0.22.2-local-reset.xbp`。不提交、不推送 Git，不导入或覆盖线上作品；旧版本包保留。
