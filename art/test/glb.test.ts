import { describe, expect, it } from 'vitest';
import { readGlb } from '../glb';

/** A .glb with this JSON and no binary chunk: enough for the reader, which never reads vertices. */
function glb(json: object): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) text += ' ';
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(20 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(body, 20);
  return out;
}

const MODEL = {
  asset: { version: '2.0' },
  accessors: [
    { count: 3, type: 'VEC3', componentType: 5126, min: [-0.4, 0, -0.3], max: [0.4, 1.1, 0.35] },
    { count: 6, type: 'SCALAR', componentType: 5123 },
    { count: 3, type: 'VEC3', componentType: 5126, min: [0.1, 0.9, -0.2], max: [0.2, 1.0, -0.1] },
  ],
  materials: [{ name: 'Seat' }, { name: 'Eye' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }, { attributes: { POSITION: 2 }, material: 1 }] }],
  nodes: [{ name: 'knight', mesh: 0 }],
};

describe('readGlb (spec #5 §7)', () => {
  it('reads the bounds, the triangles and the materials', () => {
    const model = readGlb(glb(MODEL));
    expect(model.min).toEqual([-0.4, 0, -0.3]);
    expect(model.max).toEqual([0.4, 1.1, 0.35]);
    expect(model.triangles).toBe(3); // 6 indices, plus 3 vertices without indices
    expect(model.materials).toEqual(['Seat', 'Eye']);
    expect(model.byMaterial.Eye).toEqual({ min: [0.1, 0.9, -0.2], max: [0.2, 1.0, -0.1] });
    expect(model.transformedNodes).toEqual([]);
  });

  it('lists nodes that still carry a transform', () => {
    const model = readGlb(glb({ ...MODEL, nodes: [{ name: 'knight', mesh: 0, translation: [0, 0.2, 0] }, { name: 'still', scale: [1, 1, 1] }] }));
    expect(model.transformedNodes).toEqual(['knight']);
  });

  it('refuses a file that is not a glb', () => {
    expect(() => readGlb(new TextEncoder().encode('not a model, just text here'))).toThrow('not a .glb file');
  });
});
