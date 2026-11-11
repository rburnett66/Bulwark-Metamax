/**
 * src/outpost/view/awayReport.js — "while you were away": the report advance() returns, as rows for the modal
 * (design docs/16 Bulwark MM/design/Outpost-Design.md §5.3; tech plan §6.1) [MM-story_mw5oeer7_n].
 *
 * Pure. The rows are the `report` of src/outpost/model.js advance(): extraction per ore (and grade), each raid with
 * its result and the ore lost on a breach, the defenses' wear, and the builds that finished.
 */
import { oreById } from '../../data/ores.js';
import { PLANETS } from '../../data/planets.js';

const HOUR = 3_600_000, MIN = 60_000;
import { OUTPOST_KIND_NAME as KIND_NAME } from '../../data/outpostStructures.js';   // the one name table
const TIER_COLOUR = { common: '#5fb8ff', uncommon: '#ffd34a' };   // the battle's blue / yellow crystals
const ROMAN = ['', 'I', 'II', 'III'];

/** "3 h 12 min", "45 min", "2 days 4 h". */
export function awayFor(ms) {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d) return `${d} ${d === 1 ? 'day' : 'days'}${h % 24 ? ` ${h % 24} h` : ''}`;
  return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
}
/** "2 h ago" relative to the report's end. */
const ago = (at, to) => (to - at < MIN ? 'just now' : `${awayFor(to - at)} ago`);

/** An ore item id ('iron', 'iron_deep') → { id, name, colour, deep }. */
export function oreLabel(item) {
  const o = oreById(item);
  if (!o) return { id: item, name: item, colour: '#cfd6de', deep: false };
  return { id: item, name: o.deep ? `${o.name}, deep grade` : o.name, colour: o.colour || '#cfd6de', deep: !!o.deep };
}

/**
 * The surface resources the harvesters brought in (story O10): report.harvested (units gathered while away, per tier)
 * and report.banked (what opening the outpost moved from the hopper to the inventory, per resource id). catalog: the
 * mission catalogue, for the planet's resource names. → [{ tier, name, colour, units, banked }]
 */
export function harvestRows(report, planet, catalog) {
  const name = (PLANETS[planet] || {}).name || planet;
  const res = (tier) => ((catalog && catalog.resources) || []).find((r) => r.planet === name && r.tier === tier);
  const banked = report.banked || {};
  return ['common', 'uncommon'].map((tier) => {
    const r = res(tier), units = Math.floor(((report.harvested || {})[tier] || 0) + 1e-9);
    return { tier, name: r ? r.name : `${tier} surface resource`, colour: TIER_COLOUR[tier], units, banked: (r && banked[r.id]) || 0 };
  }).filter((x) => x.units > 0 || x.banked > 0);
}

/**
 * report → { show, away, rows: { extracted: [{ name, colour, units }], raids: [{ result, label, when, lost }],
 * wear, built: [label], full } }. show is false when nothing worth telling happened (a whole unit or more mined,
 * a raid, a build, a bay filling).
 */
export function awayReportModel(report, planet, map, catalog = null) {   // eslint-disable-line no-unused-vars
  const empty = { show: false, away: '', extracted: [], harvested: [], raids: [], wear: 0, built: [], full: 0, held: 0, breached: 0 };
  if (!report || !(report.to > report.from)) return empty;
  const extracted = Object.entries(report.extracted || {})
    .map(([item, units]) => ({ ...oreLabel(item), units: Math.floor(units + 1e-9) }))
    .filter((r) => r.units > 0)
    .sort((a, b) => b.units - a.units);
  const raids = (report.raids || []).map((r) => {
    const lost = Object.entries(r.lost || {}).map(([item, u]) => ({ ...oreLabel(item), units: Math.floor(u + 1e-9) })).filter((x) => x.units > 0);
    return {
      result: r.result, when: ago(r.at, report.to),
      label: r.result === 'breach' ? 'Raid broke through' : 'Raid repelled',
      lost, lostText: lost.length ? 'lost ' + lost.map((l) => `${l.units} ${l.name}`).join(', ') : '',
      damage: Math.round(r.damage || 0),
    };
  });
  const wear = raids.reduce((a, r) => a + r.damage, 0);
  const built = (report.built || []).map((b) => `${KIND_NAME[b.kind] || b.kind}${b.tier > 1 ? ' ' + ROMAN[b.tier] : ''} finished`);
  const full = new Set((report.full || []).map((f) => f.pad)).size;
  const harvested = harvestRows(report, planet, catalog);
  const show = extracted.length > 0 || raids.length > 0 || built.length > 0 || full > 0 || harvested.length > 0;
  return {
    show, away: awayFor(report.to - report.from), extracted, harvested, hopperFull: report.hopperFull != null, raids, wear, built, full,
    held: raids.filter((r) => r.result === 'held').length, breached: raids.filter((r) => r.result === 'breach').length,
    capped: report.to - report.from >= 72 * HOUR - MIN,
  };
}
