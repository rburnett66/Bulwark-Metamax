package.json isn't listed; drawMap reads geometry from sim/geometry. Let me write the file.

```javascript
// src/render/drawMap.js
// Draws ground bands, water surface/sub-surface, base, hard-point slots.
// PRIMITIVES ONLY. Reads sim geometry/state; never mutates it.

const PALETTE = {
  sky: 0x1a2233,
  groundLow: 0x3a4a2a,
  groundMid: 0x4a5c34,
  groundHigh: 0x5c703f,
  groundEdge: 0x2b3720,
  waterSub: 0x123a55,
  waterSurface: 0x1f5c86,
  waterEdge: 0x0d2536,
  base: 0x6b6f8a,
  baseCore: 0x9aa0c8,
  baseDmg: 0xb04030,
  slotEmpty: 0x394055,
  slotRing: 0x8892b8,
  clearing: 0x554433,
  gridLine: 0x000000,
};

export class MapPainter {
  constructor() {
    this.PIXI = null;
    this.container = null;
    this._built = false;
    this._baseG = null;
    this._slotGs = [];
    this._geom = null;
    this._waterPhase = 0;
  }

  // called by renderer/layers
  attach(PIXI, container) {
    this.PIXI = PIXI;
    this.container = container;
    return this;
  }

  _rect(g, x, y, w, h, color, alpha = 1) {
    g.beginFill(color, alpha);
    g.drawRect(x, y, w, h);
    g.endFill();
  }

  _build(geom) {
    const PIXI = this.PIXI;
    this._geom = geom;

    // static background (sky/ground/water)
    const bg = new PIXI.Graphics();

    const B = geom.board || {};
    const W = B.width || geom.width || 960;
    const H = B.height || geom.height || 600;

    // Sky
    this._rect(bg, 0, 0, W, H, PALETTE.sky);

    // Water lane (sub-surface tint then surface)
    const water = geom.waterLane || geom.water;
    if (water) {
      const wx = water.x, wy = water.y, ww = water.width, wh = water.height;
      // sub-surface
      this._rect(bg, wx, wy, ww, wh, PALETTE.waterSub);
      // surface (slightly inset, lighter)
      this._rect(bg, wx, wy, ww, wh, PALETTE.waterSurface, 0.55);
      // edges
      bg.lineStyle(2, PALETTE.waterEdge, 0.8);
      bg.drawRect(wx, wy, ww, wh);
      bg.lineStyle(0);
    }

    // Ground lane drawn as low/mid/high bands
    const ground = geom.groundLane || geom.ground;
    if (ground) {
      const gx = ground.x, gy = ground.y, gw = ground.width, gh = ground.height;
      // Determine band orientation by longer axis
      if (gw >= gh) {
        const bandH = gh / 3;
        this._rect(bg, gx, gy, gw, bandH, PALETTE.groundHigh);
        this._rect(bg, gx, gy + bandH, gw, bandH, PALETTE.groundMid);
        this._rect(bg, gx, gy + 2 * bandH, gw, bandH, PALETTE.groundLow);
      } else {
        const bandW = gw / 3;
        this._rect(bg, gx, gy, bandW, gh, PALETTE.groundHigh);
        this._rect(bg, gx + bandW, gy, bandW, gh, PALETTE.groundMid);
        this._rect(bg, gx + 2 * bandW, gy, bandW, gh, PALETTE.groundLow);
      }
      bg.lineStyle(2, PALETTE.groundEdge, 0.9);
      bg.drawRect(gx, gy, gw, gh);
      bg.lineStyle(0);
    }

    // Clearing at base end
    const clearing = geom.clearing || geom.baseArea;
    if (clearing) {
      this._rect(bg, clearing.x, clearing.y, clearing.width, clearing.height, PALETTE.clearing, 0.8);
    }

    // Optional tile grid overlay for readability
    if (geom.grid && geom.tileSize) {
      const ts = geom.tileSize;
      bg.lineStyle(1, PALETTE.gridLine, 0.08);
      for (let x = 0; x <= W; x += ts) {
        bg.moveTo(x, 0);
        bg.lineTo(x, H);
      }
      for (let y = 0; y <= H; y += ts) {
        bg.moveTo(0, y);
        bg.lineTo(W, y);
      }
      bg.lineStyle(0);
    }

    this.container.addChild(bg);
    this._bg = bg;

    // Base graphic (dynamic — HP coloring)
    this._baseG = new PIXI.Graphics();
    this.container.addChild(this._baseG);

    // Slots (dynamic — occupied state)
    this._slotGs = [];
    const slots = geom.slots || [];
    for (let i = 0; i < slots.length; i++) {
      const sg = new PIXI.Graphics();
      this.container.addChild(sg);
      this._slotGs.push(sg);
    }

    // Water animation overlay
    this._waterOverlay = new PIXI.Graphics();
    this.container.addChild(this._waterOverlay);

    this._built = true;
  }

  _drawBase(world, geom) {
    const g = this._baseG;
    g.clear();
    const base = (world && world.base) || geom.base;
    if (!base) return;
    const bx = base.x != null ? base.x : (geom.base && geom.base.x);
    const by = base.y != null ? base.y : (geom.base && geom.base.y);
    const r = base.radius || (geom.base && geom.base.radius) || 40;

    const maxHp = base.maxHp || base.hpMax || 1000;
    const hp = base.hp != null ? base.hp : maxHp;
    const frac = Math.max(0, Math.min(1, hp / maxHp));

    // Color shifts toward damage red as HP drops
    const dmg = 1 - frac;
    const col = lerpColor(PALETTE.base, PALETTE.baseDmg, dmg);

    g.beginFill(col, 1);
    g.drawRect(bx - r, by - r, r * 2, r * 2);
    g.endFill();

    // Core
    g.beginFill(PALETTE.baseCore, 0.9);
    g.drawRect(bx - r * 0.45, by - r * 0.45, r * 0.9, r * 0.9);
    g.endFill();

    // Border
    g.lineStyle(3, 0x000000, 0.6);
    g.drawRect(bx - r, by - r, r * 2, r * 2);
    g.lineStyle(0);

    // HP bar above base
    const bw = r * 2;
    const bh = 6;
    const bxx = bx - r;
    const byy = by - r - 12;
    g.beginFill(0x000000, 0.6);
    g.drawRect(bxx, byy, bw, bh);
    g.endFill();
    g.beginFill(frac > 0.33 ? 0x40c060 : 0xd04040, 1);
    g.drawRect(bxx, byy, bw * frac, bh);
    g.endFill();
  }

  _drawSlots(world, geom) {
    const slots = geom.slots || [];
    const structures = (world && world.structures) || [];
    // Determine occupied slot indices
    const occupied = new Set();
    for (const s of structures) {
      if (s == null) continue;
      if (s.slot != null) occupied.add(s.slot);
      if (s.slotIndex != null) occupied.add(s.slotIndex);
    }

    // base level may gate available slots
    const baseLevel = (world && world.base && world.base.level) || 1;
    const activeCount = slots.length;

    for (let i = 0; i < slots.length; i++) {
      const g = this._slotGs[i];
      if (!g) continue;
      g.clear();
      if (i >= activeCount) continue;
      const s = slots[i];
      const sx = s.x, sy = s.y;
      const r = s.radius || (geom.slotRadius) || 14;

      const isOcc = occupied.has(i) || occupied.has(s.id);
      // available if base level allows (simple: all listed slots active)
      const available = (s.minBaseLevel == null) || baseLevel >= s.minBaseLevel;

      if (isOcc) {
        // occupied slots handled by drawStructures; show faint anchor
        g.lineStyle(1, PALETTE.slotRing, 0.15);
        g.drawCircle(sx, sy, r);
        g.lineStyle(0);
        continue;
      }

      // empty available slot
      const alpha = available ? 0.5 : 0.15;
      g.beginFill(PALETTE.slotEmpty, available ? 0.35 : 0.12);
      g.drawCircle(sx, sy, r);
      g.endFill();
      g.lineStyle(2, PALETTE.slotRing, alpha);
      g.drawCircle(sx, sy, r);
      // small cross to mark hard-point
      g.moveTo(sx - r * 0.4, sy);
      g.lineTo(sx + r * 0.4, sy);
      g.moveTo(sx, sy - r * 0.4);
      g.lineTo(sx, sy + r * 0.4);
      g.lineStyle(0);
    }
  }

  _animateWater(dt, geom) {
    const g = this._waterOverlay;
    if (!g) return;
    const water = geom.waterLane || geom.water;
    if (!water) return;
    this._waterPhase += dt * 0.6;
    g.clear();
    const wx = water.x, wy = water.y, ww = water.width, wh = water.height;
    // moving highlight bands to sell "surface"
    const bands = 5;
    g.lineStyle(0);
    for (let b = 0; b < bands; b++) {
      const t = ((this._waterPhase * 0.15) + b / bands) % 1;
      const yy = wy + t * wh;
      g.beginFill(0xbfe3ff, 0.06);
      g.drawRect(wx, yy, ww, Math.max(2, wh * 0.03));
      g.endFill();
    }
  }

  // Public draw entry — called each frame by renderer
  // world = strict sim state (read-only), geom = sim geometry
  draw(world, geom, dt = 0) {
    if (!this.PIXI || !this.container) return;
    const g = geom || (world && world.geometry) || (world && world.geom);
    if (!g) return;
    if (!this._built) {
      this._build(g);
    }
    this._drawBase(world, this._geom);
    this._drawSlots(world, this._geom);
    this._animateWater(dt, this._geom);
  }

  destroy() {
    if (this._bg) this._bg.destroy();
    if (this._baseG) this._baseG.destroy();
    for (const sg of this._slotGs) sg.destroy();
    if (this._waterOverlay) this._waterOverlay.destroy();
    this._built = false;
  }
}

function lerpColor(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gg << 8) | bl;
}

export function createMapPainter(PIXI, container) {
  return new MapPainter().attach(PIXI, container);
}

export default MapPainter;