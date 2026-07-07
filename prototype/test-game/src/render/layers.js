package com.metamax.bulwark;

Looking at this request, I need to output the raw JavaScript content for `src/render/layers.js`.

```javascript
// src/render/layers.js
// Layer/container registry for the Bulwark renderer.
// Establishes painter's-algorithm z-order back->front:
//   sky, water(surface + sub-surface tint), ground bands, ground shadows,
//   grass/bushes, trees, ground units, structures, projectiles/ground FX,
//   air units (+ dim altitude shadows), clouds, muzzle/impact FX, fog, HUD-space.
//
// This module READS nothing from sim state; it only builds and owns the
// PIXI.Container hierarchy that other draw modules populate each frame.
// Presentation only — never mutates sim state.

const PIXI = (typeof window !== 'undefined' && window.PIXI) ? window.PIXI : globalThis.PIXI;

// Ordered layer definitions, back -> front.
// `depthSorted` layers get sortableChildren so per-frame Y depth sort works.
export const LAYER_ORDER = [
  'sky',
  'water',          // water surface
  'waterSub',       // sub-surface tint (submerged swimmers read below surface)
  'groundBands',    // low/mid/high ground bands
  'groundShadows',  // soft ground shadows (units/structures/trees)
  'foliage',        // grass / bushes
  'trees',          // trees with cast shadows
  'paths',          // recomputed walker path lines + deploy march line
  'slots',          // hard-point slot markers / build overlays
  'groundUnits',    // walkers, floaters (depth-sorted)
  'structures',     // towers, walls, moats, base (depth-sorted)
  'groundFX',       // projectiles that travel on/near ground, ground impacts
  'airShadows',     // dim altitude shadows for flyers
  'airUnits',       // flyers
  'clouds',         // drifting clouds (dim ground / occlude air)
  'muzzleFX',       // muzzle flashes, impact FX
  'fog',            // fog of war
  'overlay',        // in-world overlay (range circles, selection dashed rings)
];

// Which layers should be depth-sorted by ground anchor Y each frame.
const DEPTH_SORTED = new Set(['groundUnits', 'structures']);

/**
 * LayerRegistry
 * Owns the root "world" container (rotatable/scalable camera space) plus
 * each named sub-layer container in painter order.
 */
export class LayerRegistry {
  constructor(app) {
    this.app = app;

    // World container: everything that lives in board space and can be
    // affected by camera rotation / zoom / pan. The HUD is NOT part of this;
    // the HUD is screen-space and lives outside (see hud/dom.js).
    this.world = new PIXI.Container();
    this.world.sortableChildren = false; // we manage order explicitly via zIndex
    this.world.name = 'world';

    // Camera pivot helper — allows rotation about a chosen board point.
    this.world.eventMode = 'static';

    this.layers = {};

    LAYER_ORDER.forEach((name, i) => {
      const c = new PIXI.Container();
      c.name = name;
      c.zIndex = i;
      if (DEPTH_SORTED.has(name)) {
        c.sortableChildren = true; // children ordered by their own zIndex (anchor Y)
      }
      this.layers[name] = c;
      this.world.addChild(c);
    });

    // Ensure explicit z-order honored on the world container.
    this.world.sortableChildren = true;
    this.world.sortChildren();

    // Mount world into the stage.
    if (app && app.stage) {
      app.stage.addChild(this.world);
    }
  }

  /** Get a named layer container. Throws if unknown to catch typos early. */
  get(name) {
    const c = this.layers[name];
    if (!c) throw new Error(`[layers] unknown layer: ${name}`);
    return c;
  }

  /** True if the named layer is depth-sorted per frame. */
  isDepthSorted(name) {
    return DEPTH_SORTED.has(name);
  }

  /** Remove all display children from a single layer (keeps the container). */
  clearLayer(name) {
    const c = this.get(name);
    c.removeChildren();
  }

  /** Remove all children from every layer. Used on hard resets. */
  clearAll() {
    LAYER_ORDER.forEach((n) => this.get(n).removeChildren());
  }

  /**
   * Add a display object to a layer.
   * @param {string} name  layer name
   * @param {PIXI.DisplayObject} obj
   */
  add(name, obj) {
    this.get(name).addChild(obj);
    return obj;
  }

  /**
   * Camera transform helpers. Rotation is a first-class control (spec).
   * Rotating the world re-runs depth sort implicitly because sortableChildren
   * layers re-sort on next render; shadow offsets are re-projected by the
   * draw modules against the fixed sun each frame.
   */
  setCamera({ x = 0, y = 0, rotation = 0, scale = 1, pivotX = 0, pivotY = 0 } = {}) {
    this.world.pivot.set(pivotX, pivotY);
    this.world.position.set(x, y);
    this.world.rotation = rotation;
    this.world.scale.set(scale, scale);
  }

  getCameraRotation() {
    return this.world.rotation;
  }

  rotateBy(delta) {
    this.world.rotation += delta;
  }

  /**
   * Trigger per-frame depth sort on the depth-sorted layers.
   * drawEntities/depthSort assign child.zIndex = projected ground-anchor Y;
   * calling this re-orders them for the current frame.
   */
  applyDepthSort() {
    DEPTH_SORTED.forEach((name) => {
      const c = this.layers[name];
      if (c) c.sortChildren();
    });
  }

  /** Convert a screen (stage) point into world/board space. */
  screenToWorld(screenPoint, out) {
    return this.world.toLocal(screenPoint, undefined, out);
  }

  /** Convert a world/board point into screen (stage) space. */
  worldToScreen(worldPoint, out) {
    return this.world.toGlobal(worldPoint, out);
  }

  /** Tear down all containers. */
  destroy() {
    if (this.world) {
      this.world.destroy({ children: true });
    }
    this.layers = {};
    this.world = null;
  }
}

/** Factory to match the style used elsewhere in the codebase. */
export function createLayers(app) {
  return new LayerRegistry(app);
}

export default LayerRegistry;