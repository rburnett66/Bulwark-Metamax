/**
 * src/render3d/index.js — the three.js battle view, behind ?renderer=three (plan v2.2 §6.12).
 *
 * T3.1 SKELETON [MM-task_mv883c5d_b]: baked ground, the battle camera (pan + zoom; yaw locked), one sun
 * with a static shadow map; base + structures as placeholder primitives (markers.js) until T4 / LPS.
 * T5 [MM-story_mv77hv5d_7]: units are the 3D part-list models (units/models3d.js) with LOD + planar
 * shadows, chosen per sim unit by units/modelKeys.js. Later T3 tasks add placement, overlays and FX.
 * T4 [MM-story_mv77hsxk_6]: plateaus, rocks and trees as low-poly 3D geometry from the SIM's map
 * (obstructions/), casting into the static shadow map; units receive it.
 * T3b [MM-story_mv79mi1o_d]: expected-path lines from each live wave origin's spawn point to the base, on the
 * sim's own nav grid (overlays/).
 *
 * READ-ONLY: it reads the sim state handed to renderFrame and never writes to it.
 * The default game never loads this module or three.js — main.js imports it dynamically under the flag.
 *
 * Surface (mirrors the Pixi renderer's, so main.js can swap it):
 *   const r = await createRenderer3D(mountEl, map, { slug, baseUrl })
 *   renderFrame(r, state, ui, events, dt)
 *   destroyRenderer(r)
 */
import { CAMERA, createCameraState, clampCamera, cameraPose, panByPixels, zoomBy } from './camera.js';
import { createLights } from './lighting.js';
import { bakedLevelDir, checkLevelAgainstMap } from './level.js';
import { createHeadingTracker } from './heading.js';
import { buildBakedGround } from './ground/baked.js';
import { createMarkers } from './markers.js';
import { createUnits3D } from './units/models3d.js';
import { buildLowPolyObstructions } from './obstructions/lowpoly.js';
import { createPathLines } from './overlays/pathLinesModel.js';
import { createPathLinesView } from './overlays/pathLines.js';
import { buildUnitViews, createModelResolver } from './units/unitViews.js';

const THREE_URL = new URL('../../vendor/three.module.js', import.meta.url).href;

function makeBanner(mountEl) {
  const el = document.createElement('div');
  el.className = 'r3d-banner';
  Object.assign(el.style, {
    position: 'absolute', left: '50%', top: '56px', transform: 'translateX(-50%)', zIndex: 5,
    maxWidth: '86%', padding: '6px 12px', borderRadius: '6px', background: 'rgba(120,30,20,0.92)',
    color: '#fff', font: '600 13px system-ui, sans-serif', textAlign: 'center', pointerEvents: 'none', display: 'none',
  });
  mountEl.appendChild(el);
  return {
    show(text) { el.textContent = text; el.style.display = 'block'; },
    hide() { el.style.display = 'none'; },
    remove() { el.remove(); },
  };
}

function attachCameraInput(el, r) {
  const pointers = new Map();
  let pinch0 = null;
  const on = (type, fn, opts) => { el.addEventListener(type, fn, opts); r.listeners.push([type, fn, opts]); };
  on('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: r.cam.dist };
    }
  });
  on('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      panByPixels(r.cam, dx, dy, el.clientHeight);
    } else if (pointers.size === 2 && pinch0) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0) r.cam.dist = pinch0.dist * (pinch0.d / d);
    }
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = null; };
  on('pointerup', up);
  on('pointercancel', up);
  on('wheel', (e) => { e.preventDefault(); zoomBy(r.cam, Math.exp(e.deltaY * 0.001)); }, { passive: false });
}

