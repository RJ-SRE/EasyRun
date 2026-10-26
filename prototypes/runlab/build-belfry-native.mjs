// Rasterized native UI uses the existing game art. Hit regions and button art
// share this layout; no HTML, network fonts or web-host scripts enter the .xbp.
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { WORDS } from "./public/cet4-words.js";
import { buildNativeLexicon } from "./build-belfry-native-lexicon.mjs";
import { buildNativeWordStyle } from "./build-belfry-native-style.mjs";
const root = new URL("./", import.meta.url);
const out = new URL("projects/belfry-native/", root);
const rects = {
  1: [64, 392, 360, 52],
  2: [64, 462, 172, 32],
  3: [252, 462, 172, 32],
  4: [64, 286, 172, 48],
  5: [252, 286, 172, 48],
  6: [874, 30, 50, 28],
  7: [64, 462, 172, 32],
  8: [252, 462, 172, 32],
  9: [64, 510, 360, 40],
  10: [640, 35, 116, 32],
  11: [510, 35, 116, 32],
  12: [580, 240, 300, 32],
  13: [580, 198, 300, 32],
  14: [580, 282, 300, 32],
  15: [580, 330, 142, 36],
  16: [738, 330, 142, 36],
  17: [656, 427, 224, 22],
  18: [656, 467, 224, 22],
  19: [580, 516, 74, 30],
  20: [670, 516, 84, 30],
  21: [34, 64, 160, 28],
  22: [204, 190, 160, 30],
  23: [380, 190, 334, 30],
  24: [724, 190, 30, 30],
  25: [724, 62, 30, 30],
  26: [204, 516, 180, 30],
  27: [204, 224, 160, 30],
  28: [204, 254, 160, 30],
  29: [204, 284, 160, 30],
  30: [580, 370, 300, 28],
  31: [650, 246, 230, 40],
  32: [650, 286, 230, 40],
  33: [650, 326, 230, 40],
};
const browser = await chromium.launch({ headless: true, channel: "chromium" });
let art, lexicon;
const vectorFiles = {},
  removedFiles = [];
