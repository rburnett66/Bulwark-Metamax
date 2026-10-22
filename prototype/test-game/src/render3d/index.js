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
 * LP [MM-story_mv87jxp2_7]: the low-poly organic ground (ground/lowpoly.js) is the default ground; a world
 * palette + its lighting (styles/lowpoly-palettes.js) recolours ground, tufts, rocks and trees. World: ?world=
 * (preview) → the map's `world` → Meadow. ?ground=baked keeps the previous baked-texture ground.
 *
 * READ-ONLY: it reads the sim state handed to renderFrame and never writes to it.
 * The default game never loads this module or three.js — main.js imports it dynamically under the flag.
 *
 * Surface (mirrors the Pixi renderer's, so main.js can swap it):
 *   const r = await createRenderer3D(mountEl, map, { slug, baseUrl, world, ground })
 *   setWorld(r, key)     — rebuild ground + obstructions in another world palette (same geometry)
 *   renderFrame(r, state, ui, events, dt)
 *   destroyRenderer(r)
 *   eventToCell(r, ev, ui) / screenToCell(r, px, py) / cellToScreen(r, cell)   — picking (T3.2)
 *   r.canvas             — the element input.js binds to (createInput(..., { pick, tapToAct: true }))
 *   r.quality            — { key, source, choice, auto } the tier in use (T3.5 quality.js); opts.qualityChoice /
 *                          opts.qualityQuery pick it (Settings / ?quality=), else auto
 * T3.2 [MM-task_mv9s9lvj_1]: input acts through these (tap = act, drag = pan), and the placement ghost
 * (overlays/placement.js) shows the armed build tool green/red from ui.hoverValid.
 * T3.3 [MM-task_mv9s9mza_2]: projectiles fly at height and arrive as hit flashes; muzzle, kill, destroyed, mine and
 * base-cannon flashes — fx/combatFxModel.js decides them from state + events, fx/combatFx.js draws them in one
 * instanced additive call. opts.projFx / opts.projScale (getters) carry the authored shot looks + map damping.
 * FX [MM-story_mv87jvnb_5]: world-impact effects — sparks off armour, booms, burning wrecks, turrets blown off —
 * from the sim's damage / kill events (fx/impacts.js model, fx/impactsView.js draw). Tier budget: r.impacts.setCaps().
 * T3.4 [MM-task_mv9s9o5d_3]: the ring fog (overlays/fog.js) veils everything outside the current wave window with
 * a thin outline and flashes a ring as it opens. Camera rules: in battle pan + zoom only and a leftover yaw eases
 * back to 0 when the wave starts; outside it, right-drag or a two-finger twist turns the view.
 * LC [MM-epic_mvbkrvnz_2]: the base is the player's LANDING CRAFT (craft/craft3d.js; opts.craft = faction or craft
 * key, default the neutral craft). On load it flies in, lands, opens its hatches and the sim's harvesters drive
 * down the ramps to their docks (craft/landing.js; opts.landing === false parks it). The roof weapon follows the
 * base cannon's aim. Resource fields are the battle planet's own resource models (resources/; opts.planet =
 * faction key of the homeworld), falling back to the crystal shards when no planet is known.
 */
