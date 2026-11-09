// Every character listed as having expression portraits has all three files [MM-task_mw9odkf0_4].
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { MOOD_PORTRAITS } from './portraitMoods.js';

test('each listed slug has its angry, neutral and happy portraits', () => {
  for (const slug of MOOD_PORTRAITS) for (const mood of ['angry', 'neutral', 'happy']) {
    assert.ok(existsSync(new URL(`../../content/dialog/portraits/${slug}-${mood}.png`, import.meta.url)), `${slug}-${mood}.png is missing`);
  }
});
