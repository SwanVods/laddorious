"""The dragon head (spec #5 §4.1): the mockup's spiky head on a round base, with gold glowing eyes,
dark pupils and cream horns."""
from lib import finish, palette, shapes

BASE = [(0, 0), (0.34, 0), (0.36, 0.04), (0.34, 0.1), (0.27, 0.13), (0.24, 0.18), (0.22, 0.21), (0, 0.21)]
HEAD = [('M', -0.2, 0), ('L', 0.16, 0), ('Q', 0.1, 0.22, 0.2, 0.36), ('L', 0.42, 0.42), ('L', 0.55, 0.47), ('L', 0.4, 0.52),
        ('L', 0.56, 0.58), ('Q', 0.6, 0.66, 0.48, 0.68), ('Q', 0.34, 0.7, 0.22, 0.8), ('Q', 0.12, 0.9, 0, 0.88),
        ('Q', -0.12, 0.86, -0.16, 0.76), ('L', -0.31, 0.74), ('L', -0.22, 0.63), ('L', -0.35, 0.56), ('L', -0.25, 0.45),
        ('L', -0.34, 0.36), ('L', -0.23, 0.27), ('Q', -0.28, 0.12, -0.2, 0)]
DEPTH = 0.4
HEAD_AT = (-0.08, 0.2)
EYE = (0.2, 0.75)


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    gold = finish.glow('Glow', palette.GOLD, 1.2)
    pupil = finish.glossy('Eye', palette.INK)
    horn = finish.glossy('Horn', palette.CREAM)
    parts = [
        shapes.revolve('base', BASE, seat),
        # Its spikes are straight lines, so a coarser curve does; a smaller rounding keeps their tips in.
        shapes.outline('head', HEAD, DEPTH, seat, bevel=0.035, view='side', offset=HEAD_AT, resolution=6),
    ]
    forward = EYE[0] + HEAD_AT[0]
    up = EYE[1] + HEAD_AT[1]
    side = DEPTH / 2 - 0.005
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.058, gold, location=(s * side, -forward, up)))
        parts.append(shapes.sphere(f'pupil{s}', 0.032, pupil, location=(s * (side + 0.035), -(forward + 0.01), up), scale=(0.6, 0.45, 1.0), segments=12, rings=8))
        # Horns sweep back from the top of the head and lean out a little.
        parts.append(shapes.cone(f'horn{s}', 0.055, 0.32, horn, location=(s * 0.075, -0.025, 0.985), rotation=(-0.9, s * 0.25, 0.0)))
    return parts
