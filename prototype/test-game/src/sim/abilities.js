/**
 * src/sim/abilities.js — SPECIAL ABILITIES, one per faction [MM-story_mvn06wnv_7].
 *
 * Owner 2026-10-24: "I want to create a special ability unit for each faction." Every number lives in
 * tables.ABILITIES; a carrier unit row names its ability with `ability: '<id>'` and createUnit copies it
 * onto the entity. Spec: docs/16 Bulwark MM/design/Special-Abilities-Design.md.
 *
 * stepAbilities runs once per tick, after movement/structures and before combat, so the per-tick flags it
 * sets (cloaked, abilityArmor, shieldedBy, a tower's stunnedUntil, a unit's disruptedUntil) are what
 * combat reads that same tick. Enemy waves only: only side 'attacker' carriers act.
 *
 * Deterministic: tick counters only, entities visited in Map (insertion = ascending id) order, nearest-first
 * with the lowest id breaking ties. No Math.random, no Date.now.
 */

import { ABILITIES, getStructureDef, getUnitDef } from '../data/tables.js';
import { createUnit } from './entities.js';
import { applyDamage } from './combat.js';
import { emitEvent } from './core.js';

const ticks = (sec, dt) => Math.max(1, Math.round(sec / dt));
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const isFlyer = (u) => u.domain === 'Flyer';
const live = (u) => u && u.hp > 0;

/** Carrier tier scale for the `perTier` numbers: the unit's own hp ratio (1 / 1.6 / 2.4). */
function tierMult(u) {
  try { const def = getUnitDef(u.unitId); return def.hp[(u.tier || 1) - 1] / def.hp[0]; } catch (e) { return 1; }
}

/** A tower that shoots and is up: what Freeze Missile and Stun Drones go for. */
function isLiveTower(s) {
  if (!(s.hp > 0) || (s.lifecycle !== 'Complete' && s.lifecycle !== 'Damaged')) return false;
  let def; try { def = getStructureDef(s.structId); } catch (e) { return false; }
  return Array.isArray(def.dps) ? def.dps.some((v) => v > 0) : def.dps > 0;
}

function nearestTower(state, pos, range, skip) {
  let best = null, bd = range * range + 1e-9;
  for (const s of state.structures.values()) {
    if (!isLiveTower(s) || (skip && skip(s))) continue;
    const dd = d2(pos, s.pos);
    if (dd < bd - 1e-9 || (best && Math.abs(dd - bd) <= 1e-9 && s.id < best.id)) { best = s; bd = dd; }
  }
  return best;
}

function nearestUnit(state, pos, range, pred) {
  let best = null, bd = range * range + 1e-9;
  for (const u of state.units.values()) {
    if (!live(u) || !pred(u)) continue;
    const dd = d2(pos, u.pos);
    if (dd < bd - 1e-9) { best = u; bd = dd; }
  }
  return best;
}

function nearestNode(state, pos, range, pred) {
  let best = null, bd = range * range + 1e-9;
  for (const n of state.resourceNodes || []) {
    if (!(n.remaining > 0) || (pred && !pred(n))) continue;
    const dd = d2(pos, n);
    if (dd < bd - 1e-9) { best = n; bd = dd; }
  }
  return best;
}

const fxQueue = (state) => state.abilityFx || (state.abilityFx = []);
const abilityEvent = (state, kind, extra) => emitEvent(state, Object.assign({ type: 'ability', kind, tick: state.tick }, extra));

/** Is a tower knocked out (Freeze Missile / Stun Drones) this tick? combat.js reads this. */
export function towerStunned(state, s) {
  return !!(s && s.stunnedUntil && state.tick < s.stunnedUntil);
}

/** Is a unit stuck in a Water Blob puddle or frozen this tick? movement/harvest/repair/combat read this. */
export function unitDisrupted(state, u) {
  return !!(u && u.disruptedUntil && state.tick < u.disruptedUntil);
}

/** A raise still waiting to land keeps the wave open (waves.js clear check). */
export function raisesPending(state) {
  return !!(state.abilityFx && state.abilityFx.some((f) => f.kind === 'raise'));
}

/** Can a unit of this domain stand at `p`? Walkers need a passable nav cell (no water, rock or tree). */
function standable(state, u, p) {
  if (u.domain !== 'Walker') return true;
  const g = state.navGrid;
  if (!g) return true;
  const x = Math.round(p.x), y = Math.round(p.y);
  return x >= 0 && y >= 0 && x < g.cols && y < g.rows && !!g.passable[y * g.cols + x];
}

/** Point `dist` cells further along a unit's path (or toward the base when it has none); its own spot if that
 *  point is somewhere it could not stand. */
