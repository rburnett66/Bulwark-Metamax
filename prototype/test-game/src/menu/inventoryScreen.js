/**
 * src/menu/inventoryScreen.js — the INVENTORY screen [MM-story_mvzkdvrl_1l]. Mission-Log-Design §12, drawn to match the
 * design page's Inventory view: all 36 resources on one screen, a band per planet, a detail pane for the selected one.
 * Html functions are pure; createInventoryScreen mounts them.
 */
import { loadSave, updateSave } from '../save/save.js';
import { loadMissionCatalog } from '../save/missionCatalog.js';
import { flowCtx } from '../save/missionFlow.js';
import { inventoryBands, wantedBy, visitInventory } from '../save/inventory.js';
import { ensureMissionStyle } from './missionLog.js';
import { use, esc, fsvg, factionColor, TIER_VAR, TIER_NAME } from './missionView.js';
import { FACTIONS as VOICES } from '../comm/voice.js';

const voiceOfName = (name) => Object.keys(VOICES).find((k) => VOICES[k].name === name) || 'unknown';
const num = (n) => Math.round(n).toLocaleString('en-US');
export const INV_TABS = Object.freeze([['all', 'All 36'], ['kept', 'Kept'], ['quest', 'Quest crystals']]);
const kept = (tier) => tier === 'common' || tier === 'uncommon';
const inTab = (tab, tier) => tab === 'all' || (tab === 'kept') === kept(tier);
const roleOf = (r) => (kept(r.tier) ? 'Kept · worth ' + r.value + ' gold each' : 'Quest crystal');

export function inventoryListHtml(bands, tab, selected) {
  return bands.map((b) => {
    const key = voiceOfName(b.faction);
    const tiles = b.resources.filter((r) => inTab(tab, r.tier)).map((r) => `<button class="rt${r.have ? '' : ' zero'}" data-inv-id="${esc(r.id)}" aria-selected="${r.id === selected}" style="--rc:var(${TIER_VAR[r.tier]})">${use('r-crystal', 'i gem3')}
    <span class="rtx"><b>${esc(r.name)}</b><small>${TIER_NAME[r.tier]}</small></span><span class="rtn num">${b.open ? num(r.have) : '—'}${r.fresh ? `<em>+${num(r.fresh)}</em>` : ''}</span></button>`).join('');
    return `<section class="pband${b.open ? '' : ' locked'}" style="--fc:${factionColor(key)}"><header>${fsvg(key)}<b>${esc(b.planet)}</b><small>${esc(b.faction)}</small>
   <span class="pbt">${b.open ? `<b class="num">${num(b.held)}</b> held${b.fresh ? ` · <em>+${num(b.fresh)} new</em>` : ''}` : `${use('s-locked')} Portal: ${esc(b.planet)} not owned`}</span></header>
   <div class="rts">${tiles}</div></section>`;
  }).join('');
}

export function inventoryDetailHtml(bands, selected, catalog) {
  const band = bands.find((b) => b.resources.some((r) => r.id === selected)) || bands[0];
  if (!band) return '';
  const r = band.resources.find((x) => x.id === selected) || band.resources[0], key = voiceOfName(band.faction), w = wantedBy(catalog, r.name);
  return `<button class="dback" data-iback>${use('u-back')}All resources</button>
  <div class="rdet" style="--rc:var(${TIER_VAR[r.tier]});--fc:${factionColor(key)}">
   <span class="gem2">${use('r-crystal')}</span><div class="rdn num">${band.open ? num(r.have) : '—'}</div>${r.fresh ? `<div class="rdnew num">+${num(r.fresh)} since your last visit</div>` : ''}
   <h2>${esc(r.name)}</h2><div class="rdt">${TIER_NAME[r.tier]}</div>
   <dl><dt>Planet</dt><dd>${fsvg(key)}${esc(band.planet)}${band.open ? '' : ' · locked'}</dd><dt>Faction</dt><dd>${esc(band.faction)}</dd><dt>Role</dt><dd>${roleOf(r)}</dd>
    <dt>From</dt><dd>${esc(band.planet)} harvests${kept(r.tier) ? '' : ' (quest nodes)'}</dd><dt>Wanted by</dt><dd>${w.length ? w.map(esc).join('<br>') : '—'}</dd></dl>
   <p class="inote">Common and uncommon resources are kept as well as paying their gold. Rare and epic come from quest nodes.</p>
  </div>`;
}

export function createInventoryScreen({ doc, host, gateOpts = () => ({}), onChange, onClose }) {
  ensureMissionStyle(doc);
  const inv = doc.createElement('section');
  inv.className = 'log inv'; inv.setAttribute('aria-label', 'Inventory');
  inv.innerHTML = `<div class="lp"><div class="lp-head"><svg class="i" style="width:24px;height:24px;color:var(--cyan2)"><use href="#i-inv"/></svg><h1>INVENTORY</h1><div class="sum" data-sum></div></div>
   <div class="tabs" role="tablist" data-tabs></div><div class="list" data-list></div></div><div class="dp" data-dp></div>`;
  host.appendChild(inv);
  const $ = (q) => inv.querySelector(q);
  let catalog = null, tab = 'all', selected = null, fresh = {}, loadError = null;

  function render() {
    if (!catalog) { $('[data-list]').innerHTML = loadError ? `<div class="stale">Mission content failed to load: ${esc(loadError.message || loadError)}</div>` : ''; return; }
    const s = loadSave(), ctx = flowCtx(s, gateOpts());
    const bands = inventoryBands(s, catalog, ctx.planetOpen, fresh);
    if (!selected) selected = catalog.resources[0].id;
    $('[data-tabs]').innerHTML = INV_TABS.map(([k, n]) => `<button class="tab" role="tab" aria-selected="${k === tab}" data-itab="${k}">${n}</button>`).join('');
    $('[data-sum]').innerHTML = `<b class="num">${num(bands.reduce((a, b) => a + b.held, 0))}</b> held<br><b class="num">${num(bands.reduce((a, b) => a + b.fresh, 0))}</b> new`;
    $('[data-list]').innerHTML = inventoryListHtml(bands, tab, selected);
    $('[data-dp]').innerHTML = inventoryDetailHtml(bands, selected, catalog);
  }
  inv.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.invId) { selected = t.dataset.invId; render(); inv.classList.add('detail'); }
    else if (t.dataset.itab) { tab = t.dataset.itab; render(); }
    else if ('iback' in t.dataset) inv.classList.remove('detail');
  });
  const isOpen = () => inv.classList.contains('on');
  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    if (inv.classList.contains('detail') && doc.defaultView.innerWidth <= 700) inv.classList.remove('detail');
    else if (onClose) onClose();
  });
  function open() {
    inv.classList.add('on');
    updateSave((s) => { fresh = visitInventory(s); });
    if (onChange) onChange();
    render();
    return loadMissionCatalog().then((c) => { catalog = c; loadError = null; }, (e) => { loadError = e; console.error('[inventory] content failed to load', e); }).then(() => { if (isOpen()) render(); });
  }
  function close() { inv.classList.remove('on', 'detail'); }
  return { open, close, isOpen };
}
