import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { InscriptionBook, STORAGE_KEY } from "./public/inscription-core.js";
import { ACHIEVEMENT_KEY } from "./public/belfry-achievements-core.js";

const out = new URL("./test-results/achievements/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const p = await context.newPage();
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  cases: [],
  errors: [],
  note: "Real opening-platform gameplay and input; only vocabulary pool seeded. Failure recovery uses request/storage faults. Rare full-route achievements verified separately in pure model tests.",
};
p.on("pageerror", (e) => report.errors.push(e.message));
const url = process.env.RUNLAB_URL || "http://127.0.0.1:4184/";
const book = new InscriptionBook(null, 4);
book.settings.hint = "guided";
await p.addInitScript(
  ({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  },
  { key: STORAGE_KEY, value: book.serialize() },
);
const wait = (fn, timeout = 12000) => p.waitForFunction(fn, {}, { timeout });
const read = () =>
  p.evaluate(() => ({
    state: latestState,
    achievements: window.achievementDiagnostics,
    word: inscriptionDiagnostics,
  }));
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function ready() {
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    45000,
  );
  assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
  assert.equal(await p.locator("#achievements-open").count(), 1);
}
async function open() {
  await p.locator("#achievements-open").click();
  await wait(() => window.achievementDiagnostics.open);
}
async function close() {
  await p.keyboard.press("Escape");
  await wait(() => !window.achievementDiagnostics.open);
}
try {
  await p.goto(url);
  await ready();
  await open();
  assert.equal(await p.locator("[data-achievement]").count(), 16);
  await p.locator('[data-group="craft"]').click();
  assert.equal(await p.locator("[data-achievement]").count(), 6);
  assert.equal(await p.locator("#achievement-equip").isDisabled(), true);
  await close();
  assert.equal((await read()).state.phase, 0);
  pass(
    "menu ledger shows all 16 rules, group filtering and locked titles without starting a game",
  );
  await p.locator("#play").click();
  await wait(() => latestState.phase === 1);
  await p.keyboard.down("u");
  await wait(() => latestState.bowCharge >= 0.6);
  await p.keyboard.up("u");
  await wait(() => inscriptionDiagnostics.active && latestState.phase === 5);
  assert.equal(await p.locator("#achievements-open").isDisabled(), true);
  assert.equal(await p.locator("#achievement-notice").isVisible(), false);
  assert.equal((await read()).achievements.count, 0);
  await p.keyboard.type("create", { delay: 80 });
  await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
  await wait(() => window.achievementDiagnostics.data.unlocked["first-word"]);
  assert.deepEqual((await read()).achievements.data.words, ["create"]);
  await p.locator("#achievement-notice").waitFor({ state: "visible" });
  await p.screenshot({ path: fileURLToPath(new URL("unlock.png", out)) });
  pass(
    "correct real inscription unlocks once after resolution; no achievement obstruction during typing",
  );

  await p.keyboard.down("l");
  await wait(() => latestState.chargeTime >= 0.6);
  await p.keyboard.up("l");
  await wait(() => latestState.bladeCool > 0);
  await wait(() => latestState.bowCool === 0 && latestState.attackKind === 0);
  await p.keyboard.down("u");
  await wait(() => latestState.bowCharge >= 0.6);
  await p.keyboard.up("u");
  await wait(() => window.achievementDiagnostics.data.unlocked.resonance);
  assert.equal((await read()).achievements.data.words.length, 1);
  pass(
    "two real resonance continuations award the combo without adding word credit",
  );

  await p.keyboard.down("e");
  await wait(() => runEvents.some((e) => e.name === "hookattach"));
  await p.keyboard.up("e");
  await wait(() => window.achievementDiagnostics.data.unlocked["first-sling"]);
  await open();
  await wait(() => latestState.phase === 4);
  await p.waitForTimeout(100);
  const paused = (await read()).state;
  await p.keyboard.press("r");
  await p.keyboard.press("u");
  await p.keyboard.press("Tab");
  assert.equal(
    await p.evaluate(
      () => !!document.activeElement.closest("#achievement-ledger"),
    ),
    true,
  );
  await p.waitForTimeout(220);
  const still = (await read()).state;
  for (const key of [
    "attempts",
    "elapsed",
    "health",
    "x",
    "y",
    "wordFlowTime",
    "bowCool",
  ])
    assert.equal(still[key], paused[key], key);
  assert.equal(await p.locator("#achievement-notice").isVisible(), false);
  await p.locator('[data-group="all"]').click();
  await p.locator('[data-achievement="first-sling"]').click();
  await p.locator("#achievement-equip").click();
  assert.equal(await p.locator(".vitals .micro").textContent(), "「借风起身」");
  assert.equal((await read()).achievements.count, 3);
  const bounds = await p.locator("#achievement-ledger").boundingBox();
  assert.ok(
    bounds.width <= 682 &&
      bounds.height <= 622 &&
      bounds.x >= 0 &&
      bounds.y >= 0,
  );
  await p.screenshot({ path: fileURLToPath(new URL("ledger.png", out)) });
  pass(
    "real grapple unlock, paused ledger, input containment and cosmetic title equip leave combat unchanged",
  );

  const download = p.waitForEvent("download");
  await p.locator("#achievements-export").click();
  const downloaded = await download;
  const data = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  assert.equal(data.equipped, "first-sling");
  assert.equal(Object.keys(data.unlocked).length, 3);
  pass("JSON export contains the actual local unlocks and equipped title");
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.screenshot({ path: fileURLToPath(new URL("ledger-720.png", out)) });
  await p.setViewportSize({ width: 390, height: 844 });
  const narrow = await p.locator("#achievement-ledger").evaluate((el) => ({
    width: el.offsetWidth,
    scroll: el.scrollWidth,
    client: el.clientWidth,
    x: el.getBoundingClientRect().x,
  }));
  assert.ok(
    narrow.width <= 390 && narrow.scroll <= narrow.client + 1 && narrow.x >= 0,
    JSON.stringify(narrow),
  );
  await p.screenshot({
    path: fileURLToPath(new URL("ledger-narrow.png", out)),
  });
  await p.setViewportSize({ width: 1280, height: 800 });
  await close();
  await wait(() => latestState.phase === 1);
  await p.keyboard.press("r");
  await wait(() => latestState.y === 0 && latestState.elapsed < 1);
  await p.keyboard.down("u");
  await wait(() => latestState.bowCharge >= 0.6);
  await p.keyboard.up("u");
  await wait(() => latestState.phase === 5 && inscriptionDiagnostics.active);
  assert.ok((await read()).achievements.queued > 0);
  assert.equal(await p.locator("#achievement-notice").isVisible(), false);
  await p.waitForTimeout(200);
  assert.equal(await p.locator("#achievement-notice").isVisible(), false);
  await p.keyboard.type("create", { delay: 50 });
  await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
  assert.equal((await read()).achievements.count, 3);
  await p.locator("#achievement-notice").waitFor({ state: "visible" });
  pass(
    "queued unlocks defer through the next word challenge and resume without duplicate rewards",
  );
  await p.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  await open();
  await close();
  await p.waitForTimeout(120);
  assert.equal((await read()).state.phase, 4);
  pass(
    "ledger fits desktop/short/narrow views; closing an already paused game preserves pause",
  );
  await p.reload();
  await ready();
  assert.equal((await read()).achievements.count, 3);
  assert.equal((await read()).achievements.data.equipped, "first-sling");
  assert.equal((await read()).achievements.queued, 0);
  assert.equal(await p.locator(".vitals .micro").textContent(), "「借风起身」");
  pass(
    "reload retains earned titles and progress without replaying unlock notifications",
  );

  await p.locator("#practice").click();
  await wait(() => latestState.practice === 1);
  const practiceProgress = (await read()).achievements.data;
  await p.keyboard.down("e");
  await p.waitForTimeout(240);
  await p.keyboard.up("e");
  await p.waitForTimeout(200);
  assert.deepEqual((await read()).achievements.data, practiceProgress);
  pass("practice arena actions do not change persistent achievements");

  for (const fault of ["corrupt", "storage", "module", "word-module"]) {
    const c = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const f = await c.newPage();
    if (fault === "corrupt")
      await f.addInitScript(
        (key) => localStorage.setItem(key, "{"),
        ACHIEVEMENT_KEY,
      );
    if (fault === "storage")
      await f.addInitScript((key) => {
        const get = Storage.prototype.getItem,
          set = Storage.prototype.setItem;
        Storage.prototype.getItem = function (k) {
          if (k === key) throw new Error("blocked");
          return get.call(this, k);
        };
        Storage.prototype.setItem = function (k, v) {
          if (k === key) throw new Error("blocked");
          return set.call(this, k, v);
        };
      }, ACHIEVEMENT_KEY);
    if (fault === "module")
      await f.route("**/belfry-achievements.js", (r) => r.abort());
    if (fault === "word-module")
      await f.route("**/inscription-ui.js", (r) => r.abort());
    await f.goto(url);
    await f.waitForFunction(
      () => window.latestState?.phase === 0 || runtimeErrors.length,
      {},
      { timeout: 45000 },
    );
    assert.deepEqual(await f.evaluate(() => runtimeErrors), []);
    if (fault === "module")
      assert.equal(
        await f.locator("#achievement-load-error").isVisible(),
        true,
      );
    else {
      await f.locator("#achievements-open").click();
      if (fault === "corrupt")
        assert.match(
          await f.locator("#achievement-storage").textContent(),
          /无法读取/,
        );
      if (fault === "storage")
        assert.match(
          await f.locator("#achievement-storage").textContent(),
          /存储不可用/,
        );
      await f.locator("#achievements-close").click();
    }
    await f.locator("#play").click();
    await f.waitForFunction(() => latestState.phase === 1);
    if (fault === "word-module") {
      await f.keyboard.down("d");
      await f.waitForTimeout(100);
      await f.locator("#achievements-open").click();
      await f.waitForFunction(() => latestState.phase === 4);
      await f.keyboard.up("d");
      await f.locator("#achievements-close").click();
      await f.waitForFunction(() => latestState.phase === 1);
      await f.waitForTimeout(400);
      const x = await f.evaluate(() => latestState.x);
      await f.waitForTimeout(200);
      assert.ok(
        Math.abs((await f.evaluate(() => latestState.x)) - x) < 3,
        "movement must not stick when opening ledger in fallback mode",
      );
    }
    await c.close();
    pass(
      `${fault} fault preserves playable adventure${fault === "word-module" ? " and releases held movement across ledger" : ""}`,
    );
  }
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}
