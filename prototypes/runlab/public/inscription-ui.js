import { InscriptionMotion } from "./inscription-motion.js";
import {
  InscriptionBook,
  BANK,
  STORAGE_KEY,
  allowance,
  matches,
} from "./inscription-core.js";
const $ = (s) => document.querySelector(s);
const titles = {
  1: ["贯夜 · 蓄弦", "贯穿两敌 · 留下裂印"],
  2: ["断潮 · 蓄锋", "满蓄重斩 · 引爆裂印"],
  3: ["回息 · 余烬", "生命 +1 · 未完成返还余烬"],
  4: ["连环剑刀 · 终式", "解放末两击"],
  5: ["缚索 · 解链", "斩链反制 · 未完成仍可脱离"],
  6: ["封脉 · 破缚", "拆招反击 · 未完成安全脱身"],
};
const sealPaths = {
  1: "M25 17Q48 32 25 47L33 32Z M22 32H45m-5-5 5 5-5 5",
  2: "M24 44L43 18Q45 32 27 43M21 40l9 9M22 47l5-5",
  3: "M32 16L37 27 48 32 37 37 32 48 27 37 16 32 27 27Z M32 24v16M24 32h16",
  4: "M22 17L43 47M43 17L22 47M17 25L47 39M17 39L47 25",
  5: "M28 24l-5-5-8 8 10 10 5-5M36 40l5 5 8-8-10-10-5 5M25 40l14-16",
  6: "M18 20l11 10-9 14M46 20L35 30l9 14M32 17v7M32 40v7",
};
export class InscriptionUI {
  constructor({ send, focus, toast, audio, onSettle = () => {} }) {
    this.onSettle = onSettle;
    this.send = send;
    this.focus = focus;
    this.toast = toast;
    this.audio = audio;
    let saved;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      this.storageBlocked = true;
    }
    this.book = new InscriptionBook(saved, this.seed());
    if (new URLSearchParams(location.search).get("words") === "off")
      this.book.settings.enabled = false;
    this.sessionId = crypto.randomUUID();
    try {
      this.bootResume = sessionStorage.getItem("belfry-resume") === "1";
      sessionStorage.removeItem("belfry-resume");
    } catch {
      this.bootResume = false;
    }
    this.epoch = 0;
    this.held = new Set();
    this.quarantine = new Set();
    this.last = performance.now();
    this.lastSave = 0;
    this.create();
    this.motion = new InscriptionMotion();
    this.capture(window);
    this.renderMenu();
    this.renderBook();
    if (this.book.notice) this.toast(this.book.notice);
    window.addEventListener("pagehide", () => this.save());
    document.addEventListener("visibilitychange", () => {
      this.last = performance.now();
      if (document.hidden && this.active) this.pause("窗口已隐藏，计时已暂停");
      this.save();
    });
    requestAnimationFrame((t) => this.tick(t));
    Object.defineProperty(window, "inscriptionDiagnostics", {
      get: () => ({
        active: this.active ? { ...this.active, input: this.input } : null,
        count: this.book.count,
        pool: [...this.book.run.pool],
        pending: this.book.run.reserved,
        settings: { ...this.book.settings },
        run: JSON.parse(JSON.stringify(this.book.run)),
        paused: this.paused,
        storageBlocked: !!this.storageBlocked,
        motion: this.motion.diagnostics(),
        lastRelease: this.lastRelease,
      }),
    });
  }
  seed() {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  create() {
    const menu = document.createElement("section");
    menu.id = "word-menu";
    menu.hidden = true;
    menu.innerHTML = `
      <header class="word-loadout-head">
        <span class="word-loadout-seal" aria-hidden="true">ⅩⅩⅩ</span>
        <div><span class="eyebrow">THE INSCRIPTION OATH</span><h2>铭文远征</h2></div>
      </header>
      <label class="word-switch"><input id="word-enabled" type="checkbox"><span>以词解放刀锋</span><small>拼写 / 辨义</small></label>
      <div class="word-settings">
        <label>词汇范围<select id="word-tier"><option value="foundation">基础</option><option value="standard">标准</option><option value="challenge">挑战</option></select></label>
        <label>作答节奏<select id="word-pace"><option value="relaxed">宽裕</option><option value="standard">标准</option><option value="brisk">紧凑</option></select></label>
        <label>拼写提示<select id="word-hint"><option value="guided">完整提示</option><option value="standard">渐隐提示</option><option value="recall">回忆</option></select></label>
      </div>
      <div class="word-actions"><button id="word-preview"><span>随行词册</span><b>30 <i>↗</i></b></button><button id="word-shuffle" aria-label="更换本次远征的 30 个单词">换一组</button></div>
      <p class="word-note">只在关键释放时刻显现。<br>普攻、钩索不断奏，通关无需全清。</p>
      <button id="word-continue" class="secondary" hidden>续行上次远征 ↗</button>
      <p id="word-storage" role="status"></p>`;
    $("#viewport").append(menu);
    const hud = document.createElement("button");
    hud.id = "word-progress";
    hud.hidden = true;
    hud.onclick = () => this.openBook();
    $("#viewport").append(hud);
    const journal = document.createElement("section");
    journal.id = "word-journal";
    journal.className = "guide";
    journal.hidden = true;
    journal.setAttribute("role", "dialog");
    journal.setAttribute("aria-modal", "true");
    journal.setAttribute("aria-labelledby", "word-ledger-title");
    journal.innerHTML = `<div class="word-ledger-page">
      <header class="word-ledger-head"><div><span class="eyebrow">FIELD LEDGER / XXX</span><h2 id="word-ledger-title">随行铭文</h2></div><button id="word-close" aria-label="合上词册">×</button></header>
      <p id="word-summary"></p><div id="word-ledger-track" aria-hidden="true"></div>
      <div class="word-legend">○ 待遇见 <span>◐ 待复习</span> ◆ 已斩 <span>✦ 通关确认</span></div>
      <div id="word-list"></div>
      <footer><p class="word-note">通关只确认实际答对的词。</p><button id="word-export">导出词册 ↗</button></footer>
    </div>`;
    $("#viewport").append(journal);
    const panel = document.createElement("section");
    panel.id = "word-focus";
    panel.hidden = true;
    panel.tabIndex = -1;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "word-title");
    panel.innerHTML = `<div class="word-focus-card">
      <div class="word-seal" aria-hidden="true"><svg viewBox="0 0 64 64">
        <circle class="seal-outer" cx="32" cy="32" r="29"/>
        <circle class="seal-track" cx="32" cy="32" r="25"/>
        <circle id="word-timer-fill" cx="32" cy="32" r="25" pathLength="100"/>
        <path class="seal-notch" d="M32 0v8M56 8l-6 6M64 32h-8M32 56v8M8 50l6-6M0 32h8"/>
        <path id="word-seal-icon"/>
      </svg><span id="word-time"></span><span class="seal-caption">时 隙</span></div>
      <div class="word-ritual">
        <header class="word-focus-head"><h2 id="word-title"></h2><span id="word-mode"></span></header>
        <div id="word-cue"></div><p id="word-context"></p>
        <div id="word-spelling"><div id="word-glyphs" aria-hidden="true"></div><input id="word-input" type="text" inputmode="latin" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="输入英文单词" aria-describedby="word-letter-feedback"><span id="word-letter-feedback"></span></div>
        <div id="word-options"></div>
      </div>
      <footer class="word-focus-foot"><p id="word-benefit"></p><p id="word-feedback" role="status"></p><small class="word-key-hint"><kbd>Esc</kbd> 暂停</small></footer>
      <div id="word-pause" hidden><b id="word-pause-label">铭文已暂停</b><button id="word-resume">继续作答</button><button id="word-abandon">放弃本次释放</button></div>
    </div>`;
    $("#viewport").append(panel);
    $("#word-preview").onclick = () => this.openBook();
    $("#word-close").onclick = () => this.closeBook();
    $("#word-shuffle").onclick = () => {
      this.book.newPool(this.seed());
      this.save();
      this.renderMenu();
      this.renderBook();
      this.toast("已更换 30 词；预览不会计入进度。");
    };
    $("#word-enabled").onchange = (e) => {
      this.book.settings.enabled = e.target.checked;
      this.internal("F4");
      this.save();
      this.renderMenu();
    };
    for (const name of ["tier", "pace", "hint"])
      $(`#word-${name}`).onchange = (e) => {
        this.book.settings[name] = e.target.value;
        if (name === "tier") {
          this.book.newPool(this.seed());
          this.toast("词汇范围已改变，已重新抽取 30 词。");
        }
        this.save();
        this.renderMenu();
        this.renderBook();
      };
    $("#word-continue").onclick = () => {
      this.save();
      try {
        sessionStorage.setItem("belfry-resume", "1");
        location.reload();
      } catch {
        this.toast("无法建立恢复记录，请导出词册后开始新旅程。");
      }
    };
    $("#word-resume").onclick = () => {
      if (this.paused) this.internal("F6");
      this.paused = false;
      this.audio.pauseFocus(false);
      document.body.classList.remove("word-focus-paused");
      this.composing = false;
      $("#word-pause").hidden = true;
      this.focusAnswer();
    };
    $("#word-abandon").onclick = () => {
      if (this.paused) this.internal("F6");
      this.paused = false;
      this.audio.pauseFocus(false);
      document.body.classList.remove("word-focus-paused");
      $("#word-pause").hidden = true;
      this.finish(false, "放弃");
    };
    const restart = document.createElement("button");
    restart.id = "word-restart";
    restart.textContent = "重开本局 · 保留词组";
    restart.onclick = () => {
      this.cancel();
      this.send("KeyR", "r");
    };
    $("#word-pause").append(restart);
    $("#word-input").addEventListener("compositionstart", () => {
      this.composing = true;
      this.pause("请切换至英文输入法，再继续作答");
    });
    $("#word-input").addEventListener("compositionend", () => {
      this.composing = false;
      $("#word-input").value = this.input || "";
    });
    $("#word-input").addEventListener("paste", (e) => e.preventDefault());
    $("#word-export").onclick = () => {
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              { ...this.book.data, exportedAt: new Date().toISOString() },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "belfry-inscriptions.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const back = document.createElement("button");
    back.id = "word-to-menu";
    back.className = "secondary";
    back.textContent = "保存进度并返回标题";
    back.hidden = true;
    back.onclick = () => {
      this.save();
      this.send("KeyM", "m");
    };
    $(".overlay-content").append(back);
    const reduced = document.createElement("label");
    reduced.innerHTML = `减少闪光与界面动效<input id="word-reduced" type="checkbox">`;
    $("#settings-panel > div").append(reduced);
    $("#word-reduced").checked = this.book.settings.reduced;
    document.body.classList.toggle(
      "reduced-effects",
      this.book.settings.reduced,
    );
    $("#word-reduced").onchange = (e) => {
      this.book.settings.reduced = e.target.checked;
      document.body.classList.toggle("reduced-effects", e.target.checked);
      this.save();
    };
  }
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, this.book.serialize());
      this.storageBlocked = false;
    } catch {
      this.storageBlocked = true;
    }
    $("#word-storage").textContent = this.storageBlocked
      ? "无法保存到本机，请在词册中导出记录。"
      : "进度保存在当前浏览器。";
  }
  configure(data) {
    const r = this.book.run,
      s = r.snapshot;
    const integer = (v, max) =>
      Number.isInteger(v) && v >= 0 && v <= max ? v : 0;
    const finite = (v) =>
      Number.isFinite(v) && v >= 0 ? Math.min(v, 1000000) : 0;
    const checkpoint = s && r.started && !r.won ? integer(s.checkpoint, 4) : -1;
    data["main.spx"] = data["main.spx"].replace(
      "// HOST_CONFIGURATION",
      `wordMode=${this.book.settings.enabled ? 1 : 0}; hostCheckpoint=${checkpoint}; hostSegment=${integer(s?.segment, 2)}; hostElapsed=${finite(s?.elapsed)}; hostScore=${integer(s?.score, 10000000)}; difficulty=${integer(s?.difficulty, 1)}`,
    );
  }
  attach(w) {
    this.engine = w;
    this.epoch++;
    this.active = null;
    this.capture(w);
  }
  internal(key) {
    const w = this.engine,
      c = w?.document.querySelector("#game-canvas");
    if (!c) return;
    const code = key,
      keyCode = 111 + Number(key.slice(1));
    for (const type of ["keydown", "keyup"]) {
      const e = new w.KeyboardEvent(type, {
        code,
        key,
        keyCode,
        which: keyCode,
        bubbles: true,
      });
      Object.defineProperty(e, "inscriptionTransport", { value: true });
      c.dispatchEvent(e);
    }
  }
  releaseHeld() {
    const w = this.engine,
      c = w?.document.querySelector("#game-canvas");
    if (!c) return;
    for (const code of this.held) {
      const keyCode = code.startsWith("Key")
        ? code.charCodeAt(3)
        : {
            Space: 32,
            ArrowLeft: 37,
            ArrowUp: 38,
            ArrowRight: 39,
            ArrowDown: 40,
            ShiftLeft: 16,
          }[code] || 0;
      const e = new w.KeyboardEvent("keyup", {
        code,
        keyCode,
        which: keyCode,
        bubbles: true,
      });
      Object.defineProperty(e, "inscriptionTransport", { value: true });
      c.dispatchEvent(e);
    }
    this.held.clear();
  }
  lockHeld() {
    for (const code of this.held) this.quarantine.add(code);
    this.releaseHeld();
  }
  capture(w) {
    w.addEventListener(
      "keydown",
      (e) => {
        if (e.inscriptionTransport) return;
        if (
          (e.metaKey || e.ctrlKey) &&
          ["KeyR", "KeyL", "KeyW"].includes(e.code)
        )
          return;
        const block = () => {
          e.preventDefault();
          e.stopImmediatePropagation();
        };
        if (
          (/^(?:Key)?F[1-5]$/.test(e.code) ||
            (e.code === "F6" && this.state?.phase === 5)) &&
          (this.book.settings.enabled || this.state?.phase !== 1)
        ) {
          block();
          return;
        }
        if (this.quarantine.has(e.code)) {
          block();
          return;
        }
        if (!$("#word-journal").hidden) {
          if (e.code === "Escape") this.closeBook();
          else if (!e.repeat && ["Enter", "Space"].includes(e.code))
            e.target.closest?.("#word-journal button")?.click();
          if (e.code !== "Tab") block();
          return;
        }
        if (!this.active) {
          this.held.add(e.code);
          return;
        }
        if (e.code === "Tab") return;
        block();
        this.held.add(e.code);
        if (e.code === "Escape") {
          if (this.paused && !this.composing) $("#word-resume").click();
          else this.pause("铭文已暂停");
          return;
        }
        if (e.isComposing || e.keyCode === 229) {
          this.composing = true;
          this.pause("请切换至英文输入法，再继续作答");
          return;
        }
        if (!e.repeat && ["Enter", "Space"].includes(e.code)) {
          const button = e.target.closest?.("#word-focus button");
          if (button) {
            button.click();
            return;
          }
        }
        if (this.paused || this.active.result) return;
        if (this.active.q.type === "spell") {
          if (e.code === "Backspace") this.input = this.input.slice(0, -1);
          else if (
            /^[a-zA-Z]$/.test(e.key) &&
            !e.repeat &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          )
            this.input = (this.input + e.key.toLowerCase()).slice(0, 32);
          this.updateInput();
        } else if (!e.repeat && /^[123]$/.test(e.key))
          this.choose(Number(e.key) - 1);
      },
      true,
    );
    w.addEventListener(
      "keyup",
      (e) => {
        if (e.inscriptionTransport) return;
        this.held.delete(e.code);
        this.entryHeld?.delete(e.code);
        if (this.quarantine.delete(e.code) || this.active) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    w.addEventListener("blur", () => {
      if (this.active && !document.hasFocus())
        this.pause("焦点已离开游戏，计时已暂停");
    });
  }
  onEvent(name) {
    if (this.active?.sent && this.state?.phase === 5)
      this.audio.stateChanged({ ...this.state, phase: 1 });
    if (name === "start") this.startSeen = true;
  }
  receive(s) {
    if (this.bootResume && s.phase === 0) {
      this.bootResume = false;
      this.resuming = true;
      setTimeout(() => this.internal("F5"), 0);
    }
    if (this.startSeen && s.phase === 1) {
      this.startSeen = false;
      if (!s.practice && this.book.settings.enabled) {
        if (!this.resuming) this.book.restart();
        this.book.begin(s.attempts);
        this.resuming = false;
        this.save();
        this.renderBook();
      }
    }
    if (
      s.phase === 2 &&
      !s.practice &&
      this.book.settings.enabled &&
      !this.book.run.won
    ) {
      this.book.victory();
      this.save();
    }
    this.state = s;
    if (
      [1, 3, 4].includes(s.phase) &&
      !s.practice &&
      this.book.settings.enabled &&
      this.book.run.started
    )
      this.book.run.snapshot = {
        checkpoint: s.checkpoint,
        segment: s.segment,
        elapsed: s.elapsed,
        score: s.score,
        difficulty: s.difficulty,
      };
    if (
      this.active &&
      (s.attempts !== this.active.attempt || ![1, 5].includes(s.phase))
    )
      this.cancel();
    $("#word-menu").hidden = s.phase !== 0;
    document.body.classList.toggle("word-title-screen", s.phase === 0);
    $("#word-to-menu").hidden = s.phase !== 4;
    $("#word-progress").hidden =
      !this.book.settings.enabled ||
      s.practice ||
      ![1, 2, 3, 4, 5].includes(s.phase);
    $("#word-progress").textContent =
      `◇ ${String(this.book.count).padStart(2, "0")} / 30`;
    $("#word-progress").setAttribute(
      "aria-label",
      `打开词册：${this.book.run.won ? "通关确认" : "本局已斩"} ${this.book.count} 词，待斩 ${30 - this.book.count} 词`,
    );
    $("#word-progress").title = `随行词册 · 待斩 ${30 - this.book.count}`;
    if (s.phase !== this.lastPhase) {
      this.lastPhase = s.phase;
      this.renderMenu();
    }
  }
  renderMenu() {
    $("#word-enabled").checked = this.book.settings.enabled;
    $("#word-menu").classList.toggle(
      "word-disabled",
      !this.book.settings.enabled,
    );
    for (const name of ["tier", "pace", "hint"])
      $(`#word-${name}`).value = this.book.settings[name];
    $("#word-continue").hidden = !(
      this.book.settings.enabled &&
      this.book.run.started &&
      !this.book.run.won &&
      this.book.run.snapshot
    );
    for (const name of ["tier", "pace", "hint"])
      $(`#word-${name}`).disabled = !this.book.settings.enabled;
    $("#word-to-menu").hidden = this.state?.phase !== 4;
    this.save();
  }
  openBook() {
    if (this.active) return;
    this.journalPaused = this.state?.phase === 1;
    if (this.journalPaused) this.send("Escape", "Escape");
    this.renderBook();
    $("#word-journal").hidden = false;
    $("#word-close").focus();
  }
  closeBook() {
    $("#word-journal").hidden = true;
    if (this.journalPaused && this.state?.phase === 4)
      this.send("Escape", "Escape");
    this.journalPaused = false;
    this.focus();
  }
  renderBook() {
    const r = this.book.run,
      list = $("#word-list");
    list.replaceChildren();
    $("#word-summary").textContent =
      `${r.won ? "通关确认" : "本局已斩"} ${String(this.book.count).padStart(2, "0")} / 30 · 待斩 ${30 - this.book.count}`;
    const track = $("#word-ledger-track");
    track.replaceChildren();
    for (const id of r.pool) {
      const w = BANK.get(id),
        p = r.progress[id],
        row = document.createElement("div");
      row.className = "word-row";
      row.dataset.state = p?.correct
        ? "complete"
        : p?.wrong
          ? "review"
          : "unseen";
      const tick = document.createElement("i");
      tick.dataset.state = row.dataset.state;
      track.append(tick);
      const badge = document.createElement("span");
      badge.textContent = p?.correct
        ? r.won
          ? "✦"
          : "◆"
        : p?.wrong
          ? "◐"
          : "○";
      row.append(badge);
      const word = document.createElement("b");
      word.textContent = w.word;
      row.append(word);
      const meaning = document.createElement("small");
      meaning.textContent = `${w.pos} ${w.meaning}`;
      row.append(meaning);
      row.title = `${w.context}${p?.assisted ? " · 上次有提示作答" : ""}${this.book.data.history[id]?.completed ? " · 历次已通关确认" : ""}`;
      list.append(row);
    }
  }
  onWord(attempt, serial, kind) {
    if (!this.book.settings.enabled || this.active) return;
    const actionId = `${this.sessionId}:${this.epoch}:${attempt}:${serial}`;
    const q = this.book.question(kind, actionId),
      w = BANK.get(q.wordId);
    this.active = {
      actionId,
      attempt,
      serial,
      kind,
      q,
      elapsed: 0,
      duration: allowance(
        w,
        kind >= 5 ? "control" : q.type,
        this.book.settings.pace,
      ),
      hintVisible: true,
      result: null,
      epoch: this.epoch,
    };
    this.input = "";
    this.paused = false;
    this.composing = false;
    this.entryHeld = new Set(this.held);
    this.releaseHeld();
    this.audio.beginFocus();
    this.motion.begin(kind, this.state);
    this.cardExit?.cancel();
    document.body.classList.remove("word-focus-paused");
    $("#word-focus").classList.remove("word-released");
    $("#word-focus").inert = false;
    $("#word-focus").removeAttribute("aria-hidden");
    $("#word-focus").hidden = false;
    document.body.classList.add("word-focusing");
    $("#word-pause").hidden = true;
    $("#word-resume").disabled = false;
    $("#word-abandon").disabled = false;
    $("#word-focus").dataset.type = q.type;
    $("#word-seal-icon").setAttribute("d", sealPaths[kind]);
    $("#word-mode").textContent =
      `${q.review ? "重铸" : String(q.serial).padStart(2, "0")} / ${q.type === "spell" ? "刻写" : "辨义"}`;
    $("#word-title").textContent = titles[kind][0];
    $("#word-benefit").textContent = titles[kind][1];
    $("#word-feedback").textContent = "";
    $("#word-cue").textContent = w.word;
    $("#word-context").textContent =
      q.type === "spell" ? `${w.pos} ${w.meaning}` : `${w.pos} · ${w.context}`;
    $("#word-spelling").hidden = q.type !== "spell";
    $("#word-options").hidden = q.type === "spell";
    $("#word-options").replaceChildren();
    q.options.forEach((text, i) => {
      const b = document.createElement("button");
      b.dataset.option = String(i + 1);
      const key = document.createElement("kbd");
      key.textContent = String(i + 1);
      const meaning = document.createElement("span");
      meaning.textContent = text;
      b.append(key, meaning);
      b.onclick = () => {
        if (!this.paused) this.choose(i);
      };
      $("#word-options").append(b);
    });
    $("#word-input").value = "";
    $("#word-input").classList.remove("word-mistyped");
    $("#word-glyphs").replaceChildren();
    this.letterSlots = Array.from(w.word, () => {
      const slot = document.createElement("span");
      $("#word-glyphs").append(slot);
      return slot;
    });
    this.renderLetters(w);
    $("#word-focus").dataset.result = "";
    $("#word-timer-fill").style.strokeDashoffset = "0";
    this.focusAnswer();
    this.save();
  }
  focusAnswer() {
    const target =
      this.active?.q.type === "spell" ? $("#word-input") : $("#word-focus");
    target?.focus({ preventScroll: true });
  }
  renderLetters(w) {
    const prefix = w.accepted.some((v) => v.startsWith(this.input));
    this.letterSlots.forEach((slot, i) => {
      slot.textContent = this.input[i] || "";
      slot.className = this.input[i]
        ? w.accepted.some((v) => v.startsWith(this.input.slice(0, i + 1)))
          ? "inscribed"
          : "miscast"
        : i === this.input.length
          ? "next-glyph"
          : "";
    });
    const excess = Math.max(0, this.input.length - w.word.length);
    $("#word-letter-feedback").textContent = excess
      ? `多输入 ${excess} 个字母 · ⌫ 修正`
      : !prefix
        ? "刻痕有误 · ⌫ 修正"
        : this.input.length
          ? `${this.input.length} / ${w.word.length}`
          : "键入单词";
  }
  updateInput() {
    const a = this.active,
      w = BANK.get(a.q.wordId);
    $("#word-input").value = this.input;
    const prefix = w.accepted.some((v) => v.startsWith(this.input));
    this.renderLetters(w);
    if (prefix && this.input.length > (a.furthest || 0)) {
      a.furthest = this.input.length;
      this.motion.inscribe(
        this.input.length / w.word.length,
        this.input.at(-1),
      );
      this.audio.inscribe(this.input.length / w.word.length);
    }
    $("#word-input").classList.toggle("word-mistyped", !prefix);
    if (matches(w, this.input)) this.finish(true, "正确");
  }
  choose(i) {
    if (this.active && !this.active.result)
      this.finish(
        this.active.q.options[i] === BANK.get(this.active.q.wordId).meaning,
        "选择",
      );
  }
  pause(reason) {
    if (!this.active || this.active.result) return;
    if (!this.paused) this.internal("F6");
    this.paused = true;
    this.audio.pauseFocus(true);
    document.body.classList.add("word-focus-paused");
    $("#word-pause-label").textContent = reason;
    $("#word-pause").hidden = false;
  }
  finish(correct, reason) {
    const a = this.active;
    if (!a || a.result) return;
    a.result = correct ? "correct" : "wrong";
    a.assisted = a.q.type === "spell" && a.hintVisible;
    $("#word-focus").dataset.result = a.result;
    const w = BANK.get(a.q.wordId);
    $("#word-feedback").textContent = correct
      ? `${w.word} · ${w.meaning} · 解放`
      : `${reason === "选择" ? "未选中" : reason} · ${w.word} = ${w.meaning}`;
    this.quarantine = new Set([...(this.entryHeld || []), ...this.held]);
    this.releaseHeld();
    // Feedback continues as a non-interactive afterimage, never holds the action.
    a.sendAt = performance.now();
    a.sent = true;
    a.sentAt = a.sendAt;
    this.internal(correct ? "F1" : "F2");
  }
  onResolved(attempt, serial, kind, result) {
    const a = this.active;
    if (
      !a ||
      a.attempt !== attempt ||
      a.serial !== serial ||
      a.kind !== kind ||
      a.epoch !== this.epoch ||
      !a.sent
    )
      return;
    this.lastRelease = {
      kind,
      result,
      responseMs: performance.now() - a.sentAt,
    };
    const settled = this.book.settle(
      a.actionId,
      result === 1 ? "correct" : result === 3 ? "cancel" : "wrong",
      a.elapsed,
      a.assisted,
    );
    if (settled)
      this.onSettle({
        actionId: a.actionId,
        attempt,
        wordId: a.q.wordId,
        result,
      });
    this.audio.stateChanged({ ...this.state, phase: 1 });
    this.motion.release(result === 1);
    this.cancel(false);
    this.save();
    this.renderBook();
  }
  cancel(system = true) {
    if (system && this.active)
      this.book.settle(this.active.actionId, "cancel", 0);
    for (const code of [...(this.entryHeld || []), ...this.held])
      this.quarantine.add(code);
    this.releaseHeld();
    this.entryHeld = new Set();
    this.active = null;
    this.paused = false;
    this.audio.endFocus();
    document.body.classList.remove("word-focusing", "word-focus-paused");
    const panel = $("#word-focus");
    this.cardExit?.cancel();
    if (system) {
      this.motion.reset();
      panel.hidden = true;
    } else {
      panel.classList.add("word-released");
      panel.inert = true;
      panel.setAttribute("aria-hidden", "true");
      const reduced =
        this.book.settings.reduced ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduced
        ? 180
        : panel.dataset.result === "wrong"
          ? 800
          : 460;
      this.cardExit = panel.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          {
            opacity: 0,
            transform: reduced ? "none" : "translateY(-8px)",
          },
        ],
        { duration, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      );
      this.cardExit.onfinish = () => {
        panel.hidden = true;
      };
    }
    this.focus();
  }
  tick(now) {
    const dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    this.motion.tick(
      dt,
      this.state,
      this.paused,
      this.book.settings.reduced ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    const a = this.active;
    const foreground = !document.hidden;
    if (
      foreground &&
      this.state &&
      !this.state.practice &&
      this.book.run.started &&
      this.book.settings.enabled &&
      (this.state.phase === 1 || (this.state.phase === 5 && !this.paused))
    )
      this.book.run.activeSeconds += dt;
    if (a && foreground && !this.paused) {
      a.elapsed += dt;
      this.book.run.promptSeconds += dt;
      const w = BANK.get(a.q.wordId),
        hideAt = this.book.settings.hint === "recall" ? 0.8 : 1.2;
      a.hintVisible =
        this.book.settings.hint === "guided" || a.elapsed < hideAt;
      if (a.q.type === "spell" && !a.result)
        $("#word-cue").textContent = a.hintVisible
          ? w.word
          : this.book.settings.hint === "recall"
            ? "·".repeat(w.word.length)
            : w.word[0] + "·".repeat(w.word.length - 1);
      const remaining = Math.max(0, a.duration + 0.35 - a.elapsed);
      $("#word-time").textContent = remaining.toFixed(1) + " s";
      $("#word-timer-fill").style.strokeDashoffset = String(
        100 * (1 - Math.min(1, remaining / a.duration)),
      );
      if (!a.result && remaining <= 0) this.finish(false, "时间到");
      if (a.sent && now - a.sentAt > 2500) {
        $("#word-feedback").textContent =
          "释放响应中断，请刷新并从休整灯继续；本次不会重复计分。";
        this.paused = true;
        $("#word-pause-label").textContent =
          "释放响应中断，可重开本局或刷新后继续。";
        $("#word-pause").hidden = false;
        $("#word-resume").disabled = true;
        $("#word-abandon").disabled = true;
        this.save();
      }
    }
    if (now - this.lastSave > 3000) {
      this.lastSave = now;
      this.save();
    }
    requestAnimationFrame((t) => this.tick(t));
  }
}