try {
  const page = await browser.newPage();
  // Builder's 480x360 run config can make runtime SVG rendering fail on a
  // large/high-DPI canvas. Bake the vectors at their authored size, preserving
  // pivots and sprite scale. Web builds continue to use the original SVGs.
  const sceneConfig = JSON.parse(
    await readFile(new URL("projects/belfry/assets/index.json", root), "utf8"),
  );
  for (const name of sceneConfig.zorder) {
    const folder = `assets/sprites/${name}/`,
      configPath = folder + "index.json";
    const config = JSON.parse(
      await readFile(new URL("projects/belfry/" + configPath, root), "utf8"),
    );
    let changed = false;
    for (const costume of config.costumes || []) {
      if (!costume.path.endsWith(".svg")) continue;
      const original = folder + costume.path;
      const source = await readFile(
        new URL("projects/belfry/" + original, root),
        "utf8",
      );
      const raster = await page.evaluate(async (svg) => {
        const image = new Image();
        image.src =
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        if (
          !canvas.width ||
          !canvas.height ||
          Math.max(canvas.width, canvas.height) > 4096
        )
          throw new Error("Unsupported native vector dimensions");
        canvas.getContext("2d").drawImage(image, 0, 0);
        return {
          data: canvas.toDataURL("image/png").split(",")[1],
          width: canvas.width,
          height: canvas.height,
        };
      }, source);
      costume.path = costume.path.replace(/\.svg$/, ".png");
      costume.imageWidth = raster.width;
      costume.imageHeight = raster.height;
      vectorFiles[folder + costume.path] = Buffer.from(raster.data, "base64");
      removedFiles.push(original);
      changed = true;
    }
    if (changed) vectorFiles[configPath] = JSON.stringify(config);
  }
  lexicon = await buildNativeLexicon(page, WORDS);
  const background = (
    await readFile(new URL("art/belfry/clockwell.png", root))
  ).toString("base64");
  art = await page.evaluate(
    async ({ background, rects }) => {
      const image = new Image();
      image.src = "data:image/png;base64," + background;
      await image.decode();
      const images = {};
      const C = {
        gold: "#c7b180",
        ivory: "#f2ead5",
        dim: "#9ba9a7",
        dark: "#101b20",
        line: "#5b5946",
      };
      const sans = '"PingFang SC", "Microsoft YaHei", sans-serif';
      const serif = '"Songti SC", "STSong", serif';
      let ctx;
      function canvas(name, w, h, draw) {
        const c = document.createElement("canvas");
        c.width = w * 2;
        c.height = h * 2;
        ctx = c.getContext("2d");
        ctx.scale(2, 2);
        draw();
        images[name] = { w, h, data: c.toDataURL("image/png").split(",")[1] };
      }
      function text(s, x, y, size = 16, color = C.ivory, font = sans) {
        ctx.fillStyle = color;
        ctx.font = `${size}px ${font}`;
        ctx.fillText(s, x, y);
      }
      function line(x, y, xx, yy, color = C.line) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(xx, yy);
        ctx.stroke();
      }
      function button(id, label, hint = "", selected = false, primary = false) {
        const [x, y, w, h] = rects[id];
        ctx.fillStyle = primary
          ? "#c7b180"
          : selected
            ? "#c7b18020"
            : "#08121788";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w - 9, y);
        ctx.lineTo(x + w, y + 9);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.fill();
        line(
          x,
          y + h,
          x + w,
          y + h,
          selected || primary ? C.gold : "#72847b55",
        );
        if (selected) {
          ctx.fillStyle = C.gold;
          ctx.fillRect(x, y + 12, 2, h - 24);
        }
        text(
          label,
          x + 14,
          y + (hint ? 20 : h / 2 + 5),
          primary ? 20 : 14,
          primary ? "#142128" : selected ? C.ivory : C.dim,
          primary ? serif : sans,
        );
        if (hint) text(hint, x + 14, y + 37, 10, C.dim);
        if (primary) text("↘", x + w - 35, y + h / 2 + 7, 24, "#142128");
      }
      function soundPanel(compact = false) {
        if (!compact) text("S O U N D", 580, 415, 10, C.gold);
        text("背景音乐", 580, 441, 12, C.dim);
        text("动作音效", 580, 481, 12, C.dim);
        [438, 478].forEach((y) => line(656, y, 880, y, "#65756b66"));
        if (!compact)
          text("音乐与音效独立调节 · B 静音音乐", 580, 515, 10, C.dim);
      }
      function base(painted = true, minimal = false) {
        if (painted) {
          const scale = Math.max(960 / image.width, 600 / image.height);
          ctx.drawImage(
            image,
            (960 - image.width * scale) / 2,
            (600 - image.height * scale) / 2,
            image.width * scale,
            image.height * scale,
          );
        }
        const fade = ctx.createLinearGradient(0, 0, 960, 0);
        fade.addColorStop(0, "#071116f5");
        fade.addColorStop(0.46, "#071116db");
        fade.addColorStop(1, "#07111638");
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, 960, 600);
        ctx.strokeStyle = "#b59c6540";
        line(34, 32, 150, 32, "#b59c6560");
        line(810, 568, 926, 568, "#b59c6560");
        if (!minimal) {
          text("R U P T U R E   /   裂 隙", 64, 67, 13, C.gold);
          text("THE HOLLOW BELFRY", 64, 119, 12, C.dim);
          line(64, 246, 454, 246);
        }
        ctx.save();
        ctx.translate(742, 124);
        ctx.strokeStyle = "#c7b18050";
        [46, 58, 64].forEach((r) => {
          ctx.beginPath();
          ctx.arc(0, 0, r, -0.9, 4.9);
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(0, 27);
        ctx.moveTo(-12, 15);
        ctx.lineTo(0, 27);
        ctx.lineTo(12, 15);
        ctx.stroke();
        ctx.restore();
      }
      for (let difficulty = 0; difficulty < 2; difficulty++)
        canvas("title" + difficulty, 960, 600, () => {
          base(true, true);
          text("裂", 60, 202, 90, C.ivory, serif);
          text("隙", 172, 202, 90, C.ivory, serif);
          line(64, 240, 320, 240, "#c7b18060");
          button(4, "旅人", "8 格生命 · 从容探索", difficulty === 0);
          button(5, "无畏", "5 格生命 · 紧密追击", difficulty === 1);
          button(1, "进入钟城   Enter", "", false, true);
          button(2, "排练场   T");
          button(3, "操作指南   H");
          text("远征准备", 580, 181, 15, C.gold, serif);
          button(13, "铭文");
          button(12, "词汇范围");
          button(14, "作答节奏");
          // NativeLedgerEntry reuses the web preview button.
          button(16, "换一组 ↻");
          button(30, "拼写挑战");
          soundPanel();
        });
      canvas("guide", 960, 600, () => {
        base();
        ctx.fillStyle = "#081216db";
        ctx.fillRect(492, 80, 430, 470);
        text("让坠落，成为起飞。", 62, 178, 38, C.ivory, serif);
        text("先掌握移动，再把技巧连成自己的打法。", 64, 215, 15, C.dim);
        const entries = [
          ["A / D  ·  W", "移动 · 跳跃 / 二段跳 / 蹬墙", "快速双击 S 下穿平台"],
          ["按住 O → 松开", "钩索牵引，松开甩出", "配合方向选择锚点或敌人"],
          [
            "J  ·  W + J  ·  S + J",
            "三连击 · 挑空 · 空中坠星",
            "K / Shift 冲刺；W + K 向上",
          ],
          [
            "按住 U / L → 松开",
            "贯夜蓄箭 / 断潮蓄刀",
            "蓄力中 W / S 瞄准；冷却 3 秒",
          ],
          ["I  ·  P", "回息治疗 / 五段连环剑刀", "回息冷却 3 秒；终式 5 秒"],
          ["Esc  ·  B", "暂停 / 继续 · 音乐开关", "暂停后按 M 返回开始界面"],
        ];
        entries.forEach(([key, a, b], i) => {
          const x = i < 3 ? 64 : 516,
            y = 280 + (i % 3) * 74;
          text(key, x, y, 16, C.gold);
          text(a, x, y + 22, 14);
          text(b, x, y + 41, 12, C.dim);
        });
        button(9, "返回   Enter / Esc", "", false, true);
        text(
          "铭文：拼对即释放，错字即取消；辨义 1 / 2 / 3",
          516,
          524,
          12,
          C.gold,
        );
        text("答错或超时取消技能；Esc 暂停题目", 516, 546, 12, C.dim);
      });
      for (const [name, title, subtitle, primary] of [
        ["pause", "暂停", "", "继续   Enter"],
        [
          "defeat",
          "坠落并非终点。",
          "从最近的检查点，重新找到破局的方向。",
          "检查点再战   Enter",
        ],
        [
          "victory",
          "你带回了钟心。",
          "旧城已在身后。下一次，试试另一种打法。",
          "再入钟城   Enter",
        ],
      ])
        canvas(name, 960, 600, () => {
          base(false, name === "pause");
          if (name === "pause") {
            text("暂停", 62, 278, 48, C.ivory, serif);
            line(64, 318, 424, 318, "#c7b18050");
          } else {
            text(title, 62, 180, 42, C.ivory, serif);
            text(subtitle, 64, 216, 16, C.dim);
            text(
              name === "defeat" ? "ANOTHER WAY UP" : "THE HEART RETURNS",
              64,
              305,
              13,
              C.gold,
            );
            text("钩索、站位和技能，都还有新的组合。", 64, 334, 15, C.ivory);
          }
          button(1, primary, "", false, true);
          button(7, "返回标题   M");
          button(
            name === "pause" ? 3 : 8,
            name === "pause" ? "操作指南   H" : "重新远征   R",
          );
          if (name !== "pause")
            text("O 钩索   /   W 跳跃   /   J 连击", 64, 546, 13, C.dim);
          soundPanel(name === "pause");
        });
      for (let mute = 0; mute < 2; mute++)
        canvas("music" + mute, 50, 28, () => {
          text(mute ? "静音" : "♫ B", 9, 19, 12, C.gold);
        });
      for (let n = 0; n <= 100; n++)
        canvas("volume" + n, 224, 22, () => {
          line(0, 11, 224, 11, "#65756b66");
          line(0, 11, (224 * n) / 100, 11, C.gold);
          ctx.fillStyle = C.ivory;
          ctx.beginPath();
          ctx.arc((224 * n) / 100, 11, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      for (const [id, [, , w, h]] of Object.entries(rects))
        canvas("hover" + id, w, h, () => {
          ctx.fillStyle = "#f3e8bf18";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#f3e8bf";
          ctx.lineWidth = 2;
          ctx.strokeRect(1, 1, w - 2, h - 2);
        });
      canvas("matte", 2, 2, () => {
        ctx.fillStyle = "#070e12";
        ctx.fillRect(0, 0, 2, 2);
      });
      canvas("hud", 960, 600, () => {
        const top = ctx.createLinearGradient(0, 0, 0, 100);
        top.addColorStop(0, "#071116de");
        top.addColorStop(1, "#07111600");
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, 960, 100);
        const bottom = ctx.createLinearGradient(0, 510, 0, 600);
        bottom.addColorStop(0, "#07111600");
        bottom.addColorStop(1, "#071116d9");
        ctx.fillStyle = bottom;
        ctx.fillRect(0, 510, 960, 90);
        text("THE THREADBEARER", 36, 31, 10, C.gold);
      });
      for (const max of [8, 5])
        for (let hp = 0; hp <= 8; hp++)
          canvas(`health${max}-${hp}`, 224, 28, () => {
            for (let j = 0; j < max; j++) {
              ctx.fillStyle = j < hp ? C.ivory : "#46504d";
              ctx.beginPath();
              ctx.moveTo(3 + j * 21, 4);
              ctx.lineTo(15 + j * 21, 4);
              ctx.lineTo(12 + j * 21, 20);
              ctx.lineTo(j * 21, 20);
              ctx.fill();
            }
          });
      for (const [i, label] of [
        "下潜 · 寻找钟心",
        "决战 · 击破守心者",
        "上返 · 逃离黑潮",
        "排练场 · 1—9 切换敌人",
      ].entries())
        canvas("objective" + i, 360, 34, () => {
          text(label, 0, 23, 15, C.ivory, serif);
        });
      const skills = [
        ["U", "贯夜"],
        ["L", "断潮"],
        ["I", "回息"],
        ["P", "连环剑刀"],
      ];
      skills.forEach(([key, name], i) => {
        const duration = i === 3 ? 5 : 3;
        for (let step = 0; step <= duration * 10; step++)
          canvas(`skill${i}-${step}`, 76, 28, () => {
            const cooling = step > 0;
            const shade = ctx.createLinearGradient(0, 0, 76, 0);
            shade.addColorStop(0, "#07121bea");
            shade.addColorStop(1, "#07121b88");
            ctx.fillStyle = shade;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(70, 0);
            ctx.lineTo(76, 6);
            ctx.lineTo(76, 28);
            ctx.lineTo(0, 28);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#c7b18040";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(13, 14, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = cooling ? "#a9cbb8" : C.gold;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(
              13,
              14,
              10,
              -Math.PI / 2,
              -Math.PI / 2 +
                Math.PI * 2 * (cooling ? 1 - step / (duration * 10) : 1),
            );
            ctx.stroke();
            text(key, 9, 18, 11, cooling ? C.dim : C.ivory);
            text(name, 28, 12, 10, cooling ? C.dim : C.ivory);
            if (cooling) text((step / 10).toFixed(1), 28, 24, 9, "#a9cbb8");
            else line(28, 23, 70, 23, "#c7b18080");
          });
      });
      return images;
    },
    { background, rects },
  );
  Object.assign(art, await buildNativeWordStyle(browser));
} finally {
  await browser.close();
}
const files = { ...vectorFiles, ...lexicon.files },
  zorder = [];
