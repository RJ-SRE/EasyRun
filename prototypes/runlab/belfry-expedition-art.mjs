// Small native vector mechanisms share geometry/state with the simulation.
// They complement the existing painted city without covering the play field.
export async function addExpeditionArt({ sprite, vector, code, layout }) {
  const weightLift = layout.lifts.find((lift) => lift.room === 3);
  const ceiling = layout.rooms[3].top - 55;
  for (const [side, floor] of [
    weightLift.floor,
    layout.counterweightFloor,
  ].entries())
    sprite(
      `WeightCable${side}`,
      {
        chain: vector(
          12,
          700,
          '<path d="M4 0v700M8 0v700" stroke="#a08e68" stroke-width="2" opacity=".8"/><path d="M6 0v700" stroke="#d5be86" stroke-width="4" stroke-dasharray="3 10" opacity=".6"/>',
        ),
      },
      { visible: false },
      `onStart => {for {waitNextFrame(); i:=${floor}; if practice==0 && abs(cameraY-(${ceiling}-350))<1000 {show; setXYpos floorX[i]+floorW[i]/2,(${ceiling}+floorY[i])/2; setSize (${ceiling}-floorY[i])/700} else {hide}}}`,
    );
  sprite(
    "WeightCrown",
    {
      rig: vector(
        280,
        74,
        '<defs><linearGradient id="r" x2="0" y2="1"><stop stop-color="#837558"/><stop offset=".2" stop-color="#30352f"/><stop offset=".8" stop-color="#111d23"/><stop offset="1" stop-color="#706246"/></linearGradient><radialGradient id="p"><stop stop-color="#9a8863"/><stop offset=".22" stop-color="#34372f"/><stop offset=".8" stop-color="#111d23"/><stop offset="1" stop-color="#756446"/></radialGradient></defs><path d="M4 26h272v13H4ZM25 12h230v5H25ZM30 17l22 9m176 0 22-9" fill="url(#r)" stroke="#4d4b3c"/><path d="M8 27h264M14 37h252" stroke="#b19b70" stroke-width=".7" opacity=".6"/><g fill="url(#p)" stroke="#867450" stroke-width="1.2"><circle cx="61" cy="35" r="18"/><circle cx="219" cy="35" r="18"/></g><g fill="none" stroke="#93815e" stroke-width="1" opacity=".7"><circle cx="61" cy="35" r="12"/><circle cx="219" cy="35" r="12"/><path d="M49 35h24m-12-12v24M207 35h24m-12-12v24M90 29h100"/></g><g fill="#b69b69"><circle cx="61" cy="35" r="3"/><circle cx="219" cy="35" r="3"/><circle cx="16" cy="32" r="1.5"/><circle cx="264" cy="32" r="1.5"/></g>',
      ),
    },
    { x: 416.5, y: ceiling + 3 },
    `onStart => {for {waitNextFrame(); if practice==1 || abs(cameraY-(${ceiling}))>800 {hide} else {show}}}`,
  );
  // This thin dashed connection is a readable cooperation cue, never damage.
  sprite(
    "HunterRelay",
    {
      link: vector(
        400,
        16,
        '<path d="M12 8h376" stroke="#bda77e" stroke-width="1.2" stroke-dasharray="3 15" opacity=".5"/><path d="m0 8 7-5 5 5-5 5ZM388 8l5-5 7 5-7 5Z" fill="#c5b18b" opacity=".65"/>',
      ),
    },
    { visible: false, rotationStyle: "normal" },
    "onStart => {for {waitNextFrame(); if practice==0 && hunterLinked && abs(cameraY-enemyY[hunterLeft])<600 {show; ax:=enemyX[hunterLeft]; ay:=enemyY[hunterLeft]+36; bx:=enemyX[hunterRight]; by:=enemyY[hunterRight]+36; setXYpos (ax+bx)/2,(ay+by)/2; setHeading angle(bx-ax,by-ay); setSize dist(bx-ax,by-ay)/400} else {hide}}}",
  );
  const shapes = [
    '<path d="M25 18h34v22H25zM42 40v22m-14 0h28M18 74h48"/><path d="m34 24 8 8 8-8"/>',
    '<circle cx="42" cy="38" r="21"/><circle cx="42" cy="38" r="8"/><path d="M42 9v10m0 38v10M13 38h10m38 0h10M22 18l7 7m26 26 7 7M22 58l7-7m26-26 7-7"/>',
    '<path d="M21 18q12-6 21 2 9-8 21-2v43q-12-6-21 1-9-7-21-1ZM42 20v42M28 31l8 2m12 0 8-2M28 43l8 2m12 0 8-2"/>',
    '<path d="m42 12 25 25-25 29-25-29ZM42 12v54M17 37h50"/>',
    '<path d="M31 20h22l5 34-16 12-16-12ZM34 20v-7h16v7M26 54h32"/><path d="m42 28 6 14-6 9-6-9Z"/>',
    '<path d="M18 25h48v31H18zM18 25l24 18 24-18M18 56l17-17m14 0 17 17M33 18h18"/>',
    '<path d="M29 18h26l5 21-7 23H31l-7-23ZM30 24h24v12H30zM24 39 12 47l7 17m41-25 12 8-7 17M33 62l-8 13m26-13 8 13"/><circle cx="36" cy="30" r="2"/><circle cx="48" cy="30" r="2"/><path d="M34 47h16m-8-6v12"/>',
  ];
  const images = {};
  for (let i = 0; i < shapes.length; i++)
    for (let state = 0; state < 3; state++) {
      const color = ["#b99a68", "#a7d9c3", "#f0c579"][state];
      images[`device${i}-${state}`] = vector(
        84,
        96,
        `<path d="M12 92h60M23 87h38l-5-15H28Z" fill="#182529" stroke="#736a55" stroke-width="2"/><g fill="#132126" stroke="${color}" stroke-width="2">${shapes[i]}</g>${state === 1 ? '<path d="m33 77 6 5 13-12" fill="none" stroke="#a7d9c3" stroke-width="2"/>' : ""}${state === 2 ? '<circle cx="42" cy="38" r="33" fill="none" stroke="#f0c579" stroke-dasharray="8 16"/>' : ""}`,
      );
    }
  sprite(
    "ExpeditionNode",
    images,
    { visible: false, size: 0.75 },
    await code("ExpeditionNode"),
  );
  sprite(
    "ArchiveLamp",
    {
      light: vector(
        120,
        140,
        '<defs><radialGradient id="l"><stop stop-color="#d9e8c6" stop-opacity=".3"/><stop offset="1" stop-color="#a7ddc2" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="64" rx="58" ry="60" fill="url(#l)"/><path d="M47 36h26l7 40-20 16-20-16ZM47 36l4-12h18l4 12M44 76h32" fill="#253035" stroke="#d5c699" stroke-width="2"/><path d="m60 43 8 18-8 14-8-14Z" fill="#dfeec9"/><path d="M54 93l-5 21m17-21 5 21" stroke="#8d876a"/>',
      ),
    },
    { visible: false, size: 0.65 },
    "onStart => {for {waitNextFrame(); if practice==0 && abs(Hero.py-lampY)<650 {show; setXYpos lampX,lampY+sin(visualTime*2)*3} else {hide}}}",
  );
  const lantern = vector(
    160,
    160,
    '<defs><radialGradient id="q"><stop stop-color="#e7daa0" stop-opacity=".44"/><stop offset="1" stop-color="#e7daa0" stop-opacity="0"/></radialGradient></defs><circle cx="80" cy="80" r="78" fill="url(#q)"/><path d="M72 64h16l4 26-12 10-12-10ZM73 63v-7h14v7" fill="#283237" stroke="#cfbb88" stroke-width="2"/><path d="m80 71 4 10-4 9-4-9Z" fill="#f5dfa1"/>',
  );
  sprite(
    "CarriedLantern",
    { light: lantern },
    { visible: false, size: 0.65 },
    "onStart => {for {waitNextFrame(); if practice==0 && sideProgress[4]==1 && phase!=0 {show; setXYpos Hero.px-26*Hero.facing/90,Hero.py+42+sin(visualTime*3)*3} else {hide}}}",
  );
  const restoredLight = layout.platforms.find((p) => p[3] === 64);
  sprite(
    "ReturnLantern",
    { light: lantern },
    { visible: false, size: 1.7 },
    `onStart => {for {waitNextFrame(); if practice==0 && sideProgress[4]>=2 && segment==2 && abs(cameraY-(${restoredLight[2]}))<700 {show; setXYpos ${restoredLight[0] + restoredLight[1] / 2},${restoredLight[2] + 60}} else {hide}}}`,
  );
  // A copied directory adds actual wayfinding. The markers use permanent
  // authored anchors, never advertise a decorative or unearned platform.
  sprite(
    "DirectoryGuide",
    {
      guide: vector(
        40,
        48,
        '<path d="m10 22 10-11 10 11M20 11v27M13 37h14" fill="none" stroke="#bcdcc5" stroke-width="2" opacity=".85"/>',
      ),
    },
    { visible: false },
    "onCloned data => {slot:=data.(int); for {waitNextFrame(); room:=sceneGuides[slot]; if room>=0 {i:=guideAnchor[room]; show; setXYpos anchorX[i]+32,anchorY[i]+34; setSize 0.7} else {hide}}}",
  );
  const vent = {};
  for (let i = 0; i < 3; i++)
    vent["vent" + i] = vector(
      160,
      180,
      `<path d="M18 166h124l-12-14H30Z" fill="#22292b" stroke="#9b7954" stroke-width="2"/><path d="M35 155v10m15-10v10m15-10v10m15-10v10m15-10v10m15-10v10m15-10v10" stroke="#c09c6e"/>${i ? `<path d="M27 150V23h106v127" stroke="${i === 1 ? "#c99f62" : "#f4ac6c"}" fill="${i === 1 ? "none" : "#d67e48"}" fill-opacity=".24" stroke-dasharray="${i === 1 ? "6 9" : "2 0"}"/><path d="M45 140q-15-35 8-66t0-44m28 110q-20-28 0-58t0-50m28 110q15-26-5-52t6-56" fill="none" stroke="#f4be85" opacity=".65"/>` : ""}`,
    );
  sprite(
    "HeatVent",
    vent,
    { visible: false },
    "onCloned data => {slot:=data.(int); for {waitNextFrame(); i:=sceneHeats[slot]; if i>=0 {show; setCostume heatState[i]; setSize heatWidth[i]/106; setXYpos heatX[i],heatY[i]+60*heatWidth[i]/106} else {hide}}}",
  );
  for (const [i, g] of layout.ghosts.entries())
    sprite(
      "FalseBridge" + i,
      {
        ghost: vector(
          300,
          65,
          '<path d="M0 8h300M0 16h300M20 20l25 35m35-35 25 35m35-35 25 35m35-35 25 35m35-35 25 35" fill="none" stroke="#b2a8cd" stroke-width="2" stroke-dasharray="5 7" opacity=".35"/>',
        ),
      },
      { x: g.x + g.width / 2, y: g.y - 24, size: g.width / 300 },
      "onStart => {for {waitNextFrame(); if practice==1 {hide} else {show}}}",
    );
}
