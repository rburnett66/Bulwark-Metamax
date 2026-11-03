"""Audit every ship's secondary details against common.DETAIL.  [MM-task_mvzxtu14_3]

    python3 tools/blender/ships/audit_scale.py [slug ...]     # reads out/<slug>/parts.json from a build

Each part named with a class prefix (win_, port_, strip_, band_, door_, mast_, strut_, gun_s_/gun_m_/gun_l_,
spire_, stack_) is measured against its class; any glowing part with no class prefix (and not feat_ or an engine core)
is flagged as unclassified. Exit status 1 if anything fails, so it can gate a build.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
# common.py imports bpy; read DETAIL without it
src = open(os.path.join(HERE, "common.py")).read()
ns = {}
exec(src[src.index("DETAIL = {"):src.index("# Prefix \"feat_\"")], ns)
DETAIL, TOL = ns["DETAIL"], ns["TOL"]
PREFIXES = sorted(DETAIL, key=len, reverse=True)


def near(v, want):
    return abs(v - want) <= want * TOL


def check(part):
    n = part["name"]
    sz = sorted(part["size"])                   # thickness ≤ minor ≤ major
    t, minor, major = sz
    cls = next((c for c in PREFIXES if n.startswith(c + "_")), None)
    if cls is None:
        if part["glow"] and not n.startswith(("feat_", "engine_core")):
            return f"unclassified glow part {n} {sz}"
        return None
    d = DETAIL[cls]
    if cls == "win":
        if not (near(minor, d["h"]) and near(major, d["w"])) and not (near(minor, d["h"]) and near(major, d["h"])):
            return f"{n}: window {minor:.3f}×{major:.3f}, want {d['h']}×{d['w']}"
    elif cls == "port":
        if not (near(minor, d["d"]) and near(major, d["d"])):
            return f"{n}: porthole {minor:.3f}×{major:.3f}, want ⌀{d['d']}"
    elif cls in ("strip", "band"):
        if not near(minor if minor > t * 1.5 else t, d["w"]) and not near(minor, d["w"]):
            return f"{n}: {cls} width {minor:.3f}, want {d['w']}"
    elif cls == "door":
        if not (near(minor, d["w"]) and near(major, d["h"])):
            return f"{n}: door {minor:.3f}×{major:.3f}, want {d['w']}×{d['h']}"
    elif cls == "strut":
        if not near(t, d["t"]):
            return f"{n}: strut {t:.3f} thick, want {d['t']}"
    elif cls == "mast":
        if not (near(t, d["t"]) and near(minor, d["t"])):
            return f"{n}: mast {t:.3f}×{minor:.3f}, want {d['t']}"
    elif cls.startswith("gun_"):
        if not (near(t, d["d"]) and near(minor, d["d"])):
            return f"{n}: {cls} barrel ⌀{t:.3f}×{minor:.3f}, want ⌀{d['d']}"
    elif cls == "spire":
        if minor < d["min_base"] * (1 - TOL):
            return f"{n}: spire base {minor:.3f}, want ≥ {d['min_base']}"
    elif cls == "stack":
        if not (d["d_min"] * (1 - TOL) <= minor <= d["d_max"] * (1 + TOL)):
            return f"{n}: stack ⌀{minor:.3f}, want {d['d_min']}–{d['d_max']}"
    return None


def main():
    slugs = sys.argv[1:] or sorted(os.path.basename(os.path.dirname(f)) for f in glob.glob(os.path.join(HERE, "out", "*", "parts.json")))
    bad = 0
    for slug in slugs:
        parts = json.load(open(os.path.join(HERE, "out", slug, "parts.json")))["parts"]
        issues = [m for m in (check(p) for p in parts) if m]
        classed = sum(1 for p in parts if any(p["name"].startswith(c + "_") for c in PREFIXES))
        print(f"{slug:11} {classed:3} classed parts, {len(issues):3} issues")
        for m in issues[:40]:
            print("   ", m)
        if len(issues) > 40:
            print(f"    … {len(issues) - 40} more")
        bad += len(issues)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
