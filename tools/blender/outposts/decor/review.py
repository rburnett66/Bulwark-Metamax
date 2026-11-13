"""Review render for decor models: the flat and textured LODs side by side, from the outpost camera's angle.
[MM-story_mwfacvte_b]

    python tools/blender/outposts/decor/review.py <out_png> <model_dir> [<model_dir> …]

Each model_dir holds {slug}_flat.glb and {slug}_tex.glb (decor_common.build). Rendered with Cycles on the CPU on a
brown ground: one row per model, flat left, textured right, each model scaled to fill its tile.
"""
import glob
import math
import os
import sys

import bpy
from mathutils import Vector

out, dirs = sys.argv[1], sys.argv[2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
world = bpy.data.worlds.new("w")
s.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.44, 0.48, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.8

placed = []
for row, d in enumerate(dirs):
    for col, lod in enumerate(("flat", "tex")):
        f = glob.glob(os.path.join(d, f"*_{lod}.glb"))
        if not f:
            continue
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=f[0])
        objs = [o for o in bpy.context.scene.objects if o not in before]
        meshes = [o for o in objs if o.type == "MESH"]
        lo = Vector((1e9, 1e9, 1e9)); hi = -lo
        for o in meshes:
            for c in o.bound_box:
                p = o.matrix_world @ Vector(c)
                lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
        size = max((hi - lo).x, (hi - lo).y, (hi - lo).z) or 1
        k = 1.0 / size
        root = bpy.data.objects.new(f"root_{row}_{col}", None)
        bpy.context.scene.collection.objects.link(root)
        for o in objs:
            if o.parent is None:
                o.parent = root
        root.scale = (k, k, k)
        c = (lo + hi) / 2
        root.location = (col * 1.6 - c.x * k, -row * 1.6 - c.y * k, -lo.z * k)
        placed.append(root)

ground = bpy.data.meshes.new("g")
bpy.ops.mesh.primitive_plane_add(size=60, location=(0.8, -0.8 * (len(dirs) - 1), 0))
gm = bpy.data.materials.new("ground")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.27, 0.21, 0.19, 1)
bpy.context.active_object.data.materials.append(gm)

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(-35))
bpy.context.scene.collection.objects.link(sun)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(3.4, 1.6 * len(dirs) + 0.6)
bpy.context.scene.collection.objects.link(cam)
ctr = Vector((0.8, -0.8 * (len(dirs) - 1), 0.35))
yaw, pitch = math.radians(-90), math.radians(38)
cam.location = ctr + Vector((math.cos(pitch) * math.cos(yaw), math.cos(pitch) * math.sin(yaw), math.sin(pitch))) * 20
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
s.camera = cam
s.render.engine = "CYCLES"
s.cycles.device = "CPU"
s.cycles.samples = 24
s.render.resolution_x = 900
s.render.resolution_y = int(900 * max(1, len(dirs) * 1.6 + 0.6) / 3.4 * 0.62) + 80
s.view_settings.view_transform = "Standard"
s.render.filepath = os.path.abspath(out)
bpy.ops.render.render(write_still=True)
print("review →", out)
