"""The top hat (spec #5 §4.1): the classic board-game token, a tall hat with a dark band."""
from lib import finish, palette, shapes

HAT = [(0, 0), (0.46, 0), (0.485, 0.035), (0.46, 0.07), (0.3, 0.085), (0.275, 0.1), (0.27, 0.9), (0.255, 0.95), (0.2, 0.965), (0, 0.97)]
BAND = [(0.274, 0.12), (0.292, 0.12), (0.292, 0.27), (0.274, 0.27)]  # a ring round the crown


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    band = finish.glossy('Band', palette.INK)
    return [shapes.revolve('hat', HAT, seat, segments=56), shapes.revolve('band', BAND, band, segments=56)]
