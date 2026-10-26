import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";

const root = new URL("./", import.meta.url);
const out = new URL("test-results/native-music/", root);
await mkdir(out, { recursive: true });
const archive = new URL("exports/belfry.xbp", root);
const report = {
  date: new Date().toISOString(),
  cases: [],
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  note: "Actual .xbp is unzipped and compiled by the pinned SPX runtime without the web host. F8/F9/F10/F11/F12 select lifecycle states only. Analyser reads the real engine output. A separate one-second MP3 fixture accelerates loop verification; full delivered tracks remain unchanged. Does not claim a live x.qiniu.com editor upload.",
};
// Stream large archives over HTTP; avoid copying 80 MB through the automation protocol.
const archiveServer = createServer((req, res) => {
  const target =
    req.url === "/package.xbp"
      ? archive
      : req.url === "/loop.mp3"
        ? new URL("loop.mp3", out)
        : null;
  if (!target) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Type": "application/octet-stream",
  });
  createReadStream(target)
    .on("error", () => res.destroy())
    .pipe(res);
});
await new Promise((resolve) => archiveServer.listen(0, "127.0.0.1", resolve));
const archiveOrigin = `http://127.0.0.1:${archiveServer.address().port}`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
report.browser = browser.version();
let page;
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function boot(shortLoop = false) {
  page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.errors.push(msg.text());
    if (msg.text().includes("@nativeMusic")) console.log(msg.text());
  });
  await page.addInitScript(() => {
    window.nativeMeters = [];
    window.nativeErrors = [];
    window.nativeLog = [];
    const meters = new WeakMap();
    const connect = window.AudioNode.prototype.connect;
    window.AudioNode.prototype.connect = function (...args) {
      if (args[0] === this.context.destination) {
        let meter = meters.get(this.context);
        if (!meter) {
          meter = this.context.createAnalyser();
          meter.fftSize = 2048;
          meters.set(this.context, meter);
          window.nativeMeters.push(meter);
        }
        // Passive parallel tap: preserve the actual destination/output path.
        connect.call(this, meter, args[1] || 0, 0);
      }
      return connect.apply(this, args);
    };
    window.nativeRms = () =>
      Math.max(
        0,
        ...window.nativeMeters.map((meter) => {
          const values = new Float32Array(meter.fftSize);
          meter.getFloatTimeDomainData(values);
          return Math.sqrt(
            values.reduce((sum, value) => sum + value * value, 0) /
              values.length,
          );
        }),
      );
    const log = console.log.bind(console);
    console.log = (...args) => {
      const text = args.map(String).join(" ");
      const match = text.match(/@nativeMusic\s+(\S+)\s+(\S+)/);
      if (match) window.nativeLog.push({ track: match[1], state: match[2] });
      const state = text.match(/@state\s+(.+)/);
      if (state) window.nativeState = state[1].split(/\s+/).map(Number);
      log(...args);
    };
  });
  const base = process.env.RUNLAB_URL || "http://127.0.0.1:4184/";
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto(new URL("/runtime/runner.html", base).href);
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({ shortLoop, archiveOrigin }) => {
      window.onGameError((e) => window.nativeErrors.push(String(e)));
      window.onEngineCrash((e) => window.nativeErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          ["engine.zip", "game.zip", "engine.wasm", "ispx.wasm"].map((name) => [
            name,
            "/runtime/" + name,
          ]),
        ),
      );
      const files = window.fflate.unzipSync(
        new Uint8Array(
          await (await fetch(archiveOrigin + "/package.xbp")).arrayBuffer(),
        ),
      );
      if (shortLoop)
        files["assets/sounds/BGM_Menu/sound.mp3"] = new Uint8Array(
          await (await fetch(archiveOrigin + "/loop.mp3")).arrayBuffer(),
        );
      const decoder = new window.TextDecoder(),
        encoder = new window.TextEncoder();
      let main = decoder.decode(files["main.spx"]);
      main +=
        '\nonKey KeyF8, => {phase=2}\nonKey KeyF9, => {phase=3}\nonKey KeyF10, => {phase=0}\nonKey KeyF11, => {phase=5; wordVisualPaused=false}\nonKey KeyF12, => {phase=1}\nonKey KeyF1, => {nativeMusicVolume=0; nativeSfxVolume=30}\nonKey KeyF2, => {nativeMusicVolume=0; nativeSfxVolume=0}\nonKey KeyF3, => {nativeMusicVolume=65; nativeSfxVolume=0}\nonKey KeyF4, => {NativeSfx.cue("SFX_blade")}\n';
      files["main.spx"] = encoder.encode(main);
      await window.initGame(
        Object.fromEntries(
          Object.entries(files).map(([name, content]) => [
            name,
            {
              content: content.buffer.slice(
                content.byteOffset,
                content.byteOffset + content.byteLength,
              ),
              lastModified: Date.now(),
            },
          ]),
        ),
      );
      await window.startGame();
    },
    { shortLoop, archiveOrigin },
  );
  await page.waitForFunction(
    () => window.nativeLog.length || window.nativeErrors.length,
    {},
    { timeout: 90000 },
  );
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  await page.locator("#game-canvas").click({ position: { x: 400, y: 300 } });
}
async function playing(track) {
  await page.waitForFunction(
    (track) =>
      window.nativeLog.at(-1)?.track === track &&
      window.nativeLog.at(-1)?.state === "playing" &&
      window.nativeRms() > 0.00001,
    track,
    { timeout: 30000 },
  );
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
}
async function paused() {
  await page.waitForFunction(
    () =>
      window.nativeLog.at(-1)?.state === "paused" &&
      window.nativeRms() < 0.000001,
    {},
    { timeout: 10000 },
  );
}
async function tap(key) {
  await page.keyboard.press(key, { delay: 80 });
}
try {
  await boot();
  await playing("BGM_Menu");
  pass(
    "actual export compiles without the web host and the full menu MP3 produces nonzero engine audio",
  );
  await tap("Enter");
  await playing("BGM_Gameplay");
  pass("Enter switches to the full gameplay track");
  await tap("F1");
  await page.waitForFunction(() => window.nativeRms() < 0.000001, null, {
    timeout: 10000,
  });
  await tap("F4");
  await page.waitForFunction(() => window.nativeRms() > 0.00001, null, {
    timeout: 5000,
  });
  pass(
    "zero music volume leaves independently controlled action audio audible",
  );
  await tap("F2");
  await page.waitForTimeout(600);
  await tap("F4");
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => window.nativeRms() < 0.000001));
  await tap("F3");
  await playing("BGM_Gameplay");
  await tap("F4");
  await playing("BGM_Gameplay");
  pass(
    "zero action volume silences action samples without muting background music; both zero is silent",
  );
  await tap("Escape");
  await paused();
  await tap("Enter");
  await playing("BGM_Gameplay");
  pass("pause silences the engine output; continue resumes the same track");
  const before = await page.evaluate(() => window.nativeLog.length);
  await tap("F11");
  await page.waitForTimeout(500);
  await playing("BGM_Gameplay");
  assert.equal(await page.evaluate(() => window.nativeLog.length), before);
  await tap("F12");
  pass(
    "word-focus state leaves gameplay music running without restart or volume ducking",
  );
  await tap("F8");
  await playing("BGM_Ending");
  await tap("B");
  await paused();
  await tap("B");
  await playing("BGM_Ending");
  pass(
    "victory switches to the full ending track; mute is silent with no previous track leaking",
  );
  await tap("F9");
  await playing("BGM_Ending");
  await tap("F10");
  await playing("BGM_Menu");
  await tap("B");
  await paused();
  pass(
    "defeat uses ending music; returning to title switches back and leaves only one active track",
  );
  assert.equal(await page.locator("#scene-music").count(), 0);
  assert.equal(
    await page.evaluate(() => typeof window.soundDiagnostics),
    "undefined",
  );
  report.fullTrackLog = await page.evaluate(() => window.nativeLog);
  await page.close();

  const conversion = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "30",
      "-i",
      fileURLToPath(new URL("public/audio/music/menu.mp3", root)),
      "-t",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      fileURLToPath(new URL("loop.mp3", out)),
    ],
    { encoding: "utf8" },
  );
  assert.equal(conversion.status, 0, conversion.stderr);
  await boot(true);
  await playing("BGM_Menu");
  await page.waitForTimeout(3500);
  await playing("BGM_Menu");
  assert.equal(
    await page.evaluate(
      () =>
        window.nativeLog.filter(
          (event) => event.track === "BGM_Menu" && event.state === "playing",
        ).length,
    ),
    1,
  );
  pass(
    "native loop keeps a one-second MP3 audible past three durations without JS restarts",
  );
  await tap("B");
  await paused();
  await tap("Enter");
  await paused();
  assert.equal(
    await page.evaluate(() => window.nativeLog.at(-1).track),
    "BGM_Gameplay",
  );
  await tap("B");
  await playing("BGM_Gameplay");
  pass("mute persists across stage changes; unmute plays the current stage");
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(error.stack);
  if (page && !page.isClosed())
    report.diagnostics = await page
      .evaluate(() => ({
        errors: window.nativeErrors,
        log: window.nativeLog,
        rms: window.nativeRms(),
        contexts: window.nativeMeters.map((m) => m.context.state),
      }))
      .catch(() => null);
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => archiveServer.close(resolve));
}
