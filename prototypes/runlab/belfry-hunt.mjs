// Combat-first replacement for the retired device/escort expedition.
// Every position is authored. Return routes never depend on a side quest.
export const HUNT_ROSTER = [
  {
    kind: 0,
    name: "悬刃 · 折翼者",
    role: "争夺高度",
    counter: "掠袭锁向后换高差，抓收势追击",
  },
  {
    kind: 1,
    name: "短锋 · 决斗者",
    role: "试探与护架",
    counter: "观察撤步，绕背或重斩破架",
  },
  {
    kind: 2,
    name: "壁弓 · 逐影者",
    role: "远程压制",
    counter: "借钩逼近，趁搭箭远射",
  },
  {
    kind: 4,
    name: "缚索 · 收猎者",
    role: "控制通路",
    counter: "跳扫链、斩锁链，贴近长武器盲区",
  },
  {
    kind: 5,
    name: "封脉 · 伏猎者",
    role: "侧袭擒拿",
    counter: "换高差避开锁向，抓空后反击",
  },
  {
    kind: 7,
    name: "裂甲卫",
    role: "正面护架",
    counter: "L 破架，或绕到背面攻击；重劈有收势",
  },
  {
    kind: 8,
    name: "棘背猎兽",
    role: "低扑与跃袭",
    counter: "跳过低扑，避开落点，滑行收势时追击",
  },
  {
    kind: 9,
    name: "缝魂师",
    role: "单体护架支援",
    counter: "远射支援者，或拉开守卫、隔断视线",
  },
];
const names = [
  "折翼门廊",
  "桥头夹击",
  "空井逐影",
  "裂甲巡廊",
  "炉底猎群",
  "执刑者庭",
  "沉水伏猎",
  "断线书库",
  "封存猎场",
  "折光追廊",
  "双生猎场",
  "折翼审判",
  "最后的巡守",
  "心前围猎",
  "守心者室",
];
const goals = [
  "借钩下潜，抵达外城哨桥",
  "绕过护刃，从高处处理壁弓",
  "追上换位的悬刃，借敌跃入深处",
  "观察裂甲卫的重劈，从侧后进入",
  "越过猎兽低扑，拆散空地夹击",
  "击败裂甲执刑者，穿过庭院",
  "看清伏猎者，再选择落点",
  "切断缝魂师与守卫的支援",
  "突破近身与远射交错的守卫",
  "在不同高度追上游走的猎手",
  "拆开双生猎手，击破两名精英",
  "迎战折翼审判者，追击其掠袭后的空档",
  "先处理支援，再越过重甲巡守",
  "选择接近角度，抵达最深处",
  "击破三形态守心者，夺心上返",
];
const stories = [
  "残桥上没有机关，只有仍然通向深处的旧锚点。",
  "盾刃始终朝着桥口，弓手从未离开空荡荡的哨位。",
  "残翼掠过井壁，尘埃比刀锋先落下来。",
  "裂甲卫的背部已经空了，举盾的手却没有放下。",
  "猎兽循着旧日气味奔跑，主人早已不在。",
  "执刑者的盔甲碎裂后，仍用双手握住那柄巨刃。",
  "伏猎者守着一扇已不存在的门。",
  "细线缝合着同伴的残甲，没有修复它们遗忘的名字。",
  "书页沉入水中，守卫还记得最后一道命令。",
  "猎手从倒影旁掠过，真正的刃始终有影子。",
  "一人倒下后，另一人第一次离开了自己的位置。",
  "折断的翼仍在寻找上升的风。",
  "最后的巡守让出了同伴的位置，却没有让出道路。",
  "刃痕越来越深，胸口的微光越来越近。",
  "最后一层甲片落下，他仍把手伸向那颗心。",
];
// [kind,x,local floor index,elite role] -- elites: 1 executioner, 2/3 twins, 4 judge.
const groups = [
  [],
  [
    [1, 650, 0],
    [2, 820, 1],
    [7, 260, 2],
  ],
  [
    [0, 620, 0],
    [2, 170, 1],
    [1, 680, 2],
    [0, 360, 2],
  ],
  [
    [7, 650, 0],
    [2, 180, 1],
    [1, 650, 2],
    [4, 240, 2],
  ],
  [
    [8, 280, 0],
    [0, 600, 0],
    [8, 650, 2],
    [2, 170, 1],
  ],
  [[7, 560, 2, 1]],
  [
    [5, 250, 0],
    [2, 800, 1],
    [8, 270, 2],
    [1, 650, 2],
  ],
  [
    [9, 720, 0],
    [1, 510, 0],
    [7, 270, 2],
    [2, 750, 1],
  ],
  [
    [4, 280, 0],
    [9, 680, 1],
    [5, 590, 1],
    [8, 650, 2],
  ],
  [
    [0, 650, 0],
    [2, 200, 1],
    [8, 650, 2],
    [1, 270, 2],
  ],
  [
    [1, 550, 2, 2],
    [0, 740, 2, 3],
  ],
  [[0, 560, 2, 4]],
  [
    [9, 720, 0],
    [7, 510, 0],
    [8, 250, 2],
    [2, 780, 1],
  ],
  [
    [7, 650, 0],
    [9, 450, 0],
    [4, 250, 1],
    [0, 650, 2],
    [8, 350, 2],
  ],
  [[3, 480, 4]],
];
export function buildHuntLayout() {
  const platforms = [],
    anchors = [],
    enemies = [],
    rooms = [],
    checkpoints = [],
    echoes = [];
  let top = 0;
  for (let r = 0; r < 15; r++) {
    const elite = [5, 10, 11].includes(r),
      height = r === 0 ? 640 : r === 14 ? 650 : 800;
    let floors;
    if (r === 0)
      floors = [
        [80, 280, 0],
        [590, 270, -210],
        [110, 310, -450],
      ];
    else if (r === 14)
      floors = [
        [80, 300, -80],
        [560, 320, -80],
        [100, 190, -320],
        [670, 190, -320],
        [80, 800, -500],
      ];
    else if (elite)
      floors = [
        [80, 260, -140],
        [620, 260, -350],
        [80, 800, -620],
        [100, 180, -440],
        [680, 180, -440],
      ];
    else if (r % 3 === 1)
      floors = [
        [430, 450, -140],
        [80, 260, -340],
        [80, 800, -590],
        [650, 210, -340],
        [80, 260, -140],
      ];
    else if (r % 3 === 2)
      floors = [
        [80, 800, -150],
        [80, 280, -350],
        [400, 480, -600],
        [80, 220, -600],
        [550, 330, -350],
      ];
    else
      floors = [
        [80, 800, -140],
        [80, 280, -350],
        [80, 800, -600],
        [640, 240, -350],
      ];
    const platformStart = platforms.length,
      anchorStart = anchors.length,
      foeStart = enemies.length;
    for (const [x, w, y] of floors) platforms.push([x, w, top + y, 0]);
    const aa =
      r === 14
        ? [
            [300, -40],
            [660, -40],
            [480, -350],
          ]
        : [
            [310, 60],
            [610, -140],
            [340, -330],
            [610, -530],
            [350, -700],
          ];
    for (const [x, y] of aa) anchors.push([x, top + y]);
    const bottom = top - height;
    // Only the three named elite encounters seal their lower exit.
    const gate = elite ? platforms.length : -1;
    if (elite) platforms.push([80, 800, bottom + 20, 100 + r]);
    if (r === 0) checkpoints.push([230, 0]);
    else {
      const x = r % 2 ? 80 : 640;
      platforms.push([x, 240, top - 20, 0]);
      checkpoints.push([x + 120, top - 20]);
    }
    for (const [kind, x, f, rank = 0] of groups[r]) {
      const floor = floors[f];
      enemies.push({
        kind,
        x,
        y: top + floor[2] + 34 + ([0, 2, 9].includes(kind) ? 55 : 0),
        room: r,
        elite: rank,
        returnOnly: false,
        node: -1,
      });
    }
    rooms.push({
      id: `M${String(r + 1).padStart(2, "0")}`,
      index: r,
      name: names[r],
      objective: goals[r],
      story: stories[r],
      district: Math.floor(r / 3),
      top,
      bottom,
      height,
      floors,
      anchors: aa,
      foes: groups[r],
      nodes: [],
      mechanic: elite ? "elite" : r === 14 ? "keeper" : "hunt",
      platformStart,
      anchorStart,
      foeStart,
      foeCount: groups[r].length,
      nodeStart: 0,
      nodeCount: 0,
      gate,
    });
    top = bottom;
  }
  // Return only hunters: limited, recognisable pursuit rather than repeat clears.
  for (const r of [2, 7, 12])
    enemies.push({
      kind: 0,
      x: 560,
      y: rooms[r].top - 300,
      room: r,
      elite: 0,
      returnOnly: true,
      node: -1,
    });
  for (const r of [2, 7, 12]) echoes.push([155, rooms[r].top - 300]);
  const keeperIndex = enemies.findIndex((e) => e.kind === 3),
    keeperFloor = rooms[14].platformStart + 4;
  return {
    revision: 3,
    mode: "hunt",
    roster: HUNT_ROSTER,
    rooms,
    platforms,
    anchors,
    enemies,
    checkpoints,
    echoes,
    keeperIndex,
    keeperFloor,
    keeperY: enemies[keeperIndex].y,
    sealAnchors: [rooms[14].anchorStart, rooms[14].anchorStart + 1],
    districtBounds: [3, 6, 9, 12].map((r) => rooms[r].top),
    depth: -top,
    nodes: [],
    sides: [],
    lifts: [],
    heats: [],
    ghosts: [],
    courierFloor: -1,
    courierNode: -1,
    counterweightFloor: -1,
  };
}
