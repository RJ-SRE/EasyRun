// Gameplay audio only. Character speech and dialogue are intentionally disabled.
const defaults = { sfx: 0.8, music: 0.35 };
const counts = {
  bowdraw: 2,
  bowshot: 3,
  bowready: 2,
  arrowhit: 3,
  heavycut: 3,
  markbreak: 2,
  healstart: 2,
  healcomplete: 2,
  chaincut: 4,
  chainfinish: 3,
  blade: 6,
  cloth: 4,
  hook: 4,
  attach: 4,
  tension: 4,
  sling: 4,
  porcelain: 5,
  brass: 5,
  heavy: 4,
  dash: 4,
  nova: 3,
  tell: 3,
  land: 3,
  web: 3,
};
export class BelfryAudio {
  constructor() {
    this.settings = { ...defaults };
    this.enabled = true;
    this.state = null;
    this.epoch = 0;
    this.cache = new Map();
    this.inflight = new Map();
    this.sources = new Set();
    this.variants = new Map();
    this.fxHistory = [];
    this.errors = [];
    this.nextNote = 0;
    try {
      const saved = JSON.parse(localStorage.getItem("belfry-audio-v2"));
      for (const k of Object.keys(defaults))
        if (Number.isFinite(saved?.[k]))
          this.settings[k] = Math.min(1, Math.max(0, saved[k]));
    } catch {
      /* Storage is optional; former voice preferences are ignored. */
    }
    this.timer = setInterval(() => this.tick(), 50);
  }
  now() {
    return performance.now() / 1000;
  }
  error(e) {
    const message = String(e);
    if (!this.errors.includes(message)) this.errors.push(message);
  }
  path(cue, variant) {
    return `/audio/sfx/${cue}-${variant}.m4a`;
  }
  async init() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const a = (this.ctx = new AudioContext()),
          limiter = a.createDynamicsCompressor();
        limiter.threshold.value = -7;
        limiter.knee.value = 5;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        limiter.connect(a.destination);
        this.master = a.createGain();
        this.master.gain.value = 0.65;
        this.master.connect(limiter);
        this.buses = {};
        for (const k of ["sfx", "music", "danger"]) {
          const g = a.createGain();
          g.gain.value = this.settings[k === "danger" ? "sfx" : k];
          g.connect(this.master);
          this.buses[k] = g;
        }
        const paths = Object.entries(counts).flatMap(([k, n]) =>
          Array.from({ length: n }, (_, i) => this.path(k, i + 1)),
        );
        this.ready = Promise.all(
          paths.map((path) => this.buffer(path).catch((e) => this.error(e))),
        );
      }
      if (this.enabled && !document.hidden && this.ctx.state !== "running")
        await this.ctx.resume();
    } catch (e) {
      this.error(e);
    }
  }
  buffer(path) {
    if (this.cache.has(path)) return Promise.resolve(this.cache.get(path));
    if (this.inflight.has(path)) return this.inflight.get(path);
    const pending = (async () => {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`Sound ${path}: ${r.status}`);
      const buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
      this.cache.set(path, buffer);
      return buffer;
    })().finally(() => this.inflight.delete(path));
    this.inflight.set(path, pending);
    return pending;
  }
  set(k, v) {
    if (!(k in defaults) || !Number.isFinite(v)) return;
    v = Math.max(0, Math.min(1, v));
    this.settings[k] = v;
    try {
      localStorage.setItem("belfry-audio-v2", JSON.stringify(this.settings));
    } catch {
      /* Optional preferences. */
    }
    if (this.buses?.[k])
      this.buses[k].gain.setTargetAtTime(v, this.ctx.currentTime, 0.04);
    if (k === "sfx" && this.buses)
      this.buses.danger.gain.setTargetAtTime(v, this.ctx.currentTime, 0.04);
  }
  mute(on) {
    this.enabled = !on;
    if (on) {
      this.stopAll();
      this.ctx?.suspend();
    } else this.init();
  }
  stopAll(fade = 0) {
    this.epoch++;
    for (const h of this.sources) {
      try {
        if (fade && this.ctx) {
          const t = this.ctx.currentTime;
          h.gain.gain.cancelScheduledValues(t);
          h.gain.gain.setTargetAtTime(0.0001, t, fade / 3);
          h.source.stop(t + fade);
        } else h.source.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.sources.clear();
    this.nextNote = 0;
    if (this.buses)
      for (const k of ["sfx", "music", "danger"]) {
        this.buses[k].gain.cancelScheduledValues(this.ctx.currentTime);
        this.buses[k].gain.setValueAtTime(
          this.settings[k === "danger" ? "sfx" : k],
          this.ctx.currentTime,
        );
      }
  }
  stateChanged(s) {
    const old = this.state;
    this.state = s;
    if (
      old &&
      ((old.phase === 1 && ![1, 2, 5].includes(s.phase)) ||
        old.attempts !== s.attempts)
    )
      this.stopAll();
    if (![1, 5].includes(s.phase) || (old && old.attempts !== s.attempts))
      this.endFocus();
  }
  beginFocus() {
    this.stopAll(0.12);
    this.focusMode = true;
    this.focusPaused = false;
    this.nextFocus = 0;
  }
  pauseFocus(paused) {
    this.focusPaused = paused;
    if (paused) this.stopCue("focus");
    else this.nextFocus = 0;
  }
  endFocus() {
    this.focusMode = false;
    this.focusPaused = false;
    this.stopCue("focus");
  }
  focusTone(freq, end, duration, volume) {
    if (
      !this.focusMode ||
      this.focusPaused ||
      !this.enabled ||
      document.hidden ||
      this.ctx?.state !== "running"
    )
      return;
    const a = this.ctx,
      t = a.currentTime,
      source = a.createOscillator(),
      gain = a.createGain();
    source.frequency.setValueAtTime(freq, t);
    source.frequency.exponentialRampToValueAtTime(end, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(gain);
    gain.connect(this.buses.sfx);
    const h = { source, gain, cue: "focus" };
    this.sources.add(h);
    source.onended = () => {
      this.sources.delete(h);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    source.stop(t + duration);
  }
  inscribe(progress) {
    this.focusTone(220 + progress * 220, 330 + progress * 330, 0.11, 0.024);
  }
  allowed() {
    return (
      this.enabled &&
      !document.hidden &&
      this.ctx?.state === "running" &&
      (this.state?.phase === 1 || this.state?.phase === 2)
    );
  }
  source(buffer, bus, volume, pan = 0) {
    const a = this.ctx,
      source = a.createBufferSource(),
      gain = a.createGain(),
      p = a.createStereoPanner();
    source.buffer = buffer;
    gain.gain.value = volume;
    p.pan.value = pan;
    source.connect(gain);
    gain.connect(p);
    p.connect(this.buses[bus]);
    const handle = { source, gain };
    this.sources.add(handle);
    source.onended = () => {
      this.sources.delete(handle);
      source.disconnect();
      gain.disconnect();
      p.disconnect();
    };
    source.start();
    return handle;
  }
  async sample(cue, { bus = "sfx", volume = 1, pan = 0, maxAge = 0.16 } = {}) {
    if (!this.allowed() || !counts[cue]) return;
    const variant = ((this.variants.get(cue) ?? 0) % counts[cue]) + 1;
    this.variants.set(cue, variant);
    const epoch = this.epoch,
      at = this.now();
    try {
      const buffer = await this.buffer(this.path(cue, variant));
      if (epoch !== this.epoch || !this.allowed() || this.now() - at > maxAge)
        return;
      this.source(buffer, bus, volume, pan).cue = cue;
      this.fxHistory.push({ cue, at });
      if (this.fxHistory.length > 160) this.fxHistory.shift();
    } catch (e) {
      this.error(e);
    }
  }
  tone(freq, duration, volume, bus = "music") {
    if (!this.allowed()) return;
    const a = this.ctx,
      t = a.currentTime;
    for (const [r, v] of [
      [1, 1],
      [1.498, 0.18],
      [2.003, 0.1],
    ]) {
      const o = a.createOscillator(),
        g = a.createGain();
      o.frequency.value = freq * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(volume * v, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      o.connect(g);
      g.connect(this.buses[bus]);
      const h = { source: o, gain: g };
      this.sources.add(h);
      o.onended = () => {
        this.sources.delete(h);
        o.disconnect();
        g.disconnect();
      };
      o.start();
      o.stop(t + duration);
    }
  }
  stopCue(...cues) {
    for (const h of this.sources)
      if (cues.includes(h.cue)) {
        try {
          h.source.stop();
        } catch {
          /* The source already ended. */
        }
        this.sources.delete(h);
      }
  }
  sound(name, x = 480) {
    const pan = Math.max(-0.65, Math.min(0.65, (x - 480) / 550));
    const choose = {
      light1: "blade",
      light2: "blade",
      finisher: "blade",
      aircut: "blade",
      launcher: "blade",
      heavy: "heavycut",
      bowdraw: "bowdraw",
      bowshot: "bowshot",
      bowready: "bowready",
      arrowhit: "arrowhit",
      markbreak: "markbreak",
      healstart: "healstart",
      healcomplete: "healcomplete",
      chainstart: "tension",
      swordcut: "chaincut",
      chainfinish: "chainfinish",
      hook: "hook",
      hookattach: "attach",
      hooktension: "tension",
      sling: "sling",
      hookcut: "blade",
      dash: "dash",
      plunge: "cloth",
      plungehit: "heavy",
      land: "land",
      hardland: "land",
      jump: "cloth",
      chaincut: "brass",
      wordok: "brass",
      wordmiss: "cloth",
      chainfree: "cloth",
      bind: "heavy",
      bindrelease: "cloth",
      charge: "tension",
      parry: "brass",
      collision: "heavy",
      nova: "nova",
      armor: "brass",
      sealed: "brass",
      seal: "brass",
      hurt: "cloth",
    };
    if (choose[name])
      this.sample(choose[name], { pan, volume: name === "armor" ? 0.5 : 0.8 });
    if (
      ["light1", "light2", "finisher", "heavy", "aircut", "launcher"].includes(
        name,
      )
    )
      this.sample("cloth", { pan, volume: 0.25 });
    if (["checkpoint", "echo", "core", "finish"].includes(name))
      this.tone(name === "finish" ? 220 : 146.8, 2.8, 0.045, "music");
    if (name === "chainstart" && this.buses) {
      const t = this.ctx.currentTime;
      this.buses.music.gain.setTargetAtTime(0.02, t, 0.01);
      this.buses.music.gain.setTargetAtTime(this.settings.music, t + 1.1, 0.2);
    }
  }
  onEvent(name, x = 480) {
    if (["start", "practice", "retry", "fail"].includes(name)) this.stopAll();
    if (["healbreak", "healcomplete", "hurt"].includes(name))
      this.stopCue("healstart");
    if (
      [
        "bowshot",
        "heavy",
        "dash",
        "jump",
        "hook",
        "hurt",
        "chainstart",
      ].includes(name)
    )
      this.stopCue("bowdraw", "tension");
    this.sound(name, x);
  }
  enemy(name, id, kind) {
    const f = window.foes?.[id],
      s = this.state;
    if (f && s && Math.hypot(f.x - s.x, f.y - s.y) > 600) return;
    const pan = Math.max(
      -0.7,
      Math.min(0.7, ((f?.x ?? 480) - (s?.x ?? 480)) / 500),
    );
    if (name === "tell")
      this.sample(kind === 2 || kind === 4 ? "tension" : "cloth", {
        bus: "danger",
        pan,
        volume: 0.85,
      });
    const attacks = {
      knife: "blade",
      arrow: "sling",
      cut: "blade",
      elbow: "cloth",
      sweep: "cloth",
      chaincast: "hook",
      tether: "attach",
      chainbreak: "brass",
      grabattempt: "dash",
      grip: "cloth",
      release: "cloth",
      backstep: "cloth",
      shadowstep: "dash",
      aircross: "dash",
      wallkick: "cloth",
      flyingkick: "dash",
      chainsweep: "hook",
      parry: "brass",
      guardbreak: "heavy",
      land: "cloth",
    };
    if (attacks[name]) this.sample(attacks[name], { pan, volume: 0.7 });
    if (name === "impact") {
      this.sample(kind === 3 || kind === 4 ? "heavy" : "cloth", {
        pan,
        volume: 0.85,
      });
      if (s?.attackKind === 7) this.sample("heavy", { pan, volume: 0.8 });
    }
  }
  tick() {
    const s = this.state,
      active = s?.phase === 1 && !document.hidden,
      focused = this.focusMode && !this.focusPaused && !document.hidden,
      now = this.now();
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.enabled && (active || focused || s?.phase === 2) ? 0.65 : 0,
        this.ctx.currentTime,
        0.04,
      );
    if ((!active && !focused && s?.phase !== 2) || document.hidden) {
      if (this.sources.size) this.stopAll();
      return;
    }
    if (focused && now > this.nextFocus) {
      this.focusTone(110, 82.4, 1.6, 0.018);
      this.nextFocus = now + 1.3;
    }
    if (active && this.allowed() && now > this.nextNote) {
      this.tone(s.segment === 1 ? 55 : 73.4, 5, 0.022);
      this.nextNote = now + 5.5;
    }
  }
  diagnostics() {
    return {
      enabled: this.enabled,
      context: this.ctx?.state ?? "uninitialized",
      settings: { ...this.settings },
      errors: [...this.errors],
      cached: this.cache.size,
      activeSources: this.sources.size,
      fx: [...this.fxHistory],
      dialogueEnabled: false,
      focusActive: !!this.focusMode && !this.focusPaused,
    };
  }
}
