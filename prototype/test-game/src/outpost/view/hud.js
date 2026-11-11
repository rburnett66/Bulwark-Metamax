/**
 * src/outpost/view/hud.js — the outpost HUD, panels, BUILD sheet, GO ONLINE card and away report (DOM)
 * [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.1. Owner 2026-11-07: the interface follows the rest of the game — the battle HUD
 * and results screen's dark panels, hairline borders and gold primary actions, cyan for power and light. The concept's
 * light grey, white and orange belong to the 3D buildings only (design §8.1). Type: Orbitron for numbers and
 * labels, Rajdhani for text (the results screen's pair). The away report uses the results screen's language
 * (render/resultsScreen.js: dark scrim, panel with corner ticks, staged reveal).
 *
 * Layouts (layout.js decides; `data-layout` on the root): portrait (top bar in two rows, actions along the bottom,
 * the panel a bottom sheet), landscape (slim top row, actions in a right column, the panel on the left), desktop.
 * Every number comes from hudModel.js; every tap calls back into the view, which acts through the session.
 *
 * The BUILD menu (story O17 [MM-story_mw6k9xec_5], owner 2026-11-07: "the same way the tower defense game works. An
 * icon list with cost on the left side of the screen"): the battle HUD's own palette (render/buildPalette.js — its CSS,
 * its reactive left rail, its picture + name + cost buttons, hotkey badges, bw-selected / bw-poor) down the left in
 * every layout, as on a battle phone. Its items are buildMenu.js's model; a locked item shows a padlock and says why
 * on hover / tap; the first-run guidance pulses with the battle's hint glow. While an item is armed the banner says
 * where it goes, with CONFIRM (touch: once a spot is aimed) and CANCEL.
 */
import { fmtGold, fmtUnits, fmtClock, sellButton, ROMAN } from './hudModel.js';
import { fmtPerHour } from './statusReport.js';
import { PALETTE_CSS, SELPANEL_CSS, paletteBaseCss, railFit, applyRailFit, STRUCT_ICONS, LOCK_SVG } from '../../render/buildPalette.js';
import { buildIcon, buildIconUrl } from '../../render/buildIcons.js';
import { OUTPOST_GLYPHS } from './menuIcons.js';
import { BATTLE_ICON } from './buildMenu.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CH = 'clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)';
/** The battle palette's top (render/buildPalette.js .bw-palette top:56px): the outpost rail sits at the same spot. */
export const RAIL_TOP = 56;

