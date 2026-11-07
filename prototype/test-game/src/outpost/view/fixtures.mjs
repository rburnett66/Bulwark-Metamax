// Shared test fixtures for the outpost view's node tests [MM-story_mw5oeer7_n]: the real Verdance outpost map (the
// committed Forge export, so the tests follow the map) and contract 1's mission row as the extractor writes it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { outpostMapFromForge } from '../outpostMap.js';

const FORGE = fileURLToPath(new URL('../../../content/maps/forge/ground-outpost.json', import.meta.url));
export const forge = JSON.parse(readFileSync(FORGE, 'utf8'));
export const map = outpostMapFromForge(forge, 'ground');

export const MIN = 60_000, HOUR = 60 * MIN;
export const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);

export const OC1 = {
  id: 'OC-VER-1', questLine: 'QL-VER-O', step: 1, role: 'primary', variant: null, planet: 'Verdance', map: null,
  title: 'Iron for the Oath', type: 'outpost', giver: { name: 'Colonel Aldric Vane', faction: 'ground', align: 'PG' },
  grantedAt: "Halbrecht's Oath", collectAt: "Halbrecht's Oath", briefing: '', status: 'Draft', impact: { loyaltyPlanet: 20 },
  view: [], unlock: [{ cond: 'capital_ship_arrived', param: 'Verdance', text: "Halbrecht's Oath is in orbit" }], execute: [],
  complete: [
    { cond: 'outpost_online', param: 'ground', op: '≥', value: 1, text: 'Establish the outpost' },
    { cond: 'ore_sold', param: 'iron', op: '≥', value: 300, text: "Deliver 300 Iron to Halbrecht's Oath" },
    { cond: 'raids_held', param: 'ground', op: '≥', value: 1, text: 'Hold the outpost through a raid' },
  ],
  fail: [], rewards: [{ kind: 'gold', amount: 2000, label: 'Gold' }, { kind: 'xp', amount: 300, label: 'Commander XP' }],
};
export const catalog = { missions: [OC1], resources: [], questLines: {}, techUnlocks: {} };

/** An in-memory store shaped like save.js loadSave / updateSave (each load is a fresh copy, as from localStorage). */
export function memoryStore(save) {
  let s = structuredClone(save);
  return { load: () => structuredClone(s), update(fn) { const x = structuredClone(s); fn(x); s = x; return structuredClone(s); } };
}
