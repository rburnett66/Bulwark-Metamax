/**
 * src/render3d/overlays/fogModel.js — WHICH part of the board the ring fog leaves clear (plan v2.2 §6.5)
 * [MM-task_mv9s9o5d_3].
 *
 * The same window the Pixi renderer dims around (render/renderer.js, "CAMPAIGN ring reveal" + "FORGE /
 * openPlay maps"), so both views agree on what is in play:
 *   - campaign maps (map.rings, not openPlay): the current wave's ring rect — the sim gates building on it;
 *   - Terrain Forge maps (openPlay + waveWindows): the wave's authored window (the coming wave's between
 *     waves), widened to keep the base zone (±2 cells) clear. Nothing is gated; the dim just frames the fight.
 * Anything else (classic board, whole-board rings) → no fog.
 *
 * Pure: no three.js. Rects are inclusive cell bounds { x0, y0, x1, y1 }.
 */

const BASE_ZONE = 2;

function windowRect(win) {
  return win.x0 !== undefined && win.x0 !== null
    ? { x0: win.x0, y0: win.y0, x1: win.x1, y1: win.y1 }
    : { x0: win.x - 1, y0: win.y - 1, x1: win.x - 1 + win.w - 1, y1: win.y - 1 + win.h - 1 };   // {x,y,w,h} is 1-based
}

/** → { rect, gated, wave } for the window in effect now, or null when the whole board is in play. */
export function fogWindow(state, map) {
  const m = (state && state.map) || map;
  if (!m) return null;
  const W = m.cols, H = m.rows;
  const wv = (state && state.waves) || { current: 0, active: false };
  let rect = null, gated = false, wave = 0;
  if (m.rings && m.rings.length && !m.openPlay) {
    wave = Math.max(1, Math.min(wv.current || 1, m.rings.length));
    rect = { ...m.rings[wave - 1].rect };
    gated = true;
  } else if (m.openPlay && m.waveWindows && m.waveWindows.length) {
    const wins = m.waveWindows;
    wave = Math.max(1, Math.min(wv.active ? wv.current : wv.current + 1, wins[wins.length - 1].wave));
    rect = windowRect(wins.find((q) => q.wave === wave) || wins[wins.length - 1]);
    const b = (state && state.base && state.base.pos) || m.base;
    if (b) {
      rect.x0 = Math.min(rect.x0, b.x - BASE_ZONE); rect.y0 = Math.min(rect.y0, b.y - BASE_ZONE);
      rect.x1 = Math.max(rect.x1, b.x + BASE_ZONE); rect.y1 = Math.max(rect.y1, b.y + BASE_ZONE);
    }
  } else {
    return null;
  }
  rect.x0 = Math.max(0, rect.x0); rect.y0 = Math.max(0, rect.y0);
  rect.x1 = Math.min(W - 1, rect.x1); rect.y1 = Math.min(H - 1, rect.y1);
  if (rect.x0 <= 0 && rect.y0 <= 0 && rect.x1 >= W - 1 && rect.y1 >= H - 1) return null;   // whole board: nothing to fog
  return { rect, gated, wave };
}

export const REVEAL_FLASH_S = 0.9;

/**
 * Follows the window frame to frame. When it GROWS (a new ring opens) it reports the band that just opened
 * as a reveal flash fading over REVEAL_FLASH_S — the visible beat the Pixi view gives a ring growth.
 * update(state, map, dt) → { win, flash: { prev, cur, alpha } | null }
 */
export function createFogTracker() {
  let last = null, flash = null;
  const contains = (a, b) => a.x0 <= b.x0 && a.y0 <= b.y0 && a.x1 >= b.x1 && a.y1 >= b.y1;
  const same = (a, b) => a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
  return {
    update(state, map, dt) {
      const win = fogWindow(state, map);
      if (win && last && !same(win.rect, last) && contains(win.rect, last)) flash = { prev: last, cur: win.rect, age: 0 };
      last = win ? win.rect : null;
      if (flash) {
        flash.age += Math.max(0, dt || 0);
        if (flash.age >= REVEAL_FLASH_S || !win) flash = null;
      }
      return { win, flash: flash ? { prev: flash.prev, cur: flash.cur, alpha: 1 - flash.age / REVEAL_FLASH_S } : null };
    },
  };
}
