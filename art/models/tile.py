"""A board tile (spec #5 §4.2, A13): a soft slab with rounded corners and a top edge that rolls over like
moulded plastic, 0.30 tall. White Tint: instancing paints each square its colour. Only the top edge is
rounded: the bottom rests on the deck, out of sight, and the board draws a hundred of these."""
import math

from lib import finish, palette, shapes

SIZE = 2.3   # the game's TILE_ACROSS: 0.2 of deck shows between squares on the 2.5 step
THICKNESS = 0.30   # the game's TILE_THICKNESS
CORNER = 0.17      # the corners' radius, seen from above
ROLL = 0.07        # the top edge's radius
STEPS = 3          # the roll's steps


def outline():
    """The tile seen from above: a rounded square, five points round each corner."""
    half = SIZE / 2 - CORNER
    points = []
    for cx, cy, start in ((half, half, 0), (-half, half, 90), (-half, -half, 180), (half, -half, 270)):
        for k in range(5):
            a = math.radians(start + k * 90 / 4)
            points.append((cx + CORNER * math.cos(a), cy + CORNER * math.sin(a)))
    return points


def build():
    tint = finish.satin('Tint', palette.WHITE)
    # Straight up the side, then the roll: each layer drawn in a little and higher, round a quarter circle.
    layers = [(1.0, 0.0), (1.0, THICKNESS - ROLL)]
    for k in range(1, STEPS + 1):
        a = math.pi / 2 * k / STEPS
        inset = ROLL * (1 - math.cos(a))
        layers.append(((SIZE / 2 - inset) / (SIZE / 2), THICKNESS - ROLL + ROLL * math.sin(a)))
    return [shapes.stack('tile', outline(), layers, tint, flat_top=True)]
