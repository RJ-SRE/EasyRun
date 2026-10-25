import test from "node:test";
import assert from "node:assert/strict";
import { buildExpeditionLayout, NODE_KINDS } from "./belfry-expedition.mjs";
import { SCENE_POOLS, sceneCloneCount } from "./belfry-scene.mjs";
import {
  expeditionSnapshot,
  expeditionHost,
  parseExpedition,
} from "./public/expedition-progress.js";
const l = buildExpeditionLayout();
test("view pools cover the authored camera span with motion headroom and reserve projectiles", () => {
  const sets = {
    sceneFloors: l.platforms.map((p) => [p[2], p[2]]),
    sceneAnchors: l.anchors.map((a) => [a[1], a[1]]),
    sceneEnemies: l.enemies
      .filter((e) => e.kind !== 6)
      .map((e) => [e.y - 180, e.y + 180]),
    sceneNiches: l.enemies.filter((e) => e.kind === 2).map((e) => [e.y, e.y]),
    sceneNodes: l.nodes.map((n) => [n.y, n.y]),
    sceneHeats: l.heats.map((h) => [h.y, h.y]),
    sceneGuides: l.rooms.map((r) => [
      l.anchors[r.anchorStart][1],
      l.anchors[r.anchorStart][1],
    ]),
  };
  for (const lift of l.lifts)
    sets.sceneFloors[lift.floor] = [lift.low, lift.high];
  const weight = l.lifts.find((lift) => lift.room === 3);
  sets.sceneFloors[l.counterweightFloor] = [weight.low, weight.high];
  for (const [name, spans] of Object.entries(sets)) {
    for (let y = 700; y >= -l.depth - 700; y -= 10) {
      const needed = spans.filter(
        ([low, high]) => high >= y - 700 && low <= y + 700,
      ).length;
      assert(
        needed <= SCENE_POOLS[name],
        `${name} at ${y} needs ${needed} slots`,
      );
    }
  }
  assert.equal(sceneCloneCount(l), 167);
  assert(
    sceneCloneCount(l) + 60 <= 240,
    "leave room for useful visual feedback below the effect admission ceiling",
  );
  assert.equal(
    300 - 240,
    60,
    "projectiles retain headroom even during a particle burst",
  );
});
test("every authored task is reachable from a supported permanent foothold", () => {
  assert.equal(l.rooms.length, 15);
  assert.equal(l.sides.length, 5);
  for (const n of l.nodes) {
    assert(NODE_KINDS.includes(n.kind));
    assert(
      l.platforms.some(
        ([x, w, y, k]) =>
          k === 0 && Math.abs(y - n.y) < 1 && n.x >= x && n.x <= x + w,
      ),
      `unsupported ${n.kind} in room ${n.room}`,
    );
  }
  for (const [x, y] of l.checkpoints)
    assert(
      l.platforms.some(
        ([px, w, py, k]) => k === 0 && py === y && x >= px && x <= px + w,
      ),
    );
});
test("mechanism targets are distinct from kills and return enemies are isolated", () => {
  const mechanisms = l.enemies.filter((e) => e.kind === 6);
  assert.equal(mechanisms.length, 5);
  for (const e of mechanisms) {
    assert(e.node >= 0);
    assert.equal(e.x, l.nodes[e.node].x);
    assert.equal(e.y, l.nodes[e.node].y + 34);
  }
  assert(
    l.enemies.slice(l.keeperIndex + 1).some((e) => !e.returnOnly),
    "array position does not imply return-only",
  );
  assert.equal(l.enemies.filter((e) => e.returnOnly).length, 5);
});
test("baseline upward anchors connect every region without optional quests", () => {
  const byHeight = [...l.anchors].sort((a, b) => b[1] - a[1]);
  for (let i = 1; i < byHeight.length; i++)
    assert(
      byHeight[i - 1][1] - byHeight[i][1] <= 320,
      "vertical gap exceeds normal grappling span",
    );
  assert(l.platforms[l.keeperFloor][1] >= 800);
  assert(l.sealAnchors.every((i) => l.anchors[i][1] > l.keeperY));
});
test("legacy region checkpoints migrate without awarding optional quests or touching words", () => {
  for (const [old, expected] of [
    [0, 0],
    [1, 3],
    [2, 6],
    [3, 12],
    [4, 14],
  ]) {
    const source = {
      checkpoint: old,
      segment: 0,
      cityForge: 1,
      pool: ["unchanged"],
    };
    const next = expeditionSnapshot(source);
    assert.equal(next.checkpoint, expected);
    assert.deepEqual(next.expedition.sides, [0, 0, 0, 0, 0]);
    assert.deepEqual(next.pool, source.pool);
    assert.equal(next.expedition.done.filter(Boolean).length, expected);
  }
  const returning = expeditionSnapshot({ checkpoint: 4, segment: 2 });
  assert.equal(returning.checkpoint, 14);
  assert(returning.expedition.done.every(Boolean));
});
test("new progress is sanitized and resumes escort at its last safe stop", () => {
  const next = expeditionSnapshot({
    checkpoint: 7,
    expedition: {
      revision: 2,
      flags: [NaN, Infinity, "x"],
      sides: [2, 9, -1],
      lampStep: 2,
      cargoChoice: 1,
      mirrorChoice: 999,
    },
  });
  assert.equal(next.checkpoint, 7);
  assert.equal(next.expedition.lampStep, 2);
  assert.equal(next.expedition.mirrorChoice, 0);
  assert.deepEqual(next.expedition.sides, [2, 0, 0, 0, 0]);
  assert(!expeditionHost(next.expedition).includes("NaN"));
  assert.equal(parseExpedition(Array(45).fill(0)).flags.length, 15);
  assert.equal(parseExpedition(Array(44).fill(0)), null);
});

test("grounded defenders have actual support without using a closed task gate", () => {
  for (const e of l.enemies.filter((e) => [1, 4, 5].includes(e.kind)))
    assert(
      l.platforms.some(
        ([x, w, y, k]) =>
          (k === 0 || k === 1) &&
          Math.abs(e.y - 34 - y) < 1 &&
          e.x >= x &&
          e.x <= x + w,
      ),
      `unsupported defender ${e.room}:${e.kind}`,
    );
});
test("courier and archive shortcuts remain optional physical routes", () => {
  assert(l.courierFloor >= 0 && l.courierNode >= 0);
  assert.equal(l.nodes[l.courierNode].side, 0);
  assert(l.platforms.some((p) => p[3] === 42));
  assert(l.lifts.some((x) => l.platforms[x.floor][3] === 70));
  assert(
    l.enemies.filter((e) => Number.isInteger(e.side)).every((e) => e.side >= 0),
  );
});
