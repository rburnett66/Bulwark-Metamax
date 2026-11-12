/**
 * src/outpost/siting.js — where the outpost's starting kit stands, and where an old save's buildings go, by the SHARED
 * placement rules (One Battle UX S2c.2 [MM-story_mwc9pmbn_2i], TECH_PLAN::One-Battle-UX.md §5.3–5.4).
 *
 * The outpost maps no longer author build pads (owner playtest 2026-11-11: "the mining station is too close to the
 * landing pad .. I thought fixed pads were being removed"). Nothing here is a second placement checker: every "may it
 * stand here" is the battle's own validatePlacement (sim/structures.js — terrain, obstruction, occupied cells, the
 * 1-cell build spacing) on the outpost's live SimState (liveSim.js toLiveSim), with the outpost's position rules
 * (placementRules.js outpostPositionRules: the rig on a deposit, the landing pad's HUB_CLEARANCE). What is left out on
 * purpose is "may the player build one NOW" (gold, the gun crew cap, and the battle's "a new piece may not close the
 * last open lane"): a kit or a migrated save already owns its pieces.
 *
 * Search order (nearestLegal): the cells nearest the anchor first — by Chebyshev ring, then squared distance, then row
 * (y), then column (x) — the first legal top-left wins. Deterministic: no clock, no randomness, the map only.
 */
import { toLiveSim } from './liveSim.js';
import { createOutpost, buildingRect } from './model.js';
import { outpostPositionRules } from './placementRules.js';
import { validatePlacement } from '../sim/structures.js';
import { outpostStructId } from '../data/outpostStructures.js';
import { getStructureDef } from '../data/tables.js';
import { structureDef, GUN_KINDS } from '../data/outpost.js';

/** The layout rules a save was last sited by. Bump it when a position rule changes, and every save re-sites once. */
export const LAYOUT_VERSION = 1;

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const dims = (map) => ({ cols: map.width ?? map.cols, rows: map.height ?? map.rows });
const footprintOf = (kind) => getStructureDef(outpostStructId(kind)).footprint || { w: 1, h: 1 };
const centreOf = (r) => [r.x + r.w / 2, r.y + r.h / 2];

/**
 * A position check on outpost `o` as it stands: (kind, { x, y }) → the refusal reason, or null when a `kind` may stand
 * with its top-left there. The live state is built once per call of positionCheck (it reads `o` as it is now).
 */
export function positionCheck(o, map) {
  // every defense counts where it stands, a wreck included (it keeps its cell until it is repaired or sold)
  const probe = { ...o, defenses: (o.defenses || []).map((d) => ({ ...d, hp: Math.max(1, d.hp || 0) })), upgrading: null };
  const { state } = toLiveSim(probe, { map, now: o.t || 0, gold: 1e12 });
  state.placementRules = outpostPositionRules(map);
  return (kind, cell) => {
    const r = validatePlacement(state, outpostStructId(kind), { x: cell.x, y: cell.y });
    // 'blocksPath' is the battle's "a NEW piece may not close the last lane" — not a position rule: the kit's walls
    // close the mesa's ways on purpose (raiders break through), and a saved wall that already closes one stays
    return r.ok || r.reason === 'blocksPath' ? null : r.reason || 'refused';
  };
}

/**
 * The legal top-left for `kind` nearest `anchor` (a cell; the search order above), or null. opts.only: a list of
 * candidate cells to choose from instead of the whole map (a rig: its deposits); opts.accept(cell) → extra condition.
 */
export function nearestLegal(check, map, kind, anchor, { only = null, accept = () => true } = {}) {
  const { cols, rows } = dims(map), fp = footprintOf(kind);
  const cells = only ? only.map((c) => ({ x: c.x, y: c.y })) : [];
  if (!only) for (let y = 0; y + fp.h <= rows; y++) for (let x = 0; x + fp.w <= cols; x++) cells.push({ x, y });
  const key = (c) => {
    const dx = c.x - anchor.x, dy = c.y - anchor.y;
    return [Math.max(Math.abs(dx), Math.abs(dy)), dx * dx + dy * dy, c.y, c.x];
  };
  const keyed = cells.map((c) => ({ c, k: key(c) }));
  keyed.sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3] - b.k[3]);
  for (const { c } of keyed) if (accept(c) && !check(kind, c)) return c;
  return null;
}

