import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
const out = new URL("./test-results/passages-grapple/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: fileURLToPath(out) },
});
const errors = [],
  cases = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() => {
  const Native = window.AudioContext,
    connect = AudioNode.prototype.connect;
  window.AudioContext = class extends Native {
    constructor(...args) {
      super(...args);
      window.testAudioCtx = this;
      window.testAudioSink = this.createMediaStreamDestination();
    }
  };
  AudioNode.prototype.connect = function (destination, ...args) {
    const r = connect.call(this, destination, ...args);
    if (
      destination === this.context.destination &&
      window.testAudioSink?.context === this.context
    )
      connect.call(this, window.testAudioSink);
    return r;
  };
});
const state = () => page.evaluate(() => window.passageState);
const wait = (fn) => page.waitForFunction(fn, {}, { timeout: 45000 });
async function passed(name) {
  cases.push(name);
  console.log("PASS", name);
}
try {
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4177") + "/passages.html",
  );
  await wait(() => window.passageState || window.passageErrors.length);
  assert.deepEqual(await page.evaluate(() => window.passageErrors), []);
  await page.locator("#play").click();
  await wait(() => window.passageSound().cached === 32);
  await page.evaluate(() => {
    window.audioChunks = [];
    window.audioRecorder = new MediaRecorder(window.testAudioSink.stream);
    window.audioRecorder.ondataavailable = (e) =>
      window.audioChunks.push(e.data);
    window.audioRecorder.start();
  });
  await page.keyboard.down("e");
  await wait(() => window.passageState.hookContact > 0);
  await page.screenshot({ path: fileURLToPath(new URL("attached.png", out)) });
  await wait(() => window.passageState.pull > 0.15);
  await page.keyboard.press("Escape");
  await wait(() => window.passageState.phase === 4);
  await page.keyboard.up("e");
  const paused = await page.evaluate(() => window.passageSound());
  await page.waitForTimeout(400);
  const silent = await page.evaluate(() => window.passageSound());
  assert.equal(silent.sources, 0);
  assert.equal(silent.loops, 0);
  assert.equal(silent.history.length, paused.history.length);
  await passed("pause stops voices, tension and room tails");
  await page.keyboard.press("Escape");
  await wait(() => window.passageState.phase === 1);
  await page.keyboard.press("r");
  await wait(() => window.passageState.elapsed < 0.3);
  await page.keyboard.down("e");
  await wait(() => window.passageState.fold === 1);
  await page.keyboard.up("e");
  await page.waitForTimeout(240);
  const events = await page.evaluate(() => window.passageEvents);
  const names = events.map((e) => e.name);
  for (const n of ["hook", "hookattach", "hooktension", "hookrelease", "sling"])
    assert.ok(names.includes(n), n);
  assert.ok(names.indexOf("hook") < names.indexOf("hookattach"));
  assert.ok(names.indexOf("hookattach") < names.indexOf("hooktension"));
  assert.ok(names.indexOf("hooktension") < names.indexOf("hookrelease"));
  assert.equal((await state()).ropeFade, 0);
  await passed(
    "cast, contact, tension and recoil follow actual hook lifecycle",
  );
  await page.locator("#sound").click();
  await page.waitForTimeout(150);
  let d = await page.evaluate(() => window.passageSound());
  assert.equal(d.enabled, false);
  assert.equal(d.sources, 0);
  assert.equal(d.loops, 0);
  await page.locator("#sound").click();
  await wait(() => window.passageSound().context === "running");
  await passed("mute removes every voice; unmute resumes from current state");
  await page.keyboard.press("r");
  await wait(() => window.passageState.elapsed < 0.3);
  await page.keyboard.press("e", { delay: 18 });
  await page.waitForTimeout(240);
  const short = await page.evaluate(() => window.passageEvents);
  assert.ok(short.some((e) => e.name === "hookrelease"));
  assert.ok(!short.some((e) => e.name === "hookattach"));
  await passed("early release cancels contact and tension cues");
  // Directly exercise the same visibility event path without altering game state.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(() => window.passageState.phase === 4);
  await page.waitForTimeout(100);
  d = await page.evaluate(() => window.passageSound());
  assert.equal(d.sources, 0);
  assert.equal(d.loops, 0);
  assert.equal(d.context, "suspended");
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.keyboard.press("Escape");
  await wait(
    () =>
      window.passageState.phase === 1 &&
      window.passageSound().context === "running",
  );
  await passed(
    "hidden page stops audio; a resume gesture restarts only the current ambience",
  );
  await page.keyboard.press("r");
  await wait(() => window.passageState.elapsed < 0.3);
  await page.keyboard.down("e");
  await wait(() => window.passageState.pull > 0.15);
  await page.screenshot({ path: fileURLToPath(new URL("tension.png", out)) });
  await page.keyboard.up("e");
  await page.waitForTimeout(1200);
  const capture = await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.audioRecorder.onstop = async () =>
          resolve(
            Array.from(
              new Uint8Array(
                await new Blob(window.audioChunks, {
                  type: "audio/webm",
                }).arrayBuffer(),
              ),
            ),
          );
        window.audioRecorder.stop();
      }),
  );
  await writeFile(new URL("live-mix.webm", out), Buffer.from(capture));
  const diagnostic = await page.evaluate(() => window.passageSound());
  assert.deepEqual(diagnostic.errors, []);
  assert.ok(diagnostic.history.some((e) => e.cue === "attach"));
  assert.ok(diagnostic.history.some((e) => e.cue === "tension"));
  assert.ok(diagnostic.sources <= 12);
  assert.ok(diagnostic.loops <= 2);
  assert.deepEqual(errors, []);
  const delayed = await browser.newPage();
  await delayed.route("**/audio/sfx/hook-*.m4a", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await delayed.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4177") + "/passages.html",
  );
  await delayed.waitForFunction(
    () => window.passageState?.phase === 0,
    {},
    { timeout: 45000 },
  );
  await delayed.locator("#play").click();
  await delayed.waitForFunction(() => window.passageState?.phase === 1);
  await delayed.keyboard.down("e");
  await delayed.waitForTimeout(40);
  await delayed.keyboard.press("Escape");
  await delayed.keyboard.up("e");
  await delayed.waitForTimeout(750);
  const late = await delayed.evaluate(() => window.passageSound());
  assert.equal(late.sources, 0);
  assert.equal(late.loops, 0);
  assert.ok(late.dropped > 0);
  assert.ok(!late.history.some((e) => e.cue === "hook"));
  await delayed.close();
  await passed("late sample loading cannot resurrect a paused cast");
  await writeFile(
    new URL("report.json", out),
    JSON.stringify(
      { date: new Date().toISOString(), cases, diagnostic, events, errors },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e);
  await page.screenshot({ path: fileURLToPath(new URL("error.png", out)) });
  throw e;
} finally {
  await browser.close();
}
