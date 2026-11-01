import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

const root = new URL("./", import.meta.url);
const archive = new URL("exports/belfry.xbp", root);
const out = new URL("test-results/cover/", root);
await mkdir(out, { recursive: true });
const modelUrl =
  process.env.XBUILDER_MODEL_URL ||
  "https://x.qiniu.com/assets/img-rendering-CIpDEpA1.js";
assert.ok(modelUrl, "Use a pinned XBuilder deployment model URL");
const report = {
  modelUrl,
  archiveSha256: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  fixture:
    "Actual XBP assets and deployed XBuilder project model. Static preview uses the same default map / sprite / pivot transform on Canvas; this is not a full online editor or publishing test.",
  cases: [],
};
const server = createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  createReadStream(archive).pipe(res);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
  await page.goto(
    new URL(
      "/runtime/runner.html",
      process.env.RUNLAB_URL || "http://127.0.0.1:4177/",
    ).href,
  );
  await page.addScriptTag({ url: "/runtime/fflate.js" });
  const result = await page.evaluate(
    async ({ archiveUrl, modelUrl }) => {
      const checks = [];
      const check = (condition, message) => {
        if (!condition) throw new Error(message);
        checks.push(message);
      };
      const raw = window.fflate.unzipSync(
        new Uint8Array(await (await fetch(archiveUrl)).arrayBuffer()),
      );
      const decoder = new window.TextDecoder();
      const { r: Project, gn: ModelFile } = await import(modelUrl);
      const file = (name, bytes) =>
        new ModelFile(name.split("/").pop(), async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
        );
      const thumbnail = file(
        "builder-thumbnail.png",
        raw["builder-thumbnail.png"],
      );
      const files = Object.fromEntries(
        Object.entries(raw)
          .filter(
            ([name]) =>
              !["builder-thumbnail.png", "builder-meta.json"].includes(name),
          )
          .map(([name, bytes]) => [name, file(name, bytes)]),
      );
      const project = new Project();
      await project.load({
        metadata: {
          ...JSON.parse(decoder.decode(raw["builder-meta.json"])),
          thumbnail,
        },
        files,
      });
      const cover = project.sprites[0];
      check(
        cover.name === "ProjectCover",
        "cover is the first editor sprite after real model import",
      );
      check(
        project.zorder.at(-1) === cover.id && cover.visible,
        "cover is visible above all world and native HUD sprites",
      );
      check(
        project.stage.widgets.length === 0,
        "no widget layer obscures the editor cover",
      );
      const actualBytes = new Uint8Array(await project.thumbnail.arrayBuffer());
      check(
        actualBytes.length === raw["builder-thumbnail.png"].length &&
          actualBytes.every((v, i) => v === raw["builder-thumbnail.png"][i]),
        "selected PNG survives thumbnail metadata import unchanged",
      );
      const map = project.stage.getMapSize();
      const costume = cover.defaultCostume;
      const image = new Image();
      image.src = await costume.img.url(new window.AbortController().signal);
      await image.decode();
      const scale = cover.size / costume.bitmapResolution;
      const x = map.width / 2 + cover.x - costume.pivot.x * scale;
      const y = map.height / 2 - cover.y - costume.pivot.y * scale;
      const w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      check(
        Math.abs(x) < 0.01 &&
          Math.abs(y) < 0.01 &&
          Math.abs(w - 480) < 0.01 &&
          Math.abs(h - 360) < 0.01,
        "editor cover fills the initial 480 by 360 viewport without crop or offset",
      );
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      context.drawImage(image, x, y, w, h);
      const shot = canvas.toDataURL("image/png");
      // Exercise the real automatic-thumbnail flush with the equivalent static composition.
      const unbind = project.bindScreenshotTaker(async () => {
        const blob = await new Promise((done) =>
          canvas.toBlob(done, "image/jpeg"),
        );
        return new ModelFile("thumbnail.jpg", () => blob.arrayBuffer());
      });
      project.setCameraFollowSprite(cover.id); // Editor selection can save this follow target.
      const saved = await project.export();
      unbind();
      const savedBytes = new Uint8Array(
        await saved.metadata.thumbnail.arrayBuffer(),
      );
      check(
        savedBytes[0] === 255 && savedBytes[1] === 216,
        "automatic thumbnail refresh replaces metadata with the composed cover JPEG",
      );
      const reopened = new Project();
      await reopened.load(saved);
      check(
        reopened.sprites[0].name === "ProjectCover" &&
          reopened.zorder.at(-1) === reopened.sprites[0].id,
        "cover ordering survives save and reopen through the deployed model",
      );
      check(
        reopened.cameraFollowSprite?.name === "ProjectCover",
        "editor cover selection survives roundtrip for runtime camera regression",
      );
      return {
        checks,
        shot,
        spriteCount: project.sprites.length,
        geometry: { x, y, w, h },
      };
    },
    {
      archiveUrl: `http://127.0.0.1:${server.address().port}/package.xbp`,
      modelUrl,
    },
  );
  report.cases = result.checks;
  report.spriteCount = result.spriteCount;
  report.geometry = result.geometry;
  await writeFile(
    new URL("editor-cover.png", out),
    Buffer.from(result.shot.split(",")[1], "base64"),
  );
  for (const name of report.cases) console.log("PASS", name);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
  await writeFile(
    new URL("cover.json", out),
    JSON.stringify(report, null, 2) + "\n",
  );
}
