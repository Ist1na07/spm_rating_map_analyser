/**
 * SPM Map Analyser — 7K Difficulty Rating with Sigmoid Aggregation
 *
 * Based on SPM Rating algorithm with RC/LN sub-models.
 * LN difficulty uses Total SR (validated MAE=0.22 vs LN labels).
 */

// ============================================================
// TUNED PARAMETERS — SPM Rating with Sigmoid Aggregation
// ============================================================
const ENHANCED_PARAMS = {
    // Feature toggles
    use_enhanced: 1, use_enhanced_release: 1, use_column_distance: 1,
    use_shield: 1, use_inverse: 1, use_stamina: 0, use_comprehensiveness: 0,
    D_gamma_e: 0.0,

    // Core scaling
    w_mean: 0.572, rescale_threshold: 9.417420338567627, rescale_divisor: 2.009376904206021,
    jack_aggregation_power: 4.271216932836177, multi_jack_boost: 0.00042685730273835614,
    Abar_scale: 1.0163,
    inverse_peak_width: 2.0,

    // Cross / column distance
    cross_dist_exponent: 1.0, cross_same_hand_penalty: 0.3,
    cross_thumb_bridge_factor: 0.5535622364790934,

    // Release (Rbar)
    release_tail_coeff: 0.14488009478034738,
    release_tail_to_tap: 4.224154738413993,
    release_same_col_bonus: 0.267745272040277,
    release_coord_exponent: 0.7193118045950513,
    release_seq_coeff: 0.10849823285734937,
    lock_interaction_coeff: 0.11648699038253439,

    // Stream / Pbar
    stream_booster_scale: 1.75e-07,
    short_ln_threshold: 331.62375992488296, short_ln_reduction: 0.10008962172133994,

    // S-mix & alphas
    S_w1: 0.484, S_p: 0.9994,
    alpha_P: 0.7245387129819947, alpha_R: 32.2385,
    alpha_C: 11.02053, alpha_S: 0.5554,
    alpha_V: 0.37139999999999995,

    // D formula
    D_beta1: 1.1879, D_beta2: 0.3845,

    // Post-processing (percentile weights — kept for skill ratings, not used for SR)
    w_93: 0.1820607086443739, w_83: 0.2338096935124762,
    coeff_93: 0.9642799087643721, coeff_83: 0.6025543835022324,
    mean_power: 2.137380905141331,

    note_norm_N0: 8.208876816969216, global_scale: 1.0549342571808757,

    // Inverse (Vbar)
    inv_amplitude: 3.7118766294981045, inv_tau: 31.906673905517522,
    inv_power: 0.797883494531484,
    guide_depth: 0.8539658929253457, guide_center: 83.00337573436185,
    guide_width: 33.569919335556584, cross_guide_scale: 0.6632104629775328,
    inverse_same_col_bonus: 2.6796650792734167,
    V_alpha: 0.435,

    // Shield (Sbar)
    shield_tau_ms: 56.2429,
    shield_anchor_mod: 0.8062210781592527,
    shield_coord_factor: 1.0025438218559561,

    // Cross RC/LN blending
    cross_dist_exponent_rc: 0.997293421760749,
    cross_dist_exponent_ln: 0.9323875832719253,
    cross_same_hand_penalty_rc: 0.39298900398939857,
    cross_same_hand_penalty_ln: 0.2954279991821967,

    // === SIGMOID AGGREGATION (Total SR) ===
    use_sigmoid_aggregation: 1,
    agg_sigmoid_k: 2.09,
    agg_sigmoid_C: 3.968852604627637,
    agg_sigmoid_ref_gamma: 0.1956208588626766,
    calib_a: 0.8933406436079341,
    calib_b: 0.03083150068086804,
    agg_n_segments: 30,

    // === RC MODEL PARAMS ===
    S_w1_rc: 0.5459259100383405, S_p_rc: 0.8586310947122264,
    alpha_P_rc: 0.5392380666052108,
    D_beta1_rc: 1.8687574554781872, D_beta2_rc: 0.39363587611423,
    Abar_scale_rc: 0.9886284358035143,

    calib_a_rc: 0.858136086223025, calib_b_rc: -0.018668370815569657,
    agg_sigmoid_k_rc: 2.310438836954186,
    agg_sigmoid_C_rc: 4.1140868461450575,
    agg_sigmoid_gamma_rc: 0.20280826962182968,
    agg_n_segments_rc: 30,

    note_norm_N0_rc: 0.0,
    rescale_threshold_rc: 9.54091768708962,
    rescale_divisor_rc: 2.114935396824644,
    global_scale_rc: 1.0530564601936523,

    // === LN-MASKED MODEL PARAMS (fitted on 102 LN-labeled maps, MAE=0.237) ===
    calib_a_ln_masked: 0.953798,
    calib_b_ln_masked: -0.402804,

    // === CORRECTION LAYER (7 features, L2 λ=0.01, CV Test Loss=0.862) ===
    correction_chord:   -0.71420012109205,
    correction_fj:       0.26523765756302176,
    correction_hs:       0.04346521445328749,
    correction_lb:       0.020229065240061,
    correction_speed:   -0.0380996735738698,
    correction_burst:   -0.025148794588902998,
    correction_pj:      -0.0050070390858298125,
    // Correction postprocess (jointly optimized)
    note_norm_N0_corr:        0.00048019189651536405,
    rescale_threshold_corr:   9.398828546361862,
    rescale_divisor_corr:     1.9841881487426187,
    global_scale_corr:        1.0614719389587273,
    // Feature computation params (fixed, not optimized)
    corr_spd_dt: 150, corr_spd_dc: 3,
    corr_bst_dt: 100, corr_ch_order: 4,
    corr_hs_dt: 200, corr_lb_dt: 150, corr_fj_dt: 100,
};

// ============================================================
// CONSTANTS
// ============================================================
const CROSS_MATRIX = {
    1: [0.075, 0.075],
    2: [0.125, 0.05, 0.125],
    3: [0.125, 0.125, 0.125, 0.125],
    4: [0.175, 0.25, 0.05, 0.25, 0.175],
    5: [0.175, 0.25, 0.175, 0.175, 0.25, 0.175],
    6: [0.225, 0.35, 0.25, 0.05, 0.25, 0.35, 0.225],
    7: [0.225, 0.35, 0.25, 0.225, 0.225, 0.25, 0.35, 0.225],
    8: [0.275, 0.45, 0.35, 0.25, 0.05, 0.25, 0.35, 0.45, 0.275],
};

const HAND_MAP = { 0: "L", 1: "L", 2: "L", 3: "T", 4: "R", 5: "R", 6: "R" };

// === Dan Mapping: piecewise interpolation from JS-measured Dan marathon SR ===
const RC_MEASURED_SR = [3.5449, 4.1173, 4.7779, 5.3828, 5.6073, 5.9572, 6.5094, 6.8727, 7.3217, 7.6914, 8.2343, 8.8742, 9.4783, 10.2];
const RC_MEASURED_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11.5, 13, 14.5];
const LN_MEASURED_SR = [3.9941, 4.5493, 4.5658, 5.3636, 5.7113, 6.3932, 6.7573, 6.9029, 7.3674, 7.5645, 8.3404, 8.7503, 9.5141, 10.134];
const LN_MEASURED_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11.5, 13, 14.5];

// Thresholds centered on calibration points so each Dan level maps to its regular label
// at the calibration value (e.g. Gamma=11.5 → bin [10.5, 12.5) → frac=0.5 → "Gamma")
const DAN_THRESHOLDS = [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 12.5, 13.5, 15.5];
const DAN_NAMES = ['0th', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th',
                   '8th', '9th', '10th', 'Gamma', 'Azimuth', 'Zenith', 'Stellium'];

const SECTION_LENGTH = 400;
const DECAY_WEIGHT = 0.88;
const RATING_MULTIPLIER = 0.090;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
// Piecewise linear interpolation: SR -> Dan level
function interpDan(sr, measuredSR, measuredLevels) {
    const n = measuredSR.length;
    if (n === 0) return 0;
    // Snap to exact measured points within tolerance (eliminates FP boundary issues)
    const EPS = 0.002;
    for (let i = 0; i < n; i++) {
        if (Math.abs(sr - measuredSR[i]) < EPS) return measuredLevels[i];
    }
    // Below lowest measured point: extrapolate using first segment slope
    if (sr <= measuredSR[0]) {
        if (n < 2) return measuredLevels[0];
        const slope = (measuredLevels[1] - measuredLevels[0]) / Math.max(measuredSR[1] - measuredSR[0], 0.001);
        return Math.max(0, measuredLevels[0] + slope * (sr - measuredSR[0]));
    }
    // Above highest measured point: extrapolate using last segment slope
    if (sr >= measuredSR[n - 1]) {
        if (n < 2) return measuredLevels[n - 1];
        const slope = (measuredLevels[n - 1] - measuredLevels[n - 2]) / Math.max(measuredSR[n - 1] - measuredSR[n - 2], 0.001);
        return measuredLevels[n - 1] + slope * (sr - measuredSR[n - 1]);
    }
    // Find interval [i, i+1] where sr lies
    let i = 0;
    for (; i < n - 1; i++) {
        if (sr < measuredSR[i + 1]) break;
    }
    const t = (sr - measuredSR[i]) / Math.max(measuredSR[i + 1] - measuredSR[i], 0.0001);
    return measuredLevels[i] + t * (measuredLevels[i + 1] - measuredLevels[i]);
}

function ratingToDanRC(sr) { return interpDan(sr, RC_MEASURED_SR, RC_MEASURED_LEVELS); }
function ratingToDanLN(sr) { return interpDan(sr, LN_MEASURED_SR, LN_MEASURED_LEVELS); }

function danToLabelRC(danLevel) {
    return danToLabelGeneric(danLevel, DAN_THRESHOLDS);
}

function danToLabelLN(danLevel) {
    return danToLabelGeneric(danLevel, DAN_THRESHOLDS);
}

function danToLabelGeneric(danLevel, thresholds) {
    if (danLevel < thresholds[0]) return DAN_NAMES[0];
    let idx = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (danLevel >= thresholds[i]) { idx = i; break; }
    }
    if (idx >= DAN_NAMES.length) return DAN_NAMES[DAN_NAMES.length - 1];
    const name = DAN_NAMES[idx];
    const binStart = thresholds[idx];
    const binEnd = idx < thresholds.length - 1 ? thresholds[idx + 1] : binStart + 1;
    const binWidth = binEnd - binStart;
    const frac = binWidth > 0 ? (danLevel - binStart) / binWidth : 0;
    if (frac < 0.25) return name + " low";
    else if (frac < 0.75) return name;
    else return name + " high";
}

function bisectLeft(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid] < x) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function bisectRight(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid] <= x) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

// ============================================================
// MAP SORT CLASSIFIER (4-class: rc/ln/hb/mix, 98.1% accuracy)
// ============================================================
function classifyMapSort(lnRatio, avgLNDur, maxLNDensity, rcSrRatio, lnContrib, topLnContrib, topRcSrRatio, lnDurationRatio, lnDifficultyDominance) {
  if (lnDurationRatio <= 0.568756) {
    if (lnContrib <= 0.045978) {
      return 'RC';
    } else {
      return 'HB';
    }
  } else {
    if (lnRatio <= 0.468879) {
      if (lnDurationRatio <= 0.865882) {
        return 'MIX';
      } else {
        if (lnContrib <= 0.139069) {
          return 'HB';
        } else {
          return 'LN';
        }
      }
    } else {
      if (lnRatio <= 0.499290) {
        if (lnContrib <= 0.103493) {
          return 'HB';
        } else {
          return 'LN';
        }
      } else {
        if (lnDurationRatio <= 1.637306) {
          return 'LN';
        } else {
          return 'LN';
        }
      }
    }
  }
}

/** LN dominance rule: LN-heavy maps classified as LN when difficulty is LN-dominated. */
function applyLNDominance(mapType, lnDurationRatio, lnDifficultyDominance) {
  // LN difficulty dominance: LN difficulty significantly exceeds RC difficulty
  // (lnDurationRatio > 0.65 removed — it caught 46/47 HB maps as false positives)
  if (lnDifficultyDominance > 0.35) return 'LN';
  return mapType;
}

function cumsum(x, f) {
    const F = new Array(x.length).fill(0);
    for (let i = 1; i < x.length; i++) F[i] = F[i - 1] + f[i - 1] * (x[i] - x[i - 1]);
    return F;
}

function queryCumsum(q, x, F, f) {
    if (q <= x[0]) return 0.0;
    if (q >= x[x.length - 1]) return F[F.length - 1];
    let i = bisectRight(x, q) - 1;
    i = Math.max(0, Math.min(i, x.length - 2));
    return F[i] + f[i] * (q - x[i]);
}

function smoothOnCorners(x, f, window, scale, mode) {
    const F = cumsum(x, f);
    const g = new Array(x.length);
    for (let i = 0; i < x.length; i++) {
        const s = x[i], a = Math.max(s - window, x[0]), b = Math.min(s + window, x[x.length - 1]);
        if (b - a <= 0) { g[i] = 0.0; continue; }
        const integral = queryCumsum(b, x, F, f) - queryCumsum(a, x, F, f);
        g[i] = mode === 'avg' ? integral / (b - a) : scale * integral;
    }
    return g;
}

function interpValues(newX, oldX, oldVals) {
    const result = new Array(newX.length);
    for (let i = 0; i < newX.length; i++) {
        const x = newX[i];
        if (x <= oldX[0]) { result[i] = oldVals[0]; continue; }
        if (x >= oldX[oldX.length - 1]) { result[i] = oldVals[oldVals.length - 1]; continue; }
        const idx = bisectRight(oldX, x) - 1;
        const t = (x - oldX[idx]) / (oldX[idx + 1] - oldX[idx]);
        result[i] = oldVals[idx] + t * (oldVals[idx + 1] - oldVals[idx]);
    }
    return result;
}

