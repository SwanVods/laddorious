import { describe, expect, it } from 'vitest';
import { boardViolations, isSnakeHead, jumpFrom, jumpKind, jumpLength, type Board } from '../src/index';
import { makeBoard } from './support/fixtures';

describe('board helpers', () => {
  const b = makeBoard(100, [[10, 30], [50, 20]]);
  it('classify and measure jumps', () => {
    expect(jumpKind(b.jumps[0]!)).toBe('ladder');
    expect(jumpKind(b.jumps[1]!)).toBe('snake');
    expect(jumpLength(b.jumps[1]!)).toBe(30);
    expect(jumpFrom(b, 50)?.to).toBe(20);
    expect(jumpFrom(b, 51)).toBeUndefined();
    expect(isSnakeHead(b, 50)).toBe(true);
    expect(isSnakeHead(b, 10)).toBe(false);
  });
});

describe('boardViolations', () => {
  it('accepts a valid board', () => {
    expect(boardViolations(makeBoard(100, [[10, 30], [50, 20]], { 5: 'common', 99: 'epic' }))).toEqual([]);
  });

  it.each<[string, Board]>([
    ['jump touching tile N', makeBoard(100, [[90, 100]])],
    ['jump touching tile 0', makeBoard(100, [[5, 0]])],
    ['jump starting on N', makeBoard(100, [[100, 80]])],
    ['two jumps from one tile', makeBoard(100, [[10, 30], [10, 40]])],
    ['jump starting on a Mystery tile', makeBoard(100, [[10, 30]], { 10: 'rare' })],
    ['Mystery on tile N', makeBoard(100, [], { 100: 'rare' })],
    ['a cycle', makeBoard(100, [[10, 30], [30, 10]])],
    ['from equals to', makeBoard(100, [[10, 10]])],
  ])('rejects %s', (_, board) => {
    expect(boardViolations(board).length).toBeGreaterThan(0);
  });

  // No tile holds two jump ends (the user, 2026-10-15: "flag and warp, rocket and splat should never be in one tile").
  it.each([
    ['a ladder ending where a slide starts (a flag on a whirlpool)', [[10, 30], [30, 5]]],
    ['a slide ending where a ladder starts (a splat on a rocket)', [[50, 20], [20, 60]]],
    ['a chain of two ladders', [[10, 30], [30, 50]]],
    ['two jumps ending on one tile', [[10, 30], [50, 30]]],
  ] as Array<[string, Array<[number, number]>]>)('rejects %s', (_, jumps) => {
    expect(boardViolations(makeBoard(100, jumps)).some((v) => v.includes('shares tile'))).toBe(true);
  });
});
