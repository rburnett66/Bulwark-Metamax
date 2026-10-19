/**
 * src/render3d/fx/combatFxModel.js — what the 3D view's combat effects ARE, frame by frame (plan v2.2 §6.4)
 * [MM-task_mv9s9mza_2].
 *
 * The sim resolves damage instantly; shots are cosmetic. This model decides the same shots the Pixi renderer
 * draws (render/renderer.js emitCombatFx): every live tower and armed unit with a target fires at its weapon's
 * cadence, in its authored look (render/projFx.js overrides, else the classic recipe). Here the shots fly in
 * WORLD space — from a muzzle height to the target's height, so a flak round climbs to a plane — and arrive as a
 * hit flash. Muzzle flashes, kill / structure-destroyed / mine / base-cannon blasts are flashes too: one list of
 * additive glows the view draws from one glow texture (combatFx.js).
 *
 * READ-ONLY on the sim: it reads `state` and the frame's `events` and never writes to them. It draws its own
 * jitter from a private seeded PRNG (never Math.random) so the same frames give the same effects — the tests
 * depend on that, and so will the replay check (T3.6).
 *
 * Pure: no three.js, no DOM. World: X = column, Z = row, Y = up, cell centre = cell + 0.5 (camera.js).
 */
import { cellToWorld } from '../camera.js';
import { HOVER_HEIGHT } from '../units/unitViews.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';
import { shotFxFor } from '../../render/unitFx.js';
import { STRUCTURES } from '../../data/tables.js';
import { apexFor, pitchFor } from './elevation.js';

/** Heights (cells) a shot leaves from and arrives at. Structures are 1-cell blocks (markers.js). */
export const MUZZLE = Object.freeze({ ground: 0.35, structure: 0.85, antiGround: 0.6, antiAir: 0.5, barrel: 0.42 });
export const AIM = Object.freeze({ ground: 0.3, structure: 0.5, base: 0.6 });

/**
 * The classic recipes (renderer.js emitCombatFx), speeds in cells/s. Sizes are the shot's glow diameter and
 * its streak length in cells — the 3D equivalents of the Pixi SHOT_SIZE dot + 48 px streak.
 */
export const RECIPES = Object.freeze({
  // [MM-task_mvbyf6t8_z] tightened: faster, smaller hot rounds that leave the barrel tip; anti-air fires HOMING
  // MISSILES (visual — the sim's damage and cadence are unchanged); rocket towers fire arcing AOE salvos
  antiGround: Object.freeze({ kind: 'shell', cadence: 0.55, speed: 21, color: 0xffd080, burst: 3 }),
  antiAir: Object.freeze({ kind: 'missile', cadence: 0.6, speed: 9, color: 0xbfe6ff, burst: 2 }),
  unit: Object.freeze({ cadence: 0.6, speed: 22, attacker: 0xff9a70, defender: 0xbfe8ff, burst: 1 }),
});
/** Per tower type overrides of the kind recipe (the new towers). */
export const STRUCT_RECIPES = Object.freeze({
  // cadence (and the cannon's burst) = the tower def's fields in tables.js — read, never copied, so a retune is
  // one data edit and the 3D and Pixi views can't drift apart [MM-story_mvedxogl_4]
  // the cannon LOBS its shells (fx/elevation.js) so its barrel rises with range [MM-story_mvedxq1v_5]; speed = horizontal
  'STR-Cannon': Object.freeze({ kind: 'shell', lob: 1, cadence: STRUCTURES['STR-Cannon'].cadence, speed: 13, color: 0xffd080, burst: STRUCTURES['STR-Cannon'].burst }),
  // burn: a unit the salvo hits burns this long — until the next salvo — so the sim's continuous dps reads [MM-story_mvehp5rq_k]
  // owner 2026-10-19: "tier 1 should fire 1, tier 2 should fire 2 and tier 3 should fire 4. each tier should leave the
  // ground burning for aoe damage" + "the visual should map to the damage area" — burstByTier (render hint; dps is
  // the sim's) and `aoe`, the sim splash radius the salvo's ground fire covers [MM-task_mvfjbh78_7]
  'STR-Rockets': Object.freeze({ kind: 'rocket', cadence: STRUCTURES['STR-Rockets'].cadence, speed: 8, color: 0xffb070, burst: 4,
    burstByTier: Object.freeze([1, 2, 4]), aoe: STRUCTURES['STR-Rockets'].aoeRadius, burn: STRUCTURES['STR-Rockets'].cadence * 1.1 }),
  'STR-Missile': Object.freeze({ kind: 'missile', cadence: STRUCTURES['STR-Missile'].cadence, speed: 10, color: 0xffe2a0, burst: 2, big: 1 }),
});
export const SHOT_LOOK = Object.freeze({   // Pixi at ~35 px/cell: shell dot 12 px + 33 px streak, flak 17 px, tracer 4 px + 11 px
  shell: Object.freeze({ size: 0.24, len: 0.62 }),
  flak: Object.freeze({ size: 0.4, len: 0.55 }),
  tracer: Object.freeze({ size: 0.11, len: 0.42 }),
  missile: Object.freeze({ size: 0.2, len: 0.32 }),
  rocket: Object.freeze({ size: 0.24, len: 0.4 }),
});
/** Homing + arc flight (cells, s): missiles climb off the rail, then turn onto the target; rockets lob. */
export const FLIGHT = Object.freeze({ turn: 7.5, accel: 16, maxSpeed: 19, climb: 2.2, rocketApex: 0.9, rocketApexPerCell: 0.12, hitR: 0.22,
  // [MM-task_mvd2ln2i_h] owner: missiles "end up circling the planes" — the seeker's turn rate now TIGHTENS the longer it
  // flies and the closer it gets (turn × (1 + turnGrow·t) × close-in boost, capped), and a PROXIMITY FUSE bursts it
  // within `fuse` of the plane, or at its closest pass if it starts to open the range, or after `maxT` s.
  turnGrow: 3, turnMax: 60, closeBoost: 2.5, fuse: 0.42, missFuse: 1.3, maxT: 2.6 });
