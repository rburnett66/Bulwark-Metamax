/**
 * grid-fit — the SINGLE SOURCE OF TRUTH for the Stack Forge carve-grid size math.
 *
 * The recurring "clamp / chop / geometry-vs-paint mismatch" had one root cause: the carve grid
 * (foot×foot×layers) and the geometry spans were mutated independently, and the carve reconciled a
 * conflict by SILENTLY clamping the spans to the grid — dropping voxels. The structural fix is to make
 * the EFFECTIVE grid a DERIVED value that is never smaller than the geometry, so `grid ⊇ geometry` holds
 * by construction. These are the pure functions that guarantee it — DOM-free on purpose so grid-fit.test.mjs
 * can prove the invariant in node (the rest of stack-forge.js is browser/PIXI-bound and can't be unit-tested).
 *
 * Loaded as a CLASSIC script in the browser (defines globals) AND importable in node for the test.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node (grid-fit.test.mjs)
  else Object.assign(root, api);                                               // browser: window.snapRes, effFoot, …
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CEIL = 128;                                   // hard voxel ceiling per axis (bake/atlas limit)
  const RES_STEPS = [32, 48, 64, 96, 128];            // footprint Resolution presets
  const snapRes = (v) => RES_STEPS.find((r) => r >= v) || CEIL;   // smallest preset ≥ v (CEIL if none)

  // Effective footprint = the requested Resolution, unless the geometry needs more, in which case snap UP to a
  // preset that holds it. NEVER returns less than `ext` (except at the CEIL). This is what makes the carve
  // grid ⊇ geometry no matter which path last set `stored`.
  const effFoot = (stored, ext) => (ext > stored ? snapRes(ext) : stored);

  // Effective height layers = at least the geometry height, capped at the ceiling. Layers aren't presets.
  const effLayers = (stored, ext) => Math.min(CEIL, Math.max(stored, ext));

  return { CEIL, RES_STEPS, snapRes, effFoot, effLayers };
});
