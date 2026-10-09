"""A launch pad (spec #5 §4.2, A13): one turned piece, a wide round foot, a tall soft spring with two
swells you can see between foot and plate, and a thick plate whose flat top carries the pair's symbol
(the game lays it at PARTS.padTop). A dark notch cut into the plate's front edge points forward (-Y
here, +Z in the game), which the game turns toward the landing. White Tint: each pad takes its pair's
colour."""
import math

from lib import finish, palette, sculpt, shapes

SEGMENTS = 24
TOP = 0.31  # the client's PARTS.padTop
FOOT = [(0, 0), (0.535, 0), (0.567, 0.014), (0.575, 0.034), (0.555, 0.054), (0.46, 0.066)]
PLATE = [(0.38, 0.226), (0.44, 0.234), (0.468, 0.252), (0.47, 0.276), (0.458, 0.298), (0.425, 0.31), (0, TOP)]
NOTCH = [('M', 0, 0.5), ('L', 0.1, 0.33), ('L', -0.1, 0.33), ('L', 0, 0.5)]  # from above; up is forward
SINK = 0.035  # how deep the notch is cut


def spring(swells=2, steps=8, low=0.072, high=0.222, middle=0.37, swell=0.036):
    """The coil between foot and plate as a wavy waist: narrow, then `swells` round swells, then narrow."""
    return [(middle - swell * math.cos(i / steps * swells * math.tau), low + i / steps * (high - low)) for i in range(steps + 1)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    ink = finish.glossy('Ink', palette.INK)
    body = shapes.revolve('pad', FOOT + spring() + PLATE, tint, segments=SEGMENTS)
    cutter = shapes.outline('notch', NOTCH, 0.1, ink, bevel=0.004, view='top', resolution=1, lift=TOP - SINK)
    return [sculpt.carve('pad', (body, tint), [(cutter, ink)])]
