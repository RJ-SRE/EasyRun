// Authored expedition layout. Coordinates are local to each room entry.
// This is the shared source for runtime, art, journal, save migration and tests.
// A floor is [x,width,y], a foe is [x,feetY,role], a node is [x,y,kind].
export const EXPEDITION_ROOMS = [
  {
    id: "M01",
    name: "折翼门廊",
    district: 0,
    height: 640,
    mechanic: "traverse",
    objective: "循着残桥进入下层门廊",
    opportunities: [0, 0],
    floors: [
      [80, 280, 0],
      [590, 270, -210],
      [110, 310, -450],
    ],
    anchors: [
      [310, 100],
      [590, -120],
      [350, -350],
      [600, -560],
    ],
    foes: [],
    nodes: [],
    story: "委托只留下半句话：带回钟心。另一半被人刮掉了。",
  },
  {
    id: "M02",
    name: "双层哨桥",
    district: 0,
    height: 780,
    mechanic: "bridge",
    objective: "抢到桥头，解除哨桥的锁定",
    opportunities: [3, 4],
    floors: [
      [570, 310, -160],
      [80, 350, -390],
      [530, 350, -620],
    ],
    anchors: [
      [350, 20],
      [610, -210],
      [330, -440],
      [570, -660],
    ],
    foes: [
      [848, -126, 2],
      [260, -390, 1],
      [700, -620, 1],
    ],
    nodes: [[625, -620, "bridge-lock"]],
    story: "壁龛中的弓手始终没有离开岗位。桥的另一端已经空了很久。",
  },
  {
    id: "M03",
    name: "悬笼岔井",
    district: 0,
    height: 820,
    mechanic: "cargo",
    objective: "夺回货笼控制，再选择停靠位置",
    opportunities: [3, 3],
    floors: [
      [80, 300, -170],
      [600, 280, -390],
      [90, 340, -650],
    ],
    anchors: [
      [600, 20],
      [330, -210],
      [600, -440],
      [330, -700],
    ],
    foes: [
      [250, -170, 1],
      [690, -350, 0],
      [255, -650, 4],
    ],
    nodes: [
      [155, -170, "cargo-start"],
      [345, -650, "cargo-park"],
    ],
    lift: { x: 420, width: 160, from: -580, to: -240, period: 7 },
    story: "货笼还在接送并不存在的乘客。停靠标记里藏着一份未送达的记录。",
  },
  {
    id: "M04",
    name: "双秤货井",
    district: 1,
    height: 860,
    mechanic: "counterweight",
    objective: "解开两侧受力扣，调整配重",
    opportunities: [3, 3],
    floors: [
      [590, 290, -140],
      [80, 320, -370],
      [570, 310, -620],
      [85, 260, -760],
    ],
    anchors: [
      [340, 20],
      [600, -210],
      [340, -460],
      [580, -710],
    ],
    foes: [
      [730, -140, 1],
      [220, -370, 4],
      [750, -620, 2],
    ],
    nodes: [
      [650, -140, "weight-left"],
      [185, -370, "weight-right"],
      [620, -620, "weight-route"],
    ],
    lift: { x: 420, width: 150, from: -680, to: -210, period: 8 },
    counterweight: { x: 275, width: 125 },
    story: "两台配重仍在互相牵制。它们维持的平衡，早已没有人来校准。",
  },
  {
    id: "M05",
    name: "退火回廊",
    district: 1,
    height: 780,
    mechanic: "heat",
    objective: "沿安全台穿过热流，打开泄压阀",
    opportunities: [2, 3],
    floors: [
      [80, 330, -130],
      [570, 310, -350],
      [100, 300, -590],
    ],
    anchors: [
      [600, 20],
      [340, -200],
      [590, -430],
      [350, -650],
    ],
    foes: [
      [265, -130, 1],
      [848, -316, 2],
      [250, -590, 1],
    ],
    nodes: [[175, -590, "vent"]],
    heat: [
      [450, -280, 110, 0],
      [460, -520, 100, 2.4],
    ],
    story: "炉膛已经停工，维护程序却仍在给它保温。",
  },
  {
    id: "M06",
    name: "监炉者的秤台",
    district: 1,
    height: 760,
    mechanic: "foreman",
    objective: "利用配重解除监炉者的控制",
    opportunities: [3, 3],
    floors: [
      [570, 300, -140],
      [80, 310, -350],
      [80, 800, -640],
    ],
    anchors: [
      [340, 20],
      [600, -200],
      [330, -430],
      [670, -480],
    ],
    foes: [
      [745, -140, 1],
      [240, -350, 2],
      [530, -640, 4],
    ],
    elite: 2,
    nodes: [
      [150, -640, "weight-decoy-left"],
      [800, -640, "weight-decoy-right"],
    ],
    story: "监炉者先伸手托住摇晃的秤台，才转向你。他守着的不是出口。",
  },
  {
    id: "M07",
    name: "侧翻书库",
    district: 2,
    height: 780,
    mechanic: "drain",
    objective: "寻找排水通道，读懂书架的受力方向",
    opportunities: [2, 2],
    floors: [
      [80, 350, -150],
      [540, 340, -380],
      [100, 330, -620],
    ],
    anchors: [
      [600, 20],
      [340, -220],
      [600, -450],
      [340, -670],
    ],
    foes: [
      [260, -150, 5],
      [740, -380, 2],
    ],
    nodes: [
      [155, -620, "drain"],
      [355, -620, "index-a"],
    ],
    story: "维修单上没有人的名字，只有那些仍在工作的机器编号。",
  },
  {
    id: "M08",
    name: "浮灯渡廊",
    district: 2,
    height: 900,
    mechanic: "escort",
    objective: "护送档案灯到下层接收台",
    opportunities: [3, 4],
    floors: [
      [560, 320, -130],
      [80, 340, -390],
      [530, 350, -650],
      [80, 340, -800],
    ],
    anchors: [
      [330, 20],
      [600, -210],
      [330, -460],
      [600, -700],
    ],
    foes: [
      [240, -390, 1],
      [820, -616, 2],
      [600, -610, 0],
      [260, -800, 5],
    ],
    nodes: [
      [620, -130, "lamp-start"],
      [170, -390, "lamp-rest"],
      [610, -650, "lamp-rest"],
      [160, -800, "lamp-end"],
    ],
    story: "灯里装着一小片仍可读取的档案。它每次受阻，都会回到最后记住的地方。",
  },
  {
    id: "M09",
    name: "封存大厅",
    district: 2,
    height: 820,
    mechanic: "records",
    objective: "找到两份记录，再决定带走什么",
    opportunities: [3, 3],
    floors: [
      [80, 330, -140],
      [560, 320, -360],
      [100, 350, -600],
    ],
    anchors: [
      [600, 20],
      [340, -210],
      [600, -440],
      [340, -680],
    ],
    foes: [
      [255, -140, 5],
      [848, -326, 2],
      [280, -600, 1],
    ],
    nodes: [
      [155, -140, "record-a"],
      [625, -360, "record-b"],
      [160, -600, "record-choice"],
    ],
    story:
      "一份记录说钟心必须离开，另一份说所有记忆都靠它维持。两份都没有说谎。",
  },
  {
    id: "M10",
    name: "倒影长井",
    district: 3,
    height: 760,
    mechanic: "reflection",
    objective: "沿实体承重线抵达真实的桥头",
    opportunities: [2, 2],
    floors: [
      [560, 320, -150],
      [80, 340, -390],
      [550, 330, -620],
    ],
    anchors: [
      [330, 20],
      [600, -220],
      [330, -460],
      [600, -650],
    ],
    foes: [
      [740, -150, 2],
      [240, -390, 1],
    ],
    nodes: [[625, -620, "mirror-proof"]],
    ghosts: [
      [100, 280, -180],
      [570, 250, -410],
    ],
    story: "倒影会模仿一座桥，却模仿不了连接它的受力线。",
  },
  {
    id: "M11",
    name: "交错猎场",
    district: 3,
    height: 940,
    mechanic: "hunters",
    objective: "拆开镜猎双卫的追击，夺回两处落脚点",
    opportunities: [4, 5],
    floors: [
      [80, 330, -140],
      [560, 320, -360],
      [80, 340, -590],
      [550, 330, -790],
    ],
    anchors: [
      [600, 20],
      [330, -210],
      [610, -440],
      [330, -670],
      [600, -830],
    ],
    foes: [
      [240, -140, 1],
      [725, -320, 0],
      [245, -590, 1],
      [600, -510, 0],
    ],
    elites: [2, 3],
    nodes: [
      [160, -590, "hunter-left"],
      [620, -790, "hunter-right"],
    ],
    story: "地面的猎手退开时，空中的刀恰好封住退路。他们仍记得彼此的步调。",
  },
  {
    id: "M12",
    name: "折光天桥",
    district: 3,
    height: 820,
    mechanic: "mirror-bridge",
    objective: "重接桥架，选择返程的方向",
    opportunities: [3, 3],
    floors: [
      [560, 320, -140],
      [80, 320, -370],
      [540, 340, -620],
    ],
    anchors: [
      [330, 20],
      [610, -200],
      [330, -450],
      [600, -700],
    ],
    foes: [
      [710, -140, 1],
      [245, -370, 4],
      [730, -620, 2],
    ],
    nodes: [
      [160, -370, "bridge-pivot"],
      [630, -620, "bridge-exit"],
    ],
    bridge: [
      [370, 200, -510],
      [390, 210, -250],
    ],
    story: "桥架可以朝两个方向接通。现在顺手的方向，归来时未必仍然顺手。",
  },
  {
    id: "M13",
    name: "停摆前庭",
    district: 4,
    height: 780,
    mechanic: "choice",
    objective: "抵达供能台，决定钟心的去向",
    opportunities: [2, 3],
    floors: [
      [80, 330, -150],
      [550, 330, -390],
      [100, 330, -630],
    ],
    anchors: [
      [600, 20],
      [330, -220],
      [600, -450],
      [340, -680],
    ],
    foes: [
      [250, -150, 5],
      [720, -390, 4],
    ],
    nodes: [[180, -630, "energy-choice"]],
    story: "钟心通往出口的线很短，通往整座城的线很长。",
  },
  {
    id: "M14",
    name: "锁心回路",
    district: 4,
    height: 860,
    mechanic: "circuits",
    objective: "切断三处外部回路，打开守心者室",
    opportunities: [3, 3],
    floors: [
      [550, 330, -140],
      [80, 330, -390],
      [550, 330, -650],
    ],
    anchors: [
      [330, 20],
      [600, -210],
      [330, -460],
      [600, -720],
    ],
    foes: [
      [735, -140, 1],
      [250, -390, 2],
      [725, -650, 4],
    ],
    nodes: [
      [620, -140, "circuit-a"],
      [165, -390, "circuit-b"],
      [620, -650, "circuit-c"],
    ],
    story: "回路断开后，守心者没有逃。他把剩下的能源收进胸口。",
  },
  {
    id: "M15",
    name: "守心者室",
    district: 4,
    height: 650,
    mechanic: "keeper",
    objective: "击破守心者，带着自己的选择返回",
    opportunities: [4, 5],
    floors: [
      [80, 300, -80],
      [560, 320, -80],
      [100, 190, -320],
      [670, 190, -320],
      [80, 800, -500],
    ],
    anchors: [
      [300, -40],
      [660, -40],
      [480, -350],
    ],
    foes: [[480, -500, 3]],
    nodes: [],
    story: "最后一层甲片脱落，他仍试图把胸口的光送回已经断开的管道。",
  },
];

