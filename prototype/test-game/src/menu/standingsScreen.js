/**
 * src/menu/standingsScreen.js — STANDINGS, opened only aboard a capital ship [MM-task_mw9nm69a_3]. Owner 2026-11-09:
 * "a button that allow them to see a list of all faction characters and show the players rating with them, on this
 * same view there should be a faction tab that shows the players relationship with each faction. So players need to
 * visit capital ships to see this view."
 * Owner 2026-11-09: "When you check the friends list only show the faction of that capital ship not all characters. The
 * Faction tab shows all factions." → `faction` (the ship's registry key) limits CHARACTERS to that faction's cast.
 *
 * It is the Inventory screen's layout (inventoryScreen.js, the Mission Log's styles): tabs over a list of faction bands,
 * a detail pane for the selection. CHARACTERS: each faction's nine heroes with the player's rating; FACTIONS: each
 * faction's loyalty, tier and the way to the next tier. Data: save/standings.js. Html functions are pure.
 */
import { loadSave, updateSave } from '../save/save.js';
import { characterStandings, factionStandings, ensureRapport, LOYALTY_TIERS } from '../save/standings.js';
import { alignWord } from '../save/contracts.js';
import { ensureMissionStyle } from './missionLog.js';
import { esc, fsvg, factionColor } from './missionView.js';
import { portraitImg } from '../comm/commCard.js';

export const STANDING_TABS = Object.freeze([['characters', 'Characters'], ['factions', 'Factions']]);
const PORTRAITS = new URL('../../content/dialog/portraits/', import.meta.url).href;   // right from any page (game or review)
/** The rating colour per band (the Mission Log's status tokens). */
export const BAND_VAR = Object.freeze({ trusted: '--s-ready', allied: '--s-ready', friendly: '--cyan2', neutral: '--s-active', wary: '--s-risk', hostile: '--s-failed', unmet: '--s-locked' });
const ALIGN_NAME = Object.freeze({ AG: 'Absolute good', PG: 'Principled good', G: 'Good', CG: 'Chaotic good', N: 'Neutral', CE: 'Chaotic evil', E: 'Evil', PE: 'Principled evil', DE: 'Dark evil' });
const signed = (n) => (n > 0 ? '+' : '') + Math.round(n).toLocaleString('en-US');
const portrait = (name, cls, mood = null) => `<span class="${cls}">${portraitImg(name, mood, PORTRAITS)}</span>`;   // the rating's expression (angry / neutral / happy) when drawn

const STYLE = String.raw`
.bwm-ml .stand .rt{grid-template-columns:34px 1fr auto;border-top-color:var(--rc)}
.bwm-ml .stand .pt{width:34px;height:34px;display:block;background:#0b0e13;border:1px solid var(--line2);overflow:hidden}
.bwm-ml .stand .pt img{width:100%;height:100%;object-fit:cover;display:block}
.bwm-ml .stand .rt .rb{display:block;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--rc)}
.bwm-ml .stand .rt.unmet{opacity:.62}
.bwm-ml .stand .rts{grid-template-columns:repeat(3,1fr)}
.bwm-ml .stand .frow{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;width:100%;text-align:left;padding:10px 12px;background:#12161d}
.bwm-ml .stand .frow[aria-selected=true]{background:color-mix(in srgb,var(--fc) 14%,#12161d)}
.bwm-ml .stand .frow .bar{grid-column:1 / span 2;height:8px}
.bwm-ml .stand .frow b{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--rc)}
.bwm-ml .stand .rdet .bigpt{width:96px;height:96px;display:block;border:2px solid var(--rc);background:#0b0e13;overflow:hidden}
.bwm-ml .stand .rdet .bigpt img{width:100%;height:100%;object-fit:cover}
.bwm-ml .stand .rdet .rdn{color:var(--rc)}
.bwm-ml .stand .rdet .band{display:inline-block;margin-top:6px;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--rc)}
.bwm-ml .stand .rdet .dprog{margin:14px 0 2px}
@media (max-width:1180px){.bwm-ml .stand .rts{grid-template-columns:repeat(2,1fr)}}
@media (max-height:500px){.bwm-ml .log.stand{grid-template-columns:1fr 230px}.bwm-ml .stand .rts{grid-template-columns:repeat(2,1fr)}.bwm-ml .stand .rdet .bigpt{width:56px;height:56px}}
@media (max-width:700px){.bwm-ml .log.stand{grid-template-columns:1fr}.bwm-ml .stand .rts{grid-template-columns:1fr}}
`;

