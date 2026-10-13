"""A portal's end (spec #5 §4.2, A13; the user's pick at the third Step 2 review): a glossy splat where
the piece is dropped out, a flat splash with a soft rounded edge and a few droplets thrown clear of it.
White Tint, so it takes the pair's colour; the game lays the pair's symbol on its flat top
(PARTS.splat.top). Everything stays inside PARTS.splat.radius, clear of the neighbouring lanes."""
import math

from lib import finish, palette, shapes

TOP = 0.04       # the client's PARTS.splat.top
REACH = 0.43     # the client's PARTS.splat.radius
POINTS = 24
ROLL = 0.025     # the rounded edge's radius
DROPS = [(0.55, 0.034), (2.2, 0.026), (3.75, 0.031), (5.2, 0.024)]  # (angle, radius) of each droplet


def edge(a):
    """The splat's radius at angle a: a lumpy splash, never past 0.4."""
    return 0.33 + 0.045 * math.sin(5 * a + 0.6) + 0.022 * math.sin(9 * a + 1.3)


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    outline = [(edge(a) * math.cos(a), edge(a) * math.sin(a)) for a in (i * math.tau / POINTS for i in range(POINTS))]
    # Up the side, then a quarter round over the edge to the flat top.
    layers = [(1.0, 0.0), (1.0, TOP - ROLL)]
    for k in (1, 2, 3):
        a = math.pi / 2 * k / 3
        inset = ROLL * (1 - math.cos(a))
        layers.append(((0.33 - inset) / 0.33, TOP - ROLL + ROLL * math.sin(a)))
    parts = [shapes.stack('splat', outline, layers, tint, flat_top=True)]
    for i, (a, r) in enumerate(DROPS):
        reach = min(REACH - r - 0.005, edge(a) + r + 0.035)
        drop = shapes.revolve(f'drop{i}', [(0, 0), (r, 0), (r * 0.86, r * 0.35), (r * 0.5, r * 0.6), (0, r * 0.66)], tint, segments=10)
        drop.location = (reach * math.cos(a), reach * math.sin(a), 0.0)
        parts.append(drop)
    return parts
