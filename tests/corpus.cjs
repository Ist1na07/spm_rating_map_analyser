'use strict';
// Local datasets stay outside the repository. Reports contain metrics, never chart contents.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks'), {execFileSync} = require('node:child_process');
const {loadRating, loadTags, filesUnder, fixture} = require('./helpers.cjs');
const root = path.resolve(__dirname, '..');
const dataset = process.argv[2], maps = process.argv[3], upstream = process.argv[4];
if (!dataset || !maps) throw Error('Usage: node tests/corpus.cjs <dataset> <maps> [SPMTagClassifier-184408e-source]');
const old = loadRating(execFileSync('git', ['show', '1e99e4d:spm_algorithm.js'], {cwd: root, encoding: 'utf8'})).engine;
const current = loadRating(fs.readFileSync(path.join(root, 'spm_algorithm.js'), 'utf8')).engine;
const bundle = fs.readFileSync(path.join(root, 'tag_engine.js'), 'utf8'), tags = loadTags(bundle);
let reference;
if (upstream) {
    assert.equal(bundle, fs.readFileSync(path.join(upstream, 'dist/tag-engine.js'), 'utf8'));
    assert.equal(require(path.resolve(upstream, 'package.json')).version, '1.2.4');
    reference = require(path.resolve(upstream, 'src/index.cjs'));
}
const files = [];
for (const entry of fs.readdirSync(dataset)) {
    const folder = path.join(dataset, entry);
    if (!fs.statSync(folder).isDirectory()) continue;
    const all = filesUnder(folder).sort();
    if (entry.includes('4k') || entry.includes('6k')) {
        // Deterministic size-stratified sample, including smallest and largest charts.
        all.sort((a,b) => fs.statSync(a).size - fs.statSync(b).size);
        for (let i=0;i<12;i++) files.push(all[Math.floor(i*(all.length-1)/11)]);
    } else files.push(...all);
}
for (const entry of fs.readdirSync(maps)) {
    const p = path.join(maps, entry);
    if (fs.statSync(p).isDirectory()) {
        const courses = filesUnder(p).sort((a,b) => fs.statSync(b).size-fs.statSync(a).size);
        if (courses.length) files.push(courses[0]);
    } else if (p.endsWith('.osu')) files.push(p);
}
const report = {charts: 0, keys: {}, ratedClassifications: 0, upstreamParity: 0, failures: [], timing: []};
for (const engine of [old,current]) for (let i=0;i<2;i++) engine.processMap(fixture(7,true),'full',1);
for (let i=0;i<files.length;i++) {
    const file=files[i], text=fs.readFileSync(file,'utf8'), model=i%2?'compact':'detail', rate=[1,.75,1.5][i%3];
    try {
        let a,b,oldMs,newMs;
        const runOld=()=>{const t=performance.now();a=old.processMap(text,'full',rate,{model});oldMs=performance.now()-t;};
        const runNew=()=>{const t=performance.now();b=current.processMap(text,'full',rate,{model,includeTagEvidence:true});newMs=performance.now()-t;};
        if (i%2) {runNew();runOld();} else {runOld();runNew();}
        const {tagEvidence,...plain}=b; assert.deepEqual(plain,a);
        let tagMs=0;
        if (b.keyCount===7) {
            const t=performance.now(),r=tags.analyzeMap(text,{speedRate:rate,ratingEvidence:tagEvidence});tagMs=performance.now()-t;
            assert.equal(r.modelInfo.perception.profile,model);
            assert.equal(r.modelInfo.localExpert,'original56-joint-fixed-ridge01');
            assert.equal(r.overall.perception.difficultyAvailable,true);
            assert.equal(r.segments[0].start,r.map.firstNote);
            assert.equal(r.segments.at(-1).end,r.map.lastNote);
            assert(Object.values(r.overall.percentages).every(x=>Number.isFinite(x)&&x>=0&&x<=100+1e-8));
            if (reference && report.upstreamParity<12) {
                assert.equal(JSON.stringify(r),JSON.stringify(reference.analyzeMap(text,{speedRate:rate,ratingEvidence:tagEvidence})));
                report.upstreamParity++;
            }
            report.ratedClassifications++;
        }
        report.charts++;report.keys[b.keyCount]=(report.keys[b.keyCount]||0)+1;
        report.timing.push({model,rate,keys:b.keyCount,notes:b.noteCount,oldMs,newMs,tagMs});
    } catch(error) { report.failures.push({file:path.basename(file),error:error.stack}); }
    if ((i+1)%40===0) console.error(`${i+1}/${files.length}`);
}
const avg=key=>report.timing.reduce((s,x)=>s+x[key],0)/report.timing.length;
report.averageMs={ratingBefore:avg('oldMs'),ratingAfter:avg('newMs'),tag:avg('tagMs')};
report.averageMs.upgradedPipelineBeforeOptimization=avg('oldMs')+avg('tagMs');
report.averageMs.upgradedPipelineAfterOptimization=avg('newMs')+avg('tagMs');
console.log(JSON.stringify(report,null,2));
if(report.failures.length)process.exitCode=1;
