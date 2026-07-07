// src/render/drawStructureState.js
// Render structure lifecycle states (ghost, building, damaged, aiming/firing, upgrade, selling).
// READS sim state; NEVER mutates it. Presentation only.

import { COLORS } from '../render/layers.js';

// Local palette fallbacks (self-contained; do not depend on external color constants)
const PAL = {
  ghostValid: 0x44ff88,
  ghostInvalid: 0xff4455,
  building: 0xd9a441,
  buildDust: 0xc9b48a,
  antiGround: 0x6fa8dc,
  antiAir: 0x9b6fdc,
  wall: 0x8a8f99,
  moat: 0x2e6fb5,
  complete: 0xbfe3ff,
  damageSmoke: 0x3a3a3a,
  destroyRubble: 0x554b40,
  aim: 0xffe066,
  fire: 0xfff2a8,
  muzzle: 0xffcf5e,
  upgrade: 0xffd700,
  sell: 0xffd700,
  hpBack: 0x330000,
  hpFront: 0x33dd55,
  hpMid: 0xdddd33,
  hpLow: 0xdd3333,
  rangeCircle: 0xffffff,
  selectRing: 0x66ccff,
};

// Structure kind -> base body color
function bodyColorFor(s) {
  if (s.terrain === 'moat' || s.kind === 'moat') return PAL.moat;
  if (s.terrain === 'wall' || s.kind === 'wall') return PAL.wall;
  if (s.canTargetAir || s.weaponDomains && s.weaponDomains.includes && s.weaponDomains.includes('Air')) return PAL.antiAir;
  return PAL.antiGround;
}

function halfFootprint(s) {
  const t = (s.tileSize || 32);
  const fw = (s.footprint && s.footprint.w) || 1;
  const fh = (s.footprint && s.footprint.h) || 1;
  return { hw: (fw * t) / 2, hh: (fh * t) / 2 };
}

function tierScale(tier) {
  if (tier >= 3) return 1.35;
  if (tier === 2) return 1.18;
  return 1.0;
}

// Draw HP bar above a structure
function drawHpBar(g, s, cx, cy, hh) {
  const maxHp = s.maxHp || s.hpMax || s.hp || 1;
  const hp = Math.max(0, s.hp || 0);
  if (maxHp <= 0) return;
  const frac = Math.min(1, hp / maxHp);
  const w = Math.max(24, hh * 2 * 0.9);
  const h = 4;
  const bx = cx - w / 2;
  const by = cy - hh - 12;
  g.beginFill(PAL.hpBack, 0.85);
  g.drawRect(bx, by, w, h);
  g.endFill();
  let col = PAL.hpFront;
  if (frac < 0.33) col = PAL.hpLow;
  else if (frac < 0.66) col = PAL.hpMid;
  g.beginFill(col, 1);
  g.drawRect(bx, by, w * frac, h);
  g.endFill();
}

// Draw the range circle (dashed) — used for aiming towers and selection
function drawRangeCircle(g, cx, cy, radiusPx, color, alpha) {
  const segs = 48;
  const step = (Math.PI * 2) / segs;
  g.lineStyle(1.5, color, alpha);
  for (let i = 0; i < segs; i += 2) {
    const a0 = i * step;
    const a1 = (i + 1) * step;
    g.moveTo(cx + Math.cos(a0) * radiusPx, cy + Math.sin(a0) * radiusPx);
    g.lineTo(cx + Math.cos(a1) * radiusPx, cy + Math.sin(a1) * radiusPx);
  }
  g.lineStyle(0);
}

/**
 * drawStructureState
 * @param {PIXI.Graphics} g - graphics object to draw into (structures layer)
 * @param {object} s - structure entity (strict sim state, read-only)
 * @param {object} opts - { toScreen(x,y)->{x,y}, tileSize, time, selectedId, pxPerTile }
 */
