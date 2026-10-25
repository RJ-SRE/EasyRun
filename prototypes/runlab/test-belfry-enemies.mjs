import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("./test-results/assassins/", import.meta.url);
await mkdir(out, { recursive: true });
const b = await chromium.launch({ headless: true, channel: "chromium" });
const p = await b.newPage({
  viewport: { width: 1440, height: 1000 },
  recordVideo: process.env.RECORD
    ? { dir: fileURLToPath(out), size: { width: 1440, height: 1000 } }
    : undefined,
});
const report = { date: new Date().toISOString(), cases: [], errors: [] },
  speechRequests = [];
p.on("pageerror", (e) => report.errors.push(e.message));
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
// Only the final group is arranged in the response: the current public mixed
// rehearsal contains the new guard/hound/support group, not a captor.
await p.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
onKey KeyF7, => {
 practiceEncounter(4); Hero.resetHero(570,0); Hero.invulnerable=0
 enemyClock[4]=2
 enemyType[0]=0; enemyBaseX[0]=450; enemyBaseY[0]=65; enemyHP[0]=20; clearEnemyMotion(0); enemyClock[0]=-0.5
 enemyType[8]=8; enemyBaseX[8]=700; enemyBaseY[8]=34; enemyHP[8]=20; clearEnemyMotion(8); enemyClock[8]=-0.5
}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
report.fixture =
  "Single enemies use public rehearsals; final captor/hover/hound group uses response-only initial positions. AI and damage are unchanged.";
const state = () => p.evaluate(() => latestState),
  events = () => p.evaluate(() => runEvents);
