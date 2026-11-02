import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
const base = process.env.RUNLAB_URL || "http://127.0.0.1:4188";
const deployed = resolve(
  process.env.XBUILDER_RUNTIME_DIR || ".cache/xbuilder-online-20261026",
);
const out = new URL("./test-results/echo-native/", import.meta.url);
await mkdir(out, { recursive: true });
const archive = new URL("./exports/belfry.xbp", import.meta.url);
const report = {
  cases: [],
  errors: [],
  complete: false,
  fixture:
    "Packaged native game and cached XBuilder compiler; test-only keyboard events call production answer and victory handlers.",
};
const server = createServer((req, res) => {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
  });
  createReadStream(
    ["/ispx.wasm", "/engineres.zip"].includes(req.url)
      ? join(deployed, basename(req.url))
      : archive,
  ).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const archiveURL = `http://127.0.0.1:${server.address().port}/package.xbp`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
const responseFor = (s) => ({
  note: "让词语留在旅程之外。",
  nextStep: "选择一句，换成自己的经历再说一遍。",
  cards: s.words.map((w) => ({
    id: w.id,
    usage: "用在描述经历的语境中，先留意搭配与词性。",
    collocation: `${w.word} · 常用表达`,
    example: `Remember the word "${w.word}".`,
    translation: `记住“${w.word}”这个词。`,
    gameExample: "The gate opens after the journey.",
    gameTranslation: "旅程之后，大门开启。",
    tip: "注意词尾的字母顺序。",
  })),
});
let calls = 0,
  replyMode = "good";
