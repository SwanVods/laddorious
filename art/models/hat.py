"""The top hat (spec #5 §4.1): the classic board-game token in one piece: a tall crown with a dark
band and a brim that curls up at the sides."""
from lib import finish, palette, sculpt, shapes

HAT = [(0, 0), (0.46, 0), (0.485, 0.035), (0.46, 0.07), (0.3, 0.085), (0.275, 0.1), (0.27, 0.9), (0.255, 0.95), (0.2, 0.965), (0, 0.97)]
BAND = [(0.262, 0.12), (0.29, 0.12), (0.29, 0.27), (0.262, 0.27)]  # a ring round the crown
CURL = 0.08  # how far the brim's left and right edges lift


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    band = finish.glossy('Band', palette.INK)
    hat = shapes.revolve('hat', HAT, seat, segments=sculpt.FINE_TURN)
    # Curl the brim: past the crown, its left and right (±X) lift, most at the rim.
    for v in hat.data.vertices:
        x, y, z = v.co
        r = (x * x + y * y) ** 0.5
        if r > 0.29 and z < 0.12:
            v.co.z = z + CURL * ((r - 0.29) / 0.195) ** 2 * (x / r) ** 2
    ring = shapes.revolve('band', BAND, band, segments=sculpt.FINE_TURN)
    return [sculpt.fuse('hat', [(hat, seat), (ring, band)], blend=0.01, soften=0.008, target=8000)]
