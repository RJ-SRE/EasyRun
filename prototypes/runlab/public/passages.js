import { PassageAudio } from "./passages-audio.js";
const $ = (s) => document.querySelector(s);
const fields = [
  "phase",
  "difficulty",
  "checkpoint",
  "elapsed",
  "deaths",
  "collected",
  "x",
  "y",
  "vx",
  "vy",
  "hook",
  "target",
  "pull",
  "foldTime",
  "liftTime",
  "fold",
  "valveLeft",
  "valveRight",
  "weight",
  "wind",
  "windStage",
  "attempts",
  "hookCount",
  "wallJumps",
  "grounded",
  "standing",
  "dashCool",
  "fxCount",
  "failReason",
  "cameraX",
  "cameraY",
  "worldTime",
  "hookAge",
  "hookFlight",
  "hookContact",
  "hookTension",
  "hookX",
  "hookY",
  "ropeFade",
];
window.passageState = null;
window.passageEvents = [];
window.passageErrors = [];
let frame,
  world,
  priorPhase = -1,
  priorCheckpoint = -1,
  priorMode = -1,
  fault = false,
  toastTimer,
  modalPaused = false,
  modalKind = "",
  savedAttempt = -1,
  soundOn = true;
const audio = new PassageAudio();
window.passageSound = () => audio.diagnostics();
let records = [];
try {
  const a = JSON.parse(localStorage.getItem("rupture-passages-v1") || "[]");
  if (Array.isArray(a))
    records = a.filter((x) => Number.isFinite(x.time) && x.time > 0).slice(-30);
} catch {
  /* Optional local records. */
}
function clock(t) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
function best() {
  const mode = passageState?.difficulty ?? 0;
  const a = records.filter(
    (x) => x.result === "finish" && x.difficulty === mode,
  );
  $("#best").textContent = a.length
    ? `本机最快 ${clock(Math.min(...a.map((x) => x.time)))} · 最多 ${Math.max(...a.map((x) => x.relics))}/8 遗物`
    : "本机纪录 —";
}
function focus() {
  frame?.contentWindow.document.querySelector("#game-canvas")?.focus();
}
function key(code) {
  if (code === "Enter" || code === "Escape") initAudio();
  const w = frame?.contentWindow,
    c = w?.document.querySelector("#game-canvas");
  if (!c) return;
  focus();
  const n = { Enter: 13, Escape: 27, KeyR: 82, Digit1: 49, Digit2: 50 }[code];
  const o = {
    key: code === "KeyR" ? "r" : code,
    code,
    keyCode: n,
    which: n,
    bubbles: true,
  };
  c.dispatchEvent(new w.KeyboardEvent("keydown", o));
  setTimeout(
    () => c.isConnected && c.dispatchEvent(new w.KeyboardEvent("keyup", o)),
    60,
  );
}
function initAudio() {
  audio.init();
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2600);
}
function event(name, t, x, y) {
  window.passageEvents.push({
    name,
    time: Number(t),
    x: Number(x),
    y: Number(y),
  });
  if (passageEvents.length > 1200) passageEvents.shift();
  audio.event(name, Number(x), Number(y));
  const text = {
    fold: "折叠桥已展开 · 留意回收倒计时",
    valve: "泄压阀已解锁",
    shaftopen: "两侧压力归零 · 井底侧门开启",
    weight: "配重启动 · 右侧升降台正在上行",
    wind: "风阀开启 · 浅青气流可以托起你",
    relic: "发现遗物",
    nohook: "靠近锚点，或用方向键调整目标",
    retry: "回到休整灯 · 机关重新准备就绪",
  };
  if (text[name]) toast(text[name]);
  if (name === "start") {
    window.passageEvents = passageEvents.slice(-1);
    savedAttempt = -1;
  }
}
function mapSvg(large = false) {
  if (!world) return "";
  const colors = ["#d3b477", "#b3cfbc", "#ddbb85", "#91c9c5", "#c3dba3"];
  let c =
    '<path d="M190 0H1780L2220 -290 1780 -600 2250 -900 1820 -1510H2800L2980 -920H3880L4210 -660 4720 -620 5050 -920H5320L5770 -700 5330 -500 5770 -280 5330 -80 5770 120 5330 340 5780 550" fill="none" stroke="#aab8a0" stroke-width="16" stroke-dasharray="45 28" opacity=".35"/>';
  for (let i = 0; i < world.rooms.length; i++) {
    const r = world.rooms[i];
    c += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="25" fill="${colors[i]}" fill-opacity=".04" stroke="${colors[i]}" stroke-width="${i === (passageState?.checkpoint ?? 0) ? 22 : 10}"/>`;
  }
  for (const [x, y, w] of world.platforms)
    c += `<path d="M${x} ${y}h${w}" stroke="#b7c8ad" stroke-width="19"/>`;
  c +=
    '<circle class="map-player" cx="190" cy="0" r="60" fill="#fff0b8" stroke="#101d23" stroke-width="18"/>';
  const labels = large
    ? world.rooms
        .map(
          (r, i) =>
            `<text x="${r.x + r.w / 2}" y="${950 - r.y - r.h + 140}" text-anchor="middle" fill="${colors[i]}" font-size="105">${i + 1} ${r.name}</text>`,
        )
        .join("")
    : "";
  return `<svg viewBox="0 0 6100 2700" role="img" aria-label="五个相连区域：横向回廊、下降深井、配重攀升、摆渡长廊和上升风塔"><g transform="translate(0 950) scale(1 -1)">${c}</g>${labels}</svg>`;
}
function overlay(title, body, button, kicker = "THE TURNING PASSAGE") {
  $("#overlay").hidden = false;
  $("#title").textContent = title;
  $("#body").textContent = body;
  $("#play").textContent = button;
  $("#play").hidden = !button;
  $("#kicker").textContent = kicker;
  $("#difficulty").hidden = true;
}
function receive(s) {
  window.passageState = s;
  if (fault) return;
  if (priorMode !== s.difficulty) {
    priorMode = s.difficulty;
    best();
  }
  const room = world?.rooms[s.checkpoint];
  $("#room-name").textContent = room?.name ?? "";
  $("#room-number").textContent = `PASSAGE / 0${s.checkpoint + 1}`;
  $("#objective").textContent = room?.goal ?? "";
  $("#clock").textContent = clock(s.elapsed);
  $("#relics").textContent = `◈ ${s.collected} / 8`;
  $("#deaths").textContent = `${s.deaths} 次失足`;
  $("#checkpoint").textContent = `休整灯 ${s.checkpoint + 1} / 5`;
  const hints = [
    "先按住 E 拉开铜环；桥展开后向右，跳跃与钩索可以衔接。",
    "粗糙墙面可蹬墙。两侧铜环需要拉住；橙色虚线表示活塞即将伸出。",
    "右侧第一台配重平台会上升；上层停靠 6 秒。错过后可返回铜环重新启动。",
    "移动吊环保留甩出动量；落到下方维修梯仍可以继续。",
    "风道亮起时进入中央气流；两侧平台可以等待，出口位于右上方。",
  ];
  $("#hint").textContent =
    s.hook >= 0
      ? "按住 E 牵引；铜环近处拉住片刻；松开 E 甩出。"
      : hints[s.checkpoint];
  $("#mechanism").textContent =
    s.checkpoint === 0
      ? s.foldTime > 0
        ? `桥面回收 ${s.foldTime.toFixed(1)} 秒`
        : "铜环待拉动"
      : s.checkpoint === 1
        ? `泄压阀 ${s.valveLeft + s.valveRight} / 2`
        : s.checkpoint === 2
          ? s.liftTime > 0
            ? `配重 ${s.liftTime < 5 ? "上行" : s.liftTime < 11 ? "停靠" : "回落"}`
            : "拉动铜环启动配重"
          : s.checkpoint === 4
            ? s.wind
              ? s.windStage === 2
                ? "气流上升中"
                : s.windStage === 1
                  ? "气流即将启动"
                  : "风道暂歇"
              : "底部风阀待开启"
            : "上方摆渡 / 下方维修梯";
  $("#pull").hidden = s.pull <= 0 || s.phase !== 1;
  $("#pull i").style.width = `${Math.min(100, (s.pull / 0.6) * 100)}%`;
  $("#pause").disabled = ![1, 4].includes(s.phase);
  $("#pause").textContent = s.phase === 4 ? "继续 Esc" : "暂停 Esc";
  if (s.checkpoint !== priorCheckpoint) {
    priorCheckpoint = s.checkpoint;
    $("#minimap").innerHTML = mapSvg();
    if (s.phase === 1 && s.checkpoint > 0)
      toast(`${s.checkpoint + 1} / 5 · ${room.name} · 休整灯已点亮`);
  }
  for (const dot of document.querySelectorAll(".map-player")) {
    dot.setAttribute("cx", s.x);
    dot.setAttribute("cy", s.y);
  }
  for (const b of document.querySelectorAll("[data-mode]")) {
    b.classList.toggle("selected", Number(b.dataset.mode) === s.difficulty);
    b.setAttribute(
      "aria-pressed",
      String(Number(b.dataset.mode) === s.difficulty),
    );
  }
  audio.update(s);
  if (s.phase === priorPhase) return;
  priorPhase = s.phase;
  if (s.phase === 0) {
    overlay(
      "回路遗迹",
      "穿过折叠的桥，落入配重的深处。\n借移动的吊环横渡，再沿风声回到高处。",
      "进入遗迹 ↗",
      "A CITY THAT STILL REMEMBERS HOW TO MOVE",
    );
    $("#difficulty").hidden = false;
  }
  if (s.phase === 1) {
    $("#foot").textContent =
      "五段相连的通道 · 八枚遗物 · Enter 继续 · R 从头重开";
    $("#overlay").hidden = true;
    if (!modalKind) $("#sheet").hidden = true;
  }
  if (s.phase === 4)
    overlay(
      "在此停一刻",
      "机关与时间都已暂停。\n可以打开地图，观察下一段路线。",
      "继续旅程 ↗",
      "BETWEEN ONE MOVEMENT AND THE NEXT",
    );
  if (s.phase === 3) {
    overlay(
      "还有下一次起跳",
      s.failReason === 2
        ? "活塞伸出前，会先出现橙色轨迹。\n在壁龛等一拍，再穿过它。"
        : "失去落点了。试试更早抓住吊环，\n或者沿下方维修路线重新接回主线。",
      "从休整灯继续 ↗",
      "THE WAY IS STILL HERE",
    );
    $("#foot").textContent =
      `当前休整灯 ${s.checkpoint + 1} / 5 · Enter 继续 · R 从头重开`;
  }
  if (s.phase === 2) {
    overlay(
      "你让遗迹重新流动。",
      `完成五段通道 · ${clock(s.elapsed)}\n发现 ${s.collected}/8 枚遗物 · ${s.deaths} 次失足 · ${s.hookCount} 次钩索`,
      "再次进入 ↗",
      "EVERY WALL WAS ANOTHER WAY",
    );
    $("#foot").textContent = "试着走过高处支路，或在更少停靠中完成下一次旅程。";
  }
  if ((s.phase === 2 || s.phase === 3) && savedAttempt !== s.attempts) {
    savedAttempt = s.attempts;
    records.push({
      date: new Date().toISOString(),
      result: s.phase === 2 ? "finish" : "fail",
      time: s.elapsed,
      relics: s.collected,
      deaths: s.deaths,
      difficulty: s.difficulty,
    });
    records = records.slice(-30);
    try {
      localStorage.setItem("rupture-passages-v1", JSON.stringify(records));
    } catch {
      /* Optional record. */
    }
    best();
  }
}
function fail(e) {
  fault = true;
  passageErrors.push(String(e));
  overlay("遗迹尚未苏醒", String(e).slice(0, 350), "重新加载");
}
function resize() {
  if (frame)
    frame.style.transform = `scale(${$("#viewport").clientWidth / 960})`;
}
async function load() {
  const deadline = setTimeout(() => {
    if (!passageState) fail("载入超时，请重新加载。");
  }, 60000);
  try {
    world = await (await fetch("/passages-map.json")).json();
    frame = document.createElement("iframe");
    frame.title = "回路遗迹关卡";
    frame.src = "/runtime/runner.html";
    const ready = new Promise((res, rej) => {
      frame.onload = res;
      frame.onerror = rej;
    });
    $("#stage").replaceChildren(frame);
    resize();
    await ready;
    const w = frame.contentWindow,
      original = w.console.log.bind(w.console);
    w.console.log = (...args) => {
      const t = args.map(String).join(" ");
      let m = t.match(/@state\s+(.+)/);
      if (m) {
        const a = m[1].trim().split(/\s+/).map(Number);
        if (a.length === fields.length && a.every(Number.isFinite))
          receive(Object.fromEntries(fields.map((k, i) => [k, a[i]])));
      }
      m = t.match(/@event\s+(\w+)\s+(\S+)\s+(\S+)\s+(\S+)/);
      if (m) event(m[1], m[2], m[3], m[4]);
      if (!t.includes("@state")) original(...args);
    };
    w.onGameError(fail);
    w.onEngineCrash(fail);
    w.addEventListener("keydown", (e) => {
      if (
        ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "Enter" || e.code === "Escape") initAudio();
      if (e.code === "KeyM" && !e.repeat) {
        e.preventDefault();
        openSheet("map");
      }
    });
    await w.initEngine(
      Object.fromEntries(
        ["engine.zip", "game.zip", "engine.wasm", "ispx.wasm"].map((p) => [
          p,
          "/runtime/" + p,
        ]),
      ),
    );
    const res = await fetch("/passages.json");
    if (!res.ok) throw new Error("请先构建通道关卡。");
    const data = await res.json();
    await w.initGame(
      Object.fromEntries(
        Object.entries(data).map(([p, s]) => [
          p,
          {
            content: s.$binary
              ? Uint8Array.from(atob(s.$binary), (c) => c.charCodeAt(0)).buffer
              : new TextEncoder().encode(s).buffer,
            lastModified: Date.now(),
          },
        ]),
      ),
    );
    await w.startGame();
  } catch (e) {
    fail(e.message || e);
  } finally {
    clearTimeout(deadline);
  }
}
function openSheet(kind) {
  if (modalKind) {
    closeSheet();
    return;
  }
  modalPaused = passageState?.phase === 1;
  if (modalPaused) key("Escape");
  modalKind = kind;
  $("#sheet-kicker").textContent =
    kind === "map" ? "THE SHAPE OF THE JOURNEY" : "THE ART OF MOVEMENT";
  $("#sheet-title").textContent =
    kind === "map" ? "一条向下，也向上的路。" : "让下一步，接住这一步。";
  $("#sheet-content").innerHTML =
    kind === "map"
      ? mapSvg(true) +
        "<p>金点是你的位置。遗迹从左侧回廊进入，经深井下降，在配重室转向上层，横渡后沿最右侧风塔攀升。每个区域入口都有休整灯。</p>"
      : "<dl><dt>A / D · ← / →</dt><dd>移动，空中调整方向。</dd><dt>空格</dt><dd>跳跃、二段跳；贴住粗糙墙面可蹬墙跳。</dd><dt>按住 E</dt><dd>钩住高亮吊环；接近铜色机关环后继续拉住片刻。</dd><dt>松开 E</dt><dd>借力甩出；恢复二段跳和冲刺。</dd><dt>方向 + E</dt><dd>辅助选点，S 偏向下方，W 偏向上方。</dd><dt>K / Shift</dt><dd>冲刺；W 配合向上，S 配合向下。</dd><dt>S + 空格</dt><dd>穿下普通平台。</dd><dt>Enter / R / Esc</dt><dd>检查点继续 / 完全重开 / 暂停。</dd></dl><p>铜色方环操作机关，圆环是永久锚点，青色菱环沿轨道移动。橙色虚线预告危险，浅青气流提供上升助力。</p>";
  $("#sheet").hidden = false;
  $("#close-sheet").focus();
}
function closeSheet() {
  $("#sheet").hidden = true;
  modalKind = "";
  if (modalPaused && passageState?.phase === 4) key("Escape");
  modalPaused = false;
  focus();
}
$("#play").onclick = () => {
  if (fault) {
    location.reload();
    return;
  }
  initAudio();
  key("Enter");
};
$("#pause").onclick = () => key("Escape");
$("#help").onclick = () => openSheet("help");
$("#map").onclick = () => openSheet("map");
$("#close-sheet").onclick = closeSheet;
$("#sound").onclick = () => {
  soundOn = !soundOn;
  audio.setEnabled(soundOn);
  $("#sound").textContent = `声音 ${soundOn ? "开" : "关"}`;
  $("#sound").setAttribute("aria-pressed", String(soundOn));
  focus();
};
for (const b of document.querySelectorAll("[data-mode]"))
  b.onclick = () => key(Number(b.dataset.mode) ? "Digit2" : "Digit1");
$("#full").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#panel").requestFullscreen();
  } catch {
    toast("当前窗口不支持全屏。");
  }
  focus();
};
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.target.closest('input,textarea,[contenteditable="true"]'))
    return;
  if (e.code === "Enter" && e.target.closest("button")) return;
  if (e.code === "KeyM") {
    e.preventDefault();
    openSheet("map");
  } else if (modalKind && (e.code === "Escape" || e.code === "Enter")) {
    e.preventDefault();
    closeSheet();
  } else if (["Enter", "Escape", "KeyR", "Digit1", "Digit2"].includes(e.code)) {
    e.preventDefault();
    if (e.code === "Enter" || e.code === "Escape") initAudio();
    key(e.code);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.hide();
    if (passageState?.phase === 1) key("Escape");
  }
});
new ResizeObserver(resize).observe($("#viewport"));
best();
load();
