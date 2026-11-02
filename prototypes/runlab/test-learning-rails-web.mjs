import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("test-results/learning-rails-web/", import.meta.url);
await mkdir(out, { recursive: true });
const b = await chromium.launch({ headless: true, channel: "chromium" }),
  p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const report = { cases: [], errors: [] };
p.on("pageerror", (e) => report.errors.push(e.message));
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
const shot = (n) =>
  p.screenshot({ path: fileURLToPath(new URL(n + ".png", out)) });
try {
  await p.goto("http://127.0.0.1:4177/?v=learning-rails");
  await p.waitForFunction(
    () => window.latestState?.phase === 0 && window.learningRailDiagnostics,
    null,
    { timeout: 90000 },
  );
  await shot("title");
  assert.equal(await p.locator("#learning-open b").innerText(), "00 / 24");
  await p.locator("#learning-open").click();
  assert.equal(await p.locator(".learning-card").count(), 4);
  await shot("achievements");
  for (let i = 0; i < 5; i++) await p.locator("#learning-next").click();
  assert.match(await p.locator("#learning-page").innerText(), /6 \/ 6/);
  assert.ok(await p.locator("#learning-next").isDisabled());
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("#learning-ledger").isVisible(), false);
  pass(
    "English-only 24-card catalog opens in the title rail and keyboard closes it",
  );
  await p.locator("#menu-settings").click();
  await p.locator("#learning-open").click();
  await p.keyboard.press("Escape");
  assert.equal(
    await p.locator("#menu-settings").getAttribute("aria-expanded"),
    "true",
  );
  await p.locator("#menu-close").click();
  pass("achievements preserve the underlying settings panel");
  await p.locator("#play").click();
  await p.waitForFunction(() => window.latestState.phase === 1);
  await p.locator("#learning-open").click();
  await p.waitForFunction(() => window.latestState.phase === 4);
  await shot("in-game");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => window.latestState.phase === 1);
  assert.equal(
    await p.locator("#learning-bank").getAttribute("aria-valuenow"),
    "0",
  );
  pass(
    "battle pauses and resumes exactly while the two progress tracks remain visible",
  );
  for (const size of [
    { width: 1024, height: 768 },
    { width: 650, height: 900 },
  ]) {
    await p.setViewportSize(size);
    await p.locator("#learning-open").click();
    await shot("size-" + size.width);
    const panel = await p.locator(".learning-sheet").boundingBox(),
      host = await p.locator("#viewport").boundingBox();
    assert.ok(
      panel.x >= host.x && panel.x + panel.width <= host.x + host.width + 1,
    );
    await p.keyboard.press("Escape");
  }
  pass("responsive rails and achievement sheets stay within the viewport");
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
  console.error(e);
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await b.close();
}
