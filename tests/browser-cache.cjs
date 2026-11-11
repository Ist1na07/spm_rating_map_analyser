'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {fixture}=require('./helpers.cjs');
(async()=>{
    const root=path.resolve(__dirname,'..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'spm-cache-browser-'));
    let version='1.2.2',text='',game,settingsSocket,settings={danDisplayStyle:'Number'},delayed=null,delayNext=false;
    const server=http.createServer((req,res)=>{
        const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname.split('/').at(-1))||'index.html';
        if(file==='favicon.ico'){res.writeHead(204).end();return;}
        if(!['index.html','analysis_cache.js','spm_algorithm.js','tag_engine.js','dan_constants.json','metadata.txt'].includes(file)){res.writeHead(404).end();return;}
        res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':'text/html; charset=utf-8');
        let body=fs.readFileSync(path.join(root,file),'utf8');
        if(file==='metadata.txt')body=body.replace(/^version:.*$/m,'version:'+version);
        if(file==='index.html')body=body.replace('    function showResult(result) {',
            '    function showResult(result) {\n        window.__paint=(window.__paint||0)+1; window.__view=SPMAnalysisCache.snapshot(result,cachedTagResult);');
        res.end(body);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const url=`http://127.0.0.1:${server.address().port}/spm/index.html`,profile=path.join(output,'profile');
    const options={...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true,viewport:{width:710,height:600}};
    let context,page,frame;
    const realCharts=[];
    const errors=[];
    async function open(deny=false){
        context=await chromium.launchPersistentContext(profile,options);page=context.pages()[0];
        if(deny)await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('Storage blocked by test','SecurityError');}}));
        page.on('pageerror',e=>errors.push(String(e)));
        await page.route('http://localhost:24050/**',async route=>{
            const body=text;
            if(delayNext){delayNext=false;await new Promise(resolve=>delayed=resolve);}
            await route.fulfill({contentType:'text/plain',body,headers:{'Access-Control-Allow-Origin':'*'}});
        });
        await page.routeWebSocket('ws://localhost:24050/**',socket=>{
            if(socket.url().includes('/commands')){settingsSocket=socket;socket.onMessage(()=>socket.send(JSON.stringify({message:settings})));}
            else game=socket;
        });
        await page.goto(url);await instrument();
    }
    async function instrument(){
        await page.waitForFunction(()=>typeof TagClassifier!=='undefined'&&typeof SPMAnalysisCache!=='undefined');
        await page.evaluate(()=>{
            window.__ratingCalls=window.__tagCalls=0;
            const rate=window.processMap;window.processMap=(...a)=>{__ratingCalls++;return rate(...a);};
            const classify=window.TagClassifier.analyzeMap;window.TagClassifier={...window.TagClassifier,analyzeMap:(...a)=>{__tagCalls++;return classify(...a);}};
        });
    }
    const meta=(s,k)=>s.match(new RegExp('^'+k+':(.*)$','m'))?.[1].trim();
    function makeFrame(name,body,mods='',checksum=name,state='menu'){
        return {client:'stable',folders:{songs:'E:/osu/Songs'},directPath:{beatmapFile:`folder/${name}.osu`},
            state:{name:state},beatmap:{checksum,mode:{number:3},time:{live:10000},title:meta(body,'Title'),artist:meta(body,'Artist'),version:meta(body,'Version'),mapper:meta(body,'Creator')},menu:{mods:{name:mods}}};
    }
    async function paint(next,body,expected){
        text=body;frame=next;const before=await page.evaluate(()=>window.__paint||0),started=performance.now();
        game.send(JSON.stringify(frame));
        await page.waitForFunction(n=>(window.__paint||0)>n&&!document.querySelector('#container').classList.contains('hidden'),before);
        if(expected)await page.waitForFunction(s=>document.querySelector('#container').dataset.cacheState===s,expected);
        return performance.now()-started;
    }
    const view=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__view)));
    const counts=()=>page.evaluate(()=>[__ratingCalls,__tagCalls]);
    async function change(next,expected){
        settings={...settings,...next};settingsSocket.send(JSON.stringify({message:settings}));
        if(expected)await page.waitForFunction(s=>document.querySelector('#container').dataset.cacheState===s,expected);
        else await page.waitForTimeout(50);
    }
    async function records(){
        return page.evaluate(async()=>{
            const r=indexedDB.open(SPMAnalysisCache.DB_NAME);const db=await new Promise((a,b)=>{r.onsuccess=()=>a(r.result);r.onerror=()=>b(r.error);});
            const tx=db.transaction(['meta','charts']);
            const get=r=>new Promise(a=>r.onsuccess=()=>a(r.result));
            const [state,charts]=await Promise.all([get(tx.objectStore('meta').get('state')),get(tx.objectStore('charts').getAll())]);db.close();
            return {bytes:state.bytes,charts:charts.map(c=>({id:c.id,digest:c.digest,size:c.size,variants:Object.keys(c.variants),gzip:[...new Uint8Array(Object.values(c.variants)[0]||new ArrayBuffer(0)).slice(0,2)]}))};
        });
    }
    const a=fixture(7,true).replace('Title:Regression','Title:Cache A'),b=fixture(4,true).replace('Title:Regression','Title:Cache B'),c=fixture(6,true).replace('Title:Regression','Title:Cache C');
    try{
        await open();
        const coldMs=await paint(makeFrame('A',a),a,'saved'),cold=await view(),coldDan=await page.locator('#dan-row').textContent();
        assert.deepEqual(await counts(),[1,1]);
        let r=await records();assert.equal(r.charts.length,1);assert.deepEqual(r.charts[0].gzip,[31,139]);
        const compressedBytes=r.bytes,uncompressedBytes=Buffer.byteLength(JSON.stringify(cold));assert(compressedBytes<uncompressedBytes);
        await paint(makeFrame('B',b),b,'saved');assert.deepEqual(await counts(),[2,2]);
        const hitMs=await paint(makeFrame('A',a),a,'hit');assert.deepEqual(await counts(),[2,2]);assert.deepEqual(await view(),cold);
        await page.screenshot({path:path.join(output,'cache-hit.png')});
        await change({algorithm:'SPM Rating v1.2.0-Compact'},'saved');assert.deepEqual(await counts(),[3,3]);
        await change({algorithm:'SPM Rating v1.2.0-Detailed'},'hit');assert.deepEqual(await counts(),[3,3]);
        assert.equal(await page.locator('#dan-row').textContent(),coldDan);assert.deepEqual(await view(),cold);
        await paint(makeFrame('A',a,'DT'),a,'saved');assert.deepEqual(await counts(),[4,4]);
        await paint(makeFrame('A',a),a,'hit');assert.deepEqual(await counts(),[4,4]);
        await change({subDifficultyScheme:'Legacy v0.5.1'},'saved');assert.deepEqual(await counts(),[5,5]);
        await change({subDifficultyScheme:'Direct (RC/LN sub-model)'},'hit');assert.deepEqual(await counts(),[5,5]);
        await change({curveSmoothing:'Off',danDisplayStyle:'Signs (-/+)'});assert.deepEqual(await counts(),[5,5]);
        await change({curveSmoothing:'Medium',danDisplayStyle:'Number'});
        await paint(makeFrame('B',b),b,'hit');assert.deepEqual(await counts(),[5,5]);
        r=await records();const oldA=r.charts.find(c=>c.id.includes('/a.osu'));assert.equal(oldA.variants.length,4);
        // The checksum is deliberately unchanged: inspect actual saved text.
        const edited=a.replace('OverallDifficulty:8','OverallDifficulty:7')+'\n36,192,30000,1,0,0:0:0:0:';
        await paint(makeFrame('A',edited),edited,'saved');assert.deepEqual(await counts(),[6,6]);
        r=await records();const newA=r.charts.find(c=>c.id.includes('/a.osu'));assert.notEqual(newA.digest,oldA.digest);assert.equal(newA.variants.length,1);
        // Returning from the editor also notices an edit without a new checksum.
        const editedAgain=edited.replace('OverallDifficulty:7','OverallDifficulty:6');
        game.send(JSON.stringify(makeFrame('A',edited,'','A','editSong')));await page.waitForTimeout(30);
        await paint(makeFrame('A',editedAgain),editedAgain,'saved');assert.deepEqual(await counts(),[7,7]);
        await change({enableAnalysisCache:false},'off');
        await page.waitForFunction(async()=>{const r=indexedDB.open(SPMAnalysisCache.DB_NAME);const db=await new Promise(a=>r.onsuccess=()=>a(r.result));const q=db.transaction('charts').objectStore('charts').count();const n=await new Promise(a=>q.onsuccess=()=>a(q.result));db.close();return n===0;});
        await paint(makeFrame('B',b),b,'off');await paint(makeFrame('A',a),a,'off');assert.deepEqual(await counts(),[9,9]);assert.equal((await records()).charts.length,0);
        await change({enableAnalysisCache:true},'ready');await paint(makeFrame('B',b),b,'saved');await paint(makeFrame('A',a),a,'saved');
        // Fresh document, same browser storage: both engines must remain idle.
        await page.reload();await instrument();await paint(makeFrame('A',a),a,'hit');assert.deepEqual(await counts(),[0,0]);assert.deepEqual(await view(),cold);
        // Broken compressed bytes are discarded rather than displayed.
        await page.evaluate(async()=>{
            const r=indexedDB.open(SPMAnalysisCache.DB_NAME);const db=await new Promise(a=>r.onsuccess=()=>a(r.result));
            await new Promise((resolve,reject)=>{const tx=db.transaction('charts','readwrite'),store=tx.objectStore('charts'),q=store.getAll();q.onsuccess=()=>{const a=q.result.find(c=>c.id.includes('/a.osu'));a.variants[Object.keys(a.variants)[0]]=new Uint8Array([1,2,3]).buffer;store.put(a);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
        });
        await paint(makeFrame('B',b),b,'hit');await paint(makeFrame('A',a),a,'saved');assert.deepEqual(await counts(),[1,1]);assert.deepEqual(await view(),cold);
        // A response from an old selection must not overwrite B or enter disk.
        delayNext=true;text=c;frame=makeFrame('Race C',c);game.send(JSON.stringify(frame));
        await page.waitForTimeout(50);assert(delayed);
        await paint(makeFrame('B',b),b,'hit');const bView=await view();delayed();delayed=null;await page.waitForTimeout(150);assert.deepEqual(await view(),bView);
        assert(!(await records()).charts.some(c=>c.id.includes('race c')));
        // Endpoint/frame mismatch: refuse a response for a different song.
        text=c;frame=makeFrame('Mismatch A',a);const calls=await counts();game.send(JSON.stringify(frame));
        await page.waitForFunction(()=>document.querySelector('#loading').textContent.includes('Beatmap changed'));
        assert.deepEqual(await counts(),calls);assert(!(await records()).charts.some(c=>c.id.includes('mismatch')));
        await paint(makeFrame('A',a),a,'hit');
        // Real count/byte LRU and cross-version writer guards, in isolated DBs.
        const lru=await page.evaluate(async()=>{
            const value=window.__view,cache=SPMAnalysisCache.create({version:'test',name:'SPM-cache-test-lru',maxCharts:2,maxBytes:1024*1024});await cache.ready;
            for(const id of ['one','two']){await cache.get(id,'digest','v');await cache.put(id,'digest','v',value);}
            await cache.get('one','digest','v');await cache.get('three','digest','v');await cache.put('three','digest','v',value);
            const one=!!await cache.get('one','digest','v');
            const getKeys=async name=>{const r=indexedDB.open(name),db=await new Promise(a=>r.onsuccess=()=>a(r.result));const q=db.transaction('charts').objectStore('charts').getAllKeys();const k=await new Promise(a=>q.onsuccess=()=>a(q.result));db.close();return k;};
            const keys=await getKeys('SPM-cache-test-lru');
            const newer=SPMAnalysisCache.create({version:'new',name:'SPM-cache-test-lru'});await newer.ready;
            const oldWrite=await cache.put('one','digest','v',value);
            const bytes=new TextEncoder().encode(JSON.stringify(value)),compressed=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
            const limit=compressed.byteLength+8,small=SPMAnalysisCache.create({version:'test',name:'SPM-cache-test-bytes',maxBytes:limit});await small.ready;
            for(const id of ['one','two']){await small.get(id,'digest','v');await small.put(id,'digest','v',value);}
            const quota=SPMAnalysisCache.create({version:'test',name:'SPM-cache-test-quota'});await quota.ready;await quota.get('quota','digest','v');
            const put=IDBObjectStore.prototype.put;let quotaWrite;
            try {
                IDBObjectStore.prototype.put=function(value,...args){
                    if(this.name==='charts'&&value.id==='quota'&&Object.keys(value.variants).length)throw new DOMException('Test quota full','QuotaExceededError');
                    return put.call(this,value,...args);
                };
                quotaWrite=await quota.put('quota','digest','v',value);
            } finally { IDBObjectStore.prototype.put=put; }
            const off=SPMAnalysisCache.create({version:'test',name:'SPM-cache-test-off'});await off.ready;await off.get('off','digest','v');
            const pending=off.put('off','digest','v',value);await off.setEnabled(false);const lateWrite=await pending;
            return {one,keys,oldWrite,afterVersion:await getKeys('SPM-cache-test-lru'),byteKeys:await getKeys('SPM-cache-test-bytes'),
                quotaWrite,quotaAvailable:quota.available,quotaKeys:await getKeys('SPM-cache-test-quota'),lateWrite,offKeys:await getKeys('SPM-cache-test-off')};
        });
        assert(lru.one);assert.deepEqual(lru.keys,['one','three']);assert.equal(lru.oldWrite,false);assert.deepEqual(lru.afterVersion,[]);assert.deepEqual(lru.byteKeys,['two']);
        assert.equal(lru.quotaWrite,false);assert.equal(lru.quotaAvailable,false);assert.deepEqual(lru.quotaKeys,[]);assert.equal(lru.lateWrite,false);assert.deepEqual(lru.offKeys,[]);
        for(const [i,file] of process.argv.slice(2).entries()){
            const body=fs.readFileSync(file,'utf8'),name='Real '+i,before=await counts();
            const coldMs=await paint(makeFrame(name,body),body,'saved'),expected=await view();
            assert.deepEqual(await counts(),before.map(x=>x+1));
            await paint(makeFrame('B',b),b,'hit');
            const hitMs=await paint(makeFrame(name,body),body,'hit');assert.deepEqual(await view(),expected);assert.deepEqual(await counts(),before.map(x=>x+1));
            const record=(await records()).charts.find(c=>c.id.includes(`/real ${i}.osu`));
            realCharts.push({keys:expected.result.keyCount,coldMs,hitMs,compressedBytes:record.size,renderSnapshotBytes:Buffer.byteLength(JSON.stringify(expected))});
            await page.screenshot({path:path.join(output,`cache-real-${expected.result.keyCount}k.png`)});
        }
        const precise=rate=>{
            const f=makeFrame('Precise rate',a);f.client='lazer';
            f.menu.mods={array:[{acronym:'DT',settings:{speed_change:rate}}]};return f;
        };
        const beforeRates=await counts();
        await paint(precise(1.23411),a,'saved');await paint(precise(1.23412),a,'saved');
        assert.deepEqual(await counts(),beforeRates.map(x=>x+2));
        await paint(precise(1.23411),a,'hit');assert.deepEqual(await counts(),beforeRates.map(x=>x+2));
        version='1.2.3';await page.reload();await instrument();await paint(makeFrame('A',a),a,'saved');assert.deepEqual(await counts(),[1,1]);assert.equal((await records()).charts.length,1);
        // Close Chrome entirely, reopen its dedicated profile: true disk persistence.
        await context.close();await open();await paint(makeFrame('A',a),a,'hit');assert.deepEqual(await counts(),[0,0]);
        await context.close();await open(true);await paint(makeFrame('A',a),a,'unavailable');assert.deepEqual(await counts(),[1,1]);
        await page.screenshot({path:path.join(output,'cache-storage-unavailable.png')});
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({result:'PASS',coldMs,hitMs,uncompressedBytes,compressedBytes,realCharts,scenarios:['default-on disk cache and true Chrome restart','lossless ratings/tags/raw curves and dan-model restoration','model/rate/subscheme variants','fresh content check with stale checksum','edit invalidates all old variants','editor-return revalidation','disable clears and bypasses; re-enable saves','gzip corruption recovery','rapid selection and wrong-body rejection','LRU chart and byte bounds','version startup cleanup and old-tab write rejection','quota recovery and disabling during pending writes','storage denial preserves normal analysis'],screenshots:output},null,2));
    } finally { if(context)await context.close();await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
