/**
 * select — voxel selection and editing for the Stack Forge rebuild.
 *
 * DOM-FREE, like carve.js. Takes a voxel volume and plain numbers; returns keys and snapshots. The views
 * do the drawing; this owns what is selected and what a delete/add actually does.
 *
 * DESIGN (REBUILD-EDIT-SPEC.md):
 *   - ONE selection set shared by the main 3D view and the grid view. A key is z*foot*foot + y*foot + x.
 *     There is no per-view selection, no rect stored as state, no "which facing drew it". A rect is a
 *     drawing detail; the keys are the state.
 *   - VOL IS THE MODEL. Delete writes VOL[k] = 0, add writes VOL[k] = 1. No overlay, no 'del' sentinel.
 *   - Undo is a snapshot of VOL. One array copy, no diffing, no replay.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node (select.test.mjs)
  else Object.assign(root, api);                                              // browser
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  const keyOf = (x, y, z, foot) => z * foot * foot + y * foot + x;
  const unkey = (k, foot) => ({ x: k % foot, y: ((k / foot) | 0) % foot, z: (k / (foot * foot)) | 0 });

  /** The shared selection. Both views read and write THIS — never a copy. */
  function makeSelection() {
    const set = new Set();
    return {
      set,
      get size() { return set.size; },
      has: (k) => set.has(k),
      add: (k) => { set.add(k); },
      remove: (k) => { set.delete(k); },
      toggle: (k) => { if (set.has(k)) set.delete(k); else set.add(k); },
      addAll: (ks) => { for (const k of ks) set.add(k); },
      removeAll: (ks) => { for (const k of ks) set.delete(k); },
      clear: () => { set.clear(); },
      keys: () => [...set],
    };
  }

  /**
   * The voxels a grid rubber-band covers.
   * `ax.toVox(col,row,slice)` maps a grid cell + depth to [x,y,z]; `ax.depth` is how deep that facing goes.
   * layer 0  = the SURFACE: the first filled voxel along the facing's depth axis (what you see looking at
   *            the model from there). layer i = the voxel at depth i-1, so the slider reads 1..N for N
   *            layers and position i means layer i.
   * Only FILLED voxels are ever selected — a selection names geometry, not empty space.
   */
  function rectToKeys(VOL, foot, layers, ax, layer, c0, r0, c1, r1) {
    const lo = (a, b) => Math.max(0, Math.min(a, b)), hi = (a, b, cap) => Math.min(cap - 1, Math.max(a, b));
    const cA = lo(c0, c1), cB = hi(c0, c1, ax.cols), rA = lo(r0, r1), rB = hi(r0, r1, ax.rows);
    const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers;
    const filled = (x, y, z) => inside(x, y, z) && !!VOL[keyOf(x, y, z, foot)];
    const out = [];
    for (let r = rA; r <= rB; r++) for (let c = cA; c <= cB; c++) {
      if (layer === 0) {
        for (let s = 0; s < ax.depth; s++) {                     // first hit along depth = the surface
          const [x, y, z] = ax.toVox(c, r, s);
          if (filled(x, y, z)) { out.push(keyOf(x, y, z, foot)); break; }
        }
      } else {
        const [x, y, z] = ax.toVox(c, r, layer - 1);             // position i -> depth i-1
        if (filled(x, y, z)) out.push(keyOf(x, y, z, foot));
      }
    }
    return out;
  }

  /** snapshot for undo — one array copy, nothing clever */
  const snapshot = (VOL) => VOL.slice();
  const restore = (VOL, snap) => { VOL.set(snap); };

  /** delete: VOL[k] = 0. Returns the snapshot taken BEFORE, and how many were actually removed. */
  function deleteKeys(VOL, keys) {
    const before = snapshot(VOL);
    let n = 0;
    for (const k of keys) if (VOL[k]) { VOL[k] = 0; n++; }
    return { before, removed: n };
  }

  /** add: VOL[k] = 1, with the colour written to the same index in vcol. */
  function addKeys(VOL, vcol, keys, rgb) {
    const before = snapshot(VOL);
    let n = 0;
    for (const k of keys) {
      if (!VOL[k]) n++;
      VOL[k] = 1;
      if (vcol && rgb) { vcol[k * 3] = rgb[0]; vcol[k * 3 + 1] = rgb[1]; vcol[k * 3 + 2] = rgb[2]; }
    }
    return { before, added: n };
  }

  /** a bounded undo stack of VOL snapshots */
  function makeHistory(limit) {
    const undo = [], redo = [];
    const cap = limit || 60;
    return {
      push(snap) { undo.push(snap); if (undo.length > cap) undo.shift(); redo.length = 0; },
      canUndo: () => undo.length > 0,
      canRedo: () => redo.length > 0,
      undo(VOL) { if (!undo.length) return false; redo.push(snapshot(VOL)); restore(VOL, undo.pop()); return true; },
      redo(VOL) { if (!redo.length) return false; undo.push(snapshot(VOL)); restore(VOL, redo.pop()); return true; },
      depth: () => undo.length,
    };
  }

  return { keyOf, unkey, makeSelection, rectToKeys, snapshot, restore, deleteKeys, addKeys, makeHistory };
});
