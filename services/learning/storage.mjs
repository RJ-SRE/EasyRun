import { mkdir, readFile, open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash, createHmac } from "node:crypto";
import { requireThat, LearningError } from "./rules.mjs";
import { sha256 } from "./lexicon.mjs";
import { privateBucketInfo } from "./kodo-config.mjs";

const validPlayer = (id) =>
  requireThat(/^p_[a-f0-9]{64}$/.test(id), "INVALID_PLAYER");
async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function durableWrite(path, value) {
  const temp = path + ".tmp";
  const f = await open(temp, "w", 0o600);
  try {
    await f.writeFile(value);
    await f.sync();
  } finally {
    await f.close();
  }
  await rename(temp, path);
  const dir = await open(join(path, ".."), "r");
  try {
    await dir.sync();
  } finally {
    await dir.close();
  }
}
export class FileStore {
  constructor(directory) {
    this.directory = directory;
    this.label = "local-files-not-cloud";
  }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }
  path(id) {
    validPlayer(id);
    return join(this.directory, id + ".json");
  }
  async read(id) {
    return readOptional(this.path(id));
  }
  async write(id, text, { insertOnly = false } = {}) {
    if (insertOnly)
      requireThat(
        (await this.read(id)) === null,
        "PROFILE_ALREADY_EXISTS",
        409,
      );
    await durableWrite(this.path(id), text);
  }
}
// Kodo uses URL-safe base64 with padding, unlike JWT's unpadded base64url.
const q64 = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
const qsign = (key, value) =>
  q64(createHmac("sha1", key).update(value).digest());
