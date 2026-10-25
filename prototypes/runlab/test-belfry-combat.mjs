import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("./test-results/combat/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    recordVideo: process.env.RECORD
      ? { dir: fileURLToPath(out), size: { width: 1440, height: 1000 } }
      : undefined,
  });
const report = { date: new Date().toISOString(), cases: [], errors: [] };
const speechRequests = [];
page.on("request", (r) => {
  if (/belfry-(dialogue|director)\.js|\/audio\/(voice|v06)\//.test(r.url()))
    speechRequests.push(r.url());
});
await page.addInitScript(() => {
  if (!localStorage.getItem("audio-migration-tested")) {
    localStorage.setItem(
      "belfry-audio-v2",
      JSON.stringify({
        sfx: 0.8,
        music: 0.35,
        voice: 1,
        chatter: "chatty",
        subtitles: "both",
      }),
    );
    localStorage.setItem("audio-migration-tested", "1");
  }
});
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const state = () => page.evaluate(() => latestState);
const events = () => page.evaluate(() => runEvents);
async function wait(f, timeout = 10000) {
  await page.waitForFunction(f, {}, { timeout });
}
async function tap(k, delay = 35) {
  await page.keyboard.press(k, { delay });
}
async function save(name) {
  report.cases.push({
    name,
    state: await state(),
    foes: await page.evaluate(() => foes),
  });
  console.log("PASS", name);
}
async function practice() {
  if ((await state()).phase === 1) {
    await tap("Escape");
    await wait(() => latestState.phase === 4);
  }
  await page.locator("#practice").click();
  await wait(() => latestState.practice === 1 && latestState.elapsed < 0.4);
  await page.waitForTimeout(120);
}
async function approach() {
  await page.keyboard.down("d");
  await page.waitForTimeout(480);
  await page.keyboard.up("d");
  await page.waitForTimeout(90);
}
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177/");
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await practice();
  await approach();
  await tap("j");
  await page.waitForTimeout(160);
  await tap("j");
  await page.waitForTimeout(190);
  await tap("j");
  await page.waitForTimeout(440);
  const chain = await events();
  for (const n of ["light1", "light2", "finisher"])
    assert.ok(
      chain.some((e) => e.name === n),
      n,
    );
  assert.ok((await page.evaluate(() => foes[0]?.hp)) < 20);
  await save("three-step buffered chain causes damage at strike frames");
  await page.screenshot({ path: fileURLToPath(new URL("combo.png", out)) });
  await practice();
  await approach();
  await page.keyboard.down("j");
  await page.waitForTimeout(850);
  await page.keyboard.up("j");
  assert.equal(
    (await events()).filter(
      (e) =>
        e.name === "light1" || e.name === "light2" || e.name === "finisher",
    ).length,
    1,
  );
  await save("holding light attack does not auto-repeat");
  await practice();
  await approach();
  await page.keyboard.down("w");
  await tap("j");
  await page.keyboard.up("w");
  await page.waitForTimeout(170);
  await tap("j");
  await page.waitForTimeout(230);
  await tap("j");
  await page.waitForTimeout(300);
  const air = await events();
  assert.ok(air.some((e) => e.name === "launchhit"));
  assert.ok(air.some((e) => e.name === "aircut"));
  assert.ok((await state()).y > 30);
  await save("launcher lifts enemy and player into aerial follow-up");
  await page.screenshot({ path: fileURLToPath(new URL("air.png", out)) });
  await practice();
  await approach();
  await page.keyboard.down("l");
  await page.waitForTimeout(650);
  assert.ok((await state()).chargeTime > 0.5);
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  const frozen = await state();
  await page.waitForTimeout(500);
  assert.equal((await state()).chargeTime, frozen.chargeTime);
  assert.equal(
    (await page.evaluate(() => soundDiagnostics)).dialogueEnabled,
    false,
  );
  await page.keyboard.up("l");
  await tap("Escape");
  await wait(() => latestState.phase === 1);
  await page.waitForTimeout(400);
  assert.ok((await events()).some((e) => e.name === "charged"));
  await save(
    "charge freezes during pause, releases into heavy strike on resume",
  );
  await page.waitForTimeout(600);
  assert.ok((await events()).some((e) => e.name === "collision"));
  await save("heavy strike throws an enemy into another enemy");
  await practice();
  await approach();
  await tap("j");
  await page.waitForTimeout(180);
  await tap("k");
  await page.waitForTimeout(120);
  assert.ok((await events()).some((e) => e.name === "dash"));
  await save("light recovery cancels into dash");
  await practice();
  await tap("q");
  await page.waitForTimeout(1350);
  assert.equal((await state()).ultimateTime, 0);
  assert.equal((await state()).attackTime, 0);
  await save("five-hit ultimate active window expires without another input");
  await tap("r");
  await wait(() => latestState.practice === 0 && latestState.elapsed < 1);
  assert.equal((await state()).attackKind, 0);
  assert.equal((await state()).chargeTime, 0);
  await save("full restart clears charge, combo and practice");
  await page.locator("#audio-settings").click();
  await wait(() => latestState.phase === 4);
  await page.locator("#setting-sfx").fill("0.5");
  await page.locator("#setting-music").fill("0.2");
  assert.equal(
    await page
      .locator("#dialogue,#setting-voice,#setting-chatter,#setting-subtitles")
      .count(),
    0,
  );
  await page.locator("#close-settings").click();
  await wait(() => latestState.phase === 1);
  await save(
    "sound settings retain only effects and music; former voice controls are absent",
  );
  await practice();
  await wait(() => soundDiagnostics.cached === 82, 15000);
  await tap("j");
  await page.waitForTimeout(250);
  assert.ok(
    (await page.evaluate(() => soundDiagnostics.fx)).some(
      (x) => x.cue === "blade",
    ),
  );
  assert.deepEqual(await page.evaluate(() => soundDiagnostics.errors), []);
  await page.locator("#sound").click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => soundDiagnostics.activeSources), 0);
  assert.equal(await page.evaluate(() => soundDiagnostics.enabled), false);
  await page.locator("#sound").click();
  await save("blade effects play and global mute clears active sources");
  const decoded = await page.evaluate(async () => {
    const c = new AudioContext(),
      m = await (await fetch("/audio/sfx/manifest.json")).json(),
      result = [];
    for (const f of m.files) {
      const r = await fetch(f.file);
      if (!r.ok) throw new Error(f.id);
      const b = await c.decodeAudioData(await r.arrayBuffer());
      result.push({ id: f.id, duration: b.duration });
    }
    await c.close();
    return result;
  });
  assert.equal(decoded.length, 82);
  report.audio = decoded;
  await save("all 82 retained effects decode without loading any voice pack");
  await page.reload();
  await wait(() => latestState || runtimeErrors.length, 45000);
  assert.deepEqual(await page.evaluate(() => soundDiagnostics.settings), {
    sfx: 0.5,
    music: 0.2,
  });
  assert.equal(
    await page.evaluate(() => soundDiagnostics.dialogueEnabled),
    false,
  );
  assert.deepEqual(speechRequests, []);
  await save(
    "reload preserves music/effects preferences and never fetches dialogue or speech",
  );
  const fallback = await browser.newPage();
  await fallback.route("**/audio/sfx/*.m4a", (route) =>
    route.fulfill({
      status: 200,
      contentType: "audio/mp4",
      body: "invalid audio fixture",
    }),
  );
  await fallback.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177/");
  await fallback.waitForFunction(
    () => window.latestState?.phase === 0,
    {},
    { timeout: 45000 },
  );
  await fallback.locator("#play").click();
  await fallback.waitForFunction(
    () =>
      window.soundDiagnostics.errors.length > 0 &&
      window.latestState.phase === 1,
  );
  assert.equal(await fallback.evaluate(() => latestState.phase), 1);
  assert.equal(await fallback.locator("#dialogue").count(), 0);
  assert.deepEqual(await fallback.evaluate(() => runtimeErrors), []);
  await fallback.close();
  await save(
    "failed effects decoding leaves gameplay operational and cannot create dialogue",
  );
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  await page.screenshot({ path: fileURLToPath(new URL("error.png", out)) });
} finally {
  report.sound = await page.evaluate(() => window.soundDiagnostics);
  await writeFile(new URL("combat.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
