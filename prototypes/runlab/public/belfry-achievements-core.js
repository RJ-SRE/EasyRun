export const ACHIEVEMENT_KEY = "easyrun-belfry-achievements-v1";
export const GROUPS = { journey: "行旅", craft: "技艺", inscription: "铭文" };
export const ACHIEVEMENTS = [
  {
    id: "hunter-trial",
    group: "craft",
    title: "看破倒影",
    goal: 1,
    rule: "接受旧猎手试炼后，不落地或受击换过三个不同锚点，并抵达交付台。",
    lore: "猎手没有留下答案，只留下了可以抵达的下一步。",
    icon: "M4 25 12 8l12 20 8-19M8 8h8m4 20h8M28 9h7",
  },
  {
    id: "city-index",
    group: "journey",
    title: "替城记住",
    goal: 1,
    rule: "取得并核对无名者索引的两份记录。",
    lore: "编号七，是送信的苇。编号十一，是修路的栖。",
    icon: "M5 8h11v22H5zM20 8h11v22H20zM9 14h3m12 0h3M16 21h4",
  },
  {
    id: "repaired-way",
    group: "journey",
    title: "接住坠落",
    goal: 1,
    rule: "修好支撑后，在携心返程中实际踏上这处支撑。",
    lore: "你替它找回扣件，它替你留下落脚的地方。",
    icon: "M4 21h28M8 21v10m20-10v10M18 3v12m-5-5 5 5 5-5",
  },
  {
    id: "first-sling",
    group: "journey",
    title: "借风起身",
    goal: 1,
    rule: "在冒险中完成一次钩索借力甩出。",
    lore: "城没有路，风替你留了一条。",
    icon: "M8 25Q28 26 25 7M18 8h8v8M7 18l7 7-7 4",
  },
  {
    id: "keeper",
    group: "journey",
    title: "井底来客",
    goal: 1,
    rule: "抵达守心者所在的最深处。",
    lore: "有人终于听见那座钟。",
    icon: "M9 8h18v20H9zM14 8V4h8v4M18 12v10m-4-4 4 4 4-4",
  },
  {
    id: "home",
    group: "journey",
    title: "携心归来",
    goal: 1,
    rule: "带着钟心返回井口，完成一次冒险。",
    lore: "这一次，钟声跟你走。",
    icon: "M18 30 7 17l11-12 11 12zM18 24V11m-5 5 5-5 5 5",
  },
  {
    id: "fearless",
    group: "journey",
    title: "无畏之证",
    goal: 1,
    rule: "在无畏难度下完成冒险。",
    lore: "深渊知道你的分量。",
    icon: "M18 3 5 10l4 15 9 8 9-8 4-15zM12 17l4 5 9-11",
  },
  {
    id: "untouched",
    group: "journey",
    title: "不染尘埃",
    goal: 1,
    rule: "从新冒险出发，全程未受伤、未死亡且未续档，携心通关。",
    lore: "经过千年尘埃，衣角仍轻。",
    icon: "M18 3v30M3 18h30M9 9l18 18M9 27 27 9M18 8l10 10-10 10L8 18z",
  },
  {
    id: "echoes",
    group: "journey",
    title: "旧城回声",
    goal: 3,
    rule: "在同一次冒险中收齐三枚失落回声。",
    lore: "被遗忘的事，也有人带走。",
    icon: "M8 10l4 8-4 8-4-8zM18 5l5 13-5 13-5-13zM28 10l4 8-4 8-4-8z",
  },
  {
    id: "parry",
    group: "craft",
    title: "断雨人",
    goal: 3,
    rule: "在冒险中累计斩断三枚敌方弹幕。",
    lore: "连落下的雨，也被刀锋分开。",
    icon: "M8 29 28 7M6 9l6 6m9 9 7 7M5 22l6 3m15-15 5 3",
  },
  {
    id: "mark",
    group: "craft",
    title: "裂印双奏",
    goal: 1,
    rule: "用满蓄断潮命中并引爆贯夜留下的裂印。",
    lore: "箭写下开头，刀完成句点。",
    icon: "M4 11h25m-6-5 6 5-6 5M9 31 28 15M6 26l8 8M18 13l-4 7 5 2-2 5",
  },
  {
    id: "air-chain",
    group: "craft",
    title: "踏空换弦",
    goal: 2,
    rule: "未落地或受击，连续接上两个不同的钩索目标。",
    lore: "脚下是空的，下一步不是。",
    icon: "M9 9a4 4 0 1 0 0 1M27 25a4 4 0 1 0 0 1M10 13q16 0 16 8",
  },
  {
    id: "collision",
    group: "craft",
    title: "借敌破敌",
    goal: 1,
    rule: "击退一名敌人，使其撞击另一名敌人。",
    lore: "城里的规矩，偶尔可以借用。",
    icon: "M5 10h8v16H5zM24 10h7v16h-7M14 18h9m-4-4 4 4-4 4",
  },
  {
    id: "last-ember",
    group: "craft",
    title: "一线生机",
    goal: 1,
    rule: "仅剩一格生命时成功完成回息。",
    lore: "最后一粒余烬，也足够照亮掌心。",
    icon: "M18 4q-1 9 5 10 4-3 3-6 9 14-1 22H11Q2 23 11 12q-1 9 7 11-4-11 0-19z",
  },
  {
    id: "first-word",
    group: "inscription",
    title: "落笔成锋",
    goal: 1,
    rule: "在冒险中正确完成一次刻印。",
    lore: "你写下的第一个词，有了重量。",
    icon: "M9 28 26 5l5 4-17 23H8zM12 24l5 4M5 33h23",
  },
  {
    id: "ten-words",
    group: "inscription",
    title: "十词相伴",
    goal: 10,
    rule: "累计正确运用十个不同单词，重复词只计一次。",
    lore: "词义逐渐成为路上的同伴。",
    icon: "M7 6h22v25H7zM12 12h12m-12 6h12m-12 6h7",
  },
  {
    id: "thirty-words",
    group: "inscription",
    title: "三十道刻痕",
    goal: 30,
    rule: "累计正确运用三十个不同单词，不要求同一局完成。",
    lore: "铜页上的刻痕，各有来处。",
    icon: "M5 8h12v23H5zM19 8h12v23H19zM9 13h4m10 0h4M9 19h4m10 0h4M9 25h4m10 0h4",
  },
  {
    id: "word-streak",
    group: "inscription",
    title: "心领神会",
    goal: 5,
    rule: "在一次冒险中连续答对五次刻印；答错、放弃或重试会中断。",
    lore: "这一次，思绪追上了刀锋。",
    icon: "M18 5 5 18l13 13 13-13zM11 18l5 5 10-11",
  },
];
const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
const number = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);