// Optional quests span visible side bays in authored rooms, and never own the
// only exit. Each records a concrete change used during the upward journey.
export const EXPEDITION_SIDES = [
  {
    id: "S01",
    name: "未归的信使",
    rooms: [1, 2],
    kind: "messenger",
    reward: "freight-lift",
    nodes: [
      [1, 120, -650],
      [2, 790, -650],
    ],
    title: "仍在归途",
  },
  {
    id: "S02",
    name: "停工的修补机",
    rooms: [3, 4],
    kind: "repair",
    reward: "return-support",
    nodes: [
      [3, 785, -760],
      [4, 780, -590],
    ],
    title: "接住坠落",
  },
  {
    id: "S03",
    name: "无名者索引",
    rooms: [6, 8],
    kind: "index",
    reward: "archive-ending",
    nodes: [
      [6, 790, -620],
      [8, 790, -600],
    ],
    title: "替城记住",
  },
  {
    id: "S04",
    name: "旧猎手的试炼",
    rooms: [9, 11],
    kind: "trial",
    reward: "mirror-shortcut",
    nodes: [
      [9, 160, -620],
      [11, 160, -620],
    ],
    title: "看破倒影",
  },
  {
    id: "S05",
    name: "最后一盏灯",
    rooms: [12, 13],
    kind: "lantern",
    reward: "return-light",
    nodes: [
      [12, 785, -630],
      [13, 160, -650],
    ],
    title: "留一盏灯",
  },
];

