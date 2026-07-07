Placement preview and validity computation. Reads sim state, never mutates it. Produces a preview object the renderer draws (ghost + valid/invalid tint + range circle + march line).

```javascript
// src/input/placement.js
// Placement preview state + valid/invalid tint via deploy validity check.
// Reads sim state (never mutates). Consumed by pointer.js and the renderer.

import { CONSTANTS } from '../config/constants.js';
import { checkDeployValidity } from '../sim/spawn.js';

const TINT_VALID = 0x33ff66;
const TINT_INVALID = 0xff3344;

// Placement modes
export const MODE_STRUCTURE = 'structure';
export const MODE_DEPLOY = 'deploy';

/**
 * Placement preview state container.
 * Holds the current tool (structure def or unit def), mode, hovered world point,
 * snapped slot (for structures), and computed validity.
 */
export class PlacementPreview {
  constructor(sim) {
    this.sim = sim;
    this.active = false;
    this.mode = null;        // MODE_STRUCTURE | MODE_DEPLOY
    this.def = null;         // structure def or unit def (data table row)
    this.hoverX = 0;         // world coords
    this.hoverY = 0;
    this.snapX = 0;          // snapped placement coords
    this.snapY = 0;
    this.slotIndex = -1;     // slot the ghost snaps to (structures)
    this.valid = false;
    this.reason = '';        // why invalid
    this.tint = TINT_INVALID;
  }

  /** Begin placing a structure. def is a row from tables.structures. */
  beginStructure(def) {
    this.active = true;
    this.mode = MODE_STRUCTURE;
    this.def = def;
    this.slotIndex = -1;
    this.valid = false;
    this.reason = 'no-slot';
    this.tint = TINT_INVALID;
  }

  /** Begin deploying a unit. def is a row from tables.units. */
  beginDeploy(def) {
    this.active = true;
    this.mode = MODE_DEPLOY;
    this.def = def;
    this.slotIndex = -1;
    this.valid = false;
    this.reason = 'no-point';
    this.tint = TINT_INVALID;
  }

  /** Cancel / clear the current preview. */
  clear() {
    this.active = false;
    this.mode = null;
    this.def = null;
    this.slotIndex = -1;
    this.valid = false;
    this.reason = '';
    this.tint = TINT_INVALID;
  }

  /**
   * Update the hovered world position and recompute validity.
   * Pure read of sim state; returns nothing (mutates only this preview object).
   */
  update(worldX, worldY) {
    if (!this.active || !this.def) return;
    this.hoverX = worldX;
    this.hoverY = worldY;

    if (this.mode === MODE_STRUCTURE) {
      this._updateStructure(worldX, worldY);
    } else if (this.mode === MODE_DEPLOY) {
      this._updateDeploy(worldX, worldY);
    }

    this.tint = this.valid ? TINT_VALID : TINT_INVALID;
  }

  _updateStructure(worldX, worldY) {
    const state = this.sim.state;
    const slots = state.slots || [];

    // Snap to nearest free, unlocked slot within snap radius.
    const snapR = CONSTANTS.SLOT_SNAP_RADIUS != null
      ? CONSTANTS.SLOT_SNAP_RADIUS
      : CONSTANTS.TILE * 1.5;

    let best = -1;
    let bestD2 = snapR * snapR;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const dx = s.x - worldX;
      const dy = s.y - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = i;
      }
    }

    this.slotIndex = best;

    if (best < 0) {
      this.snapX = worldX;
      this.snapY = worldY;
      this.valid = false;
      this.reason = 'no-slot';
      return;
    }

    const slot = slots[best];
    this.snapX = slot.x;
    this.snapY = slot.y;

    const v = this._checkStructureSlot(slot, best);
    this.valid = v.ok;
    this.reason = v.reason;
  }

  /**
   * Deploy-validity check for a structure at a given slot:
   * requires unlocked slot, free space, and sufficient cost.
   */
  _checkStructureSlot(slot, index) {
    const state = this.sim.state;

    // Slot must exist / be unlocked (slot count scales with base level).
    const unlocked = slot.locked !== true &&
      (state.slotCount == null || index < state.slotCount);
    if (!unlocked) return { ok: false, reason: 'slot-locked' };

    // Slot must be empty (no live structure occupying it).
    if (slot.occupied || slot.entityId != null) {
      return { ok: false, reason: 'occupied' };
    }
    // Double-check against entities in case slot metadata is stale.
    const ents = state.entities || [];
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.dead) continue;
      if (e.slotIndex === index && this._isStructure(e)) {
        return { ok: false, reason: 'occupied' };
      }
    }

    // Cost check against live economy.
    const cost = this._structureCost(this.def);
    const money = state.economy ? state.economy.money : 0;
    if (money < cost) return { ok: false, reason: 'cost' };

    return { ok: true, reason: '' };
  }

  _isStructure(e) {
    return e.kind === 'tower' || e.kind === 'wall' || e.kind === 'moat' ||
      e.category === 'structure';
  }

  _structureCost(def) {
    if (def == null) return 0;
    // Tier-1 build cost from the data row.
    if (def.CostT1 != null) return def.CostT1;
    if (def.cost != null) return def.cost;
    if (def.Cost != null) return def.Cost;
    return 0;
  }

  _updateDeploy(worldX, worldY) {
    const state = this.sim.state;
    this.snapX = worldX;
    this.snapY = worldY;

    // Use the shared headless deploy validity check (same code path as sim).
    const cost = this._unitCost(this.def);
    const money = state.economy ? state.economy.money : 0;

    let res;
    try {
      res = checkDeployValidity(state, this.def, worldX, worldY);
    } catch (err) {
      res = null;
    }

    if (res == null) {
      // Fallback local check if spawn module didn't provide a checker.
      res = this._fallbackDeployCheck(state, this.def, worldX, worldY);
    }

    let ok = res.ok;
    let reason = res.reason || '';

    // Cost gate (economy) — always enforced here for HUD tinting.
    if (ok && money < cost) {
      ok = false;
      reason = 'cost';
    }

    this.valid = ok;
    this.reason = reason;
  }

  _unitCost(def) {
    if (def == null) return 0;
    if (def.CostT1 != null) return def.CostT1;
    if (def.cost != null) return def.cost;
    if (def.Cost != null) return def.Cost;
    return 0;
  }

  /**
   * Minimal terrain/space validity fallback:
   * - drop point must be inside the board bounds
   * - walker/floater drop must be on a valid lane band; flyer allowed anywhere
   */
  _fallbackDeployCheck(state, def, x, y) {
    const board = state.board;
    if (board) {
      if (x < board.minX || x > board.maxX || y < board.minY || y > board.maxY) {
        return { ok: false, reason: 'out-of-bounds' };
      }
    }
    const domain = def ? (def.Domain || def.domain) : null;
    if (board && domain) {
      if (domain === 'Walker' || domain === 'walker') {
        if (typeof board.isGround === 'function' && !board.isGround(x, y)) {
          return { ok: false, reason: 'terrain' };
        }
      } else if (domain === 'Floater' || domain === 'floater' ||
                 domain === 'Swimmer' || domain === 'swimmer') {
        if (typeof board.isWater === 'function' && !board.isWater(x, y)) {
          return { ok: false, reason: 'terrain' };
        }
      }
      // Flyer: no terrain restriction.
    }
    return { ok: true, reason: '' };
  }

  /**
   * Range radius for the current structure def (for ghost range circle).
   * Returns world-units; 0 if none.
   */
  rangeRadius() {
    if (this.mode !== MODE_STRUCTURE || !this.def) return 0;
    const r = this.def.Range != null ? this.def.Range
      : (this.def.range != null ? this.def.range : 0);
    return r * CONSTANTS.TILE;
  }

  /**
   * March line endpoints for deploy preview: from base to the drop point.
   * Returns null when not deploying.
   */
  marchLine() {
    if (this.mode !== MODE_DEPLOY || !this.active) return null;
    const state = this.sim.state;
    const base = state.base;
    if (!base) return null;
    return {
      x1: base.x, y1: base.y,
      x2: this.snapX, y2: this.snapY,
      valid: this.valid,
    };
  }

  /** Serializable snapshot for the renderer (read-only). */
  snapshot() {
    if (!this.active) return null;
    return {
      active: true,
      mode: this.mode,
      def: this.def,
      x: this.snapX,
      y: this.snapY,
      slotIndex: this.slotIndex,
      valid: this.valid,
      reason: this.reason,
      tint: this.tint,
      range: this.rangeRadius(),
      march: this.marchLine(),
    };
  }
}

export const PLACEMENT_TINT = { VALID: TINT_VALID, INVALID: TINT_INVALID };

export default PlacementPreview;