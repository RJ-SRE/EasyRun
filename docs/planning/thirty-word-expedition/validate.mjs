import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { WORDS } from '../../../prototypes/runlab/public/cet4-words.js';
const d=JSON.parse(await readFile(new URL('design-data.json',import.meta.url),'utf8'));
const b=new Map(WORDS.map(w=>[w.id,w]));
const rooms=new Map(d.rooms.map(r=>[r.id,r]));
const checks=[];
assert.equal(d.chapters.length,5);assert.equal(rooms.size,15);assert.equal(d.words.length,30);assert.equal(new Set(d.words.map(w=>w.id)).size,30);
for(const w of d.words){assert.ok(b.has(w.id),w.id);assert.equal(w.meaning,b.get(w.id).meaning);assert.equal(w.pos,b.get(w.id).pos);assert.ok(rooms.has(w.room));assert.notEqual(w.firstContext,w.returnContext);}
checks.push('5 regions, 15 distinct rooms, 30 unique existing CET-4 entries with unchanged target senses and two authored contexts');
for(const route of [d.mainRoute,d.fullRoute]){assert.equal(new Set(route).size,route.length);for(const id of route)assert.ok(rooms.has(id));assert.equal(route.at(-1),'R10');assert.equal(route.at(-2),'R09');}
assert.equal(d.mainRoute.length,10);assert.equal(d.fullRoute.length,15);assert.ok(d.mainRoute.every(r=>d.fullRoute.includes(r)));assert.ok(d.fullRoute.indexOf('S05')<d.fullRoute.indexOf('R09'));
checks.push('main route 10 rooms; full route visits all 15 once; optional story branch precedes the boss and rising tide');
const schedules={};
for(const [name,route] of [['main',d.mainRoute],['full',d.fullRoute]]){
 let now=0,last=-100;const events=[],first=new Map();
 for(const id of route){const room=rooms.get(id),newWords=d.words.filter(w=>w.room===id),requests=[...newWords.map(w=>({word:w.id,type:'first'})),...Array.from({length:room.reviews},()=>({word:d.reviewWords[id],type:'review'}))];
  for(const e of requests){const at=Math.max(now+10,last+d.cadence.nominalPromptGap);assert.ok(at<=now+room.seconds-6,`${name}: ${id} overflows at ${at}`);if(e.type==='review'){assert.ok(first.has(e.word),`${id} reviews unseen ${e.word}`);const f=first.get(e.word);assert.ok(at-f.at>=60);assert.notEqual(f.room,id);assert.ok(events.length-f.index-1>=2);}else first.set(e.word,{at,room:id,index:events.length});events.push({...e,room:id,at});last=at;}
  now+=room.seconds;
 }
 for(const e of events){assert.ok(events.filter(x=>x.at>=e.at&&x.at<e.at+90).length<=2);}
 const unique=new Set(events.filter(e=>e.type==='first').map(e=>e.word));
 assert.equal(unique.size,name==='main'?18:30);assert.equal(events.filter(e=>e.type==='review').length,name==='main'?4:8);
 assert.ok(events.length<=d.cadence.fullPromptCap);
 schedules[name]={seconds:now,newWords:unique.size,reviews:events.length-unique.size,prompts:events.length,answerSecondsAt5_5:events.length*5.5,answerShareAt5_5:events.length*5.5/now,events};
}
checks.push('nominal main/full schedules fit room durations, 25-second minimum action gap at 8-second answers, max 2 requests per 90 seconds, and spaced known-word reviews');
for(const s of Object.values(schedules))for(let i=1;i<s.events.length;i++)assert.ok(s.events[i].at-s.events[i-1].at-8>=d.cadence.minActionGap);
const anchors=[[300,1110],[580,880],[330,650],[600,420],[360,200]];
const distances=anchors.slice(1).map((p,i)=>Math.hypot(p[0]-anchors[i][0],p[1]-anchors[i][1]));assert.ok(distances.every(v=>v<470));
checks.push('R03 consecutive permanent anchor centers fit the existing 470-unit reach envelope; not a collision/pathfinding test');
const report={date:new Date().toISOString(),baseline:d.baseline,scope:'Design-data consistency and nominal opportunity capacity only. No game implementation, empirical retention, encounter enjoyment, language review or physical reachability claim.',checks,schedules,anchorDistances:distances};
await writeFile(new URL('validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,main:schedules.main.prompts,full:schedules.full.prompts,mainSeconds:schedules.main.seconds,fullSeconds:schedules.full.seconds},null,2));
