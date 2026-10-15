"""A rocket's flame plume (2026-10-15): the tongue of fire that flares under a rocket as it lifts off with
its piece. One lathed, glowing tangerine teardrop, built standing on its wide end; the game turns it over
under the rocket's nozzle and scales it with the flare, so it only shows while a rocket flies. Its glow
has a tangerine base too, so it keeps its colour without an instance tint."""
from lib import finish, palette, shapes

# (radius, height): a rounded wide end, swelling a little, then drawn out to a point.
PROFILE = [(0, 0), (0.055, 0.008), (0.08, 0.035), (0.088, 0.075), (0.08, 0.14), (0.062, 0.22), (0.04, 0.3), (0.018, 0.37), (0, 0.42)]


def build():
    flame = finish.glow('Flame', palette.TANGERINE, 2.5, base=palette.TANGERINE)
    return [shapes.revolve('plume', PROFILE, flame, segments=16)]
