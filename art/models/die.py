"""The die (spec #5 §4.1): a rounded cream die with real carved pips: dark dimples, and a pink one.

Faces follow the game's map (DIE_FACES, dieRotationFor): in the game's axes +Y 1, -Y 6, +X 3,
-X 4, +Z 2, -Z 5. Blender's +Z is the game's +Y and Blender's -Y the game's +Z, which gives the
table below. Its middle is the origin: the die tumbles round it.
"""
from lib import finish, palette, sculpt, shapes

SHADOW = 400  # triangles in the stand-in that casts its shadow in the game (spec #5 §6)

SIZE = 0.5
SPACING = 0.115  # keeps the outer pips on the flat of the face, clear of the rounded edge
# value: (outward normal, across, up) in Blender axes
FACES = {
    1: ((0, 0, 1), (1, 0, 0), (0, 1, 0)),
    6: ((0, 0, -1), (1, 0, 0), (0, -1, 0)),
    3: ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
    4: ((-1, 0, 0), (0, -1, 0), (0, 0, 1)),
    2: ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
    5: ((0, 1, 0), (-1, 0, 0), (0, 0, 1)),
}
PIPS = {
    1: [(0, 0)],
    2: [(-1, -1), (1, 1)],
    3: [(-1, -1), (0, 0), (1, 1)],
    4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
    5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
    6: [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 0), (1, 1)],
}


def build():
    body = finish.glossy('Body', palette.CREAM)
    pip = finish.glossy('Pip', palette.INK)
    one = finish.glossy('One', palette.SEAT)
    die = shapes.rounded_box('die', (SIZE, SIZE, SIZE), 0.09, body, segments=5)
    pips = []
    for value, (normal, across, up) in FACES.items():
        for i, (a, b) in enumerate(PIPS[value]):
            # A ball sunk partway into the face carves a round dimple with a crisp rim, as on real dice.
            radius, out = (0.07, 0.045) if value == 1 else (0.05, 0.03)
            centre = tuple(normal[k] * (SIZE / 2 + out) + across[k] * a * SPACING + up[k] * b * SPACING for k in range(3))
            colour = one if value == 1 else pip
            pips.append((shapes.sphere(f'pip{value}{i}', radius, colour, location=centre, segments=24, rings=12), colour))
    return [sculpt.carve('die', (die, body), pips)]
