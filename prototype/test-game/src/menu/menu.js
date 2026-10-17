/**
 * src/menu/menu.js — the MAIN MENU, ported from the Claude Design proof (Design-Proof MENU).
 *
 * Same runtime as the game: a DOM overlay above the canvas (the HUD pattern), carrying the
 * proof's design language — gold on ink, panel lines, crest, letterspaced wordmark. Two screens
 * in this slice: MAIN (title + actions) and MAPS (the 9-map campaign select bound to the save).
 *
 * The menu READS the save (locks, best scores) and never touches the sim; starting a map goes
 * through the same selectMap() the settings picker uses. Dev loop: ?map=N boots straight into a
 * battle with no menu (main.js).
 */
import { MAPDATA } from '../../content/maps/mapdata.js';
import { loadSave, TIER_COSTS } from '../save/save.js';
import { setChannelVolume } from '../comm/voice.js';
import { buildTechTree } from './techtree.js';
// The faction registry (GGG-3). Side-effect import + global namespace: factions.js is a classic
// script with no ES exports, so a named import is a SyntaxError. See voice.js for the full note.
import '../data/factions.js';
const REG = globalThis.BulwarkFactions;
import { PLANETS, planetImage } from '../data/planets.js';
import { LANDING_CRAFT, craftFor } from '../render3d/craft/models.js';
import { CRYSTAL } from '../render3d/styles/lowpoly-palettes.js';
// the live globes / craft / resource models load with three.js on first open (menuStage.js); until then (and with
// no WebGL) the baked planet PNGs stand in
const THREE_URL = new URL('../../vendor/three.module.js', import.meta.url).href;
const TIER_ROLE = { common: ['blue', 'Common · harvest'], uncommon: ['yellow', 'Uncommon · 2× value'], rare: ['red', 'Rare · for the associate'], epic: ['green', 'Epic · for the associate'] };

/**
 * The faction a workbook Faction_ID refers to. This USED to be `FACTION_NAMES[fid - 1]` against a
 * hardcoded array, and that is the sharpest edge in this whole area (GGG-3): the ids come from
 * MAPDATA, whose own `Faction_Name` column is the placeholder 'Faction_01'…'Faction_09', so the
 * array position WAS the only thing binding a workbook row to a real faction. Reorder the list and
 * every faction card, tech tree and rival silently renames itself, with nothing to catch it.
 *
 * So this is a LOOKUP on the registry's declared `ordinal`, not an index into whatever order the
 * registry happens to be written in. The dependency is now explicit and one-directional: `ordinal`
 * is the workbook's id, stated as data. Returns null for an unknown id instead of undefined-ing.
 */
const factionByOrdinal = (fid) => REG.factionOfOrdinal(fid);   // registry owns this — see factions.js
const TECH_BADGES = [
  { icon: '⚔', label: 'T1 UNIT', keyAt: 'T1 Unit @' },            // crossed swords
  { icon: '⛨', label: 'T2 STRUCTURE', keyAt: 'T2 Structure @' },  // shield
  { icon: '⬢', label: 'T3 BASE UPGRADE', keyAt: 'T3 Base Upgrade @' }, // hexagon
];

