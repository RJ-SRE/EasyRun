import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildExpeditionLayout } from "./belfry-expedition.mjs";
const layout = buildExpeditionLayout();
const out = new URL("./test-results/expedition-quests/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  scope:
    "Position fixtures isolate optional tasks; progress is earned by production F/actions, real collision and real hook input. This is not a whole-route or human-fun test.",
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.text().includes("@event")) console.log(m.text());
});
const keys = ["F7", "F8", "F9", "F10", "F11", "F12", "g", "h", "o", "p"];
const nodes = layout.nodes
  .map((n, i) => ({ ...n, i }))
  .filter((n) => n.side >= 0);
const support = layout.platforms.findIndex((p) => p[3] === 61);
const freight = layout.platforms.findIndex((p) => p[3] === 70);
const guard = layout.enemies.findIndex((e) => e.side === 1);
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func questFixture(n int) {
 phase=1; segment=0; practice=0; chainOwner=-1; bindTime=0; bindEnemy=-1; hitStop=0
 for j:=0;j<len(enemyHP);j++ {enemyHP[j]=0}
 Hero.resetHero(nodeX[n],nodeY[n]); Hero.grounded=true; health=maxHealth
}
${nodes.map((n, i) => `onKey Key${keys[i].toUpperCase()}, => {questFixture(${n.i})${n.side === 1 && n.step === 1 ? `; Hero.px-=80; enemyHP[${guard}]=3; enemyStun[${guard}]=8; enemyX[${guard}]=nodeX[${n.i}]; enemyY[${guard}]=nodeY[${n.i}]+34` : ""}}`).join("\n")}
onKey KeyB, => {segment=2; returnTime=0; riseY=worldBottom-430; Hero.resetHero(floorX[${support}]+100,floorY[${support}]+65); Hero.grounded=false}
onKey KeyN, => {segment=2; returnTime=0; riseY=worldBottom-430; Hero.resetHero(floorX[${freight}]+80,floorY[${freight}]); Hero.grounded=true}
onKey KeyC, => {segment=2; recordChoice=2; returnTime=0; riseY=worldBottom-430}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const state = () => page.evaluate(() => window.latestState);
const wait = (fn, timeout = 15000) => page.waitForFunction(fn, {}, { timeout });
async function key(k) {
  await page
    .locator("iframe")
    .evaluate((f) =>
      f.contentWindow.document.querySelector("#game-canvas").focus(),
    );
  await page.keyboard.press(k, { delay: 70 });
}
async function at(k) {
  await key(k);
  await page.waitForTimeout(160);
}
async function pass(name, shot) {
  report.cases.push({ name, state: await state() });
  console.log("PASS", name);
  if (shot)
    await page.screenshot({ path: fileURLToPath(new URL(shot + ".png", out)) });
}
const achievement = (id) =>
  page.evaluate((id) => window.achievementDiagnostics.data.unlocked[id], id);
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4184/?words=off");
  await wait(() => window.latestState || window.runtimeErrors.length, 60000);
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
  await page.locator("#play").click();
  await wait(() => window.latestState.phase === 1);
  await at("F7");
  const courier = (await state()).x;
  await page.waitForTimeout(650);
  assert(
    Math.abs((await state()).x - courier) > 10,
    "the moving courier floor must carry the player",
  );
  await key("f");
  await wait(() => window.latestState.expedition.sides[0] === 1);
  await at("F8");
  await key("f");
  await wait(() => window.latestState.expedition.sides[0] === 2);
  await at("n");
  const lift = (await state()).y;
  await page.waitForFunction(
    (y) => Math.abs(window.latestState.y - y) > 30,
    lift,
    { timeout: 10000 },
  );
  await pass(
    "moving courier is collected and delivered; the rewarded return freight lift carries a passenger",
    "01-courier-lift",
  );
  await at("F9");
  await key("f");
  await wait(() => window.latestState.expedition.sides[1] === 1);
  await at("F10");
  await key("f");
  await page.waitForTimeout(150);
  assert.equal((await state()).expedition.sides[1], 1);
  assert.equal(await achievement("repaired-way"), undefined);
  for (let i = 0; i < 5; i++) {
    await key("j");
    await page.waitForTimeout(330);
  }
  await page.waitForFunction(
    (n) => window.latestState.expedition.prompt === n,
    nodes[3].i,
  );
  await wait(
    () =>
      window.latestState.attackTime <= 0 && window.latestState.attackKind === 0,
  );
  await page.waitForTimeout(150);
  await key("f");
  await wait(() => window.latestState.expedition.sides[1] === 2);
  assert.equal(await achievement("repaired-way"), undefined);
  await at("b");
  await wait(() => window.runEvents.some((e) => e.name === "repairroute"));
  assert(await achievement("repaired-way"));
  await pass(
    "repair requires a cleared work site; its title is earned only by actually landing on the repaired return support",
    "02-repaired-way",
  );
  await at("F11");
  await key("f");
  await wait(() => window.latestState.expedition.sides[2] === 1);
  assert.equal(await achievement("city-index"), undefined);
  await at("F12");
  await key("f");
  await wait(() => window.latestState.expedition.sides[2] === 2);
  assert(await achievement("city-index"));
  await page.locator("#city-book-open").click();
  assert.match(await page.locator("#city-entries").innerText(), /送信的“苇”/);
  await page.locator("#city-book-close").click();
  await pass(
    "two records reveal named inhabitants in the journal and unlock a cosmetic title",
  );
  await at("g");
  await key("f");
  await wait(() => window.latestState.expedition.sides[3] === 1);
  await at("h");
  await key("f");
  await page.waitForTimeout(150);
  assert.equal((await state()).expedition.sides[3], 1);
  assert.equal(await achievement("hunter-trial"), undefined);
  await at("g");
  // Follow the authored downward trial toward its delivery, using real input.
  // Observe actual attachment before releasing, rather than a wall-clock
  // pulse that can skip a rung and fly out of the trial region.
  const trialStartY = (await state()).y;
  let hooked = -1,
    attachedAt = 0,
    releasedAt = -10,
    holdingE = false;
  await page.keyboard.down("s");
  for (let t = 0; t < 120 && (await state()).expedition.trialHooks < 3; t++) {
    const s = await state();
    const candidates = layout.anchors
      .filter((a) => a[1] < s.y - 40 && a[1] > s.y - 440)
      .sort(
        (a, b) =>
          Math.hypot(a[0] - s.x, a[1] - s.y) -
          Math.hypot(b[0] - s.x, b[1] - s.y),
      );
    const target = candidates[0]?.[0] ?? 480;
    for (const [keyName, down] of [
      ["a", s.x > target + 25],
      ["d", s.x < target - 25],
    ])
      await page.keyboard[down ? "down" : "up"](keyName);
    if (s.hook >= 0) {
      if (s.hook !== hooked) {
        hooked = s.hook;
        attachedAt = s.elapsed;
      }
      if (holdingE && s.elapsed - attachedAt >= 0.12) {
        await page.keyboard.up("e");
        holdingE = false;
        releasedAt = s.elapsed;
      }
    } else {
      hooked = -1;
      if (holdingE) {
        await page.keyboard.up("e");
        holdingE = false;
        releasedAt = s.elapsed;
      } else if (s.elapsed - releasedAt > 0.18) {
        await page.keyboard.down("e");
        holdingE = true;
      }
    }
    await page.waitForTimeout(60);
  }
  for (const k of ["a", "d", "e", "s"]) await page.keyboard.up(k);
  assert(
    (await state()).expedition.trialHooks >= 3,
    "must actually attach to three distinct anchors in one flight",
  );
  assert(
    (await state()).y < trialStartY - 150,
    "the continuous hook route must progress downward toward delivery",
  );
  await at("h");
  await key("f");
  await wait(() => window.latestState.expedition.sides[3] === 2);
  assert(await achievement("hunter-trial"));
  await pass(
    "hunter trial rejects early delivery and accepts three real different anchors before delivery",
    "03-hunter-trial",
  );
  await at("o");
  await key("f");
  await wait(() => window.latestState.expedition.sides[4] === 1);
  await pass(
    "the carried light appears only after collecting the spare core",
    "04-carried-light",
  );
  await at("p");
  await key("f");
  await wait(() => window.latestState.expedition.sides[4] === 2);
  await at("c");
  await pass(
    "delivered lantern restores a return light and directory choice adds wayfinding",
    "05-return-light",
  );
  const before = (await state()).expedition.sides;
  await page.reload();
  await wait(() => window.latestState?.phase === 0, 60000);
  await page.locator("#word-continue").click();
  await wait(
    () => window.latestState?.phase === 1 && window.latestState.segment === 2,
    60000,
  );
  assert.deepEqual((await state()).expedition.sides, before);
  assert(await achievement("hunter-trial"));
  assert(await achievement("city-index"));
  assert(await achievement("repaired-way"));
  await pass(
    "all five optional outcomes and earned titles persist through pure-action resume",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(await page.evaluate(() => window.runtimeErrors), []);
} catch (error) {
  report.failure = String(error);
  report.state = await state();
  report.foes = await page.evaluate(() => window.foes);
  report.events = await page.evaluate(() => window.runEvents);
  await page.screenshot({ path: fileURLToPath(new URL("failure.png", out)) });
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