page.on("pageerror", (e) => report.errors.push(e.message));
await page.addInitScript(() => {
  window.echoEngineErrors = [];
});
await page.route("**/chat/completions", async (route) => {
  calls++;
  if (replyMode === "live") {
    await route.continue();
    return;
  }
  if (replyMode === "auth") {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: "{}",
    });
    return;
  }
  if (replyMode === "delay") await new Promise((r) => setTimeout(r, 1000));
  const req = route.request().postDataJSON();
  const s = JSON.parse(req.messages[1].content);
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      choices: [
        {
          message: {
            content:
              replyMode === "invalid"
                ? "incomplete"
                : JSON.stringify(responseFor(s)),
          },
        },
      ],
    }),
  });
});
try {
  await page.goto(base + "/runtime/runner.html");
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({ archiveURL }) => {
      window.onGameError((e) => window.echoEngineErrors.push(String(e)));
      window.onEngineCrash((e) => window.echoEngineErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          ["engine.zip", "engineres.zip", "engine.wasm", "ispx.wasm"].map(
            (n) => [
              n,
              ["ispx.wasm", "engineres.zip"].includes(n)
                ? archiveURL.replace("package.xbp", n)
                : "/runtime/" + n,
            ],
          ),
        ),
      );
      const files = window.fflate.unzipSync(
        new Uint8Array(await (await fetch(archiveURL)).arrayBuffer()),
      );
      const enc = new TextEncoder(),
        dec = new TextDecoder();
      let main = dec.decode(files["main.spx"]);
      main += `\nonKey KeyF10, => {WorldLogic.startRun(); Hero.invulnerable=999; for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0}}\nonKey KeyF11, => {nativeWordIndex=nativeDeck[0]; nativeQuestionMode=0; nativeInput="xx"; wordSerial++; NativeLogic.nativeLearningAnswer(2); nativeQuestionMode=1; wordSerial++; NativeLogic.nativeLearningAnswer(1)}\nonKey KeyF12, => {phase=2; WorldLogic.event("finish")}\nonKey KeyF9, => {NativeLogic.nativeEchoReset()}\nonKey KeyF8, => {NativeLogic.nativeSetSettings(true); NativeLogic.nativeLocalResetAsk(); NativeLogic.nativeLocalResetConfirm()}\n`;
      files["main.spx"] = enc.encode(main);
      await window.initGame(
        Object.fromEntries(
          Object.entries(files).map(([n, v]) => [
            n,
            {
              content: v.buffer.slice(
                v.byteOffset,
                v.byteOffset + v.byteLength,
              ),
              lastModified: Date.now(),
            },
          ]),
        ),
      );
      window.xbuilder_set_username("EchoTest");
      await window.startGame();
    },
    { archiveURL },
  );
  await page.waitForFunction(
    () => window.easyRunEcho?.root?.isConnected,
    null,
    { timeout: 120000 },
  );
  if (process.env.ECHO_LIVE_TEST !== "1") {
    await page.evaluate(() => {
      window.easyRunEcho.config = {
        mode: "embedded-test",
        baseUrl: "https://ai-fixture.invalid/v1",
        model: "fixture",
        apiKey: "fixture",
      };
    });
  }
  assert.equal(await page.evaluate(() => window.echoEngineErrors.length), 0);
  pass(
    "Native bundle compiles; journal bridge mounts in actual XBuilder runtime",
  );
  assert.equal(calls, 0);
  assert.equal(await page.locator(".echo-launch").isVisible(), false);
  pass("Title and combat never send automatic AI requests");
  await page.waitForTimeout(1500);
  await page.keyboard.press("F10");
  await page.waitForFunction(
    () => window.easyRunEcho.run?.id && window.easyRunEcho.phase === 1,
  );
  await page.keyboard.press("F11");
  await page.keyboard.press("F12");
  await page.waitForFunction(
    () =>
      window.easyRunEcho.phase === 2 &&
      window.easyRunEcho.snapshot?.words.length === 1,
  );
  const snapshot = await page.evaluate(() => window.easyRunEcho.snapshot);
  assert.equal(snapshot.totals.wrong, 1);
  assert.equal(snapshot.totals.correct, 1);
  assert.equal(snapshot.totals.deck, 30);
  pass(
    "Production native answer/victory hooks produce accurate per-run evidence",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("victory-actions.png", out)),
  });
  await page.locator(".echo-launch").click();
  await page.keyboard.press("r");
  await page.locator(".echo-dialog").evaluate((el) => {
    el.tabIndex = -1;
    el.focus();
  });
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => window.easyRunEcho.phase), 2);
  pass("Journal input cannot restart or dismiss the underlying game");
  await page.locator(".echo-generate").click();
  await page.waitForFunction(
    () => window.easyRunEcho.report?.cards.length === 1,
  );
  assert.equal(calls, 1);
  assert.equal(await page.locator(".echo-pager").isVisible(), false);
  assert.equal(
    await page
      .locator(
        ".echo-save, .echo-done, .echo-consent, .echo-intro, .echo-tip, .echo-disclaimer",
      )
      .count(),
    0,
  );
  const insideStage = await page.evaluate(() => {
    const stage = document
      .querySelector("#game-canvas")
      .getBoundingClientRect();
    const panel = document
      .querySelector(".echo-dialog")
      .getBoundingClientRect();
    return (
      panel.left >= stage.left &&
      panel.right <= stage.right &&
      panel.top >= stage.top &&
      panel.bottom <= stage.bottom
    );
  });
  assert.ok(insideStage);
  const goodCache = await page.evaluate(() => window.easyRunEcho.cache);
  pass(
    "Clean journal fits the native stage, persists locally and hides paging for a single word",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("native-report.png", out)),
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  await page.keyboard.press("m");
  await page.waitForFunction(() => window.easyRunEcho.phase === 0);
  await page.locator(".echo-launch").click();
  assert.equal(calls, 1);
  assert.equal(await page.locator(".echo-example").count(), 1);
  pass("Title reopens the latest cached report without a second request");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  const ownProfile = await page.evaluate(() => window.easyRunEcho.storageKey);
  await page.evaluate(() => window.xbuilder_set_username("EchoOther"));
  await page.waitForFunction(
    (key) => window.easyRunEcho.storageKey !== key,
    ownProfile,
  );
  assert.equal(await page.evaluate(() => window.easyRunEcho.cache), null);
  await page.evaluate(() => window.xbuilder_set_username("EchoTest"));
  await page.waitForFunction(
    (key) => window.easyRunEcho.storageKey === key && window.easyRunEcho.cache,
    ownProfile,
  );
  pass("Native username profiles keep their journals isolated");
  await page.locator(".echo-launch").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  await page.keyboard.press("F10");
  await page.waitForFunction(() => window.easyRunEcho.phase === 1);
  await page.keyboard.press("F11");
  await page.keyboard.press("F12");
  await page.waitForFunction(() => window.easyRunEcho.phase === 2);
  await page.locator(".echo-launch").click();
  replyMode = "auth";
  await page.locator(".echo-generate").click();
  await page.waitForFunction(() => window.easyRunEcho.error?.includes("授权"));
  assert.equal(
    await page.locator(".echo-metrics strong").first().innerText(),
    "1",
  );
  pass("401 preserves exact local stats and allows exit/retry");
  replyMode = "invalid";
  await page.locator(".echo-generate").click();
  await page.waitForFunction(() =>
    window.easyRunEcho.error?.includes("不完整"),
  );
  pass("Incomplete model content is rejected instead of displayed as a report");
  replyMode = "delay";
  await page.locator(".echo-generate").click();
  await page.evaluate(() => window.easyRunEcho.clear());
  await page.waitForTimeout(1300);
  assert.equal(await page.evaluate(() => window.easyRunEcho.report), null);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem(window.easyRunEcho.storageKey),
    ),
    null,
  );
  pass(
    "Reset aborts generation; late response cannot resurrect cleared records",
  );
  if (process.env.ECHO_LIVE_TEST === "1") {
    replyMode = "live";
    await page.locator("#game-canvas").focus();
    await page.keyboard.press("F10");
    await page.waitForFunction(() => window.easyRunEcho.phase === 1);
    await page.keyboard.press("F11");
    await page.keyboard.press("F12");
    await page.waitForFunction(() => window.easyRunEcho.phase === 2);
    await page.locator(".echo-launch").click();
    await page.locator(".echo-generate").click();
    await page.waitForFunction(
      () => window.easyRunEcho.report || window.easyRunEcho.error,
      null,
      { timeout: 70000 },
    );
    assert.equal(await page.evaluate(() => window.easyRunEcho.error), "");
    assert.equal(
      await page.evaluate(() => window.easyRunEcho.report.cards.length),
      1,
    );
    await page.screenshot({
      path: fileURLToPath(new URL("native-live.png", out)),
    });
    pass(
      "Live Qiniu browser request passes CORS and returns a valid report from packaged configuration",
    );
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  await page.locator("#game-canvas").focus();
  await page.keyboard.press("m");
  await page.waitForFunction(() => window.easyRunEcho.phase === 0);
  await page.evaluate(() =>
    localStorage.setItem("easyrun.echo.v1:unrelated", "keep"),
  );
  await page.evaluate((cache) => {
    window.easyRunEcho.cache = cache;
    window.easyRunEcho.save();
  }, goodCache);
  await page.keyboard.press("F8");
  await page.waitForFunction(
    () =>
      !window.easyRunEcho.cache &&
      !localStorage.getItem(window.easyRunEcho.storageKey),
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("easyrun.echo.v1:unrelated"),
    ),
    "keep",
  );
  pass(
    "Production native profile-reset transaction also clears this journal and preserves other profiles",
  );
  assert.deepEqual(await page.evaluate(() => window.echoEngineErrors), []);
  assert.deepEqual(report.errors, []);
  report.complete = true;
} finally {
  report.state = await page
    .evaluate(() => ({
      phase: window.easyRunEcho?.phase,
      run: window.easyRunEcho?.run,
      snapshot: window.easyRunEcho?.snapshot,
      engineErrors: window.echoEngineErrors,
    }))
    .catch(() => null);
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((r) => server.close(r));
}
