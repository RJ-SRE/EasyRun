// Shared, deterministic learning rules. Clock and randomness are injected.
export const RULE_VERSION = 1;
export const MODES = ["normal", "hard", "challenge", "random"];
export class LearningError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function requireThat(condition, code, status = 400) {
  if (!condition) throw new LearningError(code, status);
}
export const iso = (time) => new Date(time).toISOString();
export function applyAnswer(previous, event, savedAt) {
  requireThat(
    ["spell", "meaning"].includes(event.questionType),
    "INVALID_ABILITY",
  );
  requireThat(
    ["correct", "wrong", "timeout"].includes(event.result),
    "INVALID_RESULT",
  );
  requireThat(
    ["full", "fade", "brief", "none"].includes(event.hintMode),
    "INVALID_HINT",
  );
  requireThat(
    typeof event.answerShown === "boolean" &&
      typeof event.extraHintUsed === "boolean",
    "INVALID_HINT_EVIDENCE",
  );
  requireThat(
    Number.isInteger(event.responseMs) &&
      event.responseMs >= 0 &&
      event.responseMs <= 3600000,
    "INVALID_RESPONSE_TIME",
  );
  const word = previous
    ? structuredClone(previous)
    : {
        firstSeenAt: iso(savedAt),
        everCorrect: false,
        everCompletedInWonRun: false,
        spell: null,
        meaning: null,
      };
  const ability = word[event.questionType] ?? {
    attempts: 0,
    correct: 0,
    wrong: 0,
    timeouts: 0,
    assistedCorrect: 0,
    weaknessMilli: 0,
  };
  const assisted = event.answerShown || event.extraHintUsed;
  ability.attempts++;
  let hours = 6;
  if (event.result === "correct") {
    ability.correct++;
    word.everCorrect = true;
    if (assisted) ability.assistedCorrect++;
    ability.weaknessMilli = Math.floor(
      (ability.weaknessMilli * (assisted ? 8 : 4)) / 10,
    );
    hours = assisted ? 12 : 24;
  } else if (event.result === "wrong") {
    ability.wrong++;
    ability.weaknessMilli = Math.min(6000, ability.weaknessMilli + 1000);
  } else {
    ability.timeouts++;
    ability.weaknessMilli = Math.min(6000, ability.weaknessMilli + 400);
  }
  Object.assign(ability, {
    lastOutcome: event.result,
    lastHintMode: event.hintMode,
    lastAnswerShown: event.answerShown,
    lastExtraHintUsed: event.extraHintUsed,
    lastSeenAt: iso(savedAt),
    nextReviewAt: iso(savedAt + hours * 3600000),
  });
  word[event.questionType] = ability;
  word.lastQuestionType = event.questionType;
  return word;
}
export function category(state, now) {
  const abilities = [state?.spell, state?.meaning].filter(Boolean);
  if (!abilities.length) return "new";
  if (
    abilities.some(
      (a) =>
        a.weaknessMilli >= 650 || ["wrong", "timeout"].includes(a.lastOutcome),
    )
  )
    return "weak";
  if (abilities.some((a) => Date.parse(a.nextReviewAt) <= now)) return "due";
  return "familiar";
}
export function chooseAbility(
  state,
  spellable,
  random = Math.random,
  meaningOnly = false,
) {
  if (!spellable || meaningOnly) return "meaning";
  if (!state?.spell && !state?.meaning)
    return random() < 0.5 ? "spell" : "meaning";
  if (!state.spell) return "spell";
  if (!state.meaning) return "meaning";
  if (state.spell.weaknessMilli !== state.meaning.weaknessMilli)
    return state.spell.weaknessMilli > state.meaning.weaknessMilli
      ? "spell"
      : "meaning";
  return state.lastQuestionType === "spell" ? "meaning" : "spell";
}
export function prepareDeck(lexicon, history, mode, now, random = Math.random) {
  requireThat(MODES.includes(mode), "INVALID_WORD_MODE");
  const buckets = { new: [], due: [], weak: [], familiar: [] };
  for (const word of lexicon.words) {
    if (!word.enabled || (mode !== "random" && word.difficulty !== mode))
      continue;
    buckets[category(history[word.wordId], now)].push(word.wordId);
  }
  requireThat(
    Object.values(buckets).reduce((n, b) => n + b.length, 0) >= 30,
    "INSUFFICIENT_WORD_POOL",
    422,
  );
  const selected = [];
  function take(group, count) {
    const pool = buckets[group];
    while (count-- > 0 && pool.length && selected.length < 30) {
      let index;
      if (group === "weak") {
        const weight = (id) =>
          1 +
          Math.max(
            history[id]?.spell?.weaknessMilli ?? 0,
            history[id]?.meaning?.weaknessMilli ?? 0,
          ) /
            1000;
        let draw = random() * pool.reduce((sum, id) => sum + weight(id), 0);
        index = pool.length - 1;
        for (let i = 0; i < pool.length; i++) {
          draw -= weight(pool[i]);
          if (draw < 0) {
            index = i;
            break;
          }
        }
      } else
        index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
      const wordId = pool[index];
      pool[index] = pool.at(-1);
      pool.pop();
      selected.push({ wordId, reason: group });
    }
  }
  for (const [group, count] of [
    ["new", 12],
    ["due", 10],
    ["weak", 6],
    ["familiar", 2],
  ])
    take(group, count);
  for (const group of ["due", "new", "familiar", "weak"])
    take(group, 30 - selected.length);
  // Interleave groups so the first twelve encounters are not always new words.
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }
  return selected;
}
export function abilityView(a) {
  return a
    ? {
        weaknessMilli: a.weaknessMilli,
        lastOutcome: a.lastOutcome,
        nextReviewAt: a.nextReviewAt,
        nextReviewAtMs: Date.parse(a.nextReviewAt),
      }
    : null;
}
export function wordView(w) {
  return w
    ? {
        everCorrect: w.everCorrect,
        everCompletedInWonRun: w.everCompletedInWonRun,
        spell: abilityView(w.spell),
        meaning: abilityView(w.meaning),
        lastQuestionType: w.lastQuestionType,
      }
    : null;
}
export function summarize(profile, lexicon, now) {
  const enabled = new Set(
    lexicon.words.filter((w) => w.enabled).map((w) => w.wordId),
  );
  let touched = 0,
    correct = 0,
    currentCorrect = 0,
    due = 0;
  for (const [id, w] of Object.entries(profile.words)) {
    touched++;
    if (w.everCorrect) {
      correct++;
      if (enabled.has(id)) currentCorrect++;
    }
    if (
      enabled.has(id) &&
      [w.spell, w.meaning].some((a) => a && Date.parse(a.nextReviewAt) <= now)
    )
      due++;
  }
  return {
    touched,
    correct,
    currentCorrect,
    currentTotal: enabled.size,
    due,
    completedRuns: profile.totals.completedRuns,
  };
}
