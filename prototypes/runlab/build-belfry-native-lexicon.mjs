// Bitmap glyphs keep native Chinese text independent of system fonts and DOM.
import { Buffer } from "node:buffer";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = new URL("./", import.meta.url);
const quote = JSON.stringify;
export async function buildNativeLexicon(page, words) {
  const trim = (s) => Array.from(s).slice(0, 28).join("");
  const rows = words.map((w) => ({
    word: w.word.toLowerCase(),
    meaning: trim(w.meaning),
    a: trim(w.distractors[0]),
    b: trim(w.distractors[1]),
    aliases: w.accepted.map((x) => x.toLowerCase()).join("|"),
    level: w.levels.length === 2 ? 3 : w.levels[0] === "cet4" ? 1 : 2,
    spell: w.spellable && /^[a-z -]+$/.test(w.word.toLowerCase()) ? 1 : 0,
  }));
  const source = await readFile(
    new URL("spx/belfry/NativeWords.spx", root),
    "utf8",
  );
  const chars = [
    ...new Set([
      ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(
        "",
      ),
      ...source,
      ...rows.map((w) => w.word + w.meaning + w.a + w.b).join(""),
    ]),
  ].filter((c) => c >= " ");
  const entries = chars.map((c) => ({ c, font: 0 }));
  for (const font of [1, 2, 3])
    for (let i = 32; i < 127; i++)
      entries.push({ c: String.fromCharCode(i), font });
  const glyphs = await page.evaluate(
    (entries) =>
      entries.map(({ c, font }) => {
        const el = document.createElement("canvas");
        el.width = font ? 56 : 40;
        el.height = font ? 60 : 48;
        const ctx = el.getContext("2d");
        ctx.fillStyle =
          font === 3 ? "#d99671" : font === 2 ? "#e3cf9f" : "#eee7d2";
        ctx.font =
          font === 1
            ? '40px Georgia, "Times New Roman", serif'
            : font
              ? "40px ui-monospace, monospace"
              : '36px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText(c, font ? 28 : 20, font ? 46 : 36);
        return {
          data: el.toDataURL("image/png").split(",")[1],
          advance: font
            ? ctx.measureText(c).width / 40
            : c.charCodeAt(0) < 128
              ? 0.58
              : 1,
        };
      }),
    entries,
  );
  const files = {},
    costumes = entries.map(({ font }, i) => {
      const name = `g${i}`;
      files[`assets/sprites/NativeGlyph/${name}.png`] = Buffer.from(
        glyphs[i].data,
        "base64",
      );
      return {
        name,
        path: name + ".png",
        x: font ? 28 : 20,
        y: font ? 30 : 24,
        bitmapResolution: 2,
      };
    });
  const spriteConfig = {
    x: 0,
    y: 0,
    heading: 90,
    size: 1,
    rotationStyle: "none",
    physicsMode: "no",
    collisionShapeType: "none",
    triggerShapeType: "none",
    visible: false,
    costumes,
    costumeIndex: 0,
  };
  files["assets/sprites/NativeGlyph/index.json"] = JSON.stringify(spriteConfig);
  files["NativeGlyph.spx"] = `var (
 slot int
 version int
 cloned bool
)
func syncText() {
 if slot>=nativeTextCount {hide; return}
 if version!=nativeTextVersion {version=nativeTextVersion; setCostume nativeTextGlyph[slot]; setSize nativeTextSize[slot]}
 offset:=0.0; if nativeTextFocus[slot] {offset=nativeFocusOffset}
 setXYpos viewCenterX+nativeTextX[slot]-480,viewCenterY+300-nativeTextY[slot]+offset
 show; setLayer Front
}
onStart => {hide}
onCloned data => {slot=data.(int); version=-1; cloned=true; nativeGlyphLive++; hide}
onMsg "nativeTextResize", => {if cloned && slot>=nativeTextCount {cloned=false; nativeGlyphLive--; destroy}}
onMsg "nativeText", => {if cloned {syncText()}}
onClick => {nativeActivate(nativeActionAt(mouseX-viewCenterX+480,viewCenterY-mouseY+300))}
`;
  const arrays = [
    ["nativeWords", "word", "string"],
    ["nativeMeanings", "meaning", "string"],
    ["nativeDistractA", "a", "string"],
    ["nativeDistractB", "b", "string"],
    ["nativeAliases", "aliases", "string"],
    ["nativeLevels", "level", "int"],
    ["nativeSpellable", "spell", "int"],
  ];
  files["native-word-data.spx"] =
    "func initNativeWordData() {\n" +
    arrays
      .map(
        ([name, key, type]) =>
          `${name}=[]${type}{${rows.map((w) => (type === "string" ? quote(w[key]) : w[key])).join(",")}}`,
      )
      .join("\n") +
    "\n}\nfunc initNativeGlyphData() {\n nativeGlyphs=map[rune]int{}; nativeSerifGlyphs=map[rune]int{}; nativeMonoGlyphs=map[rune]int{}; nativeErrorGlyphs=map[rune]int{}\n" +
    entries
      .map(
        ({ c, font }, i) =>
          `${["nativeGlyphs", "nativeSerifGlyphs", "nativeMonoGlyphs", "nativeErrorGlyphs"][font]}[[]rune(${quote(c)})[0]]=${i}`,
      )
      .join("\n") +
    "\n nativeGlyphAdvance=[]float64{" +
    glyphs.map((g) => g.advance.toFixed(5)).join(",") +
    "}\n}\n";
  const cues = [
    "blade",
    "bowdraw",
    "bowshot",
    "arrowhit",
    "heavycut",
    "healstart",
    "healcomplete",
    "chaincut",
    "chainfinish",
    "hook",
    "attach",
    "sling",
    "dash",
    "cloth",
    "land",
    "tension",
  ];
  const dir = new URL("projects/belfry-native/audio-cache/", root);
  await mkdir(dir, { recursive: true });
  const provenance = JSON.parse(
    await readFile(new URL("public/audio/sfx/manifest.json", root), "utf8"),
  );
  const nativeSfx = [];
  for (const cue of cues) {
    const original = await readFile(
      new URL(`public/audio/sfx/${cue}-1.m4a`, root),
    );
    const record = provenance.files.find((f) => f.id === cue + "-1");
    if (
      !record ||
      createHash("sha256").update(original).digest("hex") !== record.sha256
    )
      throw Error("SFX provenance mismatch: " + cue);
    nativeSfx.push(record);
    const dest = new URL(cue + ".wav", dir);
    const r = spawnSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      fileURLToPath(new URL(`public/audio/sfx/${cue}-1.m4a`, root)),
      "-ac",
      "1",
      "-ar",
      "22050",
      fileURLToPath(dest),
    ]);
    if (r.status !== 0) throw Error(r.stderr.toString());
    files[`assets/sounds/SFX_${cue}/sound.wav`] = await readFile(dest);
    files[`assets/sounds/SFX_${cue}/index.json`] = JSON.stringify({
      path: "sound.wav",
      rate: 22050,
      sampleCount: 0,
    });
  }
  files["native-sfx-manifest.json"] = JSON.stringify({
    source: provenance.version,
    conversion: "PCM mono 22050 Hz WAV",
    files: nativeSfx,
  });
  files["assets/sprites/NativeSfx/pixel.png"] = Buffer.from(
    glyphs[chars.indexOf(" ")].data,
    "base64",
  );
  files["assets/sprites/NativeSfx/index.json"] = JSON.stringify({
    ...spriteConfig,
    costumes: [
      { name: "pixel", path: "pixel.png", x: 20, y: 24, bitmapResolution: 2 },
    ],
    visible: false,
  });
  files["NativeSfx.spx"] = `var (
 muted bool
 applied int
)
func syncChannel() {
 blocked:=nativeSfxVolume<=0 || phase==4 || phase==5 && wordVisualPaused
 if blocked && !muted {${cues.map((c) => `stopPlaying "SFX_${c}"`).join("; ")}}
 muted=blocked
 if applied!=nativeSfxVolume {applied=nativeSfxVolume; setVolume float64(applied)*0.55}
}
func cue(name string) {if nativeSfxVolume<=0 || phase==4 || phase==5 && wordVisualPaused {return}; setVolume float64(nativeSfxVolume)*0.55; play name}
onStart => {hide}
`;
  console.log(
    `Native wordbank: ${rows.length} entries / ${entries.length} glyph costumes / ${cues.length} action samples`,
  );
  return { files };
}
