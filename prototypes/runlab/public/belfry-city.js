import {
  expeditionDevice,
  EXPEDITION,
  questRecord,
  expeditionAfterword,
} from "./belfry-expedition.js";
export const DISTRICTS = [
  {
    id: "wind",
    name: "风钟门",
    mark: "I · THE WINDBELL GATE",
    goal: "循着求救信号下潜",
    threshold: 0,
    story: "任务铭牌只剩半句话：带回钟心。若城里仍有回声——后半句被人刮去了。",
    returning: "来时沉默的风钟开始震动。你留下的修复，正在成为回家的路。",
  },
  {
    id: "forge",
    name: "铸钟炉",
    mark: "II · THE LAST FOUNDRY",
    goal: "接通配重，穿过熄炉",
    threshold: 740,
    story: "炉火并非为铸造兵器而烧。维修簿上写着：停炉之后，记忆泵仍须运转。",
    returning: "没有谁回来开工。仍在运转的配重，是你亲手留下的回答。",
  },
  {
    id: "archive",
    name: "沉水档案",
    mark: "III · THE DROWNED ARCHIVE",
    goal: "寻找钟心保存的秘密",
    threshold: 1530,
    story:
      "每一只沉入水中的空罐，都有不同的名字。所谓求救信号，来自一份迟迟未寄出的告别。",
    returning: "水面正在吞没旧书架。你已经读到的名字，不会再随它沉下去。",
  },
  {
    id: "mirror",
    name: "碎镜唱廊",
    mark: "IV · THE FRACTURED CHOIR",
    goal: "辨认铜链，接通镜桥",
    threshold: 2340,
    story:
      "镜面保存着离去时的脚步，却托不起后来者。能承重的桥，都连着真实的铜链。",
    returning: "倒影仍在向下走，你已决定向上。修好的镜桥不再随钟声摆动。",
  },
  {
    id: "heart",
    name: "守心机枢",
    mark: "V · THE HEART ENGINE",
    goal: "决定钟心最后的去向",
    threshold: 3070,
    story:
      "守心者守的不是宝物。钟心的一条供能线通向出口，另一条，连着整座城最后的灯。",
    returning: "钟锁已断。你的选择留在城里，剩下的路，要亲自走完。",
  },
];
export const DEVICES = [
  {
    title: "停转的风阀",
    action: "F · 接通风阀",
    detail: "右侧井道恢复上升气流，返程也可借力。",
  },
  {
    title: "修钟人的配重",
    action: "F · 修复升降台",
    detail: "启动中央配重台；跳上铜轨中的实体平台。",
  },
  {
    title: "被淹没的名册",
    action: "F · 排水，读取档案",
    detail: "显露维修肩台，也读到那半句被刮去的话。",
  },
  {
    title: "错位的镜桥",
    action: "F · 校准承重链",
    detail: "在两岸之间接通一座真正能落脚的桥。",
  },
  {
    title: "最后的供能线",
    action: "F · 留灯",
    detail:
      "留灯：夺心时以一格生命供能，返程黑潮慢 15%。\n携心：夺心时充满余烬，黑潮保持原速。",
    alternate: "V · 携心",
  },
];
const STORIES = {
  couriercomplete: [
    "迟到的投递",
    "运输匣终于抵达。上层旧货梯重新亮起，你可以在返程使用它。",
  ],
  repaircomplete: [
    "缺口被接住了",
    "修补机把扣件送回支架。中央的新落脚点已经可以使用。",
  ],
  indexcomplete: [
    "编号之后的名字",
    "送信的苇，修路的栖。两份索引终于拼出了它们的名字。",
  ],
  trialcomplete: [
    "旧猎手的认可",
    "连续换钩已完成。「看破倒影」可在成就册中佩戴。",
  ],
  lanterncomplete: [
    "留给归途的光",
    "备用灯芯已经安放。带回钟心后，这处路标与落脚点会再次亮起。",
  ],
  repairblocked: [
    "维修位置仍有危险",
    "先处理机器附近的巡守，再把受力扣交给它。",
  ],
  trialincomplete: [
    "这一段还没有连起来",
    "不落地连续换过三个不同锚点，再回来交付。受击或提前落地会重计。",
  ],
  citywind: [
    "风找到了出口",
    "风阀重新呼吸。沿右侧的细长风迹跳入气流；返回这里时，它仍会接住你。",
  ],
  cityforge: [
    "一份未完成的工作",
    "维修傀儡早已停机，手边却留着最后一枚齿轮。你替它把配重接了回去。",
  ],
  cityarchive: [
    "被删掉的后半句",
    "“若城里仍有回声，请先记住它们的名字。”钟心保存的是逝去居民的记忆，守卫害怕的，是它们再被遗忘一次。",
  ],
  citymirror: [
    "让倒影成为路",
    "你没有修好碎镜。你把它们背后的承重链重新拉直了。中央的桥，现在是真的。",
  ],
  cityshare: [
    "留一束光",
    "你把供能线接回旧城。夺心时少恢复一格生命，换取更缓的黑潮与仍会亮起的灯。",
  ],
  citycarry: [
    "把记忆带出去",
    "你切断回流，把钟心留给归途。夺心时余烬充满；记住的事，会由你带走。",
  ],
  guardian: [
    "他为何不肯让路",
    "守心者的刃上刻着同一句誓言：不让最后一个名字消失。拉断两侧钟锁，结束这场无人接替的守夜。",
  ],
  core: [
    "钟城开始下沉",
    "钟心已经醒了，黑潮也一样。沿铜链锚点向上；你若修复过机关，它们会把来时的改变留在归途。",
  ],
};
const STORY_DISTRICTS = {
  couriercomplete: 0,
  repaircomplete: 1,
  indexcomplete: 2,
  trialcomplete: 3,
  lanterncomplete: 4,
  repairblocked: 1,
  trialincomplete: 3,
  citywind: 0,
  cityforge: 1,
  cityarchive: 2,
  citymirror: 3,
  cityshare: 4,
  citycarry: 4,
  guardian: 4,
  core: 4,
};
function returnStory(s, d) {
  const repaired = [s.cityWind, s.cityForge, s.cityArchive, s.cityMirror, 1];
  return repaired[s.cityDistrict]
    ? d.returning
    : [
        "风阀依旧沉默。出口已在上方，沿永久锚点继续攀升。",
        "配重还没有接通。熄灭的炉火下，来时的锚点仍通往上层。",
        "名册仍在水下。你带走了钟心，却还不知道它保存着谁。",
        "镜桥仍是倒影。认准铜链锚点，别把虚影当成落脚处。",
      ][s.cityDistrict];
}
function baseEndingFor(s) {
  if (s.cityChoice === 1)
    return {
      title: "让城记得。",
      text: s.cityArchive
        ? "你把钟心带回井口，也让最后的供能线留在城中。\n档案里的名字，一盏一盏，重新亮起来。"
        : "你带回了钟心。深处仍有一盏灯，没有随黑潮熄灭。\n你尚未读懂那些名字，却为它们留下了一次被读到的机会。",
    };
  return {
    title: s.cityArchive ? "记忆有了归途。" : "你带回了心跳。",
    text: s.cityArchive
      ? "城里的钟声终于停了。那些名字没有消失——\n你带着它们离开，成为这座城最后一位记述者。"
      : "任务完成了：钟心在你手里，旧城沉入深处。\n那半句被刮去的委托，仍留在水下的档案里。",
  };
}
export function endingFor(s) {
  const ending = baseEndingFor(s),
    afterword = expeditionAfterword(s.expedition);
  return { ...ending, text: ending.text + (afterword ? "\n" + afterword : "") };
}
const $ = (q) => document.querySelector(q);
export class CityUI {
  constructor({ send, focus, lockInput }) {
    this.send = send;
    this.focus = focus;
    this.lockInput = lockInput;
    this.button = document.createElement("button");
    this.button.id = "city-book-open";
    this.button.textContent = "城中纪事";
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
      '<header><div><small>A CITY IS MORE THAN ITS HEART</small><h2 id="city-book-title">城中纪事</h2></div><button id="city-book-close" aria-label="合上纪事">×</button></header><p class="city-book-intro">五个区域，一份没有写完的委托。机关可选；你改变过的路，会留到返程。</p><div id="city-entries"></div><p id="city-choice-record"></p>';
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
      '<small>城里的旧机关</small><h3></h3><p></p><div><button id="city-use"></button><button id="city-alternate"></button></div>';
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
    const s = this.state,
      flags = [
        s.cityWind,
        s.cityForge,
        s.cityArchive,
        s.cityMirror,
        s.cityChoice,
      ];
    $("#city-entries").replaceChildren();
    for (const [i, d] of DISTRICTS.entries()) {
      const visited = s.expedition
          ? (s.cityDepth || 0) >= -EXPEDITION.rooms[i * 3].top
          : (s.cityDepth || 0) >= d.threshold,
        row = document.createElement("article");
      row.dataset.visited = String(visited);
      row.innerHTML = `<img src="/art/city/${d.id}.png" alt="" loading="lazy"><div><small>${d.mark}</small><h3>${d.name}<span>${flags[i] ? "已改变此地" : visited ? "已抵达" : "尚未抵达"}</span></h3><p></p></div>`;
      row.querySelector("p").textContent = visited
        ? d.story
        : "沿主路下潜后，纪事才会记录这里的线索。";
      const discovery = ["citywind", "cityforge", "cityarchive", "citymirror"][
        i
      ];
      if (visited && flags[i] && discovery) {
        const found = document.createElement("p");
        found.textContent = STORIES[discovery][1];
        row.querySelector("div").append(found);
      }
      $("#city-entries").append(row);
    }
    if (s.expedition) {
      for (const [i, q] of EXPEDITION.sides.entries()) {
        if (!s.expedition.sides[i]) continue;
        const row = document.createElement("article");
        const text = document.createElement("p");
        text.textContent = `${q.name} · ${s.expedition.sides[i] === 2 ? "已完成" : "进行中"}\n${questRecord(i, s.expedition.sides[i])}`;
        row.append(text);
        $("#city-entries").append(row);
      }
    }
    const choice =
      s.cityChoice === 1
        ? "留灯：夺心恢复时少一格生命；返程黑潮慢 15%。"
        : s.cityChoice === 2
          ? "携心：夺心余烬充满；黑潮原速。"
          : "尚未决定供能线的去向。机枢前厅可选留灯或携心；略过则沿用携心任务。";
    $("#city-choice-record").textContent =
      (s.cityArchive ? STORIES.cityarchive[1] + "\n\n" : "") +
      choice +
      (s.expedition?.recordChoice === 1
        ? "\n\n档案选择：已带走原件，保留完整的委托证据。"
        : s.expedition?.recordChoice === 2
          ? "\n\n档案选择：已复制目录，返程时永久锚点旁会出现额外指引。"
          : "");
  }
}
