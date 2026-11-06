/**
 * src/ship-interior/primitiveRooms.js — the capital ship's rooms and hull, drawn from three.js primitives
 * [MM-story_mw47laf1_2].
 *
 * Owner 2026-11-05: "I expect the faction ships to be revised so for now I would prefer to mockup rooms with
 * primitives." This replaces the Long Ledger prototype's painted cutaway (cutaway.jpg) with rooms built in code from
 * the layout (layout.js), in the same 100 × 56.25 orthographic world. Tech plan: Capital-Ship-Interior.md §3.3–3.4;
 * design: Collective-Opening-Design.md §4.3.
 *
 * Each room = a shell (back wall, floor slab with a lit top strip, ceiling with a light strip, wall strips with door
 * gaps, a sign) + a prop preset, merged into ONE vertex-coloured mesh and ONE glow mesh, plus a frame and an optional
 * hatch for a sealed room: about 4 draws a room. States: normal | dim | highlight | locked | flagged.
 *
 *   const ship = buildShip(THREE, layout, { standing, locked: (room) => bool });
 *   scene.add(ship.group); ship.setState('bar', 'highlight'); ship.update(t);
 *   ship.rooms.get('bar').seats → [{ x, y, z }] world points the crew sit on
 */
import { toWX, toWY, WORLD } from './layout.js';
import { LOOKS } from './crew.js';

const Y = WORLD.h / 100;                 // world units per % of height
const BACK = -40;                        // the back wall's z; crew walk in front of it (z −2 … −32)
const DOOR_H = 7.4;                      // door gap height above the floor (a figure is ≈ 6.4)
const STATE_COLOR = { normal: 0x2c3e5e, flagged: 0x38e1c8, highlight: 0xffcf5c, locked: 0x55606f, dim: 0x1a2436 };
const FLAG_COLOR = { mission: 0x38e1c8, reward: 0xffcf5c, store: 0xf2a623, talk: 0xb58cff, upgrade: 0x5fd39b };

/** Merge primitives into one geometry with a colour attribute. parts: [{ geo, pos, size?, rot?, color }] */
function mergeColored(THREE, parts) {
  const pos = [], nor = [], col = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const nm = new THREE.Matrix3(), c = new THREE.Color(), v = new THREE.Vector3();
  for (const part of parts) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    e.set(...(part.rot || [0, 0, 0])); q.setFromEuler(e);
    s.set(...(part.size || [1, 1, 1])); p.set(...part.pos);
    m.compose(p, q, s); nm.getNormalMatrix(m);
    c.set(part.color).convertSRGBToLinear();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
    if (g !== part.geo) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

const shade = (hex, k) => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255; return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k); };

/**
 * Prop presets, one per prototype room. Each returns { solid: parts[], glow: parts[], seats: [], stands: [] } from a
 * room frame R = { x0, x1, w, fy (floor y), top (ceiling y), H (height above floor) } in world units. u = 0..1 across
 * the room, v = world units above the floor.
 */
