"""A chunky cloud (board theme spec §3): five puffs grown into one soft lump, flat-ish underneath. The game
draws it many times, big, below and round the platform. Built at a quarter of its size, so the fields'
grid stays small, then scaled up."""
from lib import finish, palette, sculpt, shapes

S = 4
LIFT = 0.042  # the fused surface swells this far below the puffs: lift them so its base sits at 0
PUFFS = [(-1.7, 0.0, 1.0, 1.0), (0.0, 0.0, 1.3, 1.3), (1.7, 0.0, 1.0, 1.0), (0.6, 0.7, 0.95, 0.95), (-0.6, -0.7, 0.95, 0.95)]  # x, y, z, radius


def build():
    cloud = finish.satin('Cloud', palette.CREAM)
    s = 1 / S
    parts = [(shapes.sphere(f'puff{i}', r * s, cloud, location=(x * s, y * s, (z + LIFT) * s), **sculpt.FINE), cloud) for i, (x, y, z, r) in enumerate(PUFFS)]
    result = sculpt.fuse('cloud', parts, blend=0.06, soften=0.01, target=200)  # fuse() never thins below 200
    result.scale = (S, S, S)
    return [result]
