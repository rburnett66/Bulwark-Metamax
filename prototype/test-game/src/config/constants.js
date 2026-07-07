// src/config/constants.js
// Global engine constants for BULWARK vertical slice.
// Deterministic sim uses a FIXED timestep; rendering reads state and interpolates.
// All balance numbers live in data tables (src/data/*) — this file holds ENGINE geometry & timing only.

// ---------------------------------------------------------------------------
// Simulation timing
// ---------------------------------------------------------------------------
export const TICK_RATE = 30;                 // fixed sim ticks per second
export const TICK_DT = 1 / TICK_RATE;        // seconds advanced per fixed step (deterministic)
export const MAX_SUBSTEPS = 6;               // clamp to avoid spiral-of-death on slow frames
export const MS_PER_TICK = 1000 / TICK_RATE; // milliseconds per fixed step

// ---------------------------------------------------------------------------
// Board / tile geometry
// The sim works in TILE space (deterministic). Rendering multiplies by PX_PER_TILE.
// ---------------------------------------------------------------------------
export const TILE_SIZE = 32;                 // pixels per tile (render scale)
export const PX_PER_TILE = TILE_SIZE;

// Board dimensions in tiles.
export const BOARD_COLS = 24;                // width in tiles
export const BOARD_ROWS = 18;                // height in tiles (attackers march top -> base at bottom)

export const BOARD_WIDTH_PX = BOARD_COLS * TILE_SIZE;
export const BOARD_HEIGHT_PX = BOARD_ROWS * TILE_SIZE;

// Canvas / viewport intent (renderer may resize; this is the design resolution).
export const VIEW_WIDTH = BOARD_WIDTH_PX;
export const VIEW_HEIGHT = BOARD_HEIGHT_PX;

// ---------------------------------------------------------------------------
// Lane geometry (single ground lane beside a single water lane).
// Attackers enter at the TOP edge and travel down toward the base clearing.
// Lanes are expressed as tile-column ranges; centers are used for pathing.
// ---------------------------------------------------------------------------

// Ground lane occupies the left band of columns.
export const GROUND_LANE = {
  colStart: 2,
  colEnd: 10,         // inclusive-ish range [colStart, colEnd)
  get colCenter() { return (this.colStart + this.colEnd) / 2; },
};

// Water lane occupies a band to the right of the ground lane.
export const WATER_LANE = {
  colStart: 13,
  colEnd: 21,
  get colCenter() { return (this.colStart + this.colEnd) / 2; },
};

// Spawn edge (top) and the base clearing (bottom).
export const SPAWN_ROW = 0;                  // attackers spawn at top edge
export const BASE_ROW = BOARD_ROWS - 2;      // base sits near the bottom clearing

// Explicit spawn points (tile coords) per domain.
export const SPAWN_POINTS = {
  ground: { x: GROUND_LANE.colCenter, y: SPAWN_ROW },
  water:  { x: WATER_LANE.colCenter, y: SPAWN_ROW },
  air:    { x: (GROUND_LANE.colCenter + WATER_LANE.colCenter) / 2, y: SPAWN_ROW },
};

// Player base position (tile coords) — both lanes converge here.
export const BASE_POSITION = { x: BOARD_COLS / 2, y: BASE_ROW };

// Base default combat/geometry values (HP comes from data/state; radius for hit tests).
export const BASE_RADIUS_TILES = 1.6;
export const BASE_DEFAULT_HP = 5000;

// Where deployed friendly troops SPAWN before marching to their drop order.
export const FRIENDLY_SPAWN_POINT = { x: BOARD_COLS / 2, y: BASE_ROW + 1 };

// ---------------------------------------------------------------------------
// Ground visual bands (render-only reference; low/mid/high strata).
// Fractions of the ground lane height used by drawBoard.
// ---------------------------------------------------------------------------
export const GROUND_BANDS = [
  { name: 'low',  frac: 0.34 },
  { name: 'mid',  frac: 0.33 },
  { name: 'high', frac: 0.33 },
];

// ---------------------------------------------------------------------------
// Air / altitude
// ---------------------------------------------------------------------------
export const FLYER_ALTITUDE = 3;             // logical altitude for flyers (tiles), for shadow offset
export const FLOATER_SUBMERGE = 0.5;         // sub-surface tint depth reference for swimmers

