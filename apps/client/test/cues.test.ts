import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { FACE_OFF_DUCK_S, OTHER_ROLL_STAGGER_MS, cuesForBeat, cuesForLog } from '../src/audio/cues';
import { BEAT_MS, type Beat, type BeatKind } from '../src/director/beats';
import type { LoggedEvent } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { openingUpdate } from './support/fixtures';

const ctx = { me: 'p0', boardSize: 100 };
const base = presentationFromView(openingUpdate().view);
const at = (positions: Record<PlayerId, number>): PresentationState => ({ ...base, positions: { ...base.positions, ...positions } });
const beat = (kind: BeatKind, events: GameEvent[], after: PresentationState = base): Beat => ({ kind, durationMs: 1000, events, after });
const rolled = (player: PlayerId, face: number, forced = false): GameEvent => ({ type: 'DieRolled', player, natural: face, face, forced, auto: false, visibility: 'public' });
const moved = (player: PlayerId, from: number, to: number, cause: MoveCause = 'dice'): GameEvent => ({ type: 'Moved', player, from, to, cause, bounced: false, visibility: 'public' });
const won = (winner: PlayerId, ranks: Array<[PlayerId, number]>): GameEvent => ({
  type: 'MatchWon',
  winner,
  rankings: ranks.map(([player, rank]) => ({ player, rank, position: 0 })),
  visibility: 'public',
});
const log = (events: GameEvent[]): LoggedEvent[] => events.map((event, i) => ({ seq: i + 1, event }));

