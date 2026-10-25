import { parseExpedition } from "./expedition-progress.js";
import { expeditionHint, EXPEDITION } from "./belfry-expedition.js";
import { BelfryAudio } from "./belfry-audio.js";
import { CityUI, DISTRICTS, endingFor } from "./belfry-city.js";
import { keeperStatus } from "./belfry-keeper.js";
const $ = (s) => document.querySelector(s);
const fields = [
  "phase",
  "segment",
  "difficulty",
  "elapsed",
  "health",
  "maxHealth",
  "score",
  "combo",
  "bestCombo",
  "kills",
  "energy",
  "echoes",
  "x",
  "y",
  "vx",
  "vy",
  "hook",
  "target",
  "checkpoint",
  "bossHP",
  "returnTime",
  "riseY",
  "attempts",
  "deaths",
  "hookCount",
  "failReason",
  "fxCount",
  "cameraY",
  "dashCool",
  "invulnerable",
  "bossState",
  "bossShield",
  "bossStage",
  "sealLeft",
  "sealRight",
  "gateOne",
  "gateTwo",
  "attackKind",
  "chainStep",
  "chargeTime",
  "threats",
  "practice",
  "attackTime",
  "attackAge",
  "bindTime",
  "controlImmune",
  "controlGrace",
  "chainOwner",
  "chainTime",
  "attackSlots",
  "practiceKind",
  "basicCool",
  "airAttacks",
  "bowCool",
  "bladeCool",
  "healCool",
  "ultimateCool",
  "bowCharge",
  "healTime",
  "ultimateTime",
  "embers",
  "emberHits",
  "aimX",
  "aimY",
  "bowTarget",
  "wordMode",
  "wordPending",
  "wordSerial",
  "bladeLink",
  "wordVisualRate",
  "visualTime",
  "cityDistrict",
  "cityPrompt",
  "cityWind",
  "cityForge",
  "cityArchive",
  "cityMirror",
  "cityChoice",
  "cityLiftY",
  "cityDepth",
  "bossMove",
  "bossMaxHP",
  "bossLocked",
  "bossChain",
  "bossWindup",
  "keeperEpoch",
];
window.latestState = null;
window.renderState = null;
window.runtimeErrors = [];
window.runEvents = [];
let frame,
  previousPhase = -1,
  loading = true,
  fault = false,
  toastTimer,
  guidePaused = false,
  recordedAttempt = -1;
