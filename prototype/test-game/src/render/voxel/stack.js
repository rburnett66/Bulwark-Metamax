/**
 * src/render/voxel/stack.js — sprite-stack camera math (pure, no PIXI). Shared by Stack Forge (live
 * orbit preview + bake) and any headless golden test.
 *
 * The stack fakes 3D: a top-down footprint is drawn once, then LAYERS slices are stacked with a
 * vertical offset per layer. That per-layer offset (SP, "layer spacing") IS the camera ELEVATION —
 * top-down (90°) → SP 0 (flat); side-on (0°) → SP max (tall). AZIMUTH is a uniform yaw of every layer.
 * So "orbit the model" = (azimuth → yaw, elevation → SP); "set camera" locks both into the pack.
 */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Camera elevation (deg, 0=side .. 90=top) → integer layer spacing SP, given a max spread. */
export function elevationToSP(elevationDeg, spMax = 6) {
  return Math.max(0, Math.round(spMax * Math.cos(clamp(elevationDeg, 0, 90) * Math.PI / 180)));
}

/** Inverse: layer spacing SP → the camera elevation it represents (deg). */
export function spToElevation(sp, spMax = 6) {
  return Math.round(Math.acos(clamp(sp / spMax, 0, 1)) * 180 / Math.PI);
}

/** Screen Y of layer k (0=bottom) given the bottom-layer centre baseY and spacing sp. Layers rise up. */
export function layerScreenY(k, baseY, sp) {
  return baseY - k * sp;
}

/** Total on-screen rise of a LAYERS-tall stack at spacing sp (px). Drives the render-texture height. */
export function stackRise(layers, sp) {
  return Math.max(0, (layers - 1) * sp);
}
