import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  InscriptionBook,
  STORAGE_KEY,
  BANK,
} from "./public/inscription-core.js";
import { endingFor } from "./public/belfry-city.js";
const out = new URL("./test-results/city/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  fixture:
    "Real first-platform interaction; later fixtures only position the hero, remove enemies and arrange the boss finishing hit in response source. Normal engine input, physics, collisions, city rules, persistence and UI remain in use. This is not a full-route replay.",
};
p.on("pageerror", (e) => report.errors.push(e.message));
const book = new InscriptionBook(null, 4);
book.settings.hint = "guided";
await p.addInitScript(
  ({ key, data }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, data);
  },
  { key: STORAGE_KEY, data: book.serialize() },
);
await p.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func cityFixture(i int) {
 for j:=0;j<len(enemyHP);j++ {enemyHP[j]=0; clearEnemyMotion(j)}
 phase=1; segment=0; Hero.resetHero(cityNodeX[i],cityNodeY[i]); controlGrace=2
}
onKey KeyF7, => {cityFixture(1)}
onKey KeyF8, => {cityFixture(2)}
onKey KeyF9, => {cityFixture(3)}
onKey KeyF10, => {cityFixture(4)}
onKey KeyF11, => {Hero.resetHero(455,floorY[17]); Hero.grounded=true; health=5}
onKey KeyF12, => {Hero.resetHero(480,-3590); phase=1; segment=1; bossStage=1; bossShield=0; enemyHP[10]=1; enemyFlash[10]=0; hitEnemy(10,2)}
onKey KeyB, => {Hero.resetHero(230,0)}
onKey KeyN, => {Hero.resetHero(470,-2690)}
onKey KeyG, => {Hero.resetHero(735,-450); cityWind=0; Hero.grounded=false}
onKey KeyH, => {Hero.resetHero(735,-450); cityWind=1; Hero.grounded=false}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const wait = (fn, timeout = 12000) => p.waitForFunction(fn, {}, { timeout });
const state = () => p.evaluate(() => latestState);
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function key(k) {
  await p
    .locator("iframe")
    .evaluate((f) =>
      f.contentWindow.document.querySelector("#game-canvas").focus(),
    );
  await p.keyboard.press(k);
}
async function shot(name) {
  await p.waitForTimeout(350);
  await p.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });
}
async function answer() {
  const q = await p.evaluate(() => inscriptionDiagnostics.active.q),
    w = BANK.get(q.wordId);
  if (q.type === "spell") await p.keyboard.type(w.word, { delay: 30 });
  else await p.keyboard.press(String(q.options.indexOf(w.meaning) + 1));
  await wait(() => latestState.phase === 1);
}
try {
  await p.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4184/?words=on");
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    60000,
  );
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  await p.locator("#city-book-open").click();
  assert.equal(await p.locator("#city-entries article").count(), 5);
  assert.equal(
    await p.locator('#city-entries [data-visited="false"]').count(),
    4,
  );
  await p.keyboard.press("Escape");
  assert.equal((await state()).phase, 0);
  await shot("title");
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1 && latestState.cityPrompt === 0);
  await shot("wind");
  await p.keyboard.press("f");
  await wait(() => latestState.cityWind === 1);
  assert.equal((await state()).cityChoice, 0);
  await p.keyboard.press("f");
  assert.equal(
    await p.evaluate(
      () => runEvents.filter((e) => e.name === "citywind").length,
    ),
    1,
  );
  pass(
    "five-area opening and spoiler-safe journal; real wind-valve interaction is optional and idempotent",
  );
  await key("g");
  await p.waitForTimeout(280);
  const without = await state();
  await key("h");
  await p.waitForTimeout(280);
  const withWind = await state();
  assert.ok(withWind.vy > without.vy + 200);
  assert.ok(withWind.y > without.y + 25);
  pass("wind valve changes real upward physics inside the visible wind column");
  await key("F7");
  await wait(
    () => latestState.cityPrompt === 1 && latestState.cityDistrict === 1,
  );
  await p.keyboard.press("f");
  await wait(() => latestState.cityForge === 1);
  await shot("forge");
  assert.match(await p.locator("#city-narrative").innerText(), /未完成的工作/);
  assert.doesNotMatch(await p.locator("#city-narrative").innerText(), /风阀/);
  await key("F11");
  await p.waitForTimeout(120);
  const ride = await state();
  // A fixed wall-clock interval can straddle the sinusoid's turning point and
  // return to nearly the same height. Wait for actual simulation displacement.
  await p.waitForFunction(
    (from) => Math.abs(window.latestState.cityLiftY - from) > 35,
    ride.cityLiftY,
    { timeout: 12000 },
  );
  const moved = await state();
  assert.ok(Math.abs(moved.cityLiftY - ride.cityLiftY) > 15);
  assert.ok(Math.abs(moved.y - moved.cityLiftY) < 3);
  pass(
    "restored foundry lift moves and physically carries a standing passenger",
  );
  await p.locator("#city-book-open").click();
  await wait(() => latestState.phase === 4);
  const frozen = await state();
  await p.keyboard.press("r");
  await p.keyboard.press("f");
  await p.waitForTimeout(250);
  const still = await state();
  for (const field of ["x", "y", "elapsed", "cityLiftY", "attempts"])
    assert.equal(still[field], frozen[field]);
  await p.keyboard.press("Escape");
  await wait(() => latestState.phase === 1);
  pass(
    "journal pauses the lift and combat, contains action keys and resumes only its own pause",
  );
  await key("F8");
  await wait(
    () => latestState.cityPrompt === 2 && latestState.cityDistrict === 2,
  );
  await p.keyboard.down("u");
  await wait(() => latestState.bowCharge >= 0.6);
  await p.keyboard.up("u");
  await wait(() => latestState.phase === 5 && inscriptionDiagnostics.active);
  await p.keyboard.press("f");
  assert.equal((await state()).cityArchive, 0);
  assert.equal(await p.locator("#city-interaction").isVisible(), false);
  const questionLift = (await state()).cityLiftY;
  await p.waitForTimeout(250);
  assert.equal((await state()).cityLiftY, questionLift);
  await p.keyboard.press("Backspace");
  await answer();
  await wait(() => latestState.cityPrompt === 2);
  await p.keyboard.press("f");
  await wait(() => latestState.cityArchive === 1);
  await shot("archive");
  await p.locator("#city-book-open").click();
  assert.match(
    await p.locator("#city-choice-record").innerText(),
    /先记住它们的名字/,
  );
  await p.keyboard.press("Escape");
  await wait(() => latestState.phase === 1);
  pass(
    "archive reveals actual story and a service ledge; typing F during a word challenge never activates it",
  );
  await key("F9");
  await wait(
    () => latestState.cityDistrict === 3 && latestState.cityPrompt === 3,
  );
  await key("n");
  await wait(() => latestState.y < -2800);
  assert.equal((await state()).cityMirror, 0);
  await key("F9");
  await wait(() => latestState.cityPrompt === 3);
  await p.keyboard.press("f");
  await wait(() => latestState.cityMirror === 1);
  await shot("mirror");
  await key("n");
  await wait(() => Math.abs(latestState.y + 2740) < 2);
  await p.waitForTimeout(250);
  assert.ok(Math.abs((await state()).y + 2740) < 2);
  pass(
    "mirror repair activates an actual collision bridge; the unrepaired route has no invisible floor",
  );
  await key("F10");
  await wait(
    () => latestState.cityDistrict === 4 && latestState.cityPrompt === 4,
  );
  await shot("heart");
  assert.equal(await p.locator("#city-alternate").isVisible(), true);
  await p.keyboard.press("f");
  await wait(() => latestState.cityChoice === 1);
  await p.keyboard.press("v");
  assert.equal((await state()).cityChoice, 1);
  pass("the pre-boss choice advertises costs and locks once chosen");
  await p.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  await p.locator("#word-to-menu").click();
  await wait(() => latestState.phase === 0);
  await p.reload();
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    60000,
  );
  await p.locator("#word-continue").click();
  await wait(
    () =>
      window.latestState?.phase === 1 && window.latestState.cityChoice === 1,
    60000,
  );
  const restored = await state();
  for (const flag of ["cityWind", "cityForge", "cityArchive", "cityMirror"])
    assert.equal(restored[flag], 1);
  assert.ok(restored.cityDepth >= 3070);
  pass(
    "checkpoint reload preserves all repairs, explored districts and the final decision",
  );
  await key("F12");
  await wait(() => latestState.segment === 2);
  assert.equal((await state()).health, (await state()).maxHealth - 1);
  const tide = await state();
  await p.waitForTimeout(700);
  const tideLater = await state();
  const speed =
    (tideLater.riseY - tide.riseY) / (tideLater.returnTime - tide.returnTime);
  assert.ok(Math.abs(speed - 29 * 0.85) < 0.1);
  await key("b");
  await wait(() => latestState.phase === 2);
  assert.match(await p.locator("#overlay-title").innerText(), /让城记得/);
  assert.match(await p.locator("#overlay-body").innerText(), /名字/);
  await shot("ending");
  pass(
    "leave-light choice changes actual core health and tide speed, then reaches its specific ending",
  );
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1 && latestState.cityChoice === 0);
  assert.equal((await state()).cityForge, 0);
  await key("F10");
  await wait(() => latestState.cityPrompt === 4);
  await p.keyboard.press("v");
  await wait(() => latestState.cityChoice === 2);
  await key("F12");
  await wait(() => latestState.segment === 2);
  assert.equal((await state()).embers, 2);
  assert.equal((await state()).health, (await state()).maxHealth);
  await key("b");
  await wait(() => latestState.phase === 2);
  assert.match(await p.locator("#overlay-title").innerText(), /带回了心跳/);
  pass(
    "new adventure resets repairs; carry-heart choice restores embers and has a distinct unread-archive ending",
  );
  assert.notEqual(
    endingFor({ cityChoice: 2, cityArchive: 1 }).title,
    endingFor({ cityChoice: 2, cityArchive: 0 }).title,
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator("#city-book-open").click();
  const bounds = await p.locator("#city-book").boundingBox();
  assert.ok(bounds.width <= 390 && bounds.x >= 0);
  await shot("journal-narrow");
  await p.keyboard.press("Escape");
  pass(
    "ending reflects whether the archive was read; journal remains bounded on narrow screens",
  );
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.locator("#fullscreen").click();
  await p.locator("#city-book-fullscreen").click();
  assert.equal(await p.locator("#city-book").isVisible(), true);
  assert.equal((await state()).phase, 2);
  await p.locator("#city-book-close").click();
  assert.equal((await state()).phase, 2);
  pass(
    "fullscreen keeps the city journal accessible without restarting a finished run",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
} catch (e) {
  report.failure = e.stack;
  report.state = await state().catch(() => null);
  await p
    .screenshot({ path: fileURLToPath(new URL("failure.png", out)) })
    .catch(() => {});
  throw e;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
