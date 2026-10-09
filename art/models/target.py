"""A launch pad's landing (spec #5 §4.2, A13): a soft glossy ring, white Tint so it takes its pair's
colour. The game lays the pair's symbol in glowing gold inside it, on the landing square, which shows
between them."""
from lib import finish, palette, shapes

# The ring's section, a loop: flat underneath, round on top.
RING = [(0.45, 0), (0.6, 0), (0.614, 0.014), (0.612, 0.036), (0.594, 0.058), (0.525, 0.07), (0.456, 0.058), (0.438, 0.036), (0.436, 0.014)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.revolve('ring', RING, tint, segments=28)]
