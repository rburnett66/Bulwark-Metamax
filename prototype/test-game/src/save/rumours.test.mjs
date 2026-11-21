// [MM-story_mwp61bjm_33] RUMOURS IN PLAY (docs/tech-plan/Character-System.md §7). Owner 2026-11-20: "Rumored .. but
// players who carefully track story can infer probability" · "Credibility score could also influence dialog creation.
// adding delays, contradictions or elements like '..' 'um' 'well,' 'I, uh ..'" · 2026-11-21: "Secrets should usually be
// delivered at the capital ships."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel } from '../data/characterModel.js';
import { rumourVersion, rumourText, tellerCredibility, combinedCredibility, rumourFrom, noteRumour, rumoursFor, ownerTells, canBeWrong } from './rumours.js';
import { tellsFor, tellCount, pausePoints } from '../comm/tells.js';
import { typedCount, PAUSE_MS } from '../comm/commCard.js';
import { aboardScene, rumourLine } from '../comm/mapCast.js';
import { secretsHtml } from '../menu/standingsScreen.js';
import { revealSecrets } from './secrets.js';
import { shortName } from '../comm/shortName.js';

const j = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const F = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];
const files = Object.fromEntries(F.map((k) => [k, j(`../../content/characters/${k}.json`)]));
const packs = j('../../content/dialog/voicepacks.json');
const model = buildModel({ packs, files, threads: j('../../content/characters/threads.json') });
const ch = (name) => { for (const k of F) { const c = files[k].characters.find((x) => x.name === name); if (c) return c; } };
const sec = (name, key) => ch(name).secrets.find((x) => x.key === key);
const met = (score) => ({ score, kept: 1, broken: 0 });
const OTTO = 'Captain Otto von Halbrecht', KORD = 'General Kord Stahl', BRICKS = 'Sergeant "Bricks" Malloy', INES = 'Quartermaster Ines Roth';

test('what a teller says (§7.2): good tell the truth, an evil enemy twists it, a hunter tells it false', () => {
  assert.equal(rumourVersion(model, BRICKS, OTTO, sec(OTTO, 'love'), {}), 'true', 'good');
  assert.equal(rumourVersion(model, KORD, OTTO, sec(OTTO, 'love'), {}), 'twist', 'Kord is evil and hostile to Otto');
  assert.equal(rumourText(sec(OTTO, 'love'), 'twist'), sec(OTTO, 'love').twist);
  assert.equal(rumourVersion(model, 'Freikorps raider Grigor Vosk', 'Colonel Aldric Vane', { key: 'hate', text: 't', twist: 'w' }, {}), 'false', 'Vosk hunts Vane');
  const lying = { key: 'desire', text: 'truth', lie: { text: 'lie', until: 60 } };
  assert.equal(rumourVersion(model, INES, OTTO, lying, { rapport: { [OTTO]: met(10) } }), 'lie', 'a neutral teller repeats the owner\'s lie');
  assert.equal(rumourVersion(model, INES, OTTO, lying, { rapport: { [OTTO]: met(70) } }), 'true', 'once the truth is out');
});

test('credibility (§7.3) follows only from what the player can see: who, how they stand, their record', () => {
  assert.equal(tellerCredibility(model, OTTO, 'Field-Marshal Seraphine von Halbrecht', {}), 1);
  assert.equal(tellerCredibility(model, INES, OTTO, {}), 0.8);
  assert.equal(tellerCredibility(model, KORD, OTTO, {}), 0.3);
  assert.equal(tellerCredibility(model, KORD, OTTO, { liedBefore: { [KORD]: true } }), 0.15);
  assert.ok(Math.abs(combinedCredibility([0.8, 0.6]) - 0.92) < 1e-9);
  for (const n of model.chars.keys()) if (canBeWrong(model, n)) assert.equal(model.polarityOf(n) === 'good' ? tellerCredibility(model, n, OTTO, {}) : 0.8, 0.8, `${n}: honest, and can be wrong`);
});

test('who tells (§7.1): a knower, once the player has reached that step with the TELLER; never what the owner told', () => {
  const s = { rapport: { [BRICKS]: met(0) } };
  const r0 = rumourFrom(model, files, BRICKS, s);
  if (r0) assert.equal(ch(r0.owner).secrets.findIndex((x) => x.key === r0.key), 0, 'rapport 0 with Bricks reaches only first secrets');
  s.rapport[BRICKS] = met(30);
  const r = rumourFrom(model, files, BRICKS, s);
  assert.ok(r && model.knowersOf(r.owner, sec(r.owner, r.key)).includes(BRICKS));
  noteRumour(s, r); noteRumour(s, r);
  assert.equal(rumoursFor(s, r.owner).length, 1, 'heard once');
  const next = rumourFrom(model, files, BRICKS, s);
  assert.ok(!next || next.owner !== r.owner || next.key !== r.key, 'the next is a different rumour');
  assert.equal(rumourFrom(model, files, 'Colonel Aldric Vane', { rapport: { 'Colonel Aldric Vane': met(100) } }) === null
    || rumourFrom(model, files, 'Colonel Aldric Vane', { rapport: { 'Colonel Aldric Vane': met(100) } }).owner !== OTTO, true, 'a devoted Powder knower shields his own');
});

