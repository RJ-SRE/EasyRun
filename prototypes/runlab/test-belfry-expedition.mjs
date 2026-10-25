import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildExpeditionLayout } from "./belfry-expedition.mjs";
import { BANK, STORAGE_KEY } from "./public/inscription-core.js";
const layout = buildExpeditionLayout(),
  out = new URL("./test-results/expedition/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  scope:
    "Response fixtures position the player at real mechanisms, preserve all production inputs/physics/word rules, and remove combatants only to isolate tasks. This does not prove full-route playability or natural word coverage.",
};
page.on("pageerror", (e) => report.errors.push(e.message));
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  const node = (kind) =>
    layout.nodes.findIndex((n) => n.kind === kind && n.side < 0);
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func expeditionFixture(n int) {
 phase=1; segment=0; Hero.cancelAttack(); Hero.ultimateTime=0; Hero.healTime=0; chainOwner=-1; bindEnemy=-1; bindTime=0; hitStop=0
 for j:=0;j<len(enemyHP);j++ {if enemyType[j]!=6 {enemyHP[j]=0}}
 Hero.resetHero(nodeX[n],nodeY[n]); Hero.grounded=true; controlGrace=1
}
onKey KeyF7, => {expeditionFixture(${node("weight-left")})}
onKey KeyF8, => {expeditionFixture(${node("weight-right")})}
onKey KeyF9, => {expeditionFixture(${node("weight-route")})}
onKey KeyF10, => {Hero.resetHero(floorX[liftFloor[1]]+60,floorY[liftFloor[1]]); Hero.grounded=true; health=5}
onKey KeyF11, => {expeditionFixture(${node("lamp-start")})}
onKey KeyF12, => {expeditionFixture(lampStart+lampStep)}
onKey KeyY, => {i:=17; enemyHP[i]=4; enemyState[i]=3; enemyClock[i]=0; enemyX[i]=lampX; enemyY[i]=lampY; lampClock=1}
onKey KeyG, => {expeditionFixture(${node("circuit-a")}); Hero.px-=65; Hero.facing=90}
onKey KeyH, => {expeditionFixture(${node("circuit-b")})}
onKey KeyO, => {expeditionFixture(${node("circuit-c")})}
onKey KeyB, => {expeditionFixture(${node("bridge-pivot")})}
onKey KeyN, => {expeditionFixture(${node("bridge-exit")})}
onKey KeyP, => {expeditionFixture(${node("energy-choice")})}
onKey KeyZ, => {expeditionFixture(${node("vent")}); Hero.px=heatX[0]; Hero.py=heatY[0]+20; Hero.invulnerable=0; controlGrace=0; health=maxHealth; Hero.grounded=false; cityClock=3.6-heatOffset[0]}
onKey KeyX, => {expeditionFixture(${node("vent")})}
onKey Key8, => {expeditionFixture(${node("weight-decoy-left")}); i:=foremanIndex; clearEnemyMotion(i); enemyHP[i]=5; enemyState[i]=0; enemyClock[i]=0; enemyStep[i]=0; enemyMode[i]=0; Hero.invulnerable=0; controlGrace=0}
onKey KeyC, => {phase=1; segment=1; bossStage=2; bossShield=0; enemyHP[keeperIndex]=1; enemyState[keeperIndex]=2; enemyFlash[keeperIndex]=0; Hero.resetHero(480,worldBottom); hitEnemy(keeperIndex,3)}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const wait = (fn, timeout = 15000) => page.waitForFunction(fn, {}, { timeout });
const state = () => page.evaluate(() => window.latestState);
async function key(k) {
  await page
    .locator("iframe")
    .evaluate((f) =>
      f.contentWindow.document.querySelector("#game-canvas").focus(),
    );
  await page.keyboard.press(k, { delay: 70 });
}
async function fixture(k) {
  await key(k);
  await page.waitForTimeout(140);
}
async function pass(name, shot) {
  report.cases.push({ name, state: await state() });
  console.log("PASS", name);
  if (shot)
    await page.screenshot({ path: fileURLToPath(new URL(shot + ".png", out)) });
}
async function answer(correct = true) {
  const q = await page.evaluate(() => window.inscriptionDiagnostics.active.q),
    w = BANK.get(q.wordId);
  if (q.type === "spell")
    await page.keyboard.type(correct ? w.word : w.word[0] === "z" ? "x" : "z");
  else
    await page.keyboard.press(
      String(((q.options.indexOf(w.meaning) + (correct ? 0 : 1)) % 3) + 1),
    );
  await wait(() => window.latestState.phase === 1);
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4184/?words=on");
  await wait(() => window.latestState || window.runtimeErrors.length, 60000);
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
  await page.locator("#word-enabled").check();
  await page.locator("#play").click();
  await wait(() => window.latestState.phase === 1);
  assert.equal((await state()).expedition.room, 0);
  assert.match(await page.locator("#objective").innerText(), /折翼门廊/);
  await pass(
    "new map boots at a supported entry with its real room objective",
    "01-entry",
  );
  await fixture("F7");
  await wait(() => window.latestState.expedition.prompt >= 0);
  await key("f");
  await wait(() => window.latestState.expedition.flags[3] === 1);
  assert.equal((await state()).expedition.done[3], 0);
  await fixture("F8");
  await key("f");
  await wait(() => window.latestState.expedition.flags[3] === 3);
  await fixture("F9");
  await key("f");
  await wait(() => window.latestState.expedition.done[3] === 1);
  assert.equal((await state()).cityForge, 1);
  await pass(
    "two independently reachable latches enable the lift before the exit is released",
    "02-counterweight",
  );
  await fixture("F10");
  const lift = await state();
  await page.waitForFunction(
    (y) => Math.abs(window.latestState.y - y) > 30,
    lift.y,
    { timeout: 12000 },
  );
  const riding = await state();
  assert.equal(riding.expedition.room, 3);
  await key("Escape");
  await wait(() => window.latestState.phase === 4);
  const paused = await state();
  await page.waitForTimeout(260);
  assert.equal((await state()).y, paused.y);
  await key("Escape");
  await pass(
    "moving counterweight actually carries a passenger and pauses with the world",
  );
  await page.keyboard.down("u");
  await page.waitForTimeout(130);
  await page.keyboard.up("u");
  await wait(() => window.latestState.phase === 5);
  const frozen = await state();
  await page.waitForTimeout(300);
  assert.equal((await state()).y, frozen.y);
  assert.equal((await state()).elapsed, frozen.elapsed);
  await answer(false);
  assert.deepEqual((await state()).expedition.flags, frozen.expedition.flags);
  await pass(
    "word focus freezes moving geometry and failure cannot alter task progress",
  );
  await fixture("F11");
  await key("f");
  await wait(() => window.latestState.expedition.lampMoving === 1);
  const light = await state();
  await page.waitForFunction(
    (pos) =>
      Math.hypot(
        window.latestState.expedition.lampX - pos[0],
        window.latestState.expedition.lampY - pos[1],
      ) > 40,
    [light.expedition.lampX, light.expedition.lampY],
  );
  await key("y");
  await wait(
    () =>
      window.latestState.expedition.lampMoving === 0 &&
      window.latestState.expedition.lampStep === 0,
  );
  assert.equal((await state()).expedition.flags[7], 0);
  await pass(
    "a committed enemy strike returns the escort only to its last safe dock",
  );
  await fixture("F11");
  await key("f");
  await wait(() => window.latestState.expedition.lampMoving === 1);
  await key("Escape");
  await wait(() => window.latestState.phase === 4);
  const stopped = await state();
  await page.waitForTimeout(250);
  assert.equal((await state()).expedition.lampY, stopped.expedition.lampY);
  await key("Escape");
  for (let step = 1; step <= 3; step++) {
    await page.waitForFunction(
      (i) =>
        window.latestState.expedition.lampStep === i &&
        window.latestState.expedition.lampMoving === 0,
      step,
      { timeout: 15000 },
    );
    await fixture("F12");
    await key("f");
  }
  await wait(() => window.latestState.expedition.done[7] === 1);
  await pass(
    "archive lamp travels three real paths and waits at each supported dock",
    "03-lamp-arrival",
  );
  await fixture("G");
  await key("j");
  await wait(() => window.latestState.expedition.flags[13] === 1);
  assert.equal((await state()).expedition.done[13], 0);
  await fixture("H");
  await key("f");
  await wait(() => window.latestState.expedition.flags[13] === 3);
  await fixture("O");
  await key("f");
  await wait(() => window.latestState.expedition.done[13] === 1);
  await pass(
    "physical circuit targets accept actual melee or a close latch operation; all three are required",
    "04-circuits",
  );
  await fixture("B");
  await key("v");
  await wait(() => window.latestState.expedition.mirrorChoice === 2);
  await fixture("N");
  await key("f");
  await wait(() => window.latestState.expedition.done[11] === 1);
  await fixture("P");
  await key("f");
  await wait(() => window.latestState.cityChoice === 1);
  await pass(
    "bridge orientation and energy choice persist as distinct decisions",
    "05-choice",
  );
  const before = await state(),
    poolBefore = await page.evaluate(
      () => window.inscriptionDiagnostics.run.pool,
    );
  await page.reload();
  await wait(
    () => window.latestState?.phase === 0 || window.runtimeErrors.length,
    60000,
  );
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
  await page.locator("#word-continue").click();
  await wait(
    () =>
      window.latestState?.phase === 1 &&
      window.latestState.expedition?.mirrorChoice === 2,
    60000,
  );
  assert.deepEqual(
    await page.evaluate(() => window.inscriptionDiagnostics.run.pool),
    poolBefore,
  );
  assert.deepEqual((await state()).expedition.flags, before.expedition.flags);
  assert.equal((await state()).checkpoint, before.checkpoint);
  await pass(
    "reload restores room flags, bridge choice and checkpoint without rerolling the expedition",
  );
  const wordProgress = await page.evaluate(
    () => window.inscriptionDiagnostics.run.progress,
  );
  await key("Escape");
  await wait(() => window.latestState.phase === 4);
  await page.locator("#word-to-menu").click();
  await wait(() => window.latestState.phase === 0);
  await page.locator("#word-enabled").uncheck();
  await page.locator("#word-continue").click();
  await wait(
    () => window.latestState?.phase === 1 && window.latestState.wordMode === 0,
    60000,
  );
  assert.deepEqual((await state()).expedition.flags, before.expedition.flags);
  assert.deepEqual(
    await page.evaluate(() => window.inscriptionDiagnostics.run.progress),
    wordProgress,
  );
  assert.deepEqual(
    await page.evaluate(() => window.inscriptionDiagnostics.run.pool),
    poolBefore,
  );
  await pass(
    "pure action can resume the same expedition and preserves existing word outcomes without awarding new words",
  );
  await fixture("Z");
  await wait(() => window.latestState.health < window.latestState.maxHealth);
  await fixture("X");
  await key("f");
  await wait(() => window.latestState.expedition.flags[4] === 1);
  await pass(
    "active heat damages through real collision; vent can be shut down",
  );
  await fixture("8");
  await key("f");
  await wait(() => window.runEvents.some((e) => e.name === "weightcounter"));
  assert.equal(
    (await state()).chainOwner,
    -1,
    "a weight counter frees a chain already attached to the player",
  );
  const foreman = layout.rooms[5].foeStart + 2;
  await page.keyboard.down("u");
  await wait(() => window.latestState.bowCharge >= 0.6);
  await page.keyboard.up("u");
  await page.waitForFunction((i) => window.foes[i]?.hp < 5, foreman);
  await pass(
    "a real foreman chain strikes the baited weight, exposes recovery and can be punished by a real charged arrow",
    "06-foreman-counter",
  );
  await fixture("C");
  await wait(() => window.latestState.segment === 2);
  assert.equal((await state()).checkpoint, 14);
  assert((await state()).riseY < layout.keeperY - 300);
  assert.equal((await state()).health, (await state()).maxHealth - 1);
  await pass(
    "final keeper defeat starts the deep return with the selected energy consequence",
  );
  await page.reload();
  await wait(() => window.latestState?.phase === 0, 60000);
  await page.locator("#word-continue").click();
  await wait(
    () => window.latestState?.phase === 1 && window.latestState.segment === 2,
    60000,
  );
  assert.equal((await state()).wordMode, 0);
  assert.equal((await state()).bossHP, 0);
  assert.equal((await state()).checkpoint, 14);
  assert.deepEqual(
    await page.evaluate(() => window.inscriptionDiagnostics.run.progress),
    wordProgress,
  );
  await pass(
    "pure action return resumes after refresh with the Boss defeated and no fabricated vocabulary progress",
  );
  const legacy = await page.evaluate((key) => {
    const d = JSON.parse(localStorage.getItem(key));
    d.run.started = true;
    d.run.won = false;
    d.run.snapshot = {
      checkpoint: 2,
      segment: 0,
      elapsed: 42,
      score: 200,
      cityArchive: 1,
    };
    return {
      pool: d.run.pool,
      progress: d.run.progress,
      raw: JSON.stringify(d),
    };
  }, STORAGE_KEY);
  // Install after pagehide has saved the previous live session. Otherwise the
  // application's normal unload save correctly overwrites our test seed.
  await page.addInitScript(
    ({ key, raw }) => {
      if (!sessionStorage.getItem("expedition-legacy-seeded")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("expedition-legacy-seeded", "1");
      }
    },
    { key: STORAGE_KEY, raw: legacy.raw },
  );
  await page.reload();
  await wait(
    () => window.latestState?.phase === 0 || window.runtimeErrors.length,
    60000,
  );
  await page.locator("#word-continue").click();
  await wait(
    () =>
      window.latestState?.phase === 1 && window.latestState.checkpoint === 6,
    60000,
  );
  assert.deepEqual((await state()).expedition.sides, [0, 0, 0, 0, 0]);
  assert.deepEqual(
    await page.evaluate(() => window.inscriptionDiagnostics.run.pool),
    legacy.pool,
  );
  assert.deepEqual(
    await page.evaluate(() => window.inscriptionDiagnostics.run.progress),
    legacy.progress,
  );
  await pass(
    "a legacy save resumes at its matching new region, preserving pool/results without awarding side quests",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
} catch (error) {
  report.failure = String(error);
  report.failureState = await state();
  await page.screenshot({ path: fileURLToPath(new URL("failure.png", out)) });
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
