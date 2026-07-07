// src/input/pointer.js
// Single-pointer mouse/touch handling for select / place / drag.
// Normalizes mouse + touch into ONE pointer stream, converts screen coords
// into board-space (world) coords via the renderer, and emits high-level
// intents to a subscriber (typically src/input/controller.js).
//
// This module NEVER mutates sim state. It only reads pointer position and
// dispatches semantic events; the controller maps those to sim commands.

export const PointerEventType = Object.freeze({
  DOWN: 'down',
  MOVE: 'move',
  UP: 'up',
  TAP: 'tap',
  DRAG_START: 'dragStart',
  DRAG_MOVE: 'dragMove',
  DRAG_END: 'dragEnd',
  CANCEL: 'cancel',
});

const DRAG_THRESHOLD_PX = 6;   // screen px before a press becomes a drag
const TAP_MAX_MS = 400;        // max press duration still counts as a tap

/**
 * PointerInput
 *  - Attaches to a DOM element (the canvas).
 *  - Supports a single active pointer (first finger / left mouse button).
 *  - Provides world-space coords through a supplied projector.
 *
 * @param {Object} opts
 * @param {HTMLCanvasElement|HTMLElement} opts.element  DOM element to listen on.
 * @param {Function} [opts.screenToWorld]  (sx, sy) => {x, y} board coords.
 *                                          Defaults to identity if omitted.
 */
export class PointerInput {
  constructor(opts = {}) {
    if (!opts.element) {
      throw new Error('PointerInput requires an element');
    }
    this.element = opts.element;
    this.screenToWorld =
      typeof opts.screenToWorld === 'function'
        ? opts.screenToWorld
        : (sx, sy) => ({ x: sx, y: sy });

    // subscribers: fn(evt)
    this._listeners = new Set();

    // active pointer state
    this._active = false;
    this._pointerId = null;
    this._isTouch = false;
    this._dragging = false;
    this._downTime = 0;
    this._downScreen = { x: 0, y: 0 };
    this._lastScreen = { x: 0, y: 0 };
    this._downWorld = { x: 0, y: 0 };
    this._lastWorld = { x: 0, y: 0 };

    // bound handlers (so we can remove them)
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onTouchCancel = this._handleTouchCancel.bind(this);
    this._onContextMenu = this._handleContextMenu.bind(this);

    this._attach();
  }

  // ---- public API -------------------------------------------------------

