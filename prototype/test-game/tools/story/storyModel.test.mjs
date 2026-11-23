// Story Map model on the real content [MM-story_mwtlwj5f_h].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStory, planetOrder, criteriaOf, dialogOf, timeLabel, THEMES, MAPS_PER_PLANET } from './storyModel.js';
import { PLANETS } from '../../src/data/planets.js';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url), 'utf8'));
const KEYS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];
const src = {
  missions: J('content/missions/missions.json'), threads: J('content/characters/threads.json'),
  characters: Object.fromEntries(KEYS.map((k) => [k, J(`content/characters/${k}.json`)])),
  voicepacks: J('content/dialog/voicepacks.json'), reveals: J('content/reveals/reveals.json'),
  mapdata: J('content/maps/mapdata.json'), planets: PLANETS,
};
const S = buildStory(src);

test('planets follow the portal chain, Verdance first', () => {
  const o = planetOrder(src.missions.missions);
  assert.equal(o[0], 'Verdance');
  assert.equal(o.length, 9);
  assert.deepEqual(o.slice(0, 3), ['Verdance', 'Florael', 'Ochre']);
});

test('every mission is on the map exactly once', () => {
  const ids = S.nodes.filter((n) => n.mission).map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, src.missions.missions.length);
});

test('the campaign runs in sequence: map m of planet p sits in its own slot', () => {
  const camp = S.nodes.filter((n) => n.kind === 'campaign');
  assert.equal(camp.length, 81);
  for (const n of camp) {
    const p = S.order.indexOf(n.planet);
    assert.equal(n.from, p * MAPS_PER_PLANET + n.map - 1, n.id);
  }
});

test('a contract opens only after its map is won, and light/shadow fork apart', () => {
  for (const n of S.nodes.filter((x) => x.kind === 'secondary')) {
    const c = S.nodes.find((x) => x.kind === 'campaign' && x.planet === n.planet && x.map === n.map);
    assert.ok(n.from >= c.due, n.id);
    assert.equal(n.lane, n.variant === 'shadow' ? 'shadow' : 'light');
  }
});

test('outposts open with the capital ship; farming after the planet is finished', () => {
  const oc = S.nodes.find((n) => n.id === 'OC-VER-1'), ship = S.nodes.find((n) => n.id === 'M-ship-Verdance');
  assert.equal(oc.from, ship.from);
  assert.equal(S.nodes.find((n) => n.id === 'FC-VER-1').from, 9);
  assert.ok(S.nodes.some((n) => n.title === 'Outposts open') && S.nodes.some((n) => n.title === 'Farming opens'));
});

test('themes: every theme lights something; Otto and Rei meet as love', () => {
  for (const th of THEMES) assert.ok(S.nodes.some((n) => n.themes.includes(th.id)), th.id);
  const w3 = S.nodes.find((n) => n.id === 'W3-ground-3');
  assert.ok(w3.themes.includes('love'), 'Verdance map 3: Otto and Skylark');
});

test('availability: density rises past the campaign alone once contracts open', () => {
  assert.equal(S.density(0.5).campaign, 1);
  assert.ok(S.density(20.5).total > 3);
});

test('criteria and dialog read from the mission and the voice packs', () => {
  const n = S.nodes.find((x) => x.id === 'P-VER-01');
  const cr = criteriaOf(n.mission);
  assert.ok(cr.find((g) => g.stage === 'complete').items.length >= 1);
  const d = dialogOf(n, src);
  assert.ok(d.some((l) => l.who === 'Briefing'));
  assert.ok(d.length > 2);
  assert.equal(timeLabel(S.order, 2.3), 'Verdance · map 3 · wave 3');
});

test('every branch lists nodes in time order', () => {
  const byId = new Map(S.nodes.map((n) => [n.id, n]));
  for (const b of S.branches) {
    const xs = b.nodes.map((id) => byId.get(id).x);
    assert.deepEqual(xs, [...xs].sort((a, c) => a - c), b.id);
  }
});

test('a secret is spoken by its keeper, not by the one it is about', () => {
  const otto = S.nodes.flatMap((x) => x.secrets || []).find((s) => s.key === 'love' && s.who === 'Captain Otto von Halbrecht');
  assert.ok(otto && /Skylark/.test(otto.line), 'Otto speaks of Skylark');
  assert.equal(otto.about, 'Rei "Skylark" Tanaka');
});
