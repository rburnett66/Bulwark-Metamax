# Tech Plan — Ship Crew Characters: the rig, faction looks, poses and crew life

**Epic:** `epic_mw49625t_b` "L2 Capital ship interiors" (Bulwark advanced mode).
**Status:** v0.1, 2026-11-05, agent-proposed. Notes and as-built justifications for this epic go here, not on the tickets.

**Design inputs:**
- `Collective-Opening-Design.md` v0.2 §5;
- the Bulwark Character Sheet and Long Ledger prototypes;
- the Dossier (factions, the 81 heroes, the Collective officers).

**Companion plans:**
- `Capital-Ship-Interior.md`: the rooms these figures live in.
- `Dialog-Response-Reputation.md`: close-ups during replies.
- `Collective-Opening.md`: the patron beat.

## 1. Scope

**In scope:**
- The procedural humanoid used for all ship crew and named characters.
- Its faction helmets and outfits, civilians and roles.
- The pose machine.
- How crew move about a ship (lanes, posts, lift).
- The close-up used in dialogs.
- Moving it from the prototypes into a game module.
- The additions the opening needs.

**Out of scope:**
- Battle units (their own pipeline).
- Portraits (2D art).
- Rigged or skinned glTF characters. The Blender rig in the v0.1 opening design was dropped in v0.2 in favour of this rig.

## 2. As built

**Sources:** the **Character Sheet** (artifact `MBrTStmqgULyFM4XFkj5jM`, 2026-10-27) and the **Long Ledger** (artifact
`S9B7GgVN7XcRDBTSF7BVth`, 2026-10-27). Both are committed under `prototype/test-game/tools/ship-interior/prototype/`.

The body is the MetaMax "Project City" foreman (2026-10-08), ported and extended.

| # | Feature | How it works today |
|---|---|---|
| C1 | **Body** | Built from primitives with `MeshStandardMaterial` in linear sRGB colours: flattened-sphere shoes, denim cylinder legs, a shirt cylinder torso, an open vest (an open cylinder with a 0.5 rad gap) with a reflective band and two front strips, sleeve cylinders and sphere hands, and a squashed-sphere head with a hair shell, two eyes and two ears. A camera-facing contact-shadow disc sits at the feet. Pivots: `lArm` and `rArm` at the shoulders, `head` at the neck, `body`. The rig is scaled ×2.7 and the group ×0.72. About 40 meshes. |
| C2 | **Helmets** | `makeHelmet(style, hc)` builds 14 styles from primitives: `hardhat`, `beanie`, `none`, `servicecap` (Collective), `captain` (peaked cap with visor and badge), `combat` (Ground), `aviator` (Air), `techvisor` (High Tech, glowing visor), `tanker` (Artillery, ear cans and mic), `diver` (Water, brass porthole), `cowl` (Arcane, mitre and ember), `spacehelm` (Space Tech, glass bubble and light ring), `hoodmask` (Dark Energy, sensor eye), `gasmask` (Greenies). Each has `{shell, trim, accent}` colours; `HELM_DROP` seats each one on the head. |
| C3 | **Faction looks** | `FACTIONS` holds 10 entries, each with an outfit colour, a stripe colour, a helmet style and helmet colours. `cfgFor(fac, {captain, outfit, stripe, helmet, hc, skin, hair, plain})` builds a config. The captain gets the peaked cap in `CAPTAIN_HC`. The player is gold with a hard hat. |
| C4 | **Civilians and roles** (sheet) | `plain` drops the reflective stripes. Skin and hair overrides. Civilians: Citizen, Dockhand, Trader, Elder, Spacer (beanie), Youth. Roles: Captain, First Officer, Deck Crew, Marine, Pilot, You. |
| C5 | **Poses** | `POSE` holds 8 states: idle, walk, talk, point, wave, salute, angry, celebrate. Each is arm x/z, head x and body x targets. `drivePose(ud, cur, state, yaw, dt, now, phase)` eases toward the target (`k = 1 − e^(−7dt)`) and layers per-state motion: talk gestures, the wave swing, celebrate hops, the angry shake, a point sway, idle breathing. It returns a hop height. In the sheet, walk swings the arms. Reduced motion removes the layered motion. |
| C6 | **Deck crew** (Long Ledger) | Agents on deck lanes: walk 1–3 steps of 12 % at 2.3–3.7 speed, then a gesture from `GESTURES` (talk ×2, point, idle, wave, salute, angry, celebrate) for 1.5–3.9 s, then repeat. Walking faces ±0.72 rad toward the camera. Gestures face the camera. A gentle bob. Up to 16 per deck, one per depth layer (z −2 per layer, +0.4 rise, ×0.975 scale). The player holds the front layer. |
| C7 | **Signature poses** | A room's flag picks its occupant's pose: mission → point, reward → celebrate, store / talk → talk, upgrade → point. The captain salutes. |
| C8 | **Close-up** | The dialog modal's own renderer: a perspective camera (fov 30) with a hemisphere fill, a sun and a cyan rim. The character waves for 1.4 s on entry, then holds its signature pose; same `drivePose`. |
| C9 | **Character Sheet page** | One full-window canvas rendering every tile through scissor viewports, with off-screen tiles culled. Sections: general public, factions, roles and ranks, emotes. |

