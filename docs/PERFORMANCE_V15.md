# v0.15 · 待机风动与运行性能

2026-10-27。本地版本，网页与 XBuilder 原生包共享角色 / 场景优化；原生 UI 优化只影响 `.xbp`。本轮不推送远程。

## 待机衣料

`belfry-idle-cloth.mjs` 在构建阶段从既有待机图生成 24 帧局部形变。红色披风先动、下摆稍微滞后；肩部连接、躯干、头部与脚底保持原位。每张帧为 240×418，围绕原注册点裁去透明边缘，保持原始像素比例。

角色静止时每秒选取 10 帧，循环约 2.4 秒。使用已有表现时钟：暂停停止，铭文聚焦随慢动作减速；移动、起跳、攻击及蓄力立即使用原动作。逻辑 pose 仍为 0，风动不产生 PoseBlend / Trail 克隆，不移动碰撞体。原 40 个动作索引不变，新帧仅追加到 Hero。

代价是约 2.84 MB 的压缩包增量和约 9.6 MiB 的帧像素存储，不包含引擎纹理管理开销；运行时不做逐像素变形或布料物理。原画没有被覆盖。

## 计算与渲染修改

| 模块 | 原有重复工作 | 本版处理 |
| --- | --- | --- |
| `Scene.spx` | 每个候选物体再次遍历所有渲染槽，查重并找空位 | 复用代际标记表；保留已有分配顺序，线性查找空位 |
| `Hero.chooseTarget` | 对所有钩点 / 敌人计算开方距离 | 先排除失效目标、轴向超距与平方距离不符目标，再计算原评分 |
| `Ledge / Anchor / Enemy` | 稳定造型每帧重复通知引擎，部分造型一帧切两次 | 先算最终造型，改变时才更新；平台比例也按变化更新 |
| 原生 UI 精灵 | 同一造型、位置、比例、显隐及置顶每帧重设 | 缓存引擎写入；镜头和状态变化时更新 |
| 原生字形 | 即使文字和镜头不动也逐帧广播、置顶 | 按文本版本、层级版本、镜头与入场位移失效刷新 |
| 原生按钮命中 | 鼠标不动也逐帧扫描 33 个按钮 | 按鼠标位置及可见状态变化重算；点击仍重新判定 |
| 词题按键隔离 | 未隔离的键也逐帧查询是否松开 | 只查询实际处于隔离状态的键；真实松键后恢复 |

原生 UI 层级在页面、提示菜单、词册筛选、文字或悬停变化时统一重排。悬停精灵只在最终层级绘制一次，避免缓存导致下拉选项被盖住。文字重建先于层级更新，层级改变时等待字形消息完成。

场景槽优化不删除世界数据，也不跳过敌人 AI、伤害、碰撞或弹道计算。目标选择的距离边界、方向惩罚与敌人优先项保持原规则。121 个常驻场景克隆、300 个运行库克隆上限及既有装饰预算保持不变。

## 测量方法

`test-belfry-performance.mjs` 解压实际 `.xbp`，通过部署的 XBuilder 项目模型导入 / 导出，再使用同版编译器和资源运行。旧版和新版使用相同窗口、词册索引 25–54、拼写题型、起始位置与操作；每段先预热 1.5 秒，再采样约 6.5 秒。五段为标题、待机、固定位置按住 J 的战斗、拼写题和词册。

仅测试副本注入无敌保护、阶段切换和计数器。记录引擎 `waitNextFrame` 返回的未钳制间隔、CDP 页面任务耗时、宿主 rAF 间隔、实际场景槽遍历与 UI 引擎写入次数。战斗过程会受调度与不同帧步影响，不是逐帧相同的战斗录像。测试未写入在线工程，也不会把注入代码打进交付包。

引擎间隔包含调度与渲染等待，不能等同纯计算时间；CDP 任务耗时不是整机 CPU 使用率，JS 堆不包括全部 WASM / GPU 内存。所有数据含测试计数开销，只用于本机版本对照，不承诺跨设备帧率。

## 复现

先启动本地运行器，再构建游戏和导出包：

```sh
bash scripts/with-env.sh node prototypes/runlab/build-belfry.mjs
python3 prototypes/runlab/package.py --game belfry
bash scripts/with-env.sh node prototypes/runlab/server.mjs
```

另一个终端逐个执行，避免同时运行浏览器性能测试：

```sh
export RUNLAB_URL=http://127.0.0.1:4177/
export XBUILDER_RUNTIME_DIR=.cache/xbuilder-online-20261026
export XBUILDER_MODEL_URL=https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js
bash scripts/with-env.sh node prototypes/runlab/test-belfry-idle-cloth.mjs
PERF_LABEL=candidate bash scripts/with-env.sh node prototypes/runlab/test-belfry-performance.mjs
# 旧包须保留；PERF_ARCHIVE 指定旧包的本地绝对路径。
PERF_LABEL=baseline PERF_ARCHIVE=/absolute/path/to/previous.xbp bash scripts/with-env.sh node prototypes/runlab/test-belfry-performance.mjs
```

环境变量中的服务端口以启动日志为准。网站资源 URL 为本轮固定部署版本；若部署替换，请重新固定同一版本后同时重测基线与候选。历史报告中的不同词册探索性采样不用于最终比较。

## 本轮结果与边界

最终对照、回归结果、包哈希和截图见 [验收记录](evidence/2026-10-27-idle-performance/README.md)。密集战斗仍可能出现长帧；本轮没有完成低端设备、Safari、持续一小时运行或线上账号工程导入验收。
