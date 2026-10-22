/**
 * src/render3d/units/wading.js — wheeled and treaded vehicles sit low in the water while they wade [MM-task_mvj9xx7x_8].
 *
 * Owner 2026-10-22: "When units go in the water the wheels or treads should be mostly submerged." Ground units may
 * wade ponds (slowly — Story W / Faction-Terrain-Design §3); in the 3D view a vehicle on a water cell is drawn lowered
 * by WADE.submerge of its running-gear height, so the flat water-coloured ground hides most of its wheels or treads.
 * It eases down as it rolls in and back up as it climbs out, rather than popping.
 *
 * Running-gear height is read from the model's parts, like trackMarks.js reads the gauge: the top of its track loops,
 * else the top of its ground-touching wheels. Models with neither (infantry, walkers, hover craft) are left alone, and
 * so are water units (Swimmer / Floater — they float) and anything in the air.
 *
 * Render-only: it moves view.y, never the sim. Pure: no three.js.
 */
import { partBox } from './shadow.js';
import { UNIT_SCALE } from './modelKeys.js';

export const WADE = Object.freeze({
  submerge: 0.75,   // fraction of the wheel / tread height below the waterline — "mostly submerged"
  rate: 6,          // 1/s — exponential ease toward the target depth (≈ 0.4 s to settle)
  airborne: 0.02,   // a view higher than this is flying, never sunk
});

/** Height (model units) of a model's running gear — its track loops' top, else its ground wheels' top — or 0. */
export function gearHeightFor(def) {
  if (!def || !Array.isArray(def.parts) || def.hover || (def.deploy && def.deploy.legs)) return 0;
  const treads = def.parts.filter((p) => p.t === 'ext' && p.m === 'track' && Array.isArray(p.d));
  if (treads.length) return Math.max(...treads.map((p) => partBox(p)[1][1]));
  let top = 0, n = 0, mir = false;
  for (const p of def.parts) {
    if (p.ax !== 'z' || p.g || p.r3 || p.m === 'track') continue;
    const round = (p.t === 'cyl' && typeof p.r === 'number') || (p.t === 'ext' && Array.isArray(p.holes) && p.holes.length);
    if (!round) continue;
    const [mn, mx] = partBox(p);
    if (mn[1] > 0.06 || mx[1] - mn[1] < 0.2 || (!p.mir && Math.abs((mn[2] + mx[2]) / 2) < 0.05)) continue;
    top = Math.max(top, mx[1]); n++; mir = mir || !!p.mir;
  }
  return n >= 2 || mir ? top : 0;
}

/** { [modelKey]: gear height } for a whole model table. */
export function gearHeights(models) {
  const out = {};
  for (const [k, def] of Object.entries(models || {})) out[k] = gearHeightFor(def);
  return out;
}

/**
 * gear: gearHeights(UNIT_MODELS); isWater(x, z) → true over water (world coords); isWaterUnit(view) → true for
 * swimmers / floaters. apply(dt, views) lowers each wading view's y in place and marks it `wading`.
 */
export function createWading({ gear, isWater, isWaterUnit = () => false }) {
  const sink = new Map();   // unit id → current depth (world units)
  return {
    apply(dt, views) {
      const d = Math.max(0, Math.min(0.1, dt || 0));
      const ease = 1 - Math.exp(-WADE.rate * d);
      const seen = new Set();
      if (views) for (const v of views) {
        const h = gear[v.model] || 0;
        if (!h || (v.y || 0) > WADE.airborne || isWaterUnit(v)) continue;
        seen.add(v.id);
        const target = isWater(v.x, v.z) ? WADE.submerge * h * UNIT_SCALE * (v.scale || 1) : 0;
        let s = sink.has(v.id) ? sink.get(v.id) : target;   // first sighting: already settled (spawned or loaded in)
        s += (target - s) * ease;
        if (Math.abs(target - s) < 1e-4) s = target;
        sink.set(v.id, s);
        if (s > 0) { v.y = (v.y || 0) - s; v.wading = target > 0; }
      }
      for (const id of [...sink.keys()]) if (!seen.has(id)) sink.delete(id);
      return sink.size;
    },
    depth: (id) => sink.get(id) || 0,
    clear() { sink.clear(); },
  };
}
