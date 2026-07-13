import { getStructureDef, getUnitDef } from '../data/tables.js';
import { hasArt, buildUnitSprite } from './unitArt.js';
import { layerLean } from '../harness/camera.js';
import { SPRITE_OVER_COLLISION } from '../harness/parts.js';

const FX_DT = 1 / 60;

// Unit sprites rotate to face their MOVEMENT heading. The DEFINITIVE convention (matches the State Tool's
// FORWARD gizmo + its "up-facing art → aim+90°" rule): art authored to point UP is forward, so pointing it at a
// world heading needs +90°. Every unit authored against the tool's forward arrow lands correctly with this.
const UNIT_FACING_OFFSET = Math.PI / 2;
// Shortest-arc angle approach for smooth turning (no snapping, handles wrap).
function approachAngle(cur, target, rate) {
  let d = target - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return cur + d * rate;
}

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

// Per-faction colours so the 9 factions read distinctly on the board (attackers are tinted by their faction;
// player-deployed defenders stay blue). Mirrors the faction identities in the balance doc.
const FACTION_COLORS = {
  'Ground / Powder': 0x9bd15a,
  'Air': 0x7fd6e0,
  'High Tech': 0xc9c98a,
  'Artillery': 0xb98aa2,
  'Water': 0x5abed1,
  'Arcane / Energy': 0xff9a5f,
  'Space Tech': 0xd6d6ff,
  'Dark Energy': 0xb060d0,
  'Greenies (Chem)': 0x8fe04a
};
function unitColor(u) {
  if ((u.side || 'attacker') === 'attacker' && u.faction && FACTION_COLORS[u.faction] != null) return FACTION_COLORS[u.faction];
  return SIDE_COLORS[u.side || u.kind || 'attacker'] != null ? SIDE_COLORS[u.side || u.kind || 'attacker'] : 0xffffff;
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

  // ground cells in low/mid/high bands (skip water cells); the SAFE BORDER outside map.playArea
  // is approach terrain — darker, never buildable-tinted
  const pa = map.playArea || null;
  const inPlay = (x, y) => !pa || (x >= pa.x0 && x <= pa.x1 && y >= pa.y0 && y <= pa.y1);
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (waterSet.has(cellKey(x, y))) continue;
      const band = y < map.rows / 3 ? 0 : (y < (2 * map.rows) / 3 ? 1 : 2);
      const shades = inPlay(x, y) ? [0x33502c, 0x3c5c33, 0x45683a] : [0x1f2b1c, 0x24321f, 0x293823];
      gGround.beginFill(shades[band], 1);
      gGround.drawRect(x * t, y * t, t, t);
      gGround.endFill();
      if (inPlay(x, y) && buildSet.has(cellKey(x, y))) {
        gGround.beginFill(0x5a7a4a, 0.35);
        gGround.drawRect(x * t + 1, y * t + 1, t - 2, t - 2);
        gGround.endFill();
      }
    }
  }
  if (pa) {   // battlefield outline
    gGround.lineStyle(2, 0xcfe3a0, 0.5);
    gGround.drawRect(pa.x0 * t + 1, pa.y0 * t + 1, (pa.x1 - pa.x0 + 1) * t - 2, (pa.y1 - pa.y0 + 1) * t - 2);
    gGround.lineStyle(0);
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

  // structHp is SECOND-highest by contract: structure/base health bars must always read over units,
  // air, and FX. 'fog' is reserved as the permanent TOP layer for fog of war.
  // 'resources' sits ABOVE ground, BELOW structures/units — crystals grow out of the terrain and
  // everything that moves or is built stands on top of them.
  const layerNames = ['water', 'ground', 'resources', 'structures', 'units', 'air', 'fx', 'overlay', 'structHp', 'fog'];
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
      overlay: new PIXI.Graphics(),
      structHp: new PIXI.Graphics()
    },
    fxG: new PIXI.Graphics(),
    fxItems: [],
    flames: [],            // live burning-wreck flame EMITTERS (particle-based, CSP-safe) — see spawnFlame/updateFlames
    shake: { time: 0, dur: 0, mag: 0 },
    baseFire: null,
    baseFirePos: null,
    // Authored unit ART: a retained sprite per live unit that has art (built lazily, keyed by unit.id),
    // sitting above the primitive Graphics. `unitArt` is set by main.js once loadUnitArt() resolves.
    unitArt: null,
    unitSprites: new Map(),
    unitSpriteLayer: new PIXI.Container(),
    // Resource ART (crystal_resources sheet): a retained sprite per live node, keyed by node id.
    resourceArt: null,
    resourceSprites: new Map()
  };

  layers.structures.addChild(renderer.dyn.structures);
  layers.units.addChild(renderer.dyn.units);
  layers.units.addChild(renderer.unitSpriteLayer);   // sprites draw over the primitive unit layer
  layers.air.addChild(renderer.dyn.air);
  layers.fx.addChild(renderer.fxG);
  layers.overlay.addChild(renderer.dyn.overlay);
  layers.structHp.addChild(renderer.dyn.structHp);

  // Reusable FX spawners for callers outside the event pipeline (take CELL coords, e.g. scripted FX).
  renderer.spawnFireAt = (cellX, cellY, count, scale) => {
    const q = cellToLocal(renderer, cellX, cellY);
    spawnFireClump(renderer, q.x, q.y, count, scale);
  };
  renderer.spawnFlameAt = (cellX, cellY, scale, ttl) => {
    const q = cellToLocal(renderer, cellX, cellY);
    spawnFlame(renderer, q.x, q.y, scale, ttl);
  };

  // Crystal resource sheet — loaded lazily; nodes render as primitive circles until (and if) it lands.
  // Maps with no resources never need it, so the fetch failure path is silent.
  if (map.resources && map.resources.length) {
    import('../harness/atlas.js')
      .then(({ loadAtlasFromUrl }) => loadAtlasFromUrl('crystal_resources.png'))
      .then((art) => { renderer.resourceArt = art; })
      .catch((e) => console.warn('[resourceArt] skipped:', e && e.message));
  }

  drawStaticBoard(renderer, map);
  return renderer;
}

