/**
 * src/render3d/styles/lowpoly-palettes.js — the low-poly world palettes (code design §4.8 LOWPAL, §4.18 presets).
 * LP [MM-story_mv87jxp2_7]. Owner 2026-10-13: "Low poly organic is the best yet"; asked for the colour variations.
 *
 * DATA ONLY, copied verbatim from the approved prototype (tools/terrain3d-proto body3d.html). Geometry and
 * placement are fixed by seed — a palette only recolours. Known look issues carried over from the prototype
 * (code design §8.2): Sakura reads washed out; Dusk's painted dirt reads as lava.
 *
 * `struct` (LPS [MM-story_mv87jzov_9]) colours the low-poly base, walls and towers per world: stone body, darker
 * plinth stone, roof / cannon accent, trim (flak accent, gate), gun metal and wood. Authored for this ticket
 * (the prototype had no structure models), picked from each world's own rock / canopy / trunk hues.
 *
 * WORLD_LIGHT is each world's lighting from the prototype's style presets: sky (clear) colour, the off-map
 * apron, ambient intensity, a hemisphere light [sky, ground, intensity] and the sun's [colour, intensity
 * multiplier]. The sun's DIRECTION is NOT per world: the one sun is src/render/sun.js (Q14) — the prototype
 * nudged it per preset; that nudge is deliberately dropped.
 */

