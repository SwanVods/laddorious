"""Sculpted models: parts fused into one continuous surface (spec #5, the user's Step 1 review).

A model isn't a set of shapes stuck together. fuse() turns each part into a distance field (Blender's
SDF grid nodes), unites them, fills the creases where they meet with curves (a closing), carves the
cutters out, rounds every edge (an opening), and meshes the result. Then it thins the surface to a
triangle target and paints each face with the material of the part (or cutter) it lies nearest: a
beak stays orange where it grows out of the head, and a door's recess stays dark.
"""
import bmesh
import bpy
from mathutils.bvhtree import BVHTree

# The voxel grid copies its input faithfully, facets and all, so parts built for fusing need many sides:
# pass these to shapes.sphere (FINE) and shapes.revolve (segments=FINE_TURN).
FINE = {'segments': 64, 'rings': 48}
FINE_TURN = 96


def _world_bmesh(obj, depsgraph):
    """An object's evaluated mesh (modifiers applied) in world space, as a bmesh."""
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.transform(evaluated.matrix_world)
    evaluated.to_mesh_clear()
    return bm


def _as_mesh(obj, depsgraph):
    """A mesh object standing in for `obj` (a curve, say), with its modifiers and place baked in."""
    if obj.type == 'MESH' and not obj.modifiers:
        return obj
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    mesh.transform(obj.matrix_world)
    stand_in = bpy.data.objects.new(f'{obj.name}-mesh', mesh)
    bpy.context.scene.collection.objects.link(stand_in)
    bpy.data.objects.remove(obj, do_unlink=True)
    return stand_in


def _colour_edges(obj):
    """A vertex group on the vertices where faces of different materials meet (and, at full detail, their neighbours)."""
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    edge = set()
    for e in bm.edges:
        if len({f.material_index for f in e.link_faces}) > 1:
            edge.update(v.index for v in e.verts)
    near = set(edge)
    # A Low file (DETAIL under 1) keeps only the boundary itself, so it can thin to its share.
    if DETAIL >= 1:
        for v in bm.verts:
            if v.index in edge:
                near.update(n.index for e2 in v.link_edges for n in e2.verts)
    bm.free()
    group = obj.vertex_groups.new(name='colour-edges')
    if near:
        group.add(sorted(near), 1.0, 'REPLACE')
    return group.name


def _apply(obj, kind, **settings):
    """Apply one modifier by baking the evaluated mesh into the object's own data."""
    modifier = obj.modifiers.new(kind.lower(), kind)
    for key, value in settings.items():
        setattr(modifier, key, value)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    baked = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    old = obj.data
    obj.modifiers.clear()
    obj.data = baked
    bpy.data.meshes.remove(old)


