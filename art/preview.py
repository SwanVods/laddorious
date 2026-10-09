"""Render built models side by side to a PNG, for a quick look while modelling (spec #5 §7).

Headless:  blender --background --factory-startup --python art/preview.py -- out.png knight pawn
           (an id written pawn:shadow shows the model's shadow stand-in instead)
Blender link: exec it like build.py, with ART_IDS and PREVIEW_PATH in its globals.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
MODELS = ART.parent / 'apps' / 'client' / 'public' / 'models'
SCENE = 'ArtPreview'


def arguments():
    ids = globals().get('ART_IDS')
    path = globals().get('PREVIEW_PATH')
    if path is None:
        rest = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
        path, ids = rest[0], rest[1:]
    return Path(path), list(ids)


def extent(roots):
    """The world bounds of imported objects and everything under them: (lowest corner, highest corner)."""
    corners = [obj.matrix_world @ Vector(c) for root in roots for obj in (root, *root.children_recursive) if obj.type == 'MESH' for c in obj.bound_box]
    return (Vector([min(c[k] for c in corners) for k in range(3)]), Vector([max(c[k] for c in corners) for k in range(3)]))


def main():
    path, ids = arguments()
    window = bpy.context.window
    home = window.scene if window else None
    scene = bpy.context.scene if window is None else (bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE))
    if window:
        window.scene = scene
    try:
        for obj in list(scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        groups = []
        for model_id in ids:
            name, _, view = model_id.partition(':')
            before = set(scene.objects)
            bpy.ops.import_scene.gltf(filepath=str(MODELS / f'{name}.glb'))
            added = set(scene.objects) - before
            # The game never shows the shadow stand-in: leave it out, or show only it (`pawn:shadow`).
            for obj in list(added):
                stand = obj.type == 'MESH' and any(m and m.name.startswith('Shadow') for m in obj.data.materials)
                if stand != (view == 'shadow'):
                    added.discard(obj)
                    bpy.data.objects.remove(obj, do_unlink=True)
            groups.append([obj for obj in added if obj.parent is None])
        bpy.context.view_layer.update()
        sizes = [extent(roots) for roots in groups]
        gap = max(hi.x - lo.x for lo, hi in sizes) + 0.4
        for i, (roots, (lo, hi)) in enumerate(zip(groups, sizes)):
            shift = (i - (len(groups) - 1) / 2) * gap - (lo.x + hi.x) / 2
            for obj in roots:
                obj.location.x += shift
        low = min(lo.z for lo, _ in sizes)
        tall = max(hi.z - lo.z for lo, hi in sizes)
        distance = max(4.0, max(len(groups) * gap, tall * 2.5) * 1.6)
        camera = bpy.data.objects.new('PreviewCamera', bpy.data.cameras.new('PreviewCamera'))
        scene.collection.objects.link(camera)
        camera.location = (distance * 0.5, -distance, low + tall * 0.5 + distance * 0.15)  # a three-quarter view
        camera.rotation_euler = (Vector((0.0, 0.0, low + tall * 0.45)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.clip_end = distance * 4
        scene.camera = camera
        sun = bpy.data.objects.new('PreviewSun', bpy.data.lights.new('PreviewSun', 'SUN'))
        sun.data.energy = 4.0
        sun.data.use_shadow = False  # the preview renderer's shadow edge is ragged on curved models
        sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-30))
        scene.collection.objects.link(sun)
        world = bpy.data.worlds.get('PreviewWorld') or bpy.data.worlds.new('PreviewWorld')
        world.use_nodes = True
        background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
        background.inputs[0].default_value = (0.03, 0.27, 0.26, 1.0)
        background.inputs[1].default_value = 0.7
        scene.world = world
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 600
        scene.view_settings.view_transform = 'Standard'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True, scene=scene.name)
    finally:
        if window and home:
            window.scene = home


if __name__ == '__main__':
    main()
