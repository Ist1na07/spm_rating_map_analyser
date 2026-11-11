'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {loadRating, loadTags, fixture, patternFixture, pressureFixture} = require('./helpers.cjs');
const root = path.resolve(__dirname, '..');
const baseline = execFileSync('git', ['show', '1e99e4d:spm_algorithm.js'], {cwd: root, encoding: 'utf8'});
const old = loadRating(baseline), current = loadRating(fs.readFileSync(path.join(root, 'spm_algorithm.js'), 'utf8'));
const tags = loadTags(fs.readFileSync(path.join(root, 'tag_engine.js'), 'utf8'));

test('number dans retain the lower-bound marker and the +0.5 scale', () => {
    for (const model of ['detail', 'compact']) for (const keys of [4, 6, 7]) for (const kind of ['RC', 'LN']) {
        const label = x => current.engine.danLevelToLabel(x, keys, kind, 'number', model);
        assert.equal(label(-2), '< 0.50');
        assert.equal(label(-Number.EPSILON), '< 0.50');
        assert.equal(label(0), '0.50');
        assert.equal(label(8), '8.50');
        assert.equal(label(11), '11.50');
        assert.equal(label(NaN), '-');
        assert.equal(label(Infinity), '-');
        for (const style of ['third', 'pm']) for (const level of [-1, 0, .3, 8, 14, 16]) {
            assert.equal(current.engine.danLevelToLabel(level, keys, kind, style, model),
                old.engine.danLevelToLabel(level, keys, kind, style, model));
        }
    }
});

test('optimized ratings, dans and every curve bucket equal the pre-upgrade engine', () => {
    for (const keys of [4, 6, 7]) for (const holds of [false, true]) for (const rate of [.75, 1, 1.5]) for (const model of ['detail', 'compact']) {
        const text = fixture(keys, holds), options = {model};
        assert.deepEqual(current.engine.processMap(text, 'full', rate, options), old.engine.processMap(text, 'full', rate, options));
    }
    for (const model of ['detail', 'compact']) {
        const text = fixture(7, true), options = {model, subDifficultyScheme: 'v051'};
        assert.deepEqual(current.engine.processMap(text, 'full', 1, options), old.engine.processMap(text, 'full', 1, options));
    }
});

test('reused raw rating evidence matches native fractional-rate clocks for both profiles', () => {
    for (const rate of [.75, 1, 1.5]) for (const model of ['detail', 'compact']) {
        const text = fixture(7, true), result = current.engine.processMap(text, 'full', rate, {model, includeTagEvidence: true});
        const {tagEvidence, ...plain} = result;
        assert.deepEqual(plain, old.engine.processMap(text, 'full', rate, {model}));
        const r = tags.analyzeMap(text, {speedRate: rate, ratingEvidence: tagEvidence});
        assert.equal(r.modelInfo.version, '1.2.4');
        assert.equal(r.modelInfo.localExpert, 'original56-joint-fixed-ridge01');
        assert.equal(r.modelInfo.perception.profile, model);
        assert.equal(r.modelInfo.breakPolicy.id, 'sustained-native-demand-r1');
        assert.equal(r.modelInfo.breakPolicy.ratingUsed, true);
        assert.equal(r.overall.perception.difficultyAvailable, true);
        assert.equal(tagEvidence.query[0], 1000 / rate);
        assert.equal(r.map.firstNote, Math.round(1000 / rate));
        assert.equal(r.modelInfo.perception.recipe.alpha, model === 'detail' ? 2 : 4);
        for (const value of Object.values(r.overall.percentages)) assert(Number.isFinite(value) && value >= 0 && value <= 100 + 1e-10);
        const before = JSON.stringify(r.overall);
        current.engine.smoothCurve(result.sectionDifficulties, 4, 342);
        assert.equal(JSON.stringify(r.overall), before);
        assert.throws(() => tags.analyzeMap(text, {speedRate: rate, ratingEvidence: {...tagEvidence, speedRate: rate * 2}}), /Clock/);
    }
});

test('recovery linear sweeps preserve arbitrary query ordering and exact window edges', () => {
    const heads = Float64Array.from([0, 0, 1, 125, 500, 500, 1200, 5000]);
    for (const width of [50, 1000, 1600, 6749.562099456267]) {
        for (const query of [[-5000, -1300, 0, 1, 500, 1500, 6000], [500, -5000, 6000, 0, 500, 499, 500], [6000, NaN, 0, Infinity, -Infinity, 500]]) {
            assert.deepEqual(current.geometry.recoveryMeanRate(heads, query, width), old.geometry.recoveryMeanRate(heads, query, width));
        }
    }
});

test('window endpoints keep left/right inclusion, clipping and duplicate-time behavior', () => {
    for (const times of [[0, 1], [0, 0, 50, 100, 100, 1000], [1000, 1083.3333333333, 1125, 2000, 10000]]) {
        for (const width of [0, 50, 100, 1000, 100000]) {
            const b = {n: times.length, t: Float64Array.from(times)}, val = Float64Array.from(times, (_, i) => i % 3);
            const a = {wmeanOps: new Map()}, c = {wmeanOps: new Map()};
            assert.deepEqual(current.wcount(b, a, val, width), old.wcount(b, c, val, width));
            assert.deepEqual(current.wmeanIndexOp(b, a, width), old.wmeanIndexOp(b, c, width));
            if (width > 0) assert.deepEqual(current.wmean(b, a, val, width), old.wmean(b, c, val, width));
        }
    }
});

