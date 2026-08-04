# BULWARK MM — Visual Style Guide

*The single authoritative visual reference for BULWARK MM. This guide reconciles the existing Style Guide, the UX interaction flows, the Visual Design System, the Component Specification, and the 36 recorded flat-design art assets into one buildable, enforceable visual language. Where earlier documents conflicted, this guide resolves the conflict and states the ruling; where they left gaps, it fills them by inference from the consistent flat-design language of the shipped assets.*

**Governing precedence:** GDD/systems specs win on *behavior*; the balance workbook wins on *numbers*; **this document wins on *appearance and layout*.** When a rule here disagrees with an older doc, this guide is the reconciliation — update upstream once, then never re-decide.

---

## 1. Cover — Title Treatment & Package Shot

### 1.1 Logotype — "BULWARK"

The wordmark is the primary identifier and must render identically everywhere it appears.

- **Construction:** All-caps, single word **BULWARK**, drawn as a flat, heavy, blocky slab — a wall of letters. The logotype *is* the bulwark: solid, uniform stroke weight, minimal internal negative space, no seriffs, squared or lightly-chamfered terminals.
- **Weight:** Black / Heavy (see §6, Display face).
- **Fill:** Flat solid **Powder Gold** `#D9A441` on dark; flat **Ink** `#1C2230` on light. No gradients inside letters — flat only.
- **Edge:** Optional single hard drop-shadow at **+2px / +4px** offset in **Ink** for the dark package shot; never a soft glow, never a bevel.
- **Sub-brand "MM":** Set in the Display face at **~45% of the logotype cap-height**, tracked +40, positioned baseline-aligned to the lower-right of the K, in **Steel** `#8A97A8`. "MM" never touches or overlaps the primary wordmark.
- **Clear space:** Minimum clear space on all sides = one cap-height of the logotype. Nothing enters this zone.
- **Minimum size:** 120px wide on screen; below this, drop "MM" and render "BULWARK" only.

### 1.2 Hero Key Art / Package Shot

The selling image must communicate the game in one glance: *layered 2.5D asymmetric-faction warfare, flat and readable.*

- **Composition:** A rotated battlefield diorama at the canonical camera angle (§4), reading back-to-front through the full z-stack — sky, water, banded ground, trees casting shadows, and a mid-ground clash between **two contrasting factions** (recommend **Ground/Powder** vs. **Arcane/Energy** for maximum palette and FX contrast).
- **Focal beat:** One unit mid-telegraph — head/sensor swung to target, weapon winding up, a signature muzzle flash keyed to its damage color (§5). This single frame demonstrates the game's core readability law on the cover.
- **Style:** Flat design throughout — no rendered 3D, no photoreal textures, no painterly gradients. Depth comes exclusively from layer order + hard shadows + camera rotation.
- **Logotype placement:** Lower-third or upper-left, over the darkest band of the composition, inside its clear-space zone.
- **Do not:** crowd the hero shot with more than two factions; add lens flares, bloom, or realistic smoke; tilt the logotype.

---

## 2. Art Direction & Visual Language

### 2.1 North Star

**"Simple front, deep back."** Every surface reads instantly; every system rewards attention. Flat, legible art sits over systems the player discovers slowly.

### 2.2 The Look — Flat Design, Layered 2.5D

All 36 shipped assets are **flat design**, and this is the ruling house style. Reconciliation of the older "2.5D / fake-3D" language with the flat assets:

> **Ruling:** BULWARK MM is **flat-design 2.5D** — every individual sprite and surface is rendered *flat* (solid fills, hard-edged shading, no gradient rendering inside a shape), and *dimensionality is achieved only by compositing flat layers* via the painter's algorithm plus hard shadows plus camera rotation. Flatness lives at the *sprite* level; depth lives at the *scene* level. These do not conflict — they are the two halves of the same rule.

Three non-negotiables:

1. **Readable combat** — sensors lead, weapon follows. If a player can't tell who is about to shoot whom, the style has failed. This is the single most testable rule in the game.
2. **Fake 3D, honest layering** — depth comes from layer order, shadows, and rotation; never from polygons or gradients.
3. **One signal, learned once** — the gold pie-sweep means "done + paid off," everywhere, always. Never overloaded.

### 2.3 Shading Model

- **Flat cel shading:** each sprite uses at most **three tones per material** — a base fill, one darker shade (`-15% lightness`), one lighter highlight (`+12% lightness`). Hard boundaries between tones; no dithering, no soft airbrush.
- **Shadows are separate flat shapes**, not gradients — a single semi-transparent Ink shape on layer 4 (§7).
- **No outlines by default.** Silhouette separation comes from value contrast against the ground band and from cast shadow, not from a stroke. Exception: UI iconography may carry a 2px Ink stroke (§8).

### 2.4 Canonical Z-Order (never reorder)

Back → front:

