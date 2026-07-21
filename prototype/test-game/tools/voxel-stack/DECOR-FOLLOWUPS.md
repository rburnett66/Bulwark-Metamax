# Voxel Decor — follow-up stories (branch feat/voxel-decor)

Deferred items from the decor pipeline audit (2026-07-21), now scheduled.

## Story 4 — Unit↔decor depth occlusion
**As** a player, **I want** units to be correctly hidden behind (and revealed in front of) decor props **so that** a tall pine reads as real scenery, not a flat backdrop.
- Today decor draws on its own layer *below* units (always behind). The game doesn't y-sort units either.
- **Do:** sort decor sprites together with unit sprites by ground-contact screen-y. Put decor into the shared
  `unitSpriteLayer` (or a shared sorted container), enable `sortableChildren`, set `zIndex = contactY` on both
  unit sprites (in the update loop) and decor sprites (at build). Keep decor shadows on the ground layer.
- **Done when:** a unit walking behind a pine is occluded by its canopy; in front, it draws over it.

## Story 5 — Lasso/polygon outline for the ¾ Angle carve
**As** a decor author, **I want** to draw a free-form outline (not just a rectangle) in the Angle view **so that**
I can carve an organic silhouette from the ¾ camera angle.
- Today "◇ Carve to outline" uses the rectangular marquee (`gridSel`).
- **Do:** add a polygon/lasso mode to the grid canvas (mirror the key-modal polygon: click points, click first to
  close). The carve marks filled voxels whose Angle projection (col=x−y+foot/2, row=layers−1−z) falls OUTSIDE
  the polygon (point-in-polygon) for deletion.
- **Done when:** a drawn tree-shaped outline in the Angle view carves the volume to that silhouette on Delete.

## Story 6 — Procedural tree decor type
**As** a decor author, **I want** to generate a tree from parameters instead of hand-drawn silhouettes **so that**
trees are fast to make, natural, and vary across a grove.
- **Do:** a "Procedural" decor shape mode in the 🌿 panel with params: trunk height/​radius, canopy
  shape (cone/round/blob) + radius + start-height, layers, and a per-instance seed for grove variation. Generate
  the voxel volume directly in `buildDecorVolume` (bypass the silhouette carve when procedural). Feeds the same
  pack → scatter → render path.
- **Done when:** picking Procedural + tweaking sliders produces a tree with no source art, bakeable/shippable.

## Story 7 — Decor-specific on-map scale
**As** a level designer, **I want** decor to size independently of the unit 0.5× board-shrink **so that** props read
at the right scale next to units.
- Today `buildDecorSprite` multiplies by `VOXEL_UNIT_SCALE` (0.5, the unit shrink).
- **Do:** a per-decor `scale` field (default 1.0) in the pack `decor{}` block + a panel slider; `buildDecorSprite`
  uses `pack.decor.scale` instead of the unit shrink.
- **Done when:** a tree's on-map size is tunable in the panel and honored in-game.
