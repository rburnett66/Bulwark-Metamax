// src/render/drawGhost.js
// Placement ghost with valid/invalid tint.
// Reads session UI state (build mode, hovered slot, selected structure def) and
// draws a translucent placement preview. READ-ONLY: never mutates sim/session.

import * as PIXI from '../../vendor/pixi.min.js';

const VALID_TINT = 0x37e05a;
const INVALID_TINT = 0xe0403a;
const VALID_FILL = 0x2fae4b;
const INVALID_FILL = 0xae2f2b;

export function createGhostDrawer(layer) {
  const container = new PIXI.Container();
  container.zIndex = 900;
  if (layer && layer.addChild) layer.addChild(container);

  const g = new PIXI.Graphics();
  container.addChild(g);

  const rangeG = new PIXI.Graphics();
  container.addChild(rangeG);

  function clear() {
    g.clear();
    rangeG.clear();
    container.visible = false;
  }

  /**
   * @param {object} params
   *  - world: sim world (read-only)
   *  - session: UI state { mode, ghost:{ defId, kind, x, y, footprint, range, valid, reason } }
   *  - geometry: board geometry helper (optional)
   */
  function draw(params) {
    const { world, session } = params || {};
    if (!session) { clear(); return; }

    const ghost = session.ghost || session.placeGhost || null;
    const mode = session.mode;

    // Only show ghost while in build/deploy mode with an active preview.
    if (!ghost || (mode !== 'build' && mode !== 'deploy')) {
      clear();
      return;
    }

    // Ghost must have a position (hover point or snapped slot).
    if (typeof ghost.x !== 'number' || typeof ghost.y !== 'number') {
      clear();
      return;
    }

    container.visible = true;
    g.clear();
    rangeG.clear();

    const valid = ghost.valid !== false;
    const tint = valid ? VALID_TINT : INVALID_TINT;
    const fill = valid ? VALID_FILL : INVALID_FILL;
    const alpha = 0.45;

    // Determine footprint dimensions.
    const fp = ghost.footprint || {};
    const w = fp.w || fp.width || ghost.w || 40;
    const h = fp.h || fp.height || ghost.h || 40;

    const x = ghost.x;
    const y = ghost.y;

    // Range circle (dashed-ish approximation) for towers.
    if (ghost.range && ghost.range > 0) {
      drawRangeCircle(rangeG, x, y, ghost.range, tint);
    }

    const isTerrain = ghost.kind === 'wall' || ghost.kind === 'moat';

    if (isTerrain) {
      // Terrain footprint: rectangle body.
      g.beginFill(fill, alpha);
      g.lineStyle(2, tint, 0.9);
      g.drawRect(x - w / 2, y - h / 2, w, h);
      g.endFill();
      if (ghost.kind === 'moat') {
        // inner water-tint band
        g.beginFill(0x2a5a8a, alpha * 0.6);
        g.drawRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8);
        g.endFill();
      }
    } else {
      // Structure/tower ghost: base pad + body block.
      const r = Math.max(w, h) / 2;
      g.beginFill(fill, alpha);
      g.lineStyle(2, tint, 0.9);
      g.drawCircle(x, y, r);
      g.endFill();

      // body block
      const bw = w * 0.6;
      const bh = h * 0.6;
      g.beginFill(tint, alpha + 0.15);
      g.lineStyle(1.5, tint, 1);
      g.drawRect(x - bw / 2, y - bh / 2, bw, bh);
      g.endFill();

      // muzzle indicator
      g.lineStyle(2, tint, 1);
      g.moveTo(x, y);
      g.lineTo(x, y - r);
    }

    // Invalid cross marker.
    if (!valid) {
      const s = Math.max(w, h) / 2;
      g.lineStyle(3, INVALID_TINT, 0.95);
      g.moveTo(x - s, y - s);
      g.lineTo(x + s, y + s);
      g.moveTo(x + s, y - s);
      g.lineTo(x - s, y + s);
    }

    // Deploy march-line: from base to drop point (deploy mode only).
    if (mode === 'deploy' && world && world.base && world.base.pos) {
      const bp = world.base.pos;
      const bx = (typeof bp.px === 'number') ? bp.px : bp.x;
      const by = (typeof bp.py === 'number') ? bp.py : bp.y;
      if (typeof bx === 'number' && typeof by === 'number') {
        drawDashedLine(rangeG, bx, by, x, y, tint);
      }
    }
  }

  function drawRangeCircle(gfx, x, y, radius, tint) {
    // Dashed circle approximation.
    const segs = 48;
    gfx.lineStyle(1.5, tint, 0.6);
    for (let i = 0; i < segs; i += 2) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      gfx.moveTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius);
      gfx.lineTo(x + Math.cos(a1) * radius, y + Math.sin(a1) * radius);
    }
  }

  function drawDashedLine(gfx, x0, y0, x1, y1, tint) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    const dash = 10;
    const gap = 6;
    gfx.lineStyle(2, tint, 0.7);
    let d = 0;
    while (d < len) {
      const dEnd = Math.min(d + dash, len);
      gfx.moveTo(x0 + ux * d, y0 + uy * d);
      gfx.lineTo(x0 + ux * dEnd, y0 + uy * dEnd);
      d += dash + gap;
    }
  }

  function destroy() {
    if (container.parent) container.parent.removeChild(container);
    container.destroy({ children: true });
  }

  return { draw, clear, destroy, container };
}

export default createGhostDrawer;