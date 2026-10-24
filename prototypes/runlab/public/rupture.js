const $ = (s) => document.querySelector(s);
const games = {
  rupture: {
    name: "裂隙",
    scene: "01 / 风机墓场",
    kicker: "A CITY THAT NEVER STOPPED",
    intro:
      "窃走机器的动能，穿过正在失衡的遗迹。\n有些通路，只有在世界停下的瞬间才会出现。",
    challenge: "你获得的速度，来自这座城的某一次停转。",
    controls: [
      ["A / D", "移动"],
      ["SPACE", "跳跃"],
      ["E", "夺取 / 释放动能"],
      ["W + E", "向上释放"],
      ["R", "重新开始"],
    ],
  },
};
const fields = [
  "phase",
  "elapsed",
  "score",
  "combo",
  "bestCombo",
  "energy",
  "x",
  "y",
  "attempts",
  "steals",
  "launches",
  "styleCount",
  "failReason",
  "beat0",
  "beat1",
  "beat2",
  "beat3",
  "beat4",
  "beat5",
  "rotorCool",
  "liftCool",
  "bridgeY",
  "liftY",
  "vx",
  "vy",
  "cameraX",
  "cameraY",
  "pose",
  "bodyOffset",
  "fxCount",
  "rotorSpeed",
];
let current = "rupture",
  frame,
  token = 0,
  previousPhase = -1,
  loading = true,
  fault = false,
  toastTimer,
  runStartedAt;
let currentEvents = [],
  lastRecord = null,
  soundOn = false,
  audio;
