// Bounded view pools, independent of authored world size. Hidden clones still
// count against spx 3.3's global 300 limit; collision arrays are never culled.
export const SCENE_POOLS = {
  sceneFloors: 18,
  sceneAnchors: 14,
  sceneEnemies: 12,
  sceneNiches: 6,
  sceneNodes: 12,
  sceneHeats: 2,
  sceneGuides: 4,
};
export const SCENE_SPRITES = new Set([
  "Ledge",
  "Anchor",
  "Enemy",
  "裂印",
  "EnemyTell",
  "Hazard",
  "Niche",
  "ExpeditionNode",
  "HeatVent",
  "DirectoryGuide",
  "Echo",
  "Rope",
  "SealCable",
  "KeeperLine",
]);
export function sceneCloneCount(layout) {
  return (
    Object.values(SCENE_POOLS).reduce((sum, n) => sum + n, 0) +
    SCENE_POOLS.sceneEnemies * 3 +
    layout.echoes.length +
    24 +
    28 +
    8
  );
}
export function sceneInit(layout) {
  return `func initScene() {
    ${Object.entries(SCENE_POOLS)
      .map(([name, size]) => `${name}=[]int{${Array(size).fill(-1).join(",")}}`)
      .join("\n")}
    guideAnchor=[]int{${layout.rooms.map((r) => r.anchorStart).join(",")}}
    guideY=[]float64{${layout.rooms.map((r) => layout.anchors[r.anchorStart][1]).join(",")}}
    sceneClones=${sceneCloneCount(layout)}
  }\n`;
}
