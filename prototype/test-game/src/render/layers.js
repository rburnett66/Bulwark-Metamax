// src/render/layers.js
// Defines back→front render layers (sky / water / ground / units / FX / HUD)
// Painter's-algorithm z-order container stack for the Pixi stage.
//
// This module vendors NO external dependency of its own; it consumes the
// globally-vendored PIXI (loaded via vendor/pixi.min.js) that renderer.js
// passes in, OR falls back to window.PIXI. It exposes a Layers class that
// creates and owns an ordered set of PIXI.Container objects.
//
// READ-ONLY WITH RESPECT TO SIM STATE — layers only own display objects.

const PIXI = (typeof window !== 'undefined' && window.PIXI) ? window.PIXI : null;

/**
 * Canonical back→front layer order per the VIEW spec:
 *  sky, water (surface + sub-surface tint), ground bands, ground shadows,
 *  grass/bushes, trees+shadows, ground units, structures,
 *  projectiles/ground FX, air units + altitude shadows, clouds,
 *  muzzle/impact FX, fog of war, screen-space HUD.
 *
 * We collapse the design's fine-grained bands into functional layers the
 * renderer draws into. Order in this array === back→front z-order.
 */
export const LAYER_ORDER = [
  'sky',        // solid backdrop
  'water',      // water surface + sub-surface tint (drawMap)
  'ground',     // ground bands + slots + base footprint (drawMap)
  'shadows',    // ground/structure/tree soft shadows
  'decor',      // grass, bushes, trees (static decor)
  'path',       // recomputed walker path + deploy march line
  'groundUnits',// walkers, floaters (ground/water sim units)
  'structures', // towers, walls, moats + range circles + lifecycle FX
  'groundFX',   // projectiles / ground-level FX
  'airUnits',   // flyers + dim altitude shadows
  'clouds',     // drifting clouds (dim ground / occlude air)
  'fx',         // muzzle / impact FX, coin popups, gold deltas
  'ghost',      // placement ghost (valid/invalid tint) — above world, below HUD
  'fog',        // fog of war overlay
  'hud'         // screen-space HUD (never rotates)
];

// Layers that belong to the rotatable / camera-transformed world.
// HUD, fog and ghost stay in screen space (ghost tracks pointer directly).
export const WORLD_LAYERS = [
  'sky', 'water', 'ground', 'shadows', 'decor', 'path',
  'groundUnits', 'structures', 'groundFX', 'airUnits', 'clouds', 'fx'
];

// Layers that are painted in screen space (unaffected by camera rotation).
export const SCREEN_LAYERS = ['ghost', 'fog', 'hud'];

/**
 * Layers — owns an ordered stack of containers added to the stage.
 *
 * Usage:
 *   const layers = new Layers(app.stage, PIXI);
 *   layers.get('groundUnits').addChild(sprite);
 *   layers.clearDynamic();               // wipe per-frame redraw layers
 *   layers.depthSort('groundUnits');     // painter re-sort by anchorY
 */
export class Layers {
  /**
   * @param {PIXI.Container} stage root stage
   * @param {object} [pixi] optional PIXI namespace override (else global)
   */
  constructor(stage, pixi) {
    this.PIXI = pixi || PIXI;
    if (!this.PIXI) {
      throw new Error('[layers] PIXI not available (vendor/pixi.min.js not loaded)');
    }
    this.stage = stage;

    /** @type {Object<string, PIXI.Container>} */
    this.containers = {};

    // A container that holds all WORLD layers so the camera transform can be
    // applied once (rotation/zoom/pan) to the whole world without touching HUD.
    this.world = new this.PIXI.Container();
    this.world.sortableChildren = false;
    this.world.name = 'world';

    // Screen-space root (HUD / fog / ghost) — added after world so it is on top.
    this.screen = new this.PIXI.Container();
    this.screen.name = 'screen';

    this._build();

    stage.addChild(this.world);
    stage.addChild(this.screen);
  }

  _build() {
    for (const name of LAYER_ORDER) {
      const c = new this.PIXI.Container();
      c.name = name;
      c.sortableChildren = false;
      this.containers[name] = c;
      if (SCREEN_LAYERS.includes(name)) {
        this.screen.addChild(c);
      } else {
        this.world.addChild(c);
      }
    }
  }

  /**
   * Get a layer container by name.
   * @param {string} name
   * @returns {PIXI.Container}
   */
  get(name) {
    const c = this.containers[name];
    if (!c) throw new Error('[layers] unknown layer: ' + name);
    return c;
  }

  /** Remove all children from a single layer. */
  clear(name) {
    const c = this.get(name);
    c.removeChildren();
  }

  /**
   * Layers redrawn from scratch every frame (dynamic sim reads).
   * Static layers (sky/ground/decor) are drawn once and left alone.
   */
  get dynamicLayers() {
    return [
      'path', 'shadows', 'groundUnits', 'structures',
      'groundFX', 'airUnits', 'fx', 'ghost', 'fog'
    ];
  }

  /** Wipe all per-frame dynamic layers. */
  clearDynamic() {
    for (const name of this.dynamicLayers) {
      this.containers[name].removeChildren();
    }
  }

  /**
   * Painter's-algorithm depth sort within a layer by a child's `anchorY`
   * property (screen-projected ground anchor). Re-run every frame for
   * ground units/structures per the VIEW spec.
   * @param {string} name
   */
  depthSort(name) {
    const c = this.get(name);
    c.children.sort((a, b) => {
      const ay = (a.anchorY != null) ? a.anchorY : a.y;
      const by = (b.anchorY != null) ? b.anchorY : b.y;
      return ay - by;
    });
  }

  /**
   * Apply a camera transform to the WORLD container only (HUD stays fixed).
   * @param {object} cam {x, y, rotation, scale, pivotX, pivotY}
   */
  applyCamera(cam) {
    if (!cam) return;
    const w = this.world;
    if (cam.pivotX != null) w.pivot.x = cam.pivotX;
    if (cam.pivotY != null) w.pivot.y = cam.pivotY;
    if (cam.x != null) w.x = cam.x;
    if (cam.y != null) w.y = cam.y;
    if (cam.rotation != null) w.rotation = cam.rotation;
    if (cam.scale != null) {
      w.scale.x = cam.scale;
      w.scale.y = cam.scale;
    }
  }

  /** Tear down all containers. */
  destroy() {
    for (const name of LAYER_ORDER) {
      const c = this.containers[name];
      if (c) c.destroy({ children: true });
    }
    this.world.destroy({ children: false });
    this.screen.destroy({ children: false });
    this.containers = {};
  }
}

export default Layers;