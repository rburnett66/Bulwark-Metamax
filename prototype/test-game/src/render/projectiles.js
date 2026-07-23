/**
 * src/render/projectiles.js — the Tier A projectile path (rendering-tiers spec §4).
 *
 * At 50–100 units, projectiles number in the hundreds and are the real bulk risk. Hard rules:
 *  - never a voxel object: each shot is a billboard dot + a screen-space streak sprite;
 *  - ONE batched draw call: every sprite shares one generated BaseTexture (dot + streak in a tiny
 *    atlas) and per-shot colour is sprite.tint — tint does not break Pixi's sprite batching;
 *  - pooled, zero per-frame allocation: shot records and their sprites are recycled through a
 *    free-list; steady-state flight allocates nothing (impact HANDOFF fires an event callback —
 *    impact FX are event-time, not per-frame).
 *
 * Needs global PIXI (v7). Pure Sprite path — RN-safe.
 */

const DOT_R = 8, STREAK_W = 48, STREAK_H = 6, PAD = 4;   // atlas cells (white → tinted per shot)

function buildAtlas() {
  const cv = document.createElement('canvas');
  cv.width = DOT_R * 2 + STREAK_W + PAD * 3; cv.height = Math.max(DOT_R * 2, STREAK_H) + PAD * 2;
  const g = cv.getContext('2d');
  // dot: soft-edged white disc
  const dx = PAD + DOT_R, dy = cv.height / 2;
  const rad = g.createRadialGradient(dx, dy, 1, dx, dy, DOT_R);
  rad.addColorStop(0, 'rgba(255,255,255,1)'); rad.addColorStop(0.7, 'rgba(255,255,255,0.95)'); rad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rad; g.beginPath(); g.arc(dx, dy, DOT_R, 0, 7); g.fill();
  // streak: white bar fading to the tail
  const sx = PAD * 2 + DOT_R * 2;
  const lin = g.createLinearGradient(sx, 0, sx + STREAK_W, 0);
  lin.addColorStop(0, 'rgba(255,255,255,0)'); lin.addColorStop(1, 'rgba(255,255,255,0.85)');
  g.fillStyle = lin; g.fillRect(sx, dy - STREAK_H / 2, STREAK_W, STREAK_H);
  const base = PIXI.BaseTexture.from(cv);
  base.scaleMode = PIXI.SCALE_MODES.LINEAR;
  return {
    dot: new PIXI.Texture(base, new PIXI.Rectangle(PAD, dy - DOT_R, DOT_R * 2, DOT_R * 2)),
    streak: new PIXI.Texture(base, new PIXI.Rectangle(sx, dy - STREAK_H / 2, STREAK_W, STREAK_H)),
  };
}

/** Create the pooled projectile layer. Add `pool.container` to a display layer once. */
export function createProjectilePool() {
  const tex = buildAtlas();
  const container = new PIXI.Container();
  const active = [];   // live shots (swap-pop on death — order doesn't matter visually)
  const free = [];     // recycled shot records with their sprites (visible=false)
  function alloc() {
    if (free.length) return free.pop();
    const dot = new PIXI.Sprite(tex.dot); dot.anchor.set(0.5);
    const streak = new PIXI.Sprite(tex.streak); streak.anchor.set(1, 0.5);   // tail behind the dot
    container.addChild(streak); container.addChild(dot);
    return { dot, streak, x: 0, y: 0, tx: 0, ty: 0, speed: 0, kind: '', size: 1, slen: 1, swid: 1 };
  }
  return {
    container,
    get count() { return active.length; },
    /** Launch a shot. Pure pool reuse — no allocation once the pool is warm.
     *  streakLen/streakWid: independent tail multipliers (authored per unit; default 1 = classic). */
    spawn(fromX, fromY, toX, toY, speed, color, kind, size, streakLen, streakWid) {
      const s = alloc();
      s.x = fromX; s.y = fromY; s.tx = toX; s.ty = toY; s.speed = speed; s.kind = kind || ''; s.size = size || 1;
      s.slen = streakLen || 1; s.swid = streakWid || 1;
      s.dot.tint = color; s.streak.tint = color;
      s.dot.visible = true; s.streak.visible = true;
      s.dot.scale.set(s.size);
      s.dot.position.set(fromX, fromY);
      active.push(s);
    },
    /** Advance every shot; onImpact(kind, x, y) fires as a shot arrives (event-time, may allocate FX). */
    update(dt, onImpact) {
      for (let i = active.length - 1; i >= 0; i--) {
        const s = active[i];
        const dx = s.tx - s.x, dy = s.ty - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = s.speed * dt;
        if (dist <= step || dist < 1e-6) {
          s.dot.visible = false; s.streak.visible = false;
          active[i] = active[active.length - 1]; active.pop(); free.push(s);
          if (onImpact) onImpact(s.kind, s.tx, s.ty);
          continue;
        }
        const nx = dx / dist, ny = dy / dist;
        s.x += nx * step; s.y += ny * step;
        s.dot.position.set(s.x, s.y);
        s.streak.position.set(s.x, s.y);
        s.streak.rotation = Math.atan2(ny, nx);
        s.streak.scale.set(s.size * 0.9 * s.slen, s.size * s.swid);   // length × width, independently authored
      }
    },
    /** Hide + recycle everything (map change / restart). */
    clear() {
      for (const s of active) { s.dot.visible = false; s.streak.visible = false; free.push(s); }
      active.length = 0;
    },
  };
}