export async function createRenderer3D(mountEl, map, opts = {}) {
  const THREE = opts.THREE || await import(THREE_URL);
  const slug = opts.slug || null;
  const baseUrl = opts.baseUrl || '';

  const host = document.createElement('div');
  host.className = 'r3d-host';
  Object.assign(host.style, { position: 'absolute', inset: '0', zIndex: 0, touchAction: 'none' });
  mountEl.appendChild(host);
  const banner = makeBanner(mountEl);

  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0f1412, 1);
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', margin: '0' });
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, 1, CAMERA.near, CAMERA.far);
  const lights = createLights(THREE, renderer, scene, map.cols, map.rows, opts.shadowSize || 2048);
  const markers = createMarkers(THREE, scene);
  const units3d = createUnits3D(THREE, scene, { sunDir: lights.dir });
  markers.setBase(map.base);
  // Obstructions come from the sim's own map (terrain codes + bakedBlocking + authored decor), not from the
  // baked level — so they match what the units actually path around. Workbook maps have no terrain codes
  // (T0 audit §11) and get none.
  const obstructions = map.terrain ? buildLowPolyObstructions(THREE, map) : null;
  if (obstructions) scene.add(obstructions.group);
  const pathLines = createPathLines();
  const pathLinesView = createPathLinesView(THREE, scene);

  const r = {
    THREE, renderer, scene, camera, lights, markers, units3d, obstructions, pathLines, pathLinesView, host, banner, map,
    clock: 0,
    cam: createCameraState(map),
    headings: createHeadingTracker(),
    resolveModel: createModelResolver(),
    listeners: [],
    status: 'loading',
    problems: [],
    stats: { calls: 0, triangles: 0, units: 0, lines: 0 },
    destroyed: false,
  };
  attachCameraInput(canvas, r);

  // The baked ground: content/maps/baked/<slug>/. Missing or stale → say so on screen.
  if (!slug) {
    r.status = 'no-level';
    banner.show('3D view: this map has no baked level (only Terrain Forge maps are baked) — run tools/terrain3d-proto/bake3d.mjs');
  } else {
    const dir = baseUrl + bakedLevelDir(slug);
    try {
      const res = await fetch(dir + 'level.json');
      if (!res.ok) throw new Error(`no baked level at ${dir} (HTTP ${res.status})`);
      const level = await res.json();
      const check = checkLevelAgainstMap(level, map);
      r.problems = check.problems;
      if (r.destroyed) return r;
      scene.add(await buildBakedGround(THREE, renderer, dir, level));
      lights.invalidateShadows();
      r.status = check.ok ? 'ready' : 'stale';
      if (!check.ok) banner.show(`3D view: baked level ${slug} does not match this map — ${check.problems.join('; ')}`);
    } catch (e) {
      r.status = 'error';
      r.problems = [String(e && e.message || e)];
      banner.show(`3D view: ${r.problems[0]}`);
      console.error('[render3d]', e);
    }
  }
  return r;
}

function resize(r) {
  const w = r.host.clientWidth || 1, h = r.host.clientHeight || 1;
  if (r._w === w && r._h === h) return;
  r._w = w; r._h = h;
  r.renderer.setSize(w, h, false);
  r.camera.aspect = w / h;
  r.camera.updateProjectionMatrix();
}

export function renderFrame(r, state, ui, events, dt) {
  if (!r || r.destroyed) return;
  resize(r);

  // Camera
  clampCamera(r.cam, r.map.cols, r.map.rows);
  const pose = cameraPose(r.cam);
  r.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  r.camera.lookAt(pose.target.x, pose.target.y, pose.target.z);

  // Static set: structures (re-render the shadow map only when it changed)
  if (state && state.structures) {
    if (r.markers.setStructures(Array.from(state.structures.values()))) r.lights.invalidateShadows();
  }

  // Live units: the 3D models (T5). Live planar shadows on every tier for now; the tier table (quality.js)
  // turns them off on Low when it lands.
  if (state && state.units) {
    const views = buildUnitViews(state, r.map, r.headings, r.resolveModel, Math.min(0.1, Math.max(0, dt || 0)));   // smooth turning; clamped so a stalled frame can't swing a whole turn at once
    r.stats.units = r.units3d.setUnits(views, r.cam.dist, true);
  }

  // Expected-path lines (T3b): which origins are live, their routes on the sim's current grid, fades.
  r.clock += Math.max(0, dt || 0);
  if (state) {
    const { geometryDirty } = r.pathLines.update(state, r.map, dt || 0);
    r.stats.lines = r.pathLinesView.sync(r.pathLines.lines, geometryDirty, r.clock);
  }

  r.renderer.info.reset();
  r.renderer.render(r.scene, r.camera);
  r.stats.calls = r.renderer.info.render.calls;
  r.stats.triangles = r.renderer.info.render.triangles;
}

export function destroyRenderer(r) {
  if (!r || r.destroyed) return;
  r.destroyed = true;
  const canvas = r.renderer.domElement;
  for (const [type, fn, opts] of r.listeners) canvas.removeEventListener(type, fn, opts);
  r.markers.dispose();
  r.units3d.dispose();
  r.pathLinesView.dispose();
  r.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  r.renderer.dispose();
  r.host.remove();
  r.banner.remove();
}
