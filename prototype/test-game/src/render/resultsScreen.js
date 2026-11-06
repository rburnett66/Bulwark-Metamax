/**
 * src/render/resultsScreen.js — the map's final result: a full-screen, animated after-action report
 * [MM-story_mw15hyvl_2].
 *
 * Owner 2026-11-03: "Redesign the final results screen to look hyper AAA polished with animated presentation that
 * works for mobile and PC." The old overlay stacked loose panels over the live HUD, and on a phone held sideways the
 * score line ran into the top bar and the build panel covered the resource table.
 *
 * Design (direction lives here, so the next change starts from it):
 * - A takeover. The battle HUD is hidden (`.bw-results-open` on the HUD root) and the 3D battlefield stays behind a
 *   dark, blurred scrim, so the board the player just fought on is the backdrop.
 * - One memorable element: the VERDICT PLATE. The word arrives with a slam, and a single light sweep crosses it.
 *   Victory is Powder Gold (#D9A441, the game's "done + paid off" colour); defeat is ember red. Everything else is
 *   quiet: square corners, hairline panel borders, gold corner ticks (as the Mission Log), cyan only for XP / kept.
 * - Reading order is the order the player cares about: verdict → how each wave went → score → what was earned →
 *   what was harvested → what to do next. The reveal plays in that order once (about 3.5 s); a tap anywhere skips
 *   to the end, and prefers-reduced-motion shows the end state at once.
 * - Layout: two columns (performance | earnings) when the screen is wide or a phone is sideways; one scrolling
 *   column on a phone held upright. The actions bar is pinned to the bottom in every layout, so the next move never
 *   scrolls away. Type sizes scale with the viewport (clamp on vmin), so a 390 px tall landscape phone fits whole.
 * - Type: Orbitron for the verdict and the big numbers, Rajdhani for everything else (the Tech Net's pair).
 *
 * Pure HTML builders (resultsModel, resultsHtml) for tests and the standalone review page; mountResults adds the
 * timeline and the button wiring.
 */
import { TIERS, TIER_COLOR, iconIdFor } from './resourceSummary.js';
import { resourceIconHtml } from '../data/resourceIcons.js';
import { levelFromXp } from '../data/progression.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const pad2 = (n) => String(n || 0).padStart(2, '0');

