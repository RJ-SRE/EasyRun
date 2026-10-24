import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("./test-results/skills/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: fileURLToPath(out), size: { width: 1440, height: 1000 } },
});
const report = {
  date: new Date().toISOString(),
  fixture:
    "Isolated arena arranged by test-only F8/F9/F10/F11 handlers; all player mechanics, collision, rendering and audio are the production code.",
  cases: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
// Inject deterministic scene arrangements into the test response only. These
// handlers are never written to the project or exported game.
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `\nfunc skillFixture() {
 startPractice(); health=5; embers=1; emberHits=0
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0; enemyBaseY[i]=-7000; enemyClock[i]=-100}
 enemyBaseX[0]=450; enemyBaseY[0]=45; enemyHP[0]=40; enemyClock[0]=-100
 Hero.resetHero(310,0); Hero.invulnerable=0
}
onKey KeyF8, => {skillFixture()}
onKey KeyF9, => {skillFixture(); enemyHP[0]=0; Hero.resetHero(480,500); Hero.grounded=false; Hero.vy=0; Hero.invulnerable=0}
onKey KeyF10, => {skillFixture(); enemyHP[0]=0; Hero.invulnerable=0}
onKey KeyF11, => {hurt(1)}
onKey KeyF6, => {skillFixture(); Hero.resetHero(480,250); Hero.grounded=false; Hero.invulnerable=0; enemyBaseX[0]=480; enemyBaseY[0]=60; floorX[0]=80; floorW[0]=800; floorY[0]=120; floorKind[0]=4}
// Opposite bob phases align these three foes at arrow height around full charge.
onKey KeyF7, => {skillFixture(); enemyBaseY[0]=19; enemyBaseX[3]=560; enemyBaseY[3]=45; enemyHP[3]=40; enemyClock[3]=-100; enemyBaseX[6]=680; enemyBaseY[6]=19; enemyType[6]=0; enemyHP[6]=40; enemyClock[6]=-100}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const state = () => page.evaluate(() => latestState);
const events = () => page.evaluate(() => runEvents);
const tap = (key, delay = 35) => page.keyboard.press(key, { delay });
const wait = (fn, timeout = 10000) => page.waitForFunction(fn, {}, { timeout });
async function fixture(key = "F8") {
  await tap(key);
  await page.waitForTimeout(180);
}
async function save(name) {
  report.cases.push({
    name,
    state: await state(),
    foes: await page.evaluate(() => foes),
  });
  console.log("PASS", name);
}
async function shot(key, ms = 650) {
  await page.keyboard.down(key);
  if (ms >= 550)
    await page.waitForFunction(
      (k) =>
        (k === "u" ? latestState.bowCharge : latestState.chargeTime) >= 0.6,
      key,
      { timeout: 5000 },
    );
  else await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177");
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.locator("#practice").click();
  await wait(() => latestState?.practice === 1);
  await fixture();
  await page.keyboard.down("u");
  await wait(() => latestState.bowCharge >= 0.6);
  assert.ok((await state()).bowCharge >= 0.55);
  await page.screenshot({
    path: fileURLToPath(new URL("bow-charge.png", out)),
  });
  await page.keyboard.up("u");
  await wait(
    () => runEvents.some((e) => e.name === "marked") && foes[0]?.mark > 0,
  );
  assert.ok((await page.evaluate(() => foes[0].mark)) > 0);
  assert.ok((await state()).bowCool > 2.4);
  const beforeHeavy = await page.evaluate(() => foes[0].hp);
  await shot("l");
  await wait(
    () => runEvents.some((e) => e.name === "markbreak") && foes[0]?.mark === 0,
  );
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => foes[0].hp), beforeHeavy - 5);
  assert.equal(await page.evaluate(() => foes[0].mark), 0);
  await save("full bow marks; charged blade consumes mark for five damage");
  await page.screenshot({
    path: fileURLToPath(new URL("mark-break.png", out)),
  });
  const casts = (await events()).filter((e) => e.name === "heavy").length;
  await shot("l", 150);
  await page.waitForTimeout(220);
  assert.equal(
    (await events()).filter((e) => e.name === "heavy").length,
    casts,
  );
  assert.equal((await state()).chargeTime, 0);
  await save("blade cooldown blocks repeated charging and release");
  await fixture();
  await shot("u", 60);
  await page.waitForTimeout(300);
  const shots = (await events()).filter((e) => e.name === "bowshot").length;
  await shot("u", 100);
  await page.waitForTimeout(120);
  assert.equal(
    (await events()).filter((e) => e.name === "bowshot").length,
    shots,
  );
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  const paused = await state();
  await page.waitForTimeout(500);
  assert.equal((await state()).bowCool, paused.bowCool);
  await tap("Escape");
  await wait(() => latestState.phase === 1);
  await wait(() => latestState.bowCool === 0);
  await shot("u", 65);
  await page.waitForTimeout(200);
  assert.equal(
    (await events()).filter((e) => e.name === "bowshot").length,
    shots + 1,
  );
  await save("bow cooldown is three active seconds and freezes on pause");
  await fixture("F7");
  await shot("u");
  await wait(() => foes[0]?.hp === 38 && foes[3]?.hp === 38);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => foes[6].hp), 40);
  assert.equal((await events()).filter((e) => e.name === "arrowhit").length, 2);
  await save(
    "charged arrow pierces two distinct targets and stops before the third",
  );
  await fixture("F6");
  await page.keyboard.down("s");
  await shot("u");
  await page.keyboard.up("s");
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => foes[0].hp), 40);
  assert.ok(!(await events()).some((e) => e.name === "arrowhit"));
  await save(
    "downward arrow is blocked by a closed platform before reaching the enemy",
  );
  await fixture();
  await page.keyboard.down("u");
  await page.waitForTimeout(260);
  await tap("k");
  await page.keyboard.up("u");
  await page.waitForTimeout(200);
  assert.equal((await state()).bowCool, 0);
  assert.equal((await state()).bowCharge, 0);
  assert.ok(!(await events()).some((e) => e.name === "bowshot"));
  await save(
    "dash cancels bow anticipation without firing or spending cooldown",
  );
  await fixture();
  await tap("j");
  await wait(
    () => latestState.attackKind === 1 && latestState.attackAge >= 0.12,
  );
  await tap("k");
  await tap("j");
  await page.waitForTimeout(420);
  const cuts = (await events()).filter((e) =>
    ["light1", "light2", "finisher", "aircut"].includes(e.name),
  );
  assert.ok(cuts.length >= 2);
  assert.ok(
    cuts[1].time - cuts[0].time >= 0.265,
    `cancelled interval ${cuts[1].time - cuts[0].time}`,
  );
  await save(
    "dash cancel retains the basic attack interval instead of resetting it",
  );
  await fixture("F9");
  for (let i = 0; i < 8; i++) {
    await tap(i % 2 === 0 ? "j" : "w+j", 20);
    await page.waitForTimeout(65);
  }
  await wait(() => latestState.y === 0);
  const swings = (await events()).filter((e) => e.name === "aircut");
  assert.equal(swings.length, 2);
  assert.ok(!(await events()).some((e) => e.name === "launcher"));
  assert.ok((await state()).elapsed < 2.2);
  await save("air whiffs and W+J spam allow only two cuts and fall to ground");
  await fixture("F10");
  await tap("i");
  await page.waitForTimeout(200);
  assert.ok((await state()).healTime > 0);
  assert.equal((await state()).embers, 0);
  await page.screenshot({ path: fileURLToPath(new URL("healing.png", out)) });
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  const healing = await state();
  await page.waitForTimeout(350);
  assert.equal((await state()).healTime, healing.healTime);
  assert.equal((await state()).healCool, healing.healCool);
  await tap("Escape");
  await wait(() => latestState.phase === 1);
  await wait(
    () =>
      runEvents.some((e) => e.name === "healcomplete") &&
      latestState.health === 6,
  );
  assert.equal((await state()).health, 6);
  await wait(() => latestState.healCool === 0);
  await tap("i");
  await page.waitForTimeout(150);
  assert.equal((await state()).health, 6);
  assert.ok((await events()).some((e) => e.name === "healempty"));
  await save(
    "healing channels on ground, freezes on pause and consumes a finite ember",
  );
  await fixture("F10");
  await tap("i");
  await page.waitForTimeout(180);
  await tap("F11");
  await page.waitForTimeout(900);
  assert.equal((await state()).health, 4);
  assert.equal((await state()).healTime, 0);
  assert.equal((await state()).embers, 0);
  assert.ok(!(await events()).some((e) => e.name === "healcomplete"));
  await save(
    "incoming damage interrupts healing with no delayed completion or refund",
  );
  await fixture("F10");
  await tap("i");
  await page.waitForTimeout(100);
  await tap("Space");
  await page.waitForTimeout(850);
  assert.equal((await state()).health, 5);
  assert.ok((await events()).some((e) => e.name === "healbreak"));
  await save("jump cancels healing and keeps the committed cooldown");
  await fixture("F9");
  await tap("i");
  await page.waitForTimeout(100);
  assert.equal((await state()).healCool, 0);
  assert.equal((await state()).embers, 1);
  assert.ok((await events()).some((e) => e.name === "healground"));
  await save(
    "airborne healing rejected before resource or cooldown consumption",
  );
  await fixture();
  await tap("q");
  await page.waitForTimeout(330);
  await page.screenshot({
    path: fileURLToPath(new URL("chain-slash.png", out)),
  });
  await page.waitForTimeout(1100);
  assert.equal((await events()).filter((e) => e.name === "swordcut").length, 4);
  assert.equal(
    (await events()).filter((e) => e.name === "chainfinish").length,
    1,
  );
  assert.equal((await state()).ultimateTime, 0);
  assert.equal((await state()).attackTime, 0);
  assert.ok((await state()).ultimateCool > 8);
  assert.equal((await state()).embers, 2);
  await tap("q");
  await page.waitForTimeout(120);
  assert.equal(
    (await events()).filter((e) => e.name === "chainstart").length,
    1,
  );
  await save(
    "ultimate emits four cuts and one finisher, earns embers only on hits, then recovers",
  );
  await fixture();
  await page.keyboard.down("w");
  await tap("q");
  await page.waitForTimeout(1000);
  await page.keyboard.up("w");
  await wait(() => latestState.y > 25);
  await save("ultimate up finisher produces a bounded launch");
  await fixture("F9");
  await page.keyboard.down("s");
  await tap("q");
  await wait(() => latestState.ultimateTime > 0 && latestState.vy < -500);
  await page.keyboard.up("s");
  assert.equal((await state()).embers, 1);
  assert.ok((await state()).x >= 92 && (await state()).x <= 868);
  await save(
    "downward ultimate finisher drives the fall; empty cuts grant no ember",
  );
  await tap("r");
  await wait(() => latestState.practice === 0 && latestState.elapsed < 0.6);
  for (const key of [
    "bowCool",
    "bladeCool",
    "healCool",
    "ultimateCool",
    "bowCharge",
    "healTime",
    "ultimateTime",
    "airAttacks",
  ])
    assert.equal((await state())[key], 0);
  await save(
    "restart clears all cooldowns, charge state, healing and ultimate",
  );
  await wait(() => soundDiagnostics.cached === 82, 15000);
  assert.equal(await page.locator(".skill-slot").count(), 4);
  assert.equal(await page.locator("#dialogue,#setting-voice").count(), 0);
  assert.deepEqual(await page.evaluate(() => soundDiagnostics.errors), []);
  const cues = await page.evaluate(() => soundDiagnostics.fx.map((x) => x.cue));
  for (const cue of [
    "bowdraw",
    "bowshot",
    "heavycut",
    "markbreak",
    "healstart",
    "healcomplete",
    "chaincut",
    "chainfinish",
  ])
    assert.ok(cues.includes(cue), cue);
  await save(
    "four skill indicators and new local sound cues work with speech still disabled",
  );
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  await page.screenshot({ path: fileURLToPath(new URL("error.png", out)) });
} finally {
  report.finalState = await state();
  report.events = await events();
  report.sound = await page.evaluate(() => soundDiagnostics);
  await writeFile(new URL("skills.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
