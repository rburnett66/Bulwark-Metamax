"""Publish the farm's plant models into the game: copy plant_grain.glb and plant_leafy.glb from the build folder to
prototype/test-game/content/farm/ and write farm-models.json, the manifest the FARM tab reads.  [MM-task_mwagi1nr_1e]

    blender -b -P tools/blender/farming/build_farm_models.py -- tools/blender/farming/out plant_grain plant_leafy
    python3 tools/blender/farming/publish.py [glb_dir]          # default: tools/blender/farming/out

The farm's buildings (Farmhouse, Silo, Pump) are outpost buildings and publish through tools/blender/outposts/publish.py.
The manifest is read straight from the GLBs (no Blender needed): per model the file, bytes, triangles, materials and
one node per growth state with its triangles. Plants are in battle units (4 to a cell) and drawn instanced, 16 to a
plot (Farming-Design §4.4–§4.5). Flat colours only: a published plant carries no image (the test holds it to that).
The content must be committed with the feature (CLAUDE.md: content must be committed to ship).
"""
import json
import os
import shutil
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "..", "prototype", "test-game", "content", "farm"))
STATES = ["planted", "sprout", "plant", "fruited", "dead", "harvested"]   # Farming-Design §5.1, in growth order
MODELS = {
    "plant_grain": ("grain", "Grain: stalks with grain heads and awns"),
    "plant_leafy": ("leafy", "Leafy: a rosette crop over a bulb"),
}


def glb_json(path):
    with open(path, "rb") as f:
        b = f.read()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n]), len(b)


def mesh_tris(j, mi):
    return sum(j["accessors"][p["indices"]]["count"] // 3 for p in j["meshes"][mi]["primitives"] if "indices" in p)


def node_tris(j, ni):
    n = j["nodes"][ni]
    return (mesh_tris(j, n["mesh"]) if "mesh" in n else 0) + sum(node_tris(j, c) for c in n.get("children", []))


def describe(slug, path):
    prefix, label = MODELS[slug]
    j, size = glb_json(path)
    by_name = {n.get("extras", {}).get("node"): i for i, n in enumerate(j["nodes"]) if n.get("extras", {}).get("node")}
    nodes = {}
    for s in STATES:
        name = f"{prefix}_{s}"
        if name not in by_name:
            raise SystemExit(f"[publish] {slug}: no node {name}")
        nodes[s] = {"node": name, "tris": node_tris(j, by_name[name])}
    return {"label": label, "file": f"{slug}.glb", "bytes": size, "tris": sum(v["tris"] for v in nodes.values()),
            "units": "battle units, 4 to a cell", "perPlot": 16, "materials": sorted(m["name"] for m in j["materials"]),
            "nodes": nodes}


def main(src):
    os.makedirs(DEST, exist_ok=True)
    manifest = {}
    for slug in MODELS:
        path = os.path.join(src, f"{slug}.glb")
        if not os.path.exists(path):
            raise SystemExit(f"[publish] {slug}: not built in {src} (run build_farm_models.py first)")
        shutil.copy2(path, DEST)
        manifest[slug] = describe(slug, path)
        print(f"[publish] {slug}: {manifest[slug]['tris']} tris, {manifest[slug]['bytes'] // 1024} KB")
    with open(os.path.join(DEST, "farm-models.json"), "w") as f:
        json.dump({"states": STATES, "models": manifest}, f, indent=1)
    print(f"[publish] {len(manifest)} plant models -> {os.path.relpath(DEST)}")


if __name__ == "__main__":
    main(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "out"))
