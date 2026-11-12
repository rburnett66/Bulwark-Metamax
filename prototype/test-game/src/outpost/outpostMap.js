/**
 * src/outpost/outpostMap.js — the outpost map for a planet [MM-story_mw5oeatc_l].
 *
 * Each planet's outpost map is a Terrain Forge map, content/maps/forge/<planet>-outpost.json (tech plan
 * docs/tech-plan/Outpost.md §6.6), authored with the Forge's outpost panel. outpostMapFor() fetches it and shapes it
 * for the outpost model (src/outpost/model.js reads the hub spot, deposits and kitDefenses) and the outpost views (which
 * also draw terrain, heights and the raid lanes). A planet with no map yet gets the draft layout.
 *
 * No build pads (One Battle UX S2c.2 [MM-story_mwc9pmbn_2i]): an outpost map fixes only the landing pad (`hub`, the
 * contract's Outpost Hub) and the ore deposits; every other building stands where the player placed it (its own `at`
 * rectangle, model.buildingRect), by the shared placement rules. Conduits are derived from the grid (view/conduits.js).
 */
import { DRAFT_LAYOUT } from './draftLayout.js';
import { TERRAIN } from '../terrain/terrainGen.js';
import { HEIGHT } from '../terrain/outpostPads.js';

/** The URL of a planet's outpost map, next to the battle maps. */
export const outpostMapUrl = (planet, base = import.meta.url) => new URL(`../../content/maps/forge/${planet}-outpost.json`, base).href;

/**
 * A Forge outpost map → the outpost map shape: { id, planet, width, height, hub: { id: 'hub', x, y, w, h },
 * deposits: [{ tier, x, y }] (2 × 2 each), clearings: [{ x, y, w, h }] (a remote site's cleared yard: terrain only,
 * no building spot), kitDefenses,
 * terrain, blocking, heights, mesa, spawns, decor, resources, farmCells, source: 'forge', forge }. farmCells is the
 * Forge's farmable-cell layer (src/terrain/farmCells.js; read by src/farm/cells.js), or null on a map without one. `forge` keeps the whole
 * export for the battle loader (buildTerrainMap) when the raid sim runs on it (story O7).
 */
/**
 * The mesa's rim, opened for building (owner 2026-11-08: "the rock wall surrounding the outpost takes up valuable space
 * the defensive placement could use" → keep the plateau, build on the rim): the cliff cells on the mesa top become the
 * plateau's stone edge, so no boulders are planted there and defenses may stand on them. The raid sim keeps the
 * Forge's own grid (map.forge), so raiders still climb only by the ramps. → { terrain, blocking } copies.
 */
export function openRim(terrain, blocking, heights) {
  if (!terrain || !heights) return { terrain, blocking };
  const t = terrain.slice(), b = blocking ? blocking.slice() : null;
  for (let i = 0; i < t.length; i++) {
    if (heights[i] !== HEIGHT.TOP || (t[i] !== TERRAIN.CLIFF && t[i] !== TERRAIN.CLIFF_BORDER)) continue;
    t[i] = TERRAIN.ROCK_BORDER;
    if (b) b[i] = 0;
  }
  return { terrain: t, blocking: b };
}

/** The landing pad's rectangle from a Forge outpost export's `hub` ({ x, y, w, h }). */
export function hubOf(forge) {
  const h = forge && forge.hub;
  return h ? Object.freeze({ id: 'hub', x: h.x, y: h.y, w: h.w || 3, h: h.h || 3 }) : null;
}

/**
 * The cells the outpost map keeps for its fixed features — the landing pad, the deposits and the remote clearings —
 * as rectangles [{ x, y, w, h, what }]. Surface fields and farm ground keep off these and their 1-cell margin (this
 * list replaced "off the pads").
 */
export function reservedRects(map) {
  const out = [];
  if (map && map.hub) out.push({ x: map.hub.x, y: map.hub.y, w: map.hub.w, h: map.hub.h, what: 'the landing pad' });
  for (const d of (map && map.deposits) || []) out.push({ x: d.x, y: d.y, w: 2, h: 2, what: `the ${d.tier} deposit` });
  for (const c of (map && map.clearings) || []) out.push({ x: c.x, y: c.y, w: c.w, h: c.h, what: 'a clearing' });
  return out;
}
/** Is cell (x, y) on a reserved rect or within `margin` cells of one? */
export const nearReserved = (map, x, y, margin = 1) => reservedRects(map)
  .some((r) => x >= r.x - margin && x < r.x + r.w + margin && y >= r.y - margin && y < r.y + r.h + margin);

export function outpostMapFromForge(forge, planet = forge.planet) {
  const rim = openRim(forge.terrain || null, forge.blocking || null, forge.heights || null);
  return {
    id: `${planet}-outpost`, planet, width: forge.cols, height: forge.rows,
    hub: hubOf(forge), deposits: (forge.deposits || []).map((d) => ({ tier: d.tier, x: d.x, y: d.y })), clearings: forge.clearings || [], kitDefenses: forge.kitDefenses || [],
    terrain: rim.terrain, blocking: rim.blocking, heights: forge.heights || null, mesa: forge.mesa || null,
    spawns: (forge.spawns || []).filter((s) => (s.lane || 'ground') === 'ground'), decor: forge.decor || [], resources: forge.resources || [],
    farmCells: forge.farmCells && forge.farmCells.length ? forge.farmCells : null,
    source: 'forge', forge,
  };
}

/** The draft layout, shaped like a loaded map (no terrain). */
export const draftOutpostMap = (planet) => ({ ...DRAFT_LAYOUT, planet, source: 'draft' });

/**
 * Fetch a planet's outpost map; falls back to the draft layout when the planet has none (or the fetch fails).
 * opts.fetch: a fetch function (tests); opts.base: the URL the content path resolves against.
 */
export async function outpostMapFor(planet, { fetch: f = globalThis.fetch, base } = {}) {
  try {
    const r = await f(outpostMapUrl(planet, base));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return outpostMapFromForge(await r.json(), planet);
  } catch (_) {
    return draftOutpostMap(planet);
  }
}
