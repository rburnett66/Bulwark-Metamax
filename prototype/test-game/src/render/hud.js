import { STRUCTURES, ASSUMPTIONS, getStructureDef } from '../data/tables.js';
import { getSellValue } from '../sim/economy.js';

const STYLE_ID = 'bw-hud-style';

const CSS = `
.bw-hud { position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none;
  font-family: 'Courier New', monospace; color:#e8e8e8; user-select:none; z-index:10; }
.bw-hud * { box-sizing:border-box; }
.bw-panel { background:rgba(10,14,20,0.85); border:1px solid #3a4a5a; border-radius:4px; padding:6px 8px; pointer-events:auto; }
.bw-topbar { position:absolute; top:6px; left:6px; right:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.bw-hpwrap { display:flex; align-items:center; gap:6px; }
.bw-hpbar { width:160px; height:14px; background:#2a1616; border:1px solid #713; position:relative; }
.bw-hpfill { height:100%; background:#d33; width:100%; transition:width 0.15s linear; }
.bw-hptext { font-size:11px; min-width:86px; }
.bw-money { position:relative; font-size:15px; color:#ffd76a; font-weight:bold; min-width:110px; }
.bw-delta { position:absolute; left:100%; top:0; margin-left:6px; font-size:12px; font-weight:bold;
  animation: bw-delta-rise 0.9s ease-out forwards; pointer-events:none; white-space:nowrap; }
@keyframes bw-delta-rise { from { opacity:1; transform:translateY(0);} to { opacity:0; transform:translateY(-16px);} }
.bw-wave { font-size:13px; }
.bw-btn { pointer-events:auto; background:#22303e; color:#e8e8e8; border:1px solid #4a6076; border-radius:3px;
  padding:4px 8px; font-family:inherit; font-size:12px; cursor:pointer; }
.bw-btn:hover:not(:disabled) { background:#2f4356; }
.bw-btn:disabled { opacity:0.4; cursor:default; }
.bw-btn.bw-selected { background:#3d6a3d; border-color:#7ac07a; }
.bw-seed { font-size:11px; color:#8fa4b8; }
.bw-palette { position:absolute; left:6px; top:56px; width:168px; display:flex; flex-direction:column; gap:4px; }
.bw-palette .bw-title { font-size:11px; color:#9ab; margin-bottom:2px; }
.bw-buildbtn { display:flex; justify-content:space-between; width:100%; text-align:left; }
.bw-buildbtn .bw-cost { color:#ffd76a; }
.bw-buildbtn.bw-poor { opacity:0.45; }
.bw-selpanel { position:absolute; right:6px; top:56px; width:200px; font-size:12px; display:none; flex-direction:column; gap:4px; }
.bw-selpanel .bw-sname { font-size:13px; font-weight:bold; color:#bfe0ff; }
.bw-selpanel .bw-shpbar { width:100%; height:10px; background:#222; border:1px solid #555; }
.bw-selpanel .bw-shpfill { height:100%; background:#4c4; }
.bw-selrow { display:flex; gap:4px; }
.bw-selrow .bw-btn { flex:1; font-size:11px; padding:3px 4px; }
.bw-bottombar { position:absolute; left:6px; bottom:6px; right:6px; display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; }
.bw-help { font-size:10px; color:#8fa4b8; line-height:1.4; }
.bw-debug { display:flex; gap:4px; align-items:center; flex-wrap:wrap; }
.bw-seedinput { width:84px; background:#141a22; color:#e8e8e8; border:1px solid #4a6076; border-radius:3px;
  font-family:inherit; font-size:12px; padding:3px 4px; pointer-events:auto; }
.bw-toast { position:absolute; left:50%; top:70px; transform:translateX(-50%); background:rgba(60,20,20,0.92);
  border:1px solid #c66; border-radius:4px; padding:6px 14px; font-size:13px; color:#ffd7d7;
  display:none; pointer-events:none; }
.bw-result { position:absolute; left:0; top:0; right:0; bottom:0; display:none; align-items:center; justify-content:center;
  background:rgba(0,0,0,0.55); pointer-events:auto; flex-direction:column; gap:14px; }
.bw-result.bw-show { display:flex; }
.bw-rbanner { font-size:36px; font-weight:bold; letter-spacing:2px; text-shadow:0 2px 8px #000; }
.bw-rbanner.bw-win { color:#9f9; }
.bw-rbanner.bw-lose { color:#f99; }
.bw-logtoggle { pointer-events:auto; }
.bw-logwin { position:absolute; right:6px; bottom:6px; width:340px; max-width:60%; height:260px; max-height:60%;
  display:none; flex-direction:column; gap:6px; pointer-events:auto; z-index:20; }
.bw-logwin.bw-show { display:flex; }
.bw-logwin .bw-loghead { display:flex; justify-content:space-between; align-items:center; }
.bw-logwin .bw-logtitle { font-size:13px; font-weight:bold; color:#bfe0ff; }
.bw-logwin .bw-logbtns { display:flex; gap:4px; }
.bw-logbody { flex:1; overflow-y:auto; background:#0a0e14; border:1px solid #2a3a4a; border-radius:3px;
  padding:4px 6px; font-size:11px; line-height:1.45; white-space:pre-wrap; word-break:break-word;
  user-select:text; -webkit-user-select:text; cursor:text; }
.bw-logbody .bw-logline { color:#c8d4e0; }
`;

