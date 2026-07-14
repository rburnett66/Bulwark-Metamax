import { STRUCTURES } from '../data/tables.js';
import { validatePlacement } from '../sim/structures.js';
import { screenToCell } from '../render/renderer.js';

const BUILD_KEYS = ['1', '2', '3', '4', '5'];   // 5 = Harvestor

export function createUiState() {
  return {
    buildSelection: null,
    hoverCell: null,
    hoverValid: false,
    selectedStructureId: null,
    selectedUnitId: null,      // s5: a selected unit (enemy/defender) whose attack range is shown
    showFieldRings: false,     // white rings on the harvester's assigned field — debug aid, off by default
    pendingHint: null,         // {text, atBase} — set by input, consumed + flashed by the main ticker
  };
}

function buildOrder() {
  // Deterministic ordered list of structure ids for 1-4 shortcuts.
  return Object.keys(STRUCTURES);
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
  // click-harvester-then-click-field flow; otherwise the nearest idle one takes it.
  if (state.resourceNodes) {
    const node = state.resourceNodes.find((n) => n.x === cell.x && n.y === cell.y);
    if (node) {
      const sel = ui.selectedUnitId != null ? state.units.get(ui.selectedUnitId) : null;
      const harvesterId = (sel && sel.isHarvester && sel.hp > 0) ? sel.id : undefined;
      const res = handle.submit({ type: 'harvest', nodeId: node.id, harvesterId });
      if (res && res.ok) return;   // selection kept — queue the same truck onto another field next
      // rejected (unrevealed / exhausted) → fall through to normal selection
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

  if (lower === 'u') {
    if (ui.selectedStructureId !== null) {
      handle.submit({ type: 'upgrade', structureId: ui.selectedStructureId });
    }
    ev.preventDefault();
    return;
  }

  if (lower === 'x') {
    if (ui.selectedStructureId !== null) {
      handle.submit({ type: 'sell', structureId: ui.selectedStructureId });
    }
    ev.preventDefault();
    return;
  }

  if (lower === 'r') {
    if (ui.selectedStructureId !== null) {
      handle.submit({ type: 'repair', structureId: ui.selectedStructureId });
    }
    ev.preventDefault();
    return;
  }
}

export function createInput(canvas, renderer, getState, submit, ui) {
  const handle = {
    canvas,
    renderer,
    getState,
    submit,
    ui,
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
  add(canvas, 'pointerdown', downFn);
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