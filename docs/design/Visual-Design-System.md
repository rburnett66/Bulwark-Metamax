# Visual-Design-System.md

# Visual-Design-System.md

**BULWARK — Visual Design System**

*Design-stage presentation contract for BULWARK. This document derives a unified, buildable visual system from the BULWARK GDD (`bulwark-gdd`), the Visual & Controls Spec (`bulwark-visuals`), the balance data model (`bulwark-balance-xlsx`), and the Component Specification (`Component-Spec`). It defines the rendering approach, sprite construction, lighting, FX vocabulary, camera behaviour, and the presentation-side data contracts by which components C11–C19 consume simulation state.*

*Governing rule: per GDD §18 and Component-Spec §0.3, presentation components are **read-only consumers** of the deterministic core (C6). They own no balance state and read all numeric values from `bulwark-balance.xlsx`.*

---

## 0. Scope, Conventions & Firewall

### 0.1 Purpose

This is the single presentation reference for BULWARK. It exists to make the visual system independently buildable and gradeable within the vertical slice (GDD §19; visuals §10), and to preserve the subsystem separability required by GDD §0 and enforced by Component-Spec §0.1. The GDD is the systems source; the balance workbook is the numeric source; **this document is the presentation & input contract**, restating `bulwark-visuals` under the component boundaries of `Component-Spec`.

### 0.2 The Presentation Firewall

The visual system is structurally firewalled from simulation (Component-Spec §0.1, §5):

- **Presentation components (C11–C17)** consume simulation state **read-only**; they never own or mutate balance state (Component-Spec §4).
- **C18 (Controls & Deploy Loop)** is the **sole input surface** (Component-Spec §4; visuals §8).
- **C19 (Replay & Battle Log)** replays C6's deterministic event stream and is the audit trail proving GDD §18 compliance (Component-Spec §5.5; visuals §9).
- All balance-keyed visual parameters (unit mass, damage type, price, tier) are **read from `bulwark-balance.xlsx`**, never hardcoded (GDD §18; Component-Spec §0.3).

**Practical consequence:** a bug in C12–C17 can corrupt *what you see* but never *what happens*. Replay (C19) reproduces the identical outcome from the event stream regardless of frame rate, resolution, or render errors.

### 0.3 Component Cross-Reference

| Ref used here | Component-Spec identity | Layer | Primary source |
|---|---|---|---|
| Rendering / world z-order | C11 (Rendering) | Presentation | visuals §1 |
| Unit sprite stack | C12 (Sprites) | Presentation | visuals §2 |
| Combat & structure FX | C15 (FX) | Presentation | visuals §4–§5 |
| Environment & atmosphere | C16 (Environment) | Presentation | visuals §6 |
| Camera & orientation | C17 (Camera) | Presentation | visuals §7 |
| Controls & Deploy Loop | C18 | Input/UX | visuals §8 |
| Replay & Battle Log | C19 | Systems (presentation-facing) | visuals §9; GDD §18 |

> **Note on numbering.** Component-Spec §1 groups C11–C17 as "Rendering, Sprites, FX, Environment, Camera." Sub-identities here are descriptive; the grouping and boundaries are authoritative from Component-Spec.

### 0.4 Key Definitions

