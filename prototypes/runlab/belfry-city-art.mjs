// In-engine environment layers: the .xbp and browser use the same city art.
export async function addCityArt({ sprite, png, vector, layout }) {
  const names = ["wind", "forge", "archive", "mirror", "heart"];
  const edges = layout.districtBounds.map((y) => -y);
  const centers = [0, ...layout.districtBounds].map(
    (top, i) => (top + (layout.districtBounds[i] ?? -layout.depth)) / 2,
  );
  for (const [i, name] of names.entries()) {
    sprite(
      "District" + i,
      { scene: await png(`art/belfry/city/${name}.png`, 1100) },
      { x: 480, y: centers[i] },
      `onStart => {for {waitNextFrame(); d:=-cameraY-100; if practice==1 {d=0}; a:=${i === 0 ? "1.0" : `clamp((d-${edges[i - 1]}+100)/200,0,1)`}; if a<=0 ${i < 4 ? `|| d>${edges[i]}+100` : ""} {hide} else {show; light:=0.0; if segment==2 {light=-12}; setGraphicEffect BrightnessEffect,light; setGraphicEffect GhostEffect,(1-a)*100; setXYpos 480,cameraY+(${centers[i]}-cameraY)*0.045}}}`,
    );
  }
  // Landmark silhouettes and mechanical routes are separate from background
  // paintings: painted distant architecture never implies collision.
  sprite(
    "ArchiveTide",
    {
      water: vector(
        1000,
        360,
        '<defs><linearGradient id="t" x2="0" y2="1"><stop stop-color="#8dcbcc" stop-opacity=".3"/><stop offset=".12" stop-color="#0e3e48" stop-opacity=".32"/><stop offset="1" stop-color="#071c27" stop-opacity="0"/></linearGradient></defs><path d="M0 10q125-10 250 0t250 0t250 0t250 0v350H0Z" fill="url(#t)"/><path d="M0 10q125-10 250 0t250 0t250 0t250 0" fill="none" stroke="#b9e6df" stroke-opacity=".4"/>',
      ),
    },
    {},
    "onStart => {drain:=0.0; for {dt:=presentationDelta(float64(waitNextFrame())); target:=0.0; if cityArchive==1 {target=240}; drain+=(target-drain)*(1-exp(-dt*1.4)); setXYpos 480,roomTop[6]-540-drain+sin(visualTime)*3; if practice==1 {hide} else {show}}}",
  );
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? 828 : 132,
      y = layout.rooms[9].top - 80 - Math.floor(i / 2) * 210;
    sprite(
      "ChoirShard" + i,
      {
        shard: vector(
          130,
          230,
          '<defs><linearGradient id="m"><stop stop-color="#111a2c"/><stop offset=".45" stop-color="#9dabc0" stop-opacity=".5"/><stop offset=".49" stop-color="#e9e2ef" stop-opacity=".8"/><stop offset=".52" stop-color="#1d263d"/><stop offset="1" stop-color="#6d8392" stop-opacity=".3"/></linearGradient></defs><path d="M35 3 120 56 94 222 8 168Z" fill="url(#m)" stroke="#b0afc1" stroke-width="1.5"/><path d="m35 3 28 122 31 97m-31-97 57-69M8 168l55-43" stroke="#d8d9df" stroke-opacity=".45" fill="none"/>',
        ),
      },
      { x, y, rotationStyle: "normal" },
      `onStart => {for {waitNextFrame(); setXYpos ${x},${y}+sin(visualTime*0.25+${i})*5; setHeading 90+sin(visualTime*0.2+${i})*3; if practice==1 {hide} else {show}}}`,
    );
  }
  let wind = "";
  for (let i = 0; i < 20; i++)
    wind += `<path d="M${20 + ((i * 31) % 160)} ${i * 31}l4-32" stroke="#b8e5e9" stroke-width="${i % 3 ? 1 : 2}" opacity=".3"/>`;
  sprite(
    "WindColumn",
    { wind: vector(200, 700, wind) },
    {},
    "onStart => {for {waitNextFrame(); if cityWind==1 && practice==0 {show; setXYpos 735,clamp(cameraY,roomBottom[2]+350,-390)+sin(visualTime*3)*18} else {hide}}}",
  );
}
