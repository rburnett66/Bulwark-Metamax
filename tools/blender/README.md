# Headless Blender

Blender runs here as a Python module (`bpy`), with no window and no install on anyone's machine. Every agent
session runs in its own workspace, so each one installs it once:

```bash
bash tools/blender/setup.sh          # install the pinned version, then run the smoke test
bash tools/blender/setup.sh --check  # smoke test only
```

The version is pinned in `setup.sh` (Blender 5.2.3 LTS), so every agent builds with the same Blender.
`bpy` 5.2 needs **Python 3.13**; point `PYTHON=` at one if `python3` is another version.

The smoke test (`smoke.py`) models a bevelled block with a boolean cut, renders it with Cycles and exports
a GLB. It prints one line ending in `OK`.

## Working rules

- **Render with Cycles on the CPU.** Eevee needs a GPU; in a container it falls back to software GL and is
  about 30× slower.
- **Use absolute output paths.** Blender 5 reads `//` as relative to a saved .blend and `{…}` as a path
  template, so `"//shot_{view}.png"` fails.
- **Don't compress GLB exports.** The pip build ships without the Draco and MeshOptimizer libraries; export
  logs two `ERROR … is not available` lines on every run. They are harmless for plain GLB export, which is
  all the smoke test and the game need.
- **Start from an empty scene** (`bpy.ops.wm.read_factory_settings(use_empty=True)`) so a build never
  depends on Blender's default cube, camera and light.

## Parallel agents

Several agents can build models at the same time as long as they never share files:

- One build script per model, and one output folder per model.
- A build script only writes inside its own output folder.
- Generated renders, .blend and .glb files go to an output folder that is not committed until the
  model is reviewed; the build script is the source of truth and is always committed.
