import { boardViolations } from '../board/invariants';
import { jumpKind, jumpLength, type Board, type Jump, type JumpKind } from '../board/types';
import type { BoardEditOp } from './types';

export interface PlannedEdit {
  added: Jump[];
  removed: Jump[];
}

function withEdit(board: Board, edit: PlannedEdit): Board {
  const removedIds = new Set(edit.removed.map((j) => j.id));
  return { ...board, jumps: [...board.jumps.filter((j) => !removedIds.has(j.id)), ...edit.added] };
}

function isValid(board: Board, edit: PlannedEdit): boolean {
  return boardViolations(withEdit(board, edit)).length === 0;
}

/** Nearest jump of `kind` starting strictly ahead of `anchor`. */
function nearestAhead(board: Board, anchor: number, kind: JumpKind): Jump | undefined {
  return board.jumps
    .filter((j) => jumpKind(j) === kind && j.from > anchor)
    .sort((a, b) => a.from - b.from)[0];
}

function makeJump(id: string, from: number, kind: JumpKind, length: number): Jump {
  return { id, from, to: kind === 'snake' ? from - length : from + length };
}

/**
 * Plan a board edit anchored at the target's position (spec §5.7). Returns
 * null when no placement satisfies the hard invariants (the card fizzles).
 * Does not mutate the board.
 */
export function planBoardEdit(board: Board, op: BoardEditOp, anchor: number, newId: string): PlannedEdit | null {
  switch (op.action) {
    case 'create': {
      for (let ahead = op.minAhead; ahead <= op.maxAhead; ahead++) {
        const edit = { added: [makeJump(newId, anchor + ahead, op.kind, op.length)], removed: [] };
        if (isValid(board, edit)) return edit;
      }
      return null;
    }
    case 'remove': {
      const j = nearestAhead(board, anchor, op.kind);
      return j ? { added: [], removed: [j] } : null;
    }
    case 'move': {
      const j = nearestAhead(board, anchor, op.kind);
      if (!j) return null;
      for (let ahead = op.minAhead; ahead <= op.maxAhead; ahead++) {
        const edit = { added: [makeJump(newId, anchor + ahead, op.kind, jumpLength(j))], removed: [j] };
        if (isValid(board, edit)) return edit;
      }
      return null;
    }
    case 'modify': {
      const j = nearestAhead(board, anchor, op.kind);
      if (!j) return null;
      const length = jumpLength(j) + op.lengthDelta;
      if (length < 1) return null;
      const edit = { added: [makeJump(newId, j.from, op.kind, length)], removed: [j] };
      return isValid(board, edit) ? edit : null;
    }
  }
}

export function applyPlannedEdit(board: Board, edit: PlannedEdit): void {
  const removedIds = new Set(edit.removed.map((j) => j.id));
  board.jumps = [...board.jumps.filter((j) => !removedIds.has(j.id)), ...edit.added];
}

/**
 * Undo an expired edit: drop the jumps it added, then restore what it removed
 * where that is still valid. Returns restored and dropped jump ids.
 */
export function revertEdit(board: Board, edit: PlannedEdit): { restored: string[]; dropped: string[] } {
  const addedIds = new Set(edit.added.map((j) => j.id));
  board.jumps = board.jumps.filter((j) => !addedIds.has(j.id));
  const restored: string[] = [];
  const dropped: string[] = [];
  for (const j of edit.removed) {
    if (boardViolations({ ...board, jumps: [...board.jumps, j] }).length === 0) {
      board.jumps.push(j);
      restored.push(j.id);
    } else {
      dropped.push(j.id);
    }
  }
  return { restored, dropped };
}