test('vendored standalone API retains native 4K/6K, legacy and modern entry points', () => {
    for (const keys of [4, 6]) for (const holds of [false, true]) for (const rate of [.75, 1, 1.5]) {
        const text = fixture(keys, holds), r = tags.analyzeMap(text, {speedRate: rate});
        assert.equal(r.map.keys, keys);
        assert.equal(r.modelInfo.taxonomy, 'coarse5');
        assert.equal(r.modelInfo.nativeKeyCount, keys);
        assert(r.overall.tags.every(t => ['jack', 'stamina', 'speed', 'tech', 'ln'].includes(t)));
        assert(r.segments.every(s => ['jack', 'stamina', 'speed', 'tech', 'ln', 'break'].includes(s.tag)));
        const composition = r.overall.composition;
        assert(Math.abs(Object.values(composition).reduce((a,b) => a+b,0)-1) < 1e-10);
        assert.equal(r.overall.tags[0], Object.keys(composition).sort((a,b) => composition[b]-composition[a])[0]);
        assert.equal(r.overall.percentages, undefined);
        assert.equal(r.overall.perception, undefined);
        assert.equal(r.map.firstNote, 1000/rate);
        const stats = current.engine.computeSegmentStats(r.segments, current.engine.processMap(text,'full',rate));
        assert.equal(stats.length,r.segments.length);
        assert(stats.every(s => Number.isFinite(s.mean) && Number.isFinite(s.peak)));
        assert.throws(() => tags.analyzeMap(text, {ratingEvidence: {}}), /UnsupportedKeys/);
    }
    for (const algorithm of ['stable', 'modern', 'legacy']) assert(tags.analyzeMap(fixture(), {algorithm}).segments.length);
    assert.equal(typeof tags.buildCachedMap, 'function');
    assert.equal(typeof tags.buildEvidenceMap, 'function');
    assert.equal(typeof tags.extractIntermediate, 'function');
});


test('pinned b311c40 retains the retuned local expert and keeps classic explicit', () => {
    const text = fixture(7, true);
    const stable = tags.analyzeMap(text), classic = tags.analyzeMap(text, {aggregation: 'classic'});
    assert.equal(stable.modelInfo.localExpert, 'original56-joint-fixed-ridge01');
    assert.equal(classic.modelInfo.localExpert, 'archived');
    assert.equal(stable.modelInfo.segmentReadout.stepMs, 500);
    assert.equal(stable.modelInfo.segmentReadout.cutContextMs, 4000);
    assert.throws(() => tags.analyzeMap(text, {aggregation: 'classic', ratingEvidence: {}}), /UnusedRating/);
});

test('sustained raw demand reaches the pre-classification Break gate in both profiles', () => {
    const text = pressureFixture();
    assert.equal(tags.analyzeMap(text).segments[0].tag, 'break');
    for (const model of ['detail', 'compact']) {
        const result = current.engine.processMap(text, 'full', 1, {model, includeTagEvidence:true});
        // Controlled pressure sensor: native query/model protocol from the real
        // rating pass, constant demand to isolate the soft-rest veto.
        const evidence = {...result.tagEvidence, demand: result.tagEvidence.demand.map(() => 10)};
        const before = structuredClone(evidence), r = tags.analyzeMap(text, {ratingEvidence:evidence});
        assert.notEqual(r.segments[0].tag, 'break');
        assert.equal(r.modelInfo.breakPolicy.protectedParents, 1);
        assert.equal(r.modelInfo.breakPolicy.referenceDemand, 10);
        assert.deepEqual(evidence, before);
    }
});

test('b311c40 preserves the previous unrated, classic, modern and native 4K/6K paths', () => {
    const previous = loadTags(execFileSync('git', ['show', '7fd451e:tag_engine.js'], {cwd:root, encoding:'utf8'}));
    for (const [text, options] of [
        [pressureFixture(), {}], [fixture(7,true), {aggregation:'classic'}],
        [fixture(7,true), {algorithm:'modern'}], [fixture(7,true), {algorithm:'legacy'}],
        [fixture(4,true), {}], [fixture(6,true), {speedRate:1.5}],
    ]) {
        const r = tags.analyzeMap(text, options), before = previous.analyzeMap(text, options);
        if (r.modelInfo?.breakPolicy) {
            assert.equal(r.modelInfo.breakPolicy.ratingUsed, false);
            delete r.modelInfo.breakPolicy;
        }
        assert.deepEqual(r, before);
    }
});

test('new hand readout excludes false chordstream but retains real hand substitutions', () => {
    for (const [masks, expectedCut] of [[[[0,1,2],[4,5]], false], [[[0,2,4],[1,5]], true]]) {
        const r = tags.analyzeMap(patternFixture(masks));
        const middle = r.segments.filter(s => s.end > 9000 && s.start < 17000);
        assert(middle.length);
        assert.equal(middle.some(s => ['dense chordstream', 'fast chordstream'].includes(s.tag)), expectedCut);
    }
});

test('same-type cadence plateaus retain 150/200 BPM and DT225/300', () => {
    const text = patternFixture([[0,1,4],[2,5,6]], [[200,100],[267,75]]);
    for (const rate of [1, 1.5]) {
        const r = tags.analyzeMap(text, {speedRate: rate});
        for (const [time, bpm] of [[10000,150*rate],[30000,200*rate]]) {
            const s = r.segments.find(s => s.start <= time/rate && s.end > time/rate);
            assert.equal(s.equivBpm, bpm);
            assert(s.evidence.cadence);
        }
    }
});
