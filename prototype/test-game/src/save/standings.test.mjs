// Standings aboard capital ships [MM-task_mw9nm69a_3]: character ratings from mission outcomes, faction relationships.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteRapport, ensureRapport, rapportDelta, rapportBand, factionBand, characterStandings, factionStandings, KEPT, BROKEN, ABANDONED } from './standings.js';

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
