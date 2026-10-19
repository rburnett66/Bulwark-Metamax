// [MM-story_mvempsla_q] wave-end sequence pieces: the play area holds until the reward pick, the camera goes over the
// band that just opened, and the comm card is pre-sized and scaled 2× centre stage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFogTracker, newAreaFocus } from './fogModel.js';
import { presize, centerScale, CENTER_SCALE } from '../../comm/commCard.js';

const map = (cols = 40, rows = 40) => ({ cols, rows, openPlay: true, base: { x: 20, y: 20 },
  waveWindows: [{ wave: 1, x0: 15, y0: 15, x1: 25, y1: 25 }, { wave: 2, x0: 15, y0: 15, x1: 35, y1: 25 }] });

test('the play area holds at the clear and grows (with its reveal flash) only when released', () => {
  const m = map(), fog = createFogTracker();
  const st = { map: m, waves: { current: 1, active: true }, base: { pos: m.base } };
  assert.equal(fog.update(st, m, 0.016).win.rect.x1, 25, 'wave 1 window');
  fog.hold(true);
  st.waves = { current: 1, active: false };            // cleared: the sim's window is already wave 2's
  for (let i = 0; i < 30; i++) assert.equal(fog.update(st, m, 0.016).win.rect.x1, 25, 'held while the reward is open');
  fog.hold(false);
  const f = fog.update(st, m, 0.016);
  assert.equal(f.win.rect.x1, 35, 'released: grows');
  assert.ok(f.flash && f.flash.prev.x1 === 25 && f.flash.cur.x1 === 35, 'with the reveal flash of the new band');
});

test('camera focus: the centroid of the newly opened band, not the whole window', () => {
  const prev = { x0: 15, y0: 15, x1: 25, y1: 25 }, cur = { x0: 15, y0: 15, x1: 35, y1: 25 };
  const f = newAreaFocus(prev, cur);
  assert.ok(Math.abs(f.x - 31) < 1e-9 && Math.abs(f.z - 20.5) < 1e-9, JSON.stringify(f));   // band x 26..35 → centre 31
  assert.deepEqual(newAreaFocus(null, cur), { x: 25.5, z: 20.5 });
  assert.deepEqual(newAreaFocus(cur, cur), { x: 25.5, z: 20.5 }, 'nothing grew: the window centre');
});

test('comm card: the text box is pinned to the full line before typing; centre stage is 2× unless it would not fit', () => {
  const el = { style: {}, textContent: '', get scrollHeight() { return this.textContent.length > 0 ? 40 + Math.ceil(this.textContent.length / 30) * 20 : 0; } };
  const h = presize(el, 'x'.repeat(95));
  assert.equal(h, 120); assert.equal(el.style.minHeight, '120px'); assert.equal(el.textContent, '', 'emptied for typing');
  assert.equal(CENTER_SCALE, 2);
  assert.equal(centerScale({ offsetWidth: 430, offsetHeight: 260 }, 1920, 1080), 2, 'desktop: 2×');
  const k = centerScale({ offsetWidth: 430, offsetHeight: 260 }, 844, 390);
  assert.ok(k < 2 && k * 260 <= 390 * 0.88 + 1e-9, `phone landscape fits (${k.toFixed(2)})`);
  assert.ok(Math.abs(k - (390 * 0.88 / 260) * 0.9) < 1e-9, 'phone: 10% under the fit [MM-task_mveuityu_d]');
  const port = centerScale({ offsetWidth: 430, offsetHeight: 260 }, 390, 844);
  assert.ok(Math.abs(port - (390 * 0.94 / 430) * 0.9) < 1e-9, `phone portrait: 10% under the fit (${port.toFixed(2)})`);
  assert.equal(centerScale({ offsetWidth: 430, offsetHeight: 260 }, 1024, 768), 2, 'tablet: unchanged');
});
