// Owner 2026-11-13 [MM-story_mwfacx0h_c]: 2 decor pieces at random round the base for each structure or plot added;
// small ones never big enough to block a lane, large ones on the red ground at the base's edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost, createOutpost } from './model.js';
import { accrueDecor, decorGround, decorKeys, conduitCells, DECOR, DECOR_SMALL, DECOR_LARGE, CARGO_H } from './decor.js';
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
    if (!d.z) { assert.ok(!cells.has(k), 'one piece per cell (a stacked cube shares its lower one)'); cells.add(k); }
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

// Owner 2026-11-15 [MM-task_mwitpds3_22]: "the small items like racks signs and antenna should be near the structures. The
// cargo boxes would look good on the perimeter maybe even stacked."
const bigBase = () => {
  const o = ref();
  for (let i = 0; i < 24; i++) o.defenses.push({ id: 'w' + i, kind: 'wall', tier: 1, cell: [o.defenses[0].cell[0] + 3 * (i % 6) - 6, o.defenses[0].cell[1] + 3 * Math.floor(i / 6) - 9], hp: 1 });
  const g = decorGround(map), taken = new Set();
  for (const r of occupied(ref(), map)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) taken.add(x + ',' + y);
  // walls only where a player could build one: free buildable ground
  o.defenses = o.defenses.filter((d, i, a) => !/^w/.test(d.id) || (g.green[d.cell[1] * g.cols + d.cell[0]] && !taken.has(d.cell + '') && a.findIndex((e) => e.cell + '' === d.cell + '') === i));
  accrueDecor(o, map);
  return o;
};

test('small pieces stand beside the structure they came with, turned towards it', async () => {
  const { buildingRect } = await import('./model.js');
  const o = bigBase();
  const rectOf = (key) => {
    const [k, id] = key.split(':');
    if (k === 'pad') return buildingRect(o, map, id);
    const d = o.defenses.find((x) => x.id === id);
    return { x: d.cell[0], y: d.cell[1], w: 1, h: 1 };
  };
  const small = o.decor.filter((d) => DECOR_SMALL.includes(d.kind));
  assert.ok(small.length > 10);
  let near = 0;
  for (const d of small) {
    const r = rectOf(d.for), cx = Math.floor(d.x), cy = Math.floor(d.y);
    const gap = Math.max(r.x - cx, cx - (r.x + r.w - 1), r.y - cy, cy - (r.y + r.h - 1));
    if (gap >= 1 && gap <= 2) near++;
  }
  assert.ok(near / small.length >= 0.9, `${near} of ${small.length} small pieces within 2 cells of their structure`);
});

test('cargo lines the rim, and a stacked cube sits on a lone cube, one high', () => {
  let stackedAll = 0;
  for (const seed of [1, 2, 3, 7, 11, 19]) {
  const o = referenceOutpost('ground', { seed, map, now: T0 });
  accrueDecor(o, map);
  const g = decorGround(map), large = o.decor.filter((d) => DECOR_LARGE.includes(d.kind));
  for (const d of large) assert.equal(g.edge[at(d)], 1, `${d.kind} on the rim`);
  const stacked = large.filter((d) => d.z);
  stackedAll += stacked.length;
  for (const s of stacked) {
    const under = large.filter((d) => !d.z && d.kind === 'cargo_cube' && d.x === s.x && d.y === s.y);
    assert.equal(under.length, 1, 'on exactly one cube');
    assert.ok(Math.abs(s.z - CARGO_H * under[0].scale) < 1e-3, 'resting on its top');
    assert.equal(stacked.filter((t) => t.x === s.x && t.y === s.y).length, 1, 'two high at most');
  }
  const ground = large.filter((d) => !d.z);
  const beside = ground.filter((d) => ground.some((e) => e !== d && Math.abs(Math.floor(e.x) - Math.floor(d.x)) + Math.abs(Math.floor(e.y) - Math.floor(d.y)) === 1));
  assert.ok(beside.length / ground.length >= 0.5, `seed ${seed}: ${beside.length} of ${ground.length} rim pieces beside another`);
  }
  assert.ok(stackedAll >= 3, 'cargo is stacked on some bases: ' + stackedAll);
  const m = JSON.parse(readFileSync(new URL('../../content/outposts/decor/decor.json', import.meta.url), 'utf8'));
  assert.equal(CARGO_H, m.cargo_cube.height);
});

test('a save laid out by the old rules is laid out again once, the same way every time', () => {
  const o = ref();
  accrueDecor(o, map);
  const fresh = JSON.stringify(o.decor);
  const old = ref();
  old.decor = [{ id: 'z1', kind: 'antenna', x: 1.5, y: 1.5, rot: 0, scale: 1, for: 'pad:x' }]; old.decorFor = decorKeys(old);
  assert.equal(accrueDecor(old, map), true);
  assert.equal(old.decorV, DECOR.version);
  assert.equal(JSON.stringify(old.decor), fresh);
  assert.equal(accrueDecor(old, map), false);
});

test('the decor layer lifts a stacked cube by its z', () => {
  const src = readFileSync(new URL('../render3d/outposts/decorModels.js', import.meta.url), 'utf8');
  assert.match(src, /pos\.set\(d\.x, y \+ \(d\.z \|\| 0\), d\.y\)/);
});
