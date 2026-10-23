# 测试安排

## 现在可运行的工具检查

| 命令 | 作用 |
| --- | --- |
| `./scripts/wr doctor` | 必需软件、浏览器文件和版本检查，生成 `.cache/environment-report.json` |
| `./scripts/wr typecheck` | TypeScript 类型检查 |
| `./scripts/wr lint` | ESLint 静态检查 |
| `./scripts/wr format:check` | 代码、脚本、配置格式检查 |
| `./scripts/wr test` | 用真实 FFmpeg 生成 WAV，再用 FFprobe 验证格式 |
| `./scripts/wr build` | 构建本地检查页 |
| `./scripts/wr test:e2e` | 对构建产物运行 Chromium 和 WebKit 检查 |
| `./scripts/wr check` | 按依赖顺序执行全部代码与浏览器检查 |

浏览器用例覆盖渲染、键盘、拒绝麦克风、取消权限等待后的音频流关闭、不支持识别 API、窄屏布局，以及 Chromium 合成 WAV 输入的采集和停止。自动化用的是专用测试浏览器，不是用户已登录的 Chrome。

Chromium 显式使用 `channel: 'chromium'` 的完整浏览器无头模式。此次下载的 headless-shell 在本机出现 `icudtl.dat not found in bundle`，完整 Chromium 已单独验证 Canvas 正常；安装脚本使用 `--no-shell`，不依赖该轻量运行器。模式说明见 [Playwright 官方文档](https://playwright.dev/docs/browsers#chromium-new-headless-mode)。

`test:e2e` 依赖已有构建；修改页面后先 `build`，或直接用 `check`。`test:watch` 先运行一次 `audio:fixture`。错误截图、trace 和 HTML 报告分别保存在 `test-results/`、`playwright-report/`，都已忽略。

已安装覆盖率工具，但当前没有游戏逻辑，不能用环境用例的覆盖率声称游戏质量达标。后续补充指令解析、动作状态机和计分逻辑后，再使用 `./scripts/wr test:coverage`。

## 真人语音验收：仍需执行

在本机 Chrome 打开检查页，手动触发麦克风并测试英语。自动化的合成音频没有英语内容，不代表 ASR 通过。

第一轮只确认：权限弹窗、拒绝后重试、能否返回英语文本、切换窗口后是否停止采音、网络异常是否明确提示。记录实际浏览器版本、网络、设备和识别服务，不保存不必要的身份信息。

游戏接入后按 PRD 做 5 人 × 6 指令 × 2 轮，共 60 条有效指令；按“说完 → 动作生效”测量延迟。目标有效指令正确率 ≥90%、P95 ≤1.5 秒，均是待验证目标。

| 需要补测 | 验收重点 |
| --- | --- |
| 错误与迟到结果 | 不因旧结果、重复结果产生二次动作 |
| 否定句 | “Don't jump” 不触发 Jump |
| 按键和语音冲突 | 优先级一致，Stop 等动作不会被过期结果覆盖 |
| 无权限、无网络、无 API | 仍可完成按键玩法；可见提示不打断整局 |
| 不同英语水平 | 提示与语速适配；识别成功不能冒充发音评分 |
| 游戏性能 | 在真正的游戏场景和目标设备上测帧率，不能用诊断页帧率代替 |
| 多主题与难度 | 同一关卡切换外观不改变碰撞；语言与动作难度独立 |

第三天重点跑完整流程和演示设备回归。真实 iPhone / Android 浏览器仍需真机测试，WebKit 自动化不能代替 Safari 系统权限、麦克风和语音服务的实测。
