/**
 * waveReport.js — the end-of-wave report (owner 2026-11-07: "we need to give the player a proper score with stars at
 * the end of each wave"; "I still don't get the damage report and star rating after each wave").
 *
 * Design: the SAME takeover as the map's final result (render/resultsScreen.js, owner 2026-11-07: "output UX needs to
 * follow the exact same design pattern and ux flow pattern as the rest of the game"). It mounts in the HUD's result
 * container, hides the battle HUD (`.bw-results-open`), keeps the battlefield as the blurred backdrop, and uses the
 * results screen's stylesheet, type pair, panels, gold corner ticks, reveal timeline, TAP TO SKIP and pinned action
 * bar. Only the content differs: a WAVE n plate, the five star conditions (earned or missed, with the number behind
 * each), the damage report, and what the wave collected. One action: CONTINUE, which hands back to the wave-end
 * sequence (reward pick → map reveal → dialog → next wave).
 *
 * Shown after every wave except the last, which the final result covers. Pure builders (waveReportModel,
 * waveReportHtml) for tests; mountWaveReport adds the timeline and the button.
 */
import { RESULTS_CSS } from './resultsScreen.js';
import { TIERS, TIER_COLOR, iconIdFor } from './resourceSummary.js';
import { resourceIconHtml } from '../data/resourceIcons.js';
import { ensureAaaFonts } from './uiTokens.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const sec = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1) + 's';

/**
 * The report's content. sc = the sim's waveStars event { wave, stars, flags[5], detail }; extra = what the view
 * counted this wave { kills, structuresLost, resources: { wave: closeWave() result, names } }.
 * → { wave, stars, rows:[{ok, label, value}], stats:[{label, value, count?}], resources: [{name, icon, units, color, pct}] }
 */
export function waveReportModel(sc, extra = {}) {
  const d = (sc && sc.detail) || {}, fl = (sc && sc.flags) || [];
  const core = d.core, hv = d.harvesters, p = d.common, pr = d.uncommon, t = d.time || {};
  const names = (extra.resources && extra.resources.names) || {};
  const lost = hv ? Math.max(0, hv.start - hv.alive) : 0;
  const rows = [
    { ok: !!fl[0], label: 'CORE UNDAMAGED', value: core ? (core.end >= core.start ? 'NO DAMAGE' : fmt(core.start - core.end) + ' DAMAGE') : '—' },
    { ok: !!fl[1], label: 'NO HARVESTERS LOST', value: hv ? (lost ? lost + ' LOST' : 'ALL ' + hv.start + ' SAFE') : '—' },
    { ok: !!fl[2], label: 'GATHER ' + String(names.common || 'common').toUpperCase(), value: p ? fmt(p.gathered) + ' / ' + fmt(p.need) : 'NONE ASKED' },
    { ok: !!fl[3], label: 'GATHER ' + String(names.uncommon || 'uncommon').toUpperCase(), value: pr ? fmt(pr.gathered) + ' / ' + fmt(pr.need) : 'NONE ASKED' },
    { ok: !!fl[4], label: 'BEAT PAR', value: t.par ? sec(t.sec) + ' / ' + sec(t.par) : sec(t.sec) },
  ];
  const stats = [
    { label: 'KILLS', value: fmt(extra.kills || 0), count: extra.kills || 0 },
    { label: 'STRUCTURES LOST', value: fmt(extra.structuresLost || 0), count: extra.structuresLost || 0 },
    { label: 'CORE', value: core ? Math.round((core.end / Math.max(1, core.max || core.start)) * 100) + '%' : '—' },
    { label: 'GOLD EARNED', value: '+' + fmt(d.gold || 0), count: d.gold || 0, plus: true },
  ];
  let resources = [];
  const r = extra.resources;
  if (r && r.wave && r.wave.units) {
    const names = r.names || {};
    const tiers = TIERS.filter((k) => r.wave.units[k] > 0);
    const max = Math.max(1, ...tiers.map((k) => r.wave.units[k]));
    resources = tiers.map((k) => ({ name: names[k] || k, icon: iconIdFor(names, k), units: r.wave.units[k], color: TIER_COLOR[k], pct: r.wave.units[k] / max * 100 }));
  }
  return { wave: (sc && sc.wave) || 0, stars: (sc && sc.stars) || 0, rows, stats, resources };
}

