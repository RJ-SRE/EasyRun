import { EXPEDITION } from "./expedition-data.js";
export { EXPEDITION };
export function questRecord() {
  return "";
}
export function expeditionAfterword() {
  return "";
}
export function expeditionDevice() {
  return null;
}
export function expeditionHint(s) {
  const e = s.expedition,
    r = EXPEDITION.rooms[e?.room];
  if (!r) return "";
  if (s.segment === 2) return `${r.name} · 借永久锚点连续上返，留意三处追猎。`;
  if (e.done[e.room]) return `${r.name} · 守卫已退，继续向下。`;
  return `${r.name} · ${r.objective}`;
}
