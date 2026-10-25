import test from "node:test";
import assert from "node:assert/strict";
import { buildHuntLayout, HUNT_ROSTER } from "./belfry-hunt.mjs";
import { SCENE_POOLS, sceneCloneCount } from "./belfry-scene.mjs";
import {
  expeditionSnapshot,
  parseExpedition,
} from "./public/expedition-progress.js";
const l = buildHuntLayout();
test("hunt topology has no mechanism entities or quest prerequisites", () => {
  assert.equal(l.rooms.length, 15);
  assert.equal(HUNT_ROSTER.length, 8);
  for (const k of ["nodes", "sides", "lifts", "heats", "ghosts"])
    assert.deepEqual(l[k], []);
  assert(!l.enemies.some((e) => e.kind === 6));
  assert.deepEqual(
    l.rooms.filter((r) => r.gate >= 0).map((r) => r.index),
    [5, 10, 11],
  );
  assert.equal(l.enemies.filter((e) => e.elite).length, 4);
  assert.equal(l.enemies.filter((e) => e.returnOnly).length, 3);
});
test("all ground patrols and checkpoints stand on permanent geometry", () => {
  for (const e of l.enemies.filter((e) => ![0, 2, 9].includes(e.kind)))
    assert(
      l.platforms.some(
        ([x, w, y, k]) =>
          k === 0 && e.x >= x && e.x <= x + w && Math.abs(e.y - y - 34) < 1,
      ),
      `unsupported ${e.kind} room ${e.room}`,
    );
  for (const [x, y] of l.checkpoints)
    assert(
      l.platforms.some(
        ([px, w, py, k]) => k === 0 && x >= px && x <= px + w && y === py,
      ),
    );
});
test("return chain has reachable consecutive anchors without any repair", () => {
  const a = [...l.anchors].sort((a, b) => b[1] - a[1]);
  for (let i = 1; i < a.length; i++)
    assert(
      Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1]) <= 475,
      `unreachable anchors ${i}`,
    );
});
test("authored views plus movement fit fixed render pools", () => {
  const sets = {
    sceneFloors: l.platforms.map((p) => [p[2], p[2]]),
    sceneAnchors: l.anchors.map((a) => [a[1], a[1]]),
    sceneEnemies: l.enemies.map((e) => [e.y - 160, e.y + 250]),
    sceneNiches: l.enemies.filter((e) => e.kind === 2).map((e) => [e.y, e.y]),
  };
  for (const [name, spans] of Object.entries(sets))
    for (let y = 700; y >= -l.depth - 700; y -= 10)
      assert(
        spans.filter(([a, b]) => b >= y - 700 && a <= y + 700).length <=
          SCENE_POOLS[name],
        `${name} capacity at ${y}`,
      );
  assert(sceneCloneCount(l) < 180);
});
test("v2 device state migrates without replacing word pool or awarding new combat", () => {
  const pool = ["keep-me"];
  const s = expeditionSnapshot({
    checkpoint: 10,
    segment: 0,
    pool,
    cityForge: 1,
    expedition: {
      revision: 2,
      done: Array(15).fill(1),
      sides: [2, 2, 2, 2, 2],
    },
  });
  assert.equal(s.checkpoint, 10);
  assert.equal(s.pool, pool);
  assert.equal(s.expedition.revision, 3);
  assert.deepEqual(
    s.expedition.done,
    Array.from({ length: 15 }, (_, i) => +(i < 10)),
  );
  assert.equal(s.cityForge, 0);
  assert.deepEqual(s.expedition.sides, [0, 0, 0, 0, 0]);
});
test("v3 resume sanitizes completion and does not resurrect device flags", () => {
  const s = expeditionSnapshot({
    checkpoint: 5,
    expedition: { revision: 3, done: [1, NaN, -1, 1, 0, 1], flags: [31] },
  });
  assert.deepEqual(s.expedition.done.slice(0, 6), [1, 0, 0, 1, 0, 1]);
  assert(s.expedition.flags.every((x) => x === 0));
  assert.equal(parseExpedition([1, 2]), null);
  assert.equal(parseExpedition(Array(45).fill(0)).revision, 3);
});
