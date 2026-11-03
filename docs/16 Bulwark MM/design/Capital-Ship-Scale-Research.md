# Capital ships: reading at scale — research and fix plan

[MM-story_mw01g62z_3] · 2026-11-02 · Four parallel investigations: industry pipelines, texturing, real-time rendering,
perception and geometry. All findings were checked against our code (`tools/blender/ships/`, `src/render3d/ships/`,
`tools/ships/viewer.html`) and the vendored three.js r128.

## The problem

The owner's read of the real-time viewer: *"the bump map appears to look like smooth gouges."* The hull panelling
reads as soft, shallow grooves in a uniform grid — a tiled wall — not as the plating of a 550 m ship.

## Root cause — three layers stacked

### 1. The panel texture is authored as gouges (`detail_tex.py`)

Measured from `tex/panel_normal.png` and the generator:

- **Every seam is a symmetric rounded trench.** Height goes plate 1.0 → 0.55 rim → 0 floor → 0.55 → 1.0; `wrap_blur(h,1)`
  turns the steps into ramps and central differences (k = 2.2) spread them further. A cross-section of the normal's X
  across one seam reads `0.29 0.69 0.80 0.72 0.35 | -0.36 -0.73 -0.81 -0.71 -0.30`: five pixels down, five back up, a
  mirror image, walls peaking near 54°, no flat floor, no lip, no hard corner. That is a gouge ≈ 10 px ≈ 0.73 m wide.
- **Plates never step against each other.** The ±0.12 plate-height jitter is hidden because every plate is moated down
  to 0; there are no lap joints, so every plate reads as the same raised tile.
- **The cavity map only darkens, and softly.** `wrap_blur(h,4) − h` paints a ~9 px dark halo around each seam — it reads
  as occlusion in a dent, not a panel line. Nothing brightens plate edges, which is the cue for machined metal.
- **One frequency, evenly spread.** Fixed 256 × 128 px bays (≈ 19 × 9 m) always split the same way give 2–19 m plates on
  every surface; 38 % of texels tilt more than 5°, so it is busy everywhere with no rest areas; the bay lattice shows as
  regular bands; the 75 m tile repeats ≈ 7× along a hull. No macro layer (50–150 m sections) and no micro layer.

### 2. Filtering erases the seams at play distance

In the hero view a 550 m hull spans ≈ 700–1,000 px, so one screen pixel covers 6–10 texels (mip 2.5–3.3). Because the
two walls of each seam mirror each other, mipmapping averages them into a flat, shortened normal (min length 0.99 /
0.79 / 0.75 / 0.67 at mips 0–3; 95th-percentile slope 0.80 → 0.69 → 0.40 at mips 0, 2, 3). three.js re-normalises it,
the seam drops out of the lighting, and all that is left is a soft grey line — while at mips 1–2 the 50–60° walls
sparkle as the camera moves. Nothing turns that lost normal detail into roughness (no Toksvig / specular AA).

### 3. The render chain flattens what is left (`tools/ships/viewer.html`)

- **Tone mapping is applied twice** (verified in vendored r128): materials apply `toneMapping` even when rendering into
  a render target (`three.module.js` ≈ line 17590 has no render-target check), and `UnrealBloomPass` copies to screen
  through a default `MeshBasicMaterial` with `toneMapped: true`, so ACES runs again. Highlights cap ≈ 0.86, darks crush.
- **The composer target is 8-bit linear with no MSAA**: darks band, HDR is lost before bloom, and with bloom on the hull
  gets no anti-aliasing at all (renderer `antialias` only affects the default framebuffer).
- **Lighting is flat for relief**: key from below/in front, rim nearly as strong as the key, no environment map — so the
  per-plate roughness/metal variation (0.38–0.72) has nothing to reflect, and r128's built-in specular AA ignores the
  normal map.
- Smaller: box projection flips axes on 45° chamfers (√2 stretch, seams break at every chamfer edge); bloom threshold
  0.88 on tone-mapped values lets lit hull bloom.

The double tone map, 8-bit target and missing MSAA apply to **any** game scene that uses `EffectComposer` +
`UnrealBloomPass` in r128 — not only the ship viewer.

## What the industry does

