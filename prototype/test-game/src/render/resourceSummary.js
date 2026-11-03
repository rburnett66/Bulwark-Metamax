/**
 * src/render/resourceSummary.js — resources collected, per wave and for the whole map, on the result screens
 * [MM-story_mw13ek87_1].
 *
 * Owner 2026-11-03: "We need to add the total resource collection to the wave and map results screens."
 * The ledger reads the sim's deposit events (outside the tick, like battleTally) and splits each tier into what the
 * Collective contract bought (sold, paid in gold) and what the player kept (the inventory's share). Pure data + HTML.
 */
import { resourceId, resourceIconHtml } from '../data/resourceIcons.js';

export const TIERS = Object.freeze(['common', 'uncommon', 'rare', 'epic']);
const COLOR_TIER = Object.freeze({ blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' });
export const TIER_COLOR = Object.freeze({ common: '#58a6ff', uncommon: '#ffd76a', rare: '#ff7a6a', epic: '#7ae08a' });
const TIER_LABEL = Object.freeze({ common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' });

const zero = () => ({ common: 0, uncommon: 0, rare: 0, epic: 0 });
const blank = () => ({ units: zero(), sold: zero(), kept: zero(), gold: 0 });

export function createResourceLedger() {
  return { wave: blank(), total: blank() };
}

/** Count a drained batch of sim events. */
export function feedResources(led, events) {
  for (const e of events || []) {
    if (e.type !== 'deposit') continue;
    const t = COLOR_TIER[e.color];
    if (!t) continue;
    const units = e.units || 0, sold = e.sold != null ? e.sold : units, kept = e.kept || 0;
    for (const b of [led.wave, led.total]) {
      b.units[t] += units; b.sold[t] += sold; b.kept[t] += kept; b.gold += e.gold || 0;
    }
  }
}

/** The wave is over: → what it collected, and start counting the next one. */
export function closeWave(led) {
  const w = led.wave;
  led.wave = blank();
  return w;
}

/** The planet's resource names by tier, from missions.json › resources. Missing → the tier word. */
export function resourceNames(catalog, planet) {
  const out = { ...TIER_LABEL };
  for (const r of (catalog && catalog.resources) || []) if (r.planet === planet && out[r.tier]) out[r.tier] = r.name;
  return out;
}

const f = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The icon id for a tier's name, or null while the names are still the tier words (catalogue not loaded). */
export const iconIdFor = (names, t) => (names && names[t] && names[t] !== TIER_LABEL[t] ? resourceId(names[t]) : null);

/** The wave banner line: each tier this wave collected, with the map total so far. Empty when nothing came in yet. */
export function waveResourcesHtml(wave, total, names = TIER_LABEL) {
  const tiers = TIERS.filter((t) => total.units[t] > 0);
  if (!tiers.length) return '';
  return '<div class="res">' + tiers.map((t) =>
    '<span class="r" style="--c:' + TIER_COLOR[t] + '">' + (iconIdFor(names, t) ? resourceIconHtml(iconIdFor(names, t), 'ri') : '<i></i>') + '<b>+' + f(wave.units[t]) + '</b> ' + esc(names[t]) +
    '<em>' + f(total.units[t]) + ' total</em></span>').join('') + '</div>';
}

/** The map result panel: per tier, the total collected, sold to the Collective and kept. */
export function mapResourcesHtml(total, names = TIER_LABEL, { contract = false } = {}) {
  const tiers = TIERS.filter((t) => total.units[t] > 0);
  let h = '<div class="rh">RESOURCES COLLECTED</div>';
  if (!tiers.length) return h + '<div class="rnone">Nothing was harvested this battle.</div>';
  h += '<table class="rtab"><tr><th></th><th>Collected</th>' + (contract ? '<th>Sold</th><th>Kept</th>' : '') + '</tr>';
  for (const t of tiers) {
    h += '<tr><td><span class="dot" style="background:' + TIER_COLOR[t] + '"></span>' + esc(names[t]) + '</td><td>' + f(total.units[t]) + '</td>' +
      (contract ? '<td>' + f(total.sold[t]) + '</td><td class="k">' + (total.kept[t] ? '+' + f(total.kept[t]) : '—') + '</td>' : '') + '</tr>';
  }
  const all = (k) => TIERS.reduce((a, t) => a + total[k][t], 0);
  h += '<tr class="sum"><td>Total</td><td>' + f(all('units')) + '</td>' + (contract ? '<td>' + f(all('sold')) + '</td><td class="k">' + (all('kept') ? '+' + f(all('kept')) : '—') + '</td>' : '') + '</tr></table>';
  h += '<div class="rft">' + f(total.gold) + ' GOLD FROM HARVEST' + (contract && all('kept') ? ' · KEPT GOES TO YOUR INVENTORY' : '') + '</div>';
  return h;
}
