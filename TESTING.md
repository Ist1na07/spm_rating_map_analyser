# v1.2.1 verification

## Automated checks

- `node --test tests/regression.test.cjs`: nine tests passed. Includes 38 full
  rating comparisons across 4K/6K/7K, taps/holds, Detailed/Compact, HT/NM/DT and
  legacy sub-difficulty display; all result fields and curve buckets equal
  the original engine. Numeric lower-bound labels and optimized window helpers
  are checked separately. Native 4K/6K tests cover taps/holds at HT/NM/DT,
  five-class composition and segment difficulty, and reject accidental use of
  the 7K-only rating-evidence protocol.
- `node tests/corpus.cjs ../dataset ../maps ../SPMTagClassifier`: 371 local
  charts passed (19 4K, 18 6K, 334 7K). Includes all 332 local 7K dataset charts,
  size-stratified 4K/6K samples, the longest file from each course directory and
  the standalone map. Models and rates alternate deterministically. No rating,
  dan or curve differences; all 334 7K rated classifications consumed difficulty
  successfully. All 37 4K/6K charts now also passed native coarse classification
  and segment-stat checks. Twelve real-map results matched the upstream Node
  API exactly, stratified as four each for 4K, 6K and 7K.
- The vendored bundle equals `dist/tag-engine.js` from full commit
  `184408e3154e082946a4c2355e724daa118fb0e9` byte for byte. Package version 1.2.4
  alone is insufficient to identify this unreleased retune. The selected
  upstream API, perception and segment-readout tests passed (15 tests); the
  full research/build suite was not run. No fitting was performed.

The earlier pinned 7K-only integration run, using the same corpus protocol below, measured mean
rating time 148.9 → 110.5 ms and rating + the same new classifier 212.8 →
174.4 ms (18.0% shorter than the unoptimized integration). These are local
single-pass timings, not accuracy measurements.

## Historical performance: initial v1.2.3 integration

Node on the development Windows machine; two synthetic warm-up ratings per
engine; each real chart measured once, alternating engine order. Same texts,
models and rates; exact result equality was checked alongside timing.

| Mean per chart | Before optimization | After optimization |
|---|---:|---:|
| Rating | 149.5 ms | 109.8 ms |
| Rating + the same v1.2.3 classifier | 207.7 ms | 168.1 ms |

That v1.2.3 pipeline was 19.1% faster than its unoptimized integration. This
comparison held the **v1.2.3 classifier** fixed; it does not compare old and new
classification algorithms or promise these timings on every machine.

The optimizations reuse the column-independent recovery field for the mirror,
advance sorted window endpoints linearly, share interpolation operators and
build action-prefix moments once for both integration endpoints. No sampling,
model simplification or floating-point expression reordering is used.

## Browser checks at 184408e

In addition to the existing UI cases below, the actual renderer passed live
playhead transitions at 150/200 and DT225/300 BPM, and a static-hand fixture
showed Wildcard with 18% classification support instead of a false chordstream
or fabricated zero. The default `localExpert` is asserted to be
`original56-joint-fixed-ridge01`; `classic` is explicitly `archived`.


The actual overlay scripts were run in headless Chrome, with intercepted local
HTTP and websocket fixtures emulating tosu. Checked the rendered 430 px and
380 px layouts, primary percentages, live Detailed/Compact switching, one
rating pass per change, smoothing/resize invariance, Minimal/Compact styling,
DT timing, pause marker, native 4K/6K classification visibility, and the
visible numeric `< 0.50` label. Screenshots were visually inspected. The source
and fixture data were local; no dataset was uploaded.

### Native 4K/6K and tag-row follow-up

The actual renderer now checks five-class native tags, the 0–1 to percentage
adapter, taxonomy-specific tooltips, live tag/confidence, segment difficulty,
timeline and NM/DT/HT clocks for both 4K and 6K. Besides synthetic tap/hold
charts, one real median-size chart from each local key-count dataset was
rendered. Smoothing and resizing retained native classifications and their
original output objects; Detailed/Compact rating selection remained usable.
No difficulty field was passed to the native coarse classifiers.

The attached 710px layout was reproduced with Fast Chordstream 33%, Dense
Chordstream 37%, Speed 15% and Chordjack 13%. All four chips occupy one line
after removing the 440px cap; at 430px the row wraps naturally without chip
overflow. Main-tag selection is unchanged and the tooltip now explains its
prior-aware gates. Wide/narrow and real 4K/6K screenshots were inspected.

Run the browser check with optional real 4K/6K dataset fixtures:

```sh
node tests/browser.cjs /path/to/7k-chart.osu ../dataset
```

### Tag display follow-up

The browser renderer checks that the “Burden” prefix is absent and Hybrid
masses 0.44/0.52 display as RC 46% / LN 54%. Additional pairs check 50/50,
33/67, 0/100 and 100/0; both absent masses show dashes rather than a fabricated
ratio. Rendering leaves the classifier output unchanged. Integer percentages
use complementary rounding, guaranteeing a displayed total of 100% whenever
the original pair has positive mass.

### Earlier live tosu check (v1.2.3 classifier)

The real settings endpoint reproduced `ENOENT` for a nested installation's
missing settings parent. Its creation and migration of the old choices restored
the settings page. A second failure was reproduced: the initial socket used
only the leaf folder, while tosu's later injected full path changed the
`getSettings` payload, returning `Wrong overlay`. The full directory is now
derived before connection and held fixed. The browser fixture reproduces this
late-injection order, nested/space paths, settings errors and recovery.

The installed old version used Compact; the failed new settings load left
Detailed defaults. On the local chart used in that check at NM these are 8.758589537484427
and 8.73010777619925, displaying 8.76 and 8.73. Both installed scoring engines
produced exactly equal complete results when the same model and rate were used
(HT/NM/DT and both variants). After repairing settings, the actual live old/new
overlay pages both displayed total 8.76, RC 8.39, LN 9.06, RC dan 10.98,
LN dan 12.07, Total dan 11.58 and current-segment difficulty 8.37. The real tosu
settings page rendered all 17 definitions with the retained choices. Screenshots
were inspected. The live client was in the beatmap editor; gameplay behavior
was not changed or separately exercised.

Across all 332 local 7K dataset charts at NM, exact interval intersection
compared old and stable v1.2.3 primary segment tags: 99.9220% of jointly covered
time retained the same tag. Only four charts changed, all Break-to-active
repairs (48.4925 s out of 62,192.778 s); an additional 157 ms differed in display
envelope coverage. This was expected from the old v1.2.3 stable contract, not an
accuracy score; it does not describe the current retuned classifier. Local primary tags do not depend on the difficulty
input; this comparison uses the action-only call to avoid unnecessary repeated scoring. Reproduce it with:

```sh
node tests/local-tags.cjs ../dataset/spm_dataset-0.4.0 9105c09
```

Re-run the browser checks with Chrome installed (Playwright is a test-only
dependency, not used by the overlay):

```sh
npm install --no-save --package-lock=false playwright@1.65.0
node tests/browser.cjs
# Or pass a local 7K file instead of the synthetic fixture:
node tests/browser.cjs /path/to/chart.osu
```

`CHROME_PATH` can select another installed Chrome executable. Screenshots go
to a temporary directory, or the directory named by `SPM_TEST_OUTPUT`.
