"""A slide's head (spec #5 §4.2, A13): a dark whirlpool bowl whose three ridges spiral down toward its
eye, all one surface that rolls up into a rim. The ridges and rim are white Tint, so they take the
pair's colour; the bowl stays dark. The eye sits under the still cap the game puts there (PARTS.cap),
with the pair's symbol on it. The tile under it is solid, so the bowl can't sink in: its rim stands up
and the bowl dips to the tile, which reads as sunken. The game spins it anticlockwise seen from above,
so the ridges seem to pour inward."""
import math

from lib import finish, palette, shapes

ARMS = 3
RIDGE = [0.5, 1.0, 1.0, 0.5, 0, 0, 0, 0, 0]  # each arm's columns: a ridge across four, then the bowl
COLUMNS = ARMS * len(RIDGE)
EYE, EDGE, RINGS = 0.16, 0.36, 8  # the bowl runs from under the cap (radius 0.18) to the rim
BOWL = [EYE * (EDGE / EYE) ** (i / (RINGS - 1)) for i in range(RINGS)]  # its rings, closer near the eye
RIM = [(0.372, 0.1), (0.394, 0.108), (0.418, 0.1), (0.43, 0.072), (0.426, 0.03), (0.41, 0.0)]  # (radius, height)
CURL = 2.4  # a log spiral's tightness: each ridge crosses the rings at the same slant, like water


def depth(r):
    """The bowl's surface height at radius r: a curve from the eye up to the rim."""
    return 0.02 + 0.075 * ((r - EYE) / (EDGE - EYE)) ** 1.4


def turn(r):
    """A ridge's angle grows outward, so spun anticlockwise it seems to pour in."""
    return CURL * math.log(r / EYE)


def build():
    inside = finish.glossy('Inside', palette.SLIDE)
    tint = finish.glossy('Tint', palette.WHITE)
    rows = []
    for r in BOWL:
        rows.append([(r * math.cos(k * math.tau / COLUMNS + turn(r)), r * math.sin(k * math.tau / COLUMNS + turn(r)), depth(r) + 0.016 * RIDGE[k % len(RIDGE)]) for k in range(COLUMNS)])
    for r, z in RIM:
        rows.append([(r * math.cos(k * math.tau / COLUMNS + turn(EDGE)), r * math.sin(k * math.tau / COLUMNS + turn(EDGE)), z) for k in range(COLUMNS)])

    def paint(row, column):
        if row >= len(BOWL) - 1:
            return 1  # the rim, from the bowl's edge out
        on = RIDGE[column % len(RIDGE)] > 0 and RIDGE[(column + 1) % len(RIDGE)] > 0
        return 1 if on else 0

    return [shapes.grid('vortex', rows, [inside, tint], paint)]
