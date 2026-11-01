// Runtime username -> normal session endpoint -> actual profile storage.
// No pre-signed session is injected into the game in this test.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
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
const folder = new URL(
  "../../docs/evidence/2026-10-31-username-profiles/",
  import.meta.url,
);
await mkdir(folder, { recursive: true });
const live = process.env.LEARNING_LIVE_KODO === "1" ? liveKodoHarness() : null;
const temp = await mkdtemp(join(tmpdir(), "rupture-native-name-"));
const store = live?.store || new FileStore(join(temp, "profiles"));
const repo = new DurableRepository(store, join(temp, "journal"));
await repo.init();
const lexicon = await loadLexicon(
  new URL("../../services/learning/content/legacy-test/", import.meta.url),
  { release: false },
);
const service = new LearningService({
  repository: repo,
  lexicon,
  profileMode: "username",
  mappingKey: randomBytes(32).toString("hex"),
  sessionKey: randomBytes(32).toString("hex"),
});
const names = [];
let prepares = 0,
  holdName = "",
  releaseName,
  failName = "";
const login = service.loginUsername.bind(service);
service.loginUsername = async (name) => {
  names.push(name);
  if (name === failName) {
    failName = "";
    throw new LearningError("TEST_NETWORK_FAILURE", 503);
  }
  const session = await login(name);
  if (name === holdName) {
    holdName = "";
    await new Promise((r) => {
      releaseName = r;
    });
  }
  return session;
};
const prepare = service.prepare.bind(service);
service.prepare = async (...args) => {
  prepares++;
  return prepare(...args);
};
const api = learningServer(service, {
  allowedOrigins: [new URL(base).origin],
  storage: store.label,
});
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const apiURL = `http://127.0.0.1:${api.address().port}`;
const archive = new URL("exports/belfry.xbp", import.meta.url);
const fileServer = createServer((req, res) => {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
  });
  createReadStream(
    deployed && ["/ispx.wasm", "/engineres.zip"].includes(req.url)
      ? join(deployed, basename(req.url))
      : archive,
  ).pipe(res);
});
await new Promise((r) => fileServer.listen(0, "127.0.0.1", r));
const archiveURL = `http://127.0.0.1:${fileServer.address().port}/package.xbp`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const report = {
  date: new Date().toISOString(),
  runtime: deployed
    ? "XBuilder cached compiler/resources with model roundtrip"
    : "pinned npm SPX",
  storage: live ? "real-private-kodo" : "local-files",
  identity:
    "actual runtime username selector, unverified; no pre-signed game sessions injected",
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  cases: [],
  errors: [],
  complete: false,
  ...(live ? { prefix: live.prefix, samples: live.samples } : {}),
};
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
let page;
async function boot(initialName = "") {
  page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.addInitScript(() => {
    window.probes = [];
    window.gameErrors = [];
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* plain npm logs */
      }
      if (s.startsWith("@nameProbe "))
        window.probes.push(JSON.parse(s.slice(11)));
      log(...args);
    };
  });
  await page.goto(base + "/runtime/runner.html");
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({
      archiveURL,
      apiURL,
      deployed,
      modelUrl,
      initialName,
      contentVersion,
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
      const enc = new window.TextEncoder(),
        dec = new window.TextDecoder();
      const manifest = JSON.parse(
        dec.decode(files["native-learning-manifest.json"]),
      );
      if (
        manifest.profileMode !== "username" ||
        manifest.contentVersion !== contentVersion
      )
        throw Error("Native/backend profile or content version mismatch");
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
            Object.entries(project.exportFiles()).map(async ([n, f]) => [
              n,
              new Uint8Array(await f.arrayBuffer()),
            ]),
          ),
        );
      }
      let logic = dec
        .decode(files["NativeLogic.spx"])
        .replace(/onStart => \{hide\}\s*$/, "");
      logic += `
func nativeNameTestProbe() {println "@nameProbe",nativeCloudJSON(map[string]any{"phase":phase,"account":nativeCloudAccount,"ready":nativeCloudReady,"busy":nativeCloudBusy,"halted":nativeCloudHalted,"run":nativeCloudRun,"queue":len(nativeCloudQueue),"seq":nativeCloudSeq,"ack":nativeCloudAck,"deck":nativeDeck,"first":nativeWordIDs[nativeDeck[0]],"status":nativeCloudStatus,"nameBusy":nativeNameBusy,"nameGuest":nativeNameGuest,"nameHalted":nativeNameHalted,"observed":nativeNameObserved,"connected":nativeNameConnected})}
func nativeNameTestAnswer(result,mode int) {nativeWordIndex=nativeDeck[0]; nativeQuestionMode=mode; wordSerial++; nativeLearningAnswer(result)}
onStart => {hide}
`;
      files["NativeLogic.spx"] = enc.encode(logic);
      files["main.spx"] = enc.encode(
        dec.decode(files["main.spx"]) +
          `
onKey KeyF1, => {nativeLocalEnabled=false; nativeNameMode=true; nativeCloudURL=${JSON.stringify(apiURL)}; NativeLogic.nativeNamePoll(true)}
onKey KeyF2, => {NativeLogic.nativeNameTestProbe()}
onKey KeyF3, => {NativeLogic.nativeNameTestAnswer(2,0)}
onKey KeyF4, => {NativeLogic.nativeNameTestAnswer(1,1)}
onKey KeyF5, => {checkpoint++; WorldLogic.event("checkpoint")}
onKey KeyF6, => {phase=3; WorldLogic.event("fail")}
onKey KeyF7, => {phase=2; WorldLogic.event("finish")}
onKey KeyF9, => {Hero.invulnerable=999; Hero.py=0; Hero.vy=0}
onKey KeyF10, => {phase=4; NativeLogic.nativeReturnTitle()}
onKey KeyF11, => {nativeNameRefreshAt=0; NativeLogic.nativeNamePoll(true)}
`,
      );
      await window.initGame(
        Object.fromEntries(
          Object.entries(files).map(([n, v]) => [
            n,
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
      if (typeof window.xbuilder_set_username !== "function")
        throw Error("This runtime does not expose xbuilder_set_username");
      window.xbuilder_set_username(initialName);
      await window.startGame();
    },
    {
      archiveURL,
      apiURL,
      deployed: !!deployed,
      modelUrl,
      initialName,
      contentVersion: lexicon.contentVersion,
    },
  );
  await page.waitForTimeout(700);
}
async function tap(key) {
  await page.keyboard.press(key, { delay: 50 });
}
async function name(value) {
  await page.evaluate((v) => window.xbuilder_set_username(v), value);
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
  throw Error("name state timeout " + JSON.stringify(s));
}
try {
  await boot();
  await tap("F1");
  await page.waitForTimeout(1100);
  assert.equal(names.length, 0);
  assert.equal((await probe()).account, "");
  pass("empty runtime username stays guest without a session request");
  await tap("Enter");
  await tap("F9");
  await name("RunA");
  await page.waitForTimeout(1200);
  await tap("r");
  await tap("F9");
  assert.equal(names.length, 0);
  assert.equal((await probe()).account, "");
  await tap("F10");
  let s = await until((s) => s.ready && !s.busy && !s.nameBusy);
  const a = (await login("runa")).playerId;
  assert.equal(s.account, a);
  assert.equal(s.run, false);
  assert.equal(new Set(s.deck).size, 30);
  pass(
    "mid-run username arrival and R keep guest ownership; title automatically opens name profile",
  );
  const sameDeck = s.deck,
    prepareCount = prepares,
    nameCount = names.length;
  await name(" RUNA ");
  await tap("F1");
  await page.waitForTimeout(1100);
  s = await probe();
  assert.deepEqual(s.deck, sameDeck);
  assert.equal(prepares, prepareCount);
  assert.equal(names.length, nameCount);
  await tap("F11");
  await until((s) => !s.nameBusy);
  assert.equal(prepares, prepareCount);
  assert.deepEqual((await probe()).deck, sameDeck);
  pass(
    "same normalized name and token refresh keep deck without preparing it again",
  );
  await tap("Enter");
  await tap("F9");
  await tap("F3");
  await tap("F4");
  await tap("F5");
  await until((s) => !s.busy && s.queue === 0);
  let profile = JSON.parse(await store.read(a));
  const first = (await probe()).first;
  assert.equal(profile.words[first].spell.wrong, 1);
  assert.equal(profile.words[first].meaning.correct, 1);
  pass(
    "actual username session saves both abilities through normal native HTTP",
  );
  await name("RunB");
  await tap("r");
  await tap("F9");
  s = await probe();
  assert.equal(s.account, a);
  assert.equal(s.run, true);
  await tap("F6");
  await until((s) => !s.busy && s.queue === 0);
  await tap("F10");
  const b = (await login("runb")).playerId;
  s = await until((s) => s.account === b && s.ready && !s.busy);
  assert.deepEqual((await repo.load(b)).words, {});
  assert.equal(JSON.parse(await store.read(a)).words[first].spell.wrong, 1);
  pass(
    "rename takes effect at title, preserves old name archive and starts a separate new profile",
  );
  holdName = "runc";
  await name("RunC");
  await tap("F1");
  await until((s) => s.nameBusy);
  await name("RunD");
  await tap("F1");
  const d = (await login("rund")).playerId;
  await until((s) => s.account === d && s.ready && !s.busy);
  assert.ok(releaseName);
  releaseName();
  releaseName = null;
  await page.waitForTimeout(500);
  assert.equal((await probe()).account, d);
  pass("late username-session response cannot attach a previous name");
  await tap("g");
  await until((s) => s.account === "");
  await page.waitForTimeout(1300);
  assert.equal((await probe()).account, "");
  await tap("n");
  await until((s) => s.account === d && s.ready && !s.busy);
  await name("");
  await tap("F1");
  await until((s) => s.account === "");
  pass(
    "G stays guest, N reconnects, and runtime logout stops using the named profile",
  );
  await page.close();
  await boot("RunA");
  await tap("F1");
  s = await until((s) => s.halted);
  assert.match(s.status, /占用/);
  await tap("v");
  s = await until((s) => s.ready && !s.busy);
  assert.equal(s.account, a);
  profile = JSON.parse(await store.read(a));
  assert.equal(profile.words[first].spell.wrong, 1);
  pass(
    "new runtime with the same username restores cloud history after explicit writer takeover",
  );
  failName = "rune";
  await name("RunE");
  await tap("F1");
  await until((s) => s.status.includes("自动重试"));
  await tap("Enter");
  assert.equal((await probe()).phase, 0);
  const e = (await login("rune")).playerId;
  await until((s) => s.account === e && s.ready && !s.busy);
  assert.equal(names.filter((n) => n === "rune").length, 2);
  pass(
    "temporary name-session failure retries without starting on the previous profile",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("native-name-ready.png", folder)),
  });
  assert.deepEqual(await page.evaluate(() => window.gameErrors), []);
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (error) {
  report.failure = {
    name: error.name,
    message: error.message,
    source: error.stack
      ?.split("\n")
      .find((s) => s.includes("test-belfry-native-username.mjs")),
  };
  console.error(JSON.stringify(report.failure));
  process.exitCode = 1;
} finally {
  if (releaseName) releaseName();
  await browser.close();
  await new Promise((r) => fileServer.close(r));
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
  await rm(temp, { recursive: true, force: true });
  const filename = `native-name-${deployed ? "xbuilder" : "npm"}-${live ? "kodo" : "local"}.json`;
  await writeFile(
    new URL(filename, folder),
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
