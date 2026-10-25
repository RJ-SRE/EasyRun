const arr = (a, type = "float64") => `[]${type}{${a.join(",")}}`;
export function huntInit(l) {
  const cols = {
    roomTop: [l.rooms.map((r) => r.top)],
    roomBottom: [l.rooms.map((r) => r.bottom)],
    roomFlags: [Array(15).fill(0), "int"],
    roomDone: [Array(15).fill(0), "int"],
    sideProgress: [Array(5).fill(0), "int"],
    trialVisited: [l.anchors.map(() => 0), "int"],
    nodeX: [[]],
    nodeY: [[]],
    nodeKind: [[], "int"],
    nodeRoom: [[], "int"],
    nodeSide: [[], "int"],
    nodeStep: [[], "int"],
    enemyRoom: [l.enemies.map((e) => e.room), "int"],
    enemyReturnOnly: [l.enemies.map((e) => +e.returnOnly), "int"],
    enemyNode: [l.enemies.map(() => -1), "int"],
    enemyElite: [l.enemies.map((e) => e.elite), "int"],
    districtEdges: [l.districtBounds],
    liftFloor: [[], "int"],
    liftRoom: [[], "int"],
    heatY: [[]],
    heatX: [[]],
    heatState: [[], "int"],
  };
  return `func initExpeditionData(){\n${Object.entries(cols)
    .map(([k, args]) => `${k}=${arr(...args)}`)
    .join("\n")}
 worldBottom=${l.platforms[l.keeperFloor][2]}; keeperFloorIndex=${l.keeperFloor}; sealA=${l.sealAnchors[0]}; sealB=${l.sealAnchors[1]}
 foremanIndex=${l.enemies.findIndex((e) => e.elite === 1)}; hunterLeft=${l.enemies.findIndex((e) => e.elite === 2)}; hunterRight=${l.enemies.findIndex((e) => e.elite === 3)}
 }
 func emitExpedition(){println "@expedition",expRoom,-1,0,0,0,0,0,0,0,0,${Array.from({ length: 15 }, (_, i) => `roomFlags[${i}]`).join(",")},${Array.from({ length: 15 }, (_, i) => `roomDone[${i}]`).join(",")},0,0,0,0,0}
 `;
}