function stepInterp(newX, oldX, oldVals) {
    const result = new Array(newX.length);
    for (let i = 0; i < newX.length; i++) {
        let idx = bisectRight(oldX, newX[i]) - 1;
        idx = Math.max(0, Math.min(idx, oldVals.length - 1));
        result[i] = oldVals[idx];
    }
    return result;
}

function LN_sum(a, b, LN_rep) {
    const [points, cumsumValues, values] = LN_rep;
    const i = bisectRight(points, a) - 1, j = bisectRight(points, b) - 1;
    if (i === j) return (b - a) * values[i];
    let total = (points[i + 1] - a) * values[i];
    total += cumsumValues[j] - cumsumValues[i + 1];
    total += (b - points[j]) * values[j];
    return total;
}

function mergeSorted(arrA, arrB, keyFn) {
    const result = [];
    let ia = 0, ib = 0;
    while (ia < arrA.length && ib < arrB.length) {
        if (keyFn(arrA[ia]) <= keyFn(arrB[ib])) result.push(arrA[ia++]);
        else result.push(arrB[ib++]);
    }
    while (ia < arrA.length) result.push(arrA[ia++]);
    while (ib < arrB.length) result.push(arrB[ib++]);
    return result;
}

function coordWeight(k1, k2) {
    if (k1 === k2) return 1.0;
    const h1 = HAND_MAP[k1] || "", h2 = HAND_MAP[k2] || "";
    if (h1 === h2 && h1 !== "T") return 0.8;
    else if (h1 === "T" || h2 === "T") return 0.4;
    else return 0.2;
}

// ============================================================
// PARSER & PREPROCESSOR (unchanged from Phase 2)
// ============================================================
function parseOsuFile(content) {
    let K = 7; const cols = [], starts = [], ends = [], types_arr = [];
    let od = 8.0, inHitobjects = false;
    const lines = content.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('CircleSize')) {
            const v = parseFloat(line.split(':')[1].trim());
            K = v === 0 ? 10 : Math.floor(v);
        } else if (line.startsWith('OverallDifficulty')) {
            od = parseFloat(line.split(':')[1].trim());
        } else if (line === '[HitObjects]') { inHitobjects = true; continue; }
        if (inHitobjects) {
            if (line.startsWith('[')) break;
            const parts = line.split(','); if (parts.length < 4) continue;
            const xPos = parseInt(parts[0]);
            const colCount = Math.max(K, 1);
            let col = Math.floor(xPos * colCount / 512);
            col = Math.max(0, Math.min(col, colCount - 1));
            const noteStart = parseInt(parts[2]), noteType = parseInt(parts[3]);
            let noteEnd = 0;
            if (noteType & 128 && parts.length >= 6) noteEnd = parseInt(parts[5].split(':')[0]) || 0;
            cols.push(col); starts.push(noteStart); ends.push(noteEnd); types_arr.push(noteType);
        }
    }
    return { K: 7, cols, starts, ends, types_arr, od };
}

function preprocess(parsedData, speedRate) {
    const { cols, starts, ends, types_arr, od } = parsedData;
    let K = 7;

    const odVal = od > 0 ? od : 10.0;
    let x = 0.3 * Math.pow((64.5 - Math.ceil(odVal * 3)) / 500, 0.5);
    x = Math.max(x, 0.01);
    x = Math.min(x, 0.6 * (x - 0.09) + 0.09);

    const noteSeq = [];
    for (let i = 0; i < cols.length; i++) {
        let h = starts[i], t = (types_arr[i] & 128) ? ends[i] : -1;
        if (speedRate && speedRate !== 1.0) {
            h = Math.floor(h / speedRate); t = t >= 0 ? Math.floor(t / speedRate) : t;
        }
        noteSeq.push({ col: cols[i], start: h, end: t, isLN: (types_arr[i] & 128) !== 0 });
    }
    noteSeq.sort((a, b) => a.start - b.start || a.col - b.col);
    if (noteSeq.length === 0) return { error: "no notes", x, K };

    const noteSeqByColumn = [];
    for (let k = 0; k < K; k++) noteSeqByColumn.push(noteSeq.filter(n => n.col === k));

    const LNSeq = noteSeq.filter(n => n.isLN);
    const tailSeq = [...LNSeq].sort((a, b) => a.end - b.end);

    const maxHead = Math.max(...noteSeq.map(n => n.start));
    const maxTail = LNSeq.length > 0 ? Math.max(...LNSeq.map(n => n.end)) : 0;
    const T = Math.max(maxHead, maxTail) + 1;

    const cornersBaseSet = new Set();
    for (const note of noteSeq) {
        cornersBaseSet.add(note.start);
        if (note.end >= 0) cornersBaseSet.add(note.end);
    }
    for (const s of [...cornersBaseSet]) {
        cornersBaseSet.add(s + 501); cornersBaseSet.add(s - 499); cornersBaseSet.add(s + 1);
    }
    cornersBaseSet.add(0); cornersBaseSet.add(T);
    const cornersBase = [...cornersBaseSet].filter(s => s >= 0 && s <= T).sort((a, b) => a - b);

    const cornersASet = new Set();
    for (const note of noteSeq) {
        cornersASet.add(note.start);
        if (note.end >= 0) cornersASet.add(note.end);
    }
    for (const s of [...cornersASet]) {
        cornersASet.add(s + 1000); cornersASet.add(s - 1000);
    }
    cornersASet.add(0); cornersASet.add(T);
    const cornersA = [...cornersASet].filter(s => s >= 0 && s <= T).sort((a, b) => a - b);

    const allCorners = [...new Set([...cornersBase, ...cornersA])].sort((a, b) => a - b);

    const keyUsage = {};
    for (let k = 0; k < K; k++) keyUsage[k] = new Array(cornersBase.length).fill(false);
    for (const note of noteSeq) {
        const st = Math.max(note.start - 150, 0);
        const et = note.end < 0 ? Math.min(note.start + 150, T - 1) : Math.min(note.end + 150, T - 1);
        const left = bisectLeft(cornersBase, st), right = bisectLeft(cornersBase, et);
        for (let j = left; j < right; j++) keyUsage[note.col][j] = true;
    }

    const activeColumns = cornersBase.map((_, i) => {
        const cols = [];
        for (let k = 0; k < K; k++) if (keyUsage[k][i]) cols.push(k);
        return cols;
    });

    const keyUsage400 = {};
    for (let k = 0; k < K; k++) keyUsage400[k] = new Array(cornersBase.length).fill(0);
    for (const note of noteSeq) {
        const st = Math.max(note.start, 0), et = note.end < 0 ? note.start : Math.min(note.end, T - 1);
        const l400 = bisectLeft(cornersBase, st - 400), li = bisectLeft(cornersBase, st);
        const ri = bisectLeft(cornersBase, et), r400 = bisectLeft(cornersBase, et + 400);
        const dur = Math.min(et - st, 1500);
        for (let j = li; j < ri && j < cornersBase.length; j++) keyUsage400[note.col][j] += 3.75 + dur / 150.0;
        for (let j = l400; j < li && j < cornersBase.length; j++)
            keyUsage400[note.col][j] += 3.75 - 3.75 / (400 * 400) * Math.pow(cornersBase[j] - st, 2);
        for (let j = ri; j < r400 && j < cornersBase.length; j++)
            keyUsage400[note.col][j] += 3.75 - 3.75 / (400 * 400) * Math.pow(Math.abs(cornersBase[j] - et), 2);
    }

    const diff = {};
    for (const note of LNSeq) {
        const t0 = Math.min(note.start + 60, note.end), t1 = Math.min(note.start + 120, note.end);
        diff[t0] = (diff[t0] || 0) + 1.3;
        diff[t1] = (diff[t1] || 0) + (-1.3 + 1);
        diff[note.end] = (diff[note.end] || 0) - 1;
    }
    const lnPoints = [...new Set([0, T, ...Object.keys(diff).map(Number)])].sort((a, b) => a - b);
    const lnValues = [], lnCumsum = [0];
    let curr = 0.0;
    for (let i = 0; i < lnPoints.length - 1; i++) {
        const t = lnPoints[i];
        if (diff[t] !== undefined) curr += diff[t];
        const v = Math.min(curr, 2.5 + 0.5 * curr);
        lnValues.push(v);
        lnCumsum.push(lnCumsum[lnCumsum.length - 1] + (lnPoints[i + 1] - lnPoints[i]) * v);
    }

    return {
        x, K, T, od, noteSeq, noteSeqByColumn, LNSeq, tailSeq,
        allCorners, baseCorners: cornersBase, A_corners: cornersA,
        keyUsage, activeColumns, keyUsage400, LN_rep: [lnPoints, lnCumsum, lnValues],
    };
}

// ============================================================
// COMPONENTS (unchanged from Phase 2)
// ============================================================
function computeAnchor(K, keyUsage400, baseCorners) {
    const anchor = new Array(baseCorners.length).fill(0);
    for (let i = 0; i < baseCorners.length; i++) {
        const counts = [];
        for (let k = 0; k < K; k++) counts.push(keyUsage400[k][i]);
        counts.sort((a, b) => b - a);
        const nonzero = counts.filter(c => c > 0);
        if (nonzero.length > 1) {
            let walk = 0, total = 0;
            for (let j = 0; j < nonzero.length - 1; j++) {
                const ratio = nonzero[j + 1] / Math.max(nonzero[j], 1e-9);
                walk += nonzero[j] * (1 - 4 * Math.pow(0.5 - ratio, 2));
                total += nonzero[j];
            }
            anchor[i] = walk / Math.max(total, 1e-9);
        }
    }
    for (let i = 0; i < anchor.length; i++)
        anchor[i] = 1 + Math.min(anchor[i] - 0.18, 5 * Math.pow(anchor[i] - 0.22, 3));
    return anchor;
}

function computeJbar(K, x, noteSeqByColumn, baseCorners, aggregationPower, multiJackBoost) {
    aggregationPower = aggregationPower || 5; multiJackBoost = multiJackBoost || 0;
    function jNerf(d) { return 1 - 7e-5 * Math.pow(0.15 + Math.abs(d - 0.08), -4); }
    const J_ks = {}, delta_ks = {};
    for (let k = 0; k < K; k++) {
        J_ks[k] = new Array(baseCorners.length).fill(0);
        delta_ks[k] = new Array(baseCorners.length).fill(1e9);
    }
    for (let k = 0; k < K; k++) {
        const notes = noteSeqByColumn[k] || [];
        for (let i = 0; i < notes.length - 1; i++) {
            const li = bisectLeft(baseCorners, notes[i].start), ri = bisectLeft(baseCorners, notes[i + 1].start);
            if (ri <= li) continue;
            const delta = 0.001 * (notes[i + 1].start - notes[i].start);
            const v = Math.pow(delta, -1) / (delta + 0.11 * Math.pow(x, 0.25)) * jNerf(delta);
            for (let j = li; j < ri && j < baseCorners.length; j++) {
                J_ks[k][j] = v; delta_ks[k][j] = delta;
            }
        }
    }
    const Jbar_ks = {};
    for (let k = 0; k < K; k++) Jbar_ks[k] = smoothOnCorners(baseCorners, J_ks[k], 500, 0.001, 'sum');

    const Jbar = new Array(baseCorners.length);
    for (let i = 0; i < baseCorners.length; i++) {
        let num = 0, den = 0;
        for (let k = 0; k < K; k++) {
            const v = Math.max(Jbar_ks[k][i], 0), w = 1.0 / Math.max(delta_ks[k][i], 1e-12);
            num += Math.pow(v, aggregationPower) * w; den += w;
        }
        Jbar[i] = Math.pow(num / Math.max(den, 1e-9), 1.0 / aggregationPower);
    }
    if (multiJackBoost > 1e-12) {
        for (let i = 0; i < baseCorners.length; i++) {
            let ac = 0;
            for (let k = 0; k < K; k++) if (Jbar_ks[k][i] > 1e-9) ac++;
            if (ac >= 2) Jbar[i] *= (1.0 + multiJackBoost * (ac - 1));
        }
    }
    return { delta_ks, Jbar, Jbar_ks };
}

function computeXbarEnhanced(K, x, noteSeqByColumn, activeColumns, baseCorners, p) {
    function getDistWeight(k1, k2) {
        if (k1 < 0 || k2 < 0 || k1 >= K || k2 >= K) return 1.0;
        const rd = Math.abs(k1 - k2); if (rd === 0) return 1.0;
        const h1 = HAND_MAP[k1] || "", h2 = HAND_MAP[k2] || "";
        if (h1 === h2 && h1 !== "T") return 1.0 + p.cross_same_hand_penalty * (1.0 / Math.pow(rd, p.cross_dist_exponent));
        if (h1 === "T" || h2 === "T") return 1.0 - p.cross_thumb_bridge_factor * (1.0 / Math.max(rd, 1));
        return 1.0 - p.cross_same_hand_penalty * Math.min(rd / K, 1.0);
    }
    const cc = CROSS_MATRIX[K] || CROSS_MATRIX[7];
    const X_ks = {}, fast_cross = {};
    for (let k = 0; k <= K; k++) {
        X_ks[k] = new Array(baseCorners.length).fill(0);
        fast_cross[k] = new Array(baseCorners.length).fill(0);
    }
    for (let k = 0; k <= K; k++) {
        let notesInPair;
        if (k === 0) notesInPair = noteSeqByColumn[0] || [];
        else if (k === K) notesInPair = noteSeqByColumn[K - 1] || [];
        else notesInPair = mergeSorted(noteSeqByColumn[k - 1] || [], noteSeqByColumn[k] || [], n => n.start);
        for (let i = 1; i < notesInPair.length; i++) {
            const li = bisectLeft(baseCorners, notesInPair[i - 1].start), ri = bisectLeft(baseCorners, notesInPair[i].start);
            if (ri <= li) continue;
            const delta = 0.001 * (notesInPair[i].start - notesInPair[i - 1].start);
            const dw = getDistWeight(notesInPair[i - 1].col, notesInPair[i].col);
            let val = 0.16 * dw * Math.pow(Math.max(x, delta), -2);
            const colA = k - 1, colB = k;
            const aS = activeColumns[li] || [];
            const aRi = Math.min(ri, activeColumns.length - 1);
            const aE = activeColumns[aRi] || [];
            if ((!aS.includes(colA) && !aE.includes(colA)) || (!aS.includes(colB) && !aE.includes(colB)))
                val *= (1 - cc[k]);
            for (let j = li; j < ri && j < baseCorners.length; j++) {
                X_ks[k][j] = val;
                fast_cross[k][j] = Math.max(0, 0.4 * Math.pow(Math.max(delta, 0.06, 0.75 * x), -2) - 80);
            }
        }
    }
    const X_base = new Array(baseCorners.length).fill(0);
    for (let i = 0; i < baseCorners.length; i++) {
        let s = 0;
        for (let k = 0; k <= K; k++) s += X_ks[k][i] * cc[k];
        for (let k = 0; k < K; k++)
            s += Math.sqrt(Math.max(fast_cross[k][i], 0) * cc[k] * Math.max(fast_cross[k + 1][i], 0) * cc[k + 1]);
        X_base[i] = s;
    }
    return smoothOnCorners(baseCorners, X_base, 500, 0.001, 'sum');
}

