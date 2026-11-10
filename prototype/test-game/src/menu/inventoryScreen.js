/**
 * src/menu/inventoryScreen.js — the INVENTORY screen [MM-story_mvzkdvrl_1l]. Mission-Log-Design §12, drawn to match the
 * design page's Inventory view: all 36 resources on one screen, a band per planet, a detail pane for the selected one.
 * Html functions are pure; createInventoryScreen mounts them.
 *
 * One screen, several inventories [MM-story_mwaf80xq_19]: what it shows comes from a SOURCE — the title, icon, tabs, the
 * bands, the visit and the detail lines. BATTLE_INVENTORY (below) is the battle INVENTORY; the OUTPOST & FARM store
 * (menu/storeScreen.js) is another source on the same markup and the same .bwm-ml styles (owner rule 5: "a clone of
 * the previous one", built once). A source's bands have inventoryBands' shape (save/inventory.js).
 */
import { resourceIconHtml } from '../data/resourceIcons.js';
import { loadSave, updateSave } from '../save/save.js';
import { loadMissionCatalog } from '../save/missionCatalog.js';
import { flowCtx } from '../save/missionFlow.js';
import { inventoryBands, wantedBy, visitInventory } from '../save/inventory.js';
import { ensureMissionStyle } from './missionLog.js';
import { use, esc, fsvg, factionColor, TIER_VAR, TIER_NAME } from './missionView.js';
import { FACTIONS as VOICES } from '../comm/voice.js';

const voiceOfName = (name) => Object.keys(VOICES).find((k) => VOICES[k].name === name) || 'unknown';
const keyOf = (band) => band.planetKey || voiceOfName(band.faction);
const num = (n) => Math.round(n).toLocaleString('en-US');
export const INV_TABS = Object.freeze([['all', 'All 36'], ['kept', 'Kept'], ['quest', 'Quest crystals']]);
const kept = (tier) => tier === 'common' || tier === 'uncommon';
const inTab = (tab, tier) => tab === 'all' || (tab === 'kept') === kept(tier);
const roleOf = (r) => (kept(r.tier) ? 'Kept · worth ' + r.value + ' gold each' : 'Quest crystal');

/**
 * The battle INVENTORY as a screen source. A source is:
 *   key, title, label, icon, tabs [[key, name]], inTab(tab, r), back (the phone's back-link text),
 *   load() → ctx or a Promise of it (what bands/detail need; here the mission catalogue), loadFailed (its error line),
 *   bands(save, ctx, planetOpen, fresh), visit(save) → fresh, first(ctx, bands) → the id selected on open,
 *   detail(band, r, ctx) → { rows: [[label, html]] (after Planet and Faction), note, count? (the big number, else r.have), tierLabel?, extra? (html after the rows) }
 *   view(tab) → optional: a tab with a view of its own (the farm store's Seed pods, menu/seedPods.js) draws its list and
 *     detail itself — { list(bands, selected, save), detail(bands, selected, save), sum?(bands, save),
 *     click?(button, api) → true when it handled the click } — on this screen's markup, tabs and selection.
 */
export const BATTLE_INVENTORY = Object.freeze({
  key: 'inventory', title: 'INVENTORY', label: 'Inventory', icon: 'i-inv', tabs: INV_TABS, back: 'All resources',
  inTab: (tab, r) => inTab(tab, r.tier),
  load: () => loadMissionCatalog(), loadFailed: 'Mission content failed to load',
  bands: (s, catalog, planetOpen, fresh) => inventoryBands(s, catalog, planetOpen, fresh),
  visit: (s) => visitInventory(s),
  first: (catalog) => catalog.resources[0].id,
  detail: (band, r, catalog) => {
    const w = wantedBy(catalog, r.name);
    return {
      rows: [['Role', roleOf(r)], ['From', esc(band.planet) + ' harvests' + (kept(r.tier) ? '' : ' (quest nodes)')], ['Wanted by', w.length ? w.map(esc).join('<br>') : '—']],
      note: 'Common and uncommon resources are kept as well as paying their gold. Rare and epic come from quest nodes.',
    };
  },
});

/** A planet band: its header (planet, faction, the count or the locked line) round `body`. held/fresh default to the band's. */
export function bandHtml(b, body, held = b.held, fresh = b.fresh) {
  return `<section class="pband${b.open ? '' : ' locked'}" style="--fc:${factionColor(keyOf(b))}"><header>${fsvg(keyOf(b))}<b>${esc(b.planet)}</b><small>${esc(b.faction)}</small>
   <span class="pbt">${b.open ? `<b class="num">${num(held)}</b> held${fresh ? ` · <em>+${num(fresh)} new</em>` : ''}` : `${use('s-locked')} Portal: ${esc(b.planet)} not owned`}</span></header>
   ${body}</section>`;
}

/** The list: a band per planet, a tile per item the tab shows. */
export function bandListHtml(bands, src, tab, selected) {
  return bands.map((b) => {
    const tiles = b.resources.filter((r) => src.inTab(tab, r)).map((r) => `<button class="rt${r.have ? '' : ' zero'}" data-inv-id="${esc(r.id)}" aria-selected="${r.id === selected}" style="--rc:var(${TIER_VAR[r.tier]})">${resourceIconHtml(r.id, 'gem3 resi')}
    <span class="rtx"><b>${esc(r.name)}</b><small>${TIER_NAME[r.tier]}</small></span><span class="rtn num">${b.open ? num(r.have) : '—'}${r.fresh ? `<em>+${num(r.fresh)}</em>` : ''}</span></button>`).join('');
    return bandHtml(b, `<div class="rts">${tiles}</div>`);
  }).join('');
}

