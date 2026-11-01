import { createServer } from "node:http";
import { LearningError } from "./rules.mjs";
export function learningServer(
  service,
  {
    allowedOrigins = [],
    identityConfigured = false,
    storage = "local-files-not-cloud",
  } = {},
) {
  const origins = new Set(allowedOrigins);
  return createServer(async (req, res) => {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    };
    const send = (status, body) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(body));
    };
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) {
      send(403, { error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    if (req.method === "OPTIONS") {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    try {
      const path = new URL(req.url, "http://localhost").pathname;
      if (path === "/health" && req.method === "GET") {
        send(200, {
          ok: true,
          storage,
          identityConfigured,
          profileMode: service.profileMode,
          loginAvailable:
            service.profileMode === "username" || identityConfigured,
          releaseReady: false,
        });
        return;
      }
      const token = /^Bearer ([^\s]+)$/.exec(
        req.headers.authorization ?? "",
      )?.[1];
      if (path === "/v1/view" && req.method === "GET") {
        send(200, await service.view(token));
        return;
      }
      if (
        req.method !== "POST" ||
        !["/v1/session", "/v1/prepare", "/v1/batches"].includes(path)
      ) {
        send(404, { error: "NOT_FOUND" });
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new LearningError("JSON_REQUIRED", 415);
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 262144) throw new LearningError("BODY_TOO_LARGE", 413);
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks));
      } catch {
        throw new LearningError("INVALID_JSON", 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new LearningError("INVALID_BODY", 400);
      const result =
        path === "/v1/session"
          ? service.profileMode === "username"
            ? await service.loginUsername(body.username)
            : await service.login(body.platformCredential)
          : path === "/v1/prepare"
            ? await service.prepare(token, body)
            : await service.submit(token, body);
      send(200, result);
    } catch (e) {
      // Never expose credentials, signed download URLs or provider error bodies.
      send(e.status ?? 503, {
        error: e instanceof LearningError ? e.code : "SERVICE_UNAVAILABLE",
      });
    }
  });
}
