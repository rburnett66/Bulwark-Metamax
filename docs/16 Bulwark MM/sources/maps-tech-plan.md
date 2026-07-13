# Maps Feature — Tech Plan

Source of truth: `docs/sources/Bulwark-Map-GDD.md.docx` (v1.2, rules) + `docs/sources/Bulwark-Map-Data.xlsx`
(values, formula-driven) + **`docs/sources/Bulwark-Map-GDD-Amendment-A.md`** (owner playtest decisions —
open play, crystal-color economy, docked harvester fleet; wins over v1.2 on conflict). This plan maps
the design onto the test-game engine.

## Architecture

```
Bulwark-Map-Data.xlsx ──tools/extract_mapdata.py──▶ content/maps/mapdata.{json,js}   (generated, committed)
                                                        │
                                    src/sim/mapgen.js ──┤ buildCampaignMap(mapId, {seed, overrides})
                                                        │   → engine MAP contract + rings + resources
              Map Lab (maplab.html, harness tab) ◀──────┤ review / edit → overrides JSON
     content/maps/overrides/map-<id>.json (hand edits) ─┘ applyOverrides()
```

- **Data pipeline** — the workbook is authoritative for values; `extract_mapdata.py` re-generates
  `mapdata.json` + an ES-module twin and FAILS LOUD on the GDD's structural invariants (9 maps,
  72 wave rows, 81 resource-role pairings all `ok`, `Premium_Secondary ≠ Premium_Resource`,
  every wave adds ring area). Re-run after any workbook edit.
- **Generator** (`src/sim/mapgen.js`) — deterministic (mapId ⊕ seed via mulberry32). Emits the full
  engine MAP contract (cols/rows/tile, spawns, waterCells/lane, base 3×3-plus, slots, buildableCells)
  so `createSim(seed, {map})` runs unmodified — proven in tests — plus the maps extension:
  - `rings[8]`: per-wave playable rect (concentric, centered on the base), spawn points 2 tiles
    outside the edge on the wave's focus side (clamped at board edges), lane budgets, par seconds.
  - `resources[]`: `{id, type, role, wave, x, y, grade, units, valuePerUnit, respawns}` placed by the
    radial gradient — primary in the new ring's inner half (any side), premium in the outer band on
    the FOCUS side, quest (waves 5–8) at the far edge on the OPPOSITE side. Premium/quest types are
    faction-dependent placeholders until `resolveResourceTypes(map, factionId)` stamps them from the
    81-pairing Resource_Roles table (secondary swap on clash, GDD §5.2).
  - Water (Has_Water maps): meandering 2–3-wide river entering from L/R, never touching the wave-1
    pocket or base, always stopping short of the far edge (the dry tip is the ford). Hard rule added
    where the GDD left water open: EVERY ring's ground spawn must BFS-reach the base or generation
    throws (12 re-roll attempts).
- **Map Lab** (`maplab.html`, third harness tab, deep link `#maplab`) — review + edit:
  map/seed/faction pickers, wave slider (ring reveal + budgets), inspect, water paint, node
  move/add/delete, spawn move; live connectivity validation; undo; edits persist per (map, seed) in
  localStorage and EXPORT as `map-<id>.overrides.json` → drop in `content/maps/overrides/` for the
  game. Overrides are a thin diff so hand-tuning never forks the generator.

## Phases (epic `Maps — ring campaign`)

1. **DONE — data pipeline + generator + Map Lab** (this commit): everything above + `mapgen.test.mjs`
   (9 maps: contract, ring growth, gradient, 81 pairings/27 swaps, sim determinism on generated maps,
   overrides).
2. **Ring campaign glue**: game boots `buildCampaignMap(n)` (+ overrides file); between waves the
   playable area grows — placement gated to the current ring, spawn points advance per `rings[]`,
   renderer dims unrevealed ground; wave budgets drive spawn composition (points, not unit lists).
3. **Harvester + resources in-sim**: harvester unit (per-faction stats), node harvesting/carry/return,
   primary respawn (~75s), premium consumed, per-map gold tally (§7 spend rule: towers full rate,
   harvesters half rate — `Harvester_Spend_Rate`).
4. **Stars + map score + wave-8 sequence**: the 5-star rubric per wave, 3.0 gate, score screen order
   (combat → wave star → map score → dialog), par-time bonus.
5. **Quest contract + loyalty**: pre-match contract dialog (accept/fulfil/fail/decline), loyalty
   ledger with rival burn, quest-node harvesting waves 5–8.
6. **Campaign shell + tech tree**: 9-map sequence, harvester upgrades between maps, loyalty tech
   unlocks (T1 unit / T2 structure / T3 base upgrade).

## Known design debts (from GDD §9, tracked in the epic)
- Quest-giver map order is degenerate as shipped (§5A.5) — data fix in the workbook.
- Loyalty budget (1,270 earned vs 4,680 to max) and `Loyalty_Per_Node` need a decision pre-content-lock.
- Primary quota 60% (star 3) and par-vs-difficulty are playtest questions.
- T3 base upgrades must feel worth ~1.7 T1 units or the depth build dies (content risk).
