# Reopen a chart without recalculating it

**Local Analysis Cache** is on by default in v1.2.2. After the first successful
analysis, the header shows **Saved**. Select another chart, then return: **Cached**
means both the rating and tag engines were skipped. Curves, live sections and
dan labels still use the current display settings.

The cache lives on local disk in the browser's IndexedDB database
`SPMMapAnalyser.Analysis`, under the overlay's web origin. It survives page
reloads and browser restarts. It is not a folder of JSON files in the plugin
directory and is not uploaded. Different browser profiles, OBS browser storage
and different web origins have separate caches.

## Edits and upgrades remove obsolete data

- Every lookup re-fetches the current `.osu` with HTTP caching disabled and
  computes a SHA-256 content fingerprint. Any file-content change deletes **all**
  previous model/rate/sub-difficulty variants for that file before lookup.
  This works even when tosu's checksum has not changed yet. Returning from the
  editor or refocusing the overlay also revalidates the file.
- Identity uses the game client, songs root and folder-qualified
  `directPath.beatmapFile`, not a bare filename or beatmap ID. The response's
  title/artist/difficulty/mapper/ID are checked against the requesting frame
  when provided. A different song's response or an obsolete asynchronous
  request cannot be shown or saved as the current chart.
- On startup, the analyser reads its version from `metadata.txt`. A changed
  version, cache/model revision or loaded dan-table configuration clears the
  old cache. An older open page cannot write into a newer version's cache.
- Detailed/Compact, exact speed rate and Direct/Legacy sub-difficulty scheme
  have separate entries. Colours, UI style, smoothing and dan-label style do
  not invalidate numerical results.

The `.osu` read and fingerprint remain necessary on a hit; scoring and pattern
classification do not run. This deliberately differs from a checksum-only
shortcut, which could reuse obsolete results after editing.

## Compact storage without changing numbers

Each variant is a **gzip-compressed binary snapshot**. It includes headline
ratings/dans, unsmoothed curves and the tag/segment fields consumed by the UI.
It omits note lists, raw per-note demand sensors, feature windows and research
diagnostics. JSON round trips retain JavaScript double precision; no Float32
quantization, curve sampling or percentage rounding is introduced.

Compressed payloads are bounded to **64 MiB and 1024 charts**, with the least
recently used charts removed first. Browser database bookkeeping adds some
overhead beyond the payload limit. A file edit replaces its old variants rather
than accumulating another copy of the same file.

## Turn it off or recover from unavailable storage

Turning **Local Analysis Cache** off clears this analyser's saved data and
bypasses further reads/writes; it does not touch tosu's settings or beatmaps.
Turning it back on saves subsequent analyses again.

**No cache** means local storage is unavailable; hover the label for the reason.
Rating still works normally. Typical causes are blocked browser storage or a
tosu frame without a folder-qualified path. Damaged gzip records are discarded
and recomputed. A quota failure clears only this disposable cache and continues
without caching. After fixing browser storage permissions, reload the overlay.

## Maintenance and verification

`analysis_cache.js` owns persistence and the snapshot format. Bump
`MODEL_REVISION` when changing engines or cache semantics during same-version
development. The renderer restores `SPMEngine.setDanVariant` on a hit because
skipping `processMap` must not leave the previous model's implicit dan table
active. Only successful, complete rating + classification results are saved.

Run `node --test tests/cache.test.cjs` and the test-only Playwright script
`node tests/browser-cache.cjs [local-chart.osu ...]`. The latter checks actual
disk persistence across a full Chrome restart, edits, variants, version cleanup,
race rejection, gzip recovery, LRU limits and denied/full storage. See
[TESTING.md](TESTING.md) for measured local results.

The design references LeoBlack's [LRU result cache](https://github.com/LeoBlackMT/osumania_map_analyser/blob/6ece25fd5d7de97797822b240cb40759a200053a/ManiaMapAnalyser%20by%20Leo_Black/js/app/core/resultCache.js)
and [request-identity/cache lessons](https://github.com/LeoBlackMT/osumania_map_analyser/blob/6ece25fd5d7de97797822b240cb40759a200053a/docs/learnings/beatmap-identity-cache.md).
This implementation adds compressed disk persistence and verifies actual file
contents before reuse.