export const HUD_CSS = `
.op { position:absolute; inset:0; z-index:40; pointer-events:none; overflow:hidden; font-family:Rajdhani,"Segoe UI",system-ui,sans-serif;
  color:#e8eef5; -webkit-font-smoothing:antialiased; user-select:none; -webkit-user-select:none;
  --panel:linear-gradient(180deg,rgba(20,26,36,.94) 0%,rgba(12,16,23,.96) 100%); --base:#070a0f; --base2:#05070b; --trim:#D9A441; --trim-hi:#f2c869;
  --line:#2a3340; --line-hi:#3a4655; --well:#141b22;
  --cyan:#3fd0ff; --cyan-d:#0a8fc4; --ink:#e8eef5; --dim:#8fa0b3; --ok:#2fa36b; --warn:#d98a12; --bad:#d2453a; --gold:#f2c869;
  --fs:clamp(12px, 1.9vmin, 15px); font-size:var(--fs); }
.op * { box-sizing:border-box; }
.op [hidden] { display:none !important; }
.op button { font:inherit; color:inherit; cursor:pointer; pointer-events:auto; -webkit-tap-highlight-color:transparent; }
.op button:focus-visible { outline:2px solid var(--cyan); outline-offset:2px; }
.op .num { font-family:Orbitron,Rajdhani,sans-serif; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:.02em; }

/* ── top bar: a light plate on a dark chamfered base with an orange stripe ── */
.op-top { position:absolute; left:0; right:0; top:0; display:flex; align-items:center; gap:10px; pointer-events:auto;
  padding:max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 9px max(10px, env(safe-area-inset-left));
  background:var(--panel); border-bottom:1px solid var(--line); box-shadow:0 2px 0 var(--trim), 0 8px 18px rgba(0,0,0,.45); }
.op-back { flex:0 0 auto; width:38px; height:38px; border:1px solid var(--line-hi); background:var(--well); color:#fff; font-size:20px; line-height:1; ${CH}; }
.op-back:hover { background:#1f2834; }
.op-title { flex:0 0 auto; min-width:0; }
/* the OUTPOST / FARM tab (story A7): one map, two modes (Farming-Design §2.3) */
.op-tabs { display:flex; gap:4px; flex:0 0 auto; }
.op-tabs[hidden] { display:none; }
.op-tab { font:700 .78em/1 Orbitron,sans-serif; letter-spacing:.14em; padding:7px 12px; background:rgba(20,26,34,.85); color:var(--dim); border:1px solid #2e3846; cursor:pointer; }
.op-tab[aria-pressed="true"] { color:#1a1206; background:#d9a441; border-color:#d9a441; }
.op-sacts { display:flex; flex-direction:column; gap:5px; margin-top:8px; }
.op-sacts .bw-btn { justify-content:space-between; text-align:left; }
.op-sacts .bw-btn i { width:10px; height:10px; border-radius:50%; flex:0 0 auto; margin-right:6px; display:inline-block; }
.op-title b { display:block; font-family:Orbitron,sans-serif; font-weight:900; font-size:1.05em; letter-spacing:.16em; white-space:nowrap; }
.op-title i { display:block; font-style:normal; font-size:.8em; letter-spacing:.22em; color:var(--dim); white-space:nowrap; font-weight:700; }
.op-stats { flex:1 1 auto; display:flex; align-items:center; justify-content:flex-end; gap:8px; min-width:0; flex-wrap:nowrap; }
.op-chip { display:flex; align-items:center; gap:6px; padding:4px 9px 4px 6px; background:var(--well); border:1px solid var(--line); border-bottom:2px solid var(--line-hi);
  white-space:nowrap; min-width:0; ${CH.replace(/9px/g, '6px')}; }
.op-chip .lbl { font-size:.72em; letter-spacing:.2em; color:var(--dim); font-weight:700; }
.op-chip .num { font-size:1em; }
.op-chip.gold .num { color:var(--gold); }
.op-ico { width:18px; height:18px; flex:0 0 auto; display:block; }
.op-ores { display:flex; gap:6px; }
.op-ore { display:flex; align-items:center; gap:4px; }
.op-glyph { width:16px; height:16px; flex:0 0 auto; clip-path:polygon(50% 0,100% 28%,100% 72%,50% 100%,0 72%,0 28%);
  background:linear-gradient(140deg, rgba(255,255,255,.75), transparent 45%), var(--c); box-shadow:inset 0 0 0 1px rgba(0,0,0,.25); }
.op-bar { position:relative; width:64px; height:9px; background:#0a0d12; border:1px solid #263142; overflow:hidden; }
.op-bar > i { position:absolute; left:0; top:0; bottom:0; width:0; background:linear-gradient(90deg,var(--cyan-d),var(--cyan)); transition:width .4s; }
.op-bar.full > i { background:linear-gradient(90deg,#c26a00,var(--trim-hi)); }
.op-chip.power .num { color:var(--cyan-d); }
.op-chip.threat .num { font-size:.86em; white-space:nowrap; }
.op-chip.threat .num.short { display:none; }
.op-chip.hopper[hidden], .op-chip.raid[hidden] { display:none; }
.op-chip.hopper .op-bar i { background:linear-gradient(90deg,#5fb8ff,#ffd34a); }
.op-chip.raid { background:#3a0d0a; border-color:#d2453a; color:#ffd7d2; font-weight:800; letter-spacing:.06em; animation:opRaid 1s ease-in-out infinite alternate; }
@keyframes opRaid { from { box-shadow:0 0 0 0 rgba(210,69,58,.0); } to { box-shadow:0 0 0 4px rgba(210,69,58,.45); } }
.op-techs { display:grid; gap:5px; margin:8px 0 2px; }
.op-tech { display:grid; grid-template-columns:1fr auto; gap:0 8px; padding:6px 8px; border:1px solid var(--line); border-left:3px solid #4a5462; background:var(--well); }
.op-tech b { font-size:.92em; } .op-tech small { grid-column:1 / -1; opacity:.75; }
.op-tech.owned { border-left-color:#2fa36b; } .op-tech.buy { border-left-color:var(--cyan-d); }
.op-tech .st { font-size:.75em; font-weight:800; letter-spacing:.08em; } .op-tech.owned .st { color:#2fa36b; } .op-tech.buy .st { color:var(--cyan); } .op-tech.locked .st { color:#6d7a8a; }
.op-note { margin:8px 0 2px; font-size:.86em; opacity:.8; }
.op-chip.power.short .num { color:var(--bad); }
.op-shield { position:relative; width:18px; height:20px; }
.op-shield svg { position:absolute; inset:0; width:100%; height:100%; }
.op-chip.worn .num { color:var(--warn); }

/* ── bottom actions: big chamfered buttons; SELL is the orange one ── */
.op-actions { position:absolute; left:50%; transform:translateX(-50%); bottom:max(14px, env(safe-area-inset-bottom)); display:flex; gap:10px; align-items:flex-end; pointer-events:none; }
.op-btn { position:relative; min-width:108px; height:58px; padding:0 18px; border:1px solid var(--line-hi); background:var(--panel); color:var(--ink);
  display:flex; flex-direction:column; align-items:center; justify-content:center; ${CH}; box-shadow:inset 0 -4px 0 var(--base); }
.op-btn b { font-family:Orbitron,sans-serif; font-weight:900; font-size:1.05em; letter-spacing:.14em; line-height:1.1; }
.op-btn i { font-style:normal; font-size:.82em; font-weight:700; letter-spacing:.1em; color:var(--dim); }
.op-btn:hover:not(:disabled) { filter:brightness(1.06); }
.op-btn:active:not(:disabled) { transform:translateY(2px); box-shadow:inset 0 -3px 0 var(--base); }
.op-btn:disabled { opacity:.55; cursor:default; }
.op-btn.sell { min-width:150px; height:66px; border-color:var(--trim-hi); background:linear-gradient(180deg,#f6d27e,#D9A441 55%,#b9852c); color:#1a1206; box-shadow:inset 0 -6px 0 #6b4a12, inset 0 2px 0 rgba(255,255,255,.35); }
.op-btn.sell b { font-size:1.3em; }
.op-btn.sell i { color:#3a2a08; }
.op-btn.sell:disabled { border-color:var(--line-hi); background:linear-gradient(180deg,#1f2732,#151b23); color:#6d7a8a; box-shadow:inset 0 -6px 0 var(--base); opacity:.9; }
.op-btn.sell:disabled i { color:#6d7a8a; }
.op-btn.sell.ready::after { content:""; position:absolute; inset:0; background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%) -150% 0/250% 100% no-repeat; animation:op-sweep 2.4s ease-in-out infinite; }
@keyframes op-sweep { 0%,55% { background-position:-150% 0; } 100% { background-position:150% 0; } }
.op-btn.repair b { color:var(--warn); }
.op-btn.on { box-shadow:inset 0 -5px 0 var(--cyan-d), inset 0 0 0 2px var(--cyan); }

/* ── the panel: a light card, orange stripe on its top, dark base ── */
.op-panel { position:absolute; pointer-events:auto; background:var(--panel); border:1px solid var(--line); ${CH}; box-shadow:0 10px 24px rgba(0,0,0,.45);
  padding:14px 16px 18px; display:none; max-height:calc(100% - 140px); overflow-y:auto; overscroll-behavior:contain; }
.op-panel.open { display:block; animation:op-in .22s cubic-bezier(.2,1,.3,1); }
@keyframes op-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
.op-panel::before { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:linear-gradient(90deg,var(--trim),var(--trim-hi) 60%,transparent); }
.op-ph { display:flex; align-items:flex-start; gap:10px; margin-bottom:8px; }
.op-ph h3 { margin:0; font-family:Orbitron,sans-serif; font-weight:900; font-size:1.08em; letter-spacing:.08em; line-height:1.2; }
.op-ph small { display:block; color:var(--dim); font-weight:700; letter-spacing:.14em; font-size:.78em; text-transform:uppercase; }
.op-x { margin-left:auto; flex:0 0 auto; width:30px; height:30px; border:1px solid var(--line-hi); background:var(--well); color:#fff; font-size:16px; ${CH.replace(/9px/g, '6px')}; }
.op-status { display:inline-flex; align-items:center; gap:6px; font-weight:700; letter-spacing:.08em; padding:3px 9px; margin:0 0 10px; background:var(--well); border:1px solid var(--line); }
.op-status::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--c, var(--ok)); box-shadow:0 0 6px var(--c, var(--ok)); }
.op-status.warn { --c:var(--warn); } .op-status.off { --c:var(--bad); } .op-status.busy { --c:var(--cyan-d); }
.op-kv { display:grid; grid-template-columns:auto 1fr; gap:3px 14px; margin:0 0 10px; }
.op-kv dt { color:var(--dim); font-weight:700; letter-spacing:.1em; font-size:.86em; text-transform:uppercase; }
.op-kv dd { margin:0; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; }
.op-meter { height:10px; background:#0a0d12; border:1px solid #263142; margin:0 0 12px; position:relative; overflow:hidden; }
.op-meter i { position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg,var(--cyan-d),var(--cyan)); }
.op-meter.hp i { background:linear-gradient(90deg,#c0392b,#f0a030 50%,var(--ok)); }
.op-switch { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 10px; background:var(--well); border:1px solid var(--line); margin:0 0 10px; }
.op-switch b { display:block; letter-spacing:.08em; }
.op-switch small { color:var(--dim); font-weight:600; }
.op-seg { display:flex; background:var(--base); padding:3px; gap:3px; ${CH.replace(/9px/g, '5px')}; }
.op-seg button { border:0; background:transparent; color:#cfd6dd; font-family:Orbitron,sans-serif; font-weight:800; font-size:.78em; letter-spacing:.1em; padding:7px 10px; }
.op-seg button.on { background:var(--cyan); color:#082230; }
.op-seg button:disabled { opacity:.45; cursor:default; }
.op-wide { width:100%; height:46px; border:0; margin-top:4px; font-family:Orbitron,sans-serif; font-weight:900; letter-spacing:.1em; font-size:.92em;
  background:linear-gradient(180deg,#f6d27e,#D9A441 55%,#b9852c); color:#1a1206; ${CH}; box-shadow:inset 0 -5px 0 #6b4a12; }
.op-wide.alt { background:linear-gradient(180deg,#26303c,#171d25); color:#dfe7ef; border:1px solid var(--line-hi); box-shadow:inset 0 -5px 0 #05070b; }
.op-wide:disabled { background:#1f2732; color:#6d7a8a; box-shadow:inset 0 -5px 0 var(--base); cursor:default; }
.op-why { color:var(--dim); font-size:.86em; font-weight:600; margin-top:4px; text-align:center; }
.op-list { display:flex; flex-direction:column; gap:6px; }
.op-opt { display:grid; grid-template-columns:1fr auto; align-items:center; gap:2px 10px; text-align:left; padding:9px 12px; border:1px solid var(--line);
  background:var(--well); border-left:4px solid var(--trim); }
.op-opt:hover:not(:disabled) { border-color:var(--trim); }
.op-opt:disabled { opacity:.55; border-left-color:#4a5462; cursor:default; }
.op-opt b { letter-spacing:.06em; font-size:1.02em; }
.op-opt small { grid-column:1; color:var(--dim); font-weight:600; }
.op-opt .num { grid-row:1 / span 2; grid-column:2; color:#8a5a00; }
.op-sec { margin:12px 0 6px; font-size:.76em; letter-spacing:.28em; font-weight:800; color:var(--dim); }

/* ── banners and toasts ── */
.op-banner { position:absolute; left:50%; transform:translateX(-50%); display:none; align-items:center; gap:12px; padding:9px 10px 9px 16px; pointer-events:auto;
  background:rgba(12,16,23,.94); border:1px solid var(--line); color:#e8eef5; font-weight:700; letter-spacing:.06em; ${CH}; box-shadow:inset 0 -3px 0 var(--cyan-d); max-width:calc(100% - 24px); }
.op-banner.on { display:flex; }
.op-banner button { border:0; background:#4a5560; color:#fff; padding:6px 12px; font-weight:800; letter-spacing:.1em; ${CH.replace(/9px/g, '5px')}; }
.op-toast { position:absolute; left:50%; transform:translate(-50%,8px); top:96px; padding:8px 16px; background:rgba(29,33,37,.94); color:#fff; font-weight:700;
  letter-spacing:.06em; opacity:0; transition:opacity .2s, transform .2s; pointer-events:none; ${CH.replace(/9px/g, '6px')}; border-left:3px solid var(--trim); max-width:90%; text-align:center; }
.op-toast.on { opacity:1; transform:translate(-50%,0); }
.op-toast.bad { border-left-color:var(--bad); }

/* ── GO ONLINE: the contract's first step ── */
.op-online { position:absolute; pointer-events:auto; display:none; background:var(--panel); border:1px solid var(--line); ${CH}; box-shadow:0 10px 24px rgba(0,0,0,.45); padding:16px 18px 18px; width:min(380px, calc(100% - 24px)); }
.op-online.on { display:block; animation:op-in .3s cubic-bezier(.2,1,.3,1); }
.op-online::before { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:linear-gradient(90deg,var(--cyan),var(--cyan-d) 60%,transparent); }
.op-online h3 { margin:0 0 2px; font-family:Orbitron,sans-serif; font-weight:900; letter-spacing:.12em; font-size:1.1em; }
.op-online p { margin:0 0 10px; color:var(--dim); font-weight:600; }
.op-check { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px 12px; margin:0 0 12px; }
.op-check span { display:flex; align-items:center; gap:7px; font-weight:700; letter-spacing:.04em; }
.op-check span::before { content:"✓"; display:grid; place-items:center; width:18px; height:18px; background:var(--ok); color:#fff; font-size:12px; }
.op-check span.no::before { content:"!"; background:var(--bad); }
.op-online .op-wide { background:linear-gradient(180deg,#6fe3ff,var(--cyan) 50%,var(--cyan-d)); color:#062433; box-shadow:inset 0 -5px 0 #075a7d; }
.op-online .op-wide:disabled { background:#1f2732; color:#6d7a8a; box-shadow:inset 0 -5px 0 var(--base); }

/* ── layouts ── */
.op[data-layout="portrait"] .op-top { flex-wrap:wrap; row-gap:7px; }
.op[data-layout="portrait"] .op-title { flex:0 1 auto; }
.op[data-layout="portrait"] .op-stats { display:contents; font-size:.92em; }
.op[data-layout="portrait"] .op-chip { font-size:.92em; }
.op[data-layout="portrait"] .op-chip.gold { margin-left:auto; }
.op[data-layout="portrait"] .op-chip:not(.gold) { flex:1 1 auto; justify-content:center; }
.op[data-layout="portrait"] .op-chip { padding:3px 5px 3px 4px; gap:3px; }
.op[data-layout="portrait"] .op-chip .lbl { display:none; }
.op[data-layout="portrait"] .op-ores { gap:4px; }
.op[data-layout="portrait"] .op-glyph, .op[data-layout="portrait"] .op-ico { width:14px; height:14px; }
.op[data-layout="portrait"] .op-bar { width:30px; }
.op[data-layout="portrait"] .op-chip [data-k="store"] { display:none; }
.op[data-layout="portrait"] .op-actions { width:calc(100% - 20px); justify-content:center; gap:8px; }
.op[data-layout="portrait"] .op-btn { min-width:0; flex:1 1 0; padding:0 8px; }
.op[data-layout="portrait"] .op-btn.sell { flex:1.5 1 0; }
.op[data-layout="portrait"] .op-btn i { font-size:.74em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.op[data-layout="portrait"] .op-sel { top:var(--rail-top, 104px); right:max(6px, env(safe-area-inset-right)); max-height:calc(100% - var(--rail-top, 104px) - 100px); z-index:2; }
.op[data-layout="portrait"] .op-online { left:50%; transform:translateX(-50%); bottom:max(92px, calc(env(safe-area-inset-bottom) + 84px)); }
.op[data-layout="portrait"] .op-banner { bottom:96px; }
.op[data-layout="portrait"] .op-toast { top:112px; }
.op[data-layout="landscape"] { --fs:clamp(11px, 2.9vmin, 14px); }
.op[data-layout="landscape"] .op-top { padding-top:max(5px, env(safe-area-inset-top)); padding-bottom:6px; gap:8px; }
.op[data-layout="landscape"] .op-back { width:32px; height:32px; font-size:17px; }
.op[data-layout="landscape"] .op-title i { display:none; }
.op[data-layout="landscape"] .op-chip .lbl { display:none; }
.op[data-layout="landscape"] .op-chip.threat .num.full { display:none; } .op[data-layout="landscape"] .op-chip.threat .num.short { display:inline; }
.op[data-layout="landscape"] .op-bar { width:42px; }
.op[data-layout="landscape"] .op-actions { left:auto; transform:none; right:max(10px, env(safe-area-inset-right)); bottom:max(10px, env(safe-area-inset-bottom)); flex-direction:column; align-items:stretch; }
.op[data-layout="landscape"] .op-btn.repair { order:2; } .op[data-layout="landscape"] .op-btn.sell { order:3; }
.op[data-layout="landscape"] .op-btn { height:48px; min-width:150px; }
.op[data-layout="landscape"] .op-btn.sell { height:58px; }
.op[data-layout="landscape"] .op-sel { top:var(--rail-top, 56px); right:calc(min(190px, 24%) + 10px); max-height:calc(100% - var(--rail-top, 56px) - 8px); }
.op[data-layout="landscape"] .op-online { left:max(10px, env(safe-area-inset-left)); bottom:10px; width:min(330px, 44%); padding:12px 14px 14px; }
.op[data-layout="landscape"] .op-online p { display:none; }
.op[data-layout="landscape"] .op-banner { top:54px; }
.op[data-layout="landscape"] .op-toast { top:56px; }
.op[data-layout="desktop"] .op-sel { right:max(6px, env(safe-area-inset-right)); top:var(--rail-top, 62px); }
.op[data-layout="desktop"] .op-online { left:50%; transform:translateX(-50%); bottom:96px; }
.op[data-layout="desktop"] .op-banner { bottom:96px; }

/* ── the away report (results-screen language) ── */
.op-rep { position:absolute; inset:0; z-index:5; display:none; align-items:center; justify-content:center; pointer-events:auto; color:#dfe7ef; }
.op-rep.on { display:flex; }
.op-rep-scrim { position:absolute; inset:0; background:radial-gradient(120% 90% at 50% 35%, rgba(10,14,22,.58), rgba(4,6,10,.92) 70%);
  -webkit-backdrop-filter:blur(6px) saturate(.75); backdrop-filter:blur(6px) saturate(.75); }
.op-rep-card { position:relative; width:min(560px, calc(100% - 24px)); max-height:calc(100% - 24px); overflow-y:auto; overscroll-behavior:contain;
  background:linear-gradient(180deg, rgba(20,26,36,.92), rgba(12,16,23,.95)); border:1px solid #2a3340; padding:clamp(14px,3vmin,24px); }
.op-rep-card::before, .op-rep-card::after { content:""; position:absolute; width:24px; height:24px; pointer-events:none; }
.op-rep-card::before { left:-1px; top:-1px; border-left:2px solid var(--trim); border-top:2px solid var(--trim); }
.op-rep-card::after { right:-1px; bottom:-1px; border-right:2px solid var(--trim); border-bottom:2px solid var(--trim); }
.op-rep-k { text-align:center; font-weight:700; letter-spacing:.32em; color:#8A97A8; font-size:.8em; }
.op-rep-h { text-align:center; font-family:Orbitron,sans-serif; font-weight:900; letter-spacing:.12em; font-size:clamp(20px,5.2vmin,34px); margin:4px 0 2px;
  color:transparent; background:linear-gradient(105deg, transparent 0 42%, #fff8e0 50%, transparent 58% 100%) 120% 0 / 260% 100% no-repeat var(--trim);
  -webkit-background-clip:text; background-clip:text; animation:op-rep-sweep 1.2s .3s ease-in-out 1 both; }
@keyframes op-rep-sweep { from { background-position:120% 0; } to { background-position:-20% 0; } }
.op-rep-sub { text-align:center; color:#8A97A8; font-weight:600; letter-spacing:.14em; margin-bottom:14px; }
.op-rep-sub b { color:#e8eef5; }
.op-rep-sec { font-size:.74em; font-weight:800; letter-spacing:.32em; color:#8A97A8; margin:14px 0 6px; display:flex; justify-content:space-between; }
.op-rep-row { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:4px 12px; padding:7px 0; border-top:1px solid #1e252f;
  opacity:0; transform:translateX(-10px); transition:opacity .3s, transform .35s ease-out; }
.op-rep-row.in { opacity:1; transform:none; }
.op-rep-row .num { font-size:1.1em; color:#f4f7fb; }
.op-rep-row small { grid-column:2; color:#8A97A8; font-weight:600; }
.op-rep-row .tag { padding:2px 8px; font-weight:800; letter-spacing:.12em; font-size:.8em; background:rgba(47,163,107,.18); color:#7fe0ad; border:1px solid rgba(47,163,107,.5); }
.op-rep-row .tag.bad { background:rgba(210,69,58,.18); color:#ff9a8a; border-color:rgba(210,69,58,.55); }
.op-rep-dot { width:12px; height:12px; clip-path:polygon(50% 0,100% 28%,100% 72%,50% 100%,0 72%,0 28%); background:var(--c); }
.op-rep-act { display:flex; gap:10px; margin-top:18px; }
.op-rep-act .op-wide { margin:0; }
.op-rep-empty { color:#8A97A8; font-weight:600; padding:6px 0; }

/* ── the BUILD menu: the battle palette (render/buildPalette.js), down the left [MM-story_mw6k9xec_5] ── */
${PALETTE_CSS}
${paletteBaseCss('.op')}
/* ── the selection panel: the battle HUD's own (render/buildPalette.js SELPANEL_CSS), with the outpost's extra rows
   (owner 2026-11-07: "repurpose that UX ... If we need to add outpost conditional data that is fine") ── */
${SELPANEL_CSS}
.op .op-sel { width:220px; overflow-y:auto; overscroll-behavior:contain; font-family:'Courier New', monospace; color:#e8e8e8; }
.op .op-sel.open { display:flex; }
.op .op-sel .bw-sname { padding-right:26px; }
.op .op-sel .bw-udeselect { position:absolute; top:5px; right:6px; background:none; border:1px solid #3a4a5a; border-radius:4px; color:#9ec4d8;
  font:inherit; font-size:10px; padding:1px 6px; cursor:pointer; pointer-events:auto; }
.op .op-sel .bw-udeselect:hover { background:#22303e; color:#e7f6ff; }
.op .op-sel .op-sinfo.busy { color:#9fd4ff; } .op .op-sel .op-sinfo.off { color:#ff8a7a; } .op .op-sel .op-sinfo.warn { color:#ffcf7a; }
.op .op-sel .op-slist { display:flex; flex-direction:column; }
.op .op-sel .op-stat { display:flex; justify-content:space-between; gap:8px; border-bottom:1px solid #182430; padding:1px 0; }
.op .op-sel .op-stat .k { color:#7f9fb2; } .op .op-sel .op-stat .v { color:#eaf6ff; font-weight:600; text-align:right; }
.op .op-sel .op-swarn { color:#ffb36a; font-size:11px; }
.op .op-sel .op-swhy { color:#8fa0b3; font-size:10.5px; }
/* SELL RESOURCES in the panel: the bottom SELL button's gold, full width, one slim line (owner 2026-11-09: "half as tall") */
.op .op-sel .op-sellres { width:100%; margin-top:6px; display:flex; justify-content:space-between; align-items:center; gap:8px; padding:3px 10px;
  white-space:nowrap; line-height:1.2; min-height:0; font-size:.92em;
  border:1px solid var(--trim-hi); background:linear-gradient(180deg,#f6d27e,#D9A441 55%,#b9852c); color:#1a1206; }
.op .op-sel .op-sellres b { font-family:Orbitron,sans-serif; font-weight:900; letter-spacing:.12em; }
.op .op-sel .op-sellres span { font-weight:700; font-size:.9em; color:#3a2a08; }
.op .op-sel .op-sellres:disabled { border-color:var(--line-hi); background:linear-gradient(180deg,#1f2732,#151b23); color:#6d7a8a; opacity:.9; }
.op .op-sel .op-sellres:disabled span { color:#6d7a8a; }
.op .op-sel .op-shead { color:#bfe0ff; font-size:11px; margin-top:4px; }
.op .op-sel .op-snote { color:#8fa0b3; font-size:11px; }
.op .op-sel .op-sbuild { display:flex; flex-direction:column; gap:4px; }
.op .op-sel .op-sbuild .bw-btn { display:flex; justify-content:space-between; gap:6px; font-size:11px; text-align:left; }
.op .op-sel .op-tech-st.owned { color:#7ac07a; } .op .op-sel .op-tech-st.buy { color:#5fe0ff; } .op .op-sel .op-tech-st.locked { color:#6d7a8a; }
.op .bw-palette.op-rail { left:6px; top:var(--rail-top, 56px); z-index:1; }   /* the battle palette's spot (no notch inset: the battle has none) */
.op .bw-buildbtn { position:relative; }
.op .bw-bname .op-s { display:none; }
.op .bw-palette.op-narrow .bw-bname { letter-spacing:.02em; }
.op .bw-palette.op-narrow .bw-bname .op-l { display:none; }
.op .bw-palette.op-narrow .bw-bname .op-s { display:inline; }
.op .bw-buildbtn .bw-cost { font-family:'Courier New', monospace; font-weight:700; }
.op .bw-buildbtn.bw-poor .bw-cost { color:#ff6a5a; }
.op .bw-count { position:absolute; top:1px; right:3px; font-size:9px; font-weight:800; color:#bfe0ff; text-shadow:0 1px 2px #000; }
.op .bw-buildbtn.bw-locked .bw-count { right:15px; }
.op .bw-buildbtn.op-guide { border-color:#5fe0ff; animation:op-guide 1.6s ease-in-out infinite; }
@keyframes op-guide { 0%,100% { box-shadow:0 0 10px -4px #5fe0ff; } 50% { box-shadow:0 0 18px 0 #5fe0ff; } }
.op .bw-buildbtn.op-guide::after { content:"▸"; position:absolute; right:-11px; top:50%; transform:translateY(-50%); color:#5fe0ff; font-size:14px; text-shadow:0 0 6px #5fe0ff; animation:op-nudge 1.6s ease-in-out infinite; }
@keyframes op-nudge { 0%,100% { transform:translate(0,-50%); } 50% { transform:translate(4px,-50%); } }
.op-banner .op-confirm { background:linear-gradient(180deg,#6fe3ff,var(--cyan) 50%,var(--cyan-d)); color:#062433; }
.op-warn { display:flex; align-items:center; gap:8px; margin:0 0 10px; padding:7px 10px; background:rgba(217,138,18,.12); border:1px solid rgba(230,180,90,.4); border-left:4px solid var(--warn); color:#ffd59a; font-weight:700; letter-spacing:.03em; }
.op-warn.bad { background:rgba(210,69,58,.14); border-color:rgba(229,163,156,.4); border-left-color:var(--bad); color:#ffb3aa; }
.op-warn svg { width:18px; height:18px; flex:0 0 auto; }
.op-chips { display:flex; flex-wrap:wrap; gap:6px; }
.op-chips .op-opt { flex:1 1 auto; }
.op[data-layout="portrait"] .op-banner, .op[data-layout="landscape"] .op-banner { left:calc(var(--rail-right, 0px) + 8px); right:8px; transform:none; max-width:none; justify-content:space-between; }
.op[data-layout="landscape"] .op-banner { right:calc(min(190px, 24%) + 8px); }
.op[data-layout="portrait"] .op-online { left:calc(var(--rail-right, 0px) + 8px); right:8px; width:auto; transform:none; }
.op[data-layout="landscape"] .op-online { left:calc(var(--rail-right, 150px) + 8px); }
@media (prefers-reduced-motion: reduce) { .op *, .op *::before, .op *::after { animation:none !important; transition:none !important; } .op-rep-row { opacity:1; transform:none; } }
`;

