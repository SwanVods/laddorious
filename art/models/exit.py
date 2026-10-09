"""A slide's tail (spec #5 §4.2): a raised glossy pink collar where the piece pops out, one soft ring."""
from lib import finish, palette, shapes

COLLAR = [(0.24, 0), (0.34, 0), (0.347, 0.022), (0.338, 0.052), (0.31, 0.078), (0.275, 0.082), (0.25, 0.064), (0.24, 0.032)]  # a loop


def build():
    collar = finish.glossy('Collar', palette.PINK)
    return [shapes.revolve('collar', COLLAR, collar, segments=28)]
