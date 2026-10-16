import { BoxGeometry, BufferAttribute, BufferGeometry, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { prepareSlotMesh } from '../src/assets/slotMesh';
import { PAINT_REPEAT, PAINT_WALL, paintGeometry } from '../src/scene/boardPaint';

// The painted platform (the user, 2026-10-16): big brush strokes over the deck and the rim, in place of the
// plain cream and the red stripes.

/** Where a point's paint comes from, seen along a triangle facing up, along x, or along z. */
const projected = (axis: 'y' | 'x' | 'z', x: number, y: number, z: number) => (axis === 'y' ? [x, z] : axis === 'x' ? [z, y * PAINT_WALL] : [x, y * PAINT_WALL]);

describe('the painted platform', () => {
  it('projects the paint from above on flat parts and from the side on walls, so it never smears', () => {
    const box = new BoxGeometry(4, 6, 8);
    box.deleteAttribute('uv');
    const painted = paintGeometry(box);
    const pos = painted.getAttribute('position');
    const normal = painted.getAttribute('normal');
    const uv = painted.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const axis = normal.getY(i) !== 0 ? 'y' : normal.getX(i) !== 0 ? 'x' : 'z';
      // A wall shows a thin band of the paint unless its height is stretched to fit more of the strokes.
      expect([uv.getX(i), uv.getY(i)]).toEqual(projected(axis, pos.getX(i), pos.getY(i), pos.getZ(i)).map((v) => expect.closeTo(v / PAINT_REPEAT, 6)));
    }
  });

  it('projects a whole triangle one way, even where its corners face different ways, so a curve never squeezes the paint into stripes', () => {
    // A rounded edge: a triangle that faces mostly up, whose corners' normals turn from up to sideways.
    const curve = new BufferGeometry();
    curve.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0, 0.3, 1, 1, 0.3, 0]), 3));
    curve.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 1, 0, 0, 0, 0, 1]), 3));
    curve.setIndex([0, 1, 2]);
    const uv = paintGeometry(curve).getAttribute('uv');
    const pos = curve.getAttribute('position');
    for (let i = 0; i < 3; i++) expect([uv.getX(i), uv.getY(i)]).toEqual(projected('y', pos.getX(i), pos.getY(i), pos.getZ(i)).map((v) => expect.closeTo(v / PAINT_REPEAT, 6)));
  });

  it('paints the deck and the rim stripes, and nothing else', () => {
    const named = (name: string) => Object.assign(new MeshStandardMaterial({ color: '#ff5470' }), { name });
    const paint = new Texture();
    const box = new BoxGeometry();
    box.deleteAttribute('uv');
    const ready = prepareSlotMesh({ geometry: box, material: [named('Deck'), named('Stripe'), named('Cushion')] }, { clearcoat: true, paint });
    const [deck, stripe, cushion] = ready.material as MeshStandardMaterial[];
    expect([deck!.map, stripe!.map, cushion!.map]).toEqual([paint, paint, null]);
    expect(deck!.color.getHexString()).toBe('ffffff');
    expect(cushion!.color.getHexString()).toBe('ff5470');
    expect(ready.geometry.getAttribute('uv')).toBeTruthy();
    expect(ready.geometry.groups).toEqual(box.groups);
    expect(box.getAttribute('uv')).toBeUndefined();
  });
});
