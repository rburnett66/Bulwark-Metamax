/**
 * src/menu/battleHistory.js — the planet's battle history, a modal over the Play page [MM-story_mw1azvh8_d].
 *
 * Owner 2026-11-03: "a history button on the far right of the CAMPAIGN frame … open a AAA modal which presents the
 * history of battles on this planet."
 *
 * Design (direction lives here):
 * - Same visual language as the final results screen (render/resultsScreen.js): dark blurred scrim, square panels,
 *   gold corner ticks, Orbitron for big numbers, Rajdhani for text. The planet's own UI hue (planets.js `ui`) tints
 *   the header and the map rail, so each planet's history feels like that planet's.
 * - Reading order: who (planet) → how it's going (record strip) → where (the 9-map rail, best stars per map) →
 *   every battle, newest first. The rail doubles as a filter: tap a map to see only its battles.
 * - Each battle card answers "what happened" in one glance: result stripe, map, when, the wave-by-wave star bars,
 *   score / kills / time, what it earned (gold, XP) and what it harvested (resource icons, kept highlighted).
 * - One entrance: the panel rises, the record counts up, the rail nodes light in order, the first cards stagger in.
 *   Reduced motion shows the end state. Esc, the close button or a tap on the scrim closes it.
 * - Phone: the panel is the whole screen and scrolls; the header and filters stay put.
 *
 * historyModel / historyHtml are pure (tests, review page); openBattleHistory mounts and animates.
 */
import { battlesOn, planetRecord } from '../save/battleLog.js';
import { resourceId, resourceIconHtml } from '../data/resourceIcons.js';

const TIERS = ['common', 'uncommon', 'rare', 'epic'];
const TIER_COLOR = { common: '#58a6ff', uncommon: '#ffd76a', rare: '#ff7a6a', epic: '#7ae08a' };
const FONTS = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0');
const hours = (sec) => (sec >= 3600 ? (sec / 3600).toFixed(1) + ' h' : Math.round(sec / 60) + ' min');

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", else the date. */
export function whenText(at, now = Date.now()) {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 172800) return 'yesterday';
  if (s < 7 * 86400) return Math.floor(s / 86400) + ' days ago';
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Everything the modal shows for one planet. planet = PLANETS[key] (name, ui, resources). Pure. */
export function historyModel(save, planet, { faction = '', now = Date.now(), starGate = 3 } = {}) {
  const rec = planetRecord(save, planet.name);
  const names = Object.fromEntries(TIERS.map((t) => [t, ((planet.resources || {})[t] || {}).name || t]));
  return {
    planet: planet.name, faction, hue: planet.ui || '#D9A441', now, starGate, record: rec, names,
    battles: battlesOn(save, planet.name).map((e) => ({ ...e, when: whenText(e.at, now) })),
  };
}

const starBars = (stars, total) => '<span class="bh-bars" aria-hidden="true">' +
  Array.from({ length: Math.max(total || 0, stars.length) }, (_, i) => {
    const n = stars[i];
    return n == null ? '<i class="na"></i>' : '<i style="--h:' + (n / 5 * 100).toFixed(0) + '%"' + (n >= 5 ? ' class="five"' : '') + '></i>';
  }).join('') + '</span>';

