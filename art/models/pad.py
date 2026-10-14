"""A ladder's start (spec #5 §4.2, A16; the user, 2026-10-14): a small toy launch rocket standing on its fins
in its tile's corner, one sculpted piece. A rounded body with an ogive nose, three swept fins that reach down
to the ground, a glowing cream porthole on its front, where the game stands the pair's symbol (PARTS.rocket:
it faces the camera, -Y here, +Z in the game), and a glowing tangerine flame in its nozzle. The body and fins
are white Tint, so the rocket takes its pair's colour; the porthole and flame glow over a dark base, so they
keep their own colours whatever the tint. It used to stand on a round pad; the user asked for no pad and a
smaller rocket, so the profiles below are the old ones lowered onto the ground and scaled by SCALE."""
import math

from lib import finish, palette, sculpt, shapes

SCALE = 0.7
DROP = 0.07  # the old pad's top: everything comes down onto the ground


def _fit(points):
    """Lower a profile by DROP and scale it by SCALE (radius and height)."""
    return [(r * SCALE, (y - DROP) * SCALE) for r, y in points]


BODY = _fit([(0, 0.19), (0.13, 0.19), (0.17, 0.21), (0.2, 0.25), (0.225, 0.3), (0.24, 0.38), (0.245, 0.5), (0.242, 0.66),
             (0.232, 0.78), (0.205, 0.89), (0.16, 0.98), (0.1, 1.05), (0.045, 1.09), (0, 1.1)])
FLAME = _fit([(0, DROP + 0.01), (0.05, 0.1), (0.09, 0.14), (0.11, 0.18), (0.1, 0.21), (0, 0.22)])
# A fin from the side: from the body out to a tip that reaches down to the ground (x outward, y up).
_FIN = [('M', 0.15, 0.48), ('L', 0.15, 0.2), ('Q', 0.29, 0.17, 0.39, DROP + 0.004), ('L', 0.42, 0.11), ('Q', 0.34, 0.28, 0.2, 0.5), ('L', 0.15, 0.48)]
FIN = [(cmd, *[v * SCALE if i % 2 == 0 else (v - DROP) * SCALE for i, v in enumerate(coords)]) for cmd, *coords in _FIN]
FINS = (90, 210, 330)  # degrees round Z: none in front (270, -Y), so the porthole shows
WINDOW = (0.0, -0.235 * SCALE, (0.66 - DROP) * SCALE, 0.13 * SCALE)  # x, y, z, radius: its face just behind PARTS.rocket.z


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    window = finish.glow('Window', palette.CREAM, 1.0, base=palette.INK)
    flame = finish.glow('Flame', palette.TANGERINE, 2.0, base=palette.INK)
    parts = [(shapes.revolve('body', BODY, tint, segments=sculpt.FINE_TURN), tint)]
    for angle in FINS:
        fin = shapes.outline(f'fin{angle}', FIN, 0.05 * SCALE, tint, bevel=0.015 * SCALE, view='side', resolution=8)
        fin.rotation_euler.z += math.radians(angle - 270)  # the side view draws toward -Y (270 degrees)
        parts.append((fin, tint))
    # The body and fins are one sculpted surface, in one colour, so it thins cleanly; the porthole's glass
    # and the flame are their own small parts, as on a real rocket. The grid scales with the rocket, so a
    # fin still spans about seven cells.
    rocket = sculpt.fuse('rocket', parts, voxel=0.012 * SCALE, blend=0.025 * SCALE, soften=0.01 * SCALE, target=750)
    x, y, z, r = WINDOW
    glass = shapes.sphere('window', r, window, location=(x, y, z), scale=(1.0, 0.3, 1.0), segments=14, rings=7)
    fire = shapes.revolve('flame', FLAME, flame, segments=12)
    return [rocket, glass, fire]
