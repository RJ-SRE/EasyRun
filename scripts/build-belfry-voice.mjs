import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  prod = new URL("production/audio-v06/", root),
  target = new URL("prototypes/runlab/public/audio/v06/", root);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, prod), "utf8"));
const script = await read("dialogue.en-zh.json"),
  brief = await read("voice-brief.json");
if (script.status.startsWith("disabled_by_user")) {
  console.log(
    "Character voice production is disabled by the current product decision; no runtime files changed.",
  );
  process.exit(0);
}
let records = {};
try {
  records = await read("production-log.json");
} catch {
  /* Explicitly unproduced. */
}
let foley = [];
try {
  foley = await read("foley-log.json");
} catch {
  /* Explicitly unproduced. */
}
await mkdir(target, { recursive: true });
const files = [];
for (const record of [
  ...Object.entries(records).map(([id, r]) => ({ id, ...r })),
  ...foley,
]) {
  const name = record.file.split("/").at(-1),
    path = new URL(name, target);
  const data = await readFile(path);
  if (createHash("sha256").update(data).digest("hex") !== record.sha256)
    throw new Error("Audio checksum mismatch: " + name);
  files.push({ ...record, bytes: (await stat(path)).size });
}
const byId = new Map(files.map((f) => [f.id, f]));
const lines = script.lines.map((l) => ({
  id: l.id,
  speaker: l.speaker,
  event: l.event,
  en: l.text_en,
  zh: l.subtitle_zh,
  context: l.context,
  priority: l.priority,
  ttl: l.candidate_ttl_ms / 1000,
  repeat: l.repeat_rule,
  file: byId.get(l.id)?.file ?? null,
}));
const speakers = Object.fromEntries(
  Object.entries({ hero: brief.hero, ...brief.enemies }).map(([id, s]) => [
    id,
    { name: s.name },
  ]),
);
await writeFile(
  new URL("prototypes/runlab/public/belfry-dialogue.js", root),
  "// Generated from production/audio-v06; pnpm game:voice.\nexport const lines = " +
    JSON.stringify(lines, null, 2) +
    ";\nexport const speakers = " +
    JSON.stringify(speakers, null, 2) +
    ";\n",
);
const cues = await read("efforts-sfx.json");
const missingDialogue = lines.filter((l) => !l.file).map((l) => l.id),
  missingVocals = [];
for (const c of cues.cues) {
  const ids = c.id.startsWith("effort-")
    ? Array.from({ length: c.variant_count }, (_, i) => c.id + "-" + (i + 1))
    : c.id.startsWith("enemy-vocal-")
      ? c.actions.flatMap((a) => [1, 2].map((v) => `${c.id}-${a}-${v}`))
      : [];
  for (const id of ids) if (!byId.has(id)) missingVocals.push(id);
}
const manifest = {
  version: "audio-v06",
  status:
    missingDialogue.length || missingVocals.length
      ? "partial-production"
      : "integrated-awaiting-listening-review",
  lines,
  files,
  missingDialogue,
  missingVocals,
  source:
    "Original synthetic performances and authored material sound design. No OS speech fallback.",
};
await writeFile(
  new URL("manifest.json", target),
  JSON.stringify(manifest, null, 2) + "\n",
);
for (const l of script.lines) {
  l.audio_file = byId.get(l.id)?.file ?? null;
  l.production_status = l.audio_file
    ? "generated_integrated_listening_review_pending"
    : "not_generated";
}
script.status = manifest.status;
await writeFile(
  new URL("dialogue.en-zh.json", prod),
  JSON.stringify(script, null, 2) + "\n",
);
console.log(
  `${files.length} supplied audio files; ${lines.length - missingDialogue.length}/${lines.length} dialogue lines; ${46 - missingVocals.length}/46 vocal gestures.`,
);
if (
  process.argv.includes("--require-complete") &&
  (missingDialogue.length || missingVocals.length)
) {
  console.error(
    "Audio production is incomplete; see manifest missingDialogue/missingVocals.",
  );
  process.exitCode = 1;
}
