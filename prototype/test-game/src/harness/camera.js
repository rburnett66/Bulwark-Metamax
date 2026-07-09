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
  const cols = map.cols, rows = map.rows, tile = map.tile;
  const cx = (cols - 1) / 2;                                    // horizontal centre = camera axis
  const depth = rows > 1 ? (rows - 1 - cell.y) / (rows - 1) : 0; // 0 near (bottom) .. 1 far (top)
  const scale = 1 - 0.45 * depth;
  const offCentre = cx > 0 ? (cell.x - cx) / cx : 0;            // -1 left .. +1 right
  const skewX = offCentre * depth * 0.35;
  return { x: (cell.x + 0.5) * tile, y: (cell.y + 0.5) * tile, scale, skewX };
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
