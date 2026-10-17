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
  // cadence = the tower def's `cadence` (tables.js): one drawn volley per sim volley (dps × cadence)
  'STR-Rockets': Object.freeze({ kind: 'rocket', cadence: 2.0, speed: 8, color: 0xffb070, burst: 4 }),
  'STR-Missile': Object.freeze({ kind: 'missile', cadence: 1.6, speed: 10, color: 0xffe2a0, burst: 2, big: 1 }),
});
export const SHOT_LOOK = Object.freeze({   // Pixi at ~35 px/cell: shell dot 12 px + 33 px streak, flak 17 px, tracer 4 px + 11 px
  shell: Object.freeze({ size: 0.24, len: 0.62 }),
  flak: Object.freeze({ size: 0.4, len: 0.55 }),
  tracer: Object.freeze({ size: 0.11, len: 0.42 }),
  missile: Object.freeze({ size: 0.2, len: 0.32 }),
  rocket: Object.freeze({ size: 0.24, len: 0.4 }),
});
/** Homing + arc flight (cells, s): missiles climb off the rail, then turn onto the target; rockets lob. */
export const FLIGHT = Object.freeze({ turn: 7.5, accel: 16, maxSpeed: 19, climb: 2.2, rocketApex: 0.9, rocketApexPerCell: 0.12, hitR: 0.22 });
const BURST_GAP = 0.07;      // s between burst rounds (sim clock)
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

