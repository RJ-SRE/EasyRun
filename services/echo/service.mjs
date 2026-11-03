import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { WORDS } from "../../prototypes/runlab/public/common-words.js";
import {
  ECHO_BATCH_SIZE,
  echoMessages,
  validateEchoReport,
  sanitizeEchoSnapshot,
} from "../../prototypes/runlab/public/echo-core.js";
const bank = new Map(WORDS.map((w) => [w.id, w]));
export async function loadEchoConfig() {
  try {
    const c = JSON.parse(
      await readFile(
        new URL("../../.local/ai/maas.json", import.meta.url),
        "utf8",
      ),
    );
    if (!c.apiKey || !c.model || !/^https:\/\//.test(c.baseUrl)) return null;
    return c;
  } catch {
    return null;
  }
}
export function canonicalSnapshot(input) {
  const snapshot = sanitizeEchoSnapshot(input);
  snapshot.words = snapshot.words.map((w) => {
    const known = bank.get(w.id);
    if (!known) throw new Error("invalid-request");
    return {
      ...w,
      word: known.word,
      meaning: known.meaning,
      pos: known.pos,
      context: known.context,
    };
  });
  if (
    !snapshot.words.length ||
    snapshot.words.length > ECHO_BATCH_SIZE ||
    snapshot.outcome !== "won"
  )
    throw new Error("invalid-request");
  return snapshot;
}
export async function requestEcho(
  snapshot,
  config,
  { fetchImpl = fetch, timeout = 60000 } = {},
) {
  if (!config) throw new Error("not-configured");
  const response = await fetchImpl(
    config.baseUrl.replace(/\/$/, "") + "/chat/completions",
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify({
        model: config.model,
        messages: echoMessages(snapshot),
        stream: false,
        max_tokens: 6000,
        enable_thinking: false,
      }),
    },
  );
  if (!response.ok) throw new Error(String(response.status));
  const reader = response.body.getReader();
  let body = "",
    bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const p = await reader.read();
      if (p.done) break;
      bytes += p.value.length;
      if (bytes > 100000) throw new Error("invalid-response");
      body += decoder.decode(p.value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    throw new Error("invalid-response");
  }
  return validateEchoReport(value.choices?.[0]?.message?.content, snapshot);
}
// Local development proxy only: bound to loopback; no public key-distribution endpoint.
export function createEchoHandler({
  loadConfig = loadEchoConfig,
  request = requestEcho,
} = {}) {
  const cache = new Map();
  let pending = null;
  let lastStart = 0;
  return async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const host = req.headers.host || "";
    if (
      !/^(127\.0\.0\.1|localhost):\d+$/.test(host) ||
      (req.headers.origin && req.headers.origin !== "http://" + host)
    ) {
      send(403, { error: "origin" });
      return;
    }
    if (req.method !== "POST") {
      send(405, { error: "method" });
      return;
    }
    if (!String(req.headers["content-type"]).startsWith("application/json")) {
      send(415, { error: "content-type" });
      return;
    }
    let input;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 24000) {
          send(413, { error: "size" });
          return;
        }
        chunks.push(chunk);
      }
      input = canonicalSnapshot(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      );
    } catch {
      send(400, { error: "invalid-request" });
      return;
    }
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    if (cache.has(fingerprint)) {
      send(200, cache.get(fingerprint));
      return;
    }
    if (
      (pending && pending.key !== fingerprint) ||
      (!pending && Date.now() - lastStart < 3000)
    ) {
      send(429, { error: "busy" });
      return;
    }
    try {
      if (!pending) {
        lastStart = Date.now();
        pending = {
          key: fingerprint,
          promise: loadConfig().then((c) => request(input, c)),
        };
      }
      const active = pending;
      let report;
      try {
        report = await active.promise;
      } finally {
        if (pending === active) pending = null;
      }
      cache.set(fingerprint, report);
      if (cache.size > 12) cache.delete(cache.keys().next().value);
      send(200, report);
    } catch (e) {
      const code = e instanceof SyntaxError ? "invalid-response" : e.message;
      const status =
        code === "not-configured"
          ? 503
          : ["401", "403", "429"].includes(code)
            ? Number(code)
            : e.name === "TimeoutError" || e.name === "AbortError"
              ? 504
              : 502;
      send(status, {
        error:
          status === 504
            ? "timeout"
            : code === "invalid-response"
              ? "invalid-response"
              : "unavailable",
      });
    }
  };
}
