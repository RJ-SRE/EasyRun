import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium, webkit } from "@playwright/test";

const checks = [];
function add(name, ok, detail, required = true) {
  checks.push({ name, ok, detail, required });
  console.log(`${ok ? "OK" : required ? "FAIL" : "INFO"}  ${name}: ${detail}`);
}
function command(name, args, required = true) {
  const result = spawnSync(name, args, { encoding: "utf8" });
  add(
    name,
    !result.error && result.status === 0,
    (result.stdout || result.stderr || result.error?.message || "")
      .trim()
      .split("\n")[0],
    required,
  );
}
const expectedNode = readFileSync(".node-version", "utf8").trim();
add(
  "Node",
  process.version === `v${expectedNode}`,
  `${process.version} (${process.execPath})`,
);
const manager = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
add(
  "pnpm",
  manager.status === 0 && manager.stdout.trim() === "11.9.0",
  manager.stdout.trim() || "not installed",
);
command("git", ["--version"]);
command("go", ["version"], false);
command("ffmpeg", ["-version"]);
command("ffprobe", ["-version"]);
for (const [name, browser] of [
  ["Chromium", chromium],
  ["WebKit", webkit],
]) {
  add(name, existsSync(browser.executablePath()), browser.executablePath());
}
for (const app of ["Google Chrome", "Visual Studio Code"]) {
  const path = `/Applications/${app}.app`;
  add(app, existsSync(path), path, false);
}
const spxFile = "node_modules/@xgo-pkgs/spx/package.json";
const spxVersion = existsSync(spxFile)
  ? JSON.parse(readFileSync(spxFile, "utf8")).version
  : "missing";
add("spx reference runtime", spxVersion === "3.3.0", spxVersion);
const source = spawnSync(
  "git",
  ["-C", ".tools/xbuilder", "rev-parse", "HEAD"],
  { encoding: "utf8" },
);
add(
  "XBuilder reference source",
  source.status === 0 &&
    source.stdout.trim() === "e2a4c45dfa0574ac7700fad94d2d4a6da7da8083",
  source.stdout.trim() || "missing",
);
mkdirSync(".cache", { recursive: true });
writeFileSync(
  ".cache/environment-report.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "\nActual microphone/ASR and XBuilder game integration require separate hands-on verification.",
);
process.exitCode = checks.some((check) => check.required && !check.ok) ? 1 : 0;
