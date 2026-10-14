"""The ramp (board theme spec §3): a soft lime slab tipped up on a block, like a jump on an obstacle course.
Sculpted at a quarter of its size."""
from lib import finish, palette, sculpt, shapes

S = 4


def build():
    ramp = finish.glossy('Ramp', palette.LIME)
    s = 1 / S
    slab = shapes.rounded_box('slab', (6.5 * s, 3.0 * s, 0.7 * s), 0.25 * s, ramp, location=(0.0, 0.0, 1.45 * s), rotation=(0.0, -0.35, 0.0))
    block = shapes.rounded_box('block', (1.0 * s, 2.6 * s, 2.3 * s), 0.2 * s, ramp, location=(2.4 * s, 0.0, 1.15 * s))
    result = sculpt.fuse('ramp', [(slab, ramp), (block, ramp)], blend=0.03, soften=0.01, target=300, adaptivity=0.3)
    result.scale = (S, S, S)
    return [result]
