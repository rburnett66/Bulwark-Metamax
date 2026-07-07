Looking at the plan, I need to implement a per-frame depth sort based on ground-anchor Y for the units/structures container.

```javascript
// src/render/depthSort.js
// Per-frame ground-anchor Y depth sort for ground units/structures.
//
// Painter's-algorithm ordering: entities are sorted so those with a
// smaller screen-projected ground-anchor Y (further "back" toward the
// horizon) draw first, and those with a larger Y (nearer the viewer)
// draw on top. This is re-run every frame because units move and the
// camera can rotate.
//
// This module is READ-ONLY with respect to sim state. It reads a
// display object's `depthY` (screen-space ground anchor Y) that the
// entity draw code stamps on the sprite each frame, and reorders the
// children of the provided container. It never mutates sim entities.

/**
 * Stamp a screen-space ground-anchor Y onto a display object.
 * Draw code should call this (or set `obj.depthY` directly) so the
 * sorter knows where each object's feet touch the ground.
 *
 * @param {PIXI.DisplayObject} obj
 * @param {number} y  screen-projected ground anchor Y
 * @param {number} [tieBreak] secondary key (e.g. X or spawn id) for stable order
 */
export function setDepthAnchor(obj, y, tieBreak = 0) {
  obj.depthY = y;
  obj.depthTie = tieBreak;
}

/**
 * Compare two display objects by their ground anchor.
 * Objects lacking a depthY sort to the back (treated as -Infinity-ish 0).
 */
function compareDepth(a, b) {
  const ay = (a.depthY !== undefined && a.depthY !== null) ? a.depthY : 0;
  const by = (b.depthY !== undefined && b.depthY !== null) ? b.depthY : 0;
  if (ay !== by) return ay - by;
  // Stable tie-break so equal-Y objects keep a deterministic order.
  const at = a.depthTie || 0;
  const bt = b.depthTie || 0;
  if (at !== bt) return at - bt;
  return 0;
}

/**
 * Sort the children of a container back-to-front by ground-anchor Y.
 * Safe to call every frame. Uses PIXI's built-in sortChildren when the
 * container has sortableChildren enabled and zIndex mirrors depthY,
 * otherwise sorts the children array directly.
 *
 * @param {PIXI.Container} container
 */
export function depthSort(container) {
  if (!container || !container.children || container.children.length < 2) {
    return;
  }
  const kids = container.children;

  // Mirror depthY into zIndex so PIXI's own sortableChildren path also works
  // and so external code can read a consistent ordering key.
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    const y = (k.depthY !== undefined && k.depthY !== null) ? k.depthY : 0;
    k.zIndex = y;
  }

  // Direct, deterministic sort of the children array (painter back->front).
  kids.sort(compareDepth);

  // Notify pixi that the child order changed so transforms/render pick it up.
  if (typeof container.onChildrenChange === 'function') {
    container.onChildrenChange();
  }
  container.sortDirty = false;
}

/**
 * Convenience helper: given a sim-space ground point (world tile coords or
 * pixel coords already), project it to a screen-space Y under the current
 * camera rotation. Kept here so depth logic and shadow-offset logic share the
 * same projection. Rotation is applied about the given pivot.
 *
 * @param {number} x   world/pixel X of the ground anchor
 * @param {number} y   world/pixel Y of the ground anchor
 * @param {number} rot camera rotation in radians (0 = no rotation)
 * @param {number} px  pivot X
 * @param {number} py  pivot Y
 * @returns {number} projected screen-space Y used for depth ordering
 */
export function projectAnchorY(x, y, rot = 0, px = 0, py = 0) {
  if (!rot) return y;
  const dx = x - px;
  const dy = y - py;
  const s = Math.sin(rot);
  const c = Math.cos(rot);
  // Only the rotated Y component matters for depth ordering.
  return py + (dx * s + dy * c);
}

export default depthSort;