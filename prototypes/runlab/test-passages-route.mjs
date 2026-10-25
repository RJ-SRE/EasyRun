import { platforms } from "./passages-level.mjs";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const out = new URL("./test-results/passages/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  page = await browser.newPage({
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
    !/jump|land|hook|sling|nohook/.test(m.text())
  )
    console.log(m.text());
});
const pressed = new Set();
async function hold(keys) {
  for (const k of [...pressed])
    if (!keys.includes(k)) {
      await page.keyboard.up(k);
      pressed.delete(k);
    }
  for (const k of keys)
    if (!pressed.has(k)) {
      await page.keyboard.down(k);
      pressed.add(k);
    }
}
let tick = 0,
  cp = -1,
  retries = 0,
  liftStart = null,
  liftRise = 0,
  liftDone = false;
const samples = [];
const features = process.env.FEATURES === "1";
try {
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4177") + "/passages.html",
  );
  await page.waitForFunction(
    () => window.passageState || window.passageErrors?.length,
    {},
    { timeout: 45000 },
  );
  assert.deepEqual(await page.evaluate(() => passageErrors), []);
  if (process.env.MODE === "1") {
    await page.locator('[data-mode="1"]').click();
    await page.waitForTimeout(150);
  }
  await page.locator("#play").click();
  await page.waitForFunction(() => passageState.phase === 1);
  const start = Date.now();
  while (Date.now() - start < 240000) {
    const s = await page.evaluate(() => passageState);
    samples.push(s);
    tick++;
    if (s.checkpoint !== cp) {
      cp = s.checkpoint;
      console.log("ROOM", cp, s);
      await page.screenshot({
        path: fileURLToPath(
          new URL(`room-${cp}-${process.env.MODE || 0}.png`, out),
        ),
      });
    }
    if (tick % 25 === 0)
      console.log(
        "POS",
        s.checkpoint,
        Math.round(s.x),
        Math.round(s.y),
        s.target,
        s.hook,
        s.valveLeft,
        s.valveRight,
        s.liftTime.toFixed(1),
      );
    if (s.phase === 2) break;
    if (s.phase === 3) {
      if (!liftDone) {
        liftStart = null;
        liftRise = 0;
      }
      console.log("FAIL", s);
      if (retries++ > 12) break;
      await hold([]);
      await page.keyboard.press("Enter", { delay: 60 });
      await page.waitForTimeout(130);
      continue;
    }
    const keys = [];
    let targetX = 190,
      targetY = 0,
      anchor = -1,
      wantDown = false,
      waitForLift = false,
      collecting = false;
    if (s.checkpoint === 0) {
      if (!s.fold) {
        targetX = 330;
        targetY = 110;
        anchor = 0;
      } else {
        targetX = 1800;
        targetY = 130;
        anchor = s.x < 850 ? 1 : s.x < 1270 ? 2 : 3;
      }
    } else if (s.checkpoint === 1) {
      if (!s.valveLeft) {
        targetX = s.y > -425 ? 2050 : 1770;
        targetY = -500;
        anchor = s.y < -360 ? 6 : -1;
        wantDown = true;
      } else if (!s.valveRight) {
        targetX = 2250;
        targetY = -800;
        anchor = 8;
        wantDown = true;
      } else {
        targetX = s.y > -1130 ? 2200 : 2570;
        targetY = -1510;
        wantDown = true;
      }
    } else if (s.checkpoint === 2) {
      if (!s.weight) {
        targetX = 2770;
        targetY = -1360;
        anchor = 11;
      } else {
        const lower = s.y < -1200;
        targetX = lower ? 2980 : s.x < 3370 ? 3450 : 3870;
        targetY = -850;
        anchor = lower ? 12 : s.x < 3370 ? 13 : 15;
      }
    } else if (s.checkpoint === 3) {
      targetX = 5330;
      targetY = -700;
      anchor = s.x < 4420 ? 16 : s.x < 4850 ? 17 : 18;
    } else {
      if (!s.wind) {
        targetX = 5320;
        targetY = -770;
        anchor = 19;
      } else if (s.y < 475) {
        targetX = 5550;
        targetY = s.y + 300;
        anchor =
          s.y < -650
            ? 20
            : s.y < -440
              ? 21
              : s.y < -230
                ? 22
                : s.y < -10
                  ? 23
                  : s.y < 200
                    ? 24
                    : 25;
      } else {
        targetX = 5780;
        targetY = 570;
        anchor = 26;
      }
    }
    const landingAtExit =
      s.checkpoint === 4 && s.wind && s.x > 5710 && s.y > 540;
    if (landingAtExit) {
      targetX = 5800;
      targetY = 550;
      anchor = -1;
    }
    if (features && s.checkpoint === 0 && s.fold && s.collected === 0) {
      collecting = true;
      targetX = 850;
      targetY = 100;
      anchor = s.x < 650 ? 1 : -1;
    }
    if (features && s.checkpoint === 2 && s.weight && !liftDone) {
      waitForLift = true;
      targetX = 2985;
      targetY = -1100;
      anchor = -1;
      if (s.grounded && s.standing === platforms.findIndex((p) => p[3] === 2)) {
        liftStart ??= s.y;
        liftRise = Math.max(liftRise, s.y - liftStart);
        if (liftRise > 100 && s.liftTime > 5) {
          liftDone = true;
          waitForLift = false;
          console.log("LIFT CARRIED", liftRise);
        }
      }
      if (s.y < -1420 && s.x > 2890 && !s.grounded) anchor = 12;
    }
    if (collecting || waitForLift || landingAtExit) {
      const desired = Math.max(-300, Math.min(300, (targetX - s.x) * 4));
      if (s.vx < desired - 35) keys.push("d");
      if (s.vx > desired + 35) keys.push("a");
    } else {
      if (s.x < targetX - 24) keys.push("d");
      if (s.x > targetX + 24) keys.push("a");
    }
    if (wantDown && s.y > targetY + 60) keys.push("s");
    else if (targetY > s.y + 90) keys.push("w");
    if (s.hook >= 0) {
      if (s.hook === anchor || tick % 24 < 20) keys.push("e");
    } else if (s.target === anchor && tick % 24 < 20) keys.push("e");
    if (s.grounded && !waitForLift && !landingAtExit && tick % 9 === 0) {
      if (wantDown && s.y > targetY + 80) keys.push("s");
      keys.push("Space");
    }
    if (
      !s.grounded &&
      !waitForLift &&
      !landingAtExit &&
      !collecting &&
      s.vy < -200 &&
      !wantDown &&
      s.y < targetY - 70 &&
      tick % 18 === 0
    )
      keys.push("Space");
    await hold(keys);
    await page.waitForTimeout(65);
  }
  await hold([]);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: fileURLToPath(new URL(`final-${process.env.MODE || 0}.png`, out)),
  });
  const report = await page.evaluate(() => ({
    state: passageState,
    events: passageEvents,
    errors: passageErrors,
  }));
  report.errors.push(...errors);
  report.samples = samples;
  report.date = new Date().toISOString();
  report.features = { enabled: features, liftRise, liftDone };
  await writeFile(
    new URL(`route-${process.env.MODE || 0}.json`, out),
    JSON.stringify(report, null, 2),
  );
  console.log("RESULT", report.state, report.errors);
  assert.equal(report.state.phase, 2);
  assert.deepEqual(report.errors, []);
  for (const name of ["fold", "valve", "shaftopen", "weight", "wind", "finish"])
    assert.ok(
      report.events.some((e) => e.name === name),
      name,
    );
  assert.ok(report.state.hookCount > 8);
  assert.equal(report.state.grounded, 1, "exit requires a real landing");
  assert.deepEqual(
    [...new Set(samples.map((s) => s.checkpoint))],
    [0, 1, 2, 3, 4],
  );
  assert.ok(
    samples.every((s) => s.fxCount >= 0 && s.fxCount <= 70),
    "particle budget stays bounded",
  );
  assert.ok(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("rupture-passages-v1")).some(
        (r) => r.result === "finish",
      ),
    ),
    "completion record persists",
  );
  if (report.state.deaths > 0)
    assert.ok(
      report.events.some((e) => e.name === "retry"),
      "failed route actually recovers",
    );
  if (features) {
    assert.ok(report.state.collected > 0, "optional relic reachable");
    assert.ok(liftDone, "moving platform actually carried hero");
  }
} finally {
  await browser.close();
}
