import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("./test-results/boss-agility-web/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  cases: [],
  errors: [],
  samples: [],
  fixture:
    "Response-only arena placement and render counters; production movement and sprites.",
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (message) => {
  let text = message.text();
  try {
    text = JSON.parse(text).msg?.trim() || text;
  } catch {
    /* engine text */
  }
  if (text.startsWith("@agility "))
    report.samples.push(text.slice(9).trim().split(/\s+/).map(Number));
});
await page.addInitScript(() => {
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await original(...args);
    if (String(args[0]).includes("belfry.json")) {
      const json = response.json.bind(response);
      response.json = async () => {
        const files = await json();
        files["main.spx"] = files["main.spx"]
          .replace(
            "var (",
            "var (\n agilityStage int\n agilitySize float64\n agilityGhost float64\n agilityClones int",
          )
          .replace(
            "onKey KeyT",
            `
func agilityFixture() {
 startRun(); segment=1; checkpoint=14; bossShield=0; bossStage=agilityStage; bossMendCooldown=999; wordMode=0
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0}
 i:=keeperIndex; clearEnemyMotion(i); enemyHP[i]=bossMaxHP-agilityStage*(bossMaxHP/3); bossHP=enemyHP[i]; enemyX[i]=620; enemyY[i]=enemyBaseY[i]
 Hero.resetHero(510,enemyBaseY[i]-34); Hero.invulnerable=999; Hero.grounded=true
 cameraY=enemyBaseY[i]+105; cameraRenderY=cameraY; Camera.setXYpos 480,cameraY
 prepareKeeperMove(agilityStage*3+1)
}
onKey KeyF6, => {agilityFixture()}
onKey KeyF7, => {agilityStage=(agilityStage+1)%3}
onKey KeyF8, => {println "@agility",bossStage,agilitySize,agilityGhost,agilityClones}
onKey KeyT`,
          );
        files["Enemy.spx"] = files["Enemy.spx"].replace(
          "renderGhost ghost",
          "if kind==3 {agilitySize=size; agilityGhost=ghost}; renderGhost ghost",
        );
        files["EnemyBlend.spx"] = files["EnemyBlend.spx"].replace(
          "i:=int(p[0]);",
          "i:=int(p[0]); if enemyType[i]==3 {agilityClones++};",
        );
        return files;
      };
    }
    return response;
  };
});
const focus = () =>
  page
    .locator("iframe")
    .evaluate((f) =>
      f.contentWindow.document.querySelector("#game-canvas").focus(),
    );
const tap = async (key) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(45);
  await page.keyboard.up(key);
};
try {
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4188") + "/?v=boss-agility",
  );
  await page.waitForFunction(() => window.latestState?.phase === 0, null, {
    timeout: 60000,
  });
  await focus();
  for (let stage = 0; stage < 3; stage++) {
    await tap("F6");
    await page.waitForFunction(
      (stage) =>
        window.latestState.phase === 1 &&
        window.latestState.bossStage === stage,
      stage,
    );
    await page.waitForTimeout(950);
    await tap("F8");
    await page.screenshot({
      path: fileURLToPath(new URL("form-" + stage + ".png", out)),
    });
    await tap("F7");
  }
  assert.ok(
    report.samples.length >= 3,
    "render probes are visible in web runtime",
  );
  assert.deepEqual(
    report.samples.slice(-3).map((s) => s[1]),
    [0.37, 0.34, 0.35],
  );
  assert.ok(report.samples.every((s) => s[2] === 0 && s[3] === 0));
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
  assert.deepEqual(report.errors, []);
  report.cases.push(
    "All three forms render at reduced scale with zero body ghosts in the web runtime",
  );
  await tap("Escape");
  await page.waitForFunction(() => window.latestState.phase === 4);
  await tap("Escape");
  await page.waitForFunction(() => window.latestState.phase === 1);
  report.cases.push("Real pause and resume still work in the Boss arena");
  report.complete = true;
  console.log(report.cases.join("\n"));
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
