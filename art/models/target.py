"""A ladder's end (spec #5 §4.2, A13; the user's pick at the third Step 2 review): a little flag planted on
the landing tile. One sculpted piece: a low mound, a pole with a ball on top, and a puffy pennant that
waves out to the right, all white Tint, so the whole flag takes the pair's colour (one colour also lets
it thin to its target: colour boundaries hold triangles back). The game stands the pair's symbol in glowing gold on the pennant's face, which looks at the camera (-Y here,
+Z in the game), at PARTS.flag."""
from lib import finish, palette, sculpt, shapes

POLE_X = -0.17  # the pole stands left of centre, so the pennant sits over the tile
MOUND = [(0, 0), (0.17, 0), (0.185, 0.012), (0.17, 0.034), (0.12, 0.052), (0.04, 0.062), (0, 0.063)]
POLE = [(0, 0.04), (0.03, 0.04), (0.03, 1.22), (0, 1.22)]
KNOB = 0.045
# The pennant from the front: wavy top and bottom edges, centred on the symbol's spot (0.15, 1.0).
PENNANT = [('M', -0.15, 1.22), ('Q', 0.02, 1.29, 0.15, 1.22), ('Q', 0.3, 1.15, 0.45, 1.22), ('L', 0.45, 0.78),
           ('Q', 0.3, 0.71, 0.15, 0.78), ('Q', 0.02, 0.85, -0.15, 0.78), ('L', -0.15, 1.22)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    mound = shapes.revolve('mound', MOUND, tint, segments=sculpt.FINE_TURN)
    mound.location.x = POLE_X
    pole = shapes.revolve('pole', POLE, tint, segments=sculpt.FINE_TURN)
    pole.location.x = POLE_X
    knob = shapes.sphere('knob', KNOB, tint, location=(POLE_X, 0.0, 1.22 + KNOB * 0.6), **sculpt.FINE)
    pennant = shapes.outline('pennant', PENNANT, 0.05, tint, bevel=0.02, view='front', resolution=8)
    parts = [(mound, tint), (pole, tint), (knob, tint), (pennant, tint)]
    return [sculpt.fuse('flag', parts, blend=0.02, soften=0.008, target=600)]