function computePbar(K, x, noteSeq, LN_rep, anchor, baseCorners, boosterScale) {
    function sBoost(d) { const b = 7.5 / d; return (b > 160 && b < 360) ? 1 + boosterScale * (b - 160) * Math.pow(b - 360, 2) : 1; }
    const P_step = new Array(baseCorners.length).fill(0);
    for (let i = 0; i < noteSeq.length - 1; i++) {
        const h_l = noteSeq[i].start, h_r = noteSeq[i + 1].start, dt = h_r - h_l;
        if (dt < 1e-9) {
            const spike = 1000 * Math.pow(0.02 * (4 / x - 24), 0.25);
            const li = Math.min(bisectLeft(baseCorners, h_l), baseCorners.length - 1);
            const ri = Math.min(bisectRight(baseCorners, h_l), baseCorners.length);
            for (let j = li; j < ri; j++) P_step[j] += spike;
            continue;
        }
        const li = bisectLeft(baseCorners, h_l), ri = bisectLeft(baseCorners, h_r);
        if (ri <= li) continue;
        const delta = 0.001 * dt, v = 1 + 6 * 0.001 * LN_sum(h_l, h_r, LN_rep), bVal = sBoost(delta);
        let inc;
        if (delta < 2 * x / 3)
            inc = Math.pow(delta, -1) * Math.pow(0.08 / x * (1 - 24 / x * Math.pow(delta - x / 2, 2)), 0.25) * Math.max(bVal, v);
        else
            inc = Math.pow(delta, -1) * Math.pow(0.08 / x * (1 - 24 / x * Math.pow(x / 6, 2)), 0.25) * Math.max(bVal, v);
        for (let j = li; j < ri && j < baseCorners.length; j++)
            P_step[j] += Math.min(inc * anchor[j], Math.max(inc, inc * 2 - 10));
    }
    return smoothOnCorners(baseCorners, P_step, 500, 0.001, 'sum');
}

function computeAbar(K, delta_ks, activeColumns, A_corners, baseCorners) {
    const dks = {};
    for (let k = 0; k < Math.max(K - 1, 1); k++) dks[k] = new Array(baseCorners.length).fill(0);
    for (let i = 0; i < baseCorners.length; i++) {
        const cols = activeColumns[i] || [];
        for (let j = 0; j < cols.length - 1; j++) {
            const k0 = cols[j], k1 = cols[j + 1];
            dks[k0][i] = Math.abs(delta_ks[k0][i] - delta_ks[k1][i]) +
                         0.4 * Math.max(0, Math.max(delta_ks[k0][i], delta_ks[k1][i]) - 0.11);
        }
    }
    const A_step = new Array(A_corners.length).fill(1);
    for (let i = 0; i < A_corners.length; i++) {
        let ci = Math.min(bisectLeft(baseCorners, A_corners[i]), baseCorners.length - 1);
        const cols = activeColumns[ci] || [];
        for (let j = 0; j < cols.length - 1; j++) {
            const k0 = cols[j], k1 = cols[j + 1], dVal = dks[k0][ci];
            if (dVal < 0.02) A_step[i] *= Math.min(0.75 + 0.5 * Math.max(delta_ks[k0][ci], delta_ks[k1][ci]), 1);
            else if (dVal < 0.07) A_step[i] *= Math.min(0.65 + 5 * dVal + 0.5 * Math.max(delta_ks[k0][ci], delta_ks[k1][ci]), 1);
        }
    }
    return smoothOnCorners(A_corners, A_step, 250, 1, 'avg');
}

function precomputeReleaseData(K, x, noteSeqByColumn, tailSeq, noteSeq) {
    const nTails = tailSeq.length;
    if (nTails === 0) return { tails: [], I_list: [], lock_data: [], K, x };

    const I_list = [];
    for (let i = 0; i < nTails; i++) {
        const [k, h_i, t_i] = [tailSeq[i].col, tailSeq[i].start, tailSeq[i].end];
        const times = noteSeqByColumn[k].map(n => n.start);
        const idx = bisectLeft(times, h_i);
        const nextNote = idx + 1 < noteSeqByColumn[k].length ? noteSeqByColumn[k][idx + 1] : null;
        const h_j = nextNote ? nextNote.start : 1e9;
        const I_h = 0.001 * Math.abs(t_i - h_i - 80) / x;
        const I_t = 0.001 * Math.abs(h_j - t_i - 80) / x;
        I_list.push(2.0 / (2.0 + Math.exp(-5.0 * (I_h - 0.75)) + Math.exp(-5.0 * (I_t - 0.75))));
    }

    const noteTimes = noteSeq.map(n => n.start), noteCols = noteSeq.map(n => n.col);
    const tailTimesArr = tailSeq.map(t => t.end), tailColsArr = tailSeq.map(t => t.col);

    const tails = [];
    for (let i = 0; i < nTails; i++) {
        const [k_i, h_i, t_i] = [tailSeq[i].col, tailSeq[i].start, tailSeq[i].end];
        const nxtIdx = bisectRight(noteTimes, t_i);
        const nextNoteTime = nxtIdx < noteTimes.length ? noteTimes[nxtIdx] : 1e9;
        const nextNoteCol = nxtIdx < noteTimes.length ? noteCols[nxtIdx] : -1;
        const nxtTIdx = bisectRight(tailTimesArr, t_i);
        const nextTailTime = nxtTIdx < tailTimesArr.length ? tailTimesArr[nxtTIdx] : 1e9;
        const nextTailCol = nxtTIdx < tailTimesArr.length ? tailColsArr[nxtTIdx] : -1;
        const nis = nextTailTime < nextNoteTime;
        tails.push({
            col: k_i, tail_time: t_i, ln_duration: t_i - h_i, I: I_list[i],
            next_time: nis ? nextTailTime : nextNoteTime,
            next_col: nis ? nextTailCol : nextNoteCol,
            next_is_tail: nis,
        });
    }

    const lock_data = [];
    for (let i = 0; i < nTails; i++) {
        const [k_i, , t_i] = [tailSeq[i].col, tailSeq[i].start, tailSeq[i].end];
        const locks = [];
        for (let j = 0; j < K; j++) {
            if (j === k_i) continue;
            for (const ln of tailSeq) {
                if (ln.col !== j) continue;
                if (ln.start <= t_i && t_i <= ln.end) { locks.push([j, coordWeight(k_i, j)]); break; }
            }
        }
        lock_data.push(locks);
    }

    return { tails, I_list, lock_data, K, x };
}

function computeRbarEnhanced(releaseData, baseCorners, p) {
    const { tails, lock_data, K, x } = releaseData;
    const nTails = tails.length;
    const R_step = new Array(baseCorners.length).fill(0);

    for (let i = 0; i < nTails; i++) {
        const td = tails[i], nt = td.next_time;
        if (nt >= 1e9) continue;
        const dt = nt - td.tail_time;
        if (dt <= 0 || dt > 5000) continue;
        const delta = 0.001 * dt;
        let rv = p.release_tail_coeff * Math.pow(delta, -0.5) * Math.pow(x, -1) * (1.0 + td.I);
        if (td.col === td.next_col && !td.next_is_tail) rv *= p.release_same_col_bonus;
        if (td.col !== td.next_col) {
            const cw = coordWeight(td.col, td.next_col);
            rv *= td.next_is_tail ? 1.0 + (cw - 1.0) * p.release_coord_exponent * 0.5
                                  : 1.0 + (cw - 1.0) * p.release_coord_exponent * p.release_tail_to_tap;
        }
        if (td.ln_duration < p.short_ln_threshold) {
            rv *= p.short_ln_reduction + (1.0 - p.short_ln_reduction) * (td.ln_duration / p.short_ln_threshold);
        }
        if (p.lock_interaction_coeff > 1e-9 && i < lock_data.length) {
            const lc = lock_data[i].reduce((s, [, cw]) => s + cw, 0);
            rv *= (1.0 + p.lock_interaction_coeff * lc);
        }
        rv = Math.max(0, Math.min(rv, 1e6));
        const li = bisectLeft(baseCorners, td.tail_time);
        const ri = bisectLeft(baseCorners, Math.min(nt, baseCorners[baseCorners.length - 1]));
        for (let j = li; j < ri && j < baseCorners.length; j++) R_step[j] += rv;
    }

    for (let i = 0; i < nTails - 1; i++) {
        const tS = tails[i].tail_time, tE = tails[i + 1].tail_time;
        const li = bisectLeft(baseCorners, tS), ri = bisectLeft(baseCorners, tE);
        if (ri <= li) continue;
        const dr = 0.001 * (tE - tS);
        const cw = coordWeight(tails[i].col, tails[i + 1].col);
        const cf = 1.0 + (cw - 1.0) * p.release_coord_exponent;
        let sv = p.release_seq_coeff * Math.pow(dr, -0.5) * Math.pow(x, -1) *
                 (1.0 + 0.8 * (tails[i].I + tails[i + 1].I)) * cf;
        sv = Math.max(0, Math.min(sv, 1e6));
        for (let j = li; j < ri && j < baseCorners.length; j++) R_step[j] += sv;
    }
    return smoothOnCorners(baseCorners, R_step, 500, 0.001, 'sum');
}

function precomputeShieldData(K, noteSeqByColumn, LNSeq) {
    const colHeadTimes = noteSeqByColumn.map(col => col.map(n => n.start));
    const data = [];
    for (const ln of LNSeq) {
        const [k, h, t] = [ln.col, ln.start, ln.end];
        const prevDts = colHeadTimes[k].filter(nh => nh < h && h - nh <= 500).map(nh => h - nh);
        const lockCols = [];
        for (let j = 0; j < K; j++) {
            if (j === k) continue;
            const found = LNSeq.find(ol => ol.col === j && ol.start <= h && h <= ol.end);
            if (found) lockCols.push(j);
        }
        if (prevDts.length > 0) data.push({ col: k, head_time: h, tail_time: t, prev_dts: prevDts, lock_cols: lockCols });
    }
    return data;
}

function computeSbar(shieldData, baseCorners, p) {
    const S_step = new Array(baseCorners.length).fill(0);
    for (const sd of shieldData) {
        const [k, h, t] = [sd.col, sd.head_time, sd.tail_time];
        const dts = sd.prev_dts;
        let ss = 0;
        for (const dt of dts) ss += Math.exp(-dt / p.shield_tau_ms);
        if (ss < 1e-12) continue;
        let lb = 0;
        for (const j of sd.lock_cols) lb += coordWeight(k, j);
        const sv = ss * (1.0 + p.shield_anchor_mod * p.shield_coord_factor * lb);
        const st = Math.max(h - 100, h - Math.max(...dts)), et = Math.min(h + 100, t);
        const li = bisectLeft(baseCorners, st), ri = bisectLeft(baseCorners, et);
        for (let j = li; j < ri && j < baseCorners.length; j++) S_step[j] += sv;
    }
    return smoothOnCorners(baseCorners, S_step, 500, 0.001, 'sum');
}

function precomputeInverseData(K, noteSeqByColumn, LNSeq) {
    const colHeadTimes = noteSeqByColumn.map(col => col.map(n => n.start));
    const data = [];
    for (const ln of LNSeq) {
        const [k, h, t] = [ln.col, ln.start, ln.end];
        if (t < 0) continue;
        const sameDts = colHeadTimes[k].filter(nh => nh > t && nh - t <= 200).map(nh => nh - t);
        const crossDts = [], crossK1 = [], crossK2 = [];
        for (let ok = 0; ok < K; ok++) {
            if (ok === k) continue;
            for (const nh of colHeadTimes[ok]) {
                const dt = nh - t;
                if (dt > 0 && dt <= 200) { crossDts.push(dt); crossK1.push(k); crossK2.push(ok); }
            }
        }
        if (sameDts.length > 0 || crossDts.length > 0)
            data.push({ col: k, head_time: h, tail_time: t, same_col_dts: sameDts, cross_col_dts: crossDts, cross_col_k1: crossK1, cross_col_k2: crossK2 });
    }
    return data;
}

function computeVbar(inverseData, baseCorners, p) {
    const V_step = new Array(baseCorners.length).fill(0);
    for (const id of inverseData) {
        const t = id.tail_time, li = bisectLeft(baseCorners, t);
        for (let i = 0; i < id.same_col_dts.length; i++) {
            const dt = id.same_col_dts[i];
            const spikeV = p.inv_amplitude * Math.exp(-Math.pow(dt / p.inv_tau, p.inv_power));
            const dipV = p.guide_depth * Math.exp(-Math.pow((dt - p.guide_center) / p.guide_width, 2));
            const vVal = (spikeV - dipV) * p.inverse_same_col_bonus;
            const ri = bisectLeft(baseCorners, t + dt);
            for (let j = li; j < ri && j < baseCorners.length; j++) V_step[j] += vVal;
        }
        for (let i = 0; i < id.cross_col_dts.length; i++) {
            const dt = id.cross_col_dts[i];
            const cw = coordWeight(id.cross_col_k1[i], id.cross_col_k2[i]);
            const crossV = -p.guide_depth * p.cross_guide_scale * cw *
                Math.exp(-Math.pow((dt - p.guide_center) / p.guide_width, 2));
            const ri = bisectLeft(baseCorners, t + dt);
            for (let j = li; j < ri && j < baseCorners.length; j++) V_step[j] += crossV;
        }
    }
    return smoothOnCorners(baseCorners, V_step, 500, 0.001, 'sum');
}

