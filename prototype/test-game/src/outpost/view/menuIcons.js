/**
 * src/outpost/view/menuIcons.js — the outpost build menu's pictures [MM-story_mw6k9xec_5].
 *
 * The battle palette shows each item as a picture of its own 3D model (render/buildIcons.js, baked by
 * tools/icons/bake.html). The outpost does the same: the defenses and the harvester reuse the battle's baked pictures;
 * the outpost buildings are rendered here from their GLBs (content/outposts/*.glb, through the outpost kit the view
 * has already loaded) in the same three-quarter view, on a transparent background, once when the view opens. Until a
 * picture is ready, or for a building with no GLB yet (the Resource and Upgrade Bays, story O10), the button shows an
 * SVG glyph, as a battle button does when its picture can't load.
 * Browser-only (three.js; the renderer is the view's own).
 */
import { STRUCT_ICONS } from '../../render/buildPalette.js';

/** The fallback glyphs (24 × 24 viewBox), in the battle palette's flat style. */
export const OUTPOST_GLYPHS = Object.freeze({
  power: '<rect x="4" y="13" width="16" height="6" rx="1.5" fill="#cfd6dd"/><ellipse cx="12" cy="13" rx="8" ry="2.6" fill="#e9edf1"/><ellipse cx="12" cy="12.6" rx="4.6" ry="1.5" fill="#3fd0ff"/><rect x="10.6" y="4" width="2.8" height="8" fill="#9aa4ae"/><path d="M13 5.5 10.6 9h2l-.8 3 2.6-3.6h-2z" fill="#3fd0ff"/>',
  rig: '<rect x="5" y="13" width="14" height="6" rx="1" fill="#cfd6dd"/><rect x="7" y="8" width="3" height="7" fill="#eb5c0d"/><rect x="14" y="8" width="3" height="7" fill="#eb5c0d"/><path d="M7 15l1.5 4 1.5-4M14 15l1.5 4 1.5-4" fill="#5c6166"/><rect x="9" y="5" width="6" height="3" fill="#9aa4ae"/>',
  storage: '<rect x="4" y="9" width="16" height="10" rx="1" fill="#e2e6ea"/><rect x="4" y="9" width="16" height="2" fill="#eb5c0d"/><rect x="9" y="13" width="6" height="6" fill="#3a4148"/><rect x="9.5" y="13.5" width="5" height="3" fill="#3fd0ff" opacity=".8"/><circle cx="7" cy="6" r="2.4" fill="none" stroke="#9aa4ae" stroke-width="1.3"/><path d="M7 6l3 3" stroke="#9aa4ae" stroke-width="1.3"/>',
  resourceBay: STRUCT_ICONS.harvestorBay,
  upgradeBay: '<rect x="3" y="15" width="18" height="4" rx="1" fill="#9aa4ae"/><rect x="4" y="7" width="3" height="8" fill="#cfd6dd"/><rect x="17" y="7" width="3" height="8" fill="#cfd6dd"/><rect x="4" y="7" width="3" height="1.6" fill="#eb5c0d"/><rect x="17" y="7" width="3" height="1.6" fill="#eb5c0d"/><path d="M9 13.5l3-4 3 4z" fill="#3fd0ff"/><path d="M12 9.5v-4" stroke="#3fd0ff" stroke-width="1.4"/>',
});

/**
 * Render each slug's model to a picture. → { [slug]: dataURL }. A slug that fails is left out (the glyph stays).
 * opts: { size (px), yaw (the view's three-quarter turn) }.
 */
export async function renderMenuIcons(THREE, renderer, kit, slugs, { size = 128, yaw = 0.38 } = {}) {
  const out = {};
  if (!renderer || !kit || typeof document === 'undefined') return out;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x4a4238, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 9, 6);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const rt = new THREE.WebGLRenderTarget(size, size);
  const px = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g2 = canvas.getContext('2d');
  const prev = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()).getHex(), alpha: renderer.getClearAlpha(), autoClear: renderer.autoClear, shadow: renderer.shadowMap.autoUpdate };
  try {
    for (const slug of slugs) {
      let inst = null;
      try {
        inst = await kit.make(slug);
        if (!inst) continue;
        inst.setLook({});
        const obj = inst.object;
        scene.add(obj);
        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inst.lod.levels[0].object);
        const c = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() / 2;
        const pitch = 0.62, d = rad / Math.sin((cam.fov / 2) * Math.PI / 180) * 0.9;
        const a = yaw + Math.PI * 0.12;
        cam.position.set(c.x + Math.sin(a) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(a) * Math.cos(pitch) * d);
        cam.lookAt(c);
        cam.updateMatrixWorld(true);
        inst.update(0, cam);
        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.autoUpdate = false;
        renderer.clear(true, true, true);
        renderer.render(scene, cam);
        renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
        const img = g2.createImageData(size, size);
        for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
        g2.clearRect(0, 0, size, size);
        g2.putImageData(img, 0, 0);
        out[slug] = canvas.toDataURL('image/png');
        scene.remove(obj);
      } catch (e) {
        console.warn('[outpost] icon', slug, e);
      } finally {
        if (inst) { scene.remove(inst.object); inst.dispose(); }
      }
    }
  } finally {
    renderer.setRenderTarget(prev.target);
    renderer.setClearColor(prev.color, prev.alpha);
    renderer.autoClear = prev.autoClear;
    renderer.shadowMap.autoUpdate = prev.shadow;
    rt.dispose();
  }
  return out;
}
