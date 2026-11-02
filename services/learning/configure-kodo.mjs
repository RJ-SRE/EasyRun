// Run with --env-file; credentials are never command-line values or console output.
import { readFile, writeFile, chmod } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve, relative, sep } from "node:path";
import { discoverKodo, kodoOptions } from "./kodo-config.mjs";
const path = resolve(process.argv[2] || ".local/learning/kodo.env");
const local = relative(resolve(".local"), path);
if (!local || local.startsWith(".." + sep) || local === "..")
  throw Error("Use a Git-ignored .local configuration path");
try {
  const prior = parseEnv(await readFile(path, "utf8"));
  const found = await discoverKodo(kodoOptions(prior));
  const values = {
    ...prior,
    LEARNING_ENV: "development",
    LEARNING_HOST: "127.0.0.1",
    LEARNING_PORT: "4191",
    LEARNING_STORE: "kodo",
    LEARNING_PROFILE_MODE: prior.LEARNING_PROFILE_MODE || "username",
    LEARNING_JOURNAL_DIR: ".local/learning/kodo-journal",
    KODO_REGION: found.region,
    KODO_UPLOAD_ORIGIN: found.uploadOrigin,
    KODO_PRIVATE_READ_ORIGIN: found.privateReadOrigin,
    KODO_MANAGEMENT_ORIGIN: found.managementOrigin,
    KODO_CONTROL_ORIGIN: found.controlOrigin,
  };
  await writeFile(
    path,
    Object.entries(values)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  await chmod(path, 0o600);
  console.log(
    JSON.stringify({
      configured: true,
      bucket: prior.KODO_BUCKET,
      ...found,
      config: path,
      identityConfigured: false,
    }),
  );
} catch (error) {
  // Never serialize fetch requests/headers or signed URLs on failure.
  console.error(
    JSON.stringify({
      configured: false,
      code: error.code || "KODO_CONFIGURATION_FAILED",
    }),
  );
  process.exitCode = 1;
}
