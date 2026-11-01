import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL("test-results/moonlit-native/", root);
await mkdir(out, { recursive: true });
const onlineRuntime =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const modelUrl = process.env.XBUILDER_MODEL_URL;
const initialFollow = process.env.NATIVE_SHELL_FOLLOW || "Anchor";
assert.ok(["Anchor", "ProjectCover"].includes(initialFollow));
const runtimeFiles = onlineRuntime
  ? {
      "/ispx.wasm": join(onlineRuntime, "ispx.wasm"),
      "/engineres.zip": join(onlineRuntime, "engineres.zip"),
    }
  : {};

const archive = new URL("exports/belfry.xbp", root);
const report = {
  date: new Date().toISOString(),
  modelUrl,
  initialFollow,
  runtime: onlineRuntime
    ? "deployed XBuilder compiler and resources"
    : "pinned npm runtime",
  cases: [],
  sizes: [],
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  fixture: `Actual native archive after deployed XBuilder model roundtrip. Initial camera follows Anchor to exercise viewport ownership. Test-only unclamped frame diagnostics observe all three naturally scheduled lightning variants. F4 freezes one exposure for screenshots only; functional timing assertions use the unfrozen cycle. Settings, reduced motion and start use real clicks and keys. Per-frame logging adds overhead. No online project overwritten.`,
};
const server = createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  createReadStream(runtimeFiles[req.url] || archive).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/package.xbp`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
report.browser = browser.version();
let page;
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function boot(run, deviceScaleFactor = 1) {
  page = await browser.newPage({
    viewport:
      deviceScaleFactor === 2
        ? { width: 1125, height: 844 }
        : { width: 960, height: 600 },
    deviceScaleFactor,
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  await page.addInitScript(() => {
    window.menuHistory = [];
    window.menuFrames = [];
    window.nativeState = [];
    window.nativeUI = [];
    window.nativeErrors = [];
    window.nativeMusic = [];
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      // The deployed compiler wraps println in structured JSON logs.
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* plain npm log */
      }
      if (s.startsWith("@menu "))
        window.menuHistory.push(s.slice(6).split(/\s+/));
      if (s.startsWith("@menuFrame "))
        window.menuFrames.push(
          s
            .slice(11)
            .split(/\s+/)
            .map((v) => (v === "true" ? 1 : v === "false" ? 0 : Number(v))),
        );
      if (s.startsWith("@state "))
        window.nativeState = s.slice(7).split(/\s+/).map(Number);
      if (s.startsWith("@nativeUI "))
        window.nativeUI = s.slice(10).split(/\s+/).map(Number);
      if (s.startsWith("@nativeMusic ")) window.nativeMusic.push(s);
      log(...args);
    };
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto(
    new URL(
      "/runtime/runner.html",
      process.env.RUNLAB_URL || "http://127.0.0.1:4184/",
    ).href,
  );
  assert.equal(
    await page.evaluate(() => window.devicePixelRatio),
    deviceScaleFactor,
  );
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({ url, run, modelUrl, deployed, initialFollow }) => {
      window.onGameError((e) => window.nativeErrors.push(String(e)));
      window.onEngineCrash((e) => window.nativeErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          [
            "engine.zip",
            deployed ? "engineres.zip" : "game.zip",
            "engine.wasm",
            "ispx.wasm",
          ].map((n) => [
            n,
            deployed && ["ispx.wasm", "engineres.zip"].includes(n)
              ? url.replace("package.xbp", n)
              : "/runtime/" + n,
          ]),
        ),
      );
      let files = window.fflate.unzipSync(
        new Uint8Array(await (await fetch(url)).arrayBuffer()),
      );
      const decoder = new window.TextDecoder(),
        encoder = new window.TextEncoder();
      const config = JSON.parse(decoder.decode(files["assets/index.json"]));
      if (run) config.run = run;
      config.camera = { on: initialFollow };
      files["assets/index.json"] = encoder.encode(JSON.stringify(config));
      if (modelUrl) {
        // Pinned public deployment bundle exports SpxProject as r and File as gn.
        const { r: Project, gn: ModelFile } = await import(modelUrl);
        const project = new Project();
        await project.loadFiles(
          Object.fromEntries(
            Object.entries(files).map(([name, b]) => [
              name,
              new ModelFile(name.split("/").pop(), async () =>
                b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
              ),
            ]),
          ),
        );
        files = Object.fromEntries(
          await Promise.all(
            Object.entries(project.exportFiles()).map(async ([name, f]) => [
              name,
              new Uint8Array(await f.arrayBuffer()),
            ]),
          ),
        );
        const roundtrip = JSON.parse(
          decoder.decode(files["assets/index.json"]),
        );
        if (roundtrip.camera.on !== initialFollow)
          throw new Error("stale-follow fixture lost during model roundtrip");
        window.nativeRoundtrip = {
          run: roundtrip.run,
          camera: roundtrip.camera,
          map: roundtrip.map,
        };
      }
      files["main.spx"] = encoder.encode(
        decoder.decode(files["main.spx"]) +
          "\nonKey KeyF6, => {Hero.resetHero(230,-6000)}\nonKey KeyF7, => {Camera.follow Anchor}\nonKey KeyF8, => {phase=2}\nonKey KeyF9, => {phase=3}\n",
      );
      let source = decoder.decode(files["main.spx"]);
      source = source.replace("var (", "var (\n menuTestHold bool\n");
      source +=
        "\nonKey KeyF4, => {menuTestHold=!menuTestHold; if menuTestHold {menuStormActive=true; menuStormFrame=1; menuStormAge=0.35; menuStormCycle=1}}\n";
      source = source.replace(
        "dt:=float64(waitNextFrame());",
        "menuRawDt:=float64(waitNextFrame()); dt:=menuRawDt;",
      );
      source = source.replace(
        /(?:WorldLogic\.)?updateMenuMotion\(dt\)/,
        'menuDt:=dt; if menuTestHold {menuDt=0}; WorldLogic.updateMenuMotion(menuDt); println "@menuFrame",menuRawDt,cameraRenderX,cameraRenderY,Camera.zoom,sceneClones,fxCount,menuFrame,menuWaterFrame,menuStormFrame,menuStormGhost,menuStormAge,menuStormCycle,MenuLightning.renderVisible,menuClock,phase,menuFogFrame,menuFogNext,menuFogBlend,MenuFogBase.renderVisible,MenuFogBlend.renderVisible',
      );
      files["main.spx"] = encoder.encode(source);
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
    { url, run, modelUrl, deployed: Boolean(onlineRuntime), initialFollow },
  );
  await page.waitForFunction(
    () => window.nativeUI.length > 0 || window.nativeErrors.length > 0,
    null,
    { timeout: 90000 },
  );
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  await page.waitForTimeout(400);
}
async function tap(key) {
  await page.keyboard.press(key, { delay: 70 });
}
async function state(phase, panel) {
  await page.waitForFunction(
    ({ phase, panel }) =>
      window.nativeState[0] === phase &&
      (panel === undefined || window.nativeUI[0] === panel),
    { phase, panel },
    { timeout: 15000 },
  );
}
async function click(x, y) {
  const box = await page.locator("#game-canvas").boundingBox();
  const s = Math.min(box.width / 960, box.height / 600);
  await page.mouse.click(
    box.x + (box.width - 960 * s) / 2 + x * s,
    box.y + (box.height - 600 * s) / 2 + y * s,
    { delay: 80 },
  );
}
const shot = async (name) =>
  page.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });

const motion = () => page.evaluate(() => window.menuHistory.at(-1));
try {
  await boot();
  await state(0, 0);
  await page.mouse.move(450, 120);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.menuHistory = [];
    window.menuFrames = [];
  });
  await page.waitForFunction(
    () =>
      new Set(window.menuFrames.filter((a) => a[12] === 1).map((a) => a[8]))
        .size === 9,
    null,
    { timeout: 60000 },
  );
  const samples = await page.evaluate(() => ({
    history: window.menuHistory,
    frames: window.menuFrames,
  }));
  const poses = new Set(samples.history.map((a) => +a[1]));
  assert.deepEqual([...poses], [0], "original hero pose stays fixed");
  assert.ok(
    new Set(samples.frames.map((a) => a[6])).size === 24,
    "cape cycles",
  );
  assert.ok(
    new Set(samples.frames.map((a) => a[7])).size === 32,
    "water cycles",
  );
  const validation = JSON.parse(
    await readFile(
      new URL("art/belfry/menu/static-validation.json", root),
      "utf8",
    ),
  );
  assert.equal(validation.leftDifferences, 0);
  assert.equal(validation.cloth.anchoredDifferences, 0);
  assert.equal(validation.water.anchoredDifferences, 0);
  assert.ok(
    validation.cloth.maxDisplacement < 2.2 &&
      validation.water.maxDisplacement < 2.2,
  );
  const span = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(span(samples.frames.map((a) => a[1])) < 0.0001);
  assert.ok(span(samples.frames.map((a) => a[2])) < 0.0001);
  assert.ok(span(samples.frames.map((a) => a[3])) < 0.0001);
  assert.equal(span(samples.frames.map((a) => a[4])), 0);
  assert.equal(Math.max(...samples.frames.map((a) => a[5])), 0);
  const times = samples.frames.map((a) => a[0] * 1000).sort((a, b) => a - b);
  const percentile = (n) => times[Math.floor((times.length - 1) * n)];
  report.performance = {
    frames: times.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    over34: times.filter((t) => t > 34).length,
    poses: [...poses].sort(),
    note: "Unclamped SPX waitNextFrame samples in actual native archive; debug logging adds overhead. This machine only.",
  };
  pass(
    "original hero pose and anchored pixels stay fixed while cape/water cycle; camera and clone count remain stable, zero combat FX",
  );
  assert.equal(validation.lightning.frames, 9);
  const lit = samples.frames.filter((a) => a[12] === 1);
  assert.deepEqual(
    [...new Set(lit.map((a) => a[8]))].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  );
  const starts = [...new Set(lit.map((a) => a[11]))].map(
    (cycle) => lit.find((a) => a[11] === cycle)[13],
  );
  for (let i = 1; i < starts.length; i++)
    assert.ok(
      starts[i] - starts[i - 1] >= 7,
      "long quiet intervals between strikes",
    );
  assert.ok(lit.every((a) => a[10] < 1.31 && a[9] >= 0 && a[9] <= 100));
  report.lightning = {
    costumes: [...new Set(lit.map((a) => a[8]))],
    cycleStarts: starts,
    maximumExposure: Math.max(...lit.map((a) => a[10])),
  };
  pass(
    "three cloud lightning paths naturally complete dark, gold and afterglow exposures with long quiet intervals and no extra clones",
  );
  assert.equal(validation.fog.protectedDifferences, 0);
  assert.equal(validation.fog.frames, 16);
  assert.equal(new Set(samples.frames.map((a) => a[15])).size, 16);
  assert.ok(
    samples.frames.every(
      (a) => a[16] === (a[15] + 1) % 16 && a[18] === 1 && a[19] === 1,
    ),
  );
  assert.ok(
    new Set(samples.frames.map((a) => a[17])).size >= 40,
    "fog interpolates between baked frames",
  );
  report.fog = {
    ...validation.fog,
    observedFrames: new Set(samples.frames.map((a) => a[15])).size,
    blendLevels: new Set(samples.frames.map((a) => a[17])).size,
  };
  pass(
    "fog completes all 16 frames with smooth interpolation, registered masks protect the original hero, camera and clone count remain stable",
  );
  // Capture actual animated output after timing samples, not a synthetic GIF.
  await page.setViewportSize({ width: 1125, height: 844 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const stream = document.querySelector("#game-canvas").captureStream(24);
    const recorder = new window.MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 3000000,
    });
    const chunks = [];
    window.fogVideoReady = new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const reader = new window.FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(new window.Blob(chunks, { type: "video/webm" }));
      };
    });
    window.fogRecorder = recorder;
    recorder.start();
  });
  await shot("fog-start");
  await page.waitForTimeout(6000);
  await shot("fog-middle");
  await page.waitForTimeout(6200);
  await page.evaluate(() => window.fogRecorder.stop());
  const fogVideo = await page.evaluate(() => window.fogVideoReady);
  await writeFile(
    new URL("fog-motion.webm", out),
    Buffer.from(fogVideo, "base64"),
  );
  await page.setViewportSize({ width: 960, height: 600 });
  await page.waitForTimeout(300);
  await tap("F4");
  await page.waitForTimeout(200);
  await shot("title");
  await page.setViewportSize({ width: 1125, height: 844 });
  await page.waitForTimeout(300);
  await shot("lightning-4x3");
  await page.setViewportSize({ width: 960, height: 600 });
  await page.waitForTimeout(300);
  await tap("F4");
  await click(784, 430);
  await state(0, 7);
  await page.waitForTimeout(400);
  const pose = (await motion())[1];
  await page.waitForTimeout(1600);
  assert.equal((await motion())[1], pose);
  assert.equal((await motion())[6], "true");
  assert.equal(await page.evaluate(() => window.menuFrames.at(-1)[12]), 0);
  await shot("settings-words");
  pass("settings keep hero pose fixed without blocking the controls");
  await click(800, 180);
  await state(0, 8);
  await click(800, 376);
  await page.waitForTimeout(500);
  const clock = +(await motion())[0];
  await page.waitForTimeout(1200);
  assert.equal(+(await motion())[0], clock);
  assert.equal((await motion())[7], "true");
  assert.equal(await page.evaluate(() => window.menuFrames.at(-1)[12]), 0);
  assert.deepEqual(
    await page.evaluate(() => window.menuFrames.at(-1).slice(18, 20)),
    [0, 0],
  );
  await shot("settings");
  pass("reduced motion freezes environmental clock and rests the hero");
  await tap("Escape");
  await state(0, 0);
  await tap("Enter");
  await state(1, -1);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.menuFrames.at(-1)[12]), 0);
  assert.deepEqual(
    await page.evaluate(() => window.menuFrames.at(-1).slice(18, 20)),
    [0, 0],
  );
  pass("reduced-motion start enters gameplay without the departure delay");
  await tap("Escape");
  await tap("m");
  await state(0, 0);
  await click(784, 430);
  await state(0, 7);
  await click(800, 180);
  await state(0, 8);
  await click(800, 376);
  await tap("Escape");
  await state(0, 0);
  await tap("Enter");
  await state(1, -1);
  await shot("game");
  pass("start enters gameplay immediately; menu layers disappear in gameplay");
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  if (page && !page.isClosed()) await shot("failure");
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