function sprite(
  name,
  keys,
  source,
  { x = 480, y = -100, visible = false } = {},
) {
  const costumes = keys.map((key) => {
    const im = art[key],
      path = `assets/sprites/${name}/${key}.png`;
    files[path] = Buffer.from(im.data, "base64");
    return {
      name: key,
      path: key + ".png",
      x: im.w,
      y: im.h,
      bitmapResolution: 2,
    };
  });
  files[`assets/sprites/${name}/index.json`] = JSON.stringify({
    x,
    y,
    heading: 90,
    size: 1,
    rotationStyle: "none",
    physicsMode: "no",
    collisionShapeType: "none",
    triggerShapeType: "none",
    visible,
    costumes,
    costumeIndex: 0,
  });
  files[name + ".spx"] =
    // spx marks costumes dirty even when the index is unchanged. Cache only
    // engine mutations; camera-relative placement and game logic stay live.
    `var (
 uiCostumeIndex int
 uiCostumeKnown bool
 uiScale float64
 uiScaleKnown bool
 uiX float64
 uiY float64
 uiPositionKnown bool
 uiVisible bool
 uiVisibleKnown bool
 uiLayer int
)
func uiCostume(c int) {if !uiCostumeKnown || c!=uiCostumeIndex {uiCostumeKnown=true; uiCostumeIndex=c; setCostume c}}
func uiSize(s float64) {if !uiScaleKnown || s!=uiScale {uiScaleKnown=true; uiScale=s; setSize s}}
func uiPosition(x,y float64) {if !uiPositionKnown || x!=uiX || y!=uiY {uiPositionKnown=true; uiX=x; uiY=y; setXYpos x,y}}
func uiShow() {if !uiVisibleKnown || !uiVisible {uiVisibleKnown=true; uiVisible=true; show}}
func uiHide() {if !uiVisibleKnown || uiVisible {uiVisibleKnown=true; uiVisible=false; hide}}
func uiFront() {if uiLayer!=nativeLayerVersion {uiLayer=nativeLayerVersion; setLayer Front}}
` +
    source
      .replaceAll("setCostume ", "uiCostume ")
      .replaceAll("setSize ", "uiSize ")
      .replaceAll("setXYpos ", "uiPosition ")
      .replaceAll("setLayer Front", "uiFront()")
      .replace(/\bshow\b/g, "uiShow()")
      .replace(/\bhide\b/g, "uiHide()") +
    "\nonStart => {}\nonClick => {nativeActivate(nativeActionAt(mouseX-viewCenterX+480,viewCenterY-mouseY+300))}\n";
  zorder.push(name);
}
const pin = (x, y) =>
  `setXYpos viewCenterX+${x}-480,viewCenterY+300-${y}; setLayer Front;`;
