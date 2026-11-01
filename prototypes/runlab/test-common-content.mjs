import { URL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadLexicon } from "../../services/learning/lexicon.mjs";
import {
  InscriptionBook,
  BANK,
  CONTENT_VERSION,
} from "./public/inscription-core.js";
import { WORDS as legacy } from "./public/cet4-words.js";
import { WORDS, LEGACY_SENSE_SAFE } from "./public/common-words.js";
const skill = {
  attempts: 4,
  correct: 3,
  wrong: 1,
  timeouts: 0,
  assisted: 0,
  streak: 2,
  successDays: ["2026-10-28", "2026-10-29", "2026-10-30"],
  lastSeen: 10000,
  lastSuccess: 10000,
  due: 20000,
  recentFailures: 1,
  errors: [],
};
test("release validates actual source hashes, source membership and frequency bands", async () => {
  const lex = await loadLexicon(
    new URL("../../services/learning/content-common/", import.meta.url),
    { release: true },
  );
  assert.equal(lex.words.length, 3816);
  assert.equal(WORDS.length, lex.words.length);
  for (const [file, sha] of Object.entries(lex.manifest.sourceHashes))
    assert.equal(
      createHash("sha256")
        .update(
          await readFile(
            new URL("./data/common-sources/" + file, import.meta.url),
          ),
        )
        .digest("hex"),
      sha,
    );
  for (const w of WORDS) {
    assert.ok(w.meaning.length <= 28);
    assert.equal(new Set([w.meaning, ...w.distractors]).size, 3);
    assert.ok(w.accepted.includes(w.word));
    assert.equal(w.tier, { normal: 1, hard: 2, challenge: 3 }[w.difficulty]);
  }
});
test("old spelling, changed meaning, retired records and milestones migrate independently", () => {
  const changed = "can",
    same = LEGACY_SENSE_SAFE[0],
    retired = legacy.find((w) => !BANK.has(w.id)).id;
  const saved = {
    version: 2,
    contentVersion: "cet46-2026-10-26.1",
    settings: { wordMode: "random", hint: "recall" },
    history: Object.fromEntries(
      [changed, same, retired].map((id) => [
        id,
        {
          seen: 8,
          wrong: 2,
          completed: true,
          spell: { ...skill },
          meaning: { ...skill },
        },
      ]),
    ),
    study: {
      schema: 1,
      unlocked: [123, ...Array(23).fill(0)],
      days: ["2026-10-30"],
      peak: 8,
    },
  };
  const b = new InscriptionBook(saved, 42);
  assert.deepEqual(b.data.history[changed].spell, skill);
  assert.equal(b.data.history[changed].meaning.correct, 0);
  assert.equal(b.data.history[changed].completed, false);
  assert.equal(b.data.history[changed].legacyMeaning[0].skill.correct, 3);
  assert.equal(b.data.history[same].meaning.correct, 3);
  assert.equal(b.data.history[same].completed, true);
  assert.equal(b.data.history[retired].meaning.correct, 3);
  assert.equal(b.data.study.unlocked[0], 123);
  assert.equal(b.settings.hint, "recall");
  assert.equal(b.data.contentVersion, CONTENT_VERSION);
  assert.deepEqual(
    new InscriptionBook(b.serialize()).data.history,
    b.data.history,
  );
});
test("importing an old export cannot reintroduce obsolete meaning mastery", () => {
  const b = new InscriptionBook(null, 1);
  const saved = {
    version: 2,
    contentVersion: "cet46-2026-10-26.1",
    settings: {},
    history: {
      can: { seen: 8, wrong: 2, completed: true, spell: skill, meaning: skill },
    },
  };
  b.import(saved);
  b.import(saved);
  assert.equal(b.data.history.can.spell.correct, 3);
  assert.equal(b.data.history.can.meaning.correct, 0);
  assert.equal(b.data.history.can.completed, false);
  assert.equal(b.data.history.can.legacyMeaning.length, 1);
});
