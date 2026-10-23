/**
 * src/data/foliage.js — each planet's PROP KIT: which trees, rocks and ground cover its battlefield is dressed in
 * [MM-story_mvk4auz0_n]. Faction-Terrain-Design §2.4 (prop kits) and §5.3 (prop families), the families of PLN-FOL.
 *
 * Owner 2026-10-22: "we need to make sure all maps have folliage, but we need decor that matches the theme of each
 * planet's terrain. We should also create custom rocks shapes for each planet".
 *
 * DATA ONLY, keyed by the same faction key as data/planets.js. The planner (render3d/obstructions/placement.js)
 * reads it; the shapes are render3d/obstructions/families.js. Nothing here touches the sim: blocking never changes.
 *
 *   trees   family → weight. Drawn on blocked tree cells and the level's authored groves (code 4).
 *   rocks   one rock style for the planet's boulders (code 3), plateaus (codes 5 / 9) and stones (code 8).
 *   cover   family → weight. WALKABLE ground cover — cosmetic, units walk over it, low enough to sit under a tower.
 *   density per terrain class, the chance a walkable cell gets cover: grass (0), dirt (1), brush (2), border (7).
 *           Brush cells can take a second piece (`brush2`). This is what keeps a nearly treeless map dressed.
 *   colors  the kit's own colours (hex); anything not named here comes from the world palette
 *           (render3d/styles/lowpoly-palettes.js). `glow` colours are drawn unlit (§5.4 emissive terrain).
 */
export const TREE_FAMILIES = Object.freeze(['broadleaf', 'pine', 'snowPine', 'blossom', 'spike', 'snag', 'cactus', 'acacia',
  'iceSpire', 'needleSpire', 'crystal', 'mushroom', 'sporePod', 'hive']);
export const ROCK_STYLES = Object.freeze(['boulder', 'mossy', 'hoodoo', 'mesa', 'iceShard', 'basalt', 'shard', 'crystalRidge', 'moonrock']);
export const COVER_FAMILIES = Object.freeze(['shrub', 'flowerBush', 'blossomBush', 'thornscrub', 'smallCactus', 'twigs', 'tussock',
  'emberTwigs', 'crystalScatter', 'sprouts', 'toadstools', 'reeds', 'rubble']);

