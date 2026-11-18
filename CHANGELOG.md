# Version history

## v1.2.5

- Minimal groups larger live BPM, tag and segment dan beside the map ranks; narrow widths stack the groups. Stars remain in the full layouts.
- Display defaults: Dan first, Aurora, Signs (-/+), Medium smoothing (previous Light). Existing saved choices are retained.
- Low profile keeps the graph and timeline for short OBS slots. Very short sources fit by proportionally scaling the panel after reflow, instead of clipping.
- Narrow panels no longer force a 380 px minimum. Summary facts, hover coordinates and paused canvas resizing follow the viewport.

## v1.2.4

- Vendor classifier `d2bbb90`: type-conditional action BPM with unsupported periods omitted, plus meter-aware pre-classification cuts on stable 7K.
- Preserve ratings, dans, frontend cadence whitelist and tag/percentage presentation; no expert refit or extra rating pass.
- Bump the cache/model identity to clear obsolete analysis at startup; verify both models, NM/HT/DT and 4K/6K/7K.

## v1.2.3

- Refreshed flat frontend with paired RC/LN cards, live tag highlighting, curve hover previews and an optional **UI Animations** switch (on by default).
- Removed the graph legend and peak readout; live sections show tempo first, then tag and confidence, without dot / BPM / CONF labels.
- Unified cadence visibility across the live row and timeline: Dense/Fast Chordstream, native 4K/6K Chordstream, Chordjack/Minijack/native Jack, Speed, Density and Coordination only.
- Idle/paused/hidden/Minimal views stop requesting animation frames. Curve morphs reuse buffers; palette/dan-label changes do not rerun smoothing or analysis.
- Rating/classifier engines and cache format are unchanged. The version bump invalidates the previous version's cache at startup.

## v1.2.2
- Add default-on, gzip-compressed local disk analysis caching with edit detection, version/config invalidation, bounded LRU storage and a settings switch
- Restore complete rating/tag/curve UI without rerunning either engine, including the selected model's dan table; reject stale/wrong-map responses
- Keep the SPM Rating and pinned `b311c40` classifier algorithms unchanged

## v1.2.1
- Update to classifier `b311c40`: reuse the existing raw SPM demand before soft Break gates, preserving sustained-pressure sections without another rating pass; keep unrated and native 4K/6K behavior unchanged
- Expose native 4K/6K five-class tags, weighted composition percentages, live sections and timeline; remove the tag row's fixed 440px cap and clarify main-tag gating in tooltips
- Remove the “Burden” prefix; normalize the Hybrid chip’s RC/LN pair to 100% while retaining its relative proportion and leaving algorithm outputs unchanged
- Follow-up: fix nested/space settings paths and late tosu `COUNTER_PATH` injection; show settings failures and the active rating model instead of silently comparing default Detailed against saved Compact
- Bundle the complete classifier from **SPMTagClassifier `b311c40`** (`b311c408ef02d6705d30b51a4ea789d3e86d2976`, package 1.2.4 plus unreleased local-expert retune and pressure-aware Break repair), including the selected RC/LN parameters, fixed integral prior and segment-readout repairs
- Show the algorithm's integrated whole-map burden percentages, reusing the active rating model's raw demand without a second rating pass
- Fix number-style dans below 0th to show `< 0.50`
- Speed up rating with shared mirror recovery, linear window sweeps, cached interpolation operators and shared action-prefix moments. On the initial v1.2.3 integration's local 371-chart check, average rating time fell from 149.5 to 109.8 ms; the same upgraded-classifier pipeline fell from 207.7 to 168.1 ms (19.1%). See [verification details](TESTING.md)
- Existing ratings, dan tables, curves, saved settings and live-section confidence are retained. Local datasets and beatmaps are not included

