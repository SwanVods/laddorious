"""A piece's shield (2026-10-15): a smooth bubble that sits over the piece, open at the bottom where it meets
the board. One lathed surface (Bubble). The game draws it with its own edge-glow shader: almost clear where
you look straight through it, a mint glow along its outline, like a soap bubble's rim (the user's pick, after
the first version with a band round its middle looked like a hamster ball). Origin at the base centre; about
1.9 across and 1.6 tall, enough to cover the tallest piece."""
import math

from lib import finish, palette, shapes

RADIUS = 0.95
# The bubble's profile, from its open rim at the board (50°, where it meets the ground) up over the top.
# Fine rings, since its outline is what shows.
BUBBLE = [(RADIUS * math.sin(a), 0.62 + RADIUS * -math.cos(a)) for a in [math.radians(d) for d in range(50, 181, 10)]]


def build():
    bubble = finish.glossy('Bubble', palette.MINT)
    return [shapes.revolve('bubble', BUBBLE, bubble, segments=32)]
