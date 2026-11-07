#!/usr/bin/env node
// outpost_raids.mjs — measure each planet's raid size on the battle sim [MM-story_mw5oegk1_o].
//
//     node tools/economy/outpost_raids.mjs            # measure every planet × contract step and print the table
//     node tools/economy/outpost_raids.mjs --write    # … then write Outpost_Raids to the workbook and re-extract
//     node tools/economy/outpost_raids.mjs ground     # one planet (prints only; --write needs all nine)
//
// Design docs/16 Bulwark MM/design/Outpost-Design.md §5.2; tech plan docs/tech-plan/Outpost.md §4.3. Raid size is
// the dial: for each planet and contract step it runs raid after raid on the battle sim (src/outpost/raid.js, the
// same runRaid the game runs), with no repairs, against the starter kit and the "well defended" set (the kit plus one
// Machine Gun, raid.js wellDefended), and keeps the size whose median raids-held-before-the-first-breach over
// MEASURE_SEEDS is closest to the design's 5 (kit) and 8 (well defended). Raiders are the faction's tier I lightGround
// units, Units cycled in order (troops, troops, assault tank).
//
// The map: each planet's own outpost map (content/maps/forge/<planet>-outpost.json); a planet without one yet is
// measured on Verdance's map (ground-outpost.json) with its own units, and the table says so. Re-run after any retune
// of a tower or unit in tables.js, or a change to an outpost map (the --write run is the whole pipeline: measure →
// tools/economy/write_outpost_raids.py → tools/extract_mapdata.py → MAPDATA.outpostRaids → raidFor()).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const G = path.join(ROOT, 'prototype/test-game');
const imp = (p) => import(pathToFileURL(path.join(G, p)).href);
const { outpostMapFromForge } = await imp('src/outpost/outpostMap.js');
const { stepOutpost, wellDefended, holdsBeforeBreach, MEASURE_SEEDS } = await imp('src/outpost/raid.js');
const { UNITS } = await imp('src/data/tables.js');
await imp('src/data/factions.js');
const REG = globalThis.BulwarkFactions;

const PLANETS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];
const TARGET = { kit: 5, well: 8 };          // design §5.2
const MAX_SIZE = 8, MAX_RAIDS = 20, FAR_DAY_BUMP = 1;
const args = process.argv.slice(2), write = args.includes('--write'), only = args.find((a) => !a.startsWith('--'));

const mapFile = (p) => path.join(G, 'content/maps/forge', `${p}-outpost.json`);
const loadMap = (p) => outpostMapFromForge(JSON.parse(fs.readFileSync(mapFile(p), 'utf8')), p);
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];

/** The faction's tier I lightGround units, troops first, as the raid's Units cycle (troops, troops, tank). */
function unitsOf(planet) {
  const pre = REG.find(planet).prefix;
  const troops = `${pre}-Troops`, tanks = `${pre}-Tanks`;
  for (const id of [troops, tanks]) if (!UNITS[id] || !UNITS[id].lightGround) throw new Error(`${id} is not a lightGround unit`);
  return [troops, troops, tanks];
}

function measure(planet, step, map, cycle) {
  const tried = [];
  for (let size = 1; size <= MAX_SIZE; size++) {
    const units = Array.from({ length: size }, (_, i) => cycle[i % cycle.length]);
    const kit = MEASURE_SEEDS.map((seed) => holdsBeforeBreach(stepOutpost(planet, step, { map, seed }), { map, step, units, max: MAX_RAIDS }));
    const well = MEASURE_SEEDS.map((seed) => holdsBeforeBreach(wellDefended(stepOutpost(planet, step, { map, seed }), map), { map, step, units, max: MAX_RAIDS }));
    const t = { size, kit: median(kit), well: median(well), kitAll: kit, wellAll: well };
    t.err = Math.abs(t.kit - TARGET.kit) + Math.abs(t.well - TARGET.well);
    tried.push(t);
    if (t.kit <= 1 && t.well <= 1) break;    // larger raids only breach sooner
  }
  return tried.reduce((b, t) => (t.err < b.err ? t : b), tried[0]);
}

const t0 = performance.now();
const rows = [];
console.log(`# Outpost raids — measured on the battle sim (median of ${MEASURE_SEEDS.length} outpost seeds; targets: kit ${TARGET.kit}, well defended ${TARGET.well})\n`);
console.log('| Planet | Map | Units | Step | Size | Kit holds (median; all seeds) | Well defended holds (median; all seeds) |\n|---|---|---|---|---|---|---|');
for (const planet of PLANETS.filter((p) => !only || p === only)) {
  const own = fs.existsSync(mapFile(planet));
  const map = loadMap(own ? planet : 'ground');
  const cycle = unitsOf(planet), sizes = [];
  for (const step of [1, 2, 3]) {
    const m = measure(planet, step, map, cycle);
    sizes.push(m.size);
    console.log(`| ${planet} | ${own ? 'own' : 'Verdance (no map yet)'} | ${[...new Set(cycle)].join(', ')} | ${step} | ${m.size} | ${m.kit}; ${m.kitAll.join(' ')} | ${m.well}; ${m.wellAll.join(' ')} |`);
  }
  rows.push({ Planet_Key: planet, Units: cycle.join(' '), Size_Step1: sizes[0], Size_Step2: sizes[1], Size_Step3: sizes[2],
    Far_Day_Bump: FAR_DAY_BUMP, Measured_On: own ? `${planet}-outpost` : 'ground-outpost' });
}
console.log(`\nmeasured in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

if (write) {
  if (rows.length !== PLANETS.length) throw new Error('--write needs every planet (run without a planet argument)');
  const tmp = path.join(fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'raids-')), 'raids.json');
  fs.writeFileSync(tmp, JSON.stringify(rows));
  execFileSync('python3', [path.join(ROOT, 'tools/economy/write_outpost_raids.py'), tmp], { stdio: 'inherit' });
  execFileSync('python3', [path.join(ROOT, 'tools/extract_mapdata.py')], { stdio: 'inherit' });
}
