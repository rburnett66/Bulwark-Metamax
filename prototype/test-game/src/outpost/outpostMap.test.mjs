// The Verdance outpost map drives the outpost model and the battle loader [MM-story_mw5oeatc_l]
// (tech plan docs/tech-plan/Outpost.md §6.6; design Outpost-Design §4.5, §9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { outpostMapFor, outpostMapFromForge, outpostMapUrl } from './outpostMap.js';
import { createOutpost, confirmOnline, onlineProblems, powerGrids, place, advance } from './model.js';
import { buildTerrainMap } from '../sim/mapgen.js';
import { buildNavGrid } from '../sim/pathfinding.js';

const FORGE = JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
const map = outpostMapFromForge(FORGE);
const T0 = Date.UTC(2026, 10, 7, 12);

test('the contract kit goes online on the Verdance map, drawing 9 of the first station\'s 10', () => {
  const o = createOutpost('ground', { seed: 1, map, now: T0 });
  assert.deepEqual(Object.keys(o.pads).sort(), ['hub', 'p1', 'r1', 's1']);
  assert.deepEqual(onlineProblems(o, map), []);
  const g = powerGrids(o, map);
  assert.equal(g.grids.length, 1);
  assert.equal(g.grids[0].draw, 9);
  assert.equal(g.grids[0].supply, 10);
  assert.ok(confirmOnline(o, map, T0).outpost.online);
});

test('the remote rare rig needs its own station (design §4.5)', () => {
  let o = confirmOnline(createOutpost('ground', { seed: 1, map, now: T0 }), map, T0).outpost;
  o.firstRaidAt = null;
  const ctx = { map, now: T0, unlockedTiers: ['common', 'uncommon', 'rare'] };
  o = place(o, { pad: 'r3', kind: 'rig' }, ctx).outpost;
  o = advance(o, T0 + 3_600_000, { map }).outpost;
  assert.equal(powerGrids(o, map).off.r3, 'reach');
  o = place(o, { pad: 'p2', kind: 'power' }, { ...ctx, now: o.t }).outpost;
  o = advance(o, o.t + 3_600_000, { map }).outpost;
  const g = powerGrids(o, map);
  assert.ok(g.powered.has('r3'));
  assert.equal(g.grids.length, 2, 'a separate small grid');
});

test('the battle loader builds it, with the base on the hub and both raid lanes walking to it', () => {
  const m = buildTerrainMap(FORGE, 1, { seed: 0 });
  const hub = map.pads.find((p) => p.role === 'hub');
  assert.ok(m.base.x >= hub.x && m.base.x < hub.x + hub.w && m.base.y >= hub.y && m.base.y < hub.y + hub.h);
  const nav = buildNavGrid(m, []);
  const { cols, rows } = m, d = new Int32Array(cols * rows).fill(-1), q = [];
  for (const c of m.base.cells) { d[c.y * cols + c.x] = 0; q.push(c.y * cols + c.x); }
  for (let h = 0; h < q.length; h++) {
    const x = q[h] % cols, y = (q[h] / cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || d[j] >= 0 || !nav.passable[j]) continue;
      d[j] = d[q[h]] + 1; q.push(j);
    }
  }
  for (const s of map.spawns) assert.ok(d[s.y * cols + s.x] > 0, `lane from (${s.x}, ${s.y}) reaches the hub`);
});

test('outpostMapFor fetches <planet>-outpost.json and falls back to the draft layout', async () => {
  assert.match(outpostMapUrl('ground'), /content\/maps\/forge\/ground-outpost\.json$/);
  const ok = await outpostMapFor('ground', { fetch: async () => ({ ok: true, json: async () => FORGE }) });
  assert.equal(ok.source, 'forge'); assert.equal(ok.width, 40); assert.equal(ok.height, 24);
  assert.equal(ok.heights.length, 960);
  const none = await outpostMapFor('air', { fetch: async () => ({ ok: false, status: 404 }) });
  assert.equal(none.source, 'draft'); assert.equal(none.id, 'draft-outpost');
  const broken = await outpostMapFor('air', { fetch: async () => { throw new Error('offline'); } });
  assert.equal(broken.source, 'draft');
});