const BURST_GAP = 0.07;      // s between burst rounds (sim clock)
/** A turret holds fire until its barrel is this close (radians, in yaw) to the target — the round leaves along it. */
export const ON_TARGET = Object.freeze({ shell: 0.35, flak: 0.35, tracer: 0.5, missile: 0.9, rocket: 0.6 });
/** …and how close (radians) a PITCHING barrel's elevation must be to the launch slope [MM-story_mvedxxo7_7]. */
export const ON_PITCH = Object.freeze({ shell: 0.12, flak: 0.15, tracer: 0.2, missile: 0.5, rocket: 0.2 });

/** The launch pitch a modelled barrel m (with pmin/pmax/aim from system3d.muzzlePoint) needs for target `to`. */
export function wantPitch(m, to) {
  const h = Math.hypot(to.x - m.x, to.z - m.z), d3 = Math.hypot(h, to.y - m.y);
  const apex = m.aim === 'shell' ? apexFor('shell', h) : m.aim === 'rocket' ? apexFor('rocket', d3) : 0;
  return Math.max(m.pmin, Math.min(m.pmax, pitchFor(m, to, apex)));
}
const BURST_SPREAD = 0.16;   // cells of impact jitter for burst rounds

/** Flash looks: diameter (cells), life (s), colour. Sized like the Pixi glows they stand in for. */
export const FLASH = Object.freeze({
  muzzle: Object.freeze({ size: 0.5, ttl: 0.08, color: 0xfff0b0 }),
  hit: Object.freeze({ size: 0.7, ttl: 0.15, color: 0xffe6a0 }),
  flak: Object.freeze({ size: 1.1, ttl: 0.22, color: 0xbfe0ff }),
  kill: Object.freeze({ size: 1.8, ttl: 0.3, color: 0xffc070 }),
  destroyed: Object.freeze({ size: 4.4, ttl: 0.5, color: 0xffc070 }),
  mine: Object.freeze({ size: 2.0, ttl: 0.35, color: 0xffc070 }),
  cannonMuzzle: Object.freeze({ size: 1.2, ttl: 0.25, color: 0xfff0b0 }),
  cannonBlast: Object.freeze({ size: 5.0, ttl: 0.5, color: 0xffb060 }),
  deposit: Object.freeze({ size: 1.7, ttl: 0.35, color: 0xffd76a }),
  airburst: Object.freeze({ size: 1.3, ttl: 0.24, color: 0xcfe8ff }),
  rocketHit: Object.freeze({ size: 1.5, ttl: 0.3, color: 0xffb060 }),
});
const DEPOSIT_COLORS = Object.freeze({ blue: 0x58a6ff, yellow: 0xffd76a, red: 0xff6a6a, green: 0x7be08a });

