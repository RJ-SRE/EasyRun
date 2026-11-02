import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  BANK,
  InscriptionBook,
  STORAGE_KEY,
} from "./public/inscription-core.js";
const base = process.env.RUNLAB_URL || "http://127.0.0.1:4188";
const out = new URL("./test-results/echo-web/", import.meta.url);
await mkdir(out, { recursive: true });
const report = {
  cases: [],
  errors: [],
  complete: false,
  fixture:
    "Test-only arena/victory hooks. Real keyboard QTE, InscriptionBook, settlement and journal.",
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
let calls = 0;
page.on("pageerror", (e) => report.errors.push(e.message));
await page.addInitScript(
  ({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, saved);
    const fetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await fetch(...args);
      if (String(args[0]).includes("belfry.json")) {
        const json = response.json.bind(response);
        response.json = async () => {
          const data = await json();
          data["main.spx"] = data["main.spx"].replace(
            "onKey KeyT",
            `\nfunc echoFixture() {startRun(); wordMode=1; health=5; embers=1; floorX[0]=80; floorW[0]=800; for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0; enemyBaseY[i]=-7000; clearEnemyMotion(i)}; Hero.resetHero(310,0); Hero.invulnerable=999}\nonKey KeyF7, => {echoFixture()}\nonKey KeyF12, => {phase=2; event("finish")}\nonKey KeyT`,
          );
          return data;
        };
      }
      return response;
    };
  },
  { key: STORAGE_KEY, saved: new InscriptionBook(null, 2).serialize() },
);
await page.route("**/api/echo", async (route) => {
  calls++;
  const s = route.request().postDataJSON();
  const cards = s.words.map((w) => ({
    id: w.id,
    usage:
      "表示逐步改善，可以搭配技能或状态。<img src=x onerror=alert(1)> 作为纯文本显示",
    collocation: "improve your skills",
    example: "Practice can improve your skills.",
    translation: "练习可以提高你的技能。",
    gameExample: "The journey helped me improve.",
    gameTranslation: "这趟旅程让我有所进步。",
    tip: "<img src=x onerror=alert(1)> 作为纯文本显示",
  }));
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      note: "记住一个表达，就是这趟旅程的回声。",
      nextStep: "用自己的经历造句。",
      cards,
    }),
  });
});
const wait = (fn) => page.waitForFunction(fn, null, { timeout: 60000 });
const focusCanvas = () =>
  page
    .locator("iframe")
    .evaluate((f) =>
      f.contentWindow.document.querySelector("#game-canvas").focus(),
    );
