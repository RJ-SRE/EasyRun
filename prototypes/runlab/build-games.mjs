import { mkdir, writeFile } from "node:fs/promises";
const out = new URL("./", import.meta.url);
const W = 7200,
  H = 540;
const sg = (w, h, s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
function runner(color, pose, frame = 0) {
  const swing = Math.sin((frame * Math.PI) / 3) * 12;
  if (pose === "slide")
    return sg(
      64,
      56,
      `<path d="M9 48L29 43 47 48 60 47" stroke="#101d29" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M16 44L32 35 44 41" stroke="${color}" stroke-width="12" stroke-linecap="round" fill="none"/><circle cx="39" cy="27" r="7" fill="#f6ebd9"/><path d="M39 24h8v4h-8" fill="#182431"/>`,
    );
  const airborne = ["jump", "dash", "spin"].includes(pose),
    bend = pose === "dash" ? 12 : 0;
  return sg(
    64,
    56,
    `<g transform="translate(${bend} 0) ${pose === "spin" ? "rotate(-30 27 30)" : ""}"><path d="M25 32L${airborne ? 12 : 24 + swing} ${airborne ? 37 : 43}L${airborne ? 8 : 22 + swing} 51M27 33L${airborne ? 40 : 28 - swing} ${airborne ? 39 : 43}L${airborne ? 47 : 32 - swing} ${airborne ? 43 : 51}" fill="none" stroke="#d8e4e6" stroke-width="6" stroke-linecap="round"/><path d="M26 20L24 33" stroke="${color}" stroke-width="13" stroke-linecap="round"/><path d="M25 22L${airborne ? 11 : 14 - swing / 2} ${airborne ? 15 : 30}M30 22L${airborne ? 43 : 42 + swing / 2} ${airborne ? 21 : 29}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="29" cy="10" r="7" fill="#f5e7d1"/><path d="M27 7h10v5H27" fill="#172335"/><path d="M20 18L4 ${pose === "dash" ? 13 : 23}" stroke="${color}" stroke-width="4" stroke-linecap="round"/></g>`,
  );
}
const platformSets = {
  velocity: [
    [0, 1060, -140],
    [1460, 1360, -140],
    [3260, 1460, -140],
    [5180, 2020, -140],
    [1215, 90, -10],
    [3030, 100, 5],
    [4930, 95, 0],
  ],
  cinema: [
    [0, 2760, -140],
    [2950, 3060, -140],
    [6200, 1000, -140],
    [820, 90, -140],
    [4220, 90, -140],
  ],
};
function background(id, platforms) {
  const film = id === "cinema",
    accent = film ? "#f2b75e" : "#64e8d7";
  let s = `<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${film ? "#182135" : "#0c2435"}"/><stop offset="1" stop-color="${film ? "#293447" : "#164352"}"/></linearGradient><pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="${accent}" stroke-opacity=".035"/></pattern></defs><path fill="url(#sky)" d="M0 0h${W}v540H0z"/><path fill="url(#grid)" d="M0 0h${W}v540H0z"/>`;
  for (let i = 0; i < 65; i++) {
    const x = i * 117,
      hh = 80 + ((i * 59) % 190);
    s += `<path fill="${film ? "#323c4c" : "#1e4352"}" opacity=".48" d="M${x} ${410 - hh}h91v${hh}h-91z"/>`;
    for (let j = 0; j < 4; j++)
      s += `<path stroke="${accent}" opacity=".10" d="M${x + 12 + j * 19} ${420 - hh}v${hh - 25}"/>`;
  }
  for (let i = 0; i < 9; i++)
    s += `<circle cx="${440 + i * 870}" cy="${80 + (i % 3) * 20}" r="${film ? 2 : 4}" fill="${accent}" opacity=".4"/>`;
  for (const [x, width, y] of platforms) {
    const top = 270 - y;
    if (y > -140) {
      s += `<path d="M${x} ${top}h${width}l-8 14h-${width - 16}z" fill="#204b59" stroke="${accent}" stroke-width="2"/><path d="M${x + 12} ${top + 24}v70m${width - 24} -70v70" stroke="${accent}" stroke-width="2" opacity=".12"/>`;
    } else {
      s += `<path fill="#0b1825" d="M${x} ${top}h${width}v${540 - top}H${x}z"/><path stroke="${accent}" stroke-width="3" d="M${x} ${top}h${width}"/><path stroke="#35515b" stroke-width="2" d="M${x} ${top + 12}h${width}"/>`;
      for (let xx = x + 25; xx < x + width - 20; xx += 80)
        s += `<path d="M${xx} ${top + 30}v80m0-60h40" stroke="#223643" fill="none"/>`;
    }
  }
  const labels = film
    ? [
        [180, "SCENE 01 / THE NIGHT SHIFT"],
        [800, "01 / VAULT"],
        [1750, "02 / SLIDE"],
        [2550, "03 / AIRTIME"],
        [4100, "04 / VAULT"],
        [5150, "05 / SLIDE"],
        [5800, "06 / FINALE"],
      ]
    : [
        [120, "KINETIC DISTRICT / 04"],
        [650, "01 / TAKE THE SPEED"],
        [2350, "02 / FIND YOUR LINE"],
        [4250, "03 / ONE LAST TRANSFER"],
      ];
  for (const [x, t] of labels)
    s += `<path d="M${x} 170h90m-10-7l10 7-10 7" stroke="${accent}" opacity=".35" stroke-width="2" fill="none"/>`;
  if (!film) {
    for (const [x] of [[820], [2580], [4490]])
      s += `<path d="M${x - 210} 385h600" stroke="#3c6470" stroke-width="7"/><path d="M${x - 210} 380h600" stroke="#7dabae" stroke-width="1"/>`;
  } else {
    for (const x of [920, 4320])
      s += `<path d="M${x - 35} 410v-42h70v42" fill="#845f42" stroke="#cda36c" stroke-width="2"/><path d="M${x - 30} 373l60 33m0-33l-60 33" stroke="#cda36c" opacity=".6"/>`;
    for (const x of [1930, 5350])
      s += `<path fill="#845f42" stroke="#d2ab79" stroke-width="3" d="M${x - 110} 302h220v72h-220z"/><path stroke="#f2b75e" stroke-width="2" stroke-dasharray="7 7" d="M${x - 110} 381h220"/><path d="M${x - 18} 328v22m-7-7l7 7 7-7m22-15v22m-7-7l7 7 7-7" stroke="#eed2aa" stroke-width="2" fill="none"/>`;
  }
  s += `<path fill="${accent}" opacity=".08" d="M6780 110h110v300h-110z"/><path stroke="${accent}" stroke-width="4" fill="none" d="M6790 410V155h90v255"/><path d="M6805 125h60m-10-8l10 8-10 8" stroke="${accent}" stroke-width="3" fill="none"/>`;
  return sg(W, H, s);
}
function addSprite(files, name, images, config = {}, code = "") {
  files[`assets/sprites/${name}/index.json`] = JSON.stringify({
    x: 0,
    y: 0,
    heading: 90,
    size: 1,
    rotationStyle: "none",
    physicsMode: "no",
    visible: true,
    collisionShapeType: "none",
    triggerShapeType: "none",
    costumes: Object.entries(images).map(([n, a]) => ({
      name: n,
      path: n + ".svg",
      x: a.w / 2,
      y: a.h / 2,
      bitmapResolution: 1,
    })),
    costumeIndex: 0,
    ...config,
  });
  for (const [n, a] of Object.entries(images))
    files[`assets/sprites/${name}/${n}.svg`] = a.svg;
  files[name + ".spx"] = code;
}
function mainCode(id, platforms) {
  const film = id === "cinema";
  return `var (
 phase int
 elapsed float64
 score int
 combo int
 bestCombo int
 energy int
 attempts int
 steals int
 launches int
 styleCount int
 failReason int
 floorX []float64
 floorW []float64
 floorY []float64
 donorX []float64
 donorBase []float64
 donorDX []float64
 donorDir []float64
 donorCool []float64
 beats []int
 lastState float64
 isCinema bool
)
func event(name string) { println "@event", name, elapsed, Hero.px }
func resetRun() {
 phase=1; elapsed=0; score=0; combo=0; bestCombo=0; energy=0; steals=0; launches=0; styleCount=0; failReason=0
 attempts++
 beats=[]int{0,0,0,0,0,0}
 donorX=[]float64{820,2580,4490}
 donorDX=[]float64{0,0,0}
 donorDir=[]float64{1,1,1}
 donorCool=[]float64{0,0,0}
 Hero.resetHero()
 event("start")
}
func finishRun() {
 if phase!=1 {return}
 phase=2
 score+=int(60-elapsed)*10
 event("finish")
}
func failRun(reason int) {
 if phase!=1 {return}
 phase=3; failReason=reason
 event("fail")
}
func capture(beat int, good bool) {
 if beats[beat]!=0 {return}
 if good {beats[beat]=1; combo++; styleCount++; score+=200+combo*50; if combo>bestCombo {bestCombo=combo}; event("beat")
 } else {beats[beat]=-1; combo=0; event("miss")}
}
onKey KeyR, => { resetRun() }
onKey KeyEnter, => { if phase==4 {phase=1} else if phase!=1 {resetRun()} }
onKey KeyEscape, => { if phase==1 {phase=4} else if phase==4 {phase=1} }
onStart => {
 isCinema=${film}
 floorX=[]float64{${platforms.map((x) => x[0]).join(",")}}
 floorW=[]float64{${platforms.map((x) => x[1]).join(",")}}
 floorY=[]float64{${platforms.map((x) => x[2]).join(",")}}
 donorBase=[]float64{820,2580,4490}
 donorX=[]float64{820,2580,4490}
 donorDX=[]float64{0,0,0}
 donorDir=[]float64{1,1,1}
 donorCool=[]float64{0,0,0}
 beats=[]int{0,0,0,0,0,0}
 Hero.resetHero()
 for {
  dt:=float64(waitNextFrame())
  if dt>0.04 {dt=0.04}
  if phase==1 {
   elapsed+=dt
   if elapsed>60 {failRun(3)}
   if !isCinema { for i:=0;i<3;i++ {
    if donorCool[i]>0 {donorCool[i]-=dt}
    speed:=120.0
    if donorCool[i]>0 {speed=8}
    donorDX[i]=speed*donorDir[i]*dt
    donorX[i]+=donorDX[i]
    if donorX[i]>donorBase[i]+180 {donorDir[i]=-1}
    if donorX[i]<donorBase[i]-140 {donorDir[i]=1}
   }}
  }
  now:=float64(timer)
  if now-lastState>0.08 {
   lastState=now
   println "@state",phase,elapsed,score,combo,bestCombo,energy,Hero.px,Hero.py,attempts,steals,launches,styleCount,failReason,beats[0],beats[1],beats[2],beats[3],beats[4],beats[5]
  }
 }
}`;
}
const heroCode = `var (
 px float64
 py float64
 vx float64
 vy float64
 grounded bool
 coyote float64
 buffer float64
 dashTime float64
 spinTime float64
 vaultTime float64
 prevJump bool
 prevAction bool
 prevSlide bool
 sliding bool
 ridden int
 trailAt float64
 animationClock float64
 vaultAt float64
 spinAt float64
 lastLand float64
)
func resetHero() {
 px=110; py=-140; vx=0; vy=0; grounded=true; coyote=0.1; buffer=0; dashTime=0; spinTime=0; vaultTime=0; prevJump=false; prevAction=false; sliding=false; ridden=-1; trailAt=0; animationClock=0; vaultAt=-1000; spinAt=-1000
 setXYpos px,py+28
 setCostume "idle"
 Camera.setXYpos 480,0
}
func action() {
 if isCinema {
  if grounded && ((px>770 && px<965)||(px>4170 && px<4365)) {
   vy=440; vx=470; vaultTime=0.28; grounded=false; coyote=0; vaultAt=px
   event("vault")
  } else if !grounded && spinTime<=0 {
   spinTime=0.30; spinAt=px; event("spin")
  }
 } else {
  if energy==1 {
   energy=0; launches++; dashTime=0.38; grounded=false; coyote=0; ridden=-1
   if keyPressed(KeyW)||keyPressed(KeyUp) {vx=650; vy=630} else {vx=960; vy=420}
   event("launch")
  } else {
   found:=-1
   for i:=0;i<3;i++ {
    if abs(px-donorX[i])<170 && abs(py+80)<140 && donorCool[i]<=0 {found=i}
   }
   if found>=0 {energy=1; donorCool[found]=5; steals++; score+=100; event("steal")} else {event("empty")}
  }
 }
}
onStart => {
 for {
  dt:=float64(waitNextFrame())
  if dt>0.04 {dt=0.04}
  if phase==1 {
  animationClock+=dt
  jump:=keyPressed(KeySpace)||keyPressed(KeyW)||keyPressed(KeyUp)
  act:=keyPressed(KeyE)||keyPressed(KeyShift)
  slide:=keyPressed(KeyS)||keyPressed(KeyDown)
  if jump && !prevJump {buffer=0.12}
  if act && !prevAction {action()}
  if !jump && prevJump && vy>180 && dashTime<=0 && vaultTime<=0 {vy*=0.55}
  prevJump=jump; prevAction=act; prevSlide=slide
  if grounded {coyote=0.10} else {coyote-=dt}
  if buffer>0 {buffer-=dt}
  if buffer>0 && coyote>0 && !slide {vy=600; buffer=0; coyote=0; grounded=false; ridden=-1; event("jump")}
  sliding=slide && grounded
  if dashTime>0 {dashTime-=dt} else if vaultTime>0 {vaultTime-=dt} else {
   target:=0.0
   if keyPressed(KeyD)||keyPressed(KeyRight) {target=300}
   if keyPressed(KeyA)||keyPressed(KeyLeft) {target=-260}
   acceleration:=1900.0
   if !grounded {acceleration=850}
   if vx<target {vx+=acceleration*dt; if vx>target {vx=target}}
   if vx>target {vx-=acceleration*dt; if vx<target {vx=target}}
  }
  if spinTime>0 {spinTime-=dt}
  if ridden>=0 && grounded && !isCinema {px+=donorDX[ridden]}
  oldX:=px; oldY:=py
  px+=vx*dt
  vy-=1650*dt
  if vy < -950 {vy=-950}
  py+=vy*dt
  grounded=false; ridden=-1
  if vy<=0 {
   for i:=0;i<len(floorX);i++ {
    top:=floorY[i]
    if px+12>floorX[i] && px-12<floorX[i]+floorW[i] && oldY>=top-3 && py<=top {
     py=top; vy=0; grounded=true
    }
   }
   if !isCinema {for i:=0;i<3;i++ {
    if px+12>donorX[i]-70 && px-12<donorX[i]+70 && oldY>=-83 && py<=-80 {py=-80; vy=0; grounded=true; ridden=i}
   }}
  }
  if isCinema {
   height:=48.0
   if sliding {height=24}
   for _,cx:=range []float64{920,4320} {
    if px+12>cx-35 && px-12<cx+35 && py < -98 && py+height > -140 {
     if vaultTime>0 {py=-98} else {if oldX+12<=cx-35 {px=cx-48}; failRun(2)}
    }
   }
   for _,cx:=range []float64{1930,5350} {
    if px+12>cx-110 && px-12<cx+110 && py < -32 && py+height > -104 {failRun(2)}
   }
   if px>975 {capture(0,vaultAt>770 && vaultAt<965)}
   if px>2055 {capture(1,sliding)}
   if px>2960 && grounded {capture(2,spinAt>2620 && spinAt<3000)}
   if px>4375 {capture(3,vaultAt>4170 && vaultAt<4365)}
   if px>5475 {capture(4,sliding)}
   if px>6210 && grounded {capture(5,spinAt>5860 && spinAt<6250)}
  }
  if px<40 {px=40; vx=0}
  if py < -310 {failRun(1)}
  if px>6850 {finishRun()}
  cameraX:=px+220
  if cameraX<480 {cameraX=480}
  if cameraX>6720 {cameraX=6720}
  Camera.setXYpos cameraX,0
  setXYpos px,py+28
  if vx < -10 {setHeading Left} else {setHeading Right}
  if sliding {setCostume "slide"} else if spinTime>0 {setCostume "spin"} else if dashTime>0 {setCostume "dash"} else if !grounded {setCostume "jump"} else if abs(vx)>30 {setCostume int(animationClock*14)%6+1} else {setCostume "idle"}
  if (dashTime>0 || spinTime>0 || vaultTime>0) && animationClock-trailAt>0.045 {
   trailAt=animationClock
   Trail.clone []float64{px,py+28}
  }
  }
 }
}`;
for (const id of ["velocity", "cinema"]) {
  const files = {};
  const color = id === "velocity" ? "#74f1d2" : "#f3b85f";
  const platforms = platformSets[id];
  addSprite(
    files,
    "Backdrop",
    { scene: { w: W, h: H, svg: background(id, platforms) } },
    { x: W / 2, y: 0 },
  );
  const images = { idle: { w: 64, h: 56, svg: runner(color, "idle") } };
  for (let i = 0; i < 6; i++)
    images["run" + i] = { w: 64, h: 56, svg: runner(color, "run", i) };
  for (const pose of ["jump", "dash", "slide", "spin"])
    images[pose] = { w: 64, h: 56, svg: runner(color, pose) };
  addSprite(
    files,
    "Hero",
    images,
    { x: 110, y: -112, rotationStyle: "left-right" },
    heroCode,
  );
  addSprite(
    files,
    "Trail",
    { trail: { w: 64, h: 56, svg: runner(color, "dash") } },
    { visible: false },
    `onCloned data => {
 p:=data.([]float64)
 setXYpos p[0],p[1]
 setGraphicEffect GhostEffect,65
 show
 wait 0.12
 die
}`,
  );
  addSprite(
    files,
    "Aura",
    {
      aura: {
        w: 88,
        h: 88,
        svg: sg(
          88,
          88,
          `<circle cx="44" cy="44" r="35" stroke="${color}" stroke-width="2" stroke-dasharray="8 12" fill="none" opacity=".6"/><circle cx="44" cy="44" r="42" stroke="${color}" stroke-width="1" fill="none" opacity=".15"/>`,
        ),
      },
    },
    { visible: false },
    `onStart => {for {waitNextFrame(); if energy>0 {show; setXYpos Hero.px,Hero.py+28} else {hide}}}`,
  );
  const donors = [];
  if (id === "velocity")
    for (let i = 0; i < 3; i++) {
      const img = (c) =>
        sg(
          140,
          56,
          `<path d="M2 12L18 2h104l16 10v33H2z" fill="#173442" stroke="${c}" stroke-width="2"/><path d="M20 9h72v17H20z" fill="${c}" opacity=".16"/><path d="M32 8v19m20-19v19m20-19v19" stroke="${c}" opacity=".4"/><path d="M100 8l12 12-12 12" fill="none" stroke="${c}" stroke-width="3"/><circle cx="24" cy="49" r="6" fill="#07151c" stroke="${c}"/><circle cx="115" cy="49" r="6" fill="#07151c" stroke="${c}"/>`,
        );
      const name = "Donor" + i;
      donors.push(name);
      addSprite(
        files,
        name,
        {
          charged: { w: 140, h: 56, svg: img("#64ead5") },
          drained: { w: 140, h: 56, svg: img("#657982") },
        },
        { x: [820, 2580, 4490][i], y: -108 },
        `onStart => {for {waitNextFrame(); if len(donorX)>${i} {setXYpos donorX[${i}],-108; if donorCool[${i}]>0 {setCostume "drained"} else {setCostume "charged"}}}}`,
      );
    }
  files["assets/index.json"] = JSON.stringify({
    map: { width: 15000, height: 1080 },
    run: { width: 960, height: 540 },
    maxFPS: 60,
    physics: false,
    autoSetCollisionLayer: true,
    zorder: ["Backdrop", ...donors, "Trail", "Aura", "Hero"],
  });
  files["main.spx"] = mainCode(id, platforms);
  const dir = new URL(`projects/${id}/`, out);
  await mkdir(dir, { recursive: true });
  for (const [p, data] of Object.entries(files)) {
    const dest = new URL(p, dir);
    await mkdir(new URL(".", dest), { recursive: true });
    await writeFile(dest, data);
  }
  await writeFile(new URL(`public/${id}.json`, out), JSON.stringify(files));
  console.log("Built", id, Object.keys(files).length, "files");
}
