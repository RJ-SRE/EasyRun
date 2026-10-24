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
];
window.latestState = null;
window.runtimeErrors = [];
window.runEvents = [];
let frame,
  previousPhase = -1,
  loading = true,
  fault = false,
  toastTimer,
  chapterTimer,
  guidePaused = false,
  recordedAttempt = -1;
let soundOn = true,
  audio,
  master,
  drone,
  melodyAt = 0,
  noteIndex = 0;
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
function key(code, key = code) {
  const w = frame?.contentWindow,
    c = w?.document.querySelector("#game-canvas");
  if (!c) return;
  focusGame();
  const keyCode = { Enter: 13, Escape: 27, KeyR: 82, Digit1: 49, Digit2: 50 }[
    code
  ];
  const opts = { code, key, keyCode, which: keyCode, bubbles: true };
  c.dispatchEvent(new w.KeyboardEvent("keydown", opts));
  setTimeout(
    () => c.isConnected && c.dispatchEvent(new w.KeyboardEvent("keyup", opts)),
    65,
  );
}
function overlay(kicker, title, body, button) {
  $("#overlay").hidden = false;
  $("#overlay-kicker").textContent = kicker;
  $("#overlay-title").textContent = title;
  $("#overlay-body").textContent = body;
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
function chapter(n, title, copy) {
  $("#chapter-num").textContent = n;
  $("#chapter-title").textContent = title;
  $("#chapter-copy").textContent = copy;
  $("#chapter").classList.add("visible");
  clearTimeout(chapterTimer);
  chapterTimer = setTimeout(
    () => $("#chapter").classList.remove("visible"),
    3300,
  );
}
function initAudio() {
  if (!soundOn) return;
  audio ??= new AudioContext();
  audio.resume();
  if (master) return;
  master = audio.createGain();
  master.gain.value = 0.4;
  master.connect(audio.destination);
  drone = audio.createOscillator();
  const g = audio.createGain();
  drone.type = "sine";
  drone.frequency.value = 55;
  g.gain.value = 0.035;
  drone.connect(g);
  g.connect(master);
  drone.start();
}
function bell(freq, duration = 1.2, volume = 0.07) {
  if (!audio || !soundOn || audio.state !== "running") return;
  const now = audio.currentTime;
  for (const [ratio, level] of [
    [1, 1],
    [2.01, 0.25],
    [3.93, 0.08],
  ]) {
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(volume * level, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(now + duration + 0.05);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
}
function sound(name) {
  if (!audio || !soundOn || audio.state !== "running") return;
  const settings = {
    hook: [0.15, 2200, 0.07],
    sling: [0.2, 3100, 0.06],
    slash: [0.12, 4100, 0.06],
    hit: [0.16, 1600, 0.11],
    kill: [0.25, 2200, 0.12],
    dash: [0.22, 2900, 0.07],
    plunge: [0.3, 900, 0.06],
    plungehit: [0.34, 1400, 0.1],
    nova: [0.7, 2100, 0.13],
    hurt: [0.2, 600, 0.12],
    land: [0.1, 500, 0.025],
    jump: [0.1, 1400, 0.02],
  };
  if (settings[name]) {
    const [duration, cutoff, volume] = settings[name],
      now = audio.currentTime,
      b = audio.createBuffer(
        1,
        Math.ceil(audio.sampleRate * duration),
        audio.sampleRate,
      ),
      data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audio.createBufferSource(),
      f = audio.createBiquadFilter(),
      g = audio.createGain();
    src.buffer = b;
    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff, now);
    f.frequency.exponentialRampToValueAtTime(90, now + duration);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  const notes = {
    echo: 660,
    checkpoint: 440,
    core: 220,
    bell: 82,
    kill: 330,
    nova: 110,
    finish: 550,
    fail: 73,
  };
  if (notes[name]) bell(notes[name], name === "core" ? 3 : 1.2, 0.1);
}
setInterval(() => {
  if (!audio || !soundOn) return;
  const playing = window.latestState?.phase === 1 && !document.hidden;
  master?.gain.setTargetAtTime(playing ? 0.4 : 0, audio.currentTime, 0.3);
  if (playing && audio.currentTime > melodyAt) {
    const melody = [110, 0, 164.81, 0, 146.83, 0, 220, 0, 130.81, 0, 164.81, 0];
    const n = melody[noteIndex++ % melody.length];
    if (n) bell(n, 3.5, 0.025);
    melodyAt = audio.currentTime + 2.4;
  }
}, 500);
function onEvent(name, t, x, y) {
  window.runEvents.push({ name, time: Number(t), x: Number(x), y: Number(y) });
  if (window.runEvents.length > 800) window.runEvents.shift();
  sound(name);
  const labels = {
    seal: "钟锁断开 · 两侧吊环牵制着钟卫",
    exposed: "钟卫失去钟锁 · 现在进攻",
    sealed: "钟锁保护中 · 钩住两侧悬环，拉断钟锁",
    enrage: "钟卫重新封锁 · 再次拉断两侧钟锁",
    gate: "钟锁已解 · 通往更深处",
    hook: "牵引 · 松开 E 甩出",
    nohook: "锚点太远 · 靠近金铜圆环，或调整方向",
    empty: "弦能不足 · 击杀敌人或拾取回声",
    armor: "重甲闭合 · 坠星、回钩斩或等待破绽",
    echo: "失落回声 +500 · 弦能充满",
    checkpoint: "休整灯已点亮 · 生命恢复",
    parry: "断开弹幕 · 弦能 +4",
    nova: "断弦",
    retry: "从休整灯重新出发",
  };
  if (labels[name]) toast(labels[name]);
  if (name === "start") {
    window.runEvents = window.runEvents.slice(-1);
    recordedAttempt = -1;
    chapter(
      "ACT I · DESCENT",
      "落入钟城",
      "金铜圆环是你的路。按住 E，松开后甩出。",
    );
  }
  if (name === "guardian")
    chapter(
      "ACT II · THE KEEPER",
      "末代钟卫",
      "它仍在守护，最后一颗尚未停止的心。",
    );
  if (name === "core")
    chapter(
      "ACT III · ASCENT",
      "带它回到光里",
      "失去钟心的城开始下沉。向上，别停下。",
    );
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
  if (s.segment === 2) {
    if (s.y > -430) return "回到左上方的休整灯。最后一段，借锚点跃出井口。";
    return "向上逃离 · 按住 E 牵引，松开甩出；击杀恢复空中动作。";
  }
  if (s.segment === 1 && s.bossShield > 0)
    return `钩住${!s.sealLeft && !s.sealRight ? "左右两侧" : !s.sealLeft ? "左侧" : "右侧"}红色吊环，抵达吊环时拉断钟锁。`;
  if (s.segment === 1)
    return s.bossState === 2
      ? "钟卫已露出破绽 · J 连斩 / S + J 坠星 / Q 断弦"
      : "钟卫重甲闭合 · 回钩斩与坠星可破甲，注意橙色预警。";
  if (s.gateOne > 0 && s.y < -850 && s.y > -1300)
    return "第一钟锁 · 击破右侧织缆者，开启下方闸门。按住 E 回钩斩。";
  if (s.gateTwo > 0 && s.y < -1950 && s.y > -2400)
    return "第二钟锁 · 击破左侧钟卫。回钩斩或 S + J 坠星可破甲。";
  if (s.hook >= 0) return "松开 E 甩出 → 空格二段跳 → 再次抓住锚点。";
  if (s.y > -230)
    return "D 向右跃入井中 · 按住 E 抓住高亮锚点；松开时借力起飞。";
  if (s.y > -900) return "接近敌人按 J；钩住敌人也能回钩斩。S + J 向下坠星。";
  if (s.y > -1850) return "织缆者释放扇形飞弹。J 可斩断弹幕，K 冲刺穿过危险。";
  if (s.y > -2900)
    return "Q 释放断弦，消耗 60 弦能。侧翼的金色回声可补满弦能。";
  return "钟声来自更深处。S + 空格穿过脚下的平台。";
}
function receive(s) {
  window.latestState = s;
  if (fault) return;
  loading = false;
  document.body.classList.toggle("playing", s.phase !== 0);
  $("#health").innerHTML = Array.from(
    { length: s.maxHealth },
    (_, i) => `<i${i >= s.health ? ' class="empty"' : ""}></i>`,
  ).join("");
  $("#health").setAttribute("aria-label", `生命 ${s.health} / ${s.maxHealth}`);
  $("#energy").style.width = `${s.energy}%`;
  $("#energy").style.background = s.energy >= 60 ? "#ddcf9c" : "#86b5a8";
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
  $("#objective").textContent = ["寻找钟心", "打破守卫", "携心归来"][s.segment];
  $("#depth-marker").style.top =
    `${Math.max(0, Math.min(100, (-s.y / 3590) * 100))}%`;
  $("#hint").textContent = hint(s);
  $("#relics").textContent = `◈ ${s.echoes} / 3`;
  $("#combo").innerHTML =
    s.combo >= 2 ? `${s.combo} <small>AIR CHAIN</small>` : "";
  $("#boss").hidden = !(s.segment === 1 && s.phase === 1);
  $("#boss-health").style.width =
    `${(s.bossHP / (s.difficulty === 0 ? 16 : 20)) * 100}%`;
  $("#boss-state").textContent =
    s.bossShield > 0
      ? `钟锁 ${s.bossShield} / 2 · 拉断两侧吊环`
      : s.bossState === 2
        ? "破绽 · 现在攻击"
        : s.bossState === 1
          ? "钟鸣预警 · 准备闪避"
          : "重甲 · 坠星与回钩斩可破甲";
  $("#status").textContent =
    s.segment === 2
      ? `钟城下沉中 · 距黑潮 ${Math.max(0, Math.round((s.y - s.riseY) / 10))} m`
      : `${s.difficulty === 0 ? "旅人" : "无畏"} · 第 ${s.checkpoint + 1} 座休整灯 · ${s.kills} 次击破`;
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
      "钟城悬在深渊上方，已为无人之地守夜千年。\n你要潜入最深处，带走仍在跳动的钟心。",
      "进入钟城",
    );
    $("#difficulty").hidden = false;
    $("#overlay-foot").textContent =
      "电脑键盘操作 · 失败可从休整灯继续 · 按 1 / 2 切换难度";
  }
  if (s.phase === 1) {
    $("#overlay").hidden = true;
    $("#guide").hidden = true;
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
      overlay(
        "SOME HEARTS STILL BEAT",
        "最后一声，为你。",
        s.echoes === 3
          ? "你带回钟心，也找回了三段失落的记忆。\n城里的灯，终于可以为自己亮一次。"
          : "你带着钟心回到了光里。\n钟城深处，仍有尚未拾起的回声。",
        "再入钟城",
      );
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
    if (recordedAttempt !== s.attempts) {
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
  loading = true;
  fault = false;
  previousPhase = -1;
  window.latestState = null;
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
          let m = text.match(/@state\s+(.+)/);
          if (m) {
            const a = m[1].trim().split(/\s+/).map(Number);
            if (a.length >= fields.length && a.every(Number.isFinite))
              receive(Object.fromEntries(fields.map((f, i) => [f, a[i]])));
          }
          m = text.match(/@event\s+(\w+)\s+(\S+)\s+(\S+)\s+(\S+)/);
          if (m) onEvent(m[1], m[2], m[3], m[4]);
          if (!text.includes("@state")) original(...args);
        };
        w.onGameError(fail);
        w.onEngineCrash(fail);
        w.addEventListener("keydown", (e) => {
          if (e.code === "Enter") initAudio();
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
  else audio?.suspend();
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
  if (e.code === "Enter") initAudio();
  if (loading || e.repeat || e.target.closest("button")) return;
  if (["Enter", "Escape", "KeyR", "Digit1", "Digit2"].includes(e.code)) {
    e.preventDefault();
    if (e.code === "Enter") initAudio();
    key(e.code, e.key);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && window.latestState?.phase === 1)
    key("Escape", "Escape");
});
best();
load();
