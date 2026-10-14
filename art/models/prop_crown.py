"""The crown, big, as a prop (board theme spec B4): a gold band flaring into six points (an even count keeps it centred), each topped with a
ball, in one sculpted piece. Lighter than the game's crown (plan decision 2); the game turns it slowly."""
import math

from lib import finish, palette, sculpt, shapes

WALL = [(1.35, 0.0), (1.55, 0.0), (1.75, 1.3), (1.6, 1.3)]  # a loop: the band's section


def build():
    gold = finish.glossy('Gold', palette.GOLD)
    parts = [(shapes.revolve('band', WALL, gold, segments=sculpt.FINE_TURN), gold)]
    for k in range(6):
        a = k * math.tau / 6
        parts.append((shapes.cone(f'point{k}', 0.38, 1.2, gold, location=(1.5 * math.cos(a), 1.5 * math.sin(a), 1.1), segments=32), gold))
        parts.append((shapes.sphere(f'ball{k}', 0.22, gold, location=(1.53 * math.cos(a), 1.53 * math.sin(a), 2.35), **sculpt.FINE), gold))
    return [sculpt.fuse('prop_crown', parts, voxel=0.012, blend=0.15, soften=0.02, target=700)]
