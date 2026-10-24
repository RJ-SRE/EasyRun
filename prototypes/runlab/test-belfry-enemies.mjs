import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("./test-results/combat/", import.meta.url);
await mkdir(out, { recursive: true });
const b = await chromium.launch({ headless: true, channel: "chromium" }),
  p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const report = { cases: [], errors: [] };
const speechRequests = [];
p.on("request", (r) => {
  if (/belfry-(dialogue|director)\.js|\/audio\/(voice|v06)\//.test(r.url()))
    speechRequests.push(r.url());
});
await p.addInitScript(() =>
  localStorage.setItem(
    "belfry-audio-v2",
    JSON.stringify({ voice: 1, chatter: "chatty", subtitles: "both" }),
  ),
);
p.on("pageerror", (e) => report.errors.push(e.message));
const state = () => p.evaluate(() => latestState),
  events = () => p.evaluate(() => runEvents);
const tap = (k) => p.keyboard.press(k, { delay: 40 });
async function wait(f, t = 10000) {
  await p.waitForFunction(f, {}, { timeout: t });
}
async function practice() {
  if ((await state()).phase === 1) {
    await tap("Escape");
    await wait(() => latestState.phase === 4);
  }
  await p.locator("#practice").click();
  await wait(() => latestState.practice === 1 && latestState.elapsed < 0.4);
}
async function save(name) {
  report.cases.push({ name, state: await state(), events: await events() });
  console.log("PASS", name);
}
async function move(x) {
  for (let i = 0; i < 80; i++) {
    const s = await state();
    if (Math.abs(s.x - x) < 12) {
      await p.keyboard.up("a");
      await p.keyboard.up("d");
      return;
    }
    if (s.x < x) {
      await p.keyboard.up("a");
      await p.keyboard.down("d");
    } else {
      await p.keyboard.up("d");
      await p.keyboard.down("a");
    }
    await p.waitForTimeout(35);
  }
  throw new Error("move timeout");
}
try {
  await p.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177");
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  // Beyond the former reflective trigger and its 45-second successor:
  // idle exploration must not load or display character dialogue.
  await p.waitForTimeout(46500);
  assert.equal((await state()).health, 8);
  assert.equal((await state()).threats, 0);
  assert.equal(await p.locator("#dialogue").count(), 0);
  assert.equal(await p.evaluate(() => soundDiagnostics.dialogueEnabled), false);
  assert.deepEqual(speechRequests, []);
  await save(
    "safe idle never loads or displays dialogue despite old chatty preferences",
  );
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => soundDiagnostics.activeSources), 0);
  await save("pause clears effects and music");
  await practice();
  await move(370);
  await wait(() => runEvents.some((e) => e.name === "enemy_mimicslash"), 8000);
  await tap("k");
  // Wait for the physical dash before repositioning; telemetry can still show
  // the old target position immediately after the key press.
  await p.waitForTimeout(240);
  await move(350);
  await wait(
    () => runEvents.some((e) => e.name === "enemy_lunge" && e.kind === 4),
    10000,
  );
  await wait(
    () =>
      runEvents.some((e) => e.name === "enemy_lunge" && e.kind === 0) &&
      runEvents.some((e) => e.name === "enemy_wave") &&
      runEvents.some((e) => e.name === "enemy_web"),
    10000,
  );
  const modes = await events();
  assert.ok(modes.some((e) => e.name === "enemy_mimicslash"));
  assert.ok(modes.some((e) => e.name === "enemy_lunge" && e.kind === 4));
  assert.ok(modes.some((e) => e.name === "enemy_volley" && e.kind === 0));
  assert.ok(modes.some((e) => e.name === "enemy_lunge" && e.kind === 0));
  assert.ok(modes.some((e) => e.name === "enemy_web"));
  assert.ok(modes.some((e) => e.name === "enemy_wave"));
  await save("all four enemy patterns alternate; mimic responds to dash");
  await p.screenshot({ path: fileURLToPath(new URL("enemies.png", out)) });
  await practice();
  await move(620);
  // Remain in the weaver's aim while cutting incoming bolts; once the web opens,
  // its near endpoint is within the blade radius. No engine state writes.
  let cut = false;
  for (let i = 0; i < 180; i++) {
    const s = await state();
    if (s.phase !== 1) break;
    await tap("j");
    await p.waitForTimeout(90);
    if ((await events()).some((e) => e.name === "webcut")) {
      cut = true;
      break;
    }
  }
  assert.ok(cut, "weaver web must be severable with light attack");
  await save("player severs a live weaver web");
  await practice();
  await move(700);
  await p.keyboard.down("d");
  await wait(() => latestState.vx > 80);
  await p.keyboard.up("d");
  await p.waitForTimeout(160);
  const before = await p.evaluate(() => foes[6].hp);
  await tap("j");
  await p.waitForTimeout(300);
  assert.ok((await events()).some((e) => e.name === "armor"));
  assert.equal(await p.evaluate(() => foes[6].hp), before);
  await p.keyboard.down("l");
  await p.waitForTimeout(620);
  await p.keyboard.up("l");
  await p.waitForTimeout(350);
  assert.ok((await p.evaluate(() => foes[6].hp)) < before);
  await save("closed bell armor blocks light strike and accepts charged heavy");
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(speechRequests, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  await p.screenshot({ path: fileURLToPath(new URL("enemy-error.png", out)) });
} finally {
  report.final = {
    state: await state(),
    events: await events(),
    foes: await p.evaluate(() => foes),
  };
  await writeFile(
    new URL("enemies.json", out),
    JSON.stringify(report, null, 2),
  );
  await b.close();
}