function injectStyle(doc) {
  try {
    if (doc.getElementById && doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    const host = doc.head || doc.body || doc.documentElement;
    if (host) host.appendChild(style);
  } catch (e) { /* styling is non-critical */ }
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function formatLogEntry(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') {
    const t = (entry.tick != null) ? `[t${entry.tick}] ` : '';
    const kind = entry.kind || entry.type || '';
    let rest = '';
    if (entry.text || entry.message) {
      rest = entry.text || entry.message;
    } else {
      try {
        const copy = Object.assign({}, entry);
        delete copy.tick; delete copy.kind; delete copy.type;
        const keys = Object.keys(copy);
        if (keys.length) rest = keys.map((k) => `${k}=${copy[k]}`).join(' ');
      } catch (e) { rest = ''; }
    }
    return `${t}${kind}${kind && rest ? ' ' : ''}${rest}`.trim();
  }
  return String(entry);
}

export function createHud(mountEl, callbacks) {
  const cbs = callbacks || {};
  const doc = mountEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('createHud: no document available');

  // NOTE: do NOT use getComputedStyle here (may not exist in headless boot).
  // Just ensure the mount element is a positioning context for the overlay.
  try {
    if (!mountEl.style.position || mountEl.style.position === 'static') {
      mountEl.style.position = 'relative';
    }
  } catch (e) { /* non-critical */ }

  injectStyle(doc);

  const root = el(doc, 'div', 'bw-hud');

  // ---- top bar --------------------------------------------------------
  const topbar = el(doc, 'div', 'bw-topbar bw-panel');
  const hpwrap = el(doc, 'div', 'bw-hpwrap');
  const hpbar = el(doc, 'div', 'bw-hpbar');
  const hpfill = el(doc, 'div', 'bw-hpfill');
  hpbar.appendChild(hpfill);
  const hptext = el(doc, 'span', 'bw-hptext', 'Base: --/--');
  hpwrap.appendChild(hpbar);
  hpwrap.appendChild(hptext);

  const moneyEl = el(doc, 'span', 'bw-money', '0g');
  const waveEl = el(doc, 'span', 'bw-wave', 'Wave 0/0');
  const startWaveBtn = el(doc, 'button', 'bw-btn', 'Start Wave');
  startWaveBtn.addEventListener('click', () => { if (cbs.onStartWave) cbs.onStartWave(); });
  const logToggleBtn = el(doc, 'button', 'bw-btn bw-logtoggle', 'Log');
  const seedEl = el(doc, 'span', 'bw-seed', 'seed: -');

  topbar.appendChild(hpwrap);
  topbar.appendChild(moneyEl);
  topbar.appendChild(waveEl);
  topbar.appendChild(startWaveBtn);
  topbar.appendChild(logToggleBtn);
  topbar.appendChild(seedEl);
  root.appendChild(topbar);

  // ---- build palette --------------------------------------------------
  const palette = el(doc, 'div', 'bw-palette bw-panel');
  palette.appendChild(el(doc, 'div', 'bw-title', 'BUILD'));
  const paletteBtns = {};
  for (const structId of Object.keys(STRUCTURES)) {
    const def = STRUCTURES[structId];
    const btn = el(doc, 'button', 'bw-btn bw-buildbtn');
    const nameSpan = el(doc, 'span', null, def.name || structId);
    const costVal = (def.cost && def.cost[0] != null) ? def.cost[0] : (def.cost != null ? def.cost : 0);
    const costSpan = el(doc, 'span', 'bw-cost', String(costVal) + 'g');
    btn.appendChild(nameSpan);
    btn.appendChild(costSpan);
    btn.addEventListener('click', () => { if (cbs.onSelectBuild) cbs.onSelectBuild(structId); });
    palette.appendChild(btn);
    paletteBtns[structId] = { btn, cost: costVal };
  }
  root.appendChild(palette);

  // ---- selection panel ------------------------------------------------
  const selpanel = el(doc, 'div', 'bw-selpanel bw-panel');
  const selName = el(doc, 'div', 'bw-sname', '');
  const selInfo = el(doc, 'div', 'bw-sinfo', '');
  const selHpbar = el(doc, 'div', 'bw-shpbar');
  const selHpfill = el(doc, 'div', 'bw-shpfill');
  selHpbar.appendChild(selHpfill);
  const selHptext = el(doc, 'div', 'bw-shptext', '');
  const selRow = el(doc, 'div', 'bw-selrow');
  const upgradeBtn = el(doc, 'button', 'bw-btn', 'Upgrade');
  const sellBtn = el(doc, 'button', 'bw-btn', 'Sell');
  upgradeBtn.addEventListener('click', () => { if (cbs.onUpgrade) cbs.onUpgrade(); });
  sellBtn.addEventListener('click', () => { if (cbs.onSell) cbs.onSell(); });
  selRow.appendChild(upgradeBtn);
  selRow.appendChild(sellBtn);
  selpanel.appendChild(selName);
  selpanel.appendChild(selInfo);
  selpanel.appendChild(selHpbar);
  selpanel.appendChild(selHptext);
  selpanel.appendChild(selRow);
  root.appendChild(selpanel);

  // ---- bottom bar / help ----------------------------------------------
  const bottombar = el(doc, 'div', 'bw-bottombar');
  const help = el(doc, 'div', 'bw-help bw-panel',
    'Click structure or enemy to select. Click build button then a tile to place. ESC to cancel.');
  const debug = el(doc, 'div', 'bw-debug bw-panel');
  const seedInput = el(doc, 'input', 'bw-seedinput');
  seedInput.setAttribute('type', 'text');
  seedInput.setAttribute('placeholder', 'seed');
  const restartBtn = el(doc, 'button', 'bw-btn', 'Restart');
  restartBtn.addEventListener('click', () => {
    if (cbs.onRestart) cbs.onRestart(seedInput.value || undefined);
  });
  debug.appendChild(seedInput);
  debug.appendChild(restartBtn);
  bottombar.appendChild(help);
  bottombar.appendChild(debug);
  root.appendChild(bottombar);

  // ---- toast ----------------------------------------------------------
  const toastEl = el(doc, 'div', 'bw-toast');
  root.appendChild(toastEl);

  // ---- result overlay -------------------------------------------------
  const resultEl = el(doc, 'div', 'bw-result');
  const rbanner = el(doc, 'div', 'bw-rbanner', '');
  const rRestartBtn = el(doc, 'button', 'bw-btn', 'Play Again');
  rRestartBtn.addEventListener('click', () => { if (cbs.onRestart) cbs.onRestart(); });
  resultEl.appendChild(rbanner);
  resultEl.appendChild(rRestartBtn);
  root.appendChild(resultEl);

  // ---- log window -----------------------------------------------------
  const logwin = el(doc, 'div', 'bw-logwin bw-panel');
  const loghead = el(doc, 'div', 'bw-loghead');
  const logtitle = el(doc, 'div', 'bw-logtitle', 'Battle Log');
  const logbtns = el(doc, 'div', 'bw-logbtns');
  const logCloseBtn = el(doc, 'button', 'bw-btn', 'X');
  logbtns.appendChild(logCloseBtn);
  loghead.appendChild(logtitle);
  loghead.appendChild(logbtns);
  const logbody = el(doc, 'div', 'bw-logbody');
  logwin.appendChild(loghead);
  logwin.appendChild(logbody);
  root.appendChild(logwin);

  let logVisible = false;
  function setLogVisible(v) {
    logVisible = v;
    if (v) logwin.classList.add('bw-show');
    else logwin.classList.remove('bw-show');
  }
  logToggleBtn.addEventListener('click', () => setLogVisible(!logVisible));
  logCloseBtn.addEventListener('click', () => setLogVisible(false));

  mountEl.appendChild(root);

  let toastTimer = null;
  let lastMoney = null;

  const hud = {
    root,
    els: {
      hpfill, hptext, moneyEl, waveEl, startWaveBtn, seedEl,
      palette, paletteBtns, selpanel, selName, selInfo, selHpbar, selHpfill, selHptext,
      upgradeBtn, sellBtn, toastEl, resultEl, rbanner, seedInput,
      logwin, logbody,
    },
    callbacks: cbs,
    _lastMoney: () => lastMoney,
    _setLastMoney: (v) => { lastMoney = v; },
    _toastTimer: () => toastTimer,
    _setToastTimer: (t) => { toastTimer = t; },
    setLogVisible,
    destroy() {
      try { if (root.parentNode) root.parentNode.removeChild(root); } catch (e) { /* noop */ }
    },
  };

  return hud;
}

function findEnemyRange(world, unit) {
  if (!unit) return null;
  // Try common range fields directly on the unit.
  const direct = unit.range != null ? unit.range
    : (unit.attackRange != null ? unit.attackRange
      : (unit.stats && unit.stats.range != null ? unit.stats.range : null));
  if (direct != null) return direct;
  return null;
}

export function updateHud(hud, world, uiState) {
  if (!hud || !world) return;
  const els = hud.els;
  const ui = uiState || {};

  // ---- base HP --------------------------------------------------------
  try {
    const base = world.base || (world.state && world.state.base);
    if (base) {
      const hp = base.hp != null ? base.hp : 0;
      const maxHp = base.maxHp != null ? base.maxHp : (base.hpMax != null ? base.hpMax : hp);
      const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      els.hpfill.style.width = `${(frac * 100).toFixed(1)}%`;
      els.hptext.textContent = `Base: ${Math.ceil(hp)}/${Math.ceil(maxHp)}`;
    }
  } catch (e) { /* non-critical */ }

  // ---- money ----------------------------------------------------------
  try {
    const money = world.money != null ? world.money
      : (world.economy && world.economy.money != null ? world.economy.money
        : (world.gold != null ? world.gold : 0));
    els.moneyEl.textContent = `${Math.floor(money)}g`;
    const prev = hud._lastMoney();
    if (prev != null && money !== prev) {
      const diff = money - prev;
      const doc = els.moneyEl.ownerDocument;
      const delta = el(doc, 'span', 'bw-delta', `${diff > 0 ? '+' : ''}${Math.round(diff)}`);
      delta.style.color = diff > 0 ? '#9f9' : '#f99';
      els.moneyEl.appendChild(delta);
      setTimeout(() => { try { if (delta.parentNode) delta.parentNode.removeChild(delta); } catch (e) {} }, 900);
    }
    hud._setLastMoney(money);

    // palette affordability
    for (const id of Object.keys(els.paletteBtns)) {
      const entry = els.paletteBtns[id];
      if (money < entry.cost) entry.btn.classList.add('bw-poor');
      else entry.btn.classList.remove('bw-poor');
      const sel = ui.buildStructureId || ui.selectedBuild || null;
      if (sel === id) entry.btn.classList.add('bw-selected');
      else entry.btn.classList.remove('bw-selected');
    }
  } catch (e) { /* non-critical */ }

  // ---- wave -----------------------------------------------------------
  try {
    const waves = world.waves || (world.state && world.state.waves) || {};
    const cur = waves.current != null ? waves.current
      : (waves.index != null ? waves.index : (world.waveIndex != null ? world.waveIndex : 0));
    const total = waves.total != null ? waves.total
      : (waves.count != null ? waves.count : (world.waveCount != null ? world.waveCount : 0));
    els.waveEl.textContent = `Wave ${cur}/${total}`;
    const active = waves.active != null ? waves.active : (world.waveActive || false);
    els.startWaveBtn.disabled = !!active;
  } catch (e) { /* non-critical */ }

  // ---- seed -----------------------------------------------------------
  try {
    const seed = world.seed != null ? world.seed
      : (world.rng && world.rng.seed != null ? world.rng.seed : null);
    if (seed != null) els.seedEl.textContent = `seed: ${seed}`;
  } catch (e) { /* non-critical */ }

  // ---- selection panel ------------------------------------------------
  try {
    const selStructId = ui.selectedStructureId != null ? ui.selectedStructureId : null;
    const selUnitId = ui.selectedUnitId != null ? ui.selectedUnitId
      : (ui.selectedEnemyId != null ? ui.selectedEnemyId : null);

    let shown = false;

    if (selStructId != null) {
      const struct = (typeof world.getStructure === 'function')
        ? world.getStructure(selStructId)
        : (world.structures && (world.structures[selStructId] ||
            (Array.isArray(world.structures) && world.structures.find((s) => s && s.id === selStructId))));
      if (struct) {
        const def = getStructureDef ? getStructureDef(struct.type || struct.structId || struct.defId) : null;
        els.selName.textContent = (def && def.name) || struct.type || struct.structId || 'Structure';
        const tier = struct.tier != null ? struct.tier : (struct.level != null ? struct.level : 0);
        els.selInfo.textContent = `Tier ${tier}`;
        const hp = struct.hp != null ? struct.hp : 0;
        const maxHp = struct.maxHp != null ? struct.maxHp : (struct.hpMax != null ? struct.hpMax : hp);
        const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        els.selHpfill.style.width = `${(frac * 100).toFixed(1)}%`;
        els.selHptext.textContent = `HP ${Math.ceil(hp)}/${Math.ceil(maxHp)}`;
        let sellVal = 0;
        try { sellVal = getSellValue ? getSellValue(struct) : 0; } catch (e) { sellVal = 0; }
        els.sellBtn.textContent = `Sell (${Math.round(sellVal)}g)`;
        els.sellBtn.style.display = '';
        els.upgradeBtn.style.display = '';
        els.selpanel.style.display = 'flex';
        shown = true;
      }
    }

    if (!shown && selUnitId != null) {
      let unit = null;
      if (typeof world.getUnit === 'function') unit = world.getUnit(selUnitId);
      if (!unit && world.units) {
        unit = Array.isArray(world.units)
          ? world.units.find((u) => u && u.id === selUnitId)
          : world.units[selUnitId];
      }
      if (!unit && world.attackers) {
        unit = Array.isArray(world.attackers)
          ? world.attackers.find((u) => u && u.id === selUnitId)
          : world.attackers[selUnitId];
      }
      if (unit) {
        els.selName.textContent = unit.name || unit.type || unit.unitId || 'Enemy';
        const rng = findEnemyRange(world, unit);
        const dmg = unit.damage != null ? unit.damage
          : (unit.dps != null ? unit.dps : (unit.stats && unit.stats.damage != null ? unit.stats.damage : null));
        const parts = [];
        if (rng != null) parts.push(`Range ${Number(rng).toFixed(1)}`);
        if (dmg != null) parts.push(`Dmg ${Number(dmg).toFixed(0)}`);
        els.selInfo.textContent = parts.join('  ');
        const hp = unit.hp != null ? unit.hp : 0;
        const maxHp = unit.maxHp != null ? unit.maxHp : (unit.hpMax != null ? unit.hpMax : hp);
        const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        els.selHpfill.style.width = `${(frac * 100).toFixed(1)}%`;
        els.selHptext.textContent = `HP ${Math.ceil(hp)}/${Math.ceil(maxHp)}`;
        // enemy units cannot be upgraded/sold by the player
        els.upgradeBtn.style.display = 'none';
        els.sellBtn.style.display = 'none';
        els.selpanel.style.display = 'flex';

        // expose range so the renderer can draw an attack-range indicator
        try {
          if (rng != null) {
            ui.selectedUnitRange = Number(rng);
            ui.showEnemyRange = {
              unitId: unit.id,
              range: Number(rng),
              x: unit.x != null ? unit.x : (unit.pos && unit.pos.x),
              y: unit.y != null ? unit.y : (unit.pos && unit.pos.y),
            };
          }
        } catch (e) { /* non-critical */ }
        shown = true;
      }
    }

    if (!shown) {
      els.selpanel.style.display = 'none';
      els.upgradeBtn.style.display = '';
      els.sellBtn.style.display = '';
      try {
        ui.selectedUnitRange = null;
        ui.showEnemyRange = null;
      } catch (e) { /* non-critical */ }
    }
  } catch (e) { /* non-critical */ }
}

export function flashMessage(hud, message, durationMs) {
  if (!hud || !hud.els || !hud.els.toastEl) return;
  const toastEl = hud.els.toastEl;
  toastEl.textContent = String(message == null ? '' : message);
  toastEl.style.display = 'block';
  const prev = hud._toastTimer && hud._toastTimer();
  if (prev) { try { clearTimeout(prev); } catch (e) {} }
  const dur = durationMs != null ? durationMs : 1800;
  const t = setTimeout(() => {
    try { toastEl.style.display = 'none'; } catch (e) {}
  }, dur);
  if (hud._setToastTimer) hud._setToastTimer(t);
}

export function showResult(hud, result) {
  if (!hud || !hud.els || !hud.els.resultEl) return;
  const { resultEl, rbanner } = hud.els;
  if (result == null) {
    resultEl.classList.remove('bw-show');
    return;
  }
  const win = result === 'win' || result === true ||
    (typeof result === 'object' && (result.win === true || result.outcome === 'win'));
  rbanner.textContent = win ? 'VICTORY' : 'DEFEAT';
  rbanner.className = `bw-rbanner ${win ? 'bw-win' : 'bw-lose'}`;
  resultEl.classList.add('bw-show');
}

export default createHud;