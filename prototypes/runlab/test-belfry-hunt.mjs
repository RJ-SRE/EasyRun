import { BANK } from "./public/inscription-core.js";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out = new URL("./test-results/hunt/", import.meta.url);
await mkdir(out, { recursive: true });
const report = {
  date: new Date().toISOString(),
  scope:
    "Response-only initial arrangements; all attacks, movement, input and collision use production code. Not human difficulty evidence.",
  cases: [],
  errors: [],
};
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => report.errors.push(e.message));
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func huntFixture(kind,mode int){
 practiceEncounter(kind); Hero.resetHero(470,0); Hero.invulnerable=0; Hero.facing=90; Hero.grounded=true
 for i:=0;i<len(enemyHP);i++ {enemyClock[i]=-4; enemyFacing[i]=-1}
 if kind==6 {enemyBaseX[7]=570; enemyX[7]=570; enemyHP[7]=20}
 if mode==1 {Hero.px=650; Hero.facing=-90}
 if mode==2 {for i:=0;i<len(enemyHP);i++ {enemyClock[i]=2}}
 if mode==3 {enemyBaseX[1]=560; enemyX[1]=560; enemyBaseX[9]=740; enemyX[9]=740; enemyHP[9]=4; Hero.px=800; Hero.facing=-90}
 if mode==4 {enemyBaseX[8]=650; enemyX[8]=650; Hero.px=480; enemyClock[8]=2; enemyCycle[8]=0}
}
onKey KeyF8, => {huntFixture(6,0)}
onKey KeyF9, => {huntFixture(6,1)}
onKey KeyF10, => {huntFixture(7,4)}
onKey KeyF11, => {huntFixture(8,0)}
onKey KeyF12, => {huntFixture(8,3)}
onKey KeyC, => {huntFixture(0,0); enemyElite[0]=4; enemyHP[0]=15; enemyBaseY[0]=190; enemyY[0]=190; enemyClock[0]=2; enemyCycle[0]=2}
onKey KeyF7, => {
 startRun(); wordMode=1; floorX[0]=80; floorW[0]=800
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0}
 i:=2; enemyBaseX[i]=570; enemyBaseY[i]=34; clearEnemyMotion(i); enemyFloor[i]=0; enemyHP[i]=8; enemyFacing[i]=-1; enemyClock[i]=-4
 Hero.resetHero(470,0); Hero.grounded=true; Hero.facing=90; Hero.invulnerable=0
}
onKey KeyB, => {huntFixture(1,0); enemyBaseX[1]=570; enemyX[1]=570}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const wait = (fn, t = 12000) => page.waitForFunction(fn, {}, { timeout: t });
const snapshot = () =>
  page.evaluate(() => ({
    s: latestState,
    f: foes,
    h: huntFoes,
    events: runEvents,
    render: renderState,
    errors: runtimeErrors,
  }));