/** The detail pane for the selected item (the first item when none is). */
export function bandDetailHtml(bands, selected, src, ctx) {
  const band = bands.find((b) => b.resources.some((r) => r.id === selected)) || bands[0];
  if (!band) return '';
  const r = band.resources.find((x) => x.id === selected) || band.resources[0], key = keyOf(band), d = src.detail(band, r, ctx);
  const rows = d.rows.map(([k, v], i) => (i === 1 ? '\n    ' : '') + `<dt>${k}</dt><dd>${v}</dd>`).join('');
  return `<button class="dback" data-iback>${use('u-back')}${esc(src.back)}</button>
  <div class="rdet" style="--rc:var(${TIER_VAR[r.tier]});--fc:${factionColor(key)}">
   <span class="gem2">${resourceIconHtml(r.id, 'resi')}</span><div class="rdn num">${band.open ? num(d.count == null ? r.have : d.count) : '—'}</div>${r.fresh && d.count == null ? `<div class="rdnew num">+${num(r.fresh)} since your last visit</div>` : ''}
   <h2>${esc(r.name)}</h2><div class="rdt">${d.tierLabel || TIER_NAME[r.tier]}</div>
   <dl><dt>Planet</dt><dd>${fsvg(key)}${esc(band.planet)}${band.open ? '' : ' · locked'}</dd><dt>Faction</dt><dd>${esc(band.faction)}</dd>${rows}</dl>${d.extra || ''}
   <p class="inote">${d.note}</p>
  </div>`;
}

export const inventoryListHtml = (bands, tab, selected) => bandListHtml(bands, BATTLE_INVENTORY, tab, selected);
export const inventoryDetailHtml = (bands, selected, catalog) => bandDetailHtml(bands, selected, BATTLE_INVENTORY, catalog);

export function createInventoryScreen({ doc, host, source = BATTLE_INVENTORY, gateOpts = () => ({}), onChange, onClose }) {
  const src = source;
  ensureMissionStyle(doc);
  const inv = doc.createElement('section');
  inv.className = 'log inv'; inv.setAttribute('aria-label', src.label); inv.dataset.inv = src.key;
  inv.innerHTML = `<div class="lp"><div class="lp-head"><svg class="i" style="width:24px;height:24px;color:var(--cyan2)"><use href="#${src.icon}"/></svg><h1>${esc(src.title)}</h1><div class="sum" data-sum></div></div>
   <div class="tabs" role="tablist" data-tabs></div><div class="list" data-list></div></div><div class="dp" data-dp></div>`;
  host.appendChild(inv);
  const $ = (q) => inv.querySelector(q);
  let ctx = null, loaded = false, tab = src.tabs[0][0], selected = null, fresh = {}, loadError = null;

  function render() {
    if (!loaded) { $('[data-list]').innerHTML = loadError ? `<div class="stale">${esc(src.loadFailed)}: ${esc(loadError.message || loadError)}</div>` : ''; return; }
    const s = loadSave(), fc = flowCtx(s, gateOpts());
    const bands = src.bands(s, ctx, fc.planetOpen, fresh);
    if (!selected) selected = src.first(ctx, bands);
    const v = viewOf();
    $('[data-tabs]').innerHTML = src.tabs.map(([k, n]) => `<button class="tab" role="tab" aria-selected="${k === tab}" data-itab="${k}">${n}</button>`).join('');
    $('[data-sum]').innerHTML = v && v.sum ? v.sum(bands, s) : `<b class="num">${num(bands.reduce((a, b) => a + b.held, 0))}</b> held<br><b class="num">${num(bands.reduce((a, b) => a + b.fresh, 0))}</b> new`;
    $('[data-list]').innerHTML = v ? v.list(bands, selected, s) : bandListHtml(bands, src, tab, selected);
    $('[data-dp]').innerHTML = v ? v.detail(bands, selected, s) : bandDetailHtml(bands, selected, src, ctx);
  }
  const viewOf = () => (src.view ? src.view(tab) : null);
  // what a tab's own view may do: write the save (save.js updateSave), redraw, tell the menu, close the screen
  const api = { load: () => loadSave(), update: (fn) => updateSave(fn), render: () => render(), changed: () => { if (onChange) onChange(); }, close: () => { if (onClose) onClose(); } };
  inv.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const v = viewOf();
    if (v && v.click && v.click(t, api)) return;
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
    updateSave((s) => { fresh = src.visit(s); });
    if (onChange) onChange();
    render();
    return Promise.resolve().then(() => src.load()).then((c) => { ctx = c; loaded = true; loadError = null; }, (e) => { loadError = e; console.error('[' + src.key + '] content failed to load', e); }).then(() => { if (isOpen()) render(); });
  }
  function close() { inv.classList.remove('on', 'detail'); }
  return { open, close, isOpen };
}
