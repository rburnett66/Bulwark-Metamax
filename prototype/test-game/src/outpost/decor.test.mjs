// Owner 2026-11-13 [MM-story_mwfacx0h_c]: 2 decor pieces at random round the base for each structure or plot added;
// small ones never big enough to block a lane, large ones on the red ground at the base's edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost, createOutpost } from './model.js';
import { accrueDecor, decorGround, decorKeys, conduitCells, DECOR, DECOR_SMALL, DECOR_LARGE } from './decor.js';
import { occupied } from '../farm/model.js';

const ref = () => referenceOutpost('ground', { seed: 7, map, now: T0 });
const at = (d) => Math.floor(d.y) * decorGround(map).cols + Math.floor(d.x);

test('the kinds match the decor manifest classes', () => {
  const m = JSON.parse(readFileSync(new URL('../../content/outposts/decor/decor.json', import.meta.url), 'utf8'));
  const of = (c) => Object.keys(m).filter((k) => m[k].class === c).sort();
  assert.deepEqual([...DECOR_SMALL].sort(), of('small'));
  assert.deepEqual([...DECOR_LARGE].sort(), of('large'));
});

test('an old save gets 2 pieces per structure once; a second call changes nothing', () => {
  const o = ref();
  assert.equal(o.decor, undefined);
  assert.equal(accrueDecor(o, map), true);
  assert.equal(o.decor.length, DECOR.perStructure * decorKeys(o).length);
  const snap = JSON.stringify(o.decor);
  assert.equal(accrueDecor(o, map), false);
  assert.equal(JSON.stringify(o.decor), snap);
});

test('seeded: the same outpost always gets the same decor', () => {
  const a = ref(), b = ref();
  accrueDecor(a, map); accrueDecor(b, map);
  assert.deepEqual(a.decor, b.decor);
});

test('every piece is on free ground: small on buildable cells, large on the red edge; never on a structure', () => {
  const o = ref();
  accrueDecor(o, map);
  const g = decorGround(map), taken = new Set();
  for (const r of occupied(o, map)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) taken.add(x + ',' + y);
  const cells = new Set();
  for (const d of o.decor) {
    const k = Math.floor(d.x) + ',' + Math.floor(d.y);
    assert.ok(!taken.has(k), `${d.kind} on a structure at ${k}`);
    assert.ok(!cells.has(k), 'one piece per cell'); cells.add(k);
    if (DECOR_LARGE.includes(d.kind)) assert.equal(g.edge[at(d)], 1, `${d.kind} off the edge at ${k}`);
    else assert.equal(g.green[at(d)], 1, `${d.kind} off buildable ground at ${k}`);
  }
  assert.ok(o.decor.some((d) => DECOR_LARGE.includes(d.kind)), 'some large pieces on the rim');
});

test('a new structure adds 2; building over a piece clears it', () => {
  const o = ref();
  accrueDecor(o, map);
  const n = o.decor.length, victim = o.decor.find((d) => DECOR_SMALL.includes(d.kind));
  o.defenses.push({ id: 'd99', kind: 'wall', tier: 1, cell: [Math.floor(victim.x), Math.floor(victim.y)], hp: 100 });
  assert.equal(accrueDecor(o, map), true);
  assert.equal(o.decor.length, n + 2 - 1);
  assert.ok(!o.decor.some((d) => d.id === victim.id));
  assert.equal(o.decor.filter((d) => d.for === 'def:d99').length, 2);
});

test('capped at 80 pieces', () => {
  const o = ref();
  for (let i = 0; i < 60; i++) o.defenses.push({ id: 'x' + i, kind: 'wall', tier: 1, cell: [0, 0], hp: 1 });
  accrueDecor(o, map);
  assert.equal(o.decor.length, DECOR.cap);
});

test('a bare outpost (only the hub) has no decor', () => {
  const o = createOutpost('ground', { seed: 1, map, now: T0 });
  accrueDecor(o, map);
  assert.deepEqual(o.decor, []);
});

test('conduit cells follow the route', () => {
  const s = conduitCells([{ points: [[1.5, 1.5], [4.5, 1.5]] }]);
  for (const x of [1, 2, 3, 4]) assert.ok(s.has(`${x},1`));
});

test('the visit draws flat decor on Low / safe mode, accrues live placements, and the save session accrues on advance', () => {
  const view = readFileSync(new URL('./view/sessionView.js', import.meta.url), 'utf8');
  assert.match(view, /const decorLod = safe \|\| r\.tier\.key === 'low' \? 'flat' : 'tex'/);
  assert.match(view, /if \(accrueDecor\(view, map\)\) \{ live\.link\.outpost\.decor = view\.decor/);
  const ses = readFileSync(new URL('./view/session.js', import.meta.url), 'utf8');
  assert.match(ses, /accrueDecor\(r\.outpost, map\)/);
});
