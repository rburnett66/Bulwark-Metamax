/**
 * tools/maps/outpost-maps.mjs — authoring the outpost maps (tech plan docs/tech-plan/Outpost.md §6.6)
 * [MM-story_mw5oeatc_l].
 *
 * Each planet's outpost map is a Terrain Forge map: the planet's §2.3 recipe for the ground (Faction-Terrain-Design),
 * with the outpost layer on top (src/terrain/outpostPads.js: the mesa, pads, deposits, conduits, kit defenses and the
 * two raid lanes). The layout below is the hand-authored part; the terrain comes from the recipe and a seed.
 *
 *   1. node tools/maps/outpost-maps.mjs jobs <jobs.json>       — pick the seed (the first whose stamped map passes
 *      validateOutpostLayout with a recipe-like share of blocked lowland) and write the Forge job;
 *   2. python3 tools/maps/forge-export.py <jobs.json> <out.json> — the REAL Terrain Forge (terrain.html, headless)
 *      loads the job, stamps the mesa, scatters decor and exports exactly what "Export outpost file" writes;
 *   3. node tools/maps/outpost-maps.mjs write <out.json>       — validate and write content/maps/forge/<planet>-outpost.json.
 *
 * After that the map is edited in the Forge (🏗 Outpost panel) like any other map; outpost-maps.test.mjs keeps the
 * shipped file valid.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') + '/';
const imp = (p) => import(pathToFileURL(R + p).href);
const { generateTerrain, placeBase } = await imp('src/terrain/terrainGen.js');
const { stampOutpost, deriveConduits, validateOutpostLayout } = await imp('src/terrain/outpostPads.js');
const { VERDANCE } = await imp('tools/maps/faction-maps.mjs');

const pad = (id, x, y, role, extra = {}) => ({ id, x, y, w: role === 'hub' ? 6 : 4, h: role === 'hub' ? 6 : 4, role, ...extra });

/**
 * Verdance (planet key 'ground'): a 40 × 24 map. The mesa (a rounded rectangle 22 × 19) carries the hub and seven pads
 * within 10 cells of Power Station I on p1, with 1-cell walkways between them. Iron sits on r1 at the south edge,
 * aluminum on r2 at the east edge; lithium is remote in the west lowland on r3, with its own power pad p2. Raids come
 * from the north-west corner (past the remote site, up the west ramp) and the east edge (up the south ramp).
 */
export const OUTPOST_LAYOUTS = {
  ground: {
    planet: 'ground', name: 'Verdance', recipe: VERDANCE, cols: 40, rows: 24,
    mesa: { cx: 23.5, cy: 11.5, rx: 10.5, ry: 9.5, ramps: [{ x: 12, y: 11, w: 3, h: 2 }, { x: 26, y: 20, w: 2, h: 2 }] },
    pads: [
      pad('hub', 16, 9, 'hub'),
      pad('p1', 23, 9, 'power'),
      pad('r1', 17, 16, 'rig'),
      pad('s1', 23, 14, 'storage'),
      pad('r2', 28, 11, 'rig'),
      pad('b1', 18, 4, 'bay'),
      pad('b2', 23, 4, 'bay'),
      pad('x1', 28, 6, 'spare'),
      pad('r3', 3, 14, 'rig', { remote: true }),
      pad('p2', 3, 8, 'power', { remote: true }),
    ],
    deposits: [
      { tier: 'common', x: 17, y: 16, pad: 'r1' },
      { tier: 'uncommon', x: 30, y: 11, pad: 'r2' },
      { tier: 'rare', x: 3, y: 16, pad: 'r3' },
    ],
    // design §2.3: a Cannon, a Machine Gun and a wall ring — the cannon covers the west ramp, the MG the south ramp,
    // and the walls flank both ramp heads
    kitDefenses: [
      { kind: 'cannon', cell: [15, 10] },
      { kind: 'mg', cell: [28, 18] },
      ...[[14, 9], [14, 10], [14, 13], [14, 14], [25, 19], [28, 19]].map((cell) => ({ kind: 'wall', cell })),
    ],
    lanes: [{ x: 0, y: 3, lane: 'ground' }, { x: 39, y: 19, lane: 'ground' }],
  },
};