const KIT_CACHE = new WeakMap();
/**
 * The reference kit's layout on `map` (model.referenceOutpost; cached per map), placed in this order:
 *   1. the Rig I on the common deposit (the rig rule: its top-left on the deposit's);
 *   2. the map's kitDefenses, each at its authored cell when that is legal, else the nearest legal cell;
 *   3. a Power Station I at the legal spot nearest the midpoint of the landing pad and the rig, with the landing pad,
 *      the rig and every kit defense that draws power in its reach (so the reference set is powered, as before);
 *   4. a Storage Tower I at the legal spot nearest the landing pad, in the station's reach.
 * Every piece clears the landing pad by HUB_CLEARANCE and the others by the build spacing (the shared rules).
 * → { pads: { r1, p1, s1 → { kind, tier, at, … } }, defenses: [{ kind, cell }], moved: [{ kind, from, to }] }
 * Throws when a piece has no legal spot (a map content error: the outpost tests run this on every shipped map).
 */
export function referenceKit(map) {
  const hit = map && typeof map === 'object' ? KIT_CACHE.get(map) : null;
  if (hit) return clone(hit);
  const name = map.id || 'the map';
  const o = createOutpost(map.planet || 'ground', { seed: 0, map, now: 0 });
  const hubC = centreOf(map.hub);
  const reach = (structureDef('power', 1) || {}).reach || 10;
  const put = (id, kind, cell, extra = {}) => {
    const fp = footprintOf(kind);
    o.pads[id] = { kind, tier: 1, ...extra, at: { x: cell.x, y: cell.y, w: fp.w, h: fp.h } };
  };
  // 1. the rig on the common deposit
  const dep = (map.deposits || []).find((d) => d.tier === 'common');
  if (!dep) throw new Error(`referenceKit: ${name} has no common deposit`);
  const why = positionCheck(o, map)('rig', dep);
  if (why) throw new Error(`referenceKit: a rig cannot stand on the common deposit at (${dep.x}, ${dep.y}) of ${name}: ${why}`);
  put('r1', 'rig', dep, { deposit: 'common', deep: false });
  // 2. the defenses
  const defenses = [], moved = [];
  const withDefenses = () => ({ ...o, defenses: defenses.map((d, i) => ({ id: `d${i + 1}`, kind: d.kind, tier: 1, cell: d.cell, hp: 1 })) });
  for (const k of map.kitDefenses || []) {
    const check = positionCheck(withDefenses(), map);
    const at = { x: k.cell[0], y: k.cell[1] };
    const c = check(k.kind, at) ? nearestLegal(check, map, k.kind, at) : at;
    if (!c) throw new Error(`referenceKit: no legal cell for the kit ${k.kind} near (${at.x}, ${at.y}) on ${name}`);
    if (c !== at) moved.push({ kind: k.kind, from: [at.x, at.y], to: [c.x, c.y] });
    defenses.push({ kind: k.kind, cell: [c.x, c.y] });
  }
  // 3. the station, reaching the landing pad, the rig and the kit's guns. The guns need no power (owner 2026-11-11
  //    [MM-task_mwcutmnk_3h]); reaching them is kept as a LAYOUT rule only, so the starter layout (and old saves read
  //    by it, model.js kitAt) stand where they always have — a station central to the kit.
  const rigC = centreOf(buildingRect(o, map, 'r1'));
  const drawing = defenses.filter((d) => GUN_KINDS.includes(d.kind)).map((d) => [d.cell[0] + 0.5, d.cell[1] + 0.5]);
  const inReach = (c, fp, pts) => pts.every((q) => Math.hypot(c.x + fp.w / 2 - q[0], c.y + fp.h / 2 - q[1]) <= reach);
  const fpP = footprintOf('power');
  const mid = { x: Math.round((hubC[0] + rigC[0]) / 2 - fpP.w / 2), y: Math.round((hubC[1] + rigC[1]) / 2 - fpP.h / 2) };
  const pc = nearestLegal(positionCheck(withDefenses(), map), map, 'power', mid, { accept: (c) => inReach(c, fpP, [hubC, rigC, ...drawing]) });
  if (!pc) throw new Error(`referenceKit: no legal spot for the Power Station on ${name} (in reach of the landing pad, the rig and the kit's guns)`);
  put('p1', 'power', pc);
  // 4. the storage tower, nearest the landing pad, in the station's reach
  const pC = centreOf(buildingRect(o, map, 'p1')), fpS = footprintOf('storage');
  const sc = nearestLegal(positionCheck(withDefenses(), map), map, 'storage', { x: Math.round(hubC[0] - fpS.w / 2), y: Math.round(hubC[1] - fpS.h / 2) },
    { accept: (c) => inReach(c, fpS, [pC]) });
  if (!sc) throw new Error(`referenceKit: no legal spot for the Storage Tower on ${name}`);
  put('s1', 'storage', sc);
  const pads = {};
  for (const id of ['p1', 'r1', 's1']) pads[id] = o.pads[id];
  const kit = { pads, defenses, moved };
  if (map && typeof map === 'object') KIT_CACHE.set(map, kit);
  return clone(kit);
}

