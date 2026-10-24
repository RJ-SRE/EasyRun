import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const output = new URL("./test-results/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
const results = {
  date: new Date().toISOString(),
  browser: browser.version(),
  cases: [],
  errors: [],
};
page.on("pageerror", (e) => results.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") results.errors.push(m.text());
  if (m.text().includes("@event")) console.log(m.text());
});
const state = () => page.evaluate(() => window.latestState);
async function ready() {
  await page.waitForFunction(
    () => window.latestState?.phase === 0 || window.runtimeErrors.length,
    {},
    { timeout: 20000 },
  );
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
}
async function start() {
  await page.locator("#play").click();
  await page.waitForFunction(() => window.latestState?.phase === 1);
}
async function at(x) {
  await page.waitForFunction(
    (x) => window.latestState?.x >= x || window.latestState?.phase !== 1,
    x,
    { timeout: 16000 },
  );
  const s = await state();
  assert.equal(s.phase, 1, `Failed before ${x}: ${JSON.stringify(s)}`);
  return s;
}
async function tap(k) {
  await page.keyboard.press(k, { delay: 60 });
}
async function snapshot(name) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", output)),
    fullPage: true,
  });
}
async function result(name) {
  const s = await state();
  results.cases.push({
    name,
    state: s,
    events: await page.evaluate(() => runEvents),
    errors: await page.evaluate(() => runtimeErrors),
  });
  console.log("CASE", name, JSON.stringify(s));
  await snapshot(name);
}
try {
  await page.goto(
    new URL("/legacy.html", process.env.RUNLAB_URL || "http://127.0.0.1:4177/")
      .href,
  );
  await ready();
  await snapshot("velocity-ready");
  await start();
  await tap("Escape");
  await page.waitForFunction(() => window.latestState.phase === 4);
  const frozen = (await state()).elapsed;
  await page.waitForTimeout(300);
  assert.equal((await state()).elapsed, frozen);
  await tap("Escape");
  await page.waitForFunction(() => window.latestState.phase === 1);
  await page.keyboard.down("d");
  for (const [take, launch] of [
    [820, 1025],
    [2590, 2785],
    [4500, 4695],
  ]) {
    await at(take);
    await tap("e");
    await page.waitForFunction(
      () => window.latestState.energy === 1 || window.latestState.phase !== 1,
      {},
      { timeout: 2000 },
    );
    assert.equal((await state()).energy, 1);
    await at(launch);
    await tap("e");
    if (launch === 1025) await snapshot("velocity-launch");
  }
  await page.waitForFunction(
    () => window.latestState.phase !== 1,
    {},
    { timeout: 16000 },
  );
  await page.keyboard.up("d");
  await result("velocity-finish");
  assert.equal((await state()).phase, 2);
  await page.locator('[data-feedback="again"]').click();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("runlab-v1")).at(-1).feedback,
    ),
    "again",
  );
  await start();
  await page.keyboard.down("d");
  await page.waitForFunction(
    () => window.latestState.phase === 3,
    {},
    { timeout: 6000 },
  );
  await page.keyboard.up("d");
  await result("velocity-fall");
  assert.equal((await state()).failReason, 1);
  await tap("r");
  await page.waitForFunction(
    () => window.latestState.phase === 1 && window.latestState.x < 150,
  );
  await result("velocity-retry");
  await page.locator('[data-select="cinema"]').click();
  await ready();
  await snapshot("cinema-ready");
  await start();
  await page.keyboard.down("d");
  for (const [vault, slideStart, slideEnd, jump] of [
    [810, 1750, 2080, 2745],
    [4210, 5170, 5510, 5990],
  ]) {
    await at(vault);
    await tap("e");
    await at(slideStart);
    await page.keyboard.down("s");
    await at(slideEnd);
    await page.keyboard.up("s");
    await at(jump);
    await page.keyboard.down("Space");
    await page.waitForTimeout(110);
    await tap("e");
    await page.waitForTimeout(550);
    await page.keyboard.up("Space");
  }
  await page.waitForFunction(
    () => window.latestState.phase !== 1,
    {},
    { timeout: 10000 },
  );
  await page.keyboard.up("d");
  await result("cinema-finish");
  assert.equal((await state()).phase, 2);
  assert.equal((await state()).styleCount, 6);
  await start();
  await page.keyboard.down("d");
  await page.waitForFunction(
    () => window.latestState.phase === 3,
    {},
    { timeout: 6000 },
  );
  await page.keyboard.up("d");
  await result("cinema-crate");
  assert.equal((await state()).failReason, 2);
  await page.locator("#play").click();
  await page.waitForFunction(
    () => window.latestState.phase === 1 && window.latestState.x < 150,
  );
  await result("cinema-retry");
  await page.locator("#pause").click();
  await page.waitForFunction(() => window.latestState.phase === 4);
  await page.locator("#play").click();
  await page.waitForFunction(() => window.latestState.phase === 1);
  await page.locator('[data-select="velocity"]').click();
  await ready();
  assert.match(await page.locator("#best").innerText(), /本机最快/);
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.waitForTimeout(150);
  const size = await page.evaluate(() => ({
    a: document.querySelector("iframe").getBoundingClientRect().width,
    b: document.querySelector("#viewport").clientWidth,
  }));
  assert.ok(Math.abs(size.a - size.b) < 1);
  await snapshot("responsive");
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (e) {
  results.passed = false;
  results.failure = e.stack;
  console.log("FAILED", e.stack);
  await snapshot("failure");
} finally {
  await writeFile(
    new URL("playtest.json", output),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
if (!results.passed) process.exitCode = 1;
