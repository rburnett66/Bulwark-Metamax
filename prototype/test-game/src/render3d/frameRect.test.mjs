// A mode's opening framing (spec Outpost-AAA-UX §9, D7) [MM-story_mwcuyrqr_3j]: render3d autoFrame frames the rect a mode
// passes (opts.frameRect); a battle passes none and frames its play area as before. The outpost frames its base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playRect } from './index.js';
import { createFogTracker } from './overlays/fogModel.js';
import { baseFrameRect } from '../outpost/view/outpostBoard.js';
import { map as omap, T0 } from '../outpost/view/fixtures.mjs';
import { referenceOutpost } from '../outpost/model.js';
import { toLiveSim } from '../outpost/liveSim.js';
import { outpostBattleMap } from '../outpost/view/outpostBoard.js';

const map = { cols: 48, rows: 32, openPlay: true, base: { x: 30, y: 12 }, waveWindows: [{ wave: 1, x0: 11, y0: 3, x1: 34, y1: 18 }] };

test('a battle (no frameRect): the play area as before — the fog window, else the whole map', () => {
  const fog = createFogTracker();
  const state = { waves: { current: 1, active: false }, map };
  fog.update(state, map, 0);
  const r = { fog, map };
  assert.deepEqual(playRect(r, state), { x0: 11, z0: 3, x1: 35, z1: 19 });
  assert.deepEqual(playRect({ fog: null, map: { cols: 20, rows: 10 } }, { waves: {} }), { x0: 0, z0: 0, x1: 20, z1: 10 });
});

test('a mode\'s frameRect wins: inclusive cells to world edges; a null answer or a throw falls back', () => {
  const r = { fog: null, map: { cols: 64, rows: 32 }, frameRect: () => ({ x0: 10, y0: 4, x1: 33, y1: 15 }) };
  assert.deepEqual(playRect(r, {}), { x0: 10, z0: 4, x1: 34, z1: 16 });
  assert.deepEqual(playRect({ ...r, frameRect: () => null }, {}), { x0: 0, z0: 0, x1: 64, z1: 32 });
  assert.deepEqual(playRect({ ...r, frameRect: () => { throw new Error('x'); } }, {}), { x0: 0, z0: 0, x1: 64, z1: 32 });
});

test('the outpost frames its base: every structure + 6 cells, at least 24 × 12, inside the board', () => {
  const o = referenceOutpost('ground', { seed: 7, map: omap, now: T0 });
  const { state } = toLiveSim(o, { map: omap, now: T0, gold: 0 });
  const board = outpostBattleMap(omap);
  const f = baseFrameRect(state, board);
  assert.ok(f, 'a rect');
  assert.ok(f.x0 >= 0 && f.y0 >= 0 && f.x1 <= board.cols - 1 && f.y1 <= board.rows - 1, 'inside the board');
  assert.ok(f.x1 - f.x0 + 1 >= 24 && f.y1 - f.y0 + 1 >= 12, 'never smaller than 24 × 12');
  for (const s of state.structures.values()) {
    const w = (s.footprint && s.footprint.w) || 1, h = (s.footprint && s.footprint.h) || 1;
    assert.ok(s.pos.x >= f.x0 && s.pos.x + w - 1 <= f.x1 && s.pos.y >= f.y0 && s.pos.y + h - 1 <= f.y1, `${s.structId} is in frame`);
  }
  assert.ok((f.x1 - f.x0 + 1) * (f.y1 - f.y0 + 1) < board.cols * board.rows, 'closer than the whole board');
  // a tiny base still gets the minimum, clamped at the board's corner
  const tiny = baseFrameRect({ base: { pos: { x: 0, y: 0 } }, structures: new Map() }, { cols: 64, rows: 32 });
  assert.deepEqual(tiny, { x0: 0, y0: 0, x1: 23, y1: 12 });
  assert.equal(baseFrameRect({ structures: new Map() }, { cols: 64, rows: 32 }), null);
});