  /** Subscribe to pointer intents. Returns unsubscribe fn. */
  on(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  off(fn) {
    this._listeners.delete(fn);
  }

  /** Current world position of the pointer (last seen). */
  getWorldPosition() {
    return { x: this._lastWorld.x, y: this._lastWorld.y };
  }

  /** Whether a pointer is currently pressed. */
  isDown() {
    return this._active;
  }

  /** Whether the active pointer has crossed the drag threshold. */
  isDragging() {
    return this._dragging;
  }

  /** Cancel any in-flight interaction (e.g. on mode switch / pause). */
  cancel() {
    if (this._active) {
      this._emit(PointerEventType.CANCEL, this._makeEvt());
    }
    this._reset();
  }

  destroy() {
    this._detach();
    this._listeners.clear();
    this._reset();
  }

  // ---- attach / detach --------------------------------------------------

  _attach() {
    const el = this.element;
    el.addEventListener('mousedown', this._onMouseDown, { passive: false });
    // move/up on window so drags that leave the canvas still track
    window.addEventListener('mousemove', this._onMouseMove, { passive: false });
    window.addEventListener('mouseup', this._onMouseUp, { passive: false });

    el.addEventListener('touchstart', this._onTouchStart, { passive: false });
    el.addEventListener('touchmove', this._onTouchMove, { passive: false });
    el.addEventListener('touchend', this._onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', this._onTouchCancel, { passive: false });

    el.addEventListener('contextmenu', this._onContextMenu);
  }

  _detach() {
    const el = this.element;
    el.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);

    el.removeEventListener('touchstart', this._onTouchStart);
    el.removeEventListener('touchmove', this._onTouchMove);
    el.removeEventListener('touchend', this._onTouchEnd);
    el.removeEventListener('touchcancel', this._onTouchCancel);

    el.removeEventListener('contextmenu', this._onContextMenu);
  }

  // ---- coordinate helpers ----------------------------------------------

  _screenFromClient(clientX, clientY) {
    const rect = this.element.getBoundingClientRect();
    // account for CSS scaling of the canvas element
    const scaleX = this.element.width
      ? this.element.width / rect.width
      : 1;
    const scaleY = this.element.height
      ? this.element.height / rect.height
      : 1;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ---- mouse ------------------------------------------------------------

  _handleMouseDown(e) {
    if (e.button !== 0) {
      // right/middle button: treat as cancel gesture
      if (this._active) {
        this._emit(PointerEventType.CANCEL, this._makeEvt());
        this._reset();
      }
      return;
    }
    if (this._active) return; // single pointer only
    e.preventDefault();
    const s = this._screenFromClient(e.clientX, e.clientY);
    this._begin(s, false, 'mouse');
  }

  _handleMouseMove(e) {
    if (!this._active || this._isTouch) return;
    const s = this._screenFromClient(e.clientX, e.clientY);
    this._move(s);
  }

  _handleMouseUp(e) {
    if (!this._active || this._isTouch) return;
    if (e.button !== 0) return;
    const s = this._screenFromClient(e.clientX, e.clientY);
    this._end(s);
  }

  _handleContextMenu(e) {
    // suppress browser menu so right-click can be used as cancel
    e.preventDefault();
  }

  // ---- touch ------------------------------------------------------------

  _handleTouchStart(e) {
    if (this._active) {
      // additional finger while dragging -> cancel (single pointer model)
      e.preventDefault();
      this._emit(PointerEventType.CANCEL, this._makeEvt());
      this._reset();
      return;
    }
    const t = e.changedTouches[0];
    if (!t) return;
    e.preventDefault();
    const s = this._screenFromClient(t.clientX, t.clientY);
    this._pointerId = t.identifier;
    this._begin(s, true, 'touch');
  }

  _handleTouchMove(e) {
    if (!this._active || !this._isTouch) return;
    const t = this._findTouch(e.changedTouches);
    if (!t) return;
    e.preventDefault();
    const s = this._screenFromClient(t.clientX, t.clientY);
    this._move(s);
  }

  _handleTouchEnd(e) {
    if (!this._active || !this._isTouch) return;
    const t = this._findTouch(e.changedTouches);
    if (!t) return;
    e.preventDefault();
    const s = this._screenFromClient(t.clientX, t.clientY);
    this._end(s);
  }

  _handleTouchCancel(e) {
    if (!this._active || !this._isTouch) return;
    e.preventDefault();
    this._emit(PointerEventType.CANCEL, this._makeEvt());
    this._reset();
  }

  _findTouch(list) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === this._pointerId) return list[i];
    }
    return null;
  }

  // ---- core state machine ----------------------------------------------

  _begin(screen, isTouch, kind) {
    this._active = true;
    this._isTouch = isTouch;
    this._dragging = false;
    this._downTime = (typeof performance !== 'undefined')
      ? performance.now()
      : Date.now();
    this._downScreen = { x: screen.x, y: screen.y };
    this._lastScreen = { x: screen.x, y: screen.y };
    const w = this.screenToWorld(screen.x, screen.y);
    this._downWorld = { x: w.x, y: w.y };
    this._lastWorld = { x: w.x, y: w.y };

    this._emit(PointerEventType.DOWN, this._makeEvt());
  }

  _move(screen) {
    this._lastScreen = { x: screen.x, y: screen.y };
    const w = this.screenToWorld(screen.x, screen.y);
    this._lastWorld = { x: w.x, y: w.y };

    const dx = screen.x - this._downScreen.x;
    const dy = screen.y - this._downScreen.y;
    const distSq = dx * dx + dy * dy;

    if (!this._dragging && distSq >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      this._dragging = true;
      this._emit(PointerEventType.DRAG_START, this._makeEvt());
    }

    this._emit(PointerEventType.MOVE, this._makeEvt());
    if (this._dragging) {
      this._emit(PointerEventType.DRAG_MOVE, this._makeEvt());
    }
  }

  _end(screen) {
    this._lastScreen = { x: screen.x, y: screen.y };
    const w = this.screenToWorld(screen.x, screen.y);
    this._lastWorld = { x: w.x, y: w.y };

    const now = (typeof performance !== 'undefined')
      ? performance.now()
      : Date.now();
    const elapsed = now - this._downTime;

    const evt = this._makeEvt();

    if (this._dragging) {
      this._emit(PointerEventType.DRAG_END, evt);
    } else if (elapsed <= TAP_MAX_MS) {
      // quick press without significant movement = tap (select/place)
      this._emit(PointerEventType.TAP, evt);
    }

    this._emit(PointerEventType.UP, evt);
    this._reset();
  }

  _reset() {
    this._active = false;
    this._dragging = false;
    this._pointerId = null;
    this._isTouch = false;
  }

  // ---- event construction / dispatch -----------------------------------

  _makeEvt() {
    return {
      // world (board) coordinates — what the sim / controller cares about
      world: { x: this._lastWorld.x, y: this._lastWorld.y },
      worldStart: { x: this._downWorld.x, y: this._downWorld.y },
      // raw screen coordinates — useful for HUD hit-testing
      screen: { x: this._lastScreen.x, y: this._lastScreen.y },
      screenStart: { x: this._downScreen.x, y: this._downScreen.y },
      dragging: this._dragging,
      isTouch: this._isTouch,
    };
  }

  _emit(type, evt) {
    const out = { type, ...evt };
    for (const fn of this._listeners) {
      try {
        fn(out);
      } catch (err) {
        // isolate listener failures so one bad subscriber can't break input
        // eslint-disable-next-line no-console
        console.error('PointerInput listener error:', err);
      }
    }
  }
}

export default PointerInput;