const pass = async (name) => {
  report.cases.push({ name, ...(await snapshot()) });
  console.log("PASS", name);
};
async function setup(key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(180);
  assert.equal((await snapshot()).s.phase, 1);
}
async function heavy() {
  await page.keyboard.down("l");
  await wait(() => latestState.chargeTime >= 0.58);
  await page.keyboard.up("l");
  await page.waitForTimeout(350);
}
try {
  await page.goto(
    process.env.RUNLAB_URL || "http://127.0.0.1:4184/?words=off&v=hunt-v10",
  );
  await wait(() => window.latestState || runtimeErrors.length, 60000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.locator("#word-enabled").uncheck();
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);
  assert.equal((await snapshot()).s.bossShield, 0);
  assert.equal(await page.locator("#practice-controls [data-spar]").count(), 9);
  await pass(
    "default hunt starts without exterior boss seals and offers all eight roles",
  );
  await setup("F8");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("j", { delay: 80 });
    await page.waitForTimeout(310);
  }
  assert.equal((await snapshot()).f[7].hp, 20);
  assert((await snapshot()).events.some((e) => e.name === "armor"));
  await pass("frontal J chain cannot erase the plate guard");
  await setup("F8");
  await page.keyboard.press("q", { delay: 80 });
  await wait(() => runEvents.some((e) => e.name === "chainfinish"));
  assert.equal((await snapshot()).f[7].hp, 20);
  await pass("a stationary ultimate cannot bypass intact frontal plate armor");
  await setup("F8");
  await page.keyboard.down("e");
  await wait(() => runEvents.some((e) => e.name === "armor"));
  await page.keyboard.up("e");
  assert.equal((await snapshot()).f[7].hp, 20);
  assert.equal((await snapshot()).f[7].stun, 0);
  await pass(
    "frontal grappling respects plate armor and grants no free stagger",
  );
  await setup("F9");
  await page.keyboard.press("j", { delay: 80 });
  await wait(() => foes[7]?.hp < 20);
  await pass("a real back attack damages the same guarded enemy");
  await setup("F8");
  await heavy();
  await wait(() => huntFoes[7]?.armor > 0 && foes[7]?.hp < 20);
  assert((await snapshot()).events.some((e) => e.name === "guardbreak"));
  await page.screenshot({
    path: fileURLToPath(new URL("warden-break.png", out)),
  });
  await pass("charged blade breaks plate guard and creates a visible opening");
  await setup("F11");
  await wait(() => huntFoes[1]?.ward === 9);
  await page.keyboard.press("j", { delay: 80 });
  await page.waitForTimeout(300);
  assert.equal((await snapshot()).f[1].hp, 20);
  await pass("weaver grants one actual visible ward to its ally");
  await heavy();
  await wait(() => huntFoes[1]?.ward === -1);
  assert((await snapshot()).events.some((e) => e.name === "wardbreak"));
  await pass("heavy strike severs support, without refreshing enemy HP");
  await setup("F12");
  await wait(() => huntFoes[1]?.ward === 9);
  await page.screenshot({
    path: fileURLToPath(new URL("weaver-link.png", out)),
  });
  await heavy();
  await page.keyboard.press("j", { delay: 80 });
  await page.waitForTimeout(600);
  await page.keyboard.press("j", { delay: 80 });
  await wait(() => runEvents.some((e) => e.name === "kill"));
  await wait(() => huntFoes[1]?.ward === -1);
  await pass("killing support removes its protection from surviving allies");
  await setup("F10");
  await wait(() => foes[8]?.state === 1);
  const baseline = (await snapshot()).s.health;
  await page.screenshot({
    path: fileURLToPath(new URL("hound-tell.png", out)),
  });
  await wait(() => foes[8]?.state === 2);
  assert.equal((await snapshot()).s.health, baseline - 1);
  await pass(
    "hound warns then commits one damaging pounce and exposes recovery",
  );
  await setup("F10");
  await wait(() => foes[8]?.state === 1 && foes[8]?.clock > 0.53);
  await page.keyboard.down("Space");
  await wait(() => foes[8]?.state === 2);
  await page.keyboard.up("Space");
  assert.equal((await snapshot()).s.health, baseline);
  await pass("jumping the committed low pounce avoids damage");
  await setup("F8");
  await page.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  const frozen = await snapshot();
  await page.waitForTimeout(500);
  const after = await snapshot();
  assert.equal(after.s.elapsed, frozen.s.elapsed);
  assert.equal(after.f[7].clock, frozen.f[7].clock);
  await pass("pause freezes new enemy decision and recovery clocks");
  await page.keyboard.press("Escape");
  await setup("b");
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("j", { delay: 80 });
    await page.waitForTimeout(300);
  }
  assert((await snapshot()).events.some((e) => e.name === "enemy_backstep"));
  assert((await snapshot()).f[1].hp < 20);
  await pass(
    "duelist takes real combo damage then visibly escapes sustained pressure",
  );
  await setup("c");
  await wait(() => foes[0]?.state === 1 && foes[0]?.mode === 2);
  await wait(() => foes[0]?.state === 3);
  const firstPass = await snapshot();
  await wait(() => foes[0]?.state === 1 && foes[0]?.step === 1);
  const secondTell = await snapshot();
  assert(secondTell.events.filter((e) => e.name === "enemy_tell").length >= 2);
  await wait(() => foes[0]?.state === 3 && foes[0]?.step === 1);
  await wait(() => foes[0]?.state === 2);
  const judge = await snapshot();
  assert(
    judge.events.filter((e) => e.name === "enemy_huntstrike").length === 2,
  );
  assert(judge.s.elapsed - secondTell.s.elapsed >= 0.7);
  assert(firstPass.f[0].y !== judge.f[0].y);
  await pass(
    "wing judge performs two real dives with a separately visible second warning",
  );
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4184/").split("?")[0] +
      "?words=on",
  );
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    60000,
  );
  await page.locator("#word-enabled").check();
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);
  async function wordBlade(correct) {
    await setup("F7");
    await page.keyboard.down("l");
    await wait(() => latestState.chargeTime >= 0.58);
    await page.keyboard.up("l");
    await wait(() => latestState.phase === 5 && inscriptionDiagnostics.active);
    const frozen = await snapshot();
    await page.waitForTimeout(450);
    const still = await snapshot();
    assert.equal(still.f[2].clock, frozen.f[2].clock);
    assert.equal(still.f[2].x, frozen.f[2].x);
    assert.equal(still.h[2].armor, frozen.h[2].armor);
    const a = await page.evaluate(() => inscriptionDiagnostics.active);
    const w = BANK.get(a.q.wordId);
    if (a.q.type === "spell") {
      if (correct) await page.keyboard.type(w.word, { delay: 25 });
      else await page.keyboard.press(w.word.startsWith("z") ? "x" : "z");
    } else {
      const i = a.q.options.indexOf(w.meaning);
      await page.keyboard.press(String((correct ? i : (i + 1) % 3) + 1));
    }
    await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
    await page.waitForTimeout(220);
  }
  await wordBlade(false);
  assert.equal((await snapshot()).f[2].hp, 8);
  assert.equal((await snapshot()).h[2].armor, 0);
  assert(!(await snapshot()).events.some((e) => e.name === "heavy"));
  await pass(
    "wrong word cancels blade without breaking armor; new AI freezes during the prompt",
  );
  await wordBlade(true);
  await wait(() => huntFoes[2]?.armor > 0 && foes[2]?.hp < 8);
  await pass("correct word releases one real armor-breaking blade");
  await page.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  const oldBook = await page.evaluate(() => {
    const key = "easyrun-inscription-v1",
      b = JSON.parse(localStorage.getItem(key));
    b.run.started = true;
    b.run.won = false;
    b.run.snapshot = {
      checkpoint: 10,
      segment: 0,
      difficulty: 0,
      elapsed: 90,
      cityForge: 1,
      cityChoice: 2,
      expedition: {
        revision: 2,
        done: Array(15).fill(1),
        flags: Array(15).fill(31),
        sides: [2, 2, 2, 2, 2],
      },
    };
    return b;
  });
  // Seed the previous-version file before the new host starts. Writing while
  // an active host is still saving would race its normal autosave.
  await page.addInitScript(
    ({ key, value }) => {
      if (!sessionStorage.getItem("hunt-legacy-seeded")) {
        localStorage.setItem(key, value);
        sessionStorage.setItem("hunt-legacy-seeded", "1");
      }
    },
    { key: "easyrun-inscription-v1", value: JSON.stringify(oldBook) },
  );
  await page.reload();
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    60000,
  );
  await page.locator("#word-continue").click();
  await wait(() => window.latestState?.phase === 1, 60000);
  await wait(() => latestState.checkpoint === 10);
  const migrated = await snapshot();
  assert.equal(migrated.s.checkpoint, 10);
  assert.equal(migrated.s.expedition.revision, 3);
  assert.equal(migrated.s.expedition.done[9], 1);
  assert.equal(migrated.s.expedition.done[10], 0);
  assert(migrated.s.expedition.flags.every((x) => x === 0));
  assert.equal(migrated.s.cityForge, 0);
  assert.deepEqual(
    await page.evaluate(() => inscriptionDiagnostics.pool),
    oldBook.run.pool,
  );
  assert.deepEqual(
    await page.evaluate(() => inscriptionDiagnostics.run.progress),
    oldBook.run.progress,
  );
  await pass(
    "legacy v2 checkpoint resumes in the real host with identical words and no false elite completion",
  );
  await page.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  await page.locator("#word-to-menu").click();
  await wait(() => latestState.phase === 0);
  await page.locator("#word-continue").click();
  await wait(() => window.latestState?.phase === 1, 60000);
  assert.equal((await snapshot()).s.checkpoint, 10);
  assert.equal((await snapshot()).s.expedition.done[10], 0);
  await pass("migrated v3 progress survives another title and resume cycle");
  await page.keyboard.press("r");
  await wait(() => latestState.practice === 0 && latestState.phase === 1);
  assert.equal((await snapshot()).s.expedition.prompt, -1);
  assert.equal((await snapshot()).s.bossShield, 0);
  await pass("restart clears rehearsal and retired mechanism state");
  assert.deepEqual(report.errors, []);
  assert.deepEqual((await snapshot()).errors, []);
} catch (e) {
  report.failure = e.stack;
  report.last = await snapshot();
  console.error(e);
  await page.screenshot({ path: fileURLToPath(new URL("failure.png", out)) });
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