/** CHARACTERS: a band per faction, a tile per character with their rating. */
export function characterListHtml(groups, selected) {
  return groups.map((g) => `<section class="pband" style="--fc:${factionColor(g.key)}"><header>${fsvg(g.key)}<b>${esc(g.name)}</b><small>${esc(g.trope)}</small>
   <span class="pbt"><b class="num">${g.characters.filter((c) => c.met).length}</b> of ${g.characters.length} met</span></header>
   <div class="rts">${g.characters.map((c) => `<button class="rt${c.met ? '' : ' unmet'}" data-char="${esc(c.name)}" aria-selected="${c.name === selected}" style="--rc:var(${BAND_VAR[c.band.key]})">${portrait(c.name, 'pt', c.met ? c.mood : null)}
    <span class="rtx"><b>${esc(c.name)}</b><span class="rb">${c.band.label}</span></span><span class="rtn num">${c.met ? signed(c.score) : '—'}</span></button>`).join('')}</div></section>`).join('');
}

/** A loyalty bar from the last tier to the next (the Mission Log's continuous bar). */
function loyaltyBar(f, big = false) {
  // below zero the bar shows how far into hostility (full at -100); above, the way from the last tier to the next
  const hi = f.next == null ? Math.max(f.loyalty, f.prev || 1) : f.next;
  const pct = f.loyalty < 0 ? Math.round(100 * Math.min(1, -f.loyalty / 100)) : Math.round(100 * Math.max(0, Math.min(1, (f.loyalty - f.prev) / ((hi - f.prev) || 1))));
  return `<div class="bar cont${big ? ' big' : ''}" style="--sc:var(${BAND_VAR[f.band.key]})"><span class="fill" style="width:${pct}%"></span></div>`;
}

/** FACTIONS: one band holding a row per faction (loyalty, band, bar). */
export function factionListHtml(rows, selected) {
  return rows.map((f) => `<section class="pband" style="--fc:${factionColor(f.key)}"><header>${fsvg(f.key)}<b>${esc(f.name)}</b>
   <span class="pbt"><b class="num">${signed(f.loyalty)}</b> loyalty</span></header>
   <button class="frow" data-fac="${esc(f.key)}" aria-selected="${f.key === selected}" style="--rc:var(${BAND_VAR[f.band.key]})"><b>${f.band.label}</b>
    <small class="num">${f.next == null ? 'Highest tier' : `${(f.next - f.loyalty).toLocaleString('en-US')} to Tier ${f.tier + 1}`}</small>${loyaltyBar(f)}</button></section>`).join('');
}

export function characterDetailHtml(groups, selected) {
  const g = groups.find((x) => x.characters.some((c) => c.name === selected)) || groups[0];
  if (!g) return '';
  const c = g.characters.find((x) => x.name === selected) || g.characters[0];
  return `<button class="dback" data-sback>All characters</button>
  <div class="rdet" style="--rc:var(${BAND_VAR[c.band.key]});--fc:${factionColor(g.key)}">
   ${portrait(c.name, 'bigpt', c.met ? c.mood : null)}<div class="rdn num">${c.met ? signed(c.score) : '—'}</div><span class="band">${c.band.label}</span>
   <h2>${esc(c.name)}</h2><div class="rdt">${ALIGN_NAME[c.align] || esc(c.align)}</div>
   <dl><dt>Faction</dt><dd>${fsvg(g.key)}${esc(g.name)}</dd>
    <dt>Missions kept</dt><dd class="num">${c.kept}</dd><dt>Missions broken</dt><dd class="num">${c.broken}</dd>
    <dt>Visits</dt><dd class="num">${c.greets}</dd><dt>Trades</dt><dd class="num">${c.sales + c.purchases + (c.contracts || 0)}</dd>
    <dt>Wants</dt><dd>${esc(c.motivation) || '—'}</dd></dl>
   <p class="inote">${c.met ? 'Keeping the missions this character gives, visiting their ship and trading with them raise your rating; breaking or abandoning their missions lowers it.' : 'You have not dealt with this character yet.'}</p>
  </div>`;
}

export function factionDetailHtml(rows, selected, alignment) {
  const f = rows.find((x) => x.key === selected) || rows[0];
  if (!f) return '';
  return `<button class="dback" data-sback>All factions</button>
  <div class="rdet" style="--rc:var(${BAND_VAR[f.band.key]});--fc:${factionColor(f.key)}">
   <span class="gem2">${fsvg(f.key)}</span><div class="rdn num">${signed(f.loyalty)}</div><span class="band">${f.band.label}</span>
   <h2>${esc(f.name)}</h2><div class="rdt">Loyalty</div>
   <div class="dprog">${loyaltyBar(f, true)}</div>
   <dl><dt>Tier</dt><dd>${f.tier ? `Tier ${f.tier} of ${LOYALTY_TIERS.length}` : 'None yet'}</dd>
    <dt>Next tier</dt><dd class="num">${f.next == null ? 'Highest tier reached' : `Tier ${f.tier + 1} at ${f.next.toLocaleString('en-US')} (${(f.next - f.loyalty).toLocaleString('en-US')} to go)`}</dd>
    <dt>Rival</dt><dd>${esc(f.rival || '—')}</dd><dt>Characters met</dt><dd class="num">${f.metCount} of ${f.castCount}</dd>
    <dt>Your alignment</dt><dd>${alignWord(alignment || 0)}</dd></dl>
   <p class="inote">Loyalty rises when you keep this faction's missions and contracts, and falls when you break or decline them, or help its rival. Each tier opens more of its tech.</p>
  </div>`;
}

