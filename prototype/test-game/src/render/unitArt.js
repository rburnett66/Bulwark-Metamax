/**
 * src/render/unitArt.js
 *
 * Load the AUTHORED unit art (the harness's faction `*.units.json` + their sprite sheets) so the game can draw
 * each unit with its real base/weapon/head sprites instead of a coloured primitive. Units without authored art
 * fall back to the primitive path in the renderer. Needs a global PIXI (v7).
 *
 * Data flow: `content/units/index.json` -> each faction def -> its `content/sprite-atlas/<sheet>` -> per-frame
 * textures, plus a unitId -> layers map the renderer consumes.
 */

import { LAYER_HEIGHT } from '../harness/camera.js';
import { LAYER_FIT } from '../harness/parts.js';

const LAYERS = ['base', 'weapon', 'head'];
const Z = { base: 0, weapon: 1, head: 2 };

/** Load all bundled faction defs + their sheets. Never throws — on failure returns an empty (ready:false) art
 *  set so the game still runs with primitives. */
export async function loadUnitArt() {
  const art = { defs: {}, sheets: {}, ready: false };
  try {
    const manifest = await fetch('content/units/index.json').then((r) => r.json());
    for (const file of manifest.factions || []) {
      const fac = await fetch('content/units/' + file).then((r) => r.json());
      const sheetName = fac.sheet;
      if (sheetName && !art.sheets[sheetName]) art.sheets[sheetName] = await loadSheet(sheetName);
      for (const uid in (fac.units || {})) art.defs[uid] = { sheet: sheetName, layers: fac.units[uid].layers || {}, rotation: fac.units[uid].rotation || 0 };
    }
    art.ready = Object.keys(art.defs).length > 0;
  } catch (e) {
    console.warn('[unitArt] load failed — units fall back to primitives:', e && e.message);
  }
  return art;
}

async function loadSheet(pngName) {
  const base = String(pngName).replace(/\.png$/i, '');
  const sheet = await fetch('content/sprite-atlas/' + base + '.json').then((r) => r.json());
  const img = await loadImage('content/sprite-atlas/' + base + '.png');
  const baseTex = PIXI.BaseTexture.from(img);
  const frames = {};
  for (const name of Object.keys(sheet.frames || {})) {
    const r = sheet.frames[name].frame;
    frames[name] = new PIXI.Texture(baseTex, new PIXI.Rectangle(r.x | 0, r.y | 0, r.w | 0, r.h | 0));
  }
  return { frames };
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('sheet ' + url + ' failed to load'));
    im.src = url;
  });
}

/** True if this unitId has authored art. */
export function hasArt(art, unitId) { return !!(art && art.defs[unitId] && art.sheets[art.defs[unitId].sheet]); }

/**
 * Build a Pixi Container part-stack (base < weapon < head) for a unit, sized to the unit's FOOTPRINT so the
 * on-screen sprite matches the space the sim keeps units apart (radius). A fixed ~tile size made every sprite
 * far bigger than its footprint, so units that the sim held apart still visually overlapped ("bumping"). Pass
 * `radius` (sim footprint, cell units); falls back to a tile-normalised size if omitted. Null if no art.
 */
const SPRITE_VIS_FACTOR = 1.15;   // sprite a touch larger than the bare footprint; the separation buffer covers it
export function buildUnitSprite(art, unitId, tilePx, radius) {
  const def = art && art.defs[unitId];
  if (!def) return null;
  const sheet = art.sheets[def.sheet];
  if (!sheet) return null;
  // target on-screen width of the BASE layer = footprint diameter (× a small presence factor).
  // stackScale maps the bench's authoring space onto that footprint, so every layer keeps the EXACT
  // proportions and height offsets tuned in the State Harness (LAYER_FIT: weapon ~65% of base, head ~39%).
  // Previously every layer was normalised to the base's full width — weapons/heads rendered oversized.
  const targetW = radius ? (tilePx * 2 * radius * SPRITE_VIS_FACTOR) : (tilePx * 0.95);
  const stackScale = targetW / LAYER_FIT.base;
  const c = new PIXI.Container();
  const rot = (def.rotation || 0) * Math.PI / 180;   // authored FACING — applied per-layer, NOT to the container
  let any = false;                                   // (the container stays screen-aligned so the camera lean works)
  for (const name of LAYERS) {
    const L = def.layers && def.layers[name];
    const tex = L && L.frame && sheet.frames[L.frame];
    if (!tex) continue;
    const spr = new PIXI.Sprite(tex);
    // Horizontal centering (authored in the bench, stack px) becomes an ANCHOR shift — anchor lives in
    // texture space, so the correction rotates with the unit's facing instead of orbiting off-centre.
    const anchorX = 0.5 - (L.offsetX || 0) / ((LAYER_FIT[name] || LAYER_FIT.base) * (L.scale || 1));
    if (spr.anchor && spr.anchor.set) spr.anchor.set(anchorX, 0.5);
    const fit = ((LAYER_FIT[name] || LAYER_FIT.base) * stackScale / Math.max(1, tex.width)) * (L.scale || 1);
    spr.scale.set(fit, fit);
    spr.rotation = rot;
    spr.__height = LAYER_HEIGHT[name] || 0;            // physical height → the renderer applies the parallax lean
    spr.__baseY = (L.offset || 0) * stackScale;        // authored height nudge in bench units (lean adds on top)
    spr.y = spr.__baseY;
    spr.zIndex = Z[name];
    c.addChild(spr);
    any = true;
  }
  if (!any) { if (c.destroy) c.destroy(); return null; }
  c.sortableChildren = true;
  if (c.sortChildren) c.sortChildren();
  return c;
}
