/**
 * src/ship-interior/roomView.js — the capital ship's room view: the primitive rooms, the hull, the crew, the camera
 * [MM-story_mw47laf1_2] [MM-story_mw47lcvv_3].
 *
 * The Long Ledger prototype's stage (tools/ship-interior/prototype/long-ledger) rebuilt on data and primitives: the same
 * 100 × 56.25 orthographic world, the decks' walk lines, ambient crew in depth layers, a key character at each room's
 * post, the gold avatar that walks to a tapped room. Additions for the opening (Collective-Opening-Design §5–6): the
 * patron seated at the bar (sit-drink), her flash, the room states (dim / highlight), and a camera that eases from the
 * whole ship to one room.
 *
 *   const view = createRoomView(THREE, { renderer, layout, standing, seed, reduce, patron: { room: 'bar', fac, name } });
 *   view.resize(w, h); view.frame(dt);                    // every frame
 *   view.ship.setAll('dim', 'bar'); view.ship.setState('bar', 'highlight');
 *   view.focus('bar', 0.6) / view.focus(null)            // ease the camera
 *   view.pick(clientX, clientY, rect) → room | null;  view.walkPlayerTo('bar', onArrive);  view.screenBox('bar', rect)
 *
 * Deterministic presentation: every random draw comes from crew.js rng(seed), time is accumulated dt.
 */
import { buildShip } from './primitiveRooms.js';
import { createCrewKit, cfgFor, drivePose, walkSwing, rng, GESTURES, FLAG_POSE, PLAYER_CFG } from './crew.js';
import { toWX, toWY, WORLD, isLocked } from './layout.js';

const SCALE = 1.4, PLAYER_SCALE = 1.56;                       // the prototype's deck crew and avatar scales
const LAYER_GAP = 2.0, LAYER_RISE = 0.40, LAYER_SHRINK = 0.975, MAX_LAYERS = 16;

/** Ambient deck crew: every faction helmet the rooms don't show, plus Collective deck hands (design §5.3). */
const AMBIENT = [
  ['air', 0, 36, -1], ['dark', 0, 58, 1], ['collective', 0, 44, 1],
  ['water', 1, 24, 1], ['greenies', 1, 40, -1],
  ['space', 2, 40, 1], ['hightech', 2, 74, -1], ['collective', 2, 60, -1], ['collective', 2, 14, 1],
];