const tap = (key) => p.keyboard.press(key, { delay: 35 });
const wait = (f, timeout = 12000) => p.waitForFunction(f, {}, { timeout });
const held = new Set();
async function hold(keys) {
  for (const k of [...held])
    if (!keys.includes(k)) {
      await p.keyboard.up(k);
      held.delete(k);
    }
  for (const k of keys)
    if (!held.has(k)) {
      await p.keyboard.down(k);
      held.add(k);
    }
}
async function pick(n) {
  await hold([]);
  const s = await state();
  if (!s.practice || s.phase !== 1) {
    if (s.phase === 1) {
      await tap("Escape");
      await wait(() => latestState.phase === 4);
    }
    await p.locator("#practice").click();
    await wait(() => latestState.practice === 1 && latestState.phase === 1);
  }
  const previous = (await state()).attempts;
  await p.locator(`[data-spar="${n}"]`).click();
  await p.waitForFunction((a) => latestState.attempts > a, previous);
  await p.waitForTimeout(110);
}
async function move(x) {
  for (let i = 0; i < 100; i++) {
    const s = await state();
    if (Math.abs(s.x - x) < 16) {
      await hold([]);
      await p.waitForTimeout(140);
      return;
    }
    await hold([s.x < x ? "d" : "a"]);
    await p.waitForTimeout(25);
  }
  throw Error("move timed out");
}
async function save(name, extra = {}) {
  report.cases.push({ name, state: await state(), ...extra });
  console.log("PASS", name);
}
async function shot(name) {
  await p.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });
}
try {
  await p.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177/");
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  await p.waitForTimeout(2000);
  assert.equal((await state()).health, 8);
  assert.equal(await p.locator("#dialogue").count(), 0);
  assert.equal(await p.evaluate(() => soundDiagnostics.dialogueEnabled), false);
  await save("safe start and legacy voice settings do not restore dialogue");

  await pick(0);
  await wait(() => runEvents.some((e) => e.name === "enemy_knife"));
  await wait(() => runEvents.some((e) => e.name === "enemy_aircross"));
  await wait(
    () => runEvents.filter((e) => e.name === "enemy_knife").length >= 3,
  );
  assert.ok(
    (await events()).filter((e) => e.name === "enemy_knife").length >= 3,
  );
  await shot("hover-knives");
  await save(
    "hovering assassin alternates single knife and repositioned pursuit knives",
  );

  await pick(1);
  await wait(() => runEvents.some((e) => e.name === "enemy_sweep"));
  const melee = await events();
  for (const name of ["enemy_cut", "enemy_elbow", "enemy_sweep"])
    assert.ok(melee.some((e) => e.name === name));
  await wait(() => latestState.health < 8);
  assert.ok((await state()).health < 8);
  assert.ok(Math.abs((await p.evaluate(() => foes[1].y)) - 34) < 0.1);
  await shot("martial-combo");
  await save(
    "ground assassin plants feet and executes cut-elbow-sweep with real damage",
  );

  await pick(2);
  await move(550);
  await wait(
    () => foes[3]?.state === 1 && foes[3].clock > 0.72 && foes[3].clock < 0.86,
  );
  const aim = await p.evaluate(() => ({ x: foes[3].aimX, y: foes[3].aimY }));
  await hold(["a"]);
  await p.waitForTimeout(60);
  const locked = await p.evaluate(() => ({ x: foes[3].aimX, y: foes[3].aimY }));
  await hold([]);
  assert.deepEqual(locked, aim);
  await wait(() => runEvents.some((e) => e.name === "enemy_arrow"));
  await wait(
    () =>
      foes[3]?.mode === 1 &&
      runEvents.filter((e) => e.name === "enemy_arrow").length >= 2,
  );
  await shot("wall-archer");
  await save(
    "wall archer locks aim before release and alternates arrow weights",
  );

  await pick(3);
  await move(420);
  await wait(() => latestState.chainOwner === 6);
  const beforePull = await state();
  await p.waitForTimeout(160);
  const pulled = await state();
  assert.ok(pulled.x > beforePull.x + 1);
  await tap("j");
  await wait(
    () =>
      latestState.chainOwner === -1 &&
      runEvents.some((e) => e.name === "chaincut"),
  );
  assert.equal((await state()).chainOwner, -1);
  await save("chain connects, pulls physically and light attack cuts it");

  await pick(3);
  await move(420);
  await wait(() => latestState.chainOwner === 6);
  await hold(["e"]);
  await wait(() => latestState.chainOwner === -1);
  await hold([]);
  assert.ok((await events()).some((e) => e.name === "chainfree"));
  await save("permanent anchor grapple releases a tether without energy");

  await pick(4);
  await wait(() => latestState.bindTime > 0.55);
  const captured = await state();
  const captureEvent = (await events()).find((e) => e.name === "bind");
  await hold(["d", "Space", "e", "j", "l", "k", "q"]);
  await p.waitForTimeout(170);
  const blocked = await state();
  assert.ok(blocked.bindTime > 0 && blocked.bindTime < captured.bindTime);
  for (const k of ["x", "y", "health", "energy"])
    assert.equal(blocked[k], captured[k], k);
  assert.equal(blocked.attackKind, 0);
  assert.equal(blocked.hook, -1);
  assert.equal(blocked.chargeTime, 0);
  // Capture timing must not include screenshot/video encoding latency.
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  const frozen = await state();
  assert.ok(frozen.bindTime > 0);
  await save(
    "0.7-second grip blocks movement, jump, grapple, attacks, charge, dash and nova",
    { captured, blocked },
  );
  await p.waitForTimeout(350);
  assert.equal((await state()).bindTime, frozen.bindTime);
  assert.equal(await p.evaluate(() => soundDiagnostics.activeSources), 0);
  await hold([]);
  await save("pause freezes capture and clears active sound");
  await tap("Escape");
  await wait(() => latestState.phase === 1 && latestState.bindTime === 0);
  const release = (await events()).find((e) => e.name === "bindrelease");
  assert.ok(
    Math.abs(release.time - captureEvent.time - 0.7) < 0.04,
    JSON.stringify({ release, captureEvent }),
  );
  assert.ok((await state()).controlImmune > 1.7);
  assert.ok((await state()).controlGrace > 0.15);
  await tap("j");
  await wait(() => runEvents.some((e) => e.name === "light1"));
  await save("capture releases on time, restores input and grants immunity");
  // A separate encounter supplies the visual evidence, outside timed assertions.
  await pick(4);
  await wait(() => latestState.bindTime > 0.55);
  await shot("binder-capture");

  await pick(4);
  await wait(() => foes[4]?.state === 1 && foes[4].clock > 0.25);
  await tap("Space");
  await wait(() => runEvents.some((e) => e.name === "enemy_grabmiss"));
  assert.ok(!(await events()).some((e) => e.name === "bind"));
  await save("jumping the telegraph avoids the grab and exposes recovery");

  await pick(4);
  await wait(() => latestState.bindTime > 0.5);
  await tap("r");
  await wait(() => latestState.practice === 0 && latestState.elapsed < 1);
  for (const k of ["bindTime", "controlImmune", "chainTime"])
    assert.equal((await state())[k], 0);
  assert.equal((await state()).chainOwner, -1);
  await save(
    "restart during capture clears all restraint and stale enemy state",
  );

  await hold([]);
  await tap("F7");
  await p.waitForTimeout(100);
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const s = await state();
    samples.push(s);
    if (s.phase !== 1) break;
    await p.waitForTimeout(65);
  }
  assert.ok(samples.every((s) => s.attackSlots <= 2));
  const grips = samples.filter((s) => s.bindTime > 0);
  assert.ok(
    grips.length > 0,
    "mixed encounter must actually include a capture",
  );
  for (let i = 1; i < samples.length; i++)
    if (samples[i - 1].bindTime > 0 && samples[i].bindTime > 0)
      assert.equal(samples[i].health, samples[i - 1].health);
  await shot("assassin-encounter");
  await save(
    "mixed encounter limits committed attacks and prevents damage during grips",
    { samples: samples.length, grips: grips.length },
  );
  assert.deepEqual(speechRequests, []);
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  await shot("enemy-error");
} finally {
  await hold([]);
  report.final = await p.evaluate(() => ({
    state: latestState,
    events: runEvents,
    foes,
    errors: runtimeErrors,
  }));
  await writeFile(
    new URL("enemies.json", out),
    JSON.stringify(report, null, 2),
  );
  await b.close();
}
