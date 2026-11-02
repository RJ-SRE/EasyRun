import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { FileStore, DurableRepository, KodoStore } from "../storage.mjs";
import { LearningService } from "../service.mjs";
import { LearningClient, httpTransport } from "../client.mjs";
import { learningServer } from "../http.mjs";
import { loadLexicon } from "../lexicon.mjs";
import { xbuilderVerifier } from "../auth.mjs";
const q64 = (x) =>
  Buffer.from(x).toString("base64").replaceAll("+", "-").replaceAll("/", "_");
const tick = Date.parse("2026-10-31T00:00:00Z");
test("Kodo adapter uses signed exact user key, verifies origin bytes, treats only stat 612 as absent", async () => {
  const id = "p_" + "a".repeat(64),
    body = '{"version":1}',
    key = `rupture/learning/v1/users/${id}/current.json`;
  const hash = q64(
    Buffer.concat([
      Buffer.from([0x16]),
      createHash("sha1").update(body).digest(),
    ]),
  );
  let requests = [];
  const store = new KodoStore({
    bucket: "private-fixture",
    accessKey: "fixture-access",
    secretKey: "fixture-secret",
    uploadOrigin: "https://upload.invalid",
    privateReadOrigin: "https://origin.invalid",
    fetcher: async (url, options) => {
      requests.push({ url: String(url), options });
      if (options.method === "POST") {
        assert.equal(options.body.get("key"), key);
        const token = options.body.get("token").split(":");
        const policy = JSON.parse(Buffer.from(token[2], "base64"));
        assert.equal(policy.scope, "private-fixture:" + key);
        assert.equal(policy.insertOnly, 1);
        return Response.json({ key, hash });
      }
      if (String(url).includes("/stat/")) {
        assert.match(options.headers.Authorization, /^QBox fixture-access:/);
        return Response.json({ hash, fsize: body.length });
      }
      assert.match(String(url), /token=fixture-access:/);
      return new Response(body);
    },
  });
  await store.write(id, body, { insertOnly: true });
  assert.equal(await store.read(id), body);
  assert.equal(requests.length, 3);
  store.fetcher = async () => new Response("", { status: 403 });
  await assert.rejects(store.read(id), /KODO_STAT_FAILED/);
  store.fetcher = async () => ({ status: 612, ok: false });
  assert.equal(await store.read(id), null);
  store.fetcher = async (url) =>
    String(url).includes("/stat/")
      ? Response.json({ hash, fsize: body.length })
      : new Response("stale");
  await assert.rejects(store.read(id), /STALE_OR_CORRUPT/);
});
test("platform verifier fails closed, rejects public names and never accepts a client-supplied user id", async () => {
  assert.equal(xbuilderVerifier({}), null);
  assert.throws(
    () =>
      xbuilderVerifier({
        issuer: "x",
        userInfoUrl: "http://public.example/user",
      }),
    /IDENTITY_CONFIGURATION/,
  );
  const verify = xbuilderVerifier({
    issuer: "https://platform.invalid",
    userInfoUrl: "https://platform.invalid/user",
    fetcher: async (url, options) => {
      assert.equal(String(url), "https://platform.invalid/user");
      assert.match(options.headers.Authorization, /^Bearer /);
      return Response.json({ id: "stable-subject", username: "display-only" });
    },
  });
  await assert.rejects(verify("nickname"), /INVALID_CREDENTIAL/);
  assert.deepEqual(await verify("valid-fixture-credential"), {
    issuer: "https://platform.invalid",
    subject: "stable-subject",
  });
});
test("retry schedule is 2,5,15 seconds then manual; in-flight answers remain pending beyond save boundary", async () => {
  let now = tick,
    calls = 0;
  const p = {
    writerSessionId: "writer",
    writerEpoch: 1,
    revision: 1,
    lastBatchSeq: 0,
    lastEventSeq: 0,
    words: [],
  };
  const c = new LearningClient({
    now: () => now,
    transport: async () => {
      calls++;
      throw new Error("offline");
    },
  });
  c.useAccount("a", "s");
  c.state.prepared = p;
  c.record({ type: "checkpoint" });
  await c.save("manual");
  assert.equal(c.state.retryAt, now + 2000);
  now += 2000;
  await c.retryDue();
  assert.equal(c.state.retryAt, now + 5000);
  now += 5000;
  await c.retryDue();
  assert.equal(c.state.retryAt, now + 15000);
  now += 15000;
  await c.retryDue();
  assert.equal(c.state.retryAt, 0);
  assert.equal(calls, 4);
  await c.retryDue();
  assert.equal(calls, 4);
  assert.equal(c.pendingCount, 1);
  let release;
  c.transport = async (path, b) => {
    await new Promise((r) => (release = r));
    return {
      batchId: b.batchId,
      batchSeq: b.batchSeq,
      lastEventSeq: b.events.at(-1).eventSeq,
      revision: b.baseRevision + 1,
      savedAt: new Date(now).toISOString(),
    };
  };
  const saving = c.save("manual");
  await new Promise((r) => setImmediate(r));
  c.record({ type: "checkpoint" });
  release();
  await saving;
  assert.equal(c.pendingCount, 1);
  assert.equal(c.status, "pending");
  c.useAccount("b", "s");
  c.state.prepared = { ...p };
  c.maxEvents = 1;
  c.record({ type: "checkpoint" });
  assert.throws(() => c.record({ type: "checkpoint" }), /QUEUE_FULL/);
  assert.equal(c.status, "queue-full");
  assert.equal(c.pendingCount, 1);
});
test("real local HTTP: prepare -> 100 batches -> cold restart -> restored history; no pending references", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rupture-http-"));
  const lexicon = await loadLexicon(
    new URL("../content/legacy-test/", import.meta.url),
    { release: false },
  );
  const repo = new DurableRepository(
    new FileStore(join(directory, "profiles")),
    join(directory, "journal"),
  );
  await repo.init();
  const service = new LearningService({
    repository: repo,
    lexicon,
    verifyIdentity: async () => ({ issuer: "test-only", subject: "alice" }),
    mappingKey: "m".repeat(32),
    sessionKey: "s".repeat(32),
  });
  const server = learningServer(service, { identityConfigured: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await repo.close();
    await rm(directory, { recursive: true, force: true });
  });
  const transport = httpTransport(`http://127.0.0.1:${server.address().port}`);
  const { session } = await transport("/v1/session", {
    platformCredential: "fixture-platform-proof",
  });
  const client = new LearningClient({ transport });
  client.useAccount("alice", session);
  const p = await client.prepare({
    wordMode: "random",
    contentVersion: lexicon.contentVersion,
  });
  const runId = `${p.writerSessionId}:1`;
  client.record({
    type: "run-start",
    runId,
    runSeq: 1,
    preparation: p.preparation,
  });
  const wordId = p.words[0].wordId;
  for (let batch = 0; batch < 100; batch++) {
    for (let n = 0; n < 20; n++)
      client.record({
        type: "answer",
        runId,
        wordId,
        contentVersion: lexicon.contentVersion,
        questionSeq: batch * 20 + n + 1,
        questionType: "meaning",
        result: n % 3 === 0 ? "wrong" : "correct",
        hintMode: "none",
        answerShown: false,
        extraHintUsed: false,
        responseMs: 400,
      });
    assert.equal(await client.save("checkpoint"), true);
  }
  assert.equal(client.pendingCount, 0);
  assert.deepEqual(client.state.queue, []);
  assert.equal(client.state.frozen, null);
  assert.equal(client.state.pending, null);
  const id = service.identity(session);
  repo.cache.clear();
  repo.cacheBytes = 0;
  assert.equal((await repo.load(id)).words[wordId].meaning.attempts, 2000);
  assert.equal((await service.view(session)).summary.correct, 1);
  assert.equal(repo.locks.size, 0);
});
