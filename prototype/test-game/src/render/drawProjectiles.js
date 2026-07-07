// src/render/drawProjectiles.js
// Draws projectiles / muzzle flashes / impact FX as primitives.
// READ-ONLY over sim state: never mutates world. Presentation-only FX state
// (muzzle/impact timers) is kept locally, keyed by deterministic sim event ids,
// so it never affects the replay / determinism.

import { PIXI } from '../render/renderer.js';

/**
 * drawProjectiles
 * Reads combat state from world (projectiles + recent events) and renders:
 *  - traveling projectiles (ballistic lob vs hitscan beam) matching weapon class
 *  - muzzle flashes at firing origins
 *  - impact effects keyed to damage type
 *
 * All FX are pure functions of sim state + wall-clock-ish accumulated dt used
 * ONLY for visual fade. We derive that dt from world.time (sim clock) so it
 * stays deterministic given the same log.
 */

// ---- damage-type color table (mirrors config/damageTypes) -------------------
const DAMAGE_COLORS = {
  Kinetic: 0xffe08a,
  Fire: 0xff5a1e,
  Poison: 0x7cff4a,
  Concussion: 0xcfd6e0,
  Electric: 0x66d9ff,
  Frost: 0x9fe4ff,
};

const DEFAULT_COLOR = 0xffffff;

function dtColor(type) {
  return DAMAGE_COLORS[type] || DEFAULT_COLOR;
}

// Weapon "class" heuristics from unit/structure data.
// Ballistic (arc/lob) vs hitscan (beam). Artillery/AoE => lob, Electric => beam.
function isBeam(p) {
  if (!p) return false;
  if (p.beam === true) return true;
  if (p.weaponClass === 'beam' || p.weaponClass === 'hitscan') return true;
  if (p.damageType === 'Electric') return true;
  return false;
}

function isLob(p) {
  if (!p) return false;
  if (p.lob === true) return true;
  if (p.weaponClass === 'ballistic' || p.weaponClass === 'lob') return true;
  if ((p.aoe || p.aoeR || 0) >= 2) return true;
  if (p.damageType === 'Concussion') return true;
  return false;
}

