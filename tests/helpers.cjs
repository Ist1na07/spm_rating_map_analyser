'use strict';
const fs = require('node:fs');
const path = require('node:path');
// Keep each engine's browser globals isolated without vm's cross-context timing cost.
function loadRating(source) {
    source = source.replace('root.SPMExtHandRole = {', 'SPMExtHandRole = root.SPMExtHandRole = {')
        .replace('global.SPMExtGeometry = {', 'SPMExtGeometry = global.SPMExtGeometry = {');
    return new Function('globalThis', 'let SPMExtHandRole, SPMExtGeometry;\n' + source +
        '\nreturn {engine: SPMEngine, geometry: SPMExtGeometry, wcount, wmean, wmeanIndexOp};')({});
}
function loadTags(source) { return new Function(source + '\nreturn TagClassifier;')(); }
function fixture(keys = 7, holds = false) {
    const notes = [];
    for (let i = 0; i < 240; i++) {
        const t = 1000 + i * 83 + (i > 120 ? 3000 : 0), col = i % keys;
        notes.push(`${Math.floor((col + .5) * 512 / keys)},192,${t},${holds && i % 3 === 0 ? '128,0,' + (t + 190) + ':0:0:0:' : '1,0,0:0:0:0:'}`);
    }
    return `osu file format v14\n[General]\nMode:3\n[Metadata]\nTitle:Regression\nArtist:SPM\nVersion:Test\nCreator:Ist1na\n[Difficulty]\nCircleSize:${keys}\nOverallDifficulty:8\n[TimingPoints]\n0,500,4,2,1,100,1,0\n[HitObjects]\n` + notes.join('\n');
}
function filesUnder(root) {
    return fs.readdirSync(root, {withFileTypes: true}).flatMap(e => {
        const p = path.join(root, e.name);
        return e.isDirectory() ? filesUnder(p) : e.name.endsWith('.osu') ? [p] : [];
    });
}
module.exports = {loadRating, loadTags, fixture, filesUnder};