// the few rules the results stylesheet has no class for: a star-condition row, built from its reward-row grid
const WAVE_CSS = `
.rs-wr-stars { display:flex; justify-content:center; gap:.3em; margin-top:clamp(4px,1vmin,8px); font-size:clamp(20px,4.6vmin,36px); line-height:1; color:#3a4350; }
.rs-wr-stars span { opacity:0; transform:scale(.6); transition:opacity .25s, transform .35s cubic-bezier(.2,1.6,.4,1); }
.rs-wr-stars span.on { color:var(--gold-hi); text-shadow:0 0 14px rgba(242,200,105,.55); }
.rs.s1 .rs-wr-stars span { opacity:1; transform:none; }
.rs-cond { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:4px 12px; padding:6px 0; border-top:1px solid #1e252f;
  opacity:0; transform:translateX(-10px); transition:opacity .3s, transform .35s ease-out; }
.rs-cond:first-of-type { border-top:0; }
.rs-cond.in { opacity:1; transform:none; }
.rs-cond .ic { width:1.6em; text-align:center; font-size:1.1em; color:#4a5462; }
.rs-cond .l { font-weight:700; letter-spacing:.16em; color:#9aa6b4; }
.rs-cond .t { text-align:right; font-family:Orbitron,sans-serif; font-weight:800; font-size:.95em; letter-spacing:.04em; color:#6d7a8a; font-variant-numeric:tabular-nums; }
.rs-cond.ok .ic { color:var(--gold-hi); }
.rs-cond.ok .l { color:#e8eef5; }
.rs-cond.ok .t { color:var(--gold-hi); }
.rs-wr-stats { grid-template-columns:repeat(4,minmax(0,1fr)); margin-top:0; }
@media (max-width:420px) { .rs-wr-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (orientation:landscape) and (max-height:520px) { .rs-cond { padding:3px 0; } }
`;

/** The report's markup in its end state (the timeline only adds the `in` classes and the count-ups). Pure. */
export function waveReportHtml(m) {
  let h = '<div class="rs-scrim"></div><div class="rs-skip">TAP TO SKIP</div><div class="rs-body"><div class="rs-col">';
  h += '<div class="rs-verdict"><div class="rs-word">WAVE ' + m.wave + '</div><div class="rs-rule"></div>' +
    '<div class="rs-wr-stars" aria-label="' + m.stars + ' of 5 stars">' +
    [1, 2, 3, 4, 5].map((i) => '<span' + (i <= m.stars ? ' class="on"' : '') + '>★</span>').join('') + '</div>' +
    '<div class="rs-sub">CLEARED · <b>' + m.stars + ' OF 5 STARS</b></div></div>';
  h += '<div class="rs-panel" data-step="stars"><div class="rs-h"><span>STARS</span><span>' + m.stars + ' / 5</span></div>' +
    m.rows.map((r) => '<div class="rs-cond' + (r.ok ? ' ok' : '') + '"><span class="ic">' + (r.ok ? '★' : '✕') + '</span>' +
      '<span class="l">' + esc(r.label) + '</span><span class="t">' + esc(r.value) + '</span></div>').join('') + '</div>';
  h += '</div><div class="rs-col">';
  h += '<div class="rs-panel" data-step="damage"><div class="rs-h"><span>DAMAGE REPORT</span></div><div class="rs-stats rs-wr-stats">' +
    m.stats.map((s) => '<div class="rs-stat"><i>' + esc(s.label) + '</i><b>' +
      (s.count != null ? (s.plus ? '+' : '') + '<span data-count="' + s.count + '">' + fmt(s.count) + '</span>' : esc(s.value)) + '</b></div>').join('') + '</div></div>';
  h += '<div class="rs-panel" data-step="resources"><div class="rs-h"><span>RESOURCES</span><span>THIS WAVE</span></div>';
  if (!m.resources.length) h += '<div class="rs-none">Nothing was harvested this wave.</div>';
  for (const r of m.resources) {
    h += '<div class="rs-res" style="--c:' + r.color + ';--sold:' + r.pct.toFixed(1) + '%;--kept:0%">' +
      '<div class="n">' + (r.icon ? resourceIconHtml(r.icon, 'ic') : '<span class="d"></span>') + '<span>' + esc(r.name) + '</span></div>' +
      '<div class="q">+<span data-count="' + r.units + '">' + fmt(r.units) + '</span></div>' +
      '<div class="rs-bar"><span class="sold"></span><span class="kept"></span></div></div>';
  }
  h += '</div></div></div><div class="rs-act"><button class="rs-btn primary" data-act="continue">Continue</button></div>';
  return h;
}

/** Count a number up from 0 over `ms` (ease-out), as the results screen does. */
function countUp(el, ms, now) {
  const to = Number(el.dataset.count) || 0, t0 = now();
  const tick = () => {
    const k = Math.min(1, (now() - t0) / ms);
    el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1 && !el._rsStop) el._rsRaf = requestAnimationFrame(tick);
  };
  tick();
}

