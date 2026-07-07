// src/input/controller.js
// Maps pointer / keyboard input into deterministic sim commands.
// READS session + world state, EMITS commands via a callback (never mutates sim state directly).

import { COMMANDS } from '../sim/commands.js';

/**
 * Controller wires pointer events (from pointer.js) and keyboard events into
 * high-level sim commands. It resolves screen→world coordinates, checks
 * placement validity via the geometry/grid helpers, and dispatches commands
 * to the world reducer through the provided `dispatch` function.
 *
 * It is intentionally presentation-agnostic: it does not draw anything.
 * The ghost/preview state is stored in session for the renderer to read.
 */
export class Controller {
  /**
   * @param {object} opts
   * @param {object} opts.session   - session state (mode, selected, seed, ui)
   * @param {object} opts.world     - live sim world (read-only here)
   * @param {object} opts.config    - aggregated config (config.data.tables)
   * @param {object} opts.geometry  - board geometry helpers
   * @param {object} opts.grid      - tile grid / occupancy
   * @param {function} opts.dispatch- (command) => void ; applies to world reducer
   * @param {object} opts.renderer  - pixi renderer (for screen→world projection)
   */
  constructor(opts) {
    this.session = opts.session;
    this.world = opts.world;
    this.config = opts.config;
    this.geometry = opts.geometry;
    this.grid = opts.grid;
    this.dispatch = opts.dispatch;
    this.renderer = opts.renderer;

    // structure catalog from data tables
    this.structures = (this.config && this.config.data && this.config.data.tables &&
      this.config.data.tables.structures) || {};
    this.units = (this.config && this.config.data && this.config.data.tables &&
      this.config.data.tables.units) || {};

    // hotkey → structure typeId map (build palette order)
    this._structureKeys = Object.keys(this.structures);

    this._bound = false;
  }

  // ---------------------------------------------------------------
  // Wiring: attach to a pointer emitter (src/input/pointer.js) and keyboard
  // ---------------------------------------------------------------
  attach(pointer, target) {
    if (this._bound) return;
    this._bound = true;
    this.pointer = pointer;

    // Pointer callbacks
    pointer.onDown = (p) => this.handlePointerDown(p);
    pointer.onMove = (p) => this.handlePointerMove(p);
    pointer.onUp = (p) => this.handlePointerUp(p);
    pointer.onCancel = () => this.handleCancel();

    // Keyboard
    const kbTarget = target || window;
    this._kbTarget = kbTarget;
    this._keyHandler = (e) => this.handleKey(e);
    kbTarget.addEventListener('keydown', this._keyHandler);
  }

  detach() {
    if (!this._bound) return;
    this._bound = false;
    if (this.pointer) {
      this.pointer.onDown = null;
      this.pointer.onMove = null;
      this.pointer.onUp = null;
      this.pointer.onCancel = null;
    }
    if (this._kbTarget && this._keyHandler) {
      this._kbTarget.removeEventListener('keydown', this._keyHandler);
    }
  }

  // ---------------------------------------------------------------
  // Coordinate projection: screen → world tile-space
  // ---------------------------------------------------------------
  screenToWorld(p) {
    // If renderer supplies a projector, use it; otherwise identity via geometry.
    if (this.renderer && typeof this.renderer.screenToWorld === 'function') {
      return this.renderer.screenToWorld(p.x, p.y);
    }
    // Fallback: geometry provides a pixels-per-tile scale + origin.
    const g = this.geometry;
    const scale = (g && g.pixelsPerTile) ? g.pixelsPerTile : 1;
    const ox = (g && g.originX) ? g.originX : 0;
    const oy = (g && g.originY) ? g.originY : 0;
    return { x: (p.x - ox) / scale, y: (p.y - oy) / scale };
  }

  worldToTile(w) {
    return {
      tx: Math.floor(w.x),
      ty: Math.floor(w.y),
    };
  }

