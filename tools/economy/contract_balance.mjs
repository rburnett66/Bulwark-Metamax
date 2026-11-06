/**
 * tools/economy/contract_balance.mjs — BEFORE vs AFTER gold for the Collective contract change [MM-story_mw4a1o3p_m].
 *
 *   node tools/economy/contract_balance.mjs            # prints JSON (all 81 planet × map runs) to stdout
 *
 * Proposal (owner 2026-11-05): the contract buys only COMMON and UNCOMMON; RARE and EPIC have quota 0 (always kept,
 * still counted for quest objectives). This tool measures what that removes, on every committed forge map.
 *
 * Method — the game's own deterministic sim (createSim / stepSim, seeded, fixed 1/30 s tick), harvest economics only:
 * - Board: content/maps/forge/<faction>-map-<n>.json → buildTerrainMap(seed 0) → resolveResourceTypes(map, 1), exactly
 *   as main.js selectMap builds a live board.
 * - No enemies (waves: []). There is no scripted commander that plays full battles (balanceSim.js prices single units
 *   on the fixed harness board), so this measures the harvest economy, like contract_quota.mjs.
 * - Rings open on the map's own wave schedule: wave k is "current" (its resources revealed) for ring k's Wave_Par_Sec,
 *   for all 8 waves. Total time = sum of wave par = the map's par time.
 * - Commander A ("starter"): issues no orders; the one free starting harvester uses the game's IDLE AUTO-GATHER
 *   (nearest revealed resource of any tier).
 * - Commander B ("fleet"): same, and buys a harvester (500 / 750 / 1000 gold) whenever it can afford one, up to the
 *   cap of 4 — the most gold a harvest-only player can pull, and the commander whose purchases could feel the change.
 * - Commander C ("quest"): commander B, plus its first harvester is ordered onto the nearest revealed rare/epic field
 *   whenever it is EMPTY and not already on one (checked once a second) — a player chasing the quest objectives. Auto-gather
 *   alone never reaches the rare/epic crystals (common fields are always nearer), so C is the case the change bites.
 * - Horizon: waves 1-8 on their Wave_Par_Sec; wave 8 then runs on to the map's Par_Time_Sec when that is longer
 *   (contract_quota.mjs measures the common quota over Par_Time_Sec).
 * - BEFORE contract = contractFor(mapId); AFTER = the same with rare = 0 and epic = 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const G = path.join(ROOT, 'prototype/test-game');
const { buildTerrainMap, resolveResourceTypes } = await import(path.join(G, 'src/sim/mapgen.js'));
const { createSim, applyCommand, stepSim } = await import(path.join(G, 'src/sim/core.js'));
const { contractFor } = await import(path.join(G, 'src/data/collectiveContract.js'));
const FORGE = path.join(G, 'content/maps/forge');
const TIER = { blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' };
const TIERS = ['common', 'uncommon', 'rare', 'epic'];
// forge file slug → planet (src/data/planets.js + factions.js; main.js forgeFileSlug)
export const PLANET_OF_SLUG = {
  powder: 'Verdance', air: 'Florael', 'high-tech': 'Ochre', artillery: 'Kessra', water: 'Rime',
  'arcane-energy': 'Cinder', 'space-tech': 'Lumen', 'dark-energy': 'Xenthe', greenies: 'Vexmire',
};
const MD = JSON.parse(fs.readFileSync(path.join(G, 'content/maps/mapdata.json'), 'utf8'));
const DT = 1 / 30;
const SEED = 7;

function boardFor(file, id) {
  const forge = JSON.parse(fs.readFileSync(path.join(FORGE, file), 'utf8'));
  return resolveResourceTypes(buildTerrainMap(forge, id, { seed: 0, bakeTune: {} }), 1);
}

/** Commander C's quest order: keep the FIRST harvester on a revealed rare/epic (red/green) field while one has crystals
 *  left — what a player chasing the quest objectives does. Re-ordered only when it is not already on such a field. */
