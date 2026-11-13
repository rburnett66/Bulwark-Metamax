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
  return safe ? { qualityQuery: 'low' } : {};
}

/** The renderer's load for a crumb: tier, pixel ratio, drawing buffer, live textures / geometries / shader programs. */
export function gpuLine(r) {
  try {
    const R = r.renderer, m = R.info.memory, size = R.getDrawingBufferSize(new r.THREE.Vector2());
    return `tier ${r.tier.key} · dpr ${R.getPixelRatio()} · ${size.x}×${size.y} · tex ${m.textures} · geo ${m.geometries} · prog ${(R.info.programs || []).length}`;
  } catch (e) { return 'gpu ?'; }
}
