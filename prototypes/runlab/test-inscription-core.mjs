import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  InscriptionBook,
  BANK,
  poolFor,
  allowance,
  matches,
} from "./public/inscription-core.js";
const entries = [...BANK.values()];
test("curated CET-4 membership, unique senses, explicit spelling and three distinct options", async () => {
  const evidence = JSON.parse(
    await readFile(
      new URL(
        "../../docs/evidence/inscription-v1/word-membership.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    new Set(evidence.entries.map((w) => w.word)).size,
    entries.length,
  );
  for (const w of entries) {
    assert.match(evidence.entries.find((r) => r.word === w.id).tag, /\bcet4\b/);
    assert.match(w.word, /^[a-z]+$/);
    assert.ok(w.accepted.includes(w.word));
    assert.equal(new Set([w.meaning, ...w.distractors]).size, 3);
    assert.ok(w.pos && w.context.includes(w.word));
  }
});
test("1,000 seeds per difficulty: 30 unique eligible words, six short entries, deterministic", () => {
  for (const tier of ["foundation", "standard", "challenge"])
    for (let seed = 0; seed < 1000; seed++) {
      const p = poolFor(seed, tier);
      assert.equal(p.length, 30);
      assert.equal(new Set(p).size, 30);
      assert.deepEqual(p, poolFor(seed, tier));
      assert.ok(p.filter((id) => BANK.get(id).word.length <= 6).length >= 6);
      assert.ok(
        p.every((id) =>
          tier === "foundation"
            ? BANK.get(id).tier <= 2
            : tier === "challenge"
              ? BANK.get(id).tier >= 2
              : true,
        ),
      );
    }
});
test("history quotas and preview never award completion", () => {
  const history = Object.fromEntries(
    entries
      .slice(0, 12)
      .map((w, i) => [
        w.id,
        { seen: 1, wrong: i < 8 ? 1 : 0, completed: i >= 8 },
      ]),
  );
  const p = poolFor(42, "standard", history);
  assert.equal(p.filter((id) => history[id]?.wrong).length, 8);
  assert.equal(p.filter((id) => history[id]?.completed).length, 4);
  const b = new InscriptionBook(null, 42);
  assert.equal(b.count, 0);
  assert.equal(b.run.started, false);
});
test("idempotent releases, spelling case and victory confirmation", () => {
  const b = new InscriptionBook(null, 1);
  b.begin(1);
  const q = b.question(1, "a");
  const w = BANK.get(q.wordId);
  assert.ok(matches(w, "  " + w.word.toUpperCase() + "  "));
  assert.ok(!matches(w, w.word + "x"));
  assert.equal(b.settle("stale", "correct", 1), false);
  assert.equal(b.count, 0);
  assert.equal(b.settle("a", "correct", 1, true), true);
  assert.equal(b.settle("a", "correct", 1), false);
  assert.equal(b.count, 1);
  assert.equal(b.data.history[w.id].completed, false);
  b.victory();
  b.victory();
  assert.equal(b.data.history[w.id].completed, true);
});
test("unseen priority, spaced retry, no blocking completion requirement", () => {
  const b = new InscriptionBook(null, 7);
  const first = b.question(1, "a");
  b.settle("a", "wrong", 1);
  for (let i = 2; i < 4; i++) {
    const q = b.question(1, String(i));
    assert.notEqual(q.wordId, first.wordId);
    b.settle(String(i), "correct", 1);
  }
  b.run.activeSeconds = 31;
  assert.equal(b.question(1, "4").wordId, first.wordId);
  b.settle("4", "correct", 1);
  b.victory();
  assert.equal(b.run.won, true);
  assert.equal(b.count, 3);
});
test("all 30 entries appear, then review never inflates progress", () => {
  const b = new InscriptionBook(null, 8),
    seen = new Set();
  for (let i = 0; i < 60; i++) {
    const q = b.question(4, String(i));
    seen.add(q.wordId);
    assert.equal(q.type, "meaning");
    b.settle(String(i), "correct", 1);
  }
  assert.equal(seen.size, 30);
  assert.equal(b.count, 30);
  assert.equal(b.run.serial, 60);
});
test("reload keeps pool, pending options, progress and history; restart preserves the group only", () => {
  const b = new InscriptionBook(null, 3);
  b.begin(2);
  b.question(3, "a");
  b.settle("a", "correct", 1);
  const q = b.question(5, "b");
  const restored = new InscriptionBook(b.serialize());
  assert.deepEqual(restored.run, b.run);
  assert.deepEqual(restored.question(5, "b"), q);
  restored.settle("b", "cancel", 0);
  assert.equal(restored.count, 1);
  const pool = [...restored.run.pool];
  restored.restart();
  assert.deepEqual(restored.run.pool, pool);
  assert.equal(restored.count, 0);
  assert.ok(Object.keys(restored.data.history).length);
});
test("invalid save recovers and timing settings are independent", () => {
  for (const s of ["bad", "{}", JSON.stringify({ version: 99 })]) {
    const b = new InscriptionBook(s, 2);
    assert.equal(b.run.pool.length, 30);
    assert.ok(b.notice);
  }
  const w = entries[0];
  assert.ok(
    allowance(w, "spell", "relaxed") > allowance(w, "spell", "standard"),
  );
  assert.ok(allowance(w, "control", "brisk") >= 3.5);
});
test("a fast all-wrong pass rotates old words instead of repeating the same failure", () => {
  const b = new InscriptionBook(null, 9),
    last = new Map();
  for (let i = 1; i <= 65; i++) {
    const q = b.question(3, String(i));
    if (last.has(q.wordId)) assert.ok(i - last.get(q.wordId) >= 3);
    last.set(q.wordId, i);
    b.settle(String(i), "wrong", 0.1);
  }
  assert.equal(b.count, 0);
  assert.equal(last.size, 30);
});