/** Names for the narrow two-column rail (a landscape phone), where the long ones would clip. */
const SHORT = { power: 'POWER', rig: 'MINING', storage: 'STORAGE', resourceBay: 'RES. BAY', upgradeBay: 'UPGRADE', habitat: 'HABITAT', cannon: 'CANNON', traditional: 'PLOT', irrigated: 'IRRIGATED', silo: 'SILO', pump: 'PUMP' };
export const WARN_SVG = {
  bolt: '<svg viewBox="0 0 20 20"><path d="M11.5 1 3.5 11.5h5L7.5 19l9-11.5h-5.2z" fill="#ffd23a" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  crate: '<svg viewBox="0 0 20 20"><rect x="2" y="5" width="16" height="12" fill="#c98a12" stroke="#5a3a00" stroke-width="1.3"/><path d="M2 9h16M7 5v12M13 5v12" stroke="#5a3a00" stroke-width="1.1"/><path d="M5 1.5h10l1.5 3.5h-13z" fill="#e0a83a" stroke="#5a3a00" stroke-width="1"/></svg>',
  door: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#3a4148" stroke="#111" stroke-width="1.2"/><path d="M3 6h14M3 10h14M3 14h14" stroke="#d2453a" stroke-width="1.4"/></svg>',
};

const ICON = {
  coin: '<svg class="op-ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.2" fill="#f2c040" stroke="#8a5a00" stroke-width="1.6"/><circle cx="10" cy="10" r="5" fill="none" stroke="#b07a10" stroke-width="1.4"/></svg>',
  bolt: '<svg class="op-ico" viewBox="0 0 20 20"><path d="M11.5 1 3.5 11.5h5L7.5 19l9-11.5h-5.2z" fill="#3fd0ff" stroke="#0a6f99" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  leaf: '<svg class="op-ico" viewBox="0 0 20 20"><path d="M4 16c0-7 5-11 13-12-1 8-5 13-12 13z" fill="#5fb8ff" stroke="#1d5f8f" stroke-width="1.3" stroke-linejoin="round"/><path d="M4 16 12 8" stroke="#1d5f8f" stroke-width="1.2"/></svg>',
  box: '<svg class="op-ico" viewBox="0 0 20 20"><path d="M10 1.8 17.5 6v8L10 18.2 2.5 14V6z" fill="#cfd6dd" stroke="#4a5560" stroke-width="1.4" stroke-linejoin="round"/><path d="M2.5 6 10 10l7.5-4M10 10v8" fill="none" stroke="#4a5560" stroke-width="1.2"/></svg>',
};
const shieldSvg = (frac) => `<svg viewBox="0 0 18 20"><defs><clipPath id="opsc"><rect x="0" y="${(20 * (1 - frac)).toFixed(1)}" width="18" height="20"/></clipPath></defs>
  <path d="M9 1 16.5 4v6c0 4.6-3.2 7.6-7.5 9C4.7 17.6 1.5 14.6 1.5 10V4z" fill="#c9d1d9" stroke="#4a5560" stroke-width="1.3"/>
  <path d="M9 1 16.5 4v6c0 4.6-3.2 7.6-7.5 9C4.7 17.6 1.5 14.6 1.5 10V4z" fill="${frac < 0.4 ? '#d2453a' : frac < 1 ? '#e0a020' : '#2fa36b'}" clip-path="url(#opsc)"/></svg>`;