const PRESETS = {
  helm(B, R) {
    const at = (u) => R.x0 + u * R.w;
    for (const u of [0.2, 0.45, 0.7]) {
      B.box([at(u), R.fy + 1.1, -9], [3.2, 2.2, 2], 0x2b3446);
      B.glow([at(u), R.fy + 2.1, -7.9], [2.6, 0.5, 0.1], 0x38e1c8, [-0.6, 0, 0]);
    }
    B.box([at(0.58), R.fy + 0.9, -5], [1.8, 1.8, 1.6], 0x3a2a1a);                       // captain's chair
    B.box([at(0.58), R.fy + 2.6, -5.8], [1.8, 1.8, 0.4], 0x3a2a1a);
    B.box([at(0.5), R.fy + R.H * 0.6, BACK + 0.4], [R.w * 0.55, R.H * 0.32, 0.2], 0x050812);   // viewport
    for (let i = 0; i < 18; i++) {
      const u = 0.25 + ((i * 37) % 50) / 100, vv = R.H * (0.47 + ((i * 53) % 25) / 100);
      B.glow([at(u), R.fy + vv, BACK + 0.6], [0.18, 0.18, 0.05], i % 5 ? 0xdfe8ff : 0xffb08a);
    }
    B.stands.push(0.3);
  },
  chapel(B, R) {
    const at = (u) => R.x0 + u * R.w;
    B.box([at(0.5), R.fy + 1.2, -24], [5, 2.4, 3], 0x5a3a22);
    for (const u of [0.42, 0.58]) { B.box([at(u), R.fy + 3.2, -24], [0.4, 1.6, 0.4], 0xefe3c8); B.glow([at(u), R.fy + 4.2, -24], [0.35, 0.5, 0.35], 0xffb347); }
    for (const u of [0.2, 0.8]) B.box([at(u), R.fy + 0.7, -8], [5.5, 1.4, 1.4], 0x4a2f1c);
    const panes = [0xa6382f, 0xf2a623, 0xb58cff, 0x38e1c8];
    panes.forEach((c, i) => B.glow([at(0.38 + i * 0.08), R.fy + R.H * 0.62, BACK + 0.5], [1.4, R.H * 0.32, 0.1], c));
    B.stands.push(0.6);
  },
  armory(B, R) {
    const at = (u) => R.x0 + u * R.w;
    for (const u of [0.25, 0.62]) {
      B.box([at(u), R.fy + 1.1, -22], [7, 2.2, 3.2], 0x5c6534);
      B.cyl([at(u) + 0.6, R.fy + 2.8, -22], [1.2, 1.1, 1.2], 0x4c5428);
      B.cyl([at(u) + 3.6, R.fy + 2.9, -22], [0.22, 4.4, 0.22], 0x343a20, [0, 0, Math.PI / 2]);
    }
    for (let i = 0; i < 5; i++) B.box([at(0.88) + (i - 2) * 0.6, R.fy + 2.4, BACK + 1], [0.18, 3.4, 0.3], 0x2a2a24);
    B.box([at(0.88), R.fy + 0.7, -6], [2, 1.4, 1.6], 0x8a6a3a);
    B.stands.push(0.3);
  },
  bar(B, R) {
    const at = (u) => R.x0 + u * R.w;
    B.box([at(0.55), R.fy + 1.15, -10], [R.w * 0.62, 2.3, 2.4], 0x6b3f22);               // counter
    B.box([at(0.55), R.fy + 2.4, -10], [R.w * 0.66, 0.25, 2.8], 0xb0743a);               // lip
    B.box([at(0.55), R.fy + 4.6, BACK + 0.8], [R.w * 0.6, 0.25, 1.2], 0x4a2a16);         // back shelf
    const bottles = [0x7ae08a, 0xffb347, 0xa6382f, 0x9fe8ff, 0xffd76a, 0xb58cff];
    for (let i = 0; i < 12; i++) B.glow([at(0.3 + i * 0.045), R.fy + 5.15, BACK + 0.8], [0.32, 0.9, 0.32], bottles[i % bottles.length]);
    for (const u of [0.36, 0.49, 0.62, 0.75]) {
      B.cyl([at(u), R.fy + 0.8, -5], [0.18, 1.6, 0.18], 0x222733);
      B.cyl([at(u), R.fy + 1.65, -5], [0.75, 0.18, 0.75], 0xe8863a);
      B.seats.push({ u, v: 1.74, z: -5 });
    }
    B.box([at(0.1), R.fy + 0.8, -14], [2.4, 1.6, 2.4], 0x4a2a16);                         // booth table
    for (const u of [0.32, 0.55, 0.78]) B.glow([at(u), R.fy + R.H - 1.4, -12], [0.6, 0.6, 0.6], 0xffcf8a);
    B.stands.push(0.6);
  },
  trade(B, R) {
    const at = (u) => R.x0 + u * R.w;
    B.glow([at(0.5), R.fy + R.H * 0.72, BACK + 0.5], [R.w * 0.7, 2.2, 0.1], 0x0f3b36, null, 'ticker');
    for (const u of [0.3, 0.62]) { B.box([at(u), R.fy + 1.1, -10], [5.5, 2.2, 2.4], 0x3a3f46); B.glow([at(u), R.fy + 2.3, -9], [3, 0.2, 0.1], 0x9fe8ff); }
    for (const [u, n] of [[0.86, 3], [0.1, 2]]) for (let k = 0; k < n; k++) B.box([at(u), R.fy + 1.1 + k * 2.2, -16], [2.6, 2.1, 2.4], k % 2 ? 0x8a6a3a : 0x6b5230);
    B.box([at(0.47), R.fy + 2.6, -6], [0.2, 2.8, 0.2], 0xd4af37);                         // scale
    B.box([at(0.47), R.fy + 4, -6], [3, 0.12, 0.12], 0xd4af37);
    B.stands.push(0.5);
  },
  loading(B, R) {
    const at = (u) => R.x0 + u * R.w;
    for (let k = 0; k < 3; k++) B.box([at(0.14), R.fy + 1.4 + k * 2.8, -26], [4.4, 2.7, 3], k % 2 ? 0xc9702c : 0xE8863A);
    B.box([at(0.5), R.fy + R.H - 1.2, -20], [R.w * 0.8, 0.6, 1], 0x4a4f58);                // gantry
    for (const u of [0.12, 0.88]) B.box([at(u), R.fy + R.H / 2, -20], [0.6, R.H - 1, 1], 0x4a4f58);
    for (let i = 0; i < 6; i++) B.box([R.x1 - 0.9, R.fy + 0.9 + i * 1.6, BACK + 1], [1, 1.5, 0.3], i % 2 ? 0x111111 : 0xf2c22a);
    // the transport (a primitive mock until its art lands)
    B.cyl([at(0.55), R.fy + 3.2, -14], [1.6, 7, 1.6], 0xdfe3ea, [0, 0, Math.PI / 2]);
    B.sphere([at(0.55) + 3.5, R.fy + 3.2, -14], [1.6, 1.6, 1.6], 0xdfe3ea);
    B.box([at(0.55) - 1.5, R.fy + 4.9, -14], [2.4, 1.6, 0.3], 0xE8863A);
    B.box([at(0.55) - 1.5, R.fy + 1.6, -14], [2.4, 1.4, 0.3], 0xE8863A);
    B.glow([at(0.55) - 3.6, R.fy + 3.2, -14], [0.3, 2.4, 2.4], 0x9fe8ff);
    for (const u of [0.42, 0.68]) B.box([at(u), R.fy + 0.8, -14], [0.5, 1.6, 2], 0x343a44); // clamps
    B.stands.push(0.5);
  },
  engineering(B, R) {
    const at = (u) => R.x0 + u * R.w;
    B.cyl([at(0.5), R.fy + R.H * 0.45, -24], [2.6, R.H * 0.8, 2.6], 0x3a4a66);
    B.glow([at(0.5), R.fy + R.H * 0.45, -21.3], [1.6, R.H * 0.6, 0.2], 0x38e1c8, null, 'core');
    for (const v of [0.25, 0.55, 0.85]) B.cyl([at(0.5), R.fy + R.H * v, BACK + 2], [0.35, R.w * 0.9, 0.35], 0x5a6478, [0, 0, Math.PI / 2]);
    for (const u of [0.15, 0.85]) { B.box([at(u), R.fy + 3, -8], [2.2, 4, 1], 0x2b3446); B.glow([at(u), R.fy + 3.6, -7.4], [1.6, 1.4, 0.1], 0x5fd39b); }
    B.stands.push(0.5);
  },
};