- **Star Citizen** — plain tiling metal (~512 px/m) with horizontal/vertical trims; split lines, access panels, vents,
  markings and lights placed on top as **decals** (POM). Panel lines are a deliberate layer, not baked into the repeat.
  ([80.lv, Matthew Johns](https://80.lv/articles/secrets-of-industrial-design-in-games))
- **EVE Online** — unique per-hull layouts with packed maps; large-scale variation from an artist-controlled **dirt map**
  and material masks added in V5++. ([V5++](https://www.eveonline.com/article/the-many-additions-of-v5plusplus),
  [Scorpion](https://www.eveonline.com/news/view/art-blog-improvement-of-textures-and-a-new-scorpion-model))
- **Homeworld (Relic)** — separate **black and white panel-line layers**: a dark line paired with a light line so a seam
  reads as an edge, not a groove. ([HW texture doc](https://github.com/aheadley/homeworld/wiki/texture_mapping))
- **Stellaris** — a viewport is the *same size on a battleship and a corvette*: consistent known-size details are how the
  eye judges size. ([Dev diary 230](https://devtrackers.gg/stellaris/p/aee7b7b4-stellaris-dev-diary-230-the-art-of-aquatics-ships-the-drake))
- **ILM (Rogue One Star Destroyer)** — silhouette from the 3-ft model, surface detail and lighting layout from the 8-ft
  model; a scanned kit-part greeble library. ([ASC](https://theasc.com/articles/john-knoll-on-rogue-ones-visual-effects-part-2),
  [99% Invisible](https://99percentinvisible.org/article/interstellar-illusions-greebles-lend-large-sci-fi-structures-a-sense-of-scale/))
- **Detail hierarchy** — three tiers of volume, detail clustered at joints and recesses, calm rest areas ("it's not
  everywhere, it is deliberately put"); small lights, scaffolding and colour-coded zones sell a 600 m carrier.
  ([Moth analysis](https://acapulco.artstation.com/blog/z6Br/design-analysis-moth-by-john-liberto),
  [OSN Provincial](https://www.blendernation.com/2020/03/30/behind-the-scenes-space-carrier-osn-provincial/))
- **Normal-map craft** — blend detail normals with UDN (5 ALU) / Whiteout / RNM (8 ALU)
  ([Blending in Detail](https://blog.selfshadow.com/publications/blending-in-detail)); convert mip-averaged normal length
  to roughness ([Toksvig](https://developer.download.nvidia.com/whitepapers/2006/Mipmapping_Normal_Maps.pdf),
  [Kaplanyan GDC16](https://developer.download.nvidia.com/gameworks/events/GDC2016/akaplanyan_specular_aa.pdf),
  [Rock-Solid Shading](https://www.selfshadow.com/talks/rock_solid_shading_v1.pdf)).
- **Perception** — familiar size dominates when depth cues are weak ([PMC8479574](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8479574/));
  aerial perspective (contrast and saturation falloff) reads as distance
  ([Eclectic Light](https://eclecticlight.co/2015/04/23/making-space-4-aerial-perspective/)); long lenses and slow
  motion read as huge, tilt-shift blur and fast spin read as miniature
  ([BlenderArtists](https://blenderartists.org/t/question-on-how-to-effectively-convey-scale-in-space/1463398/1)).
- **Bloom in three.js** — half-float target, threshold ≥ 1, glow above 1 with `toneMapped: false`
  ([forum](https://discourse.threejs.org/t/effectcomposer-unrealbloompass-is-ruining-my-whole-render-thing/45253/2),
  [banding](https://discourse.threejs.org/t/subtle-colour-banding-issue-looks-like-256-colours-when-using-bloom-with-effect-composer/31174)).

Sources that could not be read (Polycount was blocked; Homeworld 3, Idris/Javelin, Elite and X4 pages had no texturing
detail) are not cited.

## Where the researchers disagreed

**Seam width.** Texturing and industry research say seams should be crisp 1–2 px lines; real-time research says widen
them to 8–10 texels so they survive mip 3. Both are right at different tiers: **major seams** (bay and hull-section
level) must be wide enough to survive the play-distance mip — as *asymmetric steps*, which do not cancel when averaged —
while **minor seams** stay 1–2 px and live mostly in the cavity/edge-highlight colour, which mips keep, and fade out
with distance. Hierarchy resolves the conflict.

## Fix plan — ranked by impact ÷ effort

| # | Change | Where | Cost on mobile | Effort |
|---|---|---|---|---|
| 1 | **Fix the render chain**: half-float composer target; `bloom.basic.toneMapped = false` (one tone map); MSAA target (`WebGLMultisampleRenderTarget`, 4×) on WebGL2; bloom threshold 1.0, strength ≈ 0.4, glow colours > 1. Apply to every game scene using bloom. | viewer.html, game composers | ≈ 0 (MSAA resolves cheaply on tilers) | ½ day |
| 2 | **Light for relief**: key skimming the broadside 65–80° from above, ≥ 8:1 key-to-fill, rim behind only; a one-time PMREM env map baked from a dark sphere + sun card + cool band (`envMapIntensity` ≈ 0.6). | viewer.html, `prepareShip` | a few texture reads | ½ day |
| 3 | **Re-author the panel texture**: generate at 4× (4096²) and box-down normals; no height blur; quantised plate levels {0.8, 1.0, 1.2} so seams are **lap-joint steps**; two seam tiers (major: asymmetric step ≈ 6–8 px with a lit lip and dark line; minor: 1–2 px); edge-highlight (convex rim) term in the unused R of `panel_rough.png`; thin 1 px cavity line, no halo; random bay sizes (no lattice); ≈ 35 % large blank rest plates; per-plate ±4 % tone. | `detail_tex.py` | 0 | 1 day |
| 4 | **Toksvig in the mip chain**: build mips offline from the 4× source; per mip `rough' = sqrt(rough² + min(2(1−len)/len, 0.25))`; ship explicit mips. Plus **specular AA** in the shader from `dFdx/dFdy(normal)` (Kaplanyan) via `onBeforeCompile`. | `detail_tex.py`, `prepareShip` | ≈ 8 ALU | ½ day |
| 5 | **Panels follow the form**: compute UVs per part in its own frame before the merge (seams start at form edges, no √2 stretch on chamfers), with per-part panel scale (big hull lofts ×2, modules ×1, small parts ×0.5). | `common.py` `_merge` | 0 | ½ day |
| 6 | **Rest vs busy zones + macro tone**: per-part detail weight in vertex-colour alpha (quiet flanks 0.2–0.4, junctions/stern 1.0, ≈ 60/30/10 by area) scaling normal and cavity strength; ±6–10 % tone per hull section and a dark band at loft-station joints. | `common.py`, `prepareShip` shader | 1 mix | ½ day |
| 7 | **Many cheap known-size lights**: glow windows/strips as 2-tri quads (not 12-tri boxes), spent on 150–300 windows in irregular clusters (bridge, habitation, hangars; some rows dark) and blinking nav lights at the extremities. | `common.py` helpers | net fewer tris | ½ day |
| 8 | **Screen-sized edges and structure**: primary chamfers 1.5–2.5 m (0.06–0.10 u), secondary ≈ 1 m; structural ribs at loft-station changes; greeble clusters (3 graded sizes) only in recesses, tower bases and junctions. | `common.py` + ship scripts | +600–1,000 tris (pay with invisible small parts) | 1 day |
| 9 | **Scale cues in the scene**: `FogExp2` haze to the background colour (≈ 8 % near → 25 % far end of the hull; stars and glow `fog:false`); long lens 24–28° for presentation; turntable 0.02–0.03 rad/s; no depth of field. | viewer.html, presentation | 1 mix | ¼ day |
| 10 | **Hull markings** as vertex-coloured inset geometry in the body mesh: hazard chevrons at bays, 20–40 m hull numbers, spine stripe. | `common.py` | 300–1,500 tris | 1 day |
| — | Not now: KTX2/UASTC compression (three 1024² textures ≈ 16 MB GPU — not yet the bottleneck); a coarse second normal sample (UDN) — revisit after #3–#6. | | | |

**Order:** #1 and #2 first (hours, every frame benefits, and they change how everything else should be judged), then
#3 + #4 together (the gouge itself), then #5–#7, then #8–#10. Judge every step in the real-time viewer, not Cycles.

## Housekeeping found on the way

- The tug's size is documented three ways (27 m in an old `common.py` comment, 15 m in the README, ≈ 17 m built). Make
  them agree.
- Buried glow geometry shows through its cover because glow is pulled forward in depth (polygon offset). Glow must be
  modelled as visible surfaces only — outlines, not hidden discs (fixed on Lumen and Tech).
