import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildExpeditionLayout } from "./belfry-expedition.mjs";
import { sceneCloneCount } from "./belfry-scene.mjs";
const layout = buildExpeditionLayout();
const out = new URL("./test-results/scene/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  scope:
    "Production renderer/clone births and real input/arrow collision. Response-only camera fixtures visit all rooms in both directions; effect stress deliberately requests more decoration than the pool admits. This is not a natural-route or frame-rate benchmark.",
};
page.on("pageerror", (e) => report.errors.push(e.message));
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"]
    .replace("var (", "var (\n sceneTestRoom int\n")
    .replace(
      "onKey KeyT",
      `
onKey KeyF7, => {phase=4; sceneTestRoom=(sceneTestRoom+1)%15; Hero.resetHero(checkpointX[sceneTestRoom],checkpointY[sceneTestRoom]); cameraY=roomTop[sceneTestRoom]-420; Camera.setXYpos 480,cameraY}
onKey KeyF8, => {segment=2; recordChoice=2; for i:=0;i<len(sideProgress);i++ {sideProgress[i]=2}; for i:=0;i<len(enemyHP);i++ {if enemyReturnOnly[i]==1 {enemyHP[i]=4}}}
onKey KeyF9, => {startPractice(); for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0; enemyBaseY[i]=-7000}; enemyHP[0]=400; enemyBaseX[0]=600; enemyBaseY[0]=45; enemyClock[0]=-1000; clearEnemyMotion(0); Hero.resetHero(310,0)}
onKey KeyF10, => {burst(Hero.px,Hero.py+30,240,1,300)}
onKey KeyT`,
    );
  await route.fulfill({ json: data });
});
const wait = (fn) => page.waitForFunction(fn, {}, { timeout: 45000 });
const render = () => page.evaluate(() => window.renderState);
async function tap(key) {
  await page.keyboard.press(key, { delay: 55 });
}
async function check(name) {
  const r = await render();
  assert.equal(
    r.sceneBorn,
    sceneCloneCount(layout),
    "every scene clone really started",
  );
  assert.equal(r.sceneClones, r.sceneBorn);
  assert.equal(r.missing, 0, "nearby world data all have render slots");
  assert(r.effects >= 0 && r.projectiles >= 0);
  assert(r.sceneBorn + r.effects + r.projectiles < 300);
  report.cases.push({ name, render: r });
  console.log("PASS", name, JSON.stringify(r));
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4184/?words=off");
  await wait(() => window.latestState || window.runtimeErrors.length);
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
  await page.locator("#play").click();
  await wait(
    () =>
      window.latestState.phase === 1 && window.renderState?.sceneBorn === 167,
  );
  await check(
    "all scene clones start, including late-created mechanisms and telegraphs",
  );
  for (let direction = 0; direction < 2; direction++) {
    if (direction) await tap("F8");
    for (let room = 0; room < 15; room++) {
      await tap("F7");
      await page.waitForTimeout(130);
      await check(
        `${direction ? "return" : "descent"} camera room ${((room + 1) % 15) + 1}`,
      );
      if (!direction && [3, 7, 13].includes(room))
        await page.screenshot({
          path: fileURLToPath(new URL(`room-${room + 2}.png`, out)),
        });
    }
  }
  await tap("F9");
  await wait(() => window.latestState.practice === 1);
  await tap("F10");
  const before = await render();
  await page.keyboard.down("u");
  await wait(() => window.latestState.bowCharge >= 0.6);
  await page.keyboard.up("u");
  await wait(() => window.foes[0]?.mark > 0);
  await wait(
    () => window.renderState.arrowsBorn === window.renderState.arrowsRequested,
  );
  assert((await render()).arrowsBorn > before.arrowsBorn);
  await check(
    "charged arrow actually exists and hits after excess decoration requests",
  );
  for (let i = 0; i < 32; i++) {
    if (i % 6 === 0) await tap("F10");
    await tap("u");
    await page.waitForTimeout(30);
  }
  await wait(
    () =>
      window.renderState.projectiles === 0 && window.renderState.effects === 0,
  );
  const after = await render();
  assert(after.arrowsRequested >= before.arrowsRequested + 20);
  assert.equal(after.arrowsRequested, after.arrowsBorn);
  assert.equal(after.boltsRequested, after.boltsBorn);
  await check(
    "rapid real bow inputs never lose arrows and all transient clones retire",
  );
  for (let i = 0; i < 6; i++) {
    await tap("r");
    await tap("F9");
  }
  await page.waitForTimeout(1100);
  await check(
    "restarts and practice remap existing views without accumulating clones",
  );
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error.stack || error);
  console.error(error);
  process.exitCode = 1;
  await page
    .screenshot({ path: fileURLToPath(new URL("failure.png", out)) })
    .catch(() => {});
} finally {
  report.final = await render().catch(() => null);
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
