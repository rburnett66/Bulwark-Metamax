/**
 * src/opening/openingStage.js — draws the Collective opening [MM-story_mw47lhgr_4] (Vesper: [MM-story_mw47l791_1]).
 *
 * Thin stage over the pure timeline (timeline.js): every frame asks openingAt(t) where the camera, the ship, the star,
 * the engines and the fades are, and draws that. Reuses the capital-ship presentation kit as built — the space
 * backdrop, the ship GLB prepared by prepareShip, engine exhaust, tugs and the HDR post chain — and adds the red giant.
 * Beats 0–3 are drawn (cold open → red giant → fly-by → the flank). Beat 4 (the hull opens into the room view) arrives
 * with the room view (Interiors I1).
 *
 *   const stage = createOpeningStage(THREE, { renderer, addons, tier, reduced });
 *   await stage.load({ ship: url, tug: url, engineColor });
 *   stage.frame(t, dt) → the timeline state (the page draws the caption / fade overlay from it)
 *
 * three.js addons are injected (GLTFLoader, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass) so this module
 * imports no URLs and works from the game and the review page alike.
 */
import { openingAt, OPEN } from './timeline.js';
import { createRedGiant } from '../render3d/star/redGiant.js';
import { createBackdrop } from '../render3d/space/backdrop.js';
import { createEngineFx, prepareShip } from '../render3d/ships/engineFx.js';
import { createTugs } from '../render3d/ships/tugs.js';
import { chromaticAberrationPass, hdrBloom, tonemapPass } from '../render3d/space/lensFx.js';

export function createOpeningStage(THREE, { renderer, addons, tier = 'high', reduced = false, seed = 5 } = {}) {
  const { GLTFLoader, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass } = addons;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;               // tone mapped once, at the end of the chain
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(10, 1, 0.1, 1000);
  const holder = new THREE.Group();                          // the ship flies inside this (+X bow)
  scene.add(holder);

  let bd = null, star = null, ship = null, fx = null, tugs = null, box = null, L = 20, composer = null, bloom = null, lens = null;
  let key = null, fill = null, front = null;

  async function load({ ship: shipUrl, tug: tugUrl, engineColor = [1, 0.62, 0.3] }) {
    const loader = new GLTFLoader();
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    ship = prepareShip(THREE, (await loader.loadAsync(shipUrl)).scene, { anisotropy: aniso });
    ship.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'ship_glow') o.material.uniforms.gain.value = 1.4; });
    holder.add(ship);
    const b = new THREE.Box3().setFromObject(ship);
    box = { min: b.min.toArray(), max: b.max.toArray() };
    L = box.max[0] - box.min[0];
    fx = createEngineFx(THREE, ship);
    if (tugUrl) {
      const tugScene = prepareShip(THREE, (await loader.loadAsync(tugUrl)).scene, { anisotropy: aniso });
      tugs = createTugs(THREE, tugScene, ship, { count: 7, color: engineColor, seed: 70 });
    }

    // Vesper and the sky: the backdrop's own sun points at the star (and is hidden behind it); the star is the key
    const o = openingAt(0, { box });
    const c = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
    const toStar = new THREE.Vector3(...o.star.position).sub(new THREE.Vector3(...c)).normalize();
    bd = createBackdrop(THREE, { seed, tier, sunDir: toStar.toArray(), palette: { sun: '#ff8a5a', a: '#4a1e3a', b: '#3a1a1a', c: '#8c3a2a' }, sunIntensity: 0.4, nebulaIntensity: 0.55 });
    scene.add(bd.group);
    const bdSun = bd.group.getObjectByName('backdrop.sun'); if (bdSun) bdSun.visible = false;   // Vesper is the sun here
    star = createRedGiant(THREE, { radius: o.star.radius, tier });
    star.group.position.set(...o.star.position);
    scene.add(star.group);
    camera.far = L * 90; camera.near = L * 0.01; camera.updateProjectionMatrix();

    key = new THREE.DirectionalLight(star.lightColor, 2.6); key.position.copy(toStar).multiplyScalar(100);
    fill = new THREE.HemisphereLight(0x7a3a2a, 0x060408, 0.22);
    front = new THREE.DirectionalLight(0x8fa8d8, 0.32); front.position.set(0.3, 0.25, 1).multiplyScalar(100);   // dim cool fill from the camera side
    scene.add(key, fill, front);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(bd.envScene, 0.04).texture;

    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = hdrBloom(THREE, new UnrealBloomPass(new THREE.Vector2(1, 1), tier === 'high' ? 0.55 : 0.45, 0.6, 1.0));
    composer.addPass(bloom);
    composer.addPass(tonemapPass(THREE, ShaderPass, { exposure: 0.85 }));
    if (tier !== 'low') { lens = chromaticAberrationPass(THREE, ShaderPass, { amount: 0.001, vignette: 0.28, grain: 0.022 }); composer.addPass(lens); }
    return { box, L };
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    if (composer) { composer.setSize(w, h); bloom.setSize(w, h); }
    camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }

  /** Draw the opening at time t (seconds); dt drives the boiling star, the exhaust and the tugs. */
  function frame(t, dt = 1 / 60) {
    if (!box) return null;
    const o = openingAt(t, { box, aspect: camera.aspect, reduced });
    holder.position.x = o.ship.x; holder.visible = o.ship.visible;
    camera.fov = o.camera.fov; camera.updateProjectionMatrix();
    camera.position.set(...o.camera.position); camera.lookAt(...o.camera.target);
    star.setIntensity(o.star.intensity);
    key.intensity = 2.6 * o.star.intensity;
    fx.setIntensity(o.engine); fx.update(dt, camera);
    if (tugs) { tugs.group.visible = o.tugs; if (o.tugs) tugs.update(dt, renderer.domElement.height); }
    bd.update(dt, camera);
    star.update(dt, camera);
    lens && lens.tick && lens.tick(dt);
    composer.render();
    return o;
  }

  return {
    scene, camera, load, resize, frame,
    get box() { return box; },
    get info() { return renderer.info.render; },
    OPEN,
    dispose() { star && star.dispose(); bd && bd.dispose(); fx && fx.dispose(); tugs && tugs.dispose(); },
  };
}
