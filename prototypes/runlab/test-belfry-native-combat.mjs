import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
const root = new URL("./", import.meta.url),
  out = new URL(`test-results/${process.env.NATIVE_COMBAT_OUT || "native-combat"}/`, root);
await mkdir(out, { recursive: true });
const onlineRuntime =
  process.env.XBUILDER_RUNTIME_DIR && resolve(process.env.XBUILDER_RUNTIME_DIR);
const modelUrl = process.env.XBUILDER_MODEL_URL;
const initialFollow = process.env.NATIVE_SHELL_FOLLOW || "Anchor";
assert.ok(["Anchor", "ProjectCover"].includes(initialFollow));
const runtimeFiles = onlineRuntime
  ? {
      "/ispx.wasm": join(onlineRuntime, "ispx.wasm"),
      "/engineres.zip": join(onlineRuntime, "engineres.zip"),
    }
  : {};

const archive = new URL("exports/belfry.xbp", root);
const report = {
  date: new Date().toISOString(),
  modelUrl,
  initialFollow,
  runtime: onlineRuntime
    ? "deployed XBuilder compiler and resources"
    : "pinned npm runtime",
  cases: [],
  sizes: [],
  errors: [],
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  fixture: `Actual native archive without the web host. F8 selects controlled combat states and freezes simulation (presentation remains live); F7 releases the fixture. Real start, heal input, spelling, pause and title input paths are exercised. Initial config follows ${initialFollow} to reproduce an editor-saved follow target. A 480x360 resize checks fit. Fixture teleport positions the hero and camera in the real boss arena before inspecting its HUD. No online project overwritten.`,
};
const server = createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  createReadStream(runtimeFiles[req.url] || archive).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/package.xbp`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
report.browser = browser.version();
let page;
const pass = (name) => {
  report.cases.push(name);
  console.log("PASS", name);
};
async function boot(run, deviceScaleFactor = 1) {
  page = await browser.newPage({
    viewport:
      deviceScaleFactor === 2
        ? { width: 1125, height: 844 }
        : { width: 960, height: 600 },
    deviceScaleFactor,
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  await page.addInitScript(() => {
    window.nativeState = [];
    window.combatHUD = {};
    window.hudQuestion = null;
    window.nativeUI = [];
    window.nativeErrors = [];
    window.nativeMusic = [];
    const log = console.log.bind(console);
    console.log = (...args) => {
      let s = args.map(String).join(" ");
      // The deployed compiler wraps println in structured JSON logs.
      try {
        s = JSON.parse(s).msg?.trim() || s;
      } catch {
        /* plain npm log */
      }
      if (s.startsWith("@state "))
        window.nativeState = s.slice(7).split(/\s+/).map(Number);
      if (s.startsWith("@nativeUI "))
        window.nativeUI = s.slice(10).split(/\s+/).map(Number);
      if (s.startsWith("@combatHUD ")) {
        const names =
          "case phase embers heal bow blade ultimate bossLabel bossFill notice bossVisible fillVisible noticeVisible embersVisible glyphs world fx projectiles bossX bossY viewX viewY score second combo skillHeal skillBow cameraY renderY heroX heroY districtY districtVisible".split(
            " ",
          );
        const values = s
          .slice(11)
          .split(/\s+/)
          .map((v) =>
            v === "true" ? true : v === "false" ? false : Number(v),
          );
        window.combatHUD = Object.fromEntries(
          names.map((k, i) => [k, values[i]]),
        );
      }
      if (s.startsWith("@nativeQuestion ")) {
        const a = s.split(/\s+/);
        window.hudQuestion = {
          mode: Number(a[4]),
          answer: Number(a[5]) + 1,
          word: a.slice(7).join(" "),
        };
      }
      if (s.startsWith("@nativeMusic ")) window.nativeMusic.push(s);
      log(...args);
    };
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto(
    new URL(
      "/runtime/runner.html",
      process.env.RUNLAB_URL || "http://127.0.0.1:4184/",
    ).href,
  );
  assert.equal(
    await page.evaluate(() => window.devicePixelRatio),
    deviceScaleFactor,
  );
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  await page.evaluate(
    async ({ url, run, modelUrl, deployed, initialFollow }) => {
      window.onGameError((e) => window.nativeErrors.push(String(e)));
      window.onEngineCrash((e) => window.nativeErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          [
            "engine.zip",
            deployed ? "engineres.zip" : "game.zip",
            "engine.wasm",
            "ispx.wasm",
          ].map((n) => [
            n,
            deployed && ["ispx.wasm", "engineres.zip"].includes(n)
              ? url.replace("package.xbp", n)
              : "/runtime/" + n,
          ]),
        ),
      );
      let files = window.fflate.unzipSync(
        new Uint8Array(await (await fetch(url)).arrayBuffer()),
      );
      const decoder = new window.TextDecoder(),
        encoder = new window.TextEncoder();
      const config = JSON.parse(decoder.decode(files["assets/index.json"]));
      if (run) config.run = run;
      config.camera = { on: initialFollow };
      files["assets/index.json"] = encoder.encode(JSON.stringify(config));
      if (modelUrl) {
        // Pinned public deployment bundle exports SpxProject as r and File as gn.
        const { r: Project, gn: ModelFile } = await import(modelUrl);
        const project = new Project();
        await project.loadFiles(
          Object.fromEntries(
            Object.entries(files).map(([name, b]) => [
              name,
              new ModelFile(name.split("/").pop(), async () =>
                b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
              ),
            ]),
          ),
        );
        files = Object.fromEntries(
          await Promise.all(
            Object.entries(project.exportFiles()).map(async ([name, f]) => [
              name,
              new Uint8Array(await f.arrayBuffer()),
            ]),
          ),
        );
        const roundtrip = JSON.parse(
          decoder.decode(files["assets/index.json"]),
        );
        if (roundtrip.camera.on !== initialFollow)
          throw new Error("stale-follow fixture lost during model roundtrip");
        window.nativeRoundtrip = {
          run: roundtrip.run,
          camera: roundtrip.camera,
          map: roundtrip.map,
        };
      }
      let main = decoder.decode(files["main.spx"]);
      main = main.replace(
        "var (",
        "var (\n hudTestScenario int\n hudTestFrozen bool",
      );
      main = main.replace(
        "if phase==1 {\n   Hero.captureAttack()",
        "if phase==1 && !hudTestFrozen {\n   Hero.captureAttack()",
      );
      // Export wraps captureAttack in its input-lock guard.
      main = main.replace(
        "if phase==1 {\n   if nativeInputLock",
        "if phase==1 && !hudTestFrozen {\n   if nativeInputLock",
      );
      if (!main.includes("if phase==1 && !hudTestFrozen"))
        throw Error("Missing simulation fixture marker");
      main = main.replace(
        "Hero.render(visualDt)",
        "if hudTestFrozen {Hero.render(0)} else {Hero.render(visualDt)}",
      );
      main += `\nonKey KeyF7, => {hudTestFrozen=false}
      onKey KeyF8, => {
       hudTestScenario++; hudTestFrozen=true; phase=1; Hero.resetHero(230,0); shock=0; hitStop=0; cameraY=-80; cameraRenderY=-80; Camera.setXYpos 480,-80; segment=0; practice=0; cityDistrict=0; nativeCombatEventTime=0; nativeCombatEventId=0
       Hero.cancelAttack(); Hero.bowCool=0; Hero.bladeCool=0; Hero.healCool=0; Hero.ultimateCool=0; Hero.grounded=true; Hero.airAttacks=0; bindTime=0; chainOwner=-1; health=maxHealth-2; embers=1; emberHits=0
       if hudTestScenario==1 {embers=0}
       if hudTestScenario==2 {embers=2; health=maxHealth; Hero.grounded=false}
       if hudTestScenario==3 {Hero.bowCharging=true; Hero.bowCharge=0.2}
       if hudTestScenario==4 {Hero.bowCharging=true; Hero.bowCharge=0.8; Hero.charging=true; Hero.chargeTime=0.8}
       if hudTestScenario==5 {Hero.bowCool=2.2; Hero.bladeCool=1.1; Hero.healCool=0.9; Hero.ultimateCool=4.2}
       if hudTestScenario==6 || hudTestScenario==7 || hudTestScenario==8 {
        segment=1; cityDistrict=4; enemyX[keeperIndex]=600; enemyY[keeperIndex]=enemyBaseY[keeperIndex]; Hero.resetHero(380,enemyBaseY[keeperIndex]-34); cameraY=enemyBaseY[keeperIndex]+105; cameraRenderY=cameraY; Camera.setXYpos 480,cameraY; bossStage=1; bossMove=4; bossLocked=1; enemyState[keeperIndex]=1; enemyHP[keeperIndex]=bossMaxHP/2
        if hudTestScenario>=7 {bossStage=2; enemyState[keeperIndex]=2; enemyHP[keeperIndex]=bossMaxHP/4}
        if hudTestScenario==8 {wordMode=1; Hero.bowCharging=true; Hero.bowCharge=0.8; WorldLogic.requestWord(1); WorldLogic.beginWord()}
       }
       if hudTestScenario==9 {bindTime=0.7}
       if hudTestScenario==10 {chainOwner=0; wordMode=1}
       if hudTestScenario==11 {WorldLogic.enemyEvent("guardbreak",keeperIndex)}
       if hudTestScenario==12 {phase=2; elapsed=183; score=12345; kills=16; bestCombo=7; echoes=2; deaths=3}
      }\n`;
      files["main.spx"] = encoder.encode(main);
      let native = decoder.decode(files["NativeLogic.spx"]);
      native = native.replace(
        'println "@nativeUI",',
        'println "@combatHUD",hudTestScenario,phase,nativeCombatEmbers,nativeCombatHeal,nativeCombatBow,nativeCombatBlade,nativeCombatUltimate,nativeCombatBossLabel,nativeCombatBossFill,nativeCombatNotice,NativeBossPanel.uiVisible,NativeBossFill.uiVisible,NativeCombatNotice.uiVisible,NativeEmbers.uiVisible,nativeGlyphLive,sceneBorn,fxCount,projectileCount,NativeBossPanel.uiX,NativeBossPanel.uiY,viewCenterX,viewCenterY,nativeCombatScore,nativeCombatSecond,nativeCombatCombo,NativeSkill2.uiCostumeIndex,NativeSkill0.uiCostumeIndex,cameraY,cameraRenderY,Hero.px,Hero.py,District4.renderY,District4.renderVisible; println "@nativeUI",',
      );
      files["NativeLogic.spx"] = encoder.encode(native);
      await window.initGame(
        Object.fromEntries(
          Object.entries(files).map(([name, content]) => [
            name,
            {
              content: content.buffer.slice(
                content.byteOffset,
                content.byteOffset + content.byteLength,
              ),
              lastModified: Date.now(),
            },
          ]),
        ),
      );
      await window.startGame();
    },
    { url, run, modelUrl, deployed: Boolean(onlineRuntime), initialFollow },
  );
  await page.waitForFunction(
    () => window.nativeUI.length > 0 || window.nativeErrors.length > 0,
    null,
    { timeout: 90000 },
  );
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  await page.waitForTimeout(400);
}
async function tap(key) {
  await page.keyboard.press(key, { delay: 70 });
}
async function state(phase, panel) {
  await page.waitForFunction(
    ({ phase, panel }) =>
      window.nativeState[0] === phase &&
      (panel === undefined || window.nativeUI[0] === panel),
    { phase, panel },
    { timeout: 15000 },
  );
}
const shot = async (name) =>
  page.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });
const hud = () => page.evaluate(() => window.combatHUD);
async function scenario(n) {
  await tap("F8");
  await page.waitForFunction((n) => window.combatHUD.case === n, n);
  // Engine camera smoothing continues after a test teleport. Inspect only
  // after its real viewport reaches the frozen authored center.
  await page.waitForFunction(
    () => Math.abs(window.combatHUD.viewY - window.combatHUD.renderY) < 0.05,
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(150);
  const values = await hud();
  report.scenarios ??= [];
  report.scenarios.push(values);
  return values;
}
try {
  await boot();
  await state(0, 0);
  assert.equal((await hud()).embersVisible, false);
  pass("new combat-only layers stay hidden on the unchanged title");
  await tap("Enter");
  await state(1);
  await page.waitForFunction(() => window.combatHUD.heal === 35);
  assert.equal((await hud()).world, 121);
  await tap("i");
  await page.waitForFunction(() => window.combatHUD.notice === 13);
  await shot("exploration");
  await page.mouse.click(100, 106, { delay: 80 });
  await state(4, 6);
  await tap("Tab");
  await state(1);
  pass(
    "moved inscription progress remains clickable and resumes combat after ledger close",
  );
  pass(
    "real full-health heal input explains unavailability; no added world clones",
  );
  let h = await scenario(1);
  assert.equal(h.embers, 0);
  assert.equal(h.heal, 36);
  assert.equal(h.skillHeal, 36);
  h = await scenario(2);
  assert.equal(h.embers, 14);
  assert.equal(h.heal, 37);
  pass(
    "empty/full ember states, healing reasons and airborne priority match actual conditions",
  );
  h = await scenario(3);
  assert.equal(h.bow, 32);
  assert.equal(h.notice, 4);
  h = await scenario(4);
  assert.equal(h.bow, 33);
  assert.equal(h.blade, 33);
  h = await scenario(5);
  assert.deepEqual([h.bow, h.blade, h.heal, h.ultimate], [22, 11, 9, 42]);
  await shot("cooldowns");
  pass(
    "charging, full charge and all four 0.1-second cooldown costumes update without enlarging cards",
  );
  h = await scenario(6);
  assert.equal(h.bossVisible, true);
  assert.equal(h.fillVisible, true);
  assert.equal(h.bossLabel, 57);
  assert.equal(h.bossFill, 50);
  assert.ok(Math.abs(h.bossX - h.viewX) < 0.1);
  assert.ok(Math.abs(h.bossY - h.viewY - 244) < 0.1);
  await shot("boss-locked");
  h = await scenario(7);
  assert.equal(h.bossLabel, 82);
  assert.equal(h.bossFill, 25);
  await shot("boss-opening");
  pass(
    "boss form, locked windup, punish window and health use live combat state at fixed screen coordinates",
  );
  await page.setViewportSize({ width: 480, height: 360 });
  await page.waitForTimeout(500);
  await shot("boss-small");
  h = await hud();
  assert.ok(Math.abs(h.bossX - h.viewX) < 0.1);
  assert.ok(h.glyphs < 100);
  await page.setViewportSize({ width: 960, height: 600 });
  await page.waitForTimeout(400);
  pass("small 4:3 viewport keeps the boss HUD within the authored field");
  h = await scenario(8);
  assert.equal(h.phase, 5);
  assert.equal(h.bossVisible, true);
  assert.ok(Math.abs(h.bossX - h.viewX - 280) < 0.1);
  assert.ok(Math.abs(h.bossY - h.viewY - 98) < 0.1);
  assert.equal(h.noticeVisible, false);
  assert.equal(h.bow, 31);
  assert.ok(h.world + h.glyphs + h.fx + h.projectiles < 300);
  await shot("question");
  const q = await page.evaluate(() => window.hudQuestion);
  await page.waitForTimeout(250);
  if (q.mode === 0) await page.keyboard.type(q.word, { delay: 50 });
  else await tap(String(q.answer));
  await page.waitForFunction(
    () => window.combatHUD.phase === 1 && window.combatHUD.bow === 30,
  );
  assert.equal((await hud()).bossVisible, true);
  pass(
    "question keeps the boss HUD below the word card; a correct answer releases normally and restores its normal position",
  );
  h = await scenario(9);
  assert.equal(h.notice, 1);
  assert.equal(h.heal, 38);
  h = await scenario(10);
  assert.equal(h.notice, 3);
  h = await scenario(11);
  assert.equal(h.notice, 10);
  await shot("guard-break");
  await tap("Escape");
  await state(4);
  await page.waitForFunction(
    () => window.combatHUD.phase === 4 && !window.combatHUD.noticeVisible,
  );
  assert.equal((await hud()).noticeVisible, false);
  await tap("Escape");
  await state(1);
  pass(
    "bind, tether and guard-break feedback remain readable; pause hides battle layers",
  );
  h = await scenario(12);
  assert.equal(h.bossVisible, false);
  assert.equal(h.embersVisible, false);
  assert.equal(h.second, 183);
  assert.equal(h.score, 12345);
  await shot("results");
  await tap("m");
  await state(0);
  assert.equal((await hud()).embersVisible, false);
  await tap("F7");
  await tap("Enter");
  await state(1);
  await page.waitForFunction(() => window.combatHUD.score === 0);
  pass(
    "results expose run statistics; returning to title and starting again clears previous combat displays",
  );
  report.finalHUD = await hud();
  assert.deepEqual(await page.evaluate(() => window.nativeErrors), []);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.errors.push(e.stack);
  if (page) report.failedHUD = await hud();
  console.error(e);
  if (page) await shot("error");
  process.exitCode = 1;
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
