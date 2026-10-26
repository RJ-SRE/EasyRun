import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL("test-results/idle-cloth/", root);
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

const archive = new URL("exports/belfry.xbp", root);
const report = {
  date: new Date().toISOString(),
  modelUrl,
  runtime: onlineRuntime
    ? "deployed XBuilder compiler and resources"
    : "pinned npm runtime",
  cases: [],
  sizes: [],
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  fixture:
    "Actual native archive without the web host. Initial camera follows Anchor to exercise the production camera reset. Test-only logs observe idle frame, logical pose, collision anchor, facing and PoseBlend births. Real keyboard input exercises idle, pause, facing, running, jumping and attacking. No online project overwritten.",
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
    window.cloth = [];
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      // The deployed compiler wraps println in structured JSON logs.
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* plain npm log */
      }
      if (s.startsWith("@cloth "))
        window.cloth.push(s.slice(7).split(/\s+/).map(Number));
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
      files["main.spx"] = encoder.encode(
        decoder
          .decode(files["main.spx"])
          .replace("var (", "var (\n clothBlendBirths int")
          .replace(
            'println "@render",',
            'println "@cloth",Hero.idleFrame,Hero.pose,Hero.px,Hero.py,Hero.facing,clothBlendBirths; println "@render",',
          ),
      );
      files["PoseBlend.spx"] = encoder.encode(
        decoder
          .decode(files["PoseBlend.spx"])
          .replace(
            "onCloned data => {",
            "onCloned data => {clothBlendBirths++;",
          ),
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

try {
  await boot();
  await tap("Enter");
  await state(1, -1);
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.cloth = [];
  });
  for (let i = 0; i < 24; i++) {
    await page.screenshot({
      path: fileURLToPath(
        new URL(`idle-${String(i).padStart(3, "0")}.png`, out),
      ),
      clip: { x: 170, y: 125, width: 130, height: 110 },
    });
    await page.waitForTimeout(100);
  }
  const idle = await page.evaluate(() => window.cloth);
  assert.ok(new Set(idle.map((s) => s[0])).size >= 16);
  assert.ok(idle.every((s) => s[1] === 0 && s[2] === 230 && s[3] === 0));
  assert.equal(
    new Set(idle.map((s) => s[5])).size,
    1,
    "wind must not create transition clones",
  );
  pass(
    "idle changes cloth frames without moving the collision anchor or producing pose-blend clones",
  );
  await tap("Escape");
  await state(4, 3);
  await page.waitForTimeout(300);
  const paused = await page.evaluate(() => window.cloth.at(-1)[0]);
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.cloth.at(-1)[0]), paused);
  await tap("Escape");
  await state(1, -1);
  await page.waitForFunction((n) => window.cloth.at(-1)[0] !== n, paused);
  pass("pause freezes cloth and resume continues it");
  await page.keyboard.down("d");
  await page.waitForTimeout(220);
  await page.waitForFunction(
    () =>
      window.cloth.at(-1)[0] === -1 &&
      window.cloth.at(-1)[1] >= 1 &&
      window.cloth.at(-1)[1] <= 12,
  );
  await page.keyboard.up("d");
  await page.waitForTimeout(350);
  await page.keyboard.down("a");
  await page.waitForTimeout(350);
  await page.keyboard.up("a");
  await page.waitForFunction(
    () => window.cloth.at(-1)[0] >= 0 && window.cloth.at(-1)[4] === -90,
  );
  await shot("idle-left");
  pass(
    "movement restores action frames and facing-left idle resumes the mirrored cloth loop",
  );
  await tap("w");
  await page.waitForFunction(
    () => window.cloth.at(-1)[0] === -1 && window.nativeState[13] > 5,
  );
  await page.waitForFunction(
    () => window.cloth.at(-1)[0] >= 0 && window.cloth.at(-1)[1] === 0,
  );
  await tap("j");
  await page.waitForFunction(
    () => window.cloth.at(-1)[0] === -1 && window.cloth.at(-1)[1] >= 25,
  );
  await page.waitForFunction(() => window.cloth.at(-1)[0] >= 0);
  pass(
    "jump, landing and basic attacks interrupt and restore the idle loop without changing gameplay",
  );
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  assert.deepEqual(report.errors, []);
  report.idleSamples = idle;
} catch (e) {
  report.errors.push(e.stack);
  console.error(e);
  process.exitCode = 1;
  if (page && !page.isClosed()) await shot("failure");
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