test('the owner reacts when they tell it themselves (§7.5), and a teller who twisted it is caught out', () => {
  const s = { rapport: { [OTTO]: met(40), [KORD]: met(10) } };
  noteRumour(s, { owner: OTTO, key: 'love', teller: KORD, version: 'twist', text: 'x' });
  const out = ownerTells(model, s, OTTO, sec(OTTO, 'love'));
  assert.equal(out.line, 'Leave them out of this.', 'Otto guards his love by love');
  assert.equal(s.rapport[KORD].score, 7, 'the teller loses 3');
  assert.equal(s.liedBefore[KORD], true, 'and is marked: They lied before.');
  assert.equal(ownerTells(model, { rapport: {} }, OTTO, sec(OTTO, 'love')), null, 'no rumour heard, no reaction');
});

test('tells in the prose (§7.4): sure and good says it plain; a hesitant liar stammers; a schemer lies smoothly', () => {
  assert.equal(tellCount({ credibility: 1, version: 'true', personality: 'devoted' }), 0);
  assert.equal(tellCount({ credibility: 1, version: 'true', personality: 'open-hearted' }), 1, 'their voice');
  assert.equal(tellCount({ credibility: 0.8, version: 'twist', personality: 'wary' }), 2);
  assert.equal(tellCount({ credibility: 0.6, version: 'lie', personality: 'schemer' }), 1, 'the lie adds nothing');
  assert.equal(tellCount({ credibility: 0.2, version: 'twist', personality: 'whimsical' }), 2, 'capped at 2');
  const line = rumourLine(OTTO, 'He loves Rei.');
  assert.equal(line, 'About Otto: he loves Rei.');
  assert.equal(tellsFor(line, { credibility: 1, personality: 'devoted' }), line);
  assert.match(tellsFor(line, { credibility: 0.8, personality: 'devoted', seed: 'a' }), /^About \.\. Otto/, 'a devoted pause before the name');
  assert.match(tellsFor(line, { credibility: 0.8, personality: 'wary', seed: 'a' }), /^(Well,|They say|If it's true,) about Otto/);
  assert.match(tellsFor(line, { credibility: 0.3, version: 'twist', personality: 'schemer', seed: 'a' }), /Or so I heard\. No\. I know\.$/, 'a contradiction only');
  assert.equal(tellsFor(line, { credibility: 0.6, personality: 'wary', seed: 'z' }), tellsFor(line, { credibility: 0.6, personality: 'wary', seed: 'z' }), 'the same every time');
});

test('the ".." holds the typing about 400 ms; under reduced motion there is no pause list', () => {
  assert.deepEqual(pausePoints('I, uh .. about Otto'), [8]);
  const len = 12, dur = 600, per = dur / len, at = 5;
  assert.equal(typedCount(len, dur, at * per + 10, [at]), at, 'holding');
  assert.equal(typedCount(len, dur, at * per + PAUSE_MS - 10, [at]), at, 'still holding');
  assert.ok(typedCount(len, dur, at * per + PAUSE_MS + per * 2, [at]) > at, 'then on');
  assert.equal(typedCount(len, dur, 10000, [at]), len);
});

test('aboard: own new secrets first; with nothing new, a rumour in their voice; heard rumours bring the owner\'s reaction', () => {
  const s = { rapport: Object.fromEntries(files.ground.characters.map((c) => [c.name, met(25)])) };
  let kinds = [];
  for (let visit = 0; visit < 6; visit++) {
    const scene = aboardScene(model, files, packs, 'ground', s, 'Ground / Powder');
    assert.ok(scene.calls.length <= 4, 'three speakers (and a reaction)');
    kinds.push(...scene.calls.map((c) => c.sub.split(' · ').pop()));
    scene.commit(s);
  }
  assert.ok(kinds.includes('SECRET') && kinds.includes('RUMOUR'), 'both happen over several visits');
  const r = Object.values(s.rumours || {}).flat();
  assert.ok(r.length >= 3, 'rumours were recorded');
});

test('Standings: a rumoured secret shows who said it; once the owner tells it, a twisted version is named', () => {
  const otto = ch(OTTO);
  const rumours = [{ key: 'love', teller: KORD, version: 'twist', text: sec(OTTO, 'love').twist }];
  let html = secretsHtml(revealSecrets(otto, { rapport: { [OTTO]: met(0) } }), rumours, { [KORD]: true });
  assert.match(html, /Rumoured:<\/i> He signals an Air pilot/);
  assert.match(html, new RegExp(`Heard from ${shortName(KORD)} <em>They lied before\\.</em>`));
  html = secretsHtml(revealSecrets(otto, { rapport: { [OTTO]: met(100), 'Rei "Skylark" Tanaka': met(5) } }), rumours, {});   // his love waits until the player has met Rei
  assert.match(html, /Kord's version was a lie\./);
});
