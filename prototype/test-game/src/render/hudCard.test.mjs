// The HUD's one card (render/hudCard.js) and the shared after-action tokens (render/uiTokens.js) [MM-story_mwcuyrqr_3j].
// Owner 2026-11-12: "our Victory pop-ups look very good, follow that design pattern for upper right info panels" — the
// selection panel, the outpost card and the farm panel are this card, built from the Victory pop-up's own tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hudCardModel, hudCardHtml, createHudCard, HUD_CARD_CSS, HUD_CARD_W } from './hudCard.js';
import { AAA_VARS, AAA_PANEL_BG, aaaTicksCss } from './uiTokens.js';
import { RESULTS_CSS } from './resultsScreen.js';
import { fakeDocument } from './fakeDom.mjs';
import { createHud, updateHud, flashMessage, TOAST_KINDS, toastMs } from './hud.js';

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

test('one set of tokens: the Victory pop-up and the HUD card read the same palette, panel fill and corner ticks', () => {
  assert.ok(RESULTS_CSS.includes(AAA_VARS), 'the pop-up declares the shared palette');
  assert.ok(RESULTS_CSS.includes(AAA_PANEL_BG) && HUD_CARD_CSS.includes(AAA_PANEL_BG), 'the same panel fill');
  assert.ok(RESULTS_CSS.includes(aaaTicksCss('.rs-panel', 22, 'var(--acc)')), 'the pop-up\'s gold ticks');
  assert.ok(HUD_CARD_CSS.includes(aaaTicksCss('.bw-card', 12, 'var(--gold)')), 'the card\'s gold ticks, scaled down');
  assert.match(HUD_CARD_CSS, /font-family:Rajdhani/, 'Rajdhani text, as the pop-up');
  assert.match(HUD_CARD_CSS, /\.bw-card-title \{ font-family:Orbitron/, 'an Orbitron title, as the pop-up\'s verdict');
  // no colour of the palette is spelled out twice: the card reads the variables
  for (const v of ['#2a3340', '#8A97A8', '#7af0ff']) assert.ok(!HUD_CARD_CSS.includes(v), `${v} comes from the tokens`);
  const HUD = strip(readFileSync(new URL('./hud.js', import.meta.url), 'utf8'));
  assert.match(HUD, /\$\{AAA_VARS\}/, 'the HUD root declares the palette for its cards');
});

test('hudCardModel / hudCardHtml: title, status, sections (items · rows · gauges · lines), hotkeyed actions', () => {
  const m = hudCardModel({ title: 'Outpost', status: { text: 'Online', tone: 'ok' },
    sections: [{ head: 'Gathering', aside: 'per hour', items: [{ name: 'Iron', colour: '#c0c0c0', units: '12', rate: '+30/h', pct: 40 }] },
      { gauges: [{ label: 'Storage', value: '10 / 720', pct: 1.4 }] }, { lines: [{ text: '' }] }, null],
    actions: [{ key: 's', label: 'Sell', sub: '2 loads' }, { label: 'Go online', enabled: false, primary: true }, { nolabel: true }] });
  assert.equal(m.sections.length, 2, 'empty sections dropped');
  assert.deepEqual(m.actions.map((a) => [a.key, a.label, a.enabled, a.primary]), [['S', 'Sell', true, false], ['', 'Go online', false, true]]);
  const html = hudCardHtml(m);
  assert.match(html, /class="bw-card-title">Outpost</);
  assert.match(html, /class="bw-card-status t-ok">Online</);
  assert.match(html, /class="bw-card-h"><span>Gathering<\/span><span>per hour<\/span>/);
  assert.match(html, /class="bw-card-item" style="--c:#c0c0c0">.*<span class="n">Iron<\/span>.*--p:40\.0%.*>12<\/span>.*\+30\/h/);
  assert.match(html, /<b class="bw-key">S<\/b> <span>SELL<\/span><small>2 loads<\/small>/);
  assert.match(html, /class="bw-btn primary" data-i="1" disabled/);
  assert.match(html, /<span class="k">Storage<\/span>/);
});

test('values never clip (844×390 review): only the name ellipsises; a one-line note keeps its full text as its title', () => {
  assert.match(HUD_CARD_CSS, /\.bw-card-item \{ display:grid; grid-template-columns:16px minmax\(0,1fr\) minmax\(12px,26px\) max-content max-content;/,
    'units and rate columns take their whole width; the bar and the name give way');
  assert.match(HUD_CARD_CSS, /\.bw-card-body \{[^}]*overflow-y:auto[^}]*scrollbar-width:none/, 'no scrollbar eats the card width');
  const html = hudCardHtml({ title: 'x', sections: [{ lines: [{ text: 'Farming opens when you finish Verdance (0/9 maps) — then see the Factor', tone: 'gold', oneLine: true }] }] });
  assert.match(html, /class="bw-card-line t-gold one" title="Farming opens when you finish Verdance \(0\/9 maps\) — then see the Factor">/);
});

test('createHudCard: render fills the parts, rebuilds only on a change, runs an action and a hotkey', () => {
  const doc = fakeDocument();
  const card = createHudCard(doc, { className: 'x' });
  assert.equal(card.root.className, 'bw-card x');
  let sold = 0;
  const model = { title: 'Outpost', status: 'Offline', actions: [{ key: 'S', label: 'Sell', run: () => sold++ }, { key: 'R', label: 'Repair all', enabled: false, run: () => sold += 10 }] };
  card.render(model);
  assert.equal(card.title.textContent, 'Outpost');
  assert.equal(card.status.textContent, 'Offline');
  const btns = card.actions.children;
  assert.equal(btns.length, 2);
  card.render(model);
  assert.equal(card.actions.children[0], btns[0], 'the same buttons when nothing changed');
  btns[0].querySelector('span').dispatch('click');
  assert.equal(sold, 1, 'a click on the label runs the action');
  assert.equal(card.runKey('s'), true);
  assert.equal(card.runKey('r'), false, 'a disabled action does not run on its key');
  assert.equal(card.runKey('q'), false);
  assert.equal(sold, 2);
});

test('the battle selection panel is a HudCard in the right column, with U / X / R as before', () => {
  const doc = fakeDocument();
  const hud = createHud(doc.body, {});
  assert.ok(hud.selPanel.classList.contains('bw-card') && hud.selPanel.classList.contains('bw-selpanel'));
  assert.equal(hud.sname, hud.selCard.title);
  assert.deepEqual([hud.upgradeBtn, hud.sellBtn, hud.repairBtn].map((b) => b.querySelector('.bw-key').textContent), ['U', 'X', 'R']);
  assert.equal(hud.upgradeBtn.parentNode, hud.selCard.actions);
  const struct = { id: 4, structId: 'STR-Cannon', tier: 1, lifecycle: 'Active', hp: 300, maxHp: 400, kind: 'antiGround' };
  const state = { seed: 1, time: 0, base: { hp: 1, maxHp: 1, pos: { x: 1, y: 1 } }, economy: { money: 5000 }, waves: { current: 0, total: 3 },
    structures: new Map([[4, struct]]), units: new Map() };
  updateHud(hud, state, { selectedStructureId: 4 });
  assert.equal(hud.selPanel.style.display, 'flex');
  assert.match(hud.sname.textContent, / T1$/);
  assert.equal(hud.shpfill.style.width, '75.0%');
  assert.match(hud.upgradeBtn._label.textContent, /UPGRADE \(\d+g\)/);
  assert.match(hud.sellBtn._label.textContent, /SELL \(\+\d+g\)/);
  // the same width / place token as the mode cards
  assert.match(HUD_CARD_CSS, new RegExp('width:' + HUD_CARD_W + 'px'));
});

test('toasts: error (today\'s red) by default, ok (green), info; a long one stays 3 s', () => {
  const doc = fakeDocument();
  const hud = createHud(doc.body, {});
  assert.deepEqual(TOAST_KINDS, ['error', 'ok', 'info']);
  flashMessage(hud, 'Not enough gold');
  assert.equal(hud.toast.className, 'bw-toast');
  flashMessage(hud, '+159g primary', 'ok');
  assert.equal(hud.toast.className, 'bw-toast bw-toast-ok');
  flashMessage(hud, 'Map 3', 'info');
  assert.equal(hud.toast.className, 'bw-toast bw-toast-info');
  flashMessage(hud, 'x', 'nonsense');
  assert.equal(hud.toast.className, 'bw-toast');
  assert.equal(toastMs('short'), 1600);
  assert.equal(toastMs('OUTPOST ONLINE · mining has begun. Raiders will come: hold the first one.'), 3000);
  const CSS = readFileSync(new URL('./hud.js', import.meta.url), 'utf8');
  assert.match(CSS, /\.bw-toast \{[^}]*rgba\(60,20,20,0\.92\)/, 'the error toast is unchanged');
  assert.match(CSS, /\.bw-toast\.bw-toast-ok \{ background:rgba\(16,40,26,0\.92\); border-color:#57a057; color:#c8f5cf; \}/);
});

test('card button labels are uppercase but gold amounts keep a small g (owner 2026-11-12: "Small g since it uses less width")', async () => {
  const { cardLabelText } = await import('./hudCard.js');
  assert.equal(cardLabelText('Upgrade (750g)'), 'UPGRADE (750g)');
  assert.equal(cardLabelText(' Sell (+120g)'), ' SELL (+120g)');
  assert.equal(cardLabelText('Max Tier'), 'MAX TIER');
});
