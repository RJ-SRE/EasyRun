// One fixed layer behind actors. All gradients and mist are authored once;
// no particles, post-processing buffers, gameplay hitboxes or new clone pools.
export function addKeeperAtmosphere(sprite, vector, source) {
  const forms = [];
  for (let stage = 0; stage < 3; stage++) {
    const color = ["#d0bd83", "#c65460", "#b8d6df"][stage];
    let motes = "";
    for (let i = 0; i < 16; i++) {
      const x = 90 + ((i * 163) % 920),
        y = 60 + ((i * 97) % 550);
      motes += `<path d="M${x} ${y}l2 -${stage === 2 ? 14 : 4}" stroke="${color}" stroke-opacity=".23" stroke-width="${i % 3 === 0 ? 2 : 1}"/>`;
    }
    const veins =
      stage === 1
        ? '<g fill="none" stroke="#180b20" stroke-width="5" stroke-opacity=".7"><path d="M0 54q120 30 165 160l90 35m-90-35 12-81M1100 86q-118 24-150 170l-72 42m72-42-26-95"/></g>'
        : "";
    const halo =
      stage === 2
        ? '<circle cx="605" cy="185" r="107" fill="#090d1c" fill-opacity=".65"/><path d="M499 176a107 107 0 0 1 205-38M523 253a107 107 0 0 0 175-13" fill="none" stroke="#d3e4df" stroke-width="2" stroke-opacity=".36"/><path d="M605 56v29m0 200v30" stroke="#b0b5d3" stroke-opacity=".32"/>'
        : "";
    forms.push(
      vector(
        1100,
        760,
        `<defs><radialGradient id="edge"><stop offset=".32" stop-color="#01030b" stop-opacity="0"/><stop offset="1" stop-color="${stage === 2 ? "#100c26" : "#0c0810"}" stop-opacity="${stage === 0 ? 0.15 : 0.48}"/></radialGradient><linearGradient id="fog" x2="0" y2="1"><stop stop-color="${color}" stop-opacity="0"/><stop offset=".6" stop-color="${color}" stop-opacity="${stage === 0 ? 0.04 : 0.13}"/><stop offset="1" stop-color="#080b17" stop-opacity=".3"/></linearGradient></defs><path d="M0 0h1100v760H0z" fill="url(#edge)"/>${halo}${veins}<path d="M0 485q150-65 310 0t330-5t460-30v310H0Z" fill="url(#fog)"/>${motes}`,
      ),
    );
  }
  sprite(
    "KeeperAtmosphere",
    Object.fromEntries(forms.map((im, i) => ["form-" + i, im])),
    { visible: false },
    source,
  );
}
