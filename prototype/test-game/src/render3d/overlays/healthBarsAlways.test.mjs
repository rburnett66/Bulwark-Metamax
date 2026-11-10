// [MM-story_mwb8zbk7_24] owner 2026-11-10: a worn outpost defense always shows its health bar (battle towers still show
// theirs once a hit is seen).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planBars } from './healthBars.js';

const run = (s, frames = 30) => { const mem = new Map(); let out = []; for (let i = 0; i < frames; i++) out = planBars({ structures: new Map([[s.id, s]]) }, [], mem, 1 / 30); return out; };
const tower = (extra) => ({ id: 't1', kind: 'antiGround', pos: { x: 5, y: 5 }, footprint: { w: 1, h: 1 }, hp: 200, maxHp: 400, lifecycle: 'Damaged', ...extra });

test('a worn tower with showHp has its bar without a hit being seen', () => {
  const bars = run(tower({ showHp: true }));
  assert.equal(bars.length, 1);
  assert.ok(bars[0].alpha > 0.9 && Math.abs(bars[0].frac - 0.5) < 0.01);
});

test('a battle tower first seen worn still waits for a hit (unchanged)', () => {
  assert.equal(run(tower({})).length, 0);
});

test('a whole tower shows no bar; an outpost wreck shows an empty one', () => {
  assert.equal(run(tower({ showHp: true, hp: 400, lifecycle: 'Active' })).length, 0);
  const w = run(tower({ showHp: true, hp: 0, lifecycle: 'Wrecked' }));
  assert.equal(w.length, 1);
  assert.equal(w[0].frac, 0);
});
