// English-only milestones. Counts describe practice evidence, never mastery.
const rows = [
  ["first", "初次刻印", "正确完成第一个单词", 0, 1],
  ["ten", "十词相伴", "累计答对 10 个不同单词", 0, 10],
  ["thirty", "三十道光", "累计答对 30 个不同单词", 0, 30],
  ["hundred", "百词成册", "累计答对 100 个不同单词", 0, 100],
  ["three-hundred", "词海行者", "累计答对 300 个不同单词", 0, 300],
  ["thousand", "千词星图", "累计答对 1000 个不同单词", 0, 1000],
  ["spell-ten", "落笔有声", "累计正确拼写 10 次", 1, 10],
  ["spell-fifty", "笔锋渐稳", "累计正确拼写 50 次", 1, 50],
  ["spell-two-hundred", "字母织匠", "累计正确拼写 200 次", 1, 200],
  ["meaning-ten", "词义初明", "累计正确辨义 10 次", 2, 10],
  ["meaning-fifty", "心领词意", "累计正确辨义 50 次", 2, 50],
  ["meaning-two-hundred", "语意拾光", "累计正确辨义 200 次", 2, 200],
  ["dual-five", "双面铭文", "5 个词均有拼写与辨义正确记录", 3, 5],
  ["dual-twenty-five", "知形知义", "25 个词均有拼写与辨义正确记录", 3, 25],
  ["dual-hundred", "百词双生", "100 个词均有拼写与辨义正确记录", 3, 100],
  ["recover-five", "错处生光", "5 个不同词曾错后重新答对", 4, 5],
  ["recover-twenty", "拾回遗词", "20 个不同词曾错后重新答对", 4, 20],
  ["recall-five", "隐字落笔", "提示隐藏后开始并拼对 5 次", 5, 5],
  ["recall-twenty-five", "无形之词", "提示隐藏后开始并拼对 25 次", 5, 25],
  ["review-five", "久别重逢", "到复习时间后正确作答 5 次", 6, 5],
  ["review-twenty-five", "记忆回廊", "到复习时间后正确作答 25 次", 6, 25],
  ["days-three", "三日留痕", "在 3 个不同自然日实际作答", 7, 3],
  ["days-seven", "七日回响", "在 7 个不同自然日实际作答", 7, 7],
  ["streak-ten", "思绪如流", "同一次远征连续正确作答 10 次", 8, 10],
];
const icons = [
  "M6 6h9v21H6zM17 6h9v21h-9M9 11h3m8 0h3M9 17h3m8 0h3",
  "M7 26 23 5l4 3-15 21H6zM11 22l5 4",
  "M3 16q13-16 26 0-13 16-26 0zM16 11a5 5 0 1 0 .1 0",
  "M10 5 2 16l8 11 8-11zM22 5l-8 11 8 11 8-11z",
  "M7 10a11 11 0 1 1-2 12M7 4v7H1",
  "M22 4a13 13 0 1 0 5 22A13 13 0 0 1 22 4zM22 12h6m-3-3v6",
  "M7 5h18M7 27h18M9 5v6l14 10v6M23 5v6L9 21v6",
  "M16 8a8 8 0 1 0 .1 0M16 1v4m0 22v4M1 16h4m22 0h4M5 5l3 3m16 16 3 3M5 27l3-3M24 8l3-3",
  "M3 11l6 5-6 5m9-10 6 5-6 5m9-10 6 5-6 5",
];
export const LEARNING_MILESTONES = rows.map(
  ([id, title, rule, metric, goal], index) => ({
    id,
    title,
    rule,
    metric,
    goal,
    index,
    icon: icons[metric],
  }),
);
export function freshLearningMilestones() {
  return { schema: 1, unlocked: Array(24).fill(0), days: [], peak: 0 };
}
export function cleanLearningMilestones(raw) {
  const value = freshLearningMilestones();
  if (!raw || raw.schema !== 1) return value;
  if (Array.isArray(raw.unlocked) && raw.unlocked.length === 24)
    value.unlocked = raw.unlocked.map((n) =>
      Number.isSafeInteger(n) && n >= 0 ? n : 0,
    );
  if (Array.isArray(raw.days))
    value.days = [
      ...new Set(
        raw.days.filter(
          (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1000000,
        ),
      ),
    ].slice(-8000);
  value.peak = Number.isSafeInteger(raw.peak) && raw.peak >= 0 ? raw.peak : 0;
  return value;
}
export function learningMetrics(history, study) {
  const m = Array(9).fill(0);
  for (const h of Object.values(history)) {
    if ((h.spell?.correct || 0) + (h.meaning?.correct || 0) > 0) m[0]++;
    m[1] += h.spell?.correct || 0;
    m[2] += h.meaning?.correct || 0;
    if (h.spell?.correct && h.meaning?.correct) m[3]++;
    m[4] += h.learning?.recovered ? 1 : 0;
    m[5] += h.learning?.recall || 0;
    m[6] += h.learning?.review || 0;
  }
  m[7] = study.days.length;
  m[8] = study.peak;
  return m;
}
export function unlockLearningMilestones(study, metrics, now = Date.now()) {
  const fresh = [];
  for (const a of LEARNING_MILESTONES)
    if (!study.unlocked[a.index] && metrics[a.metric] >= a.goal) {
      study.unlocked[a.index] = Math.floor(now / 1000);
      fresh.push(a.index);
    }
  return fresh;
}
export function practiceDay(now) {
  const date = new Date(now);
  return Math.floor((now - date.getTimezoneOffset() * 60000) / 86400000);
}
