import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  InscriptionBook,
  STORAGE_KEY,
  BANK,
} from "./public/inscription-core.js";

const browser = await chromium.launch({ headless: true });
const url = new URL(process.env.RUNLAB_URL || "http://127.0.0.1:4184/");
const report = { cases: [], errors: [] };
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
const page = await browser.newPage();
page.on("pageerror", (error) => report.errors.push(error.message));
const state = () => page.evaluate(() => latestState);
const wait = (fn) => page.waitForFunction(fn, {}, { timeout: 15000 });
const tap = (key) => page.keyboard.press(key, { delay: 70 });
async function restart() {
  await tap("r");
  await wait(() => latestState.phase === 1 && latestState.elapsed < 1);
  await page.waitForTimeout(150);
}
try {
  url.searchParams.set("words", "off");
  await page.goto(url.href);
  await page.waitForFunction(
    () => window.latestState?.phase === 0,
    {},
    { timeout: 45000 },
  );
  await page.locator("#help").click();
  const guide = await page.locator("#guide").innerText();
  for (const text of ["按住 O", "W + J", "W + K", "双击 S"])
    assert.ok(guide.includes(text), text);
  assert.ok(!guide.includes("按住 E"));
  await page.locator("#close-guide").click();
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);
  const initial = await state();
  for (const key of ["Space", "e", "q"]) await tap(key);
  const after = await state();
  assert.equal(after.y, initial.y);
  assert.equal(after.hookCount, initial.hookCount);
  assert.equal(after.ultimateCool, 0);
  pass("guide uses new controls; old Space, E and Q do not trigger gameplay");

  await page.keyboard.down("w");
  await wait(() => latestState.y > 45);
  await page.keyboard.up("w");
  await page.waitForTimeout(100);
  await tap("w");
  await wait(() => latestState.vy > 300);
  assert.ok((await state()).y > initial.y + 45);
  pass("W jumps and performs a second airborne jump");

  await restart();
  await page.keyboard.down("o");
  await wait(() => latestState.hook >= 0);
  await page.waitForTimeout(150);
  await page.keyboard.up("o");
  await wait(() => latestState.hook < 0 && latestState.vy > 0);
  pass("O grabs an anchor and release launches the hero");

  await restart();
  await tap("p");
  await wait(() => latestState.ultimateCool > 0);
  assert.ok((await state()).ultimateCool <= 5);
  pass("P releases the ultimate and starts its five-second cooldown");

  await restart();
  await page.keyboard.down("s");
  await tap("w");
  await page.keyboard.up("s");
  await page.waitForFunction((y) => latestState.y < y - 20, initial.y);
  pass("S + W drops through an ordinary platform");

  await restart();
  await page.keyboard.down("ArrowUp");
  await tap("j");
  await page.keyboard.up("ArrowUp");
  await wait(
    () =>
      latestState.attackKind === 4 ||
      runEvents.some((event) => event.name === "launchhit"),
  );
  await restart();
  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("k");
  await wait(() => latestState.vy > 600);
  assert.ok(Math.abs((await state()).vx) < 10);
  await page.keyboard.up("k");
  await page.keyboard.up("ArrowUp");
  pass(
    "up-arrow preserves launcher and vertical dash without the W jump conflict",
  );

  await restart();
  await tap("s");
  assert.equal((await state()).y, initial.y, "a single S must not drop");
  await tap("s");
  await page.waitForFunction((y) => latestState.y < y - 20, initial.y);
  pass("double S drops through without the awkward S + W chord");

  await restart();
  await page.keyboard.down("s");
  await page.waitForTimeout(400);
  assert.equal((await state()).y, initial.y);
  await page.keyboard.up("s");
  await tap("s");
  assert.equal((await state()).y, initial.y, "expired first tap must not drop");
  pass("holding S and widely separated taps do not accidentally drop");

  await restart();
  await page.keyboard.down("u");
  await wait(() => latestState.bowCharge > 0);
  await tap("s");
  await tap("s");
  assert.equal((await state()).y, initial.y);
  assert.ok((await state()).bowCharge > 0);
  await page.keyboard.up("u");
  pass(
    "downward aim taps during charging never count as a platform-drop gesture",
  );

  await restart();
  await tap("s");
  await tap("Escape");
  await wait(() => latestState.phase === 4);
  await tap("Escape");
  await wait(() => latestState.phase === 1);
  await tap("s");
  assert.equal((await state()).y, initial.y);
  pass("pause clears the pending double-tap gesture");

  for (const [first, second] of [
    ["w", "j"],
    ["j", "w"],
  ]) {
    await restart();
    await page.keyboard.down(first);
    await page.waitForTimeout(35);
    await page.keyboard.down(second);
    await wait(() => runEvents.some((event) => event.name === "launcher"));
    await page.keyboard.up(second);
    await page.keyboard.up(first);
    assert.equal(
      await page.evaluate(
        () => runEvents.filter((event) => event.name === "launcher").length,
      ),
      1,
    );
    pass(
      `${first.toUpperCase()} then ${second.toUpperCase()} produces one launcher without waiting to jump`,
    );
  }

  await restart();
  await page.keyboard.down("w");
  await page.waitForTimeout(45);
  await page.keyboard.down("k");
  await wait(() => latestState.vy > 600);
  assert.ok(Math.abs((await state()).vx) < 10);
  await page.keyboard.up("k");
  await page.keyboard.up("w");
  pass("W + K dashes upward from the left-hand movement cluster");

  for (const skill of ["u", "l"]) {
    await restart();
    await page.keyboard.down(skill);
    await wait(() => latestState.bowCharge > 0 || latestState.chargeTime > 0);
    await page.keyboard.down("w");
    await wait(() => latestState.aimY > 0.9);
    assert.equal(
      (await state()).y,
      initial.y,
      "aiming must not jump or cancel charge",
    );
    await page.keyboard.up(skill);
    await wait(() => latestState.bowCool > 0 || latestState.bladeCool > 0);
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(
        () => runEvents.filter((event) => event.name === "jump").length,
      ),
      0,
    );
    await page.keyboard.up("w");
    pass(
      `${skill.toUpperCase()} + W aims upward and releases with no deferred jump`,
    );
  }

  // Hold the final typed gameplay key through the release transition. It must
  // remain quarantined until keyup; a subsequent fresh press must work.
  url.searchParams.set("words", "on");
  for (const [word, key] of [
    ["echo", "o"],
    ["saw", "w"],
    ["help", "p"],
  ]) {
    assert.ok(BANK.has(word), word);
    const p = await browser.newPage();
    p.on("pageerror", (error) => report.errors.push(error.message));
    const book = new InscriptionBook(null, 4);
    book.run.pool = [
      word,
      ...[...BANK.keys()].filter((id) => id.length > 6).slice(0, 29),
    ];
    book.settings.hint = "guided";
    await p.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: STORAGE_KEY, value: book.serialize() },
    );
    await p.goto(url.href);
    await p.waitForFunction(
      () => window.latestState?.phase === 0,
      {},
      { timeout: 45000 },
    );
    await p.locator("#play").click();
    await p.waitForFunction(() => latestState.phase === 1);
    await p.keyboard.down("u");
    await p.waitForFunction(() => latestState.bowCharge > 0.6);
    await p.keyboard.up("u");
    await p.waitForFunction(
      () => inscriptionDiagnostics.active && latestState.phase === 5,
    );
    assert.equal(
      await p.evaluate(() => inscriptionDiagnostics.active.q.wordId),
      word,
    );
    assert.equal(
      await p.evaluate(() => inscriptionDiagnostics.active.q.type),
      "spell",
    );
    const before = await p.evaluate(() => ({ ...latestState }));
    await p.keyboard.type(word.slice(0, -1), { delay: 40 });
    await p.keyboard.down(key);
    await p.waitForFunction(
      () => !inscriptionDiagnostics.active && latestState.phase === 1,
    );
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({ ...latestState }));
    assert.equal(after.hookCount, before.hookCount);
    assert.equal(after.y, before.y);
    assert.equal(after.ultimateCool, 0);
    await p.keyboard.up(key);
    await p.keyboard.down(key);
    await p.waitForFunction(
      (key) =>
        key === "o"
          ? latestState.hook >= 0
          : key === "w"
            ? latestState.y > 15
            : latestState.wordPending === 4 && latestState.phase === 5,
      key,
    );
    await p.keyboard.up(key);
    assert.deepEqual(await p.evaluate(() => runtimeErrors), []);
    await p.close();
    pass(
      `held final ${key.toUpperCase()} does not leak from spelling; fresh input works`,
    );
  }
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(error.stack);
  console.error(error);
  process.exitCode = 1;
} finally {
  await mkdir(new URL("./test-results/controls/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL("./test-results/controls/report.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
