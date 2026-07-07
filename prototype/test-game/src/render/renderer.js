package.json is not requested — I'll output the renderer.js file only.

```javascript
```

Let me write the actual file content:

// src/render/renderer.js
// Pixi app + layered painter's-algorithm z-order stage manager.
// Reads sim state (never mutates). Manages the render layers and per-frame
// depth-sort of ground-anchored entities.

import * as PIXI from '../../vendor/pixi.min.js';
import { LAYERS, LAYER_ORDER } from './layers.js';

export class Renderer {
  constructor(mountEl, opts = {}) {
    this.width = opts.width || 1280;
    this.height = opts.height || 720;

    // Create the Pixi application (Pixi v7 style: constructor options).
    this.app = new PIXI.Application({
      width: this.width,
      height: this.height,
      backgroundColor: 0x0b1020,
      antialias: true,
      autoStart: false, // main loop drives rendering explicitly
    });

    // Mount canvas.
    this.canvas = this.app.view;
    if (mountEl) mountEl.appendChild(this.canvas);

    // Root world container (everything except HUD lives inside; HUD is screen-space).
    this.stage = this.app.stage;

    // Build layer containers in painter's order.
    this.layers = {};
    for (const name of LAYER_ORDER) {
      const c = new PIXI.Container();
      c.name = name;
      c.sortableChildren = false; // we manage z manually where needed
      this.layers[name] = c;
      this.stage.addChild(c);
    }

    // The depth-sorted layers (ground anchor / screen-projected Y).
    // We combine ground units + structures for painter sort by anchorY.
    this._depthSortLayers = [
      LAYERS.GROUND_UNITS,
      LAYERS.STRUCTURES,
    ];

    // Graphics pools per layer keyed by draw callers; here we simply expose
    // the containers so draw* modules can add/clear their own Graphics.
    this._frameChildren = new Map(); // layerName -> array (managed externally)
  }

  get view() {
    return this.canvas;
  }

  layer(name) {
    return this.layers[name];
  }

  // Clear the transient (per-frame redrawn) content of a layer.
  clearLayer(name) {
    const c = this.layers[name];
    if (!c) return;
    // Destroy children graphics to avoid leaks; draw modules recreate each frame.
    for (let i = c.children.length - 1; i >= 0; i--) {
      const ch = c.children[i];
      c.removeChild(ch);
      ch.destroy({ children: true });
    }
  }

  clearDynamicLayers() {
    // Everything except sky/HUD roots is redrawn each frame in this lean build.
    for (const name of LAYER_ORDER) {
      if (name === LAYERS.HUD) continue; // HUD managed by hud.js persistently
      this.clearLayer(name);
    }
  }

  addToLayer(name, displayObj) {
    const c = this.layers[name];
    if (c) c.addChild(displayObj);
    return displayObj;
  }

  // Depth-sort ground-anchored display objects by their .anchorY property.
  // draw modules set displayObj.anchorY = screenProjectedY before this call.
  depthSort() {
    for (const layerName of this._depthSortLayers) {
      const c = this.layers[layerName];
      if (!c) continue;
      c.children.sort((a, b) => {
        const ay = (a.anchorY == null) ? a.y : a.anchorY;
        const by = (b.anchorY == null) ? b.y : b.anchorY;
        return ay - by;
      });
    }
  }

  // Render one frame. Called by the loop AFTER draw modules have populated layers.
  render() {
    this.depthSort();
    this.app.renderer.render(this.stage);
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.app.renderer.resize(w, h);
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
}

// Convenience factory used by main.js
export function createRenderer(mountEl, opts) {
  return new Renderer(mountEl, opts);
}

export default Renderer;