function computeCandKs(K, noteSeq, keyUsage, baseCorners) {
    const noteHitTimes = noteSeq.map(n => n.start).sort((a, b) => a - b);
    const C_step = new Array(baseCorners.length);
    for (let i = 0; i < baseCorners.length; i++)
        C_step[i] = bisectLeft(noteHitTimes, baseCorners[i] + 500) - bisectLeft(noteHitTimes, baseCorners[i] - 500);
    const Ks_step = new Array(baseCorners.length);
    for (let i = 0; i < baseCorners.length; i++) {
        let c = 0;
        for (let k = 0; k < K; k++) if (keyUsage[k][i]) c++;
        Ks_step[i] = Math.max(c, 1);
    }
    return { C_step, Ks_step };
}

// ============================================================
// D FORMULA (Total — unchanged structure)
// ============================================================
function computeD(allCorners, baseCorners, Abar, Jbar, Xbar, Pbar, Rbar, C_step, Ks_step, Sbar, Vbar, p) {
    const scaledAbar = Abar.map(v => v * p.Abar_scale);
    const C_arr = stepInterp(allCorners, baseCorners, C_step);
    const Ks_arr = stepInterp(allCorners, baseCorners, Ks_step);

    // Make a copy of Rbar for Vbar modification
    const RbarMod = Rbar.slice();
    if (Vbar && p.alpha_V > 1e-9) {
        for (let i = 0; i < RbarMod.length; i++) {
            const m = Math.max(0.15, Math.min(1.0 + p.alpha_V * Vbar[i], 3.0));
            RbarMod[i] *= m;
        }
    }

    const D_all = new Array(allCorners.length);
    const S_all = new Array(allCorners.length);
    const T_all = new Array(allCorners.length);

    for (let i = 0; i < allCorners.length; i++) {
        const ab = scaledAbar[i], jb = Jbar[i], xb = Xbar[i], pb = Pbar[i], rb = RbarMod[i];
        const ca = C_arr[i], ks = Ks_arr[i];

        let streamBranch = p.alpha_P * pb + p.alpha_R * rb / (ca + p.alpha_C);
        if (Sbar && p.alpha_S > 0) streamBranch += p.alpha_S * (Sbar[i] || 0);

        const w2 = 1.0 - p.S_w1;
        const jackBranch = Math.pow(ab, 3 / ks) * Math.min(jb, 8 + 0.85 * jb);
        const streamFull = Math.pow(ab, 2 / 3) * streamBranch;

        const S = Math.pow(p.S_w1 * Math.pow(jackBranch, p.S_p) + w2 * Math.pow(streamFull, p.S_p), 1.0 / p.S_p);
        const T = (Math.pow(ab, 3 / ks) * xb) / (xb + S + 1);
        const D = p.D_beta1 * Math.pow(S, 0.5) * Math.pow(T, 1.5) + p.D_beta2 * S;

        D_all[i] = D;
        S_all[i] = S;
        T_all[i] = T;
    }

    return { D_all, S_all, T_all, C_arr, Ks_arr };
}

// ============================================================
// RC D FORMULA (Rbar=Sbar=Vbar=0, RC-specific params)
// ============================================================
function computeD_rc(allCorners, baseCorners, Abar, Jbar, Xbar, Pbar, C_step, Ks_step, p) {
    // Use Total model params (not RC-specific) so RC sub-model is consistent with Total SR.
    // For pure RC maps: Rbar/Sbar/Vbar are ~0, so D_rc ≈ D_total → rcRating ≈ Total SR.
    // For HB/Mix: Rbar/Sbar/Vbar are explicitly zeroed, giving a "RC-only" D on masked sections.
    const scaledAbar = Abar.map(v => v * p.Abar_scale);
    const C_arr = stepInterp(allCorners, baseCorners, C_step);
    const Ks_arr = stepInterp(allCorners, baseCorners, Ks_step);

    const S_w1 = p.S_w1, S_p = p.S_p;
    const alpha_P = p.alpha_P;
    const D_beta1 = p.D_beta1, D_beta2 = p.D_beta2;

    const D_all = new Array(allCorners.length);
    const S_all = new Array(allCorners.length);
    const T_all = new Array(allCorners.length);

    for (let i = 0; i < allCorners.length; i++) {
        const ab = scaledAbar[i], jb = Jbar[i], xb = Xbar[i], pb = Pbar[i];
        const ca = C_arr[i], ks = Ks_arr[i];

        // RC: only Pbar (no Rbar/Sbar/Vbar)
        const streamBranch = alpha_P * pb;

        const w2 = 1.0 - S_w1;
        const jackBranch = Math.pow(ab, 3 / ks) * Math.min(jb, 8 + 0.85 * jb);
        const streamFull = Math.pow(ab, 2 / 3) * streamBranch;

        const S = Math.pow(S_w1 * Math.pow(jackBranch, S_p) + w2 * Math.pow(streamFull, S_p), 1.0 / S_p);
        const T = (Math.pow(ab, 3 / ks) * xb) / (xb + S + 1);
        const D = D_beta1 * Math.pow(S, 0.5) * Math.pow(T, 1.5) + D_beta2 * S;

        D_all[i] = D;
        S_all[i] = S;
        T_all[i] = T;
    }

    return { D_all, S_all, T_all, C_arr, Ks_arr };
}

// ============================================================
// SIGMOID AGGREGATION (replaces percentile-based computeSR)
// ============================================================

function segmentByDifficulty(D_all, weights, nSegments) {
    const n = D_all.length;
    if (n === 0) return { D_seg: [], w_seg: [] };

    // Sort by difficulty
    const indices = D_all.map((_, i) => i).sort((a, b) => D_all[a] - D_all[b]);
    const D_sorted = indices.map(i => D_all[i]);
    const w_sorted = indices.map(i => weights[i]);

    // Cumulative weight
    const cum_w = new Array(n);
    cum_w[0] = w_sorted[0];
    for (let i = 1; i < n; i++) cum_w[i] = cum_w[i - 1] + w_sorted[i];
    const total_w = cum_w[n - 1];

    if (total_w <= 0) {
        const mean = D_all.reduce((a, b) => a + b, 0) / n;
        return { D_seg: [mean], w_seg: [1.0] };
    }

    const nSeg = Math.min(nSegments, n);
    const D_seg = new Array(nSeg);
    const w_seg = new Array(nSeg);

    for (let i = 0; i < nSeg; i++) {
        const lo = total_w * i / nSeg;
        const hi = total_w * (i + 1) / nSeg;
        let start = bisectRight(cum_w, lo);
        let end = bisectRight(cum_w, hi);
        if (end <= start) end = start + 1;
        start = Math.max(0, Math.min(start, n - 1));
        end = Math.max(start + 1, Math.min(end, n));

        let bucket_w = 0, bucket_wd = 0;
        for (let j = start; j < end; j++) {
            bucket_w += w_sorted[j];
            bucket_wd += w_sorted[j] * D_sorted[j];
        }
        w_seg[i] = bucket_w;
        D_seg[i] = bucket_w > 0 ? bucket_wd / bucket_w : (D_sorted[start] + D_sorted[end - 1]) / 2;
    }

    return { D_seg, w_seg };
}

function sigmoidSum(D_seg, w_seg, D_target, k, C) {
    let total = 0;
    for (let i = 0; i < D_seg.length; i++) {
        const arg = Math.max(-50, Math.min(k * (D_seg[i] - D_target), 50));
        total += w_seg[i] / (C + Math.exp(arg));
    }
    return total;
}

function solveDBisection(D_seg, w_seg, k, C, gamma, highWeightPower, delta, tol, maxIter) {
    k = k || 0.5; C = C || 4.0; gamma = gamma || 0.2;
    highWeightPower = highWeightPower || 0; delta = delta || 5.0;
    tol = tol || 0.0001; maxIter = maxIter || 100;

    // Apply high-D weighting
    let w = w_seg;
    if (highWeightPower > 1e-9) {
        w = w_seg.map((wi, i) => wi * Math.pow(Math.max(D_seg[i], 0.01), highWeightPower));
    }

    const totalWeight = w.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) {
        if (D_seg.length === 0) return 0;
        return D_seg.reduce((a, b) => a + b, 0) / D_seg.length;
    }

    const target = totalWeight * gamma;

    let lo = Math.min(...D_seg) - delta;
    let hi = Math.max(...D_seg) + delta;

    // Check bounds
    const f_lo = sigmoidSum(D_seg, w, lo, k, C);
    const f_hi = sigmoidSum(D_seg, w, hi, k, C);

    if (f_lo >= target) return lo;
    if (f_hi <= target) return hi;

    let nIter = 0;
    while (hi - lo > tol && nIter < maxIter) {
        const mid = (lo + hi) / 2;
        const f_mid = sigmoidSum(D_seg, w, mid, k, C);
        if (f_mid < target) lo = mid;
        else hi = mid;
        nIter++;
    }

    return (lo + hi) / 2;
}

// ============================================================
// CORRECTION LAYER — 7 chart-level features
// ============================================================
function computeCorrectionFeatures(noteSeq, Jbar_base, Pbar_base) {
    const p = ENHANCED_PARAMS;
    const n = noteSeq.length;
    if (n < 2) return { speed: 0, burst: 0, chord: 0, pj: 1.5, hs: 0, lb: 0, fj: 0 };

    const times = new Float64Array(n);
    const cols = new Int32Array(n);
    for (let i = 0; i < n; i++) {
        times[i] = noteSeq[i].start;
        cols[i] = noteSeq[i].col;
    }
    const duration_s = Math.max((times[n - 1] - times[0]) / 1000.0, 1.0);

    // Consecutive diffs
    const nm1 = n - 1;
    const dt = new Float64Array(nm1);
    const dc = new Int32Array(nm1);
    for (let i = 0; i < nm1; i++) {
        dt[i] = times[i + 1] - times[i];
        dc[i] = Math.abs(cols[i + 1] - cols[i]);
    }

    const feat = {};

    // speed: fast cross-hand notes/sec (dt < spd_dt && dc >= spd_dc)
    const spdDt = p.corr_spd_dt, spdDc = Math.round(p.corr_spd_dc);
    let speedCount = 0;
    for (let i = 0; i < nm1; i++) {
        if (dt[i] < spdDt && dc[i] >= spdDc) speedCount++;
    }
    feat.speed = speedCount / duration_s;

    // burst: triplet density/sec (times[j] - times[j-2] < bst_dt)
    const bstDt = p.corr_bst_dt;
    let burstCount = 0;
    for (let j = 2; j < n; j++) {
        if (times[j] - times[j - 2] < bstDt) burstCount++;
    }
    feat.burst = burstCount / duration_s;

    // chord: fraction of notes in >=ch_order simultaneous groups (2ms window)
    const chOrder = Math.round(p.corr_ch_order);
    let chordCount = 0;
    for (let j = 0; j < n; j++) {
        const t = times[j];
        let cnt = 1, k = j - 1;
        while (k >= 0 && Math.abs(times[k] - t) < 2) { cnt++; k--; }
        if (cnt >= chOrder) chordCount++;
    }
    feat.chord = chordCount / Math.max(n, 1);

    // pj: Pbar_mean / (Jbar_mean + 1)
    if (Jbar_base && Jbar_base.length > 0 && Pbar_base && Pbar_base.length > 0) {
        let jSum = 0, pSum = 0;
        for (let i = 0; i < Jbar_base.length; i++) jSum += Jbar_base[i];
        for (let i = 0; i < Pbar_base.length; i++) pSum += Pbar_base[i];
        feat.pj = (pSum / Pbar_base.length) / (jSum / Jbar_base.length + 1);
    } else {
        feat.pj = 1.5;
    }

    // hs: hand-switch density (cross-hand with dt < hs_dt)
    const hsDt = p.corr_hs_dt;
    let hsCount = 0;
    for (let i = 0; i < nm1; i++) {
        const crossHand = (cols[i] < 3 && cols[i + 1] >= 4) || (cols[i] >= 4 && cols[i + 1] < 3);
        if (crossHand && dt[i] < hsDt) hsCount++;
    }
    feat.hs = hsCount / duration_s;

    // lb: 4-note burst density (times[j] - times[j-3] < lb_dt)
    const lbDt = p.corr_lb_dt;
    let lbCount = 0;
    for (let j = 3; j < n; j++) {
        if (times[j] - times[j - 3] < lbDt) lbCount++;
    }
    feat.lb = lbCount / duration_s;

    // fj: same-column fast jack density (dc==0 && dt < fj_dt)
    const fjDt = p.corr_fj_dt;
    let fjCount = 0;
    for (let i = 0; i < nm1; i++) {
        if (dc[i] === 0 && dt[i] < fjDt) fjCount++;
    }
    feat.fj = fjCount / duration_s;

    return feat;
}

