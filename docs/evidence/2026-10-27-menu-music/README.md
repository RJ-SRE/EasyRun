# v0.15.3 网页菜单音乐恢复

2026-10-27。本地修订，原生 `.xbp` 继续使用 v0.15.2，未推送远程。

## 复现与修改

旧提交 `213d6a4` 的菜单首屏尚未初始化音频；点击菜单可以正常播放 Cleaning out the Rooms。测试主动挂起真实 AudioContext，再次点击菜单后仍为 suspended，曲目时间停在约 0.215 秒，但播放按钮被隐藏。这证明恢复条件遗漏了音频上下文状态；不能仅以 `unlocked=true` 判定已有声音。

开始页现在只尝试一次自动播放。允许时直接播放；遇到策略阻止或音频中断时，入口保持可见，真实点击 / 按键可恢复原上下文。监听覆盖父页面与游戏 iframe。82 个短音效等首次交互再预加载，避免无交互时一次性解码。用户主动关闭声音或音乐音量为 0 时，不自动更改偏好。

## 验证

- [菜单专项](menu-audio.json)：6 项通过。读取真实 Web Audio 输出，检查自动起曲、挂起后菜单点击 / 播放按钮恢复、显式静音、被拒绝后首次真实手势，以及 0 音量保留。
- [音乐回归](music.json)：17 项通过。含真实游戏 iframe 输入恢复音频；曲目 / 时长 / 循环、暂停、独立调音、单词期间正常音乐增益、后台恢复、故障重试均通过。

允许自动播放的路径采用 Chromium 明确允许策略。无头自动化可能赋予激活权限，因此拒绝路径使用测试专用夹具：媒体播放返回 NotAllowedError，AudioContext 保持挂起且 resume Promise 等待真实输入；手势到来后恢复真实音频输出。设备中断通过真实 AudioContext.suspend 模拟，不替换游戏状态。未将这一模拟当成所有浏览器策略的实机验收。

挂起的 Analyser 缓冲会保留最后一帧样本，测试结合 context.state 区分冻结数据和当前输出。此次未读取用户正在打开的内置浏览器运行状态：自动化工具未提供该浏览器，只在同一地址独立复现。没有更改用户的静音偏好、操作系统声音或浏览器权限。

## 重测

```sh
RUNLAB_URL=http://127.0.0.1:4177/ bash scripts/with-env.sh node prototypes/runlab/test-belfry-menu-audio.mjs
RUNLAB_URL='http://127.0.0.1:4177/?words=on' bash scripts/with-env.sh node prototypes/runlab/test-belfry-music.mjs
```

刷新网页加载修复。音频资源、曲目映射、音量值、原生导出与游戏规则均未改变；本轮未重复原生包、整关或性能验收。
