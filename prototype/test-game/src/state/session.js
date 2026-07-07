// src/state/session.js
// Session glue: seed, selected structure, mode (build/deploy), UI state.
// Holds all *presentation / interaction* state that is NOT part of the deterministic
// sim world. The sim world lives in src/sim/world.js; this object never mutates it
// directly — it only records intent and forwards commands through the provided
// dispatch function.

/**
 * A Session is the bridge between input (pointer/controller/HUD) and the
 * deterministic sim. It stores:
 *   - seed              : the fixed seed for this play session (for determinism/replay)
 *   - mode              : 'build' | 'deploy' | 'idle'  (what a click does)
 *   - selectedTool      : which structure/unit is armed for placement
 *   - selectedEntityId  : which existing structure is selected (for the panel)
 *   - ghost             : { x, y, valid } placement preview state
 *   - dragging          : pointer drag flag
 *   - hover             : last hover tile/world coords
 *   - speed / paused    : loop control (read by src/loop.js)
 *   - listeners         : lightweight pub/sub for HUD refresh
 *
 * None of this affects replay: the sim only ever sees the commands we dispatch.
 */

export const Mode = Object.freeze({
  IDLE: 'idle',
  BUILD: 'build',
  DEPLOY: 'deploy',
});

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Session {
  /**
   * @param {object} opts
   * @param {number} opts.seed         deterministic seed
   * @param {object} opts.config       aggregated config (config.data.tables)
   * @param {function} [opts.dispatch] (command)=>void — pushes into world reducer / battle log
   */
  constructor(opts = {}) {
    this.config = opts.config || null;
    this.seed = (opts.seed | 0) || 1;

    // Interaction mode
    this.mode = Mode.IDLE;

    // Armed tool for placement.
    // For BUILD: { type:'structure', id:'TOWER_AG' | 'TOWER_AA' | 'WALL' | 'MOAT', def }
    // For DEPLOY: { type:'unit', id:'GND-Troops', def }
    this.selectedTool = null;

    // Currently selected existing structure entity (sim id) -> drives selectionPanel
    this.selectedEntityId = null;

    // Placement ghost preview
    this.ghost = {
      active: false,
      x: 0,
      y: 0,
      col: -1,
      row: -1,
      slotIndex: -1,
      valid: false,
      reason: '',
    };

    // Deploy march-line preview (base -> drop point)
    this.marchLine = { active: false, fromX: 0, fromY: 0, toX: 0, toY: 0, valid: false };

    // Pointer bookkeeping
    this.dragging = false;
    this.pointerDown = false;
    this.hover = { x: 0, y: 0, col: -1, row: -1 };

    // Loop control (read by src/loop.js)
    this.paused = false;
    this.speed = 1; // 1x .. clamped 0..4

    // Money snapshot cache for HUD delta animation (view-only)
    this.lastGold = 0;
    this.goldDelta = 0;

    // Game-over overlay latch (view-only; sim owns truth via world.result)
    this.overlay = null; // 'win' | 'lose' | null

    // Dispatch hook — set by main.js so session can issue sim commands.
    this._dispatch = typeof opts.dispatch === 'function' ? opts.dispatch : null;

    // Pub/sub
    this._listeners = new Set();
  }

  /* ---------------------------------------------------------------- wiring */

  setDispatch(fn) {
    this._dispatch = typeof fn === 'function' ? fn : null;
    return this;
  }

  /** Send a command into the sim (goes through world reducer + battle log). */
  dispatch(cmd) {
    if (this._dispatch) this._dispatch(cmd);
    return this;
  }

  /* --------------------------------------------------------- subscription */

  onChange(fn) {
    if (typeof fn === 'function') this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try {
        fn(this);
      } catch (e) {
        /* listeners must never break session */
        // eslint-disable-next-line no-console
        console.error('session listener error', e);
      }
    }
  }

  /* --------------------------------------------------------------- modes */

  setMode(mode) {
    if (this.mode === mode) return this;
    this.mode = mode;
    if (mode !== Mode.BUILD && mode !== Mode.DEPLOY) {
      this.clearTool();
    }
    this._emit();
    return this;
  }

  toIdle() {
    return this.setMode(Mode.IDLE);
  }

  /* --------------------------------------------------------------- tools */

  /**
   * Arm a build tool (structure) and switch to BUILD mode.
   * @param {string} id   structure id from config.data.tables.structures
   */
  selectBuildTool(id) {
    const def = this._structureDef(id);
    this.selectedTool = { type: 'structure', id, def };
    this.selectedEntityId = null; // deselect existing while placing
    this.mode = Mode.BUILD;
    this._resetGhost();
    this._emit();
    return this;
  }

  /**
   * Arm a deploy tool (unit) and switch to DEPLOY mode.
   * @param {string} id   unit id from config.data.tables.units
   */
  selectDeployTool(id) {
    const def = this._unitDef(id);
    this.selectedTool = { type: 'unit', id, def };
    this.selectedEntityId = null;
    this.mode = Mode.DEPLOY;
    this._resetGhost();
    this.marchLine.active = true;
    this._emit();
    return this;
  }

  clearTool() {
    this.selectedTool = null;
    this._resetGhost();
    this.marchLine.active = false;
    this._emit();
    return this;
  }

  /* --------------------------------------------------------- selection */

  /** Select an existing structure entity (opens selection panel). */
  selectEntity(entityId) {
    this.selectedEntityId = entityId != null ? entityId : null;
    // Selecting an existing entity cancels any armed placement.
    this.selectedTool = null;
    this.mode = Mode.IDLE;
    this._resetGhost();
    this._emit();
    return this;
  }

  deselect() {
    this.selectedEntityId = null;
    this._emit();
    return this;
  }

  /* ------------------------------------------------------------- ghost */

  _resetGhost() {
    this.ghost.active = false;
    this.ghost.valid = false;
    this.ghost.reason = '';
    this.ghost.col = -1;
    this.ghost.row = -1;
    this.ghost.slotIndex = -1;
  }

  /**
   * Update the placement ghost from a validity probe.
   * @param {object} probe { x, y, col, row, slotIndex, valid, reason }
   */
  updateGhost(probe) {
    if (!probe) {
      this._resetGhost();
      this._emit();
      return this;
    }
    const g = this.ghost;
    g.active = !!(this.selectedTool && (this.mode === Mode.BUILD || this.mode === Mode.DEPLOY));
    g.x = probe.x != null ? probe.x : g.x;
    g.y = probe.y != null ? probe.y : g.y;
    g.col = probe.col != null ? probe.col : g.col;
    g.row = probe.row != null ? probe.row : g.row;
    g.slotIndex = probe.slotIndex != null ? probe.slotIndex : g.slotIndex;
    g.valid = !!probe.valid;
    g.reason = probe.reason || '';
    this._emit();
    return this;
  }

  /** Update deploy march line preview endpoints. */
  updateMarchLine(fromX, fromY, toX, toY, valid) {
    const m = this.marchLine;
    m.active = this.mode === Mode.DEPLOY && !!this.selectedTool;
    m.fromX = fromX;
    m.fromY = fromY;
    m.toX = toX;
    m.toY = toY;
    m.valid = !!valid;
    this._emit();
    return this;
  }

  /* --------------------------------------------------------- pointer */

  updateHover(x, y, col, row) {
    this.hover.x = x;
    this.hover.y = y;
    if (col != null) this.hover.col = col;
    if (row != null) this.hover.row = row;
    // hover doesn't need a full emit; keep it cheap. Ghost updates emit.
    return this;
  }

  setPointerDown(down) {
    this.pointerDown = !!down;
    if (!down) this.dragging = false;
    return this;
  }

  setDragging(dragging) {
    this.dragging = !!dragging;
    return this;
  }

  /* ------------------------------------------------- loop control */

  togglePause() {
    this.paused = !this.paused;
    this._emit();
    return this;
  }

  setPaused(p) {
    this.paused = !!p;
    this._emit();
    return this;
  }

  cycleSpeed() {
    // 1 -> 2 -> 4 -> 1
    this.speed = this.speed >= 4 ? 1 : this.speed * 2;
    this._emit();
    return this;
  }

  setSpeed(s) {
    this.speed = clamp(s | 0, 0, 4) || 1;
    this._emit();
    return this;
  }

  /* --------------------------------------------------- HUD sync */

  /**
   * Called each frame with the current sim world to refresh view-only caches
   * (gold delta, game-over latch). NEVER mutates the world.
   */
  syncFromWorld(world) {
    if (!world) return this;

    const gold = world.economy ? world.economy.gold : 0;
    this.goldDelta = gold - this.lastGold;
    this.lastGold = gold;

    // Overlay latch from sim result (win on N waves, lose on base death)
    const result = world.result || (world.status && world.status.result) || null;
    if (result === 'win' || result === 'lose') {
      if (this.overlay !== result) {
        this.overlay = result;
        this.paused = true;
        this._emit();
      }
    }
    return this;
  }

  /* ---------------------------------------------------- lifecycle */

  /** Reset session for a fresh battle / replay with same or new seed. */
  reset(seed) {
    if (seed != null) this.seed = seed | 0;
    this.mode = Mode.IDLE;
    this.selectedTool = null;
    this.selectedEntityId = null;
    this._resetGhost();
    this.marchLine.active = false;
    this.dragging = false;
    this.pointerDown = false;
    this.paused = false;
    this.speed = 1;
    this.lastGold = 0;
    this.goldDelta = 0;
    this.overlay = null;
    this._emit();
    return this;
  }

  /* ---------------------------------------------------- helpers */

  isPlacing() {
    return (
      (this.mode === Mode.BUILD || this.mode === Mode.DEPLOY) && !!this.selectedTool
    );
  }

  _tables() {
    if (this.config && this.config.data && this.config.data.tables) {
      return this.config.data.tables;
    }
    if (this.config && this.config.tables) return this.config.tables;
    return this.config || {};
  }

  _structureDef(id) {
    const t = this._tables();
    const src = t.structures || {};
    if (Array.isArray(src)) return src.find((s) => s.id === id) || null;
    return src[id] || null;
  }

  _unitDef(id) {
    const t = this._tables();
    const src = t.units || {};
    if (Array.isArray(src)) return src.find((u) => u.id === id) || null;
    return src[id] || null;
  }
}

export function createSession(opts) {
  return new Session(opts);
}

export default Session;