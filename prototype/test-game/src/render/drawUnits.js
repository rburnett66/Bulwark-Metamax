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

// Enemy (hostile) palette — enemies read hotter/darker & get a distinct hue
// so players can instantly tell friend from foe regardless of domain.
const ENEMY_DOMAIN_COLORS = {
  walker: 0x992222,
  floater: 0x663399,
  flyer: 0xbb3355,
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

// Determine whether a unit is hostile to the player (an "enemy" attacker).
function isEnemy(u) {
  if (!u) return false;
  if (u.enemy === true || u.hostile === true) return true;
  if (u.friendly === true || u.ally === true) return false;
  const side = u.side ?? u.team ?? u.faction ?? u.owner;
  if (typeof side === 'string') {
    const s = side.toLowerCase();
    if (s === 'enemy' || s === 'hostile' || s === 'attacker' || s === 'foe') return true;
    if (s === 'player' || s === 'friendly' || s === 'ally' || s === 'defender') return false;
  }
  if (side === 1) return true;
  if (side === 0) return false;
  // Attackers (wave units) default to enemy; deployed troops default friendly.
  if (u.isAttacker === true || u.role === 'attacker') return true;
  if (u.isTroop === true || u.role === 'troop' || u.deployed === true) return false;
  return false;
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
    const enemy = isEnemy(u);
    const palette = enemy ? ENEMY_DOMAIN_COLORS : DOMAIN_COLORS;
    const baseColor = palette[dom] || (enemy ? 0xaa2222 : 0xffffff);
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
      this._drawFlyer(g, pos.x, bodyY, r, color, u, state, enemy);
    } else if (dom === 'floater') {
      this._drawFloater(g, pos.x, bodyY, r, color, u, state, enemy);
    } else {
      this._drawWalker(g, pos.x, bodyY, r, color, u, state, enemy);
    }

    // Enemy marker: distinct spiked/hostile outline ring so enemies are
    // recognizable by shape as well as color.
    if (enemy) {
      this._drawEnemyMarker(g, pos.x, bodyY, r, dom);
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

  // Draws a hostile silhouette cue around an enemy: a red spiked ring.
  // The spike count differs by domain so enemy shapes stay differentiated.
  _drawEnemyMarker(g, cx, cy, r, dom) {
    const spikes = dom === 'flyer' ? 5 : dom === 'floater' ? 6 : 8;
    const outer = r * 1.35;
    const inner = r * 1.05;
    g.lineStyle(1.5, 0xff2222, 0.85);
    for (let i = 0; i < spikes; i++) {
      const a0 = (i / spikes) * Math.PI * 2;
      const a1 = ((i + 0.5) / spikes) * Math.PI * 2;
      const px0 = cx + Math.cos(a0) * outer;
      const py0 = cy + Math.sin(a0) * outer;
      const px1 = cx + Math.cos(a1) * inner;
      const py1 = cy + Math.sin(a1) * inner;
      if (i === 0) g.moveTo(px0, py0);
      else g.lineTo(px0, py0);
      g.lineTo(px1, py1);
    }
    // close back to first outer point
    g.lineTo(cx + outer, cy);
    g.lineStyle(0);
  }

  _drawWalker(g, cx, cy, r, color, u, state, enemy) {
    // legs
    g.beginFill(enemy ? 0x330808 : 0x552211, 1);
    g.drawRect(cx - r * 0.6, cy + r * 0.3, r * 1.2, r * 0.5);
    g.endFill();
    if (enemy) {
      // enemy walkers use an angular (diamond) chassis to differ by shape
      g.beginFill(color, 1);
      g.moveTo(cx, cy - r * 0.9);
      g.lineTo(cx + r * 0.9, cy);
      g.lineTo(cx, cy + r * 0.9);
      g.lineTo(cx - r * 0.9, cy);
      g.closePath();
      g.endFill();
    } else {
      // body (square-ish chassis)
      g.beginFill(color, 1);
      g.drawRoundedRect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6, 3);
      g.endFill();
    }
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

  _drawFloater(g, cx, cy, r, color, u, state, enemy) {
    // submerged tint under water: swimmers read darker/lower
    const submerged = u.submerged === true || u.role === 'swimmer';
    // wake ripple
    g.lineStyle(1.5, enemy ? 0xcc66ff : 0x66bbff, 0.5);
    g.drawEllipse(cx, cy + r * 0.2, r * 1.4, r * 0.6);
    g.lineStyle(0);
    // hull
    g.beginFill(submerged ? this._shade(color, 0.6) : color, submerged ? 0.7 : 1);
    if (enemy) {
      // enemy floaters use a sharp arrow-hull silhouette
      g.moveTo(cx - r, cy);
      g.lineTo(cx, cy - r * 0.65);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r * 0.7);
      g.closePath();
    } else {
      g.drawEllipse(cx, cy, r, r * 0.7);
    }
    g.endFill();
    // deck / turret
    g.beginFill(this._shade(color, 1.25), submerged ? 0.6 : 1);
    g.drawRect(cx - r * 0.35, cy - r * 0.55, r * 0.7, r * 0.6);
    g.endFill();
    if (state === 'Death') {
      g.lineStyle(2, 0x000000, 0.6);
      g.moveTo(cx - r, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineStyle(0);
    }
  }

  _drawFlyer(g, cx, cy, r, color, u, state, enemy) {
    // wings
    g.beginFill(this._shade(color, enemy ? 0.75 : 0.85), 0.95);
    if (enemy) {
      // swept-back, angular bat-like wings for enemy flyers
      g.moveTo(cx, cy);
      g.lineTo(cx - r * 1.7, cy - r * 0.5);
      g.lineTo(cx - r * 0.6, cy + r * 0.2);
      g.closePath();
      g.moveTo(cx, cy);
      g.lineTo(cx + r * 1.7, cy - r * 0.5);
      g.lineTo(cx + r * 0.6, cy + r * 0.2);
      g.closePath();
    } else {
      g.drawEllipse(cx - r * 1.1, cy, r * 0.9, r * 0.45);
      g.drawEllipse(cx + r * 1.1, cy, r * 0.9, r * 0.45);
    }
    g.endFill();
    // fuselage / body
    g.beginFill(color, 1);
    g.drawEllipse(cx, cy, r * 0.7, r * 0.55);
    g.endFill();
    // cockpit
    g.beginFill(this._shade(color, 1.35), 1);
    g.drawCircle(cx, cy - r * 0.1, r * 0.28);
    g.endFill();
    if (state === 'Death') {
      g.lineStyle(2, 0x000000, 0.6);
      g.moveTo(cx - r, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineStyle(0);
    }
  }

  _drawWeapon(g, cx, cy, r, u) {
    const tgt = u.target || u.aim;
    if (!tgt) return;
    let ax = tgt.x, ay = tgt.y;
    if (ax == null && tgt.pos) { ax = tgt.pos.x; ay = tgt.pos.y; }
    if (ax == null) return;
    const tp = this._project(ax, ay);
    const dx = tp.x - cx;
    const dy = tp.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    g.lineStyle(2, 0xffee88, u.attacking ? 0.9 : 0.4);
    g.moveTo(cx, cy);
    g.lineTo(cx + nx * r * 1.2, cy + ny * r * 1.2);
    g.lineStyle(0);
  }

  _drawHpBar(g, cx, cy, u) {
    const hpMax = u.maxHp || u.hp || 1;
    const hp = Math.max(0, Math.min(hpMax, u.hp ?? hpMax));
    if (hp >= hpMax) return; // hide when full
    const w = 20;
    const h = 3;
    const frac = hp / hpMax;
    g.beginFill(0x000000, 0.6);
    g.drawRect(cx - w / 2 - 1, cy - 1, w + 2, h + 2);
    g.endFill();
    const col = frac > 0.5 ? 0x33cc33 : frac > 0.25 ? 0xcccc33 : 0xcc3333;
    g.beginFill(col, 1);
    g.drawRect(cx - w / 2, cy, w * frac, h);
    g.endFill();
  }

  _shade(color, factor) {
    const r = (color >> 16) & 0xff;
    const gg = (color >> 8) & 0xff;
    const b = color & 0xff;
    const nr = Math.max(0, Math.min(255, Math.round(r * factor)));
    const ng = Math.max(0, Math.min(255, Math.round(gg * factor)));
    const nb = Math.max(0, Math.min(255, Math.round(b * factor)));
    return (nr << 16) | (ng << 8) | nb;
  }

  destroy() {
    for (const id of Array.from(this._nodes.keys())) this._removeNode(id);
    this._nodes.clear();
    this._seen.clear();
  }
}

export default DrawUnits;