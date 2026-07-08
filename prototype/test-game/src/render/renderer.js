import { getStructureDef, getUnitDef } from '../data/tables.js';

const FX_DT = 1 / 60;

const KIND_COLORS = {
  antiGround: 0x8a6a2f,
  antiAir: 0x3f7fbf,
  wall: 0x9aa0a6,
  moat: 0x2f6db0
};

const SIDE_COLORS = {
  attacker: 0xd05040,
  defender: 0x50a0e0
};

// Differentiate enemy (attacker) units by shape and color.
// Palette keyed by damage type / class so units read distinctly.
const ENEMY_COLORS = {
  ballistic: 0xd05040,
  explosive: 0xe07030,
  energy: 0x40d0c0,
  chemical: 0x80d040,
  kinetic: 0xd0b040,
  arcane: 0xb060d0,
  default: 0xd05040
};

// Shape keyed by movement domain so air/water/ground read distinctly.
const ENEMY_SHAPES = {
  flyer: 'triangle',
  floater: 'diamond',
  walker: 'square',
  default: 'circle'
};

function enemyColorFor(def) {
  if (!def) return ENEMY_COLORS.default;
  const key = def.damageType || (def.damage && def.damage.type) || def.armorClass || def.class;
  if (key != null && ENEMY_COLORS[key] != null) return ENEMY_COLORS[key];
  return ENEMY_COLORS.default;
}

function enemyShapeFor(def, unit) {
  const domain = (def && (def.domain || def.movement || def.movementDomain))
    || (unit && (unit.domain || unit.movementDomain))
    || null;
  if (domain != null && ENEMY_SHAPES[domain] != null) return ENEMY_SHAPES[domain];
  return ENEMY_SHAPES.default;
}

function drawEnemyShape(g, shape, cx, cy, r, color, alpha) {
  g.lineStyle(0);
  g.beginFill(color, alpha == null ? 1 : alpha);
  switch (shape) {
    case 'triangle': {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.9, cy + r * 0.75);
      g.lineTo(cx - r * 0.9, cy + r * 0.75);
      g.lineTo(cx, cy - r);
      break;
    }
    case 'diamond': {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.lineTo(cx, cy - r);
      break;
    }
    case 'square': {
      g.drawRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
      break;
    }
    default: {
      g.drawCircle(cx, cy, r);
      break;
    }
  }
  g.endFill();
  // outline for extra legibility
  g.lineStyle(1.5, 0x000000, 0.4 * (alpha == null ? 1 : alpha));
  switch (shape) {
    case 'triangle': {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.9, cy + r * 0.75);
      g.lineTo(cx - r * 0.9, cy + r * 0.75);
      g.lineTo(cx, cy - r);
      break;
    }
    case 'diamond': {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.lineTo(cx, cy - r);
      break;
    }
    case 'square': {
      g.drawRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
      break;
    }
    default: {
      g.drawCircle(cx, cy, r);
      break;
    }
  }
  g.lineStyle(0);
}

function cellKey(x, y) { return x + ',' + y; }

function cellToLocal(renderer, cx, cy) {
  const t = renderer.tile;
  return { x: (cx + 0.5) * t, y: (cy + 0.5) * t };
}

function drawDashedCircle(g, cx, cy, radius, color, alpha, width) {
  const segs = 48;
  g.lineStyle(width || 1.5, color, alpha);
  for (let i = 0; i < segs; i += 2) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    g.moveTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
    g.lineTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius);
  }
  g.lineStyle(0);
}

function drawHpBar(g, cx, topY, w, frac, backAlpha) {
  const f = Math.max(0, Math.min(1, frac));
  const h = 4;
  g.lineStyle(0);
  g.beginFill(0x000000, backAlpha == null ? 0.6 : backAlpha);
  g.drawRect(cx - w / 2, topY, w, h);
  g.endFill();
  const col = f > 0.6 ? 0x4ad04a : (f > 0.3 ? 0xe0c040 : 0xe04040);
  g.beginFill(col, 0.95);
  g.drawRect(cx - w / 2 + 0.5, topY + 0.5, (w - 1) * f, h - 1);
  g.endFill();
}

