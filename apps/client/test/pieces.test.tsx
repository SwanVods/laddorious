// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PIECE_NOTES } from '../src/audio/sounds';
import { PIECE_NAMES } from '../src/hud/labels';
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
