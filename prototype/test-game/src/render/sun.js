/**
 * src/render/sun.js — THE world light. One source for every shading + shadow decision so the baked
 * terrain, the Stack Forge unit bake, and the runtime can never disagree on where the sun is.
 *
 * Screen space, +x right, +y DOWN. The sun sits TOP-LEFT; shadows fall to the LOWER-RIGHT. Azimuth
 * is measured so 135° = top-left — matching pack.js GAME_LIGHT_AZ and the Stack Forge bake default.
 * (The terrain design doc's "315°" is the same top-left direction in a y-up encoding; this module is
 * the single y-down truth — do not reintroduce a second number.)
 *
 * Light ELEVATION sets shadow length: a caster of screen-height h throws a shadow h/tan(elevation)
 * long, along `shadowDir`. Pure (no PIXI) so pack.test-style Node checks can import it.
 */

export const SUN = {
  /** Top-left sun. The one azimuth the whole game shades and shadows from. */
  azimuthDeg: 135,
  /** Sets shadow length (higher sun → shorter shadow). Shared bake + runtime default. */
  elevationDeg: 45,

  get rad() { return this.azimuthDeg * Math.PI / 180; },

  /** Screen-space unit vector pointing TOWARD the sun (y-down). */
  get toLight() {
    const a = this.rad;
    return { x: Math.cos(a), y: -Math.sin(a) };
  },

  /** Screen-space unit vector a shadow travels ALONG (away from the sun). Lower-right at 135°. */
  get shadowDir() {
    const a = this.rad;
    return { x: -Math.cos(a), y: Math.sin(a) };
  },

  /** Ground offset for a caster of screen-height `h` at the current elevation. */
  shadowOffset(h) {
    const len = h / Math.tan(this.elevationDeg * Math.PI / 180);
    const d = this.shadowDir;
    return { x: d.x * len, y: d.y * len };
  },
};
