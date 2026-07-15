# Bulwark — Voxel Rendering Tiers (Air Units & Bulk Optimization)

**Version:** 1.0
**Scope:** How each unit and projectile is rendered. Defines when a baked voxel sprite
is used vs. a live 3D voxel model, and the hard constraints that keep a 50–100 unit
scene inside frame budget.
**Audience:** implementation (CLI). This is a spec, not a discussion — every rule here
is meant to be actionable, and §7 is the checklist to verify against.

---

## 1. The Problem

The baked voxel system pre-renders each unit from a fixed set of angles. That is the
correct default and must remain the default: baked sprites **batch** into few draw
calls, which is the only way a tower-defense scene of **50–100 simultaneous units plus
hundreds of projectiles** holds frame rate.

Baking breaks down only for units that exercise **multiple continuous rotational
degrees of freedom** — pitch and roll in addition to yaw. Baking those requires a
combinatorial frame explosion (e.g. 32 yaw × 8 pitch × 8 roll ≈ 2,048 frames per unit)
and still looks stepped on a fast banking turn.

The resolution is **not** "air renders in 3D, ground renders baked." It is a
three-tier rule keyed on **how many rotational degrees of freedom a unit actually
exercises**, plus a hard cap that prevents the expensive tier from ever scaling with
unit count.

---

## 2. The Decision Rule (apply per unit type)

Assign every unit type to exactly one tier:

1. **How many rotational DOF does it exercise on screen?**
   - Yaw only (faces a direction, stays level) → **Tier A (baked)**.
   - Yaw + a mild, silhouette-preserving tilt → **Tier B (baked + sprite tilt)**.
   - Continuous pitch/roll where the banking *is* the visual read → candidate for
     **Tier C (live 3D)**.

2. **Does it ever appear in bulk?** (More than the §5 cap on screen at once.)
   - Yes → it **cannot** be Tier C. Force it to Tier A or B, regardless of DOF.
   - No → Tier C is permitted.

**Bulk always wins over DOF.** A unit that both banks hard *and* spawns in tens is
Tier B, not Tier C. The cap is not negotiable against visual preference.

---

## 3. The Tiers

### Tier A — Baked, Batched (the default)
Pre-rendered yaw-only sprites. Batches into few draw calls. **This is everything
unless a unit earns its way out.**
- All ground units.
- All projectiles (see §4).
- Flat, level flyers (high bombers that only translate, recon that holds altitude).
- Bombs / dropped ordnance (see §4).

### Tier B — Baked + Sprite-Transform Tilt
Baked body, tilt applied as a **screen-space 2D transform on the sprite** — a matrix
multiply, **not** a re-render and **not** an extra draw call. Stays inside the batched
path.
- Mild bankers: drones and light air that lean into turns but whose *silhouette*
  barely changes under the lean.
- Use this aggressively. It is the primary tool for "3D feel" at scale, because it
  delivers the tilt read without spending draw calls. Prefer Tier B over Tier C
  whenever the silhouette change is small enough to fake.

### Tier C — Live 3D Voxel Model (rare, counted)
A true rotating voxel model with real pitch/roll. Each instance is its **own draw
call** and does **not** batch. Permitted **only** for units that are simultaneously:
- **Sparse** — at or below the §5 cap on screen, by design; and
- **Large** — big enough that the tilt/bank actually reads; and
- **Set-piece** — a rare, expensive, event-tier unit whose design weight justifies
  the render weight.
- Examples: **heavy bomber**; a possible boss-tier air unit. These are counted on one
  hand, by design.

---

## 4. Projectiles (the real bulk risk)

At 50–100 units, projectiles number in the hundreds and are the likeliest cause of a
frame-time cliff — *not* the air units.

- **Never a voxel object.** Billboard quad or a baked 2–4 frame sprite, spun in screen
  space. A projectile has no orientation the player reads beyond travel direction.
- **Must batch into a single draw call** (instanced / pooled mesh). Per-projectile
  draw calls are the failure mode.
- **Must be pooled.** No per-frame allocation. At these volumes, spawn/GC churn is a
  bigger spike than any render cost.

**Bombs** read through **arc + scale-down + a growing ground shadow**, not mesh
orientation. Bake 2–3 frames; sell the drop with trajectory and scale. Never a live
voxel bomb.

---

## 5. The Sparsity Cap (hard constraint — do not remove)

> **A Tier C (live 3D) unit type may never spawn such that more than `MAX_LIVE_3D`
> instances are visible on screen at once. Recommended `MAX_LIVE_3D = 4`.**