const CSS = `
.bwm-root { position:absolute; inset:0; z-index:200; font-family:"Segoe UI",system-ui,sans-serif;
  color:#e6ecf3; background:
    radial-gradient(120% 90% at 15% 20%, rgba(12,14,18,.35), rgba(12,14,18,.97) 75%),
    linear-gradient(160deg,#0c0e12 0%, #14181f 60%, #0c0e12 100%);
  display:flex; flex-direction:column; overflow:hidden; }
.bwm-root .grain { position:absolute; inset:0; pointer-events:none;
  background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 1px,transparent 1px 3px);
  mix-blend-mode:overlay; }
.bwm-top { display:flex; align-items:center; gap:14px; padding:20px 30px; }
.bwm-crest { width:42px; height:42px; background:linear-gradient(160deg,#f2c869,#d9a441);
  clip-path:polygon(50% 0,100% 22%,100% 68%,50% 100%,0 68%,0 22%);
  display:flex; align-items:center; justify-content:center; color:#0c0e12; font-weight:900; font-size:20px;
  box-shadow:0 0 18px rgba(217,164,65,.35); }
.bwm-word { font-size:24px; font-weight:800; letter-spacing:.32em; }
.bwm-word b { color:#f2c869; }
.bwm-tag { font-size:10px; letter-spacing:.4em; color:#8fa0b3; margin-top:2px; }
.bwm-main { flex:1; display:flex; align-items:center; padding:0 clamp(24px,6vw,90px); gap:40px; min-height:0; }
.bwm-hero { max-width:520px; }
.bwm-kicker { display:inline-block; font-size:11px; letter-spacing:.42em; color:#d9a441;
  border:1px solid #2e3846; padding:6px 14px; margin-bottom:22px; background:rgba(20,24,31,.6); }
.bwm-title { font-size:clamp(40px,7vw,80px); font-weight:900; line-height:.92; letter-spacing:.02em;
  text-shadow:0 6px 30px rgba(0,0,0,.7); }
.bwm-title span { color:#f2c869; }
.bwm-sub { margin-top:16px; max-width:420px; color:#8fa0b3; font-size:14px; line-height:1.6; }
.bwm-menu { margin-left:auto; width:min(340px,42vw); display:flex; flex-direction:column; gap:12px; padding:24px; }
.bwm-btn { display:flex; justify-content:space-between; align-items:center; text-align:left; width:100%;
  background:#1a1f28; border:1px solid #2e3846; color:#e6ecf3; padding:16px 20px; font-size:15px;
  letter-spacing:.14em; font-weight:700; cursor:pointer; transition:border-color .12s, background .12s; }
.bwm-btn:hover { border-color:#d9a441; background:#20262f; }
.bwm-btn .hint { font-size:10px; letter-spacing:.1em; color:#8fa0b3; font-weight:400; }
.bwm-btn.primary { background:linear-gradient(160deg,#f2c869,#d9a441); color:#0c0e12; border-color:#f2c869; }
.bwm-btn.primary:hover { filter:brightness(1.06); }
.bwm-btn.primary .hint { color:rgba(12,14,18,.62); font-weight:600; }
.bwm-btn:disabled { opacity:.38; cursor:default; }
.bwm-btn:disabled:hover { border-color:#2e3846; background:#1a1f28; }
/* FACTIONS screen */
.bwm-fgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:14px; }
.bwm-fcard { background:#1a1f28; border:1px solid #2e3846; padding:14px 16px; cursor:pointer;
  transition:border-color .12s, transform .12s; }
.bwm-fcard:hover { border-color:#d9a441; transform:translateY(-2px); }
.bwm-fcard .fplanet { display:flex; flex-direction:column; align-items:center; margin:-4px 0 8px; }
.bwm-fcard .fplanet img { width:112px; height:112px; display:block; }
.bwm-fcard .fplanet span { margin-top:2px; font-size:10px; letter-spacing:.22em; color:#8fa0b3; }
.bwm-fcard .fnm { font-size:15px; font-weight:800; letter-spacing:.1em; }
.bwm-fcard .fprof { margin-top:6px; font-size:11px; color:#8fa0b3; line-height:1.45; min-height:30px; }
.bwm-fcard .fstats { display:flex; gap:14px; margin-top:10px; font-size:10px; letter-spacing:.12em; color:#8fa0b3; }
.bwm-fcard .fstats b { color:#e6ecf3; }
.bwm-fcard .fstats .stars { color:#f2c869; }
.bwm-badges { display:flex; gap:10px; margin-top:12px; }
.bwm-badge { width:38px; height:38px; display:flex; align-items:center; justify-content:center;
  font-size:19px; border:1px solid #2e3846; background:#14181f; color:#3a4350; cursor:help; }
.bwm-badge.lit { color:#0c0e12; background:linear-gradient(160deg,#f2c869,#d9a441);
  border-color:#f2c869; box-shadow:0 0 12px rgba(217,164,65,.35); }
/* LIVE 3D (menuStage.js): one canvas over the menu draws into the [data-globe] / [data-craft] / [data-res] boxes */
.bwm-gl { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:6; }
.bwm-root.space { background:
    radial-gradient(70% 60% at 30% 45%, rgba(40,60,90,.18), transparent 70%),
    var(--stars, none), linear-gradient(160deg,#07090c 0%, #0c1016 60%, #07090c 100%); }
.bwm-globe { position:relative; aspect-ratio:1/1; touch-action:none; }
.bwm-globe[data-spin="drag"] { cursor:grab; }
.bwm-globe > img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
.bwm-live .bwm-globe > img { visibility:hidden; }
/* MAIN: the next planet, live */
.bwm-hero.planet { position:relative; flex:1; max-width:none; display:flex; align-items:center; justify-content:flex-end; min-height:0; height:100%; }
.bwm-hero.planet .bwm-globe { height:min(72vh, 36vw); max-height:100%; }
.bwm-hero.planet .bwm-htext { position:absolute; left:0; top:50%; transform:translateY(-50%); z-index:7; pointer-events:none; }
.bwm-hero.planet .bwm-next { position:absolute; right:calc(min(72vh, 36vw) / 2); bottom:2%; transform:translateX(50%); z-index:7; white-space:nowrap;
  font-size:11px; letter-spacing:.32em; color:#8fa0b3; pointer-events:none; }
.bwm-hero.planet .bwm-next b { color:var(--hue,#f2c869); font-weight:800; }
.bwm-craft { display:flex; gap:12px; align-items:center; margin-top:6px; padding:10px 12px; background:rgba(20,24,31,.82);
  border:1px solid #2e3846; }
.bwm-craft .cv { flex:0 0 112px; height:78px; position:relative; background:radial-gradient(60% 70% at 50% 60%, rgba(120,150,190,.18), transparent 70%); }
.bwm-craft .ck { font-size:9px; letter-spacing:.3em; color:#8fa0b3; }
.bwm-craft .cn { font-size:14px; font-weight:800; letter-spacing:.08em; margin-top:3px; }
.bwm-craft .cw { font-size:10.5px; color:#8fa0b3; margin-top:3px; line-height:1.4; }
/* PLANET SURVEY (a faction picked on FACTIONS) */
.bwm-survey { flex:1; display:none; min-height:0; padding:4px clamp(16px,3vw,48px) 18px; gap:clamp(12px,2.5vw,36px);
  grid-template-columns:minmax(0,1.05fr) minmax(0,1fr); grid-template-rows:minmax(0,1fr); align-items:center; }
.bwm-survey .stagecol { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:0; height:100%; }
.bwm-survey .stagecol .bwm-globe { width:min(100%, 66vh); }
.bwm-survey .hint { font-size:10px; letter-spacing:.24em; color:#5c6a7a; margin-top:4px; }
.bwm-survey .nav { display:flex; gap:8px; margin-top:8px; }
.bwm-survey .nav button { width:auto; padding:8px 14px; }
.bwm-doss { background:rgba(18,22,28,.86); border:1px solid #2e3846; padding:16px 18px; max-height:100%; min-height:0; display:flex; flex-direction:column; }
.bwm-doss .db { overflow-y:auto; min-height:0; flex:1 1 auto; padding-right:4px; }
.bwm-doss .ty { font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:var(--hue,#f2c869); }
.bwm-doss .fa { font-size:15px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--hue,#f2c869); margin-top:6px; }
.bwm-doss h2 { font-size:clamp(34px,5vw,52px); font-weight:900; line-height:.95; letter-spacing:.05em; text-transform:uppercase; margin:2px 0 8px; }
.bwm-doss p { margin:0 0 10px; color:#c9d2da; font-size:13px; line-height:1.5; max-width:52ch; }
.bwm-lush { display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; font-size:10px; letter-spacing:.14em;
  color:#8fa0b3; text-transform:uppercase; margin:4px 0 12px; }
.bwm-lush i { height:6px; border-radius:3px; background:linear-gradient(90deg,#b08058,#e2c478 40%,#5cc05a); position:relative; }
.bwm-lush b { position:absolute; top:-4px; width:4px; height:14px; margin-left:-2px; border-radius:2px; background:#e6ecf3; transition:left .5s ease; }
.bwm-facts { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:6px 14px; margin:0 0 14px; font-size:12.5px; }
.bwm-facts dt { font-size:10px; letter-spacing:.16em; color:#8fa0b3; text-transform:uppercase; padding-top:2px; }
.bwm-facts dd { margin:0; min-width:0; }
.bwm-facts .sw { display:inline-flex; gap:5px; align-items:center; margin-right:10px; font-size:11px; color:#8fa0b3; }
.bwm-facts .sw span { width:12px; height:12px; border-radius:2px; border:1px solid #2e3846; }
.bwm-res-h { font-size:11px; letter-spacing:.3em; color:#d9a441; margin:2px 0 8px; }
.bwm-res { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.bwm-rtile { display:flex; gap:10px; align-items:flex-start; background:#14181f; border:1px solid #2e3846; padding:8px; border-left:3px solid var(--tc); }
.bwm-rtile .rv { flex:0 0 64px; height:64px; position:relative; }
.bwm-rtile .rn { font-size:13px; font-weight:800; letter-spacing:.04em; }
.bwm-rtile .rr { font-size:9.5px; letter-spacing:.16em; color:var(--tc); text-transform:uppercase; margin-top:2px; }
.bwm-rtile .rx { font-size:11px; color:#8fa0b3; line-height:1.4; margin-top:3px; }
.bwm-acts { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; flex:0 0 auto; }
.bwm-acts .bwm-btn { width:auto; flex:1 1 auto; justify-content:center; gap:10px; }
@media (max-width:760px) {
  .bwm-survey { grid-template-columns:minmax(0,1fr); align-items:start; overflow-y:auto; }
  .bwm-survey .stagecol { height:auto; }
  .bwm-survey .stagecol .bwm-globe { width:min(78vw, 360px); }
  .bwm-hero.planet { flex:0 0 auto; height:auto; }
  .bwm-hero.planet .bwm-globe { height:min(46vh, 80vw); }
}
/* SETTINGS screen */
.bwm-set { max-width:420px; }
.bwm-srow { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.bwm-srow label { flex:0 0 110px; font-size:12px; letter-spacing:.1em; color:#cfe3f0; }
.bwm-srow input[type=range] { flex:1; accent-color:#d9a441; }
.bwm-srow .v { flex:0 0 40px; text-align:right; font-size:12px; color:#f2c869; font-variant-numeric:tabular-nums; }
/* HARVESTER screen */
.bwm-hrow { display:flex; align-items:center; gap:16px; background:#1a1f28; border:1px solid #2e3846;
  padding:14px 18px; margin-bottom:10px; }
.bwm-hrow.cur { border-color:#d9a441; }
.bwm-hrow.locked { opacity:.5; }
.bwm-hlvl { font-size:22px; font-weight:900; color:#f2c869; width:44px; }
.bwm-hstats { flex:1; font-size:11px; color:#8fa0b3; line-height:1.55; }
.bwm-hstats b { color:#e6ecf3; }
.bwm-hbuy { padding:10px 18px; font-size:12px; letter-spacing:.12em; font-weight:700; cursor:pointer;
  border:1px solid #f2c869; background:linear-gradient(160deg,#f2c869,#d9a441); color:#0c0e12; }
.bwm-hbuy:disabled { opacity:.35; cursor:default; }
.bwm-bank { font-size:12px; letter-spacing:.14em; color:#f2c869; margin-left:14px; }
/* MAPS screen */
.bwm-maps { flex:1; padding:8px clamp(20px,4vw,60px) 24px; overflow-y:auto; min-height:0; }
.bwm-maps-head { display:flex; align-items:baseline; gap:16px; margin:6px 2px 14px; }
.bwm-maps-head h2 { font-size:20px; letter-spacing:.3em; font-weight:800; }
.bwm-maps-head .back { margin-left:auto; }
.bwm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:14px; }
.bwm-card { position:relative; background:#1a1f28; border:1px solid #2e3846; padding:14px 16px;
  cursor:pointer; transition:border-color .12s, transform .12s; }
.bwm-card:hover { border-color:#d9a441; transform:translateY(-2px); }
.bwm-card.locked { opacity:.45; cursor:default; }
.bwm-card.locked:hover { border-color:#2e3846; transform:none; }
.bwm-card .nm { font-size:15px; font-weight:800; letter-spacing:.12em; }
.bwm-card .sz { font-size:11px; color:#8fa0b3; margin-top:2px; }
.bwm-card .res { display:inline-block; margin-top:8px; font-size:10px; letter-spacing:.18em;
  color:#d9a441; border:1px solid #2e3846; padding:3px 8px; }
.bwm-card .note { margin-top:8px; font-size:11px; color:#8fa0b3; line-height:1.45; min-height:32px; }
.bwm-card .meta { display:flex; justify-content:space-between; margin-top:10px; font-size:10px;
  letter-spacing:.12em; color:#8fa0b3; }
.bwm-card .best { color:#f2c869; }
.bwm-card .lock { position:absolute; top:10px; right:12px; font-size:14px; color:#8fa0b3; }
.bwm-card .done { position:absolute; top:10px; right:12px; font-size:12px; color:#57a057; letter-spacing:.1em; }
.bwm-foot { padding:10px 30px 16px; font-size:10px; letter-spacing:.2em; color:#5c6a7a; }
@media (max-width:760px) {
  .bwm-main { flex-direction:column; justify-content:center; gap:18px; padding:0 20px; }
  .bwm-hero { text-align:center; }
  .bwm-menu { margin:0; width:min(420px,92vw); padding:0; }
}
/* PHONE LANDSCAPE (owner: Bulwark is a landscape game) [MM-story_mvalr59j_13]. A phone held
   sideways is ~390px tall: the full-size header + 8-button menu column overflowed it, and because
   the column is centred the overflow went ABOVE the top edge too, leaving PLAY unreachable. Tighten
   the chrome, and let the column scroll instead of overflowing. Buttons stay >=34px (A11Y-INPUT-2). */
@media (max-height:500px) {
  .bwm-top { padding:8px 20px; gap:10px; }
  .bwm-crest { width:30px; height:30px; font-size:14px; }
  .bwm-word { font-size:17px; }
  .bwm-tag { display:none; }
  .bwm-foot { display:none; }
  .bwm-main { gap:24px; padding:0 clamp(16px,4vw,40px); }
  .bwm-kicker { margin-bottom:10px; padding:4px 10px; font-size:10px; }
  .bwm-title { font-size:clamp(30px,11vh,52px); }
  .bwm-sub { margin-top:8px; font-size:12px; line-height:1.45; }
  .bwm-menu { max-height:100%; overflow-y:auto; gap:6px; padding:6px 4px 10px; }
  .bwm-btn { padding:9px 14px; font-size:13px; min-height:36px; }
  .bwm-maps { padding:4px 20px 12px; }
  .bwm-maps-head { margin:2px 2px 8px; }
  .bwm-maps-head h2 { font-size:14px; letter-spacing:.24em; }
  .bwm-fgrid { grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
  .bwm-fcard { padding:10px 12px; }
  .bwm-fcard .fplanet { margin:-2px 0 4px; }
  .bwm-fcard .fplanet img { width:56px; height:56px; }
  .bwm-fcard .fnm { font-size:13px; }
  .bwm-fcard .fprof { min-height:0; font-size:10.5px; }
  .bwm-badges { margin-top:8px; }
  .bwm-badge { width:34px; height:34px; font-size:16px; }
  .bwm-grid { gap:10px; }
  .bwm-hero.planet .bwm-globe { height:min(82vh, 44vw); }
  .bwm-hero.planet .bwm-title { font-size:clamp(24px,9vh,40px); }
  .bwm-hero.planet .bwm-sub { display:none; }
  .bwm-craft { padding:6px 8px; gap:8px; margin-top:2px; position:absolute; left:16px; bottom:8px; width:230px; z-index:7; }
  .bwm-hero.planet .bwm-next { display:none; }
  .bwm-acts { margin-top:8px; }
  .bwm-acts .bwm-btn { padding:8px 12px; }
  .bwm-craft .cv { flex-basis:84px; height:56px; }
  .bwm-craft .cw { display:none; }
  .bwm-survey { padding:2px 16px 8px; gap:14px; }
  .bwm-survey .stagecol .bwm-globe { width:min(100%, 70vh); }
  .bwm-survey .hint { display:none; }
  .bwm-doss { padding:10px 12px; }
  .bwm-doss h2 { font-size:28px; }
  .bwm-doss p { font-size:12px; margin-bottom:6px; }
  .bwm-rtile .rv { flex-basis:48px; height:48px; }
  .bwm-rtile .rx { display:none; }
}
`;

