/**
 * prototype/test-game/src/harness/camera.js  [state-harness sh-m1.s4]
 *
 * The pseudo-3D game camera: origin 0,0 at the BOTTOM-MID of the map. Bottom-centre is nearest (upright, full
 * size, no skew); the top of the map is farthest (smaller, and off-centre units lean away from the camera axis —
 * parallax). Units also cast a silhouette shadow that tracks position + weapon aim. Pure math (Pixi-free) so it's
 * shared by the game render AND asserted headlessly. (Reconciled from the sh-m1.s4 develop attempt.)
 */

/**
 * Project a map cell -> screen transform under the bottom-mid camera.
 *   returns { x, y, scale, skewX }
 *   - scale shrinks with DEPTH (distance from the near bottom edge)
 *   - skewX leans away from the centre axis; stronger the further off-centre AND the deeper it is
 */
export function project(map, cell) {
  const rows = map.rows, tile = map.tile;
  const depth = rows > 1 ? (rows - 1 - cell.y) / (rows - 1) : 0; // 0 near (bottom) .. 1 far (top)
  const scale = 1 - 0.18 * depth;                               // SUBTLE size falloff with distance (no skew)
  return { x: (cell.x + 0.5) * tile, y: (cell.y + 0.5) * tile, scale, depth, skewX: 0 };
}

// Layer heights above the ground plane (ground/shadow=0). The base chassis floats a bit (rides on treads),
// the weapon sits on it, the head tops it. Higher = leans more.
export const LAYER_HEIGHT = { base: 1, weapon: 2, head: 3 };
// Screen pixels of lean per height-unit at the SCREEN EXTREMES. Kept small — the effect is very subtle.
const LEAN_X = 2.4;   // horizontal: units off-centre lean their upper layers toward the near screen edge
const LEAN_Y = 3.0;   // vertical: farther-up (deeper) units lean their upper layers up/away

/**
 * The pseudo-3D LAYER LEAN — a per-layer positional offset (NO distortion) from the camera's slight tilt.
 *   • horizontal: proportional to how far off the centre-line the unit is (left→lean left, right→lean right),
 *     independent of depth — so a unit at the bottom-left still leans.
 *   • vertical: proportional to depth (0 at the bottom = straight-down = aligned; grows toward the top).
 * Returns SCREEN-pixel {dx, dy}; the caller divides by its own scale if it draws layers in a scaled space.
 */
export function layerLean(map, cell, height) {
  const cx = map.cols > 1 ? (map.cols - 1) / 2 : 0;
  const hx = cx > 0 ? (cell.x - cx) / cx : 0;                    // -1 left .. +1 right
  const depth = map.rows > 1 ? (map.rows - 1 - cell.y) / (map.rows - 1) : 0; // 0 near .. 1 far
  return { dx: height * LEAN_X * hx, dy: -height * LEAN_Y * depth };
}

/**
 * The ground shadow for a unit: derived from its base+turret silhouette, projected onto the plane; it tracks the
 * unit's position (via the camera) and rotates with the weapon's aim.
 *   returns { x, y, scaleX, scaleY, rotation }
 */
export function shadowFor(map, cell, aimAngle) {
  const p = project(map, cell);
  return {
    x: p.x,
    y: p.y + map.tile * 0.15,          // offset down onto the ground
    scaleX: p.scale,
    scaleY: p.scale * 0.5,             // flattened onto the plane
    rotation: typeof aimAngle === 'number' ? aimAngle * 0.3 : 0,   // turret silhouette rotates the shadow
  };
}
