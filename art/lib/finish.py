"""The plastic finishes (spec #5 §3.1). Material names are the game's contract: Seat takes the
player's colour, Tint each instance's colour, Glow stays lit; any other name draws as exported."""
import bpy

from .palette import linear


def _material(name):
    if bpy.data.materials.get(name) is not None:
        raise RuntimeError(f'a material named {name} is already in this Blender file; build with `pnpm art` instead')
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    return material, bsdf


def glossy(name, colour):
    """Glossy toy plastic: a clearcoat over a shiny base (pieces, die, crown, pads, props)."""
    material, bsdf = _material(name)
    bsdf.inputs['Base Color'].default_value = linear(colour)
    bsdf.inputs['Roughness'].default_value = 0.3
    bsdf.inputs['Coat Weight'].default_value = 0.9
    bsdf.inputs['Coat Roughness'].default_value = 0.15
    return material


def satin(name, colour):
    """Satin plastic: the same plastic with a softer sheen (tiles, island, bumpers, podium)."""
    material, bsdf = _material(name)
    bsdf.inputs['Base Color'].default_value = linear(colour)
    bsdf.inputs['Roughness'].default_value = 0.45
    bsdf.inputs['Coat Weight'].default_value = 0.0
    return material


def glow(name, colour, strength=1.5, base=None):
    """A lit accent: emission in the base colour (the dragon's eyes, rims, stars). On an instanced part whose
    instance colour tints every material, give it a dark `base`: the glow then shows its own colour whatever
    the tint (a rocket's porthole and flame)."""
    material, bsdf = _material(name)
    bsdf.inputs['Base Color'].default_value = linear(base or colour)
    bsdf.inputs['Roughness'].default_value = 0.3
    bsdf.inputs['Emission Color'].default_value = linear(colour)
    bsdf.inputs['Emission Strength'].default_value = strength
    return material
