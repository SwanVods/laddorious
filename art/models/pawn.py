"""The pawn (spec #5 §4.1): the mockup's turned pawn in one piece, its ball head growing out of the
collar, all in the seat colour."""
from lib import finish, palette, sculpt, shapes

SHADOW = 400  # triangles in the stand-in that casts its shadow in the game (spec #5 §6)
LOW = 0.3     # its Low quality file keeps this share of the sculpted triangles (spec #5 A14)

PROFILE = [(0, 0), (0.36, 0), (0.37, 0.04), (0.35, 0.1), (0.27, 0.13), (0.25, 0.18), (0.18, 0.22), (0.14, 0.34), (0.115, 0.5), (0.11, 0.56), (0.2, 0.6), (0.21, 0.63), (0.12, 0.67), (0, 0.67)]


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    body = shapes.revolve('body', PROFILE, seat, segments=sculpt.FINE_TURN)
    head = shapes.sphere('head', 0.19, seat, location=(0.0, 0.0, 0.82), **sculpt.FINE)
    return [sculpt.fuse('pawn', [(body, seat), (head, seat)], blend=0.035, soften=0.01, target=8000)]
