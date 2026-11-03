"""Green (chem) capital ship — low-poly, from ref/green.jpg.

    python3 tools/blender/ships/green.py [out_dir] [--no-render]

Read of the reference: three fat fused chemical tanks lying side by side along the length (one on the
centreline, a mirrored pair), each built from octagonal segments with dark banded rings and blunt
octagonal end caps; rows of tall smokestacks on top; slime coating the upper hull and dripping from the
belly. Olive/army green, lighter slime green, dark metal bands, small green glow ports. Painted text and
logos are skipped. Modelled port-side + centreline only — the build mirrors it.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DECK, box, build, cyl, engine, loft, mat, window_row  # noqa: E402

OCT = 0.41  # chamfer / half-size ratio that makes a near-regular octagon


def tank(name, y, z, w, h, x0, x1, hull, trim, waists):
    """Octagonal tank of fused bulging segments: tapered blunt caps at both ends, a pinched waist with a
    dark ring band at each x in waists."""
    def st(x, k):
        return (x, w * k, h * k, OCT * min(w, h) * k, y, z)
    c = OCT * min(w, h)
    sts = [st(x0, 0.5), st(x0 + 0.45, 0.8), st(x0 + 1.2, 0.97)]
    for x in waists:
        sts += [st(x - 0.9, 1.0), st(x - 0.25, 0.9), st(x + 0.25, 0.9), st(x + 0.9, 1.0)]
    sts += [st(x1 - 1.2, 0.97), st(x1 - 0.45, 0.8), st(x1, 0.5)]
    loft(name, sts, hull)
    for x in waists:                                  # banded ring segments in the pinched waists
        loft(name + "_band", [st(x - 0.2, 0.93), st(x + 0.2, 0.93)], trim)
    for x in (x0 + 1.2, x1 - 1.2):                    # collar where the cap meets the barrel
        loft(name + "_collar", [st(x - 0.14, 1.02), st(x + 0.14, 1.02)], trim)
    for x, sg in ((x0 - 0.03, 1), (x1 + 0.03, -1)):   # dark hub plates on both caps
        loft(name + "_hub", [(x, w * 0.28, h * 0.28, c * 0.28, y, z), (x + sg * 0.08, w * 0.28, h * 0.28, c * 0.28, y, z)],
             trim)


def stack(name, x, y, z, r, height, hull, trim, sides=8):
    """Standard smokestack (⌀ 6–11 m): tapered tube with a flared lip. Only the tube carries the stack_ class."""
    cyl("stack_" + name, (x, y, z + height / 2), r, height, hull, sides=sides, axis="Z", r1=r * 0.82)
    cyl("stk_" + name + "_lip", (x, y, z + height + 0.06), r * 0.9, 0.14, trim, sides=sides, axis="Z", r1=r * 1.08)


def stack_cluster(name, x, y, z, tall, hull, trim, centre):
    """The reference's big stacks as a cluster of standard stacks on a shared plinth. centre=True: one tall
    stack on y=0 plus a mirrored pair behind it; otherwise (port side, mirrored) a staggered pair."""
    if centre:
        box("stk_" + name + "_plinth", (x - 0.2, 0.0, z), (1.1, 1.0, 0.5), trim)
        stack(name + "a", x, 0.0, z + 0.22, 0.23, tall, hull, trim)
        stack(name + "b", x - 0.42, 0.3, z + 0.22, 0.18, tall * 0.62, hull, trim, sides=6)
    else:
        box("stk_" + name + "_plinth", (x + 0.15, y, z), (0.95, 0.8, 0.5), trim)
        stack(name + "a", x, y - 0.18, z + 0.22, 0.21, tall, hull, trim)
        stack(name + "b", x + 0.36, y + 0.2, z + 0.22, 0.17, tall * 0.65, hull, trim, sides=6)


def drip(name, x, y, ztop, length, r, slime):
    """Hanging tapered prism of slime: wide at the hull, pointed at the tip."""
    cyl(name, (x, y, ztop - length / 2 + 0.05), r * 0.15, length, slime, sides=4, axis="Z", r1=r)


def make():
    hull = mat("hull", (0.10, 0.12, 0.035), rough=0.55, metal=0.2)     # olive / army green
    trim = mat("trim", (0.05, 0.06, 0.04), rough=0.4, metal=0.45)     # dark metal bands
    slime = mat("slime", (0.50, 0.62, 0.05), rough=0.3, metal=0.0)   # lighter slime green
    glow = mat("glow", (0.3, 0.6, 0.1), emit=(0.35, 1.0, 0.08), strength=3)

    # ── the three tanks ───────────────────────────────────────────────────────────
    CW, CH, CZ = 2.5, 2.4, 0.4          # centre tank half-width / half-height / centre z
    tank("tank_c", 0.0, CZ, CW, CH, -10.6, 10.8, hull, trim, (-5.4, -0.6, 4.4))
    SY, SZ, SW, SH = 4.0, -0.35, 2.05, 2.0   # side tank (port; mirrored), fused into the centre one
    tank("tank_s", SY, SZ, SW, SH, -9.8, 9.6, hull, trim, (-4.6, 0.3, 5.0))

    # saddle filling the valley between the tanks
    loft("saddle", [(-8.4, 0.6, 0.9, 0.3, 2.0, 1.2), (8.2, 0.6, 0.9, 0.3, 2.0, 1.2)], hull)
    loft("belly", [(-8.6, 3.0, 0.9, 0.5, 0, -2.0), (8.6, 3.0, 0.9, 0.5, 0, -2.0)], hull)

    # ── slime coat on the upper hull ────────────────────────────────────────────────
    # irregular patches rather than one sheet, so the olive hull still shows between them
    for i, (x0, x1, y, w) in enumerate(((-9.0, -6.2, 0.5, 1.0), (-5.0, -1.4, 0.9, 0.62), (-0.2, 3.0, 0.4, 1.05),
                                        (3.8, 5.6, 1.0, 0.5), (6.4, 9.4, 0.6, 0.9))):
        loft(f"slime_c{i}", [(x0, w, 0.12, 0.08, y, CZ + CH - 0.02), (x1, w, 0.12, 0.08, y, CZ + CH - 0.02)], slime)
    for i, (x0, x1, y, w) in enumerate(((-8.4, -5.6, 0.7, 0.55), (-4.2, -0.4, 0.4, 0.75), (1.6, 4.4, 0.8, 0.45),
                                        (6.0, 8.6, 0.3, 0.7))):
        loft(f"slime_s{i}", [(x0, w, 0.12, 0.08, SY + y, SZ + SH - 0.02), (x1, w, 0.12, 0.08, SY + y, SZ + SH - 0.02)],
             slime)
    # slime oozing along the seam between the centre and side tanks
    loft("slime_seam", [(-8.6, 0.55, 0.22, 0.15, 2.05, 2.15), (8.6, 0.55, 0.22, 0.15, 2.05, 2.15)], slime)
    for i, x in enumerate((-6.6, -2.9, 1.6, 5.8)):    # runs down the flanks of the side tank
        box(f"slime_run{i}", (x, SY + SW - 0.25, SZ + 0.9), (0.5, 0.35, 1.6), slime, chamfer=0.1)

    # ── smokestacks ───────────────────────────────────────────────────────────────
    top_c = CZ + CH + 0.1
    for i, (x, h) in enumerate(((7.0, 2.1), (2.0, 2.8), (-3.4, 2.4), (-7.6, 1.9))):
        stack_cluster(f"c{i}", x, 0.0, top_c, h, hull, trim, centre=True)
    top_s = SZ + SH + 0.1
    for i, (x, h) in enumerate(((5.6, 1.8), (1.0, 2.2), (-3.6, 1.9), (-7.4, 1.5))):
        stack_cluster(f"s{i}", x, SY, top_s, h, hull, trim, centre=False)
    for i, x in enumerate((4.6, -0.6, -5.4)):         # small vent stubs between the stack clusters
        cyl(f"vent{i}", (x, 1.15, CZ + CH + 0.25), 0.16, 0.5, trim, sides=6, axis="Z")
    # dorsal dome (the hatch-domes on the reference's upper tanks)
    cyl("dome", (9.0, 0.0, top_c + 0.2), 0.75, 0.5, hull, sides=8, axis="Z", r1=0.45)

    # ── lit windows: standard 2 m windows in rows on deck pitch ──────────────────────
    # side tank's outer flat face (port; mirrored) — only on the full-bulge spans, so they sit on the hull
    face_y = SY + SW
    for k, (xc, n, decks) in enumerate(((-6.5, 5, 1), (-2.2, 6, 2), (2.6, 6, 2), (6.9, 5, 1))):
        for d in range(decks):
            z = SZ + 0.1 + d * DECK
            window_row(f"win_side{k}_{d}", (xc - n * 0.11, face_y, z), (xc + n * 0.11, face_y, z), glow, count=n)
    # a short control row on the port face of each centre stack plinth
    for i, x in enumerate((7.0, 2.0, -3.4, -7.6)):
        window_row(f"win_plinth{i}", (x - 0.42, 0.5, top_c + 0.08), (x + 0.02, 0.5, top_c + 0.08), glow, count=2)

    # ── hanging drips ───────────────────────────────────────────────────────────────
    side_bot = SZ - SH + 0.15
    cen_bot = -2.0 - 0.75
    drips = [(-7.1, SY + 1.3, side_bot + 0.5, 1.6, 0.24), (-5.5, SY + 0.2, side_bot, 2.0, 0.28),
             (-2.3, SY - 0.3, side_bot, 2.4, 0.3), (0.9, SY + 0.5, side_bot, 1.8, 0.26),
             (4.1, SY - 0.2, side_bot, 2.2, 0.28), (7.3, SY + 0.4, side_bot + 0.1, 1.9, 0.26),
             (-4.6, 1.7, cen_bot, 2.0, 0.28), (-1.4, 0.9, cen_bot, 2.6, 0.3), (5.0, 1.0, cen_bot, 2.2, 0.28)]
    fy, fz = SY + 1.55, SZ - 1.45                     # drips off the outer lower flank (visible side-on)
    drips += [(x, fy, fz, ln, 0.2) for x, ln in ((-8.0, 1.3), (-6.2, 2.1), (-4.4, 1.0), (-1.6, 1.8), (0.2, 1.1),
                                                 (2.0, 2.3), (3.4, 1.2), (6.4, 1.7), (8.2, 1.0))]
    for i, (x, y, zt, ln, r) in enumerate(drips):
        drip(f"drip{i}", x, y, zt, ln, r, slime)
    # slime sheet the drips hang from
    loft("slime_belly", [(-9.0, 1.0, 0.12, 0.08, SY + 0.5, side_bot + 0.02),
                         (9.0, 1.0, 0.12, 0.08, SY + 0.5, side_bot + 0.02)], slime)

    # ── stern engines ───────────────────────────────────────────────────────────────
    box("stern_block", (-10.9, 0.0, -1.1), (0.8, 2.6, 1.4), trim, chamfer=0.25)
    engine((-11.3, 0.95, -1.1), 0.5, trim)
    engine((-10.2, SY, SZ), 0.72, trim)
    engine((-10.9, 0.0, CZ + 0.4), 0.55, trim)


if __name__ == "__main__":
    build("green", make)
