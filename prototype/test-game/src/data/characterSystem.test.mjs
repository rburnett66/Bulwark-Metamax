// [MM-story_mwp61a5f_32] THE CHARACTER SYSTEM GATE (docs/tech-plan/Character-System.md §9, Magic-System.md §9).
// Owner 2026-11-20: "When we started Bulwark we created the character and dialog system. Are we still following a system
// design approach?" The rules must hold outright; the content's known problems are tolerated only while they are listed
// in content/characters/gate-baseline.json, so a new problem fails here and a fixed one must come off the list
// (node tools/dialog/character_gate.mjs --write-baseline; the work list is docs/16 Bulwark MM/create/Character-Gate-Report.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ALIGNMENTS, alignmentMatrix, alignmentRelation, polarity, conviction } from './alignment.js';
import { buildModel, PERSONALITY, PERSONALITIES, DEFAULT_REACH } from './characterModel.js';
import { flawsFor, AXES, AXIS_ORDER, axisOfWord } from './flaws.js';
import { FACTION_TRAITS, lacksScience } from './factionTraits.js';
import { HOME_SIDE, MAGICS, BLENDS, useFor, isSide } from './magic.js';
import { characterFindings, statRanks } from './characterGate.js';
import { FACTION_KEYS } from './factionRelations.js';
import { UNITS } from './tables.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));
const packs = json('../../content/dialog/voicepacks.json');
const threads = json('../../content/characters/threads.json');
const files = {};
for (const k of FACTION_KEYS) if (existsSync(new URL(`../../content/characters/${k}.json`, import.meta.url))) files[k] = json(`../../content/characters/${k}.json`);
const model = buildModel({ packs, files, threads });

test('1. the GDD §10.2 rules regenerate the GDD §10.3 matrix, all 81 cells, symmetric', () => {
  const gdd = read('../../../../docs/sources/bulwark-gdd.md');
  const sym = { '++': 2, '+': 1, '0': 0, '−': -1, '− −': -2 };
  const m = alignmentMatrix(); let cells = 0;
  for (const line of gdd.split('\n')) {
    const r = line.match(/^\| \*\*(\w+)\*\* *\|(.*)\|\s*$/);
    if (!r || !ALIGNMENTS.includes(r[1])) continue;
    r[2].split('|').map((s) => s.trim()).forEach((cell, i) => { assert.equal(m[r[1]][ALIGNMENTS[i]], sym[cell], `${r[1]} / ${ALIGNMENTS[i]}`); cells++; });
  }
  assert.equal(cells, 81);
  for (const a of ALIGNMENTS) for (const b of ALIGNMENTS) assert.equal(alignmentRelation(a, b), alignmentRelation(b, a));
  assert.deepEqual([polarity('CG'), polarity('N'), polarity('DE'), conviction('PG'), conviction('E'), conviction('CE'), conviction('N')], ['good', 'neutral', 'evil', 3, 2, 1, 0]);
});

test('base relations: alignment plus faction, clamped (Character-System §3 examples)', () => {
  assert.equal(model.baseRelation('Field-Marshal Seraphine von Halbrecht', 'Colonel Aldric Vane'), 2);
  assert.equal(model.baseRelation('Rei "Skylark" Tanaka', 'Captain Otto von Halbrecht'), 1, 'respect despite the war');
  assert.equal(model.baseRelation('Hierophant Aurelia', 'The Ordained Prime, Vaelith'), 2, 'the balance pact');
});

test('2. the personality table covers every alignment with two of the six personalities; proud is not one of them', () => {
  for (const a of ALIGNMENTS) { assert.equal(PERSONALITY[a].length, 2); for (const p of PERSONALITY[a]) assert.ok(PERSONALITIES.includes(p)); }
  assert.ok(!PERSONALITIES.includes('proud'), 'pride is a flaw (owner 2026-11-20)');
});

test('flaws: eight axes, the owner\'s words all on a ladder, and the worked examples (Character-System §5a.3)', () => {
  assert.equal(AXIS_ORDER.length, 8);
  for (const w of ['too trusting', 'suspicious', 'proud', 'emotionally unstable', 'greedy', 'lustful', 'arrogant', 'closed-minded', 'dim', 'lazy', 'self-centred', 'narcissistic', 'overbearing', 'rude', 'prejudiced', 'mean-spirited']) {
    assert.ok(axisOfWord(w), `${w} has no axis`);
  }
  for (const a of AXIS_ORDER) assert.ok(AXES[a].low.length >= 3 && AXES[a].high.length >= 3);
  assert.deepEqual(model.flawsOf('Captain Otto von Halbrecht'), [], 'Otto: his tragedy is the war, not a weakness');
  assert.deepEqual(model.flawsOf('Field-Marshal Seraphine von Halbrecht').map((f) => f.word), ['vain']);
  assert.deepEqual(model.flawsOf('Chancellor Wilhelmina Graf').map((f) => f.word), ['overbearing']);
  assert.deepEqual(flawsFor({ name: 'X', faction: 'ground', align: 'N', personality: 'wary', flaw: { word: 'lazy', why: 'test' } }).map((f) => [f.word, f.axis, f.declared]), [['lazy', 'drive', true]]);
  for (const n of model.chars.keys()) {
    const fl = model.flawsOf(n);
    assert.ok(fl.length <= 2, n);
    for (const f of fl) if (/prejudiced|bigoted/.test(f.word)) assert.match(f.word, / against /, `${n}: prejudice names a faction`);
  }
});