const active = "(phase==1 || phase==5) && !nativeHelp";
sprite(
  "NativeHUD",
  ["hud"],
  `func syncUI() {if ${active} {show; ${pin(480, 300)}} else {hide}}`,
);
sprite(
  "NativeHealth",
  [8, 5].flatMap((n) => Array.from({ length: 9 }, (_, i) => `health${n}-${i}`)),
  `func syncUI() {if ${active} {show; c:=int(clamp(float64(health),0,8)); if maxHealth==5 {c+=9}; setCostume c; ${pin(148, 52)}} else {hide}}`,
);
sprite(
  "NativeObjective",
  [0, 1, 2, 3].map((n) => "objective" + n),
  `func syncUI() {if ${active} {show; c:=segment; if practice==1 {c=3}; setCostume c; ${pin(710, 558)}} else {hide}}`,
);
for (const [i, cool] of [
  "bowCool",
  "bladeCool",
  "healCool",
  "ultimateCool",
].entries())
  sprite(
    "NativeSkill" + i,
    Array.from({ length: i === 3 ? 51 : 31 }, (_, n) => `skill${i}-${n}`),
    `func syncUI() {if ${active} {show; setCostume int(clamp(Hero.${cool}*10+0.999,0,${i === 3 ? 50 : 30})); ${pin(74 + i * 84, 562)}} else {hide}}`,
  );
