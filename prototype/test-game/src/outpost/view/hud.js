/**
 * src/outpost/view/hud.js — the outpost HUD, panels, BUILD sheet, GO ONLINE card and away report (DOM)
 * [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.1; design §8.1 (the concept's materials carried into the UI): light grey and
 * white panels over dark chamfered bases, orange trim stripes, cyan for power and light. Type: Orbitron for numbers and
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
import { fmtGold, fmtUnits, sellButton, ROMAN } from './hudModel.js';
import { PALETTE_CSS, paletteBaseCss, railFit, applyRailFit, STRUCT_ICONS } from '../../render/buildPalette.js';
import { buildIcon, buildIconUrl } from '../../render/buildIcons.js';
import { OUTPOST_GLYPHS } from './menuIcons.js';
import { BATTLE_ICON } from './buildMenu.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CH = 'clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)';

export const HUD_CSS = `
.op { position:absolute; inset:0; z-index:40; pointer-events:none; overflow:hidden; font-family:Rajdhani,"Segoe UI",system-ui,sans-serif;
  color:#1c2228; -webkit-font-smoothing:antialiased; user-select:none; -webkit-user-select:none;
  --panel:linear-gradient(180deg,#f4f6f8 0%,#dfe4e9 100%); --base:#2b3036; --base2:#1d2125; --trim:#eb5c0d; --trim-hi:#ff8a3a;
  --cyan:#3fd0ff; --cyan-d:#0a8fc4; --ink:#1c2228; --dim:#5d6873; --ok:#2fa36b; --warn:#d98a12; --bad:#d2453a; --gold:#c98a12;
  --fs:clamp(12px, 1.9vmin, 15px); font-size:var(--fs); }
.op * { box-sizing:border-box; }
.op [hidden] { display:none !important; }
.op button { font:inherit; color:inherit; cursor:pointer; pointer-events:auto; -webkit-tap-highlight-color:transparent; }
.op button:focus-visible { outline:2px solid var(--cyan); outline-offset:2px; }
.op .num { font-family:Orbitron,Rajdhani,sans-serif; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:.02em; }

/* ── top bar: a light plate on a dark chamfered base with an orange stripe ── */
.op-top { position:absolute; left:0; right:0; top:0; display:flex; align-items:center; gap:10px; pointer-events:auto;
  padding:max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 9px max(10px, env(safe-area-inset-left));
  background:var(--panel); box-shadow:0 3px 0 var(--trim), 0 7px 0 var(--base), 0 10px 18px rgba(0,0,0,.35); }