/** The layout with its derived conduits (the Forge's default: auto from reach). */
export function layoutFor(planet) {
  const L = OUTPOST_LAYOUTS[planet];
  return { ...L, conduits: deriveConduits(L) };
}

/** The stamped grid for a seed, as node sees it (the Forge adds decor on top). */
export function stampFor(planet, seed) {
  const L = layoutFor(planet);
  const g = generateTerrain({ cols: L.cols, rows: L.rows, seed, types: L.recipe.types, water: L.recipe.water });
  const hub = L.pads.find((p) => p.role === 'hub');
  placeBase(g, 2, { x: Math.floor(hub.x + hub.w / 2), y: Math.floor(hub.y + hub.h / 2) });
  stampOutpost(g, { mesa: L.mesa, pads: L.pads, spawns: L.lanes, kitDefenses: L.kitDefenses });
  const map = { cols: L.cols, rows: L.rows, terrain: g.terrain, blocking: g.blocking, heights: g.heights, mesa: L.mesa,
    pads: L.pads, deposits: L.deposits, conduits: L.conduits, kitDefenses: L.kitDefenses, spawns: L.lanes };
  return { g, map, problems: validateOutpostLayout(map) };
}

/** Share of the lowland (off the mesa) that blocks, for picking a seed that reads like the planet. */
function lowlandBlocked({ g }) {
  let n = 0, b = 0;
  for (let i = 0; i < g.terrain.length; i++) if (!g.heights[i]) { n++; if (g.blocking[i]) b++; }
  return b / n;
}

/** The Forge job for a planet: the knobs loadState() reads plus the outpost layer. */
export function jobFor(planet, seed) {
  const L = layoutFor(planet);
  return {
    _tool: 'terrain-forge', _version: 2, cols: L.cols, rows: L.rows, seed, types: L.recipe.types, water: L.recipe.water,
    worldMode: false, base: { pos: null, gap: 2 }, spawnTuning: { edge: 'window', ground: 2, air: 0, water: 0, spread: 1, bias: 0.5, spacing: 2 },
    spawnsByWave: { 1: L.lanes }, spawns: L.lanes,
    planet, outpost: true, mesa: L.mesa, pads: L.pads, deposits: L.deposits, conduits: L.conduits, autoConduits: true,
    kitDefenses: L.kitDefenses,
  };
}

export function pickSeed(planet, { from = 1, to = 400, band = [0.12, 0.24] } = {}) {
  for (let seed = from; seed <= to; seed++) {
    const s = stampFor(planet, seed);
    const lb = lowlandBlocked(s);
    if (!s.problems.length && lb >= band[0] && lb <= band[1]) return { seed, lowlandBlocked: lb };
  }
  return null;
}

if (process.argv[1] && process.argv[1].endsWith('outpost-maps.mjs')) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === 'jobs') {
    const jobs = {};
    for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
      const pick = pickSeed(planet);
      if (!pick) throw new Error(`${planet}: no seed passes`);
      console.log(planet, 'seed', pick.seed, 'lowland blocked', (100 * pick.lowlandBlocked).toFixed(1) + '%');
      jobs[`${planet}-outpost`] = jobFor(planet, pick.seed);
    }
    fs.writeFileSync(file, JSON.stringify(jobs, null, 1));
  } else if (cmd === 'write') {
    const out = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [name, obj] of Object.entries(out)) {
      const problems = validateOutpostLayout(obj);
      if (problems.length) throw new Error(`${name}: ${problems.join('; ')}`);
      const dest = path.join(R, 'content/maps/forge', `${name}.json`);
      fs.writeFileSync(dest, JSON.stringify(obj));
      console.log('wrote', path.relative(R, dest), `(${obj.decor.length} decor, ${obj.resources.length} resources)`);
    }
  } else {
    console.log('usage: node tools/maps/outpost-maps.mjs jobs <jobs.json> | write <out.json>');
  }
}
