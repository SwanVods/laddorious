"""A floating obstacle's pad (board theme spec §3): a cream disc with a fat mint rim, on a tangerine
cushion. The game stands an obstacle on its top (COURSE.padTop) and draws five. Lathed (plan decision 4):
18 sides, one surface, painted by band."""
import math

from lib import finish, palette, shapes

TOP, R = 2.0, 5.0
CUSHION = [(0.4, 0.0), (1.8, 0.2), (3.4, 0.7), (4.4, 1.2)]
RIM = [(R + 0.6 * math.cos(math.radians(a)), 1.9 + 0.6 * math.sin(math.radians(a))) for a in (-100, 0, 80, 165)]


def build():
    pad = finish.satin('Pad', palette.CREAM)
    rim = finish.glossy('Rim', palette.MINT)
    cushion = finish.satin('Cushion', palette.CUSHION)
    profile = CUSHION + RIM + [(4.2, TOP)]  # in from the rim's lip to the pad's top; the top fan closes it
    rim_start, rim_end = len(CUSHION), len(CUSHION) + len(RIM) - 1
    paint = lambda row, column: 2 if row < rim_start else (1 if row < rim_end else 0)
    return [shapes.lathe('course_pad', profile, [pad, rim, cushion], paint=paint, segments=18)]
