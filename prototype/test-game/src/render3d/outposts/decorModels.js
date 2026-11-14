/**
 * src/render3d/outposts/decorModels.js — the base's decor, drawn instanced [MM-story_mwfacx0h_c] (design:
 * docs/16 Bulwark MM/design/Outpost-Decor-and-Cargo-Lift.md §2: ≤ 14 draw calls for all decor, however many pieces).
 *
 * One InstancedMesh per decor kind and mesh of its GLB (content/outposts/decor/<kind>_<lod>.glb, built by
 * tools/blender/outposts/decor/), at one LOD for the whole visit: 'flat' (Low tier, safe mode) or 'tex'. Small pieces
 * cast no shadow; large ones cast into the static shadow map like the buildings. Models are authored in cells (1 cell
 * = 4 m), standing on their origin. Browser-only (three.js + GLTFLoader); placement is src/outpost/decor.js.
 */
export function createDecorLayer(THREE, parent, { base, GLTFLoader, lod = 'tex', cap = 80, y = 0.05, onChange = () => {} }) {
  const group = new THREE.Group();
  group.name = 'outpost-decor';
  parent.add(group);
  const kinds = new Map();   // kind → { meshes: [InstancedMesh], large } once loaded
  let manifest = null, wanted = [], disposed = false;
  const loader = new GLTFLoader();

  const ready = (async () => {
    manifest = await (await fetch(base + 'decor.json')).json();
    await Promise.all(Object.entries(manifest).filter(([, m]) => m.class !== 'lift').map(async ([kind, m]) => {
      const entry = m.lods && (m.lods[lod] || m.lods.flat);
      if (!entry) return;
      try {
        const gltf = await loader.loadAsync(base + entry.file);
        if (disposed) return;
        gltf.scene.updateMatrixWorld(true);
        const meshes = [];
        gltf.scene.traverse((n) => {
          if (!n.isMesh) return;
          const geo = n.geometry.clone().applyMatrix4(n.matrixWorld);
          const im = new THREE.InstancedMesh(geo, n.material, cap);
          im.count = 0;
          im.frustumCulled = false;   // instances spread over the base: the shared bounds would cull them wrongly
          im.castShadow = m.class === 'large';
          im.receiveShadow = true;
          im.name = `decor-${kind}`;
          group.add(im);
          meshes.push(im);
        });
        kinds.set(kind, { meshes, large: m.class === 'large' });
      } catch (e) { console.warn('[outpost] decor', kind, e); }
    }));
    place(wanted);
  })().catch((e) => console.warn('[outpost] decor manifest', e));

  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let sig = '';
  function place(list) {
    const by = new Map();
    for (const d of list) { if (!by.has(d.kind)) by.set(d.kind, []); by.get(d.kind).push(d); }
    let shadowy = false;
    for (const [kind, k] of kinds) {
      const mine = (by.get(kind) || []).slice(0, cap);
      for (const im of k.meshes) {
        mine.forEach((d, i) => {
          pos.set(d.x, y, d.y); q.setFromAxisAngle(up, d.rot || 0); scl.setScalar(d.scale || 1);
          im.setMatrixAt(i, mtx.compose(pos, q, scl));
        });
        im.count = mine.length;
        im.instanceMatrix.needsUpdate = true;
      }
      if (k.large) shadowy = true;
    }
    if (shadowy) onChange();
  }
  return {
    group, ready,
    /** Draw these pieces (o.decor, less any the caller hides). Cheap when nothing changed. */
    sync(list) {
      const s = (list || []).map((d) => d.id + d.kind).join('|');
      if (s === sig) return;
      sig = s; wanted = list || [];
      if (manifest) place(wanted);
    },
    /** How many pieces are drawn now (tests / review). */
    get drawn() { let n = 0; for (const k of kinds.values()) n += k.meshes.length ? k.meshes[0].count : 0; return n; },
    get drawCalls() { let n = 0; for (const k of kinds.values()) n += k.meshes.length; return n; },
    dispose() {
      disposed = true;
      for (const k of kinds.values()) for (const im of k.meshes) {
        im.geometry.dispose(); im.dispose();
        for (const m of [].concat(im.material)) { if (m.map) m.map.dispose(); m.dispose(); }   // the GLB's own (one per visit)
      }
      parent.remove(group);
    },
  };
}