function drawStaticBoard(renderer, map) {
  const t = renderer.tile;
  const waterSet = new Set();
  for (const c of map.waterCells) waterSet.add(cellKey(c.x, c.y));
  const buildSet = new Set();
  for (const c of map.buildableCells) buildSet.add(cellKey(c.x, c.y));

  const gWater = new PIXI.Graphics();
  const gGround = new PIXI.Graphics();

  // ground cells in low/mid/high bands (skip water cells)
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (waterSet.has(cellKey(x, y))) continue;
      const band = y < map.rows / 3 ? 0 : (y < (2 * map.rows) / 3 ? 1 : 2);
      const shades = [0x33502c, 0x3c5c33, 0x45683a];
      gGround.beginFill(shades[band], 1);
      gGround.drawRect(x * t, y * t, t, t);
      gGround.endFill();
      if (buildSet.has(cellKey(x, y))) {
        gGround.beginFill(0x5a7a4a, 0.35);
        gGround.drawRect(x * t + 1, y * t + 1, t - 2, t - 2);
        gGround.endFill();
      }
    }
  }

  // water: sub-surface tint + lighter surface layer
  for (const c of map.waterCells) {
    gWater.beginFill(0x14395e, 1);
    gWater.drawRect(c.x * t, c.y * t, t, t);
    gWater.endFill();
    gWater.beginFill(0x2a6aa0, 0.65);
    gWater.drawRect(c.x * t, c.y * t, t, t * 0.45);
    gWater.endFill();
  }

  // grid lines
  gGround.lineStyle(1, 0x000000, 0.12);
  for (let x = 0; x <= map.cols; x++) {
    gGround.moveTo(x * t, 0); gGround.lineTo(x * t, map.rows * t);
  }
  for (let y = 0; y <= map.rows; y++) {
    gGround.moveTo(0, y * t); gGround.lineTo(map.cols * t, y * t);
  }
  gGround.lineStyle(0);

  // lane polylines
  const drawLane = (lane, color, alpha) => {
    if (!lane || lane.length < 2) return;
    gGround.lineStyle(3, color, alpha);
    const p0 = cellToLocal(renderer, lane[0].x, lane[0].y);
    gGround.moveTo(p0.x, p0.y);
    for (let i = 1; i < lane.length; i++) {
      const p = cellToLocal(renderer, lane[i].x, lane[i].y);
      gGround.lineTo(p.x, p.y);
    }
    gGround.lineStyle(0);
  };
  drawLane(map.groundLane, 0x8a6a3a, 0.5);
  drawLane(map.waterLane, 0x66aadd, 0.4);

  // hard-point slots
  for (const s of map.slots) {
    gGround.lineStyle(2, 0xd8d8a0, 0.7);
    gGround.drawRect(s.x * t + 3, s.y * t + 3, t - 6, t - 6);
    gGround.lineStyle(0);
  }

  // spawn markers
  const mark = (cell, color) => {
    if (!cell) return;
    const p = cellToLocal(renderer, cell.x, cell.y);
    gGround.beginFill(color, 0.8);
    gGround.drawCircle(p.x, p.y, t * 0.22);
    gGround.endFill();
  };
  mark(map.spawnGround, 0xd05040);
  mark(map.spawnWater, 0x4090d0);
  mark(map.spawnAir, 0xd0a040);

  // base marker
  if (map.base) {
    gGround.lineStyle(2, 0xe8d080, 0.9);
    gGround.drawRect(map.base.x * t + 2, map.base.y * t + 2, t - 4, t - 4);
    gGround.lineStyle(0);
  }

  renderer.layers.water.addChild(gWater);
  renderer.layers.ground.addChild(gGround);
}

