import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const steps = [
  ["prototypes/runlab/extract-frames.mjs"],
  ["prototypes/runlab/extract-frames.mjs", "--run"],
  ["prototypes/runlab/build-games.mjs"],
  ["prototypes/runlab/build-rupture.mjs"],
  ["prototypes/runlab/build-belfry.mjs"],
];
for (const args of steps) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
