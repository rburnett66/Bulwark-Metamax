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
 *   2. node tools/maps/outpost-maps.mjs jobs <jobs.json> [planet…] — write the Forge job for each one's best seed;
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
const { stampOutpost, deriveConduits, validateOutpostLayout, padSizeFor } = await imp('src/terrain/outpostPads.js');
const { PLANET_RECIPES, evaluate, passes } = await imp('tools/maps/faction-maps.mjs');
const POWDER = JSON.parse(fs.readFileSync(R + 'content/maps/forge/powder-map-1.json', 'utf8'));

const pad = (id, x, y, role, extra = {}) => ({ id, x, y, w: padSizeFor(role), h: padSizeFor(role), role, ...extra });

/** Planet key (src/data/planets.js) → its faction slug (the Forge slot names, tools/maps/faction-maps.mjs). */
export const PLANET_SLUGS = Object.freeze({
  ground: 'powder', air: 'air', hightech: 'high-tech', artillery: 'artillery', water: 'water',
  arcane: 'arcane-energy', space: 'space-tech', dark: 'dark-energy', greenies: 'greenies',
});
const PLANET_NAMES = { ground: 'Verdance', air: 'Florael', hightech: 'Ochre', artillery: 'Kessra', water: 'Rime',
  arcane: 'Cinder', space: 'Lumen', dark: 'Xenthe', greenies: 'Vexmire' };
/** Each recipe's measured impassable share on its battle maps (faction-maps.mjs), the seed search's target. */
const IMP_TARGET = { powder: 19.7, air: 12.9, 'high-tech': 12.6, artillery: 19.4, water: 23.8, 'arcane-energy': 19.7,
  'space-tech': 14.3, 'dark-energy': 20.6, greenies: 20.5 };

/**
 * The outpost layer every planet shares (O4 Verdance's; O11 [MM-story_mw5oeob4_s] gives it to the other eight): the
 * large maps' 64 × 32 world, the hub centred on their base (31, 15). The mesa (21 × 19 cells) carries the hub and
 * seven pads within 10 cells of Power Station I on p1, with 1-cell walkways between them. The common ore sits on r1
 * and the uncommon on r2 at the mesa edge; the rare ore is remote in the west lowland on r3, with its own power pad
 * p2. Raids come in from the west edge (past the remote site, up the west ramp) and the east edge (up the south ramp).
 * One layout for all nine keeps the raid measurement comparable planet to planet (the same reference walls, the same
 * ramps); what differs is each planet's recipe, seed, decor, resources, palette and raiders.
 */
const SHARED = {
    mesa: { cx: 35.5, cy: 14.5, rx: 10.5, ry: 9.5, ramps: [{ x: 24, y: 14, w: 3, h: 2 }, { x: 38, y: 23, w: 2, h: 2 }] },
    // half scale (owner 2026-11-08): a 3 × 3 hub on the base's cells (30–32, 14–16) and 2 × 2 pads packed round it with
    // 1-cell walkways — the bays north, the station and storage east, the uncommon rig beyond the station, the common
    // rig south. The west half of the mesa (the west ramp's side) is left open for defenses. The remote rare site keeps
    // its place in the west lowland (the pads centred in their authored clearings).
    pads: [
      pad('hub', 30, 14, 'hub'),
      pad('p1', 34, 13, 'power'),
      pad('r1', 30, 18, 'rig'),
      pad('s1', 34, 16, 'storage'),
      pad('r2', 37, 13, 'rig'),
      pad('b1', 29, 11, 'bay'),
      pad('b2', 32, 11, 'bay'),
      pad('x1', 35, 10, 'spare'),
      pad('r3', 16, 18, 'rig', { remote: true }),
      pad('p2', 16, 12, 'power', { remote: true }),
    ],
    deposits: [
      { tier: 'common', x: 30, y: 18, pad: 'r1' },
      { tier: 'uncommon', x: 37, y: 13, pad: 'r2' },
      { tier: 'rare', x: 16, y: 18, pad: 'r3' },
    ],
    // design §2.3: a Cannon, a Machine Gun and a wall ring — the cannon covers the west ramp, the MG the south ramp and
    // the mesa's south-east corner. The walls CLOSE the ways onto the mesa (O7, measured on the raid sim): walls that
    // only flank a ramp let a lone tier I troop walk past the guns to the hub, 1–2 cells from the ramp head. They
    // close the west ramp head (26,14–15), the south ramp head (38–39,22) and the south-east corner (43,21)+(44,20),
    // where the battle's baked cliff (buildTerrainMap's bake warp) opens the rim cell (44,21) to the lowland.
    kitDefenses: [
      { kind: 'cannon', cell: [27, 13] },
      { kind: 'mg', cell: [42, 20] },
      ...[[26, 14], [26, 15], [38, 22], [39, 22], [43, 21], [44, 20]].map((cell) => ({ kind: 'wall', cell })),
    ],
    lanes: [{ x: 0, y: 6, lane: 'ground' }, { x: 63, y: 26, lane: 'ground' }],
};

