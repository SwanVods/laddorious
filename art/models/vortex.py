"""A slide's head (spec #5 §4.2): a dark whirlpool bowl whose three glowing ridges spiral down into its
eye, all one surface that rolls up into a glowing pink rim. The tile under it is solid, so the bowl
can't sink in: its rim stands up and the bowl dips to the tile, which reads as sunken. The game spins
it anticlockwise seen from above, so the ridges seem to pour inward."""
import math

from lib import finish, palette, shapes

ARMS = 3
RIDGE = [0.5, 1.0, 1.0, 0.5, 0, 0, 0, 0, 0]  # each arm's columns: a ridge across four, then the bowl
COLUMNS = ARMS * len(RIDGE)
EYE, EDGE, RINGS = 0.035, 0.295, 10
BOWL = [EYE * (EDGE / EYE) ** (i / (RINGS - 1)) for i in range(RINGS)]  # the bowl's rings, closer near the eye
RIM = [(0.307, 0.099), (0.326, 0.105), (0.345, 0.09), (0.35, 0.05), (0.33, 0.0)]  # (radius, height)
CURL = 1.5  # a log spiral's tightness: each ridge crosses the rings at the same slant, like water


def depth(r):
    """The bowl's surface height at radius r: a curve from the eye up to the rim."""
    return 0.008 + 0.08 * (r / EDGE) ** 1.6


def ridge(r):
    """How high the ridges stand at radius r: fading into the eye, so the surface stays smooth there."""
    return 0.016 * min(1.0, r / 0.12)


def turn(r):
    """A ridge's angle grows outward, so spun anticlockwise it seems to pour in."""
    return CURL * math.log(r / EYE)


def build():
    inside = finish.glossy('Inside', palette.SLIDE)
    glow = finish.glow('Glow', palette.PINK, 1.2)
    rows = []
    for r in BOWL:
        row = []
        for k in range(COLUMNS):
            a = k * math.tau / COLUMNS + turn(r)
            row.append((r * math.cos(a), r * math.sin(a), depth(r) + ridge(r) * RIDGE[k % len(RIDGE)]))
        rows.append(row)
    for r, z in RIM:
        rows.append([(r * math.cos(k * math.tau / COLUMNS + turn(EDGE)), r * math.sin(k * math.tau / COLUMNS + turn(EDGE)), z) for k in range(COLUMNS)])

    def paint(row, column):
        if row >= len(BOWL) - 1:
            return 1  # the rim, from the bowl's edge out
        on = RIDGE[column % len(RIDGE)] > 0 and RIDGE[(column + 1) % len(RIDGE)] > 0
        return 1 if on else 0

    return [shapes.grid('vortex', rows, [inside, glow], paint)]
