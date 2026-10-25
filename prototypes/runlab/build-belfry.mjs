import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { addCityArt } from "./belfry-city-art.mjs";
import { addKeeperArt } from "./belfry-keeper-art.mjs";
import { chromium } from "@playwright/test";
import {
  platforms,
  anchors,
  enemies,
  echoes,
  checkpoints,
} from "./belfry-level.mjs";
const root = new URL("./", import.meta.url),
  files = {},
  zorder = [];
const svg = (w, h, c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${c}</svg>`;
const vector = (w, h, c) => ({ w, h, svg: svg(w, h, c) });
const code = (n) => readFile(new URL(`spx/belfry/${n}.spx`, root), "utf8");
const png = async (path, width) => {
  const binary = await readFile(new URL(path, root));
  const w = binary.readUInt32BE(16),
    h = binary.readUInt32BE(20);
  return { binary, w, h, res: w / width };
};
function sprite(name, images, config = {}, source = "") {
  const costumes = [];
  for (const [key, im] of Object.entries(images)) {
    const ext = im.binary ? "png" : "svg",
      path = `assets/sprites/${name}/${key}.${ext}`;
    files[path] = im.binary
      ? { $binary: im.binary.toString("base64") }
      : im.svg;
    costumes.push({
      name: key,
      path: `${key}.${ext}`,
      x: im.pivotX ?? im.w / 2,
      y: im.pivotY ?? im.h / 2,
      bitmapResolution: 1,
    });
  }
  files[`assets/sprites/${name}/index.json`] = JSON.stringify({
    x: 0,
    y: 0,
    heading: 90,
    size: 1 / (Object.values(images)[0].res || 1),
    rotationStyle: "none",
    physicsMode: "no",
    visible: true,
    collisionShapeType: "none",
    triggerShapeType: "none",
    costumes,
    costumeIndex: 0,
    ...config,
  });
  files[name + ".spx"] = source;
  zorder.push(name);
}
await mkdir(new URL("public/art/", root), { recursive: true });
await copyFile(
  new URL("art/belfry/clockwell.png", root),
  new URL("public/art/clockwell.png", root),
);
// Source atlases remain untouched. Build imports alpha-isolated, registered cells.
const browser = await chromium.launch({ headless: true, channel: "chromium" });
let actionFrames, combatFrames, skillFrames;
const assassinFrames = {};
const assassinKinds = ["hover", "fighter", "archer", "chain", "binder"];
try {
  const page = await browser.newPage();
  const actions = await readFile(
    new URL("art/belfry/actions-source.png", root),
  );
  actionFrames = await page.evaluate(
    async (uri) => {
      const im = new Image();
      im.src = uri;
      await im.decode();
      const output = [];
      // Hand-registered row split: the generated first row is 495 pixels tall.
      for (let k = 0; k < 8; k++) {
        const left = Math.round(((k % 4) * im.width) / 4),
          right = Math.round((((k % 4) + 1) * im.width) / 4),
          top = k < 4 ? 0 : 495,
          bottom = k < 4 ? 495 : im.height;
        const c = document.createElement("canvas");
        c.width = c.height = 418;
        const ctx = c.getContext("2d"),
          scale = 418 / 500;
        ctx.drawImage(
          im,
          left,
          top,
          right - left,
          bottom - top,
          (418 - (right - left) * scale) / 2,
          0,
          (right - left) * scale,
          (bottom - top) * scale,
        );
        output.push(c.toDataURL("image/png").split(",")[1]);
      }
      return output;
    },
    "data:image/png;base64," + actions.toString("base64"),
  );
  async function importAtlas(
    path,
    cols,
    rows,
    size,
    maxH,
    separate = false,
    constant = false,
    fixedScale = 0,
  ) {
    const source = await readFile(new URL(path, root));
    return page.evaluate(
      async ({
        uri,
        cols,
        rows,
        size,
        maxH,
        separate,
        constant,
        fixedScale,
      }) => {
        const im = new Image();
        im.src = uri;
        await im.decode();
        const whole = document.createElement("canvas");
        whole.width = im.width;
        whole.height = im.height;
        const wholeContext = whole.getContext("2d");
        wholeContext.drawImage(im, 0, 0);
        const pixels = wholeContext.getImageData(
          0,
          0,
          im.width,
          im.height,
        ).data;
        const labels = new Int32Array(im.width * im.height),
          queue = new Int32Array(labels.length),
          parts = [];
        if (separate) {
          // Extract actual connected sprites, not grid rectangles: long swords
          // cross nominal cell boundaries without touching adjacent characters.
          for (let seed = 0; seed < labels.length; seed++) {
            if (labels[seed] || pixels[seed * 4 + 3] < 80) continue;
            const id = parts.length + 1;
            let head = 0,
              tail = 1,
              l = im.width,
              r = 0,
              t = im.height,
              b = 0;
            queue[0] = seed;
            labels[seed] = id;
            while (head < tail) {
              const n = queue[head++],
                x = n % im.width,
                y = Math.floor(n / im.width);
              l = Math.min(l, x);
              r = Math.max(r, x);
              t = Math.min(t, y);
              b = Math.max(b, y);
              for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = x + dx,
                    ny = y + dy;
                  if (nx < 0 || ny < 0 || nx >= im.width || ny >= im.height)
                    continue;
                  const next = ny * im.width + nx;
                  if (!labels[next] && pixels[next * 4 + 3] >= 80) {
                    labels[next] = id;
                    queue[tail++] = next;
                  }
                }
            }
            parts.push({ id, l, r, t, b, area: tail });
          }
        }
        const principal = parts
          .sort((a, b) => b.area - a.area)
          .slice(0, cols * rows);
        const out = [];
        for (let k = 0; k < cols * rows; k++) {
          const c = document.createElement("canvas");
          let l = 0,
            t = 0,
            r,
            b;
          if (separate) {
            const part = principal.find(
              (p) =>
                Math.min(
                  cols - 1,
                  Math.floor(((p.l + p.r) / 2 / im.width) * cols),
                ) ===
                  k % cols &&
                Math.min(
                  rows - 1,
                  Math.floor(((p.t + p.b) / 2 / im.height) * rows),
                ) === Math.floor(k / cols),
            );
            if (!part)
              throw new Error(
                `Missing connected sprite ${k}: ${JSON.stringify(principal)}`,
              );
            c.width = part.r - part.l + 1;
            c.height = part.b - part.t + 1;
            const ctx = c.getContext("2d"),
              target = ctx.createImageData(c.width, c.height);
            for (let y = 0; y < c.height; y++)
              for (let x = 0; x < c.width; x++) {
                const at = (y + part.t) * im.width + x + part.l;
                if (labels[at] !== part.id) continue;
                for (let channel = 0; channel < 4; channel++)
                  target.data[(y * c.width + x) * 4 + channel] =
                    pixels[at * 4 + channel];
              }
            ctx.putImageData(target, 0, 0);
            r = c.width - 1;
            b = c.height - 1;
          } else {
            c.width = Math.floor(im.width / cols);
            c.height = Math.floor(im.height / rows);
            const ctx = c.getContext("2d");
            ctx.drawImage(
              im,
              -(k % cols) * c.width,
              -Math.floor(k / cols) * c.height,
            );
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            l = c.width;
            t = c.height;
            r = 0;
            b = 0;
            for (let y = 0; y < c.height; y++)
              for (let x = 0; x < c.width; x++)
                if (d[(y * c.width + x) * 4 + 3] > 80) {
                  l = Math.min(l, x);
                  r = Math.max(r, x);
                  t = Math.min(t, y);
                  b = Math.max(b, y);
                }
          }
          const o = document.createElement("canvas");
          o.width = o.height = size;
          const scale =
            fixedScale ||
            (constant
              ? Math.min(
                  (size - 20) /
                    Math.max(...principal.map((p) => p.r - p.l + 1)),
                  maxH / Math.max(...principal.map((p) => p.b - p.t + 1)),
                )
              : Math.min((size - 20) / (r - l + 1), maxH / (b - t + 1)));
          o.getContext("2d").drawImage(
            c,
            l,
            t,
            r - l + 1,
            b - t + 1,
            (size - (r - l + 1) * scale) / 2,
            size - 18 - (b - t + 1) * scale,
            (r - l + 1) * scale,
            (b - t + 1) * scale,
          );
          out.push(o.toDataURL("image/png").split(",")[1]);
        }
        return out;
      },
      {
        uri: "data:image/png;base64," + source.toString("base64"),
        cols,
        rows,
        size,
        maxH,
        separate,
        constant,
        fixedScale,
      },
    );
  }
  combatFrames = await importAtlas(
    "art/belfry/combat-source.png",
    4,
    3,
    418,
    330,
    true,
  );
  skillFrames = await importAtlas(
    "art/belfry/skills-source.png",
    3,
    1,
    418,
    330,
    true,
    false,
    0.48,
  );
  for (const name of assassinKinds)
    assassinFrames[name] = await importAtlas(
      `art/belfry/assassin-${name}-source.png`,
      3,
      2,
      384,
      330,
      true,
      true,
    );
  assassinFrames.elbow = await importAtlas(
    "art/belfry/assassin-elbow-source.png",
    2,
    1,
    384,
    300,
    true,
    true,
  );
  assassinFrames.ninjaFighter = await importAtlas(
    "art/belfry/ninja-fighter-source.png",
    3,
    2,
    384,
    300,
    true,
    true,
  );
  assassinFrames.ninjaArcher = await importAtlas(
    "art/belfry/ninja-archer-source.png",
    2,
    1,
    384,
    320,
    true,
    true,
  );
  assassinFrames.ninjaChain = await importAtlas(
    "art/belfry/ninja-chain-source.png",
    2,
    1,
    384,
    330,
    true,
    true,
  );
  assassinFrames.keeper = await importAtlas(
    "art/belfry/keeper-v2-source.png",
    6,
    3,
    384,
    330,
    true,
    true,
  );
} finally {
  await browser.close();
}
await mkdir(new URL("art/belfry/frames/", root), { recursive: true });
for (let i = 0; i < 3; i++)
  await writeFile(
    new URL(`art/belfry/frames/skill-${i}.png`, root),
    Buffer.from(skillFrames[i], "base64"),
  );
for (let i = 0; i < 8; i++)
  await writeFile(
    new URL(`art/belfry/frames/action-${i}.png`, root),
    Buffer.from(actionFrames[i], "base64"),
  );
for (const [prefix, frames] of [
  ["combat", combatFrames],
  ...assassinKinds.map((name) => ["assassin-" + name, assassinFrames[name]]),
  ["assassin-elbow", assassinFrames.elbow],
  ["ninja-fighter", assassinFrames.ninjaFighter],
  ["ninja-archer", assassinFrames.ninjaArcher],
  ["ninja-chain", assassinFrames.ninjaChain],
])
  for (let i = 0; i < frames.length; i++)
    await writeFile(
      new URL(`art/belfry/frames/${prefix}-${i}.png`, root),
      Buffer.from(frames[i], "base64"),
    );
await mkdir(new URL("public/art/city/", root), { recursive: true });
for (const name of ["wind", "forge", "archive", "mirror", "heart"])
  await copyFile(
    new URL(`art/belfry/city/${name}.png`, root),
    new URL(`public/art/city/${name}.png`, root),
  );
await addCityArt({ sprite, png, vector });
// Depth grading remains subtle so silhouettes, brass anchors and warnings read.
sprite(
  "Depth",
  {
    shade: vector(
      1100,
      760,
      '<defs><linearGradient id="d" x2="0" y2="1"><stop stop-color="#030a10" stop-opacity=".13"/><stop offset="1" stop-color="#060b13" stop-opacity=".62"/></linearGradient></defs><path d="M0 0h1100v760H0z" fill="url(#d)"/>',
    ),
  },
  {},
  "onStart => {for {waitNextFrame(); setXYpos 480,cameraY}}",
);
function clockArt(r = 210) {
  let s = `<circle cx="${r}" cy="${r}" r="${r - 10}" fill="none" stroke="#ab936c" stroke-width="2"/><circle cx="${r}" cy="${r}" r="${r - 23}" fill="none" stroke="#7c6b51" stroke-width="12" opacity=".2"/><circle cx="${r}" cy="${r}" r="${r - 45}" fill="none" stroke="#5f675e" stroke-width="1"/>`;
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30;
    const n = i % 5 === 0 ? 18 : 6;
    s += `<path d="M${r + Math.cos(a) * (r - 29)} ${r + Math.sin(a) * (r - 29)}l${-Math.cos(a) * n} ${-Math.sin(a) * n}" stroke="#b4a381" stroke-width="${i % 5 === 0 ? 3 : 1}" opacity=".6"/>`;
  }
  s += `<path d="M${r} 36v${r - 36}l${r / 2} ${r / 3}" fill="none" stroke="#968567" stroke-width="5"/><circle cx="${r}" cy="${r}" r="12" fill="#18222a" stroke="#b4a381"/>`;
  return vector(r * 2, r * 2, s);
}
sprite(
  "DialCore",
  { dial: clockArt() },
  { x: 480, y: -3460, rotationStyle: "normal" },
  "onStart => {for {waitNextFrame(); setHeading 90+visualTime*0.8; setGraphicEffect GhostEffect,76}}",
);
// Foreground buttresses frame the vertical play field without obscuring routes.
for (let side = 0; side < 2; side++) {
  let c =
    '<defs><linearGradient id="wall"><stop stop-color="#080e15"/><stop offset=".7" stop-color="#222a2b"/><stop offset="1" stop-color="#665f4d"/></linearGradient></defs><path d="M0 0h70v4000H0z" fill="url(#wall)"/>';
  for (let y = 0; y < 4000; y += 180)
    c += `<path d="M10 ${y}h60m-57 12h57m-48 0v150m27-150v150" stroke="#86816a" stroke-width="1" opacity=".35"/><path d="M2 ${y + 40}h45l17 16v34l-17 17H2z" fill="#0e171d" stroke="#5b5c50" stroke-width="2"/><circle cx="48" cy="${y + 72}" r="6" fill="#343b39" stroke="#8d8064"/>`;
  sprite(
    "Buttress" + side,
    { wall: vector(70, 4000, c) },
    { x: side ? 912 : 48, y: -1760 },
    "onStart => {setGraphicEffect GhostEffect,45; setGraphicEffect BrightnessEffect,-15}",
  );
}
// One texture shared by all ledges; clones scale the drawing, while collision
// uses the matching authored widths. Avoid loading this large PNG 17 times.
const ledge = await png("art/belfry/ledge.png", 1983);
ledge.pivotY = 315;
sprite(
  "Ledge",
  { deck: ledge },
  { visible: false, rotationStyle: "normal" },
  `onCloned data => {
 i:=data.(int); opening:=0.0; setSize floorW[i]/1983; show
 for {
  dt:=float64(waitNextFrame()); x:=floorX[i]+floorW[i]/2; y:=floorY[i]; heading:=90.0; ghost:=0.0
  if floorKind[i]==1 && segment==2 {y-=clamp(returnTime*180,0,700); heading+=clamp(returnTime*10,0,35); ghost=clamp(returnTime*20,0,100)}
  if floorKind[i]==2 || floorKind[i]==3 {
   guard:=2; if floorKind[i]==3 {guard=6}
   if phase==1 {if enemyHP[guard]<=0 {opening=clamp(opening+dt*1.3,0,1)} else {opening=0}}
   x+=opening*900; ghost=opening*70
  }
  if !floorActive(i) && floorKind[i]>=4 {ghost=100}
  if floorKind[i]==4 {setGraphicEffect ColorEffect,18} else if floorKind[i]==5 {setGraphicEffect BrightnessEffect,18}
  if practice==1 {if i==0 {setSize 800.0/1983; x=480; y=0; ghost=0} else {ghost=100}} else {setSize floorW[i]/1983}
  setXYpos x,y; setHeading heading; setGraphicEffect GhostEffect,ghost
 }
}`,
);
for (let i = 0; i < 4; i++) {
  const [x, y] = checkpoints[i];
  sprite(
    "Sanctuary" + i,
    {
      beacon: vector(
        130,
        160,
        '<defs><radialGradient id="g"><stop stop-color="#f0d89f" stop-opacity=".30"/><stop offset="1" stop-color="#deb16e" stop-opacity="0"/></radialGradient></defs><ellipse cx="65" cy="90" rx="65" ry="70" fill="url(#g)"/><path d="M47 158V78l18-19 18 19v80" fill="#151e24" stroke="#a29675" stroke-width="2"/><path d="M65 18v49M58 23h14M52 78h26M65 80v53" stroke="#f0cf89" stroke-width="2"/><circle cx="65" cy="49" r="7" fill="#f3d68b"/><path d="M40 159h50" stroke="#c5bd9e" stroke-width="3"/>',
      ),
    },
    { x, y: y + 80 },
    `onStart => {for {waitNextFrame(); if checkpoint>=${i} {setGraphicEffect BrightnessEffect,8+sin(visualTime*2)*4} else {setGraphicEffect BrightnessEffect,-25}}}`,
  );
}
sprite(
  "AbandonedPost",
  {
    post: vector(
      100,
      150,
      '<path d="M15 147h70M30 140V75h40v65M24 75h52" fill="#171e23" stroke="#80745d" stroke-width="3"/><path d="M23 65V34Q50 2 77 34v31l-27 13Z" fill="#293034" stroke="#a28d65" stroke-width="2"/><path d="M30 43h40M39 53h22" stroke="#080f15" stroke-width="5"/><path d="M50 19V5M49 78l-9 35 23 19" stroke="#586560" stroke-width="2"/>',
    ),
  },
  { x: 805, y: -2025 },
  "onStart => {for {waitNextFrame(); if practice==1 {hide} else {show}}}",
);
const anchorBase =
  '<circle cx="28" cy="28" r="20" fill="#111d24" stroke="#af956b" stroke-width="3"/><circle cx="28" cy="28" r="12" fill="none" stroke="#e9d9aa" stroke-width="1.5"/><path d="M28 1v13m0 28v13M1 28h13m28 0h13" stroke="#7e725c" stroke-width="4"/><path d="M28 20l8 8-8 8-8-8z" fill="#c9f0db"/>';
sprite(
  "Anchor",
  {
    idle: vector(56, 56, anchorBase),
    seal: vector(
      56,
      56,
      anchorBase
        .replaceAll("#c9f0db", "#ffbe91")
        .replaceAll("#e9d9aa", "#f3a071") +
        '<circle cx="28" cy="28" r="25" fill="none" stroke="#f0a276" stroke-width="2"/>',
    ),
    chosen: vector(
      56,
      56,
      anchorBase +
        '<circle cx="28" cy="28" r="25" fill="none" stroke="#e7fff3" stroke-width="2"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Anchor"),
);
sprite(
  "SealCable",
  {
    wire: vector(
      24,
      6,
      '<path d="M0 3h24" stroke="#e9a26f" stroke-width="3"/><path d="M0 2h24" stroke="#fff0c0" stroke-width=".8"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  "onCloned data => {i:=data.(int); side:=i/14; j:=i%14; for {waitNextFrame(); active:=segment==1 && bossShield>0; if side==0 && sealLeft || side==1 && sealRight {active=false}; if active {show; ax:=anchorX[14+side]; ay:=anchorY[14+side]; dx:=enemyX[10]-ax; dy:=enemyY[10]+60-ay; t:=(float64(j)+0.5)/14; setXYpos ax+dx*t,ay+dy*t; setHeading angle(dx,dy); setSize dist(dx,dy)/14/24+0.05} else {hide}}}",
);
sprite(
  "BossWard",
  {
    ward: vector(
      340,
      340,
      '<circle cx="170" cy="170" r="155" fill="#c7924c" fill-opacity=".04" stroke="#e9bd7e" stroke-opacity=".6" stroke-width="1.5"/><path d="M170 12l137 79v158l-137 79-137-79V91z" fill="none" stroke="#e7b273" stroke-opacity=".35"/><circle cx="170" cy="170" r="144" fill="none" stroke="#b9c0a4" stroke-opacity=".3" stroke-dasharray="3 13"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  "onStart => {for {waitNextFrame(); if segment==1 && bossShield>0 {show; setXYpos enemyX[10],enemyY[10]; setHeading 90+visualTime*10} else {hide}}}",
);
sprite(
  "Niche",
  {
    stone: vector(
      112,
      144,
      '<path d="M10 140V46Q56-22 102 46v94" fill="#080e12" stroke="#565850" stroke-width="2"/><path d="M22 138V48Q56 0 90 48v90" fill="#060a0e" stroke="#303736" stroke-width="2"/><path d="M3 140h106M17 68h14m50 0h14M17 100h14m50 0h14" stroke="#807760" stroke-width="1.5"/><path d="M50 22h12v9H50z" fill="#bea473"/>',
    ),
  },
  { visible: false },
  "onCloned data => {i:=data.(int); for {waitNextFrame(); if enemyType[i]==2 && enemyBaseY[i]>-6000 {show; setSize 0.82; setXYpos enemyBaseX[i],enemyBaseY[i]+15} else {hide}}}",
);
const enemyImages = {};
for (const name of assassinKinds)
  for (let i = 0; i < 6; i++)
    enemyImages[`${name}${i}`] = {
      ...(await png(`art/belfry/frames/assassin-${name}-${i}.png`, 384)),
      pivotX: 192,
      pivotY: 366,
    };
for (let i = 0; i < 2; i++)
  enemyImages["elbow" + i] = {
    ...(await png(`art/belfry/frames/assassin-elbow-${i}.png`, 384)),
    pivotX: 192,
    pivotY: 366,
  };
for (const [name, count] of [
  ["fighter", 6],
  ["archer", 2],
  ["chain", 2],
])
  for (let i = 0; i < count; i++)
    enemyImages[`ninja-${name}${i}`] = {
      ...(await png(`art/belfry/frames/ninja-${name}-${i}.png`, 384)),
      pivotX: 192,
      pivotY: 366,
    };
for (let i = 0; i < 18; i++)
  enemyImages[`keeper${i}`] = {
    binary: Buffer.from(assassinFrames.keeper[i], "base64"),
    w: 384,
    h: 384,
    pivotX: 192,
    pivotY: 366,
  };
sprite(
  "EnemyBlend",
  enemyImages,
  { visible: false, rotationStyle: "left-right" },
  await code("EnemyBlend"),
);
sprite(
  "Enemy",
  enemyImages,
  { visible: false, rotationStyle: "left-right" },
  await code("Enemy"),
);
sprite(
  "EnemyTell",
  {
    tell: vector(
      180,
      180,
      '<defs><radialGradient id="t"><stop stop-color="#f78046" stop-opacity=".04"/><stop offset=".8" stop-color="#f78046" stop-opacity=".16"/><stop offset="1" stop-color="#f78046" stop-opacity="0"/></radialGradient></defs><circle cx="90" cy="90" r="80" fill="url(#t)"/><path d="M90 22l13 24H77z" fill="#f4a170"/><circle cx="90" cy="90" r="65" fill="none" stroke="#e6a371" stroke-width="1" stroke-dasharray="12 10"/>',
    ),
    guard: vector(
      180,
      180,
      '<path d="M42 30l96 96M138 30l-96 96" stroke="#b4e5df" stroke-width="4"/><path d="M28 80q0 78 62 88q62-10 62-88" fill="none" stroke="#7cbab8" stroke-width="2"/>',
    ),
  },
  { visible: false },
  await code("EnemyTell"),
);
sprite(
  "Hazard",
  {
    beam: vector(
      400,
      12,
      '<path d="M0 6h400" stroke="#e69b77" stroke-width="3"/><path d="M0 6h400" stroke="#fff1cc" stroke-width="1" stroke-dasharray="12 9"/>',
    ),
    wave: vector(
      200,
      200,
      '<circle cx="100" cy="100" r="95" fill="none" stroke="#e9af76" stroke-width="3"/><circle cx="100" cy="100" r="90" fill="none" stroke="#ffe6b5" stroke-width="1"/>',
    ),
    cleave: vector(
      260,
      260,
      '<path d="M25 20Q270 40 225 240" fill="none" stroke="#eba78b" stroke-width="12"/><path d="M35 25Q260 50 220 230" fill="none" stroke="#ffeccc" stroke-width="2"/>',
    ),
    chain: vector(
      400,
      20,
      '<defs><pattern id="links" width="16" height="20" patternUnits="userSpaceOnUse"><rect x="1" y="6" width="12" height="7" rx="3.5" fill="none" stroke="#292b29" stroke-width="4"/><rect x="1" y="6" width="12" height="7" rx="3.5" fill="none" stroke="#c2a882" stroke-width="1.4"/><path d="M9 9h10" stroke="#777a71" stroke-width="2"/></pattern></defs><path d="M0 0h385v20H0z" fill="url(#links)"/><path d="M381 9l18-7-6 16-7-3 7-8-12 7" fill="#cfc7a6" stroke="#4b4e44" stroke-width="1"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Hazard"),
);
sprite(
  "ChargeHalo",
  {
    ring: vector(
      110,
      110,
      '<circle cx="55" cy="55" r="47" fill="none" stroke="#c65859" stroke-width="1.5" stroke-dasharray="18 12"/><path d="M55 2v16m53 37H92M55 108V92M2 55h16" stroke="#ffe9d4" stroke-width="2"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  "onStart => {for {waitNextFrame(); if Hero.charging && (phase==1 || phase==5) {show; setXYpos Hero.px,Hero.py+30; setHeading 90+visualTime*120; setSize 0.45+Hero.chargeTime*0.4; setGraphicEffect BrightnessEffect,Hero.chargeTime*30} else {hide}}}",
);
addKeeperArt(sprite, vector, await code("KeeperLine"));
sprite(
  "Echo",
  {
    shard: vector(
      54,
      70,
      '<defs><radialGradient id="e"><stop stop-color="#f9dfaa" stop-opacity=".7"/><stop offset="1" stop-color="#e7c281" stop-opacity="0"/></radialGradient></defs><ellipse cx="27" cy="35" rx="27" ry="35" fill="url(#e)"/><path d="M27 12l9 23-9 23-9-23z" fill="#e9d2a1"/><path d="M27 6l16 29-16 29L11 35z" fill="none" stroke="#d5bb81"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Echo"),
);
sprite(
  "Core",
  {
    heart: vector(
      100,
      140,
      '<defs><radialGradient id="c"><stop stop-color="#fff0bf" stop-opacity=".7"/><stop offset="1" stop-color="#efb965" stop-opacity="0"/></radialGradient></defs><ellipse cx="50" cy="70" rx="50" ry="70" fill="url(#c)"/><path d="M50 20l16 38-16 58-16-58z" fill="#ffdf9c"/><circle cx="50" cy="62" r="28" fill="none" stroke="#f8d083" stroke-width="1.5"/>',
    ),
  },
  { visible: false },
  "onStart => {for {waitNextFrame(); if segment==2 {show; setXYpos Hero.px-35,Hero.py+62+sin(visualTime*3)*7; setSize 0.36} else {hide}}}",
);
sprite(
  "Rope",
  {
    chain: vector(
      24,
      8,
      '<path d="M0 4h24" stroke="#8c734e" stroke-width="4"/><path d="M0 3.3h24" stroke="#f7e5ae" stroke-width="1.1"/><path d="M3 2v4m8-4v4m8-4v4" stroke="#b3c9b8" stroke-width="1"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Rope"),
);
const registration = [
  [216, 400],
  [217, 396],
  [244, 398],
  [226, 401],
  [244, 398],
  [258, 398],
  [230, 399],
  [234, 376],
  [266, 436],
];
const heroFrame = async (i) => ({
  ...(await png(`art/rupture-v2/frames/${i}.png`, 82)),
  pivotX: registration[i][0],
  pivotY: registration[i][1],
});
const hero = { idle: await heroFrame(0) };
const runReg = [
  [213, 360],
  [216, 358],
  [211, 357],
  [218, 357],
  [220, 347],
  [229, 345],
  [220, 354],
  [224, 354],
  [202, 335],
  [230, 342],
  [228, 347],
  [227, 335],
];
for (let i = 0; i < 12; i++)
  hero["run" + i] = {
    ...(await png(`art/rupture-v2/run-frames/${i}.png`, 82)),
    pivotX: (runReg[i][0] * 418) / 362,
    pivotY: (runReg[i][1] * 418) / 362,
  };
hero.jump = await heroFrame(7);
hero.dash = await heroFrame(8);
hero.fall = { ...(await heroFrame(6)), pivotY: 405 };
hero.land = { ...(await heroFrame(5)), pivotY: 401 };
const actionReg = [
  [270, 486],
  [230, 486],
  [240, 486],
  [250, 486],
  [245, 385],
  [250, 370],
  [245, 370],
  [240, 370],
];
for (let i = 0; i < 8; i++)
  hero["action" + i] = {
    ...(await png(`art/belfry/frames/action-${i}.png`, 82)),
    pivotX: 24 + (actionReg[i][0] * 418) / 500,
    pivotY: (actionReg[i][1] * 418) / 500,
  };
for (let i = 0; i < 12; i++)
  hero["combat" + i] = {
    ...(await png(`art/belfry/frames/combat-${i}.png`, 82)),
    pivotX: 209,
    pivotY: 400,
  };
for (let i = 0; i < 3; i++)
  hero["skill" + i] = {
    ...(await png(`art/belfry/frames/skill-${i}.png`, 82)),
    pivotX: [190, 209, 199][i],
    pivotY: 400,
  };
sprite(
  "Trail",
  hero,
  { visible: false, rotationStyle: "left-right" },
  await code("Trail"),
);
sprite(
  "PoseBlend",
  hero,
  { visible: false, rotationStyle: "left-right" },
  await code("PoseBlend"),
);
sprite(
  "Hero",
  hero,
  { x: 230, y: 0, rotationStyle: "left-right" },
  await code("Hero"),
);
// Skill visuals remain native spx sprites (no host-only VFX overlay).
const bowCostumes = {};
for (let i = 0; i < 3; i++)
  bowCostumes["draw" + i] = vector(
    180,
    100,
    `<path d="M60 50H160m-16-8 16 8-16 8" fill="none" stroke="${i === 2 ? "#fff0d7" : "#ce7f72"}" stroke-width="1" stroke-dasharray="${i === 2 ? "25 5" : "5 8"}"/><path d="M160 30v8m0 24v8" stroke="#ba6560" stroke-width="1"/>`,
  );
