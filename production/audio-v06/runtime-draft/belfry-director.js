// Dialogue decisions use game time, live targets and encounter boundaries.
// Pure logic: no audio, timers, DOM or engine writes. Replayable in tests.
export class DialogueDirector {
  constructor(lines) {
    this.lines = lines;
    this.used = new Set();
    this.recent = new Map();
    this.queue = [];
    this.encounter = 0;
    this.combatSpoken = false;
    this.aftermathSpoken = false;
    this.lastSpoke = -100;
    this.lastReflection = 0;
    this.safeSince = 0;
    this.nearMiss = false;
    this.risky = false;
    this.heavy = false;
    this.hit = false;
    this.kills = 0;
    this.lastThreat = -100;
    this.afterPending = false;
    this.state = null;
    this.foes = {};
    this.counts = { expired: 0, invalid: 0, played: 0 };
  }
  reset(retry = false) {
    this.queue = [];
    if (!retry) this.used.clear();
    this.lastSpoke = -100;
    this.lastReflection = retry ? (this.state?.elapsed ?? 0) : 0;
    this.safeSince = retry ? (this.state?.elapsed ?? 0) : 0;
    this.lastThreat = -100;
    this.encounter++;
    this.combatSpoken = this.aftermathSpoken = false;
    this.hit = this.heavy = this.risky = this.nearMiss = false;
    this.afterPending = false;
  }
  near(foe, range = 480) {
    const s = this.state;
    return (
      s &&
      foe &&
      foe.hp > 0 &&
      Math.hypot(foe.x - s.x, foe.y - s.y - 28) < range
    );
  }
  safe() {
    const s = this.state;
    return (
      s?.phase === 1 &&
      s.threats === 0 &&
      Math.abs(s.vy) < 45 &&
      Math.abs(s.vx) < 45 &&
      s.segment !== 2
    );
  }
  object(event) {
    const s = this.state;
    if (!s || s.practice) return false;
    if (event === "inspect_empty_beacon")
      return Math.hypot(s.x - 230, s.y) < 125;
    // A visible abandoned helmet/post sits beside the second checkpoint.
    if (event === "inspect_abandoned_post")
      return Math.hypot(s.x - 720, s.y + 2100) < 135;
    return true;
  }
  valid(q) {
    const s = this.state,
      l = q.line;
    if (!s || (s.phase !== 1 && !(s.phase === 2 && l.event === "finish")))
      return false;
    if (l.context === "warning") {
      const f = this.foes[q.target];
      return (
        this.near(f, 360) && f.x < s.x - 25 && (f.state === 1 || f.hazard > 0)
      );
    }
    if (
      q.target != null &&
      l.event !== "lamp_broken" &&
      !this.near(this.foes[q.target])
    )
      return false;
    if (l.event === "encounter_choice") return this.choice();
    if (l.event === "exposed")
      return s.bossShield === 0 && s.bossHP > 0 && s.segment === 1;
    if (l.context === "reflection")
      return (
        this.safe() && this.object(l.event) && s.elapsed - this.safeSince >= 6
      );
    if (l.context === "aftermath" && l.speaker === "hero")
      return this.safe() && s.elapsed - this.lastThreat >= 1.2;
    if (
      l.context === "combat" &&
      l.speaker === "hero" &&
      l.event !== "clean_encounter_end"
    )
      return s.threats > 0;
    if (l.event === "clean_encounter_end") return this.safe();
    return true;
  }
  choice() {
    const s = this.state;
    if (!s) return false;
    const all = Object.values(this.foes);
    const hookable = all.some(
      (f) => [0, 4].includes(f.kind) && this.near(f, 450),
    );
    const cable = all.some((f) => {
      if (f.kind !== 1 || f.hazard <= 0) return false;
      const dx = f.aimX - f.x,
        dy = f.aimY - f.y,
        d = dx * dx + dy * dy;
      const t = Math.max(
        0,
        Math.min(1, ((s.x - f.x) * dx + (s.y + 28 - f.y) * dy) / (d || 1)),
      );
      return Math.hypot(s.x - f.x - dx * t, s.y + 28 - f.y - dy * t) < 125;
    });
    return hookable && cable;
  }
  offer(event, speaker = "hero", target = null) {
    const now = this.state?.elapsed ?? 0;
    const line = this.lines.find(
      (l) =>
        l.event === event &&
        l.speaker === speaker &&
        !this.used.has(l.id) &&
        !this.queue.some((q) => q.line.id === l.id),
    );
    if (!line) return;
    const q = { line, at: now, target, encounter: this.encounter };
    this.queue.push(q);
    this.queue.sort((a, b) => b.line.priority - a.line.priority);
    this.queue = this.queue.slice(0, 6);
  }
  event(name) {
    if (["start", "practice", "retry"].includes(name))
      this.reset(name === "retry");
    if (name === "hurt") {
      this.hit = true;
      this.nearMiss = true;
    }
    if (name === "charged") this.heavy = true;
    if (name === "sling" && Math.abs(this.state?.vy ?? 0) > 400)
      this.risky = true;
    if (name === "hardland" && this.risky) {
      this.offer("risky_route_landed");
      this.risky = false;
    }
    if (name === "fail") {
      this.queue = [];
      return;
    }
    if (name === "exposed") this.offer(name, "bell", 10);
    this.offer(name);
  }
  enemy(event, id, kind) {
    const speaker = {
      0: "lantern",
      1: "weaver",
      2: "bell",
      3: "bell",
      4: "mimic",
    }[kind];
    if (event === "tell") {
      const f = this.foes[id];
      if (this.near(f, 360) && f.x < this.state.x - 25)
        this.offer("threat_left", "hero", id);
    }
    if (event === "collapse") {
      // Remove pending speech from a defeated actor immediately.
      this.queue = this.queue.filter((q) => q.target !== id);
      if (kind === 0) this.offer("lamp_broken", speaker, id);
      return;
    }
    this.offer(event, speaker, id);
  }
  update(s, foes) {
    const old = this.state;
    this.state = s;
    this.foes = foes;
    if (s.phase !== 1) {
      this.queue = this.queue.filter(
        (q) => s.phase === 2 && q.line.event === "finish",
      );
      return;
    }
    if (!this.safe()) this.safeSince = s.elapsed;
    if (s.threats > 0) {
      if (s.elapsed - this.lastThreat > 3) {
        this.encounter++;
        this.combatSpoken = this.aftermathSpoken = false;
        this.hit = this.heavy = false;
        this.kills = s.kills;
      }
      this.lastThreat = s.elapsed;
      this.afterPending = true;
      if (this.choice()) this.offer("encounter_choice");
    } else if (
      this.afterPending &&
      this.safe() &&
      s.elapsed - this.lastThreat > 1.2
    ) {
      this.afterPending = false;
      if (s.health <= 2) this.offer("low_health_safe");
      else if (this.heavy && s.kills > this.kills)
        this.offer("charged_encounter_end");
      else if (!this.hit && s.kills > this.kills)
        this.offer("clean_encounter_end");
      else if (this.nearMiss) this.offer("shelter_after_near_miss");
      this.nearMiss = false;
    }
    if (
      this.safe() &&
      s.elapsed - this.safeSince >= 6 &&
      s.elapsed - this.lastReflection >= 45
    ) {
      for (const event of ["inspect_empty_beacon", "inspect_abandoned_post"]) {
        if (this.object(event)) this.offer(event);
      }
    }
    // Start/retry messages arrive before the next engine state; their time origin
    // must follow a reset without retaining candidates from the old timeline.
    if (old && s.elapsed < old.elapsed)
      for (const q of this.queue) q.at = s.elapsed;
  }
  next(settings, wallNow) {
    const now = this.state?.elapsed ?? 0;
    this.queue = this.queue.filter((q) => {
      if (now - q.at > q.line.ttl) {
        this.counts.expired++;
        return false;
      }
      if (!this.valid(q)) {
        this.counts.invalid++;
        return false;
      }
      return true;
    });
    const interval = settings.chatter === "chatty" ? 18 : 30;
    const index = this.queue.findIndex((q) => {
      const l = q.line;
      if (
        settings.chatter === "quiet" &&
        !["story", "warning"].includes(l.context)
      )
        return false;
      if (
        l.repeat !== "once_per_run" &&
        wallNow - (this.recent.get(l.id) ?? -1000) < 600
      )
        return false;
      if (l.context === "combat" && this.combatSpoken) return false;
      if (l.context === "aftermath" && this.aftermathSpoken) return false;
      return (
        l.context === "warning" ||
        (l.context === "story" && now - this.lastSpoke > 4) ||
        now - this.lastSpoke >= interval
      );
    });
    return index < 0 ? null : this.queue.splice(index, 1)[0];
  }
  played(q, wallNow) {
    const l = q.line,
      now = this.state?.elapsed ?? 0;
    this.lastSpoke = now;
    this.used.add(l.id);
    this.recent.set(l.id, wallNow);
    this.counts.played++;
    if (l.context === "reflection") this.lastReflection = now;
    if (l.context === "combat") this.combatSpoken = true;
    if (l.context === "aftermath") this.aftermathSpoken = true;
  }
}
