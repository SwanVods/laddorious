"""The rook (spec #5 §4.1): a chess castle tower with four chunky battlements and a dark door."""
import math

from lib import finish, palette, shapes

TOWER = [(0, 0), (0.4, 0), (0.42, 0.05), (0.4, 0.1), (0.31, 0.14), (0.28, 0.2), (0.24, 0.6), (0.31, 0.64), (0.33, 0.68), (0.33, 0.84), (0, 0.84)]


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    door = finish.glossy('Door', palette.INK)
    parts = [shapes.revolve('tower', TOWER, seat)]
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        parts.append(shapes.rounded_box(f'merlon{i}', (0.17, 0.17, 0.16), 0.04, seat, location=(0.24 * math.cos(a), 0.24 * math.sin(a), 0.91), rotation=(0.0, 0.0, a)))
    # On the front (-Y), where the tower is about 0.27 across.
    parts.append(shapes.rounded_box('door', (0.13, 0.05, 0.2), 0.025, door, location=(0.0, -0.27, 0.3)))
    return parts
