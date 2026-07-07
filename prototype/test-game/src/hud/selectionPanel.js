// src/hud/selectionPanel.js
// Selected-structure popup: name, damage, tier, upgrade+price, repair, sell+refund.
// Pure DOM overlay (screen-space, never rotates). Reads sim state, issues commands.

import { REFUND_RATE } from '../config/constants.js';

/**
 * SelectionPanel — floating popup describing the currently selected structure.
 * It reads strict sim state and dispatches commands (upgrade/repair/sell) that
 * are appended to the battle log via the command bus, keeping determinism intact.
 */
export class SelectionPanel {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.mount  DOM element to attach the panel to (HUD overlay).
   * @param {object}      opts.state  sim state container.
   * @param {object}      opts.tables config.data.tables namespace.
   * @param {function}    opts.dispatch  (command) => void  — pushes a command into the sim.
   */
  constructor({ mount, state, tables, dispatch }) {
    this.state = state;
    this.tables = tables;
    this.dispatch = dispatch;
    this.selectedId = null;

    this.root = document.createElement('div');
    this.root.className = 'bw-selection-panel';
    this._applyRootStyle();

    this._build();
    this.hide();

    (mount || document.body).appendChild(this.root);
  }

  _applyRootStyle() {
    Object.assign(this.root.style, {
      position: 'absolute',
      minWidth: '180px',
      maxWidth: '240px',
      padding: '10px 12px',
      background: 'rgba(12,16,24,0.92)',
      border: '1px solid #3a4a63',
      borderRadius: '6px',
      color: '#e8eef6',
      font: '12px/1.4 monospace',
      pointerEvents: 'auto',
      zIndex: '50',
      boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
      userSelect: 'none',
    });
  }