const assertStageBounds = async () => {
  const bounds = await page.evaluate(() => {
    const stage = document.querySelector("#viewport").getBoundingClientRect();
    const panel = document
      .querySelector(".echo-dialog")
      .getBoundingClientRect();
    const header = document
      .querySelector(".echo-dialog header")
      .getBoundingClientRect();
    const footer = document
      .querySelector(".echo-dialog footer")
      .getBoundingClientRect();
    return {
      left: panel.left >= Math.max(0, stage.left),
      right: panel.right <= Math.min(innerWidth, stage.right),
      top: panel.top >= Math.max(0, stage.top),
      bottom: panel.bottom <= Math.min(window.innerHeight, stage.bottom),
      fixedControls:
        header.top >= panel.top &&
        footer.bottom <= panel.bottom &&
        footer.width > 0 &&
        footer.height > 0,
    };
  });
  assert.ok(Object.values(bounds).every(Boolean), JSON.stringify(bounds));
};
try {
  await page.goto(base + "/?v=echo-journal");
  await wait(
    () => window.latestState?.phase === 0 && window.inscriptionDiagnostics,
  );
  assert.equal(calls, 0);
  pass("Web title loads with no automatic model request");
  await focusCanvas();
  await page.keyboard.press("F7");
  await wait(() => window.latestState.phase === 1);
  await page.keyboard.down("u");
  await wait(() => window.latestState.bowCharge >= 0.6);
  await page.keyboard.up("u");
  await wait(() => window.inscriptionDiagnostics.active?.kind === 1);
  const active = await page.evaluate(
      () => window.inscriptionDiagnostics.active,
    ),
    w = BANK.get(active.q.wordId);
  if (active.q.type === "spell")
    await page.keyboard.type(w.word, { delay: 40 });
  else
    await page.keyboard.press(String(active.q.options.indexOf(w.meaning) + 1));
  await wait(
    () =>
      !window.inscriptionDiagnostics.active && window.latestState.phase === 1,
  );
  await focusCanvas();
  await page.keyboard.press("F12");
  await wait(
    () => window.easyRunEcho.phase === 2 && window.easyRunEcho.snapshot,
  );
  assert.equal(
    await page.evaluate(() => window.easyRunEcho.snapshot.totals.correct),
    1,
  );
  assert.equal(
    await page.evaluate(() => window.easyRunEcho.snapshot.totals.touched),
    1,
  );
  pass("Real skill/QTE answer feeds the victory summary exactly once");
  await page.screenshot({
    path: fileURLToPath(new URL("victory-actions.png", out)),
  });
  // Three-word reading fixture, after verifying the real single-answer chain.
  await page.evaluate(async () => {
    const { BANK } = await import("/inscription-core.js");
    const { freshEcho, recordEcho, echoSnapshot } =
      await import("/echo-core.js");
    const words = ["go", "new", "good"].map((id) => BANK.get(id));
    const run = freshEcho("reading-navigation-fixture");
    for (const w of words) recordEcho(run, w.id, "spell", "correct");
    window.easyRunEcho.present(echoSnapshot(run, words));
  });
  await page.locator(".echo-launch").click();
  await page.keyboard.press("r");
  assert.equal(await page.evaluate(() => window.latestState.phase), 2);
  await page.locator(".echo-generate").click();
  await wait(() => !!window.easyRunEcho.report);
  assert.equal(calls, 1);
  assert.equal(await page.locator(".echo-content img").count(), 0);
  assert.match(await page.locator(".echo-usage").innerText(), /<img/);
  assert.equal(
    await page
      .locator(
        ".echo-save, .echo-done, .echo-intro, .echo-consent, .echo-disclaimer, .echo-tip",
      )
      .count(),
    0,
  );
  assert.equal(await page.locator(".echo-generate").isVisible(), false);
  assert.equal(await page.locator(".echo-status").isVisible(), false);
  await assertStageBounds();
  pass("Generation uses the proxy; model text cannot become executable markup");
  await page.screenshot({
    path: fileURLToPath(new URL("web-report.png", out)),
  });
  await page.locator(".echo-example-tabs button").nth(1).click();
  assert.match(await page.locator(".echo-example").innerText(), /journey/);
  await page.locator(".echo-body").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.locator(".echo-next").click();
  assert.equal(await page.locator(".echo-page").innerText(), "02 / 03");
  assert.equal(
    await page.locator(".echo-body").evaluate((el) => el.scrollTop),
    0,
  );
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator(".echo-page").innerText(), "03 / 03");
  assert.equal(await page.locator(".echo-next").isDisabled(), true);
  await page.keyboard.press("ArrowLeft");
  await page.locator(".echo-prev").click();
  assert.equal(await page.locator(".echo-page").innerText(), "01 / 03");
  assert.equal(await page.evaluate(() => window.latestState.phase), 2);
  assert.equal(calls, 1);
  pass(
    "Word buttons and arrow keys navigate without new requests or game input; example mode persists",
  );
  await page.setViewportSize({ width: 460, height: 780 });
  await page.waitForTimeout(150);
  await assertStageBounds();
  await page.screenshot({
    path: fileURLToPath(new URL("web-narrow.png", out)),
  });
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 90));
  await page.waitForTimeout(150);
  await assertStageBounds();
  pass(
    "Desktop, narrow and short/scrolled windows keep borders and controls inside the game stage",
  );
  await page.locator(".echo-close").click();
  await page.waitForTimeout(220);
  await page.reload();
  await wait(
    () => window.latestState?.phase === 0 && window.easyRunEcho?.cache,
  );
  await page.locator(".echo-launch").click();
  assert.equal(calls, 1);
  assert.equal(await page.locator(".echo-tabs button").count(), 3);
  pass("Reload reopens the stored report without another model call");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#menu-settings").click();
  await page.locator("#word-reset").click();
  await Promise.all([
    page.waitForEvent("load"),
    page.locator("#local-reset-confirm").click(),
  ]);
  await wait(
    () => window.latestState?.phase === 0 && !window.easyRunEcho?.cache,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("easyrun.echo.v1:web")),
    null,
  );
  pass("Existing confirmed local reset also clears the journal");
  assert.deepEqual(report.errors, []);
  report.complete = true;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
