#!/usr/bin/env node
// outpost_model.mjs — print the outpost design's derived tables from the extracted workbook data [MM-story_mw5oe4ap_i].
//
//     node tools/economy/outpost_model.mjs            # every planet
//     node tools/economy/outpost_model.mjs ground     # one planet
//
// Reads MAPDATA through the game's own readers (src/data/ores.js, src/data/outpost.js), so what it prints is what the
// game will run. The design's tables (Outpost-Design §4.2 rates and bays, §4.4 deep drilling, §4.5 power, §2.4 the
// contract ladder) come from here: retune the workbook, re-extract, re-run, and check the consequences before play.
// Raid sizes (§5.2) are measured on the battle sim by tools/economy/outpost_raids.mjs (tech plan §4.3, story O7);
// this prints what the data holds (Outpost_Raids → raidFor).
import { oresOf, oreValuePerHour, oreRatePerMin, orePrice, ORE_TIERS } from '../../prototype/test-game/src/data/ores.js';
import { readFileSync } from 'node:fs';
import { OUTPOST, REFERENCE_SET, ESTABLISH, structureDef, powerBudget, bayUnits, loadUnits, contractFor, raidFor, harvesterDef } from '../../prototype/test-game/src/data/outpost.js';

const PLANETS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];
const only = process.argv[2];
const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
const table = (head, rows) => {
  console.log(`| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|`);
  for (const r of rows) console.log(`| ${r.map((c) => (typeof c === 'number' ? fmt(c) : c)).join(' | ')} |`);
  console.log('');
};

console.log(`# Outpost model — from MAPDATA (load ${OUTPOST.Load_Sec / 60} min, bays ${OUTPOST.Store_Hours} h, ` +
  `deep ${OUTPOST.Deep_Rate_Mult}× speed at ${OUTPOST.Deep_Price_Mult}× price)\n`);

// ── what the player buys (owner 2026-11-07: the contract grants only the hub; design §2.3, §6.1) ──
const cost = (k, t = 1) => structureDef(k, t).cost;
const setup = ESTABLISH.filter((k) => k !== 'hub').reduce((a, k) => a + cost(k), 0);
const iron = oresOf('ground').find((o) => o.tier === 'common');
const perHour = oreValuePerHour(iron);
const missions = JSON.parse(readFileSync(new URL('../../prototype/test-game/content/missions/missions.json', import.meta.url), 'utf8')).missions;
const goldOf = (m) => m.rewards.filter((r) => r.kind === 'gold').reduce((a, r) => a + r.amount, 0);
const ver = missions.filter((m) => m.planet === 'Verdance' && m.map >= 1 && m.map <= 3);
const prim = ver.filter((m) => m.role === 'primary').reduce((a, m) => a + goldOf(m), 0);
const light = ver.filter((m) => m.role === 'secondary' && /-L$/.test(m.id)).reduce((a, m) => a + goldOf(m), 0);
const refDefs = { mg: 1, cannon: 1, wall: 6 };
const refDefCost = Object.entries(refDefs).reduce((a, [k, n]) => a + n * cost(k), 0);
const h = harvesterDef();
console.log(`## What the player buys (design §6.1)\n\nThe contract grants the Outpost Hub only. The first setup ` +
  `(Power Station I ${fmt(cost('power'))} + Mining Rig I ${fmt(cost('rig'))} + Storage Tower I ${fmt(cost('storage'))}) costs ` +
  `**${fmt(setup)}** and pays back from iron (${fmt(perHour)} gold an hour) in **${fmt(setup / perHour)} h**. ` +
  `With the map's reference defenses (MG ${fmt(cost('mg'))}, Cannon ${fmt(cost('cannon'))}, 6 walls at ${fmt(cost('wall'))}: ` +
  `${fmt(refDefCost)}) it is ${fmt(setup + refDefCost)}, paid back in ${fmt((setup + refDefCost) / perHour)} h. ` +
  `Resource Bay ${fmt(cost('resourceBay'))}; harvester ${fmt(h.cost)} each, ${h.cap} to start, up to ${h.max}.\n\n` +
  `The bank when the contract arrives (map 3 at 3★) is the battle's leftover gold (\`carry.gold = goldRemaining\`, not ` +
  `modelled here; the save tests use 1,200–1,840 for a won map) plus the Verdance map 1–3 mission gold collected: ` +
  `primaries ${fmt(prim)}, Light secondaries ${fmt(light)}, minus what the tech tree took.\n`);

const kit = powerBudget(REFERENCE_SET.map((kind) => ({ kind, tier: 1 })));
console.log(`## Power (design §4.5)\n\nThe reference set draws ${kit.draw} of Power Station I's ${kit.supply} (spare ${kit.spare}). ` +
  `A second rig needs ${structureDef('rig', 1).draw}: upgrade to Power Station II (${structureDef('power', 2).supply}) ` +
  `or build another station. Reach: ${structureDef('power', 1).reach} cells (II: ${structureDef('power', 2).reach}).\n`);

