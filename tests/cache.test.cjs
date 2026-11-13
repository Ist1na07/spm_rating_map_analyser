'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,loadRating,loadTags}=require('./helpers.cjs');
require('../analysis_cache.js');
const cache=globalThis.SPMAnalysisCache;
test('cache identity uses song-folder-qualified paths and keeps data sources separate',()=>{
    const make=(path,client='stable')=>cache.frame({client,folders:{songs:'E:/osu/Songs'},directPath:{beatmapFile:path}}).id;
    assert.notEqual(make('one/map.osu'),make('two/map.osu'));
    assert.notEqual(make('one/map.osu'),make('one/map.osu','lazer'));
    assert.equal(make('One\\Map.osu'),make('one/map.osu'));
    assert.equal(make('map.osu'),null);
});
test('response identity rejects a different map while accepting Unicode and missing metadata',()=>{
    const text=fixture(7,true),f=cache.frame({beatmap:{title:'Regression',artist:'SPM',version:'Test',mapper:'Ist1na'}});
    assert(cache.matches(text,f));
    assert(!cache.matches(text,{...f,title:'Other map'}));
    assert(cache.matches(text.replace('Title:Regression','Title:English\nTitleUnicode:中文'),{...f,title:'中文'}));
    assert(cache.matches(text,cache.frame({beatmap:{}})));
    assert(!cache.matches(text.replace('Title:Regression','Title:Regression\nBeatmapID:2'),{...f,beatmapId:1}));
});
test('content fingerprint detects note and metadata edits independently of tosu checksum',async()=>{
    const text=fixture(7,true),digest=await cache.fingerprint(text);
    assert.equal(digest,await cache.fingerprint(text));
    assert.notEqual(digest,await cache.fingerprint(text.replace('OverallDifficulty:8','OverallDifficulty:7')));
    assert.notEqual(digest,await cache.fingerprint(text+'\n32,192,30000,1,0,0:0:0:0:'));
});
test('cache snapshot removes diagnostics and sensors without rounding raw curves or changing its input',()=>{
    const text=fixture(7,true),engine=loadRating(fs.readFileSync(require.resolve('../spm_algorithm.js'),'utf8')).engine;
    const result=engine.processMap(text,'full',1,{includeTagEvidence:true}),tags=loadTags(fs.readFileSync(require.resolve('../tag_engine.js'),'utf8')).analyzeMap(text,{ratingEvidence:result.tagEvidence});
    result.classified=true;result.subDifficultyScheme='direct';
    const before=JSON.stringify({result,tags}),s=cache.snapshot(result,tags);
    assert.equal(JSON.stringify({result,tags}),before);
    assert.equal(s.result.tagEvidence,undefined);assert.equal(s.tags.debug,undefined);assert.equal(s.tags.map.notes,undefined);
    assert.deepEqual(s.result.sectionDifficulties,result.sectionDifficulties);
    assert.deepEqual(s.tags.overall,tags.overall);
    s.result.sectionDifficulties[0]=-1;assert.notEqual(result.sectionDifficulties[0],-1);
});
test('v1.2.3 metadata and default-on setting are delivered together',()=>{
    assert.match(fs.readFileSync(require.resolve('../metadata.txt'),'utf8'),/^version:1\.2\.3\s*$/m);
    const settings=require('../settings.json');
    assert.equal(settings.find(s=>s.uniqueID==='enableAnalysisCache').value,true);
    assert.equal(settings.find(s=>s.uniqueID==='enableAnimations').value,true);
});
