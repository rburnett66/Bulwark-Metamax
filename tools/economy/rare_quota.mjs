/**
 * tools/economy/rare_quota.mjs — measure the optional RARE contracts, one per planet × map [MM-task_mw5h8fxu_d].
 *
 *   node tools/economy/rare_quota.mjs > /tmp/rc.csv
 *   python tools/economy/write_rare_contracts.py /tmp/rc.csv
 *   python tools/extract_mapdata.py
 *
 * Owner 2026-11-06: after wave 3 is won at 3★ or better, a character of a faction whose capital ship has arrived can
 * offer an OPTIONAL contract to sell this map's rare resources without visiting that ship; it resolves at the end of
 * the map. Declining costs nothing, but the offer must be re-earned. Owner: "propose defaults is fine, create all
 * contracts". Design: docs/16 Bulwark MM/design/Rare-Contracts-Design.md. Tech plan: docs/tech-plan/Content-Reveal.md §5.5.
 *
 * Defaults (a starting point for tuning, not a rule), on the LIVE board built as contract_quota.mjs builds it:
 * - QUOTA: rare (red) nodes are consumed, so half of what the live board seeds, floored to 10 (minimum 10).
 *   Half, because the offer comes at wave 3 and the rare fields beyond it sit in the outer rings.
 * - PRICE_PER_UNIT: 1.5 × the Premium Value_Per_Unit of the rare nodes' resource (the Resources sheet) — rare sells
 *   above uncommon, which is why the player wants the contract rather than waiting to reach the ship.
 * - LOYALTY to the buying faction on completion: 10 on maps 1–3, 15 on 4–6, 20 on 7–9 (as the Collective's Standing).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANET_OF_SLUG, standingFor } from './contract_quota.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const G = path.join(ROOT, 'prototype/test-game');
const { buildTerrainMap, resolveResourceTypes } = await import(path.join(G, 'src/sim/mapgen.js'));
const { createSim } = await import(path.join(G, 'src/sim/core.js'));
const { PLANETS } = await import(path.join(G, 'src/data/planets.js'));
const MD = JSON.parse(fs.readFileSync(path.join(G, 'content/maps/mapdata.json'), 'utf8'));
const FORGE = path.join(G, 'content/maps/forge');
const floor10 = (v) => Math.floor(v / 10) * 10;
const premiumValue = (type) => (MD.resources.find((d) => d.Resource === type && d.Tier === 'Premium') || {}).Value_Per_Unit;

/** One planet × map: the rare units the live board seeds, and the rare resource's premium value. */
export function measureRare(slug, mapId) {
  const forge = JSON.parse(fs.readFileSync(path.join(FORGE, `${slug}-map-${mapId}.json`), 'utf8'));
  const map = resolveResourceTypes(buildTerrainMap(forge, mapId, { seed: 0, bakeTune: {} }), 1);
  const s = createSim(7, { map, waves: [] });
  s.waves.current = 8;                                   // the whole board revealed
  let units = 0, worth = 0;
  for (const n of s.resourceNodes) if (n.color === 'red') {
    const v = premiumValue(n.type);
    if (!v) throw new Error(`${slug} map ${mapId}: rare node of unknown resource "${n.type}"`);
    units += n.units || 0; worth += (n.units || 0) * v;
  }
  return { units, value: units ? worth / units : 0 };
}

export const rareQuota = (units) => Math.max(10, floor10(units * 0.5));
export const rarePrice = (premium) => Math.round(premium * 1.5);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = [];
  for (const f of fs.readdirSync(FORGE).filter((x) => /-map-\d\.json$/.test(x)).sort()) {
    const [, slug, n] = f.match(/^(.*)-map-(\d)\.json$/);
    const key = PLANET_OF_SLUG[slug];
    if (!key) throw new Error(`forge map ${f}: unknown planet slug "${slug}"`);
    const m = measureRare(slug, +n);
    if (!m.units) throw new Error(`${f}: the board seeds no rare resources — every map needs a rare contract`);
    rows.push({ key, mapId: +n, ...m });
  }
  const order = Object.keys(PLANETS);
  rows.sort((a, b) => (order.indexOf(a.key) - order.indexOf(b.key)) || (a.mapId - b.mapId));
  console.log('Planet_Key,Planet,Map_ID,Rare_Seeded,Quota,Price_Per_Unit,Loyalty');
  for (const r of rows) {
    console.log([r.key, PLANETS[r.key].name, r.mapId, r.units, rareQuota(r.units), rarePrice(r.value), standingFor(r.mapId)].join(','));
  }
}
