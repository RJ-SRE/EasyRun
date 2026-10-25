import test from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  AchievementBook,
} from "./public/belfry-achievements-core.js";

function adventure(book = new AchievementBook()) {
  let serial = 0,
    attempt = 1,
    wordSerial = 0;
  const deed = (name, data = {}) =>
    book.deed({
      serial: ++serial,
      name,
      attempt,
      phase: 1,
      practice: 0,
      health: 8,
      difficulty: 0,
      deaths: 0,
      echoes: 0,
      hook: -1,
      ...data,
    });
  const word = (wordId = "create", result = 1, data = {}) =>
    book.word({
      actionId: `run-${attempt}-${++wordSerial}`,
      attempt,
      wordId,
      result,
      ...data,
    });
  deed("start");
  return {
    book,
    deed,
    word,
    next(name = "start") {
      attempt++;
      deed(name);
    },
  };
}
test("15 distinct achievements, cosmetic titles only, reload does not re-award", () => {
  assert.equal(ACHIEVEMENTS.length, 15);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 15);
  const { book, deed } = adventure();
  assert.equal(book.equip("first-sling"), false);
  deed("sling");
  assert.equal(book.equip("first-sling"), true);
  const restored = new AchievementBook(book.serialize());
  assert.equal(restored.count, 1);
  assert.equal(restored.data.equipped, "first-sling");
  assert.deepEqual(restored.pending, []);
  assert.equal(restored.run, null);
  assert.equal(restored.equip(""), true);
});
test("practice, duplicated telemetry and previous attempt cannot earn awards", () => {
  const a = adventure();
  a.deed("practice", { practice: 1 });
  a.deed("sling", { practice: 1 });
  a.word();
  assert.equal(a.book.count, 0);
  a.next();
  a.deed("sling", { attempt: 1 });
  assert.equal(a.book.count, 0);
  a.deed("parry");
  a.deed("parry", { serial: a.book.lastSerial });
  assert.equal(a.book.data.progress.parry, 1);
  a.deed("sling");
  a.deed("sling");
  assert.equal(a.book.pending.filter((x) => x === "first-sling").length, 1);
});
test("air chain needs different targets within one uninterrupted flight", () => {
  const a = adventure();
  a.deed("hookattach", { hook: 2 });
  a.deed("hookattach", { hook: 2 });
  a.deed("touchdown");
  a.deed("hookattach", { hook: 3 });
  assert.equal(a.book.data.progress["air-chain"], 1);
  a.deed("hurt");
  a.deed("hookattach", { hook: 4 });
  assert.equal(a.book.data.unlocked["air-chain"], undefined);
  a.deed("hookattach", { hook: 5 });
  assert.ok(a.book.data.unlocked["air-chain"]);
});
test("combat awards require actual hits, projectile cuts and one-health healing", () => {
  const a = adventure();
  for (const name of ["heavy", "charged", "bowshot", "enemyParry", "healstart"])
    a.deed(name);
  a.deed("healcomplete", { health: 3 });
  assert.equal(a.book.count, 0);
  a.deed("markbreak");
  a.deed("collision");
  a.deed("healcomplete", { health: 2 });
  a.deed("parry");
  a.next();
  a.deed("parry");
  a.deed("parry");
  assert.deepEqual(
    Object.keys(a.book.data.unlocked).sort(),
    ["mark", "collision", "last-ember", "parry"].sort(),
  );
});
test("echoes measure one adventure, while parries accumulate across adventures", () => {
  const a = adventure();
  a.deed("echo", { echoes: 2 });
  a.next();
  a.deed("echo", { echoes: 1 });
  assert.equal(a.book.data.progress.echoes, 2);
  assert.equal(a.book.data.unlocked.echoes, undefined);
  a.deed("echo", { echoes: 3 });
  assert.ok(a.book.data.unlocked.echoes);
});
test("no-damage completion needs a fresh core journey; hurt, death, retry or restore exclude it", () => {
  for (const invalid of [
    "hurt",
    "fail",
    "retry",
    "restored",
    "no-core",
    "deaths",
  ]) {
    const a = adventure();
    if (invalid !== "no-core") a.deed("core");
    if (["retry", "restored"].includes(invalid)) {
      a.next(invalid);
      a.deed("core");
    } else if (["hurt", "fail"].includes(invalid)) a.deed(invalid);
    a.deed("finish", { phase: 2, deaths: invalid === "deaths" ? 1 : 0 });
    assert.ok(a.book.data.unlocked.home);
    assert.equal(a.book.data.unlocked.untouched, undefined, invalid);
    assert.equal(a.book.data.unlocked.fearless, undefined);
  }
  const a = adventure();
  a.deed("guardian");
  a.deed("core");
  a.deed("finish", { phase: 2, difficulty: 1 });
  for (const id of ["keeper", "home", "fearless", "untouched"])
    assert.ok(a.book.data.unlocked[id]);
});
test("word awards count verified, distinct words; stale and duplicate settlement ignored", () => {
  const a = adventure();
  a.word("create", 1, { actionId: "once" });
  a.word("world", 1, { actionId: "once" });
  a.word("world", 1, { attempt: 0 });
  a.word("create");
  a.word("world", 2);
  assert.deepEqual(a.book.data.words, ["create"]);
  assert.equal(a.book.data.progress["word-streak"], 2);
  assert.equal(a.book.run.streak, 0);
  a.word("world");
  a.word("earth", 3);
  assert.equal(a.book.run.streak, 0);
  a.next("retry");
  for (let i = 0; i < 5; i++) a.word("create");
  assert.ok(a.book.data.unlocked["word-streak"]);
  const words =
    "ability absence academy accept access accident account achieve acquire action active adapt address admire admit advance advice affect afford agency agree ahead alert alive allow almost alone alter amount ancient".split(
      " ",
    );
  words.forEach((word, i) => {
    if (i === 15) a.next();
    a.word(word);
  });
  assert.equal(a.book.data.words.length, 32);
  assert.ok(a.book.data.unlocked["ten-words"]);
  assert.ok(a.book.data.unlocked["thirty-words"]);
});
test("retired resonance saves preserve other achievements and words, without a dead title or goal", () => {
  const a = adventure();
  a.word();
  a.deed("sling");
  a.book.equip("first-sling");
  const legacy = JSON.parse(a.book.serialize());
  legacy.progress.resonance = 2;
  legacy.unlocked.resonance = Date.now();
  for (const equipped of ["first-sling", "resonance"]) {
    const restored = new AchievementBook(
      JSON.stringify({ ...legacy, equipped }),
    );
    assert.equal(restored.corrupt, false);
    assert.equal(restored.count, 2);
    assert.equal(restored.data.unlocked.resonance, undefined);
    assert.equal(restored.data.progress.resonance, undefined);
    assert.equal(
      restored.data.equipped,
      equipped === "resonance" ? "" : equipped,
    );
    assert.deepEqual(restored.data.words, ["create"]);
    assert.deepEqual(restored.data.unlocked, a.book.data.unlocked);
    assert.deepEqual(restored.pending, []);
    const resumed = adventure(restored);
    resumed.deed("wordflow");
    resumed.deed("wordflow");
    assert.equal(restored.count, 2);
  }
});
test("invalid saves recover without fabricated unlocks or equipped titles", () => {
  for (const raw of [
    "{",
    "null",
    '{"version":2}',
    '{"version":1,"progress":{},"unlocked":null,"words":[]}',
  ]) {
    const book = new AchievementBook(raw);
    assert.equal(book.corrupt, true);
    assert.equal(book.count, 0);
  }
  const book = new AchievementBook(
    JSON.stringify({
      version: 1,
      progress: { parry: 999 },
      unlocked: { unknown: 100, home: Date.now() + 1e10 },
      words: ["create", "create", "<script>", 4],
      equipped: "home",
    }),
  );
  assert.equal(book.count, 0);
  assert.equal(book.data.progress.parry, 2);
  assert.deepEqual(book.data.words, ["create"]);
  assert.equal(book.data.equipped, "");
});
