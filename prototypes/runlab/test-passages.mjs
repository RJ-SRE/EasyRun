import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("./test-results/passages/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = { date: new Date().toISOString(), cases: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const state = () => page.evaluate(() => passageState);
const tap = (k) => page.keyboard.press(k, { delay: 50 });
async function wait(f, t = 10000) {
  await page.waitForFunction(f, {}, { timeout: t });
}
async function save(name) {
  report.cases.push({ name, state: await state() });
  console.log("PASS", name);
}
try {
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4177") + "/passages.html",
  );
  await wait(() => passageState || passageErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => passageErrors), []);
  await page.waitForTimeout(250);
  await page.screenshot({ path: fileURLToPath(new URL("ready.png", out)) });
  await page.locator('[data-mode="1"]').click();
  await wait(() => passageState.difficulty === 1);
  await page.locator("#help").click();
  assert.ok(await page.locator("#sheet").isVisible());
  await page.locator("#close-sheet").click();
  await page.locator("#play").click();
  await wait(() => passageState.phase === 1);
  await save("difficulty and guide work without starting prematurely");
  await page.keyboard.down("e");
  await wait(() => passageState.pull > 0.1);
  await tap("Escape");
  await wait(() => passageState.phase === 4);
  await page.keyboard.up("e");
  const frozen = await state();
  await page.waitForTimeout(550);
  const after = await state();
  for (const k of [
    "x",
    "y",
    "pull",
    "worldTime",
    "elapsed",
    "foldTime",
    "cameraX",
    "cameraY",
  ])
    assert.equal(after[k], frozen[k]);
  await save("pause freezes pulling, moving mechanisms, clock and camera");
  await tap("Escape");
  await wait(() => passageState.phase === 1);
  await tap("r");
  await wait(() => passageState.elapsed < 0.3);
  await page.keyboard.down("e");
  await wait(() => passageState.fold === 1);
  await page.keyboard.up("e");
  assert.ok((await state()).foldTime <= 12.01);
  assert.ok((await state()).foldTime > 10);
  await save("holding a wall ring opens the timed bridge in trial mode");
  await page.locator("#map").click();
  await wait(() => passageState.phase === 4);
  assert.ok(await page.locator("#sheet svg").isVisible());
  await page.screenshot({ path: fileURLToPath(new URL("map.png", out)) });
  await page.locator("#close-sheet").click();
  await wait(() => passageState.phase === 1);
  await page.locator("#map").click();
  await wait(() => passageState.phase === 4);
  await tap("Escape");
  await wait(() => passageState.phase === 1);
  assert.ok(await page.locator("#sheet").isHidden());
  await save("map pauses and returns by button or Escape");
  await tap("r");
  await wait(() => passageState.fold === 0 && passageState.elapsed < 0.3);
  await page.keyboard.down("a");
  await page.waitForTimeout(550);
  await tap("Space");
  await page.waitForTimeout(230);
  await tap("Space");
  await page.keyboard.up("a");
  await page.waitForTimeout(100);
  assert.ok((await state()).wallJumps > 0);
  await save("rough wall supports a second wall jump");
  await tap("r");
  await wait(() => passageState.elapsed < 0.3);
  await page.keyboard.down("d");
  await page.waitForTimeout(1100);
  await page.keyboard.up("d");
  await wait(() => passageState.phase === 3);
  assert.equal((await state()).failReason, 1);
  assert.equal((await state()).fold, 0);
  await save(
    "unopened bridge is absent physically; missing it causes a real fall",
  );
  await page.locator("#play").click();
  await wait(() => passageState.phase === 1);
  assert.equal((await state()).checkpoint, 0);
  assert.equal((await state()).deaths, 1);
  assert.ok(Math.abs((await state()).x - 190) < 5);
  await save("checkpoint retry restores a solvable initial mechanism state");
  await page.keyboard.down("e");
  await wait(() => passageState.fold === 1);
  await page.keyboard.up("e");
  await page.keyboard.down("a");
  await page.waitForTimeout(500);
  await page.keyboard.up("a");
  await wait(
    () => passageState.foldTime === 0 || passageState.phase === 3,
    15000,
  );
  assert.equal((await state()).phase, 1);
  await save("fold bridge expires while player waits safely");
  await page.locator("#sound").click();
  assert.equal(
    await page.locator("#sound").getAttribute("aria-pressed"),
    "false",
  );
  await page.locator("#sound").click();
  await save("sound toggle");
  await page.locator("#full").click();
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => !!document.fullscreenElement));
  await page.evaluate(() => document.exitFullscreen());
  await page.reload();
  await wait(() => passageState || passageErrors.length, 45000);
  assert.ok(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("rupture-passages-v1")).some(
        (r) => r.result === "fail",
      ),
    ),
  );
  await save("failure record persists and fullscreen exits");
  await page.setViewportSize({ width: 1814, height: 678 });
  await page.waitForTimeout(180);
  const box = await page.locator("#viewport").boundingBox();
  assert.ok(box.y + box.height < 678);
  await page.screenshot({ path: fileURLToPath(new URL("compact.png", out)) });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.locator(".mobile").isVisible());
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await save("compact desktop fit and mobile keyboard notice");
  assert.deepEqual(await page.evaluate(() => passageErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  process.exitCode = 1;
  console.error(e);
  await page.screenshot({
    path: fileURLToPath(new URL("lifecycle-error.png", out)),
  });
} finally {
  await writeFile(
    new URL("lifecycle.json", out),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
