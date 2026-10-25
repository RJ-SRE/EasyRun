import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  InscriptionBook,
  STORAGE_KEY,
  BANK,
} from "./public/inscription-core.js";

const base = process.env.RUNLAB_URL || "http://127.0.0.1:4177/?words=on";
const out = new URL("./test-results/music/", import.meta.url);
await mkdir(out, { recursive: true });
const manifest = JSON.parse(
  await readFile(
    new URL("./public/audio/music/manifest.json", import.meta.url),
    "utf8",
  ),
);
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  cases: [],
  errors: [],
  fixture:
    "Real MP3 media, Web Audio routing and player inputs. Response-only F8/F9/F10 fixtures select win/death/title to test music transitions; visibility fixture dispatches the actual host handler. Does not claim a full-route playthrough or subjective audio review.",
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const book = new InscriptionBook(null, 4);
book.settings.hint = "guided";
await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
  key: STORAGE_KEY,
  value: book.serialize(),
});
await page.route("**/belfry.json", async (route) => {
  const data = await (await route.fetch()).json();
  data["main.spx"] = data["main.spx"].replace(
    "onKey KeyT",
    `
onKey KeyF8, => {phase=2; event("finish")}
onKey KeyF9, => {health=0; phase=3; deaths++; event("fail")}
onKey KeyF10, => {phase=0}
onKey KeyT`,
  );
  await route.fulfill({ json: data });
});
const wait = (fn, arg, timeout = 15000) =>
  page.waitForFunction(fn, arg, { timeout });
