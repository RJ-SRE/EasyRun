import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";

const root = new URL("./", import.meta.url),
  files = {};
await mkdir(new URL("public/art/", root), { recursive: true });
await copyFile(
  new URL("art/rupture-v2/storm-city.png", root),
  new URL("public/art/storm-city.png", root),
);
const svg = (w, h, content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${content}</svg>`;
const zorder = [];
function sprite(name, images, config = {}, code = "") {
  const costumes = [];
  for (const [key, image] of Object.entries(images)) {
    const ext = image.binary ? "png" : "svg",
      path = `assets/sprites/${name}/${key}.${ext}`;
    files[path] = image.binary
      ? { $binary: image.binary.toString("base64") }
      : image.svg;
    costumes.push({
      name: key,
      path: `${key}.${ext}`,
      x: image.pivotX ?? image.w / 2,
      y: image.pivotY ?? image.h / 2,
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
  files[name + ".spx"] = code;
  zorder.push(name);
}
function vector(w, h, content) {
  return { w, h, svg: svg(w, h, content) };
}
async function bitmap(path, width) {
  const binary = await readFile(new URL(path, root)),
    w = binary.readUInt32BE(16),
    h = binary.readUInt32BE(20);
  return { w, h, binary, res: w / width };
}
const code = (name) =>
  readFile(new URL(`spx/rupture/${name}.spx`, root), "utf8");
// Registration metadata, not altered artwork: align the pelvis and foot plane
// across the atlas so changing a costume does not teleport the character.
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
async function heroFrame(i) {
  return {
    ...(await bitmap(`art/rupture-v2/frames/${i}.png`, 84)),
    pivotX: registration[i][0],
    pivotY: registration[i][1],
  };
}

function deck(w, h = 180, thin = false) {
  let s = `<defs><linearGradient id="metal" x2="0" y2="1"><stop stop-color="#475052"/><stop offset=".2" stop-color="#292e31"/><stop offset="1" stop-color="#0b1118"/></linearGradient></defs><path d="M0 4L${w} 0v23l-18 16H16L0 29z" fill="url(#metal)"/><path d="M0 4L${w} 0" stroke="#c3bca8" stroke-width="3"/><path d="M6 14h${w - 12}" stroke="#20262a" stroke-width="3"/>`;
  for (let x = 12; x < w - 12; x += 37)
    s += `<path d="M${x} 7v12m4-11v10" stroke="#87908a" opacity=".4"/><circle cx="${x + 9}" cy="27" r="2" fill="#9a8b70"/>`;
  for (let x = 0; x < w - 40; x += 96) {
    if (!thin)
      s += `<path d="M${x + 10} 32L${x + 65} ${h - 28}M${x + 90} 32L${x + 65} ${h - 28}" fill="none" stroke="#171f26" stroke-width="16"/><path d="M${x + 10} 32L${x + 65} ${h - 28}" stroke="#596267" stroke-width="2"/><path d="M${x + 44} ${h - 70}l27 18" stroke="#846342" opacity=".5" stroke-width="3"/>`;
    s += `<path d="M${x + 18} 17h23l-4 5h-16z" fill="#9c714c" opacity=".5"/>`;
  }
  if (!thin)
    s += `<path d="M4 ${h - 22}h${w - 8}" stroke="#121b22" stroke-width="12"/><path d="M7 ${h - 28}h${w - 14}" stroke="#414b50" stroke-width="2"/>`;
  for (let i = 0; i < Math.floor(w * 0.8); i++) {
    const x = (i * 73.73) % w,
      y = 5 + ((i * 37.17) % 32);
    s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(1 + (i % 7)).toFixed(1)} -.5" stroke="${i % 3 === 0 ? "#d3c4a1" : "#0c1218"}" stroke-width="${i % 3 === 0 ? 0.6 : 1}" opacity=".24"/>`;
  }
  return vector(w, h, s);
}

