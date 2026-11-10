'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {loadRating, loadTags, fixture} = require('./helpers.cjs');
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
        assert.equal(r.modelInfo.version, '1.2.3');
        assert.equal(r.modelInfo.perception.profile, model);
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
    for (const keys of [4, 6]) {
        const r = tags.analyzeMap(fixture(keys, true));
        assert.equal(r.map.keys, keys);
        assert(r.overall.tags.every(t => ['jack', 'stamina', 'speed', 'tech', 'ln'].includes(t)));
    }
    for (const algorithm of ['stable', 'modern', 'legacy']) assert(tags.analyzeMap(fixture(), {algorithm}).segments.length);
    assert.equal(typeof tags.buildCachedMap, 'function');
    assert.equal(typeof tags.buildEvidenceMap, 'function');
    assert.equal(typeof tags.extractIntermediate, 'function');
});
