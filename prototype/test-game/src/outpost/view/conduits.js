/**
 * src/outpost/view/conduits.js — the conduit routes and the outpost's scene plan, as data [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.3: the glowing double lines are generated, not modelled — derived from the
 * power grid (One Battle UX §5.2 [MM-story_mwc9plas_2h]: each grid's minimum spanning tree plus a branch to each
 * building, never the map's authored pad graph), drawn as two thin emissive tubes
 * with a light pulse running toward the building, dark when the building is unpowered; one merged mesh per state.
 * §6.2 states: building (rises in 4 steps, cool tint), upgrading (warm tint), unpowered (emissive off).
 *
 * Pure (no three.js): outpostScene.js turns these plans into meshes.
 */
import { powerGrids, unlitChains, bayCapacity, depositOf, upgradeBayShows, buildingRect } from '../model.js';
import { structureDef, DEFENSE_KINDS } from '../../data/outpost.js';
import { POWER_NODE_KINDS } from '../../data/outpostStructures.js';
import { oresOf } from '../../data/ores.js';
import { buildNavGrid, findWalkerPath } from '../../sim/pathfinding.js';

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
  return withLength(pts);
}
function withLength(pts) {
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { points: pts, length };
}

// ── conduits follow the open lanes (owner 2026-11-11, #282 answer 5) [MM-subtask_mwco9m19_39] ──────────────────────
// A conduit runs along walkable cells between the buildings: the battle's own walker search (sim/pathfinding.js
// buildNavGrid + findWalkerPath — the map's blocking cells plus every building's and defense's footprint, 8-connected,
// string-pulled), from inside one end's footprint to inside the other's. No path (or no grid: a map without cells) →
// the one-bend conduitRoute. The grid and the routes are memoised per layout (the outpost is re-read a few times a
// second; the layout changes only when something is built, sold or moved).

/** Every footprint on the outpost: its buildings (built or under construction) and its defenses. → [{ id, x, y, w, h }] */
function footprints(o, map) {
  const ids = [...new Set([...Object.keys(o.pads || {}), ...(o.building || []).map((j) => j.pad)])].sort();
  const out = [];
  for (const id of ids) { const r = buildingRect(o, map, id); if (r) out.push({ id, x: r.x, y: r.y, w: r.w, h: r.h }); }
  for (const d of o.defenses || []) if (d.cell) out.push({ id: d.id, x: d.cell[0], y: d.cell[1], w: 1, h: 1 });
  return out;
}
const blockedOf = new WeakMap();   // map → its blocking cells, for buildNavGrid
function navMapOf(map) {
  if (!map || !(map.width > 0) || !(map.height > 0)) return null;
  if (!blockedOf.has(map)) {
    const cells = [];
    if (map.blocking) for (let i = 0; i < map.blocking.length; i++) if (map.blocking[i]) cells.push({ x: i % map.width, y: Math.floor(i / map.width) });
    blockedOf.set(map, { cols: map.width, rows: map.height, blockedCells: cells });
  }
  return blockedOf.get(map);
}
const LANES_KEEP = 4;              // layouts remembered (the outpost as it stands + the ghost's hypothetical ones)
const lanesMemo = [];              // [{ map, key, grid, routes: Map }]
/** The open-cell grid for this layout (memoised). → { grid, routes } or null (the map has no cells). */
export function laneGrid(o, map) {
  const nav = navMapOf(map);
  if (!nav) return null;
  const fps = footprints(o, map);
  const key = fps.map((f) => `${f.x},${f.y},${f.w},${f.h}`).join(';');
  const hit = lanesMemo.find((m) => m.map === map && m.key === key);
  if (hit) return hit;
  const grid = buildNavGrid(nav, fps.map((f) => ({ pos: { x: f.x, y: f.y }, footprint: { w: f.w, h: f.h } })));
  const entry = { map, key, grid, routes: new Map() };
  lanesMemo.unshift(entry);
  if (lanesMemo.length > LANES_KEEP) lanesMemo.length = LANES_KEEP;
  return entry;
}
const inside = (r, c) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;
/**
 * A conduit's route from pad `from` to pad `to` along the open lanes of `lanes` (laneGrid's answer): a polyline of
 * [x, z] points leaving `from`'s edge and arriving at `to`'s, bending only where the lane does. Falls back to
 * conduitRoute when there is no grid, an end is off the grid, or no lane joins them. Deterministic. → { points, length }
 */
