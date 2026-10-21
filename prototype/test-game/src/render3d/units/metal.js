/**
 * src/render3d/units/metal.js — how metallic each part of a 3D unit is. DATA (code design §4.11 UMETAL;
 * plan v2.2.2 §6.11). MAT [MM-story_mv87jwol_6]. Pure: no three.js.
 *
 * Owner 2026-10-13: "Is it possible to use a material shader to give the tanks a more metallic look?"
 *
 * Every part of a part-list model carries a material key (hull, dark, glass, …). Here each key gets
 * [metalness, roughness] in 0..1. Glow parts are unlit and carry no metal. A per-unit-type override slot exists
 * for the open owner question (Q17: metal per material only, or per faction / unit type — "rusty raiders vs
 * polished corp"); it is empty until that is decided.
 *
 * This table sits beside the models (src/render3d/units/models.js). When the Stack Forge model pipeline (UMP)
 * moves models to content/units/model/*.model.json, this moves with them.
 */

/** [metalness, roughness] per material key — the prototype's values, as approved. */
export const UMETAL = Object.freeze({
  hull: [0.55, 0.45],
  hull2: [0.6, 0.4],
  panel: [0.6, 0.4],
  dark: [0.7, 0.35],
  black: [0.4, 0.6],
  track: [0.3, 0.75],
  metal: [0.95, 0.2],
  glass: [1.0, 0.05],
  // livery keys used by the landing craft (craft/models.js) [MM-story_mvbk1hf3_1]
  accent: [0.35, 0.45],
  stripe: [0.15, 0.6],
  trim: [0.4, 0.45],
  brass: [0.85, 0.3],
  // System towers and walls (structures/systemModels.js) [MM-story_mvbr0qfb_o]
  gun: [0.4, 0.45],
  gun2: [0.35, 0.5],
  gunD: [0.5, 0.4],
  hazard: [0.1, 0.7],
  chrome: [0.95, 0.15],
  bone: [0.15, 0.6],
  // the AIR faction livery (air/palette.js): painted airframes, not bare metal [MM-story_mvh8woji_1]
  paint: [0.15, 0.5],
  paint2: [0.3, 0.45],
  navy: [0.06, 0.7],   // low metal: big navy wings must stay navy, not mirror the sky
  pink: [0.15, 0.55],
  red: [0.2, 0.5],
  gold: [0.85, 0.3],
  // the ARTILLERY (Siege) livery (siege/palette.js): dusty paint and canvas, little shine [MM-story_mvhb6qd2_2]
  camo: [0.2, 0.7],
  camo2: [0.1, 0.8],
  olive: [0.2, 0.7],
  net: [0.02, 0.95],   // canvas netting: all but matte (every lit key carries some metal — metal.test)
  rust: [0.45, 0.65],
  // the ARCANE / ENERGY livery (arcane/palette.js): wrought iron and worn bronze, cloth and wood [MM-story_mvhnbx8n_4]
  iron: [0.3, 0.6],     // low metal: blackened iron must stay black, not mirror the sky
  iron2: [0.25, 0.65],
  bronze: [0.6, 0.45],
  bronze2: [0.5, 0.55],
  wood: [0.02, 0.85],
  cloth: [0.02, 0.9],
  robe: [0.02, 0.9],
  // the SPACE TECH livery (space/palette.js): lunar-white hull, federation blue, gold foil, solar cells [MM-story_mvho2d6s_5]
  lunar: [0.08, 0.55],   // low metal: the white hull must stay white, not mirror the sky
  lunar2: [0.1, 0.6],
  fed: [0.1, 0.55],
  foil: [0.9, 0.3],
  solar: [0.12, 0.35],
  copper: [0.85, 0.35],
  // the DARK ENERGY livery (dark/palette.js): cracked obsidian, bone, fungus, tendrils [MM-story_mvifm4xj_1]
  void: [0.04, 0.95],    // matte stone: the purple must hold, not silver under the sky (owner 2026-10-21)
  obsid: [0.04, 0.95],
  ash: [0.06, 0.9],
  bone: [0.03, 0.85],
  fungus: [0.02, 0.9],
  tendril: [0.05, 0.85],
});

/** Keys drawn unlit (emissive): no metal, no lighting — they carry the glow read. */
export const isGlowKey = (k) => /^glow|amber/.test(k || '');

/** Per-model overrides { modelKey: { materialKey: [m, r] } } — empty until Q17 is answered. */
export const METAL_OVERRIDES = Object.freeze({});

/** Neutral fallback for a key with no entry (a test fails if any model uses one). */
export const DEFAULT_MR = Object.freeze([0.5, 0.5]);

/** [metalness, roughness] for a part. Glow → [0, 1]. */
export function metalFor(materialKey, modelKey) {
  if (isGlowKey(materialKey)) return [0, 1];
  const o = modelKey && METAL_OVERRIDES[modelKey] && METAL_OVERRIDES[modelKey][materialKey];
  return o || UMETAL[materialKey] || DEFAULT_MR;
}

/**
 * The environment the metal reflects: a sky colour above the horizon and a darker ground colour below.
 * Driven by the world style; MEADOW (the low-poly default) until the style system (LP) sets it per level.
 */
export const ENV_MEADOW = Object.freeze({ sky: 0xc4d8ff, ground: 0x5cbf6c });

/** Metal strength: 1 = the approved metal look, 0 = the previous flat look (debug / quality switch). */
export const METAL_ON = 1;
