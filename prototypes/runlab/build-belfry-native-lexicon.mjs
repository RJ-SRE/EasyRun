// Bitmap glyphs keep native Chinese text independent of system fonts and DOM.
import { Buffer } from "node:buffer";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { wordDifficulty, WORD_MODES } from "./public/word-selection.js";
import { nativeWordData } from "./belfry-native-data.mjs";
const root = new URL("./", import.meta.url);
export async function buildNativeLexicon(
  page,
  words,
  content = { core: false, version: "cet46-2026-10-26.1" },
) {
  const trim = (s) => Array.from(s).slice(0, 28).join("");
  const rows = words.map((w) => ({
    id: "en:" + w.id,
    word: w.word.toLowerCase(),
    meaning: trim(w.meaning),
    pos: w.pos,
    context: w.context || "",
    revision: w.senseRevision || "legacy",
    legacySafe: content.legacySenseSafe?.includes(w.id) ? 1 : 0,
    a: trim(w.distractors[0]),
    b: trim(w.distractors[1]),
    aliases: w.accepted.map((x) => x.toLowerCase()).join("|"),
    level: wordDifficulty(w),
    spell: w.spellable && /^[a-z -]+$/.test(w.word.toLowerCase()) ? 1 : 0,
  }));
  const source = (
    await Promise.all(
      [
        "NativeWords",
        "NativeLedger",
        "NativeCombat",
        "NativeLearning",
        "NativeCloud",
        "NativeLocal",
        "NativeStudy",
      ].map((name) =>
        readFile(new URL(`spx/belfry/${name}.spx`, root), "utf8"),
      ),
    )
  ).join("\n");
  const chars = [
    ...new Set([
      ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(
        "",
      ),
      ...source,
      ...rows
        .map((w) => w.word + w.meaning + w.a + w.b + w.pos + w.context)
        .join(""),
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
          c === "◐"
            ? "#c7906b"
            : c === "◆" || c === "✦"
              ? "#dfc386"
              : font === 3
                ? "#d99671"
                : font === 2
                  ? "#e3cf9f"
                  : "#eee7d2";
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
 layer int
 glyph int
 scale float64
)
func syncText() {
 if slot>=nativeTextCount {hide; return}
 if version!=nativeTextVersion {
  version=nativeTextVersion
  if glyph!=nativeTextGlyph[slot] {glyph=nativeTextGlyph[slot]; setCostume glyph}
  if scale!=nativeTextSize[slot] {scale=nativeTextSize[slot]; setSize scale}
 }
 offset:=0.0; if nativeTextFocus[slot] {offset=nativeFocusOffset}
 setXYpos viewCenterX+nativeTextX[slot]-480,viewCenterY+300-nativeTextY[slot]+offset
 show; if layer!=nativeLayerVersion {layer=nativeLayerVersion; setLayer Front}
}
onStart => {hide}
onCloned data => {slot=data.(int); version=-1; glyph=-1; layer=-1; cloned=true; nativeGlyphLive++; hide}
onMsg "nativeTextResize", => {if cloned && slot>=nativeTextCount {cloned=false; nativeGlyphLive--; destroy}}
onMsg "nativeText", => {if cloned {syncText()}}
onClick => {nativeActivate(nativeActionAt(mouseX-viewCenterX+480,viewCenterY-mouseY+300))}
`;
  files["native-word-data.spx"] = nativeWordData(
    rows,
    entries,
    glyphs,
    content.core,
  );
  const storageMode = process.env.LEARNING_NATIVE_STORAGE_MODE || "local";
  if (!["local", "cloud", "session"].includes(storageMode))
    throw Error("Invalid native storage mode");
  const apiURL =
    storageMode === "cloud" ? process.env.LEARNING_NATIVE_API_URL || "" : "";
  const profileMode = process.env.LEARNING_NATIVE_PROFILE_MODE || "username";
  if (!["username", "verified-id"].includes(profileMode))
    throw Error("Invalid native profile mode");
  if (
    apiURL &&
    (!apiURL.startsWith("https://") ||
      new URL(apiURL).username ||
      new URL(apiURL).password ||
      new URL(apiURL).search ||
      new URL(apiURL).hash)
  )
    throw new Error(
      "LEARNING_NATIVE_API_URL must be a public HTTPS endpoint without credentials/query/hash",
    );
  files["native-word-data.spx"] = files["native-word-data.spx"].replace(
    "func initNativeWordData() {",
    `func initNativeWordData() {\n nativeCloudURL=${JSON.stringify(apiURL.replace(/\/$/, ""))}; nativeCloudVersion=${JSON.stringify(content.version)}; nativeNameMode=${storageMode === "cloud" && profileMode === "username"}; nativeLocalEnabled=${storageMode === "local"}`,
  );
  files["native-learning-manifest.json"] = JSON.stringify({
    schemaVersion: 1,
    learningRuleVersion: 1,
    contentVersion: content.version,
    wordCount: words.length,
    core: content.core,
    selectionRuleVersion: 1,
    selectionModes: WORD_MODES,
    defaultSelection: "normal",
    difficultyBasis: content.core
      ? content.gradingBasis || "reviewed-core-cefr"
      : "existing-gameplay-tiers-v1",
    difficultyCounts: Object.fromEntries(
      WORD_MODES.slice(0, 3).map((mode, index) => [
        mode,
        rows.filter((row) => row.level === index + 1).length,
      ]),
    ),
    storageMode,
    localPersistence: storageMode === "local",
    cloudEnabled: !!apiURL,
    apiURL,
    profileMode,
    identityBridge:
      storageMode === "local"
        ? "runtime-name-local-profile"
        : profileMode === "username"
          ? "runtime-username-unverified"
          : "pending-platform-authorization",
    identityVerified: false,
    contentReleaseReady: content.releaseReady === true,
    contentQualityPolicy: content.core
      ? "dictionary-validated-with-editorial-overrides"
      : "legacy-test-content",
    releaseReady: false,
  });
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
 audioPositionKnown bool
 audioX float64
 audioY float64
)
func pinToCamera() {
 if !audioPositionKnown || audioX!=viewCenterX || audioY!=viewCenterY {
  audioPositionKnown=true; audioX=viewCenterX; audioY=viewCenterY
  setXYpos audioX,audioY
 }
}
func syncChannel() {
 blocked:=nativeSfxVolume<=0 || phase==4 || phase==5 && wordVisualPaused
 if blocked && !muted {${cues.map((c) => `stopPlaying "SFX_${c}"`).join("; ")}}
 muted=blocked
 if applied!=nativeSfxVolume {applied=nativeSfxVolume; setVolume float64(applied)}
}
func cue(name string) {if nativeSfxVolume<=0 || phase==4 || phase==5 && wordVisualPaused {return}; pinToCamera(); setVolume float64(nativeSfxVolume); play name}
onStart => {hide}
`;
  files["assets/sprites/NativeBgm/pixel.png"] =
    files["assets/sprites/NativeSfx/pixel.png"];
  files["assets/sprites/NativeBgm/index.json"] =
    files["assets/sprites/NativeSfx/index.json"];
  files["NativeBgm.spx"] = await readFile(
    new URL("spx/belfry/NativeBgm.spx", root),
    "utf8",
  );
  console.log(
    `Native wordbank: ${rows.length} entries / ${entries.length} glyph costumes / ${cues.length} action samples`,
  );
  return { files };
}
