// src/render3d/units/air/palette.js — the AIR faction livery for its 3D models [MM-story_mvh8woji_1].
// Sampled from the owner's concept renders (tools/unit-models/ref/air/*.png): white airframes, squadron navy, sakura
// pink petals, cherry-red stripes. A model sets `colors: AIR_COLORS`; the shared keys (dark, black, track, metal,
// glass, glow) keep their usual meaning so the metal table and LOD treat them the same as every other unit.
export const AIR_COLORS = Object.freeze({
  paint: 0xeef0f3,   // the white airframe / armour paint
  paint2: 0xcfd1d6,  // panel shading, inner faces, recesses
  navy: 0x1a2640,    // squadron navy (a shade under the concept #22324e: lit from above it reads true)
  pink: 0xf0a6c6,    // sakura petals, fins, decals
  red: 0xd12f3e,     // cherry-red stripes, nose art, tips
  gold: 0xd8b45a,    // emblems, rank wings
  hull: 0xeef0f3, hull2: 0xcfd1d6, panel: 0xcfd1d6,   // aliases so shared helpers (track hubs etc.) stay on palette
  dark: 0x3a3f48, black: 0x1d2027, track: 0x2b2e34, metal: 0x8a9099, glass: 0x1c2a44,
  glow: 0x46f2ff, glowB: 0x4aa8ff, amber: 0xffb340,
});