/** Plan §7.1: effect budgets. The tier table (T3.5) lowers `maxFlashes` on Low. */
export const DEFAULT_CAPS = Object.freeze({ maxShots: 400, maxFlashes: 200 });

/** mulberry32 — the FX's own seeded stream (never Math.random). */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Where a target is in world space, or null when it is gone. `drawn` (optional Map id → {x,y,z}) overrides a unit's
 * sim position with where it is DRAWN — a plane flying an attack run (units/flightPath.js) [MM-story_mvee9r08_e].
 */
export function aimPoint(state, map, tid, drawn) {
  if (tid === null || tid === undefined) return null;
  const dp = drawn && drawn.get(tid);
  if (dp) return { x: dp.x, y: dp.y, z: dp.z };
  if (tid === BASE_TARGET_ID) {
    const b = (state.base && state.base.pos) || (map && map.base);
    return b ? { x: cellToWorld(b.x), y: AIM.base, z: cellToWorld(b.y) } : null;
  }
  const u = state.units && state.units.get(tid);
  if (u && u.hp > 0 && u.pos) {
    return { x: cellToWorld(u.pos.x), y: u.domain === 'Flyer' || u.altitude > 0 ? HOVER_HEIGHT : AIM.ground, z: cellToWorld(u.pos.y) };
  }
  const s = state.structures && state.structures.get(tid);
  if (s && s.pos && s.lifecycle !== 'Destroyed') {
    const fp = s.footprint || {};
    return { x: cellToWorld(s.pos.x + ((fp.w || 1) - 1) / 2), y: AIM.structure, z: cellToWorld(s.pos.y + ((fp.h || 1) - 1) / 2) };
  }
  return null;
}

function eventPos(ev, map) {
  const p = ev.pos || ev.cell || (ev.target && ev.target.pos) || (ev.structure && ev.structure.pos) || (ev.base && ev.base.pos)
    || (ev.type === 'deposit' && map && map.base) || null;
  return p && typeof p.x === 'number' && typeof p.y === 'number' ? p : null;
}

/**
 * createCombatFx({ seed, caps }) → { shots, flashes, update(state, map, events, dt, opts), clear() }
 *   shots   — [{ x, y, z, dx, dy, dz, size, len, color }]   live rounds; (dx,dy,dz) = unit flight direction
 *   flashes — [{ x, y, z, size, color, alpha }]             live glows (alpha already faded)
 * opts: { getDef(unitId) → def, projFx: { id: entry }, projScale, hidden: Set of unit ids that draw no shots (hidden contacts),
 *         flight: Map unit id → drawn { x, y, z, strafe, inbound } of flyers (aim at / fire from where they are drawn),
 *         muzzle(structId, n) → modelled firing point { x, y, z, dx, dy, dz, bx, by, bz, brake } (System turrets),
 *         fire(kind, firingPoint, look) — launch effects (barrel exhaust, rocket plume, missile ignition),
 *         trail(kind, x, y, z, k, dx, dy, dz, t) — in-flight motor flame + smoke (t: missile s aloft, rocket flight 0..1), boom(x, z, k) } — all optional.
 * Records are pooled: steady-state flight allocates nothing.
 */
