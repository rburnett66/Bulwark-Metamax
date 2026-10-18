import { STRUCTURES } from '../data/tables.js';
import { validatePlacement } from '../sim/structures.js';
import { screenToCell } from '../render/renderer.js';

// Number keys map onto the BUILD PALETTE order (hud.js structOrder) so each key matches its button badge:
// 1 Cannon, 2 Flak, 3 Wall, 4 Mine, 5 Rockets, 6 Missile. The Harvestor is bought at the base, not placed.
const BUILD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function createUiState() {
  return {
    buildSelection: null,
    hoverCell: null,
    hoverValid: false,
    selectedStructureId: null,
    selectedUnitId: null,      // s5: a selected unit (enemy/defender) whose attack range is shown
    showFieldRings: false,     // white rings on the harvester's assigned field — debug aid, off by default
    pendingHint: null,         // {text, atBase} — set by input, consumed + flashed by the main ticker
    placingPointer: null,      // touch placement: the finger steering the build slot (the camera won't pan with it)
  };
}

function buildOrder() {
  // Deterministic ordered list of structure ids for the number-key shortcuts — the SAME filter as the
  // HUD palette (hud.js structOrder), so key N always selects the button badged N.
  return Object.keys(STRUCTURES).filter((id) => STRUCTURES[id].kind !== 'harvestorBay');
}

function findUnitAtCell(state, cell) {
  // s5: pick the live unit whose BODY the click landed on. The pick radius scales with the unit's
  // footprint (sprites draw at radius × 4/3) — a flat 0.7 only caught dead-center clicks on big
  // units like the harvester trucks ("I can only select one harvester"). Nearest-by-coverage wins.
  if (!state || !state.units || !cell) return null;
  let bestId = null;
  let bestScore = 1;   // d / pickRadius — <1 means the click is on the body
  for (const u of state.units.values()) {
    if (!u || u.hp <= 0) continue;
    const d = Math.hypot(u.pos.x - cell.x, u.pos.y - cell.y);
    // Harvesters are the most-tapped unit in the game (order flow is click-truck-click-field) and
    // taps come from phones — give them a big grab zone; it also wins ties vs nearby enemies.
    let pick = Math.max(0.7, (u.radius || 0.3) * 1.35);
    if (u.isHarvester) pick = Math.max(1.5, pick * 2);
    const score = d / pick;
    if (score < bestScore) { bestScore = score; bestId = u.id; }
  }
  return bestId;
}

function cellInBase(state, cell) {
  if (!state || !state.base) return false;
  const cells = state.base.cells || [state.base.pos];
  return cells.some((c) => c.x === cell.x && c.y === cell.y);
}

function findStructureAtCell(state, cell) {
  if (!state || !state.structures || !cell) return null;
  let found = null;
  for (const s of state.structures.values()) {
    if (!s || s.lifecycle === 'Destroyed') continue;
    const fp = s.footprint || { w: 1, h: 1 };
    const x0 = s.pos.x;
    const y0 = s.pos.y;
    if (
      cell.x >= x0 &&
      cell.x < x0 + (fp.w || 1) &&
      cell.y >= y0 &&
      cell.y < y0 + (fp.h || 1)
    ) {
      if (found === null || s.id < found.id) found = s;
    }
  }
  return found ? found.id : null;
}

function refreshHoverValidity(handle) {
  const { ui, getState } = handle;
  if (!ui.buildSelection || !ui.hoverCell) {
    ui.hoverValid = false;
    return;
  }
  const state = getState();
  if (!state) {
    ui.hoverValid = false;
    return;
  }
  try {
    const res = validatePlacement(state, ui.buildSelection, ui.hoverCell);
    ui.hoverValid = !!(res && res.ok);
  } catch (err) {
    ui.hoverValid = false;
  }
}

function pointerEventToCell(handle, ev) {
  if (handle.pick) return handle.pick(ev, handle.ui);   // ?renderer=three: ray-picked through the 3D camera
  const rect = handle.canvas.getBoundingClientRect();
  // Map into LOGICAL board pixels (cols×tile), never canvas.width: with native-DPI rendering
  // (resolution × autoDensity) canvas.width is the PHYSICAL buffer — dividing by it scaled every
  // click by the device pixel ratio ("the mouse is not on top of the cursor").
  const logicalW = handle.renderer.map.cols * handle.renderer.tile;
  const logicalH = handle.renderer.map.rows * handle.renderer.tile;
  const scaleX = rect.width > 0 ? logicalW / rect.width : 1;
  const scaleY = rect.height > 0 ? logicalH / rect.height : 1;
  const sx = (ev.clientX - rect.left) * scaleX;
  const sy = (ev.clientY - rect.top) * scaleY;
  return screenToCell(handle.renderer, sx, sy);
}