export const RESULTS_CSS = `
.rs { position:absolute; inset:0; z-index:60; display:flex; flex-direction:column; justify-content:center; pointer-events:auto; overflow:hidden;
  font-family:Rajdhani,"Segoe UI",system-ui,sans-serif; color:#dfe7ef; -webkit-font-smoothing:antialiased;
  --gold:#D9A441; --gold-hi:#f2c869; --ink:#0b0f16; --line:#2a3340; --steel:#8A97A8; --cyan:#7af0ff; --ember:#e0533d;
  --acc:var(--gold); --acc-hi:var(--gold-hi); --fs:clamp(12px, 2.1vmin, 16px); font-size:var(--fs); }
.rs.lose { --acc:var(--ember); --acc-hi:#ff8a6a; }
.rs * { box-sizing:border-box; }
.rs-scrim { position:absolute; inset:0; background:radial-gradient(120% 90% at 50% 35%, rgba(10,14,22,.62), rgba(4,6,10,.94) 70%);
  -webkit-backdrop-filter:blur(7px) saturate(.7); backdrop-filter:blur(7px) saturate(.7); opacity:0; transition:opacity .45s ease-out; }
.rs.on .rs-scrim { opacity:1; }
.rs-body { position:relative; flex:0 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain;
  display:grid; grid-template-columns:1fr; gap:clamp(10px,2.4vmin,22px); align-content:start;
  padding:max(14px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left));
  width:100%; max-width:1080px; margin:0 auto; }
.rs-col { display:flex; flex-direction:column; gap:clamp(8px,1.8vmin,16px); min-width:0; }
@media (min-width:820px), (orientation:landscape) and (min-width:560px) {
  .rs-body { grid-template-columns:minmax(0,1.05fr) minmax(0,1fr); align-content:center; }
}

/* verdict plate */
.rs-verdict { position:relative; text-align:center; padding:clamp(6px,1.6vmin,14px) 0 clamp(4px,1vmin,10px); }
.rs-word { font-family:Orbitron,Rajdhani,sans-serif; font-weight:900; line-height:1.05; letter-spacing:.14em; padding-left:.14em;
  font-size:clamp(34px, 9.5vmin, 86px); display:inline-block;
  /* the light sweep is a bright band in the fill itself, so nothing paints outside the letters */
  color:transparent; background:linear-gradient(105deg, transparent 0 42%, #fff8e0 50%, transparent 58% 100%) 120% 0 / 260% 100% no-repeat var(--acc);
  -webkit-background-clip:text; background-clip:text;
  filter:drop-shadow(0 0 18px color-mix(in srgb, var(--acc) 50%, transparent)) drop-shadow(0 3px 0 rgba(0,0,0,.55));
  opacity:0; transform:scale(1.35); letter-spacing:.4em; }
.rs.s1 .rs-word { opacity:1; transform:scale(1); letter-spacing:.14em; transition:transform .5s cubic-bezier(.2,1.4,.4,1), letter-spacing .6s cubic-bezier(.2,1,.3,1), opacity .2s;
  animation:rs-sweep 1.2s .45s ease-in-out 1 both; }
@keyframes rs-sweep { from { background-position:120% 0; } to { background-position:-20% 0; } }
.rs-rule { height:2px; margin:clamp(6px,1.4vmin,12px) auto 0; width:0; max-width:420px;
  background:linear-gradient(90deg, transparent, var(--acc-hi), transparent); transition:width .7s .25s ease-out; }
.rs.s1 .rs-rule { width:70%; }
.rs-sub { margin-top:clamp(4px,1vmin,8px); font-size:1.05em; font-weight:600; letter-spacing:.18em; color:var(--steel);
  opacity:0; transform:translateY(6px); transition:opacity .4s .35s, transform .4s .35s; }
.rs.s1 .rs-sub { opacity:1; transform:none; }
.rs-sub b { color:#e8eef5; font-weight:700; }

/* panels */
.rs-panel { position:relative; background:linear-gradient(180deg, rgba(20,26,36,.86), rgba(12,16,23,.9)); border:1px solid var(--line);
  padding:clamp(8px,1.8vmin,16px) clamp(10px,2.2vmin,18px); opacity:0; transform:translateY(10px); transition:opacity .4s, transform .45s cubic-bezier(.2,1,.3,1); }
.rs-panel::before, .rs-panel::after { content:""; position:absolute; width:22px; height:22px; pointer-events:none; }
.rs-panel::before { left:-1px; top:-1px; border-left:2px solid var(--acc); border-top:2px solid var(--acc); }
.rs-panel::after { right:-1px; bottom:-1px; border-right:2px solid var(--acc); border-bottom:2px solid var(--acc); }
.rs-panel.in { opacity:1; transform:none; }
.rs-h { font-size:.78em; font-weight:700; letter-spacing:.32em; color:var(--steel); margin-bottom:clamp(6px,1.2vmin,10px); display:flex; justify-content:space-between; gap:8px; }
.rs-h span:last-child { letter-spacing:.12em; }

/* waves */
.rs-waves { display:grid; grid-template-columns:repeat(var(--n,8), minmax(0,1fr)); gap:4px; }
.rs-wave { text-align:center; padding:5px 0 4px; background:rgba(255,255,255,.03); border:1px solid #222a35;
  opacity:0; transform:translateY(8px) scale(.9); transition:opacity .25s, transform .35s cubic-bezier(.2,1.5,.4,1); }
.rs-wave.in { opacity:1; transform:none; }
.rs-wave i { display:block; font-style:normal; font-size:.72em; letter-spacing:.14em; color:#6d7a8a; }
.rs-wave b { font-family:Orbitron,sans-serif; font-size:1.25em; color:var(--gold-hi); }
.rs-wave.five { border-color:var(--gold); box-shadow:inset 0 0 12px rgba(217,164,65,.25); }
.rs-wave.low b { color:#9aa6b4; }
.rs-pips { display:flex; justify-content:center; gap:1px; margin-top:2px; font-size:.62em; letter-spacing:0; color:#3a4350; }
.rs-pips .on { color:var(--gold-hi); }

/* score + stats */
.rs-score { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.rs-big { font-family:Orbitron,sans-serif; font-weight:800; font-size:clamp(26px,6.4vmin,52px); line-height:1; color:#f4f7fb; font-variant-numeric:tabular-nums; }
.rs-big small { display:block; font-family:Rajdhani,sans-serif; font-size:clamp(10px,1.6vmin,13px); letter-spacing:.32em; color:var(--steel); font-weight:700; margin-bottom:4px; }
.rs-avg { text-align:right; }
.rs-avg .rs-big { color:var(--gold-hi); }
.rs-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:clamp(8px,1.6vmin,12px); }
.rs-stat { border-top:1px solid #232b36; padding-top:5px; }
.rs-stat i { display:block; font-style:normal; font-size:.74em; letter-spacing:.24em; color:#6d7a8a; }
.rs-stat b { font-size:1.3em; font-weight:700; color:#e8eef5; font-variant-numeric:tabular-nums; }

/* rewards */
.rs-rw { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:4px 12px; padding:6px 0; border-top:1px solid #1e252f;
  opacity:0; transform:translateX(-10px); transition:opacity .3s, transform .35s ease-out; }
.rs-rw:first-of-type { border-top:0; }
.rs-rw.in { opacity:1; transform:none; }
.rs-rw .ic { width:1.6em; text-align:center; font-size:1.2em; }
.rs-rw .v { font-family:Orbitron,sans-serif; font-weight:800; font-size:clamp(16px,3.4vmin,26px); font-variant-numeric:tabular-nums; }
.rs-rw .t { text-align:right; font-size:.86em; font-weight:600; letter-spacing:.14em; color:var(--steel); }
.rs-rw.g .ic, .rs-rw.g .v { color:var(--gold-hi); }
.rs-rw.s .ic, .rs-rw.s .v { color:#ffe08a; }
.rs-rw.x .ic, .rs-rw.x .v { color:var(--cyan); }
.rs-xbar { grid-column:2 / 4; height:6px; background:#0a0d12; border:1px solid #263142; position:relative; overflow:hidden; }
.rs-xbar i { position:absolute; left:0; top:0; bottom:0; width:var(--from,0%); background:linear-gradient(90deg,#1f8fbf,var(--cyan)); box-shadow:0 0 8px #34e1ff;
  transition:width 1s cubic-bezier(.3,.9,.3,1); }
.rs-xbar.in i { width:var(--to,0%); }
.rs-up { grid-column:1 / 4; text-align:center; font-family:Orbitron,sans-serif; font-weight:800; letter-spacing:.24em; font-size:.95em; color:var(--cyan);
  text-shadow:0 0 14px #34e1ff; opacity:0; transform:scale(.8); transition:opacity .3s, transform .4s cubic-bezier(.2,1.6,.4,1); padding-top:4px; }
.rs-rw.in .rs-up { opacity:1; transform:none; transition-delay:.9s; }

/* resources */
.rs-res { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:2px 12px; padding:6px 0; border-top:1px solid #1e252f;
  opacity:0; transition:opacity .3s; }
.rs-res:first-of-type { border-top:0; }
.rs-res.in { opacity:1; }
.rs-res .n { display:flex; align-items:center; gap:8px; font-weight:700; font-size:1.08em; color:#e8eef5; min-width:0; }
.rs-res .n span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rs-res .ic { width:clamp(22px,4vmin,34px); height:clamp(22px,4vmin,34px); flex:0 0 auto; border-radius:3px; box-shadow:0 0 0 1px var(--c), 0 0 12px color-mix(in srgb, var(--c) 45%, transparent); }
.rs-res .d { width:9px; height:9px; flex:0 0 9px; background:var(--c); box-shadow:0 0 8px var(--c); transform:rotate(45deg); }
.rs-res .q { align-self:center; font-family:Orbitron,sans-serif; font-weight:800; font-size:1.15em; text-align:right; font-variant-numeric:tabular-nums; color:#f4f7fb; }
.rs-bar { grid-column:1 / 3; display:flex; height:7px; background:#0a0d12; border:1px solid #222a35; overflow:hidden; }
.rs-bar .sold { width:0; background:var(--c); opacity:.85; transition:width .8s cubic-bezier(.3,.9,.3,1); }
.rs-bar .kept { width:0; background:repeating-linear-gradient(135deg, var(--cyan) 0 4px, #2aa8c0 4px 7px); box-shadow:0 0 8px rgba(122,240,255,.6);
  transition:width .6s .55s cubic-bezier(.3,.9,.3,1); }
.rs-res.in .sold { width:var(--sold); } .rs-res.in .kept { width:var(--kept); }
.rs-res .m { grid-column:1 / 3; font-size:.8em; letter-spacing:.14em; color:#6d7a8a; display:flex; justify-content:space-between; }
.rs-res .m b { color:var(--cyan); font-weight:700; }
.rs-foot { margin-top:6px; text-wrap:balance; font-size:.78em; letter-spacing:.2em; color:#6d7a8a; text-align:center; }
.rs-foot b { color:var(--gold-hi); font-weight:700; }
.rs-note { display:grid; gap:2px; padding:3px 0; }
.rs-note + .rs-note { border-top:1px solid var(--line); padding-top:7px; margin-top:4px; }
.rs-note b { font-size:.72em; letter-spacing:.24em; color:var(--gold-hi); }
.rs-note.signal b { color:#8fd3ff; }
.rs-note span { font-size:.9em; color:#d6dce4; text-wrap:pretty; }
.rs-none { color:#6d7a8a; letter-spacing:.14em; text-align:center; padding:6px 0; }

/* actions */
.rs-act { position:relative; flex:0 0 auto; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;
  padding:10px max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  opacity:0; transform:translateY(16px); transition:opacity .35s, transform .4s cubic-bezier(.2,1,.3,1); }
.rs-act.in { opacity:1; transform:none; }
.rs-btn { font-family:Rajdhani,sans-serif; font-weight:700; font-size:1.05em; letter-spacing:.2em; min-height:44px; padding:0 clamp(14px,3vmin,26px);
  color:#dfe7ef; background:rgba(20,26,36,.9); border:1px solid #3a4655; cursor:pointer; text-transform:uppercase; }
.rs-btn:hover { border-color:#6b7a8c; color:#fff; }
.rs-btn:focus-visible { outline:2px solid var(--cyan); outline-offset:2px; }
.rs-btn.primary { color:#1a1206; border-color:var(--gold-hi); background:linear-gradient(180deg, #f6d27e, #D9A441 55%, #b9852c); box-shadow:0 0 0 rgba(242,200,105,0); }
.rs.lose .rs-btn.primary { color:#fff; border-color:#ff8a6a; background:linear-gradient(180deg, #f07a5c, #c9452f 60%, #9e3322); }
.rs-act.in .rs-btn.primary { animation:rs-glow 1.6s .3s ease-out 1; }
@keyframes rs-glow { 0% { box-shadow:0 0 0 rgba(242,200,105,0); } 40% { box-shadow:0 0 26px rgba(242,200,105,.7); } 100% { box-shadow:0 0 0 rgba(242,200,105,0); } }
.rs-btn.primary:first-child:not(:only-child) { flex:0 1 auto; }
@media (max-width:560px) { .rs-act { background:linear-gradient(180deg, rgba(5,7,11,0), rgba(5,7,11,.88) 35%); } .rs-btn { flex:1 1 0; } .rs-btn.primary:first-child:not(:last-child) { flex:1 1 100%; } }
.rs-btn .sub { display:block; font-size:.7em; letter-spacing:.14em; opacity:.75; font-weight:600; text-transform:none; margin-top:-2px; }
.rs-skip { position:absolute; right:max(14px, env(safe-area-inset-right)); top:max(10px, env(safe-area-inset-top)); font-size:.75em; letter-spacing:.24em; color:#6d7a8a; opacity:.8; }
.rs.done .rs-skip { display:none; }

/* landscape phone: tighter vertical rhythm so the whole report fits a ~390 px tall screen */
@media (orientation:landscape) and (max-height:520px) {
  .rs-verdict { padding:2px 0 0; }
  .rs-word { font-size:clamp(28px, 10vh, 52px); }
  .rs-panel { padding:7px 12px; }
  .rs-stats { margin-top:6px; }
  .rs-rw { padding:3px 0; }
  .rs-res { padding:3px 0; }
  .rs-res .ic { width:22px; height:22px; }
  .rs-res .n { font-size:1em; gap:6px; } .rs-res .m { font-size:.74em; } .rs-foot { margin-top:2px; }
  .rs-body { gap:8px; } .rs-col { gap:6px; }
  .rs-act { padding-top:6px; }
  .rs-btn { min-height:40px; }
}
@media (prefers-reduced-motion: reduce) {
  .rs *, .rs *::before, .rs *::after { transition:none !important; animation:none !important; }
}
.bw-hud.bw-results-open > *:not(.bw-result) { visibility:hidden !important; }
`;

