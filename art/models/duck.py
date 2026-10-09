"""The rubber duck (spec #5 §4.1): a round body and head in the seat colour, a tangerine beak, a
tail, and the knight's dark eyes with a white shine."""
from lib import finish, palette, shapes


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    beak = finish.glossy('Beak', palette.TANGERINE)
    eye = finish.glossy('Eye', palette.INK)
    shine = finish.glow('Shine', palette.WHITE, 1.0)
    parts = [
        # The body's bottom (0.34 x 0.75 below its centre) rests on the floor.
        shapes.sphere('body', 0.34, seat, location=(0.0, 0.0, 0.255), scale=(0.9, 1.15, 0.75), segments=28, rings=18),
        # The head sinks into the body's front, so the duck is one shape, not a snowman.
        shapes.sphere('head', 0.2, seat, location=(0.0, -0.14, 0.68), segments=24, rings=16),
        shapes.sphere('beak', 0.09, beak, location=(0.0, -0.35, 0.64), scale=(1.1, 1.6, 0.45), segments=16, rings=10),
        # The tail tips up and back (+Y).
        shapes.cone('tail', 0.1, 0.22, seat, location=(0.0, 0.36, 0.38), rotation=(-0.8, 0.0, 0.0)),
    ]
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.045, eye, location=(s * 0.11, -0.29, 0.72), segments=12, rings=8))
        parts.append(shapes.sphere(f'shine{s}', 0.015, shine, location=(s * 0.125, -0.32, 0.74), segments=8, rings=6))
    return parts
