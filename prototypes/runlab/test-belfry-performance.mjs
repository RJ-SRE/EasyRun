import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cpus, platform, arch, release } from "node:os";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL(
    "test-results/performance/" + (process.env.PERF_LABEL || "candidate") + "/",
    root,
  );
await mkdir(out, { recursive: true });
const onlineRuntime =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const modelUrl = process.env.XBUILDER_MODEL_URL;
const runtimeFiles = onlineRuntime
  ? {
      "/ispx.wasm": join(onlineRuntime, "ispx.wasm"),
      "/engineres.zip": join(onlineRuntime, "engineres.zip"),
    }
  : {};

const archive = new URL(
  process.env.PERF_ARCHIVE
    ? pathToFileURL(resolve(process.env.PERF_ARCHIVE)).href
    : "exports/belfry.xbp",
  root,
);
const report = {
  date: new Date().toISOString(),
  modelUrl,
  runtime: onlineRuntime
    ? "deployed XBuilder compiler and resources"
    : "pinned npm runtime",
  machine: {
    platform: platform(),
    arch: arch(),
    release: release(),
    cpu: cpus()[0]?.model,
  },
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  fixture:
    "Actual native archive, fixed deck indices 25–54 and spelling mode. Same title, idle, arena J-held, question and ledger setup; invulnerability prevents test interruptions. Test-only scene/UI counters, unclamped engine frame intervals, CDP task time and rAF include instrumentation. Initial camera follows Anchor to exercise reset. No online project overwritten or cross-hardware performance guarantee.",
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
    window.nativeState = [];
    window.nativeUI = [];
    window.nativeErrors = [];
    window.nativeMusic = [];
    window.perf = [];
    window.renders = [];
    window.raf = [];
    let prior = window.performance.now();
    const sample = (now) => {
      window.raf.push(now - prior);
      prior = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      // The deployed compiler wraps println in structured JSON logs.
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* plain npm log */
      }
      if (s.startsWith("@perf "))
        window.perf.push(s.slice(6).split(/\s+/).map(Number));
      if (s.startsWith("@render "))
        window.renders.push(s.slice(8).split(/\s+/).map(Number));
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
    async ({ url, run, modelUrl, deployed }) => {
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
      config.camera = { on: "Anchor" };
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
        if (roundtrip.camera.on !== "Anchor")
          throw new Error("stale-follow fixture lost during model roundtrip");
        window.nativeRoundtrip = {
          run: roundtrip.run,
          camera: roundtrip.camera,
          map: roundtrip.map,
        };
      }
      let main = decoder.decode(files["main.spx"]);
      // Pin the same dictionary workload for baseline and candidate runs.
      main = main.replace(
        'println "@nativeDeck",nativeScope,nativeDeck',
        'nativeDeck=[]int{25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54}; nativeDone=make([]int,30); nativeCursor=0; println "@nativeDeck",nativeScope,nativeDeck',
      );
      main = main.replace(
        "nativeQuestionMode=nativeRand(2)",
        "nativeQuestionMode=0",
      );
      main = main.replace(
        "var (",
        "var (\n perfN int\n perfScene int\n perfSlots int\n perfUI int\n perfCostumes int\n perfLayers int\n perfFrameSum float64\n perfFrameMax float64",
      );
      main = main.replace(
        "dt:=float64(waitNextFrame());",
        "dt:=float64(waitNextFrame()); perfFrameSum+=dt*1000; perfFrameMax=math.Max(perfFrameMax,dt*1000);",
      );
      main = main.replace(
        "func sceneWanted(kind,i int,ys []float64) bool {",
        "func sceneWanted(kind,i int,ys []float64) bool {perfScene++",
      );
      main = main.replace(
        /(for \w+:=0;\w+<len\(slots\);\w+\+\+ \{)/g,
        "$1perfSlots++;",
      );
      main = main.replace(
        /\n }\n}\s*$/,
        '\n perfN++; if perfN%60==0 {println "@perf",perfN,perfScene,perfSlots,perfUI,perfCostumes,perfLayers,perfFrameSum,perfFrameMax}\n }\n}\n',
      );
      main +=
        "\nonKey KeyF7, => {wordMode=0; startRun(); Hero.invulnerable=999}\nonKey KeyF8, => {wordMode=0; startRun(); Hero.resetHero(430,-260); Hero.invulnerable=999}\nonKey KeyF9, => {wordMode=1; Hero.bowCharging=true; requestWord(1); beginWord()}\nonKey KeyF10, => {perfN=0; perfScene=0; perfSlots=0; perfUI=0; perfCostumes=0; perfLayers=0; perfFrameSum=0; perfFrameMax=0}\n";
      files["main.spx"] = encoder.encode(main);
      for (const [name, bytes] of Object.entries(files)) {
        if (name.startsWith("Native") && name.endsWith(".spx")) {
          let source = decoder
            .decode(bytes)
            .replace("func syncUI() {", "func syncUI() {perfUI++;")
            .replaceAll("setCostume ", "perfCostumes++; setCostume ")
            .replaceAll("setLayer Front", "perfLayers++; setLayer Front");
          files[name] = encoder.encode(source);
        }
      }
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
    { url, run, modelUrl, deployed: Boolean(onlineRuntime) },
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
const shot = async (name) =>
  page.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });

