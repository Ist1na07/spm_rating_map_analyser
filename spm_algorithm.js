/**
 * SPM Map Analyser — SPM Rating v1.2.0-rc3 (detail model) + SPMSubmodel rcln
 *
 * Overlay v1.2.0:
 *   Full JavaScript port of SPMRating v1.2.0-rc3 (hand/role/geometry/recovery,
 *   chord gesture, AGG-D two-level aggregation) and SPMSubmodel's RC/LN model.
 *   The v1.0.x display pipeline (curve smoothing, segment stats, metadata,
 *   dan mapping) is kept unchanged apart from the score scale and dan nodes.
 *
 * JavaScript port of:
 *   SPMRating/spm_rating/{parser,engine,api,hand,hand_cost,role,geometry,
 *                          recovery,clock,actions,coordinates}
 *   SPMRating/spm_rating/_core/{batch,grid,model,components}
 *   SPMSubmodel/rcln/engine.py
 *
 * Pipeline (single chart, integer clock):
 *   canonicalise (role.canonical) → chart and mirror views
 *   per view: rows → struct → curves → hand/role/recovery → combine
 *     → average the two D fields
 *     → aggregate(AGG-D, hold_w=true) → postprocess → spm (raw)
 *     → LN: presence weights g(t) + AGG-D two-level aggregation → ln (raw)
 *     → RC: de-LN (tap) view, RC/LN window modulation → rc (raw)
 *   each raw score → key-count reference alignment (models/detail.json)
 *
 * 4K charts are embedded into the 7-column frame (cols 1,2,4,5) so the
 * geometry logic is shared; 6K uses the (0,1,2,4,5,6) embedding.
 */

"use strict";

// ============================================================
// PARAMETERS — SPM Rating v1.2.0-rc3 detail model
// ============================================================
const SPM_V120_PARAMS = {
  od_mult_jm:1.2040048799564311,
  od_mult_jc:-0.293176786084059,
  od_mult_ja:-1.0,
  od_mult_p:1.1286927800588342,
  od_mult_x:1.1974891491877375,
  od_mult_r:1.058858405816053,
  w_jm:934.2448253030639,
  w_jc:-0.4552854599596368,
  w_ja:0.0,
  w_p:902.5681256843202,
  w_x:927.941415540503,
  w_r:1972.5181634749874,
  w_cb:1716.856156378797,
  w_a:75.76213228110679,
  j_c1:0.16126641911276896,
  j_nerf_a:-4.0585915711448676e-05,
  j_nerf_off:0.09265897011180577,
  j_nerf_c:0.0924591760779166,
  j_agg_pow:2.8052526777466564,
  j_triple_tau:140.9631484638465,
  j_triple_pow:2.0072942534242566,
  j_triple_gain:-0.5645803329343817,
  j_triple_gain_4k:0.7804879223793608,
  c_fj:1.291464498859916,
  c_fj_4k:1.1891597740767534,
  fj_bounded:0.0,
  d_sh:0.0,
  shd_w:1007.2471613945766,
  d_hc:1.0188595536994098,
  hc_e:1.7049026540688783,
  mj_dilute:-0.022067037291399555,
  mj_dilute_exp:1.7147578892981583,
  cj_size_exp:2.3090892612901857,
  cj_norm:3.9223792605276984,
  ja_gap_thr:250.97771855895374,
  ja_len_exp:0.873949786346038,
  ja_coord_exp:0.012636794260452278,
  ja_len_floor:1.0,
  ja_norm:4.912805983390194,
  p_lam3:60.0,
  p_scale:0.0573287291354225,
  p_lam2:0.005077940680001312,
  p_v_norm:-0.03652823337937215,
  p_boost:-1e-05,
  p_boost_lo:117.67575960429505,
  p_boost_hi:296.9197535881636,
  p_bv_max:0.7121791011599433,
  p_sat_a:12.967278061527875,
  p_sat_b:2.3046546300449706,
  p_chw2:0.6997350782823039,
  p_chw3:1.4710731528472405,
  p_chw4:0.82149995851254,
  p_chw5:0.8676070127257947,
  p_chw6:0.7474127532548505,
  p_chw7:1.03284160083206,
  chord_tau_c:24.345887557552615,
  note_chord:1.0,
  chord_soft_att:1.0,
  chord_no_dilute:1.0,
  chord2_hard:1.0,
  ga_alpha:0.0,
  ga_gam:1.0,
  ga_q:1.0,
  ga_pw:1.0,
  p_burst3:0.14316462240732145,
  p_burst4:-0.02452677135839032,
  an_a0:0.20919909312275142,
  an_a1:0.37286666751258996,
  an_cubic:8.862618779101767,
  an_on_p:-0.32562582197542633,
  abar_scale:0.9908465677870455,
  abar_active:0.02959105293159399,
  abar_thr_lo:0.01389142404428909,
  abar_thr_hi:0.11599034279776298,
  abar_c0:0.6575435661594596,
  abar_c1:1.3302402303785177,
  abar_k:5.052287546779305,
  abar_mx:0.451610888785001,
  abar_mx_thr:0.05208686478341369,
  abar_mx_w:0.4754900770279769,
  abar_weld:1.0,
  x_amp:0.09636644976733964,
  x_cw0:0.03724653823590479,
  x_cw1:0.8550132389171754,
  x_cw2:0.4722195790253056,
  x_cw3:0.023511327398546056,
  x_din:0.21329641269001137,
  x_dout:0.3884059305040078,
  x_fc_a:0.5315844156004722,
  x_fc_off:62.51708153410152,
  x_fc_floor:0.07402097926631954,
  x_fc_w:1.68396911611816,
  x_jump_w:-1.1360108646508114,
  x_jh_p:0.761399733967284,
  x_jh_e:0.7460102426771034,
  x_jt:0.5379957175084137,
  x_jd_p:0.038157319982258006,
  x_jd_e:2.070662416719641,
  x_dir_in:0.7935947499263032,
  x_dir_out:-0.46052690940589464,
  r_tail:0.030479803326367228,
  r_seq:0.06635864238365655,
  r_I_steep:7.138399583260547,
  r_I_off:1.6936500452160337,
  r_I_w:1.3201531009318856,
  r_dt_max:6749.562099456267,
  r_dtr_min:0.004050313466366775,
  r_sim_tau:11.405453069087805,
  r_soft_edges:1.0,
  r_same_col:0.19578505600824977,
  r_coord_e:2.2703135423553786,
  r_tt:0.0,
  r_short_thr:232.63366268425537,
  r_short_red:0.0,
  r_lock:2.064385891165511,
  r_simul:0.48507152260049274,
  r_cw_same:1.5375480228960465,
  r_cw_hand:0.46562083856474745,
  r_cw_thumb:0.011960920198257674,
  r_cw_cross:0.7315226193212329,
  r_order_pen:0.23401924932585802,
  r_order_tau:702.5373743325986,
  r_straddle:0.4485333102831889,
  r_ain0:-3.0,
  r_ain1:2.466978961221889,
  r_ain2:2.5020134256224296,
  r_ain3:1.2702424995871497,
  cb_shield:0.0,
  cb_shield_tau:56.24,
  cb_shield_lock:0.8062,
  cb_lockjack:0.0,
  cb_lock_pow:1.0,
  cb_lockanchor:0.0,
  cb_par:0.0,
  cb_holdtap:0.0,
  cb_holdtap_pow:1.0,
  use_cbar_v2:1.0,
  churn_event_rate:0.0,
  cbv_w:421.0782656735729,
  use_cbv_shield:1.0,
  cbv_shield:-1.976620227141156,
  use_cbv_straddle:1.0,
  cbv_straddle:9.213308770964225,
  use_cbv_lockstack:1.0,
  cbv_lockstack:1.4797072901013206,
  use_cbv_lockanchor:1.0,
  cbv_lockanchor:1.4544619305858701,
  use_cbv_overlap:1.0,
  cbv_overlap:-1.8394647223580556,
  use_cbv_holdtap:1.0,
  cbv_holdtap:-3.2366101454102796,
  cbv_sh_tau:498.1744137671231,
  cbv_sh_dt_max:330.6326350747474,
  cbv_sh_ln_w:3.0,
  cbv_sh_ln_tau:387.1884382046885,
  cbv_sh_lock:-0.7927305755124643,
  cbv_str_sh_adj:-0.8710391482004185,
  cbv_str_sh_split:0.3664690221870731,
  cbv_str_1h_split:1.3155287246626448,
  cbv_str_2h_split:0.9916617411662032,
  cbv_str_cross:-0.6289598036143927,
  cbv_str_h0:0.3224021808746196,
  cbv_str_h1:-2.2868450899924073,
  cbv_str_h2:2.6136511203207173,
  cbv_str_h3:2.340428184412323,
  cbv_str_bal:4.0,
  cbv_str_maxd:2.6813954311063055,
  cbv_lock_pow:0.9791217299061639,
  cbv_ls_sh_adj:1.269688790631109,
  cbv_ls_sh_split:1.8020347216322286,
  cbv_ls_1h_split:0.8899569281922335,
  cbv_ls_2h_split:0.3813338943482818,
  cbv_ls_cross:0.28425190948656204,
  cbv_ov_sh_adj:0.6949297766284019,
  cbv_ov_sh_split:-2.1906780704262263,
  cbv_ov_1h_split:-4.674473945804736,
  cbv_ov_2h_split:1.5020006436255016,
  cbv_ov_cross:4.935679036129201,
  cbv_ov_dt_max:2276.1965593534787,
  cbv_ov_cap:3446.987025249341,
  use_hb:1.0,
  cbv_churn:3.6654074897742612,
  cbv_churn_4k:4.298621698858253,
  churn_sat:20.70743322086763,
  churn_w:1167.6875064558421,
  cbv_holdage:18.945855743518063,
  cbv_holdage_4k:10.303537336083915,
  holdage_th:0.15716538407588404,
  holdage_cap:0.42468477879654104,
  c_chord2:0.0,
  chord2_w:998.3068456460403,
  d_rec:12.279350811907214,
  rec_half:0.3671841225596574,
  recov_w:968.8229953754064,
  recov_wl:38307.95803840174,
  aj:1.430584921574431,
  ap:3.5424464326854332,
  at:12.654197587970756,
  cap_a:22.11098017221394,
  cap_b:0.5877082264222335,
  c_jm:0.356418909837854,
  c_jc:-0.021333358663360977,
  c_ja:0.038468075195409575,
  c_s:0.2848251338028861,
  s_p:1.1959916923340246,
  a_p:0.4016531544080434,
  a_r:108.50536487992183,
  a_c:25.83867288316744,
  a_cb:4.234752287195439,
  a_cbc:2.506126891341002,
  a_p_4k:0.7336548088255943,
  a_r_4k:58.25324080278074,
  a_cb_4k:11.60113975415644,
  t_jack_mix:-0.3805743609330355,
  t_s_off:3.0179360184812842,
  d_b1:1.2519368453250523,
  d_ds:0.5851191625546722,
  d_dt:0.7540471413982772,
  d_b2:0.6276354594810581,
  c_stam:0.0,
  stam_tau:8000.0,
  stam_grp:30.0,
  agg_mode:4.0,
  agg_k:3.923290274033005,
  agg_C:5.7765188650680015,
  agg_gamma:0.3142734186203886,
  agg_nseg:30.0,
  agg_wc:1.145022164188944,
  agg_gap_w:1.0873927743990874,
  aggw_src:0.0,
  aggw_gap_cap:0.0,
  aggC_ms:4397.439342626505,
  aggC_gap:2270.295764558157,
  aggC_ms_4k:3078.207539838553,
  aggC_gap_4k:1222.4669501466997,
  aggC_pw1:2.516135362334202,
  aggC_pw2:4.4266132719189,
  aggC_wc:2.5507155298795627,
  aggC_gw:1.2909164079307989,
  aggC_gc:387.1237698484442,
  aggC_hw:1.0,
  aggC_tau:4027.709861084976,
  aggC_kap:0.8250936661252044,
  env_w:0.5401340304888701,
  env_ms:296.6324480607108,
  p93_c:2.505172683584436,
  w93:0.3605157897072774,
  p83_c:2.667686959362696,
  w83:0.4815139944602175,
  wmean:2.1613377064577026,
  mean_pow:6.465267031930503,
  pp_n0:0.0,
  pp_thr:8.416405509249257,
  pp_div:1.559992046815954,
  pp_scale:0.9866220368284715,
  calib_a:0.9877134644832144,
  calib_b:0.6823998306913243,
  hw_a:-4.833333333333334,
  hw_half:51.932695284873475,
  ln_eff_tail_ms:11.348134111824663,
  ln_note_level:0.0,
  use_read:0.0,
  d_read:0.0,
  d_read_4k:0.0,
  read_tol:0.18,
  read_n_win:16.0,
  read_clip_lo:0.5,
  read_clip_hi:1.5,
  use_eye:1.0,
  d_eye:0.03491913373673157,
  d_eye_4k:-0.022838270713520077,
  eye_w_ref:4000.0,
  eye_w_s:500.0,
  eye_tau:0.2,
  out_a:0.8686939253627315,
  out_b:-0.9591165705858606,
  hand_beta:0.0,
  hand_power:1.0,
  hand_sync:30.0,
  hand_lookback:1200.0,
  hand_predecessor:6.0,
  hand_tau:400.0,
  hand_floor:0.0,
  hand_null:0.1,
  hand_projection:500.0,
  hand_average:1.0,
  group_jump:6.0,
  hand_entry:1.0,
  x_adj_w:-1.4830291674247595,
  jc_scale:1.4332747701403683,
  ja_scale:0.9792209480655096,
};
const SPM_V120_MODEL = {
  name: "detail",
  role_price: 0.10220147228915628,
  alignment: {"4": {"scale": 1.4664817902516922, "power": 0.8430605071120153, "domain": "4K supplied reference scale; not calibrated cross-key equivalence"}, "6": {"scale": 3.8921399991761465, "power": 0.7190202896943204, "domain": "6K supplied reference scale; not calibrated cross-key equivalence"}, "7": {"scale": 1.366527116787871, "power": 0.8237384240102189, "domain": "7K SPM annotation scale"}}
};

// Back-compat alias: display-only helpers still read SPM_V1_PARAMS.
const SPM_V1_PARAMS = SPM_V120_PARAMS;

// ============================================================
// SPM Rating v1.2.0 compact ("精简") model
// ============================================================
// models/compact.json is a standalone model file, but it differs from
// models/detail.json only in the 16 parameters below plus its own role price
// and reference alignment. The row/curve structure, RC/LN modulation and
// aggregation are shared, so the compact variant is the detail parameter set
// with these overrides -- exactly the upstream relationship.
const SPM_V120_COMPACT_PARAMS = Object.assign({}, SPM_V120_PARAMS, {
  cbv_shield: -1.5174990295489725,
  cbv_lockstack: 1.4475245296513661,
  cbv_lockanchor: 1.422828241809208,
  cbv_holdtap: -3.1890156733390937,
  cbv_holdage: 0,
  cbv_holdage_4k: 0,
  c_jm: 0.3450846336064136,
  c_s: 0.28526765219645267,
  a_p: 0.4060714259489379,
  a_r: 108.94515749515554,
  a_cb: 4.128748137946181,
  a_p_4k: 0.7417251703479677,
  a_r_4k: 58.489352124528246,
  a_cb_4k: 11.310740489557293,
  aggC_pw1: 2.651283329811826,
  aggC_pw2: 4.623689962274493,
});
const SPM_V120_COMPACT_MODEL = {
  name: "compact",
  role_price: 0.11428371518823142,
  alignment: {"4":{"scale":1.4447226797920558,"power":0.8528934133627156,"domain":"4K supplied reference scale; not calibrated cross-key equivalence"},"6":{"scale":3.958644846392425,"power":0.7149718469949863,"domain":"6K supplied reference scale; not calibrated cross-key equivalence"},"7":{"scale":1.3950034461931664,"power":0.8184565898576669,"domain":"7K SPM annotation scale"}}
};

// Selectable model variants, keyed by the SPMRating model id
// (models/<id>.json). "detail" = 完整, "compact" = 精简.
const SPM_MODEL_VARIANTS = {
  detail: { id: "detail", label: "Detailed", params: SPM_V120_PARAMS, model: SPM_V120_MODEL },
  compact: { id: "compact", label: "Compact", params: SPM_V120_COMPACT_PARAMS, model: SPM_V120_COMPACT_MODEL },
};
/** Resolve a variant id; unknown/absent falls back to detail. */
function modelVariant(id) {
  return SPM_MODEL_VARIANTS[id] || SPM_MODEL_VARIANTS.detail;
}


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
    // v1.2.0 single-chart struct fields (python build_struct)
    s.t = b.t;
    s.tg = b.t;
    s.mask = b.mask;
    s.size = b.size;
    s.isLn = b.isLn;
    s.lnEnd = b.lnEnd;
    s.x = b.x;
    s.od = b.od;
    s.keyCount = b.keyCount;
    s.nNotes = b.nNotes;
    s.chart = new Int32Array(n);                       // one chart: all zeros
    s.starts = new Int32Array([0, n]);
    s.is4k = new Uint8Array(n);
    if (b.is4k) s.is4k.fill(1);
    s.dtDiff = new Float64Array(n);                    // ms gap to next row, 0 on last row
    for (let r2 = 0; r2 + 1 < n; r2++) s.dtDiff[r2] = b.t[r2 + 1] - b.t[r2];
    s.duration = b.duration;
    s.nNotesVal = b.nNotes;

    // ---- column chains: dcol (per-column gap to next hit in that column)
    // python: dcol[k] = chain_scatter(...) which returns ZEROS outside the
    // chain (not the 1e9 fill — the full array is replaced)
    const dcol = [];   // [K][n]
    for (let k = 0; k < K; k++) {
        const arr = zeros(n);
        const pos = b.colPos[k], g = b.colG[k];
        // value for gap j holds on rows [pos[j], pos[j+1])
        for (let j = 0; j + 1 < pos.length; j++) {
            // python stores dcol as np.float32; keep the same precision in JS
            const v = Math.fround(Number.isFinite(g[j]) ? g[j] : 1e9);
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

// ---- window interpolation operator (used by geometry.linear_wmean)
function wmeanIndexOp(b, s, W) {
    const n = b.n, t = b.t;
    const jhi = new Int32Array(n), dhi = new Float64Array(n),
          jlo = new Int32Array(n), dlo = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const zhi = Math.min(t[r] + 0.5 * W, t[n - 1]);
        const zlo = Math.max(t[r] - 0.5 * W, t[0]);
        let lo = 0, hi = n;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] <= zhi) lo = mid + 1; else hi = mid; }
        jhi[r] = clamp(lo - 1, 0, n - 2);
        dhi[r] = zhi - t[jhi[r]];
        lo = 0; hi = n;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid] <= zlo) lo = mid + 1; else hi = mid; }
        jlo[r] = clamp(lo - 1, 0, n - 2);
        dlo[r] = zlo - t[jlo[r]];
    }
    return { jhi, dhi, jlo, dlo };
}

