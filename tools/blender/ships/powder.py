"""Powder capital ship — low-poly, from ref/powder.jpg.

    python3 tools/blender/ships/powder.py [out_dir] [--no-render]

Read of the reference: a flying cathedral-fortress. A long, blunt bronze-brown stone hull carries a stepped
ziggurat of terraces that climbs to a tall central spire with a red tip, ringed by a few lesser spires; deck
turrets on the lower terraces; long red heraldic banners with gold emblems hang down the flanks and the
ziggurat's front; rows of small amber windows. Modelled port-side + centreline only — the build mirrors it.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import box, build, cyl, engine, loft, mat  # noqa: E402


def spire(name, x, y, z0, r, h, stone, tip=None, sides=6):
    """A stepped spire: a short square base, a tapered shaft and a needle cap."""
    box(name + "_base", (x, y, z0 + h * 0.12), (r * 2.4, r * 2.4, h * 0.24), stone)
    cyl(name + "_shaft", (x, y, z0 + h * 0.24 + h * 0.3), r, h * 0.6, stone, sides=sides, axis="Z", r1=r * 0.55)
    cyl(name + "_cap", (x, y, z0 + h * 0.84 + h * 0.08), r * 0.6, h * 0.16 + 0.02, tip or stone, sides=4, axis="Z",
        r1=0.02)


def banner(name, x, y, ztop, length, width, cloth, gold, face="Y"):
    """A hanging banner (thin box) with a gold emblem square and a pointed tail."""
    if face == "Y":
        box(name, (x, y, ztop - length / 2), (width, 0.05, length), cloth)
        loft(name + "_tail", [(ztop - length, width / 2, 0.025, 0, x, y), (ztop - length - width * 0.45, 0.02, 0.025, 0, x, y)],
             cloth, axis="Z")
        box(name + "_emblem", (x, y + 0.04, ztop - length * 0.55), (width * 0.5, 0.03, width * 0.5), gold)
    else:  # hangs on a +X-facing wall
        box(name, (x, y, ztop - length / 2), (0.05, width, length), cloth)
        loft(name + "_tail", [(ztop - length, 0.025, width / 2, 0, x, y), (ztop - length - width * 0.45, 0.025, 0.02, 0, x, y)],
             cloth, axis="Z")
        box(name + "_emblem", (x + 0.04, y, ztop - length * 0.5), (0.03, width * 0.5, width * 0.5), gold)


def windows(prefix, x0, x1, y, z, n, glow, face="Y"):
    step = (x1 - x0) / max(n - 1, 1)
    for i in range(n):
        if face == "Y":    # row along X on a port-facing wall at y
            box(prefix, (x0 + i * step, y, z), (0.16, 0.04, 0.12), glow)
        else:              # row along Y on a bow-facing wall at x = y
            box(prefix, (y, x0 + i * step, z), (0.04, 0.16, 0.12), glow)


def make():
    stone = mat("hull", (0.115, 0.08, 0.045), rough=0.65, metal=0.2)      # bronze-brown stone
    dark = mat("trim", (0.045, 0.035, 0.025), rough=0.6, metal=0.3)        # soot-dark plating, turrets
    bronze = mat("bronze", (0.45, 0.3, 0.1), rough=0.4, metal=0.6)     # gilded edges, emblems
    cloth = mat("banner", (0.32, 0.025, 0.02), rough=0.8, metal=0.0)    # heraldic red
    glow = mat("glow", (0.6, 0.3, 0.05), emit=(1.0, 0.58, 0.18), strength=6)
    tipglow = mat("tip", (0.5, 0.05, 0.02), emit=(1.0, 0.16, 0.08), strength=9)

    # ── main hull: long, blunt, slightly deeper amidships ───────────────────────────────
    loft("hull", [(-10.8, 2.5, 0.9, 0.45, 0, 0.0), (-8.5, 2.9, 1.15, 0.55, 0, -0.05), (6.5, 2.9, 1.15, 0.55, 0, -0.05),
                  (9.6, 2.4, 1.0, 0.55, 0, 0.0), (11.2, 1.5, 0.7, 0.45, 0, 0.05)], stone, bevel=0.04)
    loft("keel", [(-9.5, 1.6, 0.5, 0.3, 0, -1.3), (-6, 2.1, 0.7, 0.4, 0, -1.45), (4.5, 2.1, 0.7, 0.4, 0, -1.45),
                  (8.5, 1.2, 0.4, 0.3, 0, -1.2)], dark)
    box("bow_face", (11.22, 0, 0.05), (0.06, 2.2, 0.75), dark)
    box("hull_band", (0, 2.92, -0.25), (15.0, 0.05, 0.35), dark)
    box("deck_rim", (-1.0, 2.6, 1.13), (18.5, 0.4, 0.12), bronze)
    # side casemates along the flank (reference: boxy gun galleries over the hull)
    for x in (-7.0, -2.0, 3.0, 7.6):
        box("casemate", (x, 2.75, 0.55), (2.6, 0.6, 0.7), stone, chamfer=0.12)
        box("casemate_gun", (x + 1.55, 2.85, 0.6), (0.9, 0.12, 0.12), dark)
    windows("hull_win", -9.6, 9.4, 2.94, 0.2, 20, glow)
    windows("hull_win_lo", -8.0, 7.0, 2.94, -0.65, 12, glow)

    # ── stepped ziggurat terraces ──────────────────────────────────────────────────────
    tiers = [  # x0, x1, half-width, z0, z1
        (-9.2, 7.4, 2.35, 1.1, 2.0),
        (-7.4, 4.4, 1.9, 2.0, 3.1),
        (-5.8, 2.4, 1.45, 3.1, 4.3),
        (-4.4, 0.8, 1.05, 4.3, 5.6),
        (-3.4, -0.6, 0.72, 5.6, 7.0),
    ]
    for i, (x0, x1, w, z0, z1) in enumerate(tiers):
        box(f"tier{i}", ((x0 + x1) / 2, 0, (z0 + z1) / 2), (x1 - x0, 2 * w, z1 - z0), stone, chamfer=0.1)
        box(f"tier{i}_cornice", ((x0 + x1) / 2, w - 0.05, z1 + 0.04), (x1 - x0 + 0.1, 0.22, 0.08), bronze)
        windows(f"tier{i}_win", x0 + 0.5, x1 - 0.5, w + 0.01, (z0 + z1) / 2, max(4, int((x1 - x0) / 1.1)), glow)
        windows(f"tier{i}_fwin", 0.35, w - 0.3, x1 + 0.01, (z0 + z1) / 2, 2, glow, face="X")
    # gatehouse: a tall flat wall on the ziggurat's front that carries the great banner
    box("gatehouse", (1.8, 0, 3.75), (1.6, 1.5, 3.3), stone, chamfer=0.12)
    box("gatehouse_cap", (1.8, 0, 5.5), (1.8, 1.7, 0.2), bronze)
    for x in (2.75, 3.6):   # flying buttresses running down to the terraces
        box("buttress", (x, 0.6, 3.6 - (x - 2.75) * 0.8), (0.9, 0.18, 0.5), stone)
    # forward gun terrace on the bow deck
    box("bow_terrace", (8.6, 0, 1.45), (2.6, 3.4, 0.7), stone, chamfer=0.15)
    windows("bow_win", 7.6, 9.6, 1.71, 1.45, 3, glow)

    # ── turrets on the terraces ────────────────────────────────────────────────────────
    def turret(name, x, y, z, s=1.0):
        box(name, (x, y, z + 0.22 * s), (1.0 * s, 0.8 * s, 0.44 * s), dark, chamfer=0.12 * s)
        for dy in (-0.15, 0.15):
            cyl(name + "_barrel", (x + 0.95 * s, y + dy * s, z + 0.26 * s), 0.06 * s, 1.0 * s, dark, sides=4)

    turret("turret_bow", 8.4, 1.0, 1.8)
    turret("turret_bow_c", 6.6, 0.0, 2.0, 1.15)
    turret("turret_t1", 4.6, 1.5, 2.0)
    turret("turret_t1b", 1.0, 1.9, 2.0, 0.9)
    turret("turret_t2", 3.4, 1.4, 3.1, 0.85)
    turret("turret_aft", -8.4, 1.4, 2.0, 0.9)

    # ── spires: one great central spire and a handful of lesser ones ──────────────────────
    spire("spire_main", -2.0, 0, 7.0, 0.62, 6.2, stone, tip=tipglow, sides=6)
    for z, r in ((8.6, 0.55), (10.0, 0.45)):  # bronze rings up the main spire
        cyl("spire_ring", (-2.0, 0, z), r, 0.12, bronze, sides=6, axis="Z")
    cyl("spire_needle", (-2.0, 0, 13.6), 0.05, 0.9, tipglow, sides=4, axis="Z")
    spire("spire_flank", -2.9, 0.95, 5.6, 0.36, 3.8, stone, tip=bronze)
    spire("spire_t3", 0.0, 0.85, 5.6, 0.3, 2.8, stone, tip=bronze)
    spire("spire_t2", -4.9, 1.15, 4.3, 0.32, 3.2, stone, tip=bronze)
    spire("spire_gate", 1.8, 0.55, 5.6, 0.24, 2.0, stone, tip=bronze)
    spire("spire_aft", -6.7, 1.5, 3.1, 0.3, 2.8, stone, tip=bronze)
    spire("spire_t1", 3.9, 1.6, 3.1, 0.26, 2.2, stone, tip=bronze)
    spire("spire_stern", -8.6, 0.0, 2.0, 0.3, 2.4, stone, tip=bronze)

    # ── red heraldic banners ────────────────────────────────────────────────────────────
    banner("banner_front", 2.63, 0.0, 5.3, 1.75, 1.1, cloth, bronze, face="X")      # the great banner
    banner("banner_spire", -0.57, 0.0, 6.9, 1.0, 0.5, cloth, bronze, face="X")
    for x in (-7.0, -2.0, 3.0, 7.6):                                                 # flank banners on the galleries
        banner("banner_flank", x, 3.08, 0.85, 2.3, 0.8, cloth, bronze)
    banner("banner_t1", -2.6, 1.93, 2.95, 1.0, 0.55, cloth, bronze)
    banner("banner_t2", 0.6, 1.48, 4.15, 0.9, 0.5, cloth, bronze)

    # ── stern engines ──────────────────────────────────────────────────────────────────
    box("stern_block", (-10.95, 0, -0.1), (0.3, 4.6, 1.6), dark)
    engine((-11.1, 1.65, 0.0), 0.5, dark)
    engine((-11.1, 0.5, 0.25), 0.42, dark)
    engine((-11.1, 1.1, -0.85), 0.34, dark)


if __name__ == "__main__":
    build("powder", make)
