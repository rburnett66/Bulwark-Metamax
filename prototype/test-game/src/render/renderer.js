import { getStructureDef, getUnitDef } from '../data/tables.js';
import { hasArt, buildUnitSprite } from './unitArt.js';
import { hasVoxel, buildVoxelUnit, updateVoxelUnit, buildDecorSprite } from './voxel/loader.js';
import { buildLive3D, updateLive3D } from './voxel/live3d.js';
import { createProjectilePool } from './projectiles.js';
import { layerLean } from '../harness/camera.js';
import { SPRITE_OVER_COLLISION } from '../harness/parts.js';
import { TERRAIN_COLOR, TERRAIN_NAME } from '../terrain/terrainGen.js';
import { bakeTerrain, DEFAULT_STACK } from '../terrain/terrainBake.js';

// Terrain Forge palette as PIXI numeric colors (Stage 2 maps render by terrain type)
const TERRAIN_HEX = TERRAIN_COLOR.map((c) => parseInt(c.slice(1), 16));

// ── STAGE 2 TILE BAKE: paint the map's authored tile sheets (MetaMax art via content/sprite-atlas/)
// over the flat type colors, ONCE, into a single RenderTexture — terrain is static, so battles pay
// zero per-frame cost and ONE draw for the whole ground. The flat colors stay underneath as the
// instant fallback (missing sheets, load failures, the tool's tileset-free maps). Variant + frame
// picks are the tool's deterministic hash, so the game and the forge preview scatter identically.
const _sheetCache = new Map();   // name → { frames: Texture[] } | null (across maps)
async function _loadSheet(name) {
  if (_sheetCache.has(name)) return _sheetCache.get(name);
  let rec = null;
  try {
    const meta = await fetch(`content/sprite-atlas/${name}.json`).then((r) => (r.ok ? r.json() : null));
    if (meta && meta.frames) {
      const img = await new Promise((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = `content/sprite-atlas/${name}.png`;
      });
      const base = PIXI.BaseTexture.from(img);
      const frames = Object.values(meta.frames).map((f) =>
        new PIXI.Texture(base, new PIXI.Rectangle(f.frame.x | 0, f.frame.y | 0, f.frame.w | 0, f.frame.h | 0)));
      if (frames.length) rec = { frames };
    }
  } catch (e) { /* sheet missing → flat color remains */ }
  _sheetCache.set(name, rec);
  return rec;
}
function _tileHash(x, y, salt) {
  let h = (x * 374761393 + y * 668265263 + salt * 97) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
// default coverage (mirrors the tool's PALETTE_DEFAULTS): forge maps saved without palettes still
// render FULLY tiled — grass and cliff included — instead of falling back to flat colors.
const DEFAULT_TERRAIN_SHEETS = {
  grass: ['grass', 'grass-1', 'grass-2'], dirt: ['brown-dirt', 'dirt-rocky', 'tp1-dirt'],
  brush: ['tall-grass', 'tall-bushes-2', 'tp1-brush'], rocks: ['rocks', 'tp1-rocks'],
  trees: ['trees', 'trees-2', 'tp1-trees'], cliff: ['elevated-cliffs'],
  water: ['ocean-1', 'ocean-2', 'tp1-water'], 'cliff-border': ['rock-cliff-border'],
};
// Stage 2 (Shading epic T.5): render a forge map with the Terrain Forge DIGICAM BAKE — the exact
// terrainBake.js the tool previews (material stack, terracing, organic outlines, baked cast shadows).
// The author's stack + tuning ride same-origin localStorage (tf.stack.v2 / tf.bake.v1) so the game matches
// the tool. Returns true on success; false (not a forge map, or a bake error) lets the caller fall back to
// the older sprite-tile bake. One synchronous bake at map load — no per-frame cost (it's baked pixels).
function bakeDigicamGround(renderer, map, groundLayer) {
  if (!map.fromForge || !map.terrain) return false;
  let stack = DEFAULT_STACK, tune = {};
  try { const s = JSON.parse(localStorage.getItem('tf.stack.v2')); if (Array.isArray(s) && s.length) stack = s; } catch (_) { /* default stack */ }
  try { const t = JSON.parse(localStorage.getItem('tf.bake.v1')); if (t && typeof t === 'object') tune = t; } catch (_) { /* default tuning */ }
  try {
    const canvas = bakeTerrain({ cols: map.cols, rows: map.rows, terrain: map.terrain }, { ...tune, stack });
    // bakeTerrain returns an OffscreenCanvas in the browser; copy to a plain canvas so PIXI.Texture.from is
    // guaranteed to accept it (OffscreenCanvas support varies) rather than silently falling back to tiles.
    let src = canvas;
    if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
      src = document.createElement('canvas'); src.width = canvas.width; src.height = canvas.height;
      src.getContext('2d').drawImage(canvas, 0, 0);
    }
    const tex = PIXI.Texture.from(src);
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    const spr = new PIXI.Sprite(tex);
    spr.width = map.cols * map.tile; spr.height = map.rows * map.tile;   // fit the bake to the board
    groundLayer.addChild(spr);
    renderer._terrainBake = spr;
    return true;
  } catch (e) { console.error('[terrain] digicam bake failed — falling back to sprite tiles:', e); return false; }
}

async function bakeTerrainTiles(renderer, map, groundLayer) {
  if (!map.fromForge || !map.terrain) return;
  const wanted = TERRAIN_NAME.map((key) => {
    const own = (map.palettes && map.palettes[key]) || [];
    return (own.length ? own : (DEFAULT_TERRAIN_SHEETS[key] || [])).slice(0, 3);
  });
  if (!wanted.some((n) => n.length)) return;
  const t = renderer.tile;
  const byType = [];
  for (let ti = 0; ti < wanted.length; ti++) {
    const sheets = (await Promise.all(wanted[ti].map(_loadSheet))).filter(Boolean);
    byType[ti] = sheets.length ? sheets : null;
  }
  if (!byType.some(Boolean) || renderer._dead) return;
  const cont = new PIXI.Container();
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const ti = map.terrain[y * map.cols + x] | 0;
      const sheets = byType[ti];
      if (!sheets) continue;
      const sheet = sheets[_tileHash(x, y, 1) % sheets.length];
      const tex = sheet.frames[_tileHash(x, y, 2) % sheet.frames.length];
      const s = new PIXI.Sprite(tex);
      // EDGE BLEND (task-mrmwn65614v): tiles bleed ~0.75px past their cell on every side — with
      // linear filtering the overlaps cross-fade, so the grid seams melt instead of reading as tiles.
      s.width = t + 1.5; s.height = t + 1.5;
      s.position.set(x * t - 0.75, y * t - 0.75);
      cont.addChild(s);
    }
  }
  const rt = PIXI.RenderTexture.create({ width: map.cols * t, height: map.rows * t });
  renderer.app.renderer.render(cont, { renderTexture: rt });
  cont.destroy({ children: true });
  const baked = new PIXI.Sprite(rt);
  groundLayer.addChild(baked);                       // over the flat colors, under everything else
  renderer._terrainBake = baked;
}

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
  moat: 0x2f6db0,   // legacy — the moat build slot became the Mine Drone (kind 'mine')
  mine: 0xe03030
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

export function cellToLocal(renderer, cx, cy) {   // exported: the Shooting Gallery drives the same FX code
  const t = renderer.tile;
  return { x: (cx + 0.5) * t, y: (cy + 0.5) * t };
}

// VOXEL DECOR: static props from map.decor[] built ONCE per map into the 'decor' layer. Each instance is a
// baked sprite + shadow at its cell's contact point, zIndex = screen-y so decor self-sorts (nearer in front).
// Rebuilds when the map object changes; a no-op every other frame. Needs renderer.decorArt (set by main.js).
function renderDecor(renderer) {
  if (!renderer.decorArt) return;
  const map = renderer.map;
  if (renderer._decorMap === map) return;              // already built for this map
  renderer._decorMap = map;
  // Story 4: decor lives in the SHARED unitSpriteLayer and sorts with units by ground-contact y (zIndex), so
  // a unit walking behind a pine is occluded by it and draws over it when in front. Clear only OUR sprites —
  // the layer is shared with unit sprites, so never removeChildren().
  const layer = renderer.unitSpriteLayer;
  for (const spr of renderer.decorSprites.values()) { if (spr.parent) spr.parent.removeChild(spr); spr.destroy({ children: true }); }
  renderer.decorSprites.clear();
  if (!map || !Array.isArray(map.decor) || !map.decor.length) return;
  const t = renderer.tile;
  for (let i = 0; i < map.decor.length; i++) {
    const d = map.decor[i];
    const spr = buildDecorSprite(renderer.decorArt, d.type, t, d.s || 1);   // per-tree ±15% scale (grove variation)
    if (!spr) continue;                                 // unknown/failed decor type → skip
    const p = cellToLocal(renderer, d.x, d.y);
    const sx = p.x + (d.dx || 0) * t, sy = p.y + (d.dy || 0) * t;           // sub-cell pixel stagger
    spr.x = sx; spr.y = sy; spr.zIndex = sy;            // contact-y → interleaves with units
    layer.addChild(spr);
    renderer.decorSprites.set(i, spr);
  }
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
  // Stage 2: a Terrain Forge map paints each cell by its terrain type (the tool's tileset-free
  // playtest palette). Otherwise the generated green bands + buildable tint (existing behavior).
  const terr = map.terrain && map.fromForge ? map.terrain : null;
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (waterSet.has(cellKey(x, y))) continue;
      if (terr) {
        const ti = terr[y * map.cols + x] | 0;
        gGround.beginFill(TERRAIN_HEX[ti] != null ? TERRAIN_HEX[ti] : 0x3c5c33, 1);
        gGround.drawRect(x * t, y * t, t, t);
        gGround.endFill();
        continue;
      }
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
  // Stage 2 ground: the DIGICAM bake (Terrain Forge look) wins for forge maps; if it's unavailable or
  // errors, fall back to the authored sprite-tile bake. Either paints over the flat colors, under everything.
  if (!bakeDigicamGround(renderer, map, renderer.layers.ground))
    void bakeTerrainTiles(renderer, map, renderer.layers.ground);
}

