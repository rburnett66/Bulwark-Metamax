/**
 * src/render/projFx.js — per-id projectile FX table: Shooting Gallery authoring → game.
 *
 * A unit's (or tower's) cosmetic shot look — kind/color/speed/size/cadence/burst —
 * authored in the gallery and consumed by renderer.emitCombatFx via renderer.projFx,
 * with the long-standing hardcoded recipes as the fallback for every id not in the
 * table. Two sources, same pattern as voxel decor:
 *   - SHIPPED:   content/fx/projectiles.json  { version, units: { id: entry } }  (committed → ships)
 *   - DEV-LIVE:  localStorage[PROJ_FX_LS_KEY]  { id: entry }                     (gallery saves; wins)
 *
 * Colors persist as '#rrggbb' strings (JSON-friendly), run as ints (sprite tint).
 * Pure + headless-testable: no DOM, no PIXI.
 */

export const PROJ_FX_LS_KEY = 'bulwark:gallery:projfx';

const KINDS = { shell: 1, flak: 1, tracer: 1 };

/** '#rrggbb' | 0xRRGGBB → int, or null if unparseable. */
export function fxColorToInt(c) {
  if (typeof c === 'number' && isFinite(c)) return c & 0xffffff;
  if (typeof c === 'string') {
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
    if (m) return parseInt(m[1], 16);
  }
  return null;
}

/** int → '#rrggbb' (for saving). */
export function fxColorToHex(c) {
  return '#' + ((typeof c === 'number' && isFinite(c) ? c : 0) & 0xffffff).toString(16).padStart(6, '0');
}

/**
 * Validate + clamp one authored entry into runtime shape. Unknown kinds and
 * out-of-range numbers are DROPPED field-wise (a half-bad entry keeps its good
 * fields); returns null when nothing survives.
 */
export function normalizeFxEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi) ? v : null;
  const out = {};
  if (KINDS[e.kind]) out.kind = e.kind;
  const color = fxColorToInt(e.color); if (color !== null) out.color = color;
  const speed = num(e.speed, 1, 60); if (speed !== null) out.speed = speed;
  const size = num(e.size, 0.25, 6); if (size !== null) out.size = size;
  const cadence = num(e.cadence, 0.05, 5); if (cadence !== null) out.cadence = cadence;
  const burst = num(e.burst, 1, 8); if (burst !== null) out.burst = Math.round(burst);
  return Object.keys(out).length ? out : null;
}

/** Shipped ∪ dev-live (local wins field-wise), every entry normalized. */
export function mergeProjFx(shippedUnits, localUnits) {
  const out = {};
  for (const src of [shippedUnits, localUnits]) {
    if (!src || typeof src !== 'object') continue;
    for (const id of Object.keys(src)) {
      const n = normalizeFxEntry(src[id]);
      if (n) out[id] = Object.assign(out[id] || {}, n);
    }
  }
  return out;
}

/** Runtime entry → JSON-friendly saved shape (color as hex string). */
export function serializeFxEntry(e) {
  const n = normalizeFxEntry(e);
  if (!n) return null;
  const out = { ...n };
  if (out.color !== undefined) out.color = fxColorToHex(out.color);
  return out;
}
