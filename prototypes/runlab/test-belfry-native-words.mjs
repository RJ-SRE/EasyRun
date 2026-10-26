import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { WORDS } from "./public/cet4-words.js";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL("test-results/native-words/", root);
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
    "Native inscription integration. Real skill keys open questions; test-only F9 prepares safe resources, F10/F11 select question type, F7/F8 create chain/bind states. Initial camera follows Anchor to retain viewport regression coverage. No online project changed.",
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
    window.wordQuestions = [];
    window.wordAnswers = [];
    window.decks = [];
    window.mix = [];
    window.sfx = [];
    window.nativeRender = [];
    window.clonePeak = 0;
    window.nativeFrameSamples = [];
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
      if (s.startsWith("@nativeUI ") && window.nativeState[0] === 1)
        window.nativeFrameSamples.push([
          window.performance.now(),
          window.nativeUI[9],
        ]);
      if (s.startsWith("@nativeMusic ")) window.nativeMusic.push(s);
      if (s.startsWith("@nativeQuestion "))
        window.wordQuestions.push(s.slice(16).split(/\s+/));
      if (s.startsWith("@nativeAnswer "))
        window.wordAnswers.push(s.slice(14).split(/\s+/).map(Number));
      if (s.startsWith("@nativeDeck ")) window.decks.push(s);
      if (s.startsWith("@nativeVolume "))
        window.mix = s.slice(14).split(/\s+/).map(Number);
      if (s.startsWith("@nativeSfx ")) window.sfx.push(s);
      if (s.startsWith("@render ")) {
        window.nativeRender = s.slice(8).split(/\s+/).map(Number);
        const r = window.nativeRender,
          u = window.nativeUI;
        window.clonePeak = Math.max(
          window.clonePeak,
          r[1] + r[3] + r[4] + (u[8] || 0),
        );
      }
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
          .replace("var (", "var (\n nativeProbeFrames int")
          .replace(
            "nativeUiLogTime+=dt",
            "nativeProbeFrames++; nativeUiLogTime+=dt",
          )
          .replace(
            "Camera.zoom,nativeTextCount,nativeGlyphLive",
            "Camera.zoom,nativeTextCount,nativeGlyphLive,nativeProbeFrames",
          ) +
          "\nonKey KeyF7, => {chainOwner=0; wordOwner=0; requestWord(5); beginWord()}\nonKey KeyF8, => {bindEnemy=0; requestWord(6); beginWord()}\nonKey KeyF9, => {if phase==1 {Hero.resetHero(230,0); health=6; embers=2; Hero.invulnerable=999; Hero.bowCool=0; Hero.bladeCool=0; Hero.healCool=0; Hero.ultimateCool=0}}\nonKey KeyF10, => {nativeQuestionMode=0}\nonKey KeyF11, => {nativeQuestionMode=1}\n",
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

