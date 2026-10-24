import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("./", import.meta.url));
const runtime = path.resolve(root, "../../node_modules/@xgo-pkgs/spx");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".m4a": "audio/mp4",
  ".wasm": "application/wasm",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    const isRuntime = url.pathname.startsWith("/runtime/");
    const base = isRuntime ? runtime : path.join(root, "public");
    const relative =
      decodeURIComponent(
        isRuntime ? url.pathname.slice(9) : url.pathname.slice(1),
      ) || "index.html";
    const filename = path.resolve(base, relative);
    if (!filename.startsWith(base + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(filename);
    res.writeHead(200, {
      "Content-Type":
        types[path.extname(filename)] || "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cache-Control": isRuntime ? "public, max-age=3600" : "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(Number(process.env.RUNLAB_PORT || 4177), "127.0.0.1", () =>
  console.log(`Runlab ready: http://127.0.0.1:${server.address().port}`),
);
