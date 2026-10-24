// Asset import: split the atlas, normalize run cells to the existing texture
// resolution, and preserve alpha. Source atlases remain unchanged.
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("./art/rupture-v2/", import.meta.url);
const isRun = process.argv.includes("--run");
const columns = isRun ? 4 : 3;
const rows = 3;
const source = await readFile(
  new URL(isRun ? "run-cycle-v3.png" : "wanderer-atlas.png", root),
);
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage();
  const frames = await page.evaluate(
    async ({ uri, columns, rows, normalize }) => {
      const image = new Image();
      image.src = uri;
      await image.decode();
      const frames = [];
      for (let i = 0; i < columns * rows; i++) {
        const left = Math.round(((i % columns) * image.width) / columns),
          right = Math.round((((i % columns) + 1) * image.width) / columns);
        const top = Math.round((Math.floor(i / columns) * image.height) / rows),
          bottom = Math.round(
            ((Math.floor(i / columns) + 1) * image.height) / rows,
          );
        const canvas = document.createElement("canvas");
        canvas.width = normalize || right - left;
        canvas.height = normalize || bottom - top;
        canvas
          .getContext("2d")
          .drawImage(
            image,
            left,
            top,
            right - left,
            bottom - top,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        frames.push(canvas.toDataURL("image/png").split(",")[1]);
      }
      return frames;
    },
    {
      uri: "data:image/png;base64," + source.toString("base64"),
      columns,
      rows,
      normalize: isRun ? 418 : 0,
    },
  );
  const dest = isRun ? "run-frames" : "frames";
  await mkdir(new URL(`${dest}/`, root), { recursive: true });
  for (let i = 0; i < frames.length; i++)
    await writeFile(
      new URL(`${dest}/${i}.png`, root),
      Buffer.from(frames[i], "base64"),
    );
  console.log(
    `Imported ${frames.length} animation frames; original atlas preserved.`,
  );
} finally {
  await browser.close();
}
