"""A clean scene per model, one merged mesh, and the glTF export (spec #5 §5)."""
import bmesh
import bpy

SCENE = 'ArtBuild'


def begin():
    """An empty scene for the next model.

    Headless (`pnpm art`, a factory-fresh Blender), the default scene is used. Through the Blender
    link a scene of its own, so the open file's objects are never touched; build.py switches back.
    """
    window = bpy.context.window
    if window is None:
        scene = bpy.context.scene
    else:
        scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
        window.scene = scene
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    _purge()
    return scene


def _purge():
    """Drop the data the last model left behind, so names like Seat stay free."""
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def finish(scene, model_id, parts, path):
    """Merge the parts into one mesh (modifiers and transforms applied), export it to `path`, and report."""
    for part in parts:
        scene.collection.objects.link(part)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    combined = bmesh.new()
    materials = []
    for part in parts:
        evaluated = part.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        remap = []
        for evaluated_material in mesh.materials:
            # The evaluated mesh holds the scene graph's own copies of the materials, which the next
            # update frees: keep the originals, or the export reads a freed material and crashes.
            material = evaluated_material.original
            if material not in materials:
                materials.append(material)
            remap.append(materials.index(material))
        # Append the part to the combined bmesh, and move only its own vertices into place.
        old_verts = set(combined.verts)
        old_faces = set(combined.faces)
        combined.from_mesh(mesh)
        bmesh.ops.transform(combined, matrix=evaluated.matrix_world, verts=[v for v in combined.verts if v not in old_verts])
        for face in combined.faces:
            if face not in old_faces:
                face.material_index = remap[face.material_index]
        evaluated.to_mesh_clear()
    mesh = bpy.data.meshes.new(model_id)
    combined.to_mesh(mesh)
    combined.free()
    for material in materials:
        mesh.materials.append(material)
    for part in parts:
        bpy.data.objects.remove(part, do_unlink=True)
    scene.collection.objects.link(bpy.data.objects.new(model_id, mesh))
    mesh.calc_loop_triangles()
    heights = [v.co.z for v in mesh.vertices]
    _export(path)
    return {
        'id': model_id,
        'triangles': len(mesh.loop_triangles),
        'materials': [m.name for m in materials],
        'height': max(heights) - min(heights),
        'bytes': path.stat().st_size,
    }


def _export(path):
    """glTF binary of the scene: Y up, modifiers applied, no cameras, lights or animation, no UVs."""
    operator = bpy.ops.export_scene.gltf
    known = {p.identifier for p in operator.get_rna_type().properties}
    wanted = {
        'filepath': str(path),
        'export_format': 'GLB',
        'use_active_scene': True,
        'use_selection': False,
        'export_apply': True,
        'export_yup': True,
        'export_cameras': False,
        'export_lights': False,
        'export_animations': False,
        'export_materials': 'EXPORT',
        'export_texcoords': False,
        'export_normals': True,
        'export_extras': False,
    }
    operator(**{k: v for k, v in wanted.items() if k in known})