function questOrder(s) {
  const u = s.units.get((s.harvesterIds || [])[0]);
  if (!u || u.hp <= 0) return;
  if (u.cargo > 0) return;   // only an EMPTY truck is retasked: a load is credited at its LAST crystal's tier (see report)
  const on = u.fieldId && s.resourceNodes.some((n) => n.fieldId === u.fieldId && (n.color === 'red' || n.color === 'green') && n.remaining > 0);
  if (on) return;
  const wv = s.waves.current;
  const q = s.resourceNodes.filter((n) => (n.color === 'red' || n.color === 'green') && n.remaining > 0 && n.wave <= wv)
    .sort((a, b) => (Math.hypot(a.x - u.pos.x, a.y - u.pos.y) - Math.hypot(b.x - u.pos.x, b.y - u.pos.y)) || (a.id < b.id ? -1 : 1));
  if (q.length) applyCommand(s, { type: 'harvest', nodeId: q[0].id, harvesterId: u.id });
}

function run(file, id, contract, buyFleet, quest = false) {
  const map = boardFor(file, id);
  const s = createSim(SEED, { map, waves: [], contract });
  const z = () => ({ common: 0, uncommon: 0, rare: 0, epic: 0 });
  const r = { units: z(), sold: z(), kept: z(), gold: z(), goldByWave: [], moneyEndWave: [], buys: [] };
  const seeded = z();
  for (const n of s.resourceNodes) if (TIER[n.color]) seeded[TIER[n.color]] += n.units;
  r.seeded = seeded;
  let cum = 0;
  const waveSum = map.rings.reduce((a, g) => a + g.parSec, 0);
  const mapPar = MD.maps.find((m) => m.Map_ID === id).Par_Time_Sec;
  for (let w = 1; w <= map.rings.length; w++) {
    s.waves.current = w;                                  // ring w revealed (nodeRevealed reads waves.current)
    // wave 8 runs on to the map's Par_Time_Sec (contract_quota.mjs's horizon) when that is longer than the wave pars
    const sec = map.rings[w - 1].parSec + (w === map.rings.length ? Math.max(0, mapPar - waveSum) : 0);
    const ticks = Math.round(sec / DT);
    for (let t = 0; t < ticks; t++) {
      if (buyFleet && applyCommand(s, { type: 'buyHarvester' }).ok) r.buys.push(Math.round(s.time));
      if (quest && t % 30 === 0) questOrder(s);
      for (const e of stepSim(s, DT)) {
        if (e.type !== 'deposit') continue;
        const k = TIER[e.color] || 'common';
        r.units[k] += e.units; r.sold[k] += e.sold; r.kept[k] += e.kept; r.gold[k] += e.gold; cum += e.gold;
      }
    }
    r.goldByWave.push(cum);
    r.moneyEndWave.push(Math.floor(s.economy.money));
  }
  r.result = s.result || null;
  r.mapScore = { ...s.mapScore };
  r.waveParSec = map.rings.map((g) => g.parSec);
  r.mapParSec = mapPar;
  r.simSec = Math.round(s.time);
  r.wave1Sec = map.rings[0].parSec;
  r.valuePerUnit = {};
  for (const n of s.resourceNodes) if (TIER[n.color]) r.valuePerUnit[TIER[n.color]] = n.valuePerUnit;
  return r;
}

const rows = [];
for (const f of fs.readdirSync(FORGE).filter((x) => /-map-\d\.json$/.test(x)).sort()) {
  const [, slug, n] = f.match(/^(.*)-map-(\d)\.json$/);
  const id = +n;
  const before = contractFor(id);
  const after = { ...before, rare: 0, epic: 0 };
  const row = { planet: PLANET_OF_SLUG[slug] || slug, slug, mapId: id, before, after };
  for (const [name, buy, quest] of [['starter', false, false], ['fleet', true, false], ['quest', true, true]]) {
    row[name] = { before: run(f, id, before, buy, quest), after: run(f, id, after, buy, quest) };
  }
  rows.push(row);
  process.stderr.write(`${slug} map ${id}\n`);
}
process.stdout.write(JSON.stringify(rows));
