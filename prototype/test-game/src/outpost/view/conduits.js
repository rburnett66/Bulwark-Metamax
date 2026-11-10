/**
 * src/outpost/view/conduits.js — the conduit routes and the outpost's scene plan, as data [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.3: the glowing double lines are generated, not modelled — a path along the
 * map's pad graph (map.conduits, O4) from each station to the buildings it feeds, drawn as two thin emissive tubes
 * with a light pulse running toward the building, dark when the building is unpowered; one merged mesh per state.
 * §6.2 states: building (rises in 4 steps, cool tint), upgrading (warm tint), unpowered (emissive off).
 *
 * Pure (no three.js): outpostScene.js turns these plans into meshes.
 */
import { powerGrids, bayCapacity, depositOf, upgradeBayShows } from '../model.js';
import { structureDef } from '../../data/outpost.js';
import { oresOf } from '../../data/ores.js';

export const TINT = Object.freeze({ building: [0.78, 0.9, 1.22], upgrading: [1.22, 1.12, 0.78], none: [1, 1, 1], off: [0.82, 0.82, 0.86] });

const centre = (p) => [p.x + p.w / 2, p.y + p.h / 2];

/** Where a straight line from a pad's centre toward (tx, tz) leaves the pad's square (cells). */
function edgeToward(p, tx, tz) {
  const [cx, cz] = centre(p), dx = tx - cx, dz = tz - cz;
  const k = Math.min(dx ? (p.w / 2) / Math.abs(dx) : Infinity, dz ? (p.h / 2) / Math.abs(dz) : Infinity);
  return [cx + dx * Math.min(1, k), cz + dz * Math.min(1, k)];
}

/**
 * A conduit's route from station pad `from` to pad `to`: a polyline of [x, z] points (cells, ground), leaving the
 * station's edge and arriving at the building's edge, with one right-angle bend (along the axis that differs most
 * first), so the lines read as laid along the walkways. → { points, length }
 */
export function conduitRoute(from, to) {
  const [ax, az] = centre(from), [bx, bz] = centre(to);
  const pts = [];
  if (Math.abs(bx - ax) < 0.6 || Math.abs(bz - az) < 0.6) {
    pts.push(edgeToward(from, bx, bz), edgeToward(to, ax, az));
  } else if (Math.abs(bx - ax) >= Math.abs(bz - az)) {
    // leave east / west, run along the station's row, turn at the building's column
    const sx = ax + Math.sign(bx - ax) * from.w / 2, ez = bz - Math.sign(bz - az) * to.h / 2;
    pts.push([sx, az], [bx, az], [bx, ez]);
  } else {
    const sz = az + Math.sign(bz - az) * from.h / 2, ex = bx - Math.sign(bx - ax) * to.w / 2;
    pts.push([ax, sz], [ax, bz], [ex, bz]);
  }
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { points: pts, length };
}

/**
 * The conduits to draw now: every map conduit whose station end holds a power station and whose other end holds a
 * building (built or under construction). → [{ from, to, points, length, powered }]. powered: the far end is on.
 */
export function planConduits(o, map) {
  const pads = new Map(map.pads.map((p) => [p.id, p]));
  const has = (id) => !!o.pads[id] || o.building.some((b) => b.pad === id);
  const isStation = (id) => o.pads[id] && o.pads[id].kind === 'power';
  const { powered } = powerGrids(o, map);
  const out = [];
  for (const [a, b] of map.conduits || []) {
    let from = a, to = b;
    if (!isStation(from) && isStation(to)) [from, to] = [to, from];
    if (!isStation(from) || !has(to) || !pads.get(from) || !pads.get(to)) continue;
    const route = conduitRoute(pads.get(from), pads.get(to));
    const on = isStation(to) ? true : powered.has(to) && !!o.pads[to];
    out.push({ from, to, ...route, powered: on && !!o.online });
  }
  return out;
}

/**
 * Each pad's look this frame: what stands on it and in which state.
 * → [{ pad, kind, tier, model: { kind, tier, rigHead }, rise, tint, glow, working, mk2, fill?, deep? }]
 * now: ms; fills: storage hologram height (0..1) for storage pads.
 */