| # | Layer | Space |
|---|---|---|
| 1 | Sky / backdrop | fixed backdrop |
| 2 | Water (surface + sub-surface tint) | world |
| 3 | Ground (low / mid / high bands) | world |
| 4 | Ground shadows | world |
| 5 | Grass & bushes | world |
| 6 | Trees (+ cast shadows) | world |
| 7 | **Ground units** | world |
| 8 | Structures | world |
| 9 | Projectiles & ground FX | world |
| 10 | **Air units** (+ dim altitude shadow onto L4) | world |
| 11 | Clouds | world |
| 12 | Muzzle / impact FX, completion flashes | world |
| 13 | Fog of war | world |
| 14 | **UI / HUD** | **screen space — never rotates** |

Layers 2–11 rotate with the camera. A frame that relies on only one depth cue is under-styled — **layer order + shadows + rotation must all three be present.**

---

## 3. Characters & Props — The Cast (Primary Section)

*This is the most important section. Units and structures are what the player watches, learns, and remembers. Color and type exist to serve them.*

### 3.1 The Four-Layer Unit Stack

Every unit is **four independently-animated flat sprites**, bottom → top:

| Layer | Role | Construction mandate |
|---|---|---|
| **1. Legs / locomotion** | moving base; anchor point | Reads unit **mass** — Heavy Tanks kick up more dirt than Troops. Air units swap legs for a rotor/thrust layer. **Defines the ground anchor** used for depth sort. |
| **2. Body** | chassis / torso | Carries the **faction palette** (§5) and the **armor-class read** (Organic / Machinery / Aircraft / Energy). The largest flat-color area of the unit. |
| **3. Weapon** | rotates independently | The **primary readability cue** — points at the current target, plays the muzzle flash. |
| **4. Head / sensors** | telegraphs attention | Turns toward the target being *acquired* before the weapon commits. |

Layers animate independently: a tank traverses while its turret tracks.

### 3.2 The Telegraphing Rule (enforce strictly)

**Sensors lead, weapon follows.**

1. Head/sensor swings to target first (acquisition).
2. Weapon rotates and plays a **lock-on wind-up** whose duration **equals the unit's time-to-fire** — the wind-up is a truthful countdown, not decoration. Timing is read from `bulwark-balance.xlsx`; it is cosmetic and never gates the C6 damage event.
3. Only after lock does the projectile launch.

**Test:** intent — who's about to shoot whom, how soon — must read from the **top two layers alone** (body and legs hidden).

### 3.3 Silhouette Taxonomy — Eight Shape Classes

Each maps to a dedicated atlas; silhouette communicates class independent of faction palette. **Squint test:** at 50% opacity the shape class must still be identifiable.

| Class | Silhouette rule |
|---|---|
| **Troops** | Smallest footprint; upright bipedal mass; head reads clearly above body. |
| **Trucks** | Wheeled, boxy, wide-and-low; no turret dominance. |
| **Tanks** | Tracked base, single dominant turret (weapon layer largest). |
| **Artillery** | Long, high-angle barrel; wide stable base; visually rear-heavy. |
| **Heavy Tanks** | Tanks + visibly greater mass; thickest legs; most dirt kick-up. |
| **Copters** | Rotor disc replaces legs; compact body; casts offset altitude shadow. |
| **Planes** | Swept, elongated wing silhouette; fastest, thinnest body. |
| **Missiles** | Pure projectile silhouette; minimal body, dominant thrust layer. |

### 3.4 Construction Rules (per-unit checklist)

- Built on a **flat cel palette** (§2.3): base + one shade + one highlight per material.
- **Body** carries exactly the faction's locked 3-color core (§5); **no additional hues** except the faction accent used sparingly for trim.
- **Signature-damage color appears only in the FX layer**, never baked into the body.
- **Ground anchor** sits at the visual contact point of the legs layer; the contact shadow (§7) is centered there.
- **Four animation states, always:** Idle · Moving · Attacking · Death. No unit sits in true stillness — Idle carries a subtle breathing/hover loop.
- **Death:** the whole stack collapses; no unit vanishes without a death state.

### 3.5 Faction Cast — Nine Asymmetric Factions

Identity = **palette + armor theme + silhouette bias**, never power (power is deliberately even; style communicates *flavor, not advantage*).

| # | Faction | Trope | Visual anchor | Armor | Signature dmg |
|---|---|---|---|---|---|
| 1 | **Ground / Powder** | Nationalistic old empire | Flags, honor, tanky armor | Machinery | Kinetic |
| 2 | **Air** | Manga ace-pilot drama | Fast, fragile air superiority | Aircraft | Kinetic |
| 3 | **High Tech** | Capitalist mega-corp | Precision, shields, long range | Machinery | Electric |
| 4 | **Artillery** | Military siege doctrine | Range & arc, weak up close | Machinery | Concussion |
| 5 | **Water** | Fantasy RPG sea tribes | Swimmers, coastal, durable | Organic | Frost |
| 6 | **Arcane / Energy** | Fantasy theocracy | Energy weapons, no ammo economy | Energy | Fire |
| 7 | **Space Tech** | Sci-Fi federation | Orbital tech, ignores some fog | Machinery | Electric |
| 8 | **Dark Energy** | Cult / movement | DoT, corruption, night-strong | Energy | Poison |
| 9 | **Greenies (Chem)** | Socialist hive collective | Swarms, chem clouds, area denial | Organic | Poison |