export function createRenderer(app, map) {
  const tile = map.tile;
  const root = new PIXI.Container();
  app.stage.addChild(root);

  const layerNames = ['water', 'ground', 'structures', 'units', 'air', 'fx', 'overlay'];
  const layers = {};
  for (let i = 0; i < layerNames.length; i++) {
    const name = layerNames[i];
    const c = new PIXI.Container();
    layers[name] = c;
    root.addChild(c);
  }

  const renderer = {
    app: app,
    map: map,
    tile: tile,
    root: root,
    layers: layers,
    dyn: {
      structures: new PIXI.Graphics(),
      units: new PIXI.Graphics(),
      air: new PIXI.Graphics(),
      overlay: new PIXI.Graphics()
    },
    fxG: new PIXI.Graphics(),
    fxItems: []
  };

  layers.structures.addChild(renderer.dyn.structures);
  layers.units.addChild(renderer.dyn.units);
  layers.air.addChild(renderer.dyn.air);
  layers.fx.addChild(renderer.fxG);
  layers.overlay.addChild(renderer.dyn.overlay);

  drawStaticBoard(renderer, map);
  return renderer;
}

function spawnFx(renderer, ev) {
  const pos = ev.pos || ev.cell || (ev.target && ev.target.pos) || null;
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
  const p = cellToLocal(renderer, pos.x, pos.y);
  let color = 0xffffff, ttl = 0.4, kind = 'ring';
  switch (ev.type) {
    case 'kill': color = 0xe05040; ttl = 0.5; kind = 'ring'; break;
    case 'damage': color = 0xffe080; ttl = 0.2; kind = 'flash'; break;
    case 'coin': color = 0xf0c040; ttl = 0.6; kind = 'rise'; break;
    case 'build': color = 0x60d060; ttl = 0.5; kind = 'ring'; break;
    case 'spawn': color = 0x80b0ff; ttl = 0.35; kind = 'ring'; break;
    default: return;
  }
  renderer.fxItems.push({ x: p.x, y: p.y, age: 0, ttl: ttl, color: color, kind: kind });
}

function updateFx(renderer) {
  const g = renderer.fxG;
  g.clear();
  const t = renderer.tile;
  const keep = [];
  for (const fx of renderer.fxItems) {
    fx.age += FX_DT;
    if (fx.age >= fx.ttl) continue;
    const f = fx.age / fx.ttl;
    const alpha = 1 - f;
    if (fx.kind === 'ring') {
      g.lineStyle(2, fx.color, alpha);
      g.drawCircle(fx.x, fx.y, t * 0.2 + f * t * 0.6);
      g.lineStyle(0);
    } else if (fx.kind === 'flash') {
      g.beginFill(fx.color, alpha * 0.8);
      g.drawCircle(fx.x, fx.y, t * 0.15);
      g.endFill();
    } else if (fx.kind === 'rise') {
      g.beginFill(fx.color, alpha);
      g.drawCircle(fx.x, fx.y - f * t * 0.8, t * 0.12);
      g.endFill();
    }
    keep.push(fx);
  }
  renderer.fxItems = keep;
}

