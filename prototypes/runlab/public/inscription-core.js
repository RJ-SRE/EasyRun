import { WORDS, CONTENT_VERSION, COVERAGE } from "./cet4-words.js";
export { CONTENT_VERSION, COVERAGE };
export const STORAGE_KEY = "easyrun-inscription-v1";
export const DEFAULTS = {
  enabled: true,
  scope: "mixed",
  strategy: "balanced",
  tier: "standard",
  pace: "standard",
  hint: "standard",
  reduced: false,
};
export const BANK = new Map(WORDS.map((w) => [w.id, w]));
const DAY = 86400000;
const copy = (v) => JSON.parse(JSON.stringify(v));
const finite = (v, fallback = 0) =>
  Number.isFinite(v) && v >= 0 ? Math.min(v, 1e15) : fallback;
const safeObject = (v) => v && typeof v === "object" && !Array.isArray(v);
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
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
export function eligibleWords(settings = DEFAULTS) {
  return WORDS.filter(
    (w) =>
      (settings.scope === "cet4"
        ? w.levels.includes("cet4")
        : settings.scope === "cet6"
          ? w.levels.includes("cet6")
          : true) &&
      (settings.tier === "foundation"
        ? w.tier <= 2
        : settings.tier === "challenge"
          ? w.tier >= 2
          : true),
  );
}
function freshSkill() {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    timeouts: 0,
    assisted: 0,
    streak: 0,
    successDays: [],
    lastSeen: 0,
    lastSuccess: 0,
    due: 0,
    recentFailures: 0,
    errors: [],
  };
}
function cleanSkill(s = {}) {
  if (!safeObject(s)) s = {};
  const out = freshSkill();
  for (const key of Object.keys(out))
    if (typeof out[key] === "number") out[key] = finite(s[key]);
  out.successDays = Array.isArray(s.successDays)
    ? [
        ...new Set(
          s.successDays.filter(
            (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
          ),
        ),
      ].slice(-8)
    : [];
  out.errors = Array.isArray(s.errors)
    ? s.errors
        .filter(safeObject)
        .slice(-4)
        .map((e) => ({
          at: finite(e.at),
          type: ["wrong", "timeout"].includes(e.type) ? e.type : "wrong",
          input: String(e.input || "").slice(0, 48),
          choice: String(e.choice || "").slice(0, 120),
          position: finite(e.position),
        }))
    : [];
  return out;
}
function cleanHistory(raw) {
  if (!safeObject(raw) || Object.keys(raw).length > 40000)
    throw new Error("history");
  const h = Object.create(null);
  for (const [id, s] of Object.entries(raw)) {
    if (!safeObject(s) || id.length > 100) throw new Error("history");
    h[id] = {
      seen: finite(s.seen),
      wrong: finite(s.wrong),
      completed: !!s.completed,
      spell: cleanSkill(s.spell),
      meaning: cleanSkill(s.meaning),
      legacyWrong: finite(s.legacyWrong, s.spell ? 0 : finite(s.wrong)),
      lastSeen: finite(s.lastSeen),
    };
  }
  return h;
}
export function weakness(h, now = Date.now()) {
  if (!h) return 0;
  return Math.min(
    6,
    Math.max(
      h.legacyWrong ? 1 : 0,
      ...["spell", "meaning"].map((k) => {
        const s = h[k];
        return s
          ? s.recentFailures *
              Math.exp(-Math.max(0, now - s.lastSeen) / (30 * DAY))
          : 0;
      }),
    ),
  );
}
export function wordStatus(h, now = Date.now(), spellable = true) {
  if (!h?.seen) return "new";
  if (weakness(h, now) >= 0.65) return "weak";
  if ([h.spell, h.meaning].some((s) => s?.due && s.due <= now)) return "due";
  if (
    (spellable ? [h.spell, h.meaning] : [h.meaning]).every(
      (s) => s?.successDays?.length >= 3 && s.streak >= 2,
    )
  )
    return "stable";
  return "learning";
}
const QUOTAS = {
  balanced: { new: 12, due: 10, weak: 6, familiar: 2 },
  explore: { new: 20, due: 4, weak: 4, familiar: 2 },
  review: { new: 6, due: 12, weak: 10, familiar: 2 },
};
export const CATEGORY_LABELS = {
  new: "新遇",
  due: "复习",
  weak: "薄弱",
  familiar: "熟悉",
};
export function selectPool(
  seed,
  settings,
  history = {},
  now = Date.now(),
  previous = null,
) {
  const eligible = eligibleWords(settings),
    rng = random(seed),
    quotas = QUOTAS[settings.strategy] || QUOTAS.balanced;
  if (eligible.length < 30) throw new Error("该范围的词池不足 30 词");
  const category = (w) => {
    const status = wordStatus(history[w.id], now, w.spellable);
    return status === "new"
      ? "new"
      : status === "weak"
        ? "weak"
        : status === "due"
          ? "due"
          : "familiar";
  };
  const weighted = eligible
    .map((w) => {
      const h = history[w.id],
        cat = category(w);
      const due = Math.max(
        ...["spell", "meaning"].map((k) =>
          h?.[k]?.due ? (now - h[k].due) / DAY : 0,
        ),
      );
      let weight =
        1 +
        (cat === "weak" ? weakness(h, now) : Math.min(3, Math.max(0, due) / 7));
      if (previous?.pool.includes(w.id))
        weight *= previous.progress?.[w.id]?.seen ? 0.3 : 1.25;
      if (w.word.length <= 6) weight *= 1.25;
      return {
        id: w.id,
        category: cat,
        rank: -Math.log(Math.max(1e-9, rng())) / weight,
      };
    })
    .sort((a, b) => a.rank - b.rank);
  const chosen = [],
    ids = new Set();
  const take = (pool, n) => {
    for (const item of pool) {
      if (n <= 0) break;
      if (ids.has(item.id)) continue;
      ids.add(item.id);
      chosen.push(item);
      n--;
    }
  };
  for (const cat of ["weak", "due", "new", "familiar"])
    take(
      weighted.filter((w) => w.category === cat),
      quotas[cat],
    );
  // The weak-word cap survives fallback; an all-weak library is the sole exception.
  take(
    weighted.filter((w) => w.category !== "weak"),
    30 - chosen.length,
  );
  take(weighted, 30 - chosen.length);
  const ordered = shuffle(chosen, rng);
  return {
    pool: ordered.map((w) => w.id),
    reasons: Object.fromEntries(ordered.map((w) => [w.id, w.category])),
    composition: Object.fromEntries(
      Object.keys(quotas).map((k) => [
        k,
        ordered.filter((w) => w.category === k).length,
      ]),
    ),
  };
}
export function poolFor(seed, tier = "standard", history = {}, options = {}) {
  return selectPool(
    seed,
    { ...DEFAULTS, ...options, tier },
    history,
    options.now ?? Date.now(),
    options.previous,
  ).pool;
}
export function allowance(word, kind, pace) {
  const base =
    kind === "spell"
      ? Math.min(15, Math.max(5, 3 + 0.5 * word.word.length))
      : kind === "control"
        ? 4.5
        : Math.min(8, 5.5 + Math.max(0, word.meaning.length - 8) * 0.08);
  return Math.max(
    3.5,
    base * ({ relaxed: 1.35, standard: 1, brisk: 0.8 }[pace] || 1),
  );
}
export function normalize(value) {
  return String(value).trim().toLowerCase().replace(/[’]/g, "'");
}
export function matches(word, value) {
  return word.accepted.includes(normalize(value));
}
function settingsOf(raw = {}) {
  const out = { ...DEFAULTS };
  for (const k of ["enabled", "reduced"])
    if (typeof raw[k] === "boolean") out[k] = raw[k];
  for (const [key, values] of Object.entries({
    scope: ["cet4", "cet6", "mixed"],
    strategy: ["balanced", "explore", "review"],
    tier: ["foundation", "standard", "challenge"],
    pace: ["relaxed", "standard", "brisk"],
    hint: ["guided", "standard", "recall"],
  }))
    if (values.includes(raw[key])) out[key] = raw[key];
  return out;
}
function validRun(r) {
  return (
    safeObject(r) &&
    Number.isSafeInteger(r.seed) &&
    Array.isArray(r.pool) &&
    r.pool.length === 30 &&
    new Set(r.pool).size === 30 &&
    r.pool.every((id) => BANK.has(id)) &&
    safeObject(r.progress) &&
    Object.entries(r.progress).every(
      ([id, p]) =>
        r.pool.includes(id) &&
        safeObject(p) &&
        Number.isFinite(p.seen) &&
        p.seen >= 0 &&
        Number.isFinite(p.wrong) &&
        p.wrong >= 0 &&
        typeof p.correct === "boolean",
    ) &&
    Array.isArray(r.resolved) &&
    Number.isFinite(r.activeSeconds) &&
    r.activeSeconds >= 0 &&
    Number.isFinite(r.promptSeconds) &&
    r.promptSeconds >= 0
  );
}
export class InscriptionBook {
  constructor(saved, seed = Date.now(), clock = () => Date.now()) {
    this.clock = clock;
    this.notice = "";
    this.migrated = false;
    this.data = {
      version: 2,
      contentVersion: CONTENT_VERSION,
      settings: { ...DEFAULTS },
      history: Object.create(null),
      run: null,
      archive: null,
    };
    if (saved)
      try {
        const s = typeof saved === "string" ? JSON.parse(saved) : copy(saved);
        if (![1, 2].includes(s.version) || !safeObject(s.settings))
          throw new Error("version");
        this.data.history = cleanHistory(s.history);
        this.data.settings = settingsOf(s.settings);
        this.migrated = s.version === 1 || s.contentVersion !== CONTENT_VERSION;
        for (const field of ["run", "archive"]) {
          if (validRun(s[field])) {
            const r = copy(s[field]);
            r.progress = Object.assign(Object.create(null), r.progress);
            r.reasons = Object.assign(
              Object.create(null),
              safeObject(r.reasons) ? r.reasons : {},
            );
            r.composition = Object.fromEntries(
              Object.keys(CATEGORY_LABELS).map((k) => [
                k,
                finite(r.composition?.[k]),
              ]),
            );
            r.summary = Object.fromEntries(
              ["first", "independent", "revivals"].map((k) => [
                k,
                finite(r.summary?.[k]),
              ]),
            );
            r.resolved = r.resolved
              .filter((x) => typeof x === "string")
              .slice(-300);
            r.serial = finite(r.serial);
            if (
              r.reserved &&
              (!r.pool.includes(r.reserved.wordId) ||
                !["spell", "meaning"].includes(r.reserved.type) ||
                !Array.isArray(r.reserved.options) ||
                r.reserved.options.length !== 3 ||
                new Set(r.reserved.options).size !== 3 ||
                r.reserved.options.some((v) => typeof v !== "string") ||
                !r.reserved.options.includes(
                  BANK.get(r.reserved.wordId).meaning,
                ))
            )
              r.reserved = null;
            this.data[field] = r;
          } else if (s[field])
            this.notice = "词库已更新，旅程词组已重建；长期记录保留。";
        }
        if (this.migrated && !this.notice)
          this.notice = "已迁移旧词册；原有完成与错误记录保留。";
      } catch {
        this.notice = "词册格式异常，已建立新词组；原文件未被删除。";
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
    const previous = this.run;
    const selection = selectPool(
      seed >>> 0,
      this.settings,
      this.data.history,
      this.clock(),
      previous,
    );
    this.data.run = {
      seed: seed >>> 0,
      ...selection,
      progress: Object.create(null),
      resolved: [],
      reserved: null,
      serial: 0,
      activeSeconds: 0,
      promptSeconds: 0,
      started: false,
      won: false,
      snapshot: null,
      attempt: 0,
      summary: { first: 0, independent: 0, revivals: 0 },
    };
  }
  prepare(seed) {
    if (this.run.started) {
      if (!this.run.won) {
        this.data.archive = copy(this.run);
        this.data.archive.progress = Object.assign(
          Object.create(null),
          this.data.archive.progress,
        );
      }
      this.newPool(seed);
    }
  }
  restart() {
    const { seed, pool, reasons, composition } = this.run;
    this.newPool(seed);
    Object.assign(this.run, { pool, reasons, composition });
  }
  begin(attempt) {
    this.run.started = true;
    this.run.attempt = attempt;
    this.data.archive = null;
  }
  resume() {
    if (!this.data.archive) return false;
    this.data.run = this.data.archive;
    this.data.run.progress = Object.assign(
      Object.create(null),
      this.data.run.progress,
    );
    this.data.archive = null;
    return true;
  }
  get resumable() {
    return this.run.started && !this.run.won && this.run.snapshot
      ? this.run
      : this.data.archive;
  }
  question(kind, actionId, context = {}) {
    const r = this.run;
    if (r.reserved?.actionId === actionId) return r.reserved;
    const serial = r.serial + 1;
    const safe = (id) =>
      !r.progress[id]?.seen ||
      (serial - r.progress[id].last >= 3 &&
        r.activeSeconds - r.progress[id].at >= 30);
    const retry = r.pool.filter(
      (id) =>
        r.progress[id]?.wrong &&
        !r.progress[id].correct &&
        r.progress[id].wrong < 2 &&
        safe(id),
    );
    const unseen = r.pool.filter((id) => !r.progress[id]?.seen);
    const rng = random(r.seed + serial * 173);
    // Low-health/control commitments prefer familiar, short prompts within this run.
    const urgent = kind >= 3 || context.health <= 2;
    const rank = (id) => {
      const w = BANK.get(id),
        h = this.data.history[id];
      return urgent
        ? (h?.seen ? -5 : 0) + w.word.length * 0.2
        : serial <= 3
          ? w.word.length * 0.4
          : 0;
    };
    unseen.sort((a, b) => rank(a) - rank(b));
    const completed = r.pool.filter(
      (id) => r.progress[id]?.correct && safe(id),
    );
    const fallback = r.pool
      .filter((id) => serial - (r.progress[id]?.last || 0) >= 3)
      .sort((a, b) => (r.progress[a]?.last || 0) - (r.progress[b]?.last || 0));
    const wordId =
      r.reserved?.wordId ||
      (serial % 4 === 0 && retry.length
        ? retry[0]
        : unseen[0] ||
          retry[0] ||
          completed[0] ||
          fallback[0] ||
          r.pool[(serial - 1) % 30]);
    const w = BANK.get(wordId),
      h = this.data.history[wordId];
    let type =
      kind >= 3 ? "meaning" : (serial + r.seed) % 2 ? "spell" : "meaning";
    if (kind < 3 && h?.spell?.recentFailures > h?.meaning?.recentFailures + 0.5)
      type = "spell";
    if (kind < 3 && h?.meaning?.recentFailures > h?.spell?.recentFailures + 0.5)
      type = "meaning";
    if (w.spellable === false) type = "meaning";
    r.reserved = {
      wordId,
      type,
      options:
        r.reserved?.options || shuffle([w.meaning, ...w.distractors], rng),
      serial,
      actionId,
      kind,
      review: !!r.progress[wordId]?.correct,
      supported: (r.progress[wordId]?.wrong || 0) >= 2,
    };
    return r.reserved;
  }
  settle(actionId, outcome, seconds, assisted = false, details = {}) {
    const r = this.run,
      q = r.reserved;
    if (!q || q.actionId !== actionId || r.resolved.includes(actionId))
      return false;
    r.resolved.push(actionId);
    r.resolved = r.resolved.slice(-300);
    r.reserved = null;
    if (outcome === "cancel") return true;
    const now = this.clock(),
      p = (r.progress[q.wordId] ||= { seen: 0, correct: false, wrong: 0 });
    const first = !p.correct;
    p.seen++;
    p.last = q.serial;
    p.at = r.activeSeconds;
    p.seconds = finite(seconds);
    p.assisted = assisted;
    if (outcome === "correct") p.correct = true;
    else p.wrong++;
    r.serial = q.serial;
    const h = (this.data.history[q.wordId] ||= {
      seen: 0,
      wrong: 0,
      completed: false,
      spell: freshSkill(),
      meaning: freshSkill(),
      legacyWrong: 0,
      lastSeen: 0,
    });
    const wasWeak = weakness(h, now) >= 0.65,
      wasSeen = h.seen > 0;
    h.seen++;
    h.lastSeen = now;
    if (outcome !== "correct") h.wrong++;
    const s = (h[q.type] ||= freshSkill());
    s.attempts++;
    s.lastSeen = now;
    const independent = outcome === "correct" && !assisted;
    if (outcome === "correct") {
      s.correct++;
      if (assisted) s.assisted++;
      else {
        s.streak++;
        const date = new Date(now).toLocaleDateString("en-CA", {
          timeZone: "Asia/Shanghai",
        });
        if (!s.successDays.includes(date)) s.successDays.push(date);
        s.successDays = s.successDays.slice(-8);
        s.lastSuccess = now;
      }
      s.recentFailures *= assisted ? 0.8 : 0.4;
      h.legacyWrong = 0;
      s.due =
        now +
        (assisted
          ? 0.5
          : [1, 3, 7, 14, 30][
              Math.min(4, Math.min(s.streak, s.successDays.length) - 1)
            ] || 1) *
          DAY;
      if (first) {
        if (!wasSeen) r.summary.first++;
        if (independent) r.summary.independent++;
        if (wasWeak && independent) r.summary.revivals++;
      }
    } else {
      if (outcome === "timeout") s.timeouts++;
      else s.wrong++;
      s.streak = 0;
      s.recentFailures = Math.min(
        6,
        s.recentFailures + (outcome === "timeout" ? 0.4 : 1),
      );
      s.due = now + DAY / 4;
      s.errors.push({
        at: now,
        type: outcome === "timeout" ? "timeout" : "wrong",
        input: String(details.input || "").slice(0, 48),
        choice: String(details.choice || "").slice(0, 120),
        position: finite(details.position),
      });
      s.errors = s.errors.slice(-4);
    }
    return true;
  }
  victory() {
    if (this.run.won) return;
    this.run.won = true;
    for (const [id, p] of Object.entries(this.run.progress))
      if (p.correct) this.data.history[id].completed = true;
    this.data.archive = null;
  }
  serialize() {
    return JSON.stringify(this.data);
  }
  import(saved) {
    const s = typeof saved === "string" ? JSON.parse(saved) : saved;
    if (
      ![1, 2].includes(s?.version) ||
      !safeObject(s?.history) ||
      !safeObject(s?.settings)
    )
      throw new Error("不是有效的 EasyRun 词册");
    const incoming = cleanHistory(s.history);
    let added = 0;
    for (const [id, h] of Object.entries(incoming)) {
      const existing = this.data.history[id];
      if (!existing) {
        this.data.history[id] = h;
        added++;
        continue;
      }
      existing.seen = Math.max(existing.seen, h.seen);
      existing.wrong = Math.max(existing.wrong, h.wrong);
      existing.completed ||= h.completed;
      if (h.lastSeen > existing.lastSeen) existing.legacyWrong = h.legacyWrong;
      else if (!existing.lastSeen)
        existing.legacyWrong = Math.max(
          existing.legacyWrong || 0,
          h.legacyWrong || 0,
        );
      for (const k of ["spell", "meaning"]) {
        const a = existing[k],
          b = h[k];
        const latest = b.lastSeen > a.lastSeen ? b : a;
        existing[k] = { ...latest };
        for (const total of [
          "attempts",
          "correct",
          "wrong",
          "timeouts",
          "assisted",
        ])
          existing[k][total] = Math.max(a[total], b[total]);
        existing[k].successDays = [
          ...new Set([...a.successDays, ...b.successDays]),
        ]
          .sort()
          .slice(-8);
      }
      existing.lastSeen = Math.max(existing.lastSeen, h.lastSeen);
    }
    return added;
  }
}
