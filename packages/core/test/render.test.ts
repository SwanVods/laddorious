import { describe, expect, it } from 'vitest';
import { renderBoardAscii } from '../src/index';
import { makeBoard } from './support/fixtures';

describe('renderBoardAscii', () => {
  it('draws a serpentine 10x10 grid with marks and a legend', () => {
    const out = renderBoardAscii(makeBoard(100, [[4, 26], [47, 22]], { 7: 'epic', 63: 'rare', 99: 'common' }));
    const lines = out.split('\n');
    expect(lines[0]!.trim().startsWith('100.')).toBe(true); // top row runs right-to-left
    expect(lines[0]).toContain(' 99c');
    expect(lines[9]!.trim().startsWith('1.')).toBe(true); // bottom row runs left-to-right
    expect(lines[9]).toContain('  4L');
    expect(lines[9]).toContain('  7e');
    expect(out).toContain(' 47S');
    expect(out).toContain('Snakes:  47→22');
    expect(out).toContain('Ladders: 4→26');
  });
});
