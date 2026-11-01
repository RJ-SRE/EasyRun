// Full packaged game, real IndexedDB, isolated persistent Chromium profile.
// Fault injection exists only in the test browser and source overlay.
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
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
async function crash() {
  const rows = execFileSync("ps", ["-axo", "pid=,args="], {
    encoding: "utf8",
  }).split("\n");
  const own = rows.filter(
    (s) =>
      s.includes(`--user-data-dir=${profile}`) &&
      s.includes("--remote-debugging-pipe") &&
      !s.includes("--type="),
  );
  assert.equal(
    own.length,
    1,
    "identify only our isolated browser main process",
  );
  const pid = Number(own[0].trim().split(/\s+/)[0]);
  const disconnected = new Promise((r) =>
    context.browser().once("disconnected", r),
  );
  process.kill(pid, "SIGKILL");
  await disconnected;
  context = null;
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
func nativeLocalTestProbe() {i:=nativeLocalTestIndex(); println "@localProbe",nativeCloudJSON(map[string]any{"key":nativeLocalKey,"phase":phase,"ready":nativeLocalReady,"busy":nativeLocalBusy,"loading":nativeLocalLoading,"failed":nativeLocalFailed,"conflict":nativeLocalConflict,"bypass":nativeLocalBypass,"dirty":len(nativeLocalDirty),"metaDirty":nativeLocalMetaDirty,"revision":nativeLocalRevision,"callbacks":nativeLocalCallbackLive,"target":nativeLocalTestTarget,"spellWrong":nativeLearnWrong[i*2],"meaningCorrect":nativeLearnCorrect[i*2+1],"timeouts":nativeLearnTimeout[i*2],"ever":nativeLearnEver[i],"won":nativeLearnWon[i],"wins":nativeLearnWins,"group":nativeLearningGroup(i),"study":nativeStudySaved(),"studyValues":nativeStudyValues,"studyCount":nativeStudyCount,"settings":nativeLocalCurrentSettings(),"status":nativeLocalStatus,"cloudURL":nativeCloudURL})}
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
        const req = window.indexedDB.open(dbName, 1);
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
try {
  await mkdir(
    new URL(
      `../../docs/evidence/${process.env.LOCAL_TEST_OUT || "2026-11-01-learning-rails"}/`,
      import.meta.url,
    ),
    { recursive: true },
  );
  await open();
  await boot();
  let s = await saved();
  assert.equal(s.cloudURL, "");
  assert.equal(s.spellWrong, 0);
  target = s.target;
  const keyA = s.key;
  await tap("Enter");
  await tap("F9");
  await tap("F3");
  await tap("F4");
  s = await saved();
  assert.equal(s.spellWrong, 1);
  assert.equal(s.meaningCorrect, 1);
  assert.equal(s.ever, 1);
  const first = await readWord(keyA);
  assert.equal(first.word.s[2], 1);
  assert.equal(first.word.m[1], 1);
  assert.ok(first.header.study.unlocked[0] > 0);
  assert.equal(s.studyCount, 1);
  pass(
    "full local-only game atomically saves independent word abilities with zero live callback retention",
  );
  await context.setOffline(true);
  await tap("F5");
  s = await saved();
  assert.equal(s.timeouts, 1);
  await context.setOffline(false);
  pass(
    "already-loaded game saves through IndexedDB while browser network is offline",
  );
  await crash();
  await open();
  await boot();
  s = await saved();
  assert.equal(s.spellWrong, 1);
  assert.equal(s.meaningCorrect, 1);
  assert.equal(s.timeouts, 1);
  assert.ok(s.study.unlocked[0] > 0);
  assert.equal(s.studyValues[0], 1);
  pass(
    "SIGKILL of isolated browser after commit preserves history in a fresh game process",
  );
  await tap("Enter");
  await tap("F9");
  await tap("F6");
  s = await saved();
  assert.equal(s.wins, 1);
  await tap("F7");
  await tap("F10");
  const beforeAbort = await readWord(keyA);
  await tap("F3");
  s = await until((s) => s.failed && !s.busy && s.callbacks === 0);
  assert.equal(s.dirty, 1);
  assert.deepEqual(await readWord(keyA), beforeAbort);
  await tap("n");
  s = await saved();
  assert.equal(s.spellWrong, 2);
  assert.equal((await readWord(keyA)).word.s[2], 2);
  pass(
    "injected transaction abort changes neither header nor words; pending memory retries once without double counts",
  );
  // Hold a real IDB write transaction open with harmless reads, then kill the
  // browser before commit. Every put still targets only this test profile.
  const beforeCrash = await readWord(keyA);
  await page.evaluate(() => {
    window.localHoldTransaction = true;
    window.localHeld = false;
    const original = window.IDBObjectStore.prototype.put;
    window.IDBObjectStore.prototype.put = function (...args) {
      const result = original.apply(this, args);
      if (this.name === "words" && window.localHoldTransaction) {
        window.localHeld = true;
        const keep = () => {
          const r = this.get("__easyrun_test_hold__");
          r.onsuccess = () => {
            if (window.localHoldTransaction) keep();
          };
        };
        keep();
      }
      return result;
    };
  });
  await tap("F3");
  await page.waitForFunction(() => window.localHeld);
  await crash();
  await open();
  await boot();
  s = await saved();
  assert.equal(s.spellWrong, 2);
  assert.equal(s.wins, 1);
  assert.deepEqual(await readWord(keyA), beforeCrash);
  pass(
    "SIGKILL during a held real transaction rolls back header and word changes together",
  );
  const firstPage = page,
    baseState = s;
  await boot();
  const secondPage = page;
  await saved();
  await tap("F3", firstPage);
  await saved(firstPage);
  await tap("F4", secondPage);
  s = await until(
    (s) => s.conflict && s.failed && !s.busy && s.callbacks === 0,
    secondPage,
  );
  const shared = await readWord(keyA, secondPage);
  assert.equal(shared.word.s[2], baseState.spellWrong + 1);
  assert.equal(shared.word.m[1], baseState.meaningCorrect);
  pass(
    "two tabs use revision fencing; a stale tab cannot replace newer word state",
  );
  await firstPage.close();
  await secondPage.close();
  await boot("LocalB");
  s = await saved();
  const keyB = s.key;
  assert.notEqual(keyA, keyB);
  assert.equal(s.spellWrong, 0);
  await tap("Enter");
  await tap("F9");
  await tap("F4");
  await saved();
  assert.equal((await readWord(keyA)).word.s[2], 3);
  await page.close();
  await boot("");
  s = await saved();
  assert.notEqual(s.key, keyA);
  assert.notEqual(s.key, keyB);
  assert.equal(s.spellWrong, 0);
  const guestKey = s.key;
  await tap("Enter");
  await tap("F9");
  await tap("F3");
  await saved();
  await context.close();
  context = null;
  await open();
  await boot("");
  s = await saved();
  assert.equal(s.key, guestKey);
  assert.equal(s.spellWrong, 1);
  pass(
    "names and guest use isolated persistent profiles; guest history does not attach to a signed-in name",
  );
  await page.close();
  await boot("LocalA");
  s = await saved();
  await tap("F12");
  s = await saved();
  assert.equal(s.spellWrong, 103);
  assert.equal(s.callbacks, 0);
  pass(
    "100 answers coalesce into changed-word writes and all transient JS callbacks are released",
  );
  const beforeMigration = await readWord(keyA);
  await page.evaluate(
    async ({ dbName, key }) =>
      new Promise((resolve, reject) => {
        const req = window.indexedDB.open(dbName, 1);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("profiles", "readwrite"),
            store = tx.objectStore("profiles"),
            get = store.get(key);
          get.onsuccess = () => {
            const header = JSON.parse(get.result);
            delete header.selectionVersion;
            header.settings[1] = 2;
            header.settings[2] = 2;
            header.settings[3] = 2;
            header.revision++;
            store.put(JSON.stringify(header), key);
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
        req.onerror = () => reject(req.error);
      }),
    { dbName, key: keyA },
  );
  await page.close();
  await boot("LocalA");
  s = await saved();
  assert.equal(s.settings[1], 0);
  assert.equal(s.settings[2], 2);
  assert.equal(s.settings[3], 2);
  const migrated = await readWord(keyA);
  assert.equal(migrated.header.selectionVersion, 1);
  assert.equal(migrated.header.settings[1], 0);
  assert.deepEqual(migrated.word, beforeMigration.word);
  assert.equal(migrated.header.wins, beforeMigration.header.wins);
  pass(
    "legacy exam scope resets to normal, persists its migration marker and preserves all saved word abilities and other settings",
  );
  await tap("F11");
  s = await saved();
  assert.equal(s.settings[1], 3);
  await page.close();
  await boot("LocalA");
  s = await saved();
  assert.equal(s.settings[1], 3);
  assert.equal(s.spellWrong, 103);
  pass(
    "random selection survives restart as the fourth mode and shares the same learned-word profile",
  );
  const legacyKey = JSON.stringify([
    "easyrun.rupture",
    "local-v1",
    "username",
    "legacyc",
  ]);
  await page.evaluate(
    async ({ dbName, key, sourceHeader }) =>
      new Promise((resolve, reject) => {
        const request = window.indexedDB.open(dbName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(["profiles", "words"], "readwrite");
          const h = {
            ...sourceHeader,
            key,
            contentVersion: "cet46-2026-10-26.1-cloud-test",
            revision: 1,
            wins: 3,
          };
          tx.objectStore("profiles").put(JSON.stringify(h), key);
          for (const id of ["en:can", "en:quasar"]) {
            const body = {
              id,
              last: 2,
              ever: 1,
              won: 1,
              s: [3, 2, 1, 0, 0, 1, 1, 0],
              m: [4, 4, 0, 0, 0, 0, 1, 0],
              recovered: 1,
              recall: 2,
              review: 1,
            };
            tx.objectStore("words").put(
              { p: key, body: JSON.stringify(body) },
              key + "\u001f" + id,
            );
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    { dbName, key: legacyKey, sourceHeader: beforeMigration.header },
  );
  await page.close();
  target = "en:can";
  await boot("LegacyC");
  s = await saved();
  assert.equal(s.failed, false);
  assert.equal(s.spellWrong, 1);
  assert.equal(s.meaningCorrect, 0);
  assert.equal(s.wins, 3);
  assert.equal(s.won, 0);
  const migratedSense = await readWord(legacyKey);
  assert.match(migratedSense.header.contentVersion, /^common-ngsl-nawl/);
  assert.equal(JSON.parse(migratedSense.word.legacyMeaning).m[1], 4);
  assert.equal(migratedSense.word.s[1], 2);
  assert.ok(
    migratedSense.word.s[7] >= 0,
    "an overdue epoch-zero record must not round into an invalid negative timestamp",
  );
  assert.equal(migratedSense.word.m[1], 0);
  assert.ok(migratedSense.header.study.unlocked[0] > 0);
  pass(
    "old CET archive migrates to the new core: spelling and achievements survive; changed meaning evidence is archived and requires relearning",
  );
  target = "en:quasar";
  const retired = await readWord(legacyKey);
  assert.equal(retired.word.m[1], 4);
  target = "en:can";
  await page.close();
  await boot("LegacyC");
  s = await saved();
  const twice = await readWord(legacyKey);
  assert.equal(twice.word.legacyMeaning, migratedSense.word.legacyMeaning);
  assert.equal(s.meaningCorrect, 0);
  pass(
    "retired word rows remain intact in IndexedDB and reloading the migrated archive is idempotent",
  );
  await page.screenshot({
    path: fileURLToPath(
      new URL(
        `../../docs/evidence/${process.env.LOCAL_TEST_OUT || "2026-11-01-learning-rails"}/local-title.png`,
        import.meta.url,
      ),
    ),
  });
  assert.deepEqual(await page.evaluate(() => window.localGameErrors), []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.networkCalls, []);
  report.complete = true;
} catch (error) {
  report.failure = {
    name: error.name,
    message: error.message,
    source: error.stack
      ?.split("\n")
      .find((s) => s.includes("test-belfry-native-local.mjs")),
  };
  console.error(JSON.stringify(report.failure));
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  await new Promise((r) => server.close(r));
  await rm(profile, { recursive: true, force: true });
  const folder = new URL(
    `../../docs/evidence/${process.env.LOCAL_TEST_OUT || "2026-11-01-learning-rails"}/`,
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
