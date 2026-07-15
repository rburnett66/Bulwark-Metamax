/**
 * src/render/voxel/loader.js — load Stack Forge unit packs and drive voxel units at runtime (needs
 * global PIXI v7). This is the HANDOFF §5 runtime: a unit is a directional BODY (nearest-facing frame,
 * snaps) + a stack TURRET (nearest-angle frame, smooth), composed from the pack — pure Sprite + textures,
 * no filters, so it stays on the @pixi/react-native-safe subset.
 *
 * Pack sources, in override order (later wins):
 *   1. content/units/voxel-units.json          — committed manifest (ship path); atlases resolved
 *      relative to content/units/voxel/<atlas>  unless embedded as data-URLs.
 *   2. localStorage "bulwark:stackforge"        — Stack Forge's live manifest (dev hot loop: Save in
 *      the Forge, reload the game, the unit renders as its voxel pack). Atlases are data-URLs.
 *
 * Frame convention (must match select.js / the Forge bake): bucket-0 faces +X (east), frame i is at
 * angle i·2π/n; the runtime just rounds a world angle to the nearest bucket.
 */

import { validatePack, partById } from './pack.js';
import { angleBucket } from './select.js';

const MANIFEST_KEY = 'bulwark:stackforge';

/** Load every available pack. Never throws — returns { units, ready } (empty when nothing found). */
export async function loadVoxelUnits() {
  const store = { units: {}, ready: false };
  try {
    const res = await fetch('content/units/voxel-units.json');
    if (res.ok) await addManifest(store, await res.json(), 'content/units/voxel/');
  } catch (e) { /* optional file */ }
  try {
    const m = JSON.parse(localStorage.getItem(MANIFEST_KEY) || 'null');
    if (m) await addManifest(store, m, null);
  } catch (e) { console.warn('[voxel] localStorage manifest unreadable:', e && e.message); }
  store.ready = Object.keys(store.units).length > 0;
  return store;
}

async function addManifest(store, manifest, atlasBase) {
  for (const id of Object.keys(manifest.units || {})) {
    try {
      const entry = manifest.units[id], pack = entry.pack || entry;   // tolerate bare-pack manifests
      const v = validatePack(pack);
      if (!v.ok) { console.warn('[voxel] pack', id, 'invalid:', v.errors.join('; ')); continue; }
      const parts = {};
      for (const pt of pack.parts) {
        const src = (entry.atlases && entry.atlases[pt.id]) || (atlasBase ? atlasBase + pt.atlas : null);
        if (!src) throw new Error(`part "${pt.id}" has no atlas source`);
        const img = await loadImage(src);
        const baseTex = PIXI.BaseTexture.from(img);
        baseTex.scaleMode = PIXI.SCALE_MODES.LINEAR;
        const n = pt.kind === 'directional' ? pt.facings : pt.angles;
        const cols = pt.cols || Math.ceil(Math.sqrt(n));
        const frames = [];
        for (let i = 0; i < n; i++) frames.push(new PIXI.Texture(baseTex,
          new PIXI.Rectangle((i % cols) * pt.cell[0], ((i / cols) | 0) * pt.cell[1], pt.cell[0], pt.cell[1])));
        parts[pt.id] = { def: pt, frames };
      }
      store.units[id] = { pack, parts };
    } catch (e) {
      console.warn('[voxel] skipped pack', id, '—', e && e.message);
    }
  }
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('atlas failed to load'));
    im.src = url;
  });
}

/** True if this unit id has a loaded voxel pack. */
export function hasVoxel(store, id) { return !!(store && store.units && store.units[id]); }

/**
 * Build the retained display object for one unit: body sprite + mounted turret sprite in a container.
 * Sized like buildUnitSprite: the FOOTPRINT spans the unit's sprite box (tilePx·2·radius·spriteOverCollision)
 * so voxel units keep the same on-screen size contract as authored/primitive units.
 */
