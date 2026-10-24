import { spawn } from "node:child_process";
import { setTimeout, clearTimeout } from "node:timers";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(new URL("../prototypes/runlab/test-results/", import.meta.url), {
  recursive: true,
});
const server = spawn(process.execPath, ["prototypes/runlab/server.mjs"], {
  cwd: root,
  env: { ...process.env, RUNLAB_PORT: "0" },
  stdio: ["ignore", "pipe", "inherit"],
});
const ready = new Promise((resolve, reject) => {
  let text = "";
  const timeout = setTimeout(
    () => reject(new Error("Test server startup timed out")),
    20000,
  );
  server.on("error", (e) => {
    clearTimeout(timeout);
    reject(e);
  });
  server.once("exit", (code) => {
    clearTimeout(timeout);
    reject(new Error(`Test server exited: ${code}`));
  });
  server.stdout.on("data", (chunk) => {
    text += chunk.toString();
    const match = text.match(/Runlab ready: (http:\/\/127\.0\.0\.1:\d+)/);
    if (match) {
      clearTimeout(timeout);
      resolve(match[1]);
    }
  });
});
let child;
function stop() {
  child?.kill("SIGTERM");
  server.kill("SIGTERM");
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stop();
    process.exitCode = 1;
  });
try {
  const url = await ready;
  const checks = process.argv.includes("--legacy")
    ? [{ file: "playtest.mjs" }]
    : [
        { file: "test-belfry.mjs" },
        {
          file: "test-belfry-route.mjs",
          env: { MODE: "0", RETURN_FAILURE: "1" },
        },
        {
          file: "test-belfry-route.mjs",
          env: { MODE: "1", RETURN_FAILURE: "0" },
        },
        { file: "test-rupture.mjs" },
        { file: "test-motion-lifecycle.mjs" },
      ];
  for (const { file, env = {} } of checks) {
    console.log(`Checking ${file} at isolated server ${url}`);
    const code = await new Promise((resolve, reject) => {
      child = spawn(process.execPath, [`prototypes/runlab/${file}`], {
        cwd: root,
        env: { ...process.env, RUNLAB_URL: url, ...env },
        stdio: "inherit",
      });
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });
    if (code !== 0) {
      process.exitCode = code;
      break;
    }
  }
} finally {
  stop();
}