/** Everything the report shows, from the battle's own records. Pure. */
export function resultsModel({ result, finalScore, waveStars, rewards = null, resources = null, nextMap = null, planet = '', mapId = null, mapName = '', notes = [] }) {
  const fs = finalScore || {};
  const stars = (Array.isArray(waveStars) ? waveStars : []).map((w) => (typeof w === 'number' ? w : (w && w.stars) || 0));
  const avg = stars.length ? Math.round(stars.reduce((a, b) => a + b, 0) / stars.length * 10) / 10 : 0;
  let rw = null;
  if (rewards) {
    const L0 = levelFromXp(rewards.xp.from), L1 = levelFromXp(rewards.xp.to);
    rw = {
      gold: rewards.result === 'win' ? rewards.gold.earned : 0, bank: rewards.gold.to,
      starsNew: Math.max(0, rewards.stars.to - rewards.stars.from), starsTotal: rewards.stars.to,
      xp: rewards.xp.earned, level: L1.level, title: L1.title, rankUp: L1.level > L0.level,
      xpFrom: L1.level > L0.level ? 0 : L0.frac * 100, xpTo: L1.frac * 100,
    };
  }
  let res = null;
  if (resources && resources.total) {
    const t = resources.total, names = resources.names || {};
    const rows = TIERS.filter((k) => t.units[k] > 0).map((k) => ({ tier: k, name: names[k] || k, icon: iconIdFor(names, k), units: t.units[k], sold: t.sold[k], kept: t.kept[k], color: TIER_COLOR[k] }));
    const max = Math.max(1, ...rows.map((r) => r.units));
    res = { rows: rows.map((r) => ({ ...r, soldPct: r.sold / max * 100, keptPct: r.kept / max * 100 })), contract: !!resources.contract, gold: t.gold,
      kept: rows.reduce((a, r) => a + r.kept, 0) };
  }
  return {
    win: result === 'win', planet, mapId, mapName, time: pad2(fs.minutes) + ':' + pad2(fs.seconds),
    score: fs.score || 0, kills: fs.kills || 0, goldLeft: fs.goldRemaining || 0, stars, avg, rewards: rw, resources: res,
    nextMap: result === 'win' && nextMap ? { label: nextMap.name || ('Map ' + nextMap.id), size: nextMap.size || '' } : null,
    // what this battle opened or settled beyond the map: [{ kind: 'signal' | 'contract', head, text }] (Content-Reveal §6)
    notes: (notes || []).filter((n) => n && n.text),
  };
}

