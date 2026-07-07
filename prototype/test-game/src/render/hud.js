// src/render/hud.js
// Functional DOM HUD for Bulwark vertical slice.
// Reads sim state, dispatches commands via callbacks provided by main/input.

import { STRUCTURES, UNITS, ASSUMPTIONS } from '../data/tables.js';

export class HUD {
  constructor(opts = {}) {
    // opts: { onStartWave, onSelectBuild, onUpgrade, onRepair, onSell, onDeploy, onReplay, onHarness, onCancelBuild }
    this.opts = opts;
    this.lastMoney = null;
    this.lastSelectedId = null;
    this.lastSelectedRev = null;
    this.buildButtons = new Map();
    this.deployButtons = new Map();
    this.selectedBuildKey = null;
    this.bannerShown = false;
    this._buildDom();
  }

  _el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  _buildDom() {
    let root = document.getElementById('hud');
    if (!root) {
      root = this._el('div');
      root.id = 'hud';
      document.body.appendChild(root);
    }
    root.innerHTML = '';
    this.root = root;

    const style = document.createElement('style');
    style.textContent = `
      #hud { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;
             font-family: monospace; font-size: 12px; color: #e8e8e8; z-index: 10; }
      #hud .panel { position: absolute; background: rgba(10,14,20,0.85); border: 1px solid #3a4a5a;
             border-radius: 4px; padding: 6px 8px; pointer-events: auto; }
      #hud-top { top: 6px; left: 6px; display: flex; gap: 14px; align-items: center; }
      #hud-top .stat { min-width: 90px; }
      #hud-top .label { color: #8fa3b8; font-size: 10px; }
      #hud-top .value { font-size: 15px; font-weight: bold; }
      #hud-money-delta { display: inline-block; margin-left: 6px; font-size: 11px; transition: opacity 0.9s; opacity: 0; }
      #hud-money-delta.pos { color: #7fe07f; } #hud-money-delta.neg { color: #ff8f8f; }
      #hud button { pointer-events: auto; background: #1e2c3a; color: #dfe8f0; border: 1px solid #4a6078;
             border-radius: 3px; padding: 4px 8px; font-family: monospace; font-size: 12px; cursor: pointer; }
      #hud button:hover:not(:disabled) { background: #2c4256; }
      #hud button:disabled { opacity: 0.4; cursor: default; }
      #hud button.dim { opacity: 0.45; }
      #hud button.selected { background: #3d5a76; border-color: #86b6e0; }
      #hud-build { top: 66px; left: 6px; width: 190px; }
      #hud-build .item, #hud-deploy .item { display: flex; justify-content: space-between; width: 100%; margin: 2px 0; }
      #hud-deploy { top: 66px; right: 6px; width: 210px; }
      #hud-select { bottom: 6px; left: 6px; width: 230px; }
      #hud-select .row { margin: 3px 0; }
      #hud-select .actions { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
      #hud-controls { bottom: 6px; right: 6px; max-width: 260px; color: #9db2c6; font-size: 11px; line-height: 1.45; }
      #hud-tools { top: 6px; right: 6px; display: flex; gap: 6px; }
      #hud-banner { top: 34%; left: 50%; transform: translate(-50%, -50%); font-size: 34px; font-weight: bold;
             padding: 18px 40px; text-align: center; display: none; }
      #hud-banner.win { color: #8ff0a0; border-color: #4fa060; }
      #hud-banner.lose { color: #ff9090; border-color: #a05050; }
      #hud .sect-title { color: #a9c2d8; font-weight: bold; margin-bottom: 4px; font-size: 11px;
             letter-spacing: 1px; text-transform: uppercase; }
      #hud .hpbar { height: 6px; background: #402020; border-radius: 2px; overflow: hidden; margin-top: 2px; width: 110px; }
      #hud .hpbar > div { height: 100%; background: #5fd06f; }
    `;
    root.appendChild(style);

    // Top bar: base HP, money, wave, start wave.
    const top = this._el('div', 'panel');
    top.id = 'hud-top';

    const hpBox = this._el('div', 'stat');
    hpBox.appendChild(this._el('div', 'label', 'BASE HP'));
    this.hpValue = this._el('div', 'value', '-');
    hpBox.appendChild(this.hpValue);
    this.hpBar = this._el('div', 'hpbar');
    this.hpBarFill = this._el('div');
    this.hpBar.appendChild(this.hpBarFill);
    hpBox.appendChild(this.hpBar);
    top.appendChild(hpBox);

    const moneyBox = this._el('div', 'stat');
    moneyBox.appendChild(this._el('div', 'label', 'GOLD'));
    const mv = this._el('div', 'value');
    this.moneyValue = this._el('span', null, '-');
    this.moneyDelta = this._el('span');
    this.moneyDelta.id = 'hud-money-delta';
    mv.appendChild(this.moneyValue);
    mv.appendChild(this.moneyDelta);
    moneyBox.appendChild(mv);
    top.appendChild(moneyBox);

    const waveBox = this._el('div', 'stat');
    waveBox.appendChild(this._el('div', 'label', 'WAVE'));
    this.waveValue = this._el('div', 'value', '-');
    waveBox.appendChild(this.waveValue);
    top.appendChild(waveBox);

    this.startWaveBtn = this._el('button', null, 'Start Wave');
    this.startWaveBtn.addEventListener('click', () => {
      if (this.opts.onStartWave) this.opts.onStartWave();
    });
    top.appendChild(this.startWaveBtn);
    root.appendChild(top);

    // Tool buttons: replay + harness.
    const tools = this._el('div', 'panel');
    tools.id = 'hud-tools';
    const replayBtn = this._el('button', null, 'Replay');
    replayBtn.title = 'Re-run battle log through fresh headless core, verify hash-identical determinism';
    replayBtn.addEventListener('click', () => {
      if (this.opts.onReplay) this.opts.onReplay();
    });
    tools.appendChild(replayBtn);
    const harnessBtn = this._el('button', null, 'Harness');
    harnessBtn.title = 'Run 100 automated headless battles; derive unit price = avg DPS';
    harnessBtn.addEventListener('click', () => {
      if (this.opts.onHarness) this.opts.onHarness();
    });
    tools.appendChild(harnessBtn);
    root.appendChild(tools);

    // Build palette.
    const build = this._el('div', 'panel');
    build.id = 'hud-build';
    build.appendChild(this._el('div', 'sect-title', 'Build'));
    const structList = Array.isArray(STRUCTURES) ? STRUCTURES : Object.values(STRUCTURES);
    for (const s of structList) {
      const key = s.id || s.key || s.name;
      const btn = this._el('button', 'item');
      const nameSpan = this._el('span', null, s.name || key);
      const priceSpan = this._el('span', null, String(Math.round(s.cost !== undefined ? s.cost : (s.costT1 !== undefined ? s.costT1 : 0))));
      btn.appendChild(nameSpan);
      btn.appendChild(priceSpan);
      btn.dataset.cost = String(s.cost !== undefined ? s.cost : (s.costT1 !== undefined ? s.costT1 : 0));
      btn.addEventListener('click', () => {
        if (this.selectedBuildKey === key) {
          this.selectedBuildKey = null;
          if (this.opts.onCancelBuild) this.opts.onCancelBuild();
          else if (this.opts.onSelectBuild) this.opts.onSelectBuild(null);
        } else {
          this.selectedBuildKey = key;
          if (this.opts.onSelectBuild) this.opts.onSelectBuild(key);
        }
        this._refreshBuildSelection();
      });
      build.appendChild(btn);
      this.buildButtons.set(key, btn);
    }
    root.appendChild(build);

    // Deploy list (player troop deployments).
    const deploy = this._el('div', 'panel');
    deploy.id = 'hud-deploy';
    deploy.appendChild(this._el('div', 'sect-title', 'Deploy Troops'));
    const unitList = Array.isArray(UNITS) ? UNITS : Object.values(UNITS);
    const deployable = unitList.filter(u => u.deployable !== false).slice(0, 8);
    for (const u of deployable) {
      const key = u.id || u.key || u.name;
      const btn = this._el('button', 'item');
      btn.appendChild(this._el('span', null, u.name || key));
      const cost = u.cost !== undefined ? u.cost : (u.costT1 !== undefined ? u.costT1 : 0);
      btn.appendChild(this._el('span', null, String(Math.round(cost))));
      btn.dataset.cost = String(cost);
      btn.addEventListener('click', () => {
        if (this.opts.onDeploy) this.opts.onDeploy(key);
      });
      deploy.appendChild(btn);
      this.deployButtons.set(key, btn);
    }
    root.appendChild(deploy);

    // Selected structure panel.
    const sel = this._el('div', 'panel');
    sel.id = 'hud-select';
    sel.style.display = 'none';
    sel.appendChild(this._el('div', 'sect-title', 'Structure'));
    this.selName = this._el('div', 'row', '');
    sel.appendChild(this.selName);
    this.selTier = this._el('div', 'row', '');
    sel.appendChild(this.selTier);
    this.selHp = this._el('div', 'row', '');
    sel.appendChild(this.selHp);
    this.selState = this._el('div', 'row', '');
    sel.appendChild(this.selState);
    const actions = this._el('div', 'actions');
    this.upgradeBtn = this._el('button', null, 'Upgrade');
    this.upgradeBtn.addEventListener('click', () => {
      if (this.opts.onUpgrade && this.lastSelectedId != null) this.opts.onUpgrade(this.lastSelectedId);
    });
    actions.appendChild(this.upgradeBtn);
    this.repairBtn = this._el('button', null, 'Repair');
    this.repairBtn.addEventListener('click', () => {
      if (this.opts.onRepair && this.lastSelectedId != null) this.opts.onRepair(this.lastSelectedId);
    });
    actions.appendChild(this.repairBtn);
    this.sellBtn = this._el('button', null, 'Sell');
    this.sellBtn.addEventListener('click', () => {
      if (this.opts.onSell && this.lastSelectedId != null) this.opts.onSell(this.lastSelectedId);
    });
    actions.appendChild(this.sellBtn);
    sel.appendChild(actions);
    this.selectPanel = sel;
    root.appendChild(sel);

    // Controls help.
    const help = this._el('div', 'panel');
    help.id = 'hud-controls';
    help.innerHTML =
      '<div class="sect-title">Controls</div>' +
      'Click build item &rarr; click slot to place<br>' +
      'Right-click / Esc: cancel placement<br>' +
      'Click structure: select (U upgrade, R repair, X sell)<br>' +
      'Click deploy unit &rarr; click destination to march<br>' +
      'Space / button: start wave';
    root.appendChild(help);

    // Win/lose banner.
    this.banner = this._el('div', 'panel');
    this.banner.id = 'hud-banner';
    root.appendChild(this.banner);
  }

