import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  InscriptionBook,
  STORAGE_KEY,
  BANK,
} from "./public/inscription-core.js";

const out = new URL("./test-results/inscription-motion/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ...(process.env.RECORD_MOTION === "1"
    ? {
        recordVideo: {
          dir: fileURLToPath(out),
          size: { width: 1280, height: 800 },
        },
      }
    : {}),
});
const p = await context.newPage();
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  cases: [],
  errors: [],
  timing: {},
  note: "Real opening platform, real keyboard inputs; seeded vocabulary only. Frame timings are local headless measurements, not a device-wide performance guarantee.",
};
p.on("pageerror", (e) => report.errors.push(e.message));
const book = new InscriptionBook(null, 4); // create; final E must not become grapple
book.settings.hint = "guided";
await p.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
  key: STORAGE_KEY,
  value: book.serialize(),
});
const wait = (fn, timeout = 12000) => p.waitForFunction(fn, {}, { timeout });
const read = () =>
  p.evaluate(() => ({
    state: latestState,
    word: inscriptionDiagnostics,
    audio: soundDiagnostics,
  }));
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function charge() {
  await p.keyboard.down("u");
  await wait(() => latestState.bowCharge >= 0.6);
  await p.keyboard.up("u");
  await wait(() => inscriptionDiagnostics.active && latestState.phase === 5);
}
try {
  await p.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177/");
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    45000,
  );
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  await charge();
  const before = await read();
  await p.evaluate(() => {
    window.motionFrames = [];
    let last = window.performance.now();
    function frame(t) {
      window.motionFrames.push(t - last);
      last = t;
      if (window.motionFrames.length < 100) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  await p.waitForTimeout(800);
  const during = await read();
  for (const k of [
    "x",
    "y",
    "health",
    "elapsed",
    "bowCool",
    "bladeCool",
    "healCool",
    "ultimateCool",
    "riseY",
    "returnTime",
  ])
    assert.equal(during.state[k], before.state[k], `protected ${k}`);
  assert.ok(during.word.motion.frames > before.word.motion.frames + 8);
  assert.ok(during.word.motion.zoom > 1.02 && during.word.motion.zoom <= 1.025);
  assert.equal(during.audio.focusActive, true);
  pass(
    "live focus motion and tension audio while damage, physics and cooldowns remain frozen",
  );
  await p.keyboard.type("cre", { delay: 150 });
  assert.equal((await read()).word.motion.progress, 0.5);
  await p.screenshot({ path: fileURLToPath(new URL("focus.png", out)) });
  pass("correct letters charge the hero effect without advancing combat");
  await p.locator("#sound").click();
  await p.waitForTimeout(80);
  assert.equal((await read()).audio.enabled, false);
  assert.equal((await read()).audio.activeSources, 0);
  await p.locator("#sound").click();
  await p.waitForTimeout(80);
  assert.equal((await read()).audio.enabled, true);
  assert.equal((await read()).audio.focusActive, true);
  pass("mute clears focus sources and unmute preserves the pending challenge");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(120);
  const frozen = await read();
  await p.waitForTimeout(220);
  const paused = await read();
  assert.equal(paused.word.motion.age, frozen.word.motion.age);
  assert.equal(paused.state.cameraY, frozen.state.cameraY);
  assert.equal(paused.word.active.elapsed, frozen.word.active.elapsed);
  assert.equal(paused.audio.focusActive, false);
  assert.equal(paused.audio.activeSources, 0);
  await p.locator("#word-resume").click();
  await p.keyboard.type("at", { delay: 150 });
  await p.keyboard.down("e");
  await wait(() => !inscriptionDiagnostics.active && latestState.phase === 1);
  report.timing.successReleaseMs = (await read()).word.lastRelease.responseMs;
  assert.ok(
    report.timing.successReleaseMs < 350,
    "no presentation hold before release",
  );
  assert.equal((await read()).state.hook, -1);
  assert.equal((await read()).word.count, 1);
  await p.keyboard.press("Space", { delay: 35 });
  await wait(() => latestState.y > 10);
  await p.screenshot({ path: fileURLToPath(new URL("release.png", out)) });
  await p.keyboard.up("e");
  pass(
    "pause freezes presentation too; successful release immediately accepts fresh movement without leaking final E",
  );
  await wait(() => inscriptionDiagnostics.motion.mode === "idle");
  assert.equal(
    await p.locator("#stage").evaluate((el) => el.style.transform),
    "",
  );
  assert.equal((await read()).audio.focusActive, false);
  await wait(() => latestState.bowCool === 0 && latestState.y === 0);
  await charge();
  const a = (await read()).word.active;
  assert.equal(a.q.type, "meaning");
  const wrong = (a.q.options.indexOf(BANK.get(a.q.wordId).meaning) + 1) % 3;
  await p.keyboard.press(String(wrong + 1));
  await wait(() => !inscriptionDiagnostics.active && latestState.phase === 1);
  report.timing.failureReleaseMs = (await read()).word.lastRelease.responseMs;
  assert.ok(
    report.timing.failureReleaseMs < 350,
    "failure explanation must not hold combat for 650ms",
  );
  pass(
    "wrong meaning resumes the fallback attack promptly and leaves only passive feedback",
  );
  await wait(() => latestState.bowCool === 0);
  await charge();
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.waitForTimeout(100);
  assert.equal((await read()).word.motion.zoom, 1);
  await p.keyboard.press("Escape");
  await p.locator("#word-restart").click();
  await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
  assert.equal((await read()).word.motion.mode, "idle");
  assert.equal((await read()).audio.focusActive, false);
  assert.equal(await p.locator("#word-current").isVisible(), false);
  assert.equal(
    await p.locator("#stage").evaluate((el) => el.style.transform),
    "",
  );
  pass(
    "reduced motion removes zoom and particles; restart clears motion, audio and old results",
  );
  const intervals = await p.evaluate(() =>
    window.motionFrames.slice(1).sort((a, b) => a - b),
  );
  report.timing.focusFrameMedianMs =
    intervals[Math.floor(intervals.length * 0.5)];
  report.timing.focusFrameP95Ms =
    intervals[Math.floor(intervals.length * 0.95)];
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.failure = e.stack;
  await p
    .screenshot({ path: fileURLToPath(new URL("failure.png", out)) })
    .catch(() => {});
  throw e;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await context.close();
  if (process.env.RECORD_MOTION === "1")
    await p.video().saveAs(fileURLToPath(new URL("flow.webm", out)));
  await browser.close();
}
