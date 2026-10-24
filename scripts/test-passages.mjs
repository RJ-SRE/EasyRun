import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout, clearTimeout } from "node:timers";
const root = fileURLToPath(new URL("../", import.meta.url));
const server = spawn(process.execPath, ["prototypes/runlab/server.mjs"], {
  cwd: root,
  env: { ...process.env, RUNLAB_PORT: "0" },
  stdio: ["ignore", "pipe", "inherit"],
});
let child;
try {
  const url = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error("Test server timed out")),
      15000,
    );
    server.once("error", reject);
    server.stdout.on("data", (d) => {
      output += d;
      const m = output.match(/Runlab ready: (http:\/\/127\.0\.0\.1:\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
  });
  const cases = [
    ["test-passages-build.mjs", {}],
    ["test-passages.mjs", {}],
    ["test-passages-route.mjs", { MODE: "0", FEATURES: "1" }],
    ["test-passages-route.mjs", { MODE: "1" }],
  ];
  for (const [file, env] of cases) {
    console.log("Checking", file, env);
    const code = await new Promise((resolve, reject) => {
      child = spawn(process.execPath, ["prototypes/runlab/" + file], {
        cwd: root,
        env: { ...process.env, RUNLAB_URL: url, ...env },
        stdio: "inherit",
      });
      child.once("error", reject);
      child.once("exit", (c) => resolve(c ?? 1));
    });
    if (code !== 0) {
      process.exitCode = code;
      break;
    }
  }
} finally {
  child?.kill("SIGTERM");
  server.kill("SIGTERM");
}
