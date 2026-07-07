getComponent...I'll write the renderer based on the plan and layers module.

```javascript
```

Let me just output the file content directly.

// src/render/renderer.js
// Root renderer: sets up layered painter's z-order containers and draws each frame from sim state.

import { createLayers } from './layers.js';
import { drawBoard } from './drawBoard.js';
import { drawPaths } from './drawPaths.js';
import { drawEntities } from './drawEntities.js';
import { drawStructureState } from './drawStructureState.js';
import { depthSort } from './depthSort.js';

export class Renderer {
  constructor(app, config) {
    this.app = app;
    this.config = config;

    // Root stage container that holds all game-world layers (this one can rotate for camera).
    this.world = new PIXI.Container();
    this.world.sortableChildren = false;
    app.stage.addChild(this.world);

    // Build the layered container registry (sky, water, ground bands, units, structures, FX, fog).
    this.layers = createLayers(this.world);

    // Camera rotation state (radians). HUD is never in `world`, so it never rotates.
    this.cameraRotation = 0;

    // Cache of persistent graphics keyed by purpose so we don't recreate every frame.
    this._boardDrawn = false;

    this._centerWorld();
  }

  _centerWorld() {
    const cfg = this.config;
    const board = cfg && cfg.board ? cfg.board : null;
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    // Position world so board center sits at screen center; pivot at board center.
    if (board && typeof board.pixelWidth === 'number' && typeof board.pixelHeight === 'number') {
      this.world.pivot.set(board.pixelWidth / 2, board.pixelHeight / 2);
    } else {
      this.world.pivot.set(0, 0);
    }
    this.world.position.set(w / 2, h / 2);
  }

  resize() {
    this._centerWorld();
  }

  rotateCamera(deltaRad) {
    this.cameraRotation += deltaRad;
    this.world.rotation = this.cameraRotation;
  }

  setCameraRotation(rad) {
    this.cameraRotation = rad;
    this.world.rotation = rad;
  }

  // Project a world-space anchor point through the camera rotation into screen space,
  // used for depth sorting so back->front ordering respects camera rotation.
  projectScreenY(x, y) {
    const cx = this.world.pivot.x;
    const cy = this.world.pivot.y;
    const dx = x - cx;
    const dy = y - cy;
    const sin = Math.sin(this.cameraRotation);
    const cos = Math.cos(this.cameraRotation);
    // rotated y offset
    return (dx * sin + dy * cos);
  }

  // Main per-frame draw. READS state, never mutates it.
  render(state, alpha, placement) {
    const layers = this.layers;

    // Static board only needs to be (re)drawn when terrain changes; drawBoard handles caching internally.
    drawBoard(layers, state, this.config);

    // Walker paths + deploy march line.
    drawPaths(layers, state, this.config, placement);

    // Clear dynamic layers each frame.
    this._clearDynamic();

    // Structures (with lifecycle state), then entities (base, walkers, floaters, flyers, towers).
    drawStructureState(layers, state, this.config, placement);
    drawEntities(layers, state, this.config, alpha);

    // Depth sort ground units + structures by projected ground-anchor Y.
    depthSort(layers, state, this);
  }

  _clearDynamic() {
    const l = this.layers;
    const dyn = [
      l.groundShadows,
      l.groundUnits,
      l.structures,
      l.projectiles,
      l.airShadows,
      l.airUnits,
      l.muzzleFX,
      l.paths,
    ];
    for (const c of dyn) {
      if (c && typeof c.removeChildren === 'function') {
        const kids = c.removeChildren();
        for (const k of kids) {
          if (k && typeof k.destroy === 'function') k.destroy({ children: true });
        }
      }
    }
  }

  destroy() {
    if (this.world && typeof this.world.destroy === 'function') {
      this.world.destroy({ children: true });
    }
  }
}

export default Renderer;