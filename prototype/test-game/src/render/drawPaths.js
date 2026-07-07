Looking at this file's purpose, I need to render walker path lines and the deploy march line by reading sim state.

```javascript
// src/render/drawPaths.js
// Render recomputed walker path lines and the deploy march line.
// READ-ONLY over sim state + placement preview. Uses PIXI Graphics primitives.

const PIXI = window.PIXI;

/**
 * DrawPaths — draws:
 *   - Recomputed walker paths (the ground-lane route around walls/moats)
 *   - Per-walker current path (subtle, so path recompute is visible)
 *   - The deploy march line during placement/deploy preview
 *
 * Constructed with a parent container (typically the FX or ground layer).
 * Call update(state, view) every frame.
 */
export class DrawPaths {
  /**
   * @param {PIXI.Container} parent - layer to attach to
   * @param {object} opts - { project } optional world->screen projector
   */
  constructor(parent, opts = {}) {
    this.parent = parent;
    this.project = opts.project || ((x, y) => ({ x, y }));

    // Container so we can toggle/z-order the whole path group.
    this.container = new PIXI.Container();
    this.container.sortableChildren = false;
    parent.addChild(this.container);

    // Graphics for the canonical recomputed walker lane path.
    this.gLane = new PIXI.Graphics();
    this.container.addChild(this.gLane);

    // Graphics for per-walker future path hints.
    this.gWalkerPaths = new PIXI.Graphics();
    this.container.addChild(this.gWalkerPaths);

    // Graphics for the deploy march line (during placement preview).
    this.gMarch = new PIXI.Graphics();
    this.container.addChild(this.gMarch);

    // Cache of last-seen path revision to avoid noisy redraws (still redraw each frame cheaply).
    this._lastRev = -1;
  }

  destroy() {
    this.gLane.destroy();
    this.gWalkerPaths.destroy();
    this.gMarch.destroy();
    this.container.destroy({ children: true });
  }

  setVisible(v) {
    this.container.visible = !!v;
  }

  /**
   * @param {object} state - sim state (read-only)
   * @param {object} view  - { placement, tileSize, project } render-side info (read-only)
   */
  update(state, view = {}) {
    const project = view.project || this.project;

    this._drawLane(state, project);
    this._drawWalkerPaths(state, project);
    this._drawMarchLine(state, view, project);
  }

  // ---------------------------------------------------------------------------
  // Canonical recomputed walker lane path
  // ---------------------------------------------------------------------------
  _drawLane(state, project) {
    const g = this.gLane;
    g.clear();

    const pathing = state && (state.pathing || state.paths);
    let laneWaypoints = null;

    // Prefer a fully-recomputed walker path if the pathing system exposes one.
    if (pathing) {
      laneWaypoints =
        pathing.walkerPath ||
        pathing.groundPath ||
        pathing.mainPath ||
        (Array.isArray(pathing) ? pathing : null);
    }
    // Fallback: board-defined ground lane centerline.
    if (!laneWaypoints && state && state.board) {
      laneWaypoints =
        state.board.groundLane ||
        state.board.groundPath ||
        (state.board.lanes && state.board.lanes.ground);
    }

    if (!laneWaypoints || laneWaypoints.length < 2) return;

    const pts = this._normPoints(laneWaypoints);
    if (pts.length < 2) return;

    // Draw the recomputed route as a dashed olive/amber line so reroutes are visible.
    this._dashedPolyline(g, pts, project, {
      color: 0xd8c07a,
      alpha: 0.55,
      width: 3,
      dash: 12,
      gap: 8,
    });

    // Node dots at each waypoint (corners = where reroute bends around walls/moats).
    g.beginFill(0xffe9a8, 0.7);
    for (const p of pts) {
      const s = project(p.x, p.y);
      g.drawCircle(s.x, s.y, 2.5);
    }
    g.endFill();
  }

  // ---------------------------------------------------------------------------
  // Per-walker path hints (show that individual walkers follow the recomputed route)
  // ---------------------------------------------------------------------------
  _drawWalkerPaths(state, project) {
    const g = this.gWalkerPaths;
    g.clear();
    if (!state) return;

    const ents = this._entities(state);
    if (!ents.length) return;

    for (const e of ents) {
      if (!e || e.dead) continue;
      const dom = (e.domain || e.kind || '').toString().toLowerCase();
      const isWalker =
        e.type === 'walker' ||
        dom === 'walker' ||
        e.category === 'walker' ||
        (e.isAttacker && dom !== 'flyer' && dom !== 'floater' && dom !== 'swimmer');
      if (!isWalker) continue;

      // Remaining path for this walker.
      const remaining =
        e.path && e.pathIndex != null
          ? e.path.slice(e.pathIndex)
          : e.remainingPath || e.path;
      if (!remaining || remaining.length < 1) continue;

      const pos = this._pos(e);
      if (!pos) continue;

      const chain = [pos].concat(this._normPoints(remaining));
      if (chain.length < 2) continue;

      // Thin faint line from current pos through remaining waypoints.
      let started = false;
      g.lineStyle(1.25, 0x9fd18a, 0.35);
      for (let i = 0; i < chain.length; i++) {
        const s = project(chain[i].x, chain[i].y);
        if (!started) {
          g.moveTo(s.x, s.y);
          started = true;
        } else {
          g.lineTo(s.x, s.y);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Deploy march line (during placement/deploy preview)
  // ---------------------------------------------------------------------------
  _drawMarchLine(state, view, project) {
    const g = this.gMarch;
    g.clear();

    const placement = view.placement || (state && state.placement);
    if (!placement || !placement.active) return;

    // Only draw a march line for troop/unit deploys (base -> drop destination).
    const isDeploy =
      placement.mode === 'deploy' ||
      placement.kind === 'unit' ||
      placement.isUnit === true ||
      placement.deploy === true;
    if (!isDeploy) return;

    // Origin: player base position.
    const base = state && (state.base || (state.entities && state.entities.base));
    const origin = base ? this._pos(base) : null;

    // Destination: current hover/drop preview location.
    const dest = this._pos(placement) ||
      (placement.hover ? this._pos(placement.hover) : null) ||
      (placement.target ? this._pos(placement.target) : null);

    if (!origin || !dest) return;

    const valid = placement.valid !== false;
    const color = valid ? 0x66ff9c : 0xff6666;

    const so = project(origin.x, origin.y);
    const sd = project(dest.x, dest.y);

    // Dashed march line.
    this._dashedSegment(g, so, sd, {
      color,
      alpha: 0.85,
      width: 2.5,
      dash: 10,
      gap: 6,
    });

    // Origin marker.
    g.lineStyle(0);
    g.beginFill(color, 0.6);
    g.drawCircle(so.x, so.y, 4);
    g.endFill();

    // Destination arrowhead / marker.
    g.beginFill(color, 0.9);
    g.drawCircle(sd.x, sd.y, 5);
    g.endFill();

    // Small chevron pointing toward destination.
    const ang = Math.atan2(sd.y - so.y, sd.x - so.x);
    const len = 12;
    const spread = 0.5;
    g.lineStyle(2.5, color, 0.9);
    g.moveTo(
      sd.x - Math.cos(ang - spread) * len,
      sd.y - Math.sin(ang - spread) * len
    );
    g.lineTo(sd.x, sd.y);
    g.lineTo(
      sd.x - Math.cos(ang + spread) * len,
      sd.y - Math.sin(ang + spread) * len
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  _entities(state) {
    if (!state) return [];
    if (Array.isArray(state.entities)) return state.entities;
    if (state.entities && Array.isArray(state.entities.all))
      return state.entities.all;
    if (state.entities && Array.isArray(state.entities.units))
      return state.entities.units;
    if (Array.isArray(state.attackers)) return state.attackers;
    if (Array.isArray(state.units)) return state.units;
    // Gather from typed buckets.
    const out = [];
    if (state.entities && typeof state.entities === 'object') {
      for (const k of Object.keys(state.entities)) {
        const v = state.entities[k];
        if (Array.isArray(v)) out.push(...v);
      }
    }
    return out;
  }

  _pos(o) {
    if (!o) return null;
    if (o.pos && typeof o.pos.x === 'number')
      return { x: o.pos.x, y: o.pos.y };
    if (o.position && typeof o.position.x === 'number')
      return { x: o.position.x, y: o.position.y };
    if (typeof o.x === 'number' && typeof o.y === 'number')
      return { x: o.x, y: o.y };
    return null;
  }

  _normPoints(arr) {
    const out = [];
    if (!arr) return out;
    for (const w of arr) {
      const p = this._pos(w);
      if (p) out.push(p);
    }
    return out;
  }

  _dashedPolyline(g, pts, project, style) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = project(pts[i].x, pts[i].y);
      const b = project(pts[i + 1].x, pts[i + 1].y);
      this._dashedSegment(g, a, b, style);
    }
  }

  _dashedSegment(g, a, b, style) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const ux = dx / len;
    const uy = dy / len;
    const step = style.dash + style.gap;

    g.lineStyle(style.width, style.color, style.alpha);
    let d = 0;
    while (d < len) {
      const dEnd = Math.min(d + style.dash, len);
      g.moveTo(a.x + ux * d, a.y + uy * d);
      g.lineTo(a.x + ux * dEnd, a.y + uy * dEnd);
      d += step;
    }
    g.lineStyle(0);
  }
}

export default DrawPaths;