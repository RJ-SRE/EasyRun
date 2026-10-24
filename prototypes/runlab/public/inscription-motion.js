// Presentation only: the protected simulation never advances while answering.
// One bounded canvas, no per-frame DOM construction and no gameplay hitboxes.
const TAU = Math.PI * 2;
const ease = (v) => 1 - (1 - Math.min(1, v)) ** 3;
export class InscriptionMotion {
  constructor() {
    this.viewport = document.querySelector("#viewport");
    this.stage = document.querySelector("#stage");
    this.canvas = document.createElement("canvas");
    this.canvas.id = "word-current";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.width = 1440;
    this.canvas.height = 900;
    this.canvas.hidden = true;
    this.viewport.append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.reset();
  }
  reset() {
    this.mode = "idle";
    this.age = 0;
    this.time = 0;
    this.progress = 0;
    this.frames = 0;
    this.motes = [];
    this.zoom = 1;
    this.canvas.hidden = true;
    this.stage.style.transform = "";
    this.stage.style.transformOrigin = "";
  }
  begin(kind, state) {
    this.reset();
    this.mode = "focus";
    this.kind = kind;
    this.attempt = state?.attempts;
    this.canvas.hidden = false;
    this.point = this.project(state);
  }
  project(s) {
    return { x: s?.x ?? 480, y: 300 - ((s?.y ?? 0) + 30 - (s?.cameraY ?? 0)) };
  }
  inscribe(progress, letter) {
    if (progress <= this.progress) return;
    this.progress = progress;
    this.motes.push({ at: this.time, letter });
    if (this.motes.length > 8) this.motes.shift();
  }
  release(correct) {
    this.mode = "release";
    this.correct = correct;
    this.age = 0;
    this.releaseZoom = this.zoom;
    this.motes = [];
  }
  tick(dt, state, paused, reduced) {
    if (this.mode === "idle") return;
    if (state?.attempts !== this.attempt || ![1, 5].includes(state?.phase)) {
      this.reset();
      return;
    }
    if (paused || document.hidden) return;
    dt = Math.min(dt, 0.05); // Never catch up after backgrounding.
    this.age += dt;
    this.time += dt;
    this.frames++;
    const p = this.project(state);
    this.point.x += (p.x - this.point.x) * ease(dt * 12);
    this.point.y += (p.y - this.point.y) * ease(dt * 12);
    const releasing = this.mode === "release";
    if (releasing && this.age > 0.46) {
      this.reset();
      return;
    }
    this.zoom = reduced
      ? 1
      : releasing
        ? 1 + (this.releaseZoom - 1) * (1 - ease(this.age / 0.38))
        : 1 + 0.025 * ease(this.age / 0.32);
    const { x, y } = this.point;
    this.stage.style.transformOrigin = `${x / 9.6}% ${y / 6}%`;
    this.stage.style.transform = `scale(${this.zoom.toFixed(5)})`;
    const c = this.ctx;
    c.setTransform(1.5, 0, 0, 1.5, 0, 0);
    c.clearRect(0, 0, 960, 600);
    if (reduced) return; // Also honors the user's live reduced-effects switch.
    c.save();
    c.translate(x, y);
    c.scale(this.zoom, this.zoom);
    const entry = ease(this.age / 0.26);
    c.globalAlpha = releasing ? 1 - ease(this.age / 0.46) : entry;
    c.lineCap = "round";
    c.lineWidth = 0.8;
    c.strokeStyle = "#d5c79e";
    if (releasing) {
      const r = 35 + ease(this.age / 0.4) * (this.correct ? 110 : 30);
      c.beginPath();
      c.ellipse(0, 0, r, r * 0.6, -0.3, 0.1, 5.4);
      c.stroke();
      if (this.correct) this.releaseStrokes(c, state);
    } else {
      const glow = c.createRadialGradient(0, 0, 8, 0, 0, 100);
      glow.addColorStop(0, "#c7b68114");
      glow.addColorStop(1, "#c7b68100");
      c.fillStyle = glow;
      c.fillRect(-100, -100, 200, 200);
      // Three incomplete, counter-rotating clockwork arcs, local to the hero.
      for (let i = 0; i < 3; i++) {
        const rotation = this.time * (i % 2 ? -0.2 : 0.28) + i * 2.1;
        const radius = 42 + i * 11 + (1 - entry) * 20;
        c.globalAlpha = entry * (0.28 + this.progress * 0.35);
        c.beginPath();
        c.ellipse(0, 2, radius, radius * 0.7, -0.3, rotation, rotation + 1.5);
        c.stroke();
      }
      c.globalAlpha = entry * 0.75;
      c.strokeStyle = "#f1d397";
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(0, 0, 37, -Math.PI / 2, -Math.PI / 2 + TAU * this.progress);
      c.stroke();
      // Fixed-count dust approaches the drawn weapon; never a full-screen flash.
      for (let i = 0; i < 22; i++) {
        const t = (this.time * 0.18 + i / 22) % 1;
        const angle = i * 2.4 + t * 0.45;
        const r = 95 - t * 68;
        c.globalAlpha = Math.sin(t * Math.PI) * entry * 0.55;
        c.fillStyle = i % 3 ? "#c9bc8a" : "#a4ddd8";
        c.fillRect(Math.cos(angle) * r, Math.sin(angle) * r * 0.8, 1.6, 1.6);
      }
      // Letter fragments fly from the small inscription card into the weapon.
      for (const m of this.motes) {
        const t = (this.time - m.at) / 0.26;
        if (t < 0 || t >= 1) continue;
        const e = ease(t),
          startX = 480 - x,
          startY = 135 - y;
        c.globalAlpha = Math.sin(t * Math.PI) * 0.85;
        c.fillStyle = "#e3d4ad";
        c.font = "12px Georgia";
        c.fillText(
          m.letter,
          startX * (1 - e) + Math.sin(t * Math.PI) * 18,
          startY * (1 - e),
        );
      }
    }
    c.restore();
  }
  releaseStrokes(c, s) {
    const t = ease(this.age / 0.32);
    c.lineWidth = 1.4 * (1 - t) + 0.5;
    c.strokeStyle = this.kind === 3 ? "#b7d9c9" : "#e6d7b0";
    if (this.kind === 1) {
      const dx = (s?.aimX ?? 650) - this.point.x;
      const dy = 300 - ((s?.aimY ?? 0) - (s?.cameraY ?? 0)) - this.point.y;
      const angle = Math.atan2(dy, dx);
      c.rotate(angle);
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(t * 80, i * 6);
        c.lineTo(90 + t * 160, i * (6 + t * 14));
        c.stroke();
      }
    } else {
      const count = this.kind === 4 ? 4 : this.kind >= 5 ? 6 : 2;
      for (let i = 0; i < count; i++) {
        c.save();
        c.rotate((i * TAU) / count + (this.kind === 2 ? -0.7 : 0));
        c.beginPath();
        if (this.kind === 3)
          c.ellipse(0, 0, 35 + t * 75, 16 + t * 28, 0, -2.7, 0.3);
        else {
          c.moveTo(-35 + t * 65, -12);
          c.quadraticCurveTo(35 + t * 65, -55, 95 + t * 65, 20);
        }
        c.stroke();
        c.restore();
      }
    }
  }
  diagnostics() {
    return {
      mode: this.mode,
      age: this.age,
      progress: this.progress,
      frames: this.frames,
      zoom: this.zoom,
      motes: this.motes.length,
    };
  }
}
