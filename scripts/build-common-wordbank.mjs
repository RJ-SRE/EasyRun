// Offline, reproducible common-English content build. See data/common-sources/NOTICE.md.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { WORDS as oldWords } from "../prototypes/runlab/public/cet4-words.js";
import { WORDS as curated } from "../prototypes/runlab/data/cet4-curated.js";
const root = new URL("../", import.meta.url);
const dir = new URL("prototypes/runlab/data/common-sources/", root);
const hash = (s) => createHash("sha256").update(s).digest("hex");
const read = (name) => readFile(new URL(name, dir), "utf8");
const ng = (await read("ngsl-1.2.csv"))
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.split(","));
const na = (await read("nawl-1.2.txt"))
  .split(/\r?\n/)
  .slice(5)
  .map((s) => s.trim())
  .filter(Boolean);
const sup = (await read("ngsl-supplement.csv"))
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/)
  .map((l) => l.split(",")[0]);
const dictionary = JSON.parse(await read("ecdict-common.json"));
const edits = JSON.parse(await read("sense-overrides.json"));
const old = new Map(oldWords.map((w) => [w.word, w]));
const editorial = new Map(curated.map((w) => [w.word, w]));
const selected = new Map();
for (const [word, rank] of ng)
  selected.set(word.toLowerCase(), {
    list: "NGSL-1.2",
    rank: Number(rank),
    difficulty: Number(rank) <= 1500 ? "normal" : "hard",
  });
for (const word of sup)
  if (!selected.has(word.toLowerCase()))
    selected.set(word.toLowerCase(), {
      list: "NGSL-supplement",
      rank: null,
      difficulty: "normal",
    });
for (const word of na)
  if (!selected.has(word.toLowerCase()))
    selected.set(word.toLowerCase(), {
      list: "NAWL-1.2",
      rank: null,
      difficulty: "challenge",
    });
const normalizePos = (p) =>
  (({
    a: "adj",
    ad: "adv",
    vt: "v",
    vi: "v",
    vti: "v",
    aux: "v",
    interj: "int",
  })[p] || p) + ".";
const clean = (s) =>
  s.replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, "").replace(/\s+/g, "");
const rows = [];
for (const [word, source] of selected) {
  const e = dictionary.entries[word];
  if (!e) throw Error("Missing dictionary: " + word);
  const translation = e.translation.replaceAll("\\n", "\n");
  const lines = translation.split("\n");
  const first =
    lines.find((l) => /^[a-z]+\./.test(l) && /[\u4e00-\u9fff]/.test(l)) ||
    lines.find((l) => /[\u4e00-\u9fff]/.test(l));
  if (!first) throw Error("Missing Chinese: " + word);
  const pos = normalizePos(first.match(/^([a-z]+)\./)?.[1] || "词");
  const meanings = clean(first.replace(/^[a-z]+\./, ""))
    .split(/[,，;；]/)
    .filter((s) => /[\u4e00-\u9fff]/.test(s) && s.length <= 18);
  const override = edits[word] || editorial.get(word);
  const meaning = override?.meaning || meanings.slice(0, 2).join("；");
  const targetPos = override?.pos || pos;
  if (!meaning || meaning.length > 28)
    throw Error("Bad sense: " + word + ": " + meaning);
  const accepted = [
    ...new Set([word, ...(old.get(word)?.accepted || [])]),
  ].filter((s) => /^[a-z -]+$/.test(s));
  const revision = hash(targetPos + "\x1f" + meaning).slice(0, 16);
  rows.push({
    id: word,
    word,
    accepted,
    pos: targetPos,
    meaning,
    context: override?.context || "",
    distractors: [],
    difficulty: source.difficulty,
    tier: { normal: 1, hard: 2, challenge: 3 }[source.difficulty],
    levels: [],
    source: source.list,
    rank: source.rank,
    spellable: /^[a-z -]+$/.test(word),
    senseRevision: revision,
    quality: override ? "editorial-override" : "dictionary-validated",
    allMeanings: clean(translation),
  });
}
// Prefer same-POS, same-band real dictionary senses; conservative lexical
// overlap checks avoid another documented sense. Fallbacks are deliberately far.
const alternatives = {
  "n.": [
    "一座桥",
    "一把雨伞",
    "一种水果",
    "一张地图",
    "一种乐器",
    "一条河流",
    "一座山峰",
    "一件外套",
  ],
  "v.": [
    "烘烤食物",
    "修剪树枝",
    "测量长度",
    "缝补衣服",
    "搬运货物",
    "浇灌植物",
    "擦洗窗户",
    "敲打鼓面",
  ],
  "adj.": [
    "潮湿的",
    "锋利的",
    "空心的",
    "透明的",
    "陡峭的",
    "平坦的",
    "可折叠的",
    "金属制的",
  ],
  "adv.": [
    "在户外",
    "在楼下",
    "向东",
    "在昨天",
    "在夜间",
    "在室内",
    "往北方",
    "在明天",
  ],
  other: ["一把雨伞", "烘烤食物", "金属制的", "在楼下", "一张地图", "修剪树枝"],
};
const synonyms = [
  "buy purchase",
  "start begin",
  "end finish",
  "big large",
  "small little",
  "speak talk",
  "happy glad",
  "fast quick rapid",
  "need require",
  "get obtain acquire",
  "help assist aid",
  "road street",
  "ill sick",
  "job work",
  "keep retain",
  "show display",
  "idea thought",
  "look see watch",
  "reply answer respond",
  "beautiful pretty",
  "silent quiet",
  "allow permit",
  "close shut",
  "correct right",
  "sure certain",
].map((s) => new Set(s.split(" ")));
for (const w of rows) {
  const seed = parseInt(hash(w.word).slice(0, 6), 16);
  const candidates = rows.filter(
    (o) =>
      o.id !== w.id &&
      o.pos === w.pos &&
      o.difficulty === w.difficulty &&
      o.meaning.length <= 18 &&
      !synonyms.some((g) => g.has(w.word) && g.has(o.word)),
  );
  const acceptable = (s, all) => {
    const senses = s.split(/[；，,]/),
      target = w.meaning.split(/[；，,]/);
    if (
      senses.some((t) => w.allMeanings.includes(t)) ||
      target.some((t) => all.includes(t))
    )
      return false;
    const grams = (t) =>
      Array.from(t)
        .slice(0, -1)
        .map((_, i) => t.slice(i, i + 2))
        .filter((x) => /[\u4e00-\u9fff]{2}/.test(x));
    return (
      !grams(s).some((g) => w.allMeanings.includes(g)) &&
      w.distractors.every((a) => !grams(a).some((g) => s.includes(g)))
    );
  };
  for (let j = 0; j < candidates.length && w.distractors.length < 2; j++) {
    const o = candidates[(seed + j * 17) % candidates.length];
    if (
      !w.distractors.includes(o.meaning) &&
      acceptable(o.meaning, o.allMeanings)
    )
      w.distractors.push(o.meaning);
  }
  const pool = alternatives[w.pos] || alternatives.other;
  const start = parseInt(hash(w.word).slice(0, 6), 16) % pool.length;
  const safe = (s) => {
    const a = clean(s).replace(/[一的种座把条张件方]/g, "");
    return (
      !w.allMeanings.includes(a) &&
      !w.meaning.includes(a) &&
      !a
        .split("")
        .some(
          (_, i) =>
            i < a.length - 1 && w.allMeanings.includes(a.slice(i, i + 2)),
        )
    );
  };
  for (let j = 0; j < pool.length && w.distractors.length < 2; j++) {
    const s = pool[(start + j) % pool.length];
    if (safe(s)) w.distractors.push(s);
  }
  if (w.distractors.length !== 2)
    throw Error("No unambiguous alternatives: " + w.word);
}
for (const w of rows) delete w.allMeanings;
rows.sort((a, b) => a.word.localeCompare(b.word, "en"));
const version = "common-ngsl-nawl-2026-11-01.1";
const coverage = {
  total: rows.length,
  source: "NGSL 1.2 + supplement / NAWL 1.2",
  version,
  gradingBasis: "frequency-purpose-v1",
  difficultyCounts: Object.fromEntries(
    ["normal", "hard", "challenge"].map((k) => [
      k,
      rows.filter((w) => w.difficulty === k).length,
    ]),
  ),
  editorialOverrides: rows.filter((w) => w.quality === "editorial-override")
    .length,
  note: "普通：NGSL前1500词及日期数字；困难：其余NGSL；挑战：NAWL扩展。游戏分层，不是CEFR认证。中文释义为ECDICT固定版本规范化及编辑覆盖；未宣称全量人工复核。",
};
const legacySafe = rows
  .filter(
    (w) =>
      old.get(w.word)?.meaning === w.meaning && old.get(w.word)?.pos === w.pos,
  )
  .map((w) => w.id);