  _build() {
    // Title / name
    this.elName = document.createElement('div');
    Object.assign(this.elName.style, {
      fontSize: '14px',
      fontWeight: 'bold',
      marginBottom: '6px',
      color: '#ffd76b',
    });
    this.root.appendChild(this.elName);

    // Stat block
    this.elTier = this._statRow('Tier', '—');
    this.elHp = this._statRow('HP', '—');
    this.elDmg = this._statRow('Damage', '—');
    this.elRange = this._statRow('Range', '—');
    this.elState = this._statRow('State', '—');

    // HP bar
    this.hpBarOuter = document.createElement('div');
    Object.assign(this.hpBarOuter.style, {
      height: '6px',
      background: '#22303f',
      borderRadius: '3px',
      overflow: 'hidden',
      margin: '4px 0 8px 0',
    });
    this.hpBarInner = document.createElement('div');
    Object.assign(this.hpBarInner.style, {
      height: '100%',
      width: '100%',
      background: '#4caf50',
      transition: 'width 0.12s linear',
    });
    this.hpBarOuter.appendChild(this.hpBarInner);
    this.root.appendChild(this.hpBarOuter);

    // Buttons
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    });

    this.btnUpgrade = this._button('Upgrade', () => this._onUpgrade());
    this.btnRepair = this._button('Repair', () => this._onRepair());
    this.btnSell = this._button('Sell', () => this._onSell());

    btnRow.appendChild(this.btnUpgrade);
    btnRow.appendChild(this.btnRepair);
    btnRow.appendChild(this.btnSell);
    this.root.appendChild(btnRow);
  }

  _statRow(label, value) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      justifyContent: 'space-between',
    });
    const l = document.createElement('span');
    l.textContent = label;
    l.style.color = '#8fa4bd';
    const v = document.createElement('span');
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    this.root.appendChild(row);
    return v;
  }

  _button(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      padding: '5px 8px',
      background: '#274060',
      color: '#e8eef6',
      border: '1px solid #3a5a80',
      borderRadius: '4px',
      cursor: 'pointer',
      font: '11px monospace',
      textAlign: 'left',
    });
    b.addEventListener('mouseenter', () => {
      if (!b.disabled) b.style.background = '#365a86';
    });
    b.addEventListener('mouseleave', () => {
      if (!b.disabled) b.style.background = '#274060';
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!b.disabled) onClick();
    });
    return b;
  }

  // ---- Data helpers ----

  _getStructure(id) {
    if (id == null) return null;
    const ents = this.state.entities;
    if (!ents) return null;
    // entities may be a Map or an array-like; support both
    if (typeof ents.get === 'function') return ents.get(id) || null;
    if (Array.isArray(ents)) return ents.find((e) => e && e.id === id) || null;
    if (ents.structures) {
      if (typeof ents.structures.get === 'function') return ents.structures.get(id) || null;
      if (Array.isArray(ents.structures)) return ents.structures.find((e) => e && e.id === id) || null;
    }
    return ents[id] || null;
  }

  _structDef(structure) {
    if (!structure) return null;
    const tbl = this.tables && this.tables.structures;
    if (!tbl) return null;
    const key = structure.type || structure.defId || structure.structId;
    if (tbl[key]) return tbl[key];
    if (typeof tbl.get === 'function') return tbl.get(key) || null;
    if (Array.isArray(tbl)) return tbl.find((s) => s && (s.id === key || s.StructureID === key)) || null;
    return null;
  }

  _tierField(def, base, tier) {
    // Try common per-tier field naming conventions.
    const t = tier || 1;
    const candidates = [
      `${base} T${t}`, `${base}_T${t}`, `${base}T${t}`,
      `${base}${t}`, base,
    ];
    for (const c of candidates) {
      if (def && def[c] != null) return def[c];
    }
    return null;
  }

  _upgradeCost(structure, def) {
    const tier = structure.tier || 1;
    if (tier >= 3) return null; // max tier
    const A = this.tables && this.tables.assumptions;
    const nextTier = tier + 1;
    // Base cost from def
    let baseCost =
      this._tierField(def, 'Cost', 1) ??
      def.cost ?? def.Cost ?? 0;
    baseCost = Number(baseCost) || 0;
    // Cumulative unit value multipliers from assumptions
    const mult =
      nextTier === 2
        ? (A && (A.Upgrade_Cost_x_T2 ?? A['Upgrade_Cost_x_T2'])) || 2.5
        : (A && (A.Upgrade_Cost_x_T3 ?? A['Upgrade_Cost_x_T3'])) || 5;
    const curMult =
      tier === 2
        ? (A && (A.Upgrade_Cost_x_T2 ?? A['Upgrade_Cost_x_T2'])) || 2.5
        : 1;
    // cumulative value at next tier minus current cumulative value
    return Math.round(baseCost * mult - baseCost * curMult);
  }

  _investedValue(structure, def) {
    const tier = structure.tier || 1;
    const A = this.tables && this.tables.assumptions;
    let baseCost =
      this._tierField(def, 'Cost', 1) ?? def.cost ?? def.Cost ?? 0;
    baseCost = Number(baseCost) || 0;
    let mult = 1;
    if (tier === 2) mult = (A && A.Upgrade_Cost_x_T2) || 2.5;
    else if (tier === 3) mult = (A && A.Upgrade_Cost_x_T3) || 5;
    return Math.round(baseCost * mult);
  }

  _refundValue(structure, def) {
    const rate = typeof REFUND_RATE === 'number' ? REFUND_RATE : 0.5;
    return Math.round(this._investedValue(structure, def) * rate);
  }

  _money() {
    const eco = this.state.economy;
    if (!eco) return 0;
    return eco.money ?? eco.gold ?? 0;
  }

  // ---- Public API ----

  select(id) {
    this.selectedId = id;
    if (id == null) {
      this.hide();
      return;
    }
    const s = this._getStructure(id);
    if (!s) {
      this.hide();
      return;
    }
    this.show();
    this.update();
  }

  clear() {
    this.selectedId = null;
    this.hide();
  }

  show() {
    this.root.style.display = 'block';
  }

  hide() {
    this.root.style.display = 'none';
  }

  /** Position the panel near the selected structure (screen coords). */
  positionAt(screenX, screenY) {
    const pad = 14;
    this.root.style.left = `${Math.round(screenX + pad)}px`;
    this.root.style.top = `${Math.round(screenY - 20)}px`;
  }

  /** Per-frame refresh of numbers + button enable states. */
  update() {
    if (this.selectedId == null) return;
    const s = this._getStructure(this.selectedId);
    if (!s) {
      this.clear();
      return;
    }
    const def = this._structDef(s);

    const name =
      (def && (def.name || def.Name || def.StructureID)) ||
      s.type || s.defId || 'Structure';
    const tier = s.tier || 1;

    this.elName.textContent = name;
    this.elTier.textContent = `${tier} / 3`;

    const maxHp = s.maxHp ?? s.hpMax ?? this._tierField(def, 'HP', tier) ?? s.hp ?? 0;
    const hp = s.hp ?? 0;
    this.elHp.textContent = `${Math.max(0, Math.round(hp))} / ${Math.round(maxHp)}`;

    const dmg =
      s.dps ?? this._tierField(def, 'DPS', tier) ?? (def && (def.dps || def.DPS)) ?? 0;
    this.elDmg.textContent = dmg ? `${Number(dmg).toFixed(1)} DPS` : '—';

    const range = s.range ?? (def && (def.range || def.Range)) ?? 0;
    this.elRange.textContent = range ? `${Number(range).toFixed(2)}` : '—';

    const lc = s.lifecycle || s.state || 'Complete';
    this.elState.textContent = lc;

    // HP bar
    const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpBarInner.style.width = `${(frac * 100).toFixed(1)}%`;
    this.hpBarInner.style.background =
      frac > 0.6 ? '#4caf50' : frac > 0.3 ? '#e0b53a' : '#d1483b';

    const money = this._money();
    const busy = lc === 'Building' || lc === 'Upgrading' || lc === 'Selling' || lc === 'Placing';
    const destroyed = lc === 'Destroyed';

    // Upgrade
    const upCost = this._upgradeCost(s, def);
    if (destroyed) {
      this._setBtn(this.btnUpgrade, 'Destroyed', true);
    } else if (upCost == null) {
      this._setBtn(this.btnUpgrade, 'Max Tier', true);
    } else {
      const afford = money >= upCost;
      this._setBtn(
        this.btnUpgrade,
        `Upgrade → T${tier + 1}  (${upCost}g)`,
        busy || !afford
      );
    }

    // Repair (free but requires damage & troops; sim validates troop travel)
    const damaged = hp < maxHp && !destroyed;
    const alreadyRepairing = !!s.repairing || lc === 'Repairing';
    this._setBtn(
      this.btnRepair,
      alreadyRepairing ? 'Repairing…' : 'Repair (free)',
      !damaged || busy || alreadyRepairing || destroyed
    );

    // Sell
    const refund = this._refundValue(s, def);
    this._setBtn(this.btnSell, `Sell  (+${refund}g)`, busy && lc !== 'Complete' && lc !== 'Damaged');
  }

  _setBtn(btn, label, disabled) {
    btn.textContent = label;
    btn.disabled = !!disabled;
    btn.style.opacity = disabled ? '0.45' : '1';
    btn.style.cursor = disabled ? 'default' : 'pointer';
    if (disabled) btn.style.background = '#1e2c3e';
    else btn.style.background = '#274060';
  }

  // ---- Command handlers ----

  _onUpgrade() {
    if (this.selectedId == null) return;
    this.dispatch({ type: 'upgrade', target: this.selectedId, structureId: this.selectedId });
  }

  _onRepair() {
    if (this.selectedId == null) return;
    this.dispatch({ type: 'repair', target: this.selectedId, structureId: this.selectedId });
  }

  _onSell() {
    if (this.selectedId == null) return;
    const id = this.selectedId;
    this.dispatch({ type: 'sell', target: id, structureId: id });
    // Selection will naturally clear once the entity is removed; hide preemptively.
    this.clear();
  }

  destroy() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }
}

export default SelectionPanel;