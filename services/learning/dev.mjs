// Development startup creates local secrets, never a fake login endpoint.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
await mkdir(new URL("../../.local/learning/", import.meta.url), {
  recursive: true,
  mode: 0o700,
});
const path = new URL("../../.local/learning/keys.json", import.meta.url);
let keys;
try {
  keys = JSON.parse(await readFile(path, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  keys = {
    LEARNING_PLAYER_MAPPING_KEY: randomBytes(32).toString("hex"),
    LEARNING_SESSION_KEY: randomBytes(32).toString("hex"),
  };
  await writeFile(path, JSON.stringify(keys), { mode: 0o600, flag: "wx" });
}
const child = spawn(process.execPath, ["services/learning/server.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...keys, ...process.env },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
