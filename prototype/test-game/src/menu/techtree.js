/**
 * src/menu/techtree.js — the TECH TREE screen (ported from the Claude Design proof / IMG_6938).
 *
 * A DOM overlay screen for the main menu: a root SYS-BASE node fanning through four curved,
 * color-coded paths into image node-cards, with a gold ULTIMATE capstone, a tier-progress panel,
 * and a selected-node inspector carrying the RESEARCH button.
 *
 *   Tier clearance (1..4)  earned by beating Map-2 factions (any order) — gates what's buyable.
 *   Gold                   spends the campaign gold bank (carry.gold) to research a node.
 *
 * Content values (order / stat / price / influence) live in techtree.data.js and are placeholders
 * the owner will retune — see docs/sources/Bulwark-Tech-Tree-Epic.md.
 */
import { loadSave, buyResearch, techClearance } from '../save/save.js';
import { PATHS, NODES, ULT, PATH_COLOR } from './techtree.data.js';

const CSS = `
.bwm-tt{ position:relative; padding:14px clamp(20px,4vw,60px) 40px; overflow-y:auto; overflow-x:hidden;
  flex:1; min-height:0;
  font-variant-numeric:tabular-nums; --gold:#f2c869; --gold-deep:#d9a441; --chrome:#2e3846;
  --panel:#161b24; --panel-hi:#1c2330; --ink:#e6ecf3; --ink-dim:#9aabbd; --ink-mut:#6b7c90; --good:#57d98a; --bad:#e46a6a; }
.bwm-tt .tt-top{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; }
.bwm-tt h2.tt-title{ margin:0; font-size:clamp(26px,4vw,40px); font-weight:900; letter-spacing:.02em; text-transform:uppercase; }
.bwm-tt h2.tt-title em{ font-style:normal; color:var(--gold); }
.bwm-tt .tt-sub{ font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:var(--ink-mut); margin-top:4px; }
.bwm-tt .tt-res{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.bwm-tt .tt-chip{ display:flex; align-items:center; gap:8px; padding:8px 14px 8px 10px; border-radius:999px;
  background:linear-gradient(180deg,var(--panel-hi),var(--panel)); border:1px solid var(--chrome); }
.bwm-tt .tt-chip .ic{ display:grid; place-items:center; }
.bwm-tt .tt-chip b{ font-size:15px; font-weight:800; }
.bwm-tt .tt-chip small{ display:block; font-size:8.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-mut); }
.bwm-tt .tt-chip.gold b{ color:var(--gold); }
.bwm-tt .tt-back{ font-family:inherit; cursor:pointer; border:1px solid var(--chrome); background:var(--panel);
  color:var(--ink); border-radius:9px; padding:9px 16px; font-size:12px; letter-spacing:.14em; }
.bwm-tt .tt-back:hover{ border-color:var(--gold-deep); }

.bwm-tt .tt-board{ position:relative; margin-top:20px; }
.bwm-tt .tt-wires{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1; overflow:visible; }
.bwm-tt .tt-grid{ position:relative; z-index:2; display:grid; grid-template-columns:150px repeat(4,1fr); gap:18px 22px; align-items:start; }

.bwm-tt .tt-root{ align-self:center; }
.bwm-tt .tt-rootcard{ border:1px solid #3c4a5c; border-radius:12px; padding:12px; text-align:center;
  background:radial-gradient(120% 120% at 50% 0%, rgba(242,200,105,.14), transparent 70%), linear-gradient(180deg,var(--panel-hi),var(--panel));
  box-shadow:0 0 0 1px rgba(242,200,105,.14), 0 10px 26px rgba(0,0,0,.5); }
.bwm-tt .tt-rootcard b{ display:block; font-size:12px; letter-spacing:.06em; }
.bwm-tt .tt-rootcard .lvl{ font-size:9px; letter-spacing:.2em; color:var(--gold); margin-top:3px; }

.bwm-tt .tt-col{ display:flex; flex-direction:column; gap:12px;
  --pc-ink:var(--gold); --pc-line:rgba(242,200,105,.5); --pc-fill:rgba(242,200,105,.12); --pc-glow:rgba(242,200,105,.28); }
.bwm-tt .tt-col.base  { --pc-ink:#f2c869; --pc-line:rgba(242,200,105,.5); --pc-fill:rgba(242,200,105,.12); --pc-glow:rgba(242,200,105,.28); }
.bwm-tt .tt-col.econ  { --pc-ink:#57d98a; --pc-line:rgba(87,217,138,.5);  --pc-fill:rgba(87,217,138,.12);  --pc-glow:rgba(87,217,138,.26); }
.bwm-tt .tt-col.struct{ --pc-ink:#4aa3ff; --pc-line:rgba(74,163,255,.5);  --pc-fill:rgba(74,163,255,.12);  --pc-glow:rgba(74,163,255,.26); }
.bwm-tt .tt-col.hitech{ --pc-ink:#b06cff; --pc-line:rgba(176,108,255,.5); --pc-fill:rgba(176,108,255,.13); --pc-glow:rgba(176,108,255,.28); }
.bwm-tt .tt-phead{ display:flex; align-items:center; gap:9px; padding:10px 12px; border-radius:10px;
  border:1px solid var(--pc-line); background:linear-gradient(180deg,var(--pc-fill),transparent); box-shadow:inset 0 0 20px var(--pc-glow); }
.bwm-tt .tt-phead .pic{ display:grid; place-items:center; width:24px; height:24px; border-radius:6px; background:rgba(0,0,0,.28); border:1px solid var(--pc-line); color:var(--pc-ink); }
.bwm-tt .tt-phead .pt{ font-size:12px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--pc-ink); }
.bwm-tt .tt-phead .ps{ font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-mut); margin-top:1px; }

.bwm-tt .tt-node{ position:relative; display:flex; gap:10px; align-items:center; text-align:left; width:100%;
  padding:9px 11px; border-radius:11px; cursor:pointer; font-family:inherit; color:var(--ink);
  border:1px solid var(--chrome); background:linear-gradient(180deg,var(--panel-hi),var(--panel));
  transition:border-color .12s, transform .12s, box-shadow .12s; -webkit-tap-highlight-color:transparent; }
.bwm-tt .tt-node:hover{ transform:translateY(-2px); border-color:var(--pc-line); box-shadow:0 8px 20px rgba(0,0,0,.45), 0 0 0 1px var(--pc-line); }
.bwm-tt .tt-node:focus-visible{ outline:2px solid var(--pc-ink); outline-offset:2px; }
.bwm-tt .tt-node.sel{ border-color:var(--pc-ink); box-shadow:0 0 0 1px var(--pc-ink), 0 0 24px var(--pc-glow); transform:translateY(-2px); }
.bwm-tt .tt-node.owned{ border-color:var(--good); }
.bwm-tt .tt-node.locked{ opacity:.5; cursor:not-allowed; }
.bwm-tt .tt-node.locked:hover{ transform:none; box-shadow:none; border-color:var(--chrome); }
.bwm-tt .tt-thumb{ width:42px; height:42px; flex:0 0 auto; border-radius:9px; display:grid; place-items:center; color:var(--pc-ink);
  background:radial-gradient(120% 120% at 50% 12%, var(--pc-fill), rgba(0,0,0,.35)); border:1px solid var(--pc-line); }
.bwm-tt .tt-node .meta{ min-width:0; flex:1; }
.bwm-tt .tt-node .nm{ font-size:12px; font-weight:700; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bwm-tt .tt-node .sub{ font-size:9.5px; color:var(--ink-dim); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bwm-tt .tt-node .cost{ display:flex; align-items:center; gap:4px; margin-top:5px; font-size:10px; color:var(--gold); }
.bwm-tt .tt-node.owned .cost{ color:var(--good); }
.bwm-tt .tt-node .tbadge{ position:absolute; top:8px; right:9px; font-size:8px; letter-spacing:.12em; color:var(--ink-mut);
  border:1px solid var(--chrome); border-radius:5px; padding:1px 5px; background:rgba(0,0,0,.3); }
.bwm-tt .tt-node .corner{ position:absolute; top:7px; right:9px; display:grid; place-items:center; }

.bwm-tt .tt-dock{ margin-top:24px; display:grid; grid-template-columns:1.2fr 1fr 1.5fr; gap:18px; align-items:stretch; }
.bwm-tt .tt-ult{ position:relative; border-radius:14px; padding:15px; overflow:hidden; border:1px solid var(--gold-deep);
  background:linear-gradient(150deg, rgba(242,200,105,.16), rgba(120,86,28,.10) 60%, rgba(0,0,0,.2));
  box-shadow:0 0 0 1px rgba(242,200,105,.2), inset 0 0 40px rgba(242,200,105,.06); }
.bwm-tt .tt-ult .tag{ display:inline-block; font-size:9.5px; font-weight:900; letter-spacing:.22em; color:#20170a;
  background:linear-gradient(180deg,var(--gold),var(--gold-deep)); padding:4px 12px; border-radius:999px; }
.bwm-tt .tt-ult .row{ display:flex; gap:13px; align-items:center; margin-top:11px; }
.bwm-tt .tt-ult .big{ width:66px; height:66px; flex:0 0 auto; border-radius:12px; display:grid; place-items:center;
  background:radial-gradient(120% 120% at 50% 10%, rgba(242,200,105,.24), rgba(0,0,0,.4)); border:1px solid var(--gold-deep); }
.bwm-tt .tt-ult h3{ margin:0; font-size:16px; letter-spacing:.03em; text-transform:uppercase; }
.bwm-tt .tt-ult .lvl{ font-size:9.5px; letter-spacing:.18em; color:var(--gold); margin-top:2px; }
.bwm-tt .tt-ult p{ margin:8px 0 0; font-size:11px; color:var(--ink-dim); line-height:1.5; }
.bwm-tt .tt-ult .price{ margin-top:11px; display:flex; align-items:center; gap:7px; font-size:17px; font-weight:900; color:var(--gold); }
.bwm-tt .tt-ult .price .need{ font-size:10px; color:var(--ink-mut); letter-spacing:.08em; font-weight:600; }

.bwm-tt .tt-prog{ border:1px solid var(--chrome); border-radius:14px; padding:15px; background:linear-gradient(180deg,var(--panel),#12161e); }
.bwm-tt .tt-prog h4{ margin:0 0 4px; font-size:10.5px; letter-spacing:.22em; text-transform:uppercase; color:var(--ink-mut); }
.bwm-tt .tt-prog .hint{ font-size:10px; color:var(--ink-dim); line-height:1.5; margin:0 0 13px; }
.bwm-tt .tt-prog .hint b{ color:var(--gold); }
.bwm-tt .tt-tiers{ display:flex; flex-direction:column; gap:8px; }
.bwm-tt .tt-tier{ display:flex; align-items:center; gap:10px; }
.bwm-tt .tt-tier .dot{ width:24px; height:24px; flex:0 0 auto; border-radius:7px; display:grid; place-items:center;
  font-size:11px; font-weight:900; border:1px solid var(--chrome); color:var(--ink-mut); background:rgba(0,0,0,.25); }
.bwm-tt .tt-tier.on .dot{ color:#0b0e13; background:linear-gradient(180deg,var(--gold),var(--gold-deep)); border-color:var(--gold); box-shadow:0 0 12px rgba(242,200,105,.4); }
.bwm-tt .tt-tier .tx{ font-size:11px; }
.bwm-tt .tt-tier .tx small{ display:block; font-size:9px; color:var(--ink-mut); letter-spacing:.06em; text-transform:uppercase; margin-top:1px; }
.bwm-tt .tt-tier.on .tx small{ color:var(--good); }

.bwm-tt .tt-inspect{ border:1px solid #3c4a5c; border-radius:14px; padding:15px; display:flex; flex-direction:column;
  background:linear-gradient(180deg,var(--panel-hi),var(--panel)); box-shadow:0 14px 36px rgba(0,0,0,.45); }
.bwm-tt .tt-inspect .ihead{ display:flex; gap:13px; align-items:flex-start; }
.bwm-tt .tt-inspect .iart{ width:72px; height:72px; flex:0 0 auto; border-radius:12px; display:grid; place-items:center;
  background:radial-gradient(120% 120% at 50% 10%, rgba(255,255,255,.06), rgba(0,0,0,.4)); border:1px solid var(--chrome); }
.bwm-tt .tt-inspect h3{ margin:0; font-size:16px; letter-spacing:.02em; }
.bwm-tt .tt-inspect .ilvl{ font-size:9.5px; letter-spacing:.18em; text-transform:uppercase; margin-top:3px; }
.bwm-tt .tt-inspect .idesc{ font-size:11px; color:var(--ink-dim); line-height:1.5; margin:11px 0 0; }
.bwm-tt .tt-inspect .stats{ display:flex; gap:9px; margin-top:11px; flex-wrap:wrap; }
.bwm-tt .tt-stat{ flex:1 1 0; min-width:84px; border:1px solid var(--chrome); border-radius:9px; padding:7px 9px; background:rgba(0,0,0,.22); }
.bwm-tt .tt-stat small{ display:block; font-size:8px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-mut); }
.bwm-tt .tt-stat b{ font-size:13px; }
.bwm-tt .tt-stat b .up{ color:var(--good); font-size:11px; }
.bwm-tt .tt-infl{ margin-top:11px; font-size:10px; color:var(--ink-mut); letter-spacing:.03em; display:flex; align-items:center; gap:8px; }
.bwm-tt .tt-infl .bar{ flex:1; height:6px; border-radius:3px; position:relative; opacity:.85;
  background:linear-gradient(90deg,var(--bad),#3a4350 50%, var(--good)); }
.bwm-tt .tt-infl .bar i{ position:absolute; top:-3px; width:3px; height:12px; border-radius:2px; background:var(--ink); transform:translateX(-50%); }
.bwm-tt .tt-infl .w{ min-width:120px; text-align:right; }
.bwm-tt .tt-buy{ margin-top:auto; padding-top:13px; display:flex; align-items:center; gap:12px; }
.bwm-tt .tt-buy .p{ font-size:19px; font-weight:900; color:var(--gold); display:flex; align-items:center; gap:6px; }
.bwm-tt .tt-btn{ margin-left:auto; border:0; cursor:pointer; font-family:inherit; font-weight:800; letter-spacing:.13em; text-transform:uppercase;
  font-size:12px; padding:12px 24px; border-radius:10px; color:#0b0e13; background:linear-gradient(180deg,var(--gold),var(--gold-deep)); }
.bwm-tt .tt-btn:hover{ filter:brightness(1.06); }
.bwm-tt .tt-btn:focus-visible{ outline:2px solid #fff; outline-offset:2px; }
.bwm-tt .tt-btn.owned{ background:linear-gradient(180deg,#2a3340,#1c2430); color:var(--good); cursor:default; }
.bwm-tt .tt-btn.cant{ background:linear-gradient(180deg,#3a2226,#2a1a1e); color:var(--bad); cursor:not-allowed; }
.bwm-tt .tt-btn.locked{ background:linear-gradient(180deg,#242c38,#1a212b); color:var(--ink-mut); cursor:not-allowed; }

.bwm-tt .tt-toast{ position:fixed; left:50%; bottom:26px; transform:translateX(-50%) translateY(20px); z-index:300;
  background:linear-gradient(180deg,var(--panel-hi),var(--panel)); border:1px solid var(--gold-deep); color:var(--ink);
  padding:11px 20px; border-radius:10px; font-size:12px; box-shadow:0 12px 30px rgba(0,0,0,.55); opacity:0; pointer-events:none;
  transition:opacity .22s, transform .22s; }
.bwm-tt .tt-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
.bwm-tt .tt-toast b{ color:var(--gold); }

@media (prefers-reduced-motion:reduce){ .bwm-tt *{ transition:none !important; } }
@media (max-width:820px){
  .bwm-tt .tt-grid{ grid-template-columns:1fr 1fr; }
  .bwm-tt .tt-root{ grid-column:1 / -1; }
  .bwm-tt .tt-wires{ display:none; }
  .bwm-tt .tt-dock{ grid-template-columns:1fr; }
}
`;

