# Classifier source and integration

`tag_engine.js` is the complete, unmodified `dist/tag-engine.js` from
[SPMTagClassifier commit 184408e](https://github.com/Ist1na07/SPMTagClassifier/blob/184408e3154e082946a4c2355e724daa118fb0e9/dist/tag-engine.js),
full commit `184408e3154e082946a4c2355e724daa118fb0e9`. Its package version is **1.2.4**,
but this commit includes the subsequent unreleased local-expert retune; the
published v1.2.4 tag is not an equivalent source. MIT, copyright (c) 2026 Ist1na;
see [LICENSE](LICENSE). The analyser version remains **v1.2.1**.

## Default 7K now uses the retuned local expert

The overlay calls the stable path without `classic` or `modern` overrides.
The selected original 56-dimensional RC/LN W/b parameters are
`original56-joint-fixed-ridge01`: fixed gain 1.4, ridge 0.1. The old reference
predictor remains fixed as the whole-map integral prior, matching upstream's
training/deployment contract. Unlike the previous v1.2.3 integration, local
scores and labels can change.

The same pinned build also includes the LN Wildcard low-fit rest exemption,
static-hand false chordstream exclusion under both thumb assignments, and
stable within-type cadence plateaus (including 150/200 and DT225/300 BPM).
`aggregation:'classic'` keeps the archived local expert and its earlier
aggregation path. `modern` remains a separate opt-in LN candidate; upstream
rejects combining it with `ratingEvidence`. All upstream entry points remain
in the bundle. The overlay still displays pattern classification only on 7K.

## Reuse the same rating evaluation

`processMap(..., {includeTagEvidence:true})` additionally returns `tagEvidence`:
schema version 1, native keys, rate, post-rate-ms clock, released model identity,
the exact physical head-row query, and the uncalibrated raw demand field.
Without this option its return contract is unchanged. These arrays come from
the same rating evaluation, before display calibration, 400 ms bucketing or
smoothing. No rating is performed inside the classifier. Model identities are
upstream protocol literals, not newly computed file digests.

`renderRating` passes this evidence to `TagClassifier.analyzeMap`. Both Detailed
and Compact changes update whole-map aggregation. Display-only settings retain
the cached analysis. Local-section confidence still displays the classifier's
`segment.confidence`, including Wildcard classes without a matching integral
branch; it is not replaced with a fabricated zero.

## Keep the overlay's percentage presentation

The UI reads `overall.labelPercentages` for selected tags and
`overall.percentages` for secondary branches, already on a 0–100 scale.
Hybrid displays `100 × rc / (rc + ln)` from `overall.familyMass` and its LN
complement. Complementary integer rounding makes the displayed pair sum to
100%; raw family masses and other tag percentages are unchanged. There is no
“Burden” prefix. Empty tag sets display “No dominant pattern” and retain the
rating engine's family.

The continuous integral, support definition, LN interval union and exact
endpoint rules are in the pinned [perception contract](https://github.com/Ist1na07/SPMTagClassifier/blob/184408e3154e082946a4c2355e724daa118fb0e9/docs/perception.md).
Detailed uses alpha=2, beta=1; Compact uses alpha=4, beta=1.5. Both use a 1000 ms
action window and hold credit 1. Concrete branch percentages can overlap; they
are not accuracy, elapsed-time shares or a normalized partition.

To reproduce the vendored artifact, copy `dist/tag-engine.js` from the exact
commit above. Runtime source is sufficient; research datasets and Git history
are not needed. The optional corpus test checks exact bundle equality and
Node/browser output parity against that source directory.
