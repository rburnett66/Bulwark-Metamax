/**
 * src/render/voxel/pack.js — the "unit pack" data contract (Stack Forge emits, the game consumes).
 *
 * See docs/sources/Bulwark-Voxel-Stack-TechPlan.md §data-contract. The game NEVER reads raw artist
 * PNGs — only packs. This module validates a pack's shape (pure, no PIXI) so both the tool's emitter
 * and the game's loader gate on one schema, and it's Node/golden-testable.
 */

import { SUN } from '../sun.js';

const CLASSES = new Set(['ground', 'air', 'structure', 'decor']);
const KINDS = new Set(['directional', 'stack']);

/** THE world-scale contract: 32 voxels span exactly 1 tile, for every unit. A pack's on-screen size
 *  is footprint/VOX_PER_TILE tiles (carried as pack.scale.tiles) — bigger units need more voxels,
 *  never a bigger stretch. Keeps every unit's voxel density identical on the board. */
export const VOX_PER_TILE = 32;

/** THE world-light contract: the sun sits TOP-LEFT of the screen (azimuth 135°, Stack Forge's
 *  default) and shadows project to the LOWER-RIGHT. Packs carry the azimuth they were baked with
 *  (pack.light.azimuth) and the game shades/shadows from that same value, so in-game lighting is
 *  identical to the tool bake. Sourced from src/render/sun.js — the one place the sun is defined. */
export const GAME_LIGHT_AZ = SUN.azimuthDeg;

/** Validate a unit pack against the contract. Returns { ok, errors:[...] }. Pure. */
export function validatePack(p) {
  const e = [];
  if (!p || typeof p !== 'object') return { ok: false, errors: ['pack is not an object'] };
  if (!p.id) e.push('missing id');
  if (!CLASSES.has(p.class)) e.push(`class must be ground|air|structure|decor (got ${JSON.stringify(p.class)})`);
  if (!Array.isArray(p.footprint) || p.footprint.length !== 3) e.push('footprint must be [W, D, H]');
  if (!p.camera || typeof p.camera.azimuth !== 'number' || typeof p.camera.elevation !== 'number')
    e.push('camera { azimuth, elevation } (numbers) required — the angle set in Stack Forge');
  if (typeof p.layerSpacing !== 'number') e.push('layerSpacing (number) required');
  if (!Array.isArray(p.parts) || p.parts.length === 0) e.push('parts[] required (≥1)');
  else p.parts.forEach((pt, i) => {
    const at = `part[${i}]${pt && pt.id ? ` "${pt.id}"` : ''}`;
    if (!pt || typeof pt !== 'object') { e.push(`${at} not an object`); return; }
    if (!pt.id) e.push(`${at} missing id`);
    if (!KINDS.has(pt.kind)) e.push(`${at} kind must be directional|stack (got ${JSON.stringify(pt.kind)})`);
    if (!pt.atlas) e.push(`${at} missing atlas`);
    if (!Array.isArray(pt.cell) || pt.cell.length !== 2) e.push(`${at} cell [w, h] required`);
    if (!Array.isArray(pt.pivot) || pt.pivot.length !== 2) e.push(`${at} pivot [x, y] required`);
    if (pt.kind === 'directional' && !(pt.facings > 0)) e.push(`${at} directional needs facings > 0`);
    if (pt.kind === 'stack' && !(pt.angles > 0)) e.push(`${at} stack needs angles > 0`);
    if (pt.mount && (!Array.isArray(pt.mount) || pt.mount.length !== 3)) e.push(`${at} mount must be [dx, dy, dz]`);
    // optional baked cast-shadow atlas (Shading epic S1) — present together or not at all
    if (pt.shadowAtlas) {
      if (!Array.isArray(pt.shadowCell) || pt.shadowCell.length !== 2) e.push(`${at} shadowCell [w, h] required with shadowAtlas`);
      if (!(pt.shadowCols > 0)) e.push(`${at} shadowCols > 0 required with shadowAtlas`);
    }
  });
  return { ok: e.length === 0, errors: e };
}

/** The part a runtime looks up by id. Convenience over pack.parts. */
export function partById(pack, id) {
  return (pack.parts || []).find((pt) => pt.id === id) || null;
}
