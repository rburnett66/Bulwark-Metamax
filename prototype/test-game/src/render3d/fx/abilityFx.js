/**
 * src/render3d/fx/abilityFx.js — the SPECIAL ABILITY visual effects [MM-story_mvn06y2l_8].
 *
 * Owner 2026-10-24: "We need very cool visual effects." Spec: docs/16 Bulwark MM/design/Special-Abilities-Design.md §5.
 *
 * Two halves, like the rest of render3d/fx:
 *   createAbilityFx()          — the MODEL. Pure (no three.js): reads the sim state and this frame's 'ability' events and
 *                                keeps a list of SHELLS (domes, bubbles, crusts, columns), DECALS (puddles, rings, sigils,
 *                                mines on the ground), SPRITES (glowing particles: shards, wisps, sparks, trails) and the
 *                                per-unit FX the unit renderer applies (cloak / mirror hologram / rising).
 *   createAbilityFxView(THREE) — the VIEW. Three instanced draws with their own shaders.
 *
 * Presentation only: the sim is never touched. Particle randomness comes from a local LCG, not Math.random, so a page can
 * replay the same look.
 */
import { cellToWorld } from '../camera.js';

export const HOVER_Y = 1.1;

export const COLORS = Object.freeze({
  shieldTank: [1.0, 0.78, 0.32],
  freeze: [0.62, 0.9, 1.0],
  frost: [0.85, 0.97, 1.0],
  shieldDrone: [0.45, 0.82, 1.0],
  shieldFlare: [0.85, 0.65, 1.0],
  mine: [1.0, 0.18, 0.1],
  fire: [1.0, 0.55, 0.15],
  dirt: [0.45, 0.36, 0.26],
  water: [0.25, 0.62, 1.0],
  foam: [0.8, 0.93, 1.0],
  mirror: [0.3, 1.0, 0.95],
  stealth: [0.62, 0.66, 1.0],
  raise: [0.35, 1.0, 0.45],
  soul: [0.7, 1.0, 0.75],
  stun: [0.75, 1.0, 0.25],
  arc: [0.9, 1.0, 0.7],
});

// shell modes (the view's shader switches on these)
export const SHELL = Object.freeze({ HEX: 0, BUBBLE: 1, FROST: 2, ELECTRIC: 3, COLUMN: 4 });
// decal modes
export const DECAL = Object.freeze({ PUDDLE: 0, NOVA: 1, MINE: 2, SHOCK: 3, CLOAK: 4, HEXRING: 5, SIGIL: 6 });
// sprite shapes
export const SHAPE = Object.freeze({ GLOW: 0, SHARD: 1, RING: 2 });

