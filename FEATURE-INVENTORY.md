# Bulwark Playable Prototype — Feature Inventory

> Snapshot of what actually exists in `prototype/test-game/` as of **2026-07-11** (main @ `688a4c6`).
> Purpose: source of truth for correcting the MetaMax task list. Three sections: **what works**,
> **what's partial/stubbed**, and **what does not exist** (despite older docs claiming otherwise —
> the old `build-report.md` describes the retired `prototype/canvas-game/`, not this build).
>
> Run: `python serve_prototype.py "prototype/test-game/index.html"` (game) · `.../harness.html` (authoring tool)
> Tests: `node --test` in `prototype/test-game/` — **14/14 suites green**.

---

## 1. Working features — the game (`index.html`)

### Game flow
- Boots straight into a live match: build phase (wave 0), player-triggered waves (Start Wave / Space), win on clearing the final wave, lose on base death (`src/sim/waves.js`, `src/sim/core.js`)
- **Results overlay** on game end: VICTORY/DEFEAT banner, final-score breakdown (score, kills, time, gold left), Restart (`src/render/hud.js` `showResult`)
- **Campaign schedule**: 10 waves — one per faction in fixed order (Ground/Powder tutorial first), 10th wave is a mixed "Combined forces" finale; generated deterministically from the roster (`src/data/tables.js` `_buildWaves`)
- **Faction test picker** (HUD dropdown): restart the run against any single faction's 8 escalating test waves; per-wave "⟨Faction⟩ Incoming, prepare for attack!" banner

### Roster & combat
- **72 units, 9 factions** (Ground/Powder, Air, Water, Artillery, High Tech, Arcane/Energy, Space Tech, Dark Energy, Greenies (Chem)) × 8 shapes (Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles), each with 3 tiers of hp/dps/cost, domain, armor class, damage type, AOE, vision, radar flags — all data-driven in `src/data/tables.js`
- Damage-type × armor-class **effectiveness matrix** applied to every hit (`src/sim/combat.js`)
- Lane by domain: Walkers → ground, Flyers → air (straight-line paths), Floaters/Swimmers → water lane

### Structures (4 types)
- **Cannon tower** (anti-ground), **Flak tower** (anti-air), **Wall**, **Moat** — 3 tiers on the towers
- Full lifecycle: place → build (timed) → complete → damaged → upgrade / sell (50% of invested) / destroyed
- **Repair**: a repair troop marches from the base, paths around obstacles, welds the structure back to full (with spark FX); excluded from unit separation so it never bounces
- Placement validation: bounds, occupancy, terrain, affordability, and **lane-seal rejection** (you can maze but never fully block the spawn→base path)
- All structures **block walker pathing**; placing/selling/losing one re-routes every live walker

### Base defense
- **3×3 base keep** (3000 HP) with 4 buildable corner slots + 16 fixed hard-point tower slots around the map
- **Passive base repair** (+8 HP/s between hits)
- **Super-cannon**: long-range base weapon that locks the longest-stationary ground attacker, slow-aims, fires an arcing shell with massive AOE; never targets air; animated turret shows scan/aim/charge/fire/cooldown states
- Attackers claim distinct **ring slots** around the keep and surround it instead of stacking on the center

### Crowd navigation (the July-10 "nav" sweep)
- Deterministic BFS pathing with up to **8 shared spawn→base routes** handed out round-robin; boxed-in units discover new corridors around jams
- Per-shape unit **footprints** + speed-weighted **separation pass** (side-by-side rest, follow-braking, personal-space buffer) — no bumping/oscillation
- Size/speed-aware **spawn spacing** and lateral spread for water/air lanes
- Units **face their movement heading** (smoothed), sized to their sim footprint

### Economy & scoring
- Gold: 900 start, +8/s passive income, kill bounty = 25% of the unit's T1 cost; purchases blocked at 0 (bankruptcy is real)
- **Final score** = kills×100 − minutes×60 − seconds − goldSpent + **goldRemaining** (the remaining-gold term was the July-10 fix)

### Rendering & FX (PixiJS, pseudo-3D)
- Layered compositor (water/ground/structures/units/air/fx/overlay); depth-banded board with lanes, buildable tint, spawn markers
- **Authored part-stack sprites** (base/weapon/head) sized to sim footprint, with per-layer camera lean/parallax and contact shadows; colored primitives as automatic fallback
- Event-driven FX: burning wrecks on **every** kill (CSP-safe emitters), blast-footprint fire scatter on cannon impact, shell arc with tracking shadow + reticle telegraph, floating **"+N" gold text at the dying unit**, welding sparks, camera shake, build/spawn/kill rings
- FX advance on real frame-time so explosions land on the exact damage tick at any frame rate

