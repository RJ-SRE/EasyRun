// Real pointer interaction against the packaged native UI; probes are test-only.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = new URL("./", import.meta.url);
const archive =
  process.env.HOVER_ARCHIVE ||
  fileURLToPath(new URL("exports/belfry.xbp", root));
const baseline = process.env.HOVER_BASELINE === "1";
const out = new URL(
  `test-results/native-hover-${baseline ? "before" : "after"}/`,
  root,
);
await mkdir(out, { recursive: true });
const runtime = resolve(".cache/xbuilder-online-20261026");
const server = createServer((req, res) => {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
  });
  createReadStream(
    ["/ispx.wasm", "/engineres.zip"].includes(req.url)
      ? join(runtime, req.url.slice(1))
      : archive,
  ).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const packageURL = `http://127.0.0.1:${server.address().port}/package.xbp`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const report = {
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  cases: [],
  errors: [],
  samples: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
await page.addInitScript(() => {
  window.hoverProbes = [];
  window.hoverErrors = [];
  const log = console.log.bind(console);
  console.log = (...args) => {
    let s = args.map(String).join(" ");
    try {
      s = JSON.parse(s).msg?.trim() || s;
    } catch {
      /* plain engine log */
    }
    if (s.startsWith("@hoverProbe "))
      window.hoverProbes.push(JSON.parse(s.slice(12)));
    log(...args);
  };
});
async function probe() {
  const n = await page.evaluate(() => window.hoverProbes.length);
  await page.keyboard.press("F2", { delay: 40 });
  await page.waitForFunction((n) => window.hoverProbes.length > n, n);
  return page.evaluate(() => window.hoverProbes.at(-1));
}
async function move(x, y, click = false) {
  const s = await probe();
  const box = await page.locator("#game-canvas").boundingBox();
  const px = box.x + box.width / 2 + ((x - 480) * box.width) / s.vw;
  const py = box.y + box.height / 2 + ((y - 300) * box.height) / s.vh;
  await page.mouse.move(px, py);
  if (click) await page.mouse.click(px, py, { delay: 70 });
  await page.waitForTimeout(160);
  return probe();
}
async function check(action, x, y, costume) {
  const s = await move(x, y);
  report.samples.push(s);
  assert.equal(s.action, action);
  assert.equal(s.visible, true);
  assert.equal(s.costume, costume);
  assert.ok(s.w > 0 && s.h > 0);
  assert.ok(Math.abs(s.x - (s.cx + s.bx + s.w / 2 - 480)) < 0.01);
  assert.ok(Math.abs(s.y - (s.cy + 300 - s.by - s.h / 2)) < 0.01);
  return s;
}
const shot = (name) =>
  page.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });
try {
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4188") +
      "/runtime/runner.html",
  );
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({ packageURL }) => {
      window.onGameError((e) => window.hoverErrors.push(String(e)));
      window.onEngineCrash((e) => window.hoverErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          ["engine.zip", "engineres.zip", "engine.wasm", "ispx.wasm"].map(
            (n) => [
              n,
              ["ispx.wasm", "engineres.zip"].includes(n)
                ? packageURL.replace("package.xbp", n)
                : "/runtime/" + n,
            ],
          ),
        ),
      );
      const files = window.fflate.unzipSync(
        new Uint8Array(await (await fetch(packageURL)).arrayBuffer()),
      );
      const enc = new TextEncoder(),
        dec = new TextDecoder();
      const config = JSON.parse(
        dec.decode(files["assets/sprites/NativeHover/index.json"]),
      );
      window.hoverCostumes = config.costumes.map((c) => c.name);
      let main = dec.decode(files["main.spx"]);
      main += `\nonKey KeyF2, => {x,y,w,h:=NativeLogic.nativeButtonRect(nativeHover); println "@hoverProbe",NativeLogic.nativeCloudJSON(map[string]any{"action":nativeHover,"visible":NativeHover.uiVisible,"x":NativeHover.uiX,"y":NativeHover.uiY,"costumeIndex":NativeHover.uiCostumeIndex,"bx":x,"by":y,"w":w,"h":h,"vw":viewWidth,"vh":viewHeight,"cx":viewCenterX,"cy":viewCenterY,"open":nativeStudyOpen,"page":nativeStudyPage,"phase":phase,"settings":nativeSettings})}\n`;
      files["main.spx"] = enc.encode(main);
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
      window.xbuilder_set_username("HoverRegression");
      await window.startGame();
    },
    { packageURL },
  );
  await page.waitForTimeout(1800);
  // Resolve the render index to its actual asset, not an assumed action offset.
  await page.evaluate(() => {
    const push = window.hoverProbes.push.bind(window.hoverProbes);
    window.hoverProbes.push = (...items) =>
      push(
        ...items.map((s) => ({
          ...s,
          costume: window.hoverCostumes[s.costumeIndex],
        })),
      );
  });
  await page.locator("#game-canvas").focus();
  let s = await probe();
  if (baseline) {
    s = await move(120, 300 - s.vh / 2 + 14);
    report.samples.push(s);
    assert.equal(s.action, 38);
    assert.equal(s.w, 0);
    assert.equal(s.costume, "hover42");
    await shot("misplaced-achievement-hover");
    pass(
      "Reproduced: achievement action 38 renders reset-button hover42 at zero-size fallback coordinates",
    );
  } else {
    for (const size of [
      { width: 960, height: 600 },
      { width: 1120, height: 840 },
      { width: 1440, height: 720 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(500);
      s = await probe();
      const top = 300 - s.vh / 2 + 14;
      await check(38, 120, top, "hover38");
      await shot("achievement-hover-" + size.width);
      s = await move(450, 170);
      assert.equal(s.visible, false, "pointer exit clears highlight");
    }
    pass(
      "Achievement hover stays within its rail at 16:10, 4:3 and ultrawide sizes; leaving clears it",
    );
    await page.setViewportSize({ width: 960, height: 600 });
    await page.waitForTimeout(500);
    s = await probe();
    s = await move(120, 300 - s.vh / 2 + 14, true);
    assert.equal(s.open, true);
    await check(40, 762, 518, "hover40");
    s = await move(762, 518, true);
    assert.equal(s.page, 1);
    await check(39, 654, 518, "hover39");
    s = await move(654, 518, true);
    assert.equal(s.page, 0);
    await check(41, 812, 99, "hover41");
    await shot("archive-close-hover");
    s = await move(812, 99, true);
    assert.equal(s.open, false);
    assert.equal(s.visible, false);
    pass(
      "Achievement next, previous and close use their own highlight and remain clickable without residue",
    );
    await check(1, 780, 211, "titlehover1");
    await check(34, 784, 429, "titlehover34");
    s = await move(784, 429, true);
    assert.equal(s.settings, true);
    await check(12, 730, 256, "hover12");
    await check(42, 730, 496, "hover42");
    await shot("settings-hover");
    await page.keyboard.press("Escape", { delay: 50 });
    await page.waitForTimeout(200);
    s = await probe();
    assert.equal(s.settings, false);
    pass(
      "Title, settings and local-reset controls retain the correct highlight assets after mapping change",
    );
  }
  assert.deepEqual(await page.evaluate(() => window.hoverErrors), []);
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
  console.error(e);
  await shot("failure").catch(() => {});
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
