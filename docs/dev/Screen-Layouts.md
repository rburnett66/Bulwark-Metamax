# Screen-Layouts.md

# Screen Layouts — BULWARK

*Planning-phase concrete layout for every screen defined by the UX loop. Grounded in `bulwark-visuals.md` (§1 layer stack, §5 structure menu, §7 HUD/camera, §8 Controls & UX, §9 replay, §10 slice scope), `bulwark-gdd.md` (§3 core loop, §4 world tiers, §6 units, §8 structures, §9 factions), and `bulwark-balance.xlsx` (live unit pricing, structure tiers).*

**HUD contract (authoritative constant across all in-battle screens):** the HUD is **screen-space, layer 14, and never rotates** (visuals §1, §7). All world layers (2–13) rotate beneath it; UI is fixed. This single rule governs every layout below and resolves any ambiguity about what tilts with the camera and what stays anchored.

**Screen inventory** (derived from the loop `Scout → Fortify → Defend → Collect → Upgrade → Story` in GDD §3, plus the Main-Menu/replay entry point in visuals §9):

1. Main Menu
2. Battle HUD (Day Battle — Defend/Collect)
3. Build Overlay (Day Build — Fortify)
4. Structure Context Menu (selection popup)
5. Deploy Preview (transient placement state)
6. Story / Unlock Screen (post-wave reward)
7. Continent Map (world-tier navigation)
8. Replay Viewer

---

## 1. Layout Per Screen

Grids are expressed as `cols × rows` on a **12 × 8** reference canvas (16:9). Region positions use `[colStart–colEnd, rowStart–rowEnd]`.

> **Assumption:** No separate UX-Design.md was supplied; screens are inferred from the source loop and controls. Each inferred screen is grounded to a cited source behaviour, so no golden-path region is a placeholder.

### 1.1 Main Menu

| Region | Position | Contents |
|---|---|---|
| Title / Logo | `[1–12, 1–2]` | BULWARK wordmark, version tag |
| Primary Nav | `[5–8, 3–6]` | Play (Continue / New), **Replays** (visuals §9), Options, Quit |
| Background Diorama | `[1–12, 1–8]` (behind nav) | Rotating 2.5D scene using the fake-3D layer stack (visuals §1–§7) as ambient showcase |
| Footer Bar | `[1–12, 8]` | Build/version, credits link |

**Rationale:** the diorama previews the game's signature rotatable perspective before the player touches a battle, doubling as a load-mask surface.

### 1.2 Battle HUD (Day Battle)

Combat viewport fills the canvas (rotatable world, layers 2–13). HUD regions overlay in screen space.

| Region | Position | Contents |
|---|---|---|
| World Viewport | `[1–12, 1–8]` | Rotatable battlefield; depth-sorted units/structures/FX (visuals §1–§4) |
| Top Status Bar | `[1–12, 1]` | Gold balance (live), wave # / tier (GDD §4), threat-direction indicator (visuals §7) |
| Unit List Panel | `[1–3, 2–7]` | Deployable units **with live pricing** — create cost and kill-bounty (visuals §8; balance.xlsx `Cost T1/T2/T3`, `EffDPS`) |
| Camera Rotate Control | `[11–12, 7–8]` | Rotate-orientation control (first-class per visuals §7) |
| Speed / Pause + Log | `[11–12, 1]` | Pause, sim-speed, battle-log active indicator (visuals §9) |
| Coin FX Layer | anchored to kill events (world) | Classic-console coin pickup on kill (visuals §10) |

**Rationale:** the left rail and bottom-right rotate cluster keep both thumbs in a mobile-friendly reach zone while leaving the center viewport unobstructed for the tilting battlefield.

### 1.3 Build Overlay (Day Build)

Shares the World Viewport; swaps the unit rail for a structure rail. Base **hard points** highlight as valid slots (visuals §8).

| Region | Position | Contents |
|---|---|---|
| World Viewport | `[1–12, 1–8]` | Battlefield with hard-point slot highlights on the Base |
| Structure List Panel | `[1–3, 2–7]` | Buildings from GDD §8 (Blacksmith, Armory, Barracks, Stables, Science Lab, Balloons, Runway, Walls, Moats, Traps, Murder Holes) with placement cost |
| Top Status Bar | `[1–12, 1]` | Gold balance, "BUILD PHASE" state, hard-point count (scales with level, visuals §8) |
| Confirm / End Build | `[10–12, 8]` | End-build → advance to next wave (GDD §3 cadence) |

