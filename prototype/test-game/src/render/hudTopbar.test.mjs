// The top bar's readouts and primary action (spec Outpost-AAA-UX §1, D2 D4) [MM-story_mwcuyrqr_3j].
// The battle's bar must be EXACTLY as before: topbar.baseline.json is the bar's markup captured from origin/main's hud.js
// (before this change) with the same states, through the same tiny DOM — the quest / contract / tracked-mission spans
// became readouts with identical output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDocument, serialize } from './fakeDom.mjs';
import { createHud, updateHud } from './hud.js';

const BASE = JSON.parse(readFileSync(new URL('./topbar.baseline.json', import.meta.url), 'utf8'));
const mk = () => createHud(fakeDocument().body, {});
const base = () => ({ seed: 7, time: 83.4, base: { hp: 900, maxHp: 1200, pos: { x: 5, y: 5 } }, economy: { money: 1234 },
  waves: { current: 2, total: 8, active: true, pendingSpawns: [1, 2], endsAt: 120 }, structures: new Map(), units: new Map() });

test('the battle top bar is unchanged: contract, quest + tracked mission, and a plain bar match origin/main', () => {
  let h = mk();
  updateHud(h, { ...base(), contract: { quota: { common: 10, uncommon: 5, rare: 0, epic: 0 }, sold: { common: 3, uncommon: 5, rare: 0, epic: 0 }, kept: { common: 0, uncommon: 2, rare: 1, epic: 0 } } }, { selectedStructureId: null });
  assert.equal(serialize(h.root.querySelector('.bw-topbar')), BASE.contract);
  h = mk(); h.trackedLine = () => 'Kill 10 flyers · 3/10';
  updateHud(h, { ...base(), mapScore: { questRed: 4, questGreen: 2 }, waves: { current: 3, total: 8, active: false } }, { selectedStructureId: null });
  assert.equal(serialize(h.root.querySelector('.bw-topbar')), BASE.quest);
  h = mk();
  updateHud(h, { ...base(), waves: { current: 0, total: 8, active: false } }, null);
  assert.equal(serialize(h.root.querySelector('.bw-topbar')), BASE.plain);
  assert.equal(h.root.querySelector('.bw-readouts'), null, 'a battle sets no mode readouts');
});

test('outpost mode: Hub HP, no clock or wave count, readout chips after the gold, LEAVE in Start Wave\'s slot', () => {
  const h = mk();
  let left = 0, tapped = 0;
  h.setTopbar({ hpLabel: 'Hub', clock: false, wave: false });
  h.setPrimaryAction({ label: 'LEAVE ▸', onClick: () => left++ });
  h.setReadouts([
    { id: 'op-status', text: 'RAID 1:12', tone: 'clock' },
    { id: 'op-power', glyph: '⚡', text: '9/10', tone: 'warn' },
    { id: 'op-store', glyph: '▣', text: '3/720', bar: 3 / 720 },
    { id: 'op-threat', glyph: '☠', text: '11 · 6/day', onTap: () => tapped++ },
  ]);
  updateHud(h, { ...base(), waves: { current: 0, total: 0, active: false } }, null);
  const bar = h.root.querySelector('.bw-topbar');
  assert.equal(h.hptext.textContent, 'Hub: 900/1200');
  assert.equal(h.timerEl.style.display, 'none');
  assert.equal(h.waveEl.style.display, 'none');
  const chips = bar.querySelectorAll('.bw-ro');
  assert.deepEqual(chips.map((c) => c.dataset.ro), ['op-status', 'op-power', 'op-store', 'op-threat']);
  assert.equal(chips[0].className, 'bw-ro t-clock');
  assert.match(chips[1].innerHTML, /<b class="g">⚡<\/b><span>9\/10<\/span>/);
  assert.match(chips[2].innerHTML, /class="bar"><i style="width:0\.4%">/);
  assert.ok(chips[3].classList.contains('bw-tap'));
  chips[3].dispatch('click');
  assert.equal(tapped, 1);
  // the readouts sit between the battle's spans and the primary action, which is the last thing in the bar
  const kids = bar.children;
  assert.equal(kids[kids.length - 1], h.startWaveBtn);
  assert.equal(h.startWaveBtn.textContent, 'LEAVE ▸');
  assert.equal(h.startWaveBtn.disabled, false, 'LEAVE stays live (the wave rule does not touch a mode\'s primary)');
  h.startWaveBtn.dispatch('click');
  assert.equal(left, 1);
  // a readout updates in place and hides
  h.setReadouts([{ id: 'op-status', text: 'ONLINE', tone: 'ok', hidden: true }]);
  assert.equal(chips[0].style.display, 'none');
  assert.equal(bar.querySelectorAll('.bw-ro').length, 4);
});

test('a mode card in the right column yields to a selection, and its hotkeys run only then', () => {
  const h = mk();
  let sold = 0;
  const card = h.addCard({ className: 'op-card' });
  card.render({ title: 'Outpost', actions: [{ key: 'S', label: 'Sell', run: () => sold++ }] });
  assert.ok(h.root.querySelector('.bw-mode-panels .bw-card.bw-modecard.op-card'));
  assert.equal(h.runCardKey('s'), true);
  const struct = { id: 4, structId: 'STR-Cannon', tier: 1, lifecycle: 'Active', hp: 300, maxHp: 400, kind: 'antiGround' };
  updateHud(h, { ...base(), structures: new Map([[4, struct]]) }, { selectedStructureId: 4 });
  assert.equal(h.root.querySelector('.bw-mode-panels').style.display, 'none', 'the selection panel takes the corner');
  assert.equal(h.runCardKey('s'), false);
  assert.equal(sold, 1);
});
