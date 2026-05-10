# SPM Map Analyser

[中文](README.md) | English

---

A [tosu](https://tosu.app) in-game overlay providing real-time difficulty ratings and pattern analysis for osu!mania **7K** beatmaps, powered by the **SPM Rating** algorithm.

## Features

- **Real-time Difficulty Rating**: Sigmoid aggregation model with S-curve accuracy simulation and bisection solving
- **Multi-source Estimation**:
  - **Total SR**: Full-map composite difficulty
  - **RC Difficulty**: Rice-only sections (LN heads treated as taps)
  - **LN Difficulty** (Hybrid maps): LN-section masked aggregation to prevent RC interference
- **Map Classification**: Decision tree auto-detection of RC / LN / HB / Mix types
- **Difficulty Curve**: Real-time graph with RC/LN component breakdown
- **Dan Mapping**: SR-to-Dan conversion (0th Dan through Stellium)
- **ML Pattern Tags**: 14-tag decision tree model (speed, tech, chordjack, release, etc.)
- **Mod Support**: Rate-changing mods (DT/HT/NF), custom speed rates

## Usage

1. Download from [Releases](https://github.com/SPMRating/spm_rating_map_analyser/releases/latest).
2. Place the folder inside tosu's `static` directory.
3. Launch tosu — find **SPM Map Analyser** in the dashboard.

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Show Skill Breakdown | Show stream/jack/tech/chordjack/release sub-ratings | On |
| Show Pattern Tags | Show ML-detected pattern tags | On |
| Accent Color | Rating number accent color | #ffffff |

## Pattern Tags

ML decision tree model (trained on 145 hand-labeled 7K maps):

**RC**: speed, dense chordstream, tech, chordjack, fast chordstream, anchor, minijack, vibro, RC Mix
**LN**: LN Mix, release, coordination, density, Hybrid

## Dan Reference

Based on 28 Dan marathon maps:

| Dan | RC SR Threshold | LN SR Threshold |
|-----|----------------|-----------------|
| 0th Dan | < 3.39 | < 3.59 |
| ... | ... | ... |
| 10th Dan | 8.78 | 8.54 |
| Gamma Dan | 9.95 | 9.64 |
| Azimuth Dan | 11.08 | 10.69 |
| Zenith Dan | 12.13 | 11.68 |
| Stellium | 13.19+ | 12.78+ |

## Algorithm

Core SPM Rating pipeline:

1. **Component Calculation**: 7 per-point components — `Pbar`(Stream), `Jbar`(Jack), `Xbar`(Cross), `Abar`(Anchor), `Rbar`(Release), `Sbar`(Shield), `Vbar`(Inverse)
2. **Instant Difficulty**: Non-linear combination into per-point D(t)
3. **Sigmoid Aggregation**: Segmented difficulty aggregated through S-curve accuracy model

**RC/LN Models**: RC uses first 4 components only; LN uses all; HB masks RC/LN sections separately.

## Files

```
├── index.html          # Plugin UI
├── spm_algorithm.js    # Core algorithm
├── settings.json       # tosu settings
├── metadata.txt        # Plugin metadata
├── dan_constants.json  # Dan mapping
├── classifier_constants.json  # Map type classifier
└── tag_classifier.json # ML pattern classifier
```

## Notes

1. **7K only** — 4K/6K will show as unavailable.
2. Ratings are estimates for reference only.
3. ML pattern classifier trained on limited data; rare patterns may misclassify.
4. Legacy osu!stable maps (v12 and below) may fail to parse.

## References

- [tosu](https://tosu.app) — Runtime environment
- [SPM Rating](https://github.com/ESWAT-omamori/SPMRating_v2_pro) — Algorithm tuning codebase
- [osumania_map_analyser](https://github.com/LeoBlackMT/osumania_map_analyser) — tosu plugin architecture reference

## License

MIT — see [LICENSE](LICENSE)
