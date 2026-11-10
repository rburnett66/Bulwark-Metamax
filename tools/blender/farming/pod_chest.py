"""The Pod Reward Chest: a high-tech seed vault, built in headless Blender 5.2 [MM-story_mwayo9y5_1v].

    python -m pip install bpy==5.2.4          (or any Blender 5.2: blender -b -P pod_chest.py -- <out.glb>)
    python pod_chest.py <out.glb>

Design (owner 2026-11-10: "a high tech 3D chest ... the important part is the effects when presenting and opening"):
a gunmetal capsule with Bulwark-gold armour, a clamshell lid that splits down the middle and swings open to both sides,
a lock ring on the front that spins off, glowing seams, four hover pads, and inside a glowing cradle holding three
seed pods. Every moving part is its own node, so src/menu/podChest3d.js can animate it:

  pod_chest            the root, origin on the floor under the chest centre
    base               the body, the hover pads and the cradle (static)
    lid_l, lid_r       the lid halves; each origin is on its hinge (the outer top edge), so a rotation about the
                       model's front-back axis swings it open
    lock               the lock ring on the front face; origin at its centre, facing the camera
    pods               the three seed pods in the cradle (they rise when the chest opens)

Emissive materials (glow_*) are bloomed in the game and tinted at load: glow_seam (the seams, dark blue), glow_core (the
cradle and hover rings), glow_pod (the pods: the crop tier colour). Flat shaded, no textures (farm_common.py).
Units: metres-ish; the chest is 2.0 wide, 1.3 deep, about 1.3 tall closed. The game fits it to its camera.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import farm_common as fc  # noqa: E402
from farm_common import reset, empty, box, cyl, ico, torus, hull, join_by_material, export, stats  # noqa: E402

fc.PALETTE.update({
    'chest_shell': (0x263040, 0.75, 0.32, 0, 1),
    'chest_panel': (0x42536a, 0.65, 0.38, 0, 1),
    'chest_inner': (0x0c1218, 0.3, 0.6, 0, 1),
    'chest_gold':  (0xd9a441, 1.0, 0.28, 0, 1),
    # owner 2026-11-10: a dark blue emissive (the first cyan was too bright)
    'glow_seam':   (0x1a3fd9, 0.0, 0.5, 2.5, 1),
    'glow_core':   (0x2a55ff, 0.0, 0.5, 3.0, 1),
})

W, D, HB, HL = 2.0, 1.3, 0.78, 0.46        # width (x), depth (y), base height, lid rise
HALF = W / 2


def lid_profile(inset=0.0, lift=0.0, steps=10):
    """The left lid half's cross-section in hinge-local x/z: from the hinge (x=0) up and over to the split (x=HALF)."""
    pts = [(inset, lift)]
    for i in range(steps + 1):
        t = i / steps
        x = inset + (HALF - inset) * t
        z = lift + 0.12 + (HL - 0.12 - inset) * math.sin(t * math.pi / 2) ** 0.8
        pts.append((x, z))
    pts.append((HALF, lift))
    return pts


def prism(name, profile, y0, y1, material, parent, bevel=0.0):
    """A solid with an x/z cross-section `profile`, swept along y (convex profiles only)."""
    return hull(name, [(x, y, z) for (x, z) in profile for y in (y0, y1)], material, parent, bevel)


def build_lid(root, side):
    """One lid half. side -1 = left (hinge at x=-HALF), +1 = right (mirrored)."""
    node = empty(f'lid_{"l" if side < 0 else "r"}', root, loc=(side * HALF, 0, HB), node=f'lid_{"l" if side < 0 else "r"}')
    m = (lambda pts: [(-x if side > 0 else x, z) for (x, z) in pts])
    y = D / 2
    prism('shell', m(lid_profile()), -y + 0.02, y - 0.02, 'chest_shell', node, bevel=0.012)
    # the raised armour plate on top, and the gold end frames
    prism('plate', m([(x, z + 0.025) for (x, z) in lid_profile(inset=0.16, steps=8)][1:-1] + [(HALF - 0.04, HL - 0.1)]),
          -y + 0.16, y - 0.16, 'chest_panel', node, bevel=0.01)
    for yy in (-y, y - 0.03):
        prism('frame', m([(x, z + 0.012) for (x, z) in lid_profile(steps=8)]), yy, yy + 0.03, 'chest_gold', node)
    # the glowing seam where the halves meet, and the gold rim along the hinge
    sx = -(HALF - 0.025) if side > 0 else (HALF - 0.025)
    box('seam', (0.03, D - 0.12, 0.05), (sx, 0, HL - 0.02), 'glow_seam', node)
    box('rim', (0.06, D + 0.02, 0.06), (0.03 * (-1 if side > 0 else 1), 0, 0.04), 'chest_gold', node, bevel=0.01)
    # vents on the slope
    for k in (-1, 0, 1):
        vx = 0.42 * (-1 if side > 0 else 1)
        box('vent', (0.16, 0.05, 0.025), (vx, k * 0.17, 0.33), 'chest_inner', node, rot=(0, (-0.55 if side < 0 else 0.55), 0))
    return node