| Term | Definition | Source |
|---|---|---|
| **Layered 2.5D** | Faking depth with stacked, independently-animated 2D surfaces sorted back-to-front (painter's algorithm). | visuals §1 |
| **Unit sprite stack** | Four sub-layers (legs, body, weapon, head/sensors) composing one unit. | visuals §2.1 |
| **Ground anchor** | A unit's screen-projected Y (post camera rotation) used for depth sorting. | visuals §2.2 |
| **Telegraphing rule** | Sensors lead, weapon follows — head acquires before weapon commits. | visuals §2.1 |
| **Gold pie-sweep** | Universal radial gold-wedge flash confirming "done + paid off." | visuals §5 |
| **Deploy loop** | The single interaction verb: pick → preview → confirm/cancel. | visuals §8 |
| **Shape class** | Silhouette/atlas category: Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles. | GDD §6 |
| **Damage type** | Kinetic · Fire · Poison · Concussion · Electric · Frost — keys impact FX. | GDD §7 |

---

## 1. Rendering Approach — Layered 2.5D (C11)

### 1.1 Core Principle

BULWARK uses **no full 3D models** (visuals §1). Dimensionality is faked with stacked 2D surfaces sorted back-to-front via the painter's algorithm. Depth reads from three cues working together:

1. **Layer order** — what is drawn over what.
2. **Shadows** — grounding and altitude (§3).
3. **Camera rotation** — parallax between layers (§7).

The entire art budget goes into **layering and light, not polygons** — the vertical slice ships with hand-authored atlases per shape class rather than rigged meshes.

### 1.2 Canonical World Z-Order

Rendered back → front (visuals §1). Layers 2–11 belong to the **rotatable world**; layer 14 is **fixed to the screen** and never rotates.

| # | Layer | Notes |
|---|---|---|
| 1 | Sky / backdrop | Non-rotating backdrop context |
| 2 | Water (surface + sub-surface tint) | Sub-surface tint separates swimmers from floaters (§6.3) |
| 3 | Ground (low / mid / high bands) | Elevation bands from GDD §5 |
| 4 | Ground shadows | Cast by everything above onto terrain (§3) |
| 5 | Grass & bushes | |
| 6 | Trees (with cast shadows) | Occlude units passing "behind" them (§6.1) |
| 7 | **Ground units** | Depth-sorted by ground anchor (§2.2) |
| 8 | Structures | Depth-sorted with ground units by footprint anchor |
| 9 | Projectiles & ground-level FX | |
| 10 | **Air units** + dim altitude shadows | Shadow drawn onto terrain; sprite drawn here (§3.3) |
| 11 | Clouds | Overhead occluder; dims ground, occludes air vision (§6.2) |
| 12 | Muzzle / impact FX, completion flashes | Sits above units (GDD §5) |
| 13 | Fog of war | Continent-level concern (GDD §5) |
| 14 | UI / HUD | Screen space; **never rotates** (visuals §7) |

### 1.3 Depth-Sort Contract

- **Ground units and structures** (layers 7–8) share one sort key: the **ground anchor** (screen-projected Y after rotation). This lets a unit correctly pass in front of or behind a structure as the camera rotates.
- **Air units** (layer 10) always draw above ground occluders but cast a *separated* shadow back onto layer 4, giving altitude read without breaking the fixed z-order.
- **Ties** resolve by unit ID (deterministic) so identical frames sort identically across machines — a precondition for C19 replay fidelity.

---

## 2. Unit Sprite Stack (C12)

Each unit composes **four sub-layers**, drawn bottom → top: **legs/tracks → body → weapon → head/sensors** (visuals §2.1). Layers animate independently so a tank can traverse while its turret tracks a target.

- **Telegraphing rule:** the **head/sensors layer leads** — it swivels to acquire a target *before* the weapon layer commits to firing. This gives the player a readable pre-fire tell without exposing hidden simulation state; the timing is cosmetic and never gates the C6 damage event.
- **Ground anchor (§2.2):** the legs layer defines the anchor point used for depth sorting, keeping the visual "feet on the ground" consistent under rotation.
- **Shape class drives atlas:** the eight shape classes (GDD §6) each map to a dedicated atlas, so silhouette alone communicates unit role at a glance.

---

## 3. Lighting, Shadows & Altitude

- **Grounded shadow (layer 4):** every ground unit/structure casts a contact shadow directly beneath its anchor — the primary "it's really on the terrain" cue.
- **Altitude shadow (§3.3):** air units cast a **dimmed, offset** shadow onto the terrain layer. Offset magnitude reads as altitude; dimming distinguishes it from a grounded shadow.
- **Cloud dimming (§6.2):** clouds passing overhead darken the ground band beneath them, doubling as a soft occluder for air-unit vision.

---

## 4. FX Vocabulary (C15)

- **Impact FX keyed to damage type:** Kinetic · Fire · Poison · Concussion · Electric · Frost each render a distinct hit effect read from the `DamageTypes` table — never hardcoded, so re-tuning balance re-skins impacts automatically.
- **Muzzle/impact/completion flashes** live on layer 12, above all units, so combat legibility never depends on where a unit sits in the depth sort.
- **Gold pie-sweep (§5):** a single universal radial gold-wedge flash confirms *any* "done + paid off" event — build, repair, or upgrade — giving the economy one instantly-recognisable success grammar.

---

## 5. Camera & Controls (C17–C18)

- **Camera (C17):** the world (layers 2–11) rotates and parallaxes; the HUD (layer 14) is pinned to screen space and never rotates (visuals §7).
- **Deploy loop (C18):** the sole interaction verb is **pick → preview → confirm/cancel** (visuals §8). C18 is the only surface allowed to originate input, keeping the firewall intact.

---

## Key Takeaways & Recommendations

1. **Firewall is architecture, not convention.** Enforce read-only access at the type/interface level so C12–C17 *cannot* mutate C6 state; validate via C19 replay determinism in CI.
2. **One sort key for ground layers.** Anchor ground units and structures to the same screen-projected Y and tie-break on unit ID to guarantee cross-machine sort parity.
3. **Data-drive every balance-keyed visual.** Impact FX, telegraph timing, and altitude offsets should resolve from `bulwark-balance.xlsx` / `DamageTypes` so balance changes never require art or code edits.
4. **Protect legibility with fixed FX layers.** Keep muzzle/impact/completion flashes on layer 12 and the HUD on layer 14 so combat and economy feedback stay readable regardless of camera rotation or depth sort.
5. **Ship the slice on atlases, not meshes.** Concentrate the art budget on layered sprites and lighting; defer any true-3D work until after the vertical slice proves the presentation contract gradeable (GDD §19; visuals §10).

---

*Generated by MetaMax Research Brain (LangGraph)*