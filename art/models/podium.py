"""The menu's podium (spec #5 §4.3, board theme spec §3): a teal base flaring up, a tangerine band, a cream
top with a glowing pink ring set into it, where the chosen piece turns. The same size as the code-built
one, so the name plate (MenuScene ANCHORS) still sits on its front. Lathed: 64 sides, one surface."""
from lib import finish, palette, shapes

PROFILE = [
    (1.15, 0.0), (1.5, 0.34),                     # the base, flaring up
    (1.46, 0.36), (1.47, 0.40), (1.47, 0.46),     # the band
    (1.42, 0.47), (1.35, 0.75),                   # the top's side
    (1.25, 0.75), (1.18, 0.795), (1.11, 0.75),    # the ring, a bead on the top
    (0.6, 0.75),                                  # the top, closed by the fan
]
#        bands: 0-1 base, 2-4 band, 5-6 top, 7-8 ring, 9 top
PAINT = [2, 2, 1, 1, 1, 0, 0, 3, 3, 0]


def build():
    top = finish.satin('Top', palette.PODIUM_TOP)
    band = finish.glossy('Band', palette.CUSHION)
    base = finish.satin('Base', palette.PODIUM_BASE)
    ring = finish.glow('Ring', palette.PINK)
    return [shapes.lathe('podium', PROFILE, [top, band, base, ring], paint=lambda row, column: PAINT[min(row, len(PAINT) - 1)], segments=64)]
