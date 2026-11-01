import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  WORDS,
  CONTENT_VERSION,
  COVERAGE,
  LEGACY_SENSE_SAFE,
} from "./public/common-words.js";
import { loadLexicon } from "../../services/learning/lexicon.mjs";
export async function nativeLearningContent() {
  if (!process.env.LEARNING_NATIVE_CONTENT_DIR)
    return {
      words: WORDS,
      core: true,
      version: CONTENT_VERSION,
      gradingBasis: COVERAGE.gradingBasis,
      legacySenseSafe: LEGACY_SENSE_SAFE,
      releaseReady: true,
      notice: "常用英语核心与进阶扩展 · 本机档案",
    };
  const lexicon = await loadLexicon(
    pathToFileURL(resolve(process.env.LEARNING_NATIVE_CONTENT_DIR) + "/"),
    { release: true },
  );
  const words = lexicon.words
    .filter((w) => w.enabled)
    .map((w) => ({
      id: w.wordId.slice(3),
      word: w.word,
      meaning: w.meaning,
      pos: w.pos,
      distractors: w.distractors,
      accepted: w.acceptedSpellings,
      spellable: w.spellable,
      difficulty: w.difficulty,
      senseRevision: w.senseRevision,
      levels: [],
    }));
  return {
    words,
    core: true,
    version: lexicon.contentVersion,
    releaseReady: true,
    notice: "游客 · 记录保留于本次运行",
  };
}