export const NODE_KINDS = [
  "exit",
  "bridge-lock",
  "cargo-start",
  "cargo-park",
  "weight-left",
  "weight-right",
  "weight-route",
  "vent",
  "weight-decoy-left",
  "weight-decoy-right",
  "drain",
  "index-a",
  "lamp-start",
  "lamp-rest",
  "lamp-end",
  "record-a",
  "record-b",
  "record-choice",
  "mirror-proof",
  "hunter-left",
  "hunter-right",
  "bridge-pivot",
  "bridge-exit",
  "energy-choice",
  "circuit-a",
  "circuit-b",
  "circuit-c",
  "messenger",
  "repair",
  "index",
  "trial",
  "lantern",
];
export function buildExpeditionLayout() {
  const platforms = [],
    anchors = [],
    enemies = [],
    nodes = [],
    rooms = [],
    checkpoints = [],
    lifts = [],
    heats = [],
    ghosts = [],
    echoes = [];
  let top = 0;
  for (const [index, room] of EXPEDITION_ROOMS.entries()) {
    const bottom = top - room.height;
    const platformStart = platforms.length;
    for (const [x, w, y] of room.floors) platforms.push([x, w, top + y, 0]);
    // Observation/drain/heat/choice rooms have optional devices and remain
    // traversable. Task gates only protect a concrete unfinished operation.
    const gated = ![
      "traverse",
      "keeper",
      "drain",
      "heat",
      "reflection",
      "choice",
    ].includes(room.mechanic);
    const gate = gated ? platforms.length : -1;
    if (gate >= 0) platforms.push([80, 800, bottom + 20, 100 + index]);
    const anchorStart = anchors.length;
    for (const [x, y] of room.anchors) anchors.push([x, top + y]);
    const foeStart = enemies.length;
    for (const [local, [x, y, kind]] of room.foes.entries())
      enemies.push({
        x,
        y: top + y + 34,
        kind,
        room: index,
        elite: room.elite === local || room.elites?.includes(local) || false,
        returnOnly: false,
        node: -1,
      });
    const nodeStart = nodes.length;
    for (const [local, [x, y, kind]] of room.nodes.entries())
      nodes.push({ x, y: top + y, kind, room: index, side: -1, step: local });
    const first = room.floors[0];
    if (index === 0) checkpoints.push([230, 0]);
    else {
      const entryX = first[0] < 480 ? 640 : 80;
      platforms.push([entryX, 240, top - 20, 0]);
      checkpoints.push([entryX + 120, top - 20]);
    }
    if (room.lift) {
      const l = room.lift,
        floor = platforms.length;
      platforms.push([l.x, l.width, top + l.from, 20 + index]);
      lifts.push({
        floor,
        room: index,
        low: top + l.from,
        high: top + l.to,
        period: l.period,
      });
      if (room.counterweight)
        platforms.push([
          room.counterweight.x,
          room.counterweight.width,
          top + l.to,
          43,
        ]);
    }
    for (const [x, y, width, offset] of room.heat || [])
      heats.push({ x, y: top + y, width, offset, room: index });
    for (const [x, width, y] of room.ghosts || [])
      ghosts.push({ x, width, y: top + y });
    for (const [j, [x, width, y]] of (room.bridge || []).entries())
      platforms.push([x, width, top + y, 40 + j]);
    rooms.push({
      ...room,
      index,
      top,
      bottom,
      gate,
      platformStart,
      anchorStart,
      foeStart,
      foeCount: room.foes.length,
      nodeStart,
      nodeCount: room.nodes.length,
    });
    top = bottom;
  }
  let courierFloor = -1,
    courierNode = -1;
  for (const [side, quest] of EXPEDITION_SIDES.entries()) {
    for (const [step, [room, x, y]] of quest.nodes.entries()) {
      const worldY = rooms[room].top + y;
      if (side === 0 && step === 0) {
        courierFloor = platforms.length;
        courierNode = nodes.length;
      }
      platforms.push([Math.max(80, x - 90), 180, worldY, 0]);
      anchors.push([x, worldY + 160]);
      nodes.push({ x, y: worldY, kind: quest.kind, room, side, step });
    }
  }
  // Optional bays have their own guards; they are never counted as main-route
  // capacity. The courier requires a moving catch, the mechanic a cleared bay.
  for (const [side, room, x, y, kind] of [
    [1, 4, 780, -590, 5],
    [2, 8, 790, -600, 2],
  ])
    enemies.push({
      x,
      y: rooms[room].top + y + 34,
      kind,
      room,
      elite: false,
      returnOnly: false,
      node: -1,
      side,
    });
  // Physical mechanism targets use the same melee/arrow hit path, but do not
  // grant kills/embers. Walking up and releasing the latch is also possible.
  for (const [node, n] of nodes.entries())
    if (
      [
        "weight-left",
        "weight-right",
        "circuit-a",
        "circuit-b",
        "circuit-c",
      ].includes(n.kind)
    )
      enemies.push({
        x: n.x,
        y: n.y + 34,
        kind: 6,
        room: n.room,
        elite: false,
        returnOnly: false,
        node,
      });
  const keeperIndex = enemies.findIndex((e) => e.kind === 3);
  for (const room of [2, 5, 8, 11, 13]) {
    const r = rooms[room],
      f = r.floors[1];
    enemies.push({
      x: f[0] + f[1] / 2,
      y: r.top + f[2] + 70,
      kind: 0,
      room,
      elite: false,
      returnOnly: true,
      node: -1,
    });
  }
  for (const room of [2, 7, 11]) {
    const r = rooms[room];
    echoes.push([r.floors[1][0] + 95, r.top + r.floors[1][2] + 55]);
  }
  // Visible alternate return shoulders; the base route always remains usable.
  for (const [side, room] of [1, 4, 8, 10, 13].entries())
    platforms.push([
      380,
      200,
      rooms[room].top - (side === 1 ? 500 : 285),
      60 + side,
    ]);
  for (const r of [0, 4, 6, 9, 12])
    platforms[rooms[r].platformStart + 1][3] = 1;
  platforms.push([380, 200, rooms[6].top - 500, 42]);
  const freightFloor = platforms.length;
  platforms.push([600, 180, rooms[1].top - 650, 70]);
  lifts.push({
    floor: freightFloor,
    room: 1,
    low: rooms[1].top - 650,
    high: rooms[1].top - 40,
    period: 7,
  });
  const keeperFloor = rooms[14].platformStart + 4;
  return {
    counterweightFloor: platforms.findIndex((p) => p[3] === 43),
    courierFloor,
    courierNode,
    revision: 2,
    rooms,
    platforms,
    anchors,
    enemies,
    nodes,
    checkpoints,
    lifts,
    heats,
    ghosts,
    echoes,
    sides: EXPEDITION_SIDES,
    nodeKinds: NODE_KINDS,
    keeperIndex,
    keeperFloor,
    keeperY: enemies[keeperIndex].y,
    sealAnchors: [rooms[14].anchorStart, rooms[14].anchorStart + 1],
    districtBounds: [3, 6, 9, 12].map((room) => rooms[room].top),
    depth: -top,
  };
}
