#!/usr/bin/env node
// outpost_raids.mjs — measure each planet's raid on the battle sim [MM-story_mw5oegk1_o].
//
//     node tools/economy/outpost_raids.mjs --write    # measure all nine (in parallel), write Outpost_Raids, re-extract
//     node tools/economy/outpost_raids.mjs            # measure all nine and print the table only
//     node tools/economy/outpost_raids.mjs ground     # one planet (prints only)
//     node tools/economy/outpost_raids.mjs dark greenies --write   # re-measure some planets, keep the others' rows
//
// Design docs/16 Bulwark MM/design/Outpost-Design.md §5.2 and the owner's decisions of 2026-11-07; tech plan
// docs/tech-plan/Outpost.md §4.3. It runs raid after raid on the battle sim (src/outpost/raid.js, the same runRaid the
// game runs), with no repairs, against the starter kit and the "well defended" set (the kit plus one Machine Gun,
// raid.js wellDefended), and keeps what puts the median raids-held-before-the-first-breach over MEASURE_SEEDS closest
// to the design's 5 (kit) and 8 (well defended):
//   - per planet, the raid-only strength (Raider_HP_Mult, Raider_Damage_Mult; owner: "weaker raiders") together with
//     the contract-1 raid size, over a grid, raids of at least MIN_SIZE (owner: sizes above one troop); ties go to the
//     strongest raiders, then the larger raid;
//   - per contract step 2 and 3, the size at those multipliers.
// Raiders: the faction's tier I lightGround troops and assault tanks (Units cycled: troops, troops, tank). A planet
// whose troops do nothing to a wall (EFFECTIVENESS vs Structure 0: Toxic) gets a Breacher (owner: "add a breacher
// unit"): the faction's own ground unit that hurts structures most, light ground first (none qualifies for Xenthe or
// Vexmire, so it is their Artillery; raid.js caps every raider's range at the outposts' longest gun).
//
// The map: each planet's own outpost map (content/maps/forge/<planet>-outpost.json); a planet without one yet is
// measured on Verdance's (ground-outpost.json) with its own units, and the table says so. Re-run after any retune of a
// tower or unit in tables.js, or a change to an outpost map: --write is the whole pipeline (measure →
// tools/economy/write_outpost_raids.py → tools/extract_mapdata.py → MAPDATA.outpostRaids → raidFor()).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const G = path.join(ROOT, 'prototype/test-game');
const imp = (p) => import(pathToFileURL(path.join(G, p)).href);
const { outpostMapFromForge } = await imp('src/outpost/outpostMap.js');
const { stepOutpost, wellDefended, holdsBeforeBreach, composeRaid, MEASURE_SEEDS } = await imp('src/outpost/raid.js');
const { UNITS, EFFECTIVENESS } = await imp('src/data/tables.js');
await imp('src/data/factions.js');
const REG = globalThis.BulwarkFactions;

const PLANETS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];
const TARGET = { kit: 5, well: 8 };          // design §5.2
const MIN_SIZE = 2, MAX_SIZE = 4, MAX_RAIDS = 12, FAR_DAY_BUMP = 1;
const HP_GRID = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const DMG_GRID = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1];
const args = process.argv.slice(2), write = args.includes('--write');
const chosen = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
for (const p of chosen) if (!PLANETS.includes(p)) throw new Error(`unknown planet ${p}`);
// one planet without --write: measure it here; otherwise one child process per planet
const only = chosen.length === 1 && !write ? chosen[0] : null;
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

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

const hurtsWalls = (u) => ((EFFECTIVENESS[u.damageType] || {}).Structure || 0) > 0;
/** The breacher (owner 2026-11-07) for a planet whose troops cannot hurt walls: its own ground unit that hurts
 *  structures most, light ground first; null when the troops can. */
function breacherOf(planet) {
  const pre = REG.find(planet).prefix;
  if (hurtsWalls(UNITS[`${pre}-Troops`])) return null;
  const c = Object.entries(UNITS).filter(([id, u]) => id.startsWith(`${pre}-`) && u.domain === 'Walker' && hurtsWalls(u))
    .map(([id, u]) => ({ id, light: !!u.lightGround, power: u.dps[0] * EFFECTIVENESS[u.damageType].Structure }))
    .sort((a, b) => (b.light - a.light) || (b.power - a.power) || (a.id < b.id ? -1 : 1));
  if (!c.length) throw new Error(`${planet}: no ground unit of its own faction hurts structures`);
  return c[0].id;
}

/** Median holds of the kit and the well defended set for one raid. */
function holds(planet, step, map, units, hpMult, dmgMult) {
  const o = { map, step, units, hpMult, dmgMult, max: MAX_RAIDS };
  const kit = MEASURE_SEEDS.map((seed) => holdsBeforeBreach(stepOutpost(planet, step, { map, seed }), o));
  const well = MEASURE_SEEDS.map((seed) => holdsBeforeBreach(wellDefended(stepOutpost(planet, step, { map, seed }), map), o));
  const t = { size: units.length, hpMult, dmgMult, kit: median(kit), well: median(well), kitAll: kit, wellAll: well };
  // a count that hit the MAX_RAIDS cap is "at least that many", so it is penalised beyond its face value: otherwise a
  // never-breached outpost (12 / 12) ties a breached-at-once one (1 / 1) on Xenthe and the tie goes the wrong way
  t.err = Math.abs(t.kit - TARGET.kit) + Math.abs(t.well - TARGET.well) + (t.kit >= MAX_RAIDS ? 5 : 0) + (t.well >= MAX_RAIDS ? 5 : 0);
  return t;
}
const better = (t, b) => !b || t.err < b.err || (t.err === b.err && (t.hpMult * t.dmgMult > b.hpMult * b.dmgMult
  || (t.hpMult * t.dmgMult === b.hpMult * b.dmgMult && t.size > b.size)));

