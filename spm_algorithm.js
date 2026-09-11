/**
 * SPM Map Analyser — SPM Rating v1.0.0 + RC/LN sub-model (rc-ln-0.1.0)
 *
 * Overlay v1.0.1 additions (display-only; ratings unchanged):
 *   smoothCurve / curveSigmaBuckets / fillShortZeroRuns — curve smoothing
 *   computeSegmentStats — per-segment difficulty read off the display curve
 *   parseOsuMeta        — .osu header reader for the map summary line
 *   displayCurvesRC     — RC display curve on the calibrated star scale
 *
 * JavaScript port of:
 *   spm_rating_v1.0.0/core (parser, grid, model, components)
 *   rc_ln_model/rcln       (RC = de-LN chart's spm rating,
 *                           LN = LN-presence-weighted aggregation)
 *
 * Pipeline (single chart):
 *   parse → rows → struct → curves → D (combine)
 *     → aggregate(hold_w=true)  → postprocess → star   (spm)
 *     → Pbar recompute (ln_body_ms = 0), Rbar/Cbar = 0
 *       → aggregate(hold_w=false) → postprocess → rc   (RC)
 *     → g(t) presence weights on D
 *       → aggregate_ln → postprocess_ln         → ln   (LN)
 *
 * 4K charts are embedded into the 7-column frame (cols 1,2,4,5) so the
 * geometry logic is shared; 6K spreads columns evenly (0..6 with thumb).
 */

"use strict";

// ============================================================
// PARAMETERS — rc-ln-0.1.0 (spm-rating-1.0.0 + rcln group)
// ============================================================
const SPM_V1_PARAMS = {
  a_c:10.717498918905136,
  a_cb:4.0,
  a_cb_4k:11.357365798773392,
  a_cbc:10.310670820602846,
  a_p:0.457050886903945,
  a_p_4k:0.9671708233722217,
  a_r:59.95490931764664,
  a_r_4k:0.0,
  abar_active:0.02531712913365081,
  abar_c0:0.729854838334696,
  abar_c1:0.6730069593477146,
  abar_k:5.869324658227848,
  abar_mx:0.48830826958952744,
  abar_mx_thr:0.10636359112398937,
  abar_mx_w:0.45817570312814426,
  abar_scale:1.009862473386292,
  abar_thr_hi:0.09447563280275387,
  abar_thr_lo:0.01682395583948343,
  abar_weld:1.0,
  agg_C:5.7765188650680015,
  agg_gamma:0.3142734186203886,
  agg_gap_w:1.0873927743990874,
  agg_k:3.923290274033005,
  agg_mode:3.0,
  agg_nseg:30.0,
  agg_wc:1.145022164188944,
  aj:4.107175656089324,
  an_a0:0.17043768459177114,
  an_a1:0.34850214310770977,
  an_cubic:6.806495193662656,
  an_on_p:-0.3268168035336469,
  ap:0.8414094716039964,
  at:5.704296617075204,
  c_chord2:0.5,
  c_fj:1.1223698076832407,
  c_fj_4k:1.6384853006440867,
  c_ja:-0.001250731346377573,
  c_jc:0.13300526379892,
  c_jm:0.5136914244166452,
  c_s:0.4182231311873207,
  calib_a:1.0269058337789674,
  calib_b:0.506803040656835,
  cap_a:10.84672199638674,
  cap_b:0.7669642744433789,
  cb_holdtap:0.0,
  cb_holdtap_pow:1.0,
  cb_lock_pow:1.0,
  cb_lockanchor:0.0,
  cb_lockjack:0.0,
  cb_par:0.0,
  cb_shield:0.0,
  cb_shield_lock:0.8062,
  cb_shield_tau:56.24,
  cbv_churn:2.7804415879691047,
  cbv_churn_4k:0.0018149727082640878,
  cbv_holdage:3.4070743387277163,
  cbv_holdage_4k:0.0017655285135421454,
  cbv_holdtap:-1.0227403453455164,
  cbv_lock_pow:0.9662307730974806,
  cbv_lockanchor:1.3023578337914123,
  cbv_lockstack:0.5382064568725327,
  cbv_ls_1h_split:0.6669564049783417,
  cbv_ls_2h_split:0.628481439284875,
  cbv_ls_cross:0.6384201937709314,
  cbv_ls_sh_adj:0.9897529278156161,
  cbv_ls_sh_split:0.694320421215397,
  cbv_ov_1h_split:0.8912801595852077,
  cbv_ov_2h_split:0.628660224600841,
  cbv_ov_cap:2451.2427577736403,
  cbv_ov_cross:0.43216200109373926,
  cbv_ov_dt_max:1511.5378347371243,
  cbv_ov_sh_adj:1.2272220519138874,
  cbv_ov_sh_split:1.2153000673016874,
  cbv_overlap:0.9863986916717904,
  cbv_sh_dt_max:256.0406131304308,
  cbv_sh_ln_tau:145.443782024068,
  cbv_sh_ln_w:1.0790072249120857,
  cbv_sh_lock:1.0870780764260457,
  cbv_sh_tau:75.33463318028997,
  cbv_shield:1.1200999548581216,
  cbv_str_1h_split:0.5323308514011785,
  cbv_str_2h_split:0.17479688357773077,
  cbv_str_bal:1.141728630652899,
  cbv_str_cross:0.09922357503493356,
  cbv_str_h0:0.8793037998512705,
  cbv_str_h1:0.9113686383081036,
  cbv_str_h2:0.8557205717895041,
  cbv_str_h3:0.5028456653288493,
  cbv_str_maxd:2.048176307602251,
  cbv_str_sh_adj:0.19036255960279166,
  cbv_str_sh_split:0.9209759560022021,
  cbv_straddle:0.45854924271224995,
  cbv_w:1140.2267181326677,
  chord2_w:998.3068456460403,
  chord_tau_c:28.00006103515625,
  churn_event_rate:0.0,
  churn_sat:14.712127862753169,
  churn_w:1022.5551356347157,
  cj_norm:1.9757525590733565,
  cj_size_exp:1.0152415724691892,
  d_b1:1.4529112152056358,
  d_b2:0.4343400978218659,
  d_ds:0.5436886594030598,
  d_dt:1.3838263378115971,
  d_eye:0.0818717181241305,
  d_eye_4k:0.014013206098578592,
  d_read:0.0,
  d_read_4k:0.0,
  d_rec:0.78125,
  d_sh:-0.18851239465270642,
  env_ms:395.28032205483703,
  env_w:0.0033333333333333335,
  eye_tau:0.2,
  eye_w_ref:4000.0,
  eye_w_s:500.0,
  holdage_cap:0.9712508526439506,
  holdage_th:0.25073103183213685,
  hw_a:-4.833333333333334,
  hw_half:51.932695284873475,
  j_agg_pow:4.220517945172583,
  j_c1:0.11994305455701491,
  j_nerf_a:-2.266651862989442e-05,
  j_nerf_c:0.07443739821757173,
  j_nerf_off:0.15369105717534054,
  j_triple_gain:0.01930565188193239,
  j_triple_gain_4k:0.5356436393950172,
  j_triple_pow:1.005976267076746,
  j_triple_tau:135.97491132645644,
  ja_coord_exp:-9.268498548764114e-05,
  ja_gap_thr:253.00356478769385,
  ja_len_exp:1.0047596122947928,
  ja_len_floor:4.074244535477681,
  ja_norm:5.981391018054386,
  ln_calib_a:1.0,
  ln_calib_b:0.0,
  ln_eff_tail_ms:0.0,
  ln_g_exp:0.5,
  ln_gain:1.0,
  ln_mask_w:700.0,
  ln_n0:59.287573788026904,
  ln_note_level:0.0,
  mean_pow:6.465267031930503,
  mj_dilute:0.23679879956914796,
  mj_dilute_exp:0.9615171298692908,
  od_mult_ja:-1.0,
  od_mult_jc:-0.37109374999999944,
  od_mult_jm:0.7504257038347726,
  od_mult_p:1.1264849156945338,
  od_mult_r:1.064323992348447,
  od_mult_x:1.1651306736110387,
  out_a:0.699552129082087,
  out_b:-0.7830329139461331,
  p83_c:2.667686959362696,
  p93_c:2.505172683584436,
  p_boost:-1e-05,
  p_boost_hi:401.3793072521453,
  p_boost_lo:186.3466709871835,
  p_burst3:0.05749725160072005,
  p_burst4:0.041571581046874806,
  p_bv_max:1.023169107328028,
  p_chw2:0.6997350782823039,
  p_chw3:1.4710731528472405,
  p_chw4:0.82149995851254,
  p_chw5:0.8676070127257947,
  p_chw6:0.7474127532548505,
  p_chw7:1.03284160083206,
  p_lam2:0.006084380903675146,
  p_lam3:27.838293996532915,
  p_sat_a:10.690152688495372,
  p_sat_b:2.0349325289971496,
  p_scale:0.05862260059258437,
  p_v_norm:-0.005007331887365899,
  pp_div:1.617868498725467,
  pp_n0:59.287573788026904,
  pp_scale:1.0018513493936536,
  pp_thr:7.703696089438818,
  r_I_off:1.679847001293981,
  r_I_steep:3.8155719025104933,
  r_I_w:1.0611113361746765,
  r_ain0:1.402277599248007,
  r_ain1:0.8487725298502042,
  r_ain2:0.9889530992577216,
  r_ain3:1.4808396303580251,
  r_coord_e:0.6807568539174652,
  r_cw_cross:0.6899948287076584,
  r_cw_hand:0.42489506847315023,
  r_cw_same:0.9824539263359018,
  r_cw_thumb:0.3660514384223894,
  r_dt_max:5985.197267885601,
  r_dtr_min:0.015,
  r_lock:0.1775454477373913,
  r_order_pen:0.04982726415201301,
  r_order_tau:404.3308885287425,
  r_same_col:0.39414011153048933,
  r_seq:0.06596340070980779,
  r_short_red:0.10936100877002214,
  r_short_thr:440.09681230961536,
  r_sim_tau:10.0,
  r_simul:0.08534094291675064,
  r_soft_edges:1.0,
  r_straddle:-0.11540999412449468,
  r_tail:0.02898542543998874,
  r_tt:3.5417544104085192,
  read_clip_hi:1.5,
  read_clip_lo:0.5,
  read_n_win:16.0,
  read_tol:0.18,
  rec_half:0.4886690846205094,
  recov_w:989.9492044110127,
  recov_wl:21003.231873446508,
  s_p:1.2386750812693854,
  shd_w:1071.1117107781824,
  t_jack_mix:-0.35552500051452174,
  t_s_off:0.4819735114526039,
  use_cbar_v2:1.0,
  use_cbv_holdtap:1.0,
  use_cbv_lockanchor:1.0,
  use_cbv_lockstack:1.0,
  use_cbv_overlap:1.0,
  use_cbv_shield:1.0,
  use_cbv_straddle:1.0,
  use_eye:1.0,
  use_hb:1.0,
  use_read:0.0,
  w83:0.4815139944602175,
  w93:0.3605157897072774,
  w_a:60.794584215917084,
  w_cb:1716.856156378797,
  w_ja:0.0,
  w_jc:-0.4781249999999999,
  w_jm:842.9060364136417,
  w_p:806.2241563795392,
  w_r:1349.4219390385326,
  w_x:939.2935347185421,
  wmean:2.1613377064577026,
  x_amp:0.14776064699735425,
  x_cw0:0.1460113252705887,
  x_cw1:0.3535388218642357,
  x_cw2:0.3389326726836199,
  x_cw3:0.04918990446028124,
  x_din:-0.595854461464495,
  x_dir_in:0.2845860534263308,
  x_dir_out:-0.016749922744166222,
  x_dout:0.9858637139438629,
  x_fc_a:0.541953977488367,
  x_fc_floor:0.04577642898224647,
  x_fc_off:60.317605380705,
  x_fc_w:1.6631718126735746,
  x_jd_e:1.0765985987293114,
  x_jd_p:0.0456784859552089,
  x_jh_e:1.6812589290379765,
  x_jh_p:1.0261744953668672,
  x_jt:0.5592172136082718,
  x_jump_w:-0.852278272911138,
};

const K = 7;
const N_BOUND = 8;
const EPS = 1e-9;

// HAND: 0,1,2 left | 3 thumb | 4,5,6 right; AIN_GROUP: ring/mid/idx/thumb
const HAND = [0, 0, 0, 1, 2, 2, 2];
const AIN_GROUP = [0, 1, 2, 3, 2, 1, 0];
const BOUND_GROUP = [0, 1, 2, 3, 3, 2, 1, 0];
const SHIELD_LOOKBACK = 16;

// ============================================================
// small helpers (Float64Array-based numpy equivalents)
// ============================================================
function zeros(n) { return new Float64Array(n); }
function full(n, v) { const a = new Float64Array(n); a.fill(v); return a; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function makeParams(overrides) {
    return Object.assign({}, SPM_V1_PARAMS, overrides || {});
}

// od → hit leniency scalar
function odLeniency(od) {
    const q = (64.5 - Math.ceil(3.0 * od)) / 500.0;
    const x = 0.3 * Math.sqrt(Math.max(q, 1e-6));
    return Math.min(x, 0.6 * (x - 0.09) + 0.09);
}

// standard osu!mania OD window table + rate conversion (parser.rate_od)
const OD_WINDOWS = { 0: [22.0, 64.0, 97.0, 151.0, 188.0],
                     5: [19.5, 49.0, 82.0, 136.0, 172.0],
                     10: [16.0, 34.0, 67.0, 121.0, 151.0] };
function odWindows(od) {
    od = clamp(od, 0.0, 10.0);
    const loI = Math.floor(od / 5) * 5;
    const hiI = Math.min(loI + 5, 10);
    const t = (od - loI) / 5.0;
    const a = OD_WINDOWS[loI], b = OD_WINDOWS[hiI];
    return [0, 1, 2, 3, 4].map(k => a[k] + (b[k] - a[k]) * t);
}
function rateOd(od, rate) {
    if (rate <= 0) return od;
    const w = odWindows(od)[0];
    const target = w / rate;
    let lo = 0.0, hi = 10.0;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (odWindows(mid)[0] > target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

// ============================================================
// PARSER — minimal .osu parser (mirrors core/parser.py)
// 4K embeds cols 0..3 → 1,2,4,5; 6K/7K+ spread evenly over 7 tracks.
// ============================================================
function colFromX(x, keyCount) {
    let c = Math.floor(x * keyCount / 512.0);
    if (c < 0) c = 0;
    if (c > keyCount - 1) c = keyCount - 1;
    return c;
}
function colFromXFrame(x, keyCount) {
    const c = colFromX(x, keyCount);
    if (keyCount === 7) return c;
    if (keyCount === 4) return [1, 2, 4, 5][c];
    if (keyCount <= 1) return 3;
    return Math.round(c * 6.0 / (keyCount - 1));
}

function parseOsu(content, speedRate) {
    const rate = speedRate && speedRate > 0 ? speedRate : 1.0;
    const lines = content.split(/\r?\n/);
    let keyCount = 0, od = 5.0, section = "", inObjects = false;
    const hits = [];   // {typ, t, x, end}
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("//")) continue;
        if (line.startsWith("[")) {
            section = line.replace(/[\[\]]/g, "").trim();
            inObjects = section === "HitObjects";
            continue;
        }
        if (line.indexOf(":") >= 0 && !inObjects) {
            const ci = line.indexOf(":");
            const key = line.slice(0, ci).trim();
            const v = line.slice(ci + 1).trim();
            if (key === "Mode" && v !== "3") return null;
            if (key === "CircleSize") {
                const f = parseFloat(v);
                if (Number.isFinite(f)) keyCount = Math.round(f);
            } else if (key === "OverallDifficulty") {
                const f = parseFloat(v);
                if (Number.isFinite(f)) od = f;
            }
            continue;
        }
        if (inObjects) {
            const parts = line.split(",");
            if (parts.length < 4) continue;
            const x = parseFloat(parts[0]), t = parseFloat(parts[2]),
                  typ = parseInt(parts[3], 10);
            if (!Number.isFinite(x) || !Number.isFinite(t) ||
                !Number.isFinite(typ)) continue;
            let end = t;
            if (typ & 128 && parts.length > 5) {
                const e = parseFloat(parts[5].split(":")[0]);
                if (Number.isFinite(e)) end = e;
            }
            hits.push([typ, t, x, end]);
        }
    }
    if (hits.length === 0 || keyCount <= 0) return null;

    const effOd = rateOd(od, rate);
    hits.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    const n = hits.length;
    const time = new Float64Array(n);
    const col = new Int32Array(n);
    const lnEnd = new Float64Array(n);
    const isLn = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const [typ, t, x, end] = hits[i];
        time[i] = t / rate;
        col[i] = colFromXFrame(x, keyCount);
        if (typ & 128 && end > t) { lnEnd[i] = end / rate; isLn[i] = 1; }
        else lnEnd[i] = time[i];
    }
    // stable sort by time
    const order = time.map((v, i) => i)
        .sort((a, b) => time[a] - time[b] || col[a] - col[b]);
    const timeS = new Float64Array(n), colS = new Int32Array(n),
          lnEndS = new Float64Array(n), isLnS = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        timeS[i] = time[order[i]]; colS[i] = col[order[i]];
        lnEndS[i] = lnEnd[order[i]]; isLnS[i] = isLn[order[i]];
    }
    return { time: timeS, col: colS, lnEnd: lnEndS, isLn: isLnS,
             keyCount, od: effOd, rate, nNotes: n };
}