  _refreshBuildSelection() {
    for (const [key, btn] of this.buildButtons) {
      if (key === this.selectedBuildKey) btn.classList.add('selected');
      else btn.classList.remove('selected');
    }
  }

  setSelectedBuild(key) {
    this.selectedBuildKey = key;
    this._refreshBuildSelection();
  }

  _flashMoneyDelta(delta) {
    const el = this.moneyDelta;
    el.textContent = (delta > 0 ? '+' : '') + Math.round(delta);
    el.className = delta > 0 ? 'pos' : 'neg';
    el.id = 'hud-money-delta';
    el.style.transition = 'none';
    el.style.opacity = '1';
    // Force reflow then fade.
    void el.offsetWidth;
    el.style.transition = 'opacity 0.9s';
    el.style.opacity = '0';
  }

  showBanner(win) {
    this.banner.textContent = win ? 'VICTORY — ALL WAVES SURVIVED' : 'DEFEAT — BASE DESTROYED';
    this.banner.className = 'panel ' + (win ? 'win' : 'lose');
    this.banner.style.display = 'block';
    this.bannerShown = true;
  }

  showMessage(text) {
    this.banner.textContent = text;
    this.banner.className = 'panel';
    this.banner.style.display = 'block';
    const self = this;
    setTimeout(function () {
      if (!self.bannerShown) self.banner.style.display = 'none';
    }, 2500);
  }

