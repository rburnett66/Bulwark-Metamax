"""Artillery capital ship — low-poly, from ref/artillery.jpg.

    python3 tools/blender/ships/artillery.py [out_dir] [--no-render]

Read of the reference: a huge khaki armoured slab, a flying tank fortress. Thick chamfered hull with a
blunt rounded bow; stepped armour decks climbing aft to a fortress superstructure; rows of tank turrets
with long barrels along the forward decks (mirrored pairs plus centreline guns); clusters of spires and
thin antenna masts on top; yellow/black hazard trim; a few small amber windows. Modelled port-side +
centreline only — the build mirrors it.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DECK, barrel, box, build, cyl, engine, loft, mast, mat, window_row  # noqa: E402


def turret(name, x, y, z, s, hull, trim, accent, barrels=1, cal="l"):
    """Tank turret sitting on a deck at height z: ring, chamfered housing, mantlet, long barrel(s) to +X.
    Barrels are a standard calibre (`cal` 'l' heavy main gun, 'm' secondary) whatever the turret's size."""
    cyl(name + "_ring", (x, y, z + 0.12 * s), 0.78 * s, 0.24 * s, trim, sides=8, axis="Z")
    hz = z + 0.24 * s + 0.36 * s
    loft(name + "_house", [(x - 0.85 * s, 0.62 * s, 0.30 * s, 0.18 * s, y, hz),
                           (x + 0.25 * s, 0.68 * s, 0.36 * s, 0.22 * s, y, hz),
                           (x + 0.75 * s, 0.48 * s, 0.26 * s, 0.18 * s, y, hz - 0.04 * s)], hull, bevel=0.03)
    box(name + "_hazard", (x - 0.2 * s, y + 0.69 * s, hz), (0.6 * s, 0.03, 0.22 * s), accent)
    box(name + "_mantlet", (x + 0.85 * s, y, hz - 0.04 * s), (0.22 * s, 0.6 * s, 0.32 * s), trim)
    d = {"l": 0.22, "m": 0.12}[cal]
    # twin on the centreline: model only the port barrel, the build mirrors the starboard one
    offs = (0.0,) if barrels == 1 else ((0.17 * s,) if abs(y) < 1e-6 else (-0.17 * s, 0.17 * s))
    for i, dy in enumerate(offs):
        barrel(f"gun_{cal}_{name}_{i}", (x + 0.95 * s + 1.1 * s, y + dy, hz - 0.04 * s), 2.2 * s, hull, size=cal)
        cyl(f"{name}_muzzle{i}", (x + 0.95 * s + 2.2 * s, y + dy, hz - 0.04 * s), d * 0.85, 0.3 * s, trim,
            sides=4, axis="X")                         # square muzzle brake, a touch over the barrel


def pd_mount(name, x, y, z, hull, trim):
    """Small point-defence mount on a deck edge: squat base and a short 1.5 m barrel to +X."""
    box(name + "_base", (x, y, z + 0.06), (0.24, 0.22, 0.12), trim)
    cyl("gun_s_" + name, (x + 0.3, y, z + 0.09), 0.06 / 2 ** 0.5, 0.42, hull, sides=4, axis="X")  # square ⌀0.06


def spire(name, x, y, z, r, h, material):
    cyl(name, (x, y, z + h / 2), r, h, material, sides=4, axis="Z", r1=r * 0.15)


