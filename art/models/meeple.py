"""The meeple (spec #5 §4.1): the mockup's chunky meeple, thick and pillowy, rounded all round."""
from lib import finish, palette, sculpt, shapes

SHADOW = 400  # triangles in the stand-in that casts its shadow in the game (spec #5 §6)

BODY = [('M', -0.36, 0), ('L', -0.1, 0), ('Q', 0, 0.24, 0.1, 0), ('L', 0.36, 0), ('Q', 0.3, 0.2, 0.2, 0.34),
        ('Q', 0.42, 0.38, 0.4, 0.5), ('Q', 0.36, 0.6, 0.16, 0.6), ('Q', 0.24, 0.74, 0.16, 0.84), ('Q', 0, 0.96, -0.16, 0.84),
        ('Q', -0.24, 0.74, -0.16, 0.6), ('Q', -0.36, 0.6, -0.4, 0.5), ('Q', -0.42, 0.38, -0.2, 0.34), ('Q', -0.3, 0.2, -0.36, 0)]
DEPTH = 0.4    # thick enough to read as a solid figure when seen edge-on
ROUND = 0.07   # the edge rounding, which also grows the outline all round


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    # Lifted by the rounding, so the feet rest on the floor.
    body = shapes.outline('body', BODY, DEPTH, seat, bevel=ROUND, view='front', offset=(0.0, ROUND), resolution=16)
    return [sculpt.fuse('meeple', [(body, seat)], blend=0.0, soften=0.03, target=8000)]