function computeSR_sigmoid(allCorners, C_arr, D_all, totalNotes, p, correction) {
    const n = allCorners.length;

    // Effective weights: C_arr * gap width
    const gaps = new Array(n);
    gaps[0] = (allCorners[1] - allCorners[0]) / 2.0;
    gaps[n - 1] = (allCorners[n - 1] - allCorners[n - 2]) / 2.0;
    for (let i = 1; i < n - 1; i++) gaps[i] = (allCorners[i + 1] - allCorners[i - 1]) / 2.0;

    const eff_w = new Array(n);
    for (let i = 0; i < n; i++) eff_w[i] = C_arr[i] * gaps[i];

    // D calibration
    const calib_a = p.calib_a || 1.0, calib_b = p.calib_b || 0.0;
    let D_calib = D_all;
    if (Math.abs(calib_a - 1.0) > 1e-12 || Math.abs(calib_b) > 1e-12) {
        D_calib = D_all.map(d => calib_a * d + calib_b);
    }

    // Apply correction layer (scalar shift to D_calib)
    const corr = correction || 0;
    if (Math.abs(corr) > 1e-12) {
        D_calib = D_calib.map(d => Math.max(d + corr, 0.01));
    }

    // Segment by difficulty
    const nSeg = p.agg_n_segments || 30;
    const { D_seg, w_seg } = segmentByDifficulty(D_calib, eff_w, nSeg);

    if (D_seg.length === 0) return 0;

    // Solve for D via bisection
    const D_solved = solveDBisection(
        D_seg, w_seg,
        p.agg_sigmoid_k, p.agg_sigmoid_C, p.agg_sigmoid_ref_gamma,
        0.0, 5.0, 0.0001, 100
    );

    let SR = D_solved;

    // Post-processing: use correction-layer params when correction is active
    const useCorrPost = Math.abs(corr) > 1e-12 && p.note_norm_N0_corr !== undefined;
    const N0 = useCorrPost ? p.note_norm_N0_corr : p.note_norm_N0;
    const thresh = useCorrPost ? p.rescale_threshold_corr : p.rescale_threshold;
    const div = useCorrPost ? p.rescale_divisor_corr : p.rescale_divisor;
    const scale = useCorrPost ? p.global_scale_corr : p.global_scale;

    // Note count normalization
    SR *= totalNotes / (totalNotes + N0);

    // Rescale high SR
    if (SR > thresh) {
        SR = thresh + (SR - thresh) / div;
    }

    // Global scale
    SR *= scale;

    return SR;
}

/**
 * Compute RC-only SR using RC-specific D formula + RC sigmoid params.
 * Uses precomputed Jbar/Pbar/Xbar/Abar (all from cache), Rbar=Sbar=Vbar=0.
 */
function computeRC_SR(allCorners, baseCorners, JbarAll, XbarAll, PbarAll, AbarAll,
                      C_step, Ks_step, totalNotes, p, correction) {
    // Compute RC D (uses Total model params, Rbar=Sbar=Vbar=0)
    const { D_all, C_arr } = computeD_rc(
        allCorners, baseCorners, AbarAll, JbarAll, XbarAll, PbarAll,
        C_step, Ks_step, p
    );

    // Use Total model calibration (not RC-specific)
    const calib_a = p.calib_a || 1.0, calib_b = p.calib_b || 0.0;
    let D_calib = D_all;
    if (Math.abs(calib_a - 1.0) > 1e-12 || Math.abs(calib_b) > 1e-12) {
        D_calib = D_all.map(d => calib_a * d + calib_b);
    }

    // Apply correction layer (same scalar shift as Total, since features are chart-level)
    const corr = correction || 0;
    if (Math.abs(corr) > 1e-12) {
        D_calib = D_calib.map(d => Math.max(d + corr, 0.01));
    }

    // Effective weights
    const n = allCorners.length;
    const gaps = new Array(n);
    gaps[0] = (allCorners[1] - allCorners[0]) / 2.0;
    gaps[n - 1] = (allCorners[n - 1] - allCorners[n - 2]) / 2.0;
    for (let i = 1; i < n - 1; i++) gaps[i] = (allCorners[i + 1] - allCorners[i - 1]) / 2.0;
    const eff_w = new Array(n);
    for (let i = 0; i < n; i++) eff_w[i] = C_arr[i] * gaps[i];

    // Segment
    const nSeg = p.agg_n_segments || 30;
    const { D_seg, w_seg } = segmentByDifficulty(D_calib, eff_w, nSeg);

    if (D_seg.length === 0) return 0;

    // Use Total model sigmoid (not RC-specific)
    const D_solved = solveDBisection(
        D_seg, w_seg,
        p.agg_sigmoid_k, p.agg_sigmoid_C, p.agg_sigmoid_ref_gamma,
        0.0, 5.0, 0.0001, 100
    );

    let SR = D_solved;

    // Use Total model post-processing (correction-jointly-optimized params when correction active)
    const useCorrPost = Math.abs(corr) > 1e-12 && p.note_norm_N0_corr !== undefined;
    const N0 = useCorrPost ? p.note_norm_N0_corr : p.note_norm_N0;
    const thresh = useCorrPost ? p.rescale_threshold_corr : p.rescale_threshold;
    const div = useCorrPost ? p.rescale_divisor_corr : p.rescale_divisor;
    const scale = useCorrPost ? p.global_scale_corr : p.global_scale;

    SR *= totalNotes / (totalNotes + N0);
    if (SR > thresh) SR = thresh + (SR - thresh) / div;
    SR *= scale;

    return SR;
}

/**
 * Compute LN-masked SR — sigmoid aggregation over LN sections only.
 * D_all is masked so only LN-dense regions (lnMask=true) contribute weight.
 * This prevents hard RC sections from inflating the LN difficulty rating.
 */
function computeLNMaskedSR(allCorners, D_all, C_arr, lnMask, totalNotes, p) {
    const n = allCorners.length;

    // Only LN sections contribute weight (C_arr → 0 in RC sections)
    const C_ln = new Array(n);
    for (let i = 0; i < n; i++) C_ln[i] = lnMask[i] ? C_arr[i] : 0;

    const gaps = new Array(n);
    gaps[0] = (allCorners[1] - allCorners[0]) / 2.0;
    gaps[n - 1] = (allCorners[n - 1] - allCorners[n - 2]) / 2.0;
    for (let i = 1; i < n - 1; i++) gaps[i] = (allCorners[i + 1] - allCorners[i - 1]) / 2.0;

    const eff_w = new Array(n);
    for (let i = 0; i < n; i++) eff_w[i] = C_ln[i] * gaps[i];

    // LN-masked D calibration (separate params, default identity)
    const calib_a = p.calib_a_ln_masked || 1.0;
    const calib_b = p.calib_b_ln_masked || 0.0;
    let D_calib = D_all;
    if (Math.abs(calib_a - 1.0) > 1e-12 || Math.abs(calib_b) > 1e-12) {
        D_calib = new Array(n);
        for (let i = 0; i < n; i++) D_calib[i] = calib_a * D_all[i] + calib_b;
    }

    const nSeg = p.agg_n_segments || 30;
    const { D_seg, w_seg } = segmentByDifficulty(D_calib, eff_w, nSeg);

    const totalWeight = w_seg.reduce((a, b) => a + b, 0);
    if (D_seg.length === 0 || totalWeight <= 0) return 0;

    const D_solved = solveDBisection(
        D_seg, w_seg,
        p.agg_sigmoid_k, p.agg_sigmoid_C, p.agg_sigmoid_ref_gamma,
        0.0, 5.0, 0.0001, 100
    );

    let SR = D_solved;
    SR *= totalNotes / (totalNotes + p.note_norm_N0);

    if (SR > p.rescale_threshold) {
        SR = p.rescale_threshold + (SR - p.rescale_threshold) / p.rescale_divisor;
    }

    SR *= p.global_scale;

    return SR;
}

/**
 * Compute RC-section-masked SR — sigmoid aggregation over RC sections only.
 * Uses RC model D (treats LN heads as taps), but LN-section weights are zeroed.
 * This prevents LN-head-as-tap areas from being seen as "recovery" by the sigmoid,
 * which would otherwise underestimate RC difficulty on HB maps.
 */
function computeRCSectionSR(allCorners, rcD_all, C_arr_rc, rcMask, totalNotes, p, correction) {
    const n = allCorners.length;

    // Only RC sections contribute weight (C_arr → 0 in LN sections)
    const C_rc = new Array(n);
    for (let i = 0; i < n; i++) C_rc[i] = rcMask[i] ? C_arr_rc[i] : 0;

    const gaps = new Array(n);
    gaps[0] = (allCorners[1] - allCorners[0]) / 2.0;
    gaps[n - 1] = (allCorners[n - 1] - allCorners[n - 2]) / 2.0;
    for (let i = 1; i < n - 1; i++) gaps[i] = (allCorners[i + 1] - allCorners[i - 1]) / 2.0;

    const eff_w = new Array(n);
    for (let i = 0; i < n; i++) eff_w[i] = C_rc[i] * gaps[i];

    // Use Total model calibration (not RC-specific)
    const calib_a = p.calib_a || 1.0, calib_b = p.calib_b || 0.0;
    let D_calib = rcD_all;
    if (Math.abs(calib_a - 1.0) > 1e-12 || Math.abs(calib_b) > 1e-12) {
        D_calib = rcD_all.map(d => calib_a * d + calib_b);
    }

    // Apply correction layer (same scalar shift as Total)
    const corr = correction || 0;
    if (Math.abs(corr) > 1e-12) {
        D_calib = D_calib.map(d => Math.max(d + corr, 0.01));
    }

    const nSeg = p.agg_n_segments || 30;
    const { D_seg, w_seg } = segmentByDifficulty(D_calib, eff_w, nSeg);

    const totalWeight = w_seg.reduce((a, b) => a + b, 0);
    if (D_seg.length === 0 || totalWeight <= 0) return 0;

    // Use Total model sigmoid (not RC-specific)
    const D_solved = solveDBisection(
        D_seg, w_seg,
        p.agg_sigmoid_k, p.agg_sigmoid_C, p.agg_sigmoid_ref_gamma,
        0.0, 5.0, 0.0001, 100
    );

    let SR = D_solved;

    // Use Total model post-processing
    const useCorrPost = Math.abs(corr) > 1e-12 && p.note_norm_N0_corr !== undefined;
    const N0 = useCorrPost ? p.note_norm_N0_corr : p.note_norm_N0;
    const thresh = useCorrPost ? p.rescale_threshold_corr : p.rescale_threshold;
    const div = useCorrPost ? p.rescale_divisor_corr : p.rescale_divisor;
    const scale = useCorrPost ? p.global_scale_corr : p.global_scale;

    SR *= totalNotes / (totalNotes + N0);
    if (SR > thresh) SR = thresh + (SR - thresh) / div;
    SR *= scale;

    return SR;
}