**Shared-signature separation by motion (not color):**
- **Electric** — High Tech = *precise straight beams*; Space Tech = *arcing pulses*.
- **Poison** — Dark Energy = *creeping corruption DoT*; Greenies = *pooled chem clouds*.

**Swarm rule (Greenies):** simplest silhouettes, tightest palette, **pooled** chem-cloud FX (one shared cloud, not per-unit particles) — a legibility and performance mandate. Must survive being drawn dozens at once without clutter.

### 3.6 Armor-Class Read (body texture language)

| Armor | Flat-body cue |
|---|---|
| **Machinery** | Panel seams, rivets, hard geometric plating. |
| **Organic** | Rounded segments, chitin/shell curves, no rivets. |
| **Aircraft** | Thin skin, canopy highlight, minimal plating. |
| **Energy** | Emissive core shape reads through a semi-transparent shell; accent-colored inner glow. |

### 3.7 Structures & Key Props

- **Structures** (layer 8) share the ground-unit sort key (footprint anchor) and cast a contact shadow. Built in the same flat cel language and carry the owner's faction core palette.
- **Completion event:** on build / repair / upgrade complete, play the **gold pie-sweep** (§5.3) over the structure. This is the *only* success grammar — one signal, one meaning.
- **Trees, grass, bushes, clouds** are neutral props (§4), never faction-tinted.

---

## 4. Environments & Composition

### 4.1 Terrain Bands

Ground renders in three elevation bands — **low / mid / high** — as flat banded shapes with hard edges between bands. Elevation reads by band value + cast shadow, never by gradient.

### 4.2 Water

Two flat layers: a **surface** tone and a darker **sub-surface tint** beneath it. The sub-surface tint is what separates swimmers (drawn into it) from floaters (drawn on the surface) — a legibility contract, not decoration.

### 4.3 Occlusion & Depth

- **Trees** (layer 6) occlude units passing "behind" them at any rotation angle because ground units re-sort every frame by their ground anchor.
- **Clouds** (layer 11) darken the ground band beneath them and soft-occlude air-unit vision.
- **Air units** always draw above ground occluders but cast a *separated, dimmed, offset* shadow onto layer 4 — offset magnitude = altitude read.

### 4.4 Composition Principles

- Keep the **12 o'clock focal clash** at the diorama's readable center; push neutral terrain and props to edges.
- Never let props obscure a telegraph in the hero or in gameplay-critical framing.
- Neutral environment palette must always sit *lower in value contrast* than any faction unit, so units pop off the ground.

---

## 5. Color Palette

Flat, token-based. All fills are solid — **no gradients** except the deliberate flat-tone triads of §2.3.

### 5.1 Core / Neutral Tokens

| Token | Hex | Usage |
|---|---|---|
| **Ink** | `#1C2230` | Shadows, logotype-on-light, UI text, icon strokes. |
| **Steel** | `#8A97A8` | Neutral machinery, HUD chrome, "MM" sub-brand. |
| **Powder Gold** | `#D9A441` | Logotype-on-dark, the sacred pie-sweep, premium/success accents. |
| **Bone** | `#EDE7D8` | Light UI backgrounds, panel fills. |
| **Terrain Low** | `#6E7A55` | Low ground band. |
| **Terrain Mid** | `#899662` | Mid ground band. |
| **Terrain High** | `#A7B27C` | High ground band. |
| **Water Surface** | `#4E8C9E` | Water surface layer. |
| **Water Sub** | `#2C5566` | Sub-surface tint (swimmers). |

*Terrain and water hexes are inferred to give the flat bands consistent, low-contrast values that let units pop; treat as the default until source art overrides.*

### 5.2 Signature-Damage FX Tokens (FX layer only)

| Damage | Token | Hex |
|---|---|---|
| **Kinetic** | White-Gold | `#F5E6B8` |
| **Electric** | Cyan | `#3FE0F0` |
| **Concussion** | Shock Grey | `#B8BEC6` |
| **Frost** | Pale Blue | `#BFE3F2` |
| **Fire** | Orange | `#F07A22` |
| **Poison** | Sickly Green | `#8FBF3F` |

These read **through the FX layer only** — never on unit bodies. Impact FX resolve from the `DamageTypes` table; re-tuning balance re-skins impacts automatically.

### 5.3 The Gold Pie-Sweep (sacred)

A single universal **radial gold-wedge flash** in **Powder Gold `#D9A441`** confirming *any* "done + paid off" event — build, repair, upgrade. One signal, one meaning, everywhere. **Never** assign it a second meaning; never recolor it.

### 5.4 Faction Palette Discipline

Each faction gets a **locked 3-color core + one accent**. The accent is used only for trim, never for the whole body, and never collides with a signature-damage FX color. *(Exact per-faction cores are an open decision — see §11.)*

---

## 6. Typography & Lettering

*The recorded assets