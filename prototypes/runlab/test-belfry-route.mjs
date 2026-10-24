import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = new URL("./test-results/belfry/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  recordVideo: process.env.RECORD
    ? { dir: fileURLToPath(out), size: { width: 1440, height: 1000 } }
    : undefined,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (
    m.text().includes("@event") &&
    !/slash|land|jump|hook|sling/.test(m.text())
  )
    console.log(m.text());
});
const held = new Set();
async function hold(keys) {
  for (const k of [...held])
    if (!keys.includes(k)) {
      await page.keyboard.up(k);
      held.delete(k);
    }
  for (const k of keys)
    if (!held.has(k)) {
      await page.keyboard.down(k);
      held.add(k);
    }
}
const states = [];
let prevSegment = -1,
  tick = 0,
  retries = 0,
  voidVerified = false;
try {
  await page.goto(process.env.RUNLAB_URL || "http://127.0.0.1:4177/");
  await page.waitForFunction(
    () => window.latestState || window.runtimeErrors?.length,
    {},
    { timeout: 45000 },
  );
  if (await page.evaluate(() => runtimeErrors.length))
    throw new Error(await page.evaluate(() => runtimeErrors.join("\n")));
  if (process.env.MODE === "1") {
    await page.locator('[data-mode="1"]').click();
    await page.waitForTimeout(150);
  }
  await page.locator("#play").click();
  await page.waitForFunction(() => latestState?.phase === 1);
  await page.evaluate(() => {
    window.frameIntervals = [];
    let last = 0;
    function measure(t) {
      if (last && latestState?.phase === 1) frameIntervals.push(t - last);
      last = t;
      if (frameIntervals.length < 10000) requestAnimationFrame(measure);
    }
    requestAnimationFrame(measure);
  });
  const start = Date.now();
  while (Date.now() - start < 150000) {
    const s = await page.evaluate(() => latestState);
    states.push(s);
    if (s.segment !== prevSegment) {
      console.log("SEGMENT", s);
      await page.screenshot({
        path: fileURLToPath(
          new URL(`segment-${s.segment}-${process.env.MODE || 0}.png`, out),
        ),
      });
      prevSegment = s.segment;
    }
    if (tick++ % 25 === 0)
      console.log(
        "STATE",
        s.segment,
        Math.round(s.x),
        Math.round(s.y),
        s.health,
        s.bossHP,
        s.hook,
        s.target,
        s.energy,
      );
    if (s.phase === 2) {
      console.log("WIN", s);
      break;
    }
    if (s.phase === 3) {
      console.log("DIED", s);
      if (retries++ > 2) break;
      await hold([]);
      await page.keyboard.press("Enter", { delay: 80 });
      await page.waitForTimeout(200);
      continue;
    }
    if (
      process.env.RETURN_FAILURE === "1" &&
      s.segment === 2 &&
      !voidVerified
    ) {
      await hold(["s"]);
      await page.keyboard.press("j", { delay: 80 });
      await hold([]);
      await page.waitForFunction(
        () => latestState.y <= -3580 || latestState.phase !== 1,
        {},
        { timeout: 10000 },
      );
      assert.equal((await page.evaluate(() => latestState)).phase, 1);
      await page.keyboard.press("Escape", { delay: 80 });
      await page.waitForFunction(() => latestState.phase === 4);
      const frozen = await page.evaluate(() => latestState);
      await page.waitForTimeout(600);
      const paused = await page.evaluate(() => latestState);
      for (const k of ["returnTime", "riseY", "elapsed", "y"])
        assert.equal(paused[k], frozen[k]);
      await page.keyboard.press("Escape", { delay: 80 });
      await page.waitForFunction(
        () => latestState.phase === 3,
        {},
        { timeout: 30000 },
      );
      const failed = await page.evaluate(() => latestState);
      assert.equal(failed.failReason, 2);
      assert.equal(failed.checkpoint, 4);
      await page.screenshot({
        path: fileURLToPath(new URL("void-failure.png", out)),
      });
      await page.keyboard.press("Enter", { delay: 80 });
      await page.waitForFunction(() => latestState.phase === 1);
      const retry = await page.evaluate(() => latestState);
      assert.equal(retry.segment, 2);
      assert.equal(retry.bossHP, 0);
      assert.equal(retry.checkpoint, 4);
      assert.ok(retry.returnTime < 1);
      console.log("PASS rising void, pause and return checkpoint");
      voidVerified = true;
      continue;
    }
    const keys = [];
    let targetX = 480;
    if (s.segment === 0) {
      // Keep a deliberate vertical route through the center, plunge through the
      // crossing patrols, and drop through any one-way ledge we actually land on.
      const gate =
        s.gateOne > 0 && s.y < -800 && s.y > -1250
          ? [670, -980]
          : s.gateTwo > 0 && s.y < -1900 && s.y > -2400
            ? [300, -2020]
            : null;
      if (gate) {
        targetX = gate[0];
        if (s.x < targetX - 20) keys.push("d");
        if (s.x > targetX + 20) keys.push("a");
        if (s.y > gate[1] + 20) keys.push("s");
        if (tick % 8 < 6) keys.push("e");
        if (tick % 4 === 0) keys.push("j");
        if (s.energy >= 60 && Math.hypot(s.x - targetX, s.y - gate[1]) < 230)
          keys.push("q");
        if (Math.abs(s.vy) < 10 && tick % 4 === 0) keys.push("Space");
      } else {
        if (s.x < targetX - 30) keys.push("d");
        if (s.x > targetX + 30) keys.push("a");
        keys.push("s");
        if (tick % 5 === 0) keys.push("j");
        if (Math.abs(s.vy) < 10 && tick % 3 === 0) keys.push("Space");
      }
    } else if (s.segment === 1) {
      if (s.bossShield > 0) {
        targetX = !s.sealLeft ? 300 : 660;
        if (s.x < targetX - 28) keys.push("d");
        if (s.x > targetX + 28) keys.push("a");
        if (s.y > -3220) keys.push("s");
        if (tick % 10 < 8) keys.push("e");
        if (s.y < -3520 && s.hook < 0 && tick % 4 === 0) keys.push("Space");
      } else {
        targetX = 480 + Math.sin(s.elapsed * 0.7 + 10) * 35;
        if (s.x < targetX - 20) keys.push("d");
        if (s.x > targetX + 20) keys.push("a");
        if (s.y > -3340) keys.push("s");
        if (tick % 4 === 0) keys.push("j");
        if (s.energy >= 60 && s.y > -3600 && s.y < -3150) keys.push("q");
        if (tick % 10 < 7) keys.push("e");
        if (s.y < -3520 && tick % 8 === 0) keys.push("Space");
      }
    } else {
      if (s.y > -370) {
        targetX = 260;
      } else {
        const arr = [
          [300, 140],
          [560, -100],
          [350, -340],
          [600, -580],
          [350, -820],
          [570, -1060],
          [360, -1300],
          [600, -1540],
          [350, -1780],
          [560, -2020],
          [350, -2260],
          [600, -2500],
          [350, -2740],
          [580, -2980],
          [300, -3230],
          [660, -3230],
          [480, -3440],
        ];
        const candidates = arr
          .filter((a) => a[1] > s.y + 70 && a[1] < s.y + 450)
          .sort(
            (a, b) =>
              Math.hypot(a[0] - s.x, a[1] - s.y) -
              Math.hypot(b[0] - s.x, b[1] - s.y),
          );
        targetX = candidates[0]?.[0] ?? 480;
      }
      if (s.x < targetX - 35) keys.push("d");
      if (s.x > targetX + 35) keys.push("a");
      if (tick % 9 < 7) keys.push("e");
      if (tick % 8 === 0 && s.hook < 0) keys.push("Space");
      if (s.vy < 50 && s.hook < 0 && s.dashCool <= 0 && tick % 5 === 0) {
        keys.push("w", "k");
      }
      if (tick % 5 === 0) keys.push("j");
      if (s.energy >= 60 && tick % 30 === 0) keys.push("q");
    }
    await hold(keys);
    await page.waitForTimeout(90);
  }
  await hold([]);
  await page.screenshot({
    path: fileURLToPath(new URL(`final-${process.env.MODE || 0}.png`, out)),
  });
  const result = await page.evaluate(() => ({
    state: latestState,
    events: runEvents,
    errors: runtimeErrors,
    frameIntervals,
  }));
  result.date = new Date().toISOString();
  result.browser = browser.version();
  result.voidVerified = voidVerified;
  const f = result.frameIntervals.sort((a, b) => a - b);
  result.browserFrameCadence = {
    samples: f.length,
    medianMs: f[Math.floor(f.length * 0.5)],
    p95Ms: f[Math.floor(f.length * 0.95)],
    note: "Host browser rAF intervals during play, not an engine FPS or device compatibility guarantee.",
  };
  delete result.frameIntervals;
  result.errors.push(...errors);
  result.sampledFrames = states.length;
  result.peakFX = Math.max(...states.map((s) => s.fxCount));
  await writeFile(
    new URL(`route-${process.env.MODE || 0}.json`, out),
    JSON.stringify(result, null, 2),
  );
  console.log("RESULT", JSON.stringify(result.state), result.errors);
  assert.equal(result.state.phase, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.state.bossStage, 1);
  assert.ok(result.state.gateOne <= 0 && result.state.gateTwo <= 0);
  assert.ok(result.events.filter((e) => e.name === "seal").length >= 4);
  assert.ok(result.events.some((e) => e.name === "enrage"));
  assert.ok(result.state.hookCount > 8);
  if (process.env.RETURN_FAILURE === "1") assert.equal(voidVerified, true);
} finally {
  await browser.close();
}