const music = () => page.evaluate(() => soundDiagnostics.music);
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function playing(stage) {
  await wait(
    (s) =>
      soundDiagnostics.music?.stage === s &&
      !soundDiagnostics.music.paused &&
      soundDiagnostics.music.readyState >= 2 &&
      soundDiagnostics.music.time > 0.1,
    stage,
  );
  assert.equal((await music()).loop, true);
  assert.equal((await music()).activePlayers, 1);
  assert.equal(await page.locator("audio").count(), 1);
}
async function remainsPaused() {
  await wait(() => soundDiagnostics.music?.paused);
  const before = (await music()).time;
  await page.waitForTimeout(350);
  assert.equal((await music()).time, before);
  return before;
}
try {
  for (const track of manifest.tracks) {
    const bytes = await readFile(
      new URL(`./public${track.file}`, import.meta.url),
    );
    assert.equal(bytes.length, track.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      track.sha256,
    );
    const url = new URL(track.file, base);
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-type"), "audio/mpeg");
    assert.equal(Number(head.headers.get("content-length")), bytes.length);
    assert.equal(head.headers.get("accept-ranges"), "bytes");
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    for (const [range, start, end] of [
      ["bytes=0-1023", 0, 1023],
      ["bytes=-512", bytes.length - 512, bytes.length - 1],
      [`bytes=${bytes.length - 256}-`, bytes.length - 256, bytes.length - 1],
    ]) {
      const res = await fetch(url, { headers: { Range: range } });
      assert.equal(res.status, 206);
      assert.equal(
        res.headers.get("content-range"),
        `bytes ${start}-${end}/${bytes.length}`,
      );
      assert.deepEqual(
        new Uint8Array(await res.arrayBuffer()),
        new Uint8Array(bytes.subarray(start, end + 1)),
      );
    }
    for (const range of [
      `bytes=${bytes.length}-`,
      "bytes=99-2",
      "bytes=-0",
      "bytes=-",
      "bytes=0-1,3-4",
    ]) {
      const res = await fetch(url, { headers: { Range: range } });
      assert.equal(res.status, 416);
      assert.equal(res.headers.get("content-range"), `bytes */${bytes.length}`);
      await res.arrayBuffer();
    }
  }
  pass(
    "all three MP3 hashes match the manifest; HEAD, byte/suffix ranges and invalid-range responses are correct",
  );
  await page.goto(base);
  await wait(
    () => window.latestState?.phase === 0 || runtimeErrors.length,
    {},
    45000,
  );
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  assert.equal(await music(), null);
  await page.locator("#music-start").click();
  await playing("menu");
  assert.equal(await page.evaluate(() => latestState.phase), 0);
  assert.ok(
    Math.abs((await music()).duration - manifest.tracks[0].durationSeconds) <
      0.1,
  );
  pass(
    "a title-screen gesture starts Melancholy Of The Boot without starting a run",
  );
  await page.locator("#scene-music").evaluate((audio) => {
    audio.currentTime = audio.duration - 0.2;
  });
  await wait(
    () => soundDiagnostics.music.time < 2 && !soundDiagnostics.music.paused,
  );
  pass(
    "the real title recording loops past its end without another player or user gesture",
  );
  await page.locator("#play").click();
  await wait(() => latestState.phase === 1);
  await playing("gameplay");
  assert.ok(
    Math.abs((await music()).duration - manifest.tracks[1].durationSeconds) <
      0.1,
  );
  pass(
    "starting the game switches to Cleaning out the Rooms and retains only one media element",
  );
  await page.keyboard.press("Escape");
  await wait(() => latestState.phase === 4);
  const pausedAt = await remainsPaused();
  await page.keyboard.press("Escape");
  await playing("gameplay");
  assert.ok((await music()).time >= pausedAt);
  pass(
    "pause freezes the music position and resume continues the same recording",
  );
  await page.locator("#audio-settings").click();
  await wait(() => latestState.phase === 4);
  await page.locator("#setting-music").fill("0.15");
  await page.locator("#setting-sfx").fill("0.65");
  assert.deepEqual(await page.evaluate(() => soundDiagnostics.settings), {
    sfx: 0.65,
    music: 0.15,
  });
  assert.equal(
    await page.locator("#music-track").textContent(),
    "Sea Power · Cleaning out the Rooms (Wandering Horn) · 单曲循环",
  );
  await page.locator("#close-settings").click();
  await playing("gameplay");
  await page.locator("#sound").click();
  const mutedAt = await remainsPaused();
  assert.equal(await page.evaluate(() => soundDiagnostics.enabled), false);
  await page.locator("#sound").click();
  await playing("gameplay");
  assert.ok((await music()).time >= mutedAt);
  pass(
    "music/effects preferences are independent and global mute pauses instead of restarting the song",
  );
  await page.keyboard.press("u", { delay: 50 });
  await wait(() => latestState.phase === 5 && inscriptionDiagnostics.active);
  const focusAt = (await music()).time;
  await page.waitForTimeout(450);
  assert.equal((await music()).stage, "gameplay");
  assert.equal((await music()).duck, 0.28);
  assert.ok((await music()).time > focusAt);
  assert.ok((await music()).gain < 0.4);
  await page.keyboard.press("Escape");
  await remainsPaused();
  await page.locator("#word-resume").click();
  await playing("gameplay");
  const q = await page.evaluate(() => inscriptionDiagnostics.active.q);
  const word = BANK.get(q.wordId);
  if (q.type === "spell") await page.keyboard.type(word.word, { delay: 25 });
  else await page.keyboard.press(String(q.options.indexOf(word.meaning) + 1));
  await wait(() => latestState.phase === 1 && !inscriptionDiagnostics.active);
  await wait(() => soundDiagnostics.music.gain > 0.95);
  assert.equal((await music()).duck, 1);
  assert.ok((await music()).time > focusAt);
  pass(
    "a real word challenge ducks music without restarting it; challenge pause/resume and successful release restore playback and gain",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(() => latestState.phase === 4);
  await remainsPaused();
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal((await music()).paused, true);
  await page.keyboard.press("Escape");
  await playing("gameplay");
  pass(
    "visibility loss pauses game and music; returning waits for the player to resume",
  );
  await page.locator("#scene-music").evaluate((audio) => {
    audio.currentTime = audio.duration - 0.2;
  });
  await wait(
    () => soundDiagnostics.music.time < 2 && !soundDiagnostics.music.paused,
  );
  pass("the real gameplay recording loops past its end");
  await page.keyboard.press("F8");
  await wait(() => latestState.phase === 2);
  await playing("ending");
  assert.ok(
    Math.abs((await music()).duration - manifest.tracks[2].durationSeconds) <
      0.1,
  );
  await page.locator("#scene-music").evaluate((audio) => {
    audio.currentTime = audio.duration - 0.2;
  });
  await wait(
    () => soundDiagnostics.music.time < 2 && !soundDiagnostics.music.paused,
  );
  pass(
    "victory selects Strange Sports and the real ending recording loops past its end",
  );
  await page.keyboard.press("r");
  await wait(() => latestState.phase === 1);
  await playing("gameplay");
  assert.ok((await music()).time < 2);
  await page.keyboard.press("F9");
  await wait(() => latestState.phase === 3);
  await playing("ending");
  pass(
    "a new run starts the gameplay song from its beginning; death uses the same ending track",
  );
  await page.keyboard.press("F10");
  await page.keyboard.press("F8");
  await page.keyboard.press("F10");
  await playing("menu");
  await page.waitForTimeout(400);
  assert.equal((await music()).stage, "menu");
  assert.equal((await music()).target, "menu");
  pass(
    "rapid scene changes settle on the latest selection without a delayed stale song",
  );
  await page.reload();
  await wait(() => window.latestState?.phase === 0, {}, 45000);
  assert.deepEqual(await page.evaluate(() => soundDiagnostics.settings), {
    sfx: 0.65,
    music: 0.15,
  });
  await page.locator("#practice").click();
  await wait(() => latestState.practice === 1);
  await playing("gameplay");
  pass(
    "reload preserves volume preferences and the practice arena uses gameplay music",
  );
  assert.deepEqual(await page.evaluate(() => soundDiagnostics.errors), []);
  assert.deepEqual(await page.evaluate(() => runtimeErrors), []);
  await page.close();

  const fallback = await browser.newPage();
  fallback.on("pageerror", (e) => report.errors.push(e.message));
  await fallback.route("**/audio/music/menu.mp3", (route) =>
    route.fulfill({ status: 404, body: "Missing audio fixture" }),
  );
  await fallback.goto(base);
  await fallback.waitForFunction(
    () => window.latestState?.phase === 0,
    {},
    { timeout: 45000 },
  );
  await fallback.locator("#music-start").click();
  await fallback.waitForFunction(
    () =>
      soundDiagnostics.music?.failed &&
      document.querySelector("#music-start").textContent === "重试音乐",
  );
  assert.equal(
    await fallback.locator("#music-start").textContent(),
    "重试音乐",
  );
  await fallback.unroute("**/audio/music/menu.mp3");
  await fallback.locator("#music-start").click();
  await fallback.waitForFunction(
    () =>
      !soundDiagnostics.music.failed &&
      soundDiagnostics.music.time > 0.1 &&
      !soundDiagnostics.music.paused,
  );
  await fallback.locator("#play").click();
  await fallback.waitForFunction(
    () =>
      latestState.phase === 1 &&
      soundDiagnostics.music?.stage === "gameplay" &&
      !soundDiagnostics.music.paused,
  );
  assert.deepEqual(await fallback.evaluate(() => runtimeErrors), []);
  report.finalMusic = await fallback.evaluate(() => soundDiagnostics.music);
  await fallback.close();
  pass(
    "a missing song exposes retry, recovers after the asset returns and never prevents gameplay",
  );
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(error.stack);
  console.error(error);
  process.exitCode = 1;
  if (!page.isClosed())
    await page.screenshot({ path: fileURLToPath(new URL("error.png", out)) });
} finally {
  await writeFile(
    new URL("report.json", out),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
