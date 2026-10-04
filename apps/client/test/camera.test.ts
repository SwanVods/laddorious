import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { cameraShot, type ShotInput } from '../src/scene/camera';
import type { Vec3 } from '../src/scene/layout';
import { openingUpdate } from './support/fixtures';

const SPOTS: Record<PlayerId, Vec3> = { p0: [1, 0, 1], p1: [5, 0, -3], p2: [-4, 0, 2], p3: [0, 0, -6] };
const after = presentationFromView(openingUpdate().view);
const beatOf = (kind: Beat['kind'], events: GameEvent[]): Beat => ({ kind, durationMs: 1000, events, after });
const moved = (player: PlayerId, cause: MoveCause = 'dice'): GameEvent => ({ type: 'Moved', player, from: 1, to: 9, cause, bounced: false, visibility: 'public' });

function shot(over: Partial<ShotInput> = {}) {
  return cameraShot({ beat: null, window: 'dice', myPick: false, me: 'p0', watch: null, piece: (id) => SPOTS[id]!, reducedMotion: false, nowMs: 0, ...over });
}

describe('camera rules (spec #2 §5.3)', () => {
  it('shows the whole board while everyone rolls', () => {
    expect(shot()).toMatchObject({ mode: 'overview', target: [0, 0, 0] });
  });

  it('drifts gently over the overview, and holds still with reduced motion', () => {
    expect(shot({ nowMs: 4000 }).position).not.toEqual(shot({ nowMs: 0 }).position);
    expect(shot({ nowMs: 4000, reducedMotion: true }).position).toEqual(shot({ nowMs: 0, reducedMotion: true }).position);
  });

  it('follows my piece while another piece moves', () => {
    expect(shot({ beat: beatOf('move', [moved('p1')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it('follows my piece through a face-off window I am not in', () => {
    expect(shot({ window: 'challenge' })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it("swoops in for my own slide or launch, but not for anyone else's", () => {
    expect(shot({ beat: beatOf('slide', [moved('p0', 'snake')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('launch', [moved('p0', 'ladder')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('slide', [moved('p2', 'snake')]) }).mode).toBe('follow');
  });

  it('swoops in for a face-off I am in', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: 9, players: ['p0', 'p3'], kind: 'rps', theme: null, visibility: 'public' };
    expect(shot({ beat: beatOf('faceOff', [started]) }).mode).toBe('swoop');
  });

  it('swoops in for a card aimed at me', () => {
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public' };
    expect(shot({ beat: beatOf('cardResolved', [card]) }).mode).toBe('swoop');
  });

  it('swoops in for my Mystery pick', () => {
    expect(shot({ window: 'mystery', myPick: true }).mode).toBe('swoop');
  });

  it('follows the watched piece instead of mine', () => {
    expect(shot({ watch: 'p2', beat: beatOf('slide', [moved('p0', 'snake')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p2 });
  });

  it('cuts instead of swooping with reduced motion', () => {
    expect(shot({ window: 'mystery', myPick: true, reducedMotion: true })).toMatchObject({ mode: 'swoop', cut: true });
  });

  it('swoops onto my win, and follows anyone else who wins', () => {
    const won = (winner: PlayerId): GameEvent => ({ type: 'MatchWon', winner, rankings: [], visibility: 'public' });
    expect(shot({ beat: beatOf('victory', [won('p0')]) })).toMatchObject({ mode: 'swoop', target: SPOTS.p0 });
    expect(shot({ beat: beatOf('victory', [won('p3')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p3 });
  });
});
