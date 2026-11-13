'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {fixture}=require('./helpers.cjs');
(async()=>{
 const mapText=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):fixture(7,true);
 const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'spm-frontend-'));
 const probe=`window.__front={
  bpm:segmentBpm,
  install(tags,duration=1000){
   cachedTagResult.segments=tags.map((tag,i)=>({tag,start:1000+i*duration,end:1000+(i+1)*duration,equivBpm:180,confidence:.87,family:'rc'}));
   cachedTagResult.map.firstNote=1000;cachedTagResult.map.lastNote=1000+tags.length*duration;
   rebuildCurves();showResult(cachedResult);
  },
  at(t){stopAnimationLoop();songTimeMs=t;isPaused=true;lastSegIndex=-2;updateSegmentLive(t);},
  curves(){return JSON.stringify([cachedResult.sectionDifficulties,cachedResult.rcSectionDifficulties,cachedResult.lnSectionDifficulties]);},
  rolling(s){setRollingDigits(elSegBpm,s);},
  get pendingFrame(){return !!animFrameId;}
 };`;
 const server=http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname.split('/').at(-1)||'index.html';
  if(file==='favicon.ico'){res.writeHead(204).end();return;}
  if(!['index.html','spm_algorithm.js','tag_engine.js','analysis_cache.js','metadata.txt','dan_constants.json'].includes(file)){res.writeHead(404).end();return;}
  let body=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='index.html')body=body.replace("    window.addEventListener('resize', maybeResizeCurves);",probe+"\n    window.addEventListener('resize', maybeResizeCurves);");
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');res.end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:430,height:650}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   window.__frames=0;const raf=window.requestAnimationFrame;
   window.requestAnimationFrame=fn=>raf.call(window,t=>{__frames++;fn(t);});
  });
  let game,settingsSocket,settings={enableAnalysisCache:false,danDisplayStyle:'Number'};
  await page.route('http://localhost:24050/**',r=>r.fulfill({body:mapText,contentType:'text/plain',headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.routeWebSocket('ws://localhost:24050/**',s=>{
   if(s.url().includes('/commands')){settingsSocket=s;s.onMessage(()=>s.send(JSON.stringify({message:settings})));}else game=s;
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/spm/index.html`);
  await page.waitForFunction(()=>window.__front&&typeof TagClassifier!=='undefined');
  await page.evaluate(()=>{
   __ratingCalls=__tagCalls=__smoothCalls=0;
   const rate=window.processMap;window.processMap=(...a)=>{__ratingCalls++;return rate(...a);};
   const classify=TagClassifier.analyzeMap;window.TagClassifier={...TagClassifier,analyzeMap:(...a)=>{__tagCalls++;return classify(...a);}};
   const smooth=SPMEngine.smoothCurve;SPMEngine.smoothCurve=(...a)=>{__smoothCalls++;return smooth(...a);};
  });
  const frame=(t=10000,paused=true,state='menu')=>({client:'stable',state:{name:state},game:{paused},beatmap:{checksum:'frontend',mode:{number:3},time:{live:t}},menu:{mods:{name:''}}});
  game.send(JSON.stringify(frame()));
  await page.waitForFunction(()=>document.querySelector('#container').dataset.cacheState==='off'&&!document.querySelector('#container').classList.contains('hidden'));
  await page.waitForTimeout(650);
  const counts=()=>page.evaluate(()=>[__ratingCalls,__tagCalls,__smoothCalls]);
  const idle=async()=>{const a=await page.evaluate(()=>__frames);await page.waitForTimeout(300);return (await page.evaluate(()=>__frames))-a;};
  assert.equal(await idle(),0,'paused renderer should stop after morph');
  assert.deepEqual(await page.locator('#curve-header,#curve-legend,#curve-peak,#seg-dot').count(),0);
  async function change(next){settings={...settings,...next};settingsSocket.send(JSON.stringify({message:settings}));await page.waitForTimeout(500);}
  const before=await counts(),curves=await page.evaluate(()=>__front.curves());
  await change({colorScheme:'Aurora',danDisplayStyle:'Signs (-/+)'});
  assert.deepEqual(await counts(),before,'palette/dan-only changes must not rerun smoothing or engines');
  assert.equal(await page.evaluate(()=>__front.curves()),curves);
  assert.equal(await idle(),0);
  // Capture the real renderer before installing synthetic display-only segments.
  for(const [name,width,style,density,color] of [
   ['default-7k',710,'Rating first','Standard','Default Dark'],
   ['aurora-7k',710,'Rating first','Standard','Aurora'],
   ['high-contrast-dan-first',430,'Dan first','Compact','High Contrast'],
   ['minimal-7k',430,'Minimal','Standard','Aurora']
  ]){
   await page.setViewportSize({width,height:650});await change({uiStyle:style,panelDensity:density,colorScheme:color});
   const r=await page.locator('#container').boundingBox();
   await page.screenshot({path:path.join(out,name+'.png'),clip:{x:0,y:0,width,height:Math.ceil(r.height+24)}});
  }
  await page.setViewportSize({width:430,height:650});await change({uiStyle:'Rating first',panelDensity:'Standard',colorScheme:'Aurora'});
  // Full taxonomy policy, including classes no longer showing cadence and native compatibility keys.
  const visible=['dense chordstream','fast chordstream','stamina','chordjack','minijack','jack','speed','density','coordination'];
  const hidden=['tech','wildcard','vibro','inverse','release','technical','ln wildcard','ln','rc mix','ln mix','hybrid','break'];
  const tags=[...visible,...hidden];
  await change({enableAnimations:false});
  await page.evaluate(tags=>__front.install(tags),tags);
  for(const [i,tag] of tags.entries()){
   await page.evaluate(t=>__front.at(t),1500+i*1000);
   assert.equal(await page.locator('#seg-bpm').textContent(),visible.includes(tag)?'180':'',tag);
   const title=await page.locator('.tl-seg').nth(i).getAttribute('title');
   assert.equal(title.includes('@180'),visible.includes(tag),tag+' timeline');assert(!title.includes('peak'));
   if(tag!=='break')assert.equal(await page.locator('#seg-conf').textContent(),'87%');
  }
  assert.equal(await page.locator('#seg-row').evaluate(n=>n.firstElementChild.id),'seg-bpm');
  const labels=await page.evaluate(()=>[getComputedStyle(document.querySelector('#seg-bpm'),'::after').content,getComputedStyle(document.querySelector('#seg-conf'),'::before').content]);
  assert(labels.every(s=>!s.includes('BPM')&&!s.includes('CONF')));
  assert.equal(await page.evaluate(()=>__front.bpm({tag:'speed',equivBpm:NaN})), '');
  await page.evaluate(()=>__front.at(1500));
  const graph=await page.locator('#curve-canvas').boundingBox();
  await page.mouse.move(graph.x+graph.width*.4,graph.y+graph.height*.5);
  assert(await page.locator('#curve-tooltip').isVisible());assert((await page.locator('#curve-tooltip').textContent()).includes('★'));
  await page.screenshot({path:path.join(out,'hover-430.png')});
  await page.mouse.move(0,640);assert(!await page.locator('#curve-tooltip').isVisible());
  // Odometers always expose target text; turning motion off flattens the DOM.
  await change({enableAnimations:true});
  for(const s of ['200','150','','180','< 0.50','250']){
   await page.evaluate(s=>__front.rolling(s),s);assert.equal(await page.locator('#seg-bpm').textContent(),s);
  }
  await change({enableAnimations:false});assert.equal(await page.locator('#seg-bpm .d-slot').count(),0);
  // Preserve key paths across styles/densities/palettes and inspect settled renders.
  for(const [width,style,density,color] of [[710,'Rating first','Standard','Default Dark'],[430,'Dan first','Standard','Aurora'],[380,'Rating first','Compact','High Contrast'],[380,'Minimal','Compact','Aurora']]){
   await page.setViewportSize({width,height:650});await change({uiStyle:style,panelDensity:density,colorScheme:color});
   await page.evaluate(()=>__front.at(1500));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow);
   assert(await page.locator('#tags-row').isVisible());
   assert.equal(await page.locator('#curve-canvas').isVisible(),style!=='Minimal');
   await page.screenshot({path:path.join(out,`${width}-${style.replace(' ','-')}-${density}.png`)});
   assert.equal(await idle(),0);
  }
  // Break is an inset surface, not edge-aligned text. Check the attached 4.3s case
  // with and without digit motion, at narrow/compact and wide/standard sizes.
  for(const [width,density] of [[380,'Compact'],[430,'Standard'],[710,'Standard']]){
   for(const motion of [false,true]){
    await page.setViewportSize({width,height:650});
    await change({uiStyle:'Rating first',panelDensity:density,enableAnimations:motion});
    await page.evaluate(()=>{__front.install(['break'],4300);__front.at(2000);});
    await page.waitForTimeout(500);
    const geometry=await page.evaluate(()=>{
     const row=document.querySelector('#seg-row').getBoundingClientRect();
     const tag=document.querySelector('#seg-tag').getBoundingClientRect();
     const dur=document.querySelector('#seg-dur').getBoundingClientRect();
     return {left:tag.left-row.left,right:row.right-dur.right,
      tagCenter:(tag.top+tag.bottom-row.top-row.bottom)/2,
      durCenter:(dur.top+dur.bottom-row.top-row.bottom)/2,
      overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert(geometry.left>=8&&geometry.right>=8,JSON.stringify(geometry));
    assert(Math.abs(geometry.tagCenter)<1&&Math.abs(geometry.durCenter)<1,JSON.stringify(geometry));
    assert(!geometry.overflow);assert.equal(await page.locator('#seg-dur').textContent(),'4.3s');
    await page.screenshot({path:path.join(out,`break-${width}-${motion?'motion':'static'}.png`)});
   }
  }
  await page.evaluate(()=>{__front.install(['speed'],4300);__front.at(2000);});
  assert.equal(await page.locator('#seg-row').evaluate(n=>getComputedStyle(n).paddingLeft),'0px');
  await change({uiStyle:'Rating first',panelDensity:'Standard',enableAnimations:false});
  // A moving stream wakes RAF; pausing and hiding stop it without waiting for socket updates.
  game.send(JSON.stringify(frame(2000,false)));await page.waitForTimeout(30);
  game.send(JSON.stringify(frame(2100,false)));await page.waitForTimeout(100);
  const movingFrames=await idle();assert(movingFrames>3);
  game.send(JSON.stringify(frame(2400,true)));await page.waitForTimeout(100);assert.equal(await idle(),0);
  await change({hideOnPlay:true});game.send(JSON.stringify(frame(2500,false,'play')));await page.waitForTimeout(100);
  assert(!await page.locator('#container').isVisible());assert.equal(await idle(),0);
  game.send(JSON.stringify(frame(2500,true)));await page.waitForTimeout(100);assert(await page.locator('#container').isVisible());
  assert.deepEqual((await counts()).slice(0,2),[1,1]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',cadenceVisible:visible,cadenceHidden:hidden,pausedFramesPer300ms:0,movingFramesPer300ms:movingFrames,screenshots:out},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
