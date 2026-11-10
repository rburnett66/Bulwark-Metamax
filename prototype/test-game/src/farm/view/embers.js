/**
 * src/farm/view/embers.js — the farm's harvest effect (Farming-Design §5.3; tech plan §3.1, §2.3 F7) [MM-story_mwabh2oc_j].
 *
 * Owner 2026-11-09: "When fruited they get harvested for full value and the particle effect looks like fire embers
 * floating up with noise in the 5 corresponding colors: white, green, blue, purple, gold."
 *
 *   · BURST — a HARVEST or HARVEST ALL that lands on a Fruited plot throws embers in the plot's pod level colour up off
 *     its 16 plant spots. Count, lifetime and rise come from POD_LEVELS[].embers (the signed-off scale prototype:
 *     tools/farming/scale.html): more, higher and longer per level. The count is the level's in full; only the pool
 *     (the tier's additive cap, BURST.poolShare of it) thins it, every plot of a HARVEST ALL alike.
 *   · IDLE — a Fruited plot lets a few embers drift up while it waits (1 a tick, 2 from Rare up, every IDLE.every s),
 *     capped per frame and kept to a share of the pool. Off in safe mode (F7: "safe mode covers the farm: no idle
 *     embers").
 *   · DEAD — a dead plot's harvest plays a small puff of grey-brown dust (the battle's dusty smoke and grit), no embers.
 *
 * No new particle engine: every particle goes through the battle's world-impact emitter (r.impacts.emit, impacts.js),
 * the embers on their own shade (EMBER_SHADE.farm: the level colour, value-noise drift, fade at the top). Pure apart
 * from that emitter: seeded per plot and cycle (never Math.random), so the same harvest throws the same embers.
 *
 * createFarmEmbers({ safe }) → { harvest(plots, o, impacts, K), step(dt, o, impacts, K), stats }
 *   plots   — the session's result `farm.plots`: [{ plot, kind: 'crop' | 'pods', level, cycle }]
 *   impacts — { emit, caps, counts } (the renderer's world-impact model)
 */
import { POD_LEVELS } from '../../data/farm.js';
import { plotState } from '../model.js';
import { plantSpots, FARM_Y } from './farmLayer.js';
import { EMBER_SHADE } from '../../render3d/fx/impacts.js';

/** The harvest burst (scale.html harvest(): y .3 + rand·.2, sideways ±.15, rise × (.7 … 1.5), life × (.6 … 1.4)). */
export const BURST = Object.freeze({ y: 0.3, yJit: 0.2, side: 0.3, riseJit: [0.7, 1.5], lifeJit: [0.6, 1.4], size: [0.05, 0.08], poolShare: 0.85 });
/** The idle embers over a waiting Fruited plot (scale.html: every .12 s, 1 or 2 from Rare up, rise .45, life 1.4). */
export const IDLE = Object.freeze({ every: 0.12, n: 1, nRare: 2, y: 0.45, rise: 0.45, life: 1.4, size: [0.045, 0.065], maxPerFrame: 16, poolShare: 0.4 });
/** A dead plot's harvest: a small puff of dry dust (alpha batch) and a little grit, grey-brown, no embers. */
export const DUST = Object.freeze({ puffs: 12, minPuffs: 6, dusty: 1.5, grit: 6, shade: 0.42, life: [1.0, 1.6], size: [0.12, 0.2], rise: [0.25, 0.55] });

const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
/** A pod level's ember look: { level, colour, col: [r, g, b], count, life, rise } (level 1 … 5; anything else → Common). */
export function emberParams(level) {
  const L = POD_LEVELS.find((x) => x.level === level) || POD_LEVELS[0];
  return { level: L.level, colour: L.colour, col: hexRgb(L.colour), count: L.embers.count, life: L.embers.life, rise: L.embers.rise };
}

