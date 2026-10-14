"""A ladder's start (spec #5 §4.2, A16; the user, Step 2 review 4): a toy launch rocket on its little
pad, one sculpted piece. A rounded body with an ogive nose, three swept fins that reach down to the pad,
a glowing cream porthole on its front, where the game stands the pair's symbol (PARTS.rocket: it faces
the camera, -Y here, +Z in the game), and a glowing tangerine flame in its nozzle. The body, fins and pad
are white Tint, so the rocket takes its pair's colour; the porthole and flame glow over a dark base, so
they keep their own colours whatever the tint."""
import math

from lib import finish, palette, sculpt, shapes

LIFT = 0.07  # the pad's top
BASE = [(0, 0), (0.36, 0), (0.385, 0.015), (0.38, 0.04), (0.34, 0.06), (0.2, 0.068), (0, LIFT)]
BODY = [(0, 0.19), (0.13, 0.19), (0.17, 0.21), (0.2, 0.25), (0.225, 0.3), (0.24, 0.38), (0.245, 0.5), (0.242, 0.66),
        (0.232, 0.78), (0.205, 0.89), (0.16, 0.98), (0.1, 1.05), (0.045, 1.09), (0, 1.1)]
FLAME = [(0, LIFT + 0.01), (0.05, 0.1), (0.09, 0.14), (0.11, 0.18), (0.1, 0.21), (0, 0.22)]
# A fin from the side: from the body out to a tip that reaches down to the pad (x outward, y up).
FIN = [('M', 0.15, 0.48), ('L', 0.15, 0.2), ('Q', 0.29, 0.17, 0.39, LIFT + 0.004), ('L', 0.42, 0.11), ('Q', 0.34, 0.28, 0.2, 0.5), ('L', 0.15, 0.48)]
FINS = (90, 210, 330)  # degrees round Z: none in front (270, -Y), so the porthole shows
WINDOW = (0.0, -0.235, 0.66, 0.13)  # x, y, z, radius: its face just behind PARTS.rocket.z (0.275)


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    window = finish.glow('Window', palette.CREAM, 1.0, base=palette.INK)
    flame = finish.glow('Flame', palette.TANGERINE, 2.0, base=palette.INK)
    parts = [
        (shapes.revolve('pad', BASE, tint, segments=sculpt.FINE_TURN), tint),
        (shapes.revolve('body', BODY, tint, segments=sculpt.FINE_TURN), tint),
    ]
    for angle in FINS:
        fin = shapes.outline(f'fin{angle}', FIN, 0.05, tint, bevel=0.015, view='side', resolution=8)
        fin.rotation_euler.z += math.radians(angle - 270)  # the side view draws toward -Y (270 degrees)
        parts.append((fin, tint))
    # The body, fins and pad are one sculpted surface, in one colour, so it thins cleanly; the porthole's
    # glass and the flame are their own small parts, as on a real rocket. A coarser grid than the pieces'
    # (still seven cells across a fin) keeps the thinning gentle.
    rocket = sculpt.fuse('rocket', parts, voxel=0.012, blend=0.025, soften=0.01, target=750)
    x, y, z, r = WINDOW
    glass = shapes.sphere('window', r, window, location=(x, y, z), scale=(1.0, 0.3, 1.0), segments=14, rings=7)
    fire = shapes.revolve('flame', FLAME, flame, segments=12)
    return [rocket, glass, fire]
