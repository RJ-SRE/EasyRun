export const KEEPER_FORMS = ["守铠", "断锋", "缚心"];
export const KEEPER_MOVES = [
  ["衡刃横断", "越过低刃，或绕到背面"],
  ["穿阶推进", "锁定后跳开，等突刺收势反击"],
  ["断阶劈落", "横向离开正前方，避免悬停头顶"],
  ["折返双割", "副手第二刀有独立前摇，保留一次位移"],
  ["掠身回锋", "跳过掠切后留意回身刀，第二次蓄势后再反击"],
  ["跃刃封空", "离开腾跃挑刃的前上方，落地后反击"],
  ["缚刃回收", "避开去回路径；插地时 J 可弹开链刃"],
  ["支地折跃", "落点锁定后从下方穿过，或钩索远离"],
  ["葬刃三决", "低割、挑刃、链刃回收；每段都有再蓄势"],
];

export function keeperStatus(s) {
  const form = KEEPER_FORMS[s.bossStage] || KEEPER_FORMS[0];
  if (s.bossState === 7)
    return {
      name: `守心者 · ${form}`,
      label: `回流 ${Math.max(0, (s.bossMendDuration || 9.5) - (s.bossMendAge || 0)).toFixed(1)}s · 断印 ${s.bossMendHits || 0}/2`,
      hint: "答题时回流仍继续 · 连续命中两次不同施放的 U / L / P 打断；一次连环剑刀只记一次。",
    };
  if (s.bossState === 6)
    return {
      name: `守心者 · ${form}`,
      label: "形态转化 · 旧攻击已消散",
      hint: "甲壳与武器正在重组 · 调整站位，准备新的追击方式。",
    };
  if (s.bossState === 2)
    return {
      name: `守心者 · ${form}`,
      label: "收势 · 可反击",
      hint: "守心者收势中 · 普攻、蓄箭或重斩，选择你的反击。",
    };
  const move = KEEPER_MOVES[s.bossMove];
  return {
    name: `守心者 · ${form}`,
    label: move
      ? `${move[0]} · ${s.bossState === 5 ? "换位" : s.bossState === 1 ? (s.bossLocked ? "方向已锁定" : "蓄势") : "出招"}`
      : "观察站位",
    hint: move
      ? `${move[0]} · ${move[1]}。`
      : "留意守心者的站位与武器，收势后再反击。",
  };
}