export function drawStructureState(g, s, opts = {}) {
  const toScreen = opts.toScreen || ((x, y) => ({ x, y }));
  const tileSize = opts.tileSize || s.tileSize || 32;
  const pxPerTile = opts.pxPerTile || tileSize;
  const time = opts.time || 0;
  const p = toScreen(s.x, s.y);
  const cx = p.x;
  const cy = p.y;

  s.tileSize = tileSize;
  const { hw, hh } = halfFootprint(s);
  const state = s.lcState || s.state || 'Complete';
  const tier = s.tier || 1;
  const scale = tierScale(tier);
  const bw = hw * 2 * scale;
  const bh = hh * 2 * scale;
  const isTerrain = s.terrain === 'wall' || s.terrain === 'moat' || s.kind === 'wall' || s.kind === 'moat';

  // ---- GHOST / PLACING ----
  if (state === 'Placing' || s.ghost) {
    const valid = s.valid !== false;
    const col = valid ? PAL.ghostValid : PAL.ghostInvalid;
    g.lineStyle(2, col, 0.9);
    g.beginFill(col, 0.25);
    g.drawRect(cx - bw / 2, cy - bh / 2, bw, bh);
    g.endFill();
    g.lineStyle(0);
    // range preview for weapon structures
    if (!isTerrain && s.range) {
      drawRangeCircle(g, cx, cy, s.range * pxPerTile, col, 0.4);
    }
    return;
  }

  // ---- DESTROYED ----
  if (state === 'Destroyed') {
    // rubble decal: scattered dark quads
    g.beginFill(PAL.destroyRubble, 0.8);
    const rng = seededPositions(s.id, 5);
    for (let i = 0; i < rng.length; i++) {
      const rx = cx + (rng[i].x - 0.5) * bw;
      const ry = cy + (rng[i].y - 0.5) * bh;
      const sz = 3 + rng[i].s * 5;
      g.drawRect(rx - sz / 2, ry - sz / 2, sz, sz);
    }
    g.endFill();
    return;
  }

  // Base body color
  let bodyCol = bodyColorFor(s);

  // ---- SELLING ----
  if (state === 'Selling') {
    const t = clamp01((s.sellProgress != null) ? s.sellProgress : 0.5);
    // shrink + gold puff
    const sw = bw * (1 - t);
    const sh = bh * (1 - t);
    g.beginFill(bodyCol, 1 - t * 0.7);
    g.drawRect(cx - sw / 2, cy - sh / 2, sw, sh);
    g.endFill();
    // gold pickup puff
    g.beginFill(PAL.sell, 0.5 * (1 - t));
    g.drawCircle(cx, cy - t * 20, 6 + t * 10);
    g.endFill();
    return;
  }

  // ---- BUILDING / UPGRADING ----
  if (state === 'Building' || state === 'Upgrading') {
    const prog = clamp01(
      state === 'Building'
        ? (s.buildProgress != null ? s.buildProgress : ((s.buildTimer != null && s.buildTime) ? (1 - s.buildTimer / s.buildTime) : 0.5))
        : (s.upgradeProgress != null ? s.upgradeProgress : ((s.upgradeTimer != null && s.upgradeTime) ? (1 - s.upgradeTimer / s.upgradeTime) : 0.5))
    );
    // translucent frame
    g.lineStyle(2, PAL.building, 0.9);
    g.drawRect(cx - bw / 2, cy - bh / 2, bw, bh);
    g.lineStyle(0);
    // rising fill from bottom
    const fillH = bh * prog;
    g.beginFill(bodyCol, 0.55);
    g.drawRect(cx - bw / 2, cy + bh / 2 - fillH, bw, fillH);
    g.endFill();
    // construction dust puffs
    const dustPhase = (time * 2) % 1;
    for (let i = 0; i < 3; i++) {
      const dx = cx + ((i - 1) * bw * 0.3);
      const dy = cy + bh / 2 - (dustPhase + i * 0.3) % 1 * (bh * 0.8);
      g.beginFill(PAL.buildDust, 0.3);
      g.drawCircle(dx, dy, 3 + ((i + dustPhase) % 1) * 4);
      g.endFill();
    }
    drawHpBar(g, s, cx, cy, bh / 2);
    return;
  }

  // ---- COMPLETE / DAMAGED / AIMING / FIRING ----
  // Draw body
  g.beginFill(bodyCol, 1);
  if (isTerrain && (s.terrain === 'moat' || s.kind === 'moat')) {
    // moat drawn as darker recessed rect
    g.drawRect(cx - bw / 2, cy - bh / 2, bw, bh);
    g.endFill();
    g.beginFill(0x1a4a80, 0.6);
    g.drawRect(cx - bw / 2 + 3, cy - bh / 2 + 3, bw - 6, bh - 6);
    g.endFill();
  } else {
    g.drawRect(cx - bw / 2, cy - bh / 2, bw, bh);
    g.endFill();
    // tier pips (top edge)
    for (let i = 0; i < tier; i++) {
      g.beginFill(0xffffff, 0.85);
      g.drawRect(cx - bw / 2 + 3 + i * 6, cy - bh / 2 + 2, 4, 3);
      g.endFill();
    }
  }

  // Weapon barrel pointing at target (for weapon structures)
  if (!isTerrain && (state === 'Aiming' || state === 'Firing' || state === 'Complete' || state === 'Damaged')) {
    let ang = s.turretAngle;
    if (ang == null && s.target && s.target.x != null) {
      const tp = toScreen(s.target.x, s.target.y);
      ang = Math.atan2(tp.y - cy, tp.x - cx);
    }
    if (ang == null) ang = 0;
    const barrelLen = Math.max(bw, bh) * 0.55;
    g.lineStyle(4, 0x222222, 1);
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang) * barrelLen, cy + Math.sin(ang) * barrelLen);
    g.lineStyle(0);

    // Firing FX: muzzle flash at barrel tip
    if (state === 'Firing') {
      const mx = cx + Math.cos(ang) * barrelLen;
      const my = cy + Math.sin(ang) * barrelLen;
      g.beginFill(PAL.muzzle, 0.9);
      g.drawCircle(mx, my, 5 + Math.sin(time * 40) * 2);
      g.endFill();
      g.beginFill(PAL.fire, 0.5);
      g.drawCircle(mx, my, 9);
      g.endFill();
    }
    // Aiming: lock-on windup ring
    if (state === 'Aiming') {
      g.lineStyle(2, PAL.aim, 0.7);
      g.drawCircle(cx, cy, Math.max(bw, bh) * 0.6);
      g.lineStyle(0);
    }
  }

  // ---- DAMAGED smoke ----
  if (state === 'Damaged') {
    const maxHp = s.maxHp || s.hpMax || 1;
    const dmgFrac = 1 - clamp01((s.hp || 0) / maxHp);
    const puffs = 1 + Math.floor(dmgFrac * 3);
    for (let i = 0; i < puffs; i++) {
      const ph = (time * 1.2 + i * 0.4) % 1;
      const sx = cx + ((i - puffs / 2) * bw * 0.25);
      const sy = cy - bh / 2 - ph * 18;
      g.beginFill(PAL.damageSmoke, 0.35 * (1 - ph));
      g.drawCircle(sx, sy, 3 + ph * 6 * dmgFrac + 2);
      g.endFill();
    }
    // crack lines
    g.lineStyle(1, 0x000000, 0.5);
    g.moveTo(cx - bw / 4, cy - bh / 4);
    g.lineTo(cx + bw / 6, cy + bh / 6);
    g.lineStyle(0);
  }

  // HP bar for all live structures
  drawHpBar(g, s, cx, cy, bh / 2);

  // Selection: dashed range circle + ring
  if (opts.selectedId != null && s.id === opts.selectedId) {
    g.lineStyle(2, PAL.selectRing, 0.9);
    g.drawRect(cx - bw / 2 - 3, cy - bh / 2 - 3, bw + 6, bh + 6);
    g.lineStyle(0);
    if (!isTerrain && s.range) {
      drawRangeCircle(g, cx, cy, s.range * pxPerTile, PAL.rangeCircle, 0.6);
    }
  }
}

// ---- helpers ----
function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// deterministic pseudo-random positions keyed by id, for rubble
function seededPositions(id, n) {
  let seed = 2166136261 >>> 0;
  const str = String(id == null ? 'x' : id);
  for (let i = 0; i < str.length; i++) {
    seed ^= str.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const a = (seed >>> 0) / 4294967296;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const b = (seed >>> 0) / 4294967296;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const c = (seed >>> 0) / 4294967296;
    out.push({ x: a, y: b, s: c });
  }
  return out;
}

export default drawStructureState;