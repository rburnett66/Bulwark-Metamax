// src/render/drawUnits.js
// Draws walkers/floaters/flyers as primitives with altitude/shadow cues.
// READ-ONLY over sim state: never mutates world. Presentation only.

const SUN_OFFSET = { x: 6, y: 8 }; // global sun direction for shadows

// Palette by domain / kind (primitive coloring)
const DOMAIN_COLORS = {
  walker: 0xcc4433,
  floater: 0x3388cc,
  flyer: 0xddaa33,
};

const STATE_TINT = {
  Idle: 1.0,
  Moving: 1.0,
  Attacking: 1.0,
  Death: 0.4,
};

function domainOf(u) {
  // prefer explicit domain, fall back to kind
  if (u.domain) return u.domain;
  if (u.kind === 'flyer') return 'flyer';
  if (u.kind === 'floater' || u.kind === 'swimmer') return 'floater';
  return 'walker';
}

function radiusFor(u) {
  // scale visual size with HP for readability
  const hpMax = u.maxHp || u.hp || 100;
  const base = 7 + Math.min(10, Math.sqrt(hpMax) * 0.35);
  return base;
}

/**
 * DrawUnits — layer painter for all attacker/deployed units.
 * Uses caches of PIXI.Graphics keyed by entity id so we don't churn objects.
 */
export class DrawUnits {
  /**
   * @param {object} deps
   * @param {object} deps.layers  - layer container map from layers.js
   * @param {object} deps.geometry - board geometry (world→screen projector)
   * @param {any}    deps.PIXI    - pixi namespace
   */
  constructor({ layers, geometry, PIXI }) {
    this.PIXI = PIXI;
    this.layers = layers;
    this.geometry = geometry;

    // containers
    this.shadowLayer =
      layers.groundShadows || layers.shadows || layers.ground || layers.units;
    this.unitLayer = layers.units;
    this.airLayer = layers.airUnits || layers.units;

    this._nodes = new Map(); // id -> { g, shadow, dom }
    this._seen = new Set();
  }

  // Project a world position (tiles) into screen pixels via geometry.
  _project(x, y) {
    const g = this.geometry;
    if (g && typeof g.toScreen === 'function') return g.toScreen(x, y);
    if (g && typeof g.project === 'function') return g.project(x, y);
    // fallback linear scale
    const tile = (g && g.tileSize) || 24;
    const ox = (g && g.originX) || 0;
    const oy = (g && g.originY) || 0;
    return { x: ox + x * tile, y: oy + y * tile };
  }

  _ensureNode(id, dom) {
    let node = this._nodes.get(id);
    if (!node) {
      const g = new this.PIXI.Graphics();
      const shadow = new this.PIXI.Graphics();
      const container = dom === 'flyer' ? this.airLayer : this.unitLayer;
      this.shadowLayer.addChild(shadow);
      container.addChild(g);
      node = { g, shadow, dom, container };
      this._nodes.set(id, node);
    } else if (node.dom !== dom) {
      // domain changed (rare) → re-parent to correct layer
      node.container.removeChild(node.g);
      const container = dom === 'flyer' ? this.airLayer : this.unitLayer;
      container.addChild(node.g);
      node.dom = dom;
      node.container = container;
    }
    return node;
  }

  _removeNode(id) {
    const node = this._nodes.get(id);
    if (!node) return;
    if (node.g.parent) node.g.parent.removeChild(node.g);
    if (node.shadow.parent) node.shadow.parent.removeChild(node.shadow);
    node.g.destroy();
    node.shadow.destroy();
    this._nodes.delete(id);
  }

  /**
   * Draw all units for the current sim state.
   * @param {object} world - strict sim state (read only)
   */
  draw(world) {
    const units = this._collectUnits(world);
    this._seen.clear();

    for (const u of units) {
      if (!u || u.dead === true && !u.deathAnim) {
        // fully gone; skip (removal handled below)
        continue;
      }
      const id = u.id;
      this._seen.add(id);
      const dom = domainOf(u);
      const node = this._ensureNode(id, dom);
      this._drawUnit(node, u, dom);
    }

    // prune removed units
    for (const id of Array.from(this._nodes.keys())) {
      if (!this._seen.has(id)) this._removeNode(id);
    }
  }