// ============================================================
// MAIN CALCULATION
// ============================================================
function calculate(osuContent, speedRate) {
    const p = ENHANCED_PARAMS;
    const parsedData = parseOsuFile(osuContent);
    const data = preprocess(parsedData, speedRate);
    if (data.error) return { error: data.error };

    const { x, K, noteSeq, noteSeqByColumn, LNSeq, tailSeq,
            allCorners, baseCorners, A_corners, keyUsage, activeColumns, keyUsage400, LN_rep } = data;

    // Compute all components (same as before)
    const anchorArr = computeAnchor(K, keyUsage400, baseCorners);
    const { delta_ks, Jbar: JbarBase } = computeJbar(K, x, noteSeqByColumn, baseCorners,
        p.jack_aggregation_power, p.multi_jack_boost);
    const PbarBase = computePbar(K, x, noteSeq, LN_rep, anchorArr, baseCorners, p.stream_booster_scale);
    const Abar_A = computeAbar(K, delta_ks, activeColumns, A_corners, baseCorners);
    const AbarAll = interpValues(allCorners, A_corners, Abar_A);
    const { C_step, Ks_step } = computeCandKs(K, noteSeq, keyUsage, baseCorners);

    // Cross: Total model uses LN-ratio blended params (matching Python combine())
    // ln_ratio=0 → pure RC params, ln_ratio=1 → pure LN params
    const lnRatio = LNSeq.length / Math.max(noteSeq.length, 1);
    const distExpRC = p.cross_dist_exponent_rc !== undefined ? p.cross_dist_exponent_rc : (p.cross_dist_exponent || 1.0);
    const distExpLN = p.cross_dist_exponent_ln !== undefined ? p.cross_dist_exponent_ln : (p.cross_dist_exponent || 1.0);
    const penaltyRC = p.cross_same_hand_penalty_rc !== undefined ? p.cross_same_hand_penalty_rc : (p.cross_same_hand_penalty || 0.3);
    const penaltyLN = p.cross_same_hand_penalty_ln !== undefined ? p.cross_same_hand_penalty_ln : (p.cross_same_hand_penalty || 0.3);
    const blendedDistExp = distExpRC + (distExpLN - distExpRC) * lnRatio;
    const blendedPenalty = penaltyRC + (penaltyLN - penaltyRC) * lnRatio;
    const p_total = Object.assign({}, p, {
        cross_dist_exponent: blendedDistExp,
        cross_same_hand_penalty: blendedPenalty,
    });
    const XbarTotalBase = computeXbarEnhanced(K, x, noteSeqByColumn, activeColumns, baseCorners, p_total);

    // For RC model, use pure RC cross params
    const p_rc = Object.assign({}, p, {
        cross_dist_exponent: distExpRC,
        cross_same_hand_penalty: penaltyRC,
    });
    const XbarRCBase = (Math.abs(distExpRC - blendedDistExp) < 1e-6 &&
                         Math.abs(penaltyRC - blendedPenalty) < 1e-6)
        ? XbarTotalBase  // Reuse if params are same
        : computeXbarEnhanced(K, x, noteSeqByColumn, activeColumns, baseCorners, p_rc);

    const releaseData = precomputeReleaseData(K, x, noteSeqByColumn, tailSeq, noteSeq);
    const RbarBase = computeRbarEnhanced(releaseData, baseCorners, p);

    const shieldData = precomputeShieldData(K, noteSeqByColumn, LNSeq);
    const SbarBase = computeSbar(shieldData, baseCorners, p);

    const inverseData = precomputeInverseData(K, noteSeqByColumn, LNSeq);
    const VbarBase = computeVbar(inverseData, baseCorners, p);

    // Interpolate to allCorners
    const JbarAll = interpValues(allCorners, baseCorners, JbarBase);
    const XbarTotalAll = interpValues(allCorners, baseCorners, XbarTotalBase);
    const XbarRCAll = (XbarRCBase === XbarTotalBase) ? XbarTotalAll
        : interpValues(allCorners, baseCorners, XbarRCBase);
    const PbarAll = interpValues(allCorners, baseCorners, PbarBase);
    const RbarAll = interpValues(allCorners, baseCorners, RbarBase);
    const SbarAll = interpValues(allCorners, baseCorners, SbarBase);
    const VbarAll = interpValues(allCorners, baseCorners, VbarBase);

    // RC-Equivalent: Pbar without LN contribution (treat all LNs as taps)
    const LN_rep_zero = [LN_rep[0].slice(), LN_rep[1].slice().fill(0), LN_rep[2].slice().fill(0)];
    const PbarEquivBase = computePbar(K, x, noteSeq, LN_rep_zero, anchorArr, baseCorners, p.stream_booster_scale);
    const PbarEquivAll = interpValues(allCorners, baseCorners, PbarEquivBase);

    // Total D
    const { D_all, C_arr } = computeD(allCorners, baseCorners, AbarAll, JbarAll, XbarTotalAll,
        PbarAll, RbarAll, C_step, Ks_step, SbarAll, VbarAll, p);

    // RC-Equivalent D: total formula with Rbar=Sbar=Vbar=0, Pbar without LN
    const zerosAll = new Array(allCorners.length).fill(0);
    const { D_all: rcEquivD_all } = computeD(allCorners, baseCorners, AbarAll, JbarAll, XbarTotalAll,
        PbarEquivAll, zerosAll, C_step, Ks_step, zerosAll, zerosAll, p);

    // Total notes with LN bonus
    let totalNotes = noteSeq.length;
    let totalNotes_raw = noteSeq.length;  // without LN bonus
    for (const ln of LNSeq) {
        const d = Math.min(ln.end - ln.start, 1000);
        totalNotes += 0.5 * d / 200;
    }

    // ===== Correction Layer =====
    const corrFeat = computeCorrectionFeatures(noteSeq, JbarBase, PbarBase);
    const correction =
        (p.correction_chord  || 0) * (corrFeat.chord  || 0) +
        (p.correction_fj     || 0) * (corrFeat.fj     || 0) +
        (p.correction_hs     || 0) * (corrFeat.hs     || 0) +
        (p.correction_lb     || 0) * (corrFeat.lb     || 0) +
        (p.correction_speed  || 0) * (corrFeat.speed  || 0) +
        (p.correction_burst  || 0) * (corrFeat.burst  || 0) +
        (p.correction_pj     || 0) * (corrFeat.pj     || 0);

    // ===== Total SR (sigmoid + correction layer) =====
    const rating = computeSR_sigmoid(allCorners, C_arr, D_all, totalNotes, p, correction);

    // ===== RC SR (RC model, uses Total pipeline + correction) =====
    const rcRating = computeRC_SR(allCorners, baseCorners, JbarAll, XbarRCAll, PbarAll, AbarAll,
        C_step, Ks_step, totalNotes, p, correction);

    // ===== RC-Equivalent SR (total algo, no LNs) =====
    const rcEquivRating = computeSR_sigmoid(allCorners, C_arr, rcEquivD_all, totalNotes_raw, p);

    // ===== LN SR = Total SR (validated: MAE=0.22 vs LN labels) =====
    const lnRating = rating;

    // ===== Section masks (for HB RC/LN section ratings) =====
    const { lnMask, rcMask } = computeHBSectionMasks(allCorners, LN_rep);

    // ===== LN-Masked SR (LN sections only, for HB display) =====
    const lnMaskedRating = computeLNMaskedSR(allCorners, D_all, C_arr, lnMask, totalNotes, p);

    // ===== RC-Section-Masked SR (RC sections only, prevents LN recovery underestimation) =====
    const rcDresult = computeD_rc(allCorners, baseCorners, AbarAll, JbarAll, XbarRCAll, PbarAll,
        C_step, Ks_step, p);
    const rcSectionRating = computeRCSectionSR(allCorners, rcDresult.D_all, rcDresult.C_arr,
        rcMask, totalNotes, p, correction);

    // Classifier features (lnRatio already computed above for cross-param blending)
    const avgLNDur = LNSeq.length > 0
        ? LNSeq.reduce((s, ln) => s + Math.max(ln.end - ln.start, 0), 0) / LNSeq.length
        : 0;
    const maxLNDensity = LN_rep[2].length > 0 ? Math.max(...LN_rep[2]) : 0;
    const rcSrRatio = rating > 0.01 ? rcRating / rating : 1.0;
    const lnContrib = rating > 0.01 ? Math.max(0, rating - rcRating) / rating : 0;

    // Difficulty-weighted top-20% features
    let topLnContrib = lnContrib, topRcSrRatio = rcSrRatio;
    if (D_all && D_all.length > 10) {
        const sorted = [...D_all].sort((a, b) => a - b);
        const threshold = sorted[Math.floor(sorted.length * 0.8)];
        const topMask = D_all.map(d => d >= threshold);
        const topCount = topMask.filter(Boolean).length;
        if (topCount > 0 && LN_rep[2].length > 0) {
            // Top-20% LN contribution
            let topLnTotal = 0, topRcTotal = 0;
            for (let i = 0; i < allCorners.length; i++) {
                if (topMask[i]) {
                    if (lnMask[i]) topLnTotal += D_all[i];
                    else topRcTotal += D_all[i];
                }
            }
            const topTotal = topLnTotal + topRcTotal;
            topLnContrib = topTotal > 0 ? topLnTotal / topTotal : lnContrib;
            topRcSrRatio = topTotal > 0 ? topRcTotal / topTotal : rcSrRatio;
        }
    }

    // LN duration ratio: total LN hold time / total map duration
    let lnDurationRatio = 0;
    if (noteSeq.length > 1) {
        const mapDur = (noteSeq[noteSeq.length - 1].start - noteSeq[0].start) / 1000;
        let totalLnHold = 0;
        for (const ln of LNSeq) totalLnHold += Math.max(ln.end - ln.start, 0);
        lnDurationRatio = mapDur > 0 ? (totalLnHold / 1000) / mapDur : 0;
    }

    // LN difficulty dominance: LN section D max / total D max
    let lnDifficultyDominance = 0;
    if (D_all && D_all.length > 0 && LN_rep[2].length > 0) {
        const maxD = Math.max(...D_all);
        let maxLnD = 0;
        for (let i = 0; i < D_all.length; i++) {
            if (lnMask[i] && D_all[i] > maxLnD) maxLnD = D_all[i];
        }
        lnDifficultyDominance = maxD > 0 ? maxLnD / maxD - rcSrRatio : 0;
    }

    // D_all diagnostics (for parity testing)
    let D_sum = 0, D_min = Infinity, D_max = -Infinity;
    for (let i = 0; i < D_all.length; i++) {
        D_sum += D_all[i];
        if (D_all[i] < D_min) D_min = D_all[i];
        if (D_all[i] > D_max) D_max = D_all[i];
    }
    const D_mean = D_all.length > 0 ? D_sum / D_all.length : 0;

    return {
        rating, rcRating, rcEquivRating, lnRating, lnMaskedRating, rcSectionRating,
        correction, corrFeat,
        _diag: {
            D_mean, D_min, D_max, D_len: D_all.length,
            noteSeq_len: noteSeq.length, LNSeq_len: LNSeq.length,
            allCorners_len: allCorners.length, baseCorners_len: baseCorners.length,
            totalNotes,
            calib_a: p.calib_a, calib_b: p.calib_b,
        },
        params: { total_notes: totalNotes, n_raw: noteSeq.length, n_LN: LNSeq.length, K, od: data.od },
        noteSeq, LNSeq, allCorners, D_all, Jbar: JbarAll, Xbar: XbarTotalAll, Pbar: PbarAll, Rbar: RbarAll,
        rcD_all: rcDresult.D_all, rcEquivD_all,
        LN_rep, lnMask, rcMask,  // HB section masks (reused in processMap)
        features: { lnRatio, avgLNDur, maxLNDensity, rcSrRatio, lnContrib,
                     topLnContrib, topRcSrRatio, lnDurationRatio, lnDifficultyDominance },
    };
}

// ============================================================
// POST-PROCESSING: Section Data, Skills, Tags
// ============================================================
// ============================================================
// HB SECTION DETECTION
// ============================================================
function computeHBSectionMasks(allCorners, LN_rep) {
    // Interpolate LN_rep density to allCorners grid
    const lnDensity = stepInterp(allCorners, LN_rep[0], LN_rep[2]);

    // Find LN-dense regions (LN_rep > 0 means active LN)
    const lnMask = new Array(allCorners.length).fill(false);
    const rcMask = new Array(allCorners.length).fill(false);

    for (let i = 0; i < allCorners.length; i++) {
        lnMask[i] = lnDensity[i] > 0.01;
        rcMask[i] = !lnMask[i];
    }

    // Dilate: expand LN regions by 500ms to avoid boundary artifacts
    const dilated = lnMask.slice();
    const step = 50;  // ~50ms dilution steps
    const steps = Math.floor(500 / step);
    const idxStep = Math.max(1, Math.floor(allCorners.length * step / (allCorners[allCorners.length - 1] - allCorners[0] || 1)));
    for (let s = 0; s < steps; s++) {
        const prev = dilated.slice();
        for (let i = 1; i < allCorners.length - 1; i++) {
            if (prev[i - 1] || prev[i + 1]) dilated[i] = true;
        }
    }

    return { lnMask: dilated, rcMask: dilated.map(v => !v) };
}

function computeSectionData(allCorners, D_all, firstTime, lastTime) {
    if (!allCorners || allCorners.length === 0) return { sectionDifficulties: [], sectionTimes: [] };
    const sectionTimes = [], sectionDifficulties = [];
    if (firstTime == null) firstTime = allCorners[0];
    if (lastTime == null) lastTime = allCorners[allCorners.length - 1];
    let sectionStart = firstTime;
    while (sectionStart < lastTime) {
        const sectionEnd = sectionStart + SECTION_LENGTH;
        let maxD = 0;
        for (let i = 0; i < allCorners.length; i++)
            if (allCorners[i] >= sectionStart && allCorners[i] < sectionEnd && D_all[i] > maxD) maxD = D_all[i];
        sectionTimes.push(sectionStart);
        sectionDifficulties.push(maxD);
        sectionStart = sectionEnd;
    }
    return { sectionDifficulties, sectionTimes };
}

function computeSkillRatings(Jbar, Xbar, Pbar, Rbar) {
    function aggregate(arr) {
        if (!arr || arr.length === 0) return 0;
        let sum = 0; const n = arr.length;
        for (let i = 0; i < n; i++) if (arr[i] > 0) sum += arr[i];
        const avg = sum / Math.max(n, 1);
        const peaks = [...arr].filter(v => v > 0).sort((a, b) => b - a);
        let weighted = 0, weight = 1;
        for (let i = 0; i < Math.min(peaks.length, 20); i++) { weighted += peaks[i] * weight; weight *= DECAY_WEIGHT; }
        return weighted * RATING_MULTIPLIER * 0.5 + avg * 0.1;
    }
    return {
        stream: Math.max(0, aggregate(Pbar)), jack: Math.max(0, aggregate(Jbar)),
        tech: Math.max(0, aggregate(Xbar)),
        chordjack: Math.max(0, aggregate(Jbar.map((v, i) => v * (1 - Math.exp(-Pbar[i] / 5))))),
        release: Math.max(0, aggregate(Rbar)),
    };
}

/**
 * ML-based pattern tag classifier (auto-generated).
 * 14 tags, 26 features, per-tag decision trees.
 * Asymmetric loss: FN > FP (weight=3x).
 * Replaces the old rule-based computePatternTags().
 */

const DECAY_WEIGHT_TAG = 0.88;
const RATING_MULTIPLIER_TAG = 0.090;

function _tagAggregate(arr) {
    if (!arr || arr.length === 0) return 0;
    let sum = 0; const n = arr.length;
    for (let i = 0; i < n; i++) if (arr[i] > 0) sum += arr[i];
    const avg = sum / Math.max(n, 1);
    const peaks = [...arr].filter(v => v > 0).sort((a, b) => b - a);
    let weighted = 0, weight = 1;
    for (let i = 0; i < Math.min(peaks.length, 20); i++) {
        weighted += peaks[i] * weight;
        weight *= DECAY_WEIGHT_TAG;
    }
    return weighted * RATING_MULTIPLIER_TAG * 0.5 + avg * 0.1;
}

function _tagChordOverlap(noteSeq) {
    const chords = [];
    let currentCols = new Set(), currentTime = null;
    for (const note of noteSeq) {
        if (currentTime === null || note.start - currentTime > 30) {
            if (currentCols.size > 0) chords.push(new Set(currentCols));
            currentCols = new Set([note.col || note[0]]);
            currentTime = note.start || note[1];
        } else {
            currentCols.add(note.col || note[0]);
        }
    }
    if (currentCols.size > 0) chords.push(new Set(currentCols));
    if (chords.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < chords.length; i++) {
        let intersect = 0;
        for (const col of chords[i]) if (chords[i - 1].has(col)) intersect++;
        const union = new Set([...chords[i], ...chords[i - 1]]).size;
        if (union > 0) total += intersect / union;
    }
    return total / (chords.length - 1);
}

function _tagDistStats(arr) {
    if (!arr || arr.length === 0) return { mean: 0, std: 0, p50: 0, p75: 0, p90: 0, max: 0 };
    const n = arr.length;
    const sorted = [...arr].sort((a, b) => a - b);
    let sum = 0, sumSq = 0;
    for (const v of arr) { sum += v; sumSq += v * v; }
    const mean = sum / n;
    const std = Math.sqrt(sumSq / n - mean * mean);
    const idx = (p) => Math.max(0, Math.min(n - 1, Math.round(p * (n - 1) / 100)));
    return {
        mean, std,
        p50: sorted[idx(50)],
        p75: sorted[idx(75)],
        p90: sorted[idx(90)],
        max: sorted[n - 1],
    };
}

