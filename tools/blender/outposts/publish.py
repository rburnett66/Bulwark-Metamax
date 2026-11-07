"""Publish the outpost models into the game: copy each building's LOD GLBs from out/<slug>/ to
prototype/test-game/content/outposts/ and write outposts.json, the manifest the game and the review page read.
[MM-story_mw5oect7_m]

    python3 tools/blender/outposts/publish.py            # every built building
    python3 tools/blender/outposts/publish.py hub power  # just these

The manifest is read straight from the GLBs (no Blender needed): per LOD the file, triangles, draw calls and bytes;
the clips with their durations; the named nodes; the anchors with their positions (game axes: Y up); and the
footprint in cells. The content must be committed with the feature (CLAUDE.md: content must be committed to ship).
"""
import json
import os
import shutil
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "..", "prototype", "test-game", "content", "outposts"))
# What each model is, for the review page and the game (tech plan §6.2). Preview builds (rig_auger_mk2) are not
# published: Mk II is the same GLB recoloured at runtime.
MODELS = {
    "hub": "Hub: landing pad with the parked cargo shuttle",
    "shuttle": "Cargo Shuttle: flies off the hub on SELL",
    "power": "Power Station I: drum reactor",
    "power_ii": "Power Station II: energy reactor",
    "storage": "Storage: ore depot with the fill hologram",
    "rig_auger": "Auger rig: iron and the other auger ores",
    "rig_laser": "Laser Cutter rig: aluminum and the other laser ores",
    "rig_brine": "Brine Pump rig: lithium and the other brine ores",
}


def glb_json(path):
    with open(path, "rb") as f:
        b = f.read()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n]), len(b)


def tris(j):
    t = 0
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            t += j["accessors"][p["indices"]]["count"] // 3 if "indices" in p else 0
    return t


def describe(slug):
    lods, info = [], {}
    for lod in range(3):
        src = os.path.join(OUT, slug, f"{slug}_lod{lod}.glb")
        j, size = glb_json(src)
        lods.append({"file": f"{slug}_lod{lod}.glb", "tris": tris(j),
                     "drawCalls": sum(len(m["primitives"]) for m in j.get("meshes", [])), "bytes": size})
        if lod == 0:
            info = j
    nodes = info["nodes"]
    clips = {}
    for a in info.get("animations", []):
        dur = max(info["accessors"][s["input"]]["max"][0] for s in a["samplers"])
        clips[a["name"]] = round(dur, 3)
    named = sorted({n.get("extras", {}).get("node") for n in nodes if n.get("extras", {}).get("node")} - {"base"})
    anchors = {n["name"][len("anchor_"):]: [round(v, 3) for v in n.get("translation", [0, 0, 0])]
               for n in nodes if n["name"].startswith("anchor_")}
    lo, hi = [1e9] * 3, [-1e9] * 3
    for m in info.get("meshes", []):
        for p in m["primitives"]:
            acc = info["accessors"][p["attributes"]["POSITION"]]
            lo = [min(a, b) for a, b in zip(lo, acc["min"])]
            hi = [max(a, b) for a, b in zip(hi, acc["max"])]
    return {"label": MODELS[slug], "lods": lods, "clips": clips, "nodes": named, "anchors": anchors,
            "footprint": [round(hi[0] - lo[0], 2), round(hi[2] - lo[2], 2)], "height": round(hi[1], 2)}


def main(slugs):
    os.makedirs(DEST, exist_ok=True)
    path = os.path.join(DEST, "outposts.json")
    manifest = json.load(open(path)) if os.path.exists(path) else {}
    for slug in slugs:
        if not os.path.exists(os.path.join(OUT, slug, f"{slug}_lod0.glb")):
            print(f"[publish] {slug}: not built, skipped (run {slug}.py first)")
            continue
        for lod in range(3):
            shutil.copy2(os.path.join(OUT, slug, f"{slug}_lod{lod}.glb"), DEST)
        manifest[slug] = describe(slug)
        m = manifest[slug]
        print(f"[publish] {slug}: LOD0 {m['lods'][0]['tris']} tris, {m['lods'][0]['bytes'] // 1024} KB; "
              f"clips {m['clips'] or '-'}; nodes {m['nodes'] or '-'}")
    manifest = {k: manifest[k] for k in MODELS if k in manifest}
    with open(path, "w") as f:
        json.dump(manifest, f, indent=1)
    print(f"[publish] {len(manifest)} models → {os.path.relpath(path)}")


if __name__ == "__main__":
    main(sys.argv[1:] or list(MODELS))