let soundOn = true;
window.foes = {};
window.keeperLines = {};
window.expeditionState = null;
window.huntFoes = {};
const soundscape = new BelfryAudio();
Object.defineProperty(window, "soundDiagnostics", {
  get: () => soundscape.diagnostics(),
});
let inscription, achievements;
try {
  const { InscriptionUI } = await import("./inscription-ui.js");
  inscription = new InscriptionUI({
    send: key,
    focus: focusGame,
    toast,
    audio: soundscape,
    onSettle: (s) => achievements?.word(s),
  });
} catch {
  const notice = document.createElement("span");
  notice.id = "word-load-error";
  notice.textContent = "词库未能加载 · 当前可玩纯动作模式";
  notice.setAttribute("role", "status");
  document.querySelector(".controls").prepend(notice);
  const noop = () => {};
  const held = new Map(),
    quarantine = new Set();
  let engine;
  const capture = (w) => {
    w.addEventListener(
      "keydown",
      (e) => {
        if (e.inscriptionTransport) return;
        if (/^F[1-5]$/.test(e.code) || quarantine.has(e.code)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        held.set(e.code, {
          code: e.code,
          key: e.key,
          keyCode: e.keyCode,
          which: e.which,
          bubbles: true,
        });
      },
      true,
    );
    w.addEventListener(
      "keyup",
      (e) => {
        if (e.inscriptionTransport) return;
        held.delete(e.code);
        quarantine.delete(e.code);
      },
      true,
    );
  };
  capture(window);
  inscription = {
    onEvent: noop,
    receive: noop,
    onWord: noop,
    onResolved: noop,
    configure: (data) => {
      data["main.spx"] = data["main.spx"].replace(
        "// HOST_CONFIGURATION",
        "wordMode=0",
      );
    },
    attach: (w) => {
      engine = w;
      held.clear();
      quarantine.clear();
      capture(w);
    },
    lockHeld: () => {
      const canvas = engine?.document.querySelector("#game-canvas");
      for (const [code, opts] of held) {
        quarantine.add(code);
        if (!canvas) continue;
        const e = new engine.KeyboardEvent("keyup", opts);
        Object.defineProperty(e, "inscriptionTransport", { value: true });
        canvas.dispatchEvent(e);
      }
      held.clear();
    },
  };
}
try {
  const { AchievementUI } = await import("./belfry-achievements.js");
  achievements = new AchievementUI({
    send: (code, value) => key(code, value, true),
    focus: focusGame,
    lockInput: () => inscription.lockHeld?.(),
  });
} catch {
  const notice = document.createElement("span");
  notice.id = "achievement-load-error";
  notice.textContent = "成就册暂不可用";
  document.querySelector(".controls").append(notice);
}
const city = new CityUI({
  send: (code, value) => key(code, value, true),
  focus: focusGame,
  lockInput: () => inscription.lockHeld?.(),
});
let records = [];
try {
  const saved = JSON.parse(localStorage.getItem("easyrun-belfry-v1") || "[]");
  if (Array.isArray(saved))
    records = saved
      .filter(
        (r) =>
          Number.isFinite(r.time) && r.time > 0 && Number.isFinite(r.score),
      )
      .slice(-50);
} catch {
  // A corrupt or blocked local record must never prevent playing the game.
  records = [];
}
function best() {
  const wins = records.filter((r) => r.result === "finish");
  $("#best").textContent = wins.length
    ? `本机最快 ${formatTime(Math.min(...wins.map((r) => r.time)))} · ${Math.max(...wins.map((r) => r.score))} 分`
    : "本机纪录 —";
}
function formatTime(t) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
function focusGame() {
  frame?.contentWindow?.document.querySelector("#game-canvas")?.focus();
}
function key(code, key = code, transport = false) {
  const w = frame?.contentWindow,
    c = w?.document.querySelector("#game-canvas");
  if (!c) return;
  focusGame();
  const keyCode = {
    Enter: 13,
    Escape: 27,
    KeyR: 82,
    KeyT: 84,
    KeyM: 77,
    KeyF: 70,
    KeyV: 86,
    Digit1: 49,
    Digit2: 50,
    Digit3: 51,
    Digit4: 52,
    Digit5: 53,
    Digit6: 54,
  }[code];
  const opts = { code, key, keyCode, which: keyCode, bubbles: true };
  const dispatch = (type) => {
    const e = new w.KeyboardEvent(type, opts);
    if (transport)
      Object.defineProperty(e, "inscriptionTransport", { value: true });
    c.dispatchEvent(e);
  };
  dispatch("keydown");
  setTimeout(() => c.isConnected && dispatch("keyup"), 65);
}
function overlay(kicker, title, body, button) {
  $("#overlay").hidden = false;
  $("#overlay-kicker").textContent = kicker;
  $("#overlay-title").textContent = title;
  $("#overlay-body").textContent = body;
  $("#practice").hidden = ![0, 2, 3, 4].includes(window.latestState?.phase);
  $("#play").hidden = !button;
  $("#play").innerHTML = button ? `${button}<span>↗</span>` : "";
  $("#difficulty").hidden = true;
  $("#results").hidden = true;
  $("#overlay-foot").textContent = "";
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2100);
}
function initAudio() {
  soundscape.init();
}
// Unlock title-screen music on a deliberate gesture without starting a run.
function unlockAudio(event) {
  if (
    event.isTrusted &&
    soundOn &&
    (!soundscape.music?.unlocked || soundscape.music?.blocked)
  )
    initAudio();
}
document.addEventListener("pointerdown", unlockAudio, { capture: true });
document.addEventListener("keydown", unlockAudio, { capture: true });
$("#music-start").onclick = initAudio;

