# Bulwark — Wave-Window Map Model

**Status:** model locked; sim wiring + minimap not yet built (awaiting go).
**Data (source of truth):** `prototype/test-game/content/maps/wave-windows.js`

---

## The problem it solves

Maps scaling from small (24×16) to big (64×32) broke two things: the camera/tappability trade-off,
and the player's ability to see a threat coming before it lands. Owner's fix: stop changing the map
*size* — keep **one fixed global world (64×32)** and make each wave a **window** into it.

## The model

- **Global world:** 64 wide × 32 tall. One coordinate system for the whole map.
- **Base:** pinned at **world-center (32, 16)** for the entire map.
- **8 waves, one map.** Each wave's playable **battle area** is a window into the world. The window
  **grows and re-centers** every wave, from 24×16 up to the full 64×32.
- **Attack direction:** in early (small) waves the window presses the base against one edge, so
  enemies attack from the **farthest side**. The side alternates for variety; waves 7–8 center the
  base and **surround** it.

### The window table (decoded)

Columns are **width, height, X, Y** (1-indexed top-left) — the only orientation that fits a
64-wide world (wave 6 = 40 wide @ X=25 → reaches exactly col 64; wave 1 = 24×16 = the classic size).

| Wave | W×H | top-left (X,Y) | covers | base sits… | attack from |
|------|-----|----------------|--------|-----------|-------------|
| 1 | 24×16 | (12, 4) | X 12–35 · Y 4–19 | right edge | **west** |
| 2 | 24×16 | (30, 4) | X 30–53 · Y 4–19 | left edge | **east** |
| 3 | 30×18 | (6, 13) | X 6–35 · Y 13–30 | upper-right | **west** |
| 4 | 30×18 | (28, 13) | X 28–57 · Y 13–30 | upper-left | **east** |
| 5 | 40×24 | (1, 5) | X 1–40 · Y 5–28 | right | **west** |
| 6 | 40×24 | (25, 5) | X 25–64 · Y 5–28 | left | **east** |
| 7 | 52×28 | (7, 3) | X 7–58 · Y 3–30 | near-center | closing in |
| 8 | 64×32 | (1, 1) | full world | dead center | **surrounded** |

Escalation reads **W → E → W → E → W → E → converge → surround**.

## Rules that DON'T change

Within the map, everything current still holds:
- Base structures persist wave → wave.
- Resource fields persist wave → wave (push into the map).
- Harvesters reset to **1 each wave**; the base **heals each wave**.
- The growth camera still eases out per wave — now it's framing the wave's window precisely.

## Minimap + telegraph (the payoff)

Because all 8 waves share one world, the minimap shows the **full 64×32** with the current wave's
window highlighted, the base, structures, resource fields, and — the point — **enemies massing on
the far side before they enter the on-screen window**. The telegraph range widens with the Tech-Tree
awareness upgrades:
- **Threat Awareness** (`b-awr`) — extends sensor radius on the minimap.
- **Early Warning Net** (`h-ewn`) — reveals the next wave's composition / spawn side ahead of time.

## Open questions (before/while building)

1. **Per-map vs shared sequence.** Is this the DEFAULT window sequence every map reuses, or does each
   of the 9 maps get its own sequence / base side / sizes? (The data file exposes it as a default so
   maps can reference or override.)
2. **Base cell.** World-center (32, 16) is assumed from "surrounded in wave 8" + geometry. Confirm, or
   pin a different base cell.
3. **Grow vs slide.** When the window grows between waves, does the newly-revealed ground animate open
   (camera ease, current behavior) — good as-is, just confirming no hard cut is wanted.

## Build phases

0. **Capture** — this doc + `wave-windows.js` data file. ✅
0.5 **Tool** — the Terrain Forge (`terrain.html`) authors it: World mode (64×32, base pinned to
   centre), a wave-preview selector drawing all 8 window rects, and spawn generation on the window's
   **far edge** per wave (`generateEdgeSpawns`), with **attack-tuning** controls — ground/air/water
   counts, edge **spread**, and min **spacing** — that spread units into even parallel lanes to
   minimise pathing collisions. Exports `waveWindows` + `spawnsByWave` + `spawnTuning`. ✅
1. **Sim** — createSim/spawns read the wave window: base at center, spawn on the far edge, battle area
   = current window; camera frames it. Determinism-sensitive → its own reviewed change.
2. **Minimap** — world view + window rect + base/structures/resources + far-side threat markers.
3. **Telegraph wiring** — minimap reveal range driven by the awareness tech nodes.

### Spawn = outer edge, always
Spawns are placed only on the **outer edge** of the active area — the wave window's far side by
default (`Spawn edge: Window`), or the true **world** outer edge (`Spawn edge: World`) if we want
enemies to originate from the world boundary and march in. Never interior. Even spacing is the
collision lever; the tool exposes it directly.