// ============================================================
// ROW GRID — distinct timestamps (mirrors core/batch.py single-chart path)
// ============================================================
function buildBatch(nt) {
    const n = nt.nNotes;
    if (n < 2) return null;
    // row of each note
    const rowOfNote = new Int32Array(n);
    let R = 0;
    rowOfNote[0] = 0;
    for (let i = 1; i < n; i++) {
        if (nt.time[i] !== nt.time[i - 1]) R++;
        rowOfNote[i] = R;
    }
    R++;
    const t = zeros(R);
    const mask = new Int32Array(R);
    const isLnRow = new Uint8Array(R);
    const lnEndRow = full(R, -1.0);
    for (let i = 0; i < n; i++) {
        const r = rowOfNote[i];
        t[r] = nt.time[i];
        mask[r] |= (1 << nt.col[i]);
        if (nt.isLn[i]) { isLnRow[r] = 1; if (nt.lnEnd[i] > lnEndRow[r]) lnEndRow[r] = nt.lnEnd[i]; }
    }
    const size = new Int32Array(R);
    for (let r = 0; r < R; r++) size[r] = popcount7(mask[r]);

    const b = {
        t, mask, size, n: R, isLn: isLnRow, lnEnd: lnEndRow,
        x: odLeniency(nt.od), od: nt.od, keyCount: nt.keyCount,
        nNotes: nt.nNotes,
        duration: R > 1 ? t[R - 1] - t[0] : 0.0,
        is4k: nt.keyCount === 4,
        rowOfNote,
    };
    // dt (sec) per row; last row of chart has dt_ms = 0 (no successor)
    const dtMs = zeros(R);                       // ms to NEXT row (0 at end)
    for (let r = 0; r < R - 1; r++) dtMs[r] = t[r + 1] - t[r];
    b.dtMs = dtMs;
    const dt = zeros(R);                         // seconds; 0 where no succ
    for (let r = 0; r < R - 1; r++) dt[r] = dtMs[r] / 1000.0;
    b.dt = dt;                                   // model.dt semantics: >0
    b.dtModel = new Float64Array(R);             // np.where(dt>0, dt, 1.0)
    for (let r = 0; r < R; r++) b.dtModel[r] = dt[r] > 0 ? dt[r] : 1.0;

    // per-column chains: row indices + gaps (sec)
    b.colPos = []; b.colG = []; b.colT = [];
    for (let k = 0; k < K; k++) {
        const pos = [];
        for (let r = 0; r < R; r++) if ((mask[r] >> k) & 1) pos.push(r);
        b.colPos.push(pos);
        const g = new Float64Array(Math.max(pos.length - 1, 0));
        for (let j = 0; j + 1 < pos.length; j++) g[j] = (t[pos[j + 1]] - t[pos[j]]) / 1000.0;
        b.colG.push(g);
        const tc = new Float64Array(pos.length);
        for (let j = 0; j < pos.length; j++) tc[j] = t[pos[j]];
        b.colT.push(tc);
    }
    // per-boundary chains (union of two neighbor columns) + effective col
    b.bndPos = []; b.bndG = []; b.bndE = [];
    for (let bd = 0; bd < N_BOUND; bd++) {
        const cols = [];
        if (bd - 1 >= 0) cols.push(bd - 1);
        if (bd < K) cols.push(bd);
        if (cols.length === 0) { b.bndPos.push([]); b.bndG.push(new Float64Array(0)); b.bndE.push(new Float64Array(0)); continue; }
        // merge sorted row lists
        let merged;
        if (cols.length === 1) merged = b.colPos[cols[0]];
        else {
            const A = b.colPos[cols[0]], B = b.colPos[cols[1]];
            merged = [];
            let ia = 0, ib = 0;
            while (ia < A.length && ib < B.length) {
                if (A[ia] === B[ib]) { merged.push(A[ia++]); ib++; }
                else if (A[ia] < B[ib]) merged.push(A[ia++]);
                else merged.push(B[ib++]);
            }
            while (ia < A.length) merged.push(A[ia++]);
            while (ib < B.length) merged.push(B[ib++]);
        }
        b.bndPos.push(merged);
        const g = new Float64Array(Math.max(merged.length - 1, 0));
        for (let j = 0; j + 1 < merged.length; j++) g[j] = (t[merged[j + 1]] - t[merged[j]]) / 1000.0;
        b.bndG.push(g);
        // effective column within {bd-1, bd}
        const e = new Float64Array(merged.length);
        for (let j = 0; j < merged.length; j++) {
            if (bd > 0 && bd < K) {
                const m = mask[merged[j]];
                const hasL = (m >> (bd - 1)) & 1, hasR = (m >> bd) & 1;
                e[j] = (hasL * (bd - 1) + hasR * bd) / Math.max(hasL + hasR, 1.0);
            } else {
                e[j] = clamp(bd, 0, K - 1);
            }
        }
        b.bndE.push(e);
    }
    // LN tails sorted by tail time
    const tailIdx = [];
    for (let i = 0; i < n; i++) if (nt.isLn[i]) tailIdx.push(i);
    tailIdx.sort((a, b2) => nt.lnEnd[a] - nt.lnEnd[b2] || a - b2);
    const m = tailIdx.length;
    const tailT = new Float64Array(m), tailH = new Float64Array(m),
          tailCol = new Int32Array(m), tailRow = new Int32Array(m);
    for (let j = 0; j < m; j++) {
        const i = tailIdx[j];
        tailT[j] = nt.lnEnd[i]; tailH[j] = nt.time[i];
        tailCol[j] = nt.col[i]; tailRow[j] = rowOfNote[i];
    }
    b.tailT = tailT; b.tailH = tailH; b.tailCol = tailCol; b.tailRow = tailRow;
    b.tailN = m;
    // next event after each tail: next head in the SAME column (python
    // build_batch), falling back to the next head in any column
    const nh = full(m, Infinity), nhc = new Int32Array(m).fill(-1);
    const ntTime = nt.time;
    for (let j = 0; j < m; j++) {
        const k = b.tailCol[j];
        const posK = b.colPos[k];
        // heads of column k after tailT[j]: first posK row with t > tailT[j]
        let lo = 0, hi = posK.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (b.t[posK[mid]] <= b.tailT[j]) lo = mid + 1; else hi = mid; }
        if (lo < posK.length) { nh[j] = b.t[posK[lo]]; nhc[j] = k; }
    }
    for (let j = 0; j < m; j++) {
        if (Number.isFinite(nh[j])) continue;
        let lo = 0, hi = nt.nNotes;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (ntTime[mid] <= b.tailT[j]) lo = mid + 1; else hi = mid; }
        if (lo < nt.nNotes) { nh[j] = ntTime[lo]; nhc[j] = nt.col[lo]; }
    }
    const nxtTail = full(m, Infinity), nxtTailCol = new Int32Array(m).fill(-1);
    for (let j = 0; j + 1 < m; j++) { nxtTail[j] = tailT[j + 1]; nxtTailCol[j] = tailCol[j + 1]; }
    const isTail = new Uint8Array(m);
    const nxt = zeros(m), nxtCol = new Int32Array(m);
    for (let j = 0; j < m; j++) {
        isTail[j] = nxtTail[j] <= nh[j] - 1e-9 ? 1 : 0;
        nxt[j] = isTail[j] ? nxtTail[j] : nh[j];
        nxtCol[j] = isTail[j] ? nxtTailCol[j] : nhc[j];
        if (!Number.isFinite(nxt[j])) nxtCol[j] = tailCol[j];
    }
    b.tailNxt = nxt; b.tailNxtCol = nxtCol; b.tailIsTail = isTail; b.tailNh = nh;
    b.tailNxtTail = nxtTail;   // raw next-tail time (python t["nt"]) for the sim_tau blend
    // tail → row (clipped to chart)
    const tailJ0 = new Int32Array(m);
    for (let j = 0; j < m; j++) {
        // searchsorted(t, tailT, side=left), clipped to [0, R-1]
        let lo = 0, hi = R;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] < tailT[j]) lo = mid + 1; else hi = mid; }
        tailJ0[j] = clamp(lo, 0, R - 1);
    }
    b.tailJ0 = tailJ0;

    // note-level arrays for jump channel / bursts
    b.noteT = nt.time; b.noteCol = nt.col; b.noteRow = rowOfNote;
    return b;
}

function popcount7(v) {
    let c = 0;
    while (v) { v &= v - 1; c++; }
    return c;
}

// ============================================================
// STRUCT — parameter-independent per-row arrays (core/model.build_struct)
// ============================================================
function buildStruct(b, p) {
    const n = b.n;
    const s = { b, n };

    // ---- column chains: dcol (per-column gap to next hit in that column)
    // python: dcol[k] = chain_scatter(...) which returns ZEROS outside the
    // chain (not the 1e9 fill — the full array is replaced)
    const dcol = [];   // [K][n]
    for (let k = 0; k < K; k++) {
        const arr = zeros(n);
        const pos = b.colPos[k], g = b.colG[k];
        // value for gap j holds on rows [pos[j], pos[j+1])
        for (let j = 0; j + 1 < pos.length; j++) {
            const v = Number.isFinite(g[j]) ? g[j] : 1e9;
            for (let r = pos[j]; r < pos[j + 1]; r++) arr[r] = v;
        }
        dcol.push(arr);
    }
    s.dcol = dcol;

    // ---- wmean operator cache (window → index arrays)
    s.wmeanOps = new Map();

    // ---- active columns + usage (+-300/800 ms counts)
    const act = [];   // [K] Uint8Array(n)
    const usage = []; // [K] Float64Array(n)
    for (let k = 0; k < K; k++) {
        const imp = zeros(n);
        const pos = b.colPos[k];
        for (let j = 0; j < pos.length; j++) imp[pos[j]] = 1.0;
        const c3 = wcount(b, s, imp, 300.0);
        const c8 = wcount(b, s, imp, 800.0);
        const a = new Uint8Array(n);
        for (let r = 0; r < n; r++) a[r] = c3[r] > 0 ? 1 : 0;
        act.push(a); usage.push(c8);
    }
    s.act = act; s.usage = usage;

    // ---- anchor_raw: column-imbalance walk (sorted desc usage ratios)
    // python: ratios over sorted-desc u for the 6 adjacent pairs; walk sums
    // u[j]*shape(ratio) for j with nz[j]; mx sums u[:-1] guarded by nz[:-1] —
    // i.e. every nonzero entry EXCEPT the 7th (smallest) sorted one when all
    // columns are used.
    const anchorRaw = zeros(n);
    {
        for (let r = 0; r < n; r++) {
            const nz = [];
            for (let k = 0; k < K; k++) if (usage[k][r] > 1e-6) nz.push(usage[k][r]);
            if (nz.length === 0) continue;
            nz.sort((a2, b2) => b2 - a2);
            let walk = 0, total = 0;
            for (let j = 0; j < K - 1; j++) {
                // j runs over the first 6 sorted entries
                if (j >= nz.length) break;
                total += nz[j];
                if (j + 1 < nz.length) {
                    const ratio = nz[j + 1] / Math.max(nz[j], EPS);
                    walk += nz[j] * Math.max(1.0 - 4.0 * Math.pow(0.5 - ratio, 2), 0.0);
                }
            }
            anchorRaw[r] = total > EPS ? walk / Math.max(total, EPS) : 0.0;
        }
    }
    s.anchorRaw = anchorRaw;

    // ---- LN held count + held mask (row-level legacy semantics: is_ln /
    //      ln_end are per-ROW aggregates, so a tap sharing a row with an LN
    //      head is held until the row's max tail, once per occupied column)
    const held = zeros(n);
    const heldmask = new Int32Array(n);
    const lnEff = p.ln_eff_tail_ms || 0.0;
    for (let k = 0; k < K; k++) {
        const pos = b.colPos[k];
        for (const r of pos) {
            if (!b.isLn[r]) continue;
            const h = b.t[r];
            const e = Math.max(b.lnEnd[r] - lnEff, h + 1.0);
            // rows r2 with t >= h+1 and t < e
            let lo = 0, hi = n;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (b.t[mid] < h + 1.0) lo = mid + 1; else hi = mid; }
            const j0 = lo;
            lo = 0; hi = n;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (b.t[mid] < e) lo = mid + 1; else hi = mid; }
            const j1 = lo;
            for (let r2 = j0; r2 < j1 && r2 < n; r2++) { held[r2] += 1.0; heldmask[r2] |= (1 << k); }
        }
    }
    s.held = held; s.heldmask = heldmask;
    const lnBodyMs = zeros(n);
    for (let r = 0; r < n; r++) lnBodyMs[r] = held[r] * b.dtMs[r];
    s.lnBodyMs = lnBodyMs;

    // ---- C (local note count +-500ms) + note impulse
    const noteImpulse = zeros(n);
    for (let i = 0; i < b.nNotes; i++) noteImpulse[b.rowOfNote[i]] += 1.0;
    s.noteImpulse = noteImpulse;
    s.C = wcount(b, s, noteImpulse, 1000.0);
    const Ks = zeros(n);
    for (let r = 0; r < n; r++) {
        let c = 0;
        for (let k = 0; k < K; k++) c += act[k][r];
        Ks[r] = Math.max(c, 1);
    }
    s.Ks = Ks;

    // ---- chord coupling operator (cached per tau)
    s.chordOps = new Map();

    // ---- per-column jack stats (built per compute_curves call)
    s.jackStatsCache = null;

    return s;
}

// ---- windowed count of impulse mass in +-W/2
function wcount(b, s, w, W) {
    // cached per (W + impulse-ref) — most callers pass s.noteImpulse
    s.wcountOps = s.wcountOps || new Map();
    const key = W + "|" + (w === s.noteImpulse ? "imp" : "other");
    const hit = s.wcountOps.get(key);
    if (hit && hit.w === w) return hit.out;
    const n = b.n, t = b.t;
    const cs = new Float64Array(n + 1);
    for (let r = 0; r < n; r++) cs[r + 1] = cs[r] + w[r];
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const zlo = clamp(t[r] - 0.5 * W, t[0], t[n - 1] + 1.0);
        const zhi = clamp(t[r] + 0.5 * W, t[0], t[n - 1] + 1.0);
        // searchsorted left
        let lo = 0, hi = n;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] < zlo) lo = mid + 1; else hi = mid; }
        const ilo = lo;
        lo = 0; hi = n;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] < zhi) lo = mid + 1; else hi = mid; }
        out[r] = cs[lo] - cs[ilo];
    }
    if (key.endsWith("imp")) s.wcountOps.set(key, { w, out });
    return out;
}

// ---- centred moving average of step function val over W ms
function wmean(b, s, val, W) {
    const n = b.n;
    if (n < 2) return Float64Array.from(val);
    const t = b.t;
    // cached interpolation operator
    let op = s.wmeanOps.get(W);
    if (!op) {
        // no tlo/thi subtleties for a single chart: clip to [t0, tlast]
        const jhi = new Int32Array(n), dhi = new Float64Array(n),
              jlo = new Int32Array(n), dlo = new Float64Array(n);
        for (let r = 0; r < n; r++) {
            const zhi = Math.min(t[r] + 0.5 * W, t[n - 1]);
            const zlo = Math.max(t[r] - 0.5 * W, t[0]);
            // searchsorted(tg, z, right) - 1, clipped [0, n-2]
            let lo = 0, hi = n;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] <= zhi) lo = mid + 1; else hi = mid; }
            jhi[r] = clamp(lo - 1, 0, n - 2);
            dhi[r] = zhi - t[jhi[r]];
            lo = 0; hi = n;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] <= zlo) lo = mid + 1; else hi = mid; }
            jlo[r] = clamp(lo - 1, 0, n - 2);
            dlo[r] = zlo - t[jlo[r]];
        }
        op = { jhi, dhi, jlo, dlo };
        s.wmeanOps.set(W, op);
    }
    // prefix integral I[r] = int from t[0] to t[r] of val (val holds on [t[r], t[r+1]))
    const inc = zeros(n);
    for (let r = 0; r < n - 1; r++) inc[r] = val[r] * (t[r + 1] - t[r]);
    const I = new Float64Array(n);
    for (let r = 1; r < n; r++) I[r] = I[r - 1] + inc[r - 1];
    const out = new Float64Array(n);
    const { jhi: JH, dhi: DH, jlo: JL, dlo: DL } = op;
    for (let r = 0; r < n; r++) {
        const hiV = I[JH[r]] + val[JH[r]] * DH[r];
        const loV = I[JL[r]] + val[JL[r]] * DL[r];
        let v = (hiV - loV) / W;
        if (!Number.isFinite(v) || v < 0) v = 0;
        out[r] = v;
    }
    return out;
}

