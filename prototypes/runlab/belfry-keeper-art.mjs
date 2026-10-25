// These capsules exactly match Keeper.spx. Movement guides are non-damaging;
// the other three styles retain their authored dimensions at render time.
export function addKeeperArt(sprite, vector, source) {
  const images = {};
  for (const [style, length, radius] of [
    [0, 140, 22],
    [1, 200, 22],
    [2, 400, 3],
    [3, 353, 13],
  ]) {
    const a = 220 - length / 2,
      b = 220 + length / 2;
    for (const active of [false, true]) {
      const color = style === 2 ? "#c3dfdc" : "#e7a67b";
      images[`${style}-${active ? "active" : "tell"}`] = vector(
        440,
        64,
        active
          ? `<path d="M${a} 32H${b}" stroke="${color}" stroke-opacity=".44" stroke-width="${radius * 2}" stroke-linecap="round"/><path d="M${a} 32H${b}" stroke="#fff1d1" stroke-width="3" stroke-linecap="round"/>`
          : `<path d="M${a} 32H${b}" stroke="${color}" stroke-opacity=".15" stroke-width="${radius * 2}" stroke-linecap="round"/><path d="M${a} 32H${b}" stroke="${color}" stroke-width="2" stroke-dasharray="8 7"/><path d="M${a} ${32 - radius}v${radius * 2}M${b} ${32 - radius}v${radius * 2}" stroke="${color}" stroke-width="2"/>`,
      );
    }
  }
  sprite(
    "KeeperLine",
    images,
    { visible: false, rotationStyle: "normal" },
    source,
  );
}