function onPointerMove(handle, ev) {
  const cell = pointerEventToCell(handle, ev);
  if (!cell) {
    handle.ui.hoverCell = null;
    handle.ui.hoverValid = false;
    return;
  }
  handle.ui.hoverCell = { x: cell.x, y: cell.y };
  refreshHoverValidity(handle);
}

function onPointerLeave(handle) {
  handle.ui.hoverCell = null;
  handle.ui.hoverValid = false;
}

function onPointerDown(handle, ev) {
  if (ev.button !== undefined && ev.button !== 0) {
    // Right / middle click cancels build selection.
    if (handle.ui.buildSelection) {
      handle.ui.buildSelection = null;
      handle.ui.hoverValid = false;
      ev.preventDefault();
    }
    return;
  }
  const cell = pointerEventToCell(handle, ev);
  if (!cell) return;
  handle.ui.hoverCell = { x: cell.x, y: cell.y };
  const ui = handle.ui;
  const state = handle.getState();

  if (ui.buildSelection) {
    // SUBJECT beats TOOL (owner): clicking an already-BUILT structure while a build tool is armed
    // re-focuses onto that structure — select it and drop the tool — instead of a dead 'occupied'
    // placement attempt. Empty cells still place as before.
    const hit = findStructureAtCell(state, cell);
    if (hit !== null) {
      ui.buildSelection = null;
      ui.hoverValid = false;
      ui.selectedStructureId = hit;
      ui.selectedUnitId = null;
      return;
    }
    // Attempt placement via command; sim validates authoritatively.
    const result = handle.submit({
      type: 'place',
      structId: ui.buildSelection,
      cell: { x: cell.x, y: cell.y },
      slot: { x: cell.x, y: cell.y },
    });
    if (result && result.ok) {
      // Keep the tool active so multiple structures can be placed in a row.
      refreshHoverValidity(handle);
    } else {
      refreshHoverValidity(handle);
    }
    return;
  }

  // HARVEST order (campaign maps): clicking a resource node sends a harvester to its field.
  // With a HARVESTER SELECTED (click the truck first), the order goes to THAT truck — the owner's
  // SUBJECT → ACTION grammar: a completed action drops the subject; a failed action KEEPS it
  // (the subject only changes when the order lands or another unit is picked); otherwise the
  // nearest idle truck takes the job.
  if (state.resourceNodes) {
    const node = state.resourceNodes.find((n) => n.x === cell.x && n.y === cell.y);
    if (node) {
      const sel = ui.selectedUnitId != null ? state.units.get(ui.selectedUnitId) : null;
      const harvesterId = (sel && sel.isHarvester && sel.hp > 0) ? sel.id : undefined;
      const res = handle.submit({ type: 'harvest', nodeId: node.id, harvesterId });
      if (res && res.ok) {
        ui.selectedUnitId = null;   // action assigned → the subject drops (owner 2026-07-17)
        ui.pendingHint = { text: harvesterId != null ? 'Harvester dispatched' : 'Nearest harvester dispatched' };
        return;
      }
      // action REJECTED (unrevealed / exhausted / truck gone): say why, and if a harvester was the
      // subject, KEEP it selected — a failed order must not silently eat the selection.
      ui.pendingHint = { text: 'Harvest: ' + ((res && res.reason) || 'unavailable') };
      if (harvesterId != null) return;
      // no harvester subject → fall through to normal selection
    }
  }

  // BASE CLICK = purchase a harvester (owner: 'select base to purchase'). The sim ladder-prices
  // and caps; the hint carries the result to the HUD.
  if (state.resourceNodes && cellInBase(state, cell)) {
    const res = handle.submit({ type: 'buyHarvester' });
    ui.pendingHint = (res && res.ok) ? { text: 'Harvester purchased' + (res.cost ? ' (−' + res.cost + 'g)' : ''), atBase: true }
      : { text: (res && res.reason === 'max harvesters') ? 'Max harvesters' : ('Base: ' + ((res && res.reason) || 'purchase')), atBase: true };
    ui.selectedStructureId = null; ui.selectedUnitId = null;
    return;
  }

  // Selection mode: click a structure to select; else a unit (enemy/defender) to inspect its range; else deselect.
  const structId = findStructureAtCell(state, cell);
  ui.selectedStructureId = structId;
  ui.selectedUnitId = null;
  if (structId === null) {
    ui.selectedUnitId = findUnitAtCell(state, cell);   // s5: show the selected unit's attack range
    // CLICKING A HARVESTER pops a base message pointing at the purchase mechanism (owner)
    if (ui.selectedUnitId != null && state.resourceNodes) {
      const su = state.units.get(ui.selectedUnitId);
      if (su && su.isHarvester) {
        const fleet = [...state.units.values()].filter((u) => u.isHarvester && u.hp > 0).length;
        ui.pendingHint = { text: fleet >= 4 ? 'Max harvesters' : 'Select base to purchase', atBase: true };
      }
    }
    if (ui.selectedUnitId === null) {
      // Clicking empty ground clears any active build selection too.
      ui.buildSelection = null;
      ui.hoverValid = false;
    }
  }
}

