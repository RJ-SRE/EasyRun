// Own random storage keys / temporary browser profile only. Never inspect the
// platform's account storage. Native probes run in minimal synthetic projects.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";

const base = process.env.RUNLAB_URL || "http://127.0.0.1:4177";
const deployed =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const profile = await mkdtemp(join(tmpdir(), "easyrun-storage-audit-"));
const key = "easyrun-audit-" + randomBytes(12).toString("hex");
const report = {
  date: new Date().toISOString(),
  runtime: deployed
    ? "XBuilder cached 2026-10-26 compiler/resources"
    : "pinned npm SPX 3.3.0",
  browser: {},
  native: [],
  complete: false,
};
const assets = createServer((req, res) => {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
  });
  createReadStream(join(deployed, basename(req.url))).pipe(res);
});
if (deployed) await new Promise((r) => assets.listen(0, "127.0.0.1", r));
const assetsBase = deployed
  ? `http://127.0.0.1:${assets.address().port}/`
  : "/runtime/";
let context;
async function open() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: "chromium",
  });
  return context.newPage();
}
async function nativeProbe(name, source) {
  const page = await context.newPage(),
    result = { name, messages: [], error: null };
  page.on("console", (m) => {
    if (m.text().includes("STORAGE_PROBE")) result.messages.push(m.text());
  });
  page.on("pageerror", (e) => result.messages.push(e.message));
  try {
    await page.goto(base + "/runtime/runner.html");
    await page.evaluate(
      async ({ source, assetsBase, deployed }) => {
        window.onGameError((e) =>
          console.error("STORAGE_PROBE_GAME_ERROR", String(e)),
        );
        await window.initEngine(
          Object.fromEntries(
            [
              "engine.zip",
              deployed ? "engineres.zip" : "game.zip",
              "engine.wasm",
              "ispx.wasm",
            ].map((n) => [n, assetsBase + n]),
          ),
        );
        const file = (s) => ({
          content: new window.TextEncoder().encode(s).buffer,
          lastModified: Date.now(),
        });
        await window.initGame({
          "main.spx": file(source),
          "assets/index.json": file(
            JSON.stringify({
              name: "Storage capability probe",
              zorder: [],
              run: { width: 480, height: 360 },
            }),
          ),
        });
        await window.startGame();
      },
      { source, assetsBase, deployed: !!deployed },
    );
    await page.waitForTimeout(500);
  } catch (error) {
    result.error = error.message.slice(0, 1600);
  }
  await page.close();
  report.native.push(result);
  console.log(JSON.stringify(result));
}
try {
  let page = await open();
  await page.goto(base + "/runtime/runner.html");
  await page.evaluate(async (key) => {
    localStorage.setItem(key, "saved-before-browser-restart");
    await new Promise((resolve, reject) => {
      const req = window.indexedDB.open(key, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("pending");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("pending", "readwrite");
        tx.objectStore("pending").put({ eventSeq: 7 }, "batch");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, key);
  await context.close();
  page = await open();
  await page.goto(base + "/runtime/runner.html");
  const restored = await page.evaluate(
    async (key) => ({
      localStorage: localStorage.getItem(key),
      indexedDB: await new Promise((resolve, reject) => {
        const req = window.indexedDB.open(key, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("pending", "readonly"),
            read = tx.objectStore("pending").get("batch");
          read.onsuccess = () => {
            const result = read.result;
            tx.oncomplete = () => {
              db.close();
              resolve(result);
            };
          };
          read.onerror = () => reject(read.error);
        };
      }),
    }),
    key,
  );
  assert.equal(restored.localStorage, "saved-before-browser-restart");
  assert.equal(restored.indexedDB.eventSeq, 7);
  report.browser = {
    actualBrowserProcessRestart: true,
    localStorageRestored: true,
    indexedDBRestored: true,
    origin: new URL(base).origin,
  };
  await page.close();
  await nativeProbe(
    "syscall/js localStorage",
    `import "syscall/js"\nonStart => {s:=js.Global().Get("localStorage"); s.Call("setItem",${JSON.stringify(key + "-native")},"native-saved"); println "STORAGE_PROBE_JS",s.Call("getItem",${JSON.stringify(key + "-native")}).String()}`,
  );
  await context.close();
  page = await open();
  await page.close();
  await nativeProbe(
    "syscall/js localStorage after browser restart",
    `import "syscall/js"\nonStart => {s:=js.Global().Get("localStorage"); println "STORAGE_PROBE_JS_REOPEN",s.Call("getItem",${JSON.stringify(key + "-native")}).String()}`,
  );
  report.browser.nativeLocalStorageRestoredAfterProcessRestart = report.native
    .at(-1)
    .messages.some((s) => s.includes("STORAGE_PROBE_JS_REOPEN native-saved"));
  const nativeDB = key + "-native-db";
  await nativeProbe(
    "syscall/js IndexedDB write",
    `import "syscall/js"
onStart => {
 req:=js.Global().Get("indexedDB").Call("open",${JSON.stringify(nativeDB)},1)
 req.Set("onupgradeneeded",js.FuncOf(func(this js.Value,args []js.Value) any {req.Get("result").Call("createObjectStore","pending"); return nil}))
 req.Set("onsuccess",js.FuncOf(func(this js.Value,args []js.Value) any {
  db:=req.Get("result"); tx:=db.Call("transaction","pending","readwrite"); tx.Call("objectStore","pending").Call("put","native-db-saved","batch")
  tx.Set("oncomplete",js.FuncOf(func(this js.Value,args []js.Value) any {db.Call("close"); println "STORAGE_PROBE_IDB_WRITE committed"; return nil})); return nil
 }))
}`,
  );
  await context.close();
  page = await open();
  await page.close();
  await nativeProbe(
    "syscall/js IndexedDB read after browser restart",
    `import "syscall/js"
onStart => {
 req:=js.Global().Get("indexedDB").Call("open",${JSON.stringify(nativeDB)},1)
 req.Set("onsuccess",js.FuncOf(func(this js.Value,args []js.Value) any {
  db:=req.Get("result"); tx:=db.Call("transaction","pending","readonly"); read:=tx.Call("objectStore","pending").Call("get","batch")
  read.Set("onsuccess",js.FuncOf(func(this js.Value,args []js.Value) any {println "STORAGE_PROBE_IDB_REOPEN",read.Get("result").String(); db.Call("close"); return nil})); return nil
 }))
}`,
  );
  report.browser.nativeIndexedDBRestoredAfterProcessRestart = report.native
    .at(-1)
    .messages.some((s) =>
      s.includes("STORAGE_PROBE_IDB_REOPEN native-db-saved"),
    );
  assert.equal(
    report.browser.nativeLocalStorageRestoredAfterProcessRestart,
    true,
  );
  assert.equal(report.browser.nativeIndexedDBRestoredAfterProcessRestart, true);
  const path = "/tmp/" + key + ".json";
  await nativeProbe(
    "os.WriteFile same-run",
    `import "os"\nonStart => {err:=os.WriteFile(${JSON.stringify(path)},[]byte("native-file-saved"),0600); b,readErr:=os.ReadFile(${JSON.stringify(path)}); println "STORAGE_PROBE_FILE_WRITE",err,string(b),readErr}`,
  );
  await nativeProbe(
    "os.ReadFile fresh runtime",
    `import "os"\nonStart => {b,err:=os.ReadFile(${JSON.stringify(path)}); println "STORAGE_PROBE_FILE_REOPEN",string(b),err}`,
  );
  const cleanup = await context.newPage();
  await cleanup.goto(base + "/runtime/runner.html");
  await cleanup.evaluate(async (key) => {
    localStorage.removeItem(key);
    localStorage.removeItem(key + "-native");
    await new Promise((resolve, reject) => {
      const r = window.indexedDB.deleteDatabase(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const r = window.indexedDB.deleteDatabase(key + "-native-db");
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }, key);
  report.complete = true;
} finally {
  if (context) await context.close();
  if (deployed) await new Promise((r) => assets.close(r));
  await rm(profile, { recursive: true, force: true });
  const folder = new URL(
    "../../docs/evidence/2026-10-31-xbuilder-audit/",
    import.meta.url,
  );
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL(
      deployed
        ? "storage-capabilities-xbuilder.json"
        : "storage-capabilities-npm.json",
      folder,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ browser: report.browser, complete: report.complete }),
  );
}
