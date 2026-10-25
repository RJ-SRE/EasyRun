import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BANK } from "./public/inscription-core.js";

const out = new URL("./test-results/keeper/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  fixture:
    "Response-only scene arrangements isolate each production Boss move. Actual player inputs, collisions, transform thresholds, rendering and word lifecycle run unchanged. This is not a full adventure or a human difficulty study.",
  cases: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func keeperFixture(stage,move int) {
 startRun(); segment=1; checkpoint=14; bossShield=0; sealLeft=true; sealRight=true; bossStage=stage
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0}
 i:=keeperIndex; clearEnemyMotion(i); enemyHP[i]=bossMaxHP-stage*(bossMaxHP/3); bossHP=enemyHP[i]
 enemyState[i]=0; enemyClock[i]=0; enemyX[i]=600; enemyY[i]=enemyBaseY[i]
 Hero.resetHero(380,enemyBaseY[i]-34); Hero.invulnerable=0; Hero.grounded=true
 if move>=0 {prepareKeeperMove(move)}
}
onKey KeyF8, => {keeperFixture(0,-1)}
onKey KeyF9, => {keeperFixture(0,0); Hero.px=490; keeperAim()}
onKey KeyF10, => {keeperFixture(0,1)}
onKey KeyF11, => {keeperFixture(0,2)}
onKey KeyF12, => {keeperFixture(1,3)}
onKey KeyG, => {keeperFixture(1,4)}
onKey KeyH, => {keeperFixture(1,5)}
onKey KeyO, => {keeperFixture(2,6)}
onKey KeyB, => {keeperFixture(0,-1); enemyHP[keeperIndex]=bossMaxHP*2/3+2; bossHP=enemyHP[keeperIndex]; Hero.px=530; keeperRest(8)}
onKey KeyN, => {keeperFixture(1,-1); enemyHP[keeperIndex]=bossMaxHP/3+2; bossHP=enemyHP[keeperIndex]; Hero.px=530; keeperRest(8)}
onKey KeyP, => {keeperFixture(2,-1); enemyHP[keeperIndex]=3; bossHP=3; Hero.px=530; keeperRest(8)}
onKey KeyZ, => {keeperFixture(0,-1); Hero.px=530; keeperRest(8)}
onKey KeyX, => {keeperFixture(2,-1); Hero.invulnerable=40}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const wait = (fn, timeout = 10000) => page.waitForFunction(fn, {}, { timeout });
const state = () => page.evaluate(() => latestState);
const snapshot = () =>
  page.evaluate(() => ({
    state: latestState,
    boss: Object.values(foes).find((f) => f.kind === 3),
    lines: keeperLines,
  }));