const pips = (n) => '<span class="rs-pips">' + [1, 2, 3, 4, 5].map((i) => '<span' + (i <= n ? ' class="on"' : '') + '>◆</span>').join('') + '</span>';

/** The report's markup, in its end state (the timeline only adds the `in` classes and the count-ups). Pure. */
export function resultsHtml(m) {
  const where = [m.planet, m.mapId ? 'Map ' + m.mapId : '', m.mapName].filter(Boolean).map(esc).join(' · ');
  let h = '<div class="rs-scrim"></div><div class="rs-skip">TAP TO SKIP</div><div class="rs-body"><div class="rs-col">';
  h += '<div class="rs-verdict"><div class="rs-word">' + (m.win ? 'VICTORY' : 'DEFEAT') + '</div><div class="rs-rule"></div>' +
    '<div class="rs-sub">' + (where ? '<b>' + where + '</b> · ' : '') + m.time + '</div></div>';
  if (m.stars.length) {
    h += '<div class="rs-panel" data-step="waves"><div class="rs-h"><span>WAVE STARS</span><span>OUT OF 5</span></div><div class="rs-waves" style="--n:' + m.stars.length + '">' +
      m.stars.map((n, i) => '<div class="rs-wave' + (n >= 5 ? ' five' : n <= 2 ? ' low' : '') + '"><i>W' + (i + 1) + '</i><b>' + n + '</b>' + pips(n) + '</div>').join('') + '</div></div>';
  }
  h += '<div class="rs-panel" data-step="score"><div class="rs-score"><div class="rs-big"><small>SCORE</small><span data-count="' + m.score + '">' + fmt(m.score) + '</span></div>' +
    '<div class="rs-avg rs-big"><small>AVERAGE</small><span data-count="' + m.avg + '" data-dec="1">' + m.avg.toFixed(1) + '</span>★</div></div>' +
    '<div class="rs-stats"><div class="rs-stat"><i>KILLS</i><b data-count="' + m.kills + '">' + fmt(m.kills) + '</b></div>' +
    '<div class="rs-stat"><i>TIME</i><b>' + m.time + '</b></div><div class="rs-stat"><i>GOLD LEFT</i><b data-count="' + m.goldLeft + '">' + fmt(m.goldLeft) + '</b></div></div></div>';
  h += '</div><div class="rs-col">';
  if (m.rewards) {
    const r = m.rewards;
    h += '<div class="rs-panel" data-step="rewards"><div class="rs-h"><span>REWARDS</span></div>' +
      '<div class="rs-rw g"><span class="ic">◆</span><span class="v">' + (r.gold ? '+<span data-count="' + r.gold + '">' + fmt(r.gold) + '</span>' : '—') + '</span><span class="t">' + (r.gold ? 'GOLD BANKED' : 'BANK UNCHANGED') + ' · ' + fmt(r.bank) + '</span></div>' +
      '<div class="rs-rw s"><span class="ic">★</span><span class="v">' + (r.starsNew ? '+' + r.starsNew : '—') + '</span><span class="t">' + (r.starsNew ? 'NEW BEST STARS' : 'NO NEW BEST') + ' · ' + r.starsTotal + ' TOTAL</span></div>' +
      '<div class="rs-rw x"><span class="ic">⬢</span><span class="v">+<span data-count="' + r.xp + '">' + fmt(r.xp) + '</span></span><span class="t">XP · LV ' + r.level + ' ' + esc(String(r.title).toUpperCase()) + '</span>' +
      '<div class="rs-xbar" style="--from:' + r.xpFrom.toFixed(1) + '%;--to:' + r.xpTo.toFixed(1) + '%"><i></i></div>' +
      (r.rankUp ? '<div class="rs-up">RANK UP · ' + esc(String(r.title).toUpperCase()) + '</div>' : '') + '</div></div>';
  }
  if (m.resources) {
    const x = m.resources;
    h += '<div class="rs-panel" data-step="resources"><div class="rs-h"><span>RESOURCES</span><span>' + (x.contract ? 'SOLD · KEPT' : 'COLLECTED') + '</span></div>';
    if (!x.rows.length) h += '<div class="rs-none">Nothing was harvested this battle.</div>';
    for (const r of x.rows) {
      h += '<div class="rs-res" style="--c:' + r.color + ';--sold:' + (x.contract ? r.soldPct : r.soldPct + r.keptPct).toFixed(1) + '%;--kept:' + (x.contract ? r.keptPct : 0).toFixed(1) + '%">' +
        '<div class="n">' + (r.icon ? resourceIconHtml(r.icon, 'ic') : '<span class="d"></span>') + '<span>' + esc(r.name) + '</span></div><div class="q" data-count="' + r.units + '">' + fmt(r.units) + '</div>' +
        '<div class="rs-bar"><span class="sold"></span><span class="kept"></span></div>' +
        (x.contract ? '<div class="m"><span>SOLD ' + fmt(r.sold) + '</span><span>' + (r.kept ? '<b>KEPT +' + fmt(r.kept) + '</b>' : 'KEPT —') + '</span></div>' : '') + '</div>';
    }
    if (x.rows.length) h += '<div class="rs-foot"><b>' + fmt(x.gold) + '</b> GOLD FROM HARVEST' + (x.contract && x.kept ? ' · <b>+' + fmt(x.kept) + '</b> TO YOUR INVENTORY' : '') + '</div>';
    h += '</div>';
  }
  if (m.notes && m.notes.length) {
    h += '<div class="rs-panel rs-notes" data-step="notes">' + m.notes.map((n) =>
      '<div class="rs-note ' + esc(n.kind || '') + '"><b>' + esc(n.head || '') + '</b><span>' + esc(n.text) + '</span></div>').join('') + '</div>';
  }
  h += '</div></div><div class="rs-act">';
  if (m.nextMap) h += '<button class="rs-btn primary" data-act="next">Next map<span class="sub">' + esc(m.nextMap.label) + (m.nextMap.size ? ' · ' + esc(m.nextMap.size) : '') + '</span></button>';
  h += '<button class="rs-btn' + (m.nextMap ? '' : ' primary') + '" data-act="restart">' + (m.win ? 'Replay' : 'Retry') + '</button>';
  h += '<button class="rs-btn" data-act="menu">Menu</button></div>';
  return h;
}

