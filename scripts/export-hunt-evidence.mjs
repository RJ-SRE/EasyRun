import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, stat, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const results = new URL("../prototypes/runlab/test-results/", import.meta.url);
const dest = new URL("../docs/evidence/2026-10-25-hunt-v10/", import.meta.url);
const built = new URL(
  "../prototypes/runlab/public/belfry.json",
  import.meta.url,
);
const builtAt = (await stat(built)).mtimeMs;
const hash = (b) => createHash("sha256").update(b).digest("hex");
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
  ["hunt/report.json", 19],
  ["belfry/lifecycle.json", 12],
];
const suites = [];
for (const [path, count] of entries) {
  const url = new URL(path, results),
    bytes = await readFile(url),
    r = JSON.parse(bytes);
  assert((await stat(url)).mtimeMs >= builtAt, `stale: ${path}`);
  assert.equal(r.failure, undefined, path);
  assert.deepEqual(r.errors, [], path);
  assert.equal(r.cases.length, count, path);
  suites.push({
    path,
    date: r.date,
    sha256: hash(bytes),
    scope: r.scope || r.fixture || null,
    cases: r.cases.map((c) => (typeof c === "string" ? c : c.name)),
  });
}
const routes = [];
for (const name of [
  "hunt-route-0.json",
  "hunt-route-1.json",
  "hunt-route-1-burst.json",
]) {
  const path = `belfry/${name}`,
    url = new URL(path, results),
    bytes = await readFile(url),
    r = JSON.parse(bytes);
  assert((await stat(url)).mtimeMs >= builtAt, `stale: ${path}`);
  assert.equal(r.state.phase, 2, path);
  assert.deepEqual(r.errors, [], path);
  assert.equal(r.renderBudget.missingViews, 0);
  assert(r.renderBudget.peakClones < 300);
  assert([5, 10, 11, 14].every((i) => r.state.expedition.done[i] === 1));
  assert.equal(r.events.filter((e) => e.name === "seal").length, 0);
  if (name === "hunt-route-0.json") assert.equal(r.voidVerified, true);
  routes.push({
    path,
    sha256: hash(bytes),
    style: r.style,
    state: r.state,
    wordCoverage: r.wordCoverage,
    renderBudget: r.renderBudget,
    browserFrameCadence: r.browserFrameCadence,
    voidVerified: r.voidVerified,
    bossEvents: r.events.filter((e) =>
      ["guardian", "enrage", "core", "retry", "fail", "finish"].includes(
        e.name,
      ),
    ),
  });
}
const sourceNames = execFileSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "prototypes/runlab",
    "scripts/test-game.mjs",
    "scripts/export-hunt-evidence.mjs",
    "package.json",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n");
const sources = [];
for (const path of [...new Set(sourceNames)].sort())
  sources.push({
    path,
    sha256: hash(
      await readFile(new URL(path, new URL("../", import.meta.url))),
    ),
  });
await mkdir(dest, { recursive: true });
const screenshots = [];
for (const [from, to] of [
  ["hunt/warden-break.png", "warden-break.png"],
  ["hunt/weaver-link.png", "weaver-link.png"],
  ["hunt/hound-tell.png", "hound-tell.png"],
]) {
  await copyFile(new URL(from, results), new URL(to, dest));
  screenshots.push({
    path: to,
    sha256: hash(await readFile(new URL(to, dest))),
  });
}
const report = {
  date: new Date().toISOString(),
  branch: execFileSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  base: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  built: {
    sha256: hash(await readFile(built)),
    modified: new Date(builtAt).toISOString(),
  },
  browserAssertions: suites.reduce((n, s) => n + s.cases.length, 0),
  suites,
  routes,
  screenshots,
  scope:
    "Local Chromium checks. Fixed arrangements isolate individual behaviors; routes use real keyboard input and automated correct answers. Not human playability, learning or cross-device evidence.",
};
await writeFile(
  new URL("verification.json", dest),
  JSON.stringify(report, null, 2) + "\n",
);
await writeFile(
  new URL("source-manifest.json", dest),
  JSON.stringify(sources, null, 2) + "\n",
);
for (const name of ["hunt-unit.log", "hunt-build.log", "hunt-package.log"])
  await copyFile(
    new URL(name, results),
    new URL(name.replace(".log", ".txt"), dest),
  );
console.log(
  `Exported ${report.browserAssertions} browser assertions, ${routes.length} routes, ${screenshots.length} screenshots.`,
);
