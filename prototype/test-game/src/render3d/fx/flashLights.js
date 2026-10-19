/**
 * src/render3d/fx/flashLights.js — FAKE light flashes: a short additive glow on the ground under every combat flash.
 * [MM-story_mvehp8ca_l] (replaces the point-light experiment of [MM-task_mvd2lrig_k])
 *
 * Owner 2026-10-18: "The old system had an effective fake flash .. to preserve performance". The experiment kept a pool
 * of THREE.PointLights in the scene; even at zero intensity every one of them adds per-pixel lighting work to every lit
 * fragment — the cost a phone feels. Instead each NEW combat flash (muzzle, hit, kill, airburst, rocket hit, structure
 * destroyed, base-cannon blast) lays a warm POOL decal in the world-impacts additive batch: no lights, no new draw
 * call, no shader change. It reads as the flash lighting the ground: sized and coloured by the flash, gone in about
 * its own lifetime, weaker the higher the flash is off the ground (a flak airburst barely touches it).
 */

/** Smallest flash (diameter, cells) that lays a glow — tiny tracer pops don't. */
export const FAKE_FLASH = Object.freeze({ minSize: 0.3, radiusK: 0.75, maxRadius: 3.2, lifeK: 2.2, minLife: 0.12, alpha: 0.75, fadeHeight: 3 });

/** The glow a flash of diameter `size` (cells), lifetime `ttl` (s) at height `y` lays: { r, life, a } — or null. Pure. */
export function glowFor(size, ttl, y = 0, F = FAKE_FLASH) {
  if (!(size >= F.minSize)) return null;
  const a = F.alpha * Math.max(0, 1 - Math.max(0, y) / F.fadeHeight) * Math.min(1, 0.45 + size * 0.25);
  if (a <= 0.02) return null;
  return { r: Math.min(F.maxRadius, size * F.radiusK), life: Math.max(F.minLife, (ttl || 0.1) * F.lifeK), a };
}

const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/**
 * createFlashGlows(impacts) → { fromFlashes(flashes) }: lays a glow (impacts.glowAt) for each flash with age 0 —
 * call once per frame after the combat fx update.
 */
export function createFlashGlows(impacts) {
  return {
    fromFlashes(flashes) {
      if (!flashes || !impacts || !impacts.glowAt) return 0;
      let n = 0;
      for (const f of flashes) {
        if (f.age !== 0) continue;
        const g = glowFor(f.size0, f.ttl, f.y);
        if (!g) continue;
        impacts.glowAt(f.x, f.z, g.r, g.life, hexRGB(f.color == null ? 0xffd090 : f.color), g.a);
        n++;
      }
      return n;
    },
  };
}