  _collectUnits(world) {
    // Accept several shapes of state container.
    if (Array.isArray(world?.units)) return world.units;
    if (world?.entities) {
      const e = world.entities;
      if (Array.isArray(e.units)) return e.units;
      // gather by domain lists
      const out = [];
      for (const k of ['walkers', 'floaters', 'flyers', 'attackers', 'troops']) {
        if (Array.isArray(e[k])) out.push(...e[k]);
      }
      if (out.length) return out;
      // map of id->entity, filter to mobile units
      if (typeof e === 'object') {
        return Object.values(e).filter(
          (x) => x && (x.kind === 'walker' || x.kind === 'floater' ||
            x.kind === 'swimmer' || x.kind === 'flyer' || x.domain)
        );
      }
    }
    return [];
  }

  _drawUnit(node, u, dom) {
    const { g, shadow } = node;
    const pos = this._project(u.x ?? u.pos?.x ?? 0, u.y ?? u.pos?.y ?? 0);
    const r = radiusFor(u);
    const baseColor = DOMAIN_COLORS[dom] || 0xffffff;
    const state = u.animState || (u.dead ? 'Death' : (u.attacking ? 'Attacking' : (u.moving ? 'Moving' : 'Idle')));
    const tint = STATE_TINT[state] ?? 1.0;
    const color = this._shade(baseColor, tint);

    // Altitude for flyers (in tiles). Shadow distance conveys altitude.
    const altitude = dom === 'flyer' ? (u.altitude ?? 3) : 0;
    const altPx = altitude * 6; // how far the flyer body floats above its ground anchor

    // ---- Shadow ----
    shadow.clear();
    const shadowAlpha = dom === 'flyer' ? Math.max(0.08, 0.25 - altitude * 0.02) : 0.28;
    const shadowStretch = dom === 'flyer' ? 1.0 + altitude * 0.05 : 1.0;
    const sx = pos.x + SUN_OFFSET.x * (dom === 'flyer' ? 1 + altitude * 0.15 : 1);
    const sy = pos.y + SUN_OFFSET.y;
    shadow.beginFill(0x000000, shadowAlpha);
    shadow.drawEllipse(sx, sy, r * shadowStretch, r * 0.5 * shadowStretch);
    shadow.endFill();

    // ---- Body ----
    g.clear();

    // dust trail for moving ground units (simple)
    if (dom !== 'flyer' && state === 'Moving') {
      g.beginFill(0x8a7a5a, 0.15);
      g.drawCircle(pos.x - SUN_OFFSET.x, pos.y + r * 0.5, r * 0.6);
      g.endFill();
    }

    const bodyY = pos.y - altPx;

    if (dom === 'flyer') {
      this._drawFlyer(g, pos.x, bodyY, r, color, u, state);
    } else if (dom === 'floater') {
      this._drawFloater(g, pos.x, bodyY, r, color, u, state);
    } else {
      this._drawWalker(g, pos.x, bodyY, r, color, u, state);
    }

    // weapon indicator: rotate toward target (telegraph)
    this._drawWeapon(g, pos.x, bodyY, r, u);

    // HP bar
    this._drawHpBar(g, pos.x, bodyY - r - 6, u);

    // targetsBase / structure-flag marker (siege units)
    if (u.targetsBase === false || u.targets === 'Structures') {
      g.lineStyle(1.5, 0xff00ff, 0.8);
      g.drawRect(pos.x - r - 2, bodyY - r - 2, (r + 2) * 2, (r + 2) * 2);
      g.lineStyle(0);
    }
  }