const PARTICLE_CAP = 2400;

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function createAbilityFx({ seed = 7 } = {}) {
  const rand = lcg(seed);
  const rnd = (a, b) => a + (b - a) * rand();
  const parts = [];            // live particles
  const flights = [];          // missiles / darts / blobs in the air: { kind, from, to, t, dur, h }
  const bursts = [];           // short-lived decals/shells: { kind, x, z, r, t, dur, ... }
  const towerFx = new Map();   // structure id → { kind: 'frost'|'electric', until (sim tick) }
  const sigils = new Map();    // raise key → { x, z, t, dur }
  const columns = [];          // soul columns { x, z, t, dur }
  const raisedFade = new Map();// unit id → seconds left of its rising glow
  const mirrorIds = new Set(); // mirrors alive last frame (to shatter the one that dies)
  const flash = new Map();     // carrier id → flash 0..1 (shield tank / shield drone hits)
  const lastPool = new Map();  // shield drone id → last pool (a drop is a blocked hit)
  let clock = 0;

  const out = { shells: [], decals: [], sprites: [], unitFx: new Map() };

  function emit(p) { if (parts.length < PARTICLE_CAP) parts.push(p); }
  function particle(x, y, z, vx, vy, vz, life, size, col, opts = {}) {
    emit({ x, y, z, vx, vy, vz, life, age: 0, size, grow: opts.grow || 0, col, alpha: opts.alpha ?? 1,
      shape: opts.shape || SHAPE.GLOW, drag: opts.drag ?? 0.6, grav: opts.grav ?? 0, swirl: opts.swirl || null });
  }
  const W = (p) => ({ x: cellToWorld(p.x), z: cellToWorld(p.y) });

  // ---- one-shot bursts -----------------------------------------------------------------------------------------
  function frostNova(x, z, radius) {
    bursts.push({ kind: 'nova', x, z, r: radius * 1.15, t: 0, dur: 0.55 });
    particle(x, 0.5, z, 0, 0, 0, 0.25, 2.6, COLORS.frost, { grow: 1.5 });
    for (let i = 0; i < 46; i++) {
      const a = rnd(0, 6.283), sp = rnd(2.5, 6.5);
      particle(x, rnd(0.2, 0.6), z, Math.cos(a) * sp, rnd(1.5, 4.5), Math.sin(a) * sp, rnd(0.6, 1.2), rnd(0.07, 0.15), COLORS.freeze, { shape: SHAPE.SHARD, grav: 9, drag: 1.2 });
    }
    for (let i = 0; i < 18; i++) {
      const a = rnd(0, 6.283), rr = rnd(0, radius);
      particle(x + Math.cos(a) * rr, 0.15, z + Math.sin(a) * rr, rnd(-0.2, 0.2), rnd(0.2, 0.6), rnd(-0.2, 0.2), rnd(1.2, 2.2), rnd(0.35, 0.6), COLORS.frost, { alpha: 0.35, grow: 0.5 });
    }
  }
  function sparkBurst(x, y, z, col, n, sp = 3) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), e = rnd(-0.3, 1);
      particle(x, y, z, Math.cos(a) * sp * rnd(0.4, 1), e * sp, Math.sin(a) * sp * rnd(0.4, 1), rnd(0.25, 0.6), rnd(0.03, 0.06), col, { grav: 6, drag: 1.5 });
    }
  }
  function splash(x, z, radius) {
    particle(x, 0.3, z, 0, 0, 0, 0.2, 1.6, COLORS.foam, { grow: 2 });
    for (let i = 0; i < 40; i++) {
      const a = rnd(0, 6.283), sp = rnd(1.5, 4);
      particle(x, 0.2, z, Math.cos(a) * sp, rnd(2, 5), Math.sin(a) * sp, rnd(0.5, 0.9), rnd(0.06, 0.13), i % 3 ? COLORS.water : COLORS.foam, { grav: 12, drag: 0.4 });
    }
    bursts.push({ kind: 'shock', x, z, r: radius, t: 0, dur: 0.45, col: COLORS.foam });
  }
  function mineBlast(x, z, radius) {
    particle(x, 0.5, z, 0, 0, 0, 0.18, 2.4, COLORS.fire, { grow: 2 });
    for (let i = 0; i < 26; i++) { const a = rnd(0, 6.283), sp = rnd(1, 3.5); particle(x, 0.2, z, Math.cos(a) * sp, rnd(1, 3), Math.sin(a) * sp, rnd(0.3, 0.6), rnd(0.12, 0.25), COLORS.fire, { grow: 0.6, drag: 2 }); }
    for (let i = 0; i < 22; i++) { const a = rnd(0, 6.283), sp = rnd(1.5, 5); particle(x, 0.1, z, Math.cos(a) * sp, rnd(2, 6), Math.sin(a) * sp, rnd(0.6, 1.1), rnd(0.06, 0.12), COLORS.dirt, { grav: 12, drag: 0.5, alpha: 0.9 }); }
    sparkBurst(x, 0.3, z, COLORS.fire, 20, 5);
    bursts.push({ kind: 'shock', x, z, r: radius * 1.6, t: 0, dur: 0.4, col: COLORS.fire });
  }
  function puff(x, z, col, n = 10) {
    for (let i = 0; i < n; i++) particle(x + rnd(-0.2, 0.2), 0.1, z + rnd(-0.2, 0.2), rnd(-0.6, 0.6), rnd(0.4, 1.2), rnd(-0.6, 0.6), rnd(0.5, 0.9), rnd(0.15, 0.3), col, { grow: 0.8, alpha: 0.55, drag: 2 });
  }
  function shatter(x, y, z, col, n) {
    particle(x, y, z, 0, 0, 0, 0.18, 1.3, col, { grow: 1.5 });
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), sp = rnd(1.5, 4);
      particle(x, y + rnd(-0.2, 0.3), z, Math.cos(a) * sp, rnd(0.5, 3.5), Math.sin(a) * sp, rnd(0.5, 1.0), rnd(0.05, 0.11), col, { shape: SHAPE.SHARD, grav: 7, drag: 1 });
    }
  }

  // ---- events ---------------------------------------------------------------------------------------------------
  function onEvent(e, state) {
    if (!e) return;
    if (e.type === 'kill' && mirrorIds.has(e.entityId)) { const p = W(e.pos); shatter(p.x, 0.5, p.z, COLORS.mirror, 26); return; }
    if (e.type === 'damage' && state) {
      const u = state.units && state.units.get(e.targetId);
      if (u && u.abilityArmor < 1) for (const c of state.units.values()) if (c.ability === 'shieldTank' && c.hp > 0 && Math.hypot(c.pos.x - u.pos.x, c.pos.y - u.pos.y) <= 2.6) flash.set(c.id, 1);
      return;
    }
    if (e.type !== 'ability') return;
    switch (e.kind) {
      case 'freezeLaunch': flights.push({ kind: 'freeze', from: W(e.from), to: W(e.to), t: 0, dur: e.flight || 0.6, h: 2.6, y0: HOVER_Y }); break;
      case 'freezeHit': { const p = W(e.pos); frostNova(p.x, p.z, e.radius || 2);
        if (state) for (const s of state.structures.values()) if (Math.hypot(s.pos.x - e.pos.x, s.pos.y - e.pos.y) <= (e.radius || 2) + 1e-6) towerFx.set(s.id, { kind: 'frost', until: e.until });
        break; }
      case 'stunDrone': flights.push({ kind: 'dart', from: W(e.from), to: W(e.to), t: 0, dur: e.flight || 0.5, h: 1.6, y0: 0.6, target: e.targetId }); break;
      case 'towerStunned': towerFx.set(e.targetId, { kind: 'electric', until: e.until });
        if (state) { const s = state.structures.get(e.targetId); if (s) { const p = W(s.pos); sparkBurst(p.x, 0.9, p.z, COLORS.arc, 24, 3.5); } }
        break;
      case 'blobLaunch': flights.push({ kind: 'blob', from: W(e.from), to: W(e.to), t: 0, dur: e.flight || 0.8, h: 2.2, y0: HOVER_Y }); break;
      case 'puddle': { const p = W(e.pos); splash(p.x, p.z, e.radius || 1.5); break; }
      case 'minePlaced': { const p = W(e.pos); puff(p.x, p.z, COLORS.dirt, 12); break; }
      case 'mineBlast': { const p = W(e.pos); mineBlast(p.x, p.z, e.radius || 1); break; }
      case 'mineFizzle': { const p = W(e.pos); puff(p.x, p.z, [0.5, 0.5, 0.5], 6); break; }
      case 'mirrorCast': { const p = W(e.pos);
        bursts.push({ kind: 'shock', x: p.x, z: p.z, r: 0.9, t: 0, dur: 0.35, col: COLORS.mirror });
        for (let i = 0; i < 18; i++) particle(p.x + rnd(-0.4, 0.4), rnd(0, 1.2), p.z + rnd(-0.4, 0.4), 0, rnd(0.3, 1.2), 0, rnd(0.4, 0.8), rnd(0.04, 0.08), COLORS.mirror, { shape: SHAPE.SHARD });
        break; }
      case 'mirrorFade': { const p = W(e.pos); shatter(p.x, 0.5, p.z, COLORS.mirror, 18); break; }
      case 'shieldPop': { const p = W(e.pos);
        shatter(p.x, 0.9, p.z, COLORS.shieldDrone, 50);
        bursts.push({ kind: 'shock', x: p.x, z: p.z, r: 2.8, t: 0, dur: 0.5, col: COLORS.shieldDrone });
        bursts.push({ kind: 'popBubble', x: p.x, z: p.z, r: 2.5, t: 0, dur: 0.35 });
        break; }
      case 'raiseStart': { const p = W(e.pos); sigils.set(`${e.pos.x},${e.pos.y},${e.tick}`, { x: p.x, z: p.z, t: 0, dur: 1.6, key: `${e.pos.x},${e.pos.y}` }); break; }
      case 'raised': { const p = W(e.pos);
        for (const [k, sg] of sigils) if (sg.key === `${e.pos.x},${e.pos.y}`) sigils.delete(k);
        columns.push({ x: p.x, z: p.z, t: 0, dur: 1.1 });
        bursts.push({ kind: 'shock', x: p.x, z: p.z, r: 1.8, t: 0, dur: 0.5, col: COLORS.raise });
        particle(p.x, 0.6, p.z, 0, 0, 0, 0.3, 2.0, COLORS.raise, { grow: 1 });
        for (let i = 0; i < 30; i++) { const a = rnd(0, 6.283); particle(p.x + Math.cos(a) * 0.5, 0.1, p.z + Math.sin(a) * 0.5, -Math.cos(a) * 0.3, rnd(2, 4.5), -Math.sin(a) * 0.3, rnd(0.6, 1.1), rnd(0.05, 0.1), COLORS.raise, { drag: 0.8 }); }
        raisedFade.set(e.entityId, 1.2);
        break; }
      case 'raiseCancelled': { const p = W(e.pos); for (const [k, sg] of sigils) if (sg.key === `${e.pos.x},${e.pos.y}`) sigils.delete(k); puff(p.x, p.z, [0.4, 0.5, 0.4], 8); break; }
      default: break;
    }
  }

  // ---- per frame ------------------------------------------------------------------------------------------------
  /**
   * @param state sim state (read only)
   * @param events this frame's sim events
   * @param dt seconds since the last frame (0 when paused)
   * @param opts { drawn: Map id → {x,y,z} where flyers are drawn (render3d airLift) }
   */
  function update(state, events, dt, opts = {}) {
    dt = Math.max(0, Math.min(0.1, dt || 0));
    clock += dt;
    if (events) for (const e of events) onEvent(e, state);
    const tick = state ? state.tick : 0;
    const shells = [], decals = [], sprites = [], unitFx = new Map();
    const drawnAt = (u) => { const d = opts.drawn && opts.drawn.get(u.id); return d ? { x: d.x, y: d.y, z: d.z } : { x: cellToWorld(u.pos.x), y: u.altitude > 0 ? HOVER_Y : 0, z: cellToWorld(u.pos.y) }; };

    // flights: interpolate the arc, trail particles, land
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const x = f.from.x + (f.to.x - f.from.x) * k, z = f.from.z + (f.to.z - f.from.z) * k;
      const y = f.y0 * (1 - k) + 0.35 * k + f.h * 4 * k * (1 - k);
      if (f.kind === 'freeze') {
        sprites.push({ x, y, z, size: 0.55, col: COLORS.frost, alpha: 1, shape: SHAPE.GLOW });
        sprites.push({ x, y, z, size: 0.22, col: [1, 1, 1], alpha: 1, shape: SHAPE.GLOW });
        if (dt > 0) for (let n = 0; n < 3; n++) particle(x, y, z, rnd(-0.2, 0.2), rnd(-0.1, 0.2), rnd(-0.2, 0.2), rnd(0.4, 0.7), rnd(0.12, 0.22), COLORS.freeze, { grow: 0.4, alpha: 0.6, drag: 3 });
      } else if (f.kind === 'dart') {
        const wob = Math.sin(f.t * 40) * 0.08;
        sprites.push({ x: x + wob, y, z: z - wob, size: 0.32, col: COLORS.stun, alpha: 1, shape: SHAPE.GLOW });
        sprites.push({ x: x + wob, y, z: z - wob, size: 0.12, col: [1, 1, 0.9], alpha: 1, shape: SHAPE.GLOW });
        if (dt > 0) particle(x, y, z, rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3), 0.3, 0.05, COLORS.arc, { drag: 2 });
      } else {   // blob
        const wob = 1 + Math.sin(f.t * 22) * 0.18;
        sprites.push({ x, y, z, size: 0.62 * wob, col: COLORS.water, alpha: 0.95, shape: SHAPE.GLOW });
        sprites.push({ x, y: y + 0.05, z, size: 0.3 / wob, col: COLORS.foam, alpha: 0.9, shape: SHAPE.GLOW });
        if (dt > 0 && rand() < 0.7) particle(x, y, z, rnd(-0.3, 0.3), rnd(-1, 0), rnd(-0.3, 0.3), 0.5, rnd(0.04, 0.08), COLORS.water, { grav: 8 });
      }
      if (k >= 1) {
        if (f.kind === 'dart') sparkBurst(f.to.x, 0.8, f.to.z, COLORS.arc, 14, 3);
        flights.splice(i, 1);
      }
    }

    // carriers and their auras
    const live = [];
    if (state && state.units) for (const u of state.units.values()) if (u.hp > 0) live.push(u);
    const mirrorsNow = new Set();
    for (const u of live) {
      if (u.isMirror) { mirrorsNow.add(u.id); const left = Math.max(0, (u.expiresAt - tick) * (state._abilityDt || 1 / 30)); unitFx.set(u.id, { kind: 'mirror', k: 0.75 + 0.25 * Math.sin(clock * 30 + u.id) * (left < 1.5 ? 1 : 0.2) }); }
      else if (u.cloaked) unitFx.set(u.id, { kind: 'cloak', k: 1 });
      if (raisedFade.has(u.id)) unitFx.set(u.id, { kind: 'raised', k: Math.min(1, raisedFade.get(u.id)) });
      if (u.disruptedUntil && tick < u.disruptedUntil && dt > 0 && rand() < dt * 10) {
        const p = drawnAt(u); particle(p.x + rnd(-0.3, 0.3), 0.1, p.z + rnd(-0.3, 0.3), 0, rnd(0.4, 0.8), 0, rnd(0.5, 0.9), rnd(0.03, 0.06), COLORS.foam, { shape: SHAPE.RING, drag: 1 });
      }
      if (!u.ability || u.side !== 'attacker') continue;
      const p = drawnAt(u);
      const fl = flash.get(u.id) || 0;
      if (u.ability === 'shieldTank') {
        shells.push({ x: p.x, y: 0, z: p.z, r: 2.5, ry: 1.25, mode: SHELL.HEX, t: clock, extra: fl, col: COLORS.shieldTank, alpha: 0.32 });
        decals.push({ x: p.x, z: p.z, r: 2.5, mode: DECAL.HEXRING, t: clock, extra: fl, col: COLORS.shieldTank, alpha: 0.6 });
      } else if (u.ability === 'shieldDrone' && u.shieldPool > 0) {
        const pool0 = lastPool.has(u.id) ? lastPool.get(u.id) : u.shieldPool;
        if (u.shieldPool < pool0 - 1e-6) flash.set(u.id, 1);
        lastPool.set(u.id, u.shieldPool);
        const frac = Math.min(1, u.shieldPool / 300);
        // the bubble sits where the sim protects (the drone's own spot); the drone may be drawn off on an attack run,
        // so an energy tether links it to its bubble
        const cx = cellToWorld(u.pos.x), cz = cellToWorld(u.pos.y);
        shells.push({ x: cx, y: 0, z: cz, r: 2.5, ry: 1.7, mode: SHELL.BUBBLE, t: clock, extra: fl, col: COLORS.shieldDrone, alpha: 0.35 + 0.4 * frac });
        const top = { x: cx, y: 1.7, z: cz }, L = Math.hypot(p.x - top.x, p.y - top.y, p.z - top.z);
        if (L > 0.4) for (let k = 0, n = Math.ceil(L / 0.25); k <= n; k++) {
          const f = k / n, pulse = 0.5 + 0.5 * Math.sin(clock * 14 - f * 12);
          sprites.push({ x: p.x + (top.x - p.x) * f, y: p.y + (top.y - p.y) * f, z: p.z + (top.z - p.z) * f, size: 0.12 + 0.08 * pulse, col: COLORS.shieldDrone, alpha: 0.35 + 0.5 * pulse, shape: SHAPE.GLOW });
        }
        sprites.push({ x: p.x, y: p.y, z: p.z, size: 0.45 + 0.1 * Math.sin(clock * 6), col: COLORS.shieldDrone, alpha: 0.8, shape: SHAPE.GLOW });
      } else if (u.ability === 'stealth') {
        decals.push({ x: p.x, z: p.z, r: 2.5, mode: DECAL.CLOAK, t: clock, extra: 0, col: COLORS.stealth, alpha: 0.55 });
        if (dt > 0 && rand() < dt * 8) { const a = rnd(0, 6.283); particle(p.x + Math.cos(a) * 2.4, 0.1, p.z + Math.sin(a) * 2.4, 0, rnd(0.3, 0.7), 0, 0.8, 0.05, COLORS.stealth, { alpha: 0.6 }); }
      } else if (u.ability === 'resurrect') {
        if (dt > 0 && rand() < dt * 6) { const a = rnd(0, 6.283); particle(p.x + Math.cos(a) * 0.4, 0.3, p.z + Math.sin(a) * 0.4, 0, rnd(0.2, 0.5), 0, 1.2, 0.05, COLORS.raise, { alpha: 0.7, swirl: { cx: p.x, cz: p.z, w: 3 } }); }
      } else if (u.ability === 'stunDrones' || u.ability === 'mineLayer' || u.ability === 'mirrorUnits' || u.ability === 'waterBlobs' || u.ability === 'freezeMissile') {
        // a small beacon over the carrier so the player can pick it out of the column
        const col = u.ability === 'stunDrones' ? COLORS.stun : u.ability === 'mineLayer' ? COLORS.mine : u.ability === 'mirrorUnits' ? COLORS.mirror : u.ability === 'waterBlobs' ? COLORS.water : COLORS.freeze;
        sprites.push({ x: p.x, y: p.y + 0.9 + Math.sin(clock * 4 + u.id) * 0.06, z: p.z, size: 0.22 + 0.04 * Math.sin(clock * 8 + u.id), col, alpha: 0.85, shape: SHAPE.GLOW });
      }
      if (fl > 0) flash.set(u.id, Math.max(0, fl - dt * 4));
    }
    for (const id of mirrorIds) if (!mirrorsNow.has(id)) mirrorIds.delete(id);
    for (const id of mirrorsNow) mirrorIds.add(id);
    for (const [id, left] of raisedFade) { const l = left - dt; if (l <= 0) raisedFade.delete(id); else raisedFade.set(id, l); }

    // towers knocked out
    if (state && state.structures) for (const [id, fx] of towerFx) {
      const s = state.structures.get(id);
      if (!s || !(tick < fx.until) || s.hp <= 0) { towerFx.delete(id); continue; }
      const x = cellToWorld(s.pos.x), z = cellToWorld(s.pos.y);
      if (fx.kind === 'frost') {
        shells.push({ x, y: 0, z, r: 0.85, ry: 1.25, mode: SHELL.FROST, t: clock, extra: 0, col: COLORS.frost, alpha: 0.85 });
        if (dt > 0 && rand() < dt * 10) particle(x + rnd(-0.6, 0.6), rnd(0.6, 1.3), z + rnd(-0.6, 0.6), rnd(-0.1, 0.1), rnd(-0.3, -0.1), rnd(-0.1, 0.1), rnd(0.8, 1.4), rnd(0.04, 0.07), COLORS.frost, { shape: SHAPE.SHARD });
      } else {
        shells.push({ x, y: 0, z, r: 0.85, ry: 1.3, mode: SHELL.ELECTRIC, t: clock, extra: 0, col: COLORS.stun, alpha: 0.9 });
        if (dt > 0 && rand() < dt * 18) sparkBurst(x + rnd(-0.4, 0.4), rnd(0.5, 1.3), z + rnd(-0.4, 0.4), COLORS.arc, 3, 2);
      }
    }

    // mines on the fields
    if (state && state.enemyMines) for (const m of state.enemyMines) {
      const x = cellToWorld(m.pos.x), z = cellToWorld(m.pos.y);
      const armed = tick >= m.armAt;
      decals.push({ x, z, r: 0.34, mode: DECAL.MINE, t: clock, extra: armed ? 1 : 0, col: COLORS.mine, alpha: 1 });
      if (armed && Math.sin(clock * 9 + m.id) > 0.55) sprites.push({ x, y: 0.12, z, size: 0.3, col: COLORS.mine, alpha: 0.9, shape: SHAPE.GLOW });
    }

    // puddles
    if (state && state.puddles) for (const pd of state.puddles) {
      const left = (pd.until - tick) * (state._abilityDt || 1 / 30);
      const p = W(pd.pos);
      decals.push({ x: p.x, z: p.z, r: pd.radius, mode: DECAL.PUDDLE, t: clock, extra: Math.min(1, left / 0.6), col: COLORS.water, alpha: 0.8 });
    }

    // sigils (a raise on its way) and soul columns
    for (const [k, sg] of sigils) {
      sg.t += dt;
      if (sg.t > sg.dur + 0.5) { sigils.delete(k); continue; }
      const g = Math.min(1, sg.t / 0.35);
      decals.push({ x: sg.x, z: sg.z, r: 0.95 * g, mode: DECAL.SIGIL, t: clock, extra: g, col: COLORS.raise, alpha: 0.9 });
      if (dt > 0 && rand() < dt * 20) { const a = rnd(0, 6.283); particle(sg.x + Math.cos(a) * 1.0, rnd(0.1, 0.8), sg.z + Math.sin(a) * 1.0, 0, rnd(0.1, 0.4), 0, 0.8, rnd(0.04, 0.07), COLORS.soul, { swirl: { cx: sg.x, cz: sg.z, w: 4, pull: 1.2 } }); }
    }
    for (let i = columns.length - 1; i >= 0; i--) {
      const c = columns[i]; c.t += dt;
      const k = c.t / c.dur;
      if (k >= 1) { columns.splice(i, 1); continue; }
      shells.push({ x: c.x, y: 0, z: c.z, r: 0.55 + 0.25 * k, ry: 3.2, mode: SHELL.COLUMN, t: clock, extra: 1 - k, col: COLORS.raise, alpha: 1 - k * k });
    }

    // bursts: nova rings, shockwaves, the popping bubble
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += dt;
      const k = b.t / b.dur;
      if (k >= 1) { bursts.splice(i, 1); continue; }
      if (b.kind === 'nova') decals.push({ x: b.x, z: b.z, r: b.r, mode: DECAL.NOVA, t: clock, extra: k, col: COLORS.freeze, alpha: 1 });
      else if (b.kind === 'shock') decals.push({ x: b.x, z: b.z, r: b.r, mode: DECAL.SHOCK, t: clock, extra: k, col: b.col, alpha: 1 });
      else if (b.kind === 'popBubble') shells.push({ x: b.x, y: 0, z: b.z, r: b.r * (1 + k * 0.25), ry: 1.7 * (1 + k * 0.25), mode: SHELL.BUBBLE, t: clock, extra: 1, col: COLORS.shieldFlare, alpha: 1 - k });
    }

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (p.swirl) {   // orbit a centre, drawn inward and upward (the raise's soul wisps)
        const s = p.swirl, dx = p.x - s.cx, dz = p.z - s.cz;
        p.vx += (-dz * s.w - dx * (s.pull || 0.2)) * dt; p.vz += (dx * s.w - dz * (s.pull || 0.2)) * dt;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d - p.grav * dt; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy = Math.abs(p.vy) * 0.25; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.age / p.life;
      sprites.push({ x: p.x, y: p.y, z: p.z, size: p.size * (1 + p.grow * k), col: p.col, alpha: p.alpha * (1 - k) * (k < 0.08 ? k / 0.08 : 1), shape: p.shape });
    }

    out.shells = shells; out.decals = decals; out.sprites = sprites; out.unitFx = unitFx;
    return out;
  }

  return { update, get out() { return out; }, get particles() { return parts.length; }, onEvent };
}

