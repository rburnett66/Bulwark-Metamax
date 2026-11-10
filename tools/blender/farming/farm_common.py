"""Shared helpers for the Bulwark farming models (headless Blender 5.2).

Style: detailed, flat shaded, NO textures. Every surface is a material with a flat colour; emissive
parts use materials named glow_* so the game's bloom and isGlowKey pick them up; the faction colour
slot is the material named `trim`; the pod-level colour slot is `pod` / `glow_pod` (tinted at load).

Units: surface models use the battle scale, 4 model units = 1 battle cell, so a 2 x 2-cell building is
8 x 8 units. Grow-room machines use metres at the ship-interior scale (the avatar is 1.8 m tall).
Blender is Z-up with the front facing -Y; the glTF exporter turns that into Y-up with the front facing +Z,
which is south in the battle view, toward the camera.

Run:  blender -b -P build_farm_models.py -- <out_dir> [model ...]
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix

# ---------------------------------------------------------------- scene

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def _srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = int(h)
    return tuple(_srgb_to_lin(((h >> s) & 255) / 255) for s in (16, 8, 0))


# ---------------------------------------------------------------- materials

MATS = {}

PALETTE = {
    # name: (hex, metallic, roughness, emission strength, alpha)
    'hull':        (0xdedcd4, 0.0, 0.55, 0, 1),
    'hull_dark':   (0x4a4f57, 0.2, 0.6, 0, 1),
    'steel':       (0x8a939c, 0.85, 0.35, 0, 1),
    'steel_dark':  (0x4e565e, 0.8, 0.45, 0, 1),
    'rubber':      (0x22252a, 0.0, 0.85, 0, 1),
    'concrete':    (0x9a9890, 0.0, 0.9, 0, 1),
    'trim':        (0xe07a2a, 0.1, 0.5, 0, 1),     # faction colour slot (Verdance orange)
    'hazard_y':    (0xf2b81d, 0.1, 0.55, 0, 1),
    'hazard_k':    (0x1d1f22, 0.1, 0.6, 0, 1),
    'glass':       (0xcdeefa, 0.0, 0.05, 0, 0.25),
    'water':       (0x2f7fa8, 0.1, 0.08, 0, 0.85),
    'soil':        (0x4a3424, 0.0, 0.95, 0, 1),
    'soil_light':  (0x6b5038, 0.0, 0.95, 0, 1),
    'dirt':        (0x6e4e33, 0.0, 0.95, 0, 1),
    'grass':       (0x5f8f36, 0.0, 0.9, 0, 1),
    'grass_dark':  (0x4c7a2b, 0.0, 0.9, 0, 1),
    'rock':        (0x8b8a82, 0.0, 0.9, 0, 1),
    'rock_dark':   (0x67665f, 0.0, 0.9, 0, 1),
    'bark':        (0x5a3f28, 0.0, 0.9, 0, 1),
    'wood':        (0x7a5634, 0.0, 0.8, 0, 1),
    'leaf':        (0x4f9a35, 0.0, 0.75, 0, 1),
    'leaf_dark':   (0x3a7d2a, 0.0, 0.75, 0, 1),
    'leaf_light':  (0x6cc04a, 0.0, 0.75, 0, 1),
    'straw':       (0xc9a24a, 0.0, 0.8, 0, 1),
    'grain':       (0xe8c45a, 0.0, 0.6, 0, 1),
    'dead':        (0x7b6a52, 0.0, 0.9, 0, 1),
    'dead_dark':   (0x5e5242, 0.0, 0.9, 0, 1),
    'fruit':       (0xd6453a, 0.0, 0.45, 0, 1),
    'bulb':        (0x9b3fd1, 0.0, 0.5, 0, 1),
    'petal':       (0xfff4dc, 0.0, 0.6, 0, 1),
    'pod':         (0xeaeaea, 0.1, 0.4, 0, 1),     # pod-level colour slot
    'liquid_g':    (0x5ad06a, 0.0, 0.2, 0, 1),
    'liquid_a':    (0xe0a43a, 0.0, 0.2, 0, 1),
    'liquid_b':    (0x3a8fe0, 0.0, 0.2, 0, 1),
    'screen':      (0x10161c, 0.2, 0.3, 0, 1),
    # the ammunition bunker (underground doorway): weathered, dark, rusted
    'concrete_dark':  (0x5f5e59, 0.0, 0.95, 0, 1),
    'concrete_stain': (0x45443f, 0.0, 0.95, 0, 1),
    'rust':        (0x6e3a22, 0.5, 0.7, 0, 1),
    'steel_bunker': (0x3b4045, 0.8, 0.55, 0, 1),
    'turf_dead':   (0x4b5233, 0.0, 0.95, 0, 1),
    'turf_dark':   (0x343c24, 0.0, 0.95, 0, 1),
    'earth_dark':  (0x47372a, 0.0, 0.95, 0, 1),
    'wire':        (0x2a2d30, 0.7, 0.5, 0, 1),
    'sign_red':    (0x9e1f1a, 0.0, 0.6, 0, 1),
    'sign_white':  (0xd8d4c8, 0.0, 0.7, 0, 1),
    'placard':     (0xe8661e, 0.0, 0.6, 0, 1),
    'glow_redhot': (0xff2a1a, 0.0, 0.5, 6.0, 1),
    # emissive (bloom); emission colour = base colour
    'glow_pod':    (0xffffff, 0.0, 0.5, 3.0, 1),   # tinted to the pod level at load
    'glow_cyan':   (0x6fe3ff, 0.0, 0.5, 4.0, 1),
    'glow_amber':  (0xffb347, 0.0, 0.5, 5.0, 1),
    'glow_green':  (0x4dff6a, 0.0, 0.5, 4.0, 1),
    'glow_red':    (0xff4040, 0.0, 0.5, 4.0, 1),
    'glow_grow':   (0xff5ad8, 0.0, 0.5, 4.0, 1),   # default magenta grow light
    'glow_grow_red':    (0xff3a3a, 0.0, 0.5, 4.0, 1),
    'glow_grow_blue':   (0x4a7dff, 0.0, 0.5, 4.0, 1),
    'glow_grow_violet': (0xb25cff, 0.0, 0.5, 4.0, 1),
    'glow_heat':   (0xff6a1a, 0.0, 0.5, 5.0, 1),
    'glow_bloom':  (0xffe08a, 0.0, 0.5, 3.0, 1),
    'glow_water':  (0x6fe3ff, 0.0, 0.5, 2.5, 1),
}


def mat(name):
    if name in MATS:
        return MATS[name]
    hexv, metal, rough, emit, alpha = PALETTE[name]
    m = bpy.data.materials.new(name)
    if getattr(m, 'node_tree', None) is None:
        m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    rgb = hex_rgb(hexv)
    b.inputs['Base Color'].default_value = (*rgb, 1.0)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*rgb, 1.0)
        b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
    m.diffuse_color = (*rgb, alpha)
    MATS[name] = m
    return m


# ---------------------------------------------------------------- objects

def _link(obj, parent=None):
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, parent=None, loc=(0, 0, 0), node=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    if node:
        e['node'] = node
    return _link(e, parent)


def _mesh_obj(name, bm, material, parent):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(mat(material))
    return _link(bpy.data.objects.new(name, me), parent)


def _place(bm, loc, rot, scale):
    m = Matrix.Translation(Vector(loc)) @ Matrix.LocRotScale(None, _euler(rot), None) @ Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)


def _euler(rot):
    from mathutils import Euler
    return Euler(rot, 'XYZ')


def bevel_bm(bm, width, segments=1):
    if width <= 0:
        return
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=width, segments=segments, affect='EDGES',
                    profile=0.5, clamp_overlap=True)


def hull(name, points, material='concrete', parent=None, bevel=0.0):
    """A convex solid through the given points (wing walls, barriers, chamfered slabs)."""
    bm = bmesh.new()
    vs = [bm.verts.new(Vector(p)) for p in points]
    res = bmesh.ops.convex_hull(bm, input=vs)
    drop = {v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)}
    if drop:
        bmesh.ops.delete(bm, geom=list(drop), context='VERTS')
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bevel_bm(bm, bevel, 1)
    return _mesh_obj(name, bm, material, parent)


def box(name, size, loc=(0, 0, 0), material='hull', parent=None, rot=(0, 0, 0), bevel=0.0, seg=1):
    """size = (x, y, z) full dimensions; loc = centre."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bevel_bm(bm, bevel, seg)
    _place(bm, loc, rot, (1, 1, 1))
    return _mesh_obj(name, bm, material, parent)