function cardHtml(e, m) {
  const win = e.result === 'win';
  const res = TIERS.filter((t) => e.harvested[t] > 0).map((t) => '<span class="bh-r" style="--c:' + TIER_COLOR[t] + '" title="' + esc(m.names[t]) +
    '">' + resourceIconHtml(resourceId(m.names[t]), 'ic') + '<b>' + fmt(e.harvested[t]) + '</b>' + (e.kept[t] ? '<em>+' + fmt(e.kept[t]) + ' kept</em>' : '') + '</span>').join('');
  return '<li class="bh-card ' + (win ? 'win' : 'lose') + '" data-map="' + e.mapId + '" data-res="' + e.result + '">' +
    '<div class="bh-c1"><span class="bh-res">' + (win ? 'VICTORY' : 'DEFEAT') + '</span><b class="bh-map">Map ' + e.mapId + (e.mapName ? ' · ' + esc(e.mapName) : '') + '</b>' +
    '<time datetime="' + new Date(e.at).toISOString() + '" title="' + esc(new Date(e.at).toLocaleString('en-US')) + '">' + esc(e.when) + '</time></div>' +
    '<div class="bh-c2">' + starBars(e.stars, e.totalWaves) + '<span class="bh-avg"><span><b>' + e.avg.toFixed(1) + '</b>★</span>' +
    (win ? '' : '<small>wave ' + e.waves + ' / ' + e.totalWaves + '</small>') + '</span></div>' +
    '<dl class="bh-c3"><div><dt>Score</dt><dd>' + fmt(e.score) + '</dd></div><div><dt>Kills</dt><dd>' + fmt(e.kills) + '</dd></div><div><dt>Time</dt><dd>' + mmss(e.seconds) + '</dd></div></dl>' +
    '<div class="bh-c4"><span class="bh-earn">' + (e.gold ? '<b class="g">+' + fmt(e.gold) + '</b> gold' : '<b class="g dim">—</b> gold') + '<b class="x">+' + fmt(e.xp) + '</b> XP' +
    (e.favour ? '<span class="bh-fav ' + (e.favour.outcome === 'FULFILLED' ? 'ok' : 'bad') + '">' + (e.favour.outcome === 'FULFILLED' ? 'Favour kept' : 'Favour broken') + ' · ' + esc(e.favour.title) + '</span>' : '') +
    '</span>' + (res ? '<span class="bh-rs">' + res + '</span>' : '<span class="bh-rs none">Nothing harvested</span>') + '</div></li>';
}

/** The modal's markup in its end state. Pure. */
export function historyHtml(m) {
  const r = m.record;
  const stat = (k, v, cls = '', raw = null) => '<div class="bh-st ' + cls + '"><dt>' + k + '</dt><dd' + (raw != null ? ' data-count="' + raw + '"' : '') + '>' + v + '</dd></div>';
  let h = '<div class="bh-scrim" data-close></div><section class="bh-panel" role="dialog" aria-modal="true" aria-labelledby="bh-title">';
  h += '<header class="bh-head"><div><div class="bh-kick">BATTLE HISTORY</div><h2 id="bh-title">' + esc(m.planet) + '</h2>' +
    (m.faction ? '<div class="bh-fac">' + esc(m.faction) + '</div>' : '') + '</div><button class="bh-x" type="button" data-close aria-label="Close battle history">✕</button></header>';
  h += '<div class="bh-scroll">';
  h += '<dl class="bh-rec">' + stat('Battles', fmt(r.battles), '', r.battles) +
    stat('Win rate', r.battles ? r.winRate + '%' : '—', 'rate" style="--p:' + r.winRate + '%', null) +
    stat('Best score', r.bestScore ? fmt(r.bestScore) : '—', 'gold', r.bestScore || null) +
    stat('Kills', fmt(r.kills), '', r.kills) + stat('Harvested', fmt(r.harvested), '', r.harvested) +
    stat('Battle time', r.seconds ? hours(r.seconds) : '—') + '</dl>';
  h += '<div class="bh-rail" role="group" aria-label="Filter by map">' + r.maps.map((x) => {
    const st = x.bestAvg == null ? 'none' : x.bestAvg >= m.starGate ? 'gate' : x.beaten ? 'won' : 'tried';
    return '<button type="button" class="bh-node ' + st + '" data-mapf="' + x.id + '" aria-pressed="false"><i>' + x.id + '</i><b>' + (x.bestAvg == null ? '—' : x.bestAvg.toFixed(1) + '★') + '</b>' +
      '<small>' + (x.runs ? x.runs + (x.runs === 1 ? ' run' : ' runs') : '') + '</small></button>';
  }).join('') + '</div>';
  h += '<div class="bh-filt" role="group" aria-label="Filter by result"><button type="button" data-rf="all" aria-pressed="true">All <span>' + r.battles + '</span></button>' +
    '<button type="button" data-rf="win" aria-pressed="false">Victories <span>' + r.wins + '</span></button>' +
    '<button type="button" data-rf="lose" aria-pressed="false">Defeats <span>' + r.losses + '</span></button><span class="bh-shown" aria-live="polite"></span></div>';
  if (!m.battles.length) {
    h += '<div class="bh-empty"><b>No battles on ' + esc(m.planet) + ' yet.</b> Every battle you play here, won or lost, is recorded on this page.' +
      (r.maps.some((x) => x.runs) ? ' Your best result on each map is shown above; battles before this update were not recorded.' : '') + '</div>';
  } else {
    h += '<ol class="bh-list">' + m.battles.map((e) => cardHtml(e, m)).join('') + '</ol><div class="bh-nomatch" hidden>No battles match this filter.</div>';
  }
  h += '</div></section>';
  return h;
}

