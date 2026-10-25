import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const results = new URL("../prototypes/runlab/test-results/", import.meta.url);
const destination = new URL(
  "../docs/evidence/2026-10-25-expedition-current/",
  import.meta.url,
);
const built = new URL(
  "../prototypes/runlab/public/belfry.json",
  import.meta.url,
);
const builtAt = (await stat(built)).mtimeMs;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const entries = [
  ["combat/combat.json", 13],
  ["scene/report.json", 34],
  ["music/report.json", 14],
  ["assassins/enemies.json", 12],
  ["ninja/ninja.json", 10],
  ["skills/skills.json", 17],
  ["keeper/report.json", 16],
  ["bow-autoaim/bow-autoaim.json", 9],
  ["inscription/report.json", 24],
  ["inscription/resilience.json", 5],
  ["inscription-motion/report.json", 9],
  ["achievements/report.json", 12],
  ["city/report.json", 12],
  ["expedition/report.json", 15],
  ["encounters/report.json", 9],
  ["expedition-quests/report.json", 7],
  ["belfry/lifecycle.json", 12],
];
const suites = [];
for (const [path, expected] of entries) {
  const bytes = await readFile(new URL(path, results));
  const report = JSON.parse(bytes);
  assert(Date.parse(report.date) >= builtAt, `stale suite: ${path}`);
  assert.equal(report.failure, undefined, `failed suite: ${path}`);
  assert.deepEqual(report.errors, [], `runtime errors: ${path}`);
  assert.equal(report.cases.length, expected, `incomplete suite: ${path}`);
  const cases = report.cases.map((item) =>
    typeof item === "string" ? item : item.name,
  );
  assert(cases.every((name) => typeof name === "string" && name.length > 0));
  suites.push({
    path,
    date: report.date,
    sha256: hash(bytes),
    scope: report.scope || report.fixture || report.note || null,
    cases,
  });
}
const routes = [],
  pending = [];
for (const name of ["route-0.json", "route-1.json", "route-1-burst.json"]) {
  const path = `belfry/${name}`;
  let bytes;
  try {
    bytes = await readFile(new URL(path, results));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    pending.push(path);
    continue;
  }
  const report = JSON.parse(bytes);
  if (Date.parse(report.date) < builtAt) {
    pending.push(path);
    continue;
  }
  assert.equal(report.state.phase, 2, `route did not win: ${path}`);
  assert.deepEqual(report.errors, [], `route errors: ${path}`);
  assert.equal(report.renderBudget.missingViews, 0, `missing views: ${path}`);
  routes.push({
    path,
    date: report.date,
    sha256: hash(bytes),
    style: report.style,
    state: report.state,
    wordCoverage: report.wordCoverage,
    renderBudget: report.renderBudget,
    browserFrameCadence: report.browserFrameCadence,
    voidVerified: report.voidVerified,
    bossEvents: report.events.filter((event) =>
      [
        "guardian",
        "seal",
        "enrage",
        "core",
        "retry",
        "fail",
        "finish",
      ].includes(event.name),
    ),
  });
}
if (process.argv.includes("--require-routes"))
  assert.deepEqual(pending, [], "current normal/mixed/burst routes required");
const sourceFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString()
  .split("\0")
  .filter(
    (path) =>
      (path.startsWith("prototypes/runlab/") || path.startsWith("scripts/")) &&
      /\.(spx|mjs|js|css|html|py)$/.test(path),
  );
const sourceHashes = {};
for (const path of sourceFiles)
  sourceHashes[path] = hash(
    await readFile(new URL(`../${path}`, import.meta.url)),
  );
await mkdir(destination, { recursive: true });
await writeFile(
  new URL("verification.json", destination),
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
        .toString()
        .trim(),
      build: {
        sha256: hash(await readFile(built)),
        builtAt: new Date(builtAt),
      },
      sourceHashes,
      suites,
      routes,
      pending,
      scope:
        "Local automated checks only. Isolated suites may arrange initial positions and observe protected AI. Whole routes use real keyboard input and production state, with automated answers. These results do not establish human fun, natural vocabulary coverage, learning efficacy, play duration, low-end performance or remote CI success. Hashes identify files at export; report dates retain their actual execution times.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Exported ${suites.reduce((total, suite) => total + suite.cases.length, 0)} checks, ${routes.length} current routes; ${pending.length} routes pending.`,
);
