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
from common import DECK, barrel, box, build, cyl, engine, loft, mast, mat, window_row  # noqa: E402


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


def windows(name, segs, y, zs, pitch, glow):
    """Standard windows on a port-facing wall at y: one row per deck height in `zs`, over each (x0, x1)
    segment of wall (gaps leave room for banners and casemates), about one window per `pitch`."""
    for k, z in enumerate(zs):
        for j, (x0, x1) in enumerate(segs):
            window_row(f"{name}_{k}_{j}", (x0, y, z), (x1, y, z), glow, count=max(1, round((x1 - x0) / pitch)))


def make():
    stone = mat("hull", (0.115, 0.08, 0.045), rough=0.65, metal=0.2)      # bronze-brown stone
    dark = mat("trim", (0.045, 0.035, 0.025), rough=0.6, metal=0.3)        # soot-dark plating, turrets
    bronze = mat("bronze", (0.62, 0.42, 0.12), rough=0.4, metal=0.6)     # gilded edges, emblems
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
        barrel("gun_m_casemate", (x + 1.55, 2.85, 0.6), 0.9, dark, size="m")
        windows("win_casemate", [(x - 1.15, x - 0.5), (x + 0.5, x + 1.15)], 3.05, (0.55,), 1.0, glow)
    # hull decks: one row above the dark band, one below; gaps where the flank banners hang
    hull_segs = [(-8.3, -7.5), (-6.5, -2.5), (-1.5, 2.5), (3.5, 6.3)]
    windows("win_hull", hull_segs, 2.9, (0.0,), 0.8, glow)
    windows("win_hull_lo", hull_segs, 2.9, (-0.55,), 1.6, glow)

    # ── stepped ziggurat terraces ──────────────────────────────────────────────────────
    tiers = [  # x0, x1, half-width, z0, z1
        (-9.2, 7.4, 2.35, 1.1, 1.8),
        (-7.4, 4.4, 1.9, 1.8, 2.7),
        (-5.8, 2.4, 1.45, 2.7, 3.6),
        (-4.4, 0.8, 1.05, 3.6, 4.6),
        (-3.4, -0.6, 0.72, 4.6, 5.6),
    ]
    for i, (x0, x1, w, z0, z1) in enumerate(tiers):
        box(f"tier{i}", ((x0 + x1) / 2, 0, (z0 + z1) / 2), (x1 - x0, 2 * w, z1 - z0), stone, chamfer=0.1)
        box(f"tier{i}_cornice", ((x0 + x1) / 2, w - 0.05, z1 + 0.04), (x1 - x0 + 0.1, 0.22, 0.08), bronze)
        zc = (z0 + z1) / 2                                             # two decks of windows per terrace
        windows(f"win_tier{i}", [(x0 + 0.2, x1 - 0.2)], w, (zc - DECK / 2, zc + DECK / 2), 1.6, glow)
        if i in (1, 3, 4):                                             # fronts not masked by gatehouse/bow terrace
            window_row(f"win_tier{i}_front", (x1, 0.05, zc), (x1, w - 0.2, zc), glow, face="x",
                       count=max(1, round((w - 0.25) / 0.8)))
    # gatehouse: a tall flat wall on the ziggurat's front that carries the great banner
    box("gatehouse", (1.8, 0, 3.4), (1.6, 1.5, 2.8), stone, chamfer=0.12)
    box("gatehouse_cap", (1.8, 0, 4.88), (1.8, 1.7, 0.2), bronze)
    for x in (2.75, 3.6):   # flying buttresses running down to the terraces
        box("buttress", (x, 0.6, 3.1 - (x - 2.75) * 0.8), (0.9, 0.18, 0.5), stone)
    # forward gun terrace on the bow deck
    box("bow_terrace", (8.6, 0, 1.45), (2.6, 3.4, 0.7), stone, chamfer=0.15)
    window_row("win_bow", (7.5, 1.7, 1.45), (9.7, 1.7, 1.45), glow, count=4)

    # ── turrets on the terraces ────────────────────────────────────────────────────────
    def turret(name, x, y, z, s=1.0, cal="m"):
        box(name, (x, y, z + 0.22 * s), (1.0 * s, 0.8 * s, 0.44 * s), dark, chamfer=0.12 * s)
        for dy in ((0.15,) if y == 0 else (-0.15, 0.15)):              # centreline turret: the mirror adds the twin
            barrel(f"gun_{cal}_{name}", (x + 0.95 * s, y + dy * s, z + 0.26 * s), 1.0 * s, dark, size=cal)

    turret("turret_bow", 8.4, 1.0, 1.8)
    turret("turret_bow_c", 6.6, 0.0, 1.8, 1.15, cal="l")
    turret("turret_t1", 4.6, 1.5, 1.8)
    turret("turret_t1b", 1.0, 1.9, 1.8, 0.9)
    turret("turret_t2", 3.4, 1.4, 2.7, 0.85)
    turret("turret_aft", -8.4, 1.4, 1.8, 0.9)

    # ── spires: one great central spire and a handful of lesser ones ──────────────────────
    spire("spire_main", -2.0, 0, 5.6, 0.62, 4.8, stone, tip=tipglow, sides=6)
    for z, r in ((6.9, 0.55), (7.9, 0.45)):  # bronze rings up the main spire
        cyl("spire_ring", (-2.0, 0, z), r, 0.12, bronze, sides=6, axis="Z")
    mast("mast_spire_needle", -2.0, 0, 10.25, 0.6, tipglow)
    spire("spire_flank", -2.9, 0.95, 4.6, 0.36, 3.2, stone, tip=bronze)
    spire("spire_t3", 0.0, 0.85, 4.6, 0.3, 2.4, stone, tip=bronze)
    spire("spire_t2", -4.9, 1.15, 3.6, 0.32, 2.8, stone, tip=bronze)
    spire("spire_gate", 1.8, 0.55, 4.98, 0.24, 1.6, stone, tip=bronze)
    spire("spire_aft", -6.7, 1.5, 2.7, 0.3, 2.4, stone, tip=bronze)
    spire("spire_t1", 3.9, 1.6, 2.7, 0.26, 2.0, stone, tip=bronze)
    spire("spire_stern", -8.6, 0.0, 1.8, 0.3, 2.2, stone, tip=bronze)

    # ── red heraldic banners ────────────────────────────────────────────────────────────
    banner("banner_front", 2.63, 0.0, 4.75, 1.65, 1.35, cloth, bronze, face="X")      # the great banner
    banner("banner_spire", -0.57, 0.0, 5.5, 0.8, 0.5, cloth, bronze, face="X")
    for x in (-7.0, -2.0, 3.0, 7.6):                                                 # flank banners on the galleries
        banner("banner_flank", x, 3.08, 0.85, 2.3, 0.8, cloth, bronze)
    banner("banner_t1", -2.6, 1.93, 2.65, 0.75, 0.55, cloth, bronze)
    banner("banner_t2", 0.6, 1.48, 3.55, 0.75, 0.5, cloth, bronze)

    # ── stern engines ──────────────────────────────────────────────────────────────────
    box("stern_block", (-10.95, 0, -0.1), (0.3, 4.6, 1.6), dark)
    engine((-11.1, 1.65, 0.0), 0.5, dark)
    engine((-11.1, 0.5, 0.25), 0.42, dark)
    engine((-11.1, 1.1, -0.85), 0.34, dark)


if __name__ == "__main__":
    build("powder", make)
