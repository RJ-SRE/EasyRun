import test from "node:test";
import { URL } from "node:url";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  InscriptionBook,
  BANK,
  DEFAULTS,
  CONTENT_VERSION,
  COVERAGE,
  poolFor,
  selectPool,
  eligibleWords,
  allowance,
  matches,
  wordStatus,
  weakness,
} from "./public/inscription-core.js";
const entries = [...BANK.values()],
  DAY = 86400000,
  NOW = Date.UTC(2026, 9, 26);
const skill = (patch = {}) => ({
  attempts: 3,
  correct: 0,
  wrong: 3,
  timeouts: 0,
  assisted: 0,
  streak: 0,
  successDays: [],
  lastSeen: NOW,
  lastSuccess: 0,
  due: NOW + DAY,
  recentFailures: 3,
  errors: [],
  ...patch,
});
const historyItem = (patch = {}) => ({
  seen: 3,
  wrong: 3,
  completed: false,
  legacyWrong: 0,
  lastSeen: NOW,
  spell: skill(),
  meaning: skill({ recentFailures: 0, wrong: 0 }),
  ...patch,
});
function target(book, id, type, outcome, assisted = false) {
  const action = `case-${book.run.resolved.length}`;
  book.run.reserved = {
    wordId: id,
    type,
    serial: book.run.serial + 1,
    actionId: action,
    options: [BANK.get(id).meaning, ...BANK.get(id).distractors],
  };
  return book.settle(action, outcome, 2, assisted, { input: "mistkae" });
}
test("full source coverage, curated IDs, normalized variants and distinct options", async () => {
  const source = JSON.parse(
    await readFile(new URL("./data/cet-source.json", import.meta.url), "utf8"),
  );
  const old = JSON.parse(
    await readFile(
      new URL(
        "../../docs/evidence/inscription-v1/word-membership.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(BANK.size, 8815);
  assert.equal(source.entries.length, BANK.size);
  assert.equal(COVERAGE.officialMappedRows, COVERAGE.officialHeadRows);
  for (const w of old.entries) assert.ok(BANK.has(w.word));
  for (const w of entries) {
    assert.ok(w.accepted.includes(w.word), w.word);
    assert.equal(new Set([w.meaning, ...w.distractors]).size, 3, w.word);
    assert.ok(w.pos && w.context.includes(w.word));
    assert.ok(
      w.levels.length && w.levels.every((v) => ["cet4", "cet6"].includes(v)),
    );
    assert.match(w.meaning, /[\u4e00-\u9fff]/);
    assert.equal(w.spellable, /^[a-z]+$/.test(w.word));
  }
  assert.ok(matches(BANK.get("colour"), " COLOR "));
  assert.equal(BANK.get("a").meaning, "一个；某个");
  assert.equal(BANK.get("can").pos, "aux.");
  const mapping = JSON.parse(
    await readFile(
      new URL(
        "../../docs/evidence/2026-10-26-wordbook/head-mapping.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(mapping.length, COVERAGE.officialHeadRows);
  for (const row of mapping)
    assert.ok(
      row.words.length && row.words.every((id) => BANK.has(id)),
      row.head,
    );
});
test("all scope/difficulty combinations yield deterministic 30 unique eligible words", () => {
  for (const scope of ["cet4", "cet6", "mixed"])
    for (const tier of ["foundation", "standard", "challenge"]) {
      const allowed = new Set(
        eligibleWords({ ...DEFAULTS, scope, tier }).map((w) => w.id),
      );
      for (let seed = 0; seed < 50; seed++) {
        const p = poolFor(seed, tier, {}, { scope, now: NOW });
        assert.equal(new Set(p).size, 30);
        assert.ok(p.every((id) => allowed.has(id)));
        assert.deepEqual(p, poolFor(seed, tier, {}, { scope, now: NOW }));
      }
    }
});
test("balanced category quotas, all-new fallback, weak cap and weighted selection", () => {
  const history = Object.create(null);
  entries.slice(0, 60).forEach((w) => (history[w.id] = historyItem()));
  entries.slice(60, 120).forEach(
    (w) =>
      (history[w.id] = historyItem({
        spell: skill({ recentFailures: 0, due: NOW - DAY }),
        meaning: skill({ recentFailures: 0 }),
      })),
  );
  entries.slice(120, 180).forEach(
    (w) =>
      (history[w.id] = historyItem({
        spell: skill({ recentFailures: 0 }),
        meaning: skill({ recentFailures: 0 }),
      })),
  );
  assert.deepEqual(selectPool(42, DEFAULTS, history, NOW).composition, {
    new: 12,
    due: 10,
    weak: 6,
    familiar: 2,
  });
  assert.equal(selectPool(42, DEFAULTS, {}, NOW).composition.new, 30);
  assert.deepEqual(
    selectPool(42, { ...DEFAULTS, strategy: "review" }, history, NOW)
      .composition,
    { new: 6, due: 12, weak: 10, familiar: 2 },
  );
  const weak = entries.slice(0, 60).map((w) => w.id);
  let high = 0,
    low = 0;
  weak.forEach((id, i) => (history[id].spell.recentFailures = i < 30 ? 6 : 1));
  for (let seed = 0; seed < 200; seed++) {
    const p = selectPool(seed, DEFAULTS, history, NOW);
    assert.equal(p.composition.weak, 6);
    high += p.pool.filter((id) => weak.slice(0, 30).includes(id)).length;
    low += p.pool.filter((id) => weak.slice(30).includes(id)).length;
  }
  assert.ok(high > low * 1.6, `${high} vs ${low}`);
});
test("preview, retry, new expedition and archived continuation have distinct lifecycles", () => {
  const b = new InscriptionBook(null, 8, () => NOW),
    preview = [...b.run.pool];
  assert.equal(b.count, 0);
  b.begin(1);
  const q = b.question(3, "a");
  b.settle("a", "correct", 2);
  b.run.snapshot = { checkpoint: 1 };
  b.restart();
  assert.deepEqual(b.run.pool, preview);
  assert.equal(b.count, 0);
  assert.ok(b.data.history[q.wordId].seen);
  b.begin(2);
  b.run.snapshot = { checkpoint: 1 };
  b.prepare(88);
  assert.notDeepEqual(b.run.pool, preview);
  assert.ok(b.resumable);
  assert.equal(b.run.started, false);
  const restored = new InscriptionBook(b.serialize(), 99, () => NOW);
  assert.equal(restored.resume(), true);
  assert.deepEqual(restored.run.pool, preview);
  restored.victory();
  restored.prepare(89);
  assert.equal(restored.resumable, null);
  assert.notDeepEqual(restored.run.pool, preview);
});
test("per-skill history separates wrong, timeout, cancellation, assisted and independent answers", () => {
  const b = new InscriptionBook(null, 1, () => NOW),
    id = b.run.pool[0];
  target(b, id, "spell", "wrong");
  target(b, id, "meaning", "timeout");
  const before = JSON.stringify(b.data.history);
  target(b, id, "spell", "cancel");
  assert.equal(JSON.stringify(b.data.history), before);
  target(b, id, "spell", "correct", true);
  let h = b.data.history[id];
  assert.equal(h.spell.wrong, 1);
  assert.equal(h.spell.assisted, 1);
  assert.equal(h.spell.successDays.length, 0);
  assert.equal(h.meaning.timeouts, 1);
  assert.equal(h.meaning.wrong, 0);
  assert.equal(h.spell.errors[0].input, "mistkae");
  target(b, id, "spell", "correct");
  assert.equal(h.spell.successDays.length, 1);
  b.victory();
  assert.equal(h.completed, true);
  assert.equal(h.wrong, 2);
});
test("mastery requires independent spelling and meaning across three days; due and weakness decay", () => {
  let now = NOW;
  const b = new InscriptionBook(null, 1, () => now),
    id = b.run.pool[0];
  for (let i = 0; i < 3; i++) {
    target(b, id, "spell", "correct");
    target(b, id, "meaning", "correct");
  }
  assert.notEqual(wordStatus(b.data.history[id], now), "stable");
  for (let i = 1; i <= 2; i++) {
    now += DAY;
    target(b, id, "spell", "correct");
    target(b, id, "meaning", "correct");
  }
  assert.equal(wordStatus(b.data.history[id], now), "stable");
  const meaningOnly = {
    ...b.data.history[id],
    spell: skill({ correct: 0, streak: 0, recentFailures: 0, due: 0 }),
  };
  assert.equal(wordStatus(meaningOnly, now, false), "stable");
  assert.equal(wordStatus(b.data.history[id], now + 31 * DAY), "due");
  const h = historyItem();
  assert.ok(weakness(h, NOW + 60 * DAY) < weakness(h, NOW));
});
test("old content versions preserve history/pending run; invalid run rebuilds only journey", () => {
  const b = new InscriptionBook(null, 1, () => NOW);
  b.begin(1);
  const q = b.question(3, "a");
  const old = JSON.parse(b.serialize());
  old.version = 1;
  old.contentVersion = "cet4-old";
  old.history = { create: { seen: 8, wrong: 4, completed: true } };
  const migrated = new InscriptionBook(old, 33, () => NOW);
  assert.equal(migrated.data.contentVersion, CONTENT_VERSION);
  assert.equal(migrated.data.history.create.legacyWrong, 4);
  assert.deepEqual(migrated.question(3, "a"), q);
  assert.equal(migrated.run.seed, 1);
  old.run.pool[0] = "missing-word";
  const recovered = new InscriptionBook(old, 33, () => NOW);
  assert.equal(recovered.data.history.create.wrong, 4);
  assert.equal(recovered.run.seed, 33);
  for (const raw of [
    "bad",
    "{}",
    '{"version":99}',
    JSON.stringify({ ...old, history: { a: { spell: null } } }),
  ])
    assert.equal(new InscriptionBook(raw, 2, () => NOW).run.pool.length, 30);
});
test("history import is non-destructive and idempotent, rejects malformed history before merge", () => {
  const b = new InscriptionBook(null, 1, () => NOW),
    incoming = new InscriptionBook(null, 2, () => NOW);
  const id = incoming.run.pool[0];
  target(incoming, id, "spell", "wrong");
  const pool = [...b.run.pool];
  assert.equal(b.import(incoming.serialize()), 1);
  const once = b.serialize();
  b.import(incoming.serialize());
  assert.equal(b.serialize(), once);
  assert.deepEqual(b.run.pool, pool);
  assert.throws(() =>
    b.import({
      version: 2,
      settings: {},
      history: { legit: { seen: 3 }, bad: null },
    }),
  );
  assert.equal(b.serialize(), once);
  const malicious = JSON.parse(
    '{"version":2,"settings":{},"history":{"__proto__":{"seen":1}}}',
  );
  b.import(malicious);
  assert.equal({}.seen, undefined);
});
test("all 30 words appear, spaced retries avoid hammering, further casts remain available", () => {
  const b = new InscriptionBook(null, 7, () => NOW);
  const first = b.question(1, "1");
  b.settle("1", "wrong", 1);
  for (let i = 2; i < 4; i++) {
    const q = b.question(1, String(i));
    assert.notEqual(q.wordId, first.wordId);
    b.settle(String(i), "correct", 1);
  }
  b.run.activeSeconds = 31;
  assert.equal(b.question(1, "4").wordId, first.wordId);
  b.settle("4", "correct", 1);
  const c = new InscriptionBook(null, 8, () => NOW),
    seen = new Set();
  for (let i = 0; i < 60; i++) {
    const q = c.question(4, String(i));
    seen.add(q.wordId);
    assert.equal(q.type, "meaning");
    c.settle(String(i), "correct", 1);
  }
  assert.equal(seen.size, 30);
  assert.equal(c.count, 30);
  const d = new InscriptionBook(null, 9, () => NOW),
    last = new Map();
  let supported = 0;
  for (let i = 1; i <= 95; i++) {
    const q = d.question(3, String(i));
    if (last.has(q.wordId)) assert.ok(i - last.get(q.wordId) >= 3);
    last.set(q.wordId, i);
    supported += Number(q.supported);
    d.settle(String(i), "wrong", 0.1);
  }
  assert.equal(last.size, 30);
  assert.ok(supported > 0);
  assert.equal(d.count, 0);
});
test("settlement is idempotent; allowances scale and punctuation is meaning only", () => {
  const b = new InscriptionBook(null, 1, () => NOW);
  b.question(3, "a");
  assert.equal(b.settle("stale", "correct", 1), false);
  assert.equal(b.settle("a", "correct", 1), true);
  assert.equal(b.settle("a", "correct", 1), false);
  assert.ok(
    allowance(
      { word: "acknowledgement", meaning: "承认" },
      "spell",
      "standard",
    ) > allowance({ word: "act", meaning: "行动" }, "spell", "standard"),
  );
  assert.ok(allowance(entries[0], "control", "brisk") >= 3.5);
  const id = entries.find((w) => !w.spellable).id;
  b.run.reserved = { wordId: id };
  assert.equal(b.question(1, "b").type, "meaning");
});