/**
 * Bring a saved outpost onto the S2c.2 layout rules (save migration). Two steps:
 *   1. a building with no `at` (keyed by a legacy map pad, legacyPads.js) becomes a free building at EXACTLY that pad's
 *      rectangle — its id, tier, deposit, storage, construction and upgrade jobs untouched (no surprise moves);
 *   2. every building and defense is checked against the position rules (the hub clearance, the build spacing, the
 *      ground, the rig on a deposit), in order — buildings by id, then defenses in the save's order — each against the
 *      landing pad and the pieces already accepted before it. One that passes stays. One that does not moves to the
 *      nearest legal cell (nearestLegal from its own top-left; a rig only to a deposit of its own ore tier), checked
 *      against everything that stayed and every earlier move. A piece with no legal cell anywhere stays where it was
 *      and is reported `stuck` (it still works; the player can sell it).
 * Defense wrecks (0 HP), repair / build / sale timers, the bays' storage, the hopper and the fields are kept as they
 * are. Idempotent: an outpost already at LAYOUT_VERSION comes back unchanged.
 * → { outpost (a new object), moved: [{ id, kind, from: [x, y], to: [x, y] }], stuck: [id] }
 */
export function migrateOutpostLayout(outpost, map) {
  if (!outpost || !map || !map.hub) return { outpost, moved: [], stuck: [] };
  if (outpost.layout === LAYOUT_VERSION) return { outpost, moved: [], stuck: [] };
  const o = clone(outpost);
  o.pads = o.pads || {}; o.building = o.building || []; o.defenses = o.defenses || [];
  // 1. every building on its own rectangle (a legacy pad's, unchanged)
  const ids = [...new Set([...Object.keys(o.pads), ...o.building.map((j) => j.pad)])].filter((id) => (o.pads[id] || {}).kind !== 'hub').sort();
  const kindOf = (id) => (o.pads[id] || o.building.find((j) => j.pad === id)).kind;
  const setAt = (id, cell) => {
    const fp = footprintOf(kindOf(id)), at = { x: cell.x, y: cell.y, w: fp.w, h: fp.h };
    if (o.pads[id]) o.pads[id].at = { ...at };
    for (const j of o.building) if (j.pad === id) j.at = { ...at };
  };
  for (const id of ids) {
    const r = buildingRect(o, map, id);
    if (!r) continue;
    setAt(id, r);
  }
  const hubId = Object.keys(o.pads).find((id) => o.pads[id].kind === 'hub');
  // 2. check in order; movers go after
  const accepted = { ...o, pads: hubId ? { [hubId]: o.pads[hubId] } : {}, building: [], defenses: [] };
  const take = (item) => {
    if (item.id != null && item.defense) accepted.defenses.push(item.defense);
    else {
      if (o.pads[item.id]) accepted.pads[item.id] = o.pads[item.id];
      for (const j of o.building) if (j.pad === item.id) accepted.building.push(j);
    }
  };
  const items = [
    ...ids.map((id) => ({ id, kind: kindOf(id) })),
    ...o.defenses.map((d) => ({ id: d.id, kind: d.kind, defense: d })),
  ];
  const cellOf = (item) => (item.defense ? { x: item.defense.cell[0], y: item.defense.cell[1] } : (() => { const r = buildingRect(o, map, item.id); return { x: r.x, y: r.y }; })());
  const movers = [];
  for (const item of items) {
    if (!item.defense && !buildingRect(o, map, item.id)) continue;   // no spot known at all: left as it is
    if (positionCheck(accepted, map)(item.kind, cellOf(item))) movers.push(item);
    else take(item);
  }
  const moved = [], stuck = [];
  for (const item of movers) {
    const from = cellOf(item), check = positionCheck(accepted, map);
    let only = null;
    if (item.kind === 'rig') {
      const tier = (o.pads[item.id] && o.pads[item.id].deposit) || ((o.building.find((j) => j.pad === item.id) || {}).deposit);
      only = (map.deposits || []).filter((d) => !tier || d.tier === tier);
    }
    const to = nearestLegal(check, map, item.kind, from, { only });
    if (!to) { stuck.push(item.id); take(item); continue; }
    if (item.defense) item.defense.cell = [to.x, to.y];
    else setAt(item.id, to);
    moved.push({ id: item.id, kind: item.kind, from: [from.x, from.y], to: [to.x, to.y] });
    take(item);
  }
  o.layout = LAYOUT_VERSION;
  return { outpost: o, moved, stuck };
}
