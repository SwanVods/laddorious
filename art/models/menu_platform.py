"""The menu's little platform (board theme spec §3): a round copy of the board's, a cream deck in a rim
striped pink and cream, on a tangerine cushion narrowing to a knot. The podium stands on its deck
(MENU_PLATFORM.deckTop). Lathed: 32 sides, eight pink stripes."""
import math

from lib import finish, palette, shapes

DECK_TOP, RADIUS = 1.2, 2.3
CUSHION = [(0.15, 0.0), (0.3, 0.25), (0.35, 0.55), (1.0, 0.75), (1.8, 0.95), (2.1, 1.02)]
RIM = [(2.35 + 0.25 * math.cos(math.radians(a)), 1.25 + 0.25 * math.sin(math.radians(a))) for a in (-105, -75, -45, -15, 15, 45, 75, 105, 135, 165)]  # 30° steps, under the export's 35° crease
SEGMENTS, STRIPES = 32, 16


def build():
    stripe = finish.satin('Stripe', palette.PINK)
    deck = finish.satin('Deck', palette.CREAM)
    cushion = finish.satin('Cushion', palette.CUSHION)
    profile = CUSHION + RIM + [(2.0, DECK_TOP)]
    rim_start, rim_end = len(CUSHION), len(CUSHION) + len(RIM) - 1

    def paint(row, column):
        if row < rim_start:
            return 2
        if row < rim_end:
            return (column * STRIPES // SEGMENTS) % 2
        return 1

    return [shapes.lathe('menu_platform', profile, [stripe, deck, cushion], paint=paint, segments=SEGMENTS)]
