/* SPMTagClassifier v1.2.4 | MIT | Ist1na */
var TagClassifier=(()=>{
const modules=[function(module,exports,load){
'use strict';
const legacy=load(1);
const {parseOsu,prepare}=load(2);
const {features,windows,FEATURE_KEYS}=load(3);
const {coarseResult}=load(4),{lnResult}=load(7);
const geometry=load(9),{version}=load(6);
const {correctCadenceDisplay}=load(10);
const {refine:refineSegments}=load(11);
const overlay7=load(12),overlayProfile=load(13);
const profile4=load(14),profile7=load(15);
const native4=load(16),native6=load(17),native7=load(18);
const perception=load(19),perceptionProfiles=load(20).profiles;
function profile(key){return key===4?profile4:profile7;}
function evidenceMap(osuText,opts={}) {
  const map=parseOsu(osuText,opts),ctx=prepare(map,10);
  const contexts={10:ctx};
  const cache={};
  const getWindows=(ms,merge=10)=>{
    const key=ms+':'+merge;
    return cache[key]??(cache[key]=windows(contexts[merge]??(contexts[merge]=prepare(map,merge)),ms,2000));
  };
  return {map,ctx,getWindows};
}
function describe(w) {
  const m=w.metrics;
  return {anchor:m.anchorShare,trill:m.trillFraction,roll:m.rollFraction,
    repetition:1-m.maskEntropy,occupancy:m.occupancy,releaseIndependence:m.releaseIndependence};
}
function stable7(osuText,opts,e) {
  const perceptual=opts.aggregation!=='classic';
  const name=opts.ratingEvidence?(opts.ratingEvidence.modelIdentity===perception.COMPACT_RATING?'compact':'detail'):'actions',p=perceptionProfiles[name];
  const r=overlay7.analyzeMap(osuText,{...opts,_rawEvidence:true,_archivedExpert:!perceptual,_segmentReadout:(raw,resolveBpm)=>refineSegments(e.ctx,raw,p.classes,{resolveBpm,speedRate:opts.speedRate??1,supportPower:p.supportPower??1})}),geometryContext=geometry.prepare(e.ctx);
  const classicPrior=r.debug.classicPrior,branchSupport=r.debug.readoutSupport,cutExclusions=r.debug.cutExclusions;
  delete r.debug.classicPrior;delete r.debug.readoutSupport;delete r.debug.cutExclusions;
  const raw=r.debug.rawSegments;delete r.debug.rawSegments;
  // The inherited segmenter can omit a short leading pickup when snapping.
  // Extend only the envelope; keep the learned tags and overall decision.
  if(r.segments.length){r.segments[0].start=r.map.firstNote;r.segments.at(-1).end=r.map.lastNote;}
  for(const s of r.segments) {
    const w=features(e.ctx,s.start,Math.max(s.start+1,s.end));
    const raw=s.scores??{[s.tag]:1},sum=Object.values(raw).reduce((a,b)=>a+b,0);
    const distribution=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,sum>0?v/sum:Number(k===s.tag)]));
    const ranked=Object.values(distribution).sort((a,b)=>b-a);
    s.distribution=distribution;
    const archivedEquivBpm=s._archivedEquivBpm;delete s._archivedEquivBpm;
    const cadence=s.evidence?.cadence;
    s.evidence={...(cadence?{cadence}:{}),...(archivedEquivBpm===undefined?{}:{archivedEquivBpm}),normalizedEntropy:ranked.length>1?-ranked.reduce((a,v)=>v>0?a+v*Math.log(v):a,0)/Math.log(ranked.length):0,
      margin:(ranked[0]||0)-(ranked[1]||0),effort:w.metrics.effort,occupancy:w.metrics.occupancy,
      featureWindows:1,contextNoteObservations:w.notes,legacyConfidence:s.confidence,
      geometry:geometry.describeInterval(geometryContext,s.start,Math.max(s.start+1,s.end))};
  }
  const total=Object.values(r.overall.weights).reduce((a,b)=>a+b,0);
  r.overall.composition=total>0?Object.fromEntries(Object.entries(r.overall.weights).map(([k,v])=>[k,v/total])):{break:1};
  r.overall.scoreKind='legacy decision scores; distribution is normalized affinity, not calibrated confidence';
  r.modelInfo={version,keyCount:7,variant:'legacy-stable',researchVariant:'anchored-ln-release',
    segmentEvidence:(perceptual?'joint-retuned56D affinities; frozen reference predictor for integral prior; ':'archived affinities; ')+'LN wildcard prototype ambiguity is not inactivity; regular-rest gate and two-thumb static-hand cut exclusion; stable cadence plateaus',temporalResolutionMs:250,
    localExpert:perceptual?'original56-joint-fixed-ridge01':'archived',
    segmentReadout:{stepMs:500,cutContextMs:4000,minCadencePlateauMs:1800,cutExcludedFrames:cutExclusions},
    overlayPolicy:{regularityRestRelativeNps:overlayProfile.gate.ratio,regularityRestRowRateMax:overlayProfile.gate.rowRateMax,
      rowRateUnit:'rows per converted second',aggregation:'unchanged legacy policy'}};
  if(perceptual){
    const rating=opts.ratingEvidence;
    const a=perception.infer(e.map,raw,rating,p,{speedRate:opts.speedRate??1,context:e.ctx,baseline:classicPrior??r.overall,_branchSupport:branchSupport});
    r.overall=a.overall;perception.decorateSegments(r.segments,a,p.classes);
    r.modelInfo.overlayPolicy.aggregation='support-weighted perceptual burden';
    r.modelInfo.perception={profile:name,recipe:{...p.recipe},supportPower:p.supportPower,
      family:{...p.family},policy:{...p.policy},ratingModelIdentity:p.modelIdentity};
  }
  r.descriptors=e.getWindows(4000).map(w=>({start:w.start,end:w.end,...describe(w)}));
  return r;
}
function analyzeMap(osuText,opts={}) {
  if(opts.aggregation!==undefined&&!['classic','perceptual'].includes(opts.aggregation))throw Error('UnknownAggregation: expected classic or perceptual');
  if((opts.aggregation==='perceptual'||opts.ratingEvidence)&&opts.algorithm&&opts.algorithm!=='stable')throw Error('PerceptionUnsupportedAlgorithm: requires stable 7K');
  if(opts.ratingEvidence&&opts.aggregation==='classic')throw Error('PerceptionUnusedRating: classic aggregation does not consume a difficulty curve');
  if(opts.algorithm==='legacy')return legacy.analyzeMap(osuText,opts);
  if(opts.algorithm && !['modern','stable'].includes(opts.algorithm))throw new Error('UnknownAlgorithm: expected modern, stable or legacy');
  const e=evidenceMap(osuText,opts),{map}=e;
  if(map.keys!==7&&(opts.aggregation==='perceptual'||opts.ratingEvidence))throw Error('PerceptionUnsupportedKeys: fitted profiles currently require native 7K');
  // Stable 7K uses the retuned original56D expert with the existing integral
  // profiles. classic retains its previous local expert and aggregation path.
  if(map.keys===7){
    const r=opts.algorithm==='modern'?lnResult(osuText,native7,opts,e):stable7(osuText,opts,e);
    return correctCadenceDisplay(r,e.ctx,opts.speedRate??1);
  }
  return coarseResult(osuText,map.keys===4?native4:native6,opts);
}

function extractIntermediate(text,opts={}) {
  if(opts.algorithm==='legacy')return legacy.extractIntermediate(text,opts);
  const r=analyzeMap(text,opts);return {map:r.map,windows:r.debug.windows,segments:r.segments,overall:r.overall};
}
function buildEvidenceMap(text,opts={}) {
  const e=evidenceMap(text,opts),ws=e.getWindows(profile(e.map.keys).windowMs);
  return {map:e.map,windows:ws,global:features(e.ctx,e.map.firstNote,Math.max(e.map.firstNote+1,e.map.lastNote+1)),featureKeys:FEATURE_KEYS};
}
// Preserve the original cache schema and entry point for existing callers.
module.exports={analyzeMap,extractIntermediate,buildCachedMap:legacy.buildCachedMap,buildEvidenceMap,ratingEvidenceFromSPM:perception.ratingEvidenceFromSPM,legacy};

},
function(module,exports,load){
"use strict";
var TagClassifier = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    analyzeMap: () => analyzeMap,
    buildCachedMap: () => buildCachedMap,
    extractIntermediate: () => extractIntermediate
  });

  // src/parser/osu.ts
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function parseOsu(text) {
    const lines = text.split(/\r?\n/);
    let section = "";
    const notes = [];
    const timingPoints = [];
    const breaks = [];
    let keys = 0;
    let od = 6;
    let hp;
    let title;
    let artist;
    let version;
    let creator;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("[")) {
        section = line.slice(1, line.indexOf("]")).toLowerCase();
        continue;
      }
      switch (section) {
        case "general":
          if (line.startsWith("Mode:")) {
            if (parseInt(line.slice(5).trim(), 10) !== 3) {
              throw new Error("NotMania");
            }
          }
          break;
        case "metadata": {
          const ci = line.indexOf(":");
          if (ci < 0) break;
          const k = line.slice(0, ci).trim();
          const v = line.slice(ci + 1).trim();
          if (k === "Title") title = v;
          else if (k === "Artist") artist = v;
          else if (k === "Version") version = v;
          else if (k === "Creator") creator = v;
          break;
        }
        case "difficulty": {
          const ci = line.indexOf(":");
          if (ci < 0) break;
          const k = line.slice(0, ci).trim();
          const v = parseFloat(line.slice(ci + 1).trim());
          if (k === "CircleSize") keys = v > 0 ? Math.round(v) : 10;
          else if (k === "OverallDifficulty") od = v;
          else if (k === "HPDrainRate") hp = v;
          break;
        }
        case "events": {
          if (line.startsWith("2 ") || line.startsWith("2	")) {
            const parts = line.split(/\s+/);
            const s = parseInt(parts[1], 10);
            const e = parseInt(parts[2], 10);
            if (Number.isFinite(s) && Number.isFinite(e)) breaks.push([s, e]);
          }
          break;
        }
        case "timingpoints": {
          const p = line.split(",");
          if (p.length < 2) break;
          const t = parseFloat(p[0]);
          const bl = parseFloat(p[1]);
          const uninherited = p.length >= 7 ? p[6].trim() !== "0" : bl > 0;
          if (uninherited && bl > 0 && Number.isFinite(t)) timingPoints.push({ t, beatLength: bl });
          break;
        }
        case "hitobjects": {
          if (!keys) keys = 7;
          const p = line.split(",");
          if (p.length < 5) break;
          const x = parseFloat(p[0]);
          if (!Number.isFinite(x)) break;
          const type = parseInt(p[3], 10);
          const t = Math.round(parseFloat(p[2]));
          const col = clamp(Math.trunc(x * keys / 512), 0, keys - 1);
          if (type & 128) {
            const tailField = p[5] ?? p[4];
            const lnEnd = Math.round(parseFloat(String(tailField).split(":")[0]));
            notes.push({ t, col, lnEnd: Number.isFinite(lnEnd) ? Math.max(lnEnd, t) : null });
          } else if (type & 1) {
            notes.push({ t, col, lnEnd: null });
          }
          break;
        }
      }
    }
    if (!notes.length) throw new Error("EmptyBeatmap");
    notes.sort((a, b) => a.t - b.t || a.col - b.col);
    timingPoints.sort((a, b) => a.t - b.t);
    let lastNote = 0;
    for (const n of notes) lastNote = Math.max(lastNote, n.lnEnd ?? n.t);
    return {
      keys,
      notes,
      timingPoints,
      breaks,
      meta: { title, artist, version, creator, od, hp },
      firstNote: notes[0].t,
      lastNote
    };
  }
  function beatLengthAt(tps, t) {
    if (!tps.length) return 500;
    let lo = 0;
    let hi = tps.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >> 1;
      if (tps[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return tps[lo].beatLength;
  }

  // src/config.ts
  var CONFIG = {
    /** merge hits within this window into one row */
    rowMergeMs: 10,
    // ---- grid fitting ----
    /** tolerance around grid points (ms) */
    gridTolMs: 30,
    /** minimum fraction of hits that must sit on the grid to count as "regular" */
    gridMinRatio: 0.6,
    /** candidate spacings below this (ms) are halved/doubled to normalize */
    gridMinSpacing: 45,
    gridMaxSpacing: 2e3,
    // ---- feature windows ----
    /** feature window length (ms) */
    winMs: 1e3,
    /** feature window step (ms) */
    winStepMs: 250,
    /** windows shorter than this note count get flagged low-density */
    winMinNotes: 4,
    // ---- segmentation ----
    /** minimum prominence (absolute) for a change point */
    segProminenceAbs: 0.05,
    /** minimum prominence relative to local signal scale */
    segProminenceRel: 0.35,
    /** minimum segment length before merging (ms) */
    minSegLenMs: 3e3,
    /** when merging a short segment, prefer the neighbor whose feature dist is smaller */
    mergeBySimilarity: true,
    /** gap between consecutive notes considered a rest (ms) */
    restGapMs: 2500,
    /** a segment whose nps is below this quantile of map nps may be Break */
    breakNpsQuantile: 0.25,
    /** absolute nps floor under which a segment is Break regardless */
    breakAbsNps: 1.2,
    // ---- classification ----
    /** weighted LN-head stream ratio above which a segment is LN-dominant */
    lnDominantRatio: 0.45,
    /** min confidence for displaying a secondary tag */
    secondaryMargin: 0.75,
    // ---- overall aggregation ----
    /** share of best tag's weight over total for a single dominant tag */
    overallDominantShare: 0.52,
    /** minimum weight share for a tag to be counted in mix counting */
    overallMixShare: 0.07
  };

  // src/core/rows.ts
  function popcount(mask) {
    let c = 0;
    while (mask) {
      mask &= mask - 1;
      c++;
    }
    return c;
  }
  function buildRows(map) {
    const rows = [];
    const merge = CONFIG.rowMergeMs;
    let i = 0;
    const n = map.notes.length;
    while (i < n) {
      const t0 = map.notes[i].t;
      let mask = 0;
      let lnHeadMask = 0;
      let lnTailMask = 0;
      while (i < n && map.notes[i].t - t0 <= merge) {
        const nt = map.notes[i];
        mask |= 1 << nt.col;
        if (nt.lnEnd != null) lnHeadMask |= 1 << nt.col;
        i++;
      }
      rows.push({ t: t0, mask, hits: popcount(mask), lnHeadMask, lnTailMask });
    }
    return rows;
  }
  function attachTails(map, rows) {
    const tails = [];
    for (const n of map.notes) {
      if (n.lnEnd != null) tails.push({ t: n.lnEnd, col: n.col });
    }
    tails.sort((a, b) => a.t - b.t);
    let ri = 0;
    const extra = [];
    for (const tail of tails) {
      while (ri + 1 < rows.length && rows[ri + 1].t <= tail.t + CONFIG.rowMergeMs) ri++;
      let best = -1;
      let bestDist = Infinity;
      for (let k = ri; k >= 0 && rows[k].t >= tail.t - CONFIG.rowMergeMs * 4; k--) {
        const d = Math.abs(rows[k].t - tail.t);
        if (d < bestDist && d <= CONFIG.rowMergeMs * 4) {
          bestDist = d;
          best = k;
        }
      }
      if (best >= 0) {
        rows[best].lnTailMask |= 1 << tail.col;
      } else {
        extra.push({ t: tail.t, mask: 0, hits: 0, lnHeadMask: 0, lnTailMask: 1 << tail.col });
      }
    }
    if (extra.length) {
      rows.push(...extra);
      rows.sort((a, b) => a.t - b.t);
    }
  }
  function buildColumnData(map) {
    const K = map.keys;
    const colNotes = Array.from({ length: K }, () => []);
    for (const n of map.notes) colNotes[n.col].push(n.t);
    const colIntervals = [];
    for (let c = 0; c < K; c++) {
      const arr = colNotes[c];
      const iv = [];
      for (let i = 1; i < arr.length; i++) iv.push(arr[i] - arr[i - 1]);
      colIntervals.push(iv);
    }
    return { colNotes, colIntervals };
  }
  function computeHeld(map, rows) {
    const events = [];
    for (const n of map.notes) {
      if (n.lnEnd != null && n.lnEnd - n.t > 1) {
        events.push({ t: n.t, col: n.col, type: 0 });
        events.push({ t: n.lnEnd, col: n.col, type: 1 });
      }
    }
    events.sort((a, b) => a.t - b.t || a.type - b.type);
    const heldMask = new Int32Array(rows.length);
    const lockRow = new Uint8Array(rows.length);
    const freeHits = new Int32Array(rows.length);
    const heldHits = new Int32Array(rows.length);
    let held = 0;
    let ei = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const t = rows[ri].t;
      while (ei < events.length && events[ei].t <= t) {
        const e = events[ei];
        if (e.type === 0) held |= 1 << e.col;
        else held &= ~(1 << e.col);
        ei++;
      }
      heldMask[ri] = held;
      if (held) {
        const free = rows[ri].mask & ~held;
        const onHeld = rows[ri].mask & held;
        freeHits[ri] = popcount(free);
        heldHits[ri] = popcount(onHeld);
        lockRow[ri] = held !== 0 && free !== 0 ? 1 : 0;
      } else {
        freeHits[ri] = rows[ri].hits;
        heldHits[ri] = 0;
      }
    }
    return { heldMask, lockRow, freeHits, heldHits };
  }

  // src/core/grid.ts
  function gridCoverage(times, spacing, tol) {
    const n = times.length;
    if (n === 0 || spacing <= 0) return 0;
    const bins = Math.max(8, Math.round(spacing / Math.max(tol, 5)));
    const hist = new Int32Array(bins);
    for (let i = 0; i < n; i++) {
      let m = times[i] % spacing;
      if (m < 0) m += spacing;
      hist[Math.min(bins - 1, Math.floor(m / spacing * bins))]++;
    }
    let peakBin = 0;
    for (let b = 1; b < bins; b++) if (hist[b] > hist[peakBin]) peakBin = b;
    const phase = (peakBin + 0.5) / bins * spacing;
    let onGrid = 0;
    for (let i = 0; i < n; i++) {
      let d = (times[i] - phase) % spacing;
      if (d < 0) d += spacing;
      if (d > spacing / 2) d = spacing - d;
      if (d <= tol) onGrid++;
    }
    return onGrid / n;
  }
  function fitGrid(rows, tStart, tEnd, lo, hi) {
    const times = [];
    if (lo !== void 0 && hi !== void 0) {
      for (let i = lo; i < hi; i++) {
        const r = rows[i];
        if (r.hits > 0) times.push(r.t);
      }
    } else {
      for (const r of rows) {
        if (r.hits > 0 && r.t >= tStart && r.t <= tEnd) times.push(r.t);
      }
    }
    const n = times.length;
    if (n < 4) return { spacing: 0, ratio: 0, equivBpm: 0 };
    const uniq = [times[0]];
    for (let i = 1; i < n; i++) if (times[i] - uniq[uniq.length - 1] > CONFIG.rowMergeMs) uniq.push(times[i]);
    const arr = Float64Array.from(uniq);
    const ivs = [];
    for (let i = 1; i < arr.length; i++) ivs.push(arr[i] - arr[i - 1]);
    ivs.sort((a, b) => a - b);
    const medianIv = ivs[Math.floor(ivs.length / 2)] || 500;
    const tol = CONFIG.gridTolMs;
    let bestSpacing = 0;
    let bestRatio = 0;
    const evaluate = (s) => {
      if (!(s >= CONFIG.gridMinSpacing && s <= CONFIG.gridMaxSpacing)) return;
      const cov = gridCoverage(arr, s, tol);
      if (cov > bestRatio + 1e-9 || Math.abs(cov - bestRatio) <= 1e-9 && s > bestSpacing) {
        bestRatio = cov;
        bestSpacing = s;
      }
    };
    const bases = [medianIv, medianIv / 2];
    for (const b of bases) {
      for (let mult = 1; mult <= 6; mult++) evaluate(b * mult);
    }
    if (bestRatio < CONFIG.gridMinRatio) {
      for (let s = CONFIG.gridMinSpacing; s <= 800; s = s * 1.12) evaluate(s);
    }
    return {
      spacing: bestSpacing,
      ratio: bestRatio,
      equivBpm: bestSpacing > 0 ? 15e3 / bestSpacing : 0
    };
  }

  // src/core/features.ts
  function buildFeatureContext(map, rows, held, cols) {
    const K = map.keys;
    const boundaryTimes = [];
    for (let b = 0; b <= K; b++) boundaryTimes.push(new Float64Array(0));
    for (let b = 1; b < K; b++) {
      const a = cols.colNotes[b - 1];
      const c = cols.colNotes[b];
      const merged = new Float64Array(a.length + c.length);
      let i = 0, j = 0, m = 0;
      while (i < a.length && j < c.length) merged[m++] = a[i] <= c[j] ? a[i++] : c[j++];
      while (i < a.length) merged[m++] = a[i++];
      while (j < c.length) merged[m++] = c[j++];
      boundaryTimes[b] = merged.subarray(0, m);
    }
    const lnHeads = [];
    const lnTails = [];
    const allEvents = [];
    for (const n of map.notes) {
      if (n.lnEnd != null) {
        lnHeads.push({ t: n.t, col: n.col, dur: n.lnEnd - n.t });
        lnTails.push({ t: n.lnEnd, col: n.col, start: n.t });
        allEvents.push({ t: n.t, col: n.col, kind: "head" });
        allEvents.push({ t: n.lnEnd, col: n.col, kind: "tail" });
      } else {
        allEvents.push({ t: n.t, col: n.col, kind: "head" });
      }
    }
    allEvents.sort((a, b) => a.t - b.t);
    lnTails.sort((a, b) => a.t - b.t);
    let lnMaxDur = 0;
    for (const h of lnHeads) if (h.dur > lnMaxDur) lnMaxDur = h.dur;
    const riceArr = map.notes.filter((n) => n.lnEnd == null).map((n) => n.t);
    riceArr.sort((a, b) => a - b);
    const riceTimes = Float64Array.from(riceArr);
    return { map, rows, held, cols, boundaryTimes, lnHeads, lnTails, lnMaxDur, allEvents, riceTimes };
  }
  function lowerBound(arr, t) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (arr[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function lowerBoundObj(arr, t, key) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (key(arr[mid]) < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function upperBoundObj(arr, t, key) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (key(arr[mid]) <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  var BOUNDARY_W = {
    7: [0.225, 0.35, 0.25, 0.225, 0.225, 0.25, 0.35, 0.225]
  };
  function cutDemandInWindow(ctx, t0, t1) {
    const K = ctx.map.keys;
    const w = BOUNDARY_W[K] ?? Array.from({ length: K + 1 }, (_, i) => Math.abs(i - K / 2) < 1 ? 0.05 : 0.35);
    let sum = 0;
    for (let b = 1; b < K; b++) {
      const arr = ctx.boundaryTimes[b];
      const lo = lowerBound(arr, t0);
      const hi = lowerBound(arr, t1);
      if (hi - lo < 2) continue;
      for (let i = lo + 1; i < hi; i++) {
        const dt = (arr[i] - arr[i - 1]) / 1e3;
        if (dt > 0 && dt < 0.5) sum += w[b] / (dt * dt);
      }
    }
    return sum / ((t1 - t0) / 1e3);
  }
  function computeWindowFeatures(ctx, t0, t1) {
    const rows = ctx.rows;
    const held = ctx.held;
    const K = ctx.map.keys;
    const durS = (t1 - t0) / 1e3;
    const loIdx = Math.max(0, lowerBoundObj(rows, t0, (r) => r.t) - 1);
    const hiIdx = lowerBoundObj(rows, t1, (r) => r.t);
    let notes = 0;
    let rowCount = 0;
    let chordSum = 0;
    let largeHits = 0, multiHits = 0, singleRows = 0;
    let jackPairs = 0, pairCount = 0, overlapSum = 0, cutPairs = 0;
    const ivs = [];
    for (let i = loIdx; i < hiIdx; i++) {
      const r = rows[i];
      const inWin = r.t >= t0 && r.t < t1;
      if (!inWin || r.hits === 0) continue;
      rowCount++;
      notes += r.hits;
      chordSum += r.hits;
      if (r.hits >= 3) largeHits += r.hits;
      if (r.hits >= 2) multiHits += r.hits;
      if (r.hits === 1) singleRows++;
      if (i > 0 && rows[i - 1].hits > 0) {
        const prev = rows[i - 1];
        const ovMask = prev.mask & r.mask;
        const ov = popcount(ovMask);
        pairCount++;
        if (ov > 0) {
          jackPairs++;
          overlapSum += ov / Math.min(prev.hits, r.hits);
        } else cutPairs++;
        ivs.push(r.t - prev.t);
      }
    }
    const f = {
      t: t0,
      end: t1,
      nps: notes / durS,
      rows: rowCount,
      notes,
      equivBpm: 0,
      gridRatio: 0,
      rhythmSteady: 0,
      chordMean: rowCount ? chordSum / rowCount : 0,
      largeChordRatio: notes ? largeHits / notes : 0,
      multiRatio: notes ? multiHits / notes : 0,
      singleRatio: rowCount ? singleRows / rowCount : 0,
      jackRowRatio: pairCount ? jackPairs / pairCount : 0,
      overlapDegree: jackPairs ? overlapSum / jackPairs : 0,
      jackSpeedBpm: 0,
      cutFreeRatio: pairCount ? cutPairs / pairCount : 0,
      cutDemand: 0,
      anchorRate: 0,
      trillRate: 0,
      altHandRate: 0,
      rollRate: 0,
      graceRate: 0,
      offBeatRatio: 0,
      lnWeightRatio: 0,
      lockRatio: 0,
      lnAreaRatio: 0,
      heldCoverage: 0,
      tailRate: 0,
      tailIndependence: 0,
      tailScatter: 0,
      shortLnRatio: 0,
      invGapScore: 0
    };
    if (rowCount === 0) return f;
    const gridLo = lowerBoundObj(rows, t0, (r) => r.t);
    const gridHi = upperBoundObj(rows, t1 - 1, (r) => r.t);
    const grid = fitGrid(rows, t0, t1 - 1, gridLo, gridHi);
    f.equivBpm = grid.equivBpm;
    f.gridRatio = grid.ratio;
    if (ivs.length >= 3) {
      const sorted = [...ivs].sort((a, b) => a - b);
      const modal = sorted[Math.floor(sorted.length / 2)];
      let steady = 0;
      let grace = 0;
      for (const iv of ivs) {
        const q = iv / modal;
        const nearest = Math.max(1, Math.round(q));
        if (Math.abs(iv - nearest * modal) <= CONFIG.gridTolMs) steady++;
        if (iv < modal * 0.45) grace++;
      }
      f.rhythmSteady = steady / ivs.length;
      f.graceRate = grace / ivs.length;
      const repDts = [];
      const cols = ctx.cols.colNotes;
      for (let c = 0; c < K; c++) {
        const arr = cols[c];
        const clo = lowerBound(arr, t0);
        const chi = lowerBound(arr, t1);
        for (let i = clo + 1; i < chi; i++) {
          const dt = arr[i] - arr[i - 1];
          if (dt < 1e3) repDts.push(dt);
        }
      }
      if (repDts.length) {
        repDts.sort((a, b) => a - b);
        const med = repDts[Math.floor(repDts.length / 2)];
        f.jackSpeedBpm = med > 0 ? Math.min(15e3 / med, 400) : 0;
      }
    }
    {
      let anchorNotes = 0;
      for (let c = 0; c < K; c++) {
        const arr = ctx.cols.colNotes[c];
        const clo = lowerBound(arr, t0);
        const chi = lowerBound(arr, t1);
        let run = 1;
        let dts = [];
        const flush = () => {
          if (run >= 3 && dts.length >= 2) {
            const m = dts.reduce((x, y) => x + y, 0) / dts.length;
            const v = dts.reduce((x, y) => x + (y - m) ** 2, 0) / dts.length;
            if (m > 0 && Math.sqrt(v) / m < 0.3) anchorNotes += run;
          }
        };
        for (let i = clo + 1; i < chi; i++) {
          const dt = arr[i] - arr[i - 1];
          const ref = dts.length ? dts[dts.length - 1] : dt;
          if (dt > ref * 1.8 || dt < ref * 0.56 || dt > 1500) {
            flush();
            run = 1;
            dts = [];
          } else {
            run++;
            dts.push(dt);
          }
        }
        flush();
      }
      f.anchorRate = notes ? anchorNotes / notes : 0;
      const split2 = K <= 1 ? 1 : Math.ceil(K / 2);
      const seq = [];
      for (let i = loIdx; i < hiIdx; i++) {
        const r = rows[i];
        if (r.hits === 0 || r.t < t0 || r.t >= t1) continue;
        let col = -1, left = 0;
        for (let c = 0; c < K; c++) {
          if (r.mask & 1 << c) {
            col = c;
            if (c < split2) left++;
          }
        }
        seq.push({ t: r.t, col: r.hits === 1 ? col : -1, hand: left * 2 >= r.hits ? 0 : 1, hits: r.hits });
      }
      let altHandRows = 0;
      {
        let run = 1;
        for (let i = 1; i < seq.length; i++) {
          const cont = seq[i].hand !== seq[i - 1].hand && (i >= 2 ? seq[i].hand === seq[i - 2].hand : false);
          if (cont) run++;
          else {
            if (run >= 4) altHandRows += run;
            run = i + 1 < seq.length && seq[i + 1].hand !== seq[i].hand ? 2 : 1;
          }
        }
        if (run >= 4) altHandRows += run;
      }
      f.altHandRate = seq.length ? altHandRows / seq.length : 0;
      let trillRows = 0;
      {
        const singles = seq.filter((s) => s.hits === 1);
        let run = 1;
        for (let i = 1; i < singles.length; i++) {
          const cont = singles[i].col !== singles[i - 1].col && (i >= 2 ? singles[i].col === singles[i - 2].col && singles[i - 1].col !== singles[i - 2].col : false);
          if (cont) run++;
          else {
            if (run >= 5) trillRows += run;
            run = 1;
          }
        }
        if (run >= 5) trillRows += run;
        f.trillRate = singles.length ? trillRows / singles.length : 0;
      }
      {
        const singles = seq.filter((s) => s.hits === 1);
        let dir = 0, run = 1, rollRows = 0;
        for (let i = 1; i < singles.length; i++) {
          const d = Math.sign(singles[i].col - singles[i - 1].col);
          if (d !== 0 && (dir === 0 || d === dir)) {
            dir = d;
            run++;
          } else {
            if (run >= 4) rollRows += run;
            run = d !== 0 ? 2 : 1;
            dir = d;
          }
        }
        if (run >= 4) rollRows += run;
        f.rollRate = singles.length ? rollRows / singles.length : 0;
      }
      if (ctx.map.timingPoints.length && seq.length) {
        const anchor = ctx.map.timingPoints[0].t;
        let off = 0;
        for (const s of seq) {
          const q = beatLengthAt(ctx.map.timingPoints, s.t) / 4;
          let d = (s.t - anchor) % q;
          if (d < 0) d += q;
          if (d > q / 2) d = q - d;
          if (d > 40) off++;
        }
        f.offBeatRatio = off / seq.length;
      }
    }
    const split = K <= 1 ? 1 : Math.ceil(K / 2);
    {
      let lnW = 0;
      const heads = ctx.lnHeads;
      const hFrom = lowerBoundObj(heads, t0, (h) => h.t);
      const hTo = lowerBoundObj(heads, t1, (h) => h.t);
      for (let i = hFrom; i < hTo; i++) lnW += 1 + Math.min(heads[i].dur, 1200) / 400;
      const riceCount = lowerBound(ctx.riceTimes, t1) - lowerBound(ctx.riceTimes, t0);
      const totalW = lnW + riceCount;
      f.lnWeightRatio = totalW > 0 ? lnW / totalW : 0;
      let heldSum = 0, heldCount = 0;
      for (let i = loIdx; i < hiIdx; i++) {
        const r = rows[i];
        if (r.t < t0 || r.t >= t1 || r.hits === 0) continue;
        const hm = held.heldMask[i];
        if (hm) {
          heldSum += popcount(hm);
          heldCount++;
          if ((r.mask & ~hm) !== 0) f.lockRatio += 1;
        }
      }
      f.lockRatio /= rowCount;
      f.heldCoverage = heldCount ? heldSum / heldCount / K : 0;
      {
        const hs = ctx.lnHeads;
        const ts = ctx.lnTails;
        const active = [];
        const aLo = lowerBoundObj(hs, t0 - ctx.lnMaxDur, (h) => h.t);
        const aHi = lowerBoundObj(hs, t1, (h) => h.t);
        for (let i = aLo; i < aHi; i++) {
          const h = hs[i];
          if (h.t + h.dur >= t0) active.push({ start: h.t, end: h.t + h.dur });
        }
        const tLo = lowerBoundObj(ts, t0, (x) => x.t);
        const tHi = upperBoundObj(ts, t1, (x) => x.t);
        for (let i = tLo; i < tHi; i++) {
          const tl = ts[i];
          if (tl.start < t0) active.push({ start: tl.start, end: tl.t });
        }
        let area = 0;
        for (const ln of active) {
          const s = Math.max(ln.start, t0);
          const e = Math.min(ln.end, t1);
          if (e > s) area += e - s;
        }
        f.lnAreaRatio = area / ((t1 - t0) * K);
      }
      const tails = ctx.lnTails;
      const ti = lowerBoundObj(tails, t0, (x) => x.t);
      const tj = lowerBoundObj(tails, t1, (x) => x.t);
      const nTails = tj - ti;
      f.tailRate = nTails / durS;
      if (nTails > 0) {
        let indep = 0;
        const durs = [];
        const gaps = [];
        for (let i = ti; i < tj; i++) {
          durs.push(tails[i].t - tails[i].start);
          const ev = ctx.allEvents;
          const ei = lowerBoundObj(ev, tails[i].t, (e) => e.t);
          if (ei < ev.length && ev[ei].t - tails[i].t < 3e3) {
            if (ev[ei].col !== tails[i].col) indep++;
          }
          const carr = ctx.cols.colNotes[tails[i].col];
          const ci = lowerBound(carr, tails[i].t);
          if (ci < carr.length) {
            const g = carr[ci] - tails[i].t;
            if (g < 1500) gaps.push(g);
          }
        }
        f.tailIndependence = indep / nTails;
        const meanDur = durs.reduce((a, b) => a + b, 0) / durs.length;
        const varDur = durs.reduce((a, b) => a + (b - meanDur) ** 2, 0) / durs.length;
        f.tailScatter = meanDur > 0 ? Math.sqrt(varDur) / meanDur : 0;
        let shortLn = 0;
        for (let i = hFrom; i < hTo; i++) if (heads[i].dur < 300) shortLn++;
        const nLnHeads = hTo - hFrom;
        f.shortLnRatio = nLnHeads ? shortLn / nLnHeads : 0;
        if (gaps.length >= 3) {
          const mg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const vg = gaps.reduce((a, b) => a + (b - mg) ** 2, 0) / gaps.length;
          const cv = mg > 0 ? Math.sqrt(vg) / mg : 1;
          const smallness = clamp01(1 - mg / 800);
          const uniformity = clamp01(1 - cv);
          f.invGapScore = (smallness * 0.5 + uniformity * 0.5) * Math.min(1, gaps.length / Math.max(3, nTails));
        }
      }
    }
    f.cutDemand = cutDemandInWindow(ctx, t0, t1);
    return f;
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function computeAllWindows(ctx) {
    const out = [];
    const { firstNote, lastNote } = ctx.map;
    const step = CONFIG.winStepMs;
    const win = CONFIG.winMs;
    for (let t = firstNote; t < lastNote; t += step) {
      out.push(computeWindowFeatures(ctx, t, Math.min(t + win, lastNote)));
    }
    return out;
  }

  // src/segment/segmenter.ts
  var SEG_FEATURES = [
    "nps",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "cutFreeRatio",
    "cutDemand",
    "rhythmSteady",
    "gridRatio",
    "anchorRate",
    "offBeatRatio",
    "techRate",
    "lnWeightRatio",
    "lockRatio",
    "heldCoverage",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore"
  ];
  function techRate(w) {
    return Math.max(w.trillRate, w.altHandRate, w.rollRate);
  }
  function segFeatValue(w, k) {
    switch (k) {
      case "techRate":
        return techRate(w);
      default:
        return w[k];
    }
  }
  function normalizeWindows(windows) {
    const names = [...SEG_FEATURES];
    const n = windows.length;
    const values = new Array(n);
    if (n === 0) return { values, featureNames: names };
    for (const key of names) {
      const raw = new Float64Array(n);
      for (let i = 0; i < n; i++) raw[i] = segFeatValue(windows[i], key);
      const sorted = Float64Array.from(raw).sort();
      const q = (p) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
      const med = q(0.5);
      let scale = q(0.9) - q(0.1);
      if (scale < 1e-6) scale = Math.max(Math.abs(med) * 0.5, 1e-6);
      const logTailed = key === "cutDemand" || key === "jackSpeedBpm" || key === "nps" || key === "tailRate";
      for (let i = 0; i < n; i++) {
        let x = raw[i];
        if (logTailed) x = Math.log1p(Math.max(0, x) / 5);
        const z = (x - (logTailed ? Math.log1p(Math.max(0, med) / 5) : med)) / scale;
        values[i] = values[i] ?? new Float64Array(names.length);
        values[i][names.indexOf(key)] = Math.max(-1, Math.min(2, z));
      }
    }
    return { values, featureNames: names };
  }
  function l1(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  }
  function meanVec(norm, from, to) {
    const out = new Float64Array(norm.featureNames.length);
    let cnt = 0;
    for (let i = from; i < to && i < norm.values.length; i++) {
      for (let j = 0; j < out.length; j++) out[j] += norm.values[i][j];
      cnt++;
    }
    if (cnt > 0) for (let j = 0; j < out.length; j++) out[j] /= cnt;
    return out;
  }
  function detectBoundaries(norm, minSegWindows) {
    const n = norm.values.length;
    if (n < minSegWindows * 2) return [];
    const half = Math.max(2, Math.round(minSegWindows / 2));
    const dist = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = meanVec(norm, Math.max(0, i - half), i);
      const b = meanVec(norm, i, Math.min(n, i + half));
      dist[i] = l1(a, b);
    }
    const sm = new Float64Array(n);
    const k = 1;
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) {
        s += dist[j];
        c++;
      }
      sm[i] = s / c;
    }
    const prom = new Float64Array(n);
    const baseR = minSegWindows;
    for (let i = 0; i < n; i++) {
      const vals = [];
      for (let j = Math.max(0, i - baseR); j <= Math.min(n - 1, i + baseR); j++) vals.push(sm[j]);
      vals.sort((a, b) => a - b);
      const med = vals[Math.floor(vals.length / 2)];
      let scale = vals[Math.floor(vals.length * 0.9)] - med;
      if (scale < 0.02) scale = 0.02;
      prom[i] = sm[i] - med;
      void scale;
    }
    const q = Math.max(1, Math.round(minSegWindows / 6));
    const cands = [];
    for (let i = 1; i < n - 1; i++) {
      let isMax = true;
      for (let j = Math.max(0, i - q); j <= Math.min(n - 1, i + q); j++) {
        if (sm[j] > sm[i]) {
          isMax = false;
          break;
        }
      }
      if (isMax && prom[i] > CONFIG.segProminenceAbs) cands.push({ i, v: prom[i] });
    }
    cands.sort((a, b) => b.v - a.v);
    const promSorted = Float64Array.from(prom).sort();
    const refProm = promSorted[Math.floor(promSorted.length * 0.95)] || CONFIG.segProminenceAbs;
    const relThr = Math.max(CONFIG.segProminenceAbs, refProm * CONFIG.segProminenceRel);
    const picked = [];
    for (const c of cands) {
      if (c.v < relThr) continue;
      if (picked.every((p) => Math.abs(p - c.i) >= minSegWindows)) picked.push(c.i);
    }
    return picked.sort((a, b) => a - b);
  }
  function snapBoundary(rows, t, snapWinMs = 600) {
    let lo = 0, hi = rows.length - 1, best = t, bestGap = 0;
    let i0 = 0;
    {
      let a = 0, b = rows.length;
      while (a < b) {
        const m = a + b >> 1;
        if (rows[m].t < t - snapWinMs) a = m + 1;
        else b = m;
      }
      i0 = a;
    }
    for (let i = Math.max(1, i0); i < rows.length && rows[i].t <= t + snapWinMs; i++) {
      const gap = rows[i].t - rows[i - 1].t;
      const mid = (rows[i].t + rows[i - 1].t) / 2;
      if (gap > bestGap) {
        bestGap = gap;
        best = Math.abs(mid - t) <= snapWinMs ? mid : t;
      }
    }
    return best;
  }
  function segmentMap(input) {
    const { map, rows, windows, norm } = input;
    const step = CONFIG.winStepMs;
    const minSegWindows = Math.max(2, Math.round(CONFIG.minSegLenMs / step));
    const bounds = detectBoundaries(norm, minSegWindows);
    const snapped = bounds.map((bi) => snapBoundary(rows, windows[Math.min(bi, windows.length - 1)].t + step / 2));
    const points = [map.firstNote, ...snapped, map.lastNote];
    const segs = [];
    let prevW = 0;
    for (let i = 0; i < points.length - 1; i++) {
      let s = points[i];
      let e = points[i + 1];
      if (e - s < 50) continue;
      const wEnd = Math.min(windows.length, Math.round((e - map.firstNote) / step));
      segs.push({ start: s, end: e, windowRange: [prevW, Math.max(prevW + 1, wEnd)] });
      prevW = Math.max(prevW + 1, wEnd);
    }
    const vecs = segs.map((s) => meanVec(norm, s.windowRange[0], s.windowRange[1]));
    const merged = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.end - seg.start >= CONFIG.minSegLenMs || merged.length === 0) {
        merged.push({ ...seg });
        continue;
      }
      const last = merged[merged.length - 1];
      const distPrev = l1(vecs[i], vecs[i - 1]);
      const distNext = i + 1 < segs.length ? l1(vecs[i], vecs[i + 1]) : Infinity;
      if (CONFIG.mergeBySimilarity && distNext < distPrev && i + 1 < segs.length) {
        segs[i + 1].start = seg.start;
        segs[i + 1].windowRange[0] = seg.windowRange[0];
      } else {
        last.end = seg.end;
        last.windowRange[1] = seg.windowRange[1];
      }
    }
    const out = merged.filter((s) => s.end - s.start >= 50);
    for (let i = 1; i < out.length; i++) out[i].start = Math.max(out[i].start, out[i - 1].end);
    return out;
  }
  function npsInRange(rows, start, end) {
    let a = 0, b = rows.length;
    while (a < b) {
      const m = a + b >> 1;
      if (rows[m].t < start) a = m + 1;
      else b = m;
    }
    let notes = 0;
    for (let i = a; i < rows.length && rows[i].t < end; i++) notes += rows[i].hits;
    const dur = Math.max(0.5, (end - start) / 1e3);
    return notes / dur;
  }
  function markBreaks(map, rows, segs) {
    const npss = segs.map((s) => npsInRange(rows, s.start, s.end));
    const sorted = [...npss].sort((a, b) => a - b);
    const q = sorted[Math.floor(CONFIG.breakNpsQuantile * (sorted.length - 1))] ?? 0;
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const nps = npss[i];
      let isBreak = nps < CONFIG.breakAbsNps;
      if (!isBreak && nps <= Math.max(q, 0) * 0.55 && nps < 3) isBreak = true;
      if (!isBreak) {
        let a = 0, b = rows.length;
        while (a < b) {
          const m = a + b >> 1;
          if (rows[m].t < s.start) a = m + 1;
          else b = m;
        }
        let prevT = s.start;
        for (let ri = a; ri < rows.length && rows[ri].t < s.end; ri++) {
          if (rows[ri].t - prevT >= CONFIG.restGapMs) {
            isBreak = true;
            break;
          }
          prevT = rows[ri].t;
        }
      }
      out.push({ start: s.start, end: s.end, family: isBreak ? "break" : "rc" });
    }
    void map;
    return out;
  }

  // src/classify/extras.ts
  function lowerBoundRow(rows, t) {
    let lo = 0, hi = rows.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (rows[m].t < t) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  function computeSegmentExtras(ctx, start, end) {
    const rows = ctx.rows;
    const K = ctx.map.keys;
    const lo = Math.max(0, lowerBoundRow(rows, start) - 1);
    const hi = lowerBoundRow(rows, end);
    let rowCount = 0, notes = 0;
    let lnHeadRowCount = 0, lnHeadSum = 0;
    let lnHeadPairs = 0, lnHeadOverlaps = 0;
    let prevHeadRowIdx = -1;
    let tailRows = 0, singleTailRows = 0;
    const colSeen = new Array(K).fill(0);
    const chordMasks = [];
    const chordHits = [];
    const chordTimes = [];
    let prevT = start;
    let maxGap = 0;
    for (let i = lo; i < hi; i++) {
      const r = rows[i];
      if (r.t < start || r.t >= end) continue;
      if (r.hits === 0 && !r.lnTailMask) continue;
      if (r.t - prevT > maxGap) maxGap = r.t - prevT;
      prevT = r.t;
      if (r.hits > 0) {
        rowCount++;
        notes += r.hits;
        chordMasks.push(r.mask);
        chordHits.push(r.hits);
        chordTimes.push(r.t);
        for (let c = 0; c < K; c++) if (r.mask & 1 << c) colSeen[c]++;
      }
      if (r.lnTailMask) {
        tailRows++;
        if (popcount(r.lnTailMask) === 1 && popcount(r.mask) === 0) singleTailRows++;
      }
      if (r.lnHeadMask) {
        lnHeadRowCount++;
        lnHeadSum += popcount(r.lnHeadMask);
        if (prevHeadRowIdx >= 0 && rows[prevHeadRowIdx].lnHeadMask) {
          lnHeadPairs++;
          if (rows[prevHeadRowIdx].lnHeadMask & r.lnHeadMask) lnHeadOverlaps++;
        }
        prevHeadRowIdx = i;
      } else {
        prevHeadRowIdx = -1;
      }
    }
    const runNoteCount = { n: 0 };
    const runCols = /* @__PURE__ */ new Set();
    for (let c = 0; c < K; c++) {
      const arr = ctx.cols.colNotes[c];
      let a = 0, b = arr.length;
      while (a < b) {
        const m = a + b >> 1;
        if (arr[m] < start) a = m + 1;
        else b = m;
      }
      let hiIdx = a;
      {
        let lo2 = a, hi2 = arr.length;
        while (lo2 < hi2) {
          const m = lo2 + hi2 >> 1;
          if (arr[m] < end) lo2 = m + 1;
          else hi2 = m;
        }
        hiIdx = lo2;
      }
      void b;
      let runLen2 = 1;
      let dts = [];
      const flush = (endIdx) => {
        if (runLen2 >= 4 && dts.length >= 3) {
          const med = median(dts);
          if (med > 30 && med <= 320 && stdevCv(dts) < 0.35) {
            runNoteCount.n += runLen2;
            runCols.add(c);
          }
        }
        void endIdx;
      };
      for (let i = a + 1; i < hiIdx; i++) {
        const dt = arr[i] - arr[i - 1];
        const refMed = dts.length ? median(dts) : dt;
        if (dt > refMed * 2.2 || dt < refMed * 0.45 || dt > 350) {
          flush(i);
          runLen2 = 1;
          dts = [];
        } else {
          runLen2++;
          dts.push(dt);
        }
      }
      flush(hiIdx);
    }
    const durS = Math.max(0.5, (end - start) / 1e3);
    let seenCols = 0;
    for (let c = 0; c < K; c++) if (colSeen[c] > 0) seenCols++;
    let chordOverlapRatio = 0, chordOverlapJaccard = 0, maxLockRun = 0, avgOverlapSize = 0;
    {
      let pairs = 0, inter = 0, jacSum = 0, interSum = 0, cur = 0;
      for (let i = 1; i < chordMasks.length; i++) {
        const a = chordMasks[i - 1], b = chordMasks[i];
        const ia = popcount(a & b);
        pairs++;
        if (ia > 0) {
          inter++;
          cur++;
          if (cur > maxLockRun) maxLockRun = cur;
          interSum += ia;
          jacSum += ia / popcount(a | b);
        } else {
          cur = 0;
        }
      }
      if (pairs > 0) {
        chordOverlapRatio = inter / pairs;
        chordOverlapJaccard = jacSum / pairs;
        avgOverlapSize = inter > 0 ? interSum / inter : 0;
      }
    }
    let chordGapMed = 0, chordGapCv = 1;
    {
      const gaps = [];
      for (let i = 1; i < chordTimes.length; i++) {
        const dt = chordTimes[i] - chordTimes[i - 1];
        if (dt >= 40 && dt <= 1e3) gaps.push(dt);
      }
      if (gaps.length >= 3) {
        gaps.sort((a, b) => a - b);
        chordGapMed = gaps[Math.floor(gaps.length / 2)];
        const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        chordGapCv = m > 0 ? Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length) / m : 1;
      }
    }
    let chord2Count = 0;
    for (const h of chordHits) if (h === 2) chord2Count++;
    const chord2Ratio = chordHits.length ? chord2Count / chordHits.length : 0;
    let wSum = 0;
    for (const h of chordHits) wSum += Math.pow(h, 1.4);
    const weightedNps = wSum / durS;
    let segIvLogStd = 0;
    let segRhythmChangeRate = 0;
    {
      const ivs = [];
      let prev = -1;
      for (let i = lo; i < hi; i++) {
        const r = rows[i];
        if (r.hits === 0 || r.t < start || r.t >= end) continue;
        if (prev >= 0) ivs.push(r.t - prev);
        prev = r.t;
      }
      if (ivs.length >= 4) {
        const logs = ivs.filter((v) => v >= 25).map((v) => Math.log(v));
        if (logs.length >= 3) {
          const m = logs.reduce((a, b) => a + b, 0) / logs.length;
          const sd = Math.sqrt(logs.reduce((a, b) => a + (b - m) ** 2, 0) / logs.length);
          segIvLogStd = sd;
        }
        let changes = 0, pairs = 0;
        for (let i = 1; i < ivs.length; i++) {
          const a = ivs[i - 1], b = ivs[i];
          if (a < 25 || b < 25) continue;
          pairs++;
          const ratio = Math.max(a, b) / Math.min(a, b);
          if (ratio > 1.35) changes++;
        }
        if (pairs >= 3) segRhythmChangeRate = changes / pairs;
      }
    }
    let jackHits = 0, jackMatch = 0;
    let heldRowHits = 0, heldRowJacks = 0;
    const jackDts = [];
    const tps = ctx.map.timingPoints;
    const anchorOf = (t) => {
      let lo2 = 0, hi2 = tps.length;
      while (lo2 < hi2) {
        const m = lo2 + hi2 >> 1;
        if (tps[m].t <= t) lo2 = m + 1;
        else hi2 = m;
      }
      return tps[Math.max(0, lo2 - 1)];
    };
    const offGrid = (t) => {
      const tp = anchorOf(t);
      const grid = tp.beatLength / 4;
      if (grid <= 0) return false;
      let ph = (t - tp.t) / grid % 1;
      if (ph < 0) ph += 1;
      return Math.min(ph, 1 - ph) > 0.15;
    };
    let riceN = 0, riceOff = 0, runN = 0, runOff = 0, runCount = 0;
    const runLen = new Array(K).fill(1);
    const strictEvents = [];
    for (const h of ctx.lnHeads) {
      if (h.t + h.dur <= start || h.t >= end) continue;
      strictEvents.push({ t: Math.max(h.t, start), col: h.col, up: true });
      strictEvents.push({ t: Math.min(h.t + h.dur, end), col: h.col, up: false });
    }
    strictEvents.sort((a, b) => a.t - b.t || (a.up ? 1 : 0) - (b.up ? 1 : 0));
    const strictHeld = new Int32Array(rows.length);
    {
      let msk = 0, ei2 = 0;
      for (let i = lo; i < hi; i++) {
        const t = rows[i].t;
        while (ei2 < strictEvents.length && strictEvents[ei2].t < t) {
          const e = strictEvents[ei2];
          if (e.up) msk |= 1 << e.col;
          else msk &= ~(1 << e.col);
          ei2++;
        }
        while (ei2 < strictEvents.length && strictEvents[ei2].t === t && !strictEvents[ei2].up) {
          msk &= ~(1 << strictEvents[ei2].col);
          ei2++;
        }
        strictHeld[i] = msk;
        while (ei2 < strictEvents.length && strictEvents[ei2].t === t) {
          msk |= 1 << strictEvents[ei2].col;
          ei2++;
        }
      }
    }
    const lastIvs = [];
    let prevPlayable = -1;
    for (let i = lo; i < hi; i++) {
      const r = rows[i];
      if (r.t < start || r.t >= end || r.hits === 0) continue;
      if (prevPlayable >= 0) {
        lastIvs.push(r.t - prevPlayable);
        if (lastIvs.length > 3) lastIvs.shift();
      }
      prevPlayable = r.t;
      const rowDt = lastIvs.length ? median(lastIvs) : 0;
      const jackLimit = rowDt >= 15 && rowDt <= 400 ? rowDt * 1.35 + 10 : 0;
      const hm = strictHeld[i];
      const lockedRow = hm !== 0;
      for (let c = 0; c < K; c++) {
        const bit = 1 << c;
        if (!(r.mask & bit)) continue;
        const onHeld = (hm & bit) !== 0;
        if ((r.lnHeadMask & bit) === 0) {
          riceN++;
          if (offGrid(r.t)) riceOff++;
        }
        const arr = ctx.cols.colNotes[c];
        const p = predIdx(arr, r.t);
        let isJack = false;
        if (p >= 0 && jackLimit > 0) {
          const dt = r.t - arr[p];
          if (dt >= 20 && dt <= jackLimit) {
            isJack = true;
            jackHits++;
            if (Math.abs(dt - rowDt) <= 0.3 * rowDt) jackMatch++;
            runLen[c]++;
            if (runLen[c] === 2) runCount++;
            if (runLen[c] >= 2) {
              runN++;
              if (offGrid(r.t)) runOff++;
            }
            if (runLen[c] >= 3) jackDts.push(dt);
          } else {
            runLen[c] = 1;
          }
        } else {
          runLen[c] = 1;
        }
        if (lockedRow && !onHeld) heldRowHits++;
        if (lockedRow && !onHeld && isJack) heldRowJacks++;
      }
    }
    const medJackDt = median(jackDts);
    const allOff = riceN ? riceOff / riceN : 0;
    const jackOff = runN ? runOff / runN : 0;
    const techJackScore = 0.5 * allOff + 0.5 * (runCount >= 3 ? jackOff : allOff);
    const colLns = [];
    for (let c = 0; c < K; c++) colLns.push([]);
    for (const h of ctx.lnHeads) colLns[h.col].push(h.t, h.t + h.dur);
    const tailTimes = [];
    for (const x of ctx.lnTails) tailTimes.push(x.t);
    tailTimes.sort((x, y) => x - y);
    let longLn = 0, tailSum = 0, freeLn = 0, holdAdjW = 0;
    const tailGaps = [];
    {
      const heads = ctx.lnHeads;
      let a = 0, b = heads.length;
      while (a < b) {
        const m = a + b >> 1;
        if (heads[m].t < start) a = m + 1;
        else b = m;
      }
      for (let i = a; i < heads.length && heads[i].t < end; i++) {
        const h = heads[i];
        if (h.dur <= 100) continue;
        longLn++;
        const tt = h.t + h.dur;
        tailSum += countNear(tailTimes, tt, 10);
        {
          const arr = ctx.cols.colNotes[h.col];
          let lo2 = 0, hi2 = arr.length;
          while (lo2 < hi2) {
            const m = lo2 + hi2 >> 1;
            if (arr[m] <= tt) lo2 = m + 1;
            else hi2 = m;
          }
          tailGaps.push(lo2 < arr.length ? Math.min(arr[lo2] - tt, 4e3) : 4e3);
        }
        let free = true;
        let holdW = 0;
        for (const adj of [h.col - 1, h.col + 1]) {
          if (adj < 0 || adj >= K) continue;
          if (hasHitNear(ctx.cols.colNotes[adj], tt, 10)) free = false;
          const ivs = colLns[adj];
          for (let j = 0; j + 1 < ivs.length; j += 2) {
            if (ivs[j] < tt - 10 && ivs[j + 1] > tt + 10) {
              holdW += 1;
              break;
            }
          }
        }
        if (free) freeLn++;
        holdAdjW += holdW;
      }
    }
    return {
      rowCount,
      notes,
      lnHeadRowCount,
      lnHeadChordMean: lnHeadRowCount ? lnHeadSum / lnHeadRowCount : 0,
      lnHeadOverlapRatio: lnHeadPairs ? lnHeadOverlaps / lnHeadPairs : 0,
      lnHeadRate: lnHeadRowCount / durS,
      tailSingleRatio: tailRows ? singleTailRows / tailRows : 0,
      vibroFraction: notes ? runNoteCount.n / notes : 0,
      vibroWidth: runCols.size,
      wideSpreadRatio: notes ? Math.min(1, seenCols / 5) : 0,
      maxGapMs: maxGap,
      segIvLogStd,
      segRhythmChangeRate,
      jackHitRatio: notes ? jackHits / notes : 0,
      shortLnBodyRatio: shortLnBodyRatio(ctx, start, end),
      jackChordPerRow: rowCount ? jackHits / rowCount : 0,
      jackRunBpm: medJackDt > 0 ? Math.min(15e3 / medJackDt, 500) : 0,
      jackRowMatchRatio: jackHits ? jackMatch / jackHits : 0,
      // lockJackRatio: presses that are row-rate same-column repeats while
      // another lane is held (denominator = all presses, per research definition)
      heldJackRatio: notes ? heldRowJacks / notes : 0,
      longLnRatio: notes ? longLn / notes : 0,
      tailChordMean: longLn ? tailSum / longLn : 0,
      tailFreeRatio: longLn ? freeLn / longLn : 0,
      tailHoldAdjWeight: longLn ? holdAdjW / longLn : 0,
      tailGapMed: median(tailGaps),
      tailGapCv: tailGapCv(tailGaps),
      invHoleFrac: computeInvHoleFrac(ctx, start, end),
      offGridRatio: allOff,
      techJackScore,
      chordOverlapRatio,
      chordOverlapJaccard,
      maxLockRun,
      avgOverlapSize,
      chord2Ratio,
      weightedNps,
      chordGapMed,
      chordGapCv
    };
  }
  function shortLnBodyRatio(ctx, start, end) {
    let n = 0, short = 0;
    for (const h of ctx.lnHeads) {
      if (h.t < start) continue;
      if (h.t >= end) break;
      n++;
      if (h.dur < 90) short++;
    }
    return n ? short / n : 0;
  }
  function computeInvHoleFrac(ctx, start, end) {
    const K = ctx.map.keys;
    const dur = end - start;
    if (dur <= 0) return 0;
    let worst = 0;
    for (let c = 0; c < K; c++) {
      const marks = [];
      for (const h of ctx.lnHeads) {
        if (h.col !== c) continue;
        if (h.t + h.dur <= start) continue;
        if (h.t >= end) break;
        marks.push([Math.max(h.t, start), Math.min(h.t + h.dur, end)]);
      }
      const notes = ctx.cols.colNotes[c];
      let lo = 0, hi = notes.length;
      while (lo < hi) {
        const m = lo + hi >> 1;
        if (notes[m] < start) lo = m + 1;
        else hi = m;
      }
      for (let i = lo; i < notes.length && notes[i] < end; i++) marks.push([notes[i], notes[i]]);
      if (!marks.length) {
        worst = Math.max(worst, 1);
        continue;
      }
      marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let holeMs = 0;
      let prevEnd = marks[0][1];
      if (marks[0][0] - start > 1e3) holeMs += marks[0][0] - start;
      for (let i = 1; i < marks.length; i++) {
        const gap = marks[i][0] - prevEnd;
        if (gap > 1e3) holeMs += gap;
        if (marks[i][1] > prevEnd) prevEnd = marks[i][1];
      }
      if (end - prevEnd > 1e3) holeMs += end - prevEnd;
      worst = Math.max(worst, Math.min(1, holeMs / dur));
    }
    return worst;
  }
  function median(a) {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  }
  function predIdx(arr, t) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (arr[m] < t) lo = m + 1;
      else hi = m;
    }
    return lo - 1;
  }
  function countNear(arr, t, tol) {
    let a = 0, b = arr.length;
    while (a < b) {
      const m = a + b >> 1;
      if (arr[m] < t - tol) a = m + 1;
      else b = m;
    }
    let c = 0;
    for (let i = a; i < arr.length && arr[i] <= t + tol; i++) c++;
    return c;
  }
  function hasHitNear(arr, t, tol) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (arr[m] < t - tol) lo = m + 1;
      else hi = m;
    }
    return lo < arr.length && arr[lo] <= t + tol;
  }
  function tailGapCv(gaps) {
    if (gaps.length < 2) return 0;
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (m <= 0) return 0;
    const v = gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length;
    return Math.min(2, Math.sqrt(v) / m);
  }
  function stdevCv(a) {
    if (a.length < 2) return 0;
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    const v = a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length;
    return m > 0 ? Math.sqrt(v) / m : 0;
  }
  var MEDIAN_KEYS = [
    "nps",
    "equivBpm",
    "gridRatio",
    "rhythmSteady",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "cutFreeRatio",
    "cutDemand",
    "anchorRate",
    "trillRate",
    "altHandRate",
    "rollRate",
    "graceRate",
    "offBeatRatio",
    "lnWeightRatio",
    "lockRatio",
    "lnAreaRatio",
    "heldCoverage",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore"
  ];
  function medianOf(windows, from, to, k) {
    const vals = [];
    for (let i = from; i < to && i < windows.length; i++) vals.push(windows[i][k]);
    if (!vals.length) return 0;
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  }
  function computeMapMedians(windows) {
    const n = Math.max(1, windows.length);
    return {
      mapChordMedian: medianOf(windows, 0, n, "chordMean"),
      mapLargeMedian: medianOf(windows, 0, n, "largeChordRatio"),
      mapNpsMedian: medianOf(windows, 0, n, "nps")
    };
  }
  function medianWindowFeatures(windows, from, to, mapMedians) {
    const out = {};
    for (const k of MEDIAN_KEYS) out[k] = 0;
    for (const k of MEDIAN_KEYS) {
      out[k] = medianOf(windows, from, to, k);
    }
    return {
      ...out,
      // humans judge cut size relative to the map's own baseline, not absolutely
      ...mapMedians ?? computeMapMedians(windows)
    };
  }

  // src/classify/params.ts
  var RC_DEFAULTS = {
    vibroFracLo: 0.28,
    vibroFracHi: 0.5,
    vibroBpmLo: 125,
    vibroBpmHi: 170,
    cjMultiLo: 0.62,
    cjMultiHi: 0.88,
    cjChLo: 2.3,
    cjChHi: 2.9,
    cjJackLo: 0.18,
    cjJackHi: 0.5,
    cjOvlLo: 0.35,
    cjOvlHi: 0.68,
    mjJackLo: 0.1,
    mjJackHi: 0.38,
    mjOvlLo: 0.15,
    mjOvlHi: 0.5,
    mjBpmLo: 125,
    mjBpmHi: 185,
    dcMultiLo: 0.76,
    dcMultiHi: 0.9,
    dcLargeLo: 0.42,
    dcLargeHi: 0.72,
    dcFreeLo: 0.72,
    dcFreeHi: 0.95,
    fcMultiLo: 0.42,
    fcMultiHi: 0.78,
    fcSingleLo: 0.15,
    fcSingleHi: 0.42,
    fcBpmLo: 180,
    fcBpmHi: 215,
    spSingleLo: 0.48,
    spSingleHi: 0.75,
    spBpmW: 0.4,
    techJackLo: 0.04,
    techJackHi: 0.18,
    techSpecLo: 0.06,
    techSpecHi: 0.25,
    wildcardBase: 0.3
  };
  var LN_DEFAULTS = {
    invCovLo: 0.45,
    invCovHi: 0.72,
    invGapLo: 0.6,
    invGapHi: 0.86,
    invAreaLo: 0.5,
    invAreaHi: 0.75,
    coLockLo: 0.38,
    coLockHi: 0.64,
    teShortLo: 0.55,
    teShortHi: 0.88,
    teTailLo: 9,
    teTailHi: 16,
    relBpmHi: 155,
    relNpsHi: 21,
    denShortLo: 0.6,
    denShortHi: 0.88,
    denTailLo: 8,
    denTailHi: 15,
    denHeadChLo: 1.35,
    denHeadChHi: 2.1,
    lnWildBase: 0.26
  };

  // src/classify/scoreRc.ts
  function ss(x, lo, hi) {
    if (hi <= lo) return x >= hi ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }
  function scoreRc(inp) {
    const p = { ...RC_DEFAULTS, ...inp.params };
    const { f, extras } = inp;
    const active = f.nps > 2.5 ? 1 : ss(f.nps, 1.2, 2.5);
    const cutDemNorm = inp.cutDemandRef > 0 ? f.cutDemand / inp.cutDemandRef : 0;
    const vibro = active * ss(extras.vibroFraction, p.vibroFracLo, p.vibroFracHi) * ss(f.jackSpeedBpm, p.vibroBpmLo, p.vibroBpmHi) * (extras.vibroWidth <= 4 ? 1 : ss(7 - extras.vibroWidth, 0, 3));
    const chordjack = active * ss(f.multiRatio, p.cjMultiLo, p.cjMultiHi) * ss(f.chordMean, p.cjChLo, p.cjChHi) * ss(f.jackRowRatio, p.cjJackLo, p.cjJackHi) * (0.35 + 0.65 * ss(f.overlapDegree, p.cjOvlLo, p.cjOvlHi));
    const minijack = active * ss(f.jackRowRatio, p.mjJackLo, p.mjJackHi) * ss(f.overlapDegree, p.mjOvlLo, p.mjOvlHi) * (1 - 0.7 * ss(f.chordMean, 3.2, 4.2)) * (0.35 + 0.65 * ss(f.equivBpm, p.mjBpmLo, p.mjBpmHi));
    const denseCs = active * ss(f.multiRatio, p.dcMultiLo, p.dcMultiHi) * ss(f.largeChordRatio, p.dcLargeLo, p.dcLargeHi) * ss(f.cutFreeRatio, p.dcFreeLo, p.dcFreeHi) * (0.5 + 0.5 * ss(cutDemNorm, 0.15, 0.7));
    const fastCs = active * ss(f.multiRatio, p.fcMultiLo, p.fcMultiHi) * ss(f.singleRatio, p.fcSingleLo, p.fcSingleHi) * ss(f.cutFreeRatio, 0.75, 0.97) * (0.35 + 0.65 * ss(f.equivBpm, p.fcBpmLo, p.fcBpmHi));
    const speed = active * ss(f.singleRatio, p.spSingleLo, p.spSingleHi) * (0.6 - p.spBpmW + ss(f.equivBpm, 190, 245) * p.spBpmW + ss(f.nps, 16, 26) * 0.3);
    const techSpec = Math.max(
      extras.segRhythmChangeRate,
      f.trillRate,
      f.rollRate,
      f.altHandRate * 1.5,
      f.offBeatRatio * 1.3
    );
    const tech = active * ss(extras.segIvLogStd, 0.25, 0.55) * (0.3 + 0.7 * ss(techSpec, p.techSpecLo, p.techSpecHi)) * (0.4 + 0.6 * ss(1 - f.rhythmSteady, 0.05, 0.3)) * ss(f.nps, 2.5, 6);
    const scores = {
      vibro,
      chordjack,
      minijack,
      "dense chordstream": denseCs,
      "fast chordstream": fastCs,
      speed,
      tech,
      wildcard: active * p.wildcardBase
    };
    for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(1, scores[k]));
    return scores;
  }

  // src/classify/scoreLn.ts
  function ss2(x, lo, hi) {
    if (hi <= lo) return x >= hi ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }
  function scoreLn(inp) {
    const p = { ...LN_DEFAULTS, ...inp.params };
    const { f, extras } = inp;
    const lnPresence = ss2(f.lnWeightRatio, 0.45, 0.7);
    const inverse = lnPresence * // inverse requires lanes essentially filled: hole-y LN sections are not
    // inverse no matter how the rest of the evidence looks
    (1 - Math.min(1, extras.invHoleFrac * 4)) * ss2(f.heldCoverage, p.invCovLo, p.invCovHi) * (0.15 + 0.85 * ss2(f.invGapScore, p.invGapLo, p.invGapHi)) * (0.4 + 0.6 * ss2(f.lnAreaRatio, p.invAreaLo, p.invAreaHi)) * (1 - 0.6 * ss2(f.lockRatio, 0.25, 0.55));
    const coordination = lnPresence * ss2(f.lockRatio, p.coLockLo, p.coLockHi) * (0.5 + 0.5 * ss2(f.heldCoverage, 0.18, 0.42)) * (1 - 0.3 * ss2(f.heldCoverage, 0.7, 0.95));
    const technical = lnPresence * ss2(f.shortLnRatio, p.teShortLo, p.teShortHi) * ss2(f.tailRate, p.teTailLo, p.teTailHi) * (0.35 + 0.65 * ss2(Math.max(extras.segIvLogStd * 2, extras.segRhythmChangeRate), 0.35, 0.75)) * (1 - 0.7 * ss2(f.lockRatio, 0.12, 0.42)) * (1 - 0.4 * ss2(f.heldCoverage, 0.62, 0.85));
    const release = lnPresence * (1 - ss2(f.equivBpm, 100, p.relBpmHi)) * (1 - ss2(f.nps, 13, p.relNpsHi)) * (0.35 + 0.65 * (1 - ss2(f.rhythmSteady, 0.55, 0.85))) * (0.5 + 0.5 * ss2(extras.tailSingleRatio, 0.25, 0.55));
    const density = lnPresence * (0.22 + 0.38 * ss2(f.shortLnRatio, p.denShortLo, p.denShortHi) * ss2(f.tailRate, p.denTailLo, p.denTailHi) + 0.4 * ss2(extras.lnHeadChordMean, p.denHeadChLo, p.denHeadChHi)) * (1 - 0.45 * ss2(extras.segRhythmChangeRate, 0.3, 0.6));
    const scores = {
      inverse,
      coordination,
      technical,
      release,
      density,
      "ln wildcard": lnPresence * p.lnWildBase
    };
    for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(1, scores[k]));
    return scores;
  }

  // src/classify/featuresVec.ts
  var VEC_KEYS = [
    "nps",
    "logEquivBpm",
    "cutSizeNorm",
    "gridRatio",
    "rhythmSteady",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "jackHitRatio",
    "heldJackRatio",
    "jackChordPerRow",
    "jackRunBpm",
    "jackRowMatchRatio",
    "longLnRatio",
    "tailChordMean",
    "tailFreeRatio",
    "tailHoldAdjWeight",
    "shortLnBodyRatio",
    "invHoleFrac",
    "offGridRatio",
    "techJackScore",
    "cutFreeRatio",
    "logCutDemand",
    "anchorRate",
    "trillRate",
    "altHandRate",
    "rollRate",
    "offBeatRatio",
    "graceRate",
    "lnWeightRatio",
    "lockRatio",
    "heldCoverage",
    "lnAreaRatio",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore",
    // extras
    "lnHeadChordMean",
    "lnHeadRate",
    "tailSingleRatio",
    "vibroFraction",
    "vibroWidth",
    "wideSpreadRatio",
    "segIvLogStd",
    "segRhythmChangeRate",
    "chordOverlapRatio",
    "chordOverlapJaccard",
    "maxLockRun",
    "avgOverlapSize",
    "chord2Ratio",
    "weightedNps"
  ];
  function buildVector(f, extras, cutDemandRef) {
    return {
      nps: f.nps,
      logEquivBpm: Math.log1p(Math.max(0, f.equivBpm) / 50),
      // chord size relative to tempo: annotator rule "at lower bpm a smaller cut
      // still counts as dense" — captures dCS/fCS boundary jointly.
      cutSizeNorm: f.chordMean * (160 / Math.min(260, Math.max(90, f.equivBpm || 160))),
      gridRatio: f.gridRatio,
      rhythmSteady: f.rhythmSteady,
      chordMean: f.chordMean,
      largeChordRatio: f.largeChordRatio,
      multiRatio: f.multiRatio,
      singleRatio: f.singleRatio,
      jackRowRatio: f.jackRowRatio,
      overlapDegree: f.overlapDegree,
      jackSpeedBpm: f.jackSpeedBpm / 100,
      jackHitRatio: extras.jackHitRatio,
      heldJackRatio: extras.heldJackRatio,
      jackChordPerRow: extras.jackChordPerRow / 3,
      jackRunBpm: extras.jackRunBpm / 100,
      jackRowMatchRatio: extras.jackRowMatchRatio,
      longLnRatio: extras.longLnRatio,
      tailChordMean: extras.tailChordMean / 3,
      tailFreeRatio: extras.tailFreeRatio,
      tailHoldAdjWeight: extras.tailHoldAdjWeight / 2,
      shortLnBodyRatio: extras.shortLnBodyRatio,
      invHoleFrac: extras.invHoleFrac,
      offGridRatio: extras.offGridRatio,
      techJackScore: extras.techJackScore,
      cutFreeRatio: f.cutFreeRatio,
      logCutDemand: Math.log1p(f.cutDemand / Math.max(1, cutDemandRef)),
      anchorRate: f.anchorRate,
      trillRate: f.trillRate,
      altHandRate: f.altHandRate,
      rollRate: f.rollRate,
      offBeatRatio: f.offBeatRatio,
      graceRate: f.graceRate,
      lnWeightRatio: f.lnWeightRatio,
      lockRatio: f.lockRatio,
      heldCoverage: f.heldCoverage,
      lnAreaRatio: f.lnAreaRatio,
      tailRate: f.tailRate / 20,
      tailIndependence: f.tailIndependence,
      tailScatter: Math.min(2, f.tailScatter),
      shortLnRatio: f.shortLnRatio,
      invGapScore: f.invGapScore,
      lnHeadChordMean: extras.lnHeadChordMean,
      lnHeadRate: extras.lnHeadRate / 10,
      tailSingleRatio: extras.tailSingleRatio,
      vibroFraction: extras.vibroFraction,
      vibroWidth: extras.vibroWidth / 7,
      wideSpreadRatio: extras.wideSpreadRatio,
      segIvLogStd: extras.segIvLogStd,
      segRhythmChangeRate: extras.segRhythmChangeRate,
      chordOverlapRatio: extras.chordOverlapRatio,
      chordOverlapJaccard: extras.chordOverlapJaccard,
      maxLockRun: extras.maxLockRun / 8,
      avgOverlapSize: extras.avgOverlapSize / 3,
      chord2Ratio: extras.chord2Ratio,
      weightedNps: extras.weightedNps / 25
    };
  }

  // src/classify/model.generated.json
  var model_generated_default = { rc: { classes: ["chordjack", "dense chordstream", "fast chordstream", "minijack", "speed", "tech", "wildcard"], mean: [20.93774838995434, 1.4080974987551738, 2.1914240366760316, 0.9428981373793501, 0.9047728505549114, 2.135125524957002, 0.4640193509852115, 0.7384616476328464, 0.3892548428295238, 0.1749313535443446, 0.3436237658643697, 0.5685865327287285, 0.09375885928972184, 0.00131894588553609, 0.08704903896278011, 0.38128399027490567, 0.6639062392530343, 0.01628625953791638, 0.0828330674170041, 0.08879070240106783, 0.0029161940451753075, 0.009124992427688508, 0.2447181762705806, 0.23322288545180636, 0.2336716483837912, 0.8201089820645772, 0.43007010016086944, 0.46037071170267907, 9239807033924681e-19, 0.11886746893020556, 0.05025347629376421, 0.03815928518425371, 0.006387494746760668, 0.02017262474484937, 0.034352040479491454, 0.012432056155795635, 0.010465802987861808, 0.008374183006535944, 0.00610639680708885, 0.005829082362775315, 0.022107485299526827, 0.011029528955607036, 0.21196370109876272, 0.016064058527189583, 0.04658207007707588, 0.4347897581044773, 0.6751867413632097, 0.9985294117647026, 0.3355506613281114, 0.22125833940306475, 0.18376148063492448, 0.08235852970854024, 0.4648692810457504, 0.44651437060431864, 0.2659941553302713, 1.2010059101611925], std: [9.181886191066749, 0.4202068551252959, 1.2934606024495643, 0.22482493974973877, 0.21566483288699292, 0.7790262997355679, 0.2966722209852889, 0.27703992425212104, 0.3052272695380964, 0.2563545624583077, 0.3684423947809091, 0.25120946851322623, 0.13541507427563376, 0.013070398959398552, 0.16074159436203317, 0.5362603558437544, 0.43651095557819475, 0.0764787430824936, 0.26521568389214484, 0.26192757580134235, 0.030560007380948353, 0.08032078635067129, 0.3130880970139673, 0.3452014041820118, 0.35102493271700824, 0.2655197184600404, 0.2428473213721715, 0.28251112317011096, 0.023618187965021388, 0.19303825208268258, 0.15249938204732497, 0.13557493015228117, 0.0371712088554391, 0.10280477789455703, 0.16557076315505753, 0.05782422417271025, 0.04748186083697971, 0.0491069313440768, 0.05791289350157722, 0.04124740260298424, 0.13946490453469046, 0.07353220315536717, 0.6644342245234114, 0.06981536470505975, 0.1916448780333269, 0.31905448147980114, 0.37533749226731916, 0.029668001473282305, 0.2186480723780999, 0.1977957881135459, 0.23621557542828178, 0.12149826275668694, 1.0153370963315904, 0.28630106829735574, 0.18587684793965256, 0.597515807979952], W: [-0.11281779061822943, -0.1392633451559788, 0.23541388960450754, 0.2973549693062095, 0.07725064495728294, -0.11591181820101619, -0.053459121901487244, -0.10752925172531122, -0.10649833691336684, 0.1845561648626616, 0.25695345704461603, -0.21015717589290123, 0.4112642302862858, -0.109120887067381, 0.22756313663341485, 0.20084862951287888, 0.302933726262374, 0.20087787054952516, 0.07912037800770207, 0.06996569769779942, 0.19096942596946517, -0.02092651613213297, 0.10238509104189875, 0.13142181998695768, 0.13334556807163167, -0.1976241892872756, 0.7285948122733158, -0.6451267869509192, 0.0013242352573720336, -0.08102031126022896, -0.1688425822974419, 0.5441337254156035, 0.02559328854199168, 0.004297322375617219, 0.012774106157057286, -0.1394397679378785, -0.19598492567675138, 0.06277637893189968, -0.05340905389615265, 0.06794453320508406, 0.23408387690711302, 0.17262129880698146, 0.061736333908749566, 0.057474758005859584, 0.14289634721599498, -0.09500654755474262, -0.030797622223572147, 0.08768285474678499, -0.4583827067060617, -0.38577440530877, 0.24405603995388134, 0.06917191739891904, -0.04227926733244097, 0.19321295451298182, 0.12503029156743264, 0.07876252639208031, 0.2978421081392673, -0.24839843909618362, 0.2811363673074207, -0.035124798624274214, -0.37069410233448513, 0.3971094223259367, 0.17799541499577298, -0.10100267151812879, -0.20029236937727313, -0.24588650987718505, -0.28832570840406274, 0.2996850915867223, -0.08800414225683471, 0.14280100415099853, 0.022497590286543655, 0.02994699254130813, -0.07324069710973151, -0.0652777509403595, -0.02565340573712316, -0.003909181845370043, -0.17301993626507767, 0.07901951517348317, 0.5969920864438635, 0.24482465027824868, 0.2624548827022429, 0.27183194758278967, -0.3672886578426847, 0.18550623263006746, -0.057589732151321335, 0.06506711219704807, -0.23091038398355984, -0.4783846211139561, -0.02861528677787629, 0.16058967810605362, 0.059610753531296204, -0.004381951686723081, -0.07036685518188207, 0.07382002352135333, -0.015953698318197245, 0.0344581675750286, 0.022354316084196003, -0.06029477482438648, 0.007681403449231488, 0.13935184522010519, -0.10978357011311386, 0.23217320922621326, -0.37763328294401227, -0.010514274127988738, -0.18911221483313828, 0.040440285329577184, -0.1991921527365222, 0.033271824468392525, 0.06795179836223177, 0.13496101620785994, -0.03439034318173883, 0.5280481989000204, -0.07740147702385074, -0.0021802974352554934, -0.23580956635534658, -0.236709064068437, 0.0019315049769862104, -0.06328576963389301, 0.24799790874516664, 0.2217647052936303, -0.1652413563780953, -0.02213065101391793, -0.420060284870252, -0.20781370717700484, -0.14665697251624651, -0.16610027769983796, -0.19816805794818665, -0.1333578408398787, -0.25274137878015734, 0.09055665669089116, 0.09655249495094886, 0.1239025358780989, 0.196831912923072, 0.1244186882113548, 0.03853670982563939, -0.5106159208638094, -0.48298196262524107, -0.0828224257912376, -0.16887482456768713, 0.05950622681271993, -0.011597718536621903, 0.21014246639099063, -0.3263400405709306, -0.2922667272453767, 0.09921830342791352, -0.20292455647886012, 0.2191292543331272, 0.1555830877197135, 0.26939841302447504, -0.12439021573627497, -0.055461141955499234, -0.06047683751090291, 0.10960179473098504, -0.01113912672160206, 0.026396687607151234, 0.1187729105316505, -0.09034387659138884, 0.5186249557684731, -0.10874688180415412, -0.12933160778264835, 0.17763503992837512, -0.1277485771876028, 0.024818686588251856, 0.027763106476622813, 0.07756996979596488, 0.09189541110155212, 0.023520154820347763, -0.11597477836429199, -0.17695932215603005, -0.1136090905481436, 0.10862118671668532, -0.23260457159255218, 0.24767881139644307, 0.3739372050246205, 0.021134194556443404, 0.033021298714894134, -0.2918883669529386, 0.15126004125365597, 0.08835687886367154, 0.5666786048469167, -0.11396704685431429, -0.2083145381505132, -0.08975133369190752, 0.44239193667852, 0.10753169885831809, -0.08963292355734644, 0.08463217009135818, 0.11199876148791958, -0.12812281089950683, -0.1345411855397059, -0.18245723910121991, -0.28193680671494015, -0.21571652131843794, -0.11462842153726807, 0.26353658073630676, 0.08223158227592149, 0.002871459375200859, 0.04494452526241003, -0.17951437146025534, -0.17350349381326186, -0.06877873822658553, 0.09783122635915047, -0.22859753368127958, 0.19444373434873916, 0.1872564619414392, 0.09157695670094124, 0.12954181487510052, -0.06814769541176492, -0.20436535520026983, -0.005763443852793948, 0.21746483444566, -0.093009701828685, 0.22476518562379355, -0.757192110172828, -0.09235862373539139, 0.08978465711081426, -0.31424412131586477, -0.009655921654276867, 0.1393110595772085, 0.07619071983604656, -0.18417910215181404, -0.5562961709547659, -0.0035936415025293145, -0.017931391257151617, 0.09652082639593475, 0.3649583822334789, -0.1469045427114981, 0.053366886284030586, 4827459133347083e-20, -0.18915166401274852, -0.4058503594715235, -0.006396972274225326, 0.17570401337517566, 0.16512953644368616, -0.03746866287450656, -0.14722073927115603, -0.17770903920967449, 0.22009123346697076, 0.036837255758299124, -0.2976488240261254, -0.2281961241806814, -0.06976785614173604, 0.003113079936800103, -0.18736092288737677, -0.05750839516646914, -0.06919764236837778, 0.13668008019312772, 0.36193651924200015, 0.36112895774831505, -0.14775088336873882, -0.6201355402408327, 0.40712325691732293, 0.03727131235953444, -0.08041495475472489, 0.22798992064965767, 0.4012750473538711, -0.027952176089621944, 0.008870288172278772, 0.12962320904612584, -0.028731849823358784, -0.0011436599555895795, -0.0602129435732264, -0.048451510462888904, 0.049707301182298484, -0.1411106097184829, -0.09043044694112623, -0.054968254812264125, -0.11981700154821551, -0.2506000315179192, 0.07620939713290777, -0.18679408038167586, -0.04451452099527746, 0.09115960596058269, -0.3671655756297953, 0.01174651620880332, -0.039838305220031296, -0.10692114052973498, 0.15314565625796928, 0.03818697830999922, -0.2516322076379783, 0.07628010686882401, 0.22593853823002666, -0.10789651476386082, 0.1702479566970622, -0.22350270927587831, -0.308877300647033, -0.33208651604069983, -0.150223227715324, 0.3311588403105332, -0.20025538525410663, 0.359012908773347, 0.09573574128427673, 0.07520020428684067, 0.1462124781748106, -0.012337939140700006, 0.27493194046900754, -0.07233094187184286, -0.09069598632389517, -0.08529287784181333, 0.04890320929270542, -0.05158594074062084, 0.04099391581093745, -0.3660914602678893, 0.15395699721574557, 0.053269682576109256, 0.24172001777008606, -0.10721949368901139, -0.17690357866259585, 0.008078268070255232, 0.4252623404838714, 0.1152448413373059, 0.28769000820628815, 0.1997658547657003, -0.1096373915788308, -0.1554713786880494, -0.1631933860064374, -0.16756839582412034, -0.07495652424082336, -0.020285952531865502, -0.045388548977797684, -0.051648328596470436, -0.032955493808473915, -0.11344004635929564, -0.05529445040116172, 0.0943018675138794, -0.26354858255153, 0.16469751219973533, 0.029324855370068865, 0.5130920717256064, 0.3096745135418567, -0.20890010542981652, -0.11150757958765305, 0.09088678522636108, 0.10183372048681946, 0.1800554913779259, -0.13993162319966682, -0.1034644516059156, -0.08744574822794379, -0.13456081979790804, -0.016531378002038598, 0.2672875756883169, -0.093820074855866, 0.3442684791163275, 0.11036611922446493, 0.2570575759359646, -0.032673196414794145, 0.0415314114671868, -0.39690781537685327, 0.03987276626394297, -0.025569012875047394, 0.013359348102536764, -0.5171128343357114, 0.21604371682172127, 0.023939989722920853, -0.15247183940787262, -0.1635000996237769, 0.022435744179137334, -0.019766775155558847, -0.32604526813542006, -0.09958725914420369, -0.11150060715461887, 0.029273954631644238, 0.2713871233305933, 0.0876630669774818, 0.01964217562558065, -0.5839811783193662, 0.5623726163252236, -0.2889439388031684, -0.19923124564152156, 0.040973433044590925, -0.0370684106982777, -0.014279866614055392, -0.02159103832757063, 0.03138632439613035, 0.06401954228950352, 0.021903079938054248, 0.03108430579292893, 0.027961987341401144, -0.1448709582392325, -0.04747835997955303, -0.011235922131245746, 0.28873967815150525, 0.6316329788890699, -0.022431964321753418, 0.1798523252404994, 0.5402296809090112, -0.011840044161806495, -0.055051683372296295, 0.0969709566294323, -0.11875258761241698, -0.3288089313914372, -0.08134072483301225], b: [-0.10887388993600251, 0.7669278338472332, 0.019152284989763346, -0.15373585138642026, 0.25434888460891064, 0.02402177012380764, -0.8018410322472921], keys: ["nps", "logEquivBpm", "cutSizeNorm", "gridRatio", "rhythmSteady", "chordMean", "largeChordRatio", "multiRatio", "singleRatio", "jackRowRatio", "overlapDegree", "jackSpeedBpm", "jackHitRatio", "heldJackRatio", "jackChordPerRow", "jackRunBpm", "jackRowMatchRatio", "longLnRatio", "tailChordMean", "tailFreeRatio", "tailHoldAdjWeight", "shortLnBodyRatio", "invHoleFrac", "offGridRatio", "techJackScore", "cutFreeRatio", "logCutDemand", "anchorRate", "trillRate", "altHandRate", "rollRate", "offBeatRatio", "graceRate", "lnWeightRatio", "lockRatio", "heldCoverage", "lnAreaRatio", "tailRate", "tailIndependence", "tailScatter", "shortLnRatio", "invGapScore", "lnHeadChordMean", "lnHeadRate", "tailSingleRatio", "vibroFraction", "vibroWidth", "wideSpreadRatio", "segIvLogStd", "segRhythmChangeRate", "chordOverlapRatio", "chordOverlapJaccard", "maxLockRun", "avgOverlapSize", "chord2Ratio", "weightedNps"] }, ln: { classes: ["coordination", "density", "inverse", "ln wildcard", "release", "technical"], mean: [15.972709210533452, 1.0923710703776033, 2.5498025283167047, 0.8159490285789012, 0.6517508204080409, 2.142748428885941, 0.46349554834915074, 0.7668524552330663, 0.3670087427509474, 0.08497744026273657, 0.16515687230756754, 0.36000521501957317, 0.0894029667379305, 0.05637386719172953, 0.07737407390095295, 0.32407891774181286, 0.7032609153996814, 0.56045445852904, 0.743785024089873, 0.6623329711645859, 0.202011608269886, 0.18794808566930513, 0.23031219161622682, 0.2287301690768112, 0.2504976976402478, 0.770247833229595, 0.40734296580687374, 0.28754268548061224, 0, 0.06801014763066617, 0.024414526716691174, 0.10929418135470344, 0.003339442805426711, 0.8187654853479378, 0.2947432663094991, 0.4867968410085562, 0.5003151570703518, 0.5933564799139865, 0.3597656081006826, 0.5019636893365831, 0.610804303844713, 0.5500215671958975, 1.8409430698848972, 0.6440958944730771, 0.4185918120352241, 0.28173054248125246, 0.4577280802591697, 0.9976591075347727, 0.3441398906317693, 0.24043486422603422, 0.20614721014366094, 0.07902949325192737, 0.429407461594736, 0.4310434274386964, 0.27982382098889513, 0.9236890246994582], std: [8.964356418729299, 0.5897303258238599, 1.3013697273224998, 0.3809410095679509, 0.44335756559607875, 0.6735276311559297, 0.2936637946231972, 0.25585433429091503, 0.28550505660552516, 0.18372871059365425, 0.307768096900298, 0.2994556840619319, 0.11030490829351562, 0.08768868829261041, 0.11899193717260889, 0.4813017699096504, 0.4266597958210613, 0.2665412569352661, 0.2639194987172153, 0.2422204923111378, 0.1770330353417038, 0.24849235502673822, 0.308628405540351, 0.37674209107225515, 0.37744117406927735, 0.3604613300334198, 0.2808505984344401, 0.2791535307764144, 1e-6, 0.16758497461665722, 0.11368237408558736, 0.28424388663716116, 0.029200926667748952, 0.21869468155646854, 0.3140935589145856, 0.20537041620838742, 0.24044043222302516, 0.4056577982823191, 0.20959509703065382, 0.257177614883311, 0.36530440498608024, 0.2608787412555152, 0.6137293206666724, 0.4456264497830043, 0.31561763047950386, 0.30749473674398625, 0.43281862911790925, 0.028527751143481727, 0.21180949001936877, 0.19034393430007804, 0.22180113461803805, 0.09449213050404882, 0.6330951650122412, 0.23122060874529352, 0.18194252177986717, 0.536298314587527], W: [0.05105452731083738, 0.13615445199589762, 0.009753207832122208, 0.1236094283620807, -0.14288207455387242, 0.0763955698397503, 0.1123490554280606, 0.05308476540148476, -0.2006332472929359, 0.1339493150899519, 0.35159002448941307, 0.012991586540062034, 0.16654209078816146, 0.20283727562941586, 0.09786942550248749, -0.062266067217413915, 0.08863541035871249, 0.1716746380532528, 0.2059847452603893, -0.3793858091401414, -0.40891052864863836, -0.08467197617452239, -0.2247183714853586, -0.2895216829444947, -0.41469076352991496, 0.2710819811222212, 0.03603056739463045, -0.3805931713844531, 0, -0.012502278261808473, -0.0021503455144078545, 0.3301176692700385, -0.30587196332699523, -0.2739519790681863, 0.13374661768325224, -0.2309759116617263, -0.0814605880957565, -0.2574487123175539, 0.38148663894937435, 0.1161705798042186, -0.12152799423775558, -0.1317173228328198, -0.04926154374111001, -0.26533822358446224, -0.12851777133591546, -0.10355371090499974, 0.09877513087347736, 0.13712170624690043, 0.05957645703954457, -0.11944032210417015, 0.1640162467646904, -0.16741299524305817, 0.08735225020673432, -0.2880028723980621, 0.08713250084149426, 0.02396476148112601, -0.0800007600219727, 0.06816254069599084, 0.16420865038423968, 0.13701041274663311, 0.11450989446216502, 0.33171784063015614, 0.2124312780814256, 0.17071080115404502, 0.0035315979046685745, 0.047165498191124665, -0.44980074033805956, 0.010395852144262446, -0.011445806855275934, 0.011633232122204159, 0.07981668210428752, 0.15469561216853514, 0.00751613462145558, -0.2130670739671315, 0.23728400409972553, -0.26882138605688055, -0.18971398847799273, -0.023956486921209393, 0.09376498408125498, 0.041851926608205366, -0.03737978094689256, 0.34929604734184166, -0.3289482602918475, 0.3692393778070024, 0, 0.027095054853906314, 0.011249281609127122, -0.5894779081883857, 0.29228629752697, -0.10828331163497258, 0.3294016526375409, -0.1633358131148588, -0.12016769477186542, -0.032018082613000654, 0.14799973857677406, 0.10527593315821476, 0.09528977120015802, -0.036558655216672196, -0.13338368392912897, -0.04737935567379809, -0.04614304686830644, -0.07005203096141244, -0.19701703635734183, -0.12476779749100758, 0.1262644526799178, -0.110518559163413, -0.14367601295156276, -0.2677928208287168, 0.08213799128375301, 0.3148759862484422, -0.05395016880210348, 0.0922656446623978, 0.03832497130188643, -0.1087386305373548, -0.08370985300645577, -0.11829713393537263, -0.07965859251331939, -0.025092673813921194, -0.2796631281789168, -0.24502901908790203, 0.06964064845341239, -0.057101170877972264, -0.03842044591221056, 0.07978126285271998, -0.15048072142392271, -0.03379391887762717, -0.12046350668252652, 0.15145145362809867, -0.07962544988445501, 0.12167447652270162, 0.6124009976136844, 0.16163682034590146, 0.6262324844562808, -0.18826335959309837, 0.4754121395068967, -0.14831526434109585, 0.19514939707863116, -0.16979586293000293, 0.120600975353191, -0.03142738612078493, 0, 0.25758406976950576, 0.1283324061059421, 0.37516946781592797, -0.0784887066887074, -0.023684485750657097, 0.08432899248872504, 0.5337276550652109, 0.6241267310278348, 0.25184850217361326, 0.11323697126211468, -0.26090991981999556, -0.354601060338413, 0.4727936072375938, 0.12207781998360671, 0.07534266446177552, 0.4609394841582948, 0.10708838233434605, -0.08743011139977386, -0.162189481348484, -0.2652873873207766, -0.03397093570750794, -0.18237709248725775, 0.0922587888633575, -0.0693625258827298, 0.23740123684931388, -0.03134746635924755, 0.045724802379521375, 0.287964570554874, 0.06517366391329295, -0.0716841524986478, -0.09632503874395497, -0.020250504414171762, -0.1449324012090893, -0.15791455272124583, -0.07606971509360941, 0.15511532418892027, 0.09958666298230294, -0.23161424949200451, 0.10643268335906336, -0.05412952159360003, -0.034387914571814955, 0.0441262250191749, -0.430231782488165, -0.05358151245786507, -0.060932600740772724, -0.26927637874715127, 0.5327292135326305, 0.2290008131178005, 0.17097880927090575, -0.19500523826105717, 0.06742560286410489, 0.014455229751874117, -0.18249952585746965, -0.19290223073739307, 0.1987738332336329, 0, -0.07724412113694262, 0.09180212725606404, -0.07492253135527466, 0.07642769084918762, -0.13378886221600345, 0.0732870947608196, 0.23481365483236336, 0.008649801735378894, -0.08571198186000953, -0.3098131517860218, -0.2559966899023739, 0.07347379884693506, 0.12736668146217348, -0.1353975425502181, 0.18857757934154196, -0.18750386848365416, 0.450995062241002, 0.11489887894839833, 0.023181717494873463, 0.11401749042325232, 0.23222004728663012, 0.06567098927782147, 0.04073554680845086, -0.03615335781166415, -0.2500993370626585, 0.01668334849045055, 0.05985020044772397, -0.3937912194289597, -0.3384469771821769, 0.13774922689113006, -0.17979179751636687, 0.017942847144341936, 0.00850397357340041, 0.11029698177025513, 0.0892273341612643, -0.06432701318440631, 0.01196138025170388, -0.13472487271673636, -0.324184527975751, -0.11818952096650853, -0.26948317325736987, -0.15323811561761855, 0.02572337275741769, -0.12106570766610761, 0.18275543887459725, -0.6799064058906248, -0.006507036077687273, 0.1642323865409963, 0.026712131322030506, -0.09929577851901188, -0.09790966311755538, -0.13791632722140335, 0.00560015762114517, 0.5319379019380989, -0.13179097878950477, 0, -0.16001678763096183, 0.07097149001169731, 0.006451273152772867, 0.049723944311750694, 0.4063451119034303, -0.2817434389639062, -0.005571997729548492, -0.022747533117600426, -0.036301482811088144, -0.11138575535061514, 0.1731413030460878, 0.0070902652976213235, -0.2391627735837154, 0.09070405092959395, -0.15228839398830865, 0.009440458227031247, -0.11759630160166647, -0.23388387488291854, 0.1886780289614109, -0.260688152413479, 0.05909115437956577, 0.033359007397682106, 0.2272185216401458, -0.10277277612339376, -0.06096997164455401, -0.03757460134886147, -0.4382209421595358, 0.0964479102833346, 0.17769495111435005, -0.15631707960238853, 0.13379412908698105, 0.1103384298748565, -0.24659230902029675, 0.002500365620421401, 0.00807583346471717, 0.0366726899303409, -0.23556168563711102, 0.5029702839695975, 0.11458314307964274, 0.16770348005114552, 0.12319449895519165, 0.051889289674195226, 0.16062741115152748, 0.15812112502825948, -0.20210487874264735, -0.10648696233602242, -0.03965180260382248, -0.42084116698844565, 0.09920088209589376, -0.05015773532272349, 0.4264690809308368, 0.3803822448677054, -0.27368279729773565, -0.16671895365667977, -0.024201674745892313, 0, -0.03491593759369932, -0.30020495946842307, -0.047337970695079994, -0.0340772626722056, 0.13336352676638902, -0.33902091860643185, -0.36865758739144094, -0.40840071677799167, 0.159631757428039, -0.2215244416516259, 0.12231879371384816, 0.3002752192314544, -0.19272153706655978, 0.10526089930725652, 0.20108572944325148, -0.10821525569745011, -0.2668814011072695, 0.30465701281815794, -0.06202417386369325, 0.22611713959154076, -0.02738138469110479, 0.06300686199862603, 0.07499295875982075, 0.038798418327300375, 0.04679495800751869, 0.019056387178267756, 0.21641553318876638], b: [0.2080768452866238, 0.5230130241461083, 0.09054630653356746, -0.9365705008910924, 0.3532087855775399, -0.23827446065274693], keys: ["nps", "logEquivBpm", "cutSizeNorm", "gridRatio", "rhythmSteady", "chordMean", "largeChordRatio", "multiRatio", "singleRatio", "jackRowRatio", "overlapDegree", "jackSpeedBpm", "jackHitRatio", "heldJackRatio", "jackChordPerRow", "jackRunBpm", "jackRowMatchRatio", "longLnRatio", "tailChordMean", "tailFreeRatio", "tailHoldAdjWeight", "shortLnBodyRatio", "invHoleFrac", "offGridRatio", "techJackScore", "cutFreeRatio", "logCutDemand", "anchorRate", "trillRate", "altHandRate", "rollRate", "offBeatRatio", "graceRate", "lnWeightRatio", "lockRatio", "heldCoverage", "lnAreaRatio", "tailRate", "tailIndependence", "tailScatter", "shortLnRatio", "invGapScore", "lnHeadChordMean", "lnHeadRate", "tailSingleRatio", "vibroFraction", "vibroWidth", "wideSpreadRatio", "segIvLogStd", "segRhythmChangeRate", "chordOverlapRatio", "chordOverlapJaccard", "maxLockRun", "avgOverlapSize", "chord2Ratio", "weightedNps"] }, version: 1 };

  // src/classify/pipeline.ts
  var MODEL = model_generated_default;
  function modelScores(fam, f, extras, cutDemandRef) {
    const m = MODEL[fam];
    const vec = buildVector(f, extras, cutDemandRef);
    const x = VEC_KEYS.map((k) => vec[k]);
    const D = m.mean.length;
    const K = m.classes.length;
    const out = {};
    let max = -Infinity;
    const z = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      let acc = m.b[k];
      for (let j = 0; j < D; j++) acc += m.W[k * D + j] * (x[j] - m.mean[j]) / m.std[j];
      z[k] = acc;
      if (acc > max) max = acc;
    }
    let sum = 0;
    for (let k = 0; k < K; k++) {
      z[k] = Math.exp(z[k] - max);
      sum += z[k];
    }
    for (let k = 0; k < K; k++) out[m.classes[k]] = z[k] / sum;
    return out;
  }
  function classifySegments(cm, opts = {}) {
    const out = [];
    const lnDom = opts.lnDominantRatio ?? CONFIG.lnDominantRatio;
    const mapMeds = computeMapMedians(cm.windows);
    const segF = cm.rawSegs.map((s, i) => cm.extras[i].rowCount ? medianWindowFeatures(cm.windows, s.windowRange[0], s.windowRange[1], mapMeds) : null);
    const npsAll = segF.filter((f) => f !== null).map((f) => f.nps).sort((a, b) => a - b);
    const mapNps = npsAll.length ? npsAll[Math.floor(npsAll.length / 2)] : 0;
    for (let i = 0; i < cm.rawSegs.length; i++) {
      const s = cm.rawSegs[i];
      if (s.family0 === "break" || cm.extras[i].rowCount === 0) {
        out.push({ start: s.start, end: s.end, tag: "break", confidence: 1, family: "break" });
        continue;
      }
      const f = segF[i];
      const ex = cm.extras[i];
      const lowStakes = s.end - s.start >= 2500 && f.nps < mapNps && (f.nps < 18.5 && ex.segIvLogStd > 0.41 || f.chordMean < 1.9 && ex.vibroFraction > 0.3 && ex.segRhythmChangeRate < 0.1 || f.nps < 22.5 && ex.segIvLogStd > 0.25 && ex.vibroFraction < 0.45 && f.lnWeightRatio < 0.5);
      if (lowStakes) {
        out.push({ start: s.start, end: s.end, tag: "break", confidence: 1, family: "break" });
        continue;
      }
      const extras = cm.extras[i];
      const lnDominant = f.lnWeightRatio >= lnDom || f.lockRatio >= 0.5 && f.heldCoverage >= 0.15 && f.lnWeightRatio >= 0.2;
      let tag;
      let secondary;
      let confidence;
      let scores;
      const scorer = opts.scorer ?? "model";
      void scorer;
      if (lnDominant) {
        const rule = scoreLn({ f, extras, params: opts.lnParams });
        if (scorer === "rules") scores = rule;
        else {
          const mdl = modelScores("ln", f, extras, cm.cutDemandRef);
          scores = blendScores(mdl, rule, scorer);
        }
      } else {
        const rule = scoreRc({ f, extras, cutDemandRef: cm.cutDemandRef, params: opts.rcParams });
        if (scorer === "rules") scores = rule;
        else {
          const mdl = modelScores("rc", f, extras, cm.cutDemandRef);
          scores = blendScores(mdl, rule, scorer);
        }
      }
      const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      tag = ranked[0][0];
      confidence = ranked[0][1];
      const demote = opts.wildcardDemote ?? 0.3;
      if ((tag === "wildcard" || tag === "ln wildcard") && ranked.length > 1) {
        for (const r of ranked.slice(1)) {
          if (r[0] !== "wildcard" && r[0] !== "ln wildcard" && r[1] > demote) {
            tag = r[0];
            confidence = r[1];
            break;
          }
        }
      }
      const margin = opts.secondaryMargin ?? CONFIG.secondaryMargin;
      if (ranked.length > 1 && ranked[1][1] >= ranked[0][1] * margin && ranked[1][1] > 0.3) {
        secondary = ranked[1][0];
      }
      out.push({
        start: s.start,
        end: s.end,
        tag,
        secondary,
        equivBpm: equivBpmFor(tag, f, extras),
        confidence: Math.min(1, confidence),
        family: lnDominant ? "ln" : "rc",
        scores
      });
    }
    const medians = out.map((_, i) => segF[i] ?? medianWindowFeatures(cm.windows, cm.rawSegs[i].windowRange[0], cm.rawSegs[i].windowRange[1], mapMeds));
    const diffs = out.map((seg, i) => {
      if (seg.family === "break") return Infinity;
      return medians[i].nps * (0.5 + medians[i].chordMean / 3) * (0.6 + medians[i].jackSpeedBpm / 150);
    });
    const finite = diffs.filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
    const p15 = finite.length ? finite[Math.floor(finite.length * 0.15)] : Infinity;
    const allNps = medians.map((m) => m.nps).sort((a, b) => a - b);
    const medNps = allNps[Math.floor(allNps.length / 2)] ?? 0;
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      if (seg.family === "break") continue;
      const dur = seg.end - seg.start;
      const easyAmbiguous = seg.confidence < 0.5 && diffs[i] <= Math.max(p15, 1) && (medians[i].nps ?? 0) < mapNps;
      const shortSparse = dur < 2e4 && medians[i].nps > 0 && medians[i].nps < medNps * 0.4 && medians[i].nps < 4;
      if (easyAmbiguous || shortSparse) {
        seg.tag = "break";
        seg.secondary = void 0;
        seg.family = "break";
        seg.equivBpm = void 0;
      }
    }
    return out;
  }
  function blendScores(mdl, rule, mode) {
    const out = {};
    const keys = /* @__PURE__ */ new Set([...Object.keys(mdl), ...Object.keys(rule)]);
    for (const k of keys) {
      if (k === "vibro") {
        out[k] = Math.min(1, (rule[k] ?? 0) * 2);
        continue;
      }
      if (k === "wildcard" || k === "ln wildcard") {
        out[k] = (rule[k] ?? 0) * 0.6;
        continue;
      }
      if (mode === "model") out[k] = (mdl[k] ?? 0) * 1.4;
      else out[k] = 0.5 * ((mdl[k] ?? 0) + (rule[k] ?? 0));
    }
    return out;
  }
  function equivBpmFor(tag, f, ex) {
    if (tag === "chordjack" || tag === "minijack") {
      if (ex && ex.chordGapMed > 0) {
        if (ex.chordGapCv <= 0.6) return Math.round(15e3 / ex.chordGapMed);
        return void 0;
      }
      return f.jackSpeedBpm > 0 ? Math.round(f.jackSpeedBpm) : void 0;
    }
    if (tag === "dense chordstream" || tag === "fast chordstream" || tag === "speed" || tag === "tech" || tag === "wildcard" || tag === "coordination" || tag === "density") {
      return f.equivBpm > 0 ? Math.round(f.equivBpm) : void 0;
    }
    return void 0;
  }

  // src/classify/smooth.ts
  function smoothSegments(segments) {
    const minDisplay = CONFIG.minSegLenMs * 0.6;
    const out = [];
    for (const seg of segments) {
      const last = out[out.length - 1];
      if (last && last.tag === seg.tag && last.secondary === seg.secondary && last.family === seg.family && seg.end - seg.start < minDisplay) {
        last.end = seg.end;
        continue;
      }
      out.push(seg);
    }
    const out2 = [];
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      const prev = out2[out2.length - 1];
      const next = out[i + 1];
      if (seg.family === "break" && seg.end - seg.start < minDisplay && prev && next && next.tag === prev.tag) {
        prev.end = seg.end;
        continue;
      }
      out2.push(seg);
    }
    return out2;
  }

  // src/aggregate/overall.ts
  var NON_AGGR = /* @__PURE__ */ new Set([
    "break",
    "rc mix",
    "ln mix",
    "hybrid",
    "wildcard",
    "ln wildcard"
  ]);
  function aggregateOverall(segments, params = {}) {
    const dominantShare = params.dominantShare ?? CONFIG.overallDominantShare;
    const mixShare = params.mixShare ?? CONFIG.overallMixShare;
    const secondRel = params.secondRel ?? 0.75;
    const weights = {};
    let lnW = 0;
    let rcW = 0;
    const famTags = { rc: /* @__PURE__ */ new Set(), ln: /* @__PURE__ */ new Set() };
    let total = 0;
    for (const seg of segments) {
      if (seg.family === "break") continue;
      const durS = Math.max(0.5, (seg.end - seg.start) / 1e3);
      if (seg.family === "rc") {
        rcW += durS;
        if (!NON_AGGR.has(seg.tag)) famTags.rc.add(seg.tag);
      } else if (seg.family === "ln") {
        lnW += durS;
        if (!NON_AGGR.has(seg.tag)) famTags.ln.add(seg.tag);
      }
      if (NON_AGGR.has(seg.tag)) continue;
      total += durS;
      const t = seg.tag;
      weights[t] = (weights[t] ?? 0) + durS * Math.max(0.4, seg.confidence);
    }
    if (total <= 0) return { tags: [], sort: "rc", weights };
    const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const topShare = entries.length ? entries[0][1] / total : 0;
    const shares = entries.map(([t, w]) => [t, w / total]);
    const significant = shares.filter(([, s]) => s >= mixShare);
    const lnRatioW = lnW / Math.max(1, lnW + rcW);
    const sort = lnRatioW < 0.18 ? "rc" : lnRatioW > 0.68 ? "ln" : "hb";
    let tags;
    const allFamCount = famTags.rc.size + famTags.ln.size;
    if (significant.length >= 3 && allFamCount >= 3 && topShare < dominantShare) {
      if (sort === "rc") tags = ["rc mix"];
      else if (sort === "ln") tags = ["ln mix"];
      else tags = ["hybrid"];
    } else if (entries.length >= 2 && shares[1][1] >= secondRel * topShare && topShare < 0.55) {
      tags = [entries[0][0], entries[1][0]];
    } else if (entries.length) {
      tags = [entries[0][0]];
    } else {
      tags = [];
    }
    return { tags, sort, weights };
  }

  // src/index.ts
  function rescale(map, rate) {
    return {
      ...map,
      notes: map.notes.map((n) => ({
        t: Math.round(n.t / rate),
        col: n.col,
        lnEnd: n.lnEnd != null ? Math.round(n.lnEnd / rate) : null
      })),
      timingPoints: map.timingPoints.map((tp) => ({ t: Math.round(tp.t / rate), beatLength: tp.beatLength / rate })),
      breaks: map.breaks.map(([a, b]) => [Math.round(a / rate), Math.round(b / rate)]),
      firstNote: Math.round(map.firstNote / rate),
      lastNote: Math.round(map.lastNote / rate)
    };
  }
  function buildCachedMap(osuText, opts = {}) {
    let map = parseOsu(osuText);
    const rate = opts.speedRate ?? 1;
    if (rate !== 1) map = rescale(map, rate);
    const rows = buildRows(map);
    attachTails(map, rows);
    const cols = buildColumnData(map);
    const held = computeHeld(map, rows);
    const ctx = buildFeatureContext(map, rows, held, cols);
    const windows = computeAllWindows(ctx);
    const norm = normalizeWindows(windows);
    const activeCut = windows.map((w) => w.cutDemand).filter((v) => v > 0).sort((a, b) => a - b);
    const cutDemandRef = activeCut.length ? activeCut[Math.floor(activeCut.length * 0.8)] : 1;
    const rawSegs0 = segmentMap({ map, rows, windows, norm });
    const marks = markBreaks(map, rows, rawSegs0);
    const rawSegs = rawSegs0.map((s, i) => ({
      start: s.start,
      end: s.end,
      windowRange: s.windowRange,
      family0: marks[i].family
    }));
    const extras = rawSegs.map((s) => computeSegmentExtras(ctx, s.start, s.end));
    return { cutDemandRef, rawSegs, extras, windows };
  }
  function analyzeMap(osuText, opts = {}) {
    let map = parseOsu(osuText);
    const rate = opts.speedRate ?? 1;
    if (rate !== 1) map = rescale(map, rate);
    const cm = buildCachedMap(osuText, opts);
    const segments = smoothSegments(classifySegments(cm, { scorer: "model" }));
    const overall = aggregateOverall(segments);
    return { map, segments, overall, debug: { windows: cm.windows, norm: void 0, ctx: void 0 } };
  }
  function extractIntermediate(osuText, opts = {}) {
    const res = analyzeMap(osuText, opts);
    const dbg = res.debug;
    return { map: res.map, windows: dbg.windows, segments: res.segments, overall: res.overall };
  }
  return __toCommonJS(index_exports);
})();

if (typeof module !== "undefined") module.exports = TagClassifier;

},
function(module,exports,load){
'use strict';

/** Milliseconds after rate conversion; tail intervals are half-open [head, tail). */
function parseOsu(text, { speedRate = 1 } = {}) {
  if (!Number.isFinite(speedRate) || speedRate <= 0) throw new RangeError('speedRate must be finite and positive');
  let section = '', mode = null, keys = null;
  const rawNotes = [], timingPoints = [], breaks = [], meta = {}, warnings=[];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('[')) { section = line.slice(1, -1).toLowerCase(); continue; }
    if (['general', 'difficulty', 'metadata'].includes(section)) {
      const at = line.indexOf(':'); if (at < 0) continue;
      const k = line.slice(0, at).trim(), v = line.slice(at + 1).trim();
      if (k === 'Mode') mode = Number(v);
      if (k === 'CircleSize') keys = Number(v);
      if (section === 'metadata') meta[k] = v;
      if (k === 'OverallDifficulty') meta.od = Number(v);
    } else if (section === 'timingpoints') {
      const p = line.split(','), t = Number(p[0]), beatLength = Number(p[1]);
      if(!Number.isFinite(t)||!Number.isFinite(beatLength)){warnings.push('IgnoredNonfiniteTimingPoint');continue;}
      if (beatLength > 0 && (p[6] === undefined || p[6].trim() !== '0'))
        timingPoints.push({ t: t / speedRate, beatLength: beatLength / speedRate });
    } else if (section === 'events') {
      const p = line.split(/\s*,\s*|\s+/);
      if (p[0] === '2' || p[0] === 'Break') {
        const a = Number(p[1]), b = Number(p[2]);
        if (Number.isFinite(a) && b > a) breaks.push([a / speedRate, b / speedRate]);
      }
    } else if (section === 'hitobjects') rawNotes.push(line.split(','));
  }
  if (mode !== 3) throw new Error('NotMania');
  if (![4, 6, 7].includes(keys)) throw new Error('UnsupportedKeys: expected 4, 6 or 7');
  const notes = [];
  for (const p of rawNotes) {
    const x = Number(p[0]), t = Number(p[2]), type = Number(p[3]);
    if (p.length < 5 || !Number.isFinite(x) || !Number.isFinite(t) || !Number.isInteger(type))
      throw new Error('InvalidHitObject');
    if (!(type & 129)) continue;
    const end = type & 128 ? Number((p[5] ?? '').split(':')[0]) : null;
    if (end !== null && (!Number.isFinite(end) || end < t)) throw new Error('InvalidHoldTail');
    notes.push({ t: t / speedRate, col: Math.min(keys - 1, Math.max(0, Math.floor(x * keys / 512))),
      lnEnd: end !== null && end > t ? end / speedRate : null });
  }
  notes.sort((a, b) => a.t - b.t || a.col - b.col);
  if (!notes.length) throw new Error('EmptyBeatmap');
  Object.assign(meta,{title:meta.Title,artist:meta.Artist,version:meta.Version,creator:meta.Creator});
  timingPoints.sort((a, b) => a.t - b.t);
  // Duplicate objects on one key at the same time are one physical action.
  const unique = [];
  for (const n of notes) {
    const last = unique.at(-1);
    if (last && last.t === n.t && last.col === n.col) {
      const end = Math.max(last.lnEnd ?? n.t, n.lnEnd ?? n.t); last.lnEnd = end > n.t ? end : null;
    }
    else unique.push(n);
  }
  return { keys, notes: unique, timingPoints, breaks, meta, warnings,
    firstNote: unique[0].t, lastNote: unique.reduce((end,n)=>Math.max(end,n.lnEnd??n.t),unique[0].t) };
}

function popcount(mask) { let n = 0; while (mask) { mask &= mask - 1; n++; } return n; }
function lowerBound(a, t, key = x => x) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (key(a[mid]) < t) lo = mid + 1; else hi = mid; }
  return lo;
}
function prepare(map, rowMergeMs = 10) {
  const rows = [], cols = Array.from({ length: map.keys }, () => []), tails = [];
  for (const n of map.notes) {
    cols[n.col].push(n);
    let r = rows.at(-1);
    if (!r || n.t - r.t > rowMergeMs) rows.push(r = { t: n.t, mask: 0, lnMask: 0 });
    r.mask |= 1 << n.col; if (n.lnEnd !== null) { r.lnMask |= 1 << n.col; tails.push({ t: n.lnEnd, col: n.col, start: n.t }); }
  }
  // Union overlapping holds per column: occupancy never exceeds one finger per key.
  const holds = cols.map(notes => {
    const out = [];
    for (const n of notes) if (n.lnEnd !== null) {
      const last = out.at(-1);
      if (last && n.t < last[1]) last[1] = Math.max(last[1], n.lnEnd);
      else out.push([n.t, n.lnEnd]);
    }
    return out;
  });
  tails.sort((a, b) => a.t - b.t || a.col - b.col);
  return { map, rows, cols, tails, holds, rowMergeMs };
}
module.exports = { parseOsu, prepare, popcount, lowerBound };

},
function(module,exports,load){
'use strict';
const { popcount: pc, lowerBound: lb } = load(2);
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) * q)]; };
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const frac = (a, f) => a.length ? a.filter(f).length / a.length : 0;
const GROUPS = {
  base: ['npsPerKey','rowRate','chordFraction','multiFraction','singleFraction','lnHeadFraction'],
  geometry: ['overlap','repeatFraction','cutReturn','chordChange','columnEntropy','handImbalance','sameHand','crossCut'],
  rhythm: ['logIoiSd','ioiChange','graceFraction','gridResidual','rowBpm','ioiCv'],
  holds: ['occupancy','minOccupancy','occupancySd','heldAtHead','lockFraction','releaseIndependence','releaseScatter','tailRate','shortHoldFraction','inverseGap','lnHeadOverlap'],
  sequence: ['anchorShare','repeatRun','maskEntropy','trillFraction','rollFraction'],
  burden: ['effort','sustain','burstiness','activeFraction']
};
const FEATURE_KEYS = Object.values(GROUPS).flat();

/** All hold area uses interval unions; all RC adjacency uses heads, never tails. */
function features(ctx, start, end) {
  const { map, rows, cols, holds, tails } = ctx, K = map.keys;
  const dur = Math.max(end - start, 1), seconds = dur / 1000;
  const rs = rows.slice(lb(rows, start, x => x.t), lb(rows, end, x => x.t));
  const notes = map.notes.slice(lb(map.notes, start, x => x.t), lb(map.notes, end, x => x.t));
  const ts = tails.slice(lb(tails, start, x => x.t), lb(tails, end, x => x.t));
  const hits = rs.map(r => pc(r.mask)), iv = rs.slice(1).map((r, i) => r.t - rs[i].t).filter(x => x > 0);
  const med = quantile(iv, .5), overlaps = [], changes = [], returns = [], sameHands = [], crossCuts = [];
  const counts = Array(K).fill(0), maskCount = new Map();
  let currentRun = 0, maxRun = 0, trills = 0, rolls = 0, previousDir = 0;
  const hand = mask => {
    let l = 0, r = 0;
    for (let c = 0; c < K; c++) if (mask & (1 << c)) {
      if (K === 7 && c === 3) { l += .5; r += .5; } else if (c < K / 2) l++; else r++;
    }
    return [l, r];
  };
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]; maskCount.set(r.mask, (maskCount.get(r.mask) ?? 0) + 1);
    for (let c = 0; c < K; c++) if (r.mask & (1 << c)) counts[c]++;
    if (!i) continue;
    const p = rs[i - 1], inter = pc(r.mask & p.mask);
    overlaps.push(inter / Math.max(1, Math.min(hits[i], hits[i - 1])));
    changes.push(pc(r.mask ^ p.mask) / K);
    currentRun = inter ? currentRun + 1 : 0; maxRun = Math.max(maxRun, currentRun);
    const [l, rr] = hand(r.mask), [pl, pr] = hand(p.mask);
    sameHands.push((l * pl + rr * pr) / Math.max(1, (l + rr) * (pl + pr)));
    // Within-hand finger substitutions; ignore the flexible 7K center finger.
    let cut = 0, pairs = 0;
    for (const range of [Array.from({length: Math.floor(K/2)}, (_, c) => c),
      Array.from({length: Math.floor(K/2)}, (_, c) => K - 1 - c)]) {
      for (let a = 0; a < range.length; a++) for (let b = a + 1; b < range.length; b++) {
        const x = 1 << range[a], y = 1 << range[b]; pairs++;
        if (((p.mask & x) && !(p.mask & y) && !(r.mask & x) && (r.mask & y)) ||
          ((p.mask & y) && !(p.mask & x) && !(r.mask & y) && (r.mask & x))) cut++;
      }
    }
    crossCuts.push(cut / Math.max(1, pairs));
    if (i >= 2) {
      const a = rs[i - 2]; returns.push(pc(a.mask & r.mask & ~p.mask) / Math.max(1, pc(a.mask)));
      if (hits[i] === 1 && hits[i-1] === 1 && hits[i-2] === 1 && r.mask === a.mask && r.mask !== p.mask) trills++;
    }
    if (hits[i] === 1 && hits[i-1] === 1) {
      const d = Math.sign(Math.log2(r.mask) - Math.log2(p.mask));
      if (d && d === previousDir) rolls++; previousDir = d;
    } else previousDir = 0;
  }
  const area = holds.map(hs => {
    let a = 0; const hi = lb(hs, end, h => h[0]);
    for (let i = hi - 1; i >= 0 && hs[i][1] > start; i--) a += Math.max(0, Math.min(end, hs[i][1]) - Math.max(start, hs[i][0]));
    return a / dur;
  });
  let heldSum = 0, locks = 0;
  for (const r of rs) {
    let heldMask = 0;
    for (let c = 0; c < K; c++) {
      const hs = holds[c], i = lb(hs, r.t, h => h[0]) - 1;
      if (i >= 0 && hs[i][0] < r.t && hs[i][1] > r.t) heldMask |= 1 << c;
    }
    heldSum += pc(heldMask) / K;
    if (heldMask && (r.mask & ~heldMask)) locks++;
  }
  let independent = 0, inverse = 0; const gaps = [];
  for (const t of ts) {
    const i = lb(rows, t.t, x => x.t), candidates = [rows[i-1], rows[i]].filter(Boolean);
    const nearest = candidates.length ? Math.min(...candidates.map(r => Math.abs(r.t - t.t))) : Infinity;
    if (nearest > ctx.rowMergeMs) independent++;
    const a = cols[t.col], next = a[lb(a, t.t, x => x.t)];
    if (next) { const gap = Math.max(0, next.t - t.t); gaps.push(gap / Math.max(1, med)); inverse += Math.exp(-gap / Math.max(1, med)); }
  }
  const total = notes.length, ln = notes.filter(n => n.lnEnd !== null), leftRight = counts.reduce((a, n, c) => {
    const [l, r] = hand(1 << c); a[0] += n*l; a[1] += n*r; return a;
  }, [0,0]);
  const entropy = (counts, total, max) => total && max > 1 ? -counts.reduce((s,n) => n ? s + n/total * Math.log(n/total) : s,0) / Math.log(max) : 0;
  const residuals = [];
  for (const r of rs) {
    const i = Math.max(0, lb(map.timingPoints, r.t + 1e-8, p => p.t) - 1), tp = map.timingPoints[i];
    if (tp) { const unit = tp.beatLength / 4; const q = (r.t - tp.t) / unit; residuals.push(Math.abs(q - Math.round(q))); }
  }
  const bins = Array(Math.max(1, Math.ceil(seconds))).fill(0);
  for (const n of notes) bins[Math.min(bins.length - 1, Math.floor((n.t - start) / 1000))]++;
  const nps = total / seconds, cv = mean(iv) ? sd(iv)/mean(iv) : 0;
  const f = {
    npsPerKey: nps/K, rowRate: rs.length/seconds, chordFraction: mean(hits)/K,
    multiFraction: frac(hits,x=>x>=2), singleFraction: frac(hits,x=>x===1), lnHeadFraction: total ? ln.length/total : 0,
    overlap: mean(overlaps), repeatFraction: frac(overlaps,x=>x>0), cutReturn: mean(returns), chordChange: mean(changes),
    columnEntropy: entropy(counts,total,K), handImbalance: total ? Math.abs(leftRight[0]-leftRight[1])/total : 0,
    sameHand: mean(sameHands), crossCut: mean(crossCuts), logIoiSd: sd(iv.map(Math.log)),
    ioiChange: mean(iv.slice(1).map((v,i)=>Math.abs(Math.log(v/iv[i])))), graceFraction: med ? frac(iv,x=>x<med/2) : 0,
    gridResidual: mean(residuals), rowBpm: med ? 15000/med : 0, ioiCv: cv,
    occupancy: mean(area), minOccupancy: Math.min(...area), occupancySd: sd(area),
    heldAtHead: rs.length ? heldSum/rs.length : 0, lockFraction: rs.length ? locks/rs.length : 0,
    releaseIndependence: ts.length ? independent/ts.length : 0, releaseScatter: sd(gaps.map(x=>Math.log1p(x))),
    tailRate: ts.length/seconds/K, shortHoldFraction: ln.length ? frac(ln,n=>n.lnEnd-n.t<=2*Math.max(1,med)) : 0,
    inverseGap: ts.length ? inverse/ts.length : 0,
    lnHeadOverlap: mean(rs.slice(1).map((r,i)=>pc(r.lnMask&rs[i].lnMask)/Math.max(1,pc(r.lnMask)))),
    anchorShare: total ? Math.max(...counts)/total : 0, repeatRun: rs.length>1 ? maxRun/(rs.length-1) : 0,
    maskEntropy: entropy([...maskCount.values()],rs.length,Math.min(2**K-1,rs.length)),
    trillFraction: rs.length>2 ? trills/(rs.length-2) : 0, rollFraction: rs.length>2 ? rolls/(rs.length-2) : 0,
    effort: nps/K * (1+mean(overlaps)) * (1+mean(area)),
    sustain: frac(bins,x=>x>=mean(bins)), burstiness: mean(bins) ? sd(bins)/mean(bins) : 0,
    activeFraction: frac(bins,x=>x>0)
  };
  return {start,end,values: FEATURE_KEYS.map(k=>f[k]),metrics:f,notes:total,rows:rs.length,
    equivBpm: iv.length>=3 && cv<=.5 ? Math.round(15000/med) : undefined};
}
function windows(ctx, windowMs = 4000, stepMs = 2000) {
  const out = [], {firstNote, lastNote} = ctx.map;
  const end = Math.max(firstNote+1,lastNote+1);
  for (let t = firstNote; t < end; t += stepMs) {
    const center = Math.min(end,t+stepMs/2);
    const a = Math.max(firstNote,center-windowMs/2), b = Math.min(end,center+windowMs/2);
    out.push({...features(ctx,a,b),start:t,end:Math.min(t+stepMs,end)});
  }
  return out;
}
module.exports = { GROUPS, FEATURE_KEYS, features, windows, mean, quantile };

},
function(module,exports,load){
'use strict';
const {classifyCoarse}=load(5);
const {version}=load(6);
// Keep the established public source-bucket name. The internal morphology
// class is chordstream, not a claim about generic endurance or stamina.
const external=tag=>tag==='chordstream'?'stamina':tag;
const rename=object=>Object.fromEntries(Object.entries(object).map(([k,v])=>[external(k),v]));

function coarseResult(text,profile,options={}){
 const r=classifyCoarse(text,profile,options),dominant=r.coarse.dominant;
 if(![4,6].includes(r.map.keys))throw Error('Native coarse product path requires 4K or 6K');
 const composition=rename(r.coarse.composition);
 const segments=r.segments.map(s=>({...s,tag:external(s.tag),scores:rename(s.distribution),distribution:rename(s.distribution)}));
 const overall={tags:dominant?[external(dominant)]:[],sort:dominant===null?'unknown':dominant==='ln'?'ln':'rc',
  scores:composition,weights:composition,composition,familyMass:r.coarse.familyMass,
  scoreKind:r.coarse.scoreKind,compositionKind:'same local support weighted by duration × relative physical effort^a × concentration^b',
  taxonomy:'five morphology source classes; stamina is the compatibility name for chordstream',evidence:r.coarse.evidence};
 const descriptors=r.windows.map(w=>({start:w.start,end:w.end,anchor:w.metrics.regularAnchor,trill:w.metrics.trillFraction,
  roll:w.metrics.rollFraction,repetition:1-w.metrics.maskEntropy,occupancy:w.metrics.occupancy,
  releaseIndependence:w.metrics['release:headIsolation'],releaseHeldInteraction:w.metrics['release:independentHeldRelease']}));
 return {map:r.map,segments,overall,coarse:r.coarse,debug:{windows:r.windows,norm:undefined,ctx:undefined},descriptors,
  modelInfo:{...r.modelInfo,version,keyCount:r.map.keys,classes:[...profile.model.classes.map(external),'break'],featureKeys:profile.model.keys,variant:r.map.keys===4?'native-4k-coarse':'native-shared-coarse',
   segmentEvidence:r.map.keys===4?'weak 4K source buckets plus sufficient structural templates':'4K/7K shared coarse extrapolation; no human 6K pattern accuracy',
   temporalResolutionMs:2000,localScoreKind:'within-head softmax support or deterministic structural support, not calibrated correctness',
   overallDecision:'dominant weighted morphology; no independent whole-map head',sortMeaning:'family of dominant coarse class',
   supervision:r.map.keys===4?'4K-only weak supervision and selection':'4K/7K weak labels plus available 7K interval labels'}};
}
module.exports={coarseResult};

},
function(module,exports,load){
/* Generated by node scripts/build-coarse.cjs; MIT; do not edit. */
module.exports=(()=>{
const modules=[function(module,exports,load){
'use strict';
// Actual JavaScript consumer of the jointly trained native-key coarse model.
// It has no separate whole-map feature head and performs no 4K/7K output mix.
const {parseOsu,prepare}=load(1);
const physical=load(2),{composition}=load(6);
const {physicalSupport}=load(7);
const named=(classes,p)=>Object.fromEntries(classes.map((c,i)=>[c,p[i]]));
const entropy=p=>-p.reduce((sum,v)=>sum+(v>0?v*Math.log(v):0),0)/Math.log(5);

function localScores(metrics,model){
 const D=model.keys.length,K=model.classes.length,z=[],theta=model.theta;let clipped=0,maxMagnitude=0;
 const x=model.keys.map((key,j)=>{
  if(!Object.hasOwn(metrics,key))throw Error('Unsupported coarse feature: '+key);
  const value=(metrics[key]-model.mean[j])/model.scale[j];maxMagnitude=Math.max(maxMagnitude,Math.abs(value));
  if(Math.abs(value)>model.clip)clipped++;
  return Math.max(-model.clip,Math.min(model.clip,value));
 });
 for(let k=0;k<K;k++){
  let value=theta[K*D+k];for(let j=0;j<D;j++)value+=theta[k*D+j]*x[j];z.push(value);
 }
 const max=Math.max(...z),p=z.map(v=>Math.exp(v-max)),sum=p.reduce((a,b)=>a+b,0);
 return {p:p.map(v=>v/sum),clippedFeatureFraction:clipped/D,maxStandardizedMagnitude:maxMagnitude};
}

function relativeEffort(windows){
 const positive=windows.filter(w=>w.metrics.effort>0).map(w=>[w.metrics.effort,w.end-w.start]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const total=positive.reduce((s,[v,d])=>s+d,0);let cumulative=0,reference=1;
 for(const [value,duration]of positive){cumulative+=duration;reference=value;if(cumulative>=.75*total)break;}
 return reference;
}

function coalesce(windows,classes){
 const groups=[];
 for(const w of windows){
  let group=groups.at(-1);
  if(!group||group.tag!==w.tag||group.end!==w.start)groups.push(group={start:w.start,end:w.end,tag:w.tag,members:[]});
  group.end=w.end;group.members.push(w);
 }
 return groups.map(group=>{
  const {members}=group,total=members.reduce((s,w)=>s+w.aggregationWeight,0),duration=group.end-group.start;
  const p=Array(classes.length).fill(0);let entropyMass=0,effort=0,occupancy=0,notes=0,clipped=0,bpm=0,bpmDuration=0,structuralWindows=0;
  for(const w of members){
   const d=w.end-w.start,weight=total?w.aggregationWeight:d;
   w.probability.forEach((v,k)=>p[k]+=weight*v);entropyMass+=w.atomicEntropyMass;
   structuralWindows+=Number(!!w.structuralSupport);
   effort+=d*w.metrics.effort;occupancy+=d*w.metrics.occupancy;notes+=w.notes;clipped+=d*w.clippedFeatureFraction;
   if(w.equivBpm&&['jack','chordstream','speed'].includes(group.tag)){bpm+=d*w.equivBpm;bpmDuration+=d;}
  }
  for(let k=0;k<p.length;k++)p[k]/=total||duration;
  const order=p.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
  return {start:group.start,end:group.end,tag:group.tag,family:group.tag==='break'?'break':group.tag==='ln'?'ln':'rc',
   confidence:p[classes.indexOf(group.tag)],probability:p,distribution:named(classes,p),aggregationWeight:total,
   equivBpm:bpmDuration?Math.round(bpm/bpmDuration):undefined,
   evidence:{normalizedEntropy:entropy(p),margin:order[0][0]-order[1][0],atomicEntropyMass:entropyMass,
    meanLocalEntropy:total?entropyMass/total:0,effort:effort/duration,occupancy:occupancy/duration,
    featureWindows:members.length,contextNoteObservations:notes,clippedFeatureFraction:clipped/duration,structuralWindows}};
 });
}

function aggregateSegments(segments,classes){
 const result=composition(segments.map(s=>s.probability),segments.map(s=>s.aggregationWeight),{breakIndex:classes.length-1});
 // The merged support alone loses within-display-window uncertainty. Its
 // sufficient entropy statistic keeps between-window diversity unchanged.
 const mean=result.activeWeight?segments.reduce((s,r)=>s+r.evidence.atomicEntropyMass,0)/result.activeWeight:0;
 return {...result,meanLocalEntropy:mean,diversity:Math.max(0,result.entropy-mean)};
}

function analyzeWindows(windows,model,keyCount,options={}){
 const K=model.classes.length,D=model.keys.length;
 if(K!==5||model.theta.length!==K*(D+1)+2)throw Error('Invalid coarse5 model shape');
 if(!windows.length)throw Error('Empty coarse interval sequence');
 const classes=[...model.classes,'break'],reference=relativeEffort(windows),a=model.theta.at(-2),b=model.theta.at(-1);
 const annotated=windows.map(w=>{
  const score=localScores(w.metrics,model),effort=Math.max(1e-4,w.metrics.effort/reference),gate=model.config.burdenGate;
  const active=!w.structurallyEmpty&&(!gate||w.metrics.effort/reference>=gate||w.metrics.occupancy>0||w.metrics['release:tailRatePerKey']>0);
  const structuralSupport=active?physicalSupport(w,options.physicalSupport??'none'):null;
  const conditional=structuralSupport?model.classes.map(c=>Number(c===structuralSupport.tag)):score.p;
  const p=active?[...conditional,0]:classes.map(c=>Number(c==='break'));
  const weight=active?(w.end-w.start)/1000*effort**a*conditional.reduce((s,v)=>s+v*v,0)**b:0;
  const tag=classes[p.indexOf(Math.max(...p))];
  return {...w,probability:p,tag,aggregationWeight:weight,atomicEntropyMass:weight*entropy(p),structuralSupport,
   clippedFeatureFraction:score.clippedFeatureFraction,maxStandardizedMagnitude:score.maxStandardizedMagnitude};
 });
 const raw=composition(annotated.map(w=>w.probability),annotated.map(w=>w.aggregationWeight),{breakIndex:5});
 const segments=coalesce(annotated,classes),dominant=raw.activeWeight>0?model.classes[raw.distribution.indexOf(Math.max(...raw.distribution))]:null;
 return {windows:annotated,segments,coarse:{dominant,composition:named(model.classes,raw.distribution),
   familyMass:{ln:raw.distribution[model.classes.indexOf('ln')],rc:raw.distribution.reduce((s,p,i)=>s+(model.classes[i]==='ln'?0:p),0)},
   evidence:{activeWeight:raw.activeWeight,normalizedEntropy:raw.entropy,meanLocalEntropy:raw.meanLocalEntropy,diversity:raw.diversity},
   scoreKind:'weighted local morphology support; trained from weak whole-map labels and available interval labels; structural template support is not empirical correctness'},
  modelInfo:{taxonomy:'coarse5',nativeKeyCount:keyCount,featureCount:D,windowMs:model.config.windowMs,stepMs:2000,
   effortPower:a,concentrationPower:b,representation:model.spec.representation,weak4Only:!!model.spec.weak4Only,physicalSupport:options.physicalSupport??'none',
   clippedFeatureFraction:annotated.reduce((s,w)=>s+(w.end-w.start)*w.clippedFeatureFraction,0)/(annotated.at(-1).end-annotated[0].start)}};
}

function classifyCoarse(text,profile,options={}){
 const model=profile.model||profile,map=parseOsu(text,options),ctx=physical.prepare(prepare(map,10));
 const windows=physical.windows(ctx,model.config.windowMs,2000);
 return {map,...analyzeWindows(windows,model,map.keys,{physicalSupport:options.physicalSupport??profile.postprocess?.physicalSupport??'none'})};
}
module.exports={classifyCoarse,analyzeWindows,aggregateSegments,localScores};

},
function(module,exports,load){
'use strict';

/** Milliseconds after rate conversion; tail intervals are half-open [head, tail). */
function parseOsu(text, { speedRate = 1 } = {}) {
  if (!Number.isFinite(speedRate) || speedRate <= 0) throw new RangeError('speedRate must be finite and positive');
  let section = '', mode = null, keys = null;
  const rawNotes = [], timingPoints = [], breaks = [], meta = {}, warnings=[];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('[')) { section = line.slice(1, -1).toLowerCase(); continue; }
    if (['general', 'difficulty', 'metadata'].includes(section)) {
      const at = line.indexOf(':'); if (at < 0) continue;
      const k = line.slice(0, at).trim(), v = line.slice(at + 1).trim();
      if (k === 'Mode') mode = Number(v);
      if (k === 'CircleSize') keys = Number(v);
      if (section === 'metadata') meta[k] = v;
      if (k === 'OverallDifficulty') meta.od = Number(v);
    } else if (section === 'timingpoints') {
      const p = line.split(','), t = Number(p[0]), beatLength = Number(p[1]);
      if(!Number.isFinite(t)||!Number.isFinite(beatLength)){warnings.push('IgnoredNonfiniteTimingPoint');continue;}
      if (beatLength > 0 && (p[6] === undefined || p[6].trim() !== '0'))
        timingPoints.push({ t: t / speedRate, beatLength: beatLength / speedRate });
    } else if (section === 'events') {
      const p = line.split(/\s*,\s*|\s+/);
      if (p[0] === '2' || p[0] === 'Break') {
        const a = Number(p[1]), b = Number(p[2]);
        if (Number.isFinite(a) && b > a) breaks.push([a / speedRate, b / speedRate]);
      }
    } else if (section === 'hitobjects') rawNotes.push(line.split(','));
  }
  if (mode !== 3) throw new Error('NotMania');
  if (![4, 6, 7].includes(keys)) throw new Error('UnsupportedKeys: expected 4, 6 or 7');
  const notes = [];
  for (const p of rawNotes) {
    const x = Number(p[0]), t = Number(p[2]), type = Number(p[3]);
    if (p.length < 5 || !Number.isFinite(x) || !Number.isFinite(t) || !Number.isInteger(type))
      throw new Error('InvalidHitObject');
    if (!(type & 129)) continue;
    const end = type & 128 ? Number((p[5] ?? '').split(':')[0]) : null;
    if (end !== null && (!Number.isFinite(end) || end < t)) throw new Error('InvalidHoldTail');
    notes.push({ t: t / speedRate, col: Math.min(keys - 1, Math.max(0, Math.floor(x * keys / 512))),
      lnEnd: end !== null && end > t ? end / speedRate : null });
  }
  notes.sort((a, b) => a.t - b.t || a.col - b.col);
  if (!notes.length) throw new Error('EmptyBeatmap');
  Object.assign(meta,{title:meta.Title,artist:meta.Artist,version:meta.Version,creator:meta.Creator});
  timingPoints.sort((a, b) => a.t - b.t);
  // Duplicate objects on one key at the same time are one physical action.
  const unique = [];
  for (const n of notes) {
    const last = unique.at(-1);
    if (last && last.t === n.t && last.col === n.col) {
      const end = Math.max(last.lnEnd ?? n.t, n.lnEnd ?? n.t); last.lnEnd = end > n.t ? end : null;
    }
    else unique.push(n);
  }
  return { keys, notes: unique, timingPoints, breaks, meta, warnings,
    firstNote: unique[0].t, lastNote: unique.reduce((end,n)=>Math.max(end,n.lnEnd??n.t),unique[0].t) };
}

function popcount(mask) { let n = 0; while (mask) { mask &= mask - 1; n++; } return n; }
function lowerBound(a, t, key = x => x) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (key(a[mid]) < t) lo = mid + 1; else hi = mid; }
  return lo;
}
function prepare(map, rowMergeMs = 10) {
  const rows = [], cols = Array.from({ length: map.keys }, () => []), tails = [];
  for (const n of map.notes) {
    cols[n.col].push(n);
    let r = rows.at(-1);
    if (!r || n.t - r.t > rowMergeMs) rows.push(r = { t: n.t, mask: 0, lnMask: 0 });
    r.mask |= 1 << n.col; if (n.lnEnd !== null) { r.lnMask |= 1 << n.col; tails.push({ t: n.lnEnd, col: n.col, start: n.t }); }
  }
  // Union overlapping holds per column: occupancy never exceeds one finger per key.
  const holds = cols.map(notes => {
    const out = [];
    for (const n of notes) if (n.lnEnd !== null) {
      const last = out.at(-1);
      if (last && n.t < last[1]) last[1] = Math.max(last[1], n.lnEnd);
      else out.push([n.t, n.lnEnd]);
    }
    return out;
  });
  tails.sort((a, b) => a.t - b.t || a.col - b.col);
  return { map, rows, cols, tails, holds, rowMergeMs };
}
module.exports = { parseOsu, prepare, popcount, lowerBound };

},
function(module,exports,load){
'use strict';
// Native-key physical descriptors for the shared coarse model. This module
// does not select tags or treat an unobserved attribute as a negative label.
const base=load(3);
const {lowerBound:lb}=load(1);
const anchor=load(4);
const release=load(5);
const REPLACED=new Set(['anchorShare','repeatRun']);
const SEQUENCE=anchor.KEYS.filter(k=>k!=='peakShare');
const BASE_KEYS=base.FEATURE_KEYS.filter(k=>!REPLACED.has(k));
const KEYS=[...BASE_KEYS,...SEQUENCE,...release.KEYS.map(k=>'release:'+k)];
const GROUPS={...Object.fromEntries(Object.entries(base.GROUPS).map(([g,ks])=>[g,ks.filter(k=>!REPLACED.has(k))])),
 sequence:[...base.GROUPS.sequence.filter(k=>!REPLACED.has(k)),...SEQUENCE],release:release.KEYS.map(k=>'release:'+k)};

function features(ctx,start,end){
 const f=base.features(ctx,start,end);
 const rows=ctx.rows.slice(lb(ctx.rows,start,r=>r.t),lb(ctx.rows,end,r=>r.t));
 const a=anchor.describe(rows,ctx.map.keys),r=release.releaseGeometry(ctx,start,end);
 const sequence=Object.fromEntries(anchor.KEYS.map((k,i)=>[k,a[i]]));
 const metrics={...f.metrics,...sequence,...Object.fromEntries(release.KEYS.map((k,i)=>['release:'+k,r.values[i]]))};
 // An empty head bin is not sustained head activity. Long held notes still
 // have physical occupancy and are not erased by the head-only count.
 if(!f.notes)metrics.sustain=0;
 const values=KEYS.map(k=>metrics[k]);
 if(values.some(x=>!Number.isFinite(x)))throw Error('Nonfinite native-key descriptors');
 return {...f,values,metrics,baseValues:base.FEATURE_KEYS.map(k=>k==='sustain'&&!f.notes?0:f.metrics[k]),
   tails:r.tails,structurallyEmpty:f.notes===0&&metrics.occupancy===0&&r.tails===0};
}

function windows(ctx,windowMs=4000,stepMs=2000){
 const {firstNote}=ctx.map,end=Math.max(firstNote+1,ctx.map.lastNote+1),out=[];
 for(let t=firstNote;t<end;t+=stepMs){
  const center=Math.min(end,t+stepMs/2),a=Math.max(firstNote,center-windowMs/2),b=Math.min(end,center+windowMs/2);
  out.push({...features(ctx,a,b),start:t,end:Math.min(t+stepMs,end),contextStart:a,contextEnd:b});
 }
 return out;
}
module.exports={KEYS,GROUPS,BASE_KEYS,SEQUENCE,features,windows,prepare:release.releaseContext};

},
function(module,exports,load){
'use strict';
const { popcount: pc, lowerBound: lb } = load(1);
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) * q)]; };
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const frac = (a, f) => a.length ? a.filter(f).length / a.length : 0;
const GROUPS = {
  base: ['npsPerKey','rowRate','chordFraction','multiFraction','singleFraction','lnHeadFraction'],
  geometry: ['overlap','repeatFraction','cutReturn','chordChange','columnEntropy','handImbalance','sameHand','crossCut'],
  rhythm: ['logIoiSd','ioiChange','graceFraction','gridResidual','rowBpm','ioiCv'],
  holds: ['occupancy','minOccupancy','occupancySd','heldAtHead','lockFraction','releaseIndependence','releaseScatter','tailRate','shortHoldFraction','inverseGap','lnHeadOverlap'],
  sequence: ['anchorShare','repeatRun','maskEntropy','trillFraction','rollFraction'],
  burden: ['effort','sustain','burstiness','activeFraction']
};
const FEATURE_KEYS = Object.values(GROUPS).flat();

/** All hold area uses interval unions; all RC adjacency uses heads, never tails. */
function features(ctx, start, end) {
  const { map, rows, cols, holds, tails } = ctx, K = map.keys;
  const dur = Math.max(end - start, 1), seconds = dur / 1000;
  const rs = rows.slice(lb(rows, start, x => x.t), lb(rows, end, x => x.t));
  const notes = map.notes.slice(lb(map.notes, start, x => x.t), lb(map.notes, end, x => x.t));
  const ts = tails.slice(lb(tails, start, x => x.t), lb(tails, end, x => x.t));
  const hits = rs.map(r => pc(r.mask)), iv = rs.slice(1).map((r, i) => r.t - rs[i].t).filter(x => x > 0);
  const med = quantile(iv, .5), overlaps = [], changes = [], returns = [], sameHands = [], crossCuts = [];
  const counts = Array(K).fill(0), maskCount = new Map();
  let currentRun = 0, maxRun = 0, trills = 0, rolls = 0, previousDir = 0;
  const hand = mask => {
    let l = 0, r = 0;
    for (let c = 0; c < K; c++) if (mask & (1 << c)) {
      if (K === 7 && c === 3) { l += .5; r += .5; } else if (c < K / 2) l++; else r++;
    }
    return [l, r];
  };
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]; maskCount.set(r.mask, (maskCount.get(r.mask) ?? 0) + 1);
    for (let c = 0; c < K; c++) if (r.mask & (1 << c)) counts[c]++;
    if (!i) continue;
    const p = rs[i - 1], inter = pc(r.mask & p.mask);
    overlaps.push(inter / Math.max(1, Math.min(hits[i], hits[i - 1])));
    changes.push(pc(r.mask ^ p.mask) / K);
    currentRun = inter ? currentRun + 1 : 0; maxRun = Math.max(maxRun, currentRun);
    const [l, rr] = hand(r.mask), [pl, pr] = hand(p.mask);
    sameHands.push((l * pl + rr * pr) / Math.max(1, (l + rr) * (pl + pr)));
    // Within-hand finger substitutions; ignore the flexible 7K center finger.
    let cut = 0, pairs = 0;
    for (const range of [Array.from({length: Math.floor(K/2)}, (_, c) => c),
      Array.from({length: Math.floor(K/2)}, (_, c) => K - 1 - c)]) {
      for (let a = 0; a < range.length; a++) for (let b = a + 1; b < range.length; b++) {
        const x = 1 << range[a], y = 1 << range[b]; pairs++;
        if (((p.mask & x) && !(p.mask & y) && !(r.mask & x) && (r.mask & y)) ||
          ((p.mask & y) && !(p.mask & x) && !(r.mask & y) && (r.mask & x))) cut++;
      }
    }
    crossCuts.push(cut / Math.max(1, pairs));
    if (i >= 2) {
      const a = rs[i - 2]; returns.push(pc(a.mask & r.mask & ~p.mask) / Math.max(1, pc(a.mask)));
      if (hits[i] === 1 && hits[i-1] === 1 && hits[i-2] === 1 && r.mask === a.mask && r.mask !== p.mask) trills++;
    }
    if (hits[i] === 1 && hits[i-1] === 1) {
      const d = Math.sign(Math.log2(r.mask) - Math.log2(p.mask));
      if (d && d === previousDir) rolls++; previousDir = d;
    } else previousDir = 0;
  }
  const area = holds.map(hs => {
    let a = 0; const hi = lb(hs, end, h => h[0]);
    for (let i = hi - 1; i >= 0 && hs[i][1] > start; i--) a += Math.max(0, Math.min(end, hs[i][1]) - Math.max(start, hs[i][0]));
    return a / dur;
  });
  let heldSum = 0, locks = 0;
  for (const r of rs) {
    let heldMask = 0;
    for (let c = 0; c < K; c++) {
      const hs = holds[c], i = lb(hs, r.t, h => h[0]) - 1;
      if (i >= 0 && hs[i][0] < r.t && hs[i][1] > r.t) heldMask |= 1 << c;
    }
    heldSum += pc(heldMask) / K;
    if (heldMask && (r.mask & ~heldMask)) locks++;
  }
  let independent = 0, inverse = 0; const gaps = [];
  for (const t of ts) {
    const i = lb(rows, t.t, x => x.t), candidates = [rows[i-1], rows[i]].filter(Boolean);
    const nearest = candidates.length ? Math.min(...candidates.map(r => Math.abs(r.t - t.t))) : Infinity;
    if (nearest > ctx.rowMergeMs) independent++;
    const a = cols[t.col], next = a[lb(a, t.t, x => x.t)];
    if (next) { const gap = Math.max(0, next.t - t.t); gaps.push(gap / Math.max(1, med)); inverse += Math.exp(-gap / Math.max(1, med)); }
  }
  const total = notes.length, ln = notes.filter(n => n.lnEnd !== null), leftRight = counts.reduce((a, n, c) => {
    const [l, r] = hand(1 << c); a[0] += n*l; a[1] += n*r; return a;
  }, [0,0]);
  const entropy = (counts, total, max) => total && max > 1 ? -counts.reduce((s,n) => n ? s + n/total * Math.log(n/total) : s,0) / Math.log(max) : 0;
  const residuals = [];
  for (const r of rs) {
    const i = Math.max(0, lb(map.timingPoints, r.t + 1e-8, p => p.t) - 1), tp = map.timingPoints[i];
    if (tp) { const unit = tp.beatLength / 4; const q = (r.t - tp.t) / unit; residuals.push(Math.abs(q - Math.round(q))); }
  }
  const bins = Array(Math.max(1, Math.ceil(seconds))).fill(0);
  for (const n of notes) bins[Math.min(bins.length - 1, Math.floor((n.t - start) / 1000))]++;
  const nps = total / seconds, cv = mean(iv) ? sd(iv)/mean(iv) : 0;
  const f = {
    npsPerKey: nps/K, rowRate: rs.length/seconds, chordFraction: mean(hits)/K,
    multiFraction: frac(hits,x=>x>=2), singleFraction: frac(hits,x=>x===1), lnHeadFraction: total ? ln.length/total : 0,
    overlap: mean(overlaps), repeatFraction: frac(overlaps,x=>x>0), cutReturn: mean(returns), chordChange: mean(changes),
    columnEntropy: entropy(counts,total,K), handImbalance: total ? Math.abs(leftRight[0]-leftRight[1])/total : 0,
    sameHand: mean(sameHands), crossCut: mean(crossCuts), logIoiSd: sd(iv.map(Math.log)),
    ioiChange: mean(iv.slice(1).map((v,i)=>Math.abs(Math.log(v/iv[i])))), graceFraction: med ? frac(iv,x=>x<med/2) : 0,
    gridResidual: mean(residuals), rowBpm: med ? 15000/med : 0, ioiCv: cv,
    occupancy: mean(area), minOccupancy: Math.min(...area), occupancySd: sd(area),
    heldAtHead: rs.length ? heldSum/rs.length : 0, lockFraction: rs.length ? locks/rs.length : 0,
    releaseIndependence: ts.length ? independent/ts.length : 0, releaseScatter: sd(gaps.map(x=>Math.log1p(x))),
    tailRate: ts.length/seconds/K, shortHoldFraction: ln.length ? frac(ln,n=>n.lnEnd-n.t<=2*Math.max(1,med)) : 0,
    inverseGap: ts.length ? inverse/ts.length : 0,
    lnHeadOverlap: mean(rs.slice(1).map((r,i)=>pc(r.lnMask&rs[i].lnMask)/Math.max(1,pc(r.lnMask)))),
    anchorShare: total ? Math.max(...counts)/total : 0, repeatRun: rs.length>1 ? maxRun/(rs.length-1) : 0,
    maskEntropy: entropy([...maskCount.values()],rs.length,Math.min(2**K-1,rs.length)),
    trillFraction: rs.length>2 ? trills/(rs.length-2) : 0, rollFraction: rs.length>2 ? rolls/(rs.length-2) : 0,
    effort: nps/K * (1+mean(overlaps)) * (1+mean(area)),
    sustain: frac(bins,x=>x>=mean(bins)), burstiness: mean(bins) ? sd(bins)/mean(bins) : 0,
    activeFraction: frac(bins,x=>x>0)
  };
  return {start,end,values: FEATURE_KEYS.map(k=>f[k]),metrics:f,notes:total,rows:rs.length,
    equivBpm: iv.length>=3 && cv<=.5 ? Math.round(15000/med) : undefined};
}
function windows(ctx, windowMs = 4000, stepMs = 2000) {
  const out = [], {firstNote, lastNote} = ctx.map;
  const end = Math.max(firstNote+1,lastNote+1);
  for (let t = firstNote; t < end; t += stepMs) {
    const center = Math.min(end,t+stepMs/2);
    const a = Math.max(firstNote,center-windowMs/2), b = Math.min(end,center+windowMs/2);
    out.push({...features(ctx,a,b),start:t,end:Math.min(t+stepMs,end)});
  }
  return out;
}
module.exports = { GROUPS, FEATURE_KEYS, features, windows, mean, quantile };

},
function(module,exports,load){
'use strict';
// Key-count-aware morphology. These are descriptors, not local truth labels.
const {popcount,lowerBound}=load(1);
const KEYS=['peakShare','peakExcess','repeatConcentration','runAsymmetry','runCoverage','regularity','regularAnchor'];
function describe(rows,K){
 const N=rows.length,counts=Array(K).fill(0),pairs=Array(K).fill(0),longest=Array(K).fill(0),run=Array(K).fill(0);
 const times=Array.from({length:K},()=>[]);
 for(let i=0;i<N;i++)for(let c=0;c<K;c++){
  if(rows[i].mask&(1<<c)){
   counts[c]++;times[c].push(rows[i].t);run[c]++;longest[c]=Math.max(longest[c],run[c]);
   if(i&&(rows[i-1].mask&(1<<c)))pairs[c]++;
  }else run[c]=0;
 }
 const total=counts.reduce((a,b)=>a+b,0),repeat=pairs.reduce((a,b)=>a+b,0);
 const sorted=[...longest].sort((a,b)=>a-b),peakCount=Math.max(...counts);
 const steady=times.map(a=>{
  const iv=a.slice(1).map((t,i)=>t-a[i]),mean=iv.reduce((a,b)=>a+b,0)/Math.max(1,iv.length);
  const cv=mean>0?Math.sqrt(iv.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,iv.length))/mean:Infinity;
  return iv.length>=2?1/(1+cv):0;
 });
 const peak=total?Math.max(...counts)/total:0,excess=total?Math.max(0,(peak-1/K)/(1-1/K)):0;
 const concentration=repeat?Math.max(0,(Math.max(...pairs)/repeat-1/K)/(1-1/K)):0;
 const asymmetry=N?(sorted[K-1]-sorted[Math.floor((K-1)/2)])/N:0;
 const regularity=Math.max(...steady.filter((_,c)=>counts[c]===peakCount));
 return [peak,excess,concentration,asymmetry,N?sorted[K-1]/N:0,regularity,excess*regularity];
}
function windows(ctx,ms){
 const start=ctx.map.firstNote,end=ctx.map.lastNote+1,out=[];
 for(let t=start;t<end;t+=ms/2){
  const rows=ctx.rows.slice(lowerBound(ctx.rows,t,r=>r.t),lowerBound(ctx.rows,t+ms,r=>r.t));
  if(rows.length>=3)out.push(describe(rows,ctx.map.keys));
 }
 return out;
}
function pooled(ctx,ms){
 const ws=windows(ctx,ms),out=[];
 for(let j=0;j<KEYS.length;j++){
  const a=ws.map(w=>w[j]).sort((a,b)=>a-b),mean=a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
  out.push(mean,Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,a.length)),a[Math.floor(.9*(a.length-1))]||0);
 }
 return out;
}
module.exports={KEYS,describe,windows,pooled};

},
function(module,exports,load){
'use strict';
const {lowerBound:lb}=load(1);
const KEYS=['tailRatePerKey','headIsolation','sameFingerRecovery','tailAsynchrony','tailTimingVariability',
 'heldOtherAtTail','sameHandOrder','releaseChordFraction','independentHeldRelease'];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)));};
const ratio=(gap,scale)=>Number.isFinite(gap)?gap/(gap+scale):1;

function releaseContext(ctx){
 // Timing-normalized geometry uses the active quarter-beat. Without timing
 // points use a scale inferred from actual event gaps, not a new fixed-ms gate.
 const times=[...new Set([...ctx.map.notes.map(n=>n.t),...ctx.tails.map(n=>n.t)])].sort((a,b)=>a-b);
 const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
 return {...ctx,releaseFallbackScale:gaps[Math.floor((gaps.length-1)/2)]||1};
}
function scaleAt(ctx,t){
 const points=ctx.map.timingPoints;
 const index=Math.max(0,lb(points,t+1e-8,p=>p.t)-1);
 return points.length?points[index].beatLength/4:ctx.releaseFallbackScale;
}
function releaseGeometry(ctx,start,end){
 const K=ctx.map.keys,tails=ctx.tails,heads=ctx.map.notes;
 const lo=lb(tails,start,n=>n.t),hi=lb(tails,end,n=>n.t),n=hi-lo;
 if(!n)return {values:KEYS.map(()=>0),metrics:Object.fromEntries(KEYS.map(k=>[k,0])),tails:0};
 const isolation=[],recovery=[],asynchrony=[],held=[],interaction=[],rhythm=[],width=[];let order=0;
 const hand=c=>K===7&&c===3?-1:c<Math.floor(K/2)?0:1;
 for(let j=lo;j<hi;j++){
  const tail=tails[j],scale=scaleAt(ctx,tail.t),i=lb(heads,tail.t,n=>n.t);
  const before=i>0?tail.t-heads[i-1].t:Infinity,after=i<heads.length?heads[i].t-tail.t:Infinity;
  const independent=ratio(Math.min(before,after),scale);isolation.push(independent);
  const same=ctx.cols[tail.col],next=same[lb(same,tail.t,n=>n.t)];
  recovery.push(ratio(next?next.t-tail.t:Infinity,scale));
  const previous=j?tail.t-tails[j-1].t:Infinity,following=j+1<tails.length?tails[j+1].t-tail.t:Infinity;
  asynchrony.push(ratio(Math.min(previous,following),scale));
  let other=0;
  for(let col=0;col<K;col++){
   if(col===tail.col)continue;
   const holds=ctx.holds[col],last=lb(holds,tail.t,h=>h[0])-1;
   // Immediately BEFORE release: new simultaneous heads do not count, other
   // simultaneous tails are still held. No epsilon-time magic is needed.
   if(last>=0&&holds[last][1]>=tail.t)other++;
  }
  const load=other/Math.max(1,K-1);held.push(load);interaction.push(load*independent);
  const a=lb(tails,tail.t,n=>n.t),b=lb(tails,tail.t+1e-8,n=>n.t);width.push((b-a)/K);
  if(j>lo&&tail.t>tails[j-1].t)rhythm.push(Math.log1p((tail.t-tails[j-1].t)/scale));
  if(j>0&&j+1<tails.length){
   const a=tails[j-1],b=tail,c=tails[j+1],h=hand(b.col);
   // All three timestamp groups must be singletons. Strict a.t < b.t < c.t
   // alone is insufficient: a/c can be the last/first member of a chord,
   // whose arbitrary column ordering reverses under a physical mirror.
   const uniqueEndpoints=(j<2||tails[j-2].t<a.t)&&(j+2>=tails.length||c.t<tails[j+2].t);
   if(uniqueEndpoints&&a.t<b.t&&b.t<c.t&&h>=0&&hand(a.col)===h&&hand(c.col)===h&&new Set([a.col,b.col,c.col]).size===3){
    const distance=Math.abs(a.col-b.col)+Math.abs(b.col-c.col),span=Math.max(a.col,b.col,c.col)-Math.min(a.col,b.col,c.col);
    order+=(distance-span)/Math.max(1,Math.floor(K/2)-1)*Math.exp(-(c.t-a.t)/(3*scale));
   }
  }
 }
 const values=[n/((end-start)/1000)/K,mean(isolation),mean(recovery),mean(asynchrony),sd(rhythm),
  mean(held),order/n,mean(width),mean(interaction)];
 if(values.some(v=>!Number.isFinite(v)))throw Error('Nonfinite release geometry');
 return {values,metrics:Object.fromEntries(KEYS.map((k,i)=>[k,values[i]])),tails:n};
}
module.exports={KEYS,releaseContext,releaseGeometry};

},
function(module,exports,load){
'use strict';
/** Separate uncertain local labels from genuine between-segment diversity.
 * Inputs are probability vectors (not raw legacy scores), nonnegative evidence
 * weights and an optional Break index. Break mass reduces active evidence.
 * Entropies are divided by log(number of non-Break classes).
 */
function composition(probabilities,weights,{breakIndex=-1}={}){
 if(!probabilities.length||probabilities.length!==weights.length)throw Error('ShapeMismatch');
 const D=probabilities[0].length,indices=Array.from({length:D},(_,i)=>i).filter(i=>i!==breakIndex);
 if(indices.length<2)throw Error('NeedAtLeastTwoActiveClasses');
 const dist=Array(indices.length).fill(0),rows=[];let total=0;
 const H=p=>-p.reduce((s,x)=>s+(x>0?x*Math.log(x):0),0)/Math.log(indices.length);
 probabilities.forEach((p,i)=>{
  if(p.length!==D||p.some(x=>!Number.isFinite(x)||x<0)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>1e-9)throw Error('InvalidProbability');
  if(!Number.isFinite(weights[i])||weights[i]<0)throw Error('InvalidWeight');
  const active=indices.reduce((s,j)=>s+p[j],0),weight=weights[i]*active;
  if(!weight)return;
  const q=indices.map(j=>p[j]/active);total+=weight;
  for(let j=0;j<q.length;j++)dist[j]+=weight*q[j];rows.push({q,weight});
 });
 if(!total)return {indices,distribution:dist,activeWeight:0,entropy:0,meanLocalEntropy:0,diversity:0};
 for(let j=0;j<dist.length;j++)dist[j]/=total;
 const entropy=H(dist),local=rows.reduce((s,r)=>s+r.weight/total*H(r.q),0);
 return {indices,distribution:dist,activeWeight:total,entropy,meanLocalEntropy:local,
  diversity:Math.max(0,entropy-local)};
}
module.exports={composition};

},
function(module,exports,load){
'use strict';
// Sufficient structural templates, not learned probability calibration.
// Numeric tolerance only absorbs floating-point IOI arithmetic under rate
// conversion; it is not an empirical rhythm/skill threshold.
function physicalSupport(window,mode='none'){
 if(!['none','jack','ln','both'].includes(mode))throw Error('Unknown physical support mode');
 if(mode==='none')return null;
 const required=['rowRate','occupancy','release:tailRatePerKey','lnHeadFraction','chordChange','overlap','ioiCv','rowBpm'];
 if(!Number.isFinite(window.contextStart)||!Number.isFinite(window.contextEnd)||!Number.isFinite(window.notes)||
    required.some(k=>!Number.isFinite(window.metrics[k])))throw Error('Physical support requires full finite native-window facts');
 const m=window.metrics,seconds=Math.max(1,window.contextEnd-window.contextStart)/1000;
 const rows=Math.round(m.rowRate*seconds),held=m.occupancy>0,tails=m['release:tailRatePerKey']>0;
 if((mode==='ln'||mode==='both')&&((window.notes===0&&(held||tails))||
    (rows<=1&&window.notes>0&&m.lnHeadFraction===1&&held)))return {tag:'ln',rule:'only_ln_activity_without_a_head_sequence'};
 if((mode==='jack'||mode==='both')&&rows>=3&&m.lnHeadFraction===0&&!held&&!tails&&
    m.chordChange===0&&m.overlap===1&&m.ioiCv<=1e-9&&m.rowBpm>0)
  return {tag:'jack',rule:'periodic_identical_rc_chord'};
 return null;
}
module.exports={physicalSupport};

}],cache={};
function load(id){if(!cache[id]){const m=cache[id]={exports:{}};modules[id](m,m.exports,load);}return cache[id].exports;}
return load(0);})();

},
function(module,exports,load){
module.exports={
  "name": "spm-tag-classifier",
  "version": "1.2.4",
  "description": "Standalone osu!mania pattern classification extracted from SPM Map Analyser",
  "main": "src/index.cjs",
  "bin": {
    "spm-tag-classifier": "bin/classify.cjs",
    "spm-tag-update-overlay": "bin/update-overlay.cjs"
  },
  "scripts": {
    "test": "node --test test/*.test.cjs",
    "test:parity": "node scripts/parity.cjs",
    "test:types": "tsc --noEmit -p test/types/tsconfig.json",
    "build": "node scripts/build.cjs",
    "research": "pwsh -NoProfile -File scripts/reproduce.ps1",
    "research:legacy": "python -X utf8 research/train.py"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Ist1na07/SPMTagClassifier.git"
  },
  "engines": {
    "node": ">=20"
  },
  "files": [
    "src/",
    "dist/",
    "bin/",
    "integration/",
    "docs/perception.md",
    "docs/ITERATION_1_2.md",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "UPSTREAM.md"
  ],
  "types": "src/index.d.ts",
  "devDependencies": {
    "typescript": "5.9.3"
  }
}
;
},
function(module,exports,load){
'use strict';
const {analyzeLnAdapter,nativeEvidence,classes}=load(8);
const {features}=load(3),{version}=load(6);
const geometry=load(9);
const named=p=>Object.fromEntries(classes.map((c,i)=>[c,p[i]]));
const ignored=new Set(['break','wildcard','ln wildcard','rc mix','ln mix','hybrid']);
function lnResult(text,profile,options,e){
 const r=analyzeLnAdapter(text,profile,options),atoms=nativeEvidence(r.segments,profile.policy),ctx=geometry.prepare(e.ctx);
 const descriptors=[],segments=r.segments.map(s=>{
  const sourceStart=s.start,sourceEnd=s.end,measurement=features(e.ctx,s.start,Math.max(s.start+1,s.end));
  const members=atoms.filter(a=>a.start>=s.start&&a.end<=s.end);
  const aggregationWeight=members.reduce((sum,a)=>sum+((profile.policy.mode==='soft'||!ignored.has(a.tag))?a.evidenceWeight:0),0);
  const distribution=named(s.probability),metrics=s.metrics;
  const measuredGeometry=geometry.describeInterval(ctx,s.start,Math.max(s.start+1,s.end)),m=measurement.metrics;
  descriptors.push({start:s.start,end:s.end,anchor:m.anchorShare,trill:m.trillFraction,roll:m.rollFraction,
   repetition:1-m.maskEntropy,occupancy:m.occupancy,releaseIndependence:m.releaseIndependence,geometry:measuredGeometry});
  return {...s,confidence:distribution[s.tag],scores:distribution,distribution,aggregationWeight,
   evidence:{normalizedEntropy:metrics.entropy,margin:metrics.margin,concentration:metrics.concentration,
    effort:measurement.metrics.effort,occupancy:measurement.metrics.occupancy,geometry:measuredGeometry,
    featureWindows:members.length,contextNoteObservations:measurement.notes,sourceStart,sourceEnd,
    ...(s.confidence===undefined?{}:{legacyConfidence:s.confidence})}};
 });
 // Match the stable API's display-envelope repair without silently changing
 // the fitted aggregation. Original score intervals remain explicit evidence.
 if(segments.length){segments[0].start=e.map.firstNote;segments.at(-1).end=e.map.lastNote+1;}
 const overall={...r.overall,scores:r.overall.shares,composition:r.overall.shares,
  compositionKind:profile.policy.mode==='soft'?'same local normalized support, weighted by fitted evidence policy':'weighted primary-label composition, conditional on concrete non-Break labels',
  scoreKind:'retrospectively tuned decision support; not calibrated correctness; weights retain weighted seconds'};
 return {map:e.map,segments,overall,descriptors,debug:{windows:r.windows,norm:undefined,ctx:undefined},
  modelInfo:{version,keyCount:7,variant:'anchored-ln-release',segmentEvidence:'archived RC/LN prior plus conditional Release adaptation; historical prior exposure unknown',
   temporalResolutionMs:250,classes,defaultReplacementAccepted:false,extraGate:profile.extraGate,
   aggregationPolicy:profile.policy,coverage:'display envelope repaired; aggregation uses original source intervals',
   confidenceMeaning:'normalized within-family support of displayed class; legacy affinity retained in evidence',supervision:'weak LN impressions plus available manual LN intervals'}};
}
module.exports={lnResult};

},
function(module,exports,load){
/* Generated by node scripts/build-ln.cjs; MIT; do not edit. */
module.exports=(()=>{
const modules=[function(module,exports,load){
'use strict';
// Pure exports for the static product build; dynamic archive access is
// replaced by scripts/build-ln.cjs before this entry is shipped.
module.exports={...load(1),nativeEvidence:load(8).evidence,
 classes:load(5).CLASSES};

},
function(module,exports,load){
'use strict';
// Actual research caller for a selected small LN update. No archive edits.
const {loadLab,context,inspectPrepared}=load(2);
const parser=load(3),geometry=load(4);
const {decisionSupport}=load(5),{evaluateCachedNative}=load(7);
const injection={id:'ln_adapter_override',apply:(s,r)=>r(s,'  function modelScores(fam, f, extras, cutDemandRef) {',
 '  function modelScores(fam, f, extras, cutDemandRef) {\n    if(fam==="ln"&&extras.__spmLnAdapter)return extras.__spmLnAdapter;')};

function analyzeLnAdapter(text,profile,options={}){
 const model=profile.model,policy=profile.policy,rate=options.speedRate??1;
 if(!Number.isFinite(rate)||rate<=0)throw Error('speedRate must be finite and positive');
 const api=loadLab({patches:[injection]}),prepared=context(api.lab,text,rate);
 if(prepared.map.keys!==7)throw Error('LN expert adapter requires7K');
 const view=inspectPrepared(api,prepared),expert=api.lab.MODEL.ln,D=expert.mean.length;
 if(model.delta.length!==model.keys.length+1)throw Error('LN adapter shape differs');
 if(model.delta.some(v=>v!==0)){
  const modern=geometry.releaseContext(parser.prepare(parser.parseOsu(text,{speedRate:rate}),10));
  for(let i=0;i<view.segments.length;i++){
   const s=view.segments[i],g=geometry.releaseGeometry(modern,s.start,s.end).metrics;
   const fields={a:g.headIsolation,b:g.heldOtherAtTail,ab:g.headIsolation*g.heldOtherAtTail,
    ...Object.fromEntries(geometry.KEYS.map(k=>['geometry:'+k,g[k]])),
    ...Object.fromEntries(['tailIndependence','lnAreaRatio','lnWeightRatio'].map(k=>['old:'+k,s.vector[view.featureKeys.indexOf(k)]]))};
   let delta=model.delta.at(-1);
   model.keys.forEach((key,j)=>{if(!Object.hasOwn(fields,key))throw Error('Unsupported LN adapter feature '+key);
    delta+=model.delta[j]*Math.max(-model.clip,Math.min(model.clip,(fields[key]-model.mean[j])/model.scale[j]));});
   const z=expert.classes.map((tag,k)=>{
    let value=expert.b[k];for(let j=0;j<D;j++)value+=expert.W[k*D+j]*(s.vector[j]-expert.mean[j])/expert.std[j];
    return value+(tag==='release'?delta:0);
   });
   const peak=Math.max(...z),p=z.map(v=>Math.exp(v-peak)),sum=p.reduce((a,b)=>a+b,0);
   view.cache.extras[i].__spmLnAdapter=Object.fromEntries(expert.classes.map((tag,k)=>[tag,p[k]/sum]));
  }
 }
 const classified=api.lab.classifySegments(view.cache,{lnDominantRatio:policy.lnRatio,scorer:policy.scorer});
 const raw=classified.map((s,i)=>({start:s.start,end:s.end,tag:s.tag,family:s.family,secondary:s.secondary,equivBpm:s.equivBpm,confidence:s.confidence,probability:decisionSupport(s),
  burden:view.segments[i].f.nps*(.5+view.segments[i].f.chordMean/3)*(.6+view.segments[i].f.jackSpeedBpm/150)}));
 const result=evaluateCachedNative({partitions:[{cases:[{raw}]}]},{...policy,extraGate:profile.extraGate??'all',partition:0,head:0,smoothing:'coherent'});
 return {map:prepared.map,windows:prepared.windows,...result,modelInfo:{researchOnly:true,variant:model.variant,
  coefficientPrior:'archived experts, exact historical exposure unknown',updatedClass:'conditional LN Release only',boundaries:'original raw automatic'}};
}
module.exports={analyzeLnAdapter};

},
function(module,exports,load){
function loadLab({patches=[],config={}}={}){
 if(patches.some(p=>p.id!=='ln_adapter_override'))throw Error('Static LN core only supports its compiled adapter patch');
 const module={exports:{}};(function(module,exports){
"use strict";
var TagClassifier = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    analyzeMap: () => analyzeMap,
    buildCachedMap: () => buildCachedMap,
    extractIntermediate: () => extractIntermediate
  });

  // src/parser/osu.ts
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function parseOsu(text) {
    const lines = text.split(/\r?\n/);
    let section = "";
    const notes = [];
    const timingPoints = [];
    const breaks = [];
    let keys = 0;
    let od = 6;
    let hp;
    let title;
    let artist;
    let version;
    let creator;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("[")) {
        section = line.slice(1, line.indexOf("]")).toLowerCase();
        continue;
      }
      switch (section) {
        case "general":
          if (line.startsWith("Mode:")) {
            if (parseInt(line.slice(5).trim(), 10) !== 3) {
              throw new Error("NotMania");
            }
          }
          break;
        case "metadata": {
          const ci = line.indexOf(":");
          if (ci < 0) break;
          const k = line.slice(0, ci).trim();
          const v = line.slice(ci + 1).trim();
          if (k === "Title") title = v;
          else if (k === "Artist") artist = v;
          else if (k === "Version") version = v;
          else if (k === "Creator") creator = v;
          break;
        }
        case "difficulty": {
          const ci = line.indexOf(":");
          if (ci < 0) break;
          const k = line.slice(0, ci).trim();
          const v = parseFloat(line.slice(ci + 1).trim());
          if (k === "CircleSize") keys = v > 0 ? Math.round(v) : 10;
          else if (k === "OverallDifficulty") od = v;
          else if (k === "HPDrainRate") hp = v;
          break;
        }
        case "events": {
          if (line.startsWith("2 ") || line.startsWith("2	")) {
            const parts = line.split(/\s+/);
            const s = parseInt(parts[1], 10);
            const e = parseInt(parts[2], 10);
            if (Number.isFinite(s) && Number.isFinite(e)) breaks.push([s, e]);
          }
          break;
        }
        case "timingpoints": {
          const p = line.split(",");
          if (p.length < 2) break;
          const t = parseFloat(p[0]);
          const bl = parseFloat(p[1]);
          const uninherited = p.length >= 7 ? p[6].trim() !== "0" : bl > 0;
          if (uninherited && bl > 0 && Number.isFinite(t)) timingPoints.push({ t, beatLength: bl });
          break;
        }
        case "hitobjects": {
          if (!keys) keys = 7;
          const p = line.split(",");
          if (p.length < 5) break;
          const x = parseFloat(p[0]);
          if (!Number.isFinite(x)) break;
          const type = parseInt(p[3], 10);
          const t = Math.round(parseFloat(p[2]));
          const col = clamp(Math.trunc(x * keys / 512), 0, keys - 1);
          if (type & 128) {
            const tailField = p[5] ?? p[4];
            const lnEnd = Math.round(parseFloat(String(tailField).split(":")[0]));
            notes.push({ t, col, lnEnd: Number.isFinite(lnEnd) ? Math.max(lnEnd, t) : null });
          } else if (type & 1) {
            notes.push({ t, col, lnEnd: null });
          }
          break;
        }
      }
    }
    if (!notes.length) throw new Error("EmptyBeatmap");
    notes.sort((a, b) => a.t - b.t || a.col - b.col);
    timingPoints.sort((a, b) => a.t - b.t);
    let lastNote = 0;
    for (const n of notes) lastNote = Math.max(lastNote, n.lnEnd ?? n.t);
    return {
      keys,
      notes,
      timingPoints,
      breaks,
      meta: { title, artist, version, creator, od, hp },
      firstNote: notes[0].t,
      lastNote
    };
  }
  function beatLengthAt(tps, t) {
    if (!tps.length) return 500;
    let lo = 0;
    let hi = tps.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >> 1;
      if (tps[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return tps[lo].beatLength;
  }

  // src/config.ts
  var CONFIG = {
    /** merge hits within this window into one row */
    rowMergeMs: 10,
    // ---- grid fitting ----
    /** tolerance around grid points (ms) */
    gridTolMs: 30,
    /** minimum fraction of hits that must sit on the grid to count as "regular" */
    gridMinRatio: 0.6,
    /** candidate spacings below this (ms) are halved/doubled to normalize */
    gridMinSpacing: 45,
    gridMaxSpacing: 2e3,
    // ---- feature windows ----
    /** feature window length (ms) */
    winMs: 1e3,
    /** feature window step (ms) */
    winStepMs: 250,
    /** windows shorter than this note count get flagged low-density */
    winMinNotes: 4,
    // ---- segmentation ----
    /** minimum prominence (absolute) for a change point */
    segProminenceAbs: 0.05,
    /** minimum prominence relative to local signal scale */
    segProminenceRel: 0.35,
    /** minimum segment length before merging (ms) */
    minSegLenMs: 3e3,
    /** when merging a short segment, prefer the neighbor whose feature dist is smaller */
    mergeBySimilarity: true,
    /** gap between consecutive notes considered a rest (ms) */
    restGapMs: 2500,
    /** a segment whose nps is below this quantile of map nps may be Break */
    breakNpsQuantile: 0.25,
    /** absolute nps floor under which a segment is Break regardless */
    breakAbsNps: 1.2,
    // ---- classification ----
    /** weighted LN-head stream ratio above which a segment is LN-dominant */
    lnDominantRatio: 0.45,
    /** min confidence for displaying a secondary tag */
    secondaryMargin: 0.75,
    // ---- overall aggregation ----
    /** share of best tag's weight over total for a single dominant tag */
    overallDominantShare: 0.52,
    /** minimum weight share for a tag to be counted in mix counting */
    overallMixShare: 0.07
  };

  // src/core/rows.ts
  function popcount(mask) {
    let c = 0;
    while (mask) {
      mask &= mask - 1;
      c++;
    }
    return c;
  }
  function buildRows(map) {
    const rows = [];
    const merge = CONFIG.rowMergeMs;
    let i = 0;
    const n = map.notes.length;
    while (i < n) {
      const t0 = map.notes[i].t;
      let mask = 0;
      let lnHeadMask = 0;
      let lnTailMask = 0;
      while (i < n && map.notes[i].t - t0 <= merge) {
        const nt = map.notes[i];
        mask |= 1 << nt.col;
        if (nt.lnEnd != null) lnHeadMask |= 1 << nt.col;
        i++;
      }
      rows.push({ t: t0, mask, hits: popcount(mask), lnHeadMask, lnTailMask });
    }
    return rows;
  }
  function attachTails(map, rows) {
    const tails = [];
    for (const n of map.notes) {
      if (n.lnEnd != null) tails.push({ t: n.lnEnd, col: n.col });
    }
    tails.sort((a, b) => a.t - b.t);
    let ri = 0;
    const extra = [];
    for (const tail of tails) {
      while (ri + 1 < rows.length && rows[ri + 1].t <= tail.t + CONFIG.rowMergeMs) ri++;
      let best = -1;
      let bestDist = Infinity;
      for (let k = ri; k >= 0 && rows[k].t >= tail.t - CONFIG.rowMergeMs * 4; k--) {
        const d = Math.abs(rows[k].t - tail.t);
        if (d < bestDist && d <= CONFIG.rowMergeMs * 4) {
          bestDist = d;
          best = k;
        }
      }
      if (best >= 0) {
        rows[best].lnTailMask |= 1 << tail.col;
      } else {
        extra.push({ t: tail.t, mask: 0, hits: 0, lnHeadMask: 0, lnTailMask: 1 << tail.col });
      }
    }
    if (extra.length) {
      rows.push(...extra);
      rows.sort((a, b) => a.t - b.t);
    }
  }
  function buildColumnData(map) {
    const K = map.keys;
    const colNotes = Array.from({ length: K }, () => []);
    for (const n of map.notes) colNotes[n.col].push(n.t);
    const colIntervals = [];
    for (let c = 0; c < K; c++) {
      const arr = colNotes[c];
      const iv = [];
      for (let i = 1; i < arr.length; i++) iv.push(arr[i] - arr[i - 1]);
      colIntervals.push(iv);
    }
    return { colNotes, colIntervals };
  }
  function computeHeld(map, rows) {
    const events = [];
    for (const n of map.notes) {
      if (n.lnEnd != null && n.lnEnd - n.t > 1) {
        events.push({ t: n.t, col: n.col, type: 0 });
        events.push({ t: n.lnEnd, col: n.col, type: 1 });
      }
    }
    events.sort((a, b) => a.t - b.t || a.type - b.type);
    const heldMask = new Int32Array(rows.length);
    const lockRow = new Uint8Array(rows.length);
    const freeHits = new Int32Array(rows.length);
    const heldHits = new Int32Array(rows.length);
    let held = 0;
    let ei = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const t = rows[ri].t;
      while (ei < events.length && events[ei].t <= t) {
        const e = events[ei];
        if (e.type === 0) held |= 1 << e.col;
        else held &= ~(1 << e.col);
        ei++;
      }
      heldMask[ri] = held;
      if (held) {
        const free = rows[ri].mask & ~held;
        const onHeld = rows[ri].mask & held;
        freeHits[ri] = popcount(free);
        heldHits[ri] = popcount(onHeld);
        lockRow[ri] = held !== 0 && free !== 0 ? 1 : 0;
      } else {
        freeHits[ri] = rows[ri].hits;
        heldHits[ri] = 0;
      }
    }
    return { heldMask, lockRow, freeHits, heldHits };
  }

  // src/core/grid.ts
  function gridCoverage(times, spacing, tol) {
    const n = times.length;
    if (n === 0 || spacing <= 0) return 0;
    const bins = Math.max(8, Math.round(spacing / Math.max(tol, 5)));
    const hist = new Int32Array(bins);
    for (let i = 0; i < n; i++) {
      let m = times[i] % spacing;
      if (m < 0) m += spacing;
      hist[Math.min(bins - 1, Math.floor(m / spacing * bins))]++;
    }
    let peakBin = 0;
    for (let b = 1; b < bins; b++) if (hist[b] > hist[peakBin]) peakBin = b;
    const phase = (peakBin + 0.5) / bins * spacing;
    let onGrid = 0;
    for (let i = 0; i < n; i++) {
      let d = (times[i] - phase) % spacing;
      if (d < 0) d += spacing;
      if (d > spacing / 2) d = spacing - d;
      if (d <= tol) onGrid++;
    }
    return onGrid / n;
  }
  function fitGrid(rows, tStart, tEnd, lo, hi) {
    const times = [];
    if (lo !== void 0 && hi !== void 0) {
      for (let i = lo; i < hi; i++) {
        const r = rows[i];
        if (r.hits > 0) times.push(r.t);
      }
    } else {
      for (const r of rows) {
        if (r.hits > 0 && r.t >= tStart && r.t <= tEnd) times.push(r.t);
      }
    }
    const n = times.length;
    if (n < 4) return { spacing: 0, ratio: 0, equivBpm: 0 };
    const uniq = [times[0]];
    for (let i = 1; i < n; i++) if (times[i] - uniq[uniq.length - 1] > CONFIG.rowMergeMs) uniq.push(times[i]);
    const arr = Float64Array.from(uniq);
    const ivs = [];
    for (let i = 1; i < arr.length; i++) ivs.push(arr[i] - arr[i - 1]);
    ivs.sort((a, b) => a - b);
    const medianIv = ivs[Math.floor(ivs.length / 2)] || 500;
    const tol = CONFIG.gridTolMs;
    let bestSpacing = 0;
    let bestRatio = 0;
    const evaluate = (s) => {
      if (!(s >= CONFIG.gridMinSpacing && s <= CONFIG.gridMaxSpacing)) return;
      const cov = gridCoverage(arr, s, tol);
      if (cov > bestRatio + 1e-9 || Math.abs(cov - bestRatio) <= 1e-9 && s > bestSpacing) {
        bestRatio = cov;
        bestSpacing = s;
      }
    };
    const bases = [medianIv, medianIv / 2];
    for (const b of bases) {
      for (let mult = 1; mult <= 6; mult++) evaluate(b * mult);
    }
    if (bestRatio < CONFIG.gridMinRatio) {
      for (let s = CONFIG.gridMinSpacing; s <= 800; s = s * 1.12) evaluate(s);
    }
    return {
      spacing: bestSpacing,
      ratio: bestRatio,
      equivBpm: bestSpacing > 0 ? 15e3 / bestSpacing : 0
    };
  }

  // src/core/features.ts
  function buildFeatureContext(map, rows, held, cols) {
    const K = map.keys;
    const boundaryTimes = [];
    for (let b = 0; b <= K; b++) boundaryTimes.push(new Float64Array(0));
    for (let b = 1; b < K; b++) {
      const a = cols.colNotes[b - 1];
      const c = cols.colNotes[b];
      const merged = new Float64Array(a.length + c.length);
      let i = 0, j = 0, m = 0;
      while (i < a.length && j < c.length) merged[m++] = a[i] <= c[j] ? a[i++] : c[j++];
      while (i < a.length) merged[m++] = a[i++];
      while (j < c.length) merged[m++] = c[j++];
      boundaryTimes[b] = merged.subarray(0, m);
    }
    const lnHeads = [];
    const lnTails = [];
    const allEvents = [];
    for (const n of map.notes) {
      if (n.lnEnd != null) {
        lnHeads.push({ t: n.t, col: n.col, dur: n.lnEnd - n.t });
        lnTails.push({ t: n.lnEnd, col: n.col, start: n.t });
        allEvents.push({ t: n.t, col: n.col, kind: "head" });
        allEvents.push({ t: n.lnEnd, col: n.col, kind: "tail" });
      } else {
        allEvents.push({ t: n.t, col: n.col, kind: "head" });
      }
    }
    allEvents.sort((a, b) => a.t - b.t);
    lnTails.sort((a, b) => a.t - b.t);
    let lnMaxDur = 0;
    for (const h of lnHeads) if (h.dur > lnMaxDur) lnMaxDur = h.dur;
    const riceArr = map.notes.filter((n) => n.lnEnd == null).map((n) => n.t);
    riceArr.sort((a, b) => a - b);
    const riceTimes = Float64Array.from(riceArr);
    return { map, rows, held, cols, boundaryTimes, lnHeads, lnTails, lnMaxDur, allEvents, riceTimes };
  }
  function lowerBound(arr, t) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (arr[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function lowerBoundObj(arr, t, key) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (key(arr[mid]) < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function upperBoundObj(arr, t, key) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (key(arr[mid]) <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  var BOUNDARY_W = {
    7: [0.225, 0.35, 0.25, 0.225, 0.225, 0.25, 0.35, 0.225]
  };
  function cutDemandInWindow(ctx, t0, t1) {
    const K = ctx.map.keys;
    const w = BOUNDARY_W[K] ?? Array.from({ length: K + 1 }, (_, i) => Math.abs(i - K / 2) < 1 ? 0.05 : 0.35);
    let sum = 0;
    for (let b = 1; b < K; b++) {
      const arr = ctx.boundaryTimes[b];
      const lo = lowerBound(arr, t0);
      const hi = lowerBound(arr, t1);
      if (hi - lo < 2) continue;
      for (let i = lo + 1; i < hi; i++) {
        const dt = (arr[i] - arr[i - 1]) / 1e3;
        if (dt > 0 && dt < 0.5) sum += w[b] / (dt * dt);
      }
    }
    return sum / ((t1 - t0) / 1e3);
  }
  function computeWindowFeatures(ctx, t0, t1) {
    const rows = ctx.rows;
    const held = ctx.held;
    const K = ctx.map.keys;
    const durS = (t1 - t0) / 1e3;
    const loIdx = Math.max(0, lowerBoundObj(rows, t0, (r) => r.t) - 1);
    const hiIdx = lowerBoundObj(rows, t1, (r) => r.t);
    let notes = 0;
    let rowCount = 0;
    let chordSum = 0;
    let largeHits = 0, multiHits = 0, singleRows = 0;
    let jackPairs = 0, pairCount = 0, overlapSum = 0, cutPairs = 0;
    const ivs = [];
    for (let i = loIdx; i < hiIdx; i++) {
      const r = rows[i];
      const inWin = r.t >= t0 && r.t < t1;
      if (!inWin || r.hits === 0) continue;
      rowCount++;
      notes += r.hits;
      chordSum += r.hits;
      if (r.hits >= 3) largeHits += r.hits;
      if (r.hits >= 2) multiHits += r.hits;
      if (r.hits === 1) singleRows++;
      if (i > 0 && rows[i - 1].hits > 0) {
        const prev = rows[i - 1];
        const ovMask = prev.mask & r.mask;
        const ov = popcount(ovMask);
        pairCount++;
        if (ov > 0) {
          jackPairs++;
          overlapSum += ov / Math.min(prev.hits, r.hits);
        } else cutPairs++;
        ivs.push(r.t - prev.t);
      }
    }
    const f = {
      t: t0,
      end: t1,
      nps: notes / durS,
      rows: rowCount,
      notes,
      equivBpm: 0,
      gridRatio: 0,
      rhythmSteady: 0,
      chordMean: rowCount ? chordSum / rowCount : 0,
      largeChordRatio: notes ? largeHits / notes : 0,
      multiRatio: notes ? multiHits / notes : 0,
      singleRatio: rowCount ? singleRows / rowCount : 0,
      jackRowRatio: pairCount ? jackPairs / pairCount : 0,
      overlapDegree: jackPairs ? overlapSum / jackPairs : 0,
      jackSpeedBpm: 0,
      cutFreeRatio: pairCount ? cutPairs / pairCount : 0,
      cutDemand: 0,
      anchorRate: 0,
      trillRate: 0,
      altHandRate: 0,
      rollRate: 0,
      graceRate: 0,
      offBeatRatio: 0,
      lnWeightRatio: 0,
      lockRatio: 0,
      lnAreaRatio: 0,
      heldCoverage: 0,
      tailRate: 0,
      tailIndependence: 0,
      tailScatter: 0,
      shortLnRatio: 0,
      invGapScore: 0
    };
    if (rowCount === 0) return f;
    const gridLo = lowerBoundObj(rows, t0, (r) => r.t);
    const gridHi = upperBoundObj(rows, t1 - 1, (r) => r.t);
    const grid = fitGrid(rows, t0, t1 - 1, gridLo, gridHi);
    f.equivBpm = grid.equivBpm;
    f.gridRatio = grid.ratio;
    if (ivs.length >= 3) {
      const sorted = [...ivs].sort((a, b) => a - b);
      const modal = sorted[Math.floor(sorted.length / 2)];
      let steady = 0;
      let grace = 0;
      for (const iv of ivs) {
        const q = iv / modal;
        const nearest = Math.max(1, Math.round(q));
        if (Math.abs(iv - nearest * modal) <= CONFIG.gridTolMs) steady++;
        if (iv < modal * 0.45) grace++;
      }
      f.rhythmSteady = steady / ivs.length;
      f.graceRate = grace / ivs.length;
      const repDts = [];
      const cols = ctx.cols.colNotes;
      for (let c = 0; c < K; c++) {
        const arr = cols[c];
        const clo = lowerBound(arr, t0);
        const chi = lowerBound(arr, t1);
        for (let i = clo + 1; i < chi; i++) {
          const dt = arr[i] - arr[i - 1];
          if (dt < 1e3) repDts.push(dt);
        }
      }
      if (repDts.length) {
        repDts.sort((a, b) => a - b);
        const med = repDts[Math.floor(repDts.length / 2)];
        f.jackSpeedBpm = med > 0 ? Math.min(15e3 / med, 400) : 0;
      }
    }
    {
      let anchorNotes = 0;
      for (let c = 0; c < K; c++) {
        const arr = ctx.cols.colNotes[c];
        const clo = lowerBound(arr, t0);
        const chi = lowerBound(arr, t1);
        let run = 1;
        let dts = [];
        const flush = () => {
          if (run >= 3 && dts.length >= 2) {
            const m = dts.reduce((x, y) => x + y, 0) / dts.length;
            const v = dts.reduce((x, y) => x + (y - m) ** 2, 0) / dts.length;
            if (m > 0 && Math.sqrt(v) / m < 0.3) anchorNotes += run;
          }
        };
        for (let i = clo + 1; i < chi; i++) {
          const dt = arr[i] - arr[i - 1];
          const ref = dts.length ? dts[dts.length - 1] : dt;
          if (dt > ref * 1.8 || dt < ref * 0.56 || dt > 1500) {
            flush();
            run = 1;
            dts = [];
          } else {
            run++;
            dts.push(dt);
          }
        }
        flush();
      }
      f.anchorRate = notes ? anchorNotes / notes : 0;
      const split2 = K <= 1 ? 1 : Math.ceil(K / 2);
      const seq = [];
      for (let i = loIdx; i < hiIdx; i++) {
        const r = rows[i];
        if (r.hits === 0 || r.t < t0 || r.t >= t1) continue;
        let col = -1, left = 0;
        for (let c = 0; c < K; c++) {
          if (r.mask & 1 << c) {
            col = c;
            if (c < split2) left++;
          }
        }
        seq.push({ t: r.t, col: r.hits === 1 ? col : -1, hand: left * 2 >= r.hits ? 0 : 1, hits: r.hits });
      }
      let altHandRows = 0;
      {
        let run = 1;
        for (let i = 1; i < seq.length; i++) {
          const cont = seq[i].hand !== seq[i - 1].hand && (i >= 2 ? seq[i].hand === seq[i - 2].hand : false);
          if (cont) run++;
          else {
            if (run >= 4) altHandRows += run;
            run = i + 1 < seq.length && seq[i + 1].hand !== seq[i].hand ? 2 : 1;
          }
        }
        if (run >= 4) altHandRows += run;
      }
      f.altHandRate = seq.length ? altHandRows / seq.length : 0;
      let trillRows = 0;
      {
        const singles = seq.filter((s) => s.hits === 1);
        let run = 1;
        for (let i = 1; i < singles.length; i++) {
          const cont = singles[i].col !== singles[i - 1].col && (i >= 2 ? singles[i].col === singles[i - 2].col && singles[i - 1].col !== singles[i - 2].col : false);
          if (cont) run++;
          else {
            if (run >= 5) trillRows += run;
            run = 1;
          }
        }
        if (run >= 5) trillRows += run;
        f.trillRate = singles.length ? trillRows / singles.length : 0;
      }
      {
        const singles = seq.filter((s) => s.hits === 1);
        let dir = 0, run = 1, rollRows = 0;
        for (let i = 1; i < singles.length; i++) {
          const d = Math.sign(singles[i].col - singles[i - 1].col);
          if (d !== 0 && (dir === 0 || d === dir)) {
            dir = d;
            run++;
          } else {
            if (run >= 4) rollRows += run;
            run = d !== 0 ? 2 : 1;
            dir = d;
          }
        }
        if (run >= 4) rollRows += run;
        f.rollRate = singles.length ? rollRows / singles.length : 0;
      }
      if (ctx.map.timingPoints.length && seq.length) {
        const anchor = ctx.map.timingPoints[0].t;
        let off = 0;
        for (const s of seq) {
          const q = beatLengthAt(ctx.map.timingPoints, s.t) / 4;
          let d = (s.t - anchor) % q;
          if (d < 0) d += q;
          if (d > q / 2) d = q - d;
          if (d > 40) off++;
        }
        f.offBeatRatio = off / seq.length;
      }
    }
    const split = K <= 1 ? 1 : Math.ceil(K / 2);
    {
      let lnW = 0;
      const heads = ctx.lnHeads;
      const hFrom = lowerBoundObj(heads, t0, (h) => h.t);
      const hTo = lowerBoundObj(heads, t1, (h) => h.t);
      for (let i = hFrom; i < hTo; i++) lnW += 1 + Math.min(heads[i].dur, 1200) / 400;
      const riceCount = lowerBound(ctx.riceTimes, t1) - lowerBound(ctx.riceTimes, t0);
      const totalW = lnW + riceCount;
      f.lnWeightRatio = totalW > 0 ? lnW / totalW : 0;
      let heldSum = 0, heldCount = 0;
      for (let i = loIdx; i < hiIdx; i++) {
        const r = rows[i];
        if (r.t < t0 || r.t >= t1 || r.hits === 0) continue;
        const hm = held.heldMask[i];
        if (hm) {
          heldSum += popcount(hm);
          heldCount++;
          if ((r.mask & ~hm) !== 0) f.lockRatio += 1;
        }
      }
      f.lockRatio /= rowCount;
      f.heldCoverage = heldCount ? heldSum / heldCount / K : 0;
      {
        const hs = ctx.lnHeads;
        const ts = ctx.lnTails;
        const active = [];
        const aLo = lowerBoundObj(hs, t0 - ctx.lnMaxDur, (h) => h.t);
        const aHi = lowerBoundObj(hs, t1, (h) => h.t);
        for (let i = aLo; i < aHi; i++) {
          const h = hs[i];
          if (h.t + h.dur >= t0) active.push({ start: h.t, end: h.t + h.dur });
        }
        const tLo = lowerBoundObj(ts, t0, (x) => x.t);
        const tHi = upperBoundObj(ts, t1, (x) => x.t);
        for (let i = tLo; i < tHi; i++) {
          const tl = ts[i];
          if (tl.start < t0) active.push({ start: tl.start, end: tl.t });
        }
        let area = 0;
        for (const ln of active) {
          const s = Math.max(ln.start, t0);
          const e = Math.min(ln.end, t1);
          if (e > s) area += e - s;
        }
        f.lnAreaRatio = area / ((t1 - t0) * K);
      }
      const tails = ctx.lnTails;
      const ti = lowerBoundObj(tails, t0, (x) => x.t);
      const tj = lowerBoundObj(tails, t1, (x) => x.t);
      const nTails = tj - ti;
      f.tailRate = nTails / durS;
      if (nTails > 0) {
        let indep = 0;
        const durs = [];
        const gaps = [];
        for (let i = ti; i < tj; i++) {
          durs.push(tails[i].t - tails[i].start);
          const ev = ctx.allEvents;
          const ei = lowerBoundObj(ev, tails[i].t, (e) => e.t);
          if (ei < ev.length && ev[ei].t - tails[i].t < 3e3) {
            if (ev[ei].col !== tails[i].col) indep++;
          }
          const carr = ctx.cols.colNotes[tails[i].col];
          const ci = lowerBound(carr, tails[i].t);
          if (ci < carr.length) {
            const g = carr[ci] - tails[i].t;
            if (g < 1500) gaps.push(g);
          }
        }
        f.tailIndependence = indep / nTails;
        const meanDur = durs.reduce((a, b) => a + b, 0) / durs.length;
        const varDur = durs.reduce((a, b) => a + (b - meanDur) ** 2, 0) / durs.length;
        f.tailScatter = meanDur > 0 ? Math.sqrt(varDur) / meanDur : 0;
        let shortLn = 0;
        for (let i = hFrom; i < hTo; i++) if (heads[i].dur < 300) shortLn++;
        const nLnHeads = hTo - hFrom;
        f.shortLnRatio = nLnHeads ? shortLn / nLnHeads : 0;
        if (gaps.length >= 3) {
          const mg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const vg = gaps.reduce((a, b) => a + (b - mg) ** 2, 0) / gaps.length;
          const cv = mg > 0 ? Math.sqrt(vg) / mg : 1;
          const smallness = clamp01(1 - mg / 800);
          const uniformity = clamp01(1 - cv);
          f.invGapScore = (smallness * 0.5 + uniformity * 0.5) * Math.min(1, gaps.length / Math.max(3, nTails));
        }
      }
    }
    f.cutDemand = cutDemandInWindow(ctx, t0, t1);
    return f;
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function computeAllWindows(ctx) {
    const out = [];
    const { firstNote, lastNote } = ctx.map;
    const step = CONFIG.winStepMs;
    const win = CONFIG.winMs;
    for (let t = firstNote; t < lastNote; t += step) {
      out.push(computeWindowFeatures(ctx, t, Math.min(t + win, lastNote)));
    }
    return out;
  }

  // src/segment/segmenter.ts
  var SEG_FEATURES = [
    "nps",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "cutFreeRatio",
    "cutDemand",
    "rhythmSteady",
    "gridRatio",
    "anchorRate",
    "offBeatRatio",
    "techRate",
    "lnWeightRatio",
    "lockRatio",
    "heldCoverage",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore"
  ];
  function techRate(w) {
    return Math.max(w.trillRate, w.altHandRate, w.rollRate);
  }
  function segFeatValue(w, k) {
    switch (k) {
      case "techRate":
        return techRate(w);
      default:
        return w[k];
    }
  }
  function normalizeWindows(windows) {
    const names = [...SEG_FEATURES];
    const n = windows.length;
    const values = new Array(n);
    if (n === 0) return { values, featureNames: names };
    for (const key of names) {
      const raw = new Float64Array(n);
      for (let i = 0; i < n; i++) raw[i] = segFeatValue(windows[i], key);
      const sorted = Float64Array.from(raw).sort();
      const q = (p) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
      const med = q(0.5);
      let scale = q(0.9) - q(0.1);
      if (scale < 1e-6) scale = Math.max(Math.abs(med) * 0.5, 1e-6);
      const logTailed = key === "cutDemand" || key === "jackSpeedBpm" || key === "nps" || key === "tailRate";
      for (let i = 0; i < n; i++) {
        let x = raw[i];
        if (logTailed) x = Math.log1p(Math.max(0, x) / 5);
        const z = (x - (logTailed ? Math.log1p(Math.max(0, med) / 5) : med)) / scale;
        values[i] = values[i] ?? new Float64Array(names.length);
        values[i][names.indexOf(key)] = Math.max(-1, Math.min(2, z));
      }
    }
    return { values, featureNames: names };
  }
  function l1(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  }
  function meanVec(norm, from, to) {
    const out = new Float64Array(norm.featureNames.length);
    let cnt = 0;
    for (let i = from; i < to && i < norm.values.length; i++) {
      for (let j = 0; j < out.length; j++) out[j] += norm.values[i][j];
      cnt++;
    }
    if (cnt > 0) for (let j = 0; j < out.length; j++) out[j] /= cnt;
    return out;
  }
  function detectBoundaries(norm, minSegWindows) {
    const n = norm.values.length;
    if (n < minSegWindows * 2) return [];
    const half = Math.max(2, Math.round(minSegWindows / 2));
    const dist = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = meanVec(norm, Math.max(0, i - half), i);
      const b = meanVec(norm, i, Math.min(n, i + half));
      dist[i] = l1(a, b);
    }
    const sm = new Float64Array(n);
    const k = 1;
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) {
        s += dist[j];
        c++;
      }
      sm[i] = s / c;
    }
    const prom = new Float64Array(n);
    const baseR = minSegWindows;
    for (let i = 0; i < n; i++) {
      const vals = [];
      for (let j = Math.max(0, i - baseR); j <= Math.min(n - 1, i + baseR); j++) vals.push(sm[j]);
      vals.sort((a, b) => a - b);
      const med = vals[Math.floor(vals.length / 2)];
      let scale = vals[Math.floor(vals.length * 0.9)] - med;
      if (scale < 0.02) scale = 0.02;
      prom[i] = sm[i] - med;
      void scale;
    }
    const q = Math.max(1, Math.round(minSegWindows / 6));
    const cands = [];
    for (let i = 1; i < n - 1; i++) {
      let isMax = true;
      for (let j = Math.max(0, i - q); j <= Math.min(n - 1, i + q); j++) {
        if (sm[j] > sm[i]) {
          isMax = false;
          break;
        }
      }
      if (isMax && prom[i] > CONFIG.segProminenceAbs) cands.push({ i, v: prom[i] });
    }
    cands.sort((a, b) => b.v - a.v);
    const promSorted = Float64Array.from(prom).sort();
    const refProm = promSorted[Math.floor(promSorted.length * 0.95)] || CONFIG.segProminenceAbs;
    const relThr = Math.max(CONFIG.segProminenceAbs, refProm * CONFIG.segProminenceRel);
    const picked = [];
    for (const c of cands) {
      if (c.v < relThr) continue;
      if (picked.every((p) => Math.abs(p - c.i) >= minSegWindows)) picked.push(c.i);
    }
    return picked.sort((a, b) => a - b);
  }
  function snapBoundary(rows, t, snapWinMs = 600) {
    let lo = 0, hi = rows.length - 1, best = t, bestGap = 0;
    let i0 = 0;
    {
      let a = 0, b = rows.length;
      while (a < b) {
        const m = a + b >> 1;
        if (rows[m].t < t - snapWinMs) a = m + 1;
        else b = m;
      }
      i0 = a;
    }
    for (let i = Math.max(1, i0); i < rows.length && rows[i].t <= t + snapWinMs; i++) {
      const gap = rows[i].t - rows[i - 1].t;
      const mid = (rows[i].t + rows[i - 1].t) / 2;
      if (gap > bestGap) {
        bestGap = gap;
        best = Math.abs(mid - t) <= snapWinMs ? mid : t;
      }
    }
    return best;
  }
  function segmentMap(input) {
    const { map, rows, windows, norm } = input;
    const step = CONFIG.winStepMs;
    const minSegWindows = Math.max(2, Math.round(CONFIG.minSegLenMs / step));
    const bounds = detectBoundaries(norm, minSegWindows);
    const snapped = bounds.map((bi) => snapBoundary(rows, windows[Math.min(bi, windows.length - 1)].t + step / 2));
    const points = [map.firstNote, ...snapped, map.lastNote];
    const segs = [];
    let prevW = 0;
    for (let i = 0; i < points.length - 1; i++) {
      let s = points[i];
      let e = points[i + 1];
      if (e - s < 50) continue;
      const wEnd = Math.min(windows.length, Math.round((e - map.firstNote) / step));
      segs.push({ start: s, end: e, windowRange: [prevW, Math.max(prevW + 1, wEnd)] });
      prevW = Math.max(prevW + 1, wEnd);
    }
    const vecs = segs.map((s) => meanVec(norm, s.windowRange[0], s.windowRange[1]));
    const merged = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.end - seg.start >= CONFIG.minSegLenMs || merged.length === 0) {
        merged.push({ ...seg });
        continue;
      }
      const last = merged[merged.length - 1];
      const distPrev = l1(vecs[i], vecs[i - 1]);
      const distNext = i + 1 < segs.length ? l1(vecs[i], vecs[i + 1]) : Infinity;
      if (CONFIG.mergeBySimilarity && distNext < distPrev && i + 1 < segs.length) {
        segs[i + 1].start = seg.start;
        segs[i + 1].windowRange[0] = seg.windowRange[0];
      } else {
        last.end = seg.end;
        last.windowRange[1] = seg.windowRange[1];
      }
    }
    const out = merged.filter((s) => s.end - s.start >= 50);
    for (let i = 1; i < out.length; i++) out[i].start = Math.max(out[i].start, out[i - 1].end);
    return out;
  }
  function npsInRange(rows, start, end) {
    let a = 0, b = rows.length;
    while (a < b) {
      const m = a + b >> 1;
      if (rows[m].t < start) a = m + 1;
      else b = m;
    }
    let notes = 0;
    for (let i = a; i < rows.length && rows[i].t < end; i++) notes += rows[i].hits;
    const dur = Math.max(0.5, (end - start) / 1e3);
    return notes / dur;
  }
  function markBreaks(map, rows, segs) {
    const npss = segs.map((s) => npsInRange(rows, s.start, s.end));
    const sorted = [...npss].sort((a, b) => a - b);
    const q = sorted[Math.floor(CONFIG.breakNpsQuantile * (sorted.length - 1))] ?? 0;
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const nps = npss[i];
      let isBreak = nps < CONFIG.breakAbsNps;
      if (!isBreak && nps <= Math.max(q, 0) * 0.55 && nps < 3) isBreak = true;
      if (!isBreak) {
        let a = 0, b = rows.length;
        while (a < b) {
          const m = a + b >> 1;
          if (rows[m].t < s.start) a = m + 1;
          else b = m;
        }
        let prevT = s.start;
        for (let ri = a; ri < rows.length && rows[ri].t < s.end; ri++) {
          if (rows[ri].t - prevT >= CONFIG.restGapMs) {
            isBreak = true;
            break;
          }
          prevT = rows[ri].t;
        }
      }
      out.push({ start: s.start, end: s.end, family: isBreak ? "break" : "rc" });
    }
    void map;
    return out;
  }

  // src/classify/extras.ts
  function lowerBoundRow(rows, t) {
    let lo = 0, hi = rows.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (rows[m].t < t) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  function computeSegmentExtras(ctx, start, end) {
    const rows = ctx.rows;
    const K = ctx.map.keys;
    const lo = Math.max(0, lowerBoundRow(rows, start) - 1);
    const hi = lowerBoundRow(rows, end);
    let rowCount = 0, notes = 0;
    let lnHeadRowCount = 0, lnHeadSum = 0;
    let lnHeadPairs = 0, lnHeadOverlaps = 0;
    let prevHeadRowIdx = -1;
    let tailRows = 0, singleTailRows = 0;
    const colSeen = new Array(K).fill(0);
    const chordMasks = [];
    const chordHits = [];
    const chordTimes = [];
    let prevT = start;
    let maxGap = 0;
    for (let i = lo; i < hi; i++) {
      const r = rows[i];
      if (r.t < start || r.t >= end) continue;
      if (r.hits === 0 && !r.lnTailMask) continue;
      if (r.t - prevT > maxGap) maxGap = r.t - prevT;
      prevT = r.t;
      if (r.hits > 0) {
        rowCount++;
        notes += r.hits;
        chordMasks.push(r.mask);
        chordHits.push(r.hits);
        chordTimes.push(r.t);
        for (let c = 0; c < K; c++) if (r.mask & 1 << c) colSeen[c]++;
      }
      if (r.lnTailMask) {
        tailRows++;
        if (popcount(r.lnTailMask) === 1 && popcount(r.mask) === 0) singleTailRows++;
      }
      if (r.lnHeadMask) {
        lnHeadRowCount++;
        lnHeadSum += popcount(r.lnHeadMask);
        if (prevHeadRowIdx >= 0 && rows[prevHeadRowIdx].lnHeadMask) {
          lnHeadPairs++;
          if (rows[prevHeadRowIdx].lnHeadMask & r.lnHeadMask) lnHeadOverlaps++;
        }
        prevHeadRowIdx = i;
      } else {
        prevHeadRowIdx = -1;
      }
    }
    const runNoteCount = { n: 0 };
    const runCols = /* @__PURE__ */ new Set();
    for (let c = 0; c < K; c++) {
      const arr = ctx.cols.colNotes[c];
      let a = 0, b = arr.length;
      while (a < b) {
        const m = a + b >> 1;
        if (arr[m] < start) a = m + 1;
        else b = m;
      }
      let hiIdx = a;
      {
        let lo2 = a, hi2 = arr.length;
        while (lo2 < hi2) {
          const m = lo2 + hi2 >> 1;
          if (arr[m] < end) lo2 = m + 1;
          else hi2 = m;
        }
        hiIdx = lo2;
      }
      void b;
      let runLen2 = 1;
      let dts = [];
      const flush = (endIdx) => {
        if (runLen2 >= 4 && dts.length >= 3) {
          const med = median(dts);
          if (med > 30 && med <= 320 && stdevCv(dts) < 0.35) {
            runNoteCount.n += runLen2;
            runCols.add(c);
          }
        }
        void endIdx;
      };
      for (let i = a + 1; i < hiIdx; i++) {
        const dt = arr[i] - arr[i - 1];
        const refMed = dts.length ? median(dts) : dt;
        if (dt > refMed * 2.2 || dt < refMed * 0.45 || dt > 350) {
          flush(i);
          runLen2 = 1;
          dts = [];
        } else {
          runLen2++;
          dts.push(dt);
        }
      }
      flush(hiIdx);
    }
    const durS = Math.max(0.5, (end - start) / 1e3);
    let seenCols = 0;
    for (let c = 0; c < K; c++) if (colSeen[c] > 0) seenCols++;
    let chordOverlapRatio = 0, chordOverlapJaccard = 0, maxLockRun = 0, avgOverlapSize = 0;
    {
      let pairs = 0, inter = 0, jacSum = 0, interSum = 0, cur = 0;
      for (let i = 1; i < chordMasks.length; i++) {
        const a = chordMasks[i - 1], b = chordMasks[i];
        const ia = popcount(a & b);
        pairs++;
        if (ia > 0) {
          inter++;
          cur++;
          if (cur > maxLockRun) maxLockRun = cur;
          interSum += ia;
          jacSum += ia / popcount(a | b);
        } else {
          cur = 0;
        }
      }
      if (pairs > 0) {
        chordOverlapRatio = inter / pairs;
        chordOverlapJaccard = jacSum / pairs;
        avgOverlapSize = inter > 0 ? interSum / inter : 0;
      }
    }
    let chordGapMed = 0, chordGapCv = 1;
    {
      const gaps = [];
      for (let i = 1; i < chordTimes.length; i++) {
        const dt = chordTimes[i] - chordTimes[i - 1];
        if (dt >= 40 && dt <= 1e3) gaps.push(dt);
      }
      if (gaps.length >= 3) {
        gaps.sort((a, b) => a - b);
        chordGapMed = gaps[Math.floor(gaps.length / 2)];
        const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        chordGapCv = m > 0 ? Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length) / m : 1;
      }
    }
    let chord2Count = 0;
    for (const h of chordHits) if (h === 2) chord2Count++;
    const chord2Ratio = chordHits.length ? chord2Count / chordHits.length : 0;
    let wSum = 0;
    for (const h of chordHits) wSum += Math.pow(h, 1.4);
    const weightedNps = wSum / durS;
    let segIvLogStd = 0;
    let segRhythmChangeRate = 0;
    {
      const ivs = [];
      let prev = -1;
      for (let i = lo; i < hi; i++) {
        const r = rows[i];
        if (r.hits === 0 || r.t < start || r.t >= end) continue;
        if (prev >= 0) ivs.push(r.t - prev);
        prev = r.t;
      }
      if (ivs.length >= 4) {
        const logs = ivs.filter((v) => v >= 25).map((v) => Math.log(v));
        if (logs.length >= 3) {
          const m = logs.reduce((a, b) => a + b, 0) / logs.length;
          const sd = Math.sqrt(logs.reduce((a, b) => a + (b - m) ** 2, 0) / logs.length);
          segIvLogStd = sd;
        }
        let changes = 0, pairs = 0;
        for (let i = 1; i < ivs.length; i++) {
          const a = ivs[i - 1], b = ivs[i];
          if (a < 25 || b < 25) continue;
          pairs++;
          const ratio = Math.max(a, b) / Math.min(a, b);
          if (ratio > 1.35) changes++;
        }
        if (pairs >= 3) segRhythmChangeRate = changes / pairs;
      }
    }
    let jackHits = 0, jackMatch = 0;
    let heldRowHits = 0, heldRowJacks = 0;
    const jackDts = [];
    const tps = ctx.map.timingPoints;
    const anchorOf = (t) => {
      let lo2 = 0, hi2 = tps.length;
      while (lo2 < hi2) {
        const m = lo2 + hi2 >> 1;
        if (tps[m].t <= t) lo2 = m + 1;
        else hi2 = m;
      }
      return tps[Math.max(0, lo2 - 1)];
    };
    const offGrid = (t) => {
      const tp = anchorOf(t);
      const grid = tp.beatLength / 4;
      if (grid <= 0) return false;
      let ph = (t - tp.t) / grid % 1;
      if (ph < 0) ph += 1;
      return Math.min(ph, 1 - ph) > 0.15;
    };
    let riceN = 0, riceOff = 0, runN = 0, runOff = 0, runCount = 0;
    const runLen = new Array(K).fill(1);
    const strictEvents = [];
    for (const h of ctx.lnHeads) {
      if (h.t + h.dur <= start || h.t >= end) continue;
      strictEvents.push({ t: Math.max(h.t, start), col: h.col, up: true });
      strictEvents.push({ t: Math.min(h.t + h.dur, end), col: h.col, up: false });
    }
    strictEvents.sort((a, b) => a.t - b.t || (a.up ? 1 : 0) - (b.up ? 1 : 0));
    const strictHeld = new Int32Array(rows.length);
    {
      let msk = 0, ei2 = 0;
      for (let i = lo; i < hi; i++) {
        const t = rows[i].t;
        while (ei2 < strictEvents.length && strictEvents[ei2].t < t) {
          const e = strictEvents[ei2];
          if (e.up) msk |= 1 << e.col;
          else msk &= ~(1 << e.col);
          ei2++;
        }
        while (ei2 < strictEvents.length && strictEvents[ei2].t === t && !strictEvents[ei2].up) {
          msk &= ~(1 << strictEvents[ei2].col);
          ei2++;
        }
        strictHeld[i] = msk;
        while (ei2 < strictEvents.length && strictEvents[ei2].t === t) {
          msk |= 1 << strictEvents[ei2].col;
          ei2++;
        }
      }
    }
    const lastIvs = [];
    let prevPlayable = -1;
    for (let i = lo; i < hi; i++) {
      const r = rows[i];
      if (r.t < start || r.t >= end || r.hits === 0) continue;
      if (prevPlayable >= 0) {
        lastIvs.push(r.t - prevPlayable);
        if (lastIvs.length > 3) lastIvs.shift();
      }
      prevPlayable = r.t;
      const rowDt = lastIvs.length ? median(lastIvs) : 0;
      const jackLimit = rowDt >= 15 && rowDt <= 400 ? rowDt * 1.35 + 10 : 0;
      const hm = strictHeld[i];
      const lockedRow = hm !== 0;
      for (let c = 0; c < K; c++) {
        const bit = 1 << c;
        if (!(r.mask & bit)) continue;
        const onHeld = (hm & bit) !== 0;
        if ((r.lnHeadMask & bit) === 0) {
          riceN++;
          if (offGrid(r.t)) riceOff++;
        }
        const arr = ctx.cols.colNotes[c];
        const p = predIdx(arr, r.t);
        let isJack = false;
        if (p >= 0 && jackLimit > 0) {
          const dt = r.t - arr[p];
          if (dt >= 20 && dt <= jackLimit) {
            isJack = true;
            jackHits++;
            if (Math.abs(dt - rowDt) <= 0.3 * rowDt) jackMatch++;
            runLen[c]++;
            if (runLen[c] === 2) runCount++;
            if (runLen[c] >= 2) {
              runN++;
              if (offGrid(r.t)) runOff++;
            }
            if (runLen[c] >= 3) jackDts.push(dt);
          } else {
            runLen[c] = 1;
          }
        } else {
          runLen[c] = 1;
        }
        if (lockedRow && !onHeld) heldRowHits++;
        if (lockedRow && !onHeld && isJack) heldRowJacks++;
      }
    }
    const medJackDt = median(jackDts);
    const allOff = riceN ? riceOff / riceN : 0;
    const jackOff = runN ? runOff / runN : 0;
    const techJackScore = 0.5 * allOff + 0.5 * (runCount >= 3 ? jackOff : allOff);
    const colLns = [];
    for (let c = 0; c < K; c++) colLns.push([]);
    for (const h of ctx.lnHeads) colLns[h.col].push(h.t, h.t + h.dur);
    const tailTimes = [];
    for (const x of ctx.lnTails) tailTimes.push(x.t);
    tailTimes.sort((x, y) => x - y);
    let longLn = 0, tailSum = 0, freeLn = 0, holdAdjW = 0;
    const tailGaps = [];
    {
      const heads = ctx.lnHeads;
      let a = 0, b = heads.length;
      while (a < b) {
        const m = a + b >> 1;
        if (heads[m].t < start) a = m + 1;
        else b = m;
      }
      for (let i = a; i < heads.length && heads[i].t < end; i++) {
        const h = heads[i];
        if (h.dur <= 100) continue;
        longLn++;
        const tt = h.t + h.dur;
        tailSum += countNear(tailTimes, tt, 10);
        {
          const arr = ctx.cols.colNotes[h.col];
          let lo2 = 0, hi2 = arr.length;
          while (lo2 < hi2) {
            const m = lo2 + hi2 >> 1;
            if (arr[m] <= tt) lo2 = m + 1;
            else hi2 = m;
          }
          tailGaps.push(lo2 < arr.length ? Math.min(arr[lo2] - tt, 4e3) : 4e3);
        }
        let free = true;
        let holdW = 0;
        for (const adj of [h.col - 1, h.col + 1]) {
          if (adj < 0 || adj >= K) continue;
          if (hasHitNear(ctx.cols.colNotes[adj], tt, 10)) free = false;
          const ivs = colLns[adj];
          for (let j = 0; j + 1 < ivs.length; j += 2) {
            if (ivs[j] < tt - 10 && ivs[j + 1] > tt + 10) {
              holdW += 1;
              break;
            }
          }
        }
        if (free) freeLn++;
        holdAdjW += holdW;
      }
    }
    return {
      rowCount,
      notes,
      lnHeadRowCount,
      lnHeadChordMean: lnHeadRowCount ? lnHeadSum / lnHeadRowCount : 0,
      lnHeadOverlapRatio: lnHeadPairs ? lnHeadOverlaps / lnHeadPairs : 0,
      lnHeadRate: lnHeadRowCount / durS,
      tailSingleRatio: tailRows ? singleTailRows / tailRows : 0,
      vibroFraction: notes ? runNoteCount.n / notes : 0,
      vibroWidth: runCols.size,
      wideSpreadRatio: notes ? Math.min(1, seenCols / 5) : 0,
      maxGapMs: maxGap,
      segIvLogStd,
      segRhythmChangeRate,
      jackHitRatio: notes ? jackHits / notes : 0,
      shortLnBodyRatio: shortLnBodyRatio(ctx, start, end),
      jackChordPerRow: rowCount ? jackHits / rowCount : 0,
      jackRunBpm: medJackDt > 0 ? Math.min(15e3 / medJackDt, 500) : 0,
      jackRowMatchRatio: jackHits ? jackMatch / jackHits : 0,
      // lockJackRatio: presses that are row-rate same-column repeats while
      // another lane is held (denominator = all presses, per research definition)
      heldJackRatio: notes ? heldRowJacks / notes : 0,
      longLnRatio: notes ? longLn / notes : 0,
      tailChordMean: longLn ? tailSum / longLn : 0,
      tailFreeRatio: longLn ? freeLn / longLn : 0,
      tailHoldAdjWeight: longLn ? holdAdjW / longLn : 0,
      tailGapMed: median(tailGaps),
      tailGapCv: tailGapCv(tailGaps),
      invHoleFrac: computeInvHoleFrac(ctx, start, end),
      offGridRatio: allOff,
      techJackScore,
      chordOverlapRatio,
      chordOverlapJaccard,
      maxLockRun,
      avgOverlapSize,
      chord2Ratio,
      weightedNps,
      chordGapMed,
      chordGapCv
    };
  }
  function shortLnBodyRatio(ctx, start, end) {
    let n = 0, short = 0;
    for (const h of ctx.lnHeads) {
      if (h.t < start) continue;
      if (h.t >= end) break;
      n++;
      if (h.dur < 90) short++;
    }
    return n ? short / n : 0;
  }
  function computeInvHoleFrac(ctx, start, end) {
    const K = ctx.map.keys;
    const dur = end - start;
    if (dur <= 0) return 0;
    let worst = 0;
    for (let c = 0; c < K; c++) {
      const marks = [];
      for (const h of ctx.lnHeads) {
        if (h.col !== c) continue;
        if (h.t + h.dur <= start) continue;
        if (h.t >= end) break;
        marks.push([Math.max(h.t, start), Math.min(h.t + h.dur, end)]);
      }
      const notes = ctx.cols.colNotes[c];
      let lo = 0, hi = notes.length;
      while (lo < hi) {
        const m = lo + hi >> 1;
        if (notes[m] < start) lo = m + 1;
        else hi = m;
      }
      for (let i = lo; i < notes.length && notes[i] < end; i++) marks.push([notes[i], notes[i]]);
      if (!marks.length) {
        worst = Math.max(worst, 1);
        continue;
      }
      marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let holeMs = 0;
      let prevEnd = marks[0][1];
      if (marks[0][0] - start > 1e3) holeMs += marks[0][0] - start;
      for (let i = 1; i < marks.length; i++) {
        const gap = marks[i][0] - prevEnd;
        if (gap > 1e3) holeMs += gap;
        if (marks[i][1] > prevEnd) prevEnd = marks[i][1];
      }
      if (end - prevEnd > 1e3) holeMs += end - prevEnd;
      worst = Math.max(worst, Math.min(1, holeMs / dur));
    }
    return worst;
  }
  function median(a) {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  }
  function predIdx(arr, t) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (arr[m] < t) lo = m + 1;
      else hi = m;
    }
    return lo - 1;
  }
  function countNear(arr, t, tol) {
    let a = 0, b = arr.length;
    while (a < b) {
      const m = a + b >> 1;
      if (arr[m] < t - tol) a = m + 1;
      else b = m;
    }
    let c = 0;
    for (let i = a; i < arr.length && arr[i] <= t + tol; i++) c++;
    return c;
  }
  function hasHitNear(arr, t, tol) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (arr[m] < t - tol) lo = m + 1;
      else hi = m;
    }
    return lo < arr.length && arr[lo] <= t + tol;
  }
  function tailGapCv(gaps) {
    if (gaps.length < 2) return 0;
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (m <= 0) return 0;
    const v = gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length;
    return Math.min(2, Math.sqrt(v) / m);
  }
  function stdevCv(a) {
    if (a.length < 2) return 0;
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    const v = a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length;
    return m > 0 ? Math.sqrt(v) / m : 0;
  }
  var MEDIAN_KEYS = [
    "nps",
    "equivBpm",
    "gridRatio",
    "rhythmSteady",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "cutFreeRatio",
    "cutDemand",
    "anchorRate",
    "trillRate",
    "altHandRate",
    "rollRate",
    "graceRate",
    "offBeatRatio",
    "lnWeightRatio",
    "lockRatio",
    "lnAreaRatio",
    "heldCoverage",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore"
  ];
  function medianOf(windows, from, to, k) {
    const vals = [];
    for (let i = from; i < to && i < windows.length; i++) vals.push(windows[i][k]);
    if (!vals.length) return 0;
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  }
  function computeMapMedians(windows) {
    const n = Math.max(1, windows.length);
    return {
      mapChordMedian: medianOf(windows, 0, n, "chordMean"),
      mapLargeMedian: medianOf(windows, 0, n, "largeChordRatio"),
      mapNpsMedian: medianOf(windows, 0, n, "nps")
    };
  }
  function medianWindowFeatures(windows, from, to, mapMedians) {
    const out = {};
    for (const k of MEDIAN_KEYS) out[k] = 0;
    for (const k of MEDIAN_KEYS) {
      out[k] = medianOf(windows, from, to, k);
    }
    return {
      ...out,
      // humans judge cut size relative to the map's own baseline, not absolutely
      ...mapMedians ?? computeMapMedians(windows)
    };
  }

  // src/classify/params.ts
  var RC_DEFAULTS = {
    vibroFracLo: 0.28,
    vibroFracHi: 0.5,
    vibroBpmLo: 125,
    vibroBpmHi: 170,
    cjMultiLo: 0.62,
    cjMultiHi: 0.88,
    cjChLo: 2.3,
    cjChHi: 2.9,
    cjJackLo: 0.18,
    cjJackHi: 0.5,
    cjOvlLo: 0.35,
    cjOvlHi: 0.68,
    mjJackLo: 0.1,
    mjJackHi: 0.38,
    mjOvlLo: 0.15,
    mjOvlHi: 0.5,
    mjBpmLo: 125,
    mjBpmHi: 185,
    dcMultiLo: 0.76,
    dcMultiHi: 0.9,
    dcLargeLo: 0.42,
    dcLargeHi: 0.72,
    dcFreeLo: 0.72,
    dcFreeHi: 0.95,
    fcMultiLo: 0.42,
    fcMultiHi: 0.78,
    fcSingleLo: 0.15,
    fcSingleHi: 0.42,
    fcBpmLo: 180,
    fcBpmHi: 215,
    spSingleLo: 0.48,
    spSingleHi: 0.75,
    spBpmW: 0.4,
    techJackLo: 0.04,
    techJackHi: 0.18,
    techSpecLo: 0.06,
    techSpecHi: 0.25,
    wildcardBase: 0.3
  };
  var LN_DEFAULTS = {
    invCovLo: 0.45,
    invCovHi: 0.72,
    invGapLo: 0.6,
    invGapHi: 0.86,
    invAreaLo: 0.5,
    invAreaHi: 0.75,
    coLockLo: 0.38,
    coLockHi: 0.64,
    teShortLo: 0.55,
    teShortHi: 0.88,
    teTailLo: 9,
    teTailHi: 16,
    relBpmHi: 155,
    relNpsHi: 21,
    denShortLo: 0.6,
    denShortHi: 0.88,
    denTailLo: 8,
    denTailHi: 15,
    denHeadChLo: 1.35,
    denHeadChHi: 2.1,
    lnWildBase: 0.26
  };

  // src/classify/scoreRc.ts
  function ss(x, lo, hi) {
    if (hi <= lo) return x >= hi ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }
  function scoreRc(inp) {
    const p = { ...RC_DEFAULTS, ...inp.params };
    const { f, extras } = inp;
    const active = f.nps > 2.5 ? 1 : ss(f.nps, 1.2, 2.5);
    const cutDemNorm = inp.cutDemandRef > 0 ? f.cutDemand / inp.cutDemandRef : 0;
    const vibro = active * ss(extras.vibroFraction, p.vibroFracLo, p.vibroFracHi) * ss(f.jackSpeedBpm, p.vibroBpmLo, p.vibroBpmHi) * (extras.vibroWidth <= 4 ? 1 : ss(7 - extras.vibroWidth, 0, 3));
    const chordjack = active * ss(f.multiRatio, p.cjMultiLo, p.cjMultiHi) * ss(f.chordMean, p.cjChLo, p.cjChHi) * ss(f.jackRowRatio, p.cjJackLo, p.cjJackHi) * (0.35 + 0.65 * ss(f.overlapDegree, p.cjOvlLo, p.cjOvlHi));
    const minijack = active * ss(f.jackRowRatio, p.mjJackLo, p.mjJackHi) * ss(f.overlapDegree, p.mjOvlLo, p.mjOvlHi) * (1 - 0.7 * ss(f.chordMean, 3.2, 4.2)) * (0.35 + 0.65 * ss(f.equivBpm, p.mjBpmLo, p.mjBpmHi));
    const denseCs = active * ss(f.multiRatio, p.dcMultiLo, p.dcMultiHi) * ss(f.largeChordRatio, p.dcLargeLo, p.dcLargeHi) * ss(f.cutFreeRatio, p.dcFreeLo, p.dcFreeHi) * (0.5 + 0.5 * ss(cutDemNorm, 0.15, 0.7));
    const fastCs = active * ss(f.multiRatio, p.fcMultiLo, p.fcMultiHi) * ss(f.singleRatio, p.fcSingleLo, p.fcSingleHi) * ss(f.cutFreeRatio, 0.75, 0.97) * (0.35 + 0.65 * ss(f.equivBpm, p.fcBpmLo, p.fcBpmHi));
    const speed = active * ss(f.singleRatio, p.spSingleLo, p.spSingleHi) * (0.6 - p.spBpmW + ss(f.equivBpm, 190, 245) * p.spBpmW + ss(f.nps, 16, 26) * 0.3);
    const techSpec = Math.max(
      extras.segRhythmChangeRate,
      f.trillRate,
      f.rollRate,
      f.altHandRate * 1.5,
      f.offBeatRatio * 1.3
    );
    const tech = active * ss(extras.segIvLogStd, 0.25, 0.55) * (0.3 + 0.7 * ss(techSpec, p.techSpecLo, p.techSpecHi)) * (0.4 + 0.6 * ss(1 - f.rhythmSteady, 0.05, 0.3)) * ss(f.nps, 2.5, 6);
    const scores = {
      vibro,
      chordjack,
      minijack,
      "dense chordstream": denseCs,
      "fast chordstream": fastCs,
      speed,
      tech,
      wildcard: active * p.wildcardBase
    };
    for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(1, scores[k]));
    return scores;
  }

  // src/classify/scoreLn.ts
  function ss2(x, lo, hi) {
    if (hi <= lo) return x >= hi ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }
  function scoreLn(inp) {
    const p = { ...LN_DEFAULTS, ...inp.params };
    const { f, extras } = inp;
    const lnPresence = ss2(f.lnWeightRatio, 0.45, 0.7);
    const inverse = lnPresence * // inverse requires lanes essentially filled: hole-y LN sections are not
    // inverse no matter how the rest of the evidence looks
    (1 - Math.min(1, extras.invHoleFrac * 4)) * ss2(f.heldCoverage, p.invCovLo, p.invCovHi) * (0.15 + 0.85 * ss2(f.invGapScore, p.invGapLo, p.invGapHi)) * (0.4 + 0.6 * ss2(f.lnAreaRatio, p.invAreaLo, p.invAreaHi)) * (1 - 0.6 * ss2(f.lockRatio, 0.25, 0.55));
    const coordination = lnPresence * ss2(f.lockRatio, p.coLockLo, p.coLockHi) * (0.5 + 0.5 * ss2(f.heldCoverage, 0.18, 0.42)) * (1 - 0.3 * ss2(f.heldCoverage, 0.7, 0.95));
    const technical = lnPresence * ss2(f.shortLnRatio, p.teShortLo, p.teShortHi) * ss2(f.tailRate, p.teTailLo, p.teTailHi) * (0.35 + 0.65 * ss2(Math.max(extras.segIvLogStd * 2, extras.segRhythmChangeRate), 0.35, 0.75)) * (1 - 0.7 * ss2(f.lockRatio, 0.12, 0.42)) * (1 - 0.4 * ss2(f.heldCoverage, 0.62, 0.85));
    const release = lnPresence * (1 - ss2(f.equivBpm, 100, p.relBpmHi)) * (1 - ss2(f.nps, 13, p.relNpsHi)) * (0.35 + 0.65 * (1 - ss2(f.rhythmSteady, 0.55, 0.85))) * (0.5 + 0.5 * ss2(extras.tailSingleRatio, 0.25, 0.55));
    const density = lnPresence * (0.22 + 0.38 * ss2(f.shortLnRatio, p.denShortLo, p.denShortHi) * ss2(f.tailRate, p.denTailLo, p.denTailHi) + 0.4 * ss2(extras.lnHeadChordMean, p.denHeadChLo, p.denHeadChHi)) * (1 - 0.45 * ss2(extras.segRhythmChangeRate, 0.3, 0.6));
    const scores = {
      inverse,
      coordination,
      technical,
      release,
      density,
      "ln wildcard": lnPresence * p.lnWildBase
    };
    for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(1, scores[k]));
    return scores;
  }

  // src/classify/featuresVec.ts
  var VEC_KEYS = [
    "nps",
    "logEquivBpm",
    "cutSizeNorm",
    "gridRatio",
    "rhythmSteady",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "jackHitRatio",
    "heldJackRatio",
    "jackChordPerRow",
    "jackRunBpm",
    "jackRowMatchRatio",
    "longLnRatio",
    "tailChordMean",
    "tailFreeRatio",
    "tailHoldAdjWeight",
    "shortLnBodyRatio",
    "invHoleFrac",
    "offGridRatio",
    "techJackScore",
    "cutFreeRatio",
    "logCutDemand",
    "anchorRate",
    "trillRate",
    "altHandRate",
    "rollRate",
    "offBeatRatio",
    "graceRate",
    "lnWeightRatio",
    "lockRatio",
    "heldCoverage",
    "lnAreaRatio",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore",
    // extras
    "lnHeadChordMean",
    "lnHeadRate",
    "tailSingleRatio",
    "vibroFraction",
    "vibroWidth",
    "wideSpreadRatio",
    "segIvLogStd",
    "segRhythmChangeRate",
    "chordOverlapRatio",
    "chordOverlapJaccard",
    "maxLockRun",
    "avgOverlapSize",
    "chord2Ratio",
    "weightedNps"
  ];
  function buildVector(f, extras, cutDemandRef) {
    return {
      nps: f.nps,
      logEquivBpm: Math.log1p(Math.max(0, f.equivBpm) / 50),
      // chord size relative to tempo: annotator rule "at lower bpm a smaller cut
      // still counts as dense" — captures dCS/fCS boundary jointly.
      cutSizeNorm: f.chordMean * (160 / Math.min(260, Math.max(90, f.equivBpm || 160))),
      gridRatio: f.gridRatio,
      rhythmSteady: f.rhythmSteady,
      chordMean: f.chordMean,
      largeChordRatio: f.largeChordRatio,
      multiRatio: f.multiRatio,
      singleRatio: f.singleRatio,
      jackRowRatio: f.jackRowRatio,
      overlapDegree: f.overlapDegree,
      jackSpeedBpm: f.jackSpeedBpm / 100,
      jackHitRatio: extras.jackHitRatio,
      heldJackRatio: extras.heldJackRatio,
      jackChordPerRow: extras.jackChordPerRow / 3,
      jackRunBpm: extras.jackRunBpm / 100,
      jackRowMatchRatio: extras.jackRowMatchRatio,
      longLnRatio: extras.longLnRatio,
      tailChordMean: extras.tailChordMean / 3,
      tailFreeRatio: extras.tailFreeRatio,
      tailHoldAdjWeight: extras.tailHoldAdjWeight / 2,
      shortLnBodyRatio: extras.shortLnBodyRatio,
      invHoleFrac: extras.invHoleFrac,
      offGridRatio: extras.offGridRatio,
      techJackScore: extras.techJackScore,
      cutFreeRatio: f.cutFreeRatio,
      logCutDemand: Math.log1p(f.cutDemand / Math.max(1, cutDemandRef)),
      anchorRate: f.anchorRate,
      trillRate: f.trillRate,
      altHandRate: f.altHandRate,
      rollRate: f.rollRate,
      offBeatRatio: f.offBeatRatio,
      graceRate: f.graceRate,
      lnWeightRatio: f.lnWeightRatio,
      lockRatio: f.lockRatio,
      heldCoverage: f.heldCoverage,
      lnAreaRatio: f.lnAreaRatio,
      tailRate: f.tailRate / 20,
      tailIndependence: f.tailIndependence,
      tailScatter: Math.min(2, f.tailScatter),
      shortLnRatio: f.shortLnRatio,
      invGapScore: f.invGapScore,
      lnHeadChordMean: extras.lnHeadChordMean,
      lnHeadRate: extras.lnHeadRate / 10,
      tailSingleRatio: extras.tailSingleRatio,
      vibroFraction: extras.vibroFraction,
      vibroWidth: extras.vibroWidth / 7,
      wideSpreadRatio: extras.wideSpreadRatio,
      segIvLogStd: extras.segIvLogStd,
      segRhythmChangeRate: extras.segRhythmChangeRate,
      chordOverlapRatio: extras.chordOverlapRatio,
      chordOverlapJaccard: extras.chordOverlapJaccard,
      maxLockRun: extras.maxLockRun / 8,
      avgOverlapSize: extras.avgOverlapSize / 3,
      chord2Ratio: extras.chord2Ratio,
      weightedNps: extras.weightedNps / 25
    };
  }

  // src/classify/model.generated.json
  var model_generated_default = { rc: { classes: ["chordjack", "dense chordstream", "fast chordstream", "minijack", "speed", "tech", "wildcard"], mean: [20.93774838995434, 1.4080974987551738, 2.1914240366760316, 0.9428981373793501, 0.9047728505549114, 2.135125524957002, 0.4640193509852115, 0.7384616476328464, 0.3892548428295238, 0.1749313535443446, 0.3436237658643697, 0.5685865327287285, 0.09375885928972184, 0.00131894588553609, 0.08704903896278011, 0.38128399027490567, 0.6639062392530343, 0.01628625953791638, 0.0828330674170041, 0.08879070240106783, 0.0029161940451753075, 0.009124992427688508, 0.2447181762705806, 0.23322288545180636, 0.2336716483837912, 0.8201089820645772, 0.43007010016086944, 0.46037071170267907, 9239807033924681e-19, 0.11886746893020556, 0.05025347629376421, 0.03815928518425371, 0.006387494746760668, 0.02017262474484937, 0.034352040479491454, 0.012432056155795635, 0.010465802987861808, 0.008374183006535944, 0.00610639680708885, 0.005829082362775315, 0.022107485299526827, 0.011029528955607036, 0.21196370109876272, 0.016064058527189583, 0.04658207007707588, 0.4347897581044773, 0.6751867413632097, 0.9985294117647026, 0.3355506613281114, 0.22125833940306475, 0.18376148063492448, 0.08235852970854024, 0.4648692810457504, 0.44651437060431864, 0.2659941553302713, 1.2010059101611925], std: [9.181886191066749, 0.4202068551252959, 1.2934606024495643, 0.22482493974973877, 0.21566483288699292, 0.7790262997355679, 0.2966722209852889, 0.27703992425212104, 0.3052272695380964, 0.2563545624583077, 0.3684423947809091, 0.25120946851322623, 0.13541507427563376, 0.013070398959398552, 0.16074159436203317, 0.5362603558437544, 0.43651095557819475, 0.0764787430824936, 0.26521568389214484, 0.26192757580134235, 0.030560007380948353, 0.08032078635067129, 0.3130880970139673, 0.3452014041820118, 0.35102493271700824, 0.2655197184600404, 0.2428473213721715, 0.28251112317011096, 0.023618187965021388, 0.19303825208268258, 0.15249938204732497, 0.13557493015228117, 0.0371712088554391, 0.10280477789455703, 0.16557076315505753, 0.05782422417271025, 0.04748186083697971, 0.0491069313440768, 0.05791289350157722, 0.04124740260298424, 0.13946490453469046, 0.07353220315536717, 0.6644342245234114, 0.06981536470505975, 0.1916448780333269, 0.31905448147980114, 0.37533749226731916, 0.029668001473282305, 0.2186480723780999, 0.1977957881135459, 0.23621557542828178, 0.12149826275668694, 1.0153370963315904, 0.28630106829735574, 0.18587684793965256, 0.597515807979952], W: [-0.11281779061822943, -0.1392633451559788, 0.23541388960450754, 0.2973549693062095, 0.07725064495728294, -0.11591181820101619, -0.053459121901487244, -0.10752925172531122, -0.10649833691336684, 0.1845561648626616, 0.25695345704461603, -0.21015717589290123, 0.4112642302862858, -0.109120887067381, 0.22756313663341485, 0.20084862951287888, 0.302933726262374, 0.20087787054952516, 0.07912037800770207, 0.06996569769779942, 0.19096942596946517, -0.02092651613213297, 0.10238509104189875, 0.13142181998695768, 0.13334556807163167, -0.1976241892872756, 0.7285948122733158, -0.6451267869509192, 0.0013242352573720336, -0.08102031126022896, -0.1688425822974419, 0.5441337254156035, 0.02559328854199168, 0.004297322375617219, 0.012774106157057286, -0.1394397679378785, -0.19598492567675138, 0.06277637893189968, -0.05340905389615265, 0.06794453320508406, 0.23408387690711302, 0.17262129880698146, 0.061736333908749566, 0.057474758005859584, 0.14289634721599498, -0.09500654755474262, -0.030797622223572147, 0.08768285474678499, -0.4583827067060617, -0.38577440530877, 0.24405603995388134, 0.06917191739891904, -0.04227926733244097, 0.19321295451298182, 0.12503029156743264, 0.07876252639208031, 0.2978421081392673, -0.24839843909618362, 0.2811363673074207, -0.035124798624274214, -0.37069410233448513, 0.3971094223259367, 0.17799541499577298, -0.10100267151812879, -0.20029236937727313, -0.24588650987718505, -0.28832570840406274, 0.2996850915867223, -0.08800414225683471, 0.14280100415099853, 0.022497590286543655, 0.02994699254130813, -0.07324069710973151, -0.0652777509403595, -0.02565340573712316, -0.003909181845370043, -0.17301993626507767, 0.07901951517348317, 0.5969920864438635, 0.24482465027824868, 0.2624548827022429, 0.27183194758278967, -0.3672886578426847, 0.18550623263006746, -0.057589732151321335, 0.06506711219704807, -0.23091038398355984, -0.4783846211139561, -0.02861528677787629, 0.16058967810605362, 0.059610753531296204, -0.004381951686723081, -0.07036685518188207, 0.07382002352135333, -0.015953698318197245, 0.0344581675750286, 0.022354316084196003, -0.06029477482438648, 0.007681403449231488, 0.13935184522010519, -0.10978357011311386, 0.23217320922621326, -0.37763328294401227, -0.010514274127988738, -0.18911221483313828, 0.040440285329577184, -0.1991921527365222, 0.033271824468392525, 0.06795179836223177, 0.13496101620785994, -0.03439034318173883, 0.5280481989000204, -0.07740147702385074, -0.0021802974352554934, -0.23580956635534658, -0.236709064068437, 0.0019315049769862104, -0.06328576963389301, 0.24799790874516664, 0.2217647052936303, -0.1652413563780953, -0.02213065101391793, -0.420060284870252, -0.20781370717700484, -0.14665697251624651, -0.16610027769983796, -0.19816805794818665, -0.1333578408398787, -0.25274137878015734, 0.09055665669089116, 0.09655249495094886, 0.1239025358780989, 0.196831912923072, 0.1244186882113548, 0.03853670982563939, -0.5106159208638094, -0.48298196262524107, -0.0828224257912376, -0.16887482456768713, 0.05950622681271993, -0.011597718536621903, 0.21014246639099063, -0.3263400405709306, -0.2922667272453767, 0.09921830342791352, -0.20292455647886012, 0.2191292543331272, 0.1555830877197135, 0.26939841302447504, -0.12439021573627497, -0.055461141955499234, -0.06047683751090291, 0.10960179473098504, -0.01113912672160206, 0.026396687607151234, 0.1187729105316505, -0.09034387659138884, 0.5186249557684731, -0.10874688180415412, -0.12933160778264835, 0.17763503992837512, -0.1277485771876028, 0.024818686588251856, 0.027763106476622813, 0.07756996979596488, 0.09189541110155212, 0.023520154820347763, -0.11597477836429199, -0.17695932215603005, -0.1136090905481436, 0.10862118671668532, -0.23260457159255218, 0.24767881139644307, 0.3739372050246205, 0.021134194556443404, 0.033021298714894134, -0.2918883669529386, 0.15126004125365597, 0.08835687886367154, 0.5666786048469167, -0.11396704685431429, -0.2083145381505132, -0.08975133369190752, 0.44239193667852, 0.10753169885831809, -0.08963292355734644, 0.08463217009135818, 0.11199876148791958, -0.12812281089950683, -0.1345411855397059, -0.18245723910121991, -0.28193680671494015, -0.21571652131843794, -0.11462842153726807, 0.26353658073630676, 0.08223158227592149, 0.002871459375200859, 0.04494452526241003, -0.17951437146025534, -0.17350349381326186, -0.06877873822658553, 0.09783122635915047, -0.22859753368127958, 0.19444373434873916, 0.1872564619414392, 0.09157695670094124, 0.12954181487510052, -0.06814769541176492, -0.20436535520026983, -0.005763443852793948, 0.21746483444566, -0.093009701828685, 0.22476518562379355, -0.757192110172828, -0.09235862373539139, 0.08978465711081426, -0.31424412131586477, -0.009655921654276867, 0.1393110595772085, 0.07619071983604656, -0.18417910215181404, -0.5562961709547659, -0.0035936415025293145, -0.017931391257151617, 0.09652082639593475, 0.3649583822334789, -0.1469045427114981, 0.053366886284030586, 4827459133347083e-20, -0.18915166401274852, -0.4058503594715235, -0.006396972274225326, 0.17570401337517566, 0.16512953644368616, -0.03746866287450656, -0.14722073927115603, -0.17770903920967449, 0.22009123346697076, 0.036837255758299124, -0.2976488240261254, -0.2281961241806814, -0.06976785614173604, 0.003113079936800103, -0.18736092288737677, -0.05750839516646914, -0.06919764236837778, 0.13668008019312772, 0.36193651924200015, 0.36112895774831505, -0.14775088336873882, -0.6201355402408327, 0.40712325691732293, 0.03727131235953444, -0.08041495475472489, 0.22798992064965767, 0.4012750473538711, -0.027952176089621944, 0.008870288172278772, 0.12962320904612584, -0.028731849823358784, -0.0011436599555895795, -0.0602129435732264, -0.048451510462888904, 0.049707301182298484, -0.1411106097184829, -0.09043044694112623, -0.054968254812264125, -0.11981700154821551, -0.2506000315179192, 0.07620939713290777, -0.18679408038167586, -0.04451452099527746, 0.09115960596058269, -0.3671655756297953, 0.01174651620880332, -0.039838305220031296, -0.10692114052973498, 0.15314565625796928, 0.03818697830999922, -0.2516322076379783, 0.07628010686882401, 0.22593853823002666, -0.10789651476386082, 0.1702479566970622, -0.22350270927587831, -0.308877300647033, -0.33208651604069983, -0.150223227715324, 0.3311588403105332, -0.20025538525410663, 0.359012908773347, 0.09573574128427673, 0.07520020428684067, 0.1462124781748106, -0.012337939140700006, 0.27493194046900754, -0.07233094187184286, -0.09069598632389517, -0.08529287784181333, 0.04890320929270542, -0.05158594074062084, 0.04099391581093745, -0.3660914602678893, 0.15395699721574557, 0.053269682576109256, 0.24172001777008606, -0.10721949368901139, -0.17690357866259585, 0.008078268070255232, 0.4252623404838714, 0.1152448413373059, 0.28769000820628815, 0.1997658547657003, -0.1096373915788308, -0.1554713786880494, -0.1631933860064374, -0.16756839582412034, -0.07495652424082336, -0.020285952531865502, -0.045388548977797684, -0.051648328596470436, -0.032955493808473915, -0.11344004635929564, -0.05529445040116172, 0.0943018675138794, -0.26354858255153, 0.16469751219973533, 0.029324855370068865, 0.5130920717256064, 0.3096745135418567, -0.20890010542981652, -0.11150757958765305, 0.09088678522636108, 0.10183372048681946, 0.1800554913779259, -0.13993162319966682, -0.1034644516059156, -0.08744574822794379, -0.13456081979790804, -0.016531378002038598, 0.2672875756883169, -0.093820074855866, 0.3442684791163275, 0.11036611922446493, 0.2570575759359646, -0.032673196414794145, 0.0415314114671868, -0.39690781537685327, 0.03987276626394297, -0.025569012875047394, 0.013359348102536764, -0.5171128343357114, 0.21604371682172127, 0.023939989722920853, -0.15247183940787262, -0.1635000996237769, 0.022435744179137334, -0.019766775155558847, -0.32604526813542006, -0.09958725914420369, -0.11150060715461887, 0.029273954631644238, 0.2713871233305933, 0.0876630669774818, 0.01964217562558065, -0.5839811783193662, 0.5623726163252236, -0.2889439388031684, -0.19923124564152156, 0.040973433044590925, -0.0370684106982777, -0.014279866614055392, -0.02159103832757063, 0.03138632439613035, 0.06401954228950352, 0.021903079938054248, 0.03108430579292893, 0.027961987341401144, -0.1448709582392325, -0.04747835997955303, -0.011235922131245746, 0.28873967815150525, 0.6316329788890699, -0.022431964321753418, 0.1798523252404994, 0.5402296809090112, -0.011840044161806495, -0.055051683372296295, 0.0969709566294323, -0.11875258761241698, -0.3288089313914372, -0.08134072483301225], b: [-0.10887388993600251, 0.7669278338472332, 0.019152284989763346, -0.15373585138642026, 0.25434888460891064, 0.02402177012380764, -0.8018410322472921], keys: ["nps", "logEquivBpm", "cutSizeNorm", "gridRatio", "rhythmSteady", "chordMean", "largeChordRatio", "multiRatio", "singleRatio", "jackRowRatio", "overlapDegree", "jackSpeedBpm", "jackHitRatio", "heldJackRatio", "jackChordPerRow", "jackRunBpm", "jackRowMatchRatio", "longLnRatio", "tailChordMean", "tailFreeRatio", "tailHoldAdjWeight", "shortLnBodyRatio", "invHoleFrac", "offGridRatio", "techJackScore", "cutFreeRatio", "logCutDemand", "anchorRate", "trillRate", "altHandRate", "rollRate", "offBeatRatio", "graceRate", "lnWeightRatio", "lockRatio", "heldCoverage", "lnAreaRatio", "tailRate", "tailIndependence", "tailScatter", "shortLnRatio", "invGapScore", "lnHeadChordMean", "lnHeadRate", "tailSingleRatio", "vibroFraction", "vibroWidth", "wideSpreadRatio", "segIvLogStd", "segRhythmChangeRate", "chordOverlapRatio", "chordOverlapJaccard", "maxLockRun", "avgOverlapSize", "chord2Ratio", "weightedNps"] }, ln: { classes: ["coordination", "density", "inverse", "ln wildcard", "release", "technical"], mean: [15.972709210533452, 1.0923710703776033, 2.5498025283167047, 0.8159490285789012, 0.6517508204080409, 2.142748428885941, 0.46349554834915074, 0.7668524552330663, 0.3670087427509474, 0.08497744026273657, 0.16515687230756754, 0.36000521501957317, 0.0894029667379305, 0.05637386719172953, 0.07737407390095295, 0.32407891774181286, 0.7032609153996814, 0.56045445852904, 0.743785024089873, 0.6623329711645859, 0.202011608269886, 0.18794808566930513, 0.23031219161622682, 0.2287301690768112, 0.2504976976402478, 0.770247833229595, 0.40734296580687374, 0.28754268548061224, 0, 0.06801014763066617, 0.024414526716691174, 0.10929418135470344, 0.003339442805426711, 0.8187654853479378, 0.2947432663094991, 0.4867968410085562, 0.5003151570703518, 0.5933564799139865, 0.3597656081006826, 0.5019636893365831, 0.610804303844713, 0.5500215671958975, 1.8409430698848972, 0.6440958944730771, 0.4185918120352241, 0.28173054248125246, 0.4577280802591697, 0.9976591075347727, 0.3441398906317693, 0.24043486422603422, 0.20614721014366094, 0.07902949325192737, 0.429407461594736, 0.4310434274386964, 0.27982382098889513, 0.9236890246994582], std: [8.964356418729299, 0.5897303258238599, 1.3013697273224998, 0.3809410095679509, 0.44335756559607875, 0.6735276311559297, 0.2936637946231972, 0.25585433429091503, 0.28550505660552516, 0.18372871059365425, 0.307768096900298, 0.2994556840619319, 0.11030490829351562, 0.08768868829261041, 0.11899193717260889, 0.4813017699096504, 0.4266597958210613, 0.2665412569352661, 0.2639194987172153, 0.2422204923111378, 0.1770330353417038, 0.24849235502673822, 0.308628405540351, 0.37674209107225515, 0.37744117406927735, 0.3604613300334198, 0.2808505984344401, 0.2791535307764144, 1e-6, 0.16758497461665722, 0.11368237408558736, 0.28424388663716116, 0.029200926667748952, 0.21869468155646854, 0.3140935589145856, 0.20537041620838742, 0.24044043222302516, 0.4056577982823191, 0.20959509703065382, 0.257177614883311, 0.36530440498608024, 0.2608787412555152, 0.6137293206666724, 0.4456264497830043, 0.31561763047950386, 0.30749473674398625, 0.43281862911790925, 0.028527751143481727, 0.21180949001936877, 0.19034393430007804, 0.22180113461803805, 0.09449213050404882, 0.6330951650122412, 0.23122060874529352, 0.18194252177986717, 0.536298314587527], W: [0.05105452731083738, 0.13615445199589762, 0.009753207832122208, 0.1236094283620807, -0.14288207455387242, 0.0763955698397503, 0.1123490554280606, 0.05308476540148476, -0.2006332472929359, 0.1339493150899519, 0.35159002448941307, 0.012991586540062034, 0.16654209078816146, 0.20283727562941586, 0.09786942550248749, -0.062266067217413915, 0.08863541035871249, 0.1716746380532528, 0.2059847452603893, -0.3793858091401414, -0.40891052864863836, -0.08467197617452239, -0.2247183714853586, -0.2895216829444947, -0.41469076352991496, 0.2710819811222212, 0.03603056739463045, -0.3805931713844531, 0, -0.012502278261808473, -0.0021503455144078545, 0.3301176692700385, -0.30587196332699523, -0.2739519790681863, 0.13374661768325224, -0.2309759116617263, -0.0814605880957565, -0.2574487123175539, 0.38148663894937435, 0.1161705798042186, -0.12152799423775558, -0.1317173228328198, -0.04926154374111001, -0.26533822358446224, -0.12851777133591546, -0.10355371090499974, 0.09877513087347736, 0.13712170624690043, 0.05957645703954457, -0.11944032210417015, 0.1640162467646904, -0.16741299524305817, 0.08735225020673432, -0.2880028723980621, 0.08713250084149426, 0.02396476148112601, -0.0800007600219727, 0.06816254069599084, 0.16420865038423968, 0.13701041274663311, 0.11450989446216502, 0.33171784063015614, 0.2124312780814256, 0.17071080115404502, 0.0035315979046685745, 0.047165498191124665, -0.44980074033805956, 0.010395852144262446, -0.011445806855275934, 0.011633232122204159, 0.07981668210428752, 0.15469561216853514, 0.00751613462145558, -0.2130670739671315, 0.23728400409972553, -0.26882138605688055, -0.18971398847799273, -0.023956486921209393, 0.09376498408125498, 0.041851926608205366, -0.03737978094689256, 0.34929604734184166, -0.3289482602918475, 0.3692393778070024, 0, 0.027095054853906314, 0.011249281609127122, -0.5894779081883857, 0.29228629752697, -0.10828331163497258, 0.3294016526375409, -0.1633358131148588, -0.12016769477186542, -0.032018082613000654, 0.14799973857677406, 0.10527593315821476, 0.09528977120015802, -0.036558655216672196, -0.13338368392912897, -0.04737935567379809, -0.04614304686830644, -0.07005203096141244, -0.19701703635734183, -0.12476779749100758, 0.1262644526799178, -0.110518559163413, -0.14367601295156276, -0.2677928208287168, 0.08213799128375301, 0.3148759862484422, -0.05395016880210348, 0.0922656446623978, 0.03832497130188643, -0.1087386305373548, -0.08370985300645577, -0.11829713393537263, -0.07965859251331939, -0.025092673813921194, -0.2796631281789168, -0.24502901908790203, 0.06964064845341239, -0.057101170877972264, -0.03842044591221056, 0.07978126285271998, -0.15048072142392271, -0.03379391887762717, -0.12046350668252652, 0.15145145362809867, -0.07962544988445501, 0.12167447652270162, 0.6124009976136844, 0.16163682034590146, 0.6262324844562808, -0.18826335959309837, 0.4754121395068967, -0.14831526434109585, 0.19514939707863116, -0.16979586293000293, 0.120600975353191, -0.03142738612078493, 0, 0.25758406976950576, 0.1283324061059421, 0.37516946781592797, -0.0784887066887074, -0.023684485750657097, 0.08432899248872504, 0.5337276550652109, 0.6241267310278348, 0.25184850217361326, 0.11323697126211468, -0.26090991981999556, -0.354601060338413, 0.4727936072375938, 0.12207781998360671, 0.07534266446177552, 0.4609394841582948, 0.10708838233434605, -0.08743011139977386, -0.162189481348484, -0.2652873873207766, -0.03397093570750794, -0.18237709248725775, 0.0922587888633575, -0.0693625258827298, 0.23740123684931388, -0.03134746635924755, 0.045724802379521375, 0.287964570554874, 0.06517366391329295, -0.0716841524986478, -0.09632503874395497, -0.020250504414171762, -0.1449324012090893, -0.15791455272124583, -0.07606971509360941, 0.15511532418892027, 0.09958666298230294, -0.23161424949200451, 0.10643268335906336, -0.05412952159360003, -0.034387914571814955, 0.0441262250191749, -0.430231782488165, -0.05358151245786507, -0.060932600740772724, -0.26927637874715127, 0.5327292135326305, 0.2290008131178005, 0.17097880927090575, -0.19500523826105717, 0.06742560286410489, 0.014455229751874117, -0.18249952585746965, -0.19290223073739307, 0.1987738332336329, 0, -0.07724412113694262, 0.09180212725606404, -0.07492253135527466, 0.07642769084918762, -0.13378886221600345, 0.0732870947608196, 0.23481365483236336, 0.008649801735378894, -0.08571198186000953, -0.3098131517860218, -0.2559966899023739, 0.07347379884693506, 0.12736668146217348, -0.1353975425502181, 0.18857757934154196, -0.18750386848365416, 0.450995062241002, 0.11489887894839833, 0.023181717494873463, 0.11401749042325232, 0.23222004728663012, 0.06567098927782147, 0.04073554680845086, -0.03615335781166415, -0.2500993370626585, 0.01668334849045055, 0.05985020044772397, -0.3937912194289597, -0.3384469771821769, 0.13774922689113006, -0.17979179751636687, 0.017942847144341936, 0.00850397357340041, 0.11029698177025513, 0.0892273341612643, -0.06432701318440631, 0.01196138025170388, -0.13472487271673636, -0.324184527975751, -0.11818952096650853, -0.26948317325736987, -0.15323811561761855, 0.02572337275741769, -0.12106570766610761, 0.18275543887459725, -0.6799064058906248, -0.006507036077687273, 0.1642323865409963, 0.026712131322030506, -0.09929577851901188, -0.09790966311755538, -0.13791632722140335, 0.00560015762114517, 0.5319379019380989, -0.13179097878950477, 0, -0.16001678763096183, 0.07097149001169731, 0.006451273152772867, 0.049723944311750694, 0.4063451119034303, -0.2817434389639062, -0.005571997729548492, -0.022747533117600426, -0.036301482811088144, -0.11138575535061514, 0.1731413030460878, 0.0070902652976213235, -0.2391627735837154, 0.09070405092959395, -0.15228839398830865, 0.009440458227031247, -0.11759630160166647, -0.23388387488291854, 0.1886780289614109, -0.260688152413479, 0.05909115437956577, 0.033359007397682106, 0.2272185216401458, -0.10277277612339376, -0.06096997164455401, -0.03757460134886147, -0.4382209421595358, 0.0964479102833346, 0.17769495111435005, -0.15631707960238853, 0.13379412908698105, 0.1103384298748565, -0.24659230902029675, 0.002500365620421401, 0.00807583346471717, 0.0366726899303409, -0.23556168563711102, 0.5029702839695975, 0.11458314307964274, 0.16770348005114552, 0.12319449895519165, 0.051889289674195226, 0.16062741115152748, 0.15812112502825948, -0.20210487874264735, -0.10648696233602242, -0.03965180260382248, -0.42084116698844565, 0.09920088209589376, -0.05015773532272349, 0.4264690809308368, 0.3803822448677054, -0.27368279729773565, -0.16671895365667977, -0.024201674745892313, 0, -0.03491593759369932, -0.30020495946842307, -0.047337970695079994, -0.0340772626722056, 0.13336352676638902, -0.33902091860643185, -0.36865758739144094, -0.40840071677799167, 0.159631757428039, -0.2215244416516259, 0.12231879371384816, 0.3002752192314544, -0.19272153706655978, 0.10526089930725652, 0.20108572944325148, -0.10821525569745011, -0.2668814011072695, 0.30465701281815794, -0.06202417386369325, 0.22611713959154076, -0.02738138469110479, 0.06300686199862603, 0.07499295875982075, 0.038798418327300375, 0.04679495800751869, 0.019056387178267756, 0.21641553318876638], b: [0.2080768452866238, 0.5230130241461083, 0.09054630653356746, -0.9365705008910924, 0.3532087855775399, -0.23827446065274693], keys: ["nps", "logEquivBpm", "cutSizeNorm", "gridRatio", "rhythmSteady", "chordMean", "largeChordRatio", "multiRatio", "singleRatio", "jackRowRatio", "overlapDegree", "jackSpeedBpm", "jackHitRatio", "heldJackRatio", "jackChordPerRow", "jackRunBpm", "jackRowMatchRatio", "longLnRatio", "tailChordMean", "tailFreeRatio", "tailHoldAdjWeight", "shortLnBodyRatio", "invHoleFrac", "offGridRatio", "techJackScore", "cutFreeRatio", "logCutDemand", "anchorRate", "trillRate", "altHandRate", "rollRate", "offBeatRatio", "graceRate", "lnWeightRatio", "lockRatio", "heldCoverage", "lnAreaRatio", "tailRate", "tailIndependence", "tailScatter", "shortLnRatio", "invGapScore", "lnHeadChordMean", "lnHeadRate", "tailSingleRatio", "vibroFraction", "vibroWidth", "wideSpreadRatio", "segIvLogStd", "segRhythmChangeRate", "chordOverlapRatio", "chordOverlapJaccard", "maxLockRun", "avgOverlapSize", "chord2Ratio", "weightedNps"] }, version: 1 };

  // src/classify/pipeline.ts
  var MODEL = model_generated_default;
  function modelScores(fam, f, extras, cutDemandRef) {
    if(fam==="ln"&&extras.__spmLnAdapter)return extras.__spmLnAdapter;
    const m = MODEL[fam];
    const vec = buildVector(f, extras, cutDemandRef);
    const x = VEC_KEYS.map((k) => vec[k]);
    const D = m.mean.length;
    const K = m.classes.length;
    const out = {};
    let max = -Infinity;
    const z = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      let acc = m.b[k];
      for (let j = 0; j < D; j++) acc += m.W[k * D + j] * (x[j] - m.mean[j]) / m.std[j];
      z[k] = acc;
      if (acc > max) max = acc;
    }
    let sum = 0;
    for (let k = 0; k < K; k++) {
      z[k] = Math.exp(z[k] - max);
      sum += z[k];
    }
    for (let k = 0; k < K; k++) out[m.classes[k]] = z[k] / sum;
    return out;
  }
  function classifySegments(cm, opts = {}) {
    const out = [];
    const lnDom = opts.lnDominantRatio ?? CONFIG.lnDominantRatio;
    const mapMeds = computeMapMedians(cm.windows);
    const segF = cm.rawSegs.map((s, i) => cm.extras[i].rowCount ? medianWindowFeatures(cm.windows, s.windowRange[0], s.windowRange[1], mapMeds) : null);
    const npsAll = segF.filter((f) => f !== null).map((f) => f.nps).sort((a, b) => a - b);
    const mapNps = npsAll.length ? npsAll[Math.floor(npsAll.length / 2)] : 0;
    for (let i = 0; i < cm.rawSegs.length; i++) {
      const s = cm.rawSegs[i];
      if (s.family0 === "break" || cm.extras[i].rowCount === 0) {
        out.push({ start: s.start, end: s.end, tag: "break", confidence: 1, family: "break" });
        continue;
      }
      const f = segF[i];
      const ex = cm.extras[i];
      const lowStakes = s.end - s.start >= 2500 && f.nps < mapNps && (f.nps < 18.5 && ex.segIvLogStd > 0.41 || f.chordMean < 1.9 && ex.vibroFraction > 0.3 && ex.segRhythmChangeRate < 0.1 || f.nps < 22.5 && ex.segIvLogStd > 0.25 && ex.vibroFraction < 0.45 && f.lnWeightRatio < 0.5);
      if (lowStakes) {
        out.push({ start: s.start, end: s.end, tag: "break", confidence: 1, family: "break" });
        continue;
      }
      const extras = cm.extras[i];
      const lnDominant = f.lnWeightRatio >= lnDom || f.lockRatio >= 0.5 && f.heldCoverage >= 0.15 && f.lnWeightRatio >= 0.2;
      let tag;
      let secondary;
      let confidence;
      let scores;
      const scorer = opts.scorer ?? "model";
      void scorer;
      if (lnDominant) {
        const rule = scoreLn({ f, extras, params: opts.lnParams });
        if (scorer === "rules") scores = rule;
        else {
          const mdl = modelScores("ln", f, extras, cm.cutDemandRef);
          scores = blendScores(mdl, rule, scorer);
        }
      } else {
        const rule = scoreRc({ f, extras, cutDemandRef: cm.cutDemandRef, params: opts.rcParams });
        if (scorer === "rules") scores = rule;
        else {
          const mdl = modelScores("rc", f, extras, cm.cutDemandRef);
          scores = blendScores(mdl, rule, scorer);
        }
      }
      const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      tag = ranked[0][0];
      confidence = ranked[0][1];
      const demote = opts.wildcardDemote ?? 0.3;
      if ((tag === "wildcard" || tag === "ln wildcard") && ranked.length > 1) {
        for (const r of ranked.slice(1)) {
          if (r[0] !== "wildcard" && r[0] !== "ln wildcard" && r[1] > demote) {
            tag = r[0];
            confidence = r[1];
            break;
          }
        }
      }
      const margin = opts.secondaryMargin ?? CONFIG.secondaryMargin;
      if (ranked.length > 1 && ranked[1][1] >= ranked[0][1] * margin && ranked[1][1] > 0.3) {
        secondary = ranked[1][0];
      }
      out.push({
        start: s.start,
        end: s.end,
        tag,
        secondary,
        equivBpm: equivBpmFor(tag, f, extras),
        confidence: Math.min(1, confidence),
        family: lnDominant ? "ln" : "rc",
        scores
      });
    }
    const medians = out.map((_, i) => segF[i] ?? medianWindowFeatures(cm.windows, cm.rawSegs[i].windowRange[0], cm.rawSegs[i].windowRange[1], mapMeds));
    const diffs = out.map((seg, i) => {
      if (seg.family === "break") return Infinity;
      return medians[i].nps * (0.5 + medians[i].chordMean / 3) * (0.6 + medians[i].jackSpeedBpm / 150);
    });
    const finite = diffs.filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
    const p15 = finite.length ? finite[Math.floor(finite.length * 0.15)] : Infinity;
    const allNps = medians.map((m) => m.nps).sort((a, b) => a - b);
    const medNps = allNps[Math.floor(allNps.length / 2)] ?? 0;
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      if (seg.family === "break") continue;
      const dur = seg.end - seg.start;
      const easyAmbiguous = seg.confidence < 0.5 && diffs[i] <= Math.max(p15, 1) && (medians[i].nps ?? 0) < mapNps;
      const shortSparse = dur < 2e4 && medians[i].nps > 0 && medians[i].nps < medNps * 0.4 && medians[i].nps < 4;
      if (easyAmbiguous || shortSparse) {
        seg.tag = "break";
        seg.secondary = void 0;
        seg.family = "break";
        seg.equivBpm = void 0;
      }
    }
    return out;
  }
  function blendScores(mdl, rule, mode) {
    const out = {};
    const keys = /* @__PURE__ */ new Set([...Object.keys(mdl), ...Object.keys(rule)]);
    for (const k of keys) {
      if (k === "vibro") {
        out[k] = Math.min(1, (rule[k] ?? 0) * 2);
        continue;
      }
      if (k === "wildcard" || k === "ln wildcard") {
        out[k] = (rule[k] ?? 0) * 0.6;
        continue;
      }
      if (mode === "model") out[k] = (mdl[k] ?? 0) * 1.4;
      else out[k] = 0.5 * ((mdl[k] ?? 0) + (rule[k] ?? 0));
    }
    return out;
  }
  function equivBpmFor(tag, f, ex) {
    if (tag === "chordjack" || tag === "minijack") {
      if (ex && ex.chordGapMed > 0) {
        if (ex.chordGapCv <= 0.6) return Math.round(15e3 / ex.chordGapMed);
        return void 0;
      }
      return f.jackSpeedBpm > 0 ? Math.round(f.jackSpeedBpm) : void 0;
    }
    if (tag === "dense chordstream" || tag === "fast chordstream" || tag === "speed" || tag === "tech" || tag === "wildcard" || tag === "coordination" || tag === "density") {
      return f.equivBpm > 0 ? Math.round(f.equivBpm) : void 0;
    }
    return void 0;
  }

  // src/classify/smooth.ts
  function smoothSegments(segments) {
    const minDisplay = CONFIG.minSegLenMs * 0.6;
    const out = [];
    for (const seg of segments) {
      const last = out[out.length - 1];
      if (last && last.tag === seg.tag && last.secondary === seg.secondary && last.family === seg.family && seg.end - seg.start < minDisplay) {
        last.end = seg.end;
        continue;
      }
      out.push(seg);
    }
    const out2 = [];
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      const prev = out2[out2.length - 1];
      const next = out[i + 1];
      if (seg.family === "break" && seg.end - seg.start < minDisplay && prev && next && next.tag === prev.tag) {
        prev.end = seg.end;
        continue;
      }
      out2.push(seg);
    }
    return out2;
  }

  // src/aggregate/overall.ts
  var NON_AGGR = /* @__PURE__ */ new Set([
    "break",
    "rc mix",
    "ln mix",
    "hybrid",
    "wildcard",
    "ln wildcard"
  ]);
  function aggregateOverall(segments, params = {}) {
    const dominantShare = params.dominantShare ?? CONFIG.overallDominantShare;
    const mixShare = params.mixShare ?? CONFIG.overallMixShare;
    const secondRel = params.secondRel ?? 0.75;
    const weights = {};
    let lnW = 0;
    let rcW = 0;
    const famTags = { rc: /* @__PURE__ */ new Set(), ln: /* @__PURE__ */ new Set() };
    let total = 0;
    for (const seg of segments) {
      if (seg.family === "break") continue;
      const durS = Math.max(0.5, (seg.end - seg.start) / 1e3);
      if (seg.family === "rc") {
        rcW += durS;
        if (!NON_AGGR.has(seg.tag)) famTags.rc.add(seg.tag);
      } else if (seg.family === "ln") {
        lnW += durS;
        if (!NON_AGGR.has(seg.tag)) famTags.ln.add(seg.tag);
      }
      if (NON_AGGR.has(seg.tag)) continue;
      total += durS;
      const t = seg.tag;
      weights[t] = (weights[t] ?? 0) + durS * Math.max(0.4, seg.confidence);
    }
    if (total <= 0) return { tags: [], sort: "rc", weights };
    const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const topShare = entries.length ? entries[0][1] / total : 0;
    const shares = entries.map(([t, w]) => [t, w / total]);
    const significant = shares.filter(([, s]) => s >= mixShare);
    const lnRatioW = lnW / Math.max(1, lnW + rcW);
    const sort = lnRatioW < 0.18 ? "rc" : lnRatioW > 0.68 ? "ln" : "hb";
    let tags;
    const allFamCount = famTags.rc.size + famTags.ln.size;
    if (significant.length >= 3 && allFamCount >= 3 && topShare < dominantShare) {
      if (sort === "rc") tags = ["rc mix"];
      else if (sort === "ln") tags = ["ln mix"];
      else tags = ["hybrid"];
    } else if (entries.length >= 2 && shares[1][1] >= secondRel * topShare && topShare < 0.55) {
      tags = [entries[0][0], entries[1][0]];
    } else if (entries.length) {
      tags = [entries[0][0]];
    } else {
      tags = [];
    }
    return { tags, sort, weights };
  }

  // src/index.ts
  function rescale(map, rate) {
    return {
      ...map,
      notes: map.notes.map((n) => ({
        t: Math.round(n.t / rate),
        col: n.col,
        lnEnd: n.lnEnd != null ? Math.round(n.lnEnd / rate) : null
      })),
      timingPoints: map.timingPoints.map((tp) => ({ t: Math.round(tp.t / rate), beatLength: tp.beatLength / rate })),
      breaks: map.breaks.map(([a, b]) => [Math.round(a / rate), Math.round(b / rate)]),
      firstNote: Math.round(map.firstNote / rate),
      lastNote: Math.round(map.lastNote / rate)
    };
  }
  function buildCachedMap(osuText, opts = {}) {
    let map = parseOsu(osuText);
    const rate = opts.speedRate ?? 1;
    if (rate !== 1) map = rescale(map, rate);
    const rows = buildRows(map);
    attachTails(map, rows);
    const cols = buildColumnData(map);
    const held = computeHeld(map, rows);
    const ctx = buildFeatureContext(map, rows, held, cols);
    const windows = computeAllWindows(ctx);
    const norm = normalizeWindows(windows);
    const activeCut = windows.map((w) => w.cutDemand).filter((v) => v > 0).sort((a, b) => a - b);
    const cutDemandRef = activeCut.length ? activeCut[Math.floor(activeCut.length * 0.8)] : 1;
    const rawSegs0 = segmentMap({ map, rows, windows, norm });
    const marks = markBreaks(map, rows, rawSegs0);
    const rawSegs = rawSegs0.map((s, i) => ({
      start: s.start,
      end: s.end,
      windowRange: s.windowRange,
      family0: marks[i].family
    }));
    const extras = rawSegs.map((s) => computeSegmentExtras(ctx, s.start, s.end));
    return { cutDemandRef, rawSegs, extras, windows };
  }
  function analyzeMap(osuText, opts = {}) {
    let map = parseOsu(osuText);
    const rate = opts.speedRate ?? 1;
    if (rate !== 1) map = rescale(map, rate);
    const cm = buildCachedMap(osuText, opts);
    const segments = smoothSegments(classifySegments(cm, { scorer: "model" }));
    const overall = aggregateOverall(segments);
    return { map, segments, overall, debug: { windows: cm.windows, norm: void 0, ctx: void 0 } };
  }
  function extractIntermediate(osuText, opts = {}) {
    const res = analyzeMap(osuText, opts);
    const dbg = res.debug;
    return { map: res.map, windows: dbg.windows, segments: res.segments, overall: res.overall };
  }
  Object.assign(index_exports,{lab:{CONFIG,RC_DEFAULTS,LN_DEFAULTS,VEC_KEYS,MEDIAN_KEYS,MODEL,parseOsu,rescale,buildRows,attachTails,buildColumnData,computeHeld,buildFeatureContext,computeWindowFeatures,computeAllWindows,normalizeWindows,segmentMap,markBreaks,computeSegmentExtras,computeMapMedians,medianWindowFeatures,buildVector,modelScores,scoreRc,scoreLn,blendScores,classifySegments,smoothSegments,aggregateOverall}});
  return __toCommonJS(index_exports);
})();

if (typeof module !== "undefined") module.exports = TagClassifier;

})(module,module.exports);
 const api=module.exports;Object.assign(api.lab.CONFIG,config);return api;
}
function context(lab,text,rate=1){
 let map=lab.parseOsu(text);if(rate!==1)map=lab.rescale(map,rate);
 const rows=lab.buildRows(map);lab.attachTails(map,rows);
 const cols=lab.buildColumnData(map),held=lab.computeHeld(map,rows),ctx=lab.buildFeatureContext(map,rows,held,cols);
 const windows=lab.computeAllWindows(ctx);return {map,ctx,rows,windows};
}
function inspectPrepared(api,{map,ctx,rows,windows},{intervals}={}){
 const lab=api.lab;
 const norm=lab.normalizeWindows(windows);
 const activeCut=windows.map(w=>w.cutDemand).filter(v=>v>0).sort((a,b)=>a-b);
 const cutDemandRef=activeCut.length?activeCut[Math.floor(activeCut.length*.8)]:1;
 const raw=lab.segmentMap({map,rows,windows,norm});
 const autoMarks=lab.markBreaks(map,rows,raw);
 const rawSegs=raw.map((s,i)=>({...s,family0:autoMarks[i].family}));
 const cm={windows,cutDemandRef,rawSegs,extras:rawSegs.map(s=>lab.computeSegmentExtras(ctx,s.start,s.end))};
 const segments=intervals?intervals.map(s=>({start:s.start,end:s.end,
  windowRange:s.windowRange??[Math.max(0,Math.floor((s.start-map.firstNote)/lab.CONFIG.winStepMs)),
    Math.min(windows.length,Math.max(1,Math.ceil((s.end-map.firstNote)/lab.CONFIG.winStepMs)))]})):cm.rawSegs;
 const marks=lab.markBreaks(map,rows,segments),mapMedians=lab.computeMapMedians(windows);
 const rowsOut=segments.map((s,i)=>{
  const extra=intervals?lab.computeSegmentExtras(ctx,s.start,s.end):cm.extras[i];
  const f=lab.medianWindowFeatures(windows,s.windowRange[0],s.windowRange[1],mapMedians);
  const vector=lab.buildVector(f,extra,cm.cutDemandRef);
  return {...s,f,extra,vector:lab.VEC_KEYS.map(k=>vector[k]),
   modelRc:lab.modelScores('rc',f,extra,cm.cutDemandRef),modelLn:lab.modelScores('ln',f,extra,cm.cutDemandRef),
   ruleRc:lab.scoreRc({f,extras:extra,cutDemandRef:cm.cutDemandRef}),ruleLn:lab.scoreLn({f,extras:extra}),
   family0:marks[i].family};
 });
 const cache={...cm,windows,rawSegs:segments.map((s,i)=>({...s,family0:marks[i].family})),extras:rowsOut.map(r=>r.extra)};
 const classified=lab.classifySegments(cache,{scorer:'model'});
 return {map,ctx,cache,cutDemandRef:cm.cutDemandRef,windows,segments:rowsOut,classified,
   smoothed:lab.smoothSegments(classified.map(s=>({...s}))),featureKeys:lab.VEC_KEYS};
}
module.exports={loadLab,context,inspectPrepared};
},
function(module,exports,load){
'use strict';

/** Milliseconds after rate conversion; tail intervals are half-open [head, tail). */
function parseOsu(text, { speedRate = 1 } = {}) {
  if (!Number.isFinite(speedRate) || speedRate <= 0) throw new RangeError('speedRate must be finite and positive');
  let section = '', mode = null, keys = null;
  const rawNotes = [], timingPoints = [], breaks = [], meta = {}, warnings=[];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('[')) { section = line.slice(1, -1).toLowerCase(); continue; }
    if (['general', 'difficulty', 'metadata'].includes(section)) {
      const at = line.indexOf(':'); if (at < 0) continue;
      const k = line.slice(0, at).trim(), v = line.slice(at + 1).trim();
      if (k === 'Mode') mode = Number(v);
      if (k === 'CircleSize') keys = Number(v);
      if (section === 'metadata') meta[k] = v;
      if (k === 'OverallDifficulty') meta.od = Number(v);
    } else if (section === 'timingpoints') {
      const p = line.split(','), t = Number(p[0]), beatLength = Number(p[1]);
      if(!Number.isFinite(t)||!Number.isFinite(beatLength)){warnings.push('IgnoredNonfiniteTimingPoint');continue;}
      if (beatLength > 0 && (p[6] === undefined || p[6].trim() !== '0'))
        timingPoints.push({ t: t / speedRate, beatLength: beatLength / speedRate });
    } else if (section === 'events') {
      const p = line.split(/\s*,\s*|\s+/);
      if (p[0] === '2' || p[0] === 'Break') {
        const a = Number(p[1]), b = Number(p[2]);
        if (Number.isFinite(a) && b > a) breaks.push([a / speedRate, b / speedRate]);
      }
    } else if (section === 'hitobjects') rawNotes.push(line.split(','));
  }
  if (mode !== 3) throw new Error('NotMania');
  if (![4, 6, 7].includes(keys)) throw new Error('UnsupportedKeys: expected 4, 6 or 7');
  const notes = [];
  for (const p of rawNotes) {
    const x = Number(p[0]), t = Number(p[2]), type = Number(p[3]);
    if (p.length < 5 || !Number.isFinite(x) || !Number.isFinite(t) || !Number.isInteger(type))
      throw new Error('InvalidHitObject');
    if (!(type & 129)) continue;
    const end = type & 128 ? Number((p[5] ?? '').split(':')[0]) : null;
    if (end !== null && (!Number.isFinite(end) || end < t)) throw new Error('InvalidHoldTail');
    notes.push({ t: t / speedRate, col: Math.min(keys - 1, Math.max(0, Math.floor(x * keys / 512))),
      lnEnd: end !== null && end > t ? end / speedRate : null });
  }
  notes.sort((a, b) => a.t - b.t || a.col - b.col);
  if (!notes.length) throw new Error('EmptyBeatmap');
  Object.assign(meta,{title:meta.Title,artist:meta.Artist,version:meta.Version,creator:meta.Creator});
  timingPoints.sort((a, b) => a.t - b.t);
  // Duplicate objects on one key at the same time are one physical action.
  const unique = [];
  for (const n of notes) {
    const last = unique.at(-1);
    if (last && last.t === n.t && last.col === n.col) {
      const end = Math.max(last.lnEnd ?? n.t, n.lnEnd ?? n.t); last.lnEnd = end > n.t ? end : null;
    }
    else unique.push(n);
  }
  return { keys, notes: unique, timingPoints, breaks, meta, warnings,
    firstNote: unique[0].t, lastNote: unique.reduce((end,n)=>Math.max(end,n.lnEnd??n.t),unique[0].t) };
}

function popcount(mask) { let n = 0; while (mask) { mask &= mask - 1; n++; } return n; }
function lowerBound(a, t, key = x => x) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (key(a[mid]) < t) lo = mid + 1; else hi = mid; }
  return lo;
}
function prepare(map, rowMergeMs = 10) {
  const rows = [], cols = Array.from({ length: map.keys }, () => []), tails = [];
  for (const n of map.notes) {
    cols[n.col].push(n);
    let r = rows.at(-1);
    if (!r || n.t - r.t > rowMergeMs) rows.push(r = { t: n.t, mask: 0, lnMask: 0 });
    r.mask |= 1 << n.col; if (n.lnEnd !== null) { r.lnMask |= 1 << n.col; tails.push({ t: n.lnEnd, col: n.col, start: n.t }); }
  }
  // Union overlapping holds per column: occupancy never exceeds one finger per key.
  const holds = cols.map(notes => {
    const out = [];
    for (const n of notes) if (n.lnEnd !== null) {
      const last = out.at(-1);
      if (last && n.t < last[1]) last[1] = Math.max(last[1], n.lnEnd);
      else out.push([n.t, n.lnEnd]);
    }
    return out;
  });
  tails.sort((a, b) => a.t - b.t || a.col - b.col);
  return { map, rows, cols, tails, holds, rowMergeMs };
}
module.exports = { parseOsu, prepare, popcount, lowerBound };

},
function(module,exports,load){
'use strict';
const {lowerBound:lb}=load(3);
const KEYS=['tailRatePerKey','headIsolation','sameFingerRecovery','tailAsynchrony','tailTimingVariability',
 'heldOtherAtTail','sameHandOrder','releaseChordFraction','independentHeldRelease'];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)));};
const ratio=(gap,scale)=>Number.isFinite(gap)?gap/(gap+scale):1;

function releaseContext(ctx){
 // Timing-normalized geometry uses the active quarter-beat. Without timing
 // points use a scale inferred from actual event gaps, not a new fixed-ms gate.
 const times=[...new Set([...ctx.map.notes.map(n=>n.t),...ctx.tails.map(n=>n.t)])].sort((a,b)=>a-b);
 const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
 return {...ctx,releaseFallbackScale:gaps[Math.floor((gaps.length-1)/2)]||1};
}
function scaleAt(ctx,t){
 const points=ctx.map.timingPoints;
 const index=Math.max(0,lb(points,t+1e-8,p=>p.t)-1);
 return points.length?points[index].beatLength/4:ctx.releaseFallbackScale;
}
function releaseGeometry(ctx,start,end){
 const K=ctx.map.keys,tails=ctx.tails,heads=ctx.map.notes;
 const lo=lb(tails,start,n=>n.t),hi=lb(tails,end,n=>n.t),n=hi-lo;
 if(!n)return {values:KEYS.map(()=>0),metrics:Object.fromEntries(KEYS.map(k=>[k,0])),tails:0};
 const isolation=[],recovery=[],asynchrony=[],held=[],interaction=[],rhythm=[],width=[];let order=0;
 const hand=c=>K===7&&c===3?-1:c<Math.floor(K/2)?0:1;
 for(let j=lo;j<hi;j++){
  const tail=tails[j],scale=scaleAt(ctx,tail.t),i=lb(heads,tail.t,n=>n.t);
  const before=i>0?tail.t-heads[i-1].t:Infinity,after=i<heads.length?heads[i].t-tail.t:Infinity;
  const independent=ratio(Math.min(before,after),scale);isolation.push(independent);
  const same=ctx.cols[tail.col],next=same[lb(same,tail.t,n=>n.t)];
  recovery.push(ratio(next?next.t-tail.t:Infinity,scale));
  const previous=j?tail.t-tails[j-1].t:Infinity,following=j+1<tails.length?tails[j+1].t-tail.t:Infinity;
  asynchrony.push(ratio(Math.min(previous,following),scale));
  let other=0;
  for(let col=0;col<K;col++){
   if(col===tail.col)continue;
   const holds=ctx.holds[col],last=lb(holds,tail.t,h=>h[0])-1;
   // Immediately BEFORE release: new simultaneous heads do not count, other
   // simultaneous tails are still held. No epsilon-time magic is needed.
   if(last>=0&&holds[last][1]>=tail.t)other++;
  }
  const load=other/Math.max(1,K-1);held.push(load);interaction.push(load*independent);
  const a=lb(tails,tail.t,n=>n.t),b=lb(tails,tail.t+1e-8,n=>n.t);width.push((b-a)/K);
  if(j>lo&&tail.t>tails[j-1].t)rhythm.push(Math.log1p((tail.t-tails[j-1].t)/scale));
  if(j>0&&j+1<tails.length){
   const a=tails[j-1],b=tail,c=tails[j+1],h=hand(b.col);
   // All three timestamp groups must be singletons. Strict a.t < b.t < c.t
   // alone is insufficient: a/c can be the last/first member of a chord,
   // whose arbitrary column ordering reverses under a physical mirror.
   const uniqueEndpoints=(j<2||tails[j-2].t<a.t)&&(j+2>=tails.length||c.t<tails[j+2].t);
   if(uniqueEndpoints&&a.t<b.t&&b.t<c.t&&h>=0&&hand(a.col)===h&&hand(c.col)===h&&new Set([a.col,b.col,c.col]).size===3){
    const distance=Math.abs(a.col-b.col)+Math.abs(b.col-c.col),span=Math.max(a.col,b.col,c.col)-Math.min(a.col,b.col,c.col);
    order+=(distance-span)/Math.max(1,Math.floor(K/2)-1)*Math.exp(-(c.t-a.t)/(3*scale));
   }
  }
 }
 const values=[n/((end-start)/1000)/K,mean(isolation),mean(recovery),mean(asynchrony),sd(rhythm),
  mean(held),order/n,mean(width),mean(interaction)];
 if(values.some(v=>!Number.isFinite(v)))throw Error('Nonfinite release geometry');
 return {values,metrics:Object.fromEntries(KEYS.map((k,i)=>[k,values[i]])),tails:n};
}
module.exports={KEYS,releaseContext,releaseGeometry};

},
function(module,exports,load){
'use strict';
// Research consumer of the complete native segmenter + expert/gating pipeline.
// This is not another flat classifier and does not alter the archived engine.
const {loadLab,context,inspectPrepared}=load(2);
const patches=load(6);
const CLASSES=['chordjack','minijack','dense chordstream','fast chordstream','speed','tech','vibro','anchor',
 'coordination','density','inverse','release','technical','wildcard','ln wildcard','break'];
const BOUNDARIES=[1500,3000,6000].flatMap(minSegLenMs=>[.025,.05,.1].map(segProminenceAbs=>({minSegLenMs,segProminenceAbs})));
const HEADS=[.35,.45,.55].flatMap(lnDominantRatio=>['model','blend'].map(scorer=>({lnDominantRatio,scorer})));
const logical=patches.logical,neutral=logical.concat(patches.neutralHands,patches.coverage);
const TREATMENTS={original:[],area:[patches.area],adjacency:[patches.adjacency],heldOrder:[patches.heldOrder],
 phase:[patches.phase],sustaining:[patches.sustaining],neutralHands:[patches.neutralHands],coverage:[patches.coverage],
 transformedScale:[patches.transformedScale],logical,logical_neutral:neutral};
for(const ms of [20,40,80]){
 TREATMENTS['release_'+ms]=[patches.releaseAt(ms)];
 TREATMENTS['logical_release_'+ms]=neutral.concat(patches.releaseAt(ms));
 TREATMENTS['full_'+ms]=neutral.concat(patches.releaseAt(ms),patches.transformedScale);
}
const SPEC={id:'native-label-free-r1',classes:CLASSES,boundaries:BOUNDARIES,heads:HEADS,
 fixed:{winMs:1000,winStepMs:250,segProminenceRel:.35},
 scoreSemantics:'normalized within-family decision support, not calibrated correctness; rejected wildcard mass is conditioned away',
 treatmentPatches:Object.fromEntries(Object.entries(TREATMENTS).map(([k,ps])=>[k,ps.map(p=>p.id)]))};

function decisionSupport(segment){
 if(segment.family==='break')return CLASSES.map(k=>k==='break'?1:0);
 const values=CLASSES.map(k=>Math.max(0,segment.scores?.[k]||0));
 let top=values.indexOf(Math.max(...values));
 // The native decision rejects a leading wildcard if a concrete class clears
 // its demotion threshold. Its support is conditional on that explicit gate.
 if(['wildcard','ln wildcard'].includes(CLASSES[top])&&!['wildcard','ln wildcard'].includes(segment.tag)){
  values[CLASSES.indexOf('wildcard')]=0;values[CLASSES.indexOf('ln wildcard')]=0;
 }
 const sum=values.reduce((a,b)=>a+b,0);
 if(!(sum>0))throw Error('Native decision has no finite class support');
 const p=values.map(v=>v/sum);top=p.indexOf(Math.max(...p));
 if(CLASSES[top]!==segment.tag)throw Error('Decision/support mismatch: '+segment.tag+' versus '+CLASSES[top]);
 return p;
}
function compact(segment,raw,burdens){
 let sum=0,duration=0;
 raw.forEach((s,i)=>{const d=Math.max(0,Math.min(s.end,segment.end)-Math.max(s.start,segment.start));sum+=d*burdens[i];duration+=d;});
 const probability=decisionSupport(segment);
 return {start:segment.start,end:segment.end,tag:segment.tag,family:segment.family,confidence:segment.confidence,
  probability,burden:duration?sum/duration:0};
}
function extractNative(api,prepared){
 const partitions=[];
 for(const boundary of BOUNDARIES){
  Object.assign(api.lab.CONFIG,boundary);
  const view=inspectPrepared(api,prepared),burdens=view.segments.map(s=>s.f.nps*(.5+s.f.chordMean/3)*(.6+s.f.jackSpeedBpm/150));
  const cases=HEADS.map(head=>{
   const classified=api.lab.classifySegments(view.cache,head);
   const smoothed=api.lab.smoothSegments(structuredClone(classified));
   return {head,raw:classified.map(s=>compact(s,classified,burdens)),legacy:smoothed.map(s=>compact(s,classified,burdens))};
  });
  partitions.push({boundary,cases});
 }
 return partitions;
}
function nativeApi(treatment){
 if(!Object.hasOwn(TREATMENTS,treatment))throw Error('Unknown native treatment '+treatment);
 return loadLab({patches:TREATMENTS[treatment]});
}
module.exports={CLASSES,BOUNDARIES,HEADS,TREATMENTS,SPEC,decisionSupport,extractNative,nativeApi};

},
function(module,exports,load){
'use strict';
// Explicit, independently selectable research treatments. Never edit the archive.
function patch(id,description,apply){return {id,description,apply};}
const area=patch('area','Integrate LN union per lane once, clipped to the window',(s,r)=>{
 const from='        const hs = ctx.lnHeads;\n        const ts = ctx.lnTails;';
 const to='        f.lnAreaRatio = area / ((t1 - t0) * K);';
 const a=s.indexOf(from),b=s.indexOf(to,a);if(a<0||b<0)throw Error('area anchors missing');
 const old=s.slice(a,b+to.length);
 return r(s,old,`        const lanes = Array.from({length:K},()=>[]);
        const aLo = lowerBoundObj(ctx.lnHeads,t0-ctx.lnMaxDur,h=>h.t);
        const aHi = lowerBoundObj(ctx.lnHeads,t1,h=>h.t);
        for(let i=aLo;i<aHi;i++){
          const h=ctx.lnHeads[i],start=Math.max(t0,h.t),end=Math.min(t1,h.t+h.dur);
          if(end>start)lanes[h.col].push([start,end]);
        }
        let area=0;
        for(const intervals of lanes){
          let end=-Infinity;
          for(const [a,b] of intervals){if(b>end){area+=b-Math.max(a,end);end=b;}}
        }
        f.lnAreaRatio = area / ((t1 - t0) * K);`);
});
const adjacency=patch('head_adjacency','Head-to-head row statistics skip release-only rows',(s,r)=>r(s,
 `      if (i > 0 && rows[i - 1].hits > 0) {\n        const prev = rows[i - 1];`,
 `      let previous=i-1;while(previous>=0&&rows[previous].hits===0)previous--;
      if (previous >= 0) {
        const prev = rows[previous];`));
const heldOrder=patch('held_order','Half-open holds: process tails before heads at identical time',(s,r)=>r(s,
 '    events.sort((a, b) => a.t - b.t || a.type - b.type);',
 '    events.sort((a, b) => a.t - b.t || b.type - a.type);'));
const phase=patch('timing_phase','Use each active uninherited timing point as beat phase origin',(s,r)=>r(s,
 `          const q = beatLengthAt(ctx.map.timingPoints, s.t) / 4;\n          let d = (s.t - anchor) % q;`,
 `          const points=ctx.map.timingPoints;
          const pi=Math.max(0,upperBoundObj(points,s.t,p=>p.t)-1);
          const q = points[pi].beatLength / 4;
          let d = (s.t - points[pi].t) % q;`));
// A replacement feature, not a unique correction of the ambiguous old name.
// Every actual head event matters, regardless of lane or input ordering; a
// release >40 ms from its nearest head is temporally independent.
const releaseIsolation=patch('release_isolation','Release independence = fraction >40 ms from nearest head',(s,r)=>r(s,
 `          const ev = ctx.allEvents;
          const ei = lowerBoundObj(ev, tails[i].t, (e) => e.t);
          if (ei < ev.length && ev[ei].t - tails[i].t < 3e3) {
            if (ev[ei].col !== tails[i].col) indep++;
          }`,
 `          const ns=ctx.map.notes,ei=lowerBoundObj(ns,tails[i].t,n=>n.t);
          const before=ei>0?tails[i].t-ns[ei-1].t:Infinity;
          const after=ei<ns.length?ns[ei].t-tails[i].t:Infinity;
          if(Math.min(before,after)>40)indep++;`));
const sustaining=patch('sustaining','Compute hold occupancy and releases in windows without heads',(s,r)=>{
 s=r(s,'    if (rowCount === 0) return f;',
  '    // Sustain-only windows still carry occupancy and release evidence.');
 return r(s,'      f.lockRatio /= rowCount;','      f.lockRatio /= Math.max(1,rowCount);');
});
const transformedScale=patch('transformed_scale','Normalize log-transformed signals by a quantile span in the SAME transformed domain',(s,r)=>{
 const declaration='      const logTailed = key === "cutDemand" || key === "jackSpeedBpm" || key === "nps" || key === "tailRate";';
 s=r(s,declaration,'');
 return r(s,`      let scale = q(0.9) - q(0.1);
      if (scale < 1e-6) scale = Math.max(Math.abs(med) * 0.5, 1e-6);`,
 `${declaration}
      const transform=x=>logTailed?Math.log1p(Math.max(0,x)/5):x;
      let scale = transform(q(0.9)) - transform(q(0.1));
      if (scale < 1e-6) scale = Math.max(Math.abs(transform(med)) * 0.5, 1e-6);`);
});
const weightedShares=patch('weighted_shares','Compute class shares with the SAME weighted-time numerator and denominator',(s,r)=>r(s,
 '      total += durS;',
 '      total += durS * Math.max(0.4, seg.confidence);'));
const neutralHands=patch('neutral_hands','Hand alternation excludes neutral/tied rows and the flexible 7K centre',(s,r)=>{
 s=r(s,'      const split2 = K <= 1 ? 1 : Math.ceil(K / 2);','      const split2 = Math.floor(K / 2);');
 s=r(s,'        let col = -1, left = 0;','        let col = -1, left = 0, right = 0;');
 s=r(s,'            if (c < split2) left++;','            if (c < split2) left++;\n            else if(c>=Math.ceil(K/2))right++;');
 s=r(s,'hand: left * 2 >= r.hits ? 0 : 1','hand: left>right?0:right>left?1:-1');
 s=r(s,'const cont = seq[i].hand !== seq[i - 1].hand && (i >= 2 ?',
  'const cont = seq[i].hand>=0 && seq[i-1].hand>=0 && seq[i].hand !== seq[i - 1].hand && (i >= 2 ?');
 return r(s,'run = i + 1 < seq.length && seq[i + 1].hand !== seq[i].hand ? 2 : 1;',
  'run = i + 1 < seq.length && seq[i].hand>=0 && seq[i+1].hand>=0 && seq[i + 1].hand !== seq[i].hand ? 2 : 1;');
});
function releaseAt(ms){
 if(![20,40,80].includes(ms))throw Error('Release scale must belong to the declared research grid');
 return patch('release_isolation_'+ms,`Release isolation with ${ms} ms nearest-head tolerance`,(s,r)=>{
  const applied=releaseIsolation.apply(s,r);
  return ms===40?applied:r(applied,'if(Math.min(before,after)>40)indep++;',`if(Math.min(before,after)>${ms})indep++;`);
 });
}
const coverage=patch('partition_coverage','Short boundary fragments remain assigned to a neighbouring native segment',(s,r)=>r(s,
 '    for (let i = 1; i < out.length; i++) out[i].start = Math.max(out[i].start, out[i - 1].end);\n    return out;',
 `    if(!out.length&&map.lastNote>map.firstNote){
      out.push({start:map.firstNote,end:map.lastNote,windowRange:[0,windows.length]});
    }
    if(out.length){
      out[0].start=map.firstNote;
      for(let i=1;i<out.length;i++)out[i].start=out[i-1].end;
      out[out.length-1].end=map.lastNote;
    }
    return out;`));
module.exports={area,adjacency,heldOrder,phase,releaseIsolation,sustaining,
 transformedScale,weightedShares,neutralHands,releaseAt,coverage,
 logical:[area,adjacency,heldOrder,phase,sustaining]};

},
function(module,exports,load){
'use strict';
// Actual JS consumer used to cross-check the vectorized research evaluator.
const {CLASSES}=load(5);
const {aggregateEvidence,coalesceForDisplay,supportMetrics}=load(8);
function selectNativeSegments(value,config){
 const source=value.partitions[config.partition].cases[config.head];
 const rows=source[config.smoothing==='legacy'?'legacy':'raw'];
 const extraGate=config.extraGate??'all';
 if(!['all','ln_protected','off'].includes(extraGate))throw Error('Unknown extra relative-burden gate treatment');
 if(!config.burdenGate||extraGate==='off')return rows;
 const active=rows.filter(s=>s.burden>0).map(s=>[s.burden,s.end-s.start]).sort((a,b)=>a[0]-b[0]);
 const total=active.reduce((s,x)=>s+x[1],0);let time=0,reference=1;
 for(const [burden,duration]of active){time+=duration;reference=burden;if(time>=.75*total)break;}
 return rows.map(s=>s.family!=='break'&&!(extraGate==='ln_protected'&&s.family==='ln')&&s.burden/reference<config.burdenGate?
  {...s,tag:'break',family:'break',confidence:1,probability:CLASSES.map(k=>k==='break'?1:0)}:s);
}
function evaluateCachedNative(value,config){
 const rows=selectNativeSegments(value,config),options={...config,lnLow:config.familyThresholds[0],lnHigh:config.familyThresholds[1]};
 const overall=aggregateEvidence(rows,options);
 const segments=config.smoothing==='coherent'&&config.mode==='soft'?coalesceForDisplay(rows,options):rows.map(s=>({...s,metrics:supportMetrics(s.probability)}));
 return {segments,overall};
}
module.exports={selectNativeSegments,evaluateCachedNative};

},
function(module,exports,load){
'use strict';
const {composition}=load(9);
const {CLASSES}=load(5);
const NON_AGGR=new Set(['break','wildcard','ln wildcard','rc mix','ln mix','hybrid']);
const LN=new Set(['coordination','density','inverse','release','technical','ln wildcard']);
const BREAK=CLASSES.indexOf('break');
const defaults={mode:'soft',effortPower:0,confidencePower:0,dominantShare:.52,mixShare:.07,
 secondRel:.75,twoTagMaxShare:.55,lnLow:.18,lnHigh:.68,minEvidence:.25,minimumDiversity:0};
const settings=options=>({...defaults,...options,
 excludeVibroFromMix:options.excludeVibroFromMix??(options.mode!=='legacy')});
const atoms=segments=>segments.flatMap(s=>s.components?atoms(s.components):[s]);
function supportMetrics(p){
 const ranked=[...p].sort((a,b)=>b-a);
 return {maximum:ranked[0],margin:ranked[0]-ranked[1],concentration:p.reduce((s,x)=>s+x*x,0),
  entropy:-p.reduce((s,x)=>s+(x?x*Math.log(x):0),0)/Math.log(p.length)};
}
function evidence(segments,options={}){
 const p=settings(options),rows=atoms(segments);
 const active=rows.filter(s=>s.burden>0).map(s=>[s.burden,Math.max(0,s.end-s.start)]).sort((a,b)=>a[0]-b[0]);
 const mass=active.reduce((s,x)=>s+x[1],0);let acc=0,reference=1;
 for(const [value,time]of active){acc+=time;reference=value;if(acc>=.75*mass)break;}
 return rows.map(s=>{
  const duration=Math.max(0,s.end-s.start),effort=Math.max(1e-4,(s.burden||0)/reference)**p.effortPower;
  const metrics=s.probability?supportMetrics(s.probability):null;
  const concentration=p.mode==='soft'?metrics.concentration:Math.max(.4,s.confidence);
  const base=(p.mode==='soft'?duration/1000:Math.max(.5,duration/1000))*effort;
  // The native Break decision is an eligibility gate, not a source of tiny
  // residual fine-class votes that a very long rest can accumulate.
  return {...s,metrics,evidenceBase:base,evidenceWeight:p.mode==='soft'&&s.tag==='break'?0:base*concentration**p.confidencePower};
 });
}
function aggregateEvidence(segments,options={}){
 const p=settings(options),rows=evidence(segments,p),weights={};
 if(!rows.length)return {tags:[],sort:'rc',weights,shares:{},diversity:0,distribution:CLASSES.map(()=>0),activeWeight:0};
 let total=0,lnW=0,rcW=0,diversity=0,distribution=null;
 const familyTags={rc:new Set(),ln:new Set()};
 if(p.mode==='soft'){
  const summary=composition(rows.map(s=>s.probability),rows.map(s=>s.evidenceWeight),{breakIndex:BREAK});
  diversity=summary.diversity;distribution=CLASSES.map(()=>0);total=summary.activeWeight;
  summary.indices.forEach((k,j)=>distribution[k]=summary.distribution[j]);
  for(let k=0;k<CLASSES.length;k++){
   const tag=CLASSES[k],mass=total*distribution[k];
   if(LN.has(tag))lnW+=mass;else if(tag!=='break')rcW+=mass;
   if(!NON_AGGR.has(tag)&&mass>0)weights[tag]=mass;
  }
 }else{
  for(const s of rows){
   if(s.family==='break')continue;
   if(s.family==='ln')lnW+=s.evidenceBase;else if(s.family==='rc')rcW+=s.evidenceBase;
   if(NON_AGGR.has(s.tag))continue;
   if(!p.excludeVibroFromMix||s.tag!=='vibro')familyTags[s.family].add(s.tag);
   weights[s.tag]=(weights[s.tag]||0)+s.evidenceWeight;
   total+=p.mode==='legacy'?s.evidenceBase:s.evidenceWeight;
  }
 }
 const lnRatio=lnW/(p.mode==='soft'?(lnW+rcW||1):Math.max(1,lnW+rcW));
 const sort=lnRatio<p.lnLow?'rc':lnRatio>p.lnHigh?'ln':'hb';
 if(!(total>0))return {tags:[],sort:p.mode==='legacy'?'rc':sort,weights,shares:{},diversity,distribution,activeWeight:0};
 const ranked=Object.entries(weights).map(([tag,w])=>[tag,w/total]).sort((a,b)=>b[1]-a[1]);
 const top=ranked[0]?.[1]||0,significant=ranked.filter(([tag,share])=>share>=p.mixShare&&(!p.excludeVibroFromMix||tag!=='vibro'));
 let tags=[];
 const enoughFamilies=p.mode==='soft'?significant.length>=3:familyTags.rc.size+familyTags.ln.size>=3;
 if(p.mode==='soft'&&top<p.minEvidence)tags=[];
 else if(significant.length>=3&&enoughFamilies&&top<p.dominantShare){
  if(p.mode!=='soft'||diversity>=p.minimumDiversity)tags=[sort==='rc'?'rc mix':sort==='ln'?'ln mix':'hybrid'];
 }else if(ranked.length>=2&&ranked[1][1]>=p.secondRel*top&&top<p.twoTagMaxShare)tags=[ranked[0][0],ranked[1][0]];
 else if(ranked.length)tags=[ranked[0][0]];
 return {tags,sort,weights,shares:Object.fromEntries(ranked),diversity,distribution,activeWeight:total};
}
function coalesceForDisplay(segments,options={}){
 const rows=evidence(segments,{...options,mode:'soft'}),groups=[];
 for(const row of rows){
  const last=groups.at(-1);
  if(last&&last.end===row.start&&last.tag===row.tag&&last.family===row.family){last.end=row.end;last.components.push(row);}
  else groups.push({start:row.start,end:row.end,tag:row.tag,family:row.family,components:[row]});
 }
 return groups.map(g=>{
  const weight=g.components.reduce((s,r)=>s+r.evidenceWeight,0);
  const displayWeights=g.components.map(r=>weight?r.evidenceWeight:r.end-r.start),displayTotal=displayWeights.reduce((a,b)=>a+b,0);
  const probability=CLASSES.map((_,k)=>g.components.reduce((s,r,i)=>s+displayWeights[i]*r.probability[k],0)/displayTotal);
  return {...g,probability,metrics:supportMetrics(probability),aggregationWeight:weight};
 });
}
module.exports={aggregateEvidence,evidence,supportMetrics,coalesceForDisplay,defaults};

},
function(module,exports,load){
'use strict';
/** Separate uncertain local labels from genuine between-segment diversity.
 * Inputs are probability vectors (not raw legacy scores), nonnegative evidence
 * weights and an optional Break index. Break mass reduces active evidence.
 * Entropies are divided by log(number of non-Break classes).
 */
function composition(probabilities,weights,{breakIndex=-1}={}){
 if(!probabilities.length||probabilities.length!==weights.length)throw Error('ShapeMismatch');
 const D=probabilities[0].length,indices=Array.from({length:D},(_,i)=>i).filter(i=>i!==breakIndex);
 if(indices.length<2)throw Error('NeedAtLeastTwoActiveClasses');
 const dist=Array(indices.length).fill(0),rows=[];let total=0;
 const H=p=>-p.reduce((s,x)=>s+(x>0?x*Math.log(x):0),0)/Math.log(indices.length);
 probabilities.forEach((p,i)=>{
  if(p.length!==D||p.some(x=>!Number.isFinite(x)||x<0)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>1e-9)throw Error('InvalidProbability');
  if(!Number.isFinite(weights[i])||weights[i]<0)throw Error('InvalidWeight');
  const active=indices.reduce((s,j)=>s+p[j],0),weight=weights[i]*active;
  if(!weight)return;
  const q=indices.map(j=>p[j]/active);total+=weight;
  for(let j=0;j<q.length;j++)dist[j]+=weight*q[j];rows.push({q,weight});
 });
 if(!total)return {indices,distribution:dist,activeWeight:0,entropy:0,meanLocalEntropy:0,diversity:0};
 for(let j=0;j<dist.length;j++)dist[j]/=total;
 const entropy=H(dist),local=rows.reduce((s,r)=>s+r.weight/total*H(r.q),0);
 return {indices,distribution:dist,activeWeight:total,entropy,meanLocalEntropy:local,
  diversity:Math.max(0,entropy-local)};
}
module.exports={composition};

}],cache={};
function load(id){if(!cache[id]){const m=cache[id]={exports:{}};modules[id](m,m.exports,load);}return cache[id].exports;}
return load(0);})();

},
function(module,exports,load){
/* Generated by node scripts/build-coarse.cjs; MIT; do not edit. */
module.exports=(()=>{
const modules=[function(module,exports,load){
'use strict';
const anchor=load(1),release=load(3);
const {lowerBound}=load(2);
function describeInterval(ctx,start,end){
 const rows=ctx.rows.slice(lowerBound(ctx.rows,start,r=>r.t),lowerBound(ctx.rows,end,r=>r.t));
 const values=anchor.describe(rows,ctx.map.keys);
 return {start,end,anchor:Object.fromEntries(anchor.KEYS.map((k,i)=>[k,values[i]])),
  release:release.releaseGeometry(ctx,start,end).metrics};
}
module.exports={prepare:release.releaseContext,describeInterval};

},
function(module,exports,load){
'use strict';
// Key-count-aware morphology. These are descriptors, not local truth labels.
const {popcount,lowerBound}=load(2);
const KEYS=['peakShare','peakExcess','repeatConcentration','runAsymmetry','runCoverage','regularity','regularAnchor'];
function describe(rows,K){
 const N=rows.length,counts=Array(K).fill(0),pairs=Array(K).fill(0),longest=Array(K).fill(0),run=Array(K).fill(0);
 const times=Array.from({length:K},()=>[]);
 for(let i=0;i<N;i++)for(let c=0;c<K;c++){
  if(rows[i].mask&(1<<c)){
   counts[c]++;times[c].push(rows[i].t);run[c]++;longest[c]=Math.max(longest[c],run[c]);
   if(i&&(rows[i-1].mask&(1<<c)))pairs[c]++;
  }else run[c]=0;
 }
 const total=counts.reduce((a,b)=>a+b,0),repeat=pairs.reduce((a,b)=>a+b,0);
 const sorted=[...longest].sort((a,b)=>a-b),peakCount=Math.max(...counts);
 const steady=times.map(a=>{
  const iv=a.slice(1).map((t,i)=>t-a[i]),mean=iv.reduce((a,b)=>a+b,0)/Math.max(1,iv.length);
  const cv=mean>0?Math.sqrt(iv.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,iv.length))/mean:Infinity;
  return iv.length>=2?1/(1+cv):0;
 });
 const peak=total?Math.max(...counts)/total:0,excess=total?Math.max(0,(peak-1/K)/(1-1/K)):0;
 const concentration=repeat?Math.max(0,(Math.max(...pairs)/repeat-1/K)/(1-1/K)):0;
 const asymmetry=N?(sorted[K-1]-sorted[Math.floor((K-1)/2)])/N:0;
 const regularity=Math.max(...steady.filter((_,c)=>counts[c]===peakCount));
 return [peak,excess,concentration,asymmetry,N?sorted[K-1]/N:0,regularity,excess*regularity];
}
function windows(ctx,ms){
 const start=ctx.map.firstNote,end=ctx.map.lastNote+1,out=[];
 for(let t=start;t<end;t+=ms/2){
  const rows=ctx.rows.slice(lowerBound(ctx.rows,t,r=>r.t),lowerBound(ctx.rows,t+ms,r=>r.t));
  if(rows.length>=3)out.push(describe(rows,ctx.map.keys));
 }
 return out;
}
function pooled(ctx,ms){
 const ws=windows(ctx,ms),out=[];
 for(let j=0;j<KEYS.length;j++){
  const a=ws.map(w=>w[j]).sort((a,b)=>a-b),mean=a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
  out.push(mean,Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,a.length)),a[Math.floor(.9*(a.length-1))]||0);
 }
 return out;
}
module.exports={KEYS,describe,windows,pooled};

},
function(module,exports,load){
'use strict';

/** Milliseconds after rate conversion; tail intervals are half-open [head, tail). */
function parseOsu(text, { speedRate = 1 } = {}) {
  if (!Number.isFinite(speedRate) || speedRate <= 0) throw new RangeError('speedRate must be finite and positive');
  let section = '', mode = null, keys = null;
  const rawNotes = [], timingPoints = [], breaks = [], meta = {}, warnings=[];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('[')) { section = line.slice(1, -1).toLowerCase(); continue; }
    if (['general', 'difficulty', 'metadata'].includes(section)) {
      const at = line.indexOf(':'); if (at < 0) continue;
      const k = line.slice(0, at).trim(), v = line.slice(at + 1).trim();
      if (k === 'Mode') mode = Number(v);
      if (k === 'CircleSize') keys = Number(v);
      if (section === 'metadata') meta[k] = v;
      if (k === 'OverallDifficulty') meta.od = Number(v);
    } else if (section === 'timingpoints') {
      const p = line.split(','), t = Number(p[0]), beatLength = Number(p[1]);
      if(!Number.isFinite(t)||!Number.isFinite(beatLength)){warnings.push('IgnoredNonfiniteTimingPoint');continue;}
      if (beatLength > 0 && (p[6] === undefined || p[6].trim() !== '0'))
        timingPoints.push({ t: t / speedRate, beatLength: beatLength / speedRate });
    } else if (section === 'events') {
      const p = line.split(/\s*,\s*|\s+/);
      if (p[0] === '2' || p[0] === 'Break') {
        const a = Number(p[1]), b = Number(p[2]);
        if (Number.isFinite(a) && b > a) breaks.push([a / speedRate, b / speedRate]);
      }
    } else if (section === 'hitobjects') rawNotes.push(line.split(','));
  }
  if (mode !== 3) throw new Error('NotMania');
  if (![4, 6, 7].includes(keys)) throw new Error('UnsupportedKeys: expected 4, 6 or 7');
  const notes = [];
  for (const p of rawNotes) {
    const x = Number(p[0]), t = Number(p[2]), type = Number(p[3]);
    if (p.length < 5 || !Number.isFinite(x) || !Number.isFinite(t) || !Number.isInteger(type))
      throw new Error('InvalidHitObject');
    if (!(type & 129)) continue;
    const end = type & 128 ? Number((p[5] ?? '').split(':')[0]) : null;
    if (end !== null && (!Number.isFinite(end) || end < t)) throw new Error('InvalidHoldTail');
    notes.push({ t: t / speedRate, col: Math.min(keys - 1, Math.max(0, Math.floor(x * keys / 512))),
      lnEnd: end !== null && end > t ? end / speedRate : null });
  }
  notes.sort((a, b) => a.t - b.t || a.col - b.col);
  if (!notes.length) throw new Error('EmptyBeatmap');
  Object.assign(meta,{title:meta.Title,artist:meta.Artist,version:meta.Version,creator:meta.Creator});
  timingPoints.sort((a, b) => a.t - b.t);
  // Duplicate objects on one key at the same time are one physical action.
  const unique = [];
  for (const n of notes) {
    const last = unique.at(-1);
    if (last && last.t === n.t && last.col === n.col) {
      const end = Math.max(last.lnEnd ?? n.t, n.lnEnd ?? n.t); last.lnEnd = end > n.t ? end : null;
    }
    else unique.push(n);
  }
  return { keys, notes: unique, timingPoints, breaks, meta, warnings,
    firstNote: unique[0].t, lastNote: unique.reduce((end,n)=>Math.max(end,n.lnEnd??n.t),unique[0].t) };
}

function popcount(mask) { let n = 0; while (mask) { mask &= mask - 1; n++; } return n; }
function lowerBound(a, t, key = x => x) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (key(a[mid]) < t) lo = mid + 1; else hi = mid; }
  return lo;
}
function prepare(map, rowMergeMs = 10) {
  const rows = [], cols = Array.from({ length: map.keys }, () => []), tails = [];
  for (const n of map.notes) {
    cols[n.col].push(n);
    let r = rows.at(-1);
    if (!r || n.t - r.t > rowMergeMs) rows.push(r = { t: n.t, mask: 0, lnMask: 0 });
    r.mask |= 1 << n.col; if (n.lnEnd !== null) { r.lnMask |= 1 << n.col; tails.push({ t: n.lnEnd, col: n.col, start: n.t }); }
  }
  // Union overlapping holds per column: occupancy never exceeds one finger per key.
  const holds = cols.map(notes => {
    const out = [];
    for (const n of notes) if (n.lnEnd !== null) {
      const last = out.at(-1);
      if (last && n.t < last[1]) last[1] = Math.max(last[1], n.lnEnd);
      else out.push([n.t, n.lnEnd]);
    }
    return out;
  });
  tails.sort((a, b) => a.t - b.t || a.col - b.col);
  return { map, rows, cols, tails, holds, rowMergeMs };
}
module.exports = { parseOsu, prepare, popcount, lowerBound };

},
function(module,exports,load){
'use strict';
const {lowerBound:lb}=load(2);
const KEYS=['tailRatePerKey','headIsolation','sameFingerRecovery','tailAsynchrony','tailTimingVariability',
 'heldOtherAtTail','sameHandOrder','releaseChordFraction','independentHeldRelease'];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)));};
const ratio=(gap,scale)=>Number.isFinite(gap)?gap/(gap+scale):1;

function releaseContext(ctx){
 // Timing-normalized geometry uses the active quarter-beat. Without timing
 // points use a scale inferred from actual event gaps, not a new fixed-ms gate.
 const times=[...new Set([...ctx.map.notes.map(n=>n.t),...ctx.tails.map(n=>n.t)])].sort((a,b)=>a-b);
 const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
 return {...ctx,releaseFallbackScale:gaps[Math.floor((gaps.length-1)/2)]||1};
}
function scaleAt(ctx,t){
 const points=ctx.map.timingPoints;
 const index=Math.max(0,lb(points,t+1e-8,p=>p.t)-1);
 return points.length?points[index].beatLength/4:ctx.releaseFallbackScale;
}
function releaseGeometry(ctx,start,end){
 const K=ctx.map.keys,tails=ctx.tails,heads=ctx.map.notes;
 const lo=lb(tails,start,n=>n.t),hi=lb(tails,end,n=>n.t),n=hi-lo;
 if(!n)return {values:KEYS.map(()=>0),metrics:Object.fromEntries(KEYS.map(k=>[k,0])),tails:0};
 const isolation=[],recovery=[],asynchrony=[],held=[],interaction=[],rhythm=[],width=[];let order=0;
 const hand=c=>K===7&&c===3?-1:c<Math.floor(K/2)?0:1;
 for(let j=lo;j<hi;j++){
  const tail=tails[j],scale=scaleAt(ctx,tail.t),i=lb(heads,tail.t,n=>n.t);
  const before=i>0?tail.t-heads[i-1].t:Infinity,after=i<heads.length?heads[i].t-tail.t:Infinity;
  const independent=ratio(Math.min(before,after),scale);isolation.push(independent);
  const same=ctx.cols[tail.col],next=same[lb(same,tail.t,n=>n.t)];
  recovery.push(ratio(next?next.t-tail.t:Infinity,scale));
  const previous=j?tail.t-tails[j-1].t:Infinity,following=j+1<tails.length?tails[j+1].t-tail.t:Infinity;
  asynchrony.push(ratio(Math.min(previous,following),scale));
  let other=0;
  for(let col=0;col<K;col++){
   if(col===tail.col)continue;
   const holds=ctx.holds[col],last=lb(holds,tail.t,h=>h[0])-1;
   // Immediately BEFORE release: new simultaneous heads do not count, other
   // simultaneous tails are still held. No epsilon-time magic is needed.
   if(last>=0&&holds[last][1]>=tail.t)other++;
  }
  const load=other/Math.max(1,K-1);held.push(load);interaction.push(load*independent);
  const a=lb(tails,tail.t,n=>n.t),b=lb(tails,tail.t+1e-8,n=>n.t);width.push((b-a)/K);
  if(j>lo&&tail.t>tails[j-1].t)rhythm.push(Math.log1p((tail.t-tails[j-1].t)/scale));
  if(j>0&&j+1<tails.length){
   const a=tails[j-1],b=tail,c=tails[j+1],h=hand(b.col);
   // All three timestamp groups must be singletons. Strict a.t < b.t < c.t
   // alone is insufficient: a/c can be the last/first member of a chord,
   // whose arbitrary column ordering reverses under a physical mirror.
   const uniqueEndpoints=(j<2||tails[j-2].t<a.t)&&(j+2>=tails.length||c.t<tails[j+2].t);
   if(uniqueEndpoints&&a.t<b.t&&b.t<c.t&&h>=0&&hand(a.col)===h&&hand(c.col)===h&&new Set([a.col,b.col,c.col]).size===3){
    const distance=Math.abs(a.col-b.col)+Math.abs(b.col-c.col),span=Math.max(a.col,b.col,c.col)-Math.min(a.col,b.col,c.col);
    order+=(distance-span)/Math.max(1,Math.floor(K/2)-1)*Math.exp(-(c.t-a.t)/(3*scale));
   }
  }
 }
 const values=[n/((end-start)/1000)/K,mean(isolation),mean(recovery),mean(asynchrony),sd(rhythm),
  mean(held),order/n,mean(width),mean(interaction)];
 if(values.some(v=>!Number.isFinite(v)))throw Error('Nonfinite release geometry');
 return {values,metrics:Object.fromEntries(KEYS.map((k,i)=>[k,values[i]])),tails:n};
}
module.exports={KEYS,releaseContext,releaseGeometry};

}],cache={};
function load(id){if(!cache[id]){const m=cache[id]={exports:{}};modules[id](m,m.exports,load);}return cache[id].exports;}
return load(0);})();

},
function(module,exports,load){
'use strict';
const { lowerBound } = load(2);

// A display measurement, not a replacement for the archived model's features.
// Round-to-ms timestamps on a uniform sequence can deviate from the line
// through its two endpoints by at most one source millisecond. This bound
// scales with the clock rate; it is not a fitted rhythm/confidence threshold.
function regularRowCadence(ctx, start, end, speedRate = 1) {
  const { rows } = ctx;
  const lo = lowerBound(rows, start, r => r.t), hi = lowerBound(rows, end, r => r.t);
  const count = hi - lo;
  // Match the existing grid fitter's minimum four-row support.
  if (count < 4) return null;
  const first = rows[lo].t, spacingMs = (rows[hi - 1].t - first) / (count - 1);
  const resolutionMs = 1 / speedRate;
  let maxResidualMs = 0;
  for (let i = 0; i < count; i++) {
    maxResidualMs = Math.max(maxResidualMs, Math.abs(rows[lo + i].t - (first + i * spacingMs)));
  }
  const epsilon = 16 * Number.EPSILON * Math.max(1, Math.abs(first), Math.abs(rows[hi - 1].t));
  if (!(spacingMs > 0) || maxResidualMs > resolutionMs + epsilon) return null;
  const bpm = 15000 / spacingMs;
  return { source: 'uniform-rows-within-source-ms', equivBpm: Math.round(bpm + 16 * Number.EPSILON * Math.max(1, bpm)),
    rowCount: count, spacingMs, maxResidualMs, resolutionMs };
}

const DISPLAY_TAGS = new Set(['chordjack', 'minijack', 'dense chordstream', 'fast chordstream',
  'speed', 'tech', 'wildcard', 'coordination', 'density']);
function jackClockMatchesRows(ctx, start, end) {
  const lo = lowerBound(ctx.rows, start, r => r.t), hi = lowerBound(ctx.rows, end, r => r.t);
  if (lo === hi) return false;
  const firstMask = ctx.rows[lo].mask;
  let allChords = true, sameGrip = true;
  for (let i = lo; i < hi; i++) {
    const mask = ctx.rows[i].mask;
    allChords &&= (mask & (mask - 1)) !== 0;
    sameGrip &&= mask === firstMask;
  }
  // The archive measures chord-row cadence for Jack, falling back to
  // same-column repetition. Do not replace either by an interleaved row clock.
  return allChords || sameGrip;
}
function correctCadenceDisplay(result, ctx, speedRate = 1) {
  for (const segment of result.segments) {
    if (!DISPLAY_TAGS.has(segment.tag)) continue;
    const start = segment.evidence?.sourceStart ?? segment.start;
    const end = segment.evidence?.sourceEnd ?? segment.end;
    if (['chordjack', 'minijack'].includes(segment.tag) && !jackClockMatchesRows(ctx, start, end)) continue;
    const measured = regularRowCadence(ctx, start, end, speedRate);
    if (!measured) continue;
    const { equivBpm, ...evidence } = measured;
    segment.evidence.cadence = { ...evidence, measuredStart:start,measuredEnd:end,legacyEquivBpm: segment.evidence.archivedEquivBpm??segment.equivBpm };
    segment.equivBpm = equivBpm;
  }
  result.modelInfo.cadencePolicy = 'uniform rows measured directly; other archived cadence unchanged';
  return result;
}
module.exports = { regularRowCadence, correctCadenceDisplay };

},
function(module,exports,load){
'use strict';
const {lowerBound:lb}=load(2);
const {correctCadenceDisplay}=load(10);
const CS=new Set(['dense chordstream','fast chordstream']);
const STEP_MS=500,CONTEXT_MS=4000,MIN_DISPLAY_MS=1800;

// Exact hand events, not globally adjacent rows. The flexible centre thumb is
// assigned to either hand; exclusion must hold under BOTH assignments.
function prepareHands(ctx){
  return [0,1].map(thumb=>[0,1].map(side=>{
    const rows=[];
    for(const n of ctx.map.notes){
      if((n.col===3?thumb:n.col<3?0:1)!==side)continue;
      const last=rows.at(-1);if(last&&last.t===n.t)last.mask|=1<<n.col;else rows.push({t:n.t,mask:1<<n.col});
    }
    return rows;
  }));
}
function noCut(ctx,hands,start,end){
  const a=lb(ctx.rows,start,r=>r.t),b=lb(ctx.rows,end,r=>r.t);
  if(b-a<4)return false;
  const t=lb(ctx.tails,start,r=>r.t);if(t<ctx.tails.length&&ctx.tails[t].t<end)return false;
  for(let j=a;j<b;j++)if(ctx.rows[j].lnMask)return false;
  for(const hs of ctx.holds){const j=lb(hs,end,h=>h[0])-1;if(j>=0&&hs[j][1]>start)return false;}
  for(const view of hands){
    let pairs=0;
    for(const rows of view){
      const lo=lb(rows,start,r=>r.t),hi=lb(rows,end,r=>r.t);
      for(let i=Math.max(1,lo);i<hi;i++){pairs++;if(rows[i-1].mask!==rows[i].mask)return false;}
    }
    if(!pairs)return false;
  }
  return true;
}
function excludeCut(s){
  const scores={...s.scores,'dense chordstream':0,'fast chordstream':0};
  if(!CS.has(s.tag))return {...s,scores,secondary:CS.has(s.secondary)?undefined:s.secondary};
  // Anchor/Vibro remain overlapping attributes, not replacement base types.
  const ranked=Object.entries(scores).filter(([c])=>!CS.has(c)&&c!=='anchor'&&c!=='vibro').sort((a,b)=>b[1]-a[1]);
  let [tag,value]=ranked[0]??['wildcard',0];
  if(tag==='wildcard')for(const [c,v]of ranked.slice(1))if(c!=='wildcard'&&v>.3){tag=c;value=v;break;}
  const other=Object.entries(scores).filter(([c])=>c!==tag&&!CS.has(c)).sort((a,b)=>b[1]-a[1])[0];
  const secondary=other&&other[1]>=.75*value&&other[1]>.3?other[0]:undefined;
  return {...s,scores,tag,confidence:Math.min(1,value),secondary};
}

function smoothCadenceFrames(frames,ctx,speedRate=1){
  const same=(a,b)=>a.tag===b.tag&&a.secondary===b.secondary&&a.family===b.family;
  const measured=(s,anchor=s.equivBpm)=>{
    const copy={...s,evidence:{sourceStart:s.start,sourceEnd:s.end}};
    correctCadenceDisplay({segments:[copy],modelInfo:{}},ctx,speedRate);
    const c=copy.evidence.cadence;
    if(c&&Number.isFinite(anchor)){
      const e=c.resolutionMs/(c.rowCount-1),lo=15000/(c.spacingMs+e),hi=c.spacingMs>e?15000/(c.spacingMs-e):Infinity;
      if(lo<=anchor+.5&&hi>=anchor-.5)copy.equivBpm=anchor;
    }
    return c?copy:null;
  };
  const groups=[];
  for(const s of frames){
    const g=groups.at(-1);
    // Keep long original expert boundaries and their distinct scores. Splits
    // introduced only for this readout must not merge those old observations.
    if(g&&same(g,s)&&(g.parent===s.parent||s.parentDuration<MIN_DISPLAY_MS)){
      g.end=s.end;g.children.push(s);
    }else groups.push({...s,children:[s]});
  }
  const labelGroups=[];
  for(let i=0;i<groups.length;i++){
    const g=groups[i],p=labelGroups.at(-1),n=groups[i+1];
    if(g.family==='break'&&g.end-g.start<MIN_DISPLAY_MS&&p&&n&&p.tag===n.tag){p.end=g.end;continue;}
    labelGroups.push(g);
  }
  const out=[];
  for(const g of labelGroups){
    let pending=null;const plateaus=[];
    const finish=()=>{if(pending&&pending.end-pending.start>=MIN_DISPLAY_MS)plateaus.push(pending);pending=null;};
    for(const s of g.children){
      if(pending){const joined=measured({...pending,end:s.end},g.equivBpm);if(joined){pending=joined;continue;}finish();}
      pending=measured(s,g.equivBpm);
    }
    finish();
    const {children,parent,parentDuration,...plain}=g,base={...plain,_archivedEquivBpm:g.equivBpm};
    if(!plateaus.length){out.push(base);continue;}
    const groupStart=out.length;
    const emit=(start,end,bpm,measurement)=>{
      if(end<=start)return;
      const s={...base,start,end,equivBpm:bpm,...(measurement?{evidence:{cadence:{...measurement.evidence.cadence,legacyEquivBpm:g.equivBpm,measuredStart:measurement.start,measuredEnd:measurement.end}}}:{})},previous=out.at(-1);
      if(out.length>groupStart&&previous.end===s.start&&same(previous,s)&&previous.equivBpm===s.equivBpm)previous.end=s.end;else out.push(s);
    };
    let cursor=g.start;
    for(let i=0;i<plateaus.length;i++){
      const p=plateaus[i],gap=p.start-cursor;let start=p.start;
      if(gap>=MIN_DISPLAY_MS)emit(cursor,p.start,g.equivBpm);
      else if(i===0)start=cursor;
      else if(gap>0)out.at(-1).end=p.start;
      emit(start,p.end,p.equivBpm,p);cursor=p.end;
    }
    if(g.end-cursor>=MIN_DISPLAY_MS)emit(cursor,g.end,g.equivBpm);
    else if(g.end>cursor)out.at(-1).end=g.end;
  }
  return out;
}
function refine(ctx,source,classes,{speedRate=1,supportPower=1,resolveBpm}={}){
  const map=ctx.map,hands=prepareHands(ctx),frames=[],support=[];let exclusions=0;
  source.forEach((old,parent)=>{
    const scores=old.scores??{[old.tag]:1},div=Math.max(1,...Object.values(scores));
    const q=classes.map(c=>old.family==='break'?0:Math.min(.999,Math.max(0,scores[c]??0)/div)**supportPower);
    for(let start=old.start;start<old.end;start+=STEP_MS){
      const end=Math.min(old.end,start+STEP_MS),mid=(start+end)/2,a=Math.max(map.firstNote,mid-CONTEXT_MS/2),b=Math.max(a+1,Math.min(map.lastNote,mid+CONTEXT_MS/2));
      const excluded=old.family==='rc'&&noCut(ctx,hands,a,b);let s={...old,start,end,parent,parentDuration:old.end-old.start};
      if(excluded){s=excludeCut(s);exclusions++;}
      if(s.tag!==old.tag&&resolveBpm){const bpm=resolveBpm(s.tag,parent);if(bpm===undefined)delete s.equivBpm;else s.equivBpm=bpm;}
      frames.push(s);support.push(q.map((v,j)=>excluded&&CS.has(classes[j])?0:v));
    }
  });
  return {frames,support,segments:smoothCadenceFrames(frames,ctx,speedRate),exclusions};
}
module.exports={refine,prepareHands,noCut,smoothCadenceFrames};

},
function(module,exports,load){
/* Generated by node scripts/build-overlay.cjs; MIT; archive unchanged. */
"use strict";
var TagClassifier = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    analyzeMap: () => analyzeMap,
    buildCachedMap: () => buildCachedMap,
    extractIntermediate: () => extractIntermediate
  });

  // src/parser/osu.ts
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function parseOsu(text) {
    const lines = text.split(/\r?\n/);
    let section = "";
    const notes = [];
    const timingPoints = [];
    const breaks = [];
    let keys = 0;
    let od = 6;
    let hp;
    let title;
    let artist;
    let version;
    let creator;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("[")) {
        section = line.slice(1, line.indexOf("]")).toLowerCase();
        continue;
      }
      switch (section) {
        case "general":
          if (line.startsWith("Mode:")) {
            if (parseInt(line.slice(5).trim(), 10) !== 3) {
              throw new Error("NotMania");
            }
          }
          break;
        case "metadata": {
          const ci = line.indexOf(":");
          if (ci < 0) break;
          const k = line.slice(0, ci).trim();
          const v = line.slice(ci + 1).trim();
          if (k === "Title") title = v;
          else if (k === "Artist") artist = v;
          else if (k === "Version") version = v;
          else if (k === "Creator") creator = v;
          break;
        }
        case "difficulty": {
          const ci = line.indexOf(":");
          if (ci < 0) break;
          const k = line.slice(0, ci).trim();
          const v = parseFloat(line.slice(ci + 1).trim());
          if (k === "CircleSize") keys = v > 0 ? Math.round(v) : 10;
          else if (k === "OverallDifficulty") od = v;
          else if (k === "HPDrainRate") hp = v;
          break;
        }
        case "events": {
          if (line.startsWith("2 ") || line.startsWith("2	")) {
            const parts = line.split(/\s+/);
            const s = parseInt(parts[1], 10);
            const e = parseInt(parts[2], 10);
            if (Number.isFinite(s) && Number.isFinite(e)) breaks.push([s, e]);
          }
          break;
        }
        case "timingpoints": {
          const p = line.split(",");
          if (p.length < 2) break;
          const t = parseFloat(p[0]);
          const bl = parseFloat(p[1]);
          const uninherited = p.length >= 7 ? p[6].trim() !== "0" : bl > 0;
          if (uninherited && bl > 0 && Number.isFinite(t)) timingPoints.push({ t, beatLength: bl });
          break;
        }
        case "hitobjects": {
          if (!keys) keys = 7;
          const p = line.split(",");
          if (p.length < 5) break;
          const x = parseFloat(p[0]);
          if (!Number.isFinite(x)) break;
          const type = parseInt(p[3], 10);
          const t = Math.round(parseFloat(p[2]));
          const col = clamp(Math.trunc(x * keys / 512), 0, keys - 1);
          if (type & 128) {
            const tailField = p[5] ?? p[4];
            const lnEnd = Math.round(parseFloat(String(tailField).split(":")[0]));
            notes.push({ t, col, lnEnd: Number.isFinite(lnEnd) ? Math.max(lnEnd, t) : null });
          } else if (type & 1) {
            notes.push({ t, col, lnEnd: null });
          }
          break;
        }
      }
    }
    if (!notes.length) throw new Error("EmptyBeatmap");
    notes.sort((a, b) => a.t - b.t || a.col - b.col);
    timingPoints.sort((a, b) => a.t - b.t);
    let lastNote = 0;
    for (const n of notes) lastNote = Math.max(lastNote, n.lnEnd ?? n.t);
    return {
      keys,
      notes,
      timingPoints,
      breaks,
      meta: { title, artist, version, creator, od, hp },
      firstNote: notes[0].t,
      lastNote
    };
  }
  function beatLengthAt(tps, t) {
    if (!tps.length) return 500;
    let lo = 0;
    let hi = tps.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >> 1;
      if (tps[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return tps[lo].beatLength;
  }

  // src/config.ts
  var CONFIG = {
    /** merge hits within this window into one row */
    rowMergeMs: 10,
    // ---- grid fitting ----
    /** tolerance around grid points (ms) */
    gridTolMs: 30,
    /** minimum fraction of hits that must sit on the grid to count as "regular" */
    gridMinRatio: 0.6,
    /** candidate spacings below this (ms) are halved/doubled to normalize */
    gridMinSpacing: 45,
    gridMaxSpacing: 2e3,
    // ---- feature windows ----
    /** feature window length (ms) */
    winMs: 1e3,
    /** feature window step (ms) */
    winStepMs: 250,
    /** windows shorter than this note count get flagged low-density */
    winMinNotes: 4,
    // ---- segmentation ----
    /** minimum prominence (absolute) for a change point */
    segProminenceAbs: 0.05,
    /** minimum prominence relative to local signal scale */
    segProminenceRel: 0.35,
    /** minimum segment length before merging (ms) */
    minSegLenMs: 3e3,
    /** when merging a short segment, prefer the neighbor whose feature dist is smaller */
    mergeBySimilarity: true,
    /** gap between consecutive notes considered a rest (ms) */
    restGapMs: 2500,
    /** a segment whose nps is below this quantile of map nps may be Break */
    breakNpsQuantile: 0.25,
    /** absolute nps floor under which a segment is Break regardless */
    breakAbsNps: 1.2,
    // ---- classification ----
    /** weighted LN-head stream ratio above which a segment is LN-dominant */
    lnDominantRatio: 0.45,
    /** min confidence for displaying a secondary tag */
    secondaryMargin: 0.75,
    // ---- overall aggregation ----
    /** share of best tag's weight over total for a single dominant tag */
    overallDominantShare: 0.52,
    /** minimum weight share for a tag to be counted in mix counting */
    overallMixShare: 0.07
  };

  // src/core/rows.ts
  function popcount(mask) {
    let c = 0;
    while (mask) {
      mask &= mask - 1;
      c++;
    }
    return c;
  }
  function buildRows(map) {
    const rows = [];
    const merge = CONFIG.rowMergeMs;
    let i = 0;
    const n = map.notes.length;
    while (i < n) {
      const t0 = map.notes[i].t;
      let mask = 0;
      let lnHeadMask = 0;
      let lnTailMask = 0;
      while (i < n && map.notes[i].t - t0 <= merge) {
        const nt = map.notes[i];
        mask |= 1 << nt.col;
        if (nt.lnEnd != null) lnHeadMask |= 1 << nt.col;
        i++;
      }
      rows.push({ t: t0, mask, hits: popcount(mask), lnHeadMask, lnTailMask });
    }
    return rows;
  }
  function attachTails(map, rows) {
    const tails = [];
    for (const n of map.notes) {
      if (n.lnEnd != null) tails.push({ t: n.lnEnd, col: n.col });
    }
    tails.sort((a, b) => a.t - b.t);
    let ri = 0;
    const extra = [];
    for (const tail of tails) {
      while (ri + 1 < rows.length && rows[ri + 1].t <= tail.t + CONFIG.rowMergeMs) ri++;
      let best = -1;
      let bestDist = Infinity;
      for (let k = ri; k >= 0 && rows[k].t >= tail.t - CONFIG.rowMergeMs * 4; k--) {
        const d = Math.abs(rows[k].t - tail.t);
        if (d < bestDist && d <= CONFIG.rowMergeMs * 4) {
          bestDist = d;
          best = k;
        }
      }
      if (best >= 0) {
        rows[best].lnTailMask |= 1 << tail.col;
      } else {
        extra.push({ t: tail.t, mask: 0, hits: 0, lnHeadMask: 0, lnTailMask: 1 << tail.col });
      }
    }
    if (extra.length) {
      rows.push(...extra);
      rows.sort((a, b) => a.t - b.t);
    }
  }
  function buildColumnData(map) {
    const K = map.keys;
    const colNotes = Array.from({ length: K }, () => []);
    for (const n of map.notes) colNotes[n.col].push(n.t);
    const colIntervals = [];
    for (let c = 0; c < K; c++) {
      const arr = colNotes[c];
      const iv = [];
      for (let i = 1; i < arr.length; i++) iv.push(arr[i] - arr[i - 1]);
      colIntervals.push(iv);
    }
    return { colNotes, colIntervals };
  }
  function computeHeld(map, rows) {
    const events = [];
    for (const n of map.notes) {
      if (n.lnEnd != null && n.lnEnd - n.t > 1) {
        events.push({ t: n.t, col: n.col, type: 0 });
        events.push({ t: n.lnEnd, col: n.col, type: 1 });
      }
    }
    events.sort((a, b) => a.t - b.t || a.type - b.type);
    const heldMask = new Int32Array(rows.length);
    const lockRow = new Uint8Array(rows.length);
    const freeHits = new Int32Array(rows.length);
    const heldHits = new Int32Array(rows.length);
    let held = 0;
    let ei = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const t = rows[ri].t;
      while (ei < events.length && events[ei].t <= t) {
        const e = events[ei];
        if (e.type === 0) held |= 1 << e.col;
        else held &= ~(1 << e.col);
        ei++;
      }
      heldMask[ri] = held;
      if (held) {
        const free = rows[ri].mask & ~held;
        const onHeld = rows[ri].mask & held;
        freeHits[ri] = popcount(free);
        heldHits[ri] = popcount(onHeld);
        lockRow[ri] = held !== 0 && free !== 0 ? 1 : 0;
      } else {
        freeHits[ri] = rows[ri].hits;
        heldHits[ri] = 0;
      }
    }
    return { heldMask, lockRow, freeHits, heldHits };
  }

  // src/core/grid.ts
  function gridCoverage(times, spacing, tol) {
    const n = times.length;
    if (n === 0 || spacing <= 0) return 0;
    const bins = Math.max(8, Math.round(spacing / Math.max(tol, 5)));
    const hist = new Int32Array(bins);
    for (let i = 0; i < n; i++) {
      let m = times[i] % spacing;
      if (m < 0) m += spacing;
      hist[Math.min(bins - 1, Math.floor(m / spacing * bins))]++;
    }
    let peakBin = 0;
    for (let b = 1; b < bins; b++) if (hist[b] > hist[peakBin]) peakBin = b;
    const phase = (peakBin + 0.5) / bins * spacing;
    let onGrid = 0;
    for (let i = 0; i < n; i++) {
      let d = (times[i] - phase) % spacing;
      if (d < 0) d += spacing;
      if (d > spacing / 2) d = spacing - d;
      if (d <= tol) onGrid++;
    }
    return onGrid / n;
  }
  function fitGrid(rows, tStart, tEnd, lo, hi) {
    const times = [];
    if (lo !== void 0 && hi !== void 0) {
      for (let i = lo; i < hi; i++) {
        const r = rows[i];
        if (r.hits > 0) times.push(r.t);
      }
    } else {
      for (const r of rows) {
        if (r.hits > 0 && r.t >= tStart && r.t <= tEnd) times.push(r.t);
      }
    }
    const n = times.length;
    if (n < 4) return { spacing: 0, ratio: 0, equivBpm: 0 };
    const uniq = [times[0]];
    for (let i = 1; i < n; i++) if (times[i] - uniq[uniq.length - 1] > CONFIG.rowMergeMs) uniq.push(times[i]);
    const arr = Float64Array.from(uniq);
    const ivs = [];
    for (let i = 1; i < arr.length; i++) ivs.push(arr[i] - arr[i - 1]);
    ivs.sort((a, b) => a - b);
    const medianIv = ivs[Math.floor(ivs.length / 2)] || 500;
    const tol = CONFIG.gridTolMs;
    let bestSpacing = 0;
    let bestRatio = 0;
    const evaluate = (s) => {
      if (!(s >= CONFIG.gridMinSpacing && s <= CONFIG.gridMaxSpacing)) return;
      const cov = gridCoverage(arr, s, tol);
      if (cov > bestRatio + 1e-9 || Math.abs(cov - bestRatio) <= 1e-9 && s > bestSpacing) {
        bestRatio = cov;
        bestSpacing = s;
      }
    };
    const bases = [medianIv, medianIv / 2];
    for (const b of bases) {
      for (let mult = 1; mult <= 6; mult++) evaluate(b * mult);
    }
    if (bestRatio < CONFIG.gridMinRatio) {
      for (let s = CONFIG.gridMinSpacing; s <= 800; s = s * 1.12) evaluate(s);
    }
    return {
      spacing: bestSpacing,
      ratio: bestRatio,
      equivBpm: bestSpacing > 0 ? 15e3 / bestSpacing : 0
    };
  }

  // src/core/features.ts
  function buildFeatureContext(map, rows, held, cols) {
    const K = map.keys;
    const boundaryTimes = [];
    for (let b = 0; b <= K; b++) boundaryTimes.push(new Float64Array(0));
    for (let b = 1; b < K; b++) {
      const a = cols.colNotes[b - 1];
      const c = cols.colNotes[b];
      const merged = new Float64Array(a.length + c.length);
      let i = 0, j = 0, m = 0;
      while (i < a.length && j < c.length) merged[m++] = a[i] <= c[j] ? a[i++] : c[j++];
      while (i < a.length) merged[m++] = a[i++];
      while (j < c.length) merged[m++] = c[j++];
      boundaryTimes[b] = merged.subarray(0, m);
    }
    const lnHeads = [];
    const lnTails = [];
    const allEvents = [];
    for (const n of map.notes) {
      if (n.lnEnd != null) {
        lnHeads.push({ t: n.t, col: n.col, dur: n.lnEnd - n.t });
        lnTails.push({ t: n.lnEnd, col: n.col, start: n.t });
        allEvents.push({ t: n.t, col: n.col, kind: "head" });
        allEvents.push({ t: n.lnEnd, col: n.col, kind: "tail" });
      } else {
        allEvents.push({ t: n.t, col: n.col, kind: "head" });
      }
    }
    allEvents.sort((a, b) => a.t - b.t);
    lnTails.sort((a, b) => a.t - b.t);
    let lnMaxDur = 0;
    for (const h of lnHeads) if (h.dur > lnMaxDur) lnMaxDur = h.dur;
    const riceArr = map.notes.filter((n) => n.lnEnd == null).map((n) => n.t);
    riceArr.sort((a, b) => a - b);
    const riceTimes = Float64Array.from(riceArr);
    return { map, rows, held, cols, boundaryTimes, lnHeads, lnTails, lnMaxDur, allEvents, riceTimes };
  }
  function lowerBound(arr, t) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (arr[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function lowerBoundObj(arr, t, key) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (key(arr[mid]) < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function upperBoundObj(arr, t, key) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (key(arr[mid]) <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  var BOUNDARY_W = {
    7: [0.225, 0.35, 0.25, 0.225, 0.225, 0.25, 0.35, 0.225]
  };
  function cutDemandInWindow(ctx, t0, t1) {
    const K = ctx.map.keys;
    const w = BOUNDARY_W[K] ?? Array.from({ length: K + 1 }, (_, i) => Math.abs(i - K / 2) < 1 ? 0.05 : 0.35);
    let sum = 0;
    for (let b = 1; b < K; b++) {
      const arr = ctx.boundaryTimes[b];
      const lo = lowerBound(arr, t0);
      const hi = lowerBound(arr, t1);
      if (hi - lo < 2) continue;
      for (let i = lo + 1; i < hi; i++) {
        const dt = (arr[i] - arr[i - 1]) / 1e3;
        if (dt > 0 && dt < 0.5) sum += w[b] / (dt * dt);
      }
    }
    return sum / ((t1 - t0) / 1e3);
  }
  function computeWindowFeatures(ctx, t0, t1) {
    const rows = ctx.rows;
    const held = ctx.held;
    const K = ctx.map.keys;
    const durS = (t1 - t0) / 1e3;
    const loIdx = Math.max(0, lowerBoundObj(rows, t0, (r) => r.t) - 1);
    const hiIdx = lowerBoundObj(rows, t1, (r) => r.t);
    let notes = 0;
    let rowCount = 0;
    let chordSum = 0;
    let largeHits = 0, multiHits = 0, singleRows = 0;
    let jackPairs = 0, pairCount = 0, overlapSum = 0, cutPairs = 0;
    const ivs = [];
    for (let i = loIdx; i < hiIdx; i++) {
      const r = rows[i];
      const inWin = r.t >= t0 && r.t < t1;
      if (!inWin || r.hits === 0) continue;
      rowCount++;
      notes += r.hits;
      chordSum += r.hits;
      if (r.hits >= 3) largeHits += r.hits;
      if (r.hits >= 2) multiHits += r.hits;
      if (r.hits === 1) singleRows++;
      if (i > 0 && rows[i - 1].hits > 0) {
        const prev = rows[i - 1];
        const ovMask = prev.mask & r.mask;
        const ov = popcount(ovMask);
        pairCount++;
        if (ov > 0) {
          jackPairs++;
          overlapSum += ov / Math.min(prev.hits, r.hits);
        } else cutPairs++;
        ivs.push(r.t - prev.t);
      }
    }
    const f = {
      t: t0,
      end: t1,
      nps: notes / durS,
      rows: rowCount,
      notes,
      equivBpm: 0,
      gridRatio: 0,
      rhythmSteady: 0,
      chordMean: rowCount ? chordSum / rowCount : 0,
      largeChordRatio: notes ? largeHits / notes : 0,
      multiRatio: notes ? multiHits / notes : 0,
      singleRatio: rowCount ? singleRows / rowCount : 0,
      jackRowRatio: pairCount ? jackPairs / pairCount : 0,
      overlapDegree: jackPairs ? overlapSum / jackPairs : 0,
      jackSpeedBpm: 0,
      cutFreeRatio: pairCount ? cutPairs / pairCount : 0,
      cutDemand: 0,
      anchorRate: 0,
      trillRate: 0,
      altHandRate: 0,
      rollRate: 0,
      graceRate: 0,
      offBeatRatio: 0,
      lnWeightRatio: 0,
      lockRatio: 0,
      lnAreaRatio: 0,
      heldCoverage: 0,
      tailRate: 0,
      tailIndependence: 0,
      tailScatter: 0,
      shortLnRatio: 0,
      invGapScore: 0
    };
    if (rowCount === 0) return f;
    const gridLo = lowerBoundObj(rows, t0, (r) => r.t);
    const gridHi = upperBoundObj(rows, t1 - 1, (r) => r.t);
    const grid = fitGrid(rows, t0, t1 - 1, gridLo, gridHi);
    f.equivBpm = grid.equivBpm;
    f.gridRatio = grid.ratio;
    if (ivs.length >= 3) {
      const sorted = [...ivs].sort((a, b) => a - b);
      const modal = sorted[Math.floor(sorted.length / 2)];
      let steady = 0;
      let grace = 0;
      for (const iv of ivs) {
        const q = iv / modal;
        const nearest = Math.max(1, Math.round(q));
        if (Math.abs(iv - nearest * modal) <= CONFIG.gridTolMs) steady++;
        if (iv < modal * 0.45) grace++;
      }
      f.rhythmSteady = steady / ivs.length;
      f.graceRate = grace / ivs.length;
      const repDts = [];
      const cols = ctx.cols.colNotes;
      for (let c = 0; c < K; c++) {
        const arr = cols[c];
        const clo = lowerBound(arr, t0);
        const chi = lowerBound(arr, t1);
        for (let i = clo + 1; i < chi; i++) {
          const dt = arr[i] - arr[i - 1];
          if (dt < 1e3) repDts.push(dt);
        }
      }
      if (repDts.length) {
        repDts.sort((a, b) => a - b);
        const med = repDts[Math.floor(repDts.length / 2)];
        f.jackSpeedBpm = med > 0 ? Math.min(15e3 / med, 400) : 0;
      }
    }
    {
      let anchorNotes = 0;
      for (let c = 0; c < K; c++) {
        const arr = ctx.cols.colNotes[c];
        const clo = lowerBound(arr, t0);
        const chi = lowerBound(arr, t1);
        let run = 1;
        let dts = [];
        const flush = () => {
          if (run >= 3 && dts.length >= 2) {
            const m = dts.reduce((x, y) => x + y, 0) / dts.length;
            const v = dts.reduce((x, y) => x + (y - m) ** 2, 0) / dts.length;
            if (m > 0 && Math.sqrt(v) / m < 0.3) anchorNotes += run;
          }
        };
        for (let i = clo + 1; i < chi; i++) {
          const dt = arr[i] - arr[i - 1];
          const ref = dts.length ? dts[dts.length - 1] : dt;
          if (dt > ref * 1.8 || dt < ref * 0.56 || dt > 1500) {
            flush();
            run = 1;
            dts = [];
          } else {
            run++;
            dts.push(dt);
          }
        }
        flush();
      }
      f.anchorRate = notes ? anchorNotes / notes : 0;
      const split2 = K <= 1 ? 1 : Math.ceil(K / 2);
      const seq = [];
      for (let i = loIdx; i < hiIdx; i++) {
        const r = rows[i];
        if (r.hits === 0 || r.t < t0 || r.t >= t1) continue;
        let col = -1, left = 0;
        for (let c = 0; c < K; c++) {
          if (r.mask & 1 << c) {
            col = c;
            if (c < split2) left++;
          }
        }
        seq.push({ t: r.t, col: r.hits === 1 ? col : -1, hand: left * 2 >= r.hits ? 0 : 1, hits: r.hits });
      }
      let altHandRows = 0;
      {
        let run = 1;
        for (let i = 1; i < seq.length; i++) {
          const cont = seq[i].hand !== seq[i - 1].hand && (i >= 2 ? seq[i].hand === seq[i - 2].hand : false);
          if (cont) run++;
          else {
            if (run >= 4) altHandRows += run;
            run = i + 1 < seq.length && seq[i + 1].hand !== seq[i].hand ? 2 : 1;
          }
        }
        if (run >= 4) altHandRows += run;
      }
      f.altHandRate = seq.length ? altHandRows / seq.length : 0;
      let trillRows = 0;
      {
        const singles = seq.filter((s) => s.hits === 1);
        let run = 1;
        for (let i = 1; i < singles.length; i++) {
          const cont = singles[i].col !== singles[i - 1].col && (i >= 2 ? singles[i].col === singles[i - 2].col && singles[i - 1].col !== singles[i - 2].col : false);
          if (cont) run++;
          else {
            if (run >= 5) trillRows += run;
            run = 1;
          }
        }
        if (run >= 5) trillRows += run;
        f.trillRate = singles.length ? trillRows / singles.length : 0;
      }
      {
        const singles = seq.filter((s) => s.hits === 1);
        let dir = 0, run = 1, rollRows = 0;
        for (let i = 1; i < singles.length; i++) {
          const d = Math.sign(singles[i].col - singles[i - 1].col);
          if (d !== 0 && (dir === 0 || d === dir)) {
            dir = d;
            run++;
          } else {
            if (run >= 4) rollRows += run;
            run = d !== 0 ? 2 : 1;
            dir = d;
          }
        }
        if (run >= 4) rollRows += run;
        f.rollRate = singles.length ? rollRows / singles.length : 0;
      }
      if (ctx.map.timingPoints.length && seq.length) {
        const anchor = ctx.map.timingPoints[0].t;
        let off = 0;
        for (const s of seq) {
          const q = beatLengthAt(ctx.map.timingPoints, s.t) / 4;
          let d = (s.t - anchor) % q;
          if (d < 0) d += q;
          if (d > q / 2) d = q - d;
          if (d > 40) off++;
        }
        f.offBeatRatio = off / seq.length;
      }
    }
    const split = K <= 1 ? 1 : Math.ceil(K / 2);
    {
      let lnW = 0;
      const heads = ctx.lnHeads;
      const hFrom = lowerBoundObj(heads, t0, (h) => h.t);
      const hTo = lowerBoundObj(heads, t1, (h) => h.t);
      for (let i = hFrom; i < hTo; i++) lnW += 1 + Math.min(heads[i].dur, 1200) / 400;
      const riceCount = lowerBound(ctx.riceTimes, t1) - lowerBound(ctx.riceTimes, t0);
      const totalW = lnW + riceCount;
      f.lnWeightRatio = totalW > 0 ? lnW / totalW : 0;
      let heldSum = 0, heldCount = 0;
      for (let i = loIdx; i < hiIdx; i++) {
        const r = rows[i];
        if (r.t < t0 || r.t >= t1 || r.hits === 0) continue;
        const hm = held.heldMask[i];
        if (hm) {
          heldSum += popcount(hm);
          heldCount++;
          if ((r.mask & ~hm) !== 0) f.lockRatio += 1;
        }
      }
      f.lockRatio /= rowCount;
      f.heldCoverage = heldCount ? heldSum / heldCount / K : 0;
      {
        const hs = ctx.lnHeads;
        const ts = ctx.lnTails;
        const active = [];
        const aLo = lowerBoundObj(hs, t0 - ctx.lnMaxDur, (h) => h.t);
        const aHi = lowerBoundObj(hs, t1, (h) => h.t);
        for (let i = aLo; i < aHi; i++) {
          const h = hs[i];
          if (h.t + h.dur >= t0) active.push({ start: h.t, end: h.t + h.dur });
        }
        const tLo = lowerBoundObj(ts, t0, (x) => x.t);
        const tHi = upperBoundObj(ts, t1, (x) => x.t);
        for (let i = tLo; i < tHi; i++) {
          const tl = ts[i];
          if (tl.start < t0) active.push({ start: tl.start, end: tl.t });
        }
        let area = 0;
        for (const ln of active) {
          const s = Math.max(ln.start, t0);
          const e = Math.min(ln.end, t1);
          if (e > s) area += e - s;
        }
        f.lnAreaRatio = area / ((t1 - t0) * K);
      }
      const tails = ctx.lnTails;
      const ti = lowerBoundObj(tails, t0, (x) => x.t);
      const tj = lowerBoundObj(tails, t1, (x) => x.t);
      const nTails = tj - ti;
      f.tailRate = nTails / durS;
      if (nTails > 0) {
        let indep = 0;
        const durs = [];
        const gaps = [];
        for (let i = ti; i < tj; i++) {
          durs.push(tails[i].t - tails[i].start);
          const ev = ctx.allEvents;
          const ei = lowerBoundObj(ev, tails[i].t, (e) => e.t);
          if (ei < ev.length && ev[ei].t - tails[i].t < 3e3) {
            if (ev[ei].col !== tails[i].col) indep++;
          }
          const carr = ctx.cols.colNotes[tails[i].col];
          const ci = lowerBound(carr, tails[i].t);
          if (ci < carr.length) {
            const g = carr[ci] - tails[i].t;
            if (g < 1500) gaps.push(g);
          }
        }
        f.tailIndependence = indep / nTails;
        const meanDur = durs.reduce((a, b) => a + b, 0) / durs.length;
        const varDur = durs.reduce((a, b) => a + (b - meanDur) ** 2, 0) / durs.length;
        f.tailScatter = meanDur > 0 ? Math.sqrt(varDur) / meanDur : 0;
        let shortLn = 0;
        for (let i = hFrom; i < hTo; i++) if (heads[i].dur < 300) shortLn++;
        const nLnHeads = hTo - hFrom;
        f.shortLnRatio = nLnHeads ? shortLn / nLnHeads : 0;
        if (gaps.length >= 3) {
          const mg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const vg = gaps.reduce((a, b) => a + (b - mg) ** 2, 0) / gaps.length;
          const cv = mg > 0 ? Math.sqrt(vg) / mg : 1;
          const smallness = clamp01(1 - mg / 800);
          const uniformity = clamp01(1 - cv);
          f.invGapScore = (smallness * 0.5 + uniformity * 0.5) * Math.min(1, gaps.length / Math.max(3, nTails));
        }
      }
    }
    f.cutDemand = cutDemandInWindow(ctx, t0, t1);
    return f;
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function computeAllWindows(ctx) {
    const out = [];
    const { firstNote, lastNote } = ctx.map;
    const step = CONFIG.winStepMs;
    const win = CONFIG.winMs;
    for (let t = firstNote; t < lastNote; t += step) {
      out.push(computeWindowFeatures(ctx, t, Math.min(t + win, lastNote)));
    }
    return out;
  }

  // src/segment/segmenter.ts
  var SEG_FEATURES = [
    "nps",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "cutFreeRatio",
    "cutDemand",
    "rhythmSteady",
    "gridRatio",
    "anchorRate",
    "offBeatRatio",
    "techRate",
    "lnWeightRatio",
    "lockRatio",
    "heldCoverage",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore"
  ];
  function techRate(w) {
    return Math.max(w.trillRate, w.altHandRate, w.rollRate);
  }
  function segFeatValue(w, k) {
    switch (k) {
      case "techRate":
        return techRate(w);
      default:
        return w[k];
    }
  }
  function normalizeWindows(windows) {
    const names = [...SEG_FEATURES];
    const n = windows.length;
    const values = new Array(n);
    if (n === 0) return { values, featureNames: names };
    for (const key of names) {
      const raw = new Float64Array(n);
      for (let i = 0; i < n; i++) raw[i] = segFeatValue(windows[i], key);
      const sorted = Float64Array.from(raw).sort();
      const q = (p) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
      const med = q(0.5);
      let scale = q(0.9) - q(0.1);
      if (scale < 1e-6) scale = Math.max(Math.abs(med) * 0.5, 1e-6);
      const logTailed = key === "cutDemand" || key === "jackSpeedBpm" || key === "nps" || key === "tailRate";
      for (let i = 0; i < n; i++) {
        let x = raw[i];
        if (logTailed) x = Math.log1p(Math.max(0, x) / 5);
        const z = (x - (logTailed ? Math.log1p(Math.max(0, med) / 5) : med)) / scale;
        values[i] = values[i] ?? new Float64Array(names.length);
        values[i][names.indexOf(key)] = Math.max(-1, Math.min(2, z));
      }
    }
    return { values, featureNames: names };
  }
  function l1(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  }
  function meanVec(norm, from, to) {
    const out = new Float64Array(norm.featureNames.length);
    let cnt = 0;
    for (let i = from; i < to && i < norm.values.length; i++) {
      for (let j = 0; j < out.length; j++) out[j] += norm.values[i][j];
      cnt++;
    }
    if (cnt > 0) for (let j = 0; j < out.length; j++) out[j] /= cnt;
    return out;
  }
  function detectBoundaries(norm, minSegWindows) {
    const n = norm.values.length;
    if (n < minSegWindows * 2) return [];
    const half = Math.max(2, Math.round(minSegWindows / 2));
    const dist = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = meanVec(norm, Math.max(0, i - half), i);
      const b = meanVec(norm, i, Math.min(n, i + half));
      dist[i] = l1(a, b);
    }
    const sm = new Float64Array(n);
    const k = 1;
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) {
        s += dist[j];
        c++;
      }
      sm[i] = s / c;
    }
    const prom = new Float64Array(n);
    const baseR = minSegWindows;
    for (let i = 0; i < n; i++) {
      const vals = [];
      for (let j = Math.max(0, i - baseR); j <= Math.min(n - 1, i + baseR); j++) vals.push(sm[j]);
      vals.sort((a, b) => a - b);
      const med = vals[Math.floor(vals.length / 2)];
      let scale = vals[Math.floor(vals.length * 0.9)] - med;
      if (scale < 0.02) scale = 0.02;
      prom[i] = sm[i] - med;
      void scale;
    }
    const q = Math.max(1, Math.round(minSegWindows / 6));
    const cands = [];
    for (let i = 1; i < n - 1; i++) {
      let isMax = true;
      for (let j = Math.max(0, i - q); j <= Math.min(n - 1, i + q); j++) {
        if (sm[j] > sm[i]) {
          isMax = false;
          break;
        }
      }
      if (isMax && prom[i] > CONFIG.segProminenceAbs) cands.push({ i, v: prom[i] });
    }
    cands.sort((a, b) => b.v - a.v);
    const promSorted = Float64Array.from(prom).sort();
    const refProm = promSorted[Math.floor(promSorted.length * 0.95)] || CONFIG.segProminenceAbs;
    const relThr = Math.max(CONFIG.segProminenceAbs, refProm * CONFIG.segProminenceRel);
    const picked = [];
    for (const c of cands) {
      if (c.v < relThr) continue;
      if (picked.every((p) => Math.abs(p - c.i) >= minSegWindows)) picked.push(c.i);
    }
    return picked.sort((a, b) => a - b);
  }
  function snapBoundary(rows, t, snapWinMs = 600) {
    let lo = 0, hi = rows.length - 1, best = t, bestGap = 0;
    let i0 = 0;
    {
      let a = 0, b = rows.length;
      while (a < b) {
        const m = a + b >> 1;
        if (rows[m].t < t - snapWinMs) a = m + 1;
        else b = m;
      }
      i0 = a;
    }
    for (let i = Math.max(1, i0); i < rows.length && rows[i].t <= t + snapWinMs; i++) {
      const gap = rows[i].t - rows[i - 1].t;
      const mid = (rows[i].t + rows[i - 1].t) / 2;
      if (gap > bestGap) {
        bestGap = gap;
        best = Math.abs(mid - t) <= snapWinMs ? mid : t;
      }
    }
    return best;
  }
  function segmentMap(input) {
    const { map, rows, windows, norm } = input;
    const step = CONFIG.winStepMs;
    const minSegWindows = Math.max(2, Math.round(CONFIG.minSegLenMs / step));
    const bounds = detectBoundaries(norm, minSegWindows);
    const snapped = bounds.map((bi) => snapBoundary(rows, windows[Math.min(bi, windows.length - 1)].t + step / 2));
    const points = [map.firstNote, ...snapped, map.lastNote];
    const segs = [];
    let prevW = 0;
    for (let i = 0; i < points.length - 1; i++) {
      let s = points[i];
      let e = points[i + 1];
      if (e - s < 50) continue;
      const wEnd = Math.min(windows.length, Math.round((e - map.firstNote) / step));
      segs.push({ start: s, end: e, windowRange: [prevW, Math.max(prevW + 1, wEnd)] });
      prevW = Math.max(prevW + 1, wEnd);
    }
    const vecs = segs.map((s) => meanVec(norm, s.windowRange[0], s.windowRange[1]));
    const merged = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.end - seg.start >= CONFIG.minSegLenMs || merged.length === 0) {
        merged.push({ ...seg });
        continue;
      }
      const last = merged[merged.length - 1];
      const distPrev = l1(vecs[i], vecs[i - 1]);
      const distNext = i + 1 < segs.length ? l1(vecs[i], vecs[i + 1]) : Infinity;
      if (CONFIG.mergeBySimilarity && distNext < distPrev && i + 1 < segs.length) {
        segs[i + 1].start = seg.start;
        segs[i + 1].windowRange[0] = seg.windowRange[0];
      } else {
        last.end = seg.end;
        last.windowRange[1] = seg.windowRange[1];
      }
    }
    const out = merged.filter((s) => s.end - s.start >= 50);
    for (let i = 1; i < out.length; i++) out[i].start = Math.max(out[i].start, out[i - 1].end);
    return out;
  }
  function npsInRange(rows, start, end) {
    let a = 0, b = rows.length;
    while (a < b) {
      const m = a + b >> 1;
      if (rows[m].t < start) a = m + 1;
      else b = m;
    }
    let notes = 0;
    for (let i = a; i < rows.length && rows[i].t < end; i++) notes += rows[i].hits;
    const dur = Math.max(0.5, (end - start) / 1e3);
    return notes / dur;
  }
  function markBreaks(map, rows, segs) {
    const npss = segs.map((s) => npsInRange(rows, s.start, s.end));
    const sorted = [...npss].sort((a, b) => a - b);
    const q = sorted[Math.floor(CONFIG.breakNpsQuantile * (sorted.length - 1))] ?? 0;
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const nps = npss[i];
      let isBreak = nps < CONFIG.breakAbsNps;
      if (!isBreak && nps <= Math.max(q, 0) * 0.55 && nps < 3) isBreak = true;
      if (!isBreak) {
        let a = 0, b = rows.length;
        while (a < b) {
          const m = a + b >> 1;
          if (rows[m].t < s.start) a = m + 1;
          else b = m;
        }
        let prevT = s.start;
        for (let ri = a; ri < rows.length && rows[ri].t < s.end; ri++) {
          if (rows[ri].t - prevT >= CONFIG.restGapMs) {
            isBreak = true;
            break;
          }
          prevT = rows[ri].t;
        }
      }
      out.push({ start: s.start, end: s.end, family: isBreak ? "break" : "rc" });
    }
    void map;
    return out;
  }

  // src/classify/extras.ts
  function lowerBoundRow(rows, t) {
    let lo = 0, hi = rows.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (rows[m].t < t) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  function computeSegmentExtras(ctx, start, end) {
    const rows = ctx.rows;
    const K = ctx.map.keys;
    const lo = Math.max(0, lowerBoundRow(rows, start) - 1);
    const hi = lowerBoundRow(rows, end);
    let rowCount = 0, notes = 0;
    let lnHeadRowCount = 0, lnHeadSum = 0;
    let lnHeadPairs = 0, lnHeadOverlaps = 0;
    let prevHeadRowIdx = -1;
    let tailRows = 0, singleTailRows = 0;
    const colSeen = new Array(K).fill(0);
    const chordMasks = [];
    const chordHits = [];
    const chordTimes = [];
    let prevT = start;
    let maxGap = 0;
    for (let i = lo; i < hi; i++) {
      const r = rows[i];
      if (r.t < start || r.t >= end) continue;
      if (r.hits === 0 && !r.lnTailMask) continue;
      if (r.t - prevT > maxGap) maxGap = r.t - prevT;
      prevT = r.t;
      if (r.hits > 0) {
        rowCount++;
        notes += r.hits;
        chordMasks.push(r.mask);
        chordHits.push(r.hits);
        chordTimes.push(r.t);
        for (let c = 0; c < K; c++) if (r.mask & 1 << c) colSeen[c]++;
      }
      if (r.lnTailMask) {
        tailRows++;
        if (popcount(r.lnTailMask) === 1 && popcount(r.mask) === 0) singleTailRows++;
      }
      if (r.lnHeadMask) {
        lnHeadRowCount++;
        lnHeadSum += popcount(r.lnHeadMask);
        if (prevHeadRowIdx >= 0 && rows[prevHeadRowIdx].lnHeadMask) {
          lnHeadPairs++;
          if (rows[prevHeadRowIdx].lnHeadMask & r.lnHeadMask) lnHeadOverlaps++;
        }
        prevHeadRowIdx = i;
      } else {
        prevHeadRowIdx = -1;
      }
    }
    const runNoteCount = { n: 0 };
    const runCols = /* @__PURE__ */ new Set();
    for (let c = 0; c < K; c++) {
      const arr = ctx.cols.colNotes[c];
      let a = 0, b = arr.length;
      while (a < b) {
        const m = a + b >> 1;
        if (arr[m] < start) a = m + 1;
        else b = m;
      }
      let hiIdx = a;
      {
        let lo2 = a, hi2 = arr.length;
        while (lo2 < hi2) {
          const m = lo2 + hi2 >> 1;
          if (arr[m] < end) lo2 = m + 1;
          else hi2 = m;
        }
        hiIdx = lo2;
      }
      void b;
      let runLen2 = 1;
      let dts = [];
      const flush = (endIdx) => {
        if (runLen2 >= 4 && dts.length >= 3) {
          const med = median(dts);
          if (med > 30 && med <= 320 && stdevCv(dts) < 0.35) {
            runNoteCount.n += runLen2;
            runCols.add(c);
          }
        }
        void endIdx;
      };
      for (let i = a + 1; i < hiIdx; i++) {
        const dt = arr[i] - arr[i - 1];
        const refMed = dts.length ? median(dts) : dt;
        if (dt > refMed * 2.2 || dt < refMed * 0.45 || dt > 350) {
          flush(i);
          runLen2 = 1;
          dts = [];
        } else {
          runLen2++;
          dts.push(dt);
        }
      }
      flush(hiIdx);
    }
    const durS = Math.max(0.5, (end - start) / 1e3);
    let seenCols = 0;
    for (let c = 0; c < K; c++) if (colSeen[c] > 0) seenCols++;
    let chordOverlapRatio = 0, chordOverlapJaccard = 0, maxLockRun = 0, avgOverlapSize = 0;
    {
      let pairs = 0, inter = 0, jacSum = 0, interSum = 0, cur = 0;
      for (let i = 1; i < chordMasks.length; i++) {
        const a = chordMasks[i - 1], b = chordMasks[i];
        const ia = popcount(a & b);
        pairs++;
        if (ia > 0) {
          inter++;
          cur++;
          if (cur > maxLockRun) maxLockRun = cur;
          interSum += ia;
          jacSum += ia / popcount(a | b);
        } else {
          cur = 0;
        }
      }
      if (pairs > 0) {
        chordOverlapRatio = inter / pairs;
        chordOverlapJaccard = jacSum / pairs;
        avgOverlapSize = inter > 0 ? interSum / inter : 0;
      }
    }
    let chordGapMed = 0, chordGapCv = 1;
    {
      const gaps = [];
      for (let i = 1; i < chordTimes.length; i++) {
        const dt = chordTimes[i] - chordTimes[i - 1];
        if (dt >= 40 && dt <= 1e3) gaps.push(dt);
      }
      if (gaps.length >= 3) {
        gaps.sort((a, b) => a - b);
        chordGapMed = gaps[Math.floor(gaps.length / 2)];
        const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        chordGapCv = m > 0 ? Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length) / m : 1;
      }
    }
    let chord2Count = 0;
    for (const h of chordHits) if (h === 2) chord2Count++;
    const chord2Ratio = chordHits.length ? chord2Count / chordHits.length : 0;
    let wSum = 0;
    for (const h of chordHits) wSum += Math.pow(h, 1.4);
    const weightedNps = wSum / durS;
    let segIvLogStd = 0;
    let segRhythmChangeRate = 0;
    {
      const ivs = [];
      let prev = -1;
      for (let i = lo; i < hi; i++) {
        const r = rows[i];
        if (r.hits === 0 || r.t < start || r.t >= end) continue;
        if (prev >= 0) ivs.push(r.t - prev);
        prev = r.t;
      }
      if (ivs.length >= 4) {
        const logs = ivs.filter((v) => v >= 25).map((v) => Math.log(v));
        if (logs.length >= 3) {
          const m = logs.reduce((a, b) => a + b, 0) / logs.length;
          const sd = Math.sqrt(logs.reduce((a, b) => a + (b - m) ** 2, 0) / logs.length);
          segIvLogStd = sd;
        }
        let changes = 0, pairs = 0;
        for (let i = 1; i < ivs.length; i++) {
          const a = ivs[i - 1], b = ivs[i];
          if (a < 25 || b < 25) continue;
          pairs++;
          const ratio = Math.max(a, b) / Math.min(a, b);
          if (ratio > 1.35) changes++;
        }
        if (pairs >= 3) segRhythmChangeRate = changes / pairs;
      }
    }
    let jackHits = 0, jackMatch = 0;
    let heldRowHits = 0, heldRowJacks = 0;
    const jackDts = [];
    const tps = ctx.map.timingPoints;
    const anchorOf = (t) => {
      let lo2 = 0, hi2 = tps.length;
      while (lo2 < hi2) {
        const m = lo2 + hi2 >> 1;
        if (tps[m].t <= t) lo2 = m + 1;
        else hi2 = m;
      }
      return tps[Math.max(0, lo2 - 1)];
    };
    const offGrid = (t) => {
      const tp = anchorOf(t);
      const grid = tp.beatLength / 4;
      if (grid <= 0) return false;
      let ph = (t - tp.t) / grid % 1;
      if (ph < 0) ph += 1;
      return Math.min(ph, 1 - ph) > 0.15;
    };
    let riceN = 0, riceOff = 0, runN = 0, runOff = 0, runCount = 0;
    const runLen = new Array(K).fill(1);
    const strictEvents = [];
    for (const h of ctx.lnHeads) {
      if (h.t + h.dur <= start || h.t >= end) continue;
      strictEvents.push({ t: Math.max(h.t, start), col: h.col, up: true });
      strictEvents.push({ t: Math.min(h.t + h.dur, end), col: h.col, up: false });
    }
    strictEvents.sort((a, b) => a.t - b.t || (a.up ? 1 : 0) - (b.up ? 1 : 0));
    const strictHeld = new Int32Array(rows.length);
    {
      let msk = 0, ei2 = 0;
      for (let i = lo; i < hi; i++) {
        const t = rows[i].t;
        while (ei2 < strictEvents.length && strictEvents[ei2].t < t) {
          const e = strictEvents[ei2];
          if (e.up) msk |= 1 << e.col;
          else msk &= ~(1 << e.col);
          ei2++;
        }
        while (ei2 < strictEvents.length && strictEvents[ei2].t === t && !strictEvents[ei2].up) {
          msk &= ~(1 << strictEvents[ei2].col);
          ei2++;
        }
        strictHeld[i] = msk;
        while (ei2 < strictEvents.length && strictEvents[ei2].t === t) {
          msk |= 1 << strictEvents[ei2].col;
          ei2++;
        }
      }
    }
    const lastIvs = [];
    let prevPlayable = -1;
    for (let i = lo; i < hi; i++) {
      const r = rows[i];
      if (r.t < start || r.t >= end || r.hits === 0) continue;
      if (prevPlayable >= 0) {
        lastIvs.push(r.t - prevPlayable);
        if (lastIvs.length > 3) lastIvs.shift();
      }
      prevPlayable = r.t;
      const rowDt = lastIvs.length ? median(lastIvs) : 0;
      const jackLimit = rowDt >= 15 && rowDt <= 400 ? rowDt * 1.35 + 10 : 0;
      const hm = strictHeld[i];
      const lockedRow = hm !== 0;
      for (let c = 0; c < K; c++) {
        const bit = 1 << c;
        if (!(r.mask & bit)) continue;
        const onHeld = (hm & bit) !== 0;
        if ((r.lnHeadMask & bit) === 0) {
          riceN++;
          if (offGrid(r.t)) riceOff++;
        }
        const arr = ctx.cols.colNotes[c];
        const p = predIdx(arr, r.t);
        let isJack = false;
        if (p >= 0 && jackLimit > 0) {
          const dt = r.t - arr[p];
          if (dt >= 20 && dt <= jackLimit) {
            isJack = true;
            jackHits++;
            if (Math.abs(dt - rowDt) <= 0.3 * rowDt) jackMatch++;
            runLen[c]++;
            if (runLen[c] === 2) runCount++;
            if (runLen[c] >= 2) {
              runN++;
              if (offGrid(r.t)) runOff++;
            }
            if (runLen[c] >= 3) jackDts.push(dt);
          } else {
            runLen[c] = 1;
          }
        } else {
          runLen[c] = 1;
        }
        if (lockedRow && !onHeld) heldRowHits++;
        if (lockedRow && !onHeld && isJack) heldRowJacks++;
      }
    }
    const medJackDt = median(jackDts);
    const allOff = riceN ? riceOff / riceN : 0;
    const jackOff = runN ? runOff / runN : 0;
    const techJackScore = 0.5 * allOff + 0.5 * (runCount >= 3 ? jackOff : allOff);
    const colLns = [];
    for (let c = 0; c < K; c++) colLns.push([]);
    for (const h of ctx.lnHeads) colLns[h.col].push(h.t, h.t + h.dur);
    const tailTimes = [];
    for (const x of ctx.lnTails) tailTimes.push(x.t);
    tailTimes.sort((x, y) => x - y);
    let longLn = 0, tailSum = 0, freeLn = 0, holdAdjW = 0;
    const tailGaps = [];
    {
      const heads = ctx.lnHeads;
      let a = 0, b = heads.length;
      while (a < b) {
        const m = a + b >> 1;
        if (heads[m].t < start) a = m + 1;
        else b = m;
      }
      for (let i = a; i < heads.length && heads[i].t < end; i++) {
        const h = heads[i];
        if (h.dur <= 100) continue;
        longLn++;
        const tt = h.t + h.dur;
        tailSum += countNear(tailTimes, tt, 10);
        {
          const arr = ctx.cols.colNotes[h.col];
          let lo2 = 0, hi2 = arr.length;
          while (lo2 < hi2) {
            const m = lo2 + hi2 >> 1;
            if (arr[m] <= tt) lo2 = m + 1;
            else hi2 = m;
          }
          tailGaps.push(lo2 < arr.length ? Math.min(arr[lo2] - tt, 4e3) : 4e3);
        }
        let free = true;
        let holdW = 0;
        for (const adj of [h.col - 1, h.col + 1]) {
          if (adj < 0 || adj >= K) continue;
          if (hasHitNear(ctx.cols.colNotes[adj], tt, 10)) free = false;
          const ivs = colLns[adj];
          for (let j = 0; j + 1 < ivs.length; j += 2) {
            if (ivs[j] < tt - 10 && ivs[j + 1] > tt + 10) {
              holdW += 1;
              break;
            }
          }
        }
        if (free) freeLn++;
        holdAdjW += holdW;
      }
    }
    return {
      rowCount,
      notes,
      lnHeadRowCount,
      lnHeadChordMean: lnHeadRowCount ? lnHeadSum / lnHeadRowCount : 0,
      lnHeadOverlapRatio: lnHeadPairs ? lnHeadOverlaps / lnHeadPairs : 0,
      lnHeadRate: lnHeadRowCount / durS,
      tailSingleRatio: tailRows ? singleTailRows / tailRows : 0,
      vibroFraction: notes ? runNoteCount.n / notes : 0,
      vibroWidth: runCols.size,
      wideSpreadRatio: notes ? Math.min(1, seenCols / 5) : 0,
      maxGapMs: maxGap,
      segIvLogStd,
      segRhythmChangeRate,
      jackHitRatio: notes ? jackHits / notes : 0,
      shortLnBodyRatio: shortLnBodyRatio(ctx, start, end),
      jackChordPerRow: rowCount ? jackHits / rowCount : 0,
      jackRunBpm: medJackDt > 0 ? Math.min(15e3 / medJackDt, 500) : 0,
      jackRowMatchRatio: jackHits ? jackMatch / jackHits : 0,
      // lockJackRatio: presses that are row-rate same-column repeats while
      // another lane is held (denominator = all presses, per research definition)
      heldJackRatio: notes ? heldRowJacks / notes : 0,
      longLnRatio: notes ? longLn / notes : 0,
      tailChordMean: longLn ? tailSum / longLn : 0,
      tailFreeRatio: longLn ? freeLn / longLn : 0,
      tailHoldAdjWeight: longLn ? holdAdjW / longLn : 0,
      tailGapMed: median(tailGaps),
      tailGapCv: tailGapCv(tailGaps),
      invHoleFrac: computeInvHoleFrac(ctx, start, end),
      offGridRatio: allOff,
      techJackScore,
      chordOverlapRatio,
      chordOverlapJaccard,
      maxLockRun,
      avgOverlapSize,
      chord2Ratio,
      weightedNps,
      chordGapMed,
      chordGapCv
    };
  }
  function shortLnBodyRatio(ctx, start, end) {
    let n = 0, short = 0;
    for (const h of ctx.lnHeads) {
      if (h.t < start) continue;
      if (h.t >= end) break;
      n++;
      if (h.dur < 90) short++;
    }
    return n ? short / n : 0;
  }
  function computeInvHoleFrac(ctx, start, end) {
    const K = ctx.map.keys;
    const dur = end - start;
    if (dur <= 0) return 0;
    let worst = 0;
    for (let c = 0; c < K; c++) {
      const marks = [];
      for (const h of ctx.lnHeads) {
        if (h.col !== c) continue;
        if (h.t + h.dur <= start) continue;
        if (h.t >= end) break;
        marks.push([Math.max(h.t, start), Math.min(h.t + h.dur, end)]);
      }
      const notes = ctx.cols.colNotes[c];
      let lo = 0, hi = notes.length;
      while (lo < hi) {
        const m = lo + hi >> 1;
        if (notes[m] < start) lo = m + 1;
        else hi = m;
      }
      for (let i = lo; i < notes.length && notes[i] < end; i++) marks.push([notes[i], notes[i]]);
      if (!marks.length) {
        worst = Math.max(worst, 1);
        continue;
      }
      marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let holeMs = 0;
      let prevEnd = marks[0][1];
      if (marks[0][0] - start > 1e3) holeMs += marks[0][0] - start;
      for (let i = 1; i < marks.length; i++) {
        const gap = marks[i][0] - prevEnd;
        if (gap > 1e3) holeMs += gap;
        if (marks[i][1] > prevEnd) prevEnd = marks[i][1];
      }
      if (end - prevEnd > 1e3) holeMs += end - prevEnd;
      worst = Math.max(worst, Math.min(1, holeMs / dur));
    }
    return worst;
  }
  function median(a) {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  }
  function predIdx(arr, t) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (arr[m] < t) lo = m + 1;
      else hi = m;
    }
    return lo - 1;
  }
  function countNear(arr, t, tol) {
    let a = 0, b = arr.length;
    while (a < b) {
      const m = a + b >> 1;
      if (arr[m] < t - tol) a = m + 1;
      else b = m;
    }
    let c = 0;
    for (let i = a; i < arr.length && arr[i] <= t + tol; i++) c++;
    return c;
  }
  function hasHitNear(arr, t, tol) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (arr[m] < t - tol) lo = m + 1;
      else hi = m;
    }
    return lo < arr.length && arr[lo] <= t + tol;
  }
  function tailGapCv(gaps) {
    if (gaps.length < 2) return 0;
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (m <= 0) return 0;
    const v = gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length;
    return Math.min(2, Math.sqrt(v) / m);
  }
  function stdevCv(a) {
    if (a.length < 2) return 0;
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    const v = a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length;
    return m > 0 ? Math.sqrt(v) / m : 0;
  }
  var MEDIAN_KEYS = [
    "nps",
    "equivBpm",
    "gridRatio",
    "rhythmSteady",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "cutFreeRatio",
    "cutDemand",
    "anchorRate",
    "trillRate",
    "altHandRate",
    "rollRate",
    "graceRate",
    "offBeatRatio",
    "lnWeightRatio",
    "lockRatio",
    "lnAreaRatio",
    "heldCoverage",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore"
  ];
  function medianOf(windows, from, to, k) {
    const vals = [];
    for (let i = from; i < to && i < windows.length; i++) vals.push(windows[i][k]);
    if (!vals.length) return 0;
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  }
  function computeMapMedians(windows) {
    const n = Math.max(1, windows.length);
    return {
      mapChordMedian: medianOf(windows, 0, n, "chordMean"),
      mapLargeMedian: medianOf(windows, 0, n, "largeChordRatio"),
      mapNpsMedian: medianOf(windows, 0, n, "nps")
    };
  }
  function medianWindowFeatures(windows, from, to, mapMedians) {
    const out = {};
    for (const k of MEDIAN_KEYS) out[k] = 0;
    for (const k of MEDIAN_KEYS) {
      out[k] = medianOf(windows, from, to, k);
    }
    return {
      ...out,
      // humans judge cut size relative to the map's own baseline, not absolutely
      ...mapMedians ?? computeMapMedians(windows)
    };
  }

  // src/classify/params.ts
  var RC_DEFAULTS = {
    vibroFracLo: 0.28,
    vibroFracHi: 0.5,
    vibroBpmLo: 125,
    vibroBpmHi: 170,
    cjMultiLo: 0.62,
    cjMultiHi: 0.88,
    cjChLo: 2.3,
    cjChHi: 2.9,
    cjJackLo: 0.18,
    cjJackHi: 0.5,
    cjOvlLo: 0.35,
    cjOvlHi: 0.68,
    mjJackLo: 0.1,
    mjJackHi: 0.38,
    mjOvlLo: 0.15,
    mjOvlHi: 0.5,
    mjBpmLo: 125,
    mjBpmHi: 185,
    dcMultiLo: 0.76,
    dcMultiHi: 0.9,
    dcLargeLo: 0.42,
    dcLargeHi: 0.72,
    dcFreeLo: 0.72,
    dcFreeHi: 0.95,
    fcMultiLo: 0.42,
    fcMultiHi: 0.78,
    fcSingleLo: 0.15,
    fcSingleHi: 0.42,
    fcBpmLo: 180,
    fcBpmHi: 215,
    spSingleLo: 0.48,
    spSingleHi: 0.75,
    spBpmW: 0.4,
    techJackLo: 0.04,
    techJackHi: 0.18,
    techSpecLo: 0.06,
    techSpecHi: 0.25,
    wildcardBase: 0.3
  };
  var LN_DEFAULTS = {
    invCovLo: 0.45,
    invCovHi: 0.72,
    invGapLo: 0.6,
    invGapHi: 0.86,
    invAreaLo: 0.5,
    invAreaHi: 0.75,
    coLockLo: 0.38,
    coLockHi: 0.64,
    teShortLo: 0.55,
    teShortHi: 0.88,
    teTailLo: 9,
    teTailHi: 16,
    relBpmHi: 155,
    relNpsHi: 21,
    denShortLo: 0.6,
    denShortHi: 0.88,
    denTailLo: 8,
    denTailHi: 15,
    denHeadChLo: 1.35,
    denHeadChHi: 2.1,
    lnWildBase: 0.26
  };

  // src/classify/scoreRc.ts
  function ss(x, lo, hi) {
    if (hi <= lo) return x >= hi ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }
  function scoreRc(inp) {
    const p = { ...RC_DEFAULTS, ...inp.params };
    const { f, extras } = inp;
    const active = f.nps > 2.5 ? 1 : ss(f.nps, 1.2, 2.5);
    const cutDemNorm = inp.cutDemandRef > 0 ? f.cutDemand / inp.cutDemandRef : 0;
    const vibro = active * ss(extras.vibroFraction, p.vibroFracLo, p.vibroFracHi) * ss(f.jackSpeedBpm, p.vibroBpmLo, p.vibroBpmHi) * (extras.vibroWidth <= 4 ? 1 : ss(7 - extras.vibroWidth, 0, 3));
    const chordjack = active * ss(f.multiRatio, p.cjMultiLo, p.cjMultiHi) * ss(f.chordMean, p.cjChLo, p.cjChHi) * ss(f.jackRowRatio, p.cjJackLo, p.cjJackHi) * (0.35 + 0.65 * ss(f.overlapDegree, p.cjOvlLo, p.cjOvlHi));
    const minijack = active * ss(f.jackRowRatio, p.mjJackLo, p.mjJackHi) * ss(f.overlapDegree, p.mjOvlLo, p.mjOvlHi) * (1 - 0.7 * ss(f.chordMean, 3.2, 4.2)) * (0.35 + 0.65 * ss(f.equivBpm, p.mjBpmLo, p.mjBpmHi));
    const denseCs = active * ss(f.multiRatio, p.dcMultiLo, p.dcMultiHi) * ss(f.largeChordRatio, p.dcLargeLo, p.dcLargeHi) * ss(f.cutFreeRatio, p.dcFreeLo, p.dcFreeHi) * (0.5 + 0.5 * ss(cutDemNorm, 0.15, 0.7));
    const fastCs = active * ss(f.multiRatio, p.fcMultiLo, p.fcMultiHi) * ss(f.singleRatio, p.fcSingleLo, p.fcSingleHi) * ss(f.cutFreeRatio, 0.75, 0.97) * (0.35 + 0.65 * ss(f.equivBpm, p.fcBpmLo, p.fcBpmHi));
    const speed = active * ss(f.singleRatio, p.spSingleLo, p.spSingleHi) * (0.6 - p.spBpmW + ss(f.equivBpm, 190, 245) * p.spBpmW + ss(f.nps, 16, 26) * 0.3);
    const techSpec = Math.max(
      extras.segRhythmChangeRate,
      f.trillRate,
      f.rollRate,
      f.altHandRate * 1.5,
      f.offBeatRatio * 1.3
    );
    const tech = active * ss(extras.segIvLogStd, 0.25, 0.55) * (0.3 + 0.7 * ss(techSpec, p.techSpecLo, p.techSpecHi)) * (0.4 + 0.6 * ss(1 - f.rhythmSteady, 0.05, 0.3)) * ss(f.nps, 2.5, 6);
    const scores = {
      vibro,
      chordjack,
      minijack,
      "dense chordstream": denseCs,
      "fast chordstream": fastCs,
      speed,
      tech,
      wildcard: active * p.wildcardBase
    };
    for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(1, scores[k]));
    return scores;
  }

  // src/classify/scoreLn.ts
  function ss2(x, lo, hi) {
    if (hi <= lo) return x >= hi ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }
  function scoreLn(inp) {
    const p = { ...LN_DEFAULTS, ...inp.params };
    const { f, extras } = inp;
    const lnPresence = ss2(f.lnWeightRatio, 0.45, 0.7);
    const inverse = lnPresence * // inverse requires lanes essentially filled: hole-y LN sections are not
    // inverse no matter how the rest of the evidence looks
    (1 - Math.min(1, extras.invHoleFrac * 4)) * ss2(f.heldCoverage, p.invCovLo, p.invCovHi) * (0.15 + 0.85 * ss2(f.invGapScore, p.invGapLo, p.invGapHi)) * (0.4 + 0.6 * ss2(f.lnAreaRatio, p.invAreaLo, p.invAreaHi)) * (1 - 0.6 * ss2(f.lockRatio, 0.25, 0.55));
    const coordination = lnPresence * ss2(f.lockRatio, p.coLockLo, p.coLockHi) * (0.5 + 0.5 * ss2(f.heldCoverage, 0.18, 0.42)) * (1 - 0.3 * ss2(f.heldCoverage, 0.7, 0.95));
    const technical = lnPresence * ss2(f.shortLnRatio, p.teShortLo, p.teShortHi) * ss2(f.tailRate, p.teTailLo, p.teTailHi) * (0.35 + 0.65 * ss2(Math.max(extras.segIvLogStd * 2, extras.segRhythmChangeRate), 0.35, 0.75)) * (1 - 0.7 * ss2(f.lockRatio, 0.12, 0.42)) * (1 - 0.4 * ss2(f.heldCoverage, 0.62, 0.85));
    const release = lnPresence * (1 - ss2(f.equivBpm, 100, p.relBpmHi)) * (1 - ss2(f.nps, 13, p.relNpsHi)) * (0.35 + 0.65 * (1 - ss2(f.rhythmSteady, 0.55, 0.85))) * (0.5 + 0.5 * ss2(extras.tailSingleRatio, 0.25, 0.55));
    const density = lnPresence * (0.22 + 0.38 * ss2(f.shortLnRatio, p.denShortLo, p.denShortHi) * ss2(f.tailRate, p.denTailLo, p.denTailHi) + 0.4 * ss2(extras.lnHeadChordMean, p.denHeadChLo, p.denHeadChHi)) * (1 - 0.45 * ss2(extras.segRhythmChangeRate, 0.3, 0.6));
    const scores = {
      inverse,
      coordination,
      technical,
      release,
      density,
      "ln wildcard": lnPresence * p.lnWildBase
    };
    for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(1, scores[k]));
    return scores;
  }

  // src/classify/featuresVec.ts
  var VEC_KEYS = [
    "nps",
    "logEquivBpm",
    "cutSizeNorm",
    "gridRatio",
    "rhythmSteady",
    "chordMean",
    "largeChordRatio",
    "multiRatio",
    "singleRatio",
    "jackRowRatio",
    "overlapDegree",
    "jackSpeedBpm",
    "jackHitRatio",
    "heldJackRatio",
    "jackChordPerRow",
    "jackRunBpm",
    "jackRowMatchRatio",
    "longLnRatio",
    "tailChordMean",
    "tailFreeRatio",
    "tailHoldAdjWeight",
    "shortLnBodyRatio",
    "invHoleFrac",
    "offGridRatio",
    "techJackScore",
    "cutFreeRatio",
    "logCutDemand",
    "anchorRate",
    "trillRate",
    "altHandRate",
    "rollRate",
    "offBeatRatio",
    "graceRate",
    "lnWeightRatio",
    "lockRatio",
    "heldCoverage",
    "lnAreaRatio",
    "tailRate",
    "tailIndependence",
    "tailScatter",
    "shortLnRatio",
    "invGapScore",
    // extras
    "lnHeadChordMean",
    "lnHeadRate",
    "tailSingleRatio",
    "vibroFraction",
    "vibroWidth",
    "wideSpreadRatio",
    "segIvLogStd",
    "segRhythmChangeRate",
    "chordOverlapRatio",
    "chordOverlapJaccard",
    "maxLockRun",
    "avgOverlapSize",
    "chord2Ratio",
    "weightedNps"
  ];
  function buildVector(f, extras, cutDemandRef) {
    return {
      nps: f.nps,
      logEquivBpm: Math.log1p(Math.max(0, f.equivBpm) / 50),
      // chord size relative to tempo: annotator rule "at lower bpm a smaller cut
      // still counts as dense" — captures dCS/fCS boundary jointly.
      cutSizeNorm: f.chordMean * (160 / Math.min(260, Math.max(90, f.equivBpm || 160))),
      gridRatio: f.gridRatio,
      rhythmSteady: f.rhythmSteady,
      chordMean: f.chordMean,
      largeChordRatio: f.largeChordRatio,
      multiRatio: f.multiRatio,
      singleRatio: f.singleRatio,
      jackRowRatio: f.jackRowRatio,
      overlapDegree: f.overlapDegree,
      jackSpeedBpm: f.jackSpeedBpm / 100,
      jackHitRatio: extras.jackHitRatio,
      heldJackRatio: extras.heldJackRatio,
      jackChordPerRow: extras.jackChordPerRow / 3,
      jackRunBpm: extras.jackRunBpm / 100,
      jackRowMatchRatio: extras.jackRowMatchRatio,
      longLnRatio: extras.longLnRatio,
      tailChordMean: extras.tailChordMean / 3,
      tailFreeRatio: extras.tailFreeRatio,
      tailHoldAdjWeight: extras.tailHoldAdjWeight / 2,
      shortLnBodyRatio: extras.shortLnBodyRatio,
      invHoleFrac: extras.invHoleFrac,
      offGridRatio: extras.offGridRatio,
      techJackScore: extras.techJackScore,
      cutFreeRatio: f.cutFreeRatio,
      logCutDemand: Math.log1p(f.cutDemand / Math.max(1, cutDemandRef)),
      anchorRate: f.anchorRate,
      trillRate: f.trillRate,
      altHandRate: f.altHandRate,
      rollRate: f.rollRate,
      offBeatRatio: f.offBeatRatio,
      graceRate: f.graceRate,
      lnWeightRatio: f.lnWeightRatio,
      lockRatio: f.lockRatio,
      heldCoverage: f.heldCoverage,
      lnAreaRatio: f.lnAreaRatio,
      tailRate: f.tailRate / 20,
      tailIndependence: f.tailIndependence,
      tailScatter: Math.min(2, f.tailScatter),
      shortLnRatio: f.shortLnRatio,
      invGapScore: f.invGapScore,
      lnHeadChordMean: extras.lnHeadChordMean,
      lnHeadRate: extras.lnHeadRate / 10,
      tailSingleRatio: extras.tailSingleRatio,
      vibroFraction: extras.vibroFraction,
      vibroWidth: extras.vibroWidth / 7,
      wideSpreadRatio: extras.wideSpreadRatio,
      segIvLogStd: extras.segIvLogStd,
      segRhythmChangeRate: extras.segRhythmChangeRate,
      chordOverlapRatio: extras.chordOverlapRatio,
      chordOverlapJaccard: extras.chordOverlapJaccard,
      maxLockRun: extras.maxLockRun / 8,
      avgOverlapSize: extras.avgOverlapSize / 3,
      chord2Ratio: extras.chord2Ratio,
      weightedNps: extras.weightedNps / 25
    };
  }

  // src/classify/model.generated.json
  var model_generated_default = { rc: { classes: ["chordjack", "dense chordstream", "fast chordstream", "minijack", "speed", "tech", "wildcard"], mean: [20.93774838995434, 1.4080974987551738, 2.1914240366760316, 0.9428981373793501, 0.9047728505549114, 2.135125524957002, 0.4640193509852115, 0.7384616476328464, 0.3892548428295238, 0.1749313535443446, 0.3436237658643697, 0.5685865327287285, 0.09375885928972184, 0.00131894588553609, 0.08704903896278011, 0.38128399027490567, 0.6639062392530343, 0.01628625953791638, 0.0828330674170041, 0.08879070240106783, 0.0029161940451753075, 0.009124992427688508, 0.2447181762705806, 0.23322288545180636, 0.2336716483837912, 0.8201089820645772, 0.43007010016086944, 0.46037071170267907, 9239807033924681e-19, 0.11886746893020556, 0.05025347629376421, 0.03815928518425371, 0.006387494746760668, 0.02017262474484937, 0.034352040479491454, 0.012432056155795635, 0.010465802987861808, 0.008374183006535944, 0.00610639680708885, 0.005829082362775315, 0.022107485299526827, 0.011029528955607036, 0.21196370109876272, 0.016064058527189583, 0.04658207007707588, 0.4347897581044773, 0.6751867413632097, 0.9985294117647026, 0.3355506613281114, 0.22125833940306475, 0.18376148063492448, 0.08235852970854024, 0.4648692810457504, 0.44651437060431864, 0.2659941553302713, 1.2010059101611925], std: [9.181886191066749, 0.4202068551252959, 1.2934606024495643, 0.22482493974973877, 0.21566483288699292, 0.7790262997355679, 0.2966722209852889, 0.27703992425212104, 0.3052272695380964, 0.2563545624583077, 0.3684423947809091, 0.25120946851322623, 0.13541507427563376, 0.013070398959398552, 0.16074159436203317, 0.5362603558437544, 0.43651095557819475, 0.0764787430824936, 0.26521568389214484, 0.26192757580134235, 0.030560007380948353, 0.08032078635067129, 0.3130880970139673, 0.3452014041820118, 0.35102493271700824, 0.2655197184600404, 0.2428473213721715, 0.28251112317011096, 0.023618187965021388, 0.19303825208268258, 0.15249938204732497, 0.13557493015228117, 0.0371712088554391, 0.10280477789455703, 0.16557076315505753, 0.05782422417271025, 0.04748186083697971, 0.0491069313440768, 0.05791289350157722, 0.04124740260298424, 0.13946490453469046, 0.07353220315536717, 0.6644342245234114, 0.06981536470505975, 0.1916448780333269, 0.31905448147980114, 0.37533749226731916, 0.029668001473282305, 0.2186480723780999, 0.1977957881135459, 0.23621557542828178, 0.12149826275668694, 1.0153370963315904, 0.28630106829735574, 0.18587684793965256, 0.597515807979952], W: [-0.11281779061822943, -0.1392633451559788, 0.23541388960450754, 0.2973549693062095, 0.07725064495728294, -0.11591181820101619, -0.053459121901487244, -0.10752925172531122, -0.10649833691336684, 0.1845561648626616, 0.25695345704461603, -0.21015717589290123, 0.4112642302862858, -0.109120887067381, 0.22756313663341485, 0.20084862951287888, 0.302933726262374, 0.20087787054952516, 0.07912037800770207, 0.06996569769779942, 0.19096942596946517, -0.02092651613213297, 0.10238509104189875, 0.13142181998695768, 0.13334556807163167, -0.1976241892872756, 0.7285948122733158, -0.6451267869509192, 0.0013242352573720336, -0.08102031126022896, -0.1688425822974419, 0.5441337254156035, 0.02559328854199168, 0.004297322375617219, 0.012774106157057286, -0.1394397679378785, -0.19598492567675138, 0.06277637893189968, -0.05340905389615265, 0.06794453320508406, 0.23408387690711302, 0.17262129880698146, 0.061736333908749566, 0.057474758005859584, 0.14289634721599498, -0.09500654755474262, -0.030797622223572147, 0.08768285474678499, -0.4583827067060617, -0.38577440530877, 0.24405603995388134, 0.06917191739891904, -0.04227926733244097, 0.19321295451298182, 0.12503029156743264, 0.07876252639208031, 0.2978421081392673, -0.24839843909618362, 0.2811363673074207, -0.035124798624274214, -0.37069410233448513, 0.3971094223259367, 0.17799541499577298, -0.10100267151812879, -0.20029236937727313, -0.24588650987718505, -0.28832570840406274, 0.2996850915867223, -0.08800414225683471, 0.14280100415099853, 0.022497590286543655, 0.02994699254130813, -0.07324069710973151, -0.0652777509403595, -0.02565340573712316, -0.003909181845370043, -0.17301993626507767, 0.07901951517348317, 0.5969920864438635, 0.24482465027824868, 0.2624548827022429, 0.27183194758278967, -0.3672886578426847, 0.18550623263006746, -0.057589732151321335, 0.06506711219704807, -0.23091038398355984, -0.4783846211139561, -0.02861528677787629, 0.16058967810605362, 0.059610753531296204, -0.004381951686723081, -0.07036685518188207, 0.07382002352135333, -0.015953698318197245, 0.0344581675750286, 0.022354316084196003, -0.06029477482438648, 0.007681403449231488, 0.13935184522010519, -0.10978357011311386, 0.23217320922621326, -0.37763328294401227, -0.010514274127988738, -0.18911221483313828, 0.040440285329577184, -0.1991921527365222, 0.033271824468392525, 0.06795179836223177, 0.13496101620785994, -0.03439034318173883, 0.5280481989000204, -0.07740147702385074, -0.0021802974352554934, -0.23580956635534658, -0.236709064068437, 0.0019315049769862104, -0.06328576963389301, 0.24799790874516664, 0.2217647052936303, -0.1652413563780953, -0.02213065101391793, -0.420060284870252, -0.20781370717700484, -0.14665697251624651, -0.16610027769983796, -0.19816805794818665, -0.1333578408398787, -0.25274137878015734, 0.09055665669089116, 0.09655249495094886, 0.1239025358780989, 0.196831912923072, 0.1244186882113548, 0.03853670982563939, -0.5106159208638094, -0.48298196262524107, -0.0828224257912376, -0.16887482456768713, 0.05950622681271993, -0.011597718536621903, 0.21014246639099063, -0.3263400405709306, -0.2922667272453767, 0.09921830342791352, -0.20292455647886012, 0.2191292543331272, 0.1555830877197135, 0.26939841302447504, -0.12439021573627497, -0.055461141955499234, -0.06047683751090291, 0.10960179473098504, -0.01113912672160206, 0.026396687607151234, 0.1187729105316505, -0.09034387659138884, 0.5186249557684731, -0.10874688180415412, -0.12933160778264835, 0.17763503992837512, -0.1277485771876028, 0.024818686588251856, 0.027763106476622813, 0.07756996979596488, 0.09189541110155212, 0.023520154820347763, -0.11597477836429199, -0.17695932215603005, -0.1136090905481436, 0.10862118671668532, -0.23260457159255218, 0.24767881139644307, 0.3739372050246205, 0.021134194556443404, 0.033021298714894134, -0.2918883669529386, 0.15126004125365597, 0.08835687886367154, 0.5666786048469167, -0.11396704685431429, -0.2083145381505132, -0.08975133369190752, 0.44239193667852, 0.10753169885831809, -0.08963292355734644, 0.08463217009135818, 0.11199876148791958, -0.12812281089950683, -0.1345411855397059, -0.18245723910121991, -0.28193680671494015, -0.21571652131843794, -0.11462842153726807, 0.26353658073630676, 0.08223158227592149, 0.002871459375200859, 0.04494452526241003, -0.17951437146025534, -0.17350349381326186, -0.06877873822658553, 0.09783122635915047, -0.22859753368127958, 0.19444373434873916, 0.1872564619414392, 0.09157695670094124, 0.12954181487510052, -0.06814769541176492, -0.20436535520026983, -0.005763443852793948, 0.21746483444566, -0.093009701828685, 0.22476518562379355, -0.757192110172828, -0.09235862373539139, 0.08978465711081426, -0.31424412131586477, -0.009655921654276867, 0.1393110595772085, 0.07619071983604656, -0.18417910215181404, -0.5562961709547659, -0.0035936415025293145, -0.017931391257151617, 0.09652082639593475, 0.3649583822334789, -0.1469045427114981, 0.053366886284030586, 4827459133347083e-20, -0.18915166401274852, -0.4058503594715235, -0.006396972274225326, 0.17570401337517566, 0.16512953644368616, -0.03746866287450656, -0.14722073927115603, -0.17770903920967449, 0.22009123346697076, 0.036837255758299124, -0.2976488240261254, -0.2281961241806814, -0.06976785614173604, 0.003113079936800103, -0.18736092288737677, -0.05750839516646914, -0.06919764236837778, 0.13668008019312772, 0.36193651924200015, 0.36112895774831505, -0.14775088336873882, -0.6201355402408327, 0.40712325691732293, 0.03727131235953444, -0.08041495475472489, 0.22798992064965767, 0.4012750473538711, -0.027952176089621944, 0.008870288172278772, 0.12962320904612584, -0.028731849823358784, -0.0011436599555895795, -0.0602129435732264, -0.048451510462888904, 0.049707301182298484, -0.1411106097184829, -0.09043044694112623, -0.054968254812264125, -0.11981700154821551, -0.2506000315179192, 0.07620939713290777, -0.18679408038167586, -0.04451452099527746, 0.09115960596058269, -0.3671655756297953, 0.01174651620880332, -0.039838305220031296, -0.10692114052973498, 0.15314565625796928, 0.03818697830999922, -0.2516322076379783, 0.07628010686882401, 0.22593853823002666, -0.10789651476386082, 0.1702479566970622, -0.22350270927587831, -0.308877300647033, -0.33208651604069983, -0.150223227715324, 0.3311588403105332, -0.20025538525410663, 0.359012908773347, 0.09573574128427673, 0.07520020428684067, 0.1462124781748106, -0.012337939140700006, 0.27493194046900754, -0.07233094187184286, -0.09069598632389517, -0.08529287784181333, 0.04890320929270542, -0.05158594074062084, 0.04099391581093745, -0.3660914602678893, 0.15395699721574557, 0.053269682576109256, 0.24172001777008606, -0.10721949368901139, -0.17690357866259585, 0.008078268070255232, 0.4252623404838714, 0.1152448413373059, 0.28769000820628815, 0.1997658547657003, -0.1096373915788308, -0.1554713786880494, -0.1631933860064374, -0.16756839582412034, -0.07495652424082336, -0.020285952531865502, -0.045388548977797684, -0.051648328596470436, -0.032955493808473915, -0.11344004635929564, -0.05529445040116172, 0.0943018675138794, -0.26354858255153, 0.16469751219973533, 0.029324855370068865, 0.5130920717256064, 0.3096745135418567, -0.20890010542981652, -0.11150757958765305, 0.09088678522636108, 0.10183372048681946, 0.1800554913779259, -0.13993162319966682, -0.1034644516059156, -0.08744574822794379, -0.13456081979790804, -0.016531378002038598, 0.2672875756883169, -0.093820074855866, 0.3442684791163275, 0.11036611922446493, 0.2570575759359646, -0.032673196414794145, 0.0415314114671868, -0.39690781537685327, 0.03987276626394297, -0.025569012875047394, 0.013359348102536764, -0.5171128343357114, 0.21604371682172127, 0.023939989722920853, -0.15247183940787262, -0.1635000996237769, 0.022435744179137334, -0.019766775155558847, -0.32604526813542006, -0.09958725914420369, -0.11150060715461887, 0.029273954631644238, 0.2713871233305933, 0.0876630669774818, 0.01964217562558065, -0.5839811783193662, 0.5623726163252236, -0.2889439388031684, -0.19923124564152156, 0.040973433044590925, -0.0370684106982777, -0.014279866614055392, -0.02159103832757063, 0.03138632439613035, 0.06401954228950352, 0.021903079938054248, 0.03108430579292893, 0.027961987341401144, -0.1448709582392325, -0.04747835997955303, -0.011235922131245746, 0.28873967815150525, 0.6316329788890699, -0.022431964321753418, 0.1798523252404994, 0.5402296809090112, -0.011840044161806495, -0.055051683372296295, 0.0969709566294323, -0.11875258761241698, -0.3288089313914372, -0.08134072483301225], b: [-0.10887388993600251, 0.7669278338472332, 0.019152284989763346, -0.15373585138642026, 0.25434888460891064, 0.02402177012380764, -0.8018410322472921], keys: ["nps", "logEquivBpm", "cutSizeNorm", "gridRatio", "rhythmSteady", "chordMean", "largeChordRatio", "multiRatio", "singleRatio", "jackRowRatio", "overlapDegree", "jackSpeedBpm", "jackHitRatio", "heldJackRatio", "jackChordPerRow", "jackRunBpm", "jackRowMatchRatio", "longLnRatio", "tailChordMean", "tailFreeRatio", "tailHoldAdjWeight", "shortLnBodyRatio", "invHoleFrac", "offGridRatio", "techJackScore", "cutFreeRatio", "logCutDemand", "anchorRate", "trillRate", "altHandRate", "rollRate", "offBeatRatio", "graceRate", "lnWeightRatio", "lockRatio", "heldCoverage", "lnAreaRatio", "tailRate", "tailIndependence", "tailScatter", "shortLnRatio", "invGapScore", "lnHeadChordMean", "lnHeadRate", "tailSingleRatio", "vibroFraction", "vibroWidth", "wideSpreadRatio", "segIvLogStd", "segRhythmChangeRate", "chordOverlapRatio", "chordOverlapJaccard", "maxLockRun", "avgOverlapSize", "chord2Ratio", "weightedNps"] }, ln: { classes: ["coordination", "density", "inverse", "ln wildcard", "release", "technical"], mean: [15.972709210533452, 1.0923710703776033, 2.5498025283167047, 0.8159490285789012, 0.6517508204080409, 2.142748428885941, 0.46349554834915074, 0.7668524552330663, 0.3670087427509474, 0.08497744026273657, 0.16515687230756754, 0.36000521501957317, 0.0894029667379305, 0.05637386719172953, 0.07737407390095295, 0.32407891774181286, 0.7032609153996814, 0.56045445852904, 0.743785024089873, 0.6623329711645859, 0.202011608269886, 0.18794808566930513, 0.23031219161622682, 0.2287301690768112, 0.2504976976402478, 0.770247833229595, 0.40734296580687374, 0.28754268548061224, 0, 0.06801014763066617, 0.024414526716691174, 0.10929418135470344, 0.003339442805426711, 0.8187654853479378, 0.2947432663094991, 0.4867968410085562, 0.5003151570703518, 0.5933564799139865, 0.3597656081006826, 0.5019636893365831, 0.610804303844713, 0.5500215671958975, 1.8409430698848972, 0.6440958944730771, 0.4185918120352241, 0.28173054248125246, 0.4577280802591697, 0.9976591075347727, 0.3441398906317693, 0.24043486422603422, 0.20614721014366094, 0.07902949325192737, 0.429407461594736, 0.4310434274386964, 0.27982382098889513, 0.9236890246994582], std: [8.964356418729299, 0.5897303258238599, 1.3013697273224998, 0.3809410095679509, 0.44335756559607875, 0.6735276311559297, 0.2936637946231972, 0.25585433429091503, 0.28550505660552516, 0.18372871059365425, 0.307768096900298, 0.2994556840619319, 0.11030490829351562, 0.08768868829261041, 0.11899193717260889, 0.4813017699096504, 0.4266597958210613, 0.2665412569352661, 0.2639194987172153, 0.2422204923111378, 0.1770330353417038, 0.24849235502673822, 0.308628405540351, 0.37674209107225515, 0.37744117406927735, 0.3604613300334198, 0.2808505984344401, 0.2791535307764144, 1e-6, 0.16758497461665722, 0.11368237408558736, 0.28424388663716116, 0.029200926667748952, 0.21869468155646854, 0.3140935589145856, 0.20537041620838742, 0.24044043222302516, 0.4056577982823191, 0.20959509703065382, 0.257177614883311, 0.36530440498608024, 0.2608787412555152, 0.6137293206666724, 0.4456264497830043, 0.31561763047950386, 0.30749473674398625, 0.43281862911790925, 0.028527751143481727, 0.21180949001936877, 0.19034393430007804, 0.22180113461803805, 0.09449213050404882, 0.6330951650122412, 0.23122060874529352, 0.18194252177986717, 0.536298314587527], W: [0.05105452731083738, 0.13615445199589762, 0.009753207832122208, 0.1236094283620807, -0.14288207455387242, 0.0763955698397503, 0.1123490554280606, 0.05308476540148476, -0.2006332472929359, 0.1339493150899519, 0.35159002448941307, 0.012991586540062034, 0.16654209078816146, 0.20283727562941586, 0.09786942550248749, -0.062266067217413915, 0.08863541035871249, 0.1716746380532528, 0.2059847452603893, -0.3793858091401414, -0.40891052864863836, -0.08467197617452239, -0.2247183714853586, -0.2895216829444947, -0.41469076352991496, 0.2710819811222212, 0.03603056739463045, -0.3805931713844531, 0, -0.012502278261808473, -0.0021503455144078545, 0.3301176692700385, -0.30587196332699523, -0.2739519790681863, 0.13374661768325224, -0.2309759116617263, -0.0814605880957565, -0.2574487123175539, 0.38148663894937435, 0.1161705798042186, -0.12152799423775558, -0.1317173228328198, -0.04926154374111001, -0.26533822358446224, -0.12851777133591546, -0.10355371090499974, 0.09877513087347736, 0.13712170624690043, 0.05957645703954457, -0.11944032210417015, 0.1640162467646904, -0.16741299524305817, 0.08735225020673432, -0.2880028723980621, 0.08713250084149426, 0.02396476148112601, -0.0800007600219727, 0.06816254069599084, 0.16420865038423968, 0.13701041274663311, 0.11450989446216502, 0.33171784063015614, 0.2124312780814256, 0.17071080115404502, 0.0035315979046685745, 0.047165498191124665, -0.44980074033805956, 0.010395852144262446, -0.011445806855275934, 0.011633232122204159, 0.07981668210428752, 0.15469561216853514, 0.00751613462145558, -0.2130670739671315, 0.23728400409972553, -0.26882138605688055, -0.18971398847799273, -0.023956486921209393, 0.09376498408125498, 0.041851926608205366, -0.03737978094689256, 0.34929604734184166, -0.3289482602918475, 0.3692393778070024, 0, 0.027095054853906314, 0.011249281609127122, -0.5894779081883857, 0.29228629752697, -0.10828331163497258, 0.3294016526375409, -0.1633358131148588, -0.12016769477186542, -0.032018082613000654, 0.14799973857677406, 0.10527593315821476, 0.09528977120015802, -0.036558655216672196, -0.13338368392912897, -0.04737935567379809, -0.04614304686830644, -0.07005203096141244, -0.19701703635734183, -0.12476779749100758, 0.1262644526799178, -0.110518559163413, -0.14367601295156276, -0.2677928208287168, 0.08213799128375301, 0.3148759862484422, -0.05395016880210348, 0.0922656446623978, 0.03832497130188643, -0.1087386305373548, -0.08370985300645577, -0.11829713393537263, -0.07965859251331939, -0.025092673813921194, -0.2796631281789168, -0.24502901908790203, 0.06964064845341239, -0.057101170877972264, -0.03842044591221056, 0.07978126285271998, -0.15048072142392271, -0.03379391887762717, -0.12046350668252652, 0.15145145362809867, -0.07962544988445501, 0.12167447652270162, 0.6124009976136844, 0.16163682034590146, 0.6262324844562808, -0.18826335959309837, 0.4754121395068967, -0.14831526434109585, 0.19514939707863116, -0.16979586293000293, 0.120600975353191, -0.03142738612078493, 0, 0.25758406976950576, 0.1283324061059421, 0.37516946781592797, -0.0784887066887074, -0.023684485750657097, 0.08432899248872504, 0.5337276550652109, 0.6241267310278348, 0.25184850217361326, 0.11323697126211468, -0.26090991981999556, -0.354601060338413, 0.4727936072375938, 0.12207781998360671, 0.07534266446177552, 0.4609394841582948, 0.10708838233434605, -0.08743011139977386, -0.162189481348484, -0.2652873873207766, -0.03397093570750794, -0.18237709248725775, 0.0922587888633575, -0.0693625258827298, 0.23740123684931388, -0.03134746635924755, 0.045724802379521375, 0.287964570554874, 0.06517366391329295, -0.0716841524986478, -0.09632503874395497, -0.020250504414171762, -0.1449324012090893, -0.15791455272124583, -0.07606971509360941, 0.15511532418892027, 0.09958666298230294, -0.23161424949200451, 0.10643268335906336, -0.05412952159360003, -0.034387914571814955, 0.0441262250191749, -0.430231782488165, -0.05358151245786507, -0.060932600740772724, -0.26927637874715127, 0.5327292135326305, 0.2290008131178005, 0.17097880927090575, -0.19500523826105717, 0.06742560286410489, 0.014455229751874117, -0.18249952585746965, -0.19290223073739307, 0.1987738332336329, 0, -0.07724412113694262, 0.09180212725606404, -0.07492253135527466, 0.07642769084918762, -0.13378886221600345, 0.0732870947608196, 0.23481365483236336, 0.008649801735378894, -0.08571198186000953, -0.3098131517860218, -0.2559966899023739, 0.07347379884693506, 0.12736668146217348, -0.1353975425502181, 0.18857757934154196, -0.18750386848365416, 0.450995062241002, 0.11489887894839833, 0.023181717494873463, 0.11401749042325232, 0.23222004728663012, 0.06567098927782147, 0.04073554680845086, -0.03615335781166415, -0.2500993370626585, 0.01668334849045055, 0.05985020044772397, -0.3937912194289597, -0.3384469771821769, 0.13774922689113006, -0.17979179751636687, 0.017942847144341936, 0.00850397357340041, 0.11029698177025513, 0.0892273341612643, -0.06432701318440631, 0.01196138025170388, -0.13472487271673636, -0.324184527975751, -0.11818952096650853, -0.26948317325736987, -0.15323811561761855, 0.02572337275741769, -0.12106570766610761, 0.18275543887459725, -0.6799064058906248, -0.006507036077687273, 0.1642323865409963, 0.026712131322030506, -0.09929577851901188, -0.09790966311755538, -0.13791632722140335, 0.00560015762114517, 0.5319379019380989, -0.13179097878950477, 0, -0.16001678763096183, 0.07097149001169731, 0.006451273152772867, 0.049723944311750694, 0.4063451119034303, -0.2817434389639062, -0.005571997729548492, -0.022747533117600426, -0.036301482811088144, -0.11138575535061514, 0.1731413030460878, 0.0070902652976213235, -0.2391627735837154, 0.09070405092959395, -0.15228839398830865, 0.009440458227031247, -0.11759630160166647, -0.23388387488291854, 0.1886780289614109, -0.260688152413479, 0.05909115437956577, 0.033359007397682106, 0.2272185216401458, -0.10277277612339376, -0.06096997164455401, -0.03757460134886147, -0.4382209421595358, 0.0964479102833346, 0.17769495111435005, -0.15631707960238853, 0.13379412908698105, 0.1103384298748565, -0.24659230902029675, 0.002500365620421401, 0.00807583346471717, 0.0366726899303409, -0.23556168563711102, 0.5029702839695975, 0.11458314307964274, 0.16770348005114552, 0.12319449895519165, 0.051889289674195226, 0.16062741115152748, 0.15812112502825948, -0.20210487874264735, -0.10648696233602242, -0.03965180260382248, -0.42084116698844565, 0.09920088209589376, -0.05015773532272349, 0.4264690809308368, 0.3803822448677054, -0.27368279729773565, -0.16671895365667977, -0.024201674745892313, 0, -0.03491593759369932, -0.30020495946842307, -0.047337970695079994, -0.0340772626722056, 0.13336352676638902, -0.33902091860643185, -0.36865758739144094, -0.40840071677799167, 0.159631757428039, -0.2215244416516259, 0.12231879371384816, 0.3002752192314544, -0.19272153706655978, 0.10526089930725652, 0.20108572944325148, -0.10821525569745011, -0.2668814011072695, 0.30465701281815794, -0.06202417386369325, 0.22611713959154076, -0.02738138469110479, 0.06300686199862603, 0.07499295875982075, 0.038798418327300375, 0.04679495800751869, 0.019056387178267756, 0.21641553318876638], b: [0.2080768452866238, 0.5230130241461083, 0.09054630653356746, -0.9365705008910924, 0.3532087855775399, -0.23827446065274693], keys: ["nps", "logEquivBpm", "cutSizeNorm", "gridRatio", "rhythmSteady", "chordMean", "largeChordRatio", "multiRatio", "singleRatio", "jackRowRatio", "overlapDegree", "jackSpeedBpm", "jackHitRatio", "heldJackRatio", "jackChordPerRow", "jackRunBpm", "jackRowMatchRatio", "longLnRatio", "tailChordMean", "tailFreeRatio", "tailHoldAdjWeight", "shortLnBodyRatio", "invHoleFrac", "offGridRatio", "techJackScore", "cutFreeRatio", "logCutDemand", "anchorRate", "trillRate", "altHandRate", "rollRate", "offBeatRatio", "graceRate", "lnWeightRatio", "lockRatio", "heldCoverage", "lnAreaRatio", "tailRate", "tailIndependence", "tailScatter", "shortLnRatio", "invGapScore", "lnHeadChordMean", "lnHeadRate", "tailSingleRatio", "vibroFraction", "vibroWidth", "wideSpreadRatio", "segIvLogStd", "segRhythmChangeRate", "chordOverlapRatio", "chordOverlapJaccard", "maxLockRun", "avgOverlapSize", "chord2Ratio", "weightedNps"] }, version: 1 };

  // src/classify/pipeline.ts
  var MODEL = {"rc":{"classes":["chordjack","dense chordstream","fast chordstream","minijack","speed","tech","wildcard"],"keys":["nps","logEquivBpm","cutSizeNorm","gridRatio","rhythmSteady","chordMean","largeChordRatio","multiRatio","singleRatio","jackRowRatio","overlapDegree","jackSpeedBpm","jackHitRatio","heldJackRatio","jackChordPerRow","jackRunBpm","jackRowMatchRatio","longLnRatio","tailChordMean","tailFreeRatio","tailHoldAdjWeight","shortLnBodyRatio","invHoleFrac","offGridRatio","techJackScore","cutFreeRatio","logCutDemand","anchorRate","trillRate","altHandRate","rollRate","offBeatRatio","graceRate","lnWeightRatio","lockRatio","heldCoverage","lnAreaRatio","tailRate","tailIndependence","tailScatter","shortLnRatio","invGapScore","lnHeadChordMean","lnHeadRate","tailSingleRatio","vibroFraction","vibroWidth","wideSpreadRatio","segIvLogStd","segRhythmChangeRate","chordOverlapRatio","chordOverlapJaccard","maxLockRun","avgOverlapSize","chord2Ratio","weightedNps"],"mean":[20.93774838995434,1.4080974987551738,2.1914240366760316,0.9428981373793501,0.9047728505549114,2.135125524957002,0.4640193509852115,0.7384616476328464,0.3892548428295238,0.1749313535443446,0.3436237658643697,0.5685865327287285,0.09375885928972184,0.00131894588553609,0.08704903896278011,0.38128399027490567,0.6639062392530343,0.01628625953791638,0.0828330674170041,0.08879070240106783,0.0029161940451753075,0.009124992427688508,0.2447181762705806,0.23322288545180636,0.2336716483837912,0.8201089820645772,0.43007010016086944,0.46037071170267907,0.0009239807033924681,0.11886746893020556,0.05025347629376421,0.03815928518425371,0.006387494746760668,0.02017262474484937,0.034352040479491454,0.012432056155795635,0.010465802987861808,0.008374183006535944,0.00610639680708885,0.005829082362775315,0.022107485299526827,0.011029528955607036,0.21196370109876272,0.016064058527189583,0.04658207007707588,0.4347897581044773,0.6751867413632097,0.9985294117647026,0.3355506613281114,0.22125833940306475,0.18376148063492448,0.08235852970854024,0.4648692810457504,0.44651437060431864,0.2659941553302713,1.2010059101611925],"std":[9.181886191066749,0.4202068551252959,1.2934606024495643,0.22482493974973877,0.21566483288699292,0.7790262997355679,0.2966722209852889,0.27703992425212104,0.3052272695380964,0.2563545624583077,0.3684423947809091,0.25120946851322623,0.13541507427563376,0.013070398959398552,0.16074159436203317,0.5362603558437544,0.43651095557819475,0.0764787430824936,0.26521568389214484,0.26192757580134235,0.030560007380948353,0.08032078635067129,0.3130880970139673,0.3452014041820118,0.35102493271700824,0.2655197184600404,0.2428473213721715,0.28251112317011096,0.023618187965021388,0.19303825208268258,0.15249938204732497,0.13557493015228117,0.0371712088554391,0.10280477789455703,0.16557076315505753,0.05782422417271025,0.04748186083697971,0.0491069313440768,0.05791289350157722,0.04124740260298424,0.13946490453469046,0.07353220315536717,0.6644342245234114,0.06981536470505975,0.1916448780333269,0.31905448147980114,0.37533749226731916,0.029668001473282305,0.2186480723780999,0.1977957881135459,0.23621557542828178,0.12149826275668694,1.0153370963315904,0.28630106829735574,0.18587684793965256,0.597515807979952],"W":[-0.07131559960253625,-0.11298837876546423,0.24948181702961972,0.28981701065906335,0.09058185315956463,-0.06381158887706265,-0.028956032059004107,-0.04374564516401094,-0.20272471313887291,0.24699014458075166,0.28165325437559413,-0.12143970108590507,0.4732204439547269,-0.04798774533080242,0.27420610123416095,0.23694275640757495,0.3153807560672357,0.1795741309516241,0.06781795270100581,0.10415274907616633,0.16993208311111263,-0.040490691604628794,0.13016703888158102,0.023887815722245936,0.03714410799686858,-0.26468816245868865,0.5876122398762574,-0.6300687063386766,0.0022550218681980003,-0.09138210444380175,-0.15422312760496876,0.4102422936383474,0.028501879783106653,-0.042145739060618345,0.013633368084772194,-0.16691946771798274,-0.23186952866762678,0.031933563982904936,-0.062027190299230386,0.051645540458987366,0.21324447870171767,0.15232884394634133,0.05911195093681604,0.014603329183047714,0.14409375912510847,-0.03452786562898168,0.025286958221182407,0.08580825477770374,-0.44530145434478235,-0.45668942622773817,0.31921985323085766,0.12932911850918982,-0.010640425855177549,0.18513688069811496,0.18324687049378283,0.12664060241171884,0.1665144143350045,-0.35727123268019967,0.3514171452592275,-0.020396174479525856,-0.32112731475665285,0.4538563399188517,0.249210144729083,0.04813483100415654,-0.3152074750604448,-0.3112959865283105,-0.39174008530098675,0.18721112142237578,-0.17012441573934867,0.11516587083041,-0.03785937413784247,-0.1382129286648025,-0.07979778400517465,-0.08928401886152941,-0.034339754208780916,-0.05157107661081153,-0.18056404565903328,0.06857987329948972,0.5535197308566893,0.09493460614292584,0.11049964129487938,0.3350637238662817,-0.2773335918868231,0.1336826679805535,-0.060238121138441444,0.11729311927699657,-0.23662763681968807,-0.35135929061147325,-0.0547210531552661,0.14233287484187232,0.059405064199868456,-0.014016537569825583,-0.08327628581410601,0.06453209409449501,-0.02399223513126113,0.026013233689229844,0.01727615413337548,-0.06323086098017,0.008792711215601778,0.12800100139799267,-0.11159586882003245,0.19966750739742634,-0.40547201919218184,-0.004955438993346602,-0.25414622859819175,0.024324860124357545,-0.26489309488679763,-0.04759240973957268,0.019167916447635693,0.10995445491534814,0.050629435126355364,0.44314946623770957,-0.09328450737087243,0.000343754748208731,-0.2467404682804746,-0.23698502223988177,0.04116248313835429,-0.08135328625109219,0.2351891448322064,0.16761120210049452,-0.10790462647315766,-0.018662674551085917,-0.425412301248811,-0.2761525559182937,-0.13284106417243285,-0.18738674863093557,-0.18084604747337524,-0.040749680481883946,-0.15096737507817296,0.07957606054071241,0.07890638497817701,0.0979199240075852,0.19297055602869212,0.1142891102997616,0.050361775373234885,-0.49024862587779927,-0.46835900105157424,-0.08337524609028395,-0.22758287613489353,0.01941146271640122,-0.009637973273793433,0.2569813235221187,-0.34002808673924395,-0.2775863892218724,0.11578373807604248,-0.21761468185442473,0.21681922236998674,0.14753399118770383,0.2616199657037615,-0.13498673002186073,-0.05386529786900869,-0.061902388120585086,0.09821561871888053,-0.022991170914186527,0.005159418374487509,0.09779237019346279,-0.09692586742070047,0.46633373993184696,-0.1571022968307648,-0.13367912846439528,0.08209148927025539,-0.15283891869124416,0.032795641826127,0.04945697325246633,0.10711516613030751,0.1458090289145854,-0.03606256114295867,-0.11923440621206942,-0.2143381455662751,-0.1663614338517238,0.13495841432116684,-0.2522336912758096,0.20568122148941576,0.3783927437495646,0.027780323714974985,0.00673981440948631,-0.26306277568712066,0.1700093471495618,0.11655925219471241,0.5190533561984001,-0.0906260445770115,-0.21453933291594227,-0.0676993173832867,0.4384933871917502,0.10032428092757957,-0.06369986748035475,0.0717273568968427,0.0985512764181225,-0.11999118916023,-0.12484074412751268,-0.14360557773174432,-0.2036156190037388,-0.1467228112415241,-0.13417673989522041,0.26087832860322147,0.04189438128924866,0.005666339011210505,0.028705172678331222,-0.16981282179205986,-0.10219505980025353,-0.04854548084701387,0.1290598331644008,-0.20749019983827516,0.21123986533819655,0.21472840873445134,0.1051597687036196,0.13927575625760555,-0.0594998183323993,-0.19054322437293775,0.004770935301474186,0.1999484784508989,-0.08029258956375569,0.2168155335575467,-0.8034104248128746,-0.13523688390480604,0.08386708780168914,-0.33446998509925563,0.0014815796950762607,0.15815726987721565,0.10091458750486254,-0.18443106049783153,-0.5429672456069414,-0.055086164275651744,-0.04649893762818097,0.24594838639984634,0.5614106268312821,-0.25415740486942745,0.08541830993147842,0.06155809683538662,-0.29840138969675456,-0.56454791689978,-0.2551703159425426,0.36172552717110495,0.15734718470292128,-0.06554459846947938,-0.03760347554245726,-0.18430578592655347,0.20834848470473352,0.032637172036130535,-0.2597256736668139,-0.2546485192706429,-0.026027634814052673,0.020414217787664793,-0.18375614185441913,-0.023624357336545936,-0.03345600143909613,0.10045710067827557,0.48105976346181056,0.481495601387088,-0.13677529231622992,-0.5443213233154487,0.5818884048420041,0.03811633073028984,-0.17062303298726955,0.23495299422209365,0.33384382149952047,-0.054603000867763415,0.09079008593604021,0.1342994360111844,0.01796500831956094,0.057038555407054374,-0.008489321503153242,-0.03220667078998336,0.07657168770429358,-0.10238054743308488,-0.05442191847555298,-0.040065263697543436,-0.04710371006995444,-0.25372710496840384,0.18454671070808754,-0.1245838530022792,-0.04407717948017865,0.07200218125167242,-0.5422595544484325,-0.010397434176262738,-0.059325311873326944,-0.11861216747332204,0.016028353174289828,-0.061805607544045627,-0.1851555927173706,0.08222231777036856,0.20081406433041696,-0.09213170804072925,0.19835187088392833,-0.3162296310722704,-0.2886130630739111,-0.32084956261909714,-0.07287697982749966,0.2593348974710715,-0.20062268327268323,0.42234797266604296,0.1659591944757995,0.09027909593909594,0.16133949257326977,-0.009984117061068217,0.33091677572304706,-0.06814264107314845,-0.08071104540166471,-0.026970986625481273,0.12240167890609843,-0.05587319386030937,0.04266017906822949,-0.2966732308084449,0.20868880152876457,0.11386592121795763,0.24282365710029077,-0.14608361917520352,-0.25371117796244036,0.0057452502946857935,0.46907345650672094,0.021545672835791355,0.28911042064243264,0.22719965589545738,-0.12508877652515854,-0.16636006720421612,-0.17136839360367312,-0.18043679332863738,-0.08155930847642608,-0.02534792549475635,-0.04967948857595719,-0.05864852062193459,-0.038183964489755216,-0.06202339817637046,-0.055628675005758924,0.13006238081059307,-0.33883247515969184,0.11749859634416074,0.03217193265083957,0.6124501501538164,0.38191337206501447,-0.2058883325609548,-0.09251764388968728,0.09908217033173104,0.18183356688004923,0.25947375831623903,-0.1341867021913228,-0.11574686596553534,-0.1259474006125198,-0.14282779541938276,-0.06397230347925259,0.2383732912062011,-0.10006975576959531,0.40217389830161693,0.14930709341991588,0.26783916571741906,-0.04376533208115519,0.06213650578292776,-0.43702793954991903,0.014397770521523075,-0.0349400212307327,-0.010454417214718608,-0.5676646365088728,0.13785128243232397,0.0005723750652650433,-0.177555171529428,-0.18769840994274217,0.017150146876313874,-0.026741725496243297,-0.3942268372495915,-0.11470674197420994,-0.1279234596036943,0.041128059793850376,0.34683084203288983,0.10690296747290803,0.01809315250785071,-0.6100479345530961,0.6441930058980752,-0.30205579614670164,-0.21361573888456295,0.02266640349788835,-0.05030682362332069,-0.024434465953980387,-0.03780432203489682,0.023409933220420374,0.05816356332663487,0.01685123317643067,0.02283604087398336,0.02172813561184919,-0.17092389710389028,-0.05737172613503408,-0.0287228322841112,0.3262228075641861,0.6796094983646881,-0.019135528292311757,0.2673738473664844,0.7440680874829668,-0.028993903310185372,-0.0802653137639315,0.08831840091665687,-0.09579503897544643,-0.34039573097372106,-0.08471442990048485],"b":[-0.10477372871913276,0.9272960818758034,0.07469930974060394,-0.16808053633635928,-0.16276923000668453,0.09758649156458486,-0.6639583881188158],"scoreGain":1.4},"ln":{"classes":["coordination","density","inverse","ln wildcard","release","technical"],"keys":["nps","logEquivBpm","cutSizeNorm","gridRatio","rhythmSteady","chordMean","largeChordRatio","multiRatio","singleRatio","jackRowRatio","overlapDegree","jackSpeedBpm","jackHitRatio","heldJackRatio","jackChordPerRow","jackRunBpm","jackRowMatchRatio","longLnRatio","tailChordMean","tailFreeRatio","tailHoldAdjWeight","shortLnBodyRatio","invHoleFrac","offGridRatio","techJackScore","cutFreeRatio","logCutDemand","anchorRate","trillRate","altHandRate","rollRate","offBeatRatio","graceRate","lnWeightRatio","lockRatio","heldCoverage","lnAreaRatio","tailRate","tailIndependence","tailScatter","shortLnRatio","invGapScore","lnHeadChordMean","lnHeadRate","tailSingleRatio","vibroFraction","vibroWidth","wideSpreadRatio","segIvLogStd","segRhythmChangeRate","chordOverlapRatio","chordOverlapJaccard","maxLockRun","avgOverlapSize","chord2Ratio","weightedNps"],"mean":[15.972709210533452,1.0923710703776033,2.5498025283167047,0.8159490285789012,0.6517508204080409,2.142748428885941,0.46349554834915074,0.7668524552330663,0.3670087427509474,0.08497744026273657,0.16515687230756754,0.36000521501957317,0.0894029667379305,0.05637386719172953,0.07737407390095295,0.32407891774181286,0.7032609153996814,0.56045445852904,0.743785024089873,0.6623329711645859,0.202011608269886,0.18794808566930513,0.23031219161622682,0.2287301690768112,0.2504976976402478,0.770247833229595,0.40734296580687374,0.28754268548061224,0,0.06801014763066617,0.024414526716691174,0.10929418135470344,0.003339442805426711,0.8187654853479378,0.2947432663094991,0.4867968410085562,0.5003151570703518,0.5933564799139865,0.3597656081006826,0.5019636893365831,0.610804303844713,0.5500215671958975,1.8409430698848972,0.6440958944730771,0.4185918120352241,0.28173054248125246,0.4577280802591697,0.9976591075347727,0.3441398906317693,0.24043486422603422,0.20614721014366094,0.07902949325192737,0.429407461594736,0.4310434274386964,0.27982382098889513,0.9236890246994582],"std":[8.964356418729299,0.5897303258238599,1.3013697273224998,0.3809410095679509,0.44335756559607875,0.6735276311559297,0.2936637946231972,0.25585433429091503,0.28550505660552516,0.18372871059365425,0.307768096900298,0.2994556840619319,0.11030490829351562,0.08768868829261041,0.11899193717260889,0.4813017699096504,0.4266597958210613,0.2665412569352661,0.2639194987172153,0.2422204923111378,0.1770330353417038,0.24849235502673822,0.308628405540351,0.37674209107225515,0.37744117406927735,0.3604613300334198,0.2808505984344401,0.2791535307764144,0.000001,0.16758497461665722,0.11368237408558736,0.28424388663716116,0.029200926667748952,0.21869468155646854,0.3140935589145856,0.20537041620838742,0.24044043222302516,0.4056577982823191,0.20959509703065382,0.257177614883311,0.36530440498608024,0.2608787412555152,0.6137293206666724,0.4456264497830043,0.31561763047950386,0.30749473674398625,0.43281862911790925,0.028527751143481727,0.21180949001936877,0.19034393430007804,0.22180113461803805,0.09449213050404882,0.6330951650122412,0.23122060874529352,0.18194252177986717,0.536298314587527],"W":[0.05286863926713915,0.0684920734955153,0.11901537856979127,0.08962645068330682,-0.30998057537623636,0.13947857089717375,0.23905567837485137,0.15229176350776286,-0.32970804747100607,0.12025230298206276,0.35029008689700836,-0.04715120572063597,0.18416799964768577,0.20112861984856933,0.12897596639449227,-0.07223483010685933,0.07374622702327296,0.2016747612564129,0.20755838523911338,-0.4188624329555013,-0.543928417993955,-0.05150419134970773,-0.15331225155176081,-0.1276665097697136,-0.271547399464542,0.27521731753268724,0.09837389293519103,-0.41562259626901865,0,-0.05629910575833913,-0.007404377470085943,0.28980329703605284,-0.3090172842696676,-0.20208654869297815,0.02697109248249996,-0.3189249562785588,-0.20513757396014481,-0.2223609597184179,0.46462341172727906,0.15832272874159414,-0.04910967281513945,-0.24231583296826112,0.07231153918550007,-0.2809984943766099,-0.027911119229368994,-0.17748757635868467,0.07225298475075849,0.13676828866583862,-0.015770746958835673,-0.2142080134295178,0.17341938756223604,-0.1536573963542752,0.14797640294245584,-0.2896614170162012,0.07528336248780489,0.01998246501080896,0.012920844708425652,0.029058012776918177,0.22889514571231911,0.13221432707920333,0.1606812868343051,0.45632035769496987,0.3394196377277808,0.2619473956091534,-0.07174639907316287,0.007661920708334324,-0.5007083371082413,-0.0008358073279148611,-0.07476039738318567,-0.024411757556406663,0.036068194728250964,-0.0405180797976622,-0.09769193818995081,-0.2716803383451346,0.3221279702455726,-0.3425515502972283,-0.2605860376000312,0.073487311941251,0.04531681375548055,0.016702323551339392,-0.06925807089275514,0.3737477853535722,-0.2369359477922046,0.43863101976689933,0,0.1846076732000791,0.09978272814739664,-0.18790861815132304,-0.06970782231992884,-0.05341793063613759,0.36608595192708016,-0.1605554738862582,-0.13966174435886,0.10343501276482384,0.22792528343332583,0.09712523265374633,0.12631708973600747,-0.004644497054467754,-0.11077476569480472,0.04501385575194806,-0.18543900827531462,0.00197709838776311,-0.20392909052481964,-0.12813523314127365,0.05563431213325239,-0.3334291303078629,-0.20442052355925502,-0.3383447817815545,-0.008627596164878959,0.1677807696892225,-0.016550138783444968,0.1613751920409885,0.07832763788523693,-0.16699085008049172,-0.04921725118334972,-0.21131944013843418,-0.17081049060430836,0.015547624613805846,-0.24063348229555126,-0.2919031509439472,0.0629268754870187,-0.08372050236976221,-0.0633439109892125,0.013436700783194477,-0.12746626715412215,-0.01661571930063751,-0.09065778669279825,0.06374505633050478,-0.10857272790153875,0.13575864808656984,0.5628752351072215,0.12380650415596056,0.6346689500073007,-0.2927065856104057,0.46406998681563255,-0.022881545678884008,0.35930669986896613,-0.21762525834617824,0.20218786095923663,-0.04114572996935006,0,0.3619089785684975,0.21005764686237233,0.3133327106091059,0.08103802767418429,-0.10547121755638472,0.09717011133324831,0.4947030554574007,0.5835534820058798,0.27648521109766194,0.1020768692417802,-0.38340464996505824,-0.3529687581164234,0.5235209482007902,0.09377945585438091,0.10527224072818848,0.49219165649073116,0.05885939343996224,-0.13451961605795246,-0.17558691848523875,-0.1458868337742939,-0.07444811378772702,-0.16003349962832025,0.13794050018163534,-0.04159440775024366,0.264591417337731,-0.08917096245528029,0.041670200642729936,0.22423915601366445,0.23568763839010393,-0.26949461580700773,-0.019695876440516083,0.09709175433303044,-0.3551216045551365,-0.357695089720669,-0.13278384746040964,0.29985326289066716,0.010939625018177468,-0.3243130931164412,0.28675036247142593,-0.13189465459105784,-0.09004029203105979,-0.02762021356497485,-0.07351866469695933,0.09354635543548584,-0.010443031053606909,-0.22081126903023313,0.620563489184895,0.3172787347777507,0.2372651002968296,-0.20322706815012218,-0.007836611454171749,-0.09700241554164714,-0.07656504989023423,-0.3187818000169243,0.35134994833651095,0,-0.2537463240776311,-0.04981652750638346,-0.2574263027716954,0.06167726942429535,-0.07662565614507744,0.04276276915409702,0.3732692712305019,0.17337742559942787,-0.16836951577711595,-0.3621296197560149,-0.05984178556184702,0.0840107992384366,0.2629192304679099,-0.10915429675518262,0.1909332350129528,-0.19483287888106446,0.6604019792901378,0.3483310063957487,0.03450626491633709,0.31863423165163096,0.6589007174184809,-0.006802841151714534,-0.0365969502433406,0.03654739828281277,-0.012687017407457424,0.03347959700921756,0.06328850117954939,-0.47439000913362717,-0.36848615222974407,0.1820308367839617,-0.13677518386567647,0.05248486558497316,-0.008055636343473711,-0.05073250382858352,0.08484752698973906,-0.08679738887780172,0.1711485669950002,-0.10873143038289104,-0.32498422363997775,-0.0034682794186518123,-0.10152913323376997,-0.07956521874848727,0.015102690795288434,0.009770322460687458,0.3069696385587291,-0.7124885465331838,-0.045684393590199955,0.18913972534427984,-0.18352467899625585,-0.16516254586490076,-0.05249019540654778,-0.07835529047221187,-0.09569994040007558,0.4968446954079973,-0.1826963400829613,0,-0.17887892185553708,0.08411573459245657,-0.027364335137307117,0.005060129153845384,0.4166514670559874,-0.16555046502562099,0.05990114808422294,0.08862325467404528,-0.11342500687938792,-0.13367594978393293,0.03624238330036167,-0.12479556322287819,-0.05026592091195317,0.045357297233185594,-0.2952399914428493,-0.03627779050413645,-0.15904146966887509,-0.32664287969688127,0.19590404671298967,-0.1665854061896495,0.15324120985409098,0.15079286851473478,0.32968669016913105,-0.06938446061648532,-0.017060861386572333,0.08904812002594921,-0.5130038776735517,0.10603373125916093,0.2022392776476981,-0.2112294940757148,0.14594972268211698,0.17053315922823598,-0.24816931230733966,0.07058575974217172,-0.07439968770229873,0.12547169704428468,-0.22628191333381245,0.6468066846997773,0.07278417343390767,0.15342159889933146,0.03146828227330427,0.03279905788351721,0.10742382747568763,0.029201761172043095,-0.36227967850297027,-0.15926177502848982,0.06272838350207421,-0.3365729545353442,0.21698304371828858,0.01231506499567122,0.19417253875797885,0.15685647650218978,-0.2590748542497716,-0.24168870149329608,-0.1505163017820802,0,-0.057592300077069516,-0.33673520462575646,-0.13043675158483414,0.23094968033727156,0.020949885974590354,-0.3674394598713047,-0.44839304460730883,-0.5007548439603484,0.12423525851243605,-0.29881999486243704,0.15155609083120303,0.3165461051799972,-0.48921392773401806,0.008480770176920852,0.2350191543263698,-0.04773085960084675,-0.3847094250903035,0.24450759513314552,-0.06345644866865299,-0.04602555686210444,-0.19005666974746427,0.047044608262318474,0.060971938028403894,-0.06491733669366068,-0.11296289121672244,-0.09208997828424632,0.22668751879947466],"b":[0.2919011105967127,0.06810985829533633,0.10761643314081556,-1.0026912025987833,0.7793245640210227,-0.24426076345510384],"scoreGain":1.4}};
  function modelScores(fam, f, extras, cutDemandRef, expert = MODEL) {
    const m = expert[fam];
    const vec = buildVector(f, extras, cutDemandRef);
    const x = VEC_KEYS.map((k) => vec[k]);
    const D = m.mean.length;
    const K = m.classes.length;
    const out = {};
    let max = -Infinity;
    const z = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      let acc = m.b[k];
      for (let j = 0; j < D; j++) acc += m.W[k * D + j] * (x[j] - m.mean[j]) / m.std[j];
      z[k] = acc;
      if (acc > max) max = acc;
    }
    let sum = 0;
    for (let k = 0; k < K; k++) {
      z[k] = Math.exp(z[k] - max);
      sum += z[k];
    }
    for (let k = 0; k < K; k++) out[m.classes[k]] = z[k] / sum;
    return out;
  }
  function regularityRestSupported(nps, referenceNps, rowCount, durationMs, relativeNps, rowRateMax) {
  return nps < referenceNps * relativeNps || rowCount * 1000 / durationMs < rowRateMax;
}
  function classifySegments(cm, opts = {}) {
    const out = [];
    const lnDom = opts.lnDominantRatio ?? CONFIG.lnDominantRatio;
    const mapMeds = computeMapMedians(cm.windows);
    const segF = cm.rawSegs.map((s, i) => cm.extras[i].rowCount ? medianWindowFeatures(cm.windows, s.windowRange[0], s.windowRange[1], mapMeds) : null);
    const npsAll = segF.filter((f) => f !== null).map((f) => f.nps).sort((a, b) => a - b);
    const mapNps = npsAll.length ? npsAll[Math.floor(npsAll.length / 2)] : 0;
    for (let i = 0; i < cm.rawSegs.length; i++) {
      const s = cm.rawSegs[i];
      if (s.family0 === "break" || cm.extras[i].rowCount === 0) {
        out.push({ start: s.start, end: s.end, tag: "break", confidence: 1, family: "break" });
        continue;
      }
      const f = segF[i];
      const ex = cm.extras[i];
      const lowStakes = s.end - s.start >= 2500 && f.nps < mapNps && (f.nps < 18.5 && ex.segIvLogStd > 0.41 || regularityRestSupported(f.nps, mapNps, ex.rowCount, s.end - s.start, 0.85, 16) && f.chordMean < 1.9 && ex.vibroFraction > 0.3 && ex.segRhythmChangeRate < 0.1 || f.nps < 22.5 && ex.segIvLogStd > 0.25 && ex.vibroFraction < 0.45 && f.lnWeightRatio < 0.5);
      if (lowStakes) {
        out.push({ start: s.start, end: s.end, tag: "break", confidence: 1, family: "break" });
        continue;
      }
      const extras = cm.extras[i];
      const lnDominant = f.lnWeightRatio >= lnDom || f.lockRatio >= 0.5 && f.heldCoverage >= 0.15 && f.lnWeightRatio >= 0.2;
      let tag;
      let secondary;
      let confidence;
      let scores;
      const scorer = opts.scorer ?? "model";
      void scorer;
      if (lnDominant) {
        const rule = scoreLn({ f, extras, params: opts.lnParams });
        if (scorer === "rules") scores = rule;
        else {
          const mdl = modelScores("ln", f, extras, cm.cutDemandRef, opts._expertModel);
          scores = blendScores(mdl, rule, scorer);
        }
      } else {
        const rule = scoreRc({ f, extras, cutDemandRef: cm.cutDemandRef, params: opts.rcParams });
        if (scorer === "rules") scores = rule;
        else {
          const mdl = modelScores("rc", f, extras, cm.cutDemandRef, opts._expertModel);
          scores = blendScores(mdl, rule, scorer);
        }
      }
      const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      tag = ranked[0][0];
      confidence = ranked[0][1];
      const demote = opts.wildcardDemote ?? 0.3;
      if ((tag === "wildcard" || tag === "ln wildcard") && ranked.length > 1) {
        for (const r of ranked.slice(1)) {
          if (r[0] !== "wildcard" && r[0] !== "ln wildcard" && r[1] > demote) {
            tag = r[0];
            confidence = r[1];
            break;
          }
        }
      }
      const margin = opts.secondaryMargin ?? CONFIG.secondaryMargin;
      if (ranked.length > 1 && ranked[1][1] >= ranked[0][1] * margin && ranked[1][1] > 0.3) {
        secondary = ranked[1][0];
      }
      out.push({
        start: s.start,
        end: s.end,
        tag,
        secondary,
        equivBpm: equivBpmFor(tag, f, extras),
        confidence: Math.min(1, confidence),
        family: lnDominant ? "ln" : "rc",
        scores
      });
    }
    const medians = out.map((_, i) => segF[i] ?? medianWindowFeatures(cm.windows, cm.rawSegs[i].windowRange[0], cm.rawSegs[i].windowRange[1], mapMeds));
    const diffs = out.map((seg, i) => {
      if (seg.family === "break") return Infinity;
      return medians[i].nps * (0.5 + medians[i].chordMean / 3) * (0.6 + medians[i].jackSpeedBpm / 150);
    });
    const finite = diffs.filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
    const p15 = finite.length ? finite[Math.floor(finite.length * 0.15)] : Infinity;
    const allNps = medians.map((m) => m.nps).sort((a, b) => a - b);
    const medNps = allNps[Math.floor(allNps.length / 2)] ?? 0;
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      if (seg.family === "break") continue;
      const dur = seg.end - seg.start;
      const easyAmbiguous = seg.tag !== "ln wildcard" && seg.confidence < 0.5 && diffs[i] <= Math.max(p15, 1) && (medians[i].nps ?? 0) < mapNps;
      const shortSparse = dur < 2e4 && medians[i].nps > 0 && medians[i].nps < medNps * 0.4 && medians[i].nps < 4;
      if (easyAmbiguous || shortSparse) {
        seg.tag = "break";
        seg.secondary = void 0;
        seg.family = "break";
        seg.equivBpm = void 0;
      }
    }
    return out;
  }
  function blendScores(mdl, rule, mode) {
    const out = {};
    const keys = /* @__PURE__ */ new Set([...Object.keys(mdl), ...Object.keys(rule)]);
    for (const k of keys) {
      if (k === "vibro") {
        out[k] = Math.min(1, (rule[k] ?? 0) * 2);
        continue;
      }
      if (k === "wildcard" || k === "ln wildcard") {
        out[k] = (rule[k] ?? 0) * 0.6;
        continue;
      }
      if (mode === "model") out[k] = (mdl[k] ?? 0) * 1.4;
      else out[k] = 0.5 * ((mdl[k] ?? 0) + (rule[k] ?? 0));
    }
    return out;
  }
  function equivBpmFor(tag, f, ex) {
    if (tag === "chordjack" || tag === "minijack") {
      if (ex && ex.chordGapMed > 0) {
        if (ex.chordGapCv <= 0.6) return Math.round(15e3 / ex.chordGapMed);
        return void 0;
      }
      return f.jackSpeedBpm > 0 ? Math.round(f.jackSpeedBpm) : void 0;
    }
    if (tag === "dense chordstream" || tag === "fast chordstream" || tag === "speed" || tag === "tech" || tag === "wildcard" || tag === "coordination" || tag === "density") {
      return f.equivBpm > 0 ? Math.round(f.equivBpm) : void 0;
    }
    return void 0;
  }

  // src/classify/smooth.ts
  function smoothSegments(segments) {
    const minDisplay = CONFIG.minSegLenMs * 0.6;
    const out = [];
    for (const seg of segments) {
      const last = out[out.length - 1];
      if (last && last.tag === seg.tag && last.secondary === seg.secondary && last.family === seg.family && seg.end - seg.start < minDisplay) {
        last.end = seg.end;
        continue;
      }
      out.push(seg);
    }
    const out2 = [];
    for (let i = 0; i < out.length; i++) {
      const seg = out[i];
      const prev = out2[out2.length - 1];
      const next = out[i + 1];
      if (seg.family === "break" && seg.end - seg.start < minDisplay && prev && next && next.tag === prev.tag) {
        prev.end = seg.end;
        continue;
      }
      out2.push(seg);
    }
    return out2;
  }

  // src/aggregate/overall.ts
  var NON_AGGR = /* @__PURE__ */ new Set([
    "break",
    "rc mix",
    "ln mix",
    "hybrid",
    "wildcard",
    "ln wildcard"
  ]);
  function aggregateOverall(segments, params = {}) {
    const dominantShare = params.dominantShare ?? CONFIG.overallDominantShare;
    const mixShare = params.mixShare ?? CONFIG.overallMixShare;
    const secondRel = params.secondRel ?? 0.75;
    const weights = {};
    let lnW = 0;
    let rcW = 0;
    const famTags = { rc: /* @__PURE__ */ new Set(), ln: /* @__PURE__ */ new Set() };
    let total = 0;
    for (const seg of segments) {
      if (seg.family === "break") continue;
      const durS = Math.max(0.5, (seg.end - seg.start) / 1e3);
      if (seg.family === "rc") {
        rcW += durS;
        if (!NON_AGGR.has(seg.tag)) famTags.rc.add(seg.tag);
      } else if (seg.family === "ln") {
        lnW += durS;
        if (!NON_AGGR.has(seg.tag)) famTags.ln.add(seg.tag);
      }
      if (NON_AGGR.has(seg.tag)) continue;
      total += durS;
      const t = seg.tag;
      weights[t] = (weights[t] ?? 0) + durS * Math.max(0.4, seg.confidence);
    }
    if (total <= 0) return { tags: [], sort: "rc", weights };
    const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const topShare = entries.length ? entries[0][1] / total : 0;
    const shares = entries.map(([t, w]) => [t, w / total]);
    const significant = shares.filter(([, s]) => s >= mixShare);
    const lnRatioW = lnW / Math.max(1, lnW + rcW);
    const sort = lnRatioW < 0.18 ? "rc" : lnRatioW > 0.68 ? "ln" : "hb";
    let tags;
    const allFamCount = famTags.rc.size + famTags.ln.size;
    if (significant.length >= 3 && allFamCount >= 3 && topShare < dominantShare) {
      if (sort === "rc") tags = ["rc mix"];
      else if (sort === "ln") tags = ["ln mix"];
      else tags = ["hybrid"];
    } else if (entries.length >= 2 && shares[1][1] >= secondRel * topShare && topShare < 0.55) {
      tags = [entries[0][0], entries[1][0]];
    } else if (entries.length) {
      tags = [entries[0][0]];
    } else {
      tags = [];
    }
    return { tags, sort, weights };
  }

  // src/index.ts
  function rescale(map, rate) {
    return {
      ...map,
      notes: map.notes.map((n) => ({
        t: Math.round(n.t / rate),
        col: n.col,
        lnEnd: n.lnEnd != null ? Math.round(n.lnEnd / rate) : null
      })),
      timingPoints: map.timingPoints.map((tp) => ({ t: Math.round(tp.t / rate), beatLength: tp.beatLength / rate })),
      breaks: map.breaks.map(([a, b]) => [Math.round(a / rate), Math.round(b / rate)]),
      firstNote: Math.round(map.firstNote / rate),
      lastNote: Math.round(map.lastNote / rate)
    };
  }
  function buildCachedMap(osuText, opts = {}) {
    let map = parseOsu(osuText);
    const rate = opts.speedRate ?? 1;
    if (rate !== 1) map = rescale(map, rate);
    const rows = buildRows(map);
    attachTails(map, rows);
    const cols = buildColumnData(map);
    const held = computeHeld(map, rows);
    const ctx = buildFeatureContext(map, rows, held, cols);
    const windows = computeAllWindows(ctx);
    const norm = normalizeWindows(windows);
    const activeCut = windows.map((w) => w.cutDemand).filter((v) => v > 0).sort((a, b) => a - b);
    const cutDemandRef = activeCut.length ? activeCut[Math.floor(activeCut.length * 0.8)] : 1;
    const rawSegs0 = segmentMap({ map, rows, windows, norm });
    const marks = markBreaks(map, rows, rawSegs0);
    const rawSegs = rawSegs0.map((s, i) => ({
      start: s.start,
      end: s.end,
      windowRange: s.windowRange,
      family0: marks[i].family
    }));
    const extras = rawSegs.map((s) => computeSegmentExtras(ctx, s.start, s.end));
    return { cutDemandRef, rawSegs, extras, windows };
  }
  function analyzeMap(osuText, opts = {}) {
    let map = parseOsu(osuText);
    const rate = opts.speedRate ?? 1;
    if (rate !== 1) map = rescale(map, rate);
    const cm = buildCachedMap(osuText, opts);
    const rawEvidence = opts._rawEvidence ? classifySegments(cm,{scorer:"model",_expertModel:opts._archivedExpert?model_generated_default:undefined}) : null;

    const originalSegments = smoothSegments(rawEvidence ? rawEvidence.map(s=>({...s})) : classifySegments(cm,{scorer:"model",_expertModel:opts._archivedExpert?model_generated_default:undefined}));
    const classicPrior = aggregateOverall(smoothSegments(classifySegments(cm,{scorer:"model",_expertModel:model_generated_default})), {"dominantShare":0.52,"mixShare":0.07,"secondRel":0.75});
    let readout = null;
    if (opts._segmentReadout) {
      const mapMedians=computeMapMedians(cm.windows),medians=new Map();
      readout=opts._segmentReadout(rawEvidence,(tag,parent)=>{
        if(!medians.has(parent)){const s=cm.rawSegs[parent];medians.set(parent,medianWindowFeatures(cm.windows,s.windowRange[0],s.windowRange[1],mapMedians));}
        return equivBpmFor(tag,medians.get(parent),cm.extras[parent]);
      });
    }
    const segments = readout ? readout.segments : originalSegments;
    const overall = aggregateOverall(segments, {"dominantShare":0.52,"mixShare":0.07,"secondRel":0.75});
    const result = { map, segments, overall, debug: { windows: cm.windows, norm: void 0, ctx: void 0 } };
    if (rawEvidence) result.debug.rawSegments = readout ? readout.frames : rawEvidence;
    if(readout){result.debug.classicPrior=classicPrior;result.debug.readoutSupport=readout.support;result.debug.cutExclusions=readout.exclusions;}
    return result;
  }
  function extractIntermediate(osuText, opts = {}) {
    const res = analyzeMap(osuText, opts);
    const dbg = res.debug;
    return { map: res.map, windows: dbg.windows, segments: res.segments, overall: res.overall };
  }
  return __toCommonJS(index_exports);
})();

if (typeof module !== "undefined") module.exports = TagClassifier;

},
function(module,exports,load){
module.exports={
  "schemaVersion": 1,
  "gate": {
    "ratio": 0.85,
    "rowRateMax": 16
  },
  "aggregation": {
    "dominantShare": 0.52,
    "mixShare": 0.07,
    "secondRel": 0.75
  },
  "selectionSource": "research/overlay-quality/overlay-impression-fixed-post-r1/final-inner-selection.json",
  "selectionMeaning": "Mean original6x3 INNER tables, source-TRAIN Speed queries only; never an OUTER model winner.",
  "coefficients": "Original archived expert coefficients unchanged; only the regular-small-chord rest disjunct changes.",
  "exposure": "Historical expert training exposure unknown; repeatedly studied data, not new blind validation."
}
;
},
function(module,exports,load){
module.exports={
  "keyCount": 4,
  "variant": "effort_evidence",
  "indices": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39
  ],
  "windowMs": 2000,
  "stepMs": 2000,
  "rowMergeMs": 10.0,
  "threshold": 0.55,
  "local": {
    "classes": [
      "jack",
      "ln",
      "speed",
      "stamina",
      "tech"
    ],
    "mean": [
      5.9814726870721415,
      14.980175684605259,
      0.43949777359229747,
      0.502691464274768,
      0.4973085357253888,
      0.06859590669516394,
      0.2465552911404372,
      0.30766536845737125,
      0.32923103551838495,
      0.6239482472622729,
      0.9934826258152376,
      0.04246520535323858,
      0.36786814137174806,
      0.2147419775056193,
      0.176830078351039,
      0.10162250270442705,
      0.014112183061797939,
      0.08183944368234844,
      242.283808695735,
      0.2025154320481096,
      0.042188300495838195,
      0.029835744436248417,
      0.011548124271353861,
      0.017175098412182323,
      0.05127078431228864,
      0.05749939992556891,
      0.03137549878528408,
      0.2737249215534303,
      0.09711992747285225,
      0.03894002820046553,
      0.006152820048731945,
      0.2803206045475812,
      0.228077381477917,
      0.7209996119983804,
      0.021511819497708362,
      0.07258717242882096,
      7.712173734445504,
      0.5759687735072526,
      0.07239295994853841,
      0.9992518846094004
    ],
    "scale": [
      1.7153027050580725,
      6.196260096579405,
      0.15722783337428786,
      0.3210876920198015,
      0.3210876920198013,
      0.22012820464100558,
      0.3110920786803331,
      0.37523170839161335,
      0.20383399784568396,
      0.12793726433447392,
      0.02523366000467913,
      0.054851164644959254,
      0.10154747994632668,
      0.10982425499935396,
      0.19355672317940026,
      0.14679233422162757,
      0.04861536560335197,
      0.10048992244155557,
      104.04460053787739,
      0.23941215117321982,
      0.1323731403261373,
      0.11198400555885145,
      0.0368136509729049,
      0.06581784144492787,
      0.18201308634013358,
      0.2074096157814248,
      0.10112954570801072,
      0.9709446333795765,
      0.2736247481308629,
      0.11041520531918181,
      0.04302996364557953,
      0.030659196538144248,
      0.3421920665286223,
      0.111794983095041,
      0.05495562121646172,
      0.1028339094764793,
      3.1666266453500467,
      0.17948017217900017,
      0.10088979585973462,
      0.019326096831550944
    ],
    "W": [
      [
        -0.5000085427519065,
        -1.6337031558578787,
        -0.4701812578718051,
        -0.0046976011728405076,
        0.004697601172832625,
        0.19458768734396886,
        0.6424309001386629,
        0.46540327532824516,
        0.11681775088040541,
        0.49715913486758195,
        -0.014097567416952207,
        -0.03433391964480072,
        -0.04883047319697988,
        -0.14452234426144037,
        -0.351366775806687,
        -0.05574198969906171,
        0.037092723133527086,
        0.15332430545252668,
        -0.30022943815994313,
        0.046636871044742415,
        -0.4621511460321614,
        -0.13288032072879552,
        -0.008449496648855519,
        -0.127668630678349,
        -0.277873139470756,
        0.12152750478789384,
        -0.06158555055304994,
        -0.5540915541483677,
        -0.2185008979547705,
        -0.30173703198617113,
        0.04602484876511823,
        0.04347927446700409,
        -0.17389580816707456,
        0.004780171095518591,
        0.10411620157735733,
        0.15341030835849462,
        1.6551267257336681,
        -0.027929730447807832,
        0.09247519221147177,
        0.06381388680885523
      ],
      [
        -0.7201748596973322,
        -0.007337803150043503,
        -0.1711909750006917,
        0.33563122033112935,
        -0.33563122033111653,
        0.16095057552784725,
        -0.779879238458874,
        -0.06497568825055453,
        -0.15867425339151328,
        -0.2075449042183666,
        -0.3414033790828233,
        -0.05022178951466925,
        -0.11324324884928333,
        0.1131350910478946,
        0.008599889238995061,
        0.033464023600754525,
        -0.13926245651425148,
        -0.05793115524510848,
        0.024281985045868596,
        0.0012043518080829831,
        0.5415506108758765,
        0.1632493440488214,
        -0.11009839662485266,
        0.43773623167407083,
        0.28989054483991594,
        -0.18550281573922076,
        0.038865730609049604,
        0.8701135157784519,
        0.3213831957188292,
        0.3464402379411423,
        0.016147604715776517,
        -0.28813429645253136,
        0.33546180911464235,
        0.15992184225419132,
        0.08742803322364315,
        0.18124553445966263,
        -0.35730175985503554,
        0.1056257583172456,
        -0.007036349640781845,
        -0.06004121277694663
      ],
      [
        -1.336829589335299,
        1.158931380364619,
        1.4965547039007492,
        0.09621262741749853,
        -0.09621262741749637,
        -0.4341348034922959,
        0.23376520928772102,
        -0.26596087921124617,
        -0.7286303768211757,
        0.20461872765553127,
        -0.05281750449886221,
        0.032369225372756355,
        -0.3684512097458364,
        0.3733949879434962,
        -0.07150237184353504,
        -0.35355674552945804,
        0.1247051820600312,
        0.685786782418855,
        0.38086435180351025,
        -0.03012481402140801,
        -0.15164980155057312,
        -0.19798738156252757,
        -0.032705309503095366,
        0.13889456403120704,
        0.37226582300474925,
        0.03810070808270091,
        -0.021045640665511657,
        0.2652386553278532,
        0.0031097145389293993,
        -0.134918436065738,
        -0.013581445981510686,
        -0.04147354285014864,
        0.07462299577243531,
        -0.48908044813668,
        -0.2193172223756211,
        0.09564175148824092,
        -0.5981008037955069,
        0.01862427643068968,
        -0.11639279795725907,
        0.08291170417174656
      ],
      [
        2.3151143659308455,
        -0.05148640738511793,
        0.7136770219629144,
        -0.16243540658810018,
        0.16243540658809705,
        0.014585242740703904,
        -0.3760431415122385,
        -1.0231565222071657,
        0.0730434884627356,
        0.06138236184135998,
        0.015876804899400056,
        -0.010457392967252791,
        0.37324634589805905,
        -0.2561444103451572,
        -0.15607079696453252,
        0.04595482621768744,
        0.11018276671062624,
        -1.3776500838032075,
        0.38559817514244155,
        0.09453489719700266,
        0.18388281686247906,
        0.01579357037963392,
        0.1475693608066986,
        -0.042898173588932324,
        -0.3420440930422706,
        -0.030131288522067364,
        0.03235857079260759,
        -0.33077985826262346,
        -0.038992314379712525,
        0.04491216778660826,
        0.016702184701810518,
        0.19106841544508227,
        0.6816019051444743,
        0.11878190042772657,
        -0.04134637901877103,
        -0.12337460382484326,
        -1.661800360302441,
        -0.018483222837798772,
        0.11735489353379759,
        -0.017399517895241953
      ],
      [
        0.2418986258536737,
        0.5335959860284323,
        -1.5688594929911672,
        -0.2647108399876825,
        0.2647108399876826,
        0.06401129787978146,
        0.2797262705447341,
        0.8886898143407238,
        0.6974433908695508,
        -0.5556153201461073,
        0.39244164609923643,
        0.06264387675397062,
        0.15727858589403668,
        -0.08586332438479553,
        0.5703400553757461,
        0.32987988541008423,
        -0.13271821538993406,
        0.5964701511769392,
        -0.49051507383186915,
        -0.1122513060284233,
        -0.11163248015562292,
        0.1518247878628697,
        0.0036838419701101673,
        -0.4060639914379985,
        -0.04223913533164215,
        0.056005891390693716,
        0.011406889816907734,
        -0.2504807586953072,
        -0.06699969792327483,
        0.04530306232416018,
        -0.06529319220119066,
        0.09506014939058828,
        -0.9177909018644719,
        0.20559653435924768,
        0.06911936659339005,
        -0.3069229904815454,
        0.9620761982193266,
        -0.07783708146232737,
        -0.0864009381472256,
        -0.0692848603084131
      ]
    ],
    "b": [
      -0.13619368804591403,
      -2.2315138063245916,
      0.7920294646516431,
      0.7244582592723392,
      0.851219770446037
    ],
    "multilabel": false,
    "temperature": 1.0,
    "C": 3.0,
    "classWeight": "balanced"
  },
  "map": {
    "classes": [
      "jack",
      "ln",
      "speed",
      "stamina",
      "tech"
    ],
    "mean": [
      5.1929495298419,
      13.098139775607311,
      0.4241139839665947,
      0.47480166558152925,
      0.5171388929507117,
      0.08867812606018606,
      0.24440415285559747,
      0.30229846193845356,
      0.3183569545413085,
      0.6023701922813163,
      0.971562011166056,
      0.06297174684898285,
      0.3712969595980338,
      0.20802006944822837,
      0.20754945373282352,
      0.1366016285163104,
      0.018257914009700317,
      0.07231497481016147,
      217.0354330982431,
      0.23416891210893004,
      0.054736826018840896,
      0.03296845475963548,
      0.02152682670231256,
      0.0204774384525595,
      0.061162151473216575,
      0.08189676448512519,
      0.046139446106404865,
      0.26997613985852736,
      0.1245399050553675,
      0.04655833286537676,
      0.008167513385214358,
      0.2921851958898551,
      0.22245711545968141,
      0.7084540693612345,
      0.030072131728465422,
      0.0746443106197597,
      6.726298683113092,
      0.581339886872443,
      0.10285237014189053,
      0.9851845022829934,
      1.7672843288008209,
      4.691308014289921,
      0.09863347085949392,
      0.22191149453678963,
      0.2212342624018462,
      0.09821814440662402,
      0.1830127390115173,
      0.21951544403493903,
      0.163402537871124,
      0.1184180241549401,
      0.08129257618418519,
      0.08655837251403428,
      0.10419908597850525,
      0.09385315407644555,
      0.1887123988275298,
      0.16575497084134763,
      0.04768391260185054,
      0.04828629500019791,
      76.16072886834267,
      0.23262084664949814,
      0.06271084745476312,
      0.04017094238061777,
      0.03990086621974233,
      0.024969783147367457,
      0.07544122272015444,
      0.17178312843131116,
      0.08299586440112362,
      0.260261578135931,
      0.18348962725174325,
      0.06447627493231538,
      0.02066664715067408,
      0.055143184709164725,
      0.19897884097576624,
      0.12326139438162766,
      0.05920292521738703,
      0.0840206976927937,
      2.415230673093461,
      0.17880649453722344,
      0.14477747629478485,
      0.06621894043296848,
      6.99273046,
      17.9254057985678,
      0.5356476324334604,
      0.7325419442585551,
      0.7876680857541187,
      0.17490042474017733,
      0.46774996918884665,
      0.566975318580482,
      0.5236709303929027,
      0.7263677678580478,
      0.9992024458935362,
      0.14423570817490508,
      0.4824674866920153,
      0.32049496685678075,
      0.4517234149809883,
      0.33150945609632443,
      0.05226927105196453,
      0.12129996847908747,
      281.7790051828519,
      0.5170102141951841,
      0.11135903759188846,
      0.05593331381495564,
      0.058556699163498066,
      0.04166478281368824,
      0.12394508326996194,
      0.2385354625728773,
      0.12200171495564005,
      0.5329378976172374,
      0.32470694422053237,
      0.10617450598225596,
      0.0185944639670469,
      0.3404362676932827,
      0.4435135183396703,
      0.8334811924081119,
      0.08421835039290242,
      0.16737605627376415,
      9.302562087921423,
      0.9013941698352342,
      0.25134760799746536,
      1.0,
      0.29623217975383903,
      0.09871795616938972,
      0.20824471138337142,
      0.2014246398682445,
      0.19538051282515542
    ],
    "scale": [
      1.16718660645146,
      4.11529991958237,
      0.11350088172776315,
      0.22531489011009104,
      0.22659310397165602,
      0.1971045044851523,
      0.226175526733118,
      0.27336598603283024,
      0.11701810513397862,
      0.07817062724040842,
      0.03394742341885338,
      0.03434136200618982,
      0.06036935327012572,
      0.05959971556296717,
      0.1022058868163526,
      0.0856886986926257,
      0.018092413203954136,
      0.07601043697969656,
      70.29313379553932,
      0.11436361340847344,
      0.11799653472997765,
      0.0950057549634067,
      0.02864985079889179,
      0.057463425379401786,
      0.15317902932611652,
      0.11989619036690001,
      0.06967556398416422,
      0.7538976772667576,
      0.1958741108245633,
      0.08502782952338885,
      0.026619478841082622,
      0.022452501048495017,
      0.2352104555341025,
      0.06311440770665927,
      0.028899072156711548,
      0.06097376395384199,
      2.124445237297259,
      0.03473402558383675,
      0.0411099060896978,
      0.0237699728863151,
      0.6219456392428189,
      2.495483507409395,
      0.04596346151556799,
      0.06838857797722325,
      0.06885266507921986,
      0.09675082902980567,
      0.07792316467931687,
      0.08921529909213534,
      0.045831626415170704,
      0.047238225925703176,
      0.08373305812635598,
      0.05928651503765875,
      0.036383402745278015,
      0.029442478711468646,
      0.05475774481753672,
      0.09213372127640207,
      0.028248621883773667,
      0.035087238267064856,
      40.71741271696459,
      0.06909411850600496,
      0.058068605483698424,
      0.060195614544546056,
      0.03452923147673616,
      0.037277430052998495,
      0.09556527189818859,
      0.13126489847081513,
      0.074919836175317,
      0.38214939276833715,
      0.148047160467729,
      0.05342740434034762,
      0.04141072956952378,
      0.0414250801023587,
      0.11463731772543927,
      0.04966517204275279,
      0.0414139379935923,
      0.04467566572198893,
      1.304852587399017,
      0.029589714730813402,
      0.058047902035323354,
      0.07917077072189611,
      1.4004144336543114,
      6.424731342088278,
      0.14803786551257675,
      0.22544333226772703,
      0.20487045784756583,
      0.2907899303496587,
      0.29141780835801007,
      0.32611255218562474,
      0.13026751481209103,
      0.08144261378101203,
      0.0009602300414803404,
      0.10817427103856,
      0.07628824063958599,
      0.07852533121392241,
      0.15575633945285122,
      0.2101661626296635,
      0.06828717087245513,
      0.10707616828993528,
      109.2373935059497,
      0.1887772001272324,
      0.17525482131152692,
      0.15070791537490633,
      0.07864646640398455,
      0.10177656869018278,
      0.26327180625492663,
      0.37705778819069746,
      0.1756894009148565,
      1.1704061564227721,
      0.44029109673606526,
      0.15292105526749467,
      0.07467389767716721,
      0.06294572921632001,
      0.3646697663397797,
      0.06017318413049052,
      0.08544226589409085,
      0.11789132852936691,
      3.4424951957065155,
      0.19172840162938223,
      0.13742519037071677,
      1.0,
      0.3444446112942752,
      0.24480278422734467,
      0.22683925677255246,
      0.26608469783671895,
      0.20661178610262715
    ],
    "W": [
      [
        -0.25249334678367025,
        -0.45950487581629834,
        0.28087425765221097,
        0.3352177948258551,
        -0.3159831118775012,
        -0.15887233639590972,
        0.4018972114930229,
        0.4180551627886298,
        -0.036463299978293555,
        -0.10597308365966905,
        0.13620999779491283,
        0.12216788336255377,
        0.2607430208776148,
        -0.16517678472981334,
        -0.23116157512662752,
        -0.09792899649404962,
        0.031982911251131764,
        -0.33227818351753774,
        -0.48250341248633993,
        -0.2916782542697662,
        -0.16173819447455204,
        -0.1287454581994711,
        -0.1892270942927551,
        -0.14283996234792484,
        -0.17273410814179685,
        -0.08283720327886175,
        -0.17512568095502473,
        -0.058427144552796226,
        -0.07974794358742457,
        -0.18671551821200363,
        -0.16601700643105988,
        0.14813330731033586,
        0.1773107104205512,
        0.05304257116153639,
        -0.1712743695021219,
        -0.297070583420077,
        0.11905287796561613,
        -0.042459057782361816,
        -0.016793282156164862,
        0.20465524418040182,
        0.03247814127168563,
        -0.4514628475986702,
        0.06814577744421997,
        0.41438345834108914,
        0.30787328229898103,
        -0.055615779314893844,
        -0.15589998635369298,
        -0.11792788966977887,
        -0.1793571153309669,
        -0.19040574424367668,
        0.020907611587614523,
        0.1285727609137022,
        -0.0941341057933946,
        -0.19666923108327597,
        0.20220714755798766,
        0.19182034528894068,
        0.10051924244714829,
        -0.1815855176417841,
        -0.26852474069938875,
        -0.02405705280688141,
        0.1046216067065983,
        -0.15669813944381902,
        0.19768077368319056,
        0.015701968495438,
        0.06131440802877052,
        0.1424005626515449,
        -0.12495759248530433,
        -0.020308695433679354,
        0.1201004297543244,
        0.0002790126292494814,
        -0.20397654305260782,
        -0.013255505247427342,
        -0.023769782520363783,
        -0.03149012337241037,
        -0.07873619738520951,
        -0.03916666281257451,
        0.3691856559362626,
        -0.11708038601073037,
        -0.0061562952957539075,
        -0.044298228427662976,
        -0.17586465546802718,
        -0.5577409095787949,
        0.16461875777617035,
        0.3452959217612643,
        0.015034866391338676,
        -0.14386981455444162,
        0.04202976022215901,
        0.09509343718341912,
        -0.0284563076378054,
        -0.12114533095756005,
        0.036804571293441765,
        0.1580692911936422,
        -0.040456453885313694,
        -0.06990751853374909,
        -0.08046468711441997,
        0.1768986804385402,
        0.16795784180654733,
        -0.08717326124927866,
        -0.36244122232176823,
        -0.18741900599426922,
        -0.02663051652498087,
        -0.13086662765134088,
        0.15521398392429253,
        -0.048798404494388624,
        0.02116953958445854,
        -0.17404863827104305,
        -0.06513872641637017,
        -0.01978729198356635,
        0.11438406568998986,
        -0.182653687420339,
        -0.16938525364363052,
        0.053972811120678754,
        -0.020947163013844246,
        -0.11514240907927883,
        0.08001181703348371,
        -0.07311602676055172,
        0.2817938243602359,
        -0.10993426396891393,
        -0.10037852717537551,
        0.0,
        0.6650595346193815,
        -0.2099459677484459,
        -0.013179536501008704,
        -0.5321903783358098,
        -0.16012379446436217
      ],
      [
        -0.16274512919620288,
        -0.10972059186922192,
        -0.028046844567432977,
        0.01033180786501432,
        -0.019942847723877524,
        0.258091297622642,
        -0.041145514964650715,
        -0.029704737153245623,
        0.0029807678797719997,
        -0.0005423779124060762,
        -0.03680882708808202,
        -0.03096766359731614,
        -0.0763092658511223,
        0.02585627657717745,
        0.002472834163331187,
        0.015573885069023121,
        -0.02320064036259083,
        -0.058805061186771125,
        -0.11525297737630473,
        -0.023359708895602207,
        0.20408911194725254,
        0.21352099774626454,
        0.1068975963753597,
        0.1406063964785063,
        0.2023650702463227,
        0.010289564876284954,
        0.2610394410316068,
        0.25032334525231215,
        0.26921786941252485,
        0.17500164406342825,
        0.021384490682612015,
        -0.035760864699414745,
        -0.02208283320892888,
        0.038156589212250645,
        -0.05128894074626529,
        -0.015550929981199134,
        -0.07091239246561393,
        0.01146480718852885,
        -0.002614325732994427,
        -0.12180940947551182,
        -0.13579392609574883,
        -0.07332377367144793,
        0.015929099877474484,
        0.03237709347487552,
        0.03804063844497325,
        0.08222332012200723,
        -0.058350999442818574,
        -0.010793738556140749,
        0.037970021937573074,
        0.02165712220771807,
        0.01563177227137068,
        -0.035836572570124,
        -0.017464235119184573,
        0.09612703549929559,
        -0.01440054863753976,
        -0.008418793220572401,
        -0.030722342339726576,
        -0.07154238416518371,
        -0.04966346769604112,
        -0.059378997591052585,
        0.03197996256141624,
        0.16011978843370595,
        -0.05910043186847636,
        0.010879364758309666,
        0.09163745054538004,
        -0.02604168831486795,
        -0.031572617899722974,
        0.2449469385450522,
        -0.05416196691298075,
        -0.058533266367871435,
        -0.05559162926448503,
        -0.02831826936251178,
        -0.039809509997191475,
        0.03490832238642608,
        -0.03665096704572501,
        0.0697914318098061,
        -0.01921044680408697,
        0.02785471069734946,
        0.013055858588744402,
        0.108808554542163,
        -0.2004888482302237,
        -0.09451648515939022,
        -0.019574908361275168,
        0.0373480583961837,
        -0.02122063900353578,
        0.17372717872111648,
        -0.04717548390060791,
        -0.020089503202824873,
        0.023627833972128733,
        -0.006151435686581381,
        -0.13511196024981478,
        -0.04939038666047061,
        -0.04568963205654036,
        0.08050136122060574,
        -0.005890188428811575,
        0.01016816279937699,
        -0.004967489868263801,
        -0.08340240326589338,
        -0.08783461960686115,
        -0.053561960306028444,
        0.13213606913686235,
        0.23934147445051945,
        -0.06443785670868271,
        0.09446525664937735,
        0.12946762712043647,
        0.02337184136166208,
        0.0896507096572418,
        0.2735810528780278,
        0.06767771582552369,
        0.047157150531913286,
        0.013179896906004424,
        -0.040868219683559415,
        -0.020521213059862493,
        0.09823139388895137,
        -0.035429095577643205,
        0.017122548683295474,
        -0.04034028277240583,
        0.04064022496301143,
        -0.08077710655644524,
        0.0,
        -0.07572105078258985,
        0.41050248701381703,
        -0.09152121961168475,
        -0.10587088445575317,
        -0.12331927715500862
      ],
      [
        -0.2574379945820146,
        0.21524860800655712,
        -0.2103971804291518,
        -0.24672483498668304,
        0.2249068630317125,
        -0.15867284578775934,
        -0.17753276369502458,
        -0.1497071948987627,
        -0.5117409634606817,
        -0.18216885963852528,
        0.06412298428115946,
        -0.08879515167798525,
        -0.27546903736600464,
        0.08375970989552921,
        -0.19467430606561056,
        -0.04930376038397953,
        -0.11831411033591474,
        0.021080731606797187,
        0.1838841805673479,
        -0.009937791166896554,
        -0.08348072922556206,
        -0.10759766978977257,
        0.1429751237329842,
        -0.049133337599365896,
        -0.014045254884696507,
        -0.02309575343799761,
        -0.13451302169070134,
        -0.06726491186896599,
        -0.11116840441615403,
        -0.0798475262138563,
        0.04728595765861026,
        -0.03416973566742169,
        0.01391313319540667,
        -0.6883423107526627,
        -0.43708547636200196,
        0.0023939257317794603,
        -0.2821627354458983,
        0.39143277253539493,
        -0.014471142947740327,
        0.04527054379241984,
        -0.33898287385714554,
        0.5682080012948815,
        0.14614760743208244,
        0.38511161203201716,
        0.4875526373899204,
        -0.24006192383259325,
        -0.2041304933484535,
        0.0013109348952689622,
        0.41446693459418565,
        -0.24206339184766887,
        -0.13389725557896326,
        -0.11814377540819304,
        -0.111770217747439,
        0.2432052935897087,
        0.25613444912828787,
        -0.2930951295191519,
        0.05527130112049432,
        0.9438670599400943,
        0.013372175484845848,
        -0.07769380845069931,
        -0.11994219626760426,
        -0.19388714005079596,
        0.11935482233055032,
        -0.015900079299390923,
        0.1544743770072572,
        0.19856519806810866,
        0.20625642830437893,
        0.03686737237851593,
        0.041414962539007755,
        -0.045239886234905616,
        0.08981108961140631,
        0.06186030706236639,
        0.1956599128398462,
        -0.33720235383438385,
        0.13799366348914194,
        -0.21240436161585724,
        -0.4102192901090097,
        0.17958280775147842,
        -0.1470886884610955,
        0.02745845882191095,
        -0.24914763169341328,
        0.4198738252512142,
        -0.20046788220043724,
        0.14133912151296626,
        0.11922258371137179,
        -0.23996908328454392,
        -0.19295190414608981,
        -0.012126609039217291,
        -0.26660506534916906,
        -0.2014334607019885,
        0.1891875746793873,
        -0.011504233218355213,
        -0.17432614965759666,
        0.18970392843641207,
        0.01715049670280526,
        0.001979575279304454,
        -0.09428220030695032,
        0.27373732130986483,
        -0.18299631812276645,
        0.37066132106528926,
        -0.0013786763885289292,
        -0.2239819775203511,
        0.1496323772464758,
        -0.027964584579701572,
        0.07391484754636622,
        0.489314642626645,
        -0.07082946777683272,
        -0.04617498285412083,
        -0.3656515952861639,
        -0.05544954793534019,
        0.03255562778627674,
        -0.3370866881520048,
        0.2325809830165428,
        -0.08203950634032786,
        -0.020077421924869922,
        0.06381145792313286,
        -0.32554424377489927,
        0.14087115541105835,
        0.24654654391017858,
        0.0,
        0.028775703679565584,
        0.02919332743458464,
        1.0627030384916856,
        -0.2678185173406499,
        -0.9043946891412151
      ],
      [
        0.3328461400087283,
        0.04921557147980935,
        -0.18993937868048974,
        -0.12559336632866197,
        0.10350704245870472,
        -0.12960048282571732,
        -0.47797514593376117,
        -0.6161975801672572,
        0.4205920835301646,
        0.38807868567891046,
        0.009280725905490667,
        0.01774616018922143,
        -0.05129047957750674,
        0.566449602878555,
        -0.2276272060851743,
        -0.22896300558598218,
        -0.1521995211274112,
        -0.018067489686832208,
        0.00102170061583707,
        -0.23729466549601588,
        -0.10062584681247595,
        -0.08951102157230116,
        -0.11809096487816863,
        -0.0498619382204684,
        -0.10747778880432653,
        -0.21466738391478918,
        0.023592090030202482,
        -0.12111985944124797,
        -0.2781090950453502,
        -0.02820113318045926,
        -0.07949394012812734,
        -0.00848639833815571,
        -0.3082797848964987,
        0.4444029829403609,
        0.12519735369789695,
        -0.3197689970717842,
        -0.1330538895962957,
        -0.19471840259082365,
        -0.09779280249765257,
        -0.29312703973655774,
        0.4711010891507359,
        0.3039095612868031,
        -0.03971214780314495,
        -0.2756212438012126,
        -0.023745887444274763,
        0.03224620730798612,
        0.2655774443756803,
        0.019326422241062142,
        -0.5002866182172945,
        0.6546560177074129,
        -0.15358556313589938,
        0.046013103488708684,
        0.2254871011302381,
        -0.19288322234013014,
        0.16659736629979116,
        -0.11986067802413174,
        -0.31671461881757657,
        -0.13382407326299184,
        0.1657706967535024,
        -0.022382957372803623,
        -0.12361341727900332,
        0.031205477274512936,
        -0.07630378751190564,
        0.1761103156870734,
        -0.09289278944626957,
        -0.1721782819975419,
        0.2180576501979407,
        -0.258646639813769,
        -0.17774513544732315,
        0.24019350858597632,
        0.0046414086843841245,
        0.06658891476279877,
        -0.1800490915815816,
        0.012314092880308547,
        0.10480851916347154,
        0.10573330568229097,
        -0.47839196338292095,
        -0.13171381767660967,
        0.028870077487405298,
        0.14084851719335495,
        0.5446422408521573,
        -0.08946696573876288,
        0.04226410037009082,
        0.019886255880334464,
        0.009556569229859053,
        -0.1830039701093498,
        0.10992365932471973,
        -0.09580764289859564,
        -0.09938824861347934,
        0.4998490664001217,
        -0.1735789795560406,
        -0.11785900053843355,
        0.2273741120165151,
        -0.20766491892025465,
        0.14100644802782733,
        0.17026700805428566,
        -0.07875333013008433,
        -0.5466494849422766,
        -0.404525235609127,
        0.03818424353037771,
        -0.02228417689255451,
        -0.12182240495839741,
        0.07736709941306723,
        0.005505654986820137,
        -0.11504435135434529,
        -0.1338929932000519,
        0.23115906470305217,
        -0.12669523383659817,
        0.1568682535108314,
        0.23280601868167586,
        -0.18030144092033545,
        0.10683552780996895,
        0.20857449220241261,
        0.16375113589615703,
        0.39721315223687576,
        -0.04352742810608404,
        -0.33366822778107824,
        0.3023651887654105,
        -0.4106569137113813,
        0.0,
        -0.735292810365039,
        -0.06789551540755179,
        -0.17712575219098098,
        1.381773894849333,
        -0.27878931271025403
      ],
      [
        -0.023789505232757236,
        -0.08746156498066977,
        -0.0808187768188314,
        -0.04004815580428397,
        0.05843126512668607,
        -0.13737054786101313,
        -0.04279072900562415,
        -0.03802231374257945,
        0.11415071054756026,
        -0.01262031123192747,
        -0.023490549795154282,
        0.07607056606483316,
        0.005979099158202774,
        -0.2636414632209681,
        0.6810759514978555,
        0.022445668407440843,
        0.017779371070694182,
        0.11381386852369306,
        -0.16822262315152522,
        0.40284269832342934,
        -0.14771263233730383,
        -0.18954215293903084,
        0.09060004327324893,
        -0.19333569852722318,
        -0.16264976758386182,
        -0.037789314660887974,
        -0.08881478089473736,
        -0.14014920481438695,
        0.1496683264642043,
        0.021723658959752108,
        -0.04149391271281822,
        0.04774263377726653,
        -0.2366303746894254,
        0.453572054518411,
        0.5366646022400545,
        -0.05881003549830056,
        -0.0264559562060854,
        -0.16156012668968708,
        -0.11966886074169941,
        0.12218335504562343,
        -0.316578392204017,
        -0.23310381912165465,
        0.0907010475946454,
        -0.41257140759797534,
        -0.4565305873576754,
        0.16954688383975272,
        0.20408501551174632,
        0.10836589627254027,
        0.07808595732002788,
        -0.0121941323363429,
        0.2094149317494435,
        -0.04042388700377643,
        -0.13637369244841782,
        0.13560462270167442,
        -0.3826791646209682,
        0.2130252576214375,
        -0.033992280483107144,
        -0.08730793319051652,
        0.15414052167001732,
        -0.07417238287378419,
        0.1505395184444355,
        0.13797932874794994,
        -0.09048333103420798,
        -0.13617879912392286,
        0.12583366249395492,
        -0.2634992657223676,
        -0.21995311861297265,
        0.05889525609398046,
        0.24021972756227986,
        0.15356832306738527,
        -0.0004158126248227972,
        -0.1573987134130653,
        -0.10979181760037887,
        0.24449247776749286,
        -0.09373499807560362,
        0.2568051326947805,
        0.18867386469991013,
        0.09456017007575683,
        0.0347817070524776,
        0.05994460009772639,
        -0.49572252605655454,
        0.23720262989103758,
        0.2925671982349611,
        -0.04407765202583605,
        0.07021439754236813,
        0.3352103532538514,
        0.23606908762509082,
        0.20892049091587214,
        0.17895168949977902,
        -0.19431001898976197,
        0.12591059520075798,
        -0.06745770083927248,
        0.11936203707418487,
        -0.045343985790014626,
        0.1519685795827302,
        -0.30739929895093376,
        0.3454599203520943,
        0.548995286654292,
        0.9651053173455472,
        -0.2726542451377901,
        -0.09772220957205266,
        0.007898374605196583,
        0.13015350816393734,
        -0.06755712527930938,
        0.02953396187736202,
        -0.2742665709929749,
        -0.20930718358920192,
        -0.003406399698376635,
        0.14365919456674434,
        0.2900205279582166,
        0.07010741171274092,
        0.21062242244335858,
        -0.3495142942992436,
        0.15121410094500293,
        -0.14578832658258603,
        0.2901047584132945,
        0.026675591699471785,
        -0.2619862626316534,
        -0.05905781183610967,
        0.0,
        -0.20117894602720202,
        -0.46723745543060097,
        -0.7347863155819309,
        -0.1590513668974024,
        1.9005476786752873
      ]
    ],
    "b": [
      -2.9836447279366523,
      -7.7615739208263435,
      -4.937505467547454,
      -3.599799156321765,
      -4.14542488770896
    ],
    "multilabel": true,
    "temperature": 1.0,
    "C": 0.3,
    "classWeight": null
  },
  "featureKeys": [
    "npsPerKey",
    "rowRate",
    "chordFraction",
    "multiFraction",
    "singleFraction",
    "lnHeadFraction",
    "overlap",
    "repeatFraction",
    "cutReturn",
    "chordChange",
    "columnEntropy",
    "handImbalance",
    "sameHand",
    "crossCut",
    "logIoiSd",
    "ioiChange",
    "graceFraction",
    "gridResidual",
    "rowBpm",
    "ioiCv",
    "occupancy",
    "minOccupancy",
    "occupancySd",
    "heldAtHead",
    "lockFraction",
    "releaseIndependence",
    "releaseScatter",
    "tailRate",
    "shortHoldFraction",
    "inverseGap",
    "lnHeadOverlap",
    "anchorShare",
    "repeatRun",
    "maskEntropy",
    "trillFraction",
    "rollFraction",
    "effort",
    "sustain",
    "burstiness",
    "activeFraction"
  ],
  "trainingScope": "training split only; validation selects parameters; test untouched until selection",
  "evidenceLevel": "weak whole-map labels"
}
;
},
function(module,exports,load){
module.exports={
  "keyCount": 7,
  "variant": "hard_evidence",
  "indices": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39
  ],
  "windowMs": 2000,
  "stepMs": 2000,
  "rowMergeMs": 10.0,
  "threshold": 0.55,
  "local": {
    "classes": [
      "chordjack",
      "minijack",
      "dense chordstream",
      "fast chordstream",
      "speed",
      "tech",
      "vibro",
      "coordination",
      "density",
      "inverse",
      "release",
      "technical",
      "wildcard",
      "ln wildcard",
      "break"
    ],
    "mean": [
      3.4246709998201363,
      11.587647841678127,
      0.31560391550034805,
      0.6358246643576612,
      0.3621778325212488,
      0.4179480510665248,
      0.11822471572780693,
      0.17468328715670164,
      0.27450039400632703,
      0.5407025907556653,
      0.9744029934006689,
      0.053025921608782466,
      0.4568440831414402,
      0.1612849942841661,
      0.28419416350199866,
      0.18901829608848655,
      0.03512795793080421,
      0.08444558581639476,
      198.30412014734375,
      0.3032137736967069,
      0.23492102579315954,
      0.13586159713383036,
      0.07533889745478911,
      0.1334598625650433,
      0.44861034582420717,
      0.21411317849015174,
      0.20235780586444682,
      1.3611478473647953,
      0.40578862931626214,
      0.14812743929264185,
      0.02087174693462064,
      0.18749215751382595,
      0.11307221240139641,
      0.8187823251573706,
      0.005819120113259835,
      0.05710304008397813,
      4.659389448691228,
      0.5623779511665591,
      0.10104684845984027,
      0.9920768423094131
    ],
    "scale": [
      1.324837833578617,
      5.624198693085714,
      0.10059366361159111,
      0.2669549250637078,
      0.2659291665370648,
      0.3824608974302638,
      0.17032270746634506,
      0.24772991229807645,
      0.18047252491276589,
      0.13355275385767368,
      0.07192891382956007,
      0.06771795840575448,
      0.08679234275938887,
      0.08864229108909345,
      0.2183005309450318,
      0.22895176297837855,
      0.07706983395328318,
      0.09824566838316015,
      115.27029022046432,
      0.24205398055369393,
      0.21943682305608794,
      0.1655451992094179,
      0.08147401912972102,
      0.1448127259382818,
      0.403979082778059,
      0.29657977145012565,
      0.2017891179781501,
      1.4545478733868693,
      0.37814091517779846,
      0.1489147611594261,
      0.07414667307338303,
      0.04032030915848615,
      0.2014925928268562,
      0.12870070668147834,
      0.033319906249018844,
      0.114594050960703,
      2.0062728786745554,
      0.16522096353532162,
      0.14010639367632277,
      0.0699825262337492
    ],
    "W": [
      [
        0.01641857606631949,
        -1.147982003125478,
        -0.10025467991172805,
        0.04469396629757958,
        -0.044878790651557296,
        -0.5091507500513857,
        1.0135861257287102,
        0.9957186296010679,
        -0.06745552051090814,
        0.9927595410477187,
        0.03689526944952774,
        0.05357537774000686,
        -0.08823667718738502,
        -0.2152142220405868,
        -0.2026820199474062,
        -0.7250243183300739,
        -0.08306358782026661,
        0.5340585297776372,
        -0.4565033935708712,
        -0.31240436617185263,
        -0.8897779428902148,
        -0.5175073467164287,
        -0.22997621347525798,
        -0.26556204354880203,
        -0.010753795074833455,
        -0.058082478484839946,
        0.5844734981736783,
        -0.296222098131036,
        -1.022297694132946,
        0.21188863798854204,
        0.15244355153604253,
        0.17507717181546498,
        -0.35378292575788417,
        -0.26037973651690755,
        0.0895781670533164,
        0.9553085826831353,
        0.8924294366677002,
        0.32218167282996124,
        0.4168677243964168,
        0.39442449838768345
      ],
      [
        0.04433363031432457,
        0.3329518022305866,
        0.4426381916384377,
        -0.09091420451355438,
        0.0912554777480536,
        -0.3465792485112557,
        0.9240085301961682,
        0.9526938581584452,
        0.4458651866676739,
        -0.07131115288685008,
        -0.31009415935938656,
        0.3084646276632078,
        0.9346662472427493,
        0.21152061488934265,
        -0.9703070240831936,
        -0.42023490118198176,
        0.15719647474312098,
        -1.0616988485868974,
        0.4136605753874866,
        0.7424204361422582,
        -0.2098585528214229,
        0.02562236416065666,
        -0.8518259743641925,
        -0.4028306829626888,
        -0.702200699899533,
        0.7980105602504259,
        -0.1513482916783498,
        -0.4037285258616582,
        -0.5191848146059764,
        -0.8752461042406364,
        0.4660231182663132,
        -0.1966819126285943,
        -0.43359196865259014,
        0.664106376775534,
        0.45424483418241673,
        -0.5931519360819535,
        -0.18265205482181884,
        0.02308648284302493,
        0.05056694294576817,
        0.056334703393486694
      ],
      [
        0.8954596720175052,
        -0.6781421638986289,
        1.4710086076303572,
        -0.259324672785384,
        0.2607591594127879,
        -0.8254145175300153,
        -0.4681301111072501,
        -1.5036287004121347,
        -0.08669258741631543,
        0.6958301042040886,
        -0.8235789200182512,
        0.21251812391641178,
        -0.09570180665518635,
        0.03952107147042559,
        -0.43730120678324796,
        0.06934370233765702,
        -0.0008605797649755783,
        0.7263704224772903,
        -0.3139954283125278,
        -0.02845900194615578,
        -0.746393600782285,
        -0.4470589344090648,
        -0.7205579494894427,
        -0.29622910562445465,
        -0.5806480392383122,
        -0.005252514811681844,
        -0.48730833128449863,
        -0.6815981607940752,
        0.5310104851227341,
        -0.026902823610090117,
        -0.06294695130847852,
        0.18759887544880172,
        0.9396355194319614,
        0.1742704999411116,
        0.14121706287817642,
        0.6367567560889937,
        -0.03995806890981721,
        0.02078127680416466,
        0.36613196681120624,
        -0.11546879133280077
      ],
      [
        0.5283605733823487,
        0.12088553673612996,
        -0.1030396029826045,
        0.166497027047888,
        -0.06121236758179878,
        -0.49610388556913504,
        -0.43812747138055613,
        0.05023250505221366,
        -0.4882447718958972,
        0.014902169888995245,
        0.04573686504821155,
        -0.02223290051536527,
        -0.14050918826259423,
        -0.23515010502480949,
        0.04577864419727023,
        -0.5688963445001896,
        -0.04659903579321663,
        -0.6421808116038907,
        0.013792152976699076,
        0.05667660837799248,
        -0.19746150264519619,
        -0.1634256024697551,
        0.8301454110186783,
        -0.32372596797806474,
        0.07784880822791562,
        -0.8312093009472866,
        0.29626029099681234,
        -0.6489150370851939,
        0.4946326999125223,
        -1.072523262143005,
        -0.1792139303373205,
        -0.2598451594608922,
        0.525003110851891,
        -0.08624545828081305,
        0.1118590277494975,
        -0.5906472887334421,
        0.030642343961148264,
        0.06032742228048149,
        0.18542444388318557,
        -0.036663001952968434
      ],
      [
        -0.27618500651490235,
        1.990852541099885,
        -1.00905956852048,
        0.3074576656749164,
        -0.30677333041123106,
        -0.003969478733522946,
        -0.46069033288286576,
        0.08144818406100211,
        -0.8306100832247678,
        -1.3303459114373324,
        0.32882706043025334,
        -0.10226085721423317,
        -0.7927684549306475,
        0.8046800531659478,
        0.9064399315490814,
        -1.1076382591409049,
        -0.30444238211070096,
        0.17446405587876718,
        -0.0636560664019923,
        0.30871559529930576,
        0.1395804522729119,
        0.3171351018588736,
        -0.2108967140388759,
        -0.4480883241860354,
        0.07536348915271185,
        -0.95703093847646,
        -0.24135129682805748,
        -0.10693883017644544,
        0.09405400969754062,
        -0.11358264598720925,
        -0.08499263277338132,
        -0.01851556978327938,
        -0.034719070450325476,
        -0.14031811535360425,
        -0.48167764712698313,
        -0.21634059931626723,
        -0.6481087970507806,
        -0.009149413281091897,
        -0.9076314668667527,
        0.007099960723049828
      ],
      [
        -0.09366746935028476,
        0.8147563428893545,
        -0.5236337245398547,
        0.056678371576537476,
        -0.05659619748104012,
        -0.5424728698136267,
        0.47250543218842067,
        0.2729413822146708,
        0.5247500606546099,
        -0.4438953240390483,
        0.40809451240810213,
        0.18592696461761285,
        -0.47044543163434044,
        -0.4186790693690597,
        0.24185943688678657,
        0.7815913625916182,
        0.04832032381253069,
        0.34036652639265813,
        0.17380334242910936,
        -0.04635874539339263,
        -0.4696467448371915,
        -0.31812089289530665,
        0.41412268500067506,
        -0.5917629774076912,
        -0.8645843320930634,
        0.11293297919703688,
        -0.8389870533626227,
        -0.673502075802369,
        0.1145143091250311,
        0.056949118007602766,
        0.050150753114268885,
        -0.04532785729183187,
        -0.6619891328940889,
        0.06954524412855777,
        0.2831169859730404,
        -0.12472771338454056,
        -0.13670028873468745,
        0.005210926925617109,
        -0.029653354839921934,
        0.005829428316386784
      ],
      [
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0
      ],
      [
        -0.7071516811908407,
        -1.1215163207080072,
        -0.46892626794326175,
        0.17403768066866188,
        -0.06754693865214063,
        0.5864757076030941,
        0.5740250258283979,
        0.6840696692330709,
        -0.04391478994588047,
        0.19604798858176772,
        0.035544578064524476,
        -0.03345445498742531,
        -0.5777451483578447,
        0.37103799126727177,
        0.16518446995648375,
        -0.11905090219143012,
        0.016598351014514214,
        0.13669980372292165,
        -0.4192444241839365,
        -0.4212603575317345,
        0.6575644744915744,
        -0.2546852881088479,
        0.18154633280056676,
        0.2511406771898444,
        0.43338935300182135,
        -0.4235403267220457,
        0.4276824225684872,
        0.2278204870646096,
        -0.024098137077666275,
        0.2284541889130986,
        -0.08934735224719612,
        0.037519930391396214,
        0.08762999818132283,
        0.04596267176379547,
        0.17309808809027558,
        -0.24143005000442078,
        0.7634525321209109,
        0.15273527736540404,
        -0.030653135612913156,
        0.031757931804417106
      ],
      [
        -0.23388391940234918,
        -0.6651561273069735,
        1.288869927562698,
        -0.17532424209950787,
        -0.07443966724520099,
        0.2821596433536391,
        -0.3325160392161287,
        -0.5792502486685969,
        0.2896965860465151,
        0.24134108077769578,
        -0.2683066606331678,
        -0.18981769088589584,
        -0.03074194397204605,
        -0.07818372359978253,
        -0.4605845066351607,
        0.15272377442543358,
        0.21926648657082276,
        0.40980091174556066,
        0.17102231646020966,
        0.1630353213959357,
        0.0841466357387802,
        0.04412704674243403,
        0.5951669294292701,
        0.43231440887041683,
        0.5234135910264439,
        -0.1545891554977145,
        0.04242314377350447,
        1.4417463081994522,
        0.11080327536452418,
        -0.1706916620476281,
        0.09591196995856249,
        -0.3494461613997041,
        0.19646873565968334,
        -0.09676877089288231,
        0.17133640067649578,
        0.12031870249595944,
        0.040323032422371397,
        0.009183315905600713,
        -0.23377070650641965,
        -0.26523063677647996
      ],
      [
        -0.44349813875890887,
        0.32494037637813367,
        0.0747309119350152,
        0.02737829684674551,
        -0.02730786323297859,
        0.5172483073006898,
        0.08947574998953202,
        -0.3693169632813758,
        -0.029951873779580244,
        0.4213296395464066,
        -0.1377429077249603,
        -0.02169159838345615,
        -0.21592886103217393,
        -0.3419082413538237,
        0.004483016921948125,
        -0.7582064668650158,
        0.020963738450928592,
        -0.2754877270126761,
        0.7674402795045333,
        0.21794371240491134,
        1.1138831756586596,
        1.1671908822862567,
        0.17747309942061013,
        1.3981167267900458,
        0.222975692767423,
        0.17827823762869668,
        -0.8341628712028125,
        0.7227179060808615,
        -0.639539799814141,
        1.2559323793359376,
        -0.29055317490002375,
        -0.14701399804740184,
        0.3393308712761208,
        -0.6338084678489362,
        -0.03134693017175275,
        0.17320234235451873,
        -0.29685707644929776,
        0.013532188511978944,
        0.4115047139033515,
        0.157172689312643
      ],
      [
        -1.176981467029948,
        -1.2470815729160376,
        0.4052080989882794,
        -0.12486871614017135,
        0.1410182313719459,
        0.7180568220470785,
        -0.09649926471189794,
        -0.40996673581731535,
        -0.0006328639505669618,
        -0.11022584626128352,
        0.0061042158045945104,
        -0.12880929396959948,
        0.09415547374315913,
        -0.12424091863712038,
        0.03280643750848052,
        0.29288311783565185,
        -0.06914984492722917,
        -0.7508123894680234,
        -0.40345586103303055,
        -0.6561029126296978,
        0.8224916313856949,
        0.5064710098182832,
        -0.6427713663967141,
        -0.2833205363626773,
        0.9917849580501469,
        0.6601241495386424,
        0.150728085742404,
        -0.851241820826555,
        0.41742968531267377,
        0.3460547892041031,
        0.23595316727925525,
        0.43072750705626867,
        0.18408537031720504,
        -0.03196629562271214,
        0.18906676446116152,
        0.2810520631385374,
        -1.1654654211552131,
        -0.23548877068317256,
        0.21409560329665112,
        0.024610230751517366
      ],
      [
        0.07162137606312156,
        -0.23859077171799678,
        -0.565081664711984,
        0.11145450702484919,
        -0.11186762519888258,
        0.7201234159062969,
        -0.14015985215884982,
        0.9383272218344677,
        0.6658126787846438,
        -0.4287844948070558,
        0.7704507725049332,
        -0.312375787130002,
        -0.12791837881191054,
        0.12190160482439945,
        -0.3920075908564772,
        0.4360097222501978,
        0.473850623479467,
        1.1526430642818843,
        0.24757787508601387,
        0.07542615262182971,
        0.4066400673209152,
        0.0011934563404379314,
        0.7179910116784579,
        -0.4210486961392438,
        -0.01951477021262906,
        -0.12049922694613285,
        0.7124808472882226,
        0.47247394266656206,
        0.0599417168442187,
        -0.2937116689985303,
        0.07484456626156627,
        0.4180806037370074,
        -0.3001559930192872,
        -0.0877563055611202,
        -0.03881980999925688,
        -0.3125894376134241,
        0.9788786667949548,
        -0.15249227545573463,
        -0.427113862462486,
        0.015682196063508208
      ],
      [
        1.2557904841754528,
        0.22578954235188528,
        -0.04218643585154875,
        -0.4595674641815166,
        0.4613476035879931,
        -0.41601370984436475,
        -0.9100396854107874,
        -0.7881671572472713,
        -0.11706504104748004,
        0.41928030064512817,
        0.3634783868100746,
        0.5104339671198522,
        1.1608040142875091,
        0.3705834894677408,
        0.9010318998833514,
        0.7544626299177356,
        -0.28826020813187375,
        -0.662591371406486,
        -0.15228509638463206,
        -0.05888444959665504,
        -0.22356340286924442,
        -0.128600394198902,
        -0.9050820143623137,
        -0.4359906653506894,
        -0.9347104636118343,
        0.297447315775719,
        -0.6941972366674772,
        -0.3758528951929737,
        -0.07640084475379774,
        -0.002404906819643982,
        -0.034343798885105255,
        -0.6542252950990483,
        0.3648878242730852,
        0.43945739642405124,
        -0.7065456700611236,
        0.4081279519044342,
        0.3462728967446491,
        0.05042904485006585,
        -0.439388272350712,
        0.0035218283551024334
      ],
      [
        0.47097337890404933,
        1.107598971012475,
        -0.3369881396099878,
        0.14265329966719648,
        -0.1299949852885017,
        0.21861372687930583,
        -0.6812341618045713,
        -0.35528321421503284,
        -0.2456924760769458,
        0.09758361151580613,
        -0.4136171324717326,
        -0.13379481246917038,
        0.5436549707960013,
        -0.4947276593903249,
        0.28515627108248304,
        0.506457772158964,
        -0.28369516242865794,
        0.8907293057605934,
        -0.14547701394447493,
        0.43565209241541814,
        0.3382852390376901,
        0.2584004052008196,
        0.7805051907570765,
        0.613669563665906,
        0.39258938396107285,
        0.27161275128790663,
        0.8295679889888017,
        0.5871318604633141,
        0.2837711982907631,
        -0.038814012326843776,
        -0.578123000838656,
        0.011649298898794161,
        -0.4689419031409518,
        -0.3228098074232346,
        -0.4745859473563114,
        -0.7051117796626194,
        0.3420880035117928,
        -0.32686515721111725,
        -0.2122379277302203,
        0.056786426429093484
      ],
      [
        -0.35159000867588025,
        0.1806938469746759,
        -0.5332856536833303,
        0.0791484849157591,
        -0.0737627063774486,
        0.09702683696321024,
        0.4537960547416753,
        0.030181569486785152,
        -0.0158645043051036,
        -0.694511706776041,
        -0.041791880312726265,
        -0.326481665501942,
        -0.1932848152252821,
        -0.011140885669612861,
        -0.11985775968040048,
        0.7055791106923287,
        0.13987480290553925,
        -0.9723614719593503,
        0.16732074198741612,
        -0.4764000853881612,
        -0.8258899290606643,
        -0.4907418076094555,
        -0.13584042797854007,
        0.7733176230441497,
        0.39504682394268154,
        0.231797948207733,
        0.20373880349190754,
        0.5861089393955146,
        0.17536391071453314,
        0.49459797272429956,
        0.24419371487415004,
        0.41040256636302,
        -0.3838604360761459,
        0.266710768467161,
        0.1194586736510484,
        0.2092324061310903,
        -0.9243452051019083,
        0.06652800831481757,
        0.6358573311328435,
        -0.3358574634746404
      ]
    ],
    "b": [
      -0.25282391316344044,
      -1.7333514750368415,
      -0.7637764769678833,
      0.8935890268318797,
      -1.0015286476068932,
      -0.7075348180752408,
      -30.0,
      1.649930908710123,
      2.5898074271604377,
      -1.2373009218067812,
      -0.8790165221640212,
      2.2496498686826523,
      -2.1709999696481286,
      -0.7770703592867533,
      2.1404258723707055
    ],
    "multilabel": false,
    "temperature": 1.0,
    "C": 3.0,
    "classWeight": "balanced"
  },
  "map": {
    "classes": [
      "anchor",
      "chordjack",
      "coordination",
      "dense chordstream",
      "density",
      "fast chordstream",
      "hybrid",
      "inverse",
      "ln mix",
      "ln wildcard",
      "minijack",
      "rc mix",
      "release",
      "speed",
      "tech",
      "technical",
      "vibro"
    ],
    "mean": [
      2.8615958111194915,
      9.364843597667928,
      0.3103993284773651,
      0.6137944297045891,
      0.36850774788396506,
      0.3504183078603313,
      0.1320731358365751,
      0.18632546427486613,
      0.26842245130646547,
      0.5236750782065374,
      0.9437779571792401,
      0.07021262335237675,
      0.4471984699140299,
      0.15608891254598348,
      0.27023662202437243,
      0.19199949617405182,
      0.031038488905785915,
      0.08539699906713344,
      162.26424992055237,
      0.28691010540035244,
      0.18972742068277018,
      0.10036027541132297,
      0.06938294051451042,
      0.09849117150792176,
      0.3475903218963615,
      0.18748633231383993,
      0.17269478044618108,
      0.908854883981279,
      0.3438877721821048,
      0.12421944726722155,
      0.023760235816180003,
      0.19773498783522658,
      0.12576156025254126,
      0.8232495740325805,
      0.011218345007044928,
      0.05018676823023703,
      3.7898775595779597,
      0.5743102892386356,
      0.11857488457327402,
      0.9742438552272821,
      0.9119876156403672,
      3.169792096893938,
      0.0837162998721694,
      0.23452791720751182,
      0.22947656854822535,
      0.13390759102163816,
      0.1436841177234744,
      0.19255153905728806,
      0.1569517674160196,
      0.12745141307340352,
      0.1028907899297437,
      0.08663520378084734,
      0.09995917063608852,
      0.07876829333036468,
      0.1958929597763314,
      0.1883736516145268,
      0.06085069214212428,
      0.04581375436202971,
      63.58002001707634,
      0.21847560064022872,
      0.0778785673778277,
      0.06739514133074269,
      0.04716801701619404,
      0.05739409817469014,
      0.16152387234758325,
      0.17742011835374147,
      0.10489713926075032,
      0.4445269907977879,
      0.16646924938950944,
      0.07478981611633895,
      0.044646280414320776,
      0.059186800842652106,
      0.16003938746320828,
      0.13726424168821075,
      0.03817328686827398,
      0.090299042053038,
      1.2708814243160202,
      0.16772126831866094,
      0.1492694836244049,
      0.0796941013615699,
      3.8237552764563105,
      13.09884244432039,
      0.40907721757281557,
      0.8924271866504855,
      0.6877509563106797,
      0.4950924770873785,
      0.31920094504854374,
      0.44657739898058274,
      0.4695327077669902,
      0.6664421705825243,
      0.9905756117475728,
      0.16312349451456315,
      0.5416932420873788,
      0.2575591255825243,
      0.5064455122330097,
      0.4134915286893205,
      0.09561318800970874,
      0.1421048712135923,
      225.69013850412622,
      0.5436025008737866,
      0.2788367215048544,
      0.18262524271844663,
      0.12589688995145631,
      0.16920794834951455,
      0.5237818639320388,
      0.42476677917475736,
      0.29232761208737873,
      1.4438973622330096,
      0.5282104906796116,
      0.21301091140776704,
      0.07165983946601942,
      0.2548329031067961,
      0.3157233508737865,
      0.9476915649029125,
      0.024799258252427202,
      0.15483051737864081,
      5.1818453155339785,
      0.8385922330097089,
      0.2800052355825243,
      0.9951456310679612,
      0.060128566533094154,
      0.06370281626096554,
      0.1182429511903721,
      0.05341405425154577,
      0.03998887492034371,
      0.08120905931403961,
      0.0,
      0.06097258435770137,
      0.11914908142176153,
      0.03182138134285034,
      0.10560548478167102,
      0.0746157203263727,
      0.04212921829989547,
      0.029351818385981034,
      0.11966838861340554
    ],
    "scale": [
      0.9757303724095332,
      3.058193938954578,
      0.06384110161595391,
      0.14039632759762213,
      0.13401311940622232,
      0.3462756146588419,
      0.10079938020840398,
      0.13861540877872924,
      0.0877210413816957,
      0.08464549994457354,
      0.08249516343888917,
      0.03762364269373092,
      0.04297019106567796,
      0.04474692544388065,
      0.11592993147829965,
      0.10411730179062968,
      0.027332196342206624,
      0.10435487563704453,
      57.2712589285788,
      0.1234027804166564,
      0.19153022324986368,
      0.12290653269892568,
      0.06358606368213399,
      0.10853319841922068,
      0.333714115099986,
      0.20059669186199236,
      0.1589802826876089,
      1.0442380948695023,
      0.31743640859621386,
      0.1175601233606043,
      0.03775313260347381,
      0.03019739866615158,
      0.10165326480538024,
      0.08115147355819637,
      0.013519559733108154,
      0.043274815840376686,
      1.4192711867343397,
      0.05030360211263244,
      0.048227413611297835,
      0.07258760081453954,
      0.5136312171137366,
      1.7635652143887603,
      0.03412253277588824,
      0.07164548559523769,
      0.0699106325129502,
      0.11806478067924955,
      0.06440464647382345,
      0.08178845900062579,
      0.04331275230092039,
      0.04919090815453379,
      0.09472841222014103,
      0.05813511857198264,
      0.04322092008817069,
      0.024467977986996722,
      0.06013694899576942,
      0.08512099159690355,
      0.03223033481065581,
      0.02984161872690724,
      39.12703464358663,
      0.06483976213185443,
      0.06983930538789705,
      0.06943850023224832,
      0.03757626245820246,
      0.05528544096833901,
      0.13896996980532708,
      0.14308292968506095,
      0.09299855082680474,
      0.4767201068539904,
      0.13984265089490688,
      0.06440311099839506,
      0.05775266888474124,
      0.04706288511269291,
      0.08632418217816505,
      0.07070747725004173,
      0.03724453172273421,
      0.05214308218106473,
      0.7060862171918968,
      0.031180912441137167,
      0.06370391177552583,
      0.097177646682195,
      1.3086642640945023,
      4.968736803616377,
      0.09596105879612354,
      0.14677506567144225,
      0.1936211644019986,
      0.43801951712050885,
      0.18572900865683298,
      0.2524732675125758,
      0.12075119740082858,
      0.096043299014273,
      0.06952220350001416,
      0.1258581613458745,
      0.060774920022966285,
      0.0691737137576909,
      0.15273827632536122,
      0.18422566858097827,
      0.08807276381041486,
      0.1159854157500822,
      104.97385947988278,
      0.17631210522635124,
      0.2590362539984324,
      0.19902862150539846,
      0.1145710156746299,
      0.17347960903003684,
      0.4603393710280851,
      0.4130655776321196,
      0.26198420466589106,
      1.5477832388133415,
      0.44616116614786255,
      0.1988672258899348,
      0.11643550258828335,
      0.09789515596911806,
      0.24111336947434245,
      0.07948616274826145,
      0.05201728189086954,
      0.12793994211086723,
      2.0126102606527634,
      0.22328843886320018,
      0.16851214468015585,
      0.06950398574405996,
      0.1276063586674327,
      0.12881559917994004,
      0.20959398195297785,
      0.10996644846996827,
      0.0882380786597496,
      0.1593331737108365,
      1.0,
      0.12825203107750438,
      0.19989959277097197,
      0.09253004252806074,
      0.21818572993581745,
      0.18996625439151651,
      0.07623473375356193,
      0.07711697479442303,
      0.12603740958184487
    ],
    "W": [
      [
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0
      ],
      [
        -0.04775495359952441,
        -0.12901831154782437,
        0.09082810132478718,
        -0.07909272306546997,
        0.12739720685397718,
        -0.10455524830445981,
        0.40021775307713603,
        0.42167726732325617,
        -0.03672530999878415,
        -0.012720757605234773,
        0.06391108232713705,
        -0.07213096495196485,
        0.03374557734002592,
        -0.016252209208047957,
        -0.2023953485155093,
        -0.15420022338954228,
        0.05820509721400586,
        -0.09529579832584587,
        -0.14588011540878265,
        -0.264868672405107,
        -0.1054549967306063,
        -0.08019401439193045,
        -0.10783842778907023,
        -0.09212405981547352,
        -0.09415744509235344,
        -0.08125347743553413,
        -0.09238196876307744,
        -0.053041519988019155,
        -0.11543345042060502,
        -0.09678276114298147,
        -0.09769319164180822,
        0.12584728891618543,
        0.20032898129876714,
        -0.025186185353124998,
        -0.11476108264786108,
        0.0021727727258508364,
        0.05002053290898648,
        0.025538117124096187,
        0.04559036368108657,
        0.06296681942452426,
        -0.09072301252315923,
        -0.2620001699081913,
        -0.2450896154714646,
        0.08063955678817057,
        0.101540283902168,
        -0.030588887073626166,
        0.10441915350120815,
        0.030336503930994758,
        0.17977295234034352,
        -0.14353102520844793,
        -0.05731312960381454,
        -0.022612275293798736,
        -0.21120891541827475,
        -0.039581967018231114,
        0.0787747576940659,
        -0.11707357181001629,
        0.09302525269116024,
        0.17540233583655626,
        -0.16931775594975454,
        -0.2662451417585805,
        -0.08146917765663353,
        -0.09909142330343679,
        -0.03655733257917781,
        -0.06035718955730906,
        0.02433611562316327,
        -0.0793997803509505,
        -0.051676311381110354,
        -0.021100541632343928,
        -0.16023906337645058,
        -0.015821636721226474,
        -0.07858152145005377,
        0.10535622730625349,
        -0.05490945423474519,
        0.09075894875704818,
        -0.22634196118982022,
        0.02476876850473792,
        0.06241106501475158,
        0.27203406352264764,
        0.023147251095837304,
        -0.13929871107515218,
        -0.06032997332733302,
        -0.15516447589565094,
        -0.08923768954590541,
        -0.10838799652856089,
        0.17486889235849418,
        -0.1044147955113206,
        0.10212045409461365,
        0.1384192553477973,
        0.12697702622868737,
        -0.04284785679953983,
        0.011336578948036158,
        -0.06500878349438444,
        -0.13061146192429576,
        0.03229436861273019,
        0.05755240283607907,
        -0.046326908641159625,
        0.17035325665474438,
        0.03860849003253367,
        -0.1122104991843442,
        -0.12421335531418723,
        -0.0899190316868665,
        -0.10573707192839975,
        -0.005984917057605823,
        -0.0766364917527565,
        -0.07631389768842936,
        -0.04776871193920103,
        -0.03115342476585973,
        -0.044854785943736326,
        -0.004983891679465826,
        -0.04824647422807781,
        -0.0653731836553808,
        -0.024568788032456015,
        0.11031289405454177,
        0.06212241095061554,
        -0.030352629597350297,
        0.007200050685579367,
        0.06784935788977123,
        0.1109874331181863,
        -0.01358467937863587,
        0.012620249247419946,
        0.7212203829227143,
        0.21610363527620294,
        -0.33626562198635207,
        -0.12489334005655497,
        0.05814504450982341,
        0.09007535879004581,
        0.0,
        -0.13988011366504266,
        -0.018150697415223002,
        -0.006898054580713648,
        -0.13284364348367253,
        -0.015058537966092765,
        -0.0695678915107725,
        -0.004238110906473106,
        0.0360442680005853
      ],
      [
        -0.040238355541608234,
        -0.09678584588793233,
        0.05081717945838329,
        0.19555652995880415,
        -0.11205501302927644,
        0.004524656225669903,
        0.05720536462811047,
        0.07603005870431657,
        -0.06952844247695229,
        -0.04271052888795672,
        0.20611490286555587,
        -0.18719527834234953,
        -0.033451282517897536,
        0.15645098544245767,
        -0.2185510619762744,
        -0.14782526634275195,
        0.019622060510912236,
        0.27814110824049587,
        -0.12601034635685038,
        -0.26871488527205034,
        0.10472571714841539,
        0.10320013243106514,
        0.1731351048063279,
        0.08318976035609653,
        -0.001696853265412432,
        -0.10808333390106495,
        0.07059085502430514,
        0.015765831805322712,
        0.04103900999971247,
        0.09532926441125245,
        -0.0666774008432577,
        0.04626483359044633,
        0.035060579460987305,
        -0.020007377788113102,
        -0.04318223647801318,
        -0.004194242998035945,
        0.04655955744185396,
        0.2635610694118669,
        -0.18862390531173093,
        0.032039425066650085,
        -0.2229878561086329,
        -0.14031007380131416,
        -0.12165599103723619,
        -0.03835664168929802,
        0.010848481129113718,
        0.023539014178388006,
        0.08429179846774847,
        0.09825351224832536,
        -0.08321332069875478,
        -0.040064361856608985,
        -0.1657480445336727,
        0.03942601634222581,
        -0.12233263869220555,
        -0.22470631254214538,
        0.07408545904596735,
        0.21803812717833865,
        0.29000512608474016,
        0.34457572918628837,
        -0.12481286018774175,
        0.09920466787787345,
        0.11174538439906567,
        0.14451456579512692,
        -0.063359965247405,
        -0.003351862214919596,
        0.08794820279238337,
        0.16523328600493478,
        0.0676547021074993,
        -0.050743877816828264,
        0.03883264462298119,
        -0.01522249309155918,
        -0.11529198911667717,
        0.06422724518779378,
        -0.025551455150818723,
        0.12116675092250667,
        -0.16300739544870044,
        -0.040288706116563974,
        -0.07729074097463219,
        -0.05903204071167622,
        0.14316915024184554,
        -0.14516205010855682,
        -0.07627875114155588,
        -0.1604820112367151,
        -0.08232560445799081,
        -0.06973015442394824,
        -0.2165867397955387,
        -0.027999046056391096,
        0.19426380086036393,
        0.040158890046162736,
        -0.12396943352052109,
        -0.13741782816658232,
        0.13303473185992076,
        0.26730892289849445,
        -0.07858544779102428,
        -0.05443006794452339,
        -0.026903378881545172,
        -0.07219195270637761,
        -0.017280314031224698,
        0.29416017119786914,
        -0.07802859505552545,
        -0.1408007662530772,
        0.129302423144314,
        0.1874030794228936,
        -0.028538186040116004,
        0.061512576183417336,
        0.019215226241987994,
        0.01644873657148334,
        0.09664646588898826,
        -0.017871258892933003,
        0.06736010323019256,
        0.06870106270272376,
        -0.09801811232611932,
        0.36604750488533666,
        0.040305289702106076,
        0.07059828589241217,
        -0.12371546192593048,
        -0.09070003714692113,
        0.039935072417194004,
        -0.2582107075081358,
        0.03515867548880348,
        0.06264784546953046,
        -0.15928538171365736,
        -0.06823041149404567,
        -0.07971388864564888,
        -0.17123175415382605,
        -0.019418897132308953,
        -0.01951304727221759,
        0.0,
        0.9219273392273223,
        -0.4698494620878054,
        -0.13491841466648377,
        -0.1413725008124552,
        0.18925549171199849,
        -0.03735268091218271,
        0.017192022570413742,
        0.42890106620764035
      ],
      [
        0.2521463032744147,
        0.08384203727414591,
        0.05665464113685834,
        0.08976061519312703,
        -0.03011448793756136,
        -0.015434966366585121,
        -0.206835947324355,
        -0.2695838516716734,
        0.17440117937254912,
        0.24607201697823408,
        0.05874443511565743,
        0.14698278202081586,
        -0.24343642499901982,
        0.18449404597982208,
        -0.12744693876496763,
        0.07044513719814714,
        -0.057832218327888686,
        0.3561878734570187,
        -0.0081643117974109,
        -0.19752675095167693,
        -0.07896657773622526,
        -0.016502776084949218,
        -0.14655467091785535,
        -0.12795799345880599,
        -0.21122341126540428,
        -0.2095335465783018,
        -0.16309878640305714,
        0.0019084539747786947,
        -0.0829548236099061,
        -0.19244955222214277,
        -0.17144206153199576,
        0.08794417073329604,
        -0.20069616746114874,
        0.31796464431617916,
        0.0654747462918137,
        -0.22075143680163534,
        0.08361612374650483,
        -0.05303755062681921,
        -0.07519746423343522,
        0.13178444069191933,
        0.2538716426962231,
        0.05297809153887955,
        0.01800510265800513,
        0.10392332536928095,
        0.18164461048917396,
        0.06837363743216053,
        0.11276172170355123,
        0.07507807976520277,
        -0.13585021080242576,
        0.0304373375590416,
        -0.13515213661291625,
        0.1359216341131612,
        0.10873763015075354,
        0.11535433441322626,
        0.03150119090197222,
        0.007816315227084043,
        0.011568302508198961,
        -0.2673797199550229,
        -0.23244413949711715,
        -0.11678594114359608,
        -0.031339880367081296,
        -0.08550837286206474,
        0.07951971111489807,
        0.01089726016481188,
        -0.006833883172803621,
        -0.28999849150776874,
        0.054828248283323666,
        -0.06796859033908087,
        0.1420317660600042,
        -0.024957710095989707,
        -0.2300622624713263,
        -0.0024228126966767067,
        -0.1894619073011423,
        -0.26940336796754544,
        0.13129519358898242,
        0.0342919294565932,
        -0.06303896690066765,
        0.019441902389621585,
        -0.06804849696048423,
        -0.264342875435632,
        0.32431857663185704,
        0.07148006961948433,
        0.09153411039638887,
        -0.024884016980519518,
        0.3116452383492284,
        0.013393656147305458,
        0.14484591818421846,
        0.035298113923378525,
        -0.0984432412329828,
        0.03152447368246922,
        0.011118481790315974,
        0.1760152831915293,
        -0.15511923399775646,
        0.11812123324489276,
        -0.14731740255561684,
        0.25044372853426117,
        0.0493942553049095,
        0.07038923963119681,
        -0.18668565855534908,
        -0.28945275782389096,
        -0.0680240280250256,
        -0.08507861685813158,
        0.05428863396043731,
        -0.058001172561131804,
        -0.0662377636773535,
        -0.28847649664818753,
        -0.035028760569817685,
        -0.019393553534059194,
        0.047281497939161046,
        -0.15965230508136102,
        -0.1591103052971845,
        0.13559942643457684,
        -0.05919949913029427,
        -0.062088742772406696,
        0.12774014996473423,
        -0.12780314551736202,
        -0.019196181746717424,
        -0.09523974699009609,
        0.12629043261797812,
        0.000461097441894166,
        -0.34829425299428984,
        -0.34958118271925126,
        0.8961733167338345,
        -0.04250857728635887,
        -0.42896117584986815,
        -0.04133375918009875,
        0.0,
        -0.14448126806771358,
        -0.27433996533677274,
        -0.030472563565803096,
        -0.10724294361961084,
        0.2834852849836015,
        -0.20104474745590317,
        -0.040560893696153774,
        0.1185795761717289
      ],
      [
        -0.038115070518264,
        -0.11599129479975688,
        -0.02789711961751145,
        0.15245583441609634,
        -0.1391987975497395,
        0.20642642962236762,
        -0.2540242296056935,
        -0.23974054725178398,
        0.19072420229883558,
        0.029653830279996286,
        0.02423925519665303,
        -0.05485303090015939,
        0.05189955163101771,
        0.19883196968021608,
        -0.09415352262975231,
        -0.09180440267291483,
        -0.014131834985156827,
        0.33148436037203144,
        -0.09902873608259795,
        -0.18679005570614224,
        0.09717098113594066,
        0.087740800013782,
        0.21812668001544547,
        0.06385357855639304,
        0.06953060980741745,
        0.3917111029154753,
        0.2962505770514895,
        0.3500879905255359,
        0.25828628958662936,
        0.13822578799010343,
        0.0678124652664887,
        -0.017191466457500734,
        -0.10330607410649072,
        -0.009037329284029392,
        -0.023755889989737922,
        0.21373523182208667,
        0.054372083249608696,
        0.5494165229656323,
        -0.262562347830267,
        0.0015345003068641366,
        -0.09639472605566583,
        -0.044439769035813405,
        -0.06333031577821457,
        -0.13886512556968056,
        -0.1487128081004606,
        -0.3208743431102452,
        0.02859769896305012,
        0.009277307759734978,
        0.05465398962986288,
        0.1359181477519147,
        -0.22248391667597006,
        -0.06765135600969546,
        0.15150047517357643,
        0.052805434040424176,
        -0.005953536966843938,
        0.0532967953400873,
        0.06451501502064139,
        -0.1665938688655999,
        0.04189509234146123,
        -0.24139354672502347,
        0.025812342659597802,
        0.04296469265338995,
        0.25915062019255736,
        0.17311355598235184,
        0.0715370889895305,
        -0.02057492526513167,
        -0.013453380672693858,
        -0.08894316614219099,
        0.04548179380172521,
        0.13495723528487566,
        -0.07958253463531649,
        -0.2673408417258873,
        0.10618895345927022,
        0.06833133787862776,
        -0.3204573632884028,
        0.25845168225282605,
        -0.1331450246400364,
        -0.41221718934545276,
        -0.014103501605332134,
        -0.07969607000507534,
        -0.12672191935721888,
        -0.10198967581463146,
        0.06883153276873887,
        -0.19861958072569602,
        -0.2399188627847619,
        0.0030054949251090033,
        0.029848493780322193,
        0.0177524725258888,
        0.03466052607692222,
        0.0731738388509129,
        -0.12520947701212062,
        -0.04517614370842705,
        0.06124133186924728,
        0.11432352356073429,
        0.009917777000208617,
        -0.1383854588290172,
        0.07015860155447758,
        0.1932189175448755,
        0.04092152045891877,
        -0.4081285456771886,
        0.055431689118970194,
        -0.030778913624541403,
        0.21399388466152303,
        0.021240735988605364,
        0.09781500970468737,
        0.17161885159487877,
        0.22791481518225087,
        0.15182720335163682,
        0.1645877095141639,
        0.19723792777901045,
        -0.11253165297269674,
        0.04643420820077105,
        0.08386620068253721,
        0.08887721256190935,
        0.23192609850728788,
        -0.06666465525836027,
        -0.08070075520742771,
        -0.2909880090291165,
        -0.2964171216570978,
        -0.13884266848275983,
        -0.04531300934084113,
        -0.023987387205510836,
        -0.059066142882235294,
        -0.3403973356316609,
        0.028521527776206177,
        0.006417232401954412,
        0.0,
        0.03404008636172955,
        0.680707495497258,
        -0.21963530369894937,
        -0.19454983897458125,
        -0.15782530370808343,
        -0.15025380357895446,
        -0.10720955233515106,
        0.21565761556454371
      ],
      [
        -0.06067865456267561,
        -0.017329817702297773,
        0.03540058828244772,
        0.05676203454757287,
        -0.012059566141778147,
        -0.09161644699912269,
        -0.22965345354583358,
        -0.04914944953839379,
        -0.20269020676478902,
        0.09322052272254192,
        0.08620071400736427,
        0.07627889120739755,
        -0.05369068247818122,
        0.13906256326758829,
        0.19726170274366728,
        0.10132289315559584,
        -0.029951080361484927,
        0.17679255283946999,
        0.09885361551108675,
        0.2515810249522845,
        -0.05636551809894957,
        -0.08184369331360565,
        0.08431265384200393,
        -0.050852032324096415,
        -0.024265405409612188,
        -0.10823002511097252,
        -0.07174222868627023,
        -0.07295704656138152,
        -0.10307150039091546,
        -0.08712747570278265,
        -0.06500624953062326,
        0.004996976969168585,
        0.1716498151060642,
        -0.189812116984257,
        0.14182944845719545,
        0.10693661922858506,
        -0.1132357295098018,
        0.09298220609028246,
        -0.09715972482553716,
        0.037507773384166054,
        -0.08742080273300185,
        0.037092228474468296,
        -0.13774599333725718,
        -0.2213266636381652,
        -0.23181381067343304,
        -0.0709128900488458,
        -0.06413864573045612,
        0.12335477069475322,
        0.11569703555027303,
        -0.097216150580108,
        0.042662120120946716,
        0.0839048353763728,
        0.025883639258107036,
        -0.026203635217127482,
        0.17483692634212325,
        0.06705837283884379,
        -0.0591191324679885,
        -0.2810781378886523,
        0.0036155089831076703,
        0.22870151344733913,
        0.010717350312178485,
        -0.07803633504849998,
        0.31363726195100045,
        -0.07976527351652965,
        -0.11262278767819536,
        0.16047740840608063,
        -0.092384006939104,
        -0.08208072831538733,
        -0.16818081313028072,
        -0.1471371230603171,
        -0.10638699224400741,
        0.18320723020440827,
        0.24328303617698865,
        0.15753971613023335,
        0.20380221511733768,
        -0.04697540507768868,
        -0.12271941873943142,
        0.06830974290047594,
        0.1317558427878005,
        0.052677141370208055,
        -0.09576565781219575,
        -0.017302633039328122,
        0.04838628371294573,
        -0.10050050787346732,
        -0.11822097161815795,
        -0.10010887891973498,
        -0.11738768193118178,
        0.07091964573861562,
        0.08969737523979357,
        0.08858343288070473,
        0.017896491997488804,
        -0.06951351127850654,
        0.07980212826768589,
        0.08912968313484987,
        0.08453542133668138,
        -0.10016242772645714,
        -0.1501984623228083,
        -0.09662237276746022,
        -0.07280760192672166,
        0.16833499355626694,
        -0.06704485556750098,
        -0.1086642497235835,
        0.11380777341231849,
        0.006647792038594282,
        0.08289394479880945,
        -0.22245799189492882,
        -0.007827698575104815,
        -0.0732443110523538,
        -0.11006734439458249,
        -0.04180660121468417,
        -0.054594983783247515,
        -0.21580978354476324,
        0.31427806585058204,
        -0.10162966262290946,
        -0.040233317814758855,
        -0.02701489485258935,
        -0.09585211188165188,
        -0.022677077920867955,
        -0.20185734786944118,
        0.023549278440144004,
        -0.1448181132012469,
        -0.069527383874812,
        -0.18755653132430963,
        1.0007220598060171,
        -0.15153288891094227,
        -0.09537455828981588,
        0.0,
        -0.047702740605285426,
        -0.04677864273888644,
        -0.01856808868661438,
        -0.07096697471545027,
        -0.039204688442432654,
        0.35398169502334953,
        -0.060698384470942904,
        0.02445250756623134
      ],
      [
        0.14516993519758276,
        0.19692290206948904,
        0.03153796736302528,
        0.07254846558584195,
        -0.043532407313566376,
        -0.23831206881898248,
        -0.10001917374453313,
        0.029843702479061433,
        0.10216814517221592,
        0.2297192248801014,
        0.09569104173779157,
        -0.1670156434475082,
        0.049548845459644025,
        -0.00488457164141978,
        0.1181700253251788,
        0.113552651831605,
        -0.11387350459373236,
        -0.19763861604085267,
        0.10775568960270113,
        0.12399429838947154,
        -0.19777433104566053,
        -0.40083672877528076,
        0.03426346933758552,
        -0.21807086880807916,
        -0.12276618238896798,
        -0.047452808293162466,
        0.19632405793196026,
        -0.25807145696381933,
        0.08977406024752058,
        -0.023422430205144965,
        -0.19647383841872937,
        -0.0878791027358641,
        -0.025451253940016454,
        0.15558828080485487,
        -0.11675399356175241,
        -0.15656330278456473,
        -0.08608786529773214,
        -0.17479232130087588,
        -0.1988051266058302,
        0.07158549135778858,
        0.04576093212748275,
        0.25759496780338725,
        -0.14824208309839276,
        -0.017834061976127684,
        0.010501631103206115,
        0.6986818494273606,
        0.06950526985364298,
        0.2529331698839702,
        -0.2524243810923338,
        -0.1392530619761056,
        -0.04581585031101668,
        0.012139083026842811,
        -0.12559637558746423,
        -0.17704536514279937,
        0.020091824469588508,
        0.18774139552942412,
        0.018615597015632493,
        0.19117864435385032,
        0.12124578124896596,
        0.14849367017691928,
        0.37963281342899624,
        -0.01920076207133333,
        0.23700489175185346,
        0.12636962857111306,
        0.5095347084122847,
        0.3165390742407406,
        -0.057605443337717145,
        0.3687546694383557,
        0.48566898083124094,
        0.08667020209718834,
        0.10962530568072633,
        -0.014277740246537673,
        0.05741990518096691,
        -0.09896337588790051,
        0.035407938293266675,
        -0.13967390168391758,
        -0.33851584904991516,
        -0.1927526833396997,
        -0.09049462563058386,
        -0.1126408664208276,
        0.008252802240372554,
        0.3092175306122125,
        -0.08510514088281439,
        0.32405702165930267,
        0.03912578628738433,
        0.2965037377026342,
        -0.15243895849466194,
        0.10061550525849174,
        0.02443055187262291,
        0.10819630326337552,
        0.020853956518725607,
        -0.01122435854453152,
        0.006252614808592316,
        -0.041963509491065115,
        -0.04158270560577775,
        0.026188981693715797,
        -0.28775812839720044,
        0.010446812613217659,
        0.492192678752145,
        0.01224678953002216,
        0.04542605854453594,
        -0.08125419097248297,
        0.17605924941276954,
        -0.09793579278793405,
        0.12549150877545717,
        0.31463733895962925,
        -0.03976858755128327,
        0.05565615934691079,
        0.24701314705767327,
        -0.061096135607980565,
        -0.23376829613283395,
        0.1135112452518146,
        -0.043557714348306326,
        0.175591933104012,
        -0.027662374987323993,
        -0.08128097783260585,
        -0.2765791826071753,
        0.4218951179857515,
        -0.1602199393159594,
        1.2755399792757184e-05,
        0.10636034602162919,
        -0.11218460552940934,
        0.08412092105831534,
        0.11668404973807607,
        -0.08148839787801056,
        -0.24993190905695153,
        0.0,
        -0.003047217867041338,
        -0.009451002610137099,
        -0.4234917714696532,
        -0.09108835661276096,
        -0.006019682009720541,
        0.17552018933015073,
        -0.09459905905629323,
        0.5857552531597034
      ],
      [
        -0.040090527704787396,
        -0.044959035400295194,
        0.009748258265971758,
        0.00988828529661029,
        0.004716882969501962,
        0.012189615103934086,
        -0.0240653996122838,
        -0.018621172037549392,
        0.022603331702114475,
        0.04426159249406782,
        0.05023380509839192,
        0.002586585249589351,
        -0.0394488681869946,
        -0.04357344316419641,
        -0.004602146424357389,
        -8.313220493008698e-05,
        0.011550910051755618,
        -0.03866880381893822,
        -0.045659056083921665,
        -0.02632477333082212,
        0.1210175885047192,
        0.1699173403175462,
        0.015997223415921333,
        0.207293275662749,
        0.09245306254546898,
        0.08463360016644215,
        -0.10305765867687325,
        -0.00494337218298557,
        -0.055680530208974864,
        0.1828682394507905,
        -0.050834626822908485,
        -0.031196904787988616,
        -0.018871975689671302,
        0.0485072667026411,
        -0.01978079938731418,
        -0.029313668420065123,
        -0.0030960574597097812,
        -0.059729241448208466,
        0.052676780815031445,
        0.02931047295589024,
        -0.016880840795633366,
        -0.024064250659178367,
        -0.0454788564082155,
        -0.023316111373978307,
        -0.010543000888502272,
        0.00012707400846134756,
        -0.04059472826366413,
        -0.017566795552131018,
        -0.012141802203665444,
        -0.027092445326893828,
        -0.03881380497273542,
        0.07308399380596452,
        0.0022523688938638465,
        -0.0677040382236064,
        0.07800654123819627,
        0.043388642405983675,
        0.02847660334128484,
        -0.014799076862744813,
        -0.022497792275273504,
        -0.011356838388418824,
        -0.04778250414768156,
        0.06091331657334344,
        0.0632998890418116,
        -0.024633974445540975,
        -0.10629316733121004,
        0.060483167099473635,
        0.06057042362532157,
        0.009692608268573832,
        0.0011423760951082358,
        0.03640940700220911,
        -0.069256014858637,
        -0.037788796744643055,
        -0.0339812286170985,
        -0.02911412639030685,
        0.045423596804338946,
        -0.03049649044065405,
        0.0024784354854487205,
        -0.12248345645604984,
        0.06601651270082733,
        -0.01435063949755744,
        -0.028240170658366447,
        -0.03979402105171996,
        0.006610015360032126,
        0.04810638539569183,
        -0.0007115880454355622,
        0.01943668357520621,
        -0.010132270447050588,
        0.0159684762387177,
        0.002226372636827486,
        0.013572910082257063,
        0.002036219072178449,
        -0.05733830179871235,
        -0.015932466438886888,
        -0.0681750497575538,
        0.08280747893570077,
        0.05681229214633726,
        0.041049415734486464,
        -0.0299720371523579,
        -0.04857141663560497,
        0.030734180799782913,
        0.0769711015151961,
        0.12683447301632242,
        0.0063480879819453285,
        0.11962810377078749,
        0.021749964507491233,
        0.07835187432019998,
        -0.057313717584324235,
        0.0045883232325285616,
        -0.035725573623362476,
        0.13498849110353978,
        -0.037990847894956985,
        -0.10252022785837654,
        -0.014759244071876548,
        0.0511134404051183,
        -0.0360811473861174,
        -0.010872158315570405,
        -0.0012315259317602547,
        -0.09158610607917701,
        0.007314327953247443,
        0.00015115492542420482,
        -0.011971226795494564,
        -0.012751864363329127,
        -0.012930236324325267,
        -0.020654129019346202,
        -0.014485279175128022,
        -0.013596016136937963,
        0.0,
        -0.06240009390581855,
        -0.061252915747255,
        0.6893646593221843,
        -0.051043064108855604,
        -0.051798399723629894,
        -0.01795688140539187,
        -0.06625308269540642,
        -0.03561263084748427
      ],
      [
        -0.15091074349280525,
        -0.28303561179540543,
        -0.05586789997954821,
        -0.136712477606102,
        0.04683999701503634,
        0.009072036728005007,
        0.15338135246161388,
        -0.0076603708076604556,
        0.1385443784607871,
        -0.1395986661936634,
        -0.08899344470618376,
        -0.18759831659869913,
        0.30484377045496425,
        -0.013867380867481988,
        0.10245955257099283,
        0.01894338021955037,
        0.03824617772397471,
        -0.0067505038736212835,
        -0.1580532607649636,
        0.24503454106765213,
        0.00031609772484094605,
        -0.022225958435844805,
        0.02021623001180825,
        0.06397433720052623,
        0.31400402317627996,
        -0.2366860399666182,
        0.18570784363836101,
        0.11816404841351522,
        0.33525030450398424,
        0.0753397533706853,
        -0.3180168825743635,
        -0.10698459291882505,
        -0.11265157109751706,
        -0.13353814458358296,
        0.17512263101789466,
        -0.2977111993476041,
        0.09777691553458005,
        0.12323488415544628,
        0.005515260699246184,
        -0.05180468647073288,
        -0.01658804072322707,
        -0.022939507376447246,
        0.01311657463453352,
        0.031058159382067053,
        0.055452187702915635,
        0.17623416039473794,
        0.19507606562028063,
        -0.13632725772822807,
        0.4537872082711485,
        -0.020727816963407666,
        -0.04954157307875964,
        0.027937889435125204,
        0.20166941638343497,
        -0.08228790799679432,
        -0.41078402775725464,
        -0.5528412445651085,
        -0.18123999311665817,
        0.22697240245976216,
        -0.12945106365193473,
        0.015417813286266343,
        0.20914511784671996,
        0.25700562022363926,
        -0.2697115436390141,
        0.14139323158182418,
        0.03559677256632857,
        0.17075366913997483,
        0.3103406049933408,
        0.18550978408999583,
        -0.0612952434650618,
        0.15987163624898956,
        -0.04362508878628903,
        -0.04599259103921071,
        -0.11286195964195768,
        0.0811612858039765,
        0.4635089401168037,
        0.035311640228996,
        0.36828268297310746,
        0.3803743888310757,
        -0.14200090439298232,
        0.027476473336890864,
        -0.02844346297382696,
        -0.13652191524402998,
        -0.11006472447360337,
        -0.23316435095144972,
        0.08273547102002328,
        0.10775636715293813,
        0.1685981956317345,
        -0.2321570385682587,
        0.36909662957236183,
        -0.14872589995515204,
        0.012449552514121085,
        -0.07351491266362212,
        0.31220755190715277,
        -0.03895464902585172,
        -0.07608677302862911,
        0.10878979834290728,
        0.24710338429143097,
        0.05582924584375025,
        0.03314417730785777,
        0.4746119587166179,
        0.053991697808729755,
        0.16259882447701413,
        -0.09427062633511397,
        0.11561637088902288,
        0.1686148268768647,
        0.04859624256090888,
        0.2325962578035416,
        0.05319291074632204,
        0.04856063687501733,
        0.14423703528147772,
        -0.001392834092441795,
        -0.23187915078786267,
        -0.14322251903652022,
        0.171453531484636,
        -0.15736267783439079,
        0.07458377761697478,
        0.20788596269297774,
        0.004581342871780684,
        -0.010076426095531454,
        0.020419640876977587,
        0.028807543278579196,
        -0.009635717607735034,
        -0.18764789724940292,
        -0.2576058551495781,
        -0.3310330663619575,
        -0.11709891273222249,
        0.0,
        0.07809811341127784,
        0.18732463144216854,
        0.1323634126975779,
        0.06622993139300032,
        0.13522222661759853,
        -0.4331760587942904,
        0.1726636139453429,
        0.26143244286895667
      ],
      [
        0.07951999964781753,
        0.13945175625589748,
        0.021407259745132242,
        -0.03628206523705173,
        0.0445952816891052,
        0.01843794769226932,
        -0.02358332908169608,
        0.0039970920628560076,
        -0.12569361652921585,
        -0.04948934793279825,
        0.03863430345437299,
        -0.06790310384143937,
        0.19274586146026004,
        0.030960446762692325,
        0.10274644572796095,
        -0.06090339823961337,
        -0.05170801626430823,
        0.04660298659750275,
        0.16139444393244956,
        0.12938144596670353,
        0.043012825322078556,
        0.06464073818170062,
        0.006998933398011503,
        0.04988085852438748,
        0.049595415066703806,
        0.020231007850566682,
        0.009451332313431222,
        0.05050472824863506,
        0.02289485877745327,
        0.020246032934003236,
        0.04570298209153134,
        -0.09528697073203989,
        0.07236263631001905,
        -0.001222830958992602,
        -0.0997416026721517,
        0.3016944548364143,
        0.08907330857264845,
        0.1061119063255504,
        -0.035737132457270365,
        0.02261720178431519,
        -0.16065982474777654,
        0.020959569378046033,
        0.11500662223236181,
        0.03549594961547708,
        0.03846588927069256,
        0.10254768381928782,
        -0.05387282549211638,
        -0.007658276726793444,
        -0.14959724278449227,
        -0.08379517060536744,
        -0.09776523646649848,
        -0.09668829269066996,
        -0.12376486545564888,
        -0.011467509816273196,
        -0.1789034693276213,
        -0.16337104212315506,
        -0.039790321138855125,
        0.011573571344839806,
        0.053512749171433116,
        -0.17207869899800846,
        0.07914559319484064,
        0.03218128311760001,
        -0.07785705449142898,
        0.03322123162956092,
        0.06459755240610084,
        0.012827196738893423,
        -0.03220778713529528,
        0.026701812155619682,
        0.05983845487801887,
        0.09381109028928421,
        -0.02667070818377441,
        -0.10154103151536159,
        0.04769329346982684,
        -0.028379359532186572,
        -0.11542028631013845,
        0.13487353791995318,
        -0.13935319847712432,
        0.12545243849444734,
        0.06004397567664504,
        -0.08626882133235961,
        -0.0014899731925147402,
        0.09730740314514705,
        0.11340945595446655,
        -0.016827617019674012,
        0.012126075479244325,
        0.03572166825054663,
        -0.01748244469653794,
        0.016502082690700123,
        -0.16654756724152395,
        -0.11547280874086581,
        0.002833919067849465,
        -0.06677992549909616,
        0.10398066342892145,
        -0.03968600478095149,
        0.01117906633179362,
        -0.14309836417336005,
        -0.01488428459129544,
        0.018839405933403122,
        0.08497194735545392,
        0.013199574540007832,
        0.04325749390633435,
        0.015834310995615532,
        -0.03381195878979123,
        0.0374958897681898,
        0.05752884754526723,
        -0.009946069089256954,
        -0.011752329744948688,
        0.02461492304908936,
        0.04413414628238343,
        0.06651450923142674,
        0.00024007419411608687,
        -0.07007367225461042,
        0.10221146904419694,
        -0.03440428195390525,
        -0.06374158253446352,
        0.1783478956820049,
        0.038725923241236145,
        -0.03320436053629621,
        -0.05993854239889777,
        0.00020593167298660938,
        -0.03127706707976345,
        -0.024777725092290332,
        -0.028521145839082187,
        -0.04129582473556551,
        0.23672562351354667,
        -0.05040776346525508,
        0.0,
        0.04619519823110051,
        0.11897104522283385,
        0.04385672036201026,
        -0.03737629578834,
        -0.10784151633630702,
        0.02617974523034578,
        0.19255699520366543,
        -0.13586133433214795
      ],
      [
        0.11342074658552428,
        0.08431922881501644,
        0.008335742696266807,
        -0.04980235706390728,
        0.07550949844138392,
        -0.0688994000283617,
        0.10355955693135838,
        0.009698440466287312,
        -0.008427063873257331,
        -0.03586296550207466,
        0.06498358305820952,
        0.01079885349691186,
        0.026186067936364174,
        0.07783916312020277,
        0.23053856716491467,
        0.060055280130429926,
        0.005243790846094763,
        0.15590346930007687,
        0.07823676345080169,
        0.21989034292857385,
        -0.05396846299734274,
        -0.04235638559185937,
        -0.07456431394852978,
        -0.06500630571182574,
        -0.08040205181604836,
        0.00443367489202099,
        -0.06857991517932491,
        -0.06013151719473244,
        -0.08620302905531678,
        -0.046778168404356626,
        0.0008333685325623214,
        0.014430603916057959,
        -0.18901849922041677,
        0.12433603231776787,
        0.1478104820115863,
        -0.163805228198949,
        0.07261277408836489,
        -0.014376085848613652,
        -0.13681534754064997,
        0.08230844742730095,
        -0.0930736065021835,
        -0.15307809093779104,
        0.17546552997930367,
        0.10785357383224556,
        0.13124914419752243,
        -0.029300212979129023,
        -0.07221622874365355,
        -0.019696414237292046,
        -0.2665956748813536,
        -0.004669781657616787,
        -0.04456592568059806,
        0.10130763078070698,
        0.08798201922534121,
        -0.05377582277908481,
        -0.18612862495838656,
        -0.025206597630277622,
        -0.19132501489328205,
        -0.28957098334702097,
        0.17728049909320553,
        -0.013694432818431143,
        0.02039493332179669,
        0.018847625034870145,
        -0.1220483663717876,
        -0.09128412129169844,
        -0.1279612392984282,
        0.03408400063225936,
        0.022174240042228677,
        -0.004331684253684577,
        0.0007354246777771559,
        0.022422910477365065,
        0.05404582190409741,
        0.10039193325183314,
        -0.07935734872741697,
        -0.10049303754951641,
        0.0505284945402615,
        -0.038410279069699065,
        -0.131808984257846,
        -0.03218851413209594,
        -0.18334544810276243,
        -0.25284067380813363,
        0.04598572822220125,
        0.04245675236920898,
        0.2833019355484409,
        0.37222534525214734,
        0.054605665357793015,
        -0.06817236919256617,
        -0.0032055590287442585,
        0.09574712278693388,
        -0.08364519982108898,
        0.045055397269404544,
        -0.0068454307439883575,
        0.041239367719851414,
        0.1100556357097118,
        0.04081761240245063,
        0.11790412804369953,
        -0.06110467479051067,
        -0.006497071141574616,
        0.0177160462394889,
        -0.091054684311308,
        0.15135747071861416,
        -0.01263435938125427,
        -0.03598828460666888,
        -0.049020838669036226,
        -0.07134393699882173,
        -0.09442056631777962,
        0.13508158203098394,
        -0.051239989023446474,
        -0.0440778347626554,
        -0.1743844747508718,
        -0.005434803612970686,
        -0.05281501871002561,
        0.05126019211611804,
        -0.19669074187066907,
        -0.011079206624615407,
        0.00691458450896663,
        0.0253683673586851,
        0.004786214942528588,
        0.13378914086496976,
        0.014481589216410759,
        2.5183943728962073e-06,
        -0.022832373237704224,
        0.7690661488353768,
        -0.17656853673187325,
        -0.07608335823569076,
        -0.2391017884309901,
        0.06629616980142984,
        0.0,
        -0.03696517875246193,
        -0.04964239548812931,
        -0.0190663391663118,
        -0.034655181385925465,
        -0.04966284967705209,
        -0.056099604253870776,
        -0.040472897816688495,
        0.0045767553988145
      ],
      [
        -0.08604056223838667,
        -0.06798168268477797,
        -0.11104660971136486,
        -0.15029093503082563,
        0.059703397967374276,
        -0.06952825088201808,
        -0.14562868325256018,
        -0.13370120398197147,
        -0.2506071253239538,
        -0.05635547950287397,
        -0.009459395319434526,
        -0.21302310455538342,
        -0.3018513202376297,
        -0.23976150069451502,
        0.12191047631781327,
        -0.06621240026379228,
        -0.19951789274870652,
        -0.24853343819828555,
        -0.136027836259499,
        0.1744916723602579,
        -0.05715083549465328,
        -0.04303461069429696,
        -0.08460627670105787,
        -0.04628159216033933,
        -0.04151655686340763,
        -0.06641302271477244,
        -0.0860879271520374,
        -0.04775651442079893,
        -0.07162031065267696,
        -0.06371855480319784,
        -0.028498317799873808,
        -0.27912983441973527,
        -0.08571836324855403,
        0.015900193521761953,
        -0.12467300327736584,
        0.13589603889126448,
        -0.10417170083374211,
        -0.07622344212992062,
        -0.023024910432826756,
        -0.1205961174775819,
        -0.011592667417949237,
        -0.04222681115254601,
        0.31173746678088676,
        0.26000945975459366,
        0.14071647801886947,
        -0.1931486462246967,
        -0.12257917771894353,
        -0.005485098036569067,
        0.16490900550829962,
        0.30396726201730684,
        0.15238576714452046,
        -0.10909474843267668,
        0.13470804529176214,
        0.018669438917670787,
        0.04117828681667583,
        0.14065641344628416,
        -0.14379719303771937,
        0.17729059746632667,
        0.007772613662426541,
        0.2048044744184218,
        -0.06229556856290104,
        -0.08233065200458634,
        -0.04930205703688338,
        -0.024426827694490075,
        0.07490168196861975,
        -0.08777643442113142,
        -0.1717940737047633,
        -0.04403351947008695,
        -0.1296399251185832,
        -0.1564037745864859,
        -0.06501371544756772,
        -0.1361372464990008,
        -0.08451182552727093,
        0.1553553705425919,
        -0.0544968159599731,
        0.04639394579778288,
        0.039193065071997574,
        0.04274707246123349,
        -0.19570908888399385,
        0.41096203243267226,
        -0.07498550857353309,
        0.154344687987445,
        0.16937285225228854,
        0.35330191303848735,
        0.20010085348783135,
        -0.15180765757666764,
        0.02297726119057617,
        0.06404861099223487,
        -0.10524766589665455,
        0.36552861227584765,
        0.10221693213609737,
        -0.2772121451962999,
        -0.18129040078174333,
        -0.03063427404538181,
        0.12063279507075435,
        -0.11406520245996996,
        0.0627476048393604,
        0.02231468531275286,
        0.25120818983608717,
        0.21432853150572298,
        -0.0798197768018074,
        -0.05734229461070164,
        -0.09211753029975261,
        -0.09181117679995356,
        -0.12390374818508719,
        -0.07319682660193545,
        -0.10910684746283213,
        -0.06675400844726553,
        -0.14351012814808461,
        -0.07812549862850106,
        -0.023639424317510732,
        -0.12165065872621904,
        -0.047733323908219674,
        0.2355761347114308,
        0.12766497676184438,
        0.2884842993811752,
        -0.07006971739843257,
        0.13764516215377756,
        -0.1704773149692522,
        0.09739168295087722,
        -0.0682110718181069,
        0.01481768082439558,
        -0.16498583133599543,
        -0.029255177003407754,
        0.012925355621509333,
        0.08346388906612358,
        0.0,
        -0.02079905536156008,
        -0.019691502347609222,
        -0.022783427546194113,
        -0.04668605884621557,
        -0.023210816455411915,
        0.4547526789898822,
        -0.044073439989764034,
        0.176073350631853
      ],
      [
        -0.1841756633083601,
        -0.2012300475806437,
        0.015381701819490334,
        -0.008193491792488591,
        0.04232843007493271,
        0.14390310533520487,
        0.09010207065341035,
        0.09413875616223669,
        -0.05890474982583883,
        0.003036281754359198,
        0.017800039460644845,
        0.16813729807351355,
        -0.0005674923430848256,
        -0.050291487887655896,
        0.05640741636640495,
        0.08707410595476024,
        0.12468996221662573,
        -0.16239842683401126,
        -0.18261587679595917,
        0.00885274932175103,
        0.09993072085450694,
        0.08458408055255419,
        0.06696007850423787,
        0.07438755770317271,
        0.11731542357670803,
        0.11318363860390493,
        0.09670275677583914,
        -0.0510265190227923,
        0.1013921986448551,
        0.024028039557097387,
        0.31984742511256614,
        0.20622027879116056,
        0.12618131236167227,
        0.21391468244159043,
        -0.02292942097559253,
        -0.020981924624438108,
        -0.14917885446013684,
        -0.22548071011451085,
        0.22466158798838484,
        0.055645484615382594,
        -0.1359685192847757,
        -0.1569742854767163,
        -0.08067414919600065,
        -0.06692377672509327,
        -0.05461364946260837,
        -0.04944122584707712,
        -0.06268553500797926,
        -0.05709550535665546,
        0.08286265524354089,
        -0.06631809527280295,
        -0.08101159279083876,
        -0.02035616510449438,
        -0.1043081192912628,
        0.030879422019400252,
        0.18779189527542192,
        0.0796747228419194,
        0.23636394558459015,
        -0.03369744382665837,
        -0.03579673129853901,
        0.06649419272650056,
        -0.06673517386243803,
        0.04606435633016047,
        -0.10653174238865307,
        -0.049464541022510175,
        -0.018154160565589352,
        -0.07018518555703616,
        -0.06472316998456693,
        -0.09037568601823442,
        -0.01634151269215478,
        -0.1001209181465351,
        0.15568455447597707,
        0.01584938974456635,
        -0.016363587500049556,
        -0.13903603591880265,
        -0.10836792340840823,
        -0.061482527185846056,
        -0.11186341213861732,
        -0.07331728495026105,
        0.014394417871669996,
        -0.14808809929558636,
        -0.19725976487906502,
        -0.19755762691224932,
        -0.016002769342220287,
        -0.048857808858774415,
        -0.04295396360913319,
        0.08501918881195225,
        0.007507268498381951,
        0.011893013222146222,
        -0.0018489010527442482,
        -0.026793493069660723,
        -0.019448835713220723,
        0.1282415754250095,
        -0.0556535961862983,
        -0.0012169631600985867,
        0.10368395506824694,
        0.16353054358080837,
        0.12251123412680072,
        -0.13570021834807316,
        -0.1252784528057157,
        0.022202930075342235,
        0.05943640917313378,
        0.07522330789056025,
        -0.013507551599448081,
        0.04083016950898661,
        0.05309718043055027,
        -0.02021896922727418,
        0.012562294822947842,
        -0.06988787888169852,
        0.05275999570074439,
        -0.06410360200101568,
        0.2839310572712266,
        0.15868853021218077,
        0.07810488155814198,
        0.052514871947032145,
        0.09429526757782505,
        -0.01790006680463346,
        -0.14667381790508052,
        0.11496962770889019,
        0.1086658093008719,
        1.988097844779266e-05,
        -0.026344848534109372,
        -0.04266889787037306,
        -0.024353613056404582,
        -0.032595230595811375,
        -0.013600591710041276,
        -0.05869127520098139,
        0.0,
        -0.04236754182424742,
        -0.15709159060707678,
        -0.16919552393732426,
        0.5279634149396885,
        -0.14225116173713714,
        -0.03276440661425732,
        -0.04055439673473781,
        -0.015515295330046046
      ],
      [
        0.04207599382123863,
        0.16485788868542994,
        -0.09874609735577113,
        -0.18332394167900667,
        0.24504510679812375,
        -0.03828972102730628,
        0.060764753596011065,
        0.1100977227561907,
        0.034070527595584287,
        -0.1797664994603645,
        0.05239356064353527,
        -0.030274773788721638,
        0.27737127776055137,
        0.08498256673041525,
        -0.183494904326406,
        -0.1753098564063923,
        0.15096647614838402,
        -0.09082551069773796,
        0.09039794172920457,
        -0.19493636031927775,
        -0.060018545007219565,
        -0.0420254926005178,
        -0.08205072253952189,
        -0.0670118452547704,
        -0.05957242345249602,
        -0.12222306122098703,
        -0.08584397210392969,
        -0.04501855874510111,
        -0.03506526293550342,
        -0.09595076815549995,
        -0.03570064704484867,
        0.03364432314994897,
        0.019403860027094533,
        -0.07014652600410666,
        -0.22600372876999,
        -0.10871919254289368,
        0.036316246510651747,
        -0.22479321400704486,
        -0.10551476610298752,
        0.12590941779204187,
        -0.17625085965408077,
        0.22091165877785032,
        0.0581295741945907,
        -0.09518654686566254,
        -0.044963775934344564,
        0.156639078120912,
        0.04196035416482851,
        -0.02914981478308274,
        0.0652541884826955,
        -0.0706839167049296,
        -0.057994592184990174,
        -0.07154362076839882,
        0.029753073988861945,
        0.1318045258503197,
        0.036100947266272394,
        -0.1144382006173637,
        0.12468391086012666,
        0.6197023209605121,
        0.014340840546845354,
        -0.07931727859165334,
        0.004682696343285601,
        -0.06669386469505902,
        -0.033921449516981304,
        -0.042100948532719916,
        0.08074360731029179,
        -0.18698043083620136,
        0.01061378476330612,
        -0.03322096928925793,
        0.0661533764052734,
        -0.14156387525521083,
        -0.04656854686641069,
        -0.23529554058977994,
        -0.009597025415439669,
        -0.05024749898984238,
        -0.4622565170487279,
        -0.16342089069136534,
        -0.11987135013442231,
        -0.20103197956066093,
        0.20149943352017502,
        -0.20365599254831027,
        -0.0239560505432257,
        0.2710431753655711,
        -0.15484980462959605,
        -0.5037020005981748,
        0.22662714438599127,
        -0.07942783231118454,
        -0.13590135928066616,
        -0.09543669147201829,
        0.1572371973071229,
        -0.25896507399327223,
        0.014312041924035806,
        -0.05396802378395008,
        0.21291261358755065,
        0.024348349399857496,
        0.005227316738126003,
        -0.10640921397335333,
        0.013358351614773585,
        0.14554185841328873,
        -0.04121795790543318,
        0.12080000692223325,
        -0.09480076035102311,
        -0.060783045542011915,
        -0.16734953887748893,
        -0.0950886775862068,
        -0.12396587649985945,
        -0.23537636411575255,
        -0.16407806090152977,
        -0.06930524835567574,
        0.09495493140308557,
        -0.12870457243410816,
        -0.036396547828149904,
        -0.012972622742982368,
        0.003438604891166415,
        -0.05866347657773538,
        -0.13774976369330802,
        -0.16890227942191263,
        0.023126142511251002,
        0.035734775459196656,
        -0.15240120390837247,
        0.01634705875799959,
        -0.0024689697403413357,
        0.15000010833704497,
        0.0760832837278997,
        -0.3122520363267646,
        0.37651117428562964,
        -0.13496999510606564,
        0.0,
        -0.04347725047852245,
        -0.031292549469086245,
        0.014636178377444065,
        -0.012205168249501994,
        -0.06452938692108338,
        0.22760211574270045,
        -0.07904930823894872,
        0.014355342582363996
      ],
      [
        0.055528402935102826,
        0.1466583337122079,
        -0.07542675909224869,
        0.12127523917812538,
        -0.06920571421017516,
        -0.11690911386019338,
        0.043226453322765264,
        -0.013608782999387907,
        0.0720394460383571,
        -0.18851220990725487,
        0.06171174590692974,
        0.2081968220400427,
        -0.17470189486857954,
        -0.12497228918083239,
        0.36419264598300605,
        0.27053374267508556,
        0.18900714174933,
        0.06161647059659129,
        0.19994789650597616,
        0.33437771489920864,
        -0.10098742509146054,
        -0.06768511037072536,
        -0.11186826965999115,
        -0.09372337889365999,
        -0.11997678297557421,
        -0.08297287041973304,
        -0.1814461292369755,
        -0.0933549636648305,
        -0.14967141903281792,
        -0.10338613414413111,
        -0.05368891024940954,
        0.22998628361467258,
        -0.06411909447362424,
        -0.18391220443978015,
        0.17933674000748356,
        -0.33824566191130645,
        0.010822053553400839,
        -0.16729383898106331,
        -0.15928414927261073,
        0.09707202402770519,
        -0.22833404975708574,
        -0.03095182064333713,
        -0.10434372828477867,
        -0.04443580019530838,
        -0.06506118853357831,
        -0.09201572216237083,
        -0.014691667540116658,
        -0.1325579743750603,
        -0.08624451998691898,
        -0.20132287133777818,
        0.02459268967126493,
        0.005138931698012761,
        0.34832233963708364,
        -0.051118374447013844,
        -0.07053240111943586,
        -0.18587490904801066,
        0.22262220083616996,
        -0.11958066694063446,
        0.22369160857018042,
        -0.014602745252493698,
        -0.026687985258353406,
        -0.10664904964835689,
        0.26212733144493156,
        -0.09420463258826689,
        -0.10015396283346978,
        0.19295089113394917,
        -0.0945007628878348,
        -0.09072211974619804,
        -0.169575155248639,
        -0.07645782343102947,
        -0.06664053404152852,
        0.018991531828962193,
        -0.15009760322359986,
        0.0738736239626872,
        -0.02275167144029412,
        -0.01276894282500378,
        -0.15787384700499474,
        -0.1723068630058388,
        0.08081816006199195,
        0.010259698102987573,
        -0.03824351786731568,
        -0.007523804214057027,
        -0.13959877800285245,
        0.05128681523164017,
        0.016929295438523947,
        -0.14786616247661702,
        0.052940385089053715,
        -0.09154799848640426,
        0.15546773191749083,
        -0.29015198621718236,
        0.03917543713437686,
        0.154001007583384,
        0.10650844269552084,
        -0.0877308323370285,
        0.13693270432831087,
        0.07306084640458424,
        0.0185260121636013,
        0.033295955076089144,
        -0.027737381128233648,
        0.09976950293341572,
        -0.12441408268292965,
        -0.08383670285733026,
        -0.12538144819403493,
        -0.10644814258931362,
        -0.14546456493621043,
        -0.04973420322148056,
        -0.188318208455009,
        -0.09950805338628456,
        -0.11277580393845132,
        -0.09930922532462673,
        -0.055193219034203635,
        0.06940655645942313,
        -0.12950150167776942,
        -0.19954059855454193,
        0.14344591922398384,
        -0.32579564068428685,
        0.013536372620355253,
        -0.071642691677964,
        -0.15427059855375141,
        0.055165744613990896,
        -0.016663052007982463,
        -0.022081687686501147,
        -0.13528902124907452,
        0.011668817351849154,
        -0.5174121605344807,
        0.8105082652403561,
        0.0,
        -0.04044528638066257,
        -0.03736059463260726,
        -0.01321757291675712,
        -0.04420310180479459,
        -0.0800787532987099,
        0.13192531481903416,
        -0.07055890016334336,
        -0.13744102618628412
      ],
      [
        0.05626309565107648,
        0.15730155003494362,
        -0.16412997640822583,
        -0.15783502932041665,
        0.17553609470991624,
        0.3019247189354547,
        -0.03058839756418982,
        -0.05038640302375383,
        0.03001620091093476,
        -0.10305098381378415,
        0.08130480800351389,
        -0.017850173279009587,
        -0.1975024017849666,
        -0.10518216947995965,
        0.010936571971463796,
        -0.049107895758490006,
        0.10163599053442716,
        -0.0946542447823746,
        0.03436146528250901,
        -0.03256174322368966,
        0.07033319860903056,
        0.02117032009818725,
        0.08270057762651624,
        -0.08659438216399895,
        0.05268397724926457,
        0.4527414892567494,
        0.4722520790084166,
        0.35488472380527347,
        0.20188566395675253,
        -0.0001308263214223428,
        0.23753994085939578,
        0.039830632979973024,
        -0.10244252174900018,
        -0.0345872219120349,
        -0.031246355941672643,
        -0.060202642303866655,
        0.0389007070974431,
        -0.14169986031260098,
        -0.025978615976831654,
        0.05672456783524463,
        0.13421717060291166,
        -0.03723360548962349,
        0.056255562546949266,
        0.2144055466708248,
        0.21611064897107646,
        -0.07850450397058498,
        -0.0495260813944248,
        -0.12167095049398474,
        0.02632473013694827,
        0.14439171133491377,
        0.1486771325215403,
        -0.11216450641247401,
        -0.0045172279154968315,
        0.11072830816030975,
        0.21643867153151045,
        0.02618141659121334,
        -0.12043708711338973,
        -0.03280490282548513,
        -0.06684160514230611,
        0.06743143988352954,
        -0.1575289999080489,
        -0.21599151751341586,
        0.003842432789692951,
        -0.08513222367233955,
        -0.21523446138827285,
        0.08794388686150857,
        -0.1646234048716096,
        0.046394118545766826,
        -0.12743465612084212,
        -0.030406882756642387,
        0.31462967438705114,
        -0.04530234212638712,
        -0.18606447545395044,
        -0.058700574712672246,
        -0.2191406655797926,
        -0.046316030623021844,
        -0.05077895218981141,
        -0.17327867211592948,
        -0.13962495222077165,
        0.22944240544368222,
        -0.003188041906139346,
        0.006371496215448327,
        -0.15610970883869865,
        0.029554753359077788,
        0.22715577400965167,
        0.15215095065439613,
        -0.0387169919041412,
        0.0003424696820843529,
        0.05030873140616464,
        -0.02419408957574785,
        0.02978095544962542,
        -0.16512210505999816,
        -0.18590020978936095,
        -0.008032865361849202,
        0.11673767005259952,
        -0.07270284191104434,
        0.1467297202787621,
        -0.05715243628661321,
        -0.2669681059869258,
        0.05569473978855383,
        -0.09083663307955311,
        -0.2394859258646078,
        0.033868444641435756,
        -0.20471221360191094,
        -0.019952771318332903,
        0.16354636035915096,
        0.2146323188881117,
        0.20125468821873435,
        0.06806021312831718,
        0.08671254675883573,
        0.13484110266164465,
        0.0007693356032933723,
        -0.28262646873640795,
        -0.21566098114193716,
        0.008495418039280063,
        0.09014570483346475,
        -0.07295896022069778,
        -0.2695624258907966,
        -0.030332813670646188,
        0.029202127497587434,
        0.03425563710575866,
        -0.04257520052604264,
        -0.06802254071224619,
        -0.08411031142551346,
        -0.17403162306045758,
        -0.09729809269498979,
        0.0,
        0.06564787228924894,
        0.2426446850122,
        -0.1677124538940961,
        -0.18016662327208982,
        0.5241155012163861,
        -0.12309279595957598,
        -0.024454984493739788,
        -0.27699448585143965
      ],
      [
        0.0016406402789287883,
        0.04031953956178714,
        -0.04241523584481246,
        -0.1030783514897485,
        0.15084108672908828,
        -0.05329651340562124,
        -0.026371879486080246,
        -0.04706065810938188,
        0.003958019365413841,
        -0.011327774688979948,
        0.0798000841705008,
        -0.056522554828577744,
        -0.11260149222439343,
        -0.09160838002071851,
        -0.15725589493697148,
        -0.12089686553765536,
        -0.06037405487498898,
        -0.056039628297167236,
        0.007373957378092557,
        -0.15119009450206258,
        -0.05016713828618242,
        -0.047132179914165774,
        -0.022248221501077872,
        -0.035790334168881756,
        -0.02799699014229017,
        -0.0767555354110477,
        -0.031013074227646948,
        -0.04054892547976168,
        -0.0514336447092531,
        -0.0590993200844437,
        -0.04325953247213804,
        0.060083463956120145,
        -0.046015653322726405,
        0.004936921157687334,
        0.04856383827025269,
        -0.017141498363812388,
        -0.019608809689080072,
        -0.05543926980630944,
        -0.034178199805892574,
        0.07966457241325861,
        0.01284697155230869,
        -0.0539005706058331,
        -0.024460855658099613,
        -0.07277703984781278,
        -0.0562619962518588,
        0.11451466019979945,
        0.055565063060950284,
        0.002636646629115564,
        0.04856861634639792,
        0.06923314571734378,
        0.020316815321420302,
        -0.0708049516311473,
        -0.059356627317114614,
        -0.05724557675292578,
        -0.07796980397132122,
        -0.07946499600683754,
        -0.01510199026952271,
        -0.07338699279941653,
        -0.06553345822141605,
        -0.0494614817288341,
        0.018990339157794224,
        -0.04803057131253279,
        0.12618822094316584,
        0.018981598875939153,
        0.14245432388514148,
        -0.0834784171354015,
        0.15117432103715456,
        0.011971995380636227,
        0.13714936324066315,
        -0.005270183541772764,
        -0.07621980328773424,
        0.06351723035111353,
        -0.04725022381303342,
        -0.033255866318961276,
        0.023131294666300744,
        0.07495375831322484,
        -0.024211676222056125,
        0.06737557994870345,
        0.031128152684437065,
        0.03042397750478234,
        0.023044701522085,
        -0.020213278645902236,
        -0.01518834652225904,
        -0.17862907100192563,
        0.12265918306937293,
        -0.014509592101031874,
        0.09735124282449062,
        0.05345221558889859,
        0.048893696378837635,
        0.06921341627619895,
        0.0816197135858198,
        -0.030554504627049502,
        -0.10326020628671845,
        -0.07280301988987953,
        -0.18695076282908588,
        -0.14446192152433565,
        -0.07342584111892929,
        -0.08733937056331455,
        -0.037902425841233496,
        -0.1401849219379071,
        -0.03580094938267288,
        -0.06996636790552532,
        0.1090726368382837,
        0.006438350005009318,
        0.10297341328443818,
        -0.10357322165334638,
        0.1028803982858424,
        -0.014338962305163983,
        0.048279779242895074,
        -0.03253321530248837,
        -0.04484912220149011,
        0.02771248959840899,
        0.008361256686640681,
        -0.019015555012296046,
        0.08469637909989673,
        -0.014422012527128934,
        -0.02163589812227007,
        0.07587568152567864,
        -0.06978263343014929,
        0.075787909237161,
        -0.019763781933077585,
        -0.010586895682849895,
        0.06226036340177581,
        0.24359431492425387,
        -0.059180040668933995,
        -0.030963697780840668,
        0.0,
        -0.055503641237562254,
        -0.048877366985618856,
        -0.0133809623446841,
        -0.07042321647685292,
        -0.02273316190259624,
        -0.04470827837989568,
        -0.01350922885448734,
        0.13064192869217484
      ]
    ],
    "b": [
      -6.023447592961032,
      -6.0384157942455,
      -4.934160756423269,
      -4.335982921480388,
      -5.622404005921575,
      -5.175861399740594,
      -4.6212013015188615,
      -7.085763430148741,
      -5.378501618794164,
      -7.33559243213684,
      -5.767559948239974,
      -6.386039048994242,
      -6.661183199296002,
      -5.640207073829795,
      -5.127551209359054,
      -5.453599845093982,
      -7.004703251804744
    ],
    "multilabel": true,
    "temperature": 1.0,
    "C": 0.3,
    "classWeight": null
  },
  "featureKeys": [
    "npsPerKey",
    "rowRate",
    "chordFraction",
    "multiFraction",
    "singleFraction",
    "lnHeadFraction",
    "overlap",
    "repeatFraction",
    "cutReturn",
    "chordChange",
    "columnEntropy",
    "handImbalance",
    "sameHand",
    "crossCut",
    "logIoiSd",
    "ioiChange",
    "graceFraction",
    "gridResidual",
    "rowBpm",
    "ioiCv",
    "occupancy",
    "minOccupancy",
    "occupancySd",
    "heldAtHead",
    "lockFraction",
    "releaseIndependence",
    "releaseScatter",
    "tailRate",
    "shortHoldFraction",
    "inverseGap",
    "lnHeadOverlap",
    "anchorShare",
    "repeatRun",
    "maskEntropy",
    "trillFraction",
    "rollFraction",
    "effort",
    "sustain",
    "burstiness",
    "activeFraction"
  ],
  "trainingScope": "training split only; validation selects parameters; test untouched until selection",
  "evidenceLevel": "whole-map labels plus six manually segmented training charts"
}
;
},
function(module,exports,load){
module.exports={"model":{"classes":["jack","chordstream","speed","tech","ln"],"keys":["npsPerKey","rowRate","chordFraction","multiFraction","singleFraction","lnHeadFraction","overlap","repeatFraction","cutReturn","chordChange","columnEntropy","handImbalance","sameHand","crossCut","logIoiSd","ioiChange","graceFraction","gridResidual","rowBpm","ioiCv","occupancy","minOccupancy","occupancySd","heldAtHead","lockFraction","releaseIndependence","releaseScatter","tailRate","shortHoldFraction","inverseGap","lnHeadOverlap","maskEntropy","trillFraction","rollFraction","effort","sustain","burstiness","activeFraction","peakExcess","repeatConcentration","runAsymmetry","runCoverage","regularity","regularAnchor","release:tailRatePerKey","release:headIsolation","release:sameFingerRecovery","release:tailAsynchrony","release:tailTimingVariability","release:heldOtherAtTail","release:sameHandOrder","release:releaseChordFraction","release:independentHeldRelease"],"mean":[5.279919412126102,13.244435229650557,0.42874161807871747,0.4807021796435301,0.5163551854153847,0.08945382953885336,0.24870351397064824,0.30692689325120126,0.3164516044733976,0.6034787926605629,0.9776394119276226,0.06174495662060625,0.3715731292302074,0.20521095241315632,0.20967672348431854,0.1376341848072169,0.018459576715618622,0.07427099118108489,219.3060979764644,0.23696579922239105,0.05334877370168715,0.03257397343020707,0.02029446250292978,0.020058467450332296,0.060735862662294526,0.07992934144216184,0.04654367546496631,0.2884756887475926,0.12645360902098599,0.046149233839953605,0.00823540262094189,0.711364937195293,0.028986404434343242,0.07384338343353529,6.88397497454446,0.5747720623851992,0.10229555415218201,0.9906013118792755,0.057904449932632496,0.20223002713994806,0.05951550879363238,0.1609332388724863,0.7476448274488829,0.039319693665753455,0.2884756887475926,0.04115481408110655,0.14152795255655595,0.10336315091076181,0.03300751937605254,0.051610610387062224,0,0.07433874792545599,0.01618700913656663],"scale":[2.1935486695134463,6.6508228078045875,0.157735762309571,0.3236165509698905,0.32377860621447824,0.24224920713105502,0.30594715572498277,0.36588498099636685,0.20343133863699642,0.1421839966724101,0.0960538362584874,0.10580700562225097,0.12275551372520518,0.11232193073152011,0.22048825954079068,0.2046992799083205,0.0580738406195362,0.09725057002273887,109.89458782395833,0.26933534374282564,0.14205849323051425,0.11569189154027297,0.05706167714600268,0.0702998143385303,0.19373035928328708,0.24210804484109502,0.13125031087455372,0.9415796913029272,0.3080771753699684,0.11798196022326048,0.0520494521066025,0.1351137486840709,0.0772636888174803,0.10974327558757511,3.562801071294435,0.18239102869872695,0.15986184834402556,0.07798926972681207,0.08737016270744698,0.29376281235424306,0.12491206193027349,0.18366516198570632,0.15247153607655767,0.055730457434987404,0.9415796913029272,0.13153094579787694,0.28620660844881013,0.25508602885715637,0.11083701337683818,0.16414313139758036,0.000001,0.16418621774059727,0.07199005796992769],"theta":[-0.016435166913162626,-1.3842836689378597,0.7244294857190035,0.08329273025071932,-0.08309388144608267,0.21711421725354593,1.0651850278765715,-0.25560034994276914,0.4953622291808683,-0.27909034336080696,-0.16925989678498085,-0.1526858577172876,-0.03333149993072315,-0.13557233634158694,-1.0349343976819005,0.2540633496873821,-0.27915011629926306,-0.08341328130993954,-0.8757299704267615,0.023167480401531722,-0.03221793590273827,-0.0439568167571802,-0.07727655319330713,-0.24852376151171976,-0.3755914631779143,0.2355193521637449,0.09715358387797791,-0.0581220710015971,-0.308595344771333,-0.6397064276743021,-0.08272970456436958,0.10279510161542962,0.3535038738631565,0.22737897252684336,1.325824158203633,0.046041365662269886,0.24820517596465724,-0.002439259696400067,0.24908796248417797,0.20653542216490217,-0.08634662030131078,-0.17458445087326227,-0.27817556125335413,0.14634362893453862,-0.0581220710015971,-0.058495378248641254,0.03316317764664285,0.01868750133632864,-0.009073782344781142,-0.014340926608562624,0,0.2262835850988253,-0.11281249568162183,1.6720109422205944,0.29663578422095044,0.10096465768417723,-0.07819597916122302,0.07815483959432161,-0.25226332473861734,-1.6831789677264049,-1.8747468713562552,0.6408664156493771,1.181878657087938,-0.2797977790560151,0.055844011918846026,0.24205615932636096,-0.4198514837905545,-0.9274320058690463,-0.8181210224569119,-0.03618261718111116,-1.1128187839247414,0.2912629993518205,0.7812998590801511,0.02126508838363655,0.02847900559363647,0.021933423421365412,-0.14962800691762884,-0.17609620823985725,0.11680721271530357,-0.008838900027990496,0.0007421474586800525,-0.11103396314472513,-0.09656802389672191,0.05163334136746481,0.7508064783514041,0.5160772787940295,-0.030938479182748554,-0.05007047507438384,0.014905050323055625,0.5648993943452253,-0.3418674817466625,0.3403525787810142,-0.4978021106422302,0.8888435212670088,0.4623006423412172,0.13373002773785198,0.2562619716456647,0.0007421474586800525,0.04125047626520385,0.4510296867560113,0.01446591723916917,-0.2330480345399729,-0.18140898429709096,0,-0.10230532839289666,0.019744185183523267,-1.3777932443302432,0.5759018827985656,0.8866546202498233,0.3791053894635187,-0.3790410449361656,-0.6247079534039149,0.30662847802114035,1.2591926825622979,-2.1788733086618546,0.0407432424675463,0.1660135392466575,0.12834441586511897,-0.8779537843332577,0.9170917043801436,0.020066449786844208,-1.1480045677249648,0.4501480487365904,0.8209150899122396,1.2969962991525161,0.3724268785525085,0.011643931460333714,-0.22531186803655637,0.1079544627253335,0.3349034322400325,0.6442470358511976,0.22948667646946397,0.1225641355980448,-0.3487150465656924,-0.07907670679384297,0.07994621483420403,-0.07182484956482757,-1.4525294268537345,-1.5309737706328772,0.39635553984823446,-1.3958175579218637,0.10630141001755278,-0.009349581424586879,0.5745933717118922,-0.21893537260906523,-0.2454667039714344,-0.1478049151015902,0.3403772073780239,1.2036037510543547,-0.4806691815964465,-0.3487150465656924,-0.05926838246689306,0.10526176520455116,-0.07717932495853884,0.06928071335803235,-0.14579928393662903,0,-0.10141376614259963,0.005588238464293497,0.3592420126423235,0.9698541778299943,-1.7446282490800071,-0.4929393792938335,0.49247671798408127,-0.3699861299838123,0.3707297036201165,0.6896225258783939,0.7253276006575662,-1.0739542746271948,0.7208441754803321,0.01375696961633981,0.4999562126522759,-0.3465906422898033,2.1586116240368405,1.4039003753015655,0.005091360157595908,0.5924725961944577,-0.39840740681020836,-0.9343592520374233,-0.31992273631756607,-0.180690814996093,0.1651137204751642,-0.4597883765045141,-0.4738424411999477,-0.0259600286085632,-0.11125469549117172,-0.23510646741024638,0.3187953364732402,0.23943207666198793,0.2464435781965406,0.6157359282281714,0.5826161858030482,-0.791629811728528,0.7776249250415663,-0.07832879098396107,-0.8417174998225715,-0.1401681270292854,-0.3402443667269217,0.41049065158874914,-0.7077837003059586,-0.9515653018907796,-0.9653454905163628,0.29876592263572244,-0.23510646741024638,-0.042838059381215064,-0.41807062449829513,0.4291142282475153,-0.013458978020490064,-0.12524795057053198,0,0.42438644939094283,0.16357107342423144,-0.6370245436195326,-0.45810817591180153,0.03257948542700487,0.10873723874065838,-0.10849663119619839,1.0298431908728636,-0.05936424179144531,0.18153201285825363,0.31731706317403113,0.13042271843253386,-0.437800038885986,-0.04525953968302805,0.16927291228536212,-0.015077241958173858,-0.2163116702726916,0.30816186519289335,-0.13990667541380988,-0.21715562087187817,-0.31412192126745325,-0.24253496599677526,0.31923165237637324,0.42148049419617256,-0.2177250534285621,0.5230367126938454,0.38128307676658657,-0.555853212739959,-0.09962412395678735,0.6412014375189236,0.17991067823659457,0.4168961600748415,-0.14352236543482433,-0.016808081341280916,0.07877643217263483,0.19883377853625495,-0.6575610502489732,-0.08891903501892,0.037962510937295725,-0.09011850323954447,-0.030260801929206278,0.12624274086001214,0.05309171444183849,0.3234719030448148,-0.0938127270224725,-0.22070234161950378,0.6412014375189236,0.11935134383155006,-0.17138400510887766,-0.38508832186445613,0.18630008154723318,0.4667971454128561,0,-0.44695093995422813,-0.07609100139041793,0.6675472046948728,-0.4938103570696349,-0.10967916018131851,0.4553399374939525,-0.5193976249377921,1,1],"pool":{"effortPower":1,"confidencePower":1},"spec":{"representation":"physical","weak4Only":true,"noStrong":true},"config":{"windowMs":2000,"burdenGate":0,"localL2":0.0003,"strongWeight":0,"source4Weight":1},"clip":6},"postprocess":{"physicalSupport":"both"},"evidence":{"allTrainingFit":true,"humanSixKeyAccuracy":null,"reportedAccuracySource":"matching nested outer study; this final fit is not an independent test","fineClassesValidated":false,"taxonomy":"five supported coarse morphologies; 4K source stamina means jump/handstream chordstream bucket"},"provenance":{"source":"research/rework/results/coarse-final-r1/4k/profile.json","selection":"all-data choice from repeated inner held-out predictions; not an outer winner","fitStatus":"small_projected_gradient"}}
;
},
function(module,exports,load){
module.exports={"model":{"classes":["jack","chordstream","speed","tech","ln"],"keys":["npsPerKey","rowRate","chordFraction","multiFraction","singleFraction","lnHeadFraction","overlap","repeatFraction","cutReturn","chordChange","columnEntropy","handImbalance","sameHand","crossCut","logIoiSd","ioiChange","graceFraction","gridResidual","rowBpm","ioiCv","occupancy","minOccupancy","occupancySd","heldAtHead","lockFraction","releaseIndependence","releaseScatter","tailRate","shortHoldFraction","inverseGap","lnHeadOverlap","maskEntropy","trillFraction","rollFraction","effort","sustain","burstiness","activeFraction","peakExcess","repeatConcentration","runAsymmetry","runCoverage","regularity","regularAnchor","release:tailRatePerKey","release:headIsolation","release:sameFingerRecovery","release:tailAsynchrony","release:tailTimingVariability","release:heldOtherAtTail","release:sameHandOrder","release:releaseChordFraction","release:independentHeldRelease"],"mean":[3.8102854171185996,11.33435692763564,0.34828855536377584,0.5668077986916134,0.430485113760637,0.3239853674097052,0.17122592341062673,0.22872593378245,0.27786863357834696,0.5499626962182212,0.9693347721441289,0.06208813775274959,0.4311603873581525,0.1705784921589046,0.2609823884634247,0.18352309512190756,0.030240161621824278,0.08668648753339508,192.54365255266953,0.2813704117207267,0.18080405878888858,0.10123410969036599,0.061850005237880264,0.09850735464701804,0.3192485062790656,0.18325946868276102,0.15588244963185552,0.9178092768115409,0.31579442736293395,0.11658944857066052,0.01988728760559236,0.7887459141909564,0.015570024898991522,0.06408114378390901,5.122037501247164,0.5669826326694604,0.10661922032135285,0.992320710451858,0.05976049950630766,0.23828038374531713,0.054037596393355126,0.14636265125048945,0.7460133266622853,0.041372393537714415,0.9178092768115409,0.08121237122286377,0.3265305103459651,0.13381569855607048,0.10873162285206922,0.19010515171718126,0.0005169173310446513,0.15110384504602684,0.04064046187076548],"scale":[2.005947991249914,5.815095405189197,0.13548036575630326,0.2964832601824913,0.2958602476264529,0.38653115911499597,0.23846581000613018,0.30091047021990774,0.1872892576608385,0.1429564555514492,0.09270963606277345,0.09147279033342574,0.1105740814390408,0.09993093542727277,0.23149490455690075,0.23496768356427553,0.0733905922031038,0.1104879102169742,109.39048298521901,0.2632114788068615,0.22400645300166316,0.1679937483014407,0.08569614207939032,0.1454634642613366,0.3959140313316175,0.30022528695516587,0.2085203364045078,1.3120336736313871,0.3810616619798569,0.15570355783541254,0.07615138964646483,0.14349769583244734,0.057064954738114744,0.11423614061166927,2.9691823948693123,0.17423600956538085,0.14807178895040737,0.0716534511379821,0.07158439722188445,0.31709016809649704,0.1084299495915473,0.15511796721956134,0.17036564497369258,0.04768206778773865,1.3120336736313871,0.14413406622000763,0.3349559723998116,0.22770018887010682,0.15851342106099708,0.2517562367040918,0.003339600891529345,0.1765429859865617,0.09010556466617164],"theta":[-0.1454800971112197,-0.44462168766181026,0.2681353558003216,0.4105739627595997,-0.39979662108167197,-0.20063238696125443,0.7786883143938137,0.8286837675926502,0.19024752987513685,-0.02440222916614501,-0.07719198506457405,-0.0027578450833402827,0.09132473156377048,-0.19239126296704698,-0.1467249834032028,-0.25414688553375653,-0.009453952304081383,-0.004796282450037915,-0.1599661595082081,-0.06555426064740894,-0.21144989903606368,-0.07609206531502259,-0.1944914079737374,0.018054928666679723,-0.013292994366145616,0.23416612148135962,0.21127973385808646,-0.15582654504868382,-0.40825044542283034,-0.19041633646264378,-0.17743438155119903,0.21528167793599629,-0.08106761628662969,0.345249985375474,0.1437849651849156,-0.3078211484855292,0.1404620950702318,0.10833556192540615,0.09041891917113073,0.026601071736976675,-0.044934308644021675,0.01319786006932443,-0.08961512428735632,0.002937608294207289,-0.15582654504868382,0.12811946118925593,-0.03741199606303431,0.00956408470618266,0.11551736780692219,0.16648676223883702,0.13264640549273124,-0.13922620337503905,0.013728703135495025,0.3773682733325688,0.011142365961443594,-0.11405374610928921,0.14591485634042248,-0.14575215576320544,-0.15663379109180253,-0.806038859475758,-1.0127775136378685,0.4156979624670546,0.5713352110963614,-0.034141633723495754,-0.2586970991698689,0.2514802032544105,-0.14325784786994308,-0.4494114468067213,-0.5129431813000794,-0.33937941626963547,-0.7557514545525866,0.07922485182535914,0.45449347595855194,-0.08637620915779501,-0.033689792734916034,0.113248229254004,0.11587547098807227,0.13371977375232597,-0.1002860801714474,-0.027032981647146632,-0.13415358565425808,0.07949262552911011,-0.2990308088765735,0.00784395195876104,0.33196722182662525,-0.10186875818290955,-0.29178855098875917,-0.13651701073755038,0.17051864032444375,0.2343581004268138,0.05013072732842159,-0.016447032528010115,-0.2533751237534824,0.14451382383992242,-0.06949231502041879,0.059488665909612166,-0.045077339130500084,-0.13415358565425808,-0.05871278459875778,0.11527396248237518,-0.07206364010513615,-0.41095627607119084,-0.03462332367113953,-0.06805293953920052,-0.07733973932973516,-0.08103840733615081,-0.12625034176366148,0.3626714405855717,-0.2104248189841919,-0.3761534063972092,0.38672923227039446,-0.18798248420551958,-0.30624585943966376,-0.2641191687890604,-1.287758819644682,-0.24626026919660993,0.18389175940481717,0.2367498917153311,-0.3626115806792774,0.32092065359366473,-0.08422970635437355,-0.5250769890495481,-0.1635426014046047,0.6957447285045496,-0.01325919762553399,-0.0653470379823504,-0.09722655459290154,-0.07920797938327898,-0.09854283856898255,-0.15973758933885132,-0.1865582152271464,-0.09069117332488381,-0.04274269267762393,-0.08796491146544577,-0.04676127357452833,-0.06816856584492753,-0.002612621348028928,-0.5522471583884804,-0.31544457741761267,0.358375001314926,-0.20973938056156277,0.1663838791209164,0.001178502125869543,-0.012061626985216928,-0.056053205295918763,-0.19292082469880514,0.005813374313707405,-0.015646641299178247,0.6651961857249507,-0.01802239377017999,-0.08796491146544577,-0.041741321212536146,-0.08573979111208253,-0.17127980740845425,0.007506412299071962,-0.057559177996907185,-0.121091804757656,0.06697332233633109,-0.04426219596536523,0.20935841077985806,0.29963369241125404,-0.0028511643053623576,-0.44584774905496743,0.4700764421968451,-0.19083684637139783,0.2900092626577671,0.30426210859959685,0.3873099688911803,-0.3514071466519548,0.1989081358330814,0.16406983137015643,-0.19107278781769185,-0.05882406067326246,0.9409752269328716,0.7077583977280545,0.1111498388654754,0.20152173818435223,-0.06348981376521484,-0.027879959761823607,-0.1402256351704245,-0.03908582147556566,-0.1647302798022989,-0.27557940265108105,-0.5400833278702967,0.13362948603822528,-0.5733773949446901,-0.12278036648141817,0.2361557609367033,0.2704736469671332,0.04588643338136311,-0.022351293495543285,0.5148633550919419,-0.4595220364041804,0.29891534745614656,-0.07475937353383658,-0.38056045597376137,-0.004054771391095623,0.02908930283510649,0.27403374488500915,-0.0741392898746226,-0.03182635116335018,-0.6706618382347476,0.07379937896705736,-0.12278036648141817,0.08099864235599302,-0.3093587108357274,0.08217579927940714,-0.20212502034360202,-0.20728894017954985,-0.04318730437318643,0.052276433944173833,0.033847209158924196,-0.3149962452375214,-0.22882581129641666,0.05919437359850586,0.2655123363521375,-0.3112568976223638,0.7360855086299726,0.04358714186384939,0.1439508062346935,0.29450335841131,0.050734433918347914,-0.27146627644982607,-0.13936477883227458,0.21087943367879025,0.0735525179165928,-0.26060909036857577,0.5844086581553315,0.4012261311128499,-0.1367187296862714,0.15749031907359165,-0.2957122175669673,0.5352782979571813,0.22807565890878168,0.3445162970910243,0.30138659233518195,0.6062147637112515,-0.17681835402323384,0.43187333541138156,0.5007254086497986,0.13936333253153238,0.2871420642170144,0.12631661755910967,0.027349552121400236,-0.016482403204775065,0.047685600702517095,-0.09644392134195243,0.04567800257400047,0.004561758350847531,-0.1423498908775164,-0.04700798418230698,0.1456611318303018,-0.031253599634999504,0.1037674474136104,0.03559211088754428,-0.01363725436058482,0.5007254086497986,-0.10866399773396246,0.3172365355284719,0.15160356352800142,0.49005751630879085,0.13298467960877033,0.09968564317731474,0.09731618642425055,0.0777246910071021,0.43065012290210475,0.25582436664233904,-2.9122713541687864,0.039838509881614095,2.1859583547427826,1,1],"pool":{"effortPower":1,"confidencePower":1},"spec":{"representation":"physical"},"config":{"windowMs":2000,"burdenGate":0.2,"localL2":0.003,"strongWeight":0.5,"source4Weight":0.75},"clip":6},"postprocess":{"physicalSupport":"both"},"evidence":{"allTrainingFit":true,"humanSixKeyAccuracy":null,"reportedAccuracySource":"matching nested outer study; this final fit is not an independent test","fineClassesValidated":false,"taxonomy":"five supported coarse morphologies; 4K source stamina means jump/handstream chordstream bucket"},"provenance":{"source":"research/rework/results/coarse-final-r1/6k/profile.json","selection":"all-data choice from repeated inner held-out predictions; not an outer winner","fitStatus":"small_projected_gradient"}}
;
},
function(module,exports,load){
module.exports={"model":{"variant":"geometry3","keys":["a","b","ab"],"mean":[0.15012549940519423,0.44080577995019266,0.07817850659787497],"scale":[0.13468251054135888,0.18712317185882127,0.09852224582655227],"delta":[0.1296491969099986,0.07437107227403514,0.0036915451859722355,0.2301577721715137],"clip":6},"policy":{"partition":0,"head":0,"burdenGate":0.3,"smoothing":"coherent","mode":"normalized","effortPower":0,"confidencePower":0,"dominantShare":0.65,"mixShare":0.07,"secondRel":0.9,"twoTagMaxShare":0.55,"familyThresholds":[0.3,0.8],"minEvidence":0.25,"minimumDiversity":0,"lnRatio":0.35,"scorer":"model","excludeVibroFromMix":true},"extraGate":"ln_protected","evidence":{"historicalPriorExposure":"unknown","allTrainingFit":true,"defaultReplacementAccepted":false,"meaning":"all-data fit for explicit opt-in use, not a new independent test score"},"provenance":{"source":"research/rework/results/ln-final-r1/profile.json","selection":"all-data choice from repeated inner held-out predictions; not an outer winner","fitStatus":"small_gradient"}}
;
},
function(module,exports,load){
'use strict';
// Pure JS: reuses an existing curve; never invokes a difficulty scorer.
const {prepare}=load(2);
const {features}=load(3);
const EXPECTED_RATING='5b0ddc61be53f5107f3b4dfa26a8397aa515e316c16b244878d1fc7039d0ba8f';
const COMPACT_RATING='55216a3abcf6653c4c78b2082c730d64a0ed4bc476d3e477c4789a39f309fb4e';
const PARTS=['Rbar','Pbar','Cbar','Jm'];
const RC=new Set(['anchor','chordjack','minijack','dense chordstream','fast chordstream','speed','tech','vibro']);
const SLOTS=['ordinary','rc mix','ln mix','hybrid'];
const sigmoid=x=>1/(1+Math.exp(-Math.max(-700,Math.min(700,x))));
const logit=x=>Math.log(Math.max(x,1e-12))-Math.log(Math.max(1-x,1e-12));
const sum=a=>a.reduce((s,x)=>s+x,0);
function finiteArray(a){return a!=null&&typeof a.length==='number'&&Array.from(a).every(Number.isFinite);}
function validateRating(map,rating,{speedRate=1,components=false,modelIdentity=EXPECTED_RATING}={}){
  if(!rating)throw Error('PerceptionMissingRating: provide an already-computed matching curve');
  if(rating.schemaVersion!==1||rating.clock!=='post-rate-ms'||rating.keyCount!==map.keys||rating.speedRate!==speedRate)
    throw Error('PerceptionRatingClock: schema, native keys and speedRate must match the analyzed map');
  if(rating.modelIdentity!==modelIdentity)throw Error('PerceptionRatingModel: curve does not match the selected SPMRating v1.2.0 profile');
  const q=rating.query,heads=[...new Set(map.notes.map(n=>n.t))];
  if(!finiteArray(q)||!q.length||q.length!==heads.length||Array.from(q).some((t,i)=>t!==heads[i]))
    throw Error('PerceptionRatingClock: curve query must equal this map\'s physical head-row clock');
  const channels=['demand',...(components?PARTS:[])];
  for(const k of channels){const a=k==='demand'?rating.demand:rating.components?.[k];
    if(!finiteArray(a)||a.length!==q.length||Array.from(a).some(x=>x<0))throw Error('PerceptionRatingChannel: finite nonnegative '+k+' on the same query required');}
  return rating;
}
function baseSupport(segments,classes,power=1,hard=false){
  return segments.map(s=>{
    if(s.family==='break')return classes.map(()=>0);
    if(hard)return classes.map(c=>Number(c===s.tag));
    const scores=s.scores??{[s.tag]:1},div=Math.max(1,...Object.values(scores));
    return classes.map(c=>Math.min(.999,Math.max(0,scores[c]??0)/div)**power);
  });
}
function integrate(map,segments,rating,recipe,{speedRate=1,components=false,modelIdentity=EXPECTED_RATING,geometry,context,includeGeometry=true}={}){
  if(map.keys!==7)throw Error('PerceptionUnsupportedKeys: fitted profiles currently require native 7K');
  if(!Array.isArray(segments)||segments.some((s,i)=>!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.end<=s.start||(i&&s.start<segments[i-1].end)))
    throw Error('PerceptionIntervals: finite ordered nonoverlapping raw intervals required');
  if(!Number.isFinite(speedRate)||speedRate<=0)throw Error('PerceptionInvalidRate');
  const {alpha,beta,width,hold}=recipe;
  if(![alpha,beta,width,hold].every(Number.isFinite)||alpha<0||beta<0||width<=0||hold<0)throw Error('PerceptionInvalidRecipe');
  if(alpha>0||components)validateRating(map,rating,{speedRate,components,modelIdentity});
  if(context&&context.map!==map)throw Error('PerceptionContext: reuse the context belonging to this exact map');
  const start=map.firstNote,end=Math.max(start+1,map.lastNote),ctx=context??prepare(map),events=[],points=[start,end];
  function impulse(t){events.push([t-width/2,1000/width/map.keys],[t+width/2,-1000/width/map.keys]);}
  for(const n of map.notes)impulse(n.t);
  for(const hs of ctx.holds)for(const [a,b]of hs){impulse(b);events.push([a,hold/map.keys],[b,-hold/map.keys]);}
  for(const [t]of events)points.push(t);
  for(const s of segments)points.push(s.start,s.end);
  if(rating&&(alpha>0||components))for(const t of rating.query)points.push(t);
  events.sort((a,b)=>a[0]-b[0]);
  const grid=[...new Set(points.map(t=>Math.max(start,Math.min(end,t))))].sort((a,b)=>a-b),atoms=[];
  let event=0,action=0,frame=-1,query=0,meanD=0,meanA=0,totalDuration=0;
  for(let i=0;i<grid.length-1;i++){
    const a=grid[i],b=grid[i+1],dt=b-a;
    while(event<events.length&&events[event][0]<=a)action+=events[event++][1];
    while(frame+1<segments.length&&segments[frame+1].start<=a)frame++;
    let fi=frame>=0&&a<segments[frame].end?frame:-1;
    if(rating&&(alpha>0||components))while(query+1<rating.query.length&&rating.query[query+1]<=a)query++;
    const ld=alpha>0||components?Math.log1p(rating.demand[query]):0,la=Math.log1p(Math.max(0,action));
    const ps=components?PARTS.map(k=>Math.log1p(rating.components[k][query])):[0,0,0,0];
    const x=[ld,la,ps[0]-ps[1],ps[2]-ps[1],ps[3]-ps[1],ld];
    const weight=dt*(alpha?ld**alpha:1)*(beta?la**beta:1);
    atoms.push({start:a,end:b,frame:fi,weight,x});meanD+=dt*ld;meanA+=dt*la;totalDuration+=dt;
  }
  meanD/=Math.max(1,totalDuration);meanA/=Math.max(1,totalDuration);
  const n=segments.length,mass=Array(n).fill(0),x=Array.from({length:n},()=>Array(8).fill(0)),total=sum(atoms.map(a=>a.weight));
  for(const a of atoms){a.x[0]-=meanD;a.x[1]-=meanA;if(a.frame<0)continue;mass[a.frame]+=a.weight;
    for(let j=0;j<6;j++)x[a.frame][j]+=a.weight*a.x[j];}
  geometry??=includeGeometry?segments.map(s=>features(ctx,s.start,Math.max(s.start+1,s.end)).metrics):segments.map(()=>({releaseIndependence:0,crossCut:0}));
  for(let i=0;i<n;i++){
    for(let j=0;j<6;j++)x[i][j]=mass[i]>0?x[i][j]/mass[i]:0;
    x[i][6]=geometry[i].releaseIndependence;x[i][7]=geometry[i].crossCut;mass[i]/=Math.max(total,1e-30);
  }
  return {mass,x,total,atoms,endpointExtensionMs:rating&&(alpha>0||components)?Math.max(0,end-rating.query.at(-1)):null};
}
function standard(raw,scaler){return [1,...raw.map((v,j)=>scaler.keep[j]?(v-scaler.mean[j])/scaler.scale[j]:0)];}
function pooled(segments,classes,mass,support,x,components){
  const share=classes.map(()=>0),moments=classes.map(()=>Array(8).fill(0)),family=[0,0];
  for(let i=0;i<segments.length;i++){
    const f=segments[i].family;if(f==='rc')family[0]+=mass[i];if(f==='ln')family[1]+=mass[i];
    for(let j=0;j<classes.length;j++){const a=mass[i]*support[i][j];share[j]+=a;
      if(components)for(let k=0;k<8;k++)moments[j][k]+=a*x[i][k];}
  }
  const fineRaw=classes.map((_,j)=>[logit(share[j]),...([5,2,3,4].map(k=>components&&share[j]>0?moments[j][k]/share[j]:0)),0,0,0]);
  return {share,family,fineRaw};
}
function mixFeatures(classes,share,family,kind){
  const active=sum(family),out=[active>0?family[1]/active:0,active],available=[true];
  for(const rc of [true,false]){
    const p=share.filter((_,i)=>RC.has(classes[i])===rc),total=sum(p),q=p.map(x=>total>0?x/total:0);
    const entropy=-sum(q.map(v=>v>0?v*Math.log(v):0))/Math.log(p.length);
    if(kind==='distinct'){
      const second=sum(q.map(v=>v*v)),third=sum(q.map(v=>v*v*v));
      out.push(entropy,total>0?1-second:0,total>0?1-3*second+2*third:0);
    }else{const top=[...q].sort((a,b)=>b-a);out.push(entropy,top[1]??0,top[2]??0);}
    available.push(family[rc?0:1]>0&&p.filter(x=>x>0).length>=2);
  }
  available.push(family.every(x=>x>0));return {values:out,available};
}
function infer(map,segments,rating,profile,options={}){
  if(profile.schemaVersion!==1||profile.classes.length!==14)throw Error('PerceptionProfileSchema');
  const classes=profile.classes,needComponents=!!profile.components;
  const integral=integrate(map,segments,rating,profile.recipe,{...options,modelIdentity:profile.modelIdentity??EXPECTED_RATING,components:needComponents,includeGeometry:!!profile.localCoef});
  // A negative physical exclusion must not renormalize and inflate the other
  // branches when it removes the old maximum-scoring class.
  const base=options._branchSupport??baseSupport(segments,classes,profile.supportPower??1,profile.hard);
  if(base.length!==segments.length||base.some(row=>row.length!==classes.length||row.some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('PerceptionBranchSupport');
  const support=base.map(a=>[...a]);
  if(profile.localCoef){const s=profile.localScaler;
    for(let i=0;i<support.length;i++)for(let j=0;j<classes.length;j++){
      if(base[i][j]<=0)continue;let residual=0;
      for(let k=0;k<8;k++)if(s.keep[j][k])residual+=(integral.x[i][k]-s.mean[j][k])/s.scale[j][k]*profile.localCoef[j][k];
      support[i][j]=sigmoid(logit(base[i][j])+residual);
    }
  }
  const p=pooled(segments,classes,integral.mass,support,integral.x,needComponents);let fine=[],slots=[],tags=[];
  if(profile.kind==='anchored'){
    if(!options.baseline||!Array.isArray(options.baseline.tags))throw Error('PerceptionPrior: matching stable v1.2.2 whole-tag prior required');
    const old=options.baseline.tags,policy=profile.policy,family=profile.family;
    const strong=classes.filter((_,j)=>p.share[j]>=policy.mixOverride),mixed=old.some(c=>SLOTS.includes(c)&&c!=='ordinary');
    if(family.enabled&&p.family[0]>=family.minRc&&p.family[1]>=family.minLn)tags=['hybrid'];
    else if(mixed)tags=strong.length?strong:[...old];
    else tags=classes.filter((c,j)=>(old.includes(c)&&p.share[j]>=policy.keepFloor)||p.share[j]>=policy.addFloor);
  }else{
    for(let j=0;j<classes.length;j++){
      const scaler={mean:profile.fine.scaler.mean[j],scale:profile.fine.scaler.scale[j],keep:profile.fine.scaler.keep[j]},v=standard(p.fineRaw[j],scaler);
      fine.push(p.share[j]>0?sigmoid(sum(v.map((x,k)=>x*profile.fine.coef[j][k]))):0);
    }
    const mf=mixFeatures(classes,p.share,p.family,profile.mixKind),sv=standard(mf.values,profile.slot.scaler);
    let z=[0,...profile.slot.coef.map(row=>sum(row.map((x,j)=>x*sv[j])))].map((v,j)=>mf.available[j]?v:-1e6);
    const peak=Math.max(...z);z=z.map(v=>Math.exp(v-peak));const den=sum(z);slots=z.map(v=>v/den);const slot=slots.indexOf(Math.max(...slots));
    tags=slot?[SLOTS[slot]]:classes.filter((_,j)=>fine[j]>=.5);
    if(!tags.length&&profile.fallback!==false&&Math.max(...fine)>0)tags=[classes[fine.indexOf(Math.max(...fine))]];
  }
  const weights=Object.fromEntries(classes.map((c,j)=>[c,p.share[j]*integral.total/1000]));
  const percentages=Object.fromEntries(classes.map((c,j)=>[c,100*p.share[j]]));
  const labelPercentages=Object.fromEntries(tags.map(c=>[c,c==='hybrid'?100*sum(p.family):c==='rc mix'?100*p.family[0]:c==='ln mix'?100*p.family[1]:percentages[c]]));
  const totalShare=sum(p.share),composition=Object.fromEntries(classes.map((c,j)=>[c,totalShare>0?p.share[j]/totalShare:0]));
  // Rank fine tags by their actual burden share, not alphabetical class order.
  const prior=options.baseline?.tags??[];
  tags.sort((a,b)=>(percentages[b]??0)-(percentages[a]??0)||(prior.includes(a)&&prior.includes(b)?prior.indexOf(a)-prior.indexOf(b):classes.indexOf(a)-classes.indexOf(b)));
  // Display family follows the selected taxonomy, not a second untuned ratio gate.
  const hasRC=tags.some(c=>RC.has(c)||c==='rc mix');
  const hasLN=tags.some(c=>(classes.includes(c)&&!RC.has(c))||c==='ln mix');
  const sort=tags.includes('hybrid')||(hasRC&&hasLN)?'hb':hasRC?'rc':hasLN?'ln':options.baseline?.sort??'hb';
  return {overall:{tags,sort,weights,composition,percentages,labelPercentages,familyMass:{rc:p.family[0],ln:p.family[1]},
    scoreKind:'integrated prototype support times perceptual burden; not correctness probability',
    percentageKind:'overlapping support-weighted burden / all-chart burden; mixture labels cover the associated family union',
    perception:{difficultyAvailable:!!rating&&(profile.recipe.alpha>0||needComponents),componentsAvailable:needComponents,burdenIntegral:integral.total/1000,
      coveredBurdenShare:sum(integral.mass),ratingEndpointExtensionMs:integral.endpointExtensionMs}},
    support,mass:integral.mass,x:integral.x,share:p.share,fine,slots,integral};
}
function decorateSegments(segments,analysis,classes){
  const sums=segments.map(()=>classes.map(()=>0)),weights=segments.map(()=>0);let index=0;
  for(const a of analysis.integral.atoms){
    while(index<segments.length&&segments[index].end<=a.start)index++;
    for(let k=index;k<segments.length&&segments[k].start<a.end;k++){
      const overlap=Math.max(0,Math.min(a.end,segments[k].end)-Math.max(a.start,segments[k].start));
      if(!overlap)continue;const w=a.weight*overlap/(a.end-a.start);weights[k]+=w;
      if(a.frame>=0)for(let j=0;j<classes.length;j++)sums[k][j]+=w*analysis.support[a.frame][j];
    }
  }
  segments.forEach((s,i)=>{
    s.branches=Object.fromEntries(classes.map((c,j)=>[c,weights[i]>0?sums[i][j]/weights[i]:0]));
    s.aggregationWeight=weights[i]/Math.max(analysis.integral.total,1e-30);
  });
  return segments;
}
function ratingEvidenceFromSPM(result,components){
  if(result?.scope!=='whole')throw Error('PerceptionRatingScope: reuse the whole-map include_curve result, not a cropped scalar');
  const evidence={schemaVersion:1,keyCount:result.key_count,speedRate:result.rate,clock:'post-rate-ms',modelIdentity:result.model_identity,
    query:Array.from(result.query??[]),demand:Array.from(result.field??[])};
  if(!finiteArray(evidence.query)||!evidence.query.length||!finiteArray(evidence.demand)||evidence.demand.length!==evidence.query.length)
    throw Error('PerceptionRatingChannel: rate with include_curve=True and retain query/field');
  if(components!==undefined){
    evidence.components={};
    for(const k of PARTS){if(!finiteArray(components[k])||components[k].length!==evidence.query.length)throw Error('PerceptionRatingChannel: provide Rbar/Pbar/Cbar/Jm together on the public query');evidence.components[k]=Array.from(components[k]);}
  }
  return evidence;
}
module.exports={EXPECTED_RATING,COMPACT_RATING,validateRating,baseSupport,integrate,pooled,mixFeatures,infer,ratingEvidenceFromSPM,decorateSegments};

},
function(module,exports,load){
module.exports={
  "schemaVersion": 1,
  "profiles": {
    "actions": {
      "schemaVersion": 1,
      "kind": "anchored",
      "classes": [
        "anchor",
        "chordjack",
        "coordination",
        "dense chordstream",
        "density",
        "fast chordstream",
        "inverse",
        "ln wildcard",
        "minijack",
        "release",
        "speed",
        "tech",
        "technical",
        "vibro"
      ],
      "components": false,
      "supportPower": 1,
      "recipe": {
        "alpha": 0,
        "beta": 2,
        "width": 1000,
        "hold": 1
      },
      "family": {
        "enabled": true,
        "minRc": 0.1,
        "minLn": 0.05
      },
      "policy": {
        "keepFloor": 0.25,
        "addFloor": 0.5,
        "mixOverride": 1.01
      },
      "modelIdentity": null,
      "provenance": {
        "study": "linear-support-r3",
        "model": "detail",
        "arm": "actions",
        "parameterSelection": "pooled INNER; retrospective source-song groups",
        "familySelection": "first-degree affinity restriction",
        "researchBaseline": "v1.1.0",
        "frozenIntermediatePrior": "v1.2.2"
      }
    },
    "detail": {
      "schemaVersion": 1,
      "kind": "anchored",
      "classes": [
        "anchor",
        "chordjack",
        "coordination",
        "dense chordstream",
        "density",
        "fast chordstream",
        "inverse",
        "ln wildcard",
        "minijack",
        "release",
        "speed",
        "tech",
        "technical",
        "vibro"
      ],
      "components": false,
      "supportPower": 1,
      "recipe": {
        "alpha": 2,
        "beta": 1,
        "width": 1000,
        "hold": 1
      },
      "family": {
        "enabled": true,
        "minRc": 0.1,
        "minLn": 0.1
      },
      "policy": {
        "keepFloor": 0.25,
        "addFloor": 0.5,
        "mixOverride": 0.65
      },
      "modelIdentity": "5b0ddc61be53f5107f3b4dfa26a8397aa515e316c16b244878d1fc7039d0ba8f",
      "provenance": {
        "study": "anchored-r1",
        "model": "detail",
        "arm": "combined",
        "parameterSelection": "pooled INNER; retrospective source-song groups",
        "familySelection": "R1 restored after retrospective R1/R3 review",
        "researchBaseline": "v1.1.0",
        "frozenIntermediatePrior": "v1.2.2"
      }
    },
    "compact": {
      "schemaVersion": 1,
      "kind": "anchored",
      "classes": [
        "anchor",
        "chordjack",
        "coordination",
        "dense chordstream",
        "density",
        "fast chordstream",
        "inverse",
        "ln wildcard",
        "minijack",
        "release",
        "speed",
        "tech",
        "technical",
        "vibro"
      ],
      "components": false,
      "supportPower": 1,
      "recipe": {
        "alpha": 4,
        "beta": 1.5,
        "width": 1000,
        "hold": 1
      },
      "family": {
        "enabled": true,
        "minRc": 0.07,
        "minLn": 0.05
      },
      "policy": {
        "keepFloor": 0.25,
        "addFloor": 1.01,
        "mixOverride": 1.01
      },
      "modelIdentity": "55216a3abcf6653c4c78b2082c730d64a0ed4bc476d3e477c4789a39f309fb4e",
      "provenance": {
        "study": "linear-support-r3",
        "model": "compact",
        "arm": "combined",
        "parameterSelection": "pooled INNER; retrospective source-song groups",
        "familySelection": "first-degree affinity restriction",
        "researchBaseline": "v1.1.0",
        "frozenIntermediatePrior": "v1.2.2"
      }
    }
  }
}
;
}],cache={};
function load(id){if(!cache[id]){const m=cache[id]={exports:{}};modules[id](m,m.exports,load);}return cache[id].exports;}
return load(0);})();
if(typeof module!=='undefined')module.exports=TagClassifier;
