import {
  InscriptionBook,
  BANK,
  STORAGE_KEY,
  allowance,
  matches,
} from "./inscription-core.js";
const $ = (s) => document.querySelector(s);
const titles = {
  1: ["贯夜 · 解放弓弦", "正确：贯穿两敌并留下裂印"],
  2: ["断潮 · 解放刀锋", "正确：满蓄重斩 · 裂印追加伤害"],
  3: ["回息 · 重燃余烬", "正确：生命 +1；未完成返还本次余烬"],
  4: ["连环剑刀 · 终式", "一题解放最后两击 · 连贯收势"],
  5: ["缚索 · 断开牵引", "正确：斩链反制；未完成仍可脱离"],
  6: ["封脉 · 夺回主动", "正确：拆招反击；未完成安全脱身"],
};
export class InscriptionUI {
  constructor({ send, focus, toast, audio }) {
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
    menu.innerHTML = `<div class="eyebrow">INSCRIPTIONS / CET-4</div><h2>把词，铸成锋芒。</h2><label class="word-switch"><input id="word-enabled" type="checkbox"> 铭文远征 <small>关键释放时拼写或辨义</small></label><div class="word-settings"><label>词汇范围<select id="word-tier"><option value="foundation">基础</option><option value="standard">标准</option><option value="challenge">挑战</option></select></label><label>作答节奏<select id="word-pace"><option value="relaxed">宽裕</option><option value="standard">标准</option><option value="brisk">紧凑</option></select></label><label>拼写提示<select id="word-hint"><option value="guided">完整提示</option><option value="standard">渐隐提示</option><option value="recall">回忆</option></select></label></div><p class="word-note">30 个精选词 · 通关无需全清<br>普攻、短蓄、钩索不弹题。贯夜裂印可直接接满蓄断潮。</p><div class="word-actions"><button id="word-preview">预览 30 词 ↗</button><button id="word-shuffle">换一组</button></div><button id="word-continue" class="secondary" hidden>继续上次远征 ↗</button><p id="word-storage" role="status"></p>`;
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
    journal.innerHTML = `<div><div class="eyebrow">THE INSCRIPTION LEDGER</div><h2>本次远征 · 三十道铭文</h2><p id="word-summary"></p><div class="word-legend">○ 待遇见  ◐ 待复习  ◆ 本局已斩  ✦ 通关确认</div><div id="word-list"></div><div class="word-actions"><button id="word-close" class="primary">回到钟城 ↗</button><button id="word-export">导出词册与节奏记录</button></div><p class="word-note">预览不计完成；通关只确认本局实际答对的词。一次答对不代表长期掌握。</p></div>`;
    $("#viewport").append(journal);
    const panel = document.createElement("section");
    panel.id = "word-focus";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "word-title");
    panel.innerHTML = `<div class="word-focus-card"><div class="word-focus-head"><span class="eyebrow" id="word-mode"></span><span id="word-time"></span></div><h2 id="word-title"></h2><div id="word-cue"></div><p id="word-context"></p><div id="word-spelling"><input id="word-input" type="text" inputmode="latin" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="输入英文单词"><span id="word-letter-feedback"></span></div><div id="word-options"></div><div class="word-timer"><i id="word-timer-fill"></i></div><p id="word-benefit"></p><p id="word-feedback" role="status"></p><div id="word-pause" hidden><b id="word-pause-label">铭文已暂停</b><button id="word-resume">继续作答</button><button id="word-abandon">放弃本次释放</button></div><small class="word-key-hint">Esc 暂停 · 世界与冷却已冻结</small></div>`;
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
      this.paused = false;
      this.composing = false;
      $("#word-pause").hidden = true;
      $("#word-input").focus();
    };
    $("#word-abandon").onclick = () => {
      this.paused = false;
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
          /^(?:Key)?F[1-5]$/.test(e.code) &&
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
    $("#word-to-menu").hidden = s.phase !== 4;
    $("#word-progress").hidden =
      !this.book.settings.enabled ||
      s.practice ||
      ![1, 2, 3, 4, 5].includes(s.phase);
    $("#word-progress").textContent =
      `${this.book.run.won ? "已确认" : "本局已斩"} ${this.book.count}/30 · 待斩 ${30 - this.book.count} ↗`;
    if (s.phase !== this.lastPhase) {
      this.lastPhase = s.phase;
      this.renderMenu();
    }
  }
  renderMenu() {
    $("#word-enabled").checked = this.book.settings.enabled;
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
    const ratio = r.activeSeconds
      ? (100 * r.promptSeconds) / r.activeSeconds
      : 0;
    $("#word-summary").textContent =
      `${this.book.count}/30 本局已斩 · ${30 - this.book.count} 待斩 · ${r.serial} 次作答 · 专注占用 ${ratio.toFixed(1)}%（前台实测）`;
    for (const id of r.pool) {
      const w = BANK.get(id),
        p = r.progress[id],
        row = document.createElement("div");
      row.className = "word-row";
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
    this.audio.stopAll();
    $("#word-focus").hidden = false;
    document.body.classList.add("word-focusing");
    $("#word-pause").hidden = true;
    $("#word-resume").disabled = false;
    $("#word-abandon").disabled = false;
    $("#word-mode").textContent =
      `${titles[kind][0]} / ${q.review ? "REVIEW" : String(q.serial).padStart(2, "0")} / ${q.type === "spell" ? "SPELL" : "MEANING"}`;
    $("#word-title").textContent = titles[kind][0];
    $("#word-benefit").textContent = titles[kind][1];
    $("#word-feedback").textContent =
      q.type === "spell"
        ? "输入英文 · 正确后自动释放 · Backspace 修改"
        : "按 1 / 2 / 3 或点击释义";
    $("#word-cue").textContent = w.word;
    $("#word-context").textContent =
      q.type === "spell" ? `${w.pos} ${w.meaning}` : `${w.pos} · ${w.context}`;
    $("#word-spelling").hidden = q.type !== "spell";
    $("#word-options").hidden = q.type === "spell";
    $("#word-options").replaceChildren();
    q.options.forEach((text, i) => {
      const b = document.createElement("button");
      b.dataset.option = String(i + 1);
      b.textContent = `${i + 1}  ${text}`;
      b.onclick = () => {
        if (!this.paused) this.choose(i);
      };
      $("#word-options").append(b);
    });
    $("#word-input").value = "";
    $("#word-letter-feedback").textContent = "";
    $("#word-focus").dataset.result = "";
    $("#word-input").focus({ preventScroll: true });
    this.save();
  }
  updateInput() {
    const a = this.active,
      w = BANK.get(a.q.wordId);
    $("#word-input").value = this.input;
    const prefix = w.accepted.some((v) => v.startsWith(this.input));
    $("#word-letter-feedback").textContent =
      `${this.input.length} / ${w.word.length}${!prefix ? " · 可退格修正" : ""}`;
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
    this.paused = true;
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
    a.sendAt = performance.now() + (correct ? 120 : 650);
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
    this.book.settle(
      a.actionId,
      result === 1 ? "correct" : result === 3 ? "cancel" : "wrong",
      a.elapsed,
      a.assisted,
    );
    this.audio.stateChanged({ ...this.state, phase: 1 });
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
    $("#word-focus").hidden = true;
    document.body.classList.remove("word-focusing");
    this.focus();
  }
  tick(now) {
    const dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
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
      $("#word-timer-fill").style.width =
        `${100 * Math.min(1, remaining / a.duration)}%`;
      if (!a.result && remaining <= 0) this.finish(false, "时间到");
      if (a.result && !a.sent && now >= a.sendAt) {
        a.sent = true;
        a.sentAt = now;
        this.internal(a.result === "correct" ? "F1" : "F2");
      }
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
