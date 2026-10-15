"""A piece's shield (2026-10-15: the user asked for a shield you can see): a smooth bubble that sits over the
piece, open at the bottom where it meets the board, with a glowing band round its middle. One lathed
surface for the bubble (Bubble, white: the game tints it and sets its see-through) and a thin lathed band
(Rim, a mint glow). Origin at the base centre; about 1.9 across and 1.6 tall, enough to cover the tallest
piece."""
import math

from lib import finish, palette, shapes

RADIUS = 0.95
# The bubble's profile, from its open rim at the board up over the top (radius, height).
BUBBLE = [(RADIUS * math.sin(a), 0.62 + RADIUS * -math.cos(a)) for a in [math.radians(d) for d in range(50, 181, 13)]]  # from 50°, where the open rim meets the ground, over the top
# The band: a slim ring at the bubble's widest.
BAND = [(RADIUS + 0.01, 0.56), (RADIUS + 0.035, 0.6), (RADIUS + 0.035, 0.66), (RADIUS + 0.01, 0.7), (RADIUS - 0.01, 0.63)]


def build():
    bubble = finish.glossy('Bubble', palette.WHITE)
    rim = finish.glow('Rim', palette.MINT, 2.0, base=palette.MINT)
    return [shapes.revolve('bubble', BUBBLE, bubble, segments=28), shapes.revolve('band', BAND, rim, segments=28)]
