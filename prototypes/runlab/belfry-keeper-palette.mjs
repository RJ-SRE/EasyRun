/* global Image, document */
// Build-time art direction. Keep source pixels, alpha and registration intact;
// the game never recolors textures or allocates a shader during evolution.
export async function bakeKeeperPalette(page, frames, heartURI) {
  return page.evaluate(
    async ({ frames, heartURI }) => {
      const maps = [
        [
          [12, 18, 26],
          [108, 94, 63],
          [239, 217, 162],
        ],
        [
          [22, 7, 19],
          [121, 34, 46],
          [248, 176, 142],
        ],
        [
          [11, 15, 31],
          [105, 113, 145],
          [225, 246, 234],
        ],
      ];
      const skyMaps = [
        [
          [9, 15, 21],
          [100, 91, 64],
          [218, 204, 163],
        ],
        [
          [13, 8, 18],
          [93, 38, 53],
          [203, 122, 112],
        ],
        [
          [9, 12, 26],
          [65, 76, 109],
          [183, 211, 217],
        ],
      ];
      const load = async (uri) => {
        const im = new Image();
        im.src = uri;
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.width;
        c.height = im.height;
        c.getContext("2d").drawImage(im, 0, 0);
        return c;
      };
      const grade = (c, map) => {
        const ctx = c.getContext("2d"),
          pixels = ctx.getImageData(0, 0, c.width, c.height);
        let alphaChanges = 0;
        for (let i = 0; i < pixels.data.length; i += 4) {
          if (!pixels.data[i + 3]) continue;
          const alpha = pixels.data[i + 3];
          const l = Math.pow(
            (pixels.data[i] * 0.2126 +
              pixels.data[i + 1] * 0.7152 +
              pixels.data[i + 2] * 0.0722) /
              255,
            0.88,
          );
          const t = l < 0.42 ? l / 0.42 : (l - 0.42) / 0.58;
          const a = map[l < 0.42 ? 0 : 1],
            b = map[l < 0.42 ? 1 : 2];
          for (let k = 0; k < 3; k++)
            pixels.data[i + k] = Math.round(a[k] + (b[k] - a[k]) * t);
          if (pixels.data[i + 3] !== alpha) alphaChanges++;
        }
        ctx.putImageData(pixels, 0, 0);
        return { data: c.toDataURL("image/png").split(",")[1], alphaChanges };
      };
      const out = [],
        skies = [];
      let alphaChanges = 0;
      for (let i = 0; i < frames.length; i++) {
        const c = await load("data:image/png;base64," + frames[i]);
        const result = grade(c, maps[Math.floor(i / 6)]);
        out.push(result.data);
        alphaChanges += result.alphaChanges;
      }
      for (let stage = 0; stage < 3; stage++) {
        const c = await load(heartURI);
        const graded = grade(c, skyMaps[stage]);
        skies.push({ data: graded.data, w: c.width, h: c.height });
      }
      return { frames: out, skies, alphaChanges };
    },
    { frames, heartURI },
  );
}
