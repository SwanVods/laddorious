"""A bouncy mushroom (board theme spec §3): a short stem under a fat, domed cap, all Tint; the game draws
three on one pad, pink and violet, squashing on their bases. Lathed: 16 sides."""
from lib import finish, palette, shapes

PROFILE = [(0.55, 0.0), (0.45, 0.6), (0.45, 1.2), (1.2, 1.2), (1.5, 1.35), (1.45, 1.7), (1.2, 2.05), (0.7, 2.28), (0.3, 2.33)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.lathe('mushroom', PROFILE, [tint], segments=16)]
