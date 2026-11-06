/**
 * tools/economy/contract_quota.mjs — measure starting values for the Collective contract quota [MM-story_mw12m2df_2].
 *
 *   node tools/economy/contract_quota.mjs            # prints a per-map table; paste into Bulwark-Map-Data.xlsx Maps
 *
 * Method (a starting point for tuning, not a rule):
 * - COMMON regrows, so the quota is what ONE harvester delivers working the richest common field for the map's par
 *   time, with no enemies (the minimum over the nine planets). A commander running only the starting harvester sells
 *   everything; extra harvesters are what produce a surplus.
 * - UNCOMMON, RARE, EPIC are consumed, so the quota is 80 % of what the map seeds (minimum over the nine planets).
 * Values are floored to 10 units.
 *
 *   node tools/economy/contract_quota.mjs --per-planet   # CSV Planet,Map_ID,Common,Uncommon — one row per planet × map
 *
 * --per-planet (owner 2026-11-05, refs [MM-story_mw4a1o3p_m]): the contract covers only COMMON and UNCOMMON, and each
 * planet gets its own quota per map — the same method, measured on that planet's own forge map instead of the minimum
 * over the nine. Rare and epic are not bought (quota 0), so they are not output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const G = path.join(ROOT, 'prototype/test-game');
const { buildTerrainMap } = await import(path.join(G, 'src/sim/mapgen.js'));
const { createSim, applyCommand, stepSim } = await import(path.join(G, 'src/sim/core.js'));
const MD = JSON.parse(fs.readFileSync(path.join(G, 'content/maps/mapdata.json'), 'utf8'));
const TIER = { blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' };
const FORGE = path.join(G, 'content/maps/forge');
const floor10 = (v) => Math.floor(v / 10) * 10;
const PER_PLANET = process.argv.includes('--per-planet');
// forge file slug → planet (src/data/planets.js + factions.js; main.js forgeFileSlug)
const PLANET_OF_SLUG = {
  powder: 'Verdance', air: 'Florael', 'high-tech': 'Ochre', artillery: 'Kessra', water: 'Rime',
  'arcane-energy': 'Cinder', 'space-tech': 'Lumen', 'dark-energy': 'Xenthe', greenies: 'Vexmire',
};
const perPlanet = [];

const out = {};
for (const f of fs.readdirSync(FORGE).filter((x) => /-map-\d\.json$/.test(x)).sort()) {
  const id = +f.match(/-map-(\d)/)[1];
  const forge = JSON.parse(fs.readFileSync(path.join(FORGE, f), 'utf8'));
  const map = buildTerrainMap(forge, id, { seed: 0, bakeTune: {} });
  const seeded = { common: 0, uncommon: 0, rare: 0, epic: 0 };
  for (const r of map.resources || []) if (TIER[r.color]) seeded[TIER[r.color]] += r.units || 0;
  const s = createSim(7, { map, waves: [] });
  s.waves.current = 8;                                  // the whole board revealed: measure the economy, not the ring
  const field = s.resourceNodes.filter((n) => n.color === 'blue').sort((a, b) => b.units - a.units)[0];
  let delivered = 0;
  if (field) {
    applyCommand(s, { type: 'harvest', nodeId: field.id });
    const par = MD.maps.find((m) => m.Map_ID === id).Par_Time_Sec;
    for (let t = 0; t < par * 30; t++) for (const e of stepSim(s, 1 / 30)) if (e.type === 'deposit' && e.color === 'blue') delivered += e.units;
  }
  const slug = f.replace(/-map-\d\.json$/, '');
  perPlanet.push({ planet: PLANET_OF_SLUG[slug] || slug, id, common: floor10(delivered), uncommon: floor10(seeded.uncommon * 0.8) });
  const o = (out[id] ||= { common: Infinity, uncommon: Infinity, rare: Infinity, epic: Infinity });
  o.common = Math.min(o.common, delivered);
  for (const k of ['uncommon', 'rare', 'epic']) o[k] = Math.min(o[k], seeded[k] * 0.8);
}
if (PER_PLANET) {
  const planets = Object.values(PLANET_OF_SLUG);
  perPlanet.sort((a, b) => (planets.indexOf(a.planet) - planets.indexOf(b.planet)) || (a.id - b.id));
  console.log('Planet,Map_ID,Common,Uncommon');
  for (const r of perPlanet) console.log([r.planet, r.id, r.common, r.uncommon].join(','));
  process.exit(0);
}
console.log('Map_ID\tContract_Common\tContract_Uncommon\tContract_Rare\tContract_Epic');
for (const id of Object.keys(out).sort()) {
  const o = out[id];
  console.log([id, floor10(o.common), floor10(o.uncommon), floor10(o.rare), floor10(o.epic)].join('\t'));
}
