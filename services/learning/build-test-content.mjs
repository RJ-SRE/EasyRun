// Existing CET data is for INTERNAL integration only. No invented CEFR labels.
import { WORDS } from "../../prototypes/runlab/public/cet4-words.js";
import { mkdir, writeFile } from "node:fs/promises";
import { sha256 } from "./lexicon.mjs";
const words = WORDS.map((w) => ({
  wordId: "en:" + w.id,
  word: w.word,
  acceptedSpellings: w.accepted,
  pos: w.pos,
  meaning: w.meaning,
  distractors: w.distractors,
  spellable: w.spellable,
  enabled: true,
  difficulty: { 1: "normal", 2: "hard", 3: "challenge" }[w.tier],
  cefr: null,
  reviewed: false,
  provenanceRef: "docs/WORD_MEMORY_V11.md",
}));
const data = {
  schemaVersion: 1,
  lexiconId: "cet46-legacy-test",
  contentVersion: "cet46-2026-10-26.1-cloud-test",
  wordIdScheme: "en-stable-id-v1",
  words,
};
const bytes = JSON.stringify(data);
const counts = Object.fromEntries(
  ["normal", "hard", "challenge"].map((k) => [
    k,
    words.filter((w) => w.difficulty === k).length,
  ]),
);
const manifest = {
  schemaVersion: 1,
  lexiconId: data.lexiconId,
  contentVersion: data.contentVersion,
  wordIdScheme: data.wordIdScheme,
  wordCount: words.length,
  wordsKey: "words.json",
  wordsSha256: sha256(bytes),
  difficultyCounts: counts,
  draft: true,
  usageStatus: "legacy-test-only",
  selectionSource: "existing CET 8815; NOT Oxford/CEFR/core",
  sourceEdition: "cet46-2026-10-26.1",
  sourceUrl: "",
  provenanceRef: "docs/WORD_MEMORY_V11.md",
  warning:
    "The existing tier is a synthetic internal load-test grouping only. Never use this manifest to publish the new common-word modes.",
};
const folder = new URL("./content/legacy-test/", import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL("words.json", folder), bytes + "\n");
// Hash exact written bytes, including newline.
manifest.wordsSha256 = sha256(bytes + "\n");
await writeFile(
  new URL("manifest.json", folder),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({ words: words.length, ...counts, releaseReady: false }),
);