export function buildVoxelUnit(store, id, tilePx, radius, spriteOverCollision) {
  const e = store.units[id];
  if (!e) return null;
  const { pack, parts } = e;
  const B = pack.renderScale || 1;                                  // atlas px per voxel
  // WORLD SCALE: a pack that declares its size (scale.tiles, from the VOX_PER_TILE contract) renders
  // at exactly that many tiles — voxel density is constant across every unit on the board. Packs
  // without the contract (older saves) fall back to the sim-radius sizing.
  const tiles = pack.scale && pack.scale.tiles;
  const targetW = tiles ? tilePx * tiles : tilePx * 2 * (radius || 0.3) * (spriteOverCollision || 4 / 3);
  const scale = targetW / Math.max(1, pack.footprint[0] * B);       // screen px per atlas px
  const c = new PIXI.Container();
  const mk = (p) => {
    const s = new PIXI.Sprite(p.frames[0]);
    s.anchor.set(p.def.pivot[0] / p.def.cell[0], p.def.pivot[1] / p.def.cell[1]);   // pivot = ground centre
    s.scale.set(scale);
    return s;
  };
  // SILHOUETTE SHADOW: the unit's own frame flipped about the ground line, squashed and sheared away
  // from the world light, tinted black — the shadow matches the real shape and turns with the facing.
  // Same textures as the unit, so it batches; no extra draws, no filters.
  const lightAz = ((pack.light && pack.light.azimuth) != null ? pack.light.azimuth : 135) * Math.PI / 180;
  const lean = -Math.cos(lightAz) * 0.9;
  const mkShadow = (p, alpha) => {
    const s = mk(p);
    s.tint = 0x000000; s.alpha = alpha;
    s.scale.set(scale, -scale * 0.45); s.skew.x = lean;
    return s;
  };
  const shBody = parts.body ? mkShadow(parts.body, 0.24) : null;
  const shTurret = parts.turret ? mkShadow(parts.turret, 0.12) : null;
  if (shBody) c.addChild(shBody);
  if (shTurret) c.addChild(shTurret);
  const body = parts.body ? mk(parts.body) : null;
  if (body) c.addChild(body);
  const turret = parts.turret ? mk(parts.turret) : null;
  if (turret) c.addChild(turret);
  c.__shadows = [shBody, shTurret].filter(Boolean);                 // renderer grounds these under flyers
  c.__vox = { pack, parts, body, turret, shBody, shTurret, scale, se: Math.sin(((pack.camera && pack.camera.elevation) || 30) * Math.PI / 180) };
  return c;
}

/**
 * Per-frame update: heading picks the body facing frame, aim picks the turret angle frame, and the
 * turret rides its mount (forward offset rotated by the heading, foreshortened; dz lifts by layerSpacing).
 * Angles are WORLD angles (radians, +X = east, screen-y down) — bucket-0 = +X by the bake convention.
 */
export function updateVoxelUnit(c, headingRad, aimRad) {
  const v = c.__vox;
  if (!v) return;
  if (v.body) {
    const d = v.parts.body.def, tex = v.parts.body.frames[angleBucket(headingRad, d.facings)];
    v.body.texture = tex;
    if (v.shBody) v.shBody.texture = tex;                                          // shadow turns with the hull
  }
  if (v.turret) {
    const d = v.parts.turret.def;
    const tex = v.parts.turret.frames[angleBucket(aimRad == null ? headingRad : aimRad, d.angles)];
    v.turret.texture = tex;
    const m = d.mount || [0, 0, 0], B = (v.pack.renderScale || 1) * v.scale;
    const gx = m[0] * Math.cos(headingRad) - (m[1] || 0) * Math.sin(headingRad);   // mount, unit-local → world
    const gy = m[0] * Math.sin(headingRad) + (m[1] || 0) * Math.cos(headingRad);
    v.turret.x = gx * B;
    v.turret.y = (gy * v.se - (m[2] || 0) * (v.pack.layerSpacing || 0)) * B;       // ground y foreshortened; dz lifts
    if (v.shTurret) { v.shTurret.texture = tex; v.shTurret.x = gx * B; }           // barrel shadow tracks the aim
  }
}
