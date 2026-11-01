// Cache rendering writes, never simulation state. Each clone owns its cache.
const targets = new Set([
  "MenuScene",
  "MenuClothLocal",
  "MenuWaterLocal",
  "MenuLightning",
  "MenuFogBase",
  "MenuFogBlend",
  "Ledge",
  "Anchor",
  "Niche",
  "Enemy",
  "EnemyTell",
  "Hazard",
  "Rope",
  "KeeperLine",
  "裂印",
  "ChargeHalo",
  "Core",
  "SpiritBow",
  "BowLock",
  "HealingWeave",
  "Target",
  "RisingVoid",
  "District0",
  "District1",
  "District2",
  "District3",
  "District4",
]);
export function cacheRenderWrites(name, source) {
  if (!targets.has(name)) return source;
  if (/^var\s/m.test(source))
    throw new Error("Merge render-cache fields before adding " + name);
  const props = [
    ["Heading", "angle", "setHeading"],
    ["Size", "size", "setSize"],
    ["Ghost", "ghost", "setGraphicEffect GhostEffect,"],
    ["Light", "light", "setGraphicEffect BrightnessEffect,"],
    ["Color", "color", "setGraphicEffect ColorEffect,"],
  ];
  let fields =
    " renderVisibleKnown bool\n renderVisible bool\n renderPositionKnown bool\n renderX float64\n renderY float64\n renderCostumeKnown bool\n renderCostumeIndex int\n";
  let methods = `func renderShow() {if !renderVisibleKnown || !renderVisible {renderVisibleKnown=true; renderVisible=true; show}}
func renderHide() {if !renderVisibleKnown || renderVisible {renderVisibleKnown=true; renderVisible=false; hide}}
func renderPosition(x,y float64) {if !renderPositionKnown || x!=renderX || y!=renderY {renderPositionKnown=true; renderX=x; renderY=y; setXYpos x,y}}
func renderCostume(c int) {if !renderCostumeKnown || c!=renderCostumeIndex {renderCostumeKnown=true; renderCostumeIndex=c; renderGhostKnown=false; renderLightKnown=false; renderColorKnown=false; setCostume c}}
`;
  let cached = source
    .replace(/\bshow\b/g, "renderShow()")
    .replace(/\bhide\b/g, "renderHide()")
    .replace(/\bsetXYpos /g, "renderPosition ")
    .replace(/\bsetCostume /g, "renderCostume ");
  for (const [suffix, value, command] of props) {
    fields += ` render${suffix}Known bool\n render${suffix}Value float64\n`;
    methods += `func render${suffix}(${value} float64) {if !render${suffix}Known || ${value}!=render${suffix}Value {render${suffix}Known=true; render${suffix}Value=${value}; ${command} ${value}}}\n`;
    cached = cached.replaceAll(
      command + (command.endsWith(",") ? "" : " "),
      "render" + suffix + " ",
    );
  }
  return "var (\n" + fields + ")\n" + methods + cached;
}
