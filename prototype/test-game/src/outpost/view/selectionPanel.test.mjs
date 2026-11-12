// Selecting an outpost defense or building shows the BATTLE's selection panel [MM-task_mwcuvn8l_3i] (epic One battle UX).
//
// Owner 2026-11-11: "When I select a defensive structure I expect the exact same UX I see on the battle map, same font ..
// same buttons, same layout". The outpost's own panel (session.addPanel) sat in the selection panel's corner, on top of
// it, in its own fonts: the battle panel was hidden behind it. Now the selection takes that corner (the mode's panels step
// aside while a structure is selected), and the outpost's extras (a building's status, SELL RESOURCES, DEEP SEAM) are
// lines and buttons INSIDE the battle panel through one generic hook (render/hud.js selectionExtras) — no second panel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0 } from './fixtures.mjs';
import { referenceOutpost } from '../model.js';
import { toLiveSim } from '../liveSim.js';
import { outpostSelectionExtras } from './sessionView.js';
import { selectionExtrasModel } from '../../render/hud.js';

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const SV = strip(readFileSync(new URL('./sessionView.js', import.meta.url), 'utf8'));
const HUD = strip(readFileSync(new URL('../../render/hud.js', import.meta.url), 'utf8'));

test('the session outpost draws no selection panel of its own: it hands its extras to the battle panel', () => {
  // the battle HUD's selection panel is the only one: the outpost never builds the battle panel's parts …
  for (const re of [/bw-selpanel/, /bw-sname/, /bw-shpbar/, /bw-selrow/, /op-s-sel|op-spanel|op-sel/]) assert.doesNotMatch(SV, re, `sessionView has no ${re}`);
  // … it has ONE card of its own (the outpost's economy controls: a HudCard in the HUD's mode slot), and gives the battle
  // HUD its selection extras
  assert.equal((SV.match(/hud\.addCard\(/g) || []).length, 1, 'one mode card: the outpost controls');
  assert.doesNotMatch(SV, /session\.addPanel\(/, 'no hand-built panel');
  assert.match(SV, /session\.createHud\(\{[\s\S]*selectionExtras: \(s\) => selectionExtras\(s\)/, 'the extras go through the battle HUD');
});

test('the battle panel takes the corner while a structure is selected, and draws a mode\'s extras inside itself', () => {
  // the mode panels step aside for the selection (the outpost panel sat right on top of the selection panel)
  assert.match(HUD, /querySelector\('\.bw-mode-panels'\)[\s\S]{0,80}modePanels\.style\.display = s \? 'none' : ''/);
  // the extras' lines and buttons are children of the selection panel itself (a HudCard, render/hudCard.js), built with
  // the battle's button class
  assert.match(HUD, /selCard\.body\.appendChild\(sextra\);\s*selPanel\.appendChild\(sactions\);/);
  assert.match(HUD, /el\(doc, 'button', 'bw-btn', a\.label\)/);
  assert.match(HUD, /hud\.callbacks && hud\.callbacks\.selectionExtras/);
});

test('a farm plot tap still shows its farm panel: it selects no structure, so the outpost panel keeps the corner', () => {
  // the mode panels hide ONLY for a selected sim structure (above); the farm's ground tap clears that selection …
  const INPUT = strip(readFileSync(new URL('../../input/input.js', import.meta.url), 'utf8'));
  assert.match(INPUT, /handle\.onGroundTap\(cell, ui\)\) \{\s*ui\.selectedStructureId = null;/);
  // … and the farm panel is the outpost card itself (the same HudCard), filled with the plot's panel while one is selected
  assert.match(SV, /onGroundTap: \(cell, tapUi\) => tapFarm\(cell, tapUi\)/);
  assert.match(SV, /card\.render\(fm \? farmCardModel\(fm,/);
});

test('selectionExtrasModel: a battle (no hook) draws nothing extra; a key changes only when what is drawn changes', () => {
  const none = selectionExtrasModel(null);
  assert.deepEqual([none.lines, none.actions], [[], []]);
  const run = () => {};
  const a = selectionExtrasModel({ lines: ['Online', '', null], actions: [{ label: 'SELL RESOURCES', enabled: false, run }, { nolabel: 1 }] });
  assert.deepEqual(a.lines, ['Online']);
  assert.equal(a.actions.length, 1);
  assert.equal(a.actions[0].enabled, false);
  assert.equal(a.actions[0].run, run);
  assert.equal(selectionExtrasModel({ lines: ['Online'], actions: [{ label: 'SELL RESOURCES', enabled: false, run: () => {} }] }).key, a.key);
  assert.notEqual(selectionExtrasModel({ lines: ['Online'], actions: [{ label: 'SELL RESOURCES', enabled: true }] }).key, a.key);
});

test('outpost extras on the live state: a building gets its status line and its outpost actions; a powered defense gets none', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 5000 });
  const acted = [];
  const ctx = { ids: link.ids, outpost: o, map, ctx: {}, now: T0, gold: 5000, act: (a) => acted.push(a) };
  const byKind = (pred) => [...state.structures.values()].find((s) => { const e = link.ids.get(s.id); return e && pred(e, s); });

  const rig = byKind((e) => e.pad && o.pads[e.pad].kind === 'rig');
  assert.ok(rig, 'the reference outpost has a Mining Station');
  const r = outpostSelectionExtras(rig, ctx);
  assert.equal(r.lines.length, 1, 'a building shows its status line');
  assert.match(r.lines[0], /^Mining · outpost offline$/, "offline is not unpowered: a powered rig mines (model.runningRigs)");
  const sell = r.actions.find((a) => /^SELL RESOURCES/.test(a.label));
  assert.ok(sell, 'a building that holds ore offers SELL RESOURCES');
  assert.equal(sell.enabled, false, 'offline: nothing to sell yet');
  const deep = r.actions.find((a) => /SEAM$/.test(a.label));
  assert.ok(deep, 'a Mining Station offers its seam');
  assert.equal(deep.enabled, false, 'deep seam needs Deep Drilling I');
  deep.run();
  assert.deepEqual(acted, [{ type: 'deep', pad: link.ids.get(rig.id).pad, on: true }], 'the action runs the save session\'s rule');

  const power = byKind((e) => e.pad && o.pads[e.pad].kind === 'power');
  const p = outpostSelectionExtras(power, ctx);
  assert.equal(p.lines.length, 1);
  assert.deepEqual(p.actions, [], 'a Power Station has no outpost-only action: the battle panel\'s U / X / R are its actions');

  const gun = byKind((e) => e.defense);
  if (gun) {
    const g = outpostSelectionExtras(gun, ctx);
    assert.deepEqual(g.actions, [], 'a defense\'s actions are the battle panel\'s own');
    assert.ok(g.lines.length === 0 || /no power/i.test(g.lines[0]), 'a defense adds a line only when it has no power');
  }
  // a structure placed during the visit (not in the link yet): the battle panel alone
  assert.equal(outpostSelectionExtras({ id: 99999 }, ctx), null);
});
