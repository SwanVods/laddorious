"""The meeple (spec #5 §4.1): the mockup's chunky meeple, seen from the front and rounded all round."""
from lib import finish, palette, shapes

BODY = [('M', -0.36, 0), ('L', -0.1, 0), ('Q', 0, 0.24, 0.1, 0), ('L', 0.36, 0), ('Q', 0.3, 0.2, 0.2, 0.34),
        ('Q', 0.42, 0.38, 0.4, 0.5), ('Q', 0.36, 0.6, 0.16, 0.6), ('Q', 0.24, 0.74, 0.16, 0.84), ('Q', 0, 0.96, -0.16, 0.84),
        ('Q', -0.24, 0.74, -0.16, 0.6), ('Q', -0.36, 0.6, -0.4, 0.5), ('Q', -0.42, 0.38, -0.2, 0.34), ('Q', -0.3, 0.2, -0.36, 0)]
DEPTH = 0.34


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    # Lifted by the rounding, so the feet rest on the floor.
    return [shapes.outline('body', BODY, DEPTH, seat, view='front', offset=(0.0, 0.045))]
