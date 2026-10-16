import { describe, expect, it } from 'vitest';
import { boardViolations, generateBoard, resolveConfig, type BoardEditOp, type Jump } from '../src/index';
import { planBoardEdit } from '../src/cards/boardEdit';
import { makeBoard } from './support/fixtures';

// No three snake heads in a row, and no three ladder feet in a row (the user, 2026-10-16: a match had three snakes
// on three tiles in a row). A board rule, so generated boards and the cards that change the board both keep it.

const starts = (jumps: readonly Jump[], kind: 'snake' | 'ladder') => new Set(jumps.filter((j) => (j.to < j.from) === (kind === 'snake')).map((j) => j.from));
function longestRun(tiles: Set<number>): number {
  let best = 0;
  let run = 0;
  for (let t = 1; t < 100; t++) {
    run = tiles.has(t) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

describe('no three snakes or three ladders in a row (2026-10-16)', () => {
  it('refuses three snake heads in a row, and three ladder feet', () => {
    expect(boardViolations(makeBoard(100, [[30, 20], [31, 10], [32, 5]])).join()).toMatch(/three snake heads in a row at 30–32/);
    expect(boardViolations(makeBoard(100, [[40, 60], [41, 70], [42, 80]])).join()).toMatch(/three ladder feet in a row at 40–42/);
  });

  it('allows two in a row, and a mix', () => {
    expect(boardViolations(makeBoard(100, [[30, 20], [31, 10]]))).toEqual([]);
    expect(boardViolations(makeBoard(100, [[30, 20], [31, 60], [32, 5]]))).toEqual([]);
  });

  it('never generates a run of three', () => {
    const cfg = resolveConfig({ seed: 's' }).board;
    for (let i = 0; i < 150; i++) {
      const { jumps } = generateBoard(`runs-${i}`, cfg).board;
      expect(longestRun(starts(jumps, 'snake')), `runs-${i} snakes`).toBeLessThanOrEqual(2);
      expect(longestRun(starts(jumps, 'ladder')), `runs-${i} ladders`).toBeLessThanOrEqual(2);
    }
  });

  it("doesn't let a card's new snake make a third", () => {
    const board = makeBoard(100, [[31, 25], [32, 21]]);
    const create: BoardEditOp = { op: 'boardEdit', action: 'create', kind: 'snake', minAhead: 1, maxAhead: 6, length: 10, lifetime: { rounds: 3 } };
    expect(planBoardEdit(board, create, 32, 'x1')!.added[0]!.from).toBe(34);
  });

  it('flips what it can: a jump whose flip would make a third stays', () => {
    // Ladders 5→30 and 6→31 flip into snake heads at 30 and 31; the snake 32→20 already has its head at 32.
    const board = makeBoard(100, [[5, 30], [6, 31], [32, 20]]);
    const plan = planBoardEdit(board, { op: 'boardEdit', action: 'flip', lifetime: 'permanent' }, 0, 'x1')!;
    const after = [...board.jumps.filter((j) => !plan.removed.includes(j)), ...plan.added];
    expect(boardViolations({ ...board, jumps: after })).toEqual([]);
    expect(plan.removed.length).toBe(2);
  });
});