export const FOLIAGE = Object.freeze({
  // Verdance — broadleaf woods and pines, hedgerows and flowering bushes, grey boulders. (The approved look: unchanged trees.)
  ground: { trees: { broadleaf: 0.55, pine: 0.45 }, rocks: 'boulder',
    cover: { shrub: 0.45, flowerBush: 0.55 }, density: { grass: 0.05, dirt: 0.02, brush: 0.6, border: 0.45, brush2: 0.3 },
    colors: { flowers: ['#f4e04a', '#ffffff', '#e86aa0', '#f08a3a'] } },
  // Florael — pink blossom groves ringing open meadows, a few pines, lilac boulders, blossom and flower bushes.
  air: { trees: { blossom: 0.85, pine: 0.15 }, rocks: 'boulder',
    cover: { blossomBush: 0.5, flowerBush: 0.5 }, density: { grass: 0.05, dirt: 0.02, brush: 0.5, border: 0.4, brush2: 0.15 },
    colors: { flowers: ['#ffffff', '#fcc8d8', '#f4e04a', '#c8a8f0'] } },
  // Ochre — cacti, flat-top acacias and dead snags; sandstone hoodoos; thornscrub and barrel cacti on the sand.
  hightech: { trees: { cactus: 0.45, acacia: 0.35, snag: 0.2 }, rocks: 'hoodoo',
    cover: { thornscrub: 0.55, smallCactus: 0.45 }, density: { grass: 0.06, dirt: 0.035, brush: 0.6, border: 0.5, brush2: 0.25 },
    colors: { cactus: '#5a8a4a', snag: '#b8a68a', thorn: '#9a7a4a', flowers: ['#f04a6a', '#f4e04a'] } },
  // Kessra — spike trees and bleached snags; layered mesas; dry twigs and shell scrap on the dust.
  artillery: { trees: { spike: 0.6, snag: 0.4 }, rocks: 'mesa',
    cover: { twigs: 0.6, thornscrub: 0.4 }, density: { grass: 0.06, dirt: 0.05, brush: 0.65, border: 0.5, brush2: 0.3 },
    colors: { spike: '#5a3e30', snag: '#e0d4bc', twig: '#8a6a4a', thorn: '#7a5a3a' } },
  // Rime — snow pines, ice spires and frozen snags; ice shards; tussock grass in the snow.
  water: { trees: { snowPine: 0.65, iceSpire: 0.2, snag: 0.15 }, rocks: 'iceShard',
    cover: { tussock: 0.75, twigs: 0.25 }, density: { grass: 0.05, dirt: 0.01, brush: 0.65, border: 0.5, brush2: 0.3 },
    colors: { snow: '#f4f8fc', ice: '#bfe2f4', iceDeep: '#8ec4e8', snag: '#6a5a62', tussock: '#a8b088', twig: '#5a4a5a' } },
  // Cinder — charred spike trees with ember tips; hexagonal basalt columns; scorched twigs that still glow.
  arcane: { trees: { spike: 1 }, rocks: 'basalt',
    cover: { emberTwigs: 1 }, density: { grass: 0.05, dirt: 0.04, brush: 0.65, border: 0.5, brush2: 0.25 },
    colors: { spike: '#2a2222', ember: '#ff7a1a', twig: '#2e2626' }, glow: { spike: true } },
  // Lumen — a barren grey moon (owner 2026-10-23: "Different grey rocks and crystals would make more sense than grass")
  // [MM-story_mvl774l4_p]: needle spires and cyan crystal clusters; a mixed field of grey moon rocks (rounded, angular, flat,
  // each its own grey); grey rubble and crystal shards on the regolith — no plants at all.
  space: { trees: { needleSpire: 0.5, crystal: 0.5 }, rocks: 'moonrock',
    cover: { rubble: 0.6, crystalScatter: 0.4 }, density: { grass: 0.07, dirt: 0.06, brush: 0.7, border: 0.55, brush2: 0.3 },
    colors: { spire: '#8e9096', crystal: '#5ae0f0', tip: '#9af4ff',
      rocks: ['#62656c', '#74777e', '#888b92', '#9c9fa6', '#7a7670', '#6c6e74'],
      rubble: ['#5e6168', '#70737a', '#84878e', '#9a9da4', '#787470'] } },
  // Xenthe — mushroom trees and magenta crystal clusters; crystal ridges; glowing sprouts and toadstools.
  dark: { trees: { mushroom: 0.75, crystal: 0.25 }, rocks: 'crystalRidge',
    cover: { sprouts: 0.5, toadstools: 0.5 }, density: { grass: 0.05, dirt: 0.05, brush: 0.5, border: 0.35, brush2: 0.2 },
    colors: { stem: '#d8e0e8', caps: ['#ffd23a', '#ff4ad0', '#7af0d0'], crystal: '#e866b8', sprout: '#30d0b0', tip: '#b8fff0' } },
  // Vexmire — spore pods, hive mounds and rotting snags; moss boulders; reed beds round the bog pools.
  greenies: { trees: { sporePod: 0.45, hive: 0.25, snag: 0.3 }, rocks: 'mossy',
    cover: { reeds: 0.7, shrub: 0.3 }, density: { grass: 0.05, dirt: 0.04, brush: 0.55, border: 0.4, brush2: 0.2 },
    colors: { pod: '#a8c040', blister: '#d8ff4a', hive: '#8a6a3a', hiveDark: '#4a3420', snag: '#4a4030', moss: '#5a8a3a', reed: '#7a8a3a', cattail: '#5a3e24', shrub: '#5a7a3a' } },
});

export const DEFAULT_KIT = 'ground';

/**
 * The kit for a battle: the planet's own (faction key), else — when only a world palette is known (?world= preview)
 * — the planet that palette belongs to, else Verdance. `palettes` maps planet key → palette key (data/planets.js).
 */
export function foliageKitKey(planet, world = null, palettes = {}) {
  if (planet && FOLIAGE[planet]) return planet;
  if (world) for (const [k, p] of Object.entries(palettes)) if (p === world && FOLIAGE[k]) return k;
  return DEFAULT_KIT;
}
