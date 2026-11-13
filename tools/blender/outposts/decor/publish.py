"""Publish the decor models into the game: content/outposts/decor/{slug}_{flat,tex}.glb + decor.json.  [MM-story_mwfacvte_b]

    python tools/blender/outposts/decor/publish.py <build_root>

<build_root> holds one folder per model (decor_common.build's output: {slug}_flat.glb, {slug}_tex.glb, {slug}.json).
Refuses to publish a model that is over its budget (design §2). decor.json lists every model: its class (small /
large / lift), footprint and height in cells, nodes, and per LOD its file, triangles and bytes.
"""
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DEST = os.path.join(ROOT, "prototype", "test-game", "content", "outposts", "decor")
ORDER = ["water_tank", "antenna", "chemical_drum", "road_signs", "supply_shelf", "supplies", "cargo_cube", "cargo_lift"]


def main(src):
    os.makedirs(DEST, exist_ok=True)
    manifest = {}
    for slug in ORDER:
        d = os.path.join(src, slug)
        with open(os.path.join(d, f"{slug}.json")) as f:
            r = json.load(f)
        if not r["budget"]["ok"]:
            sys.exit(f"{slug} is over budget: {r['budget']['over']}")
        for lod in ("flat", "tex"):
            shutil.copyfile(os.path.join(d, r["lods"][lod]["file"]), os.path.join(DEST, r["lods"][lod]["file"]))
        manifest[slug] = {k: r[k] for k in ("label", "class", "footprint", "height", "nodes", "lods", "ref")}
    with open(os.path.join(DEST, "decor.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    total = sum(m["lods"][l]["bytes"] for m in manifest.values() for l in ("flat", "tex"))
    print(f"published {len(manifest)} models, {total // 1024} KB → {DEST}")


if __name__ == "__main__":
    main(os.path.abspath(sys.argv[1]))
