import { NODE_KINDS } from "./belfry-expedition.mjs";
const arr = (a, type = "float64") => `[]${type}{${a.join(",")}}`;
export function expeditionInit(l) {
  const r = l.rooms,
    n = l.nodes,
    e = l.enemies;
  const columns = {
    roomTop: [r.map((x) => x.top)],
    roomBottom: [r.map((x) => x.bottom)],
    roomFlags: [r.map(() => 0), "int"],
    roomDone: [r.map(() => 0), "int"],
    sideProgress: [[0, 0, 0, 0, 0], "int"],
    trialVisited: [l.anchors.map(() => 0), "int"],
    nodeX: [n.map((x) => x.x)],
    nodeY: [n.map((x) => x.y)],
    nodeKind: [n.map((x) => NODE_KINDS.indexOf(x.kind)), "int"],
    nodeRoom: [n.map((x) => x.room), "int"],
    nodeSide: [n.map((x) => x.side), "int"],
    nodeStep: [n.map((x) => x.step), "int"],
    enemyRoom: [e.map((x) => x.room), "int"],
    enemyReturnOnly: [e.map((x) => +x.returnOnly), "int"],
    enemyNode: [e.map((x) => x.node), "int"],
    enemyElite: [e.map((x) => +x.elite), "int"],
    districtEdges: [l.districtBounds],
    liftFloor: [l.lifts.map((x) => x.floor), "int"],
    liftRoom: [l.lifts.map((x) => x.room), "int"],
    liftLow: [l.lifts.map((x) => x.low)],
    liftHigh: [l.lifts.map((x) => x.high)],
    liftPeriod: [l.lifts.map((x) => x.period)],
    heatX: [l.heats.map((x) => x.x)],
    heatY: [l.heats.map((x) => x.y)],
    heatWidth: [l.heats.map((x) => x.width)],
    heatOffset: [l.heats.map((x) => x.offset)],
    heatRoom: [l.heats.map((x) => x.room), "int"],
    heatState: [l.heats.map(() => 0), "int"],
  };
  return `func initExpeditionData() {\n${Object.entries(columns)
    .map(([key, args]) => `${key}=${arr(...args)}`)
    .join("\n")}
    courierFloor=${l.courierFloor}; courierNode=${l.courierNode}; counterweightFloor=${l.counterweightFloor};
    worldBottom=${l.platforms[l.keeperFloor][2]}; keeperFloorIndex=${l.keeperFloor}; sealA=${l.sealAnchors[0]}; sealB=${l.sealAnchors[1]}
    lampStart=${r[7].nodeStart}; foremanIndex=${r[5].foeStart + 2}; hunterLeft=${r[10].foeStart + 2}; hunterRight=${r[10].foeStart + 3}
  }
  func emitExpedition() {
    println "@expedition",expRoom,expPrompt,lampStep,lampMoving,lampX,lampY,cargoChoice,mirrorChoice,recordChoice,trialHooks,${r.map((_, i) => `roomFlags[${i}]`).join(",")},${r.map((_, i) => `roomDone[${i}]`).join(",")},${l.sides.map((_, i) => `sideProgress[${i}]`).join(",")}
  }\n`;
}
