"""Render built models side by side to a PNG, for a quick look while modelling (spec #5 §7).

Headless:  blender --background --factory-startup --python art/preview.py -- out.png knight pawn
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
GAP = 1.4


def arguments():
    ids = globals().get('ART_IDS')
    path = globals().get('PREVIEW_PATH')
    if path is None:
        rest = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
        path, ids = rest[0], rest[1:]
    return Path(path), list(ids)


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
        for i, model_id in enumerate(ids):
            before = set(scene.objects)
            bpy.ops.import_scene.gltf(filepath=str(MODELS / f'{model_id}.glb'))
            for obj in set(scene.objects) - before:
                if obj.parent is None:
                    obj.location.x += (i - (len(ids) - 1) / 2) * GAP
        camera = bpy.data.objects.new('PreviewCamera', bpy.data.cameras.new('PreviewCamera'))
        scene.collection.objects.link(camera)
        distance = max(4.0, len(ids) * GAP * 1.6)
        camera.location = (distance * 0.5, -distance, 2.0)  # a three-quarter view: faces and profiles both show
        camera.rotation_euler = (Vector((0.0, 0.0, 0.55)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
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
