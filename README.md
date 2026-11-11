# SPM Map Analyser v1.2.1

A [tosu](https://tosu.app) in-game overlay for osu!mania that shows real-time difficulty ratings, dan levels and pattern classification for **4K / 6K / 7K** beatmaps.

[中文](README_zh.md)

![Default view](screenshots/default-7k.png)

## Features

### Difficulty rating

- **Total difficulty** (SPM stars) for the current map, plus two sub-ratings:
  - **RC** — regular (non-hold) difficulty
  - **LN** — long-note (hold) difficulty
- On pure RC maps the LN rating is hidden automatically, so you only see the numbers that matter.
- Ratings use SPM Rating's **reference scale** (each key count is aligned to its own label domain), so compare star values within the same key count.
- **Both SPM Rating v1.2.0 models are available** and selectable under **Rating Algorithm**: **SPM Rating v1.2.0-Detailed** (the full model, default) and **SPM Rating v1.2.0-Compact** (the lighter upstream model that differs in 16 calibrated parameters, its role price and its reference alignment). Switching re-rates the current chart immediately.

### Map summary

An optional line at the top of the panel tells you what you are looking at: **artist – title [difficulty]**, the mapper, key count, BPM (a range when the chart's BPM moves), object count and play length. Values come from the tosu payload when the client exposes them and fall back to the parsed `.osu` header, so the line is complete on stable, lazer and every key count. Rate mods are taken into account — with DT/HT the BPM range and the play length follow the modded rate. A song line longer than the panel scrolls side to side instead of clipping. Toggle with **Show Map Summary**.

### Segment difficulty

While playing, the overlay follows your position and shows the current section's pattern together with its **difficulty** — the SPM star value for that section plus the equivalent dan. It is computed from the raw per-section curve (smoothing never moves the number), so the value always belongs to the section shown next to it; hover it for the section's peak and dan. 7K only. Toggle with **Show Segment Difficulty**.

### Difficulty curve

- A graph of the map's difficulty over time, occupying the lower half of the panel, with a playhead cursor following your position; the playhead turns into a pause marker while the game is paused
- Maps with both regular and hold sections draw **two lines** — **RC** (cool) and **LN** (warm) — so you can see at a glance which sections are stream-heavy and which are hold-heavy. Both lines are drawn on the same calibrated scale as the headline ratings
- **Curve smoothing** removes the jaggedness of the raw per-400 ms values. The strength is adjustable from *Off* to *Max* and is measured in pixels of the drawn curve, so one setting looks the same on a 30-second chart and on a 15-minute marathon. Peaks survive: at the default (*Medium*) the curve keeps 86% of its original peak height while shedding about 90% of its roughness (measured over a 332-map 7K corpus). Changing the strength does not re-analyse the map

### Pattern classification

The map is automatically split into sections, and each section is classified into a pattern type: **Chordjack**, **Minijack**, **Chordstream**, **Speed**, **Tech**, **Vibro**, **Coordination**, **Density**, **Inverse**, **Release**, **Technical**, **Break** and **Hybrid**.

What you get from it:

- **Overall tags** — SPMTagClassifier **1.2.4 + commit `184408e`** stable classification, with continuous-time, multi-factor burden percentages beside both primary and secondary chips. The calculation integrates **branch support × difficulty burden × action load**, using the active Detailed/Compact model's raw row-level demand from the same rating pass. These are overlapping burden shares, not confidence or elapsed-time shares; Hybrid shows the relative RC/LN family shares normalized to sum to 100% (display only). Switching the rating model updates the tags and percentages; smoothing does not
- **Live current section** — while playing, the overlay follows your position and shows the current section's pattern, its confidence and an equivalent BPM
- **Pattern timeline** — a colour band spanning the whole map with a playhead cursor

**Local classifier updated:** the pinned [184408e snapshot](https://github.com/Ist1na07/SPMTagClassifier/blob/184408e3154e082946a4c2355e724daa118fb0e9/src/index.cjs) uses jointly retuned original 56D RC/LN expert parameters and a fixed reference predictor for whole-map aggregation. It also includes static-hand false chordstream exclusion, the LN Wildcard rest exemption and stable within-type tempo plateaus. Local labels can now differ from the prior v1.2.3 engine. This is the commit's unreleased retune, not merely the published v1.2.4 bundle; `modern` remains a separate opt-in candidate. See [CLASSIFIER.md](CLASSIFIER.md).

Pattern classification currently runs on **7K** maps only; 4K/6K maps show the summary, difficulty rating, dan and curve.

### Dan mapping

- The rating is mapped to a dan ladder, calibrated separately for each key count and skill:
  - **4K RC**: 1st ~ 10th, then **Alpha / Beta / Gamma / Delta / Epsilon** · **4K LN**: 1st ~ 15th
  - **6K RC**: Start ~ 9th · **6K LN**: 0th ~ 14th
  - **7K RC / LN**: 0th ~ Stellium
- The dan nodes are measured **separately for each rating-algorithm model** (SPM Rating v1.2.0-Detailed and SPM Rating v1.2.0-Compact), so switching the algorithm keeps the ladder's meaning
- Outside the measured range it shows `< ...` / `> ...` (e.g. `< 0th`, `> Stellium`)
- Three display styles for the dan value: **thirds** (low / high), **signs** (`-` / `+`), or a **decimal number** (+0.5 shift: 8.5 = 8th dan exactly, 11.5 = Gamma in 7K)
- In number mode, levels below 0th retain the lower-bound marker: **`< 0.50`** rather than `0.50`
- Hybrid maps additionally show a **Total** dan

### Colour schemes and UI styles

Three palettes, selectable under **Color Scheme**:

| Scheme | What it is |
|--------|------------|
| **Default Dark** | The v1.0.0 palette, unchanged |
| **Aurora** | Teal/cyan for RC against coral/red for LN — a complementary pair, which separates the two families more strongly than blue/orange at small sizes — on an indigo-tinted panel |
| **High Contrast** | Near-black panel with Okabe-Ito derived hues, built for readability over bright gameplay |

Every chip and text colour in every scheme is measured against a WCAG 4.5:1 contrast target, over both a bright and a dark gameplay frame.

Two layouts under **UI Style**:

| Style | What it is |
|-------|------------|
| **Rating first** | The star rating is the headline number; dan sits on its own row below |
| **Dan first** | The dan value is the headline (the metric mania players quote) and the star rating moves next to it |
| **Minimal** | Just the summary line, the dans (total with the type badge, RC and LN) and the overall pattern tags |

**Panel Density** shrinks the whole panel: **Compact** uses smaller fonts, tighter spacing and a flatter curve to cover less of the screen.

![Aurora, rating first](screenshots/aurora-7k.png)
![High Contrast, dan first](screenshots/high-contrast-dan-first.png)
![Minimal](screenshots/minimal-7k.png)

### Other

- **Mod support** — rate-changing mods (DT / NC / HT) are taken into account
- **Hide while playing** — optionally hide the overlay once gameplay starts

## Usage

1. Download the [v1.2.1 source snapshot](https://github.com/Ist1na07/spm_rating_map_analyser/archive/refs/heads/main.zip) from this repository (no v1.2.1 Release is published), or choose an earlier package from [Releases](https://github.com/Ist1na07/spm_rating_map_analyser/releases).
2. Place the folder **directly containing `index.html`, `settings.json` and `metadata.txt`** inside tosu's `static` directory; do not add another wrapper folder.
3. Launch tosu — find **SPM Map Analyser** in the dashboard.

### Settings errors or small rating differences after upgrading

Use `tosu/static/spm_rating_map_analyser_v1.2.1/index.html`. With a nested installation, tosu v4.26.3 can fail to create the settings-file parent directory (`ENOENT`). Flatten the installation, or, for an existing `static/outer/inner/index.html`, create `tosu/settings/outer/` before opening Settings. Keep existing `.values.json` files.

The overlay now uses the full, fixed relative directory for its settings socket, avoiding `Wrong overlay` when tosu injects `COUNTER_PATH` after startup. A settings-read failure displays whether defaults or previously loaded settings are in use. Hover the star value to check the active Detailed/Compact model. Refresh open overlay pages after updating.

Tosu stores settings separately for each installation directory. Match **Rating Algorithm, Sub Difficulty Scheme and rate** when comparing versions: Detailed and Compact can legitimately differ by a few hundredths. Rating optimization preserves results for the same model, chart and rate. Previous choices are in tosu's `settings/<old-folder>.values.json`; back up and copy them to the corresponding new settings file without overwriting the old file.

## Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| Rating Algorithm | SPM Rating v1.2.0 model variant: **SPM Rating v1.2.0-Detailed** (full model) or **SPM Rating v1.2.0-Compact** (lighter model). Each has its own measured dan nodes; changing it re-rates the current chart | Detailed |
| Sub Difficulty Scheme | **Direct**: RC/LN sub-ratings always come from the new sub-models. **Legacy v0.5.1**: LN maps show LN difficulty equal to the total | Direct |
| UI Style | **Rating first**, **Dan first** or **Minimal** (summary + dans + overall tags only) | Rating first |
| Panel Density | **Standard** or **Compact** panel size | Standard |
| Color Scheme | **Default Dark**, **Aurora** or **High Contrast** | Default Dark |
| Dan Display Style | How the dan value is shown: thirds (low/high), signs (-/+) or a decimal number (+0.5 shift: 8.5 = 8dan, 11.5 = Gamma in 7K) | Thirds |
| Curve Smoothing | How much the difficulty curve is smoothed: Off, Light, Medium, Strong, Max | Medium |
| Hide While Playing | Hide the overlay after gameplay starts (shown again on the results screen) | Off |
| Show Map Summary | Show the song/difficulty/mapper/keys/BPM/objects/length line | On |
| Show Pattern Tags | Show the overall pattern chips | On |
| Show Current Segment | Show the live section pattern and equivalent BPM | On |
| Show Segment Difficulty | Show the live section's star rating and dan (7K only) | On |
| Show Segment Timeline | Show the full-map pattern colour band | On |
| Show Break Segments | Show "Break" during rest sections | On |

## Version history

### v1.2.1
- Remove the “Burden” prefix; normalize the Hybrid chip’s RC/LN pair to 100% while retaining its relative proportion and leaving algorithm outputs unchanged
- Follow-up: fix nested/space settings paths and late tosu `COUNTER_PATH` injection; show settings failures and the active rating model instead of silently comparing default Detailed against saved Compact
- Bundle the complete classifier from **SPMTagClassifier `184408e`** (`184408e3154e082946a4c2355e724daa118fb0e9`, package 1.2.4 plus unreleased local-expert retune), including the selected RC/LN parameters, fixed integral prior and segment-readout repairs
- Show the algorithm's integrated whole-map burden percentages, reusing the active rating model's raw demand without a second rating pass
- Fix number-style dans below 0th to show `< 0.50`
- Speed up rating with shared mirror recovery, linear window sweeps, cached interpolation operators and shared action-prefix moments. On the initial v1.2.3 integration's local 371-chart check, average rating time fell from 149.5 to 109.8 ms; the same upgraded-classifier pipeline fell from 207.7 to 168.1 ms (19.1%). See [verification details](TESTING.md)
- Existing ratings, dan tables, curves, settings, live-section confidence and 7K-only classification visibility are retained. Local datasets and beatmaps are not included

### v1.2.0
- **Algorithm upgraded to SPM Rating v1.2.0-rc3 + the new SPMSubmodel RC/LN model**
- **Both v1.2.0 model variants are selectable** under **Rating Algorithm**: SPM Rating v1.2.0-Detailed (full) and SPM Rating v1.2.0-Compact (lighter). They differ in 16 calibrated parameters plus their role price and reference alignment; dan nodes are re-measured for both, and switching the algorithm re-rates the current chart
- **Total / RC / LN difficulty** now come from the new hand-contact, finger-role, chord-gesture and two-level aggregation model; every chart is scored together with its mirror and the two difficulty fields are averaged
- **Dan mapping re-measured** on the new reference scale for 4K / 6K / 7K and RC / LN; the ladder shape and `< ...` / `> ...` markers are unchanged
- **Number dan style shifted by +0.5**: the displayed number is the value mania players quote, so 8.5 shows 8dan exactly and 11.5 shows Gamma in 7K. Thirds and signs styles, ratings, curves and all other logic are unchanged
- Settings, metadata and the chart-analysis code paths are otherwise unchanged

### v1.0.1
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

## Ideas for later

Measured against [ManiaMapAnalyser](https://github.com/LeoBlackMT/osumania_map_analyser) by Leo_Black. These are the things that would need real work rather than a settings toggle, so they are notes rather than features:

- **Per-bucket percentile instead of per-bucket max.** Today a 400 ms bucket reports its single hardest note row, so a bucket holding one note looks as hard as a dense one. Taking the 85th percentile of the rows in a bucket would remove that bias at the source and steady the curve *without* any smoothing.
- **Cover-art accent sampling.** Tint the panel from the beatmap background image, the way LeoBlack's `coverTheme` does. Needs an image fetch and a colour quantiser.
- **Layout presets.** LeoBlack ships 15 named presets plus JSON import/export. The two UI styles and two densities here cover the useful range; a preset system only pays off with more content to preset.
- **More estimators.** LeoBlack integrates Etterna MinaCalc (five versions), Interlude, Sunny Rework, Daniel and Companella through WASM/ONNX. That is a different scale of project — bundled binaries, a worker and a benchmark harness — and it changes what the numbers mean, which is why the rating algorithm setting here only offers SPM Rating's own two model variants.

## Notes

- Difficulty ratings and dan levels are estimates, for reference only.
- The 7K pattern classifier is trained on limited data; rare or unusual patterns may occasionally be misjudged.
- Legacy osu!stable beatmaps (format v12 or older) may fail to parse.

## Development

Run the checked-in regression tests from a Git checkout with Node 20 or newer:

```sh
node --test tests/regression.test.cjs
# Optional: use your own local datasets/maps and classifier runtime source pinned to `184408e`.
node tests/corpus.cjs ../dataset ../maps ../SPMTagClassifier
```

The browser checks are also checked in as `tests/browser.cjs`; test-only setup is in [TESTING.md](TESTING.md).

The tests compare ratings against the original `1e99e4d` engine and check the new rating-evidence handoff, both model variants, rate mods, window edges and dan labels. The optional corpus check also verifies the exact upstream browser bundle and Node/browser output parity. It prints a JSON report to stdout; chart files are never copied into the repository. See [TESTING.md](TESTING.md) for the completed local checks and [CLASSIFIER.md](CLASSIFIER.md) for the pinned upstream source.

## References

- [tosu](https://tosu.app) — the runtime this overlay runs on
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — the difficulty algorithm
- [SPMTagClassifier 184408e](https://github.com/Ist1na07/SPMTagClassifier/tree/184408e3154e082946a4c2355e724daa118fb0e9) — the pattern classifier and whole-map burden integration
- [SPM Submodel](https://github.com/Ist1na07/SPMSubmodel) — the RC / long-note sub-model

## License

MIT — see [LICENSE](LICENSE)
