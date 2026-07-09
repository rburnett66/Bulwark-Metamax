# State Harness — Game Design Document

## 0. Purpose & context
The **State Harness** is Bulwark's **unit authoring + validation bench**: the isolated tool where a single unit is
**composed from its part-stack, sized, skinned, driven through every gameplay state, and previewed under the game
camera** — before any full-roster art is produced.

It is the **gating milestone** named in `content/Content-Production-Plan.md`: *prove the four-layer × multi-state
unit pipeline on a single walker first; do not attempt full-roster art before the pipeline validates.* Every unit
in Bulwark obeys the **readability law** — you can read its state from its silhouette. The Harness is where that
readout is designed, tuned, and proven.

The Harness is **not** a separate faked view. It drives the **same deterministic sim state** (hp, target
acquisition, movement) through the **same render projection** the game uses, in isolation — so what you approve in
the Harness is exactly what the game shows. (Projection architecture: ENGINE state → RENDER choreography.)

Three principles govern the whole design:
- **One architecture, two scales (§5).** The Harness serves **both** a single unit (bench) **and** the full roster
  (field) on the same components — M1 is a real vertical slice of the full system, never a throwaway.
- **Built on Pixi.js (§4).** It renders through the **game's own Pixi pipeline**, so unit visualizations are
  **pixel-accurate** to in-game — not an approximation in a separate canvas.
- **Droppable, engine-usable units (§6).** A unit authored in the Harness is a **portable definition** (stats +
  part-stack) that the **existing game engine loads, spawns, and plays** — authored once, dropped into the live
  game. The Harness is a unit *factory*, not just a viewer.

---

## 1. Unit composition — build a unit
A unit is a **layered stack of parts**. Each part is a **selectable sprite** and each **reads out one live state
dimension**:

| Layer (z-order) | Part | Reads out | Behaviour |
|---|---|---|---|
| 0 (bottom) | **Base** — legs / body / locomotion | **Health** | the chassis; cracks / darkens / sinks as hp drains; locomotion sub-layer swaps by domain (legs · floater · rotor-thrust) |
| 1 | **Weapon** — turret | **Aiming + time-to-acquire-target** | rotates to aim; "winds up" while locking; muzzle beat on fire |
| 2 (top) | **Head / sensor** | **Awareness** | turns toward the target it is acquiring; origin of the sensor→weapon telegraph |

### Build controls
- **Sizing** — overall unit scale, plus **per-part scale + offset** (base footprint, weapon length, head size).
- **Sprite selection** — choose the sprite for **each** part (base, weapon, head) from the art library; correct
  **z-order** base → weapon → head; **domain locomotion swap** (legs / floater / rotor-thrust) on the base layer.
- **Anchors / pivots** — weapon pivot on the base, head pivot, and the **muzzle point** (where shots + the
  telegraph originate). Pivots are what make aim + awareness rotation read correctly.
