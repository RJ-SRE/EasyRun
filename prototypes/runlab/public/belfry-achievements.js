import {
  ACHIEVEMENTS,
  GROUPS,
  ACHIEVEMENT_KEY,
  AchievementBook,
} from "./belfry-achievements-core.js";
const $ = (s) => document.querySelector(s);
const glyph = (a) =>
  `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="${a.icon}"/></svg>`;

export class AchievementUI {
  constructor({ send, focus, lockInput }) {
    this.send = send;
    this.focus = focus;
    this.lockInput = lockInput;
    this.blocked = false;
    let raw;
    try {
      raw = localStorage.getItem(ACHIEVEMENT_KEY);
    } catch {
      this.blocked = true;
    }
    this.book = new AchievementBook(raw);
    this.filter = "all";
    this.selected = this.book.data.equipped || ACHIEVEMENTS[0].id;
    this.queue = [];
    this.noticeAge = 0;
    this.lastTick = performance.now();
    this.revision = -1;
    this.create();
    this.refresh(false);
    Object.defineProperty(window, "achievementDiagnostics", {
      get: () => ({
        data: JSON.parse(this.book.serialize()),
        count: this.book.count,
        open: this.dialog.open,
        queued: this.queue.length,
        blocked: this.blocked,
      }),
    });
  }
  create() {
    this.button = document.createElement("button");
    this.button.id = "achievements-open";
    this.button.setAttribute("aria-haspopup", "dialog");
    $(".topbar nav").insertBefore(this.button, $("#help"));
    this.button.onclick = () => this.open();
    this.dialog = document.createElement("dialog");
    this.dialog.id = "achievement-ledger";
    this.dialog.setAttribute("aria-labelledby", "achievement-heading");
    this.dialog.innerHTML = `
      <header class="achievement-heading"><div><small>THE CITY REMEMBERS</small><h2 id="achievement-heading">钟城铭录</h2></div><span id="achievement-total"></span><button id="achievements-close" aria-label="关闭成就册">×</button></header>
      <div class="achievement-filters" role="group" aria-label="成就分类"></div>
      <div class="achievement-body"><div id="achievement-list" aria-label="成就列表"></div><section id="achievement-detail" aria-label="成就详情"></section></div>
      <footer><p id="achievement-storage"></p><button id="achievements-export">导出记录 ↗</button></footer>`;
    $("#viewport").append(this.dialog);
    for (const [id, label] of Object.entries({ all: "全部", ...GROUPS })) {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.group = id;
      b.onclick = () => {
        this.filter = id;
        const list = this.filtered();
        if (!list.some((a) => a.id === this.selected))
          this.selected = list[0].id;
        this.render();
      };
      this.dialog.querySelector(".achievement-filters").append(b);
    }
    $("#achievements-close").onclick = () => this.close();
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.dialog.open) return;
        e.stopImmediatePropagation();
        if (e.code === "Escape") {
          e.preventDefault();
          this.close();
        } else if (!["Tab", "Enter", "Space"].includes(e.code))
          e.preventDefault();
      },
      true,
    );
    $("#achievements-export").onclick = () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(this.book.data, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "belfry-achievements.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    this.notice = document.createElement("div");
    this.notice.id = "achievement-notice";
    this.notice.hidden = true;
    this.notice.setAttribute("role", "status");
    this.notice.setAttribute("aria-live", "polite");
    $("#viewport").append(this.notice);
  }
  filtered() {
    return ACHIEVEMENTS.filter(
      (a) => this.filter === "all" || a.group === this.filter,
    );
  }
  refresh(save = true) {
    if (save && this.revision !== this.book.revision) {
      try {
        localStorage.setItem(ACHIEVEMENT_KEY, this.book.serialize());
        this.blocked = false;
      } catch {
        this.blocked = true;
      }
    }
    this.revision = this.book.revision;
    this.button.textContent = `成就 ${this.book.count}/${ACHIEVEMENTS.length}`;
    this.button.setAttribute(
      "aria-label",
      `成就：已铭刻 ${this.book.count} / ${ACHIEVEMENTS.length}`,
    );
    const equipped = ACHIEVEMENTS.find((a) => a.id === this.book.data.equipped);
    $(".vitals .micro").textContent = equipped
      ? `「${equipped.title}」`
      : "THE THREADBEARER";
    if (this.dialog.open) this.render();
  }
  changed() {
    for (const id of this.book.pending.splice(0))
      if (!this.queue.includes(id)) this.queue.push(id);
    if (this.revision !== this.book.revision) this.refresh();
  }
  deed(e) {
    this.book.deed(e);
    this.changed();
  }
  word(s) {
    this.book.word(s);
    this.changed();
  }
  resetSession() {
    this.book.resetSession();
    this.state = null;
    this.button.disabled = true;
    this.queue = [];
    this.noticeAge = 0;
    this.notice.hidden = true;
    this.waitingPause = false;
    this.closeRequested = false;
    this.resume = false;
    if (this.dialog.open) this.dialog.close();
  }
  receive(s) {
    this.state = s;
    const nested = ["#guide", "#settings-panel", "#word-journal"].some(
      (id) => $(id) && !$(id).hidden,
    );
    this.button.disabled = s.phase === 5 || nested || !!$("#city-book")?.open;
    if (this.waitingPause && s.phase !== 1) {
      this.waitingPause = false;
      if (this.closeRequested) this.close();
    }
    const now = performance.now(),
      dt = Math.min(0.1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    const visible =
      [1, 2].includes(s.phase) &&
      !document.hidden &&
      !this.dialog.open &&
      !$("#city-book")?.open &&
      !nested &&
      !s.practice;
    if (!visible || !this.queue.length) {
      this.notice.hidden = true;
      return;
    }
    const a = ACHIEVEMENTS.find((a) => a.id === this.queue[0]);
    if (this.notice.dataset.id !== a.id) {
      this.notice.dataset.id = a.id;
      this.notice.innerHTML = `${glyph(a)}<div><small>成就已铭刻 · ${GROUPS[a.group]}</small><strong>${a.title}</strong></div>`;
    }
    this.notice.hidden = false;
    this.noticeAge += dt;
    if (this.noticeAge >= 2.7) {
      this.queue.shift();
      this.noticeAge = 0;
      this.notice.hidden = true;
    }
  }
  open() {
    if (!this.state || this.button.disabled || this.dialog.open) return;
    this.resume = this.state.phase === 1;
    this.waitingPause = this.resume;
    this.closeRequested = false;
    this.lockInput();
    if (this.resume) this.send("Escape", "Escape");
    this.render();
    this.dialog.showModal();
    $("#achievements-close").focus();
  }
  close() {
    if (this.waitingPause) {
      this.closeRequested = true;
      return;
    }
    this.lockInput();
    this.dialog.close();
    if (this.resume && this.state?.phase === 4) {
      this.send("Escape", "Escape");
      this.focus();
    } else this.button.focus();
    this.resume = false;
    this.closeRequested = false;
  }
  render() {
    const d = this.book.data;
    $("#achievement-total").textContent =
      `${String(this.book.count).padStart(2, "0")} / ${ACHIEVEMENTS.length} 已铭刻`;
    this.dialog
      .querySelectorAll("[data-group]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.group === this.filter)),
      );
    const list = $("#achievement-list");
    list.replaceChildren();
    for (const a of this.filtered()) {
      const unlocked = !!d.unlocked[a.id],
        b = document.createElement("button");
      b.dataset.achievement = a.id;
      b.dataset.unlocked = String(unlocked);
      b.setAttribute("aria-pressed", String(this.selected === a.id));
      b.innerHTML = `${glyph(a)}<span><strong>${a.title}</strong><small>${d.equipped === a.id ? "已佩戴" : unlocked ? "已铭刻" : a.goal > 1 ? `记录 ${d.progress[a.id] || 0} / ${a.goal}` : "未铭刻"}</small></span>`;
      b.onclick = () => {
        this.selected = a.id;
        this.render();
        list.querySelector(`[data-achievement="${a.id}"]`).focus();
      };
      list.append(b);
    }
    const a = ACHIEVEMENTS.find((a) => a.id === this.selected),
      unlocked = !!d.unlocked[a.id];
    const detail = $("#achievement-detail");
    detail.dataset.unlocked = String(unlocked);
    detail.innerHTML = `<div class="achievement-medallion">${glyph(a)}</div><small class="achievement-category">${GROUPS[a.group]} / ${unlocked ? "已铭刻" : "待铭刻"}</small><h3>${a.title}</h3><p class="achievement-rule">${a.rule}</p><p class="achievement-lore">${a.lore}</p><div class="achievement-track"><i style="width:${((d.progress[a.id] || 0) / a.goal) * 100}%"></i></div><small class="achievement-record">${unlocked ? `铭刻于 ${new Date(d.unlocked[a.id]).toLocaleDateString("zh-CN")}` : a.goal > 1 ? `已记录的最高进度 ${d.progress[a.id] || 0} / ${a.goal}` : "完成条件后点亮此印记"}</small><button id="achievement-equip" ${unlocked ? "" : "disabled"}>${d.equipped === a.id ? "卸下称号" : "佩戴此称号"}</button>`;
    $("#achievement-equip").onclick = () => {
      this.book.equip(d.equipped === a.id ? "" : a.id);
      this.changed();
      $("#achievement-equip").focus();
    };
    $("#achievement-storage").textContent = this.blocked
      ? "本机存储不可用，请导出记录保留成就。"
      : this.book.corrupt
        ? "旧记录无法读取，当前使用新记录。称号不增加战力。"
        : "仅在本机保存 · 称号不增加战力 · 排练场不计入";
  }
}
