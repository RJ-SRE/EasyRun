# 美术与资产来源

本轮由内置 `image_gen.imagegen` 生成原始绘制素材。提示词与源图随仓库保存；下表是事实来源记录，不对生成内容的权利状态作额外保证。第三方运行时和工具遵循各自许可，仓库未替它们重新授权。

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
