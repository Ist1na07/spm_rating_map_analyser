# v1.2.1 verification

## Automated checks

- `node --test tests/regression.test.cjs`: six tests passed. Includes 38 full
  rating comparisons across 4K/6K/7K, taps/holds, Detailed/Compact, HT/NM/DT and
  legacy sub-difficulty display; all result fields and curve buckets equal
  the original engine. Numeric lower-bound labels and optimized window helpers
  are checked separately.
- `node tests/corpus.cjs ../dataset ../maps ../SPMTagClassifier`: 371 local
  charts passed (19 4K, 18 6K, 334 7K). Includes all 332 local 7K dataset charts,
  size-stratified 4K/6K samples, the longest file from each course directory and
  the standalone map. Models and rates alternate deterministically. No rating,
  dan or curve differences; all 334 7K rated classifications consumed difficulty
  successfully. Twelve real-map results matched the upstream Node API exactly.
- The vendored bundle equals upstream v1.2.3 `dist/tag-engine.js` byte for byte.
  Upstream `npm test`: 57 passed; one optional updater test was skipped because
  its separate `.upstream` fixture was absent. This overlay's own integration
  is covered by the regression and browser checks.

## Performance on the local corpus

Node on the development Windows machine; two synthetic warm-up ratings per
engine; each real chart measured once, alternating engine order. Same texts,
models and rates; exact result equality was checked alongside timing.

| Mean per chart | Before optimization | After optimization |
|---|---:|---:|
| Rating | 149.5 ms | 109.8 ms |
| Rating + the same v1.2.3 classifier | 207.7 ms | 168.1 ms |

The upgraded pipeline is 19.1% faster than the unoptimized integration. This
comparison holds the **new classifier** fixed; it does not compare old and new
classification algorithms or promise these timings on every machine.

The optimizations reuse the column-independent recovery field for the mirror,
advance sorted window endpoints linearly, share interpolation operators and
build action-prefix moments once for both integration endpoints. No sampling,
model simplification or floating-point expression reordering is used.

## Browser checks

The actual overlay scripts were run in headless Chrome, with intercepted local
HTTP and websocket fixtures emulating tosu. Checked the rendered 430 px and
380 px layouts, primary percentages, live Detailed/Compact switching, one
rating pass per change, smoothing/resize invariance, Minimal/Compact styling,
DT timing, pause marker, original 4K/6K classification visibility, and the
visible numeric `< 0.50` label. Screenshots were visually inspected. The source
and fixture data were local; no dataset was uploaded.

### Tag display follow-up

The browser renderer checks that the “Burden” prefix is absent and Hybrid
masses 0.44/0.52 display as RC 46% / LN 54%. Additional pairs check 50/50,
33/67, 0/100 and 100/0; both absent masses show dashes rather than a fabricated
ratio. Rendering leaves the classifier output unchanged. Integer percentages
use complementary rounding, guaranteeing a displayed total of 100% whenever
the original pair has positive mass.

### Follow-up against the installed tosu v4.26.3

The real settings endpoint reproduced `ENOENT` for a nested installation's
missing settings parent. Its creation and migration of the old choices restored
the settings page. A second failure was reproduced: the initial socket used
only the leaf folder, while tosu's later injected full path changed the
`getSettings` payload, returning `Wrong overlay`. The full directory is now
derived before connection and held fixed. The browser fixture reproduces this
late-injection order, nested/space paths, settings errors and recovery.

The installed old version used Compact; the failed new settings load left
Detailed defaults. On the current local chart at NM these are 8.758589537484427
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
envelope coverage. This is expected from the upstream stable contract, not an
accuracy score. Local primary tags do not depend on the difficulty input; this
comparison uses the action-only call to avoid unnecessary repeated scoring. Reproduce it with:

```sh
node tests/local-tags.cjs ../dataset/spm_dataset-0.4.0
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