function etag(bytes) {
  const blocks = [];
  for (let i = 0; i < bytes.length; i += 4194304)
    blocks.push(
      createHash("sha1")
        .update(bytes.subarray(i, i + 4194304))
        .digest(),
    );
  if (!blocks.length) blocks.push(createHash("sha1").update("").digest());
  return q64(
    Buffer.concat([
      Buffer.from([blocks.length === 1 ? 0x16 : 0x96]),
      blocks.length === 1
        ? blocks[0]
        : createHash("sha1").update(Buffer.concat(blocks)).digest(),
    ]),
  );
}
export class KodoStore {
  constructor({
    bucket,
    accessKey,
    secretKey,
    uploadOrigin,
    privateReadOrigin,
    managementOrigin = "https://rs.qiniu.com",
    controlOrigin = "https://uc.qiniuapi.com",
    keyPrefix = "rupture/learning/v1/users",
    fetcher = fetch,
  }) {
    requireThat(
      bucket && accessKey && secretKey && uploadOrigin && privateReadOrigin,
      "KODO_CONFIGURATION",
      503,
    );
    for (const s of [
      uploadOrigin,
      privateReadOrigin,
      managementOrigin,
      controlOrigin,
    ]) {
      const u = new URL(s);
      requireThat(
        u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          !u.search &&
          !u.hash &&
          u.pathname === "/",
        "KODO_HTTPS_ORIGIN",
        503,
      );
    }
    requireThat(
      /^rupture\/(learning\/v1|learning-tests\/[a-z0-9-]{1,80})\/users$/.test(
        keyPrefix,
      ),
      "KODO_KEY_PREFIX",
      503,
    );
    Object.assign(this, {
      bucket,
      accessKey,
      secretKey,
      uploadOrigin,
      privateReadOrigin,
      managementOrigin,
      controlOrigin,
      keyPrefix,
      fetcher,
    });
    this.label = "kodo";
  }
  async init() {
    // Do not start a player archive service on an accidentally public bucket.
    this.bucketInfo = await privateBucketInfo(this);
  }
  key(id) {
    validPlayer(id);
    return `${this.keyPrefix}/${id}/current.json`;
  }
  async metadata(id) {
    const url = new URL(
      "/stat/" + q64(`${this.bucket}:${this.key(id)}`),
      this.managementOrigin,
    );
    const response = await this.fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `QBox ${this.accessKey}:${qsign(this.secretKey, url.pathname + "\n")}`,
      },
    });
    if (response.status === 612) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) await response.body?.cancel();
    requireThat(response.ok, "KODO_STAT_FAILED", 503);
    const value = await response.json();
    requireThat(typeof value.hash === "string", "KODO_STAT_INVALID", 503);
    return value;
  }
  async read(id) {
    const metadata = await this.metadata(id);
    if (metadata === null) return null;
    requireThat(metadata.fsize <= 8 * 1024 * 1024, "PROFILE_TOO_LARGE", 503);
    const url = new URL(this.key(id), this.privateReadOrigin);
    url.searchParams.set("e", String(Math.floor(Date.now() / 1000) + 60));
    url.searchParams.set("revision", metadata.hash);
    const signed =
      url.toString() +
      `&token=${this.accessKey}:${qsign(this.secretKey, url.toString())}`;
    const response = await this.fetcher(signed, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) await response.body?.cancel();
    requireThat(response.ok, "KODO_READ_FAILED", 503);
    const bytes = Buffer.from(await response.arrayBuffer());
    requireThat(
      bytes.length <= 8 * 1024 * 1024 && etag(bytes) === metadata.hash,
      "KODO_READ_STALE_OR_CORRUPT",
      503,
    );
    return bytes.toString("utf8");
  }
  async write(id, text, { insertOnly = false } = {}) {
    const key = this.key(id),
      bytes = Buffer.from(text);
    const policy = q64(
      JSON.stringify({
        scope: `${this.bucket}:${key}`,
        deadline: Math.floor(Date.now() / 1000) + 120,
        insertOnly: insertOnly ? 1 : 0,
        returnBody: '{"key":$(key),"hash":$(etag)}',
      }),
    );
    const form = new FormData();
    form.append("key", key);
    form.append(
      "token",
      `${this.accessKey}:${qsign(this.secretKey, policy)}:${policy}`,
    );
    form.append(
      "file",
      new Blob([bytes], { type: "application/json" }),
      "current.json",
    );
    // Never retry an uncertain PUT here. The durable intent owns recovery.
    const response = await this.fetcher(this.uploadOrigin, {
      method: "POST",
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) await response.body?.cancel();
    requireThat(response.ok, "KODO_WRITE_UNCONFIRMED", 503);
    const receipt = await response.json();
    requireThat(
      receipt.key === key && receipt.hash === etag(bytes),
      "KODO_WRITE_UNCONFIRMED",
      503,
    );
  }
}
export class DurableRepository {
  constructor(store, directory) {
    this.store = store;
    this.directory = directory;
    this.cache = new Map();
    this.locks = new Map();
    this.cacheBytes = 0;
  }
  async init() {
    await this.store.init();
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lock = join(this.directory, "writer.lock");
    try {
      this.processLock = await open(lock, "wx", 0o600);
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const pid = Number(await readFile(lock, "utf8"));
      requireThat(Number.isInteger(pid) && pid > 0, "STORE_LOCK_INVALID", 503);
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (e) {
        if (e.code === "ESRCH") alive = false;
      }
      requireThat(!alive, "STORE_ALREADY_OPEN", 503);
      await unlink(lock);
      this.processLock = await open(lock, "wx", 0o600);
    }
    await this.processLock.writeFile(String(process.pid));
    await this.processLock.sync();
  }
  async close() {
    if (this.processLock) {
      await this.processLock.close();
      await unlink(join(this.directory, "writer.lock"));
      this.processLock = null;
    }
  }
  async serial(id, fn) {
    validPlayer(id);
    const prior = this.locks.get(id) ?? Promise.resolve();
    const task = prior.catch(() => {}).then(fn);
    this.locks.set(id, task);
    try {
      return await task;
    } finally {
      if (this.locks.get(id) === task) this.locks.delete(id);
    }
  }
  intentPath(id) {
    validPlayer(id);
    return join(this.directory, id + ".intent.json");
  }
  remember(id, profile) {
    if (this.cache.has(id)) {
      this.cacheBytes -= this.cache.get(id).size;
      this.cache.delete(id);
    }
    // Conservative accounting; actual process memory is measured separately.
    const size = Buffer.byteLength(JSON.stringify(profile)) * 4;
    this.cache.set(id, { profile, size });
    this.cacheBytes += size;
    while (this.cache.size > 32 || this.cacheBytes > 64 * 1024 * 1024) {
      const first = this.cache.keys().next().value;
      this.cacheBytes -= this.cache.get(first).size;
      this.cache.delete(first);
    }
  }
  parse(text, id) {
    let p;
    try {
      p = JSON.parse(text);
    } catch {
      throw new LearningError("PROFILE_CORRUPT", 409);
    }
    requireThat(
      p?.schemaVersion === 1 &&
        p.learningRuleVersion === 1 &&
        p.playerId === id &&
        Number.isSafeInteger(p.revision) &&
        p.revision >= 1 &&
        p.words &&
        !Array.isArray(p.words) &&
        p.sync &&
        Array.isArray(p.recentRuns) &&
        Number.isSafeInteger(p.totals?.completedRuns),
      "PROFILE_INCOMPATIBLE",
      409,
    );
    for (const [key, w] of Object.entries(p.words)) {
      requireThat(
        key.startsWith("en:") && w && typeof w.everCorrect === "boolean",
        "PROFILE_CORRUPT",
        409,
      );
      for (const a of [w.spell, w.meaning])
        if (a)
          requireThat(
            [
              "attempts",
              "correct",
              "wrong",
              "timeouts",
              "assistedCorrect",
              "weaknessMilli",
            ].every((k) => Number.isSafeInteger(a[k]) && a[k] >= 0) &&
              a.attempts === a.correct + a.wrong + a.timeouts &&
              a.assistedCorrect <= a.correct &&
              a.weaknessMilli <= 6000 &&
              Number.isFinite(Date.parse(a.nextReviewAt)),
            "PROFILE_CORRUPT",
            409,
          );
    }
    return p;
  }
  async load(id) {
    const pending = await readOptional(this.intentPath(id));
    if (pending) {
      const intent = JSON.parse(pending);
      const actual = await this.store.read(id);
      // Only exact candidate visibility proves the sole submitted write landed.
      // Old/missing content is NOT evidence that an in-flight write cannot arrive.
      requireThat(
        actual !== null && sha256(actual) === intent.hash,
        "WRITE_OUTCOME_UNKNOWN",
        503,
      );
      const p = this.parse(actual, id);
      await unlink(this.intentPath(id));
      this.remember(id, p);
      return p;
    }
    if (this.cache.has(id)) {
      const entry = this.cache.get(id);
      this.cache.delete(id);
      this.cache.set(id, entry);
      return entry.profile;
    }
    const raw = await this.store.read(id);
    if (raw === null) return null;
    const p = this.parse(raw, id);
    this.remember(id, p);
    return p;
  }
  async commit(id, profile, { insertOnly = false } = {}) {
    const path = this.intentPath(id);
    requireThat(
      (await readOptional(path)) === null,
      "WRITE_OUTCOME_UNKNOWN",
      503,
    );
    const text = JSON.stringify(profile);
    await durableWrite(
      path,
      JSON.stringify({
        schemaVersion: 1,
        playerId: id,
        hash: sha256(text),
        revision: profile.revision,
        candidate: profile,
        insertOnly,
      }),
    );
    await this.store.write(id, text, { insertOnly });
    // A failed remove is safe: subsequent load reconciles the exact candidate.
    await unlink(path);
    this.remember(id, profile);
  }
}
