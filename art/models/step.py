"""A stepping pad (board theme spec §3): a fat, round floating disc, all Tint, so each one takes its colour.
Lathed (plan decision 4): 12 sides, 96 triangles."""
from lib import finish, palette, shapes

PROFILE = [(1.6, 0.0), (1.8, 0.15), (1.8, 0.45), (1.6, 0.6)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.lathe('step', PROFILE, [tint], segments=12)]
