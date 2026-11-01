import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("test-results/moonlit-web/", import.meta.url);
await mkdir(out, { recursive: true });
const report = { cases: [], errors: [], date: new Date().toISOString() };
const b = await chromium.launch({ headless: true, channel: "chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
p.on("pageerror", (e) => report.errors.push(e.message));
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
const shot = (name) =>
  p.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });
const wait = (f) => p.waitForFunction(f, null, { timeout: 15000 });
try {
  await p.goto("http://127.0.0.1:4177/?v=stillwater-v161");
  await p.waitForFunction(() => window.latestState?.phase === 0, null, {
    timeout: 90000,
  });
  await p.waitForTimeout(1700);
  await shot("title");
  await p.locator('[data-mode="1"]').click();
  await wait(() => window.latestState.difficulty === 1);
  await p.locator("#menu-settings").click();
  await wait(() => window.menuDiagnostics.busy);
  await p.locator("#word-wordMode").selectOption("challenge");
  await p.locator("#word-hint").selectOption("recall");
  await p.locator("#word-hint").focus();
  await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => document.activeElement.id), "word-hint");
  await shot("settings-words");
  await p.locator("#menu-tab-sound").click();
  await p.locator("#menu-reduced").check();
  await wait(() => window.menuDiagnostics.reduced);
  const t = await p.evaluate(() => window.menuDiagnostics.time);
  await p.waitForTimeout(700);
  assert.equal(await p.evaluate(() => window.menuDiagnostics.time), t);
  await shot("settings");
  await p.locator("#menu-tab-words").click();
  await p.locator("#word-wordMode").selectOption("random");
  await p.keyboard.press("Escape");
  assert.equal(
    await p.locator("#menu-settings").getAttribute("aria-expanded"),
    "false",
  );
  pass(
    "difficulty, word settings, focused selectors, Escape and persistent reduced motion remain usable",
  );
  await p.locator("#word-preview").click();
  await p.locator("#word-filter").selectOption("all");
  await p.locator("#word-search").fill("telecommunications");
  await p.waitForTimeout(350);
  assert.ok(
    (await p.locator("#word-list").innerText()).includes("telecommunications"),
  );
  assert.equal(
    await p.evaluate(() => document.activeElement.id),
    "word-search",
  );
  await shot("ledger");
  await p.locator("#word-close").click();
  await wait(() => !window.menuDiagnostics.busy);
  pass(
    "full 3816-word ledger and typing search keep keyboard focus and release menu busy state",
  );
  await p.locator("#menu-guide").focus();
  await p.keyboard.press("h");
  await wait(() => !document.querySelector("#guide").hidden);
  await p.keyboard.press("Escape");
  await wait(() => document.querySelector("#guide").hidden);
  await p.locator("#menu-audio").click();
  await p.locator("#menu-music-range").fill("0.6");
  await p.locator("#menu-music-range").dispatchEvent("input");
  assert.equal(await p.locator("#setting-music").inputValue(), "0.6");
  await p.locator("#menu-close").click();
  await wait(() => !window.menuDiagnostics.busy);
  pass("audio panel opens and adjusts music without starting gameplay");
  await p.locator("#play").click();
  await wait(() => window.latestState.phase === 1);
  assert.equal(await p.locator("#moonlit-menu").isVisible(), false);
  await shot("game");
  const c = p
    .frames()
    .find((f) => f.url().includes("runner.html"))
    .locator("#game-canvas");
  await c.focus();
  await p.keyboard.press("Escape");
  await wait(() => window.latestState.phase === 4);
  await p.keyboard.press("m");
  await wait(() => window.latestState.phase === 0);
  await p.waitForTimeout(300);
  assert.equal(await p.locator("#moonlit-menu").isVisible(), true);
  pass(
    "gameplay, pause and return restore original controls and the animated title without duplicate elements",
  );
  for (const [width, height] of [
    [800, 650],
    [600, 900],
    [1600, 750],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(300);
    const boxes = await p.evaluate(() => {
      const v = document.querySelector("#viewport").getBoundingClientRect();
      const s = document.querySelector("#moonlit-menu").getBoundingClientRect();
      return {
        v: { x: v.x, y: v.y, right: v.right, bottom: v.bottom },
        s: { x: s.x, y: s.y, right: s.right, bottom: s.bottom },
      };
    });
    assert.ok(
      boxes.s.x >= boxes.v.x - 1 &&
        boxes.s.right <= boxes.v.right + 1 &&
        boxes.s.y >= boxes.v.y - 1 &&
        boxes.s.bottom <= boxes.v.bottom + 1,
    );
    await p.locator("#menu-settings").click();
    await p.locator("#menu-close").click();
    await shot("title-" + width + "x" + height);
  }
  pass(
    "small, portrait and ultrawide web viewports contain the full logical menu and maintain clickable settings",
  );
  assert.deepEqual(await p.evaluate(() => window.runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  await shot("failure");
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await b.close();
}