function onContextMenu(handle, ev) {
  ev.preventDefault();
  if (handle.ui.buildSelection) {
    handle.ui.buildSelection = null;
    handle.ui.hoverValid = false;
  }
}

function onKeyDown(handle, ev) {
  const ui = handle.ui;
  const key = ev.key;

  if (key === 'Escape') {
    if (ui.buildSelection) {
      ui.buildSelection = null;
      ui.hoverValid = false;
    } else if (ui.selectedStructureId !== null) {
      ui.selectedStructureId = null;
    } else if (ui.selectedUnitId !== null) {
      ui.selectedUnitId = null;
    }
    ev.preventDefault();
    return;
  }

  const buildIdx = BUILD_KEYS.indexOf(key);
  if (buildIdx !== -1) {
    const order = handle.buildOrder;
    if (buildIdx < order.length) {
      const structId = order[buildIdx];
      if (ui.buildSelection === structId) {
        // Toggle off if pressing the same shortcut again.
        ui.buildSelection = null;
        ui.hoverValid = false;
      } else {
        ui.buildSelection = structId;
        ui.selectedStructureId = null;
        refreshHoverValidity(handle);
      }
    }
    ev.preventDefault();
    return;
  }

  if (key === ' ' || key === 'Spacebar') {
    handle.submit({ type: 'startWave' });
    ev.preventDefault();
    return;
  }

  const lower = typeof key === 'string' ? key.toLowerCase() : '';

  // SUBJECT→ACTION grammar (owner): a completed action CONSUMES the selection; a failed action
  // keeps the subject and flashes the sim's reason — matching the harvester flow above.
  const structAction = (type, label) => {
    if (ui.selectedStructureId === null) return;
    const res = handle.submit({ type, structureId: ui.selectedStructureId });
    if (res && res.ok) ui.selectedStructureId = null;
    else ui.pendingHint = { text: label + ': ' + ((res && res.reason) || 'unavailable') };
  };

  if (lower === 'u') {
    structAction('upgrade', 'Upgrade');
    ev.preventDefault();
    return;
  }

  if (lower === 'x') {
    structAction('sell', 'Sell');
    ev.preventDefault();
    return;
  }

  if (lower === 'r') {
    structAction('repair', 'Repair');
    ev.preventDefault();
    return;
  }
}

// A press that moves less than this (px) and lifts within TAP_MS is a TAP; anything else is a camera drag.
const TAP_SLOP = 8;
const TAP_MS = 500;

/**
 * opts (the 3D view, ?renderer=three):
 *   pick(ev, ui) → cell | null — replaces the Pixi canvas → cell mapping.
 *   tapToAct — the canvas also pans/pinches, so act on a TAP's release instead of every press: a drag or
 *              a pinch never selects, builds or deploys. Right-click still cancels on press.
 */