export const LOWPAL = Object.freeze({
  // meadow retuned toward the owner's reference (2026-10-18, "shift the pallet to more like this") [MM-task_mvenabc8_s]:
  // rich saturated turf (deep green → yellow-green, no teal), tan sandy paths, deep cobalt water inside an icy shore,
  // deeper blue-violet rock, red-orange canopies on cobalt trunks. Was the prototype's pastel meadow.
  meadow: { rock: ['#5558d4', '#5f62de', '#4c50c6', '#6a6de6'], rockB: '#7376d8', pebble: '#8a8ed6', tuft: '#4a9e2c',
    ground: { lime: '#8fbe3c', grass: '#52a636', teal: '#2f7d2c', brush: '#3f9230', forest: '#2a6a2c', stone: '#a8ae84', lilac: '#7c7ccc',
      sand: '#d8c39e', dirt: '#c9ad80', road: '#e2cfa8', roadEdge: '#c8ae84', shore: '#bfe6f6', foam: '#9fd2f4', waterL: '#3a86ec', waterD: '#1d4fc4' },
    canopy: ['#d4553c', '#e06a46', '#c84a3a', '#e8804e', '#d4553c'], rare: '#d8e0ea', pine: ['#2f7a5a', '#26684e', '#3a8a66', '#2e7458'], trunk: '#2a3ec2',
    hills: ['#4fa232', '#64b23c', '#3f922e', '#78bc44'],
    struct: { stone: '#e4dccb', stoneDark: '#b7ae9c', roof: '#d4553c', trim: '#2a3ec2', metal: '#5e6688', wood: '#b98a5a' } },
  autumn: { rock: ['#8d7f78', '#9a8b80', '#7f726c', '#a39388'], rockB: '#a89a8e', pebble: '#b8aa9c', tuft: '#c9a24a',
    ground: { lime: '#e0c25a', grass: '#b8a64a', teal: '#7f8a4a', brush: '#a8904a', forest: '#7a5a3a', stone: '#b8aa8a', lilac: '#a3968c',
      sand: '#e8c890', dirt: '#c89a64', road: '#f2dcb0', roadEdge: '#d4b07a', shore: '#e8d29a', foam: '#c8e2ea', waterL: '#6aa8d8', waterD: '#3a6ab0' },
    canopy: ['#e0662e', '#f08a2a', '#c8442a', '#f2b23a', '#d9542a'], rare: '#8a2a2a', pine: ['#4a6a3a', '#5a7a3a', '#3e5a34', '#6a7a3a'], trunk: '#5a3a2a',
    hills: ['#c8a64a', '#d8b456', '#a89040', '#e0c060'], cliff: ['#8a7a72', '#9a8a80', '#7a6c66', '#a0908a'],
    struct: { stone: '#d8c8b0', stoneDark: '#a8947c', roof: '#c8442a', trim: '#5a3a2a', metal: '#5a5450', wood: '#8a5a3a' } },
  winter: { rock: ['#8fa0b8', '#9aaac2', '#8394ac', '#a6b4ca'], rockB: '#b4c0d2', pebble: '#c8d2e0', tuft: '#c8d8e2',
    ground: { lime: '#f4f8fc', grass: '#dfe9f2', teal: '#b8cce0', brush: '#cfdde8', forest: '#a8bccc', stone: '#c8d2dc', lilac: '#b8c0d8',
      sand: '#e8e4dc', dirt: '#c8bcb0', road: '#b8b0a8', roadEdge: '#d4ccc4', shore: '#e6eef6', foam: '#ffffff', waterL: '#9cd2f0', waterD: '#5a9ad8' },
    canopy: ['#f2f6fa', '#e6eef6', '#dce8f2', '#ffffff', '#eaf2f8'], rare: '#c84a4a', pine: ['#2f5a5a', '#3a6a68', '#284e50', '#46746e'], trunk: '#5a4a5a',
    hills: ['#eef4fa', '#e2ecf4', '#f8fbfd', '#d8e4ee'], cliff: ['#9aa8c0', '#a8b6cc', '#8e9cb4', '#b4c0d4'],
    struct: { stone: '#d4dce6', stoneDark: '#9aa8b8', roof: '#c84a4a', trim: '#2f5a5a', metal: '#4a5468', wood: '#7a6050' } },
  canyon: { rock: ['#c8643a', '#d67444', '#b85632', '#e0844e'], rockB: '#d8885a', pebble: '#e0a070', tuft: '#a8a050',
    ground: { lime: '#f0c890', grass: '#e2b07a', teal: '#c88a5a', brush: '#b8a060', forest: '#8a8a4a', stone: '#d8a07a', lilac: '#c87a5a',
      sand: '#f4d8a8', dirt: '#e0a46a', road: '#fbe8c4', roadEdge: '#e8c48e', shore: '#f0dcaa', foam: '#c8f0ea', waterL: '#4ad0c8', waterD: '#2a98b0' },
    canopy: ['#7a9a3a', '#8aa848', '#6a8a34', '#9ab050', '#7a9a3a'], rare: '#e86aa0', pine: ['#4a8a4a', '#5a9a50', '#3e7a44', '#6aa858'], trunk: '#6a4a3a',
    hills: ['#e8b880', '#f0c690', '#d8a470', '#f4d0a0'], cliff: ['#c8643a', '#d67444', '#b85632', '#e0844e'],
    struct: { stone: '#ecd2b0', stoneDark: '#c09a74', roof: '#2a98b0', trim: '#6a4a3a', metal: '#5a5058', wood: '#a0704a' } },
  tropical: { rock: ['#5a5a6a', '#686878', '#4e4e5e', '#747484'], rockB: '#7a7a8a', pebble: '#8a8a98', tuft: '#2fb05a',
    ground: { lime: '#7ae048', grass: '#2fc05a', teal: '#18a070', brush: '#22a85a', forest: '#16784a', stone: '#8ab070', lilac: '#7a7a8a',
      sand: '#f8ecc4', dirt: '#e8d4a0', road: '#fff6dc', roadEdge: '#f0dca8', shore: '#fff2c8', foam: '#d8fff6', waterL: '#2ee0d0', waterD: '#0a9ac8' },
    canopy: ['#f04a8a', '#ff7aa8', '#e8306a', '#ffa03a', '#f04a8a'], rare: '#ffffff', pine: ['#1a8a4a', '#24a058', '#16703e', '#2eb060'], trunk: '#8a5a3a',
    hills: ['#2ec85a', '#48d86a', '#22b050', '#5ee070'], cliff: ['#5a5a6a', '#686878', '#4e4e5e', '#747484'],
    struct: { stone: '#f0e6cc', stoneDark: '#c8b890', roof: '#f04a8a', trim: '#0a9ac8', metal: '#4e5a66', wood: '#8a5a3a' } },
  sakura: { rock: ['#a898c8', '#b4a4d4', '#9c8cbc', '#c0b0dc'], rockB: '#c0b4d8', pebble: '#d0c6e4', tuft: '#9ad890',
    ground: { lime: '#d8f0a8', grass: '#a8e0a0', teal: '#88c8b0', brush: '#98d098', forest: '#78b090', stone: '#c8d8b0', lilac: '#c4b8dc',
      sand: '#f6e6cc', dirt: '#e8ccb0', road: '#fff2e4', roadEdge: '#f0d8c4', shore: '#f8e8d0', foam: '#e0f4fa', waterL: '#9ad0f4', waterD: '#6aa6e8' },
    canopy: ['#f8b0c8', '#fcc8d8', '#f098b8', '#ffd8e6', '#f4a4c0'], rare: '#ffffff', pine: ['#5aa890', '#68b89c', '#4e9882', '#78c4a8'], trunk: '#6a5a8a',
    hills: ['#a8e0a0', '#bce8b0', '#94d494', '#c8eebc'], cliff: ['#a898c8', '#b4a4d4', '#9c8cbc', '#c0b0dc'],
    struct: { stone: '#f4ecf0', stoneDark: '#c8b8cc', roof: '#f098b8', trim: '#6a5a8a', metal: '#6a6a88', wood: '#a8806a' } },
  dusk: { rock: ['#4a3a6a', '#56467a', '#40325e', '#624e86'], rockB: '#6a5a8a', pebble: '#7a6a9a', tuft: '#3a6a7a',
    ground: { lime: '#5a7aa0', grass: '#3e5a88', teal: '#2a3e6a', brush: '#36507a', forest: '#24345a', stone: '#5a5a7a', lilac: '#5a4a7a',
      sand: '#a87a8a', dirt: '#8a6078', road: '#e0a088', roadEdge: '#b8807e', shore: '#c89a96', foam: '#f0c0b0', waterL: '#e08070', waterD: '#7a3a6a' },
    canopy: ['#ff8a5a', '#ffa86a', '#f06a5a', '#ffc07a', '#ff7a6a'], rare: '#ffe6a0', pine: ['#2a4a6a', '#34587a', '#22405e', '#3e6488'], trunk: '#1e2448',
    hills: ['#3a5084', '#46609a', '#30447a', '#5470a8'], cliff: ['#4a3a6a', '#56467a', '#40325e', '#624e86'],
    struct: { stone: '#8a7ea0', stoneDark: '#5e5478', roof: '#ff8a5a', trim: '#ffe6a0', metal: '#2e3450', wood: '#5a4060' } },
  volcanic: { rock: ['#2a2628', '#343032', '#222020', '#3e383a'], rockB: '#3a3436', pebble: '#4a4446', tuft: '#5a5048',
    ground: { lime: '#6a6060', grass: '#544c4c', teal: '#3e3838', brush: '#4a4242', forest: '#342e2e', stone: '#5a5250', lilac: '#3a3436',
      sand: '#7a6a5e', dirt: '#5e5048', road: '#a88a6a', roadEdge: '#7a6452', shore: '#c85a2a', foam: '#ffb03a', waterL: '#ff7a1a', waterD: '#d0300a' },
    canopy: ['#5a4a46', '#6a5652', '#4a3e3c', '#7a625c', '#5a4a46'], rare: '#ff6a2a', pine: ['#3a3634', '#46403e', '#2e2a28', '#524a46'], trunk: '#1a1616',
    hills: ['#3e3838', '#4a4242', '#342e2e', '#544c4c'], cliff: ['#2a2628', '#343032', '#222020', '#3e383a'],
    struct: { stone: '#6a6260', stoneDark: '#3e3838', roof: '#ff6a2a', trim: '#d0300a', metal: '#2a2628', wood: '#4a3a32' } },
  alien: { rock: ['#c8409a', '#d850aa', '#b4348a', '#e866b8'], rockB: '#d860a8', pebble: '#e888c0', tuft: '#30d0b0',
    ground: { lime: '#7af0d0', grass: '#30c8b0', teal: '#1a8a90', brush: '#28b0a0', forest: '#16707a', stone: '#80c8b0', lilac: '#b860a8',
      sand: '#e8e080', dirt: '#c8c060', road: '#f8f4b0', roadEdge: '#e0d880', shore: '#f0e890', foam: '#e8ffa0', waterL: '#b8f040', waterD: '#68b020' },
    canopy: ['#ffd23a', '#ffe060', '#f0b820', '#fff080', '#ffc830'], rare: '#ff4ad0', pine: ['#7a3ac8', '#8a4ad8', '#6a2eb4', '#9a5ae6'], trunk: '#2a1a4a',
    hills: ['#30c8b0', '#48d8c0', '#22b0a0', '#5ee6cc'], cliff: ['#c8409a', '#d850aa', '#b4348a', '#e866b8'],
    struct: { stone: '#d8e8f0', stoneDark: '#90a8c0', roof: '#ffd23a', trim: '#7a3ac8', metal: '#3a3a6a', wood: '#6a4a8a' } },
  highlands: { rock: ['#8a8c90', '#96989c', '#7e8084', '#a2a4a8'], rockB: '#a0a2a4', pebble: '#b0b2b4', tuft: '#6a8a5a',
    ground: { lime: '#9aae6a', grass: '#7a9a5e', teal: '#5a7a5a', brush: '#8a6a8a', forest: '#4a6448', stone: '#9aa08a', lilac: '#8e8e94',
      sand: '#c8b890', dirt: '#a8946e', road: '#d8ccaa', roadEdge: '#b8a87e', shore: '#c8c0a0', foam: '#d8e4e8', waterL: '#7a9ab0', waterD: '#4a6a84' },
    canopy: ['#5a7a4a', '#6a8a52', '#4e6a42', '#7a9a5a', '#a87a3a'], rare: '#a86aa8', pine: ['#2e4a3a', '#385646', '#263e32', '#426250'], trunk: '#4a3e36',
    hills: ['#7a9a5e', '#8aa86a', '#6a8a54', '#96b072'], cliff: ['#8a8c90', '#96989c', '#7e8084', '#a2a4a8'],
    struct: { stone: '#c8c4b8', stoneDark: '#8e8a80', roof: '#4a5a6a', trim: '#a86aa8', metal: '#4a4e54', wood: '#6a5240' } },
  savanna: { rock: ['#b8704a', '#c47c54', '#a8643e', '#d08a5e'], rockB: '#c88a64', pebble: '#d4a07a', tuft: '#d8b860',
    ground: { lime: '#f0d878', grass: '#dcc062', teal: '#b8a050', brush: '#c8b05a', forest: '#9a8a48', stone: '#d0b88a', lilac: '#c09070',
      sand: '#f4dca0', dirt: '#d8a868', road: '#fcecc4', roadEdge: '#e8cc90', shore: '#eedca0', foam: '#d0eef0', waterL: '#6ab8d8', waterD: '#3a80b0' },
    canopy: ['#6a8a3a', '#7a9a44', '#5a7a32', '#8aa84e', '#6a8a3a'], rare: '#e0a040', pine: ['#5a7a3a', '#688a44', '#4e6a34', '#78964e'], trunk: '#4a3628',
    hills: ['#dcc062', '#e8cc6e', '#c8ae56', '#f0d87a'], cliff: ['#b8704a', '#c47c54', '#a8643e', '#d08a5e'],
    struct: { stone: '#f0dcb4', stoneDark: '#c8a87a', roof: '#b8704a', trim: '#4a3628', metal: '#5a5048', wood: '#8a6040' } },
});

