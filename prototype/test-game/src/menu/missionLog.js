/**
 * src/menu/missionLog.js — the Mission Log screen and the moment a mission is logged [MM-story_mvyqoo07_f].
 * The look lives in missionView.js (pure) and missionLogCss.js; this file mounts it, owns the clicks and writes the save.
 *
 *   createMissionLog({ doc, host, chipPing, gateOpts, onChange, onClose }) → { open, close, sync, drainQueue, isOpen }
 */
import { loadSave, updateSave } from '../save/save.js';
import { loadMissionCatalog } from '../save/missionCatalog.js';
import { syncMissions, flowCtx } from '../save/missionFlow.js';
import { markMissionSeen, progress } from '../save/missions.js';
import { MISSION_LOG_CSS } from './missionLogCss.js';
import { missionRows, sortRows, TABS, tabsHtml, summaryHtml, listHtml, use, esc, barHtml, TYPE_ICON } from './missionView.js';

export function ensureMissionStyle(doc) {
  if (doc.getElementById('bwm-ml-style')) return;
  const st = doc.createElement('style'); st.id = 'bwm-ml-style'; st.textContent = MISSION_LOG_CSS; doc.head.appendChild(st);
}

export function createMissionLog({ doc, host, chipPing, gateOpts = () => ({}), onChange, onClose }) {
  ensureMissionStyle(doc);
  host.classList.add('bwm-ml');
  const log = doc.createElement('section');
  log.className = 'log'; log.setAttribute('aria-label', 'Mission Log');
  log.innerHTML = `<div class="lp"><div class="lp-head"><svg class="i" style="width:24px;height:24px;color:var(--gold)"><use href="#i-log"/></svg><h1>MISSION LOG</h1>
    <div class="sum" data-sum></div></div>
    <div class="tabs" role="tablist" data-tabs></div><div class="list" role="listbox" aria-label="Missions" data-list></div></div><div class="dp" data-dp></div>`;
  const toastEl = doc.createElement('div');
  toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  host.appendChild(toastEl); host.appendChild(log);
  const $ = (q) => log.querySelector(q);
  let catalog = null, tab = 'active', selected = null, loadError = null, toastTimer = 0, toastQueue = [];
  const ctxFor = (s) => flowCtx(s, gateOpts());

  /** Load the content once, then bring the log up to date. A failed load is shown in the log, never read as "no missions". */
  function ready() {
    return loadMissionCatalog().then((c) => { catalog = c; loadError = null; return c; }, (e) => { loadError = e; console.error('[missions] content failed to load', e); return null; });
  }
  function sync() {
    if (!catalog) return ready().then((c) => { if (c) sync(); });
    updateSave((s) => { syncMissions(s, catalog, ctxFor(s)); });
    if (onChange) onChange();
    drainQueue();
    if (isOpen()) render();
    return Promise.resolve();
  }

  // ── the toast: the record is created at assignment, this is the moment the player sees it (design §1)
  function drainQueue() {
    let q = [];
    updateSave((s) => { q = s.loggedQueue || []; s.loggedQueue = []; });
    if (!q.length) return;
    toastQueue.push(...q);
    if (!toastTimer) nextToast();
  }
  function nextToast() {
    const item = toastQueue.shift();
    if (!item) { toastTimer = 0; toastEl.classList.remove('on'); return; }
    const s = loadSave();
    if (item.kind === 'ship') {
      const ship = catalog && catalog.capitalShips[item.planet];
      toastEl.innerHTML = `<span class="badge" style="--sc:var(--gold)">${use('t-campaign')}</span><span class="tt"><span class="k" style="color:var(--gold)">CAPITAL SHIP IN ORBIT · ${esc(item.planet).toUpperCase()}</span><span class="n">${esc(ship ? ship.ship : item.planet)}</span><span class="g">${esc(ship ? ship.captain : '')}</span></span>`;
    } else {
      const m = (s.missions || []).find((x) => x.id === item.id);
      if (!m) { nextToast(); return; }
      const p = progress(m);
      toastEl.innerHTML = `<span class="badge" style="--sc:var(--s-new)">${use(TYPE_ICON[m.type] || 't-contract')}</span><span class="tt"><span class="k">MISSION LOGGED · ${m.role === 'primary' ? 'PRIMARY' : 'SECONDARY'} STEP ${m.step}</span><span class="n">${esc(m.title)}</span><span class="g">${esc(m.giver.name)}</span>${barHtml(p.have, p.need, 'new')}</span>`;
      if (chipPing) chipPing();
    }
    toastEl.classList.add('on');
    toastTimer = doc.defaultView.setTimeout(nextToast, 3600);
  }

  // ── the list
  function render() {
    if (!catalog) {
      $('[data-tabs]').innerHTML = '';
      $('[data-list]').innerHTML = loadError ? `<div class="stale">Mission content failed to load: ${esc(loadError.message || loadError)}</div>` : '';
      return;
    }
    const s = loadSave(), rows = missionRows(s, catalog, ctxFor(s));
    $('[data-sum]').innerHTML = summaryHtml(rows);
    $('[data-tabs]').innerHTML = tabsHtml(rows, tab);
    const inTab = sortRows(rows.filter((r) => TABS.find((t) => t.k === tab).f(r.status)));
    if (!selected || !rows.some((r) => r.m.id === selected)) selected = inTab.length ? inTab[0].m.id : null;
    $('[data-list]').innerHTML = listHtml(rows, catalog, tab, selected);
    renderDetail(s, rows);
  }
  function renderDetail() { /* the dossier arrives with MLG-5 */ }

  function select(id) {
    selected = id;
    updateSave((s) => { markMissionSeen(s, id); });   // opening a mission clears New
    if (onChange) onChange();
    render();
    log.classList.add('detail');
  }

  log.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.id) select(t.dataset.id);
    else if (t.dataset.tab) { tab = t.dataset.tab; selected = null; render(); }
  });
  const onKey = (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    if (log.classList.contains('detail') && doc.defaultView.innerWidth <= 700) log.classList.remove('detail');
    else if (onClose) onClose();
  };
  doc.addEventListener('keydown', onKey);

  const isOpen = () => log.classList.contains('on');
  function open() {
    log.classList.add('on');
    render();
    return sync();
  }
  function close() { log.classList.remove('on', 'detail'); }
  return { open, close, sync, drainQueue, isOpen };
}
