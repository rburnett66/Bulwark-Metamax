// The game's own error log [MM-task_mw9jahjg_1]. Owner 2026-11-09: no console on iOS — COPY ERROR REPORT.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installErrorLog, crumb, errorReport, lastSessionCrashed, hasErrors, clearErrorLog, STORE_KEY, MAX_ENTRIES, _resetForTest } from './errorLog.js';

function fakeWin(store) {
  const listeners = {};
  const logged = [];
  return {
    listeners, logged,
    localStorage: store,
    navigator: { userAgent: 'iPhone test' }, screen: { width: 430, height: 932 }, devicePixelRatio: 3, innerWidth: 430, innerHeight: 932,
    console: { error: (...a) => logged.push(a) },
    addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
    fire(type, ev) { for (const fn of listeners[type] || []) fn(ev); },
  };
}
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }; }

test('catches uncaught errors, rejections, console.error and a lost GL context, with breadcrumbs', () => {
  _resetForTest();
  const store = memStore(), win = fakeWin(store);
  installErrorLog(win);
  crumb('outpost: starting the 3D view');
  win.fire('error', { error: new TypeError('x is undefined'), filename: 'https://h/src/outpost/view/outpostView.js', lineno: 12, colno: 3 });
  win.fire('unhandledrejection', { reason: new Error('model fetch failed') });
  win.console.error('[outpost] close', new Error('boom'));
  win.fire('webglcontextlost', { target: { __bwReleased: true } });   // let go on purpose: not logged
  win.fire('webglcontextlost', {});
  assert.equal(win.logged.length, 1, 'console.error still reaches the real console');
  const r = errorReport(win);
  assert.match(r, /Bulwark error report — v/);
  assert.match(r, /iPhone test/);
  assert.match(r, /CRUMB\s+outpost: starting the 3D view/);
  assert.match(r, /TypeError: x is undefined \(outpostView\.js:12:3\)/);
  assert.match(r, /REJECT\s+Error: model fetch failed/);
  assert.match(r, /CONSOLE\s+\[outpost\] close Error: boom/);
  assert.match(r, /GL\s+WebGL context lost/);
  assert.ok(hasErrors());
  assert.ok(JSON.parse(store.getItem(STORE_KEY)).length >= 6, 'kept in storage');
});

test('a failed image load is not logged as a JS error; repeats count up; the log is capped', () => {
  _resetForTest();
  const win = fakeWin(memStore());
  installErrorLog(win);
  win.fire('error', { target: { tagName: 'IMG' } });
  assert.equal(hasErrors(), false);
  for (let i = 0; i < 5; i++) win.fire('error', { error: new Error('every frame') });
  assert.match(errorReport(win), /Error: every frame \(×5\)/);
  for (let i = 0; i < MAX_ENTRIES + 10; i++) crumb('step ' + i);
  assert.ok(errorReport(win).split('\n').filter((l) => /CRUMB/.test(l)).length <= MAX_ENTRIES);
});

test('a session killed inside the outpost is seen on the next load; a closed outpost is not', () => {
  _resetForTest();
  const store = memStore();
  installErrorLog(fakeWin(store));
  crumb('outpost: placing the buildings'); crumb('outpost: open');
  _resetForTest();                                   // iOS kills the tab: the next page load
  installErrorLog(fakeWin(store));
  assert.equal(lastSessionCrashed(), true);
  assert.match(errorReport(fakeWin(store)), /ended inside the outpost/);
  crumb('outpost: reading the map'); crumb('outpost: open'); crumb('outpost: closed');
  _resetForTest();
  installErrorLog(fakeWin(store));
  assert.equal(lastSessionCrashed(), false);
  clearErrorLog();
  assert.equal(hasErrors(), false);
});

test('works with no storage (private mode throws)', () => {
  _resetForTest();
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const win = fakeWin(bad);
  installErrorLog(win);
  win.fire('error', { error: new Error('still logged') });
  assert.match(errorReport(win), /still logged/);
});
