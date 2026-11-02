import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL(
    `test-results/${process.env.CAMERA_LABEL || "native-camera"}/`,
    root,
  );
await mkdir(out, { recursive: true });
const onlineRuntime =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const modelUrl = process.env.XBUILDER_MODEL_URL;
const initialFollow = process.env.NATIVE_SHELL_FOLLOW || "ProjectCover";
assert.ok(["Anchor", "ProjectCover"].includes(initialFollow));
const runtimeFiles = onlineRuntime
  ? {
      "/ispx.wasm": join(onlineRuntime, "ispx.wasm"),
      "/engineres.zip": join(onlineRuntime, "engineres.zip"),
    }
  : {};

const archive = process.env.CAMERA_ARCHIVE
  ? pathToFileURL(resolve(process.env.CAMERA_ARCHIVE))
  : new URL("exports/belfry.xbp", root);
const report = {
  date: new Date().toISOString(),
  modelUrl,
  initialFollow,
  runtime: onlineRuntime
    ? "deployed XBuilder compiler and resources"
    : "pinned npm runtime",
  cases: [],
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  fixture: `Per-frame camera observations on the actual native archive, roundtripped through Builder. F10 invokes real hurt then pauses; F11 creates a fatal hit; F12 creates a normal hit with subsequent damage suppressed. Returning to title uses real M input. Diagnostic fields and fixture keys only exist in the test copy. Initial config follows ${initialFollow} to simulate an editor-saved target. Runs with exported 480x360 config at browser viewports 960x600 then 1440x1080. No online project overwritten.`,
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
    window.cameraFrames = [];
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
      if (s.startsWith("@cameraProbe "))
        window.cameraFrames.push(s.slice(13).split(/\s+/).map(Number));
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
      let main = decoder.decode(files["main.spx"]);
      const marker = "syncNativeAudioPosition(); updateNativeShell(dt)";
      if (!main.includes(marker))
        throw Error("missing post-camera instrumentation point");
      main = main.replace(
        marker,
        marker +
          '; println "@cameraProbe",phase,shock,cameraRenderX,cameraRenderY,viewCenterX,viewCenterY,viewWidth,viewHeight,Camera.zoom,nativeHover',
      );
      main +=
        "\nonKey KeyF10, => {phase=1; Hero.invulnerable=0; bindTime=0; controlGrace=0; health=maxHealth; hurt(1); phase=4}\nonKey KeyF11, => {phase=1; Hero.invulnerable=0; bindTime=0; controlGrace=0; health=1; hurt(1)}\nonKey KeyF12, => {phase=1; Hero.invulnerable=0; bindTime=0; controlGrace=0; hurt(1); Hero.invulnerable=999}\n";
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

const span = (values) => Math.max(...values) - Math.min(...values);
async function observe(name) {
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    window.cameraFrames = [];
  });
  await shot(name + "-a");
  await page.waitForTimeout(650);
  await shot(name + "-b");
  await page.waitForTimeout(650);
  const frames = await page.evaluate(() => window.cameraFrames);
  assert.ok(frames.length > 20, "continuous per-frame samples");
  const metric = {
    name,
    frames: frames.length,
    phase: frames.at(-1)[0],
    shock: frames.at(-1)[1],
    renderX: span(frames.map((f) => f[2])),
    renderY: span(frames.map((f) => f[3])),
    viewX: span(frames.map((f) => f[4])),
    viewY: span(frames.map((f) => f[5])),
    width: span(frames.map((f) => f[6])),
    height: span(frames.map((f) => f[7])),
    zoom: span(frames.map((f) => f[8])),
    minWidth: Math.min(...frames.map((f) => f[6])),
    minHeight: Math.min(...frames.map((f) => f[7])),
  };
  report.observations ??= [];
  report.observations.push(metric);
  console.log("CAMERA", JSON.stringify(metric));
  return metric;
}
function stable(metric) {
  assert.ok(
    metric.renderX < 0.1 &&
      metric.renderY < 0.1 &&
      metric.viewX < 0.1 &&
      metric.viewY < 0.1 &&
      metric.zoom < 0.0001,
    JSON.stringify(metric),
  );
}
try {
  await boot();
  await state(0, 0);
  stable(await observe("cold-title"));
  pass("cold title settles without camera or zoom oscillation");
  await page.mouse.move(350, 316);
  await click(850, 278);
  await state(0, 1);
  stable(await observe("hover-veteran"));
  pass("stationary hover and difficulty selection do not shake the title");
  await tap("Enter");
  await state(1, -1);
  await tap("F10");
  await state(4, 3);
  await tap("m");
  await state(0, 1);
  const hurtMenu = await observe("hurt-pause-menu");
  if (process.env.CAMERA_BASELINE)
    assert.ok(
      hurtMenu.renderX > 5 && hurtMenu.shock > 0,
      "baseline reproduces lingering combat shake",
    );
  else {
    stable(hurtMenu);
    assert.equal(hurtMenu.shock, 0);
  }
  pass(
    process.env.CAMERA_BASELINE
      ? "baseline reproduces sustained title shake after a hit and pause"
      : "hit then pause then real M leaves a stable title with no combat impulse",
  );
  await tap("Enter");
  await state(1, -1);
  await tap("F11");
  await state(3, 4);
  await tap("m");
  await state(0, 1);
  const deathMenu = await observe("defeat-menu");
  if (process.env.CAMERA_BASELINE)
    assert.ok(deathMenu.renderX > 5 && deathMenu.shock > 0);
  else {
    stable(deathMenu);
    assert.equal(deathMenu.shock, 0);
  }
  pass(
    process.env.CAMERA_BASELINE
      ? "baseline reproduces title shake after fatal damage"
      : "returning after fatal damage clears the menu camera impulse",
  );
  await page.setViewportSize({ width: 1440, height: 1080 });
  const resized = await observe("resized-title");
  if (!process.env.CAMERA_BASELINE) stable(resized);
  assert.ok(
    resized.minWidth >= 959.9 && resized.minHeight >= 599.9,
    "full authored viewport stays visible",
  );
  pass("4:3 resize keeps the full authored viewport");
  if (!process.env.CAMERA_BASELINE) {
    await tap("Enter");
    await state(1, -1);
    await page.evaluate(() => {
      window.cameraFrames = [];
    });
    await tap("F12");
    await page.waitForTimeout(200);
    assert.ok(
      await page.evaluate(() =>
        window.cameraFrames.some(
          (f) => f[0] === 1 && f[1] > 0 && Math.abs(f[2] - 480) > 0.1,
        ),
      ),
      "combat still emits a short visible camera impulse",
    );
    const combat = await observe("combat-recovery");
    assert.equal(combat.shock, 0);
    pass("normal combat impact still decays to zero");
  }
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(error.stack);
  console.error(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) await shot("failure");
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