### HUD & controls
- Top bar: base HP, MM:SS timer, gold, wave counter + phase, Start Wave, seed readout
- Build palette with **hotkeys 1–4** (toggle) + affordability dimming; **U/X/R** = upgrade/sell/repair; Esc/right-click cancels; hover ghost turns red when unaffordable/invalid
- **Selected-structure panel** (tier, state, HP, action costs) and **unit info window** (HP, DPS, range, speed, armor, damage type, targets, vision + range rings on the map)
- Debug row: Export Log, Run Replay, Balance Report, seed input, Restart

### Determinism, replays, balance harness
- Fixed 30 Hz sim, single seeded PRNG (mulberry32), FNV-1a state hash
- **Battle log + replay**: every game silently records seed + tick-stamped commands to `localStorage`; Run Replay re-drives the sim with a "▶ REPLAY" indicator; headless hash-compare verifies determinism
- **Balance report** (GDD §17): N seeded battles per unit → avg-effective-DPS pricing + stability, via HUD button (`src/sim/balanceSim.js`)

---

## 2. Working features — State Harness authoring tool (`harness.html`)

- **Bench**: pick faction → unit (all 9 factions / 72 units), a real sim entity renders as a part-stack on a 7×7 arena using the game's exact camera/lean/shadow math
- **Drive states**: acquire/release target, pulse attack, damage −25%, heal +25%, destroy, reset; movable unit + rotatable aim target; live readout panel (SCANNING/ATTACKING/DESTROYED, HP bar, awareness, aim angle)
- Sensor behavior: head scans → snaps to lock; turret aims at target; base never aim-rotates; death list-over
- **▲ FORWARD convention gizmo** — fixed up-arrow the author aligns art to; the game uses the same convention (`up = forward`)
- **Sprite authoring**: open a sheet (PNG + atlas.json), annotated 50%-scale preview with frame-name labels, assign frames to base/weapon/head, per-layer size + height sliders, per-unit rotation + "rotate all"
- **Auto-load** *(added 2026-07-11)*: picking a faction fetches its saved def (`content/units/`) and sheet (`content/sprite-atlas/`) automatically — same files the game loads; bundled factions marked ●; on-screen notes state where assets live; units stay pinned to the sheet they were authored under
- **Save/load**: export single unit def, save whole faction as `.units.json`, load either back in; "Set save folder" (Chrome/Edge) writes straight into the project; authoring progress counter + ●/○ markers
- Pure, tested cores: camera, part-stack layout, readout, drive, atlas parsing (9 harness test suites)

### Art content shipped
- Authored art for **3 of 9 factions**: Artillery (re-tuned 2026-07-11 to the FORWARD convention), Greenies (Chem), Ground/Powder — in `content/units/` + 7 sprite atlases in `content/sprite-atlas/`; other factions render as primitives

---

## 3. Partial / stubbed (exists in data or sim, not player-facing)

| Item | State |
|---|---|
| Status effects (Burn/Toxin/Stagger/Overload) | Data-only flags; **only Frost slow is actually simulated** (`src/sim/combat.js`) |
| Moat vs Wall | Distinct type/cost, but identical behavior (plain blocker — no water/slow mechanic) |
| `deployTroop` command | Sim-complete (player-side troops march from base) but **no UI control invokes it** |
| Leaderboard / high-scores | Orphaned CSS only, nothing renders it |
| HUD money-delta animation | Vestigial CSS — superseded by on-map floating gold text |
| Vision / radar (`canSee`, radarDetect) | In data, minimally used |

---

## 4. Does NOT exist (remove or re-scope these in the task list)

- **No screen system**: no menu, loading screen, faction-select screen, difficulty select, settings, store, inventory, help screen, or leaderboard — the old `build-report.md` / Design-Proof screens describe the retired `canvas-game`, not this build
- **No difficulty levels** (the faction picker is a test tool, not difficulty)
- **No audio** of any kind
- **No camera controls** (fixed board, CSS-scaled; no pan/zoom/rotate)
- **No save/progression system** (only the last replay log persists)
- **No store/economy meta layer** outside the match

---

## 5. Test coverage (14 suites, all green)

Sim: cannon, routes, separation, waves-faction, finalscore · Harness: atlas, bench, drive, partstack, partstack-build, save, scenario, sheets, states
