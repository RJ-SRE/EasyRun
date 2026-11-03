/* global document, Image */
import { URL } from "node:url";
// Foot anchors register silhouettes independently of changing weapon bounds.
import { readFile } from "node:fs/promises";
// Extra horizontal padding preserves the long chain blade and trailing cloth.
// Keep the pixel scale and foot registration identical across every pose.
export const keeperFrameLayout = { w: 768, h: 512, pivotX: 384, pivotY: 490 };
const anchors = [
  [
    [157, 336],
    [177, 336],
    [155, 336],
    [150, 336],
    [193, 334],
    [187, 334],
    [175, 334],
    [193, 310],
    [155, 300],
    [170, 303],
    [171, 301],
    [159, 300],
  ],
  [
    [213, 336],
    [179, 336],
    [154, 336],
    [155, 336],
    [180, 334],
    [170, 334],
    [154, 334],
    [190, 317],
    [170, 303],
    [200, 303],
    [182, 303],
    [192, 303],
  ],
  [
    [200, 320],
    [190, 320],
    [161, 320],
    [185, 320],
    [188, 326],
    [202, 326],
    [176, 326],
    [182, 310],
    [175, 316],
    [188, 316],
    [192, 316],
    [180, 316],
  ],
];
export async function buildKeeperFrames(page, root) {
  const frames = [];
  for (let form = 0; form < 3; form++) {
    const bytes = await readFile(
      new URL(`art/belfry/keeper-v3/form-${form + 1}.png`, root),
    );
    frames.push(
      ...(await page.evaluate(
        async ({ uri, anchors, layout }) => {
          const im = new Image();
          im.src = uri;
          await im.decode();
          // Segment the whole sheet before extracting poses. Limbs and blades
          // cross cell boundaries: cropping first both amputates the current
          // pose and imports a floating fragment from its neighbour.
          const sheet = document.createElement("canvas");
          sheet.width = im.width;
          sheet.height = im.height;
          const context = sheet.getContext("2d");
          context.drawImage(im, 0, 0);
          const pixels = context.getImageData(0, 0, im.width, im.height).data;
          const width = im.width,
            height = im.height;
          const labels = new Int32Array(width * height),
            queue = new Int32Array(labels.length),
            parts = [];
          for (let start = 0; start < labels.length; start++) {
            if (labels[start] || pixels[start * 4 + 3] < 28) continue;
            const id = parts.length + 1;
            let read = 0,
              end = 1,
              l = width,
              r = 0,
              t = height,
              b = 0;
            queue[0] = start;
            labels[start] = id;
            while (read < end) {
              const at = queue[read++],
                x = at % width,
                y = Math.floor(at / width);
              l = Math.min(l, x);
              r = Math.max(r, x);
              t = Math.min(t, y);
              b = Math.max(b, y);
              for (
                let ny = Math.max(0, y - 1);
                ny <= Math.min(height - 1, y + 1);
                ny++
              )
                for (
                  let nx = Math.max(0, x - 1);
                  nx <= Math.min(width - 1, x + 1);
                  nx++
                ) {
                  const next = ny * width + nx;
                  if (!labels[next] && pixels[next * 4 + 3] >= 28) {
                    labels[next] = id;
                    queue[end++] = next;
                  }
                }
            }
            parts.push({ id, l, r, t, b, area: end });
          }
          const principal = [...parts]
            .sort((a, b) => b.area - a.area)
            .slice(0, 12);
          const owner = new Int32Array(parts.length + 1);
          for (const part of principal) owner[part.id] = part.id;
          // Retain small torn-cloth islands within three pixels of their own
          // body; discard isolated debris. No generated source file is edited.
          for (let at = 0; at < labels.length; at++) {
            const id = labels[at];
            if (!id || owner[id]) continue;
            const x = at % width,
              y = Math.floor(at / width);
            for (
              let ny = Math.max(0, y - 3);
              ny <= Math.min(height - 1, y + 3) && !owner[id];
              ny++
            )
              for (
                let nx = Math.max(0, x - 3);
                nx <= Math.min(width - 1, x + 3);
                nx++
              ) {
                const near = labels[ny * width + nx];
                if (near && owner[near] === near) {
                  owner[id] = near;
                  break;
                }
              }
          }
          const used = new Set();
          return anchors.map(([ax, ay], k) => {
            const part = principal.find(
              (p) =>
                Math.floor((p.l + p.r) / 2 / (width / 4)) === k % 4 &&
                Math.floor((p.t + p.b) / 2 / (height / 3)) ===
                  Math.floor(k / 4),
            );
            if (!part || used.has(part.id))
              throw new Error("Keeper pose registration failed: " + k);
            used.add(part.id);
            const owned = parts.filter((p) => owner[p.id] === part.id);
            const l = Math.min(...owned.map((p) => p.l)),
              r = Math.max(...owned.map((p) => p.r));
            const t = Math.min(...owned.map((p) => p.t)),
              b = Math.max(...owned.map((p) => p.b));
            const cut = document.createElement("canvas");
            cut.width = r - l + 1;
            cut.height = b - t + 1;
            const ctx = cut.getContext("2d"),
              data = ctx.createImageData(cut.width, cut.height);
            for (let y = t; y <= b; y++)
              for (let x = l; x <= r; x++) {
                const at = y * width + x;
                if (owner[labels[at]] !== part.id) continue;
                for (let channel = 0; channel < 4; channel++)
                  data.data[((y - t) * cut.width + x - l) * 4 + channel] =
                    pixels[at * 4 + channel];
              }
            ctx.putImageData(data, 0, 0);
            const out = document.createElement("canvas");
            out.width = layout.w;
            out.height = layout.h;
            const sx = 384 / (width / 4),
              sy = 342 / (height / 3);
            const x = layout.pivotX - ax + (l - ((k % 4) * width) / 4) * sx,
              y =
                layout.pivotY -
                ay +
                (t - (Math.floor(k / 4) * height) / 3) * sy;
            if (
              x < 2 ||
              y < 2 ||
              x + cut.width * sx > layout.w - 2 ||
              y + cut.height * sy > layout.h - 2
            )
              throw new Error(
                `Keeper pose ${k} exceeds texture bounds: ${x},${y},${cut.width * sx},${cut.height * sy}`,
              );
            out
              .getContext("2d")
              .drawImage(cut, x, y, cut.width * sx, cut.height * sy);
            return out.toDataURL("image/png").split(",")[1];
          });
        },
        {
          uri: "data:image/png;base64," + bytes.toString("base64"),
          anchors: anchors[form],
          layout: keeperFrameLayout,
        },
      )),
    );
  }
  // Bake the other facing once. The runtime can then rotate a single opaque
  // body around its planted foot, rather than mirroring with an upside-down
  // heading or allocating overlapping silhouettes. Source art stays intact.
  const mirrored = await page.evaluate(
    async ({ frames, layout }) => {
      const canvas = document.createElement("canvas");
      canvas.width = layout.w;
      canvas.height = layout.h;
      const ctx = canvas.getContext("2d");
      const output = [];
      for (const frame of frames) {
        const im = new Image();
        im.src = "data:image/png;base64," + frame;
        await im.decode();
        ctx.clearRect(0, 0, layout.w, layout.h);
        ctx.save();
        ctx.translate(layout.pivotX * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(im, 0, 0);
        ctx.restore();
        output.push(canvas.toDataURL("image/png").split(",")[1]);
      }
      return output;
    },
    { frames, layout: keeperFrameLayout },
  );
  return frames.concat(mirrored);
}
