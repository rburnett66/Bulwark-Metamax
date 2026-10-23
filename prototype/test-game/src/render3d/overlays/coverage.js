/**
 * src/render3d/overlays/coverage.js — selection range rings and the DEFENSIVE COVERAGE map in the battle view.
 * [MM-task_mvbry998_r]
 *
 * Owner 2026-10-16: "selecting a tower shows its range and the range of similar units (coverage map)". The 2D
 * view's rule (render/renderer.js, "selection range circle — plus DEFENSIVE COVERAGE"), carried over and extended:
 *   - a SELECTED tower: a white outline on its footprint and a bright dashed ring at its range; every other live
 *     tower of the same kind shows its range too — a faint ring over a faint fill, so overlaps stack brighter and
 *     the defensive net and its gaps read at a glance (amber for anti-ground, blue for anti-air);
 *   - while PLACING a tower (build tool armed): the same coverage map plus the ghost's own range at the hover cell,
 *     so the player sees the gap they are filling before they pay;
 *   - while placing a MINE: every armed mine's trigger ring (the minefield's gaps);
 *   - a selected UNIT: a ring on it and a dashed ring at its attack reach.
 * planCoverage is pure (state, ui, def lookup → ring list); createCoverageView draws it as ONE instanced draw.
 */
import { cellToWorld } from '../camera.js';
import { towerRange } from '../../data/tables.js';

export const COVER_COLORS = Object.freeze({ antiGround: [0.88, 0.69, 0.44], antiAir: [0.44, 0.63, 0.88], select: [1, 1, 1], unit: [1, 0.5, 0.5], mine: [0.88, 0.19, 0.19] });
const TOWER = new Set(['antiGround', 'antiAir']);

// a placed structure's reach at its tier — upgrades add range (tables.towerRange); build previews are tier 1
const rangeOf = (getDef, id, tier) => { try { return towerRange(getDef(id), tier); } catch (e) { return 0; } };

/**
 * → [{ x, z, r | w,h, shape: 'circle'|'square', dash, fill, color: [r,g,b], alpha, primary }]
 * getDef = tables getStructureDef.
 */
export function planCoverage(state, ui, getDef) {
  const out = [];
  if (!state || !ui) return out;
  const structures = state.structures ? Array.from(state.structures.values()) : [];
  const centre = (s) => { const fp = s.footprint || { w: 1, h: 1 }; return { x: s.pos.x + fp.w / 2, z: s.pos.y + fp.h / 2, w: fp.w, h: fp.h }; };
  const coverage = (kind, skipId) => {
    for (const s of structures) {
      if (s.id === skipId || s.kind !== kind || s.lifecycle === 'Destroyed' || !(s.hp > 0)) continue;
      const r = rangeOf(getDef, s.structId, s.tier);
      if (r <= 0) continue;
      const c = centre(s);
      out.push({ shape: 'circle', x: c.x, z: c.z, r, dash: 0, fill: 1, color: COVER_COLORS[kind], alpha: 0.42, primary: false });
    }
  };
  const sel = ui.selectedStructureId != null && state.structures ? state.structures.get(ui.selectedStructureId) : null;
  if (sel && sel.pos) {
    const c = centre(sel), r = rangeOf(getDef, sel.structId, sel.tier);
    if (TOWER.has(sel.kind) && r > 0) coverage(sel.kind, sel.id);
    out.push({ shape: 'square', x: c.x, z: c.z, w: c.w, h: c.h, dash: 0, fill: 0, color: COVER_COLORS.select, alpha: 0.95, primary: true });
    if (r > 0) out.push({ shape: 'circle', x: c.x, z: c.z, r, dash: 1, fill: 0.35, color: COVER_COLORS.select, alpha: 0.85, primary: true });
  }
  if (ui.buildSelection) {
    let def = null;
    try { def = getDef(ui.buildSelection); } catch (e) { def = null; }
    if (def && TOWER.has(def.kind)) {
      if (!sel) coverage(def.kind, null);
      if (ui.hoverCell && def.range > 0) {
        const fp = def.footprint || { w: 1, h: 1 };
        out.push({ shape: 'circle', x: ui.hoverCell.x + fp.w / 2, z: ui.hoverCell.y + fp.h / 2, r: def.range, dash: 1, fill: 0.35,
          color: ui.hoverValid ? COVER_COLORS.select : COVER_COLORS.mine, alpha: 0.8, primary: true });
      }
    } else if (def && def.kind === 'mine' && state.mines) {
      for (const m of state.mines.values()) {
        if (m.state !== 'armed') continue;
        out.push({ shape: 'circle', x: m.pos.x + 0.5, z: m.pos.y + 0.5, r: def.triggerRadius || 0.45, dash: 0, fill: 1, color: COVER_COLORS.mine, alpha: 0.45, primary: false });
      }
    }
  }
  if (ui.selectedUnitId != null && state.units) {
    const u = state.units.get(ui.selectedUnitId);
    if (u && u.hp > 0 && u.pos) {
      const x = cellToWorld(u.pos.x), z = cellToWorld(u.pos.y);
      out.push({ shape: 'circle', x, z, r: 0.34, dash: 0, fill: 0, color: COVER_COLORS.unit, alpha: 0.95, primary: true });
      if (u.range > 0) out.push({ shape: 'circle', x, z, r: u.range, dash: 1, fill: 0.3, color: COVER_COLORS.unit, alpha: 0.7, primary: true });
    }
  }
  return out;
}