export function laneRoute(lanes, from, to) {
  if (!lanes) return conduitRoute(from, to);
  const key = `${from.x},${from.y},${from.w},${from.h}>${to.x},${to.y},${to.w},${to.h}`;
  if (lanes.routes.has(key)) return lanes.routes.get(key);
  const res = routeOnGrid(lanes.grid, from, to) || conduitRoute(from, to);
  lanes.routes.set(key, res);
  return res;
}
function routeOnGrid(grid, from, to) {
  const { cols, rows } = grid;
  const onGrid = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= cols && r.y + r.h <= rows;
  if (!onGrid(from) || !onGrid(to)) return null;
  // the two ends' own footprints are open for this route (it starts and ends inside them)
  const passable = grid.passable.slice();
  for (const r of [from, to]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) passable[y * cols + x] = 1;
  const cell = (r) => ({ x: r.x + Math.floor((r.w - 1) / 2), y: r.y + Math.floor((r.h - 1) / 2) });
  const s = cell(from), path = findWalkerPath({ passable, cols, rows }, s, cell(to), null, false);
  if (!path) return null;
  const mids = [s, ...path].filter((c) => !inside(from, c) && !inside(to, c)).map((c) => [c.x + 0.5, c.y + 0.5]);
  const [ax, az] = centre(from), [bx, bz] = centre(to);
  if (!mids.length) return withLength([edgeToward(from, bx, bz), edgeToward(to, ax, az)]);   // a clear straight lane
  const first = mids[0], last = mids[mids.length - 1];
  return withLength([edgeToward(from, first[0], first[1]), ...mids, edgeToward(to, last[0], last[1])]);
}

/**
 * The grid nodes a consumer could join: every node of a live grid (powerGrids `grids[].nodes`), with its centre and
 * reach. → [{ id, kind, grid (index into grids), at: [x, z], reach, rect }], sorted by id.
 */
export function gridNodes(o, map, grids) {
  const out = [];
  grids.forEach((g, gi) => {
    for (const id of g.nodes) {
      const b = o.pads[id], rect = buildingRect(o, map, id), def = b && structureDef(b.kind, b.tier);
      if (!rect || !def) continue;
      out.push({ id, kind: b.kind, grid: gi, at: centre(rect), reach: def.reach, rect });
    }
  });
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The node a consumer centred at `at` hooks into: the nearest grid node whose reach covers it (ties: the lower id) —
 * powerGrids' join rule, read back for drawing. → the node, or null (no power in reach).
 */
export function joinNode(nodes, at) {
  let best = null, bestD = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.at[0] - at[0], n.at[1] - at[1]);
    if (d <= n.reach && d < bestD) { best = n; bestD = d; }
  }
  return best;
}

/**
 * The minimum spanning tree of one grid's nodes (Prim, from its first station by id), as [parent, child] pairs in
 * the order they join — so the pulse runs outward from the station. Ties break on ids: deterministic.
 */
export function gridTree(nodes, rootId) {
  const left = nodes.filter((n) => n.id !== rootId), inTree = nodes.filter((n) => n.id === rootId), out = [];
  while (left.length && inTree.length) {
    let best = null;
    for (const a of inTree) {
      for (const b of left) {
        const d = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]);
        if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && (a.id + '|' + b.id) < (best.a.id + '|' + best.b.id))) best = { a, b, d };
      }
    }
    out.push([best.a, best.b]);
    inTree.push(best.b);
    left.splice(left.indexOf(best.b), 1);
  }
  return out;
}