export function createRoomView(THREE, { renderer, layout: L, standing = {}, seed = 11, reduce = false, patron = null } = {}) {
  const R = rng(seed);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060b);
  const cam = new THREE.OrthographicCamera(-50, 50, 28.125, -28.125, -200, 200);
  cam.position.z = 60;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa89c88, 0.62));
  const sun = new THREE.DirectionalLight(0xfff6e8, 0.9); sun.position.set(-6, 12, 9); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff9a6a, 0.3); rim.position.set(-10, 2, -6); scene.add(rim);   // Vesper, off the stern

  scene.add(backdrop(THREE));
  const ship = buildShip(THREE, L, { locked: (room) => isLocked(room, standing) });
  scene.add(ship.group);

  const kit = createCrewKit(THREE);
  const agents = [];
  const lanes = L.lanes.map((l) => ({ ...l, n: 0 }));
  const laneOf = (floor) => lanes.find((l) => l.floor === floor);

  function face(a) { a.baseYaw = (a.dir >= 0 ? -1 : 1) * 0.72; a.g.rotation.y = a.baseYaw; a.cur.yaw = a.baseYaw; }
  function spawn(cfg, { lane, x, dir = 1, kind = 'walker', scale = SCALE, z = null, y = null, state = null }) {
    const g = kit.makeChar(cfg);
    let layer = -1, rise = 0;
    if (kind === 'walker') {
      if (lane.n >= MAX_LAYERS) return null;
      layer = lane.n++; rise = layer * LAYER_RISE;
      g.scale.setScalar(scale * Math.pow(LAYER_SHRINK, layer));
    } else g.scale.setScalar(scale);
    const a = {
      g, lane, x, dir, kind, layer, rise, scale,
      z: z != null ? z : kind === 'walker' ? -(layer + 1) * LAYER_GAP : -1,
      y: y,                                        // a fixed world y (a seat) instead of the lane line
      speed: kind === 'walker' ? 2.3 + R() * 1.4 : 0,
      state: state || (kind === 'walker' ? 'walk' : 'idle'), t: 0.4 + R() * 2.6, phase: R() * 6, ph2: R() * 6,
      cur: { rax: .06, raz: .1, lax: .06, laz: -.1, hx: 0, bx: 0, leg: 0, yaw: 0 },
      flash: 0,
    };
    g.position.set(toWX(x), (y != null ? y : toWY(lane.fy)) + rise, a.z);
    scene.add(g); face(a); agents.push(a);
    return a;
  }

  // ambient crew on the decks
  for (const [fac, floor, x, dir] of AMBIENT) { const lane = laneOf(floor); if (lane) spawn(cfgFor(fac), { lane, x, dir }); }
  // a key character at each room's post, playing the room's signature gesture (the captain salutes)
  const posts = new Map();
  for (const room of L.rooms) {
    if (patron && patron.room === room.id) continue;
    const lane = laneOf(room.floor);
    const pose = room.cap ? 'salute' : FLAG_POSE[room.flag] || 'idle';
    const a = spawn(cfgFor(room.fac, { captain: !!room.cap }), { lane, x: room.fx, kind: 'post', z: -3, state: pose });
    a.signature = pose; a.dir = room.fx < room.x + room.w / 2 ? 1 : -1; face(a);
    posts.set(room.id, a);
  }
  // the patron: seated at the bar, drinking (the opening's Mira Valcourt)
  let patronAgent = null;
  if (patron) {
    const rec = ship.rooms.get(patron.room), seat = rec && rec.seats[1];
    if (seat) {
      const lane = laneOf(rec.room.floor);
      const yOff = 0.46 * 2.7 * SCALE;                              // hip height above the figure's origin, world units
      patronAgent = spawn(cfgFor(patron.fac || 'collective'), { lane, x: (seat.x + 50), kind: 'seat', z: seat.z + 0.6, y: seat.y - yOff, state: 'sit-drink' });
      patronAgent.baseYaw = 0.95; patronAgent.cur.yaw = 0.95; patronAgent.g.rotation.y = 0.95;
      patronAgent.cur.leg = -1.45;
    }
  }
  // the player: gold hard hat, on the patron's deck at its left end
  const startLane = laneOf(patron ? ship.rooms.get(patron.room).room.floor : lanes.length - 1) || lanes[0];
  const player = spawn(PLAYER_CFG, { lane: startLane, x: startLane.x0 + 3, kind: 'player', scale: PLAYER_SCALE, z: 0 });

  // chevron over the patron (FLASH)
  const chevron = makeChevron(THREE); chevron.visible = false; scene.add(chevron);

  function startWalk(a) {
    const steps = 1 + Math.floor(R() * 3);
    a.dir = a.x < a.lane.x0 + 8 ? 1 : a.x > a.lane.x1 - 8 ? -1 : (R() < 0.5 ? 1 : -1);
    face(a); a.target = Math.max(a.lane.x0, Math.min(a.lane.x1, a.x + a.dir * steps * 12)); a.state = 'walk';
  }
  function nextGesture(a) { a.state = GESTURES[Math.floor(R() * GESTURES.length)]; a.t = 1.5 + R() * 2.4; }

  let time = 0, onArrive = null;
  /** Walk the avatar to a room's stand spot (its deck; the prototype's snap between decks), then call done. */
  function walkPlayerTo(roomId, done) {
    const room = L.rooms.find((r) => r.id === roomId); if (!room) return;
    const lane = laneOf(room.floor);
    player.lane = lane; player.target = room.fx - 3; player.dir = player.target >= player.x ? 1 : -1; face(player);
    player.state = 'walkto'; player.speed = 9; onArrive = done || null;
    if (reduce) { player.x = player.target; }
  }

  // camera: the whole ship, or eased onto one room
  let viewW = 1, viewH = 1;
  const camNow = { x: 0, y: 0, half: WORLD.h / 2 }, camTo = { x: 0, y: 0, half: WORLD.h / 2 };
  function fitHalf() {                                         // half-height that fits the whole stage (contain)
    const aspect = viewW / viewH;
    return Math.max(WORLD.h / 2, (WORLD.w / 2) / aspect);
  }
  function focus(roomId, fill = 0.7) {
    const aspect = viewW / viewH;
    if (!roomId) { camTo.x = 0; camTo.y = 0; camTo.half = fitHalf(); return; }
    const r = L.rooms.find((x) => x.id === roomId);
    const cx = toWX(r.x + r.w / 2), cy = toWY(r.top + r.h / 2);
    const halfW = (r.w / 2) / fill, halfH = (r.h * WORLD.h / 100 / 2) / fill;
    camTo.x = cx; camTo.y = cy; camTo.half = Math.max(halfH, halfW / aspect);
  }
  function applyCamera() {
    const aspect = viewW / viewH;
    cam.left = camNow.x - camNow.half * aspect; cam.right = camNow.x + camNow.half * aspect;
    cam.top = camNow.y + camNow.half; cam.bottom = camNow.y - camNow.half;
    cam.updateProjectionMatrix();
  }

  function resize(w, h) {
    viewW = Math.max(1, w); viewH = Math.max(1, h);
    if (camTo.x === 0 && camTo.y === 0) camTo.half = fitHalf();
    if (camNow.x === 0 && camNow.y === 0 && camNow.half === WORLD.h / 2) camNow.half = camTo.half;
    applyCamera();
  }

  /** world → screen px within rect (for DOM labels over rooms) */
  const v3 = new THREE.Vector3();
  function toScreen(x, y, rect) {
    v3.set(x, y, 0).project(cam);
    return { x: rect.left + (v3.x + 1) / 2 * rect.width, y: rect.top + (1 - v3.y) / 2 * rect.height };
  }
  function screenBox(roomId, rect) {
    const r = L.rooms.find((x) => x.id === roomId);
    const a = toScreen(toWX(r.x), toWY(r.top), rect), b = toScreen(toWX(r.x + r.w), toWY(r.top + r.h), rect);
    return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
  }
  function pick(clientX, clientY, rect) {
    const nx = (clientX - rect.left) / rect.width, ny = (clientY - rect.top) / rect.height;
    const wx = cam.left + nx * (cam.right - cam.left), wy = cam.top - ny * (cam.top - cam.bottom);
    const px = wx + 50, py = (WORLD.h / 2 - wy) / WORLD.h * 100;
    return L.rooms.find((r) => px >= r.x && px <= r.x + r.w && py >= r.top && py <= r.top + r.h) || null;
  }

  /** Advance and draw one frame. */
  function frame(dt = 1 / 60, { draw = true, flash = 0, camEase = 0.9 } = {}) {
    time += dt;
    const k = reduce ? 1 : 1 - Math.exp(-dt / Math.max(0.05, camEase / 3));
    camNow.x += (camTo.x - camNow.x) * k; camNow.y += (camTo.y - camNow.y) * k; camNow.half += (camTo.half - camNow.half) * k;
    applyCamera();
    ship.update(time, dt, reduce);
    for (const a of agents) {
      let hop = 0, drop = 0;
      if (a.state === 'walk' || a.state === 'walkto') {
        a.x += a.dir * a.speed * dt * 2.2;
        const arrived = a.dir > 0 ? a.x >= a.target : a.x <= a.target;
        a.g.position.x = toWX(a.x); a.g.rotation.y = a.cur.yaw = a.baseYaw;
        a.ph2 += dt * 8; walkSwing(a.g.userData, a.cur, a.ph2, reduce);
        if (arrived) {
          a.x = a.target; a.g.position.x = toWX(a.x);
          if (a.state === 'walkto') { a.state = 'idle'; a.baseYaw = 0.4; if (onArrive) { const f = onArrive; onArrive = null; f(); } }
          else nextGesture(a);
        }
      } else {
        const r = drivePose(a.g.userData, a.cur, a.state, a.baseYaw, dt, time, a.phase, reduce);
        a.g.rotation.y = r.yaw; hop = r.hop;
        if (a.kind === 'walker') { a.t -= dt; if (a.t <= 0) (R() < 0.5 ? startWalk(a) : nextGesture(a)); }
        else if (a.kind === 'post' && !reduce) {         // a post plays its signature with idle breaks
          a.t -= dt; if (a.t <= 0) { a.state = a.state === a.signature ? 'idle' : a.signature; a.t = a.state === 'idle' ? 1.5 + R() * 2 : 3 + R() * 3; }
        }
      }
      const s = a.g.scale.y;
      const baseY = a.y != null ? a.y : toWY(a.lane.fy);
      a.g.position.y = baseY + (a.rise || 0) + (reduce || a.kind === 'seat' ? 0 : Math.sin(time / 0.65 + a.phase) * 0.1) + hop * 0.9 * (s / SCALE) - (a.kind === 'seat' ? 0 : drop * 2.7 * s);
    }
    // the patron's flash: the vest pulses gold and a chevron bobs over her (reduced motion: a steady glow)
    if (patronAgent) {
      patronAgent.g.userData.setFlash(flash);
      chevron.visible = flash > 0.01;
      if (chevron.visible) {
        chevron.position.set(patronAgent.g.position.x, patronAgent.g.position.y + 7.0 + (reduce ? 0 : Math.sin(time * 6) * 0.35), 6);
        chevron.material.opacity = Math.min(1, flash * 1.4);
      }
    }
    if (draw) renderer.render(scene, cam);
  }

  return {
    scene, camera: cam, ship, agents, player,
    get patron() { return patronAgent; }, posts,
    resize, frame, focus, pick, screenBox, walkPlayerTo,
    /** The patron turns to face the camera (beat 8). */
    patronTurn() { if (patronAgent) { patronAgent.baseYaw = 0; patronAgent.state = 'sit'; } },
    dispose() { ship.dispose(); kit.dispose(); scene.clear(); },
  };
}