window.latestState = null;
window.runtimeErrors = [];
window.runEvents = [];
let records = [];
try {
  records = JSON.parse(localStorage.getItem("runlab-rupture-v2") || "[]");
  if (!Array.isArray(records)) records = [];
} catch {}
function save() {
  try {
    localStorage.setItem(
      "runlab-rupture-v2",
      JSON.stringify(records.slice(-100)),
    );
  } catch {
    $("#save-status").textContent = "本机存储不可用，可导出本次记录";
  }
}
function best() {
  const wins = records.filter(
    (r) => r.game === current && r.result === "finish",
  );
  $("#best").textContent = wins.length
    ? current === "rupture"
      ? `本机最快 ${Math.min(...wins.map((r) => r.time)).toFixed(2)}s`
      : `本机最高 ${Math.max(...wins.map((r) => r.score))} 分`
    : "本机最佳 —";
}
function overlay(kicker, title, body, button) {
  $("#overlay").hidden = false;
  $("#overlay-kicker").textContent = kicker;
  $("#overlay-title").textContent = title;
  $("#overlay-body").textContent = body;
  $("#play").hidden = !button;
  $("#play").innerHTML = button ? `${button} <span>↗</span>` : "";
  $("#feedback").hidden = true;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 1100);
}
function tone(name) {
  if (!soundOn || !audio) return;
  if (
    ["step", "land", "jump", "launch", "turbine", "lift", "collapse"].includes(
      name,
    )
  ) {
    // Short, layered material cues: filtered air/water, low impact, and metal.
    // Kept opt-in; visual feedback carries the same information without audio.
    const spec = {
      step: [0.07, 0.018, 1100, 150],
      land: [0.25, 0.1, 900, 68],
      jump: [0.13, 0.032, 1600, 120],
      launch: [0.42, 0.09, 3800, 58],
      turbine: [0.48, 0.07, 2400, 95],
      lift: [0.3, 0.06, 2100, 130],
      collapse: [0.6, 0.075, 1700, 48],
    }[name];
    const [duration, volume, cutoff, bass] = spec;
    const now = audio.currentTime;
    const buffer = audio.createBuffer(
      1,
      Math.ceil(audio.sampleRate * duration),
      audio.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource(),
      filter = audio.createBiquadFilter(),
      gain = audio.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    if (name !== "step") {
      const low = audio.createOscillator(),
        envelope = audio.createGain();
      low.frequency.setValueAtTime(bass * 1.7, now);
      low.frequency.exponentialRampToValueAtTime(bass, now + 0.16);
      envelope.gain.setValueAtTime(volume * 0.55, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      low.connect(envelope);
      envelope.connect(audio.destination);
      low.start();
      low.stop(now + 0.24);
      low.onended = () => {
        low.disconnect();
        envelope.disconnect();
      };
    }
    return;
  }
  const freqs = {
    steal: 660,
    turbine: 130,
    lift: 195,
    echo: 880,
    launch: 220,
    jump: 360,
    vault: 460,
    spin: 700,
    beat: 880,
    fail: 90,
    finish: 1040,
    empty: 140,
  };
  if (!freqs[name]) return;
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = name === "fail" ? "triangle" : "sine";
  o.frequency.setValueAtTime(freqs[name], audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(
    freqs[name] * (name === "fail" ? 0.5 : 1.5),
    audio.currentTime + 0.12,
  );
  g.gain.setValueAtTime(0.055, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.17);
}
function focusGame() {
  frame?.contentWindow?.document.querySelector("#game-canvas")?.focus();
}
function key(code, key = code) {
  const w = frame?.contentWindow,
    c = w?.document.querySelector("#game-canvas");
  if (!c) return;
  focusGame();
  const legacy = { Enter: 13, KeyR: 82, Escape: 27 }[code];
  c.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      code,
      key,
      keyCode: legacy,
      which: legacy,
      bubbles: true,
    }),
  );
  setTimeout(
    () =>
      c.isConnected &&
      c.dispatchEvent(
        new w.KeyboardEvent("keyup", {
          code,
          key,
          keyCode: legacy,
          which: legacy,
          bubbles: true,
        }),
      ),
    70,
  );
}
function onEvent(name, t, x) {
  const e = { name, time: Number(t), x: Number(x) };
  window.runEvents.push(e);
  if (window.runEvents.length > 500) window.runEvents.shift();
  if (name === "start") {
    runStartedAt = new Date().toISOString();
    currentEvents = [];
    lastRecord = null;
    $("#feedback").hidden = true;
    document
      .querySelectorAll("[data-feedback]")
      .forEach((b) => b.classList.remove("voted"));
  }
  currentEvents.push(e);
  tone(name);
  if (name === "launch") {
    const fx = $("#impact");
    fx.classList.remove("burst");
    void fx.offsetWidth;
    fx.classList.add("burst");
  }
  const labels = {
    turbine: "风机停转 · 桥梁失压",
    lift: "升降机构已冻结",
    echo: "失落回声 +500",
    steal: "动能已捕获 · 再按 E 释放",
    launch: "释放动能",
    vault: "流畅翻越",
    spin: "空中特技",
    beat: "镜头完成",
    miss: "镜头错过 · 继续跑",
    empty: "靠近风机或升降机构，夺取动能",
  };
  if (labels[name]) toast(labels[name]);
}
function hint(s) {
  if (s.phase !== 1) return "";
  if (s.x < 620) return "前方的风机仍在运转。靠近它，按 E 夺取动能。";
  if (s.x < 1340) {
    if (s.energy) return "桥梁开始失压。向前跑到风机附近，再按 E 冲出。";
    if (s.rotorCool <= 0) return "危险叶片阻挡通路 · 按 E 让风机停转。";
    return "越过断桥 · 在前方平台落地。";
  }
  if (s.x < 1900) return "前方是升降机构。夺取动能，可以把它锁在当前高度。";
  if (s.x < 2680) {
    if (s.energy) return "E 冲向远端 / W + E 跃上高处 · 上层有一枚失落回声。";
    return "寻找落脚点 · 空格跳跃，继续向右。";
  }
  return "穿过风暴，抵达最后的灯火。";
}
function receive(s) {
  window.latestState = s;
  if (fault) return;
  document.body.classList.add("ready");
  $("#time").textContent = s.elapsed.toFixed(2).padStart(5, "0");
  $("#score").textContent = String(s.score).padStart(4, "0");
  $("#attempt").textContent = s.attempts
    ? `第 ${s.attempts} 次穿行`
    : "一段失衡的旅程";
  $("#scene-name").textContent =
    s.x < 1340
      ? "01 / 风机墓场"
      : s.x < 2680
        ? "02 / 悬空升降井"
        : "03 / 最后的灯火";
  $("#progress").style.width =
    `${Math.max(0, Math.min(100, ((s.x - 150) / 3090) * 100))}%`;
  $("#mechanic-state").textContent = s.energy
    ? "◈ 动能就绪 · E 释放"
    : "◇ 动能为空 · 从运转的机器中夺取";
  $("#beats").textContent = s.styleCount
    ? "失落回声 · 已回收"
    : s.rotorCool > 0 && s.x < 1340
      ? `风机锁止 ${Math.ceil(s.rotorCool)}s`
      : s.liftCool > 0 && s.x < 2680
        ? `升降锁止 ${Math.ceil(s.liftCool)}s`
        : "";
  $("#world-hint").textContent = hint(s);
  $("#pause").disabled = ![1, 4].includes(s.phase);
  $("#pause").textContent = s.phase === 4 ? "继续 Esc" : "暂停 Esc";
  if (s.phase === previousPhase) return;
  previousPhase = s.phase;
  loading = false;
  if (s.phase === 0)
    overlay(
      games[current].kicker,
      "窃走速度。\n让世界失衡。",
      games[current].intro,
      "进入遗迹",
    );
  if (s.phase === 1) {
    $("#overlay").hidden = true;
    $("#feedback").hidden = true;
  }
  if (s.phase === 4)
    overlay(
      "THE STORM CAN WAIT",
      "停留片刻。",
      "按 Enter 或 Esc，继续这一段穿行。",
      "继续穿行",
    );
  if (s.phase === 2 || s.phase === 3) {
    const finish = s.phase === 2;
    lastRecord = {
      id: crypto.randomUUID(),
      game: current,
      date: runStartedAt || new Date().toISOString(),
      result: finish ? "finish" : "fail",
      time: s.elapsed,
      score: s.score,
      styleCount: s.styleCount,
      steals: s.steals,
      launches: s.launches,
      failReason: s.failReason,
      events: [...currentEvents],
      feedback: null,
    };
    records.push(lastRecord);
    save();
    best();
    if (finish)
      overlay(
        "BEYOND THE RUPTURE",
        "你穿过了裂隙。",
        `${s.elapsed.toFixed(2)} 秒 · ${s.score} 分\n${s.styleCount ? "你带回了高处的失落回声。" : "升降井上层还有一枚失落回声。用 W + E 试试另一条路。"}`,
        "再次穿行",
      );
    else {
      const reason = {
        1: "落点消失在风暴里。夺取动能后，利用冲刺跨越断口。",
        3: "风暴已经吞没通路。再试一次。",
        4: "风机仍在运转。接近后按 E 夺取动能，让叶片停下。",
      };
      overlay(
        "THE CITY TAKES ITS TOLL",
        "遗迹留下了你。",
        reason[s.failReason] || "按 R，从起点重新开始。",
        "重新出发",
      );
    }
    $("#feedback").hidden = false;
  }
}
function fail(error) {
  fault = true;
  loading = false;
  window.runtimeErrors.push(String(error));
  $("#pause").disabled = true;
  overlay(
    "LOAD INTERRUPTED",
    "加载没有完成",
    String(error).slice(0, 400),
    "重新加载",
  );
  $("#overlay-body").classList.add("error");
}
async function loadGame(id) {
  const mine = ++token;
  current = id;
  loading = true;
  fault = false;
  previousPhase = -1;
  window.latestState = null;
  window.runtimeErrors = [];
  window.runEvents = [];
  currentEvents = [];
  lastRecord = null;
  document.body.dataset.game = id;
  document.body.classList.remove("ready");
  document.querySelectorAll("[data-select]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.select === id);
    b.setAttribute("aria-pressed", String(b.dataset.select === id));
  });
  $("#scene-name").textContent = games[id].scene;
  $("#controls").innerHTML = games[id].controls
    .map(
      ([k, v]) => `<div class="control"><kbd>${k}</kbd><span>${v}</span></div>`,
    )
    .join("");
  $("#challenge").textContent = games[id].challenge;
  $("#overlay-body").classList.remove("error");
  $("#feedback").hidden = true;
  $("#pause").disabled = true;
  $("#world-hint").textContent = "";
  $("#beats").innerHTML = "";
  $("#progress").style.width = "0";
  $("#score").textContent = "0000";
  $("#time").textContent = "00.00";
  $("#attempt").textContent = "等待起跑";
  $("#mechanic-state").textContent = "准备就绪后，按 Enter 起跑";
  best();
  overlay(
    "ENTER THE RUPTURE",
    "正在唤醒遗迹",
    "正在加载本地游戏引擎与关卡。",
    null,
  );
  frame?.remove();
  frame = document.createElement("iframe");
  frame.title = `${games[id].name} 游戏画面`;
  frame.src = "/runtime/runner.html";
  const thisFrame = frame;
  const ready = new Promise((resolve, reject) => {
    thisFrame.onload = resolve;
    thisFrame.onerror = reject;
  });
  $("#stage").replaceChildren(thisFrame);
  resize();
  let timeout;
  try {
    await Promise.race([
      (async () => {
        await ready;
        if (mine !== token) return;
        const w = thisFrame.contentWindow;
        const forward = (...args) => {
          const text = args.map(String).join(" ");
          let m = text.match(/@state\s+(.+)/);
          if (m) {
            const values = m[1].trim().split(/\s+/).map(Number);
            if (
              values.length >= fields.length &&
              values.every(Number.isFinite) &&
              mine === token
            )
              receive(Object.fromEntries(fields.map((f, i) => [f, values[i]])));
          }
          m = text.match(/@event\s+(\w+)\s+(\S+)\s+(\S+)/);
          if (m && mine === token) onEvent(m[1], m[2], m[3]);
        };
        const original = w.console.log.bind(w.console);
        w.console.log = (...args) => {
          forward(...args);
          if (!args.map(String).join(" ").includes("@state")) original(...args);
        };
        w.onGameError((e) => mine === token && fail(e));
        w.onEngineCrash((e) => mine === token && fail(e));
        w.addEventListener("keydown", (e) => {
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
        if (mine !== token) return;
        $("#overlay-body").textContent = "引擎已就绪，正在编译关卡。";
        const data = await fetch(`/${id}.json`).then((r) => r.json());
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
        if (mine !== token) return;
        await w.startGame();
      })(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("加载超时，请重新加载。")),
          25000,
        );
      }),
    ]);
  } catch (e) {
    if (mine === token) fail(e.message || e);
  } finally {
    clearTimeout(timeout);
  }
}
function resize() {
  if (frame)
    frame.style.transform = `scale(${$("#viewport").clientWidth / 960})`;
}
new ResizeObserver(resize).observe($("#viewport"));
document.querySelectorAll("[data-select]").forEach((b) =>
  b.addEventListener("click", () => {
    if (b.dataset.select !== current) loadGame(b.dataset.select);
  }),
);
$("#play").addEventListener("click", () => {
  if (fault) {
    loadGame(current);
    return;
  }
  audio?.resume();
  $(".play-panel").scrollIntoView({ block: "center", behavior: "smooth" });
  key("Enter", "Enter");
});
$("#pause").addEventListener("click", () => key("Escape", "Escape"));
$("#sound").addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn) {
    audio ??= new AudioContext();
    audio.resume();
  }
  $("#sound").textContent = `音效 ${soundOn ? "开" : "关"}`;
  $("#sound").setAttribute("aria-pressed", String(soundOn));
  focusGame();
});
document.querySelectorAll("[data-feedback]").forEach((b) =>
  b.addEventListener("click", () => {
    if (!lastRecord) return;
    lastRecord.feedback = b.dataset.feedback;
    save();
    document
      .querySelectorAll("[data-feedback]")
      .forEach((x) => x.classList.toggle("voted", x === b));
    toast("已记下你的直觉");
  }),
);
$("#export").addEventListener("click", () => {
  const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), records },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "rupture-playtests.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("keydown", (e) => {
  if (loading || e.repeat || e.target.tagName === "BUTTON") return;
  if (["Enter", "KeyR", "Escape"].includes(e.code)) {
    e.preventDefault();
    key(e.code, e.key);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && window.latestState?.phase === 1)
    key("Escape", "Escape");
});
loadGame(current);

$("#fullscreen").addEventListener("click", async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await $(".play-panel").requestFullscreen();
  focusGame();
});