// ---------------------------------------------------------------------------
// Base hard-point slots.
// Structures snap to fixed slots; slot count scales with base level.
// Slots are laid out in an arc/rows around the base clearing (tile coords).
// ---------------------------------------------------------------------------
export const SLOTS_PER_BASE_LEVEL = [6, 9, 12]; // slot count by base level (index = level-1)
export const BASE_MAX_LEVEL = 3;

// Programmatic slot layout: two rows of slots flanking the base, spread across the board width.
export function generateSlotLayout(count) {
  const slots = [];
  const rows = [BASE_ROW - 3, BASE_ROW - 5];   // two rows above the base
  const perRow = Math.ceil(count / rows.length);
  const usableStart = 3;
  const usableEnd = BOARD_COLS - 3;
  const span = usableEnd - usableStart;
  let id = 0;
  for (let r = 0; r < rows.length && id < count; r++) {
    for (let c = 0; c < perRow && id < count; c++) {
      const t = perRow > 1 ? c / (perRow - 1) : 0.5;
      const x = usableStart + t * span;
      slots.push({ id: id, x: +x.toFixed(3), y: rows[r], occupiedBy: null });
      id++;
    }
  }
  return slots;
}

// Precomputed default slot set (base level 1).
export const DEFAULT_SLOTS = generateSlotLayout(SLOTS_PER_BASE_LEVEL[0]);

// Footprint (in tiles) that a hard-point slot reserves.
export const SLOT_FOOTPRINT = { w: 2, h: 2 };

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------
export const STARTING_MONEY = 1200;
export const MONEY_ACCRUAL_PER_SEC = 12;     // live real-time income
export const REFUND_RATE = 0.5;              // sell returns this fraction of invested cost
export const KILL_INCOME_FRACTION = 0.25;    // gold on kill = attacker cost * this
export const BANKRUPTCY_THRESHOLD = 0;       // money below this = cannot afford builds

// ---------------------------------------------------------------------------
// Structure lifecycle timing (seconds). Actual per-structure build time may
// override via data tables; these are engine defaults / fallbacks.
// ---------------------------------------------------------------------------
export const DEFAULT_BUILD_TIME = 3.0;       // Placing -> Building -> Complete
export const DEFAULT_UPGRADE_TIME = 4.0;     // Complete -> Upgrading -> Complete(+tier)
export const DEFAULT_SELL_TIME = 0.75;       // Selling -> removed
export const REPAIR_RATE_HP_PER_SEC = 60;    // repair speed once troop arrives
export const REPAIR_TROOP_SPEED = 3.0;       // tiles/sec a repair troop travels
export const DAMAGED_HP_FRACTION = 0.5;      // below this HP fraction => Damaged render/logic state

// Structure lifecycle state enum (shared by sim + render).
export const LIFECYCLE = {
  PLACING: 'Placing',
  BUILDING: 'Building',
  COMPLETE: 'Complete',
  DAMAGED: 'Damaged',
  DESTROYED: 'Destroyed',
  UPGRADING: 'Upgrading',
  SELLING: 'Selling',
};

// Attacker/unit animation-ish states (render reads; sim sets logical mode).
export const UNIT_STATE = {
  IDLE: 'Idle',
  MOVING: 'Moving',
  ATTACKING: 'Attacking',
  DEATH: 'Death',
};

// Entity domains.
export const DOMAIN = {
  GROUND: 'Ground',
  WATER: 'Water',
  AIR: 'Air',
};

// Terrain tile kinds (board grid).
export const TERRAIN = {
  GROUND: 0,
  WATER: 1,
  WALL: 2,
  MOAT: 3,
  BLOCKED: 4,   // out-of-bounds / non-lane
};

// ---------------------------------------------------------------------------
// Combat / targeting
// ---------------------------------------------------------------------------
export const TARGET_REACQUIRE_TICKS = 6;     // how often units re-scan for a target
export const WEAPON_WINDUP_FRACTION = 0.4;   // telegraph wind-up as fraction of fire interval
export const PROJECTILE_SPEED = 14;          // tiles/sec for ballistic/visible shots
export const STATUS_DEFAULT_DURATION = 2.0;  // seconds for DoT/slow/stagger defaults
export const SLOW_MULTIPLIER = 0.5;          // Frost chill speed multiplier
export const CHAIN_RANGE = 2.0;              // electric chain radius (tiles)
export const CHAIN_MAX_TARGETS = 3;

// Base contact/attack range for melee walkers when they reach the base (tiles).
export const BASE_ATTACK_RANGE = 1.5;

