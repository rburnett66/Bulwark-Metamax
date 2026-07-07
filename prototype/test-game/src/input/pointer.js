// src/input/pointer.js
// Single-pointer mouse/touch handling: hover ghost, drag-place, drop/cancel, select.
// Reads sim state and issues commands. Identical handling for mouse & touch (single pointer).

import { CONSTANTS } from '../config/constants.js';

export class PointerInput {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas - the pixi view canvas
   * @param {object} opts.app - pixi application (for renderer resolution)
   * @param {object} opts.sim - the sim (state + commands entry)
   * @param {object} opts.state - sim state container
   * @param {object} opts.placement - placement preview controller (src/input/placement.js)
   * @param {object} opts.commands - command dispatcher (src/sim/commands.js)
   * @param {object} opts.hud - HUD root (for selection panel + build panel)
   * @param {object} opts.board - board geometry helpers
   */
  constructor(opts) {
    this.canvas = opts.canvas;
    this.app = opts.app;
    this.sim = opts.sim;
    this.state = opts.state;
    this.placement = opts.placement;
    this.commands = opts.commands;
    this.hud = opts.hud;
    this.board = opts.board;

    // Pointer state
    this.active = false;       // pointer currently down
    this.dragging = false;     // in a drag-place session
    this.worldX = 0;
    this.worldY = 0;
    this.screenX = 0;
    this.screenY = 0;
    this.downX = 0;
    this.downY = 0;
    this.dragThreshold = 6; // px to distinguish tap vs drag

    // Placement mode: when a build item is chosen from build panel.
    // placement.js holds the pending def; here we only route pointer.
    this._boundDown = this._onPointerDown.bind(this);
    this._boundMove = this._onPointerMove.bind(this);
    this._boundUp = this._onPointerUp.bind(this);
    this._boundLeave = this._onPointerLeave.bind(this);
    this._boundContext = (e) => e.preventDefault();

    this._attach();
  }

