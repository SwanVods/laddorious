"""A launch pad's landing target (spec #5 §4.2): a soft glossy mint ring round a domed gold star that
glows; the game makes it breathe. The two don't touch, so the landing tile shows between them."""
import math

from lib import finish, palette, shapes

# The ring's section, a loop: flat underneath, round on top.
RING = [(0.45, 0), (0.6, 0), (0.614, 0.014), (0.612, 0.036), (0.594, 0.058), (0.525, 0.07), (0.456, 0.058), (0.438, 0.036), (0.436, 0.014)]
POINT, INNER, ROUND = 0.3, 0.13, 0.05  # the star's tips, its inner corners, and how far back each tip is rounded
# The star rises in layers of (scale, height) to a soft dome.
LAYERS = [(1.0, 0.0), (1.0, 0.016), (0.92, 0.04), (0.74, 0.064), (0.44, 0.08)]
PEAK = 0.086


def star_outline():
    """Five points, the first straight ahead, each tip rounded by a short curve."""
    corners = [((POINT if i % 2 == 0 else INNER) * math.sin(i * math.pi / 5), (POINT if i % 2 == 0 else INNER) * math.cos(i * math.pi / 5)) for i in range(10)]
    points = []
    for i, (x, y) in enumerate(corners):
        if i % 2:
            points.append((x, y))
            continue
        before, after = corners[i - 1], corners[(i + 1) % 10]
        reach = lambda to: (x + (to[0] - x) * ROUND / math.dist((x, y), to), y + (to[1] - y) * ROUND / math.dist((x, y), to))
        a, b = reach(before), reach(after)
        points += [a, (0.25 * a[0] + 0.5 * x + 0.25 * b[0], 0.25 * a[1] + 0.5 * y + 0.25 * b[1]), b]
    return points


def build():
    ring = finish.glossy('Ring', palette.MINT)
    glow = finish.glow('Glow', palette.GOLD, 1.5)
    return [
        shapes.revolve('ring', RING, ring, segments=28),
        shapes.stack('star', star_outline(), LAYERS, glow, top=PEAK),
    ]
