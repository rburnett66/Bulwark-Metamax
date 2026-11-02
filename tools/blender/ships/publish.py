"""Copy finished ship GLBs into the game and write the manifest.  [MM-story_mvzrzcjh_1z]

    python3 tools/blender/ships/publish.py [slug ...]     # default: every ship with a build in out/

→ prototype/test-game/content/ships/{slug}_lod{0,1,2}.glb + ships.json (stats read back from the GLBs).
Content must be committed to ship: commit content/ships/ with the scripts.
"""
import json
import os
import shutil
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DEST = os.path.join(ROOT, "prototype", "test-game", "content", "ships")
sys.path.insert(0, HERE)
ENGINE_COLORS = None


def glb_json(path):
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n]), len(b)


def stats(path):
    j, size = glb_json(path)
    tris = sum(j["accessors"][p["indices"]]["count"] // 3 for m in j["meshes"] for p in m["primitives"])
    draws = sum(len(m["primitives"]) for m in j["meshes"])
    engines = [n for n in j["nodes"] if n.get("name", "").startswith("engine_")]
    xs = [a["min"][0] for a in j["accessors"] if "min" in a and len(a["min"]) == 3] + \
         [a["max"][0] for a in j["accessors"] if "max" in a and len(a["max"]) == 3]
    return {"tris": tris, "drawCalls": draws, "bytes": size}, engines, round(max(xs) - min(xs), 2)


def main():
    out = os.path.join(HERE, "out")
    slugs = sys.argv[1:] or sorted(d for d in os.listdir(out) if os.path.exists(os.path.join(out, d, f"{d}_lod0.glb")))
    os.makedirs(DEST, exist_ok=True)
    man_path = os.path.join(DEST, "ships.json")
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    for slug in slugs:
        entry = {"lods": []}
        for lod in range(3):
            src = os.path.join(out, slug, f"{slug}_lod{lod}.glb")
            shutil.copyfile(src, os.path.join(DEST, f"{slug}_lod{lod}.glb"))
            st, engines, length = stats(src)
            entry["lods"].append({"file": f"{slug}_lod{lod}.glb", **st})
            if lod == 0:
                entry["engines"] = len(engines)
                entry["engineColor"] = (engines[0].get("extras") or {}).get("color") if engines else None
                entry["length"] = length
        manifest[slug] = entry
        print(f"{slug}: " + " / ".join(f"LOD{i} {l['tris']} tris {l['drawCalls']} dc" for i, l in enumerate(entry["lods"])) + f", {entry['engines']} engines")
    with open(man_path, "w") as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write("\n")


if __name__ == "__main__":
    main()