  // ---------------------------------------------------------------
  // Placement validity: space + terrain + cost
  // ---------------------------------------------------------------
  structureCost(typeId, tier) {
    const def = this.structures[typeId];
    if (!def) return Infinity;
    const t = tier || 1;
    if (t === 1) return def.costT1 != null ? def.costT1 : def.cost || 0;
    if (t === 2) return def.costT2 != null ? def.costT2 : (def.cost || 0) * 2.5;
    return def.costT3 != null ? def.costT3 : (def.cost || 0) * 5;
  }

  canAfford(typeId, tier) {
    const gold = (this.world && this.world.economy && this.world.economy.gold) || 0;
    return gold >= this.structureCost(typeId, tier);
  }

  /**
   * Returns { valid, reason, slot } for placing typeId at world position w.
   * Checks: within board, free slot / free tile, terrain domain, affordability.
   */
  checkPlacement(typeId, w) {
    const def = this.structures[typeId];
    if (!def) return { valid: false, reason: 'unknown' };

    if (!this.canAfford(typeId, 1)) {
      return { valid: false, reason: 'cost' };
    }

    // Wall/moat = free-placement terrain piece on the grid; towers snap to slots.
    const isTerrain = def.category === 'wall' || def.category === 'moat' ||
      def.terrain === true;

    if (isTerrain) {
      const tile = this.worldToTile(w);
      if (!this.grid || !this.grid.inBounds(tile.tx, tile.ty)) {
        return { valid: false, reason: 'space' };
      }
      // Moats must go on/adjacent to buildable terrain; walls block ground lane.
      if (this.grid.isOccupied(tile.tx, tile.ty)) {
        return { valid: false, reason: 'occupied' };
      }
      // Cannot block the base itself.
      if (this.geometry && this.geometry.isBaseTile &&
          this.geometry.isBaseTile(tile.tx, tile.ty)) {
        return { valid: false, reason: 'space' };
      }
      return { valid: true, reason: 'ok', tile };
    }

    // Tower: find nearest free hard-point slot near the pointer.
    const slot = this._nearestFreeSlot(w);
    if (!slot) {
      return { valid: false, reason: 'noslot' };
    }
    return { valid: true, reason: 'ok', slot };
  }

