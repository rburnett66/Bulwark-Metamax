import { appendCommand } from '../sim/log.js';

// Input controller: converts pointer/keyboard interaction into timestamped
// commands routed through the battle log. Never mutates sim state directly.
//
// Command types emitted (all stamped with the current sim tick by the log):
//   { type:'place', item, slot }            - confirm structure placement
//   { type:'upgrade', structureId }         - upgrade selected structure
//   { type:'repair', structureId }          - dispatch repair troop
//   { type:'sell', structureId }            - sell structure for refund
//   { type:'deploy', unitId, x, y }         - deploy troop, march to drop point
//   { type:'startWave' }                    - start next wave
//
// Local (non-sim) UI state: build/deploy selection, ghost preview position,
// selected structure id. These affect presentation only, never the replay.

export class InputController {
  constructor(opts) {
    this.core = opts.core;           // headless sim core (read-only access)
    this.log = opts.log;             // battle log (commands routed through here)
    this.renderer = opts.renderer;   // read-only view; ghost/selection hints
    this.hud = opts.hud;             // DOM HUD
    this.canvas = opts.canvas || (this.renderer && this.renderer.canvas) || null;
    this.enabled = true;             // disabled during replay mode

    // UI-local state
    this.mode = 'idle';              // 'idle' | 'build' | 'deploy'
    this.buildItem = null;           // structure key from tables
    this.deployUnit = null;          // unit id from tables
    this.selectedStructureId = null;
    this.hover = { x: 0, y: 0, tileX: -1, tileY: -1, valid: false, slot: null };

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this._attach();
    this._wireHud();
  }

  // ---------------------------------------------------------------- lifecycle

