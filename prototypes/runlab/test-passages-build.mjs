import { mkdtemp, cp, mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../../", import.meta.url));
await mkdir(path.join(root, ".cache"), { recursive: true });
const clean = await mkdtemp(path.join(root, ".cache/passages-clean-"));
try {
  const module = path.join(clean, "prototypes/runlab");
  const tracked = [
    "build-passages.mjs",
    "passages-level.mjs",
    "spx/passages",
    "art/belfry/clockwell.png",
    "art/belfry/ledge.png",
    "art/belfry/actions-source.png",
    "art/rupture-v2/wanderer-atlas.png",
    "art/rupture-v2/run-cycle-v3.png",
  ];
  for (const p of tracked) {
    await mkdir(path.dirname(path.join(module, p)), { recursive: true });
    await cp(path.join(root, "prototypes/runlab", p), path.join(module, p), {
      recursive: true,
    });
  }
  await mkdir(path.join(module, "public"), { recursive: true });
  const result = spawnSync(
    process.execPath,
    [path.join(module, "build-passages.mjs")],
    { stdio: "inherit", timeout: 60000 },
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "clean build exits successfully");
  const actual = JSON.parse(
    await readFile(path.join(module, "public/passages.json"), "utf8"),
  );
  const expected = JSON.parse(
    await readFile(
      path.join(root, "prototypes/runlab/public/passages.json"),
      "utf8",
    ),
  );
  assert.deepEqual(actual, expected, "source-only build matches normal build");
  console.log(
    `PASS clean source build: ${Object.keys(actual).length} identical files, no combat frame cache`,
  );
} finally {
  await rm(clean, { recursive: true, force: true });
}
