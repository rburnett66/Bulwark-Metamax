/**
 * src/farm/view/avatar.js — the surface avatar and the farmhands on the outpost farm [MM-story_mwabh0cd_i].
 *
 * Farming-Design §2.6 (the surface part), §5.1, §10, D44, D45. The figures ARE the capital ship's crew rig
 * (src/ship-interior/crew.js: createCrewKit, PLAYER_CFG the gold hard hat, cfgFor(faction), drivePose, walkSwing) —
 * owner 2026-11-09: "the avatars on the outpost farm will look the same as the avatars we use in the Capital ship" —
 * scaled to 0.45 of a battle cell on the outpost ground, as the scale prototype (tools/farming/scale.html) has them.
 * They walk the outpost's own nav grid (sim/pathfinding.js buildNavGrid / findWalkerPath, the harvesters' grid), kept
 * to the lowland and off buildings. Nothing here is in the battle or raid sim: the avatar and the farmhands are never
 * raid targets.
 *
 * - **The avatar** (the gold hard hat) idles at the Farmhouse door. PREP / PLANT / HARVEST / HARVEST ALL go through
 *   its tap queue (avatarQueue.js): it walks to the plot's front edge, works it, and the action LANDS (one
 *   session.act, through opts.land) when the work is done. No path → the action lands at once.
 * - **Farmhands** (D45): Verdance crew walking seeded rounds between the plots and the farm buildings, stopping to
 *   work, point and talk. Life, not labour: they never touch a plot. None in safe mode; at most MAX_RIGS figures in all
 *   (tech plan §2.3 F7, iPhone memory).
 * - **Raids** (§10): shelter(true) walks everyone to the Farmhouse to wait; shelter(false) and the queue resumes.
 *
 * Determinism: no Math.random and no wall clock. Farmhand rounds draw from crew.js rng seeded by the outpost seed;
 * time is the view's dt. The pure helpers below are exported for node tests.
 *
 * createFarmCrew(THREE, r, { map, board, safe, reduced, land(action), busy() }) →
 *   { sync(o), enqueue(action), shelter(on), update(dt), info(), dispose() }
 */
import { createCrewKit, cfgFor, PLAYER_CFG, drivePose, walkSwing, rng } from '../../ship-interior/crew.js';
import { buildNavGrid, findWalkerPath } from '../../sim/pathfinding.js';
import { plotState } from '../model.js';
import { takenRects } from '../../outpost/model.js';
import { createQueue, queueStep, queueView, queueIdle } from './avatarQueue.js';

/** The avatar's height on the surface: 0.45 of a battle cell (D44). */
export const AVATAR_CELLS = 0.45;
/** The crew rig's native height in rig units (crew.js makeChar: ≈ 4.6). */
export const RIG_H = 4.6;
/** Crew rigs on screen at most (avatar + farmhands; tech plan §2.3 F7). */
export const MAX_RIGS = 3;
/** Farmhands wanted on a farmed planet (D45: two or three), before the MAX_RIGS cap. */
export const FARMHANDS = 2;
const WALK = 1.6, HAND_WALK = 1.15;   // cells per second (the scale prototype's walk; farmhands amble)
const Y = 0.05;                       // the ground plate the farm layer stands on (farmLayer.js Y)
const HAND_POSES = ['work', 'work', 'point', 'talk', 'idle', 'work'];

/** How many farmhands walk this farm: none in safe mode or with no farm, and never past MAX_RIGS with the avatar. */
export function farmhandCount({ safe = false, farm = null, max = MAX_RIGS } = {}) {
  if (safe || !farm) return 0;
  const things = Object.keys(farm.plots || {}).length + Object.keys(farm.buildings || {}).length;
  if (!things) return 0;
  return Math.max(0, Math.min(FARMHANDS, max - 1));
}

/** The Farmhouse (the farm's hub), or null. */
const farmhouseOf = (o) => (o.farm ? Object.values(o.farm.buildings || {}).find((b) => b.kind === 'farmhouse') || null : null);

/** Where the avatar waits: the Farmhouse door (its front, +z side), else beside the first plot, else the map centre. → { x, z } */
export function homePoint(o, map) {
  const fh = farmhouseOf(o);
  if (fh) return { x: fh.x + fh.w / 2, z: Math.min(map.height - 0.3, fh.y + fh.h + 0.35) };
  const p = o.farm && Object.values(o.farm.plots || {})[0];
  if (p) return standPoint(p, map, 0);
  return { x: map.width / 2, z: map.height / 2 };
}

/** Where a figure stands to work a plot: on its front edge (+z, toward the camera), or its back edge at the map's foot. k shifts it along the edge. */
export function standPoint(p, map, k = 0) {
  const x = p.x + p.w / 2 + (((k % 3) + 3) % 3 - 1) * 0.28;
  const front = p.y + p.h + 0.3;
  return front < map.height ? { x, z: front, yaw: Math.PI } : { x, z: p.y - 0.3, yaw: 0 };
}