**Known limits:**
- No legs move, and walking is a slide with an arm swing (Long Ledger) or an arm swing alone (sheet).
- No sitting.
- `Math.random` drives everything, so no two loads match.
- About 40 draws a figure.
- Each figure has its own materials (no sharing).
- The helmet set covers the factions, but named heroes are not distinct from crew.
- The code is copied between the two pages.

## 3. Target module — `src/ship-interior/crew.js`

### 3.1 Figure (`makeFigure(cfg) → { group, rig, pivots, setPose, update }`)

- **C1–C4 unchanged in look.** One source for both the room view and the review sheet.
- **Hips and knees.** Two leg pivots at the hips and a knee pivot on each leg (the leg splits into thigh and shin
  cylinders), so the figure can walk with steps and sit.
- **Shared materials.** One material per colour per faction set, cached by hex, so 20 figures share about 25 materials.
- **Merged statics.** At spawn, the meshes under each pivot group merge per material, giving about 6 draws a figure
  (body, vest and stripes, skin, hair, helmet, shadow) with every pivot kept.
- **Named characters.** `cfg.name` and optional `badge` (a small chest plate in the faction accent) for heroes and
  officers, so key characters read as distinct from crew. Faces stay generic; portraits stay 2D.

### 3.2 Poses — the 8 built, plus additions

| Pose | Targets and motion | Used by |
|---|---|---|
| `walk` | Arms swing (as built) + legs swing ±0.5 rad, opposite phase; small body bob at step rate | Every walker |
| `sit` | Hips −1.5 rad, knees +1.5 rad, body lowered to the seat point's height; idle breathing | Bar stools, mess, consoles |
| `sit-drink` | `sit` + right arm lifts a cup (small cylinder prop) to the head every 6–9 s | Patron, bar crew |
| `work` | Arms forward −1.0 rad, small alternating hand taps, head nods toward the surface | Helm consoles, Engineering, Trade desks |
| `flash` | Not a pose: vest emissive pulses gold twice (0.25 s up / 0.35 s down), plus a chevron sprite above the head; ≤ 3 Hz. Reduced motion: a steady gold outline. | The opening patron beat; later any "this one wants you" |
| `turn` | Yaw eases from the seat's facing to the camera over 0.6 s | The patron in beat 8; anyone you open a dialog with |

`drivePose` keeps its signature. The new states are added to `POSE` and the motion switch. Close-ups (C8) get the new
poses for free.

### 3.3 Crew life — lanes, posts, lift, schedules

