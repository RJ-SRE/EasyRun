import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { buildHuntLayout } from "./belfry-hunt.mjs";
const layout = buildHuntLayout(),
  firstGate = layout.platforms[layout.rooms[5].gate][2];
const out = new URL("./test-results/belfry/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  cases: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
// Position-only fixtures isolate the elite exit and a live guard. Traversal,
// collision, checkpoint activation and enemy damage remain production code.
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `onKey KeyF6, => {Hero.resetHero(480,${firstGate + 100})}\nonKey KeyF7, => {i:=${layout.rooms[5].foeStart}; Hero.resetHero(enemyX[i]-45,enemyY[i]-34)}\nonKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const state = () => page.evaluate(() => latestState);
async function shot(n) {
  await page.screenshot({ path: fileURLToPath(new URL(n + ".png", out)) });
}
async function save(n) {
  report.cases.push({ name: n, state: await state() });
  console.log("PASS", n);
}
async function tap(k) {
  await page.keyboard.press(k, { delay: 80 });
  await page.waitForTimeout(90);
}
async function wait(f, timeout = 10000) {
  await page.waitForFunction(f, {}, { timeout });
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177/");
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.equal((await state()).phase, 0);
  await shot("ready");
  await page.locator('[data-mode="1"]').click();
  await wait(() => latestState.difficulty === 1);
  await save("difficulty selection");
  await page.locator("#help").click();
  assert.equal(await page.locator("#guide").isVisible(), true);
  await shot("guide");
  await page.locator("#close-guide").click();
  assert.equal((await state()).phase, 0);
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);
  assert.equal((await state()).maxHealth, 5);
  await save("start with chosen difficulty");
  await page.keyboard.down("e");
  await page.waitForTimeout(180);
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  await page.keyboard.up("e");
  await page.waitForTimeout(160);
  const frozen = await state();
  await page.waitForTimeout(650);
  const after = await state();
  for (const k of [
    "elapsed",
    "x",
    "y",
    "energy",
    "health",
    "riseY",
    "returnTime",
    "cameraY",
    "fxCount",
  ])
    assert.equal(after[k], frozen[k], `Pause must freeze ${k}`);
  await shot("paused");
  await save("pause freezes movement, camera, effects and combat");
  await tap("Escape");
  await wait(() => latestState.phase === 1);
  await page.locator("#help").click();
  await wait(() => latestState.phase === 4);
  await page.locator("#close-guide").click();
  await wait(() => latestState.phase === 1);
  await save("help pauses and resumes safely");
  await tap("r");
  await wait(() => latestState.checkpoint === 0 && latestState.elapsed < 1);
  await page.waitForTimeout(100);
  await tap("F6");
  await wait(() => latestState.checkpoint === 5);
  await page.waitForTimeout(900);
  const gate = await state();
  assert.equal(gate.phase, 1);
  assert.ok(Math.abs(gate.y - firstGate) < 2, JSON.stringify(gate));
  assert.equal(gate.expedition.done[5], 0);
  assert.equal(gate.checkpoint, 5);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down("s");
    await tap("Space");
    await page.keyboard.up("s");
    const s = await state();
    assert.ok(s.y >= firstGate, "Elite exit cannot be dropped through");
  }
  await shot("locked-gate");
  await save("locked gate blocks drop-through and checkpoint activates");
  // Position at a live guard; neither health nor damage is changed by fixture.
  await tap("F7");
  await wait(() => latestState.phase === 3, 45000);
  const failed = await state();
  assert.equal(failed.health, 0);
  assert.equal(failed.failReason, 1);
  await shot("failed");
  await save("real enemy damage causes failure");
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);
  const retried = await state();
  assert.equal(retried.checkpoint, 5);
  assert.equal(retried.health, 5);
  assert.equal(retried.deaths, 1);
  assert.ok(Math.abs(retried.y - layout.checkpoints[5][1]) < 2);
  assert.equal(retried.expedition.done[5], 0);
  await save("checkpoint retry retains gate and death state");
  await tap("r");
  await page.waitForTimeout(1100);
  const reset = await state();
  assert.equal(reset.checkpoint, 0);
  assert.equal(reset.kills, 0);
  assert.equal(reset.echoes, 0);
  assert.equal(reset.health, 5);
  assert.equal(reset.bossShield, 0);
  assert.equal(reset.bossStage, 0);
  assert.equal(reset.deaths, 0);
  assert.equal(reset.fxCount, 0);
  await shot("restart");
  await save("restart resets combat, progression and old effects");
  await page.locator("#fullscreen").click();
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => !!document.fullscreenElement));
  await page.evaluate(() => document.exitFullscreen());
  await save("fullscreen enters and exits");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "belfry-records.json");
  await download.saveAs(fileURLToPath(new URL("exported-records.json", out)));
  await save("local record export");
  await page.reload();
  await wait(() => latestState?.phase === 0 || runtimeErrors.length, 45000);
  assert.ok(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("easyrun-belfry-v1")).some(
        (r) => r.result === "fail",
      ),
    ),
  );
  await save("record survives reload");
  await page.setViewportSize({ width: 1814, height: 678 });
  await page.waitForTimeout(150);
  await shot("compact-desktop");
  const bounds = await page.locator("#viewport").boundingBox();
  assert.ok(
    bounds.y + bounds.height <= 678,
    "Game must fit compact desktop height",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.ok(await page.locator(".mobile-note").isVisible());
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await save("compact desktop and mobile notice");
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  process.exitCode = 1;
  console.error(e);
  await shot("lifecycle-error");
} finally {
  await writeFile(
    new URL("lifecycle.json", out),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