/**
 * The conduits to draw now, DERIVED from the grid (One Battle UX §5.2: never authored): each grid's minimum spanning
 * tree over its nodes (stations and pylons), plus one branch from the node each building hooks into to that building
 * (built or under construction). Positions are buildingRect's, so free-placed buildings get conduits like pad ones.
 * → [{ from, to, kind: 'link' | 'branch', points, length, powered, unlit? }] — `from` is always the node end; powered:
 * the outpost runs and (a branch) the building is built and on. A building no node reaches gets no conduit.
 * A pylon chain linked to no station (model.js unlitChains; owner #282 answer 3) gets its tree too, as unlit links
 * (`unlit: true`, never powered): the player sees the chain stands, and that it carries nothing.
 * Routes follow the open lanes (laneRoute), falling back to one bend.
 */
export function planConduits(o, map) {
  const { grids, powered } = powerGrids(o, map);
  const nodes = gridNodes(o, map, grids);
  const lanes = laneGrid(o, map);
  const out = [];
  grids.forEach((g, gi) => {
    const mine = nodes.filter((n) => n.grid === gi);
    const root = [...g.stations].sort()[0];
    for (const [a, b] of gridTree(mine, root)) out.push({ from: a.id, to: b.id, kind: 'link', ...laneRoute(lanes, a.rect, b.rect), powered: !!o.online });
  });
  for (const chain of unlitChains(o, map)) {
    const mine = gridNodes(o, map, [chain]);
    for (const [a, b] of gridTree(mine, chain.nodes[0])) out.push({ from: a.id, to: b.id, kind: 'link', ...laneRoute(lanes, a.rect, b.rect), powered: false, unlit: true });
  }
  const built = Object.keys(o.pads).filter((id) => !POWER_NODE_KINDS.includes(o.pads[id].kind));
  const jobs = (o.building || []).filter((j) => !o.pads[j.pad]).map((j) => j.pad);
  for (const id of [...new Set([...built, ...jobs])].sort()) {
    const rect = buildingRect(o, map, id);
    if (!rect) continue;
    const n = joinNode(nodes, centre(rect));
    if (!n) continue;
    out.push({ from: n.id, to: id, kind: 'branch', ...laneRoute(lanes, n.rect, rect), powered: !!o.online && !!o.pads[id] && powered.has(id) });
  }
  return out;
}

/** The ids `before` powers that `after` does not (powerGrids answers), sorted: who a change would cut. */
export function powerCuts(before, after) {
  return [...before.powered].filter((id) => !after.powered.has(id)).sort();
}

/**
 * The power icon over each building (owner 2026-11-11, #282 answer 1: "buildings have power icons"): every finished
 * building and defense that draws power, with its grid state — 'on', 'off', or 'cut' (an armed placement would switch
 * it off: ghostPower's `cuts`). Grid nodes (stations, pylons) and buildings that draw nothing (walls, the Habitat) get
 * none; nor does a building still under construction.
 * → [{ id, kind, at: [x, z] (centre, cells), defense, state }], buildings by id, then defenses by id.
 * opts.cuts: ids an armed placement would cut; opts.grids: a powerGrids answer already to hand.
 */
