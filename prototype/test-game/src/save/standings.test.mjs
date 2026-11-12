// Standings aboard capital ships [MM-task_mw9nm69a_3]: character ratings from mission outcomes, faction relationships.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteRapport, noteRapportEvent, ensureRapport, rapportDelta, rapportBand, factionBand, characterStandings, factionStandings, captainOf, moodFor, standingOf, KEPT, BROKEN, ABANDONED, RAPPORT_GAIN } from './standings.js';

const packs = JSON.parse(readFileSync(new URL('../../content/dialog/voicepacks.json', import.meta.url), 'utf8'));
const mission = (name, impact = {}) => ({ giver: { name, faction: 'ground' }, impact });

test('a mission\'s end moves its giver\'s rating: kept up, broken and abandoned down', () => {
  const s = {};
  noteRapport(s, mission('General Kord Stahl', { loyaltyPlanet: 35, brokenPenalty: -45 }), 'done', null);
  assert.deepEqual(s.rapport['General Kord Stahl'], { score: 35, kept: 1, broken: 0, faction: 'ground' });
  noteRapport(s, mission('General Kord Stahl', { brokenPenalty: -45 }), 'failed', 'Out of attempts.');
  assert.equal(s.rapport['General Kord Stahl'].score, -10);
  noteRapport(s, mission('Sergeant "Bricks" Malloy'), 'failed', 'Abandoned by the commander.');
  assert.equal(s.rapport['Sergeant "Bricks" Malloy'].score, ABANDONED);
  assert.equal(rapportDelta(mission('x'), 'done'), KEPT);
  assert.equal(rapportDelta(mission('x'), 'failed', 'gone'), BROKEN);
});

test('an old save is backfilled once from the missions it still holds', () => {
  const s = { missions: [{ ...mission('Quartermaster Ines Roth'), end: 'done' }, { ...mission('Quartermaster Ines Roth'), end: null }] };
  ensureRapport(s);
  assert.equal(s.rapport['Quartermaster Ines Roth'].kept, 1);
  ensureRapport(s);
  assert.equal(s.rapport['Quartermaster Ines Roth'].kept, 1, 'not counted twice');
});

test('bands', () => {
  assert.equal(rapportBand(0, false).label, 'Not met');
  assert.equal(rapportBand(60, true).label, 'Trusted');
  assert.equal(rapportBand(25, true).label, 'Friendly');
  assert.equal(rapportBand(0, true).label, 'Neutral');
  assert.equal(rapportBand(-30, true).label, 'Wary');
  assert.equal(rapportBand(-90, true).label, 'Hostile');
  assert.equal(factionBand(120, 1).label, 'Allied · Tier 1');
  assert.equal(factionBand(-70, 0).label, 'Hostile');
});

test('all 81 characters by faction, and all nine factions with loyalty and the next tier', () => {
  const s = { rapport: { 'General Kord Stahl': { score: 35, kept: 1, broken: 0 } }, loyalty: { 'Ground / Powder': 130, Air: -40 }, factionTiers: { 'Ground / Powder': 1 } };
  const groups = characterStandings(s, packs);
  assert.equal(groups.length, 9);
  assert.equal(groups.reduce((a, g) => a + g.characters.length, 0), 81);
  const stahl = groups[0].characters.find((c) => c.name === 'General Kord Stahl');
  assert.equal(stahl.band.label, 'Friendly');
  assert.equal(groups[0].characters.filter((c) => c.met).length, 1);
  const rows = factionStandings(s, packs);
  assert.equal(rows.length, 9);
  const ground = rows.find((r) => r.key === 'ground');
  assert.equal(ground.tier, 1); assert.equal(ground.next, 260); assert.equal(ground.metCount, 1); assert.equal(ground.castCount, 9);
  assert.equal(rows.find((r) => r.key === 'air').band.label, 'Wary');
});

test('a greeting on each ship visit is +1; a sale or a purchase raises the rating too (owner 2026-11-09)', () => {
  assert.deepEqual(RAPPORT_GAIN, { greet: 1, sale: 1, purchase: 1, contract: 1 });
  const s = {};
  assert.equal(noteRapportEvent(s, 'Colonel Aldric Vane', 'ground', 'greet', { day: '2026-11-09' }), true);
  assert.equal(noteRapportEvent(s, 'Colonel Aldric Vane', 'ground', 'greet', { day: '2026-11-09' }), false, 'once per day');
  assert.equal(noteRapportEvent(s, 'Colonel Aldric Vane', 'ground', 'greet', { day: '2026-11-10' }), true, 'the next day counts');
  noteRapportEvent(s, 'Colonel Aldric Vane', 'ground', 'sale');
  noteRapportEvent(s, 'Colonel Aldric Vane', 'ground', 'purchase');
  noteRapportEvent(s, 'Colonel Aldric Vane', 'ground', 'bribe');   // not a dealing: ignored
  assert.deepEqual(s.rapport['Colonel Aldric Vane'], { score: 4, kept: 0, broken: 0, faction: 'ground', greets: 2, sales: 1, purchases: 1, greetDay: '2026-11-10' });
  noteRapportEvent(s, 'Ace Jun "Halo" Sato', 'air', 'greet', { day: '2026-11-10' });
  assert.equal(s.rapport['Ace Jun "Halo" Sato'].score, 1, 'the limit is per character');
  const c = characterStandings(s, packs)[0].characters.find((x) => x.name === 'Colonel Aldric Vane');
  assert.equal(c.met, true, 'a visit counts as meeting them');
  assert.equal(c.greets, 2); assert.equal(c.sales, 1);
});

test('the captain of a planet\'s ship, and the portrait expression a rating shows', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
  assert.equal(captainOf(catalog, 'Verdance'), 'Colonel Aldric Vane');
  assert.equal(captainOf(catalog, 'Nowhere'), null);
  assert.equal(moodFor('hostile'), 'angry'); assert.equal(moodFor('wary'), 'angry');
  assert.equal(moodFor('neutral'), 'neutral'); assert.equal(moodFor('unmet'), 'neutral');
  assert.equal(moodFor('friendly'), 'happy'); assert.equal(moodFor('trusted'), 'happy');
  assert.equal(standingOf({ rapport: { X: { score: 70, kept: 2, broken: 0 } } }, 'X').mood, 'happy');
});
