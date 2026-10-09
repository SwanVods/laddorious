"""The die (spec #5 §4.1): a rounded cream die with dark sunken pips and a pink single pip.

Faces follow the game's map (DIE_FACES, dieRotationFor): in the game's axes +Y 1, -Y 6, +X 3,
-X 4, +Z 2, -Z 5. Blender's +Z is the game's +Y and Blender's -Y the game's +Z, which gives the
table below. Its middle is the origin: the die tumbles round it.
"""
from lib import finish, palette, shapes

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
    parts = [shapes.rounded_box('die', (SIZE, SIZE, SIZE), 0.09, body, segments=4)]
    for value, (normal, across, up) in FACES.items():
        for i, (a, b) in enumerate(PIPS[value]):
            # A flat round pip set just into the face, so its whole disc shows from any side.
            centre = tuple(normal[k] * (SIZE / 2 - 0.006) + across[k] * a * SPACING + up[k] * b * SPACING for k in range(3))
            flat = tuple(1 - abs(normal[k]) * 0.65 for k in range(3))
            radius = 0.07 if value == 1 else 0.045
            # Twelve sides, so a pip reads round, not as a diamond.
            parts.append(shapes.sphere(f'pip{value}{i}', radius, one if value == 1 else pip, location=centre, scale=flat, segments=12, rings=4))
    return parts
