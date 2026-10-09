// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { slotFile } from '../src/assets/slotFiles';
import { SlotBoundary, prepareMaterial, prepareModel, setEmissive, slotUrl } from '../src/assets/slots';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error('404 knight.glb');
}

describe('asset slots (spec #2 §6.3, spec #5 §6)', () => {
  it('loads the lighter file for pieces on Low quality, and the one file elsewhere (spec #5 A14)', () => {
    expect(slotFile('piece.knight')).toBe('knight');
    expect(slotFile('piece.knight', true)).toBe('knight-low');
    expect(slotFile('crown', true)).toBe('crown');
    expect(slotFile('die', true)).toBe('die');
    expect(slotFile('tile', true)).toBe('tile');
  });

  it('gives materials named Seat the seat colour, leaving shared materials and other parts alone', () => {
    const seat = new MeshStandardMaterial({ name: 'Seat', color: '#ffffff' });
    const trim = new MeshStandardMaterial({ name: 'Trim', color: '#000000' });
    const body = new Mesh(new BoxGeometry(), seat);
    const hat = new Mesh(new BoxGeometry(), [seat, trim]);
    const root = new Group();
    root.add(body, hat);
    prepareModel(root, { seat: '#ff5470' });
    expect((body.material as MeshStandardMaterial).color.getHexString()).toBe('ff5470');
    const [tinted, untouched] = hat.material as MeshStandardMaterial[];
    expect(tinted!.color.getHexString()).toBe('ff5470');
    expect(untouched).toBe(trim);
    expect(seat.color.getHexString()).toBe('ffffff');
  });

  it('drops the clearcoat on Low quality, on a copy, and keeps it on High', () => {
    const glossy = new MeshPhysicalMaterial({ name: 'Seat', clearcoat: 0.9 });
    const low = new Mesh(new BoxGeometry(), glossy);
    prepareModel(low, { clearcoat: false });
    expect((low.material as MeshPhysicalMaterial).clearcoat).toBe(0);
    expect(glossy.clearcoat).toBe(0.9);
    const high = new Mesh(new BoxGeometry(), glossy);
    prepareModel(high, { clearcoat: true });
    expect(high.material).toBe(glossy);
  });

  it('readies every lit material to flash, then flashes it', () => {
    const body = new MeshStandardMaterial({ name: 'Body' });
    const die = new Mesh(new BoxGeometry(), body);
    prepareModel(die, { emissive: '#ffcc33' });
    const ready = die.material as MeshStandardMaterial;
    expect(ready.emissive.getHexString()).toBe('ffcc33');
    expect(ready.emissiveIntensity).toBe(0);
    setEmissive(die, 0.5);
    expect(ready.emissiveIntensity).toBe(0.5);
    expect(body.emissiveIntensity).toBe(1);
  });

  it('casts shadows only when asked', () => {
    const lit = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    prepareModel(lit, { shadows: true });
    expect(lit.castShadow).toBe(true);
    const flat = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    prepareModel(flat, {});
    expect(flat.castShadow).toBe(false);
  });

  it("casts a model's shadow from its small Shadow mesh, which draws nothing on screen", () => {
    const model = () => {
      const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Seat' }));
      const shadow = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Shadow' }));
      return { root: new Group().add(body, shadow), body, shadow };
    };
    const lit = model();
    prepareModel(lit.root, { shadows: true });
    expect(lit.body.castShadow).toBe(false);
    expect(lit.shadow.castShadow).toBe(true);
    expect(lit.shadow.visible).toBe(true);
    expect(lit.shadow.material).toMatchObject({ colorWrite: false, depthWrite: false });
    // Without shadows it isn't drawn at all.
    const flat = model();
    prepareModel(flat.root, {});
    expect(flat.shadow.visible).toBe(false);
    expect(flat.body.castShadow).toBe(false);
  });

  it('turns Tint white on a copy, so instance colours show (spec #5 §3.2)', () => {
    const grey = new MeshStandardMaterial({ name: 'Tint', color: '#808080' });
    const ready = prepareMaterial(grey, {}) as MeshStandardMaterial;
    expect(ready.color.getHexString()).toBe('ffffff');
    expect(grey.color.getHexString()).toBe('808080');
  });

  it('keeps the code-built models in unit tests', () => {
    expect(slotUrl('piece.knight')).toBeNull();
  });

  it('shows the built-in model and warns when a model fails to load', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SlotBoundary name="piece.knight" fallback={<p>built-in knight</p>}>
        <Broken />
      </SlotBoundary>,
    );
    expect(screen.getByText('built-in knight')).toBeTruthy();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('piece.knight');
  });
});
