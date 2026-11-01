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
  wordsDuringMotion: process.env.PERF_WORDS === "1",
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
async function boot(
  run,
  deviceScaleFactor = Number(process.env.PERF_DPR || 1),
) {
  page = await browser.newPage({
    viewport: process.env.PERF_WIDTH
      ? {
          width: Number(process.env.PERF_WIDTH),
          height: Number(process.env.PERF_HEIGHT || 1080),
        }
      : deviceScaleFactor === 2
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
    window.nativeEvents = [];
    window.viewProbes = [];
    window.viewContext = [];
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
      if (s.startsWith("@event ")) window.nativeEvents.push(s);
      if (s.startsWith("@viewProbe "))
        window.viewProbes.push(s.slice(11).split(/\s+/));
      if (s.startsWith("@viewContext "))
        window.viewContext = s.slice(13).split(/\s+/).map(Number);
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
    async ({
      url,
      run,
      modelUrl,
      deployed,
      motionSampling,
      processKeeper,
      wordsDuringMotion,
      viewsProbe,
    }) => {
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
      const nativeFile = files["NativeLogic.spx"]
        ? "NativeLogic.spx"
        : "main.spx";
      let native =
        nativeFile === "main.spx" ? main : decoder.decode(files[nativeFile]);
      // Pin the same dictionary workload for baseline and candidate runs.
      native = native.replace(
        'println "@nativeDeck",nativeScope,nativeDeck',
        'nativeDeck=[]int{25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54}; nativeDone=make([]int,30); nativeCursor=0; println "@nativeDeck",nativeScope,nativeDeck',
      );
      native = native.replace(
        "nativeQuestionMode=nativeRand(2)",
        "nativeQuestionMode=0",
      );
      if (nativeFile === "main.spx") main = native;
      else files[nativeFile] = encoder.encode(native);
      main = main.replace(
        "var (",
        "var (\n perfN int\n perfScene int\n perfSlots int\n perfUI int\n perfCostumes int\n perfLayers int\n perfFrameSum float64\n perfFrameMax float64",
      );
      main = main.replace(
        "dt:=float64(waitNextFrame());",
        "dt:=float64(waitNextFrame()); perfFrameSum+=dt*1000; perfFrameMax=math.Max(perfFrameMax,dt*1000);",
      );
      const worldFile = files["WorldLogic.spx"] ? "WorldLogic.spx" : "main.spx";
      let world =
        worldFile === "main.spx" ? main : decoder.decode(files[worldFile]);
      world = world.replace(
        "func sceneWanted(kind,i int,ys []float64) bool {",
        "func sceneWanted(kind,i int,ys []float64) bool {perfScene++",
      );
      world = world.replace(
        /(for \w+:=0;\w+<len\(slots\);\w+\+\+ \{)/g,
        "$1perfSlots++;",
      );
      if (worldFile === "main.spx") main = world;
      else files[worldFile] = encoder.encode(world);
      main = main.replace(
        /\n }\n}\s*$/,
        '\n perfN++; if perfN%60==0 {println "@perf",perfN,perfScene,perfSlots,perfUI,perfCostumes,perfLayers,perfFrameSum,perfFrameMax}\n }\n}\n',
      );
      main +=
        "\nonKey KeyF7, => {wordMode=0; startRun(); Hero.invulnerable=999}\nonKey KeyF8, => {wordMode=0; startRun(); Hero.resetHero(430,-260); Hero.invulnerable=999}\nonKey KeyF9, => {wordMode=1; Hero.bowCharging=true; requestWord(1); beginWord()}\nonKey KeyF10, => {perfN=0; perfScene=0; perfSlots=0; perfUI=0; perfCostumes=0; perfLayers=0; perfFrameSum=0; perfFrameMax=0}\n";
      if (processKeeper) {
        files[worldFile] = encoder.encode(
          decoder
            .decode(files[worldFile])
            .replace(/onStart => \{hide\}\s*$/, "") +
            `
func perfKeeper() {wordMode=0; startRun(); segment=1; bossStage=2; bossMendCooldown=999; for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0}; i:=keeperIndex; clearEnemyMotion(i); enemyHP[i]=bossMaxHP/3; enemyX[i]=620; enemyY[i]=enemyBaseY[i]; Hero.resetHero(450,enemyBaseY[i]-34); Hero.invulnerable=999; cameraY=enemyY[i]+105; cameraRenderY=cameraY; Camera.setXYpos 480,cameraY}
onStart => {hide}
`,
        );
        main += "\nonKey KeyF11, => {WorldLogic.perfKeeper()}\n";
      }
      if (motionSampling) main = main.replace("perfN%60==0", "perfN%15==0");
      if (wordsDuringMotion)
        main = main.replaceAll(
          "wordMode=0; startRun()",
          "wordMode=1; startRun()",
        );
      if (files["WorldLogic.spx"])
        main = main.replace(
          /(?<![.\w])(startRun|requestWord|beginWord)(?=\()/g,
          "WorldLogic.$1",
        );
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
      if (viewsProbe) {
        // Freeze the real hook immediately after attachment: the default
        // nearby anchor can be reached between the 4 Hz state snapshots.
        files["WorldLogic.spx"] = encoder.encode(
          decoder
            .decode(files["WorldLogic.spx"])
            .replace(
              "func event(name string) {",
              'func event(name string) {if name=="hook" {phase=4};',
            ),
        );
        for (const name of ["Rope", "KeeperLine"]) {
          if (!decoder.decode(files[name + ".spx"]).includes("nativeViewClone"))
            throw new Error("Event-view fixture requires v0.16.3");
          files[name + ".spx"] = encoder.encode(
            decoder.decode(files[name + ".spx"]) +
              '\nonMsg "nativeViewProbe", => {if nativeViewClone {println "@viewProbe ' +
              name +
              '",nativeViewSlot,renderVisible,renderX,renderY,renderSizeValue,renderCostumeIndex}}\n',
          );
        }
        files["main.spx"] = encoder.encode(
          decoder.decode(files["main.spx"]) +
            '\nonKey KeyF4, => {broadcastAndWait "nativeViewProbe"; println "@viewContext",Hero.px,Hero.py,Hero.hookX,Hero.hookY,visualTime}\n' +
            "\nonKey KeyF5, => {phase=4}\nonKey KeyF3, => {Hero.hook=-1; segment=0}\n" +
            "\nonKey KeyF6, => {phase=4; segment=1; enemyHP[keeperIndex]=100; WorldLogic.clearKeeperDanger(); WorldLogic.keeperLine(100,-100,400,-100,0.5,0.4,28,0)}\n" +
            "\nonKey KeyF2, => {keeperAge[0]=0.6}\n",
        );
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
    {
      url,
      run,
      modelUrl,
      deployed: Boolean(onlineRuntime),
      motionSampling: Boolean(process.env.PERF_ONLY_MOTION),
      processKeeper: !!process.env.PERF_KEEPER,
      wordsDuringMotion: process.env.PERF_WORDS === "1",
      viewsProbe: Boolean(process.env.PERF_VIEWS),
    },
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
  report.display = await page.evaluate(() => ({
    width: innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    canvasWidth: document.querySelector("#game-canvas").width,
    canvasHeight: document.querySelector("#game-canvas").height,
  }));
  const cdp = await page.context().newCDPSession(page);
  const browserCDP = await browser.newBrowserCDPSession();
  const systemInfo = await browserCDP.send("SystemInfo.getInfo");
  report.gpu = {
    devices: systemInfo.gpu.devices,
    renderer: systemInfo.gpu.auxAttributes?.glRenderer,
  };
  await browserCDP.detach();
  await cdp.send("Performance.enable");
  if (process.env.PERF_THROTTLE)
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: Number(process.env.PERF_THROTTLE),
    });
  report.samples = [];
  async function measure(name, prepare, drive) {
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
    const duration = Number(process.env.PERF_SAMPLE_MS || 6500);
    if (drive) await drive(duration);
    else await page.waitForTimeout(duration);
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
      rafP99: percentile(data.raf, 0.99),
      rafMax: Math.max(...data.raf),
      rafOver34ms: data.raf.filter((v) => v > 34).length,
      rafOver100ms: data.raf.filter((v) => v > 100).length,
      rafOver250ms: data.raf.filter((v) => v > 250).length,
      rafExcessOver34ms: data.raf.reduce(
        (sum, v) => sum + Math.max(0, v - 34),
        0,
      ),
      taskMsPerSecond:
        ((after.TaskDuration - before.TaskDuration) * 1000) /
        ((Date.now() - started) / 1000),
      jsHeap: after.JSHeapUsedSize,
      sceneMissing: Math.max(0, ...data.renders.map((r) => r[2])),
      phase: data.state[0],
      heroX: data.state[12],
      heroY: data.state[13],
      hook: data.state[16],
      hookCount: data.state[24],
      glyphs: data.ui[8],
    };
    report.samples.push(sample);
    console.log(JSON.stringify(sample));
    await shot(name);
  }
  if (process.env.PERF_VIEWS) {
    report.cases = [];
    const snapshot = async () => {
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        window.viewProbes = [];
      });
      await tap("F4");
      await page.waitForFunction(() => window.viewProbes.length === 32);
      return page.evaluate(() => ({
        rows: window.viewProbes,
        context: window.viewContext,
      }));
    };
    await tap("F7");
    await state(1, -1);
    await page.keyboard.down("o");
    await page.waitForFunction(() => window.nativeState[16] >= 0);
    await shot("rope-active");
    await tap("F5");
    let view = await snapshot();
    const [x, y, hx, hy, time] = view.context;
    const ropes = view.rows.filter((r) => r[0] === "Rope");
    assert.equal(ropes.length, 24);
    for (const r of ropes) {
      assert.equal(r[2], "true");
      const t = (Number(r[1]) + 0.5) / 24;
      assert.ok(Math.abs(Number(r[3]) - (x + (hx - x) * t)) < 0.01);
      assert.ok(
        Math.abs(
          Number(r[4]) -
            (y +
              30 +
              (hy - y - 30) * t +
              Math.sin(t * 3.14159) * 6 * Math.sin(time * 16)),
        ) < 0.01,
      );
    }
    report.cases.push(
      "real O input draws all 24 rope segments at the original sag geometry",
    );
    await page.keyboard.up("o");
    await tap("F3");
    view = await snapshot();
    assert.ok(view.rows.every((r) => r[2] === "false"));
    report.cases.push(
      "leaving hook state hides all rope segments on the next frame",
    );
    await tap("F6");
    view = await snapshot();
    let lines = view.rows.filter(
      (r) => r[0] === "KeeperLine" && r[2] === "true",
    );
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0].slice(3).map(Number), [250, -100, 1, 0]);
    await tap("F2");
    view = await snapshot();
    lines = view.rows.filter((r) => r[0] === "KeeperLine" && r[2] === "true");
    assert.deepEqual(lines[0].slice(3).map(Number), [250, -100, 1, 1]);
    await tap("F3");
    view = await snapshot();
    assert.ok(view.rows.every((r) => r[2] === "false"));
    report.cases.push(
      "boss-line warning/active costumes and geometry match; leaving the boss phase clears all eight views",
    );
    for (const c of report.cases) console.log("PASS", c);
  } else if (process.env.PERF_SOAK) {
    await measure(
      "mixed-soak",
      async () => {
        await tap("F7");
        await state(1, -1);
      },
      async (duration) => {
        const until = Date.now() + duration;
        let cycle = 0;
        try {
          while (Date.now() < until) {
            const direction = cycle % 2 ? "a" : "d";
            await page.keyboard.down(direction);
            await tap("w");
            await page.keyboard.down("o");
            await page.waitForTimeout(650);
            await page.keyboard.up("o");
            for (let i = 0; i < 6 && Date.now() < until; i++) {
              await tap("j");
              await page.waitForTimeout(330);
            }
            await page.keyboard.up(direction);
            cycle++;
            if (cycle % 5 === 0)
              console.log(
                "soak",
                cycle,
                "cycles",
                Math.max(0, until - Date.now()),
                "ms remaining",
              );
          }
        } finally {
          for (const key of ["a", "d", "o", "j", "w"])
            await page.keyboard.up(key);
        }
      },
    );
  } else if (!process.env.PERF_ONLY_MOTION) {
    await measure("title");
    if (!process.env.PERF_ONLY_TITLE) {
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
      if (process.env.PERF_KEEPER)
        await measure("keeper-third-form", async () => {
          await tap("F11");
          await state(1, -1);
        });
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
    }
  }
  if (
    !process.env.PERF_SOAK &&
    (process.env.PERF_MOTION || process.env.PERF_ONLY_MOTION)
  ) {
    await measure("grapple", async () => {
      await tap("F7");
      await state(1, -1);
      await page.keyboard.down("o");
      await page.waitForFunction(() =>
        window.nativeEvents.some((s) => s.startsWith("@event hook ")),
      );
      await page.keyboard.down("d");
    });
    await page.keyboard.up("o");
    await page.keyboard.up("d");
    await measure("traversal", async () => {
      await tap("F7");
      await state(1, -1);
      await tap("w");
      await page.keyboard.down("d");
    });
    await page.keyboard.up("d");
  }
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