const js = `// Generated by scripts/build-common-wordbank.mjs; data is CC BY-SA 4.0 / ECDICT MIT.\nexport const CONTENT_VERSION=${JSON.stringify(version)};\nexport const COVERAGE=${JSON.stringify(coverage)};\nexport const LEGACY_SENSE_SAFE=${JSON.stringify(legacySafe)};\nexport const WORDS=${JSON.stringify(rows)};\n`;
await writeFile(new URL("prototypes/runlab/public/common-words.js", root), js);
const words = {
  schemaVersion: 1,
  wordIdScheme: "en-stable-id-v1",
  lexiconId: "easyrun-common-v1",
  contentVersion: version,
  words: rows.map((w) => ({
    ...w,
    wordId: "en:" + w.id,
    enabled: true,
    acceptedSpellings: w.accepted,
    provenanceRef: "data/common-sources/NOTICE.md",
    reviewed: w.quality === "editorial-override",
  })),
};
const bytes = JSON.stringify(words, null, 2) + "\n";
const target = new URL("services/learning/content-common/", root);
await mkdir(target, { recursive: true });
await writeFile(new URL("words.json", target), bytes);
const manifest = {
  schemaVersion: 1,
  lexiconId: words.lexiconId,
  wordIdScheme: words.wordIdScheme,
  contentVersion: version,
  wordsKey: "words.json",
  wordsSha256: hash(bytes),
  wordCount: rows.length,
  difficultyCounts: coverage.difficultyCounts,
  gradingBasis: coverage.gradingBasis,
  qualityPolicy: "dictionary-validated-with-editorial-overrides",
  draft: false,
  usageStatus: "verified",
  selectionSource: coverage.source,
  sourceEdition: "NGSL 1.2 / NAWL 1.2",
  sourceUrl: "https://www.newgeneralservicelist.com/new-general-service-list",
  provenanceRef: "prototypes/runlab/data/common-sources/NOTICE.md",
  sourceRetrievedAt: "2026-11-01T00:00:00Z",
  publishedAt: "2026-11-01T00:00:00Z",
  sourceHashes: Object.fromEntries(
    await Promise.all(
      [
        "ngsl-1.2.csv",
        "nawl-1.2.txt",
        "ngsl-supplement.csv",
        "ecdict-common.json",
        "sense-overrides.json",
      ].map(async (f) => [f, hash(await read(f))]),
    ),
  ),
};
await writeFile(
  new URL("manifest.json", target),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({ ...coverage, legacySameSense: legacySafe.length }),
);
