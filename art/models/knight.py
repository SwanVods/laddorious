"""The knight (spec #5 §4.1): the mockup's horse head on a round base, sculpted in one piece: full
cheeks, a rounded muzzle with nostrils, two ears, and a mane ridge down the back of the neck. Dark eyes with a
white shine sit on the cheeks."""
from lib import finish, palette, sculpt, shapes

SHADOW = 400  # triangles in the stand-in that casts its shadow in the game (spec #5 §6)

BASE = [(0, 0), (0.34, 0), (0.36, 0.04), (0.34, 0.1), (0.27, 0.13), (0.24, 0.18), (0.22, 0.21), (0, 0.21)]
HEAD = [('M', -0.26, 0), ('L', 0.22, 0), ('Q', 0.24, 0.18, 0.16, 0.3), ('Q', 0.26, 0.38, 0.4, 0.42), ('Q', 0.5, 0.46, 0.46, 0.56),
        ('Q', 0.42, 0.64, 0.3, 0.66), ('Q', 0.2, 0.72, 0.14, 0.8), ('Q', 0.08, 0.92, 0.0, 0.9), ('Q', -0.04, 0.88, -0.02, 0.84),
        ('Q', -0.2, 0.82, -0.28, 0.6), ('Q', -0.34, 0.36, -0.26, 0)]
DEPTH = 0.3             # the head's thickness side to side, before the cheeks fill it out
HEAD_AT = (-0.08, 0.2)  # (forward, up): where the head outline sits on the base
EYE = (0.22, 0.7)       # in the head outline


def place(x, y):
    """A point of the head drawing (forward, up) in model space: forward is -Y."""
    return (-(x + HEAD_AT[0]), y + HEAD_AT[1])


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    eye = finish.glossy('Eye', palette.INK)
    shine = finish.glow('Shine', palette.WHITE, 1.0)
    solids = [
        shapes.revolve('base', BASE, seat, segments=sculpt.FINE_TURN),
        shapes.outline('head', HEAD, DEPTH, seat, bevel=0.06, view='side', offset=HEAD_AT, resolution=16),
    ]
    # Cheeks round the jaw out; the muzzle is a soft bulb.
    y, z = place(0.24, 0.5)
    for s in (1, -1):
        solids.append(shapes.sphere(f'cheek{s}', 0.13, seat, location=(s * 0.06, y, z), scale=(0.85, 1.25, 1.0), **sculpt.FINE))
    y, z = place(0.42, 0.5)
    solids.append(shapes.sphere('muzzle', 0.1, seat, location=(0.0, y, z), scale=(1.35, 1.2, 1.0), **sculpt.FINE))
    # The mane: a ridge of overlapping beads down the back of the neck, fused smooth.
    for i in range(8):
        t = i / 7
        y, z = place(-0.27 + 0.22 * t, 0.36 + 0.5 * t)
        solids.append(shapes.sphere(f'mane{i}', 0.065, seat, location=(0.0, y + 0.02, z), scale=(0.8, 1.0, 1.0), **sculpt.FINE))
    # Two rounded ears on top, leaning back a little.
    y, z = place(0.03, 0.86)
    for s in (1, -1):
        solids.append(shapes.cone(f'ear{s}', 0.065, 0.26, seat, location=(s * 0.075, y, z), rotation=(0.3, s * 0.22, 0.0), segments=64))
    nostrils = []
    y, z = place(0.5, 0.52)
    for s in (1, -1):
        nostrils.append(shapes.sphere(f'nostril{s}', 0.022, seat, location=(s * 0.055, y, z), **sculpt.FINE))
    knight = sculpt.fuse('knight', [(p, seat) for p in solids], cutters=[(n, None) for n in nostrils], blend=0.04, soften=0.012, target=9000)

    parts = [knight]
    y, z = place(*EYE)
    side = DEPTH / 2 + 0.005  # half sunk into the cheek
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.045, eye, location=(s * side, y, z), segments=16, rings=10))
        parts.append(shapes.sphere(f'shine{s}', 0.015, shine, location=(s * (side + 0.032), y - 0.012, z + 0.016), segments=8, rings=6))
    return parts
