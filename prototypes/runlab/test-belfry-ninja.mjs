import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Read-only public telemetry + real keyboard/pointer input. No engine mutation.
const out = new URL("./test-results/ninja/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  recordVideo: process.env.RECORD
    ? { dir: fileURLToPath(out), size: { width: 1440, height: 1000 } }
    : undefined,
});
const report = { date: new Date().toISOString(), cases: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
const wait = (f, timeout = 18000) => page.waitForFunction(f, {}, { timeout });
const tap = (k) => page.keyboard.press(k, { delay: 25 });
const read = () =>
  page.evaluate(() => ({ state: latestState, foes, events: runEvents }));
const held = new Set();
async function hold(keys) {
  for (const k of [...held])
    if (!keys.includes(k)) {
      await page.keyboard.up(k);
      held.delete(k);
    }
  for (const k of keys)
    if (!held.has(k)) {
      await page.keyboard.down(k);
      held.add(k);
    }
}
async function pick(n) {
  await hold([]);
  const before = (await read()).state.attempts;
  await page.locator(`[data-spar="${n}"]`).click();
  await page.waitForFunction((a) => latestState.attempts > a, before);
}
async function move(x) {
  for (let i = 0; i < 150; i++) {
    const { state: s } = await read();
    if (Math.abs(s.x - x) < 12) {
      await hold([]);
      return;
    }
    await hold([s.x < x ? "d" : "a"]);
    await page.waitForTimeout(25);
  }
  throw Error("move timed out");
}
async function sampleWhile(id, state) {
  const samples = [];
  for (let i = 0; i < 90; i++) {
    const r = await read();
    const f = r.foes[id];
    if (f.state !== state) break;
    samples.push({ ...f, elapsed: r.state.elapsed, heroX: r.state.x });
    await page.waitForTimeout(30);
  }
  assert.ok(samples.length > 2, "must sample actual movement");
  return samples;
}
async function save(name, evidence = {}) {
  report.cases.push({ name, evidence, ...(await read()) });
  console.log("PASS", name);
}
async function shot(name) {
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  // Freeze the pose; hide only the DOM pause menu in this inspection image.
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", out)),
    style: "#overlay { visibility: hidden !important; }",
  });
  await tap("Escape");
  await wait(() => latestState.phase === 1);
}
try {
  await page.goto(
    process.env.RUNLAB_URL || "http://127.0.0.1:4177/belfry.html",
  );
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.locator("#practice").click();
  await wait(() => latestState.practice === 1 && latestState.phase === 1);

  await pick(0);
  await wait(() => foes[0]?.state === 5);
  const air = await sampleWhile(0, 5);
  assert.ok(Math.abs(air.at(-1).x - air[0].x) > 100);
  assert.ok(Math.max(...air.map((f) => f.y)) - air[0].y > 35);
  assert.ok(air.every((f, i) => !i || Math.abs(f.x - air[i - 1].x) < 80));
  await wait(
    () => runEvents.filter((e) => e.name === "enemy_knife").length >= 3,
  );
  await save(
    "hover crosses a continuous aerial arc, then locks a second knife",
    { samples: air },
  );

  await pick(1);
  await wait(() => foes[1]?.state === 5);
  const retreat = await sampleWhile(1, 5);
  assert.ok((retreat.at(-1).x - retreat[0].x) * retreat[0].facing < -55);
  await wait(() => foes[1]?.state === 3 && foes[1]?.mode === 1);
  const kick = await sampleWhile(1, 3);
  assert.ok(Math.max(...kick.map((f) => f.y)) > 85);
  assert.ok(Math.abs(kick.at(-1).x - kick[0].x) > 140);
  assert.ok(kick.some((f) => f.step === 1));
  await wait(() => foes[1]?.state === 2);
  assert.ok(Math.abs((await read()).foes[1].y - 34) < 1);
  await save("martial assassin retreats, leaps into a kick, lands and sweeps", {
    retreat,
    kick,
  });

  // Approach during the visible backstep. The guard is scheduled independently
  // of our buttons, and protects only its first frontal light contact.
  await pick(1);
  await wait(() => foes[1]?.state === 5);
  await hold(["d"]);
  await wait(() => foes[1]?.state === 1);
  await page.waitForTimeout(90);
  await tap("j");
  await hold([]);
  await wait(() => runEvents.some((e) => e.name === "enemy_parry"));
  assert.equal((await read()).foes[1].hp, 20);
  await save("visible guard parries a frontal light strike without losing HP");

  await pick(1);
  await wait(() => foes[1]?.state === 5);
  await hold(["d", "l"]);
  await wait(() => foes[1]?.state === 1);
  await page.waitForTimeout(50);
  await hold([]);
  await wait(() => runEvents.some((e) => e.name === "enemy_guardbreak"));
  await wait(() => foes[1]?.hp < 20 && foes[1]?.state === 2);
  await save(
    "heavy strike breaks the same stance and interrupts its counterattack",
  );

  await pick(2);
  await move(550);
  await wait(() => foes[3]?.state === 1 && foes[3]?.mode === 1);
  const wallOrigin = (await read()).foes[3];
  await wait(() => foes[3]?.state === 3 && foes[3]?.mode === 1);
  const wall = await sampleWhile(3, 3);
  // Telemetry is sampled every 70 ms; the first airborne sample is already
  // moving. Measure displacement from the observed anticipation position.
  assert.ok(Math.max(...wall.map((f) => f.y)) - wallOrigin.y > 55);
  assert.ok(Math.max(...wall.map((f) => Math.abs(f.x - wallOrigin.x))) > 110);
  await wait(() => foes[3]?.state === 2);
  const wallReturn = (await read()).foes[3];
  // The last state-3 sample can precede landing by a full telemetry tick.
  // Verify the actual recovery position instead of assuming that sample landed.
  assert.ok(Math.abs(wallReturn.x - wallOrigin.x) < 40);
  assert.ok(Math.abs(wallReturn.y - wallOrigin.y) < 2);
  assert.ok((await read()).events.some((e) => e.name === "enemy_airshot"));
  await save(
    "archer wall-kicks, releases in midair and returns along a visible arc",
    { origin: wallOrigin, samples: wall, landing: wallReturn },
  );

  await pick(3);
  await move(530);
  await wait(() => latestState.chainOwner === 6);
  await tap("j");
  await wait(() => latestState.chainOwner === -1);
  await wait(() => foes[6]?.state === 1 && foes[6]?.mode === 1);
  const healthBefore = (await read()).state.health;
  await wait(() => latestState.health < latestState.maxHealth);
  assert.ok((await read()).state.health < healthBefore);
  await wait(() => foes[6]?.state === 1 && foes[6]?.mode === 2);
  await save(
    "low chain sweep deals damage on the ground and links into a telegraphed cast",
  );

  await pick(3);
  await move(530);
  await wait(() => latestState.chainOwner === 6);
  await tap("j");
  await wait(() => latestState.chainOwner === -1);
  await wait(
    () => foes[6]?.state === 1 && foes[6]?.mode === 1 && foes[6]?.clock > 0.6,
  );
  const beforeJump = (await read()).state.health;
  await tap("Space");
  await wait(() => foes[6]?.state === 1 && foes[6]?.mode === 2);
  assert.equal((await read()).state.health, beforeJump);
  await save("jumping the low chain sweep avoids damage");

  await pick(4);
  await wait(() => latestState.bindTime > 0.5);
  await wait(() => latestState.bindTime === 0);
  await wait(() => foes[4]?.state === 5);
  const flank = await sampleWhile(4, 5);
  assert.ok(
    (flank[0].x - flank[0].heroX) * (flank.at(-1).x - flank.at(-1).heroX) < 0,
  );
  assert.ok(flank.every((f, i) => !i || Math.abs(f.x - flank[i - 1].x) < 80));
  await wait(() => foes[4]?.state === 1 && foes[4].clock > 0.36);
  await tap("Space");
  await wait(() => runEvents.some((e) => e.name === "enemy_grabmiss"));
  assert.equal(
    (await read()).events.filter((e) => e.name === "bind").length,
    1,
  );
  await save(
    "binder visibly flanks, commits a new direction, and can still be jumped",
    { samples: flank },
  );

  await pick(1);
  await wait(() => foes[1]?.state === 5);
  await tap("q");
  await wait(() => foes[1]?.state === 2 && foes[1].hp < 20);
  assert.ok(!(await read()).events.some((e) => e.name === "enemy_flyingkick"));
  await save(
    "repositioning is vulnerable: nova interrupts the maneuver before its kick",
  );

  await pick(0);
  await wait(() => foes[0]?.state === 5);
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  const paused = (await read()).foes[0];
  await page.waitForTimeout(350);
  const afterPause = (await read()).foes[0];
  for (const k of ["x", "y", "clock", "state"])
    assert.equal(afterPause[k], paused[k]);
  await tap("r");
  await wait(() => latestState.phase === 1 && latestState.practice === 0);
  assert.equal((await read()).state.bindTime, 0);
  await save("pause freezes footwork and restart clears the maneuver");

  // Capture the new silhouettes while paused, outside timing assertions.
  await tap("Escape");
  await page.locator("#practice").click();
  await wait(() => latestState.practice === 1 && latestState.phase === 1);
  await pick(1);
  await wait(
    () =>
      foes[1]?.state === 3 &&
      foes[1]?.mode === 1 &&
      foes[1]?.clock > 0.14 &&
      foes[1]?.clock < 0.3,
  );
  await shot("flying-kick");
  await pick(2);
  await move(550);
  await wait(
    () =>
      foes[3]?.state === 3 &&
      foes[3]?.mode === 1 &&
      foes[3]?.clock > 0.3 &&
      foes[3]?.clock < 0.52,
  );
  await shot("wall-kick-shot");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.failure = e.stack;
  report.last = await read().catch(() => null);
  await page
    .screenshot({ path: fileURLToPath(new URL("failure.png", out)) })
    .catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await hold([]).catch(() => {});
  await writeFile(new URL("ninja.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
