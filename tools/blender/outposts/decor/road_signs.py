"""Road sign post (SRS-07) — outpost decor, small.  [MM-story_mwfacvte_b]

Reference: Design/road-signs.png — a 1.5 m weathered metal post on a bolted base plate carrying five arrow panels about
620 mm wide (cream, red, teal, sky blue, white) pointing either way, bolted on, slightly bent.

    python tools/blender/outposts/decor/road_signs.py [out_dir] [--render]
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import M, box, build, drum, mats  # noqa: E402  (imports bpy first: bmesh needs it loaded)
import bmesh  # noqa: E402
import bpy  # noqa: E402

H = 1.5 * M
PANELS = [("cream", 1), ("red", -1), ("teal", 1), ("sky", -1), ("white", 1)]


def arrow(name, z, direction, material, w=0.62 * M, h=0.16 * M, t=0.02 * M, tilt=0.0):
    """A flat arrow-shaped panel (a pentagon: the point on `direction`'s side), centred on the post at height z."""
    tip = w * 0.22
    pts = [(-w / 2, -h / 2), (w / 2 - tip, -h / 2), (w / 2, 0), (w / 2 - tip, h / 2), (-w / 2, h / 2)]
    bm = bmesh.new()
    for yy in (-t / 2, t / 2):
        for px, pz in pts:
            bm.verts.new((direction * (px + w * 0.32), yy - 0.05 * M, pz + z))
    bm.verts.ensure_lookup_table()
    n = len(pts)
    bm.faces.new([bm.verts[i] for i in range(n)])
    bm.faces.new([bm.verts[n + i] for i in reversed(range(n))])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bm.verts[i], bm.verts[j], bm.verts[n + j], bm.verts[n + i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    ob.rotation_euler = (0, tilt, 0)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def make(detail):
    P = mats()
    box("plate", (0, 0, 0.015 * M), (0.3 * M, 0.3 * M, 0.03 * M), P["gunmetal"])
    drum("post", (0, 0, 0.03 * M), 0.035 * M, H - 0.03 * M, P["steel"], sides=10 if detail else 6)
    for i, (col, d) in enumerate(PANELS if detail else PANELS[::2]):
        z = (0.72 + i * 0.17 * (1 if detail else 2)) * M
        arrow(f"panel_{i}", z, d, P[col], tilt=math.radians((-3, 2, -1, 4, -2)[i % 5]) if detail else 0.0)
        if detail:
            box(f"bracket_{i}", (0, -0.045 * M, z), (0.09 * M, 0.02 * M, 0.06 * M), P["dark"])
    if detail:
        drum("cap", (0, 0, H), 0.045 * M, 0.02 * M, P["dark"], sides=10)
        for sx in (-1, 1):
            for sy in (-1, 1):
                drum(f"bolt_{sx}{sy}", (sx * 0.11 * M, sy * 0.11 * M, 0.03 * M), 0.012 * M, 0.015 * M, P["dark"], sides=6)


if __name__ == "__main__":
    build("road_signs", make, "small", label="Road sign post", ref="Design/road-signs.png")
