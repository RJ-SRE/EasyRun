export const KEEPER_FORMS = ["守阵重甲", "解甲追猎", "裂心悬刃"];
export const KEEPER_MOVES = [
  ["裁线横扫", "越过刃线，或绕到背面"],
  ["贯阶突刺", "路径锁定后跳开，落空可反击"],
  ["坠炉", "离开落点，或钩索跃过冲击"],
  ["分叉刃", "从散射间隙穿过，J 可斩落飞刃"],
  ["返身双斩", "第二斩会重新预警，保留一次位移"],
  ["折翼俯冲", "先看落点，再从侧面接近"],
  ["裂心刃阵", "落刃按顺序到达，沿空隙移动"],
];

export function keeperStatus(s) {
  const form = KEEPER_FORMS[s.bossStage] || KEEPER_FORMS[0];
  if (s.bossState === 6)
    return {
      name: `守心者 · ${form}`,
      label: "形态转化 · 旧攻击已消散",
      hint: "外甲正在改变 · 调整站位，准备新的追击方式。",
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
