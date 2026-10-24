import { WORDS, CONTENT_VERSION } from "./cet4-words.js";
export const STORAGE_KEY = "easyrun-inscription-v1";
export const DEFAULTS = {
  enabled: true,
  tier: "standard",
  pace: "standard",
  hint: "standard",
  reduced: false,
};
export const BANK = new Map(WORDS.map((w) => [w.id, w]));
const copy = (v) => JSON.parse(JSON.stringify(v));
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(values, rng) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function poolFor(seed, tier, history = {}) {
  const rng = random(seed),
    eligible = shuffle(
      WORDS.filter((w) =>
        tier === "foundation"
          ? w.tier <= 2
          : tier === "challenge"
            ? w.tier >= 2
            : true,
      ),
      rng,
    );
  if (eligible.length < 30) throw new Error("该难度的词池不足 30 词");
  const selected = [];
  const take = (words, n) => {
    for (const w of words)
      if (n && !selected.includes(w)) {
        selected.push(w);
        n--;
      }
  };
  take(
    eligible.filter((w) => !history[w.id]?.seen),
    18,
  );
  take(
    eligible.filter((w) => history[w.id]?.wrong),
    8,
  );
  take(
    eligible.filter((w) => history[w.id]?.completed),
    4,
  );
  take(eligible, 30 - selected.length);
  // Guarantee six short entries without adding words from a different tier.
  let short = selected.filter((w) => w.word.length <= 6).length;
  for (const w of eligible)
    if (short < 6 && w.word.length <= 6 && !selected.includes(w)) {
      const i = selected.findLastIndex((v) => v.word.length > 6);
      selected[i] = w;
      short++;
    }
  return shuffle(selected, rng).map((w) => w.id);
}
export function allowance(word, kind, pace) {
  const base =
    kind === "spell"
      ? Math.min(9, Math.max(5, 3 + 0.45 * word.word.length))
      : kind === "control"
        ? 4.5
        : 5.5;
  return Math.max(
    3.5,
    base * ({ relaxed: 1.35, standard: 1, brisk: 0.8 }[pace] || 1),
  );
}
export function normalize(value) {
  return String(value).trim().toLowerCase();
}
export function matches(word, value) {
  return word.accepted.includes(normalize(value));
}
export class InscriptionBook {
  constructor(saved, seed = Date.now()) {
    this.notice = "";
    this.data = {
      version: 1,
      contentVersion: CONTENT_VERSION,
      settings: { ...DEFAULTS },
      history: {},
      run: null,
    };
    if (saved)
      try {
        const s = typeof saved === "string" ? JSON.parse(saved) : copy(saved);
        if (
          s.version !== 1 ||
          s.contentVersion !== CONTENT_VERSION ||
          !s.settings ||
          !s.history ||
          typeof s.history !== "object"
        )
          throw new Error("version");
        const r = s.run;
        if (
          r &&
          (!Number.isSafeInteger(r.seed) ||
            !Array.isArray(r.pool) ||
            r.pool.length !== 30 ||
            new Set(r.pool).size !== 30 ||
            r.pool.some((id) => !BANK.has(id)) ||
            !r.progress ||
            !Array.isArray(r.resolved) ||
            !Number.isFinite(r.activeSeconds) ||
            !Number.isFinite(r.promptSeconds))
        )
          throw new Error("run");
        if (
          r &&
          (Array.isArray(r.progress) ||
            Object.entries(r.progress).some(
              ([id, p]) =>
                !r.pool.includes(id) ||
                !p ||
                typeof p !== "object" ||
                !Number.isFinite(p.seen) ||
                !Number.isFinite(p.wrong) ||
                typeof p.correct !== "boolean",
            ))
        )
          throw new Error("progress");
        if (Object.values(s.history).some((p) => !p || typeof p !== "object"))
          throw new Error("history");
        this.data = s;
        this.data.settings = { ...DEFAULTS, ...s.settings };
        if (
          !["foundation", "standard", "challenge"].includes(this.settings.tier)
        )
          this.settings.tier = "standard";
        if (!["relaxed", "standard", "brisk"].includes(this.settings.pace))
          this.settings.pace = "standard";
        if (!["guided", "standard", "recall"].includes(this.settings.hint))
          this.settings.hint = "standard";
        if (
          r?.reserved &&
          (!r.pool.includes(r.reserved.wordId) ||
            !["spell", "meaning"].includes(r.reserved.type) ||
            !Array.isArray(r.reserved.options) ||
            r.reserved.options.length !== 3 ||
            !r.reserved.options.includes(BANK.get(r.reserved.wordId).meaning))
        )
          r.reserved = null;
      } catch {
        this.notice = "本机词册格式异常，已建立新词组；游戏仍可正常开始。";
      }
    if (!this.run) this.newPool(seed);
  }
  get settings() {
    return this.data.settings;
  }
  get run() {
    return this.data.run;
  }
  get count() {
    return Object.values(this.run.progress).filter((p) => p.correct).length;
  }
  newPool(seed) {
    const pool = poolFor(seed >>> 0, this.settings.tier, this.data.history);
    this.data.run = {
      seed: seed >>> 0,
      pool,
      progress: {},
      resolved: [],
      reserved: null,
      serial: 0,
      activeSeconds: 0,
      promptSeconds: 0,
      started: false,
      won: false,
      snapshot: null,
      attempt: 0,
    };
  }
  restart() {
    const { seed, pool } = this.run;
    this.newPool(seed);
    this.run.pool = pool;
  }
  begin(attempt) {
    this.run.started = true;
    this.run.attempt = attempt;
  }
  question(kind, actionId) {
    const r = this.run;
    if (r.reserved && r.reserved.actionId === actionId) return r.reserved;
    const serial = r.serial + 1;
    const retry = r.pool.filter((id) => {
      const p = r.progress[id];
      return (
        p?.wrong &&
        !p.correct &&
        serial - p.last >= 3 &&
        r.activeSeconds - p.at >= 30
      );
    });
    const unseen = r.pool.filter((id) => !r.progress[id]?.seen);
    const remaining = r.pool
      .filter((id) => !r.progress[id]?.correct)
      .sort((a, b) => (r.progress[a]?.last || 0) - (r.progress[b]?.last || 0));
    const completed = r.pool.filter(
      (id) => r.progress[id]?.correct && serial - r.progress[id].last >= 3,
    );
    // After an unusually fast all-wrong pass, never repeat a word immediately
    // and never hold a needed skill hostage to a real-time retry timer.
    const fallback = remaining.find(
      (id) => serial - (r.progress[id]?.last || 0) >= 3,
    );
    const wordId =
      r.reserved?.wordId ||
      (serial % 4 === 0 && retry.length
        ? retry[0]
        : unseen[0] ||
          retry[0] ||
          completed[0] ||
          fallback ||
          r.pool[(serial - 1) % 30]);
    const word = BANK.get(wordId),
      rng = random(r.seed + serial * 173);
    const type =
      kind >= 3 ? "meaning" : (serial + r.seed) % 2 ? "spell" : "meaning";
    const options =
      r.reserved?.options || shuffle([word.meaning, ...word.distractors], rng);
    r.reserved = {
      wordId,
      type,
      options,
      serial,
      actionId,
      kind,
      review: !!r.progress[wordId]?.correct,
    };
    return r.reserved;
  }
  settle(actionId, outcome, seconds, assisted = false) {
    const r = this.run,
      q = r.reserved;
    if (!q || q.actionId !== actionId || r.resolved.includes(actionId))
      return false;
    r.resolved.push(actionId);
    r.resolved = r.resolved.slice(-300);
    r.reserved = null;
    if (outcome === "cancel") return true;
    const p = (r.progress[q.wordId] ||= { seen: 0, correct: false, wrong: 0 });
    p.seen++;
    p.last = q.serial;
    p.at = r.activeSeconds;
    p.seconds = seconds;
    p.assisted = assisted;
    if (outcome === "correct") p.correct = true;
    else p.wrong++;
    r.serial = q.serial;
    const h = (this.data.history[q.wordId] ||= {
      seen: 0,
      wrong: 0,
      completed: false,
    });
    h.seen++;
    if (outcome !== "correct") h.wrong++;
    return true;
  }
  victory() {
    if (this.run.won) return;
    this.run.won = true;
    for (const [id, p] of Object.entries(this.run.progress))
      if (p.correct) {
        const h = (this.data.history[id] ||= { seen: 0, wrong: 0 });
        h.completed = true;
        h.wrong = 0;
      }
  }
  serialize() {
    return JSON.stringify(this.data);
  }
}
