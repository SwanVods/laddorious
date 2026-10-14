"""The board's platform (board theme spec §3, B1): the board stands on a cream inflatable deck with a wing
on each side, ringed by a fat rim striped pink and cream like a bouncy castle; a soft tangerine cushion
swells under it and narrows to a knot. One closed surface, turned round the deck's rounded rectangle:
each row is that outline scaled and pushed out along its normals, so the stripes are columns and the
cushion, rim and deck are bands (plan decision 4: lathed, so it thins to an exact count). The game stands
the tiles on the deck's top: PLATFORM in apps/client/src/scene/layout.ts."""
import math

from lib import finish, palette, shapes

HALF_W, HALF_D, CORNER = 26.0, 19.0, 5.0   # the deck (PLATFORM.halfWidth, halfDepth)
DECK_TOP = 6.0                              # PLATFORM.deckTop, above the knot's bottom
RIM, RIM_OUT, RIM_Z = 1.2, 0.2, 6.1         # the rim's radius, its centre past the deck's edge, its height: top 7.3
COLUMNS, STRIPES = 84, 28                   # points round the outline; stripes round the rim (half of them pink)
# (scale of the outline, push out along its normals, height): the knot, the neck, the cushion swelling out.
CUSHION = [(0.05, 0.0, 0.0), (0.10, 0.0, 0.5), (0.12, 0.0, 1.5), (0.35, 0.0, 2.3), (0.70, 0.0, 3.2), (0.90, 0.0, 4.1), (0.96, 0.0, 4.7)]
RIM_ANGLES = (-105, -75, -45, -15, 15, 45, 75, 105, 135, 165)   # round the rim's section in 30° steps (under the export's 35° crease), from under it to its inner lip


def build():
    stripe = finish.satin('Stripe', palette.PINK)
    deck = finish.satin('Deck', palette.CREAM)
    cushion = finish.satin('Cushion', palette.CUSHION)
    outline = shapes.rounded_rect(HALF_W, HALF_D, CORNER, COLUMNS)
    rim = [(1.0, RIM_OUT + RIM * math.cos(math.radians(a)), RIM_Z + RIM * math.sin(math.radians(a))) for a in RIM_ANGLES]
    # From the rim's lip in to the deck, then a flat ring, so the top fan's edge shades flat; the fan closes it.
    profile = CUSHION + rim + [(1.0, -1.4, DECK_TOP), (1.0, -2.6, DECK_TOP)]
    rows = [[(x * s + nx * d, y * s + ny * d, h) for (x, y), (nx, ny) in outline] for s, d, h in profile]
    rim_start, rim_end = len(CUSHION), len(CUSHION) + len(rim) - 1

    def paint(row, column):
        if row < rim_start:
            return 2  # the cushion
        if row < rim_end:
            return (column * STRIPES // COLUMNS) % 2  # the rim: pink, cream, pink…
        return 1  # the deck

    return [shapes.grid('platform', rows, [stripe, deck, cushion], paint=paint)]