  _attach() {
    if (this.canvas) {
      this.canvas.addEventListener('pointermove', this._onPointerMove);
      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      this.canvas.addEventListener('contextmenu', this._onContextMenu);
    }
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    }
    window.removeEventListener('keydown', this._onKeyDown);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) this.cancel();
  }

  // ------------------------------------------------------------------ command
  // Every player intention goes through here: it is stamped and recorded in
  // the battle log, then the log-driven pipeline feeds it into the sim core.

  issue(cmd) {
    if (!this.enabled) return false;
    const state = this.core.getState ? this.core.getState() : this.core.state;
    if (state && (state.won || state.lost)) return false;
    appendCommand(this.log, cmd, state ? state.tick : 0);
    return true;
  }

  // ---------------------------------------------------------------- HUD wires

  _wireHud() {
    const hud = this.hud;
    if (!hud) return;
    if (typeof hud.onBuildSelect === 'function') {
      hud.onBuildSelect((itemKey) => this.selectBuildItem(itemKey));
    }
    if (typeof hud.onDeploySelect === 'function') {
      hud.onDeploySelect((unitId) => this.selectDeployUnit(unitId));
    }
    if (typeof hud.onStartWave === 'function') {
      hud.onStartWave(() => this.startWave());
    }
    if (typeof hud.onUpgrade === 'function') {
      hud.onUpgrade(() => this.upgradeSelected());
    }
    if (typeof hud.onRepair === 'function') {
      hud.onRepair(() => this.repairSelected());
    }
    if (typeof hud.onSell === 'function') {
      hud.onSell(() => this.sellSelected());
    }
    if (typeof hud.onCancel === 'function') {
      hud.onCancel(() => this.cancel());
    }
  }

  // ------------------------------------------------------------- selection API

  selectBuildItem(itemKey) {
    if (!this.enabled) return;
    if (this.buildItem === itemKey && this.mode === 'build') {
      this.cancel();
      return;
    }
    this.mode = 'build';
    this.buildItem = itemKey;
    this.deployUnit = null;
    this.selectedStructureId = null;
    this._pushView();
  }

  selectDeployUnit(unitId) {
    if (!this.enabled) return;
    if (this.deployUnit === unitId && this.mode === 'deploy') {
      this.cancel();
      return;
    }
    this.mode = 'deploy';
    this.deployUnit = unitId;
    this.buildItem = null;
    this.selectedStructureId = null;
    this._pushView();
  }

  cancel() {
    this.mode = 'idle';
    this.buildItem = null;
    this.deployUnit = null;
    this.hover.valid = false;
    this.hover.slot = null;
    this._pushView();
  }

  // --------------------------------------------------------------- pointer i/o

  _canvasPoint(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    return {
      x: (ev.clientX - rect.left) * sx,
      y: (ev.clientY - rect.top) * sy,
    };
  }

  _screenToTile(p) {
    if (this.renderer && typeof this.renderer.screenToTile === 'function') {
      return this.renderer.screenToTile(p.x, p.y);
    }
    const ts = (this.renderer && this.renderer.tileSize) || 32;
    const ox = (this.renderer && this.renderer.offsetX) || 0;
    const oy = (this.renderer && this.renderer.offsetY) || 0;
    return { x: Math.floor((p.x - ox) / ts), y: Math.floor((p.y - oy) / ts) };
  }

  _onPointerMove(ev) {
    if (!this.enabled || !this.canvas) return;
    const p = this._canvasPoint(ev);
    const t = this._screenToTile(p);
    this.hover.x = p.x;
    this.hover.y = p.y;
    this.hover.tileX = t.x;
    this.hover.tileY = t.y;

    const state = this.core.getState ? this.core.getState() : this.core.state;

    if (this.mode === 'build' && this.buildItem) {
      const check = this._checkPlacement(state, this.buildItem, t.x, t.y);
      this.hover.valid = check.valid;
      this.hover.slot = check.slot;
    } else if (this.mode === 'deploy' && this.deployUnit) {
      this.hover.valid = this._checkDeploy(state, this.deployUnit, t.x, t.y);
      this.hover.slot = null;
    } else {
      this.hover.valid = false;
      this.hover.slot = null;
    }
    this._pushView();
  }

  _onPointerDown(ev) {
    if (!this.enabled || !this.canvas) return;
    if (ev.button === 2) { // right-click cancels
      this.cancel();
      return;
    }
    if (ev.button !== 0) return;

    const p = this._canvasPoint(ev);
    const t = this._screenToTile(p);
    const state = this.core.getState ? this.core.getState() : this.core.state;

    if (this.mode === 'build' && this.buildItem) {
      const check = this._checkPlacement(state, this.buildItem, t.x, t.y);
      if (check.valid) {
        this.issue({
          type: 'place',
          item: this.buildItem,
          slot: check.slot,
          x: t.x,
          y: t.y,
        });
        // keep build mode active if shift held for repeat placement
        if (!ev.shiftKey) this.cancel();
        else this._pushView();
      }
      return;
    }

    if (this.mode === 'deploy' && this.deployUnit) {
      if (this._checkDeploy(state, this.deployUnit, t.x, t.y)) {
        this.issue({
          type: 'deploy',
          unitId: this.deployUnit,
          x: t.x,
          y: t.y,
        });
        if (!ev.shiftKey) this.cancel();
        else this._pushView();
      }
      return;
    }

    // idle: try selecting a structure under the cursor
    const s = this._structureAt(state, t.x, t.y);
    this.selectedStructureId = s ? s.id : null;
    this._pushView();
  }

  _onContextMenu(ev) {
    ev.preventDefault();
    this.cancel();
  }

  // ---------------------------------------------------------------- keyboard

  _onKeyDown(ev) {
    if (!this.enabled) return;
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    switch (ev.key) {
      case 'Escape':
        this.cancel();
        this.selectedStructureId = null;
        this._pushView();
        break;
      case ' ':
      case 'Enter':
        ev.preventDefault();
        this.startWave();
        break;
      case 'u':
      case 'U':
        this.upgradeSelected();
        break;
      case 'r':
      case 'R':
        this.repairSelected();
        break;
      case 's':
      case 'S':
        this.sellSelected();
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9': {
        const idx = parseInt(ev.key, 10) - 1;
        const keys = this._buildKeys();
        if (idx < keys.length) this.selectBuildItem(keys[idx]);
        break;
      }
      default:
        break;
    }
  }

  _buildKeys() {
    const state = this.core.getState ? this.core.getState() : this.core.state;
    if (state && state.buildableStructures) return state.buildableStructures;
    if (this.hud && typeof this.hud.getBuildKeys === 'function') {
      return this.hud.getBuildKeys();
    }
    return [];
  }

  // --------------------------------------------------------- structure actions

  upgradeSelected() {
    if (this.selectedStructureId == null) return;
    this.issue({ type: 'upgrade', structureId: this.selectedStructureId });
  }

  repairSelected() {
    if (this.selectedStructureId == null) return;
    this.issue({ type: 'repair', structureId: this.selectedStructureId });
  }

  sellSelected() {
    if (this.selectedStructureId == null) return;
    this.issue({ type: 'sell', structureId: this.selectedStructureId });
    this.selectedStructureId = null;
    this._pushView();
  }

  startWave() {
    this.issue({ type: 'startWave' });
  }

  // ---------------------------------------------------------------- validation
  // Local read-only pre-checks so the ghost tints valid/invalid live. The sim
  // core re-validates authoritatively when the command is applied from the log.

  _checkPlacement(state, itemKey, tx, ty) {
    if (!state) return { valid: false, slot: null };
    if (typeof this.core.canPlace === 'function') {
      const r = this.core.canPlace(itemKey, tx, ty);
      if (typeof r === 'object' && r !== null) {
        return { valid: !!r.valid, slot: r.slot != null ? r.slot : null };
      }
      return { valid: !!r, slot: this._slotAt(state, tx, ty) };
    }
    // Fallback: check state slots + money directly.
    const slot = this._slotAt(state, tx, ty);
    const def = this._structureDef(state, itemKey);
    if (!def) return { valid: false, slot: null };
    const cost = def.cost != null ? def.cost : (def.costT1 != null ? def.costT1 : 0);
    const affordable = state.money >= cost;
    if (def.isTerrain || def.kind === 'wall' || def.kind === 'moat') {
      // walls/moats place on open ground tiles, not slots
      const open = this._tileOpen(state, tx, ty);
      return { valid: open && affordable, slot: null };
    }
    if (!slot || slot.occupied) return { valid: false, slot: slot || null };
    return { valid: affordable, slot: slot };
  }

  _checkDeploy(state, unitId, tx, ty) {
    if (!state) return false;
    if (typeof this.core.canDeploy === 'function') {
      return !!this.core.canDeploy(unitId, tx, ty);
    }
    const def = this._unitDef(state, unitId);
    if (!def) return false;
    const cost = def.cost != null ? def.cost : (def.costT1 != null ? def.costT1 : 0);
    if (state.money < cost) return false;
    if (!state.grid) return true;
    const w = state.grid.width != null ? state.grid.width : state.grid.w;
    const h = state.grid.height != null ? state.grid.height : state.grid.h;
    return tx >= 0 && ty >= 0 && tx < w && ty < h;
  }

  _tileOpen(state, tx, ty) {
    if (typeof this.core.tileOpen === 'function') return !!this.core.tileOpen(tx, ty);
    if (!state.grid) return false;
    const w = state.grid.width != null ? state.grid.width : state.grid.w;
    const h = state.grid.height != null ? state.grid.height : state.grid.h;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
    if (typeof state.grid.tileAt === 'function') {
      const tile = state.grid.tileAt(tx, ty);
      return tile && tile.terrain === 'ground' && !tile.occupied;
    }
    return true;
  }

  _slotAt(state, tx, ty) {
    const slots = state.slots || (state.grid && state.grid.slots) || [];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.x === tx && s.y === ty) return s;
    }
    return null;
  }

  _structureAt(state, tx, ty) {
    const structures = state.structures || [];
    for (let i = 0; i < structures.length; i++) {
      const s = structures[i];
      if (s.state === 'Destroyed') continue;
      const fw = s.footprintW || s.w || 1;
      const fh = s.footprintH || s.h || 1;
      const sx = s.tileX != null ? s.tileX : s.x;
      const sy = s.tileY != null ? s.tileY : s.y;
      if (tx >= sx && tx < sx + fw && ty >= sy && ty < sy + fh) return s;
    }
    return null;
  }

  _structureDef(state, key) {
    const defs = state.structureDefs || state.tables && state.tables.structures;
    if (!defs) return null;
    if (Array.isArray(defs)) {
      for (let i = 0; i < defs.length; i++) {
        if (defs[i].id === key || defs[i].key === key) return defs[i];
      }
      return null;
    }
    return defs[key] || null;
  }

  _unitDef(state, id) {
    const defs = state.unitDefs || state.tables && state.tables.units;
    if (!defs) return null;
    if (Array.isArray(defs)) {
      for (let i = 0; i < defs.length; i++) {
        if (defs[i].id === id || defs[i].key === id) return defs[i];
      }
      return null;
    }
    return defs[id] || null;
  }

  // ------------------------------------------------------------------- view

  // Push presentation hints to renderer + HUD (ghost preview, selection).
  // Pure presentation: never touches sim state.
  _pushView() {
    if (this.renderer) {
      if (typeof this.renderer.setGhost === 'function') {
        if (this.mode === 'build' && this.buildItem) {
          this.renderer.setGhost({
            kind: 'build',
            item: this.buildItem,
            tileX: this.hover.tileX,
            tileY: this.hover.tileY,
            valid: this.hover.valid,
          });
        } else if (this.mode === 'deploy' && this.deployUnit) {
          this.renderer.setGhost({
            kind: 'deploy',
            item: this.deployUnit,
            tileX: this.hover.tileX,
            tileY: this.hover.tileY,
            valid: this.hover.valid,
          });
        } else {
          this.renderer.setGhost(null);
        }
      }
      if (typeof this.renderer.setSelection === 'function') {
        this.renderer.setSelection(this.selectedStructureId);
      }
    }
    if (this.hud) {
      if (typeof this.hud.setSelectedStructure === 'function') {
        const state = this.core.getState ? this.core.getState() : this.core.state;
        let sel = null;
        if (state && this.selectedStructureId != null) {
          const structures = state.structures || [];
          for (let i = 0; i < structures.length; i++) {
            if (structures[i].id === this.selectedStructureId) {
              sel = structures[i];
              break;
            }
          }
          if (!sel) this.selectedStructureId = null;
        }
        this.hud.setSelectedStructure(sel);
      }
      if (typeof this.hud.setActiveBuild === 'function') {
        this.hud.setActiveBuild(this.mode === 'build' ? this.buildItem : null);
      }
      if (typeof this.hud.setActiveDeploy === 'function') {
        this.hud.setActiveDeploy(this.mode === 'deploy' ? this.deployUnit : null);
      }
    }
  }

  // Called each frame by main loop so selection panel tracks live hp/tier.
  update() {
    if (this.selectedStructureId != null) this._pushView();
  }
}

export function createInput(opts) {
  return new InputController(opts);
}