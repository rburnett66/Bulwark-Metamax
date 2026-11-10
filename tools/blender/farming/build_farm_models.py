"""Bulwark farming models, built in headless Blender 5.2 [MM-story_mwa5fhvz_2].

    blender -b -P build_farm_models.py -- <out_dir> [model ...]

Writes one GLB per model into <out_dir>. Models (design: docs/16 Bulwark MM/design/Farming-Design.md):
  plant_grain, plant_leafy   one plant in each growth state, a node per state
  tree_orchard, tree_solo    the orchard tree (4 per 3 x 3 orchard) and the 2 x 2 solo tree
  hydro_dome                 the hydroponic farm's surface doorway: a 2 x 2 glass dome
  vertical_farm              2 x 2, nodes floor_1..floor_4 + roof (levels add floors)
  bunker_mound               the underground farm's doorway: a 2 x 2 earth-covered ammunition bunker
  machines                   grow-room machines + gro-bot, a node each (metres, ship-interior scale)
Flat shaded, no textures: material colours only. See farm_common.py for the material contract.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from farm_common import (reset, empty, box, cyl, ico, sphere, torus, strut, blade, lathe, hull,  # noqa: E402
                         join_by_material, export, stats, mat)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

TAU = math.pi * 2


# =============================================================== plants (surface units: 4 / cell)

def grain_stalk(p, rng, x, y, h, lean, yaw, stalk_mat, head_mat, droop=0.25, head=True, awns=True):
    """One wheat-like stalk with leaves and a grain head; returns the top point."""
    top = Vector((x + math.cos(yaw) * math.sin(lean) * h, y + math.sin(yaw) * math.sin(lean) * h,
                  math.cos(lean) * h))
    strut('stalk', (x, y, 0), top, 0.028, stalk_mat, p, verts=5)
    for k in range(2):
        blade('leaf', h * (0.45 + 0.1 * k), 0.09, 0.9, (x, y, h * (0.15 + 0.2 * k)), yaw + math.pi * k + rng.uniform(-.4, .4),
              0.5 + 0.2 * rng.random(), stalk_mat, p, segs=4, twist=0.6)
    if head:
        d = Vector((math.cos(yaw), math.sin(yaw), 0)) * droop
        base = top
        for s in range(6):
            t = s / 6
            c = base + Vector((0, 0, 0.08 * s)) + d * t * t
            ico('kernel', 0.06 - 0.004 * s, c, head_mat, p, scale=(1, 1, 1.5), sub=0)
            if awns and s % 2 == 0:
                strut('awn', c, c + Vector((rng.uniform(-.1, .1), rng.uniform(-.1, .1), 0.22)) + d * 0.3, 0.006,
                      head_mat, p, verts=3)
    return top


def build_grain(root):
    states = {}
    for state in ('planted', 'sprout', 'plant', 'fruited', 'dead', 'harvested'):
        rng = random.Random(7)
        p = empty(f'grain_{state}', root, node=f'grain_{state}')
        states[state] = p
        if state == 'planted':
            sphere('mound', 0.38, (0, 0, -0.02), 'soil_light', p, scale=(1, 1, 0.32), segs=10, rings=5, upper_only=True)
            ico('pod', 0.16, (0, 0, 0.16), 'pod', p, scale=(1, 1, 1.35), sub=1)
            torus('pod_ring', 0.13, 0.025, (0, 0, 0.16), 'glow_pod', p, seg=10, tube=4)
        elif state == 'sprout':
            for k in range(3):
                blade('shoot', 0.42 + 0.08 * k, 0.07, 0.8, (0, 0, 0), k * TAU / 3 + rng.uniform(-.3, .3), 0.25,
                      'leaf_light', p, segs=4)
        elif state == 'plant':
            for k in range(7):
                a, r = k * TAU / 7 + rng.uniform(-.2, .2), rng.uniform(0.05, 0.16)
                grain_stalk(p, rng, math.cos(a) * r, math.sin(a) * r, rng.uniform(1.25, 1.6), rng.uniform(.04, .14), a,
                            'leaf', 'leaf_light', head=False)
        elif state == 'fruited':
            for k in range(7):
                a, r = k * TAU / 7 + rng.uniform(-.2, .2), rng.uniform(0.05, 0.16)
                grain_stalk(p, rng, math.cos(a) * r, math.sin(a) * r, rng.uniform(1.45, 1.8), rng.uniform(.05, .18), a,
                            'straw', 'grain', droop=0.3)
        elif state == 'dead':
            for k in range(7):
                a, r = k * TAU / 7 + rng.uniform(-.2, .2), rng.uniform(0.05, 0.18)
                grain_stalk(p, rng, math.cos(a) * r, math.sin(a) * r, rng.uniform(1.0, 1.3), rng.uniform(0.7, 1.25), a,
                            'dead', 'dead_dark', droop=0.5, awns=False)
        elif state == 'harvested':
            for k in range(7):
                a, r = k * TAU / 7 + rng.uniform(-.2, .2), rng.uniform(0.05, 0.18)
                cyl('stubble', 0.03, rng.uniform(0.12, 0.2), (math.cos(a) * r, math.sin(a) * r, 0.07), 'straw', p,
                    verts=5, r2=0.022)
            for k in range(4):
                a = rng.uniform(0, TAU)
                box('straw', (0.7, 0.03, 0.02), (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.02), 'straw', p, rot=(0, 0, a))
    return states


def leafy_rosette(p, rng, n, size, mats, wilt=0.0):
    for k in range(n):
        a = k * TAU / n + rng.uniform(-.2, .2)
        blade('leaf', size * rng.uniform(.8, 1.1), size * 0.42, 0.9 + wilt * 1.5, (0, 0, 0.05), a,
              0.35 + wilt * 0.9 + rng.uniform(-.1, .1), mats[k % len(mats)], p, segs=5, twist=0.4)


def build_leafy(root):
    for state in ('planted', 'sprout', 'plant', 'fruited', 'dead', 'harvested'):
        rng = random.Random(11)
        p = empty(f'leafy_{state}', root, node=f'leafy_{state}')
        if state == 'planted':
            sphere('mound', 0.38, (0, 0, -0.02), 'soil_light', p, scale=(1, 1, 0.32), segs=10, rings=5, upper_only=True)
            ico('pod', 0.16, (0, 0, 0.16), 'pod', p, scale=(1, 1, 1.35), sub=1)
            torus('pod_ring', 0.13, 0.025, (0, 0, 0.16), 'glow_pod', p, seg=10, tube=4)
        elif state == 'sprout':
            leafy_rosette(p, rng, 2, 0.32, ['leaf_light'])
        elif state == 'plant':
            leafy_rosette(p, rng, 7, 0.85, ['leaf', 'leaf_dark'])
            leafy_rosette(p, rng, 4, 0.55, ['leaf_light'])
        elif state == 'fruited':
            ico('bulb', 0.3, (0, 0, 0.12), 'bulb', p, scale=(1, 1, 0.8), sub=1)
            leafy_rosette(p, rng, 7, 0.95, ['leaf', 'leaf_dark'])
            leafy_rosette(p, rng, 4, 0.6, ['leaf_light'])
        elif state == 'dead':
            ico('bulb', 0.22, (0, 0, 0.05), 'dead_dark', p, scale=(1, 1, 0.6), sub=1)
            leafy_rosette(p, rng, 6, 0.8, ['dead', 'dead_dark'], wilt=0.8)
        elif state == 'harvested':
            sphere('hole', 0.3, (0, 0, -0.04), 'soil', p, scale=(1, 1, 0.2), segs=10, rings=4, upper_only=True)
            for k in range(3):
                a = rng.uniform(0, TAU)
                blade('scrap', 0.35, 0.14, 1.6, (math.cos(a) * .3, math.sin(a) * .3, 0.02), a, 1.3, 'leaf_dark', p, segs=3)


# =============================================================== trees

def tree(p, rng, scale, canopy_mats, fruit=None, bloom=False, clusters=6):
    s = scale
    # trunk: stacked, tapering, leaning segments with a root flare
    pts = [Vector((0, 0, 0))]
    lean = Vector((rng.uniform(-.08, .08), rng.uniform(-.08, .08), 1)).normalized()
    for i in range(4):
        bend = Vector((rng.uniform(-.12, .12), rng.uniform(-.12, .12), 0))
        pts.append(pts[-1] + (lean + bend).normalized() * 0.9 * s)
    for i in range(4):
        r0 = (0.34 - 0.06 * i) * s
        strut('trunk', pts[i], pts[i + 1], r0, 'bark', p, verts=7)
        ico('knot', r0 * 1.05, pts[i + 1], 'bark', p, sub=0)
    for k in range(5):
        a = k * TAU / 5 + rng.uniform(-.3, .3)
        cyl('root', 0.16 * s, 0.6 * s, (math.cos(a) * .25 * s, math.sin(a) * .25 * s, 0.18 * s), 'bark', p,
            rot=(math.cos(a + math.pi / 2) * .9, math.sin(a + math.pi / 2) * .9, 0), verts=5, r2=0.04 * s)
    top = pts[-1]
    # branches
    tips = []
    for k in range(5):
        a = k * TAU / 5 + rng.uniform(-.3, .3)
        start = pts[2 + k % 2]
        tip = start + Vector((math.cos(a) * 1.3 * s, math.sin(a) * 1.3 * s, rng.uniform(.7, 1.2) * s))
        strut('branch', start, tip, 0.11 * s, 'bark', p, verts=5)
        tips.append(tip)
    tips.append(top + Vector((0, 0, 0.4 * s)))
    # canopy clusters
    centres = []
    for k in range(clusters):
        c = tips[k % len(tips)] + Vector((rng.uniform(-.4, .4), rng.uniform(-.4, .4), rng.uniform(.1, .5))) * s
        r = rng.uniform(0.85, 1.25) * s
        ico('canopy', r, c, canopy_mats[k % len(canopy_mats)], p, scale=(1, 1, 0.82), sub=1, jitter=0.35, rng=rng)
        centres.append((c, r))
    if fruit:
        for k in range(16):
            c, r = centres[k % len(centres)]
            a, b = rng.uniform(0, TAU), rng.uniform(-.6, .4)
            d = Vector((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b))) * r * 0.95
            ico('fruit', 0.17 * s, c + d, fruit, p, sub=1)
            strut('stem', c + d, c + d + Vector((0, 0, .14 * s)), 0.02 * s, 'bark', p, verts=3)
    if bloom:
        for k in range(14):
            c, r = centres[k % len(centres)]
            a, b = rng.uniform(0, TAU), rng.uniform(-.2, .8)
            d = Vector((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b))) * r * 0.97
            f = c + d
            for j in range(5):
                pa = j * TAU / 5
                ico('petal', 0.14 * s, f + Vector((math.cos(pa), math.sin(pa), 0)) * 0.13 * s, 'petal', p,
                    scale=(1.4, 0.8, 0.35), rot=(0, 0, pa), sub=0)
            ico('bloom', 0.08 * s, f + Vector((0, 0, 0.04 * s)), 'glow_bloom', p, sub=0)


def build_orchard_tree(root):
    p = empty('tree_orchard', root, node='tree_orchard')
    tree(p, random.Random(3), 1.0, ['leaf', 'leaf_dark', 'leaf_light'], fruit='fruit')


def build_solo_tree(root):
    p = empty('tree_solo', root, node='tree_solo')
    rng = random.Random(5)
    # stone planter ring on the 2 x 2 footprint (8 x 8 units)
    for k in range(14):
        a = k * TAU / 14
        ico('stone', rng.uniform(.45, .6), (math.cos(a) * 3.1, math.sin(a) * 3.1, 0.2), 'rock', p,
            scale=(1.3, 1, 0.7), rot=(0, 0, a), sub=1, jitter=0.3, rng=rng)
    cyl('bed', 3.0, 0.2, (0, 0, 0.1), 'soil', p, verts=20)
    tree(p, rng, 1.45, ['leaf', 'leaf_dark', 'leaf_light'], bloom=True, clusters=9)


# =============================================================== hydroponic dome (2 x 2 = 8 x 8 units)

def build_hydro_dome(root):
    p = empty('hydro_dome', root, node='hydro_dome')
    rng = random.Random(21)
    # pad and base ring
    cyl('pad', 3.95, 0.3, (0, 0, 0.15), 'hull', p, verts=8, bevel=0.06)
    box('pad_trim', (7.0, 0.12, 0.08), (0, -3.7, 0.3), 'trim', p)
    lathe('ring', [(3.55, 0.3), (3.6, 0.45), (3.45, 0.75), (3.35, 0.8)], material='steel_dark', parent=p, verts=32)
    # glass hemisphere + geodesic frame
    R = 3.3
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=R)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-3], context='VERTS')
    edges = [(e.verts[0].co.copy(), e.verts[1].co.copy()) for e in bm.edges]
    bmesh.ops.translate(bm, vec=Vector((0, 0, 0.8)), verts=bm.verts)
    me = bpy.data.meshes.new('glass')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat('glass'))
    o = bpy.data.objects.new('glass', me)
    bpy.context.collection.objects.link(o)
    o.parent = p
    for a, b in edges:
        strut('frame', a + Vector((0, 0, 0.8)), b + Vector((0, 0, 0.8)), 0.045, 'steel', p, verts=4)
    torus('crown', 0.55, 0.08, (0, 0, R + 0.78), 'steel', p, seg=16, tube=6)
    cyl('vent', 0.45, 0.25, (0, 0, R + 0.9), 'hull', p, verts=12, bevel=0.03)
    # interior: grow benches with coloured grow lights and plants, a central light column
    cyl('column', 0.25, 2.6, (0, 0, 2.1), 'steel_dark', p, verts=8)
    cyl('column_glow', 0.16, 2.0, (0, 0, 2.2), 'glow_cyan', p, verts=8)
    for i, glow in enumerate(['glow_grow_red', 'glow_grow_blue', 'glow_grow_violet']):
        a = i * TAU / 3 + 0.5
        cx, cy = math.cos(a) * 1.9, math.sin(a) * 1.9
        box('bench', (1.8, 0.8, 0.5), (cx, cy, 1.05), 'hull', p, rot=(0, 0, a + math.pi / 2), bevel=0.04)
        box('tray', (1.6, 0.6, 0.1), (cx, cy, 1.33), 'soil', p, rot=(0, 0, a + math.pi / 2))
        for j in range(4):
            t = (j - 1.5) * 0.38
            ox, oy = -math.sin(a) * t, math.cos(a) * t
            ico('crop', 0.2, (cx + ox, cy + oy, 1.5), ['leaf', 'leaf_light'][j % 2], p, scale=(1, 1, 1.2), sub=1,
                jitter=0.3, rng=rng)
        box('lamp', (1.6, 0.14, 0.06), (cx, cy, 2.35), glow, p, rot=(0, 0, a + math.pi / 2))
        strut('hanger', (cx, cy, 2.38), (cx, cy, 3.0), 0.02, 'steel', p, verts=4)
    # airlock vestibule at the front (-Y)
    box('airlock', (1.7, 1.4, 1.9), (0, -3.6, 1.25), 'hull', p, bevel=0.08, seg=2)
    box('airlock_roof', (1.85, 1.5, 0.15), (0, -3.6, 2.25), 'steel_dark', p, bevel=0.03)
    box('airlock_trim', (1.72, 1.42, 0.14), (0, -3.6, 1.95), 'trim', p)
    box('door', (0.95, 0.06, 1.45), (0, -4.31, 1.0), 'steel_dark', p, bevel=0.03)
    box('door_glass', (0.6, 0.07, 0.45), (0, -4.32, 1.35), 'screen', p)
    sphere('lamp_door', 0.09, (0.68, -4.33, 1.85), 'glow_amber', p, segs=8, rings=4)
    # side tank and pipe
    cyl('tank', 0.5, 1.4, (3.0, 2.3, 1.0), 'hull', p, verts=12, bevel=0.04)
    sphere('tank_top', 0.5, (3.0, 2.3, 1.7), 'hull', p, scale=(1, 1, 0.5), segs=12, rings=6, upper_only=True)
    box('tank_band', (1.04, 1.04, 0.1), (3.0, 2.3, 1.3), 'trim', p)
    strut('pipe', (2.55, 2.0, 0.7), (2.6, 1.6, 0.7), 0.08, 'steel', p, verts=6)


# =============================================================== vertical farm (2 x 2, levels 1-4)

FLOOR_H = 2.6
BASE_H = 0.4


def build_vertical_farm(root):
    p = empty('vertical_farm', root, node='vertical_farm')
    rng = random.Random(31)
    base = empty('base', p, node='base')
    box('plinth', (8.0, 8.0, BASE_H), (0, 0, BASE_H / 2), 'concrete', base, bevel=0.06)
    box('plinth_trim', (8.02, 8.02, 0.1), (0, 0, BASE_H - 0.06), 'trim', base)
    box('step', (2.2, 0.8, 0.2), (0, -4.3, 0.1), 'concrete', base, bevel=0.03)
    for n in range(1, 5):
        f = empty(f'floor_{n}', p, loc=(0, 0, BASE_H + (n - 1) * FLOOR_H), node=f'floor_{n}')
        box('slab', (7.6, 7.6, 0.25), (0, 0, 0.125), 'hull', f, bevel=0.05)
        box('slab_trim', (7.64, 7.64, 0.08), (0, 0, 0.22), 'trim', f)
        for sx in (-1, 1):
            for sy in (-1, 1):
                box('column', (0.42, 0.42, FLOOR_H), (sx * 3.55, sy * 3.55, FLOOR_H / 2), 'steel_dark', f, bevel=0.05)
        # glass curtain walls with mullions; the ground floor's front has the door
        for side in range(4):
            a = side * math.pi / 2
            nx, ny = math.cos(a - math.pi / 2), math.sin(a - math.pi / 2)
            tx, ty = -ny, nx
            box('glass', (6.6, 0.05, 2.2), (nx * 3.6, ny * 3.6, 1.35), 'glass', f, rot=(0, 0, a))
            for m in (-1, 0, 1):
                box('mullion', (0.08, 0.1, 2.2), (nx * 3.62 + tx * m * 2.2, ny * 3.62 + ty * m * 2.2, 1.35), 'steel',
                    f, rot=(0, 0, a))
            box('sill', (6.7, 0.18, 0.1), (nx * 3.6, ny * 3.6, 0.3), 'steel', f, rot=(0, 0, a))
        # grow trays, plants and magenta grow lights
        for ty in (-1.6, 1.6):
            box('tray', (6.2, 2.0, 0.35), (0, ty, 0.5), 'hull_dark', f, bevel=0.03)
            box('soil', (6.0, 1.8, 0.06), (0, ty, 0.7), 'soil', f)
            for i in range(6):
                for j in range(2):
                    x, y = -2.5 + i * 1.0, ty - 0.45 + j * 0.9
                    ico('crop', rng.uniform(.26, .34), (x, y, 0.95), ['leaf', 'leaf_dark', 'leaf_light'][(i + j) % 3], f,
                        scale=(1, 1, 1.25), sub=1, jitter=0.35, rng=rng)
            box('grow_light', (6.0, 0.22, 0.08), (0, ty, 2.25), 'glow_grow', f)
            box('grow_housing', (6.1, 0.34, 0.1), (0, ty, 2.33), 'steel_dark', f)
        if n == 1:
            box('door_frame', (1.5, 0.22, 2.1), (0, -3.72, 1.25), 'steel_dark', f, bevel=0.03)
            box('door', (1.2, 0.12, 1.9), (0, -3.78, 1.2), 'hull', f, bevel=0.02)
            sphere('door_lamp', 0.08, (0.9, -3.86, 2.1), 'glow_amber', f, segs=8, rings=4)
        # level pip beside the door: lit on every floor that exists
        sphere('pip', 0.07, (-0.95 - 0.0, -3.86, 0.7 + 0.0), 'glow_green', f, segs=6, rings=3)
    roof = empty('roof', p, loc=(0, 0, BASE_H + FLOOR_H), node='roof')
    box('cap', (7.8, 7.8, 0.3), (0, 0, 0.15), 'hull', roof, bevel=0.06)
    for side in range(4):
        a = side * math.pi / 2
        nx, ny = math.cos(a - math.pi / 2), math.sin(a - math.pi / 2)
        box('parapet', (7.8, 0.2, 0.35), (nx * 3.8, ny * 3.8, 0.45), 'hull', roof, rot=(0, 0, a), bevel=0.03)
    for side in range(4):
        a = side * math.pi / 2
        nx, ny = math.cos(a - math.pi / 2), math.sin(a - math.pi / 2)
        box('parapet_trim', (7.84, 0.24, 0.08), (nx * 3.8, ny * 3.8, 0.66), 'trim', roof, rot=(0, 0, a))
    for i, (x, y) in enumerate([(-1.7, 1.2), (1.7, 1.2)]):
        cyl('fan_housing', 1.0, 0.5, (x, y, 0.55), 'steel_dark', roof, verts=16, bevel=0.03)
        torus('fan_rim', 1.0, 0.08, (x, y, 0.82), 'steel', roof, seg=16, tube=5)
        fan = empty(f'fan_{i + 1}', roof, loc=(x, y, 0.75), node=f'fan_{i + 1}')
        for b in range(5):
            box('blade', (0.85, 0.22, 0.04), (math.cos(b * TAU / 5) * 0.45, math.sin(b * TAU / 5) * 0.45, 0), 'steel',
                fan, rot=(0.3, 0, b * TAU / 5))
        cyl('hub', 0.16, 0.12, (0, 0, 0.02), 'hull_dark', fan, verts=8)
    cyl('water_tank', 0.75, 1.3, (0.6, -1.9, 0.95), 'hull', roof, verts=14, bevel=0.03)
    box('tank_band', (1.55, 1.55, 0.1), (0.6, -1.9, 1.1), 'trim', roof)
    strut('antenna', (-2.8, -2.8, 0.3), (-2.8, -2.8, 2.2), 0.04, 'steel', roof, verts=4)
    sphere('beacon', 0.1, (-2.8, -2.8, 2.25), 'glow_red', roof, segs=8, rings=4)


# =============================================================== underground entrance: the ammunition bunker (2 x 2)
#
# An earth-covered magazine: a long turfed barrel vault running back from a flat concrete headwall, splayed wing walls,
# a heavy rust-streaked double blast door whose seam glows red from inside, red caged lamps, a stencilled bay number and
# an explosives placard, lightning masts and mushroom vents on the berm, razor wire and jersey barriers at the apron.
# Front is -Y (the side the battle camera sees).

HW_Y = -2.0     # headwall front face
DOOR_W, DOOR_H = 2.9, 2.35


def _berm(p, rng):
    """The barrel-vaulted earth cover: a grid lofted over x, falling off at the back and sides."""
    nx, ny = 26, 22
    x0, x1, y0, y1 = -3.95, 3.95, HW_Y + 0.25, 3.95
    bm = bmesh.new()
    grid = []
    for j in range(ny + 1):
        row = []
        y = y0 + (y1 - y0) * j / ny
        back = min(1.0, (y1 - y) / 2.6)            # rounds down over the last 2.6 units
        back = math.sin(back * math.pi / 2)
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            u = abs(x) / 3.95
            vault = max(0.0, 1 - u ** 2.4) ** 0.62  # a flattened barrel
            z = 2.75 * vault * back
            if 0 < i < nx and 0 < j < ny:
                z += (math.sin(x * 3.1 + y * 1.7) * 0.05 + rng.uniform(-0.05, 0.05)) * min(1, z)
            row.append(bm.verts.new((x, y, max(0.0, z))))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    # close the front so the berm meets the headwall cleanly
    front = [grid[0][i] for i in range(nx + 1)]
    bm.faces.new(front[::-1])
    me = bpy.data.meshes.new('berm')
    bm.to_mesh(me)
    bm.free()
    for name in ('earth_dark', 'turf_dead', 'turf_dark', 'dirt'):
        me.materials.append(mat(name))
    for poly in me.polygons:
        poly.use_smooth = False
        n = poly.normal
        c = poly.center
        steep = n.z < 0.55
        patch = math.sin(c.x * 1.3 + 0.7) * math.cos(c.y * 1.1 - 0.4) + math.sin(c.x * 2.9 - c.y * 2.3) * 0.35
        r = rng.random()
        poly.material_index = 0 if steep and r < 0.5 else (3 if r < 0.025 else (2 if patch + (r - .5) * .4 > 0.25 else 1))
    o = bpy.data.objects.new('berm', me)
    bpy.context.collection.objects.link(o)
    o.parent = p


def _digit(p, ch, x, z, h, material, y=HW_Y - 0.02):
    """A stencilled seven-segment digit on the headwall face (x = left edge, z = baseline)."""
    w, t = h * 0.55, h * 0.13
    seg = {'a': (w / 2, h, w, t), 'g': (w / 2, h / 2, w, t), 'd': (w / 2, 0, w, t),
           'f': (0, h * .75, t, h / 2), 'b': (w, h * .75, t, h / 2), 'e': (0, h * .25, t, h / 2), 'c': (w, h * .25, t, h / 2)}
    on = {'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc',
          '8': 'abcdefg', '9': 'abcdfg', '-': 'g'}[ch]
    for s in on:
        cx, cz, sx, sz = seg[s]
        box('stencil', (sx, 0.03, sz), (x + cx, y, z + cz), material, p)


def build_bunker_mound(root):
    p = empty('bunker_mound', root, node='bunker_mound')
    rng = random.Random(1307)
    _berm(p, rng)

    # ---- headwall: a thick, flat, weathered slab with a cap and soot-dark streaks
    box('headwall', (5.6, 0.7, 3.25), (0, HW_Y + 0.35, 1.625), 'concrete_dark', p, bevel=0.04)
    box('headwall_cap', (5.9, 0.95, 0.28), (0, HW_Y + 0.38, 3.36), 'concrete_dark', p, bevel=0.04)
    for k in range(7):
        x = rng.uniform(-2.6, 2.6)
        if abs(x) < DOOR_W / 2 + 0.15:
            continue
        hgt = rng.uniform(0.7, 1.9)
        box('streak', (rng.uniform(.08, .2), 0.02, hgt), (x, HW_Y - 0.005, 3.25 - hgt / 2), 'concrete_stain', p)
    # splayed wing walls holding the earth back, tops sloping down to the apron
    for sx in (-1, 1):
        a = (sx * 2.75, HW_Y + 0.1)
        b = (sx * 3.95, HW_Y - 1.55)
        t = 0.38
        nx_, ny_ = (b[1] - a[1]), -(b[0] - a[0])
        L = math.hypot(nx_, ny_)
        ox, oy = nx_ / L * t * sx, ny_ / L * t * sx
        pts = []
        for (px, py), top in ((a, 3.2), (b, 0.55)):
            for (qx, qy) in ((px, py), (px + ox, py + oy)):
                pts += [(qx, qy, 0.0), (qx, qy, top)]
        hull('wing', pts, 'concrete_dark', p)
        box('wing_cap', (0.5, 0.5, 0.12), (b[0] - sx * 0.05, b[1] + 0.05, 0.6), 'concrete_dark', p, bevel=0.02)
        # earth banked against the wing
        hull('bank', [(sx * 2.9, HW_Y + 0.3, 0), (sx * 2.9, HW_Y + 0.3, 2.7), (sx * 3.95, HW_Y + 0.3, 0.2),
                      (sx * 3.95, HW_Y - 1.4, 0), (sx * 3.15, HW_Y - 0.4, 1.6), (sx * 3.95, HW_Y - 0.6, 0.9)],
             'earth_dark', p)

    # ---- the door: a dark recess, two heavy leaves, a red glow leaking from the seam
    box('recess', (DOOR_W + 0.3, 0.4, DOOR_H + 0.2), (0, HW_Y - 0.05, (DOOR_H + 0.2) / 2), 'hull_dark', p)
    box('frame_top', (DOOR_W + 0.7, 0.3, 0.32), (0, HW_Y - 0.12, DOOR_H + 0.32), 'steel_bunker', p, bevel=0.03)
    for sx in (-1, 1):
        box('frame_side', (0.3, 0.3, DOOR_H + 0.3), (sx * (DOOR_W / 2 + 0.2), HW_Y - 0.12, (DOOR_H + 0.3) / 2),
            'steel_bunker', p, bevel=0.03)
    box('seam_glow', (0.06, 0.05, DOOR_H - 0.1), (0, HW_Y - 0.2, DOOR_H / 2), 'glow_redhot', p)
    box('sill_glow', (DOOR_W - 0.2, 0.05, 0.04), (0, HW_Y - 0.2, 0.05), 'glow_redhot', p)
    lw = DOOR_W / 2 - 0.05
    for sx in (-1, 1):
        cx = sx * (lw / 2 + 0.04)
        box('leaf', (lw, 0.22, DOOR_H), (cx, HW_Y - 0.3, DOOR_H / 2 + 0.02), 'steel_bunker', p, bevel=0.03, seg=2)
        for z in (0.45, 1.2, 1.95):
            box('rib', (lw - 0.1, 0.1, 0.13), (cx, HW_Y - 0.45, z), 'steel_dark', p, bevel=0.02)
        # X brace between the ribs
        for (z0, z1) in ((0.5, 1.15), (1.25, 1.9)):
            for s2 in (-1, 1):
                strut('brace', (cx - s2 * (lw / 2 - 0.12), HW_Y - 0.44, z0), (cx + s2 * (lw / 2 - 0.12), HW_Y - 0.44, z1),
                      0.035, 'steel_dark', p, verts=4)
        # hinges on the outer edge
        for z in (0.35, DOOR_H / 2, DOOR_H - 0.35):
            cyl('hinge', 0.09, 0.32, (sx * (DOOR_W / 2 - 0.02), HW_Y - 0.42, z), 'steel_dark', p, verts=8)
        # rust runs down from the ribs
        for k in range(4):
            x = cx + rng.uniform(-lw / 2 + 0.15, lw / 2 - 0.15)
            hgt = rng.uniform(0.3, 0.8)
            box('rust', (rng.uniform(.05, .12), 0.02, hgt), (x, HW_Y - 0.42, rng.choice((1.95, 1.2)) - hgt / 2), 'rust', p)
        # locking bar keeps
        box('keep', (0.22, 0.14, 0.3), (sx * 0.28, HW_Y - 0.48, 1.2), 'steel_dark', p, bevel=0.02)
    box('lock_bar', (1.1, 0.12, 0.14), (0, HW_Y - 0.56, 1.2), 'rust', p, bevel=0.02)
    # red and black band across the foot of both leaves
    stripes = [box('stripe', (0.18, 0.1, 0.9), (k * 0.4, -0.01 + HW_Y - 0.42, 0.3), 'sign_red', p, rot=(0, 0.75, 0))
               for k in range(-5, 6)]
    box('band', (DOOR_W - 0.15, 0.06, 0.32), (0, HW_Y - 0.42, 0.3), 'hazard_k', p)
    clip = box('clip', (DOOR_W - 0.15, 0.4, 0.32), (0, HW_Y - 0.42, 0.3), 'sign_red', p)
    clip.hide_render = True
    for s in stripes:
        m = s.modifiers.new('clip', 'BOOLEAN')
        m.operation, m.object, m.solver = 'INTERSECT', clip, 'EXACT'
    bpy.context.view_layer.update()
    for s in stripes:
        bpy.context.view_layer.objects.active = s
        bpy.ops.object.select_all(action='DESELECT')
        s.select_set(True)
        bpy.ops.object.modifier_apply(modifier='clip')
    bpy.data.objects.remove(clip)

    # ---- markings: bay number over the door, an explosives placard, a red warning plate
    for sx in (-1, 1):   # the bay number stencilled on both leaves, above the top rib
        for k, ch in enumerate('07'):
            _digit(p, ch, sx * 0.71 - 0.3 + k * 0.34, 2.05, 0.26, 'sign_white', y=HW_Y - 0.42)
    box('warn_plate_l', (0.8, 0.04, 0.42), (-2.25, HW_Y - 0.02, 2.75), 'sign_red', p)
    for k in range(3):
        box('warn_text', (0.14, 0.02, 0.08), (-2.45 + k * 0.2, HW_Y - 0.05, 2.76), 'sign_white', p)
    box('placard', (0.58, 0.04, 0.58), (1.9, HW_Y - 0.02, 2.75), 'placard', p, rot=(0, math.pi / 4, 0))
    sphere('placard_bomb', 0.09, (1.9, HW_Y - 0.06, 2.78), 'hazard_k', p, scale=(1, .4, 1), segs=8, rings=4)
    for k in range(3):   # the burst lines of the 1.1 symbol
        a = math.pi / 2 + (k - 1) * 0.5
        strut('burst', (1.9 + math.cos(a) * .12, HW_Y - .06, 2.78 + math.sin(a) * .12),
              (1.9 + math.cos(a) * .2, HW_Y - .06, 2.78 + math.sin(a) * .2), .012, 'hazard_k', p, verts=3)
    box('warn_plate', (0.9, 0.04, 0.3), (1.9, HW_Y - 0.02, 1.85), 'sign_red', p)
    for k in range(4):
        box('warn_text', (0.12, 0.02, 0.07), (1.6 + k * 0.2, HW_Y - 0.05, 1.86), 'sign_white', p)

    # ---- red caged lamps either side of the door, a floodlight on the cap
    for sx in (-1, 1):
        x = sx * (DOOR_W / 2 + 0.62)
        box('lamp_plate', (0.32, 0.06, 0.32), (x, HW_Y - 0.03, 2.2), 'steel_dark', p)
        cyl('lamp_base', 0.12, 0.12, (x, HW_Y - 0.12, 2.2), 'steel_dark', p, rot=(math.pi / 2, 0, 0), verts=10)
        sphere('lamp', 0.11, (x, HW_Y - 0.24, 2.2), 'glow_red', p, segs=10, rings=5)
        for k in range(4):
            a = k * TAU / 4 + math.pi / 4
            strut('cage', (x + math.cos(a) * .13, HW_Y - 0.12, 2.2 + math.sin(a) * .13),
                  (x + math.cos(a) * .13, HW_Y - 0.36, 2.2 + math.sin(a) * .13), 0.012, 'steel_dark', p, verts=3)
    cyl('flood_post', 0.05, 0.6, (0.9, HW_Y + 0.3, 3.75), 'steel_dark', p, verts=6)
    box('flood', (0.4, 0.26, 0.24), (0.9, HW_Y + 0.15, 4.05), 'steel_dark', p, rot=(-0.5, 0, 0), bevel=0.02)
    box('flood_lens', (0.32, 0.03, 0.17), (0.9, HW_Y + 0.0, 3.96), 'glow_amber', p, rot=(-0.5, 0, 0))

    # ---- on the berm: lightning masts tied by a catenary wire, mushroom vents, a rusted cable run
    tops = []
    for (x, y) in ((-2.5, 0.2), (2.5, 2.4)):
        z0 = 2.2
        cyl('mast', 0.06, 2.6, (x, y, z0 + 1.3), 'steel_dark', p, verts=6)
        cyl('mast_tip', 0.0, 0.35, (x, y, z0 + 2.75), 'steel', p, verts=6, r2=0.05)
        box('mast_foot', (0.4, 0.4, 0.2), (x, y, z0 + 0.05), 'concrete_dark', p, bevel=0.02)
        tops.append((x, y, z0 + 2.55))
    mid = tuple((a + b) / 2 for a, b in zip(*tops))
    mid = (mid[0], mid[1], mid[2] - 0.35)
    strut('catenary', tops[0], mid, 0.012, 'wire', p, verts=3)
    strut('catenary', mid, tops[1], 0.012, 'wire', p, verts=3)
    for (x, y, z) in ((0.0, 0.9, 2.72), (-1.2, 2.8, 2.3)):
        cyl('vent', 0.16, 0.8, (x, y, z + 0.3), 'steel_bunker', p, verts=10)
        cyl('vent_cap', 0.36, 0.18, (x, y, z + 0.78), 'steel_bunker', p, verts=10, r2=0.08)
        box('vent_rust', (0.05, 0.02, 0.4), (x, y - 0.165, z + 0.45), 'rust', p)

    # ---- apron: cracked slab, a drain grate, jersey barriers, razor wire on posts down both sides
    box('apron', (5.2, 2.0, 0.1), (0, HW_Y - 1.0, 0.05), 'concrete_dark', p, bevel=0.02)
    for k in range(3):
        box('crack', (rng.uniform(.4, .9), 0.03, 0.012), (rng.uniform(-2, 2), HW_Y - rng.uniform(.4, 1.8), 0.105),
            'concrete_stain', p, rot=(0, 0, rng.uniform(-0.6, 0.6)))
    box('grate', (2.4, 0.22, 0.02), (0, HW_Y - 0.75, 0.11), 'steel_dark', p)
    for k in range(12):
        box('grate_bar', (0.03, 0.2, 0.03), (-1.1 + k * 0.2, HW_Y - 0.75, 0.12), 'hull_dark', p)
    for sx in (-1, 1):
        x = sx * 1.95
        y = HW_Y - 1.75
        hull('jersey', [(x - .55, y - .3, 0), (x + .55, y - .3, 0), (x - .55, y + .3, 0), (x + .55, y + .3, 0),
                        (x - .55, y - .2, .22), (x + .55, y - .2, .22), (x - .55, y + .2, .22), (x + .55, y + .2, .22),
                        (x - .55, y - .08, .62), (x + .55, y - .08, .62), (x - .55, y + .08, .62), (x + .55, y + .08, .62)],
             'concrete', p, bevel=0.015)
        box('jersey_stripe', (0.3, 0.02, 0.12), (x + sx * 0.15, y - 0.2, 0.36), 'sign_red', p, rot=(0.33, 0, 0))
    for sx in (-1, 1):
        posts = [(sx * 3.75, HW_Y - 1.65), (sx * 3.85, 0.4), (sx * 3.85, 2.6)]
        for (x, y) in posts:
            cyl('post', 0.04, 1.1, (x, y, 0.55), 'wire', p, verts=6)
            strut('post_arm', (x, y, 1.05), (x - sx * 0.25, y, 1.3), 0.025, 'wire', p, verts=4)
        for (a, b) in zip(posts, posts[1:]):
            n = 7
            for k in range(n):
                t = (k + 0.5) / n
                x = a[0] + (b[0] - a[0]) * t
                y = a[1] + (b[1] - a[1]) * t
                ang = math.atan2(b[1] - a[1], b[0] - a[0])
                torus('razor', 0.22, 0.014, (x, y, 0.6), 'wire', p, rot=(0, math.pi / 2, ang), seg=10, tube=3)
            strut('wire_run', (a[0], a[1], 1.0), (b[0], b[1], 1.0), 0.008, 'wire', p, verts=3)
    # a few dead tufts and rubble at the berm foot
    for k in range(10):
        x, y = rng.uniform(-3.6, 3.6), rng.uniform(HW_Y + 0.8, 3.7)
        u = abs(x) / 3.95
        z = 2.75 * max(0.0, 1 - u ** 2.4) ** 0.62 * math.sin(min(1.0, (3.95 - y) / 2.6) * math.pi / 2)
        for j in range(4):
            blade('tuft', 0.4, 0.07, 0.8, (x, y, z - 0.04), j * TAU / 4 + k, 0.35, 'dead', p, segs=3)
    for k in range(6):
        ico('rubble', rng.uniform(.12, .26), (rng.choice((-1, 1)) * rng.uniform(2.7, 3.4), HW_Y - rng.uniform(.3, 1.3), .08),
            ['concrete_dark', 'rock_dark'][k % 2], p, scale=(1.2, 1, .7), sub=1, jitter=0.3, rng=rng)


# =============================================================== grow-room machines (metres)

def build_machines(root):
    rng = random.Random(51)

    # Irrigation System: tank, pump, manifold with three valves, gauge
    m = empty('irrigation_system', root, loc=(-6, 0, 0), node='irrigation_system')
    box('skid', (1.9, 1.1, 0.12), (0, 0, 0.06), 'steel_dark', m, bevel=0.02)
    cyl('tank', 0.5, 1.4, (-0.45, 0.1, 0.85), 'hull', m, verts=16, bevel=0.03)
    sphere('tank_top', 0.5, (-0.45, 0.1, 1.55), 'hull', m, scale=(1, 1, 0.45), segs=16, rings=6, upper_only=True)
    box('tank_band', (1.02, 1.02, 0.1), (-0.45, 0.1, 1.2), 'trim', m)
    box('sight', (0.08, 0.04, 0.9), (-0.45, -0.41, 0.85), 'glow_water', m)
    box('pump', (0.6, 0.5, 0.45), (0.45, 0.15, 0.37), 'hull_dark', m, bevel=0.04)
    cyl('motor', 0.2, 0.5, (0.45, 0.15, 0.37), 'steel', m, rot=(0, math.pi / 2, 0), verts=12)
    strut('pipe', (-0.05, 0.1, 0.4), (0.15, 0.1, 0.4), 0.06, 'steel', m)
    strut('riser', (0.75, 0.15, 0.4), (0.75, 0.15, 1.3), 0.06, 'steel', m)
    strut('manifold', (0.75, 0.15, 1.3), (0.75, -0.45, 1.3), 0.07, 'steel', m)
    for k in range(3):
        y = 0.1 - k * 0.25
        strut('drop', (0.75, y - 0.1, 1.3), (0.75, y - 0.1, 0.2), 0.035, 'steel', m)
        torus('valve', 0.08, 0.015, (0.83, y - 0.1, 0.9), 'trim', m, rot=(0, math.pi / 2, 0), seg=10, tube=4)
    cyl('gauge', 0.12, 0.05, (0.45, -0.12, 0.75), 'steel', m, rot=(math.pi / 2, 0, 0), verts=12)
    cyl('gauge_face', 0.09, 0.02, (0.45, -0.15, 0.75), 'glow_green', m, rot=(math.pi / 2, 0, 0), verts=12)

    # Air Control: cabinet with two big fans and gas cylinders
    m = empty('air_control', root, loc=(-3, 0, 0), node='air_control')
    box('cabinet', (1.6, 0.9, 2.0), (0, 0, 1.0), 'hull', m, bevel=0.06, seg=2)
    box('cab_trim', (1.62, 0.92, 0.1), (0, 0, 1.75), 'trim', m)
    for i, z in enumerate((0.55, 1.3)):
        cyl('fan_ring', 0.36, 0.08, (0, -0.47, z), 'steel_dark', m, rot=(math.pi / 2, 0, 0), verts=16)
        torus('fan_grille', 0.3, 0.015, (0, -0.52, z), 'steel', m, rot=(math.pi / 2, 0, 0), seg=16, tube=4)
        torus('fan_grille', 0.18, 0.015, (0, -0.52, z), 'steel', m, rot=(math.pi / 2, 0, 0), seg=12, tube=4)
        fan = empty(f'fan_{i + 1}', m, loc=(0, -0.46, z), node=f'fan_{i + 1}')
        for b in range(5):
            a = b * TAU / 5
            box('blade', (0.28, 0.02, 0.1), (math.cos(a) * 0.15, 0, math.sin(a) * 0.15), 'steel', fan,
                rot=(0.35, -a, 0))
    for k, liquid in enumerate(('hull', 'trim')):
        x = 0.95 + 0.0 * k
        y = -0.2 + 0.45 * k
        cyl('gas', 0.18, 1.3, (x, y, 0.65), 'steel' if k == 0 else 'hazard_y', m, verts=12)
        sphere('gas_top', 0.18, (x, y, 1.3), 'steel' if k == 0 else 'hazard_y', m, scale=(1, 1, 0.6), segs=12, rings=4,
               upper_only=True)
        cyl('valve', 0.05, 0.15, (x, y, 1.45), 'steel_dark', m, verts=8)
    box('panel', (0.5, 0.04, 0.3), (-0.45, -0.47, 1.75), 'screen', m)
    box('panel_glow', (0.4, 0.05, 0.05), (-0.45, -0.48, 1.8), 'glow_cyan', m)

    # Light Rig: gantry over a third, three grow-light bars
    m = empty('light_rig', root, loc=(0, 0, 0), node='light_rig')
    for sx in (-1, 1):
        box('post', (0.14, 0.14, 2.6), (sx * 1.5, 0, 1.3), 'steel_dark', m, bevel=0.02)
        box('foot', (0.4, 0.4, 0.08), (sx * 1.5, 0, 0.04), 'steel_dark', m, bevel=0.02)
    box('beam', (3.2, 0.18, 0.18), (0, 0, 2.55), 'steel', m, bevel=0.02)
    for k, glow in enumerate(('glow_grow_red', 'glow_grow', 'glow_grow_blue')):
        x = (k - 1) * 0.9
        strut('cable', (x, 0, 2.45), (x, 0, 2.05), 0.012, 'rubber', m, verts=3)
        box('housing', (0.8, 0.3, 0.08), (x, 0, 2.02), 'hull_dark', m, bevel=0.015)
        box('bar', (0.72, 0.22, 0.03), (x, 0, 1.97), glow, m)
    box('driver', (0.3, 0.2, 0.4), (1.5, -0.17, 1.4), 'hull', m, bevel=0.02)
    sphere('driver_led', 0.03, (1.5, -0.28, 1.5), 'glow_green', m, segs=6, rings=3)

    # Climate Unit: finned radiator block with a glowing heater coil and a frosted chiller
    m = empty('climate_unit', root, loc=(3, 0, 0), node='climate_unit')
    box('body', (1.4, 0.8, 1.5), (0, 0, 0.75), 'hull', m, bevel=0.05, seg=2)
    box('trim', (1.42, 0.82, 0.08), (0, 0, 1.35), 'trim', m)
    for k in range(9):
        box('fin', (0.04, 0.1, 0.8), (-0.6 + k * 0.075, -0.42, 0.75), 'steel', m)
    box('coil_bed', (0.65, 0.04, 0.82), (-0.3, -0.39, 0.75), 'hull_dark', m)
    for k in range(5):
        box('coil', (0.55, 0.03, 0.04), (-0.3, -0.37, 0.43 + k * 0.16), 'glow_heat', m)
    box('chiller', (0.5, 0.06, 0.8), (0.4, -0.4, 0.75), 'glass', m)
    for k in range(4):
        box('chill_bar', (0.42, 0.04, 0.03), (0.4, -0.38, 0.47 + k * 0.18), 'glow_cyan', m)
    cyl('exhaust', 0.16, 0.5, (0.4, 0.15, 1.75), 'steel_dark', m, verts=10)
    cyl('exhaust_cap', 0.24, 0.1, (0.4, 0.15, 2.02), 'steel', m, verts=10, r2=0.08)

    # Nutrient Doser: three canisters in a rack, dosing pump, tubes
    m = empty('nutrient_doser', root, loc=(6, 0, 0), node='nutrient_doser')
    box('rack', (1.3, 0.6, 0.1), (0, 0, 0.05), 'steel_dark', m, bevel=0.02)
    box('rack_shelf', (1.3, 0.6, 0.06), (0, 0, 1.25), 'steel_dark', m, bevel=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('rack_post', (0.06, 0.06, 1.3), (sx * 0.62, sy * 0.27, 0.65), 'steel_dark', m)
    for k, liq in enumerate(('liquid_g', 'liquid_a', 'liquid_b')):
        x = (k - 1) * 0.4
        cyl('can_liquid', 0.15, 0.7 - 0.12 * k, (x, 0, 0.1 + (0.7 - 0.12 * k) / 2), liq, m, verts=12)
        cyl('can', 0.17, 0.95, (x, 0, 0.58), 'glass', m, verts=12)
        cyl('can_cap', 0.18, 0.08, (x, 0, 1.08), 'hull', m, verts=12)
        strut('tube', (x, 0, 1.12), (x * 0.5, -0.1, 1.45), 0.02, 'rubber', m, verts=4)
    box('pump', (0.7, 0.4, 0.3), (0, -0.05, 1.45), 'hull', m, bevel=0.03)
    box('screen', (0.36, 0.03, 0.16), (0, -0.26, 1.47), 'screen', m)
    box('screen_glow', (0.3, 0.035, 0.04), (0, -0.27, 1.5), 'glow_green', m)
    box('pump_trim', (0.72, 0.42, 0.05), (0, -0.05, 1.6), 'trim', m)

    # Robot Bay: an alcove with a charging pad and a tool arm
    m = empty('robot_bay', root, loc=(9.5, 0, 0), node='robot_bay')
    box('floor', (1.6, 1.4, 0.1), (0, 0, 0.05), 'steel_dark', m, bevel=0.02)
    box('back', (1.6, 0.15, 2.1), (0, 0.65, 1.05), 'hull', m, bevel=0.04)
    for sx in (-1, 1):
        box('side', (0.15, 1.4, 2.1), (sx * 0.8, 0, 1.05), 'hull', m, bevel=0.04)
        for k in range(4):
            box('stripe', (0.17, 0.2, 0.05), (sx * 0.8, -0.6 + k * 0.35, 1.9), 'hazard_y' if k % 2 else 'hazard_k', m)
    box('roof', (1.75, 1.5, 0.15), (0, 0, 2.15), 'hull', m, bevel=0.04)
    box('roof_trim', (1.77, 1.52, 0.06), (0, 0, 2.05), 'trim', m)
    cyl('charge_pad', 0.5, 0.06, (0, 0, 0.13), 'hull_dark', m, verts=20)
    torus('charge_ring', 0.42, 0.025, (0, 0, 0.17), 'glow_cyan', m, seg=20, tube=4)
    strut('arm1', (0.55, 0.5, 1.6), (0.3, 0.2, 1.3), 0.04, 'steel', m)
    strut('arm2', (0.3, 0.2, 1.3), (0.15, 0.0, 1.45), 0.03, 'steel', m)
    box('panel', (0.4, 0.03, 0.3), (-0.4, 0.56, 1.4), 'screen', m)
    box('panel_glow', (0.32, 0.035, 0.05), (-0.4, 0.55, 1.45), 'glow_green', m)

    # Gro-bot: a little tracked robot (0.9 m) with a basket and two arms
    b = empty('gro_bot', root, loc=(12.5, 0, 0), node='gro_bot')
    for sx in (-1, 1):
        box('track', (0.14, 0.6, 0.18), (sx * 0.2, 0, 0.1), 'rubber', b, bevel=0.05, seg=2)
        for k in range(3):
            cyl('wheel', 0.07, 0.15, (sx * 0.2, -0.18 + k * 0.18, 0.1), 'steel_dark', b, rot=(0, math.pi / 2, 0), verts=8)
    box('body', (0.46, 0.5, 0.36), (0, 0, 0.4), 'hull', b, bevel=0.06, seg=2)
    box('body_trim', (0.47, 0.51, 0.05), (0, 0, 0.52), 'trim', b)
    box('basket', (0.36, 0.3, 0.14), (0, 0.15, 0.65), 'steel', b, bevel=0.02)
    cyl('neck', 0.05, 0.18, (0, -0.1, 0.66), 'steel_dark', b, verts=8)
    sphere('head', 0.15, (0, -0.1, 0.8), 'hull', b, scale=(1.15, 1, 0.8), segs=12, rings=6)
    box('visor', (0.24, 0.06, 0.07), (0, -0.22, 0.81), 'screen', b, bevel=0.015)
    box('eyes', (0.18, 0.065, 0.025), (0, -0.23, 0.82), 'glow_cyan', b)
    for sx in (-1, 1):
        strut('arm', (sx * 0.24, -0.1, 0.48), (sx * 0.3, -0.32, 0.38), 0.03, 'steel', b, verts=5)
        box('claw', (0.06, 0.08, 0.06), (sx * 0.3, -0.36, 0.36), 'steel_dark', b, bevel=0.01)
    strut('antenna', (0.08, -0.05, 0.92), (0.1, 0.0, 1.08), 0.008, 'steel', b, verts=3)
    sphere('antenna_tip', 0.02, (0.1, 0.0, 1.09), 'glow_green', b, segs=6, rings=3)


# =============================================================== main

MODELS = {
    'plant_grain': build_grain,
    'plant_leafy': build_leafy,
    'tree_orchard': build_orchard_tree,
    'tree_solo': build_solo_tree,
    'hydro_dome': build_hydro_dome,
    'vertical_farm': build_vertical_farm,
    'bunker_mound': build_bunker_mound,
    'machines': build_machines,
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')   # gitignored; publish.py reads it
    names = argv[1:] or list(MODELS)
    os.makedirs(out, exist_ok=True)
    for name in names:
        reset()
        root = empty(name, None, node=name)
        MODELS[name](root)
        join_by_material(root)
        path = os.path.join(out, name + '.glb')
        export(path)
        print(f'{name}: {stats()} tris -> {path} ({os.path.getsize(path) // 1024} KB)')


if __name__ == '__main__':
    main()
