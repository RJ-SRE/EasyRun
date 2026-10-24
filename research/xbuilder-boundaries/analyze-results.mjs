import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='research/xbuilder-boundaries/results/';
const primary=JSON.parse(await readFile(dir+'probe-results.json','utf8'));
const follow=JSON.parse(await readFile(dir+'followup-results.json','utf8'));
const qualified=JSON.parse(await readFile(dir+'ai-qualified-result.json','utf8'));
const all=[...primary.scenarios,...follow.scenarios,...qualified.scenarios];
const find=name=>all.find(x=>x.name===name);
const lines=(name,prefix)=>find(name).console.filter(x=>x.text.startsWith(prefix));
const nums=(name,prefix)=>lines(name,prefix).map(x=>x.text.slice(prefix.length).trim().split(/\s+/).map(Number));
const checks=[];
function check(name,fn){try{fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:e.message});}}
check('All 12 non-alias scenarios compile and complete',()=>{
 const valid=all.filter(x=>x.name!=='ai-module');assert.equal(valid.length,12);
 for(const s of valid) {assert.equal(s.completed,true,s.name);assert.deepEqual(s.errors,[],s.name);assert.deepEqual(s.runtimeErrors,[],s.name);}
});
const rates=primary.scenarios.filter(x=>lines(x.name,'PROBE SAMPLE').length===4).map(s=>{
 const rows=lines(s.name,'PROBE SAMPLE');
 const counts=rows.map(x=>Number(x.text.split(' ')[2]));
 const wallSeconds=(rows.at(-1).at-rows[0].at)/1000;
 return {name:s.name,frames:counts.at(-1)-counts[0],wallSeconds,engineUpdatesPerSecond:(counts.at(-1)-counts[0])/wallSeconds};
});
check('Configured 30 and 60 Hz are observed',()=>{
 for(const target of [30,60])assert.ok(Math.abs(rates.find(x=>x.name===`frame-${target}`).engineUpdatesPerSecond-target)<2);
});
check('350 clone requests create 300 clones',()=>assert.deepEqual(nums('clones-350','PROBE CLONES')[0],[350,300]));
check('Hidden clones count and deletion restores capacity',()=>{
 assert.deepEqual(nums('clone-lifecycle','PROBE INITIAL')[0],[300,300]);
 assert.deepEqual(nums('clone-lifecycle','PROBE RECOVERY')[0],[310,300]);
});
check('Kinematic controller lands, jumps, stops at thin wall, lands again',()=>{
 assert.match(lines('physics-controller','PROBE FLOOR')[0].text,/ true$/);
 assert.match(lines('physics-controller','PROBE LAND')[0].text,/ true$/);
 const floor=nums('physics-controller','PROBE FLOOR')[0][1];
 const jump=nums('physics-controller','PROBE JUMP')[0][1];
 const wallX=nums('physics-controller','PROBE DASH_WALL')[0][0];
 assert.ok(jump>floor+20);assert.ok(wallX>130&&wallX<=133.1);
});
check('Position assignment can teleport through the wall',()=>assert.equal(nums('physics-controller','PROBE TELEPORT')[0][0],250));
check('Four-frame 20 Hz animation completes near 0.2 seconds',()=>assert.ok(Math.abs(nums('animation-effects-camera','PROBE ANIMATION')[0][0]-.2)<.05));
check('Stopped animation preserves explicit costume',()=>{
 assert.match(lines('animation-effects-camera','PROBE STOP')[0].text,/ f2$/);
 assert.match(lines('animation-effects-camera','PROBE HELD')[0].text,/ f2$/);
});
check('AtFrame callback runs on requested engine frame',()=>{const [a,b]=nums('animation-effects-camera','PROBE ATFRAME')[0];assert.equal(a,b);});
check('Script hitstop preserves position and pose for three ticks',()=>{
 const rows=lines('script-hitstop','PROBE FROZEN').map(x=>x.text.split(' '));
 assert.equal(rows.length,3);
 assert.equal(new Set(rows.map(x=>x.slice(3).join(' '))).size,1);
 const x=Number(rows[0][3]);assert.ok(nums('script-hitstop','PROBE RESUMED')[0][1]>x);
});
check('Bare ai import fails but qualified module import works',()=>{
 assert.match(find('ai-module').errors.join('\n'),/not found package/);
 assert.equal(lines('ai-qualified-module','PROBE AI_IMPORT_AND_ROLE_OK').length,1);
});
const summary={scope:'Local Chromium headless runtime microprobes; engine updates are not a rendered FPS or device compatibility benchmark.',hardware:'Apple M1 Pro, 32 GiB RAM',runtime:primary.runtime,browser:primary.browser,rates,checks};
await writeFile(dir+'summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
assert.ok(checks.every(x=>x.passed),'One or more research assertions failed');
