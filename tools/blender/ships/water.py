"""Water capital ship — low-poly, from ref/water.jpg.

    python3 tools/blender/ships/water.py [out_dir] [--no-render]

Read of the reference: a brass/bronze steampunk submarine-zeppelin. A long round hull in segments with
raised ring bands; a bulbous bow section with a fluted cap; two big ribbed glass domes on the centreline
(one forward on the bow bulb, one amidships on a raised drum); smokestacks and spires along the dorsal
deck; long rows of orange portholes down each flank; machinery slung under the belly. Modelled port side
+ centreline only — the build mirrors it.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import _obj, box, build, cyl, engine, mat  # noqa: E402  (imports bpy before bmesh)
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402


# ── local helpers ─────────────────────────────────────────────────────────────────────
def rloft(name, stations, material, sides=16, axis="X", cap0=True, cap1=True, bevel=0.0):
    """Loft of elliptical (round) sections. stations: [(t, ry, rz, cy, cz), …].
    axis X: t = x, section in YZ.  axis Z: t = z, section in XY (ry → x radius, rz → y radius, cy → x, cz → y)."""
    bm = bmesh.new()
    rings = []
    for t, ry, rz, cy, cz in stations:
        ring = []
        for i in range(sides):
            a = 2 * math.pi * (i + 0.5) / sides
            u, v = cy + ry * math.cos(a), cz + rz * math.sin(a)
            ring.append(bm.verts.new(Vector((t, u, v) if axis == "X" else (u, v, t))))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(sides):
            bm.faces.new((a[i], a[(i + 1) % sides], b[(i + 1) % sides], b[i]))
    if cap0:
        bm.faces.new(list(reversed(rings[0])))
    if cap1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material, bevel)


def dome(name, cx, cz, r, material, sides=12, steps=5, h=1.0):
    """Hemisphere (height h × r) standing on z = cz, centred on the x axis line (y = 0)."""
    st = []
    for k in range(steps + 1):
        th = (math.pi / 2) * k / steps
        rr = max(r * math.cos(th), 0.04)
        st.append((cz + h * r * math.sin(th), rr, rr, cx, 0.0))
    return rloft(name, st, material, sides=sides, axis="Z")


def rib(name, cx, cz, r, phi, material, h=1.0, steps=5, t=0.07, w=0.05):
    """A meridian rib on a dome: a thin strip standing proud of the surface at azimuth phi."""
    bm = bmesh.new()
    d = Vector((math.cos(phi), math.sin(phi), 0))
    side = Vector((-math.sin(phi), math.cos(phi), 0))
    rings = []
    for k in range(steps + 1):
        th = (math.pi / 2) * k / steps * 0.97
        n = Vector((d.x * math.cos(th), d.y * math.cos(th), h * math.sin(th))).normalized()
        base = Vector((cx, 0, cz)) + Vector((d.x * r * math.cos(th), d.y * r * math.cos(th), h * r * math.sin(th)))
        rings.append([bm.verts.new(base + n * o + side * s) for o, s in ((-0.01, -w), (t, -w), (t, w), (-0.01, w))])
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def porthole(name, x, z, r, material, sides=6, proud=0.03):
    """A flat hex lens lying on the hull's flank (port side), tilted to the local surface normal."""
    rh = hull_r(x)
    rz = rh * SQUASH
    y = rh * math.sqrt(max(0.0, 1 - (z / rz) ** 2))
    n = Vector((0, y / rh ** 2, z / rz ** 2)).normalized()
    u = Vector((1, 0, 0))
    v = n.cross(u).normalized()
    c = Vector((x, y, z)) + n * proud
    bm = bmesh.new()
    vs = [bm.verts.new(c + u * r * math.cos(2 * math.pi * i / sides) + v * r * math.sin(2 * math.pi * i / sides))
          for i in range(sides)]
    f = bm.faces.new(vs)
    if f.normal.dot(n) < 0:
        f.normal_flip()
    return _obj(name, bm, material)


# hull profile: (x, radius) — the bow bulb, the long body, the tapering stern
PROFILE = [(11.3, 0.45), (11.0, 1.3), (10.3, 2.05), (9.3, 2.5), (7.8, 2.55), (6.9, 2.45), (6.5, 2.1),
           (-6.0, 2.1), (-7.6, 1.95), (-9.0, 1.6), (-10.2, 1.15)]
