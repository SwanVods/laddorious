import { describe, expect, it } from 'vitest';
import { boardViolations, describeCard, type Board, type BoardEditOp, type CatalogCard, type TargetRule } from '../src/index';
import { applyPlannedEdit, planBoardEdit, revertEdit } from '../src/cards/boardEdit';
import { makeBoard, play, positions, roll, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const BEHIND: BoardEditOp = { op: 'boardEdit', action: 'create', kind: 'snake', minAhead: 1, maxAhead: 6, length: 8, behind: true, lifetime: { rounds: 3 } };
const FLIP: BoardEditOp = { op: 'boardEdit', action: 'flip', lifetime: 'permanent' };
const card = (op: BoardEditOp): CatalogCard => ({ id: 'x', name: 'x', type: 'misc', rarity: 'rare', weight: 1, target: SELF, effects: [op] });

/** Every tile holds at most one jump end, so no snake and ladder share a tile and no end is another's start. */
function oneEndPerTile(board: Board): boolean {
  const ends = board.jumps.flatMap((j) => [j.from, j.to]);
  return new Set(ends).size === ends.length;
}

describe('a snake behind you (2026-10-16)', () => {
  it('appears 1–6 tiles behind, the nearest spot that fits', () => {
    const board = makeBoard(100, [[39, 60]]);
    expect(planBoardEdit(board, BEHIND, 40, 'x1')).toEqual({ added: [{ id: 'x1', from: 38, to: 30 }], removed: [] });
  });

  it("fizzles when there's no room behind", () => {
    expect(planBoardEdit(makeBoard(100), BEHIND, 5, 'x1')).toBeNull();
  });
});

describe('Upside Down (2026-10-16: permanent)', () => {
  const board = makeBoard(100, [[30, 5], [12, 40], [70, 55], [62, 88]], { 40: 'common' });

  it('turns every snake into a ladder and every ladder into a snake, on the same tiles', () => {
    const plan = planBoardEdit(board, FLIP, 0, 'x1')!;
    expect(plan.added).toEqual([
      { id: 't1~', from: 5, to: 30 },
      { id: 't3~', from: 55, to: 70 },
      { id: 't4~', from: 88, to: 62 },
    ]);
    const flipped = { ...board, jumps: board.jumps.map((j) => j) };
    applyPlannedEdit(flipped, plan);
    expect(boardViolations(flipped)).toEqual([]);
    expect(oneEndPerTile(flipped)).toBe(true);
  });

  it("leaves a jump whose new start would be a '?' tile as it is", () => {
    const plan = planBoardEdit(board, FLIP, 0, 'x1')!;
    expect(plan.removed.map((j) => j.id)).not.toContain('t2');
  });

  it('flips back to the same board, ids and all', () => {
    const twice = { ...board, jumps: board.jumps.map((j) => j) };
    applyPlannedEdit(twice, planBoardEdit(twice, FLIP, 0, 'x1')!);
    applyPlannedEdit(twice, planBoardEdit(twice, FLIP, 0, 'x2')!);
    expect([...twice.jumps].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...board.jumps].sort((a, b) => a.id.localeCompare(b.id)));
    expect(oneEndPerTile(twice)).toBe(true);
  });

  it("still drops a temporary snake when its own edit runs out, flipped or not", () => {
    const b = makeBoard(100, [[30, 5]]);
    const pit = { added: [{ id: 'x1', from: 50, to: 42 }], removed: [] };
    applyPlannedEdit(b, pit);
    applyPlannedEdit(b, planBoardEdit(b, FLIP, 0, 'x2')!);
    revertEdit(b, pit);
    expect(b.jumps).toEqual([{ id: 't1~', from: 5, to: 30 }]);
  });

  it('lets a piece climb a flipped snake', () => {
    const s = setup({ players: 2, board: makeBoard(100, [[30, 5]]), positions: [2, 0], dice: [[3], [1]] });
    applyPlannedEdit(s.board, planBoardEdit(s.board, FLIP, 0, 'x1')!);
    expect(positions(play(s, [roll('p1'), roll('p2')]).state)[0]).toBe(30);
  });

  it('writes the texts', () => {
    expect(describeCard(card(BEHIND))).toBe('A new snake, 8 tiles long, appears 1–6 tiles behind you (3 rounds).');
    expect(describeCard(card(FLIP))).toBe('Every snake becomes a ladder, and every ladder a snake, for the rest of the match.');
  });
});
