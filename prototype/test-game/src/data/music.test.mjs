// src/data/music.test.mjs — the planet themes are well-formed scores [MM-story_mvgzp51o_8]. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeFor, parseChord, stepEvents, stepSec, loopSec, layerMix, midiHz } from './music.js';
import { PLANETS } from './planets.js';

test('music: every theme belongs to a real planet; the prototype theme is Ground / Powder', () => {
  for (const k of Object.keys(THEMES)) assert.ok(PLANETS[k], 'theme key ' + k + ' is a planet');
  assert.ok(themeFor('ground'), 'the Ground homeworld has its theme');
  assert.equal(themeFor('nowhere'), null, 'no theme → null (silence), never a throw');
});

test('music: scores are well-formed — one chord per bar, one-bar patterns, melodies inside the loop', () => {
  for (const [k, t] of Object.entries(THEMES)) {
    assert.equal(t.chords.length, t.bars, k + ': a chord per bar');
    for (const c of t.chords) parseChord(c);                       // throws on a typo
    for (const v of t.voices) {
      assert.ok(['build', 'wave'].includes(v.layer), k + '/' + v.id + ' layer');
      if (v.melody) {
        for (const [bar, st, midi, len] of v.melody) {
          assert.ok(bar >= 0 && bar < t.bars && st >= 0 && st < t.steps, k + '/' + v.id + ' note inside the loop');
          assert.ok(midi >= 36 && midi <= 96 && len > 0, k + '/' + v.id + ' playable note');
        }
      } else {
        assert.equal(v.pattern.length, t.steps, k + '/' + v.id + ' pattern is one bar');
        assert.match(v.pattern, /^[x>.]+$/);
      }
    }
    for (const kind of ['win', 'lose']) assert.ok(t.stings[kind] && t.stings[kind].notes.length, k + ' has a ' + kind + ' sting');
  }
});

test('music: both layers sound, the downbeat is solid, and the loop wraps exactly', () => {
  const t = themeFor('ground'), per = t.steps * t.bars;
  const layersHeard = new Set();
  for (let n = 0; n < per; n++) for (const e of stepEvents(t, n)) layersHeard.add(e.layer);
  assert.deepEqual([...layersHeard].sort(), ['build', 'wave']);
  const one = stepEvents(t, 0).map((e) => e.voice);
  assert.ok(one.includes('kick') && one.includes('bass') && one.includes('drone'), 'bar 1 beat 1 lands kick + bass + drone');
  assert.deepEqual(stepEvents(t, per + 5), stepEvents(t, 5), 'step n and n + loop are identical');
  assert.ok(Math.abs(loopSec(t) - 8 * 4 * 60 / 100) < 1e-9, '8 bars of 4/4 at 100 bpm = 19.2 s');
  assert.ok(Math.abs(stepSec(t) - 0.15) < 1e-9);
});

test('music: chord voices follow the progression (Dm → Bb → Gm → A)', () => {
  const t = themeFor('ground');
  const drone = (bar) => stepEvents(t, bar * t.steps).find((e) => e.voice === 'drone').midi;
  assert.deepEqual(drone(0), [50, 53, 57]);      // D F A
  assert.deepEqual(drone(2), [58, 62, 65]);      // Bb D F
  assert.deepEqual(drone(4), [55, 58, 62]);      // G Bb D
  assert.deepEqual(drone(6), [57, 61, 64]);      // A C# E
  assert.ok(Math.abs(midiHz(69) - 440) < 1e-9);
});

test('music: intensity → layer gains (menu softer, battle layer only in a wave)', () => {
  const t = themeFor('ground');
  assert.equal(layerMix(t, 'build').wave, 0);
  assert.ok(layerMix(t, 'wave').wave > 0 && layerMix(t, 'wave').build > 0);
  assert.ok(layerMix(t, 'menu').build < layerMix(t, 'build').build && layerMix(t, 'menu').wave === 0);
});