function aheadOnPath(state, u, dist) {
  const here = { x: u.pos.x, y: u.pos.y };
  const wp = (u.path && u.pathIdx < u.path.length) ? u.path[u.pathIdx] : (state.base && state.base.pos);
  if (!wp) return here;
  const dx = wp.x - u.pos.x, dy = wp.y - u.pos.y, L = Math.hypot(dx, dy);
  if (L < 1e-6) return here;
  const k = Math.min(dist, L) / L;
  const p = { x: u.pos.x + dx * k, y: u.pos.y + dy * k };
  return standable(state, u, p) ? p : here;
}

function spawnCopy(state, src, pos, tweak) {
  const u = createUnit(state, src.unitId, src.tier || 1, pos, src.lane, 'attacker');
  u.path = (src.path || []).slice();
  u.pathIdx = src.pathIdx || 0;
  if (src.routeIdx != null) u.routeIdx = src.routeIdx;
  // origin stays null: a mirror or a raised unit is not a wave spawn (no path line, no 'spawn' event — the
  // 'mirrorCast' / 'raised' ability events announce it)
  tweak(u);
  state.units.set(u.id, u);
  return u;
}

/**
 * DEATH HOOK — both death paths (combat.js and core.js cleanup) call this before removing a unit, so a
 * Dark Energy scout nearby can queue the raise. Mirrors, carriers, already-raised units and kamikaze drones
 * that blew themselves up are never raised.
 */
export function onUnitDeath(state, u) {
  if (!u || u.side !== 'attacker' || u.isMirror || u.raised || u.ability || u._detonated) return;
  const A = ABILITIES.resurrect;
  let best = null, bd = A.reach * A.reach + 1e-9;
  for (const c of state.units.values()) {
    if (c.ability !== 'resurrect' || !live(c) || c.side !== 'attacker' || (c.abilityUses || 0) >= A.maxRaises) continue;
    const dd = d2(c.pos, u.pos);
    if (dd < bd - 1e-9) { best = c; bd = dd; }
  }
  if (!best) return;
  best.abilityUses = (best.abilityUses || 0) + 1;
  const dt = state._abilityDt || (1 / 30);
  fxQueue(state).push({ kind: 'raise', at: state.tick + ticks(A.delay, dt), carrierId: best.id,
    src: { unitId: u.unitId, tier: u.tier, lane: u.lane, path: u.path, pathIdx: u.pathIdx, routeIdx: u.routeIdx, origin: u.origin, maxHp: u.maxHp },
    pos: { x: u.pos.x, y: u.pos.y } });
  abilityEvent(state, 'raiseStart', { carrierId: best.id, pos: { x: u.pos.x, y: u.pos.y } });
}

/* ---------------------------------------------------------------------------------------------------- */

/** An AURA scout (Stealth, Resurrected, Mirror Units) keeps pace with its column: it is faster than anything it escorts,
 *  and an aura that runs ahead of the units it should cover covers nothing. Slows to the slowest friendly unit of its
 *  own domain within ESCORT_REACH, back to its own speed when alone. */
const ESCORT_REACH = 5;
const PACED = new Set(['stealth', 'resurrect', 'mirrorUnits']);
function paceWithEscort(state, c) {
  if (c._baseSpeed == null) c._baseSpeed = c.speed;
  let slow = c._baseSpeed;
  const r2 = ESCORT_REACH * ESCORT_REACH;
  for (const u of state.units.values()) {
    if (u === c || !live(u) || u.side !== 'attacker' || u.isMirror || u.domain !== c.domain || d2(u.pos, c.pos) > r2) continue;
    if (u.speed > 0 && u.speed < slow) slow = u.speed;
  }
  c.speed = slow;
}