/** Where a target is in world space, or null when it is gone. */
export function aimPoint(state, map, tid) {
  if (tid === null || tid === undefined) return null;
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
 * opts: { getDef(unitId) → def, projFx: { id: entry }, projScale } — all optional.
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

  function launch(from, to, look, tid = null) {
    if (shots.length >= limits.maxShots) return;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-4) return;
    const s = freeShots.pop() || {};
    s.x = from.x; s.y = from.y; s.z = from.z;
    s.tx = to.x; s.ty = to.y; s.tz = to.z;
    s.dx = dx / dist; s.dy = dy / dist; s.dz = dz / dist;
    s.left = dist; s.speed = look.speed;
    s.kind = look.kind; s.size = look.size; s.len = look.len; s.color = look.color;
    s.tid = tid; s.t = 0; s.big = look.big || 0;
    if (s.kind === 'missile') {
      // off the rail: up and slightly out, then the seeker takes over
      const h = Math.hypot(dx, dz) || 1, side = (rand() - 0.5) * 1.4;
      s.vx = (dx / h) * 2.5 - (dz / h) * side; s.vy = FLIGHT.climb + rand() * 0.8; s.vz = (dz / h) * 2.5 + (dx / h) * side;
      s.spd = Math.hypot(s.vx, s.vy, s.vz);
    } else if (s.kind === 'rocket') {
      s.fx = from.x; s.fy = from.y; s.fz = from.z; s.dur = Math.max(0.35, dist / look.speed); s.apex = FLIGHT.rocketApex + FLIGHT.rocketApexPerCell * dist;
    }
    shots.push(s);
    launched++;
    flash(from.x, from.y, from.z, FLASH.muzzle, look.color, Math.min(1.6, look.size / SHOT_LOOK.shell.size));
  }

  /** One shooter's turn: fire when its cadence allows, as a burst of `burst` rounds. */
  function fire(key, now, from, to, look, burst, cadence, tid = null) {
    if (now < (clock.get(key) || 0)) return;
    clock.set(key, now + cadence * (0.85 + rand() * 0.3));
    const gap = look.kind === 'missile' || look.kind === 'rocket' ? 0.12 : BURST_GAP;
    for (let k = 0; k < burst; k++) {
      const j = burst > 1 ? (look.kind === 'rocket' ? 0.45 : BURST_SPREAD) : 0;
      const aim = { x: to.x + (rand() * 2 - 1) * j, y: to.y, z: to.z + (rand() * 2 - 1) * j };
      if (k === 0) launch(from, aim, look, tid);
      else queue.push({ at: now + k * gap, from: { x: from.x, y: from.y, z: from.z }, to: aim, look, tid });
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
    };
  }

  function emitShots(state, map, opts) {
    const now = state.time || 0;
    const pfx = opts.projFx || null;
    const scale = opts.projScale || 1;
    const getDef = opts.getDef || null;

    // burst rounds that have come due
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (now < q.at) continue;
      launch(q.from, q.to, q.look, q.tid);
      queue[i] = queue[queue.length - 1]; queue.pop();
    }

    if (state.structures) {
      for (const st of state.structures.values()) {
        if (!st || !st.pos || st.targetId === null || st.targetId === undefined) continue;
        if (st.lifecycle !== 'Complete' && st.lifecycle !== 'Damaged') continue;
        const base = STRUCT_RECIPES[st.structId] || RECIPES[st.kind];
        if (!base) continue;
        const to = aimPoint(state, map, st.targetId);
        if (!to) continue;
        const fp = st.footprint || {};
        const cx = cellToWorld(st.pos.x + ((fp.w || 1) - 1) / 2), cz = cellToWorld(st.pos.y + ((fp.h || 1) - 1) / 2);
        // the round leaves the barrel tip (System turrets turn to the target), not the tower's centre
        const hx = to.x - cx, hz = to.z - cz, hl = Math.hypot(hx, hz) || 1;
        const from = { x: cx + (hx / hl) * MUZZLE.barrel, y: MUZZLE[st.kind] || MUZZLE.structure, z: cz + (hz / hl) * MUZZLE.barrel };
        const e = pfx && pfx[st.structId];
        fire('s' + st.id, now, from, to, lookFor(e, base, base.kind, base.color, scale, base.big), (e && e.burst) || base.burst, (e && e.cadence) || base.cadence, st.targetId);
      }
    }

    if (state.units && getDef) {
      const base = RECIPES.unit;
      for (const u of state.units.values()) {
        if (!u || !u.pos || u.hp <= 0 || u.isHarvester || u.targetId === null || u.targetId === undefined) continue;
        let def = null;
        try { def = getDef(u.unitId); } catch (e) { def = null; }
        const kind = shotFxFor(def);
        if (!kind) continue;
        const to = aimPoint(state, map, u.targetId);
        if (!to) continue;
        const flyer = u.domain === 'Flyer' || u.altitude > 0;
        const from = { x: cellToWorld(u.pos.x), y: flyer ? HOVER_HEIGHT : MUZZLE.ground, z: cellToWorld(u.pos.y) };
        const e = pfx && pfx[u.unitId];
        const color = u.side === 'attacker' ? base.attacker : base.defender;
        fire('u' + u.id, now, from, to, lookFor(e, base, kind, color, scale), (e && e.burst) || base.burst, (e && e.cadence) || base.cadence);
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
        const tp = s.tid !== null && ctx.state ? aimPoint(ctx.state, ctx.map, s.tid) : null;
        if (tp) { s.tx = tp.x; s.ty = tp.y; s.tz = tp.z; }
        s.t += dt;
        let ex = s.tx - s.x, ey = s.ty - s.y, ez = s.tz - s.z;
        const d = Math.hypot(ex, ey, ez);
        if (d < FLIGHT.hitR + s.spd * dt || s.t > 3) {
          flash(s.tx, s.ty, s.tz, FLASH.airburst, null, s.big ? 1.5 : 1);
          if (trail) trail('burst', s.tx, s.ty, s.tz, s.big ? 1.4 : 1);
          retire(i, s); continue;
        }
        s.spd = Math.min(FLIGHT.maxSpeed * (s.big ? 1.1 : 1), s.spd + FLIGHT.accel * dt);
        ex /= d; ey /= d; ez /= d;
        const turn = Math.min(1, FLIGHT.turn * dt * (0.4 + Math.min(1, s.t * 2.5)));   // lazy off the rail, then locks on
        let vx = s.vx / (Math.hypot(s.vx, s.vy, s.vz) || 1), vy = s.vy / (Math.hypot(s.vx, s.vy, s.vz) || 1), vz = s.vz / (Math.hypot(s.vx, s.vy, s.vz) || 1);
        vx += (ex - vx) * turn; vy += (ey - vy) * turn; vz += (ez - vz) * turn;
        const vl = Math.hypot(vx, vy, vz) || 1;
        s.dx = vx / vl; s.dy = vy / vl; s.dz = vz / vl;
        s.vx = s.dx * s.spd; s.vy = s.dy * s.spd; s.vz = s.dz * s.spd;
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
        if (trail) trail('missile', s.x - s.dx * 0.12, s.y - s.dy * 0.12, s.z - s.dz * 0.12, s.big ? 1.3 : 1);
        continue;
      }
      if (s.kind === 'rocket') {
        // a lob: ground point lerps, a sine lifts it; the streak follows the arc's tangent
        s.t += dt;
        const u = Math.min(1, s.t / s.dur);
        const nx = s.fx + (s.tx - s.fx) * u, nz = s.fz + (s.tz - s.fz) * u, ny = s.fy + (s.ty - s.fy) * u + s.apex * 4 * u * (1 - u);
        const ddx = nx - s.x, ddy = ny - s.y, ddz = nz - s.z, dl = Math.hypot(ddx, ddy, ddz);
        if (dl > 1e-5) { s.dx = ddx / dl; s.dy = ddy / dl; s.dz = ddz / dl; }
        s.x = nx; s.y = ny; s.z = nz;
        if (trail) trail('rocket', s.x - s.dx * 0.1, s.y - s.dy * 0.1, s.z - s.dz * 0.1, 1);
        if (u >= 1) {
          flash(s.tx, s.ty, s.tz, FLASH.rocketHit);
          if (boomAt) boomAt(s.tx, s.tz, 0.55);   // the AOE reads: a small ground explosion per rocket
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
    queue.length = 0; blasts.length = 0; clock.clear();
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
