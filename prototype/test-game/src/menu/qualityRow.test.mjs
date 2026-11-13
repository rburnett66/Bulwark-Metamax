// Owner 2026-11-12 [MM-story_mweksov8_1]: "I dont see quality controls in settings".
import test from 'node:test';
import assert from 'node:assert/strict';
import { qualityRow } from './qualityRow.js';
import { QUALITY_LS_KEY } from '../render3d/quality.js';

function fakeDoc() {
  const mk = (tag) => {
    const n = { tag, children: [], style: {}, attrs: {}, listeners: {}, value: '', textContent: '',
      appendChild(c) { this.children.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(t, f) { this.listeners[t] = f; } };
    if (tag === 'select') Object.defineProperty(n, 'value', { get() { return this._v; }, set(v) { this._v = this.children.some((o) => o.value === v) ? v : ''; } });
    return n;
  };
  return { createElement: mk };
}
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('the menu row offers Auto (naming what it picked) and the three tiers', () => {
  const row = qualityRow(fakeDoc(), { storage: store(), autoKey: 'standard' });
  assert.deepEqual(row.select.children.map((o) => o.textContent), ['Auto (Standard)', 'High', 'Standard', 'Low']);
  assert.equal(row.select.value, 'auto');
});

test('it writes the same per-device key the in-game gear reads, and re-reads it on sync', () => {
  const s = store();
  const row = qualityRow(fakeDoc(), { storage: s, autoKey: 'high' });
  row.select.value = 'low'; row.select.listeners.change();
  assert.equal(s.m.get(QUALITY_LS_KEY), 'low');
  s.setItem(QUALITY_LS_KEY, 'standard');   // changed from the in-game gear
  row.sync();
  assert.equal(row.select.value, 'standard');
});