function geometryHelpers(b, s) {
    return {
        wmean: function (ss, val, W) { return wmean(b, ss, val, W); },
        wmeanIndex: function (ss, W) { return wmeanIndexOp(b, ss, W); },
        triWindowCount: function (ss, val, tau) { return triWindowCount(b, ss, val, tau); },
        segCumsum: function (x, starts) {
            const n = x.length, out = new Float64Array(n);
            let acc = 0;
            for (let r = 0; r < n; r++) { acc += x[r]; out[r] = acc; }
            return out;
        },
        EPS: EPS,
    };
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
// v1.2.0 chord gesture (core/model._note_kernel / _row_gesture / _chord_g)
// ============================================================
function noteKernel(x, mode) {
    const v = clamp(x, 0.0, 1.0);
    if (mode === 1) return 1.0 - v * v * (3.0 - 2.0 * v);
    if (mode === 2) return 0.5 * (1.0 + Math.cos(Math.PI * v));
    return 1.0 - v;
}

function rowGesture(b, s, tau) {
    const n = s.n;
    const uL = full(n, 1.0), uR = full(n, 1.0);
    let gsz = full(n, 1.0), wbar = full(n, 1.0);
    const wbRow = zeros(n);
    const npop = b.nNotes;
    if (npop === 0 || tau <= 0.0) return { uL, uR, gsz, wbar, wbRow };
    const r = b.noteRow;                      // single chart: starts[nchart] = 0
    const msk = s.mask;
    const left = zeros(n), right = zeros(n);
    for (let rr = 0; rr < n; rr++) {
        left[rr] = popcount7(msk[rr] & 15);
        right[rr] = popcount7(msk[rr] & 112);
    }
    const uLv = triWindowCount(b, s, left, tau);
    const uRv = triWindowCount(b, s, right, tau);
    for (let rr = 0; rr < n; rr++) { uL[rr] = uLv[rr]; uR[rr] = uRv[rr]; gsz[rr] = uLv[rr] + uRv[rr]; }
    const ncnt = zeros(n);
    for (let i = 0; i < npop; i++) ncnt[r[i]] += 1.0;
    for (let rr = 0; rr < n; rr++) {
        const c = Math.max(ncnt[rr], 1.0);
        wbar[rr] = c > 1.0 ? Math.max(gsz[rr] - 1.0, 0.0) / Math.max(c - 1.0, 1e-12) : 1.0;
        wbar[rr] = clamp(wbar[rr], 0.0, 1.0);
    }
    const first = new Uint8Array(npop);
    const firstRow = new Uint8Array(n);
    first[0] = 1;
    for (let i = 1; i < npop; i++) first[i] = b.noteRow[i] !== b.noteRow[i - 1] ? 1 : 0;
    for (let i = 0; i < npop; i++) if (first[i]) firstRow[r[i]] = 1;
    const cur = new Int32Array(n), prev = new Int32Array(n);
    for (let i = 0; i < npop; i++) if (first[i]) cur[r[i]] = i;
    for (let rr = 1; rr < n; rr++) prev[rr] = cur[rr - 1];
    // has_prev[0] is False in python _row_gesture: the first row has no
    // previous attack, so wb_row[0] is always 0 (starting at rr=1).
    for (let rr = 1; rr < n; rr++) {
        if (!firstRow[rr]) continue;
        const gap = Math.abs(b.noteT[cur[rr]] - b.noteT[prev[rr]]);
        wbRow[rr] = clamp(1.0 - gap / tau, 0.0, 1.0);
    }
    return { uL, uR, gsz, wbar, wbRow };
}

function rowGestureCached(b, s, p) {
    const key = Math.round(p.chord_tau_c * 1e6) / 1e6;
    s.chordnOps = s.chordnOps || new Map();
    let got = s.chordnOps.get(key);
    if (!got) {
        got = rowGesture(b, s, key);
        if (s.chordnOps.size > 8) s.chordnOps.clear();
        s.chordnOps.set(key, got);
    }
    return got;
}

function chordG(uL, uR, p) {
    const al = p.ga_alpha === undefined ? 0.12 : p.ga_alpha;
    const ga = Math.max(p.ga_gam === undefined ? 1.3 : p.ga_gam, 0.001);
    const q = Math.max(p.ga_q === undefined ? 3.0 : p.ga_q, 1.0);
    const pw = Math.max(p.ga_pw === undefined ? 1.0 : p.ga_pw, 0.001);
    const P = Math.max(ga * q, 0.001);
    const out = zeros(uL.length);
    for (let i = 0; i < uL.length; i++) {
        const ul = Math.max(uL[i], 0.0), ur = Math.max(uR[i], 0.0);
        const lam = Math.pow(Math.pow(ul, P) + Math.pow(ur, P), 1.0 / P);
        out[i] = 1.0 + al * Math.pow(Math.max(lam - 1.0, 0.0), pw);
    }
    return out;
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
    let attCum = null, attSoftCum = null, wf = null, wb = null;
    if (tauC > 0.0) {
        const cc = chordCoupling(b, s, tauC);
        wf = cc[0]; wb = cc[1];
        if ((p.chord_soft_att || 0.0) >= 0.5) {
            attSoftCum = new Float64Array(n + 1);
            for (let r = 0; r < n; r++) attSoftCum[r + 1] = attSoftCum[r] + (1.0 - wb[r]);
        } else {
            attCum = new Float64Array(n + 1);
            for (let r = 0; r < n; r++) attCum[r + 1] = attCum[r] + (wb[r] === 0.0 ? 1.0 : 0.0);
        }
    }
    let chordRow = null;
    if ((p.chord_no_dilute || 0.0) >= 0.5 && (p.note_chord || 0.0) >= 0.5) {
        const gzc = rowGestureCached(b, s, p).gsz;
        chordRow = new Uint8Array(n);
        for (let r = 0; r < n; r++) chordRow[r] = gzc[r] >= 2.0 ? 1 : 0;
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
        const rowSizeCum = new Float64Array(n + 1);
        for (let r2 = 0; r2 < n; r2++) rowSizeCum[r2 + 1] = rowSizeCum[r2] + b.size[r2];
        const keepRun = new Uint8Array(M);
        for (let j = 0; j < M; j++) {
            const isValid = Number.isFinite(g[j]);
            valid[j] = isValid ? 1 : 0;
            gs[j] = Math.max(isValid ? g[j] : 1.0, 1e-4);
            if (attCum) nrows[j] = Math.max(attCum[pos[j + 1]] - attCum[pos[j]], 1.0);
            else if (attSoftCum) nrows[j] = Math.max(attSoftCum[pos[j + 1]] - attSoftCum[pos[j]], 1.0);
            else nrows[j] = Math.max(pos[j + 1] - pos[j], 1.0);
            const total = rowSizeCum[pos[j + 1]] - rowSizeCum[pos[j]];
            other[j] = Math.max(total - 1.0, 0.0);
            load[j] = total / nrows[j];
            if (isValid && g[j] <= gapThr) keepRun[j] = 1;
            tgain[j] = b.is4k ? g4k : g7;
            if ((p.fj_bounded || 0.0) >= 0.5) {
                fj[j] = (isValid && gs[j] < 0.150) ? clamp(1.0 - gs[j] / 0.150, 0.0, 1.0) : 0.0;
            } else {
                fj[j] = (isValid && gs[j] < 0.150) ? (1.0 / gs[j]) * Math.max(1.0 - gs[j] / 0.150, 0.0) : 0.0;
            }
            xr[j] = b.x;
            kern[j] = jackKernel(gs[j], b.x, p, p.od_mult_jm);
        }
        const rl = runLengths(keepRun, M);
        for (let j = 0; j < M; j++) runlen[j] = rl[j];
        for (let j = 0; j + 2 < pos.length; j++) {
            if (valid[j] && valid[j + 1]) {
                const spanS = (b.t[pos[j + 2]] - b.t[pos[j]]) / 1000.0;
                trip[j] = Math.max(0.0, 1.0 - spanS / (2.0 * h3Tau));
            }
        }
        let cr = null;
        if (chordRow) {
            cr = new Uint8Array(M);
            for (let j = 0; j < M; j++) cr[j] = chordRow[pos[j]];
        }
        stats.push({ pos, gs, valid, nrows, other, load, runlen, trip, tgain, fj, kern, chordRow: cr });
    }
    s.jackStatsCache = { stats, attCum, attSoftCum, wf, wb, tauC };
    return s.jackStatsCache;
}

function computeCurves(b, s, p) {
    const n = b.n;

    // ================================================== jack family
    const aggPow = Math.max(p.j_agg_pow, 0.25);
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
    const stats = js.stats, tauC = js.tauC, wbG = js.wb;

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
                else if (kind === "mj") mod[j] = 1.0 + st.tgain[j] * st.trip[j];
                else if (kind === "cj") mod[j] = Math.pow(Math.max(st.load[j], 1e-6) / cjNorm, cjExp);
                else {
                    const e = Math.max(st.runlen[j] + 2.0 - jaFloor, 0.0);
                    const runf = Math.pow(e / (e + jaNorm), jaLenExp);
                    mod[j] = runf * Math.pow(1.0 + st.other[j] / st.nrows[j], jaCoordExp);
                }
            }
            const v = new Float64Array(M);
            for (let j = 0; j < M; j++) v[j] = st.valid[j] ? st.kern[j] * mod[j] : 0.0;
            if (odMult !== odJm) {
                for (let j = 0; j < M; j++)
                    if (st.valid[j]) v[j] = jackKernel(st.gs[j], b.x, p, odMult) * mod[j];
            }
            const cur = wmean(b, s, chainScatter(st.pos, v, n, st.valid), wMs);
            const wv = new Float64Array(M);
            for (let j = 0; j < M; j++) wv[j] = st.valid[j] ? 1.0 / st.gs[j] : 0.0;
            let wArr = chainScatter(st.pos, wv, n, st.valid);
            if (kind === "mj") wArr = wmean(b, s, wArr, wMs);
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
    if (p.c_jm || p.t_jack_mix || p.cb_lockjack) Jm = jackChannel("mj", wJm, odJm);

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

    const noteChord = tauC > 0.0 && (p.note_chord || 0.0) >= 0.5;
    let gest = null;
    if (noteChord) gest = rowGestureCached(b, s, p);

    // ================================================== Pbar
    const xrowP = Math.pow(b.x, p.od_mult_p);
    const d = b.dtModel;
    let dFp = d;
    if (tauC > 0.0) {
        let att = null, attIdx;
        if (noteChord) {
            att = new Float64Array(n);
            attIdx = [];
            for (let r = 0; r < n; r++) {
                att[r] = 1.0 - gest.wbRow[r];
                if (gest.wbRow[r] <= 0.0) attIdx.push(r);
            }
        } else {
            attIdx = [];
            for (let r = 0; r < n; r++) if (wbG[r] === 0.0) attIdx.push(r);
        }
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
    let inc = zeros(n);
    if (noteChord) {
        const chwU = chordG(gest.uL, gest.uR, p);
        for (let r = 0; r < n; r++) {
            const att = 1.0 - gest.wbRow[r];
            const mix = p.p_bv_max > 0.5
                ? att * Math.max(bst[r], 1.0) + Math.max(vv[r] - 1.0, 0.0)
                : att * bst[r] * vv[r];
            inc[r] = (1.0 / d[r]) * fp[r] * chwU[r] * mix;
        }
    } else if (tauC > 0.0) {
        const u = triWindowCount(b, s, Float64Array.from(b.size), tauC);
        const att = new Float64Array(n);
        for (let r = 0; r < n; r++) att[r] = 1.0 - wbG[r];
        for (let r = 0; r < n; r++) {
            const uu = clamp(u[r], 1.0, K);
            const i0 = Math.min(Math.floor(uu), K - 1);
            const frac = uu - i0;
            const chwU = chw[i0] * (1.0 - frac) + chw[i0 + 1] * frac;
            const mix = p.p_bv_max > 0.5
                ? att[r] * Math.max(bst[r], 1.0) + Math.max(vv[r] - 1.0, 0.0)
                : att[r] * bst[r] * vv[r];
            inc[r] = (1.0 / d[r]) * fp[r] * chwU * mix;
        }
    } else {
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
    if (p.abar_active >= 0.5) {
        let prevD = full(n, -1.0), prevA = full(n, -1.0);
        for (let k = 0; k < K; k++) {
            const d1 = s.dcol[k], on = s.act[k];
            const nd = Float64Array.from(prevD), na = Float64Array.from(prevA);
            for (let r = 0; r < n; r++) {
                const isOn = (prevA[r] >= 0.0) && on[r];
                if (isOn) {
                    const mx = Math.max(prevD[r], d1[r]);
                    const dd = Math.abs(prevD[r] - d1[r]) + p.abar_mx_w * Math.max(0.0, mx - p.abar_mx_thr);
                    A[r] *= abarVal(dd, mx, p);
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
            const keepP = [];
            for (let j = 0; j < pos.length; j++) {
                if (j === 0) { keepP.push(pos[j]); continue; }
                const bg = (b.t[pos[j]] - b.t[pos[j - 1]]) / 1000.0;
                if (bg >= tauC / 1000.0) keepP.push(pos[j]);
            }
            posK = keepP;
            // v1.2.0: boundary coordinates are smoothed by coordinates.coordinate
            eArr = SPMExtGeometry.coordinate(s, bd, posK, tauC);
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
        const sc = stepScatter(posK.slice(0, M2), posK.slice(1), Xb, n);
        const bgw = cw[BOUND_GROUP[bd]];
        for (let r = 0; r < n; r++) Xsum[r] += bgw * sc[r];
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
    let Xbar;
    if ((p.group_jump || 0.0) === 6.0 && (p.x_adj_w || 0.0) !== 0.0) {
        // geometry.compute_curves: Xbar = clip(linear_wmean(Xsum) + x_adj_w * adjacency)
        const helpers = geometryHelpers(b, s);
        const adj = SPMExtGeometry.geometryWindowCurve(b, s, p, helpers);
        const base = SPMExtGeometry.linearWmean(s, Xsum, p.w_x, helpers);
        Xbar = new Float64Array(n);
        for (let r = 0; r < n; r++) Xbar[r] = Math.max(base[r] + p.x_adj_w * adj[r], 0.0);
    } else {
        Xbar = wmean(b, s, Xsum, p.w_x);
    }

    // ================================================== Rbar
    const Rbar = computeRbar(b, s, p, Math.pow(b.x, p.od_mult_r));

    // ================================================== SHd / HCd (v1.2.0 chord gesture)
    const mask = s.mask;
    const left = zeros(n), right = zeros(n);
    for (let r = 0; r < n; r++) {
        left[r] = popcount7(mask[r] & 15);
        right[r] = popcount7(mask[r] & 112);
    }
    const shd = zeros(n);
    if (noteChord) {
        for (let r = 0; r < n; r++)
            shd[r] = gest.uL[r] * clamp(gest.uL[r] - 1.0, 0.0, 1.0) + gest.uR[r] * clamp(gest.uR[r] - 1.0, 0.0, 1.0);
    } else if (tauC > 0.0) {
        const le = triWindowCount(b, s, left, tauC);
        const ri = triWindowCount(b, s, right, tauC);
        for (let r = 0; r < n; r++)
            shd[r] = le[r] * clamp(le[r] - 1.0, 0.0, 1.0) + ri[r] * clamp(ri[r] - 1.0, 0.0, 1.0);
    } else {
        for (let r = 0; r < n; r++)
            shd[r] = (left[r] >= 2 ? left[r] : 0.0) + (right[r] >= 2 ? right[r] : 0.0);
    }
    const SHd = wmean(b, s, shd, Math.max(p.shd_w, 50.0));
    const hcE = Math.max(p.hc_e === undefined ? 1.5 : p.hc_e, 1.0);
    const hc = zeros(n);
    if (noteChord) {
        for (let r = 0; r < n; r++)
            hc[r] = Math.pow(Math.max(gest.uL[r] - 1.0, 0.0), hcE) + Math.pow(Math.max(gest.uR[r] - 1.0, 0.0), hcE);
    } else {
        for (let r = 0; r < n; r++)
            hc[r] = Math.pow(Math.max(left[r] - 1.0, 0.0), hcE) + Math.pow(Math.max(right[r] - 1.0, 0.0), hcE);
    }
    const HCd = wmean(b, s, hc, Math.max(p.shd_w, 50.0));

    // ================================================== Cbar
    let Cbar = zeros(n);
    let anyLn = false;
    for (let r = 0; r < n; r++) if (b.lnEnd[r] > 0) { anyLn = true; break; }
    if (anyLn) {
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
        if (p.c_chord2) Chord2 = computeChord2V120(b, s, p, gest);
        if (p.d_rec) Recov = computeRecov(b, s, p);
    }

    // ================================================== eye (visual regularity)
    let EyeR = zeros(n);
    if (p.use_eye) EyeR = computeEyeCurve(b, s, p);

    return { Jbar, Jm, Jc, Ja, Pbar, Xbar, Abar, Rbar, Cbar,
             EyeR, Chord2, Recov, SHd, HCd };
}

function computeChord2V120(b, s, p, gest) {
    const n = b.n;
    const w = Math.max(p.chord2_w === undefined ? 1000.0 : p.chord2_w, 50.0);
    const noteChord = (p.note_chord || 0.0) >= 0.5 && (p.chord_tau_c || 0.0) > 0.0;
    if (noteChord) {
        const g = gest ? gest : rowGestureCached(b, s, p);
        const mu = zeros(n);
        if ((p.chord2_hard || 0.0) >= 0.5) {
            for (let r = 0; r < n; r++) mu[r] = Math.round(g.gsz[r]) === 2.0 ? 1.0 : 0.0;
        } else {
            for (let r = 0; r < n; r++)
                mu[r] = clamp(1.0 - Math.abs(g.gsz[r] - 2.0), 0.0, 1.0) * clamp(g.wbar[r], 0.0, 1.0);
        }
        return wmean(b, s, mu, w);
    }
    const flag = zeros(n);
    for (let r = 0; r < n; r++) flag[r] = b.size[r] === 2 ? 1.0 : 0.0;
    return wmean(b, s, flag, w);
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
                if (tj - ti > dtmax) break;
                if (ei <= tj) continue;
                const ej = lnEndLoc[rj];
                if (ej <= ei) continue;
                const ov = Math.min(ei - tj, cap);
                const val = (ov / 1000.0) * Mi[cSorted[j2]];
                if (val === 0) continue;
                diff[rj] += val;
                // end row: first row with t >= tj + ov, clipped to the chart
                const z = tj + ov;
                let lo = 0, hi = n;
                while (lo < hi) { const mid = (lo + hi) >> 1; if (tLoc[mid] < z) lo = mid + 1; else hi = mid; }
                const endRow = Math.max(rj, Math.min(lo, n - 1));
                diff[endRow] -= val;
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
    const Ks = s.Ks, C = new Float64Array(n);
    for (let r = 0; r < n; r++) C[r] = Math.max(s.C[r], 0.0);
    const is4kRow = b.is4k;
    const aP = is4kRow && (p.a_p_4k || 0.0) !== 0.0 ? p.a_p_4k : p.a_p;
    const aR = is4kRow && (p.a_r_4k || 0.0) !== 0.0 ? p.a_r_4k : p.a_r;
    const aCb = is4kRow && (p.a_cb_4k || 0.0) !== 0.0 ? p.a_cb_4k : p.a_cb;

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
    const jcScale = p.jc_scale === undefined ? 1.0 : p.jc_scale;
    const jaScale = p.ja_scale === undefined ? 1.0 : p.ja_scale;
    const dSh = p.d_sh || 0.0, dHc = p.d_hc || 0.0;
    const dEye = p.d_eye || 0.0;
    const dEye4k = p.d_eye_4k || 0.0;
    const eyeOn = p.use_eye && (dEye !== 0.0 || dEye4k !== 0.0);
    const dEyeRow = (is4kRow && dEye4k !== 0.0) ? dEye4k : dEye;
    const stream = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        let sval = aP * Math.max(cur.Pbar[r], 0.0)
            + aR * Math.max(cur.Rbar[r], 0.0) / (C[r] + p.a_c)
            + aCb * Math.max(cur.Cbar[r], 0.0) / (C[r] + p.a_cbc)
            + dSh * (cur.SHd ? cur.SHd[r] : 0.0)
            + dHc * (cur.HCd ? cur.HCd[r] : 0.0);
        if (eyeOn) sval += dEyeRow * Math.max(cur.Pbar[r], 0.0) * cur.EyeR[r];
        stream[r] = Math.pow(A[r], p.ap) * sval;
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
            S[r] = p.c_jm * JmB[r] + p.c_jc * JcB[r] * jcScale + p.c_ja * JaB[r] * jaScale + p.c_s * stream[r];
    } else {
        for (let r = 0; r < n; r++) {
            const inner = p.c_jm * Math.pow(JmB[r], sp) + p.c_jc * Math.pow(JcB[r], sp) * jcScale
                + p.c_ja * Math.pow(JaB[r], sp) * jaScale + p.c_s * Math.pow(Math.max(stream[r], 0.0), sp);
            S[r] = Math.pow(Math.max(inner, 0.0), 1.0 / sp);
        }
    }
    // technique context uses the pre-hand/role Jm (engine passes Jm_context)
    const JmCtx = cur.Jm_context ? cur.Jm_context : cur.Jm;
    const JmCtxB = new Float64Array(n);
    for (let r = 0; r < n; r++) JmCtxB[r] = branchVal(JmCtx[r], p.aj, r);
    const T = new Float64Array(n), D = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const Xt = Math.max(Math.max(cur.Xbar[r], 0.0) + p.t_jack_mix * JmCtxB[r], 0.0);
        T[r] = Math.pow(A[r], p.at / Ks[r]) * Xt / (Xt + S[r] + p.t_s_off);
        D[r] = p.d_b1 * Math.pow(S[r], p.d_ds) * Math.pow(Math.max(T[r], 1e-9), p.d_dt)
            + p.d_b2 * S[r];
        if (!Number.isFinite(D[r]) || D[r] < 0) D[r] = 0;
    }
    return D;
}

// ============================================================
// AGGREGATE (core/model.aggregate v1.2.0; default mode 4 = AGG-D)
// ============================================================
function peakEnvelope(b, s, D, ms) {
    // per-chart centred rolling max over +-ms/2 (scipy maximum_filter1d)
    const n = b.n;
    const out = new Float64Array(n);
    const dur = Math.max(b.duration, 1.0);
    const medDt = Math.max(dur / Math.max(n, 1), 1.0);
    const half = Math.max(1, Math.round(0.5 * ms / medDt));
    const dq = [];
    let next = 0;
    for (let i = 0; i < n; i++) {
        const hi = Math.min(i + half, n - 1);
        while (next <= hi) {
            while (dq.length && D[dq[dq.length - 1]] <= D[next]) dq.pop();
            dq.push(next);
            next++;
        }
        while (dq.length && dq[0] < i - half) dq.shift();
        out[i] = D[dq[0]];
    }
    return out;
}

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

function aggcGeom(p) {
    let ms = Math.max(p.aggC_ms, 50.0);
    let gap = Math.max(p.aggC_gap, 50.0);
    let ms4 = (p.aggC_ms_4k || 0.0);
    let gap4 = (p.aggC_gap_4k || 0.0);
    ms4 = ms4 > 0.0 ? Math.max(ms4, 50.0) : -1.0;
    gap4 = gap4 > 0.0 ? Math.max(gap4, 50.0) : -1.0;
    const use4k = (ms4 > 0.0 && ms4 !== ms) || (gap4 > 0.0 && gap4 !== gap);
    return { ms, gap, ms4, gap4, use4k };
}

function aggcMass(s, gp, p, holdW) {
    const n = s.n;
    const m = new Float64Array(n);
    const wc = Math.max(p.aggC_wc, 0.0);
    const gw = p.aggC_gw || 0.0;
    const gc = Math.max(p.aggC_gc === undefined ? 400.0 : p.aggC_gc, 1.0);
    const holdOn = holdW && (p.aggC_hw || 0.0) && (p.hw_a || 0.0);
    const half = Math.max(p.hw_half === undefined ? 1.0 : p.hw_half, 1e-6);
    for (let r = 0; r < n; r++) {
        let v = Math.pow(Math.max(s.C[r], 0.0), wc);
        if (gw !== 0.0) v *= Math.pow(Math.min(Math.max(gp[r], 0.0), gc), gw);
        if (holdOn) v *= 1.0 + p.hw_a * s.held[r] / (s.held[r] + half);
        m[r] = Math.max(Number.isFinite(v) ? v : 0.0, 0.0);
    }
    return m;
}

const AGG_WIDX = 1 << 22;
function aggcWindows(s, ms, gap) {
    const n = s.n;
    const first = new Uint8Array(n);
    first[0] = 1;
    const prevGap = new Float64Array(n);
    for (let r = 1; r < n; r++) prevGap[r] = s.dtDiff[r - 1];
    const boundary = new Uint8Array(n);
    for (let r = 0; r < n; r++) boundary[r] = (first[r] || prevGap[r] >= gap) ? 1 : 0;
    // sec = cumsum(boundary)-1
    const sec = new Int32Array(n);
    let acc = 0;
    for (let r = 0; r < n; r++) { acc += boundary[r]; sec[r] = acc - 1; }
    const t0 = [];
    for (let r = 0; r < n; r++) if (boundary[r]) t0.push(s.t[r]);
    // window index within each section; keys are non-decreasing along rows
    const inv = new Int32Array(n);
    const startsW = [];
    let winId = -1;
    let lastKey = -1;
    for (let r = 0; r < n; r++) {
        const widx = Math.floor(Math.max(s.t[r] - t0[sec[r]], 0.0) / ms);
        const key = sec[r] * AGG_WIDX + widx;
        if (key !== lastKey) { winId++; lastKey = key; startsW.push(r); }
        inv[r] = winId;
    }
    const nw = winId + 1;
    const reset = new Uint8Array(nw), preGap = new Float64Array(nw);
    for (let w = 0; w < nw; w++) { reset[w] = boundary[startsW[w]]; preGap[w] = prevGap[startsW[w]]; }
    return { inv, nw, startsW, reset, preGap };
}

function aggcTwoLevel(b, s, D, gp, p, holdW) {
    const m = aggcMass(s, gp, p, holdW);
    const pw1 = Math.max(p.aggC_pw1, 0.05);
    const pw2 = Math.max(p.aggC_pw2, 0.05);
    const geom = aggcGeom(p);
    let ms = geom.ms, gap = geom.gap;
    if (geom.use4k) {
        if (b.is4k) { ms = geom.ms4 > 0 ? geom.ms4 : ms; gap = geom.gap4 > 0 ? geom.gap4 : gap; }
        // single chart is entirely 4K or not: non-4K charts keep ms/gap
    }
    const win = aggcWindows(s, ms, gap);
    const nw = win.nw;
    const M = new Float64Array(nw), num1 = new Float64Array(nw);
    for (let r = 0; r < s.n; r++) {
        const w = win.inv[r];
        M[w] += m[r];
        num1[w] += m[r] * Math.pow(Math.max(D[r], 0.0), pw1);
    }
    let num = 0, den = 0;
    for (let w = 0; w < nw; w++) {
        const d1 = Math.pow(num1[w] / Math.max(M[w], EPS), 1.0 / pw1);
        num += M[w] * Math.pow(Math.max(d1, 0.0), pw2);
        den += M[w];
    }
    return Math.pow(num / Math.max(den, EPS), 1.0 / pw2);
}

function aggcDemand(b, s, D, gp, p, holdW) {
    const m = aggcMass(s, gp, p, holdW);
    const pw1 = Math.max(p.aggC_pw1, 0.05);
    const tau = Math.max(p.aggC_tau, 50.0);
    const kap = Math.max(p.aggC_kap, 1e-9);
    const geom = aggcGeom(p);
    let ms = geom.ms, gap = geom.gap;
    if (geom.use4k && b.is4k) { ms = geom.ms4 > 0 ? geom.ms4 : ms; gap = geom.gap4 > 0 ? geom.gap4 : gap; }
    const win = aggcWindows(s, ms, gap);
    const nw = win.nw;
    const M = new Float64Array(nw), N1 = new Float64Array(nw);
    for (let r = 0; r < s.n; r++) {
        const w = win.inv[r];
        M[w] += m[r];
        N1[w] += m[r] * Math.pow(Math.max(D[r], 0.0), pw1);
    }
    const DD = new Float64Array(nw);
    for (let w = 0; w < nw; w++) DD[w] = Math.pow(N1[w] / Math.max(M[w], EPS), 1.0 / pw1);
    const DEC = new Float64Array(nw);
    for (let w = 0; w < nw; w++) DEC[w] = win.reset[w] ? 0.0 : Math.exp(-win.preGap[w] / tau);
    let hi = 0;
    for (let w = 0; w < nw; w++) hi = Math.max(hi, DD[w] + 1.0);
    let lo = 0.0;
    for (let it = 0; it < 26; it++) {
        const mid = 0.5 * (lo + hi);
        let F = 0.0, peak = 0.0;
        for (let w = 0; w < nw; w++) {
            F = Math.max(0.0, F * DEC[w] + M[w] * (DD[w] - mid));
            peak = Math.max(peak, F);
        }
        if (peak <= kap) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
}

function aggregateSR(b, s, D, p, holdW) {
    const n = b.n;
    let Dv = D;
    if (p.env_w) {
        const E = peakEnvelope(b, s, D, Math.max(p.env_ms === undefined ? 800.0 : p.env_ms, 50.0));
        Dv = new Float64Array(n);
        for (let r = 0; r < n; r++) Dv[r] = (1.0 - p.env_w) * D[r] + p.env_w * E[r];
    }
    const gp = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const dnext = r + 1 < n ? b.dtMs[r] : 0.0;
        const dprev = r > 0 ? b.dtMs[r - 1] : 0.0;
        gp[r] = Math.max(0.5 * (dnext + dprev), 0.0);
    }
    const gapCap = p.aggw_gap_cap || 0.0;
    if (gapCap > 0.0) for (let r = 0; r < n; r++) gp[r] = Math.min(gp[r], gapCap);
    const mode = Math.round(p.agg_mode);
    if (mode === 4) return aggcTwoLevel(b, s, Dv, gp, p, holdW);
    if (mode === 5) return aggcDemand(b, s, Dv, gp, p, holdW);
    const w = aggregateWeights(b, s, p, holdW);
    if (mode === 3) return aggregatePow(b, s, Dv, w, p)[0];
    throw new Error("aggregate mode " + mode + " is not implemented in the v1.2.0 JS port");
}

// output alignment (core/model.postprocess)
function postprocess(b, s, sr, p) {
    const nEff = b.nNotes;
    let v = sr * nEff / (nEff + Math.max(p.pp_n0, 1e-6));
    const thr = p.pp_thr, div = Math.max(p.pp_div, 1e-3);
    if (v > thr) v = thr + (v - thr) / div;
    return Math.max(v * p.pp_scale * p.calib_a + p.calib_b, 0.0);
}

// ============================================================
// RC / LN — SPMSubmodel rcln v1.2 engine (Python rcln/engine.py port)
// Single-chart simplification; integer-clock path (clock.plan === None).
// ============================================================

function canonicalNotes(notes) {
    // role.canonical: stable sort by (time,col); merge exact duplicates on the
    // same physical key; conflicting tails are an input error.
    const n = notes.nNotes;
    const order = Array.from({ length: n }, (_, i) => i);
    order.sort((a, b) => notes.time[a] - notes.time[b] || notes.col[a] - notes.col[b]);
    const t = new Float64Array(n), c = new Int32Array(n), e = new Float64Array(n), ln = new Uint8Array(n);
    let m = 0;
    for (let k = 0; k < n; k++) {
        const i = order[k];
        if (m > 0 && t[m - 1] === notes.time[i] && c[m - 1] === notes.col[i]) {
            if (e[m - 1] !== notes.lnEnd[i]) throw new Error('Conflicting simultaneous objects on one physical key.');
            continue;
        }
        t[m] = notes.time[i]; c[m] = notes.col[i];
        e[m] = notes.lnEnd[i]; ln[m] = notes.isLn[i]; m++;
    }
    return { time: t.subarray(0, m), col: c.subarray(0, m), lnEnd: e.subarray(0, m),
             isLn: ln.subarray(0, m), keyCount: notes.keyCount, od: notes.od,
             rate: notes.rate, nNotes: m };
}

function mirrorNotes(notes) {
    const n = notes.nNotes;
    const order = Array.from({ length: n }, (_, i) => i);
    order.sort((a, b) => notes.time[a] - notes.time[b] || (6 - notes.col[a]) - (6 - notes.col[b]));
    const t = new Float64Array(n), c = new Int32Array(n), e = new Float64Array(n), ln = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
        const i = order[k];
        t[k] = notes.time[i]; c[k] = 6 - notes.col[i];
        e[k] = notes.lnEnd[i]; ln[k] = notes.isLn[i];
    }
    return { time: t, col: c, lnEnd: e, isLn: ln, keyCount: notes.keyCount, od: notes.od,
             rate: notes.rate, nNotes: n };
}

function cmpRawBytes(a, b) {
    // lexicographic compare of the little-endian byte representation
    const len = Math.min(a.length, b.length);
    const dvA = new DataView(new ArrayBuffer(8)), dvB = new DataView(new ArrayBuffer(8));
    for (let i = 0; i < len; i++) {
        if (a instanceof Int32Array) { dvA.setInt32(0, a[i], true); dvB.setInt32(0, b[i], true); }
        else { dvA.setFloat64(0, a[i], true); dvB.setFloat64(0, b[i], true); }
        for (let j = 0; j < 4; j++) {
            const x = dvA.getUint8(j), y = dvB.getUint8(j);
            if (x !== y) return x < y ? -1 : 1;
        }
        // int32 has 4 bytes, float64 has 8
        if (a instanceof Float64Array) {
            for (let j = 4; j < 8; j++) {
                const x = dvA.getUint8(j), y = dvB.getUint8(j);
                if (x !== y) return x < y ? -1 : 1;
            }
        }
    }
    return a.length - b.length;
}

function tapNotes(notes) {
    const n = notes.nNotes;
    const ln = new Uint8Array(n), e = new Float64Array(n);
    for (let i = 0; i < n; i++) e[i] = notes.time[i];
    return { time: notes.time, col: notes.col, lnEnd: e, isLn: ln,
             keyCount: notes.keyCount, od: notes.od, rate: notes.rate, nNotes: n };
}

function alignScore(raw, keyCount, modelInfo) {
    const a = modelInfo.alignment[String(keyCount)];
    if (!a) return raw;
    return a.scale * Math.pow(Math.max(raw, 0.0), a.power);
}

function presenceWeights(notes, s, width, exponent) {
    width = width === undefined ? 700.0 : width;
    exponent = exponent === undefined ? 0.5 : exponent;
    const n = s.n;
    const present = new Float64Array(n);
    for (let r = 0; r < n; r++) present[r] = s.held[r] > 0 ? 1.0 : 0.0;
    let anyLn = false;
    for (let i = 0; i < notes.nNotes; i++) if (notes.isLn[i]) { anyLn = true; break; }
    if (anyLn) {
        for (let i = 0; i < notes.nNotes; i++) {
            if (!notes.isLn[i]) continue;
            // head row: searchsorted(s.t, time) (exact row time)
            const head = lowerBound(s.t, notes.time[i]);
            if (head < n) present[head] = 1.0;
            const tail = lowerBound(s.t, notes.lnEnd[i]);
            if (tail < n) present[tail] = 1.0;
        }
    }
    const out = new Float64Array(n);
    const g = wmean(s.b, s, present, width);
    for (let r = 0; r < n; r++) out[r] = Math.pow(clamp(g[r], 0.0, 1.0), exponent);
    return out;
}

function lowerBound(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < x) lo = mid + 1; else hi = mid; }
    return lo;
}

function engagementMass(s, p) {
    const n = s.n;
    const gp = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const dnext = r + 1 < n ? s.dtDiff[r] : 0.0;
        const dprev = r > 0 ? s.dtDiff[r - 1] : 0.0;
        gp[r] = Math.max(0.5 * (dnext + dprev), 0.0);
    }
    const cap = p.aggw_gap_cap || 0.0;
    if (cap > 0.0) for (let r = 0; r < n; r++) gp[r] = Math.min(gp[r], cap);
    return aggcMass(s, gp, p, true);
}

