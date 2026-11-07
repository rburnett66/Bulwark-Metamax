"""Cargo Shuttle — the ore lifter parked on the hub deck in the owner's outpost concept.  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/shuttle.py [out_dir] [--render]

From the concept crop ref/hub.jpg: a white chamfered fuselage with a dark canopy and orange nose stripes, swept
wings with orange tips, two side engine pods with lit intakes and two upright fins at the back. The hub carries a
parked copy as node `shuttle` (hub.py calls make_shuttle with prefix "shuttle__"); this standalone model is the
one the sell animation flies off the pad (outpost design §5, the manual sell tap). Front = -Y (nose).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, cyl, loft, mats, yloft  # noqa: E402


def make_shuttle(M, at=(0.0, 0.0, 0.0), p="shuttle__"):
    """Build the shuttle with its belly at `at` (x, y, z). Every part is named p + part, so the hub's copy lands
    in one node. Returns nothing; anchors are added by the caller."""
    ox, oy, oz = at
    # fuselage: white chamfered hull, tapering to a pointed nose at -Y
    yloft(p + "hull", [
        (oy - 1.28, 0.05, 0.04, 0.02, ox, oz + 0.34),
        (oy - 1.0, 0.2, 0.15, 0.07, ox, oz + 0.34),
        (oy - 0.55, 0.3, 0.22, 0.1, ox, oz + 0.36),
        (oy + 0.35, 0.33, 0.26, 0.11, ox, oz + 0.38),
        (oy + 0.95, 0.27, 0.22, 0.09, ox, oz + 0.38),
        (oy + 1.18, 0.19, 0.16, 0.06, ox, oz + 0.38),
    ], M["white"])
    # dark canopy, light dorsal spine, orange nose stripes
    yloft(p + "canopy", [
        (oy - 0.95, 0.06, 0.03, 0.02, ox, oz + 0.5),
        (oy - 0.7, 0.15, 0.06, 0.03, ox, oz + 0.56),
        (oy - 0.25, 0.17, 0.07, 0.03, ox, oz + 0.6),
    ], M["glass"])
    box(p + "spine", (ox, oy + 0.4, oz + 0.65), (0.22, 1.05, 0.06), M["light"], chamfer=0.02)
    for sx in (-1, 1):
        box(p + f"nose_stripe_{sx}", (ox + sx * 0.235, oy - 0.62, oz + 0.38), (0.03, 0.42, 0.05), M["trim"])
        box(p + f"flank_stripe_{sx}", (ox + sx * 0.33, oy + 0.35, oz + 0.46), (0.02, 0.5, 0.04), M["trim"])
    box(p + "tail_plate", (ox, oy + 1.19, oz + 0.38), (0.26, 0.04, 0.2), M["mid"])
    box(p + "tail_glow", (ox, oy + 1.215, oz + 0.38), (0.16, 0.02, 0.1), M["glow"])

    for sx in (-1, 1):
        # engine pods with lit intakes at the front and nozzles at the back
        ex = ox + sx * 0.5
        cyl(p + f"pod_{sx}", (ex, oy + 0.25, oz + 0.3), 0.16, 1.0, M["light"], sides=8, axis="Y")
        cyl(p + f"pod_ring_{sx}", (ex, oy - 0.24, oz + 0.3), 0.175, 0.06, M["trim"], sides=8, axis="Y")
        cyl(p + f"intake_{sx}", (ex, oy - 0.26, oz + 0.3), 0.11, 0.04, M["glow"], sides=8, axis="Y")
        cyl(p + f"nozzle_{sx}", (ex, oy + 0.78, oz + 0.3), 0.13, 0.1, M["dark"], sides=8, axis="Y")
        cyl(p + f"burn_{sx}", (ex, oy + 0.835, oz + 0.3), 0.09, 0.02, M["glow"], sides=8, axis="Y")
        box(p + f"pylon_{sx}", (ox + sx * 0.38, oy + 0.25, oz + 0.33), (0.12, 0.6, 0.08), M["mid"])
        # swept wing (loft along X), orange tip block
        x0, x1 = ox + sx * 0.6, ox + sx * 1.38
        loft(p + f"wing_{sx}", sorted([
            (x0, 0.36, 0.05, 0.02, oy + 0.3, oz + 0.38),
            (x1, 0.17, 0.03, 0.01, oy + 0.62, oz + 0.4),
        ]), M["white"])
        box(p + f"wing_panel_{sx}", (ox + sx * 0.95, oy + 0.42, oz + 0.43), (0.42, 0.34, 0.02), M["light"])
        box(p + f"wing_tip_{sx}", (ox + sx * 1.47, oy + 0.62, oz + 0.4), (0.18, 0.34, 0.07), M["trim"], chamfer=0.02)
        # upright fin at the back, orange top
        fx = ox + sx * 0.5
        loft(p + f"fin_{sx}", [(oz + 0.44, 0.04, 0.24, 0.0, fx, oy + 0.72),
                               (oz + 0.82, 0.03, 0.12, 0.0, fx, oy + 0.88)], M["white"], axis="Z")
        loft(p + f"fin_tip_{sx}", [(oz + 0.82, 0.032, 0.12, 0.0, fx, oy + 0.88),
                                   (oz + 0.98, 0.025, 0.07, 0.0, fx, oy + 0.95)], M["trim"], axis="Z")
        # landing struts
        for k, ly in enumerate((-0.55, 0.65)):
            box(p + f"leg_{sx}_{k}", (ox + sx * 0.18, oy + ly, oz + 0.09), (0.05, 0.05, 0.18), M["dark"])
            box(p + f"foot_{sx}_{k}", (ox + sx * 0.18, oy + ly, oz + 0.015), (0.12, 0.14, 0.03), M["mid"])


def make():
    make_shuttle(mats())
    anchor("engine_l", (-0.5, 0.85, 0.3))
    anchor("engine_r", (0.5, 0.85, 0.3))
    anchor("cargo", (0.0, 0.2, 0.0))


if __name__ == "__main__":
    build("shuttle", make, ref="hub.jpg")
