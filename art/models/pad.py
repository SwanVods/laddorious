"""A launch pad (spec #5 §4.2): a glossy mint spring pad, one turned surface from a round foot through a
soft two-swell spring up to a thick plate, with a big dark arrow sunk into the plate pointing forward
(-Y here, +Z in the game), which the game turns toward the landing tile."""
import math

from lib import finish, palette, sculpt, shapes

SEGMENTS = 28
# A wide round foot, and a smaller plate with a gently domed top, so the spring shows between them.
FOOT = [(0, 0), (0.52, 0), (0.56, 0.01), (0.572, 0.03), (0.555, 0.048), (0.5, 0.058), (0.4, 0.062)]
PLATE = [(0.4, 0.136), (0.455, 0.142), (0.482, 0.158), (0.484, 0.18), (0.465, 0.198), (0.42, 0.206), (0.25, 0.211), (0, 0.213)]
TOP = 0.206  # the plate's top where the arrow's rim meets it
SINK = 0.02  # how deep the arrow is sunk below that
ARROW = [('M', 0, 0.36), ('L', 0.25, 0.1), ('L', 0.1, 0.1), ('L', 0.1, -0.2), ('L', -0.1, -0.2), ('L', -0.1, 0.1), ('L', -0.25, 0.1), ('L', 0, 0.36)]


def spring(swells=2, steps=8, low=0.07, high=0.13, middle=0.37, swell=0.034):
    """The coil between foot and plate as a wavy waist: narrow, then `swells` round swells, then narrow."""
    points = []
    for i in range(steps + 1):
        t = i / steps
        points.append((middle - swell * math.cos(t * swells * math.tau), low + t * (high - low)))
    return points


def build():
    pad = finish.glossy('Pad', palette.MINT)
    arrow = finish.glossy('Arrow', palette.INK)
    body = shapes.revolve('pad', FOOT + spring() + PLATE, pad, segments=SEGMENTS)
    cutter = shapes.outline('arrow', ARROW, 0.06, arrow, bevel=0.006, view='top', resolution=1, lift=TOP - SINK)
    return [sculpt.carve('pad', (body, pad), [(cutter, arrow)])]