function _tagDistStatsTop(arr, topMask) {
    if (!arr || arr.length === 0) return _tagDistStats(null);
    if (!topMask || topMask.length !== arr.length) return _tagDistStats(arr);
    const filtered = arr.filter((_, i) => topMask[i]);
    return filtered.length > 0 ? _tagDistStats(filtered) : _tagDistStats(null);
}

function extractTagFeatures(Jbar, Xbar, Pbar, Rbar, noteSeq, LNSeq, D_all) {
    const nTotal = noteSeq.length;
    const nLn = LNSeq.length;
    const lnRatio = nLn / Math.max(nTotal, 1);

    let avgLnDur = 0;
    if (nLn > 0) {
        let sum = 0;
        for (const ln of LNSeq) sum += Math.max((ln.end - ln.start), 0);
        avgLnDur = sum / nLn;
    }

    let nps = 0;
    if (nTotal > 1) {
        const dur = (noteSeq[nTotal - 1].start - noteSeq[0].start) / 1000;
        nps = nTotal / Math.max(dur, 1);
    }

    const avgChordOverlap = _tagChordOverlap(noteSeq);

    // Skill fractions (exact match with computeSkillRatings)
    const streamRaw = _tagAggregate(Pbar);
    const jackRaw = _tagAggregate(Jbar);
    const techRaw = _tagAggregate(Xbar);
    const cjArr = Jbar.map((v, i) => v * (1 - Math.exp(-Pbar[i] / 5)));
    const chordjackRaw = _tagAggregate(cjArr);
    const releaseRaw = _tagAggregate(Rbar);

    const totalSkill = streamRaw + jackRaw + techRaw + chordjackRaw + releaseRaw;
    const streamFrac = totalSkill > 0 ? streamRaw / totalSkill : 0;
    const jackFrac = totalSkill > 0 ? jackRaw / totalSkill : 0;
    const techFrac = totalSkill > 0 ? techRaw / totalSkill : 0;
    const chordjackFrac = totalSkill > 0 ? chordjackRaw / totalSkill : 0;
    const releaseFrac = totalSkill > 0 ? releaseRaw / totalSkill : 0;

    // Distribution stats (overall)
    const pStats = _tagDistStats(Pbar);
    const jStats = _tagDistStats(Jbar);
    const xStats = _tagDistStats(Xbar);
    const rStats = _tagDistStats(Rbar);

    // Top-20% difficulty mask (focus on hardest sections)
    let topMask = null;
    if (D_all && D_all.length > 10) {
        const sorted = [...D_all].sort((a, b) => a - b);
        const threshold = sorted[Math.floor(sorted.length * 0.8)];
        topMask = D_all.map(d => d >= threshold);
    }

    const pTop = _tagDistStatsTop(Pbar, topMask);
    const jTop = _tagDistStatsTop(Jbar, topMask);
    const xTop = _tagDistStatsTop(Xbar, topMask);
    const rTop = _tagDistStatsTop(Rbar, topMask);

    const rcSrRatio = 1.0 - releaseFrac;
    const lnContrib = releaseFrac;

    return {
        streamFrac, jackFrac, techFrac, chordjackFrac, releaseFrac,
        avgChordOverlap, nps, lnRatio, avgLnDur,
        pbarMean: pStats.mean, pbarStd: pStats.std,
        pbarP50: pStats.p50, pbarP90: pStats.p90, pbarMax: pStats.max,
        jbarMean: jStats.mean, jbarStd: jStats.std,
        jbarP90: jStats.p90, jbarMax: jStats.max,
        xbarMean: xStats.mean, xbarStd: xStats.std, xbarP90: xStats.p90,
        rbarMean: rStats.mean, rbarStd: rStats.std, rbarP90: rStats.p90,
        rcSrRatio, lnContrib,
        // Top-20% difficulty features
        topPbarMean: pTop.mean, topPbarP90: pTop.p90, topPbarMax: pTop.max,
        topJbarMean: jTop.mean, topJbarP90: jTop.p90, topJbarMax: jTop.max,
        topXbarMean: xTop.mean, topXbarP90: xTop.p90,
        topRbarMean: rTop.mean, topRbarP90: rTop.p90,
    };
}

// ============================================================
// ML TAG CLASSIFIER — Auto-generated per-tag decision trees
// 14 tags (incl. RC Mix, LN Mix), 36 features, per-tag trees.
// Equal FP/FN weight. Difficulty-weighted features (top-20% D(t)).
// n_samples: 265, Exact match: 44.2%, Avg extra: 0.53, Avg missing: 0.17
// ============================================================

function _predictTag_Chordjack(feat) {
  if (feat.avgChordOverlap <= 0.143685) {
    if (feat.avgChordOverlap <= 0.095748) {
      if (feat.topJbarP90 <= 42.181309) {
        if (feat.avgLnDur <= 1520.700012) {
          return 0.000000;
        } else {
          return 0.083333;
        }
      } else {
        return 0.333333;
      }
    } else {
      if (feat.rbarP90 <= 1.721825) {
        if (feat.avgChordOverlap <= 0.128886) {
          return 1.000000;
        } else {
          return 0.500000;
        }
      } else {
        return 0.000000;
      }
    }
  } else {
    if (feat.xbarStd <= 2.035738) {
      if (feat.topPbarMax <= 31.072963) {
        return 0.333333;
      } else {
        return 0.000000;
      }
    } else {
      return 1.000000;
    }
  }
}

function _predictTag_Coordination(feat) {
  if (feat.topRbarP90 <= 4.601707) {
    return 0.000000;
  } else {
    if (feat.avgChordOverlap <= 0.094565) {
      if (feat.pbarMax <= 38.042315) {
        if (feat.pbarP50 <= 22.109717) {
          return 0.000000;
        } else {
          return 0.400000;
        }
      } else {
        if (feat.rbarStd <= 1.925046) {
          return 0.000000;
        } else {
          return 0.400000;
        }
      }
    } else {
      if (feat.topRbarP90 <= 6.211373) {
        return 1.000000;
      } else {
        if (feat.rbarP90 <= 6.388634) {
          return 0.000000;
        } else {
          return 0.666667;
        }
      }
    }
  }
}

function _predictTag_Dense_Chordstream(feat) {
  if (feat.techFrac <= 0.211069) {
    if (feat.topPbarMax <= 23.179231) {
      if (feat.topJbarP90 <= 12.117770) {
        return 1.000000;
      } else {
        return 0.333333;
      }
    } else {
      if (feat.pbarStd <= 4.501233) {
        if (feat.techFrac <= 0.167237) {
          return 0.000000;
        } else {
          return 0.148148;
        }
      } else {
        return 0.000000;
      }
    }
  } else {
    if (feat.nps <= 26.888781) {
      if (feat.pbarP50 <= 16.459879) {
        return 1.000000;
      } else {
        if (feat.avgChordOverlap <= 0.060464) {
          return 0.407407;
        } else {
          return 0.000000;
        }
      }
    } else {
      if (feat.topPbarP90 <= 45.798162) {
        if (feat.avgChordOverlap <= 0.018127) {
          return 0.333333;
        } else {
          return 1.000000;
        }
      } else {
        return 0.000000;
      }
    }
  }
}

function _predictTag_Density(feat) {
  if (feat.rbarMean <= 2.676811) {
    return 0.000000;
  } else {
    if (feat.lnRatio <= 0.397131) {
      return 1.000000;
    } else {
      if (feat.avgLnDur <= 291.869278) {
        if (feat.jbarStd <= 5.052872) {
          return 0.379310;
        } else {
          return 0.000000;
        }
      } else {
        return 0.000000;
      }
    }
  }
}

function _predictTag_Fast_Chordstream(feat) {
  if (feat.techFrac <= 0.205766) {
    if (feat.pbarStd <= 3.133945) {
      if (feat.avgChordOverlap <= 0.023610) {
        return 0.666667;
      } else {
        return 0.000000;
      }
    } else {
      if (feat.avgLnDur <= 1090.500000) {
        return 0.000000;
      } else {
        if (feat.pbarStd <= 4.064734) {
          return 0.333333;
        } else {
          return 0.000000;
        }
      }
    }
  } else {
    if (feat.topRbarP90 <= 0.346156) {
      if (feat.jbarP90 <= 31.316128) {
        if (feat.streamFrac <= 0.317356) {
          return 0.000000;
        } else {
          return 0.193548;
        }
      } else {
        return 0.400000;
      }
    } else {
      return 0.600000;
    }
  }
}

function _predictTag_Inverse(feat) {
  if (feat.lnRatio <= 0.977794) {
    if (feat.nps <= 8.375918) {
      if (feat.topRbarMean <= 3.859288) {
        return 1.000000;
      } else {
        return 0.000000;
      }
    } else {
      if (feat.pbarMean <= 39.608927) {
        if (feat.pbarMean <= 33.529957) {
          return 0.000000;
        } else {
          return 0.050000;
        }
      } else {
        return 0.333333;
      }
    }
  } else {
    if (feat.topRbarMean <= 5.340877) {
      return 1.000000;
    } else {
      return 0.000000;
    }
  }
}

function _predictTag_LN_Mix(feat) {
  if (feat.rbarStd <= 0.996521) {
    if (feat.rbarMean <= 4.503310) {
      return 0.000000;
    } else {
      return 0.333333;
    }
  } else {
    if (feat.xbarStd <= 1.784965) {
      if (feat.pbarMean <= 15.820693) {
        if (feat.rbarMean <= 3.071551) {
          return 0.666667;
        } else {
          return 0.000000;
        }
      } else {
        return 0.000000;
      }
    } else {
      if (feat.topJbarMean <= 11.019084) {
        if (feat.rbarP90 <= 6.505721) {
          return 1.000000;
        } else {
          return 0.500000;
        }
      } else {
        if (feat.pbarP50 <= 28.582686) {
          return 0.055556;
        } else {
          return 0.511628;
        }
      }
    }
  }
}

function _predictTag_Minijack(feat) {
  if (feat.pbarStd <= 2.511311) {
    return 0.666667;
  } else {
    if (feat.avgChordOverlap <= 0.082721) {
      return 0.000000;
    } else {
      if (feat.techFrac <= 0.200435) {
        if (feat.avgChordOverlap <= 0.091582) {
          return 0.166667;
        } else {
          return 0.000000;
        }
      } else {
        if (feat.nps <= 19.811023) {
          return 0.666667;
        } else {
          return 0.111111;
        }
      }
    }
  }
}

function _predictTag_RC_Mix(feat) {
  if (feat.streamFrac <= 0.292649) {
    if (feat.avgChordOverlap <= 0.102825) {
      if (feat.jbarMax <= 33.700195) {
        if (feat.nps <= 18.392252) {
          return 0.666667;
        } else {
          return 0.000000;
        }
      } else {
        if (feat.rbarP90 <= 0.292782) {
          return 0.818182;
        } else {
          return 0.333333;
        }
      }
    } else {
      return 0.000000;
    }
  } else {
    if (feat.topRbarMean <= 2.044410) {
      if (feat.lnRatio <= 0.001044) {
        if (feat.nps <= 18.013649) {
          return 0.190476;
        } else {
          return 0.015385;
        }
      } else {
        if (feat.rbarMean <= 0.139635) {
          return 1.000000;
        } else {
          return 0.222222;
        }
      }
    } else {
      return 0.000000;
    }
  }
}

function _predictTag_Release(feat) {
  if (feat.topRbarMean <= 5.998488) {
    if (feat.topJbarMean <= 1.933147) {
      return 1.000000;
    } else {
      if (feat.jbarMax <= 7.315037) {
        return 0.333333;
      } else {
        if (feat.nps <= 55.725218) {
          return 0.008584;
        } else {
          return 0.333333;
        }
      }
    }
  } else {
    if (feat.releaseFrac <= 0.097595) {
      return 0.333333;
    } else {
      if (feat.lnRatio <= 0.640393) {
        return 0.666667;
      } else {
        return 1.000000;
      }
    }
  }
}

function _predictTag_Speed(feat) {
  if (feat.avgChordOverlap <= 0.017391) {
    if (feat.pbarStd <= 3.895566) {
      if (feat.streamFrac <= 0.367162) {
        return 0.000000;
      } else {
        return 0.666667;
      }
    } else {
      if (feat.jackFrac <= 0.216687) {
        if (feat.pbarStd <= 5.613053) {
          return 1.000000;
        } else {
          return 0.000000;
        }
      } else {
        return 1.000000;
      }
    }
  } else {
    if (feat.techFrac <= 0.244940) {
      if (feat.topRbarMean <= 0.548972) {
        if (feat.chordjackFrac <= 0.244021) {
          return 0.171875;
        } else {
          return 0.000000;
        }
      } else {
        return 0.000000;
      }
    } else {
      return 0.666667;
    }
  }
}

function _predictTag_Tech(feat) {
  if (feat.releaseFrac <= 0.036732) {
    if (feat.pbarP50 <= 21.510951) {
      if (feat.topPbarMean <= 24.602554) {
        if (feat.lnRatio <= 0.002112) {
          return 0.212766;
        } else {
          return 1.000000;
        }
      } else {
        if (feat.topPbarMean <= 26.767851) {
          return 1.000000;
        } else {
          return 0.666667;
        }
      }
    } else {
      if (feat.avgChordOverlap <= 0.077665) {
        if (feat.xbarMean <= 20.474854) {
          return 0.000000;
        } else {
          return 0.214286;
        }
      } else {
        if (feat.jbarStd <= 4.856178) {
          return 0.571429;
        } else {
          return 0.000000;
        }
      }
    }
  } else {
    return 0.000000;
  }
}

