// Original project material samples + quiet, procedural air/string layers.
// No character voices. All asynchronous cues are bounded by the current run.
const counts = {
  hook: 4,
  attach: 4,
  tension: 4,
  sling: 4,
  cloth: 4,
  land: 3,
  brass: 5,
  dash: 4,
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function noiseBuffer(ctx, seconds, seed, impulse = false) {
  const b = ctx.createBuffer(
    2,
    Math.ceil(ctx.sampleRate * seconds),
    ctx.sampleRate,
  );
  for (let c = 0; c < 2; c++) {
    const data = b.getChannelData(c);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      smooth = smooth * 0.68 + (seed / 2147483648 - 1) * 0.32;
      const t = i / data.length;
      data[i] =
        smooth *
        (impulse
          ? Math.exp(-t * 6) * Math.min(1, i / 180)
          : Math.sin(Math.PI * t) ** 2);
    }
  }
  return b;
}
export function createPassageSpace(ctx, destination = ctx.destination) {
  const master = ctx.createGain(),
    limiter = ctx.createDynamicsCompressor(),
    wet = ctx.createGain(),
    wetInput = ctx.createGain();
  master.gain.value = 0.64;
  limiter.threshold.value = -9;
  limiter.knee.value = 10;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.16;
  master.connect(limiter);
  limiter.connect(destination);
  wet.gain.value = 0.18;
  wet.connect(master);
  const impulse = noiseBuffer(ctx, 1.35, 14721, true);
  let delay, reverb, filter;
  const reset = () => {
    wetInput.disconnect();
    delay?.disconnect();
    reverb?.disconnect();
    filter?.disconnect();
    delay = ctx.createDelay(0.15);
    delay.delayTime.value = 0.031;
    reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3100;
    wetInput.connect(delay);
    delay.connect(reverb);
    reverb.connect(filter);
    filter.connect(wet);
  };
  reset();
  return { master, wet, wetInput, reset, limiter };
}
export function materialVoice(ctx, space, buffer, options = {}) {
  const {
    at = ctx.currentTime,
    volume = 0.35,
    pan = 0,
    rate = 1,
    cutoff = 4200,
    send = 0.2,
    loop = false,
  } = options;
  const source = ctx.createBufferSource(),
    gain = ctx.createGain(),
    filter = ctx.createBiquadFilter(),
    position = ctx.createStereoPanner(),
    room = ctx.createGain();
  source.buffer = buffer;
  source.loop = loop;
  source.playbackRate.value = rate;
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  position.pan.value = clamp(pan, -0.72, 0.72);
  room.gain.value = send;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.008);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(position);
  position.connect(space.master);
  position.connect(room);
  room.connect(space.wetInput);
  const nodes = [source, filter, gain, position, room];
  const dispose = () => nodes.forEach((n) => n.disconnect());
  source.start(at);
  if (!loop) source.stop(at + buffer.duration / rate + 0.025);
  return {
    source,
    gain,
    position,
    dispose,
    stop: () => {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      dispose();
    },
  };
}
export class PassageAudio {
  constructor() {
    this.enabled = true;
    this.epoch = 0;
    this.state = null;
    this.cache = new Map();
    this.loading = new Map();
    this.voices = new Set();
    this.loops = new Map();
    this.variants = new Map();
    this.history = [];
    this.errors = [];
    this.dropped = 0;
  }
  async init() {
    if (!this.enabled || document.hidden) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.space = createPassageSpace(this.ctx);
        this.air = noiseBuffer(this.ctx, 4.3, 9183);
        this.friction = noiseBuffer(this.ctx, 1.3, 7231);
        this.ready = Promise.all(
          Object.entries(counts).flatMap(([cue, n]) =>
            Array.from({ length: n }, (_, i) =>
              this.buffer(cue, i + 1).catch((e) => {
                this.errors.push(String(e));
              }),
            ),
          ),
        );
      }
      await this.ctx.resume();
      this.update(this.state);
    } catch (e) {
      this.errors.push(String(e));
    }
  }
  buffer(cue, variant) {
    const path = `/audio/sfx/${cue}-${variant}.m4a`;
    if (this.cache.has(path)) return Promise.resolve(this.cache.get(path));
    if (this.loading.has(path)) return this.loading.get(path);
    const promise = (async () => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Material sound ${res.status}: ${path}`);
      const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.cache.set(path, buffer);
      return buffer;
    })().finally(() => this.loading.delete(path));
    this.loading.set(path, promise);
    return promise;
  }
  active() {
    return (
      this.enabled &&
      !document.hidden &&
      this.state?.phase === 1 &&
      this.ctx?.state === "running"
    );
  }
  stopAll() {
    this.epoch++;
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    for (const voice of this.loops.values()) voice.stop();
    this.loops.clear();
    this.space?.reset();
  }
  setEnabled(value) {
    this.enabled = value;
    this.stopAll();
    if (value) this.init();
    else this.ctx?.suspend();
  }
  hide() {
    this.stopAll();
    this.ctx?.suspend();
  }
  async sample(cue, options = {}) {
    if (!this.active()) return;
    const epoch = this.epoch,
      started = performance.now(),
      variant = ((this.variants.get(cue) || 0) % counts[cue]) + 1;
    this.variants.set(cue, variant);
    try {
      const buffer = await this.buffer(cue, variant);
      if (
        epoch !== this.epoch ||
        !this.active() ||
        performance.now() - started > 220
      ) {
        this.dropped++;
        return;
      }
      if (this.voices.size >= 12) {
        this.dropped++;
        return;
      }
      const voice = materialVoice(this.ctx, this.space, buffer, options);
      this.voices.add(voice);
      voice.source.onended = () => {
        voice.dispose();
        this.voices.delete(voice);
      };
      this.history.push({
        cue,
        variant,
        epoch,
        time: this.ctx.currentTime,
        pan: options.pan || 0,
      });
      if (this.history.length > 120) this.history.shift();
    } catch (e) {
      this.errors.push(String(e));
    }
  }
  loop(name, buffer, volume, cutoff, pan = 0, rate = 1) {
    let voice = this.loops.get(name);
    if (!voice) {
      voice = materialVoice(this.ctx, this.space, buffer, {
        loop: true,
        volume: 0,
        cutoff,
        send: 0.08,
        rate,
      });
      this.loops.set(name, voice);
    }
    const t = this.ctx.currentTime;
    voice.gain.gain.setTargetAtTime(volume, t, 0.065);
    voice.position.pan.setTargetAtTime(clamp(pan, -0.72, 0.72), t, 0.05);
  }
  update(state) {
    const prior = this.state;
    this.state = state;
    if (!state || !this.ctx) return;
    if (
      prior?.attempts !== state.attempts ||
      (prior?.phase === 1 && state.phase !== 1)
    )
      this.stopAll();
    const live = this.active();
    this.space.master.gain.setTargetAtTime(
      live ? 0.64 : 0,
      this.ctx.currentTime,
      0.025,
    );
    if (!live) return;
    const spacious = [0.15, 0.27, 0.22, 0.18, 0.24][state.checkpoint] || 0.18;
    this.space.wet.gain.setTargetAtTime(spacious, this.ctx.currentTime, 0.25);
    this.loop(
      "air",
      this.air,
      state.checkpoint === 4 ? 0.1 : 0.065,
      520,
      0,
      0.82,
    );
    const loaded = state.hook >= 0 && state.hookContact > 0;
    const strength = clamp(state.hookTension || 0, 0, 1);
    const pan = (state.hookX - state.cameraX) / 520;
    this.loop(
      "friction",
      this.friction,
      loaded ? 0.025 + strength * 0.06 : 0,
      1700,
      pan,
      0.8 + strength * 0.2,
    );
  }
  event(name, x, y) {
    if (name === "start" || name === "retry") {
      this.stopAll();
      return;
    }
    const s = this.state;
    if (!s) return;
    const pan = clamp((x - s.cameraX) / 520, -0.7, 0.7);
    const rules = {
      hook: ["hook", 0.36, 0.84, 3400, 0.1],
      hookattach: ["attach", 0.46, 0.78, 3800, 0.48],
      hooktension: ["tension", 0.22, 0.9, 1500, 0.22],
      hookrelease: ["cloth", 0.15, 0.85, 2300, 0.06],
      sling: ["sling", 0.37, 0.88, 3400, 0.18],
      jump: ["cloth", 0.13, 1, 2600, 0.08],
      dash: ["dash", 0.32, 0.9, 4000, 0.12],
      land: ["land", 0.26, 0.86, 2500, 0.22],
      fold: ["brass", 0.33, 0.66, 2700, 0.5],
      valve: ["brass", 0.26, 0.83, 3100, 0.4],
      shaftopen: ["brass", 0.35, 0.58, 2300, 0.5],
      weight: ["brass", 0.3, 0.6, 2300, 0.45],
      wind: ["sling", 0.2, 0.6, 1800, 0.45],
      checkpoint: ["brass", 0.2, 1.15, 3200, 0.5],
      relic: ["brass", 0.18, 1.6, 3800, 0.55],
      fail: ["land", 0.25, 0.6, 1800, 0.4],
    };
    const r = rules[name];
    if (!r) return;
    this.sample(r[0], {
      volume: r[1],
      rate: r[2],
      cutoff: r[3],
      send: r[4],
      pan,
    });
    if (name === "hookattach")
      this.sample("brass", {
        volume: 0.065,
        rate: 1.27,
        cutoff: 2500,
        send: 0.6,
        pan,
      });
    void y;
  }
  diagnostics() {
    return {
      enabled: this.enabled,
      context: this.ctx?.state || "uninitialized",
      sources: this.voices.size,
      loops: this.loops.size,
      cached: this.cache.size,
      epoch: this.epoch,
      dropped: this.dropped,
      history: [...this.history],
      errors: [...this.errors],
    };
  }
}
