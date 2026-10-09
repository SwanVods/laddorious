"""Tangerine Dusk colours for the models (spec #5 §3.1), mirrored from apps/client/src/app/theme.ts.
art/test/palette.test.ts checks that every colour here also appears there."""

SEAT = '#ff5470'  # a stand-in: the game paints Seat materials in the player's colour
INK = '#0f2e36'
CREAM = '#fff7ec'
WHITE = '#ffffff'
GOLD = '#ffcc33'
TANGERINE = '#ffa22e'
PODIUM_TOP = '#fff3e3'
MINT = '#5ff0c5'   # launch pads and their trails
PINK = '#ff5470'   # slide rims and collars
SLIDE = '#2a2140'  # inside a slide's vortex


def linear(colour):
    """A '#rrggbb' sRGB colour as Blender's linear RGBA."""
    value = colour.lstrip('#')

    def channel(i):
        c = int(value[i:i + 2], 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (channel(0), channel(2), channel(4), 1.0)
