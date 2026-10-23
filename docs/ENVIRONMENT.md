# WordRunner 本地开发环境

基线日期：2026-10-23。验证机器：macOS 26.5.1 / Apple Silicon（arm64）。

当前准备的是三天原型共用的开发和测试环境，优先验证 XBuilder。`src/` 是环境检查页，还不是跑酷游戏。网页工具链用于语音验证、测试和可能的外部桥接，不代表已经确定改用独立网页游戏。

## 工具与安装位置

| 用途 | 工具 / 固定版本 | 本机位置 / 状态 |
| --- | --- | --- |
| 项目运行环境 | Node 24.22.1 LTS | `.tools/node-v24.22.1-darwin-arm64/`；官方压缩包经 SHA-256 校验 |
| 包管理 | pnpm 11.9.0 | `.tools/package-manager/`；不覆盖全局 pnpm |
| 本地服务 / 构建 | Vite 8.3.5 | 项目 `node_modules/` |
| 类型检查 | TypeScript 5.9.3 | 保持与当前 XBuilder、TypeScript ESLint 的版本约束兼容 |
| 逻辑 / 工具测试 | Vitest 5.0.5 + coverage-v8 | 已安装覆盖率工具；环境测试通过不代表游戏覆盖率 |
| 浏览器自动化 | Playwright 1.64.1 | Chromium 156 / WebKit 27.2 下载到 `.cache/ms-playwright/` |
| 静态检查 / 格式 | ESLint 10.13.0 / Prettier 3.9.10 | 项目依赖，准确版本在 `package.json` 与锁文件中 |
| 音频处理 | FFmpeg / FFprobe 9.0.2 | Homebrew 安装到 `/opt/homebrew/` |
| 引擎运行包 | `@xgo-pkgs/spx` 3.3.0 | `node_modules/@xgo-pkgs/spx/`，包含预编译 WASM、引擎和运行页面 |
| 编辑器源码参考 | XBuilder `e2a4c45dfa0574ac7700fad94d2d4a6da7da8083` | `.tools/xbuilder/`，仅下载固定提交，未编译部署完整平台 |
| 日常开发 | Git 2.50.1 / VS Code / Chrome | 复用本机已有软件 |
| 备用工具 | Go 1.25.5 / Docker CLI 29.2.1 | 本机已有；当前检查页不依赖 Docker，未验证 Docker daemon |

本机全局 Node 25.2.1、pnpm 10.28.0 保留。项目所有命令通过 `./scripts/wr` 使用本地版本，不需要修改 shell 配置。

VS Code 已补装 ESLint 3.0.34 和 Playwright Test 1.1.19 扩展；Prettier 12.4.0 和 Go 0.58.0 原本已安装。推荐列表在 `.vscode/extensions.json`。

FFmpeg 使用 Homebrew 官方 formula。安装同时拉取音频编解码库，并更新了 Homebrew 的 libvmaf、ca-certificates、x265、xz；OpenSSL 4 作为依赖安装并接管了 Homebrew 的默认 OpenSSL 链接。未删除旧 OpenSSL 3 的安装目录，未修改 tap 信任设置。

## 日常入口

在仓库根目录执行：

```sh
./scripts/wr doctor       # 检查运行时、音频工具、浏览器和 XBuilder 文件
./scripts/wr dev          # http://127.0.0.1:5173
./scripts/wr check        # 类型、Lint、格式、音频测试、构建、双浏览器测试
./scripts/wr test:report  # 查看上次 Playwright HTML 报告
```

检查页支持 Canvas 动画、六个按键、麦克风音量和浏览器英语识别。麦克风检查只在用户点击后开始，8 秒自动停止；识别尝试最多等待 10 秒。切走页面会关闭采音。本页不保存录音或识别文本；浏览器的语音服务可能需要把音频发送到其服务器。

默认只监听本机 `127.0.0.1`，开发端口 5173，测试预览端口 4173。端口占用会明确报错，不自动换端口。手机通过局域网访问时必须另外安排 HTTPS 和设备验证；不能把本机测试等同手机验收。

## 换机 / 重新准备

需要网络、Git、curl、tar、shasum；macOS 如需安装 FFmpeg，还需已有 Homebrew。

```sh
./scripts/setup.sh
./scripts/wr check
```

也可以分步运行：

