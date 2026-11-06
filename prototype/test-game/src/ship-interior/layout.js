/**
 * src/ship-interior/layout.js — a capital ship's room layout, validated and derived [MM-story_mw47laf1_2].
 *
 * Pure (no three.js): node-tested by layout.test.mjs. The data is content/ships/<faction>/ship-layout.json, the Long
 * Ledger prototype's export shape (`floors`, `rooms` with x / top / w / h / fx in % of a 16:9 stage) plus `hull`,
 * `lifts`, `props` and `theme` for rooms drawn from primitives. Tech plan: docs/tech-plan/Capital-Ship-Interior.md §3.1–3.2.
 *
 *   const L = prepareLayout(json)      → { ...json, rooms (each with .floor, .fy), lanes, doors, errors, ok }
 *   validateLayout(json)               → { ok, errors[] }
 *   toWorld(xPct, yPct)                → [x, y] in the 100 × 56.25 orthographic world (centred on 0)
 */

export const WORLD = Object.freeze({ w: 100, h: 56.25 });
export const toWX = (px) => px - WORLD.w / 2;
export const toWY = (py) => WORLD.h / 2 - (py / 100) * WORLD.h;
export const toWorld = (px, py) => [toWX(px), toWY(py)];

/** Standing levels, low → high (the prototype's STAND). */
export const STANDING_LEVELS = Object.freeze(['Hostile', 'Wary', 'Neutral', 'Trusted', 'Honored']);

const DOOR_GAP = 3;          // rooms on one deck closer than this (in %) share a wall with a door

/** The floor (deck index) nearest a room's floor line: a room's floor is the deck line inside its box. */
function floorOf(room, floors) {
  let best = 0, bd = Infinity;
  floors.forEach((y, i) => {
    const inside = y >= room.top && y <= room.top + room.h;
    const d = inside ? 0 : Math.min(Math.abs(y - room.top), Math.abs(y - room.top - room.h));
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/** → { ok, errors[] } for a layout. Checks only what would draw wrong or route wrong. */
export function validateLayout(L, { factions = null } = {}) {
  const errors = [];
  if (!L || !Array.isArray(L.floors) || !L.floors.length) errors.push('floors: at least one deck line');
  if (!L || !Array.isArray(L.rooms) || !L.rooms.length) errors.push('rooms: at least one room');
  if (errors.length) return { ok: false, errors };
  const H = L.hull || { x0: 0, x1: 100, top: 0, bottom: 100 };
  const ids = new Set();
  for (const r of L.rooms) {
    const tag = `room ${r.id || '?'}`;
    if (!r.id) errors.push(`${tag}: no id`);
    else if (ids.has(r.id)) errors.push(`${tag}: duplicate id`);
    ids.add(r.id);
    if (!(r.w > 0 && r.h > 0)) errors.push(`${tag}: needs a positive w and h`);
    if (r.x < H.x0 || r.x + r.w > H.x1 || r.top < H.top || r.top + r.h > H.bottom) errors.push(`${tag}: outside the hull`);
    const fi = floorOf(r, L.floors), fy = L.floors[fi];
    if (!(fy >= r.top && fy <= r.top + r.h)) errors.push(`${tag}: no deck line inside the room`);
    if (!(r.fx >= r.x && r.fx <= r.x + r.w)) errors.push(`${tag}: stand spot fx ${r.fx} is outside the room`);
    if (factions) {
      if (r.fac && !factions.has(r.fac)) errors.push(`${tag}: unknown faction ${r.fac}`);
      if (r.unlock && !factions.has(r.unlock.fac)) errors.push(`${tag}: unknown unlock faction ${r.unlock.fac}`);
    }
    if (r.unlock && !STANDING_LEVELS.includes(r.unlock.need)) errors.push(`${tag}: unknown standing ${r.unlock.need}`);
  }
  // no two rooms on one deck overlap
  const byFloor = groupByFloor(L);
  for (const [fi, rooms] of byFloor) {
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      if (a.x + a.w > b.x + 1e-9) errors.push(`deck ${fi + 1}: ${a.id} and ${b.id} overlap`);
    }
  }
  for (const [i, lift] of (L.lifts || []).entries()) {
    if (!lift.floors || lift.floors.length < 2) errors.push(`lift ${i}: serves fewer than two decks`);
  }
  return { ok: errors.length === 0, errors };
}

function groupByFloor(L) {
  const m = new Map();
  for (const r of L.rooms) {
    const fi = floorOf(r, L.floors);
    if (!m.has(fi)) m.set(fi, []);
    m.get(fi).push(r);
  }
  for (const rooms of m.values()) rooms.sort((a, b) => a.x - b.x);
  return m;
}

/**
 * The layout ready to draw: each room gains `floor` (deck index) and `fy` (its deck line); plus
 *   lanes — per deck, the walk line from the leftmost to the rightmost room edge: { floor, fy, x0, x1 }
 *   doors — shared walls between same-deck neighbours, which become door gaps: { floor, x, left, right }
 */
export function prepareLayout(json, opts) {
  const { ok, errors } = validateLayout(json, opts);
  const L = { ...json, rooms: json.rooms.map((r) => ({ ...r })) };
  for (const r of L.rooms) { r.floor = floorOf(r, L.floors); r.fy = L.floors[r.floor]; }
  const byFloor = groupByFloor(L);
  L.lanes = [...byFloor.entries()].sort((a, b) => a[0] - b[0]).map(([fi, rooms]) => ({
    floor: fi, fy: L.floors[fi], x0: rooms[0].x + 1, x1: Math.max(...rooms.map((r) => r.x + r.w)) - 1,
  }));
  L.doors = [];
  for (const [fi, rooms] of byFloor) {
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i], gap = b.x - (a.x + a.w);
      if (gap >= 0 && gap <= DOOR_GAP) L.doors.push({ floor: fi, x: a.x + a.w + gap / 2, left: a.id, right: b.id });
    }
  }
  L.ok = ok; L.errors = errors;
  return L;
}

/** Is a room sealed for this player? standing = { [factionKey]: level name }; missing = Neutral. */
export function isLocked(room, standing = {}) {
  if (!room.unlock) return false;
  const have = STANDING_LEVELS.indexOf(standing[room.unlock.fac] || 'Neutral');
  return have < STANDING_LEVELS.indexOf(room.unlock.need);
}
