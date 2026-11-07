/**
 * src/outpost/view/harvestDrive.js — the Resource Bay's harvesters on screen: where each truck is at a moment of its
 * trip, as data [MM-story_mw5oem5o_r] (story O10; design docs/16 Bulwark MM/design/Outpost-Design.md §6).
 *
 * The model (src/outpost/model.js harvestPlan) says which field each harvester works and how fast it brings units
 * home; this module turns that into a looping trip the view draws with the battle's own harvester (the System miner,
 * artKey SYS-Harvester, driven by the battle renderer like a sim unit): drive out along the route, pull at the field,
 * drive back, unload at the bay. The timings are the battle harvester's (data/outpost.js harvestRates): its speed,
 * capacity / the tier's pull rate, HARVESTER_UNLOAD_TIME. The trip is presentation only; the hopper's numbers are the
 * model's closed form.
 *
 * Pure: no DOM, no three.js, no clock. The view passes its own animation clock (seconds), never the wall clock.
 */

/** Cumulative lengths along a route of cells [{ x, y }] → { lens: [0, …], total }. */
export function routeLengths(route) {
  const lens = [0];
  for (let i = 1; i < route.length; i++) lens.push(lens[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y));
  return { lens, total: lens[lens.length - 1] || 0 };
}

/** The point at distance d along a route (clamped to its ends). */
export function pointAlong(route, lens, d) {
  if (!route.length) return { x: 0, y: 0 };
  if (d <= 0 || route.length === 1) return { x: route[0].x, y: route[0].y };
  for (let i = 1; i < route.length; i++) {
    if (d <= lens[i] || i === route.length - 1) {
      const seg = lens[i] - lens[i - 1], f = seg > 0 ? Math.min(1, (d - lens[i - 1]) / seg) : 1;
      return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * f, y: route[i - 1].y + (route[i].y - route[i - 1].y) * f };
    }
  }
  const last = route[route.length - 1];
  return { x: last.x, y: last.y };
}

/**
 * One trip's phases, in seconds: { go, pull, back, unload, total }. rates: data/outpost.js harvestRates();
 * tier: 'common' | 'uncommon'; length: the route's length in cells.
 */
export function tripTimes(rates, tier, length) {
  const drive = length / Math.max(0.1, rates.speed);
  const pull = rates.capacity / Math.max(1e-6, rates.pull[tier] || 1);
  return { go: drive, pull, back: drive, unload: rates.unload, total: drive * 2 + pull + rates.unload };
}

/**
 * Where a harvester is at clock time t (s): { x, y (cells, on the route), phase: 'go' | 'pull' | 'back' | 'unload',
 * cargo (0..1) }. offset (s) staggers the fleet so the trucks do not move in step. A route of one cell parks there.
 */
export function harvesterPose(route, t, times, offset = 0) {
  const { lens, total } = routeLengths(route);
  const T = Math.max(1e-6, times.total);
  let u = ((t + offset) % T + T) % T;
  if (u < times.go) return { ...pointAlong(route, lens, total * (u / Math.max(1e-6, times.go))), phase: 'go', cargo: 0 };
  u -= times.go;
  if (u < times.pull) return { ...pointAlong(route, lens, total), phase: 'pull', cargo: u / Math.max(1e-6, times.pull) };
  u -= times.pull;
  if (u < times.back) return { ...pointAlong(route, lens, total * (1 - u / Math.max(1e-6, times.back))), phase: 'back', cargo: 1 };
  return { ...pointAlong(route, lens, 0), phase: 'unload', cargo: 1 - (u - times.back) / Math.max(1e-6, times.unload) };
}

/**
 * The fleet as battle-renderer units (state.units entries) at clock time t: the System miner model the battle draws
 * for its harvesters. plan: model.harvestPlan(); routes: { [i]: [{ x, y }] } (bay → field, cells); running: the bay
 * is powered (else the trucks wait at the bay). → [{ id, unitId, artKey, isHarvester, domain, pos, hp, maxHp, state }]
 */
export function harvesterUnits(plan, routes, rates, t, { running = true } = {}) {
  return plan.map((h) => {
    const route = routes[h.i] || [{ x: h.from[0] - 0.5, y: h.from[1] - 0.5 }];
    const times = tripTimes(rates, h.tier, routeLengths(route).total);
    const p = running ? harvesterPose(route, t, times, (h.i * times.total) / Math.max(1, plan.length) + h.i * 3.7)
      : { ...route[0], phase: 'idle', cargo: 0 };
    return {
      id: `oh${h.i}`, unitId: 'GND-Trucks', artKey: 'SYS-Harvester', isHarvester: true, domain: 'Walker',
      pos: { x: p.x, y: p.y }, hp: 120, maxHp: 120, state: p.phase, cargo: p.cargo, tier: h.tier, targetId: null,
    };
  });
}