  _attach() {
    const c = this.canvas;
    // Pointer events unify mouse + touch + pen (single pointer).
    c.addEventListener('pointerdown', this._boundDown, { passive: false });
    window.addEventListener('pointermove', this._boundMove, { passive: false });
    window.addEventListener('pointerup', this._boundUp, { passive: false });
    c.addEventListener('pointerleave', this._boundLeave, { passive: false });
    c.addEventListener('contextmenu', this._boundContext);
    // Prevent scroll/zoom gestures interfering on touch
    c.style.touchAction = 'none';
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._boundDown);
    window.removeEventListener('pointermove', this._boundMove);
    window.removeEventListener('pointerup', this._boundUp);
    c.removeEventListener('pointerleave', this._boundLeave);
    c.removeEventListener('contextmenu', this._boundContext);
  }

  // ---- coordinate conversion (screen px -> world/board coords) ----
  _toLocal(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width) /
      (this.app && this.app.renderer ? this.app.renderer.resolution : 1);
    const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height) /
      (this.app && this.app.renderer ? this.app.renderer.resolution : 1);
    this.screenX = sx;
    this.screenY = sy;

    // Convert screen -> world through the render root container transform.
    // Renderer exposes a `worldContainer` we can use for inverse mapping.
    let wx = sx, wy = sy;
    if (this.sim && this.sim.renderer && this.sim.renderer.worldContainer) {
      const wc = this.sim.renderer.worldContainer;
      const p = wc.toLocal({ x: sx, y: sy });
      wx = p.x;
      wy = p.y;
    } else if (this.board && this.board.screenToWorld) {
      const p = this.board.screenToWorld(sx, sy);
      wx = p.x; wy = p.y;
    }
    this.worldX = wx;
    this.worldY = wy;
    return { sx, sy, wx, wy };
  }

  _onPointerDown(e) {
    e.preventDefault();
    this.active = true;
    const { sx, sy } = this._toLocal(e);
    this.downX = sx;
    this.downY = sy;
    this.dragging = false;

    // Right-click / secondary cancels placement.
    if (e.button === 2) {
      this._cancelPlacement();
      return;
    }

    // If placement mode active (a build item was chosen), begin drag-place.
    if (this.placement && this.placement.isPending()) {
      this.dragging = true;
      this.placement.updatePreview(this.worldX, this.worldY);
    }
  }

  _onPointerMove(e) {
    // Only meaningful once we have coordinates; always update hover for ghost.
    e.preventDefault && e.preventDefault();
    this._toLocal(e);

    // Determine drag start (screen distance beyond threshold)
    if (this.active) {
      const dx = this.screenX - this.downX;
      const dy = this.screenY - this.downY;
      if (Math.hypot(dx, dy) > this.dragThreshold) {
        this.dragging = true;
      }
    }

    // Update placement ghost preview when placement is pending.
    if (this.placement && this.placement.isPending()) {
      this.placement.updatePreview(this.worldX, this.worldY);
    }
  }

  _onPointerUp(e) {
    e.preventDefault && e.preventDefault();
    if (!this.active) return;
    this._toLocal(e);
    const wasDragging = this.dragging;
    this.active = false;
    this.dragging = false;

    if (e.button === 2) {
      // secondary already handled on down
      return;
    }

    // Placement pending -> attempt to drop.
    if (this.placement && this.placement.isPending()) {
      this._tryDrop();
      return;
    }

    // Otherwise it's a select action (tap or short click).
    // If it was a drag with no placement, treat as pan-less nop; still allow select on tap.
    if (!wasDragging) {
      this._trySelect();
    } else {
      // A drag with nothing pending: clear selection if released on empty ground.
      const hit = this._hitTest(this.worldX, this.worldY);
      if (!hit) this._clearSelection();
    }
  }

  _onPointerLeave() {
    // Cancel an in-progress hover ghost only visually; keep placement pending
    // so the item is still selected, but hide the preview.
    if (this.placement && this.placement.isPending()) {
      this.placement.hidePreview();
    }
  }

  // ---- placement flow ----
  _tryDrop() {
    const def = this.placement.getPending();
    if (!def) { this._cancelPlacement(); return; }

    // Recompute validity at drop point (space/terrain/cost via deploy check).
    const preview = this.placement.updatePreview(this.worldX, this.worldY);
    if (!preview || !preview.valid) {
      // Invalid drop — keep placement mode so player can retry, but flash invalid.
      this.placement.flashInvalid();
      return;
    }

    // Snap to slot if structure requires a hard-point slot.
    const slotIndex = (preview.slotIndex !== undefined && preview.slotIndex !== null)
      ? preview.slotIndex : -1;

    if (def.category === 'unit' || def.deploy) {
      // Deploy troop: spawn at base, march to drop destination.
      this.commands.dispatch({
        type: 'deploy',
        unitId: def.id,
        x: preview.x,
        y: preview.y,
        tick: this.state.tick,
      });
    } else {
      // Place a structure (tower/wall/moat).
      this.commands.dispatch({
        type: 'place',
        structureId: def.id,
        x: preview.x,
        y: preview.y,
        slot: slotIndex,
        tick: this.state.tick,
      });
    }

    // End placement mode after a successful drop.
    this.placement.clear();
    if (this.hud && this.hud.buildPanel && this.hud.buildPanel.clearSelection) {
      this.hud.buildPanel.clearSelection();
    }
  }

  _cancelPlacement() {
    if (this.placement && this.placement.isPending()) {
      this.placement.clear();
      if (this.hud && this.hud.buildPanel && this.hud.buildPanel.clearSelection) {
        this.hud.buildPanel.clearSelection();
      }
    }
  }

  // Called by build panel when user picks an item from the list.
  beginPlacement(def) {
    // Clear any current selection when starting to place.
    this._clearSelection();
    this.placement.begin(def);
    this.placement.updatePreview(this.worldX, this.worldY);
  }

  // ---- selection flow ----
  _trySelect() {
    const hit = this._hitTest(this.worldX, this.worldY);
    if (hit) {
      this._select(hit);
    } else {
      this._clearSelection();
    }
  }

  _hitTest(wx, wy) {
    // Prefer structures (larger targets), then units. Nearest within radius.
    const ents = this.state.entities;
    let best = null;
    let bestD = Infinity;

    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.dead) continue;
      // Only allow selecting player-owned structures for the panel.
      const isStruct = (e.type === 'tower' || e.type === 'wall' || e.type === 'moat');
      const isBase = (e.type === 'base');
      if (!isStruct && !isBase) continue;
      const r = (e.footprint ? e.footprint.r : (e.radius || CONSTANTS.TILE * 0.5)) + 4;
      const dx = e.x - wx;
      const dy = e.y - wy;
      const d = Math.hypot(dx, dy);
      if (d <= r && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  _select(entity) {
    this.state.selection = entity.id;
    // Fire the select command so it's recorded in the battle log for replay.
    this.commands.dispatch({
      type: 'select',
      entityId: entity.id,
      tick: this.state.tick,
    });
    if (this.hud && this.hud.selectionPanel && this.hud.selectionPanel.show) {
      this.hud.selectionPanel.show(entity);
    }
  }

  _clearSelection() {
    if (this.state.selection != null) {
      this.state.selection = null;
      this.commands.dispatch({
        type: 'select',
        entityId: null,
        tick: this.state.tick,
      });
    }
    if (this.hud && this.hud.selectionPanel && this.hud.selectionPanel.hide) {
      this.hud.selectionPanel.hide();
    }
  }
}

export default PointerInput;