/**
 * src/terrain/terrainRuntime.js — Bulwark terrain runtime.
 *
 * Reference implementation of the runtime contract in docs Terrain-Design.md, ported from the Pixi v8
 * handoff to this repo's convention: PIXI is the classic vendored global (vendor/pixi.min.js, v7.4.2) and
 * this is a native ES module — matching renderer.js / terrainGen.js. No bundler / no TypeScript step.
 *
 * Two responsibilities:
 *   1. Stream baked ground tiles as the playable area opens ring by ring.
 *   2. Depth-sort the grove occluder sprites together with units, so units pass BEHIND the top edge of a
 *      grove.
 *
 * The terrain itself costs nothing per frame — it is baked pixels. The only terrain objects that exist at
 * runtime are the ~70 canopy sprites.
 *
 * Stage relationship: terrainGen.js is Stage 1 (procedural feature map → per-cell TYPE). The bake pipeline
 * (tools/terrain-bake) is Stage 2 and produces terrain.json + tiles/ + grove_rank.json; this module renders
 * that Stage-2 output.
 */

/* global PIXI */

// ---------------------------------------------------------------- manifest shape (JSDoc)
/**
 * @typedef {Object} TileEntry
 * @property {string} file
 * @property {number} x @property {number} y @property {number} w @property {number} h
 * @property {{x0:number,y0:number,x1:number,y1:number}} cells
 * @property {number} minRing  Earliest ring (wave) that opens a cell inside this tile.
 */
/**
 * @typedef {Object} RankEntry
 * @property {{x:number,y:number}} cell
 * @property {'canopy_cap'|'full_tree'} sprite
 * @property {number} x       Pre-jittered draw position (already includes the deterministic x offset).
 * @property {number} baseY   Depth key. Fractional — includes the y jitter. Sort on THIS, not the cell.
 * @property {number} w @property {number} h @property {number} ring
 */
/**
 * @typedef {Object} TerrainManifest
 * @property {number} version
 * @property {{cols:number,rows:number,cell:number,width:number,height:number,base:{x:number,y:number}}} map
 * @property {{voxel:number,digicamBlock:number,unit:number}} scale
 * @property {{fromDeg:number,sideFaceRatio:number,litBandRatio:number}} light
 * @property {Object.<string,string>} levels
 * @property {number} standardLevel @property {number} waterTableLevel @property {number} rings
 * @property {TileEntry[]} tiles @property {RankEntry[]} groveRank @property {number} seed
 */
/**
 * Anything that participates in depth sorting.
 * @typedef {Object} Depthful
 * @property {number} baseY   Screen-space y of the object's contact point with the ground.
 * @property {object} view    A PIXI.Container.
 */

// ---------------------------------------------------------------- renderer

export class TerrainRenderer {
  constructor() {
    this.root = new PIXI.Container();

    /** Baked ground. Static, never sorted, always underneath. */
    this.ground = new PIXI.Container();

    /**
     * The sorted layer. Units AND grove occluders live here together — that co-mingling is the entire
     * occlusion mechanism.
     */
    this.sorted = new PIXI.Container();

    /** Air units ignore terrain occlusion entirely and draw above. */
    this.air = new PIXI.Container();

    this.root.addChild(this.ground, this.sorted, this.air);
    // We sort manually each frame: zIndex churn on hundreds of children is slower than one sort over a flat
    // array we already maintain.
    this.sorted.sortableChildren = false;

    /** @type {TerrainManifest|null} */
    this.manifest = null;
    this.baseUrl = '';
    this.loadedTiles = new Set();
    /** @type {Array<Depthful & {key?:string}>} */
    this.rankSprites = [];
    /** @type {Depthful[]} */
    this.dynamic = [];
    this.currentRing = 0;
  }