sprite(
  "NativePanel",
  ["title0", "title1", "guide", "pause", "defeat", "victory", "wordbook"],
  `func syncUI() {if nativePanel>=0 {show; setCostume nativePanel; ${pin(480, 300)}} else {hide}}`,
  { visible: true },
);
sprite(
  "NativeMusicButton",
  ["music0", "music1"],
  `func syncUI() {if phase!=1 && phase!=5 && !nativePreview {show; c:=0; if nativeMusicMuted || nativeMusicVolume==0 {c=1}; setCostume c; ${pin(899, 44)}} else {hide}}`,
);
sprite(
  "NativeHover",
  Object.keys(rects).map((id) => "hover" + id),
  `func syncUI() {if nativeHover>0 {show; setCostume nativeHover-1; x,y,w,h:=nativeButtonRect(nativeHover); setXYpos viewCenterX+x+w/2-480,viewCenterY+300-y-h/2; setLayer Front} else {hide}}`,
);
for (const [name, volume, y] of [
  ["NativeMusicSlider", "nativeMusicVolume", 438],
  ["NativeSfxSlider", "nativeSfxVolume", 478],
])
  sprite(
    name,
    Array.from({ length: 101 }, (_, i) => "volume" + i),
    `func syncUI() {if phase!=1 && phase!=5 && !nativeHelp && !nativePreview {show; setCostume ${volume}; ${pin(768, y)}} else {hide}}`,
  );
