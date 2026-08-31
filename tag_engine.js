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
  function fitGrid(rows, tStart, tEnd) {
    const times = [];
    for (const r of rows) {
      if (r.hits > 0 && r.t >= tStart && r.t <= tEnd) times.push(r.t);
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
    const riceArr = map.notes.filter((n) => n.lnEnd == null).map((n) => n.t);
    riceArr.sort((a, b) => a - b);
    const riceTimes = Float64Array.from(riceArr);
    return { map, rows, held, cols, boundaryTimes, lnHeads, lnTails, allEvents, riceTimes };
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
    const grid = fitGrid(rows, t0, t1 - 1);
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
        for (const h of hs) {
          if (h.t > t1) break;
          if (h.t + h.dur >= t0 && h.t < t1) active.push({ start: h.t, end: h.t + h.dur });
        }
        for (const tl of ts) {
          if (tl.t > t1) break;
          if (tl.start < t0 && tl.t >= t0) active.push({ start: tl.start, end: tl.t });
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
        for (const h of ctx.lnHeads) {
          if (h.t >= t0 && h.t < t1 && h.dur < 300) shortLn++;
        }
        const nLnHeads = (() => {
          const hs = ctx.lnHeads;
          const a = lowerBoundObj(hs, t0, (h) => h.t);
          const b = lowerBoundObj(hs, t1, (h) => h.t);
          return b - a;
        })();
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
  function medianWindowFeatures(windows, from, to) {
    const out = {};
    for (const k of MEDIAN_KEYS) out[k] = 0;
    for (const k of MEDIAN_KEYS) {
      out[k] = medianOf(windows, from, to, k);
    }
    const n = Math.max(1, windows.length);
    return {
      ...out,
      // humans judge cut size relative to the map's own baseline, not absolutely
      mapChordMedian: medianOf(windows, 0, n, "chordMean"),
      mapLargeMedian: medianOf(windows, 0, n, "largeChordRatio"),
      mapNpsMedian: medianOf(windows, 0, n, "nps")
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
    const segF = cm.rawSegs.map((s, i) => cm.extras[i].rowCount ? medianWindowFeatures(cm.windows, s.windowRange[0], s.windowRange[1]) : null);
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
    const medians = out.map((_, i) => medianWindowFeatures(cm.windows, cm.rawSegs[i].windowRange[0], cm.rawSegs[i].windowRange[1]));
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
