"""A slide's tail (spec #5 §4.2, A13): a raised glossy collar where the piece pops out, one soft ring,
white Tint so it takes its pair's colour. The game lays the pair's symbol inside it (PARTS.exitInner
to exitOuter)."""
from lib import finish, palette, shapes

COLLAR = [(0.3, 0), (0.42, 0), (0.43, 0.022), (0.424, 0.052), (0.4, 0.078), (0.36, 0.086), (0.32, 0.078), (0.298, 0.055), (0.29, 0.028)]  # a loop


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.revolve('collar', COLLAR, tint, segments=24)]