SQUASH = 0.94          # hull is slightly flattened vertically


def hull_r(x):
    for (x0, r0), (x1, r1) in zip(PROFILE, PROFILE[1:]):
        if x1 <= x <= x0:
            return r1 + (r0 - r1) * (x - x1) / (x0 - x1)
    return PROFILE[-1][1]


def make():
    hull = mat("hull", (0.25, 0.20, 0.10), rough=0.45, metal=0.7)       # brass
    trim = mat("trim", (0.085, 0.075, 0.05), rough=0.5, metal=0.6)        # dark bronze
    glass = mat("glass", (0.03, 0.12, 0.14), rough=0.15, metal=0.1)     # dark-teal dome glass
    iron = mat("iron", (0.09, 0.09, 0.09), rough=0.6, metal=0.4)        # stacks, vents
    port = mat("port", (0.6, 0.3, 0.05), emit=(1.0, 0.52, 0.14), strength=7)    # orange portholes
    teal = mat("teal", (0.05, 0.4, 0.35), emit=(0.26, 1.0, 0.82), strength=4)   # dome trim glow

    # ── ringed cylinder hull (centreline) ──
    rloft("hull", [(x, r, r * SQUASH, 0, 0) for x, r in PROFILE], hull, sides=16, bevel=0.03)
    for x in (6.65, 4.3, 1.9, -0.6, -3.0, -5.3, -7.4, -9.2):             # raised ring bands
        r = hull_r(x) + 0.2
        rloft("band", [(x - 0.22, r, r * SQUASH, 0, 0), (x + 0.22, r, r * SQUASH, 0, 0)], trim, sides=16)
    # gallery rim around the bow bulb
    rloft("bow_rim", [(10.4, 2.05, 2.0, 0, -0.35), (9.6, 2.72, 2.45, 0, -0.35), (7.6, 2.8, 2.5, 0, -0.35),
                      (7.0, 2.6, 2.35, 0, -0.35)], trim, sides=16)

    # fluted bow cap
    cyl("bow_cap", (11.5, 0, 0), 0.55, 0.5, trim, sides=8, r1=0.18)
    for i in range(4):
        a = math.pi * (i + 0.5) / 4
        box("bow_flute", (10.9, 0.62 * math.cos(a), 0.62 * math.sin(a) * SQUASH), (0.9, 0.1, 0.1), hull)
    cyl("bow_tip", (11.85, 0, 0), 0.08, 0.5, iron, sides=6)

    # ── portholes: two rows down each flank, grouped between the bands ──
    bands = (6.65, 4.3, 1.9, -0.6, -3.0, -5.3, -7.4)
    for z, row in ((0.35, 0), (-0.55, 1)):
        for xa, xb in zip(bands, bands[1:]):
            n = 4 if row == 0 else 2
            for k in range(n):
                x = xb + (xa - xb) * (k + 1) / (n + 1)
                porthole("porthole", x, z, 0.16, port)
    for x in (9.9, 9.3, 8.7, 8.1, 7.5):                                               # bow-bulb portholes
        porthole("porthole", x, 0.3, 0.17, port)

    # ── dorsal deck (centreline) ──
    top = 2.1 * SQUASH
    box("deck", (-2.5, 0, top + 0.05), (12.0, 1.6, 0.5), hull, chamfer=0.15, bevel=0.02)
    box("deck_side", (-2.5, 0.95, top - 0.25), (12.0, 0.3, 0.4), trim, chamfer=0.1)

    # forward dome on the bow bulb
    fx, fz, fr = 8.3, 2.55, 1.8
    rloft("fdome_drum", [(fz - 0.4, fr + 0.25, fr + 0.25, fx, 0), (fz, fr + 0.25, fr + 0.25, fx, 0)], trim, sides=16, axis="Z")
    rloft("fdome_glow", [(fz, fr + 0.12, fr + 0.12, fx, 0), (fz + 0.06, fr + 0.12, fr + 0.12, fx, 0)], teal, sides=16, axis="Z")
    dome("fdome", fx, fz, fr, glass, sides=16, steps=5)
    for i in range(5):
        rib("fdome_rib", fx, fz, fr, math.pi * i / 4, hull, steps=4)
    rloft("fdome_crown", [(fz + fr - 0.05, 0.35, 0.35, fx, 0), (fz + fr + 0.2, 0.25, 0.25, fx, 0),
                          (fz + fr + 0.5, 0.08, 0.08, fx, 0)], trim, sides=8, axis="Z")
    cyl("fdome_spike", (fx, 0, fz + fr + 0.75), 0.03, 0.6, iron, sides=4, axis="Z")

    # aft dome raised on a drum amidships
    ax, az, ar = -1.8, 3.2, 2.0
    rloft("adome_tower", [(top - 0.2, 1.4, 1.4, ax, 0), (az - 0.45, 1.6, 1.6, ax, 0), (az - 0.2, 2.3, 2.3, ax, 0),
                          (az, 2.3, 2.3, ax, 0)], trim, sides=16, axis="Z")
    rloft("adome_glow", [(az, ar + 0.12, ar + 0.12, ax, 0), (az + 0.06, ar + 0.12, ar + 0.12, ax, 0)], teal, sides=16, axis="Z")
    dome("adome", ax, az, ar, glass, sides=16, steps=5)
    for i in range(5):
        rib("adome_rib", ax, az, ar, math.pi * i / 4, hull, steps=4)
    rloft("adome_crown", [(az + ar - 0.05, 0.4, 0.4, ax, 0), (az + ar + 0.25, 0.28, 0.28, ax, 0),
                          (az + ar + 0.6, 0.08, 0.08, ax, 0)], trim, sides=8, axis="Z")
    cyl("adome_spike", (ax, 0, az + ar + 0.9), 0.03, 0.8, iron, sides=4, axis="Z")

    # ── smokestacks, spires, vents along the top ──
    for x, y, h, r in ((3.0, 0.5, 1.9, 0.26), (1.0, 0.0, 1.5, 0.24), (-4.6, 0.0, 2.6, 0.34), (-6.4, 0.55, 2.0, 0.26), (-8.0, 0.0, 1.6, 0.24)):
        zb = top + 0.3
        cyl("stack", (x, y, zb + h / 2), r, h, iron, sides=8, axis="Z")
        cyl("stack_lip", (x, y, zb + h - 0.05), r + 0.08, 0.14, hull, sides=8, axis="Z")
    # spired tower behind the aft dome
    box("tower", (-4.6, 0.0, top + 0.6), (1.4, 1.6, 0.8), hull, chamfer=0.2)
    for x, y, h in ((3.4, 0.0, 2.0), (2.0, 0.85, 1.6), (-4.0, 0.85, 2.4), (-7.1, 0.9, 1.6), (-9.0, 0.6, 1.2)):
        cyl("spire", (x, y, top + 0.3 + h / 2), 0.14, h, hull, sides=6, axis="Z", r1=0.02)
    for x in (-3.4, -5.6):                                              # dorsal vents
        box("vent", (x, 0.45, top + 0.38), (0.7, 0.45, 0.25), iron, chamfer=0.08)

    # ── belly machinery ──
    loft_keel = [(8.0, 0.7, 0.5, 0, -2.0), (6.0, 0.9, 0.6, 0, -2.15), (-6.0, 0.9, 0.6, 0, -2.15), (-8.0, 0.6, 0.45, 0, -1.8)]
    rloft("keel", loft_keel, trim, sides=8)
    for x in (4.0, -3.5):                                                    # underslung pods
        rloft("belly_pod", [(x + 1.6, 0.25, 0.25, 1.3, -1.75), (x + 1.2, 0.5, 0.5, 1.3, -1.75),
                            (x - 1.2, 0.5, 0.5, 1.3, -1.75), (x - 1.6, 0.3, 0.3, 1.3, -1.75)], hull, sides=8)
        rloft("belly_pod_band", [(x - 0.1, 0.56, 0.56, 1.3, -1.75), (x + 0.1, 0.56, 0.56, 1.3, -1.75)], trim, sides=8)
        cyl("belly_pod_glow", (x - 1.62, 1.3, -1.75), 0.18, 0.04, teal, sides=8)

    # ── stern engines ──
    box("stern_plate", (-10.25, 0, 0), (0.15, 2.0, 2.0), trim, chamfer=0.5)
    engine((-10.85, 0.0, 0.1), 0.6, trim, sides=10)
    engine((-10.75, 0.85, -0.6), 0.36, trim)
    engine((-10.75, 0.85, 0.75), 0.3, trim)


if __name__ == "__main__":
    build("water", make)