function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createMenu(mountEl, cbs) {
  const doc = mountEl.ownerDocument;
  if (!doc.getElementById('bwm-style')) {
    const st = el(doc, 'style'); st.id = 'bwm-style'; st.textContent = CSS;
    doc.head.appendChild(st);
  }

  const root = el(doc, 'div', 'bwm-root');
  root.appendChild(el(doc, 'div', 'grain'));
  // a live-globe box (menuStage.js draws into it); the baked PNG inside shows until / unless WebGL is up
  function globeBox(key, drag) {
    const b = el(doc, 'div', 'bwm-globe');
    b.dataset.globe = key;
    if (drag) { b.dataset.spin = 'drag'; b.setAttribute('aria-label', 'Planet — drag to spin'); }
    const img = el(doc, 'img'); img.alt = ''; img.src = planetImage(key) || ''; img.addEventListener('error', () => { img.style.display = 'none'; });
    b.appendChild(img);
    return b;
  }
  const setGlobe = (b, key) => { b.dataset.globe = key; const img = b.querySelector('img'); if (img) img.src = planetImage(key) || ''; };

  // top bar: crest + wordmark (the proof's brand row)
  const top = el(doc, 'div', 'bwm-top');
  top.appendChild(el(doc, 'div', 'bwm-crest', 'B'));
  const brand = el(doc, 'div');
  const word = el(doc, 'div', 'bwm-word'); word.innerHTML = 'BUL<b>WARK</b>';
  brand.appendChild(word);
  brand.appendChild(el(doc, 'div', 'bwm-tag', 'HOLD THE LINE'));
  top.appendChild(brand);
  root.appendChild(top);

  // ── MAIN screen ──
  const main = el(doc, 'div', 'bwm-main');
  // the hero is the NEXT PLANET — the current enemy's homeworld, live and spinnable, no data (that's the survey's job)
  const hero = el(doc, 'div', 'bwm-hero planet');
  const heroGlobe = globeBox('ground', true);
  hero.appendChild(heroGlobe);
  const htext = el(doc, 'div', 'bwm-htext');
  htext.appendChild(el(doc, 'div', 'bwm-kicker', 'CAMPAIGN — 9 MAPS'));
  const title = el(doc, 'div', 'bwm-title'); title.innerHTML = 'HOLD THE<br><span>BULWARK</span>';
  htext.appendChild(title);
  htext.appendChild(el(doc, 'div', 'bwm-sub',
    'Harvest the fields. Raise the walls. Eight waves per map, each map bigger than the last — your gold and your defenses march with you.'));
  hero.appendChild(htext);
  const heroNext = el(doc, 'div', 'bwm-next');
  hero.appendChild(heroNext);
  main.appendChild(hero);

  const menu = el(doc, 'div', 'bwm-menu');
  const mkBtn = (label, hint, cls, onClick) => {
    const b = el(doc, 'button', 'bwm-btn' + (cls ? ' ' + cls : ''));
    b.appendChild(el(doc, 'span', null, label));
    if (hint) b.appendChild(el(doc, 'span', 'hint', hint));
    b.addEventListener('click', onClick);
    menu.appendChild(b);
    return b;
  };
  const continueBtn = mkBtn('CONTINUE', ' ', 'primary', () => {
    const s = loadSave();
    if (cbs.onPlayMap) cbs.onPlayMap(Math.min(9, s.unlockedThrough));
  });
  mkBtn('FACTIONS', 'campaign — choose your enemy', null, () => show('factions'));
  mkBtn('HARVESTER', 'upgrade the fleet', null, () => show('harvester'));
  mkBtn('TECH TREE', 'research upgrades', null, () => show('techtree'));
  mkBtn('CLASSIC BOARD', 'endless test field', null, () => { if (cbs.onPlayMap) cbs.onPlayMap(0); });
  mkBtn('REPLAY LAST BATTLE', '', null, () => { if (cbs.onReplay) cbs.onReplay(); });
  mkBtn('RESET PROGRESS', 'wipe all progress', null, () => {
    if (doc.defaultView && !doc.defaultView.confirm('Reset all progress? Stars, gold, loyalty, tech and faction records are wiped.')) return;
    if (cbs.onResetCampaign) cbs.onResetCampaign();
    show('main');   // refresh the Continue label + locks
  });
  mkBtn('SETTINGS', 'audio & options', null, () => show('settings'));   // last
  // the player's landing craft (a small panel; the craft turns on a turntable)
  const craftCard = el(doc, 'div', 'bwm-craft');
  const craftView = el(doc, 'div', 'cv');
  const craftText = el(doc, 'div');
  craftCard.appendChild(craftView); craftCard.appendChild(craftText);
  menu.appendChild(craftCard);
  main.appendChild(menu);
  root.appendChild(main);

  // ── MAPS screen ──
  const maps = el(doc, 'div', 'bwm-maps');
  maps.style.display = 'none';
  const mh = el(doc, 'div', 'bwm-maps-head');
  mh.appendChild(el(doc, 'h2', null, 'CAMPAIGN'));
  const back = el(doc, 'button', 'bwm-btn back'); back.style.width = 'auto'; back.style.padding = '8px 18px';
  back.appendChild(el(doc, 'span', null, '← MENU'));
  back.addEventListener('click', () => show('main'));
  mh.appendChild(back);
  maps.appendChild(mh);
  const grid = el(doc, 'div', 'bwm-grid');
  maps.appendChild(grid);
  root.appendChild(maps);

  // ── FACTIONS screen (choose who to battle; per-faction campaign record + tech badges) ──
  const factions = el(doc, 'div', 'bwm-maps');
  factions.style.display = 'none';
  const fh = el(doc, 'div', 'bwm-maps-head');
  fh.appendChild(el(doc, 'h2', null, 'FACTIONS'));
  const fback = el(doc, 'button', 'bwm-btn back'); fback.style.width = 'auto'; fback.style.padding = '8px 18px';
  fback.appendChild(el(doc, 'span', null, '← MENU'));
  fback.addEventListener('click', () => show('main'));
  fh.appendChild(fback);
  factions.appendChild(fh);
  const fgrid = el(doc, 'div', 'bwm-fgrid');
  factions.appendChild(fgrid);
  root.appendChild(factions);

  function refreshFactions() {
    const s = loadSave();
    const al = s.alignment || 0;
    fh.firstChild.textContent = 'FACTIONS — ALIGNMENT ' + (al > 0 ? '+' : '') + al + ' ' +
      (al >= 4 ? 'GOOD' : al <= -4 ? 'EVIL' : 'NEUTRAL');
    fgrid.textContent = '';
    for (const row of MAPDATA.factions) {
      const fid = row.Faction_ID;
      const fac = factionByOrdinal(fid);
      const name = (fac && fac.name) || row.Faction_Name;   // row.Faction_Name is 'Faction_0N' — a last resort
      const rec = (s.factionRecords || {})[name] || {};
      const tech = MAPDATA.techTree.find((t) => t.Faction === row.Faction_Name) || {};
      const tier = (s.tech || {})[name] || 0;
      const loyalty = (s.loyalty || {})[name] || 0;
      const card = el(doc, 'div', 'bwm-fcard');
      // The faction's homeworld above its name (data/planets.js; baked by tools/planets/bake.html)
      const planet = fac && PLANETS[fac.key];
      if (planet) {
        const pw = el(doc, 'div', 'fplanet');
        const img = el(doc, 'img');
        img.src = planetImage(fac.key); img.alt = planet.name; img.title = planet.name + ' — ' + planet.type + '. ' + planet.blurb;
        img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error', () => { img.style.display = 'none'; });
        pw.appendChild(img);
        pw.appendChild(el(doc, 'span', null, planet.name.toUpperCase()));
        card.appendChild(pw);
      }
      card.appendChild(el(doc, 'div', 'fnm', name.toUpperCase()));
      card.appendChild(el(doc, 'div', 'fprof', (row.Profile || '') +
        '  Premium: ' + row.Premium_Resource + '. Rival: ' +
        ((factionByOrdinal(row.Rival_Faction) || {}).name || '—') + '.'));
      const st = el(doc, 'div', 'fstats');
      const mapsWon = rec.mapsWon ? Object.keys(rec.mapsWon).length : 0;
      const avg = rec.starRuns ? Math.round((rec.starSum / rec.starRuns) * 10) / 10 : null;
      st.innerHTML = 'MAPS <b>' + mapsWon + '/9</b>' +
        '<span class="stars">★ ' + (avg != null ? avg.toFixed(1) : '—') + '</span>' +
        'LOYALTY <b>' + loyalty + '</b>';
      card.appendChild(st);
      const badges = el(doc, 'div', 'bwm-badges');
      TECH_BADGES.forEach((b, i) => {
        const lit = tier >= i + 1;
        const at = tech[b.keyAt];
        const bd = el(doc, 'span', 'bwm-badge' + (lit ? ' lit' : ''), b.icon);
        bd.title = b.label + (lit ? ' — UNLOCKED' : ' — unlocks at ' + at + ' cumulative loyalty (you have ' + loyalty + ')');
        badges.appendChild(bd);
      });
      card.appendChild(badges);
      card.addEventListener('click', () => openSurvey(fac ? fac.key : null, name));
      fgrid.appendChild(card);
    }
  }

  let chosenFaction = null;

  // ── PLANET SURVEY (a faction picked): its homeworld live, the dossier, the four resources; confirming sets the
  //    enemy and goes to the campaign maps [MM-story_mvcnxgt8_13]
  const survey = el(doc, 'div', 'bwm-survey');
  const sCol = el(doc, 'div', 'stagecol');
  const sGlobe = globeBox('ground', true);
  sCol.appendChild(sGlobe);
  sCol.appendChild(el(doc, 'div', 'hint', 'DRAG TO SPIN'));
  const sNav = el(doc, 'div', 'nav');
  const prevB = el(doc, 'button', 'bwm-btn'); prevB.appendChild(el(doc, 'span', null, '‹')); prevB.setAttribute('aria-label', 'Previous faction');
  const nextB = el(doc, 'button', 'bwm-btn'); nextB.appendChild(el(doc, 'span', null, '›')); nextB.setAttribute('aria-label', 'Next faction');
  sNav.appendChild(prevB); sNav.appendChild(nextB); sCol.appendChild(sNav);
  survey.appendChild(sCol);
  const doss = el(doc, 'article', 'bwm-doss');
  survey.appendChild(doss);
  root.appendChild(survey);
  let surveyKey = null, surveyName = null;
  const KEYS = Object.keys(PLANETS);
  prevB.addEventListener('click', () => step(-1));
  nextB.addEventListener('click', () => step(1));
  function step(d) {
    const i = KEYS.indexOf(surveyKey), k = KEYS[(i + d + KEYS.length) % KEYS.length], f = REG.find(k);
    openSurvey(k, f ? f.name : k);
  }
  function openSurvey(key, name) {
    if (!key || !PLANETS[key]) { if (cbs.onSelectFaction) cbs.onSelectFaction(name); chosenFaction = name; show('maps'); return; }
    surveyKey = key; surveyName = name;
    const P = PLANETS[key], F = P.faction || {}, fac = REG.find(key);
    const beats = F.beats && REG.find(F.beats), beatsPl = F.beats && PLANETS[F.beats];
    setGlobe(sGlobe, key);
    doss.style.setProperty('--hue', P.ui || '#f2c869');
    sGlobe.style.setProperty('--hue', P.ui || '#f2c869');
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const sv = P.survey || {};
    doss.innerHTML = `<div class="db"><div class="ty">PLANET SURVEY · ${esc(P.type)}</div>
      <div class="fa">Faction ${fac ? fac.ordinal : ''} · ${esc(name)}</div>
      <h2>${esc(P.name)}</h2>
      <p>${esc(P.blurb)}</p>
      <div class="bwm-lush"><span>Barren</span><i><b style="left:${Math.round((P.lush || 0) * 100)}%"></b></i><span>Lush</span></div>
      <dl class="bwm-facts">
        <dt>Forces</dt><dd>${esc(F.trope)}. ${esc(F.identity)}</dd>
        <dt>Signature</dt><dd>${esc(F.dmg)} damage</dd>
        <dt>Beats</dt><dd>${beats ? esc(beats.name) + (beatsPl ? ' (' + esc(beatsPl.name) + ')' : '') : '—'}</dd>
        <dt>Air</dt><dd><span class="sw"><span style="background:${esc(P.haze)}"></span>haze</span><span class="sw"><span style="background:${esc(P.sun || '#fff')}"></span>sunlight</span></dd>
        <dt>Trees</dt><dd>${esc(sv.trees)}</dd><dt>Ground</dt><dd>${esc(sv.ground)}</dd>
        <dt>Rocks</dt><dd>${esc(sv.rocks)}</dd><dt>Airborne</dt><dd>${esc(sv.airborne)}</dd>
      </dl>
      <div class="bwm-res-h">RESOURCES ON ${esc(P.name.toUpperCase())}</div>
      <div class="bwm-res"></div></div>
      <div class="bwm-acts"></div>`;
    const res = doss.querySelector('.bwm-res');
    for (const tier of ['common', 'uncommon', 'rare', 'epic']) {
      const r = (P.resources || {})[tier]; if (!r) continue;
      const [col, role] = TIER_ROLE[tier];
      const t = el(doc, 'div', 'bwm-rtile'); t.style.setProperty('--tc', CRYSTAL[col]);
      const v = el(doc, 'div', 'rv'); v.dataset.res = key + ':' + tier;
      const tx = el(doc, 'div');
      tx.appendChild(el(doc, 'div', 'rn', r.name)); tx.appendChild(el(doc, 'div', 'rr', role)); tx.appendChild(el(doc, 'div', 'rx', r.note));
      t.appendChild(v); t.appendChild(tx); res.appendChild(t);
    }
    const acts = doss.querySelector('.bwm-acts');
    const go = el(doc, 'button', 'bwm-btn primary'); go.appendChild(el(doc, 'span', null, 'BATTLE ON ' + P.name.toUpperCase())); go.appendChild(el(doc, 'span', null, '→'));
    go.addEventListener('click', () => {
      try { const s = loadSave(); s.enemyFaction = name; localStorage.setItem('bulwark:save', JSON.stringify(s)); } catch (e) { /* */ }
      if (cbs.onSelectFaction) cbs.onSelectFaction(name);
      chosenFaction = name;
      show('maps');
    });
    const bk = el(doc, 'button', 'bwm-btn'); bk.appendChild(el(doc, 'span', null, '← FACTIONS'));
    bk.addEventListener('click', () => show('factions'));
    acts.appendChild(go); acts.appendChild(bk);
    show('survey');
  }

  // ── HARVESTER screen (workbook Harvester_Upgrades, levels 1-5, bought with the gold bank) ──
  const harv = el(doc, 'div', 'bwm-maps');
  harv.style.display = 'none';
  const hh = el(doc, 'div', 'bwm-maps-head');
  hh.appendChild(el(doc, 'h2', null, 'HARVESTER'));
  const hbank = el(doc, 'span', 'bwm-bank', '');
  hh.appendChild(hbank);
  const hback = el(doc, 'button', 'bwm-btn back'); hback.style.width = 'auto'; hback.style.padding = '8px 18px';
  hback.appendChild(el(doc, 'span', null, '← MENU'));
  hback.addEventListener('click', () => show('main'));
  hh.appendChild(hback);
  harv.appendChild(hh);
  const hlist = el(doc, 'div');
  harv.appendChild(hlist);
  root.appendChild(harv);

  function refreshHarvester() {
    const s = loadSave();
    const lvl = s.harvesterLevel || 1;
    const bank = (s.carry && s.carry.gold) || 0;
    hbank.textContent = 'BANK ' + bank + 'g';
    hlist.textContent = '';
    for (const up of MAPDATA.harvesterUpgrades) {
      const isCur = up.Level === lvl;
      const owned = up.Level <= lvl;
      const isNext = up.Level === lvl + 1;
      const row = el(doc, 'div', 'bwm-hrow' + (isCur ? ' cur' : '') + (!owned && !isNext ? ' locked' : ''));
      row.appendChild(el(doc, 'div', 'bwm-hlvl', 'L' + up.Level));
      const st = el(doc, 'div', 'bwm-hstats');
      st.innerHTML = 'Capacity <b>×' + up.Capacity_Mult + '</b> · Speed <b>×' + up.Speed_Mult +
        '</b> · HP <b>×' + up.HP_Mult + '</b>' +
        (up.Unlock && up.Unlock !== '—' ? ' · <b>' + up.Unlock + '</b>' : '') +
        '<br>' + (up.Notes || '');
      row.appendChild(st);
      if (owned) {
        row.appendChild(el(doc, 'span', 'bwm-bank', isCur ? 'CURRENT' : 'OWNED'));
      } else if (isNext) {
        const buy = el(doc, 'button', 'bwm-hbuy', 'BUY — ' + up.Gold_Cost + 'g');
        buy.disabled = bank < up.Gold_Cost;
        buy.title = bank < up.Gold_Cost ? 'Bank gold by finishing maps (your leftover gold carries forward)' : '';
        buy.addEventListener('click', () => {
          if (cbs.onBuyHarvester) cbs.onBuyHarvester(up.Level, up.Gold_Cost);
          refreshHarvester();
        });
        row.appendChild(buy);
      }
      hlist.appendChild(row);
    }
  }

  // ── TECH screen (Amendment B2: per-type tier unlocks, bought with the gold bank) ──
  const tech = el(doc, 'div', 'bwm-maps');
  tech.style.display = 'none';
  const th = el(doc, 'div', 'bwm-maps-head');
  th.appendChild(el(doc, 'h2', null, 'TECH'));
  const tbank = el(doc, 'span', 'bwm-bank', '');
  th.appendChild(tbank);
  const tback = el(doc, 'button', 'bwm-btn back'); tback.style.width = 'auto'; tback.style.padding = '8px 18px';
  tback.appendChild(el(doc, 'span', null, '← MENU'));
  tback.addEventListener('click', () => show('main'));
  th.appendChild(tback);
  tech.appendChild(th);
  const tlist = el(doc, 'div');
  tech.appendChild(tlist);
  root.appendChild(tech);

  const TECH_TYPES = [
    { key: 'cannon', label: 'CANNONS', note: 'Anti-ground turret line. T4 (range) comes later.' },
    { key: 'flak', label: 'ANTI-AIR', note: 'Flak tower line. T4 (range) comes later.' },
    { key: 'wall', label: 'WALLS', note: 'Fortification line. T4 (extra HP) comes later.' },
  ];
  function refreshTech() {
    const s = loadSave();
    const bank = (s.carry && s.carry.gold) || 0;
    tbank.textContent = 'BANK ' + bank + 'g';
    tlist.textContent = '';
    for (const tt of TECH_TYPES) {
      const cur = (s.structTiers && s.structTiers[tt.key]) || 1;
      const row = el(doc, 'div', 'bwm-hrow' + (cur >= 3 ? ' cur' : ''));
      row.appendChild(el(doc, 'div', 'bwm-hlvl', 'T' + cur));
      const st = el(doc, 'div', 'bwm-hstats');
      st.innerHTML = '<b>' + tt.label + '</b> — battle upgrades unlocked through tier ' + cur +
        '<br>' + tt.note;
      row.appendChild(st);
      if (cur < 3) {
        const cost = TIER_COSTS[tt.key][cur - 1];
        const buy = el(doc, 'button', 'bwm-hbuy', 'UNLOCK T' + (cur + 1) + ' — ' + cost + 'g');
        buy.disabled = bank < cost;
        buy.title = bank < cost ? 'Bank gold by finishing maps' : '';
        buy.addEventListener('click', () => {
          if (cbs.onBuyTier) cbs.onBuyTier(tt.key, cur + 1);
          refreshTech();
        });
        row.appendChild(buy);
      } else {
        row.appendChild(el(doc, 'span', 'bwm-bank', 'MAXED (T4 soon)'));
      }
      tlist.appendChild(row);
    }
  }

  // ── TECH TREE screen (the epic: curved color paths, node cards, research inspector) ──
  const techTree = buildTechTree(doc, {
    onBack: () => show('main'),
    onClassic: () => show('tech'),                 // keep the Amendment-B2 structure-tier economy reachable
    onResearch: (id, cost) => { if (cbs.onResearch) cbs.onResearch(id, cost); },
  });
  techTree.root.style.display = 'none';
  root.appendChild(techTree.root);

  // ── SETTINGS (owner: settings on the main menu) — audio channels, shared with the in-game gear ──
  const settings = el(doc, 'div', 'bwm-maps');
  settings.style.display = 'none';
  const sh = el(doc, 'div', 'bwm-maps-head');
  sh.appendChild(el(doc, 'h2', null, 'SETTINGS'));
  const sback = el(doc, 'button', 'bwm-btn back'); sback.style.width = 'auto'; sback.style.padding = '8px 18px';
  sback.appendChild(el(doc, 'span', null, '← MENU'));
  sback.addEventListener('click', () => show('main'));
  sh.appendChild(sback);
  settings.appendChild(sh);
  const setBox = el(doc, 'div', 'bwm-set');
  // FACTION selector (owner): choose / reset the enemy faction from settings (dev + play convenience)
  {
    const row = el(doc, 'div', 'bwm-srow');
    row.appendChild(el(doc, 'label', null, 'ENEMY FACTION'));
    const sel = el(doc, 'select');
    sel.style.cssText = 'flex:1;background:#0c0e12;color:#e6ecf3;border:1px solid #2e3846;border-radius:5px;padding:6px 8px;font-size:12px';
    const optMix = el(doc, 'option'); optMix.value = ''; optMix.textContent = 'Rotation (mixed)'; sel.appendChild(optMix);
    for (const n of REG.NAMES) { const o = el(doc, 'option'); o.value = n; o.textContent = n; sel.appendChild(o); }
    // The default enemy is the GROUND faction — named by its stable key, so the display name is
    // still spelled in exactly one place (main.js DEFAULT_FACTION resolves the same way).
    const DEFAULT_ENEMY = REG.find('ground').name;
    sel.value = (loadSave().enemyFaction) || DEFAULT_ENEMY;
    sel.addEventListener('change', () => {
      const f = sel.value || null;
      try { const sv = loadSave(); sv.enemyFaction = f || null; localStorage.setItem('bulwark:save', JSON.stringify(sv)); } catch (e) { /* */ }
      if (cbs.onSelectFaction) cbs.onSelectFaction(f);
    });
    const rst = el(doc, 'button', 'bwm-btn'); rst.style.cssText = 'width:auto;padding:6px 12px;flex:0 0 auto';
    rst.appendChild(el(doc, 'span', null, 'RESET'));
    rst.title = 'Back to ' + DEFAULT_ENEMY;
    rst.addEventListener('click', () => { sel.value = DEFAULT_ENEMY; sel.dispatchEvent(new Event('change')); });
    row.appendChild(sel); row.appendChild(rst);
    setBox.appendChild(row);
  }
  const vols = { master: 0.8, dialog: 1, game: 1 };
  try { Object.assign(vols, JSON.parse(localStorage.getItem('bw.volumes') || '{}')); } catch (e) { /* fresh */ }
  for (const ch of ['master', 'dialog', 'game']) {
    const row = el(doc, 'div', 'bwm-srow');
    row.appendChild(el(doc, 'label', null, ch.toUpperCase() + ' VOLUME'));
    const sl = el(doc, 'input'); sl.type = 'range'; sl.min = '0'; sl.max = '100'; sl.value = String(Math.round((vols[ch] ?? 1) * 100));
    const vlab = el(doc, 'span', 'v', sl.value + '%');
    sl.addEventListener('input', () => {
      const v = (+sl.value) / 100; vols[ch] = v; vlab.textContent = sl.value + '%';
      try { localStorage.setItem('bw.volumes', JSON.stringify(vols)); } catch (e) { /* full */ }
      try { setChannelVolume(ch, v); } catch (e) { /* audio not up yet */ }
    });
    row.appendChild(sl); row.appendChild(vlab);
    setBox.appendChild(row);
  }
  setBox.appendChild(el(doc, 'div', 'note', 'Audio is shared with the in-game settings gear. More options land here as they ship.'));
  const nsty = el(doc, 'style'); nsty.textContent = '.bwm-set .note{font-size:11px;color:#8fa0b3;margin-top:6px}';
  setBox.appendChild(nsty);
  settings.appendChild(setBox);
  root.appendChild(settings);

  root.appendChild(el(doc, 'div', 'bwm-foot', 'BULWARK — TEST BUILD'));

  function fmtPar(sec) {
    const m = Math.round(sec / 60);
    return '~' + m + ' MIN';
  }

  function refreshMaps() {
    const s = loadSave();
    grid.textContent = '';
    for (const row of MAPDATA.maps) {
      const id = row.Map_ID;
      const rec = s.maps[id] || {};
      const locked = id > s.unlockedThrough;
      const card = el(doc, 'div', 'bwm-card' + (locked ? ' locked' : ''));
      card.appendChild(el(doc, 'div', 'nm', row.Map_Name.replace('_', ' ')));
      card.appendChild(el(doc, 'div', 'sz', row.Full_W + ' × ' + row.Full_H +
        (row.Has_Water ? '  ·  WATER' : '') + '  ·  DIFF ' + row.Difficulty.toFixed(2)));
      card.appendChild(el(doc, 'span', 'res', String(row.Primary_Resource).toUpperCase()));
      card.appendChild(el(doc, 'div', 'note', locked ? 'Reach a ★ 3.0 average on the previous map.' : (row.Notes || '')));
      const meta = el(doc, 'div', 'meta');
      meta.appendChild(el(doc, 'span', null, fmtPar(row.Par_Time_Sec)));
      meta.appendChild(el(doc, 'span', 'best',
        (rec.avg != null ? '★ ' + rec.avg.toFixed(1) + '  ' : '') +
        (rec.bestScore != null ? 'BEST ' + rec.bestScore : '')));
      card.appendChild(meta);
      if (locked) card.appendChild(el(doc, 'span', 'lock', '🔒'));
      else if (rec.beaten) card.appendChild(el(doc, 'span', 'done', '✓ WON'));
      if (!locked) card.addEventListener('click', () => { if (cbs.onPlayMap) cbs.onPlayMap(id); });
      grid.appendChild(card);
    }
  }

  function show(screen) {
    main.style.display = screen === 'main' ? 'flex' : 'none';
    maps.style.display = screen === 'maps' ? 'block' : 'none';
    factions.style.display = screen === 'factions' ? 'block' : 'none';
    harv.style.display = screen === 'harvester' ? 'block' : 'none';
    tech.style.display = screen === 'tech' ? 'block' : 'none';
    techTree.root.style.display = screen === 'techtree' ? 'block' : 'none';
    settings.style.display = screen === 'settings' ? 'block' : 'none';
    survey.style.display = screen === 'survey' ? 'grid' : 'none';
    root.classList.toggle('space', screen === 'main' || screen === 'survey');
    current = screen;
    syncStage();
    if (screen === 'factions') refreshFactions();
    if (screen === 'harvester') refreshHarvester();
    if (screen === 'tech') refreshTech();
    if (screen === 'techtree') techTree.refresh();
    if (screen === 'maps') {
      mh.firstChild.textContent = chosenFaction ? 'CAMPAIGN — VS ' + chosenFaction.toUpperCase() : 'CAMPAIGN';
      refreshMaps();
    }
    if (screen === 'main') {
      const s = loadSave();
      const started = s.unlockedThrough > 1 || Object.keys(s.maps).length > 0;
      continueBtn.firstChild.textContent = started ? 'CONTINUE — MAP ' + Math.min(9, s.unlockedThrough) : 'PLAY';
      // the next planet = the current enemy's homeworld
      const enemy = (cbs.currentFaction && cbs.currentFaction()) || s.enemyFaction || REG.find('ground').name;
      const f = REG.find(enemy) || REG.find('ground'), P = PLANETS[f.key];
      setGlobe(heroGlobe, f.key);
      continueBtn.lastChild.textContent = P ? 'vs ' + f.name + ' · ' + P.name : '';
      heroNext.innerHTML = P ? 'NEXT PLANET · <b>' + P.name.toUpperCase() + '</b>' : '';
      hero.style.setProperty('--hue', (P && P.ui) || '#f2c869');
      // the player's landing craft
      const ck = (cbs.playerCraft && cbs.playerCraft()) || 'system', cd = craftFor(ck) || LANDING_CRAFT.lc_neutral;
      craftView.dataset.craft = ck;
      craftText.innerHTML = '';
      craftText.appendChild(el(doc, 'div', 'ck', 'YOUR LANDING CRAFT'));
      craftText.appendChild(el(doc, 'div', 'cn', cd.name));
      craftText.appendChild(el(doc, 'div', 'cw', cd.factionName + ' · ' + cd.weaponType));
    }
  }

  mountEl.appendChild(root);

  // ── live 3D (menuStage.js): loads three.js once, runs only while the menu shows a screen with a 3D picture
  let current = 'main', stage = null, stageLoading = false, stageFailed = false;
  const wants3D = () => root.style.display !== 'none' && (current === 'main' || current === 'survey');
  function syncStage() {
    if (stage) { if (wants3D()) stage.start(); else stage.pause(); return; }
    if (stageFailed || stageLoading || !wants3D()) return;
    try { if (/[?&]menu3d=0\b/.test(doc.defaultView.location.search)) { stageFailed = true; return; } } catch (e) { /* */ }
    stageLoading = true;
    Promise.all([import(THREE_URL), import('./menuStage.js')]).then(([THREE, M]) => {
      stageLoading = false;
      stage = M.createMenuStage(THREE, root);
      if (!stage) { stageFailed = true; return; }
      syncStage();
    }).catch((e) => { stageLoading = false; stageFailed = true; console.warn('[menu] live 3D unavailable —', e && e.message); });
  }
  // a faint static starfield behind the planet screens
  try {
    const c = doc.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
    let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) { const a = 0.12 + r() * 0.6, z = r() < 0.07 ? 1.6 : 0.9; x.fillStyle = `rgba(${200 + r() * 55 | 0},${210 + r() * 45 | 0},255,${a})`; x.fillRect(r() * 512, r() * 512, z, z); }
    root.style.setProperty('--stars', `url(${c.toDataURL()})`);
  } catch (e) { /* no 2D canvas */ }

  const api = {
    root,
    open(screen) { root.style.display = 'flex'; show(screen || 'main'); },
    close() { root.style.display = 'none'; syncStage(); },
    isOpen() { return root.style.display !== 'none'; },
    /** test hook: open a faction's survey by key */
    survey(key) { const f = REG.find(key); root.style.display = 'flex'; openSurvey(key, f ? f.name : key); },
  };
  show('main');
  return api;
}
