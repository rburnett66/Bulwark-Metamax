"""Smoke test for headless Blender: model, render, export.  [MM-task_mvzrtapf_1y]

    python3 tools/blender/smoke.py <out_dir>

Exits non-zero if bevel + boolean modeling, a Cycles CPU render or a GLB export fails.
"""
import os
import sys
import time

import bpy

out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=2)
hull = bpy.context.object
bev = hull.modifiers.new("bevel", "BEVEL")
bev.width, bev.segments = 0.15, 3
bpy.ops.mesh.primitive_cylinder_add(radius=0.6, depth=3)
cutter = bpy.context.object
cutter.hide_render = True
cut = hull.modifiers.new("cut", "BOOLEAN")
cut.object, cut.operation = cutter, "DIFFERENCE"

bpy.ops.object.camera_add(location=(5, -5, 4), rotation=(1.05, 0, 0.785))
scene = bpy.context.scene
scene.camera = bpy.context.object
bpy.ops.object.light_add(type="SUN", location=(3, -2, 5))

# Cycles on the CPU: Eevee needs a GPU and falls back to slow software GL in a container.
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
scene.render.resolution_x = scene.render.resolution_y = 256
# Absolute path, no braces: Blender 5 treats "//" as blend-relative and {…} as a path template.
png = os.path.join(out, "smoke.png")
scene.render.filepath = png
t = time.time()
bpy.ops.render.render(write_still=True)
render_s = time.time() - t

bpy.ops.object.select_all(action="DESELECT")
hull.select_set(True)
glb = os.path.join(out, "smoke.glb")
bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True)

ok = os.path.getsize(png) > 0 and os.path.getsize(glb) > 0
tris = sum(len(p.vertices) - 2 for p in hull.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.polygons)
print(f"blender {bpy.app.version_string}: render {render_s:.1f}s, glb {os.path.getsize(glb)} B, {tris} tris — {'OK' if ok else 'FAILED'}")
sys.exit(0 if ok else 1)