```sh
brew install ffmpeg                     # 已安装时可省略
./scripts/bootstrap.sh                 # Node、pnpm、项目依赖、Chromium、WebKit
./scripts/setup-xbuilder-reference.sh   # 固定版本的 XBuilder 源码
./scripts/wr doctor
```

Node 从 nodejs.org 下载，并对照同版本官方 `SHASUMS256.txt` 校验后解包；npm 包使用锁文件的 integrity 校验；测试浏览器由 Playwright 官方下载器安装。下载过程没有关闭 TLS 校验，也没有改用未核验镜像。

后续安装依赖使用：

```sh
./scripts/wr add -D --save-exact <包名>@<版本> --store-dir .pnpm-store
```

`pnpm-lock.yaml` 进入 Git。运行时、源码参考、下载缓存、浏览器和 `node_modules` 不进入 Git，可由脚本重新下载。`setup.sh` 不会把诊断页部署到公网，也不会登录第三方账号。

## 音频准备

```sh
./scripts/wr audio:fixture
mkdir -p recordings
./scripts/wr audio:convert /path/to/input.m4a recordings/jump-16k.wav
```

转换输出为 16 kHz、单声道、16-bit PCM WAV，适合后续按识别服务要求做接入测试；具体服务仍须核对自己的输入格式。脚本拒绝覆盖已有输出文件。`recordings/` 已忽略，不上传真人录音。

`audio:fixture` 只生成 1 秒正弦波，用于检查格式和采集链路，不能用于评估英语识别效果。

## XBuilder 使用边界

- 官方入口：[七牛 XBuilder](https://x.qiniu.com)、[国际入口](https://xbuilder.com)。
- 已下载源码和 `spx` 预编译运行包，后续可查阅 API、运行器和嵌入方式。
- 完整 XBuilder 是另一个平台工程。其编辑器、账号、后端和 WASM 编译有独立依赖；本次未安装整套平台，也未把它误记为本地可用的游戏编辑器。
- 当前无须编译 Godot、安装本地大语音模型、引入数据库或启动容器。若后续选型确实需要，再补齐对应组件。
- 云 ASR SDK、服务密钥和付费账号尚未选定。浏览器识别可用于试验，但必须验证目标网络和浏览器；不能据 API 存在判定可用。
- AI 剧情已进入 PRD，服务端代理、模型供应方、模型标识和可用额度尚未配置或验证。D1 先验证真实调用，再按所选服务补充必要依赖；当前无需本地大语言模型、向量数据库或新建账户系统。私有密钥只存服务端环境，不能写入 `VITE_*`、客户端或仓库。

XBuilder 当前源码声明 Node `^24.11.1`、pnpm `^11.9.0`。本项目本地版本满足它的这两项约束；不意味着所有编辑器编译依赖已经完成验证。

## 下一阶段顺序

1. 第一优先：真人说英语 → 返回文本，记录目标 Chrome / 网络的可用性和延迟。
2. 在 XBuilder 做单动作桥接：说 “Jump” → 角色只跳一次，按键仍可用。
3. 同在 D1 前两小时内，用约半小时验证 AI 真实调用、响应结构、额度与数据处理规则，晚上搭建代理和回退。前两项语音工作约占其余 1.5 小时；以 PRD 新排期为准，不能各自叠加成额外工时。
4. 闭环成功后，搭建六动作、关卡、任务卡与三个 AI 剧情节点。语音路线不通过时及时选定替代识别服务；模型不通过时记录 AI 缺项并保留可玩回退，不用模拟结果冒充真实验收。

测试细则见 [TESTING.md](TESTING.md)。实际验证结果见 [ENVIRONMENT_VERIFICATION.md](ENVIRONMENT_VERIFICATION.md)。

## 官方参考

- [Node 版本与生命周期](https://nodejs.org/en/about/previous-releases)
- [XBuilder 开发说明](https://github.com/goplus/builder/blob/e2a4c45dfa0574ac7700fad94d2d4a6da7da8083/docs/develop/index.md)
- [XBuilder 前端依赖声明](https://github.com/goplus/builder/blob/e2a4c45dfa0574ac7700fad94d2d4a6da7da8083/spx-gui/package.json)
- [Playwright 安装与运行](https://playwright.dev/docs/intro)
- [Vite 使用说明](https://vite.dev/guide/)
- [Vitest 使用说明](https://vitest.dev/guide/)
- [SpeechRecognition 的兼容性与网络限制](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
