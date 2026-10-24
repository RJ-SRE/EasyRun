import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { chromium } from "@playwright/test";
import {
  platforms,
  walls,
  anchors,
  pistons,
  relics,
  checkpoints,
  rooms,
} from "./passages-level.mjs";
const root = new URL("./", import.meta.url),
  files = {},
  zorder = [];
const svg = (w, h, c) => ({
  w,
  h,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${c}</svg>`,
});
const code = (n) => readFile(new URL(`spx/passages/${n}.spx`, root), "utf8");
async function png(path, width) {
  const b = await readFile(new URL(path, root));
  const w = b.readUInt32BE(16),
    h = b.readUInt32BE(20);
  return { binary: b, w, h, res: w / width };
}
function sprite(n, images, config = {}, source = "") {
  const costumes = [];
  for (const [key, im] of Object.entries(images)) {
    const ext = im.binary ? "png" : "svg",
      path = `assets/sprites/${n}/${key}.${ext}`;
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
  files[`assets/sprites/${n}/index.json`] = JSON.stringify({
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
  files[n + ".spx"] = source;
  zorder.push(n);
}
await mkdir(new URL("art/passages/imported/", root), { recursive: true });
// Rebuild only this module's action cells; do not touch combat's imported assets.
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage();
  // Import directly from tracked source atlases into this module's own directory.
  // A clean checkout does not need combat builds or their generated frame folders.
  for (const [name, path, columns, normalize] of [
    ["hero", "art/rupture-v2/wanderer-atlas.png", 3, 0],
    ["run", "art/rupture-v2/run-cycle-v3.png", 4, 418],
  ]) {
    const source = await readFile(new URL(path, root));
    const cells = await page.evaluate(
      async ({ uri, columns, normalize }) => {
        const im = new Image();
        im.src = uri;
        await im.decode();
        const cells = [];
        for (let i = 0; i < columns * 3; i++) {
          const l = Math.round(((i % columns) * im.width) / columns),
            r = Math.round((((i % columns) + 1) * im.width) / columns),
            t = Math.round((Math.floor(i / columns) * im.height) / 3),
            b = Math.round(((Math.floor(i / columns) + 1) * im.height) / 3);
          const c = document.createElement("canvas");
          c.width = normalize || r - l;
          c.height = normalize || b - t;
          c.getContext("2d").drawImage(
            im,
            l,
            t,
            r - l,
            b - t,
            0,
            0,
            c.width,
            c.height,
          );
          cells.push(c.toDataURL("image/png").split(",")[1]);
        }
        return cells;
      },
      {
        uri: "data:image/png;base64," + source.toString("base64"),
        columns,
        normalize,
      },
    );
    for (let i = 0; i < cells.length; i++)
      await writeFile(
        new URL(`art/passages/imported/${name}-${i}.png`, root),
        Buffer.from(cells[i], "base64"),
      );
  }
  const source = await readFile(new URL("art/belfry/actions-source.png", root));
  const frames = await page.evaluate(
    async (uri) => {
      const im = new Image();
      im.src = uri;
      await im.decode();
      const out = [];
      for (let k = 0; k < 8; k++) {
        const l = Math.round(((k % 4) * im.width) / 4),
          r = Math.round((((k % 4) + 1) * im.width) / 4),
          t = k < 4 ? 0 : 495,
          b = k < 4 ? 495 : im.height,
          c = document.createElement("canvas");
        c.width = c.height = 418;
        const scale = 418 / 500;
        c.getContext("2d").drawImage(
          im,
          l,
          t,
          r - l,
          b - t,
          (418 - (r - l) * scale) / 2,
          0,
          (r - l) * scale,
          (b - t) * scale,
        );
        out.push(c.toDataURL("image/png").split(",")[1]);
      }
      return out;
    },
    "data:image/png;base64," + source.toString("base64"),
  );
  for (let i = 0; i < frames.length; i++)
    await writeFile(
      new URL(`art/passages/imported/action-${i}.png`, root),
      Buffer.from(frames[i], "base64"),
    );
} finally {
  await browser.close();
}
const bg = await png("art/belfry/clockwell.png", 1510);
sprite(
  "Architecture",
  { scene: bg },
  {},
  "onStart => {for {waitNextFrame(); setXYpos cameraX+sin(cameraX*0.001)*55,cameraY}}",
);
sprite(
  "Grade",
  {
    shade: svg(
      1100,
      740,
      '<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#071420" stop-opacity=".18"/><stop offset="1" stop-color="#070b10" stop-opacity=".6"/></linearGradient></defs><path d="M0 0h1100v740H0z" fill="url(#g)"/>',
    ),
  },
  {},
  "onStart => {for {waitNextFrame(); setXYpos cameraX,cameraY}}",
);
function gear(radius) {
  let c = `<circle cx="${radius}" cy="${radius}" r="${radius - 15}" fill="#101c22" fill-opacity=".5" stroke="#987b4b" stroke-width="10"/><circle cx="${radius}" cy="${radius}" r="${radius - 32}" fill="none" stroke="#c3ac78" stroke-width="1"/>`;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      x = Math.cos(a),
      y = Math.sin(a);
    c += `<path d="M${radius + x * 35} ${radius + y * 35}L${radius + x * (radius - 38)} ${radius + y * (radius - 38)}" stroke="#8c7956" stroke-width="7"/><circle cx="${radius + x * (radius - 16)}" cy="${radius + y * (radius - 16)}" r="5" fill="#19252b" stroke="#cab47c"/>`;
  }
  return svg(
    radius * 2,
    radius * 2,
    c +
      `<circle cx="${radius}" cy="${radius}" r="31" fill="#0c161e" stroke="#b69c68" stroke-width="3"/>`,
  );
}
for (let i = 0; i < rooms.length; i++) {
  const r = rooms[i];
  sprite(
    "Wheel" + i,
    { gear: gear(i === 2 ? 270 : 190) },
    { x: r.x + r.w * 0.5, y: r.y + r.h * 0.45, rotationStyle: "normal" },
    `onStart => {for {waitNextFrame(); setHeading 90+worldTime*${i % 2 ? 2 : -2}; setGraphicEffect GhostEffect,55}}`,
  );
  // Ribbed structural frame gives each room a tangible scale and an exit silhouette.
  const w = r.w,
    h = r.h;
  let body = `<path d="M8 ${h}V35L38 8h${w - 76}l30 27v${h - 35}" fill="none" stroke="#a28a5d" stroke-opacity=".28" stroke-width="12"/>`;
  for (let x = 55; x < w; x += 160)
    body += `<path d="M${x} 10v${h}" stroke="#aebaa6" stroke-opacity=".09" stroke-width="2"/>`;
  sprite(
    "Frame" + i,
    { frame: svg(w, h, body) },
    { x: r.x + w / 2, y: r.y + h / 2 },
  );
}
const ledge = await png("art/belfry/ledge.png", 1983);
ledge.pivotY = 315;
sprite(
  "Ledge",
  { deck: ledge },
  { visible: false },
  `onCloned data => {i:=data.(int); for {waitNextFrame(); if floorActive(i) {show; setXYpos floorX[i]+floorW[i]/2,floorY[i]; setSize floorW[i]/1983; ghost:=0.0; if floorKind[i]==1 && checkpoint==0 && foldTime<3 {ghost=20+sin(worldTime*16)*18}; setGraphicEffect GhostEffect,ghost} else {hide}}}`,
);
// Wall tiles are authored individually for correct aspect ratios, no texture stretching.
for (let i = 0; i < walls.length; i++) {
  const [x, y, w, h, kind, gate] = walls[i];
  let c =
    '<defs><linearGradient id="w"><stop stop-color="#10191f"/><stop offset=".7" stop-color="#394447"/><stop offset="1" stop-color="#b59b6b"/></linearGradient></defs><rect width="' +
    w +
    '" height="' +
    h +
    '" fill="url(#w)"/>';
  for (let yy = 0; yy < h; yy += 50)
    c += `<path d="M3 ${yy + 5}h${w - 6}m-${w - 9} 4h${w - 12}" stroke="#aa9873" stroke-width="${kind ? 1 : 3}" opacity=".6"/>`;
  if (gate >= 0)
    c += `<path d="M${w / 2} 0v${h}" stroke="#e4b576" stroke-width="5" stroke-dasharray="10 12"/>`;
  sprite(
    "WallArt" + i,
    { wall: svg(w, h, c) },
    { x: x + w / 2, y: y + h / 2 },
    `onStart => {for {waitNextFrame(); if wallActive(${i}) {show} else {hide}}}`,
  );
}
const rings = {
  anchor: svg(
    90,
    90,
    '<circle cx="45" cy="45" r="32" fill="#101c22" fill-opacity=".6" stroke="#c3b68b" stroke-width="3"/><circle cx="45" cy="45" r="22" fill="none" stroke="#f7e5af" stroke-width="2"/><path d="M45 5v12m0 56v12M5 45h12m56 0h12" stroke="#dfca94" stroke-width="2"/>',
  ),
  valve: svg(
    100,
    100,
    '<path d="M20 12h60l8 8v60l-8 8H20l-8-8V20z" fill="#17262b" stroke="#957f50" stroke-width="3"/><circle cx="50" cy="50" r="26" fill="#101a20" stroke="#e6b967" stroke-width="5"/><path d="M50 24v52M24 50h52" stroke="#e6b967" stroke-width="3"/><circle cx="50" cy="50" r="7" fill="#f8db99"/>',
  ),
  rail: svg(
    90,
    90,
    '<path d="M45 5l40 40-40 40L5 45z" fill="#17262b" stroke="#8bd4c7" stroke-width="2"/><circle cx="45" cy="45" r="24" fill="none" stroke="#d8fff0" stroke-width="3"/>',
  ),
};
sprite(
  "Anchor",
  rings,
  { visible: false, rotationStyle: "normal" },
  `onCloned data => {i:=data.(int); setCostume anchorKind[i]; setSize 0.8; for {waitNextFrame(); show; setXYpos anchorX[i],anchorY[i]; glow:=0.0; if Hero.target==i {glow=20}; if anchorKind[i]==1 {if switchDone[anchorMode[i]]>0 {glow=10}; setHeading 90+worldTime*8}; setGraphicEffect BrightnessEffect,glow}}`,
);
for (let i = 0; i < 2; i++)
  sprite(
    "Track" + i,
    {
      rail: svg(
        520,
        75,
        '<path d="M0 38h520" stroke="#394846" stroke-width="16"/><path d="M0 33h520m-520 10h520" stroke="#b6a374" stroke-width="2"/><path d="M0 10v55m65-55v55m65-55v55m65-55v55m65-55v55m65-55v55m65-55v55m65-55v55m65-55v55" stroke="#74847c" stroke-width="2"/>',
      ),
    },
    { x: i ? 4720 : 4210, y: i ? -620 : -660 },
  );
const ramCostumes = {};
// Keep the damaging ram 60 units high at every extension, matching its collider.
for (let length = 20; length <= 340; length += 10) {
  ramCostumes[String(length)] = svg(
    length,
    60,
    `<defs><linearGradient id="p" x2="0" y2="1"><stop stop-color="#d6b57b"/><stop offset=".5" stop-color="#394347"/><stop offset="1" stop-color="#9b875f"/></linearGradient></defs><rect x="1" y="1" width="${length - 2}" height="58" fill="url(#p)" stroke="#f0bd77" stroke-width="2"/><path d="M${length - 9} 8v44M${length - 15} 8v44" stroke="#111d24" stroke-width="4"/>`,
  );
}
sprite(
  "Piston",
  ramCostumes,
  { visible: false, rotationStyle: "left-right" },
  `onCloned data => {i:=data.(int); for {waitNextFrame(); show; setXYpos pistonX[i]+pistonDir[i]*pistonLength[i]/2,pistonY[i]; setHeading pistonDir[i]*90; setCostume int((pistonLength[i]-20)/10); glow:=0.0; if pistonState[i]==1 {glow=35+sin(worldTime*24)*25}; setGraphicEffect BrightnessEffect,glow}}`,
);
for (let i = 0; i < pistons.length; i++) {
  const [x, y, travel, dir] = pistons[i];
  const reach = travel + 20;
  sprite(
    "Warning" + i,
    {
      path: svg(
        reach,
        70,
        `<path d="M0 35h${reach}" stroke="#e9a26a" stroke-width="2" stroke-dasharray="10 9"/><path d="M0 5h${reach}v60H0z" fill="#db9560" fill-opacity=".05"/>`,
      ),
    },
    { x: x + (dir * reach) / 2, y, visible: false },
    `onStart => {for {waitNextFrame(); if pistonState[${i}]==1 {show} else {hide}}}`,
  );
}
// Counterweight cables and wind fins make mechanism motion observable at a distance.
for (const x of [2987, 3387])
  sprite(
    "Cable" + x,
    {
      line: svg(
        20,
        900,
        '<path d="M7 0v900m6-900v900" stroke="#aa9569" stroke-width="2"/><path d="M5 0h10m-10 15h10m-10 15h10" stroke="#e2c795"/>',
      ),
    },
    { x, y: -1030 },
  );
sprite(
  "Wind",
  {
    column: svg(
      200,
      1660,
      '<defs><linearGradient id="f" x2="0" y2="1"><stop stop-color="#a3eddd" stop-opacity="0"/><stop offset=".6" stop-color="#a3eddd" stop-opacity=".12"/><stop offset="1" stop-color="#a3eddd" stop-opacity=".3"/></linearGradient></defs><path d="M0 0h200v1660H0z" fill="url(#f)"/>' +
        Array.from(
          { length: 13 },
          (_, i) =>
            `<path d="M65 ${i * 125 + 80}l35-25 35 25" stroke="#c4f8df" stroke-width="2" opacity=".35"/>`,
        ).join(""),
    ),
  },
  { x: 5550, y: -100, visible: false },
  "onStart => {for {waitNextFrame(); if switchDone[4]>0 {show; ghost:=75.0; if windStage==2 {ghost=10}; if windStage==1 {ghost=45}; setGraphicEffect GhostEffect,ghost; setXYpos 5550,-100+sin(worldTime*3)*15} else {hide}}}",
);
for (const y of [-860, -430, 0, 430])
  sprite(
    "Vent" + String(y).replace("-", "N"),
    { fan: gear(63) },
    { x: 5550, y, rotationStyle: "normal" },
    "onStart => {for {waitNextFrame(); speed:=20.0; if windStage==2 {speed=260}; setHeading 90+worldTime*speed}}",
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
  ...(await png(`art/passages/imported/hero-${i}.png`, 82)),
  pivotX: registration[i][0],
  pivotY: registration[i][1],
});
const hero = { idle: await heroFrame(0) },
  runReg = [
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
    ...(await png(`art/passages/imported/run-${i}.png`, 82)),
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
    ...(await png(`art/passages/imported/action-${i}.png`, 82)),
    pivotX: 24 + (actionReg[i][0] * 418) / 500,
    pivotY: (actionReg[i][1] * 418) / 500,
  };
sprite(
  "Rope",
  {
    chain: svg(
      25,
      6,
      '<path d="M0 3h25" stroke="#a48754" stroke-width="4"/><path d="M0 2h25" stroke="#e5edc0"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  `onCloned data => {i:=data.(int); for {waitNextFrame(); if Hero.hook>=0 {show; ax:=Hero.px+Hero.facing/90*12; ay:=Hero.py+40; dx:=Hero.hookX-ax; dy:=Hero.hookY-ay; t:=(float64(i)+0.5)/18; setXYpos ax+dx*t,ay+dy*t; setHeading angle(dx,dy); setSize dist(dx,dy)/18/25+0.03} else {hide}}}`,
);
for (const n of ["Trail", "PoseBlend"])
  sprite(
    n,
    hero,
    { visible: false, rotationStyle: "left-right" },
    await code(n),
  );
sprite(
  "Hero",
  hero,
  { x: 190, y: 0, rotationStyle: "left-right" },
  await code("Hero"),
);
sprite(
  "Target",
  {
    target: svg(
      110,
      110,
      '<path d="M9 28V9h19m54 0h19v19m0 54v19H82m-54 0H9V82" fill="none" stroke="#e6f6d5" stroke-width="2"/>',
    ),
  },
  { visible: false },
  "onStart => {for {waitNextFrame(); if phase==1 && Hero.target>=0 {show; setXYpos anchorX[Hero.target],anchorY[Hero.target]; setSize 0.72+Hero.pull*0.4} else {hide}}}",
);
sprite(
  "Relic",
  {
    shard: svg(
      45,
      65,
      '<path d="M22 5l14 27-14 28L8 32z" fill="#e2cf9d"/><path d="M22 0l21 32-21 32L1 32z" fill="none" stroke="#f3db9b"/>',
    ),
  },
  { visible: false },
  "onCloned data => {i:=data.(int); for {waitNextFrame(); if relicTaken[i]==0 {show; setXYpos relicX[i],relicY[i]+sin(worldTime*2+float64(i))*5; setSize 0.65} else {hide}}}",
);
for (let i = 0; i < checkpoints.length; i++) {
  const [x, y] = checkpoints[i];
  sprite(
    "Beacon" + i,
    {
      lamp: svg(
        70,
        100,
        '<path d="M35 2v20m-20 0h40M12 85V33l23-12 23 12v52z" fill="#18282c" stroke="#bdb38a" stroke-width="2"/><path d="M35 35v34" stroke="#e4f9cd" stroke-width="5"/><path d="M4 90h62" stroke="#b5a580" stroke-width="4"/>',
      ),
    },
    { x: x - 60, y: y + 50 },
    `onStart => {for {waitNextFrame(); glow:=0.0; if checkpoint>=${i} {glow=20}; setGraphicEffect BrightnessEffect,glow}}`,
  );
}
sprite(
  "Exit",
  {
    arch: svg(
      150,
      250,
      '<path d="M5 250V70Q75-20 145 70v180" fill="#0a181f" stroke="#cfb77e" stroke-width="8"/><path d="M25 250V78Q75 13 125 78v172" fill="#c0e9cf" fill-opacity=".12" stroke="#aac9b7" stroke-width="2"/><path d="M75 35v170m-20-22 20 22 20-22" fill="none" stroke="#e6f9cb" stroke-width="3"/>',
    ),
  },
  { x: 5800, y: 675 },
);
sprite(
  "Particle",
  {
    light: svg(30, 6, '<path d="M0 3l26-2 4 2-4 2z" fill="#bce9d7"/>'),
    gold: svg(18, 6, '<path d="M0 3l15-2 3 2-3 2z" fill="#eed09c"/>'),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Particle"),
);
sprite(
  "Pulse",
  {
    mint: svg(
      150,
      150,
      '<circle cx="75" cy="75" r="64" fill="none" stroke="#b0e9d0" stroke-width="2"/>',
    ),
    gold: svg(
      150,
      150,
      '<circle cx="75" cy="75" r="64" fill="none" stroke="#f3d99a" stroke-width="3"/>',
    ),
  },
  { visible: false },
  await code("Pulse"),
);
let dust = "";
for (let i = 0; i < 55; i++)
  dust += `<circle cx="${(i * 179) % 1100}" cy="${(i * 97) % 800}" r="${i % 5 ? 0.7 : 1.5}" fill="#dec996" opacity=".25"/>`;
sprite(
  "Dust",
  { dust: svg(1100, 800, dust) },
  {},
  "onStart => {for {waitNextFrame(); setXYpos cameraX+sin(worldTime*0.1)*20,cameraY+cos(worldTime*0.15)*20}}",
);
const floats = (a) => "[]float64{" + a.join(",") + "}",
  ints = (a) => "[]int{" + a.join(",") + "}";
let init = "func initLevel() {\n";
const group = (data, columns) => {
  for (const [name, col, type] of columns)
    init += ` ${name}=${(type === "i" ? ints : floats)(data.map((r) => r[col]))}\n`;
};
group(platforms, [
  ["floorX", 0],
  ["floorY", 1],
  ["floorBaseY", 1],
  ["floorW", 2],
  ["floorKind", 3, "i"],
]);
init += ` floorDelta=${floats(platforms.map(() => 0))}\n`;
group(walls, [
  ["wallX", 0],
  ["wallY", 1],
  ["wallW", 2],
  ["wallH", 3],
  ["wallKind", 4, "i"],
  ["wallGate", 5, "i"],
]);
group(anchors, [
  ["anchorX", 0],
  ["anchorBaseX", 0],
  ["anchorY", 1],
  ["anchorKind", 2, "i"],
  ["anchorMode", 3, "i"],
]);
init += " switchDone=[]int{0,0,0,0,0}\n";
group(pistons, [
  ["pistonX", 0],
  ["pistonY", 1],
  ["pistonReach", 2],
  ["pistonDir", 3],
  ["pistonPhase", 4],
]);
init += ` pistonLength=${floats(pistons.map(() => 20))}; pistonState=${ints(pistons.map(() => 0))}\n`;
group(relics, [
  ["relicX", 0],
  ["relicY", 1],
]);
init += ` relicTaken=${ints(relics.map(() => 0))}\n`;
group(checkpoints, [
  ["checkpointX", 0],
  ["checkpointY", 1],
]);
init += "}\n";
files["main.spx"] = (await code("main")).replace(
  "func dist(",
  init + "func dist(",
);
files["assets/index.json"] = JSON.stringify({
  map: { width: 18000, height: 12000 },
  run: { width: 960, height: 600 },
  maxFPS: 60,
  physics: false,
  zorder,
});
for (const [path, v] of Object.entries(files)) {
  const dest = new URL("projects/passages/" + path, root);
  await mkdir(new URL(".", dest), { recursive: true });
  await writeFile(dest, v.$binary ? Buffer.from(v.$binary, "base64") : v);
}
await writeFile(new URL("public/passages.json", root), JSON.stringify(files));
await writeFile(
  new URL("public/passages-map.json", root),
  JSON.stringify({ rooms, platforms, walls, anchors, relics }),
);
console.log(
  `Passages built: ${zorder.length} sprites, ${Object.keys(files).length} files`,
);