export function planBuildings(o, map, now) {
  const { powered } = powerGrids(o, map);
  const rigs = Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig');
  let units = 0, cap = 0;
  for (const id of rigs) { units += Object.values(o.storage[id] || {}).reduce((a, b) => a + b, 0); cap += bayCapacity(o, id, map); }
  const fill = cap > 0 ? Math.min(1, units / cap) : 0;
  const hub = Object.keys(o.pads).find((id) => o.pads[id].kind === 'hub');
  const storage = Object.keys(o.pads).find((id) => o.pads[id].kind === 'storage');
  const coreOn = o.online && hub && powered.has(hub) && storage && powered.has(storage);
  const out = [];
  for (const p of map.pads) {
    const b = o.pads[p.id], job = o.building.find((x) => x.pad === p.id);
    if (!b && !job) continue;
    const kind = (b || job).kind;
    const rigHead = kind === 'rig' ? rigHeadFor(o, map, p.id) : null;
    const item = { pad: p.id, kind, tier: b ? b.tier : job.tier, rigHead, tint: TINT.none, rise: 1, glow: o.online ? 1 : 0.32, working: false, mk2: false };
    if (!b) {
      const def = structureDef(kind, job.tier), total = Math.max(1, (def ? def.buildSec : 1) * 1000);
      const progress = Math.max(0, Math.min(1, 1 - (job.done - now) / total));
      const step = Math.min(3, Math.floor(progress * 4));
      Object.assign(item, { tint: TINT.building, rise: 0.3 + 0.6 * (step / 3), glow: 0.2, building: true, progress });
    } else if (job) {
      Object.assign(item, { tint: TINT.upgrading, upgrading: true });
    }
    const on = kind === 'power' ? true : powered.has(p.id);
    if (b && !on) Object.assign(item, { glow: 0.05, tint: item.upgrading ? item.tint : TINT.off, unpowered: true });
    if (b && kind === 'rig') {
      const bayFull = Object.values(o.storage[p.id] || {}).reduce((a, c) => a + c, 0) >= bayCapacity(o, p.id, map) - 1e-6;
      item.working = !!(coreOn && on && !job && !bayFull);
      item.mk2 = b.tier >= 2;
      item.deep = !!b.deep;
      item.full = bayFull;
    }
    if (b && kind === 'storage') { item.fill = fill; item.working = !!coreOn; }
    if (b && kind === 'power') item.working = !!o.online;
    out.push(item);
  }
  return out;
}

/** The rig head (model) for a rig pad, from its deposit's ore. */
export function rigHeadFor(o, map, pad) {
  const tier = (o.pads[pad] && o.pads[pad].deposit) || depositOf(map, pad);
  const ore = oresOf(o.planet).find((x) => x.tier === tier);
  return ore ? ore.rig : 'auger';
}

/**
 * The deposits: [{ tier, pad, x, z (centre, cells), colour, ore, locked, mined (a rig stands on it) }].
 * unlockedTiers: the ore tiers the contracts have opened (contract.outpostUnlocks).
 */
export function planDeposits(o, map, unlockedTiers = ['common']) {
  const pads = new Map(map.pads.map((p) => [p.id, p]));
  return (map.deposits || []).map((d) => {
    const p = pads.get(d.pad), ore = oresOf(o.planet).find((x) => x.tier === d.tier);
    const [x, z] = p ? centre(p) : [d.x + 0.5, d.y + 0.5];
    const mined = !!(o.pads[d.pad] || o.building.some((b) => b.pad === d.pad && b.kind === 'rig'));
    return { tier: d.tier, pad: d.pad, x, z, colour: ore ? ore.colour : '#8a8f96', ore: ore ? ore.id : null, locked: !unlockedTiers.includes(d.tier), mined };
  });
}

/** Defense records the battle renderer's structure layer draws (system3d: STR-MG / Cannon / Wall). */
export function defenseStructures(o, map = null) {
  // the Upgrade Bay's pad (owner 2026-11-07: "the upgrade pad in the outpost should always show the unit being
  // upgraded"): the defense on the bay stands on its pad, off its cell; an idle bay shows the last unit it upgraded
  const bayId = Object.keys(o.pads || {}).sort().find((id) => o.pads[id].kind === 'upgradeBay');
  const pad = bayId && map && map.pads ? map.pads.find((p) => p.id === bayId) : null;
  const padSpot = pad ? { x: pad.x + pad.w - 1, y: pad.y + Math.floor(pad.h / 2) } : null;   // the pad's open right side, beside the hangar's craft
  const shows = pad ? upgradeBayShows(o) : null;
  const one = (d, tier, at, extra = {}) => {
    const def = structureDef(d.kind, tier), max = def && def.battle ? def.battle.hp : d.hp;
    return {
      id: 'od-' + d.id, kind: d.kind === 'wall' ? 'wall' : 'antiGround', structId: d.kind === 'mg' ? 'STR-MG' : d.kind === 'cannon' ? 'STR-Cannon' : 'STR-Wall',
      tier, cell: { x: at[0], y: at[1] }, pos: { x: at[0] + 0.5, y: at[1] + 0.5 }, footprint: { w: 1, h: 1 }, showHp: true,   // worn: bar always shown [MM-story_mwb8zbk7_24]
      // 0 HP: a wreck (charred, slumped, smoking) until a repair drone restores it [MM-story_mwb8zamf_23]
      hp: Math.min(d.hp, max), maxHp: max, lifecycle: !(d.hp > 0) ? 'Wrecked' : d.hp < max ? 'Damaged' : 'Active', outpostId: d.id, ...extra,
    };
  };
  const out = [];
  for (const d of o.defenses) {
    // on the bay it is the battle's 'Upgrading' tower: the warm tint (render3d lifecycleLook) [MM-story_mwb8zcgz_25]
    if (shows && shows.working && shows.id === d.id && padSpot) out.push(one(d, d.tier, [padSpot.x, padSpot.y], { onBay: true, lifecycle: 'Upgrading' }));
    else out.push(one(d, d.tier, d.cell));
  }
  if (shows && !shows.working && padSpot) {
    const d = o.defenses.find((x) => x.id === shows.id) || { id: 'show', kind: shows.kind, hp: Infinity };
    out.push(one({ ...d, id: 'bay-show' }, shows.tier, [padSpot.x, padSpot.y], { outpostId: null, showcase: true }));
  }
  return out;
}
