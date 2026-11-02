// [MM-story_mvyqor1y_h] One sprite file holds every icon the header, list and dossier use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATUS, TYPE_ICON, REWARD_ICON } from './missionView.js';

const SPRITE = readFileSync(new URL('../../content/missions/mission-icons.svg', import.meta.url), 'utf8');
const IDS = new Set([...SPRITE.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

test('every mission type, reward kind and status has its icon in the sprite', () => {
  for (const m of CATALOG.missions) assert.ok(IDS.has(TYPE_ICON[m.type]), m.type);
  for (const k of Object.keys(CATALOG.rewardKinds)) assert.ok(IDS.has(REWARD_ICON[k]), k);
  for (const [st, v] of Object.entries(STATUS)) assert.ok(IDS.has(v.g), st);
  for (const id of ['i-log', 'i-inv', 'r-penalty', 'r-sealed', 't-favour', 't-defend', 't-haul', 't-bounty', 't-survey']) assert.ok(IDS.has(id), id);
});

test('every icon the code refers to is in the sprite', () => {
  const used = new Set();
  for (const f of ['./missionView.js', './missionLog.js', './progressWidget.js']) {
    const text = src(f);
    for (const m of text.matchAll(/use\('([a-z]-[a-z]+)'/g)) used.add(m[1]);
    for (const m of text.matchAll(/href="#([a-z]-[a-z]+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/\bg: '(s-[a-z]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size > 10, 'the scan found the icons');
  for (const id of used) assert.ok(IDS.has(id), id);
});

test('each icon scales: a viewBox on the 24 / 20 / 16 / 12 grids, and it takes the colour it is given', () => {
  for (const m of SPRITE.matchAll(/<symbol id="([^"]+)" viewBox="0 0 (\d+) (\d+)"/g)) {
    assert.equal(m[2], m[3], m[1] + ' is square');
    assert.ok(['24', '20', '16', '12'].includes(m[2]), m[1]);
  }
  assert.equal([...SPRITE.matchAll(/<symbol /g)].length, IDS.size, 'every symbol has a viewBox and a unique id');
  assert.ok(/currentColor/.test(SPRITE));
  assert.ok(!/#[0-9a-f]{6}/i.test(SPRITE.replace(/#0c0e12/g, '')), 'no fixed colours but the ink cut through the status glyphs');
});

test('the sprite is the design page\'s, and the menu loads it once', () => {
  const page = readFileSync(new URL('../../../../docs/16 Bulwark MM/design/mission-log/mission-log.src.html', import.meta.url), 'utf8');
  for (const id of IDS) assert.ok(page.includes('id="' + id + '"'), id);
  assert.ok(/ensureMissionIcons\(doc\)/.test(src('./menu.js')));
});
