# Outpost concept art: reference prompts

Every image prompt for the outpost buildings lives here. The models are built in headless Blender from the owner's
concept art (`tools/blender/outposts/`, one script per building). The art they are built from sits in
`tools/blender/outposts/ref/`, beside the scripts. Save new results there too, under the file name each prompt gives.

## Which buildings have art

| Building | Art | Status |
|---|---|---|
| Hub and shuttle | `outpost-concept.jpg` (this folder), `ref/set_outpost_v2*.jpg` | covered |
| Power Station I (drum) | `ref/mv_power.jpg` (4 views) | covered |
| Power Station II (reactor) | `ref/set_power_reactor.jpg` | covered |
| Storage | `ref/mv_storage.jpg` (4 views) | covered |
| Auger Drill rig (iron) | `ref/mv_drill.jpg` (4 views) | covered |
| Deep Bore rig | `ref/mv_drill_bore.jpg`, `ref/mv_drill_bore_b.jpg` (the tilted drill column) | covered |
| Laser Cutter rig (aluminum) | `ref/set_outpost_v2*.jpg` (beam harvester with rovers) | covered |
| Crystal Harvester rig | `ref/set_crystal_refinery.jpg` (crystal tanks) | covered |
| Resource Bay (was Harvester Bay; garage) | `ref/mv_garage.jpg` (4 views), `ref/harvester_bay.jpg` | covered |
| Upgrade Bay | `ref/mv_upgrade_pad.jpg` (4 views), `ref/upgrade_bay.jpg`, `ref/set_research_lab.jpg` | covered |
| Habitat I and II | `ref/set_habitat.jpg` (a set view; no 4-view sheet) | covered; prompt 3 below would sharpen it |
| Defenses (Cannon, Machine Gun) | `ref/set_defense.jpg` | covered |
| Brine Pump rig (lithium) | `ref/mv_brine.jpg` (4 views, from prompt 1) | covered |
| **Shielded Extractor rig (uranium)** | none | **modelled without art** (`rig_shielded.py`, from §8.4 and prompt 2); rebuild when `ref/mv_shielded.jpg` arrives |

## How to run a prompt

Attach **`ref/mv_drill.jpg`** (the drill bunker's 4-view sheet) as the style reference, so the new rig reads as the
same building family. Ask for the same four-view layout: the 4-view sheets were the most useful art to model from.
Save the result as the file name each prompt gives.

Shared style block (repeated in each prompt so each stands alone):

> Same art style, materials and lighting as the attached drill bunker: stylised low-poly hard-surface sci-fi,
> chunky readable shapes, light grey and white chamfered panels over dark grey stepped bases, orange trim plates,
> small cyan-blue glowing panel lights. Show ONE building as a sheet of four views: three-quarter front, straight
> front, three-quarter back, and top-down. Plain soft grey background, no ground plane beyond a little rubble, no
> text.

## 1. Brine Pump: lithium (Verdance, rare). Save as `ref/mv_brine.jpg`

> A mining rig building for a sci-fi outpost: a Brine Pump, from the same building family as the attached drill
> bunker. A light grey chamfered bunker framed by two tall pillars with small cyan lit panels, orange plates on the
> roof edge and a small radar unit on top. In front of the bunker, instead of an ore chute, a pump-jack with a
> rocking beam stands over a round wellhead. Two upright cylindrical tanks flank the bunker, each with tall glass
> windows showing glowing pale cyan-white brine. A row of shallow evaporation trays runs out from the wellhead,
> where the brine dries into white and pale pink lithium salt crystals. Pipes with orange valve wheels connect the
> wellhead, the tanks and the trays. [style block]

## 2. Shielded Extractor: uranium (Lumen, uncommon). Save as `ref/mv_shielded.jpg`

> A mining rig building for a sci-fi outpost: a Shielded Extractor, from the same building family as the attached
> drill bunker. A low armoured dome built into a light grey chamfered bunker, with thick sealed panels and amber
> warning beacons on the roof. A heavy shielded hatch in the front portal where two robotic arms load lead-grey
> canisters with small green glowing windows onto a short rail cart. Radiation trefoil signs as simple shapes,
> orange hazard stripes, small cyan panel lights. [style block]

## 3. Habitat I and II: living quarters (owner, 2026-11-07; story O15). Save as `ref/mv_habitat.jpg`

> A living-quarters building for a sci-fi outpost, from the same building family as the attached drill bunker, shown
> as two tiers side by side. Tier I: an octagonal chamfered block of light grey and white panels on a two-step
> octagonal pad with a dark deck and orange edge lines, two stepped ramps down at the front, arched doorways on the
> front faces with warm amber-lit windows, a stepped roof with a round vent ringed in orange. Tier II: the same base
> with added modules: a ribbed white dome over the block with a ring of cyan portholes and a small comm spire, and
> two round capsule pods with warm windows joined to its sides by short corridors. [style block]
