# 美术与资产来源

> v0.21.1 恢复 Boss 原图及原钟城背景，停止调用全身色阶与侵蚀层生成器，撤回程序化环身装饰。新的三形态结构概念图使用内置 imagegen，参考原 `keeper-v2-source.png`，仅为策划图，不进入运行资产；提示词与来源保存在 `design/boss-rework/2026-11-01/`。

> v0.21.0 用 `belfry-keeper-palette.mjs` 在构建时对既有 Boss 18 姿态和 `city/heart.png` 做旧金、血色、骨白/冷色阶处理；原图、透明轮廓与注册点保留。新增 `belfry-keeper-atmosphere.mjs` 原创 SVG 雾层、黑色裂脉和断裂蚀环。没有新增第三方素材、配音或音乐。

> v0.20.0 Boss 重做复用原 `keeper-v2-source.png` 三形态姿势，由 `belfry-keeper-art.mjs` 原创 SVG 肩甲、钟冠、赤刃、浮刃、回流刻印和危险刃线；构建时栅格化，未新增第三方美术、配音或音乐。金/赤/苍白三套颜色配合原姿势与体型变化；图形装饰不参与碰撞。

> v0.15.4 使用用户选定的 C「暗金裂痕」作为作品封面，源图为 `prototypes/runlab/art/belfry/cover.png`（1448×1086）。由内置 imagegen 基于现有旅人和钟城原图生成，完整提示词见 `design/cover-candidates/2026-10-27/prompts.json` 的 `c-gold-silhouette`。本轮直接复制选定 PNG，不裁切、不改字、不重新生成；它仅用于发布封面和编辑器静态预览。

> v0.15.0 待机风动由 `belfry-idle-cloth.mjs` 在构建时对既有 `art/rupture-v2/frames/0.png` 做局部形变，生成 24 张 240×418 透明帧。保留原像素比例与脚底注册点，仅移动红色披风和外侧衣摆，不改原图、不新增第三方素材。新增帧只进入 Hero，残影 / 姿势交叠不复制这套帧；运行时不计算布料物理，也不新增精灵或克隆。

> v0.13.2 原生包复用钟城背景与既有音效；中文与英文字形由构建机字体栅格化为 PNG；词册与游戏内铭文底板直接复用网页 CSS 在构建端截图，追加 Georgia 词题与等宽输入字形。16 个动作样本从已有 M4A 转为 22.05kHz 单声道 WAV，转码前校验来源，原始三首背景音乐不变。没有新增第三方音源或角色语音。

> v0.11 词汇资源新增：规范化四六级词元与 ECDICT 中文译文节选、原 82 条人工题面、21 条常见词目标义项修订。固定来源、MIT 许可与覆盖范围见 [词库说明](WORD_BANK.md)。不新增音频、人物或场景图。


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

## 2026-10-27 菜单配乐替换 · v0.15.8

从用户桌面复制 `Sea Power - Red Rock Riviera.mp3`，作为网页版和原生版的菜单音乐。保留原始完整文件，时长 413.505306 秒、16,666,042 字节，SHA-256 为 `65e0b2456c0f3192595ae85ea6b87b5ada59a1a6017973abfa90935c04bba6aa`。当前运行三曲合计 35,218,053 字节；游戏 / 结束曲目不变。旧的 Cleaning out the Rooms 运行副本作为本地历史素材保留，当前包不再包含它。详见 [资源清单](../prototypes/runlab/public/audio/music/manifest.json) 与 [场景音乐](SCENE_MUSIC.md)。

## 2026-10-27 菜单片头裁剪 · v0.15.9

按用户要求将 Red Rock Riviera 的前 5 秒移除，生成 `red-rock-riviera-trim5.mp3` 供网页与原生包使用。保留桌面原件及完整本地副本；使用 44.1 kHz 双声道、320 kbps MP3 编码。派生文件的哈希、大小和精确时长见资源清单，处理参数与验收见 [裁剪记录](evidence/2026-10-27-menu-trim5/README.md)。

## 2026-10-25 猎战敌人图集

