import { BoxGeometry, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { prepareSlotMesh } from '../src/assets/slotMesh';
import { PAINT_REPEAT, PAINT_WALL, paintUv } from '../src/scene/boardPaint';

// The painted platform (the user, 2026-10-16): big brush strokes over the deck and the rim, in place of the
// plain cream and the red stripes.

describe('the painted platform', () => {
  it('projects the paint from above on flat parts and from the side on walls, so it never smears', () => {
    const box = new BoxGeometry(4, 6, 8);
    box.deleteAttribute('uv');
    paintUv(box);
    const pos = box.getAttribute('position');
    const normal = box.getAttribute('normal');
    const uv = box.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      // A wall shows a thin band of the paint unless its height is stretched to fit more of the strokes.
      const expected = normal.getY(i) !== 0 ? [x, z] : normal.getX(i) !== 0 ? [z, y * PAINT_WALL] : [x, y * PAINT_WALL];
      expect([uv.getX(i), uv.getY(i)]).toEqual(expected.map((v) => expect.closeTo(v / PAINT_REPEAT, 6)));
    }
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
    expect(box.getAttribute('uv')).toBeTruthy();
  });
});
