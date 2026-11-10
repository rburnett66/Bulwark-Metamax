# Farming models

The farming mode's models, built headless with Blender 5.2 (`bpy`, see `../README.md`), and the scale prototype page
that shows them on outpost ground. Design: `docs/16 Bulwark MM/design/Farming-Design.md` §4.4–§4.5.

| File | What it is |
|---|---|
| `build_farm_models.py` | builds the GLBs: plants (every growth state), orchard and solo trees, the hydroponic glass dome, the vertical farm (floors 1–4), the underground ammunition bunker, the grow-room machines and the gro-bot |
| `farm_common.py` | shared helpers and the material contract (`trim`, `glow_*`, `pod`/`glow_pod`, `glass`); flat shaded, no textures |
| `scale_template.html` | the scale prototype page, with placeholders for the models and the ship's crew rig |
| `make_page.py` | inlines the GLBs and `prototype/test-game/src/ship-interior/crew.js` into one standalone page |

Rebuild, from the repo root:

```bash
python tools/blender/farming/build_farm_models.py -- /tmp/farm_glb          # or: blender -b -P tools/blender/farming/build_farm_models.py -- /tmp/farm_glb
python tools/blender/farming/make_page.py /tmp/farm_glb tools/blender/farming/scale_template.html \
    prototype/test-game/tools/farming/scale.html
```

Pass model names after the output folder to build only some (e.g. `-- /tmp/farm_glb bunker_mound`). The GLBs are not
committed; the page carries them inlined, so `prototype/test-game/tools/farming/scale.html` opens on its own in a
browser.