function preparedField(s, field, p) {
    const n = s.n;
    const out = new Float64Array(n);
    const env = p.env_w || 0.0;
    if (env) {
        const E = peakEnvelope(s.b, s, field, Math.max(p.env_ms === undefined ? 800.0 : p.env_ms, 50.0));
        for (let r = 0; r < n; r++) out[r] = Math.max((1.0 - env) * field[r] + env * E[r], 0.0);
    } else {
        for (let r = 0; r < n; r++) out[r] = Math.max(Number.isFinite(field[r]) ? field[r] : 0.0, 0.0);
    }
    return out;
}

function windowGeometryFor(s, p) {
    const geom = aggcGeom(p);
    let ms = geom.ms, gap = geom.gap;
    if (geom.use4k && s.is4k[0]) { ms = geom.ms4 > 0 ? geom.ms4 : ms; gap = geom.gap4 > 0 ? geom.gap4 : gap; }
    return { ms, gap };
}

function lnAggregate(s, field, g, p) {
    const n = s.n;
    const D = preparedField(s, field, p);   // note: preparedField applies env; python does its own env here
    const gp = new Float64Array(n);
    for (let r = 0; r < n; r++) {
        const dnext = r + 1 < n ? s.dtDiff[r] : 0.0;
        const dprev = r > 0 ? s.dtDiff[r - 1] : 0.0;
        gp[r] = Math.max(0.5 * (dnext + dprev), 0.0);
    }
    const cap = p.aggw_gap_cap || 0.0;
    if (cap > 0.0) for (let r = 0; r < n; r++) gp[r] = Math.min(gp[r], cap);
    const mass = aggcMass(s, gp, p, true);
    let sw = 0, sm = 0;
    const weighted = new Float64Array(n);
    for (let r = 0; r < n; r++) { weighted[r] = mass[r] * g[r]; sw += weighted[r]; sm += mass[r]; }
    const cov = sm ? sw / sm : 0.0;
    const geo = windowGeometryFor(s, p);
    const win = aggcWindows(s, geo.ms, geo.gap);
    const nw = win.nw;
    const W = new Float64Array(nw), V = new Float64Array(nw);
    const a = Math.max(p.aggC_pw1, 0.05), b = Math.max(p.aggC_pw2, 0.05);
    for (let r = 0; r < n; r++) {
        const w = win.inv[r];
        W[w] += weighted[r];
        V[w] += weighted[r] * Math.pow(D[r], a);
    }
    let num = 0, den = 0;
    for (let w = 0; w < nw; w++) {
        const d1 = Math.pow(V[w] / Math.max(W[w], 1e-9), 1.0 / a);
        num += W[w] * Math.pow(d1, b);
        den += W[w];
    }
    let raw = Math.pow(num / Math.max(den, 1e-9), 1.0 / b);
    const count = s.nNotesVal * cov;
    raw *= count / (count + Math.max(p.pp_n0, 1e-6));
    if (raw > p.pp_thr) raw = p.pp_thr + (raw - p.pp_thr) / Math.max(p.pp_div, 0.001);
    let score = Math.max(raw * p.pp_scale * p.calib_a + p.calib_b, 0.0);
    return [score * Math.min(cov / 0.40, 1.0), cov];
}