function runCarrier(state, c, dt) {
  const A = ABILITIES[c.ability];
  if (!A) return;
  if (PACED.has(c.ability)) paceWithEscort(state, c);
  const tick = state.tick;
  const ready = tick >= (c.abilityReady || 0);
  switch (c.ability) {
    case 'shieldTank': {
      const r2 = A.radius * A.radius;
      for (const u of state.units.values()) {
        if (!live(u) || u.side !== 'attacker' || isFlyer(u) || d2(u.pos, c.pos) > r2) continue;
        if (u.abilityArmor > A.damageMult) u.abilityArmor = A.damageMult;   // an aura: never stacks
      }
      break;
    }
    case 'stealth': {
      const r2 = A.radius * A.radius;
      for (const u of state.units.values()) {
        if (live(u) && u.side === 'attacker' && d2(u.pos, c.pos) <= r2) u.cloaked = true;
      }
      break;
    }
    case 'shieldDrone': {
      if (c.shieldPool == null) c.shieldPool = A.pool * tierMult(c);
      if (c.shieldPool <= 0) break;
      const r2 = A.radius * A.radius;
      for (const u of state.units.values()) {
        if (live(u) && u.side === 'attacker' && u.shieldedBy == null && d2(u.pos, c.pos) <= r2) u.shieldedBy = c.id;
      }
      break;
    }
    case 'freezeMissile': {
      if ((c.abilityUses || 0) >= A.uses) break;
      const t = nearestTower(state, c.pos, A.range);
      if (!t) break;
      c.abilityUses = (c.abilityUses || 0) + 1;
      const stun = A.stun + A.stunPerTier * ((c.tier || 1) - 1);
      fxQueue(state).push({ kind: 'freeze', at: tick + ticks(A.flight, dt), pos: { x: t.pos.x, y: t.pos.y }, radius: A.radius, dur: ticks(stun, dt) });
      abilityEvent(state, 'freezeLaunch', { carrierId: c.id, from: { x: c.pos.x, y: c.pos.y }, to: { x: t.pos.x, y: t.pos.y }, flight: A.flight });
      break;
    }
    case 'stunDrones': {
      if (!ready) break;
      const t = nearestTower(state, c.pos, A.range, (s) => towerStunned(state, s));
      if (!t) break;
      fxQueue(state).push({ kind: 'stunTower', at: tick + ticks(A.flight, dt), structId: t.id, dur: ticks(A.stun, dt) });
      c.abilityReady = tick + ticks(A.flight + A.stun + A.cooldown, dt);   // one tower at a time
      abilityEvent(state, 'stunDrone', { carrierId: c.id, targetId: t.id, from: { x: c.pos.x, y: c.pos.y }, to: { x: t.pos.x, y: t.pos.y }, flight: A.flight });
      break;
    }
    case 'mineLayer': {
      if (!ready || (c.abilityUses || 0) >= A.maxMines) break;
      const mines = state.enemyMines || (state.enemyMines = []);
      const sp2 = A.spacing * A.spacing;
      const n = nearestNode(state, c.pos, A.reach, (nd) => !mines.some((m) => d2(m.pos, nd) < sp2));
      if (!n) break;
      c.abilityUses = (c.abilityUses || 0) + 1;
      c.abilityReady = tick + ticks(A.cooldown, dt);
      state._mineSeq = (state._mineSeq || 0) + 1;
      const m = { id: state._mineSeq, pos: { x: n.x, y: n.y }, armAt: tick + ticks(A.armDelay, dt), expiresAt: tick + ticks(A.life, dt),
        burst: A.burst * tierMult(c), radius: A.burstRadius, trigger: A.trigger, damageType: A.damageType };
      mines.push(m);
      abilityEvent(state, 'minePlaced', { carrierId: c.id, mineId: m.id, pos: { x: m.pos.x, y: m.pos.y } });
      break;
    }
    case 'waterBlobs': {
      if (!ready) break;
      const tu = nearestUnit(state, c.pos, A.range, (u) => u.side === 'defender');
      const at = tu ? { x: tu.pos.x, y: tu.pos.y } : (() => { const n = nearestNode(state, c.pos, A.range); return n ? { x: n.x, y: n.y } : null; })();
      if (!at) break;
      c.abilityReady = tick + ticks(A.cooldown, dt);
      fxQueue(state).push({ kind: 'puddle', at: tick + ticks(A.flight, dt), pos: at, radius: A.radius, dur: ticks(A.duration, dt) });
      abilityEvent(state, 'blobLaunch', { carrierId: c.id, from: { x: c.pos.x, y: c.pos.y }, to: at, flight: A.flight });
      break;
    }
    case 'mirrorUnits': {
      if (!ready) break;
      let liveMirrors = 0;
      for (const u of state.units.values()) if (u.isMirror && live(u) && u.ownerId === c.id) liveMirrors++;
      if (liveMirrors >= A.maxLive) break;
      // the strongest friendly unit nearby (max hp, lowest id), the scout itself as the fallback
      let src = c;
      const r2 = A.reach * A.reach;
      for (const u of state.units.values()) {
        if (!live(u) || u.side !== 'attacker' || u.isMirror || d2(u.pos, c.pos) > r2) continue;
        if (u.maxHp > src.maxHp || (u.maxHp === src.maxHp && u.id < src.id)) src = u;
      }
      c.abilityReady = tick + ticks(A.cooldown, dt);
      const pos = aheadOnPath(state, src, A.ahead);
      const life = ticks(A.life, dt);
      const m = spawnCopy(state, src, pos, (u) => {
        u.hp = u.maxHp = src.maxHp * A.hpFrac;
        u.dps = 0; u.detonate = null; u.ability = null;
        u.isMirror = true; u.noBounty = true; u.mirrorOf = src.id; u.ownerId = c.id;
        u.expiresAt = tick + life;
      });
      abilityEvent(state, 'mirrorCast', { carrierId: c.id, mirrorId: m.id, sourceId: src.id, pos });
      break;
    }
    case 'resurrect':
      break;   // driven by onUnitDeath
    default:
      break;
  }
}