// inline SVG glyphs — stand-ins for the real per-upgrade art (Story 6 swaps these for sprites)
const IC = {
  gold: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="#f2c869" stroke="#8a6a1e" stroke-width="1.4"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#8a6a1e" stroke-width="1.2"/></svg>',
  gem: '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 3l6 5-6 13-6-13z" fill="#4aa3ff" stroke="#1c4c86" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  flask: '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" fill="rgba(87,217,138,.25)" stroke="#57d98a" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  base: '<svg viewBox="0 0 40 40" width="40" height="40"><rect x="8" y="8" width="24" height="24" rx="3" fill="rgba(242,200,105,.18)" stroke="#f2c869" stroke-width="1.6"/><rect x="14" y="14" width="12" height="12" rx="2" fill="rgba(242,200,105,.35)" stroke="#f2c869" stroke-width="1.2"/><rect x="18.5" y="3" width="3" height="10" rx="1.2" fill="#f2c869"/></svg>',
  shield: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M16 4l10 3v8c0 7-5 11-10 13-5-2-10-6-10-13V7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  cannon: '<svg viewBox="0 0 32 32" width="28" height="28"><rect x="5" y="18" width="14" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="16" y="13" width="12" height="4" rx="2" transform="rotate(-16 22 15)" fill="currentColor"/><circle cx="9" cy="27" r="2.4" fill="currentColor"/></svg>',
  eye: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="3.5" fill="currentColor"/></svg>',
  rpg: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M6 20l14-9 5 2-4 6 3 6-5-1-11 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M22 13l4-4" stroke="currentColor" stroke-width="2"/></svg>',
  sam: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M16 3l4 10-4-2-4 2z" fill="currentColor"/><path d="M12 13l4 16 4-16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 24l-3 5M23 24l3 5" stroke="currentColor" stroke-width="2"/></svg>',
  core: '<svg viewBox="0 0 32 32" width="28" height="28"><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="currentColor"/><path d="M16 6V2M16 30v-4M6 16H2M30 16h-4" stroke="currentColor" stroke-width="2"/></svg>',
  bolt: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M18 3L7 18h7l-2 11 12-16h-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  range: '<svg viewBox="0 0 32 32" width="28" height="28"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/><circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 4v6M16 22v6M4 16h6M22 16h6" stroke="currentColor" stroke-width="2"/></svg>',
  dual: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M11 4l7 2v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M21 9l7 2v5c0 4.5-3.5 6.5-7 8" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".7"/></svg>',
  wrench: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M20 6a6 6 0 0 0-8 7l-8 8 3 3 8-8a6 6 0 0 0 7-8l-4 4-3-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  drone: '<svg viewBox="0 0 32 32" width="28" height="28"><rect x="12" y="12" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="26" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="26" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  pick: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M4 8c8-4 16-4 24 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8v20" stroke="currentColor" stroke-width="2.4"/></svg>',
  radar: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M16 16L16 4a12 12 0 1 1-8 3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="2.4" fill="currentColor"/></svg>',
  troop: '<svg viewBox="0 0 32 32" width="28" height="28"><circle cx="16" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 27c0-5 4-8 9-8s9 3 9 8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  energy: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M16 3l3 9h9l-7 6 3 10-8-6-8 6 3-10-7-6h9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  ult: '<svg viewBox="0 0 32 32" width="42" height="42"><rect x="4" y="19" width="16" height="7" rx="2" fill="rgba(242,200,105,.25)" stroke="#f2c869" stroke-width="2"/><rect x="16" y="13" width="14" height="5" rx="2.5" transform="rotate(-18 23 15)" fill="#f2c869"/><circle cx="8" cy="28" r="2.6" fill="#f2c869"/></svg>',
};
const chk = (s = 13) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><path d="M4 12l5 5 11-12" fill="none" stroke="#57d98a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const lockic = () => '<svg viewBox="0 0 24 24" width="14" height="14"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="#6b7c90" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#6b7c90" stroke-width="2"/></svg>';
const fmt = (n) => n.toLocaleString('en-US');
const sizeIc = (raw, px) => (raw || IC.core).replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`);
const allNodes = () => Object.values(NODES).flat();
const findNode = (id) => allNodes().find((n) => n.id === id) || (id === ULT.id ? ULT : null);
const pathOf = (id) => PATHS.find((p) => NODES[p.key].some((x) => x.id === id));

export function buildTechTree(doc, cbs) {
  if (!doc.getElementById('bwm-tt-style')) {
    const st = doc.createElement('style'); st.id = 'bwm-tt-style'; st.textContent = CSS; doc.head.appendChild(st);
  }
  const root = doc.createElement('div');
  root.className = 'bwm-tt';
  let selected = 'b-atk';   // preselect a node so the inspector opens populated

  root.innerHTML = `
    <div class="tt-top">
      <div>
        <h2 class="tt-title">Tech <em>Tree</em></h2>
        <div class="tt-sub">Research upgrades · Fortify the Bulwark</div>
      </div>
      <div class="tt-res" id="tt-res"></div>
      <div style="display:flex;gap:8px">
        <button class="tt-back" type="button" id="tt-classic" title="Amendment B2 in-battle structure tier unlocks">STRUCTURE TIERS</button>
        <button class="tt-back" type="button" id="tt-back">← MENU</button>
      </div>
    </div>
    <div class="tt-board">
      <svg class="tt-wires" id="tt-wires" aria-hidden="true"></svg>
      <div class="tt-grid" id="tt-grid"></div>
    </div>
    <div class="tt-dock">
      <div class="tt-ult" id="tt-ult"></div>
      <div class="tt-prog">
        <h4>Tier Unlocks</h4>
        <p class="hint">Beat a faction on <b>Map 2</b> to raise your tech clearance — any order. Each victory unlocks the next tier across every path.</p>
        <div class="tt-tiers" id="tt-tiers"></div>
      </div>
      <div class="tt-inspect" id="tt-inspect"></div>
    </div>
    <div class="tt-toast" id="tt-toast"></div>`;

  const $ = (id) => root.querySelector(id);
  $('#tt-back').addEventListener('click', () => cbs && cbs.onBack && cbs.onBack());
  $('#tt-classic').addEventListener('click', () => cbs && cbs.onClassic && cbs.onClassic());

  function readState() {
    const s = loadSave();
    return { s, gold: (s.carry && s.carry.gold) || 0, clr: techClearance(s), owned: s.techNodes || {} };
  }
  function statusOf(n, ctx) {
    if (ctx.owned[n.id]) return 'owned';
    if (n.tier > ctx.clr) return 'locked';
    return ctx.gold >= n.cost ? 'buyable' : 'poor';
  }

  let toastT;
  function toast(msg) {
    const t = $('#tt-toast'); t.innerHTML = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function renderRes(ctx) {
    $('#tt-res').innerHTML =
      `<div class="tt-chip gold"><span class="ic">${IC.gold}</span><span><b>${fmt(ctx.gold)}</b><small>Gold bank</small></span></div>
       <div class="tt-chip"><span class="ic">${IC.gem}</span><span><b style="color:#4aa3ff">${ctx.clr}/4</b><small>Tiers unlocked</small></span></div>
       <div class="tt-chip"><span class="ic">${IC.flask}</span><span><b style="color:#57d98a">${ctx.clr}/9</b><small>Map-2 factions</small></span></div>`;
  }

  function renderTree(ctx) {
    const g = $('#tt-grid'); g.innerHTML = '';
    const rc = doc.createElement('div'); rc.className = 'tt-root';
    rc.innerHTML = `<div class="tt-rootcard"><div class="tt-thumb" style="margin:0 auto 8px;color:#f2c869">${IC.base}</div><b>SYS-BASE</b><div class="lvl">Command Core · LVL 1</div></div>`;
    g.appendChild(rc);
    for (const p of PATHS) {
      const col = doc.createElement('div'); col.className = 'tt-col ' + p.key; col.dataset.path = p.key;
      const ph = doc.createElement('div'); ph.className = 'tt-phead';
      ph.innerHTML = `<span class="pic">${sizeIc(IC[p.ic], 18)}</span><span><div class="pt">${p.name}</div><div class="ps">${p.sub}</div></span>`;
      col.appendChild(ph);
      for (const n of NODES[p.key]) {
        const st = statusOf(n, ctx);
        const b = doc.createElement('button'); b.type = 'button'; b.dataset.id = n.id;
        b.className = 'tt-node' + (st === 'owned' ? ' owned' : '') + (st === 'locked' ? ' locked' : '') + (n.id === selected ? ' sel' : '');
        const corner = st === 'owned' ? `<span class="corner">${chk()}</span>`
          : st === 'locked' ? `<span class="corner">${lockic()}</span>`
          : `<span class="tbadge">T${n.tier}</span>`;
        b.innerHTML =
          `<span class="tt-thumb">${sizeIc(IC[n.ic], 28)}</span>
           <span class="meta"><div class="nm">${n.nm}</div><div class="sub">${n.sub}</div>
             <div class="cost">${st === 'owned' ? chk(12) + ' Researched' : sizeIc(IC.gold, 12) + ' ' + fmt(n.cost)}</div>
           </span>${corner}`;
        b.addEventListener('click', () => {
          if (st === 'locked') { toast('Unlock this tier by beating a faction on Map 2.'); return; }
          selected = n.id; renderInspect(readState()); markSel();
        });
        col.appendChild(b);
      }
      g.appendChild(col);
    }
    requestAnimationFrame(() => drawWires());
  }

  function markSel() {
    root.querySelectorAll('.tt-node').forEach((x) => x.classList.toggle('sel', x.dataset.id === selected));
  }

  function renderTiers(ctx) {
    const names = ['First blood', 'Second front', 'Third victory', 'Grand clearance'];
    $('#tt-tiers').innerHTML = [1, 2, 3, 4].map((t) => {
      const on = t <= ctx.clr;
      return `<div class="tt-tier ${on ? 'on' : ''}"><div class="dot">${t}</div>
        <div class="tx"><b>Tier ${t}</b><small>${on ? 'Unlocked · ' + names[t - 1] : 'Beat a Map-2 faction'}</small></div></div>`;
    }).join('');
  }

  function renderUlt(ctx) {
    const need = ctx.clr < 4 ? '<span class="need">· needs all tiers</span>' : (ctx.owned[ULT.id] ? '' : '');
    $('#tt-ult').innerHTML =
      `<span class="tag">Ultimate</span>
       <div class="row"><div class="big">${IC.ult}</div>
         <div><h3>${ULT.nm}</h3><div class="lvl">${ULT.lvl} · Capstone</div><p>${ULT.desc}</p></div></div>
       <div class="price">${IC.gold} ${fmt(ULT.cost)} ${need}</div>`;
  }

  function renderInspect(ctx) {
    const n = findNode(selected); if (!n) return;
    const st = statusOf(n, ctx);
    const p = pathOf(n.id);
    const ink = p ? PATH_COLOR[p.key].ink : '#f2c869';
    const box = $('#tt-inspect');
    const stats = (n.stat && !Array.isArray(n.stat[0])) ? [n.stat] : (n.stat || ULT.stat);
    const inflPct = 50 + Math.round((n.infl || 0) * 50);
    const inflWord = (n.infl || 0) > 0.05 ? 'leans alignment darker' : (n.infl || 0) < -0.05 ? 'leans alignment lighter' : 'alignment-neutral';
    const btn = st === 'owned' ? `<button class="tt-btn owned" disabled>${chk(14)} Researched</button>`
      : st === 'locked' ? `<button class="tt-btn locked" disabled>Tier ${n.tier} locked</button>`
      : st === 'poor' ? '<button class="tt-btn cant" disabled>Not enough gold</button>'
      : '<button class="tt-btn" id="tt-buy">Research</button>';
    box.innerHTML =
      `<div class="ihead">
         <div class="iart" style="color:${ink}">${sizeIc(IC[n.ic], 42)}</div>
         <div><h3>${n.nm}</h3><div class="ilvl" style="color:${ink}">${n.sub || 'Capstone'} · Tier ${n.tier || 4}</div></div>
       </div>
       <p class="idesc">${n.desc}</p>
       <div class="stats">
         ${stats.map((sPair) => `<div class="tt-stat"><small>${sPair[0]}</small><b>${sPair[1]}</b></div>`).join('')}
         <div class="tt-stat"><small>Cost</small><b>${fmt(n.cost)}</b></div>
       </div>
       <div class="tt-infl"><span>Faction influence</span><span class="bar"><i style="left:${inflPct}%"></i></span><span class="w">${inflWord}</span></div>
       <div class="tt-buy"><span class="p">${IC.gold} ${fmt(n.cost)}</span>${btn}</div>`;
    const buy = $('#tt-buy');
    if (buy) buy.addEventListener('click', () => doResearch(n));
  }

  function doResearch(n) {
    const ctx = readState();
    if (statusOf(n, ctx) !== 'buyable') return;
    if (buyResearch(n.id, n.cost)) {
      if (cbs && cbs.onResearch) cbs.onResearch(n.id, n.cost);
      toast(`<b>${n.nm}</b> researched · ${fmt(n.cost)}g spent`);
      refresh();
    }
  }

  function drawWires() {
    const svg = $('#tt-wires'); const board = root.querySelector('.tt-board');
    if (!board || root.offsetParent === null) return;   // skip when hidden (rects are 0)
    const b = board.getBoundingClientRect();
    if (!b.width) return;
    svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    const rootCard = root.querySelector('.tt-rootcard'); if (!rootCard) return;
    const rr = rootCard.getBoundingClientRect();
    const rx = rr.right - b.left, ry = rr.top + rr.height / 2 - b.top;
    let paths = '';
    root.querySelectorAll('.tt-col').forEach((col) => {
      const c = PATH_COLOR[col.dataset.path];
      const head = col.querySelector('.tt-phead').getBoundingClientRect();
      const hx = head.left - b.left, hy = head.top + head.height / 2 - b.top;
      const mx = (rx + hx) / 2;
      paths += `<path d="M ${rx} ${ry} C ${mx} ${ry}, ${mx} ${hy}, ${hx} ${hy}" fill="none" stroke="${c.deep}" stroke-width="2.5" opacity=".55"/>`;
      paths += `<path d="M ${rx} ${ry} C ${mx} ${ry}, ${mx} ${hy}, ${hx} ${hy}" fill="none" stroke="${c.ink}" stroke-width="1" opacity=".9"/>`;
      let prev = head;
      col.querySelectorAll('.tt-node').forEach((nd) => {
        const r = nd.getBoundingClientRect();
        const px = prev.left + 16 - b.left, py = prev.bottom - b.top;
        const cx = r.left + 16 - b.left, cy = r.top - b.top;
        paths += `<path d="M ${px} ${py} C ${px} ${(py + cy) / 2}, ${cx} ${(py + cy) / 2}, ${cx} ${cy}" fill="none" stroke="${c.ink}" stroke-width="1.5" opacity=".4"/>`;
        prev = r;
      });
    });
    svg.innerHTML = paths;
  }

  function refresh() {
    const ctx = readState();
    // keep selection valid
    if (!findNode(selected)) selected = 'b-atk';
    renderRes(ctx); renderTree(ctx); renderTiers(ctx); renderUlt(ctx); renderInspect(ctx);
  }

  let resizeBound = false;
  function onShow() {
    refresh();
    if (!resizeBound) {
      resizeBound = true;
      (doc.defaultView || window).addEventListener('resize', () => requestAnimationFrame(() => drawWires()));
    }
    requestAnimationFrame(() => drawWires());
  }

  return { root, refresh: onShow };
}
