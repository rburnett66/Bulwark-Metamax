"""Collective capital ship — low-poly, from ref/collective.jpg.

    python3 tools/blender/ships/collective.py [out_dir] [--no-render]

Read of the reference: a long, rounded ivory hull with an orange accent sweep and a blue light line down the
flank; a central ivory dome with emblem discs and a lantern spire; a crown of spires around it; cargo pods
(open scaffold cages of stacked containers) on truss booms radiating outward like spokes along the length; a stern engine block of eight round nozzles
(2 rows x 4). Modelled port-side + centreline only — the build mirrors it.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DECK, DETAIL, box, build, cyl, engine, light_strip, loft, mat, scaffold, window_row  # noqa: E402


def placed(ob, loc, yaw=0.0):
    """Move an origin-built part into place, turned about Z by yaw degrees."""
    ob.location = loc
    ob.rotation_euler = (0, 0, math.radians(yaw))
    return ob


def spire(x, y, z, r, h, material, sides=6):
    """A plinth with a tapered spire on top."""
    cyl("spire_base", (x, y, z + h * 0.12), r * 1.5, h * 0.24, material, sides=sides, axis="Z")
    cyl("spire_cone", (x, y, z + h * 0.24 + h * 0.38), r, h * 0.76, material, sides=sides, axis="Z", r1=0.01)


def strut(name, a, b, z, material):
    """One standard 1.25 m truss member from (x, y) point a to b at height z (turned about Z only)."""
    (ax, ay), (bx, by) = a, b
    L = math.hypot(bx - ax, by - ay)
    return placed(box(name, (0, 0, 0), (L, DETAIL["strut"]["t"], DETAIL["strut"]["t"]), material),
                  ((ax + bx) / 2, (ay + by) / 2, z), math.degrees(math.atan2(by - ay, bx - ax)))


# cargo pod cage: 3.0 long (3 bays of 1.0), 0.6 wide, 0.5 tall — holds 0.1 x 0.1 x 0.25 containers
CL, CW, CH = 3.0, 0.3, 0.25
CONT = (0.25, 0.1, 0.1)
# container stacks per pod, each resting across a bottom rib: (rib frame 0..3, row across y 0..4, height)
LOADS = [
    [(0, 3, 1), (1, 4, 2), (2, 1, 1), (3, 4, 1)],
    [(0, 4, 1), (1, 2, 1), (2, 4, 2), (3, 3, 1)],
    [(0, 2, 1), (1, 4, 1), (2, 3, 2), (3, 4, 1)],
    [(0, 4, 2), (1, 3, 1), (2, 4, 1), (3, 1, 1)],
]


def cargo_pod(i, root, tip, z, hull, trim, glow, colours):
    """A spoke: a truss boom from the hull side out to an open scaffold cage of stacked containers, with a
    control cab (lit strip) at its bow end. Built axis-aligned so every member stays at strut size."""
    (rx, ry), (tx, ty) = root, tip
    name = f"spoke{i}"
    x0, x1 = tx - CL / 2, tx + CL / 2
    scaffold(name, x0, x1, ty, z, CW, CH, trim, bays=3, top=False)   # open-topped: bottom chords carry the load
    # containers sit on the cage floor in stacks, two or three muted colours
    for k, (slot, row, n) in enumerate(LOADS[i]):
        for j in range(n):
            cx = min(max(x0 + CL / 3 * slot, x0 + 0.15), x1 - 0.15)
            cy = ty - 0.22 + 0.1 * row
            box(f"{name}_box{k}_{j}", (cx, cy, z - CH + 0.075 + 0.1 * j), CONT,
                colours[(k + j + i) % len(colours)])
    # truss boom: a top and bottom chord (standard struts) from the hull root to the cage's inboard face
    inb = ty - CW
    a, b = (rx, ry), (tx, inb)
    for dz in (CH, -CH):
        strut(f"strut_{name}_boom{'tb'[dz < 0]}", a, b, z + dz, trim)
    # control cab at the bow end: lit strip along its outboard face
    cx = x1 + 0.22
    box(f"{name}_cab", (cx, ty, z), (0.44, CW * 2 + 0.05, CH * 2 + 0.05), hull)
    light_strip(f"strip_{name}_cab", (cx - 0.18, ty + CW + 0.025, z - 0.1), (cx + 0.18, ty + CW + 0.025, z - 0.1), glow)


def make():
    hull = mat("hull", (0.80, 0.74, 0.64), rough=0.55, metal=0.1)
    trim = mat("trim", (0.13, 0.11, 0.10), rough=0.45, metal=0.4)
    accent = mat("accent", (0.85, 0.40, 0.10), rough=0.45, metal=0.2)
    gold = mat("gold", (0.62, 0.44, 0.16), rough=0.35, metal=0.7)
    glow = mat("glow", (0.1, 0.25, 0.8), emit=(0.25, 0.5, 1.0), strength=7)

    # main hull — long, rounded (heavy chamfer), blunt stern, tapering bow
    W, H, C = 2.6, 1.6, 1.0
    loft("hull", [(-10.5, 2.35, 1.35, 0.85, 0, 0), (-9.6, W, H, C, 0, 0), (3.5, W, H, C, 0, 0),
                  (7.0, 2.0, 1.25, 0.8, 0, -0.1), (9.6, 1.1, 0.75, 0.5, 0, -0.25), (11.0, 0.35, 0.28, 0.15, 0, -0.35)],
         hull)
    loft("keel", [(-9.5, 1.5, 0.4, 0.25, 0, -1.6), (5.5, 1.3, 0.35, 0.2, 0, -1.55), (8.0, 0.6, 0.2, 0.12, 0, -1.2)],
         trim)
    # flank livery: orange sweep with the blue light line beneath it
    box("flank_orange", (-3.0, W + 0.01, 0.2), (13.0, 0.04, 0.5), accent)
    loft("bow_orange", [(3.5, 0.02, 0.19, 0, W + 0.01, 0.15), (7.0, 0.02, 0.15, 0, 2.01, 0.0)], accent)
    light_strip("band_flank", (-9.5, W, -0.18), (3.5, W, -0.18), glow, wide=True)
    # the band follows the bow taper — a swept signature line, so it is a feature light at band width
    loft("feat_bow_band", [(3.5, 0.02, 0.04, 0, W + 0.01, -0.18), (7.0, 0.02, 0.04, 0, 2.01, -0.3)], glow)
    box("flank_dark", (-3.0, W + 0.005, -0.55), (13.0, 0.03, 0.3), trim)

    # dorsal deck carrying the dome
    loft("deck", [(-6.0, 1.5, 0.3, 0.2, 0, 1.6), (-4.5, 2.0, 0.35, 0.2, 0, 1.7), (4.5, 2.0, 0.35, 0.2, 0, 1.7),
                  (6.5, 1.2, 0.2, 0.15, 0, 1.55)], hull)
    box("deck_band", (0.0, 2.02, 1.72), (8.4, 0.04, 0.16), accent)

    # the dome: drum, stepped cap, lantern and spire
    DX, DZ = 0.5, 2.0
    cyl("dome_ring", (DX, 0, DZ + 0.05), 2.65, 0.2, trim, sides=12, axis="Z")
    cyl("dome_drum", (DX, 0, DZ + 0.45), 2.4, 0.6, hull, sides=12, axis="Z")
    cyl("dome_band", (DX, 0, DZ + 0.8), 2.43, 0.1, accent, sides=12, axis="Z")
    z = DZ + 0.75
    for r0, r1, h in ((2.35, 2.15, 0.6), (2.15, 1.7, 0.55), (1.7, 1.0, 0.45), (1.0, 0.45, 0.25)):
        cyl("dome_cap", (DX, 0, z + h / 2), r0, h, hull, sides=12, axis="Z", r1=r1)
        z += h
    cyl("lantern", (DX, 0, z + 0.3), 0.32, 0.6, hull, sides=8, axis="Z")
    cyl("feat_lantern_glow", (DX, 0, z + 0.3), 0.34, 0.12, glow, sides=8, axis="Z")
    cyl("lantern_roof", (DX, 0, z + 0.75), 0.4, 0.3, trim, sides=8, axis="Z", r1=0.1)
    cyl("spire_dome", (DX, 0, z + 1.35), 0.09, 1.0, hull, sides=6, axis="Z", r1=0.01)
    # emblem discs: one on the dome's port flank, one on the bow flank
    em = placed(cyl("emblem", (0, 0, 0), 0.6, 0.06, gold, sides=10, axis="Y"), (DX + 0.3, 2.12, DZ + 1.35))
    em.rotation_euler = (math.radians(-28), 0, math.radians(-8))
    ec = placed(cyl("emblem_core", (0, 0.04, 0), 0.35, 0.04, trim, sides=8, axis="Y"), (DX + 0.3, 2.12, DZ + 1.35))
    ec.rotation_euler = (math.radians(-28), 0, math.radians(-8))

    # stern cowl: the raised, rounded aft crown that carries the second emblem (ref: above the engines)
    loft("cowl", [(-10.45, 1.6, 0.35, 0.3, 0, 1.45), (-9.4, 2.0, 0.65, 0.5, 0, 1.55), (-4.2, 2.0, 0.65, 0.5, 0, 1.55),
                  (-2.4, 1.4, 0.3, 0.25, 0, 1.6)], hull)
    box("cowl_orange", (-6.8, 2.01, 1.55), (5.0, 0.04, 0.22), accent)
    placed(cyl("stern_emblem", (0, 0, 0), 1.0, 0.05, gold, sides=10, axis="Z"), (-7.0, 0.0, 2.21))
    placed(cyl("stern_emblem_core", (0, 0, 0), 0.6, 0.05, trim, sides=8, axis="Z"), (-7.0, 0.0, 2.25))

    # crown of spires around the dome
    for ang, h in ((15, 1.8), (55, 2.3), (95, 2.6), (135, 2.3), (170, 1.8)):
        a = math.radians(ang)
        spire(DX + 3.1 * math.cos(a), 2.85 * math.sin(a) + 0.15, 1.85, 0.16, h, hull)

    # fore cathedral block with the tallest spires
    box("fore_tower", (5.6, 1.0, 2.0), (2.6, 1.6, 0.8), hull, chamfer=0.25)
    spire(6.2, 1.2, 2.4, 0.24, 3.4, hull)
    spire(4.9, 1.45, 2.4, 0.18, 2.5, hull)
    spire(5.4, 0.35, 2.4, 0.2, 2.8, hull)
    for k in range(2):                                     # two decks of windows on the tower's port face
        window_row(f"win_tower_{k}", (4.6, 1.8, 1.92 + k * DECK), (6.6, 1.8, 1.92 + k * DECK), glow, count=4)
    # two decks of windows on the dome drum's port face (the 12-gon's flat face at +Y)
    ay = 2.4 * math.cos(math.radians(15))
    for k in range(2):
        window_row(f"win_drum_{k}", (DX - 0.5, ay, DZ + 0.36 + k * DECK), (DX + 0.5, ay, DZ + 0.36 + k * DECK), glow, count=2)

    # radiating spokes: truss booms out to cargo pods (fore pods sweep forward, aft pods sweep aft)
    colours = (mat("cargo_rust", (0.42, 0.22, 0.13), rough=0.6, metal=0.2),
               mat("cargo_slate", (0.20, 0.27, 0.33), rough=0.6, metal=0.2),
               mat("cargo_ochre", (0.50, 0.43, 0.27), rough=0.6, metal=0.2))
    spokes = [((5.6, 2.1), (7.6, 5.9), 0.0, 16), ((2.0, 2.5), (2.8, 6.9), -0.1, 6),
              ((-2.2, 2.5), (-2.6, 7.0), -0.2, -4), ((-5.8, 2.5), (-7.6, 6.2), -0.1, -14)]
    for i, (root, tip, z, _yaw) in enumerate(spokes):
        cargo_pod(i, root, tip, z, hull, trim, glow, colours)

    # stern: dark engine frame and the 2 x 4 nozzle block (port half: two columns x two rows)
    loft("engine_frame", [(-10.9, 2.25, 1.25, 0.6, 0, -0.05), (-10.45, 2.3, 1.3, 0.62, 0, -0.05)], trim)
    loft("engine_rim", [(-10.55, 2.42, 1.42, 0.68, 0, -0.05), (-10.4, 2.42, 1.42, 0.68, 0, -0.05)], accent)
    for y in (0.55, 1.62):
        for zz in (0.5, -0.6):
            engine((-11.4, y, zz), 0.44, trim, depth=0.6, sides=10)


if __name__ == "__main__":
    build("collective", make)
