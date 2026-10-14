"""A "?" card (board theme spec B4): the game's Mystery card, toy-sized, standing on its edge: a purple slab
with soft corners and a raised cream "?" on its face (toward -Y, the camera). The game fans three. One
sculpted surface, on a coarse grid so the mark's colour edge stays light."""
import math

from lib import finish, palette, sculpt, shapes

W, D, H = 3.0, 0.12, 4.3
STROKE = 0.13      # the "?"'s stroke radius
FRONT = -D / 2     # the face the mark stands on


def question():
    """Points along the "?": over the top of its hook, round and down to the stem, then the stem."""
    hook = [(0.55 * math.cos(math.radians(a)), 2.75 + 0.55 * math.sin(math.radians(a))) for a in range(160, -61, -10)]
    stem = [(0.275 - 0.275 * t, 2.27 - 0.52 * t) for t in (k / 6 for k in range(1, 7))]
    return hook + stem


def build():
    card = finish.satin('Card', palette.MYSTERY)
    mark = finish.glossy('Mark', palette.CREAM)
    # The coarse grid rounds the slab in by about a voxel: build it a little taller, its base a little low.
    body = shapes.rounded_box('card', (W, D, H + 0.06), 0.25, card, location=(0.0, 0.0, (H + 0.06) / 2 - 0.035))
    parts = [(body, card)]
    for i, (x, z) in enumerate(question()):
        parts.append((shapes.sphere(f'stroke{i}', STROKE, mark, location=(x, FRONT, z), segments=16, rings=12), mark))
    parts.append((shapes.sphere('dot', STROKE * 1.2, mark, location=(0.0, FRONT, 1.32), segments=16, rings=12), mark))
    return [sculpt.fuse('card', parts, voxel=0.03, blend=0.02, soften=0.02, target=350, adaptivity=0.6)]
