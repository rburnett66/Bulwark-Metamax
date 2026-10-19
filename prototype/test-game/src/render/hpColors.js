/**
 * src/render/hpColors.js — ONE palette for every health bar in the game [MM-task_mvfmy1k5_c].
 *
 * Owner 2026-10-18: "health bars should lime green against charcoal grey"; 2026-10-19: "all health bars were supposed
 * to be color changed to lime green and charcoal .. they are hard to read". The 3D in-world bars, the HUD base bar,
 * the selection and unit panels and the 2D (Pixi) bars all read from here — lime at every fraction (no green →
 * amber → red ramp), on a charcoal track inside a darker rim.
 */
export const HP_COLORS = Object.freeze({
  fill: 0x8cf22e,    // lime green — the health left
  track: 0x34373c,   // charcoal grey — the health gone
  rim: 0x141619,     // dark charcoal frame
});
export const hpCss = (hex) => '#' + hex.toString(16).padStart(6, '0');
export const HP_CSS = Object.freeze({ fill: hpCss(HP_COLORS.fill), track: hpCss(HP_COLORS.track), rim: hpCss(HP_COLORS.rim) });
/** 0..1 RGB triples (shaders). */
export const hpRgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
