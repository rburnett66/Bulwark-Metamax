# Capital ships (headless Blender)

One build script per faction capital ship, modelled from the Grok concept art in `ref/`.

```bash
bash tools/blender/setup.sh                  # once per session
python3 tools/blender/ships/lumen.py         # → out/lumen/{lumen.glb, lumen.blend, lumen_*.png}
python3 tools/blender/ships/sheet.py lumen   # → out/lumen/lumen_sheet.jpg (reference + 4 views)
```

`out/` is not committed; the scripts are the source.

## Rules every ship follows

- **Mirrored port to starboard.** Model the port side (+Y) and the centreline only. `common.build()` merges
  everything, cuts at y = 0 and mirrors, so anything modelled on the starboard side is discarded.
- **One mesh per material.** The same step merges parts by material: a ship costs one draw call per material.
- **Hard-surface lofts.** Hulls are lofts of chamfered-rectangle sections (`loft`, `box`, `cyl`), with no
  sculpting or subdivision.

## Geometry budget

| Use | Triangles | Materials (draw calls) | Textures |
|---|---|---|---|
| LOD0: close-up (capital ship screen, mission giver) | ≤ 6,000 | ≤ 4 | 1K on mobile, 2K on PC |
| LOD1: orbit view on the planet screen | ≈ 2,000 | ≤ 4 | shared with LOD0 |
| LOD2: fleet or far distance | ≈ 600 | 1–2 | none |

The per-ship cost is low next to a full frame. Mobile WebGL handles a few hundred thousand triangles, so the
budget is about keeping draw calls and texture memory down when several ships share a screen.

| Ship | Triangles | Materials | Status |
|---|---|---|---|
| Lumen | 2,728 | 3 (hull, trim, glow) | pilot, awaiting sign-off |
