/** comm.test.mjs — comm-dialog voice engine: pure beat builder determinism + data integrity.
 *  Run: node src/comm/comm.test.mjs */
import assert from 'node:assert';
import {
  FACTIONS, ORDER, VGAIN, STATIC, ICONS, FACTION_KEY_BY_NAME,
  hash, countSyllables, buildBeats, utterDuration, paramsFor,
} from './voice.js';
import { factionsInRoster } from '../data/tables.js';

// hash: deterministic, 32-bit unsigned
assert.strictEqual(hash('Chancellor'), hash('Chancellor'), 'hash deterministic');
assert.notStrictEqual(hash('a'), hash('b'), 'hash discriminates');
assert.ok(hash('anything') >= 0, 'hash unsigned');

// syllables: sane bounds
assert.strictEqual(countSyllables(''), 1);
assert.ok(countSyllables('kneel') >= 1);
assert.ok(countSyllables('extraordinarily') <= 6, 'syllables capped at 6');

// beats: same (line, rate, seed, intent) -> identical list; different seed -> diverges
const line = 'Kneel, or be balanced against.';
const a = buildBeats(line, 5, 42, 'statement');
const b = buildBeats(line, 5, 42, 'statement');
assert.deepStrictEqual(a, b, 'beats deterministic for a fixed seed');
const c = buildBeats(line, 5, 43, 'statement');
assert.notDeepStrictEqual(a.map((x) => x.semi), c.map((x) => x.semi), 'seed changes the melody');

// intent contours: questions END higher than statements; trail sinks below statement
const q = buildBeats(line, 5, 42, 'question');
assert.ok(q[q.length - 1].semi > a[a.length - 1].semi, 'question rises at the end');
const tr = buildBeats(line, 5, 42, 'trail');
assert.ok(tr[tr.length - 1].semi < a[a.length - 1].semi, 'trail-off sinks below statement');

// duration: positive, and exclaim (faster rate) is shorter than trail (slower)
const p = paramsFor('ground');
assert.ok(utterDuration(line, p, 'statement') > 0);
assert.ok(utterDuration(line, p, 'exclaim') < utterDuration(line, p, 'trail'), 'exclaim faster than trail');

// paramsFor: overrides apply, defaults preserved
const pp = paramsFor('water', { rateMult: 2, noise: 0.5, reverb: 0.9 });
assert.strictEqual(pp.rate, FACTIONS.water.rate * 2);
assert.strictEqual(pp.noise, 0.5);
assert.strictEqual(pp.reverb, 0.9);
assert.strictEqual(pp.vgain, VGAIN.water, 'loudness normalization attached');
assert.strictEqual(paramsFor('water').noise, FACTIONS.water.noise, 'no-override keeps faction default');

// data integrity: every voice key has gain/static/icon; casts complete
for (const k of ORDER) {
  assert.ok(FACTIONS[k], `faction ${k} defined`);
  assert.ok(VGAIN[k] > 0, `VGAIN for ${k}`);
  assert.ok(STATIC[k], `STATIC bed for ${k}`);
  assert.ok(ICONS[k], `icon for ${k}`);
  assert.strictEqual(FACTIONS[k].cast.length, 3, `${k} has a 3-character cast`);
  for (const ch of FACTIONS[k].cast) assert.ok(ch.n && ch.line && ch.g && ch.intent, `${k} cast entries complete`);
}

// the game's full roster maps onto voice keys — every wave announcement can speak
for (const name of factionsInRoster()) {
  const key = FACTION_KEY_BY_NAME[name];
  assert.ok(key, `tables.js faction "${name}" maps to a voice key`);
  assert.ok(FACTIONS[key], `mapped key ${key} exists`);
}

console.log('comm.test OK — beat determinism, intent contours, and 9/9 faction voice coverage');