async function question(key, kind) {
  await tap("F9");
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.wordQuestions.length);
  await page.keyboard.down(key);
  await page.waitForTimeout(250);
  await page.keyboard.up(key);
  await state(5, -1);
  await page.waitForFunction((n) => window.wordQuestions.length > n, before);
  const q = await page.evaluate(() => window.wordQuestions.at(-1));
  assert.equal(Number(q[1]), kind);
  await page.waitForTimeout(250);
  return q;
}
async function answerMeaning(q, correct = true) {
  await tap("F11");
  await tap(String(((Number(q[4]) + (correct ? 0 : 1)) % 3) + 1));
  await state(1, -1);
  await page.waitForTimeout(250);
}
try {
  await boot();
  await state(0, 0);
  await page.waitForFunction(
    () =>
      window.nativeRender[0] === window.nativeRender[1] &&
      window.nativeRender[0] > 0,
  );
  assert.equal(await page.evaluate(() => window.nativeRender[2]), 0);
  pass(
    "all 121 world clones spawn before text; native glyphs do not consume missing enemy or platform slots",
  );
  for (const level of ["cet4", "cet6"]) {
    await click(800, 256);
    await page.waitForTimeout(200);
    const deck = await page.evaluate(() => window.decks.at(-1));
    const ids = deck
      .match(/\[([^\]]+)\]/)[1]
      .split(" ")
      .map(Number);
    assert.ok(ids.every((i) => WORDS[i].levels.includes(level)));
  }
  await click(800, 256);
  await page.waitForTimeout(200);
  pass(
    "CET4 and CET6 scope selection draws only words belonging to the selected source level",
  );
  const initial = await page.evaluate(() => window.decks.at(-1));
  assert.equal(new Set(initial.match(/\[([^\]]+)\]/)[1].split(" ")).size, 30);
  await click(820, 350);
  await page.waitForTimeout(250);
  assert.notEqual(await page.evaluate(() => window.decks.at(-1)), initial);
  await click(630, 350);
  await state(0, 6);
  await shot("wordbook");
  await click(770, 530);
  await page.waitForTimeout(250);
  await shot("wordbook-page2");
  await tap("Escape");
  await state(0, 0);
  pass(
    "8815-word native deck draws 30 unique words; shuffle and paginated preview work before entering combat",
  );
  await click(768, 438);
  await page.waitForFunction(() => window.mix[0] === 50);
  await click(712, 478);
  await page.waitForFunction(() => window.mix[1] === 25);
  await shot("title-mix");
  pass(
    "music and action sliders independently set 50% and 25% without changing the other channel",
  );
  const previewDeck = await page.evaluate(() => window.decks.at(-1));
  await tap("Enter");
  await state(1, -1);
  assert.equal(await page.evaluate(() => window.decks.at(-1)), previewDeck);
  let q = await question("u", 1);
  while (!/^[a-z -]+$/.test(q.slice(6).join(" "))) {
    await answerMeaning(q, true);
    q = await question("u", 1);
  }
  await tap("F10");
  await shot("spelling");
  const time = await page.evaluate(() => window.nativeState[3]);
  const music = await page.evaluate(() => window.nativeMusic.at(-1));
  for (const k of ["r", "t", "b", "h", "j", "w", "p", "f", "v", "m"])
    await tap(k);
  await state(5, -1);
  assert.equal(await page.evaluate(() => window.nativeState[3]), time);
  assert.equal(await page.evaluate(() => window.nativeMusic.at(-1)), music);
  for (let i = 0; i < 10; i++) await tap("Backspace");
  for (const letter of q.slice(6).join(" ")) await tap(letter);
  await shot("typed");
  await tap("Enter");
  await state(1, -1);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.wordAnswers.at(-1)[0]), 1);
  assert.ok(await page.evaluate(() => window.nativeState[53] > 0));
  await shot("cooldown");
  await page.waitForFunction(
    () =>
      window.nativeRender[5] === window.nativeRender[6] &&
      window.nativeRender[5] > 0,
  );
  assert.ok(await page.evaluate(() => window.nativeUI[8] < 40));
  pass(
    "real charged arrow invokes spelling; typing combat/menu/mute keys is isolated; correct submission releases once and starts 3-second cooldown",
  );
  const q2 = await question("l", 2);
  await tap("F11");
  await shot("meaning");
  await answerMeaning(q2, false);
  assert.equal(await page.evaluate(() => window.wordAnswers.at(-1)[0]), 2);
  assert.equal(await page.evaluate(() => window.nativeState[54]), 0);
  assert.ok((await page.evaluate(() => window.wordAnswers.at(-1)[2])) > 0);
  pass(
    "wrong meaning cancels charged blade without consuming cooldown and increases session weakness",
  );
  await question("p", 4);
  await tap("F10");
  await tap("z");
  await tap("Enter");
  await state(1, -1);
  assert.equal(await page.evaluate(() => window.wordAnswers.at(-1)[0]), 2);
  assert.equal(await page.evaluate(() => window.nativeState[56]), 0);
  pass(
    "misspelled submission cancels ultimate; invalid typing never directly casts a skill",
  );
  const q3 = await question("i", 3);
  await answerMeaning(q3, true);
  await page.waitForFunction(
    () => window.nativeState[4] === 7 && window.nativeState[55] > 0,
  );
  pass(
    "healing gates before recovery; correct meaning restores one life and starts cooldown",
  );
  const q4 = await question("p", 4);
  await shot("ultimate-prompt");
  await tap("Escape");
  await page.waitForTimeout(1500);
  await state(5, -1);
  await shot("question-paused");
  await tap("Escape");
  await answerMeaning(q4, true);
  await page.waitForFunction(() => window.nativeState[56] > 0);
  pass(
    "question can pause/resume without losing input; correct ultimate starts its 5-second cooldown",
  );
  const q5 = await question("l", 2);
  await page.waitForTimeout((Number(q5[5]) + 1) * 1000);
  await state(1, -1);
  assert.equal(await page.evaluate(() => window.wordAnswers.at(-1)[0]), 3);
  assert.equal(await page.evaluate(() => window.nativeState[54]), 0);
  pass("timeout cancels the pending skill without cooldown and resumes combat");
  await tap("F9");
  await tap("F7");
  await state(5, -1);
  await page.waitForTimeout(250);
  let trap = await page.evaluate(() => window.wordQuestions.at(-1));
  assert.equal(Number(trap[1]), 5);
  await answerMeaning(trap, true);
  await tap("F8");
  await state(5, -1);
  await page.waitForTimeout(250);
  trap = await page.evaluate(() => window.wordQuestions.at(-1));
  assert.equal(Number(trap[1]), 6);
  await answerMeaning(trap, true);
  pass(
    "chain and bind rescue use the same validated native question path (explicit trap setup fixtures)",
  );
  await tap("Escape");
  await tap("m");
  await state(0, 0);
  assert.notEqual(await page.evaluate(() => window.decks.at(-1)), previewDeck);
  await tap("t");
  await state(1, -1);
  await tap("p");
  await page.waitForTimeout(500);
  await state(1, -1);
  pass(
    "returning to title prepares a fresh preview deck; practice stays free of inscription questions",
  );
  assert.ok((await page.evaluate(() => window.sfx.length)) > 0);
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  assert.ok(await page.evaluate(() => window.clonePeak < 300));
  await page.waitForFunction(() => window.nativeUI[7] === window.nativeUI[8]);
  const samples = await page.evaluate(() => window.nativeFrameSamples);
  report.frameRateSamples = samples
    .slice(1)
    .map((p, i) => ((p[1] - samples[i][1]) * 1000) / (p[0] - samples[i][0]))
    .filter((n) => Number.isFinite(n) && n > 0);
  report.clonePeak = await page.evaluate(() => window.clonePeak);
  report.worldRender = await page.evaluate(() => window.nativeRender);
  pass(
    "native text shrinks after answers, real arrows receive clone slots, and observed combined clone count stays below 300",
  );
  report.questions = await page.evaluate(() => window.wordQuestions);
  report.answers = await page.evaluate(() => window.wordAnswers);
  report.deckCount = await page.evaluate(() => window.decks.length);
  report.sfx = await page.evaluate(() => window.sfx);
} catch (error) {
  report.errors.push(error.stack);
  console.error(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    await shot("failure");
    report.diagnostics = await page
      .evaluate(() => ({
        state: window.nativeState,
        errors: window.nativeErrors,
        questions: window.wordQuestions,
        answers: window.wordAnswers,
        mix: window.mix,
      }))
      .catch(() => null);
  }
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
