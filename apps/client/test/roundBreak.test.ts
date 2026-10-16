import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/app/tuning';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { dockModel } from '../src/hud/model';
import { cameraShot } from '../src/scene/camera';
import { openingUpdate } from './support/fixtures';

// A breather between rounds (the user, 2026-10-16): once a round has played out, a few seconds before the next.

const start = presentationFromView(openingUpdate().view);
const moved = (player: PlayerId, from: number, to: number, cause: MoveCause = 'dice'): GameEvent => ({ type: 'Moved', player, from, to, cause, bounced: false, visibility: 'public' });
const nextRound = (round: number): GameEvent[] =>
  [
    { type: 'RoundEnded', round: round - 1, visibility: 'public' },
    { type: 'RoundStarted', round, visibility: 'public' },
    { type: 'WindowOpened', windowId: 9, window: 'dice', players: ['p0', 'p1'], durationMs: 12_000, visibility: 'public' },
  ] as GameEvent[];
const kinds = (events: GameEvent[]) => buildTimeline(events, start, 'p0', 100).map((b) => [b.kind, b.durationMs]);

describe('the break between rounds (2026-10-16)', () => {
  it('is 3.5 seconds unless tuning.json says otherwise', () => {
    expect(DEFAULT_TUNING.timing.roundBreakMs).toBe(3500);
    expect(BEAT_MS.roundBreak).toBe(3500);
  });

  it('plays after the round, its end hold and bookkeeping, before the next round opens', () => {
    const k = kinds([moved('p0', 0, 3), ...nextRound(3)]);
    expect(k.map(([kind]) => kind)).toEqual(['move', 'pause', 'info', 'roundBreak', 'info']);
    expect(k[1]![1]).toBe(BEAT_MS.endHold);
    expect(k[3]![1]).toBe(BEAT_MS.roundBreak);
  });

  it('never plays before the first round', () => {
    expect(kinds(nextRound(1)).map(([kind]) => kind)).not.toContain('roundBreak');
  });

  it('shows the whole board, and says the next round is coming instead of offering ROLL', () => {
    const beats = buildTimeline([moved('p0', 0, 3), ...nextRound(4)], start, 'p0', 100);
    const pause = { ...beats.find((b) => b.kind === 'roundBreak')!, startedAt: 0 };
    const view = { ...openingUpdate().view, awaiting: { ...openingUpdate().view.awaiting, window: 'dice', players: ['p0', 'p1'] } } as never;
    expect(dockModel({ beat: pause, view, record: { round: 4, dice: {}, cards: {} }, me: 'p0' })).toEqual({ kind: 'caption', parts: ['Next: round 4'], totals: null });
    const shot = cameraShot({ beat: pause, window: 'dice', myPick: false, me: 'p0', watch: null, piece: () => [0, 0, 0], reducedMotion: false, nowMs: 0, held: { player: 'p1' } });
    expect(shot.mode).toBe('overview');
  });
});
