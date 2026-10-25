export const MUSIC_TRACKS = {
  menu: { title: "Melancholy Of The Boot", file: "/audio/music/menu.mp3" },
  gameplay: {
    title: "Cleaning out the Rooms (Wandering Horn)",
    file: "/audio/music/gameplay.mp3",
  },
  ending: { title: "Strange Sports", file: "/audio/music/ending.mp3" },
};

// A single streaming element keeps long songs out of the short-SFX decode cache.
// Scene changes fade out before replacing the source; pause never seeks to zero.
export class BelfryMusic {
  constructor(context, bus, onError) {
    this.context = context;
    this.onError = onError;
    this.audio = document.createElement("audio");
    this.audio.id = "scene-music";
    this.audio.hidden = true;
    this.audio.preload = "metadata";
    this.audio.loop = true;
    document.body.append(this.audio);
    this.source = context.createMediaElementSource(this.audio);
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.source.connect(this.gain);
    this.gain.connect(bus);
    this.stage = null;
    this.target = null;
    this.unlocked = false;
    this.blocked = false;
    this.generation = 0;
    this.switchTimer = null;
    this.playPending = null;
    this.paused = true;
    this.audio.addEventListener("error", () => {
      this.failedStage = this.stage;
      this.onError(
        `Music ${this.stage}: media error ${this.audio.error?.code}`,
      );
    });
  }
  unlock() {
    this.unlocked = true;
    this.blocked = false;
    if (this.failedStage === this.stage && this.stage) this.audio.load();
    this.failedStage = null;
    this.apply();
  }
  sync(state, { enabled, hidden, focusPaused }) {
    const phase = state?.phase;
    const stage =
      phase === 0
        ? "menu"
        : [1, 5].includes(phase)
          ? "gameplay"
          : [2, 3].includes(phase)
            ? "ending"
            : this.target;
    this.paused =
      !enabled ||
      hidden ||
      phase == null ||
      phase === 4 ||
      (phase === 5 && focusPaused);
    if (stage && stage !== this.target) this.select(stage);
    this.apply();
  }
  select(stage) {
    this.target = stage;
    clearTimeout(this.switchTimer);
    this.switchTimer = null;
    this.generation++;
    if (stage === this.stage) return;
    const generation = this.generation;
    const commit = () => {
      if (generation !== this.generation) return;
      this.switchTimer = null;
      this.audio.pause();
      this.stage = stage;
      this.failedStage = null;
      this.blocked = false;
      this.playPending = null;
      this.audio.src = MUSIC_TRACKS[stage].file;
      this.audio.load();
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setValueAtTime(0, this.context.currentTime);
      this.apply();
    };
    if (this.stage && !this.audio.paused && !this.paused) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.055);
      this.switchTimer = setTimeout(commit, 180);
    } else commit();
  }
  apply() {
    if (this.paused || !this.unlocked) {
      this.audio.pause();
      return;
    }
    if (this.switchTimer || !this.stage || this.failedStage === this.stage)
      return;
    this.gain.gain.setTargetAtTime(1, this.context.currentTime, 0.12);
    if (!this.audio.paused || this.playPending || this.blocked) return;
    const generation = this.generation;
    const pending = this.audio.play();
    this.playPending = pending;
    pending
      .catch((error) => {
        if (generation !== this.generation || error.name === "AbortError")
          return;
        if (error.name === "NotAllowedError") this.blocked = true;
        else {
          this.failedStage = this.stage;
          this.onError(`Music ${this.stage}: ${error.message}`);
        }
      })
      .finally(() => {
        if (this.playPending === pending) this.playPending = null;
      });
  }
  diagnostics() {
    return {
      stage: this.stage,
      target: this.target,
      title: MUSIC_TRACKS[this.stage]?.title ?? null,
      artist: "Sea Power",
      unlocked: this.unlocked,
      blocked: this.blocked,
      failed: this.failedStage === this.stage && !!this.stage,
      paused: this.audio.paused,
      loop: this.audio.loop,
      time: this.audio.currentTime,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      readyState: this.audio.readyState,
      gain: this.gain.gain.value,
      activePlayers: this.audio.paused ? 0 : 1,
    };
  }
}