function rcWindows(full, rice, fullField, riceField, g, p) {
    const dRc = preparedField(rice, riceField, p);
    const dLn = preparedField(full, fullField, p);
    const geo = windowGeometryFor(rice, p);
    const win = aggcWindows(rice, geo.ms, geo.gap);
    const nw = win.nw;
    const power = Math.max(p.aggC_pw1, 0.05);
    const rm = engagementMass(rice, p);
    const lm = engagementMass(full, p);
    const rw = new Float64Array(nw), accRc = new Float64Array(nw),
          totalLn = new Float64Array(nw), presentLn = new Float64Array(nw), accLn = new Float64Array(nw);
    for (let r = 0; r < rice.n; r++) {
        const w = win.inv[r];
        rw[w] += rm[r];
        accRc[w] += rm[r] * Math.pow(dRc[r], power);
    }
    for (let r = 0; r < full.n; r++) {
        // rice and full share the same row grid for integer charts
        const w = win.inv[r];
        totalLn[w] += lm[r];
        presentLn[w] += lm[r] * g[r];
        accLn[w] += lm[r] * g[r] * Math.pow(dLn[r], power);
    }
    const rc = new Float64Array(nw), ln = new Float64Array(nw);
    for (let w = 0; w < nw; w++) {
        rc[w] = Math.pow(accRc[w] / Math.max(rw[w], 1e-9), 1.0 / power);
        ln[w] = Math.pow(accLn[w] / Math.max(presentLn[w], 1e-9), 1.0 / power);
        const localCov = presentLn[w] / Math.max(totalLn[w], 1e-9);
        ln[w] *= clamp(localCov / 0.40, 0.0, 1.0);
    }
    return { rw, rc, ln };
}

function rcAggregate(full, rice, fullField, riceField, g, lnScore, headScore, p) {
    const w = rcWindows(full, rice, fullField, riceField, g, p);
    const power = Math.max(p.aggC_pw2, 0.05);
    let num = 0, den = 0;
    for (let k = 0; k < w.rw.length; k++) {
        const ratio = w.ln[k] / Math.max(w.rc[k], 1e-9);
        const share = clamp(ratio, 0.0, 1.0);
        const chartRatio = lnScore / Math.max(headScore, 1e-9);
        const intensity = 0.90 * clamp((1.60 - chartRatio) / 0.40, 0.0, 1.0);
        const weight = w.rw[k] * (1.0 - intensity * share);
        num += weight * Math.pow(w.rc[k], power);
        den += weight;
    }
    return Math.pow(num / Math.max(den, 1e-9), 1.0 / power);
}

// ============================================================
// MAIN ENTRY — evaluate one chart (SPM Rating v1.2.0 + SPMSubmodel rcln)
// ============================================================
function evaluateChart(osuContent, speedRate, p, modelInfo) {
    p = p || SPM_V120_PARAMS;
    modelInfo = modelInfo || SPM_V120_MODEL;
    if (typeof SPMExtHandRole === 'undefined' || typeof SPMExtGeometry === 'undefined') {
        throw new Error('v1.2.0 extension modules are not loaded');
    }
    let nt = parseOsu(osuContent, speedRate);
    if (!nt || nt.nNotes < 2) return { error: "not a valid mania chart" };
    nt = SPMExtHandRole.roleCanonical(nt);
    if (nt.nNotes < 2) return { error: "too few notes" };
    let notes = nt, other = mirrorNotes(nt);
    if (cmpRawBytes(other.col, notes.col) < 0 ||
        (cmpRawBytes(other.col, notes.col) === 0 && cmpRawBytes(other.lnEnd, notes.lnEnd) < 0)) {
        notes = other; other = nt;
    }
    const sources = [];
    let reference = null, extra = null;
    for (const view of [notes, other]) {
        const local = Object.assign({}, p, { x_jump_w: 0.0 });
        const b = buildBatch(view);
        if (!b) return { error: "too few notes" };
        const s = buildStruct(b, local);
        let cur = computeCurves(b, s, Object.assign({}, local, { d_rec: 0 }));
        const rec = SPMExtGeometry.recoveryCurve(view.time, s.t, local.recov_w, local.recov_wl);
        cur = Object.assign({}, cur, { Recov: rec });
        const data = SPMExtHandRole.handExtract(view, 30.0);
        const rates = SPMExtHandRole.handField(data, s.t, local.w_jm);
        const unit = SPMExtHandRole.handCostPrice(SPMExtHandRole.handCostState(rates), s.x, p);
        if (reference === null) {
            reference = s;
            extra = SPMExtHandRole.roleField(nt, p, s.t);
            for (let r = 0; r < extra.length; r++) extra[r] *= modelInfo.role_price;
        }
        sources.push({ b, s, cur, unit });
    }
    const n = reference.n;
    const release = new Float64Array(n);
    for (let r = 0; r < n; r++) release[r] = 0.5 * (sources[0].cur.Rbar[r] + sources[1].cur.Rbar[r]);
    function combineWith(src, addExtra) {
        const cur = Object.assign({}, src.cur, {
            Rbar: release,
            Jm_context: src.cur.Jm,
            Jm: new Float64Array(n),
        });
        for (let r = 0; r < n; r++) cur.Jm[r] = src.cur.Jm[r] + src.unit[r] + (addExtra ? extra[r] : 0.0);
        return combine(src.b, src.s, cur, p);
    }
    const parts = [combineWith(sources[0], true), combineWith(sources[1], true)];
    const field = new Float64Array(n);
    for (let r = 0; r < n; r++) field[r] = 0.5 * (parts[0][r] + parts[1][r]);
    const rawAgg = aggregateSR(reference.b, reference, field, p, true);
    const starRaw = postprocess(reference.b, reference, rawAgg, p);

    // ---- LN difficulty
    const g = presenceWeights(notes, reference, 700.0, 0.5);
    const lnPair = lnAggregate(reference, field, g, p);
    const starLnRaw = lnPair[0];
    const lnCov = lnPair[1];

    // ---- RC difficulty (de-LN chart)
    let starRcRaw = starRaw, Drc = null, rcAggRaw = rawAgg;
    const hasLn = (function () { for (let i = 0; i < notes.nNotes; i++) if (notes.isLn[i]) return true; return false; })();
    if (hasLn) {
        const rices = [];
        for (let vi = 0; vi < 2; vi++) {
            const ntap = tapNotes(vi === 0 ? notes : other);
            const b = buildBatch(ntap);
            const s = buildStruct(b, Object.assign({}, p, { x_jump_w: 0.0 }));
            let cur = computeCurves(b, s, Object.assign({}, p, { x_jump_w: 0.0, d_rec: 0 }));
            cur = Object.assign({}, cur, { Recov: sources[vi].cur.Recov });
            // rice unit uses the full-chart hand cost (rcln _native)
            rices.push({ b, s, cur, unit: sources[vi].unit });
        }
        function combineRice(src) {
            // rcln _native: the rice view uses its OWN Rbar (all zeros), not the
            // full chart's shared release field.
            const cur = Object.assign({}, src.cur, { Rbar: src.cur.Rbar, Jm_context: src.cur.Jm, Jm: new Float64Array(n) });
            for (let r = 0; r < n; r++) cur.Jm[r] = src.cur.Jm[r] + src.unit[r];
            return combine(src.b, src.s, cur, p);
        }
        const rparts = [combineRice(rices[0]), combineRice(rices[1])];
        Drc = new Float64Array(n);
        for (let r = 0; r < n; r++) Drc[r] = 0.5 * (rparts[0][r] + rparts[1][r]);
        const headAgg = aggregateSR(rices[0].b, rices[0].s, Drc, p, true);
        rcAggRaw = headAgg;
        const headScore = postprocess(rices[0].b, rices[0].s, headAgg, p);
        const rcAgg = rcAggregate(reference, rices[0].s, field, Drc, g, starLnRaw, headScore, p);
        starRcRaw = postprocess(reference.b, reference, rcAgg, p);
    }

    return {
        starRaw, starRcRaw, starLnRaw, lnCov, rcAggRaw,
        // star fields keep the raw model scale (compat with v1.0.x tooling);
        // the aligned reference scale the overlay displays is in *Aligned.
        star: starRaw,
        starRc: starRcRaw,
        starLn: hasLn ? starLnRaw : 0.0,
        starAligned: alignScore(starRaw, notes.keyCount, modelInfo),
        starRcAligned: alignScore(starRcRaw, notes.keyCount, modelInfo),
        starLnAligned: hasLn ? alignScore(starLnRaw, notes.keyCount, modelInfo) : 0.0,
        rawAgg, hasLn,
        nNotes: notes.nNotes, keyCount: notes.keyCount, od: notes.od,
        nRows: reference.n, duration: reference.duration / 1000.0,
        D: field, Drc, g,
        b: reference.b, s: reference,
        modelInfo,
    };
}

function displayCurves(res) {
    const n = res.nRows;
    const rawAgg = res.rawAgg || 0.0;
    const star = res.starAligned !== undefined ? res.starAligned : res.star;
    const k = rawAgg > 1e-9 ? star / rawAgg : 0.0;
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) out[r] = Math.max(res.D[r] * k, 0.0);
    return out;
}

