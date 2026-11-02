"""Collective capital ship — low-poly, from ref/collective.jpg.

    python3 tools/blender/ships/collective.py [out_dir] [--no-render]

Read of the reference: a long, rounded ivory hull with an orange accent sweep and a blue light line down the
flank; a central ivory dome with emblem discs and a lantern spire; a crown of spires around it; gun-pods on
long barrels radiating outward like spokes along the length; a stern engine block of eight round nozzles
(2 rows x 4). Modelled port-side + centreline only — the build mirrors it.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import box, build, cyl, engine, loft, mat  # noqa: E402


def placed(ob, loc, yaw=0.0):
    """Move an origin-built part into place, turned about Z by yaw degrees."""
    ob.location = loc
    ob.rotation_euler = (0, 0, math.radians(yaw))
    return ob


def spire(x, y, z, r, h, material, sides=6):
    """A plinth with a tapered spire on top."""
    cyl("spire_base", (x, y, z + h * 0.12), r * 1.5, h * 0.24, material, sides=sides, axis="Z")
    cyl("spire", (x, y, z + h * 0.24 + h * 0.38), r, h * 0.76, material, sides=sides, axis="Z", r1=0.01)


def pod(name, root, tip, z, yaw, hull, trim, accent, glow):
    """A spoke: barrel from the hull side out to a gun-pod pointing roughly bow-ward."""
    (rx, ry), (tx, ty) = root, tip
    dx, dy = tx - rx, ty - ry
    L = math.hypot(dx, dy)
    a = math.degrees(math.atan2(dy, dx))
    placed(cyl(name + "_barrel", (0, 0, 0), 0.45, L, trim, sides=8), ((rx + tx) / 2, (ry + ty) / 2, z), a)
    placed(box(name + "_collar", (0, 0, 0), (0.9, 1.25, 1.25), hull, chamfer=0.25),
           (rx + dx * 0.5, ry + dy * 0.5, z), a)
    placed(box(name + "_root", (0, 0, 0), (0.7, 1.5, 1.4), trim, chamfer=0.3), (rx + dx * 0.12, ry + dy * 0.12, z), a)
    # the pod body, built along +X at the origin then turned
    st = [(-2.4, 0.5, 0.5, 0.22, 0, 0), (-1.9, 0.75, 0.72, 0.32, 0, 0), (1.5, 0.75, 0.72, 0.32, 0, 0),
          (2.8, 0.5, 0.46, 0.22, 0, -0.1), (3.6, 0.18, 0.15, 0.08, 0, -0.18)]
    placed(loft(name + "_pod", st, hull), (tx, ty, z), yaw)
    placed(box(name + "_stripe", (0.0, 0.76, -0.12), (3.6, 0.04, 0.22), accent), (tx, ty, z), yaw)
    placed(box(name + "_glow", (0.2, 0.765, -0.42), (4.2, 0.03, 0.05), glow), (tx, ty, z), yaw)
    placed(box(name + "_glow_s", (0.2, -0.765, -0.42), (4.2, 0.03, 0.05), glow), (tx, ty, z), yaw)
    placed(box(name + "_turret", (-0.5, 0, 0.82), (1.6, 0.95, 0.35), hull, chamfer=0.15), (tx, ty, z), yaw)
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    spire(tx - 0.5 * c, ty - 0.5 * s, z + 0.99, 0.15, 1.3, hull)


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
         hull, bevel=0.03)
    loft("keel", [(-9.5, 1.5, 0.4, 0.25, 0, -1.6), (5.5, 1.3, 0.35, 0.2, 0, -1.55), (8.0, 0.6, 0.2, 0.12, 0, -1.2)],
         trim)
    # flank livery: orange sweep with the blue light line beneath it
    box("flank_orange", (-3.0, W + 0.01, 0.2), (13.0, 0.04, 0.5), accent)
    loft("bow_orange", [(3.5, 0.02, 0.19, 0, W + 0.01, 0.15), (7.0, 0.02, 0.15, 0, 2.01, 0.0)], accent)
    box("flank_glow", (-3.0, W + 0.02, -0.18), (13.0, 0.04, 0.06), glow)
    loft("bow_glow", [(3.5, 0.02, 0.03, 0, W + 0.02, -0.18), (7.0, 0.02, 0.03, 0, 2.02, -0.3)], glow)
    box("flank_dark", (-3.0, W + 0.005, -0.55), (13.0, 0.03, 0.3), trim)

    # dorsal deck carrying the dome
    loft("deck", [(-6.0, 1.5, 0.3, 0.2, 0, 1.6), (-4.5, 2.0, 0.35, 0.2, 0, 1.7), (4.5, 2.0, 0.35, 0.2, 0, 1.7),
                  (6.5, 1.2, 0.2, 0.15, 0, 1.55)], hull, bevel=0.02)
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
    cyl("lantern_glow", (DX, 0, z + 0.3), 0.34, 0.12, glow, sides=8, axis="Z")
    cyl("lantern_roof", (DX, 0, z + 0.75), 0.4, 0.3, trim, sides=8, axis="Z", r1=0.1)
    cyl("dome_spire", (DX, 0, z + 1.35), 0.08, 1.0, hull, sides=6, axis="Z", r1=0.01)
    # emblem discs: one on the dome's port flank, one on the bow flank
    em = placed(cyl("emblem", (0, 0, 0), 0.6, 0.06, gold, sides=10, axis="Y"), (DX + 0.3, 2.12, DZ + 1.35))
    em.rotation_euler = (math.radians(-28), 0, math.radians(-8))
    ec = placed(cyl("emblem_core", (0, 0.04, 0), 0.35, 0.04, trim, sides=8, axis="Y"), (DX + 0.3, 2.12, DZ + 1.35))
    ec.rotation_euler = (math.radians(-28), 0, math.radians(-8))

    # stern cowl: the raised, rounded aft crown that carries the second emblem (ref: above the engines)
    loft("cowl", [(-10.45, 1.6, 0.35, 0.3, 0, 1.45), (-9.4, 2.0, 0.65, 0.5, 0, 1.55), (-4.2, 2.0, 0.65, 0.5, 0, 1.55),
                  (-2.4, 1.4, 0.3, 0.25, 0, 1.6)], hull, bevel=0.02)
    box("cowl_orange", (-6.8, 2.01, 1.55), (5.0, 0.04, 0.22), accent)
    b = placed(cyl("stern_emblem", (0, 0, 0), 0.85, 0.05, gold, sides=10, axis="Z"), (-7.0, 0.95, 2.21))
    b.rotation_euler = (math.radians(10), 0, 0)
    b2 = placed(cyl("stern_emblem_core", (0, 0, 0), 0.5, 0.05, trim, sides=8, axis="Z"), (-7.0, 0.97, 2.25))
    b2.rotation_euler = (math.radians(10), 0, 0)

    # crown of spires around the dome
    for ang, h in ((15, 1.8), (55, 2.3), (95, 2.6), (135, 2.3), (170, 1.8)):
        a = math.radians(ang)
        spire(DX + 3.1 * math.cos(a), 2.85 * math.sin(a) + 0.15, 1.85, 0.16, h, hull)

    # fore cathedral block with the tallest spires
    box("fore_tower", (5.6, 1.0, 2.0), (2.6, 1.6, 0.8), hull, chamfer=0.25, bevel=0.02)
    spire(6.2, 1.2, 2.4, 0.24, 3.4, hull)
    spire(4.9, 1.45, 2.4, 0.18, 2.5, hull)
    spire(5.4, 0.35, 2.4, 0.2, 2.8, hull)
    box("fore_tower_glow", (5.6, 1.81, 2.0), (2.2, 0.03, 0.06), glow)

    # radiating spokes: barrels out to gun-pods (fore pods sweep forward, aft pods sweep aft)
    spokes = [((6.0, 2.0), (7.4, 5.0), 0.0, 14), ((2.2, 2.4), (2.8, 6.0), -0.1, 5),
              ((-2.0, 2.4), (-2.4, 6.1), -0.2, -4), ((-5.8, 2.4), (-7.0, 5.4), -0.1, -12)]
    for i, (root, tip, z, yaw) in enumerate(spokes):
        pod(f"spoke{i}", root, tip, z, yaw, hull, trim, accent, glow)

    # stern: dark engine frame and the 2 x 4 nozzle block (port half: two columns x two rows)
    loft("engine_frame", [(-10.9, 2.25, 1.25, 0.6, 0, -0.05), (-10.45, 2.3, 1.3, 0.62, 0, -0.05)], trim)
    loft("engine_rim", [(-10.55, 2.42, 1.42, 0.68, 0, -0.05), (-10.4, 2.42, 1.42, 0.68, 0, -0.05)], accent)
    for y in (0.55, 1.62):
        for zz in (0.5, -0.6):
            engine((-11.4, y, zz), 0.44, trim, depth=0.6, sides=10)


if __name__ == "__main__":
    build("collective", make)
