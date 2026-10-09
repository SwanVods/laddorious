// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { prepareSlotMesh, slotMeshFromScene, useSlotMesh, type SlotMesh } from '../src/assets/slotMesh';

describe('instanced slots (spec #5 §6)', () => {
  it('merges a model into one geometry with a group per material, its transforms baked in', () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ name: 'Tint' }));
    const star = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: 'Glow' }));
    star.position.set(0, 2, 0);
    root.add(body, star);
    const mesh = slotMeshFromScene(root);
    expect((mesh.material as MeshStandardMaterial[]).map((m) => m.name)).toEqual(['Tint', 'Glow']);
    expect(mesh.geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1]);
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.max.y).toBeCloseTo(2.1);
  });

  it('keeps a one-material model to one material', () => {
    const mesh = slotMeshFromScene(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Tint' })));
    expect(Array.isArray(mesh.material)).toBe(false);
  });

  it('readies the materials: Tint white, and no clearcoat on Low, on copies', () => {
    const tint = new MeshStandardMaterial({ name: 'Tint', color: '#808080' });
    const glossy = new MeshPhysicalMaterial({ name: 'Pad', clearcoat: 0.9 });
    const ready = prepareSlotMesh({ geometry: new BoxGeometry(), material: [tint, glossy] }, { clearcoat: false });
    const [white, plain] = ready.material as [MeshStandardMaterial, MeshPhysicalMaterial];
    expect(white.color.getHexString()).toBe('ffffff');
    expect(plain.clearcoat).toBe(0);
    expect(glossy.clearcoat).toBe(0.9);
  });

  it('keeps the code-built stand-in in unit tests', () => {
    const stand: SlotMesh = { geometry: new BoxGeometry(), material: new MeshStandardMaterial() };
    const { result } = renderHook(() => useSlotMesh('tile', () => stand, { clearcoat: true }));
    expect(result.current).toBe(stand);
  });
});
