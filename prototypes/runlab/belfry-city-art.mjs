// In-engine environment layers: the .xbp and browser use the same city art.
export async function addCityArt({ sprite, png, vector }) {
  const names = ["wind", "forge", "archive", "mirror", "heart"];
  const edges = [740, 1530, 2340, 3070];
  const centers = [-300, -1135, -1935, -2705, -3420];
  for (const [i, name] of names.entries()) {
    sprite(
      "District" + i,
      { scene: await png(`art/belfry/city/${name}.png`, 1100) },
      { x: 480, y: centers[i] },
      `onStart => {for {waitNextFrame(); d:=-cameraY-100; if practice==1 {d=0}; a:=${i === 0 ? "1.0" : `clamp((d-${edges[i - 1]}+100)/200,0,1)`}; if a<=0 ${i < 4 ? `|| d>${edges[i]}+100` : ""} {hide} else {show; setGraphicEffect GhostEffect,(1-a)*100; setXYpos 480,cameraY+(${centers[i]}-cameraY)*0.045}}}`,
    );
  }
  // Landmark silhouettes and mechanical routes are separate from background
  // paintings: painted distant architecture never implies collision.
  sprite(
    "CounterweightRail",
    {
      rail: vector(
        280,
        640,
        '<path d="M36 4v632M244 4v632" stroke="#171c21" stroke-width="11"/><path d="M36 4v632M244 4v632" stroke="#c7a06b" stroke-width="2" stroke-dasharray="8 6"/><circle cx="140" cy="25" r="24" fill="#1f2525" stroke="#ae8554" stroke-width="3"/><path d="M116 25H36m128 0h80" stroke="#997b50" stroke-width="3"/>',
      ),
    },
    { x: 455, y: -1210 },
    "onStart => {for {waitNextFrame(); if practice==1 {hide} else {show; if cityForge==1 {setGraphicEffect BrightnessEffect,12} else {setGraphicEffect BrightnessEffect,-30}}}}",
  );
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
    "onStart => {drain:=0.0; for {dt:=presentationDelta(float64(waitNextFrame())); target:=0.0; if cityArchive==1 {target=240}; drain+=(target-drain)*(1-exp(-dt*1.4)); setXYpos 480,-2060-drain+sin(visualTime)*3; if practice==1 {hide} else {show}}}",
  );
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? 828 : 132,
      y = -2380 - Math.floor(i / 2) * 210;
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
  const icons = [
    '<circle cx="42" cy="40" r="25"/><path d="M42 13q25 10 0 27Q17 30 42 13M69 43q-13 25-27-3 16-21 27 3M40 69q-25-10 2-29 19 14-2 29"/>',
    '<circle cx="42" cy="40" r="23"/><circle cx="42" cy="40" r="9"/><path d="M42 8v10m0 44v10M10 40h10m44 0h10M19 17l7 7m32 32 7 7M19 63l7-7m32-32 7-7"/>',
    '<path d="M17 17q13-8 25 1 12-9 25-1v47q-13-8-25 0-12-8-25 0zm25 1v46M25 30l10 2m-10 8 10 2m14-10 10-2m-10 12 10-2"/>',
    '<path d="m42 8 26 32-26 32-26-32Zm0 0v64M16 40h52M25 18l-13-7m47 7 13-7M25 63l-13 7m47-7 13 7"/>',
    '<circle cx="42" cy="40" r="28"/><path d="m42 14 12 25-12 28-12-28ZM13 40h16m26 0h16M42 2v9m0 59v9"/>',
  ];
  for (let i = 0; i < 5; i++) {
    sprite(
      "CityDevice" + i,
      {
        device: vector(
          84,
          126,
          `<path d="M16 124h52M26 120V81h32v39M21 81h42" fill="#192225" stroke="#8e8063" stroke-width="3"/><g fill="#1c292b" stroke="#c4a879" stroke-width="2">${icons[i]}</g><circle cx="42" cy="94" r="3" fill="#e2cb99"/>`,
        ),
      },
      { size: 0.6 },
      `onStart => {for {waitNextFrame(); setXYpos cityNodeX[${i}]+40,cityNodeY[${i}]+37.8; if practice==1 {hide} else {show; state:=${["cityWind", "cityForge", "cityArchive", "cityMirror", "cityChoice"][i]}; if state>0 {setGraphicEffect BrightnessEffect,20+sin(visualTime*2)*4} else {setGraphicEffect BrightnessEffect,0}}}}`,
    );
  }
  let wind = "";
  for (let i = 0; i < 20; i++)
    wind += `<path d="M${20 + ((i * 31) % 160)} ${i * 31}l4-32" stroke="#b8e5e9" stroke-width="${i % 3 ? 1 : 2}" opacity=".3"/>`;
  sprite(
    "WindColumn",
    { wind: vector(200, 700, wind) },
    {},
    "onStart => {for {waitNextFrame(); if cityWind==1 && practice==0 {show; setXYpos 735,-390+sin(visualTime*3)*18} else {hide}}}",
  );
}