import { CAMERA, createCameraState, clampCamera, cameraPose, panByPixels, zoomBy, screenToGroundCell, groundCellToScreen, stepYaw, twistBy, wrapYaw, YAW_PER_PX, touchSlotPoint, cellToWorld, fitCameraToRect, clearBox } from './camera.js';
import { createFogTracker, fogWindow, newAreaFocus } from './overlays/fogModel.js';
import { resolveTier, probeEnv, pixelRatioFor } from './quality.js';
import { createFogView, flightParallax } from './overlays/fog.js';
import { createContacts, createContactsView } from './overlays/contacts.js';
import { createPlacementGhost } from './overlays/placement.js';
import { createLights } from './lighting.js';
import { bakedLevelDir, checkLevelAgainstMap } from './level.js';
import { createHeadingTracker } from './heading.js';
import { buildBakedGround } from './ground/baked.js';
import { buildLowPolyGround, GRID as GROUND_GRID } from './ground/lowpoly.js';
import { renderMapFor } from './ground/synthTerrain.js';
import { LOWPAL, WORLD_LIGHT, resolveWorld } from './styles/lowpoly-palettes.js';
import { PLANETS } from '../data/planets.js';
import { createMarkers } from './markers.js';
import { createLowPolyStructures } from './structures/lowpoly.js';
import { createSystemStructures, SYSTEM_KINDS } from './structures/system3d.js';
import { createUnits3D } from './units/models3d.js';
import { buildLowPolyObstructions } from './obstructions/lowpoly.js';
import { createPathLines } from './overlays/pathLinesModel.js';
import { createPathLinesView } from './overlays/pathLines.js';
import { buildUnitViews, createModelResolver } from './units/unitViews.js';
import { createCombatFx } from './fx/combatFxModel.js';
import { createCombatFxView } from './fx/combatFx.js';
import { createRocketShots } from './fx/rocketShots.js';
import { createFlakShots } from './fx/flakShots.js';
import { createImpacts, K as FXK } from './fx/impacts.js';
import { createRepairFx } from './fx/repairFx.js';
import { createFlightPaths } from './units/flightPath.js';
import { buildHeightField, createAirLift, flightFloor } from './obstructions/heightField.js';
import { createUnitBarrels } from './units/unitBarrels.js';
import { createBuildFx } from './fx/buildFx.js';
import { createDustTrails } from './fx/dustTrail.js';
import { createTrackMarks, trackSpecs } from './fx/trackMarks.js';
import { createTrackMarksView } from './fx/trackMarksView.js';
import { UNIT_MODELS } from './units/models.js';
import { createFlashGlows } from './fx/flashLights.js';
import { createImpactsView } from './fx/impactsView.js';
import { createCraft3D } from './craft/craft3d.js';
import { createLanding, landedPose, harvesterOnRamp } from './craft/landing.js';
import { planMounts } from './structures/baseMounts.js';
import { introCamera } from './craft/introCamera.js';
import { createCannonFx, createCannonFxView, baseStyleFor, baseLaunchPitch, BASE_STYLES } from './fx/cannonFx.js';
import { planCoverage, createCoverageView } from './overlays/coverage.js';
import { createHealthBarView } from './overlays/healthBars.js';
import { createGoldPopups, createGoldPopupView } from './overlays/goldPopups.js';
import { createUnloads, createUnloadView } from './overlays/unloadFx.js';
import { createResources3D } from './resources/resources3d.js';
import { getUnitDef, getStructureDef } from '../data/tables.js';
import { emitMuzzleSmoke } from './fx/muzzleSmoke.js';

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
  const twoFinger = () => {
    const [a, b] = [...pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  on('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, turn: e.button === 2 });
    if (pointers.size === 2) {
      const t = twoFinger();
      pinch0 = { d: t.d, dist: r.cam.dist, ang: t.ang };
    }
  });
  on('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      if (r.ui && r.ui.placingPointer === e.pointerId) return;   // this finger steers the build slot, not the camera [MM-story_mvee80a0_d]
      // right-drag turns the view outside the battle; in battle (or a left/touch drag) it pans
      if (!(p.turn && twistBy(r.cam, dx * YAW_PER_PX, r.inBattle))) panByPixels(r.cam, dx, dy, el.clientHeight);
      if (dx || dy) r.userMoved = true;   // the player has the camera now: stop the pre-match auto-framing [MM-task_mveuiw7u_e]
    } else if (pointers.size === 2 && pinch0) {
      const t = twoFinger();
      if (t.d > 0) r.cam.dist = pinch0.dist * (pinch0.d / t.d);
      r.userMoved = true;
      // two-finger twist: the ground turns with the fingers (yaw + = the world turns clockwise on screen);
      // outside the battle only — in battle the twist is dropped, not stored up
      twistBy(r.cam, wrapYaw(t.ang - pinch0.ang), r.inBattle);
      pinch0.ang = t.ang;
    }
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = null; };
  on('pointerup', up);
  on('pointercancel', up);
  on('wheel', (e) => { e.preventDefault(); zoomBy(r.cam, Math.exp(e.deltaY * 0.001)); r.userMoved = true; }, { passive: false });
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
  // Quality tier (T3.5): ?quality= → the player's Settings choice → auto from this device + GPU
  const quality = resolveTier({ query: opts.qualityQuery, stored: opts.qualityChoice, env: probeEnv(window, renderer.getContext()) });
  const tier = quality.tier;
  renderer.setPixelRatio(pixelRatioFor(tier, window.devicePixelRatio || 1));
  renderer.setClearColor(0x0f1412, 1);
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', margin: '0' });
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, 1, CAMERA.near, CAMERA.far);
  const lights = createLights(THREE, renderer, scene, map.cols, map.rows, tier.shadowSize);
  // every map gets the low-poly ground: forge maps from their terrain codes, the rest from codes derived from their own
  // layout (ground/synthTerrain.js — workbook maps carry none, T0 audit §11) [MM-story_mvbr0oo5_n]
  const groundMap = renderMapFor(map);
  const lowpoly = opts.ground !== 'baked' || !slug;
  // LPS [MM-story_mv87jzov_9]: low-poly base / walls / towers / crystals on the low-poly ground; boxes under ?ground=baked
  const markers = lowpoly ? createLowPolyStructures(THREE, scene) : createMarkers(THREE, scene);
  const units3d = createUnits3D(THREE, scene, { sunDir: lights.dir });
  markers.setBase(map.base);
  // SYS [MM-story_mvbr0qfb_o]: the player's cannon / anti-air / wall draw as the System models (owner sheet)
  const system = lowpoly ? createSystemStructures(THREE, scene) : null;
  if (system) system.setBase(map.base);
  // LC: the landing craft is the base; it lands on load unless opts.landing === false
  let craft = null, landing = null, mounts = null;
  if (map.base && opts.craft !== false) {
    craft = createCraft3D(THREE, scene, opts.craft || 'system', { tier });
    craft.place(map.base);
    if (markers.setBaseVisible) markers.setBaseVisible(false);
    landing = opts.landing === false ? null : createLanding({ fromDeg: opts.landingFrom != null ? opts.landingFrom : 180 });
    // corner-slot towers mount on the hull where the craft will STAND: measure its deck in the landed pose first
    // (towers are built after touchdown), then pose it for the landing [MM-task_mvj0k7v3_k]
    craft.apply(landedPose());
    mounts = planMounts(map.base.cornerSlots, (x, z) => craft.topAt(x, z));
    if (system) system.setMounts(mounts);
    craft.apply(landing ? landing.pose() : landedPose());
    if (landing && opts.landingHeld) craft.setVisible(false);   // waits off-stage until startLanding
    if (!landing) craft.setCastShadow(true);
  }
  // LC-RES: planet resource models (replace the crystal shards when the planet is known)
  const resources = lowpoly && opts.planet ? createResources3D(THREE, scene, opts.planet) : null;
  const pathLines = createPathLines();
  const pathLinesView = createPathLinesView(THREE, scene);
  const ghost = createPlacementGhost(THREE, scene);
  const fx = createCombatFx({ seed: (map.seed | 0) || 1, caps: tier.effects });
  const fxView = createCombatFxView(THREE, scene, fx.caps.maxShots + fx.caps.maxFlashes);
  // rocket-tower rounds fly as the firing tower's tier of rocket, not a glow streak [MM-task_mvf0kzw4_l]
  const rocketShots = createRocketShots(THREE, scene);
  const flakShots = createFlakShots(THREE, scene);   // flak rounds: small black balls [MM-task_mvfqb2gm_4]
  fxView.skipRockets = true;
  fxView.skipFlak = true; fxView.skipMissiles = true;   // black balls / half-size rockets, not glow dots [MM-task_mvfqb2gm_4] [MM-task_mvfqb454_5]
  const impacts = createImpacts({ seed: (map.seed | 0) || 1, caps: tier.impactCaps });   // the tier's particle budget [MM-task_mveeqkyi_h]
  const impactsView = createImpactsView(THREE, scene, { lodGroups: units3d.lodGroups(), sunDir: lights.dir });
  const fogView = createFogView(THREE, scene, map, { detail: !!tier.cloudDetail });   // phones: the rough cloud path [MM-story_mvfk3el9_b]
  const contactsView = createContactsView(THREE, scene);   // hidden contacts: red reticles outside the play area [MM-story_mveehs1r_f]
  const baseStyle = baseStyleFor(craft && craft.def && craft.def.weaponType);   // each base fires its own weapon's look
  const cannonFx = createCannonFx({ seed: (map.seed | 0) || 1, style: baseStyle }), cannonFxView = createCannonFxView(THREE, scene, { style: baseStyle });   // the base super-cannon
  const coverageView = createCoverageView(THREE, scene);   // selection range + defensive coverage
  const healthBars = createHealthBarView(THREE, scene);      // units, damaged towers, the base once hit
  const gold = createGoldPopups(), goldView = createGoldPopupView(host);   // "$N" per kill / delivery
  const unloads = createUnloads(), unloadView = createUnloadView(THREE, scene);   // harvesters unloading at the base

  const r = {
    THREE, renderer, canvas, scene, camera, lights, markers, units3d, craft, landing, mounts, resources, landingHeld: !!(landing && opts.landingHeld), obstructions: null, ground: null, pathLines, pathLinesView, ghost, fx, fxView, impacts, impactsView, fog: createFogTracker(), fogView, contacts: createContacts(), contactsView, inBattle: false, host, banner, map, groundMap, system, cannonFx, cannonFxView, baseStyle, coverageView, healthBars, gold, goldView, unloads, unloadView, repairFx: createRepairFx(), buildFx: createBuildFx({ seed: ((map.seed | 0) || 1) + 23 }), flight: createFlightPaths(), airLift: createAirLift(), unitBarrels: createUnitBarrels(), heightField: null, dust: createDustTrails(), tracks: null, tracksView: null, flashGlows: null,
    quality, tier,
    clock: 0,
    cam: createCameraState(map), viewInsets: typeof opts.viewInsets === 'function' ? opts.viewInsets : null,
    headings: createHeadingTracker(),
    resolveModel: createModelResolver(),
    listeners: [],
    status: 'loading',
    problems: [],
    stats: { calls: 0, triangles: 0, units: 0, lines: 0, fx: 0, impacts: null },
    rocketShots, flakShots,
    fxOpts: { getDef: getUnitDef, projFx: null, projScale: 1, trail: null, boom: null, fire: null, muzzle: null, rocketTail: rocketShots.tail, missileTail: rocketShots.missileTail },
    getProjFx: typeof opts.projFx === 'function' ? opts.projFx : () => opts.projFx || null,
    getProjScale: typeof opts.projScale === 'function' ? opts.projScale : () => opts.projScale || 1,
    destroyed: false,
    world: null,
    lowpoly,
    roadMask: null,
  };
  // wheel / tread marks behind ground vehicles: specs read from the models' part lists; never on water [MM-task_mvj0wz2d_1]
  const waterSet = new Set((map.waterCells || []).map((c) => c.x + ',' + c.y));
  r.tracks = createTrackMarks(trackSpecs(UNIT_MODELS), { isWater: (x, z) => waterSet.has(Math.floor(x) + ',' + Math.floor(z)), cap: tier.trackCap || 1600 });
  r.tracksView = createTrackMarksView(THREE, scene, { cap: tier.trackCap || 1600 });
  // missiles / rockets leave smoke and exhaust through the world-impact particles; rocket hits boom on the ground
  // [MM-task_mvbyf6t8_z]. Launch effects + motor flames [MM-task_mvbz1121_11]:
  //   cannon / flak — muzzle flash (combat FX) + a barrel EXHAUST: a hot tongue and a gunsmoke jet out along the
  //     barrel that stops dead and hangs, side jets from the cannon's muzzle brake, a few sparks;
  //   rocket — a STARTER PLUME: backblast out of the nozzle end, a smoke bloom around the rack, dust kicked off the
  //     ground; in flight a big ragged ORANGE solid-fuel tongue that sheds embers and puffy brown-grey smoke while
  //     the motor burns (first ~55% of the lob), then a dim coasting glow with a thinning wisp;
  //   missile — an ignition puff at the tube; in flight a SMALL tight white-hot flame (steady, no embers) and a long
  //     thin pale contrail — a guided motor, clean where the rocket is dirty.
  let trailSeed = 1;
  const jit = () => { trailSeed = (trailSeed * 16807) % 2147483647; return trailSeed / 2147483647 - 0.5; };
  r.fxOpts.trail = (kind, x, y, z, k = 1, dx = 0, dy = 0, dz = 0, t = 1) => {
    const I = r.impacts;
    if (kind === 'burst') {   // AA missile proximity burst: a hot flash and a puff of BLACK smoke that hangs [MM-task_mvd2ln2i_h]
      I.emit(FXK.FLASH, x, y, z, 0, 0, 0, 0.1, 0.5 * k);
      for (let i = 0; i < 2; i++) I.emit(FXK.FIRE, x + jit() * 0.08, y + jit() * 0.08, z + jit() * 0.08, jit() * 0.6, jit() * 0.6, jit() * 0.6, 0.14, 0.16 * k, 0.6);
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + jit(); I.emit(FXK.SPARK, x, y, z, Math.cos(a) * 2.6 * k, jit() * 2, Math.sin(a) * 2.6 * k, 0.3, 0.018); }
      for (let i = 0; i < 6; i++) I.emit(FXK.SMOKE, x + jit() * 0.12, y + jit() * 0.1, z + jit() * 0.12, jit() * 0.5, 0.06 + jit() * 0.2, jit() * 0.5,
        1.8 + (jit() + 0.5) * 0.9, 0.09 * k, 0.9, 0.09, 0, 2.2);   // flak-black, swelling and slowly thinning
      return;
    }
    if (kind === 'flak') {   // a flak round bursts: a quick small pop and a puff of BLACK smoke that hangs [MM-task_mvfqb2gm_4]
      I.emit(FXK.FIRE, x, y, z, 0, 0, 0, 0.08, 0.08 * k, 0.4);
      for (let i = 0; i < 5; i++) I.emit(FXK.SMOKE, x + jit() * 0.1, y + jit() * 0.08, z + jit() * 0.1, jit() * 0.45, 0.05 + jit() * 0.15, jit() * 0.45,
        1.5 + (jit() + 0.5) * 0.7, 0.085 * k, 0.92, 0.07, 0, 2.2);   // flak-black, swelling and slowly thinning
      return;
    }
    if (kind === 'missile') {   // a half-size rocket: an ORANGE motor flame out of the nozzle, a little grey smoke [MM-task_mvfqb454_5]
      for (let i = 0; i < 2; i++) {
        const b = 1.6 + 1.6 * (jit() + 0.5);
        I.emit(FXK.FIRE, x - dx * 0.03 * i, y - dy * 0.03 * i, z - dz * 0.03 * i, -dx * b + jit() * 0.3, -dy * b + jit() * 0.3, -dz * b + jit() * 0.3, 0.08 + jit() * 0.03, 0.065 * k, -0.2);
      }
      I.emit(FXK.SMOKE, x - dx * 0.08, y - dy * 0.08, z - dz * 0.08, jit() * 0.08, 0.06 + jit() * 0.04, jit() * 0.08, 1.1, 0.045 * k, 0.6, 0.5);
      return;
    }
    if (kind === 'rocket') {
      const burning = t < 0.55;   // the motor burns out just past the top of the lob (t = flight fraction)
      if (burning) {
        for (let i = 0; i < 2; i++) {                                                                       // ragged orange tongue, stretched back
          const b = 2.5 + 2.5 * (jit() + 0.5);
          I.emit(FXK.FIRE, x - dx * 0.05 * i, y - dy * 0.05 * i, z - dz * 0.05 * i, -dx * b + jit() * 0.6, -dy * b + jit() * 0.6, -dz * b + jit() * 0.6, 0.1 + jit() * 0.04, 0.11 * k, -0.2);
        }
        if (jit() > 0.1) I.emit(FXK.EMBER, x, y, z, -dx * 1.5 + jit() * 1.2, -dy * 1.5 + jit(), -dz * 1.5 + jit() * 1.2, 0.45, 0.025);   // sheds burning bits
        for (let j = 0; j < 2; j++) I.emit(FXK.SMOKE, x - dx * (0.12 + j * 0.08), y - dy * (0.12 + j * 0.08), z - dz * (0.12 + j * 0.08), jit() * 0.25, 0.15 + jit() * 0.1, jit() * 0.25, 1.6, 0.09 * k, 0.8, 0.4);   // puffy brown-grey — doubled (owner 2026-10-17)
      } else {
        I.emit(FXK.FIRE, x, y, z, -dx * 0.8, -dy * 0.8, -dz * 0.8, 0.05, 0.05 * k, -0.4);                     // coasting: a dim glow
        I.emit(FXK.SMOKE, x, y, z, jit() * 0.1, 0.08, jit() * 0.1, 1.0, 0.04 * k, 0.45, 0.5);
      }
      return;
    }
    I.emit(FXK.SMOKE, x, y, z, jit() * 0.15, 0.12 + jit() * 0.1, jit() * 0.15, 0.7, 0.045 * k, 0.32, 0.75);
    I.emit(FXK.FIRE, x, y, z, 0, 0, 0, 0.09, 0.07 * k, -0.4);
  };
  // launch effects at the modelled firing point (m: x,y,z tip · dx,dy,dz barrel axis · bx,by,bz breech / nozzle)
  r.fxOpts.fire = (kind, m, look) => {
    const I = r.impacts, dx = m.dx, dy = m.dy, dz = m.dz;
    const sx = -dz, sz = dx, sl = Math.hypot(sx, sz) || 1;                                                   // barrel's side axis
    if (kind === 'shell' || kind === 'flak' || kind === 'tracer') {
      // CANNON SHOT [MM-task_mvd1yej4_g] — four separate beats:
      //  1 MUZZLE FLASH: a white-hot core on the tip plus a short forward cone of flash, a fire tongue, side petals
      //    out of the muzzle brake, a few sparks;
      //  2 FORWARD PUFF: a ball of gunsmoke pushed out ahead of the barrel that drifts on, swells and slowly clears;
      //  3 SHOCKWAVE: a pale ring snapping outward on the ground from the gun's foot;
      //  4 LIFTED DUST: puffs the shockwave kicks up off the ground — they rise behind the ring and settle.
      const k = kind === 'shell' ? 1 : kind === 'flak' ? 0.75 : 0.35;
      // 1 · muzzle flash
      I.emit(FXK.FLASH, m.x + dx * 0.04, m.y + dy * 0.04, m.z + dz * 0.04, 0, 0, 0, 0.06, 0.44 * k);
      for (let i = 1; i <= 3; i++) I.emit(FXK.FLASH, m.x + dx * 0.1 * i, m.y + dy * 0.1 * i, m.z + dz * 0.1 * i, dx * 2, dy * 2, dz * 2, 0.05, (0.34 - i * 0.07) * k);
      for (let i = 0; i < 3; i++) {
        const v = 3 + i * 1.6;
        I.emit(FXK.FIRE, m.x, m.y, m.z, dx * v + jit() * 0.4, dy * v + jit() * 0.4, dz * v + jit() * 0.4, 0.07, (0.13 - i * 0.025) * k, -0.3);
      }
      if (m.brake) for (const sd of [1, -1]) {                                                              // brake petals + side puffs
        const bx = m.x - dx * m.brake, by = m.y - dy * m.brake, bz = m.z - dz * m.brake;
        I.emit(FXK.FLASH, bx + (sx / sl) * sd * 0.06, by, bz + (sz / sl) * sd * 0.06, (sx / sl) * sd * 1.5, 0, (sz / sl) * sd * 1.5, 0.045, 0.16);
        I.emit(FXK.FIRE, bx, by, bz, (sx / sl) * sd * 2.2, 0, (sz / sl) * sd * 2.2, 0.05, 0.06, -0.3);
        I.emit(FXK.SMOKE, bx, by, bz, (sx / sl) * sd * 1.4 + dx * 0.3, 0.12, (sz / sl) * sd * 1.4 + dz * 0.3, 1.6, 0.045, 0.9, 0.62, 0, 2.2);
      }
      for (let i = 0; i < 3 * k; i++) I.emit(FXK.SPARK, m.x, m.y, m.z, dx * 5 + jit() * 1.5, dy * 5 + jit() * 1.5 + 0.5, dz * 5 + jit() * 1.5, 0.18, 0.016);
      // 2 · forward puff — born tip-sized, pushed a little way out, then swells and clears (fx/muzzleSmoke.js)
      emitMuzzleSmoke(I.emit, FXK.SMOKE, m, k, jit);
      // 3 · shockwave ring on the ground, and 4 · the dust it lifts (separate: the ring is crisp and fast, the puffs soft and slow)
      if (m.gx !== undefined && kind !== 'tracer') {
        const gr = m.gr || 0.3;
        I.ring(m.gx, m.gz, gr * 0.6, gr + 0.95 * k, 0.32, [0.96, 0.92, 0.84], 0.5 * k);
        for (let i = 0, c = Math.round(12 * k); i < c; i++) {
          const a = (i / c) * Math.PI * 2 + jit() * 0.4, ca = Math.cos(a), sa = Math.sin(a), v = 1.3 + (jit() + 0.5) * 0.8;
          I.emit(FXK.SMOKE, m.gx + ca * gr, 0.05, m.gz + sa * gr, ca * v, 0.22 + (jit() + 0.5) * 0.18, sa * v,
            1.3 + (jit() + 0.5) * 0.7, 0.075 * k, 1.0, 0.58, 1, 2.4);
        }
      }
      return;
    }
    if (kind === 'rocket') {                                                                                 // starter plume
      for (let i = 0; i < 4; i++) I.emit(FXK.FIRE, m.bx, m.by, m.bz, -dx * (3 + i) + jit() * 0.8, -dy * (3 + i) + jit() * 0.5, -dz * (3 + i) + jit() * 0.8, 0.12, 0.14, -0.2);
      for (let i = 0; i < 24; i++) {                                                                         // backblast + bloom (doubled, owner 2026-10-17)
        const v = 1.2 + 3 * (jit() + 0.5);
        I.emit(FXK.SMOKE, m.bx, m.by, m.bz, -dx * v + jit() * 1.4, -dy * v * 0.5 + 0.3 + jit() * 0.3, -dz * v + jit() * 1.4, 1.6 + jit() * 0.6, 0.14, 1.1, 0.5, 0, 2.5);
      }
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + jit(); I.emit(FXK.DUST, m.bx, 0.05, m.bz, Math.cos(a) * 1.6, 0.6 + jit() * 0.3, Math.sin(a) * 1.6, 0.6, 0.05); }   // ground kick
      for (let i = 0; i < 2; i++) I.emit(FXK.SMOKE, m.bx + jit() * 0.2, 0.08, m.bz + jit() * 0.2, jit() * 0.3, 0.2, jit() * 0.3, 2.0, 0.12, 0.9, 0.62, 1);
      I.emit(FXK.FLASH, m.bx, m.by, m.bz, 0, 0, 0, 0.08, 0.45);
      return;
    }
    if (kind === 'missile') {                                                                                // ignition: a pop of white smoke out of the tube's back
      for (let i = 0; i < 4; i++) I.emit(FXK.SMOKE, m.bx, m.by, m.bz, -dx * (1.5 + i * 0.6) + jit() * 0.5, 0.2 + jit() * 0.3, -dz * (1.5 + i * 0.6) + jit() * 0.5, 1.1, 0.06, 0.9, 0.8, 0, 3);
      I.emit(FXK.SMOKE, m.x, m.y, m.z, dx * 1.2, 0.15, dz * 1.2, 0.8, 0.05, 0.8, 0.85, 0, 3);
      I.emit(FXK.FIRE, m.x, m.y, m.z, dx * 2, dy * 2, dz * 2, 0.06, 0.09, -0.3);
    }
  };
  r.fxOpts.muzzle = (id, n) => (r.system ? r.system.muzzle(id, n) : null);
  r.fxOpts.unitMuzzle = (id, n) => r.unitBarrels.muzzle(id, n);
  r.fxOpts.unitHeavy = (id) => r.unitBarrels.heavy(id);
  r.fxOpts.unitReady = (id) => r.unitBarrels.ready(id);   // legged artillery fires only once its legs are planted [MM-story_mvh8woji_1]   // cannon-armed tanks fire one heavy round per shot [MM-task_mvfpbbtp_1]
  // a round left a modelled barrel: cannon barrels (tower, tank, Tiger) kick back; guns, missiles, rockets never [MM-story_mvee15ja_b]
  r.fxOpts.kick = (key, n) => { const raw = key.slice(1), id = Number.isNaN(Number(raw)) ? raw : Number(raw); if (key[0] === 's') { if (r.system) r.system.kick(id, n); } else r.unitBarrels.kick(id, n); };
  r.fxOpts.boom = (x, z, k) => r.impacts.boom(x, z, k);
  r.fxOpts.groundFire = (x, z, rr, secs) => r.impacts.groundFire(x, z, rr, secs);   // a rocket salvo's splash circle burns [MM-task_mvfjbh78_7]
  r.fxOpts.ignite = (id, secs) => r.impacts.ignite(id, secs);   // rocket-hit units burn until the next salvo [MM-story_mvehp5rq_k]
  attachCameraInput(canvas, r);
  // fake light flashes: a ground glow under every combat flash — no point lights (owner: the old fake flash was
  // "effective … to preserve performance") [MM-story_mvehp8ca_l]
  r.flashGlows = createFlashGlows(r.impacts);

  // The baked level: content/maps/baked/<slug>/ — checked against the sim's map; its road mask paints the
  // low-poly roads; its tiles are the ground only under ?ground=baked. Missing or stale → say so on screen.
  let level = null;
  if (!slug) {
    r.status = 'ready';   // no baked level (not a forge map): the ground comes from the map itself — nothing missing
  } else {
    const dir = baseUrl + bakedLevelDir(slug);
    try {
      const res = await fetch(dir + 'level.json');
      if (!res.ok) throw new Error(`no baked level at ${dir} (HTTP ${res.status})`);
      level = await res.json();
      const check = checkLevelAgainstMap(level, map);
      r.problems = check.problems;
      if (r.destroyed) return r;
      if (r.lowpoly) {
        r.roadMask = await loadRoadMask(dir + 'road_mask.png').catch((e) => { console.warn('[render3d] no road mask:', e.message); return null; });
      } else {
        r.ground = { group: await buildBakedGround(THREE, renderer, dir, level, { scale: r.tier.groundRes }) };
        scene.add(r.ground.group);
      }
      if (r.destroyed) return r;
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
  // Obstructions (and the low-poly ground) come from the sim's own map (terrain codes + bakedBlocking +
  // authored decor), not from the baked level — so they match what the units actually path around.
  // world palette: ?world= preview → an authored palette on the map / level → the battle planet's (the enemy
  // faction's homeworld, data/planets.js) → Meadow [MM-task_mvbzgc9n_12]
  const named = (w) => (typeof w === 'string' && w ? w : null);
  setWorld(r, named(opts.world) || named(map.world) || named(level && level.world) || (opts.planet && PLANETS[opts.planet] && PLANETS[opts.planet].palette) || null);
  return r;
}

/** Decode the level's road mask PNG into { width, height, data } (RGBA bytes). */
async function loadRoadMask(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const bmp = await createImageBitmap(await res.blob());
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = cv.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  if (bmp.close) bmp.close();
  return { width: bmp.width, height: bmp.height, data };
}

function disposeGroup(scene, group) {
  if (!group) return;
  scene.remove(group);
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
}

/**
 * Switch the world palette: rebuilds the low-poly ground and the obstructions in `key`'s colours (same
 * seed → same geometry) and applies its lighting. Unknown keys fall back to Meadow. Returns the key used.
 */
export function setWorld(r, key) {
  if (!r || r.destroyed) return null;
  const { THREE, scene, map } = r;
  const world = resolveWorld(key);
  const palette = LOWPAL[world];
  if (r.obstructions) disposeGroup(scene, r.obstructions.group);
  const gm = r.groundMap || map;
  r.obstructions = buildLowPolyObstructions(THREE, gm, palette);
  if (r.obstructions) scene.add(r.obstructions.group);
  // per-cell obstruction tops — aircraft fly over them [MM-story_mvegnpxf_i]
  r.heightField = r.obstructions ? buildHeightField(r.obstructions.group.children, gm.cols, gm.rows) : null;
  r.flightFloor = flightFloor(r.heightField, [craftTop(r)]);   // the minimum flight level [MM-task_mvesj7tg_b]
  if (r.lowpoly) {
    if (r.ground) disposeGroup(scene, r.ground.group);
    r.ground = buildLowPolyGround(THREE, gm, palette, { roadMask: r.roadMask, apron: WORLD_LIGHT[world].apron, grid: GROUND_GRID / r.tier.groundRes, tufts: r.tier.tufts, grassDetail: !!r.tier.grassDetail });
    scene.add(r.ground.group);
    r.lights.setWorld(WORLD_LIGHT[world]);
    if (r.markers.setWorld) r.markers.setWorld(palette);
  }
  if (r.craft) r.craft.setEnv({ sky: WORLD_LIGHT[world].hemi[0], ground: WORLD_LIGHT[world].apron });
  if (r.system) r.system.setEnv({ sky: WORLD_LIGHT[world].hemi[0], ground: WORLD_LIGHT[world].apron });
  if (r.rocketShots) r.rocketShots.setEnv({ sky: WORLD_LIGHT[world].hemi[0], ground: WORLD_LIGHT[world].apron });
  r.world = world;
  r.lights.invalidateShadows();
  return world;
}

function resize(r) {
  const w = r.host.clientWidth || 1, h = r.host.clientHeight || 1;
  if (r._w === w && r._h === h) return;
  r._w = w; r._h = h;
  r.renderer.setSize(w, h, false);
  r.camera.aspect = w / h;
  r.camera.updateProjectionMatrix();
}

/** How tall the base's landing craft stands (world units, top above its root), measured from its model; 0 without one. */
function craftTop(r) {
  if (!r || !r.craft || !r.craft.model || !r.THREE) return 0;
  try {
    r.craft.model.updateWorldMatrix(true, true);
    const b = new r.THREE.Box3().setFromObject(r.craft.model);
    const lift = r.craft.root ? r.craft.root.position.y : 0;   // mid-landing the craft is up in the air: measure from its feet
    return Number.isFinite(b.max.y) ? Math.max(0, b.max.y - lift) : 0;
  } catch (e) { return 0; }
}

/**
 * Auto-framing [MM-task_mveuiw7u_e] [MM-task_mvewfno7_g] [MM-task_mvfjtyqh_8]: until the player pans / zooms / turns, the
 * camera frames the WHOLE play area (the fog window as the player sees it — held at a wave's end until the reward is
 * picked — else the whole map) for THIS viewport's aspect, inside the part of the screen the HUD leaves clear
 * (opts.viewInsets → { top, left, right, bottom } CSS px). It refits whenever the viewport, the HUD or the window
 * changes — before the match AND during it (owner 2026-10-19, a 2.6:1 window mid-match: "cameras not centering at
 * this resolution"). focusPlayArea glides to the same framing after a reward pick and re-arms it. Pure maths in
 * camera.js fitCameraToRect / clearBox.
 */
function playRect(r, state) {
  const shown = r.fog && r.fog.rect;   // what the fog shows (respects the wave-end hold); first frame: the sim's window
  const w = shown || (() => { const f = fogWindow(state, r.map); return f && f.rect; })();
  const m = r.map;
  return w ? { x0: w.x0, z0: w.y0, x1: w.x1 + 1, z1: w.y1 + 1 }   // inclusive cells → world edges
    : { x0: 0, z0: 0, x1: m.cols, z1: m.rows };
}
function viewInsetsOf(r) {
  let ins = null;
  try { ins = r.viewInsets ? r.viewInsets() : null; } catch (e) { ins = null; }
  return ins || {};
}
/** The camera that frames `rect` for the current viewport and HUD (yaw kept). */
function framedCamera(r, rect, ins) {
  return fitCameraToRect({ tx: r.cam.tx, tz: r.cam.tz, dist: r.cam.dist, yaw: r.cam.yaw }, rect, r._w / r._h, clearBox(r._w, r._h, ins));
}
function autoFrame(r, state) {
  if (r.userMoved || r.camGlide || !r._w || !r._h) return;
  const rect = playRect(r, state), ins = viewInsetsOf(r);
  const iv = [ins.top, ins.left, ins.right, ins.bottom].map((v) => Math.round(v || 0));
  const key = r._w + 'x' + r._h + ':' + rect.x0 + ',' + rect.z0 + ',' + rect.x1 + ',' + rect.z1 + ':' + r.cam.yaw.toFixed(3) + ':' + iv.join(',');
  if (key === r._fitKey) return;
  r._fitKey = key;
  const c = framedCamera(r, rect, ins);
  r.cam.tx = c.tx; r.cam.tz = c.tz; r.cam.dist = c.dist;
}

/** Camera glide: ease the camera target to (gx, gz) — and the distance to gd, when given — over its duration (smoothstep). */
export const CAM_GLIDE_S = 1.2;
function stepCamGlide(r, dt) {
  const g = r.camGlide;
  g.t = Math.min(g.dur, g.t + Math.max(0, Math.min(0.1, dt || 0)));
  const u = g.t / g.dur, k = u * u * (3 - 2 * u);
  r.cam.tx = g.fx + (g.gx - g.fx) * k; r.cam.tz = g.fz + (g.gz - g.fz) * k;
  if (g.gd != null) r.cam.dist = g.fd + (g.gd - g.fd) * k;
  if (g.t >= g.dur) r.camGlide = null;
}

/**
 * Wave-end sequence hooks [MM-story_mvempsla_q] — owner 2026-10-18: "position the camera over the new map area, but
 * don't go to new map area until after wave cleared reward is selected".
 *   holdPlayArea(r, true)  — at the clear: the play area (fog window) stays where it was;
 *   focusPlayArea(r, state) — after the reward pick: release it (it grows, with its reveal flash) and glide the camera
 *                             over the band that just opened. Returns the glide time (s), 0 when nothing moved.
 */
export function holdPlayArea(r, on) { if (r && r.fog && r.fog.hold) r.fog.hold(on); }
export function focusPlayArea(r, state) {
  if (!r || !r.fog) return 0;
  const prev = r.fog.rect;
  if (r.fog.hold) r.fog.hold(false);
  const win = fogWindow(state, r.map);
  const f = win ? newAreaFocus(prev, win.rect) : null;
  if (!f) return 0;
  // frame the WHOLE new play area for this screen (target + zoom), not just the band's middle at the old zoom — on a
  // wide screen that left the camera over the dark margin [MM-task_mvfjtyqh_8]; the player gets auto-framing back
  if (r._w && r._h) {
    const rect = { x0: win.rect.x0, z0: win.rect.y0, x1: win.rect.x1 + 1, z1: win.rect.y1 + 1 };
    const c = framedCamera(r, rect, viewInsetsOf(r));
    r.camGlide = { fx: r.cam.tx, fz: r.cam.tz, fd: r.cam.dist, gx: c.tx, gz: c.tz, gd: c.dist, t: 0, dur: CAM_GLIDE_S };
  } else r.camGlide = { fx: r.cam.tx, fz: r.cam.tz, gx: f.x, gz: f.z, t: 0, dur: CAM_GLIDE_S };
  r.userMoved = false;
  return CAM_GLIDE_S;
}

export function renderFrame(r, state, ui, events, dt) {
  if (!r || r.destroyed) return;
  r.ui = ui;   // the camera's pan listener reads ui.placingPointer (touch placement claims a finger)
  resize(r);

  // Camera: battle rules first (no yaw in battle; ease a leftover yaw back to 0 when the wave starts)
  r.inBattle = !!(state && state.waves && state.waves.active);
  stepYaw(r.cam, r.inBattle, dt);
  autoFrame(r, state);
  if (r.camGlide) stepCamGlide(r, dt);   // the camera easing over a newly opened map area [MM-story_mvempsla_q]
  clampCamera(r.cam, r.map.cols, r.map.rows);
  // LC: while the craft lands the view frames it, then eases back to the player's camera (craft/introCamera.js)
  const landingLive = r.craft && r.landing && !r.landing.done && !r.landingHeld;
  r.viewCam = landingLive ? introCamera(r.landing.pose(), r.cam, r.map.base) : null;   // picking uses what is on screen
  const pose = cameraPose(r.viewCam || r.cam);
  r.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  r.camera.lookAt(pose.target.x, pose.target.y, pose.target.z);

  // Static set: structures (re-render the shadow map only when it changed)
  if (state && state.structures) {
    const all = Array.from(state.structures.values());
    // System towers / walls draw through system3d; the rest (bays, fallback blocks) stay with the markers
    const sysChanged = r.system ? r.system.setStructures(all) : false;
    const markersChanged = r.markers.setStructures(r.system ? all.filter((s) => !SYSTEM_KINDS[s.kind]) : all);
    if (sysChanged || markersChanged) r.lights.invalidateShadows();
  }
  if (r.system) r.system.update(dt, state, r.airLift.drawn);   // turrets track planes where they are drawn (last frame's poses)
  if (r.resources) { if (state && r.resources.setResources(state)) r.lights.invalidateShadows(); }   // LC-RES planet resources
  else if (state && r.markers.setResources && r.markers.setResources(state)) r.lights.invalidateShadows();   // LPS crystal fields

  // LC: the landing sequence, then the roof weapon follows the base cannon's aim
  if (r.craft) {
    if (r.landing && !r.landing.done && !r.landingHeld) {
      for (const ev of r.landing.step(dt)) if (ev.type === 'touchdown') { r.craft.setCastShadow(true); r.lights.invalidateShadows(); }
      const P = r.landing.pose();
      r.craft.apply(P);
      r.craft.update(dt, P);   // thruster wash: smoke billow + kicked debris
    } else if (r.craft.fxCount) r.craft.update(dt, null);   // let the billow die out
    const c = state && state.base && state.base.cannon, b = r.map.base;
    const aim = c && c.aimPos && b ? Math.atan2(-(c.aimPos.y - b.y), c.aimPos.x - b.x) : null;
    r.craft.aim(aim, dt);
    // the roof gun pitches to the base cannon's launch slope, from its own muzzle to the aim point [MM-story_mvedy2wj_a]
    if (r.craft.elevate) r.craft.elevate(c && c.aimPos ? baseLaunchPitch(r.craft.muzzleWorld(), cellToWorld(c.aimPos.x), cellToWorld(c.aimPos.y), BASE_STYLES[r.baseStyle] || BASE_STYLES.shell) : null, dt);
    r.craft.scan(r.clock);
  }

  // The play area (fog window) for this frame: the vignette (drawn later) and the hidden contacts (below) agree.
  const fogFrame = r.fog.update(state, r.map, dt);

  // Live units: the 3D models (T5). Live planar shadows per the quality tier (off on Low — T3.5).
  let views = null;
  if (state && state.units) {
    views = buildUnitViews(state, r.map, r.headings, r.resolveModel, Math.min(0.1, Math.max(0, dt || 0)), r.airLift.drawn);   // smooth turning; clamped so a stalled frame can't swing a whole turn at once
    if (r.landing && r.craft && !r.landingHandedOff) views = landingHarvesters(r, state, views);
    // attacking planes fly attack runs around their target instead of parking (render-only) [MM-story_mvee9r08_e]
    r.flight.update(state, r.map, views, dt);
    // aircraft clear plateaus, rocks and trees; `drawn` is where every flyer is drawn (aim + shots read it) [MM-story_mvegnpxf_i]
    r.airLift.update(state, views, r.heightField, r.flight.poses, dt, r.flightFloor || 0);
    r.fxOpts.flight = r.airLift.drawn;
    // enemies outside the play area are red reticles, not models: no model, bar, dust or muzzle fx [MM-story_mveehs1r_f]
    const c = r.contacts.update(state, views, fogFrame.win && fogFrame.win.rect, dt, r.airLift.drawn);
    views = c.views;
    r.fxOpts.hidden = c.hidden;
    r.stats.contacts = r.contactsView.sync(c.reticles, r.clock);
    r.dust.step(dt, views, r.impacts.emit, FXK);   // light dust behind moving ground vehicles [MM-task_mvd2loid_i]
    r.tracks.step(dt, views); r.stats.trackMarks = r.tracksView.sync(r.tracks.instances());   // wheel / tread marks [MM-task_mvj0wz2d_1]
    r.unitBarrels.update(views, state, r.map, r.airLift.drawn, dt);   // unit guns pitch to the shot; their tips are firing points [MM-story_mvedy16u_9]
    r.stats.units = r.units3d.setUnits(views, r.cam.dist, r.tier.liveShadows, r.clock);
  }

  // Expected-path lines (T3b): which origins are live, their routes on the sim's current grid, fades.
  r.clock += Math.max(0, dt || 0);
  if (state) {
    const { geometryDirty } = r.pathLines.update(state, r.map, dt || 0);
    r.stats.lines = r.pathLinesView.sync(r.pathLines.lines, geometryDirty, r.clock);
  }

  // Combat FX (T3.3): shots + flashes from state + this frame's events.
  r.fxOpts.projFx = r.getProjFx();
  r.fxOpts.projScale = r.getProjScale();
  r.fx.update(state, r.map, events, dt, r.fxOpts);
  if (r.flashGlows) r.flashGlows.fromFlashes(r.fx.flashes);   // fake light flashes on the ground [MM-story_mvehp8ca_l]
  // the base super-cannon: reticle, shell from the roof gun, touchdown blast (fx/cannonFx.js) [MM-task_mvbvpyer_x]
  r.cannonFx.onEvents(events, r.craft ? () => r.craft.muzzleWorld() : null);
  if (r.craft && r.craft.kick && events && events.some((e) => e && e.type === 'cannonShot')) r.craft.kick();   // the roof gun recoils [MM-story_mvee15ja_b]
  r.cannonFx.step(dt, r.impacts);
  r.cannonFxView.sync(r.cannonFx, dt);
  // selection range + coverage map (overlays/coverage.js) [MM-task_mvbry998_r]
  r.coverageView.sync(planCoverage(state, ui, getStructureDef), dt);
  r.stats.fx = r.fxView.sync(r.fx);
  r.stats.rockets = r.rocketShots.sync(r.fx);
  r.stats.flak = r.flakShots.sync(r.fx);
  r.impacts.update(state, r.map, events, dt, views, { resolve: r.resolveModel });
  // health bars + "$N" pop-ups (overlays/) [MM-task_mvbry87f_q] [MM-task_mvbyf6t8_z]
  r.healthBars.update(state, views, dt, { baseCell: r.map.base, viewH: r._h || 0, mounts: r.mounts });
  r.gold.feed(events, r.map); r.gold.step(Math.max(0, Math.min(0.1, dt || 0)));
  r.repairFx.step(dt, state, events, r.impacts.emit, FXK);   // welding sparks on structures under repair [MM-task_mvcrs0q1_14]
  r.buildFx.step(dt, state, events, r.impacts.emit, FXK, r.impacts.ring, r.tier.key);   // dirt puffs round build sites [MM-story_mvedxrmi_6]
  r.unloads.feed(events, state); r.unloads.step(Math.max(0, Math.min(0.1, dt || 0)), state);
  r.unloadView.sync(r.unloads, Math.max(0, Math.min(0.1, dt || 0)), r.impacts, FXK, r.map.base);
  r.stats.impacts = r.impactsView.sync(r.impacts, true);
  if (r.impacts.shake > 0) { r.camera.position.x += Math.sin(r.clock * 61) * r.impacts.shake * 0.5; r.camera.position.z += Math.cos(r.clock * 47) * r.impacts.shake * 0.5; }
  if (r.cannonFx.shake > 0) { const k = r.cannonFx.shake; r.camera.position.x += Math.sin(r.clock * 67) * k; r.camera.position.y += Math.sin(r.clock * 83 + 0.7) * k * 0.5; r.camera.position.z += Math.cos(r.clock * 53) * k; }   // cannon touchdown
  if (r.craft && r.craft.shake > 0) { const k = r.craft.shake; r.camera.position.x += Math.sin(r.clock * 73) * k; r.camera.position.y += Math.sin(r.clock * 91 + 1.3) * k * 0.6; r.camera.position.z += Math.cos(r.clock * 59) * k; }   // LC: touchdown thump
  // Ring fog (T3.4): veil outside the current wave window
  r.fogView.sync(fogFrame, r.clock, { dist: flightParallax(r.flightFloor || 0, CAMERA.pitchDeg), yaw: r.cam.yaw });   // planes stay clear of the bank [MM-task_mvfnb9jd_e]

  r.ghost.sync(ui, r.mounts);

  r.renderer.info.reset();
  r.renderer.render(r.scene, r.camera);
  r.goldView.sync(r.gold, r.camera, r._w || 1, r._h || 1, r.THREE);   // DOM labels follow the final (shaken) camera
  r.stats.calls = r.renderer.info.render.calls;
  r.stats.triangles = r.renderer.info.render.triangles;
}

/**
 * LC: while the craft lands, the sim's harvesters are aboard (hidden), then drive down the ramps and ease onto
 * their real positions. Presentation only — the sim's units are never touched. Side: a harvester docked north of
 * the base leaves by the −Z hatch, south by +Z (the craft lands nose east); east/west docks pick by x.
 */
const HAND_OFF = 0.7;   // fraction of the deploy spent on the ramp; the rest eases onto the sim position
export function landingHarvesters(r, state, views) {
  const P = r.landing.pose();
  if (r.landing.done) { r.landingHandedOff = true; return views; }
  const b = r.map.base, out = [];
  const yaw = r.craft.model.rotation.y;
  for (const v of views) {
    const u = state.units.get(v.id);
    if (!u || !u.isHarvester) { out.push(v); continue; }
    if (P.harv < 0) continue;   // still aboard
    const home = u.homePos || u.pos;
    const side = home.y !== b.y ? Math.sign(home.y - b.y) : (home.x >= b.x ? 1 : -1);
    const q = harvesterOnRamp(r.craft.def, Math.min(1, P.harv / HAND_OFF));
    const w = r.craft.toWorld({ x: 0, y: q.y, z: side * q.z });
    if (P.harv > HAND_OFF) {
      const f = (P.harv - HAND_OFF) / (1 - HAND_OFF), s = f * f * (3 - 2 * f);
      w.x += (v.x - w.x) * s; w.y += (v.y - w.y) * s; w.z += (v.z - w.z) * s;
    }
    const heading = Math.atan2(side * Math.cos(yaw), side * Math.sin(yaw));   // outward through the hatch
    out.push(Object.assign({}, v, { x: w.x, y: w.y, z: w.z, heading, aim: heading }));
  }
  return out;
}

/** Re-arm the landing: back to the start of the approach, held off-stage until startLanding (a fresh board). */
export function armLanding(r, opts = {}) {
  if (!r || !r.craft || !r.landing) return;
  r.landing = createLanding({ fromDeg: opts.fromDeg != null ? opts.fromDeg : 180 });
  r.landingHeld = true; r.landingHandedOff = false;
  r.craft.setCastShadow(false); r.craft.apply(r.landing.pose()); r.craft.setVisible(false); r.craft.clearFx();
  r.lights.invalidateShadows();
}
/** Release a held landing — the craft flies in now (the dialogs are closed and the field is on screen). */
export function startLanding(r) {
  if (!r || !r.craft || !r.landing || !r.landingHeld) return;
  r.landingHeld = false; r.craft.setVisible(true);
}

/** The landing's current phase key ('approach' … 'deploy', 'done'), or null without one. */
export function landingPhase(r) {
  if (!r || !r.landing) return null;
  return r.landing.done ? 'done' : r.landing.pose().phase;
}

/** Jump the landing to its end (a tap-to-skip, or a test). */
export function skipLanding(r) {
  if (!r || !r.landing || !r.craft) return;
  r.landing.skip();
  r.landingHeld = false; r.craft.setVisible(true); r.craft.clearFx();
  r.craft.apply(r.landing.pose());
  r.craft.setCastShadow(true);
  r.lights.invalidateShadows();
}

/** Viewport pixel (from the canvas' top-left, CSS px) → sim cell, or null off the map. */
export function screenToCell(r, px, py, lift = 0) {
  if (!r || r.destroyed) return null;
  const w = r.canvas.clientWidth, h = r.canvas.clientHeight;
  return screenToGroundCell(r.viewCam || clampCamera(r.cam, r.map.cols, r.map.rows), w, h, px, py, r.map.cols, r.map.rows, lift);
}

/**
 * A pointer event → the sim cell under it (input.js `pick`). For a touch with a build tool armed the cell is
 * picked at the offset build slot, up and left of the finger (camera.js touchSlotPoint) [MM-story_mvee80a0_d].
 */
export function eventToCell(r, ev, ui) {
  if (!r || r.destroyed) return null;
  const rect = r.canvas.getBoundingClientRect();
  let px = ev.clientX - rect.left, py = ev.clientY - rect.top;
  if (ev.pointerType === 'touch' && ui && ui.buildSelection) ({ x: px, y: py } = touchSlotPoint(px, py, rect.width, rect.height));
  return screenToCell(r, px, py, 0);
}

/** Sim cell centre → canvas pixel (CSS px), or null behind the camera. */
export function cellToScreen(r, cell) {
  if (!r || r.destroyed) return null;
  return groundCellToScreen(r.viewCam || r.cam, r.canvas.clientWidth, r.canvas.clientHeight, cell);
}

export function destroyRenderer(r) {
  if (!r || r.destroyed) return;
  r.destroyed = true;
  const canvas = r.renderer.domElement;
  for (const [type, fn, opts] of r.listeners) canvas.removeEventListener(type, fn, opts);
  r.tracksView.dispose();
  r.markers.dispose();
  if (r.system) r.system.dispose();
  if (r.craft) r.craft.dispose();
  if (r.resources) r.resources.dispose();
  r.units3d.dispose();
  r.pathLinesView.dispose();
  r.ghost.dispose();
  r.fxView.dispose();
  r.rocketShots.dispose(); r.flakShots.dispose();
  r.cannonFxView.dispose(); r.coverageView.dispose(); r.healthBars.dispose(); r.goldView.dispose(); r.unloadView.dispose();
  r.impactsView.dispose();
  r.fogView.dispose(); r.contactsView.dispose();
  r.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  r.renderer.dispose();
  r.host.remove();
  r.banner.remove();
}
