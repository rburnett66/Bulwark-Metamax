/**
 * src/render3d/fx/flashLights.js — EXPERIMENT: real point lights flashed on explosions and gunfire. [MM-task_mvd2lrig_k]
 *
 * Owner 2026-10-17: "we should experiment with point light flashed on explosions and firing". A small fixed pool of
 * THREE.PointLights lives in the scene at zero intensity (a fixed count, so no shader recompiles); each new combat
 * flash (muzzle, hit, kill, airburst, rocket hit, structure destroyed, base-cannon blast) pulses the light that is
 * dimmest right now: a hard attack and a fast falloff, sized and coloured by the flash. The units' Phong metal lights
 * per pixel; the low-poly ground (Lambert, per vertex) takes it as a soft glow.
 *
 * Budget by quality tier: high 4 lights, standard 2, low 0 (off). ?flashlights=N overrides (0 turns it off) — the
 * point of the experiment is to compare.
 */
export const FLASH_LIGHTS = Object.freeze({ high: 4, standard: 2, low: 0 });

/** How a flash of diameter `size` (cells) lights the scene: { intensity, distance, life }. Pure. */
export function lightFor(size, ttl) {
  return { intensity: Math.min(5.5, 0.9 + size * 0.95), distance: Math.min(6, 1.1 + size * 0.95), life: Math.max(0.06, (ttl || 0.1) * 1.4) };
}

export function createFlashLights(THREE, scene, count) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    const L = new THREE.PointLight(0xffffff, 0, 2, 2);
    L.castShadow = false; L.name = 'flash-light-' + i;
    scene.add(L);
    pool.push({ L, peak: 0, t: 0, life: 1 });
  }
  return {
    count,
    /** Pulse a light at (x, y, z). */
    pulse(x, y, z, color, intensity, distance, life) {
      if (!pool.length) return;
      let best = pool[0];
      for (const p of pool) if (p.L.intensity < best.L.intensity) best = p;
      if (best.L.intensity > intensity) return;   // everything brighter already — this one isn't worth a light
      best.L.position.set(x, y + 0.25, z); best.L.color.setHex(color); best.L.distance = distance;
      best.peak = intensity; best.t = 0; best.life = life; best.L.intensity = intensity;
    },
    /** Light the frame's NEW combat flashes (combatFxModel flashes with age 0). */
    fromFlashes(flashes) {
      if (!pool.length || !flashes) return;
      for (const f of flashes) {
        if (f.age !== 0 || f.size0 < 0.3) continue;
        const l = lightFor(f.size0, f.ttl);
        this.pulse(f.x, f.y, f.z, f.color, l.intensity, l.distance, l.life);
      }
    },
    update(dt) {
      for (const p of pool) {
        if (p.L.intensity <= 0) continue;
        p.t += dt;
        const u = p.t / p.life;
        p.L.intensity = u >= 1 ? 0 : p.peak * Math.pow(1 - u, 2.2);
      }
    },
    dispose() { for (const p of pool) scene.remove(p.L); pool.length = 0; },
  };
}