/** Cells the farm's walkers keep off: the landing pad, deposits and outpost buildings, the farm buildings and the raised ground (the mesa). */
export function walkerBlocked(o, map) {
  const out = [];
  const rect = (r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y }); };
  for (const p of takenRects(o || {}, map)) rect(p);
  if (o.farm) for (const b of Object.values(o.farm.buildings || {})) rect(b);
  const H = map.heights;
  if (H) for (let i = 0; i < H.length; i++) if (H[i] > 0) out.push({ x: i % map.width, y: Math.floor(i / map.width) });
  return out;
}

/** The farmhands' stops: each plot's front edge and each farm building's door. → [{ x, z, yaw, plot? }] */
export function farmhandStops(o, map) {
  if (!o.farm) return [];
  const ids = Object.keys(o.farm.plots || {}).sort((a, b) => +a.slice(1) - +b.slice(1));
  const out = ids.map((id, i) => ({ ...standPoint(o.farm.plots[id], map, i + 1), plot: id }));
  for (const b of Object.values(o.farm.buildings || {})) out.push({ x: b.x + b.w / 2 + 0.5, z: Math.min(map.height - 0.3, b.y + b.h + 0.4), yaw: 0 });
  return out;
}

/** A farmhand's next leg on its seeded round: { stop, pose, hold }. draw = crew.js rng(seed). */
export function farmhandLeg(draw, stops, lastIdx = -1) {
  if (!stops.length) return null;
  let i = Math.floor(draw() * stops.length);
  if (stops.length > 1 && i === lastIdx) i = (i + 1) % stops.length;
  return { idx: i, stop: stops[i], pose: HAND_POSES[Math.floor(draw() * HAND_POSES.length)], hold: 1.6 + draw() * 1.8 };
}

/** A walk between two world points on a nav grid: [{ x, z }] ending exactly at `to`, [] when already there, null when no path. */
export function walkPath(nav, from, to) {
  if (!nav) return [{ x: to.x, z: to.z }];
  const a = { x: Math.floor(from.x), y: Math.floor(from.z) }, b = { x: Math.floor(to.x), y: Math.floor(to.z) };
  let path = null;
  try { path = findWalkerPath(nav, a, b); } catch (e) { path = null; }
  if (path == null) return null;
  const pts = path.slice(0, -1).map((c) => ({ x: c.x + 0.5, z: c.y + 0.5 }));
  pts.push({ x: to.x, z: to.z });
  return pts;
}

