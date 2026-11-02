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
from common import box, build, cyl, engine, loft, mat  # noqa: E402

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


def stack(name, x, y, z, r, height, hull, trim):
    """Smokestack: tapered stack, banded collar, flared lip, small cap."""
    cyl(name, (x, y, z + height / 2), r, height, hull, sides=8, axis="Z", r1=r * 0.78)
    cyl(name + "_base", (x, y, z + 0.15), r * 1.35, 0.3, trim, sides=8, axis="Z")
    cyl(name + "_ring", (x, y, z + height * 0.55), r * 0.98, 0.14, trim, sides=8, axis="Z")
    cyl(name + "_lip", (x, y, z + height + 0.08), r * 0.95, 0.18, trim, sides=8, axis="Z", r1=r * 1.05)
    cyl(name + "_cap", (x, y, z + height + 0.3), r * 0.45, 0.28, hull, sides=6, axis="Z", r1=r * 0.2)


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
    loft("slime_c", [(-8.8, 1.55, 0.14, 0.1, 0, CZ + CH - 0.02), (9.2, 1.55, 0.14, 0.1, 0, CZ + CH - 0.02)],
         slime)
    loft("slime_s", [(-8.0, 1.25, 0.14, 0.1, SY, SZ + SH - 0.02), (8.0, 1.25, 0.14, 0.1, SY, SZ + SH - 0.02)],
         slime)
    # slime oozing along the seam between the centre and side tanks
    loft("slime_seam", [(-8.6, 0.55, 0.22, 0.15, 2.05, 2.15), (8.6, 0.55, 0.22, 0.15, 2.05, 2.15)], slime)
    for i, x in enumerate((-6.6, -2.9, 1.6, 5.8)):    # runs down the flanks of the side tank
        box(f"slime_run{i}", (x, SY + SW - 0.25, SZ + 0.9), (0.5, 0.35, 1.6), slime, chamfer=0.1)

    # ── smokestacks ───────────────────────────────────────────────────────────────
    top_c = CZ + CH + 0.1
    for i, (x, h) in enumerate(((7.0, 2.1), (2.0, 2.8), (-3.4, 2.4), (-7.6, 1.9))):
        stack(f"stack_c{i}", x, 0.0, top_c, 0.42, h, hull, trim)
    top_s = SZ + SH + 0.1
    for i, (x, h) in enumerate(((5.6, 1.8), (1.0, 2.2), (-3.6, 1.9), (-7.4, 1.5))):
        stack(f"stack_s{i}", x, SY, top_s, 0.36, h, hull, trim)
    for i, x in enumerate((4.6, -0.6, -5.4)):         # small vent stubs between the big stacks
        cyl(f"vent{i}", (x, 1.15, CZ + CH + 0.25), 0.16, 0.5, trim, sides=6, axis="Z")
        cyl(f"vent_s{i}", (x + 1.1, SY + 0.9, SZ + SH + 0.2), 0.13, 0.4, trim, sides=6, axis="Z")
    # dorsal dome (the hatch-domes on the reference's upper tanks)
    cyl("dome", (9.0, 0.0, top_c + 0.2), 0.75, 0.5, hull, sides=8, axis="Z", r1=0.45)

    # ── green glow ports ───────────────────────────────────────────────────────────
    for x in (-7.2, -3.2, 2.4, 6.6):
        box("port_s", (x, SY + SW + 0.01, SZ + 0.15), (0.9, 0.04, 0.14), glow)
    for x in (-6.8, -1.8, 3.6):
        box("port_c", (x, CW * 0.72, CZ + CH - 0.05), (0.7, 0.12, 0.1), glow)

    # ── hanging drips ───────────────────────────────────────────────────────────────
    side_bot = SZ - SH + 0.15
    cen_bot = -2.0 - 0.75
    drips = [(-8.6, SY + 0.6, side_bot + 0.25, 1.1, 0.22), (-7.1, SY + 1.3, side_bot + 0.5, 1.6, 0.24),
             (-5.5, SY + 0.2, side_bot, 2.0, 0.28), (-3.9, SY + 1.1, side_bot + 0.3, 1.2, 0.2),
             (-2.3, SY - 0.3, side_bot, 2.4, 0.3), (-0.7, SY + 1.4, side_bot + 0.6, 1.4, 0.22),
             (0.9, SY + 0.5, side_bot, 1.8, 0.26), (2.5, SY + 1.2, side_bot + 0.4, 1.0, 0.2),
             (4.1, SY - 0.2, side_bot, 2.2, 0.28), (5.7, SY + 1.0, side_bot + 0.3, 1.5, 0.24),
             (7.3, SY + 0.4, side_bot + 0.1, 1.9, 0.26), (8.7, SY + 1.4, side_bot + 0.7, 0.9, 0.2),
             (-7.8, 1.2, cen_bot, 1.4, 0.24), (-4.6, 1.7, cen_bot, 2.0, 0.28), (-1.4, 0.9, cen_bot, 2.6, 0.3),
             (1.8, 1.8, cen_bot, 1.6, 0.24), (5.0, 1.0, cen_bot, 2.2, 0.28), (7.9, 1.6, cen_bot, 1.2, 0.22)]
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
