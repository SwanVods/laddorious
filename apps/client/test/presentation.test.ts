import type { ActiveEffect, GameEvent, PlayerView } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { applyEvent, presentationFromView, samePresentation, stackOn } from '../src/director/presentation';
import { openingUpdate } from './support/fixtures';

/** The fixture's opening view with some pieces moved. */
function viewWith(positions: Record<string, number>): PlayerView {
  const { view } = openingUpdate();
  return { ...view, players: view.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })) };
}

const shield = (charges: number): ActiveEffect => ({
  id: 'e1',
  owner: 'p0',
  sourceCard: 'snake-charm',
  sourcePlayer: 'p0',
  params: { hook: 'beforeSnake' },
  lifetime: { rounds: 3, charges },
  createdRound: 1,
  seq: 1,
});

describe('presentationFromView', () => {
  it('takes the round, positions, effects, board edits and jumps from the view', () => {
    const view = viewWith({ p1: 14 });
    const shown = presentationFromView(view);
    expect(shown.round).toBe(1);
    expect(shown.positions).toEqual({ p0: 0, p1: 14, p2: 0, p3: 0 });
    expect(shown.arrivals).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(shown.jumps).toEqual(view.board.jumps);
    expect(shown.effects).toEqual([]);
    expect(shown.boardEdits).toEqual([]);
    expect(shown.faceOffs).toEqual([]);
  });

  it('keeps the given stack order, and decided face-offs apart until the knock-backs (2026-10-15)', () => {
    const view: PlayerView = {
      ...viewWith({ p0: 6, p1: 6, p2: 9, p3: 9 }),
      phase: {
        kind: 'settle',
        challenges: [
          { id: 'c1', tile: 6, participants: ['p0', 'p1'], contesting: ['p0', 'p1'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: null },
          { id: 'c2', tile: 9, participants: ['p2', 'p3'], contesting: ['p2', 'p3'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: 'p3' },
        ],
      },
    };
    const shown = presentationFromView(view, ['p3', 'p1', 'p0']);
    expect(shown.arrivals).toEqual(['p3', 'p1', 'p0', 'p2']);
    // The engine knocks the losers back only once every face-off is decided: c2 stays apart meanwhile.
    expect(shown.faceOffs).toEqual([
      { challengeId: 'c1', tile: 6, players: ['p0', 'p1'], decided: false },
      { challengeId: 'c2', tile: 9, players: ['p2', 'p3'], decided: true },
    ]);
    expect(stackOn(shown, 6)).toEqual(['p1', 'p0']);
  });
});

describe('applyEvent: face-offs (2026-10-15)', () => {
  const resolved = (winner: string | null): GameEvent => ({
    type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p0: 'rock', p1: 'rock' }, winner,
    losers: winner ? ['p0'] : [], outcome: winner ? 'win' : 'replay', visibility: 'public',
  });

  it('marks a face-off decided when it has a winner, and keeps its pieces apart until the knock-back', () => {
    const started = applyEvent(presentationFromView(viewWith({ p0: 6, p1: 6 })), {
      type: 'ChallengeStarted', challengeId: 'c1', tile: 6, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public',
    });
    expect(started.faceOffs).toEqual([{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'], decided: false }]);
    expect(applyEvent(started, resolved(null)).faceOffs[0]!.decided).toBe(false);
    expect(applyEvent(started, resolved('p1')).faceOffs).toEqual([{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'], decided: true }]);
  });
});

describe('samePresentation', () => {
  it('ignores stack order and spent shield charges, but not positions', () => {
    const view = viewWith({ p1: 14 });
    const a = presentationFromView({ ...view, effects: [shield(2)] }, ['p0', 'p1', 'p2', 'p3']);
    const b = presentationFromView({ ...view, effects: [shield(1)] }, ['p3', 'p2', 'p1', 'p0']);
    expect(samePresentation(a, b)).toBe(true);
    expect(samePresentation(a, presentationFromView({ ...viewWith({ p1: 15 }), effects: [shield(2)] }))).toBe(false);
  });
});
