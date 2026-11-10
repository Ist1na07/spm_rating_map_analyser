# Classifier source and integration

`tag_engine.js` is the complete, unmodified browser bundle from
[SPMTagClassifier v1.2.3](https://github.com/Ist1na07/SPMTagClassifier/tree/v1.2.3),
commit `6ed4e6b130e1e86ef48dcc01f191ac5aabddf8d0`, file `dist/tag-engine.js`.
MIT, copyright (c) 2026 Ist1na; see [LICENSE](LICENSE).

The overlay calls the stable 7K path. This retains the archived local expert
and confidence, apart from the selected Break/BPM repairs; the new integral
changes the whole-map decision and burden readout. Most segment labels should
therefore remain identical. The separate `modern` LN candidate is not the
accepted default and the upstream API rejects combining it with `ratingEvidence`.
All upstream entry points and model paths remain in the bundle; the overlay
continues to hide pattern classification on 4K/6K, preserving its existing interface.

`processMap(..., {includeTagEvidence:true})` additionally returns `tagEvidence`:
schema version 1, native keys, rate, post-rate-ms clock, the released model
identity, the exact physical head-row query, and the uncalibrated raw demand
field. Without this option its return contract is unchanged. These arrays come
from the same rating evaluation, before display calibration, 400 ms bucketing
or smoothing. No rating is performed inside the classifier. Model identities
are upstream protocol literals, not newly computed file digests.

`renderRating` passes this evidence to `TagClassifier.analyzeMap`. Both Detailed
and Compact changes update whole-map aggregation. Display-only settings retain
the cached analysis. Local-section confidence retains its previous meaning.

The UI reads `overall.labelPercentages` for selected tags and
`overall.percentages` for secondary branches, already on a 0–100 scale.
Hybrid displays `100 × rc / (rc + ln)` from `overall.familyMass` and its LN complement,
so the displayed pair sums to 100% and retains the original proportion to
integer rounding. The raw family masses and other tag percentages are unchanged.
The tag row has no “Burden” prefix; percentage meaning remains in tooltips. Empty tag
sets display “No dominant pattern” and retain the rating engine's family.

The continuous integral, support definition, LN interval union and exact
endpoint rules are documented in the pinned upstream
[perception contract](https://github.com/Ist1na07/SPMTagClassifier/blob/v1.2.3/docs/perception.md).
Detailed uses alpha=2, beta=1; Compact uses alpha=4, beta=1.5. Both use a 1000 ms
action window and hold credit 1. Branch shares overlap; they are not accuracy,
a normalized partition or elapsed-time shares.

To reproduce the vendored artifact, check out that upstream tag and copy
`dist/tag-engine.js` to the overlay's `tag_engine.js`. No build dependencies are
needed to run it. The optional corpus test checks exact source equality and
output parity against that checkout.
