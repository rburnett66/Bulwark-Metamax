import { STRUCTURES } from '../data/tables.js';
import { validatePlacement } from '../sim/structures.js';
import { screenToCell } from '../render/renderer.js';

const BUILD_KEYS = ['1', '2', '3', '4'];

export function createUiState() {
  return {
    buildSelection: null,
    hoverCell: null,
    hoverValid: false,
    selectedStructureId: null,
    selectedUnitId: null,      // s5: a selected unit (enemy/defender) whose attack range is shown
  };
}

function buildOrder() {
  // Deterministic ordered list of structure ids for 1-4 shortcuts.
  return Object.keys(STRUCTURES);
}

function findUnitAtCell(state, cell) {
  // s5: nearest live unit to the clicked cell (within ~0.7 cell) so a click on an enemy selects it.
  if (!state || !state.units || !cell) return null;
  let bestId = null;
  let bestD = 0.7;
  for (const u of state.units.values()) {
    if (!u || u.hp <= 0) continue;
    const d = Math.hypot(u.pos.x - cell.x, u.pos.y - cell.y);
    if (d < bestD) { bestD = d; bestId = u.id; }
  }
  return bestId;
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
  const scaleX = rect.width > 0 ? handle.canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? handle.canvas.height / rect.height : 1;
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

  // HARVEST order (campaign maps): clicking a resource node sends the harvester to it. Takes
  // precedence over selection — the node is the thing you're pointing at.
  if (state.resourceNodes) {
    const node = state.resourceNodes.find((n) => n.x === cell.x && n.y === cell.y);
    if (node) {
      const res = handle.submit({ type: 'harvest', nodeId: node.id });
      if (res && res.ok) return;
      // rejected (unrevealed / exhausted) → fall through to normal selection
    }
  }

  // Selection mode: click a structure to select; else a unit (enemy/defender) to inspect its range; else deselect.
  const structId = findStructureAtCell(state, cell);
  ui.selectedStructureId = structId;
  ui.selectedUnitId = null;
  if (structId === null) {
    ui.selectedUnitId = findUnitAtCell(state, cell);   // s5: show the selected unit's attack range
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