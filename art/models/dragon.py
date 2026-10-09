"""The dragon head (spec #5 §4.1): the mockup's spiky head on a round base, sculpted in one piece:
cream horns growing out of the skull, brow ridges over gold glowing eyes with dark pupils, and
nostrils on the snout."""
from lib import finish, palette, sculpt, shapes

BASE = [(0, 0), (0.34, 0), (0.36, 0.04), (0.34, 0.1), (0.27, 0.13), (0.24, 0.18), (0.22, 0.21), (0, 0.21)]
HEAD = [('M', -0.2, 0), ('L', 0.16, 0), ('Q', 0.1, 0.22, 0.2, 0.36), ('L', 0.42, 0.42), ('L', 0.55, 0.47), ('L', 0.4, 0.52),
        ('L', 0.56, 0.58), ('Q', 0.6, 0.66, 0.48, 0.68), ('Q', 0.34, 0.7, 0.22, 0.8), ('Q', 0.12, 0.9, 0, 0.88),
        ('Q', -0.12, 0.86, -0.16, 0.76), ('L', -0.31, 0.74), ('L', -0.22, 0.63), ('L', -0.35, 0.56), ('L', -0.25, 0.45),
        ('L', -0.34, 0.36), ('L', -0.23, 0.27), ('Q', -0.28, 0.12, -0.2, 0)]
DEPTH = 0.36
HEAD_AT = (-0.08, 0.2)
EYE = (0.2, 0.75)


def place(x, y):
    """A point of the head drawing (forward, up) in model space: forward is -Y."""
    return (-(x + HEAD_AT[0]), y + HEAD_AT[1])


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    gold = finish.glow('Glow', palette.GOLD, 1.2)
    pupil = finish.glossy('Eye', palette.INK)
    horn = finish.glossy('Horn', palette.CREAM)
    solids = [
        (shapes.revolve('base', BASE, seat, segments=sculpt.FINE_TURN), seat),
        (shapes.outline('head', HEAD, DEPTH, seat, bevel=0.04, view='side', offset=HEAD_AT, resolution=10), seat),
    ]
    y, z = place(*EYE)
    for s in (1, -1):
        # A brow ridge over each eye, and a horn sweeping back from the top of the skull.
        solids.append((shapes.sphere(f'brow{s}', 0.07, seat, location=(s * 0.15, y + 0.01, z + 0.06), scale=(0.7, 1.3, 0.55), **sculpt.FINE), seat))
        solids.append((shapes.cone(f'horn{s}', 0.068, 0.42, horn, location=(s * 0.085, -0.02, 0.95), rotation=(-0.95, s * 0.3, 0.0), segments=64), horn))
    nostrils = []
    ny, nz = place(0.55, 0.63)
    for s in (1, -1):
        nostrils.append((shapes.sphere(f'nostril{s}', 0.022, seat, location=(s * 0.05, ny + 0.02, nz), **sculpt.FINE), None))
    dragon = sculpt.fuse('dragon', solids, cutters=nostrils, blend=0.03, soften=0.01, target=8500)

    parts = [dragon]
    side = DEPTH / 2 - 0.005
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.058, gold, location=(s * side, y, z), segments=20, rings=12))
        parts.append(shapes.sphere(f'pupil{s}', 0.032, pupil, location=(s * (side + 0.035), y - 0.01, z), scale=(0.6, 0.45, 1.0), segments=12, rings=8))
    return parts