// Persistent, local evidence only; no run reconstruction from old score records.
export class AchievementBook {
  constructor(raw = null) {
    this.data = {
      version: 1,
      progress: {},
      unlocked: {},
      words: [],
      equipped: "",
    };
    this.revision = 0;
    this.pending = [];
    this.corrupt = false;
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (
          d?.version !== 1 ||
          !d.progress ||
          !d.unlocked ||
          !Array.isArray(d.words)
        )
          throw new Error("schema");
        for (const a of ACHIEVEMENTS) {
          const at = number(d.unlocked[a.id]);
          if (at && at <= Date.now() + 86400000) this.data.unlocked[a.id] = at;
          this.data.progress[a.id] = this.data.unlocked[a.id]
            ? a.goal
            : Math.min(a.goal - 1, Math.floor(number(d.progress[a.id])));
        }
        this.data.words = [
          ...new Set(
            d.words.filter(
              (w) => typeof w === "string" && /^[a-z][a-z-]{1,31}$/.test(w),
            ),
          ),
        ].slice(0, 300);
        if (byId.has(d.equipped) && this.data.unlocked[d.equipped])
          this.data.equipped = d.equipped;
      } catch {
        this.corrupt = true;
        this.data = {
          version: 1,
          progress: {},
          unlocked: {},
          words: [],
          equipped: "",
        };
      }
    }
    this.resetSession();
  }
  resetSession() {
    this.lastSerial = 0;
    this.run = null;
    this.resolved = new Set();
    this.pending = [];
  }
  mark(id, value = byId.get(id).goal) {
    const a = byId.get(id);
    value = Math.min(a.goal, Math.max(0, Math.floor(value)));
    if (value <= (this.data.progress[id] || 0)) return;
    this.data.progress[id] = value;
    this.revision++;
    if (value >= a.goal && !this.data.unlocked[id]) {
      this.data.unlocked[id] = Date.now();
      this.pending.push(id);
    }
  }
  deed(e) {
    if (
      !e ||
      !Number.isSafeInteger(e.serial) ||
      e.serial <= this.lastSerial ||
      !Number.isSafeInteger(e.attempt)
    )
      return;
    this.lastSerial = e.serial;
    if (e.name === "start") {
      this.run = {
        attempt: e.attempt,
        practice: !!e.practice,
        fresh: true,
        hurt: false,
        core: false,
        targets: new Set(),
        streak: 0,
      };
      return;
    }
    if (e.name === "practice") {
      if (this.run) this.run.practice = true;
      return;
    }
    if (["retry", "restored"].includes(e.name)) {
      this.run = {
        attempt: e.attempt,
        practice: !!e.practice,
        fresh: false,
        hurt: true,
        core: false,
        targets: new Set(),
        streak: 0,
      };
      return;
    }
    const r = this.run;
    if (!r || r.attempt !== e.attempt || r.practice || e.practice) return;
    if (e.name === "menu") {
      this.run = null;
      return;
    }
    if (["hurt", "fail", "touchdown"].includes(e.name)) r.targets.clear();
    if (["hurt", "fail"].includes(e.name)) r.hurt = true;
    if (![1, 2].includes(e.phase)) return;
    if (e.name === "sling") this.mark("first-sling");
    if (
      e.name === "hookattach" &&
      Number.isSafeInteger(e.hook) &&
      e.hook >= 0
    ) {
      r.targets.add(e.hook);
      this.mark("air-chain", r.targets.size);
    }
    if (e.name === "guardian") this.mark("keeper");
    if (e.name === "trialcomplete") this.mark("hunter-trial");
    if (e.name === "indexcomplete") this.mark("city-index");
    if (e.name === "repairroute") this.mark("repaired-way");
    if (e.name === "core") r.core = true;
    if (e.name === "echo") this.mark("echoes", e.echoes);
    if (e.name === "parry")
      this.mark("parry", (this.data.progress.parry || 0) + 1);
    if (e.name === "markbreak") this.mark("mark");
    if (e.name === "collision") this.mark("collision");
    if (e.name === "healcomplete" && e.health === 2) this.mark("last-ember");
    if (e.name === "finish" && e.phase === 2) {
      this.mark("home");
      if (e.difficulty === 1) this.mark("fearless");
      if (r.fresh && r.core && !r.hurt && e.deaths === 0)
        this.mark("untouched");
    }
  }
  word(s) {
    const r = this.run;
    if (
      !r ||
      r.practice ||
      s.attempt !== r.attempt ||
      this.resolved.has(s.actionId)
    )
      return;
    this.resolved.add(s.actionId);
    if (this.resolved.size > 400)
      this.resolved.delete(this.resolved.values().next().value);
    if (s.result !== 1) {
      r.streak = 0;
      return;
    }
    this.mark("first-word");
    this.mark("word-streak", ++r.streak);
    if (
      !this.data.words.includes(s.wordId) &&
      /^[a-z][a-z-]{1,31}$/.test(s.wordId) &&
      this.data.words.length < 300
    ) {
      this.data.words.push(s.wordId);
      this.revision++;
    }
    this.mark("ten-words", this.data.words.length);
    this.mark("thirty-words", this.data.words.length);
  }
  equip(id) {
    if (id && (!byId.has(id) || !this.data.unlocked[id])) return false;
    if (id !== this.data.equipped) {
      this.data.equipped = id;
      this.revision++;
    }
    return true;
  }
  get count() {
    return Object.keys(this.data.unlocked).length;
  }
  serialize() {
    return JSON.stringify(this.data);
  }
}
