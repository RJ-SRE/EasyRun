# 美术与资产来源

当前 v0.8 资产状态（2026-10-25）：五类刺客及补充图集共 42 个姿势，主角技能三帧与既有动作图集，82 个本地动作 / 材质采样与 3 首用户提供的 Sea Power 背景音乐；角色语音不运行。下文按制作时间保留历史记录，56 个采样、旧机械敌人等数字不是当前总量。

断环刻印、成就册和 16 个徽记是仓库中的 CSS / SVG 路径设计，分别见 `prototypes/runlab/public/inscription*` 与 `belfry-achievements*`，没有下载其他游戏 UI。三十词远征的旧概念图属于 [后续美术提案](planning/thirty-word-expedition/ART.md)。本轮另生成五张城市运行背景并实际导入引擎，详见本文末尾及 [城市实现](CITY_V08.md)。原图与提示词继续保留，生成拆帧和导出包不重复纳管。

以下原始绘制素材在各制作阶段由内置 `image_gen.imagegen` 生成，提示词与源图随仓库保存；下表先记录早期风机墓场的来源，不对生成内容的权利状态作额外保证。第三方运行时和工具遵循各自许可，仓库未替它们重新授权。下面的早期记录保留原阶段语境。

| 源资产                                                | 用途                  | 生成/维护依据                 |
| ----------------------------------------------------- | --------------------- | ----------------------------- |
| `prototypes/runlab/art/rupture-v2/storm-city.png`     | 风暴机械遗迹背景      | 同目录 `prompts.json`         |
| `prototypes/runlab/art/rupture-v2/turbine.png`        | 透明风机叶片          | 同目录 `prompts.json`         |
| `prototypes/runlab/art/rupture-v2/wanderer-atlas.png` | 原始九宫格动作        | 同目录 `hero-prompt.txt`      |
| `prototypes/runlab/art/rupture-v2/run-cycle-v3.png`   | 补充十二帧跑步        | 同目录 `run-cycle-prompt.txt` |
| 平台、机关结构、雨幕、粒子                            | 程序化 SVG            | `build-rupture.mjs`           |
| 两款早期原型几何美术                                  | 对照实验              | `build-games.mjs`             |
| 可选动作声音                                          | 浏览器合成噪声/振荡器 | `public/rupture.js`           |

## 导入与再生成

`extract-frames.mjs` 将源图按网格拆分，跑步纹理归一到 418×418，保留 alpha。原图不覆盖；重心注册保存在 `build-rupture.mjs` 中。相邻帧混合与落地回弹在运行时进行，不把效果烘焙回原图。

```sh
bash scripts/with-env.sh node prototypes/runlab/extract-frames.mjs
bash scripts/with-env.sh node prototypes/runlab/extract-frames.mjs --run
```

生成的 `frames/`、`run-frames/` 和 `public/art/` 是可重建副本，不重复提交。新增美术请同时记录来源、用途、提示词或制作方法、原图与导入方式。未来公开销售前，另行确认实际发行平台与资产使用条件。

现有图集存在关节、衣摆和周期一致性需要精修的问题，不能把“帧数增加”直接当成美术验收通过。

## v0.4 倒悬钟城新增素材

所有下列新图使用本次会话的 **内置 image_gen.imagegen** 生成，未使用 CLI 或外部素材下载。原图复制入 `prototypes/runlab/art/belfry/`，运行路径不依赖 Codex 默认图片目录。

| 文件                   | 用途与来源记录                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `clockwell.png`        | 原创倒悬钟城背景；完整提示词在 `prompts.json`                                       |
| `sentinels-source.png` | 提灯者、织缆者、钟卫透明图集；提示词在 `prompts.json`                               |
| `ledge.png`            | 原创雕花平台；提示词在 `ledge-prompt.txt`                                           |
| `actions-source.png`   | 以原 `wanderer-atlas.png` 为身份参考生成八格动作图集；提示词在 `actions-prompt.txt` |
| `frames/`              | 生成器导入的副本，保留 alpha、按边界分格/归一尺寸；忽略入库并可重建                 |

基础主角和 12 格跑步仍来自 `art/rupture-v2/`，详见上文。新图透明通道已检查；原图不被覆盖。图集重心与非均匀行分界在 `build-belfry.mjs` 明确注册。

锚点、钟锁、绳段、护罩、钟盘、粒子和其他指示采用项目自绘 SVG；声音由网页内 Web Audio 合成，未引入外部音乐或商业游戏素材。当前素材适合作为实际关卡资产验证，动画一致性与最终商业美术仍需独立评估。

## v0.5 战斗素材（2026-10-24）

- `prototypes/runlab/art/belfry/combat-source.png`：12 个原创持弦者战斗关键姿态，内置 imagegen，以本项目动作原图为角色参考。提示词 `combat-prompt.txt`。
- `prototypes/runlab/art/belfry/mimic-source.png`：模仿侍从 2×2 姿态，以原敌人图集为风格参考。提示词 `mimic-prompt.txt`。
- 原图保留透明 alpha。构建导入为统一画布和脚底基准，源图保持原样，生成拆帧忽略。
- 新斩弧、蓄力环、绊索和钟波为项目生成的 SVG，渲染于 spx。

## 当前运行音频 · 2026-10-24

