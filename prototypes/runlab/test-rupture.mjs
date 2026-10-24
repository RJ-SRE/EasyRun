import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const output = new URL("./test-results/", import.meta.url);
await mkdir(output, { recursive: true });
const b = await chromium.launch({ headless: true, channel: "chromium" }),
  p = await b.newPage({ viewport: { width: 1440, height: 1050 } });
const report = {
  date: new Date().toISOString(),
  browser: b.version(),
  cases: [],
  errors: [],
};
p.on("pageerror", (e) => report.errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
  if (m.text().includes("@event")) console.log(m.text());
});
const state = () => p.evaluate(() => latestState);
async function at(x) {
  await p.waitForFunction(
    (x) => latestState?.x >= x || latestState?.phase !== 1,
    x,
    { timeout: 12000 },
  );
  assert.equal(
    (await state()).phase,
    1,
    `Failed before ${x}: ${JSON.stringify(await state())}`,
  );
}
async function tap(k) {
  await p.keyboard.press(k, { delay: 65 });
  await p.waitForTimeout(45);
}
async function start() {
  await p.locator("#play").click();
  await p.waitForFunction(() => latestState?.phase === 1);
}
async function shot(name) {
  await p.screenshot({
    path: fileURLToPath(new URL("rupture-" + name + ".png", output)),
    fullPage: true,
  });
}
async function save(name) {
  report.cases.push({
    name,
    state: await state(),
    events: await p.evaluate(() => runEvents),
    errors: await p.evaluate(() => runtimeErrors),
  });
  await shot(name);
}
async function firstGap() {
  await p.keyboard.down("d");
  await at(650);
  await tap("e");
  assert.equal((await state()).energy, 1);
  await at(900);
  await tap("e");
  await at(1450);
}
try {
  await p.goto(
    new URL("/rupture.html", process.env.RUNLAB_URL || "http://127.0.0.1:4177/")
      .href,
  );
  await p.waitForFunction(
    () => latestState?.phase === 0 || runtimeErrors.length,
    {},
    { timeout: 20000 },
  );
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  await shot("ready");
  await start();
  await firstGap();
  assert.ok((await state()).rotorCool > 0);
  await at(1870);
  await tap("e");
  await at(1970);
  await tap("e");
  await at(2750);
  await p.keyboard.up("d");
  await p.waitForTimeout(300);
  assert.ok((await state()).bridgeY < -150);
  const frozen = (await state()).liftY;
  await p.waitForTimeout(250);
  assert.equal((await state()).liftY, frozen);
  await save("low-route");
  await p.keyboard.down("d");
  await p.waitForFunction(() => latestState.phase !== 1, {}, { timeout: 5000 });
  await p.keyboard.up("d");
  assert.equal((await state()).phase, 2);
  assert.equal((await state()).steals, 2);
  await save("finish");
  await start();
  await p.keyboard.down("d");
  await p.waitForFunction(() => latestState.phase === 3, {}, { timeout: 5000 });
  await p.keyboard.up("d");
  assert.equal((await state()).failReason, 4);
  await save("rotor-failure");
  await tap("r");
  await p.waitForFunction(() => latestState.phase === 1 && latestState.x < 200);
  await tap("Escape");
  await p.waitForFunction(() => latestState.phase === 4);
  const paused = (await state()).elapsed;
  await p.waitForTimeout(200);
  assert.equal((await state()).elapsed, paused);
  await tap("Escape");
  await p.waitForFunction(() => latestState.phase === 1);
  await firstGap();
  await at(1870);
  await tap("e");
  await p.keyboard.down("w");
  await tap("e");
  await p.waitForTimeout(720);
  await p.keyboard.up("w");
  await at(2380);
  assert.equal(
    (await state()).styleCount,
    1,
    "Upper route should collect echo",
  );
  await p.keyboard.down("Space");
  await p.waitForTimeout(900);
  await p.keyboard.up("Space");
  await p.waitForFunction(() => latestState.phase !== 1, {}, { timeout: 6000 });
  await p.keyboard.up("d");
  assert.equal((await state()).phase, 2);
  await save("upper-finish");
  await p.locator('[data-feedback="again"]').click();
  assert.equal(
    await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("runlab-rupture-v2")).at(-1).feedback,
    ),
    "again",
  );
  await p.locator("#fullscreen").click();
  await p.waitForFunction(() => !!document.fullscreenElement);
  await p.evaluate(() => document.exitFullscreen());
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  console.log(e.stack);
  await shot("failure");
} finally {
  await writeFile(
    new URL("rupture-tests.json", output),
    JSON.stringify(report, null, 2),
  );
  await b.close();
}
if (!report.passed) process.exitCode = 1;