// ---- step scatter: val[j] holds on rows [idx0[j], idx1[j])
function stepScatter(idx0, idx1, val, n) {
    const diff = zeros(n + 1);
    for (let j = 0; j < idx0.length; j++) {
        const a = Math.min(idx0[j], n), bI = Math.min(idx1[j], n);
        diff[a] += val[j];
        if (bI < n + 1) diff[bI] -= val[j];
    }
    const out = zeros(n);
    let acc = 0;
    for (let r = 0; r < n; r++) { acc += diff[r]; out[r] = acc; }
    return out;
}

// ---- chain scatter with same-chart validity mask
function chainScatter(pos, val, n, valid) {
    const idx0 = [], idx1 = [], v = [];
    for (let j = 0; j + 1 < pos.length; j++) {
        if (valid[j]) { idx0.push(pos[j]); idx1.push(pos[j + 1]); v.push(val[j]); }
    }
    return stepScatter(idx0, idx1, v, n);
}

// ---- triangular window count (graded effective chord size)
function triWindowCount(b, s, val, tauC) {
    const n = b.n, t = b.t;
    const cv = new Float64Array(n + 1);
    const cvt = new Float64Array(n + 1);
    for (let r = 0; r < n; r++) { cv[r + 1] = cv[r] + val[r]; cvt[r + 1] = cvt[r] + val[r] * t[r]; }
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const lo = clamp(t[r] - tauC, t[0], t[n - 1] + 1.0);
        const hi = clamp(t[r] + tauC, t[0], t[n - 1] + 1.0);
        let lo2 = 0, hi2 = n;
        while (lo2 < hi2) { const mid = (lo2 + hi2) >> 1; if (t[mid] < lo) lo2 = mid + 1; else hi2 = mid; }
        const jl = lo2;
        lo2 = 0; hi2 = n;
        while (lo2 < hi2) { const mid = (lo2 + hi2) >> 1; if (t[mid] < hi) lo2 = mid + 1; else hi2 = mid; }
        const jh = lo2;
        // left part: rows [jl, r) with |dt| = t[r]-t[r']
        const sl = cv[r] - cv[jl], slt = cvt[r] - cvt[jl];
        const left = sl - (t[r] * sl - slt) / tauC;
        // right part: rows [r, jh)
        const sr = cv[jh] - cv[r], srt = cvt[jh] - cvt[r];
        const right = sr - (srt - t[r] * sr) / tauC;
        let v = left + right;
        if (!Number.isFinite(v) || v < 0) v = 0;
        out[r] = v;
    }
    return out;
}

// ---- chord coupling (wf, wb) adjacent-row weights
function chordCoupling(b, s, tauC) {
    let got = s.chordOps.get(tauC);
    if (got) return got;
    const n = b.n;
    const wf = zeros(n), wb = zeros(n);
    for (let r = 0; r + 1 < n; r++) {
        const w = clamp(1.0 - b.dtMs[r] / tauC, 0.0, 1.0);
        wf[r] = w;
        wb[r + 1] = w;
    }
    got = [wf, wb];
    s.chordOps.set(tauC, got);
    return got;
}

// ---- run lengths of consecutive True
function runLengths(keep, len) {
    const out = new Float64Array(len);
    let start = -1;
    for (let i = 0; i < len; i++) {
        if (keep[i]) { if (start < 0) start = i; }
        else {
            if (start >= 0) { const L = i - start; for (let j = start; j < i; j++) out[j] = L; start = -1; }
        }
    }
    if (start >= 0) { const L = len - start; for (let j = start; j < len; j++) out[j] = L; }
    return out;
}

function edgeRamp(x, cutoff) {
    const x0 = 0.8 * cutoff;
    const u = clamp((x - x0) / Math.max(cutoff - x0, 1e-9), 0.0, 1.0);
    return 0.5 * (1.0 + Math.cos(Math.PI * u));
}

// ============================================================
// CURVES (core/model.compute_curves + components)
// ============================================================
function jackKernel(g, xk, p, odMult) {
    const x = Math.pow(xk, odMult);
    const gg = Math.max(g, 1e-4);
    let base = (1.0 / gg) * (1.0 / (gg + p.j_c1 * Math.pow(Math.max(x, 1e-6), 0.25)));
    if (p.j_nerf_a) {
        base *= (1.0 - p.j_nerf_a * Math.pow(p.j_nerf_off + Math.abs(gg - p.j_nerf_c), -4.0));
    }
    return base;
}

function buildJackStats(b, s, p) {
    if (s.jackStatsCache) return s.jackStatsCache;
    const n = b.n;
    const gapThr = p.ja_gap_thr / 1000.0;
    const h3Tau = Math.max(p.j_triple_tau, 1.0) / 1000.0;
    const tauC = p.chord_tau_c || 0.0;
    let attCum = null, wf = null, wb = null;
    if (tauC > 0.0) {
        [wf, wb] = chordCoupling(b, s, tauC);
        attCum = new Float64Array(n + 1);
        for (let r = 0; r < n; r++) attCum[r + 1] = attCum[r] + (wb[r] === 0.0 ? 1.0 : 0.0);
    }
    const g7 = p.j_triple_gain;
    const g4k = p.j_triple_gain_4k < 0.0 ? g7 : p.j_triple_gain_4k;
    const stats = [];
    for (let k = 0; k < K; k++) {
        const pos = b.colPos[k], g = b.colG[k];
        if (pos.length < 2) { stats.push(null); continue; }
        const M = pos.length - 1;
        const gs = new Float64Array(M), valid = new Uint8Array(M),
              nrows = new Float64Array(M), other = new Float64Array(M),
              load = new Float64Array(M), runlen = new Float64Array(M),
              trip = new Float64Array(M), tgain = new Float64Array(M),
              fj = new Float64Array(M), xr = new Float64Array(M), kern = new Float64Array(M);
        // full-row size cumsum: python total = cumsize[pos[j+1]] - cumsize[pos[j]]
        // = sizes of ALL rows in [pos[j], pos[j+1]) (other columns included)
        const rowSizeCum = new Float64Array(n + 1);
        for (let r2 = 0; r2 < n; r2++) rowSizeCum[r2 + 1] = rowSizeCum[r2] + b.size[r2];
        // run lengths: (g <= gap_thr) & valid
        const keepRun = new Uint8Array(M);
        for (let j = 0; j < M; j++) {
            const isValid = Number.isFinite(g[j]);
            valid[j] = isValid ? 1 : 0;
            gs[j] = Math.max(isValid ? g[j] : 1.0, 1e-4);
            // attCum[r] = number of attack rows (wb==0) in rows [0, r) —
            // matches python att_cum semantics; the pair window [pos[j], pos[j+1])
            // excludes both endpoints.
            nrows[j] = Math.max(attCum ? attCum[pos[j + 1]] - attCum[pos[j]] : pos[j + 1] - pos[j], 1.0);
            const total = rowSizeCum[pos[j + 1]] - rowSizeCum[pos[j]];
            other[j] = Math.max(total - 1.0, 0.0);
            load[j] = total / nrows[j];
            if (isValid && g[j] <= gapThr) keepRun[j] = 1;
            tgain[j] = b.is4k ? g4k : g7;
            if (isValid && gs[j] < 0.150) fj[j] = (1.0 / gs[j]) * Math.max(1.0 - gs[j] / 0.150, 0.0);
            xr[j] = Math.pow(b.x, 0); // placeholder, real x applied in kernel
            kern[j] = jackKernel(gs[j], b.x, p, p.od_mult_jm);
        }
        const rl = runLengths(keepRun, M);
        for (let j = 0; j < M; j++) runlen[j] = rl[j];
        // same-column triple: valid[j] & valid[j+1] & (pos[j+2]-pos[j]) span
        for (let j = 0; j + 2 < pos.length; j++) {
            if (valid[j] && valid[j + 1]) {
                const spanS = (b.t[pos[j + 2]] - b.t[pos[j]]) / 1000.0;
                trip[j] = Math.max(0.0, 1.0 - spanS / (2.0 * h3Tau));
            }
        }
        stats.push({ pos, gs, valid, nrows, other, load, runlen, trip, tgain, fj, kern });
    }
    s.jackStatsCache = { stats, attCum, wf, wb, tauC };
    return s.jackStatsCache;
}

function computeCurves(b, s, p) {
    const n = b.n;

    // ================================================== jack family
    const aggPow = Math.max(p.j_agg_pow, 0.25);
    const mjDilute = p.mj_dilute, mjExp = p.mj_dilute_exp;
    const cjExp = p.cj_size_exp, jaLenExp = p.ja_len_exp,
          jaCoordExp = p.ja_coord_exp, jaFloor = p.ja_len_floor;
    const cjNorm = Math.max(p.cj_norm, 1e-3), jaNorm = Math.max(p.ja_norm, 1e-3);
    const wJm = p.w_jm;
    const odJm = p.od_mult_jm;
    let wJc = p.w_jc; if (wJc <= 0) wJc = wJm;
    let wJa = p.w_ja; if (wJa <= 0) wJa = wJm;
    let odJc = p.od_mult_jc; if (odJc < 0) odJc = odJm;
    let odJa = p.od_mult_ja; if (odJa < 0) odJa = odJm;

    const js = buildJackStats(b, s, p);
    const stats = js.stats, attCum = js.attCum, wbG = js.wb, tauC = js.tauC;

    function jackChannel(kind, wMs, odMult) {
        const num = zeros(n), den = zeros(n);
        for (let k = 0; k < K; k++) {
            const st = stats[k];
            if (!st) continue;
            const M = st.pos.length - 1;
            const mod = new Float64Array(M);
            for (let j = 0; j < M; j++) {
                if (!st.valid[j]) { mod[j] = 0; continue; }
                if (kind === "plain") mod[j] = 1.0;
                else if (kind === "mj") {
                    mod[j] = (1.0 / (1.0 + mjDilute * Math.pow(st.other[j] / st.nrows[j], mjExp)))
                        * (1.0 + st.tgain[j] * st.trip[j]);
                } else if (kind === "cj") {
                    mod[j] = Math.pow(Math.max(st.load[j], 1e-6) / cjNorm, cjExp);
                } else { // ja
                    const e = Math.max(st.runlen[j] + 2.0 - jaFloor, 0.0);
                    const runf = Math.pow(e / (e + jaNorm), jaLenExp);
                    mod[j] = runf * Math.pow(1.0 + st.other[j] / st.nrows[j], jaCoordExp);
                }
            }
            const v = new Float64Array(M);
            for (let j = 0; j < M; j++) v[j] = st.valid[j] ? st.kern[j] * mod[j] : 0.0;
            // kern is stored at odJm; recompute when the channel OD differs
            if (odMult !== odJm) {
                for (let j = 0; j < M; j++)
                    if (st.valid[j]) v[j] = jackKernel(st.gs[j], b.x, p, odMult) * mod[j];
            }
            const cur = wmean(b, s, chainScatter(st.pos, v, n, st.valid), wMs);
            const wv = new Float64Array(M);
            for (let j = 0; j < M; j++) wv[j] = st.valid[j] ? 1.0 / st.gs[j] : 0.0;
            const wArr = chainScatter(st.pos, wv, n, st.valid);
            for (let r = 0; r < n; r++) {
                num[r] += Math.pow(Math.max(cur[r], 0.0), aggPow) * wArr[r];
                den[r] += wArr[r];
            }
        }
        const val = zeros(n);
        for (let r = 0; r < n; r++) {
            const q = den[r] > 1e-9 ? num[r] / den[r] : 0.0;
            val[r] = Math.pow(Math.max(q, 0.0), 1.0 / aggPow);
        }
        return val;
    }

    const Jbar = jackChannel("plain", wJm, odJm);
    let Jm = Jbar;
    if (p.c_jm || p.t_jack_mix || p.cbv_lockstack) Jm = jackChannel("mj", wJm, odJm);

    const cFj = p.c_fj || 0.0, cFj4k = p.c_fj_4k || 0.0;
    if (cFj !== 0.0 || cFj4k !== 0.0) {
        let FJ = zeros(n);
        for (let k = 0; k < K; k++) {
            const st = stats[k];
            if (!st) continue;
            const M = st.pos.length - 1;
            const v = new Float64Array(M);
            for (let j = 0; j < M; j++) v[j] = st.valid[j] ? st.fj[j] : 0.0;
            const sc = chainScatter(st.pos, v, n, st.valid);
            for (let r = 0; r < n; r++) FJ[r] += sc[r];
        }
        FJ = wmean(b, s, FJ, wJm);
        for (let r = 0; r < n; r++) Jm[r] += (b.is4k ? cFj4k : cFj) * FJ[r];
    }

    const needCj = p.c_jc !== 0.0, needJa = (p.c_ja !== 0.0 || p.cbv_lockanchor !== 0.0);
    const Jc = needCj ? jackChannel("cj", wJc, odJc) : Jm;
    const Ja = needJa ? jackChannel("ja", wJa, odJa) : Jm;

    // ================================================== Pbar
    const xrowP = Math.pow(b.x, p.od_mult_p);
    const d = b.dtModel;
    let dFp = d;
    if (tauC > 0.0) {
        // d_fp = gap to next attack (rows with wb==0)
        const attIdx = [];
        for (let r = 0; r < n; r++) if (wbG[r] === 0.0) attIdx.push(r);
        dFp = Float64Array.from(d);
        for (let r = 0; r < n; r++) {
            // first attack index > r
            let lo = 0, hi = attIdx.length;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (attIdx[mid] <= r) lo = mid + 1; else hi = mid; }
            if (lo < attIdx.length) {
                const na = attIdx[lo];
                const v = (b.t[na] - b.t[r]) / 1000.0;
                if (v > 0) dFp[r] = v;
            }
        }
    }
    const fp = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const q = Math.min(dFp[r] - xrowP / 2.0, xrowP / 6.0);
        fp[r] = Math.pow(Math.max(p.p_scale / xrowP * (1.0 - (p.p_lam3 / xrowP) * q * q), 0.0), 0.25);
    }
    const bst = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const rr = 7.5 / d[r];
        bst[r] = (rr > p.p_boost_lo && rr < p.p_boost_hi)
            ? 1.0 + p.p_boost * (rr - p.p_boost_lo) * Math.pow(rr - p.p_boost_hi, 2.0) : 1.0;
    }
    const vv = new Float64Array(n);
    for (let r = 0; r < n; r++)
        vv[r] = 1.0 + p.p_lam2 * s.lnBodyMs[r] / Math.pow(Math.max(b.dtMs[r], 1.0), p.p_v_norm);
    const chw = [1.0, 1.0, p.p_chw2, p.p_chw3, p.p_chw4, p.p_chw5, p.p_chw6, p.p_chw7];
    let inc;
    if (tauC > 0.0) {
        const u = triWindowCount(b, s, Float64Array.from(b.size), tauC);
        const att = new Float64Array(n);
        for (let r = 0; r < n; r++) att[r] = 1.0 - wbG[r];
        inc = zeros(n);
        for (let r = 0; r < n; r++) {
            const uu = clamp(u[r], 1.0, K);
            const i0 = Math.min(Math.floor(uu), K - 1);
            const frac = uu - i0;
            const chwU = chw[i0] * (1.0 - frac) + chw[i0 + 1] * frac;
            const mix = att[r] * Math.max(bst[r], 1.0) + Math.max(vv[r] - 1.0, 0.0);
            inc[r] = (1.0 / d[r]) * fp[r] * chwU * mix;
        }
    } else {
        inc = zeros(n);
        for (let r = 0; r < n; r++) {
            const chwU = chw[Math.min(b.size[r], K)];
            const mix = p.p_bv_max > 0.5 ? Math.max(bst[r], vv[r]) : bst[r] * vv[r];
            inc[r] = (1.0 / d[r]) * fp[r] * chwU * mix;
        }
    }
    for (let r = 0; r < n; r++) {
        const am = 1.0 + p.an_on_p * Math.min(s.anchorRaw[r] - p.an_a0,
            p.an_cubic * Math.pow(s.anchorRaw[r] - p.an_a1, 3.0));
        const v0 = inc[r] * am;
        inc[r] = Math.min(v0, Math.max(inc[r], inc[r] * p.p_sat_b - p.p_sat_a));
    }
    if (p.p_burst3) {
        const b3 = wcount(b, s, s.noteImpulse, 100.0);
        for (let r = 0; r < n; r++) inc[r] += p.p_burst3 * b3[r] * 10.0;
    }
    if (p.p_burst4) {
        const b4 = wcount(b, s, s.noteImpulse, 150.0);
        for (let r = 0; r < n; r++) inc[r] += p.p_burst4 * b4[r] * 6.6667;
    }
    const Pbar = wmean(b, s, inc, p.w_p);

    // ================================================== Abar
    const A = new Float64Array(n).fill(1.0);
    const abarActive = p.abar_active >= 0.5;
    if (abarActive) {
        let prevD = full(n, -1.0), prevA = full(n, -1.0);
        for (let k = 0; k < K; k++) {
            const d1 = s.dcol[k], on = s.act[k];
            const nd = Float64Array.from(prevD), na = Float64Array.from(prevA);
            for (let r = 0; r < n; r++) {
                const isOn = (prevA[r] >= 0.0) && on[r];
                if (isOn) {
                    const mx = Math.max(prevD[r], d1[r]);
                    const dd = Math.abs(prevD[r] - d1[r]) + p.abar_mx_w * Math.max(0.0, mx - p.abar_mx_thr);
                    const val = abarVal(dd, mx, p);
                    A[r] *= val;
                }
                nd[r] = on[r] ? d1[r] : prevD[r];
                na[r] = on[r] ? 1.0 : prevA[r];
            }
            prevD = nd; prevA = na;
        }
    } else {
        for (let k = 0; k + 1 < K; k++) {
            const d0 = s.dcol[k], d1 = s.dcol[k + 1], on = s.act[k], on2 = s.act[k + 1];
            for (let r = 0; r < n; r++) {
                if (on[r] && on2[r]) {
                    const mx = Math.max(d0[r], d1[r]);
                    const dd = Math.abs(d0[r] - d1[r]) + p.abar_mx_w * Math.max(0.0, mx - p.abar_mx_thr);
                    A[r] *= abarVal(dd, mx, p);
                }
            }
        }
    }
    const AbarRaw = wmean(b, s, A, p.w_a);
    const Abar = new Float64Array(n);
    for (let r = 0; r < n; r++) Abar[r] = AbarRaw[r] * p.abar_scale;

    // ================================================== Xbar
    const xrowX = Math.pow(b.x, p.od_mult_x);
    const cw = [p.x_cw0, p.x_cw1, p.x_cw2, p.x_cw3];
    const xDin = p.x_din || 0.0, xDout = p.x_dout || 0.0;
    const Xsum = zeros(n);
    const fcRows = [];
    for (let bd = 0; bd < N_BOUND; bd++) {
        const pos = b.bndPos[bd];
        if (pos.length < 2) { fcRows.push(zeros(n)); continue; }
        let posK = pos, g = b.bndG[bd], eArr = b.bndE[bd];
        if (tauC > 0.0) {
            // merge boundary events closer than tauC into single attacks
            const keepP = [], keepE = [];
            for (let j = 0; j < pos.length; j++) {
                if (j === 0) { keepP.push(pos[j]); keepE.push(eArr[j]); continue; }
                const bg = (b.t[pos[j]] - b.t[pos[j - 1]]) / 1000.0;
                if (bg >= tauC / 1000.0) { keepP.push(pos[j]); keepE.push(eArr[j]); }
            }
            posK = keepP; eArr = keepE;
            const M2 = Math.max(keepP.length - 1, 0);
            const g2 = new Float64Array(M2);
            for (let j = 0; j + 1 < keepP.length; j++)
                g2[j] = (b.t[keepP[j + 1]] - b.t[keepP[j]]) / 1000.0;
            g = g2;
        }
        const M2 = Math.max(posK.length - 1, 0);
        const Xb = new Float64Array(M2);
        for (let j = 0; j < M2; j++) {
            const gx = Math.max(g[j], xrowX);
            let v = p.x_amp * Math.pow(gx, -2.0);
            if (xDin !== 0.0 || xDout !== 0.0) {
                const dd = Math.abs(eArr[j] - 3.0) - Math.abs(eArr[j + 1] - 3.0);
                v *= (1.0 + xDin * Math.max(dd, 0.0) + xDout * Math.max(-dd, 0.0));
            }
            Xb[j] = v;
        }
        // boundary weight + chain scatter (same-chart always true)
        const sc = stepScatter(posK.slice(0, M2), posK.slice(1), Xb, n);
        const bgw = cw[BOUND_GROUP[bd]];
        for (let r = 0; r < n; r++) Xsum[r] += bgw * sc[r];
        // fast cross product term
        const fc = new Float64Array(M2);
        for (let j = 0; j < M2; j++) {
            const base = Math.max(g[j], p.x_fc_floor, 0.75 * xrowX);
            fc[j] = Math.max(p.x_fc_a * Math.pow(base, -2.0) - p.x_fc_off, 0.0);
        }
        fcRows.push(stepScatter(posK.slice(0, M2), posK.slice(1), fc, n));
    }
    for (let bd = 0; bd + 1 < N_BOUND; bd++) {
        const w = Math.sqrt(cw[BOUND_GROUP[bd]] * cw[BOUND_GROUP[bd + 1]]);
        const A1 = fcRows[bd], A2 = fcRows[bd + 1];
        for (let r = 0; r < n; r++)
            Xsum[r] += p.x_fc_w * w * Math.sqrt(Math.max(A1[r] * A2[r], 0.0));
    }
    if (p.x_jump_w) {
        const jump = jumpChannel(b, s, p, xrowX);
        for (let r = 0; r < n; r++) Xsum[r] += p.x_jump_w * jump[r];
    }
    const Xbar = wmean(b, s, Xsum, p.w_x);

    // ================================================== Rbar
    const Rbar = computeRbar(b, s, p, Math.pow(b.x, p.od_mult_r));

    // same-hand chord density (SHd)
    const shd = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const m = b.mask[r];
        let left = 0, right = 0;
        for (let k = 0; k < 3; k++) if ((m >> k) & 1) left++;
        for (let k = 4; k < 7; k++) if ((m >> k) & 1) right++;
        if (tauC > 0.0) {
            // graded via triangular window handled below (approximated with
            // exact same-shape computation for perf: rows are the grid)
            const le = left, ri = right;
            shd[r] = le * clamp(le - 1.0, 0.0, 1.0) + ri * clamp(ri - 1.0, 0.0, 1.0);
        } else {
            shd[r] = (left >= 2 ? left : 0.0) + (right >= 2 ? right : 0.0);
        }
    }
    const SHd = wmean(b, s, shd, Math.max(p.shd_w, 50.0));

    // ================================================== Cbar
    let Cbar = zeros(n);
    let anyLn = false;
    for (let r = 0; r < n; r++) if (b.lnEnd[r] > 0) { anyLn = true; break; }
    if (anyLn) {
        // v1 terms are all 0 in release params → only shield/lockjack/
        // lockanchor/par/holdtap skipped (weights 0). Kept for exactness:
        if (p.cb_shield || p.cb_lockjack || p.cb_lockanchor || p.cb_par || p.cb_holdtap) {
            Cbar = computeCbarV1(b, s, p, Jbar, Ja);
        }
        const CbarV2 = computeCbarV2(b, s, p, stats);
        for (let r = 0; r < n; r++) Cbar[r] += CbarV2[r];
    }

    // ================================================== hybrid/LN supplements
    let Chord2 = zeros(n), Recov = zeros(n);
    if (p.use_hb) {
        const churnC = p.cbv_churn || 0.0, churn4k = p.cbv_churn_4k || 0.0;
        const holdageC = p.cbv_holdage || 0.0, holdage4k = p.cbv_holdage_4k || 0.0;
        if (churnC || churn4k) {
            const churn = computeChurn(b, s, p);
            for (let r = 0; r < n; r++) {
                const w = b.is4k ? (churn4k !== 0.0 ? churn4k : churnC) : churnC;
                Cbar[r] += w * churn[r];
            }
        }
        if (holdageC || holdage4k) {
            const holdage = computeHoldage(b, s, p);
            for (let r = 0; r < n; r++) {
                const w = b.is4k ? (holdage4k !== 0.0 ? holdage4k : holdageC) : holdageC;
                Cbar[r] += w * holdage[r];
            }
        }
        if (p.c_chord2) {
            const c2w = Math.max(p.chord2_w, 50.0);
            const flag = new Uint8Array(n);
            for (let r = 0; r < n; r++) flag[r] = b.size[r] === 2 ? 1 : 0;
            Chord2 = wmean(b, s, Float64Array.from(flag), c2w);
        }
        if (p.d_rec) {
            Recov = computeRecov(b, s, p);
        }
    }

    // ================================================== eye (visual regularity)
    let EyeR = zeros(n);
    if (p.use_eye) EyeR = computeEyeCurve(b, s, p);

    return { Jbar, Jm, Jc, Ja, Pbar, Xbar, Abar, Rbar, Cbar,
             EyeR, Chord2, Recov, SHd };
}