  _nearestFreeSlot(w) {
    const slots = (this.geometry && this.geometry.slots) ? this.geometry.slots :
      (this.world && this.world.slots) || [];
    let best = null;
    let bestD = Infinity;
    const maxSnap = (this.geometry && this.geometry.slotSnapRadius) || 3.5;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (this._slotOccupied(s, i)) continue;
      const dx = s.x - w.x;
      const dy = s.y - w.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD && d <= maxSnap) {
        bestD = d;
        best = { index: i, x: s.x, y: s.y };
      }
    }
    return best;
  }

  _slotOccupied(slot, index) {
    const structures = (this.world && this.world.structures) || [];
    for (const st of structures) {
      if (st.slotIndex === index && st.state !== 'Destroyed') return true;
    }
    return false;
  }

  // ---------------------------------------------------------------
  // Pointer handling
  // ---------------------------------------------------------------
  handlePointerDown(p) {
    const w = this.screenToWorld(p);
    // If HUD consumed the pointer (button clicks etc.), pointer.js flags it.
    if (p.consumedByHUD) return;

    const mode = this.session.mode;

    if (mode === 'build' && this.session.buildType) {
      // dragging begins; ghost tracks in handlePointerMove
      this.session.ui.dragging = true;
      this._updateGhost(w);
      return;
    }

    if (mode === 'deploy' && this.session.deployUnit) {
      this.session.ui.dragging = true;
      this._updateDeployGhost(w);
      return;
    }

    // Default: selection
    this._trySelect(w);
  }

  handlePointerMove(p) {
    if (p.consumedByHUD) return;
    const w = this.screenToWorld(p);

    if (this.session.mode === 'build' && this.session.buildType) {
      this._updateGhost(w);
    } else if (this.session.mode === 'deploy' && this.session.deployUnit) {
      this._updateDeployGhost(w);
    }
  }

  handlePointerUp(p) {
    if (p.consumedByHUD) {
      this.session.ui.dragging = false;
      return;
    }
    const w = this.screenToWorld(p);

    if (this.session.mode === 'build' && this.session.buildType) {
      this._commitPlacement(w);
      this.session.ui.dragging = false;
      return;
    }

    if (this.session.mode === 'deploy' && this.session.deployUnit) {
      this._commitDeploy(w);
      this.session.ui.dragging = false;
      return;
    }

    this.session.ui.dragging = false;
  }

  handleCancel() {
    this._clearModes();
  }

  // ---------------------------------------------------------------
  // Ghost preview state (renderer reads session.ui.ghost)
  // ---------------------------------------------------------------
  _updateGhost(w) {
    const typeId = this.session.buildType;
    const chk = this.checkPlacement(typeId, w);
    let gx = w.x, gy = w.y;
    if (chk.slot) { gx = chk.slot.x; gy = chk.slot.y; }
    else if (chk.tile) { gx = chk.tile.tx + 0.5; gy = chk.tile.ty + 0.5; }
    this.session.ui.ghost = {
      typeId,
      x: gx,
      y: gy,
      valid: chk.valid,
      reason: chk.reason,
    };
  }

  _updateDeployGhost(w) {
    const unitId = this.session.deployUnit;
    const valid = this._deployValid(unitId, w);
    this.session.ui.ghost = {
      unitId,
      x: w.x,
      y: w.y,
      valid: valid.valid,
      reason: valid.reason,
      march: true,
    };
  }

  _deployValid(unitId, w) {
    const def = this.units[unitId];
    if (!def) return { valid: false, reason: 'unknown' };
    const cost = def.costT1 != null ? def.costT1 : (def.cost || 0);
    const gold = (this.world && this.world.economy && this.world.economy.gold) || 0;
    if (gold < cost) return { valid: false, reason: 'cost' };

    const tile = this.worldToTile(w);
    if (!this.grid || !this.grid.inBounds(tile.tx, tile.ty)) {
      return { valid: false, reason: 'space' };
    }
    // Domain-based terrain validity for the drop destination.
    const domain = def.Domain || def.domain || 'Walker';
    if (domain === 'Walker') {
      if (this.grid.isWater && this.grid.isWater(tile.tx, tile.ty)) {
        return { valid: false, reason: 'terrain' };
      }
      if (this.grid.isBlocked && this.grid.isBlocked(tile.tx, tile.ty)) {
        return { valid: false, reason: 'terrain' };
      }
    } else if (domain === 'Floater' || domain === 'Swimmer') {
      if (this.grid.isWater && !this.grid.isWater(tile.tx, tile.ty)) {
        return { valid: false, reason: 'terrain' };
      }
    }
    // Flyer: any tile valid.
    return { valid: true, reason: 'ok' };
  }

  // ---------------------------------------------------------------
  // Commit commands
  // ---------------------------------------------------------------
  _commitPlacement(w) {
    const typeId = this.session.buildType;
    const chk = this.checkPlacement(typeId, w);
    if (!chk.valid) {
      // invalid drop → keep build mode active (do nothing) or cancel
      return;
    }
    const cmd = {
      type: COMMANDS.PLACE,
      typeId,
      tier: 1,
    };
    if (chk.slot) {
      cmd.slotIndex = chk.slot.index;
      cmd.x = chk.slot.x;
      cmd.y = chk.slot.y;
    } else if (chk.tile) {
      cmd.x = chk.tile.tx + 0.5;
      cmd.y = chk.tile.ty + 0.5;
      cmd.tx = chk.tile.tx;
      cmd.ty = chk.tile.ty;
      cmd.terrain = true;
    }
    this.dispatch(cmd);
    // stay in build mode for repeat placement unless shift not held
    this.session.ui.ghost = null;
  }

  _commitDeploy(w) {
    const unitId = this.session.deployUnit;
    const chk = this._deployValid(unitId, w);
    if (!chk.valid) return;
    this.dispatch({
      type: COMMANDS.DEPLOY,
      unitId,
      x: w.x,
      y: w.y,
    });
    this.session.ui.ghost = null;
  }

  // ---------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------
  _trySelect(w) {
    const structures = (this.world && this.world.structures) || [];
    let hit = null;
    let bestD = Infinity;
    for (const st of structures) {
      if (st.state === 'Destroyed') continue;
      const dx = st.x - w.x;
      const dy = st.y - w.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const r = st.footprint ? Math.max(st.footprint.w, st.footprint.h) * 0.6 : 1.0;
      if (d <= r && d < bestD) { bestD = d; hit = st; }
    }
    if (hit) {
      this.session.selected = hit.id;
      this.dispatch({ type: COMMANDS.SELECT, id: hit.id });
    } else {
      this.session.selected = null;
      this.dispatch({ type: COMMANDS.SELECT, id: null });
    }
  }

  // ---------------------------------------------------------------
  // High-level actions (also called by HUD buttons)
  // ---------------------------------------------------------------
  beginBuild(typeId) {
    this.session.mode = 'build';
    this.session.buildType = typeId;
    this.session.deployUnit = null;
    this.session.selected = null;
    this.session.ui.ghost = null;
  }

  beginDeploy(unitId) {
    this.session.mode = 'deploy';
    this.session.deployUnit = unitId;
    this.session.buildType = null;
    this.session.selected = null;
    this.session.ui.ghost = null;
  }

  upgradeSelected() {
    const id = this.session.selected;
    if (id == null) return;
    this.dispatch({ type: COMMANDS.UPGRADE, id });
  }

  sellSelected() {
    const id = this.session.selected;
    if (id == null) return;
    this.dispatch({ type: COMMANDS.SELL, id });
    this.session.selected = null;
  }

  repairSelected() {
    const id = this.session.selected;
    if (id == null) return;
    this.dispatch({ type: COMMANDS.REPAIR, id });
  }

  setTargetSelected(targetId) {
    const id = this.session.selected;
    if (id == null) return;
    this.dispatch({ type: COMMANDS.TARGET, id, targetId });
  }

  startWave() {
    this.dispatch({ type: COMMANDS.START_WAVE });
  }

  _clearModes() {
    this.session.mode = 'idle';
    this.session.buildType = null;
    this.session.deployUnit = null;
    this.session.ui.ghost = null;
    this.session.ui.dragging = false;
  }

  // ---------------------------------------------------------------
  // Keyboard mapping
  // ---------------------------------------------------------------
  handleKey(e) {
    const k = e.key;

    // Escape / right-click style cancel
    if (k === 'Escape') {
      this._clearModes();
      this.session.selected = null;
      return;
    }

    // Space → start wave
    if (k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      this.startWave();
      return;
    }

    // Selected-structure actions
    if (k === 'u' || k === 'U') { this.upgradeSelected(); return; }
    if (k === 's' || k === 'S') { this.sellSelected(); return; }
    if (k === 'r' || k === 'R') { this.repairSelected(); return; }

    // Number keys 1..9 → build palette hotkeys
    const n = parseInt(k, 10);
    if (!isNaN(n) && n >= 1 && n <= 9) {
      const typeId = this._structureKeys[n - 1];
      if (typeId) this.beginBuild(typeId);
      return;
    }

    // Q/W/E → quick deploy of vertical-slice attacker units (if present)
    const vs = (this.config && this.config.data && this.config.data.tables &&
      this.config.data.tables.verticalSlice) || null;
    if (vs && vs.attackers) {
      if (k === 'q' || k === 'Q') { this._deployVS(vs, 0); return; }
      if (k === 'w' || k === 'W') { this._deployVS(vs, 1); return; }
      if (k === 'e' || k === 'E') { this._deployVS(vs, 2); return; }
    }

    // P → pause toggle (loop reads session.ui.paused)
    if (k === 'p' || k === 'P') {
      this.session.ui.paused = !this.session.ui.paused;
      return;
    }
  }

  _deployVS(vs, idx) {
    const unitId = vs.attackers[idx];
    if (unitId) this.beginDeploy(unitId);
  }
}

export function createController(opts) {
  return new Controller(opts);
}

export default Controller;