def build():
    reset()
    root = empty('pod_chest', None, node='pod_chest')

    # ---- the base: body, armour, seams, handles, hover pads, the cradle inside
    base = empty('base', root, node='base')
    box('body', (W, D, HB), (0, 0, HB / 2), 'chest_shell', base, bevel=0.05, seg=2)
    box('band_low', (W + 0.04, D + 0.04, 0.1), (0, 0, 0.06), 'chest_panel', base, bevel=0.02)
    box('band_top', (W + 0.03, D + 0.03, 0.05), (0, 0, HB - 0.04), 'glow_seam', base)
    box('front_panel', (W * 0.68, 0.03, HB * 0.5), (0, -D / 2 - 0.01, HB * 0.47), 'chest_panel', base, bevel=0.015)
    box('back_panel', (W * 0.68, 0.03, HB * 0.5), (0, D / 2 + 0.01, HB * 0.47), 'chest_panel', base, bevel=0.015)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('guard', (0.16, 0.16, HB + 0.06), (sx * (HALF - 0.04), sy * (D / 2 - 0.04), HB / 2 + 0.01), 'chest_gold', base,
                bevel=0.035, seg=2)
            # hover pads and their rings
            cyl('pad', 0.15, 0.1, (sx * 0.68, sy * 0.38, -0.03), 'chest_panel', base, verts=16, bevel=0.01)
            torus('pad_ring', 0.13, 0.025, (sx * 0.68, sy * 0.38, -0.085), 'glow_core', base, seg=20, tube=6)
        # side handles and the vertical light slits
        torus('handle', 0.17, 0.035, (sx * (HALF + 0.03), 0, HB * 0.55), 'chest_gold', base, rot=(math.pi / 2, 0, math.pi / 2),
              seg=14, tube=6, arc=math.pi)
        for k in (-1, 1):
            box('slit', (0.03, 0.05, HB * 0.42), (sx * (HALF + 0.005), k * 0.38, HB * 0.48), 'glow_seam', base)
    for k in (-1, 1):
        box('front_slit', (0.42, 0.03, 0.03), (k * 0.52, -D / 2 - 0.02, HB * 0.2), 'glow_seam', base)
    # the cradle: a dark recess, a glowing core plate, gold sockets for the three pods
    box('recess', (W - 0.2, D - 0.2, 0.02), (0, 0, HB + 0.005), 'chest_inner', base)
    cyl('core', 0.62, 0.03, (0, 0, HB + 0.02), 'glow_core', base, verts=6, rot=(0, 0, math.pi / 6))
    for px in (-0.42, 0, 0.42):
        torus('socket', 0.15, 0.03, (px, 0, HB + 0.045), 'chest_gold', base, seg=16, tube=6)

    # ---- the pods in their sockets (they rise when the chest opens)
    pods = empty('pods', root, node='pods')
    for px in (-0.42, 0, 0.42):
        ico('pod', 0.12, (px, 0, HB + 0.17), 'glow_pod', pods, scale=(1, 1, 1.4), sub=2)

    # ---- the lock on the front face: a gold ring, a dark disc, a glowing hexagon, four bolts
    lock = empty('lock', root, loc=(0, -D / 2 - 0.05, HB * 0.5), node='lock')
    torus('ring', 0.2, 0.04, (0, 0, 0), 'chest_gold', lock, rot=(math.pi / 2, 0, 0), seg=24, tube=8)
    cyl('disc', 0.17, 0.04, (0, 0.01, 0), 'chest_panel', lock, rot=(math.pi / 2, 0, 0), verts=24)
    cyl('hex', 0.085, 0.05, (0, -0.005, 0), 'glow_seam', lock, rot=(math.pi / 2, 0, 0), verts=6)
    for a in range(4):
        t = a * math.pi / 2 + math.pi / 4
        box('bolt', (0.06, 0.05, 0.06), (math.cos(t) * 0.27, 0.0, math.sin(t) * 0.27), 'chest_gold', lock, rot=(0, -t, 0), bevel=0.01)

    build_lid(root, -1)
    build_lid(root, +1)

    join_by_material(root)
    return root


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out = os.path.abspath(argv[0] if argv else 'pod_chest.glb')
    build()
    print('pod_chest tris', stats())
    export(out)
    print('wrote', out)


if __name__ == '__main__':
    main()
