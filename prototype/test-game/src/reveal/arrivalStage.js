/**
 * src/reveal/arrivalStage.js — draws a capital ship's arrival over its planet [MM-story_mw56ve9g_6].
 *
 * A thin stage over the pure timeline (arrivalPlan.js arrivalAt(t)), built from the presentation kit the opening uses
 * (opening/openingStage.js): the space backdrop, the ship GLB prepared by prepareShip, engine exhaust, tugs and the HDR
 * post chain. Instead of the red giant it hangs the planet's live globe (render3d/planet/globe.js) behind the orbit
 * shot, and adds the arrival flash (an additive sprite at the ship, design §3 beat 1).
 *
 *   const st = createArrivalStage(THREE, { renderer, addons, planet: 'ground', tier, reduced });
 *   await st.load({ ship: url, tug: url, engineColor });  st.frame(t, dt) → arrivalAt(t) · st.resize(w, h) · st.dispose()
 */
import { arrivalAt } from './arrivalPlan.js';
import { shot } from '../render3d/ships/shots.js';
import { makeGlobe } from '../render3d/planet/globe.js';
import { createBackdrop } from '../render3d/space/backdrop.js';
import { createEngineFx, prepareShip } from '../render3d/ships/engineFx.js';
import { createTugs } from '../render3d/ships/tugs.js';
import { hdrBloom, tonemapPass, chromaticAberrationPass } from '../render3d/space/lensFx.js';

export function createArrivalStage(THREE, { renderer, addons, planet = 'ground', tier = 'high', reduced = false, seed = 9 } = {}) {
  const { GLTFLoader, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass } = addons;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 1000);
  const holder = new THREE.Group(); scene.add(holder);
  let bd = null, ship = null, fx = null, tugs = null, box = null, L = 20, composer = null, bloom = null, lens = null, globe = null, flash = null;

  async function load({ ship: shipUrl, tug: tugUrl, engineColor = [1, 0.62, 0.3] }) {
    const loader = new GLTFLoader();
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    ship = prepareShip(THREE, (await loader.loadAsync(shipUrl)).scene, { anisotropy: aniso });
    holder.add(ship);
    const b = new THREE.Box3().setFromObject(ship);
    box = { min: b.min.toArray(), max: b.max.toArray() };
    L = box.max[0] - box.min[0];
    fx = createEngineFx(THREE, ship);
    if (tugUrl) {
      const tugScene = prepareShip(THREE, (await loader.loadAsync(tugUrl)).scene, { anisotropy: aniso });
      tugs = createTugs(THREE, tugScene, ship, { count: 5, color: engineColor, seed: 41 });
    }
    const c = new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5);
    bd = createBackdrop(THREE, { seed, tier, sunDir: [0.55, 0.35, -0.75], nebulaIntensity: 0.7 });
    scene.add(bd.group);
    // the planet: behind the ship as the orbit shot sees it, below the line of sight, big enough to fill the lower frame
    const o = shot('orbit', 0, { box: { min: b.min, max: b.max }, aspect: 16 / 9, still: true });
    const away = c.clone().sub(new THREE.Vector3(...o.position)).normalize();
    globe = makeGlobe(THREE, planet, { additive: true });
    globe.root.scale.setScalar(L * 3.2);
    globe.root.position.copy(c).addScaledVector(away, L * 9).add(new THREE.Vector3(0, -L * 3.4, 0));
    scene.add(globe.root);
    const key = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(0.55, 0.35, -0.75).multiplyScalar(100);
    const fill = new THREE.HemisphereLight(0x8fa8d8, 0x0a0c12, 0.35);
    const front = new THREE.DirectionalLight(0x9fb8e8, 0.45); front.position.set(0.3, 0.2, 1).multiplyScalar(100);
    scene.add(key, fill, front);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(bd.envScene, 0.04).texture;
    // the arrival flash: one additive glow sprite at the ship, faction coloured
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,215,.6)'); gr.addColorStop(1, 'rgba(255,200,150,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
    flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: new THREE.Color(...engineColor), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flash.position.copy(c); scene.add(flash);
    camera.near = L * 0.01; camera.far = L * 400; camera.updateProjectionMatrix();
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = hdrBloom(THREE, new UnrealBloomPass(new THREE.Vector2(1, 1), tier === 'high' ? 0.55 : 0.45, 0.6, 1.0));
    composer.addPass(bloom);
    composer.addPass(tonemapPass(THREE, ShaderPass, { exposure: 0.9 }));
    if (tier !== 'low') { lens = chromaticAberrationPass(THREE, ShaderPass, { amount: 0.001, vignette: 0.28, grain: 0.02 }); composer.addPass(lens); }
    return { box, L };
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    if (composer) { composer.setSize(w, h); bloom.setSize(w, h); }
    camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }

  /** Draw the arrival at time t; drift (L) slides the ship along −X → 0 (the coast-in). → arrivalAt(t). */
  function frame(t, dt = 1 / 60, { drift = 0 } = {}) {
    if (!box) return null;
    const o = arrivalAt(t, { box, aspect: camera.aspect, reduced });
    holder.position.x = -drift * L;
    camera.fov = o.camera.fov; camera.updateProjectionMatrix();
    camera.position.set(...o.camera.position); camera.lookAt(...o.camera.target);
    fx.setIntensity(o.engine); fx.update(dt, camera);
    if (tugs) { tugs.group.visible = o.tugs; if (o.tugs) tugs.update(dt, renderer.domElement.height); }
    flash.visible = o.flash > 0.01; flash.scale.setScalar(L * (0.6 + 5 * o.flash)); flash.material.opacity = o.flash;
    globe.spin(dt, 0.01);
    bd.update(dt, camera);
    lens && lens.tick && lens.tick(dt);
    composer.render();
    return o;
  }

  return {
    scene, camera, load, resize, frame,
    get box() { return box; },
    dispose() { bd && bd.dispose(); fx && fx.dispose(); tugs && tugs.dispose(); globe && globe.dispose(); },
  };
}
