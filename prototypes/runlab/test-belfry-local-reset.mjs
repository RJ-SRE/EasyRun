import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  InscriptionBook,
  BANK,
  STORAGE_KEY,
} from "./public/inscription-core.js";
const base = process.env.RUNLAB_URL || "http://127.0.0.1:4177";
const out = new URL(
  "../../docs/evidence/2026-11-01-local-reset/",
  import.meta.url,
);
await mkdir(out, { recursive: true });
const book = new InscriptionBook(null, 88);
for (const [id] of BANK)
  book.data.history[id] = {
    seen: 2,
    spell: { attempts: 1, wrong: 1, recentFailures: 1, lastSeen: Date.now() },
    meaning: { attempts: 1, correct: 1, lastSeen: Date.now() },
  };
const raw = book.serialize();
assert.ok(raw.length > 450000);
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const p = await context.newPage();
const report = { cases: [], errors: [], complete: false };
p.on("pageerror", (e) => report.errors.push(e.message));
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
const ready = (p) =>
  p.waitForFunction(
    () => window.latestState?.phase === 0 && window.inscriptionDiagnostics,
    null,
    { timeout: 90000 },
  );
const dbCurrent = (p) =>
  p.evaluate(async () => {
    const db = await new Promise((r, j) => {
      const q = window.indexedDB.open("easyrun-word-memory", 1);
      q.onsuccess = () => r(q.result);
      q.onerror = () => j(q.error);
    });
    return new Promise((r, j) => {
      const t = db.transaction("books"),
        q = t.objectStore("books").get("current");
      t.oncomplete = () => {
        db.close();
        r(q.result ?? null);
      };
      t.onabort = () => j(t.error);
    });
  });
