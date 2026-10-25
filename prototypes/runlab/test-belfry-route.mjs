import { buildHuntLayout } from "./belfry-hunt.mjs";
const expeditionLayout = buildHuntLayout();
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BANK } from "./public/inscription-core.js";
const out = new URL("./test-results/belfry/", import.meta.url);
const routeLabel = `${process.env.MODE || 0}${process.env.STYLE === "burst" ? "-burst" : ""}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  recordVideo: process.env.RECORD
    ? { dir: fileURLToPath(out), size: { width: 1440, height: 1000 } }
    : undefined,
});
const errors = [];
// The player-facing diagnostic ring deliberately retains only 800 events.
// Keep the whole route here so a long return cannot erase the Boss evidence.
const routeEvents = [];
const skillImpacts = [];
const wordRequests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  const request = m.text().match(/@word\s+(\d+)\s+(\d+)\s+(\d+)/);
  if (request)
    wordRequests.push({
      cast: `${request[1]}:${request[2]}`,
      kind: +request[3],
    });
  const impact = m
    .text()
    .match(/@skillImpact\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\S+)/);
  if (impact)
    skillImpacts.push({
      attempt: +impact[1],
      serial: +impact[2],
      kind: +impact[3],
      target: +impact[4],
      elapsed: +impact[5],
    });
  const event = m.text().match(/@event\s+(\w+)\s+(\S+)\s+(\S+)\s+(\S+)/);
  if (event) {
    if (event[1] === "start") routeEvents.length = 0;
    routeEvents.push({
      name: event[1],
      time: Number(event[2]),
      x: Number(event[3]),
      y: Number(event[4]),
    });
  }
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
const renderSamples = [];
const wordEncounters = [];
let prevSegment = -1,
  tick = 0,
  retries = 0,
  voidVerified = false,
  progressKey = "",
  progressAt = 0,
  furthestY = 0,
  progressSegment = -1;
let lastWordSerial = 0;
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
  while (Date.now() - start < 600000) {
    const {
      s,
      hunts,
      render,
      activeWord,
      foes: visibleFoes,
    } = await page.evaluate(() => ({
      s: latestState,
      hunts: window.huntFoes,
      render: window.renderState,
      activeWord: window.inscriptionDiagnostics.active,
      foes: Object.values(foes).filter(
        (f) => latestState.elapsed - f.seen < 0.4,
      ),
    }));
    states.push(s);
    // The host deliberately releases combat keys when a question takes over.
    // A very brief failed prompt can resolve between sampled @state messages;
    // invalidate our held-key cache as soon as its serial changes, too.
    if (s.wordSerial !== lastWordSerial) {
      await hold([]);
      lastWordSerial = s.wordSerial;
    }
    if (render) renderSamples.push(render);
    // A hit cancels charging, but a physically held key must be released before
    // a new edge can start the next charge. Never fake a queued retry in game.
    if (
      s.phase === 1 &&
      s.attackTime <= 0 &&
      ((held.has("l") && s.chargeTime <= 0) ||
        (held.has("u") && s.bowCharge <= 0))
    ) {
      await hold([...held].filter((k) => k !== "l" && k !== "u"));
      await page.waitForTimeout(90);
      continue;
    }
    if (s.segment !== progressSegment) {
      progressSegment = s.segment;
      furthestY = s.y;
    }
    furthestY =
      s.segment === 2 ? Math.max(furthestY, s.y) : Math.min(furthestY, s.y);
    const progress = JSON.stringify([
      s.segment,
      s.checkpoint,
      s.kills,
      s.bossHP,
      s.expedition.flags,
      s.expedition.done,
      s.expedition.lampStep,
      Math.floor(furthestY / 250),
    ]);
    if (progress !== progressKey) {
      progressKey = progress;
      progressAt = s.elapsed;
    }
    if (s.elapsed - progressAt > 25) {
      await page.screenshot({
        path: fileURLToPath(new URL("route-stalled.png", out)),
      });
      await writeFile(
        new URL("route-stalled.json", out),
        JSON.stringify(
          { state: s, foes: visibleFoes, keys: [...held] },
          null,
          2,
        ),
      );
      throw new Error(
        "Route controller made no spatial/task/combat progress for 25 simulation seconds; see route-stalled.json",
      );
    }

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
        s.expedition?.room,
        s.expedition?.flags,
        JSON.stringify({
          held: [...held],
          foes: visibleFoes.map((f) => [
            f.id,
            f.kind,
            f.hp,
            Math.round(f.x),
            Math.round(f.y),
          ]),
          bow: s.bowCharge,
          blade: s.chargeTime,
        }),
      );
    if (s.phase === 2) {
      console.log("WIN", s);
      break;
    }
    if (s.phase === 3) {
      console.log("DIED", s);
      if (retries++ > 8) break;
      await hold([]);
      await page.keyboard.press("Enter", { delay: 80 });
      await page.waitForTimeout(200);
      continue;
    }
    if (s.phase === 5 || activeWord) {
      await hold([]);
      const active = await page.evaluate(
        () => window.inscriptionDiagnostics.active,
      );
      if (!active || active.result) {
        await page.waitForTimeout(40);
        continue;
      }
      const q = active.q;
      const word = BANK.get(q.wordId);
      wordEncounters.push({
        serial: q.serial,
        cast: q.actionId.split(":").slice(-2).join(":"),
        wordId: q.wordId,
        kind: q.kind,
        room: s.expedition.room,
        segment: s.segment,
        elapsed: s.elapsed,
        attempt: s.attempts,
        health: s.health,
        nearbyFoes: visibleFoes
          .filter(
            (f) => f.hp > 0 && Math.hypot(f.x - s.x, f.y - s.y - 32) < 540,
          )
          .map((f) => ({ id: f.id, kind: f.kind, hp: f.hp, mark: f.mark })),
      });
      if (q.type === "spell")
        await page.keyboard.type(word.word, { delay: 65 });
      else
        await page.keyboard.press(String(q.options.indexOf(word.meaning) + 1));
      await page.waitForFunction(
        () => latestState.phase === 1 && !window.inscriptionDiagnostics.active,
      );
      continue;
    }
    if (
      process.env.RETURN_FAILURE === "1" &&
      s.segment === 2 &&
      !voidVerified
    ) {
      await hold(["s"]);
      await page.keyboard.press("j", { delay: 80 });
      // A plunge lands on the Keeper's shoulder platforms. Drop through each
      // ledge with the normal player input before testing the rising void.
      const floorY =
        expeditionLayout.platforms[expeditionLayout.keeperFloor][2];
      for (let step = 0; step < 20; step++) {
        const down = await page.evaluate(() => latestState);
        if (down.y <= floorY + 10 || down.phase !== 1) break;
        if (Math.abs(down.vy) < 10)
          await page.keyboard.press("Space", { delay: 80 });
        await page.keyboard.press("j", { delay: 80 });
        await page.waitForTimeout(180);
      }
      await hold([]);
      await page.waitForFunction(
        (y) => latestState.y <= y + 10 || latestState.phase !== 1,
        expeditionLayout.platforms[expeditionLayout.keeperFloor][2],
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
      assert.equal(failed.checkpoint, 14);
      await page.screenshot({
        path: fileURLToPath(new URL("void-failure.png", out)),
      });
      await page.keyboard.press("Enter", { delay: 80 });
      await page.waitForFunction(() => latestState.phase === 1);
      const retry = await page.evaluate(() => latestState);
      assert.equal(retry.segment, 2);
      assert.equal(retry.bossHP, 0);
      assert.equal(retry.checkpoint, 14);
      assert.ok(retry.returnTime < 1);
      console.log("PASS rising void, pause and return checkpoint");
      voidVerified = true;
      continue;
    }
    const keys = [];
    let targetX = 480;
    if (s.segment === 0) {
      const e = s.expedition,
        r = expeditionLayout.rooms[e.room];
      let goal = { x: 480, y: r.bottom - 60 };
      // Commit only to threats near the route or to the two authored elites;
      // there is no invulnerability, teleport, HP modification or forced gate.
      const fight = visibleFoes
        .filter(
          (f) =>
            f.hp > 0 &&
            f.kind !== 6 &&
            f.kind !== 3 &&
            expeditionLayout.enemies[f.id]?.room === e.room,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - s.x, a.y - s.y) -
            (a.kind === 9 ? 160 : 0) -
            (Math.hypot(b.x - s.x, b.y - s.y) - (b.kind === 9 ? 160 : 0)),
        )[0];
      let targetY = goal.y;
      const combat =
        fight &&
        !e.done[e.room] &&
        ((Math.abs(fight.y - 34 - s.y) < 105 && fight.y - 34 < s.y + 40) ||
          e.room === 5 ||
          e.room === 10 ||
          e.room === 11);
      if (combat) {
        goal = {
          x: Math.max(115, Math.min(845, fight.x + (s.x < fight.x ? -90 : 90))),
          y: fight.y - 34,
        };
        targetY = goal.y;
      }
      targetX = goal.x;
      const rangedFight = combat && [0, 2, 9].includes(fight.kind);
      const rising = targetY > s.y + 65 && !rangedFight;
      if (rising && targetY - s.y < 160) {
        if (tick % 6 === 0) keys.push("Space");
      } else if (rising) {
        const candidate = expeditionLayout.anchors
          .filter((a) => a[1] > s.y + 70 && a[1] < s.y + 450)
          .sort(
            (a, b) =>
              Math.hypot(a[0] - s.x, a[1] - s.y) -
              Math.hypot(b[0] - s.x, b[1] - s.y),
          )[0];
        if (candidate) targetX = candidate[0];
        if (tick % 9 < 7) keys.push("e");
        if (s.hook < 0 && tick % 8 === 0) keys.push("Space");
      }
      if (s.x < targetX - 18) keys.push("d");
      if (s.x > targetX + 18) keys.push("a");
      if (targetY < s.y - 55 && !rising) {
        keys.push("s");
        if (Math.abs(s.vy) < 10 && tick % 3 === 0) keys.push("Space");
      }
      if (
        combat &&
        !rising &&
        s.hook < 0 &&
        Math.abs(fight.y - s.y - 30) < (rangedFight ? 450 : 100)
      ) {
        const near = Math.abs(fight.x - s.x) < 150;
        if (process.env.STYLE === "basic") {
          if (tick % 4 === 0) keys.push("j");
        } else if (s.chargeTime > 0 && process.env.STYLE === "burst") {
          if (s.chargeTime < 0.58) keys.push("l");
        } else if (process.env.STYLE === "burst") {
          // An efficient Q-first route tests the no-cooldown skill's real
          // opportunity cost. Use ordinary attacks between commitments and
          // keep navigation identical; do not add a fictitious energy fee.
          if (s.ultimateTime <= 0 && s.attackTime <= 0) {
            if (
              near &&
              ((fight.kind === 7 && hunts[fight.id]?.armor <= 0) ||
                hunts[fight.id]?.ward >= 0)
            )
              keys.push("l");
            else if (Math.abs(fight.x - s.x) < 235) keys.push("q");
            else if (tick % 4 === 0) keys.push("j");
          }
        } else if (s.bowCharge > 0) {
          if (s.bowCharge < 0.58) keys.push("u");
        } else if (s.chargeTime > 0) {
          if (s.chargeTime < 0.58) keys.push("l");
        } else if (s.attackTime <= 0 && s.ultimateTime <= 0) {
          if (
            near &&
            (fight.mark > 0 || fight.kind === 7 || hunts[fight.id]?.ward >= 0)
          )
            keys.push("l");
          else if (near && tick % 5 === 0) keys.push("j");
          else keys.push("u");
        }
        // A jump cancels a charging skill. Do not let the controller endlessly
        // restart windups while appearing to fight. Dodge between commitments.
        if (
          fight.state === 1 &&
          near &&
          tick % 8 === 0 &&
          s.bowCharge <= 0 &&
          s.chargeTime <= 0 &&
          !keys.includes("u") &&
          !keys.includes("l")
        )
          keys.push("Space");
      }
      if (
        e.prompt >= 0 &&
        expeditionLayout.nodes[e.prompt]?.side < 0 &&
        (!combat || Math.abs(fight.x - s.x) > 175)
      ) {
        keys.splice(0, keys.length);
        if (tick % 3 === 0) keys.push("f");
      }
    } else if (s.segment === 1) {
      if (s.bossShield > 0) {
        targetX = !s.sealLeft ? 300 : 660;
        if (s.x < targetX - 28) keys.push("d");
        if (s.x > targetX + 28) keys.push("a");
        if (s.y > expeditionLayout.keeperY + 336) keys.push("s");
        if (tick % 10 < 8) keys.push("e");
        if (s.y < expeditionLayout.keeperY + 36 && s.hook < 0 && tick % 4 === 0)
          keys.push("Space");
      } else {
        targetX = 480 + Math.sin(s.elapsed * 0.7 + 10) * 35;
        if (s.x < targetX - 20) keys.push("d");
        if (s.x > targetX + 20) keys.push("a");
        if (s.y > expeditionLayout.keeperY + 216) keys.push("s");
        if (tick % 4 === 0) keys.push("j");
        if (
          process.env.STYLE !== "basic" &&
          (process.env.STYLE === "burst" || s.energy >= 60) &&
          visibleFoes.some(
            (f) =>
              f.kind === 3 &&
              f.hp > 0 &&
              f.state === 2 &&
              Math.hypot(f.x - s.x, f.y - s.y - 32) < 245,
          ) &&
          s.y > expeditionLayout.keeperY - 44 &&
          s.y < expeditionLayout.keeperY + 406
        )
          keys.push("q");
        if (tick % 10 < 7) keys.push("e");
        if (s.y < expeditionLayout.keeperY + 36 && tick % 8 === 0)
          keys.push("Space");
      }
    } else {
      if (s.y > -370) {
        targetX = 260;
      } else {
        const arr = expeditionLayout.anchors;
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
      if (
        process.env.STYLE !== "basic" &&
        (process.env.STYLE === "burst" || s.energy >= 60) &&
        tick % 30 === 0 &&
        visibleFoes.some(
          (f) =>
            f.kind !== 6 &&
            f.hp > 0 &&
            Math.hypot(f.x - s.x, f.y - s.y - 32) < 245,
        )
      )
        keys.push("q");
    }
    await hold(keys);
    await page.waitForTimeout(90);
  }
  await hold([]);
  await page.screenshot({
    path: fileURLToPath(new URL(`hunt-final-${routeLabel}.png`, out)),
  });
  const result = await page.evaluate(() => ({
    state: latestState,
    events: runEvents,
    errors: runtimeErrors,
    frameIntervals,
    inscriptions: window.inscriptionDiagnostics.run,
    render: window.renderState,
  }));
  result.date = new Date().toISOString();
  result.events = routeEvents;
  result.wordEncounters = wordEncounters;
  result.wordRequests = wordRequests;
  result.skillImpacts = skillImpacts;
  const effective = new Set(
    skillImpacts.map((hit) => `${hit.attempt}:${hit.serial}`),
  );
  const mainImpacts = skillImpacts.filter((hit) => {
    const target = expeditionLayout.enemies[hit.target];
    return (
      hit.kind !== 3 &&
      target &&
      target.side === undefined &&
      !target.returnOnly
    );
  });
  const mainEffective = new Set(
    mainImpacts.map((hit) => `${hit.attempt}:${hit.serial}`),
  );
  result.wordCoverage = {
    requests: wordRequests.length,
    unobservedRequests: wordRequests.filter(
      (request) => !wordEncounters.some((q) => q.cast === request.cast),
    ),
    differentSeen: Object.values(result.inscriptions?.progress || {}).filter(
      (p) => p.seen > 0,
    ).length,
    differentCorrect: Object.values(result.inscriptions?.progress || {}).filter(
      (p) => p.correct,
    ).length,
    effectiveCasts: effective.size,
    mainRouteEffectiveCasts: mainEffective.size,
    distinctWordsWithMainRouteImpact: new Set(
      wordEncounters
        .filter((q) => q.segment !== 2 && mainEffective.has(q.cast))
        .map((q) => q.wordId),
    ).size,
    byAttempt: [...new Set(wordEncounters.map((q) => q.attempt))].map(
      (attempt) => ({
        attempt,
        mainRouteEffectiveCasts: wordEncounters.filter(
          (q) =>
            q.attempt === attempt &&
            q.segment !== 2 &&
            mainEffective.has(q.cast),
        ).length,
        distinctWordsWithMainRouteImpact: new Set(
          wordEncounters
            .filter(
              (q) =>
                q.attempt === attempt &&
                q.segment !== 2 &&
                mainEffective.has(q.cast),
            )
            .map((q) => q.wordId),
        ).size,
      }),
    ),
    byRoom: expeditionLayout.rooms.map((room, i) => ({
      room: room.name,
      requests: wordEncounters.filter((q) => q.room === i && q.segment !== 2)
        .length,
      effectiveCasts: wordEncounters.filter(
        (q) => q.room === i && q.segment !== 2 && mainEffective.has(q.cast),
      ).length,
    })),
    impacts: Object.fromEntries(
      ["arrowhit", "markbreak", "chainhit", "healcomplete"].map((name) => [
        name,
        routeEvents.filter((e) => e.name === name).length,
      ]),
    ),
    note: "Answers are automated. These are actual requests and distinct recorded words for this input policy, not natural human coverage or learning evidence. Effective casts are deduplicated by question ID; main-route impacts exclude healing, optional guards and return-only enemies. Death/retry may still repeat an encounter. Raw impact events can include multiple hits per cast.",
  };
  result.style = process.env.STYLE || "mixed";
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
  result.renderBudget = {
    samples: renderSamples.length,
    peakClones: Math.max(
      ...renderSamples.map((r) => r.sceneBorn + r.effects + r.projectiles),
    ),
    missingViews: Math.max(...renderSamples.map((r) => r.missing)),
    note: "Production birth counters and allocated transient objects; camera fixtures are not used in this route.",
  };
  await writeFile(
    new URL(`hunt-route-${routeLabel}.json`, out),
    JSON.stringify(result, null, 2),
  );
  console.log("RESULT", JSON.stringify(result.state), result.errors);
  assert.equal(result.state.phase, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.state.bossStage, 2);
  assert.equal(result.renderBudget.missingViews, 0);
  assert(result.renderBudget.peakClones < 300);
  assert.equal(result.render.sceneBorn, result.render.sceneClones);
  assert.equal(result.render.arrowsBorn, result.render.arrowsRequested);
  assert.equal(result.render.boltsBorn, result.render.boltsRequested);
  assert.ok(
    [5, 10, 11, 14].every((r) => result.state.expedition.done[r] === 1),
    "all mandatory elite encounters and the Boss were actually defeated",
  );
  const attemptEvents = [[]];
  for (const event of result.events) {
    if (event.name === "retry") attemptEvents.push([]);
    attemptEvents.at(-1).push(event);
  }
  const winningBossAttempt = attemptEvents.find((events) =>
    events.some((e) => e.name === "core"),
  );
  assert(winningBossAttempt, "a real Boss defeat starts the return");
  assert.equal(winningBossAttempt.filter((e) => e.name === "seal").length, 0);
  assert.equal(winningBossAttempt.filter((e) => e.name === "enrage").length, 2);
  assert.ok(result.state.hookCount > 8);
  if (process.env.RETURN_FAILURE === "1") assert.equal(voidVerified, true);
  if (process.env.MODE === "1")
    assert(
      skillImpacts.length > 0,
      "word-route effectiveness must be measured at actual collision",
    );
} finally {
  await browser.close();
}
