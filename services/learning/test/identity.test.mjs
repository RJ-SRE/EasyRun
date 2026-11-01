import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { xbuilderVerifier } from "../auth.mjs";
import { FileStore, DurableRepository } from "../storage.mjs";
import { LearningService } from "../service.mjs";
import { LearningClient } from "../client.mjs";

test("verified XBuilder id retains saved history across rename, new token and cold restart; reused name stays isolated", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "learning-rename-"));
  const repo = new DurableRepository(
    new FileStore(join(dir, "profiles")),
    join(dir, "journal"),
  );
  await repo.init();
  t.after(async () => {
    await repo.close();
    await rm(dir, { recursive: true, force: true });
  });
  let user = {
    id: "xbuilder-stable-001",
    username: "old_name",
    displayName: "Old Name",
  };
  const verifier = xbuilderVerifier({
    userInfoUrl: "https://identity.example/user",
    issuer: "xbuilder-test",
    fetcher: async () => Response.json(user),
  });
  const words = Array.from({ length: 90 }, (_, i) => ({
    wordId: `en:w${i}`,
    word: `word${i}`,
    meaning: `释义${i}`,
    distractors: ["甲", "乙"],
    spellable: true,
    enabled: true,
    difficulty: ["normal", "hard", "challenge"][i % 3],
  }));
  const service = new LearningService({
    repository: repo,
    lexicon: {
      contentVersion: "rename-fixture",
      lexiconId: "test",
      words,
      byId: new Map(words.map((w) => [w.wordId, w])),
    },
    verifyIdentity: verifier,
    mappingKey: "m".repeat(40),
    sessionKey: "s".repeat(40),
  });
  const before = await service.login("old-platform-credential");
  const p = await service.prepare(before.session, {
    contentVersion: "rename-fixture",
    wordMode: "random",
  });
  const runId = p.writerSessionId + ":1",
    wordId = p.words[0].wordId;
  await service.submit(before.session, {
    writerSessionId: p.writerSessionId,
    writerEpoch: p.writerEpoch,
    baseRevision: p.revision,
    batchSeq: 1,
    batchId: p.writerSessionId + ":1",
    events: [
      {
        type: "run-start",
        eventSeq: 1,
        runSeq: 1,
        runId,
        preparation: p.preparation,
      },
      {
        type: "answer",
        eventSeq: 2,
        runId,
        questionSeq: 1,
        wordId,
        contentVersion: "rename-fixture",
        questionType: "spell",
        result: "wrong",
        hintMode: "fade",
        answerShown: true,
        extraHintUsed: false,
        responseMs: 500,
      },
      {
        type: "answer",
        eventSeq: 3,
        runId,
        questionSeq: 2,
        wordId,
        contentVersion: "rename-fixture",
        questionType: "meaning",
        result: "correct",
        hintMode: "none",
        answerShown: false,
        extraHintUsed: false,
        responseMs: 500,
      },
      { type: "won", eventSeq: 4, runId },
    ],
  });
  const saved = structuredClone(await repo.load(before.playerId));
  user = { ...user, username: "new_name", displayName: "New Name" };
  await repo.close();
  repo.cache.clear();
  repo.cacheBytes = 0;
  await repo.init();
  const after = await service.login("new-platform-credential");
  assert.equal(after.playerId, before.playerId);
  assert.deepEqual(await repo.load(after.playerId), saved);
  assert.equal((await service.view(after.session)).summary.completedRuns, 1);
  assert.equal(saved.words[wordId].spell.wrong, 1);
  assert.equal(saved.words[wordId].meaning.correct, 1);
  assert.deepEqual(await readdir(join(dir, "profiles")), [
    before.playerId + ".json",
  ]);
  user = {
    id: "xbuilder-stable-002",
    username: "old_name",
    displayName: "Old Name",
  };
  const other = await service.login("other-platform-credential");
  assert.notEqual(other.playerId, before.playerId);
  assert.deepEqual(await service.view(other.session), { newUser: true });
});

test("a username or display name cannot substitute for a missing stable user id", async () => {
  for (const user of [
    { username: "known_name", displayName: "Known" },
    { id: " ", username: "known_name" },
    { id: 42, username: "known_name" },
  ]) {
    const verifier = xbuilderVerifier({
      userInfoUrl: "https://identity.example/user",
      issuer: "test",
      fetcher: async () => Response.json(user),
    });
    await assert.rejects(
      verifier("verified-test-credential"),
      /IDENTITY_RESPONSE/,
    );
  }
});

test("same-id credential refresh retains reference client deck, queue and in-flight acknowledgement", async () => {
  let release;
  const client = new LearningClient({
    transport: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  client.useAccount("stable-id", "old-session");
  const state = client.state;
  state.prepared = {
    writerSessionId: "writer",
    writerEpoch: 1,
    revision: 1,
    lastBatchSeq: 0,
  };
  client.record({ type: "checkpoint", checkpoint: 1 });
  const save = client.save("checkpoint"),
    frozen = state.frozen,
    generation = client.generation;
  client.useAccount("stable-id", "new-session");
  assert.equal(client.state, state);
  assert.equal(state.frozen, frozen);
  assert.equal(client.generation, generation);
  assert.equal(client.pendingCount, 1);
  release({
    batchId: "writer:1",
    batchSeq: 1,
    lastEventSeq: 1,
    revision: 2,
    savedAt: new Date().toISOString(),
  });
  assert.equal(await save, true);
  assert.equal(client.pendingCount, 0);
  assert.equal(client.status, "saved");
});

test("old-token 401 after same-id refresh retries the unchanged batch with the new token", async () => {
  let rejectOld;
  const seen = [];
  const client = new LearningClient({
    now: () => 1000,
    transport: async (path, body, session) => {
      seen.push({ session, body: structuredClone(body) });
      if (session === "old")
        return new Promise((_, reject) => {
          rejectOld = reject;
        });
      return {
        batchId: "writer:1",
        batchSeq: 1,
        lastEventSeq: 1,
        revision: 2,
        savedAt: new Date().toISOString(),
      };
    },
  });
  client.useAccount("stable-id", "old");
  client.state.prepared = {
    writerSessionId: "writer",
    writerEpoch: 1,
    revision: 1,
    lastBatchSeq: 0,
  };
  client.record({ type: "checkpoint", checkpoint: 1 });
  const saving = client.save("checkpoint");
  client.useAccount("stable-id", "new");
  rejectOld(Object.assign(new Error("LOGIN_REQUIRED"), { status: 401 }));
  await saving;
  assert.equal(client.state.halted, false);
  assert.equal(await client.retryDue(), true);
  assert.deepEqual(
    seen.map((x) => x.session),
    ["old", "new"],
  );
  assert.deepEqual(seen[0].body, seen[1].body);
  assert.equal(client.pendingCount, 0);
});