export function createProjectileDrawer(layers) {
  // layers.projectiles : ground-level projectiles + ground FX
  // layers.fx          : muzzle/impact FX (front)
  const projLayer = (layers && (layers.projectiles || layers.fx)) || null;
  const fxLayer = (layers && (layers.fx || layers.projectiles)) || null;

  const g = new PIXI.Graphics();
  const gfx = new PIXI.Graphics();
  if (projLayer) projLayer.addChild(g);
  if (fxLayer) fxLayer.addChild(gfx);

  // Local presentation FX pools keyed by event id so a given event only
  // spawns one FX instance regardless of how many frames it lingers in
  // the world's recent-events buffer.
  const muzzles = new Map(); // id -> {x,y,color,born,dur}
  const impacts = new Map(); // id -> {x,y,color,born,dur,radius}

  let lastSimTime = 0;

  function project(world, x, y, altitude) {
    // Optional camera/geometry projection hook. If world provides a projector,
    // use it; otherwise identity (top-down primitives).
    if (world && world.project) return world.project(x, y, altitude || 0);
    // simple altitude lift for flyers
    const alt = altitude || 0;
    return { x, y: y - alt * 6 };
  }

  function ingestEvents(world, now) {
    const events = (world && (world.events || (world.log && world.log.events))) || null;
    if (!events || !events.length) return;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e || e.id == null) continue;
      if (e.type === 'fire' || e.type === 'muzzle') {
        if (!muzzles.has(e.id)) {
          const pos = project(world, e.x, e.y, e.altitude);
          muzzles.set(e.id, {
            x: pos.x,
            y: pos.y,
            color: dtColor(e.damageType),
            born: now,
            dur: 0.12,
          });
        }
      } else if (e.type === 'impact' || e.type === 'hit' || e.type === 'kill') {
        if (!impacts.has(e.id)) {
          const pos = project(world, e.x, e.y, e.altitude);
          impacts.set(e.id, {
            x: pos.x,
            y: pos.y,
            color: dtColor(e.damageType),
            born: now,
            dur: e.type === 'kill' ? 0.35 : 0.22,
            radius: Math.max(4, (e.aoe || e.aoeR || 0) * 8 + 6),
            kill: e.type === 'kill',
          });
        }
      }
    }
  }

  function drawProjectile(p, world) {
    const from = project(world, p.x, p.y, p.altitude);
    const color = dtColor(p.damageType);

    if (isBeam(p)) {
      // hitscan beam: draw a line from origin to target
      const ox = p.ox != null ? p.ox : p.originX;
      const oy = p.oy != null ? p.oy : p.originY;
      let start = from;
      if (ox != null && oy != null) {
        start = project(world, ox, oy, p.originAltitude);
      }
      g.lineStyle(2.5, color, 0.9);
      g.moveTo(start.x, start.y);
      g.lineTo(from.x, from.y);
      g.lineStyle(0);
      // glowing head
      g.beginFill(color, 0.9);
      g.drawCircle(from.x, from.y, 3);
      g.endFill();
      return;
    }

    // traveling projectile body
    const r = isLob(p) ? 4 : 2.5;
    // lob: add a slight vertical arc based on progress (visual only)
    let px = from.x;
    let py = from.y;
    if (isLob(p) && p.progress != null) {
      const t = Math.max(0, Math.min(1, p.progress));
      const arc = Math.sin(t * Math.PI) * ((p.arcHeight || 16));
      py -= arc;
    }
    g.beginFill(color, 1);
    g.drawCircle(px, py, r);
    g.endFill();

    // tiny trailing tracer for kinetic-ish shots
    if (p.vx != null && p.vy != null) {
      const mag = Math.hypot(p.vx, p.vy) || 1;
      const tx = px - (p.vx / mag) * (r * 3);
      const ty = py - (p.vy / mag) * (r * 3);
      g.lineStyle(1.5, color, 0.4);
      g.moveTo(px, py);
      g.lineTo(tx, ty);
      g.lineStyle(0);
    }
  }

  function drawMuzzle(m, now) {
    const t = (now - m.born) / m.dur;
    if (t >= 1) return true; // expired
    const a = 1 - t;
    const rad = 4 + t * 6;
    gfx.beginFill(m.color, 0.85 * a);
    gfx.drawCircle(m.x, m.y, rad);
    gfx.endFill();
    // spark cross
    gfx.lineStyle(1.5, 0xffffff, 0.7 * a);
    gfx.moveTo(m.x - rad, m.y);
    gfx.lineTo(m.x + rad, m.y);
    gfx.moveTo(m.x, m.y - rad);
    gfx.lineTo(m.x, m.y + rad);
    gfx.lineStyle(0);
    return false;
  }

  function drawImpact(im, now) {
    const t = (now - im.born) / im.dur;
    if (t >= 1) return true; // expired
    const a = 1 - t;
    const rad = im.radius * (0.4 + t * 0.9);
    gfx.lineStyle(2, im.color, 0.8 * a);
    gfx.drawCircle(im.x, im.y, rad);
    gfx.lineStyle(0);
    gfx.beginFill(im.color, 0.35 * a);
    gfx.drawCircle(im.x, im.y, rad * 0.5);
    gfx.endFill();
    if (im.kill) {
      // debris flecks for a kill
      const n = 6;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const d = rad * (0.6 + 0.4 * t);
        gfx.beginFill(0xffffff, 0.5 * a);
        gfx.drawCircle(im.x + Math.cos(ang) * d, im.y + Math.sin(ang) * d, 1.5);
        gfx.endFill();
      }
    }
    return false;
  }

  function draw(world) {
    g.clear();
    gfx.clear();
    if (!world) return;

    const now = typeof world.time === 'number' ? world.time : lastSimTime;
    lastSimTime = now;

    // 1) capture new fire/impact events into local FX pools
    ingestEvents(world, now);

    // 2) draw active projectiles from sim state
    const projectiles = world.projectiles || (world.combat && world.combat.projectiles) || [];
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p || p.dead) continue;
      drawProjectile(p, world);
    }

    // 3) draw + age muzzle FX
    for (const [id, m] of muzzles) {
      if (drawMuzzle(m, now)) muzzles.delete(id);
    }

    // 4) draw + age impact FX
    for (const [id, im] of impacts) {
      if (drawImpact(im, now)) impacts.delete(id);
    }

    // Guard: prevent unbounded growth if events lack ids / time regresses
    if (muzzles.size > 512) muzzles.clear();
    if (impacts.size > 512) impacts.clear();
  }

  function destroy() {
    muzzles.clear();
    impacts.clear();
    if (g.parent) g.parent.removeChild(g);
    if (gfx.parent) gfx.parent.removeChild(gfx);
    g.destroy();
    gfx.destroy();
  }

  return { draw, destroy };
}

export default createProjectileDrawer;