/**
 * The takeover's shell, shared by every report on the results screen's pattern (the wave report, the outpost's away
 * report): its stylesheets, the root, TAP TO SKIP (a tap anywhere but a button shows the end state), CONTINUE, and the
 * end state. play({ at, $, $$, now, root, finish }) schedules the reveal. → { root, finish, dispose }.
 */
function mountReport(host, className, html, onContinue, opts, play) {
  const doc = host.ownerDocument;
  if (!doc.getElementById('rs-css')) { const st = doc.createElement('style'); st.id = 'rs-css'; st.textContent = RESULTS_CSS; doc.head.appendChild(st); }
  if (!doc.getElementById('rs-wr-css')) { const st = doc.createElement('style'); st.id = 'rs-wr-css'; st.textContent = WAVE_CSS; doc.head.appendChild(st); }
  ensureAaaFonts(doc);
  host.innerHTML = '';
  const root = doc.createElement('div');
  root.className = className;
  root.innerHTML = html;
  host.appendChild(root);
  const win = doc.defaultView;
  const now = () => (win.performance ? win.performance.now() : Date.now());
  const reduced = opts.reduced || !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const timers = [];
  const at = (ms, fn) => timers.push(win.setTimeout(fn, ms));
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach((t) => win.clearTimeout(t));
    for (const el of $$('[data-count]')) { el._rsStop = true; if (el._rsRaf) cancelAnimationFrame(el._rsRaf); el.textContent = fmt(Number(el.dataset.count)); }
    root.classList.add('on', 's1', 'done');
    $$('.rs-panel, .rs-cond, .rs-res, .rs-act').forEach((e) => e.classList.add('in'));
  };
  $('[data-act="continue"]').addEventListener('click', (e) => { e.stopPropagation(); finish(); if (onContinue) onContinue(); });
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-act]')) finish(); });
  if (reduced) finish();
  else {
    win.requestAnimationFrame(() => root.classList.add('on'));
    at(150, () => root.classList.add('s1'));
    play({ at, $, $$, now, root, finish });
  }
  return { root, finish, dispose() { finish(); host.innerHTML = ''; } };
}

/**
 * Mount the report into `host` (the HUD's result container) and play the reveal; onContinue runs on CONTINUE.
 * → { root, finish, dispose }. opts.reduced forces the end state (tests, reduced motion).
 */
export function mountWaveReport(host, model, onContinue, opts = {}) {
  return mountReport(host, 'rs rs-wave-report', waveReportHtml(model), onContinue, opts, ({ at, $, $$, now, finish }) => {
    // the reveal, in reading order (≈ 2.5 s): plate → stars → damage → resources → CONTINUE
    let t = 650;
    const stars = $('[data-step="stars"]');
    at(t, () => stars.classList.add('in'));
    $$('.rs-cond').forEach((r, i) => at(t + 100 + i * 140, () => r.classList.add('in')));
    t += 100 + 5 * 140 + 150;
    const dmg = $('[data-step="damage"]');
    at(t, () => { dmg.classList.add('in'); dmg.querySelectorAll('[data-count]').forEach((el) => countUp(el, 800, now)); });
    t += 450;
    const res = $('[data-step="resources"]');
    at(t, () => res.classList.add('in'));
    $$('.rs-res').forEach((r, i) => at(t + 80 + i * 140, () => { r.classList.add('in'); r.querySelectorAll('[data-count]').forEach((el) => countUp(el, 650, now)); }));
    t += 80 + $$('.rs-res').length * 140 + 300;
    at(t, () => $('.rs-act').classList.add('in'));
    at(t + 600, finish);
  });
}

