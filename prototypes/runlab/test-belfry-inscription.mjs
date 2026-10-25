import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  InscriptionBook,
  BANK,
  STORAGE_KEY,
} from "./public/inscription-core.js";
const out = new URL("./test-results/inscription/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const p = await context.newPage(),
  report = {
    date: new Date().toISOString(),
    cases: [],
    errors: [],
    fixture:
      "Response-only fixed arena and lifecycle events; production Hero, physics, QTE host, keyboard and result processing.",
  };
p.on("pageerror", (e) => report.errors.push(e.message));
const seeded = new InscriptionBook(null, 2); // first request is spelling
await p.addInitScript(
  ({ key, value }) => {
    if (
      !localStorage.getItem(key) ||
      sessionStorage.getItem("word-fixture-reset") === "1"
    ) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem("word-fixture-reset");
    }
  },
  { key: STORAGE_KEY, value: seeded.serialize() },
);
await p.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func wordFixture() {
 startRun(); wordMode=1; health=5; embers=1; floorX[0]=80; floorW[0]=800
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0; enemyBaseY[i]=-7000; clearEnemyMotion(i)}
 enemyType[1]=1; enemyBaseX[1]=455; enemyBaseY[1]=34; enemyHP[1]=100; clearEnemyMotion(1); enemyState[1]=2; enemyRecover[1]=1000
 Hero.resetHero(310,0); Hero.invulnerable=0
}
onKey KeyF7, => {wordFixture()}
onKey KeyF8, => {wordFixture(); enemyHP[1]=0}
onKey KeyF9, => {wordFixture(); enemyHP[1]=0; enemyType[4]=5; enemyBaseX[4]=345; enemyBaseY[4]=34; enemyHP[4]=100; clearEnemyMotion(4); Hero.grounded=true; captureHero(4)}
onKey KeyF10, => {wordFixture(); enemyHP[1]=0; enemyType[6]=4; enemyBaseX[6]=600; enemyBaseY[6]=34; enemyHP[6]=100; clearEnemyMotion(6); enemyState[6]=2; enemyRecover[6]=1000; chainOwner=6; chainTime=1.25}
onKey KeyF11, => {checkpoint=2; Hero.resetHero(720,-2100); health=0; phase=3; deaths++; event("fail")}
onKey KeyF12, => {phase=2; event("finish")}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const state = () => p.evaluate(() => window.latestState);
const diag = () => p.evaluate(() => window.inscriptionDiagnostics);
const wait = (fn, arg, timeout = 10000) =>
  p.waitForFunction(fn, arg, { timeout });
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
const fixture = async (key = "F7") => {
  await p
    .locator("iframe")
    .evaluate((f) =>
      f.contentWindow.document.querySelector("#game-canvas").focus(),
    );
  await p.keyboard.press(key);
  await wait(() => latestState.phase === 1);
  await p.waitForTimeout(120);
};
async function charge(key) {
  await p.keyboard.down(key);
  await wait(
    (k) => (k === "u" ? latestState.bowCharge : latestState.chargeTime) >= 0.6,
    key,
  );
  await p.keyboard.up(key);
}
async function focus(kind) {
  await wait(
    (k) => latestState.phase === 5 && inscriptionDiagnostics.active?.kind === k,
    kind,
  );
}
async function answer(correct = true) {
  const a = (await diag()).active;
  const word = BANK.get(a.q.wordId);
  if (a.q.type === "spell") {
    if (correct)
      await p.keyboard.type(word.word.slice(a.input.length), { delay: 30 });
    else await p.keyboard.press(word.word.startsWith("z") ? "x" : "z");
  } else {
    const i = a.q.options.indexOf(word.meaning);
    await p.keyboard.press(String((correct ? i : (i + 1) % 3) + 1));
  }
  await wait(() => !inscriptionDiagnostics.active && latestState.phase === 1);
}
try {
  await p.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177");
  await wait(() => latestState || runtimeErrors.length, null, 45000);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  await p.locator("#word-tier").selectOption("challenge");
  assert.equal((await diag()).pool.length, 30);
  await p.locator("#word-preview").click();
  assert.equal(await p.locator(".word-row").count(), 30);
  assert.equal((await diag()).count, 0);
  await p.locator("#word-close").click();
  await p.screenshot({ path: fileURLToPath(new URL("menu.png", out)) });
  pass("30-word menu, independent difficulty and no preview credit");
  await p.evaluate(() => sessionStorage.setItem("word-fixture-reset", "1"));
  await p.reload();
  await wait(() => window.latestState?.phase === 0, null, 45000);
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  await fixture();
  await charge("u");
  await focus(1);
  const frozen = await state();
  await p.waitForTimeout(400);
  const still = await state();
  for (const k of [
    "x",
    "y",
    "elapsed",
    "health",
    "bowCool",
    "bladeCool",
    "healCool",
    "ultimateCool",
    "airAttacks",
  ])
    assert.equal(still[k], frozen[k], k);
  await p.screenshot({ path: fileURLToPath(new URL("focus.png", out)) });
  pass(
    "full charge requests exactly one challenge; physics, cooldown and air budget freeze",
  );
  const prompt = (await diag()).active;
  assert.equal(prompt.q.type, "spell");
  await p.keyboard.type(BANK.get(prompt.q.wordId).word.slice(0, 2), {
    delay: 30,
  });
  assert.equal((await state()).phase, 5);
  assert.equal(
    await p.evaluate(() =>
      runEvents.some((e) =>
        ["bowshot", "heavy", "chainstart", "hook"].includes(e.name),
      ),
    ),
    false,
  );
  await p.keyboard.press("Escape");
  const at = (await diag()).active.elapsed;
  await p.waitForTimeout(300);
  assert.equal((await diag()).active.elapsed, at);
  await p.keyboard.press("Escape");
  await answer();
  await wait(() => runEvents.some((e) => e.name === "marked"));
  assert.equal((await diag()).count, 1);
  assert.ok((await state()).bowCool > 0 && (await state()).bowCool <= 3);
  pass(
    "typing isolation, escape pause, full arrow and single progress settlement",
  );
  const serial = (await state()).wordSerial;
  await charge("l");
  await focus(2);
  assert.equal((await state()).wordSerial, serial + 1);
  const bowDuringBladeQuestion = (await state()).bowCool;
  assert.ok(bowDuringBladeQuestion > 0);
  await p.waitForTimeout(450);
  assert.equal((await state()).bowCool, bowDuringBladeQuestion);
  await answer();
  await wait(() => runEvents.some((e) => e.name === "markbreak"));
  assert.equal((await diag()).count, 2);
  pass("marked blade still requires its own answer before detonating the mark");
  await fixture();
  await charge("l");
  await focus(2);
  await answer(false);
  await p.waitForTimeout(750);
  assert.equal((await state()).bladeCool, 0);
  assert.equal((await state()).attackKind, 0);
  assert.equal(await p.evaluate(() => foes[1].hp), 100);
  assert.equal(
    await p.evaluate(() => runEvents.some((e) => e.name === "heavy")),
    false,
  );
  assert.equal((await diag()).count, 0);
  pass(
    "one misspelled letter cancels the entire blade, with no fallback damage or cooldown",
  );
  await fixture("F8");
  await p.keyboard.press("i", { delay: 50 });
  await focus(3);
  const hp = (await state()).health;
  assert.equal((await state()).embers, 0);
  assert.equal((await diag()).active.q.type, "meaning");
  await p.screenshot({ path: fileURLToPath(new URL("meaning.png", out)) });
  await answer(false);
  assert.equal((await state()).health, hp);
  assert.equal((await state()).embers, 1);
  assert.equal((await state()).healCool, 0);
  pass("heal failure refunds once, with no healing or cooldown");
  await fixture("F8");
  await p.keyboard.press("i", { delay: 50 });
  await focus(3);
  await answer();
  await wait((h) => latestState.health === h + 1, hp);
  assert.equal((await state()).embers, 0);
  pass("correct heal completes remaining channel and restores one HP");
  await fixture();
  await p.keyboard.press("q", { delay: 50 });
  await focus(4);
  const before = await p.evaluate(
    () => runEvents.filter((e) => e.name === "chainhit").length,
  );
  assert.equal(before, 0);
  assert.equal(
    await p.evaluate(() => runEvents.some((e) => e.name === "chainstart")),
    false,
  );
  const ultSerial = (await state()).wordSerial;
  await answer();
  await wait(() => runEvents.filter((e) => e.name === "chainhit").length === 5);
  assert.equal((await state()).wordSerial, ultSerial);
  await wait(() => latestState.ultimateTime === 0);
  assert.ok((await state()).ultimateCool > 0);
  await p.keyboard.press("q");
  await p.waitForTimeout(250);
  assert.equal((await state()).phase, 1);
  assert.equal((await state()).wordSerial, ultSerial);
  await wait(() => latestState.ultimateCool === 0);
  await p.keyboard.press("q");
  await focus(4);
  assert.equal((await state()).wordSerial, ultSerial + 1);
  await answer(false);
  pass(
    "ultimate asks before any hit, releases all five and suppresses repeat questions during cooldown",
  );
  await fixture();
  await p.keyboard.press("q", { delay: 50 });
  await focus(4);
  await answer(false);
  await p.waitForTimeout(350);
  assert.equal(
    await p.evaluate(
      () => runEvents.filter((e) => e.name === "chainhit").length,
    ),
    0,
  );
  assert.equal((await state()).ultimateTime, 0);
  pass("failed ultimate cancels all five hits and its release effects");
  await fixture("F8");
  await p.keyboard.press("q", { delay: 50 });
  await focus(4);
  await answer(false);
  assert.equal(
    await p.evaluate(() => runEvents.some((e) => e.name === "chainstart")),
    false,
  );
  pass("even an empty ultimate requires an answer and cannot bypass the gate");
  await fixture("F10");
  await p.keyboard.press("f", { delay: 50 });
  await focus(5);
  await answer();
  assert.equal((await state()).chainOwner, -1);
  pass("optional F chain release restores movement");
  await fixture("F9");
  await focus(6);
  assert.equal((await diag()).active.q.type, "meaning");
  await answer(false);
  assert.equal((await state()).bindTime, 0);
  assert.ok((await state()).controlImmune > 9);
  pass(
    "binder preserves hard control then guarantees bounded release with immunity",
  );
  await fixture("F8");
  await charge("u");
  await focus(1);
  await p.locator("#word-input").dispatchEvent("compositionstart");
  const imeTime = (await diag()).active.elapsed;
  await p.waitForTimeout(200);
  assert.equal((await diag()).active.elapsed, imeTime);
  await p.locator("#word-input").dispatchEvent("compositionend");
  await p.locator("#word-resume").click();
  await answer();
  pass("IME composition pauses timer without injecting game actions");
  await fixture("F8");
  await charge("u");
  await focus(1);
  await p.keyboard.press("Escape");
  await p.locator("#word-restart").click();
  await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
  assert.equal((await diag()).count, 0);
  assert.equal((await state()).wordPending, 0);
  pass("restart cancels pending action without late release or credit");
  for (const [kind, key] of [
    [1, "u"],
    [2, "l"],
    [3, "i"],
    [4, "q"],
  ]) {
    await fixture();
    if (kind < 3) await charge(key);
    else await p.keyboard.press(key, { delay: 50 });
    await focus(kind);
    await wait(
      () => !inscriptionDiagnostics.active && latestState.phase === 1,
      null,
      14000,
    );
    await p.waitForTimeout(900);
    assert.equal((await state()).health, 5);
    assert.equal((await state()).embers, 1);
    assert.equal((await diag()).count, 0);
    assert.equal(await p.evaluate(() => foes[1].hp), 100);
    assert.equal(
      await p.evaluate(() =>
        runEvents.some((e) =>
          ["bowshot", "heavy", "chainstart", "healcomplete"].includes(e.name),
        ),
      ),
      false,
    );
    for (const field of ["bowCool", "bladeCool", "healCool", "ultimateCool"])
      assert.equal((await state())[field], 0);
    pass(
      `timeout cancels skill ${kind} with no delayed damage, heal or cooldown`,
    );
  }
  for (const [kind, key, event] of [
    [1, "u", "bowshot"],
    [2, "l", "heavy"],
  ]) {
    await fixture();
    await p.keyboard.press(key, { delay: 90 });
    await focus(kind);
    assert.ok((await state())[kind === 1 ? "bowCharge" : "chargeTime"] < 0.55);
    await answer(false);
    assert.equal(
      await p.evaluate((name) => runEvents.some((e) => e.name === name), event),
      false,
    );
    await p.keyboard.press(key, { delay: 90 });
    await focus(kind);
    await answer();
    await wait((name) => runEvents.some((e) => e.name === name), event);
    assert.equal((await diag()).count, 1);
    pass(
      `short skill ${kind} requires an answer; a failed cast can immediately be retried`,
    );
  }
  await fixture();
  await charge("u");
  await focus(1);
  await p.keyboard.press("Escape");
  await p.locator("#word-abandon").click();
  await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
  await p.waitForTimeout(250);
  assert.equal(
    await p.evaluate(() => runEvents.some((e) => e.name === "bowshot")),
    false,
  );
  pass("abandon cancels the pending skill without a fallback projectile");
  await p.waitForTimeout(500);
  await p.keyboard.press("F11");
  await wait(() => latestState.phase === 3);
  const pool = (await diag()).pool;
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  assert.deepEqual((await diag()).pool, pool);
  assert.equal((await state()).checkpoint, 2);
  pass("checkpoint death retry preserves word group");
  await p.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  await p.locator("#word-to-menu").click();
  await wait(() => latestState.phase === 0);
  await p.locator("#word-continue").click();
  await wait(() => window.latestState?.phase === 1, null, 45000);
  assert.equal((await state()).checkpoint, 2);
  assert.deepEqual((await diag()).pool, pool);
  pass("saved progress resumes after a full browser reload");
  await p.keyboard.press("F12");
  await wait(() => latestState.phase === 2);
  assert.equal((await diag()).run.won, true);
  assert.ok((await diag()).count < 30);
  pass("victory never requires all 30 words");
  await p.locator("#word-progress").click();
  await p.screenshot({ path: fileURLToPath(new URL("ledger.png", out)) });
  await p.locator("#word-close").click();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
} catch (e) {
  report.state = await state();
  report.active = await diag();
  report.events = await p.evaluate(() => runEvents);
  report.foes = await p.evaluate(() => foes);
  report.errors.push(e.stack);
  console.error(e);
  await p.screenshot({ path: fileURLToPath(new URL("failure.png", out)) });
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
