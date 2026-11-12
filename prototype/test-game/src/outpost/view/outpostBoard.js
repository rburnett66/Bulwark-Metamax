/**
 * src/outpost/view/outpostBoard.js — the outpost map as a battle board, for the battle renderer [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.1: "the planet's outpost map is loaded through the same path as a battle
 * map, so ground, palette, decor, rocks and surface resources are drawn by the battle renderer". The outpost maps are
 * Forge maps on the battle maps' recipe and export pipeline (owner: built exactly like the large tower-defense maps),
 * so the board is mapgen.buildTerrainMap on the map's Forge export, as main.js builds a battle map, and the ground is
 * the map's baked level (content/maps/baked/<slug>/) when it has one — the battle renderer's baked-level path —
 * else the ground the renderer derives from the map itself.
 *
 * The outpost view shows the whole map with no wave windows (there are no waves; raids come along the map's spawns),
 * so the ring fog is off. Map size always comes from the map (never assumed).
 */
import { buildTerrainMap } from '../../sim/mapgen.js';
import { nearReserved } from '../outpostMap.js';

/** The battle board for an outpost map (outpostMapFor's shape, with `forge`). bakeTune: the Forge's tf.bake.v1. */
export function outpostBattleMap(om, { bakeTune = {} } = {}) {
  // the view draws the rim opened for building (outpostMap.js openRim): the board takes the map's terrain and blocking
  // over the Forge export's, so no boulders stand where defenses may (the raid sim keeps om.forge as authored)
  const forge = om.forge ? { ...om.forge, terrain: om.terrain || om.forge.terrain, blocking: om.blocking || om.forge.blocking } : {
    cols: om.width, rows: om.height, terrain: om.terrain || new Array(om.width * om.height).fill(0),
    blocking: om.blocking || new Array(om.width * om.height).fill(0), base: null, spawns: om.spawns || [], decor: [], resources: [],
  };
  const hub = om.hub;
  // the base the battle board needs sits on the landing pad's centre (the Forge export's base is the hub)
  const f = hub && !forge.base ? { ...forge, base: { pos: { x: Math.floor(hub.x + hub.w / 2), y: Math.floor(hub.y + hub.h / 2) } } } : forge;
  const m = buildTerrainMap(f, 1, { seed: 0, bakeTune });
  m.waveWindows = []; m.rings = []; m.openPlay = false;   // no waves at an outpost: the ring fog stays off
  m.outpost = true;
  return m;
}

/** The baked level's slug for an outpost map: the export's own `slug` / `_bakedSlug`, else `<planet>-outpost`. */
export function bakedSlugOf(om) {
  const f = om.forge || {};
  return (typeof f._bakedSlug === 'string' && f._bakedSlug) || (typeof f.slug === 'string' && f.slug) || `${om.planet}-outpost`;
}

/**
 * The slug to hand createRenderer3D: the baked level when content/maps/baked/<slug>/level.json exists, else null
 * (the renderer then builds the ground from the map, with no "missing bake" banner). base: the game root URL.
 */
export async function bakedSlugFor(om, { base = '', fetch: f = globalThis.fetch } = {}) {
  const slug = bakedSlugOf(om);
  try {
    const r = await f(`${base}content/maps/baked/${slug}/level.json`, { method: 'GET' });
    return r && r.ok ? slug : null;
  } catch (_) { return null; }
}

/** The surface resource fields to draw: the map's own, off the mesa and the landing pad / deposits (raw Forge resources). */
export function lowlandResources(om) {
  const cols = om.width, H = om.heights;
  return (om.resources || []).filter((r) => !(H && H[r.y * cols + r.x] > 0) && !nearReserved(om, r.x, r.y, 1))
    .map((r, i) => ({ id: `or${i}`, x: r.x, y: r.y, role: r.role, color: r.color, units: 1, remaining: 1 }));
}

/**
 * The outpost's opening FRAMING (spec Outpost-AAA-UX §9, D7) [MM-story_mwcuyrqr_3j]: the bounding box of the base — the
 * hub (the live state's base) and every structure's footprint — plus `margin` cells, never smaller than minW × minH,
 * inside the board. → { x0, y0, x1, y1 } inclusive cells, for render3d's frameRect (autoFrame): the battle camera frames
 * it as it frames a battle's play area; pinch / scroll still zooms out to the whole board.
 */
export function baseFrameRect(state, board, { margin = 6, minW = 24, minH = 12 } = {}) {
  const cols = board.cols, rows = board.rows;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  if (state.base && state.base.pos) add(state.base.pos.x, state.base.pos.y);
  for (const s of state.structures ? state.structures.values() : []) {
    if (!s || !s.pos) continue;
    const w = (s.footprint && s.footprint.w) || 1, h = (s.footprint && s.footprint.h) || 1;
    add(s.pos.x, s.pos.y); add(s.pos.x + w - 1, s.pos.y + h - 1);
  }
  if (!Number.isFinite(x0)) return null;
  x0 -= margin; y0 -= margin; x1 += margin; y1 += margin;
  const grow = (a, b, min, size) => {
    const need = min - (b - a + 1);
    if (need > 0) { a -= Math.floor(need / 2); b += Math.ceil(need / 2); }
    if (a < 0) { b -= a; a = 0; }
    if (b > size - 1) { a -= b - (size - 1); b = size - 1; }
    return [Math.max(0, a), Math.min(size - 1, b)];
  };
  [x0, x1] = grow(x0, x1, Math.min(minW, cols), cols);
  [y0, y1] = grow(y0, y1, Math.min(minH, rows), rows);
  return { x0, y0, x1, y1 };
}
