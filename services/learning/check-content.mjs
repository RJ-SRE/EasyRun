import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadLexicon } from "./lexicon.mjs";
try {
  const path = process.argv[2];
  if (!path)
    throw new Error(
      "Usage: node services/learning/check-content.mjs CONTENT_DIRECTORY",
    );
  const lexicon = await loadLexicon(pathToFileURL(resolve(path) + "/"), {
    release: true,
  });
  console.log(
    JSON.stringify({
      contentVersion: lexicon.contentVersion,
      wordCount: lexicon.manifest.wordCount,
      releaseChecks: true,
    }),
  );
} catch (error) {
  console.error("Release blocked: " + error.message);
  process.exitCode = 1;
}