export const HISTORY_CSS = `
.bh { position:absolute; inset:0; z-index:400; display:flex; align-items:center; justify-content:center; font-family:Rajdhani,"Segoe UI",system-ui,sans-serif;
  color:#dfe7ef; --gold:#D9A441; --gold-hi:#f2c869; --cyan:#7af0ff; --ember:#e0533d; --line:#2a3340; --steel:#8A97A8; -webkit-font-smoothing:antialiased; }
.bh * { box-sizing:border-box; }
.bh-scrim { position:absolute; inset:0; background:radial-gradient(120% 90% at 50% 30%, rgba(10,14,22,.6), rgba(4,6,10,.92) 70%);
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); opacity:0; transition:opacity .3s; }
.bh.on .bh-scrim { opacity:1; }
.bh-panel { position:relative; display:flex; flex-direction:column; width:min(980px, calc(100vw - 32px)); height:min(780px, calc(100vh - 32px)); height:min(780px, calc(100dvh - 32px));
  background:linear-gradient(180deg, rgba(18,24,34,.97), rgba(10,14,20,.98)); border:1px solid var(--line); box-shadow:0 30px 80px rgba(0,0,0,.6);
  opacity:0; transform:translateY(18px) scale(.985); transition:opacity .35s, transform .45s cubic-bezier(.2,1,.3,1); }
.bh.on .bh-panel { opacity:1; transform:none; }
.bh-panel::before, .bh-panel::after { content:""; position:absolute; width:28px; height:28px; pointer-events:none; }
.bh-panel::before { left:-1px; top:-1px; border-left:2px solid var(--hue); border-top:2px solid var(--hue); }
.bh-panel::after { right:-1px; bottom:-1px; border-right:2px solid var(--hue); border-bottom:2px solid var(--hue); }
.bh-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:18px 20px 12px; border-bottom:1px solid var(--line);
  background:linear-gradient(90deg, color-mix(in srgb, var(--hue) 16%, transparent), transparent 60%); }
.bh-kick { font-size:12px; font-weight:700; letter-spacing:.34em; color:var(--steel); }
.bh-head h2 { margin:2px 0 0; font:900 clamp(26px,4.6vw,44px)/1 Orbitron,Rajdhani,sans-serif; letter-spacing:.1em; text-transform:uppercase; color:var(--hue);
  text-shadow:0 0 22px color-mix(in srgb, var(--hue) 40%, transparent); }
.bh-fac { margin-top:4px; font-size:14px; letter-spacing:.14em; color:#b7c2ce; }
.bh-x { flex:0 0 auto; width:44px; height:44px; font-size:18px; color:#dfe7ef; background:rgba(255,255,255,.04); border:1px solid #3a4655; cursor:pointer; }
.bh-x:hover { border-color:#6b7a8c; } .bh-x:focus-visible, .bh button:focus-visible { outline:2px solid var(--cyan); outline-offset:2px; }
.bh-scroll { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:14px 20px 20px; display:flex; flex-direction:column; gap:14px; }
.bh-scroll > * { flex-shrink:0; }
.bh-rec { margin:0; display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:8px; }
.bh-st { background:rgba(255,255,255,.025); border:1px solid #222a35; padding:8px 10px; min-width:0; }
.bh-st dt { font-size:11px; font-weight:700; letter-spacing:.2em; color:#6d7a8a; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bh-st dd { margin:2px 0 0; font:800 clamp(16px,2.4vw,24px)/1.1 Orbitron,sans-serif; font-variant-numeric:tabular-nums; color:#f4f7fb; }
.bh-st.gold dd { color:var(--gold-hi); }
.bh-st.rate { background:linear-gradient(90deg, color-mix(in srgb, var(--hue) 22%, transparent) var(--p), rgba(255,255,255,.025) var(--p)); }
.bh-rail { display:grid; grid-template-columns:repeat(9, minmax(0,1fr)); gap:6px; position:relative; }
.bh-rail::before { content:""; position:absolute; left:4%; right:4%; top:19px; height:2px; background:#222a35; }
.bh-node { position:relative; display:flex; flex-direction:column; align-items:center; gap:2px; padding:0 0 6px; background:none; border:1px solid transparent; color:#dfe7ef;
  font:inherit; cursor:pointer; opacity:0; transform:translateY(6px); transition:opacity .25s, transform .3s, border-color .15s, background .15s; }
.bh-node.in { opacity:1; transform:none; }
.bh-node i { font-style:normal; width:38px; height:38px; display:grid; place-items:center; font:800 15px Orbitron,sans-serif; background:#0f141c; border:2px solid #2a3340; line-height:1; }
.bh-node b { font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; margin-top:6px; }
.bh-node small { font-size:11px; letter-spacing:.08em; color:#6d7a8a; }
.bh-node.gate i { border-color:var(--gold); background:color-mix(in srgb, var(--gold) 22%, #0f141c); box-shadow:0 0 14px rgba(217,164,65,.35); }
.bh-node.gate b { color:var(--gold-hi); }
.bh-node.won i { border-color:var(--hue); } .bh-node.tried i { border-color:#5a3a34; }
.bh-node.none { color:#5c6878; }
.bh-node[aria-pressed="true"] { border-color:var(--hue); background:color-mix(in srgb, var(--hue) 10%, transparent); }
.bh-filt { display:flex; flex-wrap:wrap; align-items:center; gap:6px; position:sticky; top:-14px; z-index:2; padding:8px 0; margin:-8px 0; background:linear-gradient(180deg, #121822 70%, transparent); }
.bh-filt button { font:700 14px Rajdhani,sans-serif; letter-spacing:.1em; text-transform:uppercase; min-height:36px; padding:0 12px; color:#b7c2ce; background:rgba(255,255,255,.03); border:1px solid #2e3846; cursor:pointer; }
.bh-filt button span { color:#6d7a8a; margin-left:4px; font-variant-numeric:tabular-nums; }
.bh-filt button[aria-pressed="true"] { color:#1a1206; background:var(--gold); border-color:var(--gold-hi); } .bh-filt button[aria-pressed="true"] span { color:#3d2c0b; }
.bh-shown { margin-left:auto; font-size:13px; color:#6d7a8a; letter-spacing:.06em; }
.bh-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.bh-card { --acc:var(--gold); display:grid; grid-template-columns:minmax(150px,1.1fr) minmax(130px,1fr) minmax(170px,1.1fr); grid-template-areas:"a b c" "d d d"; gap:8px 16px;
  padding:12px 14px 10px 16px; background:rgba(255,255,255,.025); border:1px solid #222a35; border-left:4px solid var(--acc); position:relative;
  opacity:0; transform:translateY(10px); transition:opacity .3s, transform .35s cubic-bezier(.2,1,.3,1); }
.bh-card.in { opacity:1; transform:none; }
.bh-card.lose { --acc:var(--ember); }
.bh-card[hidden] { display:none; }
.bh-c1 { grid-area:a; display:flex; flex-direction:column; gap:2px; min-width:0; }
.bh-res { font:900 15px Orbitron,sans-serif; letter-spacing:.16em; color:var(--acc); }
.bh-map { font-size:17px; color:#f4f7fb; overflow-wrap:anywhere; }
.bh-c1 time { font-size:13px; color:#6d7a8a; letter-spacing:.04em; }
.bh-c2 { grid-area:b; display:flex; align-items:flex-end; gap:12px; }
.bh-bars { display:flex; align-items:flex-end; gap:3px; height:38px; }
.bh-bars i { display:block; width:9px; height:max(3px, var(--h)); background:var(--gold-hi); opacity:.85; }
.bh-bars i.five { background:#fff2c4; box-shadow:0 0 8px rgba(242,200,105,.7); }
.bh-bars i.na { height:3px; background:#2a3340; }
.bh-card.lose .bh-bars i:not(.na) { background:#c9a07a; }
.bh-avg { display:flex; flex-direction:column; line-height:1; color:var(--gold-hi); font-size:14px; }
.bh-avg b { font:800 24px Orbitron,sans-serif; }
.bh-avg small { margin-top:4px; font-size:12px; color:#e0907a; letter-spacing:.06em; }
.bh-c3 { grid-area:c; margin:0; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; align-self:center; }
.bh-c3 dt { font-size:11px; letter-spacing:.2em; color:#6d7a8a; text-transform:uppercase; }
.bh-c3 dd { margin:0; font:700 17px Rajdhani,sans-serif; font-variant-numeric:tabular-nums; color:#e8eef5; }
.bh-c4 { grid-area:d; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px 14px; padding-top:8px; border-top:1px solid #1e252f; font-size:14px; color:#8A97A8; }
.bh-earn { display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; }
.bh-earn b { font:800 15px Orbitron,sans-serif; margin-right:2px; } .bh-earn .g { color:var(--gold-hi); } .bh-earn .x { color:var(--cyan); margin-left:6px; } .bh-earn .dim { color:#5c6878; }
.bh-fav { font-size:13px; letter-spacing:.04em; padding:2px 8px; border:1px solid; } .bh-fav.ok { color:#7ae08a; border-color:#2f5a3a; } .bh-fav.bad { color:#ff8a6a; border-color:#5a2f2a; }
.bh-rs { display:flex; flex-wrap:wrap; gap:4px 12px; } .bh-rs.none { color:#5c6878; }
.bh-r { display:inline-flex; align-items:center; gap:6px; color:#e8eef5; }
.bh-r .ic { width:26px; height:26px; border-radius:3px; box-shadow:0 0 0 1px var(--c), 0 0 8px color-mix(in srgb, var(--c) 40%, transparent); }
.bh-r b { font-variant-numeric:tabular-nums; } .bh-r em { font-style:normal; font-size:12px; color:var(--cyan); }
.bh-empty, .bh-nomatch { padding:28px 16px; text-align:center; color:#8A97A8; font-size:16px; line-height:1.5; border:1px dashed #2a3340; }
.bh-empty b { display:block; color:#e8eef5; font-size:19px; margin-bottom:4px; }
@media (max-width:760px) {
  .bh-panel { width:100vw; height:100vh; height:100dvh; border:0; }
  .bh-head { padding:max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left)); }
  .bh-scroll { padding:12px max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
  .bh-rec { grid-template-columns:repeat(3, minmax(0,1fr)); }
  .bh-rail { grid-template-columns:repeat(9, 52px); overflow-x:auto; padding-bottom:4px; }
  .bh-rail::before { right:auto; width:calc(9 * 58px); }
  .bh-card { grid-template-columns:minmax(0,1fr) auto; grid-template-areas:"a b" "c c" "d d"; }
  .bh-c3 dd { font-size:16px; }
}
@media (max-height:500px) and (orientation:landscape) {
  .bh-panel { width:100vw; height:100vh; height:100dvh; border:0; }
  .bh-head { padding:8px max(16px, env(safe-area-inset-right)) 8px max(16px, env(safe-area-inset-left)); }
  .bh-head h2 { font-size:24px; } .bh-kick { font-size:10px; } .bh-fac { display:none; }
  .bh-scroll { padding:10px max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left)); gap:10px; }
}
@media (prefers-reduced-motion: reduce) { .bh *, .bh *::before, .bh *::after { transition:none !important; animation:none !important; } }
`;

