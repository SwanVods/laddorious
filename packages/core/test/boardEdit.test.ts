import { describe, expect, it } from 'vitest';
import { applyPlannedEdit, planBoardEdit, revertEdit } from '../src/cards/boardEdit';
import type { BoardEditOp } from '../src/index';
import { boardViolations } from '../src/board/invariants';
import { laneCenterline, lanesTouch } from '../src/board/layout';
import { makeBoard } from './support/fixtures';

const create = (kind: 'snake' | 'ladder', length: number): BoardEditOp => ({
  op: 'boardEdit', action: 'create', kind, minAhead: 2, maxAhead: 6, length, lifetime: { rounds: 2 },
});

describe('planBoardEdit', () => {
  it('create uses the first tile ahead that keeps the board valid', () => {
    // +2 (tile 12) is a Mystery tile, +3 (tile 13) already starts a jump → tile 14.
    const board = makeBoard(100, [[13, 40]], { 12: 'rare' });
    expect(planBoardEdit(board, create('snake', 8), 10, 'x1')).toEqual({ added: [{ id: 'x1', from: 14, to: 6 }], removed: [] });
  });

  it('create never closes a loop with existing jumps', () => {
    // A ladder 12→25 would meet the snake 25→12 and loop forever; tile 13 is used instead.
    const board = makeBoard(100, [[25, 12]]);
    expect(planBoardEdit(board, create('ladder', 13), 10, 'x1')).toEqual({ added: [{ id: 'x1', from: 13, to: 26 }], removed: [] });
  });

  it("create skips a tile holding another jump's end, and its end avoids one too (2026-10-15)", () => {
    // +2 (tile 12) is where the ladder 5→12 lands; a slide from 13 would end on 5, that ladder's start; tile 14 works.
    const board = makeBoard(100, [[5, 12]]);
    expect(planBoardEdit(board, create('snake', 8), 10, 'x1')).toEqual({ added: [{ id: 'x1', from: 14, to: 6 }], removed: [] });
  });

  it("may lay a slide across another slide's lane (2026-10-16: trails only show for a moment, so crossings don't matter)", () => {
    const board = makeBoard(100, [[15, 8]]);
    const plan = planBoardEdit(board, create('snake', 8), 10, 'x1');
    expect(plan).toEqual({ added: [{ id: 'x1', from: 12, to: 4 }], removed: [] });
    expect(lanesTouch(laneCenterline(12, 4), laneCenterline(15, 8))).toBe(true);
    expect(boardViolations({ ...board, jumps: [...board.jumps, ...plan!.added] })).toEqual([]);
  });

  it('create fizzles when every tile it could use holds a jump end', () => {
    const board = makeBoard(100, [[1, 12], [2, 13], [3, 14], [4, 15], [6, 16]]);
    expect(planBoardEdit(board, create('ladder', 20), 10, 'x1')).toBeNull();
  });

  it('create returns null when no tile works (e.g. a ladder that would reach N)', () => {
    expect(planBoardEdit(makeBoard(100), create('ladder', 15), 90, 'x1')).toBeNull();
  });

  it('remove takes the nearest jump of that kind ahead', () => {
    const board = makeBoard(100, [[30, 10], [50, 20], [15, 40]]);
    const plan = planBoardEdit(board, { op: 'boardEdit', action: 'remove', kind: 'snake', lifetime: { rounds: 1 } }, 20, 'x1');
    expect(plan).toEqual({ added: [], removed: [{ id: 't1', from: 30, to: 10 }] });
  });

  it('move keeps the length; modify changes it', () => {
    const board = makeBoard(100, [[30, 10]]);
    const moved = planBoardEdit(board, { op: 'boardEdit', action: 'move', kind: 'snake', minAhead: 2, maxAhead: 6, lifetime: { rounds: 1 } }, 40, 'x1');
    expect(moved).toBeNull(); // no snake ahead of 40
    const moved2 = planBoardEdit(board, { op: 'boardEdit', action: 'move', kind: 'snake', minAhead: 2, maxAhead: 6, lifetime: { rounds: 1 } }, 20, 'x1');
    expect(moved2).toEqual({ added: [{ id: 'x1', from: 22, to: 2 }], removed: [{ id: 't1', from: 30, to: 10 }] });
    const longer = planBoardEdit(board, { op: 'boardEdit', action: 'modify', kind: 'snake', lengthDelta: 5, lifetime: { rounds: 1 } }, 20, 'x2');
    expect(longer).toEqual({ added: [{ id: 'x2', from: 30, to: 5 }], removed: [{ id: 't1', from: 30, to: 10 }] });
    expect(planBoardEdit(board, { op: 'boardEdit', action: 'modify', kind: 'snake', lengthDelta: -20, lifetime: { rounds: 1 } }, 20, 'x3')).toBeNull();
  });
});

describe('revertEdit', () => {
  it('drops added jumps and restores removed ones', () => {
    const board = makeBoard(100, [[30, 10]]);
    const plan = { added: [{ id: 'x1', from: 22, to: 2 }], removed: [{ id: 't1', from: 30, to: 10 }] };
    applyPlannedEdit(board, plan);
    expect(board.jumps).toEqual([{ id: 'x1', from: 22, to: 2 }]);
    expect(revertEdit(board, plan)).toEqual({ restored: ['t1'], dropped: [] });
    expect(board.jumps).toEqual([{ id: 't1', from: 30, to: 10 }]);
  });

  it('drops a removed jump whose tile is now taken', () => {
    const board = makeBoard(100, [[30, 10]]);
    const plan = { added: [], removed: [{ id: 't1', from: 30, to: 10 }] };
    applyPlannedEdit(board, plan);
    board.jumps.push({ id: 'x9', from: 30, to: 50 });
    expect(revertEdit(board, plan)).toEqual({ restored: [], dropped: ['t1'] });
  });
});
