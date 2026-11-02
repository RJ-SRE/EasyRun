/* global Image, document */
// Build-time cloud lightning. One noninteractive sprite, nine small textures;
// no runtime path generation, particles, glow filters or new audio sources.
export async function bakeMenuLightning({ scene }) {
  const image = new Image();
  image.src = "data:image/png;base64," + scene;
  await image.decode();
  const rect = [900, 110, 420, 340],
    [left, top, width, height] = rect;
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
  const reference = make(),
    rc = reference.getContext("2d");
  rc.drawImage(image, -left, -top);
  const pixels = rc.getImageData(0, 0, width, height).data;
  const mask = make(),
    mc = mask.getContext("2d"),
    maskPixels = mc.createImageData(width, height);
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // Bright distant cloud pixels receive light; dark architectural silhouettes
  // occlude it. Feather tile edges so no rectangular patch can be visible.
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const luminance =
        pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722;
      maskPixels.data[p + 3] = Math.round(
        255 *
          smooth(67, 137, luminance) *
          smooth(0, 18, Math.min(x, y, width - 1 - x, height - 1 - y)),
      );
    }
  mc.putImageData(maskPixels, 0, 0);
  const paths = [
    [
      [1094, 136],
      [1086, 158],
      [1058, 181],
      [1070, 196],
      [1037, 218],
      [1050, 236],
      [1015, 263],
      [1024, 277],
      [992, 307],
      [1002, 326],
      [965, 351],
      [977, 373],
      [940, 407],
    ],
    [
      [1245, 136],
      [1225, 167],
      [1232, 184],
      [1205, 201],
      [1215, 222],
      [1178, 253],
      [1191, 269],
      [1156, 293],
      [1169, 318],
      [1130, 350],
      [1140, 367],
      [1100, 409],
    ],
    [
      [971, 167],
      [996, 188],
      [985, 212],
      [1022, 239],
      [1010, 258],
      [1040, 279],
      [1029, 298],
      [1060, 320],
      [1041, 343],
      [1065, 361],
      [1038, 401],
    ],
  ];
  const frames = [],
    previews = [];
  // Break long polygon edges into fine, deterministic forks rather than a
  // regular zigzag. The exact same path is used by all three exposure phases.
  const fracture = (points, seed, amplitude) => {
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296 - 0.5;
    };
    const output = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1],
        [bx, by] = points[i];
      const length = Math.hypot(bx - ax, by - ay);
      for (const t of [0.25, 0.5, 0.75]) {
        const d = random() * amplitude;
        output.push([
          ax + (bx - ax) * t - ((by - ay) / length) * d,
          ay + (by - ay) * t + ((bx - ax) / length) * d,
        ]);
      }
      output.push(points[i]);
    }
    return output;
  };
  for (const [variant, control] of paths.entries()) {
    const path = fracture(control, 117 + variant * 93, 5);
    const branches = [
      [
        control[3],
        [control[3][0] + 40, control[3][1] + 7],
        [control[3][0] + 30, control[3][1] + 26],
        [control[3][0] + 63, control[3][1] + 44],
      ],
      [
        control[6],
        [control[6][0] - 25, control[6][1] - 3],
        [control[6][0] - 44, control[6][1] + 15],
        [control[6][0] - 65, control[6][1] + 19],
      ],
      [
        control[8],
        [control[8][0] + 32, control[8][1] + 16],
        [control[8][0] + 27, control[8][1] + 35],
      ],
    ].map((b, i) => fracture(b, 919 + variant * 51 + i * 37, 3));
    for (let phase = 0; phase < 3; phase++) {
      const canvas = make(),
        c = canvas.getContext("2d");
      c.lineCap = "round";
      c.lineJoin = "miter";
      const line = (points, color, thickness, blur = 0) => {
        c.strokeStyle = color;
        c.lineWidth = thickness;
        c.shadowColor = color;
        c.shadowBlur = blur;
        c.beginPath();
        points.forEach(([x, y], i) =>
          i ? c.lineTo(x - left, y - top) : c.moveTo(x - left, y - top),
        );
        c.stroke();
        c.shadowBlur = 0;
      };
      const [gx, gy] = control[5];
      const glow = c.createRadialGradient(
        gx - left,
        gy - top,
        2,
        gx - left,
        gy - top,
        145,
      );
      glow.addColorStop(
        0,
        phase === 0 ? "#0a0a1c70" : phase === 1 ? "#edbd565c" : "#be852633",
      );
      glow.addColorStop(0.45, phase === 0 ? "#05081828" : "#a96a191a");
      glow.addColorStop(1, "#0000");
      c.fillStyle = glow;
      c.fillRect(0, 0, width, height);
      if (phase === 0) {
        line(path, "#04071160", 10, 10);
        line(path, "#030612c9", 2.8);
        branches.forEach((b) => line(b, "#0509188c", 1.4));
      } else if (phase === 1) {
        line(path, "#a56622a0", 10, 16);
        line(path, "#e4b955", 4.6, 7);
        line(path, "#fff0ad", 2.1);
        // The cold, broken inner filament is the 'black lightning' silhouette.
        line(path, "#13101c", 0.95);
        branches.forEach((b, i) => {
          line(b, "#dba545bb", 2.3 - i * 0.3, 5);
          line(b, "#ffe5a5db", 0.7);
        });
      } else {
        line(path, "#b9812840", 4.5, 8);
        for (let i = 1; i < path.length - 1; i += 3)
          line(path.slice(i, i + 2), "#e2b860b0", 1.1, 4);
        branches.forEach((b) => line(b.slice(0, 2), "#c8943b60", 0.8));
      }
      c.globalCompositeOperation = "destination-in";
      c.drawImage(mask, 0, 0);
      frames.push(canvas.toDataURL("image/png").split(",")[1]);
      if (phase === 1) {
        const preview = document.createElement("canvas");
        preview.width = image.width;
        preview.height = image.height;
        const pc = preview.getContext("2d");
        pc.drawImage(image, 0, 0);
        pc.drawImage(canvas, left, top);
        previews.push(preview.toDataURL("image/png").split(",")[1]);
      }
    }
  }
  return { rect, frames, previews, variants: paths.length };
}
