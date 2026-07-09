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

  // base marker — s10: outline each cell of the 3x3 keep
  if (map.base) {
    gGround.lineStyle(2, 0xe8d080, 0.9);
    const cells = map.base.cells || [{ x: map.base.x, y: map.base.y }];
    for (const bc of cells) gGround.drawRect(bc.x * t + 2, bc.y * t + 2, t - 4, t - 4);
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
    fxItems: [],
    shake: { time: 0, dur: 0, mag: 0 },
    baseFire: null,
    baseFirePos: null
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
  const pos = ev.pos || ev.cell
    || (ev.target && ev.target.pos) || (ev.target && ev.target.cell)
    || (ev.ent && ev.ent.pos) || (ev.ent && ev.ent.cell)
    || (ev.structure && ev.structure.pos) || (ev.structure && ev.structure.cell)
    || (ev.base && ev.base.pos) || (ev.base && ev.base.cell)
    || (renderer.map && renderer.map.base)
    || null;
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
  const p = cellToLocal(renderer, pos.x, pos.y);
  // Gold gain on a kill: a floating "+N" that rises + fades AT the unit that died (moved off the HUD header).
  if (ev.type === 'coin') {
    const amt = Math.round(ev.amount || 0);
    if (amt <= 0) return;
    let txt = null;
    try {
      txt = new PIXI.Text('+' + amt, { fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold',
                                       fill: 0x8fff8f, stroke: 0x0c220c, strokeThickness: 3 });
      if (txt.anchor && txt.anchor.set) txt.anchor.set(0.5, 1);
      txt.x = p.x; txt.y = p.y - renderer.tile * 0.3;
      renderer.layers.fx.addChild(txt);
    } catch (e) { txt = null; }
    renderer.fxItems.push({ x: p.x, y: p.y, age: 0, ttl: 0.9, kind: 'text', txt: txt });
    return;
  }
  if (ev.type === 'baseDestroyed' || ev.type === 'baseDestroy' || ev.type === 'gameOver' || (ev.type === 'destroy' && ev.isBase)) {
    renderer.shake.time = 0; renderer.shake.dur = 0.8; renderer.shake.mag = renderer.tile * 0.7;
    renderer.baseFire = 3.0; renderer.baseFirePos = { x: p.x, y: p.y };
    return;
  }
  if (ev.type === 'structureDestroyed' || ev.type === 'structureDestroy' || (ev.type === 'destroy' && !ev.isBase)) {
    renderer.shake.time = 0; renderer.shake.dur = 0.25; renderer.shake.mag = renderer.tile * 0.18;
    return;
  }
  let color = 0xffffff, ttl = 0.4, kind = 'ring';
  switch (ev.type) {
    case 'kill': color = 0xe05040; ttl = 0.5; kind = 'ring'; break;
    case 'damage': color = 0xffe080; ttl = 0.2; kind = 'flash'; break;
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

  // camera shake: decays over its duration and offsets the whole board root
  if (renderer.shake && renderer.shake.dur > 0) {
    renderer.shake.time += FX_DT;
    const sf = 1 - renderer.shake.time / renderer.shake.dur;
    if (sf <= 0) {
      renderer.shake.dur = 0;
      renderer.root.x = 0; renderer.root.y = 0;
    } else {
      const m = renderer.shake.mag * sf;
      renderer.root.x = (Math.random() * 2 - 1) * m;
      renderer.root.y = (Math.random() * 2 - 1) * m;
    }
  }

  // base fire: spawn fresh flame particles while the timer is active
  if (renderer.baseFire > 0 && renderer.baseFirePos) {
    renderer.baseFire -= FX_DT;
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() * 2 - 1) * t * 0.4;
      renderer.fxItems.push({
        x: renderer.baseFirePos.x + ox,
        y: renderer.baseFirePos.y + (Math.random() * 2 - 1) * t * 0.3,
        age: 0, ttl: 0.4 + Math.random() * 0.3,
        color: Math.random() < 0.5 ? 0xff6020 : 0xffc040,
        kind: 'fire'
      });
    }
  }
  const keep = [];
  for (const fx of renderer.fxItems) {
    fx.age += FX_DT;
    if (fx.age >= fx.ttl) {
      if (fx.txt && fx.txt.parent) fx.txt.parent.removeChild(fx.txt);   // free the floating-text object
      continue;
    }
    const f = fx.age / fx.ttl;
    const alpha = 1 - f;
    if (fx.kind === 'text') {
      if (fx.txt) { fx.txt.y = fx.y - t * (0.3 + f * 1.1); fx.txt.alpha = alpha; }   // rise + fade at the unit
    } else if (fx.kind === 'ring') {
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
    } else if (fx.kind === 'fire') {
      g.beginFill(fx.color, alpha * 0.9);
      g.drawCircle(fx.x, fx.y - f * t * 0.7, t * 0.18 * (1 - f * 0.5));
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

  // base — s10: a 3x3 keep drawn as its body cells (the 4 corners are tower slots, drawn by the board)
  if (state.base) {
    const cells = state.base.cells || [state.base.pos];
    gS.beginFill(0xc0a040, 1);
    for (const bc of cells) {
      const cp = cellToLocal(renderer, bc.x, bc.y);
      gS.drawRect(cp.x - t * 0.46, cp.y - t * 0.46, t * 0.92, t * 0.92);
    }
    gS.endFill();
    const bp = cellToLocal(renderer, state.base.pos.x, state.base.pos.y);
    gS.lineStyle(2, 0xf0e0a0, 0.9);
    gS.drawRect(bp.x - t * 1.5, bp.y - t * 1.5, t * 3, t * 3);   // keep outline
    gS.lineStyle(0);
    drawHpBar(gS, bp.x, bp.y - t * 1.72, t * 2.2, state.base.hp / Math.max(1, state.base.maxHp));
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
      gS.lineStyle(1.5, 0x101418, 0.8);
      gS.drawRect(px + 2, py + 2, w - 4, h - 4);
      gS.lineStyle(0);
      // tier pips
      const tier = s.tier || 1;
      for (let i = 0; i < tier; i++) {
        gS.beginFill(0xffffff, 0.9);
        gS.drawCircle(px + 6 + i * 6, py + h - 6, 2);
        gS.endFill();
      }
      // progress bar
      if (s.lifecycle === 'Building' || s.lifecycle === 'Upgrading' || s.lifecycle === 'Selling') {
        const frac = Math.max(0, Math.min(1, typeof s.progress === 'number' ? s.progress : 0));
        gS.beginFill(0x000000, 0.6);
        gS.drawRect(px + 3, py + h / 2 - 2, w - 6, 4);
        gS.endFill();
        gS.beginFill(0x60c0ff, 0.95);
        gS.drawRect(px + 3.5, py + h / 2 - 1.5, (w - 7) * frac, 3);
        gS.endFill();
      }
      // hp bar
      if (typeof s.hp === 'number' && typeof s.maxHp === 'number' && s.hp < s.maxHp) {
        drawHpBar(gS, px + w / 2, py - 6, w - 4, s.hp / Math.max(1, s.maxHp));
      }
    }
  }

  // units
  if (state.units) {
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      const side = u.side || u.kind || 'attacker';
      const color = SIDE_COLORS[side] != null ? SIDE_COLORS[side] : 0xffffff;
      const p = cellToLocal(renderer, u.pos.x, u.pos.y);
      const r = t * 0.28;
      if (u.domain === 'Flyer') {
        const py = p.y - t * 0.35;
        gA.beginFill(color, 1);
        gA.moveTo(p.x, py - r);
        gA.lineTo(p.x + r, py + r);
        gA.lineTo(p.x - r, py + r);
        gA.closePath();
        gA.endFill();
        gA.lineStyle(1, 0x101418, 0.7);
        gA.drawCircle(p.x, p.y, 2);
        gA.lineStyle(0);
        drawHpBar(gA, p.x, py - r - 7, t * 0.7, u.hp / Math.max(1, u.maxHp));
      } else if (u.domain === 'Floater') {
        gU.beginFill(color, 1);
        gU.drawEllipse(p.x, p.y, r * 1.15, r * 0.7);
        gU.endFill();
        gU.lineStyle(1, 0x101418, 0.8);
        gU.drawEllipse(p.x, p.y, r * 1.15, r * 0.7);
        gU.lineStyle(0);
        drawHpBar(gU, p.x, p.y - r - 8, t * 0.7, u.hp / Math.max(1, u.maxHp));
      } else {
        gU.beginFill(color, 1);
        gU.drawCircle(p.x, p.y, r);
        gU.endFill();
        gU.lineStyle(1, 0x101418, 0.8);
        gU.drawCircle(p.x, p.y, r);
        gU.lineStyle(0);
        drawHpBar(gU, p.x, p.y - r - 8, t * 0.7, u.hp / Math.max(1, u.maxHp));
      }
    }
  }

  // selection range circle
  if (ui && ui.selectedStructureId != null && state.structures) {
    const sel = state.structures.get(ui.selectedStructureId);
    if (sel) {
      const fp = sel.footprint || { w: 1, h: 1 };
      const cx = (sel.pos.x + fp.w / 2) * t;
      const cy = (sel.pos.y + fp.h / 2) * t;
      gO.lineStyle(2, 0xffffff, 0.9);
      gO.drawRect(sel.pos.x * t + 1, sel.pos.y * t + 1, fp.w * t - 2, fp.h * t - 2);
      gO.lineStyle(0);
      let range = 0;
      try {
        const def = getStructureDef(sel.structId);
        range = def && typeof def.range === 'number' ? def.range : 0;
      } catch (e) { range = 0; }
      if (range > 0) {
        drawDashedCircle(gO, cx, cy, range * t, 0xffffff, 0.6, 1.5);
      }
    }
  }

  // ghost preview
  if (ui && ui.buildSelection && ui.hoverCell) {
    let fp = { w: 1, h: 1 };
    try {
      const def = getStructureDef(ui.buildSelection);
      if (def && def.footprint) fp = def.footprint;
    } catch (e) { /* unknown struct id: default footprint */ }
    const ok = !!ui.hoverValid;
    const tint = ok ? 0x40e060 : 0xe04040;
    const gx = ui.hoverCell.x * t;
    const gy = ui.hoverCell.y * t;
    gO.beginFill(tint, 0.35);
    gO.drawRect(gx, gy, fp.w * t, fp.h * t);
    gO.endFill();
    gO.lineStyle(2, tint, 0.9);
    gO.drawRect(gx + 1, gy + 1, fp.w * t - 2, fp.h * t - 2);
    gO.lineStyle(0);
  }

  // event FX
  if (events && events.length) {
    for (const ev of events) spawnFx(renderer, ev);
  }
  updateFx(renderer);
}

export function screenToCell(renderer, sx, sy) {
  const t = renderer.tile;
  const x = Math.max(0, Math.min(renderer.map.cols - 1, Math.floor(sx / t)));
  const y = Math.max(0, Math.min(renderer.map.rows - 1, Math.floor(sy / t)));
  return { x: x, y: y };
}

export function cellToScreen(renderer, cell) {
  const t = renderer.tile;
  return { x: (cell.x + 0.5) * t, y: (cell.y + 0.5) * t };
}