function abarVal(dd, mx, p) {
    const lo = Math.min(p.abar_c0 + p.abar_mx * mx, 1.0);
    let mid;
    if (p.abar_weld) mid = Math.min(p.abar_c0 + p.abar_k * (dd - p.abar_thr_lo) + p.abar_mx * mx, 1.0);
    else mid = Math.min(p.abar_c1 + p.abar_k * dd + p.abar_mx * mx, 1.0);
    if (dd < p.abar_thr_lo) return lo;
    if (dd < p.abar_thr_hi) return mid;
    return 1.0;
}

// geometric jump channel (rate-weighted transition costs)
function jumpChannel(b, s, p, xX) {
    const n = b.n;
    // 7x7 weight matrix
    const Wm = [];
    for (let a = 0; a < K; a++) {
        const row = new Float64Array(K);
        for (let c = 0; c < K; c++) {
            const dd = Math.abs(a - c);
            let w = 1.0;
            const sameHand = HAND[a] === HAND[c] && HAND[a] !== 1;
            const thumb = HAND[a] === 1 || HAND[c] === 1;
            const cross = HAND[a] !== HAND[c] && !thumb;
            w += p.x_jd_p * Math.pow(Math.max(dd, 1e-9), p.x_jd_e);
            if (sameHand && dd > 0)
                w = 1.0 + p.x_jh_p * Math.pow(Math.max(dd, 1e-9), -p.x_jh_e);
            if (thumb) w = 1.0 - p.x_jt / Math.max(dd, 1.0);
            if (cross) w = 1.0 - p.x_jh_p * Math.min(dd / K, 1.0);
            const din = Math.abs(c - 3) < Math.abs(a - 3) ? 1.0 : 0.0;
            w *= (1.0 + p.x_dir_in * din + p.x_dir_out * (1.0 - din));
            row[c] = w;
        }
        Wm.push(row);
    }
    const step = zeros(n), counts = zeros(n);
    const notes = b.nNotes;
    for (let i = 1; i < notes; i++) {
        const a = b.noteCol[i - 1], c = b.noteCol[i];
        const w = Wm[a][c] - 1.0;
        const row = b.noteRow[i];
        step[row] += w;
        counts[row] += 1.0;
    }
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const meanW = step[r] / Math.max(counts[r], 1.0);
        out[r] = meanW / b.dtModel[r];
    }
    return out;
}

// Rbar — LN release channel (core/model._rbar, single chart)
function computeRbar(b, s, p, xR) {
    const n = b.n;
    const R = zeros(n);
    const m = b.tailN;
    if (m === 0) return R;
    const t = b.t;

    // I (difficulty of hold shape) per tail
    const Iv = new Float64Array(m);
    const xsAt = new Float64Array(m);
    for (let j = 0; j < m; j++) {
        const xs = Math.pow(xR, 1.0); // xr[j0] — x is chart-level
        xsAt[j] = xs;
        const dur = b.tailT[j] - b.tailH[j];
        const Ih = 0.001 * Math.abs(dur - 80.0) / xs;
        const nh = b.tailNh[j];
        const It = Number.isFinite(nh) ? 0.001 * Math.abs(nh - b.tailT[j] - 80.0) / xs : 10.0;
        Iv[j] = 2.0 / (2.0 + Math.exp(-p.r_I_steep * (Ih - p.r_I_off))
                        + Math.exp(-p.r_I_steep * (It - p.r_I_off)));
    }

    const dtrMin = p.r_dtr_min != null ? p.r_dtr_min : 1e-4;
    const soft = p.r_soft_edges || 0.0;
    const wfloor = soft ? dtrMin * 1000.0 : 0.0;
    const simTau = p.r_sim_tau || 0.0;

    function coordW(c1, c2) {
        // python _coord_weight order: cross default → same-column → same-hand
        // (overrides same-column!) → thumb (overrides all)
        let cw = p.r_cw_cross;
        if (c1 === c2) cw = p.r_cw_same;
        if (HAND[c1] === HAND[c2] && HAND[c1] !== 1) cw = p.r_cw_hand;
        if (HAND[c1] === 1 || HAND[c2] === 1) cw = p.r_cw_thumb;
        return cw;
    }
    function rowOfTime(z) {
        let lo = 0, hi = n;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] < z) lo = mid + 1; else hi = mid; }
        return clamp(lo, 0, n - 1);
    }

    // A. per-tail release
    for (let j = 0; j < m; j++) {
        const nxt = b.tailNxt[j];
        if (!Number.isFinite(nxt) || nxt - b.tailT[j] > p.r_dt_max) continue;
        const dtr = (nxt - b.tailT[j]) / 1000.0;
        let rv = p.r_tail * Math.pow(Math.max(dtr, dtrMin), -0.5) / xsAt[j] * (1.0 + p.r_I_w * Iv[j]);
        const sameCol = b.tailNxtCol[j] === b.tailCol[j] && !b.tailIsTail[j];
        if (sameCol) rv *= p.r_same_col;
        const cwv = coordW(b.tailCol[j], b.tailNxtCol[j]);
        let ex;
        if (simTau > 0.0) {
            const dEv = b.tailNxtTail[j] - b.tailNh[j]; // python: nt - nh (inf - inf → nan)
            let beta;
            if (Number.isFinite(dEv)) beta = clamp(0.5 - dEv / (2.0 * simTau), 0.0, 1.0);
            else beta = b.tailIsTail[j] ? 1.0 : 0.0;
            ex = p.r_coord_e * (beta + (1.0 - beta) * p.r_tt);
        } else {
            ex = p.r_coord_e * (b.tailIsTail[j] ? 1.0 : p.r_tt);
        }
        rv *= Math.pow(Math.max(cwv, 1e-3), ex);
        const dur = b.tailT[j] - b.tailH[j];
        const thr = Math.max(p.r_short_thr, 1.0);
        const red = p.r_short_red + (1.0 - p.r_short_red) * Math.min(dur, thr) / thr;
        if (dur > 0) rv *= red;
        // lock terms
        if (p.r_lock) {
            const hm = s.heldmask[b.tailJ0[j]];
            let lock = 0.0;
            for (let k = 0; k < K; k++) {
                if (((hm >> k) & 1) && k !== b.tailCol[j])
                    lock += coordW(b.tailCol[j], k);
            }
            rv *= (1.0 + p.r_lock * lock);
        }
        if (p.r_straddle) {
            const hm = s.heldmask[b.tailJ0[j]];
            const col = b.tailCol[j];
            const ain = [p.r_ain0, p.r_ain1, p.r_ain2, p.r_ain3];
            let S0 = 0.0;
            for (let k = 0; k < K; k++) {
                if ((hm >> k) & 1) S0 += ain[AIN_GROUP[k]];
            }
            if ((hm >> col) & 1) S0 -= ain[AIN_GROUP[col]];
            rv *= (1.0 + p.r_straddle * S0);
        }
        if (soft) rv *= edgeRamp(nxt - b.tailT[j], p.r_dt_max);
        const endT = Math.max(nxt, b.tailT[j] + wfloor);
        let j1 = rowOfTime(endT);
        j1 = Math.max(j1, b.tailJ0[j]);
        if (soft) {
            const spanI = Math.max(endT - b.tailT[j], 0.0);
            const gridSpan = t[Math.min(j1, n - 1)] - t[b.tailJ0[j]];
            const den = Math.max(gridSpan, Math.max(spanI, 1e-9));
            if (spanI > 0.0) rv *= spanI / den;
        }
        const val = rv;
        for (let r = b.tailJ0[j]; r < j1 && r < n; r++) R[r] += val;
    }

    // B. tail-to-tail sequence
    for (let j = 0; j + 1 < m; j++) {
        const dtr = (b.tailT[j + 1] - b.tailT[j]) / 1000.0;
        const dd = Math.max(dtr, dtrMin);
        const cwv = coordW(b.tailCol[j], b.tailCol[j + 1]);
        let sv = p.r_seq * Math.pow(dd, -0.5) / xsAt[j]
            * (1.0 + p.r_I_w * (Iv[j] + Iv[j + 1]))
            * Math.pow(Math.max(cwv, 1e-3), p.r_coord_e);
        const j0 = b.tailJ0[j];
        const endB = Math.max(b.tailT[j + 1], b.tailT[j] + wfloor);
        let j1 = rowOfTime(endB);
        j1 = Math.max(j1, j0);
        if (soft) {
            const spanI = Math.max(endB - b.tailT[j], 0.0);
            const gridSpan = t[Math.min(j1, n - 1)] - t[j0];
            sv *= spanI / Math.max(gridSpan, spanI);
        }
        for (let r = j0; r < j1 && r < n; r++) R[r] += sv;
    }

    // C. release-order triples
    if (p.r_order_pen) {
        for (let j = 0; j + 2 < m; j++) {
            const c1 = b.tailCol[j], c2 = b.tailCol[j + 1], c3 = b.tailCol[j + 2];
            const hh = HAND[c1];
            if (!(hh === HAND[c2] && hh === HAND[c3] && hh !== 1)) continue;
            if (c1 === c2 || c2 === c3 || c1 === c3) continue;
            const span = b.tailT[j + 2] - b.tailT[j];
            let ok = span <= p.r_order_tau;
            if (!ok && !soft) continue;
            const jump = Math.abs(c1 - c2) + Math.abs(c2 - c3);
            const lo = Math.min(Math.min(c1, c2), c3), hiC = Math.max(Math.max(c1, c2), c3);
            const excess = Math.max(jump - (hiC - lo), 0.0);
            let val = p.r_order_pen * excess / xsAt[j];
            if (soft) {
                ok = true; // ramp replaces hard cutoff
                val *= edgeRamp(span, p.r_order_tau);
            }
            if (!ok || val === 0.0) continue;
            const j0 = b.tailJ0[j];
            const endC = Math.max(b.tailT[j + 2], b.tailT[j] + wfloor);
            let j1 = rowOfTime(endC);
            j1 = Math.max(j1, j0);
            if (soft) {
                const spanI = Math.max(endC - b.tailT[j], 0.0);
                const gridSpan = t[Math.min(j1, n - 1)] - t[j0];
                val *= spanI / Math.max(gridSpan, spanI);
            }
            for (let r = j0; r < j1 && r < n; r++) R[r] += val;
        }
    }

    const out = wmean(b, s, R, p.w_r);
    for (let r = 0; r < n; r++) out[r] = Math.max(out[r], 0.0);
    return out;
}

