/* global document, Image */
import { URL } from "node:url";
// Foot anchors register silhouettes independently of changing weapon bounds.
import { readFile } from "node:fs/promises";
const anchors = [
  [
    [157, 336],
    [177, 336],
    [155, 336],
    [150, 336],
    [193, 334],
    [187, 334],
    [175, 334],
    [193, 310],
    [155, 300],
    [170, 303],
    [171, 301],
    [159, 300],
  ],
  [
    [213, 336],
    [179, 336],
    [154, 336],
    [155, 336],
    [180, 334],
    [170, 334],
    [154, 334],
    [190, 317],
    [170, 303],
    [200, 303],
    [182, 303],
    [192, 303],
  ],
  [
    [200, 320],
    [190, 320],
    [161, 320],
    [185, 320],
    [188, 326],
    [202, 326],
    [176, 326],
    [182, 310],
    [175, 316],
    [188, 316],
    [192, 316],
    [180, 316],
  ],
];
export async function buildKeeperFrames(page, root) {
  const frames = [];
  for (let form = 0; form < 3; form++) {
    const bytes = await readFile(
      new URL(`art/belfry/keeper-v3/form-${form + 1}.png`, root),
    );
    frames.push(
      ...(await page.evaluate(
        async ({ uri, anchors }) => {
          const im = new Image();
          im.src = uri;
          await im.decode();
          return anchors.map(([ax, ay], k) => {
            const cell = document.createElement("canvas");
            cell.width = 384;
            cell.height = 342;
            const ctx = cell.getContext("2d");
            ctx.drawImage(
              im,
              ((k % 4) * im.width) / 4,
              (Math.floor(k / 4) * im.height) / 3,
              im.width / 4,
              im.height / 3,
              0,
              0,
              384,
              342,
            );
            const pixels = ctx.getImageData(0, 0, 384, 342);
            for (let i = 3; i < pixels.data.length; i += 4)
              if (pixels.data[i] < 28) pixels.data[i] = 0;
            ctx.putImageData(pixels, 0, 0);
            const out = document.createElement("canvas");
            out.width = out.height = 512;
            out.getContext("2d").drawImage(cell, 256 - ax, 490 - ay);
            return out.toDataURL("image/png").split(",")[1];
          });
        },
        {
          uri: "data:image/png;base64," + bytes.toString("base64"),
          anchors: anchors[form],
        },
      )),
    );
  }
  return frames;
}
