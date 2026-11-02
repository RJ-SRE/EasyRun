import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DurableRepository, KodoStore } from "./storage.mjs";
import { kodoOptions } from "./kodo-config.mjs";
import { liveKodoHarness } from "./test/kodo-live-support.mjs";
import { loadLexicon } from "./lexicon.mjs";
import { LearningService } from "./service.mjs";
import { learningServer } from "./http.mjs";
import { LearningClient, httpTransport } from "./client.mjs";
import { xbuilderVerifier } from "./auth.mjs";

const live = liveKodoHarness();
const temp = await mkdtemp(join(tmpdir(), "rupture-kodo-live-"));
let repository, server;
const report = {
  date: new Date().toISOString(),
  storage: "real-private-kodo",
  bucket: live.store.bucket,
  prefix: live.prefix,
  identity: "temporary test verifier; not XBuilder production auth",
  cases: [],
  samples: live.samples,
  complete: false,
};
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS " + name);
};
try {
  repository = new DurableRepository(live.store, join(temp, "journal"));
  await repository.init();
  pass("private bucket permission verified before service startup");
  const lexicon = await loadLexicon(
    new URL("content/legacy-test/", import.meta.url),
    { release: false },
  );
  let user = {
    id: "live-fixture-stable-a",
    username: "before",
    displayName: "Before",
  };
  const verifyIdentity = xbuilderVerifier({
    userInfoUrl: "https://identity.invalid/user",
    issuer: "live-test-only",
    fetcher: async () => Response.json(user),
  });
  const config = {
    lexicon,
    verifyIdentity,
    mappingKey: randomBytes(32).toString("hex"),
    sessionKey: randomBytes(32).toString("hex"),
  };
  let service = new LearningService({ ...config, repository });
  server = learningServer(service, {
    storage: "kodo",
    identityConfigured: false,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const http = httpTransport(`http://127.0.0.1:${server.address().port}`);
  const transport = async (...args) => {
    try {
      return await http(...args);
    } catch (error) {
      report.lastHTTPError = {
        path: args[0],
        code: error.code,
        name: error.name,
      };
      throw error;
    }
  };
  const login = await transport("/v1/session", {
    platformCredential: "fixture-credential-for-live-test",
  });
  const client = new LearningClient({ transport });
  client.useAccount(login.playerId, login.session);
  const deck = await client.prepare({
    contentVersion: lexicon.contentVersion,
    wordMode: "random",
  });
  assert.equal(new Set(deck.words.map((w) => w.wordId)).size, 30);
  pass("real HTTP prepares 30 unique words and creates private Kodo profile");
  const unsigned = await fetch(
    new URL(live.store.key(login.playerId), live.store.privateReadOrigin),
    { redirect: "error", signal: AbortSignal.timeout(10000) },
  );
  assert.ok([401, 403].includes(unsigned.status));
  await unsigned.body?.cancel();
  report.anonymousReadStatus = unsigned.status;
  pass("unsigned source download cannot read test profile");
  const runId = deck.writerSessionId + ":1",
    wordId = deck.words[0].wordId;
  client.record({
    type: "run-start",
    runId,
    runSeq: 1,
    preparation: deck.preparation,
  });
  client.record({
    type: "answer",
    runId,
    wordId,
    contentVersion: lexicon.contentVersion,
    questionSeq: 1,
    questionType: "spell",
    result: "wrong",
    hintMode: "fade",
    answerShown: true,
    extraHintUsed: false,
    responseMs: 600,
  });
  client.record({
    type: "answer",
    runId,
    wordId,
    contentVersion: lexicon.contentVersion,
    questionSeq: 2,
    questionType: "meaning",
    result: "correct",
    hintMode: "none",
    answerShown: false,
    extraHintUsed: false,
    responseMs: 600,
  });
  assert.equal(await client.save("checkpoint"), true);
  const coldStore = new KodoStore({ ...kodoOptions(), keyPrefix: live.prefix });
  const saved = JSON.parse(await coldStore.read(login.playerId));
  assert.equal(saved.words[wordId].spell.wrong, 1);
  assert.equal(saved.words[wordId].meaning.correct, 1);
  pass(
    "spelling and meaning evidence survives uncached HTTPS cloud read with ETag verification",
  );
  // Simulate losing the provider response AFTER the actual upload succeeds.
  const write = live.store.write;
  live.store.write = async (...args) => {
    await write(...args);
    live.store.write = write;
    throw Error("simulated lost upload receipt");
  };
  client.record({ type: "won", runId });
  assert.equal(await client.save("won"), false);
  assert.equal(client.pendingCount, 1);
  const frozen = structuredClone(client.state.frozen);
  await new Promise((r) => server.close(r));
  server = null;
  await repository.close();
  repository = new DurableRepository(live.store, join(temp, "journal"));
  await repository.init();
  service = new LearningService({ ...config, repository });
  const ack = await service.submit(login.session, frozen);
  assert.equal(ack.batchId, frozen.batchId);
  assert.deepEqual(await service.submit(login.session, frozen), ack);
  assert.equal((await service.view(login.session)).summary.completedRuns, 1);
  pass(
    "fresh repository recovers uncertain real upload; duplicate batch counts victory exactly once",
  );
  user = { ...user, username: "renamed", displayName: "Renamed" };
  const renamed = await service.login("fixture-new-credential-after-rename");
  assert.equal(renamed.playerId, login.playerId);
  assert.equal((await service.view(renamed.session)).summary.completedRuns, 1);
  user = {
    id: "live-fixture-stable-b",
    username: "before",
    displayName: "Before",
  };
  const other = await service.login("fixture-other-credential-new-user");
  assert.notEqual(other.playerId, login.playerId);
  assert.deepEqual(await service.view(other.session), { newUser: true });
  pass(
    "rename retains cloud profile; different stable id reusing old name remains isolated",
  );
  const before = await coldStore.read(login.playerId);
  await assert.rejects(
    coldStore.write(login.playerId, '{"mustNotOverwrite":true}', {
      insertOnly: true,
    }),
    /WRITE_UNCONFIRMED/,
  );
  assert.equal(await coldStore.read(login.playerId), before);
  pass("insert-only collision cannot overwrite an existing cloud profile");
  report.complete = true;
} catch (error) {
  report.failure = {
    name: error.name,
    code: error.code || "LIVE_CHECK_FAILED",
    message:
      error instanceof assert.AssertionError
        ? "Assertion failed; inspect local test"
        : undefined,
    source: error.stack
      ?.split("\n")
      .find((line) => line.includes("test-kodo-live.mjs"))
      ?.trim(),
  };
  console.error(JSON.stringify(report.failure));
  process.exitCode = 1;
} finally {
  if (server) await new Promise((r) => server.close(r));
  if (repository) await repository.close();
  try {
    report.cleanup = await live.cleanup();
  } catch {
    report.cleanup = { verifiedAbsent: false, prefix: live.prefix };
    report.complete = false;
    process.exitCode = 1;
  }
  await rm(temp, { recursive: true, force: true });
  const folder = new URL(
    "../../docs/evidence/2026-10-31-kodo-live/",
    import.meta.url,
  );
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL("cloud-integration.json", folder),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      complete: report.complete,
      cases: report.cases.length,
      cleanup: report.cleanup,
    }),
  );
}