const metrics = async (cdp) =>
  Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
      m.name,
      m.value,
    ]),
  );
const percentile = (arr, p) => {
  const a = [...arr].sort((a, b) => a - b);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0;
};
try {
  await boot();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  if (process.env.PERF_THROTTLE)
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: Number(process.env.PERF_THROTTLE),
    });
  report.samples = [];
  async function measure(name, prepare) {
    if (prepare) await prepare();
    await page.waitForTimeout(1500);
    await tap("F10");
    await page.evaluate(() => {
      window.perf = [];
      window.raf = [];
      window.renders = [];
    });
    const before = await metrics(cdp);
    const started = Date.now();
    await page.waitForTimeout(6500);
    const after = await metrics(cdp);
    const data = await page.evaluate(() => ({
      perf: window.perf.at(-1),
      raf: window.raf,
      renders: window.renders,
      state: window.nativeState,
      ui: window.nativeUI,
    }));
    if (!data.perf) throw new Error("no SPX performance samples for " + name);
    const [n, scene, slots, ui, costumes, layers, frameSum, frameMax] =
      data.perf;
    const sample = {
      name,
      wallSeconds: (Date.now() - started) / 1000,
      frames: n,
      sceneChecksPerFrame: scene / n,
      sceneSlotsPerFrame: slots / n,
      uiSyncPerFrame: ui / n,
      uiCostumesPerFrame: costumes / n,
      uiLayersPerFrame: layers / n,
      engineFrameMean: frameSum / n,
      engineFrameMax: frameMax,
      rafP50: percentile(data.raf, 0.5),
      rafP95: percentile(data.raf, 0.95),
      rafOver34ms: data.raf.filter((v) => v > 34).length,
      taskMsPerSecond:
        ((after.TaskDuration - before.TaskDuration) * 1000) /
        ((Date.now() - started) / 1000),
      jsHeap: after.JSHeapUsedSize,
      sceneMissing: Math.max(0, ...data.renders.map((r) => r[2])),
      phase: data.state[0],
      glyphs: data.ui[8],
    };
    report.samples.push(sample);
    console.log(JSON.stringify(sample));
    await shot(name);
  }
  await measure("title");
  await measure("idle", async () => {
    await tap("F7");
    await state(1, -1);
  });
  await measure("combat", async () => {
    await tap("F8");
    await state(1, -1);
    await page.keyboard.down("j");
  });
  await page.keyboard.up("j");
  await measure("question", async () => {
    await tap("F7");
    await tap("F9");
    await state(5, -1);
  });
  await page.waitForTimeout(4000);
  if ((await page.evaluate(() => window.nativeState[0])) === 5)
    await page.waitForTimeout(7000);
  await measure("ledger", async () => {
    await tap("Tab");
    await state(4, 6);
  });
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  assert.deepEqual(report.errors, []);
  report.cpuThrottle = Number(process.env.PERF_THROTTLE || 1);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
