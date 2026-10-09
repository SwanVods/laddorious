"""The rubber duck (spec #5 §4.1): one soft body that swells into a neck and a round head, an upturned
tail and little wing bumps, with a wide orange bill growing out of the face. The knight's dark eyes
with a white shine sit on the head."""
from lib import finish, palette, sculpt, shapes

SHADOW = 400  # triangles in the stand-in that casts its shadow in the game (spec #5 §6)


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    beak = finish.glossy('Beak', palette.TANGERINE)
    eye = finish.glossy('Eye', palette.INK)
    shine = finish.glow('Shine', palette.WHITE, 1.0)
    body = [
        shapes.sphere('body', 0.36, seat, location=(0.0, 0.03, 0.28), scale=(0.88, 1.12, 0.74), **sculpt.FINE),
        shapes.sphere('neck', 0.17, seat, location=(0.0, -0.1, 0.5), **sculpt.FINE),
        shapes.sphere('head', 0.21, seat, location=(0.0, -0.14, 0.7), **sculpt.FINE),
        # The tail sweeps up and back (+Y) to a soft point.
        shapes.sphere('tail', 0.13, seat, location=(0.0, 0.33, 0.43), scale=(0.75, 1.0, 1.15), **sculpt.FINE),
        shapes.cone('tip', 0.09, 0.2, seat, location=(0.0, 0.36, 0.45), rotation=(-0.75, 0.0, 0.0), segments=48),
    ]
    for s in (1, -1):
        body.append(shapes.sphere(f'wing{s}', 0.14, seat, location=(s * 0.27, 0.07, 0.33), scale=(0.35, 1.2, 0.68), **sculpt.FINE))
    bill = [
        # Narrow where it leaves the face, wide and flat at the tip.
        shapes.sphere('bill-root', 0.085, beak, location=(0.0, -0.31, 0.66), scale=(1.0, 1.1, 0.55), **sculpt.FINE),
        # The tip turns up a little.
        shapes.sphere('bill-tip', 0.1, beak, location=(0.0, -0.39, 0.665), scale=(1.3, 0.9, 0.42), **sculpt.FINE),
    ]
    # A mouth line across the bill's front, and two nostril dimples on top.
    details = [shapes.rounded_box('mouth', (0.3, 0.2, 0.012), 0.0, beak, location=(0.0, -0.44, 0.655), segments=1)]
    for s in (1, -1):
        details.append(shapes.sphere(f'nostril{s}', 0.013, beak, location=(s * 0.03, -0.385, 0.697), **sculpt.FINE))
    # A flat base so the duck sits steady: everything below z = 0.015 is cut away.
    floor = shapes.rounded_box('floor', (1.2, 1.2, 0.2), 0.0, seat, location=(0.0, 0.0, -0.085), segments=1)
    duck = sculpt.fuse('duck', [(p, p.data.materials[0]) for p in body + bill], cutters=[(floor, None)] + [(d, beak) for d in details], voxel=0.005, blend=0.06, soften=0.012, target=9000)
    parts = [duck]
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.045, eye, location=(s * 0.11, -0.285, 0.75), segments=16, rings=10))
        parts.append(shapes.sphere(f'shine{s}', 0.015, shine, location=(s * 0.122, -0.318, 0.77), segments=8, rings=6))
    # The flat cut is 0.015 up; lower the whole duck onto the floor.
    for part in parts:
        part.location.z -= 0.015
    return parts
