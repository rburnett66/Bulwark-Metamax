// src/render/drawPath.js
// Draws the recomputed walker path (ground lane path around walls/moats)
// and the deploy march line (base -> chosen drop location during deploy mode).
// READ-ONLY: never mutates sim state.

export function createPathRenderer(PIXI, layer) {
  const g = new PIXI.Graphics();
  layer.addChild(g);

  // A separate graphics for the deploy march line so we can style differently.
  const marchG = new PIXI.Graphics();
  layer.addChild(marchG);

  let dashPhase = 0;

  function drawDashedPolyline(gfx, points, color, alpha, width, dashLen, gapLen, phase) {
    if (!points || points.length < 2) return;
    gfx.lineStyle(width, color, alpha);
    let carry = phase % (dashLen + gapLen);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen < 1e-6) continue;
      const ux = dx / segLen;
      const uy = dy / segLen;
      let dist = 0;
      // account for carry-over dash/gap phase across segments
      let pos = -carry;
      let drawing = true;
      // step along the dash-gap cycle
      let cursor = -carry;
      // We'll iterate the cycle from cursor to segLen
      let p = cursor;
      // The pattern starts: at p relative offset, dash for dashLen, gap for gapLen...
      // Determine initial state based on phase.
      // Simplify: walk cycle positions
      let localPhase = carry;
      let start = 0;
      while (start < segLen) {
        const inDash = localPhase < dashLen;
        const remainInPhase = inDash ? (dashLen - localPhase) : (dashLen + gapLen - localPhase);
        const end = Math.min(segLen, start + remainInPhase);
        if (inDash) {
          gfx.moveTo(a.x + ux * start, a.y + uy * start);
          gfx.lineTo(a.x + ux * end, a.y + uy * end);
        }
        const consumed = end - start;
        localPhase += consumed;
        if (localPhase >= dashLen + gapLen) localPhase -= (dashLen + gapLen);
        start = end;
      }
      carry = localPhase;
    }
  }

  function drawSolidPolyline(gfx, points, color, alpha, width) {
    if (!points || points.length < 2) return;
    gfx.lineStyle(width, color, alpha);
    gfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      gfx.lineTo(points[i].x, points[i].y);
    }
  }

  function nodeDots(gfx, points, color, alpha, radius) {
    if (!points) return;
    gfx.lineStyle(0);
    gfx.beginFill(color, alpha);
    for (let i = 0; i < points.length; i++) {
      gfx.drawCircle(points[i].x, points[i].y, radius);
    }
    gfx.endFill();
  }

  // Resolve a lane path from world state. The pathfinding sim stores tile-space
  // waypoints; geometry provides tile->world projection.
  function resolvePathPoints(world) {
    const geom = world.geometry;
    if (!geom) return null;

    // Prefer an explicit cached walker path recomputed by sim/pathfinding.
    let raw = null;
    if (world.paths && world.paths.walker) raw = world.paths.walker;
    else if (world.walkerPath) raw = world.walkerPath;
    else if (geom.groundLanePath) raw = geom.groundLanePath;

    if (!raw || raw.length === 0) return null;

    const toWorld = (pt) => {
      // Points may already be world-space {x,y} or tile-space {tx,ty} / {col,row}.
      if (pt.wx !== undefined && pt.wy !== undefined) return { x: pt.wx, y: pt.wy };
      if (pt.x !== undefined && pt.y !== undefined && pt.tile !== true) {
        // Heuristic: if geometry has a tileToWorld and values look tile-sized, convert.
        return { x: pt.x, y: pt.y };
      }
      const col = pt.tx !== undefined ? pt.tx : pt.col;
      const row = pt.ty !== undefined ? pt.ty : pt.row;
      if (geom.tileToWorld) return geom.tileToWorld(col, row);
      const size = geom.tileSize || 32;
      const ox = geom.originX || 0;
      const oy = geom.originY || 0;
      return { x: ox + (col + 0.5) * size, y: oy + (row + 0.5) * size };
    };

    return raw.map(toWorld);
  }

  function drawDeployMarch(world, session) {
    marchG.clear();
    if (!session) return;
    const mode = session.mode;
    if (mode !== 'deploy') return;
    const drop = session.deployTarget || session.hoverPoint || session.dropPoint;
    if (!drop) return;

    const base = world.base;
    if (!base) return;

    const start = { x: base.x, y: base.y };
    const end = { x: drop.x, y: drop.y };

    // Valid/invalid coloring for the march destination.
    const valid = session.deployValid !== false;
    const color = valid ? 0x66ff88 : 0xff5555;

    // Dashed march line base -> drop point.
    drawDashedPolyline(marchG, [start, end], color, 0.9, 3, 10, 8, dashPhase);

    // Origin marker at base.
    marchG.lineStyle(0);
    marchG.beginFill(0xffffff, 0.8);
    marchG.drawCircle(start.x, start.y, 5);
    marchG.endFill();

    // Destination reticle.
    marchG.lineStyle(2, color, 1.0);
    marchG.drawCircle(end.x, end.y, 12);
    marchG.moveTo(end.x - 16, end.y);
    marchG.lineTo(end.x + 16, end.y);
    marchG.moveTo(end.x, end.y - 16);
    marchG.lineTo(end.x, end.y + 16);
  }

  return {
    display: g,
    // Called every frame by renderer with current strict state.
    update(world, session, dtMs) {
      dashPhase += (dtMs || 16) * 0.04;
      if (dashPhase > 100000) dashPhase = 0;

      g.clear();

      // Draw recomputed walker path (reroutes visibly around walls/moats).
      const pts = resolvePathPoints(world);
      if (pts && pts.length >= 2) {
        // Faint under-glow solid line for readability.
        drawSolidPolyline(g, pts, 0x223344, 0.35, 6);
        // Animated dashed path in walker-lane color.
        drawDashedPolyline(g, pts, 0xffcc33, 0.85, 2, 8, 6, dashPhase);
        // Waypoint nodes (path corners caused by rerouting).
        nodeDots(g, pts, 0xffee88, 0.7, 2.5);
      }

      // Draw deploy march line during deploy mode.
      drawDeployMarch(world, session);
    },
    clear() {
      g.clear();
      marchG.clear();
    }
  };
}

export default createPathRenderer;