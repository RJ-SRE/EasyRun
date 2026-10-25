import { expeditionDevice, EXPEDITION } from "./belfry-expedition.js";
export const DISTRICTS = [
  {
    id: "wind",
    name: "风钟门",
    mark: "I · THE OUTER WATCH",
    story: "守卫仍在巡逻。借高低路线接近，让第一刀落在它们的侧后。",
    returning: "出口已在上方。借锚点越过最后的追兵。",
  },
  {
    id: "forge",
    name: "铸钟炉",
    mark: "II · THE IRON HUNT",
    story: "厚甲与猎兽封住炉底。观察举刃和低伏，别在正面硬接。",
    returning: "重甲留在深处，向上换钩穿过旧炉。",
  },
  {
    id: "archive",
    name: "沉水档案",
    mark: "III · THE SEVERED THREAD",
    story: "细线牵着守卫的残甲。找出缝魂师，让它们失去掩护。",
    returning: "水面正在上涨。保持高度，继续向光里走。",
  },
  {
    id: "mirror",
    name: "碎镜唱廊",
    mark: "IV · THE TWIN HUNTERS",
    story: "猎手交替追击。分开它们，抓住重新配合前的空档。",
    returning: "倒影向下，刀锋向上。归途已经在你的手中。",
  },
  {
    id: "heart",
    name: "守心机枢",
    mark: "V · THE HEARTKEEPER",
    story: "没有钟锁替他挡刀。三种形态，三种距离，读懂每一次起手。",
    returning: "钟心已经醒来。沿永久锚点离开深处。",
  },
];
export const DEVICES = [];
const STORIES = {
  guardian: [
    "最后的守夜",
    "守心者已经起身。重甲看收势，追猎换高度，裂心留意第二次起手。",
  ],
  core: ["携心上返", "守卫正在退散。沿来时的永久锚点向上，只需越过少量追兵。"],
};
const STORY_DISTRICTS = { guardian: 4, core: 4 };
function returnStory(s, d) {
  return d.returning;
}
export function endingFor() {
  return {
    title: "你带回了心跳。",
    text: "守夜终于结束。那些留在残甲中的名字，随钟心一起抵达光里。",
  };
}
const $ = (q) => document.querySelector(q);
export class CityUI {
  constructor({ send, focus, lockInput }) {
    this.send = send;
    this.focus = focus;
    this.lockInput = lockInput;
    this.button = document.createElement("button");
    this.button.id = "city-book-open";
    this.button.textContent = "猎手手记";
    this.button.setAttribute("aria-haspopup", "dialog");
    $(".topbar nav").insertBefore(this.button, $("#help"));
    this.button.onclick = () => this.open();
    this.fullscreenButton = this.button.cloneNode(true);
    this.fullscreenButton.id = "city-book-fullscreen";
    this.fullscreenButton.onclick = () => this.open();
    $("#viewport").append(this.fullscreenButton);
    this.dialog = document.createElement("dialog");
    this.dialog.id = "city-book";
    this.dialog.setAttribute("aria-labelledby", "city-book-title");
    this.dialog.innerHTML =
      '<header><div><small>READ THE ENEMY. OWN THE HEIGHT.</small><h2 id="city-book-title">猎手手记</h2></div><button id="city-book-close" aria-label="合上纪事">×</button></header><p class="city-book-intro">八类守卫，五区猎场。看清轮廓、读懂起手，再决定怎样接近。</p><div id="city-entries"></div><p id="city-choice-record"></p>';
    $("#viewport").append(this.dialog);
    $("#city-book-close").onclick = () => this.close();
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
    this.prompt = document.createElement("aside");
    this.prompt.id = "city-interaction";
    this.prompt.hidden = true;
    this.prompt.innerHTML =
      '<small></small><h3></h3><p></p><div><button id="city-use"></button><button id="city-alternate"></button></div>';
    $("#viewport").append(this.prompt);
    $("#city-use").onclick = () => this.send("KeyF", "f");
    $("#city-alternate").onclick = () => this.send("KeyV", "v");
    this.notice = document.createElement("aside");
    this.notice.id = "city-narrative";
    this.notice.hidden = true;
    this.notice.setAttribute("role", "status");
    this.notice.innerHTML = "<small></small><p></p>";
    $("#viewport").append(this.notice);
    this.resetSession();
  }
  resetSession() {
    this.state = null;
    this.seen = new Set();
    this.queue = [];
    this.current = null;
    this.age = 0;
    this.lastElapsed = 0;
    this.resume = false;
    this.waitingPause = false;
    this.closeRequested = false;
    this.button.disabled = true;
    this.fullscreenButton.disabled = true;
    this.prompt.hidden = true;
    this.notice.hidden = true;
    if (this.dialog.open) this.dialog.close();
  }
  note(key, title, text, district, priority = false) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const entry = { title, text, district };
    if (priority) {
      this.current = entry;
      this.age = 0;
    } else this.queue.push(entry);
    if (this.queue.length > 5) this.queue.shift();
  }
  onEvent(name) {
    if (name === "start") {
      this.seen.clear();
      this.queue = [];
      this.current = null;
      this.age = 0;
      this.lastElapsed = 0;
    }
    if (name === "practice") {
      this.queue = [];
      this.current = null;
    }
    if (STORIES[name])
      this.note(name, ...STORIES[name], STORY_DISTRICTS[name], true);
  }
  receive(s) {
    this.state = s;
    if (this.waitingPause && s.phase !== 1) {
      this.waitingPause = false;
      if (this.closeRequested) this.close();
    }
    const nested =
      ["#guide", "#settings-panel", "#word-journal"].some(
        (id) => $(id) && !$(id).hidden,
      ) || !!$("#achievement-ledger")?.open;
    this.button.disabled = s.phase === 5 || nested;
    this.fullscreenButton.disabled = this.button.disabled;
    const playable =
      s.phase === 1 &&
      !s.practice &&
      !nested &&
      !this.dialog.open &&
      !document.hidden;
    const d = DISTRICTS[s.cityDistrict] || DISTRICTS[0];
    if (playable) {
      // Never carry a delayed local clue into a different district. Discoveries
      // remain readable in the journal after their non-blocking notice expires.
      this.queue = this.queue.filter(
        (entry) => entry.district === s.cityDistrict,
      );
      if (this.current && this.current.district !== s.cityDistrict)
        this.current = null;
      this.note(
        `${s.segment === 2 ? "return" : "region"}-${d.id}`,
        d.mark + " / " + d.name,
        s.segment === 2 ? returnStory(s, d) : d.story,
        s.cityDistrict,
      );
    }
    const expDevice = expeditionDevice(s);
    this.prompt.hidden = !(playable && (expDevice || s.cityPrompt >= 0));
    if (!this.prompt.hidden) {
      const device = expDevice || DEVICES[s.cityPrompt];
      this.prompt.querySelector("h3").textContent = device.title;
      this.prompt.querySelector("p").textContent = device.detail;
      $("#city-use").textContent = device.action;
      $("#city-alternate").textContent = device.alternate || "";
      $("#city-alternate").hidden = !device.alternate;
    }
    const dt = Math.max(0, Math.min(0.15, s.elapsed - this.lastElapsed));
    this.lastElapsed = s.elapsed;
    if (playable && this.prompt.hidden) {
      if (!this.current) {
        this.current = this.queue.shift();
        this.age = 0;
      }
      if (this.current) {
        this.notice.querySelector("small").textContent = this.current.title;
        this.notice.querySelector("p").textContent = this.current.text;
        this.age += dt;
        if (this.age > 7.5) this.current = null;
      }
    }
    this.notice.hidden = !(playable && this.prompt.hidden && this.current);
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
    $("#city-book-close").focus();
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
    } else if (document.fullscreenElement) this.fullscreenButton.focus();
    else this.button.focus();
    this.resume = false;
    this.closeRequested = false;
  }
  render() {
    const s = this.state;
    $("#city-entries").replaceChildren();
    for (const [i, d] of DISTRICTS.entries()) {
      const visited = (s.cityDepth || 0) >= -EXPEDITION.rooms[i * 3].top;
      const row = document.createElement("article");
      row.dataset.visited = String(visited);
      row.innerHTML = `<img src="/art/city/${d.id}.png" alt="" loading="lazy"><div><small>${d.mark}</small><h3>${d.name}<span>${visited ? "已抵达" : "尚未抵达"}</span></h3><p></p></div>`;
      row.querySelector("p").textContent = visited
        ? d.story
        : "沿建筑路线继续下潜。";
      $("#city-entries").append(row);
    }
    for (const foe of EXPEDITION.roster || []) {
      const row = document.createElement("article");
      row.dataset.visited = "true";
      const body = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = foe.name;
      const text = document.createElement("p");
      text.textContent = `${foe.role} · ${foe.counter}`;
      body.append(title, text);
      row.append(body);
      $("#city-entries").append(row);
    }
    $("#city-choice-record").textContent =
      "轻兵可连打；重甲看方向；机动敌人抓收势。词汇完成度与冒险通关分别记录。";
  }
}
