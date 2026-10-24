import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
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
// Import the original transparent atlas. Crop each column to its alpha bounds,
// fit it to a common texture size, preserve its alpha and leave the source intact.
const source = await readFile(new URL("art/belfry/sentinels-source.png", root));
const browser = await chromium.launch({ headless: true, channel: "chromium" });
let enemyFrames, actionFrames;
try {
  const page = await browser.newPage();
  enemyFrames = await page.evaluate(
    async (uri) => {
      const im = new Image();
      im.src = uri;
      await im.decode();
      const output = [];
      for (let k = 0; k < 3; k++) {
        const c = document.createElement("canvas");
        c.width = im.width / 3;
        c.height = im.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(im, -k * c.width, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let l = c.width,
          t = c.height,
          r = 0,
          b = 0;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++)
            if (d[(y * c.width + x) * 4 + 3] > 80) {
              l = Math.min(l, x);
              t = Math.min(t, y);
              r = Math.max(r, x);
              b = Math.max(b, y);
            }
        const o = document.createElement("canvas");
        o.width = o.height = 512;
        const s = Math.min(480 / (r - l + 1), 480 / (b - t + 1));
        o.getContext("2d").drawImage(
          c,
          l,
          t,
          r - l + 1,
          b - t + 1,
          256 - ((r - l + 1) * s) / 2,
          256 - ((b - t + 1) * s) / 2,
          (r - l + 1) * s,
          (b - t + 1) * s,
        );
        output.push(o.toDataURL("image/png").split(",")[1]);
      }
      return output;
    },
    "data:image/png;base64," + source.toString("base64"),
  );
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
} finally {
  await browser.close();
}
await mkdir(new URL("art/belfry/frames/", root), { recursive: true });
for (let i = 0; i < 3; i++)
  await writeFile(
    new URL(`art/belfry/frames/${i}.png`, root),
    Buffer.from(enemyFrames[i], "base64"),
  );
for (let i = 0; i < 8; i++)
  await writeFile(
    new URL(`art/belfry/frames/action-${i}.png`, root),
    Buffer.from(actionFrames[i], "base64"),
  );
const bg = await png("art/belfry/clockwell.png", 1510);
sprite(
  "Cathedral",
  { scene: bg },
  { x: 480, y: -120 },
  "onStart => {for {waitNextFrame(); setXYpos 480,cameraY*0.96-80}}",
);
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
for (let i = 0; i < 5; i++)
  sprite(
    "Dial" + i,
    { dial: clockArt() },
    { x: i % 2 ? 750 : 195, y: -430 - i * 760, rotationStyle: "normal" },
    `onStart => {for {waitNextFrame(); setHeading 90+worldTime*${i % 2 ? 0.8 : -0.8}; setGraphicEffect GhostEffect,68}}`,
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
  if floorKind[i]>=2 {
   guard:=2; if floorKind[i]==3 {guard=6}
   if phase==1 {if enemyHP[guard]<=0 {opening=clamp(opening+dt*1.3,0,1)} else {opening=0}}
   x+=opening*900; ghost=opening*70
  }
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
    `onStart => {for {waitNextFrame(); if checkpoint>=${i} {setGraphicEffect BrightnessEffect,8+sin(worldTime*2)*4} else {setGraphicEffect BrightnessEffect,-25}}}`,
  );
}
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
  "onStart => {for {waitNextFrame(); if segment==1 && bossShield>0 {show; setXYpos enemyX[10],enemyY[10]; setHeading 90+worldTime*10} else {hide}}}",
);
const enemyImages = {};
for (let i = 0; i < 3; i++)
  enemyImages["kind" + i] = await png(`art/belfry/frames/${i}.png`, 512);
sprite(
  "Enemy",
  enemyImages,
  { visible: false, rotationStyle: "normal" },
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
  },
  { visible: false },
  "onCloned data => {i:=data.(int); for {waitNextFrame(); if enemyHP[i]>0 && enemyState[i]==1 {show; setXYpos enemyX[i],enemyY[i]; setSize 0.7; if enemyType[i]==3 {setSize 1.9}} else {hide}}}",
);
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
  "onStart => {for {waitNextFrame(); if segment==2 {show; setXYpos Hero.px-35,Hero.py+62+sin(worldTime*3)*7; setSize 0.36} else {hide}}}",
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
  "onStart => {for {waitNextFrame(); i:=Hero.target; if phase==1 && i>=0 && Hero.hook<0 {show; if i<len(anchorX) {setXYpos anchorX[i],anchorY[i]} else {j:=i-len(anchorX); setXYpos enemyX[j],enemyY[j]}; setSize 0.85+sin(worldTime*5)*0.04} else {hide}}}",
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
  "onStart => {for {waitNextFrame(); setXYpos 480+sin(worldTime*0.07)*30,cameraY+sin(worldTime*0.11)*50}}",
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
  "onStart => {for {waitNextFrame(); setXYpos 480+sin(worldTime*0.1)*85,cameraY+sin(worldTime*0.18)*28}}",
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
 anchorX=${floats(anchors.map((a) => a[0]))}; anchorY=${floats(anchors.map((a) => a[1]))}
 floorX=${floats(platforms.map((a) => a[0]))}; floorW=${floats(platforms.map((a) => a[1]))}; floorY=${floats(platforms.map((a) => a[2]))}; floorKind=${ints(platforms.map((a) => a[3]))}
 enemyBaseX=${floats(enemies.map((a) => a[0]))}; enemyBaseY=${floats(enemies.map((a) => a[1]))}; enemyX=${floats(enemies.map((a) => a[0]))}; enemyY=${floats(enemies.map((a) => a[1]))}; enemyType=${ints(enemies.map((a) => a[2]))}
 enemyHP=${ints(enemies.map(() => 0))}; enemyState=${ints(enemies.map(() => 0))}; enemyClock=${floats(enemies.map(() => 0))}; enemyFlash=${floats(enemies.map(() => 0))}
 echoX=${floats(echoes.map((a) => a[0]))}; echoY=${floats(echoes.map((a) => a[1]))}; echoTaken=${ints(echoes.map(() => 0))}
 checkpointX=${floats(checkpoints.map((a) => a[0]))}; checkpointY=${floats(checkpoints.map((a) => a[1]))}
}
`;
files["main.spx"] = (await code("main")).replace(
  "func dist(",
  initialization + "func dist(",
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