try {
  await p.goto(base + "/runtime/runner.html");
  await p.evaluate(
    async ({ key, raw }) => {
      localStorage.setItem("unrelated-login", "keep");
      localStorage.setItem(key + "-backup", "backup");
      localStorage.setItem(key + "-before-import", "backup");
      localStorage.setItem("easyrun-menu-reduced", "true");
      localStorage.setItem(
        "belfry-audio-v2",
        JSON.stringify({ music: 0.2, sfx: 0.3 }),
      );
      const { persistBook } = await import("/inscription-storage.js");
      await persistBook(raw);
    },
    { key: STORAGE_KEY, raw },
  );
  await p.goto(base + "/?v=local-reset");
  await ready(p);
  assert.equal(
    await p.evaluate(() => Object.keys(inscriptionDiagnostics.history).length),
    3816,
  );
  const stale = await context.newPage();
  await stale.goto(base + "/?v=reset-stale");
  await ready(stale);
  await p.locator("#menu-settings").click();
  await p.locator("#word-reset").click();
  assert.equal(
    await p.locator("#local-reset-dialog").evaluate((e) => e.open),
    true,
  );
  await p.screenshot({ path: fileURLToPath(new URL("web-confirm.png", out)) });
  await p.keyboard.press("Escape");
  assert.equal(
    await p.locator("#local-reset-dialog").evaluate((e) => e.open),
    false,
  );
  assert.equal(
    await p.locator("#menu-settings").getAttribute("aria-expanded"),
    "true",
  );
  assert.equal(
    await p.evaluate(() => Object.keys(inscriptionDiagnostics.history).length),
    3816,
  );
  assert.notEqual(await dbCurrent(p), null);
  pass(
    "cancel closes only the confirmation and preserves full IndexedDB learning history",
  );
  // Force an abort in only the reset transaction, after its delete request.
  await p.evaluate(() => {
    const original = window.IDBObjectStore.prototype.delete;
    window.IDBObjectStore.prototype.delete = function (...args) {
      const req = original.apply(this, args);
      if (this.name === "books") {
        window.IDBObjectStore.prototype.delete = original;
        this.transaction.abort();
      }
      return req;
    };
  });
  await p.locator("#word-reset").click();
  await p.locator("#local-reset-confirm").click();
  await p.waitForFunction(() =>
    document
      .querySelector("#local-reset-status")
      .textContent.includes("未能完成"),
  );
  assert.notEqual(await dbCurrent(p), null);
  assert.equal(
    await p.evaluate(() => Object.keys(inscriptionDiagnostics.history).length),
    3816,
  );
  pass(
    "transaction failure retains the stored book and offers a visible retry",
  );
  // Queued large/small writes must drain before the clear, then never return.
  await p.evaluate(async () => {
    const { persistBook } = await import("/inscription-storage.js");
    window.resetQueuedWrites = Promise.all([
      persistBook(JSON.stringify({ payload: "x".repeat(500000) })),
      persistBook(JSON.stringify({ queued: true })),
    ]);
  });
  await p.locator("#local-reset-confirm").click();
  await p.waitForEvent("domcontentloaded");
  await ready(p);
  assert.equal(
    await p.evaluate(() => Object.keys(inscriptionDiagnostics.history).length),
    0,
  );
  assert.equal(await p.evaluate(() => window.learningRailDiagnostics.count), 0);
  assert.equal(await dbCurrent(p), null);
  const values = await p.evaluate(
    (key) => ({
      other: localStorage.getItem("unrelated-login"),
      backup: localStorage.getItem(key + "-backup"),
      before: localStorage.getItem(key + "-before-import"),
      audio: localStorage.getItem("belfry-audio-v2"),
      reduced: localStorage.getItem("easyrun-menu-reduced"),
      mode: document.querySelector("#word-wordMode").value,
      music: document.querySelector("#setting-music").value,
      sfx: document.querySelector("#setting-sfx").value,
    }),
    STORAGE_KEY,
  );
  assert.equal(values.other, "keep");
  assert.equal(values.backup, null);
  assert.equal(values.before, null);
  assert.equal(values.reduced, null);
  assert.equal(values.mode, "normal");
  assert.equal(Number(values.music), 0.75);
  assert.equal(Number(values.sfx), 0.85);
  pass(
    "confirmation drains queued writes, clears game-owned saves/backups/achievements/settings and reloads a fresh 30-word journey",
  );
  const resurrect = await stale.evaluate(async () => {
    try {
      const { persistBook } = await import("/inscription-storage.js");
      await persistBook(JSON.stringify({ old: "history" }));
      return true;
    } catch {
      return false;
    }
  });
  assert.equal(resurrect, false);
  assert.equal(await dbCurrent(p), null);
  pass(
    "stale second window cannot write its old book after the reset generation changes; unrelated storage remains intact",
  );
  await p.locator("#menu-settings").click();
  await p.locator("#word-reset").scrollIntoViewIfNeeded();
  await p.screenshot({ path: fileURLToPath(new URL("web-settings.png", out)) });
  for (const [width, height] of [
    [650, 650],
    [480, 640],
  ]) {
    await p.setViewportSize({ width, height });
    await p.locator("#word-reset").click();
    const b = await p.locator("#local-reset-dialog").boundingBox();
    assert.ok(
      b.x >= 0 &&
        b.y >= 0 &&
        b.x + b.width <= width + 1 &&
        b.y + b.height <= height + 1,
    );
    await p.screenshot({
      path: fileURLToPath(new URL(`web-confirm-${width}.png`, out)),
    });
    await p.keyboard.press("Escape");
  }
  pass("confirmation and controls stay visible at narrow window sizes");
  // Also cover a regular small localStorage book, with the same real confirmation.
  await p.evaluate(async (key) => {
    const { persistBook } = await import("/inscription-storage.js");
    await persistBook(JSON.stringify({ small: true }));
    localStorage.setItem(key + "-backup", "small-backup");
  }, STORAGE_KEY);
  await p.locator("#word-reset").click();
  await p.locator("#local-reset-confirm").click();
  await p.waitForEvent("domcontentloaded");
  await ready(p);
  assert.equal(
    await p.evaluate(() => Object.keys(inscriptionDiagnostics.history).length),
    0,
  );
  assert.equal(
    await p.evaluate((k) => localStorage.getItem(k + "-backup"), STORAGE_KEY),
    null,
  );
  pass(
    "the same control also clears small localStorage saves, not only large IndexedDB books",
  );
  const late = await p.evaluate(async () => {
    const { persistBook, clearLocalGameRecords } =
      await import("/inscription-storage.js");
    await persistBook(JSON.stringify({ before: true }));
    const result = await Promise.allSettled([
      clearLocalGameRecords(),
      persistBook(JSON.stringify({ staleQueued: true })),
    ]);
    return result.map((r) => r.status);
  });
  assert.deepEqual(late, ["fulfilled", "rejected"]);
  assert.equal(
    await p.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
    null,
  );
  assert.equal(await dbCurrent(p), null);
  pass(
    "a write queued after confirmation is fenced as well, even in the clearing tab before reload",
  );
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (e) {
  report.failure = e.stack;
  console.error(e);
  process.exitCode = 1;
} finally {
  await writeFile(
    new URL("web-reset.json", out),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
