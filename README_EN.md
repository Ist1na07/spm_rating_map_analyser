# SPM Map Analyser

[中文](README.md) | English

---

A [tosu](https://tosu.app) in-game overlay providing real-time difficulty ratings and pattern analysis for osu!mania **7K** beatmaps, powered by the **SPM Rating v0.4.0** algorithm. Since v0.5.0 it ships with a **segment-based pattern classification engine** (TagClassifier): the map is automatically split into sections, each section's pattern is classified, and the overlay follows your play position live.

## Features

- **Real-time Difficulty Rating**: Sigmoid aggregation model (k=2.09, C=3.97) simulates player performance with an S-curve accuracy model; stable rating solved via bisection
- **Dual Difficulty**: each map shows both an RC difficulty and an LN difficulty
  - The dominant type uses Total SR (RC difficulty for RC maps, LN difficulty for LN maps)
  - The non-dominant side, and both sides of HB/Mix maps, use section-masked difficulty (sigmoid aggregation over only that type's note sections)
- **Segment Pattern Timeline**: change-point detection splits the map into segments; each segment's pattern is classified and shown as a colored band; Break segments are dimmed
- **Live Current Segment**: follows play progress and shows the current position's pattern tag, confidence, and equivalent BPM (jack/stream types, 16th-note basis)
- **Map Sort**: derived from segment aggregation (RC / LN / HB by LN-weighted section share)
- **Overall Pattern Tags**: segment tags aggregated by duration × confidence into whole-map tags (with RC Mix / LN Mix / Hybrid synthesis)
- **Difficulty Curve**: real-time graph of full-map and RC/LN section difficulty with playhead cursor
- **Dan Mapping**: piecewise linear interpolation maps SR to the 7K Dan system (0th ~ Stellium)
- **Mod Support**: rate-changing mods (DT/HT/NC); HT dual-scaling fixed

## Usage

1. Download from [Releases](https://github.com/Ist1na07/spm_rating_map_analyser/releases/latest).
2. Place the folder inside tosu's `static` directory.
3. Launch tosu — find **SPM Map Analyser** in the dashboard.

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Show Pattern Tags | Show overall pattern tag chips (plus major segment share chips) | On |
| Show Current Segment | Show the live segment tag and equivalent BPM at the playhead | On |
| Show Segment Timeline | Show the full-map segment pattern color band with playhead | On |
| Show Break Segments | Show "Break" text during rest sections (timeline always shows them dimmed) | On |
| Accent Color | Rating number accent color | #ffffff |

## Pattern Tags (v0.5.0 new classifier)

Pipeline: `.osu parse → rows (rice + LN heads; LN tails tracked separately) → 1s sliding window features (0.25s step) → change-point segmentation → per-segment family softmax model → temporal smoothing → whole-map aggregation`.

**RC**: Chordjack, Minijack, Dense Chordstream, Fast Chordstream, Tech, Speed, Vibro, Wildcard (fallback)
**LN**: Coordination, Density, Inverse, Technical, Release, LN Wildcard (fallback)
**Special**: Break (rest sections, excluded from aggregation)

The segment model is a 56-feature softmax linear model trained per family (RC/LN) on 162 single-label maps plus 6 hand-segmented maps with extra weight.

**Overall aggregation**: non-Break segments weighted by duration × confidence; a top share ≥52% yields a single tag; ≥3 significant tags (each ≥7%) without a dominant one synthesize RC Mix / LN Mix / Hybrid; two close tags yield a dual label.

**Sort**: by LN-weighted segment duration share — <18% RC, >68% LN, HB in between.

**Metrics** (334-map impression-labeled dataset): sort accuracy 91.3%, overall tag exact-set match 58.7%; on 6 hand-segmented maps, strict segment hit-time ratio 68.6%.

## Dan Reference

Piecewise linear interpolation from measured Dan marathon SR. Since v0.4.0, nodes are measured on path B (correction-layer-applied, player-visible SR), so displayed SR maps directly to the Dan calibration basis.

| Dan | RC SR Reference | LN SR Reference |
|-----|----------------|-----------------|
| 0th Dan | ~3.5 | ~3.8 |
| 1st Dan | ~4.0 | ~4.4 |
| 5th Dan | ~6.0 | ~6.3 |
| 8th Dan | ~7.3 | ~7.3 |
| 10th Dan | ~8.3 | ~8.3 |
| Gamma | ~8.9 | ~8.7 |
| Azimuth | ~9.4 | ~9.5 |
| Zenith | ~10.2 | ~10.1 |
| Stellium | >10.2 | >10.1 |

Note: Full piecewise linear interpolation covers 15 Dan levels (0th~Stellium). The table above lists key reference points only; Stellium is extrapolated. Within-Dan position is shown as "low" / "" / "high".

## Algorithm

Difficulty rating (SPM Rating v0.4.0, unchanged in this release):

1. **Component Calculation**: 7 per-point components — Pbar(Stream), Jbar(Jack), Xbar(Cross), Abar(Anchor), Rbar(Release), Sbar(Shield), Vbar(Inverse)
2. **Instant Difficulty**: non-linear combination into per-point D(t)
3. **Sigmoid Aggregation**: segmented difficulty aggregated through an S-curve accuracy model (k=2.09, C=3.97, γ=0.196), solving for stable rating via bisection
4. **Feature Correction Layer**: 9 chart-level features (speed, burst, chord, pj, hs, lb, fj, nps_std, chord2) via an L2-regularized linear model capture systematic D-formula biases; the scalar correction is added to D_calib before re-aggregation (path B). Sub-model ratings use the base formula (path A).

RC/LN sub-models: RC disables Rbar/Sbar/Vbar; LN uses LN-only masked aggregation.

Pattern classification (v0.5.0 new engine — see the header comment of `tag_engine.js` and the TagClassifier project): segment-level 56-dimensional features (row-rate/chord statistics, jack-run evidence, hold/release morphology, grid fitting, rhythm regularity, etc.) → per-family softmax → segment smoothing → whole-map aggregation. The classifier does not run on non-7K maps.

## Files

```
├── index.html                 # Plugin UI (including segment pattern UI)
├── spm_algorithm.js           # Difficulty rating core (ENHANCED_PARAMS + sigmoid aggregation)
├── tag_engine.js              # Segment pattern classifier (bundled from TagClassifier, model embedded)
├── settings.json              # tosu settings
├── metadata.txt               # Plugin metadata
└── dan_constants.json         # Dan constants (generated by fit_dan_regression.py)
```

## Version History

### v0.5.0
- **Sort/Tag classifiers fully replaced by the segment-based pattern engine** (TagClassifier): removed the old 4-class sort decision tree and the 42-feature 12-tree tag classifier (including `classifier_constants.json` and `tag_classifier.json`)
- **New: segment tag prediction** — change-point segmentation → per-segment softmax classification (56 features, separate RC/LN family models) → temporal smoothing; colored segment timeline with playhead
- **New: live current-segment display** — follows play progress showing the current pattern tag, secondary tag, confidence, and equivalent BPM (jack/stream types use the row-rate convention 15000 / median adjacent-row interval; hidden when intervals are irregular)
- Overall tags now aggregate segments by duration × confidence and render as colored chips (with major segment-share outline chips)
- Sort now derives from LN-weighted segment duration share (RC < 18% / LN > 68% / HB between), 91.3% accuracy on the 334-map dataset
- Difficulty rating algorithm (SPM Rating v0.4.0) unchanged — SR values are bit-identical to v0.4.0
- **Non-7K maps** (4K etc.): the classifier no longer runs; sort badge, pattern tags, and segment UI are hidden automatically — difficulty rating, dan mapping, and the difficulty curve remain
- Settings now actually take effect (they were unread in previous versions): added Show Current Segment / Show Segment Timeline / Show Break Segments; removed Show Skill Breakdown (no such UI)
- Unified visual redesign: RC is always the cool blue family, LN always the warm orange family — sort badge, sub-ratings, dan values, difficulty curves, pattern tags, and the timeline share one color semantics; pattern tags render as tinted outline chips, and a divider separates the difficulty zone from the pattern zone

### v0.4.0
- Core SR algorithm upgraded to **SPM Rating v0.4.0** (correction layer expansion)
- Correction-layer features 7 → **9**, adding **nps_std** (500ms-window NPS standard deviation, density temporal variance) and **chord2** (2-note chord density, 5ms tolerance clustering)
- All 9 feature weights refitted; correction-layer post-processing jointly re-optimized (N0=1.029, threshold=9.11, divisor=1.97, scale=1.094)
- In-sample Loss: 0.770 → 0.694 (-9.9%), MAE: 0.213 → 0.207, paired t-test p=0.0007
- **Dan mapping re-measured**: nodes measured on path B (correction-layer, player-visible SR); RC/LN linear regression R²=0.997 / 0.993
- **LN-masked model calibration refit**: calib_a/b refit on the subset with LN reference labels (5-fold CV test MAE=0.215), preserving the HB/Mix dual-difficulty semantics
- **Tag classifier rebuilt**: 42 features (36 base + 6 correction-layer), 12 individual-tag decision trees; Mix tags synthesized at runtime from ≥3 same-category individual tags (replace, not append); exact match 48.9%, RC Mix synthesis 96%, LN Mix 97%
- Difficulty curves now use calibrated D arrays so curve quantities are consistent with the rating

### v0.3.0
- Core SR algorithm upgraded to **SPM Rating v0.3.0** (feature correction layer)
- Total SR enhanced with a **7-feature correction layer** (chord, fj, hs, lb, speed, burst, pj), L2-regularized (λ=0.01)
- Post-processing parameters jointly re-optimized with the correction layer (N0=0.0005, threshold=9.40, divisor=1.98, scale=1.06)
- In-sample Loss: 0.932 → 0.770 (-17.4%), MAE: 0.218 → 0.213
- RC/LN sub-models unchanged (different bias patterns, require independent training)

### v0.2.0
- Core SR algorithm upgraded to **SPM Rating v0.2.0** (k=2.09, C=3.97, γ=0.196)
- **Sort classifier retrained**: 4-class decision tree (RC/LN/HB/Mix), 98.1% accuracy
- **Tag classifier retrained**: individual-tag decision trees + Mix synthesis

### v0.1.1
- HB maps unified as "Hybrid" tag
- Added Inverse, Technical tag classifiers; removed Anchor
- Mix maps display both RC+LN difficulty ratings
- Fixed HT dual-scaling, NC display, and other bugs

### v0.1.0
- Initial release: Sigmoid aggregation model + RC/LN sub-models
- Individual-tag decision tree classifier + synthesis tags (RC Mix / LN Mix / Hybrid)
- Dan mapping (0th~Stellium), difficulty curve, Mod support

## Notes

1. Both difficulty rating and pattern classification target **7K**. Non-7K maps (4K etc.) show difficulty rating, dan mapping, and difficulty curve only; the sort badge, pattern tags, and segment UI are hidden automatically.
2. Ratings are estimates for reference only.
3. The pattern classifier is trained on limited labeled data (334 impression-labeled maps + 6 hand-segmented maps); niche patterns may misclassify, and algorithmic segment boundaries may differ from human ones.
4. Legacy osu!stable maps (v12 and below) may fail to parse.

## References

- [tosu](https://tosu.app) — Runtime environment
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — Algorithm tuning codebase
- TagClassifier — source project of the v0.5.0 segment pattern engine

## License

MIT — see [LICENSE](LICENSE)