/**
 * Resource crystal colours (LPS [MM-story_mv87jzov_9]). NOT per world on purpose: the colour IS the economy
 * legend (blue / yellow pay gold, red / green are the quest crystals — harvest.js), so it must read the same
 * in every world. Brighter than the Pixi fallback tints because the facets are Lambert-shaded.
 */
export const CRYSTAL = Object.freeze({ blue: '#5aa8f0', yellow: '#f2c84a', red: '#e85050', green: '#52c070' });

export const WORLD_LIGHT = Object.freeze({
  meadow: { clear: 0xd8b888, apron: 0x3f8e2e, ambient: 0.13, hemi: [0xffe4bc, 0x4e7a34, 0.48], sun: [0xffdcaa, 1.28] },   // golden low sun, warm haze [MM-task_mvenabc8_s]
  autumn: { clear: 0xd8a070, apron: 0xc8a64a, ambient: 0.16, hemi: [0xffe0b0, 0x8a6a3a, 0.5], sun: [0xffc890, 1.1] },
  winter: { clear: 0xb8cce4, apron: 0xeef4fa, ambient: 0.1, hemi: [0xe8f2ff, 0xb0c0d0, 0.55], sun: [0xfff6ec, 0.9] },
  canyon: { clear: 0x8ac0e8, apron: 0xe8b880, ambient: 0.16, hemi: [0xd8ecff, 0xc88a5a, 0.5], sun: [0xfff0d0, 1.15] },
  tropical: { clear: 0x58c0f0, apron: 0x2ec85a, ambient: 0.16, hemi: [0xd0f4ff, 0x4ab070, 0.5], sun: [0xfff8e0, 1.15] },
  sakura: { clear: 0xb8d4f4, apron: 0xa8e0a0, ambient: 0.16, hemi: [0xf0e8ff, 0xa8c8a0, 0.55], sun: [0xfff0f0, 0.95] },
  dusk: { clear: 0x6a4a8a, apron: 0x3a5084, ambient: 0.16, hemi: [0xff9a8a, 0x2a3060, 0.5], sun: [0xff9a5a, 1.2] },
  volcanic: { clear: 0x3a2420, apron: 0x3e3838, ambient: 0.2, hemi: [0xa86a5a, 0x2a1a18, 0.5], sun: [0xffb08a, 0.95] },
  alien: { clear: 0x5ad8a8, apron: 0x30c8b0, ambient: 0.16, hemi: [0xe8ffe0, 0x7a3ac8, 0.5], sun: [0xfff8c0, 1.05] },
  highlands: { clear: 0x9aa8b4, apron: 0x7a9a5e, ambient: 0.2, hemi: [0xd8e0e8, 0x6a7a5a, 0.6], sun: [0xf4f0e8, 0.75] },
  savanna: { clear: 0xf0c890, apron: 0xdcc062, ambient: 0.16, hemi: [0xfff0d0, 0xa88a50, 0.5], sun: [0xfff0c0, 1.2] },
});

export const PALETTE_KEYS = Object.freeze(Object.keys(LOWPAL));
export const DEFAULT_WORLD = 'meadow';

/** A world key → a valid one (unknown / empty → the default). */
export function resolveWorld(key) {
  const k = typeof key === 'string' ? key.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(LOWPAL, k) ? k : DEFAULT_WORLD;
}
