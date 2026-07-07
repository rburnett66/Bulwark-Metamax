// src/hud/buildPalette.js
// Structure list with live pricing + dimmed unaffordable state.
// Reads sim/session state, never mutates it. Emits commands via controller/session.

import { Container, Graphics, Text, TextStyle } from '../../vendor/pixi.min.js';

/**
 * BuildPalette
 * A screen-space HUD panel listing all buildable structures.
 * Each row shows: name swatch, name, tier-1 cost.
 * Rows dim when unaffordable; selecting a row enters "build" mode for that structure.
 *
 * Integration:
 *  - config.data.tables.structures : structure definitions with costs
 *  - session : { selectedBuild, mode, ... } holds current build selection
 *  - onSelect(structureId) : callback to controller to enter placement mode
 *  - getGold() : returns current player gold from world/economy
 */
export class BuildPalette {
  constructor({ config, session, onSelect, x = 8, y = 8 }) {
    this.config = config;
    this.session = session;
    this.onSelect = onSelect || (() => {});
    this.root = new Container();
    this.root.x = x;
    this.root.y = y;
    this.rows = [];
    this._lastGold = null;
    this._lastSelected = undefined;

    this._buildRows();
  }

  get view() {
    return this.root;
  }

  _structureList() {
    const tables = (this.config && this.config.data && this.config.data.tables) || {};
    const structures = tables.structures || {};
    // structures may be a map keyed by id, or an array. Normalize to array.
    let list = [];
    if (Array.isArray(structures)) {
      list = structures.slice();
    } else {
      list = Object.keys(structures).map((k) => {
        const s = structures[k];
        return Object.assign({ id: s.id || k }, s);
      });
    }
    // Fallback minimal set if config missing (keeps HUD functional).
    if (list.length === 0) {
      list = [
        { id: 'tower_ag', name: 'AG Tower', costT1: 100, kind: 'antiGround', color: 0x66aaff },
        { id: 'tower_aa', name: 'AA Tower', costT1: 120, kind: 'antiAir', color: 0xffaa66 },
        { id: 'tower_art', name: 'Artillery', costT1: 150, kind: 'artillery', color: 0xff6666 },
        { id: 'wall', name: 'Wall', costT1: 40, kind: 'wall', color: 0x999999 },
        { id: 'moat', name: 'Moat', costT1: 60, kind: 'moat', color: 0x3366aa },
      ];
    }
    return list;
  }

  _costOf(def) {
    // Prefer explicit costT1, then cost, then derived.
    if (typeof def.costT1 === 'number') return def.costT1;
    if (typeof def.cost === 'number') return def.cost;
    if (def.tiers && def.tiers[0] && typeof def.tiers[0].cost === 'number') return def.tiers[0].cost;
    if (typeof def.Cost_T1 === 'number') return def.Cost_T1;
    return 0;
  }

  _nameOf(def) {
    return def.name || def.label || def.id || 'Structure';
  }

  _colorOf(def) {
    if (typeof def.color === 'number') return def.color;
    switch (def.kind) {
      case 'antiGround': return 0x66aaff;
      case 'antiAir': return 0xffaa66;
      case 'artillery': return 0xff6666;
      case 'wall': return 0x999999;
      case 'moat': return 0x3366aa;
      default: return 0x88cc88;
    }
  }