/** A canvas-texture sign with the room's name. */
function signTexture(THREE, text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = '#0b1220'; x.fillRect(0, 0, 256, 48);
  x.strokeStyle = 'rgba(242,200,105,0.6)'; x.lineWidth = 3; x.strokeRect(2, 2, 252, 44);
  x.fillStyle = '#f2c869'; x.font = '600 26px "Chakra Petch", "Space Grotesk", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text.toUpperCase(), 128, 26);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

/** The ticker's scrolling prices. */
function tickerTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#071c1a'; x.fillRect(0, 0, 1024, 64);
  x.font = '600 30px monospace'; x.textBaseline = 'middle';
  const items = ['ORE 12.4 ▲', 'ICE 31.0 ▲', 'BLOOM 8.2 ▼', 'ALLOY 44.7 ▲', 'SPORE 5.9 ▼', 'FLUX 19.3 ▲'];
  let px = 10;
  for (const s of items) { x.fillStyle = s.endsWith('▲') ? '#5fd39b' : '#ff7a6a'; x.fillText(s, px, 34); px += 170; }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; return t;
}

/** A diagonal hatch for a sealed room, in the lock faction's colour. */
function hatchTexture(THREE, hex) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,10,16,0.55)'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#' + hex.toString(16).padStart(6, '0'); x.globalAlpha = 0.35; x.lineWidth = 8;
  for (let i = -64; i < 128; i += 22) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/**
 * Build the whole ship: hull + every room. locked(room) → bool decides the sealed look.
 * → { group, rooms: Map(id → { room, group, frame, setState, seats[], stands[], box }), setState(id, s), update(t), dispose }
 */