function _predictTag_Technical(feat) {
  if (feat.nps <= 33.652042) {
    if (feat.rbarMean <= 3.488430) {
      return 0.000000;
    } else {
      if (feat.avgLnDur <= 177.094902) {
        return 1.000000;
      } else {
        if (feat.topRbarP90 <= 4.997600) {
          return 0.333333;
        } else {
          return 0.000000;
        }
      }
    }
  } else {
    if (feat.pbarMean <= 30.029175) {
      if (feat.topPbarP90 <= 35.618196) {
        return 0.333333;
      } else {
        return 1.000000;
      }
    } else {
      if (feat.rbarP90 <= 6.978027) {
        if (feat.avgChordOverlap <= 0.105569) {
          return 0.000000;
        } else {
          return 0.333333;
        }
      } else {
        if (feat.topRbarP90 <= 6.788892) {
          return 1.000000;
        } else {
          return 0.000000;
        }
      }
    }
  }
}

function _predictTag_Vibro(feat) {
  if (feat.pbarStd <= 2.511311) {
    return 0.666667;
  } else {
    if (feat.jackFrac <= 0.284392) {
      if (feat.chordjackFrac <= 0.264973) {
        return 0.000000;
      } else {
        if (feat.jackFrac <= 0.273251) {
          return 0.333333;
        } else {
          return 0.000000;
        }
      }
    } else {
      if (feat.topPbarMean <= 22.610747) {
        return 0.666667;
      } else {
        return 0.000000;
      }
    }
  }
}


/**
 * ML-based pattern tag classifier with Mix dual pathway.
 *
 * Channel 1 (direct): Per-tag decision trees including RC Mix / LN Mix.
 * Channel 2 (synthesis): >=3 same-category individual tags -> Mix.
 * Both channels operate independently; either can trigger Mix output.
 * HB maps always output ["Hybrid"].
 * Fallback: if no tag passes threshold, the highest-probability individual tag
 *   from the applicable category is returned (guarantees at least one tag).
 *
 * Tag ordering by importance (left-to-right in Excel): first tag is primary.
 */
function computePatternTagsML(feat, mapType) {
    // HB maps: always "Hybrid"
    if (mapType === 'HB') return ['Hybrid'];

    const RC_TAGS = new Set(['Chordjack', 'Dense Chordstream', 'Fast Chordstream',
                              'Minijack', 'Speed', 'Tech', 'Vibro', 'RC Mix']);
    const LN_TAGS = new Set(['Coordination', 'Density', 'Inverse', 'Release', 'Technical', 'LN Mix']);

    // Collect all individual tag predictions with scores
    const rawScored = [];
    function _addTag(name, score, threshold) {
        rawScored.push({name: name, score: score, threshold: threshold});
    }
    _addTag('Chordjack',        _predictTag_Chordjack(feat), 0.28);
    _addTag('Coordination',     _predictTag_Coordination(feat), 0.28);
    _addTag('Dense Chordstream',_predictTag_Dense_Chordstream(feat), 0.28);
    _addTag('Density',          _predictTag_Density(feat), 0.28);
    _addTag('Fast Chordstream', _predictTag_Fast_Chordstream(feat), 0.34);
    _addTag('Inverse',          _predictTag_Inverse(feat), 0.28);
    _addTag('LN Mix',           _predictTag_LN_Mix(feat), 0.28);
    _addTag('Minijack',         _predictTag_Minijack(feat), 0.28);
    _addTag('RC Mix',           _predictTag_RC_Mix(feat), 0.34);
    _addTag('Release',          _predictTag_Release(feat), 0.28);
    _addTag('Speed',            _predictTag_Speed(feat), 0.28);
    _addTag('Tech',             _predictTag_Tech(feat), 0.28);
    _addTag('Technical',        _predictTag_Technical(feat), 0.28);
    _addTag('Vibro',            _predictTag_Vibro(feat), 0.28);

    // Tags passing threshold
    const rawTags = rawScored.filter(function(t) { return t.score >= t.threshold; }).map(function(t) { return t.name; });

    // Filter by map type
    let filtered;
    if (mapType === 'RC') {
        filtered = rawTags.filter(function(t) { return RC_TAGS.has(t); });
    } else if (mapType === 'LN') {
        filtered = rawTags.filter(function(t) { return LN_TAGS.has(t); });
    } else {
        // Mix sort: keep all individual tags
        filtered = rawTags;
    }

    // Channel 2: synthesis — >=3 same-category individual tags -> Mix
    var rcIndividual = filtered.filter(function(t) {
        return RC_TAGS.has(t) && t !== 'RC Mix';
    });
    var lnIndividual = filtered.filter(function(t) {
        return LN_TAGS.has(t) && t !== 'LN Mix';
    });

    if (mapType === 'RC') {
        // Channel 1: direct RC Mix prediction already in filtered
        if (filtered.indexOf('RC Mix') >= 0) return ['RC Mix'];
        // Channel 2: >=3 RC individual tags -> RC Mix
        if (rcIndividual.length >= 3) return ['RC Mix'];
    } else if (mapType === 'LN') {
        // Channel 1: direct LN Mix prediction
        if (filtered.indexOf('LN Mix') >= 0) return ['LN Mix'];
        // Channel 2: >=3 LN individual tags -> LN Mix
        if (lnIndividual.length >= 3) return ['LN Mix'];
    } else {
        // Mix sort: keep all individual tags
        // If >=3 total individual tags -> "Hybrid"
        var allIndividual = rcIndividual.concat(lnIndividual);
        if (allIndividual.length >= 3) return ['Hybrid'];
    }

    // Fallback: ensure at least one tag — pick highest-probability individual tag
    // (exclude Mix synthesis tags from fallback — they're synthesis, not individual)
    if (filtered.length === 0) {
        var candidates;
        if (mapType === 'RC') {
            candidates = rawScored.filter(function(t) { return RC_TAGS.has(t.name) && t.name !== 'RC Mix'; });
        } else if (mapType === 'LN') {
            candidates = rawScored.filter(function(t) { return LN_TAGS.has(t.name) && t.name !== 'LN Mix'; });
        } else {
            candidates = rawScored.filter(function(t) { return t.name !== 'RC Mix' && t.name !== 'LN Mix'; });
        }
        if (candidates.length > 0) {
            candidates.sort(function(a, b) { return b.score - a.score; });
            filtered.push(candidates[0].name);
        }
    }

    return filtered;
}


function processMap(osuContent, mode, speedRate) {
    if (!mode) mode = 'full';
    if (!speedRate || speedRate <= 0) speedRate = 1.0;

    const result = calculate(osuContent, speedRate);
    if (result.error) return null;

    // Diagnostic: log intermediate values for parity testing
    if (result._diag) {
        console.log('[SPM Diag]', JSON.stringify(result._diag));
        console.log('[SPM Corr]', JSON.stringify(result.corrFeat), 'total:', result.correction.toFixed(6));
    }

    const { rating, rcRating, rcEquivRating, lnRating, lnMaskedRating, rcSectionRating,
            noteSeq, LNSeq, allCorners,
            D_all, rcD_all, rcEquivD_all, LN_rep, lnMask, features } = result;
    const firstNoteTime = noteSeq.length > 0 ? noteSeq[0].start : 0;
    const lastNoteTime = noteSeq.length > 0 ? noteSeq[noteSeq.length - 1].start : 0;

    // Sort classification (4-class tree: RC/LN/HB/Mix, 98.1% accuracy)
    let mapType = classifyMapSort(
        features.lnRatio, features.avgLNDur, features.maxLNDensity,
        features.rcSrRatio, features.lnContrib,
        features.topLnContrib, features.topRcSrRatio,
        features.lnDurationRatio, features.lnDifficultyDominance
    );

    // LN dominance override: if LN dominates map time or difficulty, force LN
    mapType = applyLNDominance(mapType, features.lnDurationRatio, features.lnDifficultyDominance);

    // Hybrid→LN reclassification: if RC sections are short/simple but LN dominates
    // rcEquivRating treats LN heads as taps globally → captures "tap difficulty" everywhere
    // rcSectionRating is RC sections only → actual RC difficulty
    // If RC sections contribute far less than their share, LN content dominates
    if (mapType === 'HB' && rcSectionRating > 0 && rcEquivRating > 0.01) {
        const rcSectionFraction = rcSectionRating / rcEquivRating;
        if (rcSectionFraction < 0.65 && features.lnRatio > 0.20) {
            mapType = 'LN';
        }
    }

    const skillRatings = computeSkillRatings(result.Jbar, result.Xbar, result.Pbar, result.Rbar);
    const isMix = (mapType === 'Mix');

    // Per-sort difficulty values
    let displayRcDan, displayLnDan, displayRcRating, displayLnRating;
    let rcSectionDiffs, lnSectionDiffs;
    let mainD_all = D_all;  // default main curve

    if (mapType === 'RC') {
        // RC maps: RC difficulty = Total SR (same as LN maps showing Total SR as LN difficulty)
        displayRcRating = rating;
        displayLnRating = LNSeq.length > 0 ? lnMaskedRating : null;
        displayRcDan = ratingToDanRC(rating);
        displayLnDan = LNSeq.length > 0 ? ratingToDanLN(lnMaskedRating) : null;
        rcSectionDiffs = computeSectionData(allCorners, rcD_all, firstNoteTime, lastNoteTime).sectionDifficulties;
        // Show total D as green curve if map has LNs
        if (LNSeq.length > 0) {
            const lnSectionD_RC = D_all.map((d, i) => lnMask[i] ? d : 0);
            lnSectionDiffs = computeSectionData(allCorners, lnSectionD_RC, firstNoteTime, lastNoteTime).sectionDifficulties;
        } else {
            lnSectionDiffs = null;
        }
    } else if (mapType === 'LN') {
        // LN maps: RC-equiv D as RC curve (LN heads treated as taps, full curve, no mask)
        displayRcRating = rcEquivRating;
        displayLnRating = rating;
        displayRcDan = ratingToDanRC(rcEquivRating);
        displayLnDan = ratingToDanLN(rating);

        // RC curve = RC-equiv D (smooth, full — no section-mask jumps)
        const rcEquivSection = computeSectionData(allCorners, rcEquivD_all, firstNoteTime, lastNoteTime);
        rcSectionDiffs = rcEquivSection.sectionDifficulties;
        // Green curve = Total D masked to LN sections (near 0 in RC sections)
        const lnSectionD_LN = D_all.map((d, i) => lnMask[i] ? d : 0);
        lnSectionDiffs = computeSectionData(allCorners, lnSectionD_LN, firstNoteTime, lastNoteTime).sectionDifficulties;
    } else if (mapType === 'HB') {
        // HB maps: LN difficulty uses LN-masked model (LN sections only, not inflated by RC)
        // RC difficulty uses RC-section-masked model (RC sections only, LN heads not treated as recovery)
        displayRcRating = rcSectionRating;
        displayLnRating = lnMaskedRating;
        displayRcDan = ratingToDanRC(rcSectionRating);
        displayLnDan = ratingToDanLN(lnMaskedRating);

        // RC curve = RC-equiv D (smooth, full — no section-mask jumps)
        const rcEquivSection = computeSectionData(allCorners, rcEquivD_all, firstNoteTime, lastNoteTime);
        rcSectionDiffs = rcEquivSection.sectionDifficulties;
        // Green curve = Total D masked to LN sections (near 0 in RC sections)
        const lnSectionD_HB = D_all.map((d, i) => lnMask[i] ? d : 0);
        lnSectionDiffs = computeSectionData(allCorners, lnSectionD_HB, firstNoteTime, lastNoteTime).sectionDifficulties;
    } else {
        // Mix maps: show both RC and LN difficulty (same treatment as HB)
        displayRcRating = rcSectionRating;
        displayLnRating = lnMaskedRating;
        displayRcDan = ratingToDanRC(rcSectionRating);
        displayLnDan = ratingToDanLN(lnMaskedRating);

        // RC curve = RC-equiv D (smooth, full)
        const rcEquivSectionMix = computeSectionData(allCorners, rcEquivD_all, firstNoteTime, lastNoteTime);
        rcSectionDiffs = rcEquivSectionMix.sectionDifficulties;
        // Green curve = Total D masked to LN sections
        const lnSectionD_Mix = D_all.map((d, i) => lnMask[i] ? d : 0);
        lnSectionDiffs = computeSectionData(allCorners, lnSectionD_Mix, firstNoteTime, lastNoteTime).sectionDifficulties;
    }

    const { sectionDifficulties, sectionTimes } = computeSectionData(allCorners, D_all, firstNoteTime, lastNoteTime);
    // Use ML-based tag prediction (replaces old rule-based computePatternTags)
    const tagFeatures = extractTagFeatures(result.Jbar, result.Xbar, result.Pbar, result.Rbar, noteSeq, LNSeq, D_all);
    const patternTags = computePatternTagsML(tagFeatures, mapType);

    // Dan fields: total SR for RC maps, rcEquiv for LN, rcSection for HB/Mix
    const rcDan = (mapType === 'RC') ? ratingToDanRC(rating)
                : (mapType === 'LN') ? ratingToDanRC(rcEquivRating)
                : ratingToDanRC(rcSectionRating);  // HB / Mix
    const lnDan = (mapType === 'HB' || mapType === 'Mix' || (mapType === 'RC' && LNSeq.length > 0))
        ? ratingToDanLN(lnMaskedRating) : ratingToDanLN(rating);
    const totalDan = ratingToDanRC(rating);

    const output = {
        rating, rcRating: displayRcRating, lnRating: displayLnRating,
        rcDan, lnDan, totalDan, displayRcDan: displayRcDan, displayLnDan: displayLnDan,
        rcEquivRating,
        skillRatings, mapType, isMix, patternTags,
        noteCount: noteSeq.length, lnCount: LNSeq.length, lnRatio: features.lnRatio,
        od: result.params.od,
        sectionDifficulties, rcSectionDifficulties: rcSectionDiffs,
        lnSectionDifficulties: lnSectionDiffs, sectionTimes,
        firstNoteTime, lastNoteTime,
        features,
    };

    return output;
}
