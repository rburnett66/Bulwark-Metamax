/**
 * prototype/test-game/src/harness/parts.js  [state-harness sh-m1.s2]
 *
 * PORTABLE unit PART-STACK definitions — the visual base/weapon/head for a unit, as pure PIXI.Graphics draw
 * specs the harness feeds to buildPartStack. Keyed by the unit's `shape` so units are DROPPABLE: pick any unit
 * and it renders (unknown shapes fall back to a generic chassis). No textures / no art pipeline — draw fns paint
 * primitives so a unit renders offline. The render DRIVES these from readouts (drive.js):
 *   base   <- health     (chassis)
 *   weapon <- aim         (turret + barrel; rotation = aimAngle)
 *   head   <- awareness   (sensor)
 */

// CANONICAL per-layer footprint widths (px, pre stack-scale) that authored sprites are normalised to.
// The bench authors against these, and the GAME must render with the same ratios (weapon ~65% of base,
// head ~39%) — one constant, or tool and battle-map scale drift apart. Shared by bench.js + unitArt.js.
export const LAYER_FIT = { base: 46, weapon: 30, head: 18 };

// Palette per broad unit class (generic-safe fallback). Kept data-only so new factions/shapes just add a row.
const PALETTES = {
  Troops:        { body: 0x6f8f3f, trim: 0x9bd15a, barrel: 0x2f3d1e, sensor: 0x7fd6e0 },
  Trucks:        { body: 0x8a7b45, trim: 0xd4b45f, barrel: 0x3a3120, sensor: 0x7fd6e0 },
  Tanks:         { body: 0x556070, trim: 0x8fa2b8, barrel: 0x2a3038, sensor: 0xff9a5f },
  Artillery:     { body: 0x6b5560, trim: 0xb98aa2, barrel: 0x342630, sensor: 0xff7fa0 },
  'Heavy Tanks': { body: 0x445866, trim: 0x7f9fb0, barrel: 0x222c34, sensor: 0xff9a5f },
  Floaters:      { body: 0x3f6f8f, trim: 0x5abed1, barrel: 0x1e343d, sensor: 0x9affd6 },
  Copters:       { body: 0x5f5f7a, trim: 0x9a9ad1, barrel: 0x26263a, sensor: 0xd6d6ff },
  Planes:        { body: 0x6a6a55, trim: 0xc9c98a, barrel: 0x30301e, sensor: 0xffffd6 },
  Missiles:      { body: 0x7a4545, trim: 0xd45f5f, barrel: 0x3a2020, sensor: 0xffd6d6 },
  _default:      { body: 0x5a6470, trim: 0x9aa6b4, barrel: 0x2a3038, sensor: 0x7fd6e0 },
};

function paletteFor(def) { return PALETTES[def && def.shape] || PALETTES._default; }

// Rough silhouette size per class (walker default). Kept modest; the bench scales the whole stack up.
// EXPORTED because it defines what "unit-sized" means in authoring space: art normalised to LAYER_FIT.base
// (46) replaces a chassis this wide, so the GAME must render art at footprint × (46 / dims.w) to read at
// the same presence as the bench (unitArt.js).
export function dimsFor(def) {
  switch (def && def.shape) {
    case 'Heavy Tanks': return { w: 34, h: 24 };
    case 'Tanks':       return { w: 30, h: 20 };
    case 'Artillery':   return { w: 30, h: 18 };
    case 'Trucks':      return { w: 28, h: 18 };
    case 'Troops':      return { w: 24, h: 16 };
    case 'Copters':
    case 'Planes':
    case 'Floaters':    return { w: 26, h: 16 };
    default:            return { w: 28, h: 18 };
  }
}

function drawChassis(g, p, w, h) {
  g.clear();
  g.beginFill(p.body); g.drawRoundedRect(-w / 2, -h / 2, w, h, 4); g.endFill();
  g.lineStyle(1.5, 0x0c1014, 0.7); g.drawRoundedRect(-w / 2, -h / 2, w, h, 4);
  g.lineStyle(0); g.beginFill(p.trim, 0.5); g.drawRect(-w / 2 + 3, -h / 2 + 3, w - 6, 3); g.endFill();
}

function drawTurret(g, p) {
  g.clear();
  // barrel extends +x from the hub; the hub is the pivot (0,0) so rotation = aimAngle points the barrel at target
  g.beginFill(p.barrel); g.drawRect(0, -2.5, 20, 5); g.endFill();
  g.beginFill(p.trim); g.drawCircle(0, 0, 7); g.endFill();
  g.lineStyle(1, 0x0c1014, 0.7); g.drawCircle(0, 0, 7);
}

function drawSensor(g, p) {
  g.clear();
  g.beginFill(p.sensor); g.drawCircle(0, 0, 4.5); g.endFill();
  g.lineStyle(1, 0x0c1014, 0.6); g.drawCircle(0, 0, 4.5);
}

/**
 * The part-stack spec for a unit def — { base, weapon, head }, each a buildPartStack layer
 * ({ draw, pivot, pos }). Always returns a valid stack (generic fallback), so ANY unit is droppable.
 */
export function unitParts(def) {
  const p = paletteFor(def);
  const d = dimsFor(def);
  return {
    base:   { draw: (g) => drawChassis(g, p, d.w, d.h), pivot: { x: 0, y: 0 }, pos: { x: 0, y: 0 } },
    weapon: { draw: (g) => drawTurret(g, p),            pivot: { x: 0, y: 0 }, pos: { x: 0, y: -d.h * 0.15 } },
    head:   { draw: (g) => drawSensor(g, p),            pivot: { x: 0, y: 0 }, pos: { x: 0, y: -d.h * 0.5 - 6 } },
  };
}