按用户要求停用角色语音与对白。运行目录 `public/audio/sfx/` 只有 56 个原创程序化动作/材质采样，包含刀风、衣料、钩索、瓷裂、铜壳和危险预警；不是演员录音。生成器为 `scripts/render-belfry-foley.py`，母版及来源清单保留在 `production/audio-v06/`。两条 Qwen 原创主角试音仅作制作资料保留，未启用于当前游戏；旧系统样音和废弃运行包归档到忽略目录 `.cache/disabled-audio/`。

制作目录的当前用途、归档边界与可重建命令见 [音频制作资料](../production/audio-v06/README.md)。旧 44 条系统样音已停用，不作为当前游戏资产交付。

## 2026-10-25 · 五类刺客图集

使用内置 image_gen 生成原创透明 PNG，已复制到 `prototypes/runlab/art/belfry/`：`assassin-hover-source.png`、`assassin-fighter-source.png`、`assassin-archer-source.png`、`assassin-chain-source.png`、`assassin-binder-source.png`。每套六个关键姿势；原图不改写，导入切片与注册可复现。完整提示词与输出来源见同目录 `assassin-prompts.json`。旧 sentinel/mimic 原图保留为历史制作资料，不再进入当前敌人图集。

武器轨迹、箭矢、壁龛与提示继续使用仓库原有 SVG 绘制流程；游戏没有新增运行时美术或语音服务依赖。

短锋另外补充 `assassin-elbow-source.png` 两个专用肘击姿势，避免肘击复用刀劈动作；对应提示词 `assassin-elbow-prompt.txt`，使用内置 image_gen 参考短锋原图生成。

## 2026-10-25：忍者进阶姿势

通过内置 imagegen 编辑既有角色图集生成，透明背景、继承角色服装与轮廓：

- `prototypes/runlab/art/belfry/ninja-fighter-source.png`：六帧，撤步、架势、起跳、飞踢、落地、复位。
- `prototypes/runlab/art/belfry/ninja-archer-source.png`：两帧，蹬墙、空中射箭。
- `prototypes/runlab/art/belfry/ninja-chain-source.png`：两帧，低扫蓄势、低位甩链。
- 完整提示词、参考原图、生成原件路径与工程输出：`prototypes/runlab/art/belfry/ninja-prompts.json`。

沿用 alpha 连通区域裁帧和同图集统一尺度，不使用独立姿势各自拉满画布的缩放。实体链节、格挡标记由仓库 SVG 定义生成。游戏里不加载生成服务；资源均在本地包内。

## 2026-10-25：铭文远征与四技能整合

- 保留五类刺客及三张 ninja 图集，共 42 个敌人姿势；不重新生成或替换其身份。
- `prototypes/runlab/art/belfry/skills-source.png` 与 `skills-prompt.txt` 来自技能工作树；蓄弓、放箭、回息三帧，配合仓库生成的刀光/箭矢/裂印。
- 新增 26 个技能采样及来源母版在 `production/skills-v06/`；`public/audio/sfx/manifest.json` 合并为 82 条，原 56 条哈希保持一致。
- 铭文界面使用仓库原生 CSS/文字，沿用深墨、冷灰与暗铜；没有下载他人游戏 UI 或恢复人声资源。
- CET-4 成员出处、许可与义项编写边界见 WORD_BANK.md；词条不是图片或付费字典内容的复制。

## 2026-10-25 · 五区实际运行背景

本轮使用内置 imagegen 文生图模式，生成五张原创区域背景，均为不透明 PNG、1536×1024，无参考图编辑与外部素材下载：wind.png、forge.png、archive.png、mirror.png、heart.png。源文件在 prototypes/runlab/art/belfry/city/，完整英文提示词在同目录 prompts.json。

belfry-city-art.mjs 将五图作为引擎精灵打包，按镜头深度渐变并作低幅视差；网页纪事使用同图缩略图。水面、风迹、镜片、配重架和机关道具由仓库 SVG 生成。背景不是碰撞地图，机关实体判定在 City.spx / Hero.spx。当前构建为 401 个项目文件、58 类精灵；生成清单不重复纳管。新图增加资源量，低端设备和首次下载性能仍待测。

## 2026-10-25 · 移除钟鼓成分

保留 82 个采样 ID，其中重制 25 个：brass / heavy / land / nova 的共鸣与低鼓、heavycut / chainfinish 的低鼓层、markbreak 的低音敲击，以及 healcomplete 的铃音和弦。刀风、弓弦、钩索等其他 57 个文件保持原哈希。两份离线生成器、对应 WAV 母版、AAC 运行文件与来源清单同步更新；旧音频可从 Git 历史恢复。

网页环境 / 关键事件不再生成钟鸣，聚焦不再循环低音鼓感脉冲或逐字泛音；环境与聚焦只保留无音高的低音量气流。动作事件、危险预警、音量、静音、暂停和存档约定保持。

## 三阶段音乐 · 2026-10-25

按用户指定从本地桌面复制三份 Sea Power MP3：Melancholy Of The Boot、Cleaning out the Rooms (Wandering Horn)、Strange Sports。运行副本位于 `prototypes/runlab/public/audio/music/`，原文件未修改、未转码。共 34,043,869 字节，各自文件名、时长、大小和 SHA-256 见 [清单](../prototypes/runlab/public/audio/music/manifest.json)。这三首是用户提供的第三方录音，不属于程序化原创采样；曲目映射与维护方法见 [场景音乐](SCENE_MUSIC.md)。