export function buildShip(THREE, L, { locked = () => false } = {}) {
  const group = new THREE.Group(); group.name = 'ship-interior';
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  const unit = {
    box: keep(new THREE.BoxGeometry(1, 1, 1)), cyl: keep(new THREE.CylinderGeometry(0.5, 0.5, 1, 16)),
    sphere: keep(new THREE.SphereGeometry(0.5, 14, 10)), plane: keep(new THREE.PlaneGeometry(1, 1)),
  };

  group.add(buildHull(THREE, L, keep));

  const rooms = new Map();
  let ticker = null, core = null;
  for (const room of L.rooms) {
    const R = {
      x0: toWX(room.x), x1: toWX(room.x + room.w), w: room.w,
      ceil: toWY(room.top), bottom: toWY(room.top + room.h), fy: toWY(room.fy),
    };
    R.H = R.ceil - R.fy;
    const look = LOOKS[room.fac] || LOOKS.collective;
    const B = { solid: [], glow: [], seats: [], stands: [], named: {} };
    B.box = (pos, size, color, rot) => B.solid.push({ geo: unit.box, pos, size, color, rot });
    B.cyl = (pos, size, color, rot) => B.solid.push({ geo: unit.cyl, pos, size, color, rot });
    B.sphere = (pos, size, color) => B.solid.push({ geo: unit.sphere, pos, size, color });
    B.glow = (pos, size, color, rot, name) => { if (name) B.named[name] = { pos, size, color }; else B.glow_.push({ geo: unit.box, pos, size, color, rot }); };
    B.glow_ = [];

    // shell
    const cx = (R.x0 + R.x1) / 2, warm = room.theme === 'warm';
    B.box([cx, (R.ceil + R.bottom) / 2, BACK], [R.w, R.ceil - R.bottom, 0.4], shade(look.outfit, 0.36));       // back wall
    B.box([cx, (R.fy + R.bottom) / 2 - 0.3, -20], [R.w, Math.max(0.6, R.fy - R.bottom - 0.6), 40], 0x232a36);   // floor slab
    B.box([cx, R.fy - 0.3, -20], [R.w, 0.6, 40], 0x5a6476);                                                   // lit top strip
    B.box([cx, R.ceil - 0.5, -20], [R.w, 1, 40], 0x1c2230);                                                   // ceiling
    B.glow_.push({ geo: unit.box, pos: [cx, R.ceil - 1.1, -14], size: [R.w * 0.7, 0.2, 0.6], color: warm ? 0xffcf8a : 0xbfe8ff });
    // wall strips: full height at the back; at the front only a lintel over a door gap where a neighbour adjoins
    const doors = L.doors.filter((d) => d.left === room.id || d.right === room.id);
    for (const [side, x] of [['left', R.x0], ['right', R.x1]]) {
      const door = doors.some((d) => (side === 'left' ? d.right === room.id : d.left === room.id));
      B.box([x, (R.ceil + R.bottom) / 2, BACK + 1], [0.6, R.ceil - R.bottom, 2], 0x3a4458);
      const lintel0 = door ? R.fy + DOOR_H : R.fy;
      if (R.ceil - lintel0 > 0.2) B.box([x, (R.ceil + lintel0) / 2, -1], [0.6, R.ceil - lintel0, 2], 0x3a4458);
    }
    (PRESETS[room.props] || (() => {}))(B, R);

    const solidMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 }));
    const glowMat = keep(new THREE.MeshBasicMaterial({ vertexColors: true }));
    const g = new THREE.Group(); g.name = 'room.' + room.id;
    g.add(new THREE.Mesh(keep(mergeColored(THREE, B.solid)), solidMat));
    if (B.glow_.length) g.add(new THREE.Mesh(keep(mergeColored(THREE, B.glow_)), glowMat));

    // named glows that animate: the ticker (scrolling) and the reactor core (pulsing)
    if (B.named.ticker) {
      const tex = keep(tickerTexture(THREE)); tex.repeat.set(0.5, 1);
      const m = new THREE.Mesh(unit.plane, keep(new THREE.MeshBasicMaterial({ map: tex })));
      m.position.set(...B.named.ticker.pos); m.scale.set(B.named.ticker.size[0], B.named.ticker.size[1], 1);
      g.add(m); ticker = { tex, mat: m.material };
    }
    if (B.named.core) {
      const m = new THREE.Mesh(unit.box, keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(B.named.core.color).convertSRGBToLinear() })));
      m.position.set(...B.named.core.pos); m.scale.set(...B.named.core.size); g.add(m); core = m;
    }

    // the sign over the room
    const sign = new THREE.Mesh(unit.plane, keep(new THREE.MeshBasicMaterial({ map: keep(signTexture(THREE, room.name)), transparent: true })));
    const sw = Math.min(R.w * 0.5, 9);
    sign.position.set(R.x0 + sw / 2 + 0.8, R.ceil - 2.0, -0.5); sign.scale.set(sw, sw * 48 / 256, 1); g.add(sign);

    // the frame: four thin bars in the state colour
    const frameMat = keep(new THREE.MeshBasicMaterial({ color: STATE_COLOR.normal, transparent: true, opacity: 0.9 }));
    const t = 0.35, frame = new THREE.Group();
    for (const [x, y, w, h] of [[cx, R.ceil, R.w, t], [cx, R.bottom, R.w, t], [R.x0, (R.ceil + R.bottom) / 2, t, R.ceil - R.bottom], [R.x1, (R.ceil + R.bottom) / 2, t, R.ceil - R.bottom]]) {
      const bar = new THREE.Mesh(unit.box, frameMat); bar.position.set(x, y, 1); bar.scale.set(w, h, 0.2); frame.add(bar);
    }
    g.add(frame);

    // a sealed room: hatch over the front
    let hatch = null;
    if (locked(room)) {
      const lf = LOOKS[room.unlock.fac] || LOOKS.collective;
      const tex = keep(hatchTexture(THREE, lf.stripe)); tex.repeat.set(R.w / 4, (R.ceil - R.bottom) / 4);
      hatch = new THREE.Mesh(unit.plane, keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
      hatch.position.set(cx, (R.ceil + R.bottom) / 2, 2); hatch.scale.set(R.w, R.ceil - R.bottom, 1); hatch.renderOrder = 5;
      g.add(hatch);
    }
    group.add(g);

    const flagColor = room.flag ? FLAG_COLOR[room.flag] : null;
    const rec = {
      room, group: g, frameMat, solidMat, glowMat, hatch, R, locked: !!hatch,
      seats: B.seats.map((s) => ({ x: R.x0 + s.u * R.w, y: R.fy + s.v, z: s.z })),
      stands: B.stands.map((u) => R.x0 + u * R.w),
      state: 'normal', dimK: 0, glowK: 0,
      setState(s) { rec.state = s; },
    };
    rec.flagColor = flagColor;
    rooms.set(room.id, rec);
  }

  const cA = new THREE.Color(), cB = new THREE.Color();
  return {
    group, rooms,
    setState(id, s) { const r = rooms.get(id); if (r) r.setState(s); },
    setAll(s, exceptId) { for (const [id, r] of rooms) if (id !== exceptId) r.setState(s); },
    /** Ease each room toward its state; animate the ticker and the core. t = seconds; dt for the easing. */
    update(t, dt = 1 / 60, reduce = false) {
      const k = 1 - Math.exp(-dt / 0.2);
      for (const r of rooms.values()) {
        const dimT = r.state === 'dim' ? 1 : 0, hiT = r.state === 'highlight' ? 1 : 0;
        r.dimK += (dimT - r.dimK) * k; r.glowK += (hiT - r.glowK) * k;
        const lockK = r.locked ? 0.5 : 1;
        const b = (1 - 0.65 * r.dimK) * lockK;
        r.solidMat.color.setScalar(b); r.glowMat.color.setScalar(Math.max(0.3, b));
        if (r.locked) r.solidMat.color.lerp(cA.setRGB(0.5, 0.5, 0.52), 0.4);
        const base = r.locked ? STATE_COLOR.locked : r.flagColor && r.state === 'normal' ? r.flagColor : STATE_COLOR.normal;
        cA.set(base).convertSRGBToLinear(); cB.set(STATE_COLOR.highlight).convertSRGBToLinear();
        const pulse = r.flagColor && r.state === 'normal' && !reduce ? 0.55 + 0.45 * Math.sin(t * (2 * Math.PI / 2.9)) : 1;
        r.frameMat.color.copy(cA).lerp(cB, r.glowK).multiplyScalar(r.glowK > 0.5 ? 1 + 0.6 * r.glowK : pulse * (1 - 0.6 * r.dimK));
        r.frameMat.opacity = 0.35 + 0.65 * Math.max(r.glowK, r.flagColor ? pulse * 0.7 : 0.3) * (1 - 0.5 * r.dimK);
      }
      if (ticker && !reduce) ticker.tex.offset.x = (t * 0.03) % 1;
      if (core && !reduce) core.material.color.setRGB(0.12, 0.7 + 0.25 * Math.sin(t * 2.2), 0.62 + 0.2 * Math.sin(t * 2.2));
    },
    dispose() { group.parent && group.parent.remove(group); for (const d of disposables) d.dispose && d.dispose(); },
  };
}

