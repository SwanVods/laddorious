// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Group, Quaternion, Vector3 } from 'three';
import { PIECE_NOTES } from '../src/audio/sounds';
import { PIECE_NAMES } from '../src/hud/labels';
import { placePiece } from '../src/scene/Pieces';
import { PIECES } from '../src/service/matchService';
import { Portrait } from '../src/ui/PieceIcon';

afterEach(cleanup);

describe('the seven pieces (spec #5 §4.1)', () => {
  it('names every piece', () => {
    expect(PIECES.map((p) => PIECE_NAMES[p])).toEqual(['Knight', 'Pawn', 'Meeple', 'Dragon head', 'Rook', 'Top hat', 'Rubber duck']);
  });

  it.each(PIECES)('draws a portrait of the %s', (piece) => {
    const { container } = render(<Portrait piece={piece} color="#ff5470" />);
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d.length).toBeGreaterThan(20);
    expect(d).not.toContain('NaN');
  });

  it('gives each piece its own picker note', () => {
    expect(PIECE_NOTES).toHaveLength(PIECES.length);
    expect(new Set(PIECE_NOTES).size).toBe(PIECES.length);
  });
});

describe('placing a piece (2026-10-14)', () => {
  it('turns the body to face its way, and flips and wobbles the inner model about its own sides', () => {
    const body = new Group();
    const inner = new Group();
    body.add(inner);
    placePiece(body, inner, { position: [1, 2, 3], rotation: [0.25, Math.PI / 2, 0], scale: [1, 1, 1], orb: false });
    expect([body.rotation.x, body.rotation.y, body.rotation.z]).toEqual([0, Math.PI / 2, 0]);
    expect([inner.rotation.x, inner.rotation.y, inner.rotation.z]).toEqual([0.25, 0, 0]);
    // The piece faces +X, side-on to the camera (which looks along -Z). Tipping about its own side axis
    // moves its top left or right on screen, with no lean toward or away from the camera.
    body.updateMatrixWorld(true);
    const top = new Vector3(0, 1, 0).applyQuaternion(inner.getWorldQuaternion(new Quaternion()));
    expect(Math.abs(top.x)).toBeGreaterThan(0.2);
    expect(Math.abs(top.z)).toBeLessThan(1e-6);
  });
});
