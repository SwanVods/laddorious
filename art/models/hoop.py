"""A hoop (board theme spec §3): a fat ring standing on a little post, facing the camera, all Tint; three
on one pad, gold, cyan and lime, swaying. Sculpted at a quarter of its size."""
import math

from lib import finish, palette, sculpt, shapes

S = 4
RING = (1.6, 0.35, 2.3)  # radius, tube, height of its middle
POST = [(0.0, 0.0), (0.5, 0.0), (0.45, 0.1), (0.18, 0.25), (0.18, 0.8), (0.0, 0.8)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    s = 1 / S
    radius, tube, height = RING
    loop = [((radius + tube * math.cos(a)) * s, tube * math.sin(a) * s) for a in (k * math.tau / 24 for k in range(24))]
    ring = shapes.revolve('ring', loop, tint, segments=sculpt.FINE_TURN)
    ring.rotation_euler = (math.pi / 2, 0.0, 0.0)  # stand it up, facing -Y (the camera)
    ring.location = (0.0, 0.0, height * s)
    post = shapes.revolve('post', [(r * s, h * s) for r, h in POST], tint, segments=sculpt.FINE_TURN)
    result = sculpt.fuse('hoop', [(ring, tint), (post, tint)], blend=0.02, soften=0.008, target=150)
    result.scale = (S, S, S)
    return [result]