  _buildRows() {
    const list = this._structureList();
    const rowH = 30;
    const rowW = 156;
    const pad = 4;

    // Panel background
    const bg = new Graphics();
    bg.beginFill(0x000000, 0.55);
    bg.lineStyle(1, 0xffffff, 0.25);
    bg.drawRect(0, 0, rowW + pad * 2, list.length * (rowH + pad) + pad + 20);
    bg.endFill();
    this.root.addChild(bg);

    const titleStyle = new TextStyle({
      fill: 0xffffff, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
    });
    const title = new Text('BUILD', titleStyle);
    title.x = pad + 2;
    title.y = 4;
    this.root.addChild(title);

    const startY = 22;

    list.forEach((def, i) => {
      const cost = this._costOf(def);
      const rowContainer = new Container();
      rowContainer.x = pad;
      rowContainer.y = startY + i * (rowH + pad);

      const rowBg = new Graphics();
      const swatch = new Graphics();
      const nameStyle = new TextStyle({ fill: 0xffffff, fontSize: 11, fontFamily: 'monospace' });
      const costStyle = new TextStyle({ fill: 0xffe066, fontSize: 11, fontFamily: 'monospace' });
      const nameText = new Text(this._nameOf(def), nameStyle);
      const costText = new Text('$' + cost, costStyle);

      rowContainer.addChild(rowBg);
      rowContainer.addChild(swatch);
      rowContainer.addChild(nameText);
      rowContainer.addChild(costText);

      nameText.x = 24;
      nameText.y = 3;
      costText.x = 24;
      costText.y = 16;

      rowContainer.eventMode = 'static';
      rowContainer.cursor = 'pointer';

      // Hit area
      const hit = new Graphics();
      hit.beginFill(0xffffff, 0.001);
      hit.drawRect(0, 0, rowW, rowH);
      hit.endFill();
      rowContainer.addChildAt(hit, 0);

      rowContainer.on('pointertap', () => {
        // Only allow selection if affordable
        const gold = this._currentGold();
        if (gold >= cost) {
          this.onSelect(def.id, def);
        }
      });

      this.root.addChild(rowContainer);

      this.rows.push({
        def, cost, rowW, rowH,
        container: rowContainer,
        bg: rowBg, swatch,
        nameText, costText,
        color: this._colorOf(def),
        affordable: null,
        selected: null,
      });
    });
  }

  _currentGold() {
    // session may expose getGold, or the world reference.
    if (this.session && typeof this.session.getGold === 'function') {
      return this.session.getGold();
    }
    if (this.session && this.session.world && this.session.world.economy) {
      return this.session.world.economy.gold || 0;
    }
    if (this.session && typeof this.session.gold === 'number') {
      return this.session.gold;
    }
    return this._injectedGold != null ? this._injectedGold : 0;
  }

  _currentSelected() {
    if (this.session && typeof this.session.selectedBuild !== 'undefined') {
      return this.session.selectedBuild;
    }
    return this._injectedSelected;
  }

  /**
   * update() — call every frame. Reads gold + selection and re-paints affordability.
   * gold/selected may be passed to override session lookups (from hud.js).
   */
  update(gold, selected) {
    if (typeof gold === 'number') this._injectedGold = gold;
    if (typeof selected !== 'undefined') this._injectedSelected = selected;

    const g = this._currentGold();
    const sel = this._currentSelected();

    if (g === this._lastGold && sel === this._lastSelected) {
      // still repaint on first pass
      if (this._painted) return;
    }
    this._lastGold = g;
    this._lastSelected = sel;
    this._painted = true;

    for (const row of this.rows) {
      const affordable = g >= row.cost;
      const isSelected = sel === row.def.id;

      // Repaint background
      row.bg.clear();
      if (isSelected) {
        row.bg.beginFill(0xffffff, 0.28);
        row.bg.lineStyle(2, 0xffff66, 0.9);
      } else {
        row.bg.beginFill(0xffffff, affordable ? 0.08 : 0.03);
        row.bg.lineStyle(1, 0xffffff, affordable ? 0.2 : 0.08);
      }
      row.bg.drawRect(0, 0, row.rowW, row.rowH);
      row.bg.endFill();

      // Swatch
      row.swatch.clear();
      row.swatch.beginFill(row.color, affordable ? 1 : 0.35);
      row.swatch.lineStyle(1, 0xffffff, affordable ? 0.5 : 0.2);
      row.swatch.drawRect(4, 6, 16, 18);
      row.swatch.endFill();

      // Text dimming
      const alpha = affordable ? 1 : 0.4;
      row.nameText.alpha = alpha;
      row.costText.alpha = alpha;
      row.costText.style.fill = affordable ? 0xffe066 : 0xaa8844;

      row.container.cursor = affordable ? 'pointer' : 'not-allowed';
      row.affordable = affordable;
      row.selected = isSelected;
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.rows = [];
  }
}

export default BuildPalette;