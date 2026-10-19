// [MM-story_mvekcu8r_n] ground vehicles steer, never slide: the drawn unit moves only along its hull; moderate bends are
// steered while driving, sharp ones (a turn-around) are a pivot on the spot first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadingTracker, DRIVE, angleDelta } from './heading.js';
import { buildUnitViews, createModelResolver } from './units/unitViews.js';

const DT = 1 / 60;
// drive unit 1 along a path of sim positions (cells/s speed v), recording every drawn frame
function run(path, v = 1.5, extra = 1.5) {
  const h = createHeadingTracker(), frames = [];
  let seg = 0, t = 0, p = { ...path[0] };
  h.drive(1, p.x, p.y, DT);
  const total = path.length - 1;
  for (let i = 0; i < 5000; i++) {
    if (seg < total) {   // advance the SIM position along the path at speed v
      let left = v * DT;
      while (left > 0 && seg < total) {
        const b = path[seg + 1], dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (d <= left) { p = { ...b }; seg++; left -= d; } else { p.x += dx / d * left; p.y += dy / d * left; left = 0; }
      }
    } else if ((t += DT) > extra) break;
    const prev = frames.length ? frames[frames.length - 1] : null;
    const d = h.drive(1, p.x, p.y, DT);
    frames.push({ ...d, simX: p.x, simY: p.y, moved: prev ? Math.hypot(d.x - prev.x, d.y - prev.y) : 0, dir: prev ? Math.atan2(d.y - prev.y, d.x - prev.x) : null });
  }
  return frames;
}

test('never slides: every step of the drawn unit is along its hull', () => {
  for (const path of [[{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }], [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 8, y: 3 }]]) {
    for (const f of run(path)) if (f.moved > 1e-6) assert.ok(Math.abs(angleDelta(f.heading, f.dir)) < 1e-6, `sideways step: hull ${f.heading.toFixed(3)} vs move ${f.dir.toFixed(3)}`);
  }
});

test('a turn-around is a pivot on the spot, then a drive back', () => {
  const f = run([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 }]);
  // frames where the hull is far off its way (more than STEER) never move
  let pivots = 0;
  for (let i = 1; i < f.length; i++) {
    const want = Math.atan2(f[i].simY - f[i].y, f[i].simX - f[i].x), off = Math.abs(angleDelta(f[i].heading, want));
    if (off > DRIVE.steer && Math.hypot(f[i].simX - f[i].x, f[i].simY - f[i].y) > DRIVE.dead) { pivots++; assert.ok(f[i].moved < 1e-9, 'no moving while turned far off'); }
  }
  assert.ok(pivots > 5, `it pivoted (${pivots} frames)`);
  const end = f[f.length - 1];
  assert.ok(Math.hypot(end.x, end.y) < 0.25, `and drove home (${end.x.toFixed(2)}, ${end.y.toFixed(2)})`);
});

test('a moderate bend is steered while driving (no stop)', () => {
  const f = run([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 2.5 }]);   // a ~32° bend
  const i0 = f.findIndex((q) => q.simX > 4.2);
  const slice = f.slice(Math.max(1, i0 - 20), i0 + 40);
  assert.ok(slice.every((q) => q.moved > 1e-4), 'kept moving through the bend');
});

test('settles on the sim position and keeps up within a cell', () => {
  const f = run([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }]);
  for (const q of f) assert.ok(Math.hypot(q.simX - q.x, q.simY - q.y) < 1.2, 'lag stays under 1.2 cells');
  const end = f[f.length - 1];
  assert.ok(Math.hypot(end.simX - end.x, end.simY - end.y) < 0.21);
});

test('views: ground units are drawn where they drive, flyers at their sim spot', () => {
  const h = createHeadingTracker(), resolve = createModelResolver(() => null);
  const st = { units: new Map([[1, { id: 1, unitId: 'x', pos: { x: 2, y: 2 }, hp: 5, domain: 'Ground' }], [2, { id: 2, unitId: 'y', pos: { x: 4, y: 4 }, hp: 5, domain: 'Flyer', altitude: 1 }]]) };
  buildUnitViews(st, {}, h, resolve, DT);
  st.units.get(1).pos = { x: 2, y: 4 }; st.units.get(2).pos = { x: 4, y: 6 };   // both jump 2 cells
  const v = buildUnitViews(st, {}, h, resolve, DT);
  const g = v.find((q) => q.id === 1), a = v.find((q) => q.id === 2);
  assert.ok(g.z < 4.5 - 1, 'the ground unit is still on its way (turning first)');
  assert.equal(a.z, 6.5, 'the flyer is at its sim spot');
});