This is the rule that keeps the whole optimization from being quietly undone later.
The live path is safe **only** because it never scales with unit count. If a future
unit — or an automated change following the existing bomber pattern — reuses the Tier C
path for something that spawns in bulk, the draw-call cliff returns and the reason is
no longer obvious in the code.

Enforcement requirements:
- Spawn logic must treat `MAX_LIVE_3D` as a hard ceiling for any Tier C type, clamping
  or queuing rather than exceeding it.
- The unit-definition schema must carry an explicit `render_tier` field (`A` | `B` |
  `C`). A type marked `C` must fail validation if its max simultaneous spawn count
  (across all waves in `Bulwark-Map-Data.xlsx`) can exceed `MAX_LIVE_3D`.
- That validation should run in CI / at data-load, not just at runtime.

---

## 6. The Seam (visual correctness for Tier C)

A live 3D unit shares the screen with baked sprites and must not read as pasted-on.
A large, slow set-piece is the **most scrutinized** thing in the scene, so this is
where a mismatch shows worst.

Tier C models must match the baked pipeline on:
- **Lighting model** — same light direction, same shading ramp.
- **Palette** — identical color tokens; no separately-tuned materials.
- **Outline / edge treatment** — same outline width and behavior as sprites.
- **Depth / sort** — composited correctly against the 2.5D plane. Air units mostly
  float above the fray, which avoids the worst cases, but passing *behind* a tall
  structure must still resolve correctly.

Lock this shared look while there is only one Tier C unit (the bomber) to reconcile —
not after a second is added.

---

## 7. Acceptance Criteria (verify against these)

- [ ] Unit-definition schema has a `render_tier` field (`A` | `B` | `C`); every unit
      type sets it explicitly.
- [ ] Default is Tier A. A unit is Tier B/C only by explicit assignment.
- [ ] All projectiles are Tier A, batch into a single draw call, and are pooled (zero
      per-frame allocation in the projectile path).
- [ ] Bombs are baked (2–3 frames) and rendered via arc + scale + shadow, not a live
      model.
- [ ] Tier B tilt is a screen-space sprite transform that stays inside the sprite
      batch (no added draw call, no re-render).
- [ ] Tier C is used only by units flagged sparse; the heavy bomber is Tier C.
- [ ] `MAX_LIVE_3D` is enforced as a hard spawn ceiling for Tier C types.
- [ ] Data validation fails if any Tier C type's max simultaneous count (from the wave
      data) can exceed `MAX_LIVE_3D`.
- [ ] Tier C models match baked sprites on lighting, palette, and outline (§6).
- [ ] **Profiling gate:** on min-spec hardware, at the worst-case wave (max
      simultaneous air units *and* peak projectile density at once), measure **draw
      calls, not unit count**. Baked ground + projectiles must hold to a small,
      roughly constant number of batched draws; only Tier C instances add draws, and
      they are ≤ `MAX_LIVE_3D`. If draw calls climb roughly linearly with unit count,
      something that should batch is not — fix that before any air-unit tilt work.

---

## 8. One-Line Summary for the Changelog

> Rendering is baked-and-batched by default (Tier A); mild air tilt is faked with a
> screen-space sprite transform (Tier B); true live 3D voxel rendering (Tier C) is
> reserved for sparse, large set-piece air units (heavy bomber) and hard-capped at
> `MAX_LIVE_3D` on screen so it never scales with unit count.

---

## Implementation map (this repo, prototype/test-game)

| Spec item | Where |
|---|---|
| `render_tier` schema (explicit, all 85 types) | `src/data/tables.js` (UNITS rows) |
| `MAX_LIVE_3D`, tier validation | `src/data/renderTiers.js` |
| Data-load gate (throws on violation) | `src/data/tables.js` bottom |
| CI gate | `src/data/renderTiers.test.mjs` (node --test, deploy workflow) |
| Spawn ceiling (queue, never exceed) | `src/sim/waves.js` stepWaves |
| Tier C excluded from bulk wave rosters | `src/data/tables.js` `_buildWaves` |
| Pooled batched projectiles | `src/render/projectiles.js` (+ renderer fire/updateFx) |
| Bomb read (arc + scale + shadow) | renderer `shell` FX (already compliant) |
| Tier B tilt (rotation + skew, batched) | renderer voxel unit branch |
| Tier C live 3D renderer (§6 seam-matched) | `src/render/voxel/live3d.js` |
| Tier C model data in the unit pack | Stack Forge "Embed model" → `pack.model` |
| The Tier C set-piece | `AIR-HeavyBomber` in `src/data/tables.js` |
