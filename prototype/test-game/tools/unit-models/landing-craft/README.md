# Landing craft — 10 part-list models (3 × 3 cells)

**Owner request (2026-10-16):** landing craft for Bulwark that occupy a 9-cell 3 × 3 space, fly into the map and
land, then deploy resource harvesters to gather materials. The centre top carries a defense weapon — shield,
mortar, cannon, anti-aircraft missiles, anti-troop gun or rocket launcher. Ten variations: a beginner neutral craft
plus one per faction. Detailed 3D models. Reference: the owner's "Landing Craft Modular Grid" sheet and seven
Bulwark Stellar 7 concept renders (the BS7-LC "Ironhoard", T3 Hauler Shuttle, BS-7 Merchant).

Status: **prototype models + review page.** Not yet the game's runtime source (see §6, Port).

| file | what |
|---|---|
| `models.js` | the 10 crafts as part lists + the shared kit (gear, hatches, engines, 6 weapons, 5 heads). Classic script; global `LANDING_CRAFT`. |
| `viewer.html` | review page source: orbit, battle camera, ortho 4-up, four looks, far LOD, and the fly-in → land → deploy sequence |
| `build.py` | `python build.py` → `dist/landing-craft.html` (one file; open in any browser). `--offline` also inlines three.js. |
| `sheet.png` | contact sheet of all ten |

Built on `../next/prims.js` (the three-part base / weapon / head builder) and `../next/models.js` (SYS-Harvester rolls
out of the hatches in the sequence).

---

## 1. The ten crafts

| # | key | craft | faction (homeworld) | roof weapon | head | look |
|---|---|---|---|---|---|---|
| 0 | `lc_neutral` | **BS-7 Pathfinder** | Neutral / System — beginner | cannon | radar dish (spins) | the reference sheet: ceramic white, orange + black diagonal livery, blue engine cluster |
| 1 | `lc_ground` | **Ironhoard Casemate** | Ground / Powder (Verdance) | anti-troop gun — twin rotary guns behind a raked shield | optic (sweeps) | olive slab armour, rivet lines, brass trim, oxblood banners, bunker cupolas, exhaust stacks |
| 2 | `lc_air` | **Skylark Carrier** | Air (Florael) | anti-aircraft missiles — twin 4-cell pods | bar radar (spins) | white, sky blue, racing red; long bubble canopy, streamlined nacelle pods, swept fins, canted tail fins |
| 3 | `lc_hightech` | **Sterling Vault** | High Tech (Ochre) | shield — three-prong projector | sensor hoop (spins) | graphite wedge monolith, gold spine and trim, white light-lines, hex pods, corporate diamond |
| 4 | `lc_artillery` | **Siegeworks Emplacement** | Artillery (Kessra) | mortar — four tubes | bar radar (sweeps) | khaki + olive, black/yellow hazard skirts, sandbag roof, ammo crates, splayed stabilizer legs |
| 5 | `lc_water` | **Tideborn Ark** (v3) | Water (Rime) | rocket launcher — harpoon rack | radar dish (sweeps) | ONE nautilus-shell hull over the whole 3 × 3 (pearl growth ribs, keel, fins, coral-crowned blisters), fitted out steampunk: brass-ribbed wheelhouse with a glass bathysphere nose (the cockpit), bow salon window, amber portholes, steam pipes, rivets, gauges, vent cowls, stern drive shrouds |
| 6 | `lc_arcane` | **Sanctum of the Flame** (v2) | Arcane / Energy (Cinder) | shield — halo spire | twin halos + flame orb (spin) | ONE cruciform basilica on an undercroft: nave bow-to-stern, transept gables are the resource portals, crimson hipped aisle roof all round, bonded corner turrets and flying buttresses, crossing tower under the halo spire |
| 7 | `lc_space` | **Lumen Survey Lander** | Space Tech (Lumen) | cannon — twin-rail coil railgun | large survey dish (sweeps) | federation white + navy, cyan ring-lights, capsule hull, drum pods, sensor masts |
| 8 | `lc_dark` | **Hollow Choir** | Dark Energy (Xenthe) | mortar — corruption tubes (glowing mouths) | eye on a stalk (sweeps) | obsidian + violet, magenta seams, spiked ridge and pods |
| 9 | `lc_greenies` | **Brood Hive** | Greenies / Chem (Vexmire) | rocket launcher — spore rockets | spore pod (spins) | swamp green + toxic yellow, segmented organic hull, hex brood pods, glowing chem tanks, compound eyes |