export function planPowerIcons(o, map, { cuts = [], grids = null } = {}) {
  const { powered } = grids || powerGrids(o, map);
  const cut = new Set(cuts);
  const state = (id) => (cut.has(id) ? 'cut' : powered.has(id) ? 'on' : 'off');
  const out = [];
  for (const id of Object.keys(o.pads || {}).sort()) {
    const b = o.pads[id], def = structureDef(b.kind, b.tier), rect = buildingRect(o, map, id);
    if (!def || !def.draw || POWER_NODE_KINDS.includes(b.kind) || !rect) continue;
    out.push({ id, kind: b.kind, at: centre(rect), defense: false, state: state(id) });
  }
  for (const d of [...(o.defenses || [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const def = structureDef(d.kind, d.tier);
    if (!def || !def.draw || d.building || !d.cell) continue;
    out.push({ id: d.id, kind: d.kind, at: [d.cell[0] + 0.5, d.cell[1] + 0.5], defense: true, state: state(d.id) });
  }
  return out;
}
/** The same icons with an armed placement's cuts marked (cheap: no grid run). */
export const withCuts = (icons, cuts) => {
  if (!cuts || !cuts.length) return icons;
  const cut = new Set(cuts);
  return icons.map((i) => (cut.has(i.id) ? { ...i, state: 'cut' } : i));
};

/**
 * What the grid would give a building of `kind` placed at `rect` ({ x, y, w, h }, cells; top-left = the hover cell):
 * powerGrids run on the outpost with that building added (so the priority rule decides, not a copy of it).
 * → null when the kind draws no power, else { reason: null | 'reach' | 'supply', node (the node it would hook into,
 * or null), rect, cuts (ids on now that it would switch off), route (node → building, conduitRoute) | null }.
 * 'supply' (grid short): it would go without, or the priority rule would serve it by cutting a building that is on.
 */
export const GHOST_ID = '__ghost';
export function ghostPower(o, map, kind, rect) {
  const def = structureDef(kind, 1);
  if (!def || !def.draw || POWER_NODE_KINDS.includes(kind)) return null;
  const isDefense = DEFENSE_KINDS.includes(kind);
  const o2 = isDefense
    ? { ...o, defenses: [...(o.defenses || []), { id: GHOST_ID, kind, tier: 1, cell: [rect.x, rect.y], hp: 1 }] }
    : { ...o, pads: { ...o.pads, [GHOST_ID]: { kind, tier: 1, at: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } } } };
  const after = powerGrids(o2, map), { grids, off } = after;
  const node = joinNode(gridNodes(o2, map, grids), centre(rect));
  // grid short: the building itself goes without, or it is served by cutting a building that is on now (powerCuts:
  // the buildings whose power icon turns to the warning state while this placement is armed)
  const cuts = powerCuts(powerGrids(o, map), after);
  const reason = off[GHOST_ID] || (cuts.length ? 'supply' : null);
  return { reason, node: node ? node.id : null, rect, cuts, route: node ? laneRoute(laneGrid(o2, map), node.rect, rect) : null };
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
  // the map's pads in order, then the buildings placed freely (their own `at` rectangle, model.buildingRect) — every
  // building gets its model, wherever it stands [MM-subtask_mwcij28k_34] (owner 2026-11-11: placed buildings drew as
  // low-detail blocks on the shared battle screen)
  const freeIds = [...new Set([...Object.keys(o.pads), ...o.building.map((x) => x.pad)])]
    .filter((id) => !map.pads.some((q) => q.id === id) && buildingRect(o, map, id)).sort();
  const spots = [...map.pads, ...freeIds.map((id) => buildingRect(o, map, id))];
  for (const p of spots) {
    const b = o.pads[p.id], job = o.building.find((x) => x.pad === p.id);
    if (!b && !job) continue;
    const kind = (b || job).kind;
    const rigHead = kind === 'rig' ? rigHeadFor(o, map, p.id) : null;
    const item = { pad: p.id, rect: { id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }, kind, tier: b ? b.tier : job.tier, rigHead, tint: TINT.none, rise: 1, glow: o.online ? 1 : 0.32, working: false, mk2: false };
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
  const job = (o.building || []).find((x) => x.pad === pad);
  const tier = (o.pads[pad] && o.pads[pad].deposit) || (job && job.deposit) || depositOf(map, pad);
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
export function defenseStructures(o, map = null, now = null) {
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
      // 0 HP: a wreck (charred, slumped, smoking) until a repair drone restores it [MM-story_mwb8zamf_23];
      // building: the battle's 4-step rise; selling: its grey dismantling look [MM-story_mwb8zdb0_26]
      hp: Math.min(d.hp, max), maxHp: max, outpostId: d.id,
      lifecycle: d.selling ? 'Selling' : d.building ? 'Building' : !(d.hp > 0) ? 'Wrecked' : d.hp < max ? 'Damaged' : 'Active',
      progress: d.building && now != null ? Math.max(0, Math.min(1, (now - d.building.since) / Math.max(1, d.building.done - d.building.since))) : undefined,
      ...extra,
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
