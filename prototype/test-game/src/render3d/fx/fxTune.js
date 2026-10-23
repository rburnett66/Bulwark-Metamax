/**
 * src/render3d/fx/fxTune.js — the LIVE tuning layer for battle effects [MM-story_mvk63439_o].
 *
 * Owner 2026-10-22: "I would also like to tune the particle effects we use for battle … create an effects test page I
 * can get to from settings … I also want to tune the target reticle for the base cannon."
 *
 * One mutable object, TUNE, that the effect code reads at USE time (not import time), so the Effects Lab (fxlab.html)
 * can change a knob and see it on the next particle. Defaults are exactly today's look, so with nothing saved the
 * game is unchanged. The Lab can SAVE its knobs to this browser (localStorage FX_TUNE_KEY) — the game then loads
 * them at start-up — and COPY them as JSON, so the values the owner settles on can be written back into the code.
 *
 *   impacts[kind] = { count, size, life }   multipliers per particle kind (impacts.js emit) — 1 = today
 *   mix           = how much of the faction colour each effect takes (factionFx.js FX_MIX)
 *   faction       = { GND: '#rrggbb' | null, … } overrides of FACTION_FX (absent = the code's colour)
 *   reticle       = the base super-cannon's target reticle (cannonFx.js view)
 *   shake         = camera-shake multiplier for booms
 *
 * Presentation only: the sim never reads this. No clocks, no randomness.
 */
import { FX_MIX, factionFxColor } from './factionFx.js';

export const FX_TUNE_KEY = 'bulwark:fxTune';

export const PARTICLE_KINDS = Object.freeze(['spark', 'fire', 'flash', 'ember', 'smoke', 'dust']);

/** Today's reticle, as the shader drew it before it was tunable. */
export const RETICLE_DEFAULTS = Object.freeze({
  color: '#ff4f30',   // ring, inner ring, cross and fill colour
  size: 1,            // × the real blast radius (1 = the disk is exactly what the shell hits)
  ring: 0.04,         // outer ring thickness, as a fraction of the radius
  inner: 0.7,         // inner ring strength (0 hides it)
  innerR: 0.45,       // inner ring radius, fraction of the radius
  cross: 0.8,         // cross-hair strength (0 hides it)
  fill: 0.1,          // disk fill opacity
  pulseFill: 0.08,    // extra fill at the top of each pulse
  pulseSpeed: 9,      // pulse rate (rad/s)
  pulseDepth: 0.35,   // how much the lines brighten with the pulse
  alpha: 1,           // overall opacity
});

export function defaultTune() {
  const impacts = {};
  for (const k of PARTICLE_KINDS) impacts[k] = { count: 1, size: 1, life: 1 };
  return { impacts, mix: { ...FX_MIX }, faction: {}, reticle: { ...RETICLE_DEFAULTS }, shake: 1 };
}

const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
const HEX = /^#[0-9a-f]{6}$/i;

/** Merge saved overrides onto the defaults, clamping every number to a sane range (a bad save can't break a battle). */
export function mergeTune(saved) {
  const t = defaultTune();
  if (!saved || typeof saved !== 'object') return t;
  for (const k of PARTICLE_KINDS) {
    const s = saved.impacts && saved.impacts[k];
    if (s) for (const f of ['count', 'size', 'life']) t.impacts[k][f] = num(s[f], 0, 5, 1);
  }
  if (saved.mix) for (const k of Object.keys(t.mix)) t.mix[k] = num(saved.mix[k], 0, 1, t.mix[k]);
  if (saved.faction) for (const [k, v] of Object.entries(saved.faction)) if (v === null || HEX.test(v)) t.faction[k] = v;
  if (saved.reticle) {
    const r = saved.reticle, R = RETICLE_DEFAULTS;
    if (HEX.test(r.color || '')) t.reticle.color = r.color;
    t.reticle.size = num(r.size, 0.2, 3, R.size); t.reticle.ring = num(r.ring, 0.005, 0.3, R.ring);
    t.reticle.inner = num(r.inner, 0, 1, R.inner); t.reticle.innerR = num(r.innerR, 0.1, 0.9, R.innerR);
    t.reticle.cross = num(r.cross, 0, 1, R.cross); t.reticle.fill = num(r.fill, 0, 1, R.fill);
    t.reticle.pulseFill = num(r.pulseFill, 0, 1, R.pulseFill); t.reticle.pulseSpeed = num(r.pulseSpeed, 0, 40, R.pulseSpeed);
    t.reticle.pulseDepth = num(r.pulseDepth, 0, 1, R.pulseDepth); t.reticle.alpha = num(r.alpha, 0, 1, R.alpha);
  }
  t.shake = num(saved.shake, 0, 3, 1);
  return t;
}

/** Only what differs from the defaults — what Save stores and Copy shows. */
export function diffTune(t) {
  const d = defaultTune(), out = {};
  for (const k of PARTICLE_KINDS) for (const f of ['count', 'size', 'life']) {
    if (t.impacts[k][f] !== d.impacts[k][f]) ((out.impacts = out.impacts || {})[k] = out.impacts[k] || {})[f] = t.impacts[k][f];
  }
  for (const k of Object.keys(d.mix)) if (t.mix[k] !== d.mix[k]) (out.mix = out.mix || {})[k] = t.mix[k];
  if (Object.keys(t.faction).length) out.faction = { ...t.faction };
  for (const k of Object.keys(d.reticle)) if (t.reticle[k] !== d.reticle[k]) (out.reticle = out.reticle || {})[k] = t.reticle[k];
  if (t.shake !== 1) out.shake = t.shake;
  return out;
}

function readSaved() {
  try { const s = globalThis.localStorage && globalThis.localStorage.getItem(FX_TUNE_KEY); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}

/** THE live tuning object. Loaded once from this browser's saved knobs (none → today's look). */
export const TUNE = mergeTune(readSaved());

/** Replace TUNE's contents in place (every reader keeps its reference). */
export function setTune(next) {
  const m = mergeTune(next);
  for (const k of Object.keys(m)) TUNE[k] = m[k];
  return TUNE;
}

export function saveTune(t = TUNE) {
  try { globalThis.localStorage.setItem(FX_TUNE_KEY, JSON.stringify(diffTune(t))); return true; } catch (e) { return false; }
}
export function clearSavedTune() {
  try { globalThis.localStorage.removeItem(FX_TUNE_KEY); return true; } catch (e) { return false; }
}

/** '#rrggbb' → [r, g, b] in 0..1. */
export function hexToRgb(h) {
  const n = parseInt(String(h).slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex(c) {
  return '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
}

/** The faction effect colour for a unit id with the Lab's override applied ('#hex' wins; null = classic look). */
export function tunedFactionColor(unitId) {
  if (typeof unitId === 'string') {
    const i = unitId.indexOf('-'), k = i > 0 ? unitId.slice(0, i) : null;
    if (k && Object.prototype.hasOwnProperty.call(TUNE.faction, k)) return TUNE.faction[k] ? hexToRgb(TUNE.faction[k]) : null;
  }
  return factionFxColor(unitId);
}