**v2 (2026-10-16, owner):** Tideborn and Sanctum reworked from modules into one unified, sculpted hull each — exact same
footprint, hatch, gear and weapon positions. The other eight keep the modular build.
**v3 (owner):** Tideborn needed a clear cockpit and windows — added the steampunk bridge, portholes and brass fittings (new palette keys `brass`, `amber` interior glow).

Every one of the six requested weapon types is used; four are used twice (cannon, shield, mortar, rocket launcher).
**The weapon is a one-line choice per craft** (`weapon: wMortar(roof)` etc. in `models.js`) — the kit builds any weapon
on any hull, so reassigning is cheap. The assignment above follows each faction's GDD identity (§9): Air owns the
sky → AA; High Tech "precision, shields"; Arcane "energy weapons, shields"; Artillery "range & arc"; Dark Energy
"DoT, corruption" → corruption mortar; Greenies "swarms, chem clouds" → spore rockets; Space "orbital tech" → railgun.

Ground is the tutorial faction, so its craft is the first enemy-built one a player sees after the neutral one.

## 2. Layout — the owner's 3 × 3 sheet

Nose = +X. 4 model units = 1 cell, so the craft fills X, Z ∈ [−6, 6].

```
            −Z (left)            centre               +Z (right)
 front   1 defense pod  ·   2 cockpit           ·  3 defense pod        x  2 .. 6
 middle  4 resource hatch · 5 main hull + WEAPON · 6 resource hatch     x −2 .. 2
 rear    7 pod + engine ·   8 engine block/cargo ·  9 pod + engine      x −6 .. −2
```

- Landing gear sits under the four corner pods; VTOL lift jets glow on the pod bellies.
- The resource hatches are on the left and right faces of the middle row. Each door drops outward into a ramp to
  the ground; the opening (3.3 wide × 3.0 tall) fits SYS-Harvester (≈ 3 wide, 2.7 tall).
- The weapon's bearing is at roof centre (X = 0, Z = 0). Heights: hull roof 3.9–4.8; overall 6.4–7.5 for guns,
  8.9 for the High Tech projector, 10.9 for the Arcane spire (the tallest thing on the field, by design).
- Barrels overhang the nose to X ≈ 6.4 when facing forward; everything else stays inside ±6.2.

## 3. Landing sequence (as built in the viewer)

| t (s) | phase | what moves |
|---|---|---|
| 0 – 4.2 | **Approach** | flies in nose-first from 70 units out, 26 up, braking with a nose-up flare; gear stowed; rear engines full, lift jets spooling |
| 4.2 – 7.4 | **Descent · gear down** | vertical descent from 8 units on the lift jets; gear extends 5.2 – 6.8 s; slight roll wobble; touchdown dust ring |
| 7.4 – 8.4 | **Touchdown** | small settle bounce; lift jets cut |
| 8.4 – 9.8 | **Hatches open** | both doors rotate 108° outward about the sill into ramps; shield crafts raise their dome |
| 9.8 – 14.6 | **Harvesters deploy** | one SYS-Harvester per hatch drives out, pitches down the ramp, and heads off along ±Z |
| 14.6 – 16.5 | **Collecting** | hold |

The ramp angle is derived, not hand-set: `open = 180° − acos((sill − 0.06) / doorHeight)` so the door tip lands on
the ground (sill 1.0, door 3.0 → 108°, an 18° ramp).

Game-side timing is the game's call; this is the reference choreography. Suggested sim hooks: the craft is the
level's **base** (the sim's 3 × 3 `worldBase` already reserves ring slots around a 3 × 3 base), the landing plays
before wave 1 as presentation only, and harvesters spawn at the ramp feet — Z = ±9 units, i.e. 2.25 cells either
side of the base centre, just outside the footprint.

## 4. Model contract

Same schema as `../next/models.js`: parts are `box / cyl / ext / loft / ell`, one material key each, `mir: true` mirrors
in Z, `d: 1` marks detail the far LOD drops. Authored pose is **landed, gear down, doors closed** — an engine that
ignores the new groups still draws a correct parked craft.

Each def carries:

```js
{ key, name, faction, factionName, weaponType, unit,      // unit = proposed roster id, e.g. 'GND-LandingCraft'
  footprint: [3, 3],
  palette: { hull, hull2, panel, dark, black, metal, glass, accent, stripe, trim, glow, glowE, ... },   // per craft
  parts: [...],
  pivots: { weapon: [0, roofY, 0], head: [...], gear: [0, 0, 0], doorR: [0, 1, 6.075], doorL: [0, 1, -6.075] },
  head: { mode: 'spin' | 'sweep', speed? },
  anim: { gear: { axis: 'y', retract: 1.15 },              // stowed = +1.15 Y (flight), 0 = landed
          doorR: { axis: 'x', open: 108 }, doorL: { axis: 'x', open: -108 } } }
```

**Groups.** `base`, `weapon` (yaws), `head` (rides on the weapon) — the three the engine already knows — plus three
new ones, all children of `base`: `gear` (translates), `doorR` and `doorL` (rotate about X at the sill hinge).

**Material keys.** The unit set (`hull hull2 panel dark black metal glass glow glowB amber glowR`) plus four:
`accent`, `stripe`, `trim` (faction livery) and `glowE` (engine light — scaled by thrust, see §6). Metal /
roughness for the new keys: accent 0.35 / 0.45, stripe 0.15 / 0.6, trim 0.4 / 0.45; `glowE` is unlit like every
`glow*` key.

**Palette per craft, not global.** Units share one colour table; crafts can't (ten liveries over the same keys).
The viewer resolves colours from `def.palette`.

## 5. Budget

One instance per level, so cost is small. Draw calls = material keys × groups (≈ 30–45 per craft before merging).

| craft | tris | far LOD | | craft | tris | far LOD |
|---|---|---|---|---|---|---|
| Pathfinder | 3,360 | 2,348 | | Tideborn Ark | 7,028 | 3,404 |
| Ironhoard | 5,904 | 2,948 | | Sanctum | 3,884 | 3,160 |
| Skylark | 3,768 | 2,780 | | Lumen | 4,416 | 2,628 |
| Sterling Vault | 2,838 | 2,158 | | Hollow Choir | 3,692 | 2,892 |
| Siegeworks | 3,764 | 2,844 | | Brood Hive | 4,680 | 3,872 |

(2026-10-16: Tideborn Ark v3 10,500 tris — v2 was 5,536; Sanctum 4,808 / LOD 3,876. Rows above for those two are v1.)

## 6. Port to the game (work for the repo session)

1. **Per-model palette.** `models3d.js` colours vertices from the global `UNIT_COLORS`. Either namespace the craft
   keys at merge time (`hull` → `hull@lc_ground`, with `isGlowKey` and `metalFor` stripping the suffix), or let a
   def's `palette` override `UNIT_COLORS` for that model. The second is simpler and also answers Q17 (metal per
   faction) for free.
2. **Three new groups.** `gear` (translate Y) and `doorR` / `doorL` (rotate X about their pivots). Same mechanism as
   `weapon` / `head`; parent = base (prims' default for an unknown group).
3. **Engine glow.** `glowE` vertices need a per-instance intensity (one float), driven by the landing state. The
   viewer's plume cones are a stand-in for the FX batches (§6.10 of the tech plan) — lift-jet and rear-nozzle
   positions are recoverable from the `glowE` parts (vertical cyl = lift jet, `ax: 'x'` = rear nozzle).
4. **Model mapping.** The base is drawn by the craft of the player's faction; `lc_neutral` before a faction is chosen
   and for the System base. Add the ten `*-LandingCraft` ids to the roster, or map from the faction key directly.
5. **Shield dome** is an effect (translucent additive hemisphere, radius ≈ 10.5 units), not geometry.
6. **Harvester spawn** at the ramp feet (§3); the sim already owns `spawnHarvester`.

## 7. Open — owner decisions

- **Weapon per faction** (§1) — confirm or reassign; it is one line per craft.
- **Does the roof weapon replace the base super-cannon** in the sim, so the six types get real behaviour (shield
  absorbs, mortar arcs, AA targets air only, anti-troop vs organics)? Today the base has one cannon.
- **Approach direction** — nose-first from the map's west edge in the viewer; the game could fly in from the side
  opposite the first wave's spawns.
- **Harvesters per craft** — two (one per hatch) as built; the harvester upgrade ladder may want one hatch to open
  first.
- **Roster ids** (`SYS-LandingCraft`, `GND-LandingCraft`, …) are proposals.
- Names and blurbs are placeholders until approved.
