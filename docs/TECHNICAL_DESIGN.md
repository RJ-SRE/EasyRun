# 倒悬钟城技术设计

v0.5，2026-10-24。基础关卡参数参见 [v0.4 技术设计](TECHNICAL_DESIGN-v0.4.md)。Node 24.22.1 / pnpm 11.9.0 / spx 3.3.0 / Playwright 1.64.1 保持锁定，无新增运行库。

## 架构与入口

`belfry-level.mjs` 提供唯一关卡数据，`build-belfry.mjs` 导入原图、生成造型/场景和初始化。主循环在 `main.spx`，角色输入、战斗、移动和动画在 `Hero.spx`。所有战斗判定仍在 spx，宿主仅收取遥测、管理 UI/声音/本机记录。

新增 `EnemyTell.spx` 和 `Hazard.spx` 表现预警、绊索、冲撞方向和钟波；`Enemy.spx` 选择敌人姿态与受击反馈。所有实体克隆仍在 `initLevel` 完成后由主场景创建。

`public/belfry-audio.js` 只管理动作音效、环境音乐与播放生命周期；角色语音/对白按用户要求停用。运行入口不导入 `belfry-dialogue.js`、`belfry-director.js`，不加载任何角色语音资源。`public/audio/sfx/` 仅包含 56 个已生成的动作/材质采样及来源清单；制作稿和试音保留在制作资料中。

## 战斗状态机

`attackKind`：0 空闲、1/2/3 地面连段、4 挑空、5/6 空中连段、7 重击。`attackAge/attackWindup/attackDuration` 分离起手和恢复；有效窗口约 0.10 秒；`attackApplied` 保证每次挥击的伤害只结算一次。`attackBuffer` 保存输入意图 0.20 秒，进入可衔接时间才执行。`chainWindow` 0.8 秒。

三段时长 0.23/0.25/0.39 秒，起手 0.07/0.08/0.14；挑空 0.33、空中 0.26；重击起手 0.16，总时长 0.62。L 蓄力 0.55 秒增强至 3 伤害。轻击有效帧之后可取消进跳跃、钩索或冲刺；重击恢复不接受普通位移取消。Q 可用资源强制脱离。

`attackTime` 只用于有效窗口/弹反。断弦额外窗口必须单独衰减，不能因 `attackKind==0` 而永远保留。受伤、重开与续关调用统一清理，取消攻击、蓄力和待输入。

敌人有独立偏移、速度、硬直、被掷出时间。挑空给轻敌向上速度，空中追击维持双方悬空；重击给横向冲击，近距离碰到其他敌人造成碰撞伤害。偏移有边界，恢复时弹簧回归基础巡逻点。Boss 不接受位移。

## 敌人与练习

种类 0 提灯者、1 织缆者、2 钟卫、3 Boss、4 模仿者。通常生命 3/4/6/16或20/4。前四类使用周期和轮次交替两种招式；模仿者预警时读取 `lastMove` 决定近斩或突进。预警时固定瞄准点，避免移动目标被无限追踪。附近 480 单位启动战斗，活跃危险持续更新。

绊索碰撞使用点到线段距离；钟波使用角色距中心与当前半径之差。斩击可剪断绊索；钟波可清理附近绊索。受伤硬直中暂停出招，普通敌人的现行危险会被打断。

`practice==1` 为公开排练场，保留四种敌人并给 20 生命，死亡后重生；特殊整宽平台阻止掉落。R 调用正常 `startRun`，重新初始化关卡数据恢复冒险。练习不进入冒险结算统计。

## 声音（角色语音停用）

单个 AudioContext，音效/环境音乐与独立危险预警总线，经 master 和压缩器输出。危险预警跟随音效音量。动作采样包含刀风、衣料、绳索、瓷裂、铜壳和冲击；音乐使用低音层。采样按实际挥击/接触事件播放，普通挥空不追加材质命中。

只读取/保存 `belfry-audio-v2` 中的 `sfx`、`music`。旧 `voice/chatter/subtitles` 字段被忽略；界面已无对白、说话者或字幕控件。战绩继续使用 `easyrun-belfry-v1`。

暂停、失败、重试、隐藏和静音调用 `stopAll()`，停止活动源并递增 epoch。异步解码完成后复核 epoch、游戏阶段、页面可见性和事件时效，旧音效不能复活。单个资源解码失败记录在诊断中，不阻塞游戏。没有 TTS 或对话服务的运行时依赖。

## 遥测与测试

`@state` 追加 attackKind、chainStep、chargeTime、threats、practice、attackTime、attackAge。`@foe` 输出附近敌人的位置/生命/模式/预警/危险/硬直/时钟；`@enemyEvent` 传递类型和事件，支持材质音与攻击预警。宿主 `latestState/foes/soundDiagnostics` 是观察接口，测试不反写引擎。

```sh
bash scripts/with-env.sh pnpm game:build
bash scripts/with-env.sh pnpm game:lint
bash scripts/with-env.sh pnpm game:test
bash scripts/with-env.sh pnpm game:package
```

统一测试先运行新战斗/敌人测试，再执行既有生命周期、两档完整路线、旧风机墓场与动作生命周期。测试服务使用独立随机端口。

## 输出边界

`.xbp` 含 spx 核心、敌人、动作和美术。HTML HUD、动作音效、环境音乐、设置与存储属于配套网页；没有声称这些能力随 XBuilder 包独立运行。实际入口为本地 `/` 或 `/belfry.html`。生成图集是关键姿态图片动画，不是骨骼动画。
