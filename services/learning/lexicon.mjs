import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { requireThat } from "./rules.mjs";
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function validateLexicon(
  data,
  manifest,
  bytes,
  { release = true } = {},
) {
  requireThat(
    data.schemaVersion === 1 && data.wordIdScheme === "en-stable-id-v1",
    "LEXICON_SCHEMA",
  );
  requireThat(
    data.contentVersion === manifest.contentVersion &&
      manifest.wordsSha256 === sha256(bytes),
    "LEXICON_INTEGRITY",
  );
  requireThat(
    Array.isArray(data.words) &&
      data.words.filter((w) => w.enabled).length === manifest.wordCount,
    "LEXICON_COUNT",
  );
  const ids = new Set(),
    counts = { normal: 0, hard: 0, challenge: 0 };
  for (const w of data.words) {
    requireThat(
      typeof w.wordId === "string" &&
        /^en:[^\r\n]{1,80}$/.test(w.wordId) &&
        !ids.has(w.wordId),
      "LEXICON_ID",
    );
    ids.add(w.wordId);
    requireThat(
      typeof w.enabled === "boolean" && typeof w.spellable === "boolean",
      "LEXICON_FLAGS",
    );
    requireThat(
      typeof w.word === "string" &&
        typeof w.meaning === "string" &&
        w.meaning.trim() &&
        typeof w.pos === "string",
      "LEXICON_SENSE",
    );
    requireThat(
      Array.isArray(w.acceptedSpellings) &&
        w.acceptedSpellings.includes(w.word),
      "LEXICON_ANSWERS",
    );
    if (w.spellable)
      requireThat(
        w.acceptedSpellings.every((s) => /^[a-z -]+$/.test(s)),
        "LEXICON_INPUT",
      );
    requireThat(
      Array.isArray(w.distractors) &&
        w.distractors.length === 2 &&
        new Set([w.meaning, ...w.distractors]).size === 3,
      "LEXICON_OPTIONS",
    );
    if (!w.enabled) continue;
    requireThat(Object.hasOwn(counts, w.difficulty), "LEXICON_DIFFICULTY");
    counts[w.difficulty]++;
    if (release) {
      if (manifest.gradingBasis === "frequency-purpose-v1") {
        const expected =
          w.source === "NAWL-1.2"
            ? "challenge"
            : w.source === "NGSL-supplement"
              ? "normal"
              : w.source === "NGSL-1.2" &&
                  Number.isInteger(w.rank) &&
                  w.rank >= 1 &&
                  w.rank <= 2809
                ? w.rank <= 1500
                  ? "normal"
                  : "hard"
                : null;
        requireThat(w.difficulty === expected, "LEXICON_FREQUENCY_GRADE");
        requireThat(
          ["editorial-override", "dictionary-validated"].includes(w.quality) &&
            /^[a-f0-9]{16}$/.test(w.senseRevision) &&
            Boolean(w.provenanceRef),
          "LEXICON_QUALITY",
        );
      } else {
        requireThat(
          w.difficulty ===
            { A1: "normal", A2: "normal", B1: "hard", B2: "challenge" }[w.cefr],
          "LEXICON_CEFR",
        );
        requireThat(
          w.reviewed === true && Boolean(w.provenanceRef),
          "LEXICON_REVIEW",
        );
      }
    }
  }
  requireThat(
    Object.keys(counts).every(
      (k) => counts[k] === manifest.difficultyCounts[k],
    ),
    "LEXICON_DIFFICULTY_COUNT",
  );
  if (release) {
    requireThat(
      manifest.draft === false && manifest.usageStatus === "verified",
      "LEXICON_NOT_RELEASED",
    );
    requireThat(
      manifest.schemaVersion === 1 &&
        manifest.lexiconId === data.lexiconId &&
        manifest.wordIdScheme === data.wordIdScheme &&
        manifest.wordsKey === "words.json" &&
        [manifest.sourceRetrievedAt, manifest.publishedAt].every(
          (value) =>
            typeof value === "string" && Number.isFinite(Date.parse(value)),
        ),
      "LEXICON_MANIFEST_METADATA",
    );
    requireThat(
      ["selectionSource", "sourceEdition", "sourceUrl", "provenanceRef"].every(
        (k) => typeof manifest[k] === "string" && manifest[k].length > 0,
      ),
      "LEXICON_PROVENANCE",
    );
    requireThat(
      Object.values(counts).every((n) => n >= 30),
      "LEXICON_SMALL_POOL",
    );
  }
  return {
    ...data,
    manifest,
    byId: new Map(data.words.map((w) => [w.wordId, w])),
  };
}
export async function loadLexicon(folder, options) {
  const bytes = await readFile(new URL("words.json", folder));
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", folder), "utf8"),
  );
  return validateLexicon(JSON.parse(bytes), manifest, bytes, options);
}
