# 环境验证记录

日期：2026-10-23。机器：macOS 26.5.1 / arm64。分支：`codex/environment-setup`。

## 已实际执行

| 检查 | 结果 |
| --- | --- |
| Node 官方压缩包 SHA-256 | 通过，24.22.1 darwin-arm64 |
| `./scripts/setup.sh` 重复执行 | 通过，使用现有运行时、冻结锁文件和已有浏览器缓存 |
| `./scripts/wr doctor` | 必需项全部通过；源码提交与 spx 版本符合固定值 |
| `bash -n` 安装与命令脚本 | 通过 |
| TypeScript、ESLint、Prettier | 通过 |
| FFmpeg → WAV → FFprobe | 1 个测试通过：1 秒、16 kHz、单声道、16-bit PCM |
| 音频转换命令 | 通过，输出格式由 FFprobe 实测确认 |
| Vite 生产构建 | 通过 |
| Playwright Chromium | 6 个测试通过，含合成音频输入 |
| Playwright WebKit | 5 个测试通过；1 个 Chromium 专用音频注入测试按设计跳过 |
| npm 依赖审计 | `pnpm audit --audit-level high` 返回 `No known vulnerabilities found`，仅代表当时依赖数据库结果 |
| 检查页视觉检查 | 已查看完整 Chromium 截图；桌面布局正常；390 px 窄屏无横向溢出由测试确认 |
| VS Code 扩展 | ESLint 3.0.34 / Playwright Test 1.1.19 安装成功；复用 Prettier 12.4.0 |

完整 `./scripts/wr check` 最终退出码为 0。音频测试 1 项通过；浏览器测试 11 项通过、1 项跳过。首次运行的 Chromium headless-shell 因 ICU 数据加载错误失败，已在配置中改用完整 Chromium 无头模式并重新通过整套检查，详情见 [测试安排](TESTING.md)。

本地生成物（不提交 Git）：

- `.cache/environment-report.json`：工具探测结果。
- `.cache/validation.log`：最终整套检查输出。
- `.cache/environment-preview.png`：检查页截图。
- `playwright-report/index.html`：浏览器测试报告。
- `.cache/audio/fixture-16k.wav`：合成音频测试素材，无真人声音。

## 尚未宣称完成的验证

- 真人麦克风、真实网络下的英语 ASR 成功率和延迟。
- XBuilder 编辑器、平台后端的本地构建和部署。
- “语音文本 → XBuilder 角色动作”的接入闭环。
- 任何云 ASR 账号、付费服务、密钥或本地语音模型。
- 真机手机、游戏帧率、学习效果和正式商业产品验收。
- VS Code 扩展内的点击运行流程；当前可复现的验证入口是 `./scripts/wr`。

这些是后续开发阶段的检查点，不影响当前工具链准备和本地诊断页使用。
