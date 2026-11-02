// Local tracked weapons and real chain links; no full-screen geometry.
export function addKeeperArt(sprite, vector, source) {
  const art = {};
  const styles = [
    '<path d="M8 24Q94 9 192 24Q100 19 8 24" fill="#c5bb9c" fill-opacity=".48"/><path d="M18 24Q100 17 192 24" fill="none" stroke="#f5e9cc" stroke-width="1.8"/>',
    '<path d="M5 24l23-7 18 7 35-11 24 11 32-8 22 8 35-5" fill="none" stroke="#b6afa0" stroke-width="2" opacity=".55"/>',
    "",
    '<path d="M12 24L130 20Q162 4 194 13Q181 34 132 29L12 27Z" fill="#282a27" stroke="#bda986" stroke-width="1.8"/><path d="M133 29Q177 31 194 13" fill="none" stroke="#e6e0cb" stroke-width="2"/>',
    "",
  ];
  for (const style of [2, 4]) {
    let s = "";
    for (let x = 8; x < 194; x += 13)
      s += `<ellipse cx="${x}" cy="24" rx="8" ry="3.4" fill="none" stroke="${style === 2 ? "#887c61" : "#b7a884"}" stroke-width="2"/><path d="M${x - 3} 22h6" stroke="#ded3b3" stroke-width=".6"/>`;
    styles[style] = s;
  }
  for (let form = 0; form < 3; form++) {
    const accent = ["#c5aa70", "#bf806f", "#b4c9c5"][form];
    const edge = ["#fff0cd", "#f6ddd0", "#eef5e7"][form];
    // Short local blade ribbons, never a duplicate body or full-screen flash.
    styles[0] = `<defs><linearGradient id="cut"><stop stop-color="${accent}" stop-opacity="0"/><stop offset=".7" stop-color="${accent}" stop-opacity=".38"/><stop offset="1" stop-color="${edge}" stop-opacity=".85"/></linearGradient></defs><path d="M8 24Q96 4 192 24Q108 17 8 24" fill="url(#cut)"/><path d="M32 24Q118 15 192 24" fill="none" stroke="${edge}" stroke-width="1.6"/><path d="M76 29Q142 24 182 25" fill="none" stroke="${accent}" stroke-width=".9" opacity=".65"/>`;
    for (let style = 0; style < 6; style++)
      for (let live = 0; live < 2; live++)
        art[`${form}-${style}-${live ? "active" : "tell"}`] = vector(
          200,
          48,
          styles[style] || styles[0],
        );
  }
  sprite(
    "KeeperLine",
    art,
    { visible: false, rotationStyle: "normal" },
    source,
  );
}