/** RC display curve on the same calibrated star scale as displayCurves(). */
function displayCurvesRC(res) {
    const n = res.nRows;
    if (!res.Drc) return zeros(n);
    const rawAgg = res.rcAggRaw || 0.0;
    const starRc = res.starRcAligned !== undefined ? res.starRcAligned : res.starRc;
    const k = rawAgg > 1e-9 ? starRc / rawAgg : 0.0;
    const out = new Float64Array(n);
    for (let r = 0; r < n; r++) out[r] = Math.max(res.Drc[r] * k, 0.0);
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
// Generated by _dev/calib/generate_dan_constants_v120.py from the SPM Rating
// v1.2.0 + SPMSubmodel RC/LN reference-scale ratings of the dan course packs
// and dataset dan subsets, measured separately for both v1.2.0 model variants
// (detail = 完整, compact = 精简). The inline copy mirrors dan_constants.json
// so the overlay still maps dans if the JSON fetch fails.
// ============================================================
const DAN_NODES_DEFAULT = {"_note":"SPM Rating v1.2.0-rc3 + SPMSubmodel dan nodes (RC/LN sub-scores, reference scale) for both v1.2.0 model variants: detail (完整) and compact (精简). RC/LN star nodes measured on dan course packs (4K/6K), the 7K dan dataset subset (RegularDan/LNDan) and maps/ 7K Dan Phase IV; interpolation maps reference-scale star -> continuous dan level. The legacy top-level 4K/6K/7K tables mirror the detail variant.","dan_names":["0th","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","Gamma","Azimuth","Zenith","Stellium"],"variants":["detail","compact"],"modes":{"detail":{"4K":{"RC":{"nodes":[{"dan":1,"sr":4.6556},{"dan":2,"sr":5.347},{"dan":3,"sr":5.3995},{"dan":4,"sr":6.7533},{"dan":5,"sr":7.696},{"dan":6,"sr":8.3991},{"dan":7,"sr":8.7255},{"dan":8,"sr":9.7935},{"dan":9,"sr":9.9882},{"dan":10,"sr":10.7212},{"dan":11,"sr":11.054},{"dan":12,"sr":11.5315},{"dan":13,"sr":12.2255},{"dan":14,"sr":13.5668},{"dan":15,"sr":15.5746}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":1,"sr":5.5368},{"dan":2,"sr":6.1346},{"dan":3,"sr":6.9287},{"dan":4,"sr":6.9792},{"dan":5,"sr":6.9792},{"dan":6,"sr":8.2211},{"dan":7,"sr":8.7164},{"dan":8,"sr":9.5209},{"dan":9,"sr":9.8842},{"dan":10,"sr":10.3141},{"dan":11,"sr":11.1637},{"dan":12,"sr":11.6612},{"dan":13,"sr":12.8113},{"dan":14,"sr":13.894},{"dan":15,"sr":14.8314}],"source":"maps/ dan packs"}},"6K":{"RC":{"nodes":[{"dan":0,"sr":9.4878},{"dan":1,"sr":10.5528},{"dan":2,"sr":11.7668},{"dan":3,"sr":13.4361},{"dan":4,"sr":14.7429},{"dan":5,"sr":15.721},{"dan":6,"sr":16.7984},{"dan":7,"sr":17.6559},{"dan":8,"sr":18.8055},{"dan":9,"sr":19.4198}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":0,"sr":10.2789},{"dan":1,"sr":12.3354},{"dan":2,"sr":12.3354},{"dan":3,"sr":13.6329},{"dan":4,"sr":14.6836},{"dan":5,"sr":15.4653},{"dan":6,"sr":16.3039},{"dan":7,"sr":17.0037},{"dan":8,"sr":17.9574},{"dan":9,"sr":18.3819},{"dan":10,"sr":19.1158},{"dan":11,"sr":19.7814},{"dan":12,"sr":21.0617},{"dan":13,"sr":21.9637},{"dan":14,"sr":23.9365}],"source":"maps/ dan packs"}},"7K":{"RC":{"nodes":[{"dan":0,"sr":4.0528},{"dan":1,"sr":4.3473},{"dan":2,"sr":5.0025},{"dan":3,"sr":5.3208},{"dan":4,"sr":5.6059},{"dan":5,"sr":5.9788},{"dan":6,"sr":6.5844},{"dan":7,"sr":6.8362},{"dan":8,"sr":7.1808},{"dan":9,"sr":7.6748},{"dan":10,"sr":8.114},{"dan":11,"sr":8.7107},{"dan":12,"sr":9.3202},{"dan":13,"sr":10.1334},{"dan":14,"sr":10.9225}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses + maps/ 7K Dan Phase IV"},"LN":{"nodes":[{"dan":0,"sr":4.5344},{"dan":1,"sr":4.6982},{"dan":2,"sr":4.7009},{"dan":3,"sr":5.1115},{"dan":4,"sr":5.7},{"dan":5,"sr":6.2495},{"dan":6,"sr":6.5816},{"dan":7,"sr":6.9089},{"dan":8,"sr":7.3104},{"dan":9,"sr":7.5203},{"dan":10,"sr":8.2857},{"dan":11,"sr":8.6285},{"dan":12,"sr":9.3244},{"dan":13,"sr":10.0899},{"dan":14,"sr":11.3629}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses + maps/ 7K Dan Phase IV"}}},"compact":{"4K":{"RC":{"nodes":[{"dan":1,"sr":4.6166},{"dan":2,"sr":5.3095},{"dan":3,"sr":5.3607},{"dan":4,"sr":6.7141},{"dan":5,"sr":7.6603},{"dan":6,"sr":8.3694},{"dan":7,"sr":8.6834},{"dan":8,"sr":9.7911},{"dan":9,"sr":9.9868},{"dan":10,"sr":10.7101},{"dan":11,"sr":11.0482},{"dan":12,"sr":11.5296},{"dan":13,"sr":12.2159},{"dan":14,"sr":13.5742},{"dan":15,"sr":15.5904}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":1,"sr":5.3563},{"dan":2,"sr":6.0078},{"dan":3,"sr":6.8301},{"dan":4,"sr":6.9075},{"dan":5,"sr":6.9075},{"dan":6,"sr":8.1466},{"dan":7,"sr":8.6872},{"dan":8,"sr":9.5316},{"dan":9,"sr":9.8846},{"dan":10,"sr":10.3294},{"dan":11,"sr":11.183},{"dan":12,"sr":11.6665},{"dan":13,"sr":12.8285},{"dan":14,"sr":13.9083},{"dan":15,"sr":14.8534}],"source":"maps/ dan packs"}},"6K":{"RC":{"nodes":[{"dan":0,"sr":9.5365},{"dan":1,"sr":10.5888},{"dan":2,"sr":11.7892},{"dan":3,"sr":13.4442},{"dan":4,"sr":14.7508},{"dan":5,"sr":15.7015},{"dan":6,"sr":16.7652},{"dan":7,"sr":17.6238},{"dan":8,"sr":18.8045},{"dan":9,"sr":19.4307}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":0,"sr":10.2047},{"dan":1,"sr":12.2712},{"dan":2,"sr":12.2712},{"dan":3,"sr":13.5293},{"dan":4,"sr":14.7063},{"dan":5,"sr":15.433},{"dan":6,"sr":16.307},{"dan":7,"sr":17.0242},{"dan":8,"sr":17.977},{"dan":9,"sr":18.3929},{"dan":10,"sr":19.1971},{"dan":11,"sr":19.8608},{"dan":12,"sr":21.1322},{"dan":13,"sr":22.0202},{"dan":14,"sr":23.9388}],"source":"maps/ dan packs"}},"7K":{"RC":{"nodes":[{"dan":0,"sr":4.0753},{"dan":1,"sr":4.3702},{"dan":2,"sr":5.0231},{"dan":3,"sr":5.3277},{"dan":4,"sr":5.6167},{"dan":5,"sr":5.984},{"dan":6,"sr":6.5864},{"dan":7,"sr":6.8335},{"dan":8,"sr":7.1688},{"dan":9,"sr":7.657},{"dan":10,"sr":8.0902},{"dan":11,"sr":8.7105},{"dan":12,"sr":9.3119},{"dan":13,"sr":10.1126},{"dan":14,"sr":10.8835}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses + maps/ 7K Dan Phase IV"},"LN":{"nodes":[{"dan":0,"sr":4.5237},{"dan":1,"sr":4.6614},{"dan":2,"sr":4.6883},{"dan":3,"sr":5.1198},{"dan":4,"sr":5.7103},{"dan":5,"sr":6.2423},{"dan":6,"sr":6.5931},{"dan":7,"sr":6.9045},{"dan":8,"sr":7.3167},{"dan":9,"sr":7.5267},{"dan":10,"sr":8.303},{"dan":11,"sr":8.6606},{"dan":12,"sr":9.3566},{"dan":13,"sr":10.1133},{"dan":14,"sr":11.3643}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses + maps/ 7K Dan Phase IV"}}}},"4K":{"RC":{"nodes":[{"dan":1,"sr":4.6556},{"dan":2,"sr":5.347},{"dan":3,"sr":5.3995},{"dan":4,"sr":6.7533},{"dan":5,"sr":7.696},{"dan":6,"sr":8.3991},{"dan":7,"sr":8.7255},{"dan":8,"sr":9.7935},{"dan":9,"sr":9.9882},{"dan":10,"sr":10.7212},{"dan":11,"sr":11.054},{"dan":12,"sr":11.5315},{"dan":13,"sr":12.2255},{"dan":14,"sr":13.5668},{"dan":15,"sr":15.5746}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":1,"sr":5.5368},{"dan":2,"sr":6.1346},{"dan":3,"sr":6.9287},{"dan":4,"sr":6.9792},{"dan":5,"sr":6.9792},{"dan":6,"sr":8.2211},{"dan":7,"sr":8.7164},{"dan":8,"sr":9.5209},{"dan":9,"sr":9.8842},{"dan":10,"sr":10.3141},{"dan":11,"sr":11.1637},{"dan":12,"sr":11.6612},{"dan":13,"sr":12.8113},{"dan":14,"sr":13.894},{"dan":15,"sr":14.8314}],"source":"maps/ dan packs"}},"6K":{"RC":{"nodes":[{"dan":0,"sr":9.4878},{"dan":1,"sr":10.5528},{"dan":2,"sr":11.7668},{"dan":3,"sr":13.4361},{"dan":4,"sr":14.7429},{"dan":5,"sr":15.721},{"dan":6,"sr":16.7984},{"dan":7,"sr":17.6559},{"dan":8,"sr":18.8055},{"dan":9,"sr":19.4198}],"source":"maps/ dan packs"},"LN":{"nodes":[{"dan":0,"sr":10.2789},{"dan":1,"sr":12.3354},{"dan":2,"sr":12.3354},{"dan":3,"sr":13.6329},{"dan":4,"sr":14.6836},{"dan":5,"sr":15.4653},{"dan":6,"sr":16.3039},{"dan":7,"sr":17.0037},{"dan":8,"sr":17.9574},{"dan":9,"sr":18.3819},{"dan":10,"sr":19.1158},{"dan":11,"sr":19.7814},{"dan":12,"sr":21.0617},{"dan":13,"sr":21.9637},{"dan":14,"sr":23.9365}],"source":"maps/ dan packs"}},"7K":{"RC":{"nodes":[{"dan":0,"sr":4.0528},{"dan":1,"sr":4.3473},{"dan":2,"sr":5.0025},{"dan":3,"sr":5.3208},{"dan":4,"sr":5.6059},{"dan":5,"sr":5.9788},{"dan":6,"sr":6.5844},{"dan":7,"sr":6.8362},{"dan":8,"sr":7.1808},{"dan":9,"sr":7.6748},{"dan":10,"sr":8.114},{"dan":11,"sr":8.7107},{"dan":12,"sr":9.3202},{"dan":13,"sr":10.1334},{"dan":14,"sr":10.9225}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses + maps/ 7K Dan Phase IV"},"LN":{"nodes":[{"dan":0,"sr":4.5344},{"dan":1,"sr":4.6982},{"dan":2,"sr":4.7009},{"dan":3,"sr":5.1115},{"dan":4,"sr":5.7},{"dan":5,"sr":6.2495},{"dan":6,"sr":6.5816},{"dan":7,"sr":6.9089},{"dan":8,"sr":7.3104},{"dan":9,"sr":7.5203},{"dan":10,"sr":8.2857},{"dan":11,"sr":8.6285},{"dan":12,"sr":9.3244},{"dan":13,"sr":10.0899},{"dan":14,"sr":11.3629}],"source":"spm_dataset-0.4.0 RegularDan/LNDan dan courses + maps/ 7K Dan Phase IV"}}};

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

// Active model variant drives the dan node table ("detail" | "compact").
// processMap() sets it from the rating-algorithm setting; display-side dan
// calls then read the matching table. Default = detail.
let DAN_VARIANT = "detail";

function setDanVariant(id) {
    DAN_VARIANT = (id === "compact") ? "compact" : "detail";
    return DAN_VARIANT;
}

/** Dan node table for a key count / kind / model variant.
 *  v1.2.0 per-variant layout:  DAN_CONSTANTS.modes[variant][mode][kind]
 *  legacy single-table layout: DAN_CONSTANTS[mode][kind]                   */
function danTableFor(keyCount, kind, variant) {
    if (!DAN_CONSTANTS) return null;
    const mode = keyCount === 4 ? "4K" : keyCount === 6 ? "6K" : "7K";
    const v = variant || DAN_VARIANT;
    const perVariant = DAN_CONSTANTS.modes && DAN_CONSTANTS.modes[v];
    let tbl = perVariant && perVariant[mode] && perVariant[mode][kind];
    if (!tbl) tbl = DAN_CONSTANTS[mode] && DAN_CONSTANTS[mode][kind];
    return tbl || null;
}

function srToDanLevel(sr, keyCount, kind, variant) {
    const tbl = danTableFor(keyCount, kind, variant);
    if (!tbl || !tbl.nodes || tbl.nodes.length === 0) return null;
    return interpDan(sr, tbl.nodes);
}

/** Dan level → display label.
 *  style "third"  → "Gamma low" / "Gamma" / "Gamma high"  (v0.5.1 style)
 *  style "pm"     → "Gamma-"   / "Gamma" / "Gamma+"
 *  style "number" → "11.37"                                     */
function danLevelToLabel(level, keyCount, kind, style, variant) {
    style = style || "third";
    // ladder length comes from this keycount/kind's node table, so modes
    // without a top-range node (e.g. 7K has no Stellium course) top out at
    // their highest measured dan; names come from danNameForLevel
    const tbl = danTableFor(keyCount, kind, variant);
    const topDan = tbl && tbl.nodes && tbl.nodes.length
        ? tbl.nodes[tbl.nodes.length - 1].dan : 14;
    const top = Math.round(topDan);
    if (style === "number") {
        // v1.2.0: number mode is shifted by +0.5 so that the displayed number
        // is the dan value mania players quote: 8.5 = 8dan exactly, 11.5 = Gamma
        // (7K). Display-only: ratings and dan levels are unchanged.
        if (!Number.isFinite(level)) return "-";
        return (Math.max(level, 0) + 0.5).toFixed(2);
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
    // rating algorithm / model variant: "detail" (完整) or "compact" (精简).
    // The variant picks both the parameters and the reference-scale alignment.
    const variant = modelVariant(options.model || options.modelVariant || "detail");
    setDanVariant(variant.id);
    const res = evaluateChart(osuContent, speedRate, variant.params, variant.model);
    if (res.error) return null;

    const star = res.starAligned !== undefined ? res.starAligned : res.star;
    const starRc = res.starRcAligned !== undefined ? res.starRcAligned : res.starRc;
    const starLn = res.starLnAligned !== undefined ? res.starLnAligned : res.starLn;
    const lnCov = res.lnCov, keyCount = res.keyCount;
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
        // which rating algorithm produced these numbers (for the UI / debugging)
        modelVariant: variant.id, modelLabel: variant.label,
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
// v1.2.0 EXTENSION MODULES (hand/role, geometry/recovery)
// ============================================================
/* _dev/port/hand_role.js
 *
 * Plain browser + Node script (no import/export/require, ES2019 syntax).
 * Faithful JavaScript port of SPMRating v1.2.0-rc3:
 *   spm_rating/hand.py       -> roleCanonical (role.canonical), handExtract (hand.extract),
 *                               handField (hand.field), plus handCostState/handCostPrice (hand_cost.py)
 *   spm_rating/role.py       -> roleField (role.field), roleEpisodes, roleIntervalMean, rolePulseMax
 *   spm_rating/actions.py    -> internal A.field / A.mass (via geometry.cumulative)
 *   spm_rating/geometry.py   -> internal geometry.cumulative
 *   spm_rating/hand.py @njit -> _raw_eligibility / maximum_envelope / moments ports
 *
 * Exposes global SPMExtHandRole = { roleCanonical, handExtract, handField,
 *                                   handCostState, handCostPrice, roleField,
 *                                   roleEpisodes, roleIntervalMean, rolePulseMax }
 *
 * Units: note/query times are milliseconds, hand rates are per second.
 * Arrays are Float64Array unless stated; inputs are never mutated.
 */
(function () {
  'use strict';

  var root = (typeof globalThis !== 'undefined') ? globalThis :
             (typeof self !== 'undefined') ? self :
             (typeof window !== 'undefined') ? window : {};

  /* ------------------------------------------------------------------ *
   * Generic helpers                                                     *
   * ------------------------------------------------------------------ */

  function toF64(a) {
    if (a instanceof Float64Array) return a;
    var n = a.length, out = new Float64Array(n);
    for (var i = 0; i < n; i++) out[i] = +a[i];
    return out;
  }

  function toI32(a) {
    if (a instanceof Int32Array) return a;
    var n = a.length, out = new Int32Array(n);
    for (var i = 0; i < n; i++) out[i] = a[i] | 0;
    return out;
  }

  function toU8(a) {
    if (a instanceof Uint8Array) return a;
    var n = a.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = a[i] ? 1 : 0;
    return out;
  }

  // Read a property that may be spelled camelCase (JS layer) or snake_case (Python layer).
  function prop(obj, camel, snake) {
    var v = obj[camel];
    if (v === undefined || v === null) v = obj[snake];
    return v;
  }

  function lowerBound(a, x) { // np.searchsorted(a, x, side='left')
    var lo = 0, hi = a.length, mid;
    while (lo < hi) {
      mid = (lo + hi) >> 1;
      if (a[mid] < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function upperBound(a, x) { // np.searchsorted(a, x, side='right')
    var lo = 0, hi = a.length, mid;
    while (lo < hi) {
      mid = (lo + hi) >> 1;
      if (a[mid] <= x) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function arrayEqualF64(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function arrayEqualI32(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function pickF64(src, take) {
    var n = take.length, out = new Float64Array(n);
    for (var i = 0; i < n; i++) out[i] = src[take[i]];
    return out;
  }

  // Indices i with values[i] === value, ascending (np.flatnonzero(values == value)).
  function indicesEqual(values, value) {
    var out = [];
    for (var i = 0; i < values.length; i++) if (values[i] === value) out.push(i);
    return out;
  }

  // Unique values of int array, ascending (np.unique).
  function uniqueInts(values) {
    var arr = [];
    for (var i = 0; i < values.length; i++) arr.push(values[i]);
    arr.sort(function (x, y) { return x - y; });
    var out = [];
    for (var j = 0; j < arr.length; j++) if (j === 0 || arr[j] !== arr[j - 1]) out.push(arr[j]);
    return out;
  }

  function indicesWhereArr(values, value) {
    return indicesEqual(values, value);
  }

  /* ------------------------------------------------------------------ *
   * hand.py @njit kernels                                               *
   * ------------------------------------------------------------------ */

  // smoothstep on the clamped unit interval: u^3 (10 - 15u + 6u^2)
  function smooth(x) {
    var u = x < 0.0 ? 0.0 : (x > 1.0 ? 1.0 : x);
    return u * u * u * (10.0 - 15.0 * u + 6.0 * u * u);
  }

  // hand._raw_eligibility(time, col, hands, scale) -> {lane, eligible, visits}
  function rawEligibility(time, col, hands, scale) {
    var n = time.length;
    var last = new Int32Array(7);
    for (var i = 0; i < 7; i++) last[i] = -1;
    var lane = new Float64Array(n);
    var e = new Float64Array(n);
    var visits = 0;

    for (var j = 0; j < n; j++) {
      var k = col[j];
      var prev = last[k];
      if (prev >= 0) {
        lane[j] = smooth((time[j] - time[prev]) / scale);
        var count = 0.0;
        var a = upperBound(time, time[prev]);
        var b = lowerBound(time, time[j]);
        for (var m = a; m < b; m++) {
          visits += 1;
          if (hands[m] === hands[j]) {
            count += smooth((time[m] - time[prev]) / scale) * smooth((time[j] - time[m]) / scale);
            if (count >= 1.0) break;
          }
        }
        e[j] = lane[j] * (1.0 - smooth(count));
      }
      last[k] = j;
    }
    return { lane: lane, eligible: e, visits: visits };
  }

  // hand.maximum_envelope(time, weight, query, scale) -> Float64Array(query.length)
  function maximumEnvelope(time, weight, query, scale) {
    var n = time.length;
    var centers = new Float64Array(n);
    var weights = new Float64Array(n);
    var starts = new Float64Array(n);
    var size = 0;
    var a = Math.PI / (2.0 * scale);

    for (var j = 0; j < n; j++) {
      if (weight[j] <= 0.0) continue;
      var t = time[j];
      var w = weight[j];
      if (size > 0 && t === centers[size - 1]) {
        if (w <= weights[size - 1]) continue;
        size -= 1;
      }
      var crossing = t - scale;
      while (size > 0) {
        var old = centers[size - 1];
        var distance = (t - old) * a;
        if (distance >= Math.PI) {
          crossing = t - scale;
        } else {
          var ra = Math.sqrt(weights[size - 1]);
          var rb = Math.sqrt(w);
          var sn = Math.sin(distance / 2.0);
          var numerator = ra - rb + 2.0 * rb * sn * sn;
          crossing = old + Math.atan2(numerator, rb * Math.sin(distance)) / a;
          crossing = Math.min(Math.max(crossing, t - scale), old + scale);
        }
        if (crossing <= starts[size - 1]) {
          size -= 1;
        } else {
          break;
        }
      }
      if (size === 0) crossing = t - scale;
      centers[size] = t;
      weights[size] = w;
      starts[size] = crossing;
      size += 1;
    }

    var out = new Float64Array(query.length);
    var cursor = 0;
    for (var i = 0; i < query.length; i++) {
      if (i > 0 && query[i] < query[i - 1]) {
        throw new Error('Sorted envelope queries required.');
      }
      if (size === 0) continue;
      while (cursor + 1 < size && starts[cursor + 1] <= query[i]) cursor += 1;
      var delta = query[i] - centers[cursor];
      if (Math.abs(delta) < scale) {
        var c = Math.cos(a * delta);
        out[i] = weights[cursor] * c * c;
      }
    }
    return out;
  }

  // hand.moments(time, col, e0, e1, scale) -> {mass:[Float64Array,Float64Array],
  //                                            coactive:[Float64Array,Float64Array]}
  var HAND_MAP0 = [0, 0, 0, 0, 1, 1, 1];
  var HAND_MAP1 = [0, 0, 0, 1, 1, 1, 1];

  function moments(time, col, e0, e1, scale) {
    var n = time.length;
    var mass = [new Float64Array(n), new Float64Array(n)];
    var coactive = [new Float64Array(n), new Float64Array(n)];
    if (n === 0) return { mass: mass, coactive: coactive };

    var evs = [e0, e1];
    var maps = [HAND_MAP0, HAND_MAP1];
    var maximum = [new Float64Array(n), new Float64Array(n)];

    for (var profile = 0; profile < 2; profile++) {
      var ev = evs[profile];
      var mp = maps[profile];
      for (var hand = 0; hand < 2; hand++) {
        var idx = [];
        for (var jj = 0; jj < n; jj++) if (mp[col[jj]] === hand) idx.push(jj);
        var count = idx.length;
        var tsub = new Float64Array(count);
        var wsub = new Float64Array(count);
        for (var q = 0; q < count; q++) {
          tsub[q] = time[idx[q]];
          wsub[q] = ev[idx[q]];
        }
        var env = maximumEnvelope(tsub, wsub, tsub, scale);
        for (var q2 = 0; q2 < count; q2++) maximum[profile][idx[q2]] = env[q2];
      }
    }

    var cs = new Float64Array(n);
    var sn = new Float64Array(n);
    var omega = Math.PI / scale;
    for (var i2 = 0; i2 < n; i2++) {
      var phase = (time[i2] - time[0]) * omega;
      cs[i2] = Math.cos(phase);
      sn[i2] = Math.sin(phase);
    }

    var total = new Float64Array(7 * 9);
    var correction = new Float64Array(7 * 9);
    var left = 0;
    var right = 0;

    function update(index, sign) {
      var k = col[index];
      var base = k * 9;
      var e0i = e0[index];
      var e1i = e1[index];
      var csi = cs[index];
      var sni = sn[index];
      for (var channel = 0; channel < 3; channel++) {
        var weight = channel === 0 ? 1.0 : (channel === 1 ? e0i : e1i);
        var off = base + channel * 3;
        for (var power = 0; power < 3; power++) {
          var trig = power === 0 ? 1.0 : (power === 1 ? csi : sni);
          var value = sign * weight * trig;
          var pos = off + power;
          var y = value - correction[pos];
          var t = total[pos] + y;
          correction[pos] = t - total[pos] - y;
          total[pos] = t;
        }
      }
    }

    for (var j = 0; j < n; j++) {
      while (right < n && time[right] <= time[j] + scale) {
        update(right, 1.0);
        right += 1;
      }
      while (left < right && time[left] < time[j] - scale) {
        update(left, -1.0);
        left += 1;
      }
      for (var p2 = 0; p2 < 2; p2++) {
        var ev2 = evs[p2];
        var hand2 = maps[p2][col[j]];
        var u = 0.0;
        var denominator = 0.0;
        for (var k2 = 0; k2 < 7; k2++) {
          if (maps[p2][k2] === hand2) {
            var b0 = k2 * 9;
            var den = 0.5 * (total[b0] + cs[j] * total[b0 + 1] + sn[j] * total[b0 + 2]);
            if (den < 0.0) den = 0.0;
            var o2 = b0 + (p2 + 1) * 3;
            var num = 0.5 * (total[o2] + cs[j] * total[o2 + 1] + sn[j] * total[o2 + 2]);
            if (num < 0.0) num = 0.0;
            u += den < 1.0 ? den : 1.0;
            denominator += num;
          }
        }
        if (denominator < ev2[j]) denominator = ev2[j];
        var z = u - 1.0;
        if (z < 0.0) z = 0.0; else if (z > 1.0) z = 1.0;
        var gate = smooth(z);
        coactive[p2][j] = u;
        if (denominator > 0.0) {
          var envv = maximum[p2][j];
          mass[p2][j] = ev2[j] * ((envv < denominator ? envv : denominator) / denominator) * gate;
        }
      }
    }
    return { mass: mass, coactive: coactive };
  }

  /* ------------------------------------------------------------------ *
   * role.canonical / role.episodes / role.interval_mean / role.pulse_max *
   * ------------------------------------------------------------------ */

  function sortedPairsOrder(time, col) {
    var n = time.length;
    var order = new Array(n);
    for (var i = 0; i < n; i++) order[i] = i;
    order.sort(function (a, b) {
      var d = time[a] - time[b];
      if (d !== 0) return d;
      var c = col[a] - col[b];
      if (c !== 0) return c;
      return a - b;
    });
    return order;
  }

  // role.canonical(notes): merge exact-duplicate (time, col) objects, re-sort by (time, col).
  function roleCanonical(notes) {
    var time = toF64(notes.time);
    var col = toI32(notes.col);
    var lnEnd = toF64(prop(notes, 'lnEnd', 'ln_end'));
    var isLn = toU8(prop(notes, 'isLn', 'is_ln'));
    var n = time.length;
    var order = sortedPairsOrder(time, col);

    var keep = [];
    for (var k = 0; k < n; k++) {
      var cur = order[k];
      if (k > 0) {
        var prev = order[k - 1];
        if (time[cur] === time[prev] && col[cur] === col[prev]) {
          if (lnEnd[cur] !== lnEnd[prev]) {
            throw new Error('Conflicting simultaneous objects on one physical key.');
          }
          continue;
        }
      }
      keep.push(cur);
    }

    var m = keep.length;
    var outTime = new Float64Array(m);
    var outCol = new Int32Array(m);
    var outEnd = new Float64Array(m);
    var outIsLn = new Uint8Array(m);
    for (var i = 0; i < m; i++) {
      var src = keep[i];
      outTime[i] = time[src];
      outCol[i] = col[src];
      outEnd[i] = lnEnd[src];
      outIsLn[i] = isLn[src];
    }

    var out = {};
    for (var key in notes) {
      if (Object.prototype.hasOwnProperty.call(notes, key)) out[key] = notes[key];
    }
    out.time = outTime;
    out.col = outCol;
    out.lnEnd = outEnd;
    out.isLn = outIsLn;
    out.nNotes = m;
    // Python-layer aliases (kept so the object works with either convention).
    out.ln_end = outEnd;
    out.is_ln = outIsLn;
    out.n_notes = m;
    var colIdx = new Array(7);
    for (var lane = 0; lane < 7; lane++) {
      var list = [];
      for (var r = 0; r < m; r++) if (outCol[r] === lane) list.push(r);
      var arr = new Int32Array(list.length);
      for (var t = 0; t < list.length; t++) arr[t] = list[t];
      colIdx[lane] = arr;
    }
    out.colIdx = colIdx;
    out.col_idx = colIdx;
    return out;
  }

  // role.episodes(notes) -> array of [lane, start, end] (LN spans, lane-major).
  function roleEpisodes(notes) {
    var time = toF64(notes.time);
    var col = toI32(notes.col);
    var lnEnd = toF64(prop(notes, 'lnEnd', 'ln_end'));
    var isLn = toU8(prop(notes, 'isLn', 'is_ln'));
    var n = time.length;
    var result = [];
    for (var lane = 0; lane < 7; lane++) {
      var take = [];
      for (var i = 0; i < n; i++) if (isLn[i] && col[i] === lane) take.push(i);
      take.sort(function (a, b) {
        var d = time[a] - time[b];
        if (d !== 0) return d;
        return a - b;
      });
      var spans = [];
      for (var k = 0; k < take.length; k++) {
        var idx = take[k];
        var h = time[idx];
        var e = lnEnd[idx];
        if (e <= h) continue;
        if (spans.length > 0 && h < spans[spans.length - 1][1]) {
          var last = spans[spans.length - 1];
          if (e > last[1]) last[1] = e;
        } else {
          spans.push([h, e]);
        }
      }
      for (var s = 0; s < spans.length; s++) result.push([lane, spans[s][0], spans[s][1]]);
    }
    return result;
  }

  // role.interval_mean(times, values, query, width); times strictly increasing,
  // values.length === times.length - 1 (piecewise-constant levels).
  function roleIntervalMean(times, values, query, width) {
    var t = toF64(times);
    var v = toF64(values);
    var q = toF64(query);
    var out = new Float64Array(q.length);
    var n = t.length;
    if (n < 2) return out;
    var cumulative = new Float64Array(n);
    var acc = 0.0;
    for (var i = 1; i < n; i++) {
      acc += v[i - 1] * (t[i] - t[i - 1]);
      cumulative[i] = acc;
    }
    var t0 = t[0];
    var tlast = t[n - 1];
    var total = cumulative[n - 1];
    var half = width / 2.0;
    for (var j = 0; j < q.length; j++) {
      var lo = q[j] - half;
      var hi = q[j] + half;
      var iLo, iHi, a, b;
      if (lo <= t0) a = 0.0;
      else if (lo >= tlast) a = total;
      else {
        iLo = upperBound(t, lo) - 1;
        if (iLo < 0) iLo = 0; else if (iLo > n - 2) iLo = n - 2;
        a = cumulative[iLo] + v[iLo] * (lo - t[iLo]);
      }
      if (hi <= t0) b = 0.0;
      else if (hi >= tlast) b = total;
      else {
        iHi = upperBound(t, hi) - 1;
        if (iHi < 0) iHi = 0; else if (iHi > n - 2) iHi = n - 2;
        b = cumulative[iHi] + v[iHi] * (hi - t[iHi]);
      }
      var r = (b - a) / width;
      out[j] = r > 0.0 ? r : 0.0;
    }
    return out;
  }

  // role.pulse_max(time, col, weight, query, radius) -> Float64Array(query.length)
  function rolePulseMax(time, col, weight, query, radius) {
    var t = toF64(time);
    var c = toI32(col);
    var w = toF64(weight);
    var q = toF64(query);
    var n = t.length;
    var out = new Float64Array(q.length);
    var acc = new Float64Array(7);
    var factorScale = 1000.0 / radius;
    for (var i = 0; i < q.length; i++) {
      for (var z = 0; z < 7; z++) acc[z] = 0.0;
      var qi = q[i];
      var lo = lowerBound(t, qi - radius);
      var hi = upperBound(t, qi + radius);
      for (var j = lo; j < hi; j++) {
        var delta = qi - t[j];
        if (Math.abs(delta) < radius) {
          var cs = Math.cos(Math.PI * delta / (2.0 * radius));
          acc[c[j]] += w[j] * factorScale * cs * cs;
        }
      }
      var mx = acc[0];
      for (var k = 1; k < 7; k++) if (acc[k] > mx) mx = acc[k];
      out[i] = mx;
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * actions.field (geometry.cumulative CDF of raised-cosine density)    *
   * ------------------------------------------------------------------ */

  // geometry.cumulative(t, budget, query, radius) -> Float64Array(query.length)
  function cumulative(t, budget, query, radius) {
    var n = t.length;
    var out = new Float64Array(query.length);
    if (n === 0) return out;
    var prefix = new Float64Array((n + 1) * 4);
    var origin = t[0];
    var omega = Math.PI / radius;
    for (var i = 0; i < n; i++) {
      var x = t[i] - origin;
      var phase = omega * x;
      var b0 = i * 4;
      var b1 = b0 + 4;
      var bi = budget[i];
      prefix[b1] = prefix[b0] + bi;
      prefix[b1 + 1] = prefix[b0 + 1] + bi * x;
      prefix[b1 + 2] = prefix[b0 + 2] + bi * Math.cos(phase);
      prefix[b1 + 3] = prefix[b0 + 3] + bi * Math.sin(phase);
    }
    var twoPi = 2.0 * Math.PI;
    var twoR = 2.0 * radius;
    for (var j = 0; j < query.length; j++) {
      var q = query[j];
      var lo = lowerBound(t, q - radius) * 4;
      var hi = upperBound(t, q + radius) * 4;
      var amount = prefix[hi] - prefix[lo];
      var first = prefix[hi + 1] - prefix[lo + 1];
      var co = prefix[hi + 2] - prefix[lo + 2];
      var si = prefix[hi + 3] - prefix[lo + 3];
      var ph = omega * (q - origin);
      out[j] = prefix[lo] + 0.5 * amount + ((q - origin) * amount - first) / twoR +
               (Math.sin(ph) * co - Math.cos(ph) * si) / twoPi;
    }
    return out;
  }

  // actions.mass(time, cost, start, end, radius) with (start, end) elementwise.
  function actionMass(time, cost, start, end, radius) {
    var m = start.length;
    var out = new Float64Array(m);
    if (time.length === 0) return out;
    var left = cumulative(time, cost, start, radius);
    var right = cumulative(time, cost, end, radius);
    for (var i = 0; i < m; i++) {
      var v = right[i] - left[i];
      out[i] = v > 0.0 ? v : 0.0;
    }
    return out;
  }

  // actions.field(time, cost, query, width, radius) — rate per second.
  function actionField(time, cost, query, width, radius) {
    if (!isFinite(width) || width <= 0) {
      throw new Error('Positive finite time window required.');
    }
    var m = query.length;
    var out = new Float64Array(m);
    if (time.length === 0) return out;
    var lo = new Float64Array(m);
    var hi = new Float64Array(m);
    var half = width / 2.0;
    for (var i = 0; i < m; i++) {
      lo[i] = query[i] - half;
      hi[i] = query[i] + half;
    }
    var mass = actionMass(time, cost, lo, hi, radius);
    var denom = width / 1000.0;
    for (var j = 0; j < m; j++) out[j] = mass[j] / denom;
    return out;
  }

  /* ------------------------------------------------------------------ *
   * hand.extract                                                        *
   * ------------------------------------------------------------------ */

  function extract(notes, scale) {
    if (scale === undefined) scale = 30.0;
    scale = +scale;
    if (!isFinite(scale) || scale <= 0.0) {
      throw new Error('Positive existing synchronization scale required.');
    }
    var time0 = toF64(notes.time);
    var col0 = toI32(notes.col);
    var n0 = time0.length;

    // np.unique(np.column_stack([time, col]), axis=0): lexicographic (time, col).
    var order = sortedPairsOrder(time0, col0);
    var timeTmp = new Float64Array(n0);
    var colTmp = new Int32Array(n0);
    var m = 0;
    for (var k = 0; k < n0; k++) {
      var cur = order[k];
      if (k > 0) {
        var prev = order[k - 1];
        if (time0[cur] === time0[prev] && col0[cur] === col0[prev]) continue;
      }
      timeTmp[m] = time0[cur];
      colTmp[m] = col0[cur];
      m += 1;
    }
    var time = timeTmp.slice(0, m);
    var col = colTmp.slice(0, m);

    var maps = [HAND_MAP0, HAND_MAP1];
    var profiles = [];
    for (var pi = 0; pi < 2; pi++) {
      var mp = maps[pi];
      var hands = new Int32Array(m);
      for (var i = 0; i < m; i++) hands[i] = mp[col[i]];
      var raw = rawEligibility(time, col, hands, scale);
      // hand.eligibility: clip lane to [0,1], eligible to [0, lane].
      var lane = raw.lane;
      var elig = raw.eligible;
      for (var i2 = 0; i2 < m; i2++) {
        var lv = lane[i2];
        if (lv < 0.0) lv = 0.0; else if (lv > 1.0) lv = 1.0;
        lane[i2] = lv;
        var ev = elig[i2];
        if (ev < 0.0) ev = 0.0; else if (ev > lv) ev = lv;
        elig[i2] = ev;
      }
      profiles.push({
        hand: hands,
        lane_mass: lane,
        eligible: elig,
        interval_visits: raw.visits
      });
    }

    var mom = moments(time, col, profiles[0].eligible, profiles[1].eligible, scale);
    for (var pj = 0; pj < 2; pj++) {
      var pr = profiles[pj];
      var mass = mom.mass[pj];
      var elig2 = pr.eligible;
      var hm = new Float64Array(m);
      for (var r = 0; r < m; r++) {
        var v = mass[r];
        if (v < 0.0) v = 0.0; else if (v > elig2[r]) v = elig2[r];
        hm[r] = v;
      }
      pr.hand_mass = hm;
      pr.coactive = mom.coactive[pj];
    }

    return {
      time: time,
      column: col,
      profiles: profiles,
      scale: scale,
      physical_heads: m,
      model: 'Fused normalized per-finger hand transfer; same bounded detector semantics.'
    };
  }

  /* ------------------------------------------------------------------ *
   * hand.field (fast path + general fallback)                           *
   * ------------------------------------------------------------------ */

  var SCOPE_FAST = 'Bitwise-identical reused physical-finger/profile projection; same detector prior and limitations.';
  var SCOPE_GENERAL = 'Additional rate of coherent repeated hand contacts above independent-finger repeats. Not wrist speed, difficulty/SR, or generic superset monotonicity.';

  function maxReduce(arrays, n) {
    if (arrays.length === 0) return new Float64Array(n);
    if (arrays.length === 1) {
      // np.maximum.reduce([x]) is the array itself; callers only read it.
      return arrays[0];
    }
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var mx = arrays[0][i];
      for (var a = 1; a < arrays.length; a++) if (arrays[a][i] > mx) mx = arrays[a][i];
      out[i] = mx;
    }
    return out;
  }

  function subClip(a, b) { // np.maximum(a-b, 0)
    var n = a.length;
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var v = a[i] - b[i];
      out[i] = v > 0.0 ? v : 0.0;
    }
    return out;
  }

  function maxPair(a, b) { // np.maximum(a, b)
    var n = a.length;
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) out[i] = a[i] > b[i] ? a[i] : b[i];
    return out;
  }

  function rmsOverProfiles(outputs, n) { // np.sqrt(np.mean(np.square(outputs), axis=0))
    var count = outputs.length;
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var s = 0.0;
      for (var p = 0; p < count; p++) s += outputs[p][i] * outputs[p][i];
      out[i] = Math.sqrt(s / count);
    }
    return out;
  }

  function generalField(data, query, width) {
    var t = data.time;
    var col = data.column;
    var scale = data.scale;
    var profiles = data.profiles;
    var outputs = [];
    var details = [];
    for (var pi = 0; pi < profiles.length; pi++) {
      var pr = profiles[pi];
      var extra = [];
      var states = [];
      for (var hand = 0; hand < 2; hand++) {
        var take = indicesEqual(pr.hand, hand);
        var h = actionField(pickF64(t, take), pickF64(pr.hand_mass, take), query, width, scale);
        var colsTake = uniqueInts(take.map(function (i) { return col[i]; }));
        var independent = [];
        for (var k = 0; k < colsTake.length; k++) {
          var laneIdx = indicesEqual(col, colsTake[k]);
          independent.push(actionField(pickF64(t, laneIdx), pickF64(pr.lane_mass, laneIdx), query, width, scale));
        }
        var own = maxReduce(independent, query.length);
        var increment = subClip(h, own);
        extra.push(increment);
        states.push({ hand_rate: h, independent_max: own, extra: increment });
      }
      outputs.push(maxPair(extra[0], extra[1]));
      details.push(states);
    }
    return { extra: rmsOverProfiles(outputs, query.length), profiles: details, scope: SCOPE_GENERAL };
  }

  function handField(data, query, width) {
    if (width === undefined) width = 1000.0;
    width = +width;
    var q = toF64(query);
    var t = data.time;
    var col = data.column;
    var scale = data.scale;
    var profiles = data.profiles;
    if (profiles.length === 0) {
      return { extra: new Float64Array(q.length), profiles: [], scope: SCOPE_FAST };
    }
    // Python fast path only when every profile shares profile[0].lane_mass.
    var fast = true;
    for (var pc = 1; pc < profiles.length; pc++) {
      if (!arrayEqualF64(profiles[pc].lane_mass, profiles[0].lane_mass)) { fast = false; break; }
    }
    if (!fast) return generalField(data, q, width);

    var uniqCols = uniqueInts(col);
    var lanes = {};
    for (var c = 0; c < uniqCols.length; c++) {
      var laneIdx = indicesEqual(col, uniqCols[c]);
      lanes[uniqCols[c]] = actionField(pickF64(t, laneIdx), pickF64(profiles[0].lane_mass, laneIdx), q, width, scale);
    }

    var previous = []; // [{profile, hands}]
    var outputs = [];
    var details = [];
    for (var pi = 0; pi < profiles.length; pi++) {
      var pr = profiles[pi];
      var reuse = null;
      for (var oi = 0; oi < previous.length; oi++) {
        var old = previous[oi];
        if (arrayEqualI32(pr.hand, old.profile.hand) &&
            arrayEqualF64(pr.hand_mass, old.profile.hand_mass)) {
          reuse = old.hands;
          break;
        }
      }
      var extra = [];
      var states = [];
      var hands = [];
      for (var hand = 0; hand < 2; hand++) {
        var take = indicesEqual(pr.hand, hand);
        var h = (reuse !== null) ? reuse[hand]
              : actionField(pickF64(t, take), pickF64(pr.hand_mass, take), q, width, scale);
        hands.push(h);
        var handCols = uniqueInts(take.map(function (i) { return col[i]; }));
        var independent = [];
        for (var hc = 0; hc < handCols.length; hc++) independent.push(lanes[handCols[hc]]);
        var own = maxReduce(independent, q.length);
        var increment = subClip(h, own);
        extra.push(increment);
        states.push({ hand_rate: h, independent_max: own, extra: increment });
      }
      previous.push({ profile: pr, hands: hands });
      outputs.push(maxPair(extra[0], extra[1]));
      details.push(states);
    }
    return { extra: rmsOverProfiles(outputs, q.length), profiles: details, scope: SCOPE_FAST };
  }

  /* ------------------------------------------------------------------ *
   * hand_cost.state / hand_cost.price                                    *
   * ------------------------------------------------------------------ */

  // hand_cost.state(rates) -> {finger_rate: [[p0h0,p0h1],[p1h0,p1h1]],
  //                            hand_rate:  [[p0h0,p0h1],[p1h0,p1h1]]}
  function handCostState(rates) {
    var profiles = rates.profiles;
    var finger = [];
    var hand = [];
    for (var pi = 0; pi < profiles.length; pi++) {
      var f = [];
      var h = [];
      for (var hi = 0; hi < profiles[pi].length; hi++) {
        f.push(profiles[pi][hi].independent_max);
        h.push(profiles[pi][hi].hand_rate);
      }
      finger.push(f);
      hand.push(h);
    }
    return { finger_rate: finger, hand_rate: hand };
  }

  // hand_cost.price(state, x, p, mode='extra_task') -> Float64Array(rows)
  function handCostPrice(state, x, p, mode) {
    if (mode === undefined || mode === null) mode = 'extra_task';
    if (mode !== 'extra_task' && mode !== 'marginal_total') {
      throw new Error('Choose extra_task or marginal_total.');
    }
    var xv;
    if (typeof x === 'number') xv = x;
    else if (x != null && typeof x.length === 'number') xv = +x[0];
    else xv = +x;
    var jc1 = p.j_c1, odm = p.od_mult_jm;
    if (!isFinite(xv) || !isFinite(+jc1) || !isFinite(+odm)) {
      throw new Error('handCostPrice requires finite x, p.j_c1 and p.od_mult_jm.');
    }
    var k = +jc1 * Math.pow(Math.max(Math.pow(xv, +odm), 1e-6), 0.25);
    var finger = state.finger_rate;
    var hand = state.hand_rate;
    var nprof = finger.length;
    var nrows = (nprof > 0 && finger[0].length > 0) ? finger[0][0].length : 0;
    var costs = [];
    for (var pi = 0; pi < nprof; pi++) {
      var per = new Float64Array(nrows);
      for (var r = 0; r < nrows; r++) {
        var c0, c1;
        if (mode === 'extra_task') {
          var d0 = hand[pi][0][r] - finger[pi][0][r];
          if (d0 < 0.0) d0 = 0.0;
          var d1 = hand[pi][1][r] - finger[pi][1][r];
          if (d1 < 0.0) d1 = 0.0;
          c0 = d0 * d0 / (1.0 + k * d0);
          c1 = d1 * d1 / (1.0 + k * d1);
        } else {
          var h0 = hand[pi][0][r], f0 = finger[pi][0][r];
          var h1 = hand[pi][1][r], f1 = finger[pi][1][r];
          c0 = h0 * h0 / (1.0 + k * h0) - f0 * f0 / (1.0 + k * f0);
          if (c0 < 0.0) c0 = 0.0;
          c1 = h1 * h1 / (1.0 + k * h1) - f1 * f1 / (1.0 + k * f1);
          if (c1 < 0.0) c1 = 0.0;
        }
        per[r] = c0 > c1 ? c0 : c1;
      }
      costs.push(per);
    }
    var out = new Float64Array(nrows);
    for (var row = 0; row < nrows; row++) {
      var s = 0.0;
      for (var pj = 0; pj < nprof; pj++) s += costs[pj][row] * costs[pj][row];
      out[row] = Math.sqrt(s / nprof);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * role.field                                                          *
   * ------------------------------------------------------------------ */

  function roleField(notes, p, query) {
    var q = toF64(query);
    var rawIsLn = toU8(prop(notes, 'isLn', 'is_ln'));
    var anyLn = false;
    for (var z = 0; z < rawIsLn.length; z++) if (rawIsLn[z]) { anyLn = true; break; }
    if (!anyLn) return new Float64Array(q.length);

    var nt = roleCanonical(notes);
    var time = nt.time;
    var col = nt.col;
    var width = +p.w_jm;
    if (!isFinite(width) || width <= 0.0) {
      throw new Error('roleField requires a positive finite p.w_jm.');
    }
    var n = time.length;
    var spans = roleEpisodes(nt);
    var duty = new Float64Array(n); // zeros

    for (var lane = 0; lane < 7; lane++) {
      var own = [];
      for (var s = 0; s < spans.length; s++) if (spans[s][0] === lane) own.push(spans[s]);
      if (own.length === 0) continue;
      var nh = own.length;
      var events = new Float64Array(2 * nh);
      var changes = new Float64Array(2 * nh);
      for (var a = 0; a < nh; a++) {
        events[a] = own[a][1];
        changes[a] = 1.0;
        events[nh + a] = own[a][2];
        changes[nh + a] = -1.0;
      }
      // np.argsort(events, kind='stable')
      var ord = new Array(2 * nh);
      for (var i = 0; i < 2 * nh; i++) ord[i] = i;
      ord.sort(function (x, y) {
        var d = events[x] - events[y];
        if (d !== 0) return d;
        return x - y;
      });
      var evSorted = new Float64Array(2 * nh);
      var chSorted = new Float64Array(2 * nh);
      for (var o = 0; o < 2 * nh; o++) {
        evSorted[o] = events[ord[o]];
        chSorted[o] = changes[ord[o]];
      }
      // np.unique(events, return_index=True) on the sorted sequence.
      var starts = [];
      var ix = [];
      for (var u = 0; u < 2 * nh; u++) {
        if (u === 0 || evSorted[u] !== evSorted[u - 1]) {
          starts.push(evSorted[u]);
          ix.push(u);
        }
      }
      // values = np.cumsum(np.add.reduceat(changes, ix))[:-1]
      var nStarts = starts.length;
      var values = new Float64Array(nStarts > 1 ? nStarts - 1 : 0);
      var acc = 0.0;
      for (var u2 = 0; u2 < nStarts; u2++) {
        var end = (u2 + 1 < nStarts) ? ix[u2 + 1] : chSorted.length;
        var sum = 0.0;
        for (var m = ix[u2]; m < end; m++) sum += chSorted[m];
        acc += sum;
        if (u2 < nStarts - 1) values[u2] = acc;
      }
      var startsArr = new Float64Array(nStarts);
      for (var st = 0; st < nStarts; st++) startsArr[st] = starts[st];
      var take = indicesEqual(col, lane);
      var tTake = pickF64(time, take);
      var qTake = new Float64Array(take.length);
      for (var tk = 0; tk < take.length; tk++) qTake[tk] = tTake[tk] - width / 2.0;
      var dutyTake = roleIntervalMean(startsArr, values, qTake, width);
      for (var d = 0; d < take.length; d++) duty[take[d]] = dutyTake[d];
    }

    for (var dd = 0; dd < n; dd++) {
      var dv = duty[dd];
      if (dv < 0.0) dv = 0.0; else if (dv > 1.0) dv = 1.0;
      duty[dd] = dv;
    }

    var defaultGap = width / 1000.0;
    var gap = new Float64Array(n);
    for (var g = 0; g < n; g++) gap[g] = defaultGap;
    for (var lane2 = 0; lane2 < 7; lane2++) {
      var idx2 = indicesEqual(col, lane2);
      var count2 = idx2.length;
      if (count2 < 2) continue;
      var garr = new Float64Array(count2 - 1);
      for (var gg = 0; gg < count2 - 1; gg++) {
        var dt = (time[idx2[gg + 1]] - time[idx2[gg]]) / 1000.0;
        garr[gg] = dt > 0.0001 ? dt : 0.0001;
      }
      for (var g2 = 0; g2 < count2 - 1; g2++) {
        var rowA = idx2[g2];
        var rowB = idx2[g2 + 1];
        var gv = garr[g2];
        if (gv < gap[rowA]) gap[rowA] = gv;
        if (gv < gap[rowB]) gap[rowB] = gv;
      }
    }

    var od = +nt.od;
    if (!isFinite(od)) throw new Error('roleField requires a finite notes.od (effective OD).');
    var qv = (64.5 - Math.ceil(3.0 * od)) / 500.0;
    var x = 0.3 * Math.sqrt(qv > 1e-6 ? qv : 1e-6);
    var precision = Math.min(x, 0.6 * (x - 0.09) + 0.09);
    if (!isFinite(+p.j_c1) || !isFinite(+p.od_mult_jm)) {
      throw new Error('roleField requires finite p.j_c1 and p.od_mult_jm.');
    }
    var k = +p.j_c1 * Math.pow(Math.max(Math.pow(precision, +p.od_mult_jm), 1e-6), 0.25);

    var weight = new Float64Array(n);
    for (var wr = 0; wr < n; wr++) {
      var dv2 = duty[wr];
      weight[wr] = (1.0 / (gap[wr] + k)) * dv2 * dv2;
    }
    return rolePulseMax(time, col, weight, q, width / 2.0);
  }

  /* ------------------------------------------------------------------ *
   * Export                                                              *
   * ------------------------------------------------------------------ */

  root.SPMExtHandRole = {
    roleCanonical: roleCanonical,
    handExtract: extract,
    handField: handField,
    handCostState: handCostState,
    handCostPrice: handCostPrice,
    roleField: roleField,
    roleEpisodes: roleEpisodes,
    roleIntervalMean: roleIntervalMean,
    rolePulseMax: rolePulseMax
  };
})();

/* geometry_recovery.js  --  SPM Rating v1.2.0-rc3 port (browser + Node, plain script)
 *
 * Faithful JS port of:
 *   SPMRating/spm_rating/geometry.py    (weights / atoms / cumulative / linear_wmean / window_curve)
 *   SPMRating/spm_rating/recovery.py    (mean_rate / ratio_area / roots / prepare / interval_mass / curve)
 *   SPMRating/spm_rating/coordinates.py (coordinate, optional)
 * plus the model helpers those modules need from _core/model.py
 *   _wmean_index      -> helpers.wmeanIndex      (provided by the core)
 *   _tri_window_count -> helpers.triWindowCount  (provided by the core)
 * and _core/batch.seg_cumsum -> helpers.segCumsum (provided by the core)
 *
 * No import/export/require.  Defines globalThis.SPMExtGeometry.
 *
 * Conventions
 * -----------
 * A single-chart JS struct s (see _dev/port/CONTRACT.md):
 *   s.t Float64Array(n)     row times, ms (sorted)
 *   s.chart Int32Array(n)   all zeros in the single-chart case
 *   s.mask Int32Array(n)    7-bit per-row key mask
 *   s.size Int32Array(n)
 *   s.starts Int32Array([0, n])
 *   s.n number
 *   s.dtDiff Float64Array(n) ms gap to the next row (0 on the last row)
 *   s.b object               flat batch (accepted but unused here)
 * Optional, only used by coordinate(): s.tg (global ms; tg === t for chart 0),
 *   s.colPos[7] (per-column row positions as produced by buildBatch) or
 *   s.col_chain[7] ({pos}) or s.b.colPos.
 *
 * helpers = { wmean(s,val,W), wmeanIndex(s,W), triWindowCount(s,val,tau),
 *             segCumsum(x,starts), EPS }
 *   wmeanIndex must return the Python tuple (jhi, dhi, jlo, dlo): either a
 *   length-4 array/typed array or an object with those four keys.  jhi/jlo are
 *   row indices, dhi/dlo are ms offsets from that row's time.
 *   triWindowCount returns a length-n array of triangular-window counts.
 *   segCumsum returns the segment-restarted cumulative sum of x.
 *   Only wmeanIndex / segCumsum / triWindowCount are used here (wmean is not).
 *
 * Numeric policy: every expression mirrors the Python operand order, so results
 * are bit-identical to (or within a few ULP of) the float64 reference.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- constants */
  var SYNC = 30.0;      /* geometry.SYNC   ms */
  var MEMORY = 180.0;   /* geometry.MEMORY ms */
  var NULL_ATOM = 0.1;  /* geometry.NULL  */
  var RADIUS = 500.0;   /* geometry.RADIUS ms */

  /* ------------------------------------------------------------ small helpers */
  function zeros(n) {
    return new Float64Array(n);
  }

  function toF64(x) {
    var out = new Float64Array(x.length);
    for (var i = 0; i < x.length; i++) out[i] = x[i];
    return out;
  }

  function concatF64(chunks) {
    var total = 0, i, j;
    for (i = 0; i < chunks.length; i++) total += chunks[i].length;
    var out = new Float64Array(total);
    var at = 0;
    for (i = 0; i < chunks.length; i++) {
      var c = chunks[i];
      for (j = 0; j < c.length; j++) out[at + j] = c[j];
      at += c.length;
    }
    return out;
  }

  function sortedCopy(a) {
    var out = toF64(a);
    out.sort();               /* TypedArray sort is numeric ascending; NaN last */
    return out;
  }

  /* numpy.unique for a float array: sort then drop equal neighbours. */
  function uniqueSorted(a) {
    var s = sortedCopy(a);
    if (s.length === 0) return s;
    var out = new Float64Array(s.length);
    var m = 0;
    out[m++] = s[0];
    for (var i = 1; i < s.length; i++) {
      if (s[i] !== out[m - 1]) out[m++] = s[i];   /* NaN !== NaN, -0 === 0 : numpy match */
    }
    return out.subarray(0, m);
  }

  /* np.searchsorted(a, v, side='left'): first index with a[i] >= v. */
  function lowerBound(a, v) {
    var lo = 0, hi = a.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (a[mid] < v) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  /* np.searchsorted(a, v, side='right'): first index with a[i] > v. */
  function upperBound(a, v) {
    var lo = 0, hi = a.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (a[mid] <= v) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function getDtDiff(s) {
    var d = s.dtDiff !== undefined && s.dtDiff !== null ? s.dtDiff : s.dt_diff;
    if (d === undefined || d === null) throw new Error('SPMExtGeometry: struct has no dtDiff.');
    return d;
  }

  function getStarts(s) {
    if (s.starts !== undefined && s.starts !== null) return s.starts;
    return Int32Array.from([0, s.n]);
  }

  function getN(s) {
    if (s.n !== undefined && s.n !== null) return s.n | 0;
    return s.t.length;
  }

  function getT(s) {
    return s.t;
  }

  function wmeanOperator(helpers, s, width) {
    var op = helpers.wmeanIndex(s, width);
    if (op === null || op === undefined) throw new Error('SPMExtGeometry: helpers.wmeanIndex returned null.');
    if (typeof op.length === 'number' && op.length >= 4) {
      return { jhi: op[0], dhi: op[1], jlo: op[2], dlo: op[3] };
    }
    if (op.jhi !== undefined) {
      return { jhi: op.jhi, dhi: op.dhi, jlo: op.jlo, dlo: op.dlo };
    }
    throw new Error("SPMExtGeometry: unrecognised helpers.wmeanIndex result (expected [jhi,dhi,jlo,dlo] or {jhi,dhi,jlo,dlo}).");
  }

  function sumRange(a, lo, hi) {
    var acc = 0.0;
    for (var i = lo; i < hi; i++) acc += a[i];
    return acc;
  }

  /* ========================================================================
   * geometry.weights  ->  (7,7) row-major, value = w - 1
   * ===================================================================== */
  var HAND = [0, 0, 0, 1, 2, 2, 2];

  function geometryWeights(p) {
    var xjdP = p.x_jd_p, xjdE = p.x_jd_e;
    var xjhP = p.x_jh_p, xjhE = p.x_jh_e;
    var xjt = p.x_jt, dirIn = p.x_dir_in, dirOut = p.x_dir_out;
    var w = new Float64Array(49);
    for (var i = 0; i < 7; i++) {           /* origin */
      for (var j = 0; j < 7; j++) {         /* target */
        var d = Math.abs(i - j);
        var hi = HAND[i], hj = HAND[j];
        var same = (hi === hj) && (hi !== 1);
        var thumb = (hi === 1) || (hj === 1);
        var cross = (hi !== hj) && !thumb;
        var v = 1.0 + xjdP * Math.pow(Math.max(d, 1e-9), xjdE);
        if (same && d > 0) {
          v = 1.0 + xjhP * Math.pow(Math.max(d, 1e-9), -xjhE);
        }
        if (thumb) {
          v = 1.0 - xjt / Math.max(d, 1.0);
        }
        if (cross) {
          v = 1.0 - xjhP * Math.min(d / 7.0, 1.0);
        }
        var inward = Math.abs(j - 3) < Math.abs(i - 3) ? 1.0 : 0.0;
        v *= 1.0 + dirIn * inward + dirOut * (1.0 - inward);
        w[i * 7 + j] = v - 1.0;
      }
    }
    return w;
  }

  /* ========================================================================
   * geometry.atoms  ->  (n, 49) signed adjacency budgets
   * b is accepted for interface symmetry (Python caches on the batch); this
   * port neither mutates b nor caches.
   * ===================================================================== */
  function geometryBudgets(b, s, helpers) {
    var n = getN(s);
    var t = getT(s);
    var chart = s.chart;
    var mask = s.mask;
    var out = new Float64Array(n * 49);
    if (n === 0) return out;

    /* coactivation[row*7+k] = tri_window_count(mask bit k, SYNC) */
    var co = new Float64Array(n * 7);
    var bits = new Float64Array(n);
    var r, k, i;
    for (k = 0; k < 7; k++) {
      for (r = 0; r < n; r++) bits[r] = (mask[r] >> k) & 1;
      var col = helpers.triWindowCount(s, bits, SYNC);
      for (r = 0; r < n; r++) co[r * 7 + k] = col[r];
    }

    var a = new Float64Array(14);      /* [channel*7 + key] */
    var bAcc = new Float64Array(14);
    var c = new Float64Array(14);
    var source = new Float64Array(14);
    var occupancy = new Float64Array(7);
    var low = new Float64Array(7);
    var high = new Float64Array(7);

    for (var row = 0; row < n; row++) {
      var dt;
      if (row === 0 || chart[row] !== chart[row - 1]) {
        for (i = 0; i < 14; i++) { a[i] = 0.0; bAcc[i] = 0.0; c[i] = 0.0; }
        dt = 0.0;
      } else {
        dt = t[row] - t[row - 1];
      }
      var decA = Math.exp(-2 * dt / MEMORY);
      var decB = Math.exp(-dt * (1 / MEMORY + 1 / SYNC));
      var decC = Math.exp(-2 * dt / SYNC);
      for (i = 0; i < 14; i++) {
        a[i] *= decA;
        bAcc[i] *= decB;
        c[i] *= decC;
      }
      for (i = 0; i < 14; i++) {
        var sv = a[i] - 2 * bAcc[i] + c[i];
        source[i] = sv > 0.0 ? sv : 0.0;      /* np.maximum(..., 0) */
      }
      var norm0 = NULL_ATOM + sumRange(source, 0, 7);
      var norm1 = NULL_ATOM + sumRange(source, 7, 14);

      var coBase = row * 7;
      for (k = 0; k < 7; k++) {
        var cv = co[coBase + k];
        occupancy[k] = cv > 0.0 ? (cv > 1.0 ? 1.0 : cv) : 0.0;  /* clip(occ, 0, 1) */
      }
      var supportSum = sumRange(co, coBase, coBase + 7);
      var support = supportSum > 1.0 ? supportSum : 1.0;

      low[0] = 1.0;
      for (k = 1; k < 7; k++) low[k] = low[k - 1] * (1.0 - occupancy[k - 1]);
      high[6] = 1.0;
      for (k = 5; k >= 0; k--) high[k] = high[k + 1] * (1.0 - occupancy[k + 1]);

      var m = mask[row];
      var outBase = row * 49;
      for (var target = 0; target < 7; target++) {
        if (!(m & (1 << target))) continue;
        for (var origin = 0; origin < 7; origin++) {
          var internal = 0.0;
          if (origin !== target) {
            var absent = 1.0;
            var klo = Math.min(origin, target) + 1;
            var khi = Math.max(origin, target);
            for (k = klo; k < khi; k++) absent *= 1.0 - occupancy[k];
            internal = occupancy[origin] * absent;
          }
          var incoming = low[target] * source[origin] / norm0 +
                         high[target] * source[7 + origin] / norm1;
          out[outBase + origin * 7 + target] = 0.5 * (internal + incoming) / support;
        }
      }

      for (k = 0; k < 7; k++) {
        if (m & (1 << k)) {
          a[k] += high[k];
          bAcc[k] += high[k];
          c[k] += high[k];
          a[7 + k] += low[k];
          bAcc[7 + k] += low[k];
          c[7 + k] += low[k];
        }
      }
    }
    return out;
  }

  /* ========================================================================
   * geometry.cumulative  --  CDF of the raised-cosine density
   * ===================================================================== */
  function geometryCumulative(t, signedBudget, query, radius) {
    var n = t.length;
    var m = query.length;
    var out = new Float64Array(m);
    if (n === 0) return out;
    var origin = t[0];
    var omega = Math.PI / radius;
    var prefix = new Float64Array((n + 1) * 4);
    var i, j, base, nb;
    for (i = 0; i < n; i++) {
      var x = t[i] - origin;
      var phase = omega * x;
      base = i * 4;
      nb = base + 4;
      var bu = signedBudget[i];
      prefix[nb] = prefix[base] + bu;
      prefix[nb + 1] = prefix[base + 1] + bu * x;
      prefix[nb + 2] = prefix[base + 2] + bu * Math.cos(phase);
      prefix[nb + 3] = prefix[base + 3] + bu * Math.sin(phase);
    }
    var twoR = 2 * radius;
    var twoPi = 2 * Math.PI;
    for (j = 0; j < m; j++) {
      var q = query[j];
      var lo = lowerBound(t, q - radius);
      var hi = upperBound(t, q + radius);
      var amount = prefix[hi * 4] - prefix[lo * 4];
      var first = prefix[hi * 4 + 1] - prefix[lo * 4 + 1];
      var co = prefix[hi * 4 + 2] - prefix[lo * 4 + 2];
      var si = prefix[hi * 4 + 3] - prefix[lo * 4 + 3];
      var qphase = omega * (q - origin);
      out[j] = prefix[lo * 4] + 0.5 * amount +
               ((q - origin) * amount - first) / twoR +
               (Math.sin(qphase) * co - Math.cos(qphase) * si) / twoPi;
    }
    return out;
  }

  /* ========================================================================
   * geometry.linear_wmean  --  same step integral as _wmean, without the clamp
   * ===================================================================== */
  function linearWmean(s, val, width, helpers) {
    var n = getN(s);
    var dtDiff = getDtDiff(s);
    var starts = getStarts(s);
    var inc = new Float64Array(n);
    var i;
    for (i = 0; i < n - 1; i++) inc[i] = val[i] * dtDiff[i];
    var cum = helpers.segCumsum(inc, starts);     /* seg_cumsum(inc) */
    var op = wmeanOperator(helpers, s, width);
    var jhi = op.jhi, dhi = op.dhi, jlo = op.jlo, dlo = op.dlo;
    var out = new Float64Array(n);
    for (i = 0; i < n; i++) {
      var hi = jhi[i], lo = jlo[i];
      var integralHi = cum[hi] - inc[hi];         /* integral = seg_cumsum - inc */
      var integralLo = cum[lo] - inc[lo];
      out[i] = (integralHi + val[hi] * dhi[i] - (integralLo + val[lo] * dlo[i])) / width;
    }
    return out;
  }

  /* ========================================================================
   * geometry.window_curve
   * ===================================================================== */
  function geometryWindowCurve(b, s, p, helpers) {
    var n = getN(s);
    var t = getT(s);
    var starts = getStarts(s);
    var width = +p.w_x;

    var w = geometryWeights(p);
    var atoms = geometryBudgets(b, s, helpers);

    var signed = new Float64Array(n);
    var r, k;
    for (r = 0; r < n; r++) {
      var base = r * 49;
      var acc = 0.0;
      for (k = 0; k < 49; k++) acc += atoms[base + k] * w[k];
      signed[r] = acc;
    }

    var out = new Float64Array(n);
    var nSeg = starts.length - 1;
    var half = width / 2;
    var divisor = width / 1000.0;
    for (var seg = 0; seg < nSeg; seg++) {
      var a0 = starts[seg] | 0;
      var z0 = starts[seg + 1] | 0;
      var m = z0 - a0;
      if (m <= 0) continue;
      var tSeg = t.subarray(a0, z0);
      var bSeg = signed.subarray(a0, z0);
      var tLo = tSeg[0];
      var tHi = tSeg[m - 1];
      var qlo = new Float64Array(m);
      var qhi = new Float64Array(m);
      for (r = 0; r < m; r++) {
        var lo = tSeg[r] - half; if (lo < tLo) lo = tLo;
        var hi = tSeg[r] + half; if (hi > tHi) hi = tHi;
        qlo[r] = lo;
        qhi[r] = hi;
      }
      var chi = geometryCumulative(tSeg, bSeg, qhi, RADIUS);
      var clo = geometryCumulative(tSeg, bSeg, qlo, RADIUS);
      for (r = 0; r < m; r++) out[a0 + r] = (chi[r] - clo[r]) / divisor;
    }
    return out;
  }

  /* ========================================================================
   * recovery.py
   * ===================================================================== */

  /* recovery.mean_rate */
  function recoveryMeanRate(heads, query, width) {
    var h = sortedCopy(heads);
    var q = toF64(query);
    if (width <= 0 || !isFinite(width)) throw new Error('Positive mean width required.');
    var nq = q.length;
    if (h.length === 0) return zeros(nq);
    var origin = h[0];
    var i, m = h.length;
    for (i = 0; i < m; i++) h[i] -= origin;
    for (i = 0; i < nq; i++) q[i] -= origin;
    var prefix = new Float64Array(m + 1);
    for (i = 0; i < m; i++) prefix[i + 1] = prefix[i] + h[i];

    var outer = (1000.0 + width) / 2.0;
    var inner = Math.abs(1000.0 - width) / 2.0;
    var plateau = Math.min(1000.0, width) / width;
    var out = new Float64Array(nq);
    for (i = 0; i < nq; i++) {
      var qi = q[i];
      var lo = lowerBound(h, qi - outer);
      var a = lowerBound(h, qi - inner);
      var bb = upperBound(h, qi + inner);
      var hi = upperBound(h, qi + outer);
      var left = (prefix[a] - prefix[lo]) - (a - lo) * (qi - outer);
      var right = (hi - bb) * (qi + outer) - (prefix[hi] - prefix[bb]);
      var v = (bb - a) * plateau + (left + right) / width;
      out[i] = v > 0.0 ? v : 0.0;
    }
    return out;
  }

  /* recovery.ratio_area: integral of positive linear / positive linear */
  function recoveryRatioArea(a0, a1, b0, b1, length) {
    var m = a0.length;
    var out = new Float64Array(m);
    for (var i = 0; i < m; i++) {
      var A0 = a0[i], A1 = a1[i], B0 = b0[i], B1 = b1[i], L = length[i];
      var d = (B1 - B0) / B0;
      var w0, w1;
      if (Math.abs(d) < 1e-4) {
        var z = -d;
        var u0 = 0.0, u1 = 0.0, power = 1.0;
        for (var k = 0; k < 7; k++) {
          u0 += power / ((k + 1.0) * (k + 2.0));
          u1 += power / (k + 2.0);
          power *= z;
        }
        w0 = u0;
        w1 = u1;
      } else {
        var log = Math.log1p(d);
        w0 = ((1.0 + d) * log - d) / (d * d);
        w1 = (d - log) / (d * d);
      }
      var num = Math.max(A0, 0.0) * Math.max(w0, 0.0) + Math.max(A1, 0.0) * Math.max(w1, 0.0);
      var v = L * num / B0;
      out[i] = v > 0.0 ? v : (v === v ? 0.0 : NaN);   /* np.maximum(v, 0) */
    }
    return out;
  }

  /* recovery.roots: linear interpolation of strict sign changes */
  function recoveryRoots(time, y) {
    var n = time.length;
    var vals = [];
    for (var i = 0; i < n - 1; i++) {
      var y0 = y[i], y1 = y[i + 1];
      var up = (y0 < 0.0 && y1 > 0.0);
      var down = (y0 > 0.0 && y1 < 0.0);
      if (up || down) vals.push(time[i] - y0 * (time[i + 1] - time[i]) / (y1 - y0));
    }
    return Float64Array.from(vals);
  }

  function allFinite(a) {
    for (var i = 0; i < a.length; i++) if (!isFinite(a[i])) return false;
    return true;
  }

  function maxFloor(values, floor) {
    var out = new Float64Array(values.length);
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      out[i] = v > floor ? v : floor;
    }
    return out;
  }

  function subArray(a, lo, hi) {
    var out = new Float64Array(hi - lo);
    for (var i = lo; i < hi; i++) out[i - lo] = a[i];
    return out;
  }

  function diffArray(a) {
    var n = a.length;
    var out = new Float64Array(n > 0 ? n - 1 : 0);
    for (var i = 0; i < n - 1; i++) out[i] = a[i + 1] - a[i];
    return out;
  }

  /* recovery.prepare */
  function recoveryPrepare(heads, shortWidth, longWidth, floor) {
    if (floor === undefined || floor === null) floor = 1e-6;
    var h = sortedCopy(heads);
    var w = Math.max(+shortWidth, 50.0);
    var wl = Math.max(+longWidth, 1000.0);
    if (h.length === 0 || !allFinite(h) || !isFinite(w) || !isFinite(wl)) {
      throw new Error('Finite nonempty heads and widths required.');
    }
    var unique = uniqueSorted(h);
    var widths = [w, wl];
    var knots = [];
    for (var wi = 0; wi < 2; wi++) {
      var width = widths[wi];
      var A = (1000.0 + width) / 2.0;
      var B = Math.abs(1000.0 - width) / 2.0;
      var shifts = [-A, -B, B, A];
      for (var si = 0; si < 4; si++) {
        var shift = shifts[si];
        var part = new Float64Array(unique.length);
        for (var i = 0; i < unique.length; i++) part[i] = unique[i] + shift;
        knots.push(part);
      }
    }
    var t = uniqueSorted(concatF64(knots));
    var l = recoveryMeanRate(h, t, wl);
    var lMinusFloor = new Float64Array(l.length);
    for (i = 0; i < l.length; i++) lMinusFloor[i] = l[i] - floor;
    t = uniqueSorted(concatF64([t, recoveryRoots(t, lMinusFloor)]));

    var s = recoveryMeanRate(h, t, w);
    l = recoveryMeanRate(h, t, wl);
    var lf = maxFloor(l, floor);
    var sMinusL = new Float64Array(s.length);
    for (i = 0; i < s.length; i++) sMinusL[i] = s[i] - lf[i];
    t = uniqueSorted(concatF64([t, recoveryRoots(t, sMinusL)]));

    s = recoveryMeanRate(h, t, w);
    l = maxFloor(recoveryMeanRate(h, t, wl), floor);
    var a = new Float64Array(s.length);
    for (i = 0; i < s.length; i++) {
      var d = s[i] - l[i];
      a[i] = d > 0.0 ? d : 0.0;                 /* np.maximum(s - l, 0) */
    }
    var nKnot = t.length;
    var area = recoveryRatioArea(
      subArray(a, 0, nKnot - 1), subArray(a, 1, nKnot),
      subArray(l, 0, nKnot - 1), subArray(l, 1, nKnot),
      diffArray(t)
    );
    var prefix = new Float64Array(nKnot);
    for (i = 0; i < area.length; i++) prefix[i + 1] = prefix[i] + area[i];

    return {
      time: t,
      numerator: a,
      denominator: l,
      prefix: prefix,
      width: w,
      long_width: wl
    };
  }

  /* recovery.integral */
  function recoveryIntegral(model, query) {
    var q = toF64(query);
    var t = model.time;
    var n = t.length;
    var a = model.numerator, b = model.denominator, prefix = model.prefix;
    var out = new Float64Array(q.length);
    for (var k = 0; k < q.length; k++) {
      var qk = q[k];
      var i = upperBound(t, qk) - 1;
      var before = i < 0;
      var after = i >= n - 1;
      if (i < 0) i = 0;
      if (i > n - 2) i = n - 2;
      var span = t[i + 1] - t[i];
      var length = qk - t[i];
      if (length < 0.0) length = 0.0;
      if (length > span) length = span;
      var fraction = length / span;
      var aq = a[i] + fraction * (a[i + 1] - a[i]);
      var bq = b[i] + fraction * (b[i + 1] - b[i]);
      var value = prefix[i] + recoveryRatioArea(
        Float64Array.of(a[i]), Float64Array.of(aq),
        Float64Array.of(b[i]), Float64Array.of(bq),
        Float64Array.of(length))[0];
      if (before) out[k] = 0.0;
      else if (after) out[k] = prefix[n - 1];
      else out[k] = value;
    }
    return out;
  }

  /* recovery.interval_mass */
  function recoveryIntervalMass(model, start, end) {
    var m = start.length;
    var t = model.time;
    var nt = t.length;
    var num = model.numerator, den = model.denominator, prefix = model.prefix;
    var t0 = t[0], tLast = t[nt - 1];

    var lo = new Float64Array(m), hi = new Float64Array(m);
    var iIdx = new Int32Array(m), jIdx = new Int32Array(m);
    var k;
    for (k = 0; k < m; k++) {
      var lv = start[k]; if (lv < t0) lv = t0;
      var hv = end[k]; if (hv > tLast) hv = tLast;
      lo[k] = lv;
      hi[k] = hv;
      var ii = upperBound(t, lv) - 1;
      if (ii < 0) ii = 0;
      if (ii > nt - 2) ii = nt - 2;
      var jj = upperBound(t, hv) - 1;
      if (jj < 0) jj = 0;
      if (jj > nt - 2) jj = nt - 2;
      iIdx[k] = ii;
      jIdx[k] = jj;
    }

    var al = new Float64Array(m), bl = new Float64Array(m);
    var ah = new Float64Array(m), bh = new Float64Array(m);
    for (k = 0; k < m; k++) {
      var i1 = iIdx[k], i2 = i1 + 1;
      var f = (lo[k] - t[i1]) / (t[i2] - t[i1]);
      if (f < 0.0) f = 0.0; else if (f > 1.0) f = 1.0;
      al[k] = (1.0 - f) * num[i1] + f * num[i2];
      bl[k] = (1.0 - f) * den[i1] + f * den[i2];
      var j1 = jIdx[k], j2 = j1 + 1;
      var g = (hi[k] - t[j1]) / (t[j2] - t[j1]);
      if (g < 0.0) g = 0.0; else if (g > 1.0) g = 1.0;
      ah[k] = (1.0 - g) * num[j1] + g * num[j2];
      bh[k] = (1.0 - g) * den[j1] + g * den[j2];
    }

    var oneLen = new Float64Array(m), leftLen = new Float64Array(m), rightLen = new Float64Array(m);
    var leftA1 = new Float64Array(m), leftB1 = new Float64Array(m);
    var rightA0 = new Float64Array(m), rightB0 = new Float64Array(m);
    for (k = 0; k < m; k++) {
      var span = hi[k] - lo[k];
      oneLen[k] = span > 0.0 ? span : 0.0;
      var ll = t[iIdx[k] + 1] - lo[k];
      leftLen[k] = ll > 0.0 ? ll : 0.0;
      var rl = hi[k] - t[jIdx[k]];
      rightLen[k] = rl > 0.0 ? rl : 0.0;
      leftA1[k] = num[iIdx[k] + 1];
      leftB1[k] = den[iIdx[k] + 1];
      rightA0[k] = num[jIdx[k]];
      rightB0[k] = den[jIdx[k]];
    }

    var one = recoveryRatioArea(al, ah, bl, bh, oneLen);
    var left = recoveryRatioArea(al, leftA1, bl, leftB1, leftLen);
    var right = recoveryRatioArea(rightA0, ah, rightB0, bh, rightLen);

    var out = new Float64Array(m);
    for (k = 0; k < m; k++) {
      if (hi[k] <= lo[k]) { out[k] = 0.0; continue; }   /* empty */
      if (iIdx[k] === jIdx[k]) { out[k] = one[k]; continue; }
      var gap = prefix[jIdx[k]] - prefix[iIdx[k] + 1];
      if (gap < 0.0) gap = 0.0;
      out[k] = left[k] + gap + right[k];
    }
    return out;
  }

  /* recovery.curve */
  function recoveryCurve(heads, query, shortWidth, longWidth) {
    var q = toF64(query);
    var model = recoveryPrepare(heads, shortWidth, longWidth);
    var w = model.width;
    var m = q.length;
    var start = new Float64Array(m), end = new Float64Array(m);
    for (var i = 0; i < m; i++) {
      start[i] = q[i] - w / 2.0;
      end[i] = q[i] + w / 2.0;
    }
    var mass = recoveryIntervalMass(model, start, end);
    var out = new Float64Array(m);
    for (i = 0; i < m; i++) {
      var v = mass[i] / w;
      if (v < -1e-10) throw new Error('Positive recovery mass invariant violated.');
      out[i] = v > 0.0 ? v : (v === v ? 0.0 : NaN);   /* np.maximum(out, 0) */
    }
    return out;
  }

  /* ========================================================================
   * coordinates.coordinate  (optional; needs s.tg + s.colPos/s.col_chain)
   * ===================================================================== */
  function columnRowPositions(s, col) {
    if (s.colPos && s.colPos[col] !== undefined) return s.colPos[col];
    if (s.col_chain && s.col_chain[col] !== undefined) {
      var c = s.col_chain[col];
      if (c && c.pos !== undefined) return c.pos;
      return c;
    }
    if (s.b && s.b.colPos && s.b.colPos[col] !== undefined) return s.b.colPos[col];
    return null;
  }

  function coordinate(s, bd, pos, tau) {
    var n = pos.length;
    var out = new Float64Array(n);
    var i;
    if (!(bd > 0 && bd < 7)) {
      var fill = Math.min(Math.max(bd, 0), 6);
      for (i = 0; i < n; i++) out[i] = fill;
      return out;
    }
    var tg = s.tg !== undefined && s.tg !== null ? s.tg : s.t;
    var weights = [];
    for (var slot = 0; slot < 2; slot++) {
      var col = slot === 0 ? bd - 1 : bd;
      var rows = columnRowPositions(s, col);
      var wt = new Float64Array(n);
      if (rows !== null && rows.length) {
        var times = new Float64Array(rows.length);
        for (i = 0; i < rows.length; i++) times[i] = tg[rows[i]];
        for (i = 0; i < n; i++) {
          var q = tg[pos[i]];
          var hi = lowerBound(times, q);
          if (hi > times.length - 1) hi = times.length - 1;
          var lo = hi - 1; if (lo < 0) lo = 0;
          var d1 = Math.abs(q - times[hi]);
          var d0 = Math.abs(q - times[lo]);
          var d = d1 < d0 ? d1 : d0;
          var u = d / tau; if (u < 0.0) u = 0.0; else if (u > 1.0) u = 1.0;
          var c = Math.cos(Math.PI * u / 2.0);
          wt[i] = c * c;
        }
      }
      weights.push(wt);
    }
    var left = weights[0], right = weights[1];
    for (i = 0; i < n; i++) {
      var den = left[i] + right[i];
      if (!(den > 1e-12)) den = 1e-12;
      out[i] = ((bd - 1) * left[i] + bd * right[i]) / den;
    }
    return out;
  }

  /* ---------------------------------------------------------------- exports */
  global.SPMExtGeometry = {
    /* contract API */
    geometryWeights: geometryWeights,
    geometryBudgets: geometryBudgets,
    geometryCumulative: geometryCumulative,
    linearWmean: linearWmean,
    geometryWindowCurve: geometryWindowCurve,
    recoveryCurve: recoveryCurve,
    coordinate: coordinate,
    /* recovery primitives, exported for reuse/debugging */
    recoveryMeanRate: recoveryMeanRate,
    recoveryRatioArea: recoveryRatioArea,
    recoveryRoots: recoveryRoots,
    recoveryPrepare: recoveryPrepare,
    recoveryIntegral: recoveryIntegral,
    recoveryIntervalMass: recoveryIntervalMass,
    /* constants (geometry.py) */
    SYNC: SYNC,
    MEMORY: MEMORY,
    NULL_ATOM: NULL_ATOM,
    RADIUS: RADIUS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ============================================================
// Exports (browser global)
// ============================================================
var SPMEngine = {
    SPM_V1_PARAMS, SPM_V120_PARAMS, SPM_V120_MODEL,
    SPM_V120_COMPACT_PARAMS, SPM_V120_COMPACT_MODEL, SPM_MODEL_VARIANTS,
    modelVariant, makeParams,
    parseOsu, buildBatch, buildStruct, computeCurves, combine,
    aggregatePow, postprocess, evaluateChart, displayCurves,
    computeSectionData, processMap,
    loadDanConstants, srToDanLevel, danLevelToLabel, interpDan,
    danNameForLevel, danTableFor, setDanVariant,
    // v1.0.1
    CURVE_SIGMA_PX, CURVE_INNER_W, CURVE_FILL_RUN_MAX, CURVE_MAX_PASSES,
    CURVE_SMOOTH_MODE,
    curveSigmaBuckets, fillShortZeroRuns, smoothCurve,
    computeSegmentStats, parseOsuMeta, displayCurvesRC,
};
if (typeof window !== "undefined") window.SPMEngine = SPMEngine;