function ainWeights(p) {
    return [p.r_ain0, p.r_ain1, p.r_ain2, p.r_ain3];
}
// per-column ain weight lookup helper (index by AIN_GROUP[col])
Object.defineProperty(globalThis, "__noop", { value: 0 });

// Cbar v1 — release params have all v1 weights at 0; kept for completeness
function computeCbarV1(b, s, p, Jbar, Ja) {
    const n = b.n;
    const out = zeros(n);
    const held = s.held;
    const hp = new Float64Array(n);
    const lockPow = p.cb_lock_pow || 1.0;
    for (let r = 0; r < n; r++) hp[r] = Math.pow(Math.max(held[r], 0.0), lockPow);
    if (p.cb_shield) {
        const tau = Math.max(p.cb_shield_tau, 1.0);
        for (let k = 0; k < K; k++) {
            const pos = b.colPos[k];
            if (pos.length < 3) continue;
            for (let jj = 1; jj < pos.length; jj++) {
                if (!b.isLn[pos[jj]]) continue;
                let contrib = 0.0;
                for (let back = 1; back <= SHIELD_LOOKBACK; back++) {
                    if (jj - back < 0) break;
                    const dtp = b.t[pos[jj]] - b.t[pos[jj - back]];
                    if (dtp <= 0 || dtp >= 500.0) continue;
                    contrib += Math.exp(-dtp / tau);
                }
                if (contrib <= 0) continue;
                const hm = s.heldmask[pos[jj]];
                let lock = 0.0;
                if (p.cb_shield_lock) {
                    const ain = [p.r_ain0, p.r_ain1, p.r_ain2, p.r_ain3];
                    for (let j2 = 0; j2 < K; j2++) {
                        if (((hm >> j2) & 1) && j2 !== k) lock += ain[AIN_GROUP[j2]];
                    }
                    lock *= p.cb_shield_lock;
                }
                const val = contrib * (1.0 + lock);
                if (pos[jj] < n) out[pos[jj]] += val;
            }
        }
        const sm = wmean(b, s, out, p.w_cb);
        for (let r = 0; r < n; r++) out[r] = p.cb_shield * sm[r];
    }
    if (p.cb_lockjack) for (let r = 0; r < n; r++) out[r] += p.cb_lockjack * Jbar[r] * hp[r];
    if (p.cb_lockanchor) for (let r = 0; r < n; r++) out[r] += p.cb_lockanchor * Ja[r] * hp[r];
    if (p.cb_par) for (let r = 0; r < n; r++) out[r] += p.cb_par * hp[r];
    if (p.cb_holdtap) for (let r = 0; r < n; r++) out[r] += p.cb_holdtap * (b.size[r] / b.dtModel[r]) * hp[r];
    for (let r = 0; r < n; r++) out[r] = Math.max(out[r], 0.0);
    return out;
}

// dist matrix for Cbar v2 sub-terms
function distMatrix(p, prefix) {
    const DEF = { sh_adj: 0.6, sh_split: 1.0, "1h_split": 0.8, "2h_split": 0.5, cross: 0.3 };
    const g = (suf) => p[prefix + suf] != null ? p[prefix + suf] : DEF[suf];
    const M = [];
    for (let a = 0; a < K; a++) {
        const row = new Float64Array(K);
        for (let c = 0; c < K; c++) {
            const d = Math.abs(a - c);
            let v;
            const sameHand = HAND[a] === HAND[c] && HAND[a] !== 1;
            const thumb = HAND[a] === 1 || HAND[c] === 1;
            const cross = HAND[a] !== HAND[c] && !thumb;
            v = g("cross");
            if (cross && d <= 2 && d > 0) v = g("2h_split");
            if (thumb && d <= 2 && d > 0) v = g("1h_split");
            if (sameHand && d === 1) v = g("sh_adj");
            if (sameHand && d === 2) v = g("sh_split");
            if (d === 0) v = 0.0;
            row[c] = v;
        }
        M.push(row);
    }
    return M;
}

// Cbar v2 — LN coordination (core/components/lncoord_v2.py)
function computeCbarV2(b, s, p, stats) {
    const n = b.n;
    if (!p.use_cbar_v2) return zeros(n);
    const w = p.cbv_w;
    const acc = zeros(n);

    function gate(name) { return (p["use_cbv_" + name] || 0.0) !== 0.0; }
    function addTerm(name, fn) {
        const tw = p["cbv_" + name];
        if (!gate(name) || !tw) return;
        const raw = fn();
        for (let r = 0; r < n; r++) acc[r] += tw * Math.max(raw[r], 0.0);
    }

    function lockMassAt(rows, col, M) {
        // sum_j M[col, j] * heldmask bit j
        const out = new Float64Array(rows.length);
        for (let i = 0; i < rows.length; i++) {
            const hm = s.heldmask[rows[i]];
            let sum = 0.0;
            for (let j = 0; j < K; j++) if ((hm >> j) & 1) sum += M[col][j];
            out[i] = sum;
        }
        return out;
    }

    // 1. shield
    addTerm("shield", () => {
        const tau = Math.max(p.cbv_sh_tau, 1.0);
        const dtmax = Math.max(p.cbv_sh_dt_max, 1.0);
        const lnW = p.cbv_sh_ln_w, lnTau = Math.max(p.cbv_sh_ln_tau, 1.0);
        const amp = p.cbv_sh_lock;
        const M = distMatrix(p, "cbv_ls_");
        const out = zeros(n);
        for (let k = 0; k < K; k++) {
            const pos = b.colPos[k];
            if (pos.length < 2) continue;
            for (let jj = 1; jj < pos.length; jj++) {
                if (!b.isLn[pos[jj]]) continue;
                const pv = jj - 1;
                const dtp = b.t[pos[jj]] - b.t[pos[pv]];
                if (dtp <= 0.0 || dtp >= dtmax) continue;
                const prow = pos[pv];
                const isLnPrev = b.isLn[prow];
                const dur = clamp(b.lnEnd[prow] - b.t[prow], 0.0, dtp);
                const wpred = isLnPrev ? lnW * Math.exp(-Math.max(dur, 0.0) / lnTau) : 1.0;
                let val = wpred * Math.exp(-Math.max(dtp, 0.0) / tau);
                const lm = lockMassAt([pos[jj]], k, M)[0];
                val *= (1.0 + amp * lm);
                out[pos[jj]] += val;
            }
        }
        return wmean(b, s, out, w);
    });

    // 2. straddle
    addTerm("straddle", () => {
        const M = distMatrix(p, "cbv_str_");
        const hw = [p.cbv_str_h0, p.cbv_str_h1, p.cbv_str_h2, p.cbv_str_h3];
        const balP = p.cbv_str_bal;
        const maxd = Math.min(Math.max(Math.floor(p.cbv_str_maxd), 2), K - 1);
        const hmb = [];
        for (let r = 0; r < n; r++) hmb.push(s.heldmask[r]);
        const out = zeros(n);
        for (let d = 2; d <= maxd; d++) {
            for (let a = 0; a + d < K; a++) {
                const bcol = a + d;
                // interior columns
                const interior = [];
                for (let m = a + 1; m < bcol; m++) interior.push(m);
                // gate: interior ever active
                let ever = false;
                for (const ic of interior) {
                    const a2 = s.act[ic];
                    for (let r = 0; r < n; r++) if (a2[r]) { ever = true; break; }
                    if (ever) break;
                }
                if (!ever) continue;
                const ra = s.usage[a], rb = s.usage[bcol];
                for (let r = 0; r < n; r++) {
                    const co = Math.sqrt(Math.max(ra[r] * rb[r], 0.0));
                    const bal = 2.0 * Math.min(ra[r], rb[r]) / Math.max(ra[r] + rb[r], 1e-9);
                    const act = co * Math.pow(bal, balP);
                    let pin = 0.0;
                    const hm = hmb[r];
                    for (const ic of interior) if ((hm >> ic) & 1) pin += hw[AIN_GROUP[ic]];
                    out[r] += M[a][bcol] * act * pin;
                }
            }
        }
        return wmean(b, s, out, w);
    });

    // 3/4. locked jack / anchor
    const aggPow = Math.max(p.j_agg_pow, 0.25);
    const lockPow = p.cbv_lock_pow;
    function colLocked(kind) {
        const jaFloor = p.ja_len_floor, jaNorm2 = Math.max(p.ja_norm, 1e-3);
        const jaLenExp2 = p.ja_len_exp, jaCoordExp2 = p.ja_coord_exp;
        const num = zeros(n), den = zeros(n);
        for (let k = 0; k < K; k++) {
            const st = stats[k];
            if (!st) continue;
            const M = st.pos.length - 1;
            const v = new Float64Array(M);
            for (let j = 0; j < M; j++) {
                if (!st.valid[j]) { v[j] = 0; continue; }
                if (kind === "anchor") {
                    const e = Math.max(st.runlen[j] + 2.0 - jaFloor, 0.0);
                    const runf = Math.pow(e / (e + jaNorm2), jaLenExp2);
                    const mod = runf * Math.pow(1.0 + st.other[j] / st.nrows[j], jaCoordExp2);
                    v[j] = st.kern[j] * mod;
                } else v[j] = st.kern[j];
            }
            const cur = wmean(b, s, chainScatter(st.pos, v, n, st.valid), w);
            // lock mass step over gaps
            const lmVal = new Float64Array(M);
            const Ml = distMatrix(p, "cbv_ls_");
            for (let j = 0; j < M; j++) {
                const hm = s.heldmask[st.pos[j]];
                let sum = 0.0;
                for (let j2 = 0; j2 < K; j2++) if ((hm >> j2) & 1) sum += Ml[k][j2];
                lmVal[j] = lockPow !== 1.0 ? Math.pow(Math.max(sum, 0.0), lockPow) : sum;
            }
            const lm = chainScatter(st.pos, lmVal, n, st.valid);
            const wv = new Float64Array(M);
            for (let j = 0; j < M; j++) wv[j] = st.valid[j] ? 1.0 / st.gs[j] : 0.0;
            const wArr = chainScatter(st.pos, wv, n, st.valid);
            for (let r = 0; r < n; r++) {
                num[r] += Math.pow(Math.max(cur[r] * lm[r], 0.0), aggPow) * wArr[r];
                den[r] += wArr[r];
            }
        }
        const out = zeros(n);
        for (let r = 0; r < n; r++) {
            const q = den[r] > 1e-9 ? num[r] / den[r] : 0.0;
            out[r] = Math.pow(Math.max(q, 0.0), 1.0 / aggPow);
        }
        return out;
    }
    addTerm("lockstack", () => colLocked("plain"));
    addTerm("lockanchor", () => colLocked("anchor"));

    // 5. overlap — genuinely partial LN overlap
    addTerm("overlap", () => {
        const M = distMatrix(p, "cbv_ov_");
        const dtmax0 = Math.max(p.cbv_ov_dt_max, 1.0);
        const cap = Math.max(p.cbv_ov_cap, 1.0);
        const rows = [], cols = [];
        for (let k = 0; k < K; k++) {
            const pos = b.colPos[k];
            for (const r of pos) if (b.isLn[r]) { rows.push(r); cols.push(k); }
        }
        if (rows.length < 2) return zeros(n);
        const order = rows.map((_, i) => i).sort((a, c) => b.t[rows[a]] - b.t[rows[c]]);
        const rSorted = order.map(i => rows[i]);
        const cSorted = order.map(i => cols[i]);
        const N = rows.length;
        let dtmax = dtmax0;
        // diff-array accumulation: val added on [j0, j1), prefix-summed once
        const diff = zeros(n + 1);
        const tLoc = b.t, lnEndLoc = b.lnEnd;
        for (let i = 0; i < N; i++) {
            const ri = rSorted[i], ti = tLoc[ri], ei = lnEndLoc[ri], ci = cSorted[i];
            const Mi = M[ci];
            for (let j2 = i + 1; j2 < N; j2++) {
                const rj = rSorted[j2], tj = tLoc[rj];
                if (tj - ti >= dtmax) break;
                if (ei <= tj) continue;
                const ej = lnEndLoc[rj];
                if (ej <= ei) continue;
                const ov = Math.min(ei - tj, cap);
                const val = (ov / 1000.0) * Mi[cSorted[j2]];
                if (val === 0) continue;
                diff[rj] += val;
                // end row: first row with t >= tj + ov (exclusive end)
                const z = tj + ov;
                let lo = 0, hi = n;
                while (lo < hi) { const mid = (lo + hi) >> 1; if (tLoc[mid] < z) lo = mid + 1; else hi = mid; }
                if (lo > rj && lo <= n) diff[lo] -= val;
            }
        }
        const out = zeros(n);
        let acc = 0;
        for (let r = 0; r < n; r++) { acc += diff[r]; out[r] = acc; }
        return wmean(b, s, out, w);
    });

    // 6. holdtap
    addTerm("holdtap", () => {
        const Ml = distMatrix(p, "cbv_ls_");
        const tot = zeros(n);
        for (let k = 0; k < K; k++) {
            const pos = b.colPos[k];
            for (const r of pos) {
                const hm = s.heldmask[r];
                let sum = 0.0;
                for (let j = 0; j < K; j++) if ((hm >> j) & 1) sum += Ml[k][j];
                tot[r] += sum;
            }
        }
        const raw = new Float64Array(n);
        for (let r = 0; r < n; r++)
            raw[r] = Math.max((b.size[r] / b.dtModel[r]) * (tot[r] / Math.max(b.size[r], 1)), 0.0);
        return wmean(b, s, raw, w);
    });

    for (let r = 0; r < n; r++) acc[r] = Math.max(Number.isFinite(acc[r]) ? acc[r] : 0.0, 0.0);
    return acc;
}

// hybrid supplements
function computeChurn(b, s, p) {
    const n = b.n;
    if (b.tailN === 0) return zeros(n);
    const imp = zeros(n);
    for (let j = 0; j < b.tailN; j++) imp[b.tailJ0[j]] += 1.0;
    const r = wmean(b, s, imp, Math.max(p.churn_w, 50.0));
    const sat = Math.max(p.churn_sat, 1.0);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = r[i] / (1.0 + r[i] / sat);
    return out;
}

function computeHoldage(b, s, p) {
    // python: per column, H = step-scatter of the active LN's head over
    // [head_row, tail_row), M = 1-scatter over the same span. Rows are summed
    // additively, so overlapping row-level LN spans in one column sum their
    // head times (age goes ≤ 0 → clamped to 0). Replicated exactly.
    const n = b.n;
    const th = p.holdage_th, cap = p.holdage_cap;
    const out = zeros(n);
    const H = zeros(n), M = zeros(n);
    for (let k = 0; k < K; k++) {
        H.fill(0); M.fill(0);
        const pos = b.colPos[k];
        for (const r of pos) {
            if (!b.isLn[r]) continue;
            const h = b.t[r];
            const e = Math.min(b.lnEnd[r], h + cap * 1000.0);
            let lo = 0, hi = n;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (b.t[mid] < e) lo = mid + 1; else hi = mid; }
            const j1 = clamp(lo, 0, n);
            if (j1 <= r) continue;
            for (let r2 = r; r2 < j1; r2++) { H[r2] += h; M[r2] += 1.0; }
        }
        for (let r2 = 0; r2 < n; r2++) {
            if (M[r2] <= 0) continue;
            const age = Math.min(b.t[r2] - H[r2], cap * 1000.0) / 1000.0 - th;
            if (age > 0) out[r2] += age;
        }
    }
    return out;
}