.op-back { flex:0 0 auto; width:38px; height:38px; border:0; background:var(--base); color:#fff; font-size:20px; line-height:1; ${CH}; }
.op-back:hover { background:#3a4148; }
.op-title { flex:0 0 auto; min-width:0; }
.op-title b { display:block; font-family:Orbitron,sans-serif; font-weight:900; font-size:1.05em; letter-spacing:.16em; white-space:nowrap; }
.op-title i { display:block; font-style:normal; font-size:.8em; letter-spacing:.22em; color:var(--dim); white-space:nowrap; font-weight:700; }
.op-stats { flex:1 1 auto; display:flex; align-items:center; justify-content:flex-end; gap:8px; min-width:0; flex-wrap:nowrap; }
.op-chip { display:flex; align-items:center; gap:6px; padding:4px 9px 4px 6px; background:#fff; border:1px solid #c5cdd5; border-bottom:2px solid #aab4be;
  white-space:nowrap; min-width:0; ${CH.replace(/9px/g, '6px')}; }
.op-chip .lbl { font-size:.72em; letter-spacing:.2em; color:var(--dim); font-weight:700; }
.op-chip .num { font-size:1em; }
.op-chip.gold .num { color:#8a5a00; }
.op-ico { width:18px; height:18px; flex:0 0 auto; display:block; }
.op-ores { display:flex; gap:6px; }
.op-ore { display:flex; align-items:center; gap:4px; }
.op-glyph { width:16px; height:16px; flex:0 0 auto; clip-path:polygon(50% 0,100% 28%,100% 72%,50% 100%,0 72%,0 28%);
  background:linear-gradient(140deg, rgba(255,255,255,.75), transparent 45%), var(--c); box-shadow:inset 0 0 0 1px rgba(0,0,0,.25); }
.op-bar { position:relative; width:64px; height:9px; background:#c9d1d9; border:1px solid #a9b3bd; overflow:hidden; }
.op-bar > i { position:absolute; left:0; top:0; bottom:0; width:0; background:linear-gradient(90deg,var(--cyan-d),var(--cyan)); transition:width .4s; }
.op-bar.full > i { background:linear-gradient(90deg,#c26a00,var(--trim-hi)); }
.op-chip.power .num { color:var(--cyan-d); }
.op-chip.power.short .num { color:var(--bad); }
.op-shield { position:relative; width:18px; height:20px; }
.op-shield svg { position:absolute; inset:0; width:100%; height:100%; }
.op-chip.worn .num { color:var(--warn); }

/* ── bottom actions: big chamfered buttons; SELL is the orange one ── */
.op-actions { position:absolute; left:50%; transform:translateX(-50%); bottom:max(14px, env(safe-area-inset-bottom)); display:flex; gap:10px; align-items:flex-end; pointer-events:none; }
.op-btn { position:relative; min-width:108px; height:58px; padding:0 18px; border:0; background:var(--panel); color:var(--ink);
  display:flex; flex-direction:column; align-items:center; justify-content:center; ${CH}; box-shadow:inset 0 -5px 0 var(--base); }
.op-btn b { font-family:Orbitron,sans-serif; font-weight:900; font-size:1.05em; letter-spacing:.14em; line-height:1.1; }
.op-btn i { font-style:normal; font-size:.82em; font-weight:700; letter-spacing:.1em; color:var(--dim); }
.op-btn:hover:not(:disabled) { filter:brightness(1.06); }
.op-btn:active:not(:disabled) { transform:translateY(2px); box-shadow:inset 0 -3px 0 var(--base); }
.op-btn:disabled { opacity:.55; cursor:default; }
.op-btn.sell { min-width:150px; height:66px; background:linear-gradient(180deg,#ff9a4a,var(--trim) 60%,#c64a06); color:#fff; box-shadow:inset 0 -6px 0 #6e2a05, inset 0 2px 0 rgba(255,255,255,.35); }
.op-btn.sell b { font-size:1.3em; text-shadow:0 2px 0 rgba(0,0,0,.25); }
.op-btn.sell i { color:#fff3e6; }
.op-btn.sell:disabled { background:linear-gradient(180deg,#e7ebef,#c9d0d6); color:#7c8792; box-shadow:inset 0 -6px 0 var(--base); opacity:.9; }
.op-btn.sell:disabled i { color:#7c8792; }
.op-btn.sell.ready::after { content:""; position:absolute; inset:0; background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%) -150% 0/250% 100% no-repeat; animation:op-sweep 2.4s ease-in-out infinite; }
@keyframes op-sweep { 0%,55% { background-position:-150% 0; } 100% { background-position:150% 0; } }
.op-btn.repair b { color:var(--warn); }
.op-btn.on { box-shadow:inset 0 -5px 0 var(--cyan-d), inset 0 0 0 2px var(--cyan); }

/* ── the panel: a light card, orange stripe on its top, dark base ── */
.op-panel { position:absolute; pointer-events:auto; background:var(--panel); ${CH}; box-shadow:inset 0 -6px 0 var(--base);
  padding:14px 16px 18px; display:none; max-height:calc(100% - 140px); overflow-y:auto; overscroll-behavior:contain; }
.op-panel.open { display:block; animation:op-in .22s cubic-bezier(.2,1,.3,1); }
@keyframes op-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
.op-panel::before { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:linear-gradient(90deg,var(--trim),var(--trim-hi) 60%,transparent); }
.op-ph { display:flex; align-items:flex-start; gap:10px; margin-bottom:8px; }
.op-ph h3 { margin:0; font-family:Orbitron,sans-serif; font-weight:900; font-size:1.08em; letter-spacing:.08em; line-height:1.2; }
.op-ph small { display:block; color:var(--dim); font-weight:700; letter-spacing:.14em; font-size:.78em; text-transform:uppercase; }
.op-x { margin-left:auto; flex:0 0 auto; width:30px; height:30px; border:0; background:var(--base); color:#fff; font-size:16px; ${CH.replace(/9px/g, '6px')}; }
.op-status { display:inline-flex; align-items:center; gap:6px; font-weight:700; letter-spacing:.08em; padding:3px 9px; margin:0 0 10px; background:#fff; border:1px solid #c5cdd5; }
.op-status::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--c, var(--ok)); box-shadow:0 0 6px var(--c, var(--ok)); }
.op-status.warn { --c:var(--warn); } .op-status.off { --c:var(--bad); } .op-status.busy { --c:var(--cyan-d); }
.op-kv { display:grid; grid-template-columns:auto 1fr; gap:3px 14px; margin:0 0 10px; }
.op-kv dt { color:var(--dim); font-weight:700; letter-spacing:.1em; font-size:.86em; text-transform:uppercase; }
.op-kv dd { margin:0; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; }
.op-meter { height:10px; background:#c9d1d9; border:1px solid #a9b3bd; margin:0 0 12px; position:relative; overflow:hidden; }
.op-meter i { position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg,var(--cyan-d),var(--cyan)); }
.op-meter.hp i { background:linear-gradient(90deg,#c0392b,#f0a030 50%,var(--ok)); }
.op-switch { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 10px; background:#fff; border:1px solid #c5cdd5; margin:0 0 10px; }
.op-switch b { display:block; letter-spacing:.08em; }
.op-switch small { color:var(--dim); font-weight:600; }
.op-seg { display:flex; background:var(--base); padding:3px; gap:3px; ${CH.replace(/9px/g, '5px')}; }
.op-seg button { border:0; background:transparent; color:#cfd6dd; font-family:Orbitron,sans-serif; font-weight:800; font-size:.78em; letter-spacing:.1em; padding:7px 10px; }
.op-seg button.on { background:var(--cyan); color:#082230; }
.op-seg button:disabled { opacity:.45; cursor:default; }
.op-wide { width:100%; height:46px; border:0; margin-top:4px; font-family:Orbitron,sans-serif; font-weight:900; letter-spacing:.1em; font-size:.92em;
  background:linear-gradient(180deg,#ff9a4a,var(--trim) 60%,#c64a06); color:#fff; ${CH}; box-shadow:inset 0 -5px 0 #6e2a05; }
.op-wide.alt { background:linear-gradient(180deg,#4a5560,#2b3036); box-shadow:inset 0 -5px 0 #111; }
.op-wide:disabled { background:#c9d0d6; color:#6f7a85; box-shadow:inset 0 -5px 0 var(--base); cursor:default; }
.op-why { color:var(--dim); font-size:.86em; font-weight:600; margin-top:4px; text-align:center; }
.op-list { display:flex; flex-direction:column; gap:6px; }
.op-opt { display:grid; grid-template-columns:1fr auto; align-items:center; gap:2px 10px; text-align:left; padding:9px 12px; border:1px solid #c5cdd5;
  background:#fff; border-left:4px solid var(--trim); }
.op-opt:hover:not(:disabled) { border-color:var(--trim); }
.op-opt:disabled { opacity:.55; border-left-color:#a9b3bd; cursor:default; }
.op-opt b { letter-spacing:.06em; font-size:1.02em; }
.op-opt small { grid-column:1; color:var(--dim); font-weight:600; }
.op-opt .num { grid-row:1 / span 2; grid-column:2; color:#8a5a00; }
.op-sec { margin:12px 0 6px; font-size:.76em; letter-spacing:.28em; font-weight:800; color:var(--dim); }

/* ── banners and toasts ── */
.op-banner { position:absolute; left:50%; transform:translateX(-50%); display:none; align-items:center; gap:12px; padding:9px 10px 9px 16px; pointer-events:auto;
  background:var(--base); color:#e8eef5; font-weight:700; letter-spacing:.06em; ${CH}; box-shadow:inset 0 -3px 0 var(--cyan-d); max-width:calc(100% - 24px); }
.op-banner.on { display:flex; }
.op-banner button { border:0; background:#4a5560; color:#fff; padding:6px 12px; font-weight:800; letter-spacing:.1em; ${CH.replace(/9px/g, '5px')}; }
.op-toast { position:absolute; left:50%; transform:translate(-50%,8px); top:96px; padding:8px 16px; background:rgba(29,33,37,.94); color:#fff; font-weight:700;
  letter-spacing:.06em; opacity:0; transition:opacity .2s, transform .2s; pointer-events:none; ${CH.replace(/9px/g, '6px')}; border-left:3px solid var(--trim); max-width:90%; text-align:center; }
.op-toast.on { opacity:1; transform:translate(-50%,0); }
.op-toast.bad { border-left-color:var(--bad); }

/* ── GO ONLINE: the contract's first step ── */
.op-online { position:absolute; pointer-events:auto; display:none; background:var(--panel); ${CH}; box-shadow:inset 0 -6px 0 var(--base); padding:16px 18px 18px; width:min(380px, calc(100% - 24px)); }
.op-online.on { display:block; animation:op-in .3s cubic-bezier(.2,1,.3,1); }
.op-online::before { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:linear-gradient(90deg,var(--cyan),var(--cyan-d) 60%,transparent); }
.op-online h3 { margin:0 0 2px; font-family:Orbitron,sans-serif; font-weight:900; letter-spacing:.12em; font-size:1.1em; }
.op-online p { margin:0 0 10px; color:var(--dim); font-weight:600; }
.op-check { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px 12px; margin:0 0 12px; }
.op-check span { display:flex; align-items:center; gap:7px; font-weight:700; letter-spacing:.04em; }
.op-check span::before { content:"✓"; display:grid; place-items:center; width:18px; height:18px; background:var(--ok); color:#fff; font-size:12px; }
.op-check span.no::before { content:"!"; background:var(--bad); }
.op-online .op-wide { background:linear-gradient(180deg,#6fe3ff,var(--cyan) 50%,var(--cyan-d)); color:#062433; box-shadow:inset 0 -5px 0 #075a7d; }

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
.op[data-layout="portrait"] .op-panel { left:8px; right:8px; bottom:max(8px, env(safe-area-inset-bottom)); max-height:46%; z-index:2; }
.op[data-layout="portrait"] .op-online { left:50%; transform:translateX(-50%); bottom:max(92px, calc(env(safe-area-inset-bottom) + 84px)); }
.op[data-layout="portrait"] .op-banner { bottom:96px; }
.op[data-layout="portrait"] .op-toast { top:112px; }
.op[data-layout="landscape"] { --fs:clamp(11px, 2.9vmin, 14px); }
.op[data-layout="landscape"] .op-top { padding-top:max(5px, env(safe-area-inset-top)); padding-bottom:6px; gap:8px; }
.op[data-layout="landscape"] .op-back { width:32px; height:32px; font-size:17px; }
.op[data-layout="landscape"] .op-title i { display:none; }
.op[data-layout="landscape"] .op-chip .lbl { display:none; }
.op[data-layout="landscape"] .op-bar { width:42px; }
.op[data-layout="landscape"] .op-actions { left:auto; transform:none; right:max(10px, env(safe-area-inset-right)); bottom:max(10px, env(safe-area-inset-bottom)); flex-direction:column; align-items:stretch; }
.op[data-layout="landscape"] .op-btn.repair { order:2; } .op[data-layout="landscape"] .op-btn.sell { order:3; }
.op[data-layout="landscape"] .op-btn { height:48px; min-width:150px; }
.op[data-layout="landscape"] .op-btn.sell { height:58px; }
.op[data-layout="landscape"] .op-panel { left:max(8px, env(safe-area-inset-left)); top:58px; bottom:8px; width:min(300px, 36%); max-height:none; }
.op[data-layout="landscape"] .op-online { left:max(10px, env(safe-area-inset-left)); bottom:10px; width:min(330px, 44%); padding:12px 14px 14px; }
.op[data-layout="landscape"] .op-online p { display:none; }
.op[data-layout="landscape"] .op-banner { top:54px; }
.op[data-layout="landscape"] .op-toast { top:56px; }
.op[data-layout="desktop"] .op-panel { right:18px; top:86px; width:330px; }
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
  color:transparent; background:linear-gradient(105deg, transparent 0 42%, #fff8e0 50%, transparent 58% 100%) 120% 0 / 260% 100% no-repeat #ff9a4a;
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
.op .bw-palette.op-rail { left:max(6px, env(safe-area-inset-left)); top:var(--rail-top, 70px); z-index:1; }
.op .bw-buildbtn { position:relative; }
.op .bw-bname .op-s { display:none; }
.op .bw-palette.op-narrow .bw-bname { letter-spacing:.02em; }
.op .bw-palette.op-narrow .bw-bname .op-l { display:none; }
.op .bw-palette.op-narrow .bw-bname .op-s { display:inline; }
.op .bw-buildbtn .bw-cost { font-family:'Courier New', monospace; font-weight:700; }
.op .bw-buildbtn.bw-poor .bw-cost { color:#ff6a5a; }
.op .bw-buildbtn.bw-locked { opacity:0.45; }
.op .bw-buildbtn.bw-locked .bw-cost { color:#9aa6b4; }
.op .bw-lock { position:absolute; top:2px; right:3px; width:11px; height:12px; }
.op .bw-count { position:absolute; top:1px; right:3px; font-size:9px; font-weight:800; color:#bfe0ff; text-shadow:0 1px 2px #000; }
.op .bw-buildbtn.bw-locked .bw-count { right:15px; }
.op .bw-buildbtn.op-guide { border-color:#5fe0ff; animation:op-guide 1.6s ease-in-out infinite; }
@keyframes op-guide { 0%,100% { box-shadow:0 0 10px -4px #5fe0ff; } 50% { box-shadow:0 0 18px 0 #5fe0ff; } }
.op .bw-buildbtn.op-guide::after { content:"▸"; position:absolute; right:-11px; top:50%; transform:translateY(-50%); color:#5fe0ff; font-size:14px; text-shadow:0 0 6px #5fe0ff; animation:op-nudge 1.6s ease-in-out infinite; }
@keyframes op-nudge { 0%,100% { transform:translate(0,-50%); } 50% { transform:translate(4px,-50%); } }
.op-banner .op-confirm { background:linear-gradient(180deg,#6fe3ff,var(--cyan) 50%,var(--cyan-d)); color:#062433; }
.op-warn { display:flex; align-items:center; gap:8px; margin:0 0 10px; padding:7px 10px; background:#fff4e0; border:1px solid #e6b45a; border-left:4px solid var(--warn); font-weight:700; letter-spacing:.03em; }
.op-warn.bad { background:#fde9e7; border-color:#e5a39c; border-left-color:var(--bad); }
.op-warn svg { width:18px; height:18px; flex:0 0 auto; }
.op-chips { display:flex; flex-wrap:wrap; gap:6px; }
.op-chips .op-opt { flex:1 1 auto; }
.op[data-layout="portrait"] .op-banner, .op[data-layout="landscape"] .op-banner { left:calc(var(--rail-right, 0px) + 8px); right:8px; transform:none; max-width:none; justify-content:space-between; }
.op[data-layout="landscape"] .op-banner { right:calc(min(190px, 24%) + 8px); }
.op[data-layout="portrait"] .op-online { left:calc(var(--rail-right, 0px) + 8px); right:8px; width:auto; transform:none; }
.op[data-layout="landscape"] .op-panel { left:calc(var(--rail-right, 150px) + 8px); }
.op[data-layout="landscape"] .op-online { left:calc(var(--rail-right, 150px) + 8px); }
@media (prefers-reduced-motion: reduce) { .op *, .op *::before, .op *::after { animation:none !important; transition:none !important; } .op-rep-row { opacity:1; transform:none; } }
`;

/** Names for the narrow two-column rail (a landscape phone), where the long ones would clip. */
const SHORT = { power: 'POWER', rig: 'MINING', storage: 'STORAGE', resourceBay: 'RES. BAY', upgradeBay: 'UPGRADE', cannon: 'CANNON' };
const LOCK_SVG ='<svg class="bw-lock" viewBox="0 0 11 12"><rect x="1" y="5" width="9" height="7" rx="1" fill="#cfd6dd"/><path d="M3 5V3.6a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="#cfd6dd" stroke-width="1.5"/></svg>';
export const WARN_SVG = {
  bolt: '<svg viewBox="0 0 20 20"><path d="M11.5 1 3.5 11.5h5L7.5 19l9-11.5h-5.2z" fill="#ffd23a" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  crate: '<svg viewBox="0 0 20 20"><rect x="2" y="5" width="16" height="12" fill="#c98a12" stroke="#5a3a00" stroke-width="1.3"/><path d="M2 9h16M7 5v12M13 5v12" stroke="#5a3a00" stroke-width="1.1"/><path d="M5 1.5h10l1.5 3.5h-13z" fill="#e0a83a" stroke="#5a3a00" stroke-width="1"/></svg>',
  door: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" fill="#3a4148" stroke="#111" stroke-width="1.2"/><path d="M3 6h14M3 10h14M3 14h14" stroke="#d2453a" stroke-width="1.4"/></svg>',
};

const ICON = {
  coin: '<svg class="op-ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.2" fill="#f2c040" stroke="#8a5a00" stroke-width="1.6"/><circle cx="10" cy="10" r="5" fill="none" stroke="#b07a10" stroke-width="1.4"/></svg>',
  bolt: '<svg class="op-ico" viewBox="0 0 20 20"><path d="M11.5 1 3.5 11.5h5L7.5 19l9-11.5h-5.2z" fill="#3fd0ff" stroke="#0a6f99" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  box: '<svg class="op-ico" viewBox="0 0 20 20"><path d="M10 1.8 17.5 6v8L10 18.2 2.5 14V6z" fill="#cfd6dd" stroke="#4a5560" stroke-width="1.4" stroke-linejoin="round"/><path d="M2.5 6 10 10l7.5-4M10 10v8" fill="none" stroke="#4a5560" stroke-width="1.2"/></svg>',
};
const shieldSvg = (frac) => `<svg viewBox="0 0 18 20"><defs><clipPath id="opsc"><rect x="0" y="${(20 * (1 - frac)).toFixed(1)}" width="18" height="20"/></clipPath></defs>
  <path d="M9 1 16.5 4v6c0 4.6-3.2 7.6-7.5 9C4.7 17.6 1.5 14.6 1.5 10V4z" fill="#c9d1d9" stroke="#4a5560" stroke-width="1.3"/>
  <path d="M9 1 16.5 4v6c0 4.6-3.2 7.6-7.5 9C4.7 17.6 1.5 14.6 1.5 10V4z" fill="${frac < 0.4 ? '#d2453a' : frac < 1 ? '#e0a020' : '#2fa36b'}" clip-path="url(#opsc)"/></svg>`;

/**
 * mountHud(host, cbs) → the HUD. cbs: { onClose, onSell, onRepairAll, onOnline, onPanelClose, onPick(menuId),
 * onPickFor(kind, pad), onConfirmPlace, onCancelPlace, onDeep(pad, on), onUpgrade(pad), onRepair(id), onReportClose }
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
      <div class="op-stats">
        <div class="op-chip gold" title="Gold">${ICON.coin}<span class="num" data-k="gold">0</span></div>
        <div class="op-chip" title="Ore in storage"><div class="op-ores" data-k="ores"></div></div>
        <div class="op-chip" title="Storage">${ICON.box}<div class="op-bar" data-k="storeBar"><i></i></div><span class="num" data-k="store">0%</span></div>
        <div class="op-chip power" title="Power used / supplied">${ICON.bolt}<span class="num" data-k="power">0/0</span><span class="lbl">POWER</span></div>
        <div class="op-chip shield" title="Defenses"><span class="op-shield" data-k="shieldIco"></span><span class="num" data-k="shield">100%</span></div>
      </div>
    </div>
    <div class="bw-palette bw-panel op-rail" data-k="rail" role="toolbar" aria-label="Build"><div class="bw-title">BUILD</div><div class="bw-palette-row" data-k="railRow"></div></div>
    <div class="op-actions">
      <button class="op-btn sell" data-a="sell"><b>SELL</b><i data-k="loads">no full load</i></button>
      <button class="op-btn repair" data-a="repairAll" hidden><b>REPAIR</b><i data-k="repair">0</i></button>
    </div>
    <div class="op-panel" data-k="panel" role="dialog" aria-live="polite"></div>
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

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || !root.contains(b)) return;
    const a = b.dataset.a;
    if (!a) return;
    const call = (fn, ...args) => cbs[fn] && cbs[fn](...args);
    if (a === 'close') call('onClose');
    else if (a === 'sell') call('onSell');
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
    else if (a === 'reportClose') call('onReportClose');
  });
  // the HUD's own pointer events never reach the canvas under it
  for (const t of ['pointerdown', 'wheel']) root.addEventListener(t, (e) => { if (e.target !== root) e.stopPropagation(); }, { passive: true });

  const api = {
    root,
    setLayout(mode) { root.dataset.layout = mode; },
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
      A('repairAll').hidden = !h.shield.worn;
      $('repair').textContent = h.repairCost ? `${fmtGold(h.repairCost)} gold` : '';
      A('repairAll').disabled = h.repairCost > gold;
    },
    setBusy(b) { A('sell').disabled = b || A('sell').disabled; $('rail').style.pointerEvents = b ? 'none' : ''; $('rail').style.opacity = b ? '.6' : ''; },
    /** The selected building's panel (hudModel.panelModel), or null to close. sel echoes back in callbacks. */
    panel(m, sel) {
      const el = $('panel');
      panelSel = m ? sel : null;
      if (!m) { el.classList.remove('open'); el.innerHTML = ''; return; }
      const pad = sel && sel.pad, id = sel && sel.defense;
      let body = `<div class="op-ph"><div><h3>${esc(m.title)}</h3><small>${esc(m.sub)}</small></div><button class="op-x" data-a="panelClose" aria-label="Close">✕</button></div>
        <div class="op-status ${m.tone}">${esc(m.status)}</div>`;
      for (const w of m.warnings || []) body += `<div class="op-warn ${w.icon === 'crate' ? '' : 'bad'}">${WARN_SVG[w.icon] || ''}<span>${esc(w.text)}</span></div>`;
      if (m.stats && m.stats.length) body += `<dl class="op-kv">${m.stats.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
      if (m.bay != null) body += `<div class="op-meter" title="Bay"><i style="width:${(m.bay * 100).toFixed(1)}%${m.oreColour ? `;background:linear-gradient(90deg,${m.oreColour},${m.oreColour}cc)` : ''}"></i></div>`;
      if (m.hp != null) body += `<div class="op-meter hp"><i style="width:${(m.hp * 100).toFixed(1)}%"></i></div>`;
      if (m.deep) {
        body += `<div class="op-switch"><div><b>SEAM</b><small>${esc(m.deep.note)}</small></div><div class="op-seg">
          <button data-a="deep" data-pad="${esc(pad)}" data-on="0" class="${m.deep.on ? '' : 'on'}">SHALLOW</button>
          <button data-a="deep" data-pad="${esc(pad)}" data-on="1" class="${m.deep.on ? 'on' : ''}" ${m.deep.enabled ? '' : 'disabled'}>DEEP</button></div></div>`;
      }
      if (m.upgrade) body += `<button class="op-wide alt" data-a="upgrade" data-pad="${esc(pad)}" ${m.upgrade.enabled ? '' : 'disabled'}>${esc(m.upgrade.label)}</button>${m.upgrade.why ? `<div class="op-why">${esc(m.upgrade.why)}</div>` : ''}`;
      if (m.repair) body += `<button class="op-wide" data-a="repair" data-id="${esc(id)}" ${m.repair.enabled ? '' : 'disabled'}>${esc(m.repair.label)}</button>`;
      if (m.build) {   // an empty pad: what fits, each one arming the build menu on this pad (the ghost, then CONFIRM)
        body += `<div class="op-sec">FITS HERE · OR PICK FROM THE LIST</div><div class="op-list op-chips">${m.build.map((o) => `<button class="op-opt" data-a="pickFor" data-kind="${o.kind}" data-pad="${esc(pad)}" ${o.enabled ? '' : 'disabled'}>
          <b>${esc(o.name)}</b><span class="num">${o.cost ? fmtGold(o.cost) : 'FREE'}</span><small>${o.why ? esc(o.why) : `${Math.round(o.buildSec / 60)} min to build`}</small></button>`).join('')}</div>`;
      }
      el.innerHTML = body;
      el.classList.add('open');
    },
    get panelOpen() { return !!panelSel; },
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
      if (btns.size !== had) api.fitRail();   // the first build of the list: size the rail to the screen
    },
    /**
     * Size the rail to the height it has, as the battle's reactive left rail does: from under the top bar to the
     * bottom of the screen (portrait: to the action row). Sets --rail-top / --rail-right for the panels and banner.
     */
    fitRail() {
      const rail = $('rail'), view = doc.defaultView;
      if (!rail.isConnected || !btns.size) return null;
      const r0 = root.getBoundingClientRect(), top = root.querySelector('.op-top').getBoundingClientRect().bottom - r0.top + 12;
      root.style.setProperty('--rail-top', Math.round(top) + 'px');
      let bottom = r0.height - 8;
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
      if (m.full) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:#ff8a3a"></span><b>${m.full === 1 ? 'A rig bay filled' : `${m.full} rig bays filled`}</b><span class="tag bad">STOPPED</span><small>sell to start the rig again</small></div>`);
      rows.push(`<div class="op-rep-sec"><span>RAIDS</span><span>${m.raids.length ? `${m.held} HELD${m.breached ? ` · ${m.breached} BROKE THROUGH` : ''}` : ''}</span></div>`);
      if (!m.raids.length) rows.push('<div class="op-rep-empty">No raids while you were away.</div>');
      for (const r of m.raids) rows.push(`<div class="op-rep-row"><span class="op-rep-dot" style="--c:${r.result === 'breach' ? '#d2453a' : '#2fa36b'}"></span><b>${esc(r.label)}</b><span class="tag ${r.result === 'breach' ? 'bad' : ''}">${r.result === 'breach' ? 'BREACH' : 'HELD'}</span><small>${esc(r.when)}${r.lostText ? ' · ' + esc(r.lostText) : ''}${r.damage ? ` · defenses took ${r.damage} damage` : ''}</small></div>`);
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
