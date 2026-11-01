// Audit probes only: local ephemeral HTTP services, browser-intercepted reserved
// domains/IPs, and read-only content validation. No real player or cloud writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { learningServer } from "../../services/learning/http.mjs";
import { loadLexicon } from "../../services/learning/lexicon.mjs";

const report = { date: new Date().toISOString(), cases: [], complete: false };
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const servers = [];
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  let httpRequestsReachedRouting = 0;
  await page.route("https://xbuilder-audit.invalid/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Mixed-content audit</title>",
    }),
  );
  // Reserved documentation address; even unexpected browser behavior cannot
  // send a real request because this route fulfills it locally.
  await page.route("http://192.0.2.123:4191/**", (route) => {
    httpRequestsReachedRouting++;
    return route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '{"unexpected":true}',
    });
  });
  await page.goto("https://xbuilder-audit.invalid/");
  const result = await page.evaluate(async () => {
    try {
      await fetch("http://192.0.2.123:4191/health");
      return { blocked: false, secureContext: window.isSecureContext };
    } catch (error) {
      return {
        blocked: true,
        error: error.name,
        secureContext: window.isSecureContext,
      };
    }
  });
  assert.equal(result.secureContext, true);
  assert.equal(result.blocked, true);
  assert.equal(httpRequestsReachedRouting, 0);
  assert.ok(consoleErrors.some((s) => /Mixed Content/i.test(s)));
  report.cases.push({
    name: "HTTPS page blocks public HTTP API before server/CORS processing",
    ...result,
    httpRequestsReachedRouting,
  });

  for (const allowed of [false, true]) {
    const server = learningServer(
      { profileMode: "username" },
      {
        allowedOrigins: allowed
          ? ["https://x.qiniu.com"]
          : ["http://127.0.0.1:4177"],
      },
    );
    servers.push(server);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/v1/session`,
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://x.qiniu.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      },
    );
    assert.equal(response.status, allowed ? 204 : 403);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      allowed ? "https://x.qiniu.com" : null,
    );
    await response.body?.cancel();
    report.cases.push({
      name: allowed
        ? "explicit XBuilder origin permits preflight"
        : "local-only default rejects deployed XBuilder origin",
      status: response.status,
    });
  }

  let releaseGate;
  try {
    await loadLexicon(
      new URL("../../services/learning/content/legacy-test/", import.meta.url),
      { release: true },
    );
  } catch (error) {
    releaseGate = error.code;
  }
  assert.ok(releaseGate);
  report.cases.push({
    name: "current legacy test bank is intentionally blocked in production release validation",
    code: releaseGate,
  });
  report.complete = true;
} finally {
  await browser.close();
  await Promise.all(
    servers.map((server) => new Promise((r) => server.close(r))),
  );
  const folder = new URL(
    "../../docs/evidence/2026-10-31-xbuilder-audit/",
    import.meta.url,
  );
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL("boundary-probes.json", folder),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