/** Per-planet changes to SHARED, where a planet's own terrain needs them. `seed` pins the seed `jobs` uses in place of
 *  the search's best. Lumen: the best seed (178) came out of the Forge with 1 decor grove (its battle maps have about
 *  5); 191 is the passing seed among the search's top 12 with the most (10), at 14.4 % impassable. */
const OVERRIDES = { space: { seed: 191 } };

/** Every planet's authored outpost layer: a fresh copy of SHARED each (editing one never edits another). */
export const OUTPOST_LAYOUTS = Object.fromEntries(Object.entries(PLANET_SLUGS).map(([planet, slug]) => [planet, {
  planet, name: PLANET_NAMES[planet], slug, ...structuredClone(SHARED), ...structuredClone(OVERRIDES[planet] || {}),
}]));

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
 * Not applied: Rime's pond-shortcut rule (§1, a swimmer's route beats a walker's). Outpost raids are light ground
 * only (Outpost-Design §5.2), and each lane is worn into a straight cart track to its ramp, so no seed of 400 gives a
 * swimmer a shorter way (measured O11: gain 0 %, mean ≈ 1.0 on every seed); Rime's ponds are still there.
 */
export function outpostChecks(forge) {
  const lanes = (forge.spawns || []).filter((s) => s.lane === 'ground');
  const e = evaluate({ ...forge, spawnsByWave: { 1: lanes.slice(0, 1), 2: lanes.slice(1, 2) } });
  const slug = (OUTPOST_LAYOUTS[forge.planet] || OUTPOST_LAYOUTS.ground).slug;
  const guard = passes(slug, e).filter((f) => !f.startsWith('pond shortcut'));
  return { e, fails: [...guard, ...validateOutpostLayout(forge)] };
}

/** Seeds that pass, best first: impassable nearest the recipe's measured share on its battle maps and well-connected
 *  open ground; on Verdance about 9 farm ponds (its signature, Faction-Terrain-Design §3.1), on Rime's pond-field
 *  recipe the most ponds (its signature, §3.5). */
export function searchSeeds(planet, { from = 1, to = 400 } = {}) {
  const used = new Set(fs.readdirSync(R + 'content/maps/forge').filter((f) => /-map-\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(R + 'content/maps/forge/' + f, 'utf8'))).filter((m) => m.types && JSON.stringify(m.types) === JSON.stringify(layoutFor(planet).recipe.types)).map((m) => m.seed));
  const ok = [];
  for (let seed = from; seed <= to; seed++) {
    if (used.has(seed)) continue;   // a layout of its own, not a battle map's
    const { e, fails } = outpostChecks(outpostForgeFor(planet, seed).forge);
    if (!fails.length) ok.push({ seed, e });
  }
  const slug = OUTPOST_LAYOUTS[planet].slug, target = Math.min(23, Math.max(13, IMP_TARGET[slug]));
  const score = slug === 'powder' ? (e) => -Math.abs(e.impPct - 19.7) + 5 * e.openReach - 0.2 * Math.abs(e.ponds - 9)
    : (e) => -Math.abs(e.impPct - target) + 5 * e.openReach + (PLANET_RECIPES[slug].ponds ? 0.3 * Math.min(e.ponds, 16) : 0);
  return ok.sort((a, b) => score(b.e) - score(a.e));
}

/** The Forge job for a planet and seed: the knobs loadState() reads plus the outpost layer. */
export function jobFor(planet, seed) {
  const { forge } = outpostForgeFor(planet, seed);
  const { terrain, blocking, heights, resources, decor, ...knobs } = forge;
  return knobs;
}

if (process.argv[1] && process.argv[1].endsWith('outpost-maps.mjs')) {
  const [cmd, file, ...only] = process.argv.slice(2);
  if (cmd === 'jobs') {
    const jobs = {};
    for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
      if (only.length && !only.includes(planet)) continue;
      const pinned = OUTPOST_LAYOUTS[planet].seed;
      const [best] = pinned ? [{ seed: pinned, ...outpostChecks(outpostForgeFor(planet, pinned).forge) }] : searchSeeds(planet);
      if (!best || (best.fails && best.fails.length)) throw new Error(`${planet}: no seed passes`);
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