sprite(
  "SpiritBow",
  bowCostumes,
  { visible: false, rotationStyle: "normal" },
  "onStart => {for {waitNextFrame(); if Hero.bowCharging && phase!=2 && phase!=3 {show; setCostume int(clamp(Hero.bowCharge/0.27,0,2)); setXYpos Hero.px+Hero.aimX*40,Hero.py+32+Hero.aimY*40; setHeading angle(Hero.aimX,Hero.aimY); setSize 0.8} else {hide}}}",
);
sprite(
  "BowLock",
  {
    lock: vector(
      110,
      110,
      '<path d="M14 34V14h20m42 0h20v20m0 42v20H76m-42 0H14V76" fill="none" stroke="#edb59e" stroke-width="2"/><circle cx="55" cy="55" r="35" fill="none" stroke="#ca6563" stroke-width="1" stroke-dasharray="18 10"/><path d="M55 4v14m0 74v14M4 55h14m74 0h14" stroke="#fff0d4" stroke-width="1.5"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  "onStart => {for {waitNextFrame(); i:=Hero.bowTarget; if Hero.bowCharging && i>=0 && phase!=2 && phase!=3 {show; setXYpos enemyX[i],enemyY[i]; setSize 0.75+clamp(Hero.bowCharge,0,0.55)*0.25; if enemyType[i]==3 {setSize 1.6}; setHeading 90; setGraphicEffect GhostEffect,15} else {hide}}}",
);
sprite(
  "HealingWeave",
  {
    weave: vector(
      160,
      160,
      '<path d="M80 9L97 58l49 22-49 22-17 49-17-49L14 80l49-22Z" fill="none" stroke="#b9c8af" stroke-opacity=".5"/><circle cx="80" cy="80" r="57" fill="none" stroke="#e4cb8f" stroke-width="1" stroke-dasharray="19 10"/><path d="M80 35v90M35 80h90" stroke="#e7d7ad" stroke-width="1"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  "onStart => {for {waitNextFrame(); if Hero.healTime>0 && phase!=2 && phase!=3 {show; setXYpos Hero.px,Hero.py+30; setSize 0.35+Hero.healTime*0.65; setHeading 90+visualTime*80; setGraphicEffect GhostEffect,Hero.healTime*40} else {hide}}}",
);
sprite(
  "裂印",
  {
    mark: vector(
      70,
      90,
      '<path d="M35 5L13 39l22 46 22-46Z" fill="#441f29" fill-opacity=".25" stroke="#de796d" stroke-width="1"/><path d="M39 13L26 44h18L31 77" fill="none" stroke="#ffe7d5" stroke-width="3"/><path d="M35 0v9m0 72v9" stroke="#dc7064"/>',
    ),
  },
  { visible: false },
  "onCloned data => {i:=data.(int); for {waitNextFrame(); if enemyMark[i]>0 && enemyHP[i]>0 {show; setXYpos enemyX[i],enemyY[i]+58; setSize 0.45; setGraphicEffect GhostEffect,15+sin(visualTime*7)*12} else {hide}}}",
);
sprite(
  "Arrow",
  {
    quick: vector(
      130,
      30,
      '<path d="M0 15h105" stroke="#872f36" stroke-width="5"/><path d="M15 15h103l-15-6 24 6-24 6 15-6" fill="none" stroke="#fce5d4" stroke-width="2"/>',
    ),
    full: vector(
      180,
      40,
      '<path d="M0 20l150-9 27 9-27 9Z" fill="#912e39" fill-opacity=".5"/><path d="M20 20h135" stroke="#dc5d53" stroke-width="7"/><path d="M45 20h117l-20-7 34 7-34 7 20-7" fill="none" stroke="#fff1d9" stroke-width="2"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Arrow"),
);
sprite(
  "SkillFX",
  {
    needle: vector(
      250,
      100,
      '<path d="M5 50Q80 12 220 50Q80 87 5 50" fill="#1a1720" fill-opacity=".8"/><path d="M10 50H241M210 35l32 15-32 15" fill="none" stroke="#de615b" stroke-width="3"/><path d="M70 50h170" stroke="#fff5df" stroke-width="2"/><path d="M90 30l70 8m-45 33 82-7" stroke="#b64545" stroke-width="2"/>',
    ),
    cleave: vector(
      390,
      300,
      '<path d="M20 256Q360 263 330 8Q440 220 20 256Z" fill="#080d17" fill-opacity=".85"/><path d="M20 251Q341 241 330 8Q400 211 20 251" fill="#b62f42" fill-opacity=".85"/><path d="M30 245Q340 224 331 17Q365 209 30 245" fill="#f9e5d1"/><path d="M56 253Q339 250 346 45M43 268Q295 279 359 126" fill="none" stroke="#e25e5e" stroke-width="3"/><path d="M10 242l58-6m273-199 9-28M300 225l42 8" stroke="#f3ad8b" stroke-width="2"/>',
    ),
    restore: vector(
      220,
      220,
      '<circle cx="110" cy="110" r="81" fill="none" stroke="#d8bd81" stroke-width="2"/><circle cx="110" cy="110" r="92" fill="none" stroke="#acc7b3" stroke-width="1" stroke-dasharray="30 16"/><path d="M110 14v58m0 76v58M14 110h58m76 0h58" stroke="#f5e4b3" stroke-width="2"/><path d="M110 45l18 47 47 18-47 18-18 47-18-47-47-18 47-18Z" fill="#b6c8ac" fill-opacity=".15"/>',
    ),
    rupture: vector(
      280,
      280,
      '<path d="M140 10l12 100 65-67-48 84 101 13-99 12 65 65-84-48-12 101-12-99-65 65 48-84-101-12 100-12-67-65 84 48Z" fill="#dd5c56" fill-opacity=".7"/><path d="M22 22l236 236M258 22L22 258" stroke="#fff3da" stroke-width="3"/><circle cx="140" cy="140" r="50" fill="none" stroke="#eeaea0" stroke-width="2"/>',
    ),
    gather: vector(
      330,
      330,
      '<circle cx="165" cy="165" r="136" fill="none" stroke="#b34c50" stroke-width="1" stroke-dasharray="55 22"/><path d="M165 18l15 110 110 37-110 15-15 110-15-110-110-15 110-37Z" fill="#080d17" fill-opacity=".65" stroke="#edc2af" stroke-width="1"/><circle cx="165" cy="165" r="48" fill="none" stroke="#f2d7b7" stroke-width="2"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("SkillFX"),
);
sprite(
  "Target",
  {
    ring: vector(
      84,
      84,
      '<path d="M7 26V7h19m32 0h19v19m0 32v19H58m-32 0H7V58" fill="none" stroke="#d9f8de" stroke-width="1.6"/><circle cx="42" cy="42" r="28" fill="none" stroke="#b0d4be" stroke-width=".8" stroke-dasharray="2 7"/>',
    ),
  },
  { visible: false },
  "onStart => {for {waitNextFrame(); i:=Hero.target; if phase==1 && i>=0 && Hero.hook<0 && !Hero.bowCharging {show; if i<len(anchorX) {setXYpos anchorX[i],anchorY[i]} else {j:=i-len(anchorX); setXYpos enemyX[j],enemyY[j]}; setSize 0.85+sin(visualTime*5)*0.04} else {hide}}}",
);
sprite(
  "Slash",
  {
    cut: vector(
      260,
      220,
      '<defs><linearGradient id="s"><stop stop-color="#81c9c0" stop-opacity="0"/><stop offset=".7" stop-color="#b7eee0" stop-opacity=".7"/><stop offset="1" stop-color="#ffffe1"/></linearGradient></defs><path d="M30 10Q260 30 228 182Q235 82 30 10" fill="url(#s)"/><path d="M45 21Q235 45 225 171" fill="none" stroke="#e5ffe9" stroke-width="2"/><path d="M78 26Q245 45 231 153" fill="none" stroke="#9cdbcb" stroke-width="1"/>',
    ),
    nova: vector(
      500,
      500,
      '<circle cx="250" cy="250" r="170" fill="none" stroke="#fff4c9" stroke-width="4"/><circle cx="250" cy="250" r="190" fill="none" stroke="#c7a467" stroke-width="18" opacity=".2"/><path d="M30 240Q250 100 470 260Q250 380 30 240M240 30Q400 250 260 470Q100 250 240 30" fill="none" stroke="#eddbac" stroke-width="2"/>',
    ),
    reverse: vector(
      260,
      220,
      '<path d="M30 190Q260 180 228 32Q235 132 30 190" fill="#c0f4df" fill-opacity=".65"/><path d="M45 179Q235 155 225 49" fill="none" stroke="#eeffe6" stroke-width="2"/>',
    ),
    finish: vector(
      320,
      240,
      '<ellipse cx="160" cy="120" rx="143" ry="72" fill="none" stroke="#e7d7a2" stroke-width="4"/><path d="M15 145Q170 10 306 110M20 164Q160 35 305 120" fill="none" stroke="#b7eee0" stroke-width="2"/>',
    ),
    rising: vector(
      210,
      290,
      '<path d="M30 270Q175 240 140 10Q220 190 30 270" fill="#c7f6e0" fill-opacity=".7"/><path d="M40 260Q196 216 150 20" fill="none" stroke="#fbffe0" stroke-width="3"/>',
    ),
    air: vector(
      280,
      230,
      '<path d="M15 50Q280 5 250 205Q285 80 15 50" fill="#cdf4e8"/><path d="M40 65Q260 20 249 180" fill="none" stroke="#93c8c0" stroke-width="3"/>',
    ),
    heavy: vector(
      280,
      310,
      '<path d="M60 10Q300 40 192 290Q240 110 60 10" fill="#ffdc9c" fill-opacity=".85"/><path d="M72 20Q290 55 200 275" fill="none" stroke="#fff9d4" stroke-width="5"/>',
    ),
  },
  { visible: false, rotationStyle: "left-right" },
  await code("Slash"),
);
sprite(
  "Particle",
  {
    light: vector(
      35,
      8,
      '<path d="M0 4l30-3 5 3-5 2z" fill="#beefdf"/><path d="M12 4h21" stroke="#efffe9"/>',
    ),
    spark: vector(
      22,
      7,
      '<path d="M0 4l18-3 4 3-4 2z" fill="#f7b668"/><path d="M8 3h12" stroke="#fff0bc"/>',
    ),
    debris: vector(
      16,
      14,
      '<path d="M1 2l12-1 2 8-8 4-7-5z" fill="#796e59"/><path d="M1 2l12-1-4 5H1" fill="#c1b390"/>',
    ),
    hurt: vector(22, 8, '<path d="M0 4l17-3 5 3-5 3z" fill="#f69a87"/>'),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Particle"),
);
sprite(
  "Pulse",
  {
    mint: vector(
      160,
      160,
      '<circle cx="80" cy="80" r="62" stroke="#addcca" stroke-width="2" fill="none"/><circle cx="80" cy="80" r="66" stroke="#c6f1dc" stroke-width="8" opacity=".1" fill="none"/>',
    ),
    gold: vector(
      160,
      160,
      '<circle cx="80" cy="80" r="62" stroke="#ffe7b6" stroke-width="2.5" fill="none"/><circle cx="80" cy="80" r="68" stroke="#f6c886" stroke-width="9" opacity=".14" fill="none"/><path d="M0 80h42m76 0h42M80 0v42m0 76v42" stroke="#ffffd1"/>',
    ),
    warning: vector(
      160,
      160,
      '<circle cx="80" cy="80" r="62" stroke="#ed9b6c" stroke-width="3" fill="none"/>',
    ),
  },
  { visible: false },
  await code("Pulse"),
);
sprite(
  "Bolt",
  {
    bolt: vector(
      40,
      22,
      '<defs><radialGradient id="b"><stop stop-color="#ffdeac" stop-opacity=".8"/><stop offset="1" stop-color="#ea7d46" stop-opacity="0"/></radialGradient></defs><ellipse cx="20" cy="11" rx="20" ry="11" fill="url(#b)"/><path d="M3 11l28-4 6 4-6 4z" fill="#f1b57d"/><path d="M19 11h15" stroke="#fff1c6" stroke-width="2"/>',
    ),
    arrow: vector(
      62,
      12,
      '<path d="M2 6h48" stroke="#bca782" stroke-width="2"/><path d="M48 2l12 4-12 4z" fill="#f6dfad"/><path d="M3 6l-2-5 12 5-12 5z" fill="#abb4a1"/>',
    ),
    heavyarrow: vector(
      78,
      16,
      '<path d="M2 8h60" stroke="#a79679" stroke-width="3"/><path d="M58 2l18 6-18 6 4-6z" fill="#e4bb77"/><path d="M3 8l-1-6 17 6-17 6z" fill="#8d9a8f"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Bolt"),
);
let dust = "";
for (let i = 0; i < 75; i++) {
  const x = (i * 179.3) % 1400,
    y = (i * 93.7) % 1000;
  dust += `<circle cx="${x}" cy="${y}" r="${i % 5 === 0 ? 1.8 : 0.8}" fill="${i % 2 ? "#ebc586" : "#adc7c4"}" opacity="${i % 5 === 0 ? 0.45 : 0.15}"/>`;
}
sprite(
  "Motes",
  { dust: vector(1400, 1000, dust) },
  {},
  "onStart => {for {waitNextFrame(); setXYpos 480+sin(visualTime*0.07)*30,cameraY+sin(visualTime*0.11)*50}}",
);
sprite(
  "Mist",
  {
    fog: vector(
      1200,
      600,
      '<defs><radialGradient id="f"><stop stop-color="#709994" stop-opacity=".10"/><stop offset="1" stop-color="#748d90" stop-opacity="0"/></radialGradient></defs><ellipse cx="300" cy="450" rx="500" ry="110" fill="url(#f)"/><ellipse cx="950" cy="140" rx="420" ry="90" fill="url(#f)"/>',
    ),
  },
  {},
  "onStart => {for {waitNextFrame(); setXYpos 480+sin(visualTime*0.1)*85,cameraY+sin(visualTime*0.18)*28}}",
);
sprite(
  "RisingVoid",
  {
    void: vector(
      1100,
      900,
      '<defs><linearGradient id="v" x2="0" y2="1"><stop stop-color="#e3b072" stop-opacity="0"/><stop offset=".06" stop-color="#e6b572" stop-opacity=".7"/><stop offset=".15" stop-color="#3d201e" stop-opacity=".98"/><stop offset="1" stop-color="#080b0f"/></linearGradient></defs><path d="M0 0h1100v900H0z" fill="url(#v)"/><path d="M0 48q150-25 300 0t300 0t300 0t300 0" stroke="#f3ca8b" stroke-width="2" fill="none"/>',
    ),
  },
  { visible: false },
  "onStart => {for {waitNextFrame(); if segment==2 {show; setXYpos 480,riseY-395} else {hide}}}",
);
const floats = (a) => "[]float64{" + a.join(",") + "}",
  ints = (a) => "[]int{" + a.join(",") + "}";
const initialization = `func initLevel() {
 keeperIndex=${enemies.findIndex((enemy) => enemy[2] === 3)}
 cityNodeX=[]float64{315,230,720,770,230}; cityNodeY=[]float64{0,-1050,-2100,-2630,-3150}
 anchorX=${floats(anchors.map((a) => a[0]))}; anchorY=${floats(anchors.map((a) => a[1]))}
 floorX=${floats(platforms.map((a) => a[0]))}; floorW=${floats(platforms.map((a) => a[1]))}; floorY=${floats(platforms.map((a) => a[2]))}; floorKind=${ints(platforms.map((a) => a[3]))}
 enemyBaseX=${floats(enemies.map((a) => a[0]))}; enemyBaseY=${floats(enemies.map((a) => a[1]))}; enemyX=${floats(enemies.map((a) => a[0]))}; enemyY=${floats(enemies.map((a) => a[1]))}; enemyType=${ints(enemies.map((a) => a[2]))}
 enemyMark=${floats(enemies.map(() => 0))};
 enemyFacing=${floats(enemies.map(() => -1))}; enemyStride=${floats(enemies.map(() => 0))}; enemyFloor=${ints(enemies.map(() => -1))}; enemyStep=${ints(enemies.map(() => 0))}; enemySpent=${ints(enemies.map(() => 0))}; enemyRecover=${floats(enemies.map(() => 0))}
 enemyFromX=${floats(enemies.map(() => 0))}; enemyFromY=${floats(enemies.map(() => 0))}; enemyMoveX=${floats(enemies.map(() => 0))}; enemyMoveY=${floats(enemies.map(() => 0))}; enemyMoveTime=${floats(enemies.map(() => 0))}; enemyMoveArc=${floats(enemies.map(() => 0))}
 enemyHP=${ints(enemies.map(() => 0))}; enemyState=${ints(enemies.map(() => 0))}; enemyClock=${floats(enemies.map(() => 0))}; enemyFlash=${floats(enemies.map(() => 0))}
 enemyAttackHealth=${ints(enemies.map(() => 0))}; enemyMode=${ints(enemies.map(() => 0))}; enemyCycle=${ints(enemies.map(() => 0))}; enemyGreeted=${ints(enemies.map(() => 0))}; enemyOffX=${floats(enemies.map(() => 0))}; enemyOffY=${floats(enemies.map(() => 0))}; enemyVX=${floats(enemies.map(() => 0))}; enemyVY=${floats(enemies.map(() => 0))}; enemyStun=${floats(enemies.map(() => 0))}; enemyThrown=${floats(enemies.map(() => 0))}; enemyAimX=${floats(enemies.map(() => 0))}; enemyAimY=${floats(enemies.map(() => 0))}; enemyHazard=${floats(enemies.map(() => 0))};
 echoX=${floats(echoes.map((a) => a[0]))}; echoY=${floats(echoes.map((a) => a[1]))}; echoTaken=${ints(echoes.map(() => 0))}
 checkpointX=${floats(checkpoints.map((a) => a[0]))}; checkpointY=${floats(checkpoints.map((a) => a[1]))}
}
`;
files["main.spx"] = (await code("main")).replace(
  "func dist(",
  initialization +
    (await code("Assassins")) +
    (await code("Keeper")) +
    (await code("Inscription")) +
    (await code("City")) +
    "\nfunc dist(",
);
files["assets/index.json"] = JSON.stringify({
  map: { width: 4000, height: 12000 },
  run: { width: 960, height: 600 },
  maxFPS: 60,
  physics: false,
  autoSetCollisionLayer: true,
  zorder,
});
for (const [p, data] of Object.entries(files)) {
  const dest = new URL("projects/belfry/" + p, root);
  await mkdir(new URL(".", dest), { recursive: true });
  await writeFile(
    dest,
    data.$binary ? Buffer.from(data.$binary, "base64") : data,
  );
}
await writeFile(new URL("public/belfry.json", root), JSON.stringify(files));
console.log(
  `Built Belfry: ${Object.keys(files).length} files / ${zorder.length} sprites`,
);
