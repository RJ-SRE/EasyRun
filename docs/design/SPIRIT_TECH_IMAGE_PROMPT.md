# 精灵与科技世界概念图生成记录

## v3 微小精巧的光精灵

- 日期：2026-10-23。
- 技能与模式：imagegen，内置 `image_gen.imagegen`，参考已有环境重新生成角色与尺度板；未使用 CLI/API fallback。
- 用户方向：精灵非常小、精巧、美丽，参考《奥日》的精灵气质；人类已经灭绝，角色保持非人类特征。
- 输入：[v2 世界图](assets/wordrunner-spirit-tech-v2.png)，仅作为环境参考，旧枝晶角色被替换。
- 成品：[微光精灵与两区域尺度板](assets/wordrunner-tiny-spirit-v3.png)，2048 × 768 像素。
- 参考入口：[Ori 官方介绍](https://www.orithegame.com/?swcfpc=1)、[官方媒体库](https://www.orithegame.com/media/)。没有将外部游戏素材复制进项目。
- 视觉检查：左侧为角色放大观察与小型奔跑姿态，右侧为同一角色在两区域中的尺度。珍珠身体、淡青透光结构、暖金光核和尾芽一致；没有人类角色、服装、鞋或树皮重甲。主体比 v2 明显缩小，暗色区域容易辨认，明亮区域仍有轮廓。
- 后续制作：生成图的感知鳍偏长，场景中的角色比例也不作为精确像素标准；制作动画时简化细节并验证约 43–61 像素高角色的可读性。图不是逐帧动作图集，两处场景依然是美术概念。

### v3 完整生成提示词

```text
Use case: stylized-concept.
Asset type: an original small spirit character and environment scale board for the WordRunner / EasyRun 2D adventure.
Input image: environment and composition reference only. Retain the recognizable overgrown rainy machine city and luminous floating forest of this project, but replace the current large, hard, bark-armored creature completely.
User direction: the protagonist is VERY SMALL, delicate, nimble, beautiful, and clearly a non-human spirit. The user cites Ori as a reference for the feeling of a tiny luminous life exploring an immense, poetic world. Convey that emotional scale, graceful motion, softness and atmospheric hand-painted light with the original character design below.
Layout: one elegant landscape board. LEFT approximately one third: a magnified character study against a quiet deep blue-green background, showing the whole small spirit in a graceful poised stance and one smaller side-view running study below. RIGHT approximately two thirds: two wide horizontal environmental panels stacked, the rainy machine city above and luminous floating forest below. Each right panel includes the SAME tiny spirit running right at about one quarter of that panel's width. In those gameplay-scale panels the ENTIRE character including head fins is only 7 to 9 percent of the panel height; keep its feet visibly grounded on the foreground path. Preserve huge roots, old machinery, arches, depth and calm negative space. The left close-up is purely a magnified character design view and must not imply a giant protagonist.
Original character: a very small pearlescent opal-and-mist nature spirit with a compact, softly tapered droplet-shaped body, tiny agile non-human limbs and delicate three-toed paws. Smooth living luminous material, no hard exoskeleton, no wood armor, no visible muscular anatomy. A small softly rounded head with two restrained dark-teal expressive eyes, no human nose, no human lips or hair. Two SHORT translucent crescent-petal fins curve gently outward and down from the head, distinctly NOT long rabbit ears or horns. A few fine aquamarine filament markings flow along its body; its chest contains a tiny warm amber seed of light. A slender short luminous tail ends in one translucent dew-drop bud. The silhouette feels fluid, light and alert, like a drop of light becoming a living creature, capable of quiet curiosity and determined action. Ivory pearl at the core, translucent pale aqua at the edges, tiny champagne-gold accents. Do not add clothing, boots, a bag, armor, tools or weapons. No giant head, toy mascot, broad grin, plastic finish, doll face, anime girl or human-shaped fairy.
Atmosphere: sophisticated painterly fantasy, deep atmospheric layers, restrained bloom, soft edged reflected light, gorgeous tactile foliage and delicate light particles. Dark city and bright forest must both have contrast around the tiny hero. Keep feet, silhouette and path readable rather than dissolving the character into a light blob.
World: humanity is extinct. Only spirits, existing woodland life and functional-looking robots inhabit these ruins; no living people, no human portraits, no humanoid android faces. Keep machine and natural elements interwoven. No gore or battlefield.
Constraints: original character, not an exact existing game protagonist; no logos, text, labels, HUD, teaching graphics, coins, stars or watermarks. Leaf fins and tail are natural sensory structures, not flying wings. Retain a grounded side-scrolling adventure feel in the two environmental panels.
```



## v2 历史枝晶精灵方案

本版明确了非人类主角与人类灭绝设定。用户随后要求角色更小、更精巧，枝晶外形由 v3 微光精灵方向替代。

- 日期：2026-10-23。
- 技能与模式：imagegen，内置 `image_gen.imagegen`，编辑已有图片；未使用 CLI/API fallback。
- 输入：[v1 两区域图](assets/wordrunner-spirit-tech-v1.png)，作为编辑目标；编辑前已查看原图。
- 成品：[精灵信使与两区域图](assets/wordrunner-spirit-tech-v2.png)，2048 × 768 像素。
- 修改：将两处人形信使替换为同一位明显非人类的枝晶精灵，保留机械城市、云海林庭、维护机器人、光灵与画面布局。
- 视觉检查：两个精灵均可见种荚形矿晶头、后掠叶冠、胸口暖色光核和根足；没有原先的脸、头发、外套、裤装、围巾或鞋。明暗场景中的主角轮廓均可辨认，背景构图保持一致。
- 边界：枝晶外形仍是候选概念；这不是角色图集或运行时画面。小尺寸感知光缝、根足轮廓与叶冠的动画可读性需要在实际角色尺寸验证。

### v2 完整编辑提示词

```text
Use case: precise-object-edit.
Asset type: revision of the provided two-panel WordRunner spirit-and-technology world concept board.
Input image: edit target. Preserve its two stacked panoramic scenes, framing, camera, terrain, city and floating-forest architecture, lighting, painterly finish, the maintenance robot, woodland spirits and palette.
Primary change: humans are extinct in this fictional world. Replace BOTH human runners with ONE identical original, clearly NON-HUMAN forest spirit courier. The player is a sentient nature spirit, not a person wearing elf ears. No surviving humans anywhere.
New protagonist design: a nimble, elegant creature with a small elongated seedpod-shaped ivory mineral head, a narrow luminous sensory seam instead of a human face, and four swept-back leaf-shaped crest fins. Its compact forward-leaning torso is made of interlocking dark emerald bark plates with a subtle warm-gold light core enclosed in its chest. Two springy digitigrade root-legs grip the ground with split root tips, while two shorter twig-like forelimbs tuck close during running. The silhouette is clearly botanical and creature-like, neither a human body nor an animal costume. Small pale mineral accents and restrained edge light keep the creature legible against both backgrounds. Its sealed message capsule is nestled into a natural chest recess, no satchel. Show a convincing running stride to the right with grounded feet and a matching shadow. Keep it at the same on-screen position and comparable overall height as the original runner in each panel.
Strict character constraints: no human skin, nose, mouth, hair, human hands, human feet, jackets, trousers, scarves, boots, humanoid elf, human child, chibi proportions, oversized cartoon eyes, weapons, or recognizable existing game characters. The leaf fins are sensory structures, not wings; do not depict flying or floating movement.
World correction: existing architecture and machines are legacies of extinct humanity now inhabited or maintained by spirits and robots. Preserve the visual richness and welcoming mystery. Do not add people, human portraits, human-shaped statues, faces on signs, new buildings, combat or destruction.
Keep the board free of text, labels, HUD, logos and watermarks. Only perform the character replacements and any strictly necessary removal of human depictions; keep the environmental composition intact.
```

## v1 历史生成记录

以下保留原始提示词和检查记录；其中的人形信使已停用，不再作为角色制作依据。


- 日期：2026-10-23。
- 技能与模式：imagegen，内置 `image_gen.imagegen`；纯文字生成，无参考图片，未使用 CLI/API fallback。
- 成品：[两区域概念图](assets/wordrunner-spirit-tech-v1.png)。
- 成品尺寸：2048 × 768 像素；项目已保存独立副本，原始输出保留在内置工具的默认生成目录。
- 用途：项目世界观与视觉探索，见 [世界设计](SPIRIT_TECH_WORLD_v0.1.md)。
- 视觉检查：上下两个横版区域均有自然与科技设施、成人比例的信使、连贯地面与远景地标；明暗区分明显，服装轮廓基本一致，没有生成界面或教学文字。
- 制作限制：细节密度和光照高于三天原型目标；上方闸门、下方桥梁的尺寸不是可直接采用的碰撞规格。图主要表现共存氛围，冲突的后果与双状态机关还需通过实际关卡表现。图中的机器人和光鹿为环境概念，不代表已加入伙伴或行为系统。

### v1 完整生成提示词

```text
Use case: stylized-concept.
Asset type: original art-direction exploration board for WordRunner / EasyRun, a 2D side-scrolling courier adventure aimed at adults. This is concept art, not a screenshot of an implemented game.
Primary request: portray an intriguing conflict and interdependence between an elven spirit world and a technological civilization, both visibly inhabiting the same landscape. Sophisticated, atmospheric, adventurous, with small touches of curiosity. Make the contrast of living organic growth and precise mechanical infrastructure the visual identity.
Composition: one wide landscape board with two equally sized panoramic side-scrolling scenes stacked vertically, a narrow neutral divider. Each scene is a wide, readable lateral gameplay composition, with the same adult courier at roughly one quarter of the scene width, clear terrain silhouettes and open space ahead. Similar camera distance, small character around one sixth of each panel height. Layered scenery that could be adapted to a modest 2D game. Avoid a poster composition, giant portrait or cinematic overhead view.
Shared character: original adult-proportioned, androgynous traveling courier, around six-and-a-half heads tall, cropped ivory travel jacket, dark trousers, short teal scarf, compact crossbody satchel carrying a sealed message, practical boots, one modest technological wrist device. Running toward the right, no weapons, no oversized head. Keep clothing and proportions consistent in both scenes.
Upper scene: a rain-washed technological city at blue hour entwined with an ancient elven forest. A massive living tree grows through a distant transit tower; elevated rails curve around roots. Precise metal conduits run beside luminous sap veins. Small elven architectural details are grown into the bark, angular signal stations are partly occupied by foliage. Midground shows a modest maintenance robot tending a damaged root, not fighting. Foreground traversable walkway mixes worn metal decking, stone and roots; a clearly visible low mechanical gate ahead is wrapped in vines and linked to a small control pedestal. Deep petrol blue, slate steel, restrained jade-green organic bioluminescence and amber machine indicators. Rain mostly in the background. Conflict is visible in the contested gate and strained infrastructure, not in battlefield destruction.
Lower scene: a luminous floating forest sanctuary with ivory cloud sea, weathered stone arches, graceful tree-grown elven structures, hanging roots, pale jade leaves and warm gold sunlight. Old technological pylons and a suspended transit mechanism intersect the living structures, visibly functional and physically integrated rather than random sci-fi debris. A large distant ring-shaped observation apparatus is supported by both roots and columns. Foreground trail combines stone, wood and a short mechanical bridge; a folded section of metal rail and a curling living vine suggest different responses of the same environment. A few tiny abstract luminous woodland spirits, no cartoon faces, give a sense of life. Same courier and gameplay scale as above. Broad calm sky, uncluttered route.
Visual language: original polished graphic illustration, restrained painterly texture, crisp foreground silhouettes, cinematic depth, expressive organic curves versus functional straight machine forms. Adult-friendly wonder rather than grimdark; elves and machines both have beauty and useful functions. Buildings can have perspective but the traversable foreground must read as a side-view platform plane.
Text: no text, labels, UI, subtitles, logos or watermarks. No coins, stars, school symbols or education interface. No chibi characters, toy-like proportions, generic purple cyberpunk, oversaturated rainbow lighting, photorealistic 3D or imitation of existing games or artists. This image explores two biomes of one connected world, not a left-versus-right good-versus-evil split.
```
