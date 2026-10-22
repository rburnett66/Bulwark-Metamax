/**
 * src/render3d/fx/factionFx.js — each faction's EFFECT colour: the tint its units' hits, explosions and burning
 * wrecks take on (owner 2026-10-21: "for each faction can we tune the effects shader to include some coloring from
 * the faction. Damage purple Dark Energy units would create some purple highlights") [MM-story_mviqruvd_2].
 *
 * Keyed by the unit-id prefix (tables.js: DRK-Tanks, SPC-Planes…; data/factions.js lists the prefixes). A faction
 * with `null` keeps the classic hot-yellow sparks and orange fire. Presentation only — the sim never reads this.
 *
 * `mix` is how strongly each effect kind takes the faction colour (0 = classic, 1 = all faction colour). Sparks
 * spread across [spark0, spark1] so a burst reads as classic sparks shot through with faction highlights; fire takes
 * only a touch, so a fire still reads as fire.
 */
export const FACTION_FX = Object.freeze({
  GND: null,                          // Ground / Powder: the classic look — powder, fire and hot steel
  AIR: Object.freeze([0.35, 0.62, 1.0]),   // Air: cold sky-blue
  HTC: Object.freeze([0.1, 0.9, 1.0]),    // High Tech: electric cyan
  ART: Object.freeze([1.0, 0.72, 0.1]),     // Artillery (Siege): hazard amber
  WTR: Object.freeze([0.1, 0.85, 0.72]),    // Water: sea-green spray
  ARC: Object.freeze([1.0, 0.18, 0.05]),    // Arcane / Energy: ember red, the stained glass
  SPC: Object.freeze([1.0, 0.15, 0.78]),   // Space Tech: beacon magenta
  DRK: Object.freeze([0.55, 0.15, 1.0]),   // Dark Energy: violet
  GRN: Object.freeze([0.4, 1.0, 0.08]),   // Greenies (Chem): toxic green
});

// colours are saturated on purpose: additive particles pile up toward white, so a pastel would read as plain sparks
export const FX_MIX = Object.freeze({ spark0: 0.6, spark1: 1.0, flash: 0.7, ember: 0.8, fire: 0.35, ring: 0.9, pool: 0.75, wreckLight: 0.6 });

/** The effect colour [r, g, b] for a unit id ('DRK-Tanks' → violet), or null for the classic look / unknown ids. */
export function factionFxColor(unitId) {
  if (typeof unitId !== 'string') return null;
  const i = unitId.indexOf('-');
  return (i > 0 && FACTION_FX[unitId.slice(0, i)]) || null;
}

/** Mix colour `c` toward faction colour `t` by `k` (t null → c unchanged). Returns a new [r, g, b]. */
export const tintMix = (c, t, k) => (t ? [c[0] + (t[0] - c[0]) * k, c[1] + (t[1] - c[1]) * k, c[2] + (t[2] - c[2]) * k] : c);
