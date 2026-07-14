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

// workbook Faction_ID (1-9) -> the game's faction names, roster order (owner can re-map)
export const FACTION_NAMES = ['Ground / Powder', 'Air', 'High Tech', 'Artillery', 'Water',
  'Arcane / Energy', 'Space Tech', 'Dark Energy', 'Greenies (Chem)'];
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
.bwm-btn:disabled { opacity:.38; cursor:default; }
.bwm-btn:disabled:hover { border-color:#2e3846; background:#1a1f28; }
/* FACTIONS screen */
.bwm-fgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:14px; }
.bwm-fcard { background:#1a1f28; border:1px solid #2e3846; padding:14px 16px; cursor:pointer;
  transition:border-color .12s, transform .12s; }
.bwm-fcard:hover { border-color:#d9a441; transform:translateY(-2px); }
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
  const hero = el(doc, 'div', 'bwm-hero');
  hero.appendChild(el(doc, 'div', 'bwm-kicker', 'CAMPAIGN — 9 MAPS'));
  const title = el(doc, 'div', 'bwm-title'); title.innerHTML = 'HOLD THE<br><span>BULWARK</span>';
  hero.appendChild(title);
  hero.appendChild(el(doc, 'div', 'bwm-sub',
    'Harvest the fields. Raise the walls. Eight waves per map, each map bigger than the last — your gold and your defenses march with you.'));
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
  const continueBtn = mkBtn('CONTINUE', '', 'primary', () => {
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
      const name = FACTION_NAMES[fid - 1] || row.Faction_Name;
      const rec = (s.factionRecords || {})[name] || {};
      const tech = MAPDATA.techTree.find((t) => t.Faction === row.Faction_Name) || {};
      const tier = (s.tech || {})[name] || 0;
      const loyalty = (s.loyalty || {})[name] || 0;
      const card = el(doc, 'div', 'bwm-fcard');
      card.appendChild(el(doc, 'div', 'fnm', name.toUpperCase()));
      card.appendChild(el(doc, 'div', 'fprof', (row.Profile || '') +
        '  Premium: ' + row.Premium_Resource + '. Rival: ' + (FACTION_NAMES[(row.Rival_Faction || 0) - 1] || '—') + '.'));
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
      card.addEventListener('click', () => {
        if (cbs.onSelectFaction) cbs.onSelectFaction(name);
        chosenFaction = name;
        show('maps');
      });
      fgrid.appendChild(card);
    }
  }

  let chosenFaction = null;

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
    for (const n of FACTION_NAMES) { const o = el(doc, 'option'); o.value = n; o.textContent = n; sel.appendChild(o); }
    sel.value = (loadSave().enemyFaction) || 'Ground / Powder';
    sel.addEventListener('change', () => {
      const f = sel.value || null;
      try { const sv = loadSave(); sv.enemyFaction = f || null; localStorage.setItem('bulwark:save', JSON.stringify(sv)); } catch (e) { /* */ }
      if (cbs.onSelectFaction) cbs.onSelectFaction(f);
    });
    const rst = el(doc, 'button', 'bwm-btn'); rst.style.cssText = 'width:auto;padding:6px 12px;flex:0 0 auto';
    rst.appendChild(el(doc, 'span', null, 'RESET'));
    rst.title = 'Back to Ground / Powder';
    rst.addEventListener('click', () => { sel.value = 'Ground / Powder'; sel.dispatchEvent(new Event('change')); });
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
    }
  }

  mountEl.appendChild(root);

  const api = {
    root,
    open(screen) { show(screen || 'main'); root.style.display = 'flex'; },
    close() { root.style.display = 'none'; },
    isOpen() { return root.style.display !== 'none'; },
  };
  show('main');
  return api;
}
