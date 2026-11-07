/**
 * src/outpost/view/layout.js — the outpost view's screen layout and its camera framing [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.1 "Phone": portrait and landscape layouts, like the battle HUD, and the mesa
 * must frame in portrait (§6.6: a 390 × 844 phone shows the 23 × 21-cell mesa frame across its width).
 *
 *   portrait   (h > w, or narrow)     top bar in two rows · actions along the bottom · the panel a bottom sheet
 *   landscape  (a phone on its side)  one slim top row · actions in a column on the right · the panel on the left
 *   desktop    (w ≥ 900, h ≥ 600)     one top row · actions bottom centre · the panel a card on the right
 *
 * The CSS in hud.js follows the same breakpoints (layoutFor is the one place they are decided; the HUD sets
 * `data-layout` from it). `insets` are the CSS px each side of the screen the HUD covers, which the camera framing
 * leaves clear (camera.js clearBox / fitCameraToRect). Pure.
 */
import { clearBox, fitCameraToRect, CAMERA } from '../../render3d/camera.js';
import { mesaFrame } from '../../terrain/outpostPads.js';

/** The concept's three-quarter angle: the battle camera's pitch, turned this far off north (radians). */
export const VIEW_YAW = 0.38;

export function layoutFor(w, h) {
  const mode = w >= 900 && h >= 600 ? 'desktop' : w > h ? 'landscape' : 'portrait';
  // left: the BUILD menu's rail (story O17; the battle palette's reactive rail, render/buildPalette.js railFit — one
  // column of ~64 px buttons on a portrait phone and a desktop, two columns of 58 px on a landscape phone). On a
  // portrait phone the capped camera cannot clear any of it (the mesa's pads already fill the width at the cap), so
  // there the rail floats over the mesa's western edge, as the battle's rail floats over the board on a phone.
  const insets = mode === 'portrait' ? { top: 104, bottom: 128, left: 0, right: 0 }
    : mode === 'landscape' ? { top: 46, bottom: 0, left: 144, right: Math.min(190, Math.round(w * 0.24)) }
      : { top: 70, bottom: 104, left: 100, right: 0 };
  return { mode, w, h, insets };
}

/** The ground rect the view frames: the mesa (outpostPads.mesaFrame) in world units { x0, z0, x1, z1 }. */
export function frameRect(map, margin = 1) {
  const f = mesaFrame(map, margin);
  return { x0: f.x, z0: f.y, x1: f.x + f.w, z1: f.y + f.h };
}

/** The mesa's buildings: the bounding box of its (non-remote) pads plus `margin`, world units. */
export function padsRect(map, margin = 1) {
  const pads = (map.pads || []).filter((p) => !p.remote);
  if (!pads.length) return frameRect(map);
  return { x0: Math.min(...pads.map((p) => p.x)) - margin, z0: Math.min(...pads.map((p) => p.y)) - margin,
    x1: Math.max(...pads.map((p) => p.x + p.w)) + margin, z1: Math.max(...pads.map((p) => p.y + p.h)) + margin };
}

/**
 * The camera that frames the mesa for this screen: { tx, tz, dist, yaw, rect }. When the panel is open its side of the
 * screen is left clear too (panelInset: { side, px }). The battle camera's pitch is fixed and its distance capped
 * (camera.js maxDist), so on a portrait phone the whole mesa with its rim cannot fit across the width: there the view
 * frames the mesa's buildings (its pads) instead, and the rim's boulders run off the sides.
 */
export function framedCamera(map, w, h, { yaw = VIEW_YAW, panel = null } = {}) {
  const L = layoutFor(w, h), ins = { ...L.insets };
  if (panel && panel.px) ins[panel.side] = (ins[panel.side] || 0) + panel.px;
  const box = clearBox(w, h, ins);
  for (const rect of [frameRect(map), padsRect(map, 1), padsRect(map, 0)]) {
    const cam = fitCameraToRect({ tx: 0, tz: 0, dist: CAMERA.startDist, yaw }, rect, w / h, box);
    if (cam.dist < CAMERA.maxDist - 1e-6) return { ...cam, rect };
  }
  return { ...fitCameraToRect({ tx: 0, tz: 0, dist: CAMERA.startDist, yaw }, padsRect(map, 0), w / h, box), rect: padsRect(map, 0) };
}

/** Where the selected building's panel sits for a layout: { side, px } of screen it covers (for the framing). */
export function panelInset(L) {
  if (L.mode === 'portrait') return { side: 'bottom', px: Math.round(L.h * 0.34) };
  if (L.mode === 'landscape') return { side: 'left', px: Math.min(260, Math.round(L.w * 0.32)) };
  return { side: 'right', px: 320 };
}

/** A camera aimed at one building: the pad's centre, close in. pad: { x, y, w, h } (cells). */
export function focusCamera(pad, yaw = VIEW_YAW, L = null) {
  const cx = pad.x + pad.w / 2, cz = pad.y + pad.h / 2;
  const dist = Math.max(CAMERA.minDist + 12, Math.max(pad.w, pad.h) * 5.5) * (L && L.mode === 'portrait' ? 1.35 : 1);
  // in portrait the panel covers the bottom third: aim a little south so the building sits in the clear part
  const off = L && L.mode === 'portrait' ? dist * 0.12 : 0;
  const side = L && L.mode === 'landscape' ? -dist * 0.12 : L && L.mode === 'desktop' ? dist * 0.1 : 0;
  return { tx: cx + Math.sin(yaw) * off + Math.cos(yaw) * side, tz: cz + Math.cos(yaw) * off - Math.sin(yaw) * side, dist, yaw };
}
