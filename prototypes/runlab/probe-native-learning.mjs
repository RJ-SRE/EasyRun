import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.RUNLAB_URL || "http://127.0.0.1:4177";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const results = [];
try {
  for (const [name, source] of [
    [
      "json",
      'import "encoding/json"\nonStart => { b, err := json.Marshal(map[string]int{"v":1}); println "PROBE_JSON",string(b),err }',
    ],
    [
      "http",
      'import "net/http"\nonStart => { println "PROBE_HTTP_BEGIN"; go func(){r,err:=http.Get("https://x.qiniu.com/"); if err!=nil {println "PROBE_HTTP_ERROR",err} else {println "PROBE_HTTP_STATUS",r.StatusCode; r.Body.Close()} }() }',
    ],
    ["username", 'onStart => {println "PROBE_USERNAME",username}'],
  ]) {
    const page = await browser.newPage();
    const result = { name, messages: [], error: null };
    page.on("console", (m) => {
      if (m.text().includes("PROBE_") || m.type() === "error")
        result.messages.push(m.text().slice(0, 1500));
    });
    page.on("pageerror", (e) => result.messages.push(e.message.slice(0, 1500)));
    await page.goto(base + "/runtime/runner.html");
    try {
      await page.evaluate(async (source) => {
        window.onGameError((e) => console.error("PROBE_GAME_ERROR", String(e)));
        await window.initEngine(
          Object.fromEntries(
            ["engine.zip", "game.zip", "engine.wasm", "ispx.wasm"].map((n) => [
              n,
              "/runtime/" + n,
            ]),
          ),
        );
        const encode = (s) => ({
          content: new TextEncoder().encode(s).buffer,
          lastModified: Date.now(),
        });
        await window.initGame({
          "main.spx": encode(source),
          "assets/index.json": encode(
            JSON.stringify({
              name: "Learning capability probe",
              zorder: [],
              run: { width: 480, height: 360 },
            }),
          ),
        });
        await window.startGame();
      }, source);
      await page.waitForTimeout(12000);
    } catch (e) {
      result.error = e.message.slice(0, 2500);
    }
    results.push(result);
    await page.close();
    console.log(JSON.stringify(result));
  }
} finally {
  await browser.close();
}
const folder = new URL(
  "../../docs/evidence/2026-10-31-cloud-learning/",
  import.meta.url,
);
await mkdir(folder, { recursive: true });
await writeFile(
  new URL("native-capabilities.json", folder),
  JSON.stringify(
    {
      runtime:
        "local pinned @xgo-pkgs/spx 3.3.0; not deployed XBuilder verification",
      results,
    },
    null,
    2,
  ),
);
