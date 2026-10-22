/**
 * src/render3d/quality.js — the 3D view's quality tiers (plan v2.2 §7.1) [MM-task_mv9s9p7h_4].
 *
 *   High      (desktop)                 DPR ≤ 2    shadow map 4096   live shadows   full ground
 *   Standard  (iPhone 12 / Pixel 6)     DPR ≤ 2    shadow map 2048   live shadows   full ground
 *   Low                                 DPR ≤ 1.5  shadow map 1024   no live shadows, half-resolution ground,
 *                                                                    effect cap 120
 *
 * Picked automatically at boot from what the browser reports (autoTier), unless the player chose one in
 * Settings — that choice is stored per device (localStorage) and wins; `?quality=` wins over both for testing.
 * Everything here is pure and node-tested; index.js applies the tier, main.js/hud.js offer the Settings menu.
 *
 * `impactCaps` is the world-impact particle budget (fx/impacts.js). Until 2026-10-18 it was never passed, so Low
 * devices ran the desktop budget [MM-task_mveeqkyi_h].
 */
import { DEFAULT_IMPACT_CAPS, LOW_IMPACT_CAPS } from './fx/impacts.js';

export const TIERS = Object.freeze({
  high: Object.freeze({
    key: 'high', label: 'High', dprCap: 2, shadowSize: 4096, liveShadows: true, trackCap: 2400,
    groundRes: 1, tufts: true, grassDetail: true, cloudDetail: true, effects: Object.freeze({ maxShots: 400, maxFlashes: 200 }), impactCaps: DEFAULT_IMPACT_CAPS,
  }),
  standard: Object.freeze({
    key: 'standard', label: 'Standard', dprCap: 2, shadowSize: 2048, liveShadows: true, trackCap: 1600,
    groundRes: 1, tufts: true, grassDetail: true, cloudDetail: false, effects: Object.freeze({ maxShots: 400, maxFlashes: 200 }), impactCaps: DEFAULT_IMPACT_CAPS,
  }),
  low: Object.freeze({
    // effect cap 120 = everything the combat FX layer may have alive at once (shots + flashes)
    key: 'low', label: 'Low', dprCap: 1.5, shadowSize: 1024, liveShadows: false, trackCap: 600,
    groundRes: 0.5, tufts: false, grassDetail: false, cloudDetail: false, effects: Object.freeze({ maxShots: 80, maxFlashes: 40 }), impactCaps: LOW_IMPACT_CAPS,
  }),
});
export const TIER_KEYS = Object.freeze(['high', 'standard', 'low']);
export const AUTO = 'auto';
export const QUALITY_LS_KEY = 'bw.quality3d';

const WEAK_GPU = /swiftshader|llvmpipe|software|mali-4|mali-t[67]|adreno \(tm\) [34]\d\d|powervr sgx/i;

/**
 * Pick a tier from what the browser reports. `env`:
 *   { mobile, deviceMemory, cores, maxTextureSize, gpu }   — any may be missing (Safari reports little)
 * Phones get Standard (the plan's iPhone 12 / Pixel 6 tier) unless they look weak; desktops get High unless
 * they look weak. Weak = a software or old GPU, ≤ 2 GB memory, ≤ 2 cores, or no 4096 texture support.
 */
export function autoTier(env = {}) {
  const weak = (env.gpu && WEAK_GPU.test(env.gpu))
    || (env.deviceMemory > 0 && env.deviceMemory <= 2)
    || (env.cores > 0 && env.cores <= 2)
    || (env.maxTextureSize > 0 && env.maxTextureSize < 4096);
  if (weak) return 'low';
  return env.mobile ? 'standard' : 'high';
}

/** A stored / query value → a tier key, AUTO, or null when it isn't one. */
export function parseTier(v) {
  if (typeof v !== 'string') return null;
  const k = v.trim().toLowerCase();
  return k === AUTO || TIER_KEYS.includes(k) ? k : null;
}

/**
 * Which tier to run: `?quality=` → the stored Settings choice → auto.
 * Returns { tier, key, source: 'query' | 'settings' | 'auto', choice } where `choice` is what Settings shows.
 */
export function resolveTier({ query = null, stored = null, env = {} } = {}) {
  const q = parseTier(query), s = parseTier(stored);
  const auto = autoTier(env);
  let key = auto, source = 'auto';
  if (q && q !== AUTO) { key = q; source = 'query'; }
  else if (s && s !== AUTO) { key = s; source = 'settings'; }
  return { tier: TIERS[key], key, source, choice: s || AUTO, auto };
}

/** Read / write the per-device Settings choice. Storage errors (private mode, full) never throw. */
export function loadChoice(storage) {
  try { return parseTier(storage && storage.getItem(QUALITY_LS_KEY)) || AUTO; } catch (e) { return AUTO; }
}
export function saveChoice(storage, choice) {
  const c = parseTier(choice) || AUTO;
  try { if (storage) storage.setItem(QUALITY_LS_KEY, c); } catch (e) { /* storage blocked */ }
  return c;
}

/** The pixel ratio to render at: the device's, capped by the tier. */
export function pixelRatioFor(tier, devicePixelRatio) {
  return Math.min(devicePixelRatio > 0 ? devicePixelRatio : 1, tier.dprCap);
}

/** The Settings menu entries: Auto (naming what it picked) + the three tiers. */
export function settingsOptions(autoKey) {
  return [{ value: AUTO, label: `Auto (${TIERS[autoKey].label})` }, ...TIER_KEYS.map((k) => ({ value: k, label: TIERS[k].label }))];
}

/** What the browser reports, for autoTier. Browser-only; every probe is guarded. */
export function probeEnv(win, gl) {
  const nav = (win && win.navigator) || {};
  let gpu = '';
  try {
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || '';
  } catch (e) { gpu = ''; }
  let mobile = false;
  try { mobile = !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || ''); } catch (e) { mobile = false; }
  let maxTextureSize = 0;
  try { maxTextureSize = (gl && gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0; } catch (e) { maxTextureSize = 0; }
  return { mobile, deviceMemory: nav.deviceMemory || 0, cores: nav.hardwareConcurrency || 0, maxTextureSize, gpu: String(gpu) };
}
