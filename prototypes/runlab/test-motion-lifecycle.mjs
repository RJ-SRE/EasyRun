import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
await mkdir(new URL("test-results/", import.meta.url), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage();
const report = { checks: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const state = () => page.evaluate(() => latestState);
const tap = async (key) => {
  await page.keyboard.press(key, { delay: 60 });
  await page.waitForTimeout(50);
};
try {
  await page.goto(
    new URL("/rupture.html", process.env.RUNLAB_URL || "http://127.0.0.1:4177/")
      .href,
  );
  await page.waitForFunction(
    () => latestState?.phase === 0,
    {},
    { timeout: 30000 },
  );
  await page.locator("#sound").click();
  await page.locator("#play").click();
  await page.keyboard.down("d");
  await page.waitForFunction(() => latestState.x > 625);
  await page.keyboard.up("d");
  await page.waitForTimeout(250);
  await tap("e");
  const captured = await state();
  assert.equal(captured.energy, 1);
  assert.ok(
    captured.rotorSpeed > 0 && captured.rotorSpeed < 230,
    "The rotor brakes progressively.",
  );
  assert.ok(captured.fxCount > 0, "Capture emits live world effects.");
  await tap("Escape");
  assert.equal((await state()).phase, 4);
  const paused = await state();
  await page.waitForTimeout(320);
  const held = await state();
  for (const field of [
    "elapsed",
    "x",
    "y",
    "cameraX",
    "cameraY",
    "fxCount",
    "rotorSpeed",
    "bridgeY",
  ])
    assert.equal(held[field], paused[field], `Pause must freeze ${field}`);
  report.checks.push(
    "Pause freezes motion, machinery and live particle lifetimes.",
  );
  await tap("r");
  await page.waitForTimeout(200);
  const reset = await state();
  assert.equal(reset.phase, 1);
  assert.equal(reset.x, 150);
  assert.equal(reset.fxCount, 0);
  assert.equal(reset.cameraX, 480);
  assert.equal(reset.rotorSpeed, 230);
  report.checks.push(
    "Retry cancels effects from the previous attempt and resets camera/rotor.",
  );
  await page.keyboard.down("Space");
  await page.waitForTimeout(190);
  await page.keyboard.up("Space");
  await page.waitForFunction(
    () => runEvents.some((e) => e.name === "land"),
    {},
    { timeout: 3000 },
  );
  // Events are immediate; state snapshots arrive at 16 Hz. Wait for the
  // subsequent snapshot instead of inspecting the pre-impact sample.
  await page.waitForFunction(
    () => latestState.bodyOffset < -0.2,
    {},
    { timeout: 1000 },
  );
  await page.waitForTimeout(1000);
  assert.equal((await state()).fxCount, 0);
  assert.ok(Math.abs((await state()).bodyOffset) < 0.1);
  report.checks.push(
    "Jump lands, compression settles, and water/mist particles retire.",
  );
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
} finally {
  await writeFile(
    new URL("test-results/motion-lifecycle.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report));
if (!report.passed) process.exitCode = 1;
