// [MM-story_mwohmiyq_2u] The Powder cast file (content/characters/ground.json): every character's nine secrets, their
// personality's rules, real items and reward kinds, short lines, and the Verdance map cast. Owner 2026-11-17..19.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECRET_KEYS, SECRET_STEPS, GUARDS, PERSONALITIES } from '../save/secrets.js';
import { RELATION_LABEL, FACTION_KEYS, relationOf } from './factionRelations.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const FILE = read('../../content/characters/ground.json');
const PACKS = read('../../content/dialog/voicepacks.json');
const CATALOG = read('../../content/missions/missions.json');
const ITEMS = new Set(CATALOG.resources.map((r) => r.id));
const REWARDS = new Set(Object.keys(CATALOG.rewardKinds));
const ALL_NAMES = new Set(Object.values(PACKS.factions).flatMap((f) => f.characters.map((c) => c.name)));
const words = (l) => String(l).trim().split(/\s+/).length;
const SHORT = 12;   // owner: "what we have now is too wordy" — one short sentence [MM-story_mwohmn64_2y]
const pos = (ch, key) => ch.secrets.findIndex((x) => x.key === key);

test('the Powder file holds the nine Powder characters of the voice packs, each with a known personality', () => {
  assert.equal(FILE.faction, 'ground');
  assert.deepEqual(FILE.characters.map((c) => c.name).sort(), PACKS.factions.ground.characters.map((c) => c.name).sort());
  for (const ch of FILE.characters) assert.ok(PERSONALITIES[ch.personality], `${ch.name}: personality ${ch.personality}`);
});

test('every character has all nine secrets once, in their own order (no two orders alike)', () => {
  const orders = new Set();
  for (const ch of FILE.characters) {
    assert.deepEqual(ch.secrets.map((x) => x.key).sort(), [...SECRET_KEYS].sort(), ch.name);
    for (const x of ch.secrets) assert.ok(x.text && x.line, `${ch.name} ${x.key}: text and line`);
    orders.add(ch.secrets.map((x) => x.key).join());
  }
  assert.equal(orders.size, FILE.characters.length, 'the order changes for each character');
});

test('what they want is a real item; what they share, their treasure and their magic are missions with real rewards', () => {
  for (const ch of FILE.characters) for (const x of ch.secrets) {
    if (x.key === 'want') assert.ok(ITEMS.has(x.item), `${ch.name}: wants ${x.item}`);
    if (['share', 'treasure', 'magic'].includes(x.key)) {
      assert.ok(x.mission && x.mission.task, `${ch.name} ${x.key}: a mission`);
      assert.ok(REWARDS.has(x.mission.reward.kind), `${ch.name} ${x.key}: reward ${x.mission.reward.kind}`);
      assert.equal(typeof x.mission.reward.amount, 'number');
      if (x.mission.reward.kind === 'resource') assert.ok(ITEMS.has(x.mission.reward.item), x.mission.reward.item);
    } else assert.equal(x.mission, undefined, `${ch.name} ${x.key}: no mission`);
  }
});

test('guards are shame, fear, loyalty, control or love; love names someone real; a lie gives way above its own step', () => {
  for (const ch of FILE.characters) ch.secrets.forEach((x, i) => {
    if (x.guard) assert.ok(GUARDS.includes(x.guard), `${ch.name} ${x.key}: guard ${x.guard}`);
    if (x.guard === 'love' || x.key === 'love') assert.ok(ALL_NAMES.has(x.who), `${ch.name}: loves ${x.who}`);
    if (x.lie) {
      assert.ok(x.lie.text && x.lie.line, `${ch.name} ${x.key}: the lie is written`);
      assert.ok(x.lie.until > SECRET_STEPS[i], `${ch.name} ${x.key}: the truth comes after the lie`);
    }
  });
});

test('personality shapes the telling (owner: whimsical shares magic quickly; evil shares lies)', () => {
  const lies = (ch) => ch.secrets.filter((x) => x.lie).length;
  const guards = (ch, g) => ch.secrets.filter((x) => x.guard === g).length;
  for (const ch of FILE.characters) {
    switch (ch.personality) {
      case 'whimsical': assert.ok(pos(ch, 'magic') < 3 && pos(ch, 'sense') < 3 && !lies(ch), ch.name); break;
      case 'open-hearted': assert.ok(pos(ch, 'love') < 4 && pos(ch, 'sorrow') < 4 && !lies(ch), ch.name); break;
      case 'proud': assert.ok(pos(ch, 'sorrow') === 8 && guards(ch, 'shame') >= 1, ch.name); break;
      case 'wary': assert.ok(guards(ch, 'fear') >= 2, ch.name); break;
      case 'devoted': assert.ok(guards(ch, 'loyalty') >= 2, ch.name); break;
      case 'schemer': assert.ok(guards(ch, 'control') >= 1 && lies(ch) >= 1 && pos(ch, 'share') === 0, ch.name); break;
      case 'cruel': assert.ok(lies(ch) >= 2, ch.name); break;
      default: assert.fail(ch.personality);
    }
  }
  // the evil half lies; the good half does not
  const align = Object.fromEntries(PACKS.factions.ground.characters.map((c) => [c.name, c.align]));
  for (const ch of FILE.characters) if (['AG', 'PG', 'G', 'CG'].includes(align[ch.name])) assert.equal(lies(ch), 0, ch.name);
  assert.ok(FILE.characters.filter((ch) => ['CE', 'E', 'PE', 'DE'].includes(align[ch.name])).every((ch) => lies(ch) >= 1));
});

test('the lines are short: start, win, lose, every secret and lie, every secondary', () => {
  const long = [];
  const check = (who, l) => { if (l && words(l) > SHORT) long.push(`${who}: ${l}`); };
  for (const ch of FILE.characters) {
    for (const k of ['start', 'win', 'lose']) { assert.ok(ch.lines[k], `${ch.name}: ${k}`); check(ch.name, ch.lines[k]); }
    for (const x of ch.secrets) { check(ch.name, x.line); if (x.lie) check(ch.name, x.lie.line); }
  }
  for (const m of Object.values(FILE.maps)) check(m.secondary.name, m.secondary.line);
  assert.deepEqual(long, []);
});

test('a relation bend names a faction and a relation, differs from the faction row, and says why', () => {
  for (const ch of FILE.characters) for (const [k, b] of Object.entries(ch.relations || {})) {
    assert.ok(FACTION_KEYS.includes(k) && k !== 'ground', `${ch.name}: ${k}`);
    assert.ok(RELATION_LABEL[b.to], `${ch.name}: ${b.to}`);
    assert.notEqual(b.to, relationOf('ground', k), `${ch.name} toward ${k}: a bend, not the default`);
    assert.ok(b.why, `${ch.name} toward ${k}: why`);
  }
});

test('Verdance maps 1-9: each map its own Powder character; each secondary from another faction, a real character', () => {
  const ids = Object.keys(FILE.maps).sort((a, b) => a - b);
  assert.deepEqual(ids, ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  const prim = ids.map((i) => FILE.maps[i].primary);
  assert.equal(new Set(prim).size, 9, 'one character per map, all nine met across the planet');
  for (const i of ids) {
    const sec = FILE.maps[i].secondary;
    assert.notEqual(sec.faction, 'ground');
    assert.ok(PACKS.factions[sec.faction].characters.some((c) => c.name === sec.name), `${sec.name} is in ${sec.faction}`);
  }
  assert.equal(FILE.maps['1'].primary, 'Quartermaster Ines Roth', 'map 1 keeps its mission giver');
});