/** Step 1: multipliers and size together. Larger sizes and stronger raiders only breach sooner, so a row of the grid
 *  stops once the kit holds fewer than 2 (not with a breacher: which lane it takes flips with the size). */
function measureStep1(planet, map, cycle, breacher) {
  let best = null;
  for (const hpMult of HP_GRID) for (const dmgMult of DMG_GRID) for (let size = MIN_SIZE; size <= MAX_SIZE; size++) {
    const t = holds(planet, 1, map, composeRaid(cycle, size, breacher), hpMult, dmgMult);
    t.size = size;
    if (better(t, best)) best = t;
    if (t.kit < 2 && !breacher) break;   // with a breacher the lane it takes flips with the size: not monotonic
  }
  return best;
}
/** Steps 2–3: the size at the planet's multipliers. */
function measureSize(planet, step, map, cycle, breacher, hpMult, dmgMult) {
  let best = null;
  for (let size = 1; size <= MAX_SIZE; size++) {
    const t = holds(planet, step, map, composeRaid(cycle, size, breacher), hpMult, dmgMult);
    t.size = size;
    if (!best || t.err < best.err || (t.err === best.err && size === MIN_SIZE)) best = t;
    if (t.kit < 2 && !breacher) break;
  }
  return best;
}

const t0 = performance.now();
const rows = [];
// --write / no planet: one child process per planet, as many at once as there are CPUs
if (!only) {
  const todo = chosen.length ? chosen : PLANETS;
  const { cpus } = await import('node:os');
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'raids-'));
  const queue = [...todo], par = Math.max(1, cpus().length);
  const run = (p) => new Promise((ok, no) => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url), p, '--json', path.join(dir, `${p}.json`)], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.on('exit', (code) => (code ? no(new Error(`${p}: exit ${code}`)) : ok(out)));
  });
  const outs = {};
  await Promise.all(Array.from({ length: par }, async () => { while (queue.length) { const p = queue.shift(); outs[p] = await run(p); } }));
  console.log(todo.map((p) => outs[p].trim()).join('\n\n'));
  for (const p of todo) rows.push(JSON.parse(fs.readFileSync(path.join(dir, `${p}.json`), 'utf8')));
  if (write && todo.length < PLANETS.length) {
    // keep the other planets' rows as the workbook has them
    const { MAPDATA } = await imp('content/maps/mapdata.js');
    for (const r of MAPDATA.outpostRaids || []) if (!todo.includes(r.Planet_Key)) rows.push({ ...r });
  }
}
if (!jsonOut) console.log(`# Outpost raids — measured on the battle sim (median of ${MEASURE_SEEDS.length} outpost seeds; targets: kit ${TARGET.kit}, well defended ${TARGET.well})\n`);
if (!jsonOut) console.log('| Planet | Map | Units | HP × | Damage × | Step | Size | Kit holds (median; all seeds) | Well defended holds (median; all seeds) |\n|---|---|---|---|---|---|---|---|---|');
for (const planet of PLANETS.filter((p) => p === only)) {
  const own = fs.existsSync(mapFile(planet));
  const map = loadMap(own ? planet : 'ground');
  const cycle = unitsOf(planet), breacher = breacherOf(planet);
  const s1 = measureStep1(planet, map, cycle, breacher);
  const steps = [s1, measureSize(planet, 2, map, cycle, breacher, s1.hpMult, s1.dmgMult), measureSize(planet, 3, map, cycle, breacher, s1.hpMult, s1.dmgMult)];
  steps.forEach((m, i) => console.log(`| ${planet} | ${own ? 'own' : 'Verdance (no map yet)'} | ${[...new Set(cycle)].join(', ')}${breacher ? ` + ${breacher}` : ''} | ${s1.hpMult} | ${s1.dmgMult} | ${i + 1} | ${m.size} | ${m.kit}; ${m.kitAll.join(' ')} | ${m.well}; ${m.wellAll.join(' ')} |`));
  const row = { Planet_Key: planet, Units: cycle.join(' '), Breacher: breacher || '', Raider_HP_Mult: s1.hpMult, Raider_Damage_Mult: s1.dmgMult,
    Size_Step1: steps[0].size, Size_Step2: steps[1].size, Size_Step3: steps[2].size,
    Far_Day_Bump: FAR_DAY_BUMP, Measured_On: own ? `${planet}-outpost` : 'ground-outpost' };
  rows.push(row);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(row));
}
if (!jsonOut) console.log(`\nmeasured in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

if (write) {
  if (rows.length !== PLANETS.length) throw new Error('--write needs every planet (run without a planet argument)');
  rows.sort((a, b) => PLANETS.indexOf(a.Planet_Key) - PLANETS.indexOf(b.Planet_Key));
  const tmp = path.join(fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'raids-')), 'raids.json');
  fs.writeFileSync(tmp, JSON.stringify(rows));
  execFileSync('python3', [path.join(ROOT, 'tools/economy/write_outpost_raids.py'), tmp], { stdio: 'inherit' });
  execFileSync('python3', [path.join(ROOT, 'tools/extract_mapdata.py')], { stdio: 'inherit' });
}