const storm = await bitmap("art/rupture-v2/storm-city.png", 1450);
sprite(
  "Atmosphere",
  { storm },
  { x: 622, y: 20 },
  `onStart => {for {waitNextFrame(); setXYpos cameraX*0.88+200,20}}`,
);
sprite(
  "Haze",
  {
    mist: vector(
      1600,
      600,
      '<defs><radialGradient id="mist"><stop stop-color="#8eabae" stop-opacity=".12"/><stop offset="1" stop-color="#8eabae" stop-opacity="0"/></radialGradient></defs><ellipse cx="550" cy="360" rx="620" ry="130" fill="url(#mist)"/><ellipse cx="1300" cy="260" rx="500" ry="105" fill="url(#mist)"/>',
    ),
  },
  {},
  "onStart => {for {waitNextFrame(); setXYpos cameraX+sin(worldTime*0.08)*90,-45+sin(worldTime*0.19)*16}}",
);
// Distant suspended cables move more slowly than the traversable structure.
let cables = "";
for (let i = 0; i < 12; i++) {
  let x = i * 320;
  cables += `<path d="M${x} 0Q${x + 160} 330 ${x + 320} 40" fill="none" stroke="#101a22" stroke-width="5" opacity=".6"/><path d="M${x + 80} 170v240" stroke="#28343c" opacity=".6"/>`;
}
sprite(
  "Rigging",
  { cables: vector(4000, 600, cables) },
  { x: 1900, y: 100 },
  `onStart => {for {waitNextFrame(); setXYpos 1900+cameraX*0.12,100}}`,
);

const ring = `<circle cx="210" cy="210" r="191" fill="#0b1219" opacity=".6"/><circle cx="210" cy="210" r="182" fill="none" stroke="#10191f" stroke-width="31"/><circle cx="210" cy="210" r="196" fill="none" stroke="#414d51" stroke-width="3"/><circle cx="210" cy="210" r="165" fill="none" stroke="#776549" stroke-width="3"/>${Array.from(
  { length: 30 },
  (_, i) => {
    let a = (i * Math.PI * 2) / 30;
    return `<circle cx="${210 + 181 * Math.cos(a)}" cy="${210 + 181 * Math.sin(a)}" r="3.5" fill="#626a62"/><path d="M${210 + 202 * Math.cos(a)} ${210 + 202 * Math.sin(a)}l${Math.cos(a) * 8} ${Math.sin(a) * 8}" stroke="#303c42" stroke-width="6"/>`;
  },
).join("")}`;
sprite(
  "TurbineHousing",
  { housing: vector(420, 420, ring) },
  { x: 1000, y: -40 },
);
sprite(
  "Turbine",
  { rotor: await bitmap("art/rupture-v2/turbine.png", 365) },
  { x: 1000, y: -40, rotationStyle: "normal" },
  `onStart => {for {waitNextFrame(); setHeading rotorAngle+90}}`,
);
sprite(
  "LockLight",
  {
    light: vector(
      370,
      370,
      '<circle cx="185" cy="185" r="164" stroke="#a5e9dc" stroke-width="2" fill="none" opacity=".9"/><circle cx="185" cy="185" r="172" stroke="#a5e9dc" stroke-width="6" stroke-dasharray="8 30" fill="none" opacity=".35"/>',
    ),
  },
  { x: 1000, y: -40, visible: false },
  `onStart => {for {waitNextFrame(); if rotorCool>0 {show} else {hide}}}`,
);

const floor = [
  [0, 670, -150],
  [1340, 640, -100],
  [2220, 220, 40],
  [2530, 80, -40],
  [2680, 720, -150],
];
for (let i = 0; i < floor.length; i++) {
  const [x, w, y] = floor[i],
    h = w < 300 ? 56 : 180;
  sprite(
    "Deck" + i,
    { deck: deck(w, h, w < 300) },
    { x: x + w / 2, y: y - h / 2 },
  );
}
sprite(
  "Bridge",
  { deck: deck(670, 56, true) },
  { x: 1005, y: -178 },
  `onStart => {for {waitNextFrame(); sway:=0.0; if bridgeBroken && bridgeDelay>0 {sway=sin(worldTime*49)*1.4}; setXYpos 1005+sway,bridgeY-28}}`,
);
let liftFrame =
  '<path d="M18 0v650m204-650v650" stroke="#10191f" stroke-width="20"/><path d="M20 0v650m204-650v650" stroke="#657174" stroke-width="3"/>';
for (let y = 0; y < 650; y += 30)
  liftFrame += `<path d="M2 ${y}h31m176 0h31" stroke="#7b7565" stroke-width="4"/>`;
sprite(
  "LiftFrame",
  { frame: vector(240, 650, liftFrame) },
  { x: 2160, y: -10 },
);
sprite(
  "Lift",
  {
    moving: deck(180, 70, true),
    frozen: vector(
      180,
      70,
      deck(180, 70, true)
        .svg.replace(/^.*?<svg[^>]*>/, "")
        .replace("</svg>", "") +
        '<path d="M10 6h160" stroke="#b3ffe7" stroke-width="4"/>',
    ),
  },
  { x: 2160, y: -190 },
  `onStart => {for {waitNextFrame(); setXYpos 2160,liftY-35; if liftCool>0 {setCostume "frozen"} else {setCostume "moving"}}}`,
);