// Rising gold "+Ng" text at a kill/deposit — the visible score of the moment. PIXI.Text objects,
// pooled per float, retired after ttl.
function spawnGoldFloat(renderer, x, y, label) {
  const t = new PIXI.Text(label, { fontFamily: 'Courier New', fontSize: Math.max(13, renderer.tile * 0.28),
    fontWeight: 'bold', fill: 0xffd76a, stroke: 0x0a0e12, strokeThickness: 3 });
  t.anchor && t.anchor.set(0.5, 1);
  t.x = x; t.y = y - renderer.tile * 0.3;
  renderer.layers.structHp.addChild(t);   // above units/FX so the score always reads
  (renderer.goldFloats || (renderer.goldFloats = [])).push({ t, age: 0, ttl: 1.1 });
}
function updateGoldFloats(renderer, dt) {
  if (!renderer.goldFloats || !renderer.goldFloats.length) return;
  const keep = [];
  for (const f of renderer.goldFloats) {
    f.age += dt;
    const p = f.age / f.ttl;
    if (p >= 1) { if (f.t.parent) f.t.parent.removeChild(f.t); f.t.destroy(); continue; }
    f.t.y -= dt * renderer.tile * 0.9;
    f.t.alpha = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
    keep.push(f);
  }
  renderer.goldFloats = keep;
}

// ── Burning-wreck FLAME (particle EMITTER — Graphics only, NO custom GL shader) ───────────────────────────
// A strict Content-Security-Policy blocks `eval`/`new Function`, and PIXI.Shader.from generates its uniform
// uploader with new Function — so a custom-shader flame trips CSP. Instead a flame is a short-lived EMITTER that
// throws up flickering, colour-ramped flame particles + smoke every frame for its whole life (fed through the
// existing 'fire'/'smoke' Graphics draw). It reads as a LIVING fire, burns for `ttl` seconds, and scales with
// `scale`. Render-only + non-deterministic (Math.random); FX never feed the sim, so replays are unaffected.
function spawnFlame(renderer, x, y, scale, ttl) {
  const s = scale || 1;
  renderer.flames.push({ x: x, y: y, scale: s, age: 0, ttl: ttl || 4.0, emit: 0 });
  spawnFireClump(renderer, x, y, Math.round(6 * s), s);   // instant burst so it appears the moment it dies
}

function updateFlames(renderer) {
  if (!renderer.flames || !renderer.flames.length) return;
  const t = renderer.tile;
  const dt = renderer._fxDt || FX_DT;
  const keep = [];
  for (const fl of renderer.flames) {
    fl.age += dt;
    const f = fl.age / fl.ttl;
    if (f >= 1) continue;
    const s = fl.scale;
    const intensity = 1 - f * 0.72;                       // the fire dies down over its life
    // FLAME particles — rate scales with size; fractional accumulator keeps it smooth
    fl.emit += dt * (30 * s) * intensity;                 // particles per second
    while (fl.emit >= 1) {
      fl.emit -= 1;
      const ang = Math.random() * Math.PI * 2, spd = Math.random();
      renderer.fxItems.push({
        x: fl.x + (Math.random() * 2 - 1) * t * 0.30 * s,
        y: fl.y + (Math.random() * 2 - 1) * t * 0.16 * s,
        vx: Math.cos(ang) * spd * t * 0.22 * s,
        rise: (0.9 + Math.random() * 1.3) * t * s,
        size: t * (0.12 + Math.random() * 0.20) * s * (0.6 + 0.4 * intensity),
        age: 0, ttl: 0.35 + Math.random() * 0.5,
        color: FIRE_COLORS[(Math.random() * FIRE_COLORS.length) | 0],
        kind: 'fire',
      });
    }
    // occasional rising SMOKE for weight
    if (Math.random() < 0.45) {
      renderer.fxItems.push({
        x: fl.x + (Math.random() * 2 - 1) * t * 0.24 * s,
        y: fl.y + (Math.random() * 2 - 1) * t * 0.14 * s,
        vx: (Math.random() * 2 - 1) * t * 0.08 * s,
        rise: (1.1 + Math.random() * 1.0) * t * s,
        size: t * (0.20 + Math.random() * 0.24) * s,
        age: 0, ttl: 0.7 + Math.random() * 0.7,
        color: 0x2b2622, kind: 'smoke',
      });
    }
    keep.push(fl);
  }
  renderer.flames = keep;
}

// Spawn a CLUMP of fire particles (flames + a little smoke + a bright seat flash) at a board-LOCAL point — the
// reusable "burning wreck" burst dropped where units/structures are destroyed. Render-only and intentionally
// non-deterministic (Math.random for variation); FX never feed the sim, so this can't affect replays.
// Reusable: also exposed as renderer.spawnFireClump(localX, localY, count, scale).
const FIRE_COLORS = [0xff4a15, 0xff6a1e, 0xff8a2a, 0xffb63c, 0xffd85c];
function spawnFireClump(renderer, x, y, count, scale) {
  const t = renderer.tile, n = (count == null ? 10 : count), s = scale || 1;   // count 0 → smoke + flash only
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2, spd = Math.random();
    renderer.fxItems.push({
      x: x + (Math.random() * 2 - 1) * t * 0.28 * s,
      y: y + (Math.random() * 2 - 1) * t * 0.22 * s,
      vx: Math.cos(ang) * spd * t * 0.35 * s,
      rise: (0.5 + Math.random() * 1.0) * t * s,
      size: t * (0.11 + Math.random() * 0.17) * s,
      age: 0, ttl: 0.35 + Math.random() * 0.55,
      color: FIRE_COLORS[(Math.random() * FIRE_COLORS.length) | 0],
      kind: 'fire',
    });
  }
  const smoke = Math.max(2, (n / 3) | 0);
  for (let i = 0; i < smoke; i++) {
    renderer.fxItems.push({
      x: x + (Math.random() * 2 - 1) * t * 0.22 * s,
      y: y + (Math.random() * 2 - 1) * t * 0.16 * s,
      vx: (Math.random() * 2 - 1) * t * 0.1 * s,
      rise: (0.9 + Math.random() * 0.9) * t * s,
      size: t * (0.18 + Math.random() * 0.22) * s,
      age: 0, ttl: 0.6 + Math.random() * 0.6,
      color: 0x2b2622, kind: 'smoke',
    });
  }
  renderer.fxItems.push({ x: x, y: y, age: 0, ttl: 0.18, color: 0xffe6a0, kind: 'flash' });   // bright seat flash
}