export function createCombatFx({ seed = 1, caps = DEFAULT_CAPS } = {}) {
  const rand = prng(seed);
  const shots = [], flashes = [], queue = [];
  const freeShots = [], freeFlashes = [];
  const clock = new Map();   // shooter key → sim time its next round may leave
  let lastTime = -Infinity;
  let launched = 0;   // rounds fired since creation (stats + tests)
  const limits = { maxShots: caps.maxShots, maxFlashes: caps.maxFlashes };

  function flash(x, y, z, look, color, scale = 1) {
    if (flashes.length >= limits.maxFlashes) return;
    const f = freeFlashes.pop() || {};
    f.x = x; f.y = y; f.z = z;
    f.size0 = look.size * scale; f.size = f.size0;
    f.color = color !== undefined && color !== null ? color : look.color;
    f.age = 0; f.ttl = look.ttl; f.alpha = 1;
    flashes.push(f);
  }

  /**
   * from: the firing point — { x, y, z } and, when it comes off a modelled barrel (opts.muzzle), its barrel axis
   * (dx, dy, dz) and breech / nozzle end (bx, by, bz). Fires opts.fire(kind, from, look) for the launch effects.
   */
  function launch(from, to, look, tid = null, field = null) {
    if (shots.length >= limits.maxShots) return;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-4) return;
    const hasAxis = from.dx !== undefined;
    const s = freeShots.pop() || {};
    s.x = from.x; s.y = from.y; s.z = from.z;
    s.tx = to.x; s.ty = to.y; s.tz = to.z;
    s.dx = dx / dist; s.dy = dy / dist; s.dz = dz / dist;
    s.left = dist; s.speed = look.speed;
    s.kind = look.kind; s.size = look.size; s.len = look.len; s.color = look.color;
    s.tid = tid; s.t = 0; s.big = look.big || 0; s.dPrev = undefined; s.lob = 0; s.burn = look.burn || 0;
    s.tier = look.tier || 0;
    s.field = field;   // the salvo's ground fire: { x, z, r } on this round's hit (the first round of a rocket salvo)   // the firing tower's upgrade tier: a rocket draws as that tier's rocket (fx/rocketShots.js) [MM-task_mvf0kzw4_l]
    if (s.kind === 'missile') {
      // off the rail: up and slightly out, then the seeker takes over
      const h = Math.hypot(dx, dz) || 1, side = (rand() - 0.5) * 1.4;
      if (hasAxis) {   // out of the tube along its axis, then the climb and the seeker
        s.vx = from.dx * 4 - (dz / h) * side * 0.5; s.vy = from.dy * 4 + FLIGHT.climb * 0.5 + rand() * 0.5; s.vz = from.dz * 4 + (dx / h) * side * 0.5;
      } else { s.vx = (dx / h) * 2.5 - (dz / h) * side; s.vy = FLIGHT.climb + rand() * 0.8; s.vz = (dz / h) * 2.5 + (dx / h) * side; }
      s.spd = Math.hypot(s.vx, s.vy, s.vz);
    } else if (s.kind === 'rocket') {
      s.fx = from.x; s.fy = from.y; s.fz = from.z; s.dur = Math.max(0.35, dist / look.speed); s.apex = apexFor('rocket', dist);
    } else if (look.lob) {   // a lobbed shell: the same parabola as the barrel's pitch (elevation.js) [MM-story_mvedxq1v_5]
      const h = Math.hypot(dx, dz);
      s.lob = 1; s.fx = from.x; s.fy = from.y; s.fz = from.z; s.dur = Math.max(0.25, h / look.speed); s.apex = apexFor(s.kind, h);
    }
    shots.push(s);
    launched++;
    // the flash sits just proud of the muzzle face so the barrel doesn't swallow it
    const fo = hasAxis ? 0.06 : 0;
    flash(from.x + (from.dx || 0) * fo, from.y + (from.dy || 0) * fo, from.z + (from.dz || 0) * fo, FLASH.muzzle, look.color, Math.min(1.6, look.size / SHOT_LOOK.shell.size) * (s.kind === 'missile' || s.kind === 'rocket' ? 0.7 : 1));
    const onFire = ctx.opts && ctx.opts.fire;
    if (onFire) {
      const ax = hasAxis ? from : { x: from.x, y: from.y, z: from.z, dx: s.dx, dy: s.dy, dz: s.dz, bx: from.x - s.dx * 0.3, by: from.y - s.dy * 0.3, bz: from.z - s.dz * 0.3, brake: 0,
        gx: from.gx, gz: from.gz, gr: from.gr };
      onFire(s.kind, ax, look);
    }
  }

  /**
   * One shooter's turn: fire when its cadence allows, as a burst of `burst` rounds. muz(n) → the n-th firing point
   * of a modelled turret (or null): rounds cycle its barrels / rails across volleys, each leaves from its own tip,
   * and a turret still slewing holds fire until its barrel is on target.
   */
  const roundNo = new Map();   // shooter key → rounds fired (which barrel is next)
  // a round left modelled barrel n of shooter `key` ('s'+structure id / 'u'+unit id): opts.kick drives the recoil [MM-story_mvee15ja_b]
  const kickOf = (key, n) => { const k = ctx.opts && ctx.opts.kick; if (k) k(key, n); };
  function fire(key, now, from, to, look, burst, cadence, tid = null, muz = null) {
    if (now < (clock.get(key) || 0)) return;
    let n0 = roundNo.get(key) || 0;
    if (muz) {
      const m = muz(n0);
      if (m) {
        const hx = to.x - m.x, hz = to.z - m.z, hl = Math.hypot(hx, hz), al = Math.hypot(m.dx, m.dz);
        if (hl > 0.3 && al > 1e-3 && (hx * m.dx + hz * m.dz) / (hl * al) < Math.cos(ON_TARGET[look.kind] || 0.5)) return;   // still turning
        if (m.pmin !== undefined && hl > 0.3 && Math.abs(Math.asin(Math.max(-1, Math.min(1, m.dy))) - wantPitch(m, to)) > (ON_PITCH[look.kind] || 0.2)) return;   // still elevating
      }
    }
    clock.set(key, now + cadence * (0.85 + rand() * 0.3));
    roundNo.set(key, n0 + burst);
    const gap = look.kind === 'rocket' ? 0.24 : look.kind === 'missile' ? 0.12 : BURST_GAP;   // rockets ripple slower [MM-task_mvd1yej4_g]
    for (let k = 0; k < burst; k++) {
      const j = burst > 1 ? (look.kind === 'rocket' ? 0.45 : BURST_SPREAD) : 0;
      // a salvo's first rocket flies at the target itself and lights the ground fire there: the fire covers the sim's
      // splash circle around that point [MM-task_mvfjbh78_7]
      const lead = k === 0 && look.aoe > 0;
      const aim = lead ? { x: to.x, y: to.y, z: to.z } : { x: to.x + (rand() * 2 - 1) * j, y: to.y, z: to.z + (rand() * 2 - 1) * j };
      if (k === 0) { launch((muz && muz(n0)) || from, aim, look, tid, lead ? { x: to.x, z: to.z, r: look.aoe } : null); if (muz) kickOf(key, n0); }
      else queue.push({ at: now + k * gap, from: { x: from.x, y: from.y, z: from.z }, to: aim, look, tid, muz, n: n0 + k, key });
    }
  }

  function lookFor(entry, base, kind, color, scale, big = 0) {
    const k = (entry && entry.kind) || kind;
    const L = SHOT_LOOK[k] || SHOT_LOOK.tracer;
    return {
      kind: k, big: big || 0,
      speed: (entry && entry.speed) || base.speed,
      color: entry && entry.color !== undefined ? entry.color : color,
      size: L.size * ((entry && entry.size) || 1) * scale,
      len: L.len * ((entry && entry.streakLen) || 1) * scale,
      lob: (entry && entry.lob !== undefined ? entry.lob : base.lob) || 0,
      burn: base.burn || 0,
      aoe: base.aoe || 0,
    };
  }

  function emitShots(state, map, opts) {
    const now = state.time || 0;
    const pfx = opts.projFx || null;
    const scale = opts.projScale || 1;
    const getDef = opts.getDef || null;
    const muzzleOf = opts.muzzle || null;   // (structure id, n) → modelled firing point, from the System turrets
    const unitMuzzleOf = opts.unitMuzzle || null;   // (unit id, n) → a unit gun's firing point (units/unitBarrels.js) [MM-story_mvedy16u_9]

    // burst rounds that have come due
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (now < q.at) continue;
      launch((q.muz && q.muz(q.n)) || q.from, q.to, q.look, q.tid);   // a queued round leaves from its own barrel, wherever the turret now points
      if (q.muz) kickOf(q.key, q.n);
      queue[i] = queue[queue.length - 1]; queue.pop();
    }

    if (state.structures) {
      for (const st of state.structures.values()) {
        if (!st || !st.pos || st.targetId === null || st.targetId === undefined) continue;
        if (st.lifecycle !== 'Complete' && st.lifecycle !== 'Damaged') continue;
        const base = STRUCT_RECIPES[st.structId] || RECIPES[st.kind];
        if (!base) continue;
        const to = aimPoint(state, map, st.targetId, opts.flight);
        if (!to) continue;
        const fp = st.footprint || {};
        const cx = cellToWorld(st.pos.x + ((fp.w || 1) - 1) / 2), cz = cellToWorld(st.pos.y + ((fp.h || 1) - 1) / 2);
        // the round leaves the barrel tip (System turrets turn to the target), not the tower's centre
        const hx = to.x - cx, hz = to.z - cz, hl = Math.hypot(hx, hz) || 1;
        const from = { x: cx + (hx / hl) * MUZZLE.barrel, y: MUZZLE[st.kind] || MUZZLE.structure, z: cz + (hz / hl) * MUZZLE.barrel };
        const e = pfx && pfx[st.structId];
        const muz = muzzleOf ? (n) => muzzleOf(st.id, n) : null;
        const look = lookFor(e, base, base.kind, base.color, scale, base.big);
        look.tier = st.tier || 1;
        const burst = base.burstByTier ? base.burstByTier[Math.max(1, Math.min(base.burstByTier.length, look.tier)) - 1] : ((e && e.burst) || base.burst);
        fire('s' + st.id, now, from, to, look, burst, (e && e.cadence) || base.cadence, st.targetId, muz);
      }
    }

    if (state.units && getDef) {
      const base = RECIPES.unit;
      for (const u of state.units.values()) {
        if (!u || !u.pos || u.hp <= 0 || u.isHarvester || u.targetId === null || u.targetId === undefined) continue;
        if (opts.hidden && opts.hidden.has(u.id)) continue;   // a hidden contact (outside the play area) shows no muzzle fx [MM-story_mveehs1r_f]
        let def = null;
        try { def = getDef(u.unitId); } catch (e) { def = null; }
        const kind = shotFxFor(def);
        if (!kind) continue;
        const to = aimPoint(state, map, u.targetId, opts.flight);
        if (!to) continue;
        const flyer = u.domain === 'Flyer' || u.altitude > 0;
        const pose = opts.flight && opts.flight.get(u.id), run = pose && !pose.ground ? pose : null;   // ground poses only steer aim [MM-story_mvekcu8r_n]
        if (run && run.strafe && !run.inbound) continue;   // a strafing plane fires on its inbound run only [MM-story_mvee9r08_e]
        const from = run ? { x: run.x, y: run.y, z: run.z } : { x: pose ? pose.x : cellToWorld(u.pos.x), y: flyer ? HOVER_HEIGHT : MUZZLE.ground, z: pose ? pose.z : cellToWorld(u.pos.y) };
        if (!flyer) { from.gx = from.x; from.gz = from.z; from.gr = 0.22; }   // a tank's tracks — its firing shockwave starts here
        const e = pfx && pfx[u.unitId];
        const color = u.side === 'attacker' ? base.attacker : base.defender;
        const umuz = unitMuzzleOf && !run ? (n) => unitMuzzleOf(u.id, n) : null;
        fire('u' + u.id, now, from, to, lookFor(e, base, kind, color, scale), (e && e.burst) || base.burst, (e && e.cadence) || base.cadence, null, umuz);
      }
    }
  }

  function onEvent(ev, map) {
    if (!ev) return;
    if (ev.type === 'cannonShot' && ev.from && ev.to) {
      const a = { x: cellToWorld(ev.from.x), y: AIM.base, z: cellToWorld(ev.from.y) };
      flash(a.x, a.y, a.z, FLASH.cannonMuzzle);
      // The shell's arc and touchdown blast belong to the world-impact FX (story FX); here the blast lands with it.
      queueBlast(ev, map);
      return;
    }
    const p = eventPos(ev, map);
    if (!p) return;
    const x = cellToWorld(p.x), z = cellToWorld(p.y);
    switch (ev.type) {
      case 'kill': flash(x, AIM.ground, z, FLASH.kill, null, (ev.radius || 0.28) / 0.28); break;
      case 'destroyed': flash(x, AIM.structure, z, FLASH.destroyed); break;
      case 'mineExplode': flash(x, 0.2, z, FLASH.mine); break;
      case 'deposit': flash(x, AIM.base, z, FLASH.deposit, DEPOSIT_COLORS[ev.color]); break;
      default: break;
    }
  }

  // Base-cannon blast: timed to the shell's flight (ev.dur), like the Pixi shell that detonates on touchdown.
  const blasts = [];
  function queueBlast(ev) {
    blasts.push({ left: ev.dur || 1.6, x: cellToWorld(ev.to.x), z: cellToWorld(ev.to.y), scale: (ev.radius || 2.5) / 2.5 });
  }

  let ctx = { state: null, map: null, opts: {} };
  const retire = (i, s) => { shots[i] = shots[shots.length - 1]; shots.pop(); freeShots.push(s); };
  function advance(dt) {
    const trail = ctx.opts.trail || null, boomAt = ctx.opts.boom || null;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (s.kind === 'missile') {
        // seeker: re-aim at the target's live position, turn the velocity toward it, accelerate
        const tp = s.tid !== null && ctx.state ? aimPoint(ctx.state, ctx.map, s.tid, ctx.opts.flight) : null;   // homes on the DRAWN plane
        if (tp) { s.tx = tp.x; s.ty = tp.y; s.tz = tp.z; }
        s.t += dt;
        let ex = s.tx - s.x, ey = s.ty - s.y, ez = s.tz - s.z;
        const d = Math.hypot(ex, ey, ez);
        const opening = s.dPrev !== undefined && d > s.dPrev && d < FLIGHT.missFuse;   // it just passed its closest point
        if (d < FLIGHT.fuse + s.spd * dt || opening || s.t > FLIGHT.maxT) {
          // proximity burst AT THE MISSILE (beside the plane), not on the plane's centre
          flash(s.x, s.y, s.z, FLASH.airburst, null, s.big ? 1.5 : 1);
          if (trail) trail('burst', s.x, s.y, s.z, s.big ? 1.4 : 1);
          retire(i, s); continue;
        }
        s.dPrev = d;
        s.spd = Math.min(FLIGHT.maxSpeed * (s.big ? 1.1 : 1), s.spd + FLIGHT.accel * dt);
        ex /= d; ey /= d; ez /= d;
        const rate = Math.min(FLIGHT.turnMax, FLIGHT.turn * (1 + FLIGHT.turnGrow * s.t) * (d < 2 ? 1 + FLIGHT.closeBoost * (1 - d / 2) : 1));
        const turn = Math.min(1, rate * dt * (0.4 + Math.min(1, s.t * 2.5)));   // lazy off the rail, then locks on — tighter every moment
        let vx = s.vx / (Math.hypot(s.vx, s.vy, s.vz) || 1), vy = s.vy / (Math.hypot(s.vx, s.vy, s.vz) || 1), vz = s.vz / (Math.hypot(s.vx, s.vy, s.vz) || 1);
        vx += (ex - vx) * turn; vy += (ey - vy) * turn; vz += (ez - vz) * turn;
        const vl = Math.hypot(vx, vy, vz) || 1;
        s.dx = vx / vl; s.dy = vy / vl; s.dz = vz / vl;
        s.vx = s.dx * s.spd; s.vy = s.dy * s.spd; s.vz = s.dz * s.spd;
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
        if (trail) trail('missile', s.x - s.dx * 0.12, s.y - s.dy * 0.12, s.z - s.dz * 0.12, s.big ? 1.3 : 1, s.dx, s.dy, s.dz, s.t);
        continue;
      }
      if (s.kind === 'rocket' || s.lob) {
        // a lob: ground point lerps, a sine lifts it; the streak follows the arc's tangent
        s.t += dt;
        const u = Math.min(1, s.t / s.dur);
        const nx = s.fx + (s.tx - s.fx) * u, nz = s.fz + (s.tz - s.fz) * u, ny = s.fy + (s.ty - s.fy) * u + s.apex * 4 * u * (1 - u);
        const ddx = nx - s.x, ddy = ny - s.y, ddz = nz - s.z, dl = Math.hypot(ddx, ddy, ddz);
        if (dl > 1e-5) { s.dx = ddx / dl; s.dy = ddy / dl; s.dz = ddz / dl; }
        s.x = nx; s.y = ny; s.z = nz;
        if (s.lob) {   // a lobbed shell: lands with the shell's hit flash
          if (u >= 1) { flash(s.tx, s.ty, s.tz, FLASH.hit, null, Math.min(1.6, s.size / SHOT_LOOK.shell.size)); retire(i, s); }
          continue;
        }
        const nz0 = (ctx.opts.rocketTail || 0.1);   // the motor flame leaves the nozzle: a modelled rocket's length behind its nose
        if (trail) trail('rocket', s.x - s.dx * nz0, s.y - s.dy * nz0, s.z - s.dz * nz0, 1, s.dx, s.dy, s.dz, u);   // u: flight fraction
        if (u >= 1) {
          flash(s.tx, s.ty, s.tz, FLASH.rocketHit);
          if (boomAt) boomAt(s.tx, s.tz, 0.55);   // the AOE reads: a small ground explosion per rocket
          if (s.burn && s.tid !== null && ctx.opts.ignite) ctx.opts.ignite(s.tid, s.burn);   // the target burns until the next salvo
          if (s.field && ctx.opts.groundFire) ctx.opts.groundFire(s.field.x, s.field.z, s.field.r, s.burn || 4);   // …and so does the splash circle
          retire(i, s);
        }
        continue;
      }
      const step = s.speed * dt;
      if (step >= s.left) {
        if (s.kind === 'flak') flash(s.tx, s.ty, s.tz, FLASH.flak);
        else flash(s.tx, s.ty, s.tz, FLASH.hit, null, Math.min(1.6, s.size / SHOT_LOOK.shell.size));
        retire(i, s);
        continue;
      }
      s.left -= step;
      s.x += s.dx * step; s.y += s.dy * step; s.z += s.dz * step;
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.left -= dt;
      if (b.left > 0) continue;
      flash(b.x, 0.3, b.z, FLASH.cannonBlast, null, b.scale);
      blasts[i] = blasts[blasts.length - 1]; blasts.pop();
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.age += dt;
      const t = f.age / f.ttl;
      if (t >= 1) { flashes[i] = flashes[flashes.length - 1]; flashes.pop(); freeFlashes.push(f); continue; }
      f.size = f.size0 * (1 + 0.8 * t);     // blooms outward…
      f.alpha = Math.pow(1 - t, 1.6);       // …while fading fast (renderer.js updateGlows)
    }
  }

  function clear() {
    while (shots.length) freeShots.push(shots.pop());
    while (flashes.length) freeFlashes.push(flashes.pop());
    queue.length = 0; blasts.length = 0; clock.clear(); roundNo.clear();
  }

  return {
    shots, flashes,
    get launched() { return launched; },
    get caps() { return { ...limits }; },
    /** Change the effect budget (quality tiers). Live effects over the new cap finish their life. */
    setCaps(c) { if (c.maxShots !== undefined) limits.maxShots = c.maxShots; if (c.maxFlashes !== undefined) limits.maxFlashes = c.maxFlashes; },
    /** Advance one rendered frame. dt = real seconds since the last frame. */
    update(state, map, events, dt, opts = {}) {
      if (!state) return;
      const now = state.time || 0;
      if (now < lastTime) clear();   // restart / map change: the sim clock went back
      lastTime = now;
      const d = Math.min(0.1, Math.max(0, dt || 0));
      ctx = { state, map, opts };
      advance(d);
      if (events) for (const ev of events) onEvent(ev, map);
      emitShots(state, map, opts);
    },
    clear,
  };
}
