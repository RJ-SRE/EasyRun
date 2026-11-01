# 守心者重新设计概念稿

2026-11-01。**策划用途，未接入游戏，也不是完成的动作图集。** 当前游戏只恢复原背景和原角色贴图、撤回上一版新增环身装饰；新结构与技能的实施契约见 [完整设计](../../../docs/BOSS_REDESIGN_V2.md)。

- [三形态结构草案](keeper-structural-evolution-concept.png)：完整重甲 → 破甲双刃 → 长肢链刃；用结构与动作区分阶段，保留同一套材质。
- [三招关键姿态与特效示意](keeper-attack-keyposes-concept.png)：横断、双割、链刃的准备、执行、收势。动作意图与刃尾迹参考，时间、判定和手部注册点须依制作规格重新绘制。

使用内置 `image_gen` 工具，通过 [imagegen 技能](/Users/rj/.codex/skills/.system/imagegen/SKILL.md) 制作，未使用 CLI/API 回退。两张图都保留原生成文件，另复制到此目录。

第一张参考项目原有 `prototypes/runlab/art/belfry/keeper-v2-source.png` 的材质、白瓷面具、核心与灰布。第二张参考第一张新概念图。没有替换钟城背景，概念板的中性色底只是排版底色。

最终提示词原文：[造型提示词](concept-prompt.txt)、[技能提示词](skill-prompt.txt)。生成记录与文件 SHA-256 见 [metadata.json](metadata.json)。

后续必须统一各姿态中的武器构造、手部握点、断甲位置和脚底。不能将这些生成概念图直接拆成动画帧，也不能把图中发光面积当作最终验收结果。