  _drawWalker(g, cx, cy, r, color, u, state) {
    // legs
    g.beginFill(0x552211, 1);
    g.drawRect(cx - r * 0.6, cy + r * 0.3, r * 1.2, r * 0.5);
    g.endFill();
    // body (square-ish chassis)
    g.beginFill(color, 1);
    g.drawRoundedRect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6, 3);
    g.endFill();
    // head/sensor
    g.beginFill(this._shade(color, 1.3), 1);
    g.drawCircle(cx, cy - r * 0.4, r * 0.35);
    g.endFill();
    if (state === 'Death') {
      g.lineStyle(2, 0x000000, 0.6);
      g.moveTo(cx - r, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineStyle(0);
    }
  }

  _drawFloater(g, cx, cy, r, color, u, state) {
    // submerged tint under water: swimmers read darker/lower
    const submerged = u.submerged === true || u.role === 'swimmer';
    // wake ripple
    g.lineStyle(1.5, 0x66bbff, 0.5);
    g.drawEllipse(cx, cy + r * 0.2, r * 1.4, r * 0.6);
    g.lineStyle(0);
    // hull
    g.beginFill(submerged ? this._shade(color, 0.6) : color, submerged ? 0.7 : 1);
    g.drawEllipse(cx, cy, r, r * 0.7);
    g.endFill();
    // deck / turret
    g.beginFill(this._shade(color, 1.25), submerged ? 0.6 : 1);
    g.drawRect(cx - r * 0.35, cy - r * 0.55, r * 0.7, r * 0.6);
    g.endFill();
  }

  _drawFlyer(g, cx, cy, r, color, u, state) {
    // rotor / thrust cross instead of legs
    g.lineStyle(2, 0x999999, 0.9);
    g.moveTo(cx - r * 1.1, cy - r * 0.6);
    g.lineTo(cx + r * 1.1, cy - r * 0.6);
    g.moveTo(cx - r * 1.1, cy + r * 0.2);
    g.lineTo(cx + r * 1.1, cy + r * 0.2);
    g.lineStyle(0);
    // fuselage
    g.beginFill(color, 1);
    g.drawEllipse(cx, cy, r * 0.7, r);
    g.endFill();
    // cockpit
    g.beginFill(0x223355, 1);
    g.drawCircle(cx, cy - r * 0.4, r * 0.3);
    g.endFill();
    if (state === 'Death') {
      g.lineStyle(2, 0x000000, 0.6);
      g.moveTo(cx - r, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineStyle(0);
    }
  }

  _drawWeapon(g, cx, cy, r, u) {
    // aim angle: prefer sim target vector; telegraph via head/weapon
    let ang = u.aimAngle;
    if (ang == null && u.target && (u.target.x != null || u.target.pos)) {
      const tp = this._project(
        u.target.x ?? u.target.pos?.x ?? 0,
        u.target.y ?? u.target.pos?.y ?? 0
      );
      const bp = this._project(u.x ?? u.pos?.x ?? 0, u.y ?? u.pos?.y ?? 0);
      ang = Math.atan2(tp.y - bp.y, tp.x - bp.x);
    }
    if (ang == null) return;
    const len = r * 1.1;
    // wind-up: brighter when firing
    const firing = u.animState === 'Attacking' || u.firing === true;
    g.lineStyle(3, firing ? 0xffee66 : 0x333333, 0.95);
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    g.lineStyle(0);
  }

  _drawHpBar(g, cx, y, u) {
    const maxHp = u.maxHp || u.hp || 1;
    const hp = Math.max(0, u.hp ?? 0);
    const frac = Math.max(0, Math.min(1, hp / maxHp));
    const w = 22;
    // back
    g.beginFill(0x000000, 0.55);
    g.drawRect(cx - w / 2 - 1, y - 1, w + 2, 5);
    g.endFill();
    // fill
    const col = frac > 0.5 ? 0x33cc33 : frac > 0.25 ? 0xcccc33 : 0xcc3333;
    g.beginFill(col, 1);
    g.drawRect(cx - w / 2, y, w * frac, 3);
    g.endFill();
  }

  _shade(color, factor) {
    const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
    const gg = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.floor((color & 0xff) * factor));
    return (r << 16) | (gg << 8) | b;
  }

  destroy() {
    for (const id of Array.from(this._nodes.keys())) this._removeNode(id);
    this._nodes.clear();
  }
}

export default DrawUnits;