  /**
   * @param {string} baseUrl
   * @returns {Promise<TerrainManifest>}
   */
  async load(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${this.baseUrl}/terrain.json`);
    this.manifest = await res.json();
    return this.manifest;
  }

  /**
   * Reveal up to `ring`. Loads only tiles that ring actually opens, so wave 1 pulls ~0.26 MB rather than
   * the full 2.3 MB.
   * @param {number} ring
   */
  async revealRing(ring) {
    if (ring <= this.currentRing) return;
    this.currentRing = ring;

    const needed = this.manifest.tiles.filter(
      (t) => t.minRing <= ring && !this.loadedTiles.has(t.file),
    );
    if (needed.length === 0) { this.spawnRank(ring); return; }   // tiles already loaded, but this ring's grove occluders still need spawning

    const urls = needed.map((t) => `${this.baseUrl}/${t.file}`);
    // v7: Assets.load returns a { url: Texture } record — use it directly rather than relying on the
    // v8 Texture.from(url) cache path.
    const loaded = await PIXI.Assets.load(urls);

    for (const tile of needed) {
      const tex = loaded[`${this.baseUrl}/${tile.file}`];
      const s = new PIXI.Sprite(tex);
      s.position.set(tile.x, tile.y);
      this.ground.addChild(s);
      this.loadedTiles.add(tile.file);
    }

    this.spawnRank(ring);
  }

  /**
   * Grove occluders for the revealed area. Only top-edge and isolated trees are here — 70 of 296 on the
   * 64×32 map. Everything else is baked into the ground tiles.
   * @param {number} ring
   */
  spawnRank(ring) {
    // v7: the canopy art was loaded by alias in bootTerrain — resolve it from the Assets cache.
    const atlas = {
      canopy_cap: PIXI.Assets.get('canopy_cap'),
      full_tree: PIXI.Assets.get('full_tree'),
    };

    for (const e of this.manifest.groveRank) {
      if (e.ring > ring) continue;
      if (this.rankSprites.some((r) => r.key === keyOf(e))) continue;

      const s = new PIXI.Sprite(atlas[e.sprite]);
      s.width = e.w;
      s.height = e.h;
      // Anchor at the contact point: the sprite grows UPWARD from baseY, which is what lets the canopy
      // cover the lane behind the grove.
      s.position.set(e.x, e.baseY - e.h);

      const d = { baseY: e.baseY, view: s, key: keyOf(e) };
      this.rankSprites.push(d);
      this.sorted.addChild(s);
    }
  }

  /**
   * Register a unit / structure / anything that needs depth sorting.
   * @param {Depthful} d
   */
  add(d) {
    this.dynamic.push(d);
    this.sorted.addChild(d.view);
  }

  /** @param {Depthful} d */
  remove(d) {
    const i = this.dynamic.indexOf(d);
    if (i >= 0) this.dynamic.splice(i, 1);
    this.sorted.removeChild(d.view);
  }

  /**
   * Call once per frame after unit positions update.
   *
   * THE depth rule: sort every renderable by its contact point ascending, then assign child order. A unit
   * whose baseY is smaller than a canopy's draws first and is therefore covered by it — that is the
   * occlusion, and it needs no special casing.
   */
  update() {
    const all = this.dynamic.concat(this.rankSprites);
    all.sort((a, b) => a.baseY - b.baseY);
    for (let i = 0; i < all.length; i++) {
      this.sorted.setChildIndex(all[i].view, i);
    }
  }

  /**
   * Cull offscreen ground tiles. Cheap win on mobile at high zoom-out.
   * @param {object} view  A PIXI.Rectangle.
   */
  cull(view) {
    for (const child of this.ground.children) {
      const s = child;
      s.visible =
        s.x + s.width > view.x && s.x < view.x + view.width &&
        s.y + s.height > view.y && s.y < view.y + view.height;
    }
  }
}

/** @param {RankEntry} e */
function keyOf(e) {
  return `${e.cell.x},${e.cell.y}`;
}

// ---------------------------------------------------------------- usage

/**
 * @param {object} app      A Pixi v7 Application (new PIXI.Application({...})).
 * @param {string} baseUrl
 */
export async function bootTerrain(app, baseUrl) {
  // Canopy art must be loaded before the rank spawns.
  await PIXI.Assets.load([
    { alias: 'canopy_cap', src: `${baseUrl}/art/canopy_cap.png` },
    { alias: 'full_tree', src: `${baseUrl}/art/full_tree.png` },
  ]);

  const terrain = new TerrainRenderer();
  const manifest = await terrain.load(baseUrl);
  app.stage.addChild(terrain.root);

  await terrain.revealRing(1);

  app.ticker.add(() => terrain.update());

  return { terrain, manifest };
}

/**
 * Example unit wired into the depth system.
 *
 * The only contract is `baseY` — the screen y of the unit's feet. Keep it in sync with the sprite position
 * and occlusion is automatic.
 */
export class GroundUnit {
  /**
   * @param {object} texture  A PIXI.Texture.
   * @param {number} cellSize
   */
  constructor(texture, cellSize) {
    this.view = new PIXI.Container();
    this.cellSize = cellSize;
    this.baseY = 0;
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5, 1); // feet at the origin
    this.view.addChild(this.sprite);
  }

  /**
   * @param {number} px @param {number} py
   */
  setPosition(px, py) {
    this.view.position.set(px, py);
    this.baseY = py; // contact point drives the sort
  }
}

/*
 * ---------------------------------------------------------------------------
 * Integration notes
 * ---------------------------------------------------------------------------
 * Layer order is fixed and matters:
 *     ground tiles          static, below everything
 *     sorted layer          ground + water units interleaved with the rank
 *     air                   flies over terrain, never occluded
 *     vfx / ui              above, outside this renderer
 *
 * Readability: a unit that vanishes entirely behind a canopy makes the wave feel unfair. Either keep
 * canopies short enough to cover roughly the lower half of a unit, or draw a low-alpha silhouette of an
 * occluded unit over the canopy (check `baseY` against overlapping rank entries).
 *
 * Determinism: grove_rank.json is precomputed, but it is regenerable — the placement math (grove_math.py)
 * is a pure function of (x, y, seed) and ports to JS directly via Math.imul. Never hand-edit placements;
 * change the seed or the config and re-export.
 *
 * Ring reveal: call revealRing(waveNumber) as each wave opens. Tiles and canopies for the new ring load
 * together; nothing already loaded reloads.
 *
 * Pixi v7 port notes (this was a v8 reference):
 *   - PIXI is the vendored global (vendor/pixi.min.js @ v7.4.2), not an ESM import.
 *   - Assets.load(urls) returns a { url: Texture } record — used directly; aliased art is fetched with
 *     Assets.get(alias) after loading via { alias, src }.
 *   - The Application is constructed synchronously: new PIXI.Application({...}) — no v8 `await app.init()`.
 */