def cyl(name, r, h, loc=(0, 0, 0), material='steel', parent=None, rot=(0, 0, 0), verts=12, r2=None,
        bevel=0.0, cap=True):
    """Cylinder (or cone when r2 given) standing on +Z, centred at loc."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=r,
                          radius2=r if r2 is None else r2, depth=h)
    bevel_bm(bm, bevel)
    _place(bm, loc, rot, (1, 1, 1))
    return _mesh_obj(name, bm, material, parent)


def ico(name, r, loc=(0, 0, 0), material='leaf', parent=None, rot=(0, 0, 0), scale=(1, 1, 1), sub=1,
        jitter=0.0, rng=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    if jitter and rng:
        for v in bm.verts:
            v.co *= 1 + (rng.random() - 0.5) * jitter
    _place(bm, loc, rot, scale)
    return _mesh_obj(name, bm, material, parent)


def sphere(name, r, loc=(0, 0, 0), material='hull', parent=None, scale=(1, 1, 1), segs=16, rings=8,
           upper_only=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    if upper_only:
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    _place(bm, loc, (0, 0, 0), scale)
    return _mesh_obj(name, bm, material, parent)


def torus(name, R, r, loc=(0, 0, 0), material='steel', parent=None, rot=(0, 0, 0), seg=16, tube=6,
          arc=2 * math.pi):
    bm = bmesh.new()
    rings = []
    n = seg if arc >= 2 * math.pi - 1e-6 else seg + 1
    for i in range(n):
        a = arc * i / seg
        c = Vector((math.cos(a) * R, math.sin(a) * R, 0))
        out = Vector((math.cos(a), math.sin(a), 0))
        ring = []
        for j in range(tube):
            b = 2 * math.pi * j / tube
            ring.append(bm.verts.new(c + out * (math.cos(b) * r) + Vector((0, 0, math.sin(b) * r))))
        rings.append(ring)
    for i in range(seg if n == seg else seg):
        a_ring, b_ring = rings[i], rings[(i + 1) % n]
        for j in range(tube):
            bm.faces.new((a_ring[j], a_ring[(j + 1) % tube], b_ring[(j + 1) % tube], b_ring[j]))
    _place(bm, loc, rot, (1, 1, 1))
    return _mesh_obj(name, bm, material, parent)


def strut(name, a, b, r, material='steel', parent=None, verts=6):
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=d.length)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts)
    return _mesh_obj(name, bm, material, parent)


def blade(name, length, width, bend, loc, yaw, tilt, material='leaf', parent=None, segs=4, twist=0.0):
    """A tapered, curving leaf blade: grows along +Z, bends toward +X, then yaw / tilt."""
    bm = bmesh.new()
    left, right = [], []
    for i in range(segs + 1):
        t = i / segs
        w = width * (1 - t) ** 0.8 * (0.6 + 0.4 * math.sin(math.pi * min(1, t * 1.6)))
        x = bend * t * t * length
        z = length * t * (1 - 0.25 * bend * t)
        tw = twist * t
        left.append(bm.verts.new((x - math.sin(tw) * w * 0.3, -w / 2 * math.cos(tw), z)))
        right.append(bm.verts.new((x + math.sin(tw) * w * 0.3, w / 2 * math.cos(tw), z)))
    for i in range(segs):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    rot = Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'Y')
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(loc)) @ rot, verts=bm.verts)
    return _mesh_obj(name, bm, material, parent)


def lathe(name, profile, loc=(0, 0, 0), material='hull', parent=None, verts=16):
    """profile: list of (radius, z) from bottom to top."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(verts):
            a = 2 * math.pi * i / verts
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(verts):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % verts], rings[k + 1][(i + 1) % verts], rings[k + 1][i]))
    if profile[0][0] > 0:
        bm.faces.new(list(reversed(rings[0])))
    if profile[-1][0] > 0:
        bm.faces.new(rings[-1])
    _place(bm, loc, (0, 0, 0), (1, 1, 1))
    return _mesh_obj(name, bm, material, parent)


# ---------------------------------------------------------------- finishing

def join_by_material(root):
    """Merge every mesh under each node empty into one object per material (few draw calls)."""
    bpy.context.view_layer.update()
    groups = {}
    for o in [o for o in root.children_recursive if o.type == 'MESH']:
        node = o.parent
        groups.setdefault((node.name, o.data.materials[0].name), []).append(o)
    for (node_name, mname), objs in groups.items():
        if len(objs) < 2:
            objs[0].name = f'{node_name}.{mname}'
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f'{node_name}.{mname}'


def export(path):
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            for p in o.data.polygons:
                p.use_smooth = False
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_extras=True,
                              export_yup=True, export_materials='EXPORT', use_selection=False)


def stats():
    tris = 0
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            tris += len(o.data.loop_triangles)
    return tris