for (const p of PLANETS.filter((x) => !only || x === only)) {
  const ores = oresOf(p);
  console.log(`## ${ores[0].planetName} (${p})\n`);
  table(['Tier', 'Ore', 'Rig', 'Rig I / min', 'Price', 'Gold / h', 'Load', 'Bay (Rig I)', 'Bay (Mk II)', 'Deep gold / h', 'Deep fill (h)', 'Far buyer'],
    ores.map((o) => {
      const bay = bayUnits(o);
      return [o.tier, o.name, o.rig, o.rate, o.price, oreValuePerHour(o), loadUnits(o.rate), bay, bayUnits(o, { rigTier: 2 }),
        oreValuePerHour(o, { deep: true }), bay / (oreRatePerMin(o, { deep: true }) * 60), o.wantedBy ? `${o.wantedBy} at ${orePrice(o) * OUTPOST.Far_Buyer_Mult}` : ''];
    }));
  table(['Step', 'Title', 'Deliver', 'Hours on one Rig I (shallow)', 'Raids held', 'Pays (sales + reward)', 'Unlocks'],
    [1, 2, 3].map((s) => {
      const c = contractFor(p, s), o = ores[ORE_TIERS.indexOf(c.oreTier)];
      const hours = c.deliver / (o.rate * 60);
      const tags = [...c.unlocks.ores.map((t) => `${t} ore`), ...c.unlocks.techs, ...(c.unlocks.farBuyer ? ['far buyer'] : [])];
      return [s, c.title, `${c.deliver} ${o.name}`, hours, c.raidsHeld, `${fmt(c.deliver * o.price)} + ${fmt(c.gold)}, +${c.loyalty} loyalty, ${c.xp} XP`, tags.join(', ')];
    }));
  const raids = [1, 2, 3].map((s) => raidFor(p, s));
  if (raids[0]) table(['Raiders (Units, cycled)', 'Breacher', 'HP ×', 'Damage ×', 'Size, step 1', 'Size, step 2', 'Size, step 3', 'Far-buyer day bump'],
    [[raids[0].units.join(' '), raids[0].breacher || '—', raids[0].hpMult, raids[0].dmgMult, ...raids.map((r) => r.size), raids[0].farDayBump]]);
}

// ── the Resource Bay's harvesters (story O10; owner 2026-11-07: "Full battle rate but the spawn rate of surface
// resources on outpost land is 5% of the premium land surveyed for the tower defense mode") ──────────────────────────
{
  const M = await import('../../prototype/test-game/src/outpost/model.js');
  const { outpostMapFromForge } = await import('../../prototype/test-game/src/outpost/outpostMap.js');
  const { surfaceStock } = await import('../../prototype/test-game/src/data/outpost.js');
  const { existsSync } = await import('node:fs');
  const catalog = JSON.parse(readFileSync(new URL('../../prototype/test-game/content/missions/missions.json', import.meta.url), 'utf8'));
  const st = surfaceStock();
  console.log(`## Resource Bay income (design §6.2)\n\nHarvesters drive and load at the battle rate; a surface field holds a battle field's stock ` +
    `(${st.common.units} common / ${st.uncommon.units} uncommon units a cell) and regrows at ${OUTPOST.Surface_Respawn_Mult * 100} % of the battle rate ` +
    `(a cell's units per ${st.respawnSec} s): ${fmt(st.common.regrow * 3600)} common / ${fmt(st.uncommon.regrow * 3600)} uncommon units a cell an hour. ` +
    `A harvester takes its field's stock, then its regrowth. Hourly = the steady take once the fields are bare; first hour = what the ` +
    `harvesters bring in during the first hour (mostly the fields' stock). Gold-equivalent uses the inventory's resource values. ` +
    `Planets without an outpost map are measured on Verdance's (marked *).\n`);
  const rows = [];
  for (const p of PLANETS.filter((x) => !only || x === only)) {
    const file = new URL(`../../prototype/test-game/content/maps/forge/${p}-outpost.json`, import.meta.url);
    const own = existsSync(file);
    const map = outpostMapFromForge(JSON.parse(readFileSync(own ? file : new URL('../../prototype/test-game/content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')), p);
    const planetName = oresOf(p)[0].planetName;
    const val = (tier) => ((catalog.resources.find((r) => r.planet === planetName && r.tier === tier) || {}).value || 0);
    for (const n of [2, 4]) {
      const o = M.referenceOutpost(p, { seed: 1, map, now: 0 });
      const bay = map.pads.find((x) => x.role === 'bay' && !o.pads[x.id]);
      if (!bay) continue;
      o.pads[bay.id] = { kind: 'resourceBay', tier: 1 };
      o.harvesters = n; o.online = true; o.firstRaidAt = null;
      for (const id of Object.keys(o.pads)) if (o.pads[id].kind === 'power') o.pads[id].tier = 2;
      const s = M.steadyHarvest(o, map), H = 3_600_000;
      const first = M.advance(o, H, { map, params: { ...OUTPOST, Raid_Mean_Hours: 1e12, Hopper_Hours: 1e6 } }).outpost.hopper;
      const gold = s.byTier.common * H * val('common') + s.byTier.uncommon * H * val('uncommon');
      rows.push([`${planetName}${own ? '' : ' *'}`, n, M.surfaceFieldGroups(map).length, s.byTier.common * H, s.byTier.uncommon * H, s.total * H,
        gold, (first.common || 0) + (first.uncommon || 0), M.hopperCap(o, map)]);
    }
  }
  table(['Planet', 'Harvesters', 'Fields', 'Common / h', 'Uncommon / h', 'Units / h', 'Gold-eq. / h', 'First hour', 'Hopper (units)'], rows);
}
