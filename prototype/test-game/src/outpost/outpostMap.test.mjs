// The Verdance outpost map drives the outpost model and the battle loader [MM-story_mw5oeatc_l]
// (tech plan docs/tech-plan/Outpost.md §6.6; design Outpost-Design §4.5, §9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { outpostMapFor, outpostMapFromForge, outpostMapUrl } from './outpostMap.js';
import { referenceOutpost, confirmOnline, onlineProblems, powerGrids, place, advance } from './model.js';
import { buildTerrainMap } from '../sim/mapgen.js';
import { buildNavGrid } from '../sim/pathfinding.js';

const FORGE = JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
const map = outpostMapFromForge(FORGE);
const T0 = Date.UTC(2026, 10, 7, 12);

test('the contract kit goes online on the Verdance map, drawing 9 of the first station\'s 10', () => {
  const o = referenceOutpost('ground', { seed: 1, map, now: T0 });
  assert.deepEqual(Object.keys(o.pads).sort(), ['hub', 'p1', 'r1', 's1']);
  assert.deepEqual(onlineProblems(o, map), []);
  const g = powerGrids(o, map);
  assert.equal(g.grids.length, 1);
  assert.equal(g.grids[0].draw, 9);
  assert.equal(g.grids[0].supply, 10);
  assert.ok(confirmOnline(o, map, T0).outpost.online);
});

test('the remote rare rig needs its own station (design §4.5)', () => {
  let o = confirmOnline(referenceOutpost('ground', { seed: 1, map, now: T0 }), map, T0).outpost;
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
  assert.equal(ok.source, 'forge'); assert.equal(ok.width, 64); assert.equal(ok.height, 32);
  assert.equal(ok.heights.length, 64 * 32);
  const none = await outpostMapFor('air', { fetch: async () => ({ ok: false, status: 404 }) });
  assert.equal(none.source, 'draft'); assert.equal(none.id, 'draft-outpost');
  const broken = await outpostMapFor('air', { fetch: async () => { throw new Error('offline'); } });
  assert.equal(broken.source, 'draft');
});

test('the mesa rim opens for building; the raid grid keeps the cliff (owner 2026-11-08)', async () => {
  const { openRim, outpostMapFromForge } = await import('./outpostMap.js');
  const { TERRAIN } = await import('../terrain/terrainGen.js');
  const { buildable, defenseRing } = await import('../terrain/outpostPads.js');
  const fs = await import('node:fs');
  const forge = JSON.parse(fs.readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
  const rimCells = forge.terrain.map((t, i) => (forge.heights[i] === 2 && (t === TERRAIN.CLIFF || t === TERRAIN.CLIFF_BORDER) ? i : -1)).filter((i) => i >= 0);
  assert.ok(rimCells.length > 0, 'the authored map has a cliff rim');
  const m = outpostMapFromForge(forge, 'ground');
  for (const i of rimCells) {
    assert.equal(m.terrain[i], TERRAIN.ROCK_BORDER);
    assert.ok(buildable(m, i % forge.cols, (i / forge.cols) | 0) || m.pads.some((p) => { const x = i % forge.cols, y = (i / forge.cols) | 0; return x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h; }));
  }
  assert.equal(m.forge.terrain[rimCells[0]], TERRAIN.CLIFF === forge.terrain[rimCells[0]] ? TERRAIN.CLIFF : forge.terrain[rimCells[0]], 'the raid grid is untouched');
  const ring = new Set(defenseRing(m).map(([x, y]) => y * forge.cols + x));
  assert.ok(rimCells.some((i) => ring.has(i)), 'the rim is in the defense ring');
  assert.deepEqual(openRim(null, null, null), { terrain: null, blocking: null });
});