function runFx(state, f) {
  const tick = state.tick;
  if (f.kind === 'freeze') {
    const r2 = f.radius * f.radius;
    for (const s of state.structures.values()) {
      if (isLiveTower(s) && d2(s.pos, f.pos) <= r2) { s.stunnedUntil = Math.max(s.stunnedUntil || 0, tick + f.dur); s.targetId = null; }
    }
    for (const u of state.units.values()) {
      if (live(u) && u.side === 'defender' && d2(u.pos, f.pos) <= r2) u.disruptedUntil = Math.max(u.disruptedUntil || 0, tick + f.dur);
    }
    abilityEvent(state, 'freezeHit', { pos: f.pos, radius: f.radius, until: tick + f.dur });
  } else if (f.kind === 'stunTower') {
    const s = state.structures.get(f.structId);
    if (s && s.hp > 0) { s.stunnedUntil = Math.max(s.stunnedUntil || 0, tick + f.dur); s.targetId = null; }
    abilityEvent(state, 'towerStunned', { targetId: f.structId, until: tick + f.dur });
  } else if (f.kind === 'puddle') {
    (state.puddles || (state.puddles = [])).push({ pos: f.pos, radius: f.radius, until: tick + f.dur });
    abilityEvent(state, 'puddle', { pos: f.pos, radius: f.radius, until: tick + f.dur });
  } else if (f.kind === 'raise') {
    const c = state.units.get(f.carrierId);
    if (!live(c)) { abilityEvent(state, 'raiseCancelled', { pos: f.pos }); return; }   // the scout died first
    const A = ABILITIES.resurrect;
    const u = spawnCopy(state, f.src, f.pos, (x) => {
      x.hp = x.maxHp * A.hpFrac;
      x.raised = true; x.noBounty = true;
    });
    abilityEvent(state, 'raised', { carrierId: c.id, entityId: u.id, pos: f.pos });
  }
}

/**
 * One abilities tick. Call after movement/structures, before combat.
 * @param {object} state SimState
 * @param {number} dt tick duration in seconds
 */
export function stepAbilities(state, dt) {
  state._abilityDt = dt;
  const tick = state.tick;

  // per-tick aura flags start clean; carriers below set them again
  let mirrors = 0;
  for (const u of state.units.values()) {
    if (u.side !== 'attacker') continue;
    u.abilityArmor = 1; u.cloaked = false; u.shieldedBy = null;
    if (u.isMirror && u.hp > 0) {
      if (tick >= u.expiresAt) { u.hp = 0; u._faded = true; abilityEvent(state, 'mirrorFade', { entityId: u.id, pos: { x: u.pos.x, y: u.pos.y } }); }
      else mirrors++;
    }
  }
  state.mirrorCount = mirrors;

  for (const c of state.units.values()) {
    if (c.ability && c.side === 'attacker' && live(c)) runCarrier(state, c, dt);
  }

  // delayed effects: missiles, drones and blobs in flight; raises waiting to stand up
  if (state.abilityFx && state.abilityFx.length) {
    const due = [], keep = [];
    for (const f of state.abilityFx) (f.at <= tick ? due : keep).push(f);
    state.abilityFx = keep;
    for (const f of due) runFx(state, f);
  }

  // Water Blob puddles hold any defender unit standing in them
  if (state.puddles && state.puddles.length) {
    state.puddles = state.puddles.filter((p) => p.until > tick);
    for (const p of state.puddles) {
      const r2 = p.radius * p.radius;
      for (const u of state.units.values()) {
        if (live(u) && u.side === 'defender' && d2(u.pos, p.pos) <= r2) u.disruptedUntil = Math.max(u.disruptedUntil || 0, tick + 1);
      }
    }
  }

  // enemy mines on the resource fields: a defender ground unit that rolls over an armed one sets it off
  if (state.enemyMines && state.enemyMines.length) {
    const keep = [];
    for (const m of state.enemyMines) {
      if (tick >= m.expiresAt) { abilityEvent(state, 'mineFizzle', { mineId: m.id, pos: m.pos }); continue; }
      const armed = tick >= m.armAt;
      const t2 = m.trigger * m.trigger;
      const victim = armed && nearestUnit(state, m.pos, m.trigger, (u) => u.side === 'defender' && !isFlyer(u) && d2(u.pos, m.pos) <= t2);
      if (!victim) { keep.push(m); continue; }
      const r2 = m.radius * m.radius;
      for (const u of Array.from(state.units.values())) {
        if (live(u) && u.side === 'defender' && !isFlyer(u) && d2(u.pos, m.pos) <= r2) applyDamage(state, null, u, m.burst, m.damageType, 1);
      }
      abilityEvent(state, 'mineBlast', { mineId: m.id, pos: m.pos, radius: m.radius });
    }
    state.enemyMines = keep;
  }
}
