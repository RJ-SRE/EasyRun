import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { InscriptionBook, STORAGE_KEY } from "./public/inscription-core.js";
const browser = await chromium.launch({ headless: true });
const out = new URL("./test-results/inscription/", import.meta.url);
await mkdir(out, { recursive: true });
const url = process.env.RUNLAB_URL || "http://127.0.0.1:4177/";
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  note: "Real first platform, no world mutations. Faults are injected only into resource/storage/visibility APIs.",
};
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
try {
  const missing = await browser.newPage();
  await missing.route("**/cet4-words.js", (r) =>
    r.fulfill({ status: 404, body: "missing fixture" }),
  );
  await missing.goto(url);
  await missing.waitForFunction(
    () => window.latestState?.phase === 0,
    {},
    { timeout: 45000 },
  );
  assert.equal(await missing.locator("#word-load-error").count(), 1);
  await missing.locator("#play").click();
  await missing.waitForFunction(() => latestState.phase === 1);
  assert.equal(await missing.evaluate(() => latestState.wordMode), 0);
  assert.deepEqual(await missing.evaluate(() => runtimeErrors), []);
  await missing.close();
  pass(
    "missing word content falls back to an explicitly labelled playable action mode",
  );
  const blocked = await browser.newPage();
  await blocked.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked storage fixture");
    };
  });
  await blocked.goto(url);
  await blocked.waitForFunction(
    () => window.latestState?.phase === 0,
    {},
    { timeout: 45000 },
  );
  assert.equal(
    await blocked.evaluate(() => inscriptionDiagnostics.storageBlocked),
    true,
  );
  assert.match(await blocked.locator("#word-storage").innerText(), /导出/);
  await blocked.locator("#play").click();
  await blocked.waitForFunction(() => latestState.phase === 1);
  await blocked.close();
  pass("blocked storage is disclosed while play remains available");
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on("pageerror", (e) => report.errors.push(e.message));
  await p.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: new InscriptionBook(null, 4).serialize(),
  });
  await p.goto(url);
  await p.waitForFunction(
    () => window.latestState?.phase === 0,
    {},
    { timeout: 45000 },
  );
  await p.locator("#play").click();
  await p.waitForFunction(() => latestState.phase === 1);
  await p.keyboard.down("u");
  await p.waitForFunction(() => latestState.bowCharge >= 0.6);
  await p.keyboard.up("u");
  await p.waitForFunction(() => latestState.phase === 5);
  assert.equal(
    await p.evaluate(() => inscriptionDiagnostics.active.q.type),
    "spell",
  );
  await p.keyboard.press("Escape");
  for (const [width, height] of [
    [1440, 1000],
    [1280, 720],
  ]) {
    await p.setViewportSize({ width, height });
    const v = await p.locator("#viewport").boundingBox(),
      c = await p.locator(".word-focus-card").boundingBox();
    assert.ok(c.x >= v.x && c.x + c.width <= v.x + v.width + 1);
    assert.ok(
      c.width <= 480,
      "ritual must not expand into a screen-wide banner",
    );
    assert.ok(
      c.width * c.height <= v.width * v.height * 0.14,
      "the inscription must leave at least 86% of the scene unobscured",
    );
    await p.screenshot({
      path: fileURLToPath(new URL(`focus-${width}.png`, out)),
      style: "#word-pause{visibility:hidden!important}",
    });
  }
  pass(
    "two desktop viewports keep the compact inscription ribbon inside the game",
  );
  await p.keyboard.press("Escape");
  const before = await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    return inscriptionDiagnostics.active.elapsed;
  });
  await p.waitForTimeout(250);
  assert.equal(
    await p.evaluate(() => inscriptionDiagnostics.active.elapsed),
    before,
  );
  await p.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await p.evaluate(() => inscriptionDiagnostics.paused), true);
  await p.locator("#word-resume").click();
  pass(
    "background visibility pauses the challenge and requires a conscious resume",
  );
  const word = await p.evaluate(() => inscriptionDiagnostics.active.q.wordId);
  assert.equal(word, "create");
  await p.keyboard.type(word.slice(0, -1), { delay: 25 });
  await p.keyboard.down("e");
  await p.waitForFunction(
    () => latestState.phase === 1 && !inscriptionDiagnostics.active,
  );
  await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => latestState.hook), -1);
  assert.equal(await p.evaluate(() => inscriptionDiagnostics.count), 1);
  await p.keyboard.press("Space", { delay: 70 });
  await p.waitForFunction(() => latestState.y > 15); // a new key works while the last letter remains held
  await p.keyboard.up("e");
  await p.keyboard.down("e");
  await p.waitForFunction(() => latestState.hook >= 0);
  await p.keyboard.up("e");
  pass(
    "held final E cannot leak into grapple; a new jump responds before E is released",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  await p.close();
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
} finally {
  await writeFile(
    new URL("resilience.json", out),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
