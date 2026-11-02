import { WORD_MODES, wordDifficulty } from "./public/word-selection.js";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  BANK,
  InscriptionBook,
  STORAGE_KEY,
} from "./public/inscription-core.js";
const out = new URL("./test-results/wordbook/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  p = await context.newPage();
const url = process.env.RUNLAB_URL || "http://127.0.0.1:4184/";
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  timings: {},
  note: "Actual menus, keyboard, file upload/download, browser storage. F12 fixture only supplies the end-of-run event.",
};
p.on("pageerror", (e) => report.errors.push(e.message));
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
const wait = (fn) => p.waitForFunction(fn, null, { timeout: 45000 });
const diag = () => p.evaluate(() => window.inscriptionDiagnostics);
await p.addInitScript(() => {
  const fetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const r = await fetch(...args);
    if (String(args[0]).includes("belfry.json")) {
      const json = r.json.bind(r);
      r.json = async () => {
        const data = await json();
        data["main.spx"] = data["main.spx"].replace(
          "onKey KeyT",
          'onKey KeyF12, => {phase=2; event("finish")}\nonKey KeyT',
        );
        return data;
      };
    }
    return r;
  };
});

try {
  const start = Date.now();
  await p.goto(url);
  await wait(
    () => window.latestState?.phase === 0 && window.inscriptionDiagnostics,
  );
  report.timings.readyMs = Date.now() - start;
  assert.equal((await diag()).coverage.total, 3816);
  assert.equal(await p.locator("#word-wordMode").inputValue(), "normal");
  await p.locator("#menu-settings").click();
  assert.notEqual(await p.locator("#word-advanced").getAttribute("open"), null);
  for (const [width, height] of [
    [1440, 1000],
    [1280, 720],
    [1024, 768],
  ]) {
    await p.setViewportSize({ width, height });
    const v = await p.locator("#viewport").boundingBox(),
      menu = await p.locator("#word-menu").boundingBox();
    assert.ok(
      menu.x >= v.x &&
        menu.x + menu.width <= v.x + v.width + 1 &&
        menu.y >= v.y &&
        menu.y + menu.height <= v.y + v.height + 1,
    );
    await p.screenshot({
      path: fileURLToPath(new URL(`menu-${width}.png`, out)),
    });
  }
  pass("full common bank and expedition settings fit three desktop sizes");
  await p.setViewportSize({ width: 1440, height: 1000 });
  for (const [index, mode] of WORD_MODES.entries()) {
    await p.locator("#word-wordMode").selectOption(mode);
    const d = await diag();
    assert.equal(new Set(d.pool).size, 30);
    if (mode !== "random")
      assert.ok(
        d.pool.every((id) => wordDifficulty(BANK.get(id)) === index + 1),
      );
  }
  await p.locator("#word-wordMode").selectOption("random");
  const preview = (await diag()).pool;
  await p.locator("#menu-close").click();
  await p.locator("#word-preview").click();
  assert.equal(await p.locator(".word-row").count(), 30);
  await p.locator("#word-filter").selectOption("all");
  assert.equal(await p.locator(".word-row").count(), 60);
  await p.locator("#word-more").click();
  assert.equal(await p.locator(".word-row").count(), 120);
  await p.locator("#word-search").fill("");
  await p.keyboard.type("cat");
  assert.equal(await p.evaluate(() => latestState.phase), 0);
  await p.locator("#word-search").fill("biodiversity");
  assert.ok(await p.locator(".word-row").count());
  assert.deepEqual((await diag()).pool, preview);
  assert.equal((await diag()).count, 0);
  await p.screenshot({ path: fileURLToPath(new URL("search.png", out)) });
  await p.locator("#word-search").fill("不存在的词条xyz");
  assert.equal(await p.locator(".word-row").count(), 0);
  pass(
    "level filters, full-bank pagination/search and preview never award progress",
  );
  await p.locator("#word-import-file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await wait(() =>
    document
      .querySelector("#word-import-status")
      .textContent.includes("未导入"),
  );
  assert.match(await p.locator("#word-import-status").textContent(), /未导入/);
  assert.equal(Object.keys((await diag()).history).length, 0);
  const incoming = new InscriptionBook(null, 3),
    now = Date.now();
  for (const [id] of [...BANK.entries()].slice(0, 80))
    incoming.data.history[id] = {
      seen: 5,
      wrong: 4,
      completed: false,
      spell: { attempts: 5, wrong: 4, recentFailures: 4, lastSeen: now },
      meaning: { attempts: 1, correct: 1, recentFailures: 0, lastSeen: now },
    };
  const upload = async (value) =>
    p.locator("#word-import-file").setInputFiles({
      name: "memory.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(value)),
    });
  await upload(incoming.data);
  await wait(() => Object.keys(inscriptionDiagnostics.history).length === 80);
  assert.match(await p.locator("#word-import-status").textContent(), /新增 80/);
  const imported = (await diag()).history;
  await upload(incoming.data);
  assert.deepEqual((await diag()).history, imported);
  await p.locator("#word-filter").selectOption("weak");
  await p.locator("#word-search").fill("");
  assert.equal(await p.locator(".word-row").count(), 60);
  assert.match(await p.locator("#word-memory-summary").textContent(), /80/);
  await p.screenshot({ path: fileURLToPath(new URL("memory.png", out)) });
  const download = p.waitForEvent("download");
  await p.locator("#word-export").click();
  const file = await download;
  const exported = JSON.parse(await readFile(await file.path(), "utf8"));
  assert.deepEqual(exported.history, imported);
  await p.locator("#word-close").click();
  await p.locator("#menu-settings").click();
  await p.locator("#word-shuffle").click();
  await p.locator("#menu-close").click();
  assert.equal((await diag()).pool.filter((id) => imported[id]).length, 6);
  pass(
    "invalid imports preserve records, valid imports merge idempotently, weak quota and export roundtrip work",
  );
  const pool = (await diag()).pool;
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  assert.deepEqual((await diag()).pool, pool);
  await p.keyboard.press("r");
  await wait(() => latestState.attempts >= 2);
  assert.deepEqual((await diag()).pool, pool);
  await p.keyboard.press("F12");
  await wait(() => latestState.phase === 2);
  await p.locator("#play").click();
  await wait(() => latestState.phase === 0);
  assert.notDeepEqual((await diag()).pool, pool);
  assert.equal((await diag()).run.started, false);
  assert.equal(await p.locator("#word-continue").isVisible(), false);
  pass(
    "start uses the preview, retry retains it, victory-to-new-adventure prepares a fresh group",
  );
  // Large real import crosses localStorage capacity without blocking combat with writes.
  const large = new InscriptionBook(null, 4);
  for (const [id] of BANK)
    large.data.history[id] = {
      seen: 4,
      wrong: 3,
      spell: {
        attempts: 4,
        wrong: 3,
        lastSeen: now,
        recentFailures: 3,
        errors: Array.from({ length: 4 }, () => ({
          at: now,
          type: "wrong",
          input: "abcdefghijklmnopqrstuvwx",
          choice: "",
          position: 4,
        })),
      },
      meaning: {
        attempts: 2,
        correct: 2,
        lastSeen: now,
        successDays: ["2026-10-25"],
      },
    };
  await p.locator("#word-preview").click();
  const importAt = Date.now();
  await upload(large.data);
  await wait(
    () =>
      Object.keys(inscriptionDiagnostics.history).length === 3816 &&
      !inscriptionDiagnostics.saving,
  );
  report.timings.largeImportMs = Date.now() - importAt;
  assert.equal((await diag()).storageBlocked, false);
  assert.equal(
    await p.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).storage,
      STORAGE_KEY,
    ),
    "indexeddb",
  );
  await p.reload();
  await wait(
    () =>
      window.latestState?.phase === 0 &&
      Object.keys(inscriptionDiagnostics.history).length === 3816,
  );
  assert.equal((await diag()).storageBlocked, false);
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  await p.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  const savedPool = (await diag()).pool;
  await p.locator("#word-to-menu").click();
  await wait(() => latestState.phase === 0);
  await p.locator("#menu-settings").click();
  await p.locator("#word-continue").click();
  await wait(() => window.latestState?.phase === 1);
  assert.deepEqual((await diag()).pool, savedPool);
  assert.equal(Object.keys((await diag()).history).length, 3816);
  pass(
    "3,816-word history persists through IndexedDB, full reload and awaited checkpoint continuation",
  );
  await p.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  await p.locator("#word-to-menu").click();
  await wait(() => latestState.phase === 0);
  await p.evaluate(() => {
    window.originalWordbookSet = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw Error("save failure fixture");
    };
  });
  await p.locator("#menu-settings").click();
  await p.locator("#word-continue").click();
  await wait(
    () =>
      inscriptionDiagnostics.storageBlocked && !inscriptionDiagnostics.saving,
  );
  assert.equal(await p.evaluate(() => latestState.phase), 0);
  await p.evaluate(() => {
    Storage.prototype.setItem = window.originalWordbookSet;
  });
  pass(
    "failed save prevents continuation reload and preserves the live journey",
  );
  const race = await context.newPage();
  await race.goto(url);
  await race.waitForFunction(() => window.inscriptionDiagnostics);
  const storageResult = await race.evaluate(async (key) => {
    const { persistBook, loadLargeBook } =
      await import("./inscription-storage.js");
    const large = JSON.stringify({ payload: "x".repeat(500000) }),
      small = JSON.stringify({ marker: "latest" });
    await Promise.all([persistBook(large), persistBook(small)]);
    return {
      raw: (await loadLargeBook()).raw,
      stored: localStorage.getItem(key),
    };
  }, STORAGE_KEY);
  assert.equal(JSON.parse(storageResult.raw).marker, "latest");
  await race.close();
  pass("queued large/small saves preserve write order");
  // In a fresh origin context, an unreadable DB pointer must never be overwritten.
  const failure = await browser.newPage();
  await failure.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ storage: "indexeddb", version: 2 }),
    );
    Object.defineProperty(window, "indexedDB", {
      value: {
        open() {
          throw Error("blocked fixture");
        },
      },
    });
  }, STORAGE_KEY);
  await failure.goto(url);
  await failure.waitForFunction(
    () => window.latestState?.phase === 0 && window.inscriptionDiagnostics,
    null,
    { timeout: 45000 },
  );
  assert.equal(
    await failure.evaluate(() => inscriptionDiagnostics.storageBlocked),
    true,
  );
  assert.equal(
    await failure.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).storage,
      STORAGE_KEY,
    ),
    "indexeddb",
  );
  await failure.close();
  pass(
    "unreadable large-history storage preserves its pointer and displays recovery guidance",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
} catch (e) {
  report.failure = e.stack;
  await p
    .screenshot({ path: fileURLToPath(new URL("failure.png", out)) })
    .catch(() => {});
  throw e;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
