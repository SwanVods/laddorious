import { BoxGeometry, MeshStandardMaterial, ShaderLib, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { prepareSlotMesh } from '../src/assets/slotMesh';
import { PAINT_REPEAT, PLATFORM_WIDTH, paintedMaterial } from '../src/scene/boardPaint';

// The painted platform (the user, 2026-10-16): big brush strokes over the deck and the rim, in place of the
// plain cream and the red stripes.

/** The shader a material compiles to: three's standard one, after the material's own changes. */
function compiled(material: MeshStandardMaterial) {
  const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader as never, null as never);
  return shader;
}

describe('the painted platform', () => {
  it('blends the paint from above and from both sides by where each point faces, so it flows round curves without seams or smears', () => {
    const paint = new Texture();
    const { uniforms, vertexShader, fragmentShader } = compiled(paintedMaterial(new MeshStandardMaterial(), paint));
    expect(uniforms.paintMap!.value).toBe(paint);
    expect(vertexShader).toContain('vPaintPos = position;');
    expect(vertexShader).toContain('vPaintNormal = normal;');
    // Every point reads all three projections and mixes them; nothing reads the model's own (missing) coordinates.
    expect(fragmentShader).not.toContain('#include <map_fragment>');
    expect(fragmentShader.match(/texture2D\( paintMap/g)).toHaveLength(3);
  });

  it('sizes the strokes to the model, so the lobby podium shows as much paint as the board', () => {
    const paint = new Texture();
    const deck = (width: number) => prepareSlotMesh({ geometry: new BoxGeometry(width, 1, width * 0.75), material: Object.assign(new MeshStandardMaterial(), { name: 'Deck' }) }, { clearcoat: true, paint });
    const repeat = (width: number) => Number(compiled(deck(width).material as MeshStandardMaterial).fragmentShader.match(/vPaintPos \/ ([\d.]+);/)![1]);
    expect(repeat(PLATFORM_WIDTH)).toBeCloseTo(PAINT_REPEAT, 1);
    expect(repeat(PLATFORM_WIDTH / 10)).toBeCloseTo(PAINT_REPEAT / 10, 1);
  });

  it('paints the deck and the rim stripes, and nothing else, leaving the model as it is', () => {
    const named = (name: string) => Object.assign(new MeshStandardMaterial({ color: '#ff5470' }), { name });
    const paint = new Texture();
    const box = new BoxGeometry();
    const ready = prepareSlotMesh({ geometry: box, material: [named('Deck'), named('Stripe'), named('Cushion')] }, { clearcoat: true, paint });
    const [deck, stripe, cushion] = ready.material as MeshStandardMaterial[];
    expect([deck, stripe].map((m) => compiled(m!).uniforms.paintMap?.value)).toEqual([paint, paint]);
    expect(compiled(cushion!).uniforms.paintMap).toBeUndefined();
    expect(deck!.color.getHexString()).toBe('ffffff');
    expect(cushion!.color.getHexString()).toBe('ff5470');
    expect(ready.geometry).toBe(box);
  });
});