sprite(
  "Echo",
  {
    echo: vector(
      40,
      60,
      '<path d="M20 6l9 20-9 21-9-21z" fill="#e0b47b"/><path d="M20 0l16 27-16 29L4 27z" fill="none" stroke="#cfbd91" stroke-width="1" opacity=".6"/>',
    ),
  },
  { x: 2350, y: 90 },
  `onStart => {for {waitNextFrame(); if styleCount>0 {hide} else {show; setXYpos 2350,90+sin(worldTime*2)*5}}}`,
);
sprite(
  "Exit",
  {
    beacon: vector(
      200,
      330,
      '<path d="M62 330V50l38-30 38 30v280" fill="#151d23" stroke="#6b726e" stroke-width="4"/><path d="M77 330V65h46v265" fill="#bd8250" opacity=".16"/><path d="M82 70v255m36-255v255" stroke="#e6b47c" stroke-width="3"/><path d="M93 85h14v200H93z" fill="#efc384" opacity=".4"/><path d="M65 43h70M50 330h100" stroke="#887b65" stroke-width="6"/>',
    ),
  },
  { x: 3260, y: 15 },
);
sprite(
  "Trail",
  { ghost: await heroFrame(8) },
  { visible: false },
  await code("Trail"),
);
const hero = { idle: await heroFrame(0) };
const runRegistration = [
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
for (let i = 0; i < 12; i++) {
  const frame = await bitmap(`art/rupture-v2/run-frames/${i}.png`, 84);
  hero["run" + i] = {
    ...frame,
    pivotX: (runRegistration[i][0] * 418) / 362,
    pivotY: (runRegistration[i][1] * 418) / 362,
  };
}
hero.jump = await heroFrame(7);
hero.dash = await heroFrame(8);
hero.fall = { ...(await heroFrame(6)), pivotY: 405 };
hero.land = { ...(await heroFrame(5)), pivotY: 401 };
sprite(
  "ContactShadow",
  {
    shadow: vector(
      60,
      12,
      '<defs><radialGradient id="s"><stop stop-color="#050b11" stop-opacity=".8"/><stop offset="1" stop-color="#050b11" stop-opacity="0"/></radialGradient></defs><ellipse cx="30" cy="6" rx="30" ry="6" fill="url(#s)"/>',
    ),
  },
  {},
  "onStart => {for {waitNextFrame(); if Hero.grounded {show; setXYpos Hero.px,Hero.py-2} else {hide}}}",
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
  { x: 150, y: -112, rotationStyle: "left-right" },
  await readFile(new URL("spx/rupture/Hero.spx", root), "utf8"),
);
sprite(
  "Charge",
  {
    aura: vector(
      120,
      120,
      '<defs><radialGradient id="a"><stop stop-color="#c5ffe4" stop-opacity=".35"/><stop offset=".25" stop-color="#82d7c9" stop-opacity=".12"/><stop offset="1" stop-color="#82d7c9" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="60" r="58" fill="url(#a)"/><path d="M43 61q14-22 30-4" stroke="#d0fbea" stroke-width="1.4" opacity=".85" fill="none"/><circle cx="65" cy="52" r="2" fill="#e7fff5"/>',
    ),
  },
  { visible: false },
  `onStart => {for {waitNextFrame(); if energy>0 {show; setXYpos Hero.px+5,Hero.py+37; setSize 0.8+sin(worldTime*5)*0.07} else {hide}}}`,
);
// Effects run inside spx, so they also travel with the exported XBuilder project.
sprite(
  "Particle",
  {
    streak: vector(
      80,
      12,
      '<defs><linearGradient id="s"><stop stop-color="#8fe2d1" stop-opacity="0"/><stop offset=".6" stop-color="#b1ffdf" stop-opacity=".22"/><stop offset="1" stop-color="#effff4" stop-opacity=".65"/></linearGradient></defs><path d="M0 8Q45 3 78 5Q45 7 0 8" fill="url(#s)"/><path d="M20 7Q48 4 76 5" stroke="url(#s)" stroke-width=".8" fill="none"/>',
    ),
    spark: vector(
      22,
      10,
      '<path d="M0 5L18 3 22 5 18 7z" fill="#dc8744" opacity=".6"/><path d="M7 5h13" stroke="#ffdca1" stroke-width="1.4"/>',
    ),
    smoke: vector(
      64,
      40,
      '<defs><radialGradient id="m"><stop stop-color="#9bb5b8" stop-opacity=".22"/><stop offset="1" stop-color="#96afb4" stop-opacity="0"/></radialGradient></defs><ellipse cx="32" cy="20" rx="32" ry="20" fill="url(#m)"/>',
    ),
    water: vector(
      10,
      10,
      '<path d="M5 1Q9 6 5 9Q1 6 5 1" fill="#c4dedc" opacity=".7"/><circle cx="5" cy="3" r="1" fill="#eefbf1"/>',
    ),
    debris: vector(
      20,
      16,
      '<path d="M2 3l13-2 4 9-8 5L1 9z" fill="#454b4a"/><path d="M2 3l13-2-3 4H2" fill="#9c8a69"/><path d="M11 5l8 5-8 5" fill="#262d31"/>',
    ),
  },
  { visible: false, rotationStyle: "normal" },
  await code("Particle"),
);
sprite(
  "Pulse",
  {
    shock: vector(
      120,
      120,
      '<circle cx="60" cy="60" r="44" stroke="#7ec5be" stroke-width="7" fill="none" opacity=".12"/><circle cx="60" cy="60" r="43" stroke="#caffec" stroke-width="1.1" fill="none" opacity=".7"/><path d="M7 60h17m72 0h17M60 7v17m0 72v17" stroke="#e1fff0" opacity=".45"/>',
    ),
    wake: vector(
      120,
      24,
      '<ellipse cx="60" cy="12" rx="52" ry="7" fill="none" stroke="#bdded7" stroke-width="1.4" opacity=".5"/><ellipse cx="60" cy="12" rx="42" ry="5" fill="none" stroke="#bdded7" opacity=".2"/>',
    ),
  },
  { visible: false },
  await code("Pulse"),
);
sprite(
  "Flux",
  {
    light: vector(
      68,
      30,
      '<defs><radialGradient id="f"><stop stop-color="#d5fff2" stop-opacity=".9"/><stop offset=".23" stop-color="#91decf" stop-opacity=".38"/><stop offset="1" stop-color="#8acdbd" stop-opacity="0"/></radialGradient></defs><ellipse cx="34" cy="15" rx="34" ry="15" fill="url(#f)"/><path d="M13 15h39" stroke="#c9ffeb" stroke-width="1"/><circle cx="37" cy="15" r="2" fill="#f2fff4"/>',
    ),
  },
  { visible: false },
  await code("Flux"),
);
let rain = "";
// Repeat an exact tile in both axes: wrapping the continuous offsets is seamless.
for (let row = 0; row < 5; row++)
  for (let col = 0; col < 7; col++)
    for (let i = 0; i < 5; i++) {
      const x = col * 200 + ((i * 43) % 200),
        y = row * 200 + ((i * 71) % 200);
      rain += `<path d="M${x} ${y}l-13 29" stroke="#c6d1d0" stroke-width="${i === 0 ? 1 : 0.5}" opacity="${i === 0 ? 0.19 : 0.07}"/>`;
    }
sprite(
  "Rain",
  { rain: vector(1400, 1000, rain) },
  { x: 480, y: 0 },
  `onStart => {for {waitNextFrame(); ox:=worldTime*90; oy:=worldTime*201; ox-=float64(int(ox/200))*200; oy-=float64(int(oy/200))*200; setXYpos cameraRenderX+100-ox,cameraRenderY+100-oy}}`,
);
files["main.spx"] = await readFile(
  new URL("spx/rupture/main.spx", root),
  "utf8",
);
files["assets/index.json"] = JSON.stringify({
  map: { width: 9000, height: 1500 },
  run: { width: 960, height: 540 },
  maxFPS: 60,
  physics: false,
  autoSetCollisionLayer: true,
  zorder,
});
for (const [p, data] of Object.entries(files)) {
  const dest = new URL("projects/rupture/" + p, root);
  await mkdir(new URL(".", dest), { recursive: true });
  await writeFile(
    dest,
    data.$binary ? Buffer.from(data.$binary, "base64") : data,
  );
}
await writeFile(new URL("public/rupture.json", root), JSON.stringify(files));
console.log(
  `Built Rupture: ${Object.keys(files).length} files, ${zorder.length} sprites`,
);