const LINE = 0.08;   // ring / outline width, cells

export function createCoverageView(THREE, scene, { cap = 256 } = {}) {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);      // rgb, alpha
  const iShape = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);    // shape (0 circle, 1 square), dash count, fill, primary
  const iXf = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);       // x, z, half-width, half-height (cells)
  geo.setAttribute('iCol', iCol); geo.setAttribute('iShape', iShape); geo.setAttribute('iXf', iXf);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uLine: { value: LINE } },
    vertexShader: `attribute vec4 iCol; attribute vec4 iShape; attribute vec4 iXf; varying vec4 vCol; varying vec4 vShape; varying vec2 vP; varying vec2 vHalf;
      void main() {
        vCol = iCol; vShape = iShape; vP = position.xz; vHalf = iXf.zw;
        vec3 w = vec3(iXf.x + position.x * iXf.z, 0.07 + iShape.w * 0.01, iXf.y + position.z * iXf.w);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `uniform float uT, uLine; varying vec4 vCol; varying vec4 vShape; varying vec2 vP; varying vec2 vHalf;
      void main() {
        float a = 0.0;
        if (vShape.x > 0.5) {                       // footprint outline
          vec2 e = (1.0 - abs(vP)) * vHalf;          // distance to the edge, cells
          a = 1.0 - smoothstep(uLine * 0.6, uLine * 1.2, min(e.x, e.y));
        } else {
          float d = length(vP);
          if (d > 1.0) discard;
          float edge = (1.0 - d) * vHalf.x;          // distance to the rim, cells
          float ring = 1.0 - smoothstep(uLine * 0.5, uLine * 1.1, edge);
          if (vShape.y > 0.5) {                      // dashed: n dashes round the rim
            float ang = atan(vP.y, vP.x) / 6.2831853 + 0.5;
            ring *= step(0.45, fract(ang * vShape.y + uT * 0.08));
          }
          float fill = vShape.z * 0.26 * (0.7 + 0.3 * d);
          a = max(ring, fill);
        }
        float pulse = vShape.w > 0.5 ? 0.85 + 0.15 * sin(uT * 4.0) : 1.0;
        gl_FragColor = vec4(vCol.rgb, a * vCol.a * pulse);
      }`,
    transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 8; mesh.visible = false; mesh.name = 'coverage';
  scene.add(mesh);
  let clock = 0, sig = '';
  return {
    mesh,
    /** Draw this frame's plan. Returns the ring count. */
    sync(plan, dt) {
      clock += dt || 0; mat.uniforms.uT.value = clock;
      const n = Math.min(cap, plan.length);
      const s = plan.length ? plan.map((p) => `${p.shape}${p.x.toFixed(2)},${p.z.toFixed(2)},${(p.r || p.w).toFixed(2)},${p.alpha},${p.color}`).join('|') : '';
      if (s !== sig) {
        sig = s;
        for (let i = 0; i < n; i++) {
          const p = plan[i];
          iCol.array.set([p.color[0], p.color[1], p.color[2], p.alpha], i * 4);
          const sq = p.shape === 'square';
          iShape.array.set([sq ? 1 : 0, p.dash ? Math.max(8, Math.round(2 * Math.PI * p.r / 0.55)) : 0, p.fill || 0, p.primary ? 1 : 0], i * 4);
          iXf.array.set(sq ? [p.x, p.z, p.w / 2, p.h / 2] : [p.x, p.z, p.r, p.r], i * 4);
        }
        iCol.needsUpdate = iShape.needsUpdate = iXf.needsUpdate = true;
        geo.instanceCount = n;
      }
      mesh.visible = n > 0;
      return n;
    },
    dispose() { scene.remove(mesh); geo.dispose(); base.dispose(); mat.dispose(); },
  };
}
