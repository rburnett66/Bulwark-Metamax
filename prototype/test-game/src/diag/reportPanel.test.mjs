// [MM-story_mwb10lqu_1x] owner 2026-11-10: the error UX is hidden from players; ?debug=1 shows it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { debugOn, mountReportChip } from './reportPanel.js';

const docAt = (search) => ({ defaultView: { location: { search } } });

test('?debug=1 turns the error UX on; anything else leaves it off', () => {
  assert.equal(debugOn(docAt('')), false);
  assert.equal(debugOn(docAt('?seed=4')), false);
  assert.equal(debugOn(docAt('?debug=0')), false);
  assert.equal(debugOn(docAt('?debug=10')), false);
  assert.equal(debugOn(docAt('?debug=1')), true);
  assert.equal(debugOn(docAt('?seed=4&debug=1')), true);
  assert.equal(debugOn(null), false);
});

test('the report chip is not mounted for a player (no ?debug=1)', () => {
  assert.equal(mountReportChip(docAt('')), null);
});

// SETTINGS → ERROR REPORTS [MM-story_mwdppjdb_8] (owner 2026-11-12: "The feature to turn on error logging should be in settings")
import { errorReportsOn, setErrorReports, errorReportsRow, ERROR_REPORTS_KEY } from './reportPanel.js';
import { installErrorLog, logError, clearErrorLog, problemCount, _resetForTest } from './errorLog.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
function fakeDoc(search = '') {
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], style: {}, attrs: {}, listeners: {}, className: '', textContent: '',
      appendChild(c) { this.children.push(c); return c; }, append(...cs) { cs.forEach((c) => this.children.push(c)); },
      addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, setAttribute(k, v) { this.attrs[k] = String(v); },
      click() { for (const f of this.listeners.click || []) f({ stopPropagation() {} }); },
      querySelector(sel) { const want = sel.toUpperCase(); const walk = (x) => { for (const c of x.children) { if (c.tagName === want) return c; const r = walk(c); if (r) return r; } return null; }; return walk(this); } };
    return n;
  };
  const store = memStore();
  return { createElement: node, defaultView: { location: { search }, localStorage: store, navigator: {}, screen: {} }, store };
}
const find = (n, pred) => { if (pred(n)) return n; for (const c of n.children || []) { const r = find(c, pred); if (r) return r; } return null; };
const textOf = (n) => (n.textContent || '') + (n.children || []).map(textOf).join('');

test('ERROR REPORTS in SETTINGS turns the error UX on like ?debug=1, saved on this device', () => {
  const doc = fakeDoc('');
  assert.equal(errorReportsOn(doc), false);
  assert.equal(debugOn(doc), false);
  setErrorReports(doc, true);
  assert.equal(doc.store.getItem(ERROR_REPORTS_KEY), '1');
  assert.equal(debugOn(doc), true, 'the switch alone shows the error UX');
  setErrorReports(doc, false);
  assert.equal(debugOn(doc), false);
  assert.equal(debugOn(fakeDoc('?debug=1')), true, 'the address still works');
});

test('the SETTINGS row: ON/OFF switch, the logged count, and COPY / CLEAR only while on', () => {
  _resetForTest();
  installErrorLog({ addEventListener() {}, console: {} }, { storage: memStore() });
  clearErrorLog();
  logError(new Error('boom'), 'outpost');
  assert.equal(problemCount(), 1);
  const doc = fakeDoc('');
  const row = errorReportsRow(doc);
  const tog = find(row, (n) => n.tagName === 'BUTTON' && n.title);
  const tools = find(row, (n) => n.className === 'bwm-errtools');
  assert.match(textOf(row), /ERROR REPORTS/);
  assert.match(textOf(row), /1 error logged/);
  assert.equal(textOf(tog), 'OFF');
  assert.equal(tools.style.display, 'none');
  tog.click();
  assert.equal(textOf(tog), 'ON');
  assert.equal(tools.style.display, 'flex');
  assert.equal(errorReportsOn(doc), true);
  const clear = find(tools, (n) => n.tagName === 'BUTTON' && /CLEAR LOG/.test(textOf(n)));
  clear.click();
  assert.match(textOf(row), /no errors logged/);
  _resetForTest();
});