/**
 * mountHud(host, cbs) → the HUD. cbs: { onClose, onSell, onRepairAll, onOnline, onPanelClose, onPick(menuId),
 * onPickFor(kind, pad), onConfirmPlace, onCancelPlace, onDeep(pad, on), onUpgrade(pad), onRepair(id), onUpgradeDefense(id), onReportClose }
 */
export function mountHud(host, cbs = {}, { title = 'OUTPOST', planetName = '' } = {}) {
  const doc = host.ownerDocument;
  if (!doc.getElementById('op-fonts')) {
    const l = doc.createElement('link'); l.id = 'op-fonts'; l.rel = 'stylesheet'; l.href = FONTS; doc.head.appendChild(l);
  }
  const root = doc.createElement('div');
  root.className = 'op';
  root.innerHTML = `<style>${HUD_CSS}</style>
    <div class="op-top">
      <button class="op-back" data-a="close" aria-label="Back to the menu">‹</button>
      <div class="op-title"><b>${esc(title)}</b><i>${esc(planetName.toUpperCase())}</i></div>
      <div class="op-tabs" data-k="tabs" role="tablist" hidden><button class="op-tab" data-a="tab" data-tab="outpost" aria-pressed="true">OUTPOST</button><button class="op-tab" data-a="tab" data-tab="farm" aria-pressed="false">FARM</button></div>
      <div class="op-stats">
        <div class="op-chip gold" title="Gold">${ICON.coin}<span class="num" data-k="gold">0</span></div>
        <div class="op-chip" title="Ore in storage"><div class="op-ores" data-k="ores"></div></div>
        <div class="op-chip" title="Storage">${ICON.box}<div class="op-bar" data-k="storeBar"><i></i></div><span class="num" data-k="store">0%</span></div>
        <div class="op-chip hopper" title="Resource Bay hopper: banked to your inventory when you open the outpost" hidden>${ICON.leaf}<div class="op-bar" data-k="hopperBar"><i></i></div><span class="num" data-k="hopper">0</span></div>
        <div class="op-chip raid" data-k="raid" title="Sensor Spire: a raid is inbound" hidden>RAID INBOUND <span class="num" data-k="raidIn"></span></div>
        <div class="op-chip threat" data-k="threatChip" title="Raid threat: base size and the raids a day it draws"><span class="num full" data-k="threat"></span><span class="num short" data-k="threatShort"></span></div>
        <div class="op-chip power" title="Power used / supplied">${ICON.bolt}<span class="num" data-k="power">0/0</span><span class="lbl">POWER</span></div>
        <div class="op-chip shield" title="Defenses"><span class="op-shield" data-k="shieldIco"></span><span class="num" data-k="shield">100%</span></div>
      </div>
    </div>
    <div class="bw-palette bw-panel op-rail" data-k="rail" role="toolbar" aria-label="Build"><div class="bw-title">BUILD</div><div class="bw-palette-row" data-k="railRow"></div></div>
    <div class="op-actions">
      <button class="op-btn" data-a="status"><b>STATUS</b><i>rates · totals</i></button>
      <button class="op-btn sell" data-a="sell"><b>SELL</b><i data-k="loads">no full load</i></button>
      <button class="op-btn repair" data-a="repairAll" hidden><b>REPAIR</b><i data-k="repair">0</i></button>
    </div>
    <div class="bw-selpanel bw-panel op-sel" data-k="panel" role="dialog" aria-live="polite"></div>
    <div class="op-banner" data-k="banner"><span data-k="bannerText"></span><span style="display:flex;gap:6px"><button class="op-confirm" data-a="confirmPlace" hidden>CONFIRM</button><button data-a="cancelPlace">CANCEL</button></span></div>
    <div class="op-online" data-k="online" role="dialog">
      <h3>ESTABLISH THE OUTPOST</h3><p>Build power, a mining station and storage from the list, then bring the grid up.</p>
      <div class="op-check" data-k="checks"></div>
      <button class="op-wide" data-a="online">GO ONLINE</button>
    </div>
    <div class="op-toast" data-k="toast"></div>
    <div class="op-rep" data-k="report"></div>`;
  host.appendChild(root);
  const $ = (k) => root.querySelector(`[data-k="${k}"]`);
  const A = (a) => root.querySelector(`[data-a="${a}"]`);
  let toastTimer = 0, panelSel = null;
  const btns = new Map();   // the BUILD menu's buttons, by item id
  const keyHtml = (it) => (it.key ? `<b class="bw-bkey">${it.key}</b>` : '');
  let lastSell = null;   // the bottom SELL button's state, which the panel's SELL RESOURCES copies
  const ORE_KINDS = new Set(['rig', 'storage', 'resourceBay']);   // buildings that hold ore

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || !root.contains(b)) return;
    const a = b.dataset.a;
    if (!a) return;
    const call = (fn, ...args) => cbs[fn] && cbs[fn](...args);
    if (a === 'close') call('onClose');
    else if (a === 'sell') call('onSell');
    else if (a === 'status') call('onStatus');
    else if (a === 'repairAll') call('onRepairAll');
    else if (a === 'online') call('onOnline');
    else if (a === 'panelClose') call('onPanelClose');
    else if (a === 'cancelPlace') call('onCancelPlace');
    else if (a === 'confirmPlace') call('onConfirmPlace');
    else if (a === 'pick') call('onPick', b.dataset.id);
    else if (a === 'pickFor') call('onPickFor', b.dataset.kind, b.dataset.pad);
    else if (a === 'deep') call('onDeep', b.dataset.pad, b.dataset.on === '1');
    else if (a === 'upgrade') call('onUpgrade', b.dataset.pad);
    else if (a === 'repair') call('onRepair', b.dataset.id);
    else if (a === 'upgradeDefense') call('onUpgradeDefense', b.dataset.id);
    else if (a === 'sellStructure') call('onSellStructure', b.dataset.id != null ? { defense: b.dataset.id } : { pad: b.dataset.pad });
    else if (a === 'reportClose') call('onReportClose');
    else if (a === 'tab') call('onTab', b.dataset.tab);
    else if (a === 'farmAct') call('onFarmAct', b.dataset.act, b.dataset.arg);
  });
  // the HUD's own pointer events never reach the canvas under it
  for (const t of ['pointerdown', 'wheel']) root.addEventListener(t, (e) => { if (e.target !== root) e.stopPropagation(); }, { passive: true });

  const api = {
    root,
    setLayout(mode) { root.dataset.layout = mode; },
    /** The OUTPOST / FARM tab (story A7): shown once the planet has a farm; `active` is pressed. */
    tabs(show, active = 'outpost') {
      const t = $('tabs'); t.hidden = !show;
      for (const b of t.querySelectorAll('.op-tab')) b.setAttribute('aria-pressed', String(b.dataset.tab === active));
      root.dataset.tab = active;
    },
    /** h: hudModel(); gold: the number to show (counts up during a sale). */
    update(h, gold = h.gold) {
      $('gold').textContent = fmtGold(gold);
      const ores = $('ores');
      const html = h.ores.length ? h.ores.map((o) => `<span class="op-ore" title="${esc(o.name)}"><span class="op-glyph" style="--c:${esc(o.colour)}"></span><span class="num">${fmtUnits(o.units)}</span></span>`).join('')
        : '<span class="op-ore"><span class="op-glyph" style="--c:#9aa4ae"></span><span class="num">0</span></span>';
      if (ores.innerHTML !== html) ores.innerHTML = html;
      $('storeBar').firstElementChild.style.width = (h.storage.frac * 100).toFixed(1) + '%';
      $('storeBar').classList.toggle('full', h.storage.frac >= 0.999);
      $('store').textContent = Math.floor(h.storage.frac * 100) + '%';
      $('power').textContent = `${h.power.draw}/${h.power.supply}`;
      const hc = root.querySelector('.op-chip.hopper');
      hc.hidden = !h.hopper;
      if (h.hopper) { $('hopperBar').firstElementChild.style.width = (h.hopper.frac * 100).toFixed(1) + '%'; $('hopper').textContent = fmtUnits(h.hopper.units); }
      $('raid').hidden = h.raidInbound == null;
      if (h.raidInbound != null) $('raidIn').textContent = fmtClock(h.raidInbound / 1000);
      if (h.threat) {   // raid threat: size · raids/day (the short form in a phone's landscape bar) [MM-story_mwco8she_38]
        $('threat').textContent = h.threat.text; $('threatShort').textContent = h.threat.short; $('threatChip').title = h.threat.text;
      }
      root.querySelector('.op-chip.power').classList.toggle('short', h.power.short || h.power.unpowered > 0);
      const sf = h.shield.frac;
      const sh = shieldSvg(Math.max(0, Math.min(1, sf)));
      if ($('shieldIco').dataset.f !== sf.toFixed(2)) { $('shieldIco').innerHTML = sh; $('shieldIco').dataset.f = sf.toFixed(2); }
      $('shield').textContent = Math.round(sf * 100) + '%';
      root.querySelector('.op-chip.shield').classList.toggle('worn', h.shield.worn);
      const s = sellButton(h);
      A('sell').disabled = !s.enabled;
      A('sell').classList.toggle('ready', s.enabled);
      $('loads').textContent = s.sub;
      lastSell = s;
      const ps = root.querySelector('.op-sellres');   // the panel's copy follows the bottom button
      if (ps) { ps.disabled = !s.enabled; ps.classList.toggle('ready', s.enabled); const sub = ps.querySelector('[data-k="psell"]'); if (sub) sub.textContent = s.sub; }
      A('repairAll').hidden = !h.shield.worn;
      $('repair').textContent = h.repairCost ? `${fmtGold(h.repairCost)} gold` : '';
      A('repairAll').disabled = h.repairCost > gold;
    },
    setBusy(b) { A('sell').disabled = b || A('sell').disabled; $('rail').style.pointerEvents = b ? 'none' : ''; $('rail').style.opacity = b ? '.6' : ''; },
    /** The selected building's panel (hudModel.panelModel), or null to close. sel echoes back in callbacks. */
    /**
     * The selection panel: the battle's (render/hud.js updateHud: name, State line, HP bar, the U / X / R action row),
     * with the outpost's conditional rows under the bar (stats, warnings, the seam switch, the bay's tech, an empty
     * pad's build list). hudModel.panelModel gives every value.
     */
    panel(m, sel) {
      const el = $('panel');
      panelSel = m ? sel : null;
      if (!m) { el.classList.remove('open'); el.innerHTML = ''; return; }
      const pad = sel && sel.pad, id = sel && sel.defense;
      // the battle's HP bar: a defense's armour; a building's bay, store or hopper fills the same bar
      const barKey = m.hp != null ? 'Armour' : m.bay != null ? (m.stats || []).map(([k]) => k).find((k) => k === 'Bay' || k === 'Stored' || k === 'Hopper') : null;
      const barVal = barKey ? ((m.stats || []).find(([k]) => k === barKey) || [])[1] || '' : '';
      const bar = m.hp != null ? { frac: m.hp, colour: '#8cf22e', text: 'HP ' + barVal } : m.bay != null ? { frac: m.bay, colour: m.oreColour || '#8cf22e', text: barKey ? `${barKey} ${barVal}` : '' } : null;
      let h = `<button class="bw-udeselect" data-a="panelClose" aria-label="Close">✕</button>`;
      h += `<div class="bw-sname">${esc(m.title)}</div>`;
      h += `<div class="op-sinfo ${m.tone}">State: ${esc(m.status)}</div>`;
      if (bar) h += `<div class="bw-shpbar"><div class="bw-shpfill" style="width:${(Math.max(0, Math.min(1, bar.frac)) * 100).toFixed(1)}%;background:${esc(bar.colour)}"></div></div><div>${esc(bar.text)}</div>`;
      for (const w of m.warnings || []) h += `<div class="op-swarn">⚠ ${esc(w.text)}</div>`;
      const stats = (m.stats || []).filter(([k]) => k !== barKey);
      if (stats.length) h += `<div class="op-slist">${stats.map(([k, v]) => `<div class="op-stat"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>`;
      if (m.deep) {
        h += `<div class="op-shead">Seam · ${esc(m.deep.note)}</div><div class="bw-selrow">
          <button class="bw-btn${m.deep.on ? '' : ' bw-selected'}" data-a="deep" data-pad="${esc(pad)}" data-on="0">Shallow</button>
          <button class="bw-btn${m.deep.on ? ' bw-selected' : ''}" data-a="deep" data-pad="${esc(pad)}" data-on="1" ${m.deep.enabled ? '' : 'disabled'}>Deep</button></div>`;
      }
      if (m.actions) {   // a farm plot or farm building (story A7): its own actions, in place of the battle's U / X / R row
        h += `<div class="op-sacts">${m.actions.map((x) => `<button class="bw-btn" data-a="farmAct" data-act="${esc(x.act)}" data-arg="${esc(x.arg || '')}" ${x.enabled ? '' : 'disabled'} title="${esc(x.why || '')}"><span>${x.colour ? `<i style="background:${esc(x.colour)}"></i>` : ''}${esc(x.label)}</span></button>`).join('')}</div>`;
        for (const x of m.actions.filter((y) => y.why && !y.enabled)) h += `<div class="op-swhy">${esc(x.why)}</div>`;
      } else if (m.build) {   // an empty pad: what fits, each arming the build list on this pad (the ghost, then CONFIRM)
        h += `<div class="op-shead">Build here</div><div class="op-sbuild">${m.build.map((o) => `<button class="bw-btn" data-a="pickFor" data-kind="${o.kind}" data-pad="${esc(pad)}" ${o.enabled ? '' : 'disabled'} title="${esc(o.why || '')}"><span>${esc(o.name)}</span><span>${o.cost ? fmtGold(o.cost) + 'g' : 'free'}</span></button>`).join('')}</div>`;
        for (const o of m.build.filter((x) => x.why)) h += `<div class="op-swhy">${esc(o.name)}: ${esc(o.why)}</div>`;
      } else {
        // the battle's action row: U upgrade, X sell, R repair (a building or defense; disabled where it does not apply)
        const up = m.upgradeDefense || m.upgrade, sell = m.sell, rep = m.repair;
        const upLabel = up ? `Upgrade (${fmtGold(up.cost)}g)` : (m.title && /on the Upgrade Bay/.test(m.sub || '') ? 'Upgrading' : 'Max Tier');
        const upAct = m.upgradeDefense ? `data-a="upgradeDefense" data-id="${esc(id)}"` : `data-a="upgrade" data-pad="${esc(pad)}"`;
        h += `<div class="bw-selrow">
          <button class="bw-btn" ${upAct} ${up && up.enabled ? '' : 'disabled'}><b class="bw-key">U</b><span> ${esc(upLabel)}</span></button>
          <button class="bw-btn" data-a="sellStructure" ${id != null ? `data-id="${esc(id)}"` : `data-pad="${esc(pad)}"`} ${sell && sell.enabled ? '' : 'disabled'}><b class="bw-key">X</b><span> ${esc(sell ? sell.label : 'Sell')}</span></button>
          <button class="bw-btn" data-a="repair" data-id="${esc(id || '')}" ${rep && rep.enabled ? '' : 'disabled'}><b class="bw-key">R</b><span> ${rep ? `Repair (${fmtGold(rep.cost)}g)` : 'Repair'}</span></button></div>`;
        if (up && up.why) h += `<div class="op-swhy">Upgrade: ${esc(up.why)}</div>`;
        if (sell && sell.why) h += `<div class="op-swhy">Sell: ${esc(sell.why)}</div>`;
      }
      // SELL RESOURCES on a building that holds ore (owner 2026-11-09: "the sell button was off screen, there should be
      // a duplicate sell resources on the build ux in the upper right corner when the building is selected"): the same
      // sale as the bottom SELL button, in the same state
      if (!m.empty && ORE_KINDS.has(m.kind)) {
        const s = lastSell || { enabled: false, sub: '' };
        h += `<button class="bw-btn op-sellres" data-a="sell" ${s.enabled ? '' : 'disabled'}><b>SELL RESOURCES</b><span data-k="psell">${esc(s.sub)}</span></button>`;
      }
      if (m.techs) h += `<div class="op-shead">Outpost tech</div><div class="op-slist">${m.techs.map((t) => `<div class="op-stat" title="${esc(t.effect)} · ${esc(t.note)}"><span class="k">${esc(t.name)}</span><span class="v op-tech-st ${t.state}">${t.state === 'owned' ? 'installed' : t.state === 'buy' ? 'available' : 'locked'}</span></div>`).join('')}</div>`;
      if (m.note) h += `<div class="op-snote">${esc(m.note)}</div>`;
      el.innerHTML = h;
      el.classList.add('open');
    },
    get panelOpen() { return !!panelSel; },
    /** Press the panel's action whose hotkey glyph is `key` (U / X / R), as the battle's keys do. → true when pressed. */
    pressAction(key) {
      const b = [...$('panel').querySelectorAll('.bw-selrow .bw-btn')].find((x) => (x.querySelector('.bw-key') || {}).textContent === key);
      if (!b || b.disabled) return false;
      b.click();
      return true;
    },
    /**
     * The BUILD menu (buildMenu.js items). selected: the armed item's id; icons: { slug: dataURL } rendered from the
     * GLBs (menuIcons.js); rigSlug: the Mining Station's head for its picture. Buttons are made once and updated.
     */
    menu(items, { selected = null, icons = {}, rigSlug = 'rig_auger' } = {}) {
      const row = $('railRow'), had = btns.size;
      for (const it of items) {
        let btn = btns.get(it.id);
        if (!btn) {
          btn = doc.createElement('button');
          btn.className = 'bw-btn bw-buildbtn';
          btn.dataset.a = 'pick'; btn.dataset.id = it.id;
          btn.innerHTML = `<span class="bw-bicon"></span><span class="bw-bname"><span class="op-l">${esc(it.label)}</span><span class="op-s">${esc(SHORT[it.id] || it.label)}</span></span><span class="bw-cost"></span>`;
          row.appendChild(btn);
          btns.set(it.id, btn);
        }
        // the picture: the battle's baked one (defenses, harvester), else the GLB render, else the glyph
        const battle = BATTLE_ICON[it.id] && buildIcon(it.id === 'harvester' ? 'harvester' : { wall: 'STR-Wall', mg: 'STR-MG', cannon: 'STR-Cannon' }[it.id]);
        const slug = it.id === 'rig' ? rigSlug : it.id;
        const src = battle ? new URL('../../../' + buildIconUrl(battle), import.meta.url).href : icons[slug] || null;   // (the game root, wherever the page is)
        const pic = src ? `img:${src.length}:${src.slice(-24)}` : `svg:${it.id}`;
        const ico = btn.querySelector('.bw-bicon');
        if (ico.dataset.pic !== pic) {
          ico.dataset.pic = pic;
          const glyph = OUTPOST_GLYPHS[it.id] || (it.id === 'harvester' ? STRUCT_ICONS.harvestorBay : STRUCT_ICONS[it.id === 'wall' ? 'wall' : 'antiGround']);
          const svg = `<svg viewBox="0 0 24 24" width="26" height="26">${glyph}</svg>`;
          ico.innerHTML = src ? `<img class="bw-bimg" alt="" draggable="false" decoding="async">` : svg;
          if (src) { const img = ico.firstChild; img.src = src; img.addEventListener('error', () => { ico.innerHTML = svg + keyHtml(it); }, { once: true }); }
          if (it.key) ico.insertAdjacentHTML('beforeend', keyHtml(it));
        }
        btn.querySelector('.bw-cost').textContent = it.cost == null ? '—' : fmtGold(it.cost) + 'g';
        let badge = btn.querySelector('.bw-count');
        if (it.max != null) { if (!badge) { badge = doc.createElement('span'); badge.className = 'bw-count'; btn.appendChild(badge); } badge.textContent = `${it.count}/${it.max}`; } else if (badge) badge.remove();
        const lock = btn.querySelector('.bw-lock');
        if (it.locked && !lock) btn.insertAdjacentHTML('beforeend', LOCK_SVG); else if (!it.locked && lock) lock.remove();
        btn.classList.toggle('bw-locked', !!it.locked);
        btn.classList.toggle('bw-poor', !it.locked && !!it.poor);
        btn.classList.toggle('bw-selected', selected === it.id);
        btn.classList.toggle('op-guide', !!it.guide && selected !== it.id);
        btn.title = `${it.key ? `[${it.key}] ` : ''}${it.label}${it.cost != null ? ` · ${fmtGold(it.cost)} gold` : ''}${it.why ? ` — ${it.why}` : ''}`;
        btn.setAttribute('aria-pressed', selected === it.id ? 'true' : 'false');
      }
      // one rail, two lists (story A7): the OUTPOST tab's items and the FARM tab's; the other tab's are hidden
      const shown = new Set(items.map((it) => it.id));
      for (const [id, b] of btns) b.hidden = !shown.has(id);
      if (btns.size !== had) api.fitRail();   // the first build of the list: size the rail to the screen
    },
    /**
     * Size the rail to the height it has, as the battle's reactive left rail does: from under the top bar to the
     * bottom of the screen (portrait: to the action row). Sets --rail-top / --rail-right for the panels and banner.
     */
    fitRail() {
      const rail = $('rail'), view = doc.defaultView;
      if (!rail.isConnected || !btns.size) return null;
      // the battle palette's spot (render/buildPalette.js .bw-palette: left 6, top 56, 6 px off the bottom); owner
      // 2026-11-10 "the exact same placement in outpost that I have in map defense". A taller top bar pushes it down
      // only as far as the battle's 2 px gap under its own bar.
      const r0 = root.getBoundingClientRect(), barBottom = root.querySelector('.op-top').getBoundingClientRect().bottom - r0.top;
      const top = root.dataset.layout === 'portrait' ? barBottom + 12 : Math.max(RAIL_TOP, barBottom + 2);
      root.style.setProperty('--rail-top', Math.round(top) + 'px');
      let bottom = r0.height - 6;
      if (root.dataset.layout === 'portrait') bottom = root.querySelector('.op-actions').getBoundingClientRect().top - r0.top - 8;
      const chrome = 12 + 4 + rail.firstChild.getBoundingClientRect().height + 2;
      const f = railFit(bottom - top, btns.size, chrome, view ? view.innerWidth : r0.width);
      applyRailFit(rail, f);
      rail.classList.toggle('op-narrow', f.w < 70);   // phone-width buttons: the short names (SHORT)
      const right = rail.getBoundingClientRect().right - r0.left;
      root.style.setProperty('--rail-right', Math.round(right) + 'px');
      return { right, fit: f };
    },
    /** The rail's screen rect (the camera framing leaves it clear). */
    railRect() { return $('rail').getBoundingClientRect(); },
    /** The placing banner: text, and CONFIRM when a spot is aimed (touch). null hides it. */
    banner(text, { confirm = false } = {}) { $('banner').classList.toggle('on', !!text); $('bannerText').textContent = text || ''; A('confirmPlace').hidden = !confirm; },
    toast(text, bad = false) {
      const t = $('toast'); t.textContent = text; t.classList.toggle('bad', bad); t.classList.add('on');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
    },
    /** The GO ONLINE card: checks [{ label, ok }], or null to hide. */
    online(checks) {
      const el = $('online');
      if (!checks) { el.classList.remove('on'); return; }
      $('checks').innerHTML = checks.map((c) => `<span class="${c.ok ? '' : 'no'}">${esc(c.label)}</span>`).join('');
      A('online').disabled = checks.some((c) => !c.ok);
      el.classList.add('on');
    },
    /** The away report (awayReport.js model). Rows reveal in order; reduced motion shows them at once. */
    report(m, { reduced = false } = {}) {
      const el = $('report');
      if (!m) { el.classList.remove('on'); el.innerHTML = ''; return; }
      const rows = [];
      if (m.extracted.length) {
        rows.push(`<div class="op-rep-sec"><span>EXTRACTED</span><span>UNITS</span></div>`);
        for (const x of m.extracted) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:${esc(x.colour)}"></span><b>${esc(x.name)}</b><span class="num">+${fmtUnits(x.units)}</span></div>`);
      }
      if (m.harvested && m.harvested.length) {
        rows.push(`<div class="op-rep-sec"><span>HARVESTED · TO YOUR INVENTORY</span><span>UNITS</span></div>`);
        for (const x of m.harvested) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:${esc(x.colour)}"></span><b>${esc(x.name)}</b><span class="num">+${fmtUnits(x.banked || x.units)}</span></div>`);
        if (m.hopperFull) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:#ff8a3a"></span><b>The hopper filled</b><span class="tag bad">STOPPED</span><small>it empties each time you open the outpost</small></div>`);
      }
      if (m.full) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:#ff8a3a"></span><b>${m.full === 1 ? 'A rig bay filled' : `${m.full} rig bays filled`}</b><span class="tag bad">STOPPED</span><small>sell to start the rig again</small></div>`);
      rows.push(`<div class="op-rep-sec"><span>RAIDS</span><span>${m.raids.length ? `${m.held} HELD${m.breached ? ` · ${m.breached} BROKE THROUGH` : ''}` : ''}</span></div>`);
      if (!m.raids.length) rows.push('<div class="op-rep-empty">No raids while you were away.</div>');
      for (const r of m.raids) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:${r.result === 'breach' ? '#d2453a' : '#2fa36b'}"></span><b>${esc(r.label)}</b><span class="tag ${r.result === 'breach' ? 'bad' : ''}">${r.result === 'breach' ? 'BREACH' : 'HELD'}</span><small>${esc(r.when)}${r.lostText ? ' · ' + esc(r.lostText) : ''}${r.damage ? ` · defenses took ${r.damage} damage` : ''}${r.bounty ? ` · kills paid ${r.bounty} gold` : ''}</small></div>`);
      if (m.built.length) {
        rows.push(`<div class="op-rep-sec"><span>CONSTRUCTION</span><span></span></div>`);
        for (const b of m.built) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:#3fd0ff"></span><b>${esc(b)}</b><span></span></div>`);
      }
      el.innerHTML = `<div class="op-rep-scrim"></div><div class="op-rep-card" role="dialog" aria-label="While you were away">
        <div class="op-rep-k">OUTPOST REPORT</div><div class="op-rep-h">WHILE YOU WERE AWAY</div>
        <div class="op-rep-sub">away <b>${esc(m.away)}</b>${m.capped ? ' · storage caps the catch-up at 72 h' : ''}</div>
        ${rows.join('')}
        <div class="op-rep-act"><button class="op-wide" data-a="reportClose">CONTINUE</button></div></div>`;
      el.classList.add('on');
      const items = [...el.querySelectorAll('.op-rep-row')];
      if (reduced) items.forEach((x) => x.classList.add('in'));
      else items.forEach((x, i) => setTimeout(() => x.classList.add('in'), 350 + i * 110));
    },
    /**
     * The STATUS screen (statusReport.js model), in the away report's language and container: what the outpost
     * collects per hour now, and everything it has collected. Closes like the report (CONTINUE / Escape).
     */
    status(m, { reduced = false } = {}) {
      const el = $('report');
      if (!m) { el.classList.remove('on'); el.innerHTML = ''; return; }
      const dot = (c) => `<span class="op-rep-dot" style="--c:${esc(c)}"></span>`;
      const rows = [];
      rows.push(`<div class="op-rep-sec"><span>COLLECTING NOW</span><span>PER HOUR</span></div>`);
      if (!m.rates.ore.length && !m.rates.harvest.length) rows.push('<div class="op-rep-empty">Nothing is being collected. Build a mining station on a deposit and power it.</div>');
      for (const x of m.rates.ore) rows.push(`<div class="op-rep-row">${dot(x.colour)}<b>${esc(x.name)}</b>${x.stopped ? `<span class="tag bad">${esc(x.stopped)}</span>` : `<span class="num">${fmtPerHour(x.perHour)}</span>`}${x.stopped ? `<small>${x.stopped === 'BAY FULL' ? 'sell to start the rig again' : 'connect a power station'}</small>` : x.note ? `<small>${esc(x.note)}</small>` : ''}</div>`);
      for (const x of m.rates.harvest) rows.push(`<div class="op-rep-row">${dot(x.colour)}<b>${esc(x.name)}</b><span class="num">${fmtPerHour(x.perHour)}</span><small>harvesters · to your inventory</small></div>`);
      rows.push(`<div class="op-rep-sec"><span>TOTAL COLLECTED</span><span>UNITS</span></div>`);
      if (!m.totals.ore.length && !m.totals.harvest.length) rows.push('<div class="op-rep-empty">Nothing collected yet.</div>');
      for (const x of m.totals.ore) rows.push(`<div class="op-rep-row">${dot(x.colour)}<b>${esc(x.name)}</b><span class="num">${fmtUnits(x.units)}</span></div>`);
      for (const x of m.totals.harvest) rows.push(`<div class="op-rep-row">${dot(x.colour)}<b>${esc(x.name)}</b><span class="num">${fmtUnits(x.units)}</span><small>harvested</small></div>`);
      rows.push(`<div class="op-rep-row">${dot('#f2c869')}<b>Gold from sales</b><span class="num">${fmtGold(m.totals.gold)}</span><small>${m.totals.loads} ${m.totals.loads === 1 ? 'load' : 'loads'} sold</small></div>`);
      el.innerHTML = `<div class="op-rep-scrim"></div><div class="op-rep-card" role="dialog" aria-label="Outpost status">
        <div class="op-rep-k">OUTPOST STATUS</div><div class="op-rep-h">COLLECTION</div>
        <div class="op-rep-sub">${m.online ? 'online' : 'not online yet'}${m.since ? ` · founded <b>${esc(m.since)}</b> ago` : ''}</div>
        ${rows.join('')}
        <div class="op-rep-act"><button class="op-wide" data-a="reportClose">CONTINUE</button></div></div>`;
      el.classList.add('on');
      const items = [...el.querySelectorAll('.op-rep-row')];
      if (reduced) items.forEach((x) => x.classList.add('in'));
      else items.forEach((x, i) => setTimeout(() => x.classList.add('in'), 250 + i * 80));
    },
    get reportOpen() { return $('report').classList.contains('on'); },
    /** CSS px the HUD covers (for the camera framing): measured, so it follows the real layout. */
    measure() {
      const r0 = root.getBoundingClientRect(), top = root.querySelector('.op-top').getBoundingClientRect();
      const act = root.querySelector('.op-actions').getBoundingClientRect();
      return { top: top.bottom - r0.top + 6, act, w: r0.width, h: r0.height };
    },
    dispose() { clearTimeout(toastTimer); root.remove(); },
  };
  return api;
}

export const tierName = (t) => ROMAN[t] || String(t);
