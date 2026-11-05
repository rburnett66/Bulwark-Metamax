// [MM-story_mw2xo93o_2] The resource card: the planet's name + description for the resource, its tier, the field's
// live state, the contract line; clicking a resource opens it (and still orders a harvester); Esc / elsewhere closes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceInfoModel, resourceInfoRows, resourceInfoHtml, planetFor } from './resourceInfo.js';
import { PLANETS } from '../data/planets.js';

const node = (id, color, extra = {}) => ({ id, fieldId: 'fld-1', color, role: 'primary', wave: 1, x: 3, y: 4, units: 40, remaining: 25, valuePerUnit: 4, respawns: true, respawnAt: null, ...extra });
const state = (nodes, extra = {}) => ({ resourceNodes: nodes, units: new Map(), waves: { current: 1 }, time: 10, ...extra });

test('names the resource after the battle planet, with its description and tier', () => {
  const m = resourceInfoModel(state([node('a', 'blue')]), 'a', 'Verdance');
  assert.equal(m.name, PLANETS.ground.resources.common.name);
  assert.equal(m.note, PLANETS.ground.resources.common.note);
  assert.equal(m.tierLabel, 'Common');
  assert.equal(m.planet, 'Verdance');
  assert.ok(m.iconId);
  const y = resourceInfoModel(state([node('b', 'yellow')]), 'b', 'ground');
  assert.equal(y.name, PLANETS.ground.resources.uncommon.name, 'planet key works too');
  const g = resourceInfoModel(state([node('c', 'green')]), 'c', 'Lumen');
  assert.equal(g.name, planetFor('Lumen').resources.epic.name);
});

test('every planet × tier has a name and a description', () => {
  for (const P of Object.values(PLANETS)) for (const t of ['common', 'uncommon', 'rare', 'epic']) {
    assert.ok(P.resources[t] && P.resources[t].name && P.resources[t].note, `${P.name} ${t}`);
  }
});

test('field totals, harvesters on it, regrow timer and contract line follow the sim', () => {
  const s = state([node('a', 'blue'), node('b', 'blue', { remaining: 0, respawnAt: 25 }), node('z', 'blue', { fieldId: 'fld-2' })]);
  s.units.set(1, { isHarvester: true, hp: 10, fieldId: 'fld-1' });
  s.units.set(2, { isHarvester: true, hp: 10, fieldId: 'fld-2' });
  s.contract = { quota: { common: 100, uncommon: 0, rare: 0, epic: 0 }, sold: { common: 60, uncommon: 0, rare: 0, epic: 0 }, kept: { common: 0, uncommon: 0, rare: 0, epic: 0 } };
  const m = resourceInfoModel(s, 'a', 'Verdance');
  assert.equal(m.cells, 2);
  assert.equal(m.left, 25);
  assert.equal(m.total, 80);
  assert.equal(m.harvesters, 1);
  assert.equal(m.regrowIn, 15);
  const rows = Object.fromEntries(resourceInfoRows(m));
  assert.match(rows.Field, /25 of 80 left · 2 crystals/);
  assert.match(rows.Contract, /Collective buys 40 more/);
  assert.match(rows.Regrows, /in 15 s/);
  s.contract.sold.common = 100;
  assert.match(Object.fromEntries(resourceInfoRows(resourceInfoModel(s, 'a', 'Verdance'))).Contract, /Quota met/);
  delete s.contract;
  assert.match(Object.fromEntries(resourceInfoRows(resourceInfoModel(s, 'a', 'Verdance'))).Value, /4 gold a unit/);
});

test('a field of a later wave says when it opens; a gone node closes the card; text is escaped', () => {
  const m = resourceInfoModel(state([node('a', 'red', { wave: 4 })]), 'a', 'Verdance');
  assert.equal(m.revealed, false);
  assert.match(Object.fromEntries(resourceInfoRows(m)).Status, /Opens in wave 4/);
  assert.equal(resourceInfoModel(state([]), 'a', 'Verdance'), null);
  const unknown = resourceInfoModel(state([node('a', 'blue')]), 'a', '<b>Nowhere</b>');
  assert.equal(unknown.name, 'Common crystal');
  const html = resourceInfoHtml(unknown);
  assert.ok(!html.includes('<b>'), 'no raw markup');
  assert.match(html, /aria-label="Close"/);
});

// ── input.js: a tap on a resource opens its card AND still sends a harvester; Esc / another tap closes it ──
import { createInput, createUiState } from '../input/input.js';
function rig(ok = true) {
  const ls = {}, wls = {};
  const canvas = {
    addEventListener(t, fn) { (ls[t] = ls[t] || []).push(fn); }, removeEventListener() {},
    fire(t, ev) { for (const fn of ls[t] || []) fn({ button: 0, timeStamp: 0, preventDefault() {}, ...ev }); },
  };
  globalThis.window = { addEventListener(t, fn) { (wls[t] = wls[t] || []).push(fn); }, removeEventListener() {} };
  const ui = createUiState(), sent = [];
  const st = { units: new Map(), structures: new Map(), base: { pos: { x: 30, y: 15 }, cells: [] }, resourceNodes: [node('n1', 'blue', { x: 5, y: 3 })] };
  const pick = (ev) => ({ x: Math.floor(ev.clientX / 10), y: Math.floor(ev.clientY / 10) });
  createInput(canvas, null, () => st, (cmd) => { sent.push(cmd); return ok ? { ok: true } : { ok: false, reason: 'not revealed yet' }; }, ui, { pick, tapToAct: true });
  const tap = (x, y) => { canvas.fire('pointerdown', { pointerId: 1, clientX: x, clientY: y }); canvas.fire('pointerup', { pointerId: 1, clientX: x, clientY: y, timeStamp: 100 }); };
  const key = (k) => { for (const fn of wls.keydown || []) fn({ key: k, target: null, preventDefault() {} }); };
  return { ui, sent, tap, key };
}

test('tapping a resource opens its card and still orders a harvester', () => {
  const { ui, sent, tap } = rig();
  tap(52, 33);
  assert.equal(ui.selectedResourceId, 'n1');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'harvest');
  tap(152, 133);   // empty ground
  assert.equal(ui.selectedResourceId, null, 'a tap elsewhere closes it');
});

test('a refused harvest order still opens the card (and says why); Esc closes it', () => {
  const { ui, tap, key } = rig(false);
  tap(52, 33);
  assert.equal(ui.selectedResourceId, 'n1');
  assert.match(ui.pendingHint.text, /not revealed yet/);
  key('Escape');
  assert.equal(ui.selectedResourceId, null);
});
