import type { GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, type BeatKind } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import type { PresentationState } from '../src/director/presentation';
import { rankBadges } from '../src/hud/ranks';

const won: GameEvent = {
  type: 'MatchWon',
  winner: 'p0',
  rankings: [
    { player: 'p0', rank: 1, position: 100 },
    { player: 'p1', rank: 2, position: 70 },
    { player: 'p2', rank: 3, position: 41 },
    { player: 'p3', rank: 3, position: 41 },
  ],
  visibility: 'public',
};
const beat = (kind: BeatKind): PlayingBeat => ({ kind, events: [won], durationMs: 1000, startedAt: 0, after: {} as PresentationState });

describe('rank badges (polish spec §4.5)', () => {
  it('shows nothing outside the ranks reveal', () => {
    expect(rankBadges(beat('victory'), 1)).toEqual({});
    expect(rankBadges(null, 1)).toEqual({});
  });

  it('badges every non-winner, last place first, ties together', () => {
    expect(rankBadges(beat('ranks'), 1)).toEqual({
      p1: { label: '2nd', delayMs: BEAT_MS.rankStep },
      p2: { label: '3rd', delayMs: 0 },
      p3: { label: '3rd', delayMs: 0 },
    });
  });

  it('scales the reveal with the time scale', () => {
    expect(rankBadges(beat('ranks'), 0.05).p1!.delayMs).toBe(BEAT_MS.rankStep * 0.05);
  });
});