// Free a renderer's OWN GPU resources before it is replaced (map change / restart). The shared unit/voxel
// texture atlases (renderer.unitArt/voxelArt) are carried forward to the next renderer, so we destroy the
// display tree's sprites/graphics but NOT their textures (texture:false).
export function destroyRenderer(renderer) {
  if (!renderer) return;
  try {
    if (renderer._terrainBake && renderer._terrainBake.destroy) {   // the big leak: per-map terrain bake RenderTexture/Texture
      renderer._terrainBake.destroy({ children: true, texture: true, baseTexture: true });
      renderer._terrainBake = null;
    }
    if (renderer._glowTex && renderer._glowTex.destroy) { renderer._glowTex.destroy(true); renderer._glowTex = null; }
    const pj = renderer.projectiles;                                 // projectile atlas is built per pool → per renderer
    if (pj && pj.dot && pj.dot.baseTexture && pj.dot.baseTexture.destroy) { try { pj.dot.baseTexture.destroy(); } catch (_) { /* shared? leave it */ } }
    if (renderer.root && renderer.root.destroy) {
      renderer.root.destroy({ children: true, texture: false, baseTexture: false });
      renderer.root = null;
    }
  } catch (e) { /* best-effort teardown — never block a map switch */ }
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
    // Tier A projectiles (rendering-tiers spec §4): pooled billboard sprites, one batched draw call.
    projectiles: createProjectilePool(),
    fxItems: [],
    flames: [],            // live burning-wreck flame EMITTERS (particle-based, CSP-safe) — see spawnFlame/updateFlames
    shake: { time: 0, dur: 0, mag: 0 },
    baseFire: null,
    baseFirePos: null,
    // Authored unit ART: a retained sprite per live unit that has art (built lazily, keyed by unit.id),
    // sitting above the primitive Graphics. `unitArt` is set by main.js once loadUnitArt() resolves.
    unitArt: null,
    // VOXEL unit packs (Stack Forge): takes precedence over authored art when a unit id has a pack.
    // Set by main.js once loadVoxelUnits() resolves. Sprites share unitSprites (flagged with __vox).
    voxelArt: null,
    unitSprites: new Map(),
    unitSpriteLayer: new PIXI.Container(),
    // Resource ART (crystal_resources sheet): a retained sprite per live node, keyed by node id.
    resourceArt: null,
    resourceSprites: new Map(),
    // VOXEL DECOR packs (Stack Forge Terrain set): set by main.js once loadVoxelDecor() resolves. Static
    // props placed from map.decor[]; built once per map into the 'decor' layer, keyed by instance index.
    decorArt: null,
    decorSprites: new Map()
  };
  renderer.unitSpriteLayer.sortableChildren = true;   // Story 4: decor + units interleave by contact-y zIndex

  renderer.dustG = new PIXI.Graphics();
  layers.resources.addChild(renderer.dustG);         // ground dust: above the terrain, UNDER structures + units
  renderer.mineG = new PIXI.Graphics();
  layers.resources.addChild(renderer.mineG);         // MINE DRONES: armed red dots UNDER units (tanks roll onto them)
  layers.structures.addChild(renderer.dyn.structures);
  layers.units.addChild(renderer.dyn.units);
  layers.units.addChild(renderer.unitSpriteLayer);   // sprites draw over the primitive unit layer
  renderer.cargoLayer = new PIXI.Container();        // crystal loads ride ON TOP of the trucks
  layers.units.addChild(renderer.cargoLayer);
  renderer.cargoSprites = new Map();                 // harvester id -> crystal sprite in its bed
  layers.air.addChild(renderer.dyn.air);
  layers.fx.addChild(renderer.projectiles.container);   // shots under the burst/impact FX
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
function spawnGoldFloat(renderer, x, y, label, fill) {
  const t = new PIXI.Text(label, { fontFamily: 'Courier New', fontSize: Math.max(13, renderer.tile * 0.28),
    fontWeight: 'bold', fill: fill || 0xffd76a, stroke: 0x0a0e12, strokeThickness: 3 });
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
export function spawnFlame(renderer, x, y, scale, ttl) {
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
export function spawnFireClump(renderer, x, y, count, scale) {
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
export function spawnSparks(renderer, x, y, count) {
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


// ── COSMETIC COMBAT FX (owner): shells/tracers fly to their targets (damage stays hitscan —
// pure presentation), damaged tanks/turrets burn at random offsets, damaged flyers throw small
// welding-style sparks. All render-side (Math.random legal); the sim is untouched.
const RANGED_SHAPES = { 'Tanks': 1, 'Heavy Tanks': 1, 'Artillery': 1, 'Planes': 1, 'Copters': 1, 'Missiles': 1 };
const BURN_COLORS = [0xffd27a, 0xff9a3d, 0xff6a2a];
function emitCombatFx(renderer, state) {
  const t = renderer.tile;
  if (!renderer._shotClock) renderer._shotClock = new Map();
  const clock = renderer._shotClock;
  const now = state.time || 0;
  const dt = renderer._fxDt || FX_DT;
  const targetPos = (tid) => {
    if (tid == null) return null;
    if (tid === -1) return state.base ? { x: state.base.pos.x, y: state.base.pos.y, air: false } : null;
    const tu = state.units.get(tid);
    if (tu && tu.hp > 0) return { x: tu.pos.x, y: tu.pos.y, air: tu.domain === 'Flyer' };
    const ts = state.structures && state.structures.get(tid);
    if (ts && ts.lifecycle !== 'Destroyed') {
      const fp = ts.footprint || { w: 1, h: 1 };
      return { x: ts.pos.x + ((fp.w || 1) - 1) / 2, y: ts.pos.y + ((fp.h || 1) - 1) / 2, air: false };
    }
    return null;
  };
  // owner 2026-07-16: flak rounds were near-invisible on phones (4x), cannon shells faint (2x)
  const SHOT_SIZE = { shell: 0.022, flak: 0.03, tracer: 0.0075 };
  const fire = (id, from, to, kind, cadence, speed, color, burst, sizeMult) => {
    const next = clock.get(id) || 0;
    if (now < next) return;
    clock.set(id, now + cadence * (0.85 + Math.random() * 0.3));
    // pooled sprite path (spec §4): billboard dot + streak, single batched draw, zero per-frame alloc.
    // size is a sprite SCALE — the dot texture is 16px, so t*0.011 ≈ the old t*0.09-radius shell dot.
    const n = burst || 1;
    for (let k = 0; k < n; k++) {
      // burst rounds spray: jittered impact points, staggered a few frames apart (sim clock)
      const jx = n > 1 ? (Math.random() * 2 - 1) * t * 0.16 : 0;
      const jy = n > 1 ? (Math.random() * 2 - 1) * t * 0.16 : 0;
      const args = [from.x, from.y, to.x + jx, to.y + jy, speed * t, color, kind, t * (SHOT_SIZE[kind] || 0.0075) * (sizeMult || 1)];
      if (k === 0) renderer.projectiles.spawn(...args);
      else (renderer._shotQueue || (renderer._shotQueue = [])).push({ at: now + k * 0.07, args });
    }
  };
  // AUTHORED PROJECTILE FX (Shooting Gallery → renderer.projFx, see projFx.js): per-id overrides for
  // the recipes below; every id not in the table fires exactly the classic hardcoded look.
  const pfx = renderer.projFx || null;
  // flush queued burst rounds that have come due
  if (renderer._shotQueue && renderer._shotQueue.length) {
    const due = [];
    renderer._shotQueue = renderer._shotQueue.filter((q) => (now >= q.at ? (due.push(q), false) : true));
    for (const q of due) renderer.projectiles.spawn(...q.args);
  }
  const burn = (x, y, spread, size) => {
    renderer.fxItems.push({ kind: 'fire', x: x + (Math.random() * 2 - 1) * spread, y: y + (Math.random() * 2 - 1) * spread,
      age: 0, ttl: 0.45 + Math.random() * 0.3, color: BURN_COLORS[(Math.random() * 3) | 0],
      size: size, rise: t * 0.45, vx: (Math.random() * 2 - 1) * t * 0.06 });
    if (Math.random() < 0.35) renderer.fxItems.push({ kind: 'smoke', x: x, y: y - t * 0.1, age: 0, ttl: 0.8,
      color: 0x2a2d31, size: size * 1.2, rise: t * 0.6 });
  };

  if (state.structures) {
    for (const st of state.structures.values()) {
      if (!st || (st.lifecycle !== 'Complete' && st.lifecycle !== 'Damaged')) continue;
      if (st.kind !== 'antiGround' && st.kind !== 'antiAir') continue;
      const fp = st.footprint || { w: 1, h: 1 };
      const c = cellToLocal(renderer, st.pos.x + ((fp.w || 1) - 1) / 2, st.pos.y + ((fp.h || 1) - 1) / 2);
      if (st.targetId != null) {
        const tp = targetPos(st.targetId);
        if (tp) {
          const lp = cellToLocal(renderer, tp.x, tp.y);
          const ty = lp.y - (tp.air ? t * 1.05 : 0);
          // owner 2026-07-16: tower defense reads as a SPRAY of bullets — 4-round jittered burst
          const tfx = pfx && pfx[st.structId];
          if (st.kind === 'antiGround') fire('s' + st.id, c, { x: lp.x, y: ty },
            (tfx && tfx.kind) || 'shell', (tfx && tfx.cadence) || 0.55, (tfx && tfx.speed) || 13,
            (tfx && tfx.color !== undefined) ? tfx.color : 0xffd080, (tfx && tfx.burst) || 4, tfx && tfx.size);
          else fire('s' + st.id, c, { x: lp.x, y: ty },
            (tfx && tfx.kind) || 'flak', (tfx && tfx.cadence) || 0.35, (tfx && tfx.speed) || 18,
            (tfx && tfx.color !== undefined) ? tfx.color : 0x9fd4ff, (tfx && tfx.burst) || 1, tfx && tfx.size);
        }
      }
      if (st.maxHp && st.hp > 0 && st.hp / st.maxHp < 0.5 && Math.random() < dt * 2.2) burn(c.x, c.y, t * 0.3, t * 0.1);
    }
  }

  if (state.units) {
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0 || u.isHarvester) continue;
      let d = null;
      try { d = getUnitDef(u.unitId); } catch (e) { continue; }
      if (!d) continue;
      const p = cellToLocal(renderer, u.pos.x, u.pos.y);
      const isFlyer = u.domain === 'Flyer';
      const lift = isFlyer ? t * 1.05 : 0;   // planes fly 3× higher now that trees stand on the board
      // TANK DUST (owner 2026-07-16): ground movers kick up dust at their tracks while rolling
      if (!isFlyer) {
        const lm = renderer._lastUnitPos || (renderer._lastUnitPos = new Map());
        const prev = lm.get(u.id);
        if (prev) {
          const mdx = p.x - prev.x, mdy = p.y - prev.y;
          if (Math.hypot(mdx, mdy) > t * 0.008 && Math.random() < dt * 7) {
            renderer.fxItems.push({ kind: 'smoke',
              x: p.x - mdx * 3 + (Math.random() * 2 - 1) * t * 0.08,
              y: p.y - mdy * 3 + (Math.random() * 2 - 1) * t * 0.08 + t * 0.06,
              age: 0, ttl: 0.5 + Math.random() * 0.25, color: 0x8a7a5e, size: t * 0.09, rise: t * 0.04 });
          }
        }
        lm.set(u.id, { x: p.x, y: p.y });
      }
      if (RANGED_SHAPES[d.shape] && (d.range || 0) > 1.6 && u.targetId != null) {
        const tp = targetPos(u.targetId);
        if (tp) {
          const lp = cellToLocal(renderer, tp.x, tp.y);
          const grounded = d.shape === 'Tanks' || d.shape === 'Heavy Tanks' || d.shape === 'Artillery';
          const ufx = pfx && pfx[u.unitId];
          fire('u' + u.id, { x: p.x, y: p.y - lift }, { x: lp.x, y: lp.y - (tp.air ? t * 1.05 : 0) },
            (ufx && ufx.kind) || (grounded ? 'shell' : 'tracer'), (ufx && ufx.cadence) || 0.6, (ufx && ufx.speed) || 15,
            (ufx && ufx.color !== undefined) ? ufx.color : (u.side === 'attacker' ? 0xff9a70 : 0xbfe8ff),
            (ufx && ufx.burst) || 1, ufx && ufx.size);
        }
      }
      const hpFrac = u.hp / Math.max(1, u.maxHp);
      if (hpFrac < 0.5) {
        if (isFlyer) {
          if (Math.random() < dt * 2.0) spawnSparks(renderer, p.x + (Math.random() * 2 - 1) * t * 0.2, p.y - lift, 1);
        } else if (d.shape === 'Tanks' || d.shape === 'Heavy Tanks' || d.shape === 'Artillery') {
          if (Math.random() < dt * 2.0) burn(p.x, p.y, t * 0.25, t * 0.09);
        }
      }
    }
  }
}

// ── EXPLOSION GLOW (owner): additive-blend radial glow sprites — the cheap 2D "lighting"
// shipped games use. White gradient texture tinted per event, scales up + fades over its life.
// No lighting engine, no normal maps, phone-friendly.
function glowTexture(renderer) {
  if (renderer._glowTex) return renderer._glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  renderer._glowTex = PIXI.Texture.from(c);
  return renderer._glowTex;
}
export function spawnGlow(renderer, x, y, radiusTiles, ttl, tint) {
  const spr = new PIXI.Sprite(glowTexture(renderer));
  spr.anchor.set(0.5);
  spr.blendMode = PIXI.BLEND_MODES.ADD;
  spr.tint = (tint != null) ? tint : 0xffc070;
  spr.x = x; spr.y = y;
  spr.__age = 0; spr.__ttl = ttl || 0.35;
  spr.__r = radiusTiles * renderer.tile;
  spr.scale.set((spr.__r * 1.2) / 64);
  renderer.layers.fx.addChild(spr);
  (renderer.glows || (renderer.glows = [])).push(spr);
}
function updateGlows(renderer, dt) {
  if (!renderer.glows || !renderer.glows.length) return;
  const keep = [];
  for (const gl of renderer.glows) {
    gl.__age += dt;
    const f = gl.__age / gl.__ttl;
    if (f >= 1) { if (gl.parent) gl.parent.removeChild(gl); gl.destroy(); continue; }
    gl.scale.set(((gl.__r * (1.2 + 1.0 * f))) / 64);   // blooms outward…
    gl.alpha = Math.pow(1 - f, 1.6);                    // …while fading fast
    keep.push(gl);
  }
  renderer.glows = keep;
}

export function spawnFx(renderer, ev) {
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
    spawnGlow(renderer, p.x, p.y, 2.2, 0.5);    // explosion light bloom
    return;
  }
  // ── DELIVERY FANFARE (owner 2026-07-16): a load landing at base celebrates in ITS crystal's
  // colour — ring + coin sparks + coloured bloom + a rising "+Ng" tinted to the resource. ──
  if (ev.type === 'deposit') {
    const COL = { blue: 0x58a6ff, yellow: 0xffd76a, red: 0xff6a6a, green: 0x7be08a };
    const c = COL[ev.color] || 0xffd76a;
    renderer.fxItems.push({ x: p.x, y: p.y, age: 0, ttl: 0.55, color: c, kind: 'ring' });
    spawnSparks(renderer, p.x, p.y, 6);                       // the coin shower
    spawnGlow(renderer, p.x, p.y, 0.85, 0.35, c);             // crystal-coloured bloom at the dock
    if (ev.gold > 0) spawnGoldFloat(renderer, p.x, p.y, '+' + Math.round(ev.gold) + 'g', c);
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
  // ── MINE DRONE visuals (mines.js events) ──
  if (ev.type === 'mineArmed') {
    renderer.fxItems.push({ x: p.x, y: p.y, age: 0, ttl: 0.4, color: 0xe03030, kind: 'ring' });   // it just dug in
    return;
  }
  if (ev.type === 'mineExplode') {
    spawnFireClump(renderer, p.x, p.y, 12, 0.9);                     // the boom, through the shipping FX pipeline
    spawnGlow(renderer, p.x, p.y, 1.0, 0.35);
    renderer.shake.time = 0; renderer.shake.dur = 0.25; renderer.shake.mag = renderer.tile * 0.25;
    return;
  }
  // NB: the sim still emits 'cannonImpact' (it drives the AOE damage), but the VISUAL blast is spawned by the
  // shell the moment it hits the ground (updateFx) so the explosion can never lag the landing.
  let color = 0xffffff, ttl = 0.4, kind = 'ring';
  switch (ev.type) {
    case 'kill': color = 0xe05040; ttl = 0.5; kind = 'ring'; break;
    case 'damage': return;   // retired: the old yellow hit-dot — cosmetic projectiles flash at the impact point now (owner)
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
    spawnGlow(renderer, p.x, p.y, 0.9 * ((ev.radius || 0.28) / 0.28), 0.3);
    // the SCORE of the kill: a rising "+Ng" at the wreck (every attacker kill pays a bounty)
    if (ev.income > 0) spawnGoldFloat(renderer, p.x, p.y, '+' + Math.round(ev.income) + 'g');
  }
}

export function updateFx(renderer) {
  updateGlows(renderer, renderer._fxDt || FX_DT);
  updateFlames(renderer);   // advance flame emitters
  updateGoldFloats(renderer, FX_DT);   // rising +Ng kill-score texts (same fixed FX clock as particles)
  const g = renderer.fxG;
  g.clear();
  const dg = renderer.dustG; if (dg) dg.clear();   // ground dust draws on its own layer, UNDER units
  const t = renderer.tile;
  const dt = renderer._fxDt || FX_DT;   // REAL frame time so FX track the real-time sim
  // Tier A projectiles (pooled sprites, zero per-frame alloc) fly here; the impact callback is
  // EVENT-time — burst FX may allocate, the per-frame flight path never does. (spec §4)
  renderer.projectiles.update(dt, (kind, tx, ty) => {
    if (kind === 'flak') {
      // AIR-BURST: grey puffs + cold flash at altitude
      for (let k = 0; k < 4; k++) renderer.fxItems.push({ kind: 'smoke', x: tx + (Math.random() * 2 - 1) * t * 0.22,
        y: ty + (Math.random() * 2 - 1) * t * 0.22, age: 0, ttl: 0.5, color: 0x3a3f45, size: t * 0.1, rise: t * 0.15 });
      renderer.fxItems.push({ kind: 'flash', x: tx, y: ty, age: 0, ttl: 0.12, color: 0xcfe8ff });
      spawnGlow(renderer, tx, ty, 0.55, 0.22, 0xbfe0ff);   // cool air-burst bloom
    } else {
      renderer.fxItems.push({ kind: 'flash', x: tx, y: ty, age: 0, ttl: 0.15, color: 0xffe6a0 });
      if (kind === 'shell') { spawnSparks(renderer, tx, ty, 2); spawnGlow(renderer, tx, ty, 0.45, 0.2); }
    }
  });

  // camera shake: decays over its duration and offsets the whole board root (rebased on the
  // hybrid-growth camera position — see updateCamera)
  if (renderer.shake && renderer.shake.dur > 0) {
    renderer.shake.time += dt;
    const sf = 1 - renderer.shake.time / renderer.shake.dur;
    if (sf <= 0) {
      renderer.shake.dur = 0;
      renderer.root.x = (renderer.camera ? renderer.camera.x : 0);
      renderer.root.y = (renderer.camera ? renderer.camera.y : 0);
    } else {
      const m = renderer.shake.mag * sf;
      renderer.root.x = (renderer.camera ? renderer.camera.x : 0) + (Math.random() * 2 - 1) * m;
      renderer.root.y = (renderer.camera ? renderer.camera.y : 0) + (Math.random() * 2 - 1) * m;
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
      if (fx.txt) { if (fx.txt.parent) fx.txt.parent.removeChild(fx.txt); fx.txt.destroy(); }   // free the floating-text object AND its canvas-backed texture
      if (fx.kind === 'shell') {
        // the shell has completed its arc and HIT THE GROUND — detonate NOW, exactly at the impact point. With FX
        // on real frame-time this lands on the same tick the sim applies the AOE damage (no explosion/damage lag).
        spawned.push({ x: fx.tx, y: fx.ty, age: 0, ttl: 0.6, kind: 'blast', radius: (fx.radius || 2.5) * 0.5 });   // 50% smaller blast
        spawnGlow(renderer, fx.tx, fx.ty, (fx.radius || 2.5) * 0.9, 0.6);   // the ground lights up
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
    } else if (fx.kind === 'dust') {
      // ground dust kicked up behind a moving walker: drifts out + back, hugs the ground, expands + fades.
      // Drawn on dustG (below the units) so tanks drive OVER their own dust, not under it.
      const dgt = dg || g;
      const rise = (fx.rise != null) ? fx.rise : t * 0.12, sz = (fx.size != null) ? fx.size : t * 0.12;
      const fxp = fx.x + (fx.vx || 0) * f, fyp = fx.y + (fx.vy || 0) * f - f * rise;
      dgt.beginFill(fx.color, (1 - f) * (1 - f) * 0.3);            // soft quadratic fade-out
      dgt.drawCircle(fxp, fyp, sz * (0.6 + f * 1.3));              // billows outward as it settles
      dgt.endFill();
    }
    keep.push(fx);
  }
  renderer.fxItems = spawned.length ? keep.concat(spawned) : keep;
}

// Ground dust: a moving WALKER kicks up soft puffs from its rear-LEFT and rear-RIGHT. Throttled per unit,
// pushed into fxItems so each puff lingers (ttl ≥ 0.5s) and fades on the shared FX clock. No effect on the sim.
function emitGroundDust(renderer, u) {
  if (u.domain !== 'Walker' || u._px == null) return;                 // ground units only
  const mvx = u.pos.x - u._px, mvy = u.pos.y - u._py, spd2 = mvx * mvx + mvy * mvy;
  if (spd2 < 2e-5) return;                                            // essentially stationary → no dust
  u._dustT = (u._dustT || 0) + (renderer._fxDt || FX_DT);
  if (u._dustT < 0.05) return;                                        // ~20 emissions/sec, frame-rate independent
  u._dustT = 0;
  const t = renderer.tile, inv = 1 / Math.sqrt(spd2), hx = mvx * inv, hy = mvy * inv;   // heading unit vec
  const perpX = -hy, perpY = hx;                                      // perpendicular = left/right of travel
  const p = cellToLocal(renderer, u.pos.x, u.pos.y);
  // u.radius is the COLLISION half-width (~2× the drawn body). Emit at the VISIBLE rear, not the collision ring.
  const vr = (u.radius || 0.3) * 0.5;
  const rear = vr * 0.45 * t, side = vr * 0.35 * t;   // placement pulled to the unit's own rear corners (1.0 scale)
  for (const s of [1, -1]) {                                          // rear-left (+1) and rear-right (−1)
    renderer.fxItems.push({
      kind: 'dust',
      x: p.x - hx * rear + perpX * side * s,
      y: p.y - hy * rear + perpY * side * s + t * 0.06,               // behind the feet, hugging the ground
      age: 0, ttl: 0.55 + Math.random() * 0.4,                        // ≥ 500ms (up to ~0.95s)
      color: 0xc2b291, size: t * (0.10 + Math.random() * 0.06), rise: t * (0.08 + Math.random() * 0.10),
      vx: (-hx * 0.18 + perpX * s * 0.28) * t + (Math.random() * 2 - 1) * t * 0.05,   // drift back + outward
      vy: (-hy * 0.18 + perpY * s * 0.28) * t,
    });
  }
}

export function renderFrame(renderer, state, ui, events, frameDt) {
  // HYBRID MAP GROWTH (owner): everything is PLAYABLE from wave 1 (open play), but the CAMERA
  // starts framed on the wave-1 pocket and zooms out one step per wave — the world visibly grows
  // (GDD §3's felt experience) without re-gating the player. Between waves it frames the NEXT
  // wave's ring, so the zoom-out lands during the interlude. Wave 8 = full map; classic boards
  // sit at scale 1; screen shake rides on top of the camera position.
  updateCamera(renderer, state, frameDt || 0.016);
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
    // AUTHORED BASE SHIP (State Bench, System faction, 'SYS-Base'): one sprite stretched across the
    // full 3x3 footprint, replacing the gold plus-cells; outline, HP bar and the super-cannon
    // turret still draw over it. Falls back to the primitives until (unless) it's authored.
    let baseArtDrawn = false;
    if (renderer.unitArt && hasArt(renderer.unitArt, 'SYS-Base') && !(renderer._noArt && renderer._noArt.has('SYS-Base'))) {
      if (!renderer.baseSprite) {
        const bs = buildUnitSprite(renderer.unitArt, 'SYS-Base', t, 3 / (2 * SPRITE_OVER_COLLISION));   // targetW = 3 tiles
        if (bs && bs.children.length) { renderer.layers.structures.addChild(bs); renderer.baseSprite = bs; }
        else { if (bs) bs.destroy(); (renderer._noArt || (renderer._noArt = new Set())).add('SYS-Base'); }
      }
      if (renderer.baseSprite) {
        const bc0 = cellToLocal(renderer, state.base.pos.x, state.base.pos.y);
        renderer.baseSprite.x = bc0.x; renderer.baseSprite.y = bc0.y;
        baseArtDrawn = true;
      }
    }
    if (!baseArtDrawn) {
      gS.beginFill(0xc0a040, 1);
      for (const bc of cells) {
        const cp = cellToLocal(renderer, bc.x, bc.y);
        gS.drawRect(cp.x - t * 0.46, cp.y - t * 0.46, t * 0.92, t * 0.92);
      }
      gS.endFill();
    }
    const bp = cellToLocal(renderer, state.base.pos.x, state.base.pos.y);
    gS.lineStyle(2, 0xf0e0a0, 0.9);
    gS.drawRect(bp.x - t * 1.5, bp.y - t * 1.5, t * 3, t * 3);   // keep outline
    gS.lineStyle(0);
    drawHpBar(gH, bp.x, bp.y - t * 1.72, t * 2.2, state.base.hp / Math.max(1, state.base.maxHp));

    // ── HARVESTER PURCHASE PROMPT (owner): when a harvester is selected, a message at the BASE
    // tells you to tap it to buy another (the base is the shop). Shows the next price, or MAX.
    if (!renderer.baseBuyText) {
      renderer.baseBuyText = new PIXI.Text('', { fontFamily: 'Courier New', fontSize: 15, fontWeight: 'bold',
        fill: 0xffe08a, stroke: 0x0a0e12, strokeThickness: 4, align: 'center' });
      renderer.baseBuyText.anchor.set(0.5, 1);
      renderer.layers.overlay.addChild(renderer.baseBuyText);
    }
    const bt = renderer.baseBuyText;
    const selU = (ui && ui.selectedUnitId != null && state.units) ? state.units.get(ui.selectedUnitId) : null;
    if (state.resourceNodes && selU && selU.isHarvester) {
      const fleet = [...state.units.values()].filter((u) => u && u.isHarvester && u.hp > 0).length;
      const PRICE = [0, 500, 750, 1000];
      bt.text = fleet >= 4 ? '▲ MAX HARVESTERS (4)' : '▲ TAP BASE — HARVESTER $' + PRICE[fleet];
      bt.x = bp.x; bt.y = bp.y - t * 2.0;
      bt.scale.set(1 / ((renderer.camera && renderer.camera.s) || 1));   // constant on-screen size at any zoom
      bt.visible = true;
    } else if (bt) { bt.visible = false; }

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
      const authoredBarrel = renderer.baseSprite && renderer.baseSprite.__weapon;
      if (authoredBarrel) {
        // the owner's barrel art (right-facing) tracks the cannon's live angle; primitives yield
        authoredBarrel.rotation = ang;
      } else {
        gS.beginFill(0x2b3138, 1); gS.drawCircle(bp.x, bp.y, t * 0.52); gS.endFill();           // turret mount
        gS.lineStyle(t * 0.24, col, 1); gS.moveTo(bp.x, bp.y); gS.lineTo(ex, ey); gS.lineStyle(0);   // barrel
      }
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
    if (!renderer.structSprites) renderer.structSprites = new Map();
    const liveStructIds = new Set();
    // structures MOUNTED ON THE SHIP (the base's 4 corner hardpoints) draw at 75% — turrets on the
    // hull, not full towers parked on it (owner). Visual only; combat stats unchanged.
    const shipSlots = new Set(((state.map && state.map.base && state.map.base.cornerSlots) || []).map((c) => c.x + ',' + c.y));
    for (const s of state.structures.values()) {
      if (!s || s.lifecycle === 'Destroyed') continue;
      const fp = s.footprint || { w: 1, h: 1 };
      const onShip = shipSlots.has(s.pos.x + ',' + s.pos.y);
      const shipScale = onShip ? 0.75 : 1;
      let px = s.pos.x * t;
      let py = s.pos.y * t;
      let w = fp.w * t;
      let h = fp.h * t;
      if (onShip) { px += w * 0.125; py += h * 0.125; w *= 0.75; h *= 0.75; }
      // AUTHORED STRUCTURE ART (State Bench, faction "System"): STR-Cannon -> SYS-Cannon etc.
      // tier-aware art: an upgraded structure shows its 'SYS-X-<tier>' art when authored,
      // else falls back to the base 'SYS-X' look
      const sBase = 'SYS-' + String(s.structId || '').replace(/^STR-/, '');
      const sTiered = (s.tier >= 2) ? (sBase + '-' + s.tier) : sBase;
      const okArt = (id) => renderer.unitArt && hasArt(renderer.unitArt, id) && !(renderer._noArt && renderer._noArt.has(id));
      const sArtId = okArt(sTiered) ? sTiered : sBase;
      let artDrawn = false;
      if (okArt(sArtId)) {
        liveStructIds.add(s.id);
        let sspr = renderer.structSprites.get(s.id);
        if (sspr && sspr.__artId !== sArtId) {   // upgraded mid-life → rebuild with the new tier's art
          if (sspr.__shadow) { sspr.__shadow.destroy({ children: true }); renderer.structShadows && renderer.structShadows.delete(s.id); }
          sspr.destroy({ children: true });
          renderer.structSprites.delete(s.id);
          sspr = null;
        }
        if (!sspr) {
          sspr = buildUnitSprite(renderer.unitArt, sArtId, t, (fp.w * 0.375));   // targetW == footprint width
          if (sspr && !sspr.children.length) { sspr.destroy(); sspr = null; }
          if (sspr) {
            sspr.__artId = sArtId;
            // SILHOUETTE SHADOW (owner): a black-tinted clone of the SAME art, drawn under it and
            // offset down-right — the shadow carries the tower's real outline instead of an ellipse
            const shad = buildUnitSprite(renderer.unitArt, sArtId, t, (fp.w * 0.375));
            if (shad) {
              for (const ch of shad.children) ch.tint = 0x000000;
              shad.alpha = 0.32;
              renderer.layers.structures.addChild(shad);
              if (!renderer.structShadows) renderer.structShadows = new Map();
              renderer.structShadows.set(s.id, shad);
              sspr.__shadow = shad;
            }
            renderer.layers.structures.addChild(sspr);   // art added AFTER its shadow → draws on top
            renderer.structSprites.set(s.id, sspr);
          }
          else (renderer._noArt || (renderer._noArt = new Set())).add(sArtId);
        }
        if (sspr) {
          sspr.x = px + w / 2; sspr.y = py + h / 2;
          sspr.scale.set(shipScale);   // container is built at scale 1; hull-mounted turrets shrink to 75%
          sspr.alpha = (s.lifecycle === 'Building' || s.lifecycle === 'Placing') ? 0.55 : 1;
          // TURRET TRACKING (owner): armed towers rotate to face their live target (the sim's
          // s.targetId, refreshed every combat tick) — same smoothed facing as units. Walls/moats
          // never rotate; a tower keeps its last bearing while idle (turrets don't snap home).
          if (s.kind === 'antiGround' || s.kind === 'antiAir') {
            const tu = (s.targetId != null) ? state.units.get(s.targetId) : null;
            if (tu && tu.hp > 0) {
              const dx = (tu.pos.x * t + t * 0.5) - (px + w / 2);
              const dy = (tu.pos.y * t + t * 0.5) - (py + h / 2);
              if (dx * dx + dy * dy > 1) {
                const want = Math.atan2(dy, dx) + UNIT_FACING_OFFSET + Math.PI;   // bench aiming convention is 180 deg from the unit one (owner: all towers aimed backwards)
                sspr.__facing = (sspr.__facing == null) ? want : approachAngle(sspr.__facing, want, 0.25);
              }
            }
            // two-layer turrets (base + barrel): only the BARREL tracks; the base stays planted.
            // Single-layer turrets rotate whole, as before.
            if (sspr.__weapon) sspr.__weapon.rotation = (sspr.__weapon.__baseRot || 0) + (sspr.__facing || 0);
            else sspr.rotation = sspr.__facing || 0;
          }
          if (sspr.__shadow) {
            const sh = sspr.__shadow;
            sh.x = sspr.x + t * 0.10; sh.y = sspr.y + t * 0.12;   // cast-light offset (down-right)
            sh.scale.set(shipScale);
            sh.alpha = 0.32 * sspr.alpha;
            sh.rotation = sspr.rotation;
            if (sh.__weapon && sspr.__weapon) sh.__weapon.rotation = sspr.__weapon.rotation;
          }
          artDrawn = true;
        }
      }
      const color = KIND_COLORS[s.kind] != null ? KIND_COLORS[s.kind] : 0x888888;
      const building = s.lifecycle === 'Placing' || s.lifecycle === 'Building';
      const alpha = building ? 0.55 : (s.lifecycle === 'Selling' ? 0.4 : 1);
      if (artDrawn) {
        // authored art + its SILHOUETTE shadow (black-tinted clone, drawn by the sprite block) —
        // no primitives at all here (the interim ellipse shadow is gone, owner)
      } else {
        gS.beginFill(color, alpha);
        gS.drawRect(px + 2, py + 2, w - 4, h - 4);
        gS.endFill();
        gS.lineStyle(1.5, 0x101418, 0.8);
        gS.drawRect(px + 2, py + 2, w - 4, h - 4);
        gS.lineStyle(0);
      }
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

  // ── MINE DRONES (mines.js): couriers in flight (air) + armed red FLASHING dots (under units) ──
  if (renderer.mineG) {
    const gM = renderer.mineG;
    gM.clear();
    if (state.mines && state.mines.size) {
      for (const m of state.mines.values()) {
        const p = cellToLocal(renderer, m.pos.x, m.pos.y);
        if (m.state === 'flying') {
          // courier: defender-tinted dart at drone altitude + ground shadow, nose toward the target
          const q = cellToLocal(renderer, m.target.x, m.target.y);
          const ang = Math.atan2(q.y - p.y, q.x - p.x);
          const ay = p.y - t * 0.9;
          gA.beginFill(0xbfe8ff, 1);
          gA.moveTo(p.x + Math.cos(ang) * t * 0.22, ay + Math.sin(ang) * t * 0.22);
          gA.lineTo(p.x + Math.cos(ang + 2.6) * t * 0.13, ay + Math.sin(ang + 2.6) * t * 0.13);
          gA.lineTo(p.x + Math.cos(ang - 2.6) * t * 0.13, ay + Math.sin(ang - 2.6) * t * 0.13);
          gA.closePath(); gA.endFill();
          gA.beginFill(0xe03030, 0.9); gA.drawCircle(p.x, ay, t * 0.07); gA.endFill();   // the carried mine
          gM.beginFill(0x000000, 0.2); gM.drawEllipse(p.x, p.y, t * 0.16, t * 0.07); gM.endFill();
        } else {
          // ARMED: the red FLASHING light (owner spec) + a faint trigger ring
          const pulse = 0.45 + 0.45 * Math.sin((state.time || 0) * 6);
          gM.beginFill(0xe03030, pulse); gM.drawCircle(p.x, p.y, t * 0.14); gM.endFill();
          gM.beginFill(0xffb0b0, pulse); gM.drawCircle(p.x, p.y, t * 0.05); gM.endFill();
          let mdef = null;
          try { mdef = getStructureDef(m.structId); } catch (e) { /* unknown id */ }
          if (mdef) { gM.lineStyle(1, 0xe03030, 0.18); gM.drawCircle(p.x, p.y, (mdef.triggerRadius || 0.45) * t); gM.lineStyle(0); }
        }
      }
    }
  }

  // units
  if (state.units) {
    // The SELECTED unit's HP bar must always read on top: bars share one Graphics (gH), where later
    // draws paint over earlier ones — in a crowd, units iterated after the selected one covered its
    // bar. Defer the selected unit's bar and draw it after the loop, last on the graphics.
    const selBarId = (ui && ui.selectedUnitId != null) ? ui.selectedUnitId : null;
    let selBar = null;
    const unitHpBar = (u, cx, topY, w, frac) => {
      if (selBarId !== null && u.id === selBarId) { selBar = [cx, topY, w, frac]; return; }
      drawHpBar(gH, cx, topY, w, frac);
    };
    for (const u of state.units.values()) {
      if (!u || u.hp <= 0) continue;
      emitGroundDust(renderer, u);   // moving walkers kick up rear dust (lingers ≥500ms; sim-neutral)
      // AUTHORED ART: draw a retained sprite part-stack (built lazily, cached by unit id) — so you can SEE
      // which unit/faction is attacking. Units without art fall through to the coloured primitive below.
      const artId = u.artKey || u.unitId;   // the harvester borrows truck STATS but owns its ART slot
      // VOXEL PACKS (Stack Forge) take precedence: a body that snaps to N facings + a turret that aims
      // smoothly from the baked angle cache. Pure texture swaps on retained sprites — no container
      // rotation (the facing IS the frame), so the mount math matches the Forge preview exactly.
      if (renderer.voxelArt && hasVoxel(renderer.voxelArt, artId)) {
        const tier = (getUnitDef(artId) || {}).render_tier || 'A';
        let spr = renderer.unitSprites.get(u.id);
        if (spr && !spr.__vox && !spr.__live3d) {   // was authored art before the pack loaded — rebuild
          if (spr.parent) spr.parent.removeChild(spr);
          spr.destroy({ children: true }); renderer.unitSprites.delete(u.id); spr = null;
        }
        if (!spr) {
          // Tier C (spec §3C): live 3D model — buildLive3D returns null past the §5 cap or when the
          // pack embeds no model, and the unit then renders on the baked Tier B path instead.
          if (tier === 'C') spr = buildLive3D(renderer.voxelArt.units[artId].pack, t, Math.min(u.radius || 0.3, 0.75), SPRITE_OVER_COLLISION);
          if (!spr) spr = buildVoxelUnit(renderer.voxelArt, artId, t, Math.min(u.radius || 0.3, 0.75), SPRITE_OVER_COLLISION);
          if (spr) { renderer.unitSpriteLayer.addChild(spr); renderer.unitSprites.set(u.id, spr); }
        }
        if (spr) {
          const pa = cellToLocal(renderer, u.pos.x, u.pos.y);
          const flyLift = (u.domain === 'Flyer' ? t * 1.05 : 0);
          spr.x = pa.x; spr.y = pa.y - flyLift;
          spr.zIndex = pa.y;                              // Story 4: sort with decor by ground-contact y
          spr.visible = true;
          // heading: real displacement first, waypoint only when barely moving (same as the authored
          // path) — but as a WORLD angle (+X = east), the bake's bucket-0 convention. No facing offset.
          let hx = 0, hy = 0;
          const wp = (u.path && u.pathIdx < u.path.length) ? u.path[u.pathIdx] : null;
          let mvx = 0, mvy = 0;
          if (u._px != null) { mvx = u.pos.x - u._px; mvy = u.pos.y - u._py; }
          if (mvx * mvx + mvy * mvy > 0.00002) { hx = mvx; hy = mvy; }
          else if (wp) { hx = wp.x - u.pos.x; hy = wp.y - u.pos.y; }
          if (hx * hx + hy * hy > 1e-4) {
            const want = Math.atan2(hy, hx);
            spr.__heading = (spr.__heading == null) ? want : approachAngle(spr.__heading, want, 0.3);
          }
          const heading = spr.__heading || 0;
          spr.__facing = heading + UNIT_FACING_OFFSET;   // cargo/debug readers expect the sprite convention
          // turret AIM: live combat target > (#6) the BASE for small tanks (keep the objective in the crosshairs
          // while they drive, whatever way they move) > relax to the heading. Juggernauts keep the default so
          // their turret tracks the defences they pass (#4).
          let aim = heading;
          if (u.domain === 'Walker' && u.role !== 'Juggernaut' && state.base && state.base.pos) aim = Math.atan2(state.base.pos.y - u.pos.y, state.base.pos.x - u.pos.x);
          const tid = u.targetId;
          if (tid !== null && tid !== undefined) {
            const tgt = (tid === -1) ? (state.base || null)
              : (state.units.get(tid) || (state.structures && state.structures.get(tid)) || null);
            if (tgt && tgt.pos) aim = Math.atan2(tgt.pos.y - u.pos.y, tgt.pos.x - u.pos.x);
          }
          spr.__aim = (spr.__aim == null) ? aim : approachAngle(spr.__aim, aim, 0.35);
          // silhouette shadows stay ON THE GROUND: the container lifts with flyers, so counter-shift
          if (spr.__shadows) for (const sh of spr.__shadows) sh.y = flyLift + (sh.__gy || 0);
          // BANK from the turn rate — Tier B's whole trick, and Tier C's roll input (spec §3B/§3C)
          let dHead = (spr.__prevHeading == null) ? 0 : heading - spr.__prevHeading;
          dHead = Math.atan2(Math.sin(dHead), Math.cos(dHead));
          spr.__prevHeading = heading;
          const dtF = renderer._fxDt || FX_DT;
          const wantBank = Math.max(-0.6, Math.min(0.6, (dHead / Math.max(dtF, 1 / 240)) * 0.22));
          spr.__bank = (spr.__bank == null) ? 0 : spr.__bank + (wantBank - spr.__bank) * 0.12;
          if (spr.__live3d) {
            updateLive3D(spr, heading, 0, spr.__bank);               // Tier C: REAL roll on the live model
          } else {
            updateVoxelUnit(spr, heading, spr.__aim);
            if (tier !== 'A' && u.domain === 'Flyer') {              // Tier B: pure screen-space sprite
              spr.rotation = spr.__bank * 0.45;                      // transform — a matrix multiply that
              spr.skew.x = spr.__bank * 0.3;                         // stays inside the batch (spec §3B)
            }
          }
          // hp bar only — the unit carries its own silhouette shadow (no flat ellipse for voxel units)
          unitHpBar(u, pa.x, pa.y - t * ((u.radius || 0.3) * SPRITE_OVER_COLLISION + 0.2) - 7, t * 0.7, u.hp / Math.max(1, u.maxHp));   // #2: structHp layer (over trees); selected unit defers to draw last
          continue;   // voxel sprite drawn — skip authored art and the primitive
        }
      }
      if (renderer.unitArt && hasArt(renderer.unitArt, artId) && !(renderer._noArt && renderer._noArt.has(artId))) {
        let spr = renderer.unitSprites.get(u.id);
        if (!spr) {
          // MAX UNIT WIDTH 2 tiles (owner): the biggest bodies (radius ~0.96 -> 2.56 tiles of art)
          // dwarfed the board and made every gap a clip. Art caps at 2 tiles; collision unchanged.
          spr = buildUnitSprite(renderer.unitArt, artId, t, Math.min(u.radius || 0.3, 0.75));
          // a sprite that built EMPTY (frame names missing from the sheet) would sim invisibly while
          // the primitive path is skipped — an unseeable unit attacking the base. Treat as no-art.
          if (spr && !spr.children.length) { spr.destroy(); spr = null; }
          if (spr) { renderer.unitSpriteLayer.addChild(spr); renderer.unitSprites.set(u.id, spr); }
          else { (renderer._noArt || (renderer._noArt = new Set())).add(artId); }
        }
        if (spr) {
          const pa = cellToLocal(renderer, u.pos.x, u.pos.y);
          const flyLift = (u.domain === 'Flyer' ? t * 1.05 : 0);
          spr.x = pa.x; spr.y = pa.y - flyLift;
          spr.zIndex = pa.y;                              // Story 4: sort with decor by ground-contact y
          spr.visible = true;
          // FACE MOVEMENT: turn the whole part-stack to point along the unit's heading — from the next path
          // waypoint, else its last-tick movement — so it drives forward instead of sliding sideways. A still
          // unit keeps its last facing. Smoothed so turns ease rather than snap.
          let hx = 0, hy = 0;
          const wp = (u.path && u.pathIdx < u.path.length) ? u.path[u.pathIdx] : null;
          // FACE THE MOTION, not the waypoint (owner: units 'sliding sideways'): in dense funnels
          // separation moves a unit laterally while its waypoint sits ahead — waypoint-facing made
          // that read as strafing. Real displacement first; waypoint only when barely moving.
          let mvx = 0, mvy = 0;
          if (u._px != null) { mvx = u.pos.x - u._px; mvy = u.pos.y - u._py; }
          if (mvx * mvx + mvy * mvy > 0.00002) { hx = mvx; hy = mvy; }
          else if (wp) { hx = wp.x - u.pos.x; hy = wp.y - u.pos.y; }
          if (hx * hx + hy * hy > 1e-4) {
            const target = Math.atan2(hy, hx) + UNIT_FACING_OFFSET;
            spr.__facing = (spr.__facing == null) ? target : approachAngle(spr.__facing, target, 0.3);
          }
          const facing = spr.__facing || 0;
          spr.rotation = facing;
          // SQUEEZE (owner): 2-wide units compress through 1-tile gaps. When both flanks
          // (perpendicular to facing) are blocked cells, squash the sprite laterally to the gap
          // width and stretch it slightly along the motion — the clip becomes a squeeze. Purely
          // visual; the sim's centre-line passage is unchanged.
          {
            const grid = state.navGrid;
            const halfW = (u.radius || 0.3) * SPRITE_OVER_COLLISION;   // sprite half-width, tiles
            if (grid && grid.passable && halfW > 0.5) {
              const wa = facing - UNIT_FACING_OFFSET;                   // world motion angle
              const perpX = -Math.sin(wa), perpY = Math.cos(wa);
              const blockedAt = (x, y) => {
                const cx = Math.round(x), cy = Math.round(y);
                if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return true;
                return !grid.passable[cy * grid.cols + cx];
              };
              const L = blockedAt(u.pos.x + perpX, u.pos.y + perpY);
              const R = blockedAt(u.pos.x - perpX, u.pos.y - perpY);
              const want = (L && R) ? Math.min(1, 0.92 / (halfW * 2)) : 1;   // fit a ~1-tile slot
              spr.__squeeze = (spr.__squeeze == null) ? 1 : spr.__squeeze + (want - spr.__squeeze) * 0.25;
              const q = spr.__squeeze;
              spr.scale.set(q, 1 + (1 - q) * 0.35);   // conserve a little volume: squash x, stretch y
            } else if (spr.__squeeze != null && spr.__squeeze !== 1) {
              spr.__squeeze += (1 - spr.__squeeze) * 0.25;
              spr.scale.set(spr.__squeeze, 1 + (1 - spr.__squeeze) * 0.35);
            }
          }
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
          unitHpBar(u, pa.x, pa.y - t * ((u.radius || 0.3) * SPRITE_OVER_COLLISION + 0.2) - 7, t * 0.7, u.hp / Math.max(1, u.maxHp));   // #2: structHp layer (over trees); selected unit defers to draw last
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
        unitHpBar(u, p.x, py - r - 7, t * 0.7, u.hp / Math.max(1, u.maxHp));   // #2: over trees; selected defers
      } else if (u.domain === 'Floater' || u.domain === 'Swimmer') {
        gU.beginFill(color, 1);
        gU.drawEllipse(p.x, p.y, r * 1.15, r * 0.7);
        gU.endFill();
        gU.lineStyle(1, 0x101418, 0.8);
        gU.drawEllipse(p.x, p.y, r * 1.15, r * 0.7);
        gU.lineStyle(0);
        unitHpBar(u, p.x, p.y - r - 8, t * 0.7, u.hp / Math.max(1, u.maxHp));   // #2: over trees; selected defers
      } else {
        gU.beginFill(color, 1);
        gU.drawCircle(p.x, p.y, r);
        gU.endFill();
        gU.lineStyle(1, 0x101418, 0.8);
        gU.drawCircle(p.x, p.y, r);
        gU.lineStyle(0);
        unitHpBar(u, p.x, p.y - r - 8, t * 0.7, u.hp / Math.max(1, u.maxHp));   // #2: over trees; selected defers
      }
    }
    // deferred: the selected unit's bar goes down LAST on gH — nothing drawn this frame can cover it
    if (selBar) drawHpBar(gH, selBar[0], selBar[1], selBar[2], selBar[3], 0.85);
  }

  // ---- FORGE / openPlay maps: no hard ring lock, but still DIM the board outside the current wave's
  //      authored window (+ the base zone) so the active battle area reads clearly and enemies emerge from
  //      a dim border instead of popping in at full brightness. Cheap: ≤4 rectangular bands, no per-cell
  //      work, redrawn on the same overlay graphics that's already cleared each frame. ----
  if (GROWTH_CAM && state.map && state.map.openPlay && state.map.fromForge && state.map.waveWindows && state.map.waveWindows.length) {
    const wins = state.map.waveWindows, W = state.map.cols, H = state.map.rows;
    const wv = state.waves || { current: 0, active: false };
    const wantWave = Math.max(1, Math.min(wv.active ? wv.current : wv.current + 1, wins[wins.length - 1].wave));
    const win = wins.find((q) => q.wave === wantWave) || wins[wins.length - 1];
    const wr = (win.x0 != null)                                   // tolerate either {x0..} or {x,y,w,h}
      ? { x0: win.x0, y0: win.y0, x1: win.x1, y1: win.y1 }
      : { x0: win.x - 1, y0: win.y - 1, x1: win.x - 1 + win.w - 1, y1: win.y - 1 + win.h - 1 };
    let x0 = wr.x0, y0 = wr.y0, x1 = wr.x1, y1 = wr.y1;
    if (state.base) { x0 = Math.min(x0, state.base.pos.x - 2); y0 = Math.min(y0, state.base.pos.y - 2); x1 = Math.max(x1, state.base.pos.x + 2); y1 = Math.max(y1, state.base.pos.y + 2); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
    const bnd = [];                                               // the ≤4 bands of the board outside [x0..x1, y0..y1]
    if (y0 > 0) bnd.push([0, 0, W, y0]);
    if (y1 < H - 1) bnd.push([0, y1 + 1, W, H - 1 - y1]);
    if (x0 > 0) bnd.push([0, y0, x0, y1 - y0 + 1]);
    if (x1 < W - 1) bnd.push([x1 + 1, y0, W - 1 - x1, y1 - y0 + 1]);
    if (bnd.length) {
      gO.beginFill(0x05070a, 0.34);
      for (const [bx, by, bw, bh] of bnd) gO.drawRect(bx * t, by * t, bw * t, bh * t);
      gO.endFill();
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
    renderDecor(renderer);   // build the static decor props once for this map (no-op after)
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
      if (node.wave > wv) continue;   // RING SEEDING: a wave's fields arrive with its ring (owner)
      // seed bloom — the moment a ring's field first appears, it announces itself
      if (!renderer._seededNodes) renderer._seededNodes = new Set();
      if (!renderer._seededNodes.has(node.id)) {
        renderer._seededNodes.add(node.id);
        if (state.time > 1) {   // skip the initial board fill — only mid-battle arrivals bloom
          const sp = cellToLocal(renderer, node.x, node.y);
          spawnGlow(renderer, sp.x, sp.y, 0.7, 0.5, COLOR_TINT[node.color] || 0xffd76a);
        }
      }
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
    // harvester cargo bars (over each truck) — fill as they pull, empty on deposit — plus the LOAD
    // ITSELF: crystal lumps stacked on the bed that grow with the haul, tinted by what's carried
    for (const hid of state.harvesterIds || []) {
      const hv = state.units.get(hid);
      if (hv && hv.hp > 0 && hv.capacity) {
        const p = cellToLocal(renderer, hv.pos.x, hv.pos.y);
        const w = t * 0.9, frac = Math.min(1, hv.cargo / hv.capacity);
        // the LOAD rides in the bed as the real crystal SPRITE (small) — the same atlas art the
        // fields use, colour following the cargo, growing with the haul. Primitive lump fallback
        // until the atlas resolves.
        const cargoPool = pools && hv.cargoColor && pools[hv.cargoColor] && pools[hv.cargoColor].length ? pools[hv.cargoColor] : null;
        let cspr = renderer.cargoSprites.get(hid);
        if (frac > 0.02 && art && cargoPool) {
          const wantTex = art.textures[cargoPool[0]];
          if (!cspr) {
            cspr = new PIXI.Sprite(wantTex);
            cspr.anchor.set(0.5, 0.62);
            renderer.cargoLayer.addChild(cspr);
            renderer.cargoSprites.set(hid, cspr);
          }
          if (cspr.texture !== wantTex) cspr.texture = wantTex;   // color follows the cargo
          cspr.visible = true;
          // the load rides IN THE BED — 20% of the body toward the truck's REAR, following its
          // live facing (owner: the payload sat centered on the cab)
          const uspr = renderer.unitSprites && renderer.unitSprites.get(hid);
          if (uspr && uspr.__facing != null) {
            const hdg = uspr.__facing - UNIT_FACING_OFFSET;          // facing -> world heading angle
            cspr.x = p.x - Math.cos(hdg) * t * 0.38;
            cspr.y = p.y - Math.sin(hdg) * t * 0.38;
          } else {
            cspr.x = p.x; cspr.y = p.y + t * 0.10;                    // no facing yet (docked) — near-center
          }
          const targetH = t * 0.34 * (0.55 + 0.45 * frac);        // grows with the load
          cspr.scale.set(targetH / Math.max(1, cspr.texture.height));
        } else if (cspr) {
          cspr.visible = false;                                    // empty bed (or bed emptied)
        } else if (frac > 0.02) {
          const lumpC = COLOR_TINT[hv.cargoColor] || 0xffd76a;     // atlas not loaded yet — primitive lumps
          const base = t * 0.10 * (0.5 + 0.5 * frac);
          gO.beginFill(lumpC, 0.95); gO.drawCircle(p.x - 0.1 * t, p.y + 0.1 * t, base); gO.endFill();
        }
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

  // retire cargo sprites whose harvester is gone
  if (renderer.cargoSprites && renderer.cargoSprites.size) {
    for (const [hid, cspr] of renderer.cargoSprites) {
      const hv = state.units && state.units.get(hid);
      if (!hv || hv.hp <= 0) {
        if (cspr.parent) cspr.parent.removeChild(cspr);
        cspr.destroy();
        renderer.cargoSprites.delete(hid);
      }
    }
  }

  // retire structure art sprites for structures that are gone/destroyed
  if (renderer.structSprites && renderer.structSprites.size) {
    for (const [sid, sspr] of renderer.structSprites) {
      const st = state.structures && state.structures.get(sid);
      if (!st || st.lifecycle === 'Destroyed') {
        if (sspr.__shadow) {
          if (sspr.__shadow.parent) sspr.__shadow.parent.removeChild(sspr.__shadow);
          sspr.__shadow.destroy({ children: true });
          if (renderer.structShadows) renderer.structShadows.delete(sid);
        }
        if (sspr.parent) sspr.parent.removeChild(sspr);
        sspr.destroy({ children: true });
        renderer.structSprites.delete(sid);
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
  // prune per-unit tracking maps for entities that no longer exist (else they grow unbounded over a session)
  if (renderer._shotClock && renderer._shotClock.size) {
    // _shotClock keys are PREFIXED ('u12' unit, 's7' structure — see fire()). Checking the raw key
    // against the numeric-id entity maps always missed, so every clock entry was pruned every frame —
    // which disabled the cadence gate entirely: a shell spawned per FRAME and streams read as laser
    // beams. Strip the prefix and check the matching map.
    for (const id of renderer._shotClock.keys()) {
      const n = Number(String(id).slice(1));
      const live = String(id)[0] === 's'
        ? (state.structures && state.structures.has(n))
        : (state.units && state.units.has(n));
      if (!live) renderer._shotClock.delete(id);
    }
  }
  if (renderer._lastUnitPos && renderer._lastUnitPos.size) {
    for (const id of renderer._lastUnitPos.keys()) if (!(state.units && state.units.has(id))) renderer._lastUnitPos.delete(id);
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
    // mine ghost: read as a MINE, not a building — red dot + trigger/blast circles
    try {
      const gdef = getStructureDef(ui.buildSelection);
      if (gdef && gdef.kind === 'mine') {
        const cx = gx + t / 2, cy = gy + t / 2;
        gO.beginFill(0xe03030, ok ? 0.85 : 0.35); gO.drawCircle(cx, cy, t * 0.12); gO.endFill();
        gO.lineStyle(1.5, tint, 0.9); gO.drawCircle(cx, cy, (gdef.triggerRadius || 0.45) * t);
        gO.lineStyle(1, tint, 0.5); gO.drawCircle(cx, cy, (gdef.blastRadius || 0.5) * t); gO.lineStyle(0);
      }
    } catch (e) { /* unknown build id */ }
  }

  emitCombatFx(renderer, state);   // shells/tracers + damage fire + flyer sparks (cosmetic)

  // UPGRADING structures spark like a repair in progress (owner) — same welding sparks, emitted
  // across the footprint while the upgrade timer runs
  if (state.structures) {
    for (const us of state.structures.values()) {
      if (!us || us.lifecycle !== 'Upgrading') continue;
      if (Math.random() < 0.45) {
        const fp = us.footprint || { w: 1, h: 1 };
        const cx = us.pos.x + ((fp.w || 1) - 1) / 2 + (Math.random() * 2 - 1) * 0.3;
        const cy = us.pos.y + ((fp.h || 1) - 1) / 2 + (Math.random() * 2 - 1) * 0.3;
        const wp = cellToLocal(renderer, cx, cy);
        spawnSparks(renderer, wp.x, wp.y - t * 0.12, 1 + (Math.random() * 2 | 0));
      }
    }
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
  // invert the camera transform (hybrid growth zoom): screen px -> world px -> cell
  const cam = renderer.camera || { s: 1, x: 0, y: 0 };
  const wx = (sx - cam.x) / cam.s;
  const wy = (sy - cam.y) / cam.s;
  const x = Math.max(0, Math.min(renderer.map.cols - 1, Math.floor(wx / t)));
  const y = Math.max(0, Math.min(renderer.map.rows - 1, Math.floor(wy / t)));
  return { x: x, y: y };
}

// Ring-framing growth camera — playtest verdict (owner): the full field + 2-tile safe border
// should be on screen from wave 1, so the zoom is OFF by default. Flip GROWTH_CAM to revisit
// (the eased zoom-out per wave still works; it just wasn't the right feel at these map sizes).
// GROWTH CAMERA (owner: the camera pulls back each wave to reveal more map — never meant to be off).
// It frames the CURRENT ring and eases out as the ring grows, so the world visibly expands. Two
// caps keep it playable on every screen:
//   MAX_ZOOM — how far it zooms IN on the small early rings (dramatic + big, tappable cells).
//   a TAPPABILITY FLOOR — it never zooms OUT so far that cells fall below ~MIN_CELL_CSS on THIS
//     screen. On a phone + a 64-wide map that keeps the view framed on the active battle (you'd
//     pan for the rest); on a 50" monitor the floor is slack so the whole map reveals. Screen-aware
//     and automatic — the same map plays right on both.
const GROWTH_CAM = true;
const MAX_ZOOM = 2.6;
const MIN_CELL_CSS = 14;   // touch floor — matches the current mobile map-1 comfort (~15px); only big maps get held zoomed-in

function updateCamera(renderer, state, dt) {
  const cam = renderer.camera || (renderer.camera = { s: 1, x: 0, y: 0 });
  const map = state.map;
  let ts = 1, tx = 0, ty = 0;
  const wins = (map && map.fromForge && map.waveWindows && map.waveWindows.length) ? map.waveWindows : null;
  if (GROWTH_CAM && map && (wins || (map.rings && map.rings.length)) && map.openPlay) {
    const t = renderer.tile;
    const w = state.waves || { current: 0, active: false };
    // active wave -> frame ITS area; build phase / interlude -> frame the NEXT wave's area.
    // FORGE MAPS (story-mrmwjoua234): the AUTHORED wave windows are the design contract for what the
    // player sees each wave — frame those; workbook rings only for generator maps.
    let r;
    if (wins) {
      const wantWave = Math.max(1, Math.min(w.active ? w.current : w.current + 1, wins[wins.length - 1].wave));
      const win = wins.find((q) => q.wave === wantWave) || wins[wins.length - 1];
      r = { x0: win.x0, y0: win.y0, x1: win.x1, y1: win.y1 };
    } else {
      const idx = Math.max(0, Math.min(w.active ? w.current - 1 : w.current, map.rings.length - 1));
      r = map.rings[idx].rect;
    }
    // Breathing room: generator rings get 3 tiles so the safe border stays visible. AUTHORED forge
    // windows get NONE — the designer's H/W/X/Y rect IS the intended view (owner 2026-07-16: "the
    // camera does not perfectly match the design"); padding made every window read ~6 tiles wider.
    const PAD = wins ? 0 : 3;
    const rw = (r.x1 - r.x0 + 1 + PAD * 2) * t;
    const rh = (r.y1 - r.y0 + 1 + PAD * 2) * t;
    const W = map.cols * t, H = map.rows * t;
    // TAPPABILITY FLOOR: at scale 1 a cell is (canvasCSSwidth / cols) px on screen; to keep it
    // >= MIN_CELL_CSS we must stay zoomed to at least this scale (only bites on big-map + small-screen).
    const canvasCssW = (renderer.app && renderer.app.view && renderer.app.view.clientWidth) || W;
    const cellCssAt1 = canvasCssW / map.cols;
    const floor = Math.max(0.5, MIN_CELL_CSS / Math.max(1, cellCssAt1));
    // frame the ring so BOTH axes fit (+padding); zoom-IN capped; never zoom out past full board
    const ringFill = Math.min(W / rw, H / rh);
    ts = Math.min(MAX_ZOOM, Math.max(1, ringFill));   // ring framing, 1..MAX_ZOOM
    // tappability floor: generator maps only — on AUTHORED forge windows the design rect is the
    // contract; the floor zoomed past it on phones and cropped the window (owner 2026-07-16 mobile)
    if (!wins) ts = Math.max(ts, floor);
    const cx = ((r.x0 + r.x1 + 1) / 2) * t, cy = ((r.y0 + r.y1 + 1) / 2) * t;
    tx = Math.min(0, Math.max(W - W * ts, W / 2 - cx * ts));   // clamp: never show past the board edge
    ty = Math.min(0, Math.max(H - H * ts, H / 2 - cy * ts));
  }
  const k = 1 - Math.exp(-dt * 2.2);   // smooth ease, ~1s to settle
  cam.s += (ts - cam.s) * k;
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  renderer.root.scale.set(cam.s);
  if (!renderer.shake || renderer.shake.dur <= 0) {   // shake owns position while active
    renderer.root.x = cam.x;
    renderer.root.y = cam.y;
  }
}

export function cellToScreen(renderer, cell) {
  const t = renderer.tile;
  return { x: (cell.x + 0.5) * t, y: (cell.y + 0.5) * t };
}
