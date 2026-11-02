import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const out = new URL("./test-results/bow-autoaim/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  fixture:
    "Test-response-only enemy arrangements; production targeting, arrows, collisions, controls and rendering.",
  cases: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func bowFixture() {
 startPractice(); health=8; floorX[0]=80; floorW[0]=800
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0; enemyBaseY[i]=-7000; enemyClock[i]=-100}
 enemyBaseX[0]=500; enemyBaseY[0]=200; enemyHP[0]=40; enemyType[0]=0
 Hero.resetHero(310,0); Hero.invulnerable=0; bowSync()
}
func bowSync() {for i:=0;i<len(enemyHP);i++ {clearEnemyMotion(i); enemyState[i]=2; enemyRecover[i]=100; enemyClock[i]=0}}
onKey KeyF8, => {bowFixture()}
onKey KeyF9, => {bowFixture(); Hero.resetHero(450,0); enemyBaseX[0]=120; enemyBaseY[0]=120; bowSync()}
onKey KeyF10, => {bowFixture(); enemyBaseX[0]=450; enemyBaseY[0]=45; enemyBaseX[3]=340; enemyBaseY[3]=195; enemyHP[3]=40; bowSync()}
onKey KeyF6, => {bowFixture(); floorX[1]=80; floorW[1]=800; floorY[1]=120; floorKind[1]=0; enemyBaseX[3]=540; enemyBaseY[3]=45; enemyHP[3]=40; bowSync()}
onKey KeyF7, => {bowFixture(); enemyType[0]=7; enemyBaseX[0]=450; enemyBaseY[0]=34; enemyBaseX[3]=540; enemyBaseY[3]=45; enemyHP[3]=40; bowSync(); enemyState[0]=0; enemyClock[0]=-100; enemyFacing[0]=-1}
onKey KeyF5, => {bowFixture(); enemyBaseX[0]=950; enemyBaseY[0]=45; enemyBaseX[3]=340; enemyBaseY[3]=450; enemyHP[3]=40; bowSync()}
onKey KeyF4, => {bowFixture(); enemyHP[0]=0; bowSync()}
onKey KeyF3, => {enemyBaseX[3]=380; enemyBaseY[3]=45; bowSync()}
onKey KeyF2, => {enemyBaseX[0]=550; enemyBaseY[0]=240; bowSync()}
onKey KeyF11, => {if Hero.bowTarget>=0 {enemyHP[Hero.bowTarget]=0}}
onKey KeyF12, => {floorX[1]=80; floorW[1]=800; floorY[1]=120; floorKind[1]=0}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const state = () => page.evaluate(() => latestState);
const wait = (fn, timeout = 10000) => page.waitForFunction(fn, {}, { timeout });
const tap = (key) => page.keyboard.press(key, { delay: 35 });
async function fixture(key = "F8") {
  await page.keyboard.up("u");
  await page.keyboard.up("w");
  await tap(key);
  await page.waitForTimeout(200);
}
async function draw(target) {
  await page.keyboard.down("u");
  await page.waitForFunction(
    (i) => latestState.bowCharge > 0 && latestState.bowTarget === i,
    target,
  );
}
async function save(name) {
  report.cases.push({
    name,
    state: await state(),
    foes: await page.evaluate(() => foes),
  });
  console.log("PASS", name);
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177");
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.locator("#practice").click();
  await wait(() => latestState?.practice === 1);

  await fixture();
  await draw(0);
  const originalAim = (await state()).aimY;
  await tap("F2");
  await wait(() => latestState.bowCharge >= 0.6 && foes[0]?.y > 235);
  const aimed = await state();
  assert.ok(aimed.aimX > 0.5 && aimed.aimY > 0.5);
  assert.notEqual(aimed.aimY, originalAim);
  const foe = await page.evaluate(() => foes[0]);
  const dx = foe.x - aimed.x,
    dy = foe.y - aimed.y - 32;
  assert.ok((aimed.aimX * dx + aimed.aimY * dy) / Math.hypot(dx, dy) > 0.998);
  assert.match(await page.locator("#combat-focus").innerText(), /锁定/);
  await page.screenshot({
    path: fileURLToPath(new URL("elevated-lock.png", out)),
  });
  await page.keyboard.up("u");
  await wait(() => foes[0]?.hp === 38 && latestState.bowTarget === -1);
  assert.ok((await state()).bowCool > 0 && (await state()).bowCool <= 3);
  await save(
    "unprompted aim tracks a moving elevated foe and the charged arrow hits",
  );

  await fixture("F9");
  await draw(0);
  assert.ok((await state()).aimX < -0.85);
  await page.keyboard.up("u");
  await wait(() => foes[0]?.hp === 39);
  await save(
    "a foe behind the hero is acquired and hit without a direction key",
  );

  await fixture("F10");
  await draw(0);
  await page.keyboard.down("w");
  await wait(() => latestState.bowTarget === 3);
  await page.keyboard.up("w");
  await wait(() => latestState.bowCharge >= 0.6);
  assert.equal((await state()).bowTarget, 3);
  assert.ok((await state()).aimY > 0.9);
  await page.screenshot({
    path: fileURLToPath(new URL("direction-switch.png", out)),
  });
  await page.keyboard.up("u");
  await wait(() => foes[3]?.hp === 38);
  assert.equal(await page.evaluate(() => foes[0].hp), 40);
  await save(
    "upward intent switches from the nearest foe and releasing it keeps the new lock",
  );

  await fixture("F10");
  await draw(0);
  await tap("F3");
  await wait(() => foes[3]?.y < 65);
  await page.waitForTimeout(250);
  assert.equal((await state()).bowTarget, 0);
  await tap("F11");
  await wait(() => latestState.bowTarget === 3);
  await save(
    "valid locks stay stable when another foe moves closer; death reacquires a valid foe",
  );

  await fixture("F6");
  await draw(3);
  await page.keyboard.up("u");
  await wait(() => foes[3]?.hp === 39);
  assert.equal(await page.evaluate(() => foes[0].hp), 40);
  await save("an occluding platform excludes the otherwise nearby upper foe");

  await fixture("F7");
  await draw(0);
  await page.keyboard.up("u");
  await wait(() => runEvents.some((e) => e.name === "armor"));
  assert.equal(await page.evaluate(() => foes[0].hp), 40);
  await save(
    "auto-aim selects a plate guard but the actual frontal arrow respects its armor",
  );

  await fixture("F5");
  await draw(-1);
  assert.equal((await state()).aimX, 1);
  await page.keyboard.down("w");
  await wait(() => latestState.aimY === 1);
  assert.equal((await state()).bowTarget, -1);
  assert.match(await page.locator("#combat-focus").innerText(), /自由瞄准/);
  await save(
    "out-of-range and off-screen foes leave directional free aim available",
  );

  await fixture();
  await draw(0);
  await tap("F12");
  await wait(() => latestState.bowTarget === -1);
  assert.equal((await state()).aimY, 0);
  await save("a newly obstructed lock is dropped immediately while charging");

  await fixture();
  const grapple = (await state()).target;
  assert.ok(grapple >= 0);
  await draw(0);
  assert.equal((await state()).target, grapple);
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  const paused = await state();
  await page.waitForTimeout(350);
  assert.equal((await state()).bowTarget, paused.bowTarget);
  assert.equal((await state()).bowCharge, paused.bowCharge);
  await tap("Escape");
  await wait(() => latestState.phase === 1);
  await tap("k");
  await page.keyboard.up("u");
  await wait(() => latestState.bowTarget === -1 && latestState.bowCharge === 0);
  assert.equal((await state()).bowCool, 0);
  assert.ok(
    !(await page.evaluate(() => runEvents)).some((e) => e.name === "bowshot"),
  );
  await save(
    "bow lock is independent of grapple selection, freezes on pause and clears on cancellation",
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
  await writeFile(
    new URL("bow-autoaim.json", out),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