def _sdf_tree(solids, cutters, voxel, blend, soften, smooth, adaptivity=0.0):
    """The node tree that builds the fused surface from the parts' distance fields."""
    tree = bpy.data.node_groups.new('fuse', 'GeometryNodeTree')
    tree.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nodes, links = tree.nodes, tree.links

    def field_of(mesh):
        grid = nodes.new('GeometryNodeMeshToSDFGrid')
        grid.inputs['Voxel Size'].default_value = voxel
        grid.inputs['Band Width'].default_value = 4 + round(max(blend, soften) / voxel) + smooth
        links.new(mesh, grid.inputs['Mesh'])
        return grid.outputs['SDF Grid']

    def mesh_of(grid, adapt=0.0):
        mesh = nodes.new('GeometryNodeGridToMesh')
        mesh.inputs['Threshold'].default_value = 0.0  # the surface itself (the default draws it 0.1 out)
        mesh.inputs['Adaptivity'].default_value = adapt
        links.new(grid, mesh.inputs['Grid'])
        return mesh.outputs['Mesh']

    def field(obj):
        info = nodes.new('GeometryNodeObjectInfo')
        info.transform_space = 'RELATIVE'
        info.inputs['Object'].default_value = obj
        return field_of(info.outputs['Geometry'])

    def socket(node, identifier):
        return next(s for s in node.inputs if s.identifier == identifier)

    def combine(grids, operation, base=None):
        """Union takes every field in one input; a difference takes the base, then every cutter."""
        node = nodes.new('GeometryNodeSDFGridBoolean')
        node.operation = operation
        if base is not None:
            links.new(base, socket(node, 'Grid 1'))
        for grid in grids:
            links.new(grid, socket(node, 'Grid 2'))
        return node.outputs['Grid']

    def step(kind, grid, **inputs):
        node = nodes.new(kind)
        links.new(grid, node.inputs['Grid'])
        for key, value in inputs.items():
            node.inputs[key].default_value = value
        return node.outputs['Grid']

    grid = combine([field(obj) for obj in solids], 'UNION')
    if blend:
        # A closing: grow the united shape by `blend`, measure the grown shape afresh, then shrink it
        # back. Creases where parts meet fill with a curve of that radius; convex shapes come back as
        # they were. (Offsets alone just cancel: the field has to be re-measured in between.)
        grown = mesh_of(step('GeometryNodeSDFGridOffset', grid, Distance=blend))  # positive grows
        grid = step('GeometryNodeSDFGridOffset', field_of(grown), Distance=-blend)
    if cutters:
        grid = combine([field(obj) for obj in cutters], 'DIFFERENCE', base=grid)
    if soften:
        # An opening: shrink, re-measure, grow back. Convex edges (a cut's rim, a battlement's corner)
        # round off with a curve of radius `soften`, like a moulded toy.
        shrunk = mesh_of(step('GeometryNodeSDFGridOffset', grid, Distance=-soften))
        grid = step('GeometryNodeSDFGridOffset', field_of(shrunk), Distance=soften)
    if smooth:
        grid = step('GeometryNodeSDFGridMean', grid, Width=1, Iterations=smooth)
    links.new(mesh_of(grid, adaptivity), nodes.new('NodeGroupOutput').inputs[0])
    return tree


# How much of each fuse() target to keep: 1 for the models, less for a Low quality file (spec #5 A14).
DETAIL = 1.0


