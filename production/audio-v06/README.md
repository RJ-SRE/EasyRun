# 音频制作资料（角色语音已停用）

2026-10-25 整理。当前产品决定见 [PRD](../../docs/PRD.md)：游戏不启用角色声音、对白或字幕。本目录保留制作过程，不是浏览器静态资源目录。

| 内容 | 当前用途 |
| --- | --- |
| `dialogue.en-zh.json`、`voice-brief.json`、`audition-order.json`、`efforts-sfx.json` | 停用的导演稿、选角与声音计划；状态字段明确暂停 |
| `runtime-draft/` | 停用的对白数据和调度代码，不由游戏导入 |
| `masters/*.wav` | 56 个原创程序化音效的无损母版，以及两条未采用的 Qwen 主角试音 |
| `foley-log.json` | 当前 56 个运行音效的种子、来源、时长、SHA-256 |
| `production-log.json` | 两条历史试音的生成来源；其中 `/audio/v06/` 是当时路径，当前不部署 |

当前交付音频位于 `prototypes/runlab/public/audio/sfx/`，包括 56 个 AAC 文件和 manifest。它们随 Git 保存，普通构建无需模型、FFmpeg、网络配音服务或重新生成音频。旧系统样音及废弃运行包仅留在本机忽略目录 `.cache/disabled-audio/`。

需要修改音效时，可在安装 NumPy 与 FFmpeg 的制作环境运行 `python3 scripts/render-belfry-foley.py`；它同时更新母版、运行采样及两处来源清单。`FFMPEG` 可指定编码器路径。编码器版本变化可能改变 AAC 校验值，因此生成后应一并审阅音频、清单并重新执行游戏测试。

`scripts/produce-belfry-audio.py`（本机模型）、`scripts/produce-belfry-remote.py`（远程试音）和 `scripts/build-belfry-voice.mjs` 保留为历史工具。当前暂停状态下会直接退出，不生成或接入角色声音。`pnpm game:voice` 也只报告当前已停用；后续恢复需先更新产品决定与重新验收。
