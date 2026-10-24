import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const output = path.join(root, 'research/xbuilder-boundaries/results');
await mkdir(output, { recursive: true });
const mime = { '.html':'text/html', '.js':'text/javascript', '.wasm':'application/wasm', '.json':'application/json', '.svg':'image/svg+xml' };
const server = http.createServer(async (req,res) => {
  const requestPath = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const filename = path.resolve(root,'node_modules/@xgo-pkgs/spx', '.'+requestPath);
  if (!filename.startsWith(path.join(root,'node_modules/@xgo-pkgs/spx')+'/')) { res.writeHead(403); res.end(); return; }
  try {
    const data = await readFile(filename);
    res.writeHead(200, {'Content-Type':mime[path.extname(filename)]??'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
const results = { date:new Date().toISOString(), runtime:'@xgo-pkgs/spx@3.3.0', browser:browser.version(), headless:true, scenarios:[] };
try {
  const cases = JSON.parse(await readFile(path.join(root,'research/xbuilder-boundaries',process.argv[2]??'cases.json'),'utf8'));
  for (const scenario of cases) {
    const page = await browser.newPage({viewport:{width:960,height:540}});
    const result = {name:scenario.name, console:[], errors:[], timings:{}};
    page.on('console',m=>{
      const entry={type:m.type(),text:m.text(),at:Date.now()};
      result.console.push(entry);
      if(entry.text.includes('PROBE')||entry.type==='error') console.log(scenario.name,entry.text.slice(0,1500));
    });
    page.on('pageerror',e=>result.errors.push(e.message));
    page.on('requestfailed',r=>result.errors.push(`${r.url()}: ${r.failure()?.errorText}`));
    console.log('START',scenario.name);
    try {
      await page.goto(base+'/runner.html');
      result.timings = await Promise.race([page.evaluate(async files=>{
        window.__probeErrors=[];
        window.onGameError(e=>window.__probeErrors.push(String(e)));
        window.onEngineCrash(e=>window.__probeErrors.push(String(e)));
        let t=performance.now(); await initEngine(); const engine=performance.now()-t;
        console.log('PROBE ENGINE_READY');
        t=performance.now();
        await initGame(Object.fromEntries(Object.entries(files).map(([key,value])=>[key,{content:new TextEncoder().encode(value).buffer,lastModified:Date.now()}])));
        const build=performance.now()-t;
        console.log('PROBE BUILD_READY');
        t=performance.now(); await startGame();
        return {engineMs:engine,buildMs:build,startMs:performance.now()-t};
      },scenario.files),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Initialization exceeded 20 seconds')),20000))]);
      await page.locator('#game-canvas').click({position:{x:5,y:5}});
      if (scenario.keys) for (const step of scenario.keys) {
        await page.waitForTimeout(step.delay??300);
        await page.keyboard.down(step.key);
        await page.waitForTimeout(step.hold??30);
        await page.keyboard.up(step.key);
      }
      const deadline=Date.now()+30000;
      while(!result.console.some(x=>x.text.includes('PROBE DONE')) && Date.now()<deadline) {
        if ((await page.evaluate(()=>window.__probeErrors)).length) break;
        await page.waitForTimeout(200);
      }
      result.completed=result.console.some(x=>x.text.includes('PROBE DONE'));
      await page.screenshot({path:path.join(output,scenario.name+'.png')});
      result.runtimeErrors=await page.evaluate(()=>window.__probeErrors);
      result.canvas=await page.locator('#game-canvas').evaluate(c=>({width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight}));
    } catch (e) {result.errors.push(e.stack);}
    results.scenarios.push(result);
    await writeFile(path.join(output,process.argv[3]??'probe-results.json'),JSON.stringify(results,null,2));
    console.log('END',scenario.name,JSON.stringify({completed:result.completed,timings:result.timings,errors:result.errors,runtimeErrors:result.runtimeErrors,logs:result.console.filter(x=>x.text.includes('PROBE')||x.type==='error')}));
    await page.close();
  }
} finally {await browser.close();server.close();}
