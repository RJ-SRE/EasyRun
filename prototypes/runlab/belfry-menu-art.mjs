/* global URL, Image, document */
import { readFile, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { chromium } from "@playwright/test";
import { bakeMenuLightning } from "./belfry-menu-lightning.mjs";
import { bakeMenuFog } from "./belfry-menu-fog.mjs";

// Preserve the original scene. Cape/water warps and a local cloud-lightning
// overlay are baked at build time; the runtime only switches small textures.
export async function addMenuArt({ root, sprite }) {
  const uri = async (name) =>
    "data:image/png;base64," +
    (await readFile(new URL("art/belfry/menu/" + name, root))).toString(
      "base64",
    );
  const inputs = {
    original: await uri("static-original.png"),
    clean: await uri("static-clean-right.png"),
  };
  const browser = await chromium.launch({
    headless: true,
    channel: "chromium",
  });
  let result;
  try {
    const page = await browser.newPage();
    result = await page.evaluate(async ({ original, clean }) => {
      const load = async (uri) => {
        const im = new Image();
        im.src = uri;
        await im.decode();
        return im;
      };
      const source = await load(original),
        fill = await load(clean);
      const scene = document.createElement("canvas");
      scene.width = source.width;
      scene.height = source.height;
      const c = scene.getContext("2d", { willReadFrequently: true });
      c.drawImage(source, 0, 0);
      // Preserve the entire left 63% from the chosen source, including the
      // original protagonist, his rod/reflection, logo and gold crack.
      const repair = document.createElement("canvas");
      repair.width = scene.width;
      repair.height = scene.height;
      const r = repair.getContext("2d");
      r.drawImage(fill, 0, 0, scene.width, scene.height);
      r.globalCompositeOperation = "destination-in";
      const fade = r.createLinearGradient(1000, 0, 1080, 0);
      fade.addColorStop(0, "#fff0");
      fade.addColorStop(1, "#fff");
      r.fillStyle = fade;
      r.fillRect(0, 0, scene.width, scene.height);
      c.drawImage(repair, 0, 0);
      const w = scene.width,
        h = scene.height,
        pixels = c.getImageData(0, 0, w, h).data;
      const clamp = (x) => Math.max(0, Math.min(1, x));
      const smooth = (a, b, x) => {
        const t = clamp((x - a) / (b - a));
        return t * t * (3 - 2 * t);
      };
      const inside = (x, y, p) => {
        let on = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const [ax, ay] = p[i],
            [bx, by] = p[j];
          if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
            on = !on;
        }
        return on;
      };
      const cape = [
        [300, 655],
        [347, 646],
        [420, 648],
        [433, 658],
        [404, 677],
        [349, 708],
        [311, 727],
        [319, 690],
      ];
      const water = [
        [469, 761],
        [1575, 761],
        [1575, 981],
        [651, 981],
        [587, 949],
        [539, 918],
        [512, 872],
        [474, 838],
      ];
      const rocks = [
        [
          [850, 828],
          [917, 824],
          [970, 837],
          [1044, 845],
          [1193, 846],
          [1198, 861],
          [1046, 861],
          [1045, 874],
          [949, 858],
          [858, 850],
        ],
        [
          [1379, 829],
          [1578, 814],
          [1586, 874],
          [1390, 870],
        ],
      ];
      let outsideLeftDifferences = 0;
      const reference = document.createElement("canvas");
      reference.width = w;
      reference.height = h;
      const rc = reference.getContext("2d");
      rc.drawImage(source, 0, 0);
      const orig = rc.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < 1000; x++)
          for (let k = 0; k < 4; k++)
            if (orig[(y * w + x) * 4 + k] !== pixels[(y * w + x) * 4 + k])
              outsideLeftDifferences++;
      function bake(rect, count, kind) {
        const [left, top, width, height] = rect;
        const patch = document.createElement("canvas");
        patch.width = width;
        patch.height = height;
        const ctx = patch.getContext("2d");
        const frames = [];
        let moving = 0,
          maxDisplacement = 0,
          anchoredDifferences = 0;
        for (let f = 0; f < count; f++) {
          const phase = (f / count) * Math.PI * 2,
            data = ctx.createImageData(width, height);
          for (let yy = 0; yy < height; yy++)
            for (let xx = 0; xx < width; xx++) {
              const x = left + xx,
                y = top + yy;
              let mask = 0,
                dx = 0,
                dy = 0;
              if (kind === "cape" && inside(x, y, cape)) {
                const tail = 1 - smooth(320, 432, x);
                mask = tail * smooth(643, 655, y) * (1 - smooth(712, 729, y));
                dx = -0.65 * Math.sin(phase) * mask;
                dy =
                  1.5 *
                  (Math.sin(phase + (x - 300) / 65) -
                    Math.sin((x - 300) / 65)) *
                  mask;
              }
              if (
                kind === "water" &&
                inside(x, y, water) &&
                !rocks.some((p) => inside(x, y, p))
              ) {
                mask =
                  smooth(764, 788, y) *
                  smooth(475, 514, x) *
                  (1 - smooth(1535, 1584, x)) *
                  (1 - smooth(966, 990, y));
                dx =
                  (Math.sin(phase + y * 0.13) - Math.sin(y * 0.13)) *
                  1.05 *
                  mask;
                dy =
                  (Math.sin(phase * 2 + x * 0.026) - Math.sin(x * 0.026)) *
                  0.32 *
                  mask;
              }
              maxDisplacement = Math.max(
                maxDisplacement,
                Math.abs(dx),
                Math.abs(dy),
              );
              const sx = x - dx,
                sy = y - dy,
                x0 = Math.floor(sx),
                y0 = Math.floor(sy),
                fx = sx - x0,
                fy = sy - y0,
                di = (yy * width + xx) * 4;
              for (let k = 0; k < 3; k++)
                data.data[di + k] =
                  pixels[(y0 * w + x0) * 4 + k] * (1 - fx) * (1 - fy) +
                  pixels[(y0 * w + x0 + 1) * 4 + k] * fx * (1 - fy) +
                  pixels[(Math.min(y0 + 1, h - 1) * w + x0) * 4 + k] *
                    (1 - fx) *
                    fy +
                  pixels[(Math.min(y0 + 1, h - 1) * w + x0 + 1) * 4 + k] *
                    fx *
                    fy;
              // Full original-pixel patch repairs vacated cape pixels. Feather
              // only patch edges; all scene geometry inside stays pinned.
              data.data[di + 3] = Math.round(
                255 *
                  smooth(0, 5, xx) *
                  (1 - smooth(width - 6, width - 1, xx)) *
                  smooth(0, 5, yy) *
                  (1 - smooth(height - 6, height - 1, yy)),
              );
              const differs = [0, 1, 2].some(
                (k) => data.data[di + k] !== pixels[(y * w + x) * 4 + k],
              );
              if (differs) {
                moving++;
                if (mask === 0) anchoredDifferences++;
              }
            }
          ctx.putImageData(data, 0, 0);
          frames.push(patch.toDataURL("image/png").split(",")[1]);
        }
        return { rect, frames, moving, maxDisplacement, anchoredDifferences };
      }
      return {
        scene: scene.toDataURL("image/png").split(",")[1],
        w,
        h,
        cloth: bake([288, 630, 160, 108], 24, "cape"),
        water: bake([460, 758, 1124, 234], 32, "water"),
        outsideLeftDifferences,
      };
    }, inputs);
    result.lightning = await page.evaluate(bakeMenuLightning, {
      scene: result.scene,
    });
    result.fog = await page.evaluate(bakeMenuFog, { scene: result.scene });
  } finally {
    await browser.close();
  }
  if (
    result.outsideLeftDifferences ||
    result.cloth.anchoredDifferences ||
    result.water.anchoredDifferences
  )
    throw new Error("Static art registration changed pinned pixels");
  const scale = 960 / result.w,
    top = (600 - result.h * scale) / 2;
  const pin = (x, y) =>
    `setXYpos viewCenterX+(${x})-480,viewCenterY+300-(${y})`;
  const render = (body) =>
    `func menuPaint() {if phase==0 {show; ${body}; if menuEntering {setLayer Front}} else {hide}}`;
  sprite(
    "MenuScene",
    {
      static: {
        binary: Buffer.from(result.scene, "base64"),
        w: result.w,
        h: result.h,
      },
    },
    { size: scale, visible: false },
    render(pin(480, 300)),
  );
  const [fx, fy, fw, fh] = result.fog.rect;
  for (const [name, field, ghost] of [
    ["MenuFogBase", "menuFogFrame", "menuFogBlend"],
    ["MenuFogBlend", "menuFogNext", "100-menuFogBlend"],
  ])
    sprite(
      name,
      Object.fromEntries(
        result.fog.frames.map((data, i) => [
          "f" + i,
          {
            binary: Buffer.from(data, "base64"),
            w: fw / result.fog.pixelScale,
            h: fh / result.fog.pixelScale,
          },
        ]),
      ),
      { size: scale * result.fog.pixelScale, visible: false },
      `func menuPaint() {if menuEntering {setLayer Front}; if phase==0 && !menuReduced {show; ${pin((fx + fw / 2) * scale, top + (fy + fh / 2) * scale)}; setCostume ${field}; setGraphicEffect GhostEffect,${ghost}} else {hide}}`,
    );
  for (const [name, patch, field] of [
    ["MenuClothLocal", result.cloth, "menuFrame"],
    ["MenuWaterLocal", result.water, "menuWaterFrame"],
  ]) {
    const [x, y, w, h] = patch.rect;
    const frames = Object.fromEntries(
      patch.frames.map((data, i) => [
        "f" + i,
        { binary: Buffer.from(data, "base64"), w, h },
      ]),
    );
    sprite(
      name,
      frames,
      { size: scale, visible: false },
      render(
        `${pin((x + w / 2) * scale, top + (y + h / 2) * scale)}; setCostume ${field}`,
      ),
    );
  }
  const [lx, ly, lw, lh] = result.lightning.rect;
  sprite(
    "MenuLightning",
    Object.fromEntries(
      result.lightning.frames.map((data, i) => [
        "f" + i,
        { binary: Buffer.from(data, "base64"), w: lw, h: lh },
      ]),
    ),
    { size: scale, visible: false },
    `func menuPaint() {if menuEntering {setLayer Front}; if phase==0 && menuStormActive {show; ${pin((lx + lw / 2) * scale, top + (ly + lh / 2) * scale)}; setCostume menuStormFrame; setGraphicEffect GhostEffect,menuStormGhost} else {hide}}`,
  );
  for (const [i, data] of result.lightning.previews.entries())
    await writeFile(
      new URL(`art/belfry/menu/lightning-preview-${i}.png`, root),
      Buffer.from(data, "base64"),
    );
  for (const [i, data] of result.fog.previews.entries())
    await writeFile(
      new URL(`art/belfry/menu/fog-preview-${i}.png`, root),
      Buffer.from(data, "base64"),
    );
  await writeFile(
    new URL("public/art/menu-moonlit.png", root),
    Buffer.from(result.scene, "base64"),
  );
  await writeFile(
    new URL("art/belfry/menu/static-validation.json", root),
    JSON.stringify(
      {
        width: result.w,
        height: result.h,
        preservedLeftPixels: 1000 * result.h,
        leftDifferences: result.outsideLeftDifferences,
        cloth: { ...result.cloth, frames: result.cloth.frames.length },
        water: { ...result.water, frames: result.water.frames.length },
        lightning: {
          rect: result.lightning.rect,
          frames: result.lightning.frames.length,
          variants: result.lightning.variants,
        },
        fog: {
          rect: result.fog.rect,
          pixelScale: result.fog.pixelScale,
          frames: result.fog.frames.length,
          seconds: result.fog.seconds,
          activePixels: result.fog.activePixels,
          protectedDifferences: result.fog.protectedDifferences,
        },
      },
      null,
      2,
    ) + "\n",
  );
}
