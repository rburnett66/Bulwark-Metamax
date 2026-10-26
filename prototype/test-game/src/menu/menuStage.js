/**
 * src/menu/menuStage.js — the menu's live 3D: homeworld globes, the player's landing craft and the planet's resource
 * models, all drawn by ONE WebGL canvas laid over the menu (a phone gets one extra context, not one per picture).
 * [MM-story_mvcnxgt8_13]
 *
 * The menu marks where pictures go with plain elements and this draws into their on-screen rectangles (scissor):
 *   <div data-globe="water" data-spin="drag">   a homeworld globe (data-spin="drag": the player can spin it)
 *        data-survey="1"                          … with the survey ship in orbit (a planet open to campaign) [MM-story_mvoi0e36_3]
 *   <div data-craft="system">                   a landing craft on a slow turntable (FACTION_CRAFT key or lc_*)
 *   <div data-res="water:rare">                 a resource model (planet : tier) turning on a plinth
 *   <div data-galaxy data-target data-mode>      the 3D galaxy and the planet ⇄ galaxy fly (galaxyStage.js) [MM-story_mvftq5q8_l]
 * Change the attribute and the next frame draws the new subject. Hidden elements cost nothing; the loop stops while
 * the menu is closed (stop()) or the tab is hidden. If WebGL is unavailable createMenuStage returns null and the
 * menu keeps its baked planet PNGs (each globe element carries one as a fallback <img>).
 *
 *   const st = createMenuStage(THREE, rootEl);   st.start() · st.stop() · st.dispose()
 */
import { makeGlobe } from '../render3d/planet/globe.js';
import { makeSurveyShip } from '../render3d/planet/surveyShip.js';
import { createCraft3D } from '../render3d/craft/craft3d.js';
import { landingPose, phaseStart } from '../render3d/craft/landing.js';
import { resourceModel } from '../render3d/resources/models.js';
import { mergeResourceModel } from '../render3d/resources/resources3d.js';
import { createGalaxyStage } from './galaxyStage.js';

const SPIN = 0.12;          // rad/s a globe turns on its own
const TURN = 0.35;          // rad/s the craft / resource turntables