## v1.2.0
- **Algorithm upgraded to SPM Rating v1.2.0-rc3 + the new SPMSubmodel RC/LN model**
- **Both v1.2.0 model variants are selectable** under **Rating Algorithm**: SPM Rating v1.2.0-Detailed (full) and SPM Rating v1.2.0-Compact (lighter). They differ in 16 calibrated parameters plus their role price and reference alignment; dan nodes are re-measured for both, and switching the algorithm re-rates the current chart
- **Total / RC / LN difficulty** now come from the new hand-contact, finger-role, chord-gesture and two-level aggregation model; every chart is scored together with its mirror and the two difficulty fields are averaged
- **Dan mapping re-measured** on the new reference scale for 4K / 6K / 7K and RC / LN; the ladder shape and `< ...` / `> ...` markers are unchanged
- **Number dan style shifted by +0.5**: the displayed number is the value mania players quote, so 8.5 shows 8dan exactly and 11.5 shows Gamma in 7K. Thirds and signs styles, ratings, curves and all other logic are unchanged
- Settings, metadata and the chart-analysis code paths are otherwise unchanged

## v1.0.1
- **New colour schemes**: **Aurora** and **High Contrast**, plus a WCAG contrast pass over all three palettes (chip ink, dim/faint text and the Break label were below 4.5:1 and are now above it)
- **UI Style** option: **Dan first** promotes the dan value to the headline number; **Minimal** strips the panel to the summary line, the dans (total / RC / LN, with the type badge) and the overall tags
- **Panel Density** option: **Compact** shrinks fonts, spacing and the curve
- **Map summary line**: artist/title/difficulty, mapper, key count, BPM (range when it varies), object count and length; follows rate mods; overlong song lines scroll instead of clipping — toggleable
- **Segment difficulty**: the current section's star rating and dan, next to its pattern tag — toggleable
- **Curve smoothing**: pixel-space Gaussian smoothing with five strengths, adjustable while a map is loaded; the LN line's structural zeros are preserved exactly, and the graph's x-axis now shares one time mapping with the playhead
- **Pause marker**: the playhead shows a pause glyph while the game is paused
- Fix: the RC line of the curve is now drawn from the calibrated RC sub-rating — v1.0.0 mixed raw and calibrated scales between the two lines
- The overlay no longer redraws the curve while hidden for gameplay

> Note: during this update's development we found defects in SPM Rating v1.0.0 and its accompanying algorithms; the next algorithm version will attempt to fix them.

## v1.0.0
- **Algorithm upgraded to SPM Rating v1.0.0 with the new RC/LN sub-model**
- **4K / 6K support**: difficulty rating and dan mapping now cover all key counts
- **Dan mapping rebuilt**: ladders calibrated per key count and skill (RC/LN), with `< 0th` / `> Stellium` markers beyond the measured range
- **Three dan display styles**: thirds (low/high), signs (-/+), decimal number
- **New settings**: sub-difficulty scheme (Direct / Legacy v0.5.1), dan display style, hide-while-playing
- Pure RC maps hide the LN rating and LN curve automatically
- Analysis speed optimized

## v0.5.1
- Performance: full-map analysis (pattern classification + rating) 641ms → 188ms on average; worst LN-heavy marathon maps 13.6s → 1.2s

## v0.5.0
- Pattern classification replaced with a new segment-based engine: change-point segmentation, per-segment classification, coloured pattern timeline with playhead
- Live current-section display (pattern, confidence, equivalent BPM) while playing
- Overall tags aggregated from sections; sort derived from section LN share
- Non-7K maps: classifier disabled, pattern UI hidden automatically
- Settings actually take effect now; unified colour language (RC = cool blue, LN = warm orange)

## v0.4.0
- Core SR algorithm upgraded to SPM Rating v0.4.0; correction-layer features 7 → 9 (nps_std, chord2)
- Dan mapping re-measured; LN mask calibration refitted
- Tag classifier rebuilt on 42 features

## v0.3.0
- Core SR algorithm upgraded to SPM Rating v0.3.0 (correction layer)

## v0.2.0
- Core SR algorithm upgraded to SPM Rating v0.2.0; sort/tag classifiers retrained

## v0.1.1
- Hybrid tag unified; new Inverse / Technical classifiers; Mix maps show dual RC+LN ratings; several bug fixes

## v0.1.0
- Initial release: sigmoid aggregation model with RC/LN sub-models, pattern tags, dan mapping, difficulty curve, mod support