test('3. threads name real characters and real kinds, and every GDD §12 thread is there', () => {
  const kinds = new Set(threads.kinds);
  for (const t of threads.threads) {
    assert.ok(model.chars.has(t.from), `unknown ${t.from}`); assert.ok(model.chars.has(t.to), `unknown ${t.to}`);
    assert.ok(kinds.has(t.kind), t.kind);
  }
  const has = (from, to, kind) => threads.threads.some((t) => t.from === from && t.to === to && t.kind === kind && t.gdd);
  assert.ok(has('Captain Otto von Halbrecht', 'Rei "Skylark" Tanaka', 'love') && has('Rei "Skylark" Tanaka', 'Captain Otto von Halbrecht', 'love'), '[DL]');
  assert.ok(has('Kaito "Rogue" Minami', 'Cadet-Prodigy Ezra "Comet" Lin', 'rival'), '[TA]');
  assert.ok(has('Inquisitor Mordane', 'Heretic Isolde', 'hunts') && has('Hierophant Aurelia', 'The Ordained Prime, Vaelith', 'confidant'), '[RE]');
  assert.ok(has('Wavecaller Nerea', 'Warlord-Gunner Vex Marrow', 'hunts'), '[RV]');
  assert.ok(has('Chieftain Coral of the Reef-Born', 'Raider-Chief Drowned Kael', 'rival') && has('Splinter "Wildseed" Ovo', 'The Root-Mind', 'rival'), '[TW]');
  assert.ok(has('Captain Otto von Halbrecht', 'General Kord Stahl', 'kin') && has('Chief Ethicist Dr. Grace Sterling', 'CEO Adrian Sterling', 'kin'), '[FL]');
});

test('reach: defaults, shifts, and who knows (Character-System §6)', () => {
  assert.equal(DEFAULT_REACH.hate, 'across'); assert.equal(DEFAULT_REACH.magic, 'private');
  const otto = 'Captain Otto von Halbrecht';
  assert.ok(model.circleOf(otto).includes('Rei "Skylark" Tanaka'), 'his love is in his circle');
  assert.ok(model.knowersOf(otto, { key: 'hate' }).includes('General Kord Stahl'), 'the one he hates knows it');
  assert.deepEqual(model.knowersOf(otto, { key: 'magic' }), [], 'magic is private');
  assert.equal(model.reachOf('Sergeant "Bricks" Malloy', { key: 'magic' }), 'close', 'whimsical lets magic slip');
});

test('faction traits: two and two each, Powder in the owner\'s words, and traits agree with home magic', () => {
  for (const k of FACTION_KEYS) {
    assert.equal(FACTION_TRAITS[k].knownFor.length, 2, k); assert.equal(FACTION_TRAITS[k].knownToLack.length, 2, k);
    for (const w of [...FACTION_TRAITS[k].knownFor, ...FACTION_TRAITS[k].knownToLack]) if (w.push) assert.ok(AXIS_ORDER.includes(w.push.axis), `${k}: ${w.word}`);
    if (lacksScience(k)) assert.notEqual(HOME_SIDE[k], 'brain', `${k} lacks science, so it is never Brain-home`);
  }
  assert.deepEqual(FACTION_TRAITS.ground.knownFor.map((w) => w.word), ['resourceful', 'heavily armoured']);
  assert.deepEqual(FACTION_TRAITS.ground.knownToLack.map((w) => w.word), ['science', 'strategic planning']);
});

test('magic: the owner\'s names and home sides, three per side, intent from polarity', () => {
  assert.deepEqual(Object.values(MAGICS).map((m) => [m.faculty, m.field, m.theme]), [['Brain', 'Electrum', 'electric'], ['Soul', 'Quantum', 'quantum'], ['Body', 'Organum', 'organic']]);
  assert.equal(BLENDS.valor.name, 'Valor'); assert.equal(HOME_SIDE.ground, 'soul');
  for (const side of Object.keys(MAGICS)) assert.equal(Object.values(HOME_SIDE).filter((s) => s === side).length, 3, side);
  assert.deepEqual([useFor('AG'), useFor('N'), useFor('DE')], ['good', 'neutral', 'evil']);
  assert.ok(isSide('soul') && isSide('valor') && !isSide('fire'));
});

test('the content\'s known problems: nothing new, nothing fixed and still listed (gate-baseline.json)', () => {
  const findings = characterFindings(model, files, statRanks(UNITS, packs)).map((f) => f.id);
  const base = new Set(json('../../content/characters/gate-baseline.json').findings);
  const fresh = findings.filter((id) => !base.has(id));
  const fixed = [...base].filter((id) => !findings.includes(id));
  assert.deepEqual(fresh, [], 'new character-system problems (fix the content, or see docs/16 Bulwark MM/create/Character-Gate-Report.md)');
  assert.deepEqual(fixed, [], 'fixed problems still listed: run node tools/dialog/character_gate.mjs --write-baseline');
});