/** The hull: an ivory rounded silhouette around the decks, a dark interior, an orange flank stripe, dome and stern. */
function buildHull(THREE, L, keep) {
  const H = L.hull, g = new THREE.Group(); g.name = 'hull';
  const x0 = toWX(H.x0), x1 = toWX(H.x1), top = toWY(H.top), bot = toWY(H.bottom);
  const rr = (w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  };
  const ivory = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(0xF1EDE4).convertSRGBToLinear(), roughness: 0.6 }));
  const W = x1 - x0, Hh = top - bot, cx = (x0 + x1) / 2, cy = (top + bot) / 2;
  const shell = new THREE.Mesh(keep(new THREE.ShapeGeometry(rr(W, Hh, 4))), ivory); shell.position.set(cx, cy, -46); g.add(shell);
  const inner = new THREE.Mesh(keep(new THREE.ShapeGeometry(rr(W - 2.4, Hh - 2.4, 3))), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x0b0e16).convertSRGBToLinear() })));
  inner.position.set(cx, cy, -45); g.add(inner);
  const stripe = new THREE.Mesh(keep(new THREE.PlaneGeometry(W - 6, 0.9)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xE8863A).convertSRGBToLinear() })));
  stripe.position.set(cx, bot + 0.6, -44.5); g.add(stripe);
  if (H.dome) {
    const dw = H.dome.w, dome = new THREE.Mesh(keep(new THREE.CircleGeometry(dw / 2, 32, 0, Math.PI)), ivory);
    dome.position.set(toWX(H.dome.x), top - 0.2, -46.2); dome.scale.set(1, 0.35, 1); g.add(dome);
  }
  const sternX = H.stern === 'left' ? x0 - 2 : x1 + 2;
  const stern = new THREE.Mesh(keep(new THREE.ShapeGeometry(rr(6, Hh * 0.45, 2))), ivory);
  stern.position.set(sternX, bot + Hh * 0.25, -46.4); g.add(stern);
  const nozzle = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.2, Hh * 0.3)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb36a).convertSRGBToLinear() })));
  nozzle.position.set(sternX + (H.stern === 'left' ? -3.2 : 3.2), bot + Hh * 0.25, -46.3); g.add(nozzle);
  return g;
}
