// Native XGo -> actual HTTP -> durable local profile. Test credentials exist only
// in this test process and an in-memory source overlay; never in exported .xbp.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import {
  FileStore,
  DurableRepository,
} from "../../services/learning/storage.mjs";
import { LearningService } from "../../services/learning/service.mjs";
import { learningServer } from "../../services/learning/http.mjs";
import { loadLexicon } from "../../services/learning/lexicon.mjs";
import { LearningError } from "../../services/learning/rules.mjs";
import { liveKodoHarness } from "../../services/learning/test/kodo-live-support.mjs";
const base = process.env.RUNLAB_URL || "http://127.0.0.1:4177";
const deployed =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const modelUrl = process.env.XBUILDER_MODEL_URL;
const temp = await mkdtemp(join(tmpdir(), "rupture-native-learning-"));
const live = process.env.LEARNING_LIVE_KODO === "1" ? liveKodoHarness() : null;
const evidenceFolder = new URL(
  live
    ? "../../docs/evidence/2026-10-31-kodo-live/"
    : "../../docs/evidence/2026-10-31-cloud-learning/",
  import.meta.url,
);
await mkdir(evidenceFolder, { recursive: true });
const repo = new DurableRepository(
  live?.store || new FileStore(join(temp, "profiles")),
  join(temp, "journal"),
);
await repo.init();
const lexicon = await loadLexicon(
  new URL("../../services/learning/content/legacy-test/", import.meta.url),
  { release: false },
);
const service = new LearningService({
  repository: repo,
  lexicon,
  verifyIdentity: async (v) => {
    assert.ok(["native-fixture-a", "native-fixture-b"].includes(v));
    return { issuer: "automated-native-test-only", subject: v };
  },
  mappingKey: randomBytes(32).toString("hex"),
  sessionKey: randomBytes(32).toString("hex"),
});
const a = await service.login("native-fixture-a"),
  b = await service.login("native-fixture-b");
service.now = () => Date.now() + 1000;
const aRefreshed = await service.login("native-fixture-a");
service.now = Date.now;
assert.equal(aRefreshed.playerId, a.playerId);
assert.notEqual(aRefreshed.session, a.session);
let prepareRequests = 0;
const originalPrepare = service.prepare.bind(service);
service.prepare = async (...args) => {
  prepareRequests++;
  return originalPrepare(...args);
};
const requests = [];
let dropAfterCommit = false;
let delayAfterCommit = false,
  releaseReceipt;