function computeRecov(b, s, p) {
    const n = b.n;
    const w = Math.max(p.recov_w, 50.0), wl = Math.max(p.recov_wl, 1000.0);
    const Cs = wmean(b, s, s.C, w);
    const Cl = wmean(b, s, s.C, wl);
    const burst = new Float64Array(n);
    for (let r = 0; r < n; r++) burst[r] = Math.max(Cs[r] / Math.max(Cl[r], 1e-6) - 1.0, 0.0);
    return wmean(b, s, burst, w);
}

function computeEyeCurve(b, s, p) {
    const n = b.n;
    const wRef = Math.max(p.eye_w_ref, 100.0), wS = Math.max(p.eye_w_s, 50.0);
    const tau = Math.max(p.eye_tau, 1e-3);
    const logdt = new Float64Array(n);
    const valid = new Uint8Array(n);
    for (let r = 0; r < n; r++) {
        if (b.dtMs[r] > 0.0) { valid[r] = 1; logdt[r] = Math.log(Math.max(b.dtMs[r], 1e-6)); }
        else logdt[r] = 0.0;
    }
    const lv = new Float64Array(n);
    const vv2 = new Float64Array(n);
    for (let r = 0; r < n; r++) { lv[r] = valid[r] ? logdt[r] : 0.0; vv2[r] = valid[r]; }
    const muRaw = wmean(b, s, lv, wRef);
    const cnt = wmean(b, s, vv2, wRef);
    const dist = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        if (valid[r] && cnt[r] > 1e-6) {
            const mu = muRaw[r] / Math.max(cnt[r], 1e-9);
            const rem = ((logdt[r] - mu) % Math.log(2.0) + Math.log(2.0)) % Math.log(2.0);
            dist[r] = Math.min(rem, Math.log(2.0) - rem);
        }
    }
    const sm = wmean(b, s, dist, wS);
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) out[r] = Math.exp(-sm[r] / tau);
    return out;
}

// ============================================================
// COMBINE (core/model.combine)
// ============================================================
function combine(b, s, cur, p) {
    const n = b.n;
    const A = new Float64Array(n);
    for (let r = 0; r < n; r++) A[r] = Math.max(cur.Abar[r], 1e-6);
    const Ks = s.Ks, C = s.C;

    const is4kRow = b.is4k; // single chart: one frame
    const aP = is4kRow && p.a_p_4k !== 0.0 ? p.a_p_4k : p.a_p;
    const aR = is4kRow && p.a_r_4k !== 0.0 ? p.a_r_4k : p.a_r;
    const aCb = is4kRow && p.a_cb_4k !== 0.0 ? p.a_cb_4k : p.a_cb;

    function branchVal(v, mult, r) {
        const cap = p.cap_a + p.cap_b * Math.max(v, 0.0);
        return Math.pow(A[r], mult / Ks[r]) * Math.min(Math.max(v, 0.0), cap);
    }
    const JmB = new Float64Array(n), JcB = new Float64Array(n), JaB = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        JmB[r] = branchVal(cur.Jm[r], p.aj, r);
        JcB[r] = branchVal(cur.Jc[r], p.aj, r);
        JaB[r] = branchVal(cur.Ja[r], p.aj, r);
    }
    const stream = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        stream[r] = Math.pow(A[r], p.ap) * (
            aP * Math.max(cur.Pbar[r], 0.0)
            + aR * Math.max(cur.Rbar[r], 0.0) / (C[r] + p.a_c)
            + aCb * Math.max(cur.Cbar[r], 0.0) / (C[r] + p.a_cbc)
            + (p.d_sh || 0.0) * (cur.SHd ? cur.SHd[r] : 0.0)
            + (p.use_eye && (p.d_eye !== 0.0 || p.d_eye_4k !== 0.0)
                ? (is4kRow && p.d_eye_4k !== 0.0 ? p.d_eye_4k : p.d_eye)
                  * Math.max(cur.Pbar[r], 0.0) * cur.EyeR[r]
                : 0.0));
    }
    if (p.use_hb) {
        const cChord2 = p.c_chord2 || 0.0;
        if (cChord2 !== 0.0) for (let r = 0; r < n; r++) stream[r] += cChord2 * cur.Chord2[r];
        const dRec = p.d_rec || 0.0;
        if (dRec !== 0.0) {
            const half = Math.max(p.rec_half, 1e-3);
            for (let r = 0; r < n; r++) {
                const rec = Math.max(cur.Recov[r], 0.0);
                stream[r] = Math.max(stream[r] - dRec * rec / (rec + half), 0.0);
            }
        }
    }
    const sp = p.s_p;
    const S = new Float64Array(n);
    if (Math.abs(sp - 1.0) < 1e-6) {
        for (let r = 0; r < n; r++)
            S[r] = p.c_jm * JmB[r] + p.c_jc * JcB[r] + p.c_ja * JaB[r] + p.c_s * stream[r];
    } else {
        for (let r = 0; r < n; r++) {
            const inner = p.c_jm * Math.pow(JmB[r], sp) + p.c_jc * Math.pow(JcB[r], sp)
                + p.c_ja * Math.pow(JaB[r], sp) + p.c_s * Math.pow(Math.max(stream[r], 0.0), sp);
            S[r] = Math.pow(Math.max(inner, 0.0), 1.0 / sp);
        }
    }
    const T = new Float64Array(n), D = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const Xt = Math.max(cur.Xbar[r], 0.0) + p.t_jack_mix * JmB[r];
        T[r] = Math.pow(A[r], p.at / Ks[r]) * Xt / (Xt + S[r] + p.t_s_off);
        D[r] = p.d_b1 * Math.pow(S[r], p.d_ds) * Math.pow(Math.max(T[r], 1e-9), p.d_dt)
            + p.d_b2 * S[r];
        if (!Number.isFinite(D[r]) || D[r] < 0) D[r] = 0;
    }
    return D;
}

// ============================================================
// AGGREGATE (core/model.aggregate, mode 3 = weighted power mean)
// ============================================================
function aggregateWeights(b, s, p, holdW) {
    const n = b.n;
    const w = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const dnext = r + 1 < n ? b.dtMs[r] : 0.0;
        const dprev = r > 0 ? b.dtMs[r - 1] : 0.0;
        const gp = Math.max(0.5 * (dnext + dprev), 0.0);
        w[r] = Math.pow(gp, p.agg_gap_w) * Math.pow(Math.max(s.C[r], 0.0), p.agg_wc);
    }
    if (holdW && p.hw_a) {
        const h = s.held;
        for (let r = 0; r < n; r++)
            w[r] *= (1.0 + p.hw_a * h[r] / (h[r] + Math.max(p.hw_half, 1e-6)));
    }
    for (let r = 0; r < n; r++) if (!Number.isFinite(w[r]) || w[r] < 0) w[r] = 0;
    return w;
}

function peakEnvelope(b, s, D, ms) {
    // per-chart rolling max over +-ms/2 (mode 'nearest')
    const n = b.n;
    const out = new Float64Array(n);
    const dur = Math.max(b.duration, 1.0);
    const medDt = Math.max(dur / Math.max(n, 1), 1.0);
    const half = Math.max(1, Math.round(0.5 * ms / medDt));
    const size = 2 * half + 1;
    // sliding window max via monotonic deque
    const dq = [];
    for (let i = 0; i < n; i++) {
        while (dq.length && dq[0] <= i - size) dq.shift();
        while (dq.length && D[dq[dq.length - 1]] <= D[i]) dq.pop();
        dq.push(i);
        out[i] = D[dq[0]];
    }
    return out;
}

function aggregatePow(b, s, D, w, p) {
    const pw = Math.max(p.agg_k, 0.05);
    let acc = 0, sw = 0;
    const n = b.n;
    for (let r = 0; r < n; r++) {
        const Dv = Math.max(Number.isFinite(D[r]) ? D[r] : 0.0, 0.0);
        acc += w[r] * Math.pow(Dv, pw);
        sw += w[r];
    }
    return [Math.pow(acc / Math.max(sw, EPS), 1.0 / pw), sw];
}

function postprocess(b, s, sr, p) {
    const nEff = b.nNotes;
    let v = sr * nEff / (nEff + Math.max(p.pp_n0, 1e-6));
    const thr = p.pp_thr, div = Math.max(p.pp_div, 1e-3);
    if (v > thr) v = thr + (v - thr) / div;
    return Math.max(v * p.pp_scale * p.calib_a + p.calib_b, 0.0);
}

// ============================================================
// RC / LN (rc_ln_model/rcln/engine.py)
// ============================================================

// RC curves: ln_body_ms = 0, then full recompute; Rbar/Cbar zeroed
// Light RC path: only Pbar depends on ln_body_ms (proven bit-identical to the
// full recompute by rc_ln_model tests/test_identity.py T6). All other curves
// are unchanged by zeroing ln_body; Rbar/Cbar are zeroed explicitly.
function computePbarRC(b, s, p) {
    const n = b.n;
    const xp = Math.pow(b.x, p.od_mult_p);
    const d = b.dtModel;
    const tauC = p.chord_tau_c || 0.0;
    let dFp = d;
    if (tauC > 0.0) {
        const [wf, wb] = chordCoupling(b, s, tauC);
        const attIdx = [];
        for (let r = 0; r < n; r++) if (wb[r] === 0.0) attIdx.push(r);
        dFp = Float64Array.from(d);
        for (let r = 0; r < n; r++) {
            let lo = 0, hi = attIdx.length;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (attIdx[mid] <= r) lo = mid + 1; else hi = mid; }
            if (lo < attIdx.length) {
                const na = attIdx[lo];
                const v = (b.t[na] - b.t[r]) / 1000.0;
                if (v > 0) dFp[r] = v;
            }
        }
    }
    const fp = new Float64Array(n), bst = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const q = Math.min(dFp[r] - xp / 2.0, xp / 6.0);
        fp[r] = Math.pow(Math.max(p.p_scale / xp * (1.0 - (p.p_lam3 / xp) * q * q), 0.0), 0.25);
        const rr = 7.5 / d[r];
        bst[r] = (rr > p.p_boost_lo && rr < p.p_boost_hi)
            ? 1.0 + p.p_boost * (rr - p.p_boost_lo) * Math.pow(rr - p.p_boost_hi, 2.0) : 1.0;
    }
    const chw = [1.0, 1.0, p.p_chw2, p.p_chw3, p.p_chw4, p.p_chw5, p.p_chw6, p.p_chw7];
    const inc = zeros(n);
    if (tauC > 0.0) {
        const u = triWindowCount(b, s, Float64Array.from(b.size), tauC);
        for (let r = 0; r < n; r++) {
            const uu = clamp(u[r], 1.0, K);
            const i0 = Math.min(Math.floor(uu), K - 1);
            const frac = uu - i0;
            const chwU = chw[i0] * (1.0 - frac) + chw[i0 + 1] * frac;
            // vv = 1 → body term zero; attack discount from coupling
            const mix = Math.max(bst[r], 1.0);
            inc[r] = (1.0 / d[r]) * fp[r] * chwU * mix;
        }
        // attack discount on the rate part
        const [wf, wb] = chordCoupling(b, s, tauC);
        for (let r = 0; r < n; r++) inc[r] *= (1.0 - wb[r]);
    } else {
        for (let r = 0; r < n; r++) {
            const chwU = chw[Math.min(b.size[r], K)];
            inc[r] = (1.0 / d[r]) * fp[r] * chwU * Math.max(bst[r], 1.0);
        }
    }
    for (let r = 0; r < n; r++) {
        const am = 1.0 + p.an_on_p * Math.min(s.anchorRaw[r] - p.an_a0,
            p.an_cubic * Math.pow(s.anchorRaw[r] - p.an_a1, 3.0));
        const v0 = inc[r] * am;
        inc[r] = Math.min(v0, Math.max(inc[r], inc[r] * p.p_sat_b - p.p_sat_a));
    }
    if (p.p_burst3) {
        const b3 = wcount(b, s, s.noteImpulse, 100.0);
        for (let r = 0; r < n; r++) inc[r] += p.p_burst3 * b3[r] * 10.0;
    }
    if (p.p_burst4) {
        const b4 = wcount(b, s, s.noteImpulse, 150.0);
        for (let r = 0; r < n; r++) inc[r] += p.p_burst4 * b4[r] * 6.6667;
    }
    return wmean(b, s, inc, p.w_p);
}

function computeCurvesRC(b, s, p, curMain) {
    const n = b.n;
    const curRc = {
        Jbar: curMain.Jbar, Jm: curMain.Jm, Jc: curMain.Jc, Ja: curMain.Ja,
        Pbar: curMain.Pbar, Xbar: curMain.Xbar, Abar: curMain.Abar,
        Rbar: zeros(n), Cbar: zeros(n),
        EyeR: curMain.EyeR, Chord2: curMain.Chord2, Recov: curMain.Recov,
        SHd: curMain.SHd,
    };
    if (b.tailN === 0) {
        // no LNs: RC chart — identical curves (Rbar/Cbar already 0 in main)
        curRc.Rbar = curMain.Rbar;
        curRc.Cbar = curMain.Cbar;
        return curRc;
    }
    const saved = Float64Array.from(s.lnBodyMs);
    s.lnBodyMs.fill(0.0);
    curRc.Pbar = computePbarRC(b, s, p);
    s.lnBodyMs.set(saved);
    return curRc;
}

// LN presence weights g(t)
function lnPresence(b, s, p) {
    const n = b.n;
    const ind = new Uint8Array(n);
    for (let r = 0; r < n; r++) ind[r] = s.held[r] > 0 ? 1 : 0;
    for (let r = 0; r < n; r++) if (b.isLn[r]) ind[r] = 1;
    for (let j = 0; j < b.tailN; j++) ind[b.tailJ0[j]] = 1;
    const indF = new Float64Array(n);
    for (let r = 0; r < n; r++) indF[r] = ind[r];
    const wMs = Math.max(p.ln_mask_w, 50.0);
    const g = wmean(b, s, indF, wMs);
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) out[r] = Math.pow(clamp(g[r] * (p.ln_gain || 1.0), 0.0, 1.0), p.ln_g_exp);
    return out;
}

// LN aggregation: row weights * g(t), power mean (mode 3 shape)
function aggregateLN(b, s, D, g, p) {
    const n = b.n;
    let Dv = D;
    if (p.env_w) {
        const E = peakEnvelope(b, s, D, Math.max(p.env_ms, 50.0));
        Dv = new Float64Array(n);
        for (let r = 0; r < n; r++) Dv[r] = (1.0 - p.env_w) * D[r] + p.env_w * E[r];
    }
    // python aggregate_ln always applies the hold downweight (unlike
    // aggregate(hold_w=False) on the RC path)
    const w = aggregateWeights(b, s, p, true);
    const pw = Math.max(p.agg_k, 0.05);
    let acc = 0, swl = 0, sw = 0;
    for (let r = 0; r < n; r++) {
        const wl = w[r] * g[r];
        const DD = Math.max(Number.isFinite(Dv[r]) ? Dv[r] : 0.0, 0.0);
        acc += wl * Math.pow(DD, pw);
        swl += wl;
        sw += w[r];
    }
    const cov = swl / Math.max(sw, EPS);
    let sr = swl > 1e-9 ? Math.pow(acc / Math.max(swl, EPS), 1.0 / pw) : 0.0;
    return [sr, cov];
}

function postprocessLN(b, s, sr, cov, p) {
    const nEff = b.nNotes * clamp(cov, 0.0, 1.0);
    const n0 = Math.max(p.ln_n0, 1e-6);
    let v = sr * nEff / (nEff + n0);
    const thr = p.pp_thr, div = Math.max(p.pp_div, 1e-3);
    if (v > thr) v = thr + (v - thr) / div;
    v = v * p.pp_scale * p.calib_a + p.calib_b;
    v = v * (p.ln_calib_a || 1.0) + (p.ln_calib_b || 0.0);
    return Math.max(v, 0.0);
}

// ============================================================
// MAIN ENTRY — evaluate one chart
// ============================================================
function evaluateChart(osuContent, speedRate, p) {
    p = p || SPM_V1_PARAMS;
    const nt = parseOsu(osuContent, speedRate);
    if (!nt || nt.nNotes < 2) return { error: "not a valid mania chart" };
    const b = buildBatch(nt);
    if (!b) return { error: "too few notes" };
    const s = buildStruct(b, p);

    // ---- spm difficulty
    const cur = computeCurves(b, s, p);
    const D = combine(b, s, cur, p);
    const wHold = aggregateWeights(b, s, p, true);
    const [srRaw] = aggregatePow(b, s, D, wHold, p);
    const star = postprocess(b, s, srRaw, p);

    // ---- RC difficulty (de-LN chart)
    const curRc = computeCurvesRC(b, s, p, cur);
    const DRc = combine(b, s, curRc, p);
    const wNo = aggregateWeights(b, s, p, false);
    const [srRcRaw] = aggregatePow(b, s, DRc, wNo, p);
    const starRc = postprocess(b, s, srRcRaw, p);

    // ---- LN difficulty (presence-weighted aggregation on D)
    const g = lnPresence(b, s, p);
    const [srLnRaw, cov] = aggregateLN(b, s, D, g, p);
    const starLn = postprocessLN(b, s, srLnRaw, cov, p);

    return {
        star, starRc, starLn, lnCov: cov,
        nNotes: nt.nNotes, keyCount: nt.keyCount, od: nt.od,
        nRows: b.n, duration: b.duration / 1000.0,
        D, Drc: DRc, g,
        // curve for display (calibrated like postprocess shape over rows)
        b, s,
    };
}

