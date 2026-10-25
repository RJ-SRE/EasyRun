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
  ".mp3": "audio/mpeg",
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
    const headers = {
      "Content-Type":
        types[path.extname(filename)] || "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cache-Control": isRuntime ? "public, max-age=3600" : "no-store",
      "Accept-Ranges": "bytes",
    };
    let start = 0,
      end = data.length - 1,
      status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, {
          ...headers,
          "Content-Range": `bytes */${data.length}`,
        });
        res.end();
        return;
      }
      if (match[1]) {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      } else start = Math.max(0, data.length - Number(match[2]));
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= data.length
      ) {
        res.writeHead(416, {
          ...headers,
          "Content-Range": `bytes */${data.length}`,
        });
        res.end();
        return;
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${data.length}`;
    }
    headers["Content-Length"] = Math.max(0, end - start + 1);
    res.writeHead(status, headers);
    res.end(req.method === "HEAD" ? undefined : data.subarray(start, end + 1));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(Number(process.env.RUNLAB_PORT || 4177), "127.0.0.1", () =>
  console.log(`Runlab ready: http://127.0.0.1:${server.address().port}`),
);
