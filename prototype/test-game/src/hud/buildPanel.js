// src/hud/buildPanel.js
// Build panel: list of structures to place, with live pricing and dimmed
// unaffordable state. Reads sim state (economy), issues placement start commands
// through the input placement module.

import { CONSTANTS } from '../config/constants.js';

/**
 * BuildPanel renders a screen-space DOM list of buildable structures.
 * It reads structure definitions from config.data.tables.structures and the
 * player's current money from sim state to dim unaffordable entries.
 *
 * Interaction: clicking an affordable entry begins placement (via placement API),
 * which then feeds a `place` command into the sim once dropped.
 */
export class BuildPanel {
  /**
   * @param {object} opts
   * @param {object} opts.config    - global config with data.tables
   * @param {object} opts.sim       - sim instance (exposes .state)
   * @param {object} opts.placement - placement controller (beginPlacement/cancel)
   * @param {HTMLElement} [opts.mount] - DOM element to mount into
   */
  constructor(opts) {
    this.config = opts.config;
    this.sim = opts.sim;
    this.placement = opts.placement || null;
    this.mount = opts.mount || document.body;

    this._entries = []; // { id, def, row, priceEl, def }
    this._selectedId = null;

    this._buildStructureList();
    this._buildDom();
    this._renderRows();
  }

  // ---- data ----

  _buildStructureList() {
    const tables =
      (this.config && this.config.data && this.config.data.tables) || {};
    const structures = tables.structures || {};

    // structures may be an object keyed by id, or an array.
    let defs = [];
    if (Array.isArray(structures)) {
      defs = structures.slice();
    } else {
      defs = Object.keys(structures).map((k) => {
        const d = structures[k];
        return Object.assign({ id: d.id || k }, d);
      });
    }

    // Only buildable placement pieces: towers + wall/moat.
    this._defs = defs.filter((d) => {
      const cls = (d.class || d.category || d.kind || '').toLowerCase();
      // include everything that has a cost and is placeable
      if (d.buildable === false) return false;
      return true;
    });
  }

  _defCostT1(def) {
    // support several possible cost field shapes
    if (typeof def.costT1 === 'number') return def.costT1;
    if (typeof def.cost === 'number') return def.cost;
    if (def.cost && typeof def.cost.t1 === 'number') return def.cost.t1;
    if (Array.isArray(def.cost)) return def.cost[0];
    return 0;
  }

  _defBuildTime(def) {
    if (typeof def.buildTime === 'number') return def.buildTime;
    if (typeof def.buildTimeT1 === 'number') return def.buildTimeT1;
    return CONSTANTS.DEFAULT_BUILD_TIME || 3;
  }

  _defLabel(def) {
    return def.name || def.label || def.id || 'Structure';
  }

  _defDomainText(def) {
    const d = (def.weaponDomains || def.domains || def.canTarget || []).slice
      ? (def.weaponDomains || def.domains || def.canTarget)
      : [];
    if (def.terrain || def.footprint) {
      const k = (def.kind || def.id || '').toLowerCase();
      if (k.indexOf('moat') >= 0) return 'moat';
      if (k.indexOf('wall') >= 0) return 'wall';
      return 'terrain';
    }
    if (Array.isArray(d) && d.length) return d.join('/');
    if (def.canTargetAir) return 'anti-air';
    return 'anti-ground';
  }

  // ---- DOM ----

