// src/render/renderer.js
// Read-only Pixi primitives view for BULWARK vertical slice.
// Draws lanes/water tint bands, base, slot markers, units by domain,
// towers with tier pips + dashed range circle, walls, projectiles,
// hp bars, placement ghost with valid/invalid tint, and walker path lines.

import { TABLES } from '../data/tables.js';

const COLORS = {
  sky: 0x101820,
  ground: 0x3a5a2a,
  groundBandLow: 0x33502a,
  groundBandHigh: 0x476a33,
  water: 0x1f4e79,
  waterSub: 0x163a5c,
  baseClearing: 0x5a5340,
  base: 0xd6b84a,
  baseOutline: 0x8a742a,
  slot: 0x9aa0a6,
  slotFill: 0x2a2f33,
  walker: 0xe05a3a,
  floater: 0x3ac0e0,
  flyer: 0xe0d43a,
  flyerShadow: 0x000000,
  towerAG: 0x4a90d9,
  towerAA: 0x9a5ad9,
  wall: 0x8a8a8a,
  moat: 0x2a6ea0,
  projectile: 0xffe08a,
  hpBack: 0x330000,
  hpFront: 0x33dd33,
  hpMid: 0xdddd33,
  hpLow: 0xdd3333,
  ghostValid: 0x33ff66,
  ghostInvalid: 0xff3344,
  pathLine: 0xffffff,
  rangeCircle: 0xffffff,
  building: 0xcccc44,
  upgrading: 0x44ccff,
  selling: 0xffaa33,
  tierPip: 0xffffff,
};

function structColor(s) {
  if (s.kind === 'wall') return COLORS.wall;
  if (s.kind === 'moat') return COLORS.moat;
  if (s.canTargetAir) return COLORS.towerAA;
  return COLORS.towerAG;
}

export class Renderer {
  constructor(app, sim) {
    this.app = app;
    this.sim = sim;
    this.tile = 32;

    this.root = new PIXI.Container();
    app.stage.addChild(this.root);

    // Layers back -> front
    this.terrainLayer = new PIXI.Graphics();     // lanes, water, clearing, slots
    this.pathLayer = new PIXI.Graphics();        // walker path lines
    this.shadowLayer = new PIXI.Graphics();      // flyer shadows
    this.structLayer = new PIXI.Graphics();      // walls, towers, base
    this.unitLayer = new PIXI.Graphics();        // units
    this.projLayer = new PIXI.Graphics();        // projectiles
    this.fxLayer = new PIXI.Graphics();          // range circles, hp bars
    this.ghostLayer = new PIXI.Graphics();       // placement ghost

    this.root.addChild(
      this.terrainLayer,
      this.pathLayer,
      this.shadowLayer,
      this.structLayer,
      this.unitLayer,
      this.projLayer,
      this.fxLayer,
      this.ghostLayer
    );

    this._terrainDirtyKey = null;
    this._layout(sim ? sim.state : null);
  }

  _layout(state) {
    const grid = state && state.grid ? state.grid : { cols: 24, rows: 14 };
    const cols = grid.cols || grid.width || 24;
    const rows = grid.rows || grid.height || 14;
    const availW = this.app.renderer.width;
    const availH = this.app.renderer.height;
    this.tile = Math.max(8, Math.floor(Math.min(availW / cols, availH / rows)));
    this.cols = cols;
    this.rows = rows;
    this.root.x = Math.floor((availW - cols * this.tile) / 2);
    this.root.y = Math.floor((availH - rows * this.tile) / 2);
  }

  // Convert tile coords (possibly fractional) to pixel center
  tx(x) { return (x + 0.5) * this.tile; }
  ty(y) { return (y + 0.5) * this.tile; }

  // Pixel -> tile coord, used by input
  screenToTile(px, py) {
    return {
      x: Math.floor((px - this.root.x) / this.tile),
      y: Math.floor((py - this.root.y) / this.tile),
    };
  }

  // ---------------------------------------------------------------
  render(state, view) {
    // view: { ghost: {x,y,footprint,valid,range} | null, selectedId, interp }
    if (!state) return;
    view = view || {};

    if (this.cols !== (state.grid.cols || state.grid.width) ||
        this.rows !== (state.grid.rows || state.grid.height)) {
      this._layout(state);
      this._terrainDirtyKey = null;
    }

    this._drawTerrain(state);
    this._drawPaths(state);
    this._drawStructures(state, view.selectedId);
    this._drawUnits(state);
    this._drawProjectiles(state);
    this._drawGhost(state, view.ghost);
  }

