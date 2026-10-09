"""Build the game's Blender models (spec #5 §5).

Headless:  pnpm art [ids...]   (all of art/models/*.py when no id is given)
Blender link:
    BUILD = r'<repo>/art/build.py'
    g = {'__file__': BUILD, '__name__': '__main__', 'ART_IDS': ['pawn']}
    exec(compile(open(BUILD, encoding='utf-8').read(), BUILD, 'exec'), g)
    result = g['RESULT']

Each id names a script in art/models/ whose build() returns the model's parts; the parts are
merged and exported to apps/client/public/models/<id>.glb.
"""
import importlib
import sys
import traceback
from pathlib import Path

import bpy

ART = Path(__file__).resolve().parent
OUT = ART.parent / 'apps' / 'client' / 'public' / 'models'
if str(ART) not in sys.path:
    sys.path.insert(0, str(ART))


def fresh(name):
    """Import a module, reloading it when this Blender session already has it (the link keeps Python running)."""
    module = sys.modules.get(name)
    return importlib.reload(module) if module else importlib.import_module(name)


def requested_ids():
    ids = globals().get('ART_IDS')
    if ids is None:
        ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return list(ids) or sorted(p.stem for p in (ART / 'models').glob('*.py') if not p.stem.startswith('_'))


def main():
    for name in ('lib.palette', 'lib.finish', 'lib.shapes', 'lib.export'):
        fresh(name)
    export = sys.modules['lib.export']
    OUT.mkdir(parents=True, exist_ok=True)
    window = bpy.context.window
    home = window.scene if window else None
    report = []
    try:
        for model_id in requested_ids():
            scene = export.begin()
            parts = fresh(f'models.{model_id}').build()
            report.append(export.finish(scene, model_id, parts, OUT / f'{model_id}.glb'))
    finally:
        if window and home:
            window.scene = home
    for r in report:
        print(f"{r['id']:<8} {r['triangles']:>6} triangles  {len(r['materials'])} materials  {r['height']:.2f} tall  {r['bytes'] / 1024:.0f} KB")
    return report


if __name__ == '__main__':
    try:
        RESULT = main()
    except Exception:
        traceback.print_exc()
        if bpy.app.background:
            sys.exit(1)
        raise
