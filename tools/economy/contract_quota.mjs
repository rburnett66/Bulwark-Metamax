/**
 * tools/economy/contract_quota.mjs — measure the Collective contract quotas [MM-story_mw12m2df_2] [MM-story_mw4a1o3p_m].
 *
 *   node tools/economy/contract_quota.mjs              # CSV, one row per planet × map (81) → the workbook's
 *                                                      #   Collective_Contracts sheet (tools/economy/write_collective_contracts.py)
 *   node tools/economy/contract_quota.mjs --per-map    # the old per-map table (minimum over the nine planets)
 *
 * Owner 2026-11-05: contracts "exist for each planet and each map" and "are related to the collection of common and
 * uncommon resources"; rare resources belong to the secondary contracts. So the Collective buys COMMON and UNCOMMON only.
 *
 * Method (a starting point for tuning, not a rule), on the LIVE board — built exactly as main.js selectMap builds it:
 * content/maps/forge/<slug>-map-<n>.json → buildTerrainMap(seed 0) → resolveResourceTypes(map, 1) → createSim. The raw
 * forge board is not what the player harvests: resolveResourceTypes resets every premium (uncommon) node to its
 * resource's Units_Per_Node and initHarvest clears the crystals inside the base dock ring. Counting the raw board made
 * the uncommon quota larger than everything the board holds on 56 of 81 boards (balance report 2026-11-05).
 * - COMMON regrows, so the quota is what ONE harvester delivers working the richest common field for the map's par
 *   time, with no enemies. A commander running only the starting harvester sells everything; extra harvesters are
 *   what produce a surplus.
 * - UNCOMMON is consumed, so the quota is 80 % of what the live board seeds.
 * - STANDING for completing it the first time: 10 on maps 1–3, 15 on 4–6, 20 on 7–9 (Collective-Faction.md §3.4, Q6).
 * Values are floored to 10 units.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const G = path.join(ROOT, 'prototype/test-game');
const { buildTerrainMap, resolveResourceTypes } = await import(path.join(G, 'src/sim/mapgen.js'));
const { createSim, applyCommand, stepSim } = await import(path.join(G, 'src/sim/core.js'));
const { PLANETS } = await import(path.join(G, 'src/data/planets.js'));
const MD = JSON.parse(fs.readFileSync(path.join(G, 'content/maps/mapdata.json'), 'utf8'));
const TIER = { blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' };
const FORGE = path.join(G, 'content/maps/forge');
const floor10 = (v) => Math.floor(v / 10) * 10;
const PER_MAP = process.argv.includes('--per-map');

// forge file slug (main.js forgeFileSlug) → planet key (src/data/planets.js, = the faction registry key)
export const PLANET_OF_SLUG = Object.freeze({
  powder: 'ground', air: 'air', 'high-tech': 'hightech', artillery: 'artillery', water: 'water',
  'arcane-energy': 'arcane', 'space-tech': 'space', 'dark-energy': 'dark', greenies: 'greenies',
});
export const standingFor = (mapId) => (mapId <= 3 ? 10 : mapId <= 6 ? 15 : 20);

/** One planet × map: the live board's common delivery and uncommon seeding. */
export function measure(slug, mapId) {
  const forge = JSON.parse(fs.readFileSync(path.join(FORGE, `${slug}-map-${mapId}.json`), 'utf8'));
  const map = resolveResourceTypes(buildTerrainMap(forge, mapId, { seed: 0, bakeTune: {} }), 1);
  const s = createSim(7, { map, waves: [] });
  s.waves.current = 8;                                  // the whole board revealed: measure the economy, not the ring
  const seeded = { common: 0, uncommon: 0, rare: 0, epic: 0 };
  for (const n of s.resourceNodes) if (TIER[n.color]) seeded[TIER[n.color]] += n.units || 0;
  const field = s.resourceNodes.filter((n) => n.color === 'blue').sort((a, b) => b.units - a.units)[0];
  let delivered = 0;
  if (field) {
    applyCommand(s, { type: 'harvest', nodeId: field.id });
    const par = MD.maps.find((m) => m.Map_ID === mapId).Par_Time_Sec;
    for (let t = 0; t < par * 30; t++) for (const e of stepSim(s, 1 / 30)) if (e.type === 'deposit' && e.color === 'blue') delivered += e.units;
  }
  return { delivered, seeded };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = [];
  for (const f of fs.readdirSync(FORGE).filter((x) => /-map-\d\.json$/.test(x)).sort()) {
    const [, slug, n] = f.match(/^(.*)-map-(\d)\.json$/);
    const key = PLANET_OF_SLUG[slug];
    if (!key) throw new Error(`forge map ${f}: unknown planet slug "${slug}"`);
    rows.push({ key, mapId: +n, ...measure(slug, +n) });
  }
  if (PER_MAP) {
    const out = {};
    for (const r of rows) {
      const o = (out[r.mapId] ||= { common: Infinity, uncommon: Infinity });
      o.common = Math.min(o.common, r.delivered);
      o.uncommon = Math.min(o.uncommon, r.seeded.uncommon * 0.8);
    }
    console.log('Map_ID\tContract_Common\tContract_Uncommon');
    for (const id of Object.keys(out).sort()) console.log([id, floor10(out[id].common), floor10(out[id].uncommon)].join('\t'));
  } else {
    const order = Object.keys(PLANETS);
    rows.sort((a, b) => (order.indexOf(a.key) - order.indexOf(b.key)) || (a.mapId - b.mapId));
    console.log('Planet_Key,Planet,Map_ID,Common,Uncommon,Standing,Gold_Bonus');
    for (const r of rows) {
      console.log([r.key, PLANETS[r.key].name, r.mapId, floor10(r.delivered), floor10(r.seeded.uncommon * 0.8), standingFor(r.mapId), 0].join(','));
    }
  }
}
