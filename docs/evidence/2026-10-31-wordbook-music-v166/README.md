# v0.16.6 · 词册音乐连续播放

2026-10-31。修复 XBuilder 独立导入包按 Tab 看词册时背景音乐停止的问题。

## 原因和行为

原生词册把战斗阶段从 1 切到 4，以冻结移动、敌人、技能和战斗计时；原先音频直接把所有阶段 4 当成音乐暂停。现在依据词册打开前的状态区分：从战斗打开词册时继续播放当前曲目；从主动暂停打开则保持暂停。B 静音、音乐 0%、题目主动暂停等规则保持原状。关闭词册不切曲、不重播。点击铭文进度和 Tab 共用该入口。

只修改原生音乐状态判断。没有改变网页版、音乐资源、音量默认值、单词机制、控件或关卡；没有推送远程或修改在线项目。

## 验证

[实际音频回归报告](native-music.json)：19 项通过、错误为零。测试使用真实 `.xbp`，经过固定部署版 XBuilder 项目模型往返，编译运行后从引擎实际音频输出采样，不只检查状态变量。

- 菜单、战斗、结算中以 Tab 打开，翻页，Esc 关闭，曲目没有暂停/恢复/重播事件，输出保持非零。
- 战斗查看词册时计时冻结；战斗背景音乐采样期间关闭动作音效，避免把操作声音误判为背景音乐。
- 已经 B 静音、音乐音量 0% 或主动 Esc 暂停时，词册不会解除原状态。
- 深层五区、重复攻击、切曲、独立音量与静音、答题正常播放、循环回归通过。
- 循环加速检查仅在测试副本使用一秒音乐片段，交付包仍为三首完整音乐；测试未上传至在线项目。
- 定向 ESLint、Prettier 与 `git diff --check` 通过。本轮没有重新测试性能或通关。

## 交付

桌面：`EasyRun-XBuilder-v0.16.6-wordbook-music.xbp`，134,773,901 字节、5,057 个 ZIP 条目，CRC 通过。与 v0.16.5 比较仅 `NativeLogic.spx` 内容变化，全部美术、歌曲、音效、词库和其他脚本字节一致。

SHA-256：`7a15388980cb73ab3fd47350a210c7c98332ba7ff215aa75ba6294efb622617a`。桌面文件与构建产物一致，详见 [文件记录](artifact.json)。需要重新导入新包，旧版保留供回退。

复现：

```sh
python3 prototypes/runlab/package.py --game belfry
RUNLAB_URL=http://127.0.0.1:4177/ \
XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 \
XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js \
NATIVE_AUDIO_LABEL=native-music-v166 \
bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-music.mjs
```