export function renderFrame(renderer, state, ui, events) {
  const t = renderer.tile;
  const gS = renderer.dyn.structures; gS.clear();
  const gU = renderer.dyn.units; gU.clear();
  const gA = renderer.dyn.air; gA.clear();
  const gO = renderer.dyn.overlay; gO.clear();

  if (!state) { updateFx(renderer); return; }

  // base
  if (state.base) {
    const bp = cellToLocal(renderer, state.base.pos.x, state.base.pos.y);
    gS.beginFill(0xc0a040, 1);
    gS.drawRect(bp.x - t * 0.4, bp.y - t * 0.4, t * 0.8, t * 0.8);
    gS.endFill();
    gS.lineStyle(2, 0xf0e0a0, 0.9);
    gS.drawRect(bp.x - t * 0.4, bp.y - t * 0.4, t * 0.8, t * 0.8);
    gS.lineStyle(0);
    drawHpBar(gS, bp.x, bp.y - t * 0.62, t * 0.9, state.base.hp / Math.max(1, state.base.maxHp));
  }

  // structures
  if (state.structures) {
    for (const s of state.structures.values()) {
      if (!s || s.lifecycle === 'Destroyed') continue;
      const fp = s.footprint || { w: 1, h: 1 };
      const px = s.pos.x * t;
      const py = s.pos.y * t;
      const w = fp.w * t;
      const h = fp.h * t;
      const color = KIND_COLORS[s.kind] != null ? KIND_COLORS[s.kind] : 0x888888;
      const building = s.lifecycle === 'Placing' || s.lifecycle === 'Building';
      const alpha = building ? 0.55 : (s.lifecycle === 'Selling' ? 0.4 : 1);
      gS.beginFill(color, alpha);
      gS.drawRect(px + 2, py + 2, w - 4, h - 4);
      gS.endFill();
      gS.lineStyle(1.5, 0x000000, 0.35 * alpha);
      gS.drawRect(px + 2, py + 2, w - 4, h - 4);
      gS.lineStyle(0);
      if (s.maxHp) {
        drawHpBar(gS, px + w / 2, py - 2, w * 0.8, s.hp / Math.max(1, s.maxHp));
      }
    }
  }

  // units (attackers = enemies) differentiated by shape + color
  // The sim stores ALL units in state.units keyed by `side` ('attacker' | 'defender'); there is no
  // state.attackers/state.troops collection. Read the real state seam and filter by side (mmdev-e56 seam fix).
  if (state.units) {
    for (const u of state.units.values()) {
      if (!u || u.side !== 'attacker' || u.dead || u.hp <= 0) continue;
      const def = getUnitDef ? getUnitDef(u.type || u.defId || u.kind) : null;
      const p = cellToLocal(renderer, u.pos.x, u.pos.y);
      const domain = (def && (def.domain || def.movement || def.movementDomain))
        || u.domain || u.movementDomain || null;
      const g = domain === 'flyer' ? gA : gU;
      const shape = enemyShapeFor(def, u);
      const color = enemyColorFor(def);
      const r = t * 0.3;
      if (domain === 'flyer') {
        // shadow beneath flyers for altitude read
        gU.beginFill(0x000000, 0.25);
        gU.drawEllipse(p.x, p.y + t * 0.18, r * 0.8, r * 0.35);
        gU.endFill();
      }
      drawEnemyShape(g, shape, p.x, p.y, r, color, 1);
      if (u.maxHp) {
        drawHpBar(g, p.x, p.y - t * 0.5, t * 0.7, u.hp / Math.max(1, u.maxHp));
      }
    }
  }

  // friendly troops (defenders) — also live in state.units, side === 'defender'
  if (state.units) {
    for (const u of state.units.values()) {
      if (!u || u.side !== 'defender' || u.dead || u.hp <= 0) continue;
      const p = cellToLocal(renderer, u.pos.x, u.pos.y);
      gU.beginFill(SIDE_COLORS.defender, 1);
      gU.drawCircle(p.x, p.y, t * 0.26);
      gU.endFill();
      gU.lineStyle(1.5, 0x000000, 0.35);
      gU.drawCircle(p.x, p.y, t * 0.26);
      gU.lineStyle(0);
      if (u.maxHp) {
        drawHpBar(gU, p.x, p.y - t * 0.45, t * 0.6, u.hp / Math.max(1, u.maxHp));
      }
    }
  }

  // projectiles
  if (state.projectiles) {
    for (const pr of state.projectiles.values ? state.projectiles.values() : state.projectiles) {
      if (!pr) continue;
      const p = cellToLocal(renderer, pr.pos.x, pr.pos.y);
      gA.beginFill(0xffffff, 0.9);
      gA.drawCircle(p.x, p.y, t * 0.08);
      gA.endFill();
    }
  }

  // selection / hover overlay
  if (ui && ui.selection) {
    const sel = ui.selection;
    if (sel.pos) {
      const p = cellToLocal(renderer, sel.pos.x, sel.pos.y);
      drawDashedCircle(gO, p.x, p.y, t * 0.5, 0xffffff, 0.8, 2);
      if (sel.range) {
        drawDashedCircle(gO, p.x, p.y, sel.range * t, 0xffe080, 0.5, 1.5);
      }
    }
  }

  // events -> fx
  if (events && events.length) {
    for (const ev of events) spawnFx(renderer, ev);
  }
  updateFx(renderer);
}

export function cellToScreen(renderer, cx, cy) {
  const t = renderer.tile;
  return { x: (cx + 0.5) * t, y: (cy + 0.5) * t };
}

export function screenToCell(renderer, sx, sy) {
  const t = renderer.tile;
  return { x: Math.floor(sx / t), y: Math.floor(sy / t) };
}

export default { createRenderer, renderFrame, cellToScreen, screenToCell };