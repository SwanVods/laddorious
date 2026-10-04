// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlotBoundary, tintSeat } from '../src/assets/slots';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error('404 knight.glb');
}

describe('asset slots (spec #2 §6.3)', () => {
  it('gives materials named Seat the seat colour, leaving shared materials and other parts alone', () => {
    const seat = new MeshStandardMaterial({ name: 'Seat', color: '#ffffff' });
    const trim = new MeshStandardMaterial({ name: 'Trim', color: '#000000' });
    const body = new Mesh(new BoxGeometry(), seat);
    const hat = new Mesh(new BoxGeometry(), [seat, trim]);
    const root = new Group();
    root.add(body, hat);
    tintSeat(root, '#ff5470');
    expect((body.material as MeshStandardMaterial).color.getHexString()).toBe('ff5470');
    const [tinted, untouched] = hat.material as MeshStandardMaterial[];
    expect(tinted!.color.getHexString()).toBe('ff5470');
    expect(untouched).toBe(trim);
    expect(seat.color.getHexString()).toBe('ffffff');
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
