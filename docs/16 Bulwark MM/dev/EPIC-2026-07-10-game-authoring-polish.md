# EPIC — Bulwark Game & Authoring Polish   `bulwark-polish-2026-07-10`

> **Project:** 16 · Bulwark MM  **Created:** 2026-07-10  **Status:** ✅ CLOSED (all tickets delivered + verified)
>
> A polish sweep across the Bulwark game (crowd navigation, base defense, effects, controls, UI) and the State
> Harness authoring pipeline. Every ticket below is **closed** — shipped in the working tree and verified
> (deterministic sim + replay-safe where applicable; 13/13 sim + harness tests green). Stable ids
> `bulwark-polish.<story>.<ticket>`; each ticket keeps its DoD line.

---

## STORY A — `bulwark-polish.nav` · Crowd navigation & spacing (kill the bumping)
| Ticket | Feature | DoD | Status |
|---|---|---|---|
| `nav.t1` | **Size-aware spawn spacing** — per-lane spawn gap scales with the departing unit's *diameter* and *speed* (not a flat gap), so slow/large siege units (radius 0.42, speed 0.39) fully clear the single spawn cell before the next appears. | Near-spawn big-unit overlap **1.00** (no overlap) across all 9 factions + campaign; deterministic. | ✅ closed |
| `nav.t2` | **Water/air lateral spawn spread** — straight-line (getFlyerPath) lanes get a per-seq lateral offset that persists (unlike ground routes which re-converge). | Water-faction spawn overlap **0.63 → 1.00**; air 0 piled. | ✅ closed |
| `nav.t3` | **Multi-route navigation** — a growing shared list of diverse spawn→base corridors handed round-robin; a boxed unit *discovers* a new route around the jam. | 7–8 distinct routes discovered around a wall; identical hash on replay. | ✅ closed |
| `nav.t4` | **Per-shape unit footprints** — `unitRadius(def)` by shape (Troops 0.24 … Heavy Tanks 0.42); units can't overlap. | Every unit has a radius; footprints present in separation test. | ✅ closed |
| `nav.t5` | **Separation pass** — radial push (speed-weighted) + corridor forward-avoidance (stable side-by-side rest, no oscillation) + follow-brake (fast unit paces behind a slower one instead of rear-ending) + personal-space buffer (0.16). | Mid-field bump-ticks **11% → 0%**; sharp-reversal jitter **58% → 12%**; fast-behind-slow overlap **1.00**; deterministic. | ✅ closed |
| `nav.t6` | **Base attack-ring** — attackers path to distinct slots around the base footprint and attack from the nearest cell, surrounding it instead of stacking on the centre point. | Base-ring overlap **0.03 → 0.97**; base still destroyable; finalscore test passes. | ✅ closed |
| `nav.t7` | **Units face movement + sized to footprint** — the render sizes each sprite to its sim footprint (matches separation) and rotates it to its heading (smoothed), so it drives forward instead of sliding sideways / overlapping. | Visual size == footprint; sprites turn to heading; pseudo-3D lean stays screen-correct. | ✅ closed |

## STORY B — `bulwark-polish.base` · Base defense
| Ticket | Feature | DoD | Status |
|---|---|---|---|
| `base.t1` | **Super-cannon** — long-range base weapon: locks the *position* of the longest-stationary attacker, slow aim → arcing shell → massive AOE on impact. Only hurts dug-in units (movers dodge). | cannon.test: aims/fires/impacts, deterministic. | ✅ closed |
| `base.t2` | **Ground-only artillery** — the cannon never targets or AOE-damages air units. | No air unit ever locked/damaged by the cannon. | ✅ closed |
| `base.t3` | **Turret state indicator** — a barrel on the base that scans when idle, swings to the locked target with a charge-gauge arc while aiming, flashes on fire, dims on cooldown. | Barrel + gauge reflect `cannon.phase` live. | ✅ closed |
| `base.t4` | **Explosion↔damage sync** — FX advance on real frame-time (not a fixed 1/60), so the shell's arc + blast land on the exact tick the sim applies AOE damage at any frame rate. | No explosion/damage lag; determinism unaffected (FX are render-only). | ✅ closed |

