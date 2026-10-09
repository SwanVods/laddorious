"""A board tile (spec #5 §4.2): the mockup's chunky rounded slab, standing on its base. Its one material
is Tint, white, so the game paints each square its colour through instancing. A single rounded slab is
already one continuous surface, so it keeps its clean, cheap shape: the board draws a hundred of them."""
from lib import finish, palette, shapes

SIZE = 1.52       # 0.95 of a 1.6 tile, leaving a gap between squares
THICKNESS = 0.22  # TILE_THICKNESS in the game: the top sits at the board surface


def build():
    tint = finish.satin('Tint', palette.WHITE)
    return [shapes.rounded_box('tile', (SIZE, SIZE, THICKNESS), 0.07, tint, location=(0.0, 0.0, THICKNESS / 2), segments=2)]
