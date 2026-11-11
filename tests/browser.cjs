const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const os=require('node:os');
const {fixture,patternFixture,filesUnder}=require('./helpers.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const output=process.env.SPM_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'spm-analyser-browser-'));
 fs.mkdirSync(output,{recursive:true});
 const counterName='outer/spm analyser';
 const settingsRequests=[];
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.split('/').filter(Boolean).at(-1)||'index.html';
  if(!['index.html','spm_algorithm.js','tag_engine.js','dan_constants.json'].includes(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.json')?'application/json':'text/html');
  const body=fs.readFileSync(path.join(root,name));
  // Expose only the renderer to synthetic display fixtures, not in production.
  const html=name==='index.html'?body.toString().replace('    function renderOverallTags(tagRes) {',
   '    window.__renderOverallTags = renderOverallTags;\n    function renderOverallTags(tagRes) {'):null;
  res.end(html!==null?html+'<script>window.COUNTER_PATH='+JSON.stringify(counterName)+'</script>':body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:430,height:600},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  let game,settingsSocket,mapText=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):fixture(7,true),settings={error:'ENOENT: missing nested settings parent'};
  await page.route('http://localhost:24050/**',route=>route.fulfill({contentType:'text/plain',body:mapText,headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.routeWebSocket('ws://localhost:24050/**',socket=>{
   if(socket.url().includes('/commands')){
    settingsSocket=socket;
    const from=new URL(socket.url()).searchParams.get('l');
    socket.onMessage(command=>{settingsRequests.push({from,command});socket.send(JSON.stringify({message:command===`getSettings:${from}`?settings:{error:'Wrong overlay'}}));});
   }
   else game=socket;
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/outer/spm%20analyser/index.html`);
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
    const r=__tags.at(-1),overall=r.overall,coarse=r.modelInfo.taxonomy==='coarse5';
    const solid=[...document.querySelectorAll('#tags-row .ov-tag .pct')].map(n=>n.textContent);
    const family=overall.familyMass,total=family.rc+family.ln;
    const rcPct=total>0?Math.round(100*family.rc/total):null;
    const hybrid=rcPct===null?'RC — / LN —':`RC ${rcPct}% / LN ${100-rcPct}%`;
    const expected=overall.tags.map(t=>t==='hybrid'?hybrid:`${Math.round(coarse?100*overall.composition[t]:overall.labelPercentages[t]||0)}%`);
    return {solid,expected,profile:r.modelInfo.perception?.profile,calls:__tags.length,ratings:__ratings.length,percentages:coarse?overall.composition:overall.percentages};
   });
  }
  await chart(mapText);let state=await checkPercentages();assert.deepEqual(state.solid,state.expected);assert.equal(state.profile,'detail');assert.equal(state.calls,1);assert.equal(state.ratings,1);
  const pressure=await page.evaluate(()=>__tags.at(-1).modelInfo.breakPolicy);
  assert.equal(pressure.id,'sustained-native-demand-r1');assert.equal(pressure.ratingUsed,true);
  assert(settingsRequests.length>0);
  assert(settingsRequests.every(r=>r.from===counterName&&r.command===`getSettings:${counterName}`));
  await page.waitForFunction(()=>document.querySelector('#settings-warning').textContent.includes('Detailed defaults'));
  assert(await page.locator('#settings-warning').isVisible());
  await page.screenshot({path:path.join(output,'overlay-settings-error.png')});
  await change({error:undefined,danDisplayStyle:'Number'});
  assert(!await page.locator('#settings-warning').isVisible());
  await page.screenshot({path:path.join(output,'overlay-default.png')});
  await change({algorithm:'SPM Rating v1.2.0-Compact'});state=await checkPercentages();assert.equal(state.profile,'compact');assert.equal(state.calls,2);assert.equal(state.ratings,2);assert.deepEqual(state.solid,state.expected);
  assert.equal(await page.evaluate(()=>__tags.at(-1).modelInfo.breakPolicy.ratingUsed),true);
  const normalized=await page.evaluate(()=>{
   const original=__tags.at(-1),fixtures=[[.44,.52],[1,1],[1,2],[0,2],[2,0],[0,0]],results=[];
   for(const [rc,ln] of fixtures){
    const r=structuredClone(original);r.overall.tags=['hybrid'];r.overall.familyMass={rc,ln};
    const before=JSON.stringify(r.overall);__renderOverallTags(r);
    results.push({text:document.querySelector('#tags-row .ov-tag .pct').textContent,
     unchanged:JSON.stringify(r.overall)===before,hasPrefix:[...document.querySelector('#tags-row').childNodes].some(n=>n.textContent==='Burden')});
   }
   return results;
  });
  assert.deepEqual(normalized.map(r=>r.text),['RC 46% / LN 54%','RC 50% / LN 50%','RC 33% / LN 67%','RC 0% / LN 100%','RC 100% / LN 0%','RC — / LN —']);
  assert(normalized.every(r=>r.unchanged&&!r.hasPrefix));
  await page.evaluate(()=>{
   const r=structuredClone(__tags.at(-1));r.overall.tags=['hybrid'];r.overall.familyMass={rc:.44,ln:.52};__renderOverallTags(r);
  });
  await page.screenshot({path:path.join(output,'overlay-hybrid-normalized.png')});
  await page.evaluate(()=>__renderOverallTags(__tags.at(-1)));
  assert(!(await page.locator('#tags-row').textContent()).includes('Burden'));
  // Reproduce the attached 710px screenshot: all four chips fit the panel,
  // but the former 440px cap forced Chordjack onto its own line.
  await page.setViewportSize({width:710,height:600});
  await page.evaluate(()=>{
   const r=structuredClone(__tags.at(-1));r.overall.tags=['fast chordstream'];
   r.overall.percentages={'fast chordstream':33,'dense chordstream':37,speed:15,chordjack:13};
   r.overall.labelPercentages={'fast chordstream':33};__renderOverallTags(r);
  });
  const positions=()=>page.locator('#tags-row > span').evaluateAll(nodes=>nodes.map(n=>{
   const r=n.getBoundingClientRect();return {top:r.top,center:r.top+r.height/2,left:r.left,right:r.right};
  }));
  let chips=await positions();assert.equal(chips.length,4);assert(chips.every(c=>Math.abs(c.center-chips[0].center)<1));
  assert((await page.locator('#tags-row .ov-tag').getAttribute('title')).includes('prior-aware'));
  await page.screenshot({path:path.join(output,'overlay-tags-wide.png')});
  await page.setViewportSize({width:430,height:600});
  chips=await positions();assert(chips.some(c=>c.center>chips[0].center+10));
  const bounds=await page.locator('#tags-row').boundingBox();assert(chips.every(c=>c.right<=bounds.x+bounds.width+1));
  await page.screenshot({path:path.join(output,'overlay-tags-narrow.png')});
  await page.evaluate(()=>__renderOverallTags(__tags.at(-1)));
  const percentages=state.percentages;
  await change({error:'temporary settings read failure'});
  assert((await page.locator('#settings-warning').textContent()).includes('keeping Compact'));
  assert.equal((await checkPercentages()).calls,2);
  await change({error:undefined});
  assert(!await page.locator('#settings-warning').isVisible());
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
  await chart(patternFixture([[0,1,4],[2,5,6]],[[200,100],[267,75]]));
  game.send(JSON.stringify(frame('',10000)));
  await page.waitForFunction(()=>document.querySelector('#seg-bpm').textContent==='150');
  game.send(JSON.stringify(frame('',30000)));
  await page.waitForFunction(()=>document.querySelector('#seg-bpm').textContent==='200');
  await page.screenshot({path:path.join(output,'overlay-tempo-200.png')});
  await chart(patternFixture([[0,1,4],[2,5,6]],[[200,100],[267,75]]),'DT');
  game.send(JSON.stringify(frame('DT',10000)));
  await page.waitForFunction(()=>document.querySelector('#seg-bpm').textContent==='225');
  game.send(JSON.stringify(frame('DT',30000)));
  await page.waitForFunction(()=>document.querySelector('#seg-bpm').textContent==='300');
  await page.screenshot({path:path.join(output,'overlay-tempo-dt-300.png')});
  await chart(patternFixture([[0,1,2],[4,5]]));
  game.send(JSON.stringify(frame('',10000)));
  await page.waitForFunction(()=>document.querySelector('#seg-tag').textContent.includes('Wildcard'));
  assert.equal(await page.locator('#seg-conf').textContent(),await page.evaluate(()=>Math.round(__tags.at(-1).segments.find(s=>s.start<=10000&&s.end>10000).confidence*100)+'%'));
  assert.notEqual(await page.locator('#seg-conf').textContent(),'0%');
  await page.screenshot({path:path.join(output,'overlay-static-hand-wildcard.png')});
  async function checkNative(keys,text,mods=''){
   const count=await page.evaluate(()=>__tags.length);
   await chart(text,mods);assert.equal(await page.evaluate(()=>__tags.length),count+1);
   const r=await page.evaluate(()=>__tags.at(-1));
   assert.equal(r.map.keys,keys);assert.equal(r.modelInfo.taxonomy,'coarse5');assert.equal(r.modelInfo.nativeKeyCount,keys);
   assert.equal(await page.evaluate(()=>__ratings.at(-1).tagEvidence),undefined);
   assert(await page.locator('#tags-row').isVisible());assert(await page.locator('#seg-timeline-wrap').isVisible());
   const state=await checkPercentages();assert.deepEqual(state.solid,state.expected);
   assert((await page.locator('#tags-row').getAttribute('title')).includes('Weighted morphology composition'));
   const segment=r.segments.find(s=>s.tag!=='break');assert(segment);
   game.send(JSON.stringify(frame(mods,(segment.start+segment.end)/2)));
   const label={jack:'Jack',stamina:'Chordstream',speed:'Speed',tech:'Tech',ln:'LN'}[segment.tag];
   await page.waitForFunction(label=>document.querySelector('#seg-tag').textContent===label,label);
   assert.equal(await page.locator('#seg-conf').textContent(),Math.round(segment.confidence*100)+'%');
   assert.equal(await page.locator('.tl-seg').count(),r.segments.length);
   assert(await page.locator('#seg-diff').isVisible());
   const before=JSON.stringify(r.overall),calls=state.calls;
   await change({curveSmoothing:'Light'});assert.equal((await checkPercentages()).calls,calls);
   await page.setViewportSize({width:710,height:600});assert.equal((await checkPercentages()).calls,calls);
   assert.equal(await page.evaluate(()=>JSON.stringify(__tags.at(-1).overall)),before);
   await page.screenshot({path:path.join(output,`overlay-native-${keys}k${mods?'-'+mods:''}.png`)});
   await page.setViewportSize({width:430,height:600});
  }
  for(const keys of [4,6]){
   await checkNative(keys,fixture(keys,true));
   await change({algorithm:'SPM Rating v1.2.0-Detailed'});
   await checkNative(keys,fixture(keys,true),'DT');
   await checkNative(keys,fixture(keys,false),'HT');
   if(process.argv[3]){
    const dir=path.join(process.argv[3],`spm_dataset_${keys}k-0.1.0`);
    const files=filesUnder(dir).sort((a,b)=>fs.statSync(a).size-fs.statSync(b).size);
    await checkNative(keys,fs.readFileSync(files[Math.floor(files.length/2)],'utf8'));
   }
   await change({algorithm:'SPM Rating v1.2.0-Compact'});
  }
  const easy='osu file format v14\n[General]\nMode:3\n[Difficulty]\nCircleSize:7\nOverallDifficulty:5\n[TimingPoints]\n0,500,4,2,1,100,1,0\n[HitObjects]\n'+Array.from({length:12},(_,i)=>`36,192,${1000+i*4000},1,0,0:0:0:0:`).join('\n');
  await change({uiStyle:'Rating first',algorithm:'SPM Rating v1.2.0-Detailed'});
  await chart(easy);assert.equal(await page.locator('#rc-dan').textContent(),'< 0.50');
  await page.screenshot({path:path.join(output,'overlay-below-zero.png')});
  const r=await page.evaluate(()=>__tags.at(-1));assert.equal(r.modelInfo.version,'1.2.4');
  assert.equal(r.modelInfo.localExpert,'original56-joint-fixed-ridge01');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',initialProtectedParents:pressure.protectedParents,scenarios:['b311c40 pressure-aware Break policy and retuned local expert','150/200 and DT225/300 live segment cadence','Wildcard support is not a fabricated zero','no Burden prefix','Hybrid proportions normalized to 100 without mutating classifier output','nested/space settings paths with late tosu injection','settings-error visibility and recovery without changing the model','raw-curve reuse','Detailed/Compact live switch','smoothing and resize invariance','710px full-width chips and natural narrow wrapping','430px and 380px layout','Minimal/Compact','DT and paused playback','native 4K/6K classification, percentages, live segments, difficulty and timeline; NM/DT/HT','numeric <0.50'],screenshots:output},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
