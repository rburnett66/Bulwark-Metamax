// [MM-story_mwohml6o_2w] STANDINGS shows a character's personality, relations and secrets: revealed, held back, locked,
// and a lie marked once it is uncovered. The faction detail shows its Relations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../data/factions.js';
import { fictionHtml, secretsHtml, rewardWords, characterDetailHtml, factionDetailHtml } from './standingsScreen.js';
import { revealSecrets } from '../save/secrets.js';

const FILE = JSON.parse(readFileSync(new URL('../../content/characters/ground.json', import.meta.url), 'utf8'));
const who = (n) => FILE.characters.find((c) => c.name === n);
const met = (name, score, extra = {}) => ({ rapport: { [name]: { score, kept: 1, broken: 0, ...extra } } });

test('an unmet character shows no secrets; met, the revealed ones read out and the rest stay ???', () => {
  const otto = who('Captain Otto von Halbrecht');
  assert.match(secretsHtml(revealSecrets(otto, {})), /Meet this character/);
  const html = fictionHtml('ground', otto, revealSecrets(otto, met(otto.name, 12)));
  assert.match(html, /Open-hearted\./);
  assert.match(html, /He wants the house of Halbrecht to end with him/);
  assert.match(html, /Keeping something back\. Protecting someone\./, 'his love waits until the player meets Rei');
  assert.equal((html.match(/<b>\?\?\?<\/b>/g) || []).length, 6);
  assert.match(html, /Hostile|Wary/);
  assert.match(html, /He loves Rei &quot;Skylark&quot; Tanaka, an Air ace\.|He loves Rei/, 'the bend says why');
});

test('a lie reads as the truth until it is uncovered, then the truth with "They lied before."', () => {
  const graf = who('Chancellor Wilhelmina Graf');
  let html = secretsHtml(revealSecrets(graf, met(graf.name, 0)));
  assert.match(html, /She offers amnesty/);
  assert.doesNotMatch(html, /They lied before/);
  html = secretsHtml(revealSecrets(graf, met(graf.name, 60)));
  assert.match(html, /Returned deserters are shot at dawn\. <em>They lied before\.<\/em>/);
  assert.match(html, /Mission: Return a deserter.*Reward: 500 gold/);
});

test('rewards in words; the detail panes carry the fiction and the faction Relations', () => {
  assert.equal(rewardWords({ kind: 'resource', item: 'heartwood-amber', amount: 8 }), '8 Heartwood Amber');
  assert.equal(rewardWords({ kind: 'alignment', amount: -2 }), '-2 alignment');
  const groups = [{ key: 'ground', name: 'Ground / Powder', characters: [{ name: 'Colonel Aldric Vane', align: 'PG', met: true, score: 5, kept: 1, broken: 0, greets: 0, sales: 0, purchases: 0, contracts: 0, band: { key: 'neutral', label: 'Neutral' }, mood: 'neutral', motivation: '' }] }];
  const d = characterDetailHtml(groups, 'Colonel Aldric Vane', () => '<i data-fx></i>');
  assert.match(d, /<i data-fx><\/i>/);
  const f = factionDetailHtml([{ key: 'ground', name: 'Ground / Powder', loyalty: 0, tier: 0, prev: 0, next: 100, band: { key: 'neutral', label: 'Neutral' }, rival: 'Air', metCount: 0, castCount: 9 }], 'ground', 0);
  assert.match(f, /<h3>Relations<\/h3>/);
  assert.match(f, /Air<\/dt><dd[^>]*>Hostile/);
});