  // ---------------------------------------------------------------
  _drawTerrain(state) {
    const grid = state.grid;
    // Terrain only changes when walls/moats change; key on structure count + grid rev.
    const key = (grid.rev || 0) + ':' + (state.structures ? state.structures.length : 0) + ':' + this.tile;
    if (key === this._terrainDirtyKey) return;
    this._terrainDirtyKey = key;

    const g = this.terrainLayer;
    const t = this.tile;
    g.clear();

    // Background ground
    g.beginFill(COLORS.ground);
    g.drawRect(0, 0, this.cols * t, this.rows * t);
    g.endFill();

    // Per-tile bands
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tt = grid.tileAt ? grid.tileAt(x, y) : (grid.tiles ? grid.tiles[y * this.cols + x] : 'ground');
        if (tt === 'water') {
          // sub-surface tint then surface
          g.beginFill(COLORS.waterSub);
          g.drawRect(x * t, y * t, t, t);
          g.endFill();
          g.beginFill(COLORS.water, 0.75);
          g.drawRect(x * t, y * t + t * 0.15, t, t * 0.7);
          g.endFill();
        } else if (tt === 'clearing' || tt === 'base') {
          g.beginFill(COLORS.baseClearing);
          g.drawRect(x * t, y * t, t, t);
          g.endFill();
        } else if (tt === 'ground') {
          // subtle low/high banding by row for read
          const band = y % 3;
          if (band === 0) {
            g.beginFill(COLORS.groundBandLow, 0.5);
            g.drawRect(x * t, y * t, t, t);
            g.endFill();
          } else if (band === 2) {
            g.beginFill(COLORS.groundBandHigh, 0.35);
            g.drawRect(x * t, y * t, t, t);
            g.endFill();
          }
        }
      }
    }

    // Grid faint lines
    g.lineStyle(1, 0x000000, 0.08);
    for (let x = 0; x <= this.cols; x++) {
      g.moveTo(x * t, 0); g.lineTo(x * t, this.rows * t);
    }
    for (let y = 0; y <= this.rows; y++) {
      g.moveTo(0, y * t); g.lineTo(this.cols * t, y * t);
    }
    g.lineStyle(0);

    // Slot markers
    const slots = (grid.slots || []);
    for (const s of slots) {
      g.beginFill(COLORS.slotFill, 0.6);
      g.lineStyle(1.5, COLORS.slot, 0.9);
      g.drawRect(s.x * t + 3, s.y * t + 3, t - 6, t - 6);
      g.endFill();
      g.lineStyle(0);
      // small diamond in center
      const cx = this.tx(s.x), cy = this.ty(s.y);
      g.beginFill(COLORS.slot, 0.5);
      g.moveTo(cx, cy - 4);
      g.lineTo(cx + 4, cy);
      g.lineTo(cx, cy + 4);
      g.lineTo(cx - 4, cy);
      g.closePath();
      g.endFill();
    }
  }

  // ---------------------------------------------------------------
  _drawPaths(state) {
    const g = this.pathLayer;
    g.clear();
    const units = state.units || [];
    for (const u of units) {
      if (!u.alive || u.domain !== 'walker') continue;
      const path = u.path;
      if (!path || path.length < 2) continue;
      g.lineStyle(1.5, COLORS.pathLine, 0.22);
      let started = false;
      const startIdx = Math.max(0, u.pathIndex != null ? u.pathIndex : 0);
      for (let i = startIdx; i < path.length; i++) {
        const p = path[i];
        const px = this.tx(p.x), py = this.ty(p.y);
        if (!started) {
          g.moveTo(this.tx(u.x), this.ty(u.y));
          started = true;
        }
        g.lineTo(px, py);
      }
      g.lineStyle(0);
    }
  }

  // ---------------------------------------------------------------
  _drawStructures(state, selectedId) {
    const g = this.structLayer;
    const fx = this.fxLayer;
    const t = this.tile;
    g.clear();
    fx.clear();

    // Base
    const base = state.base;
    if (base) {
      const bx = this.tx(base.x), by = this.ty(base.y);
      const r = t * 0.9;
      g.beginFill(COLORS.base);
      g.lineStyle(2, COLORS.baseOutline, 1);
      g.drawRect(bx - r / 2, by - r / 2, r, r);
      g.endFill();
      // inner keep
      g.beginFill(COLORS.baseOutline);
      g.drawRect(bx - r / 4, by - r / 4, r / 2, r / 2);
      g.endFill();
      g.lineStyle(0);
      this._hpBar(fx, bx, by - r / 2 - 8, t * 1.2, base.hp, base.maxHp);
    }

    const structures = state.structures || [];
    for (const s of structures) {
      if (s.state === 'Destroyed') {
        // rubble decal
        g.beginFill(0x444444, 0.6);
        g.drawCircle(this.tx(s.x), this.ty(s.y), t * 0.25);
        g.endFill();
        continue;
      }
      const cx = this.tx(s.x), cy = this.ty(s.y);
      const isWall = s.kind === 'wall' || s.kind === 'moat';
      const col = structColor(s);
      const half = t * (isWall ? 0.46 : 0.38);

      let alpha = 1;
      if (s.state === 'Building' || s.state === 'Placing') alpha = 0.55;
      if (s.state === 'Selling') alpha = 0.45;

      if (isWall) {
        g.beginFill(col, alpha);
        g.lineStyle(1, 0x000000, 0.4 * alpha);
        g.drawRect(cx - half, cy - half, half * 2, half * 2);
        g.endFill();
        if (s.kind === 'wall') {
          // brick lines
          g.lineStyle(1, 0x555555, 0.6 * alpha);
          g.moveTo(cx - half, cy); g.lineTo(cx + half, cy);
          g.moveTo(cx, cy - half); g.lineTo(cx, cy);
          g.moveTo(cx - half / 2, cy); g.lineTo(cx - half / 2, cy + half);
          g.moveTo(cx + half / 2, cy); g.lineTo(cx + half / 2, cy + half);
        } else {
          // moat ripple
          g.lineStyle(1, 0x9ad0ff, 0.5 * alpha);
          g.moveTo(cx - half * 0.6, cy - 3);
          g.lineTo(cx, cy);
          g.lineTo(cx + half * 0.6, cy - 3);
        }
        g.lineStyle(0);
      } else {
        // Tower: square base + circle turret
        g.beginFill(0x22262a, alpha);
        g.drawRect(cx - half, cy - half, half * 2, half * 2);
        g.endFill();
        g.beginFill(col, alpha);
        g.lineStyle(1.5, 0x000000, 0.4 * alpha);
        g.drawCircle(cx, cy, half * 0.75);
        g.endFill();
        g.lineStyle(0);

        // Barrel toward target
        let ang = -Math.PI / 2;
        if (s.targetId != null) {
          const tgt = (state.units || []).find(u => u.id === s.targetId && u.alive);
          if (tgt) ang = Math.atan2(this.ty(tgt.y) - cy, this.tx(tgt.x) - cx);
        }
        g.lineStyle(3, 0x111111, alpha);
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(ang) * half, cy + Math.sin(ang) * half);
        g.lineStyle(0);

        // Anti-air marker: small triangle on top
        if (s.canTargetAir) {
          g.beginFill(0xffffff, 0.85 * alpha);
          g.moveTo(cx, cy - half * 0.4);
          g.lineTo(cx + 4, cy + 2);
          g.lineTo(cx - 4, cy + 2);
          g.closePath();
          g.endFill();
        }
      }

      // Tier pips
      const tier = s.tier || 1;
      for (let i = 0; i < tier; i++) {
        g.beginFill(COLORS.tierPip, alpha);
        g.drawCircle(cx - half + 4 + i * 7, cy + half - 4, 2.2);
        g.endFill();
      }

      // Build / upgrade / sell progress bar
      if (s.state === 'Building' || s.state === 'Upgrading' || s.state === 'Selling') {
        const prog = Math.max(0, Math.min(1, s.progress != null ? s.progress : 0));
        const w = t * 0.8;
        const barCol = s.state === 'Building' ? COLORS.building :
                       s.state === 'Upgrading' ? COLORS.upgrading : COLORS.selling;
        fx.beginFill(0x000000, 0.6);
        fx.drawRect(cx - w / 2, cy + half + 3, w, 4);
        fx.endFill();
        fx.beginFill(barCol, 0.95);
        fx.drawRect(cx - w / 2, cy + half + 3, w * prog, 4);
        fx.endFill();
      }

      // HP bar (when damaged or building)
      if (s.hp < s.maxHp || s.state === 'Damaged') {
        this._hpBar(fx, cx, cy - half - 6, t * 0.8, s.hp, s.maxHp);
      }

      // Repair job indicator: small plus
      if (s.repairing) {
        fx.lineStyle(2, 0x66ff88, 0.9);
        fx.moveTo(cx + half - 4, cy - half + 1); fx.lineTo(cx + half - 4, cy - half + 9);
        fx.moveTo(cx + half - 8, cy - half + 5); fx.lineTo(cx + half, cy - half + 5);
        fx.lineStyle(0);
      }

      // Selected: dashed range circle
      if (selectedId != null && s.id === selectedId && s.range > 0) {
        this._dashedCircle(fx, cx, cy, s.range * t, COLORS.rangeCircle, 0.7);
        // selection box
        fx.lineStyle(1.5, 0xffffff, 0.9);
        fx.drawRect(cx - half - 3, cy - half - 3, (half + 3) * 2, (half + 3) * 2);
        fx.lineStyle(0);
      }
    }
  }

  // ---------------------------------------------------------------
  _drawUnits(state) {
    const g = this.unitLayer;
    const sh = this.shadowLayer;
    const fx = this.fxLayer;
    const t = this.tile;
    g.clear();
    sh.clear();

    const units = (state.units || []).slice().sort((a, b) => a.y - b.y);

    for (const u of units) {
      if (!u.alive) continue;
      const cx = this.tx(u.x), cy = this.ty(u.y);
      const size = t * 0.32;
      const friendly = u.team === 'player' || u.side === 'player';
      const outline = friendly ? 0x66ff99 : 0x000000;

      if (u.domain === 'walker') {
        // soft ground shadow
        sh.beginFill(0x000000, 0.25);
        sh.drawEllipse(cx + 2, cy + size * 0.9, size * 0.9, size * 0.35);
        sh.endFill();
        // rectangle body
        g.beginFill(friendly ? 0x55cc77 : COLORS.walker);
        g.lineStyle(1, outline, 0.7);
        g.drawRect(cx - size, cy - size, size * 2, size * 2);
        g.endFill();
        g.lineStyle(0);
        // heavy variants: inner square
        if (u.shape === 'Heavy Tanks' || u.shape === 'Tanks') {
          g.beginFill(0x000000, 0.3);
          g.drawRect(cx - size * 0.5, cy - size * 0.5, size, size);
          g.endFill();
        }
        if (u.targetsStructures || u.targets === 'Structures') {
          // artillery marker: barrel line
          g.lineStyle(2, 0x222222, 0.9);
          g.moveTo(cx, cy);
          g.lineTo(cx + size * 1.4, cy - size * 1.4);
          g.lineStyle(0);
        }
      } else if (u.domain === 'floater') {
        // submerged tint under
        sh.beginFill(COLORS.waterSub, 0.5);
        sh.drawEllipse(cx, cy + 3, size * 1.1, size * 0.5);
        sh.endFill();
        // circle body
        g.beginFill(friendly ? 0x55ccdd : COLORS.floater);
        g.lineStyle(1, outline, 0.7);
        g.drawCircle(cx, cy, size);
        g.endFill();
        g.lineStyle(0);
        // wake ripple
        sh.lineStyle(1, 0xbfe6ff, 0.4);
        sh.moveTo(cx - size * 1.4, cy + size * 0.6);
        sh.lineTo(cx - size * 0.4, cy + size * 0.6);
        sh.lineStyle(0);
      } else { // flyer
        const alt = u.altitude != null ? u.altitude : 1;
        const off = 6 + alt * 6;
        // dim offset shadow conveying altitude
        sh.beginFill(COLORS.flyerShadow, Math.max(0.08, 0.28 - alt * 0.08));
        sh.drawEllipse(cx + off, cy + off, size * 0.9, size * 0.4);
        sh.endFill();
        // triangle-ish flyer (diamond)
        g.beginFill(friendly ? 0xddee55 : COLORS.flyer);
        g.lineStyle(1, outline, 0.7);
        g.moveTo(cx, cy - size * 1.2);
        g.lineTo(cx + size, cy + size * 0.7);
        g.lineTo(cx - size, cy + size * 0.7);
        g.closePath();
        g.endFill();
        g.lineStyle(0);
        // rotor dot
        g.beginFill(0x000000, 0.5);
        g.drawCircle(cx, cy - size * 0.2, 2);
        g.endFill();
      }

      // hp bar when damaged
      if (u.hp < u.maxHp) {
        this._hpBar(fx, cx, cy - size - 7, t * 0.7, u.hp, u.maxHp);
      }

      // vision flag: hidden units drawn faint (renderer just reads flag)
      if (u.visible === false) {
        g.beginFill(0x000000, 0.0); g.endFill();
      }
    }
  }

  // ---------------------------------------------------------------
  _drawProjectiles(state) {
    const g = this.projLayer;
    g.clear();
    const t = this.tile;
    const projs = state.projectiles || [];
    for (const p of projs) {
      if (p.dead) continue;
      const cx = this.tx(p.x), cy = this.ty(p.y);
      g.beginFill(COLORS.projectile);
      g.drawCircle(cx, cy, Math.max(2, t * 0.08));
      g.endFill();
      // short motion trail
      if (p.vx != null || p.dx != null) {
        const dx = p.vx != null ? p.vx : p.dx || 0;
        const dy = p.vy != null ? p.vy : p.dy || 0;
        const len = Math.hypot(dx, dy) || 1;
        g.lineStyle(1.5, COLORS.projectile, 0.4);
        g.moveTo(cx, cy);
        g.lineTo(cx - (dx / len) * t * 0.3, cy - (dy / len) * t * 0.3);
        g.lineStyle(0);
      }
    }

    // impact flashes (transient events surfaced in state)
    const fxEvents = state.fx || [];
    for (const e of fxEvents) {
      if (e.type === 'impact') {
        g.lineStyle(2, 0xffaa44, 0.7);
        g.drawCircle(this.tx(e.x), this.ty(e.y), t * 0.2 * (1 + (e.age || 0)));
        g.lineStyle(0);
      } else if (e.type === 'muzzle') {
        g.beginFill(0xffffcc, 0.8);
        g.drawCircle(this.tx(e.x), this.ty(e.y), 3);
        g.endFill();
      } else if (e.type === 'coin') {
        g.beginFill(0xffd700, 0.9);
        g.drawCircle(this.tx(e.x), this.ty(e.y) - (e.age || 0) * 10, 3);
        g.endFill();
      }
    }
  }

  // ---------------------------------------------------------------
  _drawGhost(state, ghost) {
    const g = this.ghostLayer;
    g.clear();
    if (!ghost) return;
    const t = this.tile;
    const col = ghost.valid ? COLORS.ghostValid : COLORS.ghostInvalid;
    const fw = (ghost.footprint && ghost.footprint.w) || 1;
    const fh = (ghost.footprint && ghost.footprint.h) || 1;

    g.beginFill(col, 0.3);
    g.lineStyle(2, col, 0.85);
    g.drawRect(ghost.x * t, ghost.y * t, fw * t, fh * t);
    g.endFill();
    g.lineStyle(0);

    // Range preview for towers
    if (ghost.range && ghost.range > 0) {
      const cx = (ghost.x + fw / 2) * t;
      const cy = (ghost.y + fh / 2) * t;
      this._dashedCircle(g, cx, cy, ghost.range * t, col, 0.5);
    }

    // March line for troop deploy: base -> drop destination
    if (ghost.deploy && state.base) {
      const bx = this.tx(state.base.x), by = this.ty(state.base.y);
      const dx = (ghost.x + 0.5) * t, dy = (ghost.y + 0.5) * t;
      this._dashedLine(g, bx, by, dx, dy, col, 0.7);
    }
  }

  // ---------------------------------------------------------------
  _hpBar(g, cx, topY, width, hp, maxHp) {
    const frac = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
    const col = frac > 0.6 ? COLORS.hpFront : frac > 0.3 ? COLORS.hpMid : COLORS.hpLow;
    g.beginFill(COLORS.hpBack, 0.8);
    g.drawRect(cx - width / 2, topY, width, 3.5);
    g.endFill();
    g.beginFill(col, 0.95);
    g.drawRect(cx - width / 2, topY, width * frac, 3.5);
    g.endFill();
  }

  _dashedCircle(g, cx, cy, radius, color, alpha) {
    const circumference = 2 * Math.PI * radius;
    const dashLen = 8, gapLen = 6;
    const steps = Math.max(12, Math.floor(circumference / (dashLen + gapLen)));
    g.lineStyle(1.5, color, alpha);
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = a0 + (dashLen / circumference) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
      // subdivide arc into 2 segments for smoothness
      const mid = (a0 + a1) / 2;
      g.lineTo(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius);
      g.lineTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius);
    }
    g.lineStyle(0);
  }

  _dashedLine(g, x0, y0, x1, y1, color, alpha) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const dashLen = 7, gapLen = 5;
    const nx = dx / dist, ny = dy / dist;
    g.lineStyle(1.5, color, alpha);
    let d = 0;
    while (d < dist) {
      const end = Math.min(d + dashLen, dist);
      g.moveTo(x0 + nx * d, y0 + ny * d);
      g.lineTo(x0 + nx * end, y0 + ny * end);
      d = end + gapLen;
    }
    g.lineStyle(0);
  }

  resize() {
    if (this.sim && this.sim.state) {
      this._layout(this.sim.state);
      this._terrainDirtyKey = null;
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

export function createRenderer(app, sim) {
  return new Renderer(app, sim);
}

export default Renderer;