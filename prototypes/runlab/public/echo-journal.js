import {
  generateEchoReport,
  freshEcho,
  recordEcho,
  echoSnapshot,
  echoEvidence,
  echoMessages,
  validateEchoReport,
  echoError,
  sanitizeEchoSnapshot,
} from "./echo-core.js";

export class EchoJournal {
  constructor(config = {}, css = "") {
    window.easyRunEcho?.destroy();
    window.easyRunEcho = this;
    this.config = config;
    this.phase = 0;
    this.index = 0;
    this.mode = "life";
    this.busy = false;
    this.abort = null;
    this.revision = 0;
    this.setProfile("web");
    this.root = document.createElement("div");
    this.root.id = "echo-root";
    this.root.innerHTML = `<button class="echo-launch" hidden><span>✧</span> 回声札记 <small>本局回顾</small></button>
      <dialog class="echo-dialog" aria-labelledby="echo-title">
        <header><div><span class="echo-eyebrow">ECHOES / FIELD NOTES</span><h2 id="echo-title">回声札记</h2></div><button class="echo-close" aria-label="关闭札记">×</button></header>
        <div class="echo-body" tabindex="0" role="region" aria-label="单词用法与例句">
        <div class="echo-metrics"></div><nav class="echo-tabs" aria-label="本局错词"></nav>
        <section class="echo-card"><div class="echo-word"></div><p class="echo-meaning"></p><p class="echo-evidence"></p><div class="echo-content"></div></section>
        </div>
        <footer>
        <p class="echo-status" role="status" aria-live="polite"></p>
        <div class="echo-actions"><button class="echo-generate">生成札记 · AI</button><nav class="echo-pager" aria-label="切换单词"><button class="echo-prev" aria-label="上一词">← 上一词</button><span class="echo-page" role="status" aria-live="polite"></span><button class="echo-next" aria-label="下一词">下一词 →</button></nav></div></footer>
      </dialog>`;
    (document.querySelector("#viewport") || document.body).append(this.root);
    this.home = document.createComment("echo journal home");
    this.root.before(this.home);
    const play = document.querySelector("#play");
    if (play) {
      this.actions = document.createElement("div");
      this.actions.className = "echo-victory-actions";
      play.before(this.actions);
      this.actions.append(play);
    }
    this.resize = () => {
      this.placeNative();
      this.placeDialog();
    };
    window.addEventListener("resize", this.resize);
    window.addEventListener("scroll", this.resize, {
      capture: true,
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", this.resize);
    window.visualViewport?.addEventListener("scroll", this.resize);
    this.surface =
      document.querySelector("#viewport") ||
      document.querySelector("#game-canvas");
    this.layoutObserver = new ResizeObserver(this.resize);
    if (this.surface) this.layoutObserver.observe(this.surface);

    if (css) {
      this.style = document.createElement("style");
      this.style.textContent = css;
      document.head.append(this.style);
    } else if (!document.querySelector("link[data-echo-style]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/echo-journal.css";
      link.dataset.echoStyle = "true";
      document.head.append(link);
    }
    this.$ = (s) => this.root.querySelector(s);
    this.dialog = this.$("dialog");
    this.$(".echo-launch").onclick = () => this.open();
    this.$(".echo-close").onclick = () => this.close();
    this.$(".echo-generate").onclick = () => this.generate();
    this.$(".echo-prev").onclick = () => this.selectWord(this.index - 1);
    this.$(".echo-next").onclick = () => this.selectWord(this.index + 1);
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });
    this.key = (e) => {
      if (!this.active) {
        if (this.blocking) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        this.close();
      }
      if (
        ["ArrowLeft", "ArrowRight"].includes(e.code) &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        this.selectWord(this.index + (e.code === "ArrowLeft" ? -1 : 1));
      }
      if (
        ![
          "Tab",
          "Enter",
          "Space",
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
        ].includes(e.code)
      )
        e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", this.key, true);
    this.keyup = (e) => {
      if (this.blocking) e.stopImmediatePropagation();
    };
    window.addEventListener("keyup", this.keyup, true);
    this.storageEvent = (e) => {
      if (e.key === this.epochKey) {
        this.invalidate();
        this.cache = null;
        this.snapshot = null;
        this.report = null;
        this.draft = [];
        this.close();
        this.state(this.phase);
      }
    };
    window.addEventListener("storage", this.storageEvent);
  }
  get active() {
    return !!this.dialog?.open;
  }
  get blocking() {
    return this.active || performance.now() < (this.blockUntil || 0);
  }
  setProfile(profile) {
    const key = "easyrun.echo.v1:" + String(profile).slice(0, 300);
    if (key === this.storageKey) return;
    this.invalidate();
    this.close();
    this.storageKey = key;
    this.epochKey = key + ":epoch";
    this.cache = null;
    this.snapshot = null;
    this.report = null;
    this.draft = [];
    try {
      this.epoch = localStorage.getItem(this.epochKey);
      const raw = localStorage.getItem(key);
      if (raw && raw.length < 250000) {
        const c = JSON.parse(raw);
        if ([1, 2].includes(c?.snapshot?.version)) {
          c.snapshot = sanitizeEchoSnapshot(c.snapshot);
          c.report = validateEchoReport(c.report, c.snapshot);
          this.cache = c;
        }
      }
    } catch {
      this.cache = null;
    }
  }
  invalidate() {
    this.revision++;
    this.abort?.abort();
    this.abort = null;
    this.busy = false;
  }
  begin(raw) {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    this.invalidate();
    this.run = freshEcho(crypto.randomUUID());
    this.words = data.words || [];
    this.snapshot = null;
    this.report = null;
    this.draft = [];
    this.index = 0;
  }
  answer(raw) {
    const e = typeof raw === "string" ? JSON.parse(raw) : raw;
    recordEcho(this.run, e.id, e.mode, e.outcome, e.assisted, e);
  }
  finish() {
    if (this.run) this.present(echoSnapshot(this.run, this.words));
  }
  present(snapshot) {
    if (this.snapshot?.runId === snapshot.runId) return;
    this.invalidate();
    this.snapshot = sanitizeEchoSnapshot(snapshot);
    this.report = null;
    this.draft = [];
    this.index = 0;
    this.error = "";
    this.savedNotice = "";
    if (this.cache?.snapshot?.runId === snapshot.runId) {
      try {
        this.report = validateEchoReport(this.cache.report, snapshot);
      } catch {
        /* regenerate */
      }
    }
    this.state(this.phase);
  }
  state(phase, blocked = false) {
    this.phase = phase;
    if (!this.root) return;
    const stateKey = [phase, blocked, !!this.snapshot, !!this.cache].join(":");
    if (stateKey === this.stateKey) return;
    this.stateKey = stateKey;
    const canShow =
      !blocked &&
      ((phase === 2 && !!this.snapshot) || (phase === 0 && !!this.cache));
    this.actions?.classList.toggle("has-echo", phase === 2 && canShow);
    if (this.actions) {
      this.root.dataset.placement = phase === 2 ? "row" : "floating";
      // Moving an open dialog removes it from the browser's modal top layer.
      // Only reparent on an actual title/victory layout transition.
      const target = phase === 2 ? this.actions : this.home.parentNode;
      if (this.root.parentNode !== target) {
        if (phase === 2) this.actions.append(this.root);
        else this.home.after(this.root);
      }
    } else {
      this.root.dataset.placement = phase === 2 ? "native-row" : "floating";
      this.placeNative();
    }
    this.$(".echo-launch").hidden = !canShow;
    this.$(".echo-launch small").textContent =
      phase === 0 ? "上次回顾" : "本局回顾";
    if (!canShow && this.active) this.close();
    if (![0, 2].includes(phase) && this.busy) this.invalidate();
  }
  // The native anchor comes from the same layout as the painted replay button.
  nativeAnchor(x, y, width, height, viewWidth, viewHeight) {
    const stamp = [x, y, width, height, viewWidth, viewHeight].join(":");
    if (stamp === this.anchorStamp) return;
    this.anchorStamp = stamp;
    this.anchor = { x, y, width, height, viewWidth, viewHeight };
    this.placeNative();
  }
  placeNative() {
    if (this.phase !== 2 || !this.anchor || !this.root) return;
    const canvas = document.querySelector("#game-canvas");
    if (!canvas) return;
    const r = canvas.getBoundingClientRect(),
      a = this.anchor;
    const sx = r.width / a.viewWidth,
      sy = r.height / a.viewHeight;
    if (!(sx > 0 && sy > 0)) return;
    const values = {
      x: r.left + r.width / 2 + (a.x + a.width + 16 - 480) * sx,
      y: r.top + r.height / 2 + (a.y - 300) * sy,
      width: a.width * sx,
      height: a.height * sy,
      font: 20 * sy,
      hint: 11 * sy,
      pad: 18 * sx,
      gap: 12 * sx,
    };
    for (const [key, value] of Object.entries(values))
      this.root.style.setProperty("--echo-anchor-" + key, value + "px");
  }
  placeDialog() {
    if (!this.active) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || window.innerWidth);
    const bottom = top + (viewport?.height || window.innerHeight);
    const stage = this.surface?.getBoundingClientRect();
    const x = Math.max(left, stage?.left ?? left);
    const y = Math.max(top, stage?.top ?? top);
    const w = Math.max(0, Math.min(right, stage?.right ?? right) - x);
    const h = Math.max(0, Math.min(bottom, stage?.bottom ?? bottom) - y);
    const margin = Math.min(20, w * 0.035, h * 0.04);
    const values = {
      x: x + w / 2,
      y: y + h / 2,
      width: Math.max(1, w - margin * 2),
      height: Math.max(1, h - margin * 2),
    };
    const stamp = Object.values(values).join(":");
    if (stamp === this.dialogLayoutStamp) return;
    this.dialogLayoutStamp = stamp;
    for (const [key, value] of Object.entries(values))
      this.root.style.setProperty("--echo-dialog-" + key, value + "px");
    this.dialog.dataset.compact = String(h < 420);
    this.centerWordTab();
  }
  centerWordTab() {
    const tabs = this.$(".echo-tabs"),
      selected = tabs.querySelector(".selected");
    if (selected)
      tabs.scrollLeft =
        selected.offsetLeft -
        tabs.offsetLeft -
        (tabs.clientWidth - selected.clientWidth) / 2;
  }
  open() {
    if (![0, 2].includes(this.phase)) return;
    if (this.phase === 0 && this.cache) {
      this.snapshot = this.cache.snapshot;
      this.report = this.cache.report;
      this.index = 0;
    }
    if (!this.snapshot) return;
    this.returnFocus = document.activeElement;
    this.render();
    this.dialog.showModal();
    this.placeDialog();
    this.$(".echo-body").scrollTop = 0;
    this.$(".echo-close").focus();
  }
  close() {
    if (!this.dialog?.open) return;
    this.dialog.close();
    this.blockUntil = performance.now() + 180;
    if (this.config.focus) this.config.focus();
    else
      (document.querySelector("#game-canvas") || this.returnFocus)?.focus?.();
  }
  selectWord(index, focusTab = false) {
    if (
      !this.snapshot ||
      index < 0 ||
      index >= this.snapshot.words.length ||
      index === this.index
    )
      return;
    this.index = index;
    this.render();
    this.$(".echo-body").scrollTop = 0;
    if (focusTab)
      this.$(".echo-tabs .selected")?.focus({ preventScroll: true });
  }
  render() {
    const s = this.snapshot;
    if (!s) return;
    const t = s.totals;
    this.$(".echo-metrics").replaceChildren(
      ...[
        [t.touched, "实际作答 · 词"],
        [s.words.length, s.version === 1 ? "历史选词 · 词" : "本局错词 · 词"],
        [t.independentSpell, "独立拼对 · 次"],
      ].map(([n, label]) => {
        const el = document.createElement("div");
        const num = document.createElement("strong");
        num.textContent = n;
        const caption = document.createElement("span");
        caption.textContent = label;
        el.append(num, caption);
        return el;
      }),
    );
    this.$(".echo-tabs").replaceChildren(
      ...s.words.map((w, i) => {
        const b = document.createElement("button");
        b.textContent = w.word;
        b.classList.toggle("selected", i === this.index);
        b.setAttribute("aria-pressed", String(i === this.index));
        b.onclick = () => this.selectWord(i, true);
        return b;
      }),
    );
    this.centerWordTab();
    const w = s.words[this.index];
    const content = this.$(".echo-content");
    content.replaceChildren();
    this.$(".echo-word").textContent =
      w?.word || (t.touched ? "本局没有答错词" : "此行，尚无铭文记录");
    this.$(".echo-meaning").textContent = w
      ? `${w.pos} ${w.meaning}`
      : t.touched
        ? "本局无需生成错词札记。"
        : "开启铭文并实际作答后，才会生成学习回顾。";
    this.$(".echo-evidence").textContent = w
      ? echoEvidence(w)
      : t.timeout
        ? `超时 ${t.timeout} 次，单独记录，不计为答错。`
        : "";
    const card = (this.report?.cards || this.draft).find((c) => c.id === w?.id);
    const paragraph = (cls, value) => {
      const el = document.createElement("p");
      el.className = cls;
      el.textContent = value;
      content.append(el);
    };
    if (card) {
      paragraph("echo-usage", card.usage);
      paragraph("echo-collocation", card.collocation);
      const modes = document.createElement("div");
      modes.className = "echo-example-tabs";
      for (const [key, label] of [
        ["life", "带回生活"],
        ["game", "钟城片刻"],
      ]) {
        const b = document.createElement("button");
        b.textContent = label;
        b.classList.toggle("selected", this.mode === key);
        b.onclick = () => {
          this.mode = key;
          this.render();
          this.$(".echo-example-tabs .selected")?.focus({
            preventScroll: true,
          });
        };
        modes.append(b);
      }
      content.append(modes);
      paragraph(
        "echo-example",
        this.mode === "life" ? card.example : card.gameExample,
      );
      paragraph(
        "echo-translation",
        this.mode === "life" ? card.translation : card.gameTranslation,
      );
    } else if (w) {
      paragraph(
        "echo-placeholder",
        this.busy
          ? "此词的札记正在准备中。"
          : "回顾本局全部错词的用法、搭配与例句。",
      );
    }
    this.$(".echo-generate").disabled = this.busy || !w || !!this.report;
    this.$(".echo-generate").hidden = !!this.report || !w;
    this.$(".echo-generate").textContent = this.busy
      ? "正在写下回声…"
      : this.report
        ? "札记已生成"
        : this.error
          ? "继续生成"
          : "生成札记 · AI";
    this.$(".echo-pager").hidden = s.words.length < 2;
    this.$(".echo-prev").disabled = this.index === 0;
    this.$(".echo-next").disabled = this.index >= s.words.length - 1;
    this.$(".echo-page").textContent =
      `${String(this.index + 1).padStart(2, "0")} / ${String(s.words.length).padStart(2, "0")}`;
    this.$(".echo-status").textContent = this.busy
      ? `已生成 ${this.draft.length} / ${s.words.length} 词`
      : this.error
        ? `${this.draft.length ? `已生成 ${this.draft.length} / ${s.words.length} 词 · ` : ""}${this.error}`
        : this.savedNotice || "";
    this.$(".echo-status").hidden = !this.$(".echo-status").textContent;
    this.$("footer").hidden =
      this.$(".echo-generate").hidden &&
      this.$(".echo-pager").hidden &&
      !this.$(".echo-status").textContent;
    this.dialog.setAttribute("aria-busy", String(this.busy));
  }
  async generate() {
    if (this.busy || this.report || !this.snapshot?.words.length) return;
    const snapshot = this.snapshot,
      revision = ++this.revision;
    const controller = new AbortController();
    this.abort = controller;
    this.busy = true;
    this.error = "";
    this.savedNotice = "";
    this.render();
    try {
      const report = await generateEchoReport(
        snapshot,
        (batch, signal) => this.requestBatch(batch, signal),
        {
          signal: controller.signal,
          existing: this.draft,
          onProgress: (cards) => {
            if (revision !== this.revision || snapshot !== this.snapshot)
              return;
            this.draft = cards;
            this.render();
          },
        },
      );
      if (revision !== this.revision || snapshot !== this.snapshot) return;
      this.report = report;
      this.cache = { snapshot, report, createdAt: Date.now() };
      this.save();
    } catch (e) {
      if (revision === this.revision) this.error = echoError(e);
    } finally {
      if (revision === this.revision) {
        this.busy = false;
        this.abort = null;
        this.render();
      }
    }
  }
  async requestBatch(snapshot, signal) {
    // A deadline per batch, rather than timing out an entire 30-word review.
    signal = globalThis.AbortSignal.any([
      signal,
      globalThis.AbortSignal.timeout(65000),
    ]);
    let report;
    if (this.config.mode === "embedded-test") {
      const r = await fetch(
        this.config.baseUrl.replace(/\/$/, "") + "/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + this.config.apiKey,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: echoMessages(snapshot),
            stream: false,
            max_tokens: 6000,
            enable_thinking: false,
          }),
          signal: signal,
          credentials: "omit",
          redirect: "error",
        },
      );
      if (!r.ok) throw new Error(String(r.status));
      const body = await this.readResponse(r);
      const value = JSON.parse(body);
      report = validateEchoReport(
        value.choices?.[0]?.message?.content,
        snapshot,
      );
    } else {
      if (this.config.mode === "disabled") throw new Error("not-configured");
      const r = await fetch(this.config.endpoint || "/api/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
        signal: signal,
        credentials: "omit",
        redirect: "error",
      });
      if (!r.ok) {
        let code = r.status === 503 ? "not-configured" : String(r.status);
        if (r.status === 502) {
          try {
            if (
              JSON.parse(await this.readResponse(r)).error ===
              "invalid-response"
            )
              code = "invalid-response";
          } catch {
            /* Keep the safe status error. */
          }
        }
        throw new Error(code);
      }
      report = validateEchoReport(
        JSON.parse(await this.readResponse(r)),
        snapshot,
      );
    }
    return report;
  }
  async readResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let value = "",
      size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 100000) throw new Error("invalid-response");
        value += decoder.decode(part.value, { stream: true });
      }
      return value + decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
  save() {
    try {
      if (localStorage.getItem(this.epochKey) !== this.epoch)
        throw new Error("stale");
      localStorage.setItem(this.storageKey, JSON.stringify(this.cache));
      this.savedNotice = "";
    } catch {
      this.savedNotice = "本次可阅读，浏览器暂时无法保存这份札记。";
    }
  }
  clear() {
    this.invalidate();
    try {
      localStorage.setItem(this.epochKey, crypto.randomUUID());
      localStorage.removeItem(this.storageKey);
      this.epoch = localStorage.getItem(this.epochKey);
    } catch {
      throw new Error("无法清除札记缓存，请重试");
    }
    this.cache = null;
    this.snapshot = null;
    this.report = null;
    this.draft = [];
    this.close();
    this.state(this.phase);
  }
  destroy() {
    this.invalidate();
    this.layoutObserver?.disconnect();
    this.root?.remove();
    this.home?.remove();
    if (this.actions) {
      this.actions.before(...this.actions.childNodes);
      this.actions.remove();
    }
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("scroll", this.resize, true);
    window.visualViewport?.removeEventListener("resize", this.resize);
    window.visualViewport?.removeEventListener("scroll", this.resize);
    this.style?.remove();
    window.removeEventListener("keydown", this.key, true);
    window.removeEventListener("keyup", this.keyup, true);
    window.removeEventListener("storage", this.storageEvent);
  }
}
