// src/render3d/units/siege/palette.js — the ARTILLERY (Siege) faction livery for its 3D models [MM-story_mvhb6qd2_2].
// Sampled from the owner's concept renders (tools/unit-models/ref/siege/*.png): dusty tan and dark olive-drab camo,
// sand-coloured camouflage netting and sandbags, rusted steel, hazard-yellow stencils. Shared keys (dark, black, track,
// metal, glass, glow) keep their usual meaning. Values sit a shade under the concepts: the game lights top faces brightly,
// so the dusty tan and olive read true in battle instead of washing out to sand.
export const SIEGE_COLORS = Object.freeze({
  camo: 0x76634c,    // dusty tan armour (the main body colour)
  camo2: 0x8f8068,   // pale sand: dust-washed top faces, sandbags
  olive: 0x3a3227,   // dark olive-drab camo patches, lower hull
  net: 0x5a4f3d,     // camouflage netting
  rust: 0x6a3d25,    // rusted, scorched steel
  hazard: 0xc9a43a,  // hazard-yellow stencils and warning stripes
  hull: 0x76634c, hull2: 0x8f8068, panel: 0x6c5b46,   // aliases so shared helpers stay on palette
  dark: 0x3a332a, black: 0x1c1813, track: 0x2b2620, metal: 0x6e6a63, glass: 0x1f2a30,
  glow: 0x46f2ff, glowB: 0x4aa8ff, amber: 0xffb340,
});
