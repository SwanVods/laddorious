"""The sweeper (board theme spec §3): a stout post with a long, round bar across its top, in one pink
piece; the game spins it. Sculpted at an eighth of its size, then scaled up."""
import math

from lib import finish, palette, sculpt, shapes

S = 8
POST = [(0.0, 0.0), (0.7, 0.0), (0.6, 0.3), (0.5, 2.6), (0.0, 2.6)]
BAR = (0.55, 8.2, 2.6)  # radius, length, height of its middle


def build():
    bar = finish.glossy('Bar', palette.PINK)
    s = 1 / S
    post = shapes.revolve('post', [(r * s, h * s) for r, h in POST], bar, segments=sculpt.FINE_TURN)
    radius, length, height = BAR
    rod = shapes.capsule('rod', radius * s, length * s, bar, location=(0.0, 0.0, height * s), rotation=(0.0, math.pi / 2, 0.0))
    result = sculpt.fuse('sweeper', [(post, bar), (rod, bar)], blend=0.03, soften=0.01, target=300)
    result.scale = (S, S, S)
    return [result]
