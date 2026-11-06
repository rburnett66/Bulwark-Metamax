/**
 * tools/economy/contract_compare.mjs — harvest gold under the Collective contract, for one checkout [MM-story_mw4a1o3p_m].
 *
 *   node tools/economy/contract_compare.mjs [path/to/prototype/test-game] > after.json
 *   node tools/economy/contract_compare.mjs ../main-checkout/prototype/test-game > before.json
 *
 * Runs the GAME AT THAT PATH (its own sim, its own contractFor), so the same script measures before and after a change:
 * on main the per-map four-tier contract and whole-load crediting; on this branch the per-planet common/uncommon
 * contract and per-tier crediting. Method as tools/economy/contract_balance.mjs (balance report 2026-11-05):
 * live board, no enemies, rings opening on each map's wave par, run to the map's par time, three commanders —
 *   starter: the free harvester on idle auto-gather;  fleet: + buys harvesters to the cap whenever it can;
 *   quest:   fleet, and its first truck is sent to the nearest rare/epic field whenever it is EMPTY.
 * Prints JSON: [{ planet, mapId, contract, starter|fleet|quest: { gold, sold, kept, money, buys } }].
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const G = path.resolve(process.argv[2] || path.join(HERE, '../../prototype/test-game'));
const { buildTerrainMap, resolveResourceTypes } = await import(path.join(G, 'src/sim/mapgen.js'));
const { createSim, applyCommand, stepSim } = await import(path.join(G, 'src/sim/core.js'));
const { contractFor } = await import(path.join(G, 'src/data/collectiveContract.js'));
const MD = JSON.parse(fs.readFileSync(path.join(G, 'content/maps/mapdata.json'), 'utf8'));
const PER_PLANET = Array.isArray(MD.collectiveContracts);
const FORGE = path.join(G, 'content/maps/forge');
const TIER = { blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' };
const PLANET_OF_SLUG = {
  powder: 'ground', air: 'air', 'high-tech': 'hightech', artillery: 'artillery', water: 'water',
  'arcane-energy': 'arcane', 'space-tech': 'space', 'dark-energy': 'dark', greenies: 'greenies',
};
const DT = 1 / 30;

function questOrder(s) {
  const u = s.units.get((s.harvesterIds || [])[0]);
  if (!u || u.hp <= 0 || u.cargo > 0) return;
  const on = u.fieldId && s.resourceNodes.some((n) => n.fieldId === u.fieldId && (n.color === 'red' || n.color === 'green') && n.remaining > 0);
  if (on) return;
  const q = s.resourceNodes.filter((n) => (n.color === 'red' || n.color === 'green') && n.remaining > 0 && n.wave <= s.waves.current)
    .sort((a, b) => (Math.hypot(a.x - u.pos.x, a.y - u.pos.y) - Math.hypot(b.x - u.pos.x, b.y - u.pos.y)) || (a.id < b.id ? -1 : 1));
  if (q.length) applyCommand(s, { type: 'harvest', nodeId: q[0].id, harvesterId: u.id });
}

function run(file, id, contract, buyFleet, quest) {
  const forge = JSON.parse(fs.readFileSync(path.join(FORGE, file), 'utf8'));
  const map = resolveResourceTypes(buildTerrainMap(forge, id, { seed: 0, bakeTune: {} }), 1);
  const s = createSim(7, { map, waves: [], contract });
  const z = () => ({ common: 0, uncommon: 0, rare: 0, epic: 0 });
  const r = { gold: z(), sold: z(), kept: z(), buys: 0 };
  const waveSum = map.rings.reduce((a, g) => a + g.parSec, 0);
  const mapPar = MD.maps.find((m) => m.Map_ID === id).Par_Time_Sec;
  for (let w = 1; w <= map.rings.length; w++) {
    s.waves.current = w;
    const sec = map.rings[w - 1].parSec + (w === map.rings.length ? Math.max(0, mapPar - waveSum) : 0);
    for (let t = 0, n = Math.round(sec / DT); t < n; t++) {
      if (buyFleet && applyCommand(s, { type: 'buyHarvester' }).ok) r.buys++;
      if (quest && t % 30 === 0) questOrder(s);
      for (const e of stepSim(s, DT)) {
        if (e.type !== 'deposit') continue;
        const k = TIER[e.color] || 'common';
        r.gold[k] += e.gold; r.sold[k] += e.sold; r.kept[k] += e.kept;
      }
    }
  }
  r.money = Math.floor(s.economy.money);
  return r;
}

const rows = [];
for (const f of fs.readdirSync(FORGE).filter((x) => /-map-\d\.json$/.test(x)).sort()) {
  const [, slug, n] = f.match(/^(.*)-map-(\d)\.json$/);
  const id = +n, planet = PLANET_OF_SLUG[slug];
  const contract = PER_PLANET ? contractFor(planet, id) : contractFor(id);
  const row = { planet, mapId: id, contract };
  for (const [name, buy, quest] of [['starter', false, false], ['fleet', true, false], ['quest', true, true]]) row[name] = run(f, id, contract, buy, quest);
  rows.push(row);
  process.stderr.write(`${planet} ${id}\n`);
}
process.stdout.write(JSON.stringify(rows));