  _buildDom() {
    const root = document.createElement('div');
    root.className = 'bulwark-build-panel';
    root.style.cssText = [
      'position:absolute',
      'left:8px',
      'bottom:8px',
      'width:190px',
      'font:12px/1.3 monospace',
      'color:#e8e8e8',
      'background:rgba(15,18,24,0.82)',
      'border:1px solid #3a4658',
      'border-radius:4px',
      'padding:6px',
      'z-index:50',
      'user-select:none',
      'pointer-events:auto',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'BUILD';
    title.style.cssText =
      'font-weight:bold;letter-spacing:1px;margin-bottom:5px;color:#ffd86b;border-bottom:1px solid #3a4658;padding-bottom:3px;';
    root.appendChild(title);

    const list = document.createElement('div');
    list.className = 'bulwark-build-list';
    root.appendChild(list);

    this._root = root;
    this._list = list;
    this.mount.appendChild(root);
  }

  _renderRows() {
    this._list.innerHTML = '';
    this._entries = [];

    for (const def of this._defs) {
      const row = document.createElement('div');
      row.className = 'bulwark-build-row';
      row.style.cssText = [
        'display:flex',
        'justify-content:space-between',
        'align-items:center',
        'padding:4px 5px',
        'margin:2px 0',
        'border:1px solid #2c3646',
        'border-radius:3px',
        'cursor:pointer',
        'background:#1c2431',
        'transition:background 0.08s',
      ].join(';');

      const left = document.createElement('div');
      left.style.cssText = 'display:flex;flex-direction:column;';

      const nameEl = document.createElement('span');
      nameEl.textContent = this._defLabel(def);
      nameEl.style.cssText = 'font-weight:bold;';

      const subEl = document.createElement('span');
      subEl.textContent = this._defDomainText(def);
      subEl.style.cssText = 'font-size:10px;color:#8fa3bd;';

      left.appendChild(nameEl);
      left.appendChild(subEl);

      const priceEl = document.createElement('span');
      const price = this._defCostT1(def);
      priceEl.textContent = '$' + price;
      priceEl.style.cssText = 'color:#ffd86b;font-weight:bold;margin-left:6px;';

      row.appendChild(left);
      row.appendChild(priceEl);

      row.addEventListener('mouseenter', () => {
        if (!row._disabled) row.style.background = '#26303f';
      });
      row.addEventListener('mouseleave', () => {
        if (row._id !== this._selectedId) {
          row.style.background = row._disabled ? '#181d26' : '#1c2431';
        }
      });

      const id = def.id;
      row._id = id;

      row.addEventListener('click', () => {
        if (row._disabled) return;
        this._onSelect(def);
      });

      this._list.appendChild(row);
      this._entries.push({ id, def, row, priceEl, nameEl, price });
    }
  }

  _onSelect(def) {
    this._selectedId = def.id;
    // visual selection
    for (const e of this._entries) {
      if (e.id === def.id) {
        e.row.style.background = '#33506b';
      } else if (!e.row._disabled) {
        e.row.style.background = '#1c2431';
      }
    }
    // begin placement
    if (this.placement && typeof this.placement.beginPlacement === 'function') {
      this.placement.beginPlacement(def);
    }
  }

  /** Clear the current selection highlight (e.g. after drop/cancel). */
  clearSelection() {
    this._selectedId = null;
    for (const e of this._entries) {
      if (!e.row._disabled) e.row.style.background = '#1c2431';
    }
  }

  _currentMoney() {
    const st = this.sim && this.sim.state;
    if (!st) return 0;
    if (st.economy && typeof st.economy.money === 'number') {
      return st.economy.money;
    }
    if (typeof st.money === 'number') return st.money;
    return 0;
  }

  /** Per-frame update: dim entries the player cannot afford. */
  update() {
    const money = this._currentMoney();
    for (const e of this._entries) {
      const affordable = money >= e.price;
      const disabled = !affordable;
      if (e.row._disabled === disabled) continue; // no change
      e.row._disabled = disabled;
      if (disabled) {
        e.row.style.opacity = '0.42';
        e.row.style.cursor = 'not-allowed';
        e.row.style.background = '#181d26';
        e.priceEl.style.color = '#8a6a3a';
      } else {
        e.row.style.opacity = '1';
        e.row.style.cursor = 'pointer';
        e.row.style.background =
          e.id === this._selectedId ? '#33506b' : '#1c2431';
        e.priceEl.style.color = '#ffd86b';
      }
    }
  }

  destroy() {
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    this._entries = [];
  }
}

export function createBuildPanel(opts) {
  return new BuildPanel(opts);
}

export default BuildPanel;