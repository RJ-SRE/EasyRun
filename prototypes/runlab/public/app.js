const $ = (s) => document.querySelector(s);
const games = {
  velocity: {
    name: "盗速者",
    scene: "KINETIC DISTRICT / 04",
    kicker: "STEAL. STORE. RELEASE.",
    intro:
      "靠近发光的运输车，按 E 偷走动能。\n在断桥前再按 E，释放一次高速跨越。",
    challenge: "先完成三次动能接力；再尝试从高处释放，找到更快的落点。",
    controls: [
      ["A / D", "左右移动"],
      ["SPACE", "跳跃 · 长按更高"],
      ["E / SHIFT", "吸取 / 释放动能"],
      ["W + E", "向上释放"],
      ["R", "立即重来"],
    ],
  },
  cinema: {
    name: "一镜到底",
    scene: "THE NIGHT SHIFT / TAKE 01",
    kicker: "MAKE EVERY MOVE COUNT.",
    intro:
      "靠近木箱按 E 翻越，按住 S 滑过横梁。\n跳过断口时，在空中按 E 完成特技。",
    challenge:
      "一条路线，六个镜头。普通跳跃也能通过木箱，连贯的特技会让这一条更漂亮。",
    controls: [
      ["A / D", "左右移动"],
      ["SPACE", "跳跃 · 长按更高"],
      ["E / SHIFT", "翻越 / 空中特技"],
      ["S / ↓", "按住滑行"],
      ["R", "立即重来"],
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
];
let current = "velocity",
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
  records = JSON.parse(localStorage.getItem("runlab-v1") || "[]");
  if (!Array.isArray(records)) records = [];
} catch {}
function save() {
  try {
    localStorage.setItem("runlab-v1", JSON.stringify(records.slice(-100)));
  } catch {
    $("#save-status").textContent = "本机存储不可用，可导出本次记录";
  }
}
function best() {
  const wins = records.filter(
    (r) => r.game === current && r.result === "finish",
  );
  $("#best").textContent = wins.length
    ? current === "velocity"
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
  const freqs = {
    steal: 660,
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
  const labels = {
    steal: "动能已捕获 · 再按 E 释放",
    launch: "动能释放",
    vault: "流畅翻越",
    spin: "空中特技",
    beat: "镜头完成",
    miss: "镜头错过 · 继续跑",
    empty: "靠近发光运输车，再按 E",
  };
  if (labels[name]) toast(labels[name]);
}
function hint(s) {
  if (s.phase !== 1) return "";
  if (current === "velocity") {
    if (s.energy) return "动能就绪 · 断桥前按 E 释放 / W + E 向上飞跃";
    if (s.x < 550) return "按住 D 前进 · 运输车在前方";
    if (s.x < 1060 || (s.x > 2200 && s.x < 2820) || (s.x > 4100 && s.x < 4720))
      return "靠近发光的运输车 · 按 E 吸取动能";
    return "调整落点 · 继续向终点前进";
  }
  if (s.x < 1000 || (s.x > 3850 && s.x < 4400))
    return "木箱前约一个身位按 E · 翻越";
  if (s.x < 2100 || (s.x > 4900 && s.x < 5510))
    return "横梁前按住 S · 保持滑行直到通过";
  if (s.x < 3100 || (s.x > 5600 && s.x < 6340))
    return "断口边缘长按 SPACE 跳跃 · 空中按 E 做特技";
  return "保持连贯 · 下一组镜头在前方";
}
function receive(s) {
  window.latestState = s;
  if (fault) return;
  $("#time").textContent = s.elapsed.toFixed(2).padStart(5, "0");
  $("#score").textContent = String(s.score).padStart(4, "0");
  $("#attempt").textContent = s.attempts
    ? `第 ${s.attempts} 次尝试`
    : "等待起跑";
  $("#progress").style.width =
    `${Math.max(0, Math.min(100, ((s.x - 110) / 6740) * 100))}%`;
  $("#mechanic-state").textContent =
    current === "velocity"
      ? s.energy
        ? "◉ 动能已充满 · E 释放"
        : `○ 动能待捕获 · 已完成 ${s.launches} 次释放`
      : `镜头 ${s.styleCount} / 6 · 连贯 ${s.combo} · 最佳连贯 ${s.bestCombo}`;
  $("#beats").innerHTML =
    current === "cinema"
      ? Array.from(
          { length: 6 },
          (_, i) =>
            `<i class="${s["beat" + i] === 1 ? "hit" : s["beat" + i] === -1 ? "missed" : ""}" title="镜头 ${i + 1}"></i>`,
        ).join("")
      : "";
  $("#world-hint").textContent = hint(s);
  $("#pause").disabled = s.phase === 0 || s.phase === 2 || s.phase === 3;
  $("#pause").textContent = s.phase === 4 ? "继续 Esc" : "暂停 Esc";
  if (s.phase === previousPhase) return;
  previousPhase = s.phase;
  loading = false;
  if (s.phase === 0) {
    overlay(
      games[current].kicker,
      games[current].name,
      games[current].intro,
      "开始奔跑",
    );
  }
  if (s.phase === 1) {
    $("#overlay").hidden = true;
    $("#feedback").hidden = true;
  }
  if (s.phase === 4) {
    overlay(
      "TAKE A BREATH",
      "暂停一下",
      "按 Enter / Esc 继续这一局。",
      "继续奔跑",
    );
  }
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
      bestCombo: s.bestCombo,
      steals: s.steals,
      launches: s.launches,
      failReason: s.failReason,
      events: [...currentEvents],
      feedback: null,
    };
    records.push(lastRecord);
    save();
    best();
    if (finish) {
      const title =
        current === "velocity"
          ? "动能接力，完成。"
          : s.styleCount === 6
            ? "漂亮！六个镜头，一气呵成。"
            : "杀青！这条还能更漂亮。";
      overlay(
        "RUN COMPLETE",
        title,
        current === "velocity"
          ? `${s.elapsed.toFixed(2)} 秒 / ${s.steals} 次捕获 / ${s.score} 分\n下次试试更早释放，或从高处寻找落点。`
          : `${s.elapsed.toFixed(2)} 秒 / ${s.score} 分 / 镜头 ${s.styleCount} / 6\n${s.styleCount < 6 ? "通过路线只是开始。再试一条完整的特技连贯。" : "动作已经连起来了。试着再压缩这一条的时间。"}`,
        "再跑一次",
      );
    } else {
      const reasons = {
        1:
          current === "velocity"
            ? "落点差了一点。先偷取动能，接近断桥再释放。"
            : "没能跨过断口。在边缘起跳，长按跳跃键会跳得更远。",
        2: "撞到布景了。木箱前翻越，横梁前提前按住 S。",
        3: "这条超过了 60 秒。路线已经熟悉了，再来一次。",
      };
      overlay(
        "ONE MORE TAKE",
        current === "velocity" ? "重整动能，再来。" : "这条重拍。",
        reasons[s.failReason] || "按 R 可以随时重新开始。",
        "立即重来",
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
    "PREPARING THE CITY",
    "正在搭建跑道",
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
                content: new TextEncoder().encode(s).buffer,
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
  a.download = "runlab-playtests.json";
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
