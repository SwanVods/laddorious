"""The knight (spec #5 §4.1): the mockup's horse head on a round base, with dark eyes and a white shine."""
from lib import finish, palette, shapes

BASE = [(0, 0), (0.34, 0), (0.36, 0.04), (0.34, 0.1), (0.27, 0.13), (0.24, 0.18), (0.22, 0.21), (0, 0.21)]
HEAD = [('M', -0.26, 0), ('L', 0.22, 0), ('Q', 0.24, 0.18, 0.16, 0.3), ('Q', 0.26, 0.38, 0.4, 0.42), ('Q', 0.5, 0.46, 0.46, 0.56),
        ('Q', 0.42, 0.64, 0.3, 0.66), ('Q', 0.2, 0.72, 0.14, 0.8), ('L', 0.06, 0.98), ('L', -0.02, 0.84),
        ('Q', -0.2, 0.82, -0.28, 0.6), ('Q', -0.34, 0.36, -0.26, 0)]
DEPTH = 0.36            # the head's full thickness, side to side
HEAD_AT = (-0.08, 0.2)  # (forward, up): where the head outline sits on the base
EYE = (0.22, 0.7)       # in the head outline


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    eye = finish.glossy('Eye', palette.INK)
    shine = finish.glow('Shine', palette.WHITE, 1.0)
    parts = [
        shapes.revolve('base', BASE, seat),
        shapes.outline('head', HEAD, DEPTH, seat, view='side', offset=HEAD_AT),
    ]
    forward = EYE[0] + HEAD_AT[0]
    up = EYE[1] + HEAD_AT[1]
    side = DEPTH / 2 - 0.005  # half sunk into the cheek
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.042, eye, location=(s * side, -forward, up)))
        parts.append(shapes.sphere(f'shine{s}', 0.014, shine, location=(s * (side + 0.03), -(forward + 0.01), up + 0.015), segments=8, rings=6))
    return parts
