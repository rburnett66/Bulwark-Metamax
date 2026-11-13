/**
 * src/farm/view/farmLayer.js — the farm drawn on the outpost's 3D scene [MM-story_mwabgs3l_f].
 *
 * The FARM tab's picture (Farming-Design §4.4, §5.1): plot beds with four ridges and a front inlay in the pod level's
 * colour, the plants in their state (planted pods glowing in the level colour, sprouts, plants, ripe heads, dead
 * stalks, stubble), and the farm buildings. It draws into the outpost renderer's own scene, beside the outpost's
 * buildings (src/outpost/view/outpostScene.js) — one view, one camera (owner rule 7).
 *
 * The plants are instanced: one InstancedMesh per state for every plot on the map (16 plants a plot, the scale
 * prototype's count), rebuilt only when a plot's state changes — a farm of 20 plots is a handful of draw calls
 * (iPhone memory, tech plan §2.3 F7). Farm buildings use the outpost kit's GLBs (content/outposts/outposts.json:
 * farmhouse, silo, pump) when the kit lists them, else a built-in shape, the way the outpost scene stands in for a
 * building with no model yet. World units: one battle cell = one unit, x = column, z = row (as the outpost scene).
 *
 * createFarmLayer(THREE, r, { map, kit, reduced }) → { sync(o, now), select(rect),
 *   update(dt), counts(), dispose() }
 */
import { POD_LEVELS, cropOf } from '../../data/farm.js';
import { plotState, plotPlants } from '../model.js';
import { RIPE } from './farmUi.js';   // a ripe crop's colour by category (shared with the FARM tab's crop pictures)
import { mergeGeos } from '../../outpost/view/outpostScene.js';   // the outpost scene's merge (one draw call per material)
import { PAD_SIZE, MODEL_PAD_SIZE } from '../../terrain/outpostPads.js';
const KIT_SCALE = PAD_SIZE.pad / MODEL_PAD_SIZE.pad;   // 0.5: the outpost kit's authoring scale to the map's (task_mwagi1nr_1e)

const Y = 0.05;   // the ground plate height the outpost scene stands its pads on (outpostScene.js PAD_Y)
const C = { soil: 0x3b2a1c, ridge: 0x4a3524, frame: 0x6d5a44, sprout: 0x7bc24a, leaf: 0x4f9a37, dead: 0x8a8578, stubble: 0xb89b5e, cyan: 0x34e1ff, bad: 0xff5a4a, sel: 0xffd34a };

/** The 16 plant spots of a plot (world x, z): four rows along z (north–south, the battle camera's view), four plants
 *  each. The plants stand on them, and the harvest embers rise from them (embers.js). */
export function plantSpots(p) {
  const out = [];
  for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) out.push([p.x + (row + 0.5) * (p.w / 4), p.y + (k + 0.5) * (p.h / 4)]);
  return out;
}
/** The height the plots' ground plate stands at (the plants and the embers start from it). */
export const FARM_Y = Y;

