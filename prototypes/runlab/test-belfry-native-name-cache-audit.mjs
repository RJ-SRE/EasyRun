// Isolated reproduction of the shipped native methods. Snapshot/learning helpers
// are stubbed because archive serialization does not affect the capacity guard.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const source = await readFile(
  new URL("spx/belfry/NativeCloud.spx", import.meta.url),
  "utf8",
);
const fields = source
  .slice(source.indexOf("var ("), source.indexOf("\n)\n") + 3)
  .replace("var (", "var (\n phase int");
const method = (name) => {
  const start = source.indexOf(`func ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf("\nfunc ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
};
const old = "p_" + "a".repeat(64),
  next = "p_" + "f".repeat(64);
const game = `${fields}
func nativeCloudSnapshot() string {return "{}"}
func nativeCloudRestore(raw string) {}
func initNativeLearning() {}
func nativeLearningShuffle() {}
func nativeCloudNotice(s string) {nativeCloudStatus=s}
${method("nativeCloudSwitch")}
${method("nativeNameBlocked")}
onStart => {
 nativeNameMode=true; nativeCloudURL="https://unused.invalid"
 nativeNameObserved="new-name"; nativeNameConnected="new-name"
 nativeCloudAccount="${old}"; nativeCloudReady=true
 nativeCloudArchives=map[string]string{}
 for _,s:=range []string{${["a", "b", "c", "d"].map((c) => JSON.stringify("p_" + c.repeat(64))).join(",")}} {nativeCloudArchives[s]="{}"}
 nativeCloudPendingAccount="${next}"; nativeCloudPendingSession="test-session"; nativeCloudAttachPending=true
 nativeCloudSwitch()
 println "AUDIT_CACHE_FULL",nativeCloudAccount=="${old}",nativeNameBlocked(),nativeCloudStatus
}
`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const report = {
  date: new Date().toISOString(),
  kind: "isolated native methods, helper stubs, no cloud writes",
  reproduced: false,
  messages: [],
  errors: [],
};
try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.text().includes("AUDIT_CACHE_FULL")) report.messages.push(m.text());
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4177") +
      "/runtime/runner.html",
  );
  await page.evaluate(async (game) => {
    window.onGameError((e) =>
      console.error("AUDIT_CACHE_FULL_ERROR", String(e)),
    );
    await window.initEngine(
      Object.fromEntries(
        ["engine.zip", "game.zip", "engine.wasm", "ispx.wasm"].map((n) => [
          n,
          "/runtime/" + n,
        ]),
      ),
    );
    const file = (text) => ({
      content: new window.TextEncoder().encode(text).buffer,
      lastModified: Date.now(),
    });
    await window.initGame({
      "main.spx": file(game),
      "assets/index.json": file(
        JSON.stringify({
          name: "Name archive audit",
          zorder: [],
          run: { width: 480, height: 360 },
        }),
      ),
    });
    await window.startGame();
  }, game);
  await page.waitForTimeout(1000);
  assert.deepEqual(report.errors, []);
  report.reproduced = report.messages.some(
    (s) => s.includes("true false") && s.includes("账号缓存已满"),
  );
  assert.equal(report.reproduced, true);
} finally {
  await browser.close();
  const folder = new URL(
    "../../docs/evidence/2026-10-31-xbuilder-audit/",
    import.meta.url,
  );
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL("native-name-cache-capacity.json", folder),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