describe('cues for beats (spec #3 §5)', () => {
  it('rattles my roll, adds the sparkle for a forced face, and clacks the others softly, staggered', () => {
    expect(cuesForBeat(beat('roll', [rolled('p1', 3), rolled('p0', 6, true), rolled('p2', 2)]), ctx)).toEqual([
      { id: 'D3', atMs: 0, soft: true },
      { id: 'D2', atMs: 0, soft: false },
      { id: 'D5', atMs: 850, soft: false },
      { id: 'D3', atMs: OTHER_ROLL_STAGGER_MS, soft: true },
    ]);
  });

  it('knocks once per tile step for the longest move, then lands; softly when my piece is not moving', () => {
    const cues = cuesForBeat(beat('move', [moved('p1', 0, 3), moved('p2', 0, 2)], at({ p1: 3, p2: 2 })), ctx);
    expect(cues).toEqual([
      { id: 'H1', atMs: 0, soft: true, arg: 0 },
      { id: 'H1', atMs: BEAT_MS.hopPerTile, soft: true, arg: 1 },
      { id: 'H1', atMs: 2 * BEAT_MS.hopPerTile, soft: true, arg: 2 },
      { id: 'H2', atMs: 3 * BEAT_MS.hopPerTile, soft: true },
    ]);
  });

  it('lands with a wobble when a mover ends on top of another piece', () => {
    const cues = cuesForBeat(beat('move', [moved('p0', 0, 4)], at({ p0: 4, p3: 4 })), ctx);
    expect(cues.at(-1)).toEqual({ id: 'H3', atMs: 4 * BEAT_MS.hopPerTile, soft: false });
  });

  it('spreads a card move over its beat, rising forward and falling backward', () => {
    const forward = cuesForBeat(beat('cardMove', [moved('p0', 10, 13, 'card')], at({ p0: 13 })), ctx);
    expect(forward.map((c) => c.id)).toEqual(['H1', 'H1', 'H1', 'H2']);
    expect(forward[1]!.atMs).toBe(Math.round(BEAT_MS.cardMove / 4));
    const back = cuesForBeat(beat('cardMove', [moved('p1', 10, 8, 'card')], at({ p1: 8 })), ctx);
    expect(back.map((c) => [c.id, c.soft])).toEqual([['B1', true], ['B1', true], ['H2', true]]);
  });

  it('plays slides, launches, knockbacks, step-backs and blocked snakes, softly for others', () => {
    expect(cuesForBeat(beat('slide', [moved('p0', 47, 26, 'snake')]), ctx)).toEqual([{ id: 'S1', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('launch', [moved('p1', 5, 20, 'ladder')]), ctx)).toEqual([{ id: 'L1', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('knockback', [moved('p2', 9, 6, 'knockback')]), ctx)).toEqual([{ id: 'K1', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('stepBack', [moved('p0', 9, 7, 'stepBack')]), ctx)).toEqual([
      { id: 'B1', atMs: 0, soft: false, arg: 0 },
      { id: 'B1', atMs: BEAT_MS.stepBackPerTile, soft: false, arg: 1 },
    ]);
    expect(cuesForBeat(beat('snakeBlocked', [{ type: 'SnakeBlocked', player: 'p0', tile: 47, effectId: 'e1', visibility: 'public' }]), ctx)).toEqual([{ id: 'B2', atMs: 0, soft: false }]);
  });

  it('stings a face-off and ducks the music; results only for my own face-off', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: 9, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' };
    expect(cuesForBeat(beat('faceOff', [started]), ctx)).toEqual([{ id: 'F1', atMs: 0, soft: false, duck: FACE_OFF_DUCK_S }]);
    const result = (winner: PlayerId | null, losers: PlayerId[], outcome: 'win' | 'replay', players: PlayerId[] = ['p0', 'p1']): GameEvent => ({
      type: 'ChallengeResolved',
      challengeId: 'c1',
      pickRound: 1,
      picks: Object.fromEntries(players.map((p) => [p, 'rock'])),
      winner,
      losers,
      outcome,
      visibility: 'public',
    });
    expect(cuesForBeat(beat('faceOffResult', [result('p0', ['p1'], 'win')]), ctx)).toEqual([{ id: 'F3', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('faceOffResult', [result('p1', ['p0'], 'win')]), ctx)).toEqual([{ id: 'F4', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('faceOffResult', [result(null, [], 'replay')]), ctx)).toEqual([{ id: 'F5', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('faceOffResult', [result('p2', ['p3'], 'win', ['p2', 'p3'])]), ctx)).toEqual([]);
  });

  it('flips the revealed cards and sounds each resolution, softly when it is not about me', () => {
    const picked = (player: PlayerId): GameEvent => ({ type: 'CardSelected', player, cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false, visibility: 'public' });
    expect(cuesForBeat(beat('cardReveal', [picked('p0'), picked('p2')]), ctx)).toEqual([{ id: 'C4', atMs: 0, soft: false, arg: 2 }]);
    const resolved = (caster: PlayerId, target: PlayerId | null, result: 'hit' | 'blocked' | 'fizzled'): GameEvent => ({ type: 'CardResolved', caster, cardId: 'shove', target, result, visibility: 'public' });
    expect(cuesForBeat(beat('cardResolved', [resolved('p1', 'p0', 'hit')]), ctx)).toEqual([{ id: 'C5', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('cardResolved', [resolved('p1', 'p2', 'blocked')]), ctx)).toEqual([{ id: 'B2', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('cardResolved', [resolved('p0', null, 'fizzled')]), ctx)).toEqual([{ id: 'C6', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('clash', [{ type: 'Clash', cardIds: ['a', 'b'], casters: ['p1', 'p2'], players: ['p3'], visibility: 'public' }]), ctx)).toEqual([{ id: 'C7', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('boardEdit', [{ type: 'BoardEditExpired', editId: 'x', restored: [], dropped: [], visibility: 'public' }]), ctx)).toEqual([{ id: 'C9', atMs: 0, soft: false }]);
  });

  it('plays my win or another win with the music fading, then a pop per place, last place first', () => {
    expect(cuesForBeat(beat('victory', [won('p0', [])]), ctx)).toEqual([{ id: 'W1', atMs: 0, soft: false, musicOut: true }]);
    expect(cuesForBeat(beat('victory', [won('p2', [])]), ctx)).toEqual([{ id: 'W2', atMs: 0, soft: false, musicOut: true }]);
    const ranks = won('p2', [['p2', 1], ['p0', 2], ['p1', 3], ['p3', 3]]);
    expect(cuesForBeat(beat('ranks', [ranks]), ctx)).toEqual([
      { id: 'W3', atMs: 0, soft: false, arg: 3 },
      { id: 'W3', atMs: BEAT_MS.rankStep, soft: false, arg: 2 },
    ]);
  });

  it('plays nothing for HUD-only beats', () => {
    expect(cuesForBeat(beat('info', [{ type: 'RoundStarted', round: 2, visibility: 'public' }]), ctx)).toEqual([]);
  });
});

describe('cues from the log (spec #3 §5)', () => {
  it('sparkles when I land on a "?", zings when a card changes my move, and shimmers when an effect lands on me', () => {
    const effect = (owner: PlayerId): GameEvent => ({
      type: 'EffectAdded',
      effect: { id: 'e1', owner, sourceCard: 'shield', sourcePlayer: owner, params: { hook: 'block', blocks: 'attack' }, lifetime: { charges: 1 }, createdRound: 1, order: 1 },
      visibility: 'public',
    } as unknown as GameEvent);
    const entries = log([
      { type: 'MysteryOffered', player: 'p0', tile: 9, rarity: 'rare', cards: ['shield', 'aegis', 'sprint'], visibility: { private: 'p0' } },
      { type: 'DiceTotaled', player: 'p0', faces: [6], total: 12, visibility: 'public' },
      { type: 'DiceTotaled', player: 'p1', faces: [2], total: 5, visibility: 'public' },
      effect('p0'),
      effect('p1'),
    ]);
    expect(cuesForLog(entries, 'p0', 6)).toEqual([
      { id: 'B3', atMs: 0, soft: false },
      { id: 'D6', atMs: 0, soft: false },
      { id: 'C10', atMs: 0, soft: false },
    ]);
    expect(cuesForLog(log([{ type: 'DiceTotaled', player: 'p0', faces: [6], total: 3, visibility: 'public' }]), 'p0', 6)).toEqual([{ id: 'D7', atMs: 0, soft: false }]);
    expect(cuesForLog(log([{ type: 'DiceTotaled', player: 'p0', faces: [4], total: 4, visibility: 'public' }]), 'p0', 4)).toEqual([]);
  });
});
