// Local weapon materials. Curved trails are foot/weapon-relative, never halos.
export function addKeeperArt(sprite, vector, source) {
  const art = {};
  function ribbon(accent, edge, degrees, reverse) {
    const a = (-degrees * Math.PI) / 180,
      r = 176,
      x = 32 + Math.cos(a) * r,
      y = 176 + Math.sin(a) * r;
    const inner = Math.min(11, degrees * 0.25);
    const a2 = a * 0.5,
      mx = 32 + Math.cos(a2) * (r - inner),
      my = 176 + Math.sin(a2) * (r - inner);
    const curve = `<path d="M${x} ${y} A176 176 0 0 1 208 176 Q${mx} ${my} ${x} ${y}Z" fill="url(#steel)"/><path d="M${x} ${y} A176 176 0 0 1 208 176" fill="none" stroke="${edge}" stroke-width="1.25" opacity=".8"/><path d="M${mx} ${my} Q203 154 206 170" fill="none" stroke="${accent}" stroke-width=".65" opacity=".38"/>`;
    return reverse
      ? `<g transform="translate(0 352) scale(1 -1)">${curve}</g>`
      : curve;
  }
  const growth = [];
  for (let form = 0; form < 3; form++) {
    const accent = ["#b99861", "#ad6256", "#96aaa7"][form];
    const edge = ["#ffe4b3", "#f5d4bb", "#e5e8d7"][form];
    for (let style = 0; style < 7; style++) {
      for (let live = 0; live < 2; live++) {
        let w = 200,
          h = 64,
          pivotX = 100,
          pivotY = 32,
          body = "";
        const defs = `<defs><linearGradient id="steel"><stop stop-color="${accent}" stop-opacity="0"/><stop offset=".55" stop-color="${accent}" stop-opacity=".12"/><stop offset=".88" stop-color="${accent}" stop-opacity=".6"/><stop offset="1" stop-color="${edge}" stop-opacity=".93"/></linearGradient><linearGradient id="metal" x2="0" y2="1"><stop stop-color="#171f20"/><stop offset=".42" stop-color="#4c4d43"/><stop offset=".55" stop-color="${edge}"/><stop offset=".62" stop-color="#655b4a"/><stop offset="1" stop-color="#1b2223"/></linearGradient></defs>`;
        if (style === 0 || style === 6) {
          w = 224;
          h = 352;
          pivotX = 32;
          pivotY = 176;
          // The leading edge is exactly on the tracked blade; the taper is
          // its recent path. Counter cuts mirror only the trail, not the body.
          body = ribbon(accent, edge, 58, style === 6);
          if (live)
            for (const degrees of [10, 24, 40])
              growth.push({
                name: `${form}-${style}-growth-${degrees}`,
                image: {
                  ...vector(
                    w,
                    h,
                    defs + ribbon(accent, edge, degrees, style === 6),
                  ),
                  pivotX,
                  pivotY,
                },
              });
        } else if (style === 1) {
          body = `<path d="M8 39 Q91 21 192 39 Q103 29 8 39" fill="url(#steel)"/><path d="M12 40l28-5 10 3 28-7 19 3 22-8 19 6 36-2 17 8" fill="none" stroke="${edge}" stroke-width="1.4" opacity=".8"/><path d="M40 33l-6-13m51 9l-4-20m37 19l7-18m30 22l9-13" stroke="${accent}" stroke-width="2" opacity=".7"/>`;
        } else if (style === 2 || style === 4) {
          for (let x = 8; x < 194; x += 12)
            body += `<ellipse cx="${x}" cy="32" rx="7.5" ry="2.6" fill="#141d1e" stroke="${style === 4 ? accent : "#716d5d"}" stroke-width="1.5"/><path d="M${x - 3} 30.5h6" stroke="${edge}" stroke-width=".7" opacity=".7"/>`;
        } else if (style === 3) {
          body = `<path d="M8 32L118 28Q154 5 192 14Q174 43 122 38L8 35Z" fill="url(#metal)" stroke="#776a50" stroke-width="1.4"/><path d="M122 38Q171 41 192 14" fill="none" stroke="${edge}" stroke-width="1.7"/><path d="M132 28l30-5" stroke="${accent}" stroke-width="1"/>`;
        } else {
          body = `<path d="M8 32L167 25 192 32 167 39Z" fill="url(#steel)"/><path d="M52 32H192" stroke="${edge}" stroke-width="1.8"/><path d="M80 26l89 3m-67 9 63-3" stroke="${accent}" stroke-width=".8" opacity=".6"/>`;
        }
        art[`${form}-${style}-${live ? "active" : "tell"}`] = {
          ...vector(w, h, defs + `<g opacity="${live ? 1 : 0.35}">${body}</g>`),
          pivotX,
          pivotY,
        };
      }
    }
  }
  for (const { name, image } of growth) art[name] = image;
  sprite(
    "KeeperLine",
    art,
    { visible: false, rotationStyle: "normal" },
    source,
  );
}