/* ======================================================================================================== VIEW */

const SHELL_VS = `
attribute vec4 iXf; attribute vec4 iMd; attribute vec4 iCol;
varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec4 vMd; varying vec4 vCol; varying vec2 vR;
void main() {
  vP = position; vMd = iMd; vCol = iCol; vR = vec2(iXf.w, iMd.x);
  vec3 w = vec3(iXf.x + position.x * iXf.w, iXf.y + position.y * iMd.x, iXf.z + position.z * iXf.w);
  vW = w;
  vN = normalize(vec3(position.x / max(iXf.w, 0.01), position.y / max(iMd.x, 0.01), position.z / max(iXf.w, 0.01)));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

// iMd: x = ry, y = mode, z = time, w = extra
const SHELL_FS = `
varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec4 vMd; varying vec4 vCol; varying vec2 vR;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float hexEdge(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h; vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g); float d = max(dot(q, normalize(r)), q.x);
  return smoothstep(0.42, 0.5, d);
}
void main() {
  int mode = int(vMd.y + 0.5); float t = vMd.z, ex = vMd.w;
  vec3 V = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.2);
  float ang = atan(vP.z, vP.x);
  float yN = clamp(vP.y, 0.0, 1.0);
  vec3 col = vCol.rgb; float a = 0.0;
  if (mode == 0) {            // HEX dome — the Shield Tank's armor field
    vec2 uv = vec2(ang * vR.x * 1.1, yN * vR.y * 1.9 - t * 0.25);
    float e = hexEdge(uv * 1.6);
    float sweep = smoothstep(0.85, 1.0, sin(ang * 1.0 - t * 1.6) * 0.5 + 0.5);
    a = e * (0.35 + 0.65 * sweep) + fr * 0.55 + ex * (0.35 + e);
    a *= smoothstep(1.0, 0.75, yN) * 0.6 + 0.4;
    col = mix(col, vec3(1.0), e * 0.25 + ex * 0.3);
  } else if (mode == 1) {     // BUBBLE — the Shield Drone's anti-missile field
    float ir = sin(fr * 9.0 + t * 2.0 + ang * 2.0) * 0.5 + 0.5;
    col = mix(col, vec3(0.75, 0.45, 1.0), ir * 0.55);
    float ripple = smoothstep(0.7, 1.0, sin(yN * 30.0 - t * 3.0 + sin(ang * 4.0 + t) * 1.5));
    float cells = hexEdge(vec2(ang * vR.x * 1.4, yN * vR.y * 2.4) * 1.8) * 0.18;
    a = pow(fr, 1.4) * 1.1 + ripple * 0.08 + cells * fr + ex * (0.25 + fr);
    col = mix(col, vec3(1.0), ex * 0.5 + pow(fr, 4.0) * 0.3);
  } else if (mode == 2) {     // FROST crust on a frozen tower
    float c1 = n2(vec2(ang * 4.0, vP.y * 7.0)), c2 = n2(vec2(ang * 11.0 + 3.0, vP.y * 15.0));
    float facets = smoothstep(0.45, 0.75, c1) * 0.6 + smoothstep(0.6, 0.9, c2) * 0.6;
    float sparkle = step(0.985, h21(floor(vec2(ang * 30.0, vP.y * 40.0)) + floor(t * 6.0)));
    a = 0.04 + facets * 0.28 + pow(fr, 1.5) * 0.5 + sparkle;
    col = mix(vec3(0.25, 0.55, 0.9), vec3(0.75, 0.92, 1.0), facets * 0.6 + pow(fr, 3.0) * 0.4);
    col = mix(col, vec3(1.0), sparkle);
    a *= smoothstep(1.0, 0.7, yN);
  } else if (mode == 3) {     // ELECTRIC crackle on a stunned tower
    float flick = step(0.35, h21(vec2(floor(t * 24.0), 1.0)));
    float arcs = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float w = sin(ang * (3.0 + fi) + vP.y * (9.0 + fi * 4.0) + t * (17.0 + fi * 5.0) + n2(vec2(vP.y * 6.0, t * 8.0 + fi)) * 4.0);
      arcs += smoothstep(0.93, 1.0, abs(w));
    }
    a = arcs * (0.6 + 0.4 * flick) + fr * 0.3;
    col = mix(col, vec3(1.0), arcs * 0.5);
  } else {                    // COLUMN — the soul light of a resurrection
    float s = fract(yN * 3.0 - t * 2.2 + h21(vec2(floor(ang * 8.0), 0.0)));
    float streak = smoothstep(0.0, 0.15, s) * smoothstep(0.6, 0.15, s);
    float core = pow(1.0 - fr, 3.0);
    a = (0.45 + streak * 1.0 + fr * 0.7 + core * 0.4) * pow(1.0 - yN, 0.7) * ex;
    col = mix(col * 1.2, vec3(1.0), streak * 0.3 + core * 0.25);
  }
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vCol.a);
}`;

const DECAL_VS = `
attribute vec4 iXf; attribute vec4 iMd; attribute vec4 iCol;
varying vec2 vP; varying vec4 vMd; varying vec4 vCol; varying float vR;
void main() {
  vP = position.xz; vMd = iMd; vCol = iCol; vR = iXf.z;
  vec3 w = vec3(iXf.x + position.x * iXf.z, 0.05 + iXf.w, iXf.y + position.z * iXf.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

// iMd: x = mode, y = time, z = extra
const DECAL_FS = `
varying vec2 vP; varying vec4 vMd; varying vec4 vCol; varying float vR;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ring(float d, float at, float w) { return 1.0 - smoothstep(0.0, w, abs(d - at)); }
void main() {
  int mode = int(vMd.x + 0.5); float t = vMd.y, ex = vMd.z;
  float d = length(vP); float ang = atan(vP.y, vP.x);
  vec3 col = vCol.rgb; float a = 0.0; float w = 0.06 / max(vR, 0.2);
  if (d > 1.0) discard;
  if (mode == 0) {            // PUDDLE: wobbling rim, ripples, glints
    float rim = 0.86 + 0.08 * sin(ang * 5.0 + t * 2.0) + 0.04 * sin(ang * 11.0 - t * 3.0);
    if (d > rim) discard;
    float rip = sin(d * 26.0 - t * 5.0) * 0.5 + 0.5;
    float glint = step(0.97, h21(floor(vP * 9.0) + floor(t * 3.0)));
    a = 0.5 + rip * 0.2 + smoothstep(rim - 0.08, rim, d) * 0.35 + glint * 0.5;
    col = mix(col * 0.75, vec3(0.85, 0.95, 1.0), rip * 0.25 + glint + smoothstep(rim - 0.06, rim, d) * 0.5);
    a *= ex;
  } else if (mode == 1) {     // NOVA: expanding frost ring with crystal spikes
    float at = ex;
    float spikes = 0.5 + 0.5 * step(0.5, fract(ang * 6.0 / 3.14159 + 0.25));
    a = ring(d, at, 0.06 + 0.05 * spikes) * (1.0 - ex) * 1.4 + (1.0 - smoothstep(0.0, at, d)) * 0.25 * (1.0 - ex);
    col = mix(col, vec3(1.0), 0.4);
  } else if (mode == 2) {     // MINE: dark disc, a red eye that blinks once armed
    float body = 1.0 - smoothstep(0.78, 0.84, d);
    float eye = 1.0 - smoothstep(0.18, 0.26, d);
    float blink = ex > 0.5 ? step(0.0, sin(t * 9.0)) : 0.25;
    col = mix(vec3(0.08, 0.08, 0.09), col, eye * blink);
    col += ring(d, 0.62, 0.05) * 0.12;
    a = max(body * 0.92, eye * blink);
  } else if (mode == 3) {     // SHOCK: a thin bright ring racing out
    a = ring(d, ex, 0.07) * (1.0 - ex) * 1.5;
    col = mix(col, vec3(1.0), 0.3);
  } else if (mode == 4) {     // CLOAK field: a shimmering broken ring and heat-haze bands
    float dash = step(0.5, fract(ang * 18.0 / 6.2831 + t * 0.2));
    float haze = sin(d * 18.0 + t * 3.0 + sin(ang * 3.0 + t) * 2.0) * 0.5 + 0.5;
    float sweep = smoothstep(0.9, 1.0, sin(ang - t * 2.0) * 0.5 + 0.5);
    a = ring(d, 0.97, 0.045) * (0.55 + 0.45 * dash) + ring(d, 0.9, 0.02) * 0.35 + haze * 0.12 * smoothstep(1.0, 0.4, d) + sweep * smoothstep(0.3, 1.0, d) * 0.35;
    col = mix(col * vec3(0.75, 0.7, 1.0), vec3(1.0), sweep * 0.3);
  } else if (mode == 5) {     // HEX ring: the Shield Tank's ground circle, ticks turning
    float ticks = step(0.75, fract(ang * 24.0 / 6.2831 - t * 0.15));
    a = ring(d, 0.98, 0.025) + ring(d, 0.92, 0.012) * 0.6 + ticks * ring(d, 0.95, 0.03) * 0.8 + ex * 0.25 * smoothstep(0.6, 1.0, d);
  } else {                    // SIGIL: the raise's rune circle, turning
    float r1 = ring(d, 0.95, 0.035), r2 = ring(d, 0.72, 0.025);
    float spokes = (1.0 - smoothstep(0.0, 0.05, abs(sin(ang * 3.0 + t * 1.5)))) * step(0.72, d) * step(d, 0.95);
    float runes = step(0.6, h21(vec2(floor((ang + t * 0.6) * 4.0), 3.0))) * ring(d, 0.835, 0.04);
    float core = (1.0 - smoothstep(0.0, 0.45, d)) * (0.4 + 0.3 * sin(t * 6.0));
    a = (r1 + r2 + spokes + runes * 0.8 + core) * ex;
    col = mix(col, vec3(1.0), core * 0.3);
  }
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vCol.a);
}`;

const SPRITE_VS = `
attribute vec4 iPos; attribute vec4 iCol; attribute float iShape;
varying vec2 vUv; varying vec4 vCol; varying float vShape;
void main() {
  vUv = position.xy * 2.0; vCol = iCol; vShape = iShape;
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  mv.xy += position.xy * iPos.w;
  gl_Position = projectionMatrix * mv;
}`;

const SPRITE_FS = `
varying vec2 vUv; varying vec4 vCol; varying float vShape;
void main() {
  float d = length(vUv); float a;
  if (vShape < 0.5) a = exp(-d * d * 4.0) * 1.2;
  else if (vShape < 1.5) { vec2 q = abs(vUv); a = (1.0 - smoothstep(0.55, 1.0, q.x + q.y * 0.55)) + exp(-d * d * 12.0); }
  else a = (1.0 - smoothstep(0.0, 0.18, abs(d - 0.7))) * 0.9;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol.rgb * a, a * vCol.a);
}`;

export function createAbilityFxView(THREE, scene, { shellCap = 128, decalCap = 256, spriteCap = 3000 } = {}) {
  const owned = [];
  function instanced(base, cap, attrs, vs, fs, opts) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    for (const k of Object.keys(base.attributes)) geo.setAttribute(k, base.attributes[k]);
    const bufs = {};
    for (const [name, size] of Object.entries(attrs)) { bufs[name] = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size); bufs[name].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, bufs[name]); }
    const mat = new THREE.ShaderMaterial(Object.assign({ vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false }, opts));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    owned.push(geo, base, mat);
    return { mesh, geo, bufs, cap };
  }
  const shells = instanced(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), shellCap,
    { iXf: 4, iMd: 4, iCol: 4 }, SHELL_VS, SHELL_FS, { blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  shells.mesh.renderOrder = 9; shells.mesh.name = 'abilityShells';
  const decals = instanced(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), decalCap,
    { iXf: 4, iMd: 4, iCol: 4 }, DECAL_VS, DECAL_FS, { blending: THREE.NormalBlending });
  decals.mesh.renderOrder = 7; decals.mesh.name = 'abilityDecals';
  const sprites = instanced(new THREE.PlaneGeometry(1, 1), spriteCap,
    { iPos: 4, iCol: 4, iShape: 1 }, SPRITE_VS, SPRITE_FS, { blending: THREE.AdditiveBlending });
  sprites.mesh.renderOrder = 10; sprites.mesh.name = 'abilitySprites';

  function fill(target, list, write) {
    const n = Math.min(target.cap, list.length);
    for (let i = 0; i < n; i++) write(list[i], i);
    for (const b of Object.values(target.bufs)) b.needsUpdate = true;
    target.geo.instanceCount = n;
    target.mesh.visible = n > 0;
    return n;
  }
  return {
    meshes: [shells.mesh, decals.mesh, sprites.mesh],
    /** Draw this frame's model output. Returns { shells, decals, sprites } counts. */
    sync(o) {
      const S = shells.bufs, D = decals.bufs, P = sprites.bufs;
      const ns = fill(shells, o.shells, (s, i) => { S.iXf.array.set([s.x, s.y, s.z, s.r], i * 4); S.iMd.array.set([s.ry, s.mode, s.t, s.extra || 0], i * 4); S.iCol.array.set([s.col[0], s.col[1], s.col[2], s.alpha], i * 4); });
      const nd = fill(decals, o.decals, (d, i) => { D.iXf.array.set([d.x, d.z, d.r, d.mode === 2 ? 0.02 : (d.mode === 0 ? 0.01 : 0.03)], i * 4); D.iMd.array.set([d.mode, d.t, d.extra || 0, 0], i * 4); D.iCol.array.set([d.col[0], d.col[1], d.col[2], d.alpha], i * 4); });
      const np = fill(sprites, o.sprites, (p, i) => { P.iPos.array.set([p.x, p.y, p.z, p.size], i * 4); P.iCol.array.set([p.col[0], p.col[1], p.col[2], p.alpha], i * 4); P.iShape.array[i] = p.shape || 0; });
      return { shells: ns, decals: nd, sprites: np };
    },
    dispose() { for (const m of [shells.mesh, decals.mesh, sprites.mesh]) scene.remove(m); for (const o of owned) o.dispose(); },
  };
}