const pass = async (name) => {
  report.cases.push({ name, ...(await snapshot()) });
  console.log("PASS", name);
};
async function fixture(key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(130);
  assert.equal((await state()).phase, 1);
}
async function capture(name) {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, out)) });
}
async function heavy() {
  await page.keyboard.down("d");
  await page.waitForTimeout(20);
  await page.keyboard.up("d");
  await page.keyboard.down("l");
  await wait(() => latestState.chargeTime >= 0.6);
  await page.keyboard.up("l");
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4184/?words=off");
  await wait(() => window.latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.locator("#word-enabled").uncheck();
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);

  await fixture("F9");
  const health = (await state()).health;
  report.initial = await snapshot();
  console.log(
    "SWEEP baseline",
    health,
    report.initial.state.elapsed,
    report.initial.boss,
  );
  await wait(() => latestState.bossLocked === 1);
  await capture("01-armored-sweep-tell");
  assert.equal((await state()).health, health, "warning cannot damage");
  await wait(() => latestState.health === latestState.maxHealth - 1);
  await wait(() => latestState.bossState === 2);
  assert.equal(
    (await state()).health,
    health - 1,
    "one committed sweep cannot multihit",
  );
  await pass(
    "armored sweep warns, hits its capsule once, then exposes recovery",
  );

  await fixture("F10");
  await wait(() => latestState.bossLocked === 1);
  const aim = (await snapshot()).boss.aimX;
  await page.keyboard.down("Space");
  await page.keyboard.down("a");
  await page.waitForTimeout(160);
  await page.keyboard.up("a");
  assert.equal(
    (await snapshot()).boss.aimX,
    aim,
    "locked target must not follow later input",
  );
  await wait(() => latestState.bossState === 2);
  await page.keyboard.up("Space");
  assert.equal((await state()).health, health);
  await pass(
    "thrust commits its endpoint and a real jump avoids the swept body hit",
  );

  await fixture("F11");
  await wait(
    () =>
      latestState.bossState === 3 &&
      Object.values(foes).find((f) => f.kind === 3)?.clock > 0.18,
  );
  await page.keyboard.down("Space");
  await wait(() => latestState.bossState === 2);
  await page.keyboard.up("Space");
  assert.equal((await state()).health, health);
  await pass("jumping above the landing shock avoids slam damage");

  await fixture("F11");
  await wait(() => latestState.health < latestState.maxHealth);
  await wait(() => latestState.bossState === 2);
  assert.equal((await state()).health, health - 1);
  await pass(
    "standing on the marked landing is hit; slam has a longer punish window",
  );

  await fixture("F12");
  await wait(() => latestState.bossState === 3);
  await capture("02-hunter-fan");
  await wait(() => latestState.health < latestState.maxHealth);
  await pass("hunter fan produces real parryable projectiles with collision");

  await fixture("g");
  await wait(() => latestState.bossChain === 1 && latestState.bossState === 1);
  const follow = await state();
  assert.ok(follow.bossWindup >= 0.6);
  await capture("03-hunter-followup");
  await wait(() => latestState.bossState === 2);
  await pass(
    "cross-cut has a second independent anticipation and ends in recovery",
  );

  await fixture("h");
  const vaulted = await snapshot();
  assert.equal(vaulted.state.bossState, 5);
  await wait(() => latestState.bossState === 1);
  assert.ok((await snapshot()).boss.y > vaulted.boss.y + 50);
  await capture("04-hunter-dive");
  await wait(() => latestState.bossState === 2);
  await pass(
    "dive follows a visible rise, locked diagonal path and supported landing",
  );

  await fixture("o");
  await wait(() => latestState.bossLocked === 1);
  const rain = (await snapshot()).lines;
  const blades = Object.values(rain).filter((l) => l.life > 0 && l.style === 3);
  assert.equal(blades.length, 3);
  assert.ok(
    blades[1].delay > blades[0].delay && blades[2].delay > blades[1].delay,
  );
  await capture("05-core-rain");
  await page.keyboard.down("d");
  await page.waitForTimeout(240);
  await page.keyboard.up("d");
  await wait(() => latestState.bossState === 2);
  await page.keyboard.up("Space");
  assert.equal((await state()).health, health);
  await pass(
    "core blades arrive in three warned lanes with a traversable safe gap",
  );

  for (const [key, stage] of [
    ["b", 1],
    ["n", 2],
  ]) {
    await fixture(key);
    const epoch = (await state()).keeperEpoch;
    await heavy();
    await wait(() => latestState.bossState === 6);
    const transformed = await state();
    assert.equal(transformed.bossStage, stage);
    assert.equal(
      transformed.bossShield,
      0,
      "later forms must not replay the old locks",
    );
    assert.ok(transformed.keeperEpoch > epoch);
    assert.ok(
      Object.values((await snapshot()).lines).every((l) => l.life === 0),
    );
    await capture(`06-transform-${stage}`);
    await wait(() => latestState.bossState === 2);
    await pass(
      `real heavy damage enters form ${stage + 1}, clears old danger and leaves an opening`,
    );
  }

  await fixture("z");
  const shieldHP = (await state()).bossHP;
  await heavy();
  await page.waitForTimeout(400);
  assert.equal((await state()).bossShield, 0);
  assert.ok((await state()).bossHP < shieldHP);
  await pass("first form is directly vulnerable in recovery without exterior seals");

  await fixture("F8");
  const pressureStart = (await state()).elapsed;
  while ((await state()).elapsed - pressureStart < 14) {
    const s = await state();
    if (s.phase !== 1 || s.segment !== 1) break;
    if (s.ultimateTime <= 0) await page.keyboard.press("q", { delay: 65 });
    await page.waitForTimeout(85);
  }
  assert.ok(
    (await state()).bossHP > 0,
    "standing still and repeating Q must not erase all three forms",
  );
  report.stationaryUltimate = await snapshot();
  await pass(
    "stationary repeated ultimates do not erase the encounter; movement and attack windows matter",
  );

  await fixture("x");
  const start = (await state()).elapsed;
  const moves = new Set();
  const positions = [];
  while ((await state()).elapsed - start < 17) {
    const s = await snapshot();
    if (s.state.bossMove >= 0) moves.add(s.state.bossMove);
    positions.push([s.boss.x, s.boss.y]);
    await page.waitForTimeout(90);
  }
  assert.ok(moves.size >= 3, `autonomous selected moves: ${[...moves]}`);
  assert.ok(
    Math.max(...positions.map((p) => p[0])) -
      Math.min(...positions.map((p) => p[0])) >
      200,
  );
  assert.ok(
    Math.max(...positions.map((p) => p[1])) -
      Math.min(...positions.map((p) => p[1])) >
      150,
  );
  await pass(
    "autonomous core AI selects multiple attacks and actually changes horizontal and vertical position",
  );

  await fixture("p");
  await heavy();
  await wait(() => latestState.segment === 2);
  assert.equal((await state()).bossHP, 0);
  await pass("real final hit starts the return and clears Boss hazards");

  await fixture("p");
  for (let strike = 0; strike < 4 && (await state()).segment === 1; strike++) {
    await page.keyboard.press("j", { delay: 60 });
    await page.waitForTimeout(320);
  }
  await wait(() => latestState.segment === 2);
  await pass(
    "ordinary J combo can finish the exposed Boss without a skill or word gate",
  );

  // Enable words through the real setting in a new runtime, then stop the
  // production Boss during a live warning. No auto-answer goes into the game.
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4184/").split("?")[0] +
      "?words=on",
  );
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    45000,
  );
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.locator("#word-enabled").check();
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);
  assert.equal((await state()).wordMode, 1);
  await fixture("F11");
  await wait(() => latestState.bossLocked === 1);
  await page.keyboard.down("u");
  await page.waitForTimeout(70);
  await page.keyboard.up("u");
  await wait(() => latestState.phase === 5 && inscriptionDiagnostics.active);
  const frozen = await snapshot();
  await page.waitForTimeout(550);
  const still = await snapshot();
  assert.equal(still.state.elapsed, frozen.state.elapsed);
  assert.equal(still.state.health, frozen.state.health);
  assert.deepEqual(still.lines, frozen.lines);
  assert.equal(still.boss.x, frozen.boss.x);
  assert.equal(still.boss.y, frozen.boss.y);
  const q = await page.evaluate(() => inscriptionDiagnostics.active.q);
  const word = BANK.get(q.wordId);
  if (q.type === "spell")
    await page.keyboard.press(word.word[0] === "z" ? "x" : "z");
  else
    await page.keyboard.press(
      String(((q.options.indexOf(word.meaning) + 1) % 3) + 1),
    );
  await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
  assert.ok(
    await page.evaluate(() => runEvents.some((e) => e.name === "skillcancel")),
  );
  assert.equal((await state()).health, frozen.state.health);
  await pass(
    "word focus freezes all Boss trajectories; wrong answer cancels the skill with no accumulated damage",
  );

  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  report.failureState = await snapshot().catch(() => null);
  console.error(error.message);
  await capture("failure").catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