const originalSubmit = service.submit.bind(service);
service.submit = async (token, body) => {
  requests.push(JSON.stringify(body));
  const receipt = await originalSubmit(token, body);
  if (dropAfterCommit) {
    dropAfterCommit = false;
    throw new LearningError("SERVICE_UNAVAILABLE", 503);
  }
  if (delayAfterCommit) {
    delayAfterCommit = false;
    await new Promise((resolve) => {
      releaseReceipt = resolve;
    });
  }
  return receipt;
};
const api = learningServer(service, { allowedOrigins: [new URL(base).origin] });
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const apiURL = `http://127.0.0.1:${api.address().port}`;
const archive = new URL("exports/belfry.xbp", import.meta.url);
const fileserver = createServer((req, res) => {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
  });
  const runtime =
    deployed && ["/ispx.wasm", "/engineres.zip"].includes(req.url)
      ? join(deployed, req.url.slice(1))
      : archive;
  createReadStream(runtime).pipe(res);
});
await new Promise((r) => fileserver.listen(0, "127.0.0.1", r));
const archiveURL = `http://127.0.0.1:${fileserver.address().port}/package.xbp`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const report = {
  date: new Date().toISOString(),
  runtime: deployed
    ? "XBuilder cached 2026-10-26 compiler/resources, model roundtrip, real native HTTP"
    : "pinned npm SPX, real native HTTP",
  storage: live ? "real-private-kodo" : "local-files",
  identity: "temporary test verifier; not XBuilder production auth",
  ...(live ? { prefix: live.prefix, samples: live.samples } : {}),
  cases: [],
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  complete: false,
};
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
let page;
async function boot() {
  page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.addInitScript(() => {
    window.probes = [];
    window.gameErrors = [];
    window.cloudMessages = [];
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* npm runtime logs are plain text */
      }
      if (s.startsWith("@cloudProbe "))
        window.probes.push(JSON.parse(s.slice(12)));
      if (s.startsWith("@cloud ")) window.cloudMessages.push(s);
      log(...args);
    };
  });
  await page.goto(base + "/runtime/runner.html");
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({
      archiveURL,
      apiURL,
      version,
      a,
      b,
      aRefreshed,
      deployed,
      modelUrl,
    }) => {
      window.onGameError((e) => window.gameErrors.push(String(e)));
      window.onEngineCrash((e) => window.gameErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          [
            "engine.zip",
            deployed ? "engineres.zip" : "game.zip",
            "engine.wasm",
            "ispx.wasm",
          ].map((n) => [
            n,
            deployed && ["ispx.wasm", "engineres.zip"].includes(n)
              ? archiveURL.replace("package.xbp", n)
              : "/runtime/" + n,
          ]),
        ),
      );
      let files = window.fflate.unzipSync(
        new Uint8Array(await (await fetch(archiveURL)).arrayBuffer()),
      );
      const decoder = new TextDecoder(),
        encoder = new TextEncoder();
      if (modelUrl) {
        const { r: Project, gn: ModelFile } = await import(modelUrl);
        const project = new Project();
        await project.loadFiles(
          Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [
              name,
              new ModelFile(name.split("/").pop(), async () =>
                bytes.buffer.slice(
                  bytes.byteOffset,
                  bytes.byteOffset + bytes.byteLength,
                ),
              ),
            ]),
          ),
        );
        files = Object.fromEntries(
          await Promise.all(
            Object.entries(project.exportFiles()).map(async ([name, file]) => [
              name,
              new Uint8Array(await file.arrayBuffer()),
            ]),
          ),
        );
      }
      let logic = decoder
        .decode(files["NativeLogic.spx"])
        .replace(/onStart => \{hide\}\s*$/, "");
      logic += `
func nativeCloudTestProbe() {
 println "@cloudProbe",nativeCloudJSON(map[string]any{"phase":phase,"account":nativeCloudAccount,"ready":nativeCloudReady,"halted":nativeCloudHalted,"busy":nativeCloudBusy,"run":nativeCloudRun,"queue":len(nativeCloudQueue),"ack":nativeCloudAck,"seq":nativeCloudSeq,"runSeq":nativeCloudRunSeq,"deck":nativeDeck,"status":nativeCloudStatus,"first":nativeWordIDs[nativeDeck[0]],"weak":nativeLearnWeak[nativeDeck[0]*2]})
}
func nativeCloudTestAnswer(result,mode int) {
 nativeWordIndex=nativeDeck[0]; nativeQuestionMode=mode; wordSerial++; nativeLearningAnswer(result)
 if result==1 {nativeDone[0]=1}
}
onStart => {hide}
`;
      files["NativeLogic.spx"] = encoder.encode(logic);
      const overlay = `
onKey KeyF1, => {nativeLocalEnabled=false; nativeNameMode=false; nativeCloudURL=${JSON.stringify(apiURL)}; nativeCloudVersion=${JSON.stringify(version)}; NativeLogic.nativeCloudAttach(${JSON.stringify(a.playerId)},${JSON.stringify(a.session)})}
onKey KeyF2, => {NativeLogic.nativeCloudTestProbe()}
onKey KeyF3, => {NativeLogic.nativeCloudTestAnswer(2,0)}
onKey KeyF4, => {NativeLogic.nativeCloudTestAnswer(1,1)}
onKey KeyF5, => {checkpoint++; WorldLogic.event("checkpoint")}
onKey KeyF6, => {phase=3; WorldLogic.event("fail")}
onKey KeyF7, => {phase=2; WorldLogic.event("finish")}
onKey KeyF8, => {NativeLogic.nativeCloudAttach(${JSON.stringify(b.playerId)},${JSON.stringify(b.session)})}
onKey KeyF9, => {Hero.invulnerable=999; Hero.py=0; Hero.vy=0}
onKey KeyZ, => {NativeLogic.nativeCloudAttach(${JSON.stringify(aRefreshed.playerId)},${JSON.stringify(aRefreshed.session)})}
onKey KeyF10, => {phase=4; NativeLogic.nativeReturnTitle()}
onKey KeyF11, => {NativeLogic.nativeCloudTestAnswer(3,0)}
onKey KeyF12, => {for n:=0;n<2001;n++ {NativeLogic.nativeCloudTestAnswer(2,0)}}
`;
      files["main.spx"] = encoder.encode(
        decoder.decode(files["main.spx"]) + overlay,
      );
      await window.initGame(
        Object.fromEntries(
          Object.entries(files).map(([name, v]) => [
            name,
            {
              content: v.buffer.slice(
                v.byteOffset,
                v.byteOffset + v.byteLength,
              ),
              lastModified: Date.now(),
            },
          ]),
        ),
      );
      await window.startGame();
    },
    {
      archiveURL,
      apiURL,
      version: lexicon.contentVersion,
      a,
      b,
      aRefreshed,
      deployed: !!deployed,
      modelUrl,
    },
  );
  await page.waitForTimeout(1000);
}
async function tap(key) {
  await page.keyboard.press(key, { delay: 50 });
}
async function probe() {
  const n = await page.evaluate(() => window.probes.length);
  await tap("F2");
  await page.waitForFunction((n) => window.probes.length > n, n, {
    timeout: 10000,
  });
  return page.evaluate(() => window.probes.at(-1));
}
async function until(predicate, timeout = 30000) {
  const end = Date.now() + timeout;
  let s;
  while (Date.now() < end) {
    s = await probe();
    if (predicate(s)) return s;
    await page.waitForTimeout(180);
  }
  throw Error("native state timeout: " + JSON.stringify(s));
}
try {
  await boot();
  await tap("Enter");
  await tap("F9");
  await tap("F1");
  let s = await probe();
  assert.equal(s.account, "");
  assert.equal(s.run, false);
  await tap("r");
  s = await probe();
  assert.equal(s.account, "");
  assert.equal(await repo.load(a.playerId), null);
  pass("guest mid-run login and R keep guest ownership; no profile writes");
  await tap("F10");
  s = await until((s) => s.ready && !s.busy);
  assert.equal(s.account, a.playerId);
  assert.equal(new Set(s.deck).size, 30);
  const beforeRefresh = s.deck,
    requestsBeforeRefresh = prepareRequests;
  await tap("z");
  await page.waitForTimeout(250);
  s = await probe();
  assert.equal(s.ready, true);
  assert.deepEqual(s.deck, beforeRefresh);
  assert.equal(prepareRequests, requestsBeforeRefresh);
  pass(
    "same stable id with refreshed credential keeps prepared deck and does not reload or request another profile",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("native-cloud-ready.png", evidenceFolder)),
  });
  pass("native HTTP prepares 30 unique words only after returning to title");
  const first = s.first;
  await tap("Enter");
  await tap("F9");
  await tap("F3");
  await tap("F4");
  assert.equal(requests.length, 0);
  assert.equal((await repo.load(a.playerId)).words[first], undefined);
  dropAfterCommit = true;
  await tap("F5");
  await until((s) => s.status.includes("自动重试"));
  await tap("F11"); // New evidence while frozen request is uncertain must survive ACK.
  await until((s) => s.ack === 4 && !s.busy); // start + spell + meaning + checkpoint
  let profile = await repo.load(a.playerId);
  assert.equal(profile.words[first].spell.wrong, 1);
  assert.equal(profile.words[first].meaning.correct, 1);
  assert.equal(requests[0], requests[1]);
  s = await probe();
  assert.equal(s.queue, 1);
  pass(
    "checkpoint async save retries the identical batch after lost ACK; no double counts, later answer retained",
  );
  await tap("F6");
  await until((s) => s.queue === 0 && !s.busy);
  profile = await repo.load(a.playerId);
  assert.equal(profile.words[first].spell.timeouts, 1);
  assert.equal(profile.activeRun.failures, 1);
  await page.screenshot({
    path: fileURLToPath(new URL("native-cloud-saved.png", evidenceFolder)),
  });
  pass("failure saves pending timeout with separate ability evidence");
  await tap("Enter");
  await tap("F9");
  await tap("F8");
  await tap("r");
  await tap("F9");
  s = await probe();
  assert.equal(s.account, a.playerId);
  assert.equal(s.run, true);
  assert.equal(s.first, first);
  await tap("F10");
  s = await until((s) => s.account === b.playerId && s.ready && !s.busy);
  assert.equal(s.weak, 0);
  assert.deepEqual((await repo.load(b.playerId)).words, {});
  pass(
    "R preserves current account/deck; pending second account activates at title without importing guest/other history",
  );
  await tap("F1");
  s = await until((s) => s.account === a.playerId && s.ready && !s.busy);
  assert.equal(s.queue, 0);
  profile = await repo.load(a.playerId);
  assert.equal(profile.activeRun, null);
  assert.equal(profile.recentRuns.length, 2);
  assert.equal(profile.words[first].spell.wrong, 1);
  pass(
    "switching back drains archived unconfirmed account events and restores server history",
  );
  await tap("Enter");
  await tap("F9");
  await tap("F4");
  await tap("F7");
  await until((s) => s.queue === 0 && !s.busy);
  profile = await repo.load(a.playerId);
  assert.equal(profile.totals.completedRuns, 1);
  pass("winning counts once and persists solved-word completion");
  await tap("F10");
  await until((s) => s.ready && !s.busy);
  await tap("Enter");
  await tap("F9");
  await tap("F3");
  delayAfterCommit = true;
  await tap("F5");
  for (let n = 0; n < 50 && !releaseReceipt; n++)
    await page.waitForTimeout(100);
  assert.ok(releaseReceipt, "receipt intentionally held after durable write");
  const pendingBeforeRefresh = await probe(),
    preparesDuringSave = prepareRequests;
  await tap("F1");
  await tap("z");
  const pendingAfterRefresh = await probe();
  assert.equal(pendingAfterRefresh.queue, pendingBeforeRefresh.queue);
  assert.equal(pendingAfterRefresh.busy, true);
  assert.deepEqual(pendingAfterRefresh.deck, pendingBeforeRefresh.deck);
  assert.equal(prepareRequests, preparesDuringSave);
  pass(
    "same-id updates during native save preserve frozen evidence and the in-flight request",
  );
  await tap("F8");
  await tap("F10");
  s = await until((s) => s.account === b.playerId && s.ready && !s.busy);
  const bRevision = (await repo.load(b.playerId)).revision;
  releaseReceipt();
  releaseReceipt = null;
  await page.waitForTimeout(300);
  s = await probe();
  assert.equal(s.account, b.playerId);
  assert.equal(s.queue, 0);
  assert.equal((await repo.load(b.playerId)).revision, bRevision);
  await tap("F1");
  await until((s) => s.account === a.playerId && s.ready && !s.busy);
  pass(
    "late previous-account receipt is ignored; restored frozen batch replays safely",
  );
  await page.close();
  await boot();
  await tap("F1");
  s = await until((s) => s.halted);
  assert.match(s.status, /占用/);
  await page.screenshot({
    path: fileURLToPath(new URL("native-cloud-conflict.png", evidenceFolder)),
  });
  await tap("v");
  s = await until((s) => s.ready && !s.busy);
  assert.equal(s.account, a.playerId);
  assert.ok((await repo.load(a.playerId)).words[first].spell.wrong >= 1);
  pass(
    "fresh native runtime requires explicit writer takeover and recovers persisted learning state",
  );
  await tap("Enter");
  await tap("F9");
  await tap("F12");
  s = await probe();
  assert.equal(s.queue, 2000);
  assert.equal(s.run, false);
  assert.match(s.status, /记录已满/);
  await tap("r");
  s = await probe();
  assert.equal(s.run, false);
  assert.equal(s.queue, 2000);
  await tap("F10");
  await tap("n");
  await until(
    (s) => s.ready && !s.busy && s.queue === 0,
    live ? 180000 : 60000,
  );
  assert.ok(requests.every((x) => Buffer.byteLength(x) <= 32768));
  pass(
    "native 2000-event bound retains evidence, marks excess local-only, drains in <=32 KiB batches",
  );
  assert.deepEqual(await page.evaluate(() => window.gameErrors), []);
  assert.deepEqual(report.errors, []);
  report.complete = true;
} finally {
  if (releaseReceipt) releaseReceipt();
  await browser.close();
  await new Promise((r) => fileserver.close(r));
  await new Promise((r) => api.close(r));
  await repo.close();
  if (live) {
    try {
      report.cleanup = await live.cleanup();
    } catch {
      report.complete = false;
      report.cleanup = { verifiedAbsent: false, prefix: live.prefix };
      process.exitCode = 1;
    }
  }
  await mkdir(evidenceFolder, { recursive: true });
  await writeFile(
    new URL(
      deployed
        ? "native-http-xbuilder-snapshot.json"
        : "native-http-integration.json",
      evidenceFolder,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  await rm(temp, { recursive: true, force: true });
}
