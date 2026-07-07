// src/input/keyboard.js
// Keyboard shortcuts: start wave, camera rotate, upgrade/sell, pause.
// Reads intent from key presses and issues sim commands / view toggles.
// Presentation-only actions (camera rotate, pause) never touch replay-critical sim.

import { Commands } from '../sim/commands.js';

export class KeyboardInput {
  /**
   * @param {object} opts
   * @param {import('../sim/state.js').SimState} opts.state       - strict sim state
   * @param {object} opts.commands   - command dispatcher (applies + logs commands)
   * @param {object} opts.renderer   - root renderer (for camera rotation)
   * @param {object} opts.hud        - HUD root (selection panel, controls)
   * @param {object} opts.loop       - main loop controller (pause/resume)
   * @param {Window|HTMLElement} [opts.target] - event target (defaults to window)
   */
  constructor(opts) {
    this.state = opts.state;
    this.commands = opts.commands;
    this.renderer = opts.renderer || null;
    this.hud = opts.hud || null;
    this.loop = opts.loop || null;
    this.target = opts.target || window;

    this.enabled = true;
    this._down = new Set();

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);

    this.target.addEventListener('keydown', this._onKeyDown, { passive: false });
    this.target.addEventListener('keyup', this._onKeyUp, { passive: false });
  }

  destroy() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    this._down.clear();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) this._down.clear();
  }

  // ---- helpers ----------------------------------------------------------

  _isTextTarget(e) {
    const t = e.target;
    if (!t) return false;
    const tag = (t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable === true;
  }

  _selectedStructureId() {
    // The pointer/selection system stores the selected id on sim state.selection
    // (kept out of the replay hash; it is a UI concern mirrored onto state).
    const sel = this.state && this.state.selection;
    if (sel && sel.structureId != null) return sel.structureId;
    if (this.hud && typeof this.hud.getSelectedStructureId === 'function') {
      return this.hud.getSelectedStructureId();
    }
    return null;
  }

  _now() {
    // Deterministic time reference: use the sim tick, not wall clock.
    return this.state && this.state.tick != null ? this.state.tick : 0;
  }

  // ---- event handlers ---------------------------------------------------

  _handleKeyDown(e) {
    if (!this.enabled) return;
    if (this._isTextTarget(e)) return;

    const code = e.code || e.key;

    // ignore auto-repeat for one-shot actions
    const repeat = this._down.has(code);
    this._down.add(code);

    switch (code) {
      // ---- Start / advance wave ----
      case 'Enter':
      case 'NumpadEnter':
      case 'Space': {
        if (repeat) break;
        e.preventDefault();
        this._startWave();
        break;
      }

      // ---- Pause / resume (presentation + loop control only) ----
      case 'KeyP':
      case 'Pause': {
        if (repeat) break;
        e.preventDefault();
        this._togglePause();
        break;
      }

      // ---- Camera rotation (view only; re-runs depth sort + shadows) ----
      case 'KeyQ':
      case 'BracketLeft': {
        e.preventDefault();
        this._rotateCamera(-1);
        break;
      }
      case 'KeyE':
      case 'BracketRight': {
        e.preventDefault();
        this._rotateCamera(+1);
        break;
      }

      // ---- Upgrade selected structure ----
      case 'KeyU': {
        if (repeat) break;
        e.preventDefault();
        this._upgradeSelected();
        break;
      }

      // ---- Sell selected structure ----
      case 'KeyX':
      case 'Delete':
      case 'Backspace': {
        if (repeat) break;
        e.preventDefault();
        this._sellSelected();
        break;
      }

      // ---- Repair selected structure ----
      case 'KeyR': {
        if (repeat) break;
        e.preventDefault();
        this._repairSelected();
        break;
      }

      // ---- Deselect / cancel ----
      case 'Escape': {
        if (repeat) break;
        e.preventDefault();
        this._cancel();
        break;
      }

      default:
        break;
    }
  }

  _handleKeyUp(e) {
    const code = e.code || e.key;
    this._down.delete(code);
  }

  // ---- actions ----------------------------------------------------------

  _startWave() {
    if (!this.commands) return;
    // startWave is a real sim command (logged, deterministic).
    this.commands.apply({
      type: Commands.START_WAVE,
      tick: this._now(),
    });
  }

  _togglePause() {
    // Pause is purely a loop/presentation concern — it does NOT alter the
    // deterministic sim ordering when resumed, so it is not a logged command.
    if (this.loop && typeof this.loop.togglePause === 'function') {
      this.loop.togglePause();
    } else if (this.loop) {
      this.loop.paused = !this.loop.paused;
    }
    if (this.hud && typeof this.hud.setPaused === 'function') {
      this.hud.setPaused(this.loop ? !!this.loop.paused : false);
    }
  }

  _rotateCamera(dir) {
    // Camera rotation is view-only. Renderer re-runs depth sort + shadow
    // reprojection against the fixed sun. Never affects replay.
    if (!this.renderer) return;
    if (typeof this.renderer.rotateCamera === 'function') {
      this.renderer.rotateCamera(dir);
    } else if (this.renderer.camera && typeof this.renderer.camera.rotate === 'function') {
      this.renderer.camera.rotate(dir);
    }
  }

  _upgradeSelected() {
    const id = this._selectedStructureId();
    if (id == null || !this.commands) return;
    this.commands.apply({
      type: Commands.UPGRADE,
      structureId: id,
      tick: this._now(),
    });
  }

  _sellSelected() {
    const id = this._selectedStructureId();
    if (id == null || !this.commands) return;
    this.commands.apply({
      type: Commands.SELL,
      structureId: id,
      tick: this._now(),
    });
    // After selling, drop the selection reference in the UI mirror.
    if (this.state && this.state.selection) this.state.selection.structureId = null;
    if (this.hud && typeof this.hud.clearSelection === 'function') this.hud.clearSelection();
  }

  _repairSelected() {
    const id = this._selectedStructureId();
    if (id == null || !this.commands) return;
    this.commands.apply({
      type: Commands.REPAIR,
      structureId: id,
      tick: this._now(),
    });
  }

  _cancel() {
    // Cancel placement / deselect. Placement cancel is a UI concern handled
    // via pointer/placement modules; deselect clears the UI mirror.
    if (this.state && this.state.selection) this.state.selection.structureId = null;
    if (this.hud && typeof this.hud.clearSelection === 'function') this.hud.clearSelection();
    if (this.renderer && typeof this.renderer.clearPlacementGhost === 'function') {
      this.renderer.clearPlacementGhost();
    }
  }
}

export function installKeyboard(opts) {
  return new KeyboardInput(opts);
}

export default KeyboardInput;