// display curve: per-row D with pp_n0-style note-count scaling omitted —
// the v0.5 overlay displayed the calibrated D array; we expose the raw D
// rescaled to the star's range via affine pp mapping (no per-chart scalar).
function displayCurves(res) {
    const n = res.nRows;
    const star = res.star;
    // match aggregate level: weighted power-mean of D ≈ sr_raw; derive affine
    // by rescaling D so its weighted mean equals the pre-postprocess value.
    const p = SPM_V1_PARAMS;
    const Dv = res.D;
    const w = aggregateWeights(res.b, res.s, p, true);
    const pw = Math.max(p.agg_k, 0.05);
    let acc = 0, sw = 0;
    for (let r = 0; r < n; r++) { acc += w[r] * Math.pow(Math.max(Dv[r], 0), pw); sw += w[r]; }
    const mean = Math.pow(acc / Math.max(sw, EPS), 1.0 / pw);
    const scale = mean > 1e-9 ? (star - p.calib_b) / (p.pp_scale * p.calib_a) / mean : 0;
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) out[r] = Math.max(Dv[r] * scale, 0);
    return out;
}

/** RC display curve on the same calibrated star scale as displayCurves():
 *  rescale raw Drc with the RC rating's own affine mapping, so the RC line
 *  and the (total-calibrated) LN line share one scale when drawn together.
 *  v1.0.0 drew the raw Drc here — fine while each line was renormalised on
 *  its own, wrong once absolute segment values are read from the curves. */
function displayCurvesRC(res) {
    const n = res.nRows;
    const star = res.starRc;
    const p = SPM_V1_PARAMS;
    const Dv = res.Drc;
    const w = aggregateWeights(res.b, res.s, p, false);
    const pw = Math.max(p.agg_k, 0.05);
    let acc = 0, sw = 0;
    for (let r = 0; r < n; r++) { acc += w[r] * Math.pow(Math.max(Dv[r], 0), pw); sw += w[r]; }
    const mean = Math.pow(acc / Math.max(sw, EPS), 1.0 / pw);
    const scale = mean > 1e-9 ? (star - p.calib_b) / (p.pp_scale * p.calib_a) / mean : 0;
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) out[r] = Math.max(Dv[r] * scale, 0);
    return out;
}

// ---- section data for the difficulty curve display (400ms buckets)
const SECTION_LENGTH_MS = 400;
function computeSectionData(allRows, times, Darr, firstTime, lastTime) {
    const sectionTimes = [], sectionDifficulties = [];
    if (!times || times.length === 0) return { sectionDifficulties, sectionTimes };
    if (firstTime == null) firstTime = times[0];
    if (lastTime == null) lastTime = times[times.length - 1];
    let ci = 0;
    let sectionStart = firstTime;
    while (sectionStart < lastTime) {
        const sectionEnd = sectionStart + SECTION_LENGTH_MS;
        while (ci < times.length && times[ci] < sectionStart) ci++;
        let maxD = 0;
        for (let j = ci; j < times.length && times[j] < sectionEnd; j++)
            if (Darr[j] > maxD) maxD = Darr[j];
        sectionTimes.push(sectionStart);
        sectionDifficulties.push(maxD);
        sectionStart = sectionEnd;
    }
    return { sectionDifficulties, sectionTimes };
}

// ============================================================
// v1.0.1 — playable curve (curve smoothing)
// ============================================================
// The raw curves above are per-400ms MAX envelopes: a bucket that happens to
// contain no note row reads 0, and a dense burst next to a rest makes the
// polyline jump. That raw shape is what a viewer perceives as "sharp/harsh".
//
// Kernel: repeated 3-tap binomial ([1,2,1]/4, edges replicate-clamped). One
// pass is the law {-1,0,+1} with p={1/4,1/2,1/4}, so `r` passes have variance
// r/2 and sd sqrt(r/2) buckets. To hit a target sd exactly, run floor(rExact)
// passes and blend one more by the fractional part — a convex combination of
// two symmetric zero-mean kernels, so the sd is exactly sqrt(rExact/2).
//
// Strength is expressed in PIXELS of the drawn curve, not in seconds: with a
// fixed bucket count the same sigma in seconds is 0.4px on a long marathon and
// 4.4px on a short chart, so the setting would mean something different on
// every map. Converting through the curve's pixel width makes one setting mean
// the same visual amount of smoothing everywhere.
const CURVE_SIGMA_PX = { off: 0, light: 0.75, medium: 2.0, strong: 4.0, extreme: 8.0 };
// Typical drawn inner width of the curve canvas in CSS pixels (the overlay is
// 380px wide with 16px padding and a 3px plot pad). Only used to pre-compute
// the smoothed series at map-analysis time; a resize re-runs it.
const CURVE_INNER_W = 342;
// An isolated 0 in the TOTAL/RC envelope means "this 400ms window happened to
// contain no note row", not "the map is resting here": measured over the test
// corpus 76% of zero runs are <= 2 buckets (<= 800ms), while genuine rests run
// to 50+ buckets. Filling only the short ones removes the artifact dips without
// inventing difficulty inside real breaks.
const CURVE_FILL_RUN_MAX = 2;
// How the kernel treats values separated by zeros.
//   'runs'    — every maximal run of values is blurred on its own, with the
//               run's edges clamped; values outside a run stay exactly 0.
//   'uniform' — the whole series is one run (zeros included).
// 'runs' is the default because it is the honest one for the LN line: there a
// 0 means "no hold is being held here", and a uniform blur would bleed
// neighbouring LN difficulty into those buckets, drawing hold difficulty where
// the map has none (measured: up to x1.86 on the drawn LN area).
const CURVE_SMOOTH_MODE = { runs: 'runs', uniform: 'uniform' };

/** sd in buckets for a pixel-space sigma over `n` bucket samples.
 *  Also keeps the kernel inside the series: on a chart shorter than ~6 sigma
 *  the blur would flatten the whole curve, so the sd is capped at (n-1)/6 —
 *  the ±3σ kernel then still fits, and every setting keeps some shape. */
function curveSigmaBuckets(sigmaPx, n, innerWidthPx) {
    if (!(sigmaPx > 0) || n < 2) return 0;
    const w = innerWidthPx > 8 ? innerWidthPx : CURVE_INNER_W;
    return Math.min(sigmaPx * (n - 1) / w, (n - 1) / 6);
}

/** Upper bound on the number of 3-tap passes. The kernel sd after r passes
 *  is sqrt(r/2) buckets, so hitting an 8px sigma on a 10-minute marathon
 *  (~1500 buckets over 342px) needs ~2000 passes. The cap keeps the cost
 *  bounded on absurd inputs; the run is per settings-change, never per frame. */
const CURVE_MAX_PASSES = 2048;

/** Linear-interpolate zero runs of at most `maxRun` buckets (never the ones
 *  touching either end). Returns a NEW array; `vals` is left untouched. */
function fillShortZeroRuns(vals, maxRun) {
    const n = vals.length;
    const out = Float64Array.from(vals);
    if (!(maxRun > 0)) return out;
    let i = 0;
    while (i < n) {
        // strict progress: the cursor always advances, so `vals` containing
        // NaN or negatives cannot turn this into an infinite scan
        if (out[i] > 0) { i++; continue; }
        let j = i + 1;
        while (j < n && !(out[j] > 0)) j++;
        const len = j - i;
        if (len <= maxRun && i > 0 && j < n) {
            const a = out[i - 1], b = out[j];
            const span = j - (i - 1);
            const step = (b - a) / span;
            for (let k = i; k < j; k++) out[k] = a + step * (k - (i - 1));
        }
        i = j;
    }
    return out;
}

/** One binomial pass over cur[lo..hi), edges clamped to the run boundaries. */
function binomialPass(cur, alt, lo, hi) {
    for (let i = lo; i < hi; i++) {
        const x = cur[i > lo ? i - 1 : lo];
        const y = cur[i];
        const z = cur[i < hi - 1 ? i + 1 : hi - 1];
        alt[i] = y + 0.25 * ((x - y) + (z - y));
    }
}

/** Gaussian-approximating smoothing of one difficulty series.
 *  `sigmaPx`      target sd in drawn pixels (0 = identity, same reference)
 *  `innerWidthPx` the plot width the sigma is measured against
 *  `fillRunMax`   short zero-run fill (see CURVE_FILL_RUN_MAX); pass 0 to
 *                 leave the series' zeros strictly alone
 *  `mode`         CURVE_SMOOTH_MODE — 'runs' (default) blurs each maximal run
 *                 of non-zero samples on its own, edges clamped to the run, so
 *                 everything outside a run stays at exactly 0; 'uniform' blurs
 *                 the series as a whole, zeros included.
 *  The result always has the same length and time base as the input, and never
 *  exceeds the input's maximum (the kernel is a normalised average). */
function smoothCurve(vals, sigmaPx, innerWidthPx, fillRunMax, mode) {
    const n = vals ? vals.length : 0;
    const sigmaBuckets = curveSigmaBuckets(sigmaPx, n, innerWidthPx);
    if (!(sigmaBuckets > 0) || n < 2) return vals;
    const rExact = Math.min(2 * sigmaBuckets * sigmaBuckets, CURVE_MAX_PASSES);
    const passes = Math.floor(rExact);
    const frac = rExact - passes < 1e-9 ? 0 : rExact - passes;

    const cur = fillShortZeroRuns(vals, fillRunMax || 0);
    const alt = new Float64Array(n);
    const out = new Float64Array(n);

    // map out the regions to blur first, so a region can be processed with
    // alternating buffers instead of copying the result back each pass
    const ranges = [];
    if (mode === 'uniform') {
        ranges.push(0, n);
    } else {
        let i = 0;
        while (i < n) {
            while (i < n && !(cur[i] > 0)) i++;
            if (i >= n) break;
            let j = i + 1;
            while (j < n && cur[j] > 0) j++;
            ranges.push(i, j);
            i = j;
        }
    }

    for (let r = 0; r < ranges.length; r += 2) {
        const lo = ranges[r], hi = ranges[r + 1];
        if (hi - lo < 2) {
            // a lone sample has no neighbours to average with: pass it through
            for (let k = lo; k < hi; k++) out[k] = cur[k];
            continue;
        }
        let a = cur, b = alt;
        for (let p = 0; p < passes; p++) {
            binomialPass(a, b, lo, hi);
            const t = a; a = b; b = t;
        }
        for (let k = lo; k < hi; k++) {
            const y = a[k];
            if (frac === 0) {
                out[k] = y;
            } else {
                const x = a[k > lo ? k - 1 : lo];
                const z = a[k < hi - 1 ? k + 1 : hi - 1];
                out[k] = y + frac * (0.25 * ((x - y) + (z - y)));
            }
        }
    }
    return Array.from(out);
}

// ============================================================
// v1.0.1 — per-segment difficulty stats
// ============================================================
// SECTION_LENGTH_MS buckets are laid out contiguously from firstNoteTime, so
// sectionTimes[k] is exactly firstNoteTime + k*400 (verified on every test
// chart). That makes the bucket index derivable from a time and lets a
// segment's difficulty be read straight off the same curve the timeline and
// the playhead use — the number in the row therefore always belongs to the
// tag next to it.
//
// Statistic: the plain mean of the covered buckets. The series already is a
// per-window maximum, and a mean over it is what keeps rest sections low
// (measured: rest segments read 0.3–7.0 while their hardest single bucket
// reads up to 11.5, which would be a false alarm next to a "Break" label).
// `peak` is reported alongside for the tooltip.
function computeSegmentStats(segments, result) {
    if (!segments || !result) return null;
    const times = result.sectionTimes;
    const diffs = result.sectionDifficulties;
    if (!times || !times.length) return null;
    const n = times.length;
    const out = [];
    let k = 0;
    for (const seg of segments) {
        // advance to the first bucket that still overlaps the segment
        while (k < n && times[k] + SECTION_LENGTH_MS <= seg.start) k++;
        let sum = 0, cnt = 0, peak = 0, sumPos = 0, cntPos = 0;
        for (let j = k; j < n && times[j] < seg.end; j++) {
            const v = diffs[j];
            sum += v; cnt++;
            if (v > peak) peak = v;
            if (v > 0) { sumPos += v; cntPos++; }
        }
        const mean = cnt ? sum / cnt : 0;
        // same family split the map type uses, from the segment's LN share
        const kind = seg.family === "ln" ? "LN" : "RC";
        out.push({
            mean,
            activeMean: cntPos ? sumPos / cntPos : 0,
            peak,
            buckets: cnt,
            dan: srToDanLevel(mean, result.keyCount, kind),
        });
    }
    return out;
}

// ============================================================
// v1.0.1 — beatmap metadata for the summary line
// ============================================================
// Read straight from the .osu header so the summary works for every key count
// (the 7K-only tag engine is not involved) and does not depend on which
// fields the running client happens to expose over the websocket.
function parseOsuMeta(content) {
    if (!content) return null;
    const meta = {
        title: "", artist: "", creator: "", version: "", source: "",
        od: null, hp: null, keyCount: null,
        bpm: null, bpmMin: null, bpmMax: null,
        circles: 0, holds: 0, objects: 0,
        firstObject: 0, lastObject: 0, durationMs: 0,
    };
    const beatLengths = [];
    let section = "";
    for (const raw of content.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("[")) { section = line.slice(1, line.indexOf("]")).toLowerCase(); continue; }
        const ci = line.indexOf(":");
        if (section === "metadata" && ci > 0) {
            const k = line.slice(0, ci).trim(), v = line.slice(ci + 1).trim();
            if (k === "Title") meta.title = v;
            else if (k === "Artist") meta.artist = v;
            else if (k === "Creator") meta.creator = v;
            else if (k === "Version") meta.version = v;
            else if (k === "Source") meta.source = v;
        } else if (section === "difficulty" && ci > 0) {
            const k = line.slice(0, ci).trim(), v = parseFloat(line.slice(ci + 1).trim());
            if (k === "CircleSize") meta.keyCount = Math.round(v);
            else if (k === "OverallDifficulty") meta.od = v;
            else if (k === "HPDrainRate") meta.hp = v;
        } else if (section === "timingpoints") {
            const p = line.split(",");
            if (p.length < 2) continue;
            const bl = parseFloat(p[1]);
            const uninherited = p.length >= 7 ? p[6].trim() !== "0" : bl > 0;
            // ignore gimmick tempo points (stops, "0 BPM" memes): the summary
            // line should describe the playable tempo span
            const bpm = 60000 / bl;
            if (uninherited && bl > 0 && Number.isFinite(bl) && bpm >= 30 && bpm <= 1500) beatLengths.push(bl);
        } else if (section === "hitobjects") {
            const p = line.split(",");
            if (p.length < 5) continue;
            const t = parseFloat(p[2]);
            if (!Number.isFinite(t)) continue;
            const type = parseInt(p[3], 10);
            let tail = t;
            if (type & 128) {
                meta.holds++;
                const e = parseFloat(String(p[5] ?? p[4]).split(":")[0]);
                if (Number.isFinite(e)) tail = Math.max(e, t);
            } else if (type & 1) {
                meta.circles++;
            } else {
                continue;
            }
            meta.objects++;
            if (meta.objects === 1 || t < meta.firstObject) meta.firstObject = t;
            if (tail > meta.lastObject) meta.lastObject = tail;
        }
    }
    if (beatLengths.length) {
        const sorted = beatLengths.slice().sort((a, b) => a - b);
        // "common" BPM = the median uninherited beat length, so a single stray
        // timing point does not move the number the way a plain mean would
        meta.bpm = Math.round(60000 / sorted[Math.floor(sorted.length / 2)]);
        meta.bpmMax = Math.round(60000 / sorted[0]);
        meta.bpmMin = Math.round(60000 / sorted[sorted.length - 1]);
    }
    if (meta.lastObject < meta.firstObject) meta.lastObject = meta.firstObject;
    meta.durationMs = Math.max(0, meta.lastObject - meta.firstObject);
    return meta;
}

// ============================================================
// DAN MAPPING — piecewise-linear interpolation on measured nodes
// (tools/measure_dan_nodes.py → dan_constants.json)
// ============================================================
// Name ladders per key mode:
//   4K RC : 1st..10th, then the REFORM extra dans Alpha..Epsilon (11..15)
//   4K LN : numeric 1st..15th
//   6K    : numeric (RC 0th..9th, LN 0th..14th)
//   7K    : 0th..10th, Gamma/Azimuth/Zenith/Stellium (11..14)
// Number style ignores the ladders and shows the decimal level.
const DAN_EXTRA_4K_RC = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
const DAN_EXTRA_7K = ["Gamma", "Azimuth", "Zenith", "Stellium"];

