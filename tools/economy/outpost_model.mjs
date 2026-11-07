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
import { OUTPOST, KIT, structureDef, powerBudget, bayUnits, loadUnits, contractFor, raidFor } from '../../prototype/test-game/src/data/outpost.js';

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

const kit = powerBudget(KIT.map((kind) => ({ kind, tier: 1 })));
console.log(`## Power (design §4.5)\n\nThe kit draws ${kit.draw} of Power Station I's ${kit.supply} (spare ${kit.spare}). ` +
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
