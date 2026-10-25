import { EXPEDITION } from "./expedition-data.js";
export { EXPEDITION };
export function questRecord(index, progress) {
  const records = [
    [
      "运输匣仍按旧时刻表投递；废弃收件口在下层右侧。",
      "运输匣终于抵达。上层旧货梯重新运作，返程可乘它上升。",
    ],
    [
      "受力扣已经找到。修补机在下层右侧等待安全的工作位置。",
      "修补机接好了中央支撑。来时留下的缺口，现在有了真实落脚点。",
    ],
    [
      "第一份索引只有机器编号，另一份记录保存在封存大厅。",
      "两份记录吻合：编号七是送信的“苇”，编号十一是修路的“栖”。它们的职责仍在继续，名字也被带了出来。",
    ],
    [
      "沿镜廊连续换过三个不同锚点，落地或受击会重计；完成后到下层交付台。",
      "旧猎手认可了这条连续的空中路线。“看破倒影”称号已可在成就册佩戴，返程肩台已接通。",
    ],
    [
      "备用灯芯随身携带。把它送到下一间回路室左侧的路标。",
      "灯芯被安放在机枢归路。灯光与落脚点会在返程时为你指路。",
    ],
  ];
  return records[index]?.[progress === 2 ? 1 : 0] || "";
}
export function expeditionAfterword(e) {
  if (!e) return "";
  const records = [];
  if (e.recordChoice === 1)
    records.push("你带回了原始记录。那半句被删去的委托，终于有了完整的证据。");
  if (e.recordChoice === 2)
    records.push(
      "你复制的目录照亮了归途；原件仍留在档案灯旁，等待下一位来客。",
    );
  if (e.sides?.[2] === 2)
    records.push("你记住了苇和栖——送信与修路的机器，终于不再只有编号。");
  if (e.sides?.[4] === 2) records.push("机枢外，你安放的那盏灯仍在发光。");
  return records.join("\n");
}
const descriptions = {
  exit: ["进入下层门廊", "沿着残桥继续下潜。"],
  "bridge-lock": ["解除桥头锁", "接通下方通路；高低路线都能抵达此处。"],
  "cargo-start": ["接管运输笼", "货笼开始往返，可载着你换到另一高度。"],
  "cargo-park": ["设置返程停靠", "货笼的偏移方向会留到返程。", "V · 右侧停靠"],
  "weight-left": ["释放左扣", "近身或远射解扣，两台配重开始反向运动。"],
  "weight-right": ["释放右扣", "解除另一扣件，吊台恢复完整行程与射击窗口。"],
  "weight-route": ["接通配重出口", "两侧扣件已经释放，接通下层通路。"],
  vent: ["打开泄压阀", "关闭本段热流，归来时这里仍是安全通路。"],
  "weight-decoy-left": [
    "敲动左配重",
    "诱使已经起手的链钩击中配重；他会失衡，露出反击窗口。",
  ],
  "weight-decoy-right": ["敲动右配重", "激活后退开，让链钩撞上配重。"],
  drain: ["排水", "显露低处的实体书架，也读取维修记录。"],
  "index-a": ["查看维修目录", "这座城维护的是记忆，委托只写了一半。"],
  "lamp-start": ["放行档案灯", "可以先清路；灯会等在下一处安全台。"],
  "lamp-rest": [
    "继续引灯",
    "受扰只退回最近停靠台。先处理拦路者，或借高差绕到侧后。",
  ],
  "lamp-end": ["接收档案灯", "灯中记录抵达安全处，打开下层通路。"],
  "record-a": ["读取原始命令", "“让钟心离开，否则记录终将失去归途。”"],
  "record-b": ["读取维护记录", "“灯仍亮着，名字才仍有人记得。”"],
  "record-choice": [
    "带走原件",
    "原件保留完整告别；目录让返程路标更清楚。两者都能通关。",
    "V · 复制目录",
  ],
  "mirror-proof": [
    "检查实体承重线",
    "真实平台连接着铜轨，淡紫断线只是一层倒影。",
  ],
  "hunter-left": ["解除左侧追猎锁", "双卫已经失去配合，接通一侧通路。"],
  "hunter-right": ["解除右侧追猎锁", "打开交错猎场出口。"],
  "bridge-pivot": [
    "接通下桥",
    "选择低处落脚点；上桥更适合返程。基础锚点始终保留。",
    "V · 接通上桥",
  ],
  "bridge-exit": ["锁定桥架出口", "桥向将保留到你返回这里。"],
  "energy-choice": [
    "留灯",
    "少恢复一格生命，归途黑潮慢 15%；携心则充满余烬。",
    "V · 携心",
  ],
  "circuit-a": ["切断左回路", "可贴近解除，也可从合适角度用箭或刀切断。"],
  "circuit-b": ["切断中回路", "改变高度，找到实际能命中的位置。"],
  "circuit-c": ["切断右回路", "最后一条外部供能线；三处都断开后进入核心。"],
};
export function expeditionDevice(s) {
  const e = s.expedition,
    n = EXPEDITION.nodes[e?.prompt];
  if (!n) return null;
  if (n.side >= 0) {
    const q = EXPEDITION.sides[n.side],
      first = n.step === 0;
    const steps = [
      ["取回运输匣", "送回废弃投递口"],
      ["拾取受力扣", "清出维修位置并交还"],
      ["读取第一份索引", "核对第二份索引"],
      ["接受猎手试炼", "完成换钩路线"],
      ["领取备用灯芯", "为归路点亮路标"],
    ];
    const details = [
      "完成后启用上层旧货梯，返程可乘台上升。",
      "机器需要附近没有交战者的安全维修位置。",
      "两处记录一起保存，归途与纪事会留下名字。",
      `不落地连续换过三个不同锚点：${Math.min(e.trialHooks, 3)}/3。`,
      "完成后恢复机枢归路的一处落脚点。",
    ];
    return {
      title: q.name,
      action: `F · ${steps[n.side][first ? 0 : 1]}`,
      detail: details[n.side],
    };
  }
  const [title, detail, alternate] = descriptions[n.kind] || [
    "检查机关",
    "沿实体路线继续前进。",
  ];
  return { title, action: `F · ${title}`, detail, alternate };
}
export function expeditionHint(s) {
  const e = s.expedition,
    r = EXPEDITION.rooms[e?.room];
  if (!r) return "";
  if (s.segment === 2)
    return `${r.name} · 向上撤离。接通的设施仍可使用，永久锚点始终通向出口。`;
  if (e.sides[3] === 1 && e.room >= 9 && e.room <= 11)
    return e.trialHooks >= 3
      ? "试炼已完成 · 前往折光天桥左侧交付台领取猎手纹样。"
      : `旧猎手试炼 ${e.trialHooks}/3 · 按住 S 向下选点，松开 E 下甩，连续接过不同锚点。`;
  if (e.done[e.room]) return `${r.name} · 通路已接通，继续向下。`;
  if (e.room === 7)
    return e.lampMoving
      ? "档案灯正在转移 · 可以先行清路；它会等在下一处安全台。"
      : `${r.objective} · 接近停靠台按 F 放行。`;
  if (e.room === 5)
    return "监炉者 · 先看链钩起手，借左右配重诱导撞击，再抓收势反击。";
  if (e.room === 10)
    return "镜猎双卫 · 铜线相连时交替掩护，借钩拉开距离或隔开视线，抓住断联空档。";
  return `${r.name} · ${r.objective}`;
}
