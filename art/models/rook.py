"""The rook (spec #5 §4.1): a turned castle tower in one piece, Staunton style: a moulded foot, a waist
that flares into a collar, and a hollowed top whose battlements are carved, not stuck on. An arched
door and two arrow slits are cut into the tower, dark inside."""
import math

from lib import finish, palette, sculpt, shapes

SHADOW = 400  # triangles in the stand-in that casts its shadow in the game (spec #5 §6)

TOWER = [(0, 0), (0.42, 0), (0.44, 0.035), (0.42, 0.07), (0.36, 0.1), (0.34, 0.135), (0.3, 0.165), (0.27, 0.21), (0.25, 0.3),
         (0.245, 0.45), (0.26, 0.57), (0.3, 0.63), (0.345, 0.665), (0.355, 0.705), (0.34, 0.74), (0.335, 0.94), (0, 0.94)]
HOLLOW = [(0, 0.84), (0.245, 0.84), (0.245, 1.2), (0, 1.2)]
DOOR = [('M', -0.07, 0), ('L', 0.07, 0), ('L', 0.07, 0.13), ('Q', 0.07, 0.21, 0, 0.21), ('Q', -0.07, 0.21, -0.07, 0.13), ('L', -0.07, 0)]


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    dark = finish.glossy('Door', palette.INK)
    tower = shapes.revolve('tower', TOWER, seat, segments=sculpt.FINE_TURN)
    cutters = [(shapes.revolve('hollow', HOLLOW, seat, segments=sculpt.FINE_TURN), None)]
    # Two bars across the top carve four notches between the battlements.
    for a in (math.pi / 4, 3 * math.pi / 4):
        cutters.append((shapes.rounded_box(f'crenel{a:.2f}', (0.14, 1.0, 0.3), 0.0, seat, location=(0.0, 0.0, 0.97), rotation=(0.0, 0.0, a), segments=1), None))
    # The door's recess on the front (-Y), and arrow slits on both sides.
    cutters.append((shapes.outline('door', DOOR, 0.16, dark, bevel=0.01, view='front', offset=(0.0, 0.22)), dark))
    cutters[-1][0].location.y = -0.3
    for s in (1, -1):
        cutters.append((shapes.rounded_box(f'slit{s}', (0.16, 0.035, 0.13), 0.012, dark, location=(s * 0.27, 0.0, 0.5), segments=2), dark))
    return [sculpt.fuse('rook', [(tower, seat)], cutters=cutters, voxel=0.005, blend=0.015, soften=0.015, target=9000)]
