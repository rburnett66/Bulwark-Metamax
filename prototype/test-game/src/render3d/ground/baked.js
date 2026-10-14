/**
 * src/render3d/ground/baked.js — the ground plane from the committed bake (plan v2.2 §3.1, code design §4.6).
 *
 * level.tiles = [{ name, x, y, w, h }] in cells; each tile is one lit plane at Y = 0 that receives the
 * static shadow map, drawn first with no depth write (everything standing on the ground depth-tests
 * against the 3D scene, not against the ground). A dark apron runs past the map edge so the edge reads.
 *
 * THREE is passed in (no import) — see index.js.
 */

function loadTexture(THREE, loader, url, maxAniso) {
  return new Promise((resolve, reject) => {
    loader.load(url, (t) => {
      t.generateMipmaps = false;              // tiles are drawn near 1:1 at battle zoom; mips cost memory
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.NearestFilter;      // keep the digicam blocks crisp up close
      t.anisotropy = Math.min(4, maxAniso);
      resolve(t);
    }, undefined, () => reject(new Error(`ground tile failed to load: ${url}`)));
  });
}

/** Build the ground group. Rejects (never resolves to an empty plane) if any tile fails. */
export async function buildBakedGround(THREE, renderer, baseUrl, level) {
  const group = new THREE.Group();
  group.name = 'ground';
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = await Promise.all(level.tiles.map((t) => loadTexture(THREE, loader, baseUrl + t.name, maxAniso)));
  level.tiles.forEach((t, i) => {
    const g = new THREE.PlaneGeometry(t.w, t.h);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: textures[i], depthWrite: false }));
    m.position.set(t.x + t.w / 2, 0, t.y + t.h / 2);
    m.receiveShadow = true;
    m.renderOrder = 0;
    group.add(m);
  });
  const ap = new THREE.PlaneGeometry(level.cols + 200, level.rows + 200);
  ap.rotateX(-Math.PI / 2);
  const apron = new THREE.Mesh(ap, new THREE.MeshLambertMaterial({ color: 0x141b17, depthWrite: false }));
  apron.position.set(level.cols / 2, -0.02, level.rows / 2);
  apron.receiveShadow = true;
  apron.renderOrder = -1;
  group.add(apron);
  return group;
}
