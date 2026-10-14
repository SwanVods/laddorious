"""The fan (board theme spec §3): a rounded hub with four flat, peach blades; the game spins it. Sculpted at
an eighth of its size."""
import math

from lib import finish, palette, sculpt, shapes

S = 8
HUB = [(0.0, 0.0), (0.9, 0.0), (0.8, 0.4), (0.7, 2.3), (0.5, 2.7), (0.0, 2.85)]
BLADE = (0.45, 3.8, 2.5, 2.2)  # radius, length, its middle's distance out, height


def build():
    blade = finish.glossy('Blade', palette.PEACH)
    s = 1 / S
    parts = [(shapes.revolve('hub', [(r * s, h * s) for r, h in HUB], blade, segments=sculpt.FINE_TURN), blade)]
    radius, length, out, height = BLADE
    for k in range(4):
        a = k * math.pi / 2
        arm = shapes.capsule(f'blade{k}', radius * s, length * s, blade, location=(out * math.cos(a) * s, out * math.sin(a) * s, height * s), rotation=(0.0, math.pi / 2, a))
        arm.scale = (0.45, 1.0, 1.0)  # flat: thin across its local X, which the turn stands upright
        parts.append((arm, blade))
    result = sculpt.fuse('fan', parts, blend=0.03, soften=0.008, target=350)
    result.scale = (S, S, S)
    return [result]
