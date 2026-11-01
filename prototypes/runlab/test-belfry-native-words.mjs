import { WORD_MODES, wordDifficulty } from "./public/word-selection.js";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { WORDS } from "./public/common-words.js";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL(
    `test-results/${process.env.NATIVE_WORDS_OUT || "native-words"}/`,
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
    "Native inscription integration. Real skill keys open questions; test-only F9 prepares safe resources, F10/F11 select question type, F7/F8 create chain/bind states; F12 injects bounded long-text fixtures. Initial camera follows Anchor to retain viewport regression coverage. No online project changed.",
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
    window.nativeLayout = [];
    window.spelling = [];
    window.cue = "";
    window.context = "";
    window.typed = "";
    window.ledgerView = [];
    window.ledgerRows = [];
    window.ledgerBadges = [];
    window.ledgerQuery = "";
    window.clonePeak = 0;
    window.nativeFrameSamples = [];
    window.nativeBank = {};
    window.learningGolden = [];
    window.learningDeck = [];
    window.learningCore = [];
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      // The deployed compiler wraps println in structured JSON logs.
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* plain npm log */
      }
      if (s.startsWith("@studyProbe "))
        window.studyProbe = JSON.parse(s.slice(12));
      if (s.startsWith("@studyGolden "))
        window.studyGolden = JSON.parse(s.slice(13));
      if (s.startsWith("@learningGolden "))
        window.learningGolden = s.slice(16).trim().split(/\s+/).map(Number);
      if (s.startsWith("@learningDeck "))
        window.learningDeck = s.slice(14).trim().split(/\s+/).map(Number);
      if (s.startsWith("@learningCore "))
        window.learningCore.push(s.slice(14).trim());
      if (s.startsWith("@nativeBank ")) {
        const end = s.indexOf(" ", 12);
        window.nativeBank[s.slice(12, end)] = s.slice(end + 1);
        return;
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
      if (s.startsWith("@nativeLedgerView ")) {
        window.ledgerView = s.slice(18).split(/\s+/);
        window.ledgerBadges = [];
      }
      if (s.startsWith("@nativeLedgerRows "))
        window.ledgerRows = (s.match(/\[([^\]]*)\]/)?.[1] || "")
          .split(" ")
          .filter(Boolean)
          .map(Number);
      if (s.startsWith("@nativeLedgerBadge "))
        window.ledgerBadges.push(s.slice(19).split(/\s+/).map(Number));
      if (s.startsWith("@nativeLedger "))
        window.ledgerQuery = s.split(/\s+/).slice(5).join(" ");
      if (s.startsWith("@nativeSpelling "))
        window.spelling = s.slice(16).split(/\s+/);
      if (s.startsWith("@nativeCue ")) window.cue = s.slice(11);
      if (s.startsWith("@nativeContext ")) window.context = s.slice(15);
      if (s.startsWith("@nativeTyped ")) window.typed = s.slice(13);
      if (s.startsWith("@nativeLayout ")) window.nativeLayout = [];
      if (s.startsWith("@nativeGlyph "))
        window.nativeLayout.push(s.slice(13).split(/\s+/).map(Number));
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
      const nativeFile = files["NativeLogic.spx"]
        ? "NativeLogic.spx"
        : "main.spx";
      files[nativeFile] = encoder.encode(
        decoder
          .decode(files[nativeFile])
          .replace(
            "nativeTextVersion++",
            'nativeTextVersion++; println "@nativeSpelling",nativeHint,nativeHintVisible(),nativeQuestionAge; println "@nativeCue",nativeCue(); println "@nativeContext",nativeWordPOS[nativeWordIndex],nativeMeanings[nativeWordIndex]; println "@nativeTyped",nativeInput; println "@nativeLayout",nativeTextCount; for n:=0;n<nativeTextCount;n++ {if nativeTextFocus[n] {println "@nativeGlyph",nativeTextX[n],nativeTextY[n],nativeTextSize[n]}}',
          )
          .replace(
            "func nativeDrawLedger() {",
            'func nativeDrawLedger() {println "@nativeLedgerView",phase,nativeLedgerReturn,nativeLedgerFilter,len(nativeLedgerMatches),nativePreviewPage,len(nativeLedgerPages),nativeCompleted(),nativeLedgerWon; startProbe:=nativeLedgerPages[nativePreviewPage]; endProbe:=len(nativeLedgerMatches); if nativePreviewPage+1<len(nativeLedgerPages) {endProbe=nativeLedgerPages[nativePreviewPage+1]}; println "@nativeLedgerRows",nativeLedgerMatches[startProbe:endProbe]',
          )
          .replace(
            "nativeLedgerText(badge,x-20",
            'println "@nativeLedgerBadge",i,state; nativeLedgerText(badge,x-20',
          )

          .replace(
            "nativeUiLogTime+=dt",
            "nativeProbeFrames++; nativeUiLogTime+=dt",
          )
          .replace(
            "Camera.zoom,nativeTextCount,nativeGlyphLive",
            "Camera.zoom,nativeTextCount,nativeGlyphLive,nativeProbeFrames",
          ),
      );
      files["main.spx"] = encoder.encode(
        decoder
          .decode(files["main.spx"])
          .replace("var (", "var (\n nativeProbeFrames int") +
          '\nonKey KeyF12, => {nativeWords[nativeWordIndex]="telecommunications"; nativeMeanings[nativeWordIndex]="探索探索探索探索探索探索探索探索探索探索探索探索探索探索"; nativeDistractA[nativeWordIndex]="练习练习练习练习练习练习练习练习练习练习练习练习练习练习"; nativeDistractB[nativeWordIndex]="旅程旅程旅程旅程旅程旅程旅程旅程旅程旅程旅程旅程旅程旅程"; nativeQuestionLimit=60; nativeTextMemoKnown=false}\n' +
          '\nonKey Key0, => {nativeWords[nativeWordIndex]="colour"; nativeAliases[nativeWordIndex]="color"; nativeMeanings[nativeWordIndex]="颜色；色彩"; nativeQuestionMode=0; nativeQuestionAge=0.3; nativeQuestionLimit=60; nativeTextMemoKnown=false}\n' +
          "\nonKey KeyF7, => {chainOwner=0; wordOwner=0; requestWord(5); beginWord()}\nonKey KeyF8, => {bindEnemy=0; requestWord(6); beginWord()}\nonKey KeyF9, => {if phase==1 {Hero.resetHero(230,0); health=6; embers=2; Hero.invulnerable=999; Hero.bowCool=0; Hero.bladeCool=0; Hero.healCool=0; Hero.ultimateCool=0}}\nonKey KeyF10, => {nativeQuestionMode=0}\nonKey KeyF11, => {nativeQuestionMode=1}\n",
      );
      if (files["WorldLogic.spx"]) {
        files["main.spx"] = encoder.encode(
          decoder
            .decode(files["main.spx"])
            .replace(
              /(?<![.\w])(requestWord|beginWord)(?=\()/g,
              "WorldLogic.$1",
            ),
        );
      }
      files["main.spx"] = encoder.encode(
        decoder.decode(files["main.spx"]) +
          '\nonKey KeyF5, => {println "@nativeBank word",strings.Join(nativeWords,"\\u001f"); println "@nativeBank meaning",strings.Join(nativeMeanings,"\\u001f"); println "@nativeBank pos",strings.Join(nativeWordPOS,"\\u001f"); println "@nativeBank a",strings.Join(nativeDistractA,"\\u001f"); println "@nativeBank b",strings.Join(nativeDistractB,"\\u001f"); println "@nativeBank aliases",strings.Join(nativeAliases,"\\u001f"); println "@nativeBank level",fmt.Sprint(nativeLevels); println "@nativeBank spell",fmt.Sprint(nativeSpellable)}\n',
      );
      // Test-only golden vector runs the actual packaged XGo implementation.
      const logic = decoder
        .decode(files["NativeLogic.spx"])
        .replace("onStart => {hide}", "");
      files["NativeLogic.spx"] = encoder.encode(
        logic +
          `
func nativeStudyGoldenTest() {
 initNativeLearning(); i:=nativeDeck[0]; nativeWordIndex=i; nativeSpellable[i]=1; wordPending=1; wordSerial=20000
 nativeQuestionMode=0; nativeInput=""; nativeLearningAnswer(2)
 wordSerial++; nativeQuestionMode=1; nativeLearningAnswer(1)
 wordSerial++; nativeQuestionMode=0; nativeHint=0; nativeInput=nativeWords[i]; nativeQuestionAge=0; nativeTypedWithHint=true; nativeLearningAnswer(1)
 nativeLearnDue[i*2]=float64(timer)-1
 wordSerial++; nativeHint=2; nativeQuestionAge=3; nativeTypedWithHint=false; nativeLearningAnswer(1); nativeLearningAnswer(1)
 for n:=0;n<10;n++ {wordSerial++; nativeQuestionMode=1; nativeLearningAnswer(1)}
 println "@studyGolden",nativeCloudJSON(map[string]any{"metrics":nativeStudyValues,"unlocked":nativeStudyUnlocked,"count":nativeStudyCount,"assisted":nativeLearnAssisted[i*2]})
 wordPending=0; nativeInput=""; phase=0; nativeSettings=false
}
func nativeStudyProbeTest() {println "@studyProbe",nativeCloudJSON(map[string]any{"open":nativeStudyOpen,"page":nativeStudyPage,"phase":phase,"wordPaused":wordVisualPaused,"questionAge":nativeQuestionAge,"musicPaused":nativeMusicPaused,"count":nativeStudyCount,"glyphs":nativeGlyphCount,"input":nativeInput,"cards":[]int{NativeStudyCard0.uiCostumeIndex,NativeStudyCard1.uiCostumeIndex,NativeStudyCard2.uiCostumeIndex,NativeStudyCard3.uiCostumeIndex}})}
func nativeLearningGoldenTest() {
 initNativeLearning(); nativeInput=""; nativeTypedWithHint=true; i:=nativeDeck[0]; nativeWordIndex=i; nativeSpellable[i]=1; wordPending=1
 wordSerial=9001; nativeQuestionMode=0; nativeLearningAnswer(2); missing:=nativeLearningAbility(i)
 wordSerial++; nativeQuestionMode=1; nativeLearningAnswer(1); weak:=nativeLearningAbility(i)
 spelling:=nativeLearnWeak[i*2]; meaning:=nativeLearnWeak[i*2+1]
 wordSerial++; nativeQuestionMode=0; nativeLearningAnswer(1); assisted:=nativeLearnWeak[i*2]; nativeLearningAnswer(1)
 attempts:=nativeLearnAttempts[i*2]; correct:=nativeLearnCorrect[i*2]; wrong:=nativeLearnWrong[i*2]
 nativeLearnWeak[i*2]=0; nativeLearnLast[i]=1; tie:=nativeLearningAbility(i); wordPending=5; emergency:=nativeLearningAbility(i); wordPending=0
 println "@learningGolden",missing,weak,spelling,meaning,assisted,attempts,correct,wrong,tie,emergency,nativeLearnAssisted[i*2]
 nativeCoreBank=true
 for mode:=0;mode<4;mode++ {nativeScope=mode; nativeShuffleDeck(); valid:=true; for _,id:=range nativeDeck {if mode<3 && nativeLevels[id]!=mode+1 {valid=false}}; println "@learningCore",mode,len(nativeDeck),valid}
 nativeCoreBank=false; nativeScope=0; nativeShuffleDeck(); nativeDeckUsed=true; nativeDone[0]=1
 first:=nativeDeck[0]; nativeLearningEvent("start"); nativeStartWords(); println "@learningDeck",first,nativeDeck[0],nativeCompleted()
}
`,
      );
      files["main.spx"] = encoder.encode(
        decoder.decode(files["main.spx"]) +
          "\nonKey KeyF2, => {NativeLogic.nativeLearningGoldenTest()}\nonKey KeyF3, => {NativeLogic.nativeStudyProbeTest()}\nonKey KeyF6, => {NativeLogic.nativeStudyGoldenTest()}\n",
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
  await tap("F5");
  await page.waitForFunction(() => Object.keys(window.nativeBank).length === 8);
  const bank = await page.evaluate(() => window.nativeBank);
  const trim = (s) => Array.from(s).slice(0, 28).join("");
  const expected = WORDS.map((w) => ({
    word: w.word.toLowerCase(),
    meaning: trim(w.meaning),
    pos: w.pos,
    a: trim(w.distractors[0]),
    b: trim(w.distractors[1]),
    aliases: w.accepted.map((v) => v.toLowerCase()).join("|"),
    level: wordDifficulty(w),
    spell: Number(w.spellable && /^[a-z -]+$/.test(w.word.toLowerCase())),
  }));
  for (const key of Object.keys(bank)) {
    const actual =
      key === "level" || key === "spell"
        ? bank[key].slice(1, -1).split(/\s+/).map(Number)
        : bank[key].split("\u001f");
    assert.deepEqual(
      actual,
      expected.map((row) => row[key]),
      key + " lost alignment during packed-data decoding",
    );
  }
  pass(
    "all 3816 runtime rows preserve words, meanings, distractors, aliases, gameplay difficulty and spelling flags exactly",
  );
  await page.waitForFunction(
    () =>
      window.nativeRender[0] === window.nativeRender[1] &&
      window.nativeRender[0] > 0,
  );
  assert.equal(await page.evaluate(() => window.nativeRender[2]), 0);
  pass(
    "all 121 world clones spawn before text; native glyphs do not consume missing enemy or platform slots",
  );
  await click(784, 430);
  await state(0, 7);
  for (const [index, mode] of WORD_MODES.entries()) {
    // Start at normal; each click must cycle through all four actual modes.
    if (index > 0) await click(800, 256);
    await page.waitForTimeout(200);
    const deck = await page.evaluate(() => window.decks.at(-1));
    const ids = deck
      .match(/\[([^\]]+)\]/)[1]
      .split(" ")
      .map(Number);
    assert.equal(new Set(ids).size, 30);
    if (mode !== "random")
      assert.ok(ids.every((i) => wordDifficulty(WORDS[i]) === index + 1));
    else assert.ok(new Set(ids.map((i) => wordDifficulty(WORDS[i]))).size > 1);
    await shot("selection-" + mode);
  }
  await click(800, 256);
  await page.waitForTimeout(200);
  pass(
    "normal, hard, challenge and random cycle on the default local bank and select 30 unique words from the correct pools",
  );
  const initial = await page.evaluate(() => window.decks.at(-1));
  assert.equal(new Set(initial.match(/\[([^\]]+)\]/)[1].split(" ")).size, 30);
  await click(820, 350);
  await page.waitForTimeout(250);
  assert.notEqual(await page.evaluate(() => window.decks.at(-1)), initial);
  await click(630, 350);
  await state(0, 6);
  await shot("wordbook");
  await page.waitForFunction(() => Number(window.ledgerView[3]) === 30);
  const ledgerDeck = await page.evaluate(() => window.decks.at(-1));
  const ledgerIDs = await page.evaluate(() => [...window.ledgerRows]);
  const pageCount = await page.evaluate(() => Number(window.ledgerView[5]));
  for (let n = 1; n < pageCount; n++) {
    await click(710, 530);
    await page.waitForFunction((n) => Number(window.ledgerView[4]) === n, n);
    ledgerIDs.push(...(await page.evaluate(() => window.ledgerRows)));
  }
  assert.equal(new Set(ledgerIDs).size, 30);
  assert.deepEqual(
    [...ledgerIDs].sort((a, b) => a - b),
    ledgerDeck
      .match(/\[([^\]]+)\]/)[1]
      .split(" ")
      .map(Number)
      .sort((a, b) => a - b),
  );
  await click(710, 530);
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => Number(window.ledgerView[4])),
    pageCount - 1,
  );
  await shot("wordbook-last-page");
  await click(280, 205);
  await page.waitForTimeout(250);
  await shot("wordbook-filter");
  await click(280, 269);
  await page.waitForFunction(
    () =>
      Number(window.ledgerView[2]) === 1 && Number(window.ledgerView[3]) === 0,
  );
  await shot("wordbook-empty");
  await click(280, 205);
  await click(280, 299);
  await page.waitForFunction(
    () =>
      Number(window.ledgerView[2]) === 2 &&
      Number(window.ledgerView[3]) === 3816,
  );
  await click(500, 205);
  for (const k of "rtbhfvm") await tap(k);
  await state(0, 6);
  await page.waitForFunction(() => window.ledgerQuery === "rtbhfvm");
  for (let n = 0; n < 7; n++) await tap("Backspace");
  for (const k of "biodiversity") await tap(k);
  await page.waitForFunction(() => Number(window.ledgerView[3]) === 1);
  assert.equal(
    WORDS[(await page.evaluate(() => window.ledgerRows))[0]].word,
    "biodiversity",
  );
  await shot("wordbook-search");
  await page.setViewportSize({ width: 480, height: 360 });
  await page.waitForFunction(
    () => Math.abs(window.nativeUI[4] / window.nativeUI[5] - 4 / 3) < 0.01,
  );
  await page.waitForTimeout(250);
  await shot("wordbook-small");
  await page.setViewportSize({ width: 960, height: 600 });
  await page.waitForFunction(
    () => Math.abs(window.nativeUI[4] / window.nativeUI[5] - 1.6) < 0.01,
  );
  await click(738, 205);
  await page.waitForFunction(() => Number(window.ledgerView[3]) === 3816);
  await click(280, 205);
  await click(280, 239);
  await page.waitForFunction(
    () =>
      Number(window.ledgerView[2]) === 0 && Number(window.ledgerView[3]) === 30,
  );
  assert.equal(await page.evaluate(() => window.decks.at(-1)), ledgerDeck);
  pass(
    "ledger pages cover all 30 words without gaps or duplicates; weakness/full-bank filters and isolated live search work without reshuffling",
  );
  await tap("Escape");
  await state(0, 7);
  pass(
    "3816-word native deck draws 30 unique words; shuffle and paginated preview work before entering combat",
  );
  await click(800, 180);
  await state(0, 8);
  await click(768, 255);
  await page.waitForFunction(() => window.mix[0] === 50);
  await click(712, 313);
  await page.waitForFunction(() => window.mix[1] === 25);
  await shot("title-mix");
  pass(
    "music and action sliders independently set 50% and 25% without changing the other channel",
  );
  await click(640, 180);
  await state(0, 7);
  assert.equal(await page.evaluate(() => Number(window.spelling[0])), 1);
  await click(780, 384);
  await shot("hint-settings");
  await click(760, 266);
  await page.waitForFunction(() => Number(window.spelling[0]) === 0);
  pass(
    "title offers full hints, 2-second first-letter challenge and 1-second independent recall; default is gradual challenge",
  );
  await tap("Escape");
  await state(0, 0);
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
  await tap("Tab");
  await state(5, -1);
  await shot("spelling");
  const time = await page.evaluate(() => window.nativeState[3]);
  const music = await page.evaluate(() => window.nativeMusic.at(-1));
  await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(() => window.cue), q.slice(6).join(" "));
  assert.match(await page.evaluate(() => window.context), /[\u4e00-\u9fff]/);
  assert.equal(await page.evaluate(() => window.nativeState[3]), time);
  assert.equal(await page.evaluate(() => window.nativeMusic.at(-1)), music);
  const word = q.slice(6).join(" ");
  await tap(word[0]);
  await tap("Backspace");
  await tap("Enter");
  await state(5, -1);
  for (const letter of word.slice(0, -1)) await tap(letter);
  await shot("typed");
  await tap(word.at(-1));
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
    "charged arrow shows Chinese and full hint beyond 2 seconds; Backspace/partial Enter do not resolve; last correct letter automatically releases once and starts 3-second cooldown",
  );
  await tap("Tab");
  await state(4, 6);
  await page.waitForFunction(() => Number(window.ledgerView[6]) === 1);
  const frozen = await page.evaluate(() => window.nativeState[3]);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.nativeState[3]), frozen);
  assert.ok(
    (await page.evaluate(() => window.ledgerBadges)).some(
      ([, state]) => state === 2,
    ),
  );
  await shot("wordbook-progress");
  await tap("Escape");
  await state(1, -1);
  await page.waitForTimeout(220);
  await tap("Escape");
  await state(4, 3);
  await tap("Tab");
  await state(4, 6);
  await tap("Escape");
  await state(4, 3);
  await tap("Escape");
  await state(1, -1);
  pass(
    "gameplay ledger pauses combat, shows completed-word states and resumes; opening from pause returns to pause; an active question rejects Tab",
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
  await tap("Tab");
  await state(4, 6);
  await click(280, 205);
  await click(280, 269);
  await page.waitForFunction(
    () =>
      Number(window.ledgerView[2]) === 1 && Number(window.ledgerView[3]) > 0,
  );
  assert.ok(
    (await page.evaluate(() => window.ledgerRows)).includes(Number(q2[2])),
  );
  assert.ok(
    (await page.evaluate(() => window.ledgerBadges)).some(
      ([, state]) => state === 1,
    ),
  );
  await shot("wordbook-review");
  await tap("Escape");
  await state(1, -1);
  pass(
    "a wrong answer becomes a review badge and enters the weakness ledger in the same session",
  );
  for (const [key, kind, cool] of [
    ["u", 1, 53],
    ["l", 2, 54],
    ["i", 3, 55],
    ["p", 4, 56],
  ]) {
    await question(key, kind);
    await tap("0"); // deterministic colour/color fixture, only in test copy
    const before = await page.evaluate(() => window.wordAnswers.length);
    const arrowCount = await page.evaluate(() => window.nativeRender[5]);
    if (kind > 1) {
      for (const c of "col") await tap(c);
      await state(5, -1);
    }
    await page.keyboard.down("w"); // first invalid letter, including inside a correct prefix; must not become jump
    await state(1, -1);
    await page.waitForTimeout(650);
    assert.equal(
      await page.evaluate(() => window.wordAnswers.length),
      before + 1,
    );
    assert.equal(await page.evaluate(() => window.wordAnswers.at(-1)[0]), 2);
    assert.equal(await page.evaluate((i) => window.nativeState[i], cool), 0);
    assert.equal(await page.evaluate(() => window.nativeState[66]), 0);
    assert.equal(await page.evaluate(() => window.nativeState[58]), 0);
    assert.equal(await page.evaluate(() => window.nativeState[59]), 0);
    assert.equal(await page.evaluate(() => window.nativeState[42]), 0);
    assert.ok(
      await page.evaluate(() => window.nativeState[15] <= 0),
      "held wrong W never becomes a jump",
    );
    assert.equal(
      await page.evaluate(() => window.nativeRender[5]),
      arrowCount,
      "failure creates no arrow",
    );
    if (kind === 3)
      assert.equal(
        await page.evaluate(() => window.nativeState[60]),
        2,
        "failed healing refunds ember",
      );
    await page.keyboard.up("w");
    pass(
      `first wrong letter instantly cancels skill ${key.toUpperCase()}, leaves cooldown untouched and quarantines held W until release`,
    );
  }
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
  await question("l", 2);
  await tap("F12");
  await tap("F11");
  await page.waitForTimeout(250);
  let layout = await page.evaluate(() => window.nativeLayout);
  assert.ok(
    layout.length >= 104,
    "28 Chinese characters in every option remain visible",
  );
  assert.ok(
    layout.every(([x, y]) => x >= 287 && x <= 672 && y >= 32 && y <= 135),
    "all focus glyph centers stay inside the card",
  );
  await shot("meaning-long");
  await page.setViewportSize({ width: 480, height: 360 });
  await page.waitForFunction(
    () => Math.abs(window.nativeUI[4] / window.nativeUI[5] - 4 / 3) < 0.01,
  );
  await page.waitForTimeout(300);
  await shot("meaning-small");
  await page.setViewportSize({ width: 960, height: 600 });
  await tap("F10");
  await page.waitForTimeout(200);
  assert.match(await page.evaluate(() => window.context), /探索/);
  await shot("spelling-long");
  layout = await page.evaluate(() => window.nativeLayout);
  assert.ok(
    layout.every(([x, y]) => x >= 287 && x <= 672 && y >= 32 && y <= 135),
  );
  await tap("0");
  for (const c of "COLOR") await tap(c);
  await state(1, -1);
  // Respect the existing 180 ms answer-input quarantine before menu keys.
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.wordAnswers.at(-1)[0]), 1);
  pass(
    "long word and complete Chinese meaning fit compact card; 28-character options and 480x360 resize fit; regional alias color auto-accepts for colour",
  );

  // Test the actual title settings and timer/pause interactions, not direct flag mutation.
  for (const hint of [1, 2]) {
    await tap("Escape");
    await tap("m");
    await state(0, 0);
    await click(784, 430);
    await state(0, 7);
    await click(780, 384);
    await click(760, 266 + hint * 40);
    await page.waitForFunction((n) => Number(window.spelling[0]) === n, hint);
    await tap("Escape");
    await state(0, 0);
    await tap("Enter");
    await state(1, -1);
    await question("u", 1);
    await tap("0");
    await page.waitForFunction(() => window.cue === "colour");
    await tap("Escape");
    const frozenHint = await page.evaluate(() => window.spelling[2]);
    await page.waitForTimeout(2200);
    assert.equal(await page.evaluate(() => window.spelling[2]), frozenHint);
    await tap("Escape");
    await page.waitForFunction(() => window.spelling[1] === "false");
    assert.equal(
      await page.evaluate(() => window.cue),
      hint === 1 ? "c·····" : "······",
    );
    assert.match(await page.evaluate(() => window.context), /颜色/);
    await shot(hint === 1 ? "spelling-hidden" : "spelling-recall");
    for (const c of "colou") await tap(c);
    await page.keyboard.down("r");
    await state(1, -1);
    const serial = await page.evaluate(() => window.wordQuestions.length);
    await page.waitForTimeout(650);
    assert.equal(
      await page.evaluate(() => window.wordQuestions.length),
      serial,
    );
    assert.equal(await page.evaluate(() => window.nativeState[0]), 1);
    await page.keyboard.up("r");
    pass(
      `real title hint ${hint}: visible then hidden on schedule, Chinese remains, pause freezes reveal time, automatic finish isolates held R`,
    );
  }
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
  await tap("F2");
  await page.waitForFunction(
    () =>
      window.learningGolden.length === 11 && window.learningDeck.length === 3,
  );
  assert.deepEqual(
    await page.evaluate(() => window.learningGolden),
    [1, 0, 1000, 0, 800, 2, 1, 1, 1, 1, 1],
  );
  const preserved = await page.evaluate(() => window.learningDeck);
  assert.equal(preserved[0], preserved[1]);
  assert.equal(preserved[2], 0);
  assert.deepEqual(await page.evaluate(() => window.learningCore), [
    "0 30 true",
    "1 30 true",
    "2 30 true",
    "3 30 true",
  ]);
  pass(
    "native learning matches backend golden vector: separate abilities, assisted evidence, exactly-once answers, tie alternation, emergency meaning, four pool filters, and R preserves deck while clearing completion",
  );
  await tap("F6");
  await page.waitForFunction(() => window.studyGolden);
  const study = await page.evaluate(() => window.studyGolden);
  assert.deepEqual(study.metrics, [1, 2, 11, 1, 1, 1, 1, 1, 13]);
  assert.equal(study.count, 3);
  assert.equal(study.assisted, 1);
  assert.ok(study.unlocked[0] && study.unlocked[9] && study.unlocked[23]);
  pass(
    "English achievement counters distinguish unique words, abilities, recovered mistakes, hidden spelling, due review and peak streak; repeated callbacks do not double count",
  );
  async function studyProbe() {
    await tap("F3");
    return page.evaluate(() => window.studyProbe);
  }
  async function openStudy() {
    const v = await page.evaluate(() => window.nativeUI);
    await click(100, 300 - v[5] / 2 + 14);
    const s = await studyProbe();
    assert.equal(s.open, true);
  }
  await openStudy();
  await shot("learning-title");
  for (let pageIndex = 0; pageIndex < 6; pageIndex++) {
    const current = await studyProbe();
    assert.equal(current.page, pageIndex);
    assert.ok(
      current.cards.every((n) => n >= pageIndex * 3 && n < pageIndex * 3 + 3),
      "slot-specific art stays aligned on every page",
    );
    if (pageIndex === 2) await shot("learning-sealed");
    if (pageIndex < 5) await tap("ArrowRight");
  }
  await page.setViewportSize({ width: 480, height: 360 });
  await page.waitForTimeout(300);
  await shot("learning-small");
  await page.setViewportSize({ width: 960, height: 600 });
  await page.waitForTimeout(200);
  await tap("Escape");
  assert.equal((await studyProbe()).phase, 0);
  await tap("Enter");
  await state(1, -1);
  await tap("F9");
  await openStudy();
  assert.equal((await studyProbe()).phase, 4);
  await shot("learning-battle");
  await tap("Escape");
  await state(1, -1);
  pass(
    "native achievement catalog opens from title and battle, paginates and returns to the exact prior state",
  );
  const pendingQuestion = await question("u", 1);
  await openStudy();
  const studyFrozen = await studyProbe();
  assert.equal(studyFrozen.wordPaused, true);
  assert.equal(studyFrozen.musicPaused, false);
  await page.waitForTimeout(400);
  assert.equal((await studyProbe()).questionAge, studyFrozen.questionAge);
  await tap("j");
  assert.equal((await studyProbe()).input, studyFrozen.input);
  await shot("learning-question");
  await tap("Escape");
  assert.equal((await studyProbe()).wordPaused, false);
  await answerMeaning(pendingQuestion, false);
  await tap("Escape");
  await state(4, 3);
  await openStudy();
  await tap("Escape");
  assert.equal((await studyProbe()).phase, 4);
  pass(
    "opening achievements freezes a live word challenge, keeps music playing, blocks stray letters and preserves an already paused game",
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
