import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL("test-results/native-shell/", root);
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
  fixture: `Actual native archive without the web host. F8/F9 select only win/death; F6 moves to a deep room; F7 injects a stale Anchor follow target. Initial config follows ${initialFollow} to reproduce an editor-saved follow target. Resize checks use the exported 480x360 run config, matching Builder; a second boot simulates 960x600. No online project overwritten.`,
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
const shot = async (name) => {
  const png = await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", out)),
  });
  if (/^(title|game)-\d+x\d+$/.test(name)) {
    const edges = await page.evaluate(
      async (data) => {
        const image = new Image();
        image.src = data;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const c = canvas.getContext("2d");
        c.drawImage(image, 0, 0);
        return [0.001, 0.02, 0.98, 0.999].map((at) => {
          const pixels = c.getImageData(
            0,
            Math.floor(canvas.height * at),
            canvas.width,
            1,
          ).data;
          const colors = new Set();
          let light = 0,
            count = 0;
          for (
            let x = Math.floor(canvas.width * 0.1);
            x < canvas.width * 0.9;
            x += 2
          ) {
            colors.add(
              `${pixels[x * 4]},${pixels[x * 4 + 1]},${pixels[x * 4 + 2]}`,
            );
            light +=
              pixels[x * 4] * 0.2126 +
              pixels[x * 4 + 1] * 0.7152 +
              pixels[x * 4 + 2] * 0.0722;
            count++;
          }
          return { colors: colors.size, meanLuminance: light / count };
        });
      },
      "data:image/png;base64," + png.toString("base64"),
    );
    assert.ok(
      edges.slice(1, 3).every((row) => row.colors > 12),
      `${name}: border must fade into visible scenery at 2% of the viewport`,
    );
    assert.ok(
      edges[0].meanLuminance < 18 && edges[3].meanLuminance < 18,
      `${name}: outer edge should remain dark`,
    );
    report.edgeSamples ??= [];
    report.edgeSamples.push({
      name,
      sampledRows: [0.001, 0.02, 0.98, 0.999],
      edges,
    });
  }
};
try {
  await boot();
  await state(0, 0);
  await shot("title-960");
  assert.equal(await page.evaluate(() => window.nativeState[22]), 0);
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.nativeState[3]), 0);
  pass(
    "native boot stays on the title screen; no run starts or combat time advances before an explicit start",
  );
  await click(850, 278);
  await state(0, 1);
  await page.waitForFunction(() => window.nativeState[2] === 1);
  pass("native difficulty cards are clickable and select Veteran");
  await click(885, 560);
  await page.waitForFunction(() =>
    window.nativeMusic.at(-1)?.endsWith("paused"),
  );
  await click(885, 560);
  await page.waitForFunction(() =>
    window.nativeMusic.at(-1)?.endsWith("playing"),
  );
  pass("title music button toggles the native player");
  await click(850, 482);
  await state(0, 2);
  await shot("guide-960");
  for (const key of ["t", "r", "1"]) await tap(key);
  await state(0, 2);
  assert.equal(await page.evaluate(() => window.nativeState[2]), 1);
  await tap("Enter");
  await state(0, 1);
  pass(
    "help opens before play; gameplay shortcuts are isolated; Enter closes help without starting a run",
  );
  await click(784, 211);
  await state(1, -1);
  assert.equal(await page.evaluate(() => window.nativeState[5]), 5);
  await shot("game-960");
  pass(
    "start button enters actual gameplay with the selected health and hides the title",
  );
  await page.waitForFunction(
    () =>
      Math.abs(window.nativeUI[2] - 480) < 2 &&
      Math.abs(window.nativeUI[3] + 80) < 5,
  );
  report.cameraAtStart = await page.evaluate(() => window.nativeUI.slice(2));
  report.roundtrip = await page.evaluate(() => window.nativeRoundtrip || null);
  pass(
    `camera owns its authored center after boot even if imported configuration follows the hidden ${initialFollow} sprite`,
  );
  const musicBefore = await page.evaluate(() => window.nativeMusic.at(-1));
  for (const x of [560, 700, 840]) await click(x, 51);
  await state(1, -1);
  assert.equal(
    await page.evaluate(() => window.nativeMusic.at(-1)),
    musicBefore,
  );
  assert.equal(await page.evaluate(() => window.nativeUI[1]), 0);
  await tap("h");
  await state(4, 2);
  await tap("h");
  await state(1, -1);
  await tap("b");
  await page.waitForFunction(() =>
    window.nativeMusic.at(-1)?.endsWith("paused"),
  );
  await tap("b");
  await page.waitForFunction(() =>
    window.nativeMusic.at(-1)?.endsWith("playing"),
  );
  pass(
    "gameplay guide/pause/music buttons and hit regions are absent; H and B remain functional",
  );
  await tap("F7");
  await page.waitForTimeout(500);
  assert.ok(
    Math.abs((await page.evaluate(() => window.nativeUI[2])) - 480) < 2,
  );
  pass(
    "runtime reacquires camera ownership after an external follow target is restored",
  );
  await tap("F6");
  await page.waitForFunction(
    () => window.nativeUI[3] < -5800 && Math.abs(window.nativeUI[2] - 480) < 2,
  );
  await page.waitForTimeout(300);
  await shot("deep-room");
  await tap("r");
  await page.waitForFunction(
    () =>
      Math.abs(window.nativeUI[3] + 80) < 5 &&
      Math.abs(window.nativeUI[2] - 480) < 2,
  );
  pass(
    "deep-room camera movement and restart recover the intended world position without losing UI alignment",
  );
  await tap("Escape");
  await state(4, 3);
  await shot("pause-960");
  const elapsed = await page.evaluate(() => window.nativeState[3]);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.nativeState[3]), elapsed);
  await click(350, 465);
  await state(4, 2);
  await tap("Escape");
  await state(4, 3);
  await click(220, 402);
  await state(1, -1);
  await tap("Escape");
  await state(4, 3);
  await click(160, 466);
  await state(0, 1);
  pass(
    "pause freezes play; help returns to pause; resume and return-to-title work with mouse and keys",
  );
  await click(718, 482);
  await state(1, -1);
  await tap("Escape");
  await state(4, 3);
  await tap("m");
  await state(0, 1);
  await tap("1");
  await state(0, 0);
  await tap("Enter");
  await state(1, -1);
  assert.equal(await page.evaluate(() => window.nativeState[5]), 8);
  pass(
    "practice can be entered from title; returning and keyboard-starting Traveler applies 8 health",
  );
  await tap("F9");
  await state(3, 4);
  await shot("defeat-960");
  await click(220, 402);
  await state(1, -1);
  await tap("F8");
  await state(2, 5);
  await shot("victory-960");
  await tap("Tab");
  await state(2, 6);
  await shot("victory-ledger");
  await tap("Escape");
  await state(2, 5);
  await click(160, 466);
  await state(0, 0);
  pass(
    "defeat offers checkpoint retry; victory and return-to-title menus are visible and actionable",
  );
  for (const [width, height] of [
    [480, 360],
    [1125, 844],
    [1280, 720],
    [1440, 600],
    [600, 900],
    [960, 600],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(
      ({ width, height }) => {
        const u = window.nativeUI;
        return (
          u[4] >= 959 &&
          u[5] >= 599 &&
          Math.abs(u[4] / u[5] - width / height) < 0.015
        );
      },
      { width, height },
      { timeout: 10000 },
    );
    await page.waitForTimeout(500);
    await shot(`title-${width}x${height}`);
    const ui = await page.evaluate(() => window.nativeUI);
    report.sizes.push({
      width,
      height,
      worldWidth: ui[4],
      worldHeight: ui[5],
      zoom: ui[6],
    });
    await click(850, 482);
    await state(0, 2);
    await click(230, 532);
    await state(0, 0);
    await click(784, 211);
    await state(1, -1);
    await page.waitForTimeout(150);
    await shot(`game-${width}x${height}`);
    await tap("Escape");
    await state(4, 3);
    await tap("m");
    await state(0, 0);
  }
  pass(
    "live resize covers 4:3, screenshot-sized, 16:9, ultrawide, portrait and return; thin dark edges fade into scenery while the safe UI field and real click mapping stay intact",
  );
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  await page.close();
  await boot({ width: 960, height: 600 }, 2);
  await state(0, 0);
  await click(784, 211);
  await state(1, -1);
  await page.waitForFunction(() => Math.abs(window.nativeUI[2] - 480) < 2);
  await shot("run-config-960");
  await tap("w");
  await page.waitForFunction(() => window.nativeState[13] > 45);
  pass(
    "1125x844 window on a 2x display fits, starts and accepts real jump input with centered camera",
  );
  await tap("Tab");
  await state(4, 6);
  await shot("ledger-retina");
  await tap("Escape");
  await state(1, -1);
  pass(
    "native ledger opens after a 2x-display boot, keeps all text inside the frame, and returns to gameplay; victory ledger preserves the result screen",
  );
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    await shot("error").catch(() => {});
    report.diagnostics = await page
      .evaluate(() => ({
        state: window.nativeState,
        ui: window.nativeUI,
        errors: window.nativeErrors,
      }))
      .catch(() => null);
  }
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
