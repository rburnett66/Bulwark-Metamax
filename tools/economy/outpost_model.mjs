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
  if (raids[0]) table(['Raiders (Units, cycled)', 'Size, step 1', 'Size, step 2', 'Size, step 3', 'Far-buyer day bump'],
    [[raids[0].units.join(' '), ...raids.map((r) => r.size), raids[0].farDayBump]]);
}
