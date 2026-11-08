/**
 * src/outpost/view/statusReport.js — the outpost STATUS screen's model (owner 2026-11-07: "Since the outpost is continual
 * play, not wave based there should be a status screen that says total collection, and current collection per hour
 * rates").
 *
 * Pure. Current rates come from model.js collectionRates (rigs and harvesters as they run now); totals from the outpost's
 * lifetime ledger (o.lifetime: extracted per ore item, harvested per tier, gold from sales). The HUD draws it in the
 * away report's language (hud.js status()).
 */
import { collectionRates, migrateOutpost } from '../model.js';
import { oreLabel, awayFor } from './awayReport.js';
import { PLANETS } from '../../data/planets.js';

const TIER_COLOUR = { common: '#5fb8ff', uncommon: '#ffd34a' };   // the battle's blue / yellow crystals
const STOPPED = { full: 'BAY FULL', power: 'NO POWER' };

/** Per-hour rate as shown: whole units from 10 up, one decimal below. */
export const fmtPerHour = (r) => (r >= 10 ? Math.round(r).toLocaleString('en-US') : (Math.round(r * 10) / 10).toFixed(1));

/**
 * → { since, rates: { ore: [{ name, colour, perHour, stopped }], harvest: [{ name, colour, perHour }], oreTotal, harvestTotal },
 *     totals: { ore: [{ name, colour, units }], harvest: [{ name, colour, units }], gold, loads } }
 */
export function statusModel(outpost, map, { planet, catalog = null, now } = {}) {
  const o = migrateOutpost(JSON.parse(JSON.stringify(outpost)));
  const pname = (PLANETS[planet || o.planet] || {}).name || planet || o.planet;
  const resName = (tier) => {
    const r = ((catalog && catalog.resources) || []).find((x) => x.planet === pname && x.tier === tier);
    return r ? r.name : `${tier} surface resource`;
  };
  const r = collectionRates(o, map);
  // rigs on the same ore add up into one row; a row is stopped only when every rig on it is
  const byItem = new Map();
  for (const x of r.ore) {
    const row = byItem.get(x.item) || { ...oreLabel(x.item), perHour: 0, rigs: 0, stoppedRigs: 0, reasons: new Set() };
    row.perHour += x.perHour; row.rigs++;
    if (x.stopped) { row.stoppedRigs++; row.reasons.add(x.stopped); }
    byItem.set(x.item, row);
  }
  const ore = [...byItem.values()].map(({ reasons, rigs, stoppedRigs, ...row }) => ({
    ...row, stopped: stoppedRigs && stoppedRigs === rigs ? STOPPED[[...reasons][0]] : null,
    note: stoppedRigs && stoppedRigs < rigs ? `${stoppedRigs} of ${rigs} rigs stopped` : '',
  }));
  const harvest = ['common', 'uncommon'].filter((t) => r.harvest[t] > 0).map((t) => ({ name: resName(t), colour: TIER_COLOUR[t], perHour: r.harvest[t] }));
  const L = o.lifetime || { extracted: {}, harvested: {}, gold: 0, loads: 0, since: null };
  const totalsOre = Object.entries(L.extracted).map(([item, u]) => ({ ...oreLabel(item), units: Math.floor(u + 1e-9) })).filter((x) => x.units > 0).sort((a, b) => b.units - a.units);
  const totalsHarvest = ['common', 'uncommon'].map((t) => ({ name: resName(t), colour: TIER_COLOUR[t], units: Math.floor((L.harvested[t] || 0) + 1e-9) })).filter((x) => x.units > 0);
  return {
    since: L.since != null && now != null && now > L.since ? awayFor(now - L.since) : '',
    online: !!o.online,
    rates: { ore, harvest, oreTotal: r.oreTotal, harvestTotal: r.harvestTotal },
    totals: { ore: totalsOre, harvest: totalsHarvest, gold: Math.round(L.gold || 0), loads: L.loads || 0 },
  };
}
