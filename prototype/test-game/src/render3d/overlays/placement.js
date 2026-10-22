/**
 * src/render3d/overlays/placement.js — the placement ghost (plan v2.2 §6.9) [MM-task_mv9s9lvj_1].
 *
 * OUTLINE GHOST [MM-task_mvfjylci_9] — owner 2026-10-19: "when placing units show the user a outline shader of the
 * model not a red box, but outline goes red when it does not fit". For a structure with a System model (towers,
 * walls) the ghost is THAT model (tier 1, as it will be built): a faint see-through body plus an inverted-hull
 * outline — its back faces pushed out along smoothed normals, so only a rim shows around the silhouette — cyan when
 * the spot is valid, red when it isn't. Structures without a model (mine drone, harvester bay) keep the block below.
 * One small material pair per kind, built on first use and cached.
 *
 * (The block:) a translucent block over the hovered cell at structure height with an outline: green when the sim's
 * validatePlacement accepts it, red when it refuses. It never decides validity itself — input.js already
 * keeps ui.hoverValid from validatePlacement every frame (main.js refreshHover), and a refused tap shows the
 * sim's reason. Drawn last, no depth write, so it reads over units and terrain.
 *
 * THREE is passed in (no import) — see index.js.
 */
import { mountOf } from '../structures/baseMounts.js';
import { cellToWorld } from '../camera.js';
import { SYSTEM_MODELS, SYSTEM_SCALE, tierModelKey } from '../structures/systemModels.js';
import { mergeSystemModel, SYSTEM_KINDS, SYSTEM_STRUCTS } from '../structures/system3d.js';
import { STRUCTURES } from '../../data/tables.js';

const OK = 0x5dff8f, BAD = 0xff4040;
export const OUTLINE = Object.freeze({ ok: 0x52e8ff, bad: 0xff3a3a, width: 0.14, fill: 0.16 });   // width in model units

/** The System model a structure id builds as (tier 1), or null (mine drone, harvester bay → the block). */
export function ghostModelKey(structId) {
  const def = STRUCTURES[structId];
  const m = SYSTEM_STRUCTS[structId] || (def && SYSTEM_KINDS[def.kind]);
  return m && SYSTEM_MODELS[m] ? tierModelKey(m, 1) : null;
}

/**
 * One geometry for a System model with every group placed at its pivot (as it stands at rest), plus `aOut`: the
 * outward direction per vertex averaged over every face sharing that position — so the pushed-out hull stays closed
 * at the low-poly model's hard edges. Pure (THREE injected).
 */
export function ghostGeometry(THREE, key) {
  const parts = mergeSystemModel(THREE, SYSTEM_MODELS[key]);
  const pos = [], nor = [];
  for (const P of Object.values(parts)) {
    const a = P.geo.attributes.position.array, n = P.geo.attributes.normal.array, pv = P.pivot || [0, 0, 0];
    for (let i = 0; i < a.length; i += 3) { pos.push(a[i] + pv[0], a[i + 1] + pv[1], a[i + 2] + pv[2]); nor.push(n[i], n[i + 1], n[i + 2]); }
    P.geo.dispose();
  }
  const acc = new Map(), keyOf = (i) => `${Math.round(pos[i] * 1000)},${Math.round(pos[i + 1] * 1000)},${Math.round(pos[i + 2] * 1000)}`;
  for (let i = 0; i < pos.length; i += 3) {
    const k = keyOf(i), v = acc.get(k) || [0, 0, 0];
    v[0] += nor[i]; v[1] += nor[i + 1]; v[2] += nor[i + 2]; acc.set(k, v);
  }
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    let v = acc.get(keyOf(i)), l = Math.hypot(v[0], v[1], v[2]);
    if (l < 1e-3) { v = [nor[i], nor[i + 1], nor[i + 2]]; l = Math.hypot(v[0], v[1], v[2]) || 1; }   // opposing faces (a thin plate): its own normal
    out[i] = v[0] / l; out[i + 1] = v[1] / l; out[i + 2] = v[2] / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aOut', new THREE.BufferAttribute(out, 3));
  g.computeBoundingSphere();
  return g;
}