// ---------------------------------------------------------------------------
// Waves / win-lose
// ---------------------------------------------------------------------------
export const WAVES_TO_WIN = 5;               // survive N waves = win
export const WAVE_PREP_TIME = 5.0;           // seconds between waves (auto or start-wave)
export const INTRA_WAVE_SPAWN_GAP = 0.9;     // seconds between unit spawns within a wave

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------
export const DEFAULT_SEED = 0x1BADB002;       // stable default seed for replays
export const STATE_HASH_MODULO = 2147483647;  // for replay verification hashing

// ---------------------------------------------------------------------------
// Rendering z-order (painter's algorithm, back -> front).
// Layer registry (layers.js) uses these keys/order.
// ---------------------------------------------------------------------------
export const LAYER_ORDER = [
  'sky',
  'waterSub',
  'water',
  'ground',
  'groundShadows',
  'foliage',
  'paths',
  'groundUnits',
  'structures',
  'groundFX',
  'airUnits',
  'airShadows',
  'clouds',
  'muzzleFX',
  'fog',
  'placementGhost',
];

// Sun direction for shadow offsets (render-only), in tiles.
export const SUN_OFFSET = { x: 0.4, y: 0.7 };

// ---------------------------------------------------------------------------
// Palette (primitives only — colors for the test build render pass).
// ---------------------------------------------------------------------------
export const COLORS = {
  sky:            0x1b2b3a,
  water:          0x2b6d8f,
  waterSub:       0x143a4d,
  groundLow:      0x3a5a2a,
  groundMid:      0x466b32,
  groundHigh:     0x527a3c,
  slot:           0x6b6b3a,
  slotHover:      0x9a9a4a,
  lane:           0x2f2f2f,
  path:           0xffd166,
  march:          0x66ccff,
  base:           0x88ccff,
  baseCore:       0x224466,
  walker:         0xd06a2a,
  floater:        0x3aa0c0,
  flyer:          0xe0e0e0,
  airShadow:      0x000000,
  towerGround:    0x999999,
  towerAir:       0x66aaff,
  wall:           0x777766,
  moat:           0x224a66,
  ghostValid:     0x33ff66,
  ghostInvalid:   0xff3333,
  building:       0xccaa44,
  damaged:        0xff8844,
  destroyed:      0x442222,
  hpFull:         0x33ff55,
  hpMid:          0xffcc33,
  hpLow:          0xff3333,
  range:          0xffffff,
  projectile:     0xffee88,
  fog:            0x000000,
};

// ---------------------------------------------------------------------------
// Aggregated engine constants object (convenient single import).
// ---------------------------------------------------------------------------
export const CONSTANTS = {
  TICK_RATE, TICK_DT, MAX_SUBSTEPS, MS_PER_TICK,
  TILE_SIZE, PX_PER_TILE, BOARD_COLS, BOARD_ROWS,
  BOARD_WIDTH_PX, BOARD_HEIGHT_PX, VIEW_WIDTH, VIEW_HEIGHT,
  GROUND_LANE, WATER_LANE, SPAWN_ROW, BASE_ROW,
  SPAWN_POINTS, BASE_POSITION, BASE_RADIUS_TILES, BASE_DEFAULT_HP,
  FRIENDLY_SPAWN_POINT, GROUND_BANDS, FLYER_ALTITUDE, FLOATER_SUBMERGE,
  SLOTS_PER_BASE_LEVEL, BASE_MAX_LEVEL, DEFAULT_SLOTS, SLOT_FOOTPRINT,
  STARTING_MONEY, MONEY_ACCRUAL_PER_SEC, REFUND_RATE, KILL_INCOME_FRACTION,
  BANKRUPTCY_THRESHOLD,
  DEFAULT_BUILD_TIME, DEFAULT_UPGRADE_TIME, DEFAULT_SELL_TIME,
  REPAIR_RATE_HP_PER_SEC, REPAIR_TROOP_SPEED, DAMAGED_HP_FRACTION,
  LIFECYCLE, UNIT_STATE, DOMAIN, TERRAIN,
  TARGET_REACQUIRE_TICKS, WEAPON_WINDUP_FRACTION, PROJECTILE_SPEED,
  STATUS_DEFAULT_DURATION, SLOW_MULTIPLIER, CHAIN_RANGE, CHAIN_MAX_TARGETS,
  BASE_ATTACK_RANGE,
  WAVES_TO_WIN, WAVE_PREP_TIME, INTRA_WAVE_SPAWN_GAP,
  DEFAULT_SEED, STATE_HASH_MODULO,
  LAYER_ORDER, SUN_OFFSET, COLORS,
};

export default CONSTANTS;