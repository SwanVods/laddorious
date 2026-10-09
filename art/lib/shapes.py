"""Building blocks for the models (spec #5 §5).

Units are game units (1 tile = 1.6). Z is up and models face -Y (Blender's front view); the glTF
export turns that into Y up and +Z forward. Each builder returns one object with one material,
and export.finish() merges a model's parts into a single mesh.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def _object(name, bm, material, smooth=True):
    for face in bm.faces:
        face.smooth = smooth
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    return bpy.data.objects.new(name, mesh)


def revolve(name, profile, material, segments=48, smooth=True):
    """Turn a profile of (radius, height) points round the Z axis.

    A profile that starts and ends on the axis makes a closed solid (a pawn). A loop of points off
    the axis makes a ring (a hat band); its last point joins back to the first.
    """
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0.0, h)) for r, h in profile]
    edges = [bm.edges.new((a, b)) for a, b in zip(verts, verts[1:])]
    if profile[0][0] > 0 and profile[-1][0] > 0:
        edges.append(bm.edges.new((verts[-1], verts[0])))
    bmesh.ops.spin(bm, geom=verts + edges, axis=(0.0, 0.0, 1.0), cent=(0.0, 0.0, 0.0), steps=segments, angle=math.tau, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, material, smooth)


def sphere(name, radius, material, location=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0), segments=24, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    obj = _object(name, bm, material)
    obj.location = location
    obj.scale = scale
    return obj


def cone(name, radius, height, material, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0), segments=16):
    """A cone on its base with its tip up (+Z) before rotation; the base centre is its origin."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=0.0, depth=height, matrix=Matrix.Translation((0.0, 0.0, height / 2)))
    obj = _object(name, bm, material)
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def rounded_box(name, size, radius, material, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0), segments=4):
    """A box of size (x, y, z) centred on its origin, with edges rounded by `radius` (a bevel, applied at export)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    obj = _object(name, bm, material)
    bevel = obj.modifiers.new('round', 'BEVEL')
    bevel.width = radius
    bevel.segments = segments
    bevel.limit_method = 'NONE'
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def loft(name, rows, material, smooth=True):
    """A closed surface through rows of (x, y, z) points: each row is a loop, and the rows run round a
    loop too (the last joins the first). For shapes a profile can't simply spin into, like a crown's
    wall rising into points."""
    bm = bmesh.new()
    verts = [[bm.verts.new(point) for point in row] for row in rows]
    count = len(verts[0])
    for i, row in enumerate(verts):
        nxt = verts[(i + 1) % len(verts)]
        for k in range(count):
            bm.faces.new((row[k], row[(k + 1) % count], nxt[(k + 1) % count], nxt[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, material, smooth)


def tube(name, points, radius, material, sides=6, smooth=True):
    """A round tube along a path of (x, y, z) points, its ends open: a spring's coil, a spiral ridge.
    Open ends can't be fused (sculpt.fuse needs closed parts); fuse a chain of spheres instead."""
    bm = bmesh.new()
    rings = []
    for i, point in enumerate(points):
        ahead = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        across = ahead.cross(Vector((0.0, 0.0, 1.0)) if abs(ahead.z) < 0.9 else Vector((1.0, 0.0, 0.0))).normalized()
        up = across.cross(ahead)
        centre = Vector(point)
        rings.append([bm.verts.new(centre + (across * math.cos(a) + up * math.sin(a)) * radius) for a in (k * math.tau / sides for k in range(sides))])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, material, smooth)


def _lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def _bezier(commands):
    """A closed outline of M/L/Q commands as Bezier points: [point, left handle, right handle]."""
    points = []
    current = None
    for command in commands:
        kind = command[0]
        if kind == 'M':
            current = (command[1], command[2])
            points.append([current, current, current])
        elif kind == 'L':
            end = (command[1], command[2])
            points[-1][2] = _lerp(current, end, 1 / 3)
            points.append([end, _lerp(current, end, 2 / 3), end])
            current = end
        else:  # 'Q': a control point, then the end point
            control = (command[1], command[2])
            end = (command[3], command[4])
            points[-1][2] = _lerp(current, control, 2 / 3)
            points.append([end, _lerp(end, control, 2 / 3), end])
            current = end
    first, last = points[0], points[-1]
    if math.dist(first[0], last[0]) < 1e-6:
        # The outline ends where it began: the last point's incoming handle belongs to the first.
        first[1] = last[1]
        points.pop()
    else:
        last[2] = _lerp(last[0], first[0], 1 / 3)
        first[1] = _lerp(last[0], first[0], 2 / 3)
    return points


def outline(name, commands, depth, material, bevel=0.045, view='side', offset=(0.0, 0.0), resolution=12, lift=0.0):
    """Extrude a closed outline drawn with M/L/Q commands (x across, y up) to `depth` in all, its
    edges rounded by `bevel` (the rounding grows the outline by `bevel` all round).

    view='side': x is the model's forward (-Y) and the outline is extruded across X (a knight's head).
    view='front': x is the model's right (+X) and the outline is extruded along Y (a meeple).
    view='top': the outline lies flat, its base at z = lift; the drawing's x is the model's left to right
    and its up (+y) is the model's forward (-Y). It's turned half round, a rotation, not a mirror.
    `offset` moves the outline by (x, y) in its own drawing.
    """
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.resolution_u = resolution
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    curve.extrude = max(0.001, depth / 2 - bevel)
    points = _bezier(commands)
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    spline.use_cyclic_u = True
    spline.use_smooth = True
    for bp, (point, left, right) in zip(spline.bezier_points, points):
        bp.handle_left_type = 'FREE'
        bp.handle_right_type = 'FREE'
        bp.co = (point[0], point[1], 0.0)
        bp.handle_left = (left[0], left[1], 0.0)
        bp.handle_right = (right[0], right[1], 0.0)
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    dx, dy = offset
    if view == 'side':
        obj.rotation_euler = (math.pi / 2, 0.0, -math.pi / 2)
        obj.location = (0.0, -dx, dy)
    elif view == 'front':
        obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
        obj.location = (dx, 0.0, dy)
    elif view == 'top':
        obj.rotation_euler = (0.0, 0.0, math.pi)
        obj.location = (-dx, -dy, lift + depth / 2)
    else:
        raise ValueError(f'unknown view {view!r}')
    return obj
