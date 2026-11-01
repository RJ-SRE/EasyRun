import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { InscriptionBook, STORAGE_KEY } from "./public/inscription-core.js";
import { LEARNING_MILESTONES } from "./public/learning-milestones.js";
const out = new URL("test-results/achievement-archive-web/", import.meta.url);
await mkdir(out, { recursive: true });
// Seed a real learning profile, isolated from the user's browser: first seal
// earned, subsequent word milestones active, unpractised abilities sealed.
const book = new InscriptionBook(null, 88);
for (const [n, id] of book.run.pool.slice(0, 3).entries()) {
  const action = "visual-" + n;
  book.run.reserved = {
    wordId: id,
    type: "spell",
    serial: n + 1,
    actionId: action,
    options: [],
  };
  book.settle(action, "correct", 2, true);
}
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = { cases: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
await page.addInitScript(
  ({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, saved);
  },
  { key: STORAGE_KEY, saved: book.serialize() },
);
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
const shot = (n) =>
  page.screenshot({ path: fileURLToPath(new URL(n + ".png", out)) });
try {
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4177") +
      "/?v=inscribed-achievements",
  );
  await page.waitForFunction(
    () => window.learningRailDiagnostics && latestState?.phase === 0,
    null,
    { timeout: 90000 },
  );
  await page.locator("#learning-open").click();
  assert.deepEqual(
    await page
      .locator(".learning-card")
      .evaluateAll((es) => es.map((e) => e.dataset.state)),
    ["earned", "active", "active", "active"],
  );
  assert.equal(
    await page
      .locator(".learning-card.unlocked .learning-quantity")
      .innerText(),
    "1 / 1",
  );
  await shot("earned-and-active");
  const ids = await page
    .locator(".learning-card svg [id]")
    .evaluateAll((es) => es.map((e) => e.id));
  assert.equal(
    new Set(ids).size,
    ids.length,
    "each seal keeps independent metal gradients",
  );
  assert.equal(
    await page
      .locator("#learning-ledger")
      .evaluate((e) => window.getComputedStyle(e).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  pass(
    "earned, active and sealed reliefs use independent assets, with transparent surroundings and explicit progress labels",
  );
  const titles = [];
  for (let n = 0; n < 6; n++) {
    titles.push(...(await page.locator(".learning-card h3").allTextContents()));
    if (n === 2) {
      assert.ok(
        await page.locator('.learning-card[data-state="sealed"]').count(),
      );
      await shot("sealed-abilities");
    }
    if (n < 5) await page.keyboard.press("ArrowRight");
  }
  assert.deepEqual(
    titles,
    LEARNING_MILESTONES.map((a) => a.title),
  );
  assert.equal(await page.locator("#learning-next").isDisabled(), true);
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      !document.querySelector("#viewport").classList.contains("archive-open"),
  );
  pass(
    "all 24 original achievements remain in order and pagination, dismissal and state restoration work",
  );
  for (const size of [
    { width: 1280, height: 720 },
    { width: 650, height: 900 },
    { width: 480, height: 360 },
  ]) {
    await page.setViewportSize(size);
    await page.locator("#learning-open").click();
    const sheet = await page.locator(".learning-sheet").boundingBox(),
      host = await page.locator("#viewport").boundingBox();
    assert.ok(
      sheet.x >= host.x &&
        sheet.x + sheet.width <= host.x + host.width + 1 &&
        sheet.y >= host.y &&
        sheet.y + sheet.height <= host.y + host.height + 1,
    );
    const cards = await page.locator("#learning-cards").boundingBox(),
      footer = await page.locator(".learning-sheet footer").boundingBox();
    assert.ok(cards.y + cards.height <= footer.y + 1);
    if (size.width < 700) {
      await page.locator("#learning-cards").evaluate((e) => {
        e.scrollTop = e.scrollHeight;
      });
      assert.ok(
        await page.locator("#learning-cards").evaluate((e) => e.scrollTop > 0),
      );
    }
    await shot("size-" + size.width);
    await page.keyboard.press("Escape");
  }
  pass(
    "desktop, portrait and 480×360 layouts keep the footer visible and make the complete card set reachable",
  );
  assert.equal(
    (await page.evaluate(() => inscriptionDiagnostics.history))[
      book.run.pool[0]
    ].spell.correct,
    1,
  );
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.failure = e.stack;
  console.error(e);
  process.exitCode = 1;
  await shot("failure").catch(() => {});
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
}
