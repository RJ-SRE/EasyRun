import {writeFile, mkdir} from 'node:fs/promises';
const baseStage={map:{width:1920,height:1080},run:{width:960,height:540},maxFPS:60,zorder:['Hero'],physics:false,autoSetCollisionLayer:true};
const svg=(w,h,color)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="3" fill="${color}"/></svg>`;
function actor(files,name,w=24,h=32,config={}) {
 files[`assets/sprites/${name}/index.json`]=JSON.stringify({heading:90,x:0,y:0,size:1,rotationStyle:'none',physicsMode:'no',visible:true,costumeIndex:0,collisionShapeType:'rect',collisionShapeParams:[w,h],collisionLayer:1,collisionMask:1,triggerShapeType:'none',costumes:[{name:'idle',path:'idle.svg',x:w/2,y:h/2,bitmapResolution:1}],fAnimations:{},...config});
 files[`assets/sprites/${name}/idle.svg`]=svg(w,h,'#26c6da');
 files[`${name}.spx`]='';
}
function base(stage={}) {
 const f={'assets/index.json':JSON.stringify({...baseStage,...stage})};
 actor(f,'Hero');return f;
}
const samples=`wait 0.5
println "PROBE SAMPLE", currentFrame(), timer
wait 1
println "PROBE SAMPLE", currentFrame(), timer
wait 1
println "PROBE SAMPLE", currentFrame(), timer
wait 1
println "PROBE SAMPLE", currentFrame(), timer
println "PROBE DONE"`;
const cases=[];
for(const fps of [30,60]) {
 const files=base({maxFPS:fps});
 files['main.spx']=`onStart => {\n${samples}\n}`;
 files['Hero.spx']=`onStart => {
 for {
  dt := waitNextFrame()
  changeXpos 90 * float64(dt)
  if xpos > 300 { setXpos -300 }
 }
}
onKey KeySpace, => { println "PROBE KEY", currentFrame(), timer }`;
 cases.push({name:`frame-${fps}`,files,keys:[{key:'Space',delay:800}]});
}
for(const count of [50,150,300,350]) {
 const files=base({zorder:['Hero','Particle']});
 actor(files,'Particle',8,8,{visible:false,collisionShapeType:'none',collisionLayer:0,collisionMask:0});
 files['main.spx']=`var (\n spawned int\n)\nonStart => {
 for i:=0; i<${count}; i++ {
  Particle.clone i
  if i % 10 == 9 { waitNextFrame() }
 }
 wait 0.2
 println "PROBE CLONES", ${count}, spawned
 ${samples}
}`;
 files['Particle.spx']=`var (\n phase float64\n)\nonCloned data => {
 spawned++
 phase = float64(data.(int))
 setXYpos (float64(data.(int)%30)-15)*24, (float64(data.(int)/30)-5)*24
 setGraphicEffect GhostEffect, 35
 show
 for {
  dt := waitNextFrame()
  changeXpos 35 * float64(dt)
  if xpos > 450 { setXpos -450 }
 }
}`;
 cases.push({name:`clones-${count}`,files});
}
{
 const files=base({physics:true,autoSetCollisionLayer:false,zorder:['Floor','Wall','Hero'],globalGravity:1,globalFriction:0,globalAirDrag:0});
 actor(files,'Floor',900,20,{y:-80,physicsMode:'static'});
 actor(files,'Wall',10,300,{x:150,y:0,physicsMode:'static'});
 actor(files,'Hero',24,32,{x:-200,y:40,physicsMode:'kinematic'});
 files['main.spx']='onStart => { wait 3; println "PROBE DONE" }';
 files['Hero.spx']=`onStart => {
 wait 0.8
 println "PROBE FLOOR", xpos, ypos, isOnFloor
 setVelocity 0, 320
 wait 0.2
 println "PROBE JUMP", xpos, ypos, isOnFloor
 setGravity 0
 setVelocity 2400, 0
 wait 0.3
 println "PROBE DASH_WALL", xpos, ypos
 setVelocity 0, 0
 setGravity 1
 wait 0.8
 println "PROBE LAND", xpos, ypos, isOnFloor
}
onTouchStart "Wall", => { println "PROBE TOUCH_WALL", currentFrame(), xpos, ypos }
`;
 cases.push({name:'physics',files});
}
{
 const files=base();
 const cfg=JSON.parse(files['assets/sprites/Hero/index.json']);
 cfg.costumes=[];
 for(let i=0;i<4;i++) {
  cfg.costumes.push({name:`f${i}`,path:`f${i}.svg`,x:12,y:16,bitmapResolution:1});
  files[`assets/sprites/Hero/f${i}.svg`]=svg(24+i*8,32,['#26c6da','#ffa726','#ef5350','#ab47bc'][i]);
 }
 cfg.fAnimations={pulse:{frameFrom:'f0',frameTo:'f3',frameFps:20}};
 files['assets/sprites/Hero/index.json']=JSON.stringify(cfg);
 files['main.spx']='onStart => { wait 2.5; println "PROBE DONE" }';
 files['Hero.spx']=`onStart => {
 wait 0.3
 t := timer
 animateAndWait "pulse"
 println "PROBE ANIMATION", float64(timer-t), costumeName
 t = timer
 animate "pulse", true
 wait 0.1
 stopAnimation "pulse"
 setCostume "f2"
 println "PROBE STOP", currentFrame(), costumeName
 wait 0.3
 println "PROBE HELD", currentFrame(), costumeName
 target := currentFrame()+3
 atFrame target, => { println "PROBE ATFRAME", target, currentFrame() }
 setGraphicEffect GhostEffect, 50
 setGraphicEffect BrightnessEffect, 50
 Camera.setZoom 1.25
 Camera.setXYpos 100, 0
 println "PROBE CAMERA", Camera.zoom, Camera.xpos, Camera.ypos
}`;
 cases.push({name:'animation-effects-camera',files});
}
await writeFile('research/xbuilder-boundaries/cases.json',JSON.stringify(cases,null,2));
for (const c of cases) for(const [filename,content] of Object.entries(c.files)) {
 const target=`research/xbuilder-boundaries/projects/${c.name}/${filename}`;
 await mkdir(target.substring(0,target.lastIndexOf('/')),{recursive:true});
 await writeFile(target,content);
}
