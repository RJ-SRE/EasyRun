import {
  archiveMarkSVG,
  achievementBadgeSVG,
  achievementMountSVG,
  achievementPanelSVG,
  archiveNumber,
  archiveState,
  archiveStatus,
} from "./learning-art.js";
import { BANK } from "./inscription-core.js";
import {
  LEARNING_MILESTONES as catalog,
  learningMetrics,
  unlockLearningMilestones,
} from "./learning-milestones.js";
export class LearningRails {
  constructor(ui) {
    this.ui = ui;
    this.page = 0;
    this.queue = [];
    this.metrics = learningMetrics(ui.book.data.history, ui.book.data.study);
    unlockLearningMilestones(ui.book.data.study, this.metrics);
    const host = document.querySelector("#viewport");
    host.insertAdjacentHTML(
      "beforeend",
      `<div class="learning-rail learning-top"><button id="learning-open" aria-haspopup="dialog"><span class="learning-entry-mark">${archiveMarkSVG()}</span><span class="learning-entry-name">铭文成就</span><b></b></button><span id="learning-unlock" role="status" aria-live="polite"></span><small>R U P T U R E / L E A R N I N G</small></div><div class="learning-rail learning-bottom"><div class="learning-track"><span>本局</span><div class="learning-channel" id="learning-run" role="progressbar" aria-label="本局已解单词" aria-valuemin="0" aria-valuemax="30"><i></i></div><b id="learning-run-value"></b></div><div class="learning-track"><span>词库足迹</span><div class="learning-channel bank" id="learning-bank" role="progressbar" aria-label="累计答对的不同单词" aria-valuemin="0"><i></i></div><b id="learning-bank-value"></b></div></div><section id="learning-ledger" role="dialog" aria-modal="true" aria-labelledby="learning-heading" hidden><div class="learning-sheet"><header><div class="learning-heading-copy"><p class="learning-eyebrow">THE INSCRIPTION ARCHIVE</p><h2 id="learning-heading">铭文成就</h2></div><div class="learning-tally"><span id="learning-total"></span><small>已铭刻</small></div><button id="learning-close" aria-label="关闭英语成就"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div id="learning-cards"></div><footer><small id="learning-save-state"></small><div class="learning-pagination"><button id="learning-prev" aria-label="上一组成就">← 上页</button><span class="learning-folio"><span id="learning-page"></span><i id="learning-page-dots" aria-hidden="true"></i></span><button id="learning-next" aria-label="下一组成就">下页 →</button></div></footer></div></section>`,
    );
    this.panel = host.querySelector("#learning-ledger");
    this.panel.querySelector(".learning-sheet").style.backgroundImage =
      `url("data:image/svg+xml,${encodeURIComponent(achievementPanelSVG())}")`;
    host.querySelector("#learning-open").onclick = () =>
      this.openState ? this.close() : this.open();
    host.querySelector("#learning-close").onclick = () => this.close();
    host.querySelector("#learning-prev").onclick = () => this.turn(-1);
    host.querySelector("#learning-next").onclick = () => this.turn(1);
    const capture = (e) => {
      if (!this.openState) return;
      e.stopImmediatePropagation();
      if (e.code === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        this.turn(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        this.turn(1);
      } else if (e.code === "Tab") {
        const nodes = [...this.panel.querySelectorAll("button:not(:disabled)")];
        const i = nodes.indexOf(document.activeElement);
        e.preventDefault();
        nodes[
          (i + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length
        ].focus();
      } else if (!["Enter", "Space"].includes(e.code)) e.preventDefault();
    };
    window.addEventListener("keydown", capture, true);
    window.addEventListener(
      "keyup",
      (e) => {
        if (this.openState) e.stopImmediatePropagation();
      },
      true,
    );
    this.refresh();
    Object.defineProperty(window, "learningRailDiagnostics", {
      get: () => ({
        open: this.openState || false,
        page: this.page,
        metrics: [...this.metrics],
        unlocked: [...ui.book.data.study.unlocked],
        count: ui.book.data.study.unlocked.filter(Boolean).length,
      }),
    });
  }
  refresh(notify = false) {
    this.metrics = learningMetrics(
      this.ui.book.data.history,
      this.ui.book.data.study,
    );
    this.activeFootprint = Object.entries(this.ui.book.data.history).filter(
      ([id, h]) =>
        BANK.has(id) && (h.spell.correct > 0 || h.meaning.correct > 0),
    ).length;
    const fresh = unlockLearningMilestones(
      this.ui.book.data.study,
      this.metrics,
    );
    if (notify) this.queue.push(...fresh);
    this.update();
  }
  update() {
    const data = this.ui.book.data.study,
      count = data.unlocked.filter(Boolean).length;
    document.querySelector("#learning-open b").textContent =
      String(count).padStart(2, "0") + " / 24";
    const run =
        this.ui.book.settings.enabled && !this.ui.state?.practice
          ? this.ui.book.count
          : 0,
      total = this.activeFootprint || 0;
    const a = document.querySelector("#learning-run"),
      b = document.querySelector("#learning-bank");
    a.setAttribute("aria-valuenow", String(run));
    a.querySelector("i").style.width = (run / 30) * 100 + "%";
    b.setAttribute("aria-valuemax", String(BANK.size));
    b.setAttribute("aria-valuenow", String(total));
    b.querySelector("i").style.width = (total / BANK.size) * 100 + "%";
    document.querySelector("#learning-run-value").textContent =
      String(run).padStart(2, "0") + " / 30";
    document.querySelector("#learning-bank-value").textContent =
      String(total).padStart(4, "0") + " / " + BANK.size;
    document.querySelector("#learning-run").title = !this.ui.book.settings
      .enabled
      ? "铭文关闭"
      : this.ui.state?.practice
        ? "排练不计学习"
        : `本局 ${run} 个词已解`;
    if (this.openState) this.render();
    if (!this.noticeTimer && this.queue.length && !this.openState) {
      const i = this.queue.shift();
      document.querySelector("#learning-unlock").textContent =
        "新刻痕 · " + catalog[i].title;
      this.noticeTimer = setTimeout(() => {
        this.noticeTimer = null;
        document.querySelector("#learning-unlock").textContent = "";
        this.update();
      }, 3400);
    }
  }
  render() {
    const renderKey = [
      this.page,
      ...this.metrics,
      this.ui.storageBlocked,
      ...this.ui.book.data.study.unlocked,
    ].join(":");
    if (renderKey === this.renderKey) return;
    this.renderKey = renderKey;
    const data = this.ui.book.data.study;
    document.querySelector("#learning-total").textContent =
      String(data.unlocked.filter(Boolean).length).padStart(2, "0") + " / 24";
    const container = document.querySelector("#learning-cards");
    container.replaceChildren();
    for (const a of catalog.slice(this.page * 4, this.page * 4 + 4)) {
      const node = document.createElement("article"),
        unlocked = !!data.unlocked[a.index],
        value = unlocked ? a.goal : Math.min(this.metrics[a.metric], a.goal),
        state = archiveState(unlocked, value);
      node.className = unlocked ? "learning-card unlocked" : "learning-card";
      node.dataset.state = state;
      node.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(achievementMountSVG(state))}")`;
      node.setAttribute("aria-labelledby", `inscription-achievement-${a.id}`);
      node.innerHTML = `<span class="learning-ordinal" aria-hidden="true">${archiveNumber(a.index)}</span><div class="learning-badge" aria-hidden="true">${achievementBadgeSVG(a, state)}</div><h3 id="inscription-achievement-${a.id}">${a.title}</h3><small class="learning-status">${archiveStatus(state)}</small><p>${a.rule}</p><b class="learning-quantity">${value}<span> / ${a.goal}</span></b><div class="learning-channel" role="progressbar" aria-label="${a.title}" aria-valuemin="0" aria-valuemax="${a.goal}" aria-valuenow="${value}"><i style="width:${(value / a.goal) * 100}%"></i></div>`;
      container.append(node);
    }
    document.querySelector("#learning-page").textContent =
      this.page + 1 + " / 6";
    document.querySelector("#learning-page-dots").innerHTML = Array.from(
      { length: 6 },
      (_, i) => `<em${i === this.page ? ' class="current"' : ""}></em>`,
    ).join("");
    document.querySelector("#learning-prev").disabled = this.page === 0;
    document.querySelector("#learning-next").disabled = this.page === 5;
    document.querySelector("#learning-save-state").textContent = this.ui
      .storageBlocked
      ? "存储受限 · 当前记录未保存"
      : "本机学习档案";
  }
  turn(delta) {
    this.page = Math.max(0, Math.min(5, this.page + delta));
    this.render();
  }
  open() {
    this.openState = true;
    this.page = 0;
    this.wasQuestionPaused = this.ui.paused;
    this.restoreQuestion = !!this.ui.active && !this.ui.paused;
    this.restoreCombat = this.ui.state?.phase === 1 && !this.ui.active;
    this.waitingPause = this.restoreCombat;
    this.ui.audio.learningReading = this.restoreCombat || this.restoreQuestion;
    this.ui.audio.syncMusic();
    this.ui.lockHeld?.();
    if (this.restoreQuestion) this.ui.pause("查看铭文成就");
    else if (this.restoreCombat) this.ui.send("Escape", "Escape");
    this.panel.hidden = false;
    document.querySelector("#viewport").classList.add("archive-open");
    this.refresh();
    document.querySelector("#learning-close").focus();
  }
  close() {
    this.openState = false;
    this.panel.hidden = true;
    document.querySelector("#viewport").classList.remove("archive-open");
    if (this.restoreQuestion && this.ui.active && !this.wasQuestionPaused)
      document.querySelector("#word-resume").click();
    else if (this.restoreCombat) {
      if (this.waitingPause) this.closeRequested = true;
      else this.ui.send("Escape", "Escape");
    }
    if (!this.restoreCombat) {
      this.ui.audio.learningReading = false;
      this.ui.audio.syncMusic();
    }
    this.ui.lockHeld?.();
    this.ui.focus();
  }
  receive(s) {
    if (this.waitingPause && s.phase === 4) {
      this.waitingPause = false;
      if (this.closeRequested) {
        this.closeRequested = false;
        this.ui.send("Escape", "Escape");
      }
    }
    if (
      s.phase === 1 &&
      !this.openState &&
      !this.waitingPause &&
      !this.closeRequested
    ) {
      this.ui.audio.learningReading = false;
      this.ui.audio.syncMusic();
    }
    this.update();
  }
}