  // Called each render frame with the sim state.
  update(state) {
    if (!state) return;

    // Base HP.
    const base = state.base || {};
    const hp = Math.max(0, Math.round(base.hp !== undefined ? base.hp : 0));
    const maxHp = Math.max(1, Math.round(base.maxHp !== undefined ? base.maxHp : hp || 1));
    this.hpValue.textContent = hp + ' / ' + maxHp;
    this.hpBarFill.style.width = Math.max(0, Math.min(100, (hp / maxHp) * 100)) + '%';
    this.hpBarFill.style.background = hp / maxHp > 0.5 ? '#5fd06f' : (hp / maxHp > 0.25 ? '#e0c05f' : '#e06f5f');

    // Money + delta.
    const money = Math.floor(state.economy ? state.economy.money : (state.money || 0));
    this.moneyValue.textContent = String(money);
    if (this.lastMoney !== null) {
      const delta = money - this.lastMoney;
      if (Math.abs(delta) >= 5) this._flashMoneyDelta(delta);
    }
    this.lastMoney = money;

    // Wave counter.
    const waves = state.waves || {};
    const cur = waves.currentWave !== undefined ? waves.currentWave : (waves.waveIndex !== undefined ? waves.waveIndex : 0);
    const total = waves.totalWaves !== undefined ? waves.totalWaves : (waves.count !== undefined ? waves.count : '?');
    this.waveValue.textContent = Math.min(cur, total) + ' / ' + total;
    const waveActive = !!(waves.active || waves.inProgress);
    const gameOver = state.status === 'won' || state.status === 'lost' || state.won || state.lost;
    this.startWaveBtn.disabled = waveActive || !!gameOver || cur >= (typeof total === 'number' ? total : Infinity);
    this.startWaveBtn.textContent = waveActive ? 'Wave In Progress' : 'Start Wave';

    // Affordability dimming on palettes.
    for (const btn of this.buildButtons.values()) {
      const cost = parseFloat(btn.dataset.cost) || 0;
      btn.classList.toggle('dim', money < cost);
    }
    for (const btn of this.deployButtons.values()) {
      const cost = parseFloat(btn.dataset.cost) || 0;
      btn.classList.toggle('dim', money < cost);
    }

    // Selected structure panel.
    const selId = state.selectedStructureId !== undefined ? state.selectedStructureId : null;
    let sel = null;
    if (selId != null && state.structures) {
      const list = Array.isArray(state.structures) ? state.structures : Object.values(state.structures);
      for (const s of list) {
        if (s && s.id === selId) { sel = s; break; }
      }
    }
    if (sel && sel.state !== 'Destroyed') {
      this.lastSelectedId = sel.id;
      this.selectPanel.style.display = 'block';
      this.selName.textContent = (sel.name || sel.kind || 'Structure');
      const tier = sel.tier || 1;
      this.selTier.textContent = 'Tier: ' + tier + (tier < 3 ? '' : ' (max)');
      const shp = Math.max(0, Math.round(sel.hp || 0));
      const smax = Math.max(1, Math.round(sel.maxHp || shp || 1));
      this.selHp.textContent = 'HP: ' + shp + ' / ' + smax;
      this.selState.textContent = 'State: ' + (sel.state || 'Complete');

      // Upgrade price: from structure data or upgrade cost curve.
      let upCost = sel.upgradeCost;
      if (upCost === undefined) {
        const baseCost = sel.baseCost !== undefined ? sel.baseCost : (sel.cost || 0);
        const t2x = ASSUMPTIONS.Upgrade_Cost_x_T2 !== undefined ? ASSUMPTIONS.Upgrade_Cost_x_T2 : 2.5;
        const t3x = ASSUMPTIONS.Upgrade_Cost_x_T3 !== undefined ? ASSUMPTIONS.Upgrade_Cost_x_T3 : 5;
        if (tier === 1) upCost = Math.round(baseCost * (t2x - 1));
        else if (tier === 2) upCost = Math.round(baseCost * (t3x - t2x));
        else upCost = 0;
      }
      const busy = sel.state === 'Building' || sel.state === 'Upgrading' || sel.state === 'Selling';
      if (tier >= 3) {
        this.upgradeBtn.textContent = 'Max Tier';
        this.upgradeBtn.disabled = true;
      } else {
        this.upgradeBtn.textContent = 'Upgrade (' + Math.round(upCost) + ')';
        this.upgradeBtn.disabled = busy || money < upCost;
      }
      const damaged = shp < smax;
      this.repairBtn.textContent = sel.repairing ? 'Repairing...' : 'Repair (free)';
      this.repairBtn.disabled = busy || !damaged || !!sel.repairing;

      let refund = sel.sellRefund;
      if (refund === undefined) {
        const value = sel.value !== undefined ? sel.value : (sel.baseCost !== undefined ? sel.baseCost : (sel.cost || 0));
        refund = Math.round(value * 0.5 * (smax > 0 ? shp / smax : 1));
      }
      this.sellBtn.textContent = 'Sell (+' + Math.round(refund) + ')';
      this.sellBtn.disabled = sel.state === 'Selling';
    } else {
      this.lastSelectedId = null;
      this.selectPanel.style.display = 'none';
    }

    // Win/lose banner.
    if (!this.bannerShown) {
      if (state.status === 'won' || state.won) this.showBanner(true);
      else if (state.status === 'lost' || state.lost) this.showBanner(false);
    }
  }

  reset() {
    this.bannerShown = false;
    this.banner.style.display = 'none';
    this.lastMoney = null;
    this.lastSelectedId = null;
    this.selectedBuildKey = null;
    this._refreshBuildSelection();
  }
}

export function createHUD(opts) {
  return new HUD(opts);
}