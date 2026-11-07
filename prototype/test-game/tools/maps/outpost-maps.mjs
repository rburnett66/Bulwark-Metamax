/**
 * tools/maps/outpost-maps.mjs — authoring the outpost maps (tech plan docs/tech-plan/Outpost.md §6.6)
 * [MM-story_mw5oeatc_l].
 *
 * Owner 2026-11-07: the outpost maps are made exactly like the large tower-defense maps. Each is a 64 × 32 world-mode
 * Terrain Forge map on its planet's §2.3 recipe (Faction-Terrain-Design; Verdance is the 'powder' slug's recipe),
 * with the same base, wave windows, decor groves and resource fields as <slug>-map-N, passing the §1 fairness
 * guardrails, exported by the real Forge and baked to a 3D level. The outpost layer sits on top
 * (src/terrain/outpostPads.js): the mesa is stamped into the forge terrain itself (a stone top, a cliff rim, ramps,
 * cart tracks), so the bake and the battle renderer draw it; then pads, deposits, conduits, kit defenses and the two
 * raid lanes (the map's ground spawns).
 *
 *   1. node tools/maps/outpost-maps.mjs [planet]              — search seeds 1..400, print the best that pass;
 *   2. node tools/maps/outpost-maps.mjs jobs <jobs.json>       — write the Forge job for the best seed;
 *   3. python3 tools/maps/forge-export.py <jobs.json> <out.json> — the REAL Terrain Forge (terrain.html, headless)
 *      loads the job, stamps the mesa, scatters decor and exports exactly what "Export slot file" writes;
 *   4. node tools/maps/outpost-maps.mjs write <out.json>       — validate and write content/maps/forge/<planet>-outpost.json;
 *   5. node tools/terrain3d-proto/bake3d.mjs <planet>-outpost --no-tiles — its baked 3D level (content/maps/baked/).
 *
 * After that the map is edited in the Forge's Outpost panel like any other map; outpost-maps.test.mjs keeps the
 * shipped file on its recipe, inside the guardrails, valid, and in step with its bake.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') + '/';
const imp = (p) => import(pathToFileURL(R + p).href);
const { generateTerrain, placeBase } = await imp('src/terrain/terrainGen.js');
const { stampOutpost, deriveConduits, validateOutpostLayout } = await imp('src/terrain/outpostPads.js');
const { PLANET_RECIPES, evaluate, passes } = await imp('tools/maps/faction-maps.mjs');
const POWDER = JSON.parse(fs.readFileSync(R + 'content/maps/forge/powder-map-1.json', 'utf8'));

const pad = (id, x, y, role, extra = {}) => ({ id, x, y, w: role === 'hub' ? 6 : 4, h: role === 'hub' ? 6 : 4, role, ...extra });

/**
 * Verdance (planet key 'ground', faction slug 'powder'): the large maps' 64 × 32 world, the hub centred on their base
 * (31, 15). The mesa (21 × 19 cells) carries the hub and seven pads within 10 cells of Power Station I on p1, with
 * 1-cell walkways between them. Iron sits on r1 and aluminum on r2 at the mesa edge; lithium is remote in the west
 * lowland on r3, with its own power pad p2. Raids come in from the west edge (past the remote site, up the west ramp)
 * and the east edge (up the south ramp).
 */
export const OUTPOST_LAYOUTS = {
  ground: {
    planet: 'ground', name: 'Verdance', slug: 'powder',
    mesa: { cx: 35.5, cy: 14.5, rx: 10.5, ry: 9.5, ramps: [{ x: 24, y: 14, w: 3, h: 2 }, { x: 38, y: 23, w: 2, h: 2 }] },
    pads: [
      pad('hub', 28, 12, 'hub'),
      pad('p1', 35, 12, 'power'),
      pad('r1', 29, 19, 'rig'),
      pad('s1', 35, 17, 'storage'),
      pad('r2', 40, 14, 'rig'),
      pad('b1', 30, 7, 'bay'),
      pad('b2', 35, 7, 'bay'),
      pad('x1', 40, 9, 'spare'),
      pad('r3', 15, 17, 'rig', { remote: true }),
      pad('p2', 15, 11, 'power', { remote: true }),
    ],
    deposits: [
      { tier: 'common', x: 29, y: 19, pad: 'r1' },
      { tier: 'uncommon', x: 42, y: 14, pad: 'r2' },
      { tier: 'rare', x: 15, y: 19, pad: 'r3' },
    ],
    // design §2.3: a Cannon, a Machine Gun and a wall ring — the cannon covers the west ramp, the MG the south ramp,
    // and the walls flank both ramp heads
    kitDefenses: [
      { kind: 'cannon', cell: [27, 13] },
      { kind: 'mg', cell: [40, 21] },
      ...[[26, 12], [26, 13], [26, 16], [26, 17], [37, 22], [40, 22]].map((cell) => ({ kind: 'wall', cell })),
    ],
    lanes: [{ x: 0, y: 6, lane: 'ground' }, { x: 63, y: 26, lane: 'ground' }],
  },
};