export function createFarmCrew(THREE, r, { map, board, safe = false, reduced = false, land = () => {}, busy = () => false } = {}) {
  const root = new THREE.Group();
  root.name = 'farm-crew';
  r.scene.add(root);
  let kit = null;
  let o = null, q = createQueue(), avatar = null, hands = [], navSig = '', nav = null, clock = 0, sheltering = false;

  function makeWalker(cfg, at, phase) {
    kit = kit || createCrewKit(THREE);
    const g = kit.makeChar(cfg);
    g.scale.setScalar(AVATAR_CELLS / RIG_H);
    g.position.set(at.x, Y, at.z);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = !m.material.transparent; m.receiveShadow = true; } });
    root.add(g);
    return { g, ud: g.userData, cur: { rax: 0, raz: 0, lax: 0, laz: 0, hx: 0, bx: 0, leg: 0, yaw: 0 }, pose: 'idle', yaw: 0, ph: 0, phase,
      path: null, onArrive: null, hold: 0, then: null };
  }
  function removeWalker(w) { root.remove(w.g); }

  function navNow() {
    const s = JSON.stringify(o && o.farm ? Object.values(o.farm.buildings).map((b) => [b.x, b.y, b.w, b.h]) : []);
    if (s !== navSig || !nav) { navSig = s; nav = board ? buildNavGrid(board, [], walkerBlocked(o, map)) : null; }
    return nav;
  }
  const pos = (w) => ({ x: w.g.position.x, z: w.g.position.z });
  /** Send a walker along the nav grid; false when there is no path. */
  function goTo(w, to, onArrive) {
    const p = walkPath(navNow(), pos(w), to);
    if (!p) return false;
    w.path = p; w.onArrive = onArrive; w.hold = 0; w.then = null;
    return true;
  }

  // ── the avatar's queue: effects from avatarQueue.js become walks, work poses and landed actions
  function run(ev) {
    const res = queueStep(q, ev);
    q = res.q;
    for (const e of res.effects) {
      if (e.type === 'walk') {
        const p = o && o.farm && o.farm.plots[e.job.plot];
        const at = p ? standPoint(p, map, e.job.id) : null;
        if (!at || !goTo(avatar, at, () => { avatar.yaw = at.yaw; run({ type: 'arrived' }); })) run({ type: 'noPath' });
      } else if (e.type === 'work') { avatar.pose = 'work'; }
      else if (e.type === 'land') { avatar.pose = 'idle'; land(e.job.action); }
      else if (e.type === 'home' || e.type === 'shelter') { if (avatar) goHome(avatar, 0); }
    }
  }
  function goHome(w, k) {
    const h = homePoint(o, map), at = { x: h.x + k * 0.4, z: h.z + (k ? 0.15 : 0) };
    if (!goTo(w, at, () => { w.pose = 'idle'; w.yaw = 0; })) { w.g.position.set(at.x, Y, at.z); w.path = null; }
  }

  function nextLeg(h) {
    if (sheltering) return;
    const leg = farmhandLeg(h.draw, farmhandStops(o, map), h.last);
    if (!leg) return;
    h.last = leg.idx;
    const to = { x: leg.stop.x + (h.k ? 0.3 : -0.3), z: leg.stop.z };
    if (!goTo(h.w, to, () => { h.w.pose = leg.pose; h.w.yaw = leg.stop.yaw; h.w.hold = leg.hold; h.w.then = () => nextLeg(h); })) {
      h.w.hold = leg.hold; h.w.then = () => nextLeg(h);   // no route there: wait a while, then try another stop
    }
  }

  /** Bring the figures to the outpost: the avatar once there is a farm, the farmhands by farmhandCount. */
  function sync(next) {
    o = next;
    if (!o.farm) return;
    if (!avatar) { avatar = makeWalker(PLAYER_CFG, homePoint(o, map), 0.7); }
    const want = farmhandCount({ safe, farm: o.farm });
    while (hands.length > want) removeWalker(hands.pop().w);
    while (hands.length < want) {
      const k = hands.length, h0 = homePoint(o, map);
      const h = { k, w: makeWalker(cfgFor('ground'), { x: h0.x + (k ? 0.9 : -0.9), z: h0.z + 0.2 }, 2.3 + k * 3.1), draw: rng(((o.seed | 0) * 31 + 977 + k * 7919) >>> 0), last: -1 };
      hands.push(h);
      h.w.hold = 0.4 + k * 0.9; h.w.then = () => nextLeg(h);
    }
  }

  function enqueue(action) {
    if (!avatar) { land(action); return { queued: false }; }
    const before = q.seq;
    run({ type: 'enqueue', action });
    return { queued: q.seq > before };
  }

  function shelter(on) {
    on = !!on;
    if (on === sheltering) return;
    sheltering = on;
    if (avatar) run({ type: 'shelter', on });
    hands.forEach((h) => {
      h.w.then = null; h.w.hold = 0;
      if (on) goHome(h.w, h.k ? 1 : -1);
      else nextLeg(h);
    });
  }

  function stepWalker(w, dt, speed) {
    if (w.path && w.path.length) {
      const tgt = w.path[0], dx = tgt.x - w.g.position.x, dz = tgt.z - w.g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.03) { w.path.shift(); if (!w.path.length) { w.path = null; w.pose = 'idle'; const f = w.onArrive; w.onArrive = null; if (f) f(); } }
      else {
        const step = Math.min(d, speed * dt);
        w.g.position.x += (dx / d) * step; w.g.position.z += (dz / d) * step;
        w.yaw = Math.atan2(dx, dz); w.ph += (step / AVATAR_CELLS) * 5.5;
        walkSwing(w.ud, w.cur, w.ph, reduced);
        let dy = w.yaw - w.cur.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        w.cur.yaw += dy * Math.min(1, dt * 10); w.g.rotation.y = w.cur.yaw;
        w.g.position.y = Y + (reduced ? 0 : Math.abs(Math.sin(w.ph)) * 0.012);
        return;
      }
    }
    if (w.hold > 0 && (w.hold -= dt) <= 0) { const f = w.then; w.then = null; if (f) f(); }
    const res = drivePose(w.ud, w.cur, w.pose, w.yaw, dt, clock, w.phase, reduced);
    w.g.rotation.y = res.yaw; w.g.position.y = Y + res.hop * w.g.scale.y * 0.3;
  }

  function update(dt) {
    clock += dt;
    if (!avatar) return;
    if (!busy()) run({ type: 'tick', dt });
    stepWalker(avatar, dt, WALK);
    for (const h of hands) stepWalker(h.w, dt, HAND_WALK);
  }

  /** For the review handle: where everyone is and what the queue holds. */
  function info() {
    const at = (w) => ({ x: +w.g.position.x.toFixed(3), z: +w.g.position.z.toFixed(3), pose: w.path ? 'walk' : w.pose });
    return {
      avatar: avatar ? { ...at(avatar), height: AVATAR_CELLS } : null,
      queue: queueView(q), idle: queueIdle(q), landed: q.landed, sheltering,
      farmhands: hands.map((h) => at(h.w)), rigs: (avatar ? 1 : 0) + hands.length,
      home: o && o.farm ? homePoint(o, map) : null,
    };
  }

  return {
    group: root, sync, enqueue, shelter, update, info,
    /** Plots worth a HARVEST ALL, in id order (Fruited and Dead), for the queue. */
    harvestable(now) {
      if (!o || !o.farm) return [];
      return Object.keys(o.farm.plots).sort((a, b) => +a.slice(1) - +b.slice(1)).filter((id) => { const s = plotState(o, o.farm.plots[id], now); return s === 'fruited' || s === 'dead'; });
    },
    dispose() { r.scene.remove(root); if (kit) kit.dispose(); },
  };
}
