# SPM Map Analyser

A [tosu](https://tosu.app) in-game overlay for osu!mania that shows real-time difficulty ratings, dan levels and pattern classification for **4K / 6K / 7K** beatmaps.

[中文](README_zh.md)

## Features

### Difficulty rating

- **Total difficulty** (SPM stars) for the current map, plus two sub-ratings:
  - **RC** — regular (non-hold) difficulty
  - **LN** — long-note (hold) difficulty
- On pure RC maps the LN rating is hidden automatically, so you only see the numbers that matter.

### Pattern classification

The map is automatically split into sections, and each section is classified into a pattern type: **Chordjack**, **Minijack**, **Chordstream**, **Speed**, **Tech**, **Vibro**, **Coordination**, **Density**, **Inverse**, **Release**, **Technical**, **Break** and **Hybrid**.

What you get from it:

- **Overall tags** — the map's dominant pattern types shown as chips under the rating
- **Live current section** — while playing, the overlay follows your position and shows the current section's pattern, its confidence and an equivalent BPM
- **Pattern timeline** — a colour band spanning the whole map with a playhead cursor

Pattern classification currently runs on **7K** maps only; 4K/6K maps show difficulty and dan without the pattern UI.

### Dan mapping

- The rating is mapped to a dan ladder, calibrated separately for each key count and skill:
  - **4K RC**: 1st ~ 10th, then **Alpha / Beta / Gamma / Delta / Epsilon** · **4K LN**: 1st ~ 15th
  - **6K RC**: Start ~ 9th · **6K LN**: 0th ~ 14th
  - **7K RC / LN**: 0th ~ Stellium
- Outside the measured range it shows `< ...` / `> ...` (e.g. `< 0th`, `> Stellium`)
- Three display styles for the dan value: **thirds** (low / high), **signs** (`-` / `+`), or a **decimal number**
- Hybrid maps additionally show a **Total** dan

### Difficulty curve

- A graph of the map's difficulty over time, occupying the lower half of the panel, with a playhead cursor following your position
- Maps with both regular and hold sections draw **two lines** — **RC** (blue) and **LN** (orange) — so you can see at a glance which sections are stream-heavy and which are hold-heavy
- Pure RC / pure LN maps draw a single line

### Other

- **Mod support** — rate-changing mods (DT / NC / HT) are taken into account
- **Hide while playing** — optionally hide the overlay once gameplay starts

## Usage

1. Download the latest release from [Releases](https://github.com/Ist1na07/spm_rating_map_analyser/releases/latest).
2. Place the folder inside tosu's `static` directory.
3. Launch tosu — find **SPM Map Analyser** in the dashboard.

## Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| Rating Algorithm | Algorithm selector (reserved for future versions) | SPM Rating v1.0.0 |
| Sub Difficulty Scheme | **Direct**: RC/LN sub-ratings always come from the new sub-models. **Legacy v0.5.1**: LN maps show LN difficulty equal to the total | Direct |
| Dan Display Style | How the dan value is shown: thirds (low/high), signs (-/+) or a decimal number | Thirds |
| Color Scheme | Overlay colour scheme (reserved for future themes) | Default Dark |
| Hide While Playing | Hide the overlay after gameplay starts (shown again on the results screen) | Off |
| Show Pattern Tags | Show the overall pattern chips | On |
| Show Current Segment | Show the live section pattern and equivalent BPM | On |
| Show Segment Timeline | Show the full-map pattern colour band | On |
| Show Break Segments | Show "Break" during rest sections | On |

## Version history

### v1.0.0
- **Algorithm upgraded to SPM Rating v1.0.0 with the new RC/LN sub-model**
- **4K / 6K support**: difficulty rating and dan mapping now cover all key counts
- **Dan mapping rebuilt**: ladders calibrated per key count and skill (RC/LN), with `< 0th` / `> Stellium` markers beyond the measured range
- **Three dan display styles**: thirds (low/high), signs (-/+), decimal number
- **New settings**: sub-difficulty scheme (Direct / Legacy v0.5.1), dan display style, hide-while-playing
- Pure RC maps hide the LN rating and LN curve automatically
- Analysis speed optimized

### v0.5.1
- Performance: full-map analysis (pattern classification + rating) 641ms → 188ms on average; worst LN-heavy marathon maps 13.6s → 1.2s

### v0.5.0
- Pattern classification replaced with a new segment-based engine: change-point segmentation, per-segment classification, coloured pattern timeline with playhead
- Live current-section display (pattern, confidence, equivalent BPM) while playing
- Overall tags aggregated from sections; sort derived from section LN share
- Non-7K maps: classifier disabled, pattern UI hidden automatically
- Settings actually take effect now; unified colour language (RC = cool blue, LN = warm orange)

### v0.4.0
- Core SR algorithm upgraded to SPM Rating v0.4.0; correction-layer features 7 → 9 (nps_std, chord2)
- Dan mapping re-measured; LN mask calibration refitted
- Tag classifier rebuilt on 42 features

### v0.3.0
- Core SR algorithm upgraded to SPM Rating v0.3.0 (correction layer)

### v0.2.0
- Core SR algorithm upgraded to SPM Rating v0.2.0; sort/tag classifiers retrained

### v0.1.1
- Hybrid tag unified; new Inverse / Technical classifiers; Mix maps show dual RC+LN ratings; several bug fixes

### v0.1.0
- Initial release: sigmoid aggregation model with RC/LN sub-models, pattern tags, dan mapping, difficulty curve, mod support

## Notes

- Difficulty ratings and dan levels are estimates, for reference only.
- The 7K pattern classifier is trained on limited data; rare or unusual patterns may occasionally be misjudged.
- Legacy osu!stable beatmaps (format v12 or older) may fail to parse.

## References

- [tosu](https://tosu.app) — the runtime this overlay runs on
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — the difficulty algorithm

## License

MIT — see [LICENSE](LICENSE)
