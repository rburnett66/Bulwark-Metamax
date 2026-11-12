// Owner 2026-11-11: "I see a lock on resources I can't build on so make the lock brass colored".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEPOSIT_LOCK_BRASS } from './outpostScene.js';

test('the locked-deposit padlock is brass, not silver', () => {
  const [r, g, b] = [(DEPOSIT_LOCK_BRASS >> 16) & 255, (DEPOSIT_LOCK_BRASS >> 8) & 255, DEPOSIT_LOCK_BRASS & 255];
  assert.ok(r > g && g > b && r - b > 80, `a warm yellow-gold (${r},${g},${b})`);
  const src = readFileSync(new URL('./outpostScene.js', import.meta.url), 'utf8');
  assert.match(src, /color: DEPOSIT_LOCK_BRASS/);
  assert.doesNotMatch(src, /color: 0xd8dde3, roughness: 0\.4, metalness: 0\.6/);
});