**Rationale:** reusing the Battle HUD skeleton (same rail column, same status band) means the phase swap is a rail-and-tint change, not a screen transition — preserving spatial memory across the Fortify↔Defend flip.

### 1.4 Structure Context Menu — *popup, anchored to selected structure*

Triggered by tap/click on an existing structure (visuals §5, §8). Renders in screen space near the anchor; battlefield shows a **dashed range circle** (visuals §5).

| Region | Position | Contents |
|---|---|---|
| Range Circle | world overlay at structure | Dashed circle, radius = structure range (visuals §5) |
| Popup Header | popup top (1 row) | Name, Level (T1–T3), current Damage/HP (balance.xlsx `Structures`) |
| Action Row | popup body (3 buttons) | **Upgrade** (price), **Repair** (gold cost + troop time), **Sell** (sell price) — the three verbs in visuals §5/§8 |

**Edge case:** anchor the popup on the side of the structure nearest screen center so rotation never pushes it off-canvas.

### 1.5 Deploy Preview — *transient state over Battle/Build*

The `pick → preview → confirm/cancel` verb (visuals §8) — a required layout state, not a separate screen.

| Region | Position | Contents |
|---|---|---|
| Placement Ghost | follows pointer/finger (world) | Translucent footprint + **valid/invalid tint** (visuals §5, §8) |
| Path Preview (troops) | Base → drop point | Troop march path (visuals §8: troops deploy from base) |
| Drop / Cancel affordance | pointer-anchored (2 targets) | Drop to deploy, cancel to abort (single-pointer parity, visuals §8) |

### 1.6 Story / Unlock Screen

Post-cleared-wave reward (GDD §3: cleared waves grant story; §9: beating a faction unlocks its units).

| Region | Position | Contents |
|---|---|---|
| Story Panel | `[3–10, 2–5]` | Faction narrative beat, trope-flavored text (GDD §9) |
| Unlock Reveal | `[3–10, 6–7]` | Newly unlocked unit(s) from the defeated faction (GDD §4 "Earn by beating") |
| Continue | `[10–12, 8]` | Advance to next wave / next continent |

### 1.7 Continent Map

World-tier navigation (GDD §4: path → field → region → continent → planet).

| Region | Position | Contents |
|---|---|---|
| World Viewport | `[1–12, 1–8]` | Node-graph of the current tier; cleared nodes lit, next node pulsing |
| Tier Breadcrumb | `[1–12, 1]` | Current position in the path→planet hierarchy (GDD §4) |
| Node Info Panel | `[9–12, 2–6]` | Selected node's faction, reward preview, entry cost |
| Deploy / Back | `[10–12, 8]` | Launch battle at node, or zoom out one tier |

### 1.8 Replay Viewer

Entered from Main Menu (visuals §9). Reuses the Battle HUD viewport with a playback transport replacing live controls.

| Region | Position | Contents |
|---|---|---|
| World Viewport | `[1–12, 1–8]` | Deterministic replay of a recorded battle-log (visuals §9) |
| Transport Bar | `[1–12, 8]` | Scrub, play/pause, speed, restart |
| Camera Rotate Control | `[11–12, 7–8]` | Free camera rotation during playback (visuals §7) |

---

## 2. Cross-Screen Consistency Rules

- **Rail column is sacred:** cols `1–3` are always the actionable-list rail (units, structures, node graph). Never place viewport-critical FX there.
- **Bottom-right is confirmation:** `[10–12, 8]` is the "advance/commit" slot on every non-battle screen (End Build, Continue, Deploy, transport).
- **Status band is glanceable:** row `1` is read-only state (gold, wave, phase) — no interactive targets except the top-right speed/pause cluster.
- **Never rotate the HUD:** enforce layer 14 for all regions above; only viewport contents tilt.

---

## 3. Key Recommendations

1. **Prototype the rail swap first.** Battle HUD and Build Overlay differ only by rail contents and tint — build one component, parameterize it, and validate the phase flip feels seamless.
2. **Wire live balance data early.** Unit and structure costs pull directly from `balance.xlsx`; bind these at runtime so tuning passes never require layout edits.
3. **Treat Deploy Preview as a state machine, not a screen.** Its `pick → preview → confirm/cancel` overlay must work identically in both Battle and Build to satisfy single-pointer parity.
4. **Anchor popups defensively.** The Structure Context Menu must reposition against camera rotation; test at all four cardinal orientations before locking placement.
5. **Reuse the viewport for Replay.** The Replay Viewer should be the Battle HUD with a transport bar — this guarantees deterministic parity between live and recorded framing (visuals §9).

---

*Generated by MetaMax Research Brain (LangGraph)*