const HULL_VERT = /* glsl */`
attribute vec3 aOut; uniform float uWidth;
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + aOut * uWidth, 1.0); }`;
const HULL_FRAG = /* glsl */`
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }`;

export function createPlacementGhost(THREE, scene) {
  // Same block as a placeholder structure (markers.js): 0.86 wide, 1 cell tall, standing on the ground.
  const geo = new THREE.BoxGeometry(0.86, 1, 0.86);
  geo.translate(0, 0.5, 0);
  const fillMat = new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.5, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.95, depthTest: false });
  const fill = new THREE.Mesh(geo, fillMat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
  const group = new THREE.Group();
  group.add(fill, edges);
  group.renderOrder = 10;
  fill.renderOrder = 10;
  edges.renderOrder = 11;
  group.visible = false;
  scene.add(group);

  // the outline ghost: a faint body (writes depth, so the hull only shows past the silhouette) + the hull
  const bodyMat = new THREE.MeshBasicMaterial({ color: OUTLINE.ok, transparent: true, opacity: OUTLINE.fill, depthWrite: true });
  const hullMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(OUTLINE.ok) }, uWidth: { value: OUTLINE.width } },
    vertexShader: HULL_VERT, fragmentShader: HULL_FRAG, side: THREE.BackSide, depthWrite: false,
    transparent: true,   // drawn in the transparent pass AFTER the body (renderOrder 10 → 11), so the body's depth hides its middle
  });
  const models = new Map();   // model key → { group, body, hull }
  function modelGhost(key) {
    let m = models.get(key);
    if (m) return m;
    const g = ghostGeometry(THREE, key), k = SYSTEM_SCALE[key] || 0.3;
    const body = new THREE.Mesh(g, bodyMat), hull = new THREE.Mesh(g, hullMat);
    body.renderOrder = 10; hull.renderOrder = 11;
    const grp = new THREE.Group(); grp.add(body, hull); grp.scale.set(k, k, k); grp.visible = false;
    scene.add(grp);
    m = { group: grp, body, hull, geo: g, k };
    models.set(key, m);
    return m;
  }
  let shown = null;

  return {
    /** Show the ghost for the armed build tool at ui.hoverCell; hide it otherwise. */
    sync(ui, mounts) {
      const cell = ui && ui.buildSelection && ui.hoverCell;
      const key = cell ? ghostModelKey(ui.buildSelection) : null;
      const want = key ? modelGhost(key) : null;
      if (shown && shown !== want) shown.group.visible = false;
      shown = want;
      group.visible = !!cell && !want;
      if (!cell) return false;
      const x = cellToWorld(cell.x), z = cellToWorld(cell.y);
      const mt = mountOf(mounts, { pos: cell }), y = mt ? mt.y : 0;   // a base corner slot: preview the tower on the hull [MM-task_mvj0k7v3_k]
      if (want) {
        want.group.visible = true;
        want.group.position.set(x, y, z);
        want.group.scale.setScalar(want.k * (mt ? mt.s : 1));
        const c = ui.hoverValid ? OUTLINE.ok : OUTLINE.bad;
        bodyMat.color.setHex(c); hullMat.uniforms.uColor.value.setHex(c);
        return true;
      }
      group.position.set(x, y, z);
      const c = ui.hoverValid ? OK : BAD;
      fillMat.color.setHex(c);
      edgeMat.color.setHex(c);
      return true;
    },
    /** The ghost drawn now: 'model:<key>', 'box' or null (tests). */
    get showing() { return shown && shown.group.visible ? 'model:' + [...models].find(([, v]) => v === shown)[0] : group.visible ? 'box' : null; },
    /** Current outline colour (hex), for tests. */
    get outlineColor() { return hullMat.uniforms.uColor.value.getHex(); },
    dispose() {
      scene.remove(group);
      geo.dispose(); edges.geometry.dispose(); fillMat.dispose(); edgeMat.dispose();
      for (const m of models.values()) { scene.remove(m.group); m.geo.dispose(); }
      bodyMat.dispose(); hullMat.dispose();
    },
  };
}