function onEvent(name, t, x, y) {
  inscription.onEvent(name);
  city.onEvent(name);
  window.runEvents.push({ name, time: Number(t), x: Number(x), y: Number(y) });
  if (window.runEvents.length > 800) window.runEvents.shift();
  soundscape.onEvent(name.startsWith("city") ? "checkpoint" : name, Number(x));
  const labels = {
    skillcancel: "刻印失败 · 技能已取消",
    healrefund: "回息已取消 · 余烬已返还",
    wordescape: "锁链已解 · 夺回主动",
    chaincut: "锁链已斩断 · 缚索正在收势",
    chainfree: "已脱离锁链",
    tether: "被锁链牵引 · J 斩链 / E 抓锚点 / 冲向链手",
    bind: "封脉 · 暂时无法行动",
    bindrelease: "已脱离封脉 · 抓住收招破绽",
    launchhit: "挑空 → J 空中追击 → E 接钩索",
    charged: "蓄力破甲 · 可将轻敌撞向其他敌人",
    collision: "借敌破敌",
    practice:
      "排练场 · 1–5 刺客 / 6 组合 / 7 裂甲 / 8 猎兽 / 9 缝魂；R 开始冒险",
    enrage: "守心者正在变形 · 调整站位，留意新的追击轨迹",
    hook: "牵引 · 松开 E 上甩 / 按住 S 松开 E 下甩",
    nohook: "锚点太远 · 靠近金铜圆环，或调整方向",
    marked: "裂印 · 满蓄断潮可引爆",
    markbreak: "裂印破碎 · 断潮追加伤害",
    healground: "回息需要站稳地面",
    healfull: "生命已满",
    healempty: "余烬不足 · 4 次有效命中凝成 1 颗",
    healstart: "回息 · 稳住 0.8 秒；移动或受击会打断",
    healbreak: "回息中断",
    healcomplete: "回息 · 生命 +1",
    embergain: "余烬 +1",
    chainstart: "连环剑刀 · W 上挑 / S 下压收势",
    armor: "护架挡住了攻击 · 绕背、重斩破架或先处理缝魂师",
    guardbreak: "护架已碎 · 追击窗口",
    wardbreak: "牵线已断 · 守卫失去掩护",
    elitekill: "精英已倒下 · 猎场出口开放",
    echo: "失落回声 +500 · 余烬充满",
    checkpoint: "行路灯已点亮 · 进度已保存",
    restored: "抵达休整灯 · 生命恢复",
    huntersplit: "双卫掩护已断 · 抓住重新配合前的空档",
    parry: "弹幕已斩断",

    retry: "从休整灯重新出发",
  };
  if (labels[name]) toast(labels[name]);
  if (name === "start") {
    window.runEvents = window.runEvents.slice(-1);
    window.foes = {};
    recordedAttempt = -1;
  }
  if (name === "hurt") {
    $("#damage").classList.add("flash");
    setTimeout(() => $("#damage").classList.remove("flash"), 100);
  }
  if (name === "fail" || name === "finish") {
    $("#chapter").classList.remove("visible");
    $("#toast").classList.remove("visible");
  }
}
function hint(s) {
  if (s.phase !== 1) return "";
  if (s.bindTime > 0)
    return s.wordMode
      ? "封脉锁身 · 0.7 秒后辨义脱身。"
      : "封脉锁身 · 控制结束后恢复行动。";
  if (s.chainOwner >= 0)
    return s.wordMode
      ? "缚索牵引中 · J 斩链 / E 抓锚 / F 铭文解链。"
      : "缚索牵引中 · J 斩链 / E 抓锚 / 冲向链手。";
  if (s.practice)
    return [
      "悬刃 · 首刀后可能空中换位再追刀；看清第二次起手，再钩索追击。",
      "短锋 · 撤步架势可挡一次正面轻击；L 重斩破架，闪过飞踢后反击。",
      "壁弓 · 除了定点射击，还会蹬墙腾空放箭；J 可击落箭矢。",
      "缚索 · 跳过低位横扫，再防追锁；被牵引时 J 斩链 / E 抓锚。",
      "封脉 · 会绕到另一侧再锁定突进方向；跳开或打断，落空后反击。",
      "组合遭遇 · 先处理缝魂师，再拆开空地夹击。",
      "裂甲卫 · 正面护架，L 重斩破架；也可跳过或绕背攻击。",
      "棘背猎兽 · 低扑可跳过，跃袭先锁定落点；抓住滑行收势。",
      "缝魂师 · 细线保护一名同伴；远射施法者，或拉开距离、隔断视线。",
    ][s.practiceKind];
  if (s.expedition && s.segment !== 1) return expeditionHint(s);
  if (s.segment === 2) {
    if (s.y > -430) return "回到左上方的休整灯。最后一段，借锚点跃出井口。";
    return "向上逃离 · 按住 E 牵引，松开甩出；击杀恢复空中动作。";
  }
  if (s.segment === 1) return keeperStatus(s).hint;
  if (s.hook >= 0) return "松开 E 甩出 → 空格二段跳 → 再次抓住锚点。";
  if (s.y > -230)
    return "D 向右跃入井中 · 按住 E 抓住高亮锚点；松开时借力起飞。";
  if (s.y > -900) return "接近敌人按 J；钩住敌人也能回钩斩。S + J 向下坠星。";
  if (s.y > -1850) return "墙中弓手会先搭箭；缚索抛链后，J 可斩断连接。";
  if (s.y > -2900)
    return "U 满蓄贯夜留下裂印，L 满蓄断潮引爆；金色回声补充余烬。";
  return "钟声来自更深处。S + 空格穿过脚下的平台。";
}
function receive(s) {
  s.expedition = window.expeditionState;
  window.latestState = s;
  soundscape.stateChanged(s);
  const music = soundscape.music?.diagnostics();
  $("#music-start").hidden =
    !soundOn || (!!music?.unlocked && !music.blocked && !music.failed);
  $("#music-start").textContent = music?.failed ? "重试音乐" : "播放音乐";
  $("#music-track").textContent = music?.failed
    ? "音乐暂不可用，动作音效与游戏仍可继续。"
    : music?.title
      ? `Sea Power · ${music.title} · 单曲循环`
      : "点击「播放音乐」启用背景音乐。";
  inscription.receive(s);
  city.receive(s);
  achievements?.receive(s);
  $("#practice-controls").hidden = !(s.practice && s.phase === 1);
  document.querySelectorAll("[data-spar]").forEach((b) => {
    const selected = Number(b.dataset.spar) === s.practiceKind;
    b.classList.toggle("selected", selected);
    b.setAttribute("aria-pressed", String(selected));
  });
  const locked = s.bindTime > 0;
  $("#restraint").hidden = !locked;
  $("#restraint-time").textContent = `${Math.max(0, s.bindTime).toFixed(1)} s`;
  $("#restraint-fill").style.width =
    `${Math.min(100, (s.bindTime / 0.7) * 100)}%`;
  for (const [id, foe] of Object.entries(window.foes))
    if (s.elapsed - foe.seen > 0.4) delete window.foes[id];
  if (fault) return;
  loading = false;
  document.body.classList.toggle("playing", s.phase !== 0);
  $("#health").innerHTML = Array.from(
    { length: s.maxHealth },
    (_, i) => `<i${i >= s.health ? ' class="empty"' : ""}></i>`,
  ).join("");
  $("#health").setAttribute("aria-label", `生命 ${s.health} / ${s.maxHealth}`);
  $("#embers").textContent =
    `${"◆".repeat(s.embers)}${"◇".repeat(2 - s.embers)}`;
  $("#ember-progress").textContent =
    s.embers === 2 ? "已满" : `${s.emberHits}/4 命中`;
  $("#embers").setAttribute("aria-label", `余烬 ${s.embers} / 2`);
  for (const [id, kind, charging, unavailable, cooldown, duration] of [
    ["bow", 1, s.bowCharge, false, s.bowCool, 3],
    ["blade", 2, s.chargeTime, false, s.bladeCool, 3],
    [
      "heal",
      3,
      s.healTime > 0 ? 0.8 - s.healTime : 0,
      s.embers === 0 || s.health === s.maxHealth,
      s.healCool,
      3,
    ],
    ["ultimate", 4, s.ultimateTime, false, s.ultimateCool, 5],
  ]) {
    const el = $(`#skill-${id}`);
    el.classList.toggle("casting", charging > 0);
    el.classList.toggle("cooling", cooldown > 0);
    el.style.setProperty(
      "--cooldown",
      `${Math.min(100, Math.max(0, (cooldown / duration) * 100))}%`,
    );
    el.classList.toggle("unavailable", unavailable);
    el.querySelector(".skill-time").textContent =
      s.phase === 5 && s.wordPending === kind
        ? "待刻印"
        : cooldown > 0
          ? `${(Math.ceil(cooldown * 10) / 10).toFixed(1)}s`
          : charging > 0
            ? id === "heal"
              ? "回息中"
              : id === "ultimate"
                ? "连斩中"
                : charging >= 0.55
                  ? "满蓄"
                  : "蓄力"
            : unavailable
              ? s.health === s.maxHealth
                ? "生命满"
                : "缺余烬"
              : "就绪";
  }
  const bowEnemy = window.foes[s.bowTarget];
  $("#combat-focus").textContent =
    s.bowCharge > 0
      ? s.bowTarget >= 0
        ? `锁定 · ${{ 0: "悬刃", 1: "短锋", 2: "壁弓", 3: "守心者", 4: "缚索", 5: "封脉" }[bowEnemy?.kind] || "敌人"}`
        : "贯夜 · 自由瞄准"
      : "赤弦 · 墨刃";
  $("#air-budget").textContent = s.airAttacks
    ? `空中追击 ${Math.max(0, 2 - s.airAttacks)} / 2`
    : "J 普攻 · 0.28s";
  $("#time").textContent = formatTime(s.elapsed);
  $("#score").textContent = String(s.score).padStart(6, "0");
  $("#depth").textContent = `${Math.max(0, Math.round(-s.y / 10))
    .toString()
    .padStart(3, "0")} m`;
  $("#direction").textContent = [
    "DESCEND / 01",
    "CONFRONT / 02",
    "ASCEND / 03",
  ][s.segment];
  $("#objective").textContent = s.practice
    ? "排练场 · 自由组合"
    : s.segment === 2
      ? `归途 · ${DISTRICTS[s.cityDistrict].name}`
      : s.segment === 1
        ? s.bossShield > 0
          ? "守心机枢 · 抓住破绽"
          : "守心机枢 · 守心者"
        : EXPEDITION.rooms[s.expedition?.room]?.name ||
          DISTRICTS[s.cityDistrict].name;
  $("#depth-marker").style.top =
    `${Math.max(0, Math.min(100, (-s.y / Math.abs(EXPEDITION.platforms[EXPEDITION.keeperFloor][2])) * 100))}%`;
  $("#hint").textContent = hint(s);
  $("#relics").textContent = `◈ ${s.echoes} / 3`;
  $("#combo").innerHTML =
    s.ultimateTime > 0
      ? `<small>连环剑刀 · ${s.ultimateTime > 0.2 ? "交错斩" : "终式"}</small>`
      : s.attackKind > 0
        ? `<small>${{ 1: "一式 · 切线", 2: "二式 · 返刃", 3: "三式 · 断环", 4: "挑空", 5: "空中追击", 6: "空中返刃", 7: "蓄力破甲" }[s.attackKind] || ""}</small>`
        : s.combo >= 2
          ? `${s.combo} <small>AIR CHAIN</small>`
          : "";
  $("#boss").hidden = !(s.segment === 1 && [1, 5].includes(s.phase));
  $("#boss-health").style.width =
    `${Math.max(0, Math.min(100, (s.bossHP / s.bossMaxHP) * 100))}%`;
  const keeper = keeperStatus(s);
  $("#boss-name").textContent = keeper.name;
  $("#boss-state").textContent = keeper.label;
  $("#status").textContent =
    s.segment === 2
      ? `钟城下沉中 · 距黑潮 ${Math.max(0, Math.round((s.y - s.riseY) / 10))} m`
      : `${s.difficulty === 0 ? "旅人" : "无畏"} · 第 ${s.checkpoint + 1} 处行路灯 · ${s.kills} 次击破`;
  $("#pause").disabled = ![1, 4].includes(s.phase);
  $("#pause").textContent = s.phase === 4 ? "继续 Esc" : "暂停 Esc";
  document.querySelectorAll("[data-mode]").forEach((b) => {
    const on = Number(b.dataset.mode) === s.difficulty;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-pressed", String(on));
  });
  if (s.phase === previousPhase) return;
  previousPhase = s.phase;
  if (s.phase === 0) {
    overlay(
      "THE HOLLOW BELFRY",
      "倒悬钟城",
      "一份未写完的委托：穿过五个城区，带回仍在跳动的钟心。\n但那声求救，已经在空城里重复了千年。",
      "进入钟城",
    );
    $("#difficulty").hidden = false;
    $("#overlay-foot").textContent =
      "八类守卫 · 三场精英猎战 · 三形态守心者 · 夺心上返";
  }
  if (s.phase === 1) {
    $("#overlay").hidden = true;
    $("#guide").hidden = true;
    $("#settings-panel").hidden = true;
    guidePaused = false;
  }
  if (s.phase === 4) {
    overlay(
      "A MOMENT BETWEEN BELLS",
      "暂歇于此",
      "钟声与黑潮都已暂停。\n按 Enter 或 Esc 继续。",
      "继续旅程",
    );
    $("#overlay-foot").textContent = "需要复习动作时，可打开右上角的操作指南。";
  }
  if (s.phase === 2 || s.phase === 3) {
    const win = s.phase === 2;
    if (win) {
      const ending = endingFor(s);
      overlay("WHAT WE LEAVE BEHIND", ending.title, ending.text, "再入钟城");
      $("#results").innerHTML =
        `<div><b>${formatTime(s.elapsed)}</b><span>旅程用时</span></div><div><b>${s.score}</b><span>总分</span></div><div><b>${s.bestCombo}</b><span>最高连击</span></div>`;
      $("#results").hidden = false;
      $("#overlay-foot").textContent =
        `${s.difficulty === 0 ? "旅人" : "无畏"} · ${s.echoes} / 3 回声 · ${s.deaths} 次倒下`;
    } else {
      overlay(
        "THE THREAD IS NOT BROKEN",
        "弦未断，路未尽。",
        s.failReason === 2
          ? "黑潮追上了你。试着连续钩住上方锚点，减少落地停留。"
          : "你倒在了钟声里。留意敌人的橙色预警，\n用冲刺闪避，或斩击打散飞弹。",
        "从休整灯继续",
      );
      $("#overlay-foot").textContent =
        `Enter 从检查点继续 · R 从头开始 · 当前休整灯 ${s.checkpoint + 1}`;
    }
    if (recordedAttempt !== s.attempts && !s.practice) {
      recordedAttempt = s.attempts;
      records.push({
        date: new Date().toISOString(),
        result: win ? "finish" : "fail",
        time: s.elapsed,
        score: s.score,
        difficulty: s.difficulty,
        echoes: s.echoes,
        kills: s.kills,
        bestCombo: s.bestCombo,
        deaths: s.deaths,
        cityChoice: s.cityChoice,
        cityArchive: s.cityArchive,
        cityRepairs: s.cityWind + s.cityForge + s.cityArchive + s.cityMirror,
      });
      records = records.slice(-50);
      try {
        localStorage.setItem("easyrun-belfry-v1", JSON.stringify(records));
      } catch {
        $("#best").textContent = "浏览器未允许保存战绩";
      }
      best();
    }
  }
}
function fail(e) {
  fault = true;
  loading = false;
  window.runtimeErrors.push(String(e));
  overlay(
    "LOAD INTERRUPTED",
    "钟城尚未苏醒",
    String(e).slice(0, 400),
    "重新加载",
  );
  $("#pause").disabled = true;
}
function resize() {
  if (frame)
    frame.style.transform = `scale(${$("#viewport").clientWidth / 960})`;
}
async function load() {
  achievements?.resetSession();
  city.resetSession();
  loading = true;
  fault = false;
  previousPhase = -1;
  window.latestState = null;
  window.renderState = null;
  window.runtimeErrors = [];
  frame?.remove();
  frame = document.createElement("iframe");
  frame.title = "倒悬钟城游戏画面";
  frame.src = "/runtime/runner.html";
  const ready = new Promise((resolve, reject) => {
    frame.onload = resolve;
    frame.onerror = reject;
  });
  $("#stage").replaceChildren(frame);
  resize();
  let timeout;
  try {
    await Promise.race([
      (async () => {
        await ready;
        const w = frame.contentWindow,
          original = w.console.log.bind(w.console);
        w.console.log = (...args) => {
          const text = args.map(String).join(" ");
          const renderMatch = text.match(/@render\s+(.+)/);
          if (renderMatch) {
            const keys = [
              "sceneClones",
              "sceneBorn",
              "missing",
              "effects",
              "projectiles",
              "arrowsRequested",
              "arrowsBorn",
              "boltsRequested",
              "boltsBorn",
            ];
            const values = renderMatch[1].trim().split(/\s+/).map(Number);
            if (values.length === keys.length && values.every(Number.isFinite))
              window.renderState = Object.fromEntries(
                keys.map((key, i) => [key, values[i]]),
              );
          }
          const huntMatch = text.match(/@hunt\s+(.+)/);
          if (huntMatch) {
            const [id, armor, ward, pressure, elite] = huntMatch[1]
              .trim()
              .split(/\s+/)
              .map(Number);
            window.huntFoes[id] = { id, armor, ward, pressure, elite };
          }
          const expeditionMatch = text.match(/@expedition\s+(.+)/);
          if (expeditionMatch)
            window.expeditionState = parseExpedition(
              expeditionMatch[1].trim().split(/\s+/).map(Number),
            );
          let m = text.match(/@state\s+(.+)/);
          if (m) {
            const a = m[1].trim().split(/\s+/).map(Number);
            if (a.length >= fields.length && a.every(Number.isFinite))
              receive(Object.fromEntries(fields.map((f, i) => [f, a[i]])));
          }
          m = text.match(/@event\s+(\w+)\s+(\S+)\s+(\S+)\s+(\S+)/);
          if (m) onEvent(m[1], m[2], m[3], m[4]);
          m = text.match(/@deed\s+(\d+)\s+(\w+)\s+(.+)/);
          if (m) {
            const values = m[3].trim().split(/\s+/).map(Number);
            const keys = [
              "attempt",
              "phase",
              "practice",
              "health",
              "difficulty",
              "deaths",
              "echoes",
              "hook",
            ];
            if (values.length === keys.length && values.every(Number.isFinite))
              achievements?.deed({
                serial: Number(m[1]),
                name: m[2],
                ...Object.fromEntries(keys.map((k, i) => [k, values[i]])),
              });
          }
          m = text.match(/@wordResolved\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
          if (m) inscription.onResolved(...m.slice(1).map(Number));
          m = text.match(/@word\s+(\d+)\s+(\d+)\s+(\d+)/);
          if (m) inscription.onWord(...m.slice(1).map(Number));
          m = text.match(/@foe\s+(.+)/);
          if (m) {
            const a = m[1].trim().split(/\s+/).map(Number);
            const keys = [
              "id",
              "kind",
              "hp",
              "x",
              "y",
              "state",
              "mode",
              "hazard",
              "stun",
              "clock",
              "aimX",
              "aimY",
              "facing",
              "step",
              "mark",
            ];
            if (a.length === keys.length && a.every(Number.isFinite)) {
              const foe = Object.fromEntries(keys.map((k, i) => [k, a[i]]));
              foe.seen = window.latestState?.elapsed ?? 0;
              window.foes[foe.id] = foe;
            }
          }
          m = text.match(/@enemyEvent\s+(\w+)\s+(\d+)\s+(\d+)\s+(\S+)/);
          if (m) {
            soundscape.enemy(m[1], Number(m[2]), Number(m[3]));
            window.runEvents.push({
              name: "enemy_" + m[1],
              id: Number(m[2]),
              kind: Number(m[3]),
              time: Number(m[4]),
            });
          }
          m = text.match(/@keeperLine\s+(.+)/);
          if (m) {
            const values = m[1].trim().split(/\s+/).map(Number);
            const keys = [
              "id",
              "ax",
              "ay",
              "bx",
              "by",
              "age",
              "delay",
              "life",
              "width",
              "style",
            ];
            if (
              values.length === keys.length &&
              values.every(Number.isFinite)
            ) {
              const line = Object.fromEntries(
                keys.map((k, i) => [k, values[i]]),
              );
              window.keeperLines[line.id] = line;
            }
          }
          if (
            !text.includes("@state") &&
            !text.includes("@render") &&
            !text.includes("@foe") &&
            !text.includes("@keeperLine")
          )
            original(...args);
        };
        inscription.attach(w);
        w.onGameError(fail);
        w.onEngineCrash(fail);
        w.addEventListener("keydown", (e) => {
          if (["Enter", "KeyT"].includes(e.code)) initAudio();
          if (
            [
              "Space",
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
            ].includes(e.code)
          )
            e.preventDefault();
        });
        await w.initEngine(
          Object.fromEntries(
            ["engine.zip", "game.zip", "engine.wasm", "ispx.wasm"].map((p) => [
              p,
              "/runtime/" + p,
            ]),
          ),
        );
        $("#overlay-body").textContent = "引擎已就绪，正在唤醒守卫。";
        const res = await fetch("/belfry.json");
        if (!res.ok)
          throw new Error("关卡文件未生成，请运行 pnpm game:build。");
        const data = await res.json();
        inscription.configure(data);
        await w.initGame(
          Object.fromEntries(
            Object.entries(data).map(([p, s]) => [
              p,
              {
                content: s.$binary
                  ? Uint8Array.from(atob(s.$binary), (c) => c.charCodeAt(0))
                      .buffer
                  : new TextEncoder().encode(s).buffer,
                lastModified: Date.now(),
              },
            ]),
          ),
        );
        await w.startGame();
      })(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("加载超时，请重新加载。")),
          40000,
        );
      }),
    ]);
  } catch (e) {
    fail(e.message || e);
  } finally {
    clearTimeout(timeout);
  }
}
new ResizeObserver(resize).observe($("#viewport"));
$("#play").onclick = () => {
  if (fault) {
    location.reload();
    return;
  }
  initAudio();
  key("Enter", "Enter");
};
$("#pause").onclick = () => {
  key("Escape", "Escape");
};
$("#sound").onclick = () => {
  soundOn = !soundOn;
  if (soundOn) initAudio();
  soundscape.mute(!soundOn);
  $("#sound").textContent = `声音 ${soundOn ? "开" : "关"}`;
  $("#sound").setAttribute("aria-pressed", String(soundOn));
  focusGame();
};
document
  .querySelectorAll("[data-mode]")
  .forEach(
    (b) =>
      (b.onclick = () =>
        key(
          Number(b.dataset.mode) === 0 ? "Digit1" : "Digit2",
          Number(b.dataset.mode) === 0 ? "1" : "2",
        )),
  );