// ── the outpost's AWAY REPORT (spec docs/16 Bulwark MM/design/Outpost-AAA-UX.md §6, D5) [MM-story_mwcuyrqr_3j] ──────
// The same takeover as the wave report, fed by outpost/view/awayReport.js awayReportModel: a plate (OUTPOST · while you
// were away), what was mined and gathered, the raids, what finished, one CONTINUE. Nothing about pods or the Pod Reward
// Chest, ever (owner rule): the model carries none, and this markup has no slot for it.
/** The away report's markup in its end state. m: awayReportModel(...) (show true). Pure. */
export function awayReportHtml(m) {
  const extracted = [...(m.extracted || []).map((x) => ({ name: x.name, colour: x.colour, units: x.units, icon: null })),
    ...(m.harvested || []).map((x) => ({ name: x.name, colour: x.colour, units: x.units, icon: x.icon || null }))];
  const max = Math.max(1, ...extracted.map((x) => x.units));
  let h = '<div class="rs-scrim"></div><div class="rs-skip">TAP TO SKIP</div><div class="rs-body"><div class="rs-col">';
  h += '<div class="rs-verdict"><div class="rs-word">OUTPOST</div><div class="rs-rule"></div>' +
    '<div class="rs-sub">WHILE YOU WERE AWAY · <b>' + esc(String(m.away || '').toUpperCase()) + '</b>' + (m.capped ? ' · <b>72 H MAX</b>' : '') + '</div></div>';
  h += '<div class="rs-panel" data-step="extracted"><div class="rs-h"><span>EXTRACTED</span><span>INTO STORAGE</span></div>';
  if (!extracted.length) h += '<div class="rs-none">Nothing was mined or gathered.</div>';
  for (const r of extracted) {
    h += '<div class="rs-res" style="--c:' + esc(r.colour || '#cfd6de') + ';--sold:' + (r.units / max * 100).toFixed(1) + '%;--kept:0%">' +
      '<div class="n">' + (r.icon ? resourceIconHtml(r.icon, 'ic') : '<span class="d"></span>') + '<span>' + esc(r.name) + '</span></div>' +
      '<div class="q">+<span data-count="' + r.units + '">' + fmt(r.units) + '</span></div>' +
      '<div class="rs-bar"><span class="sold"></span><span class="kept"></span></div></div>';
  }
  h += '</div></div><div class="rs-col">';
  const raids = m.raids || [];
  h += '<div class="rs-panel" data-step="raids"><div class="rs-h"><span>RAIDS</span><span>' + (raids.length ? (m.held || 0) + ' HELD · ' + (m.breached || 0) + ' BROKE THROUGH' : 'NONE') + '</span></div>';
  if (!raids.length) h += '<div class="rs-none">No raids while you were away.</div>';
  for (const r of raids) {
    const ok = r.result !== 'breach';
    h += '<div class="rs-cond' + (ok ? ' ok' : '') + '"><span class="ic">' + (ok ? '★' : '✕') + '</span>' +
      '<span class="l">' + esc(r.label.toUpperCase()) + '</span><span class="t">' + esc(r.when.toUpperCase()) + (r.lostText ? ' · ' + esc(r.lostText.toUpperCase()) : '') + '</span></div>';
  }
  if (m.bounty) h += '<div class="rs-cond ok"><span class="ic">◆</span><span class="l">RAID BOUNTY</span><span class="t">+<span data-count="' + m.bounty + '">' + fmt(m.bounty) + '</span> GOLD</span></div>';
  h += '</div>';
  const built = m.built || [], notes = [];
  if (m.full) notes.push(m.full + (m.full === 1 ? ' Mining Station bay filled' : ' Mining Station bays filled') + ' · sell to resume');
  if (m.hopperFull) notes.push('The Resource Bay\'s hopper filled');
  if (built.length || notes.length) {
    h += '<div class="rs-panel" data-step="built"><div class="rs-h"><span>OUTPOST</span><span>' + built.length + ' FINISHED</span></div>';
    for (const b of built) h += '<div class="rs-cond ok"><span class="ic">▣</span><span class="l">' + esc(b.toUpperCase()) + '</span><span class="t"></span></div>';
    for (const n of notes) h += '<div class="rs-cond"><span class="ic">!</span><span class="l">' + esc(n.toUpperCase()) + '</span><span class="t"></span></div>';
    h += '</div>';
  }
  h += '</div></div><div class="rs-act"><button class="rs-btn primary" data-act="continue">Continue</button></div>';
  return h;
}

/** Mount the away report (hud.js showAwayReport) and play its reveal: plate → extracted → raids → outpost → CONTINUE. */
export function mountAwayReport(host, model, onContinue, opts = {}) {
  return mountReport(host, 'rs rs-away-report', awayReportHtml(model), onContinue, opts, ({ at, $, $$, now, finish }) => {
    let t = 600;
    for (const p of $$('.rs-panel')) {
      at(t, () => p.classList.add('in'));
      const rows = [...p.querySelectorAll('.rs-res, .rs-cond')];
      rows.forEach((r, i) => at(t + 100 + i * 130, () => { r.classList.add('in'); r.querySelectorAll('[data-count]').forEach((el) => countUp(el, 650, now)); }));
      t += 100 + rows.length * 130 + 200;
    }
    at(t, () => $('.rs-act').classList.add('in'));
    at(t + 600, finish);
  });
}