def make():
    hull = mat("hull", (0.44, 0.36, 0.15), rough=0.6, metal=0.1)      # khaki/olive armour
    dark = mat("trim", (0.22, 0.19, 0.09), rough=0.6, metal=0.2)       # darker olive plates
    hazard = mat("hazard", (0.85, 0.55, 0.04), rough=0.5, metal=0.1)    # yellow hazard bands
    black = mat("hazard_black", (0.04, 0.04, 0.035), rough=0.6, metal=0.1)
    amber = mat("amber", (0.6, 0.3, 0.05), emit=(1.0, 0.55, 0.15), strength=6)

    # ── main slab hull: blunt rounded bow, flat flanks, squared stern ──
    H, C = 1.25, 0.55
    loft("slab", [(-11.0, 3.5, 1.05, 0.5, 0, 0), (-9.8, 4.0, H, C, 0, 0), (7.0, 4.0, H, C, 0, 0),
                  (9.4, 3.6, 1.15, 0.7, 0, -0.05), (10.7, 2.7, 0.95, 0.75, 0, -0.15),
                  (11.3, 1.6, 0.7, 0.5, 0, -0.25)], hull, bevel=0.04)
    loft("belly", [(-10.4, 2.9, 0.55, 0.3, 0, -1.55), (8.5, 2.9, 0.55, 0.3, 0, -1.55),
                   (10.0, 1.8, 0.4, 0.3, 0, -1.4)], dark)
    loft("keel", [(-9.0, 1.4, 0.4, 0.2, 0, -2.3), (5.0, 1.4, 0.4, 0.2, 0, -2.3), (6.6, 0.9, 0.25, 0.2, 0, -2.1)], hull)

    # side armour belt and skirts (port)
    box("belt", (-1.0, 4.03, -0.35), (16.5, 0.14, 0.75), dark, chamfer=0.05)
    for x in (-8.0, -3.0, 2.0):
        box("skirt", (x, 3.85, -1.2), (3.6, 0.5, 0.6), hull, chamfer=0.15)
    for i, x in enumerate((-6.8, -0.6, 5.2)):                            # hazard stripes on the flank
        box("flank_hz", (x, 4.06, 0.5), (2.6, 0.06, 0.5), hazard)
        for k in range(3):
            box("flank_hzb", (x - 0.8 + k * 0.8, 4.09, 0.5), (0.3, 0.04, 0.51), black)
    for k, x in enumerate((-9.0, -5.0, -2.2, 1.0, 3.8)):                  # amber window groups in the belt
        window_row(f"win_belt{k}", (x - 0.33, 4.10, -0.35), (x + 0.33, 4.10, -0.35), amber, count=3)

    # bow armour lip + hazard chevrons
    loft("bow_lip", [(9.0, 3.65, 0.22, 0.12, 0, 1.2), (10.4, 2.8, 0.2, 0.12, 0, 1.15)], dark)
    box("bow_hz", (10.6, 1.4, 0.55), (0.6, 0.9, 0.25), hazard)
    window_row("win_bow", (11.3, 0.4, -0.36), (11.3, 1.1, -0.36), amber, face="x", count=3)

    # ── stepped armour decks ──
    D1 = 1.25 + 0.6           # top of deck 1
    loft("deck1", [(-10.2, 3.2, 0.3, 0.2, 0, 1.55), (5.0, 3.2, 0.3, 0.2, 0, 1.55), (6.4, 2.4, 0.3, 0.25, 0, 1.5)],
         hull, bevel=0.03)
    box("deck1_hz", (-2.0, 3.22, 1.55), (5.0, 0.04, 0.16), hazard)
    D2 = D1 + 0.9             # top of deck 2
    loft("deck2", [(-9.6, 2.4, 0.45, 0.3, 0, D1 + 0.45), (1.6, 2.4, 0.45, 0.3, 0, D1 + 0.45),
                   (3.2, 1.6, 0.35, 0.3, 0, D1 + 0.35)], hull, bevel=0.03)
    box("deck2_band", (-4.0, 2.42, D1 + 0.45), (9.0, 0.05, 0.3), dark)
    for k, x in enumerate((-8.0, -5.5, -3.0, -0.5)):                      # window groups on the deck-2 band
        window_row(f"win_deck2_{k}", (x - 0.36, 2.445, D1 + 0.52), (x + 0.36, 2.445, D1 + 0.52), amber, count=3)
    D3 = D2 + 0.9             # fortress block
    loft("keep", [(-8.6, 1.5, 0.45, 0.3, 0, D2 + 0.45), (-1.4, 1.5, 0.45, 0.3, 0, D2 + 0.45),
                  (-0.4, 1.0, 0.35, 0.25, 0, D2 + 0.35)], hull, bevel=0.03)
    box("keep_hz", (-5.0, 1.52, D2 + 0.25), (3.0, 0.04, 0.2), hazard)
    for j in range(2):
        window_row(f"win_keep_{j}", (-0.4, 0.25, D2 + 0.36 + j * DECK), (-0.4, 0.65, D2 + 0.36 + j * DECK), amber,
                   face="x", count=2)

    # side bunkers on deck 1 (port)
    for x, l in ((-7.0, 2.4),):
        box("bunker", (x, 2.75, D1 + 0.35), (l, 0.8, 0.7), hull, chamfer=0.2)
        window_row("win_bunker", (x + l / 2, 2.5, D1 + 0.4), (x + l / 2, 3.0, D1 + 0.4), amber, face="x", count=2)

    # bridge tower + spires
    box("bridge", (-4.4, 0, D3 + 0.4), (2.4, 1.8, 0.8), hull, chamfer=0.25)
    box("bridge_top", (-4.6, 0, D3 + 1.0), (1.3, 1.1, 0.45), dark, chamfer=0.15)
    for j in range(2):                                                     # bridge glass: two decks forward
        window_row(f"win_bridge_f{j}", (-3.2, 0.0, D3 + 0.32 + j * DECK), (-3.2, 0.66, D3 + 0.32 + j * DECK), amber,
                   face="x", count=3)
    window_row("win_bridge_s", (-5.0, 0.9, D3 + 0.4), (-3.9, 0.9, D3 + 0.4), amber, count=3)
    spire("spire_c", -4.6, 0, D3 + 1.2, 0.35, 1.6, hull)
    mast("mast_c", -5.0, 0.3, D3 + 1.4, 2.0, dark)
    mast("mast_c2", -4.0, 0.35, D3 + 1.3, 1.4, dark)
    for x, y, z, r, h in ((-1.6, 0.9, D3, 0.5, 2.0), (-1.1, 0.45, D3 - 0.1, 0.32, 1.4),
                          (-7.4, 1.0, D3, 0.5, 2.3), (-6.9, 0.45, D3, 0.3, 1.5),
                          (-1.0, 2.0, D2, 0.45, 1.6), (-9.0, 2.0, D2, 0.45, 1.6)):
        box("spire_base", (x, y, z + 0.2), (r * 2.0, r * 2.0, 0.4), dark)
        spire("spire_" + f"{x:+.1f}{y:.1f}", x, y, z + 0.4, r, h, hull)
    for x, y, z, h in ((-7.9, 1.3, D3, 1.8), (-2.2, 1.2, D3, 1.6), (-8.4, 2.6, D2, 1.4), (1.0, 1.8, D2, 1.2)):
        mast(f"mast_{x:+.1f}", x, y, z, h, dark)

    # ── turrets: tank guns along the forward decks, aimed at the bow ──
    S = 1.0
    turret("t_bow", 7.0, 2.3, 1.25, 1.4, hull, dark, hazard)              # forward pair on the main deck
    turret("t_bow_c", 9.0, 0.0, 1.25, 1.0, hull, dark, hazard, cal="m")   # centreline bow gun
    turret("t_mid", 3.6, 2.1, D1, 1.35, hull, dark, hazard)               # second pair on deck 1
    turret("t_mid_c", 1.0, 0.0, D2, 1.3, hull, dark, hazard, barrels=2)   # centreline twin on deck 2
    turret("t_wing", -3.0, 2.7, D1, 0.95, hull, dark, hazard, cal="m")    # waist pair on deck 1
    turret("t_aft", -9.2, 2.55, D1, 0.75, hull, dark, hazard, cal="m")    # aft side guns
    for k, x in enumerate((-6.0, -1.6, 1.4)):                             # point defence along the deck edge
        pd_mount(f"pd{k}", x, 3.35, 1.25, hull, dark)
    box("deck_hz", (5.6, 0.7, 1.27), (1.2, 0.8, 0.04), hazard)

    # ── stern: engine block + nozzles ──
    box("stern_block", (-10.7, 2.2, 0.0), (0.8, 1.6, 1.8), dark, chamfer=0.2)
    engine((-11.2, 2.2, 0.35), 0.55, dark)
    engine((-11.2, 2.2, -0.65), 0.4, dark)
    engine((-11.1, 0.75, 0.0), 0.5, dark)


if __name__ == "__main__":
    build("artillery", make)
