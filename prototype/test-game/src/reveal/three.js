/**
 * src/reveal/three.js — load three.js and the addons the reveals need (vendored r128), once [MM-story_mw56v724_3].
 * Shared by the opening (opening/introRunner.js) and every reveal, so the game loads one copy.
 */
const VENDOR = new URL('../../vendor/', import.meta.url).href;
let loading = null;

export function loadThree() {
  if (!loading) {
    loading = Promise.all([
      import(VENDOR + 'three.module.js'), import(VENDOR + 'three-addons/loaders/GLTFLoader.js'),
      import(VENDOR + 'three-addons/postprocessing/EffectComposer.js'), import(VENDOR + 'three-addons/postprocessing/RenderPass.js'),
      import(VENDOR + 'three-addons/postprocessing/ShaderPass.js'), import(VENDOR + 'three-addons/postprocessing/UnrealBloomPass.js'),
    ]).then(([THREE, gl, ec, rp, sp, ub]) => ({
      THREE,
      addons: { GLTFLoader: gl.GLTFLoader, EffectComposer: ec.EffectComposer, RenderPass: rp.RenderPass, ShaderPass: sp.ShaderPass, UnrealBloomPass: ub.UnrealBloomPass },
    }));
  }
  return loading;
}

export const CONTENT = new URL('../../content/', import.meta.url).href;

/** Planet key → capital ship model key (content/ships/ships.json). */
export const SHIP_MODEL = Object.freeze({
  ground: 'powder', air: 'air', hightech: 'tech', artillery: 'artillery', water: 'water',
  arcane: 'arcane', space: 'lumen', dark: 'dark', greenies: 'green', collective: 'collective',
});
