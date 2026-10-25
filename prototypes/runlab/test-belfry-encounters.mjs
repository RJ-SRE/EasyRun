import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildExpeditionLayout } from "./belfry-expedition.mjs";
import { BANK } from "./public/inscription-core.js";

const layout = buildExpeditionLayout();
const weight = layout.lifts.find((lift) => lift.room === 3);
const left = layout.nodes.findIndex((n) => n.kind === "weight-left");
const right = layout.nodes.findIndex((n) => n.kind === "weight-right");
const out = new URL("./test-results/encounters/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  date: new Date().toISOString(),
  scope:
    "Response-only fixtures arrange production mechanisms, enemies and projectile starting positions. Real F/arrow/grapple input, world collision, AI and word freeze run unchanged. Temporary player protection is used only to observe relay scheduling, not as difficulty evidence.",
  cases: [],
  errors: [],
};
const samples = [],
  events = [];
let current;
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error") report.errors.push(text);
  if (text.startsWith("@encounter ")) {
    const [time, a, b, range, linked, gap, ls, rs, lx, ly, rx, ry] = text
      .slice(11)
      .split(/\s+/);
    current = {
      time: +time,
      a: +a,
      b: +b,
      range: +range,
      linked: linked === "true",
      gap: +gap,
      ls: +ls,
      rs: +rs,
      lx: +lx,
      ly: +ly,
      rx: +rx,
      ry: +ry,
    };
    samples.push(current);
  }
  if (text.startsWith("@event ") || text.startsWith("@enemyEvent "))
    events.push(text);
});
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    'println "@state"',
    `println "@encounter",elapsed,floorY[${weight.floor}],floorY[counterweightFloor],weightRange,hunterLinked,hunterGap,enemyState[hunterLeft],enemyState[hunterRight],enemyX[hunterLeft],enemyY[hunterLeft],enemyX[hunterRight],enemyY[hunterRight]\n println "@state"`,
  );
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
func encounterFixture() {
 startRun(); phase=1; segment=0
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0}
 Hero.invulnerable=0; controlGrace=0
}
func coverFixture(active bool) {
 encounterFixture(); checkpoint=3; weightClock=2; weightRange=1
 if active {roomFlags[3]=3}
 y:=(${weight.low}+${weight.high})/2.0; floorY[${weight.floor}]=y; floorY[counterweightFloor]=y
 Hero.resetHero(495,y-90); Hero.grounded=false; Hero.invulnerable=0
 projectileCount++; boltMade++; Bolt.clone []float64{495,y+120,0,-1500,float64(attempts),1}
}
onKey KeyF7, => {encounterFixture(); checkpoint=3; Hero.resetHero(nodeX[${left}],nodeY[${left}]); health=4}
onKey KeyF8, => {Hero.resetHero(nodeX[${right}],nodeY[${right}])}
onKey KeyF9, => {Hero.resetHero(floorX[counterweightFloor]+62,floorY[counterweightFloor])}
onKey KeyF10, => {coverFixture(true)}
onKey KeyF11, => {coverFixture(false)}
onKey KeyF12, => {
 encounterFixture(); checkpoint=10
 for i:=hunterLeft;i<=hunterRight;i++ {clearEnemyMotion(i); enemyHP[i]=enemyMaxHP(enemyType[i]); enemyState[i]=0; enemyClock[i]=0}
 Hero.resetHero(330,enemyBaseY[hunterLeft]-34); Hero.invulnerable=25
}
onKey KeyG, => {encounterFixture(); checkpoint=1; Hero.resetHero(${layout.checkpoints[2][0]},${layout.checkpoints[2][1]}); health=3}
onKey KeyH, => {encounterFixture(); checkpoint=2; Hero.resetHero(${layout.checkpoints[3][0]},${layout.checkpoints[3][1]}); health=3}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const state = () => page.evaluate(() => window.latestState);
const wait = (fn, timeout = 15000) => page.waitForFunction(fn, {}, { timeout });
async function until(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (fn()) return;
    await page.waitForTimeout(100);
  }
  throw new Error(
    `Encounter observation timed out: ${JSON.stringify(current)}`,
  );
}
async function key(k) {
  await page
    .locator("iframe")
    .evaluate((f) =>
      f.contentWindow.document.querySelector("#game-canvas").focus(),
    );
  await page.keyboard.press(k, { delay: 80 });
}
async function fixture(k) {
  await key(k);
  await page.waitForTimeout(200);
}
async function pass(name, shot) {
  report.cases.push({ name, state: await state(), mechanics: current });
  console.log("PASS", name);
  if (shot)
    await page.screenshot({ path: fileURLToPath(new URL(`${shot}.png`, out)) });
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4184/?words=on");
  await wait(() => window.latestState || window.runtimeErrors?.length, 60000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.locator("#word-enabled").check();
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);

  await fixture("F7");
  await key("f");
  await wait(() => latestState.expedition.flags[3] === 1);
  const start = current.a;
  await until(() => current.a > start + 45);
  assert(Math.abs(current.a + current.b - weight.low - weight.high) < 0.01);
  assert.equal(current.range, 0.45);
  await pass(
    "one real latch starts two coupled platforms with limited travel",
    "01-coupled-weights",
  );
  await fixture("F8");
  const at = samples.length;
  await key("f");
  await wait(() => latestState.expedition.flags[3] === 3);
  await until(() => current.range === 1);
  const expansion = samples.slice(at);
  assert(expansion.some((s) => s.range > 0.45 && s.range < 1));
  for (let i = 1; i < expansion.length; i++)
    assert(
      Math.abs(expansion[i].a - expansion[i - 1].a) < 85,
      "second latch cannot teleport the platforms",
    );
  await fixture("F9");
  const rider = await state(),
    platform = current.b;
  await until(() => Math.abs(current.b - platform) > 35);
  assert(
    Math.abs((await state()).y - current.b) < 20,
    "the reciprocal weight carries the player",
  );
  assert(Math.abs((await state()).y - rider.y) > 20);
  await pass(
    "second latch expands travel smoothly and the opposite platform carries a passenger",
    "02-riding-counterweight",
  );

  await page.keyboard.down("u");
  await page.waitForTimeout(150);
  await page.keyboard.up("u");
  await wait(() => latestState.phase === 5);
  await page.waitForTimeout(150);
  const frozen = { ...current },
    frozenState = await state();
  await page.waitForTimeout(350);
  assert.equal(current.a, frozen.a);
  assert.equal(current.b, frozen.b);
  assert.equal((await state()).y, frozenState.y);
  const q = await page.evaluate(() => inscriptionDiagnostics.active.q),
    word = BANK.get(q.wordId);
  if (q.type === "spell") await page.keyboard.type(word.word);
  else await page.keyboard.press(String(q.options.indexOf(word.meaning) + 1));
  await wait(() => latestState.phase === 1);
  await pass(
    "inscription freezes both linked weights and their rider, then releases the real shot",
  );

  const coverAt = events.length;
  await fixture("F10");
  await until(() =>
    events.slice(coverAt).some((e) => e.startsWith("@event coverimpact ")),
  );
  assert.equal((await state()).health, (await state()).maxHealth);
  await pass(
    "enemy projectile hits active moving cover before reaching the player",
    "03-projectile-cover",
  );
  await fixture("F11");
  await wait(() => latestState.health < latestState.maxHealth);
  await pass(
    "the same projectile hits through an inactive platform; invisible cover cannot protect the player",
  );

  await fixture("F12");
  await until(() => current.linked);
  const relayAt = samples.length,
    eventAt = events.length;
  const pair = [layout.rooms[10].foeStart + 2, layout.rooms[10].foeStart + 3];
  await until(
    () =>
      pair.every((id) =>
        events
          .slice(eventAt)
          .some((e) => e.startsWith(`@enemyEvent tell ${id} `)),
      ),
    25000,
  );
  const coordinated = samples.slice(relayAt).filter((s) => s.linked);
  assert(coordinated.length > 15);
  assert(
    coordinated.every(
      (s) => !([1, 3, 5].includes(s.ls) && [1, 3, 5].includes(s.rs)),
    ),
    "linked hunters must hand off rather than overlap committed attacks",
  );
  await pass(
    "linked hunters both attack with distinct tells and do not overlap their commitments",
    "04-hunter-relay",
  );
  const splitAt = events.length;
  await page.keyboard.down("d");
  await page.keyboard.down("Space");
  await page.waitForTimeout(350);
  await page.keyboard.up("Space");
  await page.keyboard.down("e");
  await page.waitForTimeout(450);
  await page.keyboard.up("e");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  await until(
    () =>
      events.slice(splitAt).some((e) => e.startsWith("@event huntersplit ")),
    10000,
  );
  const splitTime = Number(
    events
      .slice(splitAt)
      .find((e) => e.startsWith("@event huntersplit "))
      .split(/\s+/)[2],
  );
  // Events are emitted in the simulation step; telemetry is sampled every
  // 70 ms. Wait for the corresponding sample instead of asserting against
  // the last sample, which can still predate the actual split.
  await until(() => current.time >= splitTime && current.gap > 0.7);
  assert(samples.some((s) => s.time >= splitTime && s.gap > 0.7));
  await pass(
    "real movement pulls the hunters apart and exposes a measurable regrouping window",
    "05-hunters-separated",
  );

  await fixture("g");
  await wait(() => latestState.checkpoint === 2);
  assert.equal((await state()).health, 3);
  await pass(
    "ordinary room entry saves progress without erasing accumulated damage",
  );
  await fixture("h");
  await wait(() => latestState.checkpoint === 3);
  assert.equal((await state()).health, (await state()).maxHealth);
  await pass(
    "regional rest point restores health independently from room checkpoints",
  );
  assert.deepEqual(report.errors, []);
} finally {
  report.samples = samples;
  report.events = events;
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