## STORY C — `bulwark-polish.struct` · Structures & repair
| Ticket | Feature | DoD | Status |
|---|---|---|---|
| `struct.t1` | **Structures are blockers** — all live structures (towers, walls, moats) block walker movement; units path around them. | Tower cell impassable; units route around it. | ✅ closed |
| `struct.t2` | **Placement path-validation** — every placement is rejected if it would seal the base off from the spawn. | Sealing wall rejected `blocksPath`; other placements allowed. | ✅ closed |
| `struct.t3` | **Repair troops fixed** — they path around structures, are *excluded from separation* (ignore other units, no bouncing), and now actually heal (movement handed to structures.js so the `repairMarch → repairing` transition fires). | Bot marches, reaches, heals structure **140 → 400 (full)**; no bounce. | ✅ closed |
| `struct.t4` | **Welding sparks** — bright sparks launch up and fall under gravity with brightness/colour decay while a bot welds; centred on the structure, ~50% count. | Sparks emit during `repairing`, centred, gravity + decay. | ✅ closed |

## STORY D — `bulwark-polish.fx` · Combat effects
| Ticket | Feature | DoD | Status |
|---|---|---|---|
| `fx.t1` | **Burning-wreck fire** — a CSP-safe particle *emitter* (no custom GL shader → no `eval` under strict CSP) throws flickering colour-ramped flame + smoke for its lifetime, scaled to the unit's footprint. **Every** unit death burns (base-cannon AOE, enemy artillery, tower kills), not just tower kills. | Fire on all kills, scaled to unit, burns ~4s; no CSP eval. | ✅ closed |
| `fx.t2` | **Blast-radius fires** — on cannon impact, 10–20 small fires scatter at *random* points across the AOE disk to show the blast footprint. | 10–20 fires, random over the disk (not a ring), sized to the AOE. | ✅ closed |

## STORY E — `bulwark-polish.ui` · Controls & UI
| Ticket | Feature | DoD | Status |
|---|---|---|---|
| `ui.t1` | **Build hotkeys 1–4** — number keys select/deselect each build (toggle), Esc/right-click cancel; the ghost turns red on insufficient funds. Bold digit on each build button. | 1–4 toggle build selection; bold key glyphs. | ✅ closed |
| `ui.t2` | **Action hotkeys U / X / R** — Upgrade / Sell / Repair keys, with bold key glyphs that persist across the buttons' live cost updates. | U/X/R work + stay labelled. | ✅ closed |
| `ui.t3` | **Unit info window** — selecting a unit opens a lower-middle panel: name (faction + type + tier), role/domain/side, HP bar, and stats (HP, DPS, Range, Speed, Armor, Damage, Targets, Vision). | Panel shows on select, hides otherwise, live stats. | ✅ closed |
| `ui.t4` | **Faction test picker + announcements** — pick any faction to spawn its waves; a bold "‹Faction› Incoming, prepare for attack!" banner announces each wave. | Picker rebuilds waves; banner fires per wave. | ✅ closed |

## STORY F — `bulwark-polish.author` · Authoring / State Tool
| Ticket | Feature | DoD | Status |
|---|---|---|---|
| `author.t1` | **Definitive FORWARD reference** — the State Tool draws a fixed "▲ FORWARD" up-arrow the author aligns each unit's front to; the game locks to the same convention (`UNIT_FACING_OFFSET = π/2`, "up = forward"). Ends the inconsistent 0°/90° authored guesses. | Gizmo visible; game turns each unit to its heading against this convention. | ✅ closed |
| `author.t2` | **Sprite-sheet open & assign** — open a gallery atlas (PNG+JSON), assign frames to base/weapon/head layers, per-layer size + vertical offset + rotation; live preview. | Atlas parses; layers assignable; `atlas.test` green. | ✅ closed |
| `author.t3` | **Save/load faction defs → game** — authored unit defs persist and the game renders the authored part-stack sprites in play. | Defs save/load; game renders authored art (artillery/greenies/ground). | ✅ closed |

---

## Verification summary
- **Sim**: deterministic + replay-safe throughout; full suite **13/13 green** (cannon, routes, separation, waves-faction, finalscore + bench, drive, scenario, save, partstack, partstack-build, states, atlas).
- **Render/UI**: browser/WebGL + DOM — verified by inspection & syntax; validated in live dogfard testing by the owner across the session.
- All work shipped in `prototype/test-game/` + docs; committed 2026-07-10.