let packsP = null;
const loadPacks = () => packsP || (packsP = fetch(new URL('../../content/dialog/voicepacks.json', import.meta.url)).then((r) => r.json()).catch((e) => { packsP = null; throw e; }));

/** The STANDINGS screen in host (the ship view's root). → { open(), close(), isOpen(), dispose() } */
export function createStandingsScreen({ doc, host, onClose, faction = null }) {
  ensureMissionStyle(doc);
  if (!doc.getElementById('bwm-stand-style')) { const st = doc.createElement('style'); st.id = 'bwm-stand-style'; st.textContent = STYLE; doc.head.appendChild(st); }
  const wrap = doc.createElement('div'); wrap.className = 'bwm-ml bwm-stand';
  const el = doc.createElement('section');
  el.className = 'log inv stand'; el.setAttribute('aria-label', 'Standings');
  el.innerHTML = `<div class="lp"><div class="lp-head"><h1>STANDINGS</h1><div class="sum" data-sum></div></div>
   <div class="tabs" role="tablist" data-tabs></div><div class="list" data-list></div></div><div class="dp" data-dp></div>`;
  wrap.appendChild(el); host.appendChild(wrap);
  const $ = (q) => el.querySelector(q);
  let packs = null, loadError = null, tab = 'characters', selChar = null, selFac = null;

  function render() {
    $('[data-tabs]').innerHTML = STANDING_TABS.map(([k, n]) => `<button class="tab" role="tab" aria-selected="${k === tab}" data-stab="${k}">${n}</button>`).join('');
    if (!packs) { $('[data-list]').innerHTML = loadError ? `<div class="stale">Characters failed to load: ${esc(loadError.message || loadError)}</div>` : ''; $('[data-dp]').innerHTML = ''; return; }
    const s = loadSave();
    const rows = factionStandings(s, packs);
    // aboard a faction's ship the CHARACTERS tab is that faction's cast only (FACTIONS still lists every faction)
    const groups = characterStandings(s, packs).filter((g) => !faction || g.key === faction);
    const met = groups.reduce((a, g) => a + g.characters.filter((c) => c.met).length, 0), all = groups.reduce((a, g) => a + g.characters.length, 0);
    $('[data-sum]').innerHTML = `<b class="num">${met}</b> of ${all} met<br>Alignment <b>${alignWord(s.alignment || 0)}</b>`;
    if (tab === 'characters') {
      if (!groups.length) { $('[data-list]').innerHTML = `<div class="stale">No ratings are kept with this ship's crew.</div>`; $('[data-dp]').innerHTML = ''; return; }
      if (!selChar) selChar = (groups.flatMap((g) => g.characters).find((c) => c.met) || (groups[0] && groups[0].characters[0]) || {}).name;
      $('[data-list]').innerHTML = characterListHtml(groups, selChar);
      $('[data-dp]').innerHTML = characterDetailHtml(groups, selChar);
    } else {
      if (!selFac) selFac = (rows.slice().sort((a, b) => Math.abs(b.loyalty) - Math.abs(a.loyalty))[0] || {}).key;
      $('[data-list]').innerHTML = factionListHtml(rows, selFac);
      $('[data-dp]').innerHTML = factionDetailHtml(rows, selFac, s.alignment);
    }
  }
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.char) { selChar = t.dataset.char; render(); el.classList.add('detail'); }
    else if (t.dataset.fac) { selFac = t.dataset.fac; render(); el.classList.add('detail'); }
    else if (t.dataset.stab) { tab = t.dataset.stab; el.classList.remove('detail'); render(); }
    else if ('sback' in t.dataset) el.classList.remove('detail');
  });
  const isOpen = () => el.classList.contains('on');
  const onKey = (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    if (el.classList.contains('detail') && doc.defaultView.innerWidth <= 700) el.classList.remove('detail');
    else if (onClose) onClose();
  };
  doc.addEventListener('keydown', onKey);
  function open() {
    updateSave((s) => { ensureRapport(s); });
    el.classList.add('on');
    render();
    return loadPacks().then((p) => { packs = p; loadError = null; }, (e) => { loadError = e; console.error('[standings] voice packs failed to load', e); }).then(() => { if (isOpen()) render(); });
  }
  function close() { el.classList.remove('on', 'detail'); }
  function dispose() { doc.removeEventListener('keydown', onKey); wrap.remove(); }
  return { open, close, isOpen, dispose };
}