const idNum = (id) => [...String(id)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
/** The seed of a plot's embers in one cycle (salt: burst / idle / dust apart). */
export function emberSeed(seed, plotId, cycle, salt = 0) {
  let h = Math.imul((seed >>> 0) ^ idNum(plotId), 0x85ebca6b) ^ Math.imul((cycle | 0) + 0x9e3779b9, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
/** mulberry32 — the embers' own seeded stream. */
function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lerp = (R, r) => r[0] + (r[1] - r[0]) * R();

/** Room left in the additive pool for the farm, as a share of the cap. */
function room(impacts, share) {
  const cap = (impacts.caps && impacts.caps.additive) || 0, used = (impacts.counts && impacts.counts.additive) || 0;
  return Math.max(0, Math.floor(cap * share) - used);
}

export function createFarmEmbers({ safe = false } = {}) {
  const idle = new Map();   // "plot:cycle" → the plot's idle stream
  let acc = 0;
  const stats = { burst: 0, idle: 0, dust: 0 };

  /** One ember from a plant spot of plot p. */
  function ember(R, emit, K, p, spot, look, { y, rise, life, size }) {
    const s = p.w / 8, t = p.h / 8;   // within the spot's own patch of the bed
    emit(K.EMBER, spot[0] + (R() * 2 - 1) * s, FARM_Y + y, spot[1] + (R() * 2 - 1) * t,
      (R() - 0.5) * BURST.side, rise, (R() - 0.5) * BURST.side, life, size, 0, EMBER_SHADE.farm, 0, 0, { col: look.col, ns: R() * 100 });
  }

  return {
    stats,
    /** The harvest effect for the plots a HARVEST / HARVEST ALL just took: a burst per Fruited plot, dust per dead one. */
    harvest(plots, o, impacts, K) {
      if (!impacts || !plots || !plots.length || !o.farm) return { embers: 0, dust: 0 };
      const density = (impacts.caps && impacts.caps.density) || 1;   // thins the dust; the embers are thinned by the pool only
      const crops = plots.filter((h) => h.kind === 'crop' && o.farm.plots[h.plot]);
      // the pool's budget: a HARVEST ALL of many Legendary plots thins every burst alike rather than starving the last
      const want = crops.map((h) => emberParams(h.level).count);
      const total = want.reduce((a, b) => a + b, 0), free = room(impacts, BURST.poolShare);
      const k = total > free ? free / total : 1;
      let nE = 0, nD = 0;
      crops.forEach((h, i) => {
        const p = o.farm.plots[h.plot], look = emberParams(h.level), spots = plantSpots(p), R = prng(emberSeed(o.seed, h.plot, h.cycle, 1));
        const n = Math.floor(want[i] * k);
        for (let j = 0; j < n; j++) {
          ember(R, impacts.emit, K, p, spots[j % spots.length], look, {
            y: BURST.y + R() * BURST.yJit, rise: look.rise * lerp(R, BURST.riseJit), life: look.life * lerp(R, BURST.lifeJit), size: lerp(R, BURST.size) });
        }
        nE += n;
      });
      for (const h of plots) {
        if (h.kind !== 'pods' || !o.farm.plots[h.plot]) continue;
        const p = o.farm.plots[h.plot], spots = plantSpots(p), R = prng(emberSeed(o.seed, h.plot, h.cycle, 3));
        for (let j = 0, c = Math.max(DUST.minPuffs, Math.round(DUST.puffs * density)); j < c; j++) {
          const sp = spots[Math.floor(R() * spots.length)];
          impacts.emit(K.SMOKE, sp[0] + (R() - 0.5) * 0.3, FARM_Y + 0.08, sp[1] + (R() - 0.5) * 0.3, (R() - 0.5) * 0.5, lerp(R, DUST.rise), (R() - 0.5) * 0.5,
            lerp(R, DUST.life), lerp(R, DUST.size), 0.6, DUST.shade, DUST.dusty);
          nD++;
        }
        for (let j = 0, c = Math.round(DUST.grit * density); j < c; j++) {
          const sp = spots[Math.floor(R() * spots.length)];
          impacts.emit(K.DUST, sp[0], FARM_Y + 0.05, sp[1], (R() - 0.5) * 1.2, 0.8 + R() * 1.2, (R() - 0.5) * 1.2, 0.5 + R() * 0.3, 0.025 + R() * 0.02);
          nD++;
        }
      }
      stats.burst += nE; stats.dust += nD;
      return { embers: nE, dust: nD };
    },
    /** Idle embers over every Fruited plot (none in safe mode), at most IDLE.maxPerFrame a frame. → embers emitted */
    step(dt, o, impacts, K) {
      if (safe || !impacts || !o || !o.farm) { idle.clear(); return 0; }
      acc += dt;
      if (acc < IDLE.every) return 0;
      acc = 0;   // one tick a frame at most: a stalled frame never floods the pool
      let left = Math.min(IDLE.maxPerFrame, room(impacts, IDLE.poolShare)), n = 0;
      const seen = new Set();
      const ids = Object.keys(o.farm.plots).sort((a, b) => +a.slice(1) - +b.slice(1));
      for (const id of ids) {
        const p = o.farm.plots[id];
        if (plotState(o, p) !== 'fruited') continue;
        const key = id + ':' + p.cycle;
        seen.add(key);
        let R = idle.get(key);
        if (!R) idle.set(key, (R = prng(emberSeed(o.seed, id, p.cycle, 2))));
        const look = emberParams(p.level), spots = plantSpots(p);
        for (let c = Math.min(left, p.level >= 3 ? IDLE.nRare : IDLE.n); c > 0; c--, left--, n++) {
          ember(R, impacts.emit, K, p, spots[Math.floor(R() * spots.length)], look, {
            y: IDLE.y + R() * BURST.yJit, rise: IDLE.rise * lerp(R, BURST.riseJit), life: IDLE.life * lerp(R, BURST.lifeJit), size: lerp(R, IDLE.size) });
        }
      }
      for (const key of idle.keys()) if (!seen.has(key)) idle.delete(key);
      stats.idle += n;
      return n;
    },
  };
}