/** Deep space behind the hull, warmed on the stern side by Vesper. */
function backdrop(THREE) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const x = c.getContext('2d');
  x.fillStyle = '#04060b'; x.fillRect(0, 0, 512, 288);
  const g = x.createRadialGradient(-40, 200, 10, -40, 200, 420);
  g.addColorStop(0, 'rgba(255,110,60,0.55)'); g.addColorStop(0.35, 'rgba(160,40,30,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 288);
  const R = rng(5);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; x.fillRect(R() * 512, R() * 288, R() < 0.9 ? 1 : 2, 1); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), new THREE.MeshBasicMaterial({ map: t, depthWrite: false }));   // covers a phone-portrait frame too
  m.position.z = -120; m.name = 'roomView.backdrop';
  return m;
}

/** A gold chevron (FLASH marker). */
function makeChevron(THREE) {
  const s = new THREE.Shape();
  s.moveTo(-1.1, 0.7); s.lineTo(0, -0.5); s.lineTo(1.1, 0.7); s.lineTo(0.7, 0.7); s.lineTo(0, -0.05); s.lineTo(-0.7, 0.7); s.lineTo(-1.1, 0.7);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffcf5c).convertSRGBToLinear(), transparent: true, depthTest: false }));
  m.renderOrder = 10; m.scale.setScalar(1.3);
  return m;
}