def fuse(name, solids, cutters=(), voxel=0.006, blend=0.05, soften=0.012, smooth=2, target=10000, adaptivity=0.0):
    """One sculpted object from `solids`, minus `cutters`.

    solids, cutters: lists of (object, material). A cutter's material paints the walls of the hole it
    cuts; with None they take the colour of what's around them. Solids must be closed (no open tubes).
    voxel: the grid the surface is rebuilt on (smaller keeps finer detail).
    blend: the radius of the curves that fill the creases where parts meet.
    soften: the radius every convex edge rounds off to (cut rims, corners).
    smooth: smoothing passes after the cut, which also round the cut edges.
    target: the triangles to thin down to (a target, not a cap).
    adaptivity: 0 meshes evenly; up to 1 lets flat areas take bigger faces (a die's sides) instead of
    thinning, which on flats leaves long slivers that shade in streaks.
    """
    scene = bpy.context.scene
    for obj, _ in [*solids, *cutters]:
        scene.collection.objects.link(obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    # The distance fields come from meshes, so curves (outlines) become meshes first.
    solids = [(_as_mesh(obj, depsgraph), material) for obj, material in solids]
    cutters = [(_as_mesh(obj, depsgraph), material) for obj, material in cutters]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()

    # Each part and painting cutter keeps a lookup tree for the materials.
    sources = []
    for obj, material in solids:
        bm = _world_bmesh(obj, depsgraph)
        sources.append((BVHTree.FromBMesh(bm), material))
        bm.free()
    for obj, material in cutters:
        if material is not None:
            bm = _world_bmesh(obj, depsgraph)
            sources.append((BVHTree.FromBMesh(bm), material))
            bm.free()

    # The surface itself comes from distance fields (Blender's SDF grid nodes): each part's field,
    # united, blended where parts meet, minus the cutters, rounded at every edge, then meshed.
    result = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    scene.collection.objects.link(result)
    tree = _sdf_tree([o for o, _ in solids], [o for o, _ in cutters], voxel, blend, soften, smooth, adaptivity)
    result.modifiers.new('fuse', 'NODES').node_group = tree
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    baked = bpy.data.meshes.new_from_object(result.evaluated_get(depsgraph))
    old = result.data
    result.modifiers.clear()
    result.data = baked
    bpy.data.meshes.remove(old)
    bpy.data.node_groups.remove(tree)
    for obj, _ in [*solids, *cutters]:
        bpy.data.objects.remove(obj, do_unlink=True)

    # Paint the dense surface: each face takes the material of its nearest source. Painting before
    # thinning keeps the colour edges (a bill's rim, a door's frame) as fine as the voxels.
    materials = []
    for _, material in sources:
        if material not in materials:
            materials.append(material)
    result.data.materials.clear()  # the meshed surface arrives with an empty slot of its own
    for material in materials:
        result.data.materials.append(material)
    for polygon in result.data.polygons:
        centre = polygon.center
        nearest = min(sources, key=lambda s: s[0].find_nearest(centre)[3])
        polygon.material_index = materials.index(nearest[1])

    triangles = sum(len(p.vertices) - 2 for p in result.data.polygons)
    target = max(200, int(target * DETAIL))
    if triangles > target:
        # Thin the surface, but leave the colour edges alone so they stay smooth.
        edges = _colour_edges(result)
        _apply(result, 'DECIMATE', decimate_type='COLLAPSE', ratio=target / triangles, vertex_group=edges, invert_vertex_group=True)
    for polygon in result.data.polygons:
        polygon.use_smooth = True
    scene.collection.objects.unlink(result)
    return result


def carve(name, solid, cutters):
    """A hard solid with holes cut cleanly (exact booleans), for things like the die: no blending and no
    voxels, so flat faces stay flat and the holes' rims stay crisp. Each hole's walls take its cutter's
    material; the rest keeps the solid's. solid: (object, material); cutters: list of (object, material)."""
    scene = bpy.context.scene
    body, material = solid
    for obj in [body, *[c for c, _ in cutters]]:
        scene.collection.objects.link(obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    body = _as_mesh(body, depsgraph)
    # All the cutters as one object, so a single boolean cuts every hole.
    verts, faces, sources = [], [], []
    for obj, cut_material in cutters:
        bm = _world_bmesh(obj, depsgraph)
        offset = len(verts)
        verts.extend(v.co.copy() for v in bm.verts)
        faces.extend([offset + v.index for v in f.verts] for f in bm.faces)
        sources.append((BVHTree.FromBMesh(bm), cut_material))
        bm.free()
    tools = bpy.data.objects.new(f'{name}-cutters', bpy.data.meshes.new(f'{name}-cutters'))
    tools.data.from_pydata(verts, [], faces)
    scene.collection.objects.link(tools)
    _apply(body, 'BOOLEAN', operation='DIFFERENCE', object=tools, solver='EXACT')
    for obj in [tools, *[c for c, _ in cutters]]:
        bpy.data.objects.remove(obj, do_unlink=True)

    materials = [material] + [m for _, m in sources if m is not material]
    materials = list(dict.fromkeys(materials))
    body.data.materials.clear()  # the boolean copies the cutters' slots in; paint every face afresh
    for m in materials:
        body.data.materials.append(m)
    for polygon in body.data.polygons:
        index = 0
        for tree, cut_material in sources:
            if tree.find_nearest(polygon.center)[3] < 1e-4:
                index = materials.index(cut_material)
                break
        polygon.material_index = index
        polygon.use_smooth = True
    body.name = name
    scene.collection.objects.unlink(body)
    return body
