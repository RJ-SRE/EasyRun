import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { WORDS } from "./public/common-words.js";
const root = new URL("./", import.meta.url),
  out = new URL(
    `test-results/${process.env.BOSS_TEST_OUT || "boss-rework"}/`,
    root,
  );
await mkdir(out, { recursive: true });
const archive = new URL("exports/belfry.xbp", root),
  runtime = resolve(".cache/xbuilder-online-20261026");
const server = createServer((req, res) => {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": req.url.endsWith(".wasm")
      ? "application/wasm"
      : "application/zip",
  });
  createReadStream(
    ["/ispx.wasm", "/engineres.zip"].includes(req.url)
      ? join(runtime, req.url.slice(1))
      : archive,
  ).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const packageURL = `http://127.0.0.1:${server.address().port}/package.xbp`;
const b = await chromium.launch({ headless: true, channel: "chromium" }),
  p = await b.newPage({ viewport: { width: 960, height: 600 } }),
  report = {
    cases: [],
    errors: [],
    archiveSha256: createHash("sha256")
      .update(await readFile(archive))
      .digest("hex"),
  };
p.on("pageerror", (e) => report.errors.push(e.message));
const pass = (s) => {
  report.cases.push(s);
  console.log("PASS", s);
};
await p.addInitScript(() => {
  window.bossProbes = [];
  window.bossQuestions = [];
  window.bossErrors = [];
  window.bossEvents = [];
  window.bossAnswers = [];
  const log = console.log.bind(console);
  console.log = (...args) => {
    let s = args.map(String).join(" ");
    try {
      s = JSON.parse(s).msg?.trim() || s;
    } catch {
      /* unstructured engine log */
    }
    if (s.startsWith("@nativeAnswer ")) window.bossAnswers.push(s);
    if (s.startsWith("@enemyEvent ")) window.bossEvents.push(s);
    if (s.startsWith("@bossProbe "))
      window.bossProbes.push(JSON.parse(s.slice(11)));
    if (s.startsWith("@bossGolden "))
      window.bossGolden = JSON.parse(s.slice(12));
    if (s.startsWith("@nativeQuestion "))
      window.bossQuestions.push(s.slice(16).trim().split(/\s+/));
    log(...args);
  };
});
async function tap(key) {
  await p.keyboard.down(key);
  await p.waitForTimeout(65);
  await p.keyboard.up(key);
  await p.waitForTimeout(90);
}
async function probe() {
  const n = await p.evaluate(() => window.bossProbes.length);
  await p.keyboard.down("F8");
  await p.waitForTimeout(35);
  await p.keyboard.up("F8");
  await p.waitForFunction((n) => window.bossProbes.length > n, n);
  return p.evaluate(() => window.bossProbes.at(-1));
}
async function until(fn) {
  let s;
  const stop = Date.now() + 15000;
  while (Date.now() < stop) {
    s = await probe();
    if (fn(s)) return s;
    await p.waitForTimeout(40);
  }
  throw Error("boss state timeout " + JSON.stringify(s));
}
async function shot(name) {
  await p.screenshot({ path: fileURLToPath(new URL(name + ".png", out)) });
}
async function question(key) {
  const before = await p.evaluate(() => window.bossQuestions.length);
  await p.keyboard.down(key);
  await p.waitForTimeout(650);
  await p.keyboard.up(key);
  await p.waitForFunction((n) => window.bossQuestions.length > n, before);
  await p.waitForTimeout(220);
  return p.evaluate(() => window.bossQuestions.at(-1));
}
async function answer(q, correct = true) {
  if (Number(q[3]) === 0) {
    const word = WORDS[Number(q[2])].word;
    await p.keyboard.type(correct ? word : word[0] === "z" ? "x" : "z", {
      delay: 35,
    });
  } else await tap(String(((Number(q[4]) + (correct ? 0 : 1)) % 3) + 1));
  return until((s) => s.phase === 1);
}
try {
  await p.goto(
    (process.env.RUNLAB_URL || "http://127.0.0.1:4188") +
      "/runtime/runner.html",
  );
  await p.addScriptTag({ url: "/runtime/fflate.js" });
  await p.evaluate(
    async ({ packageURL }) => {
      window.onGameError((e) => window.bossErrors.push(String(e)));
      window.onEngineCrash((e) => window.bossErrors.push(String(e)));
      await window.initEngine(
        Object.fromEntries(
          ["engine.zip", "engineres.zip", "engine.wasm", "ispx.wasm"].map(
            (n) => [
              n,
              ["engineres.zip", "ispx.wasm"].includes(n)
                ? packageURL.replace("package.xbp", n)
                : "/runtime/" + n,
            ],
          ),
        ),
      );
      const files = window.fflate.unzipSync(
          new Uint8Array(await (await fetch(packageURL)).arrayBuffer()),
        ),
        enc = new window.TextEncoder(),
        dec = new window.TextDecoder();
      const roster = JSON.parse(dec.decode(files["assets/index.json"])).zorder;
      for (const name of ["KeeperAtmosphere", "KeeperRegalia", "KeeperRitual"])
        if (roster.includes(name))
          throw Error("Rejected Boss decoration still bundled: " + name);
      const background = JSON.parse(
        dec.decode(files["assets/sprites/District4/index.json"]),
      );
      if (background.costumes.length !== 1)
        throw Error("Arena must keep one original background");
      files["WorldLogic.spx"] = enc.encode(
        dec
          .decode(files["WorldLogic.spx"])
          .replace(/onStart => \{hide\}\s*$/, "") +
          `
func bossTestFixture(stage int,mend bool) {
 startRun(); segment=1; checkpoint=14; bossShield=0; bossStage=stage; bossDecision=2; bossMendCooldown=999
 for i:=0;i<len(enemyHP);i++ {enemyHP[i]=0}
 i:=keeperIndex; clearEnemyMotion(i); enemyHP[i]=keeperMendCap()-12; bossHP=enemyHP[i]; enemyX[i]=620; enemyY[i]=enemyBaseY[i]; enemyState[i]=0; enemyClock[i]=0; enemyMark[i]=0
 Hero.resetHero(535,enemyBaseY[i]-34); Hero.facing=90; Hero.grounded=true; Hero.invulnerable=999; health=6; embers=2; hitStop=0; wordMode=1
 cameraY=enemyBaseY[i]+105; cameraRenderY=cameraY; Camera.setXYpos 480,cameraY
 clearKeeperDanger(); if mend {beginKeeperMend()}
}
func bossTestGolden() {
 bossTestFixture(0,true); i:=keeperIndex; wordVisualPaused=false; phase=5; before:=enemyHP[i]
 for n:=0;n<30;n++ {updateKeeperMending(0.1)}; during:=enemyHP[i]; age:=bossMendAge
 phase=4; for n:=0;n<20;n++ {updateKeeperMending(0.1)}; paused:=bossMendAge==age
 phase=5; wordVisualPaused=true; for n:=0;n<20;n++ {updateKeeperMending(0.1)}; pausedWord:=bossMendAge==age
 wordVisualPaused=false; phase=1; keeperSkillImpact(i,4,100); keeperSkillImpact(i,4,100); one:=bossMendHits
 keeperSkillImpact(i,3,101); noHealSkill:=bossMendHits==one; keeperSkillImpact(i,2,102); broken:=enemyState[i]==2
 bossTestFixture(1,true); enemyHP[i]=keeperMendCap()-1; phase=5; for n:=0;n<110;n++ {updateKeeperMending(0.1)}; capped:=enemyHP[i]==keeperMendCap() && bossStage==1
 bossTestFixture(2,false); enemyHP[i]=1; bossMendUsed[2]=2; bossMendCooldown=0; finite:=!keeperCanMend()
 bossTestFixture(2,true); enemyHP[i]=0; phase=5; for n:=0;n<110;n++ {updateKeeperMending(0.1)}; dead:=enemyHP[i]==0
 bossTestFixture(1,true); strikeEnemy(i,99,7); transitioned:=bossStage==2 && enemyState[i]==6 && enemyHP[i]==bossMaxHP/3
 difficulty=1; bossTestFixture(0,true); phase=5; for n:=0;n<100;n++ {updateKeeperMending(0.1)}; hard:=bossMaxHP==90 && bossMendDuration==8.5 && bossMendHealed==8
 difficulty=0; bossTestFixture(2,false); phase=1; health=8; Hero.invulnerable=0; clearKeeperDanger(); keeperLine(180,enemyBaseY[i]-6,780,enemyBaseY[i]-6,0.3,0.18,11,5)
 updateKeeperDanger(0.1); warning:=health==8; updateKeeperDanger(0.21); damaging:=health==7; Hero.invulnerable=0; updateKeeperDanger(0.02); once:=health==7
 bossTestFixture(2,false); phase=1; prepareKeeperMove(6); lockKeeperAttack(); enterEnemyState(i,3); enemyClock[i]=0.4; keeperChain(0.4,0); Hero.px=bossBladeX; Hero.py=bossBladeY-28
 deflect:=keeperDeflectBlade(Hero.px,Hero.py+28,133,90) && enemyState[i]==2 && enemyRecover[i]>=0.7
 bossTestFixture(0,false); phase=1; health=8; Hero.invulnerable=0; Hero.py=enemyY[i]-28; prepareKeeperMove(0); for n:=0;n<6;n++ {updateKeeper(0.1); updateKeeperDanger(0.1)}; noTellDamage:=health==8
 lockKeeperAttack(); enterEnemyState(i,3); keeperStrokeEvent(); updateKeeper(0.08); updateKeeperDanger(0.01); sweepHit:=health==7
 Hero.invulnerable=0; updateKeeper(0.03); updateKeeperDanger(0.01); sweepOnce:=health==7
 bossTestFixture(1,false); phase=1; prepareKeeperMove(3); lockKeeperAttack(); enterEnemyState(i,3); updateKeeper(0.22); secondTell:=enemyState[i]==1 && bossChain==1 && bossWindup>=0.39
 for n:=0;n<3;n++ {updateKeeper(0.1)}; secondTell=secondTell && enemyState[i]==1
 bossTestFixture(2,false); phase=1; prepareKeeperMove(8); lockKeeperAttack(); enterEnemyState(i,3); followCount:=0; oldChain:=0
 for n:=0;n<160;n++ {updateKeeper(0.02); if bossChain>oldChain {followCount++; oldChain=bossChain}; if enemyState[i]==2 {
 break
}}
 triple:=followCount==2 && enemyState[i]==2 && enemyRecover[i]>=1.2
 finiteAI:=true; for stage:=0;stage<3;stage++ {bossTestFixture(stage,false); bossRecent=nil; last:=-1; repeats:=0; for n:=0;n<40;n++ {move:=keeperChoose(); if move<stage*3 || move>=stage*3+3 {finiteAI=false}; if move==last {repeats++} else {repeats=1}; if repeats>2 {finiteAI=false}; last=move}}
 bossTestFixture(2,false); Hero.px=200; bossFootCooldown=999; walkX:=enemyX[i]; for n:=0;n<5;n++ {updateKeeper(0.016)}; agileWalk:=walkX-enemyX[i]>6 && abs(enemyVX[i])>150
 bossTestFixture(1,false); bossFootCooldown=0; enemyClock[i]=0.17; startX:=enemyX[i]; startY:=enemyY[i]; updateKeeper(0.02); backstep:=enemyState[i]==5
 for n:=0;n<14;n++ {updateKeeper(0.02)}; backstep=backstep && enemyState[i]==2 && enemyX[i]-startX>80 && enemyX[i]-startX<120 && abs(enemyY[i]-startY)<0.01 && bossFootCooldown>1.5
 for _,life:=range keeperLife {if life>0 {backstep=false}}
 bossTestFixture(1,false); prepareKeeperMove(4); lockKeeperAttack(); enterEnemyState(i,3); updateKeeper(0.21); counterTell:=enemyState[i]==1 && bossChain==1 && bossWindup>=0.39 && enemyFacing[i]>0
 lockedX:=enemyX[i]; Hero.px=900; for n:=0;n<15;n++ {updateKeeper(0.02)}; counterTell=counterTell && enemyState[i]==1 && enemyX[i]==lockedX && enemyFacing[i]>0
 for n:=0;n<20;n++ {updateKeeper(0.02)}; counterTell=counterTell && enemyState[i]==2 && enemyRecover[i]>=0.8
 bossTestFixture(1,false); prepareKeeperMove(5); lockKeeperAttack(); enterEnemyState(i,3); startY=enemyY[i]; peakY:=startY; for n:=0;n<21;n++ {updateKeeper(0.02); peakY=math.Max(peakY,enemyY[i])}; vaultCut:=peakY-startY>40 && abs(enemyY[i]-startY)<0.01 && enemyState[i]==2
 println "@bossGolden",NativeLogic.nativeCloudJSON(map[string]any{"agileWalk":agileWalk,"backstep":backstep,"counterTell":counterTell,"vaultCut":vaultCut,"deflect":deflect,"noTellDamage":noTellDamage,"sweepHit":sweepHit,"sweepOnce":sweepOnce,"secondTell":secondTell,"triple":triple,"finiteAI":finiteAI,"before":before,"during":during,"paused":paused,"pausedWord":pausedWord,"sameCast":one,"noHealSkill":noHealSkill,"broken":broken,"capped":capped,"finite":finite,"dead":dead,"transitioned":transitioned,"hard":hard,"warning":warning,"damaging":damaging,"once":once})
 phase=0
}
func bossTestProbe() {println "@bossProbe",NativeLogic.nativeCloudJSON(map[string]any{"blendBorn":bossTestBlendBorn,"blendLive":bossTestBlendLive,"bodySize":bossTestSize,"bodyGhost":bossTestGhost,"phase":phase,"segment":segment,"stage":bossStage,"state":enemyState[keeperIndex],"hp":enemyHP[keeperIndex],"max":bossMaxHP,"age":bossMendAge,"duration":bossMendDuration,"hits":bossMendHits,"used":bossMendUsed[bossStage],"elapsed":elapsed,"x":enemyX[keeperIndex],"y":enemyY[keeperIndex],"move":bossMove,"wordPaused":wordVisualPaused,"wordPending":wordPending,"bossVisible":nativeCombatBoss,"cast":skillCastSerial,"hx":Hero.px,"hy":Hero.py,"attack":Hero.attackKind,"attackAge":Hero.attackAge,"bx":Hero.bladeX,"by":Hero.bladeY,"clock":enemyClock[keeperIndex],"projectiles":projectileCount,"backdrop":District4.renderCostumeIndex,"light":District4.renderLightValue,"reduced":menuReduced})}
`,
      );
      files["Enemy.spx"] = enc.encode(
        dec
          .decode(files["Enemy.spx"])
          .replace(
            "renderGhost ghost",
            "if kind==3 {bossTestSize=size; bossTestGhost=ghost}; renderGhost ghost",
          ),
      );
      files["EnemyBlend.spx"] = enc.encode(
        dec
          .decode(files["EnemyBlend.spx"])
          .replace(
            "i:=int(p[0]);",
            "i:=int(p[0]); counted:=enemyType[i]==3; if counted {bossTestBlendBorn++; bossTestBlendLive++};",
          )
          .replace(
            "fxCount--; die",
            "if counted {bossTestBlendLive--}; fxCount--; die",
          ),
      );
      files["main.spx"] = enc.encode(
        dec
          .decode(files["main.spx"])
          .replace(
            "var (",
            "var (\n bossTestBlendBorn int\n bossTestBlendLive int\n bossTestSize float64\n bossTestGhost float64\n bossTestMove int",
          ) +
          `
onKey KeyF1, => {WorldLogic.bossTestFixture(0,true)}
onKey KeyF2, => {WorldLogic.bossTestFixture(1,true)}
onKey KeyF3, => {WorldLogic.bossTestFixture(2,true)}
onKey KeyF4, => {WorldLogic.bossTestGolden()}
onKey KeyF5, => {WorldLogic.bossTestFixture(0,true); wordMode=0}
onKey KeyF6, => {WorldLogic.bossTestFixture(bossTestMove/3,false); wordMode=0; WorldLogic.prepareKeeperMove(bossTestMove)}
onKey KeyF7, => {bossTestMove=(bossTestMove+1)%9}
onKey KeyF8, => {WorldLogic.bossTestProbe()}
onKey KeyF9, => {enemyState[keeperIndex]=0; enemyClock[keeperIndex]=-10; bossMendCooldown=999; nativeTextMemoKnown=false}
onKey KeyF10, => {if bossStage<2 {WorldLogic.transformKeeper(bossStage+1)}}
onKey KeyF11, => {menuReduced=!menuReduced}
onKey KeyF12, => {enemyHP[keeperIndex]=0; bossHP=0; segment=2}
`,
      );
      await window.initGame(
        Object.fromEntries(
          Object.entries(files).map(([n, v]) => [
            n,
            {
              content: v.buffer.slice(
                v.byteOffset,
                v.byteOffset + v.byteLength,
              ),
              lastModified: Date.now(),
            },
          ]),
        ),
      );
      window.xbuilder_set_username("BossReworkTest");
      await window.startGame();
    },
    { packageURL },
  );
  await p.locator("#game-canvas").focus();
  await until((s) => s.phase === 0);
  if (process.env.BOSS_GHOST_PROBE === "1") {
    const samples = [];
    for (let move = 0; move < 9; move++) {
      if (move >= 3) {
        await tap("F6");
        for (let n = 0; n < 8; n++) {
          samples.push(await probe());
          await p.waitForTimeout(65);
        }
      }
      await tap("F7");
    }
    const peak = Math.max(...samples.map((s) => s.blendLive));
    const born = Math.max(...samples.map((s) => s.blendBorn));
    report.ghost = { peak, born, samples };
    console.log("GHOST", JSON.stringify({ peak, born }));
    if (process.env.BOSS_EXPECT_CLEAN === "1") {
      assert.equal(born, 0);
      assert.equal(peak, 0);
      assert.ok(samples.every((s) => s.bodyGhost === 0 && s.bodySize <= 0.44));
      pass(
        "Both later forms stay opaque and never allocate body ghosts while switching and dashing",
      );
    }
    await shot("ghost-probe");
  } else {
    await tap("F4");
    await p.waitForFunction(() => window.bossGolden);
    const g = await p.evaluate(() => window.bossGolden);
    assert.ok(g.during > g.before);
    for (const k of [
      "agileWalk",
      "backstep",
      "counterTell",
      "vaultCut",
      "deflect",
      "noTellDamage",
      "sweepHit",
      "sweepOnce",
      "secondTell",
      "triple",
      "finiteAI",
      "paused",
      "pausedWord",
      "noHealSkill",
      "broken",
      "capped",
      "finite",
      "dead",
      "transitioned",
      "hard",
      "warning",
      "damaging",
      "once",
    ])
      assert.equal(g[k], true, k);
    assert.equal(g.sameCast, 1);
    pass(
      "Agile approach, bounded non-damaging backstep, independently warned reverse slash and supported rising cut pass",
    );
    pass(
      "real-time healing advances during word focus, pauses explicitly, caps at its current form, has finite charges and never resurrects",
    );
    pass(
      "one ultimate cast counts once; healing skills cannot interrupt; two distinct offensive casts break the channel",
    );
    pass(
      "hard mode uses its own heal timing and budget; phase thresholds cancel healing; warning capsules deal damage only once after commitment",
    );
    pass(
      "physical sweep collision hits once, warnings cannot damage, planted chain blade is deflectable, follow-up strikes have independent tells and AI stays inside its form repertoire",
    );
    for (const [key, name] of [
      ["F1", "gold"],
      ["F2", "crimson"],
      ["F3", "pale"],
    ]) {
      await tap(key);
      await tap("F9");
      await p.waitForTimeout(1500);
      const visual = await probe();
      assert.equal(visual.backdrop, 0);
      await shot("form-" + name);
    }
    pass(
      "three structural atlas forms render without added halos or body-wide hue filters",
    );
    for (const key of ["F1", "F2"]) {
      await tap(key);
      await tap("F9");
      await tap("F10");
      const evolving = await probe();
      assert.equal(evolving.backdrop, 0);
      await tap("Escape");
      const paused = await probe();
      await p.waitForTimeout(350);
      assert.equal((await probe()).clock, paused.clock);
      await tap("Escape");
      await until((s) => s.state !== 6);
      assert.equal((await probe()).backdrop, 0);
    }
    pass(
      "both evolution transitions keep the original arena background and explicit pause still freezes combat",
    );
    await tap("F1");
    const q = await question("u"),
      before = await probe();
    await p.waitForTimeout(2400);
    const during = await probe();
    assert.equal(during.phase, 5);
    assert.ok(during.age > before.age + 1.8);
    assert.ok(during.hp > before.hp);
    assert.equal(during.elapsed, before.elapsed);
    assert.equal(during.x, before.x);
    assert.equal(during.y, before.y);
    assert.equal(during.bossVisible, true);
    await shot("spelling-healing");
    await answer(q, true);
    await until((s) => s.hits === 1);
    const second = await question("l");
    await answer(second, true);
    const broken = await until((s) => s.state !== 7);
    assert.equal(
      broken.age,
      0,
      "two casts must break healing, rather than merely wait for channel expiry",
    );
    assert.equal(broken.cast, 2);
    pass(
      "actual U and L pass the spelling/meaning gates and interrupt healing; during the first prompt HP rises while combat positions and elapsed time stay frozen",
    );
    await tap("F1");
    const wrong = await question("u");
    await answer(wrong, false);
    const miss = await probe();
    assert.equal(miss.state, 7);
    assert.equal(miss.hits, 0);
    assert.equal(miss.cast, 0);
    pass(
      "a wrong word cancels the attack and gives no healing interruption credit",
    );
    await tap("F5");
    await p.keyboard.down("p");
    await p.waitForTimeout(180);
    await p.keyboard.up("p");
    await p.waitForTimeout(1400);
    const ultimate = await probe();
    assert.equal(ultimate.state, 7);
    assert.equal(ultimate.hits, 1);
    pass(
      "the actual five-hit ultimate damages the Keeper but provides one interrupt stamp",
    );
    await tap("F1");
    const beforeLight = await probe();
    await p.keyboard.down("j");
    await p.waitForTimeout(180);
    await p.keyboard.up("j");
    await p.waitForTimeout(350);
    const light = await probe();
    assert.equal(light.hits, 0);
    assert.ok(light.hp < beforeLight.hp);
    await tap("Escape");
    const frozen = await probe();
    await p.waitForTimeout(500);
    assert.equal((await probe()).age, frozen.age);
    await tap("Escape");
    pass(
      "ordinary J deals damage without breaking the ritual; a real pause freezes its clock",
    );
    for (let move = 0; move < 9; move++) {
      await tap("F6");
      await until((s) => s.move === move && s.state === 1);
      await p.waitForTimeout(350);
      await shot("move-" + move);
      await until((s) => s.state === 3);
      if (move === 7 || move === 8 || move === 9) {
        await p.waitForTimeout(260);
        await shot("move-active-" + move);
      }
      await until((s) => s.state === 2);
      await tap("F7");
    }
    pass(
      "all nine production attacks complete their committed patterns, visible tells and recovery without runtime errors",
    );
  }
  assert.deepEqual(await p.evaluate(() => window.bossErrors), []);
  report.probes = await p.evaluate(() => window.bossProbes);
  report.events = await p.evaluate(() => window.bossEvents);
  report.questions = await p.evaluate(() => window.bossQuestions);
  report.answers = await p.evaluate(() => window.bossAnswers);
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.failure = e.stack;
  report.probes = await p.evaluate(() => window.bossProbes).catch(() => []);
  report.events = await p.evaluate(() => window.bossEvents).catch(() => []);
  report.questions = await p.evaluate(() => window.bossQuestions);
  report.answers = await p.evaluate(() => window.bossAnswers);
  console.error(e);
  process.exitCode = 1;
  await shot("failure");
} finally {
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  await b.close();
  await new Promise((r) => server.close(r));
}