sprite(
  "NativeQuestion",
  ["question0", "question1", "question2"],
  `func syncUI() {if phase==5 && wordPending>0 && !nativeHelp {show; c:=nativeQuestionMode; if wordVisualPaused {c=2}; setCostume c; h:=138.0; if nativeQuestionMode==1 && !wordVisualPaused {h=148}; setXYpos viewCenterX,viewCenterY+300-14-h/2+nativeFocusOffset; setLayer Front;} else {hide}}`,
);
sprite(
  "NativeQuestionTimer",
  Array.from({ length: 61 }, (_, i) => "timer" + i),
  `func syncUI() {if phase==5 && wordPending>0 && !nativeHelp {show; setSize 0.75; setCostume int(clamp((1-nativeQuestionAge/nativeQuestionLimit)*60,0,60)); setXYpos viewCenterX+308-480,viewCenterY+300-63+nativeFocusOffset; setLayer Front;} else {hide}}`,
);
sprite(
  "NativeSpellingTrack",
  Array.from({ length: 23 }, (_, i) => "spelling-track" + i),
  `func syncUI() {if phase==5 && wordPending>0 && nativeQuestionMode==0 && !wordVisualPaused && !nativeHelp {show; n:=len(nativeSpellingTarget()); setCostume int(clamp(float64(n),0,22)); setXYpos viewCenterX+498-480,viewCenterY+300-110+nativeFocusOffset; setLayer Front} else {hide}}`,
);
sprite(
  "NativeHintMenu",
  ["hint-menu"],
  `func syncUI() {if phase==0 && nativeHintOpen && !nativeHelp && !nativePreview {show; ${pin(765, 306)}} else {hide}}`,
);
sprite(
  "NativeLedgerEntry",
  ["ledger-entry"],
  `func syncUI() {if phase==0 && !nativeHelp && !nativePreview {show; ${pin(651, 348)}} else {hide}}`,
);
sprite(
  "NativeLedgerTools",
  ["ledger-search0", "ledger-search1", "ledger-search2", "ledger-search3"],
  `func syncUI() {NativeLedgerEntry.syncUI(); NativeLedgerPrevious.syncUI(); NativeLedgerNext.syncUI(); if nativePreview {show; c:=0; if nativeLedgerSearch {c=1}; if nativeLedgerQuery!="" {c+=2}; setCostume c; ${pin(547, 205)}} else {hide}}`,
);
sprite(
  "NativeLedgerFilter",
  ["ledger-filter"],
  `func syncUI() {if nativePreview && nativeLedgerFilterOpen {show; ${pin(284, 269)}} else {hide}}`,
);
sprite(
  "NativeLedgerPrevious",
  ["ledger-prev0", "ledger-prev1"],
  `func syncUI() {if nativePreview {show; c:=0; if nativePreviewPage>0 {c=1}; setCostume c; ${pin(617, 531)}} else {hide}}`,
);
sprite(
  "NativeLedgerNext",
  ["ledger-next0", "ledger-next1"],
  `func syncUI() {if nativePreview {show; c:=0; if nativePreviewPage+1<len(nativeLedgerPages) {c=1}; setCostume c; ${pin(712, 531)}} else {hide}}`,
);
for (let group = 0; group < 10; group++)
  sprite(
    "NativeLedgerTally" + group,
    Array.from({ length: 27 }, (_, i) => "ledger-tally" + i),
    `func syncUI() {if nativePreview {show; setCostume nativeLedgerTally(${group}); ${pin(229 + group * 55, 148)}} else {hide}}`,
  );
zorder.push("NativeGlyph", "NativeSfx");
for (let i = 0; i < 4; i++) {
  const offset = [
    "0,300+span/2",
    "0,-300-span/2",
    "-480-span/2,0",
    "480+span/2,0",
  ][i].split(",");
  sprite(
    "NativeMatte" + i,
    ["matte"],
    `func syncUI() {span:=max(viewWidth,viewHeight)+2048; setSize span/2; setXYpos viewCenterX+(${offset[0]}),viewCenterY+(${offset[1]}); setLayer Front; show}`,
  );
}
files["native-layout.spx"] =
  "func nativeButtonRect(action int) (float64,float64,float64,float64) {\n" +
  Object.entries(rects)
    .map(([id, rect]) => ` if action==${id} {return ${rect.join(",")}}`)
    .join("\n") +
  "\n return 0,0,0,0\n}\n";
for (const [p, content] of Object.entries(files)) {
  const dest = new URL(p, out);
  await mkdir(new URL(".", dest), { recursive: true });
  await writeFile(dest, content);
}
await writeFile(
  new URL("manifest.json", out),
  JSON.stringify(
    { files: Object.keys(files), removedFiles, zorder, rects },
    null,
    2,
  ),
);
console.log(
  `Built native Belfry shell: ${Object.keys(files).length} files / ${zorder.length} sprites`,
);
