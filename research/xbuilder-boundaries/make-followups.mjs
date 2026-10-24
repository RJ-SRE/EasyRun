import {readFile,writeFile,mkdir} from 'node:fs/promises';
const existing=JSON.parse(await readFile('research/xbuilder-boundaries/cases.json','utf8'));
const cases=[];
{
 const files=structuredClone(existing.find(x=>x.name==='physics').files);
 files['Hero.spx']=`var (
 vx float64
 vy float64
 dashUntil float64
)
func jump() { if isOnFloor { vy = 320 } }
func dash() { vx=2400; vy=0; dashUntil=float64(timer)+0.3 }
onStart => {
 for {
  dt:=float64(waitNextFrame())
  if float64(timer)>=dashUntil {
   vx=0
   if isOnFloor && vy<0 { vy=0 }
   vy-=900*dt
  }
  setVelocity vx, vy
 }
}
`;
 files['main.spx']=`onStart => {
 wait 0.8
 println "PROBE FLOOR", Hero.xpos, Hero.ypos, Hero.isOnFloor
 Hero.jump()
 wait 0.2
 println "PROBE JUMP", Hero.xpos, Hero.ypos, Hero.isOnFloor
 Hero.dash()
 wait 0.3
 println "PROBE DASH_WALL", Hero.xpos, Hero.ypos
 wait 0.9
 println "PROBE LAND", Hero.xpos, Hero.ypos, Hero.isOnFloor
 Hero.setXYpos -100, -54
 wait 0.1
 Hero.setXYpos 250, -54
 wait 0.1
 println "PROBE TELEPORT", Hero.xpos, Hero.ypos
 println "PROBE DONE"
}`;
 cases.push({name:'physics-controller',files});
}
{
 const files=structuredClone(existing.find(x=>x.name==='clones-350').files);
 files['main.spx']=`var (
 spawned int
 alive int
)
onStart => {
 for i:=0;i<350;i++ { Particle.clone i; if i%10==9 {waitNextFrame()} }
 wait 0.1
 println "PROBE INITIAL", spawned, alive
 wait 1
 for i:=0;i<10;i++ { Particle.clone 999 }
 wait 0.1
 println "PROBE RECOVERY", spawned, alive
 println "PROBE DONE"
}`;
 files['Particle.spx']=`onCloned data => {
 spawned++
 alive++
 hide
 if data.(int)<10 { wait 0.8; alive--; die }
}`;
 cases.push({name:'clone-lifecycle',files});
}
{
 const files=structuredClone(existing.find(x=>x.name==='frame-60').files);
 files['Hero.spx']='';
 files['main.spx']=`import "ai"
var npc ai.Player
onStart => {
 npc.setRole "Robot guide"
 println "PROBE AI_IMPORT_AND_ROLE_OK"
 println "PROBE DONE"
}`;
 cases.push({name:'ai-module',files});
}
{
 const files=structuredClone(existing.find(x=>x.name==='animation-effects-camera').files);
 files['main.spx']='onStart => { wait 2; println "PROBE DONE" }';
 files['Hero.spx']=`var (
 t float64
 freeze int
 ticks int
)
onStart => {
 for {
  dt:=float64(waitNextFrame())
  ticks++
  if freeze>0 {
   println "PROBE FROZEN", ticks, xpos, costumeName
   freeze--
  } else {
   t+=dt
   changeXpos 120*dt
   setCostume int(t*20)%4
  }
 }
}
onStart => {
 wait 0.5
 freeze=3
 println "PROBE FREEZE_BEGIN", ticks, xpos, costumeName
 wait 0.15
 println "PROBE RESUMED", ticks, xpos, costumeName
}
`;
 cases.push({name:'script-hitstop',files});
}
await writeFile('research/xbuilder-boundaries/followup-cases.json',JSON.stringify(cases,null,2));
for(const c of cases) for(const [filename,content] of Object.entries(c.files)) {
 const target=`research/xbuilder-boundaries/projects/${c.name}/${filename}`;
 await mkdir(target.substring(0,target.lastIndexOf('/')),{recursive:true});
 await writeFile(target,content);
}
