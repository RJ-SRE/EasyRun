// Selection is independent of exam tags, combat difficulty and hint/timing.
// Existing bank: gameplay tiers, not CEFR. Reviewed core banks use difficulty.
export const WORD_MODES = ["normal", "hard", "challenge", "random"];
export const WORD_MODE_LABELS = ["普通", "困难", "挑战", "随机"];
export function wordDifficulty(word) {
  const level =
    { normal: 1, hard: 2, challenge: 3 }[word.difficulty] ?? word.tier;
  if (![1, 2, 3].includes(level))
    throw new Error("Missing word difficulty: " + word.id);
  return level;
}
export function wordModeOf(settings = {}) {
  return WORD_MODES.includes(settings.wordMode) ? settings.wordMode : "normal";
}