function danOrdinal(i) {
    const n = Math.round(i);
    if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
    switch (n % 10) {
        case 1: return n + "st";
        case 2: return n + "nd";
        case 3: return n + "rd";
        default: return n + "th";
    }
}

function danNameForLevel(dan, keyCount, kind) {
    const i = Math.round(dan);
    if (keyCount === 7 && i >= 11 && i <= 14) return DAN_EXTRA_7K[i - 11];
    if (keyCount === 4 && String(kind).toUpperCase() === "RC" &&
        i >= 11 && i <= 15) return DAN_EXTRA_4K_RC[i - 11];
    return danOrdinal(i);
}

// ============================================================
// DAN NODES — measured star -> dan level anchors (see dan_constants.json)
// Generated by tools/generate_dan_constants.py from spm v1.0.0 + rc-ln
// ratings of the dan course packs / dataset dan subset.
// ============================================================
const DAN_NODES_DEFAULT = {"_note":"SPM Rating v1.0.0 + rc-ln-0.1.0 dan nodes. RC/LN star nodes measured on dan course packs (4K/6K) and the 7K dan dataset subset; interpolation maps star -> continuous dan level.","dan_names":["0th","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","Gamma","Azimuth","Zenith","Stellium"],"modes":{"4K":{"RC":{"nodes":[{"dan":1.0,"sr":4.0208},{"dan":2.0,"sr":4.6648},{"dan":3.0,"sr":4.6648},{"dan":4.0,"sr":5.8555},{"dan":5.0,"sr":6.5143},{"dan":6.0,"sr":7.1491},{"dan":7.0,"sr":7.6171},{"dan":8.0,"sr":8.5556},{"dan":9.0,"sr":8.7292},{"dan":10.0,"sr":9.4459},{"dan":11.0,"sr":9.6211},{"dan":12.0,"sr":9.9713},{"dan":13.0,"sr":10.7001},{"dan":14.0,"sr":11.6387},{"dan":15.0,"sr":13.5081}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":1.0,"sr":4.8726},{"dan":2.0,"sr":5.6284},{"dan":3.0,"sr":6.2091},{"dan":4.0,"sr":6.2091},{"dan":5.0,"sr":6.4},{"dan":6.0,"sr":6.9771},{"dan":7.0,"sr":7.6831},{"dan":8.0,"sr":8.0826},{"dan":9.0,"sr":8.6711},{"dan":10.0,"sr":9.2017},{"dan":11.0,"sr":9.8331},{"dan":12.0,"sr":10.2015},{"dan":13.0,"sr":11.1757},{"dan":14.0,"sr":11.8675},{"dan":15.0,"sr":12.6583}],"source":"maps/ dan packs"}},"6K":{"RC":{"nodes":[{"dan":0.0,"sr":3.6317},{"dan":1.0,"sr":4.1375},{"dan":2.0,"sr":4.8006},{"dan":3.0,"sr":5.5732},{"dan":4.0,"sr":6.0613},{"dan":5.0,"sr":6.6976},{"dan":6.0,"sr":7.1534},{"dan":7.0,"sr":7.5146},{"dan":8.0,"sr":7.9989},{"dan":9.0,"sr":8.6019}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":0.0,"sr":4.0363},{"dan":1.0,"sr":4.9384},{"dan":2.0,"sr":5.1079},{"dan":3.0,"sr":5.6718},{"dan":4.0,"sr":6.4445},{"dan":5.0,"sr":6.4512},{"dan":6.0,"sr":7.0152},{"dan":7.0,"sr":7.3947},{"dan":8.0,"sr":7.949},{"dan":9.0,"sr":7.9944},{"dan":10.0,"sr":8.5633},{"dan":11.0,"sr":8.8391},{"dan":12.0,"sr":9.4934},{"dan":13.0,"sr":9.8917},{"dan":14.0,"sr":10.8678}],"source":"maps/ dan packs"}},"7K":{"RC":{"nodes":[{"dan":0.0,"sr":3.7546},{"dan":1.0,"sr":4.1656},{"dan":2.0,"sr":4.7922},{"dan":3.0,"sr":5.2249},{"dan":4.0,"sr":5.4118},{"dan":5.0,"sr":5.7669},{"dan":6.0,"sr":6.3758},{"dan":7.0,"sr":6.8118},{"dan":8.0,"sr":7.1672},{"dan":9.0,"sr":7.7366},{"dan":10.0,"sr":8.242},{"dan":11.0,"sr":8.8514},{"dan":12.0,"sr":9.3732},{"dan":13.0,"sr":10.1529},{"dan":14.0,"sr":10.6116}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses"},"LN":{"nodes":[{"dan":0.0,"sr":4.4554},{"dan":1.0,"sr":4.644},{"dan":2.0,"sr":4.6577},{"dan":3.0,"sr":5.2726},{"dan":4.0,"sr":5.8952},{"dan":5.0,"sr":6.0215},{"dan":6.0,"sr":6.5725},{"dan":7.0,"sr":6.7175},{"dan":8.0,"sr":7.405},{"dan":9.0,"sr":7.5857},{"dan":10.0,"sr":8.3702},{"dan":11.0,"sr":8.8079},{"dan":12.0,"sr":9.3984},{"dan":13.0,"sr":10.2228},{"dan":14.0,"sr":11.3869}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses"}}},"4K":{"RC":{"nodes":[{"dan":1.0,"sr":4.0208},{"dan":2.0,"sr":4.6648},{"dan":3.0,"sr":4.6648},{"dan":4.0,"sr":5.8555},{"dan":5.0,"sr":6.5143},{"dan":6.0,"sr":7.1491},{"dan":7.0,"sr":7.6171},{"dan":8.0,"sr":8.5556},{"dan":9.0,"sr":8.7292},{"dan":10.0,"sr":9.4459},{"dan":11.0,"sr":9.6211},{"dan":12.0,"sr":9.9713},{"dan":13.0,"sr":10.7001},{"dan":14.0,"sr":11.6387},{"dan":15.0,"sr":13.5081}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":1.0,"sr":4.8726},{"dan":2.0,"sr":5.6284},{"dan":3.0,"sr":6.2091},{"dan":4.0,"sr":6.2091},{"dan":5.0,"sr":6.4},{"dan":6.0,"sr":6.9771},{"dan":7.0,"sr":7.6831},{"dan":8.0,"sr":8.0826},{"dan":9.0,"sr":8.6711},{"dan":10.0,"sr":9.2017},{"dan":11.0,"sr":9.8331},{"dan":12.0,"sr":10.2015},{"dan":13.0,"sr":11.1757},{"dan":14.0,"sr":11.8675},{"dan":15.0,"sr":12.6583}],"source":"maps/ dan packs"}},"6K":{"RC":{"nodes":[{"dan":0.0,"sr":3.6317},{"dan":1.0,"sr":4.1375},{"dan":2.0,"sr":4.8006},{"dan":3.0,"sr":5.5732},{"dan":4.0,"sr":6.0613},{"dan":5.0,"sr":6.6976},{"dan":6.0,"sr":7.1534},{"dan":7.0,"sr":7.5146},{"dan":8.0,"sr":7.9989},{"dan":9.0,"sr":8.6019}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":0.0,"sr":4.0363},{"dan":1.0,"sr":4.9384},{"dan":2.0,"sr":5.1079},{"dan":3.0,"sr":5.6718},{"dan":4.0,"sr":6.4445},{"dan":5.0,"sr":6.4512},{"dan":6.0,"sr":7.0152},{"dan":7.0,"sr":7.3947},{"dan":8.0,"sr":7.949},{"dan":9.0,"sr":7.9944},{"dan":10.0,"sr":8.5633},{"dan":11.0,"sr":8.8391},{"dan":12.0,"sr":9.4934},{"dan":13.0,"sr":9.8917},{"dan":14.0,"sr":10.8678}],"source":"maps/ dan packs"}},"7K":{"RC":{"nodes":[{"dan":0.0,"sr":3.7546},{"dan":1.0,"sr":4.1656},{"dan":2.0,"sr":4.7922},{"dan":3.0,"sr":5.2249},{"dan":4.0,"sr":5.4118},{"dan":5.0,"sr":5.7669},{"dan":6.0,"sr":6.3758},{"dan":7.0,"sr":6.8118},{"dan":8.0,"sr":7.1672},{"dan":9.0,"sr":7.7366},{"dan":10.0,"sr":8.242},{"dan":11.0,"sr":8.8514},{"dan":12.0,"sr":9.3732},{"dan":13.0,"sr":10.1529},{"dan":14.0,"sr":10.6116}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses"},"LN":{"nodes":[{"dan":0.0,"sr":4.4554},{"dan":1.0,"sr":4.644},{"dan":2.0,"sr":4.6577},{"dan":3.0,"sr":5.2726},{"dan":4.0,"sr":5.8952},{"dan":5.0,"sr":6.0215},{"dan":6.0,"sr":6.5725},{"dan":7.0,"sr":6.7175},{"dan":8.0,"sr":7.405},{"dan":9.0,"sr":7.5857},{"dan":10.0,"sr":8.3702},{"dan":11.0,"sr":8.8079},{"dan":12.0,"sr":9.3984},{"dan":13.0,"sr":10.2228},{"dan":14.0,"sr":11.3869}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses"}}};

let DAN_CONSTANTS = DAN_NODES_DEFAULT;

function loadDanConstants(obj) {
    DAN_CONSTANTS = obj;
}

// SR -> continuous dan level via piecewise-linear interpolation over nodes
function interpDan(sr, nodes) {
    // nodes: [{dan, sr}] sorted by dan
    const n = nodes.length;
    if (n === 0) return 0;
    const EPS2 = 0.002;
    for (let i = 0; i < n; i++) {
        if (Math.abs(sr - nodes[i].sr) < EPS2) return nodes[i].dan;
    }
    if (sr <= nodes[0].sr) {
        if (n < 2) return nodes[0].dan;
        const slope = (nodes[1].dan - nodes[0].dan) / Math.max(nodes[1].sr - nodes[0].sr, 1e-4);
        return Math.min(0, nodes[0].dan + slope * (sr - nodes[0].sr));
    }
    if (sr >= nodes[n - 1].sr) {
        if (n < 2) return nodes[n - 1].dan;
        const slope = (nodes[n - 1].dan - nodes[n - 2].dan) / Math.max(nodes[n - 1].sr - nodes[n - 2].sr, 1e-4);
        return nodes[n - 1].dan + slope * (sr - nodes[n - 1].sr);
    }
    let i = 0;
    for (; i < n - 1; i++) if (sr < nodes[i + 1].sr) break;
    const t = (sr - nodes[i].sr) / Math.max(nodes[i + 1].sr - nodes[i].sr, 1e-4);
    return nodes[i].dan + t * (nodes[i + 1].dan - nodes[i].dan);
}

function danTableFor(keyCount, kind) {
    if (!DAN_CONSTANTS) return null;
    const mode = keyCount === 4 ? "4K" : keyCount === 6 ? "6K" : "7K";
    const tbl = DAN_CONSTANTS[mode] && DAN_CONSTANTS[mode][kind];
    return tbl || null;
}

function srToDanLevel(sr, keyCount, kind) {
    const tbl = danTableFor(keyCount, kind);
    if (!tbl || !tbl.nodes || tbl.nodes.length === 0) return null;
    return interpDan(sr, tbl.nodes);
}

/** Dan level → display label.
 *  style "third"  → "Gamma low" / "Gamma" / "Gamma high"  (v0.5.1 style)
 *  style "pm"     → "Gamma-"   / "Gamma" / "Gamma+"
 *  style "number" → "11.37"                                     */
function danLevelToLabel(level, keyCount, kind, style) {
    style = style || "third";
    // ladder length comes from this keycount/kind's node table, so modes
    // without a top-range node (e.g. 7K has no Stellium course) top out at
    // their highest measured dan; names come from danNameForLevel
    const tbl = danTableFor(keyCount, kind);
    const topDan = tbl && tbl.nodes && tbl.nodes.length
        ? tbl.nodes[tbl.nodes.length - 1].dan : 14;
    const top = Math.round(topDan);
    if (style === "number") {
        if (!Number.isFinite(level)) return "-";
        return Math.max(level, 0).toFixed(2);
    }
    if (!Number.isFinite(level)) return "-";
    // below the lowest dan (level < 0) or above the highest measured dan:
    // clamped names with out-of-range marker (leoblack style)
    if (level < 0) return "< " + danNameForLevel(0, keyCount, kind);
    if (level > top + 0.5) {
        return "> " + danNameForLevel(top, keyCount, kind);
    }
    // find the bin: dan d spans [d-0.5, d+0.5)
    const idx = Math.max(0, Math.min(top, Math.round(level)));
    const name = danNameForLevel(idx, keyCount, kind);
    const frac = level - idx; // -0.5 .. +0.5 within the dan's span
    if (style === "pm") {
        if (frac < -0.25) return name + "-";
        if (frac < 0.25) return name;
        return name + "+";
    }
    // "third" (default): low / plain / high thirds
    if (frac < -0.25) return name + " low";
    if (frac < 0.25) return name;
    return name + " high";
}

// ============================================================
// processMap — compatibility entry for the overlay UI
// ============================================================
function processMap(osuContent, mode, speedRate, options) {
    options = options || {};
    if (!speedRate || speedRate <= 0) speedRate = 1.0;
    const res = evaluateChart(osuContent, speedRate, SPM_V1_PARAMS);
    if (res.error) return null;

    const { star, starRc, starLn, lnCov, keyCount } = res;
    const b = res.b;

    // map type from ln coverage (replaces the tag classifier branch):
    // cov >= 0.68 → LN, cov <= 0.18 → RC (when LNs exist), else HB
    const hasLn = b.tailN > 0;
    let mapType;
    if (!hasLn) mapType = "RC";
    else if (lnCov > 0.68) mapType = "LN";
    else if (lnCov < 0.18) mapType = "RC";
    else mapType = "HB";

    // sub-difficulty scheme:
    //   "v051" — LN maps display ln difficulty = total (v0.5.1 logic);
    //   "direct" (default) — rc/ln always from the new sub-algorithms.
    const subScheme = options.subDifficultyScheme || "direct";
    let displayRc = starRc, displayLn = starLn;
    if (subScheme === "v051") {
        displayLn = star;   // legacy: LN difficulty equals total SR
    }

    // calibrated display curve (400ms buckets)
    const Ddisp = displayCurves(res);
    const times = Array.from(b.t);
    const { sectionDifficulties, sectionTimes } = computeSectionData(
        null, times, Ddisp, times[0], times[times.length - 1]);
    const { sectionDifficulties: rcSectionDifficulties } = computeSectionData(
        null, times, displayCurvesRC(res), times[0], times[times.length - 1]);
    // LN curve: D masked by g>0 (omitted for pure RC maps — nothing to show)
    let lnSectionDifficulties = null;
    if (hasLn) {
        const DLn = new Float64Array(res.nRows);
        for (let r = 0; r < res.nRows; r++) DLn[r] = res.g[r] > 0.01 ? Ddisp[r] : 0.0;
        lnSectionDifficulties = computeSectionData(
            null, times, DLn, times[0], times[times.length - 1]).sectionDifficulties;
    }

    const rcDanLevel = srToDanLevel(displayRc, keyCount, "RC");
    const lnDanLevel = hasLn ? srToDanLevel(displayLn, keyCount, "LN") : null;
    const totalDanLevel = srToDanLevel(star, keyCount, "RC");

    return {
        rating: star,
        rcRating: displayRc,
        lnRating: hasLn ? displayLn : null,
        rcDanLevel, lnDanLevel, totalDanLevel,
        rcDan: rcDanLevel, lnDan: lnDanLevel, totalDan: totalDanLevel,
        mapType, isMix: false,
        classified: false,          // tag engine only runs on 7K; set by caller
        noteCount: res.nNotes,
        lnCount: b.tailN,
        lnRatio: b.n ? b.tailN / res.nNotes : 0,
        lnCov,
        keyCount,
        od: res.od,
        sectionDifficulties, rcSectionDifficulties, lnSectionDifficulties,
        sectionTimes,
        firstNoteTime: times[0], lastNoteTime: times[times.length - 1],
    };
}

// ============================================================
// Exports (browser global)
// ============================================================
var SPMEngine = {
    SPM_V1_PARAMS, makeParams,
    parseOsu, buildBatch, buildStruct, computeCurves, combine,
    aggregatePow, postprocess, evaluateChart, displayCurves,
    computeSectionData, processMap,
    loadDanConstants, srToDanLevel, danLevelToLabel, interpDan,
    danNameForLevel,
    // v1.0.1
    CURVE_SIGMA_PX, CURVE_INNER_W, CURVE_FILL_RUN_MAX, CURVE_MAX_PASSES,
    CURVE_SMOOTH_MODE,
    curveSigmaBuckets, fillShortZeroRuns, smoothCurve,
    computeSegmentStats, parseOsuMeta, displayCurvesRC,
};
if (typeof window !== "undefined") window.SPMEngine = SPMEngine;