| Behaviour | Details |
|---|---|
| **Lanes** | One per deck, from `layout.js` (Capital-Ship-Interior §3.2), with C6's depth layering. Walkers pass through door gaps. |
| **Posts** | A key character (one per room) stands or sits at the room's stand spot or a named point of interest. They play the signature pose (C7) with idle breaks and take a short walk inside the room every 20–40 s. They never leave the room. |
| **Ambient crew** | Walk / gesture cycles as C6. They may stop at a free `seat` or `work` point in a room they pass and stay 8–20 s. A point is reserved while used. |
| **Lift** | Some walkers ride the lift to another deck: walk to the lift x, enter (fade into the shaft), the platform moves at 6 units/s, then exit onto the target lane. This produces cross-deck movement, and the player's walk-to uses the same ride. |
| **Schedules** | Per-character seeded choice of walk length, gesture, point stop and lift ride. A fixed 30 Hz step, separate from the battle sim (`sim/rng.js` untouched). The same seed gives the same ship, which makes screenshots and review repeatable. |
| **Crew data** | `content/ships/<faction>/crew.json`: `[{fac, deck, role: 'crew' \| 'civilian', seed}]`. Key characters come from the layout's rooms (`fac`, `cap`, `who`). Opening overrides (Mira at the bar) come from the opening script. |

### 3.4 Budgets

| Tier | Figures | Update rate |
|---|---|---|
| High | 20 | 60 Hz |
| Mid | 20 | 30 Hz beyond the focused room |
| Low | 12 | 30 Hz |

About 6 draws a figure gives about 120 draws at most. Figures out of view stop updating.

## 4. As built → target

| Prototype | Target | Change |
|---|---|---|
| C1 body | `makeFigure` | Legs and knees, shared materials, merged statics. |
| C2 helmets | Same 14 styles | Moved into the module unchanged. |
| C3 / C4 configs | `cfgFor` + `figures.json` presets for civilians and roles | Data. |
| C5 poses | `POSE` + walk legs, sit, sit-drink, work, flash, turn | Additions. |
| C6 deck crew | Lanes + posts + points + lift + seeded schedules | Behaviour grows. |
| C7 signature poses | Unchanged | — |
| C8 close-up | `closeUp.js`, used by the room modal and the conversation panel | Shared. |
| C9 sheet | Crew board on the review page | Adds the new poses and tiers. |

## 5. Tests

| Test | Checks |
|---|---|
| `ship-interior/crew.test.mjs` | Every faction, civilian and role config builds; every pose including the additions drives 600 steps without NaN and stays within joint limits; a merged figure is ≤ 8 draws with all pivots present; same seed → same positions at t = 60 s; posts hold their room; at most 16 per lane; a reserved point is never shared; a lift ride ends on the target deck's lane. |
| Review | The crew board (every helmet × every pose), seated figures at the bar preset, a lift ride, reduced motion, and the tier counts. |

## 6. Stories

| # | Story | Depends on |
|---|---|---|
| I2 | Port the rig, helmets and 8 poses into `crew.js`; add legs, sit, sit-drink, work, flash, turn; merged figures (was Opening S4) | — |
| I3 | Crew life: posts, ambient crew, points, lift, seeded schedules, `crew.json`, tier counts (was Opening S5) | I1 (rooms), I2 |
| I7 | Shared close-up (`closeUp.js`) for the room modal and the conversation panel | I2 |

## 7. Notes

- **2026-11-05.** Plan written from the Character Sheet and the Long Ledger as built. This replaces the Blender
  character pipeline of the opening design v0.1.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| implements | docs/16 Bulwark MM/design/Collective-Opening-Design.md | the cast, who sits where, and the patron beat |

`Capital-Ship-Interior.md` supplies the lanes, door gaps, lift positions and room points of interest these figures use.
It depends on this plan, so it is not listed here (the dependency graph stays one-way).
