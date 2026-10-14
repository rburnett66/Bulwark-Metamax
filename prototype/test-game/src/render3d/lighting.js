/**
 * src/render3d/lighting.js — ONE sun for the three.js view (plan v2.2 §5, code design §4.1).
 *
 * The direction comes from src/render/sun.js — the single y-down truth for the whole game — converted to
 * world space (X east = screen +x, Z south = screen +y, Y up). 135° / 45° → light from the north-west.
 *
 * Balance: ambient AMBIENT + sun so a flat sunlit ground shows its baked colour exactly (AMBIENT + DIR·N·L
 * = 1 when N = up) and ground in shadow is AMBIENT of it. The static shadow map renders once and again only
 * when invalidated (structures change) — never per frame.
 *
 * No three.js import: the facade passes THREE in, so the pure part stays testable under node --test.
 */
import { SUN } from '../render/sun.js';

export const AMBIENT = 0.6;
export const SHADOW_BIAS = -0.0006;

/** Unit vector pointing TOWARD the sun, in world space. */
export function sunDirection(azimuthDeg = SUN.azimuthDeg, elevationDeg = SUN.elevationDeg) {
  const a = (azimuthDeg * Math.PI) / 180, e = (elevationDeg * Math.PI) / 180;
  return { x: Math.cos(a) * Math.cos(e), y: Math.sin(e), z: -Math.sin(a) * Math.cos(e) };
}

/** Directional intensity that makes a flat, sunlit ground exactly 1.0 with AMBIENT ambient. */
export function sunIntensity(dir, ambient = AMBIENT) {
  return (1 - ambient) / dir.y;
}

/**
 * Build the lights into `scene`. Returns { ambient, hemi, sun, dir, setWorld(light), invalidateShadows() }.
 * The hemisphere light starts OFF (the baked-ground balance above); setWorld(WORLD_LIGHT[key]) applies a
 * low-poly world's sky colour, ambient, hemisphere and sun tint (LP [MM-story_mv87jxp2_7]) — never the sun's
 * direction, which stays this one sun.
 * `shadowSize` comes from the quality tier (4096 / 2048 / 1024).
 */
export function createLights(THREE, renderer, scene, cols, rows, shadowSize = 2048) {
  const dir = sunDirection();
  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT);
  const sun = new THREE.DirectionalLight(0xffffff, sunIntensity(dir));
  const cx = cols / 2, cz = rows / 2;
  sun.position.set(cx + dir.x * 80, dir.y * 80, cz + dir.z * 80);
  sun.target.position.set(cx, 0, cz);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const ext = Math.ceil(Math.hypot(cols, rows) / 2) + 6;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 220 });
  sun.shadow.bias = SHADOW_BIAS;
  sun.shadow.camera.updateProjectionMatrix();   // required: without it three keeps its default ±5 extents
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0);
  scene.add(ambient, hemi, sun, sun.target);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;   // hard edges: the voxel language, and the cheapest
  renderer.shadowMap.autoUpdate = false;            // static casters only → render once (= baked)
  renderer.shadowMap.needsUpdate = true;

  return {
    ambient, hemi, sun, dir,
    setWorld(w) {
      if (!w) return;
      renderer.setClearColor(w.clear, 1);
      ambient.color.setHex(0xffffff); ambient.intensity = w.ambient;
      hemi.color.setHex(w.hemi[0]); hemi.groundColor.setHex(w.hemi[1]); hemi.intensity = w.hemi[2];
      sun.color.setHex(w.sun[0]); sun.intensity = sunIntensity(dir) * w.sun[1];
    },
    invalidateShadows() { renderer.shadowMap.needsUpdate = true; },
  };
}
