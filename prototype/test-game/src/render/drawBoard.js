rd = C:\Users\hottd\Documents\Metamax\Bulwark-Metamax/prototype/test-game

```javascript
import { CONSTANTS } from '../config/constants.js';

// drawBoard — primitive draw of ground bands, water surface/sub-surface tint,
// lanes, hard-point slots, and terrain (walls/moats).
//
// This module owns a couple of persistent Graphics objects and only redraws the
// static geometry when the underlying board signature changes. Terrain (which
// can change when walls/moats are placed/destroyed) is redrawn every frame it
// changes.

export class BoardPainter {
  constructor(layers) {
    this.layers = layers;

    // Static geometry: sky, water, ground bands, lanes, slots.
    this.gStatic = new PIXI.Graphics();
    // Terrain layer: walls/moats (these are structures that reroute walkers).
    this.gTerrain = new PIXI.Graphics();
    // Slot highlight overlay (drawn on ground bands so it sits under units).
    this.gSlots = new PIXI.Graphics();

    // Attach to appropriate containers.
    if (layers.sky) layers.sky.addChild(this.gStatic);
    if (layers.water) { /* static handles water fill above ground bands order */ }
    if (layers.groundBands) layers.groundBands.addChild(this.gSlots);
    if (layers.ground) layers.ground.addChild(this.gTerrain);

    this._staticSig = null;
    this._terrainSig = null;
  }

  // Palette (Ground / Powder faction — earthy/olive theme).
  static get PAL() {
    return {
      sky: 0x2b3a4a,
      waterSurface: 0x2f6f9e,
      waterSub: 0x143a55,
      groundLow: 0x4a5a34,
      groundMid: 0x586a3e,
      groundHigh: 0x687a4a,
      groundShadow: 0x38481f,
      lane: 0x7a6a44,
      laneEdge: 0x5a4c30,
      slotEmpty: 0x8a8a5a,
      slotFilled: 0x556b2f,
      wall: 0x8a8578,
      wallDamaged: 0x9a6a4a,
      moat: 0x1c4a68,
      moatDeep: 0x0f3450,
      clearing: 0x707a4c,
    };
  }

  _tile() {
    return CONSTANTS.TILE_SIZE || 32;
  }

  // Convert board tile coords to pixel coords using constants geometry.
  _px(tx, ty) {
    const t = this._tile();
    return { x: tx * t, y: ty * t };
  }

  draw(state) {
    if (!state || !state.board) return;
    this._drawStatic(state);
    this._drawTerrain(state);
    this._drawSlots(state);
  }

  _drawStatic(state) {
    const b = state.board;
    const sig = `${b.width}x${b.height}|${b.groundLane && b.groundLane.length}|${b.waterLane && b.waterLane.length}`;
    if (sig === this._staticSig) return;
    this._staticSig = sig;

    const P = BoardPainter.PAL;
    const t = this._tile();
    const g = this.gStatic;
    g.clear();

    const W = b.width * t;
    const H = b.height * t;

    // Sky backdrop.
    g.beginFill(P.sky);
    g.drawRect(0, 0, W, H);
    g.endFill();

    // Ground bands: split board vertically into low/mid/high bands.
    // Ground occupies the whole board; water lane is painted over it.
    const bandH = H / 3;
    g.beginFill(P.groundLow);
    g.drawRect(0, 0, W, bandH);
    g.endFill();
    g.beginFill(P.groundMid);
    g.drawRect(0, bandH, W, bandH);
    g.endFill();
    g.beginFill(P.groundHigh);
    g.drawRect(0, bandH * 2, W, H - bandH * 2);
    g.endFill();

    // Water lane: sub-surface tint then surface layer.
    if (b.waterLane && b.waterLane.length) {
      // Bounding region of water tiles.
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of b.waterLane) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
      }
      // Draw each water tile — sub-surface first, then surface with slight inset.
      for (const c of b.waterLane) {
        const p = this._px(c.x, c.y);
        g.beginFill(P.waterSub);
        g.drawRect(p.x, p.y, t, t);
        g.endFill();
        g.beginFill(P.waterSurface, 0.72);
        g.drawRect(p.x + 1, p.y + 1, t - 2, t - 2);
        g.endFill();
      }
    }

    // Ground lane path corridor.
    if (b.groundLane && b.groundLane.length) {
      for (const c of b.groundLane) {
        const p = this._px(c.x, c.y);
        g.lineStyle(1, P.laneEdge, 0.6);
        g.beginFill(P.lane, 0.5);
        g.drawRect(p.x + 2, p.y + 2, t - 4, t - 4);
        g.endFill();
        g.lineStyle(0);
      }
    }

    // Base clearing.
    if (state.base) {
      const bp = this._px(state.base.tx ?? state.base.x / t, state.base.ty ?? state.base.y / t);
      const cx = (state.base.x != null) ? state.base.x : bp.x;
      const cy = (state.base.y != null) ? state.base.y : bp.y;
      g.beginFill(P.clearing, 0.55);
      g.drawCircle(cx, cy, t * 2.2);
      g.endFill();
    }
  }

  _drawSlots(state) {
    const b = state.board;
    const slots = (state.slots) || (b && b.slots) || [];
    // Signature: count + occupancy string.
    const sig = slots.map(s => `${s.x},${s.y},${s.occupiedBy ? 1 : 0}`).join('|');
    if (sig === this._slotSig) return;
    this._slotSig = sig;

    const P = BoardPainter.PAL;
    const t = this._tile();
    const g = this.gSlots;
    g.clear();

    for (const s of slots) {
      const cx = (s.px != null) ? s.px : s.x;
      const cy = (s.py != null) ? s.py : s.y;
      const filled = !!s.occupiedBy;
      g.lineStyle(2, filled ? P.slotFilled : P.slotEmpty, 0.9);
      g.beginFill(filled ? P.slotFilled : P.slotEmpty, filled ? 0.15 : 0.08);
      g.drawRoundedRect(cx - t * 0.45, cy - t * 0.45, t * 0.9, t * 0.9, 4);
      g.endFill();
      g.lineStyle(0);
    }
  }

  _drawTerrain(state) {
    const b = state.board;
    // Collect terrain structures (walls/moats) from state entities.
    const terrain = [];
    const ents = state.entities || {};
    const collect = (arr) => {
      if (!arr) return;
      for (const e of arr) {
        if (e && (e.kind === 'wall' || e.kind === 'moat' || e.isTerrain)) terrain.push(e);
      }
    };
    if (Array.isArray(ents)) collect(ents);
    else {
      collect(ents.structures);
      collect(ents.terrain);
      collect(ents.walls);
      collect(ents.moats);
    }

    // Also allow board.terrain grid.
    const gridTerrain = (b && b.terrain) || null;

    const sig = terrain.map(e =>
      `${e.id || ''}:${e.kind}:${e.x},${e.y}:${e.hp}:${e.state || ''}`
    ).join('|') + '#' + (gridTerrain ? gridTerrain.length : 0);

    if (sig === this._terrainSig) return;
    this._terrainSig = sig;

    const P = BoardPainter.PAL;
    const t = this._tile();
    const g = this.gTerrain;
    g.clear();

    // Grid-based terrain (if present): array of {x,y,type}.
    if (gridTerrain) {
      for (const cell of gridTerrain) {
        if (!cell || !cell.type) continue;
        const p = this._px(cell.x, cell.y);
        if (cell.type === 'moat') {
          g.beginFill(P.moatDeep);
          g.drawRect(p.x, p.y, t, t);
          g.endFill();
          g.beginFill(P.moat, 0.6);
          g.drawRect(p.x + 2, p.y + 2, t - 4, t - 4);
          g.endFill();
        } else if (cell.type === 'wall') {
          g.beginFill(P.wall);
          g.drawRect(p.x + 1, p.y + 1, t - 2, t - 2);
          g.endFill();
        }
      }
    }

    // Entity-based terrain (walls/moats placed as structures).
    for (const e of terrain) {
      const cx = (e.x != null) ? e.x : 0;
      const cy = (e.y != null) ? e.y : 0;
      const fw = ((e.footprint && e.footprint.w) || 1) * t;
      const fh = ((e.footprint && e.footprint.h) || 1) * t;
      const damaged = e.hp != null && e.maxHp != null && e.hp < e.maxHp;

      if (e.kind === 'moat') {
        g.beginFill(P.moatDeep);
        g.drawRect(cx - fw / 2, cy - fh / 2, fw, fh);
        g.endFill();
        g.beginFill(P.moat, 0.65);
        g.drawRect(cx - fw / 2 + 2, cy - fh / 2 + 2, fw - 4, fh - 4);
        g.endFill();
      } else {
        // wall
        g.beginFill(damaged ? P.wallDamaged : P.wall);
        g.drawRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 3);
        g.endFill();
        // battlement notches
        g.beginFill(P.groundShadow, 0.4);
        g.drawRect(cx - fw / 2, cy + fh / 2 - 4, fw, 4);
        g.endFill();
      }
    }
  }

  destroy() {
    this.gStatic.destroy();
    this.gTerrain.destroy();
    this.gSlots.destroy();
  }
}

export function createBoardPainter(layers) {
  return new BoardPainter(layers);
}

export default createBoardPainter;