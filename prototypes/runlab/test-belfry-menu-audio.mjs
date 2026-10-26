import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.RUNLAB_URL || "http://127.0.0.1:4177/";
const out = new URL("test-results/menu-audio/", import.meta.url);
await mkdir(out, { recursive: true });
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  fixture:
    "Real game page and actual output analyser. Allowed autoplay uses Chromium's explicit allowance. A test-only policy denies media play and leaves context resume pending until trusted input, since headless automation may grant activation itself. AudioContext.suspend also reproduces device interruption. Game state is not replaced. The user's in-app browser session is not accessible to this automation.",
};
let browser, page;
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function boot(policy) {
  browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  report.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.addInitScript((denyAutoplay) => {
    window.menuContexts = [];
    window.menuMeters = [];
    let gesture = false;
    const pending = [];
    for (const name of ["pointerdown", "keydown"])
      document.addEventListener(
        name,
        (event) => {
          if (event.isTrusted) gesture = true;
        },
        { capture: true },
      );
    const play = window.HTMLMediaElement.prototype.play;
    window.HTMLMediaElement.prototype.play = function () {
      if (denyAutoplay && !gesture)
        return Promise.reject(
          new window.DOMException(
            "Autoplay denied by test policy",
            "NotAllowedError",
          ),
        );
      return play.call(this);
    };
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args) {
        super(...args);
        window.menuContexts.push(this);
        if (denyAutoplay && !gesture) void this.suspend();
      }
      resume() {
        if (denyAutoplay && !gesture)
          return new Promise((resolve) => pending.push(resolve));
        return super.resume().then(() => {
          pending.splice(0).forEach((resolve) => resolve());
        });
      }
    };
    const connect = window.AudioNode.prototype.connect;
    window.AudioNode.prototype.connect = function (...args) {
      if (args[0] === this.context.destination) {
        const meter = this.context.createAnalyser();
        meter.fftSize = 2048;
        window.menuMeters.push(meter);
        connect.call(this, meter);
      }
      return connect.apply(this, args);
    };
    window.menuRms = () =>
      Math.max(
        0,
        ...window.menuMeters.map((meter) => {
          // Analyser buffers retain their last samples while the context is
          // suspended; those frozen samples are not current audible output.
          if (meter.context.state !== "running") return 0;
          const data = new Float32Array(meter.fftSize);
          meter.getFloatTimeDomainData(data);
          return Math.sqrt(
            data.reduce((sum, x) => sum + x * x, 0) / data.length,
          );
        }),
      );
  }, policy === "blocked");
  await page.goto(base);
  await page.waitForFunction(() => window.latestState?.phase === 0, null, {
    timeout: 90000,
  });
}
async function audible() {
  await page.waitForFunction(
    () =>
      soundDiagnostics.context === "running" &&
      soundDiagnostics.music?.stage === "menu" &&
      soundDiagnostics.music.time > 0.2 &&
      window.menuRms() > 0.00001,
    null,
    { timeout: 15000 },
  );
  assert.equal(await page.evaluate(() => latestState.phase), 0);
  assert.deepEqual(await page.evaluate(() => soundDiagnostics.errors), []);
}
try {
  await boot("allowed");
  await audible();
  assert.equal(await page.evaluate(() => soundDiagnostics.cached), 0);
  assert.equal(await page.locator("audio").count(), 1);
  pass(
    "allowed autoplay produces real menu audio without starting a run or preloading all action effects",
  );
  await page.evaluate(() => window.menuContexts.at(-1).suspend());
  await page.waitForFunction(
    () =>
      soundDiagnostics.context === "suspended" &&
      !document.querySelector("#music-start").hidden,
  );
  await page.locator("#overlay-title").click();
  await audible();
  assert.equal(await page.evaluate(() => window.menuContexts.length), 1);
  pass(
    "an interrupted context exposes the music entry and an ordinary menu click resumes the existing context",
  );
  await page.evaluate(() => window.menuContexts.at(-1).suspend());
  await page.waitForFunction(
    () => !document.querySelector("#music-start").hidden,
  );
  await page.locator("#music-start").click();
  await audible();
  pass("the explicit play-music button also resumes an interrupted output");
  await page.locator("#sound").click();
  await page.locator("#overlay-title").click();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => soundDiagnostics.enabled), false);
  assert.equal(
    await page.evaluate(() => soundDiagnostics.context),
    "suspended",
  );
  assert.equal(await page.evaluate(() => soundDiagnostics.music.paused), true);
  assert.ok(await page.evaluate(() => window.menuRms() < 0.000001));
  await page.locator("#sound").click();
  await audible();
  pass(
    "ordinary menu clicks respect explicit mute; unmute restores the menu track",
  );
  await browser.close();
  browser = null;
  await boot("blocked");
  await page.waitForFunction(
    () =>
      soundDiagnostics.context === "suspended" &&
      !document.querySelector("#music-start").hidden,
  );
  assert.equal(await page.evaluate(() => latestState.phase), 0);
  await page.locator("#overlay-title").click();
  await audible();
  assert.equal(await page.locator("audio").count(), 1);
  pass(
    "simulated autoplay denial retains a visible entry; the first trusted menu gesture resumes the pending context and starts real audio without gameplay",
  );
  await page.locator("#audio-settings").click();
  await page.locator("#setting-music").fill("0");
  await page.locator("#close-settings").click();
  await page.locator("#overlay-title").click();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => soundDiagnostics.settings.music), 0);
  assert.ok(await page.evaluate(() => window.menuRms() < 0.000001));
  pass("gesture recovery never overrides a deliberate zero music volume");
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  if (page && !page.isClosed())
    report.diagnostics = await page
      .evaluate(() => ({
        sound: soundDiagnostics,
        state: latestState.phase,
        contexts: window.menuContexts.map((c) => c.state),
      }))
      .catch(() => null);
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser?.close();
}