通过内置 `image_gen.imagegen` 生成三张独立透明 3×2 六姿态图集，分别为裂甲卫、棘背猎兽、缝魂师。源图位于 `prototypes/runlab/art/belfry/hunt-warden-source.png`、`hunt-hound-source.png`、`hunt-weaver-source.png`；记录见同目录 `hunt-v10-prompts.json`。

构建沿用图集连通区域裁切与落脚线注册，产物可重建，不将拆帧目录入库。图像生成结果用于当前原型美术，不表示来自任何商业游戏或已完成人工逐帧动画。

## 2026-10-27 静水圣庭菜单 · v0.16.0

用户选定 B 方向后，以原概念图和当前主角图集为参考，通过内置 imagegen 生成清洁背景及透明 4×3 十二姿态角色图集。原图、提示词、尺寸和 SHA-256 保存在 `prototypes/runlab/art/belfry/menu/`。背景移除了原先烘焙的标题、按钮与主角，控件和人物可独立运行。

`belfry-menu-art.mjs` 构建时裁切并注册落脚点，生成 16 帧局部披风风动及浅色衰减倒影；薄雾、水波、细钩线为程序图形。游戏运行时只选小尺寸造型，不逐帧重绘大背景。共享源图与运动逻辑用于网页和 `.xbp`，原发布封面 C 保留。

## 2026-10-27 原画微动回调 · v0.16.1

恢复用户选择的 B 静水圣庭概念图，复制为 `art/belfry/menu/static-original.png`。通过内置 imagegen 仅清除右侧烘焙按钮，结果为 `static-clean-right.png`，完整提示词见同目录 `static-clean-prompt.txt`。构建时强制保留原图左 1000 列，只在右侧渐变合成清洁结果，主角没有重新生成。

水面与披风是原图局部像素变形，构建时烘焙 32 / 24 帧，运行时播放；固定区域逐像素校验。旧背景、十二姿态图集保留为历史素材，不再进入运行包。来源、哈希与保留校验见菜单目录 manifest.json / static-validation.json，设计与实测见 [v0.16.1](MENU_V161.md)。

## 2026-10-31 云间暗金闪电 · v0.16.8

`belfry-menu-lightning.mjs` 通过手工路径、确定性细分、程序化分叉和云层亮度蒙版生成九张 420×340 透明 PNG，三条路径分别含暗裂、金闪与余辉造型。未新增第三方图片、音乐或字体，未改动菜单底图。运行时使用单个 `MenuLightning` 精灵；本地合成预览在 `art/belfry/menu/lightning-preview-*.png`，实际运行截图见 [验收记录](evidence/2026-10-31-menu-lightning-v168/README.md)。

## 2026-10-31 静水圣庭雾流 · v0.16.10

`belfry-menu-fog.mjs` 使用现有菜单绘景的局部雾像素，构建时执行固定遮罩、亮度/边缘约束、柔化与小幅流动采样，生成 16 张 560×115 透明帧；两个固定精灵交叉淡化。没有新增第三方素材。原图不变，主角与近处台阶为明确排除区域。来源范围、比例、帧数和保护校验写入 `art/belfry/menu/static-validation.json`；[设计与验收](evidence/2026-10-31-menu-fog-v1610/README.md)。

## v0.22.0 结构 Boss 与常用词数据

- 新 Boss 三张透明图集、36 个关键姿态：`prototypes/runlab/art/belfry/keeper-v3/`，内置 imagegen；提示词和 SHA-256 随目录保存。实际脚部登记及武器判定见 `belfry-keeper-frames.mjs`、`Keeper.spx`。
- 常用词表 NGSL／NAWL CC BY-SA 4.0，ECDICT MIT；源文件与归属、修改说明、许可全文见 `prototypes/runlab/data/common-sources/`。衍生数据使用 CC BY-SA 4.0，其他程序、美术、音频各自独立许可。

## v0.22.1 铭文成就陈列

`prototypes/runlab/public/learning-art.js` 使用代码绘制原创建筑尖拱、金属印章和九类雕刻线稿；网页使用同一 SVG，原生构建预渲染为 PNG。没有新增图片来源、外部字体下载或图片生成调用。原生每个槽位仅包含其六页三状态的 18 张造型，四槽合计 72 张；固定 UI 精灵数量不变。
