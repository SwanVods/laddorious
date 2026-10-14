"""A big toy die (board theme spec B4), on its own on the deck: a soft cream cube with ink dimples, one on
top, two in front (-Y), three on the right. Carved with exact booleans (lib/sculpt.carve), like the game's
die, but light: the props are priced into the match's budget (plan decision 2)."""
from lib import finish, palette, sculpt, shapes

SIZE = 3.2
PIP = 0.32
HALF = SIZE / 2
PIPS = [
    (0.0, 0.0, SIZE),                                   # one on top
    (-0.8, -HALF, 2.4), (0.8, -HALF, 0.8),              # two in front
    (HALF, -0.8, 2.4), (HALF, 0.0, HALF), (HALF, 0.8, 0.8),  # three on the right
]


def build():
    body = finish.glossy('Body', palette.CREAM)
    pip = finish.satin('Pip', palette.INK)
    cube = shapes.rounded_box('cube', (SIZE, SIZE, SIZE), 0.35, body, location=(0.0, 0.0, HALF), segments=3)
    cutters = [(shapes.sphere(f'pip{i}', PIP, pip, location=at, segments=10, rings=6), pip) for i, at in enumerate(PIPS)]
    return [sculpt.carve('prop_die', (cube, body), cutters)]
