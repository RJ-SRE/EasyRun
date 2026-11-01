import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadLexicon } from "./lexicon.mjs";
import { FileStore, KodoStore, DurableRepository } from "./storage.mjs";
import { xbuilderVerifier } from "./auth.mjs";
import { LearningService } from "./service.mjs";
import { learningServer } from "./http.mjs";
import { kodoOptions } from "./kodo-config.mjs";
const env = process.env,
  production = env.LEARNING_ENV === "production";
const profileMode = env.LEARNING_PROFILE_MODE || "verified-id";
if (production && env.LEARNING_STORE !== "kodo")
  throw new Error("Production requires the configured private Kodo store");
const lexicon = await loadLexicon(
  pathToFileURL(
    resolve(
      env.LEARNING_CONTENT_DIR || "services/learning/content/legacy-test",
    ) + "/",
  ),
  { release: production },
);
const store =
  env.LEARNING_STORE === "kodo"
    ? new KodoStore(kodoOptions(env))
    : new FileStore(
        resolve(env.LEARNING_DATA_DIR || ".local/learning/profiles"),
      );
const repository = new DurableRepository(
  store,
  resolve(env.LEARNING_JOURNAL_DIR || ".local/learning/journal"),
);
const verifyIdentity =
  profileMode === "username"
    ? null
    : xbuilderVerifier({
        userInfoUrl: env.XBUILDER_USERINFO_URL,
        issuer: env.XBUILDER_ISSUER,
      });
if (production && profileMode !== "username" && !verifyIdentity)
  throw new Error("Verified XBuilder identity endpoint is required");
const service = new LearningService({
  repository,
  lexicon,
  verifyIdentity,
  mappingKey: env.LEARNING_PLAYER_MAPPING_KEY,
  sessionKey: env.LEARNING_SESSION_KEY,
  profileMode,
});
await repository.init();
const server = learningServer(service, {
  allowedOrigins: (
    env.LEARNING_ALLOWED_ORIGINS ||
    "http://127.0.0.1:4177,http://127.0.0.1:4184"
  )
    .split(",")
    .filter(Boolean),
  identityConfigured: Boolean(verifyIdentity),
  storage: store.label,
});
server.listen(
  Number(env.LEARNING_PORT || 4190),
  env.LEARNING_HOST || "127.0.0.1",
  () =>
    console.log(
      JSON.stringify({
        url: `http://${env.LEARNING_HOST || "127.0.0.1"}:${server.address().port}`,
        storage: store.label,
        identityConfigured: Boolean(verifyIdentity),
        profileMode,
        contentVersion: lexicon.contentVersion,
        releaseReady: false,
      }),
    ),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close();
  await Promise.allSettled([...repository.locks.values()]);
  await repository.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