export function createFarmLayer(THREE, r, { map, kit = null, reduced = false } = {}) {
  const root = new THREE.Group();
  root.name = 'farm';
  r.scene.add(root);
  const mats = {
    soil: new THREE.MeshStandardMaterial({ color: C.soil, roughness: 1 }),
    ridge: new THREE.MeshStandardMaterial({ color: C.ridge, roughness: 1 }),
    frame: new THREE.MeshStandardMaterial({ color: C.frame, roughness: 0.8 }),
    plant: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    sel: new THREE.MeshBasicMaterial({ color: C.sel, toneMapped: false }),
  };
  // the plant shapes, one per state, unit-sized (scaled per instance): 16 to a plot, four rows running north–south
  const G = {
    pod: new THREE.SphereGeometry(0.07, 8, 6),
    sprout: new THREE.ConeGeometry(0.06, 0.18, 5).translate(0, 0.09, 0),
    plant: new THREE.ConeGeometry(0.11, 0.42, 6).translate(0, 0.21, 0),
    ripe: new THREE.ConeGeometry(0.1, 0.5, 6).translate(0, 0.25, 0),
    head: new THREE.SphereGeometry(0.09, 8, 6).scale(1, 1.6, 1).translate(0, 0.55, 0),
    dead: new THREE.BoxGeometry(0.05, 0.05, 0.32).translate(0, 0.03, 0),
    stubble: new THREE.CylinderGeometry(0.025, 0.03, 0.08, 5).translate(0, 0.04, 0),
  };
  const groups = { beds: new THREE.Group(), plants: new THREE.Group(), buildings: new THREE.Group(), marks: new THREE.Group() };
  for (const g of Object.values(groups)) root.add(g);

  let sig = '', clock = 0;
  const built = new Map();   // farm building id → { holder, inst, kind, done }
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  let counts = { plots: 0, plants: 0, buildings: 0 };

  const levelColour = (level) => new THREE.Color((POD_LEVELS.find((l) => l.level === level) || POD_LEVELS[0]).colour);
  const spots = plantSpots;

  function clear(g) {
    for (const c of [...g.children]) {
      g.remove(c);
      if (c.geometry && !Object.values(G).includes(c.geometry)) c.geometry.dispose();
      if (c.material && !Object.values(mats).includes(c.material)) c.material.dispose();   // the per-plot inlays
      if (c.isInstancedMesh) c.dispose();
    }
  }

  /** The plot beds: soil, four ridges, a frame, and the front inlay in the planted level's colour. */
  function buildBeds(plots, o) {
    clear(groups.beds);
    const soil = [], ridge = [], frame = [];
    for (const p of plots) {
      const cx = p.x + p.w / 2, cz = p.y + p.h / 2, w = p.w - 0.12, d = p.h - 0.12;
      soil.push(new THREE.BoxGeometry(w, 0.06, d).translate(cx, Y + 0.03, cz));
      const st = plotState(o, p);
      if (st !== 'harvested') for (let row = 0; row < 4; row++) ridge.push(new THREE.BoxGeometry(0.3, 0.07, d - 0.2).translate(p.x + (row + 0.5) * (p.w / 4), Y + 0.09, cz));
      for (const [fx, fz, fw, fd] of [[cx, p.y + 0.06, w, 0.08], [cx, p.y + p.h - 0.06, w, 0.08], [p.x + 0.06, cz, 0.08, d], [p.x + p.w - 0.06, cz, 0.08, d]]) frame.push(new THREE.BoxGeometry(fw, 0.1, fd).translate(fx, Y + 0.05, fz));
      if (p.crop) {   // the inlay along the front beam: the pod level at a glance (Farming-Design §5.1)
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.03, 0.05).translate(cx, Y + 0.12, p.y + p.h - 0.06), new THREE.MeshBasicMaterial({ color: levelColour(p.level), toneMapped: false }));
        groups.beds.add(m);
      }
    }
    const add = (geos, mat, name) => { if (!geos.length) return; const g = mergeGeos(THREE, geos); const m = new THREE.Mesh(g, mat); m.name = name; m.receiveShadow = true; groups.beds.add(m); };
    add(soil, mats.soil, 'farm-soil'); add(ridge, mats.ridge, 'farm-ridges'); add(frame, mats.frame, 'farm-frames');
  }

  /** The plants, instanced by state for every plot. */
  function buildPlants(plots, o) {
    clear(groups.plants);
    const by = new Map();   // key → [{ x, z, colour, s }]
    const push = (key, x, z, colour, s = 1) => { if (!by.has(key)) by.set(key, []); by.get(key).push({ x, z, colour, s }); };
    let n = 0;
    for (const p of plots) {
      const st = plotState(o, p), c = p.crop ? cropOf(p.crop) : null;
      if (st === 'prepping' || st === 'prepped') continue;
      const shown = st === 'harvested' ? Infinity : plotPlants(p);   // 1 pod = 1 plant [MM-story_mwelnbfc_1]
      for (const [i, [x, z]] of spots(p).entries()) {
        if (i >= shown) break;
        const j = ((i * 37) % 11) / 11 - 0.5;   // a fixed per-plant jitter (no randomness: the same plot always looks the same)
        if (st === 'harvested') { push('stubble', x + j * 0.1, z, C.stubble); continue; }
        n++;
        if (st === 'planted') push('pod', x, z, levelColour(p.level).getHex());
        else if (st === 'sprout') push('sprout', x, z, C.sprout, 0.9 + j * 0.2);
        else if (st === 'plant') push('plant', x, z, C.leaf, 0.7 + p.progress * 0.4 + j * 0.15);
        else if (st === 'fruited') { push('ripe', x, z, C.leaf, 1 + j * 0.1); push('head', x, z, RIPE[c.category] || RIPE.Grain, 1 + j * 0.1); }
        else if (st === 'dead') push('dead', x + j * 0.08, z, C.dead);
      }
    }
    for (const [key, list] of by) {
      const glow = key === 'pod' || key === 'head';
      const mesh = new THREE.InstancedMesh(G[key], glow ? mats.glow : mats.plant, list.length);
      list.forEach((q, i) => {
        tmp.position.set(q.x, Y + 0.1, q.z); tmp.rotation.set(0, key === 'dead' ? 0.4 + (i % 5) * 0.5 : 0, 0); tmp.scale.setScalar(q.s); tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix); mesh.setColorAt(i, col.setHex(q.colour));
      });
      mesh.name = 'farm-' + key; mesh.castShadow = !glow;
      groups.plants.add(mesh);
    }
    counts = { ...counts, plants: n };
  }

  /** A farm building: the kit's GLB when outposts.json lists it, else a built-in shape. */
  function placeholder(kind) {
    const g = new THREE.Group();
    const m = (geo, color, y = 0) => { const x = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); x.position.y = y; x.castShadow = true; g.add(x); return x; };
    if (kind === 'farmhouse') { m(new THREE.BoxGeometry(1.5, 0.6, 1.2), 0x9a6a3c, 0.3); const roof = m(new THREE.ConeGeometry(1.15, 0.5, 4), 0x6b2e22, 0.85); roof.rotation.y = Math.PI / 4; m(new THREE.BoxGeometry(0.3, 0.32, 0.05), 0xffc86a, 0.2).position.z = 0.62; }
    else if (kind === 'silo') { m(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 16), 0xb8bec6, 0.8); m(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x8f969e, 1.6); }
    else { m(new THREE.BoxGeometry(0.6, 0.4, 0.6), 0x4d7fa8, 0.2); m(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), 0x7d8790, 0.55); }
    return { object: g, setLook(l = {}) { g.scale.y = Math.max(0.05, l.rise ?? 1); }, update() {}, dispose() { g.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); } };
  }
  const SLUG = { farmhouse: 'farmhouse', silo: 'silo', pump: 'pump' };
  async function syncBuildings(o, now) {
    const want = new Map(Object.entries((o.farm && o.farm.buildings) || {}));
    for (const [id, e] of built) if (!want.has(id)) { groups.buildings.remove(e.holder); e.inst.dispose && e.inst.dispose(); built.delete(id); }
    for (const [id, b] of want) {
      let e = built.get(id);
      if (!e) {
        const holder = new THREE.Group(); holder.position.set(b.x + b.w / 2, Y + 0.07, b.y + b.h / 2);
        e = { holder, inst: placeholder(b.kind), kind: b.kind };
        holder.add(e.inst.object); groups.buildings.add(holder); built.set(id, e);
        const slug = SLUG[b.kind];
        if (kit && kit.manifest && kit.manifest[slug]) {   // swap in the GLB once loaded
          kit.make(slug).then((inst) => {
            if (built.get(id) !== e) { inst.dispose && inst.dispose(); return; }
            holder.remove(e.inst.object); e.inst.dispose(); e.inst = inst; holder.add(inst.object);
            // the kit's models are made at 2 units a cell, like the pad buildings the outpost scene halves
            // (padModelScale on a 2-cell pad); one scale for every farm building, so the 1-cell Pump is not quartered
            holder.scale.setScalar(KIT_SCALE);
          }).catch(() => {});
        }
      }
      const rise = b.done > now ? 0.2 + 0.8 * Math.max(0, 1 - (b.done - now) / 60000) : 1;
      e.inst.setLook && e.inst.setLook({ rise });
    }
    counts = { ...counts, buildings: built.size };
  }

  /** Bring the picture to the outpost at `now` (cheap when nothing changed: a signature of plot states). */
  function sync(o, now = o.t) {
    const plots = Object.values((o.farm && o.farm.plots) || {});
    const s = plots.map((p) => `${p.id}:${p.x},${p.y}:${plotState(o, p, now)}:${p.crop || ''}:${p.level || ''}:${Math.floor((p.progress || 0) * 10)}`).join('|');
    if (s !== sig) { sig = s; buildBeds(plots, o); buildPlants(plots, o); counts = { ...counts, plots: plots.length }; }
    syncBuildings(o, now);
  }

  // the selection outline (placement and its ghost are the battle's own: render3d/overlays/placement.js, S6)
  let selMesh = null;
  function select(rect) {
    if (selMesh) { groups.marks.remove(selMesh); selMesh.geometry.dispose(); selMesh = null; }
    if (!rect) return;
    const { x, y, w, h } = rect, t = 0.08, cx = x + w / 2, cz = y + h / 2;
    selMesh = new THREE.Mesh(mergeGeos(THREE, [
      new THREE.BoxGeometry(w + 0.1, 0.03, t).translate(cx, Y + 0.16, y - 0.05), new THREE.BoxGeometry(w + 0.1, 0.03, t).translate(cx, Y + 0.16, y + h + 0.05),
      new THREE.BoxGeometry(t, 0.03, h + 0.1).translate(x - 0.05, Y + 0.16, cz), new THREE.BoxGeometry(t, 0.03, h + 0.1).translate(x + w + 0.05, Y + 0.16, cz),
    ]), mats.sel);
    selMesh.name = 'farm-selection';
    groups.marks.add(selMesh);
  }

  return {
    group: root, sync, select,
    update(dt) { clock += dt; },
    counts: () => ({ ...counts }),
    setVisible(v) { root.visible = v; },
    dispose() {
      r.scene.remove(root);
      for (const g of Object.values(groups)) clear(g);
      for (const e of built.values()) e.inst.dispose && e.inst.dispose();
      for (const g of Object.values(G)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
    },
  };
}