// Welding SPARKS thrown while a repair bot works a structure: they launch UP with random spread, then arc back
// DOWN under gravity, brightness fading and colour cooling to ember-red as they fall. Render-only (Math.random).
const SPARK_COLORS = [0xffffe0, 0xfff0a0, 0xffd050, 0xffa838];
const SPARK_GRAVITY_TILES = 10;   // downward accel in tiles/sec^2 → sparks fall back after their upward launch
function spawnSparks(renderer, x, y, count) {
  const t = renderer.tile, n = count || 5;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (Math.random() * 2 - 1) * 1.0;   // mostly UP, wide fan
    const spd = (1.0 + Math.random() * 2.2) * t;                 // launch speed (px/sec)
    renderer.fxItems.push({
      x: x + (Math.random() * 2 - 1) * t * 0.28,
      y: y + (Math.random() * 2 - 1) * t * 0.1,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,                                   // negative = upward launch
      age: 0, ttl: 0.4 + Math.random() * 0.5,
      color: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
      kind: 'spark',
    });
  }
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
  // Base death / game over → big shake + base fire. The sim signals this as the game-over result ('lose'); the
  // old 'baseDestroyed'/'gameOver' names were never emitted, so the shake never fired. (mmdev)
  if (ev.type === 'lose' || ev.type === 'baseDestroyed' || ev.type === 'gameOver' || (ev.type === 'destroy' && ev.isBase)) {
    renderer.shake.time = 0; renderer.shake.dur = 0.8; renderer.shake.mag = renderer.tile * 0.7;
    renderer.baseFire = 3.0; renderer.baseFirePos = { x: p.x, y: p.y };
    return;
  }
  // Structure destroyed → small shake + debris ring. The sim emits type:'destroyed' (combat.js); the old
  // 'structureDestroyed' name was never emitted. (mmdev)
  if (ev.type === 'destroyed' || ev.type === 'structureDestroyed' || (ev.type === 'destroy' && !ev.isBase)) {
    renderer.shake.time = 0; renderer.shake.dur = 0.25; renderer.shake.mag = renderer.tile * 0.18;
    renderer.fxItems.push({ x: p.x, y: p.y, age: 0, ttl: 0.5, color: 0xe05040, kind: 'ring' });
    spawnFlame(renderer, p.x, p.y, 2.2, 5.0);   // a structure is bigger than a unit → a larger, ~5s fire
    return;
  }
  // ── Base SUPER-CANNON visuals ──
  if (ev.type === 'cannonAim') {
    const a = cellToLocal(renderer, ev.pos.x, ev.pos.y);
    renderer.fxItems.push({ x: a.x, y: a.y, age: 0, ttl: ev.dur || 3, kind: 'reticle', radius: ev.radius || 2.5 });
    return;
  }
  if (ev.type === 'cannonShot') {
    const a = cellToLocal(renderer, ev.from.x, ev.from.y), b = cellToLocal(renderer, ev.to.x, ev.to.y);
    // carry the blast radius on the shell so the detonation fires the INSTANT its arc lands (see updateFx),
    // keeping the explosion locked to the visual touchdown instead of a separately-timed sim event.
    renderer.fxItems.push({ x: a.x, y: a.y, fx: a.x, fy: a.y, tx: b.x, ty: b.y, age: 0, ttl: ev.dur || 1.6, kind: 'shell', radius: ev.radius || 2.5 });
    renderer.fxItems.push({ x: a.x, y: a.y, age: 0, ttl: 0.25, color: 0xfff0b0, kind: 'flash' });   // muzzle flash
    return;
  }
  // NB: the sim still emits 'cannonImpact' (it drives the AOE damage), but the VISUAL blast is spawned by the
  // shell the moment it hits the ground (updateFx) so the explosion can never lag the landing.
  let color = 0xffffff, ttl = 0.4, kind = 'ring';
  switch (ev.type) {
    case 'kill': color = 0xe05040; ttl = 0.5; kind = 'ring'; break;
    case 'damage': color = 0xffe080; ttl = 0.2; kind = 'flash'; break;
    case 'build': color = 0x60d060; ttl = 0.5; kind = 'ring'; break;
    case 'spawn': color = 0x80b0ff; ttl = 0.35; kind = 'ring'; break;
    default: return;
  }
  renderer.fxItems.push({ x: p.x, y: p.y, age: 0, ttl: ttl, color: color, kind: kind });
  // burning wreckage scaled to the UNIT's size (0.28-radius unit → scale ~1), so the fire fits the unit instead
  // of a fixed oversized blob. ~4s burn.
  // owner tuning (2026-07-13): unit wreck fires shrunk 60% — full radius-scale flames dwarfed the units
  if (ev.type === 'kill') {
    spawnFlame(renderer, p.x, p.y, ((ev.radius || 0.28) / 0.28) * 0.4, 4.0);
    // the SCORE of the kill: a rising "+Ng" at the wreck (every attacker kill pays a bounty)
    if (ev.income > 0) spawnGoldFloat(renderer, p.x, p.y, '+' + Math.round(ev.income) + 'g');
  }
}

