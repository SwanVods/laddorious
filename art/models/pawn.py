"""The pawn (spec #5 §4.1): the mockup's turned pawn with a ball head, all in the seat colour."""
from lib import finish, palette, shapes

PROFILE = [(0, 0), (0.36, 0), (0.37, 0.04), (0.35, 0.1), (0.27, 0.13), (0.25, 0.18), (0.18, 0.22), (0.14, 0.34), (0.115, 0.5), (0.11, 0.56), (0.2, 0.6), (0.21, 0.63), (0.12, 0.67), (0, 0.67)]


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    return [
        shapes.revolve('body', PROFILE, seat),
        shapes.sphere('head', 0.19, seat, location=(0.0, 0.0, 0.82), segments=32, rings=20),
    ]
