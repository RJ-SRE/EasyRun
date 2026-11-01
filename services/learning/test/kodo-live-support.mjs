// Explicit opt-in only. Real writes stay in a new, unique test namespace.
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { KodoStore } from "../storage.mjs";
import { kodoOptions } from "../kodo-config.mjs";

export function liveKodoHarness() {
  assert.equal(
    process.env.LEARNING_LIVE_KODO,
    "1",
    "Live Kodo testing requires explicit opt-in",
  );
  const prefix = `rupture/learning-tests/${Date.now()}-${randomBytes(8).toString("hex")}/users`;
  const written = new Set(),
    samples = [];
  const fetcher = async (url, options) => {
    const start = performance.now();
    const operation = String(url).includes("/stat/")
      ? "stat"
      : options?.body instanceof FormData
        ? "upload"
        : String(url).includes("bucketInfo")
          ? "bucket-check"
          : "download";
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      samples.push({
        operation,
        error: error.name,
        ms: Math.round(performance.now() - start),
      });
      throw error;
    }
    samples.push({
      operation,
      status: response.status,
      ms: Math.round(performance.now() - start),
    });
    return response;
  };
  const store = new KodoStore({ ...kodoOptions(), keyPrefix: prefix, fetcher });
  const write = store.write.bind(store);
  store.write = async (id, ...args) => {
    written.add(id);
    return write(id, ...args);
  };
  return {
    store,
    prefix,
    samples,
    async cleanup() {
      let deleted = 0;
      for (const id of written) {
        const key = store.key(id);
        assert.ok(key.startsWith(prefix + "/"));
        const encoded = Buffer.from(`${store.bucket}:${key}`)
          .toString("base64")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
        const url = new URL("/delete/" + encoded, store.managementOrigin);
        const signature = createHmac("sha1", store.secretKey)
          .update(url.pathname + "\n")
          .digest("base64")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
        const response = await fetch(url, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: { Authorization: `QBox ${store.accessKey}:${signature}` },
        });
        assert.ok(
          response.ok || response.status === 612,
          "Test object cleanup failed",
        );
        await response.body?.cancel();
        assert.equal(
          await store.metadata(id),
          null,
          "Test object remains after cleanup",
        );
        deleted++;
      }
      return { deleted, verifiedAbsent: true, prefix };
    },
  };
}