/** Count a number up from 0 over `ms` (ease-out), honouring data-dec decimals. */
function countUp(el, ms, now) {
  const to = Number(el.dataset.count) || 0, dec = Number(el.dataset.dec) || 0;
  const t0 = now();
  const tick = () => {
    const k = Math.min(1, (now() - t0) / ms), v = to * (1 - Math.pow(1 - k, 3));
    el.textContent = dec ? v.toFixed(dec) : fmt(v);
    if (k < 1 && !el._rsStop) el._rsRaf = requestAnimationFrame(tick);
  };
  tick();
}

/**
 * Mount the report into `host` (the HUD's result container) and play the reveal. → { finish, dispose }.
 * handlers: { onNext, onRestart, onMenu }. opts.reduced forces the end state (tests, reduced motion).
 */
export function mountResults(host, model, handlers = {}, opts = {}) {
  const doc = host.ownerDocument;
  if (!doc.getElementById('rs-css')) { const st = doc.createElement('style'); st.id = 'rs-css'; st.textContent = RESULTS_CSS; doc.head.appendChild(st); }
  if (!doc.getElementById('rs-fonts')) { const l = doc.createElement('link'); l.id = 'rs-fonts'; l.rel = 'stylesheet'; l.href = FONTS; doc.head.appendChild(l); }
  host.innerHTML = '';
  const root = doc.createElement('div');
  root.className = 'rs' + (model.win ? '' : ' lose');
  root.innerHTML = resultsHtml(model);
  host.appendChild(root);
  const win = doc.defaultView;
  const now = () => (win.performance ? win.performance.now() : Date.now());
  const reduced = opts.reduced || !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const timers = [];
  const at = (ms, fn) => timers.push(win.setTimeout(fn, ms));
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const counters = $$('[data-count]');
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach((t) => win.clearTimeout(t));
    for (const el of counters) { el._rsStop = true; if (el._rsRaf) cancelAnimationFrame(el._rsRaf); const dec = Number(el.dataset.dec) || 0; el.textContent = dec ? Number(el.dataset.count).toFixed(dec) : fmt(Number(el.dataset.count)); }
    root.classList.add('on', 's1', 'done');
    $$('.rs-panel, .rs-wave, .rs-rw, .rs-res, .rs-xbar, .rs-act').forEach((e) => e.classList.add('in'));
  };

  for (const b of $$('[data-act]')) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = b.dataset.act;
      if (a === 'next' && handlers.onNext) handlers.onNext();
      else if (a === 'restart' && handlers.onRestart) handlers.onRestart();
      else if (a === 'menu' && handlers.onMenu) handlers.onMenu();
    });
  }
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-act]')) finish(); });

  if (reduced) { finish(); }
  else {
    // the reveal, in reading order (≈ 3.5 s)
    win.requestAnimationFrame(() => root.classList.add('on'));
    at(150, () => root.classList.add('s1'));                                                  // verdict slam + sweep
    const waves = $('[data-step="waves"]');
    let t = 650;
    if (waves) {
      at(t, () => waves.classList.add('in'));
      $$('.rs-wave').forEach((w, i) => at(t + 120 + i * 85, () => w.classList.add('in')));
      t += 120 + $$('.rs-wave').length * 85 + 120;
    }
    const score = $('[data-step="score"]');
    at(t, () => { score.classList.add('in'); score.querySelectorAll('[data-count]').forEach((el) => countUp(el, 900, now)); });
    t += 450;
    const rewards = $('[data-step="rewards"]');
    if (rewards) {
      at(t, () => rewards.classList.add('in'));
      rewards.querySelectorAll('.rs-rw').forEach((r, i) => at(t + 100 + i * 180, () => {
        r.classList.add('in');
        r.querySelectorAll('[data-count]').forEach((el) => countUp(el, 700, now));
        const bar = r.querySelector('.rs-xbar'); if (bar) win.setTimeout(() => bar.classList.add('in'), 150);
      }));
      t += 100 + 3 * 180 + 200;
    }
    const resources = $('[data-step="resources"]');
    if (resources) {
      at(t, () => resources.classList.add('in'));
      resources.querySelectorAll('.rs-res').forEach((r, i) => at(t + 80 + i * 140, () => { r.classList.add('in'); r.querySelectorAll('[data-count]').forEach((el) => countUp(el, 650, now)); }));
      t += 80 + resources.querySelectorAll('.rs-res').length * 140 + 300;
    }
    const notes = $('[data-step="notes"]');
    if (notes) { at(t, () => notes.classList.add('in')); t += 400; }
    at(t, () => { $('.rs-act').classList.add('in'); });
    at(t + 900, finish);
  }
  return {
    root, finish,
    dispose() { finish(); host.innerHTML = ''; },
  };
}