/** The layout with its derived conduits (the Forge's default: auto from reach) and its planet recipe. */
export function layoutFor(planet) {
  const L = OUTPOST_LAYOUTS[planet];
  return { ...L, recipe: PLANET_RECIPES[L.slug], conduits: deriveConduits(L) };
}

/**
 * The forge object for a seed, as terrain.html render()/exportObj() builds it in world mode (minus decor and
 * resources, which the browser adds): faction-maps.mjs forgeFor's template (Powder map 1's base, wave windows and
 * spawn tuning) with the mesa stamped in and the raid lanes as the spawns. Also returns the stamped grid.
 */
export function outpostForgeFor(planet, seed) {
  const L = layoutFor(planet);
  const g = generateTerrain({ cols: POWDER.cols, rows: POWDER.rows, seed, types: L.recipe.types, water: L.recipe.water });
  const base = placeBase(g, POWDER.base.gap, { x: 31, y: 15 });
  stampOutpost(g, { mesa: L.mesa, pads: L.pads, spawns: L.lanes, kitDefenses: L.kitDefenses });
  const forge = {
    ...POWDER, seed, types: L.recipe.types, water: L.recipe.water, base: { pos: base.pos, gap: base.gap },
    spawnsByWave: { 1: L.lanes }, spawns: L.lanes, resources: [], decor: [],
    terrain: Array.from(g.terrain), blocking: Array.from(g.blocking),
    planet, outpost: true, autoConduits: true, mesa: L.mesa, pads: L.pads, deposits: L.deposits, conduits: L.conduits,
    kitDefenses: L.kitDefenses, heights: Array.from(g.heights),
  };
  return { forge, g };
}

/**
 * The §1 fairness guardrails on the map the game builds, where they apply to an outpost: impassable 12–24 %, every
 * raid lane reaches the base (the hub), no sealed pockets, and a second route for each lane (each lane is checked as
 * its own wave, since evaluate() looks for a second route from waves 1 and 2). Plus validateOutpostLayout.
 */
export function outpostChecks(forge) {
  const lanes = (forge.spawns || []).filter((s) => s.lane === 'ground');
  const e = evaluate({ ...forge, spawnsByWave: { 1: lanes.slice(0, 1), 2: lanes.slice(1, 2) } });
  return { e, fails: [...passes('powder', e), ...validateOutpostLayout(forge)] };
}

/** Seeds that pass, best first (impassable nearest Verdance's measured 19.7 %, well-connected open ground, and
 *  about 9 farm ponds — Verdance's signature, Faction-Terrain-Design §3.1). */
export function searchSeeds(planet, { from = 1, to = 400 } = {}) {
  const used = new Set(fs.readdirSync(R + 'content/maps/forge').filter((f) => /-map-\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(R + 'content/maps/forge/' + f, 'utf8'))).filter((m) => m.types && JSON.stringify(m.types) === JSON.stringify(layoutFor(planet).recipe.types)).map((m) => m.seed));
  const ok = [];
  for (let seed = from; seed <= to; seed++) {
    if (used.has(seed)) continue;   // a layout of its own, not a battle map's
    const { e, fails } = outpostChecks(outpostForgeFor(planet, seed).forge);
    if (!fails.length) ok.push({ seed, e });
  }
  const score = (e) => -Math.abs(e.impPct - 19.7) + 5 * e.openReach - 0.2 * Math.abs(e.ponds - 9);
  return ok.sort((a, b) => score(b.e) - score(a.e));
}

/** The Forge job for a planet and seed: the knobs loadState() reads plus the outpost layer. */
export function jobFor(planet, seed) {
  const { forge } = outpostForgeFor(planet, seed);
  const { terrain, blocking, heights, resources, decor, ...knobs } = forge;
  return knobs;
}

if (process.argv[1] && process.argv[1].endsWith('outpost-maps.mjs')) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === 'jobs') {
    const jobs = {};
    for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
      const [best] = searchSeeds(planet);
      if (!best) throw new Error(`${planet}: no seed passes`);
      console.log(planet, 'seed', best.seed, 'impassable', best.e.impPct.toFixed(1) + '%');
      jobs[`${planet}-outpost`] = jobFor(planet, best.seed);
    }
    fs.writeFileSync(file, JSON.stringify(jobs, null, 1));
  } else if (cmd === 'write') {
    const out = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [name, obj] of Object.entries(out)) {
      const { fails } = outpostChecks(obj);
      if (fails.length) throw new Error(`${name}: ${fails.join('; ')}`);
      const dest = path.join(R, 'content/maps/forge', `${name}.json`);
      fs.writeFileSync(dest, JSON.stringify(obj));
      console.log('wrote', path.relative(R, dest), `(${obj.cols}×${obj.rows}, seed ${obj.seed}, ${obj.decor.length} decor, ${obj.resources.length} resources)`);
    }
  } else {
    for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
      if (cmd && cmd !== planet) continue;
      const ok = searchSeeds(planet);
      console.log(planet, 'passing', ok.length + '/400');
      for (const { seed, e } of ok.slice(0, 5)) console.log(`   seed ${seed}: imp ${e.impPct.toFixed(1)}% water ${e.waterPct.toFixed(1)}% ponds ${e.ponds} reach ${(100 * e.openReach).toFixed(1)}%`);
    }
  }
}
