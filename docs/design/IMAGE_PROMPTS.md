# 概念图生成记录

- 日期：2026-10-23
- 技能：imagegen
- 模式：内置 `image_gen.imagegen`；未使用 CLI/API fallback。
- 资产类型：stylized-concept，美术方向对照板。
- 输入：纯文字生成，没有输入参考图片。
- 成品：[三方向概念图](assets/wordrunner-art-directions-v1.png)
- 用途：项目设计评审，尚未拆分为可拼接背景、精灵或运行时素材。
- 检查：三个场景均已生成，英文标签可读；角色身份与跑步方向一致，明暗主题有明显差别。画面细节密度高于三天原型预算，实际制作应按美术规范简化。概念图的低通道及平台高度不作为碰撞布局依据。

## 完整生成提示词

```text
Use case: stylized-concept.
Asset type: one original art-direction comparison board for WordRunner, a 2D side-scrolling English-learning runner intended to appeal to adults and teenagers as well as younger players. This is a concept exploration, not a shipped game screenshot.
Create a polished, high-resolution landscape board with three equally sized, wide horizontal gameplay concept panels stacked vertically, narrow margins and an understated charcoal editorial frame. Each panel is a beautiful playable-looking panoramic 2D side-view scene, not a poster or character portrait. All three use the same camera distance, the same ground height, a runner at roughly one quarter of the scene width, a modest gap ahead and a low passage further right. Keep a long readable run-up. Show clear silhouettes and buildable layered scenery. About 65% of the scene should feel calm, leaving space for later live text UI.
Original visual language: sophisticated graphic illustration, restrained painterly grain, crisp readable foreground shapes, atmospheric layered backgrounds, cinematic light, imaginative but grounded environmental storytelling. Designed as premium indie adventure art. Do not imitate any existing game, artist, character, logo, or trademark.
Character consistent in all panels: a small adult-proportioned, gender-neutral courier with approximately six-and-a-half-head body proportions, cropped off-white travel jacket, dark narrow trousers, compact crossbody satchel, short teal scarf, practical shoes. Running to the right, readable silhouette, natural proportions, no oversized head, no sexualized body, no long cape. The runner should be roughly one fifth of panel height; enough to read the pose but never dominate the landscape.
Panel 1, label exactly "01 / RAIN CITY": a rain-washed urban rooftop and elevated station route at blue hour. Deep slate and petrol-blue architecture, very restrained amber station lighting, wet pavement reflections, distant layered railway viaducts and warm apartment windows, rain concentrated in the background. An inviting amber-lit destination in the distance. Moody but navigable, no excessive neon signs, no generic purple cyberpunk.
Panel 2, label exactly "02 / CLOUD RUINS": a luminous, windswept floating island route with weathered pale stone arches, airy cloud sea, oxidized teal stone accents, sparse gold grasses, hanging roots, a distant observatory. Soft ivory, sage, mineral teal, quiet warm gold. Majestic and peaceful, not cute children's fantasy. Natural light, broad open sky, tactile monumental structures, no smiling clouds.
Panel 3, label exactly "03 / SUNSET COAST": a coastal railway footpath and terracotta harbor rooftops at sunset, dusty coral and peach sky, ink-blue sea, pale sand stone, dark cypress silhouettes, subtle lighthouse far away, elegant travel-poster atmosphere with fresh detailed original scenery. Warm, relaxed, inviting and quietly adventurous, not childish.
Only other text: small top heading exactly "WORDRUNNER / ART DIRECTION". Labels sit outside gameplay art on the frame, in clear compact typography. No language task copy, no HUD, no coins, no stars, no sticker badges, no score, no fake controls. No photorealism, no heavy 3D rendering, no chibi characters, no mascot teacher, no candy gradients, no stock-asset collage, no watermark. Preserve equal prominence and visual detail across all three panels.
```
