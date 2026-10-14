"""Tangerine Dusk colours for the models (spec #5 §3.1), mirrored from apps/client/src/app/theme.ts.
art/test/palette.test.ts checks that every colour here also appears there."""

SEAT = '#ff5470'  # a stand-in: the game paints Seat materials in the player's colour
INK = '#0f2e36'
CREAM = '#fff7ec'
WHITE = '#ffffff'
GOLD = '#ffcc33'
TANGERINE = '#ffa22e'
PODIUM_TOP = '#fff3e3'
MINT = '#5ff0c5'
PINK = '#ff5470'
CUSHION = '#ff9a3d'   # the platform's and pads' cushions; the podium's band
LIME = '#b8f03c'
CYAN = '#33d6ff'
VIOLET = '#b48cff'
PEACH = '#ffc184'
MYSTERY = '#8f4dff'   # the "?" cards
PODIUM_BASE = '#147676'
RED = '#ff5a5f'    # the board's red squares; the die's one pip
SLIDE = '#2a2140'
SHADE = '#9a9a9a'  # a Tint part's deep side (the whirlpool's bowl): the pair colour makes it a deeper shade of itself


def linear(colour):
    """A '#rrggbb' sRGB colour as Blender's linear RGBA."""
    value = colour.lstrip('#')

    def channel(i):
        c = int(value[i:i + 2], 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (channel(0), channel(2), channel(4), 1.0)
