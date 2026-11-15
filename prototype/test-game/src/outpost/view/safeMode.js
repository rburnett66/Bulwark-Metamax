/**
 * src/outpost/view/safeMode.js — the outpost's safe mode on a phone that lost the tab [MM-story_mwf40d9i_1].
 *
 * First built for the old outpost view (2ede08e, iPhone report v2026.11.09-e); the one-view move (cd8e27d) dropped it,
 * and the iPhone tab died ~4 s into every visit again (owner report v2026.11.12-y). Once a visit is cut short on a
 * device (errorLog.lastSessionCrashed) the outpost opens at the Low tier, with only the lightest building LOD and no
 * rail pictures rendered from the GLBs, from then on (localStorage bulwark.outpostSafe; ?quality= still wins).
 */
import { lastSessionCrashed } from '../../diag/errorLog.js';

export const SAFE_KEY = 'bulwark.outpostSafe';
/** The building LODs safe mode loads (the lightest only). */
export const SAFE_LODS = Object.freeze([2]);

/** Is the outpost in safe mode on this device? A visit cut short turns it on for good. */
export function outpostSafeMode(win, crashed = lastSessionCrashed) {
  let on = false;
  try { on = win.localStorage.getItem(SAFE_KEY) === '1'; } catch (e) { /* no storage */ }
  if (!on && crashed()) {
    on = true;
    try { win.localStorage.setItem(SAFE_KEY, '1'); } catch (e) { /* no storage: safe for this load only */ }
  }
  return on;
}

/**
 * The outpost's render3d quality override: a forced tier (opts.tier), else Low in safe mode, else nothing — so the
 * page's ?quality= and the Settings choice apply as they do in a battle. → { qualityQuery } or {}
 */
export function outpostQuality({ tier = null, safe = false, query = null } = {}) {
  if (tier) return { qualityQuery: tier };
  if (query) return {};                       // ?quality= wins over safe mode (the headless checks force a tier)
  // safe mode: Low, and lean drawing buffers (no MSAA, 1× pixels, 512 shadow map) — iPhone 2026-11-14 [MM-task_mwfvyhev_1o]
  return safe ? { qualityQuery: 'low', lean: true } : {};
}

/** The renderer's load for a crumb: tier, pixel ratio, drawing buffer, live textures / geometries / shader programs. */
export function gpuLine(r) {
  try {
    const R = r.renderer, m = R.info.memory, size = R.getDrawingBufferSize(new r.THREE.Vector2());
    return `tier ${r.tier.key} · dpr ${R.getPixelRatio()} · ${size.x}×${size.y} · tex ${m.textures} · geo ${m.geometries} · prog ${(R.info.programs || []).length}`;
  } catch (e) { return 'gpu ?'; }
}

/**
 * A fresh page for the outpost (iPhone v2026.11.13-n [MM-task_mwh8pl3c_1x]): every safe-mode visit opened within ~20 s
 * of a page load ran; the ones opened after 23 min or an hour on the menu were killed at frame 1. So in safe mode, an
 * open later than FRESH_MS after the page loaded reloads the page first (FRESH_KEY in sessionStorage says where to go)
 * and the menu opens the outpost as soon as it is up again.
 */
export const FRESH_KEY = 'bulwark.openOutpost';
export const FRESH_MS = 20_000;
const FRESH_TTL_MS = 60_000;   // a request older than this (a reload that never finished, an old tab) is dropped

/** Should this open go through a fresh page first? (fresh: it is the open that the reload asked for.) */
export function needsFreshPage({ safe = false, sinceLoadMs = 0, fresh = false } = {}) {
  return !!safe && !fresh && sinceLoadMs > FRESH_MS;
}
/** Note the open for the next page load. → true when it was stored (no sessionStorage: open here instead). */
export function requestFreshOpen(win, { planet, tab = 'outpost' }, now) {
  try { win.sessionStorage.setItem(FRESH_KEY, JSON.stringify({ planet, tab, at: now })); return true; } catch (e) { return false; }
}
/** The open a reload asked for, taken once (removed as it is read) → { planet, tab } or null. */
export function takeFreshOpen(win, now) {
  let v = null;
  try { const raw = win.sessionStorage.getItem(FRESH_KEY); win.sessionStorage.removeItem(FRESH_KEY); v = raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  if (!v || typeof v.planet !== 'string' || !(now - v.at >= 0 && now - v.at < FRESH_TTL_MS)) return null;
  return { planet: v.planet, tab: v.tab === 'farm' ? 'farm' : 'outpost' };
}
