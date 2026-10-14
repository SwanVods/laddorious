"""A poker chip (board theme spec B4), toy-sized: a thick disc with soft edges, all Tint; the game stacks
five and leans one against them. Lathed: 14 sides."""
from lib import finish, palette, shapes

PROFILE = [(1.15, 0.0), (1.2, 0.05), (1.2, 0.31), (1.15, 0.36)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.lathe('chip', PROFILE, [tint], segments=14)]
