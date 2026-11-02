import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";

const root = new URL("./", import.meta.url);
const out = new URL(
  `test-results/${process.env.NATIVE_AUDIO_LABEL || "native-music"}/`,
  root,
);
await mkdir(out, { recursive: true });
const archive = process.env.NATIVE_AUDIO_ARCHIVE
  ? pathToFileURL(resolve(process.env.NATIVE_AUDIO_ARCHIVE))
  : new URL("exports/belfry.xbp", root);
const onlineRuntime =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const modelUrl = process.env.XBUILDER_MODEL_URL;
const musicManifest = JSON.parse(
  await readFile(new URL("public/audio/music/manifest.json", root), "utf8"),
);
const report = {
  date: new Date().toISOString(),
  cases: [],
  modelUrl,
  runtime: onlineRuntime
    ? "deployed XBuilder compiler and resources"
    : "pinned npm runtime",
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  note: "Actual .xbp is unzipped and compiled without the web host, optionally roundtripped through the pinned deployed project model. Test-only keys select lifecycle states, volumes, and checkpoint depths; invulnerability isolates audio continuity. Real J/W/U/L keys exercise attacks and effects. Analyser reads the real engine output. A separate one-second MP3 fixture accelerates loop verification; full delivered tracks remain unchanged. Does not claim a live x.qiniu.com editor upload.",
};
// Stream large archives over HTTP; avoid copying 80 MB through the automation protocol.
const archiveServer = createServer((req, res) => {
  const target =
    req.url === "/package.xbp"
      ? archive
      : req.url === "/loop.mp3"
        ? new URL("loop.mp3", out)
        : onlineRuntime && ["/ispx.wasm", "/engineres.zip"].includes(req.url)
          ? join(onlineRuntime, req.url.slice(1))
          : null;
  if (!target) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/octet-stream",
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
    window.nativeCues = [];
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
    window.nativePeak = () =>
      Math.max(
        0,
        ...window.nativeMeters.map((meter) => {
          const values = new Float32Array(meter.fftSize);
          meter.getFloatTimeDomainData(values);
          return values.reduce(
            (peak, value) => Math.max(peak, Math.abs(value)),
            0,
          );
        }),
      );
    const log = console.log.bind(console);
    console.log = (...args) => {
      let text = args.map(String).join(" ");
      try {
        text = JSON.parse(text).msg?.trim() || text;
      } catch {
        /* plain runtime log */
      }
      const match = text.match(/@nativeMusic\s+(\S+)\s+(\S+)/);
      if (match) window.nativeLog.push({ track: match[1], state: match[2] });
      const state = text.match(/@state\s+(.+)/);
      if (state) window.nativeState = state[1].split(/\s+/).map(Number);
      const ui = text.match(/@nativeUI\s+(-?\d+)/);
      if (ui) window.nativePanel = Number(ui[1]);
      if (text.startsWith("@nativeSfx ")) window.nativeCues.push(text);
      const mix = text.match(/@nativeMix\s+(\d+)\s+(\d+)/);
      if (mix)
        window.nativeMix = { music: Number(mix[1]), sfx: Number(mix[2]) };
      log(...args);
    };
  });
  const base = process.env.RUNLAB_URL || "http://127.0.0.1:4184/";
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto(new URL("/runtime/runner.html", base).href);
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({ shortLoop, archiveOrigin, deployed, modelUrl }) => {
      window.onGameError((e) => window.nativeErrors.push(String(e)));
      window.onEngineCrash((e) => window.nativeErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          [
            "engine.zip",
            deployed ? "engineres.zip" : "game.zip",
            "engine.wasm",
            "ispx.wasm",
          ].map((name) => [
            name,
            deployed && ["ispx.wasm", "engineres.zip"].includes(name)
              ? archiveOrigin + "/" + name
              : "/runtime/" + name,
          ]),
        ),
      );
      let files = window.fflate.unzipSync(
        new Uint8Array(
          await (await fetch(archiveOrigin + "/package.xbp")).arrayBuffer(),
        ),
      );
      if (modelUrl) {
        const { r: Project, gn: ModelFile } = await import(modelUrl);
        const project = new Project();
        await project.loadFiles(
          Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [
              name,
              new ModelFile(name.split("/").pop(), async () =>
                bytes.buffer.slice(
                  bytes.byteOffset,
                  bytes.byteOffset + bytes.byteLength,
                ),
              ),
            ]),
          ),
        );
        files = Object.fromEntries(
          await Promise.all(
            Object.entries(project.exportFiles()).map(async ([name, file]) => [
              name,
              new Uint8Array(await file.arrayBuffer()),
            ]),
          ),
        );
        const c = JSON.parse(
          new window.TextDecoder().decode(files["assets/index.json"]),
        );
        window.nativeAudioConfig = {
          run: c.run,
          audioAttenuation: c.audioAttenuation,
          audioMaxDistance: c.audioMaxDistance,
        };
      }
      if (shortLoop)
        files["assets/sounds/BGM_Menu/sound.mp3"] = new Uint8Array(
          await (await fetch(archiveOrigin + "/loop.mp3")).arrayBuffer(),
        );
      const decoder = new window.TextDecoder(),
        encoder = new window.TextEncoder();
      let main = decoder.decode(files["main.spx"]);
      main = main.replace("var (", "var (\n audioProbeRoom int\n");
      main +=
        "\nonKey KeyInsert, => {nativeMusicVolume=75; nativeSfxVolume=85; wordMode=0; Hero.invulnerable=999}\n";
      main +=
        "\nonKey KeyHome, => {audioProbeRoom=0; phase=1; wordMode=0; nativeSfxVolume=0; Hero.resetHero(checkpointX[0],checkpointY[0]); Hero.invulnerable=999; cameraY=Hero.py-120}\nonKey KeyPageDown, => {audioProbeRoom+=3; if audioProbeRoom>14 {audioProbeRoom=14}; phase=1; Hero.resetHero(checkpointX[audioProbeRoom],checkpointY[audioProbeRoom]); Hero.invulnerable=999; cameraY=Hero.py-120}\n";
      main +=
        '\nonKey KeyF8, => {phase=2}\nonKey KeyF9, => {phase=3}\nonKey KeyF10, => {phase=0}\nonKey KeyF11, => {phase=5; wordVisualPaused=false}\nonKey KeyF12, => {phase=1}\nonKey KeyF1, => {nativeMusicVolume=0; nativeSfxVolume=85}\nonKey KeyF2, => {nativeMusicVolume=0; nativeSfxVolume=0}\nonKey KeyF3, => {nativeMusicVolume=75; nativeSfxVolume=0}\nonKey KeyF4, => {NativeSfx.cue("SFX_blade")}\nonKey KeyF5, => {nativeSfxVolume=30}\nonKey KeyF7, => {println "@nativeMix",nativeMusicVolume,nativeSfxVolume}\n';
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
    { shortLoop, archiveOrigin, deployed: Boolean(onlineRuntime), modelUrl },
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
async function checkLedgerMusic(track, returnPhase, silent = false) {
  const events = await page.evaluate(() => window.nativeLog.length);
  await tap("Tab");
  await page.waitForFunction(
    (phase) => window.nativePanel === 6 && window.nativeState[0] === phase,
    returnPhase === 1 ? 4 : returnPhase,
  );
  // No input or combat sound may masquerade as the background track.
  const opened = await page.evaluate(() => window.nativeState);
  await page.waitForTimeout(1100);
  await tap("ArrowRight");
  if (silent) await paused();
  else await playing(track);
  const reading = await page.evaluate(() => ({
    phase: window.nativeState[0],
    elapsed: window.nativeState[3],
    rms: window.nativeRms(),
    musicEvents: window.nativeLog.length,
  }));
  assert.equal(reading.phase, returnPhase === 1 ? 4 : returnPhase);
  if (returnPhase === 1 || returnPhase === 4)
    assert.equal(reading.elapsed, opened[3], "ledger still freezes combat");
  assert.equal(
    reading.musicEvents,
    events,
    "opening/paging must not pause or restart music",
  );
  await tap("Escape");
  await page.waitForFunction(
    (phase) => window.nativePanel !== 6 && window.nativeState[0] === phase,
    returnPhase,
  );
  if (silent) await paused();
  else await playing(track);
  assert.equal(await page.evaluate(() => window.nativeLog.length), events);
  report.ledgerAudio ??= [];
  report.ledgerAudio.push({ track, returnPhase, silent, ...reading });
  await page.waitForTimeout(220); // preserve the game's post-ledger input guard
}
function samplePeaks() {
  return page.evaluate(async () => {
    const peaks = [];
    for (let i = 0; i < 90; i++) {
      peaks.push(window.nativePeak());
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
    return Math.max(...peaks);
  });
}
async function depthSweep() {
  await tap("Enter");
  await playing("BGM_Gameplay");
  const starts = await page.evaluate(() => window.nativeLog.length);
  const samples = [];
  for (const key of [
    "Home",
    "PageDown",
    "PageDown",
    "PageDown",
    "PageDown",
    "PageDown",
    "Home",
  ]) {
    await tap(key);
    await page.waitForTimeout(700);
    const rms = [];
    for (let i = 0; i < 8; i++) {
      rms.push(await page.evaluate(() => window.nativeRms()));
      await page.waitForTimeout(75);
    }
    const state = await page.evaluate(() => window.nativeState);
    samples.push({
      key,
      cameraY: state[27],
      heroY: state[13],
      phase: state[0],
      rms,
      maxRms: Math.max(...rms),
    });
  }
  report.depthSweep = samples;
  report.roundtripAudio = await page.evaluate(() => window.nativeAudioConfig);
  console.log("DEPTH", JSON.stringify(samples));
  assert.equal(
    await page.evaluate(() => window.nativeLog.length),
    starts,
    "no track restart during depth sweep",
  );
  assert.ok(
    samples.every((s) => s.phase === 1 && s.maxRms > 0.00001),
    "music stays audible after moving through all five districts and returning without restarting",
  );
  pass(
    "music-only output remains audible in all five districts and after returning to the top, without restarting the song",
  );
}
try {
  if (process.env.NATIVE_AUDIO_SPATIAL_ONLY) {
    await boot();
    await depthSweep();
  } else {
    await boot();
    await playing("BGM_Menu");
    pass(
      "actual export compiles without the web host and the full menu MP3 produces nonzero engine audio",
    );
    await tap("F7");
    assert.deepEqual(await page.evaluate(() => window.nativeMix), {
      music: 75,
      sfx: 85,
    });
    pass(
      "the exported title initializes music at 75% and action effects at 85%",
    );
    await checkLedgerMusic("BGM_Menu", 0);
    pass(
      "title wordbook keeps menu music playing through open, page and close without restart",
    );
    await tap("Enter");
    await playing("BGM_Gameplay");
    pass("Enter switches to the full gameplay track");
    await tap("F3"); // music only, for unambiguous output sampling
    await checkLedgerMusic("BGM_Gameplay", 1);
    pass(
      "Tab wordbook freezes combat while the actual gameplay audio remains audible without pause, resume or restart",
    );
    await tap("B");
    await paused();
    await checkLedgerMusic("BGM_Gameplay", 1, true);
    await tap("B");
    await playing("BGM_Gameplay");
    await tap("F2");
    await paused();
    await checkLedgerMusic("BGM_Gameplay", 1, true);
    await tap("F3");
    await playing("BGM_Gameplay");
    await tap("Escape");
    await paused();
    await checkLedgerMusic("BGM_Gameplay", 4, true);
    await tap("Enter");
    await playing("BGM_Gameplay");
    pass(
      "wordbook respects B mute, zero volume and an existing explicit pause; closing preserves the prior state",
    );
    await tap("Insert");
    const mixedRecording = samplePeaks();
    await page.keyboard.down("j");
    const mixedPeak = await mixedRecording;
    await page.keyboard.up("j");
    assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
    assert.ok(mixedPeak > 0.01 && mixedPeak < 0.99, `mixed peak ${mixedPeak}`);
    report.defaultMixPeak = mixedPeak;
    pass(
      "real J attacks and gameplay music both run under the new mix without full-scale clipping in the sampled opening combat",
    );
    await depthSweep();
    await tap("PageDown");
    await tap("PageDown");
    await tap("Insert");
    await page.waitForTimeout(800);
    const deepMusicStarts = await page.evaluate(() => window.nativeLog.length);
    const deepCueCount = await page.evaluate(() => window.nativeCues.length);
    for (let strike = 0; strike < 7; strike++) {
      await tap("j");
      await page.waitForTimeout(260);
    }
    await tap("w");
    await tap("j");
    await page.waitForTimeout(1200);
    for (const key of ["u", "l"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(750);
      await page.keyboard.up(key);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1200); // allow temporary attack effects to retire
    await tap("F3"); // silence only SFX: the meter must now be hearing music
    await page.waitForTimeout(250);
    await playing("BGM_Gameplay");
    assert.equal(
      await page.evaluate(() => window.nativeLog.length),
      deepMusicStarts,
    );
    const deepCues = await page.evaluate(
      (n) => window.nativeCues.slice(n),
      deepCueCount,
    );
    assert.ok(
      deepCues.filter((s) => s.includes("blade")).length >= 3 &&
        deepCues.some((s) => s.includes("bowshot")) &&
        deepCues.some((s) => s.includes("heavycut")),
      JSON.stringify(deepCues),
    );
    report.deepCombat = await page.evaluate(() => ({
      state: window.nativeState,
      musicRms: window.nativeRms(),
      musicLog: window.nativeLog,
    }));
    report.deepCombat.cues = deepCues;
    pass(
      "real repeated J attacks, jumping, charged arrow and charged blade at depth leave music audible after effect cleanup, without restarting",
    );
    await tap("F1");
    await page.waitForFunction(() => window.nativeRms() < 0.000001, null, {
      timeout: 10000,
    });
    const highRecording = samplePeaks();
    await tap("F4");
    const highPeak = await highRecording;
    assert.ok(highPeak > 0.2, `action peak ${highPeak}`);
    pass(
      "zero music volume leaves independently controlled action audio audible",
    );
    await page.waitForTimeout(500);
    await tap("F5");
    const lowRecording = samplePeaks();
    await tap("F4");
    const lowPeak = await lowRecording;
    const ratio = highPeak / lowPeak;
    assert.ok(
      ratio > 2.3 && ratio < 3.4,
      `85% / 30% output peak ratio ${ratio}`,
    );
    report.actionLevels = { highPeak, lowPeak, ratio };
    pass(
      "85% action output is measurably louder than 30%; the independent level control still works",
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
    await checkLedgerMusic("BGM_Ending", 2);
    pass(
      "result wordbook preserves ending music and returns to the result screen",
    );
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
        fileURLToPath(
          new URL(
            "public" +
              musicManifest.tracks.find((t) => t.stage === "menu").file,
            root,
          ),
        ),
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
    await page.waitForFunction(
      () => window.nativeLog.at(-1)?.track === "BGM_Gameplay",
    );
    await paused();
    assert.equal(
      await page.evaluate(() => window.nativeLog.at(-1).track),
      "BGM_Gameplay",
    );
    await tap("B");
    await playing("BGM_Gameplay");
    pass("mute persists across stage changes; unmute plays the current stage");
    assert.deepEqual(report.errors, []);
  }
} catch (error) {
  report.errors.push(error.stack);
  if (page && !page.isClosed())
    report.diagnostics = await page
      .evaluate(() => ({
        errors: window.nativeErrors,
        log: window.nativeLog,
        cues: window.nativeCues,
        state: window.nativeState,
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
