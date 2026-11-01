import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyAnswer,
  chooseAbility,
  prepareDeck,
  category,
} from "../rules.mjs";
import { playerId } from "../auth.mjs";
import { FileStore, DurableRepository } from "../storage.mjs";
import { LearningService } from "../service.mjs";
import { LearningClient } from "../client.mjs";
import { learningServer } from "../http.mjs";
import { sha256, validateLexicon } from "../lexicon.mjs";

const time = Date.parse("2026-10-31T00:00:00Z");
const answer = (wordId = "en:w0", overrides = {}) => ({
  type: "answer",
  wordId,
  questionType: "spell",
  result: "wrong",
  hintMode: "fade",
  answerShown: true,
  extraHintUsed: false,
  responseMs: 500,
  contentVersion: "fixture-1",
  ...overrides,
});
const words = Array.from({ length: 120 }, (_, i) => ({
  wordId: `en:w${i}`,
  word: `word${i}`,
  meaning: `释义${i}`,
  pos: "n.",
  distractors: ["甲", "乙"],
  spellable: true,
  enabled: true,
  difficulty: ["normal", "hard", "challenge"][i % 3],
}));
const lexicon = {
  schemaVersion: 1,
  lexiconId: "test",
  contentVersion: "fixture-1",
  words,
  byId: new Map(words.map((w) => [w.wordId, w])),
};
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "rupture-learning-"));
  const store = new FileStore(join(dir, "profiles"));
  const repo = new DurableRepository(store, join(dir, "journal"));
  await repo.init();
  let now = time;
  const service = new LearningService({
    repository: repo,
    lexicon,
    verifyIdentity: async (token) => {
      assert.ok(["alice", "bob"].includes(token));
      return { issuer: "test-fixture-only", subject: token };
    },
    mappingKey: "m".repeat(40),
    sessionKey: "s".repeat(40),
    now: () => now,
    random: () => 0.25,
  });
  t.after(async () => {
    await repo.close();
    await rm(dir, { recursive: true, force: true });
  });
  const session = (await service.login("alice")).session;
  const p = await service.prepare(session, {
    contentVersion: "fixture-1",
    wordMode: "random",
  });
  const runId = `${p.writerSessionId}:1`;
  const start = {
    type: "run-start",
    runSeq: 1,
    runId,
    preparation: p.preparation,
  };
  const batch = (
    events,
    { seq = 1, revision = p.revision, eventSeq = 1 } = {},
  ) => ({
    writerSessionId: p.writerSessionId,
    writerEpoch: p.writerEpoch,
    baseRevision: revision,
    batchSeq: seq,
    batchId: `${p.writerSessionId}:${seq}`,
    events: events.map((e, i) => ({
      ...e,
      runId: e.runId ?? runId,
      eventSeq: eventSeq + i,
    })),
  });
  const wordId = p.words[0].wordId;
  return {
    dir,
    store,
    repo,
    service,
    session,
    p,
    runId,
    start,
    batch,
    wordId,
    advance: (ms) => {
      now += ms;
    },
  };
}
test("spelling and meaning stay independent; assisted success and timeout use exact schedules", () => {
  let w = applyAnswer(null, answer(), time);
  assert.equal(w.spell.weaknessMilli, 1000);
  assert.equal(w.meaning, null);
  w = applyAnswer(
    w,
    answer("en:w0", {
      questionType: "meaning",
      result: "correct",
      answerShown: false,
      hintMode: "none",
    }),
    time,
  );
  assert.equal(w.spell.weaknessMilli, 1000);
  assert.equal(w.meaning.nextReviewAt, "2026-11-01T00:00:00.000Z");
  w = applyAnswer(w, answer("en:w0", { result: "correct" }), time);
  assert.equal(w.spell.weaknessMilli, 800);
  assert.equal(w.spell.assistedCorrect, 1);
  assert.equal(w.spell.nextReviewAt, "2026-10-31T12:00:00.000Z");
  w = applyAnswer(w, answer("en:w0", { result: "timeout" }), time);
  assert.equal(w.spell.weaknessMilli, 1200);
  assert.equal(w.spell.attempts, 3);
  assert.equal(w.spell.timeouts, 1);
  assert.equal(
    chooseAbility({ meaning: w.meaning, spell: null }, true),
    "spell",
  );
  assert.equal(chooseAbility(w, true, Math.random, true), "meaning");
  assert.equal(
    chooseAbility(
      { ...w, spell: { weaknessMilli: 0 }, lastQuestionType: "meaning" },
      true,
    ),
    "spell",
  );
});
test("30 unique words, mutually exclusive quotas, weak cap, same-mode fallback, insufficient pool", () => {
  const history = {};
  for (let i = 12; i < 120; i++) {
    history[`en:w${i}`] = applyAnswer(
      null,
      answer(`en:w${i}`, {
        questionType: "meaning",
        result: i < 22 ? "correct" : i < 40 ? "wrong" : "correct",
        answerShown: false,
      }),
      time - (i < 22 ? 2 * 86400000 : 0),
    );
  }
  const deck = prepareDeck(lexicon, history, "random", time, () => 0.4);
  const counts = Object.fromEntries(
    ["new", "due", "weak", "familiar"].map((g) => [
      g,
      deck.filter((w) => w.reason === g).length,
    ]),
  );
  assert.deepEqual(counts, { new: 12, due: 10, weak: 6, familiar: 2 });
  assert.equal(new Set(deck.map((w) => w.wordId)).size, 30);
  for (const mode of ["normal", "hard", "challenge"])
    assert.ok(
      prepareDeck(lexicon, history, mode, time).every(
        (w) => lexicon.byId.get(w.wordId).difficulty === mode,
      ),
    );
  assert.throws(
    () =>
      prepareDeck(
        { ...lexicon, words: words.slice(0, 20) },
        history,
        "random",
        time,
      ),
    /INSUFFICIENT/,
  );
  assert.equal(category(history["en:w22"], time + 30 * 86400000), "weak");
});
test("wrong outcomes are capped and chronological order matters", () => {
  let w = null;
  for (let i = 0; i < 20; i++) w = applyAnswer(w, answer(), time);
  assert.equal(w.spell.weaknessMilli, 6000);
  const a = applyAnswer(
    applyAnswer(null, answer(), time),
    answer("en:w0", { result: "correct" }),
    time,
  );
  const b = applyAnswer(
    applyAnswer(null, answer("en:w0", { result: "correct" }), time),
    answer(),
    time,
  );
  assert.equal(a.spell.weaknessMilli, 800);
  assert.equal(b.spell.weaknessMilli, 1000);
});
test("checkpoint save, failure retry, victory and duplicate submission do not double count", async (t) => {
  const f = await fixture(t);
  const b = f.batch([
    f.start,
    answer(f.wordId, { questionSeq: 1 }),
    { type: "checkpoint", checkpoint: 1 },
    { type: "failure", attemptSeq: 1 },
  ]);
  const receipt = await f.service.submit(f.session, b);
  assert.deepEqual(await f.service.submit(f.session, b), receipt);
  let profile = await f.repo.load(f.service.identity(f.session));
  assert.equal(profile.words[f.wordId].spell.attempts, 1);
  assert.equal(profile.activeRun.failures, 1);
  const win = f.batch(
    [answer(f.wordId, { questionSeq: 2, result: "correct" }), { type: "won" }],
    { seq: 2, revision: receipt.revision, eventSeq: 5 },
  );
  await f.service.submit(f.session, win);
  await f.service.submit(f.session, win);
  profile = await f.repo.load(f.service.identity(f.session));
  assert.equal(profile.totals.completedRuns, 1);
  assert.equal(profile.words[f.wordId].everCompletedInWonRun, true);
  assert.equal(profile.activeRun, null);
  assert.equal((await f.service.submit(f.session, b)).alreadyProcessed, true);
  assert.ok(Buffer.byteLength(JSON.stringify(receipt)) < 2048);
});
test("reject changed duplicate, missing sequence, stale revision, unknown words and duplicate question", async (t) => {
  const f = await fixture(t);
  const b = f.batch([f.start, answer(f.wordId, { questionSeq: 1 })]);
  const ack = await f.service.submit(f.session, b);
  await assert.rejects(
    f.service.submit(f.session, {
      ...b,
      events: [...b.events, { eventSeq: 3 }],
    }),
    /BATCH_PAYLOAD_CHANGED/,
  );
  await assert.rejects(
    f.service.submit(
      f.session,
      f.batch([{ type: "failure", attemptSeq: 1 }], {
        seq: 3,
        revision: ack.revision,
        eventSeq: 3,
      }),
    ),
    /BATCH_SEQUENCE_GAP/,
  );
  await assert.rejects(
    f.service.submit(
      f.session,
      f.batch([{ type: "failure", attemptSeq: 1 }], { seq: 2, eventSeq: 3 }),
    ),
    /REVISION_CONFLICT/,
  );
  await assert.rejects(
    f.service.submit(
      f.session,
      f.batch([answer(f.wordId, { questionSeq: 1 })], {
        seq: 2,
        revision: ack.revision,
        eventSeq: 3,
      }),
    ),
    /QUESTION_ALREADY_FINAL/,
  );
  await assert.rejects(
    f.service.submit(
      f.session,
      f.batch([answer("en:not-in-deck", { questionSeq: 2 })], {
        seq: 2,
        revision: ack.revision,
        eventSeq: 3,
      }),
    ),
    /WORD_NOT_IN_RUN/,
  );
  assert.equal(
    (await f.repo.load(f.service.identity(f.session))).sync.lastEventSeq,
    2,
  );
});
test("two users isolated, explicit takeover invalidates previous writer, survives cache loss", async (t) => {
  const f = await fixture(t);
  const bob = (await f.service.login("bob")).session;
  await assert.rejects(
    f.service.submit(bob, f.batch([f.start])),
    /PROFILE_NOT_PREPARED/,
  );
  await assert.rejects(
    f.service.prepare(f.session, {
      contentVersion: "fixture-1",
      wordMode: "normal",
    }),
    /TAKEOVER_REQUIRED/,
  );
  const p2 = await f.service.prepare(f.session, {
    contentVersion: "fixture-1",
    wordMode: "normal",
    takeover: true,
    baseRevision: f.p.revision,
  });
  assert.equal(p2.writerEpoch, f.p.writerEpoch + 1);
  f.repo.cache.clear();
  f.repo.cacheBytes = 0;
  await assert.rejects(
    f.service.submit(f.session, f.batch([f.start])),
    /WRITER_REPLACED/,
  );
  assert.notEqual(
    playerId("a", "bob", "m".repeat(32)),
    playerId("b", "bob", "m".repeat(32)),
  );
});
test("lost write response reconciles exact candidate; unknown write blocks takeover after restart", async (t) => {
  const f = await fixture(t);
  const original = f.store.write.bind(f.store);
  f.store.write = async (...args) => {
    await original(...args);
    throw new Error("response lost");
  };
  const b = f.batch([f.start, answer(f.wordId, { questionSeq: 1 })]);
  await assert.rejects(f.service.submit(f.session, b));
  f.store.write = original;
  f.repo.cache.clear();
  f.repo.cacheBytes = 0;
  const ack = await f.service.submit(f.session, b);
  assert.equal(ack.lastEventSeq, 2);
  assert.equal(
    (await f.repo.load(f.service.identity(f.session))).words[f.wordId].spell
      .attempts,
    1,
  );
  f.store.write = async () => {
    throw new Error("request outcome unknown");
  };
  await assert.rejects(
    f.service.submit(
      f.session,
      f.batch([{ type: "failure", attemptSeq: 1 }], {
        seq: 2,
        revision: ack.revision,
        eventSeq: 3,
      }),
    ),
  );
  await f.repo.close();
  await f.repo.init();
  f.repo.cache.clear();
  f.repo.cacheBytes = 0;
  await assert.rejects(
    f.service.prepare(f.session, {
      contentVersion: "fixture-1",
      wordMode: "normal",
      takeover: true,
      baseRevision: ack.revision,
    }),
    /WRITE_OUTCOME_UNKNOWN/,
  );
});
test("read errors/corrupt profiles do not initialize or erase user history", async (t) => {
  const f = await fixture(t),
    id = f.service.identity(f.session);
  await writeFile(f.store.path(id), "{broken");
  f.repo.cache.clear();
  f.repo.cacheBytes = 0;
  await assert.rejects(f.service.view(f.session), /PROFILE_CORRUPT/);
  assert.equal(await readFile(f.store.path(id), "utf8"), "{broken");
});
test("prepared views stay small with old 8815-word history, removed words remain in totals", async (t) => {
  const f = await fixture(t),
    id = f.service.identity(f.session),
    p = structuredClone(await f.repo.load(id));
  for (let i = 0; i < 8815; i++)
    p.words[`en:old${i}`] = applyAnswer(
      null,
      answer("en:old" + i, { result: "correct" }),
      time,
    );
  await f.repo.commit(id, p);
  const next = await f.service.prepare(f.session, {
    contentVersion: "fixture-1",
    wordMode: "random",
    writerSessionId: f.p.writerSessionId,
    writerEpoch: f.p.writerEpoch,
    baseRevision: p.revision,
    lastEventSeq: 0,
  });
  assert.equal(next.summary.correct, 8815);
  assert.equal(next.summary.currentCorrect, 0);
  assert.ok(Buffer.byteLength(JSON.stringify(next)) < 32768);
  assert.equal(Object.keys((await f.repo.load(id)).words).length, 8815);
});
test("client does not upload per answer; frozen retry excludes later answers and clears only acked entries", async (t) => {
  const f = await fixture(t);
  let calls = 0,
    fail = true;
  const client = new LearningClient({
    now: () => time,
    transport: async (path, body, session) => {
      if (path === "/v1/prepare") return f.service.prepare(session, body);
      calls++;
      if (fail) {
        fail = false;
        throw new Error("offline");
      }
      return f.service.submit(session, body);
    },
  });
  client.useAccount("alice", f.session);
  client.state.prepared = f.p;
  client.state.confirmed = new Map(f.p.words.map((w) => [w.wordId, w.state]));
  client.record(f.start);
  client.record(answer(f.wordId, { runId: f.runId, questionSeq: 1 }));
  assert.equal(calls, 0);
  await client.save("failure");
  const frozen = JSON.stringify(client.state.frozen);
  client.record(
    answer(f.wordId, { runId: f.runId, questionSeq: 2, result: "correct" }),
  );
  assert.equal(JSON.stringify(client.state.frozen), frozen);
  assert.equal(await client.save("manual"), true);
  assert.equal(client.pendingCount, 0);
  assert.equal(client.status, "saved");
  const p = await f.repo.load(f.service.identity(f.session));
  assert.equal(p.words[f.wordId].spell.attempts, 2);
  assert.equal(p.words[f.wordId].spell.weaknessMilli, 800);
  assert.equal(client.state.view.get(f.wordId).spell.weaknessMilli, 800);
  client.guest();
  assert.equal(client.record(answer()), false);
  assert.equal(await client.save("manual"), false);
});
test("late callbacks cannot contaminate another account; original frozen batch can resume", async (t) => {
  const f = await fixture(t);
  let release;
  const client = new LearningClient({
    transport: async (path, body, session) => {
      await new Promise((r) => {
        release = r;
      });
      return f.service.submit(session, body);
    },
  });
  client.useAccount("alice", f.session);
  client.state.prepared = f.p;
  client.record(f.start);
  const work = client.save("manual");
  await new Promise((r) => setImmediate(r));
  client.useAccount("bob", (await f.service.login("bob")).session);
  release();
  await work;
  assert.equal(client.status, "loading");
  assert.equal(client.pendingCount, 0);
  client.useAccount("alice", f.session);
  assert.equal(client.pendingCount, 1);
  assert.ok(client.state.frozen);
  client.transport = (path, body, session) => f.service.submit(session, body);
  await client.save("manual");
  assert.equal(client.pendingCount, 0);
});
test("HTTP boundary: no dev login, no credential leakage, unknown origin rejected, health explicit", async (t) => {
  const f = await fixture(t);
  f.service.verifyIdentity = null;
  const server = learningServer(f.service, {
    allowedOrigins: ["https://x.qiniu.com"],
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal(
    (await (await fetch(url + "/health")).json()).releaseReady,
    false,
  );
  const r = await fetch(url + "/v1/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platformCredential: "PRIVATE_TEST_TOKEN" }),
  });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "XBUILDER_IDENTITY_NOT_CONFIGURED");
  assert.equal((await fetch(url + "/v1/view")).status, 401);
  assert.equal(
    (
      await fetch(url + "/health", {
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
});
test("content checks block a legacy test bank from release even with a valid hash", () => {
  const data = {
    schemaVersion: 1,
    wordIdScheme: "en-stable-id-v1",
    contentVersion: "x",
    words: [],
  };
  const bytes = JSON.stringify(data);
  const manifest = {
    contentVersion: "x",
    wordsSha256: sha256(bytes),
    wordCount: 0,
    difficultyCounts: { normal: 0, hard: 0, challenge: 0 },
    draft: true,
    usageStatus: "legacy-test-only",
  };
  assert.throws(
    () => validateLexicon(data, manifest, bytes),
    /LEXICON_NOT_RELEASED/,
  );
  assert.throws(
    () => validateLexicon(data, { ...manifest, wordsSha256: "bad" }, bytes),
    /LEXICON_INTEGRITY/,
  );
});
