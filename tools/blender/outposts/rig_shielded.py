"""Shielded Extractor rig — the sealed uranium rig.  [MM-story_mw5oem5o_r] (story O11's remaining rigs; design §8.4)

    python3 tools/blender/outposts/rig_shielded.py [out_dir] [--render] [--anim]

NO OWNER ART YET: ref/mv_shielded.jpg does not exist (PROMPTS.md §2 holds its prompt). This model is built from the
design's description (§8.4: "a sealed dome with warning lights; robotic arms move lead-lined canisters"), PROMPTS.md
§2 and the house style of the Auger Drill bunker it belongs with; rebuild it from the art when the owner supplies it.
The review sheet's reference tile is the drill sheet (the family it must match).

Footprint: a 3 × 3 pad (one unit = one battle cell). A white chamfered bunker with a low armoured dome on top, lit
at its rim and ribbed, and two amber warning beacons on the roof (nodes `beacon_l`, `beacon_r`: their shutters
turn). The front portal holds a heavy octagonal shielded hatch with orange hazard stripes and a trefoil. Either side
of it a robotic arm swings a lead-grey canister with a small green window (nodes `arm_l`, `arm_r`) between the
hatch and a short rail cart in front, which shuttles two canisters along its track (node `cart`). Hazard stripes
along the pad's front edge; side wings with lit doors. All clips loop while the rig mines; Mk II plays them at 2×.
Ore: Uranium (Rig_Head `shielded`). Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, ring, ship  # noqa: E402
from mathutils import Matrix  # noqa: E402  (after outpost_common: bpy brings mathutils in)

ROOF = 0.92


def canister(name, x, y, z, M, h=0.26, r=0.075):
    """A lead-grey canister standing on (x, y, z): banded body, a small green window, a dark cap."""
    parts = [cyl(f"{name}_body", (x, y, z + h / 2), r, h, M["mid"], sides=8, axis="Z"),
             cyl(f"{name}_band", (x, y, z + h * 0.78), r + 0.008, 0.03, M["trim"], sides=8, axis="Z"),
             cyl(f"{name}_cap", (x, y, z + h + 0.02), r * 0.7, 0.04, M["dark"], sides=8, axis="Z"),
             box(f"{name}_win", (x, y - r - 0.003, z + h * 0.45), (0.05, 0.012, 0.08), M["rad"])]
    return parts


def trefoil(name, x, y, z, r, M, face=-1):
    """A radiation trefoil as simple shapes on a wall facing ±Y: three blades round a dot, on a disc."""
    cyl(f"{name}_disc", (x, y, z), r, 0.012, M["trim"], sides=12, axis="Y")
    cyl(f"{name}_dot", (x, y + face * 0.01, z), r * 0.16, 0.012, M["dark"], sides=8, axis="Y")
    for k in range(3):
        a = math.radians(90 + k * 120)
        b = box(f"{name}_blade_{k}", (0, 0, 0), (r * 0.62, 0.012, r * 0.42), M["dark"])
        b.rotation_euler = (0, -a, 0)
        b.location = (x + r * 0.55 * math.cos(a), y + face * 0.01, z + r * 0.55 * math.sin(a))


def beacon(node, x, y, z, M):
    """A rotating amber warning beacon: a housing, an amber lens and a dark shutter vane that turns (node)."""
    drum(f"{node}_base", (x, y, z), 0.09, 0.06, M["mid"], sides=8)
    drum(f"{node}_lens", (x, y, z + 0.06), 0.065, 0.12, M["amber"], sides=8)
    drum(f"{node}_cap", (x, y, z + 0.18), 0.075, 0.03, M["dark"], sides=8)
    box(f"{node}__vane", (x, y, z + 0.12), (0.15, 0.03, 0.1), M["dark"])
    box(f"{node}__vane_b", (x, y, z + 0.12), (0.03, 0.15, 0.06), M["mid"])
    node_frame(node, (x, y, z))
    clip(node, "spin_world", 1.0)


def arm(node, base, yaw, M):
    """A robotic arm: a turret on the deck, an upper arm, a forearm and a gripper holding a canister out in front.
    Built about its turret at `base`, reaching toward -Y, turned `yaw`; swings `sweep` about the world Z axis."""
    bx, by, bz = base
    parts = [cyl(f"{node}_turret", (bx, by, bz + 0.07), 0.15, 0.14, M["mid"], sides=10, axis="Z"),
             ring(f"{node}_turret_ring", (bx, by, bz + 0.14), 0.16, 0.12, 0.025, M["trim"], sides=10)]
    loc = [cyl(f"{node}__hub", (0, 0, 0.2), 0.1, 0.12, M["light"], sides=8, axis="Z"),
           box(f"{node}__shoulder", (0, 0, 0.32), (0.16, 0.14, 0.14), M["white"], chamfer=0.03)]
    up = box(f"{node}__upper", (0, 0, 0), (0.12, 0.12, 0.42), M["white"], chamfer=0.02)
    up.rotation_euler = (math.radians(-28), 0, 0)
    up.location = (0, -0.1, 0.5)
    fore = box(f"{node}__fore", (0, 0, 0), (0.1, 0.1, 0.36), M["white"], chamfer=0.02)
    fore.rotation_euler = (math.radians(-125), 0, 0)
    fore.location = (0, -0.34, 0.6)
    loc += [up, fore,
            cyl(f"{node}__elbow", (0, -0.2, 0.68), 0.06, 0.12, M["mid"], sides=8, axis="X"),
            box(f"{node}__elbow_trim", (0, -0.2, 0.75), (0.13, 0.04, 0.02), M["trim"]),
            box(f"{node}__wrist", (0, -0.48, 0.47), (0.12, 0.1, 0.08), M["mid"])]
    for s in (-1, 1):
        loc.append(box(f"{node}__claw_{s}", (s * 0.085, -0.48, 0.38), (0.025, 0.06, 0.14), M["dark"]))
    loc += canister(f"{node}__can", 0, -0.48, 0.22, M, h=0.2, r=0.06)
    place = Matrix.Translation((bx, by, bz)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Diagonal((1.2, 1.2, 1.2, 1.0))
    for ob in loc:                                       # built about the turret axis, then turned and placed
        ob.matrix_basis = place @ ob.matrix_basis
    node_frame(node, (bx, by, bz))
    clip(node, "sweep", 3.2, amp=32)
    return parts


def make():
    M = mats()
    M["rad"] = ship.mat("glow_rad", (0.08, 0.62, 0.12), emit=(0.08, 0.62, 0.12), strength=2.0)       # canister windows
    M["amber"] = ship.mat("glow_amber", (0.75, 0.3, 0.02), emit=(0.75, 0.3, 0.02), strength=2.5)   # warning beacons

    # pad with hazard stripes along its front edge
    octo("pad", 0, -0.1, 0.0, 0.08, 1.45, 1.38, 0.35, M["dark"])
    for k in range(10):
        st = box(f"hazard_{k}", (0, 0, 0), (0.07, 0.2, 0.01), M["trim"])
        st.rotation_euler = (0, 0, math.radians(35))
        st.location = (-0.9 + 0.2 * k, -1.36, 0.085)

    # bunker body and the armoured dome
    box("body", (0, 0.25, ROOF / 2 + 0.04), (1.8, 1.3, ROOF - 0.08), M["white"], chamfer=0.26)
    octo("roof", 0, 0.25, ROOF - 0.02, ROOF + 0.03, 0.8, 0.56, 0.2, M["light"])
    dz = ROOF + 0.03
    drum("dome_skirt", (0, 0.3, dz), 0.6, 0.1, M["light"], sides=16)
    ring("dome_glow", (0, 0.3, dz + 0.1), 0.6, 0.5, 0.025, M["glow"], sides=16)
    drum("dome_0", (0, 0.3, dz + 0.1), 0.56, 0.18, M["white"], sides=16, r1=0.48)
    drum("dome_1", (0, 0.3, dz + 0.28), 0.48, 0.14, M["white"], sides=16, r1=0.34)
    drum("dome_2", (0, 0.3, dz + 0.42), 0.34, 0.08, M["light"], sides=16, r1=0.2)
    drum("dome_top", (0, 0.3, dz + 0.5), 0.2, 0.05, M["mid"], sides=16)
    drum("dome_seal", (0, 0.3, dz + 0.55), 0.1, 0.04, M["dark"], sides=8)
    for k in range(8):                                    # armour ribs over the dome
        a = math.radians(22.5 + k * 45)
        rib = box(f"dome_rib_{k}", (0, 0, 0), (0.06, 0.32, 0.06), M["mid"])
        rib.rotation_euler = (math.radians(-30), 0, a - math.pi / 2)
        rib.location = (0.43 * math.cos(a), 0.3 + 0.43 * math.sin(a), dz + 0.26)
    beacon("beacon_l", -0.62, 0.0, ROOF - 0.02, M)
    beacon("beacon_r", 0.62, 0.0, ROOF - 0.02, M)
    for sx in (-1, 1):                                    # sealed roof vents behind the beacons
        box(f"roof_vent_{sx}", (sx * 0.62, 0.62, ROOF + 0.06), (0.24, 0.3, 0.12), M["mid"], chamfer=0.03)
        box(f"roof_vent_slot_{sx}", (sx * 0.62, 0.465, ROOF + 0.06), (0.16, 0.012, 0.03), M["glow"])

    # front portal and the shielded hatch
    box("portal", (0, -0.45, 0.47), (1.0, 0.24, 0.82), M["light"], chamfer=0.06)
    box("portal_cap", (0, -0.45, 0.91), (1.1, 0.3, 0.07), M["white"])
    box("portal_light", (0, -0.575, 0.84), (0.36, 0.02, 0.05), M["glow"])
    cyl("hatch_frame", (0, -0.575, 0.44), 0.36, 0.04, M["mid"], sides=8, axis="Y")
    cyl("hatch", (0, -0.6, 0.44), 0.3, 0.03, M["dark"], sides=8, axis="Y")
    for k in range(4):                                    # hazard chevrons round the hatch
        a = math.radians(45 + k * 90)
        c = box(f"hatch_stripe_{k}", (0, 0, 0), (0.14, 0.012, 0.035), M["trim"])
        c.rotation_euler = (0, -a + math.pi / 2, 0)
        c.location = (0.31 * math.cos(a), -0.6, 0.44 + 0.31 * math.sin(a))
    trefoil("hatch_sign", 0, -0.62, 0.44, 0.13, M)
    for sx in (-1, 1):
        box(f"hatch_bolt_{sx}", (sx * 0.4, -0.58, 0.44), (0.06, 0.04, 0.22), M["mid"])
        box(f"portal_lamp_{sx}", (sx * 0.4, -0.575, 0.74), (0.06, 0.02, 0.06), M["glow"])

    # side wings with lit doors and trefoil signs
    for sx in (-1, 1):
        x = sx * 1.12
        box(f"wing_{sx}", (x, 0.35, 0.3), (0.56, 0.9, 0.54), M["light"], chamfer=0.13)
        box(f"wing_cap_{sx}", (x, 0.35, 0.59), (0.36, 0.6, 0.06), M["mid"])
        box(f"wing_door_{sx}", (x, -0.105, 0.26), (0.26, 0.02, 0.26), M["dark"])
        box(f"wing_light_{sx}", (x, -0.115, 0.3), (0.14, 0.02, 0.04), M["glow"])
        trefoil(f"wing_sign_{sx}", x + sx * 0.0, 0.81, 0.36, 0.08, M, face=1)

    # the rail and its cart (node `cart`) in front of the hatch
    for k, y in enumerate((-1.0, -1.2)):
        box(f"rail_{k}", (0, y, 0.1), (2.3, 0.04, 0.04), M["mid"])
    for k in range(8):
        box(f"sleeper_{k}", (-1.05 + 0.3 * k, -1.1, 0.085), (0.08, 0.34, 0.02), M["light"])
    for sx in (-1, 1):
        box(f"rail_stop_{sx}", (sx * 1.18, -1.1, 0.15), (0.06, 0.32, 0.12), M["trim"])
    cx, cy = -0.38, -1.1
    box("cart__bed", (cx, cy, 0.2), (0.5, 0.32, 0.08), M["white"], chamfer=0.02)
    box("cart__stripe", (cx, cy - 0.165, 0.2), (0.4, 0.01, 0.03), M["trim"])
    box("cart__light", (cx + 0.255, cy, 0.2), (0.01, 0.12, 0.03), M["glow"])
    for wx in (-0.16, 0.16):
        for wy in (-0.1, 0.1):
            cyl(f"cart__wheel_{wx}_{wy}", (cx + wx, cy + wy, 0.13), 0.05, 0.03, M["dark"], sides=8, axis="Y")
    for k, dx in enumerate((-0.11, 0.11)):
        canister(f"cart__can_{k}", cx + dx, cy, 0.24, M)
    node_frame("cart", (cx, cy, 0.0))
    clip("cart", "travel", 5.0, vec=(0.76, 0, 0))

    # the robotic arms either side of the hatch, swinging canisters between the hatch and the cart
    arm("arm_l", (-0.68, -0.72, 0.08), math.radians(-15), M)
    arm("arm_r", (0.68, -0.72, 0.08), math.radians(15), M)
    canister("stack_l_0", -1.05, -0.62, 0.08, M)          # a few canisters waiting by the wings
    canister("stack_l_1", -1.22, -0.55, 0.08, M)
    canister("stack_r_0", 1.12, -0.6, 0.08, M)

    anchor("hatch", (0, -0.62, 0.44))
    anchor("beacon_l", (-0.62, 0.0, ROOF + 0.12), color="amber")
    anchor("beacon_r", (0.62, 0.0, ROOF + 0.12), color="amber")
    anchor("debris", (0, -1.1, 0.3), color="ore")             # dust round the cart (3× on Mk II)
    anchor("power", (0, 0.95, 0.02))


if __name__ == "__main__":
    build("rig_shielded", make, ref="mv_drill.jpg")
