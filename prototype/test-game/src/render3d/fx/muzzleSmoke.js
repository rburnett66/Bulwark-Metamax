/**
 * src/render3d/fx/muzzleSmoke.js — the gunsmoke a cannon round pushes out of the barrel. [MM-story_mvee3vj5_c]
 *
 * Owner 2026-10-18: "small as the barrel tip, a little velocity out from the barrel, then expand and dissipate."
 *   · BORN SMALL — each puff starts no wider than the muzzle (the tower barrel tip is ~0.12 world units across);
 *   · PUSHED OUT — it leaves along the barrel axis at a modest speed and drag stalls it a short way out;
 *   · EXPANDS + CLEARS — it then swells several times over while it fades (impactsView: SMOKE grows by
 *     size·(1 + grow·u·3) and its alpha falls with 1 − u).
 * Render-only: driven by the caller's jitter (a seeded PRNG), never Math.random, never the sim tick.
 */
export const MUZZLE_SMOKE = Object.freeze({
  count: 5,            // puffs per shell (× weapon scale k, at least 2)
  size: 0.05,          // birth size, world units — ≤ the barrel tip
  speed: [1.2, 2.2],   // outward speed along the barrel axis
  drag: 3.2,           // per-second velocity bleed: stalls ~0.4–0.7 out from the tip
  spread: 0.08,        // sideways jitter so the puffs don't stack
  rise: 0.06,          // a touch of lift
  life: [1.8, 2.6],    // seconds to clear
  grow: 2.4,           // ends ~8× its birth size
  shade: 0.84,         // pale gunsmoke
});

/**
 * Emit the forward puff for one shot.
 * @param emit  impacts.emit(kind, x,y,z, vx,vy,vz, life, size, grow, shade, dusty, drag)
 * @param SMOKE the SMOKE particle kind
 * @param m     firing point: x,y,z tip + dx,dy,dz unit barrel axis
 * @param k     weapon scale (shell 1, flak 0.75, tracer 0.35)
 * @param jit   () → [-0.5, 0.5) from a seeded PRNG
 */
export function emitMuzzleSmoke(emit, SMOKE, m, k, jit, S = MUZZLE_SMOKE) {
  const n = Math.max(2, Math.round(S.count * k));
  for (let i = 0; i < n; i++) {
    const v = S.speed[0] + (S.speed[1] - S.speed[0]) * (jit() + 0.5);
    const life = S.life[0] + (S.life[1] - S.life[0]) * (jit() + 0.5);
    emit(SMOKE,
      m.x + m.dx * 0.03, m.y + m.dy * 0.03, m.z + m.dz * 0.03,
      m.dx * v + jit() * S.spread, m.dy * v + S.rise + jit() * S.spread * 0.5, m.dz * v + jit() * S.spread,
      life, S.size * k, S.grow, S.shade, 0, S.drag);
  }
  return n;
}
