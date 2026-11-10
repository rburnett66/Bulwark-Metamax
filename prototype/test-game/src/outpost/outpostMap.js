/**
 * src/outpost/outpostMap.js — the outpost map for a planet [MM-story_mw5oeatc_l].
 *
 * Each planet's outpost map is a Terrain Forge map, content/maps/forge/<planet>-outpost.json (tech plan
 * docs/tech-plan/Outpost.md §6.6), authored with the Forge's outpost panel. outpostMapFor() fetches it and shapes it
 * for the outpost model (src/outpost/model.js reads pads, deposits and kitDefenses) and the outpost views (which also
 * draw terrain, heights, conduits and the raid lanes). A planet with no map yet gets the draft layout.
 */
import { DRAFT_LAYOUT } from './draftLayout.js';
import { TERRAIN } from '../terrain/terrainGen.js';
import { HEIGHT } from '../terrain/outpostPads.js';

/** The URL of a planet's outpost map, next to the battle maps. */
export const outpostMapUrl = (planet, base = import.meta.url) => new URL(`../../content/maps/forge/${planet}-outpost.json`, base).href;

/**
 * A Forge outpost map → the outpost map shape: { id, planet, width, height, pads, deposits, conduits, kitDefenses,
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

export function outpostMapFromForge(forge, planet = forge.planet) {
  const rim = openRim(forge.terrain || null, forge.blocking || null, forge.heights || null);
  return {
    id: `${planet}-outpost`, planet, width: forge.cols, height: forge.rows,
    pads: forge.pads || [], deposits: forge.deposits || [], conduits: forge.conduits || [], kitDefenses: forge.kitDefenses || [],
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
