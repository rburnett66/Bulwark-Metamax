/**
 * prototype/test-game/src/harness/partstack.js  [state-harness sh-m1.s3 — reconciled]
 *
 * The layered unit part-stack: base < weapon < head, each with its own pivot + transform. Reconciles the two
 * parallel develop attempts (sh-m1.s3 and s4 BOTH wrote a buildPartStack into renderer.js — a duplicate/conflict)
 * into ONE coherent module. The LAYOUT is a pure, deterministic, Pixi-free function (partStackLayout) — the
 * observable surface the scenarios assert; buildPartStack turns it into Pixi display objects (the accurate render,
 * requires a global PIXI). Full wiring into the live unit render depends on sh-m1.s2 (unit part definitions).
 */

export const PART_STACK_ORDER = ['base', 'weapon', 'head'];
const PART_Z = { base: 0, weapon: 1, head: 2 };

/**
 * Pure layout: given a parts spec, return the ordered draw list with resolved z / pivot / transform.
 *   parts: { base?, weapon?, head? }, each { sprite?, draw?, pivot?, pos?, rotation?, scale? }
 *   returns [{ name, z, pivot:{x,y}, pos:{x,y}, rotation, scale }] sorted by z (base first).
 */
export function partStackLayout(parts) {
  const out = [];
  for (const name of PART_STACK_ORDER) {
    const def = parts && parts[name];
    if (!def) continue;
    out.push({
      name,
      z: PART_Z[name],
      pivot: def.pivot ? { x: def.pivot.x || 0, y: def.pivot.y || 0 } : { x: 0, y: 0 },
      pos: def.pos ? { x: def.pos.x || 0, y: def.pos.y || 0 } : { x: 0, y: 0 },
      rotation: typeof def.rotation === 'number' ? def.rotation : 0,
      scale: typeof def.scale === 'number' ? def.scale : 1,
    });
  }
  out.sort((a, b) => a.z - b.z);
  return out;
}

/** Build the Pixi container for a unit from its parts, using the shared layout (needs a global PIXI). */
export function buildPartStack(parts) {
  const container = new PIXI.Container();
  const built = {};
  for (const layer of partStackLayout(parts)) {
    const def = parts[layer.name];
    const sprite = def.sprite ? new PIXI.Sprite(def.sprite) : new PIXI.Graphics();
    if (!def.sprite && def.draw) def.draw(sprite);
    if (sprite.pivot && sprite.pivot.set) sprite.pivot.set(layer.pivot.x, layer.pivot.y);
    sprite.x = layer.pos.x; sprite.y = layer.pos.y;
    sprite.rotation = layer.rotation;
    if (sprite.scale && sprite.scale.set) sprite.scale.set(layer.scale, layer.scale);
    sprite.zIndex = layer.z;
    container.addChild(sprite);
    built[layer.name] = sprite;
  }
  container.sortableChildren = true;
  if (container.sortChildren) container.sortChildren();
  container.parts = built;
  return container;
}
