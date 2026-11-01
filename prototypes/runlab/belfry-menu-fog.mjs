/* global Image, document */
// Bake a registered, low-resolution cloud patch. Two fixed sprites crossfade
// consecutive frames; no runtime noise, particles or fullscreen pixel effects.
export async function bakeMenuFog({ scene }) {
  const image = new Image();
  image.src = "data:image/png;base64," + scene;
  await image.decode();
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sc = source.getContext("2d", { willReadFrequently: true });
  sc.drawImage(image, 0, 0);
  const pixels = sc.getImageData(0, 0, image.width, image.height).data;
  const rect = [330, 530, 1120, 230],
    pixelScale = 2,
    count = 16;
  const [left, top, areaWidth, areaHeight] = rect;
  const width = areaWidth / pixelScale,
    height = areaHeight / pixelScale;
  const patch = document.createElement("canvas");
  patch.width = width;
  patch.height = height;
  const c = patch.getContext("2d");
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const rgb = (x, y, k) =>
    pixels[(Math.round(y) * image.width + Math.round(x)) * 4 + k];
  const lum = (x, y) =>
    rgb(x, y, 0) * 0.2126 + rgb(x, y, 1) * 0.7152 + rgb(x, y, 2) * 0.0722;
  const ellipse = (x, y, cx, cy, rx, ry) =>
    1 - smooth(0.2, 1, Math.hypot((x - cx) / rx, (y - cy) / ry));
  const protectedPixel = (x, y) => (x < 545 && y > 624) || (x < 655 && y > 706);
  const masks = new Float32Array(width * height);
  let activePixels = 0,
    protectedDifferences = 0;
  for (let yy = 0; yy < height; yy++)
    for (let xx = 0; xx < width; xx++) {
      const x = left + xx * pixelScale,
        y = top + yy * pixelScale;
      if (protectedPixel(x, y)) continue;
      const cloud = Math.max(
        ellipse(x, y, 478, 603, 155, 65),
        ellipse(x, y, 760, 677, 260, 67),
        ellipse(x, y, 1120, 697, 300, 66) * 0.75,
        ellipse(x, y, 1020, 745, 420, 21) * 0.55,
      );
      // Conservative silhouette guard. Only soft, bright cloud regions move;
      // sample a wider neighborhood than the maximum displacement (8 pixels).
      const localMin = Math.min(
        lum(x, y),
        lum(x - 9, y),
        lum(x + 9, y),
        lum(x, y - 9),
        lum(x, y + 9),
      );
      const edge =
        Math.abs(lum(x + 3, y) - lum(x - 3, y)) +
        Math.abs(lum(x, y + 3) - lum(x, y - 3));
      const feather = smooth(
        0,
        16,
        Math.min(xx, yy, width - 1 - xx, height - 1 - yy),
      );
      const mask =
        cloud *
        smooth(45, 110, localMin) *
        (1 - smooth(40, 95, edge)) *
        feather;
      masks[yy * width + xx] = mask;
      if (mask > 0.01) activePixels++;
    }
  // Feather the cloud mask at build time: high-frequency source detail must
  // not become flickering speckles. Reapply the hero/foreground exclusion.
  const softened = new Float32Array(masks.length);
  for (let yy = 0; yy < height; yy++)
    for (let xx = 0; xx < width; xx++) {
      let total = 0,
        weight = 0;
      for (let oy = -2; oy <= 2; oy++)
        for (let ox = -2; ox <= 2; ox++) {
          const x = xx + ox,
            y = yy + oy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const w = (3 - Math.abs(ox)) * (3 - Math.abs(oy));
          total += masks[y * width + x] * w;
          weight += w;
        }
      const x = left + xx * pixelScale,
        y = top + yy * pixelScale;
      softened[yy * width + xx] = protectedPixel(x, y)
        ? 0
        : (total / weight) * smooth(30, 65, lum(x, y));
    }
  masks.set(softened);
  activePixels = masks.filter((value) => value > 0.01).length;
  const sample = (x, y, k) => {
    const ax = Math.floor(x),
      ay = Math.floor(y),
      fx = x - ax,
      fy = y - ay;
    return (
      rgb(ax, ay, k) * (1 - fx) * (1 - fy) +
      rgb(ax + 1, ay, k) * fx * (1 - fy) +
      rgb(ax, ay + 1, k) * (1 - fx) * fy +
      rgb(ax + 1, ay + 1, k) * fx * fy
    );
  };
  const frames = [],
    previews = [];
  for (let f = 0; f < count; f++) {
    const phase = (f / count) * Math.PI * 2,
      data = c.createImageData(width, height);
    for (let yy = 0; yy < height; yy++)
      for (let xx = 0; xx < width; xx++) {
        const mask = masks[yy * width + xx];
        if (mask <= 0) continue;
        const x = left + xx * pixelScale,
          y = top + yy * pixelScale,
          p = (yy * width + xx) * 4;
        const dx =
          6 *
          (Math.sin(phase + y * 0.025) +
            0.25 * Math.sin(2 * phase + x * 0.015));
        const dy = 2.1 * Math.sin(phase * 2 + x * 0.013);
        const billow =
          0.5 + 0.5 * Math.sin(phase + x * 0.018 + Math.sin(y * 0.06 + phase));
        const opacity = mask * (0.4 + 0.26 * billow);
        for (let k = 0; k < 3; k++) {
          const value = sample(x - dx, y - dy, k);
          // A small cold haze component makes cloud volume breathe, not flash.
          data.data[p + k] = Math.min(
            255,
            value * 0.91 + [166, 181, 191][k] * 0.09 + billow * 4,
          );
        }
        data.data[p + 3] = Math.round(opacity * 255);
        if (protectedPixel(x, y) && data.data[p + 3]) protectedDifferences++;
      }
    c.putImageData(data, 0, 0);
    frames.push(patch.toDataURL("image/png").split(",")[1]);
    if (f === 0 || f === 8) {
      const preview = document.createElement("canvas");
      preview.width = image.width;
      preview.height = image.height;
      const pc = preview.getContext("2d");
      pc.drawImage(image, 0, 0);
      pc.drawImage(patch, left, top, areaWidth, areaHeight);
      previews.push(preview.toDataURL("image/png").split(",")[1]);
    }
  }
  if (protectedDifferences || activePixels < 1000)
    throw new Error("Fog registration/mask invalid");
  return {
    rect,
    pixelScale,
    frames,
    previews,
    activePixels,
    protectedDifferences,
    seconds: 12,
  };
}
