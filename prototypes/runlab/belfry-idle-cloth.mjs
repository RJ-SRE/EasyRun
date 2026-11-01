/* global Image, document */
// Bake a small, anchored cloth-animation atlas from the existing registered
// sprite. The runtime only selects a frame: no cloth physics or new clones.
export async function buildIdleCloth(page, uri) {
  return page.evaluate(async (uri) => {
    const source = new Image();
    source.src = uri;
    await source.decode();
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const out = document.createElement("canvas");
    out.width = 240;
    out.height = 418;
    const paint = out.getContext("2d");
    const smooth = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const frames = [];
    let changedPixels = 0,
      anchoredDifferences = 0;
    for (let frame = 0; frame < 24; frame++) {
      const phase = (frame / 24) * Math.PI * 2;
      const scarfWave = Math.sin(phase) + 0.24 * Math.sin(phase * 2);
      const hemWave = Math.sin(phase - 0.55) + Math.sin(0.55);
      const data = paint.createImageData(out.width, out.height);
      for (let y = 0; y < out.height; y++) {
        for (let x = 0; x < out.width; x++) {
          const sx = x + 56;
          // Shoulder attachment, hood, torso, hands and soles are pinned.
          const scarf =
            smooth(176, 92, sx) *
            smooth(72, 94, y) *
            (1 - smooth(152, 175, y)) *
            (1 - smooth(140, 168, y) * smooth(138, 159, sx));
          const edge = 208 - Math.max(0, y - 220) * 0.25;
          const hem =
            smooth(edge, edge - 56, sx) *
            smooth(222, 280, y) *
            (1 - smooth(350, 380, y)) *
            smooth(85, 108, sx);
          const dx = -14 * scarfWave * scarf - 8 * hemWave * hem;
          const dy = 5 * Math.sin(phase) * scarf + 2 * hemWave * hem;
          // Frame zero is the exact registered rest pose, for clean entry.
          const ix = frame === 0 ? sx : sx - dx;
          const iy = frame === 0 ? y : y - dy;
          const x0 = Math.floor(ix),
            y0 = Math.floor(iy);
          const fx = ix - x0,
            fy = iy - y0;
          let alpha = 0,
            r = 0,
            g = 0,
            b = 0;
          for (let yy = 0; yy < 2; yy++)
            for (let xx = 0; xx < 2; xx++) {
              const px = x0 + xx,
                py = y0 + yy;
              if (px < 0 || px >= source.width || py < 0 || py >= source.height)
                continue;
              const pos = (py * source.width + px) * 4;
              const weight = (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy);
              const a = pixels[pos + 3] * weight;
              alpha += a;
              r += pixels[pos] * a;
              g += pixels[pos + 1] * a;
              b += pixels[pos + 2] * a;
            }
          const p = (y * out.width + x) * 4;
          if (alpha > 0) {
            data.data[p] = r / alpha;
            data.data[p + 1] = g / alpha;
            data.data[p + 2] = b / alpha;
            data.data[p + 3] = alpha;
          }
          const original = (y * source.width + sx) * 4;
          const differs =
            data.data[p + 3] !== pixels[original + 3] ||
            (pixels[original + 3] > 0 &&
              [0, 1, 2].some((c) => data.data[p + c] !== pixels[original + c]));
          if (differs) {
            changedPixels++;
            if ((sx >= 185 && y < 90) || y >= 380) anchoredDifferences++;
          }
        }
      }
      paint.putImageData(data, 0, 0);
      frames.push(out.toDataURL("image/png").split(",")[1]);
    }
    return {
      frames,
      width: out.width,
      height: out.height,
      pivotX: 160,
      pivotY: 400,
      changedPixels,
      anchoredDifferences,
    };
  }, uri);
}
