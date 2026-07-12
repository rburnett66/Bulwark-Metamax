# BULWARK — Visual & Controls Spec

*Companion to the BULWARK GDD. Covers rendering, FX, camera, controls, and replay. The GDD stays the systems source; this is the presentation & input contract.*

**Version:** 1.0 · Cross-refs: GDD §5 (terrain/shadows), §8/§16 (structure states), §16 (unit states, sun & shadows), §18 (determinism), §19 (vertical slice); `bulwark-balance.xlsx` (unit/structure stats).

---

## 1\. Rendering approach — layered 2.5D

No full 3D models. The game **fakes 3D with stacked, independently-animated 2D surfaces** sorted back-to-front (painter's algorithm). Depth reads from three cues working together: **layer order** (what's drawn over what), **shadows** (grounding \+ altitude), and **camera rotation** (parallax between layers). Done right, flat art reads as dimensional; the whole art budget goes into layering and light rather than polygons.

**Canonical world z-order (back → front):**

1. Sky / backdrop  
2. Water (surface \+ sub-surface tint)  
3. Ground (low / mid / high bands)  
4. Ground shadows (cast by everything above onto terrain)  
5. Grass & bushes  
6. Trees (with their own cast shadows)  
7. **Ground units** — depth-sorted among themselves (see §2.2)  
8. Structures — depth-sorted with ground units by footprint anchor  
9. Projectiles & ground-level FX  
10. **Air units** \+ their dim altitude shadows (shadow drawn back on the terrain layer, sprite drawn here)  
11. Clouds (overhead occluder)  
12. Muzzle/impact FX, completion flashes  
13. Fog of war  
14. UI / HUD (screen space, never rotates)

Everything in layers 2–11 belongs to the rotatable world; layer 14 is fixed to the screen.

---

## 2\. Unit sprite stack (the core "fake 3D" trick)

### 2.1 Four sub-layers per unit, bottom → top

Each unit is a stack of four independently-driven sprites, not one image:

1. **Legs / locomotion** (bottom) — the moving base; drives the walk/tread/hover cycle and kicks up dirt (§3).  
2. **Body** — the chassis/torso; carries the faction palette and armor-class read.  
3. **Weapon** — **rotates independently to convey orientation** (points at the current target) and plays the **shot effect** (muzzle flash, recoil). Its aim direction is the primary readability cue for "who is this shooting."  
4. **Head / sensors** (top) — **telegraphs focus and attention**: the sensor/head turns toward the target the unit is *acquiring* before the weapon commits.

**Telegraphing rule (readable combat):** sensors lead, weapon follows. The head/sensor swings to a target first (acquisition), then the weapon rotates and shows a **lock-on wind-up** whose duration equals the unit's time-to-fire. Only after lock does the projectile launch. Players can read intent — who's about to shoot whom, and how soon — purely from the top two layers.

### 2.2 Depth sorting & animation states

- Ground units sort by their **ground anchor** (screen-projected Y after camera rotation): units "lower/nearer" draw over units "higher/farther." Re-sort every frame as they move.  
- The four layers animate against the unit's state machine from GDD §16: **Idle · Moving · Attacking · Death**. (Legs cycle in Moving; weapon/head active in Attacking; whole stack collapses in Death.)  
- The stack maps to the shape taxonomy (Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles). Air shapes replace "legs" with a rotor/thrust layer.

---

## 3\. Ground, movement & shadows

- **Dirt matters.** Movement kicks up dirt/dust trails under the legs layer — this sells weight and speed and is a primary motion read during battle. Tune intensity to unit mass (Heavy Tanks throw more than Troops).  
- **Simple shadows, universally.** Every ground unit, structure, and tree casts a **simple soft shadow** onto the terrain, offset by the global **sun direction** (GDD §16). Shadows are cheap (blurred blob or projected silhouette), not raytraced — but they're non-negotiable for grounding.  
- **Air-unit shadows convey altitude.** Air units cast a **dim, offset shadow** on the ground; the shadow's distance from the sprite reads as height. Higher units → fainter, farther-offset shadow. This is how the player distinguishes a low copter from a high plane at a glance.

---

## 4\. Combat FX

Every shot is three things, not one:

- **Firing effect at the muzzle** — a brief **light** flash, plus **smoke** and/or **sparks** appropriate to the weapon.  
- **A traveling projectile** — visible in flight (tracer, shell, bolt, missile), so trajectory and lead are readable.  
- **An impact effect** — hit spark/splash/scorch keyed to the damage type (fire → burn flare, electric → arc, frost → shatter, etc., per `bulwark-balance.xlsx` DamageTypes).

Projectile visuals and arc should match the weapon class (ballistic artillery lobs; hitscan/energy is near-instant with a beam/flash).

---

## 5\. Structure lifecycle FX

Structure states from GDD §8/§16 each get a signature effect:

| State | Effect |
| :---- | :---- |
| Placing | translucent ghost \+ valid/invalid tint (see §7) |
| Building (construction) | **rising dust** around the footprint for the build duration |
| Complete (build **or** repair) | **brief gold "pie-sweep" flash** — a radial gold wedge sweeps 360° once to confirm completion |
| Damaged | **light smoke** streaming from the structure, scaling with damage taken |
| Destroyed | burst of **dust \+ debris**, then rubble decal |
| Aiming / Firing | weapon-layer rotation \+ muzzle FX (as §2, §4) |
| Upgrading 1-2-3 | construction dust \+ the gold completion flash on each tier-up |
| Selling | dust puff \+ partial-refund gold pickup |

The **gold pie-sweep** is the game's universal "done \+ paid off" motif — same flash for finished builds, finished repairs, and completed upgrades, so players learn one signal.  Selecting a structure present a dashes range circle, and pops up a small window with name, damage, level, and buttons for upgrade with price, repair, and sell with a sell price. Repairs are free but the troops used to repair are not free, and repairs take time and there is time for a troop to mvoe to a structure.

---

## 6\. Environment layering & atmosphere

The simulated-3D read depends on honest layering of the environment, per the z-order in §1: **water · ground · grass · bushes · trees (with shadows) · clouds · air units (dim altitude shadows)**. Practical rules:

- **Trees** sit above ground units at their anchor but cast shadows down onto the terrain layer, so units passing "behind" a tree are partially occluded — a strong depth cue. Tree animated with a vertex shader to show movement.  
- **Clouds** drift as an overhead layer and can briefly occlude air units and dim the ground (ties to air-vision occlusion, GDD §5). Render with an appropriate shader to show the cloud vapor cycling slowly.  
- **Water** shows a surface layer plus a sub-surface tint so swimmers (GDD §6) read as submerged vs. floaters on top. Water also has a simple visual shader with no transparency or reflecting. Objects in water create ripples and a basic noisy wake when moving created with simple particles.

---

## 7\. Camera & orientation

- **Rotate orientation** is a first-class control. The player can rotate the world; rotation **shows off the polish** — parallax between the stacked layers, shifting shadows, and the altitude offsets of air units all become visible, which is where the fake-3D pays off.  
- Rotation re-runs the depth sort (§2.2) and re-projects shadow offsets against the (fixed) sun direction, so lighting stays consistent as the view turns.  
- **Cinematic camera:** for battle intros/outros the camera can **slowly auto-rotate** to frame the **relationship between the base and the incoming threat** — establishing where the attack is coming from before the player takes control.  
- The **HUD never rotates** (screen-space, layer 14).

---

## 8\. Controls & UX

**Principle:** deep game, simple hands. One interaction verb for almost everything: pick → preview → confirm/cancel.

- **Deploy loop (mouse or touch, identical):**  
  1. **Select** a unit or structure from the list.  
  2. **Hover / drag** to a location — a placement preview shows the ghost and a **valid/invalid tint** (blocked by space, terrain, or cost).  
  3. **Drop** to deploy, or **cancel** to abort.  
- **Unit & structure lists** are the primary panel. The **unit list shows live pricing** — each unit costs gold to create, each kill generates gold (values from `bulwark-balance.xlsx`), so affordability is always visible.  
- **Tap/click an existing structure** → contextual menu to **Upgrade · Repair · Sell**.  
- **Troops always deploy from the player's base** and path to the chosen location (they don't spawn at the drop point — they march out).  
- **Base hard points scale with level.** As the player levels, the **Base gains additional hard points** — fixed slots where structures and defenses may be placed. Early game is deliberately constrained; capacity is a progression reward.  
- **Input parity:** every action works with a single pointer (mouse) or a single finger (touch) on a phone. No multi-key combos, no required keyboard.

---

## 9\. Replay & battle log

- **Every battle feeds an invisible log stream** — a complete, ordered record of the deterministic simulation (inputs \+ seed \+ events), written silently during play.  
- **Replays** are reconstructed from that log and are **available from the Main Menu**.  
- **This is the determinism requirement made visible.** The GDD (§18/§19) requires a seed-stable, headless-callable combat core; the replay system is that core re-driven from the log. If replays reproduce a battle exactly, determinism is proven; if they drift, the sim isn't deterministic. Build the log stream and the headless core as one thing — replay is the acceptance test for both.

---

## 10\. Vertical-slice visual scope (benchmark alignment)

To keep this consistent with GDD §19, the slice must minimally render:

- The **four-layer unit stack** with legs/body/weapon/head and the sensor→weapon telegraph, for the slice's walker, floater, and flyer.  
- **Simple ground shadows** for ground units and a **dim altitude shadow** for the flyer.  
- **Dirt on movement**, and the **three-part shot** (muzzle FX \+ projectile \+ impact).  
- **Structure FX** for at least: construction dust, the **gold pie-sweep completion flash**, damage smoke, and destruction debris — on the three slice towers.  
- The **deploy loop** (select → hover preview → drop/cancel), the **unit list with pricing**, and the **structure menu** (upgrade/repair/sell).  
- **Troops marching from base**, and at least one **camera rotation** to demonstrate layer parallax \+ shadow consistency.  
- The **battle log \+ replay** path (this doubles as the determinism check).  
- **Killing** an attacking unit should generate a simple coin animation with coins sounds similar to classic console games.

Everything else in this spec is Tier-1+ polish; the list above is the slice's visual definition of done.  
