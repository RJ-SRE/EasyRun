# XBuilder 发布封面 · C「暗金裂痕」

日期：2026-10-27；本地版本 v0.15.4。用户最终选择 C，A / B 仅保留为候选；没有重新生成或改动选定图。未推送远程或操作线上发布。

## 使用

导入桌面的 `EasyRun-XBuilder-v0.15.4-cover-C.xbp`。新导入默认第一个精灵为 `ProjectCover`，静态预览显示完整 C 封面。点击运行后封面自动隐藏，显示原来的开始菜单；游戏、单词、音乐和输入机制保持不变。

发布前检查发布弹窗中的封面。如果编辑过其他精灵或拖动过舞台，先选中 `ProjectCover`；若封面仍有偏移，保持选中并刷新编辑器页面恢复默认舞台视口，再确认完整封面后保存 / 发布。请先保存自己的代码修改。不要删除、移动或修改 `ProjectCover` 的初始可见性和造型；原有在线发布版本不会因本地导入自动更新。

## 为什么同时有封面文件和精灵

`builder-thumbnail.png` 是 XBuilder `.xbp` 支持的封面元数据文件。编辑器会在工程内容改变及导出前，使用 `StageViewer` 截图更新缩略图。因此只附加一张元数据图片，后续保存仍可能覆盖成静态游戏素材。

打包器还加入编辑器专用的 `ProjectCover`：

- 使用同一张 PNG，置于最上层；按默认 480×360 视口等比显示，位置为地图左上角视口的中心。地图和游戏视口配置保持原值。
- 精灵配置增加稳定 `builder_id`，`builder_spriteOrder` 使用 ID 将封面排在列表首位。XBuilder 该字段按内部 ID 排序，不能填写精灵名；全部精灵都列入顺序，避免未列出的项被排到封面前。
- `onStart => {hide}` 在运行时隐藏；没有更新循环、碰撞、点击、克隆或战斗逻辑。原有镜头纠偏负责清除编辑器可能保存的跟随目标。
- 新增一个原始精灵和一份造型纹理，不增加动态克隆；PNG 同时作为元数据和造型打包，两份相同原图会增加包体积。

编辑器依然允许用户主动拖动舞台、改变层级或选择其他精灵；工程包不能禁止网站后续自动截图。因此交付保证默认导入和正常回写的构图，并提供发布前检查和复位方法，不承诺任意编辑后封面永不变化。

## 资源与复现

源图：`prototypes/runlab/art/belfry/cover.png`，1448×1086，4:3。

SHA-256：`449e9f57dc789d29dc5529ec04baddf387e19e5fd6080c265f7083cb6332da43`。

工具及提示词：内置 `image_gen.imagegen`；`design/cover-candidates/2026-10-27/prompts.json` 中的 `c-gold-silhouette`。确认记录为同目录 `selected.json`。

```sh
# 已生成游戏资源后重新打包；首次构建先执行 game:build。
python3 prototypes/runlab/package.py --game belfry
RUNLAB_URL=http://127.0.0.1:4177/ bash scripts/with-env.sh node prototypes/runlab/test-belfry-cover.mjs

# 启动本地 server 后，验证编辑器保存 ProjectCover 跟随目标的情况。
RUNLAB_URL=http://127.0.0.1:4177/ \
NATIVE_SHELL_FOLLOW=ProjectCover \
XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026 \
XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js \
bash scripts/with-env.sh node prototypes/runlab/test-belfry-native-shell.mjs
```

模型 URL 和运行库来自此前固定的公开部署版本；网站更新后需要重新固定匹配版本。封面测试使用真实工程模型导入 / 回写，并用 Canvas 复现静态精灵坐标变换和截图回调；它不是完整线上编辑器端到端发布测试。本轮未登录或修改线上作品。验收结果、实际包哈希和截图见 [记录](evidence/2026-10-27-cover/README.md)。