export function createInput(canvas, renderer, getState, submit, ui, opts = {}) {
  const handle = {
    canvas,
    renderer,
    getState,
    submit,
    ui,
    pick: opts.pick || null,
    buildOrder: buildOrder(),
    listeners: [],
    destroyed: false,
  };

  const add = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    handle.listeners.push({ target, type, fn, opts });
  };

  const moveFn = (ev) => onPointerMove(handle, ev);
  const leaveFn = () => onPointerLeave(handle);
  const downFn = (ev) => onPointerDown(handle, ev);
  const ctxFn = (ev) => onContextMenu(handle, ev);
  const keyFn = (ev) => {
    // Ignore key input aimed at text fields (none expected, but safe).
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    onKeyDown(handle, ev);
  };

  add(canvas, 'pointermove', moveFn);
  add(canvas, 'pointerleave', leaveFn);
  if (opts.tapToAct) {
    const presses = new Map();   // pointerId → { x, y, t, placing }
    let multi = false;           // a second finger joined: this gesture is a pinch, never a tap
    // TOUCH PLACEMENT (owner 2026-10-18, "virtual joystick") [MM-story_mvee80a0_d]: with a tower armed, the first
    // finger STEERS the build slot — the pick (render3d eventToCell) sits up and left of the fingertip — the camera
    // does not pan with it, and lifting the finger builds there if the slot is valid. A second finger, a cancelled
    // pointer, or lifting over the HUD (slid back onto the build palette) builds nothing. Mouse play is unchanged.
    const onCanvas = (ev) => {
      if (typeof document === 'undefined' || !document.elementFromPoint) return true;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      return !el || el === canvas || (typeof canvas.contains === 'function' && canvas.contains(el));
    };
    add(canvas, 'pointerdown', (ev) => {
      if (ev.button !== undefined && ev.button !== 0) { downFn(ev); return; }   // right-click cancel stays on press
      const placing = ev.pointerType === 'touch' && !!ui.buildSelection && presses.size === 0;
      presses.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, t: ev.timeStamp, placing });
      if (placing) { ui.placingPointer = ev.pointerId; moveFn(ev); }
      if (presses.size > 1) { multi = true; ui.placingPointer = null; }   // a pinch: the camera takes over, nothing builds
    });
    const release = (ev, cancelled) => {
      const p = presses.get(ev.pointerId);
      presses.delete(ev.pointerId);
      const wasMulti = multi;
      if (presses.size === 0) multi = false;
      if (p && p.placing) {
        if (ui.placingPointer === ev.pointerId) ui.placingPointer = null;
        if (cancelled || wasMulti || !onCanvas(ev) || !ui.buildSelection) return;
        moveFn(ev);                          // the slot under the finger's final position
        if (ui.hoverValid) downFn(ev);       // build on release — only on a valid (green) slot
        return;
      }
      if (!p || cancelled || wasMulti) return;
      if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > TAP_SLOP || ev.timeStamp - p.t > TAP_MS) return;
      downFn(ev);
    };
    add(canvas, 'pointerup', (ev) => release(ev, false));
    add(canvas, 'pointercancel', (ev) => release(ev, true));
  } else {
    add(canvas, 'pointerdown', downFn);
  }
  add(canvas, 'contextmenu', ctxFn);
  add(window, 'keydown', keyFn);

  // Live validity: gold arrives while the mouse sits still (harvester deposits) — the ghost
  // must flip red->green without a pointermove. The main ticker calls this every frame.
  handle.refreshHover = () => { if (!handle.destroyed) refreshHoverValidity(handle); };

  // Expose a helper the HUD build palette can drive (same code path as keys).
  handle.setBuildSelection = (structId) => {
    if (handle.destroyed) return;
    if (structId === null || structId === undefined) {
      ui.buildSelection = null;
      ui.hoverValid = false;
      return;
    }
    ui.buildSelection = structId;
    ui.selectedStructureId = null;
    refreshHoverValidity(handle);
  };

  return handle;
}

export function destroyInput(handle) {
  if (!handle || handle.destroyed) return;
  for (const { target, type, fn, opts } of handle.listeners) {
    target.removeEventListener(type, fn, opts);
  }
  handle.listeners.length = 0;
  handle.destroyed = true;
}

if (typeof window !== 'undefined') {
  window.Bulwark = window.Bulwark || {};
  window.Bulwark.input = window.Bulwark.input || {};
  window.Bulwark.input.createInput = createInput;
  window.Bulwark.input.createUiState = createUiState;
  window.Bulwark.input.destroyInput = destroyInput;
}