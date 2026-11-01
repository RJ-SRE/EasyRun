import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { canonicalUsername, usernamePlayerId, playerId } from "../auth.mjs";
import { FileStore, DurableRepository } from "../storage.mjs";
import { LearningService } from "../service.mjs";
import { learningServer } from "../http.mjs";
import { loadLexicon } from "../lexicon.mjs";

test("name profiles canonicalize case, surrounding spaces and Unicode, but reject empty/control/oversized inputs", () => {
  const key = "m".repeat(40);
  assert.equal(canonicalUsername("  Alice  "), "alice");
  assert.equal(
    usernamePlayerId("Alice", key),
    usernamePlayerId(" alice ", key),
  );
  assert.equal(usernamePlayerId("e\u0301", key), usernamePlayerId("é", key));
  assert.notEqual(usernamePlayerId("alice", key), usernamePlayerId("bob", key));
  assert.notEqual(
    usernamePlayerId("alice", key),
    playerId("xbuilder", "alice", key),
  );
  for (const name of [
    undefined,
    null,
    12,
    {},
    "",
    " ",
    "a\nb",
    "a\u200bb",
    "x".repeat(101),
  ])
    assert.throws(() => canonicalUsername(name), /INVALID_USERNAME/);
});

test("explicit username HTTP mode restores same-name history after reopening, rename is new, and verified sessions stay isolated", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "rupture-name-"));
  const repo = new DurableRepository(
    new FileStore(join(dir, "profiles")),
    join(dir, "journal"),
  );
  await repo.init();
  const lexicon = await loadLexicon(
    new URL("../content/legacy-test/", import.meta.url),
    { release: false },
  );
  const config = {
    repository: repo,
    lexicon,
    mappingKey: "m".repeat(40),
    sessionKey: "s".repeat(40),
  };
  const service = new LearningService({ ...config, profileMode: "username" });
  const api = learningServer(service);
  await new Promise((r) => api.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => api.close(r));
    await repo.close();
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${api.address().port}`;
  const request = async (body) => {
    const r = await fetch(base + "/v1/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  const a = (await request({ username: "Alice" })).body;
  assert.equal(a.profileMode, "username");
  assert.equal(a.verified, false);
  const p = await service.prepare(a.session, {
    contentVersion: lexicon.contentVersion,
    wordMode: "random",
  });
  const runId = p.writerSessionId + ":1",
    wordId = p.words[0].wordId;
  await service.submit(a.session, {
    writerSessionId: p.writerSessionId,
    writerEpoch: p.writerEpoch,
    baseRevision: p.revision,
    batchSeq: 1,
    batchId: p.writerSessionId + ":1",
    events: [
      {
        type: "run-start",
        eventSeq: 1,
        runId,
        runSeq: 1,
        preparation: p.preparation,
      },
      {
        type: "answer",
        eventSeq: 2,
        runId,
        wordId,
        contentVersion: lexicon.contentVersion,
        questionSeq: 1,
        questionType: "meaning",
        result: "wrong",
        hintMode: "none",
        answerShown: false,
        extraHintUsed: false,
        responseMs: 600,
      },
      { type: "won", eventSeq: 3, runId },
    ],
  });
  await repo.close();
  repo.cache.clear();
  repo.cacheBytes = 0;
  await repo.init();
  const again = (await request({ username: " alice " })).body;
  assert.equal(again.playerId, a.playerId);
  assert.equal((await service.view(again.session)).summary.completedRuns, 1);
  assert.equal(
    (await repo.load(again.playerId)).words[wordId].meaning.wrong,
    1,
  );
  const renamed = (await request({ username: "AliceNew" })).body;
  assert.notEqual(renamed.playerId, a.playerId);
  assert.deepEqual(await service.view(renamed.session), { newUser: true });
  // This explicitly documents the accepted limitation: knowledge of the same
  // username resolves the same archive, with no claim of platform ownership.
  const sameName = (await request({ username: "ALICE" })).body;
  assert.equal(sameName.playerId, a.playerId);
  assert.equal(sameName.verified, false);
  assert.equal((await request({ username: "" })).status, 400);
  assert.equal(
    (await request({ platformCredential: "not-a-username" })).status,
    400,
  );
  const verified = new LearningService({
    ...config,
    verifyIdentity: async () => ({ issuer: "fixture", subject: "Alice" }),
  });
  const v = await verified.login("credential");
  assert.notEqual(v.playerId, a.playerId);
  assert.throws(() => service.identity(v.session), /LOGIN_REQUIRED/);
  assert.throws(() => verified.identity(a.session), /LOGIN_REQUIRED/);
  await assert.rejects(
    verified.loginUsername("Alice"),
    /USERNAME_PROFILES_DISABLED/,
  );
  await assert.rejects(service.login("credential"), /PROFILE_MODE_MISMATCH/);
  const health = await (await fetch(base + "/health")).json();
  assert.equal(health.profileMode, "username");
  assert.equal(health.loginAvailable, true);
  assert.equal(health.identityConfigured, false);
});
