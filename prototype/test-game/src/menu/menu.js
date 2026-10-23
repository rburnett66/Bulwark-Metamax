/**
 * src/menu/menu.js — the MAIN MENU, ported from the Claude Design proof (Design-Proof MENU).
 *
 * Same runtime as the game: a DOM overlay above the canvas (the HUD pattern), carrying the
 * proof's design language — gold on ink, panel lines, crest, letterspaced wordmark. Two screens carry the
 * campaign: MAIN (the current planet, zoomable out to the 3D galaxy) and SURVEY (the 9 planets / factions, the
 * planet dossier and the campaign drop-down) — owner 2026-10-19: "Main Menu, Survey … Short path player goes from
 * Main Menu to Survey directly to gameplay on the target campaign" [MM-epic_mvftpzrk_j]. The old FACTIONS and MAPS
 * screens are gone; side screens (harvester, tech, settings) are unchanged.
 *
 * The menu READS the save (locks, best scores) and never touches the sim; starting a map goes
 * through the same selectMap() the settings picker uses. Dev loop: ?map=N boots straight into a
 * battle with no menu (main.js).
 */
import { MAPDATA } from '../../content/maps/mapdata.js';
import { loadSave, buyTech, refundTech, takePendingRewards, markSeen, totalStars, bankOf } from '../save/save.js';
import { setChannelVolume } from '../comm/voice.js';
import { readyIds, countOwned } from '../data/techtree.js';
import { techCtxFromSave, createGameTechAdapter } from './techSave.js';
import { computeBadges, seenFor } from './badges.js';
import { createProgressWidget } from './progressWidget.js';
// The faction registry (GGG-3). Side-effect import + global namespace: factions.js is a classic
// script with no ES exports, so a named import is a SyntaxError. See voice.js for the full note.
import '../data/factions.js';
const REG = globalThis.BulwarkFactions;
import { PLANETS, planetImage } from '../data/planets.js';
import { LANDING_CRAFT, craftFor } from '../render3d/craft/models.js';
import { CRYSTAL } from '../render3d/styles/lowpoly-palettes.js';
import { campaignOptions, defaultCampaign } from './campaignPick.js';
import { SYSTEM_KEYS } from '../data/galaxy.js';
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
/* PLAY — the one call to action, drawn to stand out (owner 2026-10-19 option A): 2× size, black weight, gold glow [MM-task_mvg1hbnl_1u] */
.bwm-btn.bwm-play { padding:14px 22px; box-shadow:0 0 0 1px #f2c869, 0 0 28px rgba(242,200,105,.55); }
.bwm-btn.bwm-play > span:first-child { font-size:30px; font-weight:900; letter-spacing:.18em; line-height:1.15; text-shadow:0 1px 0 rgba(255,255,255,.35); }
.bwm-acts .bwm-btn.bwm-play { flex:1.6 1 auto; }
.bwm-btn:disabled:hover { border-color:#2e3846; background:#1a1f28; }
/* SURVEY rail: the 9 planets / factions (was the FACTIONS screen) [MM-story_mvftq4h6_k] */
.bwm-badges { display:flex; gap:8px; }
.bwm-badge { width:28px; height:28px; display:flex; align-items:center; justify-content:center;
  font-size:15px; border:1px solid #2e3846; background:#14181f; color:#3a4350; cursor:help; }
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
/* MAIN: the GALAXY layer — the main screen zooms out from the planet to the 9 systems [MM-story_mvftq5q8_l] */
.bwm-main { position:relative; }
.bwm-menu > * { position:relative; z-index:7; }   /* buttons over the 3D canvas; the column itself stays unpositioned (phone craft card) */
.bwm-galaxy { position:absolute; inset:0; display:none; z-index:7; touch-action:none; cursor:default; }   /* above the 3D canvas (transparent DOM): labels stay on top */
.bwm-root.galaxy .bwm-galaxy { display:block; }
.bwm-root.galaxy .bwm-hero.planet .bwm-htext, .bwm-root.galaxy .bwm-hero.planet .bwm-next { opacity:0; transition:opacity .4s; }
.bwm-galaxy [data-sys] { position:absolute; left:0; top:0; margin:12px 0 0 12px; padding:3px 8px; font-size:11px; font-weight:800; letter-spacing:.22em;
  color:var(--hue,#cfe3f0); background:rgba(10,13,18,.72); border:1px solid rgba(46,56,70,.9); white-space:nowrap; cursor:pointer; opacity:0;
  transition:border-color .12s, background .12s; z-index:7; }
.bwm-galaxy [data-sys]:hover { border-color:var(--hue,#d9a441); }
.bwm-galaxy [data-sys].on { border-color:#f2c869; background:rgba(40,32,14,.85); color:#f2c869; }
.bwm-zoom { position:absolute; z-index:8; right:calc(min(72vh, 36vw) / 2); top:4%; transform:translateX(50%); width:auto !important;
  padding:7px 14px !important; font-size:11px !important; letter-spacing:.24em !important; gap:8px; }
.bwm-root.galaxy .bwm-zoom { right:auto; left:clamp(24px,6vw,90px); top:10px; transform:none; }
.bwm-ghint { position:absolute; z-index:8; left:clamp(24px,6vw,90px); bottom:10px; font-size:10px; letter-spacing:.24em; color:#8fa0b3; display:none; pointer-events:none; }
.bwm-root.galaxy .bwm-ghint { display:block; }
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
.bwm-survey { flex:1; display:none; min-height:0; padding:4px clamp(16px,2.5vw,40px) 18px; gap:clamp(10px,2vw,28px);
  grid-template-columns:minmax(170px,230px) minmax(0,1fr) minmax(0,1fr); grid-template-rows:minmax(0,1fr); align-items:center; }
.bwm-rail { align-self:stretch; display:flex; flex-direction:column; gap:6px; min-height:0; overflow-y:auto; padding:2px 4px 2px 0; }
.bwm-rail .rh { font-size:10px; letter-spacing:.3em; color:#d9a441; margin:2px 0 4px; }
.bwm-pl { display:grid; grid-template-columns:40px minmax(0,1fr); gap:2px 10px; align-items:center; text-align:left; width:100%;
  background:rgba(20,24,31,.78); border:1px solid #2e3846; border-left:3px solid transparent; color:#e6ecf3; padding:6px 8px; cursor:pointer;
  font:inherit; transition:border-color .12s, background .12s; }
.bwm-pl:hover { border-color:#3e4a5a; background:rgba(28,34,43,.9); }
.bwm-pl.on { border-color:var(--hue,#d9a441); border-left-color:var(--hue,#d9a441); background:rgba(30,36,46,.95); }
.bwm-pl img { grid-row:span 2; width:40px; height:40px; display:block; }
.bwm-pl .pn { font-size:12.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--hue,#e6ecf3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bwm-pl .pf { font-size:10px; color:#8fa0b3; letter-spacing:.06em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bwm-pl .pf b { color:#e6ecf3; font-weight:700; }
.bwm-pl .pf .st { color:#f2c869; }
.bwm-camp { margin-top:12px; padding:10px 12px; background:#14181f; border:1px solid #2e3846; border-left:3px solid var(--hue,#d9a441); flex:0 0 auto; }
.bwm-camp label { display:block; font-size:10px; letter-spacing:.3em; color:#d9a441; margin-bottom:6px; }
.bwm-camp select { width:100%; background:#1a1f28; color:#e6ecf3; border:1px solid #3e4a5a; padding:9px 10px; font:inherit; font-size:14px;
  font-weight:700; letter-spacing:.06em; cursor:pointer; }
.bwm-camp select:focus { outline:1px solid #d9a441; }
.bwm-camp .cd { margin-top:6px; font-size:11px; color:#8fa0b3; line-height:1.45; }
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
  .bwm-rail { flex-direction:row; overflow-x:auto; overflow-y:hidden; align-self:auto; }
  .bwm-rail .rh { display:none; }
  .bwm-pl { flex:0 0 auto; width:auto; grid-template-columns:32px auto; }
  .bwm-pl img { width:32px; height:32px; }
  .bwm-pl .pf { display:none; }
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
  .bwm-btn.bwm-play { padding:8px 16px; }
  .bwm-btn.bwm-play > span:first-child { font-size:22px; }
  .bwm-maps { padding:4px 20px 12px; }
  .bwm-maps-head { margin:2px 2px 8px; }
  .bwm-maps-head h2 { font-size:14px; letter-spacing:.24em; }
  .bwm-hero.planet .bwm-globe { height:min(82vh, 44vw); }
  .bwm-hero.planet .bwm-title { font-size:clamp(24px,9vh,40px); }
  .bwm-hero.planet .bwm-sub { display:none; }
  .bwm-craft { padding:6px 8px; gap:8px; margin-top:2px; position:absolute; left:16px; bottom:8px; width:230px; z-index:7; }
  .bwm-ghint { display:none !important; }
  .bwm-root.galaxy .bwm-craft { display:none; }   /* the galaxy needs the corner on a phone */
  .bwm-hero.planet .bwm-next { display:none; }
  .bwm-acts { margin-top:8px; }
  .bwm-acts .bwm-btn { padding:8px 12px; }
  .bwm-craft .cv { flex-basis:84px; height:56px; }
  .bwm-craft .cw { display:none; }
  .bwm-survey { padding:2px 16px 8px; gap:12px; grid-template-columns:minmax(132px,170px) minmax(0,.8fr) minmax(0,1fr); }
  .bwm-pl { grid-template-columns:28px minmax(0,1fr); padding:4px 6px; }
  .bwm-pl img { width:28px; height:28px; grid-row:auto; }
  .bwm-pl .pf { display:none; }
  .bwm-camp { margin-top:6px; padding:6px 8px; }
  .bwm-camp select { padding:6px 8px; font-size:12px; }
  .bwm-camp .cd { display:none; }
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
  // the PROGRESSION WIDGET (Menu-Progression-Design §2): rank + XP, gold, stars, research — on every menu screen
  const widget = createProgressWidget(doc, { onOpen: (k) => { if (k === 'gold' || k === 'research') show('techtree'); else openSurvey(targetKey()); } });
  top.appendChild(widget.el);
  root.appendChild(top);

  // ── MAIN screen ──
  const main = el(doc, 'div', 'bwm-main');
  // the hero is the NEXT PLANET — the current enemy's homeworld, live and spinnable, no data (that's the survey's job)
  const hero = el(doc, 'div', 'bwm-hero planet');
  const heroGlobe = globeBox('ground', true);
  hero.appendChild(heroGlobe);
  const htext = el(doc, 'div', 'bwm-htext');
  htext.appendChild(el(doc, 'div', 'bwm-kicker', 'CAMPAIGN — 9 PLANETS'));
  const title = el(doc, 'div', 'bwm-title'); title.innerHTML = 'HOLD THE<br><span>BULWARK</span>';
  htext.appendChild(title);
  htext.appendChild(el(doc, 'div', 'bwm-sub',
    'Harvest the fields. Raise the walls. Eight waves per map, each map bigger than the last — your gold and your defenses march with you.'));
  hero.appendChild(htext);
  const heroNext = el(doc, 'div', 'bwm-next');
  hero.appendChild(heroNext);
  main.appendChild(hero);
  // ── the GALAXY: zoom out from the planet to the nine systems (menuStage → galaxyStage.js) [MM-story_mvftq5q8_l]
  //    Default is always the planet; wheel / pinch / the button fly out and back; clicking a system makes it the target.
  const galaxy = el(doc, 'div', 'bwm-galaxy');
  galaxy.dataset.galaxy = ''; galaxy.dataset.mode = 'planet';
  galaxy.setAttribute('aria-label', 'Galaxy — click a solar system to target its planet');
  for (const key of SYSTEM_KEYS) {
    const lab = el(doc, 'span', null, (PLANETS[key].name || key).toUpperCase());
    lab.dataset.sys = key; lab.style.setProperty('--hue', PLANETS[key].ui || '#cfe3f0');
    const f = REG.find(key); lab.title = PLANETS[key].name + (f ? ' — ' + f.name : '');
    galaxy.appendChild(lab);
  }
  main.appendChild(galaxy);
  const zoomBtn = el(doc, 'button', 'bwm-btn bwm-zoom');
  zoomBtn.appendChild(el(doc, 'span', null, '◎ GALAXY'));
  zoomBtn.addEventListener('click', () => (galaxyOn() ? zoomIn() : zoomOut()));
  hero.appendChild(zoomBtn);
  const ghint = el(doc, 'div', 'bwm-ghint', 'CLICK A SYSTEM TO TARGET IT · SCROLL IN FOR THE PLANET');
  main.appendChild(ghint);
  const galaxyOn = () => galaxy.dataset.mode === 'galaxy';
  function zoomOut() {
    if (!stage || galaxyOn()) return;
    const mr = main.getBoundingClientRect(), gr = heroGlobe.getBoundingClientRect();
    galaxy.dataset.gx = String(gr.left + gr.width / 2 - mr.left); galaxy.dataset.gy = String(gr.top + gr.height / 2 - mr.top); galaxy.dataset.gh = String(gr.height);
    galaxy.dataset.target = heroGlobe.dataset.globe || targetKey();
    galaxy.dataset.cx = String(Math.max(160, (menu.getBoundingClientRect().left - mr.left) / 2));   // centre the spiral beside the buttons
    galaxy.dataset.mode = 'galaxy';
    heroGlobe.removeAttribute('data-globe');            // the galaxy's own globe takes over in the same spot
    root.classList.add('galaxy');
    zoomBtn.firstChild.textContent = '◉ PLANET';
  }
  function zoomIn() { if (galaxyOn()) { galaxy.dataset.mode = 'planet'; zoomBtn.firstChild.textContent = '◎ GALAXY'; } }
  function landPlanet() {                               // the fly back landed: the live globe returns
    galaxy.dataset.mode = 'planet';
    root.classList.remove('galaxy');
    setGlobe(heroGlobe, galaxy.dataset.target || targetKey());
    zoomBtn.firstChild.textContent = '◎ GALAXY';
  }
  galaxy.addEventListener('bwm-galaxy-arrive', landPlanet);
  galaxy.addEventListener('bwm-galaxy-pick', (e) => {
    const key = e.detail && e.detail.key; if (!key || !PLANETS[key]) return;
    setTarget(key);
    galaxy.dataset.target = key;
    refreshHeroTarget();
    zoomIn();                                           // fly in to the newly targeted planet
  });
  // wheel / pinch on the main screen's picture
  const onWheel = (e) => { if (current !== 'main') return; if (e.deltaY > 4) zoomOut(); else if (e.deltaY < -4) zoomIn(); };
  hero.addEventListener('wheel', onWheel, { passive: true }); galaxy.addEventListener('wheel', onWheel, { passive: true });
  const pts = new Map(); let pinch0 = 0;
  const pd = (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
  const pm = (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size !== 2 || !pinch0) return;
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d < pinch0 * 0.75) { zoomOut(); pinch0 = 0; } else if (d > pinch0 * 1.33) { zoomIn(); pinch0 = 0; }
  };
  const pu = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  for (const t of [hero, galaxy]) { t.addEventListener('pointerdown', pd); t.addEventListener('pointermove', pm); t.addEventListener('pointerup', pu); t.addEventListener('pointercancel', pu); }

  const menu = el(doc, 'div', 'bwm-menu');
  const mkBtn = (label, hint, cls, onClick) => {
    const b = el(doc, 'button', 'bwm-btn' + (cls ? ' ' + cls : ''));
    b.appendChild(el(doc, 'span', null, label));
    if (hint) b.appendChild(el(doc, 'span', 'hint', hint));
    b.addEventListener('click', onClick);
    const dot = el(doc, 'i', 'bwm-dot'); b.appendChild(dot); b.dot = dot;   // red-dot badge (badges.js)
    menu.appendChild(b);
    return b;
  };
  // the short path: MAIN → SURVEY (the target planet, its highest unlocked campaign preselected) → battle
  const continueBtn = mkBtn('PLAY', ' ', 'primary bwm-play', () => openSurvey(targetKey()));   // owner 2026-10-19: reads PLAY [MM-task_mvg1hbnl_1u]
  const harvBtn = mkBtn('HARVESTER', 'upgrade the fleet', null, () => show('harvester'));
  const techBtn = mkBtn('TECH TREE', 'research upgrades', null, () => show('techtree'));
  mkBtn('CLASSIC BOARD', 'endless test field', null, () => { if (cbs.onPlayMap) cbs.onPlayMap(0); });
  mkBtn('REPLAY LAST BATTLE', '', null, () => { if (cbs.onReplay) cbs.onReplay(); });
  mkBtn('RESET PROGRESS', 'wipe all progress', null, () => {
    if (doc.defaultView && !doc.defaultView.confirm('Reset all progress? Stars, gold, loyalty, tech and faction records are wiped.')) return;
    if (cbs.onResetCampaign) cbs.onResetCampaign();
    show('main');   // refresh the Continue label + locks
  });
  const setBtn = mkBtn('SETTINGS', 'audio & options', null, () => show('settings'));   // last
  const DOTS = { play: continueBtn.dot, harvester: harvBtn.dot, techtree: techBtn.dot, settings: setBtn.dot };
  // the player's landing craft (a small panel; the craft turns on a turntable)
  const craftCard = el(doc, 'div', 'bwm-craft');
  const craftView = el(doc, 'div', 'cv');
  const craftText = el(doc, 'div');
  craftCard.appendChild(craftView); craftCard.appendChild(craftText);
  menu.appendChild(craftCard);
  main.appendChild(menu);
  root.appendChild(main);

  // the TARGET planet: the saved enemy faction's homeworld (or the galaxy pick on the main menu)
  function targetKey() {
    const s = loadSave();
    const enemy = (cbs.currentFaction && cbs.currentFaction()) || s.enemyFaction || REG.find('ground').name;
    const f = REG.find(enemy) || REG.find('ground');
    return f.key;
  }
  function setTarget(key) {
    const f = REG.find(key); if (!f) return;
    try { const s = loadSave(); s.enemyFaction = f.name; localStorage.setItem('bulwark:save', JSON.stringify(s)); } catch (e) { /* */ }
    if (cbs.onSelectFaction) cbs.onSelectFaction(f.name);
  }

  // ── PLANET SURVEY (a faction picked): its homeworld live, the dossier, the four resources; confirming sets the
  //    enemy and goes to the campaign maps [MM-story_mvcnxgt8_13]
  const survey = el(doc, 'div', 'bwm-survey');
  // the 9 planets / factions (was the FACTIONS screen): pick one to survey it [MM-story_mvftq4h6_k]
  const rail = el(doc, 'nav', 'bwm-rail'); rail.setAttribute('aria-label', 'Planets');
  survey.appendChild(rail);
  function refreshRail(selKey) {
    const s = loadSave();
    rail.textContent = '';
    rail.appendChild(el(doc, 'div', 'rh', 'PLANETS'));
    for (const key of Object.keys(PLANETS)) {
      const P = PLANETS[key], fac = REG.find(key); if (!fac) continue;
      const rec = (s.factionRecords || {})[fac.name] || {};
      const won = rec.mapsWon ? Object.keys(rec.mapsWon).length : 0;
      const avg = rec.starRuns ? (rec.starSum / rec.starRuns).toFixed(1) : '—';
      const b = el(doc, 'button', 'bwm-pl' + (key === selKey ? ' on' : ''));
      b.style.setProperty('--hue', P.ui || '#f2c869');
      b.setAttribute('aria-pressed', key === selKey ? 'true' : 'false');
      b.title = P.name + ' — ' + fac.name + ': ' + P.blurb;
      const img = el(doc, 'img'); img.alt = ''; img.src = planetImage(key) || ''; img.loading = 'lazy'; img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
      b.appendChild(img);
      b.appendChild(el(doc, 'span', 'pn', P.name));
      const pf = el(doc, 'span', 'pf'); pf.innerHTML = '';
      pf.appendChild(doc.createTextNode(fac.name + ' · '));
      pf.appendChild(el(doc, 'b', null, won + '/9'));
      pf.appendChild(el(doc, 'span', 'st', '  ★ ' + avg));
      b.appendChild(pf);
      b.addEventListener('click', () => openSurvey(key));
      rail.appendChild(b);
    }
  }
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
    const i = KEYS.indexOf(surveyKey), k = KEYS[(i + d + KEYS.length) % KEYS.length];
    openSurvey(k);
  }
  function openSurvey(key) {
    if (!key || !PLANETS[key]) key = targetKey();
    const name = (REG.find(key) || {}).name || key;
    surveyKey = key; surveyName = name;
    if (cbs.onPlanetView) cbs.onPlanetView(key);   // planet music follows the planet on screen [MM-story_mvgzp51o_8]
    refreshRail(key);
    const P = PLANETS[key], F = P.faction || {}, fac = REG.find(key);
    const beats = F.beats && REG.find(F.beats), beatsPl = F.beats && PLANETS[F.beats];
    setGlobe(sGlobe, key);
    doss.style.setProperty('--hue', P.ui || '#f2c869');
    sGlobe.style.setProperty('--hue', P.ui || '#f2c869');
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const sv = P.survey || {};
    doss.innerHTML = `<div class="db" data-clip><div class="ty">PLANET SURVEY · ${esc(P.type)}</div>
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
        <dt>Tech</dt><dd class="bwm-badges"></dd>
      </dl>
      <div class="bwm-res-h">RESOURCES ON ${esc(P.name.toUpperCase())}</div>
      <div class="bwm-res"></div></div>
      <div class="bwm-camp"><label for="bwm-camp-sel">CAMPAIGN</label><select id="bwm-camp-sel"></select><div class="cd"></div></div>
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
    // the faction's tech badges (they were on the FACTIONS cards): lit once the loyalty threshold is reached
    {
      const sv = loadSave(), loyalty = (sv.loyalty || {})[name] || 0, tier = (sv.tech || {})[name] || 0;
      const row = fac && MAPDATA.factions.find((r) => r.Faction_ID === fac.ordinal);
      const tech = (row && MAPDATA.techTree.find((t) => t.Faction === row.Faction_Name)) || {};
      const box = doss.querySelector('.bwm-facts .bwm-badges');
      TECH_BADGES.forEach((b, i) => {
        const lit = tier >= i + 1, bd = el(doc, 'span', 'bwm-badge' + (lit ? ' lit' : ''), b.icon);
        bd.title = b.label + (lit ? ' — UNLOCKED' : ' — unlocks at ' + tech[b.keyAt] + ' cumulative loyalty (you have ' + loyalty + ')');
        box.appendChild(bd);
      });
    }
    // the campaign drop-down: the unlocked maps, the highest preselected; locked ones listed but disabled
    const sv0 = loadSave(), opts = campaignOptions(sv0, MAPDATA.maps), sel = doss.querySelector('#bwm-camp-sel'), cd = doss.querySelector('.bwm-camp .cd');
    for (const o of opts) { const op = el(doc, 'option', null, o.label); op.value = String(o.id); op.disabled = o.locked; sel.appendChild(op); }
    sel.value = String(defaultCampaign(sv0, MAPDATA.maps.length));
    const detail = () => { const o = opts.find((x) => String(x.id) === sel.value); cd.textContent = o ? o.detail : ''; };
    sel.addEventListener('change', detail); detail();
    const acts = doss.querySelector('.bwm-acts');
    const go = el(doc, 'button', 'bwm-btn primary bwm-play'); go.appendChild(el(doc, 'span', null, 'PLAY'));   // owner 2026-10-19: just PLAY [MM-task_mvg1hbnl_1u]
    go.addEventListener('click', () => {
      setTarget(key);
      if (cbs.onPlayMap) cbs.onPlayMap(Number(sel.value) || defaultCampaign(loadSave(), MAPDATA.maps.length));
    });
    const bk = el(doc, 'button', 'bwm-btn'); bk.appendChild(el(doc, 'span', null, '← MENU'));
    bk.addEventListener('click', () => show('main'));
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
          refreshHarvester(); refreshProgress();
        });
        row.appendChild(buy);
      }
      hlist.appendChild(row);
    }
  }

  // ── TECH TREE = the TECH NET (Menu-Progression-Design §1) [MM-story_mvkhed1f_h]: the 3D tree on the real save. It replaces
  //    the display-only Tech Tree screen and the classic TECH tier screen. Loads three.js + the net on first open.
  const netHost = el(doc, 'div', 'bwm-technet');
  netHost.style.display = 'none';
  root.appendChild(netHost);
  const nsty0 = el(doc, 'style'); nsty0.textContent = '.bwm-technet{position:absolute;inset:0;z-index:30;background:#02050c}' +
    '.bwm-technet .ld{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8fa0b3;font-size:12px;letter-spacing:.4em}';
  netHost.appendChild(nsty0);
  let net = null, netLoading = false;
  const factionOfPlanet = (planet) => {
    for (const [k, P] of Object.entries(PLANETS)) if (P.name === planet) { const f = REG.find(k); return f ? f.name : planet; }
    return planet;
  };
  function openTechNet() {
    if (net) { net.start(); return; }
    if (netLoading) return;
    netLoading = true;
    const ld = el(doc, 'div', 'ld', 'LOADING TECH NET…'); netHost.appendChild(ld);
    import('./technet.js').then((M) => M.loadTechNetDeps().then(({ THREE, addons }) => {
      ld.remove();
      net = M.mountTechNet(THREE, addons, netHost, createGameTechAdapter({
        save: { loadSave, buyTech, refundTech }, factionOfPlanet,
        onChange: () => { refreshProgress(); if (cbs.onTechChanged) cbs.onTechChanged(); },
        onClose: () => show('main'),
      }));
      if (current === 'techtree') net.start();
    })).catch((e) => { ld.textContent = 'TECH NET UNAVAILABLE — ' + ((e && e.message) || e); console.warn('[menu] tech net —', e); })
      .finally(() => { netLoading = false; });
  }

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
  // EFFECTS LAB (owner 2026-10-22): every battle effect, per faction, with live tuning [MM-story_mvk63439_o]
  {
    const row = el(doc, 'div', 'bwm-srow');
    row.appendChild(el(doc, 'label', null, 'EFFECTS LAB'));
    const go = el(doc, 'button', 'bwm-btn'); go.style.cssText = 'width:auto;padding:6px 14px;flex:0 0 auto';
    go.appendChild(el(doc, 'span', null, 'OPEN'));
    go.title = 'See and tune every battle effect for each faction';
    go.addEventListener('click', () => { try { window.location.href = 'fxlab.html'; } catch (e) { /* no window (tests) */ } });
    row.appendChild(el(doc, 'span', 'v', 'see and tune battle effects'));
    row.appendChild(go);
    setBox.appendChild(row);
  }
  setBox.appendChild(el(doc, 'div', 'note', 'Audio is shared with the in-game settings gear. More options land here as they ship.'));
  const nsty = el(doc, 'style'); nsty.textContent = '.bwm-set .note{font-size:11px;color:#8fa0b3;margin-top:6px}';
  setBox.appendChild(nsty);
  settings.appendChild(setBox);
  root.appendChild(settings);

  root.appendChild(el(doc, 'div', 'bwm-foot', 'BULWARK — TEST BUILD'));

  function show(screen) {
    // leaving the Tech Net: whatever it showed as available counts as seen (incl. upgrades opened by a purchase there)
    if (current === 'techtree' && screen !== 'techtree') { const sv = loadSave(), k = seenFor('techtree', sv, badgeCtx(sv)); markSeen(k[0], k[1]); }
    // the retired screens open the Survey on the target planet (post-battle "main menu" used to open 'maps')
    if (screen === 'maps' || screen === 'factions') { openSurvey(targetKey()); return; }
    main.style.display = screen === 'main' ? 'flex' : 'none';
    harv.style.display = screen === 'harvester' ? 'block' : 'none';
    netHost.style.display = screen === 'techtree' ? 'block' : 'none';
    if (screen !== 'techtree' && net) net.stop();
    settings.style.display = screen === 'settings' ? 'block' : 'none';
    survey.style.display = screen === 'survey' ? 'grid' : 'none';
    root.classList.toggle('space', screen === 'main' || screen === 'survey');
    current = screen;
    syncStage();
    if (screen === 'harvester') refreshHarvester();
    if (screen === 'techtree') openTechNet();
    { const sv = loadSave(), k = seenFor(screen, sv, badgeCtx(sv)); if (k) markSeen(k[0], k[1]); }   // opening a screen clears its dot
    refreshProgress();
    if (screen === 'main') {
      const s = loadSave();
      // the hero = the target planet, and the planet view is ALWAYS the default on open [MM-story_mvftq5q8_l]
      galaxy.dataset.mode = 'planet'; root.classList.remove('galaxy'); zoomBtn.firstChild.textContent = '◎ GALAXY';
      refreshHeroTarget();
      setGlobe(heroGlobe, targetKey());
      zoomBtn.style.display = stageFailed ? 'none' : '';
      // the player's landing craft
      const ck = (cbs.playerCraft && cbs.playerCraft()) || 'system', cd = craftFor(ck) || LANDING_CRAFT.lc_neutral;
      craftView.dataset.craft = ck;
      craftText.innerHTML = '';
      craftText.appendChild(el(doc, 'div', 'ck', 'YOUR LANDING CRAFT'));
      craftText.appendChild(el(doc, 'div', 'cn', cd.name));
      craftText.appendChild(el(doc, 'div', 'cw', cd.factionName + ' · ' + cd.weaponType));
    }
  }

  // the main screen's target-planet labels (primary button, NEXT PLANET line, accent colour)
  function refreshHeroTarget() {
    const s = loadSave(), f = REG.find(targetKey()) || REG.find('ground'), P = PLANETS[f.key];
    continueBtn.firstChild.textContent = 'PLAY';
    continueBtn.querySelector('.hint').textContent = (P ? P.name + ' · ' : '') + 'campaign ' + defaultCampaign(s, MAPDATA.maps.length);   // the planet stays in the hint
    heroNext.innerHTML = P ? 'NEXT PLANET · <b>' + P.name.toUpperCase() + '</b>' : '';
    hero.style.setProperty('--hue', (P && P.ui) || '#f2c869');
    if (cbs.onPlanetView && root.style.display !== 'none') cbs.onPlanetView(f.key);   // [MM-story_mvgzp51o_8]
  }

  // ── PROGRESSION + BADGES (Menu-Progression-Design §2–4)
  function badgeCtx(sv) {
    const tc = techCtxFromSave(sv, factionOfPlanet), lvl = sv.harvesterLevel || 1;
    const nx = (MAPDATA.harvesterUpgrades || []).find((u) => u.Level === lvl + 1);
    return { tc, readyTech: readyIds(tc), harvesterNext: nx ? { level: nx.Level, cost: nx.Gold_Cost } : null, bank: bankOf(sv) };
  }
  function progressValues(sv, bc) {
    return { xp: (sv.progress && sv.progress.xp) || 0, gold: bankOf(sv), stars: totalStars(sv), research: countOwned(bc.tc.owned) };
  }
  function refreshProgress() {
    const sv = loadSave(), bc = badgeCtx(sv), b = computeBadges(sv, bc);
    for (const [k, d] of Object.entries(DOTS)) d.classList.toggle('on', !!b[k]);
    if (!playingRewards) widget.render({ ...progressValues(sv, bc), techDot: b.techtree });
    else widget.render({ techDot: b.techtree });
  }
  let playingRewards = false;
  /** The last battle's rewards fly into the widget — once, when the menu is on screen. */
  function playPendingRewards() {
    if (playingRewards || root.style.display === 'none') return;
    const r = takePendingRewards();
    if (!r) return;
    playingRewards = true;
    const sv = loadSave(), bc = badgeCtx(sv);
    widget.playRewards(r, progressValues(sv, bc), root).then(() => { playingRewards = false; refreshProgress(); });
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
    open(screen) {
      root.style.display = 'flex';
      // 'survey' (and the retired 'maps' / 'factions') open the Survey on the target planet [MM-story_mvftq4h6_k]
      if (screen === 'survey' || screen === 'maps' || screen === 'factions') openSurvey(targetKey()); else show(screen || 'main');
      setTimeout(playPendingRewards, 450);   // after the screen has laid out (the tokens fly to real positions)
    },
    close() { if (net) net.stop(); root.style.display = 'none'; syncStage(); },
    /** re-read the save into the widget + dots (main.js calls this after a purchase elsewhere) */
    refreshProgress,
    isOpen() { return root.style.display !== 'none'; },
    /** test hook: open a faction's survey by key */
    survey(key) { root.style.display = 'flex'; openSurvey(key); },
  };
  show('main');
  setTimeout(playPendingRewards, 600);
  return api;
}
