/**
 * content/maps/wave-windows.js — the WAVE-WINDOW model (owner design, 2026-07-14).
 *
 * THE FIX for the small→big scale problem: there is one fixed GLOBAL world (64×32). A single map
 * is played over 8 waves, and each wave's playable BATTLE AREA is a window into that world. The
 * window GROWS and RE-CENTERS every wave — from a tight 24×16 up to the full 64×32 — with the base
 * pinned at world-center. Early waves press the base against one edge so enemies attack from the
 * FARthest side; the side alternates W/E for variety; waves 7–8 center the base and surround it.
 *
 * Because every wave shares one coordinate system, the minimap can show the whole world and
 * telegraph threats massing on the far side BEFORE they reach the on-screen window — and that
 * telegraph range widens with the Tech-Tree awareness upgrades (Threat Awareness, Early Warning Net).
 *
 * COORDINATES: 1-indexed top-left (X = column, Y = row), matching the owner's table exactly.
 * Columns decode as WIDTH, HEIGHT, X, Y — the only orientation that fits a 64-wide × 32-tall world
 * (wave 6 = 40 wide @ X=25 reaches exactly col 64; wave 1 = 24×16 = the classic opening size).
 *
 * Persistence within the map is UNCHANGED from today: base structures persist wave→wave, resource
 * fields persist wave→wave, harvesters reset to 1 each wave, and the base heals each wave.
 *
 * NOTE (open): this is the DEFAULT sequence. Whether all 9 campaign maps reuse it as-is or each map
 * gets its own window sequence / base side is still to decide — see Bulwark-Wave-Windows.md.
 */

export const WORLD = { w: 64, h: 32 };

// the base sits at world-center for the whole map; the window re-centers toward it as it grows.
export const BASE = { x: 32, y: 16 };

// wave → battle-area window. w,h = size; x,y = 1-indexed top-left corner in world space.
export const WAVE_WINDOWS = [
  { wave: 1, w: 24, h: 16, x: 12, y: 4 },
  { wave: 2, w: 24, h: 16, x: 30, y: 4 },
  { wave: 3, w: 30, h: 18, x: 6,  y: 13 },
  { wave: 4, w: 30, h: 18, x: 28, y: 13 },
  { wave: 5, w: 40, h: 24, x: 1,  y: 5 },
  { wave: 6, w: 40, h: 24, x: 25, y: 5 },
  { wave: 7, w: 52, h: 28, x: 7,  y: 3 },
  { wave: 8, w: 64, h: 32, x: 1,  y: 1 },   // full world — you are in the middle, surrounded
];

/** The window rect in world space, 1-indexed inclusive edges. */
export function windowRect(win) {
  return { x0: win.x, y0: win.y, x1: win.x + win.w - 1, y1: win.y + win.h - 1 };
}

/** Is a world cell inside this wave's window? */
export function inWindow(win, x, y) {
  const r = windowRect(win);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/**
 * Which side enemies attack from = the window edge FARthest from the base (the side with the most
 * room). Returns { side, dir } — 'west'|'east'|'north'|'south'|'surround', and a unit-ish vector
 * pointing from the far edge toward the base. Near-symmetric windows (wave 7/8) return 'surround'.
 */
export function attackSide(win, base = BASE, balanced = 3) {
  const r = windowRect(win);
  const room = { west: base.x - r.x0, east: r.x1 - base.x, north: base.y - r.y0, south: r.y1 - base.y };
  // Per-axis imbalance: which END of each axis has more room, and by how much. (Comparing all four
  // sides directly is wrong in a 2:1 world — horizontal room always dwarfs vertical.)
  const h = { side: room.east >= room.west ? 'east' : 'west', margin: Math.abs(room.east - room.west) };
  const v = { side: room.south >= room.north ? 'south' : 'north', margin: Math.abs(room.south - room.north) };
  // Base centered on both axes → the window surrounds it (waves 7–8).
  if (h.margin <= balanced && v.margin <= balanced) return { side: 'surround', dir: { x: 0, y: 0 } };
  const win_ = h.margin >= v.margin ? h : v;   // attack from the more-imbalanced axis's roomier end
  const dir = { west: { x: 1, y: 0 }, east: { x: -1, y: 0 }, north: { x: 0, y: 1 }, south: { x: 0, y: -1 } }[win_.side];
  return { side: win_.side, dir };
}