$("#help").onclick = () => {
  guidePaused = window.latestState?.phase === 1;
  if (guidePaused) key("Escape", "Escape");
  $("#guide").hidden = false;
  $("#close-guide").focus();
};
$("#close-guide").onclick = () => {
  $("#guide").hidden = true;
  if (guidePaused && window.latestState?.phase === 4) key("Escape", "Escape");
  guidePaused = false;
  focusGame();
};
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#play-panel").requestFullscreen();
  } catch {
    toast("当前窗口不支持全屏，可放大浏览器窗口。");
  }
  focusGame();
};
$("#export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ version: 1, records }, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "belfry-records.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener("keydown", (e) => {
  if (["Enter", "KeyT"].includes(e.code)) initAudio();
  if (loading || e.repeat || e.target.closest("button")) return;
  if (
    [
      "Enter",
      "Escape",
      "KeyR",
      "KeyT",
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
    ].includes(e.code)
  ) {
    e.preventDefault();
    if (["Enter", "KeyT"].includes(e.code)) initAudio();
    key(e.code, e.key);
  }
});
window.addEventListener("pagehide", () => soundscape.music?.audio.pause());
document.addEventListener("visibilitychange", () => {
  soundscape.syncMusic();
  if (document.hidden) {
    soundscape.stopAll();
  }
  if (document.hidden && window.latestState?.phase === 1)
    key("Escape", "Escape");
});
let settingsPaused = false;
$("#practice").onclick = () => {
  initAudio();
  key("KeyT", "t");
};
$("#audio-settings").onclick = () => {
  settingsPaused = window.latestState?.phase === 1;
  if (settingsPaused) key("Escape", "Escape");
  $("#settings-panel").hidden = false;
  $("#close-settings").focus();
};
$("#close-settings").onclick = () => {
  $("#settings-panel").hidden = true;
  if (settingsPaused && window.latestState?.phase === 4)
    key("Escape", "Escape");
  settingsPaused = false;
  focusGame();
};
for (const k of ["sfx", "music"]) {
  const el = $("#setting-" + k);
  el.value = soundscape.settings[k];
  el.oninput = () => soundscape.set(k, Number(el.value));
}
best();
load();

for (const button of document.querySelectorAll("[data-spar]")) {
  button.onclick = () => {
    const n = Number(button.dataset.spar) + 1;
    key("Digit" + n, String(n));
  };
}