- **Primitive fallback** — any part without a chosen sprite renders as its primitive placeholder, so composition
  is never blocked by missing art (the lean game's primitive baseline stays valid).

---

## 2. State simulation — drive a unit through its states
The Harness triggers each gameplay state and shows the **correct part(s) animating their readout**, driven by the
**real deterministic sim** (not scripted fakes) so telegraph timing matches the game exactly.

| State | Drives | Reads on |
|---|---|---|
| **Idle** | slow sensor scan; weapon neutral | head, weapon |
| **Movement** | base locomotion animates; unit translates; head leads | base |
| **Acquire target** | head turns to target; weapon swings + winds up (acquire-timer telegraph) | head → weapon |
| **Attack** | weapon locked + fires; muzzle beat; damage cadence | weapon |
| **Take damage** | base flinch / crack; hp readout drops; hit reaction | base |
| **Heal** | hp restores; base readout recovers (repair / regen) | base |
| **Death** | base collapses; parts fall / fade | base + parts |

### Controls
- **Place a dummy target** at a chosen position → drives *acquire → attack*, and the *weapon aim* + *head awareness*
  rotation toward it (using the game's real `acquireTarget`, sticky-then-reacquire).
- **Set / drain / restore HP** → drives the *base / health* readout and the *take-damage* and *heal* states.
- **Trigger / scrub** any state; **play · pause · single-step** on the deterministic fixed tick; **speed** control.
- **Timeline readout** — show the acquire-timer, aim angle, awareness angle, and hp as live values so the
  telegraph can be tuned to exact frames.

---

## 3. Camera & pseudo-3D projection
The Harness previews the unit under the **game camera**, a fixed pseudo-3D view — the whole point is to see how a
unit **reads at any position on screen**, because units skew and cast shadows differently across the field.

### Camera model
- **Origin: `0,0` at the bottom-middle of the map.** The camera sits at the bottom-centre and looks **into** the
  map (up the ground plane). Bottom-centre is **nearest**; the top of the map is **farthest**.
- **Parallax / skew by screen position** — a unit's apparent shape skews with its position relative to the camera
  axis:
  - **Top of screen (far):** smaller, flatter, less vertical presence.
  - **Left / right of centre:** lateral **skew / lean away** from the camera axis — the further off-centre, the
    stronger the parallax lean.
  - **Bottom-centre (near):** upright, largest, no skew (the reference pose).
- One **projection function** maps `map-position → screen (scale + skew)`. The game render uses the **same**
  function, so the Harness and game share one camera — a unit tuned in the Harness sits correctly in-game.

### Shadow
- Each unit casts a **ground shadow derived from its base + turret (weapon) silhouette**, projected onto the ground
  plane by a fixed light direction.
- The shadow **tracks the unit's position** (consistent with the camera parallax) and **rotates with the weapon's
  current aim** (the turret silhouette turns → its shadow turns). Flyers add a **dim, offset altitude shadow**.

### Camera controls in the Harness
- **Sample positions** — jump the previewed unit to bottom-centre, top, left, right, corners to see skew/parallax
  + shadow at each.
- **Sweep** — move the unit continuously across the field to preview the projection + shadow in motion.
- **Toggle shadow**, **adjust light direction**, **toggle grid / camera guides**.

---

## 4. Architecture — how it stays true to the game
- **One state, one projection.** The Harness uses the game's **ENGINE state** (deterministic sim: hp,
  `acquireTarget`, movement) and the game's **RENDER projection** (part-stack + camera + shadow). Nothing is faked
  — approving a unit in the Harness approves it in-game.
- **Deterministic.** State playback runs on the fixed-step deterministic sim (seed + fixed `dt`), so a previewed
  sequence is reproducible and replay-compatible.
- **Sprite path over the primitive baseline.** Today the game renders units as **primitives**; the Harness
  introduces the **layered sprite** path (base/weapon/head sprites + z-order + pivots + shadow) — the net-new
  rendering capability the roster needs — while keeping the primitive fallback.
- **Shared camera module.** A single module owns `project(mapPos) → screen(scale, skew)` and the
  `shadowFrom(base, weapon, aim, light)` projector; both the Harness and the game render import it.
- **Built on Pixi.js — accurate by construction.** The Harness is built on the **same Pixi renderer as the game**
  (the test-game's render), NOT the menu's separate 2D-canvas runtime. The layered part-stack, the camera
  projection, and the shadow are drawn by the **same Pixi display code the game uses**, so a unit in the Harness is
  **pixel-accurate** to in-game — which is the entire point of a validation bench.

---

## 5. Scale — single unit ↔ full roster (one architecture)
The Harness must serve **both** the single unit **and** the full design on **one architecture** — M1 (a single
walker) is a genuine **vertical slice** of the full system, not a throwaway prototype. Everything M1 builds — the
data model, the Pixi layered-sprite render, the camera + shadow module, the authoring pipeline — is the **same
foundation** the full 72-unit roster runs on; no M1 shortcut is discarded when the design scales up.

**Two modes on the same components:**
- **Bench mode (single unit)** — isolate one unit: compose it, drive its states, inspect it under the camera. For
  authoring + validating a unit in detail. *(the M1 gating slice.)*
- **Field mode (full design)** — many units on the map under the real sim + shared camera: the roster in play, real
  combat (units acquiring/attacking each other), overlapping shadows, readability across the whole field. For
  proving the full design reads correctly **together**.

**Each subsystem is built once and serves both scales:**

| Subsystem | Single unit (bench) | Full design (field / roster) | The shared foundation |
|---|---|---|---|
| **Composition / data** | edit one `UNITS` entry | N entries = the roster | one data-driven unit schema + Pixi part-stack render |
| **State / sim** | isolate one unit's states | full deterministic sim, many units, real combat | the SAME sim; per-unit readout identical at both scales |
| **Camera / shadow** | one unit's parallax + shadow | the whole field; overlapping shadows | ONE Pixi projection module — also used by the actual game render |
| **Authoring** | author / tune one unit | roster library, batch, export to `UNITS` | one authoring pipeline; the roster is more of the same |

**Consequence:** proving one unit (M1) and growing to the full roster requires **no re-architecture** — the bench
and the field are two views of one system. Early milestones should already allow **dropping extra units into a
scene**, so cross-unit readability + overlapping camera/shadow are validated before the roster scales up.

---

## 6. Droppable units — authored in the Harness, played by the engine
Units authored in the Harness must be **usable by the existing game engine**, not just previewable. The Harness is
a **unit factory**: its output is a **portable unit definition** — the game's `UNITS` stats **plus** the part-stack
(base / weapon / head sprite refs + sizing + pivots) — in the **same format the engine loads, spawns, and plays**.

- **One definition, both sides.** Because the Harness and the game share the sim (stats drive combat) and the Pixi
  render (the part-stack draws the unit), a unit that reads correctly in the Harness **is** a game unit — dropping
  it in needs no re-authoring and no engine code change.
- **Engine loads units from a registry.** The engine reads unit definitions from a **data registry**, not only the
  hardcoded `UNITS` — so a **dropped** unit is immediately spawnable + playable. The Harness writes/updates a
  definition; the engine picks it up. *(This is the one structural change the requirement forces, and it lands in
  M1 because it shapes the data model.)*
- **Drop flow.** Author in the Harness → **drop** (write the definition + asset refs to the registry) → the unit
  spawns in the live game and moves, acquires, attacks, and dies with its authored part-stack + stats.
- **Determinism preserved.** A dropped unit runs on the same deterministic sim (seed + fixed dt) — replay-safe and
  balance-checkable.

The Harness doesn't just preview units — it **produces the roster the game runs**.

---

## 7. Scope & milestones
Per the Content-Production-Plan (*prove on a single walker first; no full-roster art before the pipeline
validates*):
- **M1 — one walker, full pipeline (the gating deliverable):** compose (base/weapon/head sprites + sizing) → drive
  all seven states → preview under the camera with parallax + silhouette shadow → **drop the walker into the live
  engine and play it** (portable definition + registry loading proven on one unit).
- **M2 — domains:** floater and flyer locomotion swaps; flyer altitude shadow.
- **M3 — authoring at scale:** save / load unit definitions, sprite-library browser, roster batch, and the full
  drop / export pipeline (§6) so the whole roster is authored → dropped → played.

---

## 8. Definition of Done (demonstrated, not just built)
Done = **shown working in the Harness**, not merely present in code:
- A unit authored in the Harness is **dropped into the existing game engine and is fully playable** — it spawns,
  moves, acquires, attacks, and dies with its authored part-stack + stats, loaded from the registry (no code change).
- Rendered with **Pixi.js** (the game's renderer) — the Harness view is **pixel-accurate** to what the game draws.
- A unit is composed from **selectable base/weapon/head sprites at chosen sizes**, layered in correct z-order with
  working pivots.
- Each state (**idle, movement, acquire, attack, take-damage, heal, death**) **visibly drives the correct part(s)**
  — base = health, weapon = aim/acquire, head = awareness — off the deterministic sim.
- The unit renders under the camera with correct **parallax/skew** at top / left / right / centre, and a **shadow
  derived from the base + turret shape** that tracks position and aim.
- **Additional units can be dropped into a scene** (field mode) and read correctly together — the same architecture
  proving the design scales from one unit to the full roster.
- The **same** unit dropped into the game looks and behaves identically (one state, one Pixi projection).
