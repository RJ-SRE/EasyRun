// Full packaged game, real IndexedDB, isolated persistent Chromium profile.
// Fault injection exists only in the test browser and source overlay.
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { join, resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
const base = process.env.RUNLAB_URL || "http://127.0.0.1:4177";
const deployed =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const profile = await mkdtemp(join(tmpdir(), "easyrun-local-game-"));
const archive = new URL("exports/belfry.xbp", import.meta.url);
const dbName = "easyrun.rupture.learning.v1";
const server = createServer((req, res) => {
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
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const archiveURL = `http://127.0.0.1:${server.address().port}/package.xbp`;
const report = {
  date: new Date().toISOString(),
  runtime: deployed ? "XBuilder cached compiler/resources" : "npm SPX 3.3.0",
  storage: "real browser IndexedDB, no cloud",
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  cases: [],
  errors: [],
  networkCalls: [],
  complete: false,
};
let context,
  page,
  target = "";
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
async function open() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: "chromium",
  });
}
async function boot(name = "LocalA") {
  page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("request", (r) => {
    if (
      /\/v1\/(session|view|prepare|batches)|qiniup\.com|kodo-.*qiniucs\.com/.test(
        r.url(),
      )
    )
      report.networkCalls.push(r.url());
  });
  await page.addInitScript(() => {
    window.localProbes = [];
    window.localGameErrors = [];
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* plain logs */
      }
      if (s.startsWith("@localProbe "))
        window.localProbes.push(JSON.parse(s.slice(12)));
      log(...args);
    };
  });
  await page.goto(base + "/runtime/runner.html");
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({ name, archiveURL, deployed, target }) => {
      window.onGameError((e) => window.localGameErrors.push(String(e)));
      window.onEngineCrash((e) => window.localGameErrors.push(String(e)));
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
      const files = window.fflate.unzipSync(
        new Uint8Array(await (await fetch(archiveURL)).arrayBuffer()),
      );
      const enc = new window.TextEncoder(),
        dec = new window.TextDecoder();
      const manifest = JSON.parse(
        dec.decode(files["native-learning-manifest.json"]),
      );
      if (
        manifest.storageMode !== "local" ||
        manifest.cloudEnabled ||
        manifest.apiURL
      )
        throw Error("Not a local-only package");
      let logic = dec
        .decode(files["NativeLogic.spx"])
        .replace(/onStart => \{hide\}\s*$/, "");
      logic += `
func nativeLocalTestIndex() int {if nativeLocalTestTarget=="" {nativeLocalTestTarget=nativeWordIDs[nativeDeck[0]]}; return nativeWordIdIndex[nativeLocalTestTarget]}
func nativeLocalTestProbe() {i:=nativeLocalTestIndex(); println "@localProbe",nativeCloudJSON(map[string]any{"reset":nativeLocalResetStage,"key":nativeLocalKey,"phase":phase,"ready":nativeLocalReady,"busy":nativeLocalBusy,"loading":nativeLocalLoading,"failed":nativeLocalFailed,"conflict":nativeLocalConflict,"bypass":nativeLocalBypass,"dirty":len(nativeLocalDirty),"metaDirty":nativeLocalMetaDirty,"revision":nativeLocalRevision,"callbacks":nativeLocalCallbackLive,"target":nativeLocalTestTarget,"spellWrong":nativeLearnWrong[i*2],"meaningCorrect":nativeLearnCorrect[i*2+1],"timeouts":nativeLearnTimeout[i*2],"ever":nativeLearnEver[i],"won":nativeLearnWon[i],"wins":nativeLearnWins,"group":nativeLearningGroup(i),"study":nativeStudySaved(),"studyValues":nativeStudyValues,"studyCount":nativeStudyCount,"settings":nativeLocalCurrentSettings(),"status":nativeLocalStatus,"cloudURL":nativeCloudURL})}
func nativeLocalTestAnswer(result,mode int) {nativeWordIndex=nativeLocalTestIndex(); nativeQuestionMode=mode; wordSerial++; nativeLearningAnswer(result)}
onStart => {hide}
`;
      const marker = 'profiles.Call("put",nativeLocalHeader(revision+1),key)';
      if (!logic.includes(marker))
        throw Error("Missing local transaction injection point");
      logic = logic.replace(
        marker,
        marker +
          '; if nativeLocalTestAbort {nativeLocalTestAbort=false; tx.Call("abort")}',
      );
      logic = logic.replace(
        'profiles.Call("put",header,key)',
        'profiles.Call("put",header,key); if nativeLocalTestAbort {nativeLocalTestAbort=false; tx.Call("abort")}',
      );
      files["NativeLogic.spx"] = enc.encode(logic);
      let main = dec
        .decode(files["main.spx"])
        .replace(
          "var (",
          "var (\n nativeLocalTestTarget string\n nativeLocalTestAbort bool",
        );
      main = main.replace(
        "initNativeLocal()",
        `initNativeLocal(); nativeLocalTestTarget=${JSON.stringify(target)}`,
      );
      main += `
onKey KeyF1, => {nativeLocalTestTarget=""; NativeLogic.nativeLocalTestIndex()}
onKey KeyF2, => {NativeLogic.nativeLocalTestProbe()}
onKey KeyF3, => {NativeLogic.nativeLocalTestAnswer(2,0)}
onKey KeyF4, => {NativeLogic.nativeLocalTestAnswer(1,1)}
onKey KeyF5, => {NativeLogic.nativeLocalTestAnswer(3,0)}
onKey KeyF6, => {nativeDone[0]=1; phase=2; WorldLogic.event("finish")}
onKey KeyF7, => {phase=4; NativeLogic.nativeReturnTitle()}
onKey KeyF9, => {Hero.invulnerable=999; Hero.py=0; Hero.vy=0}
onKey KeyF10, => {nativeLocalTestAbort=true}
onKey KeyF11, => {for n:=0;n<3;n++ {NativeLogic.nativeActivate(12)}}
onKey KeyF12, => {for n:=0;n<100;n++ {NativeLogic.nativeLocalTestAnswer(2,0)}}
`;
      files["main.spx"] = enc.encode(main);
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
        throw Error("Username bridge missing");
      window.xbuilder_set_username(name);
      await window.startGame();
    },
    { name, archiveURL, deployed: !!deployed, target },
  );
  await page.waitForTimeout(500);
}
async function tap(key, p = page) {
  await p.keyboard.press(key, { delay: 40 });
}
async function probe(p = page) {
  const n = await p.evaluate(() => window.localProbes.length);
  await tap("F2", p);
  await p.waitForFunction((n) => window.localProbes.length > n, n, {
    timeout: 10000,
  });
  return p.evaluate(() => window.localProbes.at(-1));
}
async function until(fn, p = page, timeout = 30000) {
  const end = Date.now() + timeout;
  let s;
  while (Date.now() < end) {
    s = await probe(p);
    if (fn(s)) return s;
    await p.waitForTimeout(70);
  }
  throw Error("local state timeout " + JSON.stringify(s));
}
async function saved(p = page) {
  return until(
    (s) =>
      s.ready &&
      !s.failed &&
      !s.busy &&
      !s.loading &&
      s.dirty === 0 &&
      !s.metaDirty &&
      s.callbacks === 0,
    p,
  );
}
async function readWord(key, p = page) {
  return p.evaluate(
    async ({ dbName, key, target }) =>
      new Promise((resolve, reject) => {
        const req = window.window.indexedDB.open(dbName, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction(["profiles", "words"], "readonly"),
            m = tx.objectStore("profiles").get(key),
            w = tx.objectStore("words").get(key + "\u001f" + target);
          tx.oncomplete = () => {
            db.close();
            resolve({
              header: m.result && JSON.parse(m.result),
              word: w.result && JSON.parse(w.result.body),
            });
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
    { dbName, key, target },
  );
}
const evidence = new URL(
  "../../docs/evidence/2026-11-01-local-reset/",
  import.meta.url,
);
async function click(x, y) {
  const b = await page.locator("#game-canvas").boundingBox();
  const scale = Math.min(b.width / 960, b.height / 600);
  await page.mouse.click(
    b.x + (b.width - 960 * scale) / 2 + x * scale,
    b.y + (b.height - 600 * scale) / 2 + y * scale,
    { delay: 80 },
  );
}
async function wordCount(key) {
  return page.evaluate(
    async ({ dbName, key }) => {
      const db = await new Promise((r, j) => {
        const q = window.indexedDB.open(dbName, 1);
        q.onsuccess = () => r(q.result);
        q.onerror = () => j(q.error);
      });
      return new Promise((r, j) => {
        const tx = db.transaction("words"),
          q = tx.objectStore("words").index("byProfile").count(key);
        tx.oncomplete = () => {
          db.close();
          r(q.result);
        };
        tx.onabort = () => j(tx.error);
      });
    },
    { dbName, key },
  );
}
try {
  await mkdir(evidence, { recursive: true });
  await open();
  await boot();
  let s = await saved();
  target = s.target;
  const keyA = s.key;
  await tap("F3");
  await tap("F4");
  s = await saved();
  const oldPage = page;
  assert.equal(s.studyCount, 1);
  await boot("LocalB");
  await saved();
  await tap("F4");
  const b = await saved();
  const keyB = b.key;
  await page.close();
  await boot();
  await saved();
  await page.evaluate(
    async ({ dbName, keyA }) => {
      localStorage.setItem("unrelated-login", "keep");
      const db = await new Promise((r) => {
        const q = window.indexedDB.open(dbName, 1);
        q.onsuccess = () => r(q.result);
      });
      await new Promise((r, j) => {
        const t = db.transaction("words", "readwrite");
        t.objectStore("words").put(
          { p: keyA, body: JSON.stringify({ id: "en:retired-test" }) },
          keyA + "\u001fen:retired-test",
        );
        t.oncomplete = r;
        t.onabort = () => j(t.error);
      });
      db.close();
    },
    { dbName, keyA },
  );
  await click(784, 430);
  await click(720, 495);
  await until((s) => s.reset === 1);
  await page.screenshot({
    path: fileURLToPath(new URL("native-confirm.png", evidence)),
  });
  await tap("Enter");
  assert.equal(
    (await probe()).reset,
    1,
    "Enter must not accidentally confirm destructive action",
  );
  await tap("Escape");
  assert.equal((await probe()).reset, 0);
  assert.equal(await wordCount(keyA), 2);
  pass(
    "actual settings button opens scoped confirmation; Enter is safe and Escape cancels without changing saved records",
  );
  await click(720, 495);
  await tap("F10");
  await click(810, 394);
  await until((s) => s.reset === 3);
  assert.equal(await wordCount(keyA), 2);
  assert.equal((await readWord(keyA)).word.s[2], 1);
  pass(
    "aborted reset rolls back deletion and header together; error panel offers retry, never false success",
  );
  await click(810, 394);
  await until((s) => s.reset === 4);
  s = await saved();
  assert.equal(s.spellWrong, 0);
  assert.equal(s.meaningCorrect, 0);
  assert.equal(s.studyCount, 0);
  assert.equal(s.wins, 0);
  assert.deepEqual(s.settings, [0, 0, 0, 1, 1, 75, 85, 0]);
  assert.equal(await wordCount(keyA), 0);
  assert.equal(await wordCount(keyB), 1);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("unrelated-login")),
    "keep",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("native-cleared.png", evidence)),
  });
  pass(
    "confirmed reset deletes active and retired words, achievements and progress; restores settings; preserves other user and unrelated storage",
  );
  await tap("F3", oldPage);
  const stale = await until((s) => s.conflict, oldPage);
  assert.equal(stale.failed, true);
  assert.equal(await wordCount(keyA), 0);
  pass(
    "monotonic reset revision rejects stale window writes and prevents deleted learning history from returning",
  );
  await click(650, 394);
  await page.screenshot({
    path: fileURLToPath(new URL("native-settings.png", evidence)),
  });
  await page.close();
  await boot();
  s = await saved();
  assert.equal(s.studyCount, 0);
  assert.equal(s.spellWrong, 0);
  assert.equal(await wordCount(keyA), 0);
  pass(
    "reopening the actual XBuilder engine restores the empty current profile with zero retained callbacks",
  );
  assert.deepEqual(await page.evaluate(() => window.localGameErrors), []);
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (error) {
  report.failure = {
    name: error.name,
    message: error.message,
    source: error.stack
      ?.split("\n")
      .find((s) => s.includes("test-belfry-native-reset.mjs")),
  };
  console.error(JSON.stringify(report.failure));
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  await new Promise((r) => server.close(r));
  await rm(profile, { recursive: true, force: true });
  const folder = new URL(
    `../../docs/evidence/${process.env.LOCAL_TEST_OUT || "2026-11-01-local-reset"}/`,
    import.meta.url,
  );
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL(
      deployed ? "native-local-xbuilder.json" : "native-local-npm.json",
      folder,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ complete: report.complete, cases: report.cases.length }),
  );
}
