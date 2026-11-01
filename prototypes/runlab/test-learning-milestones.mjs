import test from "node:test";
import assert from "node:assert/strict";
import { InscriptionBook, BANK } from "./public/inscription-core.js";
import {
  LEARNING_MILESTONES as catalog,
  freshLearningMilestones,
  cleanLearningMilestones,
  learningMetrics,
  unlockLearningMilestones,
  practiceDay,
} from "./public/learning-milestones.js";
const NOW = Date.UTC(2026, 10, 1, 10);
function answer(book, id, type, outcome, assisted = false) {
  const action = "test-" + book.run.resolved.length;
  book.run.reserved = {
    wordId: id,
    type,
    serial: book.run.resolved.length + 1,
    actionId: action,
  };
  return book.settle(action, outcome, 2, assisted);
}
test("24 English-only milestones have measurable criteria and unlock once", () => {
  assert.equal(catalog.length, 24);
  assert.equal(new Set(catalog.map((a) => a.id)).size, 24);
  const study = freshLearningMilestones(),
    metrics = [1000, 200, 200, 100, 20, 25, 25, 7, 10];
  assert.equal(unlockLearningMilestones(study, metrics, NOW).length, 24);
  assert.equal(unlockLearningMilestones(study, metrics, NOW + 1000).length, 0);
  assert.deepEqual(cleanLearningMilestones(study), study);
});
test("real answers distinguish help, recall, delayed review and recovery; preview and timeouts grant no day", () => {
  let now = NOW;
  const book = new InscriptionBook(null, 42, () => now),
    id = book.run.pool.find((id) => BANK.get(id).spellable);
  const study = book.data.study;
  assert.deepEqual(learningMetrics(book.data.history, study), Array(9).fill(0));
  answer(book, id, "spell", "timeout");
  assert.equal(study.days.length, 0);
  answer(book, id, "spell", "wrong");
  answer(book, id, "spell", "correct", true);
  assert.equal(book.data.history[id].learning.recovered, true);
  assert.equal(book.data.history[id].learning.recall, 0);
  now += 2 * 86400000;
  answer(book, id, "spell", "correct", false);
  answer(book, id, "meaning", "correct");
  const m = learningMetrics(book.data.history, study);
  assert.equal(m[0], 1);
  assert.equal(m[3], 1);
  assert.equal(m[4], 1);
  assert.equal(m[5], 1);
  assert.equal(m[6], 1);
  assert.equal(m[7], 2);
  assert.equal(m[8], 3);
  unlockLearningMilestones(study, m, now);
  const restored = new InscriptionBook(book.serialize(), 43, () => now);
  assert.deepEqual(restored.data.study, study);
  assert.deepEqual(
    restored.data.history[id].learning,
    book.data.history[id].learning,
  );
});
test("repeating a word does not inflate unique words, both-mode or recovery counts", () => {
  const book = new InscriptionBook(null, 42, () => NOW),
    id = book.run.pool[0];
  answer(book, id, "meaning", "wrong");
  for (let i = 0; i < 20; i++) answer(book, id, "meaning", "correct");
  const m = learningMetrics(book.data.history, book.data.study);
  assert.equal(m[0], 1);
  assert.equal(m[2], 20);
  assert.equal(m[3], 0);
  assert.equal(m[4], 1);
  book.restart();
  assert.equal(book.run.learningStreak, 0);
  assert.equal(book.data.study.peak, 20);
});
test("practice dates use actual calendar days and corrupt milestone metadata is bounded", () => {
  assert.equal(practiceDay(NOW), practiceDay(NOW + 1000));
  assert.equal(practiceDay(NOW + 86400000), practiceDay(NOW) + 1);
  const s = cleanLearningMilestones({
    schema: 1,
    days: [1, 1, -1, 2, "3"],
    unlocked: Array(24).fill(-1),
    peak: -1,
  });
  assert.deepEqual(s.days, [1, 2]);
  assert.equal(s.peak, 0);
  assert.equal(s.unlocked.filter(Boolean).length, 0);
});
