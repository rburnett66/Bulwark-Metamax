/**
 * src/save/replays.js — the replay of each recent battle, kept so a Battle History card can replay it
 * (tech plan docs/tech-plan/Outpost.md §8, story O8) [MM-story_mw5oeidu_p].
 *
 * Replays live in localStorage under 'bulwark:replays' as { v: 1, list: [{ at, log }] }, newest first, at most
 * KEEP of them. `at` is the battle-log entry's `at`, so a history card finds its replay by the same key.
 * `log` is the serialized replay log (src/sim/replay.js serializeLog). The old single 'bulwark:lastReplay'
 * migrates in as the newest entry with at 0 (no history card points at it, but "latest" still finds it).
 *
 * Pure over a Storage-like object ({ getItem, setItem, removeItem }) so it tests without a browser.
 */
export const REPLAYS_KEY = 'bulwark:replays';
export const LEGACY_KEY = 'bulwark:lastReplay';
export const KEEP = 20;
/** Bytes the store may take (UTF-16: 2 per char). Measured (O8): a compact replay is ~0.15 KB per command, so a
 *  100-command battle is ~15 KB and 20 of them ~0.3 MB; long battles drop the oldest replays to stay under this. */
export const BUDGET_BYTES = 1024 * 1024;

/** serializeLog pretty-prints (indent 2); stored compact it is about half the size. */
function compact(log) {
  try { return JSON.stringify(JSON.parse(log)); } catch (e) { return log; }
}

function readList(storage) {
  if (!storage) return [];
  let raw = null;
  try { raw = storage.getItem(REPLAYS_KEY); } catch (e) { return []; }
  if (raw) {
    try {
      const o = JSON.parse(raw);
      if (o && Array.isArray(o.list)) return o.list.filter((r) => r && typeof r.log === 'string' && Number.isFinite(r.at));
    } catch (e) { /* corrupt: start over */ }
    return [];
  }
  // migrate the single last replay (pre-O8 saves)
  let legacy = null;
  try { legacy = storage.getItem(LEGACY_KEY); } catch (e) { /* blocked */ }
  return legacy ? [{ at: 0, log: legacy }] : [];
}

function writeList(storage, list) {
  // storage full: drop the oldest until it fits (a replay is ~tens of KB; KEEP bounds the normal case)
  for (let n = list.length; n >= 1; n--) {
    try {
      storage.setItem(REPLAYS_KEY, JSON.stringify({ v: 1, list: list.slice(0, n) }));
      try { storage.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
      return n;
    } catch (e) { /* quota: try fewer */ }
  }
  return 0;
}

/** Keep `log` as the replay of the battle logged at `at`. Returns how many replays are now stored. */
export function storeReplay(storage, at, log, { keep = KEEP, budget = BUDGET_BYTES } = {}) {
  if (!storage || typeof log !== 'string' || !Number.isFinite(at)) return 0;
  const list = [{ at, log: compact(log) }, ...readList(storage).filter((r) => r.at !== at)].slice(0, keep);
  let bytes = 0, n = 0;
  for (const r of list) { bytes += (r.log.length + 24) * 2; if (n >= 1 && bytes > budget) break; n++; }
  return writeList(storage, list.slice(0, n));
}

/** The serialized replay of the battle logged at `at`, or null. */
export function replayFor(storage, at) {
  const r = readList(storage).find((x) => x.at === at);
  return r ? r.log : null;
}

/** The newest stored replay, or null. */
export function latestReplay(storage) {
  const l = readList(storage);
  return l.length ? l[0].log : null;
}

/** The `at` keys that have a replay (newest first). */
export function replayKeys(storage) {
  return readList(storage).map((r) => r.at);
}

/** Bytes the store takes (UTF-16 in localStorage, so 2 per char). */
export function replayBytes(storage) {
  try { const raw = storage.getItem(REPLAYS_KEY); return raw ? raw.length * 2 : 0; } catch (e) { return 0; }
}
