"""A clean scene per model, one merged mesh, and the glTF export (spec #5 §5)."""
import math

import bmesh
import bpy

SCENE = 'ArtBuild'
SHARP_ANGLE = 35  # degrees: faces meeting at more than this shade with a crisp edge
SHADOW = 'Shadow'  # the shadow stand-in's material: the game draws it only into the shadow map


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


def finish(scene, model_id, parts, path, shadow=None):
    """Merge the parts into one mesh (modifiers and transforms applied), export it to `path`, and report.

    With `shadow` (a triangle count), the file also carries a stand-in that small to cast the model's shadow."""
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
    mesh = _canonical(model_id, combined)
    combined.free()
    for material in materials:
        mesh.materials.append(material)
    for part in parts:
        bpy.data.objects.remove(part, do_unlink=True)
    scene.collection.objects.link(bpy.data.objects.new(model_id, mesh))
    mesh.calc_loop_triangles()
    heights = [v.co.z for v in mesh.vertices]
    stand = _shadow(scene, mesh, shadow) if shadow else 0
    _export(path)
    return {
        'id': model_id,
        'triangles': len(mesh.loop_triangles),
        'shadow': stand,
        'materials': [m.name for m in materials],
        'height': max(heights) - min(heights),
        'bytes': path.stat().st_size,
    }


def _shadow(scene, mesh, target):
    """Add the model's shadow stand-in (spec #5 §6): a copy decimated to about `target` triangles, in one
    material named Shadow. The game casts the shadow from it, so the shadow map draws a tenth of the model."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    for face in bm.faces:
        face.material_index = 0
    rough = bpy.data.meshes.new('shadow-rough')
    bm.to_mesh(rough)
    bm.free()
    obj = bpy.data.objects.new('shadow', rough)
    scene.collection.objects.link(obj)
    decimate = obj.modifiers.new('decimate', 'DECIMATE')
    decimate.decimate_type = 'COLLAPSE'
    decimate.ratio = min(1.0, target / max(1, len(rough.polygons)))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    small = bmesh.new()
    small.from_mesh(obj.evaluated_get(depsgraph).to_mesh())
    obj.evaluated_get(depsgraph).to_mesh_clear()
    obj.modifiers.clear()
    obj.data = _canonical('shadow', small)
    small.free()
    bpy.data.meshes.remove(rough)
    obj.data.materials.append(bpy.data.materials.get(SHADOW) or bpy.data.materials.new(SHADOW))
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)



def _canonical(name, bm):
    """The merged mesh as triangles in a fixed order, so an unchanged model rebuilds byte for byte.

    Some bmesh steps (merging doubles, dissolving degenerate faces) order their output by memory
    address, which changes from run to run. So: split into triangles by shape ("beauty"), sort the
    vertices by position (then normal), sort the triangles by their vertices, and start each at its
    lowest vertex (keeping its winding)."""
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    bm.normal_update()
    verts = sorted(bm.verts, key=lambda v: (tuple(round(c, 6) for c in v.co), tuple(round(c, 4) for c in v.normal)))
    index = {v: i for i, v in enumerate(verts)}
    faces = []
    for face in bm.faces:
        ids = [index[v] for v in face.verts]
        first = ids.index(min(ids))
        faces.append((face.material_index, ids[first:] + ids[:first], face.smooth))
    faces.sort(key=lambda f: (f[0], f[1]))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([v.co[:] for v in verts], [], [f[1] for f in faces])
    for polygon, (material_index, _, smooth) in zip(mesh.polygons, faces):
        polygon.material_index = material_index
        polygon.use_smooth = smooth
    # Shade smooth, but keep real creases crisp (a carved pip's rim); sculpted surfaces have none this sharp.
    mesh.set_sharp_from_angle(angle=math.radians(SHARP_ANGLE))
    mesh.update()
    return mesh


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
