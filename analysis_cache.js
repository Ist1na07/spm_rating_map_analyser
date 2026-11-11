/* SPM Map Analyser — persistent, lossless analysis cache. MIT, Ist1na07. */
(function(root) {
    'use strict';
    const DB_NAME = 'SPMMapAnalyser.Analysis';
    const MODEL_REVISION = 'schema1|rating-v1.2.0|tag-b311c40';
    const request = r => new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    async function transaction(db, mode, work) {
        const tx = db.transaction(['meta', 'charts'], mode);
        const done = new Promise((resolve, reject) => {
            tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || Error('Cache transaction aborted'));
        });
        // Only await IndexedDB requests inside work: compression/hashing must
        // happen outside the transaction so it cannot auto-close while idle.
        try { const value = await work(tx); await done; return value; }
        catch (e) { try { tx.abort(); } catch {} await done.catch(() => {}); throw e; }
    }
    async function fingerprint(text) {
        const bytes = new TextEncoder().encode(text);
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
    }
    const clean = s => typeof s === 'string' ? s.trim() : '';
    function frame(data) {
        const bm = data.beatmap || {}, file = clean(data.directPath?.beatmapFile).replace(/\\/g, '/');
        // A bare filename is NOT a stable identity across song folders.
        const id = file.includes('/') ? JSON.stringify([clean(data.client), clean(data.folders?.songs), file.toLowerCase()]) : null;
        return {id, checksum:clean(bm.checksum), artist:clean(bm.artist), artistUnicode:clean(bm.artistUnicode),
            title:clean(bm.title), titleUnicode:clean(bm.titleUnicode), creator:clean(bm.mapper),
            version:clean(bm.version), beatmapId:Number(bm.id) || 0};
    }
    function matches(text, f) {
        const meta = {}; let section = '';
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (line === '[HitObjects]') break;
            if (line.startsWith('[')) { section = line; continue; }
            if (section !== '[Metadata]') continue;
            const colon = line.indexOf(':');
            if (colon >= 0) meta[line.slice(0,colon)] = line.slice(colon+1).trim();
        }
        for (const [values, expected] of [
            [[meta.Artist,meta.ArtistUnicode],[f.artist,f.artistUnicode]],
            [[meta.Title,meta.TitleUnicode],[f.title,f.titleUnicode]],
            [[meta.Creator],[f.creator]], [[meta.Version],[f.version]],
        ]) {
            const a = values.filter(Boolean), b = expected.filter(Boolean);
            if (a.length && b.length && !a.some(v => b.includes(v))) return false;
        }
        return !(f.beatmapId > 0 && Number(meta.BeatmapID) > 0 && f.beatmapId !== Number(meta.BeatmapID));
    }
    function snapshot(result, tags) {
        // Keep doubles and raw curves lossless. Exclude per-note difficulty
        // sensors, parsed notes, feature windows and research diagnostics.
        const {tagEvidence, ...rating} = result;
        const pick = s => Object.fromEntries(['start','end','tag','family','confidence','secondary','equivBpm']
            .filter(k => s[k] !== undefined).map(k => [k,s[k]]));
        return structuredClone({result:rating, tags:tags ? {
            map:{keys:tags.map.keys, firstNote:tags.map.firstNote, lastNote:tags.map.lastNote},
            segments:tags.segments.map(pick), overall:tags.overall, modelInfo:tags.modelInfo,
        } : null});
    }
    function validSnapshot(s) {
        const r = s?.result;
        return r && Number.isFinite(r.rating) && [4,6,7].includes(r.keyCount)
            && Array.isArray(r.sectionTimes) && Array.isArray(r.sectionDifficulties)
            && r.sectionTimes.length === r.sectionDifficulties.length
            && ['detail','compact'].includes(r.modelVariant)
            && ['direct','v051'].includes(r.subDifficultyScheme)
            && r.sectionTimes.every(Number.isFinite) && r.sectionDifficulties.every(Number.isFinite)
            && (!r.classified || (s.tags && Array.isArray(s.tags.segments) && s.tags.overall && s.tags.modelInfo));
    }
    function create({version, signature='', name=DB_NAME, maxBytes=64*1024*1024, maxCharts=1024, onUnavailable=()=>{}}) {
        let db, enabled = true, generation = 0, usable = true;
        let lastUsed = 0;
        const touch = () => lastUsed = Math.max(Date.now(), lastUsed+1);
        const identity = JSON.stringify([version, MODEL_REVISION, signature]);
        const fail = e => { usable = false; onUnavailable(e); return null; };
        const ready = (async () => {
            if (!version || !root.indexedDB || !root.CompressionStream || !root.DecompressionStream || !root.crypto?.subtle)
                throw Error('Local cache requires IndexedDB, compression and a secure localhost browser context');
            const opening = root.indexedDB.open(name, 1);
            opening.onupgradeneeded = () => {
                const database = opening.result;
                database.createObjectStore('meta');
                database.createObjectStore('charts', {keyPath:'id'}).createIndex('lastUsed','lastUsed');
            };
            db = await new Promise((resolve,reject) => {
                let blocked = false;
                opening.onblocked = () => { blocked = true; reject(Error('Local cache is blocked by another window')); };
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => { if (blocked) opening.result.close(); else resolve(opening.result); };
            });
            db.onversionchange = () => { db.close(); fail(Error('Local cache changed; reload this overlay')); };
            await transaction(db, 'readwrite', async tx => {
                const m = tx.objectStore('meta'), state = await request(m.get('state'));
                if (state?.identity !== identity) {
                    tx.objectStore('charts').clear();
                    m.clear(); m.put({identity, bytes:0},'state');
                }
            });
            return true;
        })().catch(fail);
        const stateOf = async tx => {
            const state = await request(tx.objectStore('meta').get('state'));
            // An older, still-open overlay must never repopulate a newer
            // version's database after the newer overlay cleared it.
            return state?.identity === identity ? state : null;
        };
        async function prune(tx, state) {
            const charts = tx.objectStore('charts');
            let count = await request(charts.count());
            if (count > maxCharts || state.bytes > maxBytes) await new Promise((resolve,reject) => {
                const cursor = charts.index('lastUsed').openCursor();
                cursor.onerror = () => reject(cursor.error);
                cursor.onsuccess = () => {
                    const c = cursor.result;
                    if (!c || (count <= maxCharts && state.bytes <= maxBytes)) return resolve();
                    state.bytes -= c.value.size; count--; c.delete(); c.continue();
                };
            });
            tx.objectStore('meta').put(state,'state');
        }
        async function clear() {
            if (!await ready || !usable) return;
            return transaction(db,'readwrite',async tx => {
                const state = await stateOf(tx); if (!state) return;
                tx.objectStore('charts').clear(); state.bytes = 0; tx.objectStore('meta').put(state,'state');
            }).catch(fail);
        }
        return {
            ready,
            get available() { return usable; },
            setEnabled(value) {
                enabled = !!value; generation++;
                return enabled ? Promise.resolve() : clear();
            },
            async get(id, digest, variant, isCurrent=()=>true) {
                if (!enabled || !id || !await ready || !usable || !isCurrent()) return null;
                try {
                    const row = await transaction(db,'readwrite',async tx => {
                        const state = await stateOf(tx); if (!state || !enabled || !isCurrent()) return null;
                        const charts = tx.objectStore('charts'), old = await request(charts.get(id));
                        if (!enabled || !isCurrent()) return null;
                        let chart = old;
                        if (!chart || chart.digest !== digest) {
                            // Edits invalidate EVERY model/rate/scheme of this file.
                            state.bytes -= old?.size || 0;
                            chart = {id,digest,variants:{},size:0};
                        }
                        chart.lastUsed = touch(); charts.put(chart); await prune(tx,state);
                        return chart.variants[variant] || null;
                    });
                    if (!row || !enabled || !isCurrent()) return null;
                    try {
                        const json = await new Response(new Blob([row]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
                        const value = JSON.parse(json);
                        if (!validSnapshot(value)) throw Error('Invalid analysis cache record');
                        return enabled && isCurrent() ? value : null;
                    } catch {
                        // Corruption is a miss. Delete the damaged file's cached
                        // variants, then allow the normal calculation to repair it.
                        await transaction(db,'readwrite',async tx => {
                            const state = await stateOf(tx); if (!state) return;
                            const charts = tx.objectStore('charts'), c = await request(charts.get(id));
                            if (c?.digest === digest) { state.bytes -= c.size; c.variants={}; c.size=0; charts.put(c); tx.objectStore('meta').put(state,'state'); }
                        });
                        return null;
                    }
                } catch (e) {
                    if (e.name === 'QuotaExceededError') await clear();
                    return fail(e);
                }
            },
            async put(id, digest, variant, value, isCurrent=()=>true) {
                const gen = generation;
                if (!enabled || !id || !await ready || !usable || !isCurrent()) return false;
                try {
                    const compressed = await new Response(new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
                    if (!enabled || gen !== generation || !isCurrent() || compressed.byteLength > maxBytes) return false;
                    return await transaction(db,'readwrite',async tx => {
                        const state = await stateOf(tx); if (!state || !enabled || gen !== generation || !isCurrent()) return false;
                        const charts = tx.objectStore('charts'), c = await request(charts.get(id));
                        // A later edit (possibly in another tab) owns the record.
                        if (!c || c.digest !== digest || !enabled || gen !== generation || !isCurrent()) return false;
                        const delta = compressed.byteLength - (c.variants[variant]?.byteLength || 0);
                        c.variants[variant]=compressed; c.size+=delta; c.lastUsed=touch(); state.bytes+=delta;
                        charts.put(c); await prune(tx,state); return true;
                    });
                } catch (e) {
                    // A full browser quota must not prevent rating. Free our
                    // own disposable cache; never touch other sites or settings.
                    if (e.name === 'QuotaExceededError') await clear();
                    fail(e); return false;
                }
            },
        };
    }
    root.SPMAnalysisCache = {create, fingerprint, frame, matches, snapshot, DB_NAME, MODEL_REVISION};
})(globalThis);
