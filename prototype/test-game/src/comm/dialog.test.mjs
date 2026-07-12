/** dialog.test.mjs — moment-map selection over the GENERATED voice packs (all 81 characters).
 *  Run: node src/comm/dialog.test.mjs */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { challengeCall, winCall, defeatCall, fallbackCall, classifyOutcome } from './dialog.js';
import { FACTION_KEY_BY_NAME } from './voice.js';
import { factionsInRoster } from '../data/tables.js';

const here = dirname(fileURLToPath(import.meta.url));
const packs = JSON.parse(readFileSync(join(here, '..', '..', 'content', 'dialog', 'voicepacks.json'), 'utf-8'));

// generated data shape: 9 factions × 9 characters, every one with m0 + defeat (§11 signature audit)
assert.strictEqual(Object.keys(packs.factions).length, 9, '9 factions');
let total = 0;
for (const key of Object.keys(packs.factions)) {
  const chars = packs.factions[key].characters;
  assert.strictEqual(chars.length, 9, key + ' has 9 characters');
  assert.ok(chars.some((c) => c.align === 'PE'), key + ' has a PE champion');
  for (const c of chars) { total++; assert.ok(c.lines.m0 && c.lines.defeat, c.name + ' has m0+defeat'); }
}
assert.strictEqual(total, 81, 'all 81 characters extracted');

// §9 outcome classification
assert.strictEqual(classifyOutcome(0.95, 0), 'efficient');
assert.strictEqual(classifyOutcome(0.95, 1), 'close', 'a lost structure forces close');
assert.strictEqual(classifyOutcome(0.2, 0), 'close');
assert.strictEqual(classifyOutcome(0.5, 0), 'standard');

// every roster faction produces a full set of calls, deterministically
for (const name of factionsInRoster()) {
  const ch = challengeCall(packs, name, 1, 7, 1);
  assert.ok(ch && ch.line && ch.name, name + ' challenge');
  assert.ok(ch.sub.indexOf('PE') >= 0, name + ' first challenge comes from the PE champion');
  assert.deepStrictEqual(ch, challengeCall(packs, name, 1, 7, 1), name + ' challenge deterministic');
  assert.ok(winCall(packs, name, 1, 7, 'efficient', false), name + ' efficient commentary');
  assert.ok(winCall(packs, name, 1, 7, 'close', false), name + ' close-shave commentary');
  const df = defeatCall(packs, name, 7);
  assert.ok(df && df.line, name + ' defeat taunt');
  assert.ok(df.sub.indexOf('PE') >= 0, name + ' defeat is the champion\'s');
  assert.ok(fallbackCall(name, 1, 7), name + ' tool-cast fallback works without packs');
}

// test-mode rotation: later visits may pick a non-champion; picks stay deterministic per wave
const names = new Set();
for (let w = 2; w <= 9; w++) names.add(challengeCall(packs, 'Water', w, 7, w).name);
assert.ok(names.size > 1, 'repeat visits rotate the cast');

// win/close pick different authored lines
const we = winCall(packs, 'Air', 3, 7, 'efficient', false);
const wc = winCall(packs, 'Air', 3, 7, 'close', false);
assert.notStrictEqual(we.line, wc.line, 'efficient vs close select different lines');

// final win = champion concession
const fin = winCall(packs, 'Artillery', 10, 7, 'efficient', true);
assert.ok(fin.sub.indexOf('CONCESSION') >= 0 && fin.sub.indexOf('PE') >= 0, 'final win is the champion concession');

// unknown faction (mixed finale) degrades to null, not a throw
assert.strictEqual(challengeCall(packs, 'Combined forces', 10, 7, 1), null);
assert.strictEqual(fallbackCall('Combined forces', 10, 7), null);
assert.ok(!FACTION_KEY_BY_NAME['Combined forces'], 'finale has no single-faction voice');

console.log('dialog.test OK — 81 packs valid, all moments resolve deterministically for 9/9 factions');