export function createMenuStage(THREE, root, { pixelRatio } = {}) {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.className = 'bwm-gl';
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(pixelRatio || window.devicePixelRatio || 1, 2));
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0);
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.LinearEncoding;
  root.appendChild(canvas);
  root.classList.add('bwm-live');

  // ── globes: one scene per planet, built on first sight; a shared sphere
  const sphere = new THREE.SphereGeometry(1, 96, 64);
  const gcam = new THREE.PerspectiveCamera(26, 1, 0.1, 20); gcam.position.set(0, 0, 6);
  const globes = new Map();   // key → { scene, g }
  const globe = (k) => {
    let w = globes.get(k);
    if (!w) { const scene = new THREE.Scene(), g = makeGlobe(THREE, k, { geo: sphere }); scene.add(g.root); w = { scene, g }; globes.set(k, w); }
    return w;
  };

  // ── the craft: its own lit scene, a turntable
  const lit = (scene, sunPos) => {
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3f48, 0.75), amb = new THREE.AmbientLight(0xffffff, 0.2);
    const sun = new THREE.DirectionalLight(0xfff2e0, 1.15); sun.position.set(sunPos[0], sunPos[1], sunPos[2]);
    const rim = new THREE.DirectionalLight(0x9fc8ff, 0.55); rim.position.set(4, 3, 6);
    scene.add(hemi, amb, sun, rim);
  };
  const craftScene = new THREE.Scene(); lit(craftScene, [-5, 8, -3]);
  const ccam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  let craft = null, craftKey = null, craftYaw = 0.9;
  function setCraft(key) {
    if (key === craftKey) return;
    if (craft) { craft.dispose(); craft = null; }
    craftKey = key;
    try {
      craft = createCraft3D(THREE, craftScene, key, { env: { sky: 0xc4d8ff, ground: 0x4a5058 } });
      craft.place({ x: -0.5, y: -0.5 });
      craft.apply(landingPose(phaseStart('hatches'), { fromDeg: 180 }));   // landed, hatches shut, gear down
    } catch (e) { craft = null; }
  }

  // ── resources: a lit scene per planet:tier, on a dark plinth
  const resScenes = new Map();
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true }), glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const plinthGeo = new THREE.CylinderGeometry(0.62, 0.7, 0.08, 28), plinthMat = new THREE.MeshLambertMaterial({ color: 0x1c222b });
  const rcam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const resource = (id) => {
    let w = resScenes.get(id);
    if (!w) {
      const [planet, tier] = id.split(':'), scene = new THREE.Scene(); lit(scene, [-3, 6, 4]);
      const turn = new THREE.Group(); scene.add(turn);
      const plinth = new THREE.Mesh(plinthGeo, plinthMat); plinth.position.y = -0.04; scene.add(plinth);
      try {
        const m = mergeResourceModel(THREE, resourceModel(planet, tier));
        for (const [geo, mat] of [[m.lit, litMat], [m.glow, glowMat]]) if (geo) turn.add(new THREE.Mesh(geo, mat));
      } catch (e) { /* unknown planet / tier: an empty plinth */ }
      w = { scene, turn, seed: resScenes.size * 1.3 }; resScenes.set(id, w);
    }
    return w;
  };

  // ── drag to spin (data-spin="drag" globes)
  const spin = new WeakMap();   // element → { extra, vel, drag }
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('[data-spin="drag"]');
    if (!el) return;
    const s = spin.get(el) || { extra: 0, vel: SPIN }; s.drag = { x: e.clientX, t: performance.now() }; spin.set(el, s);
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
  });
  root.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-spin="drag"]'), s = el && spin.get(el);
    if (!s || !s.drag) return;
    const dx = e.clientX - s.drag.x, now = performance.now();
    s.extra += dx * 0.01; s.vel = SPIN + (dx * 0.01) / Math.max(0.016, (now - s.drag.t) / 1000) * 0.15; s.drag = { x: e.clientX, t: now };
  });
  const endDrag = (e) => { const el = e.target.closest && e.target.closest('[data-spin="drag"]'), s = el && spin.get(el); if (s) s.drag = null; };
  root.addEventListener('pointerup', endDrag); root.addEventListener('pointercancel', endDrag);

  // ── the galaxy (built on first sight); a click in galaxy view picks a system
  let galaxy = null;
  let downAt = null;
  root.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('[data-galaxy]')) downAt = { x: e.clientX, y: e.clientY }; });
  root.addEventListener('pointerup', (e) => {
    const el = e.target.closest && e.target.closest('[data-galaxy]');
    if (!el || !galaxy || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) { downAt = null; return; }
    downAt = null;
    const lab = e.target.closest('[data-sys]');
    const r = el.getBoundingClientRect(), key = lab ? lab.dataset.sys : galaxy.pick(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (key) el.dispatchEvent(new CustomEvent('bwm-galaxy-pick', { detail: { key } }));
  });

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, last = 0, running = false;
  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
    const W = canvas.clientWidth, H = canvas.clientHeight, pr = renderer.getPixelRatio();
    if (W < 2 || H < 2) { raf = requestAnimationFrame(frame); return; }
    if (canvas.width !== Math.round(W * pr) || canvas.height !== Math.round(H * pr)) renderer.setSize(W, H, false);
    renderer.setScissor(0, 0, W, H); renderer.setViewport(0, 0, W, H); renderer.clear();
    const cr = canvas.getBoundingClientRect(), mv = reduce ? 0 : 1;
    const draw = (el, scene, cam) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < cr.top || r.top > cr.bottom || r.right < cr.left || r.left > cr.right) return false;
      // clip to a scrolling panel the element sits in (the dossier's resource tiles scroll under the campaign box)
      const sc = el.closest('[data-clip]'), c = sc ? sc.getBoundingClientRect() : r;
      const L = Math.max(r.left, c.left), T = Math.max(r.top, c.top), R = Math.min(r.right, c.right), B = Math.min(r.bottom, c.bottom);
      if (R - L < 1 || B - T < 1) return false;
      const x = r.left - cr.left, y = cr.bottom - r.bottom;
      renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(L - cr.left, cr.bottom - B, R - L, B - T);
      cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      return true;
    };
    // the galaxy first: it fills a large area, and each render clears its own rectangle [MM-story_mvftq5q8_l]
    const ge = root.querySelector('[data-galaxy]');
    if (ge && ge.offsetParent) {
      if (!galaxy) galaxy = createGalaxyStage(THREE, makeGlobe);
      const r = ge.getBoundingClientRect();
      const gcam2 = galaxy.update(dt, ge, r.width, r.height, pr, reduce);
      drawGalaxy(ge, galaxy.scene, gcam2);
    }
    const seen = new Set();
    for (const el of root.querySelectorAll('[data-globe]')) {
      if (!el.offsetParent) continue;
      const w = globe(el.dataset.globe);
      if (!seen.has(w)) {   // one advance per globe per frame even when it shows twice
        seen.add(w);
        const s = spin.get(el);
        if (s && !s.drag) s.vel += (SPIN - s.vel) * Math.min(1, dt * 1.5);
        w.g.spin(dt * mv, s ? s.vel : SPIN);
        if (w.ship) w.ship.update(dt * mv);
      }
      // the survey ship: in orbit round a planet the player can campaign on; a locked planet's space stays clean
      const survey = el.dataset.survey === '1';
      if (survey && !w.ship) { w.ship = makeSurveyShip(THREE); w.scene.add(w.ship.root); }
      if (w.ship) w.ship.root.visible = survey;
      // keep the whole globe + halo in frame whatever the box's shape
      const r = el.getBoundingClientRect(), a = r.width / Math.max(1, r.height);
      gcam.position.z = a >= 1 ? 6 : 6 / a;
      draw(el, w.scene, gcam);
    }
    const ce = root.querySelector('[data-craft]');
    if (ce && ce.offsetParent) {
      setCraft(ce.dataset.craft);
      if (craft) {
        craftYaw += dt * TURN * mv;
        ccam.position.set(Math.cos(craftYaw) * 7.2, 3.4, Math.sin(craftYaw) * 7.2); ccam.lookAt(0, 0.55, 0);
        draw(ce, craftScene, ccam);
      }
    }
    for (const el of root.querySelectorAll('[data-res]')) {
      if (!el.offsetParent) continue;
      const w = resource(el.dataset.res);
      w.turn.rotation.y += dt * TURN * 1.4 * mv;
      rcam.position.set(0, 1.0, 2.35); rcam.lookAt(0, 0.28, 0);
      draw(el, w.scene, rcam);
    }
    raf = requestAnimationFrame(frame);
  }
  // the galaxy camera carries its own view offset; draw it without touching its projection
  function drawGalaxy(el, scene, cam) {
    const cr = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const x = r.left - cr.left, y = cr.bottom - r.bottom;
    renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height);
    renderer.render(scene, cam);
  }
  const onVis = () => { if (document.hidden) api.stop(); else if (wanted) api.start(); };
  document.addEventListener('visibilitychange', onVis);
  let wanted = false;

  const api = {
    canvas,
    start() { wanted = true; if (running || document.hidden) return; running = true; last = 0; if (!raf) raf = requestAnimationFrame(frame); },
    stop() {
      running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
      // wipe the last frame so a picture never lingers over a screen that has none
      renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
    },
    pause() { wanted = false; api.stop(); },
    get running() { return running; },
    dispose() {
      api.pause(); document.removeEventListener('visibilitychange', onVis);
      for (const w of globes.values()) { w.g.dispose(); if (w.ship) w.ship.dispose(); }
      if (galaxy) galaxy.dispose();
      if (craft) craft.dispose();
      sphere.dispose(); litMat.dispose(); glowMat.dispose(); plinthGeo.dispose(); plinthMat.dispose();
      renderer.dispose(); canvas.remove(); root.classList.remove('bwm-live');
    },
  };
  return api;
}