function updateFx(renderer) {
  updateFlames(renderer);   // advance flame emitters
  updateGoldFloats(renderer, FX_DT);   // rising +Ng kill-score texts (same fixed FX clock as particles)
  const g = renderer.fxG;
  g.clear();
  const t = renderer.tile;
  const dt = renderer._fxDt || FX_DT;   // REAL frame time so FX track the real-time sim

  // camera shake: decays over its duration and offsets the whole board root
  if (renderer.shake && renderer.shake.dur > 0) {
    renderer.shake.time += dt;
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
    renderer.baseFire -= dt;
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
  const spawned = [];
  for (const fx of renderer.fxItems) {
    fx.age += dt;
    if (fx.age >= fx.ttl) {
      if (fx.txt && fx.txt.parent) fx.txt.parent.removeChild(fx.txt);   // free the floating-text object
      if (fx.kind === 'shell') {
        // the shell has completed its arc and HIT THE GROUND — detonate NOW, exactly at the impact point. With FX
        // on real frame-time this lands on the same tick the sim applies the AOE damage (no explosion/damage lag).
        spawned.push({ x: fx.tx, y: fx.ty, age: 0, ttl: 0.6, kind: 'blast', radius: (fx.radius || 2.5) * 0.5 });   // 50% smaller blast
        renderer.shake.time = 0; renderer.shake.dur = 0.4; renderer.shake.mag = renderer.tile * 0.5;
        // scatter 10-20 small fires at RANDOM points within the AOE radius (sqrt→uniform over the disk, not a
        // ring) to show the blast footprint. Pushed straight to the flame emitters (safe during this fxItems loop).
        const aoePx = (fx.radius || 2.5) * t;
        const nFires = 10 + (Math.random() * 11 | 0);
        for (let k = 0; k < nFires; k++) {
          const rr = Math.sqrt(Math.random()) * aoePx, aa = Math.random() * Math.PI * 2;
          renderer.flames.push({ x: fx.tx + Math.cos(aa) * rr, y: fx.ty + Math.sin(aa) * rr,
            scale: 0.28 + Math.random() * 0.22, age: 0, ttl: 1.0 + Math.random() * 1.3, emit: 0 });
        }
      }
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
      const rise = (fx.rise != null) ? fx.rise : t * 0.7;
      const sz = (fx.size != null) ? fx.size : t * 0.18;
      const fxp = fx.x + (fx.vx || 0) * f;
      g.beginFill(fx.color, alpha * 0.92);
      g.drawCircle(fxp, fx.y - f * rise, sz * (1 - f * 0.6));   // flame floats up + shrinks
      g.endFill();
    } else if (fx.kind === 'smoke') {
      const rise = (fx.rise != null) ? fx.rise : t * 0.9;
      const sz = (fx.size != null) ? fx.size : t * 0.25;
      const fxp = fx.x + (fx.vx || 0) * f;
      g.beginFill(fx.color, (1 - f) * 0.32);
      g.drawCircle(fxp, fx.y - f * rise, sz * (0.6 + f));       // smoke expands as it rises
      g.endFill();
    } else if (fx.kind === 'spark') {
      // integrate velocity + GRAVITY so the spark launches up then falls; brightness + colour decay as it cools
      fx.vy += SPARK_GRAVITY_TILES * t * dt;
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      const b = 1 - f;                                  // brightness/heat fades over life
      const col = b > 0.45 ? fx.color : 0xff5416;       // cools to ember-red as it dies
      g.lineStyle(Math.max(1, t * 0.03 * b), col, 0.35 + 0.55 * b);   // short motion streak
      g.moveTo(fx.x, fx.y); g.lineTo(fx.x - fx.vx * dt * 2.5, fx.y - fx.vy * dt * 2.5);
      g.lineStyle(0);
      g.beginFill(col, 0.5 + 0.5 * b);
      g.drawCircle(fx.x, fx.y, t * 0.05 * (0.45 + b));
      g.endFill();
    } else if (fx.kind === 'reticle') {
      // pulsing target where the super-cannon will land (aim telegraph)
      const pulse = 0.5 + 0.5 * Math.sin(fx.age * 9);
      g.lineStyle(2, 0xff5030, 0.45 + 0.45 * pulse);
      g.drawCircle(fx.x, fx.y, fx.radius * t);
      g.moveTo(fx.x - fx.radius * t, fx.y); g.lineTo(fx.x + fx.radius * t, fx.y);
      g.moveTo(fx.x, fx.y - fx.radius * t); g.lineTo(fx.x, fx.y + fx.radius * t);
      g.lineStyle(0);
    } else if (fx.kind === 'shell') {
      // the 3D arcing shell: ground point lerps from→to; a sine arc lifts it off the plane, shadow tracks below
      const gx = fx.fx + (fx.tx - fx.fx) * f, gy = fx.fy + (fx.ty - fx.fy) * f;
      const h = Math.sin(f * Math.PI) * t * 2.4;
      g.beginFill(0x000000, 0.30 * (1 - Math.sin(f * Math.PI) * 0.55));
      g.drawEllipse(gx, gy, t * 0.16, t * 0.09); g.endFill();          // shadow on the ground
      g.beginFill(0xff9030, 0.9); g.drawCircle(gx, gy - h, t * 0.18); g.endFill();   // shell glow
      g.beginFill(0xffe090, 1); g.drawCircle(gx, gy - h, t * 0.11); g.endFill();     // shell core
      g.beginFill(0xffffff, 0.85); g.drawCircle(gx, gy - h, t * 0.05); g.endFill();
    } else if (fx.kind === 'blast') {
      // massive AOE detonation: bright fireball fading + an expanding shockwave ring
      g.beginFill(0xffce70, alpha * 0.5); g.drawCircle(fx.x, fx.y, fx.radius * t * (0.35 + f * 0.85)); g.endFill();
      g.beginFill(0xff5020, alpha * 0.45); g.drawCircle(fx.x, fx.y, fx.radius * t * (0.15 + f * 0.5)); g.endFill();
      g.lineStyle(3, 0xff7030, alpha); g.drawCircle(fx.x, fx.y, fx.radius * t * f); g.lineStyle(0);
    }
    keep.push(fx);
  }
  renderer.fxItems = spawned.length ? keep.concat(spawned) : keep;
}

export function renderFrame(renderer, state, ui, events, frameDt) {
  // FX advance by REAL frame time (clamped) so the shell arc + blast land exactly when the sim applies damage —
  // a fixed 1/60 step drifted from the real-time sim whenever the frame rate wasn't 60fps (explosion/damage lag).
  renderer._fxDt = (typeof frameDt === 'number' && frameDt > 0) ? Math.min(frameDt, 1 / 20) : FX_DT;
  const t = renderer.tile;
  const gS = renderer.dyn.structures; gS.clear();
  const gU = renderer.dyn.units; gU.clear();
  const gA = renderer.dyn.air; gA.clear();
  const gO = renderer.dyn.overlay; gO.clear();
  const gH = renderer.dyn.structHp; gH.clear();   // structure/base HP bars — second-highest layer (under fog only)

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
    drawHpBar(gH, bp.x, bp.y - t * 1.72, t * 2.2, state.base.hp / Math.max(1, state.base.maxHp));

    // ── SUPER-CANNON TURRET — a visible barrel + charge gauge showing the cannon's live STATE ──
    //   idle: steel barrel slowly SCANS the field  ·  aim: swings onto the locked target, glows + a ring
    //   charges up  ·  flight: recoiled, bright muzzle  ·  cooldown: dim/red, barrel resets.
    const cannon = state.base.cannon;
    if (cannon) {
      renderer.cannonScan = (renderer.cannonScan || 0) + 0.02;
      const aiming = (cannon.phase === 'aim' || cannon.phase === 'flight') && cannon.aimPos;
      let ang, col, glow, len = t * 1.15;
      if (aiming) { const ap = cellToLocal(renderer, cannon.aimPos.x, cannon.aimPos.y); ang = Math.atan2(ap.y - bp.y, ap.x - bp.x); }
      else { ang = renderer.cannonScan; }
      if (cannon.phase === 'aim') { const p = 0.5 + 0.5 * Math.sin(renderer.cannonScan * 14); col = 0xff8828; glow = 0.4 + 0.6 * p; len = t * (1.05 + 0.12 * p); }
      else if (cannon.phase === 'flight') { col = 0xffe060; glow = 1; len = t * 1.32; }
      else if (cannon.phase === 'cooldown') { col = 0x9a6050; glow = 0.15; }
      else { col = 0x8090a0; glow = 0.22; }   // idle steel
      const ex = bp.x + Math.cos(ang) * len, ey = bp.y + Math.sin(ang) * len;
      gS.beginFill(0x2b3138, 1); gS.drawCircle(bp.x, bp.y, t * 0.52); gS.endFill();           // turret mount
      gS.lineStyle(t * 0.24, col, 1); gS.moveTo(bp.x, bp.y); gS.lineTo(ex, ey); gS.lineStyle(0);   // barrel
      if (glow > 0) { gS.beginFill(col, 0.5 * glow); gS.drawCircle(ex, ey, t * 0.22); gS.endFill(); }   // muzzle glow
      if (cannon.phase === 'aim') {   // CHARGE GAUGE — arc fills as the shot readies (timer counts down)
        const frac = Math.max(0, Math.min(1, 1 - (cannon.timer || 0) / (cannon.aimDur || 3)));
        gS.lineStyle(t * 0.13, 0xffd060, 0.95);
        gS.arc(bp.x, bp.y, t * 0.74, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        gS.lineStyle(0);
      }
    }
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
        drawHpBar(gH, px + w / 2, py - 6, w - 4, s.hp / Math.max(1, s.maxHp));
      }
    }
  }

  // units
  if (state.units) {
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      // AUTHORED ART: draw a retained sprite part-stack (built lazily, cached by unit id) — so you can SEE
      // which unit/faction is attacking. Units without art fall through to the coloured primitive below.
      if (renderer.unitArt && hasArt(renderer.unitArt, u.unitId)) {
        let spr = renderer.unitSprites.get(u.id);
        if (!spr) {
          spr = buildUnitSprite(renderer.unitArt, u.unitId, t, u.radius);   // size the sprite to the sim footprint
          if (spr) { renderer.unitSpriteLayer.addChild(spr); renderer.unitSprites.set(u.id, spr); }
        }
        if (spr) {
          const pa = cellToLocal(renderer, u.pos.x, u.pos.y);
          const flyLift = (u.domain === 'Flyer' ? t * 0.35 : 0);
          spr.x = pa.x; spr.y = pa.y - flyLift;
          spr.visible = true;
          // FACE MOVEMENT: turn the whole part-stack to point along the unit's heading — from the next path
          // waypoint, else its last-tick movement — so it drives forward instead of sliding sideways. A still
          // unit keeps its last facing. Smoothed so turns ease rather than snap.
          let hx = 0, hy = 0;
          const wp = (u.path && u.pathIdx < u.path.length) ? u.path[u.pathIdx] : null;
          if (wp) { hx = wp.x - u.pos.x; hy = wp.y - u.pos.y; }
          if (hx * hx + hy * hy < 1e-4 && u._px != null) { hx = u.pos.x - u._px; hy = u.pos.y - u._py; }
          if (hx * hx + hy * hy > 1e-4) {
            const target = Math.atan2(hy, hx) + UNIT_FACING_OFFSET;
            spr.__facing = (spr.__facing == null) ? target : approachAngle(spr.__facing, target, 0.3);
          }
          const facing = spr.__facing || 0;
          spr.rotation = facing;
          const cf = Math.cos(facing), sf = Math.sin(facing);
          // ground shadow at the CONTACT point (height 0 — never leans), sized to the unit's footprint
          gU.beginFill(0x000000, 0.26);
          gU.drawEllipse(pa.x, pa.y + t * 0.06, t * (u.radius || 0.3) * 0.62, t * (u.radius || 0.3) * 0.31);
          gU.endFill();
          // per-layer camera LEAN (no distortion): shift each layer by its height × the unit's screen position.
          // Counter-rotate the stack+lean offset by the facing so the pseudo-3D shift stays SCREEN-aligned even
          // though the container itself is rotated to face movement.
          for (let ci = 0; ci < spr.children.length; ci++) {
            const child = spr.children[ci];
            const lean = layerLean(state.map, u.pos, child.__height || 0);
            const sx = lean.dx, sy = (child.__baseY || 0) + lean.dy;   // desired SCREEN offset
            child.x = sx * cf + sy * sf;
            child.y = -sx * sf + sy * cf;
          }
          drawHpBar((u.domain === 'Flyer' ? gA : gU), pa.x, pa.y - t * ((u.radius || 0.3) * SPRITE_OVER_COLLISION + 0.2) - 7, t * 0.7, u.hp / Math.max(1, u.maxHp));
          continue;   // sprite drawn — skip the primitive
        }
      }
      const color = unitColor(u);   // faction-tinted for attackers, side-coloured otherwise
      const p = cellToLocal(renderer, u.pos.x, u.pos.y);
      const r = t * (u.radius || 0.28) * SPRITE_OVER_COLLISION;   // primitives draw at SPRITE size (collision × 4/3)
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
      } else if (u.domain === 'Floater' || u.domain === 'Swimmer') {
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

  // ---- CAMPAIGN ring reveal (GDD §3): dim everything outside the current wave's playable rect,
  //      outline the edge, and mark the map's resource nodes (revealed waves only). Render-side
  //      only — the sim's gating lives in structures/waves. ----
  if (state.map && state.map.rings && state.map.rings.length) {
    const wv = Math.max(1, Math.min((state.waves && state.waves.current) || 1, state.map.rings.length));
    const ring = state.map.rings[wv - 1];
    const r = ring.rect;
    const W = state.map.cols, H = state.map.rows;
    const gated = !state.map.openPlay;   // openPlay: whole board live — rings only schedule spawns
    // LOCKED GROUND, not fog of war: a light veil that keeps the terrain readable underneath — the
    // player should see what's coming and want it (the greed the ring design sells), never wonder
    // what's hidden. A hard cyan border marks today's edge; the next ring is labeled with when it
    // opens; each growth flashes the newly-opened band so the reveal is a visible beat.
    const bands = (rect, inner) => {   // rects covering `rect` minus `inner`
      const out = [];
      if (inner.y0 > rect.y0) out.push([rect.x0, rect.y0, rect.x1 - rect.x0 + 1, inner.y0 - rect.y0]);
      if (inner.y1 < rect.y1) out.push([rect.x0, inner.y1 + 1, rect.x1 - rect.x0 + 1, rect.y1 - inner.y1]);
      if (inner.x0 > rect.x0) out.push([rect.x0, inner.y0, inner.x0 - rect.x0, inner.y1 - inner.y0 + 1]);
      if (inner.x1 < rect.x1) out.push([inner.x1 + 1, inner.y0, rect.x1 - inner.x1, inner.y1 - inner.y0 + 1]);
      return out;
    };
    if (gated) {
      gO.beginFill(0x05070a, 0.38);
      for (const [bx, by, bw, bh] of bands({ x0: 0, y0: 0, x1: W - 1, y1: H - 1 }, r)) {
        gO.drawRect(bx * t, by * t, bw * t, bh * t);
      }
      gO.endFill();
      gO.lineStyle(2, 0x5fe0ff, 0.85);
      gO.drawRect(r.x0 * t + 1, r.y0 * t + 1, (r.x1 - r.x0 + 1) * t - 2, (r.y1 - r.y0 + 1) * t - 2);
      gO.lineStyle(0);
    }
    // reveal flash: when the ring grows, the newly-opened band lights up and fades (~0.9s)
    if (renderer._ringWave !== wv) {
      if (renderer._ringWave != null && wv > renderer._ringWave && gated) {
        renderer._ringReveal = { prev: state.map.rings[renderer._ringWave - 1].rect, cur: r, age: 0 };
      }
      renderer._ringWave = wv;
    }
    if (renderer._ringReveal) {
      renderer._ringReveal.age += (frameDt || 0);
      const a = 0.45 * (1 - renderer._ringReveal.age / 0.9);
      if (a <= 0) renderer._ringReveal = null;
      else {
        gO.beginFill(0x9fe8ff, a);
        for (const [bx, by, bw, bh] of bands(renderer._ringReveal.cur, renderer._ringReveal.prev)) {
          gO.drawRect(bx * t, by * t, bw * t, bh * t);
        }
        gO.endFill();
      }
    }
    // "OPENS WAVE N" on the next locked ring, placed in whichever band has room
    if (!renderer.ringLabel) {
      renderer.ringLabel = new PIXI.Text('', { fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold', fill: 0x8fd8ef });
      renderer.ringLabel.alpha = 0.85;
      renderer.layers.overlay.addChild(renderer.ringLabel);
    }
    if (gated && wv < state.map.rings.length) {
      const nx = state.map.rings[wv].rect;
      renderer.ringLabel.text = 'OPENS WAVE ' + (wv + 1);
      renderer.ringLabel.visible = true;
      if (nx.y0 < r.y0) {        // room above
        renderer.ringLabel.anchor && renderer.ringLabel.anchor.set(0.5, 0.5);
        renderer.ringLabel.x = ((r.x0 + r.x1 + 1) / 2) * t;
        renderer.ringLabel.y = ((nx.y0 + r.y0) / 2) * t;
      } else if (nx.x1 > r.x1) { // room to the right
        renderer.ringLabel.anchor && renderer.ringLabel.anchor.set(0.5, 0.5);
        renderer.ringLabel.x = ((r.x1 + 1 + nx.x1 + 1) / 2) * t;
        renderer.ringLabel.y = ((r.y0 + r.y1 + 1) / 2) * t;
      } else if (nx.x0 < r.x0) { // room to the left
        renderer.ringLabel.anchor && renderer.ringLabel.anchor.set(0.5, 0.5);
        renderer.ringLabel.x = ((nx.x0 + r.x0) / 2) * t;
        renderer.ringLabel.y = ((r.y0 + r.y1 + 1) / 2) * t;
      } else {                   // growth is downward only — label the bottom band
        renderer.ringLabel.anchor && renderer.ringLabel.anchor.set(0.5, 0.5);
        renderer.ringLabel.x = ((r.x0 + r.x1 + 1) / 2) * t;
        renderer.ringLabel.y = ((r.y1 + 1 + nx.y1 + 1) / 2) * t;
      }
    } else {
      renderer.ringLabel.visible = false;
    }
    // resource nodes — LIVE state (state.resourceNodes): radius tracks remaining units, a hollow ring
    // marks a regrowing primary, exhausted premium/quest fade out. Green primary / gold premium /
    // purple quest — tier reads off distance, role reads off color (GDD §5.1).
    // primitive fallback tints match the CRYSTAL COLORS (blue/yellow = gold economy, red/green = quest)
    const COLOR_TINT = { blue: 0x4a90e0, yellow: 0xe0b23f, red: 0xd04040, green: 0x3f8f5a };
    const ROLE_COLOR = { primary: 0x4a90e0, premium: 0xe0b23f, quest: 0xd04040 };
    // assigned-field rings were a debug aid while field identity was buggy — behind a flag now
    // (settings panel), default off
    const assignedFields = new Set();
    if (ui && ui.showFieldRings) {
      for (const hid of state.harvesterIds || []) {
        const hv0 = state.units.get(hid);
        if (hv0 && hv0.hp > 0 && hv0.fieldId) assignedFields.add(hv0.fieldId);
      }
    }
    // node ART: crystal sprites (role → colour pool, variant by node id) drawn on the 'resources'
    // layer — above ground, below structures/units. Primitive circles are the not-yet-loaded fallback.
    const art = renderer.resourceArt;
    // sprite pools keyed by the node's CRYSTAL COLOR (harvest.js assigns: primary=blue,
    // premium=yellow, quest=red|green)
    const pools = art && (renderer._resPools || (renderer._resPools = {
      blue: art.frameNames.filter((n) => n.startsWith('blue')),
      green: art.frameNames.filter((n) => n.startsWith('green')),
      yellow: art.frameNames.filter((n) => n.startsWith('yellow')),
      red: art.frameNames.filter((n) => n.startsWith('red')),
    }));
    const idHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
    const liveIds = new Set();
    for (const node of state.resourceNodes || state.map.resources || []) {
      if (gated && node.wave > wv) continue;   // open play: every node is on the board from wave 1
      const p = cellToLocal(renderer, node.x, node.y);   // cellToLocal centers in the cell
      const frac = node.units ? Math.max(0, (node.remaining != null ? node.remaining : node.units) / node.units) : 1;
      const color = COLOR_TINT[node.color] || ROLE_COLOR[node.role] || 0x888888;
      const gone = frac <= 0 && !node.respawns;          // consumed forever (or crushed by a structure)
      if (assignedFields.has(node.fieldId) && !gone) {   // a field some harvester is working
        gO.lineStyle(1.5, 0xffffff, 0.7);
        gO.drawCircle(p.x, p.y, t * 0.3);
        gO.lineStyle(0);
      }
      if (art) {
        if (gone) continue;                              // sprite removed by the sweep below
        liveIds.add(node.id);
        let spr = renderer.resourceSprites.get(node.id);
        if (!spr) {
          const pool = (pools && pools[node.color] && pools[node.color].length) ? pools[node.color] : art.frameNames;
          spr = new PIXI.Sprite(art.textures[pool[idHash(node.id) % pool.length]]);
          spr.anchor.set(0.5, 0.68);                     // cluster base sits in the cell
          renderer.layers.resources.addChild(spr);
          renderer.resourceSprites.set(node.id, spr);
        }
        spr.x = p.x; spr.y = p.y + t * 0.06;
        // owner tuning (2026-07-13): sized by playtest — ~3/4 of a tile tall when full
        const targetH = t * 0.735 * (0.55 + 0.45 * frac);  // shrinks as the field drains
        spr.scale.set(targetH / Math.max(1, spr.texture.height));
        spr.alpha = frac > 0 ? 1 : 0.16;                 // regrowing primary lingers as a ghost
        continue;
      }
      // ── primitive fallback (art not loaded yet) ──
      if (frac <= 0) {
        if (node.respawns) {          // regrowing — hollow ring so the spot stays readable
          gO.lineStyle(1.5, color, 0.5);
          gO.drawCircle(p.x, p.y, t * 0.22);
          gO.lineStyle(0);
        }
        continue;                     // consumed forever — gone from the board
      }
      gO.beginFill(color, 0.9);
      gO.drawCircle(p.x, p.y, t * (0.1 + 0.14 * frac));
      gO.endFill();
      gO.lineStyle(1, 0x0a0e12, 0.8);
      gO.drawCircle(p.x, p.y, t * (0.1 + 0.14 * frac));
      gO.lineStyle(0);
    }
    // retire sprites for nodes that are gone (crushed premium, off-map after an override reload)
    if (art) {
      for (const [id, spr] of renderer.resourceSprites) {
        if (!liveIds.has(id)) {
          if (spr.parent) spr.parent.removeChild(spr);
          spr.destroy();
          renderer.resourceSprites.delete(id);
        }
      }
    }
    // SELECTED harvester: bold pulsing gold ring — the visible half of click-truck-then-click-field
    if (ui && ui.selectedUnitId != null) {
      const selU = state.units.get(ui.selectedUnitId);
      if (selU && selU.isHarvester && selU.hp > 0) {
        const p = cellToLocal(renderer, selU.pos.x, selU.pos.y);
        const pulse = 0.75 + 0.25 * Math.sin((state.time || 0) * 6);
        gO.lineStyle(3, 0xffd76a, pulse);
        gO.drawCircle(p.x, p.y, t * 0.62);
        gO.lineStyle(0);
      }
    }
    // harvester cargo bars (over each truck) — fill as they pull, empty on deposit
    for (const hid of state.harvesterIds || []) {
      const hv = state.units.get(hid);
      if (hv && hv.hp > 0 && hv.capacity) {
        const p = cellToLocal(renderer, hv.pos.x, hv.pos.y);
        const w = t * 0.9, frac = Math.min(1, hv.cargo / hv.capacity);
        gO.beginFill(0x0a0e12, 0.8); gO.drawRect(p.x - w / 2, p.y + t * 0.55, w, 4); gO.endFill();
        gO.beginFill(0xffd76a, 0.95); gO.drawRect(p.x - w / 2, p.y + t * 0.55, w * frac, 4); gO.endFill();
      }
    }
  }

  // ---- DEBUG: collision circles + centre points (render-side only; toggled from the HUD) ----
  // The green circle is the unit's SIM footprint (== the sprite box); the red dot is unit.pos —
  // the true centre/pivot. Any visual offset between the dot and where the art READS as centred
  // is authoring (layer offsets / un-centred frames), not a sim displacement.
  if (ui && ui.debugCollision && state.units) {
    const K = 20;       // force-vector scale: sim deltas are small fractions of a cell — amplify to readable length
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      const p = cellToLocal(renderer, u.pos.x, u.pos.y);
      const r = t * (u.radius || 0.3);
      gO.lineStyle(1.5, 0x2aff9d, 0.9);
      gO.drawCircle(p.x, p.y, r);
      gO.moveTo(p.x - 6, p.y); gO.lineTo(p.x + 6, p.y);
      gO.moveTo(p.x, p.y - 6); gO.lineTo(p.x, p.y + 6);
      // faint outer circle = SPRITE boundary (collision × 4/3) — the sim's rest distance keeps THESE apart
      gO.lineStyle(1, 0x2aff9d, 0.35);
      gO.drawCircle(p.x, p.y, r * SPRITE_OVER_COLLISION);
      gO.lineStyle(0);
      gO.beginFill(0xff3355, 1); gO.drawCircle(p.x, p.y, 2.5); gO.endFill();
      // this tick's applied crowd forces: yellow = radial overlap push, orange = avoidance steer, cyan = contact clamp
      const e = state.debugSep && state.debugSep.get(u.id);
      if (e) {
        const vec = (vx, vy, color) => {
          if (Math.abs(vx) < 1e-4 && Math.abs(vy) < 1e-4) return;
          const q = cellToLocal(renderer, u.pos.x + vx * K, u.pos.y + vy * K);   // amplify in CELL space, then project
          gO.lineStyle(2, color, 0.9);
          gO.moveTo(p.x, p.y); gO.lineTo(q.x, q.y);
          gO.lineStyle(0);
        };
        vec(e.pushX, e.pushY, 0xffe14d);
        vec(e.steerX, e.steerY, 0xff9d2a);
        vec(e.clampX, e.clampY, 0x2ad4ff);
      }
    }
  }

  // retire art sprites for units that died / despawned this frame
  if (renderer.unitSprites.size) {
    for (const [id, spr] of renderer.unitSprites) {
      const u = state.units && state.units.get(id);
      if (!u || u.hp <= 0) {
        if (spr.parent) spr.parent.removeChild(spr);
        if (spr.destroy) spr.destroy({ children: true });
        renderer.unitSprites.delete(id);
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

  // s5: selection range circle for a selected UNIT (enemy/defender) — click a unit to see its attack reach
  if (ui && ui.selectedUnitId != null && state.units) {
    const u = state.units.get(ui.selectedUnitId);
    if (u && u.hp > 0) {
      const p = cellToLocal(renderer, u.pos.x, u.pos.y);
      gO.lineStyle(2, 0xff7070, 0.95);
      gO.drawCircle(p.x, p.y, t * 0.34);                                  // selection ring on the unit
      gO.lineStyle(0);
      if (typeof u.range === 'number' && u.range > 0) {
        drawDashedCircle(gO, p.x, p.y, u.range * t, 0xff8080, 0.6, 1.5);  // its reach
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

  // Repair SPARKS — a bot actively welding a structure (state 'repairing') throws sparks at the work site, so
  // the repair reads clearly (and confirms the structure's HP is climbing). Emitted at the bot's position.
  if (state.units && state.structures) {
    for (const u of state.units.values()) {
      if (!u || !u.isRepairTroop || u.state !== 'repairing') continue;
      const tgt = state.structures.get(u.repairTargetId);   // sparks fly from the STRUCTURE being repaired, centred
      if (!tgt) continue;
      if (Math.random() < 0.4) {
        const fp = tgt.footprint || { w: 1, h: 1 };
        const cx = tgt.pos.x + ((fp.w || 1) - 1) / 2, cy = tgt.pos.y + ((fp.h || 1) - 1) / 2;   // footprint centre
        const wp = cellToLocal(renderer, cx, cy);
        spawnSparks(renderer, wp.x, wp.y - t * 0.12, 1 + (Math.random() * 2 | 0));   // ~50% fewer sparks (was 2-4 → 1-2)
      }
    }
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