/**
 * Open the modal over `host` (the menu root). planet = PLANETS[key]; opts: { faction, save, onClose, reduced }.
 * → { root, close }.
 */
export function openBattleHistory(host, planet, opts = {}) {
  const doc = host.ownerDocument, win = doc.defaultView;
  if (!doc.getElementById('bh-css')) { const st = doc.createElement('style'); st.id = 'bh-css'; st.textContent = HISTORY_CSS; doc.head.appendChild(st); }
  if (!doc.getElementById('rs-fonts')) { const l = doc.createElement('link'); l.id = 'rs-fonts'; l.rel = 'stylesheet'; l.href = FONTS; doc.head.appendChild(l); }
  const m = historyModel(opts.save, planet, { faction: opts.faction || '' });
  const root = doc.createElement('div');
  root.className = 'bh';
  root.style.setProperty('--hue', m.hue);
  root.innerHTML = historyHtml(m);
  host.appendChild(root);
  const prevFocus = doc.activeElement;
  const reduced = opts.reduced || !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const timers = [];
  const at = (ms, fn) => timers.push(win.setTimeout(fn, ms));
  let mapF = null, resF = 'all';

  function applyFilter() {
    let shown = 0;
    for (const c of $$('.bh-card')) {
      const ok = (resF === 'all' || c.dataset.res === resF) && (mapF == null || c.dataset.map === String(mapF));
      c.hidden = !ok; if (ok) { shown++; c.classList.add('in'); }
    }
    const nm = root.querySelector('.bh-nomatch'); if (nm) nm.hidden = shown > 0;
    const sh = root.querySelector('.bh-shown');
    if (sh) sh.textContent = mapF == null && resF === 'all' ? '' : shown + (shown === 1 ? ' battle' : ' battles') + (mapF != null ? ' on map ' + mapF : '');
  }
  for (const b of $$('[data-rf]')) b.addEventListener('click', () => {
    resF = b.dataset.rf; $$('[data-rf]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); applyFilter();
  });
  for (const b of $$('[data-mapf]')) b.addEventListener('click', () => {
    const id = Number(b.dataset.mapf); mapF = mapF === id ? null : id;
    $$('[data-mapf]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.mapf) === mapF))); applyFilter();
  });

  function close() {
    timers.forEach((t) => win.clearTimeout(t));
    doc.removeEventListener('keydown', onKey, true);
    root.classList.remove('on');
    win.setTimeout(() => root.remove(), reduced ? 0 : 260);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (opts.onClose) opts.onClose();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'Tab') {   // keep focus inside the dialog
      const f = $$('button:not([disabled])').filter((x) => !x.closest('[hidden]'));
      if (!f.length) return;
      if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }
  doc.addEventListener('keydown', onKey, true);
  $$('[data-close]').forEach((x) => x.addEventListener('click', close));

  const finish = () => { root.classList.add('on'); $$('.bh-node, .bh-card').forEach((e) => e.classList.add('in')); };
  if (reduced) finish();
  else {
    win.requestAnimationFrame(() => root.classList.add('on'));
    // the record counts up
    at(200, () => $$('[data-count]').forEach((el) => {
      const to = Number(el.dataset.count) || 0, t0 = win.performance.now();
      const tick = () => { const k = Math.min(1, (win.performance.now() - t0) / 700); el.textContent = fmt(to * (1 - Math.pow(1 - k, 3))); if (k < 1) win.requestAnimationFrame(tick); };
      tick();
    }));
    $$('.bh-node').forEach((n, i) => at(260 + i * 55, () => n.classList.add('in')));
    $$('.bh-card').forEach((c, i) => at(i < 10 ? 520 + i * 70 : 520 + 10 * 70, () => c.classList.add('in')));
  }
  root.querySelector('.bh-x').focus({ preventScroll: true });
  return { root, close };
}
