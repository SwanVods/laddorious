"""The crown on the last tile (spec #5 §4.1): a gold toy crown in one piece. Its wall flares as it rises
into five soft, rounded points, each ending in a ball that grows out of it; a raised band runs round its
foot, set with pink gems. It stands on its base."""
import math

from lib import finish, palette, sculpt, shapes

SHADOW = 400  # triangles in the stand-in that casts its shadow in the game (spec #5 §6)

POINTS = 5
STEPS = 180           # sections round the wall (fine, since the surface is rebuilt from them)
LOW, HIGH = 0.24, 0.6 # the wall's height between the points, and at their tips
THICK = 0.07          # the wall's thickness
BAND = (0.04, 0.15)   # the raised band round the foot, from and to these heights
BALL = 0.06


def outer(z):
    """The wall's outer radius at height z: it flares out as it rises."""
    return 0.44 + 0.1 * z


def height(a):
    """The wall's top at angle a: broad dips rising into rounded points."""
    return LOW + (HIGH - LOW) * ((1 + math.cos(POINTS * a)) / 2) ** 1.5


def section(h):
    """The wall's section where it stands h tall, as a loop of (radius, height): up the outside over the
    band, round the top lip, down the inside, and round the foot."""
    mid = (BAND[1] + 0.025 + h - 0.03) / 2
    return [
        (outer(0) - 0.015, 0.0),
        (outer(0) + 0.005, 0.015),
        (outer(BAND[0]) + 0.025, BAND[0]),
        (outer(BAND[1]) + 0.025, BAND[1]),
        (outer(BAND[1] + 0.025), BAND[1] + 0.025),
        (outer(mid), mid),
        (outer(h - 0.03), h - 0.03),
        (outer(h) - 0.02, h),
        (outer(h) - 0.05, h),
        (outer(h - 0.03) - THICK, h - 0.03),
        (outer(0.03) - THICK, 0.03),
        (outer(0) - 0.055, 0.0),
    ]


def build():
    gold = finish.glossy('Gold', palette.GOLD)
    gem = finish.glossy('Gem', palette.SEAT)
    rows = []
    for i in range(STEPS):
        a = i * math.tau / STEPS
        rows.append([(r * math.cos(a), r * math.sin(a), z) for r, z in section(height(a))])
    solids = [(shapes.loft('wall', rows, gold), gold)]
    for k in range(POINTS):
        a = k * math.tau / POINTS
        r = outer(HIGH) - THICK / 2
        solids.append((shapes.sphere(f'ball{k}', BALL, gold, location=(r * math.cos(a), r * math.sin(a), HIGH + BALL * 0.55), **sculpt.FINE), gold))
        # A cabochon gem on the band, under each dip.
        g = a + math.pi / POINTS
        z = sum(BAND) / 2
        r = outer(z) + 0.025 + 0.006
        stone = shapes.sphere(f'gem{k}', 0.05, gem, location=(r * math.cos(g), r * math.sin(g), z), scale=(0.5, 1.0, 1.0), **sculpt.FINE)
        stone.rotation_euler = (0.0, 0.0, g)
        solids.append((stone, gem))
    return [sculpt.fuse('crown', solids, blend=0.025, soften=0.008, target=6000)]
