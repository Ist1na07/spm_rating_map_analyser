const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const os=require('node:os');
const {fixture}=require('./helpers.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const output=process.env.SPM_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'spm-analyser-browser-'));
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!['index.html','spm_algorithm.js','tag_engine.js','dan_constants.json'].includes(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.json')?'application/json':'text/html');
  res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:430,height:600},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  let game,settingsSocket,mapText=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):fixture(7,true),settings={danDisplayStyle:'Number'};
  await page.route('http://localhost:24050/**',route=>route.fulfill({contentType:'text/plain',body:mapText,headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.routeWebSocket('ws://localhost:24050/**',socket=>{
   if(socket.url().includes('/commands')){settingsSocket=socket;socket.onMessage(()=>socket.send(JSON.stringify({message:settings})));}
   else game=socket;
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>typeof TagClassifier!=='undefined');
  await page.evaluate(()=>{
   window.__ratings=[];window.__tags=[];
   const original=window.processMap;window.processMap=(...args)=>{const r=original(...args);window.__ratings.push(r);return r;};
   const classify=window.TagClassifier.analyzeMap;window.TagClassifier={...window.TagClassifier,analyzeMap:(...args)=>{const r=classify(...args);window.__tags.push(r);return r;}};
  });
  let seq=0;
  const frame=(mods='',live=40000,paused=false)=>({client:'stable',state:{name:'menu'},game:{paused},beatmap:{checksum:'preview-'+seq,mode:{number:3},time:{live}},menu:{mods:{name:mods}}});
  async function chart(text,mods=''){
   mapText=text;seq++;const count=await page.evaluate(()=>__ratings.length);game.send(JSON.stringify(frame(mods)));
   await page.waitForFunction(n=>__ratings.length>n,count,{timeout:30000});
   await page.waitForFunction(()=>!document.querySelector('#container').classList.contains('hidden'));
  }
  async function change(next){settings={...settings,...next};settingsSocket.send(JSON.stringify({message:settings}));await page.waitForTimeout(200);}
  async function checkPercentages(){
   return page.evaluate(()=>{
    const r=__tags.at(-1),overall=r.overall;
    const solid=[...document.querySelectorAll('#tags-row .ov-tag .pct')].map(n=>n.textContent);
    const expected=overall.tags.map(t=>t==='hybrid'?`RC ${Math.round(100*overall.familyMass.rc)}% / LN ${Math.round(100*overall.familyMass.ln)}%`:`${Math.round(overall.labelPercentages[t]||0)}%`);
    return {solid,expected,profile:r.modelInfo.perception.profile,calls:__tags.length,ratings:__ratings.length,percentages:overall.percentages};
   });
  }
  await chart(mapText);let state=await checkPercentages();assert.deepEqual(state.solid,state.expected);assert.equal(state.profile,'detail');assert.equal(state.calls,1);assert.equal(state.ratings,1);
  await page.screenshot({path:path.join(output,'overlay-default.png')});
  await change({algorithm:'SPM Rating v1.2.0-Compact'});state=await checkPercentages();assert.equal(state.profile,'compact');assert.equal(state.calls,2);assert.equal(state.ratings,2);assert.deepEqual(state.solid,state.expected);
  const percentages=state.percentages;
  await change({curveSmoothing:'Max'});state=await checkPercentages();assert.equal(state.calls,2);assert.deepEqual(state.percentages,percentages);
  await page.setViewportSize({width:380,height:600});state=await checkPercentages();assert.equal(state.calls,2);assert.deepEqual(state.percentages,percentages);
  await change({uiStyle:'Minimal',panelDensity:'Compact',colorScheme:'High Contrast'});
  await page.screenshot({path:path.join(output,'overlay-minimal.png')});
  assert(await page.locator('#tags-row').isVisible());
  await change({uiStyle:'Dan first',panelDensity:'Standard',colorScheme:'Aurora'});
  await chart(mapText,'DT');
  assert.equal(await page.evaluate(()=>__ratings.at(-1).tagEvidence.speedRate),1.5);
  assert.equal(await page.evaluate(()=>__tags.at(-1).modelInfo.perception.profile),'compact');
  game.send(JSON.stringify(frame('DT',40000,true)));await page.waitForTimeout(50);
  await page.screenshot({path:path.join(output,'overlay-dt-paused.png')});
  const count=await page.evaluate(()=>__tags.length);
  await chart(fixture(4,true));assert.equal(await page.evaluate(()=>__tags.length),count);assert(!await page.locator('#tags-row').isVisible());
  await chart(fixture(6,true));assert.equal(await page.evaluate(()=>__tags.length),count);assert(!await page.locator('#tags-row').isVisible());
  const easy='osu file format v14\n[General]\nMode:3\n[Difficulty]\nCircleSize:7\nOverallDifficulty:5\n[TimingPoints]\n0,500,4,2,1,100,1,0\n[HitObjects]\n'+Array.from({length:12},(_,i)=>`36,192,${1000+i*4000},1,0,0:0:0:0:`).join('\n');
  await change({uiStyle:'Rating first',algorithm:'SPM Rating v1.2.0-Detailed'});
  await chart(easy);assert.equal(await page.locator('#rc-dan').textContent(),'< 0.50');
  await page.screenshot({path:path.join(output,'overlay-below-zero.png')});
  const r=await page.evaluate(()=>__tags.at(-1));assert.equal(r.modelInfo.version,'1.2.3');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',scenarios:['raw-curve reuse','Detailed/Compact live switch','smoothing and resize invariance','430px and 380px layout','Minimal/Compact','DT and paused playback','4K/6K original visibility','numeric <0.50'],screenshots:output},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
